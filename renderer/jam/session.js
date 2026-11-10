// Jam session (pure: no DOM, no audio). One small state container for the Jam screen:
// tempo, key and scale, four tracks with four loop slots each, the screen's choices
// (scale lock, quantise, effects ...) and the record state machine.
//
// State shape (treated as immutable; every change makes a new object):
//   { v: 1, bpm, swing, key, scale,
//     tracks: [ { kind: 'drum'|'inst', name, instrument, level, send, mute,
//                 slots: [clip|null x4], active: [] | [slotIndex] } x4 ],   // 0 drums, 1 bass, 2 chords, 3 lead
//     prefs: { scaleLock, snap, quantise, metronome, delay, reverb, track, slots: [n x4] },
//     playing, queue: [null | slotIndex | -1 x4],      // loop changes waiting for the next bar line
//     rec: { phase: 'idle'|'armed'|'recording'|'stopping'|'closing', track, slot, ... },
//     canUndo, announce: { n, text } }                  // n changes with every announcement
// The parts looper.serialise/parse know (bpm, swing, key, scale, tracks) are saved as they
// are; the prefs travel beside them in the same JSON and are checked separately on load.
import { parse, serialise as serialiseData, createLooper, toggleStep, lengthBarsFor, MAX_GESTURES } from './looper.js'
import { SCALES } from './scales.js'

export const BEATS_PER_BAR = 4
export const SLOT_COUNT = 4
export const TRACK_COUNT = 4
export const DRUM_TRACK = 0
export const MAX_RECORD_BARS = 8
export const UNDO_DEPTH = 16
// Notes played this far (in beats) before the bar line a take starts on belong to it, at its very start:
// the engine opens the take a little before the audio reaches the bar line, and players come in a touch
// early. Anything earlier than that (with its note-off and gestures) is not part of the take.
export const PRE_ROLL_BEATS = 0.1
const PRE_ROLL_KEEP = 4096   // a chord with pressure and slide streams must not push its own note-ons out
export const QUANTISE_CHOICES = [0, 0.25, 0.5]

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const isIndex = (v, n) => Number.isInteger(v) && v >= 0 && v < n

// White keys from C upward play the drums: C kick, D snare, E closed hat, F open hat,
// G clap, A low tom, B high tom, and the C an octave above the first one a rim click.
// Any octave works (the same white keys play the same drums); only the C that is exactly
// C5 (72) is the rim. Black keys play nothing on the drum track. Returns -1 for no drum.
export const DRUM_KEY_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C']
export function drumForPitch(pitch) {
  if (pitch === 72) return 7
  return [0, 2, 4, 5, 7, 9, 11].indexOf(((Math.round(pitch) % 12) + 12) % 12)
}

export const barsOf = (clip) => Math.max(1, Math.round(clip.lengthBeats / BEATS_PER_BAR))
const barsText = (clip) => { const n = barsOf(clip); return `${n} ${n === 1 ? 'bar' : 'bars'}` }

/* ---------- the default session ---------- */

function starterBeat() {
  let clip = { lengthBeats: BEATS_PER_BAR, events: [] }
  const add = (drum, steps, vel) => { for (const s of steps) clip = toggleStep(clip, drum, s, vel) }
  add(0, [0, 8, 10], 110)
  add(1, [4, 12], 100)
  add(2, [0, 2, 4, 6, 8, 10, 12], 70)
  add(3, [14], 80)
  return clip
}

const emptySlots = () => Array.from({ length: SLOT_COUNT }, () => null)

function defaultTracks() {
  return [
    { kind: 'drum', name: 'Drums', instrument: '', level: 0.8, send: 0.1, mute: false, slots: [starterBeat(), null, null, null], active: [0] },
    { kind: 'inst', name: 'Bass', instrument: 'bass', level: 0.8, send: 0, mute: false, slots: emptySlots(), active: [] },
    { kind: 'inst', name: 'Chords', instrument: 'epiano', level: 0.7, send: 0.25, mute: false, slots: emptySlots(), active: [] },
    { kind: 'inst', name: 'Lead', instrument: 'lead', level: 0.7, send: 0.2, mute: false, slots: emptySlots(), active: [] }
  ]
}

export const DEFAULT_INSTRUMENTS = ['', 'bass', 'epiano', 'lead']

const defaultPrefs = () => ({
  scaleLock: false, snap: false, quantise: 0.25, metronome: false, delay: 0.2, reverb: 0.25,
  track: 2, slots: [0, 0, 0, 0]
})

const IDLE = Object.freeze({ phase: 'idle', track: 0, slot: 0, skip: 0, startBeat: 0, closeBeat: 0, overdub: false })

export function defaultState() {
  return {
    v: 1, bpm: 100, swing: 0, key: 0, scale: 'major',
    tracks: defaultTracks(),
    prefs: defaultPrefs(),
    playing: false,
    queue: [null, null, null, null],
    rec: { ...IDLE },
    canUndo: false,
    announce: { n: 0, text: '' }
  }
}

function cleanPrefs(raw) {
  const d = defaultPrefs()
  if (!raw || typeof raw !== 'object') return d
  const num = (v, lo, hi, fallback) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : fallback)
  return {
    scaleLock: raw.scaleLock === true,
    snap: raw.snap === true,
    quantise: QUANTISE_CHOICES.includes(raw.quantise) ? raw.quantise : d.quantise,
    metronome: raw.metronome === true,
    delay: num(raw.delay, 0, 1, d.delay),
    reverb: num(raw.reverb, 0, 1, d.reverb),
    track: isIndex(raw.track, TRACK_COUNT) ? raw.track : d.track,
    slots: Array.isArray(raw.slots) && raw.slots.length === TRACK_COUNT && raw.slots.every((s) => isIndex(s, SLOT_COUNT))
      ? raw.slots.slice() : d.slots
  }
}

// Stored data (a JSON string or an object) -> a state. Anything bad gives the default
// session, never an error: a damaged file must not stop the screen opening.
export function loadSession(raw) {
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
    const data = parse(obj)
    const shapeOk = data.tracks.length === TRACK_COUNT && data.tracks.every((t, i) => t.kind === (i === DRUM_TRACK ? 'drum' : 'inst'))
    if (!shapeOk) return defaultState()
    const def = defaultTracks()
    const tracks = data.tracks.map((t, i) => {
      const slots = t.slots.slice(0, SLOT_COUNT)
      while (slots.length < SLOT_COUNT) slots.push(null)
      let active = (t.active || []).filter((a) => a < SLOT_COUNT && slots[a]).slice(0, 1)
      return {
        kind: t.kind,
        name: t.name || def[i].name,
        instrument: i === DRUM_TRACK ? '' : (t.instrument || def[i].instrument),
        level: t.level, send: t.send, mute: t.mute,
        slots, active
      }
    })
    return {
      ...defaultState(),
      bpm: Math.round(data.bpm), swing: data.swing, key: data.key, scale: data.scale,
      tracks, prefs: cleanPrefs(obj.prefs)
    }
  } catch (_e) {
    return defaultState()
  }
}

// The part of a state that looper.serialise / midi-export understand.
// A track that is stopped exports the slot you last worked on, so a file is never silent
// just because a loop was switched off.
export function dataOf(state, { forExport = false } = {}) {
  return {
    bpm: state.bpm, swing: state.swing, key: state.key, scale: state.scale,
    tracks: state.tracks.map((t, i) => {
      let active = t.active
      if (forExport && !active.length) {
        const sel = state.prefs.slots[i]
        active = t.slots[sel] ? [sel] : []
      }
      return { kind: t.kind, name: t.name, instrument: t.instrument, level: t.level, send: t.send, mute: t.mute, slots: t.slots, active }
    })
  }
}

export function saveSession(state) {
  const base = JSON.parse(serialiseData(dataOf(state)))
  base.prefs = state.prefs
  return JSON.stringify(base)
}

/* ---------- take building (a log of what was played -> a clip) ---------- */

// log entries: { op: 'on', id, pitch, vel, beat } | { op: 'g', id, k, v, beat } | { op: 'off', id, lift, beat }
// Keep at most `max` gestures, spread evenly, first and last included (a saved note takes no more).
function capGestures(g, max) {
  if (g.length <= max) return g
  return Array.from({ length: max }, (_v, i) => g[Math.round((i * (g.length - 1)) / (max - 1))])
}

// Entries before the beat the take really starts on: up to PRE_ROLL_BEATS early moves to that beat;
// a note earlier than that is dropped with its later note-off and gestures.
function admit(log, realStart) {
  const out = []
  const dropped = new Set()
  for (const e of log) {
    if (e.op === 'on') {
      if (e.beat < realStart - PRE_ROLL_BEATS - 1e-6) { dropped.add(e.id); continue }
      dropped.delete(e.id)
    } else if (dropped.has(e.id)) continue
    out.push(e.beat < realStart ? { ...e, beat: realStart } : e)
  }
  return out
}

function buildClip(log, startBeat, endBeat, onto, quantise, realStart = startBeat) {
  const lp = createLooper({ beatsPerBar: BEATS_PER_BAR })
  lp.beginTake({ startBeat, overdubOnto: onto })
  for (const e of admit(log, realStart)) {
    if (e.op === 'on') { if (e.beat < endBeat) lp.takeNoteOn(e.id, e.pitch, e.vel, e.beat) }
    else if (e.op === 'g') lp.takeGesture(e.id, e.k, e.v, Math.min(e.beat, endBeat))
    else lp.takeNoteOff(e.id, e.lift, Math.min(e.beat, endBeat))
  }
  const clip = lp.endTake(endBeat, { quantise })
  clip.events = clip.events.map((e) => (e.g.length > MAX_GESTURES ? { ...e, g: capGestures(e.g, MAX_GESTURES) } : e))
  if (!onto) {
    // a loop that is not played from beat 0 keeps its place in the bars it was played in
    const L = clip.lengthBeats
    const shift = ((startBeat % L) + L) % L
    if (shift > 1e-9) {
      clip.events = clip.events.map((e) => ({ ...e, t: (e.t + shift) % L })).sort((a, b) => a.t - b.t || a.pitch - b.pitch)
    }
  }
  return clip
}

/* ---------- the container ---------- */

export function createSession(raw) {
  let st = raw === undefined ? defaultState() : loadSession(raw)
  const subs = new Set()
  let undoStack = []          // { track, slot, clip, active }
  let log = []                // what is being played into the take
  let preLog = []             // what was played while armed: the last PRE_ROLL_BEATS before the bar line join the take
  let takeCtx = null          // { onto, alignedStart, provisional, provisionalLogLength }
  let said = 0

  const emit = (next, text) => {
    st = { ...next, canUndo: undoStack.length > 0 }
    if (text) st.announce = { n: ++said, text }
    for (const fn of [...subs]) fn(st)
  }
  const patch = (p, text) => emit({ ...st, ...p }, text)
  const patchPrefs = (p) => patch({ prefs: { ...st.prefs, ...p } })
  const patchTrack = (i, p, extra = {}, text) => emit({ ...st, ...extra, tracks: st.tracks.map((t, j) => (j === i ? { ...t, ...p } : t)) }, text)
  const setQueue = (i, v) => st.queue.map((q, j) => (j === i ? v : q))
  const pushUndo = (track, slot, clip) => {
    undoStack.push({ track, slot, clip })
    if (undoStack.length > UNDO_DEPTH) undoStack.shift()
  }
  const busyWith = (i, j) => st.rec.phase !== 'idle' && st.rec.phase !== 'armed' && st.rec.track === i && st.rec.slot === j

  /* ----- recording ----- */

  function putClip(i, j, clip) {
    const t = st.tracks[i]
    const slots = t.slots.map((c, k) => (k === j ? clip : c))
    return { ...st, queue: setQueue(i, null), prefs: { ...st.prefs, track: i, slots: st.prefs.slots.map((s, k) => (k === i ? j : s)) },
      tracks: st.tracks.map((x, k) => (k === i ? { ...x, slots, active: [j] } : x)) }
  }

  // commit a finished take as the clip of a slot; the clip starts looping at once
  function commitTake(track, slot, clip, before = st.tracks[track] && st.tracks[track].slots[slot]) {
    if (!isIndex(track, TRACK_COUNT) || !isIndex(slot, SLOT_COUNT) || !clip) return false
    pushUndo(track, slot, before || null)
    emit(putClip(track, slot, clip), `Loop saved, ${barsText(clip)}`)
    return true
  }

  // end the take at endBeat. When the bar line is reached early (the engine looks ahead) the
  // take stays open for the notes still to be played before it ('closing'); settle() then
  // rebuilds the clip with them.
  const isEmptyTake = (clip, onto) => clip.events.length === 0 || (!!onto && clip.events.length === onto.events.length)

  function finishTake(endBeat, { final }) {
    const r = st.rec
    const ctx = takeCtx
    const clip = buildClip(log, ctx.alignedStart, endBeat, ctx.onto, st.prefs.quantise, ctx.realStart)
    const empty = isEmptyTake(clip, ctx.onto)
    if (final) {
      log = []; takeCtx = null
      if (!empty) commitTake(r.track, r.slot, clip, ctx.onto)
      patch({ rec: { ...IDLE } }, empty ? 'Nothing recorded' : undefined)
      return
    }
    // an empty take is judged only when the audio reaches the bar line (settle): notes can still come
    ctx.provisional = null
    if (!empty && commitTake(r.track, r.slot, clip, ctx.onto)) ctx.provisional = clip
    ctx.logLength = log.length
    patch({ rec: { ...r, phase: 'closing', closeBeat: endBeat } })
  }

  function startTake(beat) {
    const r = st.rec
    const onto = st.tracks[r.track].slots[r.slot] || null
    const early = preLog.filter((e) => e.op === 'on' && e.beat >= beat - PRE_ROLL_BEATS - 1e-6 && e.beat < beat + 1e-9)
    const ids = new Set(early.map((e) => e.id))
    log = preLog.filter((e) => (e.op === 'on' ? ids.has(e.id) && e.beat >= beat - PRE_ROLL_BEATS - 1e-6 : ids.has(e.id)))
    preLog = []
    takeCtx = { onto, alignedStart: onto ? Math.floor(beat / onto.lengthBeats) * onto.lengthBeats : beat, realStart: beat, provisional: null, logLength: 0 }
    const next = { ...st, rec: { ...r, phase: 'recording', startBeat: beat, overdub: !!onto, skip: 0 } }
    if (onto) {
      next.tracks = st.tracks.map((t, k) => (k === r.track ? { ...t, active: [r.slot] } : t))
      next.queue = setQueue(r.track, null)
    }
    emit(next, 'Recording')
  }

  const takeOpen = (beat) => {
    const p = st.rec.phase
    if (p === 'recording' || p === 'stopping') return true
    return p === 'closing' && beat < st.rec.closeBeat
  }

  /* ----- the public surface ----- */

  const api = {
    get: () => st,
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn) },
    serialise: () => saveSession(st),
    dataForExport: () => dataOf(st, { forExport: true }),
    load(rawValue) {
      const next = loadSession(rawValue)
      undoStack = []; log = []; preLog = []; takeCtx = null
      emit(next)
      return true
    },
    reset() {
      undoStack = []; log = []; preLog = []; takeCtx = null
      emit(defaultState(), 'New session')
    },

    // tempo, key, scale and screen choices
    setBpm(v) { patch({ bpm: Math.round(clamp(Number(v) || st.bpm, 40, 220)) }) },
    setSwing(v) { patch({ swing: clamp(Number(v) || 0, 0, 0.6) }) },
    setKey(k) { patch({ key: (((Math.round(Number(k)) || 0) % 12) + 12) % 12 }) },
    setScale(id) { if (typeof id === 'string' && Object.hasOwn(SCALES, id)) patch({ scale: id }) },
    setScaleLock(on) { patchPrefs({ scaleLock: !!on }) },
    setSnap(on) { patchPrefs({ snap: !!on }) },
    setQuantise(q) { if (QUANTISE_CHOICES.includes(q)) patchPrefs({ quantise: q }) },
    setMetronome(on) { patchPrefs({ metronome: !!on }) },
    setDelay(v) { patchPrefs({ delay: clamp(Number(v) || 0, 0, 1) }) },
    setReverb(v) { patchPrefs({ reverb: clamp(Number(v) || 0, 0, 1) }) },

    // tracks and slots
    selectTrack(i) { if (isIndex(i, TRACK_COUNT)) patchPrefs({ track: i }) },
    selectSlot(i, j) {
      if (!isIndex(i, TRACK_COUNT) || !isIndex(j, SLOT_COUNT)) return
      patchPrefs({ track: i, slots: st.prefs.slots.map((s, k) => (k === i ? j : s)) })
    },
    setTrackInstrument(i, id) {
      if (!isIndex(i, TRACK_COUNT) || i === DRUM_TRACK || typeof id !== 'string' || !id || id.length > 40) return false
      patchTrack(i, { instrument: id })
      return true
    },
    setTrackLevel(i, v) { if (isIndex(i, TRACK_COUNT)) patchTrack(i, { level: clamp(Number(v) || 0, 0, 1) }) },
    setTrackSend(i, v) { if (isIndex(i, TRACK_COUNT)) patchTrack(i, { send: clamp(Number(v) || 0, 0, 1) }) },
    setTrackMute(i, on) { if (isIndex(i, TRACK_COUNT)) patchTrack(i, { mute: !!on }) },

    // Tap a slot: an empty one is only selected. A loop that is not playing is queued to start
    // on the next bar line (at once while stopped); the one that is playing, or queued, is
    // queued to stop. Returns 'selected' | 'start' | 'stop'.
    tapSlot(i, j) {
      if (!isIndex(i, TRACK_COUNT) || !isIndex(j, SLOT_COUNT)) return null
      const t = st.tracks[i]
      api.selectSlot(i, j)
      if (!t.slots[j]) return 'selected'
      const current = t.active.length ? t.active[0] : -1
      const target = st.queue[i] !== null ? st.queue[i] : current
      const next = target === j ? -1 : j
      if (!st.playing) {
        patchTrack(i, { active: next < 0 ? [] : [next] }, { queue: setQueue(i, null) })
      } else {
        patch({ queue: setQueue(i, next === current ? null : next) })
      }
      return next < 0 ? 'stop' : 'start'
    },

    // recording
    armRecord(track, slot) {
      if (!isIndex(track, TRACK_COUNT) || !isIndex(slot, SLOT_COUNT)) return false
      const phase = st.rec.phase
      if (phase !== 'idle' && phase !== 'armed') return false
      preLog = []
      patch({
        rec: { ...IDLE, phase: 'armed', track, slot, skip: st.playing ? 0 : 1 },
        prefs: { ...st.prefs, track, slots: st.prefs.slots.map((s, k) => (k === track ? slot : s)) }
      }, st.playing ? 'Armed. Recording starts at the next bar line' : 'Armed. One bar count-in, then recording')
      return true
    },
    cancelArm() {
      if (st.rec.phase !== 'armed') return false
      preLog = []
      patch({ rec: { ...IDLE } }, 'Recording cancelled')
      return true
    },
    // end the take at the next bar line (a take that has not begun is just cancelled)
    stopRecord() {
      const p = st.rec.phase
      if (p === 'armed') return api.cancelArm()
      if (p !== 'recording') return false
      patch({ rec: { ...st.rec, phase: 'stopping' } }, 'Stopping at the next bar line')
      return true
    },
    recNoteOn(track, id, pitch, vel, beat) {
      if (st.rec.phase === 'armed' && st.rec.track === track) { preLog.push({ op: 'on', id, pitch, vel, beat }); if (preLog.length > PRE_ROLL_KEEP) preLog.shift(); return }
      if (!takeOpen(beat) || st.rec.track !== track) return
      log.push({ op: 'on', id, pitch, vel, beat })
    },
    recGesture(track, id, k, v, beat) {
      if (st.rec.phase === 'armed' && st.rec.track === track) { preLog.push({ op: 'g', id, k, v, beat }); if (preLog.length > PRE_ROLL_KEEP) preLog.shift(); return }
      if (!takeOpen(beat) || st.rec.track !== track) return
      log.push({ op: 'g', id, k, v, beat })
    },
    recNoteOff(track, id, lift, beat) {
      if (st.rec.phase === 'armed' && st.rec.track === track) { preLog.push({ op: 'off', id, lift, beat }); if (preLog.length > PRE_ROLL_KEEP) preLog.shift(); return }
      const p = st.rec.phase
      if (p !== 'recording' && p !== 'stopping' && p !== 'closing') return
      if (st.rec.track !== track) return
      log.push({ op: 'off', id, lift, beat })
    },
    commitTake,

    // A bar line has been reached (called once per bar line, in order, a little before the
    // audio gets there). Applies queued loop changes and moves the record state machine.
    onBar(beat) {
      let changed = false
      if (st.queue.some((q) => q !== null)) {
        const tracks = st.tracks.map((t, i) => (st.queue[i] === null ? t : { ...t, active: st.queue[i] < 0 ? [] : [st.queue[i]] }))
        emit({ ...st, tracks, queue: [null, null, null, null] })
        changed = true
      }
      const r = st.rec
      if (r.phase === 'armed') {
        if (r.skip > 0) patch({ rec: { ...r, skip: r.skip - 1 } })
        else startTake(beat)
      } else if (r.phase === 'stopping') {
        finishTake(beat, { final: false })
      } else if (r.phase === 'recording' && beat - r.startBeat >= MAX_RECORD_BARS * BEATS_PER_BAR - 1e-9) {
        finishTake(beat, { final: false })
      }
      return changed
    },
    // the audio clock has reached nowBeat: a take that was closed early takes its late notes
    settle(nowBeat) {
      const r = st.rec
      if (r.phase !== 'closing' || nowBeat < r.closeBeat) return
      const ctx = takeCtx
      let text
      if (ctx && (!ctx.provisional || log.length !== ctx.logLength)) {
        const clip = buildClip(log, ctx.alignedStart, r.closeBeat, ctx.onto, st.prefs.quantise, ctx.realStart)
        if (isEmptyTake(clip, ctx.onto)) text = 'Nothing recorded'
        else if (!ctx.provisional) commitTake(r.track, r.slot, clip, ctx.onto)
        else if (st.tracks[r.track].slots[r.slot] === ctx.provisional) {
          emit({ ...st, tracks: st.tracks.map((x, k) => (k === r.track ? { ...x, slots: x.slots.map((c, m) => (m === r.slot ? clip : c)) } : x)) })
        }
      }
      log = []; takeCtx = null
      patch({ rec: { ...IDLE } }, text)
    },
    // Play or stop. Stopping applies queued loop changes at once, cancels an armed record and
    // ends a take that is running at `beat`.
    setPlaying(on, beat = 0) {
      if (!!on === st.playing) return
      if (on) {
        const r = st.rec
        patch({ playing: true, rec: r.phase === 'armed' ? { ...r, skip: 1 } : r })
        return
      }
      const r = st.rec
      if (r.phase === 'recording' || r.phase === 'stopping') finishTake(beat, { final: true })
      else if (r.phase === 'closing') api.settle(Infinity)
      else if (r.phase === 'armed') patch({ rec: { ...IDLE } }, 'Recording cancelled')
      const tracks = st.tracks.map((t, i) => (st.queue[i] === null ? t : { ...t, active: st.queue[i] < 0 ? [] : [st.queue[i]] }))
      emit({ ...st, playing: false, tracks, queue: [null, null, null, null] })
    },

    // editing
    clearSlot(i, j) {
      if (!isIndex(i, TRACK_COUNT) || !isIndex(j, SLOT_COUNT)) return false
      const clip = st.tracks[i].slots[j]
      if (!clip || busyWith(i, j)) return false
      pushUndo(i, j, clip)
      const t = st.tracks[i]
      emit({
        ...st,
        queue: setQueue(i, st.queue[i] === j ? null : st.queue[i]),
        tracks: st.tracks.map((x, k) => (k === i ? { ...t, slots: t.slots.map((c, m) => (m === j ? null : c)), active: t.active.filter((a) => a !== j) } : x))
      }, 'Cleared')
      return true
    },
    undo() {
      const e = undoStack[undoStack.length - 1]
      if (!e || busyWith(e.track, e.slot)) return false
      undoStack.pop()
      const t = st.tracks[e.track]
      emit({
        ...st,
        tracks: st.tracks.map((x, k) => (k === e.track ? { ...t, slots: t.slots.map((c, m) => (m === e.slot ? e.clip : c)), active: e.clip ? t.active : t.active.filter((a) => a !== e.slot) } : x))
      }, 'Undone')
      return true
    },
    // switch one step of the drum grid on or off (drum 0..7, step 0..16*bars-1)
    toggleDrumStep(drum, step, slot = st.prefs.slots[DRUM_TRACK], vel = 100) {
      if (!isIndex(drum, 8) || !Number.isInteger(step) || !isIndex(slot, SLOT_COUNT) || busyWith(DRUM_TRACK, slot)) return false
      const t = st.tracks[DRUM_TRACK]
      const before = t.slots[slot]
      const clip = toggleStep(before || { lengthBeats: BEATS_PER_BAR, events: [] }, drum, step, vel)
      pushUndo(DRUM_TRACK, slot, before || null)
      emit({
        ...st,
        tracks: st.tracks.map((x, k) => (k === DRUM_TRACK ? { ...t, slots: t.slots.map((c, m) => (m === slot ? clip : c)), active: t.active.length ? t.active : [slot] } : x))
      })
      return true
    }
  }
  return api
}
