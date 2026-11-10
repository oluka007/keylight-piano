// Unit test for the Jam session logic (renderer/jam/session.js): node scripts/test-jam-session.js
const assert = require('node:assert/strict')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const load = (f) => import(pathToFileURL(path.join(__dirname, '..', 'renderer', 'jam', f)).href)

async function main() {
  const S = await load('session.js')
  const L = await load('looper.js')
  const sc = await load('scales.js')

  // every state must survive looper.serialise -> parse unchanged, and our own save/load
  const roundTrip = (s, why) => {
    const st = s.get()
    const data = S.dataOf(st)
    const back = L.parse(L.serialise(data))
    assert.deepEqual(back, { v: 1, ...JSON.parse(JSON.stringify(data)) }, `looper round trip: ${why}`)
    const again = S.loadSession(S.saveSession(st))
    assert.deepEqual(S.dataOf(again), JSON.parse(JSON.stringify(data)), `session round trip: ${why}`)
    assert.deepEqual(again.prefs, st.prefs, `prefs round trip: ${why}`)
  }

  // ---- default session
  {
    const s = S.createSession()
    const st = s.get()
    assert.equal(st.tracks.length, 4)
    assert.deepEqual(st.tracks.map((t) => t.kind), ['drum', 'inst', 'inst', 'inst'])
    assert.ok(st.tracks[0].slots[0].events.length > 8, 'starter beat')
    assert.deepEqual(st.tracks[0].active, [0])
    assert.equal(st.playing, false)
    roundTrip(s, 'default')
  }

  // ---- bad stored data falls back to the default session
  for (const bad of ['', 'not json', '{"v":2}', null, 42, { v: 1, bpm: 'x', tracks: [] }, { v: 1, bpm: 100, tracks: [] },
    { v: 1, bpm: 100, tracks: [{ kind: 'inst', slots: [] }, { kind: 'inst' }, { kind: 'inst' }, { kind: 'inst' }] }]) {
    const s = S.createSession(bad)
    assert.deepEqual(S.dataOf(s.get()), S.dataOf(S.defaultState()), `bad: ${JSON.stringify(bad)}`)
  }
  {
    // good data is kept, numbers clamped, prefs checked separately
    const s = S.createSession()
    s.setBpm(133); s.setKey(9); s.setScale('minor'); s.setScaleLock(true); s.setQuantise(0.5)
    const s2 = S.createSession(s.serialise())
    assert.equal(s2.get().bpm, 133)
    assert.equal(s2.get().key, 9)
    assert.equal(s2.get().scale, 'minor')
    assert.equal(s2.get().prefs.scaleLock, true)
    assert.equal(s2.get().prefs.quantise, 0.5)
    const hacked = JSON.parse(s.serialise())
    hacked.prefs = { quantise: 7, delay: 'lots', track: 99, scaleLock: 'yes' }
    hacked.bpm = 9999
    const s3 = S.createSession(hacked)
    assert.equal(s3.get().bpm, 220)
    assert.equal(s3.get().prefs.quantise, 0.25)
    assert.equal(s3.get().prefs.track, 2)
    assert.equal(s3.get().prefs.scaleLock, false)
  }

  // ---- simple setters clamp and validate
  {
    const s = S.createSession()
    s.setBpm(5); assert.equal(s.get().bpm, 40)
    s.setBpm(900); assert.equal(s.get().bpm, 220)
    s.setSwing(2); assert.equal(s.get().swing, 0.6)
    s.setKey(-1); assert.equal(s.get().key, 11)
    s.setScale('nope'); assert.equal(s.get().scale, 'major')
    s.setScale('toString'); assert.equal(s.get().scale, 'major')
    s.setScale('blues'); assert.equal(s.get().scale, 'blues')
    s.setQuantise(0.3); assert.equal(s.get().prefs.quantise, 0.25)
    s.setTrackLevel(1, 3); assert.equal(s.get().tracks[1].level, 1)
    s.setTrackSend(1, -1); assert.equal(s.get().tracks[1].send, 0)
    s.setTrackMute(1, true); assert.equal(s.get().tracks[1].mute, true)
    assert.equal(s.setTrackInstrument(0, 'bass'), false, 'drums have no instrument')
    assert.equal(s.setTrackInstrument(3, 'pad'), true)
    assert.equal(s.get().tracks[3].instrument, 'pad')
    s.selectTrack(7); assert.equal(s.get().prefs.track, 2)
    s.selectSlot(1, 3); assert.deepEqual([s.get().prefs.track, s.get().prefs.slots[1]], [1, 3])
    roundTrip(s, 'setters')
  }

  // ---- drum key mapping
  assert.deepEqual([60, 62, 64, 65, 67, 69, 71, 72].map(S.drumForPitch), [0, 1, 2, 3, 4, 5, 6, 7])
  assert.equal(S.drumForPitch(48), 0)
  assert.equal(S.drumForPitch(84), 0)
  assert.equal(S.drumForPitch(61), -1)

  // ---- subscribe
  {
    const s = S.createSession()
    let n = 0
    const off = s.subscribe(() => n++)
    s.setBpm(120)
    assert.equal(n, 1)
    off(); s.setBpm(121)
    assert.equal(n, 1)
  }

  // helper: play notes into a take at given beats
  const note = (s, beat, pitch, len = 0.5, track = s.get().rec.track) => {
    s.recNoteOn(track, `0:${pitch}`, pitch, 100, beat)
    s.recNoteOff(track, `0:${pitch}`, 64, beat + len)
  }

  // ---- record while running: armed -> recording at next bar line -> ends on a bar line
  {
    const s = S.createSession()
    s.setQuantise(0)
    s.setPlaying(true)
    s.onBar(0)
    assert.equal(s.armRecord(2, 0), true)
    assert.equal(s.get().rec.phase, 'armed')
    note(s, 2, 60) // before the take starts: not recorded
    s.onBar(4)
    assert.equal(s.get().rec.phase, 'recording')
    assert.equal(s.get().announce.text, 'Recording')
    assert.equal(s.get().rec.startBeat, 4)
    note(s, 4, 60)
    note(s, 5, 64)
    note(s, 6.5, 67)
    s.stopRecord()
    assert.equal(s.get().rec.phase, 'stopping')
    note(s, 7, 72) // still recorded until the bar line
    s.onBar(8)
    assert.equal(s.get().rec.phase, 'closing')
    // late note played just before the bar line, after the engine looked ahead
    s.recNoteOn(2, '0:48', 48, 100, 7.9)
    s.recNoteOff(2, '0:48', 64, 8.1)
    s.recNoteOn(2, '0:50', 50, 100, 8.05) // after the bar line: not part of the take
    s.settle(8.01)
    assert.equal(s.get().rec.phase, 'idle')
    const clip = s.get().tracks[2].slots[0]
    assert.ok(clip)
    assert.equal(clip.lengthBeats, 4)
    assert.deepEqual(clip.events.map((e) => e.pitch).sort((a, b) => a - b), [48, 60, 64, 67, 72])
    assert.ok(!clip.events.some((e) => e.pitch === 50))
    const late = clip.events.find((e) => e.pitch === 48)
    assert.ok(late.t > 3.8 && late.t < 4, 'the early note lands just before the loop point')
    assert.deepEqual(s.get().tracks[2].active, [0])
    assert.match(s.get().announce.text, /^Loop saved, 1 bar$/)
    roundTrip(s, 'record running')
  }

  // ---- a loop recorded in later bars keeps its place (two-bar loop started on an odd bar)
  {
    const s = S.createSession()
    s.setQuantise(0)
    s.setPlaying(true)
    s.armRecord(1, 1)
    s.onBar(4)
    note(s, 4, 40)
    note(s, 8, 43)
    s.stopRecord()
    s.onBar(12)
    s.settle(12)
    const clip = s.get().tracks[1].slots[1]
    assert.equal(clip.lengthBeats, 8, 'two bars')
    s.setPlaying(false)
    // played from global beat 0 the loop puts bar 1 of the take at 4 mod 8
    assert.deepEqual(clip.events.map((e) => [e.pitch, e.t]), [[43, 0], [40, 4]])
    roundTrip(s, 'two bars')
  }

  // ---- arming while stopped: a one-bar count-in, recording starts at bar 1
  {
    const s = S.createSession()
    assert.equal(s.armRecord(3, 0), true)
    assert.equal(s.get().rec.skip, 1)
    s.setPlaying(true)
    assert.equal(s.get().rec.phase, 'armed')
    s.onBar(0)
    assert.equal(s.get().rec.phase, 'armed', 'beat 0 is the count-in')
    s.onBar(4)
    assert.equal(s.get().rec.phase, 'recording')
    assert.equal(s.get().rec.startBeat, 4)
    // stop mid-take: ends at once
    note(s, 5, 72, 1)
    s.setPlaying(false, 6)
    assert.equal(s.get().rec.phase, 'idle')
    const clip = s.get().tracks[3].slots[0]
    assert.ok(clip && clip.events.length === 1)
    assert.equal(clip.lengthBeats, 4)
    assert.equal(s.get().playing, false)
    roundTrip(s, 'stop mid take')
  }

  // ---- armed then stopped: cancelled; empty takes are discarded
  {
    const s = S.createSession()
    s.armRecord(2, 1)
    s.setPlaying(true); s.setPlaying(false)
    assert.equal(s.get().rec.phase, 'idle')
    assert.equal(s.get().tracks[2].slots[1], null)
    s.armRecord(2, 1)
    assert.equal(s.cancelArm(), true)
    assert.equal(s.cancelArm(), false)
    s.setPlaying(true)
    s.armRecord(2, 1)
    s.onBar(4)
    s.stopRecord()
    s.onBar(8)
    s.settle(8)
    assert.equal(s.get().tracks[2].slots[1], null, 'nothing played, nothing saved')
    assert.equal(s.get().announce.text, 'Nothing recorded')
    assert.equal(s.get().canUndo, false)
  }

  // ---- other record rules
  {
    const s = S.createSession()
    s.setPlaying(true)
    assert.equal(s.armRecord(9, 0), false)
    s.armRecord(1, 0)
    assert.equal(s.stopRecord(), true, 'stop on an armed take cancels it')
    assert.equal(s.get().rec.phase, 'idle')
    s.armRecord(1, 0); s.onBar(4)
    assert.equal(s.armRecord(1, 1), false, 'cannot arm during a take')
    // gestures are recorded
    s.recNoteOn(1, 'a', 50, 90, 4)
    s.recGesture(1, 'a', 'bend', 1.5, 4.2)
    s.recGesture(1, 'a', 'press', 0.7, 4.4)
    s.recNoteOff(1, 'a', 90, 5)
    s.recNoteOn(2, 'b', 52, 90, 5) // another track: ignored
    s.stopRecord(); s.onBar(8); s.settle(8)
    const e = s.get().tracks[1].slots[0].events
    assert.equal(e.length, 1)
    assert.deepEqual(e[0].g.map((g) => g.k), ['bend', 'press'])
    assert.equal(e[0].lift, 90)
    roundTrip(s, 'gestures')
  }

  // ---- notes played just before the bar line (while still armed) join the take
  {
    const s = S.createSession()
    s.setQuantise(0)
    s.setPlaying(true)
    s.armRecord(1, 0)
    note(s, 2, 40)          // a whole bar early: not part of it
    note(s, 3.9, 45, 0.3)   // a hair early (0.1 beat): part of it, at the very start
    s.recNoteOn(1, 'h', 50, 100, 3.95)   // still held when the take starts
    s.onBar(4)
    s.recNoteOff(1, 'h', 64, 4.5)
    note(s, 5, 52)
    s.stopRecord(); s.onBar(8); s.settle(8)
    const e = s.get().tracks[1].slots[0].events
    assert.deepEqual(e.map((x) => x.pitch).sort((a, b) => a - b), [45, 50, 52])
    assert.equal(e.find((x) => x.pitch === 45).t, 0, 'early note sits at the start, not the loop end')
    assert.equal(e.find((x) => x.pitch === 50).t, 0)
    assert.ok(Math.abs(e.find((x) => x.pitch === 50).dur - 0.5) < 1e-6, 'held note runs to its note-off')
    roundTrip(s, 'pre-roll')
  }

  // ---- phase already recording but the audio has not reached the bar line: early notes go to t = 0,
  // earlier ones are ignored together with their note-off and gestures
  {
    const s = S.createSession()
    s.setQuantise(0)
    s.setPlaying(true)
    s.armRecord(1, 0)
    s.onBar(4)
    assert.equal(s.get().rec.phase, 'recording')
    note(s, 3.9, 45, 0.3)
    s.recNoteOn(1, 'x', 47, 100, 3.5)
    s.recGesture(1, 'x', 'bend', 1, 3.6)
    s.recNoteOff(1, 'x', 64, 4.2)
    note(s, 5, 52)
    s.stopRecord(); s.onBar(8); s.settle(8)
    const e = s.get().tracks[1].slots[0].events
    assert.deepEqual(e.map((x) => [x.pitch, x.t]), [[45, 0], [52, 1]])
    roundTrip(s, 'early notes after the phase flip')
  }

  // ---- an empty take is decided when the audio reaches the bar line, not when the engine looks ahead
  {
    const s = S.createSession()
    s.setQuantise(0)
    s.setPlaying(true)
    s.armRecord(1, 0)
    s.onBar(4)
    s.stopRecord()
    s.onBar(8)
    assert.equal(s.get().rec.phase, 'closing', 'still open for the notes before the line')
    note(s, 7.5, 60, 0.3)
    s.settle(7.9)
    assert.equal(s.get().rec.phase, 'closing')
    s.settle(8)
    assert.equal(s.get().rec.phase, 'idle')
    assert.equal(s.get().tracks[1].slots[0].events.length, 1)
    // and a take that stays empty says so at the line
    const q = S.createSession()
    q.setPlaying(true)
    q.armRecord(1, 0); q.onBar(4); q.stopRecord(); q.onBar(8)
    assert.equal(q.get().rec.phase, 'closing')
    q.settle(8)
    assert.equal(q.get().rec.phase, 'idle')
    assert.equal(q.get().announce.text, 'Nothing recorded')
    assert.equal(q.get().tracks[1].slots[0], null)
  }

  // ---- a note with thousands of gestures is capped so the saved session still loads
  {
    const s = S.createSession()
    s.setQuantise(0)
    s.setPlaying(true)
    s.armRecord(2, 0)
    s.onBar(4)
    s.recNoteOn(2, 'g', 60, 100, 4)
    for (let i = 0; i < 3000; i++) s.recGesture(2, 'g', 'bend', (i % 7) / 7, 4 + i * 0.001)
    s.recNoteOff(2, 'g', 64, 7.5)
    s.stopRecord(); s.onBar(8); s.settle(8)
    const ev = s.get().tracks[2].slots[0].events
    assert.equal(ev.length, 1)
    assert.ok(ev[0].g.length > 0 && ev[0].g.length <= 2000)
    roundTrip(s, '3000 gestures on one note')
    const again = S.loadSession(S.saveSession(s.get()))
    assert.ok(again.tracks[2].slots[0], 'saved take loads back')
  }

  // ---- the auto end at eight bars
  {
    const s = S.createSession()
    s.setPlaying(true)
    s.armRecord(1, 0); s.onBar(4)
    note(s, 4, 40)
    for (let b = 8; b < 36; b += 4) s.onBar(b)
    assert.equal(s.get().rec.phase, 'recording')
    s.onBar(36)
    assert.equal(s.get().rec.phase, 'closing')
    s.settle(36)
    assert.equal(s.get().tracks[1].slots[0].lengthBeats, 32)
    roundTrip(s, 'eight bars')
  }

  // ---- overdub keeps the old events, the loop length, and aligns to the loop
  {
    const s = S.createSession()
    s.setQuantise(0)
    s.setPlaying(true)
    s.armRecord(1, 0); s.onBar(4)
    note(s, 4, 40)
    s.stopRecord(); s.onBar(8); s.settle(8)
    assert.equal(s.get().tracks[1].slots[0].events.length, 1)
    s.armRecord(1, 0)
    s.onBar(12)
    assert.equal(s.get().rec.overdub, true)
    note(s, 13, 47)
    s.stopRecord(); s.onBar(16); s.settle(16)
    const clip = s.get().tracks[1].slots[0]
    assert.equal(clip.lengthBeats, 4)
    assert.deepEqual(clip.events.map((x) => x.pitch), [40, 47])
    assert.equal(clip.events[1].t, 1)
    // undo restores the single-note loop, again restores nothing more past the first take
    assert.equal(s.undo(), true)
    assert.equal(s.get().tracks[1].slots[0].events.length, 1)
    assert.equal(s.undo(), true)
    assert.equal(s.get().tracks[1].slots[0], null)
    assert.deepEqual(s.get().tracks[1].active, [])
    assert.equal(s.undo(), false)
    roundTrip(s, 'overdub undo')
  }

  // ---- quantise
  {
    const s = S.createSession()
    s.setQuantise(0.5)
    s.setPlaying(true)
    s.armRecord(1, 0); s.onBar(4)
    note(s, 4.4, 40)
    s.stopRecord(); s.onBar(8); s.settle(8)
    assert.equal(s.get().tracks[1].slots[0].events[0].t, 0.5)
  }

  // ---- slots: tap, queue, bar line, clear, undo
  {
    const s = S.createSession()
    s.setPlaying(false)
    // fill two slots of the bass directly
    const clip = (p) => ({ lengthBeats: 4, events: [{ t: 0, dur: 1, pitch: p, vel: 90, lift: 64, g: [] }] })
    s.commitTake(1, 0, clip(36))
    s.commitTake(1, 2, clip(38))
    assert.deepEqual(s.get().tracks[1].active, [2])
    assert.equal(s.tapSlot(1, 3), 'selected', 'empty slot is only selected')
    assert.deepEqual(s.get().tracks[1].active, [2])
    // stopped: immediate
    assert.equal(s.tapSlot(1, 0), 'start')
    assert.deepEqual(s.get().tracks[1].active, [0])
    assert.equal(s.tapSlot(1, 0), 'stop')
    assert.deepEqual(s.get().tracks[1].active, [])
    // playing: queued until the bar line
    s.tapSlot(1, 0)
    s.setPlaying(true)
    assert.equal(s.tapSlot(1, 2), 'start')
    assert.deepEqual(s.get().tracks[1].active, [0])
    assert.equal(s.get().queue[1], 2)
    assert.equal(s.tapSlot(1, 2), 'stop', 'second tap stops it')
    assert.equal(s.get().queue[1], -1)
    assert.equal(s.tapSlot(1, 0), 'start', 'tapping the playing loop while a stop is queued keeps it going')
    assert.equal(s.get().queue[1], null, 'back to what is playing')
    s.tapSlot(1, 2)
    s.onBar(4)
    assert.deepEqual(s.get().tracks[1].active, [2])
    assert.equal(s.get().queue[1], null)
    // stopping applies the queue at once
    s.tapSlot(1, 2)
    assert.equal(s.get().queue[1], -1)
    s.setPlaying(false)
    assert.deepEqual(s.get().tracks[1].active, [])
    // clear and undo
    assert.equal(s.clearSlot(1, 2), true)
    assert.equal(s.get().announce.text, 'Cleared')
    assert.equal(s.get().tracks[1].slots[2], null)
    assert.equal(s.clearSlot(1, 2), false)
    assert.equal(s.undo(), true)
    assert.equal(s.get().tracks[1].slots[2].events[0].pitch, 38)
    roundTrip(s, 'slots')
  }

  // ---- clearing or undoing the slot being recorded is refused
  {
    const s = S.createSession()
    s.setPlaying(true)
    s.armRecord(0, 1); s.onBar(4)
    assert.equal(s.clearSlot(0, 1), false)
    assert.equal(s.toggleDrumStep(0, 0, 1), false)
    assert.equal(s.toggleDrumStep(0, 0, 0), true, 'other slots stay editable')
  }

  // ---- drum steps
  {
    const s = S.createSession()
    const has = (drum, step) => L.gridFromClip(s.get().tracks[0].slots[s.get().prefs.slots[0]], 16)[drum][step] > 0
    assert.equal(has(0, 0), true)
    assert.equal(s.toggleDrumStep(0, 0), true)
    assert.equal(has(0, 0), false)
    s.toggleDrumStep(5, 3)
    assert.equal(has(5, 3), true)
    assert.equal(s.undo(), true)
    assert.equal(has(5, 3), false)
    assert.equal(s.undo(), true)
    assert.equal(has(0, 0), true)
    // an empty slot gets a one-bar clip and becomes the playing loop when nothing plays
    s.clearSlot(0, 0)
    assert.deepEqual(s.get().tracks[0].active, [])
    s.selectSlot(0, 1)
    s.toggleDrumStep(1, 4)
    assert.equal(s.get().tracks[0].slots[1].lengthBeats, 4)
    assert.deepEqual(s.get().tracks[0].active, [1])
    assert.equal(s.toggleDrumStep(8, 0), false)
    assert.equal(s.toggleDrumStep(0, 1.5), false)
    roundTrip(s, 'drum steps')
  }

  // ---- export uses the slot you last worked on for a stopped track
  {
    const s = S.createSession()
    s.tapSlot(0, 0)
    assert.deepEqual(s.get().tracks[0].active, [])
    assert.deepEqual(s.dataForExport().tracks[0].active, [0])
    const midi = (await load('midi-export.js')).sessionToMidi(s.dataForExport())
    assert.ok(midi.length > 100)
  }

  // ---- new session
  {
    const s = S.createSession()
    s.setBpm(150); s.clearSlot(0, 0)
    s.reset()
    assert.equal(s.get().bpm, 100)
    assert.equal(s.get().canUndo, false)
    assert.ok(s.get().tracks[0].slots[0])
  }

  // ---- scales module stays what session relies on
  assert.ok(Object.hasOwn(sc.SCALES, 'blues'))

  console.log('jam session: all checks passed')
}

main().catch((e) => { console.error(e); process.exit(1) })
