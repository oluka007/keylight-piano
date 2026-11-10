import AVFoundation
import UIKit
import Foundation

/// Playback category (sound plays with the silent switch on), a short IO buffer for low latency, and a nudge to the page
/// (so it can resume its AudioContext) after an interruption, a route change or the app coming back.
@MainActor
final class AudioSessionManager {
    private let notify: (String) -> Void
    private var observers: [NSObjectProtocol] = []

    init(notify: @escaping (String) -> Void) { self.notify = notify }

    static let category = AVAudioSession.Category.playback
    static let mode = AVAudioSession.Mode.default
    static let options: AVAudioSession.CategoryOptions = []                  // no mixWithOthers
    static let bufferDuration = 0.005

    /// Everything the session needs, applied again after a media-services reset (which returns it to defaults).
    @discardableResult
    func configure() -> Bool {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(Self.category, mode: Self.mode, options: Self.options)
            try session.setPreferredIOBufferDuration(Self.bufferDuration)
            try session.setActive(true)
            return true
        } catch { NSLog("Keylight audio session: \(error)"); return false }
    }

    func start() {
        guard observers.isEmpty else { return }
        configure()
        let center = NotificationCenter.default
        observers.append(center.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] note in
            let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt
            let type = raw.flatMap(AVAudioSession.InterruptionType.init(rawValue:))
            MainActor.assumeIsolated {
                if type == .ended { self?.reactivate(); self?.notify("resume") } else { self?.notify("interrupted") }
            }
        })
        observers.append(center.addObserver(forName: AVAudioSession.routeChangeNotification, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.notify("resume") }
        })
        observers.append(center.addObserver(forName: AVAudioSession.mediaServicesWereResetNotification, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.configure(); self?.notify("resume") }      // reset: category, mode, options and buffer too
        })
        observers.append(center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.reactivate(); self?.notify("resume") }
        })
    }

    private func reactivate() { try? AVAudioSession.sharedInstance().setActive(true) }

    /// Stops listening and gives the session back.
    func stop() {
        for observer in observers { NotificationCenter.default.removeObserver(observer) }
        observers = []
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}
