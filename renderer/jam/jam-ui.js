// The Jam screen: a loop-and-layer sketchpad. mountJam(root, deps) builds the DOM once, keeps it
// in step with the session (session.js), and runs the playback engine (clock.js, looper.js)
// against the track objects of audio.js.
//
// deps: { audio: { audioContext, initAudio, createTrack, jamFx, click, instrumentList,
//                  sampledPianoStatus? },
//         lights: { show(pitches, colour), clear() } | null,
//         store: { get(key, fallback), set(key, value) },
//         exit(), download?(filename, bytes, mime) }
// Returns { destroy, noteOn, noteOff, bend, press, slide, state }.
import { createClock } from './clock.js'
import { eventsInWindow, gridFromClip } from './looper.js'
import { SCALES, inScale, snap, scalePitches } from './scales.js'
import { sessionToMidi } from './midi-export.js'
import { DRUMS } from './drums.js'
import {
  createSession, drumForPitch, barsOf, BEATS_PER_BAR, DRUM_TRACK, DEFAULT_INSTRUMENTS, QUANTISE_CHOICES
} from './session.js'

const STORE_KEY = 'lumi.jam'
const LIGHT_COLOUR = '#7cf0c6'
const KEY_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const BLACK = new Set([1, 3, 6, 8, 10])
const DRUM_PITCH = [60, 62, 64, 65, 67, 69, 71, 72]   // the key that plays each drum
const mod12 = (n) => ((n % 12) + 12) % 12
const pitchName = (p) => KEY_NAMES[mod12(p)] + (Math.floor(p / 12) - 1)
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const QUANTISE_LABEL = { 0: 'Off', 0.5: 'Eighths', 0.25: 'Sixteenths' }

// a screen already mounted on an element is taken down before a new one goes up
const mounted = new WeakMap()
let uid = 0

function makeH(doc) {
  return function h(tag, props, ...kids) {
    const el = doc.createElement(tag)
    for (const [k, v] of Object.entries(props || {})) {
      if (v === undefined || v === null || v === false) continue
      if (k === 'class') el.className = v
      else el.setAttribute(k, v === true ? '' : String(v))
    }
    for (const kid of kids.flat()) {
      if (kid === null || kid === undefined || kid === false) continue
      el.appendChild(typeof kid === 'string' ? doc.createTextNode(kid) : kid)
    }
    return el
  }
}

export function mountJam(root, deps) {
  const previous = mounted.get(root)
  if (previous) previous.destroy()

  const doc = root.ownerDocument || document
  const h = makeH(doc)
  const audio = deps.audio || {}
  const store = deps.store || { get: (_k, f) => f, set() {} }
  const lights = deps.lights || null
  const id = ++uid
  let alive = true
  const cleanups = []
  const timers = new Set()
  const listen = (target, ev, fn, opts) => { target.addEventListener(ev, fn, opts); cleanups.push(() => target.removeEventListener(ev, fn, opts)) }
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (alive) fn() }, ms); timers.add(t); return t }
  const text = (el, value) => { if (el.textContent !== value) el.textContent = value }
  const setAttr = (el, name, value) => { if (el.getAttribute(name) !== String(value)) el.setAttribute(name, String(value)) }
  const setVal = (el, value) => { if (String(el.value) !== String(value)) el.value = String(value) }
  const toggleClass = (el, name, on) => el.classList.toggle(name, !!on)

  /* ============================== session and sound ============================== */

  let stored = null
  try { stored = store.get(STORE_KEY, null) } catch (_e) { stored = null }
  const session = createSession(stored === null || stored === undefined ? undefined : stored)
  let dirty = false
  let saveTimer = 0
  const flush = () => {
    if (saveTimer) { clearTimeout(saveTimer); timers.delete(saveTimer); saveTimer = 0 }
    if (!dirty) return
    dirty = false
    try { store.set(STORE_KEY, JSON.parse(session.serialise())) } catch (_e) { /* storage full or blocked: the session stays in memory */ }
  }

  const nowSec = () => {
    const c = audio.audioContext && audio.audioContext()
    return c ? c.currentTime : 0
  }
  let tracks = []
  let fx = null
  let audioProblem = ''
  const instrumentOptions = () => {
    const list = audio.instrumentList ? audio.instrumentList() : []
    let ready = false
    try { ready = !!(audio.sampledPianoStatus && audio.sampledPianoStatus().state === 'ready') } catch (_e) { ready = false }
    return list.filter((i) => i.id !== 'sampled-piano' || ready)
  }
  try {
    if (audio.initAudio) audio.initAudio()
    fx = audio.jamFx()
    const made = []
    try {
      for (const [i, t] of session.get().tracks.entries()) {
        const tr = i === DRUM_TRACK
          ? audio.createTrack({ kind: 'drums', level: t.level, send: t.send })
          : audio.createTrack({ kind: 'notes', instrument: t.instrument, level: t.level, send: t.send })
        made.push(tr)
        if (t.mute) tr.setMute(true)
        if (i !== DRUM_TRACK && !tr.setInstrument(t.instrument)) {
          tr.setInstrument(DEFAULT_INSTRUMENTS[i])
          session.setTrackInstrument(i, DEFAULT_INSTRUMENTS[i])
          dirty = true
        }
      }
    } catch (e) {
      for (const tr of made) { try { tr.dispose() } catch (_e) { /* already gone */ } }
      throw e
    }
    tracks = made
  } catch (_e) {
    audioProblem = 'Sound could not start. Check the sound output, then open Jam again.'
  }

  /* ============================== engine ============================== */

  const clock = createClock({ now: nowSec, bpm: session.get().bpm })
  clock.swing = session.get().swing
  let pending = []             // { time, run(time) }: gesture changes and note ends of notes with gestures
  let voices = []              // per track: the playback voices still sounding, with the slot they came from
  let lastBarIdx = -1
  let scheduled = 0            // notes and drum hits handed to the tracks since the screen opened
  let sweepTimer = 0
  let tickTimer = 0
  const currentBeat = () => (clock.running ? Math.max(0, clock.beatAt(nowSec())) : 0)

  function sweep() {
    if (!alive || !pending.length) return
    const limit = nowSec() + 0.02
    const due = []
    const rest = []
    for (const e of pending) (e.time <= limit ? due : rest).push(e)
    pending = rest
    due.sort((a, b) => a.time - b.time)
    for (const e of due) { try { e.run(e.time) } catch (_e) { /* a dead voice */ } }
  }

  const trackVoices = (i) => (voices[i] || (voices[i] = []))
  const dropVoice = (i, v) => {
    const list = voices[i]
    if (!list) return
    const k = list.indexOf(v)
    if (k >= 0) list.splice(k, 1)
  }
  // A track whose playing loop changes or stops at a bar line has to let go of the notes it already
  // started: they belong to the old slot and would otherwise ring on past the transition. Release
  // them at the transition's own audio time and drop the gesture timers aimed at them. Voices of the
  // slot that keeps playing are left alone.
  function releaseVoices(i, keepSlot, when) {
    const list = voices[i]
    if (!list || !list.length) return
    const staying = []
    for (const v of list) {
      if (v.slot === keepSlot) { staying.push(v); continue }
      for (const entry of v.timers) {
        const k = pending.indexOf(entry)
        if (k >= 0) pending.splice(k, 1)
      }
      try { v.track.noteOff(v.handle, { when }) } catch (_e) { /* a dead voice */ }
    }
    if (staying.length !== list.length) voices[i] = staying
  }

  function playEvent(i, ev, beat, timeOfBeat, slot) {
    const tr = tracks[i]
    if (!tr) return
    const sw = clock.swungBeat(beat)
    const when = timeOfBeat(sw)
    scheduled++
    if (i === DRUM_TRACK) { tr.hit(ev.pitch, { when, velocity: ev.vel }); return }
    const handle = tr.noteOn(ev.pitch, ev.vel, when)
    if (!handle) return
    const end = timeOfBeat(sw + Math.max(ev.dur, 0.05))
    // remember the voice and the timers that reach it, so a bar line can end it early
    const voice = { slot, handle, track: tr, timers: [] }
    trackVoices(i).push(voice)
    const own = (entry) => { voice.timers.push(entry); return entry }
    if (!ev.g.length) {
      tr.noteOff(handle, { lift: ev.lift, when: end })
      pending.push(own({ time: end, run: () => dropVoice(i, voice) }))
      return
    }
    // a note with gestures is released when its time comes, so the gestures still reach it
    for (const g of ev.g) pending.push(own({ time: timeOfBeat(sw + g.dt), run: () => tr[g.k](handle, g.v) }))
    pending.push(own({ time: end, run: (time) => { tr.noteOff(handle, { lift: ev.lift, when: time }); dropVoice(i, voice) } }))
  }

  function schedule(from, to, timeOfBeat) {
    if (!(to > from)) return
    const st = session.get()
    // The click sounds when the metronome is on, through the count-in (every beat until the bar line a
    // take starts on) and on that bar line itself, so the first beat of the take is marked even with the
    // metronome off; after it the take runs without a click.
    const r = st.rec
    const always = st.prefs.metronome || r.phase === 'armed'
    for (let k = Math.ceil(from); k < to; k++) {
      if (!always && !(r.phase === 'recording' && Math.abs(k - r.startBeat) < 1e-6)) continue
      try { audio.click(k % BEATS_PER_BAR === 0, timeOfBeat(k)) } catch (_e) { /* no audio */ }
    }
    st.tracks.forEach((t, i) => {
      if (t.mute || !t.active.length) return
      const clip = t.slots[t.active[0]]
      if (!clip) return
      for (const { event, beat } of eventsInWindow(clip, from, to)) playEvent(i, event, beat, timeOfBeat, t.active[0])
    })
  }

  // one stretch of beats from the clock: split at bar lines, where queued loop changes and
  // the record state machine move, so a new loop plays from its first beat
  function onWindow({ fromBeat, toBeat, timeOfBeat }) {
    if (!alive) return
    let cursor = fromBeat
    for (let idx = Math.ceil(fromBeat / BEATS_PER_BAR - 1e-9); idx * BEATS_PER_BAR < toBeat; idx++) {
      if (idx <= lastBarIdx) continue
      const bar = idx * BEATS_PER_BAR
      if (bar > cursor) { schedule(cursor, bar, timeOfBeat); cursor = bar }
      lastBarIdx = idx
      const before = session.get().tracks.map((t) => (t.active.length ? t.active[0] : -1))
      session.onBar(bar)
      // a track whose playing loop just changed or stopped ends its old notes right here
      const when = timeOfBeat(bar)
      session.get().tracks.forEach((t, i) => {
        const playing = t.active.length ? t.active[0] : -1
        if (playing !== before[i]) releaseVoices(i, playing, when)
      })
    }
    schedule(cursor, toBeat, timeOfBeat)
  }
  const unWindow = clock.onWindow(onWindow)

  function silenceAll() {
    for (const tr of tracks) { try { tr.silence() } catch (_e) { /* disposed */ } }
  }

  function play() {
    if (!alive || clock.running) return
    try { if (audio.initAudio) audio.initAudio() } catch (_e) { /* reported at mount */ }
    const c = audio.audioContext && audio.audioContext()
    if (c && c.state === 'suspended' && c.resume) { try { c.resume() } catch (_e) { /* needs a gesture */ } }
    const st = session.get()
    lastBarIdx = -1
    clock.setBpm(st.bpm)
    clock.swing = st.swing
    clock.start(nowSec() + 0.06)
    session.setPlaying(true)
    sweepTimer = setInterval(sweep, 20)
    tickTimer = setInterval(tick, 50)
  }

  // metronome clicks are scheduled ahead, so they have to be called back when the transport stops
  // or the screen goes away; safe to call more than once
  const cancelClicks = () => { try { if (audio.cancelClicks) audio.cancelClicks() } catch (_e) { /* no audio */ } }

  function stop() {
    cancelClicks()
    if (!clock.running) { session.setPlaying(false); return }
    session.setPlaying(false, currentBeat())
    clock.stop()
    clearInterval(sweepTimer); clearInterval(tickTimer)
    sweepTimer = 0; tickTimer = 0
    pending = []
    voices = []
    silenceAll()
    renderPlayhead()
  }

  function tick() {
    if (!alive) return
    session.settle(currentBeat())
    renderPlayhead()
  }

  /* ============================== live playing ============================== */

  const live = new Map()   // `${channel}:${pitch}` -> { ti, handle, used, channel, id }
  const clampVel = (v) => clamp(Math.round(Number(v) || 100), 1, 127)

  function startNote(ti, pitch, vel, channel) {
    const tr = tracks[ti]
    if (!alive || !tr) return
    const key = `${channel}:${pitch}`
    if (live.has(key)) endNote(pitch, 64, channel)
    const st = session.get()
    const velocity = clampVel(vel)
    let used = pitch
    let handle = null
    if (ti === DRUM_TRACK) {
      used = drumForPitch(pitch)
      if (used < 0) return
      tr.hit(used, { velocity })
      flashPad(used, true)
    } else {
      if (st.prefs.snap) used = snap(pitch, st.key, st.scale)
      handle = tr.noteOn(used, velocity)
    }
    live.set(key, { ti, handle, used, channel, id: key })
    keyDown(pitch, true)
    session.recNoteOn(ti, key, used, velocity, currentBeat())
  }

  function endNote(pitch, lift, channel) {
    const key = `${channel}:${pitch}`
    const n = live.get(key)
    if (!n) return
    live.delete(key)
    const l = clamp(Math.round(Number(lift) || 64), 0, 127)
    if (n.handle && tracks[n.ti]) tracks[n.ti].noteOff(n.handle, { lift: l })
    if (n.ti === DRUM_TRACK) flashPad(n.used, false)
    keyDown(pitch, false)
    session.recNoteOff(n.ti, n.id, l, currentBeat())
  }

  function gesture(channel, kind, value) {
    for (const n of live.values()) {
      if (n.channel !== channel || !n.handle || !tracks[n.ti]) continue
      tracks[n.ti][kind](n.handle, value)
      session.recGesture(n.ti, n.id, kind, value, currentBeat())
    }
  }

  const releaseAllLive = () => { for (const n of [...live.values()]) endNote(Number(n.id.split(':')[1]), 64, n.channel) }

  /* ============================== building the screen ============================== */

  const btn = (label, cls, onClick, aria) => {
    const b = h('button', { type: 'button', class: cls, 'aria-label': aria }, label)
    if (onClick) listen(b, 'click', onClick)
    return b
  }
  const range = (min, max, step, label, onInput) => {
    const r = h('input', { type: 'range', min, max, step, 'aria-label': label, class: 'jam-range' })
    listen(r, 'input', () => onInput(Number(r.value)))
    return r
  }
  const check = (label, onChange) => {
    const input = h('input', { type: 'checkbox' })
    listen(input, 'change', () => onChange(input.checked))
    return { input, label: h('label', { class: 'jam-check' }, input, h('span', {}, label)) }
  }
  const select = (label, options, onChange) => {
    const s = h('select', { 'aria-label': label, class: 'jam-select' }, options.map(([v, t]) => h('option', { value: v }, t)))
    listen(s, 'change', () => onChange(s.value))
    return s
  }
  const field = (label, control) => h('label', { class: 'jam-field' }, h('span', { class: 'jam-field-name' }, label), control)

  const ui = {}
  const page = h('div', { class: 'jam', 'data-focus-root': '' })

  /* ----- header ----- */
  ui.back = btn('Back', 'ghost jam-btn jam-back', () => { try { deps.exit() } catch (_e) { /* nothing to leave */ } }, 'Leave Jam')
  ui.undo = btn('Undo', 'ghost jam-btn', () => { session.undo() }, 'Undo the last change')
  ui.export = btn('Export MIDI', 'ghost jam-btn', () => exportMidi(), 'Export the session as a MIDI file')
  ui.new = btn('New', 'ghost jam-btn', () => askNew(), 'Start a new session')
  ui.status = h('p', { class: 'jam-status', 'aria-hidden': 'true' })
  ui.live = h('div', { class: 'sr-only', role: 'status', 'aria-live': 'polite' })
  ui.problem = h('p', { class: 'jam-problem', role: 'alert' }, audioProblem)
  ui.problem.hidden = !audioProblem
  ui.confirm = h('div', { class: 'jam-confirm', role: 'group', 'aria-label': 'Start a new session' },
    h('p', {}, 'Start a new session? Every loop you made will be cleared.'),
    btn('Yes, start new', 'primary jam-btn', () => doNew(), 'Yes, start a new session'),
    ui.keep = btn('Keep working', 'ghost jam-btn', () => { ui.confirm.hidden = true; ui.new.focus() }, 'Keep working'))
  ui.confirm.hidden = true
  page.appendChild(h('header', { class: 'jam-head' },
    ui.back,
    h('h1', { class: 'jam-title', id: `jam-title-${id}` }, 'Jam'),
    h('div', { class: 'jam-head-actions' }, ui.undo, ui.export, ui.new)))
  page.append(ui.confirm, ui.problem, ui.status, ui.live)

  /* ----- transport ----- */
  ui.play = btn('Play', 'primary jam-play', () => (clock.running ? stop() : play()), 'Play')
  ui.bpmDown = btn('−', 'ghost jam-step', () => session.setBpm(session.get().bpm - 1), 'Slower by one beat per minute')
  ui.bpm = h('input', { type: 'number', min: 40, max: 220, step: 1, class: 'jam-num', 'aria-label': 'Tempo in beats per minute' })
  listen(ui.bpm, 'change', () => session.setBpm(Number(ui.bpm.value)))
  ui.bpmUp = btn('+', 'ghost jam-step', () => session.setBpm(session.get().bpm + 1), 'Faster by one beat per minute')
  const taps = []
  ui.tap = btn('Tap', 'ghost jam-btn', () => {
    const t = Date.now()
    if (taps.length && t - taps[taps.length - 1] > 2000) taps.length = 0
    taps.push(t)
    if (taps.length > 5) taps.shift()
    if (taps.length >= 2) session.setBpm(60000 / ((taps[taps.length - 1] - taps[0]) / (taps.length - 1)))
  }, 'Tap tempo')
  ui.swing = range(0, 60, 1, 'Swing', (v) => { session.setSwing(v / 100); clock.swing = v / 100 })
  ui.swingOut = h('output', { class: 'jam-out' })
  ui.metro = btn('Metronome', 'ghost jam-btn jam-toggle', () => session.setMetronome(!session.get().prefs.metronome), 'Metronome')
  ui.readout = h('div', { class: 'jam-readout', 'aria-hidden': 'true' })
  page.appendChild(h('section', { class: 'jam-card jam-transport', 'aria-label': 'Transport' },
    ui.play,
    h('div', { class: 'jam-tempo', role: 'group', 'aria-label': 'Tempo' }, ui.bpmDown, ui.bpm, ui.bpmUp, ui.tap),
    h('label', { class: 'jam-field' }, h('span', { class: 'jam-field-name' }, 'Swing'), ui.swing, ui.swingOut),
    ui.metro, ui.readout))

  /* ----- key, scale, quantise, effects ----- */
  ui.key = select('Key', KEY_NAMES.map((n, i) => [i, n]), (v) => session.setKey(Number(v)))
  ui.scale = select('Scale', Object.values(SCALES).map((s) => [s.id, s.name]), (v) => session.setScale(v))
  const lock = check('Scale lock', (on) => session.setScaleLock(on))
  const snapBox = check('Snap to scale', (on) => session.setSnap(on))
  ui.lock = lock.input; ui.snap = snapBox.input
  ui.quant = {}
  const quantRow = h('fieldset', { class: 'jam-seg' }, h('legend', {}, 'Quantise'))
  for (const q of [0, 0.5, 0.25]) {
    const input = h('input', { type: 'radio', name: `jam-q-${id}`, value: q })
    listen(input, 'change', () => { if (input.checked) session.setQuantise(q) })
    ui.quant[q] = input
    quantRow.appendChild(h('label', {}, input, h('span', {}, QUANTISE_LABEL[q])))
  }
  ui.delay = range(0, 100, 1, 'Delay amount', (v) => session.setDelay(v / 100))
  ui.reverb = range(0, 100, 1, 'Reverb amount', (v) => session.setReverb(v / 100))
  page.appendChild(h('section', { class: 'jam-card jam-music', 'aria-label': 'Key, scale and effects' },
    field('Key', ui.key), field('Scale', ui.scale), lock.label, snapBox.label, quantRow,
    field('Delay', ui.delay), field('Reverb', ui.reverb)))

  /* ----- tracks ----- */
  const instruments = instrumentOptions()
  ui.tr = []
  const trackList = h('div', { class: 'jam-tracks' })
  session.get().tracks.forEach((t, i) => {
    const r = { slots: [] }
    r.nameBtn = btn(t.name, 'ghost jam-trackname', () => session.selectTrack(i), `Play on ${t.name}`)
    r.inst = i === DRUM_TRACK ? null : select(`${t.name} instrument`, instruments.map((x) => [x.id, x.name]), (v) => {
      if (tracks[i] && !tracks[i].setInstrument(v)) { renderTracks(session.get()); return }
      session.setTrackInstrument(i, v)
    })
    r.mute = btn('Mute', 'ghost jam-btn jam-toggle', () => session.setTrackMute(i, !session.get().tracks[i].mute), `Mute ${t.name}`)
    r.level = range(0, 100, 1, `${t.name} level`, (v) => session.setTrackLevel(i, v / 100))
    r.send = range(0, 100, 1, `${t.name} effects send`, (v) => session.setTrackSend(i, v / 100))
    const slotRow = h('div', { class: 'jam-slots' })
    for (let j = 0; j < 4; j++) {
      const s = {}
      s.tap = h('button', { type: 'button', class: 'jam-slot-tap' }, h('span', { class: 'jam-slot-n' }, String(j + 1)), s.status = h('span', { class: 'jam-slot-s' }))
      listen(s.tap, 'click', () => session.tapSlot(i, j))
      s.rec = btn('Rec', 'ghost jam-mini', () => recordClick(i, j))
      s.clear = btn('Clear', 'ghost jam-mini', () => session.clearSlot(i, j))
      slotRow.appendChild(h('div', { class: 'jam-slot' }, s.tap, h('div', { class: 'jam-slot-acts' }, s.rec, s.clear)))
      r.slots.push(s)
    }
    r.row = h('section', { class: 'jam-track', 'aria-label': t.name },
      h('div', { class: 'jam-track-head' }, r.nameBtn, r.inst, r.mute),
      h('div', { class: 'jam-track-mix' },
        h('label', { class: 'jam-field' }, h('span', { class: 'jam-field-name' }, 'Level'), r.level),
        h('label', { class: 'jam-field' }, h('span', { class: 'jam-field-name' }, 'Effects'), r.send)),
      slotRow)
    trackList.appendChild(r.row)
    ui.tr.push(r)
  })
  page.appendChild(h('section', { class: 'jam-card', 'aria-label': 'Tracks' }, h('h2', { class: 'jam-h2' }, 'Tracks'), trackList))

  /* ----- drums: step grid and pads ----- */
  ui.gridTitle = h('h2', { class: 'jam-h2' })
  ui.gridWrap = h('div', { class: 'jam-gridwrap' })
  const grid = { total: 0, cells: [], focus: { d: 0, s: 0 }, cols: [] }
  ui.pads = []
  const padRow = h('div', { class: 'jam-pads', role: 'group', 'aria-label': 'Drum pads' })
  DRUMS.forEach((d, i) => {
    const pad = h('button', { type: 'button', class: 'jam-pad', 'aria-label': `${d.name} pad` }, h('span', {}, d.name), h('small', {}, DRUM_PITCH[i] === 72 ? 'C (high)' : pitchName(DRUM_PITCH[i]).replace(/\d/, '')))
    bindPress(pad, () => startNote(DRUM_TRACK, DRUM_PITCH[i], 100, `pad${i}`), () => endNote(DRUM_PITCH[i], 64, `pad${i}`))
    padRow.appendChild(pad)
    ui.pads.push(pad)
  })
  ui.drumHelp = h('p', { class: 'jam-help' }, 'On the drum track the white keys from C play the drums: ' +
    DRUMS.map((d, i) => `${i === 7 ? 'the C above' : ['C', 'D', 'E', 'F', 'G', 'A', 'B'][i]} ${d.name.toLowerCase()}`).join(', ') + '.')
  page.appendChild(h('section', { class: 'jam-card', 'aria-label': 'Drum pattern' }, ui.gridTitle, ui.gridWrap, padRow, ui.drumHelp))

  function buildGrid(total) {
    grid.total = total
    grid.cells = DRUMS.map(() => [])
    grid.cols = Array.from({ length: total }, () => [])
    const g = h('div', { class: 'jam-grid', role: 'group', 'aria-label': 'Drum steps. Arrow keys move, Space or Enter switches a step on or off', style: `--steps:${total}` })
    DRUMS.forEach((d, di) => {
      g.appendChild(h('div', { class: 'jam-grid-name' }, d.name))
      for (let s = 0; s < total; s++) {
        const c = h('button', { type: 'button', class: `jam-cell${s % 4 === 0 ? ' beat' : ''}`, tabindex: di === grid.focus.d && s === grid.focus.s ? 0 : -1 })
        listen(c, 'focus', () => moveGridFocus(di, s, false))
        listen(c, 'click', () => {
          const wasOn = c.getAttribute('aria-pressed') === 'true'
          if (session.toggleDrumStep(di, s) && !wasOn && tracks[DRUM_TRACK]) tracks[DRUM_TRACK].hit(di, { velocity: 90 })
        })
        listen(c, 'keydown', (e) => {
          const step = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key]
          if (e.key === 'Home') { e.preventDefault(); moveGridFocus(di, 0, true) }
          else if (e.key === 'End') { e.preventDefault(); moveGridFocus(di, total - 1, true) }
          else if (step) { e.preventDefault(); moveGridFocus(clamp(di + step[0], 0, 7), clamp(s + step[1], 0, total - 1), true) }
        })
        grid.cells[di].push(c)
        grid.cols[s].push(c)
        g.appendChild(c)
      }
    })
    ui.gridWrap.replaceChildren(g)
  }
  function moveGridFocus(d, s, focus) {
    if (grid.cells[grid.focus.d] && grid.cells[grid.focus.d][grid.focus.s]) grid.cells[grid.focus.d][grid.focus.s].setAttribute('tabindex', '-1')
    grid.focus = { d, s }
    const c = grid.cells[d][s]
    c.setAttribute('tabindex', '0')
    if (focus) c.focus()
  }

  /* ----- keyboard ----- */
  let keyLo = 48
  const keyEls = new Map()
  const kbHost = h('div', { class: 'jam-kbscroll' })
  ui.octDown = btn('Octave down', 'ghost jam-btn', () => shiftOctave(-12), 'Move the keyboard down one octave')
  ui.octUp = btn('Octave up', 'ghost jam-btn', () => shiftOctave(12), 'Move the keyboard up one octave')
  ui.kbHelp = h('p', { class: 'jam-help' })
  page.appendChild(h('section', { class: 'jam-card', 'aria-label': 'Keyboard' },
    h('div', { class: 'jam-kbhead' }, h('h2', { class: 'jam-h2' }, 'Keyboard'), h('div', { class: 'jam-head-actions' }, ui.octDown, ui.octUp)),
    kbHost, ui.kbHelp))

  function buildKeyboard() {
    releaseScreenKeys()
    keyEls.clear()
    const hi = keyLo + 24
    const pitches = []
    for (let p = keyLo; p <= hi; p++) pitches.push(p)
    const whites = pitches.filter((p) => !BLACK.has(mod12(p)))
    const w = 100 / whites.length
    const kb = h('div', { class: 'jam-kb', role: 'group', 'aria-label': `Keyboard from ${pitchName(keyLo)} to ${pitchName(hi)}. Arrow keys move, Space or Enter plays`, style: `--whites:${whites.length}` })
    const order = []
    let whiteIdx = 0
    for (const p of pitches) {
      const black = BLACK.has(mod12(p))
      const k = h('button', { type: 'button', class: black ? 'jam-key black' : 'jam-key white', tabindex: p === keyLo ? 0 : -1, 'data-pitch': p },
        black ? null : h('span', { class: 'jam-key-name' }))
      if (black) k.style.left = `${whiteIdx * w - w * 0.3}%`
      else whiteIdx++
      bindPress(k, () => startNote(session.get().prefs.track, p, 100, 'screen'), () => endNote(p, 64, 'screen'))
      listen(k, 'keydown', (e) => {
        const at = order.indexOf(p)
        const to = { ArrowLeft: at - 1, ArrowDown: at - 1, ArrowRight: at + 1, ArrowUp: at + 1, Home: 0, End: order.length - 1 }[e.key]
        if (to === undefined) return
        e.preventDefault()
        const next = clamp(to, 0, order.length - 1)
        keyEls.get(p).setAttribute('tabindex', '-1')
        const target = keyEls.get(order[next])
        target.setAttribute('tabindex', '0')
        target.focus()
      })
      keyEls.set(p, k)
      order.push(p)
      kb.appendChild(k)
    }
    kbHost.replaceChildren(kb)
    renderKeys(session.get())
  }
  function shiftOctave(delta) {
    keyLo = clamp(keyLo + delta, 24, 72)
    buildKeyboard()
    say(`Keyboard from ${pitchName(keyLo)} to ${pitchName(keyLo + 24)}`)
  }
  function releaseScreenKeys() {
    for (const n of [...live.values()]) if (n.channel === 'screen') endNote(Number(n.id.split(':')[1]), 64, 'screen')
  }
  const keyDown = (pitch, on) => { const k = keyEls.get(pitch); if (k) toggleClass(k, 'down', on) }
  const flashPad = (drum, on) => { const p = ui.pads[drum]; if (p) toggleClass(p, 'down', on) }

  // one handler for pointer (mouse, touch, pen) and keyboard presses on a key or pad
  function bindPress(el, down, up) {
    const pointers = new Set()
    let typed = false
    listen(el, 'pointerdown', (e) => {
      if (e.button > 0) return
      e.preventDefault()
      try { el.setPointerCapture(e.pointerId) } catch (_e) { /* not needed */ }
      pointers.add(e.pointerId)
      if (pointers.size === 1) down()
    })
    const lift = (e) => { if (pointers.delete(e.pointerId) && pointers.size === 0) up() }
    listen(el, 'pointerup', lift)
    listen(el, 'pointercancel', lift)
    listen(el, 'contextmenu', (e) => e.preventDefault())
    listen(el, 'keydown', (e) => {
      if ((e.key !== 'Enter' && e.key !== ' ') || e.repeat) return
      e.preventDefault()
      if (!typed) { typed = true; down() }
    })
    listen(el, 'keyup', (e) => {
      if ((e.key !== 'Enter' && e.key !== ' ') || !typed) return
      typed = false
      up()
    })
    listen(el, 'blur', () => { if (typed) { typed = false; up() } })
    listen(el, 'click', (e) => e.preventDefault())
  }

  root.replaceChildren(page)

  /* ============================== actions ============================== */

  function say(message) { text(ui.live, message); text(ui.status, message) }

  function recordClick(ti, si) {
    const r = session.get().rec
    const same = r.track === ti && r.slot === si
    if (r.phase === 'armed' && same) session.cancelArm()
    else if (r.phase === 'recording' && same) session.stopRecord()
    else if (r.phase === 'idle' || r.phase === 'armed') {
      if (session.armRecord(ti, si) && !clock.running) play()
    }
  }

  function exportMidi() {
    const bytes = sessionToMidi(session.dataForExport())
    const name = 'jam-session.mid'
    try {
      if (deps.download) deps.download(name, bytes, 'audio/midi')
      else {
        const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/midi' }))
        const a = h('a', { href: url, download: name })
        doc.body.appendChild(a)
        a.click()
        a.remove()
        later(() => URL.revokeObjectURL(url), 1000)
      }
      say('MIDI file saved')
    } catch (_e) {
      say('The MIDI file could not be saved')
    }
  }

  function askNew() { ui.confirm.hidden = false; ui.keep.focus() }
  function doNew() {
    ui.confirm.hidden = true
    stop()
    releaseAllLive()
    session.reset()
    ui.new.focus()
  }

  /* ============================== rendering ============================== */

  let lastAnnounce = 0
  const applied = { bpm: null, delay: null, reverb: null, lock: null, tracks: [] }

  function renderTransport(st) {
    text(ui.play, st.playing ? 'Stop' : 'Play')
    setAttr(ui.play, 'aria-label', st.playing ? 'Stop' : 'Play')
    toggleClass(ui.play, 'playing', st.playing)
    setVal(ui.bpm, st.bpm)
    setVal(ui.swing, Math.round(st.swing * 100))
    text(ui.swingOut, `${Math.round(st.swing / 0.6 * 100)}%`)
    setAttr(ui.metro, 'aria-pressed', st.prefs.metronome)
    toggleClass(ui.metro, 'on', st.prefs.metronome)
    ui.undo.disabled = !st.canUndo
    renderPlayhead()
  }

  function renderMusic(st) {
    setVal(ui.key, st.key)
    setVal(ui.scale, st.scale)
    ui.lock.checked = st.prefs.scaleLock
    ui.snap.checked = st.prefs.snap
    for (const q of QUANTISE_CHOICES) ui.quant[q].checked = st.prefs.quantise === q
    setVal(ui.delay, Math.round(st.prefs.delay * 100))
    setVal(ui.reverb, Math.round(st.prefs.reverb * 100))
  }

  function slotStatus(st, ti, si) {
    const r = st.rec
    const clip = st.tracks[ti].slots[si]
    if (r.track === ti && r.slot === si) {
      if (r.phase === 'armed') return { state: 'armed', label: r.skip > 0 ? 'armed, count-in' : 'armed' }
      if (r.phase === 'recording' || r.phase === 'stopping' || r.phase === 'closing') return { state: 'recording', label: r.phase === 'stopping' ? 'recording, stopping' : 'recording' }
    }
    if (!clip) return { state: 'empty', label: 'empty' }
    const bars = plural(barsOf(clip), 'bar')
    const active = st.tracks[ti].active[0] === si
    if (st.queue[ti] === si) return { state: 'queued', label: `starts at the next bar, ${bars}` }
    if (active && st.queue[ti] === -1) return { state: 'stopping', label: `stops at the next bar, ${bars}` }
    if (active) return { state: 'playing', label: `${st.playing ? 'playing' : 'will play'}, ${bars}` }
    return { state: 'has', label: `has a loop, ${bars}` }
  }

  function renderTracks(st) {
    st.tracks.forEach((t, i) => {
      const r = ui.tr[i]
      toggleClass(r.row, 'sel', st.prefs.track === i)
      toggleClass(r.row, 'muted', t.mute)
      setAttr(r.nameBtn, 'aria-pressed', st.prefs.track === i)
      if (r.inst) setVal(r.inst, t.instrument)
      setAttr(r.mute, 'aria-pressed', t.mute)
      toggleClass(r.mute, 'on', t.mute)
      setVal(r.level, Math.round(t.level * 100))
      setVal(r.send, Math.round(t.send * 100))
      t.slots.forEach((_c, j) => {
        const s = r.slots[j]
        const { state, label } = slotStatus(st, i, j)
        const sel = st.prefs.slots[i] === j
        s.tap.setAttribute('data-state', state)
        toggleClass(s.tap, 'sel', sel)
        setAttr(s.tap, 'aria-label', `${t.name} loop ${j + 1}, ${label}${sel ? ', selected' : ''}`)
        text(s.status, label.split(',')[0])
        const recHere = st.rec.phase !== 'idle' && st.rec.track === i && st.rec.slot === j
        let recText = 'Rec'
        let recLabel = `Record ${t.name} loop ${j + 1}`
        if (recHere && st.rec.phase === 'armed') { recText = 'Cancel'; recLabel = `Cancel recording ${t.name} loop ${j + 1}` }
        else if (recHere && st.rec.phase === 'recording') { recText = 'Stop'; recLabel = `Stop recording ${t.name} loop ${j + 1}` }
        else if (recHere) { recText = 'Stopping'; recLabel = `${t.name} loop ${j + 1} is stopping` }
        text(s.rec, recText)
        setAttr(s.rec, 'aria-label', recLabel)
        toggleClass(s.rec, 'live', recHere)
        s.rec.disabled = !recHere && st.rec.phase !== 'idle' && st.rec.phase !== 'armed'
        s.clear.disabled = !t.slots[j]
        setAttr(s.clear, 'aria-label', `Clear ${t.name} loop ${j + 1}`)
      })
    })
  }

  function renderGrid(st) {
    const slot = st.prefs.slots[DRUM_TRACK]
    const clip = st.tracks[DRUM_TRACK].slots[slot]
    const total = 16 * (clip ? barsOf(clip) : 1)
    if (grid.total !== total) buildGrid(total)
    text(ui.gridTitle, `Drum pattern, loop ${slot + 1}${clip ? '' : ' (empty)'}`)
    const on = gridFromClip(clip || { lengthBeats: BEATS_PER_BAR, events: [] }, 16)
    DRUMS.forEach((d, di) => {
      for (let s = 0; s < total; s++) {
        const c = grid.cells[di][s]
        const isOn = on[di][s] > 0
        setAttr(c, 'aria-pressed', isOn)
        toggleClass(c, 'on', isOn)
        setAttr(c, 'aria-label', `${d.name}, step ${s + 1} of ${total}, ${isOn ? 'on' : 'off'}`)
      }
    })
  }

  function renderKeys(st) {
    const drumMode = st.prefs.track === DRUM_TRACK
    const lockOn = st.prefs.scaleLock
    for (const [p, k] of keyEls) {
      const inKey = inScale(p, st.key, st.scale)
      const drum = drumMode ? drumForPitch(p) : -2
      const dim = drumMode ? drum < 0 : lockOn && !inKey
      toggleClass(k, 'dim', dim)
      toggleClass(k, 'root', !drumMode && lockOn && mod12(p - st.key) === 0)
      let name = pitchName(p)
      if (drumMode && drum >= 0) name += `, ${DRUMS[drum].name}`
      else if (dim) name += ', outside the scale'
      setAttr(k, 'aria-label', name)
      const label = k.firstChild
      if (label && label.className === 'jam-key-name') text(label, drumMode ? (drum >= 0 ? DRUMS[drum].name : '') : (mod12(p) === 0 ? pitchName(p) : ''))
    }
    const track = st.tracks[st.prefs.track]
    text(ui.kbHelp, `Playing on ${track.name}.${lockOn && !drumMode ? ` Keys outside ${KEY_NAMES[st.key]} ${SCALES[st.scale].name.toLowerCase()} are dimmed.` : ''}`)
  }

  function renderPlayhead() {
    const st = session.get()
    let readout = 'Stopped'
    let step = -1
    if (clock.running) {
      const b = currentBeat()
      readout = st.rec.phase === 'armed' && st.rec.skip > 0 ? 'Count-in' : `Bar ${Math.floor(b / BEATS_PER_BAR) + 1} · Beat ${Math.floor(b % BEATS_PER_BAR) + 1}`
      const slot = st.tracks[DRUM_TRACK].active[0]
      const clip = slot === st.prefs.slots[DRUM_TRACK] ? st.tracks[DRUM_TRACK].slots[slot] : null
      if (clip && grid.total) step = Math.floor(((b % clip.lengthBeats) / clip.lengthBeats) * grid.total)
    }
    text(ui.readout, readout)
    if (step !== grid.lastStep) {
      if (grid.lastStep >= 0 && grid.cols[grid.lastStep]) for (const c of grid.cols[grid.lastStep]) toggleClass(c, 'now', false)
      if (step >= 0 && grid.cols[step]) for (const c of grid.cols[step]) toggleClass(c, 'now', true)
      grid.lastStep = step
    }
  }
  grid.lastStep = -1

  // sound and lights follow the session
  function applyAudio(st) {
    if (st.bpm !== applied.bpm || st.prefs.delay !== applied.delay) {
      clock.setBpm(st.bpm)
      if (fx) { try { fx.setDelay({ beats: 0.75, bpm: st.bpm, feedback: 0.35, mix: st.prefs.delay }) } catch (_e) { /* no audio */ } }
      applied.bpm = st.bpm; applied.delay = st.prefs.delay
    }
    if (st.prefs.reverb !== applied.reverb) {
      if (fx) { try { fx.setReverb({ size: 0.5, mix: st.prefs.reverb }) } catch (_e) { /* no audio */ } }
      applied.reverb = st.prefs.reverb
    }
    clock.swing = st.swing
    st.tracks.forEach((t, i) => {
      const tr = tracks[i]
      const a = applied.tracks[i] || (applied.tracks[i] = {})
      if (!tr) return
      if (a.level !== t.level) { tr.setLevel(t.level); a.level = t.level }
      if (a.send !== t.send) { tr.setSend(t.send); a.send = t.send }
      if (a.mute !== t.mute) { tr.setMute(t.mute); if (t.mute) tr.silence(); a.mute = t.mute }
      if (i !== DRUM_TRACK && a.instrument !== t.instrument) { tr.setInstrument(t.instrument); a.instrument = t.instrument }
    })
    const lockKey = st.prefs.scaleLock ? `${st.key}:${st.scale}` : ''
    if (lockKey !== applied.lock) {
      applied.lock = lockKey
      if (lights) {
        try {
          if (lockKey) lights.show(scalePitches(st.key, st.scale, 21, 108), LIGHT_COLOUR)
          else lights.clear()
        } catch (_e) { /* no keyboard attached */ }
      }
    }
  }

  function render(st) {
    renderTransport(st)
    renderMusic(st)
    renderTracks(st)
    renderGrid(st)
    renderKeys(st)
    applyAudio(st)
    if (st.announce.n !== lastAnnounce) {
      lastAnnounce = st.announce.n
      say(st.announce.text)
    }
  }

  const unsubscribe = session.subscribe((st) => {
    if (!alive) return
    dirty = true
    if (saveTimer) { clearTimeout(saveTimer); timers.delete(saveTimer) }
    saveTimer = later(() => { saveTimer = 0; flush() }, 500)
    render(st)
  })

  buildGrid(16)
  buildKeyboard()
  // the announcement counter starts at the current value: nothing is said on opening
  lastAnnounce = session.get().announce.n
  render(session.get())

  /* ============================== the returned handle ============================== */

  function destroy() {
    if (!alive) return
    stop()
    cancelClicks()
    alive = false
    mounted.delete(root)
    clock.stop()
    unWindow()
    unsubscribe()
    clearInterval(sweepTimer); clearInterval(tickTimer)
    for (const t of timers) clearTimeout(t)
    timers.clear()
    pending = []
    voices = []
    live.clear()
    for (const tr of tracks) {
      try { tr.silence() } catch (_e) { /* already gone */ }
      try { tr.dispose() } catch (_e) { /* already gone */ }
    }
    tracks = []
    if (lights) { try { lights.clear() } catch (_e) { /* no keyboard attached */ } }
    flush()
    for (const fn of cleanups.splice(0)) fn()
    root.replaceChildren()
  }

  const api = {
    destroy,
    noteOn: (pitch, vel = 100, channel = 0) => startNote(session.get().prefs.track, pitch, vel, channel),
    noteOff: (pitch, lift = 64, channel = 0) => endNote(pitch, lift, channel),
    bend: (channel, semis) => gesture(channel, 'bend', semis),
    press: (channel, v) => gesture(channel, 'press', v),
    slide: (channel, v) => gesture(channel, 'slide', v),
    state: () => ({
      alive,
      playing: clock.running,
      beat: currentBeat(),
      session: session.get(),
      heldNotes: live.size,
      pendingGestures: pending.length,
      soundOk: tracks.length === session.get().tracks.length,
      trackCount: tracks.length,
      scheduled
    })
  }
  mounted.set(root, api)
  return api
}
