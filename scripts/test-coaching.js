const assert = require('node:assert/strict')
const { test } = require('node:test')
const moduleReady = Promise.all([import('../renderer/coaching.js'), import('../renderer/handtrack.js')])

function fixture(HandTracker, handObservations) {
  const original = global.document
  let tracker
  try {
    global.document = { createElement: () => ({ videoWidth: 640, videoHeight: 360 }) }
    tracker = new HandTracker()
  } finally {
    if (original === undefined) delete global.document
    else global.document = original
  }
  tracker.running = true
  tracker.calib = { a: { x: 0.1, y: 0.5 }, b: { x: 0.9, y: 0.5 } }
  const points = Array.from({ length: 21 }, () => ({ x: 0.1, y: 1, z: 0 }))
  points[8] = { x: 0.5, y: 0.5, z: 0 }
  tracker.hands = handObservations({ landmarks: [points],
    handedness: [[{ categoryName: 'Left', score: 0.95 }]] }, 1000)
  tracker.observedAt = 1000
  const keys = [{ pitch: 60, cx: 0, w: 20, black: false },
    { pitch: 61, cx: 20, w: 20, black: true },
    { pitch: 62, cx: 40, w: 20, black: false }]
  return { tracker, points, event: { pitch: 61, note: { pitch: 61, hand: 'right', finger: 2 },
    keys, observation: tracker.getObservation(), now: 1100 } }
}

test('synthetic landmarks preserve confidence, timestamp and mirror convention without camera access', async () => {
  const [, { HandTracker, handObservations }] = await moduleReady
  const { tracker, event } = fixture(HandTracker, handObservations)
  assert.deepEqual(event.observation.fingertips.find((tip) => tip.finger === 2),
    { side: 'right', finger: 2, t: 0.5, off: 0, confidence: 0.95, observedAt: 1000 })
  const raw = { landmarks: [tracker.hands[0].points], handedness: [[{ categoryName: 'Left', score: 0.95 }]] }
  assert.equal(handObservations(raw, 1010, true)[0].side, 'left')
  assert.equal(handObservations({ landmarks: raw.landmarks }, 1020)[0].confidence, 0)
})

for (const [hand, finger, expected] of [['right', 2, 'match'], ['right', 3, 'mismatch'], ['left', 2, 'mismatch']]) {
  test(`attributes MIDI note 61 to right index against suggested ${hand} finger ${finger}`, async () => {
    const [{ attributeFingering }, { HandTracker, handObservations }] = await moduleReady
    const { event } = fixture(HandTracker, handObservations)
    const result = attributeFingering({ ...event, note: { ...event.note, hand, finger } })
    assert.equal(result.status, expected)
    assert.deepEqual(result.observed, { side: 'right', finger: 2, confidence: 0.95, ageMs: 100 })
    assert.equal(result.affectsScore, false)
  })
}

const uncertainCases = [
  ['stale frame', (e) => { e.now = 1201 }, 'stale'],
  ['future frame', (e) => { e.now = 999 }, 'stale'],
  ['missing timestamp', (e) => { e.observation.observedAt = null }, 'stale'],
  ['old fingertip', (e) => { e.observation.fingertips[1].observedAt = 800 }, 'stale'],
  ['low confidence', (e) => { e.observation.fingertips[1].confidence = 0.79 }, 'low-confidence'],
  ['missing confidence', (e) => { delete e.observation.fingertips[1].confidence }, 'low-confidence'],
  ['missing hand', (e) => { e.observation.fingertips = [] }, 'missing-finger'],
  ['off row', (e) => { e.observation.fingertips[1].off = 0.13 }, 'missing-finger'],
  ['other key', (e) => { e.observation.fingertips[1].t = 0 }, 'missing-finger'],
  ['two fingertips', (e) => { e.observation.fingertips[2] = { ...e.observation.fingertips[1], finger: 3 } }, 'ambiguous'],
  ['two hands', (e) => { e.observation.fingertips.push({ ...e.observation.fingertips[1], side: 'left' }) }, 'ambiguous'],
  ['neighbouring keys', (e) => { e.observation.fingertips[1].t = 4 / 13 }, 'ambiguous'],
  ['paused camera', (e) => { e.observation.active = false }, 'inactive'],
  ['uncalibrated camera', (e) => { e.observation.calibrated = false }, 'uncalibrated'],
  ['missing geometry', (e) => { e.keys = [] }, 'missing-key'],
  ['missing suggestion', (e) => { e.note = null }, 'no-suggestion'],
  ['different note suggestion', (e) => { e.note.pitch = 62 }, 'wrong-note']
]

for (const [name, change, reason] of uncertainCases) {
  test(`${name} returns unknown without scoring or invented finger identity`, async () => {
    const [{ attributeFingering }, { HandTracker, handObservations }] = await moduleReady
    const { event } = fixture(HandTracker, handObservations)
    change(event)
    const before = structuredClone(event)
    const result = attributeFingering(event)
    assert.equal(result.status, 'unknown')
    assert.equal(result.reason, reason)
    assert.equal(result.observed, null)
    assert.equal(result.affectsScore, false)
    assert.equal(typeof result.statusText, 'string')
    assert.deepEqual(event, before)
  })
}

test('freshness and confidence accept their exact threshold', async () => {
  const [{ attributeFingering }, { HandTracker, handObservations }] = await moduleReady
  const { event } = fixture(HandTracker, handObservations)
  event.now = 1200
  event.observation.fingertips[1].confidence = 0.8
  assert.equal(attributeFingering(event).status, 'match')
})

test('ordinary hover projection remains available and stopping invalidates coaching', async () => {
  const [{ attributeFingering }, { HandTracker, handObservations }] = await moduleReady
  const { tracker, event } = fixture(HandTracker, handObservations)
  tracker.lastSeen = performance.now()
  assert.deepEqual(tracker.fingertipsOverKeys(), [{ side: 'right', finger: 2, t: 0.5 }])
  tracker.stop()
  assert.equal(attributeFingering({ ...event, observation: tracker.getObservation() }).reason, 'inactive')
  assert.deepEqual(tracker.fingertipsOverKeys(), [])
})
