// Web Audio: expressive MPE instrument engine, metronome click, backing player
import { Voice, INSTRUMENTS, prepareInstrument } from './instruments.js'
import { loadPiano, pianoStatus } from './sampler.js'
import { createFx } from './jam/fx.js'
import { playDrum } from './jam/drums.js'

// Everything ends in one soft limiter, after the volume, so the output never clips:
//   synthIn (keys, song notes, band, clicks: level x volume) -> limiter -> speakers
//   backingGain -> master (recordings and backing tracks: volume) -> limiter
let ctx = null
let synthIn = null
let keyIn = null              // Airwave affects instruments only, before the shared limiter
let airGain = null
let airTone = null
let airPan = null
let airExpression = { raise: 0, tilt: 0, grasp: 0 }
let master = null
let backingGain = null
let hush = null               // silent sink for the warm-up notes
let limiter = null            // the last node before the speakers: takes are recorded from it
let volume = 0.8
let backingSource = null
let backingBuffer = null      // accompaniment (piano muted)
let fullBuffer = null         // full mix (piano included)
let activeKind = 'backing'
let backingStartedAt = 0
let backingOffset = 0
let backingRate = 1

// Level: one mf grand-piano note (velocity 90) peaks at about -8 dBFS with the volume
// at 80 %. The limiter comes after the volume, so a big chord is rounded off instead of
// clipping at any volume. It is a WaveShaper, which adds no delay (a DynamicsCompressor
// would add 6 ms of lookahead): unity gain up to LIMIT_KNEE (single notes and a
// recording at its default level stay under it), then a tanh shoulder that never
// passes LIMIT_CEILING. A WaveShaper hard-clips whatever falls outside its curve's
// [-1, 1] input, so the curve spans ±LIMIT_RANGE and everything is scaled down by that
// much on the way in.
const SYNTH_LEVEL = 0.62
const LIMIT_KNEE = 0.7
const LIMIT_CEILING = 0.98
const LIMIT_RANGE = 8
const busGain = (vol) => (SYNTH_LEVEL * vol) / LIMIT_RANGE
let curve = null
function limiterCurve() {
  if (curve) return curve
  const n = 8193, span = LIMIT_CEILING - LIMIT_KNEE
  curve = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = LIMIT_RANGE * ((2 * i) / (n - 1) - 1), a = Math.abs(x)
    curve[i] = Math.sign(x) * (a <= LIMIT_KNEE ? a : LIMIT_KNEE + span * Math.tanh((a - LIMIT_KNEE) / span))
  }
  return curve
}

// The output chain on any context; offline renders (the perf probe) build it too, so
// they measure exactly what plays. `input` takes the synth, `recordings` mastered
// audio; both carry 1/range of full scale into the limiter.
export function buildOutputChain(context, vol = volume) {
  const stereo = { channelCount: 2, channelCountMode: 'explicit' }
  const input = new GainNode(context, { gain: busGain(vol), ...stereo })
  const recordings = new GainNode(context, { gain: vol / LIMIT_RANGE, ...stereo })
  const limiter = new WaveShaperNode(context, { curve: limiterCurve(), oversample: 'none' })
  input.connect(limiter)
  recordings.connect(limiter)
  return { input, recordings, output: limiter, range: LIMIT_RANGE, knee: LIMIT_KNEE }
}

// Ask for the smallest output buffer the device allows: 128 frames (2.7 ms at 48 kHz)
// where 'interactive' takes 256 on a Mac, and the device's own path shrinks with it
// (MacBook Air speakers: 2.7 + 28 ms instead of 5.3 + 33 ms). A machine that can't
// keep up drops out; then the next start uses the standard buffer (watchDropouts).
const LOW_LATENCY = 0.002
const SAFE_BUFFER_KEY = 'lumi.audioSafeBuffer'
const safeBuffer = () => { try { return localStorage.getItem(SAFE_BUFFER_KEY) === '1' } catch (_e) { return false } }

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx }
  // no sampleRate option: the context runs at the device's own rate (no resampling)
  ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: safeBuffer() ? 'interactive' : LOW_LATENCY })
  const out = buildOutputChain(ctx, volume)
  synthIn = out.input
  keyIn = new GainNode(ctx)
  airGain = new GainNode(ctx)
  airTone = new BiquadFilterNode(ctx, { type: 'highshelf', frequency: 2000, gain: 0 })
  airPan = new StereoPannerNode(ctx, { pan: 0 })
  keyIn.connect(airGain).connect(airTone).connect(airPan).connect(synthIn)
  setAirExpression(airExpression)
  master = out.recordings
  limiter = out.output
  limiter.connect(ctx.destination)
  backingGain = new GainNode(ctx, { gain: 0.7 })
  backingGain.connect(master)
  warm(instrument)
  watchDropouts()
  watchOutputs()
  return ctx
}
export const audioContext = () => ctx
// raise/grasp: 0..1, tilt: -1..1. null (disable/lost tracking) resets to unity.
// Saved master volume and backing/click/band levels are never modified.
export function setAirExpression(value = null) {
  const bounded = (v, low, high) => Number.isFinite(v) ? Math.max(low, Math.min(high, v)) : 0
  airExpression = {
    raise: bounded(value?.raise, 0, 1),
    tilt: bounded(value?.tilt, -1, 1),
    grasp: bounded(value?.grasp, 0, 1)
  }
  if (!ctx) return
  const t = ctx.currentTime
  airGain.gain.setTargetAtTime((1 + 0.35 * airExpression.raise) * (1 - 0.45 * airExpression.grasp), t, 0.05)
  airTone.gain.setTargetAtTime(4 * airExpression.raise - 8 * airExpression.grasp, t, 0.05)
  airPan.pan.setTargetAtTime(0.65 * airExpression.tilt, t, 0.05)
}
export function loadSampledPiano() { return loadPiano(initAudio()) }
export const sampledPianoStatus = () => pianoStatus(ctx)
export function setVolume(v) {
  volume = Math.max(0, Math.min(1, v))
  if (!ctx) return
  // a short glide, so dragging the slider doesn't crackle
  const t = ctx.currentTime
  synthIn.gain.setTargetAtTime(busGain(volume), t, 0.015)
  master.gain.setTargetAtTime(volume / LIMIT_RANGE, t, 0.015)
}

let instrument = 'grand'
let bendRangeSemis = 48
const voices = new Map()

// Build an instrument's waves and samples and play it once, silently, so the first key
// press doesn't pay for that (on a fresh context it costs a few milliseconds).
function warm(id) {
  if (!hush) {
    hush = new GainNode(ctx, { gain: 0 })
    hush.connect(ctx.destination)
    // the built-in waves (e-piano modulator, click, band) build their tables on first use
    for (const type of ['sine', 'square', 'triangle']) new OscillatorNode(ctx, { type })
  }
  prepareInstrument(ctx, id)
  if (id === 'sampled-piano' && pianoStatus(ctx).state !== 'ready') return
  for (const pitch of [36, 60, 84]) new Voice(ctx, hush, pitch, 1, id, bendRangeSemis).release(0.02)
}

const vkey = (channel, pitch) => channel + ':' + pitch
export function setInstrument(id) {
  if (!INSTRUMENTS.some((i) => i.id === id)) return false
  // Never silently substitute a synthesised sound under a sampled-piano label.
  if (id === 'sampled-piano' && pianoStatus(ctx).state !== 'ready') return false
  instrument = id
  stopAll()
  if (ctx) warm(id)
  return true
}
export const currentInstrument = () => instrument
export const instrumentList = () => INSTRUMENTS
export function setBendRange(semis) { bendRangeSemis = semis }

// Keys let go while the sustain pedal is down keep ringing until the pedal comes up.
let pedalDown = false
const pedalled = new Map()
const MAX_VOICES = 40

export function noteOn(pitch, velocity = 100, channel = 0) {
  if (!ctx) return null
  const k = vkey(channel, pitch)
  for (const m of [voices, pedalled]) {
    const old = m.get(k)
    if (old) { m.delete(k); old.voice.release(0.06) }
  }
  // too many notes ringing (long pedal): let the oldest pedalled ones go first
  while (voices.size + pedalled.size >= MAX_VOICES) {
    const m = pedalled.size ? pedalled : voices
    const [oldK, oldE] = m.entries().next().value
    m.delete(oldK)
    oldE.voice.release(0.08)
  }
  const v = new Voice(ctx, keyIn, pitch, velocity, instrument, bendRangeSemis)
  voices.set(k, { voice: v, pitch, channel })
  notesStarted++
  return v
}
export function noteOff(pitch, channel = 0) {
  const k = vkey(channel, pitch)
  const entry = voices.get(k)
  if (!entry) return
  voices.delete(k)
  if (pedalDown) pedalled.set(k, entry)
  else entry.voice.release()
}
export function setSustain(down) {
  pedalDown = !!down
  if (pedalDown) return
  for (const e of pedalled.values()) e.voice.release()
  pedalled.clear()
}
export const sustainDown = () => pedalDown
export function setBend(channel, semitones) {
  for (const e of voices.values()) if (e.channel === channel) e.voice.setBend(semitones)
}
export function setPressure(channel, value) {
  for (const e of voices.values()) if (e.channel === channel) e.voice.setPressure(value)
}
export function setSlide(channel, value) {
  for (const e of voices.values()) if (e.channel === channel) e.voice.setSlide(value)
}
export function setPolyPressure(pitch, channel, value) {
  const e = voices.get(vkey(channel, pitch))
  if (e) e.voice.setPressure(value)
}
export function activeVoiceCount() { return voices.size + pedalled.size }
export function voiceState(channel, pitch) {
  const e = voices.get(vkey(channel, pitch))
  if (!e) return null
  return { pressure: e.voice.pressure, slide: e.voice.slide, bend: e.voice.bend, instrument: e.voice.id }
}
export const playNote = noteOn
export const stopNote = noteOff

// ---------- scheduled song notes ----------
// Song playback is scheduled on the audio clock a little ahead of time, so notes
// start sample-accurately regardless of screen refresh, and a repeated pitch
// always sounds again. Scheduled voices are separate from the keys you play.
const scheduled = new Set()
export function scheduleNote(pitch, velocity, when, duration) {
  if (!ctx) return null
  const v = new Voice(ctx, keyIn, pitch, velocity, instrument, bendRangeSemis, when)
  // end slightly early so a repeat of the same pitch is clearly re-struck
  v.release(Math.min(0.3, v.shape.release), when + Math.max(0.04, duration - 0.015))
  const entry = { voice: v, end: when + duration + 0.3 }
  scheduled.add(entry)
  if (scheduled.size > 64) for (const e of scheduled) if (e.end < ctx.currentTime) scheduled.delete(e)
  notesStarted++
  return v
}
// Silence everything queued or sounding from the song (seek, pause, wait, loop).
export function cancelScheduled() {
  if (!ctx) return
  for (const e of scheduled) {
    e.voice.dead = false
    e.voice.release(0.04)
  }
  scheduled.clear()
}

export function stopAll() {
  for (const m of [voices, pedalled]) {
    for (const e of m.values()) e.voice.release(0.05)
    m.clear()
  }
}

// Fixed sounds keep the balance they had against the piano: the click sits about 3 dB
// under a mf piano note, the band's bass level with it and the hi-hat well under.
const CLICK_LEVEL = 0.63
const BASS_LEVEL = 0.84
const HAT_LEVEL = 0.47

export function click(accent = false, when = null) {
  if (!ctx) return
  const t = when == null ? ctx.currentTime : Math.max(ctx.currentTime, when)
  const o = new OscillatorNode(ctx, { type: 'square', frequency: accent ? 1760 : 1320 })
  const g = new GainNode(ctx, { gain: 0 })
  g.gain.setValueAtTime(CLICK_LEVEL, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
  o.connect(g).connect(synthIn); o.start(t); o.stop(t + 0.06)
  clicks.add(o); o.onended = () => clicks.delete(o)
}
// Silence queued clicks (a count-in or a rhythm exercise stopped part way).
const clicks = new Set()
export const pendingClicks = () => clicks.size
export function cancelClicks() {
  for (const o of [...clicks]) { try { o.stop() } catch { /* already ended */ } try { o.disconnect() } catch { /* ok */ } }
  clicks.clear()
}

// ---------- take recording ----------
// A copy of exactly what the speakers get (after the volume and the limiter) as a
// stereo MediaStream, for the take recorder (recorder.js). It is made only when a take
// starts and taken apart by release() when the take ends, so nothing extra runs while
// nothing is recorded. The AudioContext is made once and never re-created, and a new
// output device (setOutput, or a device coming and going) only moves ctx.destination,
// so the copy keeps going through it. A muted page (test runs) still records sound.
export function recordingStream() {
  initAudio()
  const dest = new MediaStreamAudioDestinationNode(ctx, { channelCount: 2, channelCountMode: 'explicit', channelInterpretation: 'speakers' })
  limiter.connect(dest)
  let released = false
  const release = () => {
    if (released) return
    released = true
    try { limiter.disconnect(dest) } catch (_e) {}
    for (const t of dest.stream.getTracks()) t.stop()
  }
  return { stream: dest.stream, release, sampleRate: ctx.sampleRate }
}

// ---------- output device and latency ----------
// What the output adds between a sound being rendered and it being heard, in seconds:
// base is the browser's buffer, output the device's own path (28 ms on a MacBook Air's
// built-in speakers, 7 ms on a USB output). output reads 0 until the device has been
// playing for a moment. underruns counts dropouts since start (null if not reported).
export function latencyInfo() {
  if (!ctx) return { base: 0, output: 0, sampleRate: 0, sinkId: preferredSink, underruns: null }
  const stats = ctx.playbackStats
  return {
    base: ctx.baseLatency || 0,
    output: ctx.outputLatency || 0,
    sampleRate: ctx.sampleRate,
    sinkId: typeof ctx.sinkId === 'string' ? ctx.sinkId : '',
    underruns: stats ? stats.underrunEvents : null
  }
}

// The audio outputs for a picker, system default first ({ id: '' }). Labels need media
// permission, which main.js grants, so they are the device names.
export async function listOutputs() {
  let devices = []
  try { devices = await navigator.mediaDevices.enumerateDevices() } catch (_e) {}
  const outs = devices.filter((d) => d.kind === 'audiooutput')
  const def = outs.find((d) => d.deviceId === 'default')
  const list = [{ id: '', label: def && def.label ? 'System default (' + def.label.replace(/^Default - /, '') + ')' : 'System default' }]
  for (const d of outs) {
    if (d.deviceId === 'default' || d.deviceId === 'communications') continue
    list.push({ id: d.deviceId, label: d.label || 'Output ' + list.length })
  }
  return list
}

// Play everything on the output `deviceId` ('' = system default). The choice is kept:
// while that device is unplugged sound goes to the default, and it moves back when the
// device returns. Resolves true when that device is playing, false when the default
// plays instead.
let preferredSink = ''
export async function setOutput(deviceId = '') {
  preferredSink = deviceId || ''
  initAudio()
  return applySink()
}
async function applySink() {
  if (!ctx || !ctx.setSinkId) return false
  let target = preferredSink
  if (target && !(await listOutputs()).some((o) => o.id === target)) target = ''
  if ((ctx.sinkId || '') !== target) {
    try {
      await ctx.setSinkId(target)
    } catch (e) {
      console.log('AUDIO output not available (' + e.message + '), using the default')
      target = ''
      try { await ctx.setSinkId('') } catch (_e) {}
    }
    console.log('AUDIO output=' + (target ? 'device' : 'default') + ' base=' + (ctx.baseLatency * 1000).toFixed(1) + 'ms')
  }
  return target === preferredSink
}
function watchOutputs() {
  const md = navigator.mediaDevices
  if (md && md.addEventListener) md.addEventListener('devicechange', () => { if (preferredSink) applySink() })
}

// Count the dropouts a listener could hear: each second's new dropouts count when a note
// was started or something was sounding. Nine within half a minute mean this machine
// can't keep up with the small buffer, and the next start uses the standard one.
// Dropouts in silence (app start, a recording being transcribed) don't count.
let notesStarted = 0
function watchDropouts() {
  if (!ctx.playbackStats) return
  let last = ctx.playbackStats.underrunEvents, logged = 0
  const heard = []
  setInterval(() => {
    const n = ctx.playbackStats.underrunEvents, d = n - last
    const sounding = notesStarted > 0 || voices.size + pedalled.size > 0 || !!backingSource || !!(rec && !rec.el.paused)
    last = n
    notesStarted = 0
    if (d <= 0) return
    if (logged++ < 10) console.log('AUDIO dropouts=' + d + (sounding ? '' : ' (in silence)') + ' total=' + n + ' buffer=' + (ctx.baseLatency * 1000).toFixed(1) + 'ms')
    if (!sounding || ctx.baseLatency > 0.004 || safeBuffer()) return
    const now = performance.now()
    for (let i = 0; i < d; i++) heard.push(now)
    while (now - heard[0] > 30000) heard.shift()
    if (heard.length >= 9) {
      try { localStorage.setItem(SAFE_BUFFER_KEY, '1') } catch (_e) {}
      console.log('AUDIO the small buffer drops out on this machine: the next start uses the standard one')
    }
  }, 1000)
}

// ---------- backing track ----------
// User-supplied audio; playbackRate = practice speed (pitch follows the rate, which is
// acceptable for 75 % / 100 % practice).
export async function loadBackingFile(file, kind = 'backing') {
  initAudio()
  const buf = await file.arrayBuffer()
  const decoded = await ctx.decodeAudioData(buf)
  if (kind === 'full') fullBuffer = decoded
  else backingBuffer = decoded
  return decoded.duration
}
export const hasBacking = () => !!(backingBuffer || fullBuffer)
export const backingDuration = () => (backingBuffer || fullBuffer) ? (backingBuffer || fullBuffer).duration : 0
// Mute-piano stem selection: while playing, prefer the accompaniment (piano muted);
// while watching, prefer the full mix so the demo sounds complete.
export function pickStem(watching) {
  if (watching) return fullBuffer ? 'full' : backingBuffer ? 'backing' : null
  return backingBuffer ? 'backing' : fullBuffer ? 'full' : null
}

// ---------- imported recording ----------
// Played through a media element so practice speeds keep the pitch
// (preservesPitch); a buffer source would play 0.75x five semitones flat.
// It is routed through the same audio graph, so it shares the song clock's latency.
let rec = null              // { el, node, url }
let recToken = 0            // bumped on every load/unload: a late load can't attach to another song
let recTimers = []
const clearRecTimers = () => { for (const t of recTimers) clearTimeout(t); recTimers = [] }
function dropRecording() {
  clearRecTimers()
  if (!rec) return
  try { rec.el.pause(); rec.node.disconnect() } catch (_e) {}
  URL.revokeObjectURL(rec.url)
  rec.el.removeAttribute('src'); rec.el.load()
  rec = null
}
export async function loadRecording(blob) {
  initAudio()
  const token = ++recToken
  dropRecording()
  const url = URL.createObjectURL(blob)
  const el = new Audio()
  el.preload = 'auto'
  el.preservesPitch = true
  el.src = url
  try {
    await new Promise((resolve, reject) => { el.oncanplay = resolve; el.onerror = () => reject(new Error('This recording cannot be played')) })
  } catch (e) { URL.revokeObjectURL(url); throw e }
  if (token !== recToken) { URL.revokeObjectURL(url); return false }   // another song took over meanwhile
  const node = ctx.createMediaElementSource(el)
  node.connect(backingGain)
  rec = { el, node, url }
  return true
}
export function unloadRecording() { ++recToken; dropRecording() }
export const hasRecording = () => !!rec

// Play from song position `offset` at `rate`, starting at audio-clock time `when`
// (in the future during a count-in), and stop at song position `until`.
export function playRecording(offset, rate, when, until = null) {
  if (!rec || !ctx) return
  clearRecTimers()
  const el = rec.el
  el.playbackRate = rate
  const start = () => {
    const late = Math.max(0, ctx.currentTime - when) * rate
    const from = Math.max(0, offset + late)
    el.currentTime = from
    el.play().catch(() => {})
    if (until != null && Number.isFinite(until)) recTimers.push(setTimeout(() => el.pause(), Math.max(0, (until - from) / rate) * 1000))
  }
  const delay = (when - ctx.currentTime) * 1000
  if (delay > 5) recTimers.push(setTimeout(start, delay)); else start()
}
export function pauseRecording() { clearRecTimers(); if (rec) rec.el.pause() }
export const recordingPosition = () => (rec && !rec.el.paused ? rec.el.currentTime : null)
export function nudgeRecording(t) { if (rec) rec.el.currentTime = Math.max(0, t) }

// Forget attached audio (a new song brings its own, or none).
export function clearBacking() {
  stopBacking()
  backingBuffer = null
  fullBuffer = null
}
export const isBackingPlaying = () => !!backingSource

// `when` (audio-clock time) lets the recording start exactly with the song clock,
// e.g. after a count-in.
export function playBacking(offset = 0, rate = 1, watching = false, when = null) {
  const kind = pickStem(watching)
  const buffer = kind === 'full' ? fullBuffer : kind === 'backing' ? backingBuffer : null
  if (!ctx || !buffer) return
  stopBacking()
  activeKind = kind
  const src = ctx.createBufferSource()
  src.buffer = buffer
  src.playbackRate.value = rate
  src.connect(backingGain)
  const startAt = when == null ? ctx.currentTime : Math.max(ctx.currentTime, when)
  // starting late (e.g. resuming mid-song) skips into the file by the same amount
  const late = Math.max(0, ctx.currentTime - (when == null ? ctx.currentTime : when)) * rate
  const safe = Math.max(0, Math.min(buffer.duration - 0.01, offset + late))
  src.start(startAt, safe)
  src.onended = () => { if (backingSource === src) backingSource = null }
  backingSource = src
  backingStartedAt = startAt
  backingOffset = safe
  backingRate = rate
}
export function stopBacking() {
  if (backingSource) { try { backingSource.stop() } catch (_e) {} ; backingSource = null }
}
export const activeStem = () => activeKind
export function backingPosition() {
  if (!backingSource || !ctx) return backingOffset
  return backingOffset + (ctx.currentTime - backingStartedAt) * backingRate
}
export function setBackingVolume(v) { if (backingGain) backingGain.gain.value = Math.max(0, Math.min(1, v)) }


// ---------- generated band (fallback accompaniment) ----------
let noiseBuffer = null
function getNoise() {
  if (noiseBuffer || !ctx) return noiseBuffer
  const len = Math.floor(ctx.sampleRate * 0.25)
  noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = noiseBuffer.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  return noiseBuffer
}

export function playBass(pitch, duration = 0.32, when = null) {
  if (!ctx) return
  const t = when == null ? ctx.currentTime : Math.max(ctx.currentTime, when)
  const f = 440 * Math.pow(2, (pitch - 69) / 12)
  const o = new OscillatorNode(ctx, { type: 'triangle', frequency: f })
  const lp = new BiquadFilterNode(ctx, { frequency: 520 })
  const g = new GainNode(ctx, { gain: 0 })
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(BASS_LEVEL, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  o.connect(lp).connect(g).connect(synthIn)
  o.start(t); o.stop(t + duration + 0.03)
}

export function playHat(accent = false, when = null) {
  if (!ctx) return
  const t = when == null ? ctx.currentTime : Math.max(ctx.currentTime, when)
  const src = new AudioBufferSourceNode(ctx, { buffer: getNoise() })
  const hp = new BiquadFilterNode(ctx, { type: 'highpass', frequency: 6000 })
  const g = new GainNode(ctx, { gain: 0 })
  g.gain.setValueAtTime(HAT_LEVEL * (accent ? 1 : 0.55), t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + (accent ? 0.09 : 0.05))
  src.connect(hp).connect(g).connect(synthIn)
  src.start(t); src.stop(t + 0.12)
}

// ---------- Jam tracks ----------
// Looped layers of the Jam screen. Each track has its own instrument and gain, and all of
// them draw from one pool of voices. They never touch the keys' own voices (`voices`,
// `pedalled`) or the song's (`scheduled`), so the global instrument change and stopAll
// leave them alone, and they skip the Airwave stage (keyIn):
//   voice -> track gain -> synthIn;  track gain -> send gain -> effects -> synthIn
const JAM_MAX_VOICES = 32
// Four tracks together sit about where one hand of chords does on the normal path.
const JAM_TRACK_TRIM = 0.5
const jamVoices = new Set()   // { voice, track, replayed, released, done, seq }
let jamSeq = 0
let jamEffects = null

export function jamFx() {
  initAudio()
  if (!jamEffects) jamEffects = createFx(ctx, synthIn)
  return jamEffects
}
export const jamVoiceCount = () => jamVoices.size

// lift 0..127 -> a factor on the instrument's own release: 2x for a slow lift, 1x at 64,
// 0.35x for a fast one
export function liftFactor(lift) {
  const l = Math.max(0, Math.min(127, Number.isFinite(lift) ? lift : 64))
  return l <= 64 ? 2 - l / 64 : 1 - (0.65 * (l - 64)) / 63
}

// Make room for one more: a released note still fading goes first, then the oldest
// replayed note (started with a time), then the oldest live one.
function jamStealOne() {
  let pick = null
  const rank = (e) => (e.released ? 0 : e.replayed ? 1 : 2)
  for (const e of jamVoices) if (!pick || rank(e) < rank(pick)) pick = e
  if (!pick) return
  jamVoices.delete(pick)
  pick.done = true
  pick.released = true
  // Voice.release marks even a future release dead immediately. Replace that
  // scheduled fade so a stolen note stops now, including before its start time.
  pick.voice.dead = false
  pick.voice.release(0.04)
}

export function createTrack({ kind = 'notes', instrument: startInstrument = 'lead', level = 0.8, send = 0 } = {}) {
  initAudio()
  const effects = jamFx()
  const drums = kind === 'drums'
  const trim = drums ? 1 : JAM_TRACK_TRIM
  const gain = new GainNode(ctx, { gain: level * trim })
  const sendGain = new GainNode(ctx, { gain: send })
  gain.connect(synthIn)
  gain.connect(sendGain).connect(effects.input)
  let current = startInstrument, lvl = level, muted = false, disposed = false
  const mine = new Set()
  // a short linear glide: a gain with nothing playing through it is not processed, and
  // setTargetAtTime would then start late, on the first note after the change
  const glide = (param, to) => {
    const t = ctx.currentTime
    param.cancelScheduledValues(t)
    param.setValueAtTime(param.value, t)
    param.linearRampToValueAtTime(to, t + 0.01)
  }
  const apply = () => glide(gain.gain, muted ? 0 : lvl * trim)
  const common = {
    setLevel(v) { lvl = Math.max(0, Math.min(1, v)); apply() },
    setSend(v) { glide(sendGain.gain, Math.max(0, Math.min(1, v))) },
    setMute(on) { muted = !!on; apply() }
  }
  const finish = (e) => { e.done = true; jamVoices.delete(e); mine.delete(e) }
  const dispose = (silence) => () => {
    silence()
    if (disposed) return
    disposed = true
    for (const n of [gain, sendGain]) { try { n.disconnect() } catch (_e) {} }
  }

  if (drums) {
    const hits = new Set()
    const silence = () => { for (const h of hits) h.stop(); hits.clear() }
    return {
      ...common,
      hit(index, { when = null, velocity = 100 } = {}) {
        if (disposed) return null
        const h = playDrum(ctx, gain, index, { when, velocity })
        hits.add(h)
        const first = h.sources && h.sources[0]
        if (first) first.addEventListener('ended', () => hits.delete(h))
        return h
      },
      silence,
      dispose: dispose(silence)
    }
  }

  const silence = () => {
    for (const e of [...mine]) {
      if (!e.done) {
        e.released = true
        e.voice.dead = false
        e.voice.release(0.04)
      }
      finish(e)
    }
  }
  const live = (h) => h && !h.done && !h.released
  return {
    ...common,
    noteOn(pitch, velocity = 100, when = null) {
      if (disposed) return null
      while (jamVoices.size >= JAM_MAX_VOICES) jamStealOne()
      let voice
      try { voice = new Voice(ctx, gain, pitch, velocity, current, bendRangeSemis, when) } catch (_e) { return null }
      const entry = { voice, track: this, replayed: when != null, released: false, done: false, seq: jamSeq++ }
      jamVoices.add(entry)
      mine.add(entry)
      ;(voice.oscillators ? voice.oscillators[0] : voice.source).addEventListener('ended', () => finish(entry))
      return entry
    },
    noteOff(h, { lift = 64, when = null } = {}) {
      if (!live(h)) return
      h.released = true
      h.voice.release(h.voice.shape.release * liftFactor(lift), when)
      // Keep the entry until its source ends, even though Voice.dead is already
      // true: silence and stealing must still be able to shorten this release.
    },
    bend(h, semitones) { if (live(h)) h.voice.setBend(semitones) },
    press(h, v) { if (live(h)) h.voice.setPressure(v) },
    slide(h, v) { if (live(h)) h.voice.setSlide(v) },
    setInstrument(id) {
      if (!INSTRUMENTS.some((i) => i.id === id)) return false
      if (id === 'sampled-piano' && pianoStatus(ctx).state !== 'ready') return false
      current = id
      prepareInstrument(ctx, id)
      return true
    },
    instrument: () => current,
    silence,
    dispose: dispose(silence)
  }
}
