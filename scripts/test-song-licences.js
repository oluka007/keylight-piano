// Licence check for the Mutopia songs: node scripts/test-song-licences.js
// Every registered piece needs a licence, a typesetter credit, a source page and its file;
// CC BY-SA pieces live only in renderer/songs/mutopia-sa/ (and nothing else does); each piece
// is in the LICENSES/mutopia-songs.md table; the notices page names the licences.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const root = path.join(__dirname, '..')
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
const KNOWN = /^(Public Domain|CC BY 3\.0|CC BY 4\.0|CC BY 2\.5|CC BY-SA (1\.0|2\.0|2\.5|3\.0|4\.0))$/

;(async () => {
  const { MUTOPIA_SONGS, mutopiaCredit } = await import(pathToFileURL(path.join(root, 'renderer/songs-mutopia.js')).href)
  const table = read('LICENSES/mutopia-songs.md')
  const notices = read('THIRD_PARTY_NOTICES.md')
  assert.ok(MUTOPIA_SONGS.length > 0, 'no Mutopia songs registered')
  const ids = new Set(), files = new Set()
  for (const s of MUTOPIA_SONGS) {
    const who = s.id || s.title
    for (const k of ['id', 'title', 'artist', 'composer', 'level', 'licence', 'typesetter', 'source', 'file', 'cover']) assert.ok(s[k], `${who}: missing ${k}`)
    assert.ok(KNOWN.test(s.licence), `${who}: unknown licence ${s.licence}`)
    assert.match(s.source, /^https:\/\/www\.mutopiaproject\.org\/cgibin\/piece-info\.cgi\?id=\d+$/, `${who}: source URL`)
    assert.equal(s.cover, `covers/${s.id}.png`, `${who}: cover convention`)
    assert.ok(!ids.has(s.id) && !files.has(s.file), `${who}: duplicate id or file`)
    ids.add(s.id); files.add(s.file)
    const file = path.join(root, 'renderer/songs', s.file)
    assert.ok(fs.existsSync(file), `${who}: file missing ${s.file}`)
    assert.equal(fs.readFileSync(file).subarray(0, 4).toString('latin1'), 'MThd', `${who}: not a MIDI file`)
    const sa = /^CC BY-SA/.test(s.licence)
    assert.equal(!!s.shareAlike, sa, `${who}: shareAlike flag must match the licence`)
    assert.equal(s.file.startsWith('mutopia-sa/'), sa, `${who}: ${sa ? 'CC BY-SA belongs in mutopia-sa/' : 'only CC BY-SA belongs in mutopia-sa/'}`)
    assert.ok(/^(mutopia|mutopia-sa)\/[\w.-]+\.mid$/.test(s.file), `${who}: file path`)
    const credit = mutopiaCredit(s)
    assert.ok(credit.includes(s.typesetter) && credit.includes(s.licence.replace('Public Domain', 'Public domain')), `${who}: credit line`)
    assert.ok(table.includes(s.source) && table.includes('`' + s.file + '`') && table.includes(s.licence) && table.includes(s.typesetter), `${who}: not in LICENSES/mutopia-songs.md`)
  }
  // no song file sits in the Mutopia folders without being registered
  for (const dir of ['mutopia', 'mutopia-sa']) {
    for (const f of fs.readdirSync(path.join(root, 'renderer/songs', dir))) assert.ok(files.has(dir + '/' + f), `unregistered file ${dir}/${f}`)
  }
  assert.ok(MUTOPIA_SONGS.some((s) => s.shareAlike) && /CC BY-SA/.test(notices) && notices.includes('LICENSES/mutopia-songs.md') && /CC BY 3\.0/.test(notices), 'THIRD_PARTY_NOTICES.md must cover the Mutopia licences')
  console.log(`song-licences OK: ${MUTOPIA_SONGS.length} Mutopia songs (${MUTOPIA_SONGS.filter((s) => s.shareAlike).length} share-alike)`)
})().catch((e) => { console.error('song-licences FAIL:', e.message); process.exit(1) })
