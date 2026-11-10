import Foundation

/// Which request may be served from the bundled renderer, and which file it maps to. Everything resolves inside `root`.
enum PathPolicy {
    static let scheme = "keylight-app"
    static let host = "app"
    static let mainPath = "/renderer/index.html"

    static func isMainPage(_ url: URL) -> Bool {
        url.scheme == scheme && url.host == host && url.port == nil && url.user == nil && url.path == mainPath
    }

    /// True for the app origin only: exact scheme and host, no port or credentials.
    static func isTrusted(_ url: URL) -> Bool {
        url.scheme == scheme && url.host == host && url.port == nil && url.user == nil && url.password == nil
    }

    /// The file for a request URL, or nil when the request must be refused (403/404): wrong origin, an encoded or literal
    /// traversal, a backslash, NUL, hidden segment, a symlink leading outside root, or a directory.
    static func resolve(_ url: URL, root: URL) -> URL? {
        guard isTrusted(url) else { return nil }
        let raw = url.path(percentEncoded: true)
        if raw.isEmpty || !raw.hasPrefix("/") || raw.utf8.count > 512 { return nil }
        // decode exactly once; a second pass (a double-encoded dot or slash) must change nothing
        guard let decoded = raw.removingPercentEncoding else { return nil }
        if decoded.contains("\0") || decoded.contains("\\") || decoded.contains("%") { return nil }
        let segments = decoded.split(separator: "/", omittingEmptySubsequences: false).dropFirst()
        for (n, s) in segments.enumerated() {
            if s == "." || s == ".." || s.hasPrefix(".") { return nil }
            if s.isEmpty && n != segments.count - 1 { return nil }   // "//" inside the path
        }
        if decoded.hasSuffix("/") { return nil }
        let base = root.standardizedFileURL.resolvingSymlinksInPath()
        let candidate = base.appendingPathComponent(String(decoded.dropFirst())).standardizedFileURL.resolvingSymlinksInPath()
        let prefix = base.path.hasSuffix("/") ? base.path : base.path + "/"
        guard candidate.path.hasPrefix(prefix) else { return nil }
        var isDir: ObjCBool = false
        guard FileManager.default.fileExists(atPath: candidate.path, isDirectory: &isDir), !isDir.boolValue else { return nil }
        return candidate
    }

    static let mimeTypes: [String: String] = [
        "html": "text/html; charset=utf-8", "js": "text/javascript; charset=utf-8", "mjs": "text/javascript; charset=utf-8",
        "css": "text/css; charset=utf-8", "json": "application/json; charset=utf-8", "map": "application/json; charset=utf-8",
        "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "gif": "image/gif", "webp": "image/webp", "svg": "image/svg+xml",
        "woff": "font/woff", "woff2": "font/woff2", "ttf": "font/ttf", "otf": "font/otf",
        "wasm": "application/wasm", "mid": "audio/midi", "midi": "audio/midi", "mp3": "audio/mpeg", "ogg": "audio/ogg",
        "wav": "audio/wav", "m4a": "audio/mp4", "txt": "text/plain; charset=utf-8", "md": "text/markdown; charset=utf-8",
        "task": "application/octet-stream", "bin": "application/octet-stream", "onnx": "application/octet-stream", "tflite": "application/octet-stream",
        "xml": "application/xml; charset=utf-8", "musicxml": "application/vnd.recordare.musicxml+xml", "mxl": "application/vnd.recordare.musicxml",
    ]
    static func mime(forExtension ext: String) -> String { mimeTypes[ext.lowercased()] ?? "application/octet-stream" }

    /// A single "bytes=a-b" / "bytes=a-" / "bytes=-n" range against a file of `size` bytes; nil when absent or unsatisfiable.
    static func range(header: String?, size: Int) -> ClosedRange<Int>? {
        guard let header, header.hasPrefix("bytes="), size > 0 else { return nil }
        let spec = header.dropFirst(6)
        if spec.contains(",") { return nil }
        let parts = spec.split(separator: "-", maxSplits: 1, omittingEmptySubsequences: false)
        guard parts.count == 2 else { return nil }
        if parts[0].isEmpty {
            guard let n = Int(parts[1]), n > 0 else { return nil }
            return max(0, size - n)...(size - 1)
        }
        guard let a = Int(parts[0]), a >= 0, a < size else { return nil }
        if parts[1].isEmpty { return a...(size - 1) }
        guard let b = Int(parts[1]), b >= a else { return nil }
        return a...min(b, size - 1)
    }

    static let csp = "default-src 'self'; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'; "
        + "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; "
        + "connect-src 'self' blob:; worker-src 'self' blob:; frame-src 'none'; object-src 'none'; "
        + "base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
}
