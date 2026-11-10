import Foundation
import WebKit

/// Serves the bundled renderer at keylight-app://app/... Nothing else: no network, no file://, nothing outside the bundle's web folder.
final class AppSchemeHandler: NSObject, WKURLSchemeHandler {
    let root: URL
    init(root: URL) { self.root = root }

    static var bundledRoot: URL { Bundle.main.bundleURL.appendingPathComponent("web", isDirectory: true) }

    func webView(_ webView: WKWebView, start task: any WKURLSchemeTask) {
        let request = task.request
        guard let url = request.url, request.httpMethod == "GET" || request.httpMethod == "HEAD" else { return fail(task, status: 405) }
        guard let file = PathPolicy.resolve(url, root: root) else { return fail(task, status: 403) }
        if request.mainDocumentURL == url && !PathPolicy.isMainPage(url) { return fail(task, status: 403) }
        guard let data = try? Data(contentsOf: file, options: .mappedIfSafe) else { return fail(task, status: 404) }
        var headers = [
            "Content-Type": PathPolicy.mime(forExtension: file.pathExtension),
            "Content-Security-Policy": PathPolicy.csp,
            "X-Content-Type-Options": "nosniff",
            "Permissions-Policy": "camera=(self), microphone=(), geolocation=()",
            "Cache-Control": "no-store",
            "Accept-Ranges": "bytes",
        ]
        var status = 200
        var body = data
        if let range = PathPolicy.range(header: request.value(forHTTPHeaderField: "Range"), size: data.count) {
            status = 206
            body = data.subdata(in: range.lowerBound..<(range.upperBound + 1))
            headers["Content-Range"] = "bytes \(range.lowerBound)-\(range.upperBound)/\(data.count)"
        }
        headers["Content-Length"] = String(body.count)
        guard let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers) else { return fail(task, status: 500) }
        task.didReceive(response)
        if request.httpMethod != "HEAD" { task.didReceive(body) }
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: any WKURLSchemeTask) {}

    private func fail(_ task: any WKURLSchemeTask, status: Int) {
        let response = HTTPURLResponse(url: task.request.url ?? URL(string: "keylight-app://app/")!, statusCode: status, httpVersion: "HTTP/1.1",
                                       headerFields: ["Content-Type": "text/plain", "Content-Length": "0"])!
        task.didReceive(response); task.didFinish()
    }
}
