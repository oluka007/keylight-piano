import { assignFingering } from './fingering.js'

export const MAX_SECONDS = 4 * 60 * 60
export const MAX_NOTES = 100000
const MIN_DUR = 0.05
const UNDO_DEPTH = 200
const SOURCE_NUMBERS = ['part', 'track', 'channel', 'program']
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const STEPS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
export const pitchName = (pitch) => NAMES[pitch % 12] + (Math.floor(pitch / 12) - 1)

export function parsePitch(text) {
  const value = String(text).trim()
  if (/^\d{1,3}$/.test(value)) return Number(value) <= 127 ? Number(value) : null
  const match = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(value)
  if (!match) return null
  const pitch = (Number(match[3]) + 1) * 12 + STEPS[match[1].toUpperCase()] + (match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0)
  return pitch >= 0 && pitch <= 127 ? pitch : null
}
const isNum = (value) => typeof value === 'number' && Number.isFinite(value)

export function checkNote(value) {
  if (!value || typeof value !== 'object') return { error: 'is not a note' }
  if (!Number.isInteger(value.pitch) || value.pitch < 0 || value.pitch > 127) return { error: 'has no pitch from 0 to 127' }
  if (!isNum(value.start) || value.start < 0 || value.start > MAX_SECONDS) return { error: 'starts outside the song' }
  if (!isNum(value.dur) || value.dur < MIN_DUR || value.dur > MAX_SECONDS) return { error: `is shorter than ${MIN_DUR} s or too long` }
  if (value.hand !== 'left' && value.hand !== 'right') return { error: 'has no hand' }
  if (value.finger != null && !(Number.isInteger(value.finger) && value.finger >= 1 && value.finger <= 5)) return { error: 'has a finger other than 1 to 5' }
  if (value.vel != null && !(Number.isInteger(value.vel) && value.vel >= 0 && value.vel <= 127)) return { error: 'has a velocity other than 0 to 127' }
  const note = { pitch: value.pitch, start: value.start, dur: value.dur, vel: value.vel ?? 100, hand: value.hand }
  if (value.finger != null) note.finger = value.finger
  for (const key of SOURCE_NUMBERS) if (isNum(value[key])) note[key] = value[key]
  if (typeof value.trackName === 'string' && value.trackName && value.trackName.length <= 200) note.trackName = value.trackName
  return { note }
}
export function checkNotes(notes) {
  if (!Array.isArray(notes) || !notes.length) return { error: 'A song needs at least one note' }
  if (notes.length > MAX_NOTES) return { error: `A song can have up to ${MAX_NOTES} notes` }
  const out = []
  for (let i = 0; i < notes.length; i++) {
    const result = checkNote(notes[i])
    if (result.error) return { error: `Note ${i + 1} ${result.error}` }
    out.push(result.note)
  }
  return { notes: out.sort((a, b) => a.start - b.start || a.pitch - b.pitch) }
}
const shape = (note) => `${note.pitch}:${Math.round(note.start * 1000)}:${Math.round(note.dur * 1000)}:${note.hand}`
const playedShape = (notes) => notes.map(shape).sort().join('|')
const fullShape = (notes) => notes.map((note) => shape(note) + ':' + (note.finger || '')).sort().join('|')
const validTempo = (tempo) => isNum(tempo) && tempo >= 20 && tempo <= 400

export class NoteDraft {
  constructor(song) {
    this.original = song
    this.copy = typeof song.importedId !== 'string'
    this.nextKey = 0
    this.notes = song.notes.map((note) => this.keyed(note))
    this.tempo = validTempo(song.tempo) ? song.tempo : 120
    this.history = []
    this.start = this.signature()
    this.sort()
  }
  keyed(value) {
    const note = { ...value, key: ++this.nextKey }
    if (!note.hand) note.hand = note.pitch < 60 ? 'left' : 'right'
    return note
  }
  signature() { return fullShape(this.notes) + '#' + this.tempo }
  get dirty() { return this.signature() !== this.start }
  get canUndo() { return this.history.length > 0 }
  sort() { this.notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch || a.key - b.key) }
  indexOf(key) { return this.notes.findIndex((note) => note.key === key) }
  change(action) {
    this.history.push({ notes: this.notes.map((note) => ({ ...note })), tempo: this.tempo })
    if (this.history.length > UNDO_DEPTH) this.history.shift()
    action()
    this.sort()
  }
  undo() {
    const previous = this.history.pop()
    if (!previous) return false
    this.notes = previous.notes
    this.tempo = previous.tempo
    return true
  }
  set(key, field, raw) {
    const note = this.notes[this.indexOf(key)]
    if (!note) return 'That note was removed'
    let value
    switch (field) {
      case 'pitch':
        value = parsePitch(raw)
        if (value == null) return 'Type a note like C4, F#3 or Bb2, or a number from 0 to 127'
        break
      case 'start':
        value = Number(raw)
        if (String(raw).trim() === '' || !isNum(value) || value < 0 || value > MAX_SECONDS) return 'Type a start time in seconds, 0 or more'
        break
      case 'dur':
        value = Number(raw)
        if (String(raw).trim() === '' || !isNum(value) || value < MIN_DUR || value > MAX_SECONDS) return `Type a length in seconds, at least ${MIN_DUR}`
        break
      case 'hand':
        if (raw !== 'left' && raw !== 'right') return 'Pick a hand'
        value = raw
        break
      case 'finger':
        value = raw === '' ? null : Number(raw)
        if (value != null && !(Number.isInteger(value) && value >= 1 && value <= 5)) return 'Pick a finger from 1 to 5, or Auto'
        break
      default: throw new TypeError('Unknown note field ' + field)
    }
    if ((note[field] ?? null) === value) return null
    this.change(() => { if (value == null) delete note[field]; else note[field] = value })
    return null
  }
  setTempo(raw) {
    const tempo = Number(raw)
    if (String(raw).trim() === '' || !validTempo(tempo)) return 'Type a tempo from 20 to 400 beats a minute'
    if (tempo !== this.tempo) this.change(() => { this.tempo = tempo })
    return null
  }
  add(afterKey) {
    const index = afterKey == null ? -1 : this.indexOf(afterKey)
    const previous = index >= 0 ? this.notes[index] : this.notes[this.notes.length - 1]
    const note = this.keyed({ pitch: previous ? previous.pitch : 60, start: previous ? Math.round((previous.start + previous.dur) * 1000) / 1000 : 0, dur: previous ? previous.dur : 0.5, vel: 100, hand: previous ? previous.hand : 'right' })
    this.change(() => this.notes.push(note))
    return note.key
  }
  remove(key) {
    const index = this.indexOf(key)
    if (index >= 0) this.change(() => this.notes.splice(index, 1))
  }
  build() {
    const checked = checkNotes(this.notes)
    if (checked.error) return { error: checked.error }
    const notes = checked.notes
    assignFingering(notes, { tempo: this.tempo })
    const source = this.original
    const played = playedShape(notes) !== playedShape(source.notes)
    const end = notes.reduce((maximum, note) => Math.max(maximum, note.start + note.dur), 0)
    const duration = !played && isNum(source.duration) ? Math.max(source.duration, end) : Math.max(end, source.source === 'audio' && isNum(source.duration) ? source.duration : 0)
    const song = { ...source, notes, tempo: this.tempo, duration }
    if (played) {
      song.score = null
      if (Array.isArray(source.bars)) song.bars = source.bars.filter((time) => time <= duration)
    }
    if (this.copy) {
      Object.assign(song, { id: undefined, importedId: undefined, file: undefined, added: undefined, source: 'score', title: `${source.title || 'Song'} (my copy)` })
      song.audio = typeof Blob !== 'undefined' && source.audio instanceof Blob ? source.audio : null
    } else song.id = source.importedId
    return { song }
  }
}
