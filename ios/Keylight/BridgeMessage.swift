import Foundation

/// One request from the page, fully validated. Nothing outside this file touches raw JSON from JavaScript.
enum BridgeRequest: Equatable {
    case list
    case open(port: String)
    case close(port: String)
    case send(port: String, bytes: [UInt8], delayMs: Double)
    case clear(port: String)
    case clipboard(text: String)
    case openLink(url: String)
    case deviceUsb
    case blePair
    case exportBegin(name: String, mime: String, size: Int)
    case exportChunk(token: String, data: String)
    case exportFinish(token: String)
    case exportAbort(token: String)
}

enum BridgeError: Error, Equatable {
    case tooLarge, notJSON, badId, badOp(String), badField(String)
    var message: String {
        switch self {
        case .tooLarge: return "Message too large"
        case .notJSON: return "Malformed message"
        case .badId: return "Invalid request id"
        case .badOp: return "Unknown operation"
        case .badField(let f): return "Invalid " + f
        }
    }
}

enum BridgeMessage {
    static let maxRaw = 400_000
    static let maxClipboard = 100_000
    static let maxExport = 256 * 1024 * 1024
    static let maxChunkBase64 = 65_536
    static let maxDelayMs = 60_000.0

    /// 12 lowercase hex characters (a hash of the endpoint's unique id), a colon, then input or output.
    static func validPort(_ s: String) -> Bool {
        let parts = s.split(separator: ":", omittingEmptySubsequences: false)
        guard parts.count == 2, parts[0].utf8.count == 12, parts[1] == "input" || parts[1] == "output" else { return false }
        return parts[0].utf8.allSatisfy { ($0 >= 0x30 && $0 <= 0x39) || ($0 >= 0x61 && $0 <= 0x66) }
    }
    static func validToken(_ s: String) -> Bool {
        s.utf8.count >= 8 && s.utf8.count <= 64 && s.utf8.allSatisfy { ($0 >= 0x30 && $0 <= 0x39) || ($0 >= 0x61 && $0 <= 0x7A) || ($0 >= 0x41 && $0 <= 0x5A) || $0 == 0x2D }
    }
    /// Plain file names only: letters, digits, . _ - and space, starting with a letter or digit, no "..".
    static func validFileName(_ s: String) -> Bool {
        let u = Array(s.utf8)
        guard !u.isEmpty, u.count <= 128, !s.contains("..") else { return false }
        func alnum(_ c: UInt8) -> Bool { (c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x5A) || (c >= 0x61 && c <= 0x7A) }
        guard alnum(u[0]) else { return false }
        return u.allSatisfy { alnum($0) || $0 == 0x2E || $0 == 0x5F || $0 == 0x2D || $0 == 0x20 }
    }
    static func validMime(_ s: String) -> Bool {
        s.utf8.count <= 100 && s.range(of: #"^[a-z0-9][a-z0-9.+-]*/[a-z0-9][a-z0-9.+-]*$"#, options: .regularExpression) != nil
    }

    private static func integer(_ any: Any?) -> Int? {
        guard let n = any as? NSNumber, CFGetTypeID(n) != CFBooleanGetTypeID() else { return nil }
        let d = n.doubleValue
        guard d.isFinite, d == d.rounded(), abs(d) <= 9_007_199_254_740_991 else { return nil }
        return Int(d)
    }
    private static func number(_ any: Any?) -> Double? {
        guard let n = any as? NSNumber, CFGetTypeID(n) != CFBooleanGetTypeID(), n.doubleValue.isFinite else { return nil }
        return n.doubleValue
    }

    /// Returns the request id (when it could be read, so the caller can answer the error) and the parsed request.
    static func parse(_ body: Any) -> (id: Int?, result: Result<BridgeRequest, BridgeError>) {
        guard let raw = body as? String else { return (nil, .failure(.notJSON)) }
        if raw.utf8.count > maxRaw { return (nil, .failure(.tooLarge)) }
        guard let data = raw.data(using: .utf8),
              let object = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return (nil, .failure(.notJSON)) }
        guard let id = integer(object["id"]), id >= 1 else { return (nil, .failure(.badId)) }
        guard let op = object["op"] as? String else { return (id, .failure(.badField("op"))) }
        func port() -> String? { (object["port"] as? String).flatMap { validPort($0) ? $0 : nil } }
        func token() -> String? { (object["token"] as? String).flatMap { validToken($0) ? $0 : nil } }
        switch op {
        case "list": return (id, .success(.list))
        case "deviceUsb": return (id, .success(.deviceUsb))
        case "blePair": return (id, .success(.blePair))
        case "open", "close", "clear":
            guard let p = port() else { return (id, .failure(.badField("port"))) }
            return (id, .success(op == "open" ? .open(port: p) : op == "close" ? .close(port: p) : .clear(port: p)))
        case "send":
            guard let p = port() else { return (id, .failure(.badField("port"))) }
            guard let array = object["bytes"] as? [Any], !array.isEmpty, array.count <= MidiOut.maxBytes else { return (id, .failure(.badField("bytes"))) }
            var bytes = [UInt8](); bytes.reserveCapacity(array.count)
            for item in array {
                guard let v = integer(item), v >= 0, v <= 255 else { return (id, .failure(.badField("bytes"))) }
                bytes.append(UInt8(v))
            }
            var delay = 0.0
            if let raw = object["delay"] {
                guard let d = number(raw) else { return (id, .failure(.badField("delay"))) }
                delay = min(max(d, 0), maxDelayMs)
            }
            return (id, .success(.send(port: p, bytes: bytes, delayMs: delay)))
        case "clipboard":
            guard let t = object["text"] as? String, t.utf8.count <= maxClipboard else { return (id, .failure(.badField("text"))) }
            return (id, .success(.clipboard(text: t)))
        case "openLink":
            guard let u = object["url"] as? String, LinkPolicy.allowed(u) else { return (id, .failure(.badField("url"))) }
            return (id, .success(.openLink(url: u)))
        case "exportBegin":
            guard let n = object["name"] as? String, validFileName(n) else { return (id, .failure(.badField("name"))) }
            guard let m = object["mime"] as? String, validMime(m) else { return (id, .failure(.badField("mime"))) }
            guard let s = integer(object["size"]), s >= 0, s <= maxExport else { return (id, .failure(.badField("size"))) }
            return (id, .success(.exportBegin(name: n, mime: m, size: s)))
        case "exportChunk":
            guard let t = token() else { return (id, .failure(.badField("token"))) }
            guard let d = object["data"] as? String, d.utf8.count <= maxChunkBase64 else { return (id, .failure(.badField("data"))) }
            return (id, .success(.exportChunk(token: t, data: d)))
        case "exportFinish", "exportAbort":
            guard let t = token() else { return (id, .failure(.badField("token"))) }
            return (id, .success(op == "exportFinish" ? .exportFinish(token: t) : .exportAbort(token: t)))
        default: return (id, .failure(.badOp(op)))
        }
    }
}
