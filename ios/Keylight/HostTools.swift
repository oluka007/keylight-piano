import Foundation
import UIKit

/// Clipboard, allow-listed links and file export (the share sheet). Everything arrives already validated by BridgeMessage;
/// the checks here are the second line (Android's HostTools / ExportStore do the same).
@MainActor
final class HostTools {
    private struct Staging { let name: String, mime: String, size: Int, url: URL, handle: FileHandle; var written: Int }
    private var staging: [String: Staging] = [:]
    private weak var presenter: UIViewController?
    /// How chunk bytes reach the file. The non-throwing FileHandle.write(_:) raises an Objective-C exception when the disk is
    /// full, which Swift cannot catch, so this must be the throwing write(contentsOf:). Replaceable by tests only.
    var writer: (FileHandle, Data) throws -> Void = { try $0.write(contentsOf: $1) }
    var stagedCount: Int { staging.count }
    private let root = FileManager.default.temporaryDirectory.appendingPathComponent("keylight-export", isDirectory: true)

    init(presenter: UIViewController) {
        self.presenter = presenter
        try? FileManager.default.removeItem(at: root)          // anything left from an earlier run
    }

    func copy(_ text: String) -> Bool {
        UIPasteboard.general.string = text
        return true
    }

    func open(link: String, using open: (URL) -> Void = { UIApplication.shared.open($0) }) -> Bool {
        guard LinkPolicy.allowed(link), let url = URL(string: link) else { return false }
        open(url); return true
    }

    func exportBegin(name: String, mime: String, size: Int) throws -> String {
        guard BridgeMessage.validFileName(name), size >= 0, size <= BridgeMessage.maxExport else { throw BridgeFailure("Invalid export") }
        for (token, _) in staging { abort(token) }              // one export at a time
        let token = UUID().uuidString
        let dir = root.appendingPathComponent(token, isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let url = dir.appendingPathComponent(name)
        do {
            guard FileManager.default.createFile(atPath: url.path, contents: nil, attributes: [.protectionKey: FileProtectionType.complete]) else { throw BridgeFailure("Could not stage the file") }
            staging[token] = Staging(name: name, mime: mime, size: size, url: url, handle: try FileHandle(forWritingTo: url), written: 0)
        } catch {
            try? FileManager.default.removeItem(at: dir)
            throw error is BridgeFailure ? error : BridgeFailure("Could not stage the file")
        }
        return token
    }

    func exportChunk(token: String, base64: String) throws {
        guard var item = staging[token] else { throw BridgeFailure("Unknown export") }
        guard let data = Data(base64Encoded: base64), item.written + data.count <= item.size else { abort(token); throw BridgeFailure("Invalid export data") }
        do { try writer(item.handle, data) } catch {
            abort(token)                                          // storage full or the file vanished: end the transfer, nothing stays behind
            throw BridgeFailure("Could not write the file (is the storage full?)")
        }
        item.written += data.count
        staging[token] = item
    }

    /// Drops every staged export (teardown).
    func abortAll() { for token in Array(staging.keys) { abort(token) } }

    func abort(_ token: String) {
        guard let item = staging.removeValue(forKey: token) else { return }
        try? item.handle.close()
        try? FileManager.default.removeItem(at: item.url.deletingLastPathComponent())
    }

    /// Presents the share sheet (Save to Files, AirDrop, …). Answers once it is on screen: it may stay open a long time.
    func exportFinish(token: String) throws {
        guard let item = staging.removeValue(forKey: token) else { throw BridgeFailure("Unknown export") }
        try? item.handle.close()
        guard item.written == item.size, let presenter else {
            try? FileManager.default.removeItem(at: item.url.deletingLastPathComponent()); throw BridgeFailure("Incomplete export")
        }
        let sheet = UIActivityViewController(activityItems: [item.url], applicationActivities: nil)
        sheet.completionWithItemsHandler = { _, _, _, _ in
            try? FileManager.default.removeItem(at: item.url.deletingLastPathComponent())
        }
        HostTools.anchor(sheet, in: presenter)
        (presenter.presentedViewController ?? presenter).present(sheet, animated: true)
    }

    /// iPad popovers need a source; the middle of the page is always valid.
    static func anchor(_ controller: UIViewController, in presenter: UIViewController) {
        guard let popover = controller.popoverPresentationController else { return }
        popover.sourceView = presenter.view
        popover.sourceRect = CGRect(x: presenter.view.bounds.midX, y: presenter.view.bounds.midY, width: 1, height: 1)
        popover.permittedArrowDirections = []
    }
}
