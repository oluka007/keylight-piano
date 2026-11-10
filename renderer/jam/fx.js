// Jam effects: one delay and one reverb shared by every track (send effects).
// Both take the context and destination, so they also render into an OfflineAudioContext.

const MAX_FEEDBACK = 0.75
const MAX_DELAY_SECONDS = 3.9

const clamp = (v, low, high) => Number.isFinite(v) ? Math.max(low, Math.min(high, v)) : low

// Reverb tail length in seconds for a size of 0..1.
export const reverbSeconds = (size) => 0.4 + 2.6 * clamp(size, 0, 1)

// The reverb's impulse response: stereo noise from a seeded generator (the same samples
// on every run and in every build), decaying exponentially to -60 dB at the end.
export function reverbImpulse(sampleRate, size) {
  const length = Math.max(1, Math.round(sampleRate * reverbSeconds(size)))
  const channels = [0, 1].map((side) => {
    let seed = 48271 * (side + 1)
    const data = new Float32Array(length)
    for (let i = 0; i < length; i++) {
      seed = (seed * 16807) % 2147483647
      const noise = seed / 1073741823.5 - 1
      data[i] = noise * Math.exp(-6.9 * i / length)
    }
    return data
  })
  return channels
}

export function createFx(ctx, destination) {
  const input = new GainNode(ctx)

  const delay = new DelayNode(ctx, { maxDelayTime: 4, delayTime: 0.375 })
  const loop = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 3200, Q: 0.5 })
  const feedback = new GainNode(ctx, { gain: 0.35 })
  const delayMix = new GainNode(ctx, { gain: 0.25 })
  input.connect(delay)
  delay.connect(loop).connect(feedback).connect(delay)
  delay.connect(delayMix).connect(destination)

  const convolver = new ConvolverNode(ctx)
  const reverbMix = new GainNode(ctx, { gain: 0.25 })
  input.connect(convolver)
  convolver.connect(reverbMix).connect(destination)

  let size = null
  const buildReverb = (value) => {
    if (size === value) return
    size = value
    const [left, right] = reverbImpulse(ctx.sampleRate, value)
    const buffer = ctx.createBuffer(2, left.length, ctx.sampleRate)
    buffer.copyToChannel(left, 0)
    buffer.copyToChannel(right, 1)
    convolver.buffer = buffer
  }
  buildReverb(0.5)

  const glide = (param, value) => param.setTargetAtTime(value, ctx.currentTime, 0.02)
  let disposed = false
  return {
    input,
    // beats at bpm gives the delay time; feedback is capped at 0.75 and the loop is
    // low-passed, so the repeats always die away
    setDelay({ beats, bpm, feedback: fb, mix } = {}) {
      if (disposed) return
      if (Number.isFinite(beats) && Number.isFinite(bpm) && bpm > 0) {
        glide(delay.delayTime, clamp((beats * 60) / bpm, 0.01, MAX_DELAY_SECONDS))
      }
      if (fb != null) glide(feedback.gain, clamp(fb, 0, MAX_FEEDBACK))
      if (mix != null) glide(delayMix.gain, clamp(mix, 0, 1))
    },
    setReverb({ size: s, mix } = {}) {
      if (disposed) return
      if (s != null) buildReverb(clamp(s, 0, 1))
      if (mix != null) glide(reverbMix.gain, clamp(mix, 0, 1))
    },
    dispose() {
      if (disposed) return
      disposed = true
      for (const node of [input, delay, loop, feedback, delayMix, convolver, reverbMix]) { try { node.disconnect() } catch (_e) {} }
    }
  }
}
