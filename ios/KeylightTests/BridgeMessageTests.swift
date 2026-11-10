import XCTest
@testable import Keylight

final class BridgeMessageTests: XCTestCase {
    let port = "0123456789ab:input"
    private func parse(_ s: Any) -> (id: Int?, result: Result<BridgeRequest, BridgeError>) { BridgeMessage.parse(s) }
    private func ok(_ json: String) -> BridgeRequest? { if case .success(let r) = parse(json).result { return r }; return nil }

    func testValid() {
        XCTAssertEqual(ok(#"{"id":1,"op":"list"}"#), .list)
        XCTAssertEqual(ok(#"{"id":2,"op":"open","port":"0123456789ab:input"}"#), .open(port: port))
        XCTAssertEqual(ok(#"{"id":3,"op":"send","port":"0123456789ab:output","bytes":[144,60,100],"delay":12.5}"#), .send(port: "0123456789ab:output", bytes: [144, 60, 100], delayMs: 12.5))
        XCTAssertEqual(ok(#"{"id":4,"op":"clipboard","text":"hi"}"#), .clipboard(text: "hi"))
        XCTAssertEqual(ok(#"{"id":5,"op":"blePair"}"#), .blePair)
        XCTAssertEqual(ok(#"{"id":6,"op":"exportBegin","name":"My take 1.webm","mime":"video/webm","size":10}"#), .exportBegin(name: "My take 1.webm", mime: "video/webm", size: 10))
        XCTAssertEqual(ok(#"{"id":7,"op":"openLink","url":"https://ko-fi.com/scizers"}"#), .openLink(url: "https://ko-fi.com/scizers"))
    }

    func testRejectsMalformed() {
        XCTAssertNil(parse(42).id); XCTAssertNil(parse(["id": 1]).id); XCTAssertNil(parse("not json").id); XCTAssertNil(parse("[1,2]").id)
        XCTAssertNil(parse(String(repeating: "a", count: BridgeMessage.maxRaw + 1)).id)
        for bad in [#"{"op":"list"}"#, #"{"id":0,"op":"list"}"#, #"{"id":-1,"op":"list"}"#, #"{"id":1.5,"op":"list"}"#, #"{"id":true,"op":"list"}"#, #"{"id":"1","op":"list"}"#, #"{"id":1e30,"op":"list"}"#] {
            XCTAssertNil(parse(bad).id, bad)
        }
        for bad in [#"{"id":1}"#, #"{"id":1,"op":5}"#, #"{"id":1,"op":"shell"}"#, #"{"id":1,"op":"open"}"#, #"{"id":1,"op":"open","port":"x:input"}"#,
                    #"{"id":1,"op":"open","port":"0123456789AB:input"}"#, #"{"id":1,"op":"open","port":"0123456789ab:both"}"#, #"{"id":1,"op":"open","port":"0123456789ab:input:0"}"#,
                    #"{"id":1,"op":"send","port":"0123456789ab:output"}"#, #"{"id":1,"op":"send","port":"0123456789ab:output","bytes":[]}"#,
                    #"{"id":1,"op":"send","port":"0123456789ab:output","bytes":[256]}"#, #"{"id":1,"op":"send","port":"0123456789ab:output","bytes":[-1]}"#,
                    #"{"id":1,"op":"send","port":"0123456789ab:output","bytes":[1.5]}"#, #"{"id":1,"op":"send","port":"0123456789ab:output","bytes":["a"]}"#,
                    #"{"id":1,"op":"send","port":"0123456789ab:output","bytes":[true]}"#, #"{"id":1,"op":"send","port":"0123456789ab:output","bytes":[1],"delay":"x"}"#,
                    #"{"id":1,"op":"clipboard","text":5}"#, #"{"id":1,"op":"openLink","url":"https://evil.example"}"#, #"{"id":1,"op":"openLink","url":5}"#,
                    #"{"id":1,"op":"exportBegin","name":"../x","mime":"a/b","size":1}"#, #"{"id":1,"op":"exportBegin","name":"a/b","mime":"a/b","size":1}"#,
                    #"{"id":1,"op":"exportBegin","name":".hidden","mime":"a/b","size":1}"#, #"{"id":1,"op":"exportBegin","name":"a.txt","mime":"nope","size":1}"#,
                    #"{"id":1,"op":"exportBegin","name":"a.txt","mime":"a/b","size":-1}"#, #"{"id":1,"op":"exportBegin","name":"a.txt","mime":"a/b","size":268435457}"#,
                    #"{"id":1,"op":"exportChunk","token":"short","data":"AA=="}"#, #"{"id":1,"op":"exportFinish","token":"../../etc/passwd"}"#] {
            let r = parse(bad)
            XCTAssertNotNil(r.id, bad)
            if case .success = r.result { XCTFail("accepted: " + bad) }
        }
    }

    func testSizeCaps() {
        let tooMany = "[" + Array(repeating: "1", count: MidiOut.maxBytes + 1).joined(separator: ",") + "]"
        if case .success = parse(#"{"id":1,"op":"send","port":"0123456789ab:output","bytes":"# + tooMany + "}").result { XCTFail("accepted too many bytes") }
        let big = String(repeating: "a", count: BridgeMessage.maxClipboard + 1)
        if case .success = parse(#"{"id":1,"op":"clipboard","text":""# + big + #""}"#).result { XCTFail("accepted a huge clipboard text") }
        if case .success(let r) = parse(#"{"id":1,"op":"send","port":"0123456789ab:output","bytes":[1],"delay":9999999}"#).result, case .send(_, _, let d) = r { XCTAssertEqual(d, BridgeMessage.maxDelayMs) } else { XCTFail() }
    }

    func testFuzzNeverCrashes() {
        var generator = SystemRandomNumberGenerator()
        let alphabet = Array(#"{}[]",:0123456789.-eE truefalsnop\u"#)
        for _ in 0..<3000 {
            let s = String((0..<Int.random(in: 0...80, using: &generator)).map { _ in alphabet.randomElement(using: &generator)! })
            _ = parse(s)
        }
    }
}
