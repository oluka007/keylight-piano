// Audio-clock scheduler for everything the app plays by itself: the song in
// Watch mode, the accompaniment (the other hand, and notes beyond the 24 keys)
// in Play/Practise, the generated band, the metronome and the count-in.
//
// Each pump queues events that fall inside the next LOOKAHEAD seconds of audio
// time, at their exact audio-clock start. Screen refresh only decides how often
// we look ahead, never when a note sounds. Any transport change (player.epoch)
// silences the queue and starts again from the new position.
import { scheduleNote, cancelScheduled, click, playBass, playHat } from './audio.js'

const LOOKAHEAD = 0.2

const AUDIO = { note: scheduleNote, cancel: cancelScheduled, click, bass: playBass, hat: playHat }

export class SongScheduler {
  // `out` lets the self-test record what would be played instead of playing it.
  constructor(out = AUDIO) {
    this.out = out
    this.epoch = -1
    this.cursor = 0          // song position up to which events are queued
    this.countInBeat = 0     // next count-in beat to queue
    this.sources = null
    this.fresh = true        // the first pump since a transport change
  }

  reset() {
    this.out.cancel()
    this.epoch = -1
  }

  // opts: { ctx, accompany, watchSynth, band (array of {time, pitch, accent}) | null }
  pump(player, opts) {
    const ctx = opts.ctx
    if (!player || !player.song || !ctx) return
    if (player.epoch !== this.epoch) {
      this.out.cancel()
      this.epoch = player.epoch
      // mid-play (e.g. a recording became ready) start from what is rendering now,
      // never from a stale anchor, so nothing already heard is played again
      this.cursor = player.clockRunning ? player.renderPosition() : player.position
      this.countInBeat = 0
      this.fresh = true
      this.sources = player.mode === 'WATCH'
        ? (opts.watchSynth === false ? [] : player.song.notes)   // a recording plays the song instead
        : (opts.accompany ? player.accompanimentNotes() : [])
    }
    if (!player.clockRunning) return

    const now = ctx.currentTime
    const until = now + LOOKAHEAD

    // count-in clicks run on their own beat grid before the song clock starts: the
    // count-in's own length, which follows the speed (tempo x rate) it was started at
    if (player._countInUntil > now - LOOKAHEAD) {
      const beat = (player._countInUntil - player._countInStart) / Math.max(1, player.countIn)
      while (this.countInBeat < player.countIn) {
        const at = player._countInStart + this.countInBeat * beat
        if (at > until) break
        if (at >= now - 0.01) this.out.click(this.countInBeat === player.countIn - 1, at)
        this.countInBeat++
      }
    }

    // song positions covered by [cursor, horizon)
    let horizon = player._anchorPos + Math.max(0, until - player._anchorAt) * player.rate
    horizon = Math.min(horizon, player.nextWaitTime(), player.end + 0.001)
    if (player.loop.on && player.loop.b != null) horizon = Math.min(horizon, player.loop.b)
    if (horizon <= this.cursor) return
    // Each pump queues [from, horizon), and the next one starts where it stopped, so an
    // event right on the boundary is queued once, by the pump that reached past it (a
    // horizon a float hair past a note used to queue it twice: a chord 6 dB too loud).
    // Only a fresh start also takes what sits a hair under its position.
    const from = this.cursor
    const lo = this.fresh ? from - 1e-6 : from
    this.fresh = false

    for (const n of this.sources) {
      if (n.start < lo) continue
      if (n.start >= horizon) break
      this.out.note(n.pitch, n.vel, player.timeAt(n.start), n.dur / player.rate)
    }

    if (opts.band) {
      for (const ev of opts.band) {
        if (ev.time < lo || ev.time >= horizon) continue
        const at = player.timeAt(ev.time)
        if (ev.pitch) this.out.bass(ev.pitch, 0.3 / player.rate, at)
        this.out.hat(ev.accent, at)
      }
    }

    if (player.metronome.on) {
      const beatLen = 60 / player.song.tempo
      for (let k = Math.max(0, Math.ceil(from / beatLen) - 1); k * beatLen < horizon; k++) {
        if (k * beatLen >= lo) this.out.click(k % 4 === 0, player.timeAt(k * beatLen))
      }
    }

    this.cursor = horizon
  }
}
