import Foundation

/// Which addresses the page may ask the device to open. Line-for-line port of LinkPolicy.java / renderer/host-policy.js:
/// the check reads the raw string (a URL parser would tidy away a user name, port, backslash, capitals or a trailing dot),
/// so only an exact address from the list, or a new-issue address with exactly the keys title and body, each once and
/// once-encoded, passes.
enum LinkPolicy {
    static let destinations: Set<String> = [
        "https://ko-fi.com/scizers", "https://ko-fi.com/scizers/",
        "https://github.com/scizerss/keylight-piano", "https://github.com/scizerss/keylight-piano/issues",
        "https://github.com/scizerss/keylight-piano/releases", "https://github.com/scizerss/keylight-piano/releases/latest",
        "https://github.com/demixme/GRAB",
    ]
    static let issueNew = "https://github.com/scizerss/keylight-piano/issues/new"

    private static func isHex(_ c: UInt8) -> Bool { (c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x46) }

    private static func encoded(_ value: String) -> Bool {
        let u = Array(value.utf8)
        if u.isEmpty { return false }
        let plain = Set("-._~!*'()".utf8)
        var i = 0
        while i < u.count {
            let c = u[i]
            if (c >= 0x41 && c <= 0x5A) || (c >= 0x61 && c <= 0x7A) || (c >= 0x30 && c <= 0x39) || plain.contains(c) { i += 1; continue }
            if c == 0x25 && i + 2 < u.count && isHex(u[i + 1]) && isHex(u[i + 2]) { i += 3; continue }
            return false
        }
        return !value.contains("%25")
    }

    static func isIssue(_ value: String) -> Bool {
        if value.utf8.count > 2000 || !value.hasPrefix(issueNew + "?") { return false }
        let query = String(value.dropFirst(issueNew.count + 1))
        let pairs = query.split(separator: "&", omittingEmptySubsequences: false).map(String.init)
        if pairs.count != 2 { return false }
        var first: String? = nil
        for pair in pairs {
            guard let at = pair.firstIndex(of: "="), at != pair.startIndex else { return false }
            let key = String(pair[pair.startIndex..<at]), val = String(pair[pair.index(after: at)...])
            if !(key == "title" || key == "body") || !encoded(val) { return false }
            if key == first { return false }
            first = key
        }
        guard let u = URLComponents(string: value) else { return false }
        return u.scheme == "https" && u.host == "github.com" && u.percentEncodedPath == "/scizerss/keylight-piano/issues/new"
            && u.user == nil && u.password == nil && u.port == nil && u.fragment == nil
    }

    static func allowed(_ value: String?) -> Bool {
        guard let value else { return false }
        return destinations.contains(value) || isIssue(value)
    }
}
