// Unit test for renderer/editor.js note correction: node scripts/test-editor.js
// The draft behind the dialog: reading pitches, changing, adding and removing notes,
// undo, tempo, and the song handed to saveSong (details kept, stale score dropped,
// built-in songs saved as a copy).
const assert = require('node:assert/strict')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const song = (extra = {}) => ({
  title: 'Prelude', artist: 'Someone', album: 'Album', importedId: 'imp-abc', file: 'imported:imp-abc', added: 1700000000000,
  cover: 'data:image/png;base64,iVBORw0KGgo=', lyrics: { synced: [{ t: 1, text: 'la' }] }, lyricsFromFile: true,
  audio: new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/mpeg' }), source: 'audio',
  tempo: 96.5, duration: 30, bars: [0, 2, 4, 28, 31],
  score: { xml: '<score-partwise/>', order: [0], starts: [0], tempo: [{ beat: 0, bpm: 96.5 }] },
  notes: [
    { pitch: 60, start: 0, dur: 0.5, vel: 90, hand: 'right', finger: 1, part: 0 },
    { pitch: 64, start: 0.5, dur: 0.5, vel: 90, hand: 'right', finger: 3, part: 0 },
    { pitch: 48, start: 0, dur: 1, vel: 80, hand: 'left', finger: 5, part: 1 }
  ],
  ...extra
})

async function main() {
  const { parsePitch, pitchName, NoteDraft, checkNotes } = await import(pathToFileURL(path.join(__dirname, '..', 'renderer', 'editor.js')).href)
  let n = 0
  const check = (label, fn) => { fn(); n++; process.stdout.write('ok ' + label + '\n') }

  check('pitches read as names or numbers', () => {
    assert.equal(parsePitch('C4'), 60)
    assert.equal(parsePitch(' f#3 '), 54)
    assert.equal(parsePitch('Bb2'), 46)
    assert.equal(parsePitch('60'), 60)
    assert.equal(parsePitch('C-1'), 0)
    for (const bad of ['H2', '128', 'C#', '', 'C10', '6.5']) assert.equal(parsePitch(bad), null, bad)
    assert.equal(pitchName(61), 'C#4')
  })

  check('an untouched draft saves the same song', () => {
    const src = song()
    const d = new NoteDraft(src)
    assert.equal(d.dirty, false)
    const { song: out } = d.build()
    assert.equal(out.id, 'imp-abc')
    assert.equal(out.score, src.score)
    assert.equal(out.tempo, 96.5)
    assert.deepEqual(out.bars, src.bars)
    assert.equal(out.notes.length, 3)
  })

  check('changing a pitch drops the score and keeps every other detail', () => {
    const src = song()
    const d = new NoteDraft(src)
    const key = d.notes.find((x) => x.pitch === 64).key
    assert.equal(d.set(key, 'pitch', 'E4'), null)      // the same pitch: no change
    assert.equal(d.canUndo, false)
    assert.equal(d.set(key, 'pitch', 'F4'), null)
    assert.equal(d.dirty, true)
    const { song: out } = d.build()
    assert.equal(out.score, null)
    for (const k of ['title', 'artist', 'album', 'cover', 'lyrics', 'lyricsFromFile', 'added', 'source', 'file']) assert.equal(out[k], src[k], k)
    assert.equal(out.audio, src.audio)
    assert.equal(out.id, 'imp-abc')
    assert.deepEqual(out.notes.map((x) => x.pitch).sort(), [48, 60, 65])
    assert.equal(out.notes.find((x) => x.pitch === 60).part, 0)   // where a note came from stays
    assert.equal(out.duration, 30)                                // a recording keeps its length
    assert.equal(src.notes[1].pitch, 64)                          // the open song is not changed in place
  })

  check('a finger alone keeps the score', () => {
    const d = new NoteDraft(song())
    assert.equal(d.set(d.notes[0].key, 'finger', '2'), null)
    const { song: out } = d.build()
    assert.notEqual(out.score, null)
    assert.equal(d.dirty, true)
  })

  check('Auto finger is filled in on save', () => {
    const d = new NoteDraft(song())
    const key = d.notes.find((x) => x.pitch === 64).key
    assert.equal(d.set(key, 'finger', ''), null)
    assert.equal(d.notes.find((x) => x.key === key).finger, undefined)
    const f = d.build().song.notes.find((x) => x.pitch === 64).finger
    assert.ok(Number.isInteger(f) && f >= 1 && f <= 5, String(f))
  })

  check('a start change reorders and undo puts it back', () => {
    const d = new NoteDraft(song())
    const first = d.notes[0]
    assert.equal(d.set(first.key, 'start', '2'), null)
    assert.equal(d.notes[d.notes.length - 1].key, first.key)
    assert.equal(d.undo(), true)
    assert.equal(d.notes.find((x) => x.key === first.key).start, 0)
    assert.equal(d.dirty, false)
    assert.equal(d.undo(), false)
  })

  check('a bad value is refused and changes nothing', () => {
    const d = new NoteDraft(song())
    const key = d.notes[0].key
    for (const [field, raw] of [['pitch', 'Q9'], ['start', '-1'], ['start', ''], ['dur', '0.01'], ['dur', 'abc'], ['hand', 'both'], ['finger', '6']]) {
      assert.equal(typeof d.set(key, field, raw), 'string', field + ' ' + raw)
    }
    assert.equal(typeof d.setTempo('10'), 'string')
    assert.equal(d.canUndo, false)
    assert.equal(d.dirty, false)
  })

  check('notes are added after a note and removed', () => {
    const d = new NoteDraft(song())
    const anchor = d.notes.find((x) => x.pitch === 64)
    const key = d.add(anchor.key)
    const added = d.notes.find((x) => x.key === key)
    assert.deepEqual([added.pitch, added.start, added.hand], [64, 1, 'right'])
    d.remove(key)
    assert.equal(d.notes.length, 3)
    d.undo()
    assert.equal(d.notes.length, 4)
    for (const x of [...d.notes]) d.remove(x.key)
    assert.match(d.build().error, /at least one note/)
  })

  check('a tempo correction keeps the note times', () => {
    const src = song()
    const d = new NoteDraft(src)
    assert.equal(d.setTempo('120'), null)
    const { song: out } = d.build()
    assert.equal(out.tempo, 120)
    assert.deepEqual(out.notes.map((x) => x.start).sort(), src.notes.map((x) => x.start).sort())
    assert.notEqual(out.score, null)
    d.undo()
    assert.equal(d.tempo, 96.5)
  })

  check('a score song ends with its last note and keeps only its bars', () => {
    const d = new NoteDraft(song({ source: 'score' }))
    for (const x of d.notes.filter((x) => x.pitch !== 48)) d.remove(x.key)
    const { song: out } = d.build()
    assert.equal(out.duration, 1)
    assert.deepEqual(out.bars, [0])
  })

  check('a built-in song is saved as a new copy', () => {
    const src = song({ importedId: undefined, file: 'songs/prelude.mid', audio: 'songs/prelude.mp3', source: undefined })
    const d = new NoteDraft(src)
    assert.equal(d.copy, true)
    d.set(d.notes[0].key, 'pitch', '61')
    const { song: out } = d.build()
    assert.equal(out.id, undefined)
    assert.equal(out.file, undefined)
    assert.equal(out.added, undefined)
    assert.equal(out.audio, null)          // only a stored recording travels with a copy
    assert.equal(out.title, 'Prelude (my copy)')
    assert.equal(out.source, 'score')
  })

  check('checkNotes refuses broken notes', () => {
    const ok = { pitch: 60, start: 0, dur: 0.5, hand: 'right' }
    assert.equal(checkNotes([ok]).notes[0].vel, 100)
    for (const bad of [{ ...ok, pitch: 200 }, { ...ok, pitch: 60.5 }, { ...ok, start: NaN }, { ...ok, dur: 0 }, { ...ok, hand: 'x' }, { ...ok, finger: 9 }, null]) {
      assert.match(checkNotes([ok, bad]).error, /^Note 2 /)
    }
    assert.deepEqual(Object.keys(checkNotes([{ ...ok, extra: '<img>', __proto__x: 1 }]).notes[0]).sort(), ['dur', 'hand', 'pitch', 'start', 'vel'])
    assert.ok(checkNotes([]).error)
  })

  console.log(`test-editor: ${n} checks passed`)
}
main().catch((e) => { console.error(e); process.exit(1) })
