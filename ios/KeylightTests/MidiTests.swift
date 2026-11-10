import XCTest
@testable import Keylight

final class MidiBufferTests: XCTestCase {
    private func drainAll(_ b: MidiBuffer) -> [UInt8] { b.drain(maxBytes: 1 << 20) ?? [] }

    func testRunningStatusIsExpanded() {
        let b = MidiBuffer(); b.offer([0x90, 60, 100, 61, 0]); XCTAssertEqual(drainAll(b), [0x90, 60, 100, 0x90, 61, 0])
    }
    func testRealtimeInsideAMessage() {
        let b = MidiBuffer(); b.offer([0x90, 60, 0xF8, 100]); XCTAssertEqual(drainAll(b), [0xF8, 0x90, 60, 100])
    }
    func testSplitAcrossOffers() {
        let b = MidiBuffer(); b.offer([0x90, 60]); XCTAssertNil(b.drain(maxBytes: 100)); b.offer([100]); XCTAssertEqual(drainAll(b), [0x90, 60, 100])
    }
    func testProgramChangeHasOneDataByte() {
        let b = MidiBuffer(); b.offer([0xC2, 7, 8, 0xD2, 9]); XCTAssertEqual(drainAll(b), [0xC2, 7, 0xC2, 8, 0xD2, 9])
    }
    func testSysexDeliveredWhole() {
        let b = MidiBuffer(); b.offer([0xF0, 1, 2]); b.offer([3, 0xF7]); XCTAssertEqual(drainAll(b), [0xF0, 1, 2, 3, 0xF7])
    }
    func testStatusAbortsSysex() {
        let b = MidiBuffer(); b.offer([0xF0, 1, 0x91, 62, 90]); XCTAssertEqual(drainAll(b), [0x91, 62, 90]); XCTAssertTrue(b.hasDropped)
    }
    func testStrayDataBytesAreIgnored() {
        let b = MidiBuffer(); b.offer([1, 2, 0x80, 60, 0, 0xFE]); XCTAssertEqual(drainAll(b), [0x80, 60, 0, 0xFE])
    }
    func testOversizedSysexIsDiscardedWhole() {
        let b = MidiBuffer(); b.offer([0xF0] + Array(repeating: 1, count: MidiBuffer.maxSysex + 100) + [0xF7, 0x90, 60, 1])
        XCTAssertEqual(drainAll(b), [0x90, 60, 1]); XCTAssertTrue(b.hasDropped)
    }
    func testOverflowDropsWholeMessagesOldestFirst() {
        let b = MidiBuffer()
        for i in 0..<(MidiBuffer.maxMessages + 10) { b.offer([0x90, UInt8(i % 100), 1]) }
        XCTAssertEqual(b.count, MidiBuffer.maxMessages)
        let out = drainAll(b)
        XCTAssertEqual(out.count % 3, 0)
        for i in stride(from: 0, to: out.count, by: 3) { XCTAssertEqual(out[i], 0x90) }      // never a partial message
        XCTAssertEqual(b.takeDropped(nowMs: 10_000), 10)
        XCTAssertEqual(b.takeDropped(nowMs: 10_001), 0)
    }
    func testOverflowAfterRunningStatusKeepsNotesCorrect() {
        let b = MidiBuffer(); b.offer([0x90])
        for i in 0..<(MidiBuffer.maxMessages * 2) { b.offer([UInt8(i % 100), 1]) }
        let out = drainAll(b)
        for i in stride(from: 0, to: out.count, by: 3) { XCTAssertEqual(out[i], 0x90); XCTAssertEqual(out[i + 2], 1) }
    }
    func testSysexSurvivesPlainOverflowAndOrderHolds() {
        let b = MidiBuffer(); b.offer([0xF0, 5, 0xF7]); b.offer([0x90, 60, 1])
        XCTAssertEqual(b.drain(maxBytes: 3), [0xF0, 5, 0xF7]); XCTAssertEqual(b.drain(maxBytes: 3), [0x90, 60, 1])
    }
    func testDrainHonoursMaxBytesButAlwaysTakesOne() {
        let b = MidiBuffer(); b.offer([0x90, 1, 1, 0x90, 2, 1, 0x90, 3, 1])
        XCTAssertEqual(b.drain(maxBytes: 6)?.count, 6)
        XCTAssertEqual(b.drain(maxBytes: 1)?.count, 3)
    }
    func testFuzzKeepsInvariants() {
        let b = MidiBuffer(); var g = SystemRandomNumberGenerator()
        for _ in 0..<2000 { b.offer((0..<Int.random(in: 1...20, using: &g)).map { _ in UInt8.random(in: 0...255, using: &g) }) }
        let out = drainAll(b); XCTAssertLessThanOrEqual(out.count, MidiBuffer.maxBytes)
        // every delivered message starts with a status byte
        var i = 0
        while i < out.count {
            XCTAssertGreaterThanOrEqual(out[i], 0x80)
            i += out[i] == 0xF0 ? (out[i...].firstIndex(of: 0xF7)! - i + 1) : 1 + UMP.dataLength(status: out[i])
        }
    }
}

final class UMPTests: XCTestCase {
    func testChannelVoice() {
        XCTAssertEqual(UMP.bytes(fromWords: [0x2090_3C64]), [0x90, 0x3C, 0x64])
        XCTAssertEqual(UMP.bytes(fromWords: [0x20C2_0700]), [0xC2, 0x07])
        XCTAssertEqual(UMP.bytes(fromWords: [0x20E0_0140]), [0xE0, 0x01, 0x40])
        XCTAssertEqual(UMP.bytes(fromWords: [0x2090_3C64, 0x2080_3C00]), [0x90, 0x3C, 0x64, 0x80, 0x3C, 0x00])
    }
    func testSystem() {
        XCTAssertEqual(UMP.bytes(fromWords: [0x10F8_0000]), [0xF8])
        XCTAssertEqual(UMP.bytes(fromWords: [0x10F2_0102]), [0xF2, 1, 2])
        XCTAssertEqual(UMP.bytes(fromWords: [0x10F1_4000]), [0xF1, 0x40])
    }
    func testSysexInOnePacketAndInParts() {
        XCTAssertEqual(UMP.bytes(fromWords: [0x3003_7E7F, 0x0900_0000]), [0xF0, 0x7E, 0x7F, 0x09, 0xF7])
        var out = UMP.bytes(fromWords: [0x3016_0102, 0x0304_0506])
        out += UMP.bytes(fromWords: [0x3036_0708, 0x090A_0B0C])
        XCTAssertEqual(out, [0xF0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0xF7])
    }
    func testSkipsUtilityAndUnknownTypes() {
        XCTAssertEqual(UMP.bytes(fromWords: [0x0000_0000, 0x2090_3C64]), [0x90, 0x3C, 0x64])
        XCTAssertEqual(UMP.bytes(fromWords: [0x4090_0000, 0x0000_0000, 0x2090_3C64]), [0x90, 0x3C, 0x64])   // MIDI 2.0 note on is skipped whole
        XCTAssertEqual(UMP.bytes(fromWords: [0xF000_0000, 0, 0, 0, 0x2090_3C64]), [0x90, 0x3C, 0x64])
        XCTAssertEqual(UMP.bytes(fromWords: [0x3003_7E7F]), [])                                              // truncated 64-bit packet
    }
    func testDataBytesAreMaskedTo7Bits() { XCTAssertEqual(UMP.bytes(fromWords: [0x2090_FFFF]), [0x90, 0x7F, 0x7F]) }
}

final class MidiOutTests: XCTestCase {
    func testSplitsMessages() {
        XCTAssertEqual(MidiOut.split([0x90, 60, 100, 0x80, 60, 0]), [[0x90, 60, 100], [0x80, 60, 0]])
        XCTAssertEqual(MidiOut.split([0x90, 60, 100, 61, 0]), [[0x90, 60, 100], [0x90, 61, 0]])      // running status
        XCTAssertEqual(MidiOut.split([0xC0, 5, 0xF8, 0xFE]), [[0xC0, 5], [0xF8], [0xFE]])
    }
    func testSysexChunking() {
        let body = [UInt8](repeating: 5, count: 1000)
        let parts = MidiOut.split([0xF0] + body + [0xF7])!
        XCTAssertEqual(parts.flatMap { $0 }, [0xF0] + body + [0xF7])
        XCTAssertTrue(parts.allSatisfy { $0.count <= MidiOut.chunk })
    }
    func testRejectsMalformed() {
        for bad: [UInt8] in [[60], [0x90, 60], [0x90, 200, 1], [0xF0, 1, 2], [0xF0, 0x90, 0xF7], [0xF7], [0xF0, 1, 0xF7, 5]] { XCTAssertNil(MidiOut.split(bad), "\(bad)") }
    }
}
