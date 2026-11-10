import XCTest
@testable import Keylight

final class PathPolicyTests: XCTestCase {
    var root: URL!
    var outside: URL!

    override func setUpWithError() throws {
        let base = FileManager.default.temporaryDirectory.appendingPathComponent("kl-path-\(UUID().uuidString)")
        root = base.appendingPathComponent("web"); outside = base.appendingPathComponent("secret.txt")
        try FileManager.default.createDirectory(at: root.appendingPathComponent("renderer/songs"), withIntermediateDirectories: true)
        try "<html>".write(to: root.appendingPathComponent("renderer/index.html"), atomically: true, encoding: .utf8)
        try "x".write(to: root.appendingPathComponent("renderer/songs/a b.mid"), atomically: true, encoding: .utf8)
        try "x".write(to: root.appendingPathComponent("renderer/.hidden"), atomically: true, encoding: .utf8)
        try "secret".write(to: outside, atomically: true, encoding: .utf8)
        try FileManager.default.createSymbolicLink(at: root.appendingPathComponent("renderer/link.txt"), withDestinationURL: outside)
    }
    override func tearDownWithError() throws { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }

    private func resolve(_ s: String) -> URL? { URL(string: s).flatMap { PathPolicy.resolve($0, root: root) } }

    func testServesBundleFiles() {
        XCTAssertNotNil(resolve("keylight-app://app/renderer/index.html"))
        XCTAssertNotNil(resolve("keylight-app://app/renderer/index.html?appVersion=1"))
        XCTAssertNotNil(resolve("keylight-app://app/renderer/songs/a%20b.mid"))
    }

    func testRefusesTraversalAndOddPaths() {
        for s in ["keylight-app://app/renderer/../../secret.txt", "keylight-app://app/renderer/%2e%2e/%2e%2e/secret.txt", "keylight-app://app/renderer/%2E%2E%2Fsecret.txt",
                  "keylight-app://app/renderer/..%2fsecret.txt", "keylight-app://app/renderer/%252e%252e/secret.txt", "keylight-app://app/renderer\\..\\secret.txt",
                  "keylight-app://app/renderer/index.html%00.png", "keylight-app://app/renderer/.hidden", "keylight-app://app/renderer/link.txt",
                  "keylight-app://app/renderer/", "keylight-app://app/renderer", "keylight-app://app/", "keylight-app://app//renderer/index.html",
                  "keylight-app://app/renderer/./index.html", "keylight-app://app/nothing.js"] {
            XCTAssertNil(resolve(s), s)
        }
    }

    func testRefusesOtherOrigins() {
        for s in ["keylight-app://evil/renderer/index.html", "keylight-app://app:8080/renderer/index.html", "keylight-app://user@app/renderer/index.html",
                  "https://app/renderer/index.html", "file:///etc/passwd", "keylight-other://app/renderer/index.html"] {
            XCTAssertNil(resolve(s), s)
        }
    }

    func testMainPage() {
        XCTAssertTrue(PathPolicy.isMainPage(URL(string: "keylight-app://app/renderer/index.html?appVersion=0.3.0")!))
        XCTAssertFalse(PathPolicy.isMainPage(URL(string: "keylight-app://app/renderer/app.js")!))
        XCTAssertFalse(PathPolicy.isMainPage(URL(string: "https://app/renderer/index.html")!))
    }

    func testMimeTypes() {
        XCTAssertEqual(PathPolicy.mime(forExtension: "js"), "text/javascript; charset=utf-8")
        XCTAssertEqual(PathPolicy.mime(forExtension: "WASM"), "application/wasm")
        XCTAssertEqual(PathPolicy.mime(forExtension: "mid"), "audio/midi")
        XCTAssertEqual(PathPolicy.mime(forExtension: "woff2"), "font/woff2")
        XCTAssertEqual(PathPolicy.mime(forExtension: "png"), "image/png")
        XCTAssertEqual(PathPolicy.mime(forExtension: "json"), "application/json; charset=utf-8")
        XCTAssertEqual(PathPolicy.mime(forExtension: "unknown"), "application/octet-stream")
    }

    func testRanges() {
        XCTAssertEqual(PathPolicy.range(header: "bytes=0-9", size: 100), 0...9)
        XCTAssertEqual(PathPolicy.range(header: "bytes=90-", size: 100), 90...99)
        XCTAssertEqual(PathPolicy.range(header: "bytes=-10", size: 100), 90...99)
        XCTAssertEqual(PathPolicy.range(header: "bytes=50-500", size: 100), 50...99)
        XCTAssertNil(PathPolicy.range(header: "bytes=100-", size: 100))
        XCTAssertNil(PathPolicy.range(header: "bytes=5-2", size: 100))
        XCTAssertNil(PathPolicy.range(header: "bytes=0-1,5-6", size: 100))
        XCTAssertNil(PathPolicy.range(header: nil, size: 100))
        XCTAssertNil(PathPolicy.range(header: "items=0-1", size: 100))
    }

    func testCSPIsStrict() {
        XCTAssertTrue(PathPolicy.csp.contains("default-src 'self'"))
        XCTAssertTrue(PathPolicy.csp.contains("connect-src 'self' blob:"))
        XCTAssertFalse(PathPolicy.csp.contains("http"))
    }
}
