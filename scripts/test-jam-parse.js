// Unit test for Jam session parsing rules and window limits: node scripts/test-jam-parse.js
const assert = require('node:assert/strict')

const load = (f) => import(require('node:url').pathToFileURL(require('node:path').join(__dirname, '..', 'renderer', 'jam', f)).href)

const ev = (t, dur, pitch, vel) => ({ t, dur, pitch, vel, lift: 64, g: [] })
const clipOf = (lengthBeats) => ({ lengthBeats, events: [ev(0, 1, 60, 90)] })

// A session with four slots, the first holding a loop. parse() only knows the
// { v, bpm, swing, key, scale, tracks } part of a saved session.
const validSession = (slotClip = clipOf(4), active = [0], scale = 'major') => ({
  v: 1, bpm: 100, swing: 0, key: 0, scale,
  tracks: [{
    kind: 'drum', name: 'Drums', instrument: 'kit', level: 0.8, send: 0.1, mute: false,
    slots: [slotClip, null, null, null], active
  }]
})
const withLength = (lengthBeats) => validSession(clipOf(lengthBeats))

;(async () => {
  const L = await load('looper.js')
  const S = await load('scales.js')

  // ------------------------------------------ finding 1: clip length is whole bars
  const good = L.parse(validSession())
  assert.equal(good.v, 1)
  assert.equal(good.tracks.length, 1)
  assert.equal(good.tracks[0].slots[0].lengthBeats, 4)
  assert.deepEqual(good.tracks[0].active, [0])
  for (const bars of [1, 2, 4, 8]) {
    assert.equal(L.parse(withLength(bars * 4)).tracks[0].slots[0].lengthBeats, bars * 4)
  }
  // tiny, zero, negative, off-grid, non-finite or too-long clips are rejected
  for (const len of [1e-20, 0, -4, 3, 5, NaN, Infinity, 64]) {
    assert.throws(() => L.parse(withLength(len)), undefined, `length ${len} should be rejected`)
  }

  // ------------------------------- finding 1: eventsInWindow always terminates
  assert.deepEqual(L.eventsInWindow({ lengthBeats: 1e-20, events: [ev(0, 1, 60, 90)] }, 0, 100), [])
  assert.deepEqual(L.eventsInWindow({ lengthBeats: 0, events: [ev(0, 1, 60, 90)] }, 0, 100), [])
  assert.deepEqual(L.eventsInWindow({ lengthBeats: NaN, events: [ev(0, 1, 60, 90)] }, 0, 100), [])
  assert.deepEqual(L.eventsInWindow({ lengthBeats: Infinity, events: [ev(0, 1, 60, 90)] }, 0, 100), [])
  const one = { lengthBeats: 4, events: [ev(0, 1, 60, 90)] }
  const capped = L.eventsInWindow(one, 0, 1e9)
  assert.ok(capped.length > 0 && capped.length <= 20000, `capped results: ${capped.length}`)

  // ------------------------------------------ finding 2: the active slot field
  assert.deepEqual(L.parse(validSession(clipOf(4), 0)).tracks[0].active, [0])
  assert.deepEqual(L.parse(validSession(clipOf(4), -1)).tracks[0].active, [])
  const dup = L.parse(validSession(clipOf(4), [0, 0, 0, 0]))
  assert.deepEqual(dup.tracks[0].active, [0])
  assert.ok(dup.tracks[0].active.length <= dup.tracks[0].slots.length)
  // more entries than slots, out of range, or not an integer: rejected
  assert.throws(() => L.parse(validSession(clipOf(4), [0, 0, 0, 0, 0, 0, 0, 0, 0])), undefined, 'too many active slots')
  assert.throws(() => L.parse(validSession(clipOf(4), 99)), undefined, 'active out of range')
  assert.throws(() => L.parse(validSession(clipOf(4), 'x')), undefined, 'active not a number')
  assert.throws(() => L.parse(validSession(clipOf(4), [3.5])), undefined, 'active not an integer')

  // ------------------------------------------ finding 3: inherited scale ids
  for (const id of ['constructor', 'toString', '__proto__', 'martian']) {
    assert.equal(L.parse(validSession(clipOf(4), [0], id)).scale, 'major', `${id} is not a scale`)
  }
  assert.doesNotThrow(() => S.snap(61, 0, 'constructor'))
  assert.doesNotThrow(() => S.inScale(61, 0, '__proto__'))
  assert.doesNotThrow(() => S.scalePitches(0, 'toString', 60, 72))

  console.log('jam-parse: ok')
})().catch((e) => { console.error(e); process.exit(1) })
