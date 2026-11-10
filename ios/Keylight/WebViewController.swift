import UIKit
import WebKit

/// The whole app: one WKWebView on the bundled renderer, plus the host bridge. No other navigation is possible.
final class WebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    private var webView: WKWebView!
    private var bridge: HostBridge!
    private var audio: AudioSessionManager!
    private var reloads = 0
#if DEBUG
    private var evalTimer: Timer?
#endif

    /// Set before the page loads: tells the renderer it is running inside the iOS host.
    private static let bootstrap = """
    globalThis.__keylightIOS = true;
    globalThis.KeylightNative = Object.freeze({ postMessage(message) { window.webkit.messageHandlers.keylight.postMessage(message) } });
    """
    private static let consoleBridge = """
    (() => { const send = (level, args) => { try { window.webkit.messageHandlers.keylightLog.postMessage(level + ': ' + args.map((a) => (a && a.stack) || (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')) } catch (e) {} }
      for (const level of ['log', 'info', 'warn', 'error']) { const original = console[level].bind(console); console[level] = (...args) => { send(level, args); original(...args) } }
      window.addEventListener('error', (e) => { const t = e.target; if (t && t !== window && (t.src || t.href)) send('resource-error', [t.tagName, t.src || t.href]); else send('uncaught', [e.message, e.filename + ':' + e.lineno]) }, true);
      window.addEventListener('unhandledrejection', (e) => send('rejection', [e.reason])) })();
    """

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.04, green: 0.05, blue: 0.08, alpha: 1)
        bridge = HostBridge(presenter: self)
        audio = AudioSessionManager { [weak self] state in self?.bridge.send(event: ["kind": "audio", "state": state]) }
        audio.start()

        let configuration = WKWebViewConfiguration()
        configuration.setURLSchemeHandler(AppSchemeHandler(root: AppSchemeHandler.bundledRoot), forURLScheme: PathPolicy.scheme)
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.allowsInlineMediaPlayback = true
        configuration.allowsAirPlayForMediaPlayback = false
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
        configuration.preferences.isFraudulentWebsiteWarningEnabled = false
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.defaultWebpagePreferences.preferredContentMode = .mobile
        configuration.websiteDataStore = .default()
        let content = configuration.userContentController
        content.addUserScript(WKUserScript(source: Self.bootstrap, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        content.add(bridge, contentWorld: .page, name: "keylight")
#if DEBUG
        content.addUserScript(WKUserScript(source: Self.consoleBridge, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        content.add(LogHandler(), contentWorld: .page, name: "keylightLog")
        if UserDefaults.standard.bool(forKey: "KeylightMuted") {   // simulator checks: nothing reaches the Mac's speakers
            content.addUserScript(WKUserScript(source: "const connect = AudioNode.prototype.connect; AudioNode.prototype.connect = function (target, ...rest) { return target instanceof AudioDestinationNode ? target : connect.call(this, target, ...rest) }", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
#endif

        webView = WKWebView(frame: view.bounds, configuration: configuration)
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.minimumZoomScale = 1; webView.scrollView.maximumZoomScale = 1
        webView.scrollView.pinchGestureRecognizer?.isEnabled = false
        webView.allowsLinkPreview = false
        webView.allowsBackForwardNavigationGestures = false
        webView.isOpaque = false
        webView.backgroundColor = view.backgroundColor
        webView.scrollView.backgroundColor = view.backgroundColor
#if DEBUG
        if #available(iOS 16.4, *) { webView.isInspectable = true }
#endif
        view.addSubview(webView)
        bridge.webView = webView
        bridge.start()
        load()
    }

    private func load() {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0"
        var query = "appVersion=" + version.addingPercentEncoding(withAllowedCharacters: .alphanumerics.union(CharacterSet(charactersIn: ".-")))!
#if DEBUG
        if let extra = UserDefaults.standard.string(forKey: "KeylightQuery"), extra.range(of: "^[A-Za-z0-9=&._-]{1,200}$", options: .regularExpression) != nil { query += "&" + extra }
#endif
        webView.load(URLRequest(url: URL(string: "\(PathPolicy.scheme)://\(PathPolicy.host)\(PathPolicy.mainPath)?\(query)")!))
    }

#if DEBUG
    /// Simulator QA only: iPadOS windowing refuses programmatic rotation, so -KeylightEmulateLandscape 1 lays the page out in a
    /// landscape-sized viewport (the web view is rotated a quarter turn; rotate the screenshot back to read it).
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        let narrow = CGFloat(UserDefaults.standard.integer(forKey: "KeylightEmulateWidth"))   // Split View / Slide Over widths, e.g. 507 or 694
        if narrow >= 320, narrow < view.bounds.width {
            webView.autoresizingMask = []
            webView.frame = CGRect(x: 0, y: 0, width: narrow, height: view.bounds.height)
            return
        }
        guard UserDefaults.standard.bool(forKey: "KeylightEmulateLandscape"), view.bounds.height > view.bounds.width else { return }
        let b = view.bounds
        webView.autoresizingMask = []
        webView.transform = .identity
        webView.frame = CGRect(x: (b.width - b.height) / 2, y: (b.height - b.width) / 2, width: b.height, height: b.width)
        webView.transform = CGAffineTransform(rotationAngle: -.pi / 2)
    }
#endif

    override var prefersHomeIndicatorAutoHidden: Bool { false }
    override var prefersStatusBarHidden: Bool { false }

    // MARK: navigation: the app page only; allow-listed links leave for the browser

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping @MainActor (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { return decisionHandler(.cancel) }
        if action.targetFrame?.isMainFrame ?? true {
            if PathPolicy.isMainPage(url) { return decisionHandler(.allow) }
            if action.navigationType == .linkActivated, LinkPolicy.allowed(url.absoluteString) { UIApplication.shared.open(url) }
            return decisionHandler(.cancel)
        }
        decisionHandler(url.absoluteString == "about:blank" ? .allow : .cancel)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url, LinkPolicy.allowed(url.absoluteString) { UIApplication.shared.open(url) }
        return nil
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        reloads += 1
        if reloads <= 3 { load() }
    }

    // MARK: JavaScript dialogs (alert / confirm / prompt) and the camera

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping @MainActor () -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping @MainActor (Bool) -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping @MainActor (String?) -> Void) {
        let alert = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        alert.addTextField { $0.text = defaultText }
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(nil) })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { [weak alert] _ in completionHandler(alert?.textFields?.first?.text) })
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping @MainActor (WKPermissionDecision) -> Void) {
        decisionHandler(origin.protocol == PathPolicy.scheme && origin.host == PathPolicy.host && type == .camera ? .prompt : .deny)
    }

#if DEBUG
    /// DEBUG only: -KeylightTestSource 1 makes a virtual MIDI source and plays a few notes through it.
    func startTestNotes() {
        guard UserDefaults.standard.bool(forKey: "KeylightTestSource") else { return }
        bridge.testMidi.startTestSource()
        let notes: [UInt8] = [60, 64, 67, 72]
        for (n, note) in notes.enumerated() {
            DispatchQueue.main.asyncAfter(deadline: .now() + 6 + Double(n) * 0.5) { self.bridge.testMidi.testNote(note, velocity: 100, on: true) }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 9) { for note in notes { self.bridge.testMidi.testNote(note, velocity: 0, on: false) } }
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { startTestNotes(); startEvalPoller() }

    /// DEBUG only (simulator QA): a script dropped at <app tmp>/keylight-eval.js runs in the page once, its result lands in keylight-eval.out.
    private func startEvalPoller() {
        guard evalTimer == nil else { return }
        let dir = FileManager.default.temporaryDirectory
        let input = dir.appendingPathComponent("keylight-eval.js"), output = dir.appendingPathComponent("keylight-eval.out")
        evalTimer = Timer.scheduledTimer(withTimeInterval: 0.4, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated {
                if let self, let want = try? String(contentsOf: dir.appendingPathComponent("keylight-rotate.txt"), encoding: .utf8) {     // simulator QA: rotate
                    try? FileManager.default.removeItem(at: dir.appendingPathComponent("keylight-rotate.txt"))
                    let mask: UIInterfaceOrientationMask = want.hasPrefix("land") ? .landscapeRight : .portrait
                    self.view.window?.windowScene?.requestGeometryUpdate(.iOS(interfaceOrientations: mask)) { NSLog("[rotate] \($0)") }
                }
                guard let self, let source = try? String(contentsOf: input, encoding: .utf8) else { return }
                try? FileManager.default.removeItem(at: input)
                self.webView.callAsyncJavaScript(source, arguments: [:], in: nil, in: .page) { result in
                    switch result {
                    case .success(let value): try? String(describing: value ?? "nil").write(to: output, atomically: true, encoding: .utf8)
                    case .failure(let error): try? "ERROR \(error)".write(to: output, atomically: true, encoding: .utf8)
                    }
                }
            }
        }
    }
#endif

    /// Releases everything the page could still reach: handlers, MIDI, audio, staged exports. Runs from the scene's disconnect and from deinit.
    func teardown() {
#if DEBUG
        evalTimer?.invalidate(); evalTimer = nil
#endif
        bridge?.teardown()
        audio?.stop()
        webView?.stopLoading()
    }
    var bridgeForTests: AnyObject? { bridge }
    var isTornDown: Bool { bridge?.tornDown ?? true }

    deinit { MainActor.assumeIsolated { teardown() } }
}

#if DEBUG
final class LogHandler: NSObject, WKScriptMessageHandler {
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        if let text = message.body as? String { NSLog("[page] %@", String(text.prefix(2000))) }
    }
}
#endif
