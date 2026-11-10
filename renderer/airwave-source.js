// Experimental Airwave (Ultraleap-compatible) fingertip source: settings card, connection
// readiness, two-key calibration and the tester report. Hardware support is UNVERIFIED:
// this only shows what a tracking service on this computer really delivers.
import { createLeapTracker, makeCalibration, liftDirection } from './leap.js'
import { downloadFile } from './download.js'

const place = (value) => String(value ?? '').slice(0, 240).replace(/[\r\n\t]/g, ' ')
const text = (value) => String(value ?? '').slice(0, 120).replace(/[\r\n\t]/g, ' ')

const DRIVER_NAME = 'Ultraleap camera driver (UltraleapUVCDriver)'
// The most specific likely cause the diagnostics support when the service lists no camera, or null.
// `diag` is what the main process collected on export; null parts mean a probe was not available.
export function noDeviceGuidance(diag) {
  if (!diag || typeof diag !== 'object') return null
  const exts = Array.isArray(diag.extensions) ? diag.extensions : null
  if (diag.os === 'mac' && exts) {
    const major = Number(diag.macos)
    if (exts.some((e) => /waiting for user/.test(e.state))) {
      const where = !diag.macos ? 'On macOS 15 or later: System Settings > General > Login Items & Extensions > Driver Extensions. On macOS 14 or earlier: System Settings > Privacy & Security, then press Allow.'
        : major >= 15 ? 'Open System Settings > General > Login Items & Extensions > Driver Extensions and switch it on.'
          : 'Open System Settings > Privacy & Security and press Allow next to the message about the driver.'
      return 'The ' + DRIVER_NAME + ' is likely installed but not switched on, so the service cannot see the camera. ' + where + ' Then wait about 10 seconds.'
    }
    if (!exts.length) return 'The tracking software\'s camera driver does not seem to be installed, which is a likely reason no camera is listed. Reinstall the tracking software, approve its driver when macOS asks, then press Connect again.'
  }
  const enabled = diag.os !== 'mac' || (exts || []).some((e) => /activated enabled/.test(e.state))
  const other = enabled && Array.isArray(diag.processes) ? diag.processes.find((n) => /roli|luminary|airwave/i.test(n) && !/ultraleap/i.test(n)) : null
  if (other) return 'The camera driver is on, but another tracking program (' + other + ') is running. Only one tracking program can use the sensor at a time, so quit ' + other + ', then wait about 10 seconds.'
  return null
}

// What to tell the person for each situation. `os` is 'Mac' | 'Windows' | other.
export function readiness(desc, os = 'Mac', diag = null) {
  const device = desc.native?.device
  const rt = desc.native?.runtime
  const foundRuntime = !!rt && rt !== 'missing' && rt !== 'incompatible'   // a runtime was found and the service answered
  switch (desc.state) {
    case 'off': return { code: 'off', title: 'Off', action: 'Press Connect to look for Ultraleap tracking on this computer.' }
    case 'connecting': return { code: 'connecting', title: 'Connecting…', action: '' }
    case 'no-helper': return { code: 'no-helper', title: 'No tracking helper in this build',
      action: os === 'Mac' ? 'This test build carries its helper for Apple-silicon Macs only.'
        : 'This test build has no helper for ' + os + ', so the Airwave source cannot run here yet.' }
    case 'runtime-missing': return { code: 'runtime-missing', title: 'Ultraleap tracking software not found',
      action: os === 'Windows'
        ? 'Install Ultraleap\'s hand tracking software for Windows (it provides LeapC.dll), start it, then press Connect again. Keylight retries every 5 seconds.'
        : 'Install Ultraleap\'s hand tracking software for macOS (Gemini V5 or newer, it provides libLeapC), open it once, then press Connect again. Keylight retries every 5 seconds.' }
    case 'service-down': return { code: 'service-down', title: 'Tracking service not running',
      action: 'The Ultraleap runtime was found but its tracking service is not running. Start Ultraleap Hand Tracking, then wait a few seconds.' }
    case 'unreachable': return { code: 'unreachable', title: desc.route === 'websocket' ? 'No tracking service found' : 'Tracking helper stopped',
      action: desc.route === 'websocket'
        ? 'Start Ultraleap\'s tracking service and its WebSocket bridge (127.0.0.1:6437). Keylight retries every 2 seconds.'
        : 'The helper ended unexpectedly. Keylight restarts it every 2 seconds; export the test report if this keeps happening.' }
    case 'connected':
      return device
        ? { code: 'no-hands', title: 'Device found, no tracking data yet',
          action: 'A ' + (device.class === 'unknown' ? 'tracking' : device.class) + ' device is reported. Hold your hands above the Airwave.' }
        : { code: 'no-device', title: 'Service running, no tracking device reported',
          action: noDeviceGuidance(diag) || (foundRuntime && !(desc.native.devicesAttached > 0)
            ? 'Ultraleap\'s software is running but does not list a camera yet. Check the Airwave is plugged in directly and wait about 10 seconds. If it still shows nothing, Ultraleap\'s public software may not support this sensor; press Export test report so we can decide what to try next.'
            : 'Plug the Airwave in directly with its USB cable and wait about 10 seconds. If nothing appears, try again with the keyboard maker\'s own software closed, then export the test report.') }
    default:
      if (desc.lastFrameAgeMs === null || desc.lastFrameAgeMs > 2000) return { code: 'quiet', title: 'Streaming stopped',
        action: 'No frames for over 2 seconds. Hold your hands above the sensor, or check the service is still running.' }
      if (!desc.framesWithHands) return { code: 'no-hands', title: 'Receiving frames, no hands visible',
        action: 'Hold both hands above the Airwave.' }
      return { code: 'tracking', title: 'Receiving fingertips', action: '' }
  }
}

const list = (items, show, none) => (items === null || items === undefined ? 'Not available' : items.length ? items.map(show).join('; ') : none)
// Report lines for the diagnostics the main process collected (names and states only).
function diagnosticLines(diag) {
  if (!diag || typeof diag !== 'object') return ['Driver and program checks: Not run (only the app can run them)']
  const ext = (e) => text(e.id) + (e.version ? ' (' + text(e.version) + ')' : '') + (e.state ? ' [' + text(e.state) + ']' : '')
  return [
    ...(diag.os === 'mac' ? [
      'macOS major version: ' + (diag.macos ? text(diag.macos) : 'Not available'),
      'Camera driver extensions (Ultraleap, Leap, ROLI, Luminary, Airwave): ' + list(diag.extensions, ext, 'None found')
    ] : []),
    ...(diag.os === 'windows' ? ['Tracking services: ' + list(diag.services, (s) => text(s.name) + ' [' + text(s.state) + ']', 'None found')] : []),
    'Tracking-related programs running: ' + list(diag.processes, text, 'None found'),
    ...(diag.os === 'mac' ? ['Installed tracking software: ' + list(diag.installed, (c) => place(c.path) + (c.libs.length ? ' (libLeapC: ' + c.libs.map(place).join(', ') + ')' : ' (no libLeapC found)'), 'None found')] : [])
  ]
}

// Plain text for a tester to read and send. Counts, flags and device classes only: no
// positions, device identifiers or serials, paths, songs or progress.
export function airwaveReport(snapshot) {
  const d = snapshot.leap || {}
  const n = d.native
  const r = readiness({ state: 'off', ...d }, snapshot.platform, snapshot.diagnostics)
  const yesNo = (v) => (v ? 'Yes' : 'No')
  const devices = (d.devices || []).map((x) => `${x.kind}${x.attached ? ', attached' : ''}${x.streaming ? ', streaming' : ''}`).join('; ') || 'None reported'
  const dev = n?.device
  return [
    'Keylight experimental Airwave tracking report',
    'Hardware support is UNVERIFIED. This report only records what the tracking software delivered.',
    'Version: ' + text(snapshot.version),
    'Platform: ' + text(snapshot.platform),
    'Finger source selected: ' + (snapshot.selected ? 'Airwave sensor (experimental)' : 'Camera'),
    'Route: ' + text(d.route || 'none') + ' (' + text(d.endpoint || 'n/a') + ')',
    'Connection state: ' + text(d.state || 'off'),
    'Readiness: ' + r.title,
    ...(n ? [
      'Ultraleap runtime (LeapC): ' + (n.runtime === 'missing' ? 'Not found' : n.runtime === 'incompatible' ? 'Found but missing expected functions'
        : n.runtime ? 'Found (' + text(n.runtime) + ')' : 'Not checked yet'),
      ...(n.runtime === 'missing' && n.search ? [
        'Ultraleap runtime search: tried ' + (n.search.tried.length ? n.search.tried.map(place).join('; ') : 'nothing reported'),
        'Ultraleap runtime search, seen: ' + (n.search.seen.length ? n.search.seen.map(place).join('; ') : 'no Ultraleap or Leap apps and no libLeapC files')
      ] : []),
      'Tracking device reported: ' + (dev ? 'Yes, class ' + text(dev.class) + ', type code ' + text(dev.typeCode) + (dev.identified ? '' : ' (not identified)') : 'No'),
      'Tracking devices reported this session: ' + (n.devicesAttached || 0) + (n.devicesAttached > 1 ? ' (more than one: disconnect other Ultraleap sensors and repeat, or this cannot show which device produced the frames)' : ''),
      'Library message layout check: ' + (n.abiMatch === null ? 'Not reached' : n.abiMatch ? 'Matches' : 'MISMATCH'),
      'Helper exit code: ' + (Number.isInteger(n.helperExitCode) ? n.helperExitCode : 'Still running or not started'),
      'Library errors: ' + (n.errors || 0)
    ] : [
      'Protocol version reported: ' + (Number.isInteger(d.serverVersion) ? d.serverVersion : 'Not reported'),
      'Device events: ' + devices
    ]),
    ...diagnosticLines(snapshot.diagnostics),
    'Frames received: ' + (d.frames || 0),
    'Frames with at least one hand: ' + (d.framesWithHands || 0),
    'Frames per second (average): ' + (d.framesPerSecond || 0),
    'Distinct fingers seen (of 10): ' + (d.fingersSeen || 0),
    'Last frame age: ' + (Number.isFinite(d.lastFrameAgeMs) ? d.lastFrameAgeMs + ' ms' : 'No frame yet'),
    'Connections lost or refused: ' + (d.connectionsLost || 0),
    'Key calibration set: ' + yesNo(d.calibrated),
    'Measured lift direction (sensor Y): ' + (d.liftDirection === 1 ? 'Raising a finger increases Y' : d.liftDirection === -1 ? 'Raising a finger decreases Y' : 'Not measured'),
    'Airwave-named MIDI input present: ' + yesNo(snapshot.airwaveMidi),
    'Calibration presses accepted: ' + (snapshot.calibrationAccepted || 0) + ', rejected: ' + (snapshot.calibrationRejected || 0),
    '',
    'What this shows: with ONLY the Airwave connected, a device class and frames with hands mean the',
    'public Ultraleap runtime can read it. A device class alone cannot identify the Airwave if another',
    'sensor is attached. No device or no runtime leaves driver and service compatibility unresolved:',
    'it needs further investigation and does not show that no other interface exists.',
    'Driver and program lines list names and states only, never arguments or home-folder paths.',
    'Excluded: raw video, fingertip coordinates, device serials and ids, file paths from your home folder, song titles,',
    'recordings and progress. Only system install locations under /Applications and /Library are named, for the runtime search.',
    'Nothing is sent automatically. Review it before sharing.'
  ].join('\n')
}

// Calibration always uses the same named finger, so the sensor's own hand and finger labels
// identify it and no height guess is needed.
const CAL_SIDE = 'right', CAL_FINGER = 2
const REASONS = {
  'not-streaming': 'The tracking service is not sending frames yet.',
  stale: 'No fresh hand data at the moment of the press.',
  'low-confidence': 'The sensor is not confident which hand this is.',
  'no-finger': 'The sensor does not see your right index finger. Hold your right hand above the Airwave.'
}
const LIFT_TIMEOUT_MS = 20000

export function mountAirwaveSource({ settings, save, getKeys, notice, platform, version, airwaveMidi, ids = {} }) {
  const el = (id) => document.getElementById(ids[id] || id)
  const select = el('fingerSource'), toggle = el('airToggle'), calibrate = el('airCalibrate'),
    exportBtn = el('airReport'), statusEl = el('airStatus'), helpEl = el('airHelp'), calEl = el('airCalState'),
    framesEl = el('airFrames')
  const leap = createLeapTracker({ onState: () => render() })
  // Older saves without a lift direction or key count are not trusted: key positions are stored
  // as fractions of the keyboard, so they only mean something for the same number of keys.
  if (settings.airCalib?.lift && settings.airCalib.n) leap.calib = settings.airCalib
  let step = null              // null | 'a' | 'b' | 'lift'
  let first = null, second = null, liftTimer = null, liftSamples = [], liftDeadline = 0, calibKeys = 0
  const dropStaleCalibration = () => {
    const keys = getKeys()
    if (!leap.calib || !keys || settings.airCalib?.n === keys.length) return
    leap.calib = null
    settings.airCalib = null; save()
    notice('The keyboard changed, so the Airwave key calibration was cleared. Calibrate again.')
  }
  let accepted = 0, rejected = 0
  let diagnostics = null        // set when the report is exported: the probes never run on their own
  const probes = () => globalThis.keylightNative?.airwave?.diagnostics

  const selected = () => settings.fingerSource === 'airwave'
  const render = () => {
    dropStaleCalibration()
    const d = leap.describe()
    const r = readiness(d, platform, diagnostics)
    statusEl.textContent = r.title
    statusEl.dataset.state = r.code
    helpEl.textContent = step === 'a' ? 'Calibration 1 of 3: rest your RIGHT index finger (the pointing finger) on a key near the low end of the keyboard and press it.'
      : step === 'b' ? 'Calibration 2 of 3: the same finger on a key near the high end, at least a third of the keyboard away.'
        : step === 'lift' ? 'Calibration 3 of 3: lift that same finger about 5 cm straight up and hold still for a moment.'
          : r.action
    calEl.textContent = leap.calib ? 'Set' : 'Not set'
    framesEl.textContent = d.frames ? `${d.frames} frames, ${d.framesWithHands} with hands, ~${d.framesPerSecond} per second` : 'None yet'
    toggle.textContent = d.state === 'off' ? 'Connect' : 'Disconnect'
    calibrate.disabled = d.state !== 'streaming'
    select.value = selected() ? 'airwave' : 'camera'
  }
  const snapshot = () => ({ version, platform, selected: selected(), leap: leap.describe(),
    airwaveMidi: airwaveMidi(), diagnostics, calibrationAccepted: accepted, calibrationRejected: rejected })

  select.onchange = () => {
    settings.fingerSource = select.value === 'airwave' ? 'airwave' : 'camera'
    save()
    if (!selected()) { leap.stop(); cancelLift(); step = null }
    render()
  }
  toggle.onclick = () => { if (leap.state === 'off') leap.start(); else { leap.stop(); cancelLift(); step = null }; render() }
  calibrate.onclick = () => { cancelLift(); step = 'a'; first = null; second = null; render() }
  exportBtn.onclick = async () => {
    try { const run = probes(); diagnostics = run ? await run() : null } catch (_e) { diagnostics = null }
    render()
    downloadFile(new Blob([airwaveReport(snapshot())], { type: 'text/plain;charset=utf-8' }), 'keylight-airwave-report.txt')
    notice('Airwave report download requested. Review it before sharing.')
  }
  const cancelLift = () => { if (liftTimer !== null) { clearInterval(liftTimer); liftTimer = null } liftSamples = [] }
  // Step 3: wait for the same finger to be lifted and held steady, then fix which way "up" is.
  const watchLift = () => {
    const rest = (first.y + second.y) / 2
    liftDeadline = performance.now() + LIFT_TIMEOUT_MS
    liftSamples = []
    liftTimer = setInterval(() => {
      if (performance.now() > liftDeadline) { cancelLift(); step = null; rejected++; notice('Could not see the finger lifted. Start the calibration again.'); render(); return }
      const got = leap.sampleFinger(CAL_SIDE, CAL_FINGER)
      if (!got.ok || Math.abs(got.point.y - rest) < 25) { liftSamples = []; return }
      liftSamples.push(got.point.y)
      liftSamples = liftSamples.slice(-4)
      if (liftSamples.length < 4 || Math.max(...liftSamples) - Math.min(...liftSamples) > 10) return
      const raised = liftSamples.reduce((sum, y) => sum + y, 0) / liftSamples.length
      const calib = makeCalibration(first, second, liftDirection(rest, raised))
      cancelLift()
      if (!calib) { rejected++; step = null; notice('The lift was unclear. Start the calibration again.'); render(); return }
      leap.calib = calib
      settings.airCalib = { ...calib, n: calibKeys }; save()
      step = null; first = second = null
      notice('Airwave key calibration saved')
      render()
    }, 150)
  }
  const timer = setInterval(render, 1000)   // frame counters and "stopped streaming" are time based
  render()

  const api = {
    tracker: leap,
    selected,
    report: () => airwaveReport(snapshot()),
    // Called for every genuine key press. During calibration the press fixes where a known
    // key is in the sensor's space; it never changes what is played or scored.
    onNoteOn(pitch, at = performance.now()) {
      if (!step) return false
      if (step === 'lift') return true   // lifting the finger, not pressing a calibration key
      const keys = getKeys()
      const index = keys ? keys.findIndex((key) => key.pitch === pitch) : -1
      if (index < 0 || keys.length < 2) { notice('Open a song first, so Keylight knows where the keys are'); return true }
      const f = (keys[index].cx - keys[0].cx) / (keys[keys.length - 1].cx - keys[0].cx)
      const got = leap.sampleFinger(CAL_SIDE, CAL_FINGER, { at })
      if (!got.ok) { rejected++; notice(REASONS[got.reason] || 'Press again'); return true }
      accepted++
      calibKeys = keys.length
      const point = { ...got.point, f }
      if (step === 'a') { first = point; step = 'b'; render(); return true }
      if (Math.abs(point.f - first.f) < 0.25) { rejected++; step = 'a'; first = null; notice('Those two presses were too close together. Start again with keys further apart.'); render(); return true }
      second = point
      step = 'lift'
      render()
      watchLift()
      return true
    },
    stop() { clearInterval(timer); cancelLift(); leap.stop() }
  }
  window.addEventListener('pagehide', api.stop)
  return api
}
