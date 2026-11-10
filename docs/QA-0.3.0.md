# Keylight 0.3.0 development verification

This is a local development build, not a published release. No physical MIDI keyboard,
Airwave, camera, payment account, user app installation or user progress profile was used.
Tests ran muted with their own profiles; test app/browser processes were closed afterward.

## Automated checks

| Check | Observed result |
| --- | --- |
| `npm test` | Existing 16 watchdog, 31 download-filter and 38 Windows-package checks pass; new navigation, downloads, diagnostics, 21 guided-practice, 12 editor, 26 backup, MIDI-output, paired-keyboard MIDI, 9 Airwave, 23 coaching and Android bridge/export checks pass (exit 0, 0 failures) |
| `npm run test:audio` | 16 real bundled recordings decode; live/scheduled output, release, velocity, sustain, voice limit, load failure/retry and bounded expression/reset pass using offline audio |
| `npm run selftest` | 254 SELFTEST lines, 0 FAIL, exit 0 on the Mac page (re-run after the four gate fixes below; includes the paired-keyboard cases) |
| `npm run selftest -- --query platform=win` | 254 SELFTEST lines, 0 FAIL, exit 0 on the Windows page on this Mac |
| Self-test against the app extracted from an earlier Mac ZIP (before the gate fixes) | 254 SELFTEST lines, 0 FAIL, exit 0; not repeated on the final ZIP, whose renderer files were instead compared byte for byte with the source |
| Changed JavaScript syntax / whitespace | `node --check` passes; `git diff --check` passes |
| Private-string scan | No matches in intended changed/new source; existing `.omo/` excluded and untouched |

The Windows-page run is not Windows OS validation. Source self-tests and offline audio are
not listening or hardware tests. Language-server diagnostics were unavailable because the
server was not installed; no error suppressions were added.

Regression tests were shown to fail for removed navigation restrictions, unsafe download
URLs, private-field report leakage, incorrect guided scoring/lifecycle, and backup rollback.
Two integration regressions added during this work prove that opening a course pauses a run
and ending it restores the prior loop. A quota-limited storage test catches settings rollback
that otherwise succeeds only when keys happen to fit in their original write order.

## Gate defects found and fixed

An independent read-only gate found four defects. Each was reproduced failing first, then fixed; none of the tests was weakened.

| Defect | Before the fix | After the fix |
| --- | --- | --- |
| Backup JSON was only checked for outer shape, so `days`/`recent` null or `settings.kbKeysFor` null passed confirmation and failed later | 40 malformed-document cases red | `scripts/test-backup.js` 26 checks green; semantic shapes are validated (`renderer/storage-validation.js`) before any confirmation or write |
| External MIDI output received zero paired-keyboard notes, pedal and poly pressure, while local mapped performance worked on both keyboards | `scripts/test-pair-midi.js` red through the production dispatcher with a fake wire | green: mapped pitches, stored releases and poly pressure, channel-safe all-off, and pedal transitions on all 16 external channels; part of `npm test`. The 254-line self-tests (including the paired-keyboard cases) still pass |
| A slow timed run could pass by accelerating during trailing rest | `scripts/test-guided.js` 19/21 | 21/21: the lowest speed used in the current attempt is kept (`minRate` in `player.js`), so accelerating during trailing rest no longer passes a slow attempt; it is cleared on restart, new step, new song and section change. The paused-setup, new-step, new-song and restart cases are regression controls for that clearing, not the original defect |
| Reset progress retained guided progress, weak bars and section history; guided preferences were not previously removed | same run | 21/21: the production reset pattern removes guided progress/weak/section keys and keeps guided mode, hand and speed preferences, settings, favourites and songs; cancelling keeps everything |

## Real renderer interactions

The orchestrator exercised the app in an owned, muted Chromium-family browser with a fresh
profile. Synthetic MIDI replaced the browser MIDI boundary and all light-service sockets were
blocked, so no user hardware could be reached. This used the production UI and module wiring.

| Scenario | Observed | Evidence |
| --- | --- | --- |
| Complete setup using Skip, then continue for free | Support dialog opens once; setup stays completed after navigation | `dist/qa-0.3.0/flows/first-run-support.png` |
| Support Escape, free continuation and subsequent offer | Dialog closes; remembered offer does not reopen; manual access remains | Support capture script and session action log |
| Separate gesture and instrument ports | Gesture values reach status; keyboard light output is excluded from instrument choices; note-on/off reach the explicitly selected synthetic synth | Session action log |
| Guided right-hand Wait step | Correct MIDI C4 registers a hit through production input; camera-off attribution is uncertain and does not reduce note score | Session action log |
| Correct a built-in note and save | A separate imported copy contains the corrected right-hand pitch; stale notation is removed | `dist/qa-0.3.0/flows/outcomes.json` |
| Abort a song batch on an uncloneable second record | First record is rolled back; neither batch record persists | `dist/qa-0.3.0/flows/outcomes.json` |
| Back up, delete the test song, then restore | Actual backup download has the format header; restore reloads after committing and recovers the song while preserving an unrelated progress key | `dist/qa-0.3.0/flows/outcomes.json` |
| Block sample requests | Honest unavailable status and previous synth selection remain | `dist/qa-0.3.0/visual/sample-error-*.png` |

The action scripts are task-local tooling, not product code. Their results are retained in
the session transcript. UI edits, save and restore were driven through real controls; the
batch-abort edge directly invoked the production storage API in the same owned profile.

## Visual coverage

`dist/qa-0.3.0/visual/ledger.json` records 34 captures, each with viewport and document width.
All viewport assertions pass at 1440 CSS px and 390 CSS px (DPR 3 mobile emulation).

Covered states: Settings top, external instruments/gestures, camera coaching, Settings bottom,
support, diagnostics top/bottom, player, guided course top/bottom, editor top/bottom and failed
sample loading. The download page has top/bottom captures in both light and dark modes at
both widths. The inherited native app keeps its existing dark palette. This is not a claim
of whole-app WCAG certification or a Lighthouse performance audit.

The review fixed the compact player widening the document, toast content appearing above the
guided modal, overlapping Progress buttons, a missing top exit on the long report, and a
two-row editor footer caused by an empty status element. New touch controls use 44px targets.

## Package inspection

| Artifact | Observed result |
| --- | --- |
| Mac DMG (`Keylight-0.3.0-mac-20261107-023429-83172.dmg`) | `hdiutil verify`, Applications link, all 407 bundle entries and strict ad-hoc signature match the freshly built ZIP |
| Windows Setup.exe (`Keylight-0.3.0-win-x64-1794011718129-83507-Setup.exe`) | NSIS builds with warnings treated as errors; extracted NSIS CRC passes; all 198 installed files match the verified ZIP; app EXE is x64 0.3.0 with RunAsNode, NODE_OPTIONS and inspect fuses disabled |
| Android APK (`dist/Keylight-0.3.0-android.apk`, SHA-256 `73923b5e54e09b1d7d1ac7f3ae27cacf979d3bf172f312bda893a7bc0c9cd203`) | Gradle assembly and Android lint succeed; APK v2 signature and 16KiB alignment checks pass with the stable local development signer |

The artifacts above were rebuilt after the four gate fixes; the shipped renderer files in both ZIPs and the APK match the source byte for byte. Earlier DMG/Setup files in `dist/` are older builds.

The first Windows build hit the command's two-minute timeout during compression; no compiler
was left running. A new build with an adequate time budget completed and passed inspection.
Windows installation, shortcuts and uninstall were not executed on this Mac. Mac remains
ad-hoc signed/unnotarised; Windows is unsigned; Android is a development-signed sideload build.
Android lint has zero errors and three unsuppressed, documented warnings (dependency update,
required JavaScript, and legacy backup metadata), plus toolchain deprecation notices.

### Android editor on an emulator

Setup: API 35 ARM64 Pixel Tablet image, WebView 124, host-GPU rendering, a task-owned
emulator and ADB serial. Software rendering was used first.

- **Confirmed bug, now fixed.** With the original layout the native keyboard was shown
  (`mInputShown=true`) but the page viewport stayed 800 CSS px tall, so the editor footer
  (Save/Cancel) sat behind the keyboard. Cause: WebView padding or window resizing does not
  shrink the CSS viewport. `MainActivity` now hosts the WebView in a `FrameLayout`; on API 30+
  it draws edge to edge and applies the union of the system-bar, cutout and keyboard insets to
  that parent, so the WebView is measured smaller. API 26-29 keep the normal `adjustResize`.
- **After the fix** (rebuilt APK, settled captures taken after native idle, no fixed sleeps):
  landscape 744 CSS px tall without the keyboard and 408 with the QWERTY keyboard; after Tab the
  numeric keyboard gives a 456 px viewport with the footer bottom 433 inside it; portrait 800x888
  with the keyboard, footer visible; scrolling and editing a note and Save work; Tab took 43 ms; `dumpsys activity lastanr` reports no ANR.
  Evidence: `dist/qa-0.3.0/android/after/` (screenshots, DOM geometry, lastanr) and the failing
  `before/editor-ime-failing.png` (viewport 800, keyboard covering the footer);
  the reproduction script is `android-ime-repro.mjs` there.
- **Historical observations, not explained.** An earlier software-rendered run showed stale
  copies of rows after the keyboard opened and one 5 s input-dispatch ANR after rotation and
  Tab. Suppressing all stage drawing did not remove the stale rows and was reverted. Later runs
  on host rendering, including the final one, showed neither stale rows nor an ANR, but they
  did not isolate their cause; the historical cause remains unisolated. The
  first attach of the final script twice failed with a DevTools "context" error that prevented
  the test from reaching the app assertions, followed by a passing run.
- This is an emulator check. It does not replace a real Android tablet, and the editor must
  still be checked there with a physical keyboard and USB MIDI.

## External validation still required

- Real USB MIDI and lighting on Android tablets, including power/OTG and device-specific behavior.
- Actual Airwave expression input and camera/fingering accuracy. Direct IR170/Ultraleap camera
  driving is not implemented; the app must not advertise that it replaces that runtime.
- Listening QA for the piano and expressive sound.
- Windows installation/update/uninstall execution and signing/notarisation credentials.
- Ko-fi account minimums and recurring support options. No payment-account setting was changed.
- Publication of the release and optional download page. The new manual workflows have not run.
