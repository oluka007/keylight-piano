// Jam transport clock (pure: time and timers are injected).
// Beats are quarter notes. Windows of beats are handed out in advance, never
// overlapping and never leaving a gap, also across tempo changes and late ticks.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

export function createClock({
  now,
  setTimer = (fn, ms) => setInterval(fn, ms),
  clearTimer = (id) => clearInterval(id),
  bpm = 100,
  beatsPerBar = 4,
  lookahead = 0.12,
  interval = 25
} = {}) {
  if (typeof now !== 'function') throw new Error('createClock needs now()')
  let tempo = clamp(Number(bpm) || 100, 40, 220)
  let swingAmount = 0
  let running = false
  let anchors = [{ time: 0, beat: 0, bpm: tempo }]
  let covered = 0         // every beat before this has been handed out
  let timer = null
  const listeners = new Set()

  // Retain earlier tempo segments so the playhead and recorded beats keep their
  // old mapping while the next tempo is waiting at the scheduling horizon.
  const anchorFor = (key, value) => {
    for (let i = anchors.length - 1; i > 0; i--) if (value >= anchors[i][key]) return anchors[i]
    return anchors[0]
  }
  const beatAt = (time) => {
    const a = anchorFor('time', time)
    return a.beat + (time - a.time) * a.bpm / 60
  }
  const timeOfBeat = (beat) => {
    const a = anchorFor('beat', beat)
    return a.time + (beat - a.beat) * 60 / a.bpm
  }

  function tick() {
    if (!running) return
    const target = beatAt(now() + lookahead)
    if (!(target > covered)) return
    const fromBeat = covered
    covered = target
    // the window keeps the tempo it was cut at, even if the tempo changes later
    const a = anchors[anchors.length - 1]
    const timeOf = (beat) => a.time + (beat - a.beat) * 60 / a.bpm
    for (const fn of [...listeners]) fn({ fromBeat, toBeat: target, timeOfBeat: timeOf })
  }

  return {
    get running() { return running },
    get bpm() { return tempo },
    get beatsPerBar() { return beatsPerBar },
    get swing() { return swingAmount },
    set swing(v) { swingAmount = clamp(Number(v) || 0, 0, 0.6) },
    start(at = now() + 0.05) {
      if (timer !== null) clearTimer(timer)
      anchors = [{ time: at, beat: 0, bpm: tempo }]
      covered = 0
      running = true
      timer = setTimer(tick, interval)
    },
    stop() {
      running = false
      if (timer !== null) clearTimer(timer)
      timer = null
    },
    setBpm(v) {
      const next = clamp(Number(v) || tempo, 40, 220)
      if (running && next !== tempo) {
        // Already-emitted windows own all beats before covered at their old
        // tempo. The new segment starts exactly at their beat AND time endpoint.
        const anchor = { time: timeOfBeat(covered), beat: covered, bpm: next }
        if (anchors[anchors.length - 1].beat === covered) anchors[anchors.length - 1] = anchor
        else anchors.push(anchor)
      }
      tempo = next
      if (!running) anchors = [{ ...anchors[anchors.length - 1], bpm: tempo }]
    },
    beatAt,
    timeOfBeat,
    barOf: (beat) => Math.floor(beat / beatsPerBar),
    // every second sixteenth is delayed by swing * 0.25 / 2 beats
    swungBeat(beat) {
      const idx = Math.floor(beat / 0.25 + 1e-9)
      return idx % 2 !== 0 ? beat + swingAmount * 0.25 / 2 : beat
    },
    onWindow(fn) {
      listeners.add(fn)
      return () => { listeners.delete(fn) }
    },
    tick
  }
}
