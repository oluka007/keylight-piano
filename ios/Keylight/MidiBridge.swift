import CoreMIDI
import CryptoKit
import Foundation

/// One endpoint as the renderer sees it (same shape the Android host sends).
struct MidiPortInfo: Equatable {
    let id: String, type: String, name: String, portName: String, transport: String, manufacturer: String, version: String
    var json: [String: Any] {
        ["id": id, "type": type, "name": name, "portName": portName, "transport": transport, "manufacturer": manufacturer, "version": version]
    }
}

/// CoreMIDI side of the bridge: hot-plug, enumeration, input delivery in batches, output with chunked SysEx.
/// All CoreMIDI work happens on one serial queue; results go to `emit` as JSON-ready dictionaries.
final class MidiBridge: @unchecked Sendable {
    static let batchInterval = 0.016
    static let batchBytes = 4096                     // per port and batch: 4096 B / 16 ms is the per-port rate ceiling

    private let queue = DispatchQueue(label: "org.keylight.midi", qos: .userInteractive)
    private let emit: @Sendable (String) -> Void
    private var client = MIDIClientRef(), inPort = MIDIPortRef(), outPort = MIDIPortRef()
    private var endpoints: [String: (ref: MIDIEndpointRef, info: MidiPortInfo)] = [:]
    private var open: [String: Token] = [:]          // opened input ports
    private var buffers: [String: MidiBuffer] = [:]
    private let tokenLock = NSLock()
    private var tokenMap: [Int: String] = [:]          // read on the CoreMIDI thread, so it has its own lock (never queue.sync from there)
    private func setToken(_ t: Int, _ id: String?) { tokenLock.lock(); tokenMap[t] = id; tokenLock.unlock() }
    private func clearTokens() { tokenLock.lock(); tokenMap = [:]; tokenLock.unlock() }
    private var nextToken = 1
    private var flushScheduled = false, lastFlush = DispatchTime.now()
    private var started = false
    typealias Token = Int
    private let admission = MidiAdmission()
    private var limiter = MidiRateLimiter()
    /// The two CoreMIDI calls whose failures must reach the page. Replaceable by tests only.
    var connectSource: (MIDIPortRef, MIDIEndpointRef, Int) -> OSStatus = { port, ref, token in
        MIDIPortConnectSource(port, ref, UnsafeMutableRawPointer(bitPattern: token))
    }
    var transmit: (MIDIPortRef, MIDIEndpointRef, [UInt8], MIDITimeStamp) -> OSStatus = { MidiBridge.coreMidiSend(port: $0, destination: $1, message: $2, time: $3) }
    var clock: () -> Double = { Double(DispatchTime.now().uptimeNanoseconds) / 1e9 }
#if DEBUG
    private var testSource = MIDIEndpointRef()
    /// The iOS simulator has no MIDI server (creating a source fails with -10844): a stand-in endpoint feeds the same buffers, so the
    /// delivery path to the page can still be checked there. It never exists on a device.
    private var synthetic: MidiPortInfo?
#endif

    init(emit: @escaping @Sendable (String) -> Void) { self.emit = emit }

    static func json(_ value: Any) -> String {
        guard JSONSerialization.isValidJSONObject(value), let data = try? JSONSerialization.data(withJSONObject: value), let s = String(data: data, encoding: .utf8) else { return "null" }
        return s
    }
    private func post(_ event: [String: Any]) { emit(MidiBridge.json(event)) }

    func start() {
        queue.async { [self] in
            guard !started else { return }
            started = true
            if client == 0 {
                var newClient = MIDIClientRef()
                let status = MIDIClientCreateWithBlock("Keylight" as CFString, &newClient) { [weak self] notification in
                    let id = notification.pointee.messageID
                    guard id == .msgObjectAdded || id == .msgObjectRemoved || id == .msgSetupChanged else { return }
                    self?.queue.async { self?.publish() }
                }
                guard status == noErr else { post(["kind": "error", "error": "MIDI is unavailable (\(status))"]); started = false; return }
                client = newClient
            }
            var newIn = MIDIPortRef(), newOut = MIDIPortRef()
            MIDIInputPortCreateWithProtocol(client, "Keylight in" as CFString, ._1_0, &newIn) { [weak self] list, refCon in
                self?.receive(list: list, source: refCon)
            }
            MIDIOutputPortCreate(client, "Keylight out" as CFString, &newOut)
            inPort = newIn; outPort = newOut
            refresh()
        }
    }

    func stop() {
        queue.async { [self] in
            guard started else { return }
            for (id, _) in open { disconnect(id) }
            open = [:]; buffers = [:]; clearTokens()
            if inPort != 0 { MIDIPortDispose(inPort) }
            if outPort != 0 { MIDIPortDispose(outPort) }
            // the client is kept: disposing the process's only client can make creating another one fail after a scene is recreated
            inPort = 0; outPort = 0; started = false
        }
    }

    // MARK: enumeration

    static func hashed(_ uniqueId: Int32, kind: String) -> String {
        let digest = SHA256.hash(data: Data("keylight:\(uniqueId):\(kind)".utf8))
        return digest.prefix(6).map { String(format: "%02x", $0) }.joined() + ":" + kind
    }

    private static func property(_ ref: MIDIObjectRef, _ key: CFString) -> String {
        var value: Unmanaged<CFString>?
        guard MIDIObjectGetStringProperty(ref, key, &value) == noErr, let s = value?.takeRetainedValue() as String? else { return "" }
        return s.replacingOccurrences(of: "[\\u{0}-\\u{1f}\\u{7f}]", with: " ", options: .regularExpression).trimmingCharacters(in: .whitespaces).prefix(80).description
    }

    private func transport(of ref: MIDIEndpointRef) -> String {
        let owner = Self.property(ref, kMIDIPropertyDriverOwner).lowercased()
        var entity = MIDIEntityRef()
        let hasEntity = MIDIEndpointGetEntity(ref, &entity) == noErr && entity != 0
        if !hasEntity { return "virtual" }
        if owner.contains("bluetooth") { return "ble" }
        if owner.contains("usb") { return "usb" }
        if owner.contains("network") || owner.contains("rtp") { return "network" }
        return "other"
    }

    private func scan() -> [(MIDIEndpointRef, MidiPortInfo)] {
        var found: [(MIDIEndpointRef, MidiPortInfo)] = []
        var seen = Set<String>()
        func add(_ ref: MIDIEndpointRef, type: String) {
            var uid: Int32 = 0
            MIDIObjectGetIntegerProperty(ref, kMIDIPropertyUniqueID, &uid)
            var id = Self.hashed(uid, kind: type)
            var salt: Int32 = 0
            while seen.contains(id) { salt += 1; id = Self.hashed(uid &+ salt &* 7919, kind: type) }   // a hash clash must never merge two ports
            seen.insert(id)
            let name = Self.property(ref, kMIDIPropertyDisplayName)
            let fallback = Self.property(ref, kMIDIPropertyName)
            let info = MidiPortInfo(id: id, type: type, name: name.isEmpty ? (fallback.isEmpty ? "MIDI" : fallback) : name,
                                    portName: fallback, transport: transport(of: ref), manufacturer: Self.property(ref, kMIDIPropertyManufacturer),
                                    version: String(Self.versionString(ref)))
            found.append((ref, info))
        }
#if DEBUG
        if let synthetic { found.append((0, synthetic)) }
#endif
        for i in 0..<MIDIGetNumberOfSources() { add(MIDIGetSource(i), type: "input") }
        for i in 0..<MIDIGetNumberOfDestinations() { add(MIDIGetDestination(i), type: "output") }
        return found
    }

    private static func versionString(_ ref: MIDIEndpointRef) -> String {
        var v: Int32 = 0
        return MIDIObjectGetIntegerProperty(ref, kMIDIPropertyDriverVersion, &v) == noErr && v > 0 ? String(v) : ""
    }

    /// Rebuilds the table, closes ports whose device went away, and tells the page.
    private func refresh() {
        let list = scan()
        var table: [String: (ref: MIDIEndpointRef, info: MidiPortInfo)] = [:]
        for (ref, info) in list { table[info.id] = (ref, info) }
        // an input whose endpoint reference changed (replugged under the same id) is reconnected
        for (id, _) in open {
            if table[id] == nil { disconnect(id); open[id] = nil; buffers[id] = nil }
            else if let old = endpoints[id], old.ref != table[id]!.ref {
                disconnect(id, ref: old.ref)
                let status = connect(id, ref: table[id]!.ref)
                if status != noErr { open[id] = nil; buffers[id] = nil; post(["kind": "error", "error": "Could not reopen the MIDI input (\(status))"]) }
            }
        }
        endpoints = table
    }

    private func publish() {
        refresh()
        post(["kind": "ports", "ports": listJSON()])
    }

    private func listJSON() -> [[String: Any]] {
        endpoints.values.map { $0.info }.sorted { ($0.type, $0.name, $0.id) < ($1.type, $1.name, $1.id) }.map { $0.json }
    }

    // MARK: requests (completion runs on the bridge queue)

    func request(_ request: BridgeRequest, done: @escaping @Sendable (Result<String, BridgeFailure>) -> Void) {
        let admitted: Int?
        if case .send(_, let bytes, _) = request {
            guard admission.admit(bytes: bytes.count) else { done(.failure(BridgeFailure("MIDI is busy: too much waiting to be sent"))); return }
            admitted = bytes.count
        } else { admitted = nil }
        queue.async { [self] in
            defer { if let admitted { admission.release(bytes: admitted) } }
            guard started, client != 0 else { done(.failure(BridgeFailure("MIDI is unavailable"))); return }
            switch request {
            case .list:
                refresh(); done(.success(MidiBridge.json(listJSON())))
            case .open(let port):
                guard let found = lookup(port) else { done(.failure(BridgeFailure("MIDI device disconnected"))); return }
                if found.info.type == "input", open[port] == nil {
                    let status = connect(port, ref: found.ref)
                    if status != noErr { done(.failure(BridgeFailure("Could not open the MIDI input (\(status))"))); return }
                }
                done(.success("true"))
            case .close(let port):
                guard lookup(port) != nil else { done(.failure(BridgeFailure("MIDI device disconnected"))); return }
                disconnect(port); open[port] = nil; buffers[port]?.reset(); buffers[port] = nil
                done(.success("true"))
            case .send(let port, let bytes, let delay):
                guard let found = lookup(port), found.info.type == "output" else { done(.failure(BridgeFailure("MIDI device disconnected"))); return }
                guard let messages = MidiOut.split(bytes) else { done(.failure(BridgeFailure("Malformed MIDI data"))); return }
                guard limiter.allow(messages: messages.count, bytes: bytes.count, at: clock()) else { done(.failure(BridgeFailure("MIDI is busy: sending too fast"))); return }
                if let failure = send(messages, to: found.ref, delayMs: delay) { done(.failure(failure)); return }
                done(.success("true"))
            case .clear(let port):
                guard let found = lookup(port), found.info.type == "output" else { done(.failure(BridgeFailure("MIDI device disconnected"))); return }
                let status = MIDIFlushOutput(found.ref)
                if status != noErr { done(.failure(BridgeFailure("Could not clear the MIDI output (\(status))"))); return }
                done(.success("true"))
            default:
                done(.failure(BridgeFailure("Unknown operation")))
            }
        }
    }

    private func lookup(_ port: String) -> (ref: MIDIEndpointRef, info: MidiPortInfo)? {
        if endpoints[port] == nil { refresh() }
        return endpoints[port]
    }

    // MARK: input

    /// The input counts as open only after CoreMIDI accepted the connection.
    private func connect(_ id: String, ref: MIDIEndpointRef) -> OSStatus {
        let token = nextToken; nextToken += 1
        setToken(token, id)                                 // before connecting: packets may arrive at once
        if ref != 0 {                                       // ref 0 is the DEBUG stand-in endpoint: nothing to connect
            let status = connectSource(inPort, ref, token)
            if status != noErr { setToken(token, nil); return status }
        }
        open[id] = token
        if buffers[id] == nil { buffers[id] = MidiBuffer() }
        return noErr
    }

    private func disconnect(_ id: String, ref: MIDIEndpointRef? = nil) {
        guard let token = open[id] else { return }
        if let ref = ref ?? endpoints[id]?.ref, ref != 0 { MIDIPortDisconnectSource(inPort, ref) }
        setToken(token, nil)
    }

    /// CoreMIDI thread: translate the packets to bytes and hand them to the port's buffer. No JS work here.
    private func receive(list: UnsafePointer<MIDIEventList>, source: UnsafeMutableRawPointer?) {
        guard let source else { return }
        let token = Int(bitPattern: source)
        tokenLock.lock(); let id = tokenMap[token]; tokenLock.unlock()
        guard let id else { return }
        let bytes = UMP.bytes(fromWords: MidiBridge.words(of: list))
        if bytes.isEmpty { return }
        queue.async { [self] in
            guard open[id] == token, let buffer = buffers[id] else { return }       // a closed (or reopened) connection's late packets are dropped
            buffer.offer(bytes)
            scheduleFlush()
        }
    }

    /// Most words one packet may declare; a larger claim is treated as corrupt and ends the walk.
    static let maxPacketWords = 16384

    /// Live callback: CoreMIDI does not tell the list's byte size, so the bound is what the header's packet count allows.
    static func words(of list: UnsafePointer<MIDIEventList>) -> [UInt32] {
        let headerBytes = MemoryLayout<MIDIEventList>.offset(of: \.packet)!
        let packetHead = MemoryLayout<MIDIEventPacket>.offset(of: \.words)!
        let bound = headerBytes + Int(list.pointee.numPackets) * (packetHead + maxPacketWords * 4)
        return words(inEventList: UnsafeRawBufferPointer(start: UnsafeRawPointer(list), count: bound))
    }

    /// Reads every packet of an event list held in `raw` (header then packets). Packets are variable length: each one declares its
    /// own word count (a SysEx packet can have more than the 64 the struct declares), and nothing outside `raw` is read.
    static func words(inEventList raw: UnsafeRawBufferPointer) -> [UInt32] {
        let first = MemoryLayout<MIDIEventList>.offset(of: \.packet)!
        let countAt = MemoryLayout<MIDIEventPacket>.offset(of: \.wordCount)!
        let wordsAt = MemoryLayout<MIDIEventPacket>.offset(of: \.words)!
        guard raw.count >= first else { return [] }
        let numPackets = Int(raw.loadUnaligned(fromByteOffset: MemoryLayout<MIDIEventList>.offset(of: \.numPackets)!, as: UInt32.self))
        var out: [UInt32] = []
        var at = first
        for _ in 0..<numPackets {
            guard at + wordsAt <= raw.count else { break }
            let count = Int(raw.loadUnaligned(fromByteOffset: at + countAt, as: UInt32.self))
            guard count <= maxPacketWords, at + wordsAt + count * 4 <= raw.count else { break }
            for i in 0..<count { out.append(raw.loadUnaligned(fromByteOffset: at + wordsAt + i * 4, as: UInt32.self)) }
            at = (at + wordsAt + count * 4 + 3) & ~3
        }
        return out
    }

    private func scheduleFlush() {
        if flushScheduled { return }
        flushScheduled = true
        let wait = max(0, MidiBridge.batchInterval - Double(DispatchTime.now().uptimeNanoseconds &- lastFlush.uptimeNanoseconds) / 1e9)
        queue.asyncAfter(deadline: .now() + wait) { [self] in flush() }
    }

    private func flush() {
        flushScheduled = false; lastFlush = .now()
        var more = false
        let nowMs = DispatchTime.now().uptimeNanoseconds / 1_000_000
        for (id, buffer) in buffers where open[id] != nil {
            if let chunk = buffer.drain(maxBytes: MidiBridge.batchBytes) { post(["kind": "data", "port": id, "bytes": chunk.map { Int($0) }]) }
            if !buffer.isEmpty { more = true }
            let dropped = buffer.takeDropped(nowMs: nowMs)
            if dropped > 0 { post(["kind": "error", "error": "MIDI input overflowed; \(dropped) messages dropped"]) }
            else if buffer.hasDropped { more = true }   // a report is still due
        }
        if more { scheduleFlush() }
    }

    // MARK: output

    /// nil on success; the first CoreMIDI failure otherwise (messages before it were already sent).
    private func send(_ messages: [[UInt8]], to destination: MIDIEndpointRef, delayMs: Double) -> BridgeFailure? {
        var time = MIDITimeStamp(0)
        if delayMs > 0 {
            var info = mach_timebase_info_data_t(); mach_timebase_info(&info)
            let nanos = delayMs * 1e6
            time = mach_absolute_time() &+ UInt64(nanos * Double(info.denom) / Double(info.numer))
        }
        for message in messages {
            let status = transmit(outPort, destination, message, time)
            if status != noErr { return BridgeFailure("Could not send MIDI (\(status))") }
        }
        return nil
    }

    static func coreMidiSend(port: MIDIPortRef, destination: MIDIEndpointRef, message: [UInt8], time: MIDITimeStamp) -> OSStatus {
        var buffer = [UInt8](repeating: 0, count: 1024 + message.count)
        return buffer.withUnsafeMutableBytes { raw -> OSStatus in
            let list = raw.baseAddress!.assumingMemoryBound(to: MIDIPacketList.self)
            let packet = MIDIPacketListInit(list)
            guard message.withUnsafeBufferPointer({ MIDIPacketListAdd(list, raw.count, packet, time, message.count, $0.baseAddress!) }) != nil else { return OSStatus(kMIDIMessageSendErr) }   // the packet did not fit
            return MIDISend(port, destination, list)
        }
    }

#if DEBUG
    /// Unit tests only: pretends the client started and knows one endpoint, so the request paths run without a MIDI server.
    func installForTests(endpoints list: [(ref: MIDIEndpointRef, info: MidiPortInfo)]) {
        queue.sync {
            started = true; client = 1; inPort = 1; outPort = 1
            for item in list { endpoints[item.info.id] = item }
        }
    }
    func isOpenForTests(_ port: String) -> Bool { queue.sync { open[port] != nil } }
    /// DEBUG only: a virtual source named "Keylight Test Source" that a test can push notes through (see docs/IOS.md).
    func startTestSource() {
        queue.async { [self] in
            guard started, testSource == 0 else { return }
            let status = MIDISourceCreateWithProtocol(client, "Keylight Test Source" as CFString, ._1_0, &testSource)
            NSLog("[midi] test source status=\(status) sources=\(MIDIGetNumberOfSources())")
            if status != noErr {
                testSource = 0
                synthetic = MidiPortInfo(id: Self.hashed(0x7E57, kind: "input"), type: "input", name: "Keylight Test Source", portName: "Keylight Test Source", transport: "virtual", manufacturer: "Keylight", version: "")
            }
            publish()
        }
    }
    func testNote(_ note: UInt8, velocity: UInt8, on: Bool) {
        queue.async { [self] in
            if testSource == 0, let synthetic {
                buffers[synthetic.id]?.offer([on ? 0x90 : 0x80, note & 0x7F, velocity & 0x7F]); scheduleFlush(); return
            }
            guard testSource != 0 else { return }
            var list = MIDIEventList()
            let packet = MIDIEventListInit(&list, ._1_0)
            let word = UInt32(0x2000_0000) | UInt32((on ? 0x90 : 0x80)) << 16 | UInt32(note & 0x7F) << 8 | UInt32(velocity & 0x7F)
            var w = word
            _ = MIDIEventListAdd(&list, MemoryLayout<MIDIEventList>.size, packet, 0, 1, &w)
            MIDIReceivedEventList(testSource, &list)
        }
    }
#endif
}

struct BridgeFailure: Error, Sendable { let message: String; init(_ m: String) { message = m } }


/// Admission control for outgoing messages (the page is untrusted input): how much may wait in the native queue, and how fast
/// messages may leave. Lock-protected; `admit` runs on the caller's thread, so a flood is refused before any work is queued.
final class MidiAdmission: @unchecked Sendable {
    static let maxRequests = 64
    static let maxBytes = 128 * 1024
    private let lock = NSLock()
    private var requests = 0, bytes = 0
    func admit(bytes count: Int) -> Bool {
        lock.lock(); defer { lock.unlock() }
        guard requests < Self.maxRequests, bytes + count <= Self.maxBytes else { return false }
        requests += 1; bytes += count
        return true
    }
    func release(bytes count: Int) {
        lock.lock(); defer { lock.unlock() }
        requests = max(0, requests - 1); bytes = max(0, bytes - count)
    }
    var outstanding: (requests: Int, bytes: Int) { lock.lock(); defer { lock.unlock() }; return (requests, bytes) }
}

/// Token bucket on the messages and bytes sent to CoreMIDI. A burst up to the capacity passes (one full SysEx, a chord with
/// pedal); sustained floods are refused with an error. Time is injected so tests need no waiting.
struct MidiRateLimiter {
    static let messageCapacity = 1024.0, messagesPerSecond = 2048.0
    static let byteCapacity = Double(MidiOut.maxBytes + MidiOut.chunk), bytesPerSecond = 131_072.0
    private var messages = MidiRateLimiter.messageCapacity, bytes = MidiRateLimiter.byteCapacity
    private var last: Double?
    mutating func allow(messages count: Int, bytes size: Int, at now: Double) -> Bool {
        if let last { let dt = max(0, now - last)
            messages = min(Self.messageCapacity, messages + dt * Self.messagesPerSecond)
            bytes = min(Self.byteCapacity, bytes + dt * Self.bytesPerSecond) }
        last = now
        guard Double(count) <= messages, Double(size) <= bytes else { return false }
        messages -= Double(count); bytes -= Double(size)
        return true
    }
}
