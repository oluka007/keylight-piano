import Foundation

/// Conversion between Universal MIDI Packet words (MIDI 1.0 protocol) and the plain byte stream the renderer parses.
enum UMP {
    /// Words of one packet to MIDI 1.0 bytes. Type 1 (system common/real-time) and type 2 (channel voice) are one word;
    /// type 3 (7-bit SysEx) is two words. Anything else (utility, MIDI 2.0, data 128) is skipped by its known size.
    static func bytes(fromWords words: [UInt32]) -> [UInt8] {
        var out: [UInt8] = []
        var i = 0
        while i < words.count {
            let w = words[i]
            let type = Int(w >> 28)
            switch type {
            case 0, 1, 2, 6, 7: // utility, system, channel voice (1 word) and reserved 1-word types
                if type == 1 || type == 2 {
                    let status = UInt8((w >> 16) & 0xFF), d1 = UInt8((w >> 8) & 0xFF), d2 = UInt8(w & 0xFF)
                    out.append(status)
                    let length = dataLength(status: status)
                    if length >= 1 { out.append(d1 & 0x7F) }
                    if length >= 2 { out.append(d2 & 0x7F) }
                }
                i += 1
            case 3, 4, 8, 9, 0xA: // 2-word types
                if type == 3 && i + 1 < words.count {
                    let w2 = words[i + 1]
                    let status = Int((w >> 20) & 0xF), count = min(6, Int((w >> 16) & 0xF))
                    let data: [UInt8] = [UInt8((w >> 8) & 0x7F), UInt8(w & 0x7F), UInt8((w2 >> 24) & 0x7F), UInt8((w2 >> 16) & 0x7F), UInt8((w2 >> 8) & 0x7F), UInt8(w2 & 0x7F)]
                    if status == 0 || status == 1 { out.append(0xF0) }
                    out.append(contentsOf: data.prefix(count))
                    if status == 0 || status == 3 { out.append(0xF7) }
                }
                i += 2
            case 0xB, 0xC: i += 3
            default: i += 4 // 128-bit types
            }
        }
        return out
    }

    /// Data bytes after a status byte (0 for realtime and status-only messages).
    static func dataLength(status: UInt8) -> Int {
        if status < 0xF0 { return (status & 0xF0) == 0xC0 || (status & 0xF0) == 0xD0 ? 1 : 2 }
        switch status { case 0xF1, 0xF3: return 1; case 0xF2: return 2; default: return 0 }
    }
}

/// Splits an outgoing byte stream into complete MIDI messages, with SysEx cut into chunks of at most `chunk` bytes.
enum MidiOut {
    static let maxBytes = 65536
    static let chunk = 256

    /// nil when the bytes are malformed (a data byte before any status, a truncated message, an unterminated SysEx).
    static func split(_ bytes: [UInt8]) -> [[UInt8]]? {
        var messages: [[UInt8]] = []
        var i = 0
        var running: UInt8 = 0
        while i < bytes.count {
            let b = bytes[i]
            if b == 0xF0 {
                guard let end = bytes[i...].firstIndex(of: 0xF7) else { return nil }
                if bytes[(i + 1)..<end].contains(where: { $0 >= 0x80 }) { return nil }
                var start = i
                while start <= end {
                    let stop = min(start + chunk, end + 1)
                    messages.append(Array(bytes[start..<stop])); start = stop
                }
                i = end + 1; running = 0; continue
            }
            if b == 0xF7 { return nil }
            if b >= 0xF8 { messages.append([b]); i += 1; continue }
            var status = b, head = 1
            if b < 0x80 { guard running != 0 else { return nil }; status = running; head = 0 }
            else if b < 0xF0 { running = b } else { running = 0 }
            let n = UMP.dataLength(status: status)
            guard i + head + n <= bytes.count else { return nil }
            let data = Array(bytes[(i + head)..<(i + head + n)])
            if data.contains(where: { $0 >= 0x80 }) { return nil }
            messages.append([status] + data)
            i += head + n
        }
        return messages
    }
}
