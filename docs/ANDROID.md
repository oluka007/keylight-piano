# Keylight Android development host

This is a Java Android application hosting the real bundled Keylight renderer. Native
`MidiManager` provides USB MIDI; Android WebView's browser MIDI implementation is
not used. Application ID: `org.keylight.piano`. The APK is development signed and
debuggable, intended for sideloading and hardware validation.

## Build

On this macOS workstation:

```sh
bash scripts/package-android.sh
```

The script downloads Gradle **8.13**, verifies its pinned official SHA-256, and uses
AGP **8.13.2**, AndroidX WebKit **1.14.0**, Java **17**, compile SDK **36.1**, target
SDK **36**, and Build Tools **36.1.0**. It runs the bridge tests, assembles the APK,
runs Android lint, verifies the APK signature and ZIP alignment, then prints its
SHA-256. SDK defaults to `~/Library/Android/sdk`; `ANDROID_HOME` and `JAVA_HOME`
can select other installed SDK/JDK locations. First build needs Gradle/Google Maven/
Maven Central network access. There is no Gradle installation prerequisite.

Output: `dist/Keylight-<package version>-android.apk`.

The stable signing key and random password are stored with private file permissions
at `~/Library/Caches/keylight/android/development.jks` and `signing-password`.
Back up those two files outside the repository. Keep them across builds to install
updates without removing the app or its progress. Losing the key prevents updating
an existing installation with this identity; restore the key rather than uninstalling
or clearing user data. No keystore or password is bundled into the APK or source.
Version name follows `package.json`; the integer version code is major * 10000 + minor * 100 + patch.

Every build synchronizes the **current** `renderer/` plus local models, WASM,
vendor libraries, songs, fonts, licence notices and host bootstrap into generated
Android assets. It modifies only the generated `index.html` to load the bootstrap
before the app's module. It never rewrites the shared renderer source. Parent edits
made after a build are absent from that APK: rebuild to include them.

## Runtime requirements and boundaries

The installation floor is Android **8.0 / API 26**. Use a maintained tablet with a
current Android System WebView; this is a separate requirement from minSdk. Modern
JavaScript modules, Web Audio, WebGL/WASM, Blob.arrayBuffer, IndexedDB, and the
AndroidX `WEB_MESSAGE_LISTENER` feature are required. The host displays an update
message if that bridge feature is missing. No older WebView/Android release has
been runtime validated. OS versions no longer receiving WebView updates are outside
the supported deployment recommendation.

USB host/OTG and Android's MIDI feature are required for MIDI. The tablet must
power the keyboard, or use a suitable powered USB hub. Native ports are exclusively
**USB MIDI 1.0 byte streams**. API 33+ explicitly uses
`TRANSPORT_MIDI_BYTE_STREAM`; older systems use the legacy byte-stream APIs with
`TYPE_USB` and `TYPE_BLUETOOTH` filtering (see Bluetooth keyboards below). UMP-only
MIDI 2.0, virtual MIDI, blocksd, battery telemetry and proprietary RGB/button
protocols are outside this host's support.

The adapter exports `requestMIDIAccess()` from `renderer/android-midi.js`. It
resolves actual enumerated input/output Maps, including an empty Map when no USB
devices are connected; missing native MIDI/USB host features reject. It supplies
`state`, `connection`, `open()`, `close()`, output `send(bytes, timestamp)`, input
`onmidimessage`, and access/port state-change events. It is the subset consumed by
Keylight, not a complete Web MIDI specification implementation. SysEx is enabled
for this trusted application. USB connection IDs are session identities, not
persistent hardware serial numbers.

Each input parser reconstructs fragmented channel messages, running status, system
common and SysEx, with interleaved real-time bytes emitted separately. SysEx has a
64 KiB ceiling. Parsers reset on close/disconnection. Native receiver buffers are
copied before returning from Android callbacks. A single native Handler serializes
device opens, port ownership, writes and cleanup; pending opens drain in submission
order per device. Output accepts up to 64 KiB per call and timestamps at most
60 seconds ahead, converted from performance-clock delay to native monotonic
nanoseconds. An I/O failure closes that device's ports and removes it from the maps
until reconnect. The adapter reports asynchronous send failures through `onerror`,
an error event and the renderer console. No promise of physical latency is made.

Hotplug, backgrounding and destruction close native ports/devices. On return the
current devices are republished as fresh ports. `bindMidiPorts()` already releases
held notes and sustain when its selected input disappears. Closing an input stops
delivery; assigning its `onmidimessage` opens it implicitly. Output sends also open
implicitly. Device open/port busy failures reject instead of fabricating a device.

## Bluetooth keyboards (BLE MIDI)

`BleMidi.java` scans with `BluetoothLeScanner` filtered on the BLE MIDI service
(`03B80E5A-EDE8-4B33-A751-6CE34EC4C700`), also lists paired keyboards that advertise it and
keyboards another app already holds open, and connects with
`MidiManager.openBluetoothDevice`. The opened device is handed to `MidiTransport.adopt`, so
its ports reach JS exactly like USB ones (`transport: "ble"`, same ids, hot-plug, SysEx).
USB host is no longer required for MIDI: a tablet with BLE only still gets a manager.

Bridge ops (all validated natively; addresses must match uppercase `AA:BB:CC:DD:EE:FF`):
`bleSupported`, `bleState`, `blePermission`, `bleEnable`, `bleOpenSettings`, `bleScanStart`,
`bleScanStop`, `bleConnect {address, auto}`, `bleDisconnect`. They return at once; results are
events `bleState`, `bleDevice`, `bleScanEnd {reason}`, `bleError {code, auto}`. Limits: 4 scan
starts and 6 connects per 30 s (Android silently ignores the 6th scan start), 40 ble requests
per 10 s, 64 devices per scan. Scan stops after 15 s, on pause and when the page closes; a
connect gives up after 20 s. Backgrounding closes the link with the MIDI ports (same as USB);
the page reconnects when it is visible again.

Permissions: API 31+ `BLUETOOTH_SCAN` (`neverForLocation`) and `BLUETOOTH_CONNECT`; API 26-30
`BLUETOOTH`, `BLUETOOTH_ADMIN` and `ACCESS_FINE_LOCATION` (with Location switched on) for
scanning. `android.hardware.bluetooth_le` is optional. The dialog (`renderer/android-ble.js`,
opened from Settings > Instruments > Bluetooth keyboard or the "no keyboard found" hint)
walks through unsupported, Bluetooth off (system enable prompt), permission, blocked (opens
app settings), Location off, scanning, connecting, connected, failed. The last connected
address is kept in `localStorage` (`keylight.ble.last`); at start and when the page becomes
visible Keylight tries `bleConnect {auto: true}` at most 3 times, only if Bluetooth is on and
permission is already granted. It never shows a prompt. "Forget" clears it.

Emulator note: the API 35 emulator reports a virtual BLE adapter, so the dialog, permission
prompt, Bluetooth-off state and a real (empty) scan run there, but no keyboard can be found
or connected. Connecting, MIDI data, hot-plug and reconnect need a real phone.

Real phone checklist:

1. `bash scripts/package-android.sh`, then `adb install -r dist/Keylight-<ver>-android.apk`.
2. `adb logcat -c; adb logcat | grep -iE "keylight|BleMidi|chromium.*(MIDI|Bluetooth)"`.
3. Switch the keyboard on in Bluetooth pairing mode. Do not pair it in Android Settings first
   (either works: paired keyboards are listed too).
4. Settings > Instruments > Bluetooth keyboard > Connect. Allow Nearby devices. Expect the
   keyboard with a signal strength within 15 s; tap Connect; expect "Keyboard connected over
   Bluetooth" and the chip turning green.
5. Play keys: notes sound and note lights follow; sustain pedal and SysEx (setup/lights) work.
6. Deny the permission twice: expect the "blocked" step with Open settings. Turn Bluetooth off
   in quick settings while the dialog is open: expect "Bluetooth is turned off". On API 26-30
   also switch Location off.
7. Switch the keyboard off: expect the disconnected notice and no stuck notes; switch it on:
   the app reconnects without a prompt.
8. Leave the app and return: playback pauses, the link reconnects on return.
9. Force-stop and relaunch: reconnects to the remembered keyboard. Forget: no reconnect.
10. A phone without BLE: the row is hidden and nothing else changes.

## Trust and local storage

The stable origin is
`https://appassets.androidplatform.net/assets/renderer/index.html?appVersion=<build version>`, served by
AndroidX `WebViewAssetLoader`. This keeps localStorage/IndexedDB scoped consistently
across updates. There is no localhost server, file URL, universal file access or
Electron runtime. No user data is cleared during packaging.

The native message listener is installed only for that HTTPS origin and checks
both **main frame** and the exact bundled document URL on every call. There is no
`addJavascriptInterface`. Frames, objects, forms, remote navigation and remote
executable resources are blocked by CSP and request interception. Missing assets
fail locally rather than falling through to the network. Local JS/WASM has the
evaluation permission needed by the bundled ML runtimes; inline and remote script
elements remain blocked. File imports remain data, not navigable documents.

All remote subresources are blocked in this development host, including optional
online cover/lyrics lookup. Local ML models are bundled. User-initiated HTTP(S)
links open the external browser; non-web schemes and gestureless remote navigation
are refused. Allowing metadata network requests in the future must preserve the
local-only executable and bridge boundary.

## File import, camera and export

HTML file inputs invoke Android's `ACTION_OPEN_DOCUMENT` picker with multiple-file
support and return content URIs through WebView's file callback. MIDI, MusicXML,
audio, backing tracks and JSON therefore use the renderer's existing file readers.
There is no broad storage permission and no filesystem path bridge.

Camera access uses `getUserMedia` and native CAMERA permission, requested only after
a recent real touch/key action (30-second window) and a request from the trusted
origin for video alone. Permission is never requested at launch. Audio capture,
geolocation and unrelated permission resources are denied. The bundled MediaPipe
model/WASM is used; GPU compatibility and camera orientation still need tablet
validation. Start hand tracking through Settings; retry that action if model loading
takes longer than the user-action window. On API 30+ the app draws edge to edge and
`MainActivity` applies the union of system-bar, display-cutout and keyboard (IME) insets to
a parent `FrameLayout` that contains the WebView. The WebView is then measured smaller, which
is what shrinks the CSS viewport; WebView padding does not. API 26-29 keep `adjustResize`.
Tablet CSS remains parent-owned.

Blob downloads are handled explicitly, including the recorder's programmatic
`anchor.click()` followed by URL revocation. `android/host-bootstrap.js` captures
the Blob reference and serializes exports. Each export declares a size (maximum
**256 MiB**), transfers acknowledged **32 KiB** base64 chunks to a private cache
file, verifies the exact received byte count, and queues `ACTION_CREATE_DOCUMENT`.
Native limits also cap chunk size, filename/MIME format and four outstanding
exports. There is no giant base64 Blob or arbitrary output-path API.

Choose a location for each MP4/WebM and JSON sidecar. Android's file provider gets
a streamed copy; success/failure is shown as a native toast. Cancelling the picker
discards that staged file. Exceptions during handoff abort the temporary transfer.
Staged exports survive the system recreating the Activity (for example with
"Don't keep activities" while the save picker is open): `MainActivity` saves the
pending list (file name in the cache folder, display name, MIME type, size) in
`onSaveInstanceState`, the new `ExportStore` restores it and still writes the picker's
result. Closing the app for real (back out) deletes the staging files, and every start
deletes staging files that no restored export owns. The save destination is chosen
by the user, not a fixed Movies directory. Long recordings can exceed 256 MiB;
record shorter takes. Codec and captureStream support depend on the installed
WebView. No camera or microphone permission is needed for synthetic app audio.

## Shared integration

The shared renderer now detects Android, requests the native MIDI adapter explicitly,
uses MIDI key lights, skips blocksd, disables unavailable online metadata lookup, and
uses tablet/save-document wording. The build bootstrap also installs the adapter for
browser-shaped consumers. Native output `clear()` flushes scheduled sends. On backgrounding,
playback pauses and notes/pedal are released; native outputs send standard all-notes-off
before closing. The following describes those integration points for maintainers.

1. In `renderer/platform.js`, add Android detection and tablet/save wording. Keep
   platform identity separate from MIDI availability:

   ```js
   export const IS_ANDROID = /Android/i.test(navigator.userAgent)
   export const IS_WIN = !IS_ANDROID && (forced ? forced === 'win' : /^win/i.test(reported))
   export const THIS_COMPUTER = IS_ANDROID ? 'this tablet' : IS_WIN ? 'this computer' : 'this Mac'
   export const TAKES_FOLDER = IS_ANDROID ? 'a location you choose' : IS_WIN ? 'Videos › Keylight' : 'Movies › Keylight'
   ```

2. In `renderer/app.js`, import `IS_ANDROID` alongside the existing platform
   exports and import the native adapter:

   ```js
   import { requestMIDIAccess as requestAndroidMIDIAccess } from './android-midi.js'
   ```

   In `initMidi()`, replace its access acquisition with:

   ```js
   midi = await (IS_ANDROID
     ? requestAndroidMIDIAccess({ sysex: true })
     : navigator.requestMIDIAccess({ sysex: true }))
   ```

   Keep `midi.onstatechange = () => bindMidiPorts()` and the initial
   `bindMidiPorts()` call. This is actual native enumeration, with no availability
   flag. The adapter's singleton is shared with the bootstrap.

3. At the existing startup `if (!q.has('nokb'))`, use:

   ```js
   if (!q.has('nokb')) { if (!IS_ANDROID) initDaemon(); initMidi() }
   ```

   Also add `if (IS_ANDROID) return` at the start of `initDaemon()` so another
   caller cannot start its retrying WebSocket. Extend `noteLightsOnly()` with
   `IS_WIN || IS_ANDROID || ...`. Apply the existing note-light settings UI on
   Android (`if (IS_WIN || IS_ANDROID) applyWindowsPage()`), then set an
   `android` document class for parent CSS. Change the Windows-only key-finding
   guard to `(IS_WIN || IS_ANDROID) && !(daemon && daemon.ready)`, with tablet
   wording that directs users to manual end-key calibration. Replace the
   `!IS_WIN` daemon settling/octave branches with `!(IS_WIN || IS_ANDROID)`.
   Report Android in the platform field used by help/diagnostics. Keep the
   keyboard-name safety checks that prevent lighting unrelated MIDI instruments.

4. In shared `index.html`, add:

   ```html
   <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
   ```

   In parent-owned CSS, use `.android` for tablet layout, at least 48 CSS px touch
   controls, scrollable settings/import dialogs, wrapping toolbars and no
   hover-only actions. Validate landscape/portrait and system insets. Do not add a
   second bootstrap script to the shared HTML; the Android bundling task owns it.
   The existing `.win` class set by `applyWindowsPage()` can continue to select
   shared note-light UI until the parent generalizes its name.

5. Preserve `recorder.js` Blob downloads; the host already hands them off. Use
   the Android `TAKES_FOLDER` wording above and explain the two save dialogs. For
   a future direct export call, import `exportBlob` from `host-bootstrap.js` only
   on Android; that file exists in generated Android assets. Rebuild the APK
   after all parent edits. Run the unchanged main tests separately in the parent.

## Verification ledger

The first part of this ledger is the original agent's record from before any emulator run:
Apple Silicon macOS; no emulator, installed Android app, adb device enumeration, physical
USB keyboard or user device was used. It is kept as history. Later emulator validation is
recorded in `docs/QA-0.3.0.md` (API 35 ARM64 tablet, WebView 124: install, first run, song,
editor with the on-screen keyboard after the inset fix, rotation, scrolling and saving).
The hardware limits below still apply to physical devices.

`node scripts/test-android-midi.js` passed stream reconstruction, native wire
delivery, ordered output calls, close, disconnection/reconnection and absent-host
rejection. It also passed multi-chunk Blob byte delivery, MIME normalization,
programmatic download after URL revocation, and the export size limit. These are
JavaScript adapter/protocol tests with an in-memory native wire endpoint, not
Android device or driver tests.

The first build compiled and assembled the Java host, then lint rejected API-level
guards around system insets. Those guards were corrected before the final build.
Mutation checks intentionally removed real-time delivery and dropped a byte from
each export chunk. The tests rejected both mutations (missing 0xF8; 69,998 bytes
instead of 70,001). Both production implementations were restored before packaging.
JavaScript/Java language-server diagnostics could not run: TypeScript LSP and jdtls
are absent. Java compilation and Android lint provide the native static checks;
the standalone Node suite exercises the JavaScript bridge. Main/shared tests are
unchanged and left to the parent.

Architecture review: each native file owns host lifecycle, local content policy,
WebView permission callbacks, MIDI transport, or export staging. Bridge input is
parsed and bounded at the native boundary. There are no JavaScript type escapes,
test-only production exports, speculative fallback services or new logging
frameworks. Native API override signatures follow Android's required parameters.
Source files are below 200 nonblank/noncomment lines.

Original command on 2026-11-06: `bash scripts/package-android.sh`; the current APK was rebuilt on 2026-11-07 with `npm run package:android` (compile, lint, v2 signature and 16 KiB alignment pass).
`assembleDebug` and `lintDebug` completed successfully in 14 seconds. Both MIDI
and export suites passed in that packaging run. Lint reported **0 errors and 3
unsuppressed warnings**: the deliberately pinned WebKit dependency has a newer
release, JavaScript is enabled because it executes the bundled renderer under
the content policy above, and lint asks for an older-Android `fullBackupContent`
attribute although `allowBackup=false` already disables backup there. Modern
Android extraction exclusions are supplied separately. Javac notes use of legacy
Android lifecycle/file-access configuration APIs, and AGP reports Gradle 9
deprecations; the build intentionally uses compatible Gradle 8.13.

`apksigner verify --verbose --print-certs` verified one RSA-3072 signer using APK
Signature Scheme v2 (supported by all API 26+ targets).
`zipalign -c -P 16 4` passed.

```text
APK: dist/Keylight-0.3.0-android.apk
APK SHA-256:
73923b5e54e09b1d7d1ac7f3ae27cacf979d3bf172f312bda893a7bc0c9cd203
Signing certificate SHA-256:
4c23b598be2d1ea59e208861dd7ea809a06daad3f8427acdb1ccece297836e46
```

This proves packaging, Java compilation, static Android checks, JavaScript bridge
behavior and signing. An emulator additionally exercised installation and the editor
layout (see QA-0.3.0). Physical hardware, USB and file-provider delivery remain unverified
until the hardware checks below. The APK
contains the renderer snapshot at build time; the platform/CSS recipe remains a
parent integration action.

Required later hardware checks: install/update without clearing progress; render
and play audio in both tablet orientations; USB attach/open/running-status/SysEx
round trips, note lights, unplug/replug and background recovery; two devices and
port ownership; camera grant/deny/cancel; import each file type; save/cancel video
and JSON to a real document provider; recorder codecs, model loading, memory and
thermal/latency behavior. None is claimed as performed here.

Official references: [local content and AssetLoader](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content),
[MidiReceiver buffer/timestamp contract](https://developer.android.com/reference/android/media/midi/MidiReceiver),
[WebViewCompat origin-scoped message listener](https://developer.android.com/reference/androidx/webkit/WebViewCompat),
[AGP 8.13 compatibility](https://developer.android.com/build/releases/agp-8-13-0-release-notes).

## Features shared with the desktop app (A2)

**Bridge methods** (`HostTools.java`, validated again in Java; the page side is `renderer/host-tools.js` and the pure rules in `renderer/host-policy.js`):

| op | what it does | limits |
|---|---|---|
| `deviceUsb` | "Support my device": vendor id, product id, class triple and, only if Android hands them over without permission, the product and maker name for each attached USB audio/MIDI device. Fails soft (`ok: false`). | Never calls `getSerialNumber`, never returns the device path (it names the port). The page rebuilds the answer field by field (`cleanUsb`), so even a hostile host cannot smuggle a serial in. At most 12 devices, 80 characters per text. |
| `openLink` | `ACTION_VIEW` for the GitHub issue link and the project, releases and Ko-fi pages. | The exact allow-list of `renderer/external-links.cjs`, ported to `LinkPolicy.java`: raw string match, exact host and path, a new-issue link only with the keys `title` and `body` once each, once-encoded. Everything else is refused. `LocalContent` uses the same policy for taps on a link in the page. |
| `clipboard` | `ClipboardManager.setPrimaryClip` (the page tries this first on Android; the desktop keeps `navigator.clipboard`, then `execCommand`). | Plain text, at most 100,000 characters. |

`scripts/test-android-midi.js` runs the allow-list on 47 good and hostile addresses against the page rules, the desktop rules and (when a JDK is installed) the Java class, and checks that no serial, path or location survives `cleanUsb`. Saves (the device report, takes, backups) go through the existing export queue; `host-bootstrap.js` first turns a title with an apostrophe or an accent into a plain file name, which the host would otherwise reject.

**Visual effects Full / Lite** (Settings > Display; `fx.js` in the head sets `html.fx-lite` before the first paint; rules at the end of `glass.css`). Lite drops every `backdrop-filter`, replaces glass with near-opaque fills of the same colour, thins shadows and glows, stops the page mesh drifting and shortens entrances to fades. Default Lite on Android and Full on the desktop; `prefers-reduced-transparency` always means Lite. On the emulator (software GPU, so only the ratio means anything) one frame on Home took about 2.0 s Full against 0.5 s Lite idle, and 3.0 s against 0.6 s while scrolling.

**Back button.** The host registers an `OnBackInvokedCallback` (API 33+, `enableOnBackInvokedCallback="true"`) or handles the Back key (older systems) and asks the page `__keylightBack()`: it closes the top dialog or sheet, then goes up a screen (player to where it came from, exercise to its lesson, lesson to the level map, any other screen to Home) and returns `false` only on Home, where the app leaves. Orientation changes are handled by the page (`configChanges`), so a player or exercise in progress stays where it is.

**Touch.** The on-screen keys in the player play by pointer events (`mountStageTouch` in `app.js`): one finger per pointer id, so chords work; sliding moves the note; `pointercancel`, a lost pointer, window blur and a hidden page release every held note. Hints say "tap" on a touch screen (`TOUCH` in `platform.js`). The shortcuts overlay and its buttons appear on Android only after a real key has been pressed (a keyboard is attached). The Airwave card and the Experimental group, the lookup toggle and the Terminal/Homebrew steps are hidden on Android. `touch.css` holds the narrow-screen and 44 px target rules; the tab bar fits at 360 px and the player gets one short top row in landscape on a phone.

**No INTERNET permission.** The manifest no longer declares it: the page loads from `WebViewAssetLoader` (no sockets), links open through an intent, and Bluetooth, USB and camera need no network permission. Checked on the emulator: the app loads, the play and course screens work, `fetch()` to a remote host is refused and the GitHub link still opens the browser.

**Debug builds only:** `WebView.setWebContentsDebuggingEnabled(true)` lets `chrome://inspect` or a DevTools socket drive the page (how the layouts here were checked). Release builds are not debuggable.

Not verifiable without a real device: Bluetooth and USB with a physical keyboard, USB descriptor names (some systems return none without permission), a real IME covering a text field, cutout phones and gesture-bar devices other than the emulator's, GPU speed.


## Hardening notes and manual checks (picker results, MIDI flood, Bluetooth attempts, bridge input)

- **Picker results.** Every URI from the save picker and from the file chooser goes through
  `PickerUris`/`UriPolicy`: only `content://` with a non-empty authority that is not this app's own,
  actually granted to the app by the picker, and not resolving (via a read-only file descriptor) into the
  app's private folders. `file:`, `android.resource:`, `data:` and the like are dropped. The chooser
  intents carry no persistable grants.
- **MIDI input.** Each input port has a bounded buffer (4096 chunks / 256 KiB); delivery to JavaScript is
  one batch per 16 ms; when full the oldest non-SysEx chunk goes first; one SysEx is cut off (and closed with
  F7) after 64 KiB; drops are reported as `{"kind":"dropped","port":...,"count":n}` at most once per second
  (the page ignores unknown kinds).
- **Bluetooth.** Every open is an attempt (`AttemptTracker`); a late or stale result is closed at once and
  the MIDI thread stays alive until all attempts have answered (or 30 s after destroy).
- **Picker details.** The result Intent's own grant flag is required (an older grant for the same URI does not
  count). The save destination is opened once, inspected (`readlink /proc/self/fd/N`, `fstat`) and that same
  descriptor is truncated and written; the WebView reopens upload URIs itself, so uploads can only be vetted, not
  pinned. Staged export files are owned by the pending record (including a copy still running) and stale-file cleanup
  only deletes unowned files older than 10 minutes.
- **Delivery.** At most one MIDI batch per port is in flight on the UI thread; the next is posted only after
  the previous ran. Input bytes are parsed into whole messages first (running status expanded), so overflow
  drops whole messages and can never produce a wrong note; an over-long SysEx is discarded whole. Bluetooth and
  USB open results arrive on the main thread and hop to the MIDI thread; if it is already shut down the late
  device is closed on the spot.
- **Known residual risk.** `scripts/android-keystore.sh` validates the folder and then writes to it; a local
  attacker who can swap a path component for a symlink between the check and the write could redirect the
  files. That needs a hostile process running as the same user and is out of scope.
- **Bridge.** Non-string web messages and oversize or malformed input are ignored; no exception from the
  page can crash the host.
- **Release keystore script.** The target folder is resolved physically (symlinks, relative paths, `..`);
  the script refuses the repo root, anything inside it, and a path with an unresolvable part.

Automated: `node scripts/test-android-midi.js` (includes the JVM tests in `android/jvm-test`, run with a JDK)
and `node scripts/test-android-release.js` (keystore guard with temp folders and symlinks).
Not testable without a device; check by hand with a debug build:

1. Developer options, "Don't keep activities" on. Record a take, export, and while the save picker is open
   press Home, then return and pick a location: the file is written, a "Saved" toast appears
   (`adb shell run-as org.keylight.piano ls cache` shows no `keylight-export-*.part` afterwards).
2. Cancel the picker: no staging file remains. Back out of the app with a pending picker: the same.
3. Malicious handler: install a test app that answers `ACTION_CREATE_DOCUMENT` / `OPEN_DOCUMENT` with
   `file:///data/user/0/org.keylight.piano/app_webview/Default/Preferences`; the export shows
   "Unexpected save location refused", the file chooser returns nothing, and `Preferences` keeps its size.
4. From `chrome://inspect` on a debug build run `KeylightNative.postMessage(new ArrayBuffer(1))`: the app
   keeps running (`adb logcat -s Keylight` shows one "Ignored a bad message" line at most).
5. Flood: send a few thousand notes per second from a MIDI test app/USB device; the app stays responsive,
   memory is flat, and a `dropped` event appears at most once a second.
6. Bluetooth: tap connect on keyboard A, disconnect, connect B, rotate or finish the app while it connects;
   `adb shell dumpsys media.midi` lists no device of this app afterwards.
