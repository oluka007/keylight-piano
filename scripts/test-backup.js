// Unit test for renderer/backup.js: node scripts/test-backup.js
// A backup carries the imported songs (recordings byte for byte) and the lumi.* entries;
// a restore checks the whole file first, writes nothing when declined or refused, adds
// to what is there, and undoes its settings writes when saving the songs fails.
const assert = require('node:assert/strict')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

// localStorage as the app sees it; `full` names a key whose write fails like a full quota
class MemoryStorage {
  constructor(entries = {}) { this.map = new Map(Object.entries(entries)); this.full = null }
  get length() { return this.map.size }
  key(i) { return [...this.map.keys()][i] ?? null }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null }
  setItem(k, v) { if (k === this.full) throw new Error('QuotaExceededError'); this.map.set(k, String(v)) }
  removeItem(k) { this.map.delete(k) }
  snapshot() { return Object.fromEntries(this.map) }
}

const bytes = Uint8Array.from({ length: 256 * 3 }, (_, i) => i % 256)
const record = (id, extra = {}) => ({
  id, file: 'imported:' + id, title: 'Song ' + id, artist: 'A', album: '', duration: 12, tempo: 100,
  notes: [{ pitch: 60, start: 0, dur: 0.5, vel: 100, hand: 'right', finger: 1 }, { pitch: 43, start: 0.5, dur: 1, vel: 70, hand: 'left', finger: 5, track: 1, trackName: 'Bass' }],
  timeSignature: { beats: 3, beatType: 4 }, parts: [{ index: 0, name: 'Piano', channel: 0, program: 0, hand: null }], bars: [0, 1.8],
  score: { xml: '<score-partwise/>', order: [0, 1], starts: [0, 3], tempo: [{ beat: 0, bpm: 100 }] },
  cover: 'data:image/png;base64,iVBORw0KGgo=', lyrics: { synced: [{ t: 0.5, text: 'héllo 你好' }] }, lyricsFromFile: false,
  audio: null, source: 'score', added: 1700000000000, ...extra
})

async function main() {
  const backup = await import(pathToFileURL(path.join(__dirname, '..', 'renderer', 'backup.js')).href)
  const { createBackup, readBackup, restoreBackup, BackupError, MAGIC, VERSION } = backup
  let n = 0
  const check = async (label, fn) => { await fn(); n++; process.stdout.write('ok ' + label + '\n') }

  const library = () => [
    record('imp-a', { audio: new File([bytes], 'take one.m4a', { type: 'audio/mp4' }), source: 'audio', score: null }),
    record('imp-b')
  ]
  const userStorage = () => new MemoryStorage({
    'lumi.settings': JSON.stringify({ lightStyle: 'glow', rate: 0.8 }), 'lumi.best.songs/a.mid': '3', 'lumi.streak.count': '4', 'other.app': 'keep'
  })
  const made = await createBackup({ songs: library(), storage: userStorage(), now: new Date(2026, 10, 6, 9, 5) })
  const asFile = (blob) => new File([blob], 'backup.keylightbackup')
  // a backup file written by hand: the format, header and all
  const forge = (manifest, payload = new Uint8Array(0), length) => {
    const body = new TextEncoder().encode(JSON.stringify(manifest))
    const head = new Uint8Array(MAGIC.length + 4)
    head.set(new TextEncoder().encode(MAGIC))
    new DataView(head.buffer).setUint32(MAGIC.length, length ?? body.length, true)
    return new File([head, body, payload], 'x.keylightbackup')
  }
  const goodManifest = (songs) => ({ format: 'keylight-backup', version: VERSION, created: new Date().toISOString(), songs, storage: {} })
  const restoreInto = async (file, storage, saved, opts = {}) => restoreBackup(file, {
    storage, confirm: async () => opts.answer ?? true,
    saveSongs: async (songs) => { if (opts.saveFails) throw new Error('disk full'); saved.push(...songs) }
  })

  await check('a backup names itself and counts what it holds', async () => {
    assert.equal(made.name, 'keylight-backup-20261106-0905.keylightbackup')
    assert.equal(made.songs, 2)
    assert.equal(made.keys, 3)
    assert.deepEqual(made.skipped, [])
  })

  await check('songs, recordings and lumi entries come back exactly', async () => {
    const plan = await readBackup(asFile(made.blob))
    assert.equal(plan.songs.length, 2)
    const [a, b] = plan.songs
    assert.equal(a.audio.name, 'take one.m4a')
    assert.equal(a.audio.type, 'audio/mp4')
    assert.deepEqual(new Uint8Array(await a.audio.arrayBuffer()), bytes)
    assert.equal(b.audio, null)
    const want = record('imp-b')
    for (const k of ['id', 'title', 'artist', 'notes', 'duration', 'tempo', 'timeSignature', 'parts', 'bars', 'score', 'cover', 'lyrics', 'lyricsFromFile', 'source', 'added']) assert.deepEqual(b[k], want[k], k)
    assert.deepEqual(plan.storage, { 'lumi.settings': '{"lightStyle":"glow","rate":0.8}', 'lumi.best.songs/a.mid': '3', 'lumi.streak.count': '4' })
  })

  await check('a restore adds to what is there', async () => {
    const storage = new MemoryStorage({ 'lumi.streak.count': '9', 'lumi.fav.songs/b.mid': 'true', 'other.app': 'mine' })
    const saved = []
    const r = await restoreInto(asFile(made.blob), storage, saved)
    assert.deepEqual(r, { restored: true, songs: 2, keys: 3 })
    assert.deepEqual(saved.map((s) => s.id), ['imp-a', 'imp-b'])
    assert.equal(storage.getItem('lumi.streak.count'), '4')
    assert.equal(storage.getItem('lumi.fav.songs/b.mid'), 'true')
    assert.equal(storage.getItem('other.app'), 'mine')
  })

  await check('a declined restore writes nothing', async () => {
    const storage = new MemoryStorage({ 'lumi.streak.count': '9' })
    const before = storage.snapshot()
    const saved = []
    const r = await restoreInto(asFile(made.blob), storage, saved, { answer: false })
    assert.equal(r.restored, false)
    assert.deepEqual(storage.snapshot(), before)
    assert.deepEqual(saved, [])
  })

  await check('a failed song save undoes the settings writes', async () => {
    const storage = new MemoryStorage({ 'lumi.streak.count': '9', 'lumi.days': '{}' })
    const before = storage.snapshot()
    await assert.rejects(restoreInto(asFile(made.blob), storage, [], { saveFails: true }), /disk full/)
    assert.deepEqual(storage.snapshot(), before)
  })

  await check('a full storage stops the restore before any song is saved', async () => {
    const storage = new MemoryStorage({ 'lumi.streak.count': '9' })
    storage.full = 'lumi.streak.count'      // written after lumi.settings and lumi.best...: those are undone
    const before = storage.snapshot()
    const saved = []
    await assert.rejects(restoreInto(asFile(made.blob), storage, saved), /Quota/)
    assert.deepEqual(storage.snapshot(), before)
    assert.deepEqual(saved, [])
  })

  await check('a failed song save restores swapped large settings within the original quota', async () => {
    const storage = new MemoryStorage({ 'lumi.a': JSON.stringify('a'.repeat(100)), 'lumi.b': JSON.stringify('b') })
    storage.setItem = function (key, value) {
      const next = new Map(this.map).set(key, String(value))
      if ([...next.values()].reduce((sum, item) => sum + item.length, 0) > 150) throw new Error('QuotaExceededError')
      this.map = next
    }
    const before = storage.snapshot()
    const file = forge({ ...goodManifest([record('imp-z')]), storage: { 'lumi.a': JSON.stringify('a'), 'lumi.b': JSON.stringify('b'.repeat(100)) } })
    await assert.rejects(restoreInto(file, storage, [], { saveFails: true }), /disk full/)
    assert.deepEqual(storage.snapshot(), before)
  })

  const audioSong = (audio) => ({ ...record('imp-z'), audio })
  await check('malformed known settings refuse the whole restore before confirmation or writes', async () => {
    const malformed = [
      ['lumi.days', null], ['lumi.recent', null], ['lumi.settings', { kbKeysFor: null }],
      ['lumi.settings', []], ['lumi.settings', { kbBaseFor: [] }], ['lumi.settings', { kbPair: { port: null } }],
      ['lumi.settings', { kbKeysFor: { port: '49' } }], ['lumi.settings', { kbBaseFor: { port: null } }],
      ['lumi.settings', { kbPair: { port: { side: 2, low: 48 } } }],
      ['lumi.settings', { volume: [] }], ['lumi.settings', { metronome: 'false' }],
      ['lumi.settings', { kbPort: {} }], ['lumi.settings', { expression: [] }],
      ['lumi.settings', { camCalib: { a: null, b: {} } }], ['lumi.settings', { freeScale: [] }],
      ['lumi.days', []], ['lumi.days', { '2026-11-06': '60' }],
      ['lumi.recent', {}], ['lumi.recent', [null]], ['lumi.recent', [{ file: 7, at: 1 }]],
      ['lumi.guided.progress.song', null], ['lumi.guided.progress.song', { '1-4': [] }],
      ['lumi.guided.progress.song', { '1-4': { 'right.PLAY.60': { passed: true, best: '1', tries: 1 } } }],
      ['lumi.guided.weak.song', null], ['lumi.guided.weak.song', { 0: {} }],
      ['lumi.guided.section.song', {}], ['lumi.guided.mode', []], ['lumi.guided.hand', null], ['lumi.guided.rate', {}],
      ['lumi.streak.count', []], ['lumi.streak.last', {}], ['lumi.best.song', {}],
      ['lumi.game.quiz', null], ['lumi.lesson.first.PLAY', -1], ['lumi.exercise.major.0.both', 6],
      ['lumi.exercise.major.0.both.bpm', []], ['lumi.fav.song', {}],
      ['lumi.lessonwatched.first', 'true'], ['lumi.lessonpractised.first', 1], ['lumi.onboarded', null]
    ]
    const failures = []
    for (const [key, value] of malformed) {
      const storage = userStorage(), before = storage.snapshot(), saved = [record('existing')]
      let asked = false, rejected = false
      try {
        await restoreBackup(forge({ ...goodManifest([record('imp-z')]), storage: { 'lumi.streak.count': '2', [key]: JSON.stringify(value) } }), {
          storage, confirm: () => { asked = true; return true }, saveSongs: async (songs) => saved.push(...songs)
        })
      } catch (error) {
        if (!(error instanceof BackupError)) throw error
        rejected = error.message === `The setting ${key} is not valid`
      }
      if (!rejected || asked || JSON.stringify(storage.snapshot()) !== JSON.stringify(before) || saved.length !== 1) failures.push(`${key}=${JSON.stringify(value)}`)
    }
    assert.deepEqual(failures, [], 'malformed settings accepted or changed existing storage/songs')
  })

  await check('current storage shapes and defaults round-trip without dropping entries', async () => {
    const values = {
      settings: { brightness: 255, volume: 80, backingVolume: 70, countIn: 4, metronome: false, labels: 'off', view: 'CASCADE', hands: 'both', rate: 1, band: false, waitMode: 'pauseAndSnap', instrument: 'sampled-piano', keyboardMode: 'Pro', bendRange: 12, accompany: true, kbZero: 48, kbPort: '', kbLast: '', kbKeysFor: { '': 49, 'LUMI Keys BLOCK': 24, paired: 48 }, kbBaseFor: { paired: 36 }, kbPair: { left: { side: 0, low: 48 }, right: { side: 1, low: 60 } }, kbLightsLeft: '', kbLightsSwap: false, userColor: '#a78bfa', expression: null, audioOutput: '', recordTakes: false, sheet: false, camCalib: { a: { x: 0.1, y: 0.8 }, b: { x: 0.9, y: 0.8 } }, freeScale: { root: 0, idx: 0 } },
      days: { '2026-11-06': 60.5 }, recent: [{ file: 'imported:imp-a', at: 1700000000000 }],
      'guided.progress.song': { '1-4': { 'right.PLAY.60': { passed: true, best: 0.9, tries: 2 } } },
      'guided.weak.song': { 0: 2 }, 'guided.section.song': '1-4', 'guided.mode': 'wait', 'guided.hand': 'both', 'guided.rate': 0.8,
      'streak.count': 4, 'streak.last': null, 'best.song': 5, 'game.quiz': 3, 'lesson.first.PRACTISE': 2,
      'exercise.major.0.both': 4, 'exercise.major.0.both.bpm': 80, 'fav.song': true,
      'lessonwatched.first': true, 'lessonpractised.first': false, onboarded: true, audioSafeBuffer: 1, supportOfferSeen: 1,
      futureSetting: { preserved: true }
    }
    for (const overrides of [{}, { settings: {}, days: {}, recent: [], 'guided.progress.song': {}, 'guided.weak.song': {}, 'guided.section.song': null, 'streak.last': '2026-11-06' }]) {
      const entries = Object.fromEntries(Object.entries({ ...values, ...overrides }).map(([key, value]) => ['lumi.' + key, JSON.stringify(value)]))
      const result = await createBackup({ songs: library(), storage: new MemoryStorage(entries) })
      assert.deepEqual(result.skipped, [])
      const storage = new MemoryStorage(), saved = []
      await restoreInto(asFile(result.blob), storage, saved)
      assert.deepEqual(storage.snapshot(), entries)
      assert.deepEqual(saved.map((song) => song.id), ['imp-a', 'imp-b'])
    }
  })

  const refusals = [
    ['another file', () => new File([new TextEncoder().encode('PK\u0003\u0004 not a backup at all')], 'x.zip'), /not a Keylight backup/],
    ['a cut-off file', async () => new File([(await made.blob.arrayBuffer()).slice(0, made.blob.size - 10)], 'x'), /damaged|incomplete/],
    ['extra bytes at the end', () => new File([made.blob, new Uint8Array([0])], 'x'), /bytes no song uses/],
    ['a header claiming a huge manifest', () => forge(goodManifest([]), undefined, 0xffffffff), /damaged|incomplete/],
    ['a newer version', () => forge({ ...goodManifest([]), version: VERSION + 1 }), /newer Keylight/],
    ['a note out of range', () => forge(goodManifest([{ ...record('imp-z'), notes: [{ pitch: 200, start: 0, dur: 1, hand: 'right' }] }])), /Note 1 /],
    ['an SVG cover', () => forge(goodManifest([{ ...record('imp-z'), cover: 'data:image/svg+xml;base64,PHN2Zz4=' }])), /cover/],
    ['a script cover', () => forge(goodManifest([{ ...record('imp-z'), cover: 'javascript:alert(1)' }])), /cover/],
    ['an unsafe id', () => forge(goodManifest([record('../x')])), /valid id/],
    ['the same song twice', () => forge(goodManifest([record('imp-z'), record('imp-z')])), /twice/],
    ['a recording that is not audio', () => forge(goodManifest([audioSong({ offset: 0, size: 1, type: 'text/html', name: 'a' })]), new Uint8Array(1)), /not audio/],
    ['a recording past the end', () => forge(goodManifest([audioSong({ offset: 0, size: 99, type: 'audio/mpeg', name: 'a' })]), new Uint8Array(1)), /damaged|incomplete/],
    ['recordings that overlap', () => forge(goodManifest([audioSong({ offset: 0, size: 1, type: '', name: 'a' }), { ...audioSong({ offset: 0, size: 1, type: '', name: 'b' }), id: 'imp-y' }]), new Uint8Array(2)), /recording is not valid/],
    ['a setting of another app', () => forge({ ...goodManifest([]), storage: { 'other.app': '1' } }), /does not use/],
    ['a setting that is not JSON', () => forge({ ...goodManifest([]), storage: { 'lumi.settings': '{oops' } }), /not valid/],
    ['a song list that is not a list', () => forge({ ...goodManifest([]), songs: { length: 1 } }), /song list/]
  ]
  for (const [label, make, message] of refusals) {
    await check('refuses ' + label + ', writing nothing', async () => {
      const storage = new MemoryStorage({ 'lumi.streak.count': '9' })
      const before = storage.snapshot()
      const saved = []
      let asked = false
      await assert.rejects(restoreBackup(await make(), { storage, confirm: () => { asked = true; return true }, saveSongs: async (s) => saved.push(...s) }),
        (e) => e instanceof BackupError && message.test(e.message))
      assert.equal(asked, false)
      assert.deepEqual(storage.snapshot(), before)
      assert.deepEqual(saved, [])
    })
  }

  const courseJson = (lessons, exams = '{}') => '{"version":1,"lessons":' + lessons + ',"exams":' + exams + ',"unlocked":[2],"seconds":120}'
  const rec = '{"accuracy":0.9,"stars":3,"tries":2,"at":1700000000000}'
  await check('a populated lumi.course progress round-trips through a backup', async () => {
    const value = courseJson('{"l1-find-c":{"a":' + rec + ',"b":' + rec + '}}', '{"l1-exam":{"percent":88,"passed":true,"tries":1,"at":1700000000000,"placement":false}}')
    const entries = { 'lumi.course': value }
    const result = await createBackup({ songs: library(), storage: new MemoryStorage(entries) })
    assert.deepEqual(result.skipped, [])
    const storage = new MemoryStorage(), saved = []
    await restoreInto(asFile(result.blob), storage, saved)
    assert.deepEqual(storage.snapshot(), entries)
  })
  for (const bad of ['__proto__', 'constructor', 'prototype']) {
    for (const [where, value] of [
      ['a lesson id', courseJson('{"' + bad + '":{"x":' + rec + '}}')],
      ['an item id', courseJson('{"l1":{"' + bad + '":' + rec + '}}')],
      ['an exam id', courseJson('{}', '{"' + bad + '":{"percent":50,"passed":false,"tries":1,"at":1}}')]
    ]) {
      await check('refuses ' + bad + ' as ' + where + ' in lumi.course, writing nothing', async () => {
        const storage = new MemoryStorage({ 'lumi.streak.count': '9' })
        const before = storage.snapshot()
        await assert.rejects(restoreInto(forge({ ...goodManifest([]), storage: { 'lumi.course': value } }), storage, []), (e) => e instanceof BackupError && /not valid/.test(e.message))
        assert.deepEqual(storage.snapshot(), before)
        assert.equal(Object.prototype.l1, undefined)
      })
    }
  }

  await check('a song that would not restore is named, not dropped quietly', async () => {
    const storage = new MemoryStorage({ 'lumi.days': 'not json' })
    const r = await createBackup({ songs: [record('imp-a'), { ...record('imp-b'), title: 'Broken', notes: [] }], storage })
    assert.equal(r.songs, 1)
    assert.deepEqual(r.skipped.map((s) => s.title), ['Broken', 'lumi.days'])
  })

  console.log(`test-backup: ${n} checks passed`)
}
main().catch((e) => { console.error(e); process.exit(1) })
