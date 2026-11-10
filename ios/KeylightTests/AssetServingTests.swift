import XCTest
@testable import Keylight

/// Every kind of file the renderer ships must be served with the type WebKit needs (images and modules are refused otherwise).
final class AssetServingTests: XCTestCase {
    func testMimeTypesForEveryAssetKind() {
        let expected = ["png": "image/png", "mid": "audio/midi", "woff2": "font/woff2", "json": "application/json; charset=utf-8",
                        "js": "text/javascript; charset=utf-8", "mjs": "text/javascript; charset=utf-8", "css": "text/css; charset=utf-8",
                        "wasm": "application/wasm", "svg": "image/svg+xml", "html": "text/html; charset=utf-8", "mp3": "audio/mpeg",
                        "xml": "application/xml; charset=utf-8", "txt": "text/plain; charset=utf-8", "onnx": "application/octet-stream",
                        "task": "application/octet-stream", "bin": "application/octet-stream"]
        for (ext, mime) in expected { XCTAssertEqual(PathPolicy.mime(forExtension: ext), mime, ext); XCTAssertEqual(PathPolicy.mime(forExtension: ext.uppercased()), mime, ext) }
    }

    /// The real bundled renderer: every file resolves under the policy and, apart from known binary blobs, has a specific type.
    func testEveryBundledFileIsServedWithAType() throws {
        let root = AppSchemeHandler.bundledRoot
        let web = root.appendingPathComponent("renderer")
        guard let walker = FileManager.default.enumerator(at: web, includingPropertiesForKeys: [.isRegularFileKey]) else { return XCTFail("no bundle") }
        var covers = 0, files = 0
        for case let url as URL in walker where (try? url.resourceValues(forKeys: [.isRegularFileKey]).isRegularFile) == true {
            if url.lastPathComponent.hasPrefix(".") { continue }
            files += 1
            let relative = url.path.replacingOccurrences(of: root.path, with: "")
            let encoded = relative.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed)!
            let served = PathPolicy.resolve(URL(string: "keylight-app://app\(encoded)")!, root: root)
            XCTAssertNotNil(served, relative)
            if url.pathExtension == "png" && relative.hasPrefix("/renderer/covers/") {
                covers += 1
                XCTAssertEqual(PathPolicy.mime(forExtension: "png"), "image/png")
            }
            if !url.pathExtension.isEmpty, !["task", "bin", "onnx", "tflite"].contains(url.pathExtension) { XCTAssertNotEqual(PathPolicy.mime(forExtension: url.pathExtension), "application/octet-stream", "\(relative) would be sent untyped") }
        }
        XCTAssertGreaterThanOrEqual(covers, 70, "the illustrated covers are in the app bundle")
        XCTAssertGreaterThan(files, 200)
    }

    @MainActor func testCoverRequestIsAnswered() throws {
        let handler = AppSchemeHandler(root: AppSchemeHandler.bundledRoot)
        let task = FakeTask(URL(string: "keylight-app://app/renderer/covers/twinkle.png")!)
        handler.webView(WKWebView(), start: task)
        XCTAssertEqual(task.status, 200)
        XCTAssertEqual(task.headers["Content-Type"], "image/png")
        XCTAssertGreaterThan(task.bytes, 1000)
        XCTAssertTrue(task.finished)
    }
}

import WebKit
private final class FakeTask: NSObject, WKURLSchemeTask {
    let request: URLRequest
    var status = 0, bytes = 0, finished = false
    var headers: [String: String] = [:]
    init(_ url: URL) { request = URLRequest(url: url) }
    func didReceive(_ response: URLResponse) {
        if let http = response as? HTTPURLResponse { status = http.statusCode; headers = http.allHeaderFields as? [String: String] ?? [:] }
    }
    func didReceive(_ data: Data) { bytes += data.count }
    func didFinish() { finished = true }
    func didFailWithError(_ error: any Error) {}
}
