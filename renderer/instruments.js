// Expressive MPE instrument engine.
// Each note is a voice with three continuous dimensions, matching the ROLI
// expression model:
//   pressure (channel pressure / poly aftertouch) -> loudness + brightness
//   slide    (CC74)                                -> timbre (filter / harmonics)
//   bend     (pitch wheel, per channel)            -> glide, and vibrato when wiggled
// Built-in instruments are synthesised locally; the optional sampled piano uses
// Alexander Holm's Salamander samples (CC BY 3.0; see LICENSES/piano-samples.md).
import { SampleVoice, loadPiano } from './sampler.js'
//
// A key press builds its voice from as few audio nodes as possible: every node is
// work for the audio thread, and the whole voice is built while the key waits. Each
// oscillator plays a periodic wave that already holds a whole layer (every partial at
// its level), so a piano note is three oscillators, a hammer sample, a filter and an
// envelope. Waves and samples are built once per audio context (prepareInstrument),
// since building a wave runs FFTs and takes about half a millisecond.

export const INSTRUMENTS = [
  { id: 'grand', name: 'Grand Piano', short: 'Piano' },
  { id: 'sampled-piano', name: 'Salamander Piano (sampled)', short: 'Sampled', sampled: true },
  { id: 'epiano', name: 'Electric Piano', short: 'E.Piano' },
  { id: 'tine', name: 'Tine Electric Piano', short: 'Tine' },
  { id: 'organ', name: 'Drawbar Organ', short: 'Organ' },
  { id: 'harpsichord', name: 'Harpsichord', short: 'Harpsi' },
  { id: 'marimba', name: 'Marimba', short: 'Marimba' },
  { id: 'nylon', name: 'Nylon Guitar', short: 'Nylon' },
  { id: 'warm-pad', name: 'Warm Analogue Pad', short: 'Warm Pad' },
  { id: 'flute', name: 'Flute', short: 'Flute' },
  { id: 'cello', name: 'Cello', short: 'Cello' },
  { id: 'strings', name: 'String Ensemble', short: 'Strings' },
  { id: 'bass', name: 'Bass', short: 'Bass' },
  { id: 'lead', name: 'Synth Lead', short: 'Lead' },
  { id: 'pad', name: 'Synth Pad', short: 'Pad' }
]

// How each instrument's level moves over time.
// Struck instruments (piano family, bass) ring down by themselves while the key is
// held, like a real string, and are damped when the key (or the pedal) comes up.
// Held instruments (flute, bowed strings, synths) stay up until the key is let go.
//   level    loudness trim, so every instrument sounds about as loud as the piano;
//            held ones sit 1.5 dB under it, since they don't decay and their
//            chords stay loud for as long as they are held
//   attack   seconds to the first peak. Kept short everywhere: a slow fade-in is
//            heard as lag between the key and the sound.
//   body     level a struck note settles to just after the hit, and how fast (bodyTau)
//   ring     seconds a held struck note takes to fade by 60 dB, at middle C
//            (lower notes ring longer, higher notes shorter)
//   bright   filter cutoff at the strike (at least brightPerHz x the note's frequency),
//            lower for soft notes (velBright); it falls towards dark (darkPerHz x the
//            frequency) as the note rings, over darkTau seconds at middle C (ring / 5
//            when not given)
//   hammer   level of the hammer knock (grand piano)
//   onset    level a held instrument starts at; it then swells to full (swellTau)
//   release  seconds from key-up to silence
//   swell    how much louder pressing into a held key makes a held instrument
//            (pressure only adds: resting on a key never makes it quieter)
const SHAPES = {
  grand: {
    level: 1, attack: 0.0015, body: 0.55, bodyTau: 0.25, ring: 11, release: 0.32,
    bright: 7000, brightPerHz: 20, velBright: 0.55, dark: 1000, darkPerHz: 3.5, darkTau: 0.8, hammer: 0.4
  },
  epiano: { level: 0.785, attack: 0.003, body: 0.55, bodyTau: 0.3, ring: 7, release: 0.28, bright: 5000, dark: 2000 },
  tine: { level: 0.85, attack: 0.002, body: 0.65, bodyTau: 0.22, ring: 8, release: 0.3, bright: 8000, dark: 2400, fmRatio: 7, fmPeak: 0.65, fmBody: 0.035, fmTau: 0.18 },
  organ: { level: 0.75, attack: 0.005, onset: 1, swellTau: 0.03, release: 0.09, swell: 0.25, cutoff: 6500 },
  harpsichord: { level: 0.8, attack: 0.001, body: 0.42, bodyTau: 0.09, ring: 4, release: 0.12, bright: 11000, dark: 3200, darkTau: 0.3 },
  marimba: { level: 1, attack: 0.002, body: 0.48, bodyTau: 0.1, ring: 3.5, release: 0.22, bright: 6500, dark: 1600, darkTau: 0.15 },
  nylon: { level: 0.95, attack: 0.003, body: 0.5, bodyTau: 0.16, ring: 5.5, release: 0.18, bright: 4200, dark: 1100, darkTau: 0.22 },
  'warm-pad': { level: 1.25, attack: 0.025, onset: 0.4, swellTau: 0.35, release: 0.85, swell: 0.5, cutoff: 2200 },
  bass: { level: 0.92, attack: 0.004, body: 0.6, bodyTau: 0.25, ring: 5, release: 0.14, bright: 2600, dark: 900 },
  flute: { level: 0.6, attack: 0.006, onset: 0.8, swellTau: 0.06, release: 0.15, swell: 0.5 },
  cello: { level: 0.71, attack: 0.008, onset: 0.75, swellTau: 0.08, release: 0.25, swell: 0.6 },
  strings: { level: 1.16, attack: 0.012, onset: 0.6, swellTau: 0.15, release: 0.4, swell: 0.6 },
  lead: { level: 0.76, attack: 0.004, onset: 1, swellTau: 0.05, release: 0.12, swell: 0.4 },
  pad: { level: 1.72, attack: 0.015, onset: 0.55, swellTau: 0.25, release: 0.9, swell: 0.4 }
}
const struck = (shape) => shape.ring != null
// lower notes ring (and darken) more slowly, higher ones faster
const ringScale = (pitch) => Math.pow(2, -(pitch - 60) / 24)

// ---------- waves and samples, built once per audio context ----------
const assets = new WeakMap()
function cached(ctx, key, make) {
  let a = assets.get(ctx)
  if (!a) assets.set(ctx, (a = new Map()))
  let v = a.get(key)
  if (v === undefined) a.set(key, (v = make()))
  return v
}

// A periodic wave from partial amplitudes (amps[0] is the fundamental), in sine phase
// unless phases are given. The level is kept as given (no normalisation), so a layer
// needs no gain node of its own.
function makeWave(ctx, amps, phases = null) {
  const n = amps.length
  const real = new Float32Array(n + 1), imag = new Float32Array(n + 1)
  for (let k = 1; k <= n; k++) {
    const p = phases ? phases[k - 1] : 0
    real[k] = amps[k - 1] * Math.sin(p)
    imag[k] = amps[k - 1] * Math.cos(p)
  }
  return ctx.createPeriodicWave(real, imag, { disableNormalization: true })
}

// partials of the built-in waveforms, in their sine phase (saw and triangle start at 0)
const SAW = (k) => (k % 2 ? 2 : -2) / (Math.PI * k)
const SQUARE = (k) => (k % 2 ? 4 / (Math.PI * k) : 0)
const TRIANGLE = (k) => (k % 2 ? (k % 4 === 1 ? 8 : -8) / (Math.PI * Math.PI * k * k) : 0)
const partials = (n, amp) => Array.from({ length: n }, (_, i) => amp(i + 1))
// a layer pitched an octave below the note: a `sub` sine, and `shape` on the even
// partials (which are the note's own harmonics)
const withSub = (n, sub, shape) => partials(2 * n, (k) => (k === 1 ? sub : k % 2 ? 0 : shape(k / 2)))

// The layers of every instrument but the piano: the partials and levels of the separate
// oscillators they replace, except a little more 2nd and 3rd partial on the flute and
// a real lift of the strings' 2nd (the old extra sine half-cancelled the saw's own).
const LAYERS = {
  epiano: (ctx) => ({ tone: makeWave(ctx, [1, 0.25]) }),
  tine: (ctx) => ({ tone: makeWave(ctx, [1, 0.08, 0.03]) }),
  organ: (ctx) => ({ tone: makeWave(ctx, withSub(8, 0.35, (k) => [0.8, 0.3, 0.18, 0.1, 0, 0.06, 0, 0.04][k - 1])) }),
  harpsichord: (ctx) => ({ tone: makeWave(ctx, partials(48, (k) => 0.7 * SAW(k) * (k % 3 ? 1 : 0.4))) }),
  marimba: (ctx) => ({ tone: makeWave(ctx, [0.9, 0, 0.06]), overtone: makeWave(ctx, [0.25]) }),
  nylon: (ctx) => ({ tone: makeWave(ctx, [0.85, 0.32, 0.18, 0.06, 0.035, 0.02]) }),
  'warm-pad': (ctx) => ({
    mid: makeWave(ctx, partials(32, (k) => 0.4 * TRIANGLE(k) + 0.12 * SAW(k))),
    side: makeWave(ctx, partials(32, (k) => 0.18 * SAW(k)))
  }),
  flute: (ctx) => ({ tone: makeWave(ctx, [0.9, 0.12, 0.04]) }),
  cello: (ctx) => ({
    low: makeWave(ctx, withSub(64, 0.3, (k) => 0.55 * SAW(k))),
    high: makeWave(ctx, partials(64, (k) => 0.45 * SAW(k)))
  }),
  strings: (ctx) => ({
    mid: makeWave(ctx, partials(64, (k) => 0.3 * SAW(k) * (k === 2 ? 2.25 : 1))),
    side: makeWave(ctx, partials(64, (k) => 0.3 * SAW(k)))
  }),
  bass: (ctx) => ({ tone: makeWave(ctx, withSub(32, 0.5, (k) => 0.9 * TRIANGLE(k))) }),
  lead: (ctx) => ({
    square: makeWave(ctx, partials(64, (k) => 0.4 * SQUARE(k))),
    saw: makeWave(ctx, partials(64, (k) => 0.25 * SAW(k)))
  }),
  pad: (ctx) => ({
    mid: makeWave(ctx, withSub(64, 0.2, (k) => 0.2 * SAW(k))),
    side: makeWave(ctx, partials(64, (k) => 0.2 * SAW(k)))
  }),
  sine: (ctx) => ({ tone: makeWave(ctx, [1]) })
}
const layers = (ctx, id) => cached(ctx, id, () => LAYERS[id](ctx))

// Piano partials for the octave around `pitch`: rich, with a weaker fundamental, in
// the bass; nearly pure in the treble. The rise over the first few partials and the
// dip at the 8th come from the hammer striking the string about 1/8 of its length
// from the end; the strong 2nd to 4th partials are also what carries on small laptop
// speakers, which lose most of a low fundamental.
function pianoPartials(pitch) {
  const f = 440 * Math.pow(2, (pitch - 69) / 12)
  const slope = 0.75 + 1.1 * Math.max(0, Math.min(1, (pitch - 36) / 48))
  const n = Math.max(3, Math.min(40, Math.floor(10000 / f)))
  return partials(n, (k) => Math.pow(k, -slope) * (0.25 + 0.75 * Math.abs(Math.sin((Math.PI * k) / 8))))
}

const waveAt = (amps, ph, t) => {
  let v = 0
  for (let k = 0; k < amps.length; k++) v += amps[k] * Math.sin((k + 1) * t + ph[k])
  return v
}
const peakOf = (amps, ph) => {
  let m = 0
  for (let i = 0; i < 512; i++) m = Math.max(m, Math.abs(waveAt(amps, ph, (2 * Math.PI * i) / 512)))
  return m || 1
}
// Shift the phases so the wave starts at a zero crossing: a note picked up a render
// quantum late skips its attack ramp, and must not start with a step (a click).
function startAtZero(amps, ph) {
  const N = 512, dt = (2 * Math.PI) / N
  let prev = waveAt(amps, ph, 0)
  for (let i = 1; i <= N; i++) {
    const v = waveAt(amps, ph, i * dt)
    if (prev <= 0 && v > 0) {
      const tz = (i - v / (v - prev)) * dt
      return ph.map((p, k) => p + (k + 1) * tz)
    }
    prev = v
  }
  return ph
}
// Phases that keep the waveform's peak low, so a note is louder for its peak and a
// chord reaches the limiter later: the lowest of sine phase (best with a strong
// fundamental, the middle), the even partials a quarter turn on (the treble) and
// Schroeder's phases (the many-partial bass, 3.7 dB lower than sine phase there).
function lowPeakPhases(amps) {
  const power = amps.map((a) => a * a)
  const total = power.reduce((s, p) => s + p, 0)
  const schroeder = amps.map((_, n) => {
    let s = 0
    for (let l = 0; l < n; l++) s += (n - l) * power[l]
    return (-2 * Math.PI * s) / total
  })
  let best = null, lowest = Infinity
  for (const ph of [amps.map(() => 0), amps.map((_, k) => (k % 2 ? Math.PI / 2 : 0)), schroeder]) {
    const peak = peakOf(amps, ph)
    if (peak < lowest) { best = ph; lowest = peak }
  }
  return startAtZero(amps, best)
}

// Three strings per note, like a real piano's unisons: the centre one carries the
// whole note in both speakers; two slightly detuned ones, one per side, add only the
// upper partials, so the tone shimmers and spreads without the fundamental ever
// beating away when the speakers are summed. Every octave's wave has the same RMS, so
// the keyboard is even; the low-peak phases then only lower the peaks (middle C's
// centre wave peaks at about 1).
const SIDE = 0.4
const UNISON = [-2, 3]   // cents, left and right
const PIANO_RMS = 0.55
function pianoWaves(ctx, pitch) {
  const band = Math.max(0, Math.min(7, Math.round((pitch - 24) / 12)))
  return cached(ctx, 'grand' + band, () => {
    const amps = pianoPartials(24 + 12 * band)
    const ph = lowPeakPhases(amps)
    const s = PIANO_RMS / Math.sqrt(amps.reduce((sum, a) => sum + a * a, 0) / 2)
    const side = amps.map((a, k) => (k === 0 ? 0 : a * s * SIDE))
    let seed = band + 7
    const sidePh = startAtZero(side, side.map(() => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 * Math.PI))
    return { center: makeWave(ctx, amps.map((a) => a * s), ph), side: makeWave(ctx, side, sidePh) }
  })
}

// A biquad for rendering samples in JS (RBJ cookbook); f is in cycles per sample.
function biquad(type, f, q) {
  const w = 2 * Math.PI * f, cs = Math.cos(w), al = Math.sin(w) / (2 * q), a0 = 1 + al
  const [b0, b1, b2] = type === 'bandpass' ? [al, 0, -al] : [(1 - cs) / 2, 1 - cs, (1 - cs) / 2]
  const a1 = -2 * cs, a2 = 1 - al
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  return (x) => {
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0
    x2 = x1; x1 = x; y2 = y1; y1 = y
    return y
  }
}

// The felt hammer hitting the string: a few milliseconds of bright knock over a soft
// thump, pre-rendered so a note needs no noise filter of its own. Four takes, so
// repeated notes don't sound like a loop.
const HAMMER_HZ = 2400
let hammerTake = 0
function hammerSamples(ctx) {
  return cached(ctx, 'hammer', () => [1, 2, 3, 4].map((take) => {
    const sr = ctx.sampleRate, len = Math.round(sr * 0.06)
    const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0)
    const knock = biquad('bandpass', HAMMER_HZ / sr, 0.9), thump = biquad('lowpass', 600 / sr, 0.7)
    let seed = take * 7919, peak = 0
    for (let i = 0; i < len; i++) {
      seed = (seed * 16807) % 2147483647
      const x = seed / 1073741823.5 - 1, t = i / sr
      d[i] = (knock(x) * Math.exp(-t / 0.0035) + 0.5 * thump(x) * Math.exp(-t / 0.009)) * Math.min(1, t / 0.0003)
      peak = Math.max(peak, Math.abs(d[i]))
    }
    for (let i = 0; i < len; i++) d[i] /= peak
    return buf
  }))
}

// Half a second of quiet white noise for the flute's breath, looped.
function breathNoise(ctx) {
  return cached(ctx, 'breath', () => {
    const len = Math.floor(ctx.sampleRate * 0.5)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.05
    return buf
  })
}

// Build an instrument's waves and samples on `ctx` now, ahead of its first note.
export function prepareInstrument(ctx, id) {
  if (id === 'sampled-piano') return loadPiano(ctx)
  if (id === 'grand') {
    for (let p = 24; p <= 108; p += 12) pianoWaves(ctx, p)
    hammerSamples(ctx)
  } else if (LAYERS[id]) {
    layers(ctx, id)
    if (id === 'flute') breathNoise(ctx)
  }
}

export class Voice {
  constructor(ctx, out, pitch, velocity, instrumentId = 'grand', bendRange = 48, when = null) {
    if (instrumentId === 'sampled-piano') return new SampleVoice(ctx, out, { pitch, velocity, bendRange, when })
    this.ctx = ctx
    this.pitch = pitch
    this.velocity = Math.max(0.05, Math.min(1, velocity / 127))
    this.id = instrumentId
    this.shape = SHAPES[instrumentId] || SHAPES.grand
    this.bendRange = bendRange
    this.pressure = 0
    this.slide = 0.5
    this.bend = 0
    this.dead = false
    this.freq = 440 * Math.pow(2, (pitch - 69) / 12)
    this.oscillators = []
    this.detunes = []       // each oscillator's own detune in cents; a bend adds to it
    this.sources = []       // [node, offset]: hammer and breath, stopped with the note

    // layers -> filter -> env (the note's own shape) [-> expr (pressure)] -> out
    this.filter = new BiquadFilterNode(ctx, { frequency: 6000, Q: 0.7 })
    this.env = new GainNode(ctx, { gain: 0 })
    this.filter.connect(this.env)
    // struck instruments ignore pressure, so they need no pressure gain
    this.expr = struck(this.shape) ? null : new GainNode(ctx)
    if (this.expr) this.env.connect(this.expr)
    this._build(instrumentId)

    // Read the clock only once the voice is built, then schedule it and connect it
    // last: the audio thread sees the whole voice at once, in the next quantum.
    this.t0 = when == null ? ctx.currentTime : Math.max(ctx.currentTime, when)
    for (const o of this.oscillators) o.start(this.t0)
    for (const [s, offset] of this.sources) s.start(this.t0, offset)
    this._envelope()
    const last = this.expr || this.env
    last.connect(out)
    // once it has stopped, take the note out of the graph
    this.oscillators[0].onended = () => { try { last.disconnect() } catch (_e) {} }
  }

  // an oscillator playing `wave` into `dest`, or into input `ch` of a channel merger
  _osc(wave, freq, detune, dest, ch = null) {
    const o = new OscillatorNode(this.ctx, { periodicWave: wave, frequency: freq, detune })
    if (ch == null) o.connect(dest)
    else o.connect(dest, 0, ch)
    this.oscillators.push(o)
    this.detunes.push(detune)
    return o
  }

  // stereo: `mid` in both speakers, `side` detuned by `left` / `right` cents on each side
  _ensemble(mid, midFreq, side, left, right) {
    const st = new ChannelMergerNode(this.ctx, { numberOfInputs: 2 })
    this._osc(mid, midFreq, 0, st, 0).connect(st, 0, 1)
    this._osc(side, this.freq, left, st, 0)
    this._osc(side, this.freq, right, st, 1)
    st.connect(this.filter)
  }

  _build(id) {
    const ctx = this.ctx, f = this.freq
    if (id === 'grand') {
      const w = pianoWaves(ctx, this.pitch)
      this._ensemble(w.center, f, w.side, UNISON[0], UNISON[1])
      this._hammer()
    } else if (id === 'epiano' || id === 'tine') {
      const carrier = this._osc(layers(ctx, id).tone, f, 0, this.filter)
      // FM tine: the modulator wobbles the carrier's frequency, strongly at the
      // strike and gently after, which gives the bell-like attack (see _envelope)
      const mod = new OscillatorNode(ctx, { frequency: f * (this.shape.fmRatio || 3.01) })
      this.fm = new GainNode(ctx, { gain: 0 })
      mod.connect(this.fm).connect(carrier.frequency)
      this.oscillators.push(mod)
      this.detunes.push(0)
    } else if (id === 'organ' || id === 'harpsichord' || id === 'nylon') {
      this._osc(layers(ctx, id).tone, id === 'organ' ? f / 2 : f, 0, this.filter)
    } else if (id === 'marimba') {
      const w = layers(ctx, id)
      this._osc(w.tone, f, 0, this.filter)
      // A wooden bar's first overtone sits two octaves up and fades before its body.
      this.barTone = new GainNode(ctx)
      this._osc(w.overtone, f * 4.01, 0, this.barTone)
      this.barTone.connect(this.filter)
    } else if (id === 'warm-pad') {
      const w = layers(ctx, id)
      this._ensemble(w.mid, f, w.side, -7, 7)
    } else if (id === 'flute') {
      this._osc(layers(ctx, id).tone, f, 0, this.filter)
      // breath: noise through a band-pass that follows the pitch (and pressure)
      const n = new AudioBufferSourceNode(ctx, { buffer: breathNoise(ctx), loop: true })
      const bp = new BiquadFilterNode(ctx, { type: 'bandpass', frequency: f * 2, Q: 1.2 })
      n.connect(bp).connect(this.filter)
      this.sources.push([n, Math.random() * 0.4])
      this.breath = bp
    } else if (id === 'cello') {
      const w = layers(ctx, id)
      this._osc(w.low, f / 2, -4, this.filter)
      this._osc(w.high, f, 4, this.filter)
    } else if (id === 'strings') {
      const w = layers(ctx, id)
      this._ensemble(w.mid, f, w.side, -8, 8)
    } else if (id === 'bass') {
      this._osc(layers(ctx, id).tone, f / 2, 0, this.filter)
    } else if (id === 'lead') {
      const w = layers(ctx, id)
      this._osc(w.square, f, 0, this.filter)
      this._osc(w.saw, f, 6, this.filter)
    } else if (id === 'pad') {
      const w = layers(ctx, id)
      this._ensemble(w.mid, f / 2, w.side, -14, 14)
    } else {
      this._osc(layers(ctx, 'sine').tone, f, 0, this.filter)
    }
  }

  // The hammer knock, into the note's own filter (so soft notes knock darker).
  // Harder strikes knock relatively more; higher strings have smaller hammers, so the
  // knock is played faster there: higher and shorter.
  _hammer() {
    const takes = hammerSamples(this.ctx)
    const rate = Math.min(6000, 1800 + this.freq * 2) / HAMMER_HZ
    const src = new AudioBufferSourceNode(this.ctx, { buffer: takes[hammerTake++ % takes.length], playbackRate: rate })
    const g = new GainNode(this.ctx, { gain: this.shape.hammer * Math.pow(this.velocity, 0.8) })
    src.connect(g).connect(this.filter)
    this.sources.push([src, 0])
  }

  _envelope() {
    const t = this.t0, sh = this.shape, v = this.velocity
    const peak = sh.level * (0.12 + 0.88 * Math.pow(v, 1.3))
    const g = this.env.gain
    g.setValueAtTime(0, t)
    if (struck(sh)) {
      const scale = ringScale(this.pitch)
      g.linearRampToValueAtTime(peak, t + sh.attack)
      g.setTargetAtTime(peak * sh.body, t + sh.attack, sh.bodyTau)
      // then a long natural ring-down while the key is held
      const ring = Math.max(1.5, Math.min(25, sh.ring * scale))
      g.setTargetAtTime(0, t + sh.attack + sh.bodyTau * 3, ring / 6.9)
      // bright at the strike (harder is brighter), darkening as the string rings
      const bright = Math.min(16000, Math.max(sh.bright, this.freq * (sh.brightPerHz || 6))) * (1 - (sh.velBright || 0.4) * (1 - v))
      const dark = Math.min(bright, Math.max(sh.dark, this.freq * (sh.darkPerHz || 2)))
      this.filter.frequency.setValueAtTime(bright, t)
      this.filter.frequency.setTargetAtTime(dark, t + sh.attack, sh.darkTau ? sh.darkTau * scale : ring / 5)
    } else {
      g.linearRampToValueAtTime(peak * sh.onset, t + sh.attack)
      if (sh.onset < 1) g.setTargetAtTime(peak, t + sh.attack, sh.swellTau)
      this.filter.frequency.setValueAtTime(this._tone(), t)
    }
    if (this.fm) {
      this.fm.gain.setValueAtTime(this.freq * (sh.fmPeak || 1.2), t)
      this.fm.gain.setTargetAtTime(this.freq * (sh.fmBody || 0.15), t, sh.fmTau || 0.25)
    }
    if (this.barTone) this.barTone.gain.setTargetAtTime(0, t + sh.attack, 0.065)
  }

  // filter cutoff for held instruments: slide (CC74) shapes the timbre, pressure opens it
  _tone() {
    return Math.min(16000, (this.shape.cutoff || 4000) * (0.6 + 0.8 * this.slide) * (1 + 0.8 * this.pressure))
  }

  // Pressure (aftertouch) only ever adds. Struck instruments ignore it, as a real
  // piano does; held instruments get louder and brighter when you press into the key.
  setPressure(v) {
    if (this.dead) return
    this.pressure = Math.max(0, Math.min(1, v))
    const sh = this.shape
    if (struck(sh)) return
    const t = this.ctx.currentTime
    this.expr.gain.setTargetAtTime(1 + (sh.swell || 0) * this.pressure, t, 0.03)
    this.filter.frequency.setTargetAtTime(this._tone(), t, 0.03)
    if (this.breath) this.breath.frequency.setTargetAtTime(this.freq * (1.5 + this.pressure * 2), t, 0.04)
  }

  setSlide(v) {
    if (this.dead) return
    this.slide = Math.max(0, Math.min(1, v))
    if (struck(this.shape)) return
    this.filter.frequency.setTargetAtTime(this._tone(), this.ctx.currentTime, 0.04)
  }

  // The bend moves every layer by the same amount, on top of its own detune.
  setBend(semitones) {
    if (this.dead) return
    this.bend = semitones
    const t = this.ctx.currentTime
    const cents = semitones * 100
    this.oscillators.forEach((o, i) => o.detune.setTargetAtTime(this.detunes[i] + cents, t, 0.012))
  }

  // Let the note go now, or at audio time `at` (a scheduled note's end).
  release(seconds = this.shape.release, at = null) {
    if (this.dead) return
    this.dead = true
    const now = this.ctx.currentTime
    const t = at == null ? now : Math.max(now, at)
    const g = this.env.gain
    try {
      // keep whatever the envelope is doing up to t, then fade from there
      if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t)
      else { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t) }
      g.setTargetAtTime(0, t, Math.max(0.005, seconds / 5))
    } catch (_e) {}
    const stopAt = t + seconds * 1.6 + 0.05
    for (const o of this.oscillators) { try { o.stop(stopAt) } catch (_e) {} }
    for (const [s] of this.sources) { try { s.stop(stopAt) } catch (_e) {} }
  }
}
