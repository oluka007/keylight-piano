# Keylight for iPad and iPhone (prototype I1, hardened in I2)

A native UIKit app (`ios/`) that runs the same renderer as the desktop and Android apps inside one `WKWebView`. iOS WebKit has no Web MIDI, so the Swift host does the MIDI with CoreMIDI and the page talks to it through the same JSON protocol the Android host speaks (`renderer/android-midi.js`; `renderer/ios-midi.js` re-exports it).

## Architecture

- `ios/project.yml` (XcodeGen) generates `Keylight.xcodeproj`; nothing is hand-written. Bundle id `org.keylight.piano.ios`, iOS 16+, iPhone and iPad, Swift 6, no third-party code.
- A build phase (`ios/scripts/bundle-renderer.sh`) copies `renderer/` (without `*.cjs`), LICENSE, THIRD_PARTY_NOTICES.md and LICENSES into `Keylight.app/web` and adds `<script type="module" src="ios-host.js">` to the bundled `index.html` (as the Android bundleRenderer task does for `host-bootstrap.js`).
- `SchemeHandler.swift` serves the page at `keylight-app://app/renderer/index.html` with MIME types (ES modules, wasm, mid, fonts), Range support and a strict CSP. `PathPolicy.swift` resolves every request inside the bundle only (encoded, double-encoded and symlink traversal, hidden files, other origins are refused). No `file://`, no network.
- `WebViewController.swift`: navigation is limited to the app page; links open in the browser only if `LinkPolicy.swift` (a port of LinkPolicy.java and `host-policy.js`) allows them; alert/confirm/prompt are implemented; web inspector is DEBUG-only.
- `BridgeMessage.swift` validates every message from the page (size, types, port id format, file names, MIME, link allow-list). `HostBridge.swift` runs requests and answers through `globalThis.__keylightNativeReceive`, one `evaluateJavaScript` at a time.
- `MidiBridge.swift`: CoreMIDI client with hot-plug notifications, endpoint list (ids are hashes of the unique id, never the raw id), input port (MIDI 1.0 UMP converted to bytes by `UMP.swift`), per-port `MidiBuffer.swift` (port of MidiBuffer.java: whole messages only, running status expanded, 4096 messages / 256 KB, SysEx cap 64 KB, drops counted and reported at most once a second), delivery at most every 16 ms and 4 KB per port and batch, output with `MIDISend` (SysEx chunked to 256 bytes, timestamps from the page's delay).
- `HostTools.swift`: clipboard (UIPasteboard), allow-listed links, and exports (blob downloads for backups, takes, device reports) staged in a temp file and shown in the share sheet (Save to Files, AirDrop). 256 MiB limit.
- Bluetooth: the Settings row and the "no keyboard found" hint get a "Pair Bluetooth keyboard..." button (`renderer/ios-ble.js`) that sends `blePair`; the host presents CoreAudioKit's `CABTMIDICentralViewController` as a form sheet. A paired keyboard appears as a normal MIDI port.
- `AudioSession.swift`: `.playback` category (sound with the silent switch on), 5 ms preferred IO buffer, no mixWithOthers; on interruption end, route change, media reset and app activation the page is told to resume its AudioContext (`ios-host.js`).
- Page side: `IS_IOS` / `IS_NATIVE_HOST` in `platform.js`; the Android hiding rules (Airwave, light-service steps, online lookup, shortcuts overlay until a hardware key is pressed) apply. The page also gets the `android` class because `touch.css` keys its phone/tablet rules on it, plus `ios`.
- Hardening (I2): `HostTools` writes exports with the throwing `write(contentsOf:)` (a full disk aborts the transfer and answers the page with an error instead of raising an Objective-C exception); `MidiBridge.words(inEventList:)` reads packets of any declared length, bounded by the buffer; `HostBridge` holds its presenter weakly and `teardown()` (called from `sceneDidDisconnect` and `deinit`) removes the script handlers, stops MIDI and audio and deletes staged exports; outgoing MIDI has admission limits (64 requests / 128 KB waiting, then a token bucket of 1024 messages and 64 KB with 2048 messages and 128 KB per second refill) and answers "busy" instead of queueing; a failed `MIDIPortConnectSource`, `MIDISend` or `MIDIFlushOutput` is an error to the page and an input counts as open only after CoreMIDI accepted it; the audio session re-applies category, mode, options and the 5 ms buffer after a media-services reset.
- Privacy manifest: only the system-boot-time category is declared (`35F9.1` elapsed time and timers, `8FFB.1` event timestamps: `mach_absolute_time` for batching and CoreMIDI timestamps). `scripts/package-ios.sh` compares the Release binary's imported symbols with the manifest and fails if a required-reason API is used but not declared.
- Covers: the illustrated covers are ordinary PNGs under `renderer/covers/`, copied by the build phase and served as `image/png` (`AssetServingTests`, and `scripts/test-ios-midi.js` checks the copy). The page asks for a cover once more after a failed load before it falls back to the generated art (`retriedCovers` in `app.js`).
- Touch games: the note games (Find the Key, Read the Treble/Bass) show a one-octave on-screen keyboard on touch screens (they had none, so they could not be played without a MIDI keyboard).
- DEBUG builds only: launch arguments `-KeylightQuery "screen=course"`, `-KeylightMuted 1` (drops audio output), `-KeylightTestSource 1` (virtual MIDI source plays C-E-G-C; in the simulator, where CoreMIDI has no server, a stand-in endpoint feeds the same buffers), and console output in the unified log (`[page]`, including failed image/script loads). QA hooks: a script dropped at `<app container>/tmp/keylight-eval.js` runs in the page (result in `keylight-eval.out`), `keylight-rotate.txt` rotates iPhones (iPadOS windowing refuses programmatic rotation, so `-KeylightEmulateLandscape 1` lays an iPad out in a landscape-sized viewport and `-KeylightEmulateWidth 507` in a Slide Over / Split View width).

## Build and test

```
brew install xcodegen          # once
scripts/package-ios.sh         # node tests, project, simulator build, unsigned device build, Swift tests
```

Swift tests only: `cd ios && KEYLIGHT_VERSION=0.3.0 KEYLIGHT_BUILD=1 xcodegen generate && xcodebuild test -scheme Keylight -destination 'platform=iOS Simulator,name=iPad Pro 13-inch (M5)'`. Node: `node scripts/test-ios-midi.js` (part of `npm test`).

Simulator run: `xcodebuild build ... -derivedDataPath D`, then `xcrun simctl install booted D/Build/Products/Debug-iphonesimulator/Keylight.app` and `xcrun simctl launch booted org.keylight.piano.ios`. Shut down with `xcrun simctl shutdown all`.

## Installing on your own iPhone or iPad (free Apple ID)

1. Xcode > Settings > Accounts > add your Apple ID.
2. Open `ios/Keylight.xcodeproj` (run `xcodegen generate` first, with `KEYLIGHT_VERSION` and `KEYLIGHT_BUILD` set as in `package-ios.sh`). Select the Keylight target > Signing & Capabilities > Team: your Personal Team. If the bundle id is taken, change it to something unique.
3. Plug the device in and unlock it; choose it as the run destination.
4. On the device: Settings > Privacy & Security > Developer Mode > on (it restarts). Press Run in Xcode.
5. First launch: Settings > General > VPN & Device Management > your Apple ID > Trust.
6. A free Apple ID signature expires after 7 days; run again from Xcode (or use AltStore/SideStore with the unsigned ipa from `.github/workflows/ios.yml`, a draft that has not been run) to renew. At most 3 apps with a free ID.

## Real-device checklist (not verifiable in the simulator)

USB (Apple Camera Adapter or a USB-C iPad): plug the keyboard in; it appears within a second; notes play and light the on-screen keys; unplug and replug (hot-plug); two keyboards; sustain pedal; SysEx identity reply in "Support my device".
Bluetooth: Settings > Pair Bluetooth keyboard; the system sheet lists the keyboard; pairing works; after pairing the keyboard is a MIDI port; switch it off and on (reconnect); notes keep playing with the screen locked briefly and on return.
Audio: sound with the silent switch on; latency feels fine; phone call or Siri interrupts and sound returns afterwards; plugging in headphones.
Other: backup export opens the share sheet and saves to Files; copy device report; rotate iPad and iPhone; Stage Manager / split view resize; keyboard shortcuts overlay appears after pressing a hardware key.

## Known limits

- CoreMIDI does not run in the iOS simulator (no MIDI server), so the CoreMIDI code is compiled and unit-tested (UMP conversion, buffer, validation) but only the page-side delivery was exercised in the simulator.
- The page is served from a custom scheme, which WebKit treats as an insecure context: `navigator.mediaDevices` is missing, so camera finger tracking is unavailable (a stub keeps the page working), as are `navigator.clipboard` (the host copies instead) and service workers.
- No key lights (no light service on iOS): note lights only. USB descriptors are not readable on iOS; "Support my device" uses the MIDI ports and identity reply.
- App Store preparation: see `docs/APP-STORE.md` (listing text, review notes, privacy answers) and `ios/store/screenshots/`. Nothing is submitted.
- Simulator QA covered iPad Pro 13 and 11, iPad mini, iPhone 17 Pro, 17 Pro Max and 17e (portrait; landscape on iPhone by real rotation, on iPad by an emulated landscape-sized viewport). Touch input was driven with synthetic pointer events (several `pointerId`s at once for chords): they exercise the page's multi-touch code, but not real fingers or the iPadOS touch pipeline, which still need a device. Real Slide Over / Stage Manager windows cannot be driven headless; only the narrow widths were emulated.
