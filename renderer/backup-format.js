// Back up and restore the added-songs library (with each song's recording) and the
// lumi.* settings and progress kept in localStorage, as one file.
//
// File layout (version 1):
//   16 bytes  "KEYLIGHT-BACKUP\n"
//    4 bytes  manifest length in bytes, unsigned little-endian
//    n bytes  manifest, UTF-8 JSON: { format, version, created, songs, storage }
//    rest     each song's recording, raw bytes back to back in song order; a song's
//             manifest entry holds { offset, size, type, name } from the start of `rest`
// The recordings are never copied into memory: a backup is a Blob made of the stored
// Blobs, and a restore stores slices of the chosen file.
//
// A restore reads and checks the whole file before it writes anything, asks first, then
// writes settings (undone again if anything fails) and saves every song in one batch.
// Keys and songs that are not in the backup are left alone; ones that are get replaced.
import { checkNotes, MAX_SECONDS } from './editor-model.js'
import { isSafeCover } from './importer.js'
import { isNum, plain, validStoredValue } from './storage-validation.js'

export const MAGIC = 'KEYLIGHT-BACKUP\n'
export const VERSION = 1
export const EXTENSION = '.keylightbackup'
const HEAD = MAGIC.length + 4

const LIMIT = {
  manifest: 256 * 1024 * 1024,
  songs: 5000,
  audio: 1024 * 1024 * 1024,      // one recording
  cover: 5 * 1024 * 1024,
  text: 300,                      // title, artist, album, a file name
  xml: 32 * 1024 * 1024,
  list: 100000,                   // bars, score measures, lyric lines
  keys: 10000,
  value: 2 * 1024 * 1024,
  storage: 5 * 1024 * 1024        // all values together: about what localStorage holds
}
const STORAGE_KEY = /^lumi\.[\x21-\x7e]{1,200}$/
const SONG_ID = /^[A-Za-z0-9_-]{1,80}$/

export class BackupError extends Error {
  constructor(message) { super(message); this.name = 'BackupError' }
}
const fail = (message) => { throw new BackupError(message) }

const str = (v, max, what) => {
  if (v == null || v === '') return ''
  if (typeof v !== 'string' || v.length > max) fail(`${what} is not text or is too long`)
  return v
}
const numbers = (v, what, { int = false, min = -Infinity } = {}) => {
  if (!Array.isArray(v) || v.length > LIMIT.list || !v.every((x) => isNum(x) && x >= min && (!int || Number.isInteger(x)))) fail(`${what} is not a list of numbers`)
  return v.slice()
}

function timeSignature(v, what) {
  if (v == null) return null
  if (!plain(v) || !Number.isInteger(v.beats) || !Number.isInteger(v.beatType) || v.beats < 1 || v.beats > 64 || v.beatType < 1 || v.beatType > 64) fail(`${what}: time signature is not valid`)
  return { beats: v.beats, beatType: v.beatType }
}
// MIDI tracks / score parts: small objects of plain values (smf.js, musicxml.js)
function parts(v, what) {
  if (v == null) return null
  if (!Array.isArray(v) || v.length > 256) fail(`${what}: parts are not valid`)
  return v.map((p) => {
    if (!plain(p) || Object.keys(p).length > 20) fail(`${what}: a part is not valid`)
    const out = {}
    for (const [k, x] of Object.entries(p)) {
      if (!/^[A-Za-z]{1,32}$/.test(k)) fail(`${what}: a part has an unknown field`)
      if (!(x === null || typeof x === 'boolean' || isNum(x) || (typeof x === 'string' && x.length <= LIMIT.text))) fail(`${what}: a part has an unknown value`)
      out[k] = x
    }
    return out
  })
}
function score(v, what) {
  if (v == null) return null
  if (!plain(v) || typeof v.xml !== 'string' || v.xml.length > LIMIT.xml || !Array.isArray(v.tempo) || v.tempo.length > LIMIT.list) fail(`${what}: the sheet music is not valid`)
  const tempo = v.tempo.map((t) => {
    if (!plain(t) || !isNum(t.beat) || !isNum(t.bpm) || t.bpm <= 0) fail(`${what}: the sheet music tempo is not valid`)
    return { beat: t.beat, bpm: t.bpm }
  })
  return { xml: v.xml, order: numbers(v.order, what + ': bar order', { int: true, min: 0 }), starts: numbers(v.starts, what + ': bar starts'), tempo }
}
function lyrics(v, what) {
  if (v == null) return null
  if (plain(v) && Array.isArray(v.synced) && v.synced.length <= LIMIT.list) {
    return { synced: v.synced.map((l) => {
      if (!plain(l) || !isNum(l.t) || l.t < 0 || typeof l.text !== 'string' || l.text.length > 1000) fail(`${what}: a lyric line is not valid`)
      return { t: l.t, text: l.text }
    }) }
  }
  if (plain(v) && typeof v.plain === 'string' && v.plain.length <= 200000) return { plain: v.plain }
  return fail(`${what}: the lyrics are not valid`)
}

// One song of the manifest, rebuilt from known fields in the shape saveImported takes.
// audioAt(entry) turns the manifest's audio entry into a Blob.
function readSong(s, i, audioAt) {
  if (!plain(s)) fail(`Song ${i + 1} is not valid`)
  if (typeof s.id !== 'string' || !SONG_ID.test(s.id)) fail(`Song ${i + 1} has no valid id`)
  const what = `"${typeof s.title === 'string' ? s.title.slice(0, 60) : s.id}"`
  const notes = checkNotes(s.notes)
  if (notes.error) fail(`${what}: ${notes.error}`)
  if (!isNum(s.duration) || s.duration <= 0 || s.duration > MAX_SECONDS) fail(`${what}: the length is not valid`)
  if (!isNum(s.tempo) || s.tempo < 20 || s.tempo > 400) fail(`${what}: the tempo is not valid`)
  if (s.cover != null && !(typeof s.cover === 'string' && s.cover.length <= LIMIT.cover && isSafeCover(s.cover))) fail(`${what}: the cover is not a PNG, JPEG, GIF or WebP image`)
  if (s.source != null && s.source !== 'audio' && s.source !== 'score') fail(`${what}: the source is not known`)
  if (s.added != null && !(isNum(s.added) && s.added >= 0)) fail(`${what}: the date added is not valid`)
  if (s.lyricsFromFile != null && typeof s.lyricsFromFile !== 'boolean') fail(`${what}: lyricsFromFile is not true or false`)
  return {
    id: s.id,
    title: str(s.title, LIMIT.text, what + ': the title') || 'Untitled',
    artist: str(s.artist, LIMIT.text, what + ': the artist'),
    album: str(s.album, LIMIT.text, what + ': the album'),
    notes: notes.notes, duration: s.duration, tempo: s.tempo,
    timeSignature: timeSignature(s.timeSignature, what), parts: parts(s.parts, what),
    bars: s.bars == null ? null : numbers(s.bars, what + ': bars', { min: 0 }),
    score: score(s.score, what),
    cover: s.cover || null, lyrics: lyrics(s.lyrics, what), lyricsFromFile: !!s.lyricsFromFile,
    audio: s.audio == null ? null : audioAt(s.audio, what),
    source: s.source ?? undefined, added: s.added ?? Date.now()
  }
}

const AUDIO_TYPE = /^(audio\/[A-Za-z0-9.+-]{1,60}|)$/
const audioMeta = (blob, fallbackName) => ({
  type: AUDIO_TYPE.test(blob.type || '') ? blob.type || '' : '',
  name: typeof blob.name === 'string' && blob.name && blob.name.length <= LIMIT.text ? blob.name : fallbackName
})

// lumi.* entries of a Storage (localStorage)
function lumiEntries(storage) {
  const out = {}
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i)
    if (k != null && STORAGE_KEY.test(k)) out[k] = storage.getItem(k)
  }
  return out
}
function checkStorage(v) {
  if (!plain(v)) fail('The settings and progress part is not valid')
  const entries = Object.entries(v)
  if (entries.length > LIMIT.keys) fail('The backup has too many settings')
  let total = 0
  for (const [k, x] of entries) {
    if (!STORAGE_KEY.test(k)) fail(`The backup holds a setting this app does not use (${k.slice(0, 40)})`)
    if (typeof x !== 'string' || x.length > LIMIT.value) fail(`The setting ${k} is not valid`)
    let value
    try { value = JSON.parse(x) } catch { fail(`The setting ${k} is not valid`) }
    if (!validStoredValue(k, value)) fail(`The setting ${k} is not valid`)
    total += k.length + x.length
  }
  if (total > LIMIT.storage) fail('The settings and progress in this backup are too large')
  return Object.fromEntries(entries)
}

const pad = (n) => String(n).padStart(2, '0')
const stamp = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`

// createBackup({ songs, storage, now? }) -> { blob, name, songs, keys, skipped }
//   songs: the imported records (importer.js listImported()), storage: localStorage.
//   A song that would not restore is left out and named in skipped: [{ title, reason }].
export async function createBackup({ songs, storage, now = new Date() }) {
  const entries = [], blobs = [], skipped = []
  let offset = 0
  for (const rec of songs) {
    let entry
    try {
      const song = readSong({ ...rec, audio: null }, entries.length, () => null)
      entry = { ...song, audio: null }
    } catch (e) {
      if (!(e instanceof BackupError)) throw e
      skipped.push({ title: rec && rec.title ? String(rec.title) : 'Untitled', reason: e.message })
      continue
    }
    if (rec.audio instanceof Blob) {
      if (rec.audio.size > LIMIT.audio) { skipped.push({ title: entry.title, reason: 'the recording is larger than 1 GB' }); continue }
      entry.audio = { offset, size: rec.audio.size, ...audioMeta(rec.audio, entry.title) }
      offset += rec.audio.size
      blobs.push(rec.audio)
    }
    entries.push(entry)
  }
  // an entry the restore would refuse is left out and named, never dropped quietly
  const kept = {}
  for (const [k, v] of Object.entries(lumiEntries(storage))) {
    try { Object.assign(kept, checkStorage({ [k]: v })) } catch (e) {
      if (!(e instanceof BackupError)) throw e
      skipped.push({ title: k, reason: e.message })
    }
  }
  const manifest = new TextEncoder().encode(JSON.stringify({
    format: 'keylight-backup', version: VERSION, created: now.toISOString(), songs: entries, storage: checkStorage(kept)
  }))
  if (manifest.length > LIMIT.manifest) fail('The library is too large for one backup')
  const head = new Uint8Array(HEAD)
  head.set(new TextEncoder().encode(MAGIC))
  new DataView(head.buffer).setUint32(MAGIC.length, manifest.length, true)
  const blob = new Blob([head, manifest, ...blobs], { type: 'application/octet-stream' })
  return { blob, name: `keylight-backup-${stamp(now)}${EXTENSION}`, songs: entries.length, keys: Object.keys(kept).length, skipped }
}

// readBackup(file) -> { created, songs, storage }: the whole file checked, nothing written.
// Throws BackupError with a message for the user.
export async function readBackup(file) {
  if (!(file instanceof Blob) || file.size < HEAD) fail('This is not a Keylight backup')
  const head = new Uint8Array(await file.slice(0, HEAD).arrayBuffer())
  if (new TextDecoder().decode(head.subarray(0, MAGIC.length)) !== MAGIC) fail('This is not a Keylight backup')
  const length = new DataView(head.buffer).getUint32(MAGIC.length, true)
  if (length > LIMIT.manifest || HEAD + length > file.size) fail('This backup is damaged or incomplete')
  let m
  try { m = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await file.slice(HEAD, HEAD + length).arrayBuffer())) } catch { fail('This backup is damaged') }
  if (!plain(m) || m.format !== 'keylight-backup' || !Number.isInteger(m.version)) fail('This is not a Keylight backup')
  if (m.version > VERSION) fail('This backup comes from a newer Keylight. Update the app to restore it.')
  if (m.version < 1) fail('This backup version is not known')
  if (!Array.isArray(m.songs) || m.songs.length > LIMIT.songs) fail('The song list in this backup is not valid')
  if (typeof m.created !== 'string' || Number.isNaN(Date.parse(m.created))) fail('The backup date is not valid')

  const base = HEAD + length
  let next = 0
  const audioAt = (a, what) => {
    // recordings sit back to back in song order, so every byte is accounted for
    if (!plain(a) || !Number.isInteger(a.offset) || !Number.isInteger(a.size) || a.offset !== next || a.size < 0 || a.size > LIMIT.audio) fail(`${what}: the recording is not valid`)
    if (typeof a.type !== 'string' || !AUDIO_TYPE.test(a.type)) fail(`${what}: the recording type is not audio`)
    const name = str(a.name, LIMIT.text, what + ': the recording name') || 'recording'
    next += a.size
    if (base + next > file.size) fail('This backup is damaged or incomplete')
    return new File([file.slice(base + a.offset, base + a.offset + a.size)], name, { type: a.type })
  }
  const ids = new Set()
  const songs = m.songs.map((s, i) => {
    const song = readSong(s, i, audioAt)
    if (ids.has(song.id)) fail(`The backup holds song ${song.id} twice`)
    ids.add(song.id)
    return song
  })
  if (base + next !== file.size) fail('This backup is damaged: it holds bytes no song uses')
  return { created: m.created, songs, storage: checkStorage(m.storage) }
}

// restoreBackup(file, { saveSongs, storage, confirm }) -> { restored, songs, keys }
//   saveSongs(songs): saves every song in one transaction, all or none (a rejection
//     means none were saved). confirm(plan): true to go ahead; plan is readBackup's
//     result. Declining writes nothing.
export async function restoreBackup(file, { saveSongs, storage, confirm }) {
  const plan = await readBackup(file)
  if (!(await confirm(plan))) return { restored: false, songs: 0, keys: 0 }
  const keys = Object.keys(plan.storage)
  const written = new Map()       // key -> its value before the restore (null: there was none)
  const putBack = () => {
    for (const key of written.keys()) storage.removeItem(key)
    for (const [key, value] of written) if (value !== null) storage.setItem(key, value)
  }
  try {
    for (const k of keys) {
      const old = storage.getItem(k)
      storage.setItem(k, plan.storage[k])
      written.set(k, old)
    }
    if (plan.songs.length) await saveSongs(plan.songs)
  } catch (e) {
    try { putBack() } catch (rollbackError) {
      if (!(rollbackError instanceof Error)) throw rollbackError
      throw new BackupError('Restore failed and some settings could not be recovered. Keep your backup and restart Keylight before making further changes.')
    }
    throw e
  }
  return { restored: true, songs: plan.songs.length, keys: keys.length }
}
