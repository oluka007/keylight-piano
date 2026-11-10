import XCTest
@testable import Keylight

final class LinkPolicyTests: XCTestCase {
    func testGood() {
        for url in ["https://ko-fi.com/scizers", "https://ko-fi.com/scizers/", "https://github.com/scizerss/keylight-piano", "https://github.com/scizerss/keylight-piano/issues",
                    "https://github.com/scizerss/keylight-piano/releases", "https://github.com/scizerss/keylight-piano/releases/latest", "https://github.com/demixme/GRAB",
                    "https://github.com/scizerss/keylight-piano/issues/new?title=Support%20my%20device&body=Report%0A%0Aline",
                    "https://github.com/scizerss/keylight-piano/issues/new?body=x&title=y"] {
            XCTAssertTrue(LinkPolicy.allowed(url), url)
        }
    }

    func testBad() {
        let n = "https://github.com/scizerss/keylight-piano/issues/new"
        let bad = ["", "http://github.com/scizerss/keylight-piano", "https://github.com.evil.com/scizerss/keylight-piano", "https://evil.com/https://github.com/scizerss/keylight-piano",
                   "https://github.com@evil.com/scizerss/keylight-piano", "https://user@github.com/scizerss/keylight-piano/issues/new?title=a&body=b",
                   "https://github.com:444/scizerss/keylight-piano/issues/new?title=a&body=b", "https://github.com:443/scizerss/keylight-piano/issues/new?title=a&body=b",
                   "https://GITHUB.com/scizerss/keylight-piano", "https://github.com./scizerss/keylight-piano", "https://github.com/scizerss/keylight-piano/",
                   "https://github.com/scizerss/keylight-piano/issues/", n, n + "?", n + "?title=a", n + "?title=a&body=b&labels=x", n + "?title=a&title=b", n + "?title=a&body=b#x",
                   n + "?title=a&body=%2525", n + "?title=a&body=%zz", n + "?title=a&body=b c", n + "?title=a&body=%e9", n + "?title=a&body=<b>", n + "?title=&body=b",
                   n + "?title=a&body=b\\@evil.com", n + "/../../../evil?title=a&body=b", "https://github.com/scizerss/keylight-piano/pulls",
                   "https://github.com/scizerss/keylight-piano/releases/download/x/y.apk", "https://ko-fi.com/scizers/shop", "https://ko-fi.com/other", "javascript:alert(1)",
                   "file:///etc/passwd", "content://x/y", "itms-apps://apps.apple.com/app/id1", " https://ko-fi.com/scizers", "https://ko-fi.com/scizers\n", "https://ko-fi.com/scizers?x=1",
                   n + "?title=a&body=" + String(repeating: "a", count: 2000)]
        for url in bad { XCTAssertFalse(LinkPolicy.allowed(url), url) }
        XCTAssertFalse(LinkPolicy.allowed(nil))
    }
}
