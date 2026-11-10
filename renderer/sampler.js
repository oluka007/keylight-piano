// Salamander Grand Piano by Alexander Holm (CC BY 3.0).
// Local, single-velocity stereo subset; see LICENSES/piano-samples.md.
export const PIANO_SAMPLES = Object.freeze([
  ['A0', 21], ['C1', 24], ['Fs1', 30], ['C2', 36], ['Fs2', 42],
  ['C3', 48], ['Fs3', 54], ['C4', 60], ['Fs4', 66], ['C5', 72],
  ['Fs5', 78], ['C6', 84], ['Fs6', 90], ['C7', 96], ['Fs7', 102], ['C8', 108]
].map(([name, pitch]) => Object.freeze({ pitch, url: new URL(`./samples/salamander/${name}.mp3`, import.meta.url) })))

const banks = new WeakMap()
const idle = Object.freeze({ state: 'idle', loaded: 0, total: PIANO_SAMPLES.length, error: null })
export const pianoStatus = (ctx) => ({ ...(banks.get(ctx)?.status || idle) })

export function loadPiano(ctx) {
  const previous = banks.get(ctx)
  if (previous && previous.status.state !== 'unavailable') return previous.promise
  const bank = { status: { ...idle, state: 'loading' }, samples: [], promise: null }
  banks.set(ctx, bank)
  // Native fetch is intentional: bundled same-origin files, bounded timeout, no dependencies.
  bank.promise = Promise.all(PIANO_SAMPLES.map(async ({ pitch, url }) => {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!response.ok) throw new PianoSampleError(url.href, `HTTP ${response.status}`)
    const buffer = await ctx.decodeAudioData(await response.arrayBuffer())
    let peak = 0
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      for (const value of buffer.getChannelData(c)) peak = Math.max(peak, Math.abs(value))
    }
    if (!Number.isFinite(peak) || peak === 0) throw new PianoSampleError(url.href, 'Empty or invalid audio')
    if (bank.status.state === 'loading') bank.status = { ...bank.status, loaded: bank.status.loaded + 1 }
    return { pitch, buffer, gain: 1.4 / peak }
  })).then((samples) => {
    bank.samples = samples
    bank.status = { ...bank.status, state: 'ready' }
    return pianoStatus(ctx)
  }).catch((error) => {
    if (!(error instanceof Error)) throw error
    bank.status = { ...bank.status, state: 'unavailable', error: error.message }
    return pianoStatus(ctx)
  })
  return bank.promise
}

export class PianoSampleError extends Error {
  constructor(url, reason) {
    super(`Sampled piano unavailable: ${reason} (${url})`)
    this.name = 'PianoSampleError'
    this.url = url
  }
}

// The same release/expression contract as the built-in Voice. Sustain and the
// live 40-voice allocation policy remain owned by audio.js.
export class SampleVoice {
  constructor(ctx, out, note) {
    const bank = banks.get(ctx)
    if (bank?.status.state !== 'ready') throw new PianoSampleError('bundled piano', 'Load samples before selecting')
    const sample = bank.samples.reduce((best, item) => Math.abs(item.pitch - note.pitch) < Math.abs(best.pitch - note.pitch) ? item : best)
    this.ctx = ctx
    this.id = 'sampled-piano'
    this.pitch = note.pitch
    this.shape = { release: 0.32 }
    this.pressure = 0
    this.slide = 0.5
    this.bend = 0
    this.bendRange = note.bendRange
    this.dead = false
    this.releaseAt = Infinity
    this.t0 = note.when == null ? ctx.currentTime : Math.max(ctx.currentTime, note.when)
    const velocity = Math.max(0, Math.min(1, note.velocity / 127))
    this.source = new AudioBufferSourceNode(ctx, { buffer: sample.buffer, playbackRate: 2 ** ((note.pitch - sample.pitch) / 12) })
    this.filter = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 2200 + 13800 * velocity, Q: 0.7 })
    this.env = new GainNode(ctx, { gain: 0 })
    this.env.gain.setValueAtTime(0, this.t0)
    this.env.gain.linearRampToValueAtTime(sample.gain * velocity ** 1.3, this.t0 + 0.002)
    this.source.connect(this.filter).connect(this.env).connect(out)
    this.source.onended = () => {
      this.dead = true
      this.source.disconnect()
      this.filter.disconnect()
      this.env.disconnect()
    }
    this.source.start(this.t0)
  }

  setPressure(value) { this.pressure = Math.max(0, Math.min(1, value)) }
  setSlide(value) { this.slide = Math.max(0, Math.min(1, value)) }
  setBend(semitones) {
    if (this.dead) return
    this.bend = Math.max(-this.bendRange, Math.min(this.bendRange, semitones))
    this.source.detune.setTargetAtTime(this.bend * 100, this.ctx.currentTime, 0.012)
  }

  release(seconds = this.shape.release, at = null) {
    const t = at == null ? this.ctx.currentTime : Math.max(this.ctx.currentTime, at)
    if (t >= this.releaseAt) return
    this.releaseAt = t
    const duration = Math.max(0.005, seconds)
    this.env.gain.cancelAndHoldAtTime(t)
    this.env.gain.setTargetAtTime(0, t, duration / 5)
    this.source.stop(t + duration * 1.6 + 0.05)
  }
}
