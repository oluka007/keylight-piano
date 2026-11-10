// Jam drums: eight synthesised sounds (sine sweeps and filtered noise), no samples.
// playDrum takes the context and destination, so it also renders into an OfflineAudioContext.

export const DRUMS = [
  { id: 'kick', name: 'Kick' },
  { id: 'snare', name: 'Snare' },
  { id: 'hat-closed', name: 'Closed hat' },
  { id: 'hat-open', name: 'Open hat' },
  { id: 'clap', name: 'Clap' },
  { id: 'tom-low', name: 'Low tom' },
  { id: 'tom-high', name: 'High tom' },
  { id: 'rim', name: 'Rim' }
]

// Levels sit where the band's sounds do (see audio.js): the kick near the bass, the hats
// near the hi-hat.
const KICK_LEVEL = 0.8
const SNARE_LEVEL = 0.5
const HAT_LEVEL = 0.47
const CLAP_LEVEL = 1.4
const TOM_LEVEL = 0.7
const RIM_LEVEL = 0.5
const FLOOR = 0.0001

// One second of seeded white noise per context, shared by every hit.
const noises = new WeakMap()
function noise(ctx) {
  let buffer = noises.get(ctx)
  if (!buffer) {
    buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let seed = 2463534242
    for (let i = 0; i < data.length; i++) {
      seed = (seed * 16807) % 2147483647
      data[i] = seed / 1073741823.5 - 1
    }
    noises.set(ctx, buffer)
  }
  return buffer
}

// The open hat ringing on each output, so a closed hat can cut it.
const ringing = new WeakMap()

// One hit: sources to start and stop, and nodes to disconnect when the last one ends.
class Hit {
  constructor(ctx, out, t) {
    this.ctx = ctx
    this.out = out
    this.t = t
    this.nodes = []
    this.sources = []
    this.end = t
    this.gains = []
  }
  gain(value = 0) {
    const g = new GainNode(this.ctx, { gain: value })
    this.nodes.push(g)
    this.gains.push(g)
    return g
  }
  filter(type, frequency, Q = 0.7) {
    const f = new BiquadFilterNode(this.ctx, { type, frequency, Q })
    this.nodes.push(f)
    return f
  }
  osc(type, frequency, duration) {
    const o = new OscillatorNode(this.ctx, { type, frequency })
    this.sources.push(o)
    o.start(this.t); o.stop(this.t + duration)
    this.end = Math.max(this.end, this.t + duration)
    return o
  }
  noise(duration, offset = 0) {
    const s = new AudioBufferSourceNode(this.ctx, { buffer: noise(this.ctx) })
    this.sources.push(s)
    s.start(this.t + offset); s.stop(this.t + offset + duration)
    this.end = Math.max(this.end, this.t + offset + duration)
    return s
  }
  // a decay from `peak` at `at` down to nothing over `seconds`
  decay(g, peak, seconds, at = 0) {
    const t = this.t + at
    g.gain.setValueAtTime(FLOOR, t)
    g.gain.exponentialRampToValueAtTime(Math.max(FLOOR * 2, peak), t + 0.001)
    g.gain.exponentialRampToValueAtTime(FLOOR, t + seconds)
  }
  start() {
    let open = this.sources.length
    const done = () => {
      if (--open > 0) return
      for (const n of this.nodes) { try { n.disconnect() } catch (_e) {} }
    }
    for (const s of this.sources) s.addEventListener('ended', done)
    return this
  }
  // Cut the hit short at audio time `at` (a choked hat, or silence()).
  stop(at = null) {
    const now = this.ctx.currentTime
    const t = at == null ? now : Math.max(now, at)
    for (const g of this.gains) {
      try {
        if (g.gain.cancelAndHoldAtTime) g.gain.cancelAndHoldAtTime(t)
        else g.gain.cancelScheduledValues(t)
        g.gain.setTargetAtTime(0, t, 0.004)
      } catch (_e) {}
    }
    for (const s of this.sources) { try { s.stop(t + 0.04) } catch (_e) {} }
  }
}

const kick = (h, a) => {
  const body = h.osc('sine', 150, 0.5)
  body.frequency.setValueAtTime(150, h.t)
  body.frequency.exponentialRampToValueAtTime(45, h.t + 0.12)
  const g = h.gain()
  h.decay(g, KICK_LEVEL * a, 0.45)
  body.connect(g).connect(h.out)
  // a short click on the front
  const click = h.noise(0.012)
  const lp = h.filter('lowpass', 3500)
  const cg = h.gain()
  h.decay(cg, 0.18 * a, 0.008)
  click.connect(lp).connect(cg).connect(h.out)
}

const snare = (h, a) => {
  const n = h.noise(0.25)
  const bp = h.filter('bandpass', 1900, 0.8)
  const ng = h.gain()
  h.decay(ng, SNARE_LEVEL * a, 0.2)
  n.connect(bp).connect(ng).connect(h.out)
  const tone = h.osc('triangle', 180, 0.12)
  tone.frequency.setValueAtTime(230, h.t)
  tone.frequency.exponentialRampToValueAtTime(180, h.t + 0.03)
  const tg = h.gain()
  h.decay(tg, 0.4 * a, 0.09)
  tone.connect(tg).connect(h.out)
}

const hat = (h, a, open) => {
  const length = open ? 0.3 : 0.04
  const n = h.noise(length + 0.05)
  const hp = h.filter('highpass', 7000)
  const g = h.gain()
  if (open) {
    // rings for about 300 ms: down 30 dB by 0.25 s, then out
    g.gain.setValueAtTime(FLOOR, h.t)
    g.gain.exponentialRampToValueAtTime(HAT_LEVEL * a, h.t + 0.001)
    g.gain.exponentialRampToValueAtTime(HAT_LEVEL * a * 0.03, h.t + 0.25)
    g.gain.exponentialRampToValueAtTime(FLOOR, h.t + length)
  } else h.decay(g, HAT_LEVEL * a, length)
  n.connect(hp).connect(g).connect(h.out)
}

const clap = (h, a) => {
  const n = h.noise(0.3)
  const bp = h.filter('bandpass', 1300, 1.1)
  const g = h.gain()
  // three fast bursts, then a tail
  for (const at of [0, 0.011, 0.022]) h.decay(g, CLAP_LEVEL * a * 0.8, 0.009, at)
  g.gain.setValueAtTime(FLOOR, h.t + 0.031)
  g.gain.exponentialRampToValueAtTime(CLAP_LEVEL * a * 0.7, h.t + 0.032)
  g.gain.exponentialRampToValueAtTime(FLOOR, h.t + 0.2)
  n.connect(bp).connect(g).connect(h.out)
}

const tom = (h, a, from, to, seconds) => {
  const o = h.osc('sine', from, seconds + 0.05)
  o.frequency.setValueAtTime(from, h.t)
  o.frequency.exponentialRampToValueAtTime(to, h.t + 0.1)
  const g = h.gain()
  h.decay(g, TOM_LEVEL * a, seconds)
  o.connect(g).connect(h.out)
}

const rim = (h, a) => {
  const n = h.noise(0.012)
  const bp = h.filter('bandpass', 2600, 1.4)
  const ng = h.gain()
  h.decay(ng, RIM_LEVEL * a, 0.01)
  n.connect(bp).connect(ng).connect(h.out)
  const o = h.osc('sine', 1700, 0.03)
  const og = h.gain()
  h.decay(og, 0.3 * a, 0.02)
  o.connect(og).connect(h.out)
}

// Play drum `index` (0..7, see DRUMS). Returns { stop(at) }.
export function playDrum(ctx, out, index, { when = null, velocity = 100 } = {}) {
  const t = when == null ? ctx.currentTime : Math.max(ctx.currentTime, when)
  const a = Math.max(0.05, Math.min(1, velocity / 127))
  const h = new Hit(ctx, out, t)
  switch (index) {
    case 0: kick(h, a); break
    case 1: snare(h, a); break
    case 2: {
      const open = ringing.get(out)
      if (open) { open.stop(t); ringing.delete(out) }
      hat(h, a, false)
      break
    }
    case 3: hat(h, a, true); break
    case 4: clap(h, a); break
    case 5: tom(h, a, 130, 70, 0.4); break
    case 6: tom(h, a, 210, 120, 0.3); break
    case 7: rim(h, a); break
    default: return { stop() {} }
  }
  h.start()
  if (index === 3) {
    ringing.set(out, h)
    h.sources[0].addEventListener('ended', () => { if (ringing.get(out) === h) ringing.delete(out) })
  }
  return h
}
