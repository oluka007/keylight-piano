# Airwave finger tracking: tester guide (experimental)

**Status: hardware unverified.** Nobody has yet shown that a ROLI Airwave can feed
fingertip positions to software other than ROLI's. This build exists to find out. It is
not the original Learn app's finger scoring and does not claim parity with it.

Keylight's regular Airwave support (the gesture MIDI input in Settings) is unchanged and
separate: it carries hand-level expression only, never fingers.

## What the test build does

1. Starts a small helper (`keylight-leap-helper`, in the app) only after you press
   **Connect**. The helper loads **your own installed Ultraleap tracking runtime** (LeapC),
   asks its tracking service for hands and prints fingertip positions for Keylight.
   Nothing from Ultraleap or ROLI is inside Keylight, and it never requests camera images.
2. Keylight maps the fingertips to the keys with a two-key calibration and, during a song,
   compares the finger on each pressed key with the song's suggested finger. This is
   **advisory**: unclear readings are not judged and your score never changes.
3. **Export test report** writes a short text file of counts and device classes for you to
   review and send.

The build is named *Keylight Airwave Test* and keeps its own settings and progress, so it
does not touch a normal Keylight install.

## Requirements

| | Mac (supported test path) | Windows |
|---|---|---|
| Computer | Apple silicon, macOS 13 or newer (ROLI's own requirement for Airwave) | not available in this build: no helper ships for Windows yet |
| Software you install | Ultraleap hand tracking software for macOS (Gemini V5 or newer), from Ultraleap | |
| Device | Airwave plugged in directly by USB. **Disconnect every other Ultraleap or Leap Motion sensor during the trial.** | |

Install the Ultraleap software from Ultraleap's own site and follow its prompts (it may ask
to approve a system extension). Keylight never installs drivers and never stops or restarts
any service. ROLI Airwave Control may also be installed; whether it allows a second program
to read the cameras is part of what this test finds out.

## Steps

1. Open **Keylight Airwave Test**. If macOS blocks it, right-click the app, choose Open.
2. Settings, **Airwave finger tracking**. Set *Finger source* to *Airwave sensor
   (experimental)* and press **Connect**.
3. Read **Status**. Each message says what to do:

   | Status | Meaning |
   |---|---|
   | Ultraleap tracking software not found | the runtime (LeapC) is not installed where Keylight looks |
   | Tracking service not running | runtime found, service off: start Ultraleap Hand Tracking |
   | Service running, no tracking device reported | the service does not report any device (plug the Airwave in directly, wait 10 s; then try with ROLI Airwave Control closed) |
   | Device found, no tracking data yet | a device is reported: hold your hands above it |
   | Receiving fingertips | frames with hands are arriving |

4. Open any built-in song (for example Twinkle). Back in Settings press **Calibrate keys**. Use
   your **right index finger** (the pointing finger) for all three steps:
   1. rest it on a key near the **low end** of the keyboard and press it;
   2. the same on a key near the **high end** (at least a third of the keyboard away);
   3. lift that finger about 5 cm straight up and hold still for a moment.

   Step 3 measures which way is "up" for the sensor: an Airwave looking down at the keys and
   a sensor sitting under the hand report heights in opposite directions, so Keylight never
   assumes either. If the lift is too small or unclear, the calibration is rejected and you
   start again. Any keyboard the song screen shows can be calibrated this way, including 49 keys
   and two keyboards played as one; the camera route still covers one 24-key keyboard only.
5. Play with *Advisory finger coaching* on. A numbered badge appears over the key under
   each fingertip and the line under the keys says what finger you used.
6. Press **Export test report** and send the file.

## What your result tells us

- **"Device found" with a class (for example `SIR170`) and frames with hands, with only the
  Airwave attached**: the public Ultraleap runtime can read this Airwave. Per-finger coaching is
  then possible. A device class and hand frames alone **cannot identify the Airwave if another
  Ultraleap sensor is attached**, which is why the others must be disconnected (the report
  states how many devices were reported).
- **"No tracking device reported"** while the Airwave is plugged in and the service runs: the
  public Ultraleap runtime does not see it. That leaves driver and service compatibility
  **unresolved and needing further investigation** (for example whether ROLI's driver or
  service holds the cameras); it does not prove that no other interface exists.
- **"Ultraleap tracking software not found"** only says the runtime is missing, not that
  the Airwave is unsupported: install it and repeat.
- A device of class `unknown` with a type code is useful too: send the report.

## What the "why no camera" lines mean

When you press **Export test report**, Keylight also looks (read-only, once, only then) for the usual reasons the tracking service lists no camera. These lines appear in the report, and the Status text on the card then names the most likely fix. They are likely causes, not certainties. Nothing is changed, installed or started.

| Report line | Meaning |
|---|---|
| `macOS major version` | used to give the right System Settings path |
| `Camera driver extensions` | driver extensions whose names mention Ultraleap, Leap, ROLI, Luminary or Airwave: bundle id, version and state in brackets. `[activated enabled]` is on and working. `[activated waiting for user]` is installed but **not switched on**: macOS 15 or later, System Settings > General > Login Items & Extensions > Driver Extensions; macOS 14 or earlier, System Settings > Privacy & Security > Allow. `None found` means the tracking software's camera driver does not seem to be installed: reinstall the tracking software and approve its driver |
| `Tracking services` (Windows) | services with those names and their state (`RUNNING`, `STOPPED`) |
| `Tracking-related programs running` | program names only, no arguments or paths. Only one tracking program can use the sensor at a time: if ROLI's own tracking software is listed next to Ultraleap's, quit one |
| `Installed tracking software` | app and folder names under `/Applications` and `/Library/Application Support` that match, and whether each holds a `libLeapC` library. Home folders are never looked at |
| `Not available` | that check could not run (command missing or too slow); it never stops the report |

Windows reports services and program names; the extension and install-folder checks are macOS only.

## What the report contains

Version, platform, connection state, runtime found or not, device class and type code, how many
devices were reported, the measured lift direction, frame counts, how many fingers were seen, whether calibration is set, whether an
Airwave-named MIDI input exists. It excludes video, fingertip coordinates, device serial
numbers and ids, file paths, song titles and progress. Nothing is sent automatically.

## For developers

- Helper source: `native/keylight-leap-helper.c`, structure layouts from Ultraleap's
  Apache-2.0 Unity binding (`LeapC.cs`, every struct `Pack = 1`) in `native/leapc_abi.h`
  with compile-time size checks. Build: `native/build.sh` (macOS only; a Windows build has
  not been made).
- Main process: `renderer/airwave-bridge.cjs` (spawn, validate, bound), `renderer/preload.cjs`.
- Page: `renderer/leap.js` (tracker, calibration), `renderer/airwave-source.js` (UI, report).
- Tests: `node scripts/test-leap.js`, `node scripts/test-airwave-native.js`; UI run:
  `node scripts/qa-airwave-ui.js <folder>`. Their proof level is *native ABI fixture*:
  the real helper loads `native/fake-leapc.c`, a stand-in library, never Ultraleap's.
- A plain browser build, with no helper, falls back to the legacy LeapJS WebSocket on
  `127.0.0.1:6437` (Ultraleap's Apache-2.0 UltraleapTrackingWebSocket); it is covered by
  protocol-fixture tests only.

## How the helper picks the tracking library

The helper only loads a library from `/Applications` or `/Library` whose file and folders are owned by root or you and are not writable by anyone else (permissions or ACLs), and it re-checks the file right after loading it; a swap in the instant between that last check and the system loader opening the file cannot be fully ruled out.
