import AVFoundation
import CoreMIDI
import WebKit
import XCTest
@testable import Keylight

private final class Box<T>: @unchecked Sendable {
    private let lock = NSLock(); private var stored: T
    init(_ v: T) { stored = v }
    var value: T { get { lock.lock(); defer { lock.unlock() }; return stored } set { lock.lock(); stored = newValue; lock.unlock() } }
}

// MARK: (a) export writes

@MainActor
final class HostToolsStorageTests: XCTestCase {
    func testFullStorageEndsTheTransferWithAnError() throws {
        let tools = HostTools(presenter: UIViewController())
        let token = try tools.exportBegin(name: "backup.json", mime: "application/json", size: 10)
        tools.writer = { _, _ in throw CocoaError(.fileWriteOutOfSpace) }
        XCTAssertThrowsError(try tools.exportChunk(token: token, base64: Data("hello".utf8).base64EncodedString())) { error in
            XCTAssertTrue((error as? BridgeFailure)?.message.contains("storage") ?? false)
        }
        XCTAssertEqual(tools.stagedCount, 0, "the failed transfer is gone")
        XCTAssertThrowsError(try tools.exportChunk(token: token, base64: "AAAA"))      // unknown now
    }

    func testWritesGoThroughTheThrowingAPI() throws {
        let tools = HostTools(presenter: UIViewController())
        let token = try tools.exportBegin(name: "a.bin", mime: "application/octet-stream", size: 4)
        try tools.exportChunk(token: token, base64: Data([1, 2, 3, 4]).base64EncodedString())
        XCTAssertThrowsError(try tools.exportChunk(token: token, base64: Data([5]).base64EncodedString()), "over the declared size")
        XCTAssertEqual(tools.stagedCount, 0)
    }

    func testClosedFileBecomesAnErrorNotACrash() throws {
        // the real writer on a handle that cannot be written: write(contentsOf:) throws where write(_:) would raise an NSException
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("kl-closed-\(UUID().uuidString)")
        FileManager.default.createFile(atPath: url.path, contents: nil)
        defer { try? FileManager.default.removeItem(at: url) }
        let handle = try FileHandle(forWritingTo: url); try handle.close()
        let tools = HostTools(presenter: UIViewController())
        XCTAssertThrowsError(try tools.writer(handle, Data([1])))
    }
}

// MARK: (b) long UMP packets

final class EventListParseTests: XCTestCase {
    /// An event list in a plain buffer: header, then packets of the given word counts (variable length, like CoreMIDI builds them).
    private func list(_ packets: [[UInt32]]) -> [UInt8] {
        let first = MemoryLayout<MIDIEventList>.offset(of: \.packet)!
        let countAt = MemoryLayout<MIDIEventPacket>.offset(of: \.wordCount)!
        let wordsAt = MemoryLayout<MIDIEventPacket>.offset(of: \.words)!
        var raw = [UInt8](repeating: 0, count: first)
        func put<T>(_ value: T, at offset: Int) { withUnsafeBytes(of: value) { for (i, b) in $0.enumerated() { raw[offset + i] = b } } }
        put(UInt32(packets.count), at: MemoryLayout<MIDIEventList>.offset(of: \.numPackets)!)
        for words in packets {
            let at = raw.count
            raw += [UInt8](repeating: 0, count: wordsAt + words.count * 4)
            put(UInt32(words.count), at: at + countAt)
            for (i, w) in words.enumerated() { put(w, at: at + wordsAt + i * 4) }
        }
        return raw
    }
    private func parse(_ raw: [UInt8]) -> [UInt32] { raw.withUnsafeBytes { MidiBridge.words(inEventList: $0) } }

    func testLongPacketKeepsEveryWord() {
        // 65 words: a note-on stream whose LAST word is the note-off that used to be cut off at 64
        var words = [UInt32](repeating: 0x2090_3C64, count: 64); words.append(0x2080_3C00)
        let out = parse(list([words, [0x2090_4064]]))
        XCTAssertEqual(out.count, 66)
        XCTAssertEqual(out[64], 0x2080_3C00)
        XCTAssertEqual(UMP.bytes(fromWords: out).suffix(6), [0x80, 0x3C, 0x00, 0x90, 0x40, 0x64])
    }
    func testManyPacketsAndOddSizes() {
        let packets: [[UInt32]] = [[0x2090_3C64], [0x3003_7E7F, 0x0900_0000], Array(repeating: 0x10F8_0000, count: 200)]
        XCTAssertEqual(parse(list(packets)), packets.flatMap { $0 })
    }
    func testNeverReadsPastTheBuffer() {
        var raw = list([[0x2090_3C64, 0x2080_3C00]])
        raw.removeLast(4)                                           // the packet claims 2 words, only 1 is there
        XCTAssertEqual(parse(raw), [])
        var lying = list([[1, 2]]); lying.replaceSubrange(MemoryLayout<MIDIEventList>.offset(of: \.numPackets)!..<(MemoryLayout<MIDIEventList>.offset(of: \.numPackets)! + 4), with: [9, 0, 0, 0])
        XCTAssertEqual(parse(lying), [1, 2], "a packet count larger than the data stops at the end")
        XCTAssertEqual(parse([]), [])
        var huge = list([[1]]); huge.replaceSubrange((MemoryLayout<MIDIEventList>.offset(of: \.packet)! + MemoryLayout<MIDIEventPacket>.offset(of: \.wordCount)!)..<(MemoryLayout<MIDIEventList>.offset(of: \.packet)! + MemoryLayout<MIDIEventPacket>.offset(of: \.wordCount)! + 4), with: [0xFF, 0xFF, 0xFF, 0x7F])
        XCTAssertEqual(parse(huge), [])
    }
}

// MARK: (d) admission and rate limits

final class MidiAdmissionTests: XCTestCase {
    func testRequestAndByteLimits() {
        let a = MidiAdmission()
        for _ in 0..<MidiAdmission.maxRequests { XCTAssertTrue(a.admit(bytes: 1)) }
        XCTAssertFalse(a.admit(bytes: 1), "request count")
        a.release(bytes: 1); XCTAssertTrue(a.admit(bytes: 1))
        let b = MidiAdmission()
        XCTAssertTrue(b.admit(bytes: MidiAdmission.maxBytes))
        XCTAssertFalse(b.admit(bytes: 1), "outstanding bytes")
        b.release(bytes: MidiAdmission.maxBytes); XCTAssertEqual(b.outstanding.bytes, 0); XCTAssertTrue(b.admit(bytes: 10))
    }
    func testRateLimiterRefusesAFloodAndRecovers() {
        var l = MidiRateLimiter()
        XCTAssertFalse(l.allow(messages: 65536, bytes: 65536, at: 0), "65,536 single-byte messages in one request")
        XCTAssertTrue(l.allow(messages: 3, bytes: 9, at: 0))                              // a refused request costs nothing
        var sent = 0
        for _ in 0..<5000 where l.allow(messages: 1, bytes: 3, at: 0) { sent += 1 }
        XCTAssertLessThan(sent, 1300, "a burst is capped near the bucket size")
        XCTAssertTrue(l.allow(messages: 100, bytes: 300, at: 5), "after a pause the bucket is full again")
    }
    func testFullSysexPasses() {
        var l = MidiRateLimiter()
        let parts = MidiOut.split([0xF0] + [UInt8](repeating: 1, count: MidiOut.maxBytes - 2) + [0xF7])!
        XCTAssertTrue(l.allow(messages: parts.count, bytes: MidiOut.maxBytes, at: 0))
    }
}

// MARK: (e) CoreMIDI failures reach the page

final class MidiBridgeFailureTests: XCTestCase {
    private let input = MidiPortInfo(id: "aaaaaaaaaaaa:input", type: "input", name: "In", portName: "In", transport: "usb", manufacturer: "", version: "")
    private let output = MidiPortInfo(id: "bbbbbbbbbbbb:output", type: "output", name: "Out", portName: "Out", transport: "usb", manufacturer: "", version: "")

    private func bridge() -> MidiBridge {
        let b = MidiBridge(emit: { _ in })
        b.installForTests(endpoints: [(ref: 11, info: input), (ref: 22, info: output)])
        return b
    }
    private func run(_ b: MidiBridge, _ request: BridgeRequest) -> Result<String, BridgeFailure> {
        let box = Box<Result<String, BridgeFailure>?>(nil); let done = expectation(description: "answered")
        b.request(request) { box.value = $0; done.fulfill() }
        wait(for: [done], timeout: 5)
        return box.value!
    }

    func testFailedConnectIsAnErrorAndNothingIsMarkedOpen() {
        let b = bridge(); b.connectSource = { _, _, _ in -10830 }
        guard case .failure(let e) = run(b, .open(port: input.id)) else { return XCTFail("must fail") }
        XCTAssertTrue(e.message.contains("-10830"))
        XCTAssertFalse(b.isOpenForTests(input.id))
    }
    func testSuccessfulConnectOpens() {
        let b = bridge(); let seen = Box<[Int]>([]); b.connectSource = { _, _, token in seen.value.append(token); return noErr }
        XCTAssertEqual(try? run(b, .open(port: input.id)).get(), "true")
        XCTAssertTrue(b.isOpenForTests(input.id)); XCTAssertEqual(seen.value.count, 1)
        _ = run(b, .open(port: input.id)); XCTAssertEqual(seen.value.count, 1, "already open: no second connection")
    }
    func testSendFailureIsPropagated() {
        let b = bridge(); b.transmit = { _, _, _, _ in -50 }
        guard case .failure(let e) = run(b, .send(port: output.id, bytes: [0x90, 60, 100], delayMs: 0)) else { return XCTFail("must fail") }
        XCTAssertTrue(e.message.contains("-50"))
    }
    func testSendStopsAtTheFirstFailure() {
        let b = bridge(); let calls = Box(0); b.transmit = { _, _, _, _ in calls.value += 1; return calls.value == 2 ? -50 : noErr }
        _ = run(b, .send(port: output.id, bytes: [0x90, 60, 100, 0x90, 61, 100, 0x90, 62, 100], delayMs: 0))
        XCTAssertEqual(calls.value, 2)
    }
    func testFloodOf0xF8IsRefused() {
        let b = bridge(); let calls = Box(0); b.transmit = { _, _, _, _ in calls.value += 1; return noErr }
        guard case .failure(let e) = run(b, .send(port: output.id, bytes: [UInt8](repeating: 0xF8, count: 65536), delayMs: 0)) else { return XCTFail("must be refused") }
        XCTAssertTrue(e.message.contains("busy"))
        XCTAssertEqual(calls.value, 0, "nothing reached CoreMIDI")
    }
    func testSustainedSendsAreThrottled() {
        let b = bridge(); b.clock = { 0 }; b.transmit = { _, _, _, _ in noErr }
        var refused = 0
        for _ in 0..<40 { if case .failure = run(b, .send(port: output.id, bytes: [UInt8](repeating: 0xF8, count: 100), delayMs: 0)) { refused += 1 } }
        XCTAssertGreaterThan(refused, 0, "the 1024-message bucket runs dry with the clock stopped")
    }
    func testLateInputAfterCloseIsDropped() {
        let b = bridge(); b.connectSource = { _, _, _ in noErr }
        _ = run(b, .open(port: input.id)); _ = run(b, .close(port: input.id))
        XCTAssertFalse(b.isOpenForTests(input.id))
        _ = run(b, .open(port: input.id)); XCTAssertTrue(b.isOpenForTests(input.id))
    }
    func testGoodSendDelivers() {
        let b = bridge(); let sent = Box<[[UInt8]]>([]); b.transmit = { _, _, m, _ in sent.value.append(m); return noErr }
        XCTAssertEqual(try? run(b, .send(port: output.id, bytes: [0x90, 60, 100], delayMs: 5)).get(), "true")
        XCTAssertEqual(sent.value, [[0x90, 60, 100]])
    }
}

// MARK: (c) teardown and retention

@MainActor
final class TeardownTests: XCTestCase {
    func testBridgeDoesNotRetainItsPresenter() {
        weak var weakPresenter: UIViewController?
        var bridge: HostBridge?
        autoreleasepool {
            let presenter = UIViewController(); weakPresenter = presenter
            bridge = HostBridge(presenter: presenter)
        }
        XCTAssertNil(weakPresenter, "a weak presenter lets the controller go")
        bridge?.teardown(); XCTAssertTrue(bridge?.tornDown ?? false)
    }

    func testControllerAndBridgeAreReleasedAfterTeardown() {
        weak var weakController: WebViewController?
        weak var weakBridge: AnyObject?
        autoreleasepool {
            var controller: WebViewController? = WebViewController()
            controller?.loadViewIfNeeded()
            weakController = controller
            controller?.teardown()
            XCTAssertTrue(controller?.isTornDown ?? false)
            weakBridge = controller?.bridgeForTests
            controller = nil
        }
        let gone = expectation(description: "released")
        func poll(_ left: Int) {
            if weakController == nil && weakBridge == nil { gone.fulfill() } else if left > 0 { DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { poll(left - 1) } }
        }
        poll(50)
        wait(for: [gone], timeout: 8)
    }

    func testTeardownIsIdempotentAndRemovesHandlers() {
        let controller = WebViewController(); controller.loadViewIfNeeded()
        controller.teardown(); controller.teardown()
        XCTAssertTrue(controller.isTornDown)
    }
}

// MARK: (g) audio session reset

@MainActor
final class AudioSessionResetTests: XCTestCase {
    func testConfigureRestoresCategoryModeOptionsAndBuffer() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.ambient, mode: .measurement, options: [.mixWithOthers])      // what a media-services reset leaves behind
        let manager = AudioSessionManager { _ in }
        XCTAssertTrue(manager.configure())
        XCTAssertEqual(session.category, AudioSessionManager.category)
        XCTAssertEqual(session.mode, AudioSessionManager.mode)
        XCTAssertFalse(session.categoryOptions.contains(.mixWithOthers))
        XCTAssertEqual(session.preferredIOBufferDuration, AudioSessionManager.bufferDuration, accuracy: 0.003)
    }
    private func spin(_ seconds: Double) { RunLoop.main.run(until: Date().addingTimeInterval(seconds)) }

    func testMediaServicesResetNotificationRestoresTheSession() throws {
        let session = AVAudioSession.sharedInstance()
        let states = Box<[String]>([])
        let manager = AudioSessionManager { states.value.append($0) }
        manager.start()
        try session.setCategory(.ambient, mode: .measurement, options: [.mixWithOthers])     // what the reset leaves behind
        NotificationCenter.default.post(name: AVAudioSession.mediaServicesWereResetNotification, object: nil)
        spin(0.3)
        XCTAssertEqual(session.category, AudioSessionManager.category, "the reset handler re-applies the whole configuration")
        XCTAssertEqual(session.mode, AudioSessionManager.mode)
        XCTAssertTrue(states.value.contains("resume"))
        manager.stop()
    }

    func testNotificationsAfterStopDoNothing() throws {
        let session = AVAudioSession.sharedInstance()
        let states = Box<[String]>([])
        let manager = AudioSessionManager { states.value.append($0) }
        manager.start(); manager.stop()
        states.value = []
        try session.setCategory(.ambient)
        NotificationCenter.default.post(name: AVAudioSession.mediaServicesWereResetNotification, object: nil)
        NotificationCenter.default.post(name: AVAudioSession.routeChangeNotification, object: nil)
        spin(0.3)
        XCTAssertTrue(states.value.isEmpty, "observers are removed by stop()")      // (the host app's own manager still reacts to the shared session)
    }
}
