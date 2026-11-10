import Foundation

/// Bounded buffer between a MIDI input port (any thread) and delivery to JavaScript. Port of MidiBuffer.java:
/// incoming bytes are parsed into COMPLETE MIDI messages (running status is expanded, so every stored message carries its
/// own status byte); only whole messages are ever stored, dropped or delivered, so an overflow can never leave a partial
/// or running-status message that plays a wrong note. When full the oldest non-SysEx message is dropped first, then the
/// oldest SysEx one; every drop is counted. A SysEx longer than `maxSysex` data bytes is discarded whole.
final class MidiBuffer: @unchecked Sendable {
    static let maxMessages = 4096
    static let maxBytes = 256 * 1024
    static let maxSysex = 64 * 1024
    static let reportMs: UInt64 = 1000

    private struct Message { let data: [UInt8]; let seq: UInt64 }
    private let lock = NSLock()
    private var plain: [Message] = [], sysex: [Message] = []
    private var plainHead = 0, sysexHead = 0
    private var bytes = 0
    private var seq: UInt64 = 0, dropped: UInt64 = 0
    private var lastReport: UInt64? = nil
    // parser state
    private var running = 0, need = 0
    private var partial = [UInt8](repeating: 0, count: 3), have = 0
    private var sysexBuf: [UInt8] = [], inSysex = false, discarding = false

    func offer(_ data: [UInt8]) {
        lock.lock(); defer { lock.unlock() }
        for b in data { push(Int(b)) }
    }

    private func push(_ b: Int) {
        if b >= 0xF8 { store([UInt8(b)], sysex: false); return }
        if b == 0xF0 { have = 0; need = 0; inSysex = true; discarding = false; sysexBuf = [0xF0]; running = 0; return }
        if b == 0xF7 {
            if inSysex {
                inSysex = false
                if !discarding { sysexBuf.append(0xF7); store(sysexBuf, sysex: true) }
                discarding = false; sysexBuf = []
            }
            return
        }
        if b >= 0x80 {
            if inSysex { inSysex = false; if discarding { discarding = false } else { dropped += 1 }; sysexBuf = [] }
            have = 0
            if b >= 0xF1 {
                running = 0
                if b == 0xF6 { store([UInt8(b)], sysex: false); need = 0 }
                else if b == 0xF4 || b == 0xF5 { need = 0 }
                else { partial[0] = UInt8(b); have = 1; need = b == 0xF2 ? 2 : 1 }
            } else {
                running = b; partial[0] = UInt8(b); have = 1
                need = (b & 0xF0) == 0xC0 || (b & 0xF0) == 0xD0 ? 1 : 2
            }
            return
        }
        if inSysex {
            if discarding { return }
            if sysexBuf.count > MidiBuffer.maxSysex { discarding = true; dropped += 1; sysexBuf = []; return }
            sysexBuf.append(UInt8(b)); return
        }
        if have == 0 {
            if running == 0 { return }
            partial[0] = UInt8(running); have = 1
            need = (running & 0xF0) == 0xC0 || (running & 0xF0) == 0xD0 ? 1 : 2
        }
        partial[have] = UInt8(b); have += 1
        need -= 1
        if need == 0 { store(Array(partial[0..<have]), sysex: false); have = 0 }
    }

    private var plainCount: Int { plain.count - plainHead }
    private var sysexCount: Int { sysex.count - sysexHead }

    private func store(_ message: [UInt8], sysex isSysex: Bool) {
        if message.count > MidiBuffer.maxBytes { dropped += 1; return }
        while plainCount + sysexCount >= MidiBuffer.maxMessages || bytes + message.count > MidiBuffer.maxBytes {
            if plainCount > 0 { bytes -= plain[plainHead].data.count; plainHead += 1 }
            else if sysexCount > 0 { bytes -= sysex[sysexHead].data.count; sysexHead += 1 }
            else { break }
            dropped += 1
        }
        seq += 1
        if isSysex { sysex.append(Message(data: message, seq: seq)) } else { plain.append(Message(data: message, seq: seq)) }
        bytes += message.count
        if plainHead > 1024 { plain.removeFirst(plainHead); plainHead = 0 }
        if sysexHead > 64 { sysex.removeFirst(sysexHead); sysexHead = 0 }
    }

    /// Concatenation of the oldest whole messages, in arrival order, up to maxBytes (always at least one); nil when empty.
    func drain(maxBytes: Int) -> [UInt8]? {
        lock.lock(); defer { lock.unlock() }
        if plainCount == 0 && sysexCount == 0 { return nil }
        var out: [UInt8] = []
        while plainCount > 0 || sysexCount > 0 {
            let a = plainCount > 0 ? plain[plainHead] : nil
            let b = sysexCount > 0 ? sysex[sysexHead] : nil
            let takePlain: Bool
            if let a, let b { takePlain = a.seq < b.seq } else { takePlain = a != nil }
            let next = takePlain ? a! : b!
            if !out.isEmpty && out.count + next.data.count > maxBytes { break }
            if takePlain { plainHead += 1 } else { sysexHead += 1 }
            bytes -= next.data.count
            out.append(contentsOf: next.data)
        }
        if plainHead == plain.count { plain.removeAll(keepingCapacity: true); plainHead = 0 }
        if sysexHead == sysex.count { sysex.removeAll(keepingCapacity: true); sysexHead = 0 }
        return out
    }

    var isEmpty: Bool { lock.lock(); defer { lock.unlock() }; return plainCount == 0 && sysexCount == 0 }
    var count: Int { lock.lock(); defer { lock.unlock() }; return plainCount + sysexCount }
    var byteCount: Int { lock.lock(); defer { lock.unlock() }; return bytes }
    var hasDropped: Bool { lock.lock(); defer { lock.unlock() }; return dropped > 0 }

    /// Drops since the last report, at most once per reportMs; 0 when nothing is due.
    func takeDropped(nowMs: UInt64) -> UInt64 {
        lock.lock(); defer { lock.unlock() }
        if dropped == 0 { return 0 }
        if let last = lastReport, nowMs &- last < MidiBuffer.reportMs { return 0 }
        let n = dropped; dropped = 0; lastReport = nowMs; return n
    }

    func reset() {
        lock.lock(); defer { lock.unlock() }
        plain = []; sysex = []; plainHead = 0; sysexHead = 0; bytes = 0
        running = 0; need = 0; have = 0; inSysex = false; discarding = false; sysexBuf = []
    }
}
