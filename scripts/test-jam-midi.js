// Unit test for the Jam MIDI export (renderer/jam/midi-export.js): node scripts/test-jam-midi.js
const assert = require('node:assert/strict')

const load = (f) => import(require('node:url').pathToFileURL(require('node:path').join(__dirname, '..', 'renderer', 'jam', f)).href)

// Minimal Standard MIDI File reader: header, tracks, delta times, running
// status and meta events. Returns { format, division, ntrks, tracks, chunks },
// where each track is a list of { tick, type, channel, data }.
function readSmf(bytes) {
  let p = 0
  const need = (n) => {
    if (p + n > bytes.length) throw new Error('unexpected end of file')
  }
  const u8 = () => {
    need(1)
    return bytes[p++]
  }
  const u16 = () => (u8() << 8) | u8()
  const u32 = () => u8() * 0x1000000 + (u8() << 16) + (u8() << 8) + u8()
  const id = () => String.fromCharCode(u8(), u8(), u8(), u8())
  const vlq = () => {
    let v = 0
    for (;;) {
      const b = u8()
      v = v * 128 + (b & 0x7f)
      if ((b & 0x80) === 0) return v
    }
  }
  const bytesAt = (n) => {
    need(n)
    const out = Array.from(bytes.subarray(p, p + n))
    p += n
    return out
  }

  const headerId = id()
  assert.equal(headerId, 'MThd')
  const headerLen = u32()
  need(headerLen)
  const headerEnd = p + headerLen
  const format = u16()
  const ntrks = u16()
  const division = u16()
  p = headerEnd
  const chunks = [{ id: headerId, length: headerLen, contentLength: headerLen }]

  const tracks = []
  for (let t = 0; t < ntrks; t++) {
    const trackId = id()
    assert.equal(trackId, 'MTrk')
    const len = u32()
    need(len)
    const end = p + len
    const events = []
    let tick = 0
    let running = 0
    while (p < end) {
      tick += vlq()
      let status = u8()
      if (status < 0x80) {
        if (!running) throw new Error('running status without a status byte')
        p--
        status = running
      } else if (status < 0xf0) {
        running = status
      }
      const kind = status & 0xf0
      const channel = status & 0x0f
      if (status === 0xff) {
        const metaType = u8()
        const data = bytesAt(vlq())
        events.push({ tick, type: 'meta', channel: null, data: { type: metaType, data } })
      } else if (status === 0xf0 || status === 0xf7) {
        events.push({ tick, type: 'sysex', channel: null, data: { data: bytesAt(vlq()) } })
      } else if (kind === 0x90) {
        const note = u8()
        const velocity = u8()
        events.push({ tick, type: velocity === 0 ? 'noteOff' : 'noteOn', channel, data: { note, velocity } })
      } else if (kind === 0x80) {
        const note = u8()
        const velocity = u8()
        events.push({ tick, type: 'noteOff', channel, data: { note, velocity } })
      } else if (kind === 0xb0) {
        const controller = u8()
        const value = u8()
        events.push({ tick, type: 'controlChange', channel, data: { controller, value } })
      } else if (kind === 0xd0) {
        events.push({ tick, type: 'channelPressure', channel, data: { value: u8() } })
      } else if (kind === 0xe0) {
        const lsb = u8()
        const msb = u8()
        events.push({ tick, type: 'pitchBend', channel, data: { value: lsb | (msb << 7) } })
      } else if (kind === 0xc0) {
        events.push({ tick, type: 'programChange', channel, data: { program: u8() } })
      } else {
        throw new Error(`unsupported status 0x${status.toString(16)}`)
      }
    }
    assert.equal(p, end, 'MTrk chunk length matches its content')
    chunks.push({ id: trackId, length: len, contentLength: len })
    tracks.push(events)
  }
  assert.equal(p, bytes.length, 'no trailing bytes after the last chunk')
  return { format, division, ntrks, tracks, chunks }
}

const note = (t, dur, pitch, extra = {}) => ({ t, dur, pitch, vel: 100, lift: 64, g: [], ...extra })

const simpleSession = (clips, bpm = 120) => ({
  v: 1,
  bpm,
  swing: 0,
  key: 0,
  scale: 'major',
  tracks: [{
    kind: 'inst',
    name: 'Lead',
    instrument: 'piano',
    level: 0.8,
    send: 0,
    mute: false,
    slots: clips,
    active: [0]
  }]
})

;(async () => {
  const { sessionToMidi } = await load('midi-export.js')

  // (a) the clip length, not the last note, sets the track end
  {
    const midi = sessionToMidi(simpleSession([{ lengthBeats: 4, events: [note(0, 1, 60)] }]))
    const inst = readSmf(midi).tracks[1]
    const eot = inst.filter((e) => e.type === 'meta' && e.data.type === 0x2f)
    assert.equal(eot.length, 1)
    assert.equal(eot[0].tick, 1920)
  }

  // (b) a bend cannot leak past its note into the next note
  {
    const midi = sessionToMidi(simpleSession([{
      lengthBeats: 2,
      events: [
        note(0, 1, 60, { g: [{ dt: 0.5, k: 'bend', v: 12 }] }),
        note(1, 1, 62)
      ]
    }]))
    const ev = readSmf(midi).tracks[1]
    const iOff = ev.findIndex((e) => e.type === 'noteOff' && e.data.note === 60)
    const iOn = ev.findIndex((e) => e.type === 'noteOn' && e.data.note === 62)
    assert.ok(iOff >= 0, 'first note-off exists')
    assert.ok(iOn > iOff, 'second note-on follows the first note-off')
    const before = ev.slice(0, iOn).filter((e) => e.type === 'pitchBend')
    assert.ok(before.length > 0, 'the in-note bend is exported')
    assert.equal(before[before.length - 1].data.value, 8192, 'centre is the last bend before the next note-on')
    const offCentreAfterOff = ev.slice(iOff).filter((e) => e.type === 'pitchBend' && e.data.value !== 8192)
    assert.equal(offCentreAfterOff.length, 0, 'no off-centre bend at or after the first note-off')
  }

  // (c) gestures at or past the note end, and negative ones, are dropped
  {
    const midi = sessionToMidi(simpleSession([{
      lengthBeats: 2,
      events: [note(0, 1, 60, { g: [
        { dt: 1, k: 'bend', v: 12 },
        { dt: 1.5, k: 'bend', v: -12 },
        { dt: -0.5, k: 'press', v: 0.5 }
      ] })]
    }]))
    const ev = readSmf(midi).tracks[1]
    assert.equal(ev.filter((e) => e.type === 'pitchBend').length, 0, 'dt >= dur is dropped')
    assert.equal(ev.filter((e) => e.type === 'channelPressure').length, 0, 'negative dt is dropped')
  }

  // (d) pressure and slide are reset after the note, before the next note-on
  {
    const midi = sessionToMidi(simpleSession([{
      lengthBeats: 2,
      events: [
        note(0, 0.5, 60, { g: [
          { dt: 0.1, k: 'press', v: 0.8 },
          { dt: 0.2, k: 'slide', v: 0.5 }
        ] }),
        note(0.5, 0.5, 62)
      ]
    }]))
    const ev = readSmf(midi).tracks[1]
    const iOff = ev.findIndex((e) => e.type === 'noteOff' && e.data.note === 60)
    const iOn = ev.findIndex((e) => e.type === 'noteOn' && e.data.note === 62)
    assert.ok(iOff >= 0 && iOn > iOff, 'note-off comes before the next note-on')
    const region = ev.slice(iOff, iOn)
    assert.ok(region.some((e) => e.type === 'channelPressure' && e.data.value === 0), 'pressure reset')
    assert.ok(region.some((e) => e.type === 'controlChange' && e.data.controller === 74 && e.data.value === 64), 'CC74 reset')
    assert.ok(ev[iOff].tick <= ev[iOn].tick)
  }

  // (e) a note with no gestures leaves no expression behind
  {
    const midi = sessionToMidi(simpleSession([{ lengthBeats: 1, events: [note(0, 1, 60)] }]))
    const ev = readSmf(midi).tracks[1]
    assert.equal(ev.filter((e) => e.type === 'pitchBend').length, 0)
    assert.equal(ev.filter((e) => e.type === 'channelPressure').length, 0)
    assert.equal(ev.filter((e) => e.type === 'controlChange' && e.data.controller === 74).length, 0)
  }

  // (f) header and chunk lengths are well formed
  {
    const midi = sessionToMidi(simpleSession([{
      lengthBeats: 4,
      events: [note(0, 1, 60), note(1, 1, 64)]
    }]))
    assert.equal(String.fromCharCode(midi[0], midi[1], midi[2], midi[3]), 'MThd')
    const smf = readSmf(midi)
    assert.equal(smf.format, 1)
    assert.equal(smf.division, 480)
    assert.equal(smf.chunks.length, smf.ntrks + 1)
    assert.equal(smf.tracks.length, smf.ntrks)
    for (const c of smf.chunks) {
      assert.ok(c.id === 'MThd' || c.id === 'MTrk')
      assert.equal(c.length, c.contentLength, `${c.id} chunk length matches its content`)
    }
  }

  console.log('jam-midi: ok')
})().catch((e) => { console.error(e); process.exit(1) })
