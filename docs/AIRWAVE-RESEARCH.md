# Airwave finger tracking: research and probe note

Status (2026-11-07): research note. An experimental tester route now exists (see
`AIRWAVE-TESTING.md`); Airwave compatibility is still **unverified** and nothing here claims
Airwave support or parity with the original Learn app.

## What is established

| Question | Finding | Source |
| --- | --- | --- |
| Public Airwave output | Hand-level MIDI CC21-31 only; the manual says Airwave ignores finger position. Already consumed by `renderer/airwave.js`. | ROLI Airwave user manual |
| Per-finger data | ROLI describes "ROLI Vision" tracking 27 joints per hand at 90 fps, used inside ROLI's own apps. No public per-finger API was found. **Not found is not proven absent.** | roli.com/us/experience/airwave-learn |
| Hardware | Ultraleap Stereo IR 170 infrared cameras plus ROLI Vision. Number of camera modules not confirmed. | soundguys.com Airwave review |
| Host OS | macOS: Apple Silicon, macOS 13+. Windows: Windows 11 x64 with AVX2. | roli.com/us/experience/airwave-create |
| Distribution | Airwave Control comes from the Apps tab inside ROLI Connect (device registration). ROLI Connect itself has a public download page: https://roli.com/download-roli-connect. No standalone Airwave Control installer was found. | support.roli.com article 36000583915 |
| Public Ultraleap route | Hand tracking service plus LeapC SDK; macOS Gemini V5+ supports Apple Silicon. | docs.ultraleap.com/hand-tracking |
| Open bridge | https://github.com/ultraleap/UltraleapTrackingWebSocket, Apache-2.0. Serves the legacy LeapJS protocol on `ws://127.0.0.1:6437/v6.json`; requires an installed Ultraleap runtime and SDK (macOS: `/Library/Application Support/Ultraleap/LeapSDK`), built from source. No device events or gestures. | repository README |
| v6 frame shape | `hands[]` (`id`, `type`, `confidence`), `pointables[]` (`handId`, `type` 0-4, `tipPosition` in mm), timestamp in microseconds. | Leap Motion WebSocket JSON documentation |

## What is NOT established

- **Whether an Airwave is accepted by the public Ultraleap runtime, LeapC or the bridge: UNKNOWN.**
  ROLI ships its own driver extension and background service for the cameras; whether
  they allow a second consumer is untested.
- Whether the Airwave enumerates under Ultraleap's vendor/product IDs.
- The licence terms for redistributing or commercially using the Ultraleap runtime.
  Do not bundle any ROLI or Ultraleap runtime, driver, firmware or SDK.

## Local state when probed

Read-only checks on the development Mac: no USB devices attached, no ROLI, Airwave or
Ultraleap application, process, package, extension or data folder, nothing listening on
port 6437. ROLI Connect's public macOS installer was downloaded to task temp, mounted
read-only and removed again without being inspected, installed or run.

## exp4 field report: library not found on a real Mac

A tester on an Apple-silicon Mac mini with Ultraleap Hand Tracking installed (its Control
Panel opens) got `runtime-missing`, helper exit code 3, 7 refused connections. exp4's helper
only tried `Ultraleap Hand Tracking Service.app/Contents/LeapSDK/lib` and
`/Library/Application Support/Ultraleap/LeapSDK/lib`, so current installs lay the library
out differently (likely the app is now `Ultraleap Hand Tracking.app`, with the library in
Contents/LeapSDK, Frameworks or Resources; the exact path is still unknown). The helper now
tries those paths, scans `/Applications` for Ultraleap*/Leap* apps and the Ultraleap
Application Support folder one level deep, accepts `KEYLIGHT_LEAPC`, and when it still
fails reports the system folders tried and the names seen so the real layout can be read from
the tester's report.

## exp5 result: the runtime is there, the camera is not listed

Facts from the exp5 report and the tester's own checks (Mac mini, Apple silicon, ROLI Piano and the Airwave sensor attached):

- Ultraleap's runtime is found at `/Applications/Ultraleap Hand Tracking.app/Contents/LeapSDK/lib/libLeapC.dylib`, the library's message layout matches, and the service connects (library errors 0).
- Zero tracking devices are reported, zero frames, with the sensor plugged in. Ultraleap's own Control Panel also says "No Ultraleap device connected".
- macOS lists the sensor's camera on USB (as "Tracking Camera", maker Ultraleap, vendor 0x2936, product 0x1202, bcdDevice 0x0394) next to a pedal-type device from the keyboard maker (vendor 0x2af4, product 0x1000) behind a hub. So the hardware is present on the bus and enumerates normally.
- The Airwave-named MIDI inputs exist (a pedal port and an "Expression" port), as the manual's hand-level CC21-31 output says.

What this most likely implies: Ultraleap's public service enumerates only devices it has a profile for, and it does not accept this camera. The camera is either a variant with different firmware or a vendor-gated device that only the maker's own software configures. Keylight, which reads fingers through that same public service, cannot get fingertips from this sensor. This is not a bug in the helper.

What it rules out: a missing runtime (found), a protocol mismatch (layout check matches), a service that is not running (it is), and an unplugged sensor (the USB tree shows the camera). It does not tell us whether the vendor's software is needed to wake the camera, because the vendor's apps were not running during the test.

Remaining options, with honest feasibility:

1. Through Ultraleap: none. No setting or helper change of ours makes the public service list a device it does not recognise.
2. The sensor's own MIDI expression port: possible, and cheap. The per-input capture added after this report records what each MIDI input sends (message counts, controllers, pressure, channels) per port, so the next report shows whether the Expression port carries data without the vendor software running and how rich it is. This is hand-level data (the manual's CC21-31), not fingers, so it can drive expression but not fingering.
3. Webcam coaching: exists today (the camera coach), needs no special hardware, and gives fingering hints only.
4. Direct USB access to the camera: not planned. The camera speaks a proprietary protocol that is not documented publicly; learning it would mean reverse engineering the vendors' firmware and driver, which raises licence and legal questions (the Ultraleap runtime and the keyboard maker's software are not ours to bundle, copy or decode), and technically it would also need a USB driver outside the sandbox on each OS plus our own hand-pose model. The cost and risk are far out of proportion for a free app.

The exp5 reports (Airwave card and Support my device) stay the way to learn more: the support report now lists the USB devices the person chooses to include and the per-port MIDI statistics.

## What other people have done (searched 2026-11-09)

Nobody outside the sensor's maker was found reading fingers from an Airwave in their own
software. GitHub, two musician forums and the usual hand-tracking tools turned up one
relevant source: the MIT-licensed GRAB project (github.com/demixme/GRAB), whose
`AIRWAVE.md` is research, not a tested build. What it and Ultraleap's own pages add:

| Claim | Source | Checked how |
| --- | --- | --- |
| The cameras are ordinary Ultraleap IR 170 units; the hand-to-MIDI step runs in the maker's desktop software, not in the device. | GRAB `AIRWAVE.md` | Read. GRAB did not test it. |
| On macOS the camera needs a driver extension named `UltraleapUVCDriver`, which the maker's Airwave Control app installs and the user must switch on in System Settings. | GRAB `AIRWAVE.md`; the maker's support article 36000583848 | GRAB read directly; the support article only as a search excerpt (the site needs a login). |
| Ultraleap's public Hyperion 6.2 software lists the IR 170 camera as supported on macOS (Apple silicon and Intel), Windows and Linux. | ultraleap.com/downloads/sir170 | Read. |
| The maker's tracking software and Ultraleap's public app conflict; one must be removed or quit. | The maker's FAQ | Search excerpt only. |
| The maker went into administration in October 2026, and its player app needs to reach the maker's servers about every four weeks. | A news article; GRAB `PRESERVATION.md` | News article read; the four-week figure is GRAB's and untested. |

What this changes: the exp5 conclusion ("Ultraleap's public service does not accept this
camera") was too strong. The public service is documented to support this camera family
on a Mac. The likeliest reasons it listed nothing on the tester's Mac are now, in order:

1. The camera driver extension is not switched on (or not installed) on that Mac.
2. Another tracking program is holding the camera.
3. This camera's firmware is a maker-specific variant the public service refuses. Still
   possible, still untested.

Reasons 1 and 2 are things a user can fix, and the app can detect both. So the next
tester build reads the driver-extension state, the running tracking programs and the
installed candidates into the test report by itself, and the Airwave card names the
likely fix. No Terminal commands are needed from the tester any more.

If the maker's servers go away, the route that survives is the one Keylight already uses:
Ultraleap's public software plus the camera driver. That makes getting it to work worth
more than before.

## Reusable design (not shipped)

A draft of the frame parser, loopback client and two-key calibration was written and
removed because it could not be tied to an Airwave. It fed the existing
`attributeFingering` input shape: `{ active, calibrated, observedAt, fingertips[{ side,
finger, t, off, confidence, observedAt }] }`, with fresh (<= 200 ms), confident (>= 0.8)
tips at a MIDI note-on, advisory only and never changing the note score. Any source that
can produce real fingertip positions can plug in the same way.

## Next safe probe (needs the user's Airwave)

1. Connect the Airwave to this Mac.
2. Read-only: `ioreg -p IOUSB -w0` and note the device and vendor names and IDs.
3. If ROLI Connect or ROLI Airwave Control is already installed, give its path so its
   bundle can be inspected statically (frameworks, exported symbols, local sockets,
   schemas) for a real per-finger output.
4. Only if the evidence points to an Ultraleap-compatible device, check whether the
   public service lists it, then build the integration on whatever route is real.
