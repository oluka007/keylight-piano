// Unit test for the Jam engine (renderer/jam/): node scripts/test-jam-engine.js
// Pure modules: clock, looper, scales, MIDI export. No window, no sound.
const assert = require('node:assert/strict')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const load = (f) => import(pathToFileURL(path.join(__dirname, '..', 'renderer', 'jam', f)).href)

// seeded generator (mulberry32) so failures reproduce
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`)

function fakeClock(createClock, opts = {}) {
  const st = { t: 0, fn: null, ms: 0, cleared: 0 }
  const clock = createClock({
    now: () => st.t,
    setTimer: (fn, ms) => { st.fn = fn; st.ms = ms; return 7 },
    clearTimer: () => { st.cleared++; st.fn = null },
    ...opts
  })
  return { st, clock }
}

;(async () => {
  const { createClock } = await load('clock.js')
  const L = await load('looper.js')
  const S = await load('scales.js')
  const { sessionToMidi, GM_DRUMS } = await load('midi-export.js')

  // ---------------------------------------------------------------- clock
  {
    const { st, clock } = fakeClock(createClock, { bpm: 120 })
    const windows = []
    const off = clock.onWindow((w) => windows.push(w))
    assert.equal(clock.running, false)
    clock.start(1)
    assert.equal(clock.running, true)
    assert.equal(st.ms, 25)
    // before the start time nothing is due beyond the lookahead
    st.t = 0.5; st.fn()
    assert.equal(windows.length, 0)
    for (let i = 0; i < 20; i++) { st.t = 0.5 + i * 0.025; st.fn() }
    assert.ok(windows.length > 0)
    assert.equal(windows[0].fromBeat, 0)
    for (let i = 1; i < windows.length; i++) assert.equal(windows[i].fromBeat, windows[i - 1].toBeat, 'contiguous')
    for (const w of windows) assert.ok(w.toBeat > w.fromBeat)
    near(windows[windows.length - 1].toBeat, clock.beatAt(st.t + 0.12))

    // tempo change mid-run keeps the beat position continuous and windows contiguous
    const beforeBeat = clock.beatAt(st.t)
    clock.setBpm(180)
    near(clock.beatAt(st.t), beforeBeat)
    assert.equal(clock.bpm, 180)
    const n = windows.length
    for (let i = 0; i < 20; i++) { st.t += 0.025; st.fn() }
    assert.ok(windows.length > n)
    for (let i = 1; i < windows.length; i++) assert.equal(windows[i].fromBeat, windows[i - 1].toBeat, 'contiguous across tempo change')
    // beat position moves at the new rate
    near(clock.beatAt(st.t + 1) - clock.beatAt(st.t), 3)

    // a late tick: one window covers the backlog
    const m = windows.length
    st.t += 2; st.fn()
    assert.equal(windows.length, m + 1)
    const late = windows[m]
    assert.equal(late.fromBeat, windows[m - 1].toBeat)
    assert.ok(late.toBeat - late.fromBeat > 5)
    near(late.toBeat, clock.beatAt(st.t + 0.12))
    // timeOfBeat inside a window matches the clock
    near(late.timeOfBeat(late.toBeat), clock.timeOfBeat(late.toBeat))

    // beatAt / timeOfBeat are inverses
    for (const b of [0, 0.3, 7.77, 100]) near(clock.beatAt(clock.timeOfBeat(b)), b)
    for (const t of [1, 2.5, 33]) near(clock.timeOfBeat(clock.beatAt(t)), t)

    // stop / start: beat counting restarts at 0, no stale windows while stopped
    clock.stop()
    assert.equal(clock.running, false)
    assert.equal(st.cleared, 1)
    const k = windows.length
    st.t += 1
    clock.tick()
    assert.equal(windows.length, k)
    clock.start(st.t + 0.05)
    st.t += 0.1; st.fn()
    const first = windows[k]
    assert.equal(first.fromBeat, 0)
    for (let i = 0; i < 10; i++) { st.t += 0.025; st.fn() }
    for (let i = k + 1; i < windows.length; i++) assert.equal(windows[i].fromBeat, windows[i - 1].toBeat)

    // unsubscribe
    off()
    const z = windows.length
    st.t += 0.5; st.fn()
    assert.equal(windows.length, z)

    // clamping and bars
    clock.setBpm(10); assert.equal(clock.bpm, 40)
    clock.setBpm(999); assert.equal(clock.bpm, 220)
    assert.equal(clock.barOf(0), 0)
    assert.equal(clock.barOf(3.99), 0)
    assert.equal(clock.barOf(4), 1)
    assert.equal(clock.barOf(9), 2)
  }
  {
    // setBpm before start, and a stopped clock keeps the tempo
    const { clock } = fakeClock(createClock, { bpm: 100 })
    clock.setBpm(150)
    assert.equal(clock.bpm, 150)
    // swing helper
    near(clock.swing, 0)
    assert.equal(clock.swungBeat(0.25), 0.25)
    clock.swing = 0.6
    near(clock.swing, 0.6)
    assert.equal(clock.swungBeat(0), 0)
    near(clock.swungBeat(0.25), 0.25 + 0.6 * 0.125)
    assert.equal(clock.swungBeat(0.5), 0.5)
    near(clock.swungBeat(0.75), 0.75 + 0.075)
    near(clock.swungBeat(1.25), 1.25 + 0.075)
    clock.swing = 5
    near(clock.swing, 0.6)
    clock.swing = -1
    near(clock.swing, 0)
  }

  // --------------------------------------------------------------- scales
  {
    assert.deepEqual(Object.keys(S.SCALES), ['major', 'minor', 'majorPentatonic', 'minorPentatonic', 'blues', 'dorian', 'chromatic'])
    for (const id of Object.keys(S.SCALES)) {
      const iv = S.SCALES[id].intervals
      assert.equal(iv[0], 0)
      assert.deepEqual([...iv].sort((a, b) => a - b), iv)
    }
    // C major membership
    const cmaj = [0, 2, 4, 5, 7, 9, 11]
    for (let p = 36; p < 96; p++) assert.equal(S.inScale(p, 0, 'major'), cmaj.includes(p % 12))
    assert.equal(S.inScale(61, 0, 'major'), false)
    assert.equal(S.inScale(66, 6, 'major'), true)   // F# major root
    assert.equal(S.inScale(60, 6, 'major'), false)
    assert.equal(S.inScale(60, 0, 'nope'), false)
    // snap: in-scale notes stay; ties go down
    assert.equal(S.snap(61, 0, 'major'), 60)        // C# between C and D: tie goes down
    assert.equal(S.snap(63, 0, 'major'), 62)        // Eb between D and E
    assert.equal(S.snap(66, 0, 'major'), 65)        // F# between F and G
    assert.equal(S.snap(68, 0, 'major'), 67)
    assert.equal(S.snap(70, 0, 'major'), 69)
    assert.equal(S.snap(64, 0, 'major'), 64)
    assert.equal(S.snap(61, 0, 'majorPentatonic'), 60)
    assert.equal(S.snap(65, 0, 'majorPentatonic'), 64)  // F: E is 1 away, G is 2 away
    assert.equal(S.snap(66, 0, 'majorPentatonic'), 67)  // F#: G is 1 away, E is 2 away
    // all keys: snapping always lands in scale and never moves more than needed
    for (const id of Object.keys(S.SCALES)) {
      for (let key = 0; key < 12; key++) {
        for (let p = 24; p < 100; p++) {
          const q = S.snap(p, key, id)
          assert.ok(S.inScale(q, key, id), `${id} key ${key} pitch ${p}`)
          if (S.inScale(p, key, id)) assert.equal(q, p)
          // nothing nearer in scale
          for (let d = 0; d < Math.abs(q - p); d++) {
            assert.ok(!S.inScale(p - d, key, id) && !S.inScale(p + d, key, id) || d === 0 && q === p)
          }
          // tie rule: if both neighbours at the same distance are in scale, down wins
          const dist = Math.abs(q - p)
          if (dist && S.inScale(p - dist, key, id) && S.inScale(p + dist, key, id)) assert.equal(q, p - dist)
        }
      }
    }
    assert.deepEqual(S.snap(0, 1, 'chromatic'), 0)
    // scalePitches
    assert.deepEqual(S.scalePitches(0, 'major', 60, 72), [60, 62, 64, 65, 67, 69, 71, 72])
    assert.deepEqual(S.scalePitches(9, 'minorPentatonic', 57, 69), [57, 60, 62, 64, 67, 69])
    assert.equal(S.scalePitches(0, 'chromatic', 60, 71).length, 12)
    assert.deepEqual(S.scalePitches(0, 'major', 61, 61), [])
  }

  // --------------------------------------------------------------- looper
  {
    const bars = (span) => L.lengthBarsFor(span * 4, 4)
    assert.equal(bars(0.9), 1)
    assert.equal(bars(0.1), 1)
    assert.equal(bars(1), 1)
    assert.equal(bars(1.2), 1)
    assert.equal(bars(1.25), 1)
    assert.equal(bars(1.3), 2)
    assert.equal(bars(2), 2)
    assert.equal(bars(2.2), 2)
    assert.equal(bars(2.3), 4)
    assert.equal(bars(3.1), 4)
    assert.equal(bars(4), 4)
    assert.equal(bars(4.2), 4)
    assert.equal(bars(4.3), 8)
    assert.equal(bars(7), 8)
    assert.equal(bars(8.2), 8)
    assert.equal(bars(9), 8)
    assert.equal(bars(40), 8)
    assert.equal(L.lengthBarsFor(7.2 * 3, 3), 8)    // bars of other metres

    const lp = L.createLooper()
    const record = (spanBars, notes, opts, onto) => {
      lp.beginTake({ startBeat: 8, overdubOnto: onto || null })
      for (const [id, p, v, on, off, gs] of notes) {
        lp.takeNoteOn(id, p, v, 8 + on)
        for (const [k, val, at] of gs || []) lp.takeGesture(id, k, val, 8 + at)
        if (off !== null) lp.takeNoteOff(id, 40, 8 + off)
      }
      return lp.endTake(8 + spanBars * 4, opts)
    }

    let clip = record(0.9, [['a', 60, 100, 0.5, 1.5]])
    assert.equal(clip.lengthBeats, 4)
    clip = record(1.3, [['a', 60, 100, 0.5, 1.5]])
    assert.equal(clip.lengthBeats, 8)
    clip = record(9, [['a', 60, 100, 0.5, 1.5]])
    assert.equal(clip.lengthBeats, 32)
    assert.equal(clip.events[0].t, 0.5)
    assert.equal(clip.events[0].dur, 1)
    assert.equal(clip.events[0].lift, 40)
    assert.equal(clip.events[0].vel, 100)

    // wrap of event times past the length
    clip = record(1, [['a', 60, 90, 0.5, 1], ['b', 62, 90, 4.5, 5], ['c', 64, 90, 9, 9.5]])
    assert.equal(clip.lengthBeats, 4)
    assert.deepEqual(clip.events.map((e) => e.t), [0.5, 0.5, 1])
    for (const e of clip.events) assert.ok(e.t >= 0 && e.t < clip.lengthBeats)

    // a note held at the end is closed there
    clip = record(1, [['a', 60, 90, 3, null]])
    assert.equal(clip.events.length, 1)
    near(clip.events[0].dur, 1)
    assert.equal(clip.events[0].lift, 64)
    // unmatched note-off and gestures for unknown ids are ignored
    lp.beginTake({ startBeat: 0 })
    lp.takeNoteOff('zz', 10, 1)
    lp.takeGesture('zz', 'bend', 1, 1)
    assert.equal(lp.endTake(4).events.length, 0)
    assert.throws(() => lp.endTake(4))

    // quantise on and off
    const notes = [['a', 60, 100, 0.1, 0.12], ['b', 62, 100, 1.4, 1.5], ['c', 64, 100, 2.9, 3.2]]
    clip = record(1, notes)
    near(clip.events[0].t, 0.1)
    near(clip.events[1].t, 1.4)
    clip = record(1, notes, { quantise: 0.25 })
    assert.deepEqual(clip.events.map((e) => e.t), [0, 1.5, 3])
    assert.ok(clip.events.every((e) => e.dur >= 0.125))
    clip = record(1, [['a', 60, 100, 3.95, 4]], { quantise: 0.5 })
    assert.equal(clip.events[0].t, 0)               // rounds up to the loop point and wraps
    clip = record(1, [['a', 60, 100, 0.8, 1.2]], { quantise: 0.5 })
    assert.equal(clip.events[0].t, 1)

    // overdub keeps length, merges both event sets, does not mutate the original
    const base = record(2, [['a', 60, 100, 0, 1], ['b', 64, 100, 4, 5]])
    assert.equal(base.lengthBeats, 8)
    const frozen = JSON.stringify(base)
    const over = record(1, [['x', 72, 80, 2, 3]], {}, base)
    assert.equal(over.lengthBeats, 8)
    assert.equal(over.events.length, 3)
    assert.deepEqual(over.events.map((e) => e.pitch), [60, 72, 64])
    assert.equal(JSON.stringify(base), frozen)
    over.events[0].g.push({ dt: 0, k: 'press', v: 1 })
    assert.equal(JSON.stringify(base), frozen)

    // gesture thinning
    const bends = []
    for (let i = 0; i < 100; i++) bends.push(['bend', 0.01 * i, 1 + i * 0.001])
    clip = record(1, [['a', 60, 100, 1, 2, bends]])
    const g = clip.events[0].g
    assert.ok(g.length < 100 && g.length >= 1)
    assert.deepEqual(g[0], { dt: 0, k: 'bend', v: 0 })
    // far apart in time: all kept; big changes: all kept
    clip = record(1, [['a', 60, 100, 0, 3, [['press', 0.1, 0.5], ['press', 0.1, 1.0], ['press', 0.5, 1.001], ['slide', 0.5, 1.001]]]])
    assert.equal(clip.events[0].g.length, 4)
    // same kind close in time with a tiny change is dropped, other kinds are separate
    clip = record(1, [['a', 60, 100, 0, 3, [['press', 0.5, 1], ['press', 0.505, 1.001], ['slide', 0.5, 1.001], ['bend', 0.02, 1.002], ['bend', 0.04, 1.003]]]])
    assert.deepEqual(clip.events[0].g.map((x) => x.k), ['press', 'slide', 'bend'])
    clip = record(1, [['a', 60, 100, 0, 3, [['bend', 0, 1], ['bend', 0.3, 1.001]]]])   // 0.3 semitones is a real change
    assert.equal(clip.events[0].g.length, 2)
    // gestures are relative to the note start
    clip = record(1, [['a', 60, 100, 1, 3, [['slide', 0.4, 1.5]]]])
    near(clip.events[0].g[0].dt, 0.5)

    // eventsInWindow
    const loop = { lengthBeats: 4, events: [
      { t: 0, dur: 1, pitch: 60, vel: 90, lift: 64, g: [] },
      { t: 1.5, dur: 1, pitch: 62, vel: 90, lift: 64, g: [] },
      { t: 3.75, dur: 0.25, pitch: 64, vel: 90, lift: 64, g: [] }
    ] }
    let r = lp.eventsInWindow(loop, 1, 2)
    assert.deepEqual(r.map((x) => [x.event.pitch, x.beat]), [[62, 1.5]])
    r = lp.eventsInWindow(loop, 3.5, 4.5)                       // crosses the loop point
    assert.deepEqual(r.map((x) => [x.event.pitch, x.beat]), [[64, 3.75], [60, 4]])
    r = lp.eventsInWindow(loop, 2, 14)                          // longer than the clip
    assert.equal(r.length, 9)
    assert.deepEqual(r.map((x) => x.beat), [3.75, 4, 5.5, 7.75, 8, 9.5, 11.75, 12, 13.5])
    // half open on the boundary
    assert.equal(lp.eventsInWindow(loop, 0, 1.5).length, 1)
    assert.equal(lp.eventsInWindow(loop, 1.5, 3).length, 1)
    assert.equal(lp.eventsInWindow(loop, 4, 4).length, 0)
    assert.equal(lp.eventsInWindow(loop, 5, 4).length, 0)
    assert.equal(lp.eventsInWindow({ lengthBeats: 4, events: [] }, 0, 100).length, 0)
    r = lp.eventsInWindow(loop, 400, 404)
    assert.deepEqual(r.map((x) => x.beat), [400, 401.5, 403.75])

    // sweep: random consecutive windows never return an event twice or miss one
    const rand = rng(12345)
    for (const len of [4, 8, 16, 32]) {
      const evs = []
      const count = 1 + Math.floor(rand() * 60)
      for (let i = 0; i < count; i++) {
        const q = rand() < 0.5
        const t = q ? Math.floor(rand() * len * 4) / 4 : rand() * len
        evs.push({ t: Math.min(t, len - 1e-6), dur: 0.5, pitch: i, vel: 90, lift: 64, g: [] })
      }
      evs.push({ t: 0, dur: 1, pitch: 100, vel: 90, lift: 64, g: [] })
      const c = { lengthBeats: len, events: evs }
      let pos = rand() * 3
      const start = pos
      const seen = new Set()
      let returned = 0
      for (let w = 0; w < 400; w++) {
        const kind = rand()
        let size = kind < 0.2 ? len * Math.ceil(rand() * 3) : kind < 0.4 ? 0.25 * Math.ceil(rand() * 8) : rand() * len * 1.7 + 1e-3
        const end = pos + size
        for (const { event, beat } of lp.eventsInWindow(c, pos, end)) {
          assert.ok(beat >= pos && beat < end)
          const key = `${event.pitch}@${beat}`
          assert.ok(!seen.has(key), `duplicate ${key}`)
          seen.add(key)
          returned++
        }
        pos = end
      }
      let expected = 0
      for (let k = Math.floor(start / len) - 1; k <= Math.ceil(pos / len) + 1; k++) {
        for (const e of evs) { const b = k * len + e.t; if (b >= start && b < pos) expected++ }
      }
      assert.equal(returned, expected, `sweep count for length ${len}`)
    }

    // undo depth
    const u = L.createLooper()
    assert.equal(u.popUndo('t0:0'), null)
    for (let i = 0; i < 12; i++) u.pushUndo('t0:0', { lengthBeats: 4, events: [], id: i })
    assert.equal(u.undoDepth('t0:0'), 8)
    assert.equal(u.popUndo('t0:0').id, 11)
    assert.equal(u.undoDepth('t0:0'), 7)
    for (let i = 0; i < 6; i++) u.popUndo('t0:0')
    assert.equal(u.popUndo('t0:0').id, 4)
    assert.equal(u.popUndo('t0:0'), null)
    u.pushUndo('other', { lengthBeats: 4, events: [], id: 'x' })
    assert.equal(u.undoDepth('t0:0'), 0)
    assert.equal(u.undoDepth('other'), 1)

    // drum step grid
    let d = { lengthBeats: 4, events: [] }
    d = L.toggleStep(d, 0, 0)
    d = L.toggleStep(d, 0, 8, 120)
    d = L.toggleStep(d, 2, 3)
    let grid = L.gridFromClip(d)
    assert.equal(grid.length, 8)
    assert.equal(grid[0].length, 16)
    assert.equal(grid[0][0], 100)
    assert.equal(grid[0][8], 120)
    assert.equal(grid[2][3], 100)
    assert.equal(grid[1].reduce((a, b) => a + b, 0), 0)
    assert.equal(d.events.find((e) => e.pitch === 2).t, 0.75)
    d = L.toggleStep(d, 0, 0)
    assert.equal(L.gridFromClip(d)[0][0], 0)
    assert.equal(d.events.length, 2)
    const d2 = { lengthBeats: 8, events: [] }
    const d3 = L.toggleStep(d2, 1, 20)
    assert.equal(d2.events.length, 0)
    grid = L.gridFromClip(d3)
    assert.equal(grid[1].length, 32)
    assert.equal(grid[1][20], 100)
    assert.equal(d3.events[0].t, 5)
    assert.equal(L.gridFromClip(d3, 8)[1].length, 16)
    assert.equal(L.gridFromClip({ lengthBeats: 4, events: [{ t: 1, dur: 0, pitch: 9, vel: 90, lift: 64, g: [] }] })[0][4], 0)

    // serialise / parse
    const clipA = { lengthBeats: 8, events: [
      { t: 0, dur: 1, pitch: 60, vel: 100, lift: 64, g: [{ dt: 0, k: 'bend', v: 0.5 }, { dt: 0.5, k: 'press', v: 0.7 }] },
      { t: 4, dur: 0.5, pitch: 67, vel: 70, lift: 20, g: [] }
    ] }
    const session = { bpm: 96, swing: 0.2, key: 7, scale: 'dorian', tracks: [
      { kind: 'drum', name: 'Drums', instrument: 'kit', level: 0.7, send: 0.1, mute: false, slots: [{ lengthBeats: 4, events: [] }, null, null, null], active: [0] },
      { kind: 'inst', name: 'Lead', instrument: 'lead', level: 0.8, send: 0.3, mute: true, slots: [clipA, null, null, null], active: [0] }
    ] }
    const text = L.serialise(session)
    assert.equal(typeof text, 'string')
    const back = L.parse(text)
    assert.equal(back.v, 1)
    assert.deepEqual(back, JSON.parse(JSON.stringify({ v: 1, ...session })))
    assert.deepEqual(L.parse(L.serialise(back)), back)
    assert.deepEqual(L.parse(JSON.parse(text)), back)

    // clamping
    const wild = JSON.parse(text)
    wild.bpm = 900; wild.swing = 3; wild.key = 14; wild.scale = 'martian'
    wild.tracks[1].level = 9
    wild.tracks[1].slots[0].events[0].vel = 500
    wild.tracks[1].slots[0].events[0].pitch = -5
    wild.tracks[1].slots[0].events[1].t = 99
    const clamped = L.parse(wild)
    assert.equal(clamped.bpm, 220)
    assert.equal(clamped.swing, 0.6)
    assert.equal(clamped.key, 2)
    assert.equal(clamped.scale, 'major')
    assert.equal(clamped.tracks[1].level, 1)
    assert.equal(clamped.tracks[1].slots[0].events.find((e) => e.pitch === 0).vel, 127)
    assert.ok(clamped.tracks[1].slots[0].events.every((e) => e.t >= 0 && e.t < 8))

    // malformed input is rejected
    const bad = (mutate, why) => {
      const o = JSON.parse(text)
      mutate(o)
      assert.throws(() => L.parse(JSON.stringify(o)), undefined, why)
    }
    assert.throws(() => L.parse('not json'))
    assert.throws(() => L.parse(''))
    assert.throws(() => L.parse('null'))
    assert.throws(() => L.parse('[]'))
    assert.throws(() => L.parse(42))
    bad((o) => { o.v = 2 }, 'wrong version')
    bad((o) => { delete o.v }, 'no version')
    bad((o) => { o.tracks = {} }, 'tracks not an array')
    bad((o) => { o.tracks = 'x' }, 'tracks string')
    bad((o) => { o.bpm = 'fast' }, 'bpm string')
    bad((o) => { o.bpm = null }, 'bpm null')
    bad((o) => { o.tracks[1].slots[0].lengthBeats = -4 }, 'negative length')
    bad((o) => { o.tracks[1].slots[0].lengthBeats = 0 }, 'zero length')
    bad((o) => { o.tracks[1].slots[0].events = 'x' }, 'events not array')
    bad((o) => { o.tracks[1].slots[0].events[0].pitch = 'C4' }, 'pitch string')
    bad((o) => { o.tracks[1].slots[0].events[0].t = null }, 'null time')
    bad((o) => { o.tracks[1].slots[0].events[0].g[0].k = 'wobble' }, 'bad gesture kind')
    bad((o) => { o.tracks[1].slots[0].events[0] = 5 }, 'event not object')
    bad((o) => { o.tracks[1].slots = 'x' }, 'slots not array')
    bad((o) => { o.tracks.length = 0; for (let i = 0; i < 40; i++) o.tracks.push({ slots: [] }) }, 'too many tracks')
    bad((o) => {
      o.tracks[1].slots[0].events = Array.from({ length: 4001 }, (_, i) => ({ t: i % 8, dur: 0.1, pitch: 60, vel: 90, lift: 64, g: [] }))
    }, 'huge event array')
    // NaN cannot survive JSON, so test it on a parsed object
    const nan = JSON.parse(text)
    nan.tracks[1].slots[0].events[0].t = NaN
    assert.throws(() => L.parse(nan))
    const inf = JSON.parse(text)
    inf.bpm = Infinity
    assert.throws(() => L.parse(inf))
    const ok4000 = JSON.parse(text)
    ok4000.tracks[1].slots[0].events = Array.from({ length: 4000 }, (_, i) => ({ t: i % 8, dur: 0.1, pitch: 60, vel: 90, lift: 64, g: [] }))
    assert.equal(L.parse(ok4000).tracks[1].slots[0].events.length, 4000)
    // the take itself never exceeds the cap
    const cap = L.createLooper()
    cap.beginTake({ startBeat: 0 })
    for (let i = 0; i < 4100; i++) { cap.takeNoteOn(i, 60, 90, 0.001 * i); cap.takeNoteOff(i, 64, 0.001 * i + 0.0005) }
    assert.equal(cap.endTake(4).events.length, 4000)
  }

  // ------------------------------------------------------------ MIDI export
  {
    // minimal SMF reader for the checks
    function readSmf(bytes) {
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      let p = 0
      const str = (n) => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(dv.getUint8(p++)); return s }
      assert.equal(str(4), 'MThd')
      assert.equal(dv.getUint32(p), 6); p += 4
      const format = dv.getUint16(p); p += 2
      const ntracks = dv.getUint16(p); p += 2
      const division = dv.getUint16(p); p += 2
      const tracks = []
      for (let t = 0; t < ntracks; t++) {
        assert.equal(str(4), 'MTrk')
        const len = dv.getUint32(p); p += 4
        const end = p + len
        const out = { name: '', notes: [], offs: [], tempos: [], bends: [], pressure: [], cc: [], ended: false }
        let tick = 0
        let status = 0
        const open = new Map()
        while (p < end) {
          let d = 0, b
          do { b = dv.getUint8(p++); d = d * 128 + (b & 127) } while (b & 128)
          tick += d
          let s = dv.getUint8(p)
          if (s & 128) { status = s; p++ } else s = status
          if (s === 0xff) {
            const type = dv.getUint8(p++)
            const n = dv.getUint8(p++)
            if (type === 0x51) out.tempos.push({ tick, us: (dv.getUint8(p) << 16) | (dv.getUint8(p + 1) << 8) | dv.getUint8(p + 2) })
            if (type === 0x03) { let nm = ''; for (let i = 0; i < n; i++) nm += String.fromCharCode(dv.getUint8(p + i)); out.name = nm }
            if (type === 0x2f) out.ended = true
            p += n
            continue
          }
          const hi = s & 0xf0, ch = s & 15
          if (hi === 0x90 || hi === 0x80) {
            const key = dv.getUint8(p++), vel = dv.getUint8(p++)
            if (hi === 0x90 && vel > 0) {
              const note = { tick, ch, key, vel, end: null, lift: null }
              out.notes.push(note)
              const stack = open.get(ch * 128 + key) || []
              stack.push(note); open.set(ch * 128 + key, stack)
            } else {
              const stack = open.get(ch * 128 + key)
              assert.ok(stack && stack.length, 'note off without note on')
              const note = stack.shift()
              note.end = tick; note.lift = vel
              out.offs.push(tick)
            }
          } else if (hi === 0xe0) { const lo = dv.getUint8(p++), hv = dv.getUint8(p++); out.bends.push({ tick, ch, v: lo | (hv << 7) }) }
          else if (hi === 0xd0) out.pressure.push({ tick, ch, v: dv.getUint8(p++) })
          else if (hi === 0xb0) { const c = dv.getUint8(p++), v = dv.getUint8(p++); out.cc.push({ tick, ch, c, v }) }
          else throw new Error(`unexpected status ${s.toString(16)}`)
        }
        assert.equal(p, end)
        assert.ok(out.ended, 'track ends with end-of-track')
        for (const n of out.notes) assert.notEqual(n.end, null, 'every note is closed')
        tracks.push(out)
      }
      assert.equal(p, bytes.byteLength)
      return { format, division, tracks }
    }

    const ev = (t, dur, pitch, vel, lift = 64, g = []) => ({ t, dur, pitch, vel, lift, g })
    const lead = { lengthBeats: 8, events: [
      ev(0, 1, 60, 100, 30, [{ dt: 0, k: 'bend', v: 0 }, { dt: 0.5, k: 'bend', v: 2 }, { dt: 0.75, k: 'press', v: 1 }, { dt: 0.25, k: 'slide', v: 0.5 }]),
      ev(2, 0.5, 64, 80, 90),
      ev(7.5, 0.5, 67, 60)
    ] }
    const lead2 = { lengthBeats: 4, events: [ev(1, 1, 72, 90)] }
    const unused = { lengthBeats: 4, events: [ev(0, 1, 50, 90)] }
    const drums = { lengthBeats: 4, events: [ev(0, 0, 0, 110), ev(1, 0, 1, 100), ev(1.5, 0, 2, 70), ev(2, 0, 3, 70), ev(2.5, 0, 4, 90), ev(3, 0, 5, 90), ev(3.25, 0, 6, 90), ev(3.5, 0, 7, 90)] }
    const session = { bpm: 90, swing: 0, key: 0, scale: 'major', tracks: [
      { kind: 'drum', name: 'Drums', slots: [drums, null, null, null], active: [0] },
      { kind: 'inst', name: 'Lead', slots: [lead, lead2, unused, null], active: [0, 1] },
      { kind: 'inst', name: 'Bass', slots: [{ lengthBeats: 4, events: [ev(0.5, 1, 36, 100)] }, null, null, null], active: 0 },
      { kind: 'inst', name: 'Pad', slots: [unused, null, null, null], active: [] }
    ] }
    const bytes = sessionToMidi(session)
    assert.ok(bytes instanceof Uint8Array)
    const smf = readSmf(bytes)
    assert.equal(smf.format, 1)
    assert.equal(smf.division, 480)
    assert.equal(smf.tracks.length, 5)
    assert.deepEqual(smf.tracks[0].tempos, [{ tick: 0, us: Math.round(60000000 / 90) }])
    assert.equal(smf.tracks[0].notes.length, 0)

    const [, dr, ld, bs, pd] = smf.tracks
    // drums: channel 9, GM notes, vel from the clip
    assert.equal(dr.notes.length, 8)
    assert.deepEqual(dr.notes.map((n) => n.key), GM_DRUMS)
    assert.deepEqual(GM_DRUMS, [36, 38, 42, 46, 39, 45, 50, 37])
    assert.ok(dr.notes.every((n) => n.ch === 9))
    assert.deepEqual(dr.notes.map((n) => n.tick), [0, 480, 720, 960, 1200, 1440, 1560, 1680])
    assert.equal(dr.notes[0].vel, 110)
    assert.ok(dr.notes.every((n) => n.end > n.tick))
    assert.equal(dr.bends.length, 0)

    // lead: two clips back to back, one pass each, channel 0
    assert.equal(ld.name, 'Lead')
    assert.equal(ld.notes.length, 4)
    assert.deepEqual(ld.notes.map((n) => n.key), [60, 64, 67, 72])
    assert.deepEqual(ld.notes.map((n) => n.tick), [0, 960, 3600, 8 * 480 + 480])
    assert.deepEqual(ld.notes.map((n) => n.end - n.tick), [480, 240, 240, 480])
    assert.deepEqual(ld.notes.map((n) => n.vel), [100, 80, 60, 90])
    assert.deepEqual(ld.notes.map((n) => n.lift), [30, 90, 64, 64])
    assert.ok(ld.notes.every((n) => n.ch === 0))
    // bend: RPN 0 = 48 at the start, bends scaled to 48 semitones
    const rpn = ld.cc.filter((c) => c.tick === 0 && [101, 100, 6, 38].includes(c.c))
    assert.deepEqual(rpn.map((c) => [c.c, c.v]), [[101, 0], [100, 0], [6, 48], [38, 0]])
    const noteBends = ld.bends.filter((b) => b.tick < 480)
    assert.deepEqual(noteBends.map((b) => [b.tick, b.v]), [[0, 8192], [240, Math.round(8192 + 2 / 48 * 8192)]])
    assert.ok(ld.bends.some((b) => b.tick === 480 && b.v === 8192), 'bend centred at note end')
    // pressure and slide are put back to rest when the note ends, so the next note starts clean
    assert.deepEqual(ld.pressure, [{ tick: 360, ch: 0, v: 127 }, { tick: 480, ch: 0, v: 0 }])
    assert.deepEqual(ld.cc.filter((c) => c.c === 74), [{ tick: 120, ch: 0, c: 74, v: 64 }, { tick: 480, ch: 0, c: 74, v: 64 }])
    // a track with no bends has no RPN
    assert.equal(bs.cc.length, 0)
    assert.equal(bs.notes.length, 1)
    assert.equal(bs.notes[0].ch, 1)
    assert.equal(bs.notes[0].tick, 240)
    assert.equal(bs.name, 'Bass')
    // no active clips: no notes
    assert.equal(pd.notes.length, 0)
    assert.equal(pd.name, 'Pad')

    // round trip through the looper: a recorded take exports the same notes
    const lp = L.createLooper()
    lp.beginTake({ startBeat: 0 })
    lp.takeNoteOn('a', 60, 100, 0.5); lp.takeNoteOff('a', 50, 1.5)
    lp.takeNoteOn('b', 64, 70, 2); lp.takeNoteOff('b', 70, 2.25)
    const clip = lp.endTake(4)
    const out = readSmf(sessionToMidi({ bpm: 120, tracks: [{ kind: 'inst', name: 'x', slots: [clip] }] }))
    assert.deepEqual(out.tracks[1].notes.map((n) => [n.key, n.tick, n.end - n.tick]), [[60, 240, 480], [64, 960, 120]])
    assert.deepEqual(out.tracks[0].tempos, [{ tick: 0, us: 500000 }])
    // an empty session is still a valid file
    const empty = readSmf(sessionToMidi({ bpm: 120, tracks: [] }))
    assert.equal(empty.tracks.length, 1)
    // parse -> export works end to end
    readSmf(sessionToMidi(L.parse(L.serialise(session))))
  }

  console.log('Jam engine tests passed')
})().catch((e) => { console.error(e); process.exit(1) })
