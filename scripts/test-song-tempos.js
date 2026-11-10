// Default tempo check for the Mutopia songs: node scripts/test-song-tempos.js
// The resulting duration (file duration / tempoScale) must be 25 s - 12 min unless flagged long,
// scales within 0.25-4, applyTempoScale must scale a song consistently, and every song is
// in the docs/SONG-TEMPOS.md table.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const root = path.join(__dirname, '..')

;(async () => {
  const { MUTOPIA_SONGS, applyTempoScale } = await import(pathToFileURL(path.join(root, 'renderer/songs-mutopia.js')).href)
  const { parseMidi } = await import(pathToFileURL(path.join(root, 'renderer/smf.js')).href)
  const doc = fs.readFileSync(path.join(root, 'docs/SONG-TEMPOS.md'), 'utf8')
  assert.ok(MUTOPIA_SONGS.length > 0)
  for (const s of MUTOPIA_SONGS) {
    const b = fs.readFileSync(path.join(root, 'renderer/songs', s.file))
    const p = parseMidi(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
    const scale = s.tempoScale == null ? 1 : s.tempoScale
    assert.ok(scale >= 0.25 && scale <= 4, `${s.id}: scale ${scale} out of range`)
    const dur = p.duration / scale
    assert.ok(dur >= 25, `${s.id}: ${dur.toFixed(0)} s is under 25 s`)
    assert.ok(s.long || dur <= 720, `${s.id}: ${dur.toFixed(0)} s is over 12 min and not flagged long`)
    assert.ok(doc.includes('(' + s.id + ')'), `${s.id}: missing from docs/SONG-TEMPOS.md`)
    const song = { notes: p.notes.map((n) => ({ ...n })), duration: p.duration, tempo: p.tempo }
    applyTempoScale(song, scale)
    assert.ok(Math.abs(song.duration - dur) < 1e-6, `${s.id}: applyTempoScale duration`)
    assert.ok(Math.abs(song.notes[song.notes.length - 1].start - p.notes[p.notes.length - 1].start / scale) < 1e-6, `${s.id}: note times`)
  }
  console.log(`song tempos: ${MUTOPIA_SONGS.length} songs ok`)
})().catch((e) => { console.error(e); process.exit(1) })
