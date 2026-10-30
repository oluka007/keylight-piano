// Standard MIDI File parser: format 0/1, tempo map, parts and hands.
//
// Every note keeps where it came from (track index, track name, channel 0-15,
// program 0-127) and song.parts lists each track + channel that has notes, so an
// import sheet can offer the parts. Hands: two melodic parts are right / left by
// average pitch; one part holding both hands is split at middle C with
// hysteresis; three or more parts each take the hand of their average pitch.
// Channel 10 (drums) is skipped.

const BAND = 5   // semitones either side of the split where a note follows its line

// Track names that are not a song's title
const NOT_A_TITLE = /^((acoustic |grand |electric )*piano|track|staff|part|instrument|voice|sequence|untitled|melody|right( hand)?|left( hand)?|rh|lh|bass|drums?|tempo( track| map)?|conductor|control|midi( out)?|new song)? *\d*$|copyright|©|\(c\)|sequenced by/i

export function parseMidi(buffer, opts = {}) {
  const split = opts.split ?? 60
  const dv = new DataView(buffer)
  const size = dv.byteLength
  let pos = 0
  const u8 = () => dv.getUint8(pos++)
  const u16 = () => { const v = dv.getUint16(pos); pos += 2; return v }
  const u32 = () => { const v = dv.getUint32(pos); pos += 4; return v }
  const tag = () => { let s = ''; for (let i = 0; i < 4; i++) s += String.fromCharCode(u8()); return s }
  const vlq = () => { let v = 0, b; do { b = u8(); v = v * 128 + (b & 0x7f) } while (b & 0x80); return v }
  const text = (at, n) => {
    const bytes = new Uint8Array(dv.buffer, dv.byteOffset + at, Math.max(0, Math.min(n, size - at)))
    let s
    try { s = new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch {
      s = ''
      for (const b of bytes) s += String.fromCharCode(b)   // Latin-1, the usual fallback
    }
    return s.replace(/[\0-\x1f]+/g, ' ').trim()
  }

  if (size < 14 || tag() !== 'MThd') throw new Error('Not a MIDI file')
  const hlen = u32(); const format = u16(); const ntracks = u16(); const division = u16()
  pos = 8 + hlen
  // SMPTE files count ticks in frames: a fixed number of seconds per tick
  let smpte = 0
  if (division & 0x8000) {
    const fps = 256 - (division >> 8)
    smpte = 1 / ((fps === 29 ? 29.97 : fps) * (division & 0xff))
    if (!Number.isFinite(smpte)) throw new Error('Invalid MIDI timing')
  } else if (!division) throw new Error('Invalid MIDI timing')
  const ticksPerBeat = smpte ? 0.5 / smpte : division

  const tempos = []                         // { tick, us }
  let meter = null                          // first time signature { tick, beats, beatType }
  const tracks = []                         // tracks that have notes
  const names = []                          // every track's name, for the title
  const firstProgram = new Array(16).fill(-1)
  for (let t = 0; t < ntracks && pos + 8 <= size; t++) {
    const id = tag()
    const len = u32()
    // the end is measured from the start of the chunk data, after the length field
    const end = Math.min(size, pos + len)
    if (id !== 'MTrk') { pos = end; t--; continue }   // skip unknown chunks
    const track = { index: t, name: '', notes: [] }
    let instrument = ''                     // meta 0x04, the name when the track has none
    const program = new Array(16).fill(-1)
    const open = new Map()                  // channel * 128 + pitch -> notes still sounding, oldest first
    let tick = 0, running = 0
    try {
      while (pos < end) {
        tick += vlq()
        let status = dv.getUint8(pos)
        if (status & 0x80) pos++
        else if (!running) { pos++; continue }   // a data byte with nothing to run on
        else status = running
        if (status === 0xff) {
          const type = u8(), n = vlq()
          if (type === 0x51 && n === 3) {
            const us = (dv.getUint8(pos) << 16) | (dv.getUint8(pos + 1) << 8) | dv.getUint8(pos + 2)
            if (us >= 20000) tempos.push({ tick, us })   // ignore broken values (over 3000 bpm or 0)
          } else if (type === 0x58 && n >= 2 && (!meter || tick < meter.tick)) {
            meter = { tick, beats: dv.getUint8(pos), beatType: 2 ** Math.min(6, dv.getUint8(pos + 1)) }
          } else if (type === 0x03 && !track.name) track.name = text(pos, n)
          else if (type === 0x04 && !instrument) instrument = text(pos, n)
          pos += n
          if (type === 0x2f) break           // end of track
        } else if (status === 0xf0 || status === 0xf7) {
          const n = vlq()                   // (read first: vlq moves pos)
          pos += n                          // sysex: running status carries on past it, as it does past meta events
        } else if (status > 0xf0) {
          pos += status === 0xf2 ? 2 : status === 0xf1 || status === 0xf3 ? 1 : 0   // stray system messages
        } else {
          running = status                  // only channel messages set running status
          const type = status & 0xf0, ch = status & 0x0f
          if (type === 0x90 || type === 0x80) {
            const pitch = dv.getUint8(pos) & 0x7f, vel = dv.getUint8(pos + 1) & 0x7f; pos += 2
            if (ch === 9) continue          // channel 10 is drums, not piano notes
            const key = ch * 128 + pitch
            if (type === 0x90 && vel > 0) {
              const note = { pitch, vel, start: tick, end: -1, channel: ch, program: program[ch] }
              track.notes.push(note)
              const list = open.get(key)
              if (list) list.push(note); else open.set(key, [note])
            } else {
              // the oldest note of that key ends: a re-struck key written "on, then off"
              // on one tick keeps both strikes
              const list = open.get(key)
              if (list && list.length) list.shift().end = tick
            }
          } else if (type === 0xc0) {
            program[ch] = dv.getUint8(pos) & 0x7f; pos += 1
            if (firstProgram[ch] < 0) firstProgram[ch] = program[ch]
          } else if (type === 0xd0) pos += 1
          else pos += 2
        }
      }
    } catch (e) {
      if (!(e instanceof RangeError)) throw e   // the file is cut short: keep what was read
    }
    pos = end
    for (const n of track.notes) if (n.end < 0) n.end = tick   // never released: ends with the track
    names[t] = track.name
    if (!track.name) track.name = instrument
    if (track.notes.length) tracks.push(track)
  }

  // seconds at each tempo change, so a tick converts with one binary search
  tempos.sort((a, b) => a.tick - b.tick)
  const map = [{ tick: 0, us: 500000, sec: 0 }]
  for (const t of tempos) {
    const last = map[map.length - 1]
    if (t.tick === last.tick) { last.us = t.us; continue }   // same tick: the later one wins
    map.push({ tick: t.tick, us: t.us, sec: last.sec + ((t.tick - last.tick) / division) * (last.us / 1e6) })
  }
  const segAt = (tick) => {
    let lo = 0, hi = map.length - 1
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (map[mid].tick <= tick) lo = mid; else hi = mid - 1 }
    return map[lo]
  }
  const sec = smpte ? (tick) => tick * smpte : (tick) => { const m = segAt(tick); return m.sec + ((tick - m.tick) / division) * (m.us / 1e6) }

  // parts: each track + channel with notes
  const parts = []
  const partOf = new Map()
  for (const tr of tracks) {
    for (const n of tr.notes) {
      if (n.program < 0) n.program = firstProgram[n.channel] >= 0 ? firstProgram[n.channel] : 0
      const key = tr.index * 16 + n.channel
      let part = partOf.get(key)
      if (!part) {
        part = { index: tr.index, name: tr.name, channel: n.channel, program: n.program, noteCount: 0, low: 127, high: 0, hand: 'right', notes: [], sum: 0 }
        partOf.set(key, part)
        parts.push(part)
      }
      part.notes.push(n)
      part.noteCount++
      part.sum += n.pitch
      if (n.pitch < part.low) part.low = n.pitch
      if (n.pitch > part.high) part.high = n.pitch
    }
  }
  if (!parts.length) throw new Error('No notes found in this MIDI file')

  // hands
  const avg = (p) => p.sum / p.noteCount
  if (parts.length === 2) {
    const [hi, lo] = avg(parts[0]) >= avg(parts[1]) ? parts : [parts[1], parts[0]]
    hi.hand = 'right'
    lo.hand = 'left'
  } else if (parts.length === 1) {
    // one line of melody is one hand (the right, unless it lives below the split);
    // anything with chords or two lines is both hands, split
    if (singleLine(parts[0].notes, ticksPerBeat)) parts[0].hand = avg(parts[0]) < split - BAND ? 'left' : 'right'
    else { parts[0].hand = 'both'; splitHands(parts[0].notes, split, ticksPerBeat) }
  } else {
    for (const p of parts) p.hand = avg(p) < 60 ? 'left' : 'right'
  }

  const notes = []
  parts.forEach((p, i) => {
    for (const n of p.notes) {
      const start = sec(n.start)
      const note = {
        pitch: n.pitch, vel: n.vel, start, dur: Math.max(0.05, sec(n.end) - start),
        hand: p.hand === 'both' ? n.hand : p.hand, part: i, track: p.index, channel: n.channel, program: n.program
      }
      if (p.name) note.trackName = p.name
      notes.push(note)
    }
  })
  notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch)
  let duration = 0
  for (const n of notes) if (n.start + n.dur > duration) duration = n.start + n.dur
  // the tempo in force at the first note drives count-in, metronome and band
  let firstTick = Infinity
  for (const p of parts) if (p.notes[0].start < firstTick) firstTick = p.notes[0].start
  const tempo = Math.max(20, Math.min(400, 60e6 / segAt(firstTick).us))
  // a format 0 file's track name, or a format 1 file's tempo track name, is the song's
  const seqName = format === 0 || (tracks[0] && tracks[0].index !== 0) ? names[0] : ''
  return {
    notes, duration, tempo,
    title: seqName && !NOT_A_TITLE.test(seqName) && seqName.length <= 80 ? seqName : '',
    timeSignature: meter && meter.beats ? { beats: meter.beats, beatType: meter.beatType } : null,
    parts: parts.map((p) => ({ index: p.index, name: p.name, channel: p.channel, program: p.program, noteCount: p.noteCount, low: p.low, high: p.high, hand: p.hand }))
  }
}

// A part that never plays two notes at once (allowing legato overlaps) is one
// hand's line, not both hands.
function singleLine(notes, ticksPerBeat) {
  const slack = ticksPerBeat / 8
  let together = 0, lastEnd = -Infinity
  for (const n of notes) {
    if (n.start < lastEnd - slack) together++
    if (n.end > lastEnd) lastEnd = n.end
  }
  return together <= notes.length * 0.05
}

// One part holding both hands: split at `split` (middle C) with hysteresis. Notes a
// fourth or more away from it go to their side; nearer ones stay with the hand whose
// line they carry on (within a fifth, under a beat after that hand's last note),
// and the hands never cross inside one chord. notes: in start order, times in ticks.
function splitHands(notes, split, ticksPerBeat) {
  const together = ticksPerBeat / 16      // a chord's notes may be a hair apart
  let lastR = null, lastL = null          // each hand's line: right's lowest note, left's highest
  const carries = (last, p, t) => last && t - last.end < ticksPerBeat && Math.abs(p - last.pitch) <= 7
  for (let i = 0; i < notes.length;) {
    let j = i + 1
    while (j < notes.length && notes[j].start - notes[i].start <= together) j++
    const group = notes.slice(i, j).sort((a, b) => a.pitch - b.pitch)
    const t = notes[i].start
    let right = false
    for (const n of group) {
      const p = n.pitch
      if (!right) {
        if (p >= split + BAND) right = true
        else if (p >= split - BAND) {
          // below the split: left unless it clearly carries on the right hand's line
          // (and the other way round); a tie goes to the hand that played last
          const dR = carries(lastR, p, t) ? Math.abs(p - lastR.pitch) : Infinity
          const dL = carries(lastL, p, t) ? Math.abs(p - lastL.pitch) : Infinity
          if (p < split) right = dR < dL || (dR === dL && dR < Infinity && lastR.at > lastL.at)
          else right = !(dL < dR || (dL === dR && dL < Infinity && lastL.at > lastR.at))
        }
      }
      n.hand = right ? 'right' : 'left'
    }
    for (const n of group) {
      if (n.hand === 'right') {
        if (!lastR || lastR.at !== t) lastR = { pitch: n.pitch, end: n.end, at: t }
        else lastR.end = Math.max(lastR.end, n.end)
      } else if (!lastL || lastL.at !== t) lastL = { pitch: n.pitch, end: n.end, at: t }
      else { lastL.pitch = n.pitch; lastL.end = Math.max(lastL.end, n.end) }
    }
    i = j
  }
}
