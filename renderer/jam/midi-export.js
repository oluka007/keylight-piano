// Jam session -> Standard MIDI File (format 1, 480 ticks per quarter).
// Track 0 is the tempo map; then one track per Jam track, each active clip laid
// out as one pass after the previous one. Instrument tracks use channels 0-2,
// the drum track channel 9 (General MIDI drum notes).

const PPQ = 480
export const GM_DRUMS = [36, 38, 42, 46, 39, 45, 50, 37]   // kick snare closed-hat open-hat clap low-tom high-tom rim
const DRUM_TICKS = PPQ / 8
const BEND_RANGE = 48

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const byte = (v) => clamp(Math.round(v), 0, 127)

function vlq(n) {
  const out = [n & 0x7f]
  while ((n >>= 7) > 0) out.unshift((n & 0x7f) | 0x80)
  return out
}

const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]
const ascii = (s) => [...s].map((c) => c.charCodeAt(0) & 0x7f)

function chunk(id, data) {
  return [...ascii(id), ...u32(data.length), ...data]
}

// events: [{ tick, order, bytes }] sorted by tick, then order, then insertion.
// end-of-track sits at endTick, or at the last event if that is later.
function trackBytes(events, endTick) {
  const sorted = events.map((e, i) => ({ ...e, i })).sort((a, b) => a.tick - b.tick || a.order - b.order || a.i - b.i)
  const data = []
  let last = 0
  for (const e of sorted) {
    data.push(...vlq(e.tick - last), ...e.bytes)
    last = e.tick
  }
  const end = Math.max(endTick, last)
  data.push(...vlq(end - last), 0xff, 0x2f, 0x00)
  return chunk('MTrk', data)
}

const nameMeta = (name) => {
  const a = ascii(name).slice(0, 100)
  return [0xff, 0x03, a.length, ...a]
}

function activeClips(track) {
  const slots = track.slots || []
  let list
  if (track.active === undefined || track.active === null) list = slots.map((c, i) => i)
  else list = Array.isArray(track.active) ? track.active : [track.active]
  return list.map((i) => slots[i]).filter((c) => c && c.lengthBeats > 0)
}

export function sessionToMidi(session) {
  const bpm = clamp(Number(session.bpm) || 100, 40, 220)
  const us = Math.round(60000000 / bpm)
  const chunks = []
  let instIndex = 0
  let longest = 0
  for (const track of session.tracks || []) {
    const drum = track.kind === 'drum'
    const ch = drum ? 9 : Math.min(instIndex++, 2)
    const ev = [{ tick: 0, order: 0, bytes: nameMeta(track.name || (drum ? 'Drums' : 'Track')) }]
    let bends = false
    let offset = 0
    for (const clip of activeClips(track)) {
      for (const e of clip.events) {
        const start = Math.round((offset + e.t) * PPQ)
        const end = drum ? start + DRUM_TICKS : Math.max(start + 1, Math.round((offset + e.t + e.dur) * PPQ))
        const note = drum ? GM_DRUMS[clamp(e.pitch, 0, 7)] : byte(e.pitch)
        // Order at a shared tick: gestures of the ending note, note-off, resets,
        // expression set-up of the next note, then its note-on.
        ev.push({ tick: start, order: 4, bytes: [0x90 | ch, note, clamp(Math.round(e.vel), 1, 127)] })
        ev.push({ tick: end, order: 1, bytes: [0x80 | ch, note, byte(e.lift ?? 64)] })
        let bent = false
        let pressed = false
        let slid = false
        if (!drum) {
          const dur = Number(e.dur) || 0
          for (const g of e.g || []) {
            const dt = Number(g.dt)
            // Gestures outside the note (or rounding past its end) would retune
            // the next note, so they are dropped.
            if (!(dt >= 0) || dt >= dur) continue
            const tick = Math.min(end, start + Math.round(dt * PPQ))
            const order = tick === start ? 3 : 0
            if (g.k === 'bend') {
              const v = clamp(Math.round(8192 + (g.v / BEND_RANGE) * 8192), 0, 16383)
              ev.push({ tick, order, bytes: [0xe0 | ch, v & 127, v >> 7] })
              bent = bends = true
            } else if (g.k === 'press') {
              ev.push({ tick, order, bytes: [0xd0 | ch, byte(g.v * 127)] })
              pressed = true
            } else if (g.k === 'slide') {
              ev.push({ tick, order, bytes: [0xb0 | ch, 74, byte(g.v * 127)] })
              slid = true
            }
          }
        }
        // Reset only the expression this note actually used, so silent notes
        // do not inherit the previous note's bend, pressure or slide.
        if (bent) ev.push({ tick: end, order: 2, bytes: [0xe0 | ch, 0, 64] })
        if (pressed) ev.push({ tick: end, order: 2, bytes: [0xd0 | ch, 0] })
        if (slid) ev.push({ tick: end, order: 2, bytes: [0xb0 | ch, 74, 64] })
      }
      offset += clip.lengthBeats
    }
    if (bends) {
      // RPN 0 (pitch bend range) = 48 semitones
      ev.push({ tick: 0, order: 1, bytes: [0xb0 | ch, 101, 0] })
      ev.push({ tick: 0, order: 1, bytes: [0xb0 | ch, 100, 0] })
      ev.push({ tick: 0, order: 1, bytes: [0xb0 | ch, 6, BEND_RANGE] })
      ev.push({ tick: 0, order: 1, bytes: [0xb0 | ch, 38, 0] })
    }
    let lastTick = 0
    for (const e of ev) if (e.tick > lastTick) lastTick = e.tick
    const trackEnd = Math.max(Math.round(offset * PPQ), lastTick)
    longest = Math.max(longest, trackEnd)
    chunks.push(trackBytes(ev, trackEnd))
  }
  const tempo = trackBytes([
    { tick: 0, order: 0, bytes: nameMeta('Tempo') },
    { tick: 0, order: 1, bytes: [0xff, 0x51, 0x03, (us >> 16) & 255, (us >> 8) & 255, us & 255] },
    { tick: 0, order: 2, bytes: [0xff, 0x58, 0x04, 4, 2, 24, 8] }
  ], longest)
  const header = chunk('MThd', [0, 1, 0, chunks.length + 1, (PPQ >> 8) & 255, PPQ & 255])
  return Uint8Array.from([...header, ...tempo, ...chunks.flat()])
}
