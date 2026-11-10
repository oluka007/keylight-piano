// Jam looper (pure): takes, loop length rules, quantise, overdub, window lookup,
// undo, drum step-grid helpers and session (de)serialisation.
// Times inside clips are in beats (quarter notes).
import { SCALES } from './scales.js'

export const MAX_EVENTS = 4000
export const MAX_GESTURES = 2000
const MAX_TRACKS = 8
const MAX_SLOTS = 8
const MAX_LENGTH = 128
const UNDO_DEPTH = 8
const GESTURE_KINDS = ['bend', 'press', 'slide']
const LOOP_BARS = [1, 2, 4, 8]
const MAX_WINDOW_PASSES = 10000
const MAX_WINDOW_RESULTS = 20000

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// Nearest of 1, 2, 4, 8 bars. A span of up to a quarter bar past a boundary
// rounds down to it; more than that rounds up to the next length.
export function lengthBarsFor(spanBeats, beatsPerBar = 4) {
  const bars = spanBeats / beatsPerBar
  const sizes = [1, 2, 4, 8]
  let base = 1
  for (const s of sizes) if (bars >= s - 1e-9) base = s
  if (bars - base <= 0.25 + 1e-9) return base
  return sizes[Math.min(sizes.length - 1, sizes.indexOf(base) + 1)]
}

function thinGestures(g) {
  const out = []
  const last = {}
  for (const e of g) {
    const prev = last[e.k]
    if (prev) {
      const minChange = e.k === 'bend' ? 0.05 : 0.01
      if (e.dt - prev.dt < 1 / 96 && Math.abs(e.v - prev.v) < minChange) continue
    }
    last[e.k] = e
    out.push(e)
  }
  return out
}

const byTime = (a, b) => a.t - b.t || a.pitch - b.pitch

export function gridFromClip(clip, steps = 16) {
  const bars = Math.max(1, Math.round(clip.lengthBeats / 4))
  const total = steps * bars
  const grid = Array.from({ length: 8 }, () => new Array(total).fill(0))
  const stepBeats = clip.lengthBeats / total
  for (const e of clip.events) {
    if (e.pitch < 0 || e.pitch > 7) continue
    const s = Math.round(e.t / stepBeats) % total
    grid[e.pitch][s] = e.vel
  }
  return grid
}

// Returns a new clip with the step on (or off if it was on) for the drum.
export function toggleStep(clip, drum, step, vel = 100) {
  const bars = Math.max(1, Math.round(clip.lengthBeats / 4))
  const total = 16 * bars
  const stepBeats = clip.lengthBeats / total
  const s = ((step % total) + total) % total
  const isStep = (e) => e.pitch === drum && Math.round(e.t / stepBeats) % total === s
  const had = clip.events.some(isStep)
  const events = clip.events.filter((e) => !isStep(e))
  if (!had) events.push({ t: s * stepBeats, dur: stepBeats, pitch: drum, vel: clamp(Math.round(vel), 1, 127), lift: 64, g: [] })
  events.sort(byTime)
  return { lengthBeats: clip.lengthBeats, events }
}

export function eventsInWindow(clip, fromBeat, toBeat) {
  const out = []
  const L = clip && clip.lengthBeats
  // A length below one beat (or a non-number) would make the loop index stop advancing.
  if (typeof L !== 'number' || !Number.isFinite(L) || L < 1) return out
  if (!Array.isArray(clip.events) || !clip.events.length || !(toBeat > fromBeat)) return out
  const k0 = Math.floor(fromBeat / L) - 1
  const k1 = Math.floor(toBeat / L) + 1
  const passes = Math.min(k1 - k0 + 1, MAX_WINDOW_PASSES)
  for (let n = 0; n < passes && out.length < MAX_WINDOW_RESULTS; n++) {
    const k = k0 + n
    for (const event of clip.events) {
      const beat = k * L + event.t
      if (beat >= fromBeat && beat < toBeat) out.push({ event, beat })
      if (out.length >= MAX_WINDOW_RESULTS) break
    }
  }
  out.sort((a, b) => a.beat - b.beat)
  return out
}

function num(v, what) {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`Jam session: ${what} is not a number`)
  return v
}

// A loop is a whole number of bars (1, 2, 4 or 8) of the session's metre.
const isLoopLength = (beats, beatsPerBar) => LOOP_BARS.some((bars) => beats === bars * beatsPerBar)

// 'active' is which slot a track plays: one slot index, -1 or null for none, or a
// de-duplicated list of indices no longer than the slot list itself.
function parseActive(active, slotCount, track) {
  const isSlot = (a) => Number.isInteger(a) && a >= 0 && a < slotCount
  if (Array.isArray(active)) {
    if (active.length > slotCount) throw new Error(`Jam session: track ${track} has too many active slots`)
    const out = []
    for (const a of active) {
      if (!isSlot(a)) throw new Error(`Jam session: track ${track} has a bad active slot`)
      if (!out.includes(a)) out.push(a)
    }
    return out
  }
  if (!Number.isInteger(active)) throw new Error(`Jam session: track ${track} has a bad active slot`)
  if (active === -1) return []
  if (isSlot(active)) return [active]
  throw new Error(`Jam session: track ${track} has a bad active slot`)
}

function parseClip(c, what, beatsPerBar) {
  if (!c || typeof c !== 'object') throw new Error(`Jam session: ${what} is not a clip`)
  const lengthBeats = num(c.lengthBeats, `${what} length`)
  if (lengthBeats <= 0) throw new Error(`Jam session: ${what} has no length`)
  if (!isLoopLength(lengthBeats, beatsPerBar)) throw new Error(`Jam session: ${what} has a bad length`)
  if (!Array.isArray(c.events)) throw new Error(`Jam session: ${what} events are not a list`)
  if (c.events.length > MAX_EVENTS) throw new Error(`Jam session: ${what} has too many events`)
  const L = Math.min(lengthBeats, MAX_LENGTH)
  const events = c.events.map((e) => {
    if (!e || typeof e !== 'object') throw new Error(`Jam session: ${what} has a bad event`)
    const ev = {
      t: clamp(num(e.t, 'event time'), 0, L),
      dur: clamp(num(e.dur, 'event duration'), 0, MAX_LENGTH),
      pitch: Math.round(clamp(num(e.pitch, 'event pitch'), 0, 127)),
      vel: Math.round(clamp(num(e.vel, 'event velocity'), 1, 127)),
      lift: Math.round(clamp(num(e.lift ?? 64, 'event lift'), 0, 127)),
      g: []
    }
    if (ev.t >= L) ev.t = 0
    const g = e.g ?? []
    if (!Array.isArray(g) || g.length > MAX_GESTURES) throw new Error(`Jam session: ${what} has a bad gesture list`)
    ev.g = g.map((x) => {
      if (!x || !GESTURE_KINDS.includes(x.k)) throw new Error(`Jam session: ${what} has a bad gesture`)
      const v = num(x.v, 'gesture value')
      return { dt: clamp(num(x.dt, 'gesture time'), 0, MAX_LENGTH), k: x.k, v: x.k === 'bend' ? clamp(v, -48, 48) : clamp(v, 0, 1) }
    })
    return ev
  })
  events.sort(byTime)
  return { lengthBeats: L, events }
}

export function parse(json) {
  let s
  try { s = typeof json === 'string' ? JSON.parse(json) : json } catch { throw new Error('Jam session: not valid JSON') }
  if (!s || typeof s !== 'object' || s.v !== 1) throw new Error('Jam session: unknown version')
  if (!Array.isArray(s.tracks) || s.tracks.length > MAX_TRACKS) throw new Error('Jam session: bad track list')
  const beatsPerBar = Number.isInteger(s.beatsPerBar) && s.beatsPerBar >= 2 && s.beatsPerBar <= 12 ? s.beatsPerBar : 4
  const session = {
    v: 1,
    bpm: clamp(num(s.bpm, 'tempo'), 40, 220),
    swing: clamp(num(s.swing ?? 0, 'swing'), 0, 0.6),
    key: ((Math.round(num(s.key ?? 0, 'key')) % 12) + 12) % 12,
    scale: typeof s.scale === 'string' && Object.hasOwn(SCALES, s.scale) ? s.scale : 'major',
    tracks: s.tracks.map((t, i) => {
      if (!t || typeof t !== 'object') throw new Error(`Jam session: track ${i} is malformed`)
      const slots = t.slots ?? []
      if (!Array.isArray(slots) || slots.length > MAX_SLOTS) throw new Error(`Jam session: track ${i} has bad slots`)
      const track = {
        kind: t.kind === 'drum' ? 'drum' : 'inst',
        name: typeof t.name === 'string' ? t.name.slice(0, 40) : '',
        instrument: typeof t.instrument === 'string' ? t.instrument.slice(0, 40) : '',
        level: clamp(num(t.level ?? 0.8, 'level'), 0, 1),
        send: clamp(num(t.send ?? 0, 'send'), 0, 1),
        mute: t.mute === true,
        slots: slots.map((c, j) => (c === null ? null : parseClip(c, `track ${i} slot ${j}`, beatsPerBar)))
      }
      if (t.active !== undefined && t.active !== null) track.active = parseActive(t.active, track.slots.length, i)
      return track
    })
  }
  return session
}

export function serialise(session) {
  return JSON.stringify({ v: 1, ...session })
}

export function createLooper({ beatsPerBar = 4, slots = 4 } = {}) {
  let take = null
  const undo = new Map()

  function beginTake({ startBeat, overdubOnto = null }) {
    take = { startBeat, onto: overdubOnto, notes: [], held: new Map() }
  }

  function takeNoteOn(id, pitch, vel, beat) {
    if (!take) return
    if (take.held.has(id)) takeNoteOff(id, 64, beat)
    const note = { start: beat, pitch, vel: clamp(Math.round(vel), 1, 127), g: [], end: null, lift: 64 }
    take.held.set(id, note)
    take.notes.push(note)
  }

  function takeGesture(id, k, v, beat) {
    const note = take && take.held.get(id)
    if (!note || !GESTURE_KINDS.includes(k)) return
    note.g.push({ dt: Math.max(0, beat - note.start), k, v })
  }

  function takeNoteOff(id, lift, beat) {
    const note = take && take.held.get(id)
    if (!note) return
    note.end = beat
    note.lift = clamp(Math.round(lift), 0, 127)
    take.held.delete(id)
  }

  function endTake(beat, { quantise = 0 } = {}) {
    if (!take) throw new Error('endTake without beginTake')
    const t = take
    take = null
    for (const note of t.held.values()) note.end = beat
    const span = beat - t.startBeat
    const lengthBeats = t.onto ? t.onto.lengthBeats : lengthBarsFor(span, beatsPerBar) * beatsPerBar
    const events = t.notes.map((n) => {
      let rel = n.start - t.startBeat
      let dur = Math.max(1 / 96, n.end - n.start)
      if (quantise > 0) {
        rel = Math.round(rel / quantise) * quantise
        dur = Math.max(dur, quantise / 2)
      }
      const start = ((rel % lengthBeats) + lengthBeats) % lengthBeats
      return { t: start, dur, pitch: n.pitch, vel: n.vel, lift: n.lift, g: thinGestures(n.g) }
    })
    const merged = t.onto ? t.onto.events.map((e) => ({ ...e, g: e.g.map((x) => ({ ...x })) })).concat(events) : events
    merged.sort(byTime)
    return { lengthBeats, events: merged.slice(0, MAX_EVENTS) }
  }

  function pushUndo(slotKey, clip) {
    const stack = undo.get(slotKey) || []
    stack.push(clip)
    while (stack.length > UNDO_DEPTH) stack.shift()
    undo.set(slotKey, stack)
  }

  function popUndo(slotKey) {
    const stack = undo.get(slotKey)
    return stack && stack.length ? stack.pop() : null
  }

  return {
    beatsPerBar,
    slots,
    beginTake,
    takeNoteOn,
    takeGesture,
    takeNoteOff,
    endTake,
    eventsInWindow,
    pushUndo,
    popUndo,
    undoDepth: (slotKey) => (undo.get(slotKey) || []).length,
    serialise,
    parse,
    gridFromClip,
    toggleStep
  }
}
