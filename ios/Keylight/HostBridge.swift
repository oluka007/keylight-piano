import CoreAudioKit
import UIKit
import WebKit

/// Receives the page's JSON requests (window.webkit.messageHandlers.keylight), validates them, runs them and answers with
/// globalThis.__keylightNativeReceive(...), the same protocol the Android host speaks.
@MainActor
final class HostBridge: NSObject, WKScriptMessageHandler {
    weak var webView: WKWebView?
    /// Weak: the presenting controller owns the web view, whose configuration owns this bridge; a strong link back would be a cycle.
    private weak var presenter: UIViewController?
    private let tools: HostTools
    private var midi: MidiBridge!
    private var delivering = false
    private var pending: [String] = []

    init(presenter: UIViewController) {
        self.presenter = presenter
        self.tools = HostTools(presenter: presenter)
        super.init()
        midi = MidiBridge(emit: { [weak self] json in DispatchQueue.main.async { MainActor.assumeIsolated { self?.deliver(json) } } })
    }

    static let handlerNames = ["keylight", "keylightLog"]
    private(set) var tornDown = false

    func start() { midi.start() }
    func stop() { midi.stop() }

    /// Ends the bridge for good: the page can no longer reach it, MIDI is released and staged exports are deleted. Safe to call twice.
    func teardown() {
        guard !tornDown else { return }
        tornDown = true
        if let controller = webView?.configuration.userContentController {
            for name in Self.handlerNames { controller.removeScriptMessageHandler(forName: name, contentWorld: .page); controller.removeScriptMessageHandler(forName: name) }
        }
        pending.removeAll()
        midi.stop()
        tools.abortAll()
        webView = nil
    }
    func send(event: [String: Any]) { deliver(MidiBridge.json(event)) }
#if DEBUG
    var testMidi: MidiBridge { midi }
#endif

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        let origin = message.frameInfo.securityOrigin
        guard message.frameInfo.isMainFrame, origin.protocol == PathPolicy.scheme, origin.host == PathPolicy.host else { return }
        guard !tornDown else { return }
        let parsed = BridgeMessage.parse(message.body)
        guard let id = parsed.id else { return }                 // no readable id: nobody to answer
        switch parsed.result {
        case .failure(let error): respond(id, error: error.message)
        case .success(let request): handle(request, id: id)
        }
    }

    private func handle(_ request: BridgeRequest, id: Int) {
        switch request {
        case .list, .open, .close, .send, .clear:
            midi.request(request) { [weak self] result in
                DispatchQueue.main.async { MainActor.assumeIsolated {
                    switch result {
                    case .success(let json): self?.respond(id, resultJSON: json)
                    case .failure(let e): self?.respond(id, error: e.message)
                    }
                } }
            }
        case .clipboard(let text): respond(id, resultJSON: tools.copy(text) ? "true" : "false")
        case .openLink(let url): respond(id, resultJSON: tools.open(link: url) ? "true" : "false")
        case .deviceUsb: respond(id, resultJSON: "null")
        case .blePair: presentPairing(id: id)
        case .exportBegin(let name, let mime, let size):
            do { respond(id, resultJSON: Self.jsonString(try tools.exportBegin(name: name, mime: mime, size: size))) }
            catch let e as BridgeFailure { respond(id, error: e.message) } catch { respond(id, error: "Export failed") }
        case .exportChunk(let token, let data):
            do { try tools.exportChunk(token: token, base64: data); respond(id, resultJSON: "true") }
            catch let e as BridgeFailure { respond(id, error: e.message) } catch { respond(id, error: "Export failed") }
        case .exportFinish(let token):
            do { try tools.exportFinish(token: token); respond(id, resultJSON: "true") }
            catch let e as BridgeFailure { respond(id, error: e.message) } catch { respond(id, error: "Export failed") }
        case .exportAbort(let token): tools.abort(token); respond(id, resultJSON: "true")
        }
    }

    // MARK: Bluetooth pairing (CoreAudioKit)

    private func presentPairing(id: Int) {
        guard let presenter else { respond(id, resultJSON: "false"); return }
        let controller = CABTMIDICentralViewController()
        let nav = UINavigationController(rootViewController: controller)
        controller.navigationItem.rightBarButtonItem = UIBarButtonItem(systemItem: .done, primaryAction: UIAction { [weak nav] _ in nav?.dismiss(animated: true) })
        nav.modalPresentationStyle = .formSheet
        nav.preferredContentSize = CGSize(width: 540, height: 620)
        if presenter.presentedViewController != nil { respond(id, resultJSON: "false"); return }
        presenter.present(nav, animated: true)
        respond(id, resultJSON: "true")      // the new endpoint arrives as a normal "ports" event once paired
    }

    // MARK: delivery to the page

    private func respond(_ id: Int, resultJSON: String) { deliver("{\"id\":\(id),\"result\":\(resultJSON)}") }
    private func respond(_ id: Int, error: String) { deliver("{\"id\":\(id),\"error\":\(Self.jsonString(error))}") }
    static func jsonString(_ s: String) -> String { String(MidiBridge.json([s]).dropFirst().dropLast()) }

    /// One evaluateJavaScript at a time; events that arrive meanwhile are joined so a burst costs one call.
    private func deliver(_ json: String) {
        pending.append(json)
        if pending.count > 512 { pending.removeFirst(pending.count - 512) }
        pump()
    }
    private func pump() {
        guard !tornDown, !delivering, let webView, let url = webView.url, PathPolicy.isMainPage(url), !pending.isEmpty else { return }
        delivering = true
        let batch = pending.prefix(64).joined(separator: ",")
        pending.removeFirst(min(64, pending.count))
        webView.evaluateJavaScript("for (const m of [\(batch)]) globalThis.__keylightNativeReceive?.(m)") { [weak self] _, _ in
            MainActor.assumeIsolated { self?.delivering = false; self?.pump() }
        }
    }
}
