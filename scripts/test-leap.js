// Protocol-fixture tests for the experimental Airwave (Ultraleap-compatible) source.
// PROOF LEVEL: the frames below follow the documented LeapJS v6 JSON layout. They were
// NOT recorded from an Airwave or any tracking service; no hardware is involved.
const assert = require('node:assert/strict')
const { test } = require('node:test')
const ready = Promise.all([import('../renderer/leap.js'), import('../renderer/coaching.js'),
  import('../renderer/airwave-source.js'), import('../renderer/storage-validation.js')])

const tip = (handId, type, x, y, z) => ({ id: handId * 10 + type, handId, type, tipPosition: [x, y, z], tool: false, timeVisible: 1 })
const frame = (hands, pointables) => JSON.stringify({ id: 1, timestamp: 123456, currentFrameRate: 90, hands, pointables })
const right = { id: 1, type: 'right', confidence: 0.95 }

class FakeSocket {
  static all = []
  constructor(url) { this.url = url; this.sent = []; FakeSocket.all.push(this) }
  send(data) { this.sent.push(data) }
  close() { this.closed = true }
  open() { this.onopen?.() }
  say(data) { this.onmessage?.({ data }) }
  drop() { this.onclose?.() }
}
function harness(extra = {}) {
  FakeSocket.all = []
  const clock = { t: 1000 }
  const timers = []
  return { clock, timers, FakeSocket, make: async () => {
    const [{ createLeapTracker }] = await ready
    const states = []
    const tracker = createLeapTracker({ WebSocketImpl: FakeSocket, now: () => clock.t, onState: (s) => states.push(s),
      setTimer: (fn, ms) => { timers.push({ fn, ms }); return timers.length }, clearTimer: (id) => { if (timers[id - 1]) timers[id - 1].cancelled = true }, ...extra })
    return { tracker, states }
  } }
}
const calib = { a: { x: -100, y: 20, z: 0, f: 0 }, b: { x: 100, y: 20, z: 0, f: 1 }, lift: 1 }

test('parser keeps typed hands, drops tools, unknown hands and bad vectors, zeroes untyped confidence', async () => {
  const [{ parseLeapFrame }] = await ready
  const out = parseLeapFrame(JSON.parse(frame(
    [right, { id: 2, type: 'left', confidence: 0.9 }, { id: 3, confidence: 0.99 }],
    [tip(1, 1, 5, 20, 3), { ...tip(1, 0, 0, 0, 0), tool: true }, tip(9, 2, 0, 0, 0), { ...tip(1, 4, 0, 0, 0), tipPosition: [0, NaN, 0] },
      tip(2, 0, 1, 2, 3), tip(3, 2, 4, 5, 6), { ...tip(1, 7, 0, 0, 0) }])), 77)
  assert.deepEqual(out.map((t) => [t.side, t.finger, t.confidence]), [['right', 2, 0.95], ['left', 1, 0.9], ['right', 3, 0]])
  assert.equal(out[0].observedAt, 77)
  assert.equal(parseLeapFrame({ version: 6 }, 1), null)
})

test('two-point calibration projects along a rotated key row and reports offset in row lengths', async () => {
  const [{ projectTip, makeCalibration }] = await ready
  assert.deepEqual(projectTip(calib, { x: 0, z: 0 }), { t: 0.5, off: 0 })
  // key row running along z instead of x
  const c = makeCalibration({ x: 0, y: 5, z: -100, f: 0.1 }, { x: 0, y: 5, z: 100, f: 0.9 }, 1)
  const q = projectTip(c, { x: 20, z: 0 })
  assert.ok(Math.abs(q.t - 0.5) < 1e-9)
  assert.ok(Math.abs(Math.abs(q.off) - 20 / 250) < 1e-9)
  assert.equal(makeCalibration({ x: 0, y: 0, z: 0, f: 0.5 }, { x: 100, y: 0, z: 0, f: 0.6 }, 1), null)
  assert.equal(makeCalibration({ x: 0, y: 0, z: 0, f: 0 }, { x: 10, y: 0, z: 0, f: 1 }, 1), null)
  assert.equal(makeCalibration({ x: 0, y: 0, z: 0, f: 0 }, { x: 100, y: 0, z: NaN, f: 1 }, 1), null)
  // no measured lift direction: never defaulted to a table-top sign
  assert.equal(makeCalibration({ x: 0, y: 0, z: 0, f: 0 }, { x: 100, y: 0, z: 0, f: 1 }), null)
  assert.equal(makeCalibration({ x: 0, y: 0, z: 0, f: 0 }, { x: 100, y: 0, z: 0, f: 1 }, 0), null)
})

test('wire lifecycle: connect, background request, stream, stale data, disconnect reset, retry, stop', async () => {
  const h = harness()
  const { tracker, states } = await h.make()
  tracker.calib = calib
  tracker.start()
  const socket = FakeSocket.all[0]
  assert.equal(socket.url, 'ws://127.0.0.1:6437/v6.json')
  assert.equal(tracker.state, 'connecting')
  socket.open()
  assert.equal(tracker.state, 'connected')
  assert.deepEqual(JSON.parse(socket.sent[0]), { background: true })
  socket.say('not json'); socket.say('{"version":6}')
  assert.equal(tracker.state, 'connected')
  h.clock.t = 1100
  socket.say(frame([right], [tip(1, 1, 0, 20, 0)]))
  assert.equal(tracker.state, 'streaming')
  const obs = tracker.getObservation()
  assert.deepEqual(obs, { active: true, calibrated: true, observedAt: 1100, source: 'ultraleap',
    fingertips: [{ t: 0.5, off: 0, side: 'right', finger: 2, confidence: 0.95, observedAt: 1100 }] })
  assert.equal(tracker.fresh(), true)
  h.clock.t = 1700
  assert.equal(tracker.fresh(), false)
  socket.drop()
  assert.equal(tracker.state, 'unreachable')
  assert.deepEqual(tracker.getObservation().fingertips, [])
  assert.equal(tracker.getObservation().observedAt, null)
  assert.equal(h.timers.at(-1).ms, 2000)
  h.timers.at(-1).fn()
  assert.equal(FakeSocket.all.length, 2)
  FakeSocket.all[1].drop()
  const pending = h.timers.at(-1)
  tracker.stop()
  assert.equal(tracker.state, 'off')
  assert.equal(pending.cancelled, true)
  assert.equal(FakeSocket.all[1].closed, true)
  assert.deepEqual(states.slice(0, 4), ['connecting', 'connected', 'streaming', 'unreachable'])
  assert.equal(states.at(-1), 'off')
})

test('missing WebSocket or a throwing constructor is reported as unreachable', async () => {
  const [{ createLeapTracker }] = await ready
  const a = createLeapTracker({ WebSocketImpl: null, setTimer: () => 1, clearTimer: () => {} })
  a.start(); assert.equal(a.state, 'unreachable')
  const b = createLeapTracker({ WebSocketImpl: class { constructor() { throw new Error('blocked') } }, setTimer: () => 1, clearTimer: () => {} })
  b.start(); assert.equal(b.state, 'unreachable')
})

test('hovering tips are not offered as candidates; stale frames and low confidence stay unknown in coaching', async () => {
  const [, { attributeFingering }] = await ready
  const h = harness()
  const { tracker } = await h.make()
  tracker.calib = calib
  tracker.start(); const socket = FakeSocket.all[0]; socket.open()
  const keys = [{ pitch: 60, cx: 0, w: 20, black: false }, { pitch: 61, cx: 20, w: 20, black: true }, { pitch: 62, cx: 40, w: 20, black: false }]
  // key 61 sits at t = 0.5: right index low over it, left thumb hovering 120 mm higher over the same place
  h.clock.t = 1100
  socket.say(frame([right, { id: 2, type: 'left', confidence: 0.9 }], [tip(1, 1, 0, 20, 0), tip(2, 0, 0, 140, 0)]))
  const event = (observation, now) => ({ pitch: 61, note: { pitch: 61, hand: 'right', finger: 2 }, keys, observation, now })
  const good = attributeFingering(event(tracker.getObservation(), 1150))
  assert.equal(good.status, 'match')
  assert.match(attributeFingering(event({ ...tracker.getObservation(), fingertips: [] }, 1150)).statusText, /^Airwave sensor|No fingertip/)
  const stale = attributeFingering(event(tracker.getObservation(), 1400))
  assert.equal(stale.status, 'unknown'); assert.equal(stale.reason, 'stale')
  assert.match(stale.statusText, /^Airwave sensor observation/)
  assert.equal(stale.affectsScore, false)
  h.clock.t = 1110
  socket.say(frame([{ ...right, confidence: 0.4 }], [tip(1, 1, 0, 20, 0)]))
  assert.equal(attributeFingering(event(tracker.getObservation(), 1150)).reason, 'low-confidence')
  // camera observations keep their original wording
  const cam = attributeFingering({ ...event({ active: true, calibrated: true, observedAt: 0, fingertips: [] }, 900) })
  assert.match(cam.statusText, /^Camera observation/)
})

test('calibration samples the named finger only: fresh, confident and on the named hand', async () => {
  const h = harness()
  const { tracker } = await h.make()
  tracker.start(); const socket = FakeSocket.all[0]; socket.open()
  assert.deepEqual(tracker.sampleFinger('right', 2, { at: 1000 }), { ok: false, reason: 'not-streaming' })
  h.clock.t = 1100
  socket.say(frame([right, { id: 2, type: 'left', confidence: 0.95 }], [tip(1, 1, 10, 20, 5), tip(1, 2, 30, 25, 5), tip(2, 1, 99, 1, 99)]))
  assert.deepEqual(tracker.sampleFinger('right', 2, { at: 1150 }), { ok: true, point: { x: 10, y: 20, z: 5 } })
  assert.deepEqual(tracker.sampleFinger('left', 2, { at: 1150 }).point, { x: 99, y: 1, z: 99 })
  assert.equal(tracker.sampleFinger('right', 5, { at: 1150 }).reason, 'no-finger')
  assert.equal(tracker.sampleFinger('right', 2, { at: 1400 }).reason, 'stale')
  socket.say(frame([{ ...right, confidence: 0.5 }], [tip(1, 1, 10, 20, 5)]))
  assert.equal(tracker.sampleFinger('right', 2, { at: 1150 }).reason, 'low-confidence')
})

test('lift direction is measured from the same finger and ambiguous lifts are rejected', async () => {
  const [{ liftDirection }] = await ready
  assert.equal(liftDirection(20, 90), 1)       // sensor below the hand (table top): lifting raises Y
  assert.equal(liftDirection(300, 220), -1)    // sensor above the hand (overhead): lifting lowers Y
  assert.equal(liftDirection(20, 40), null)    // under 25 mm: cannot tell which way is up
  assert.equal(liftDirection(20, NaN), null)
})

for (const [name, lift, pressY, hoverY] of [['table-top sensor (lift raises Y)', 1, 20, 120], ['overhead sensor (lift lowers Y)', -1, 300, 200]]) {
  test(`hover filtering follows the measured lift direction: ${name}`, async () => {
    const [, { attributeFingering }] = await ready
    const h = harness()
    const { tracker } = await h.make()
    tracker.calib = { a: { x: -100, y: pressY, z: 0, f: 0 }, b: { x: 100, y: pressY, z: 0, f: 1 }, lift }
    tracker.start(); const socket = FakeSocket.all[0]; socket.open()
    const keys = [{ pitch: 60, cx: 0, w: 20, black: false }, { pitch: 61, cx: 20, w: 20, black: true }, { pitch: 62, cx: 40, w: 20, black: false }]
    const ask = (when) => attributeFingering({ pitch: 61, note: { pitch: 61, hand: 'right', finger: 2 }, keys, observation: tracker.getObservation(), now: when })
    h.clock.t = 1100
    // right index at the pressing height and left thumb hovering over the same key
    socket.say(frame([right, { id: 2, type: 'left', confidence: 0.9 }], [tip(1, 1, 0, pressY, 0), tip(2, 0, 0, hoverY, 0)]))
    assert.equal(tracker.getObservation().fingertips.length, 1)
    assert.equal(ask(1150).status, 'match')
    // the same two tips with the heights swapped: now the LEFT thumb is the one at the keys
    h.clock.t = 1200
    socket.say(frame([right, { id: 2, type: 'left', confidence: 0.9 }], [tip(1, 1, 0, hoverY, 0), tip(2, 0, 0, pressY, 0)]))
    const swapped = tracker.getObservation().fingertips
    assert.deepEqual(swapped.map((t) => [t.side, t.finger]), [['left', 1]])
    assert.equal(ask(1250).status, 'mismatch')
  })
}

test('an experimental source coaches any key count; the camera keeps its 24-key limit', async () => {
  const { mountCameraCoach } = await import('../renderer/camera-coach.js')
  const elements = { coachEnabled: { checked: false }, coachFeedback: { hidden: true, textContent: '', dataset: {} } }
  const original = global.document
  global.document = { getElementById: (id) => elements[id] }
  try {
    const settings = { fingerCoaching: true }
    const keys = Array.from({ length: 49 }, (_, i) => ({ pitch: 36 + i, cx: i * 10, w: 10, black: false }))
    const tip = (t) => ({ side: 'right', finger: 2, t, off: 0, confidence: 0.95, observedAt: 1000 })
    const observation = (source) => ({ active: true, calibrated: true, observedAt: 1000, source, fingertips: [tip(0.5)] })
    const run = (tracker, count) => {
      const coach = mountCameraCoach({ settings, save() {}, getTracker: () => tracker, getKeys: () => keys, getKeyCount: () => count })
      const realNow = performance.now
      performance.now = () => 1100
      try { coach.notePlayed(60, { pitch: 60, hand: 'right', finger: 2 }) } finally { performance.now = realNow }
      return elements.coachFeedback.textContent
    }
    const camera = run({ getObservation: () => observation(undefined) }, 49)
    assert.match(camera, /^Camera coaching currently covers one 24-key keyboard\.$/)
    for (const count of [49, 48]) {
      const native = run({ getObservation: () => observation('ultraleap') }, count)
      assert.doesNotMatch(native, /24-key/)
      assert.match(native, /^Suggested finger 2: observed 2, right hand\.$/)
    }
  } finally { if (original === undefined) delete global.document; else global.document = original }
})

test('tester report and diagnostics carry counts and flags only', async () => {
  const [, , { airwaveReport, readiness }] = await ready
  const h = harness()
  const { tracker } = await h.make()
  tracker.calib = calib
  tracker.start(); const socket = FakeSocket.all[0]; socket.open()
  socket.say(JSON.stringify({ version: 6 }))
  socket.say(JSON.stringify({ event: { type: 'deviceEvent', state: { id: 'SERIAL-ABC123', attached: true, streaming: true, type: 'peripheral' } } }))
  for (let i = 0; i < 5; i++) { h.clock.t += 11; socket.say(frame([right], [tip(1, 1, 123.456, 20, 9.87)])) }
  const d = tracker.describe()
  assert.equal(d.frames, 5); assert.equal(d.framesWithHands, 5); assert.equal(d.serverVersion, 6)
  assert.deepEqual(d.devices, [{ attached: true, streaming: true, kind: 'peripheral' }])
  const report = airwaveReport({ version: '0.3.0-test', platform: 'Windows', selected: true, leap: d, airwaveMidi: false, calibrationAccepted: 2, calibrationRejected: 1 })
  for (const secret of ['SERIAL-ABC123', '123.456', '9.87', '/Users', 'C:\\']) assert.equal(report.includes(secret) || JSON.stringify(d).includes(secret), false, secret)
  assert.match(report, /UNVERIFIED/)
  assert.match(report, /does not show that no other interface exists/)
  assert.match(report, /Frames received: 5/)
  assert.match(report, /Protocol version reported: 6/)
  assert.match(report, /Device events: peripheral, attached, streaming/)
  assert.match(report, /Receiving fingertips/)
  // a failed runtime search is listed in the report: system locations and names only
  const missing = { ...d, route: 'native-helper', state: 'runtime-missing', native: { runtime: 'missing', device: null, abiMatch: null, helperExitCode: 3, errors: 0, devicesAttached: 0,
    search: { tried: ['/Applications/Ultraleap Hand Tracking.app/Contents/LeapSDK/lib', '(system library search)'], seen: ['app:Ultraleap Hand Tracking.app', 'lib:/Library/Application Support/Ultraleap/LeapSDK/lib/libLeapC.5.dylib'] } } }
  const mr = airwaveReport({ version: '0.3.0-test', platform: 'Mac', selected: true, leap: missing, airwaveMidi: true })
  assert.match(mr, /Ultraleap runtime search: tried \/Applications\/Ultraleap Hand Tracking\.app\/Contents\/LeapSDK\/lib; \(system library search\)/)
  assert.match(mr, /Ultraleap runtime search, seen: app:Ultraleap Hand Tracking\.app; lib:\/Library\/Application Support\/Ultraleap\/LeapSDK\/lib\/libLeapC\.5\.dylib/)
  assert.match(mr, /file paths from your home folder/)
  assert.equal(mr.includes('/Users'), false)
  // readiness explains each situation
  assert.match(readiness({ state: 'runtime-missing' }, 'Windows').action, /LeapC\.dll/)
  assert.match(readiness({ state: 'runtime-missing' }, 'Mac').action, /Gemini V5/)
  assert.match(readiness({ state: 'no-helper' }, 'Windows').action, /Windows/)
  assert.match(readiness({ state: 'unreachable', route: 'websocket' }).action, /6437/)
  assert.equal(readiness({ state: 'service-down' }).code, 'service-down')
  assert.equal(readiness({ state: 'connected', native: { device: null } }).code, 'no-device')
  assert.equal(readiness({ state: 'connected', native: { device: { class: 'SIR170' } } }).code, 'no-hands')
  assert.equal(readiness({ state: 'streaming', lastFrameAgeMs: 5000, framesWithHands: 3 }).code, 'quiet')
  assert.equal(readiness({ state: 'streaming', lastFrameAgeMs: 10, framesWithHands: 0 }).code, 'no-hands')
})

test('stored settings for the source and its calibration validate', async () => {
  const [, , , { validStoredValue }] = await ready
  assert.equal(validStoredValue('lumi.settings', { fingerSource: 'airwave', airCalib: calib }), true)
  assert.equal(validStoredValue('lumi.settings', { fingerSource: 'other' }), false)
  assert.equal(validStoredValue('lumi.settings', { airCalib: { a: { x: 1 }, b: calib.b } }), false)
  assert.equal(validStoredValue('lumi.settings', { airCalib: { ...calib, lift: 0 } }), false)
  assert.equal(validStoredValue('lumi.settings', { airCalib: { ...calib, n: 49 } }), true)
  assert.equal(validStoredValue('lumi.settings', { airCalib: { ...calib, n: '49' } }), false)
})
