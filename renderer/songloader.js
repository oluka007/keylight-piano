import { parseMidi } from './smf.js'
import { parseMusicXml } from './musicxml.js'
import { assignFingering } from './fingering.js'

const SONG_EXT = /\.(mid|midi|xml|musicxml|mxl)$/i

// Parse a MIDI, MusicXML or compressed MusicXML file (anything with .name and
// .arrayBuffer(), or a MusicXML .name with .text()).
export async function parseSongFile(file) {
  const name = file.name || 'song'
  if (!/\.(xml|musicxml|mxl)$/i.test(name)) return parseMidi(await file.arrayBuffer())
  if (!file.arrayBuffer) return parseMusicXml(await file.text())
  const bytes = new Uint8Array(await file.arrayBuffer())
  // the bytes decide, not the name: a zip is compressed MusicXML, XML text is plain
  const text = bytes[0] === 0x50 && bytes[1] === 0x4b ? null : decodeText(bytes)
  if (text != null && (/^\s*</.test(text) || !/\.mxl$/i.test(name))) return parseMusicXml(text)
  // the zip reader lives with the importer (loaded on use: it imports this module)
  const { readMxl } = await import('./importer.js')
  return parseMusicXml(await readMxl(bytes.buffer))
}

// XML text: UTF-16 when a byte order mark or the first '<' says so, UTF-8 otherwise
export function decodeText(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes)
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes)
  if (bytes[0] === 0x3c && bytes[1] === 0) return new TextDecoder('utf-16le').decode(bytes)
  if (bytes[0] === 0 && bytes[1] === 0x3c) return new TextDecoder('utf-16be').decode(bytes)
  return new TextDecoder('utf-8').decode(bytes)
}

// Normalise any supported file into the player's song model.
export async function loadSongFile(file) {
  return normalise(file.name || 'song', await parseSongFile(file))
}

// where a note came from in the file (MIDI track / channel / program, score part)
const NOTE_SOURCE = ['part', 'track', 'trackName', 'channel', 'program']

export function normalise(title, parsed) {
  const notes = (parsed.notes || []).map((n) => {
    const note = {
      pitch: n.pitch,
      start: Math.max(0, n.start),
      dur: Math.max(0.05, n.dur || 0.1),
      vel: n.vel ?? 100,
      hand: n.hand || (n.pitch < 60 ? 'left' : 'right')
    }
    // fingering written in the score is kept; the guess below fills the rest
    if (Number.isInteger(n.finger) && n.finger >= 1 && n.finger <= 5) note.finger = n.finger
    for (const k of NOTE_SOURCE) if (n[k] != null && n[k] !== '') note[k] = n[k]
    return note
  }).sort((a, b) => a.start - b.start)
  const tempo = Number.isFinite(parsed.tempo) && parsed.tempo >= 20 && parsed.tempo <= 400 ? parsed.tempo : 120
  assignFingering(notes, { tempo })
  const song = {
    title: parsed.title || title.replace(SONG_EXT, ''),
    notes,
    duration: parsed.duration || notes.reduce((m, n) => Math.max(m, n.start + n.dur), 0),
    tempo
  }
  if (parsed.artist) song.artist = parsed.artist
  if (parsed.timeSignature) song.timeSignature = parsed.timeSignature
  if (parsed.parts) song.parts = parsed.parts
  if (parsed.bars) song.bars = parsed.bars
  if (parsed.score) song.score = parsed.score
  return song
}

// group notes that start together (wait mode gates on groups, like the native app)
export function noteGroups(notes) {
  const map = new Map()
  for (const n of notes) {
    const key = Math.round(n.start * 1000) / 1000
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(n)
  }
  return [...map.entries()].map(([time, ns]) => ({ time, notes: ns })).sort((a, b) => a.time - b.time)
}
