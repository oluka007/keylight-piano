// End-to-end check of the one-time move of saved data from the old page address to
// keylight://app, in the real app (not part of npm test: it starts Electron several times,
// about a minute in all):   node scripts/qa-origin-migration.js
// Everything runs in a throwaway profile, with a random free port standing in for the old
// address (LUMI_PORT), so a Keylight in use on this computer is never touched.
//   1. port busy: the move is not tried, nothing marked done
//   2. nothing at the old address: not marked done (an empty read is never trusted)
//   3. old address seeded (localStorage keys, a song with a 9 MB recording): the app moves it,
//      the old data is unchanged, an automatic backup is written and reads back
//   4. started again: nothing moves twice, nothing is duplicated
//   5. marker removed, one key changed at the new address: the newer value is kept
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const net = require('node:net')
const path = require('node:path')
const { spawn } = require('node:child_process')
const { pathToFileURL } = require('node:url')

const ROOT = path.join(__dirname, '..')
const ELECTRON = require('electron')
const PROBE = path.join(__dirname, 'fixtures', 'origin-storage-probe.cjs')
const tick = (ms) => new Promise((r) => setTimeout(r, ms))
const env = () => { const e = { ...process.env }; delete e.ELECTRON_RUN_AS_NODE; delete e.LUMI_SOUND; delete e.LUMI_QUERY; delete e.LUMI_MIGRATE; return e }

const freePort = () => new Promise((resolve) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)) }) })

function probe(profile, where, port, job, arg = '') {
  return new Promise((resolve, reject) => {
    const child = spawn(ELECTRON, [PROBE, profile, where, String(port), job, arg], { env: env(), stdio: ['ignore', 'pipe', 'ignore'] })
    let out = ''
    child.stdout.on('data', (d) => { out += d })
    const killer = setTimeout(() => child.kill('SIGKILL'), 60000)
    child.on('exit', () => {
      clearTimeout(killer)
      const line = out.split('\n').find((l) => l.startsWith('PROBE '))
      if (!line) return reject(new Error(`probe ${where} ${job} printed nothing`))
      const result = JSON.parse(line.slice(6))
      if (!result.ok) return reject(new Error(`probe ${where} ${job}: ${result.error}`))
      resolve(result)
    })
  })
}

// Starts the app on the profile and waits for every log line in `until` (regexps), then quits it.
async function runApp(profile, port, until, extra = {}) {
  const log = path.join(profile, 'app.log')
  const before = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').length : 0
  const child = spawn(ELECTRON, ['.'], { cwd: ROOT, stdio: 'ignore',
    env: { ...env(), LUMI_USERDATA: profile, LUMI_PORT: String(port), LUMI_NO_KEYBOARD: '1', LUMI_WATCHDOG: '0', LUMI_BACKUP: '0', ...extra } })
  const exited = new Promise((r) => child.once('exit', r))
  let text = ''
  for (let i = 0; i < 240; i++) {
    await tick(250)
    text = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').slice(before) : ''
    if (until.every((re) => re.test(text))) break
  }
  child.kill('SIGTERM')
  const timer = setTimeout(() => child.kill('SIGKILL'), 15000)
  await exited
  clearTimeout(timer)
  await tick(500)
  return fs.existsSync(log) ? fs.readFileSync(log, 'utf8').slice(before) : ''
}

const markerOf = (profile) => path.join(profile, 'origin-migration.json')
const markerDone = (profile) => { try { return JSON.parse(fs.readFileSync(markerOf(profile), 'utf8')).done === true } catch (_e) { return false } }
const pageLoaded = /\[renderer\] /

async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'keylight-qa-origin-'))
  const port = await freePort()
  let step = 0
  const ok = (what) => console.log(`  ok ${++step} ${what}`)
  console.log(`origin migration QA: profile ${profile}, old address http://127.0.0.1:${port}`)
  try {
    // 1. the old port is taken: skip, retry later
    const blocker = net.createServer()
    await new Promise((r) => blocker.listen(port, '127.0.0.1', r))
    let log = await runApp(profile, port, [/\[migrate\] the old address .* is not free/, pageLoaded])
    blocker.close()
    assert.match(log, /\[migrate\] the old address .* is not free/)
    assert.equal(markerDone(profile), false)
    ok('a busy old port: the move is skipped and not marked done')

    // 2. nothing at the old address: never marked done
    log = await runApp(profile, port, [/\[migrate\] .*holds nothing/, pageLoaded])
    assert.match(log, /\[migrate\] .*holds nothing/)
    assert.equal(markerDone(profile), false)
    const fresh = await probe(profile, 'new', port, 'read')
    ok('an empty old address is not marked done; keys a fresh page wrote by itself: ' + (Object.keys(fresh.storage).join(', ') || 'none'))

    // 3. seed the old address, start the app: everything moves
    await probe(profile, 'old', port, 'seed')
    const oldBefore = await probe(profile, 'old', port, 'read')
    assert.equal(oldBefore.records.length, 1)
    assert.equal(oldBefore.records[0].audio.size, 9 * 1024 * 1024)
    log = await runApp(profile, port, [/\[migrate\] done/, pageLoaded, /\[backup\] (saved|failed|nothing|incomplete)/], { LUMI_BACKUP: '1', LUMI_BACKUP_DELAY: '1' })
    assert.match(log, /\[migrate\] done/, 'the move finished:\n' + log.split('\n').filter((l) => /migrate|backup/.test(l)).join('\n'))
    assert.equal(markerDone(profile), true)
    // the page loads only after the move
    assert.ok(log.indexOf('[migrate] done') < log.search(pageLoaded), 'the app page loaded after the move')
    const moved = await probe(profile, 'new', port, 'read')
    assert.equal(moved.storage['lumi.qa.note'], oldBefore.storage['lumi.qa.note'])
    assert.equal(moved.storage['qa-other'], 'kept as is')
    for (const k of Object.keys(oldBefore.storage)) assert.ok(k in moved.storage, k + ' moved')
    assert.equal(moved.records.length, 1)
    assert.deepEqual(moved.records[0], oldBefore.records[0], 'the song and its recording arrive byte for byte, still a File with its name and type')
    ok('localStorage keys and the song with its 9 MB recording are at keylight://app')
    const oldAfter = await probe(profile, 'old', port, 'read')
    assert.deepEqual(oldAfter, oldBefore)
    ok('the old address is unchanged')

    // the automatic backup reads back in the app's own restore format
    const dir = path.join(profile, 'backups')
    const backups = fs.readdirSync(dir).filter((n) => /^keylight-auto-\d{8}-\d{6}\.keylightbackup$/.test(n))
    assert.equal(backups.length, 1, 'one automatic backup: ' + fs.readdirSync(dir).join(', '))
    const { readBackup } = await import(pathToFileURL(path.join(ROOT, 'renderer', 'backup-format.js')).href)
    const plan = await readBackup(await fs.openAsBlob(path.join(dir, backups[0])))
    assert.equal(plan.songs.length, 1)
    assert.equal(plan.songs[0].audio.size, 9 * 1024 * 1024)
    assert.equal(plan.storage['lumi.qa.note'], oldBefore.storage['lumi.qa.note'])
    ok('an automatic backup was written and reads back with the song and the settings')

    // 4. again: nothing moves twice
    log = await runApp(profile, port, [pageLoaded])
    assert.doesNotMatch(log, /\[migrate\]/)
    const again = await probe(profile, 'new', port, 'read')
    assert.equal(again.records.length, 1)
    assert.deepEqual(Object.keys(again.storage).sort(), Object.keys(moved.storage).sort())
    ok('a second start moves nothing and duplicates nothing')

    // 5. a newer value at the new address wins over the old one
    fs.rmSync(markerOf(profile))
    await probe(profile, 'new', port, 'set', 'lumi.qa.note={"from":"new"}')
    log = await runApp(profile, port, [/\[migrate\] done/, pageLoaded])
    assert.match(log, /kept the newer value already at the new address for: .*lumi\.qa\.note/)
    assert.match(log, /1 records were already at the new address and were kept/)
    const merged = await probe(profile, 'new', port, 'read')
    assert.equal(merged.storage['lumi.qa.note'], '{"from":"new"}')
    assert.equal(merged.records.length, 1)
    assert.deepEqual(await probe(profile, 'old', port, 'read'), oldBefore)
    ok('a second move keeps the newer value and the existing song, and still leaves the old address alone')
    console.log(`origin migration QA: ${step} checks pass`)
  } finally {
    if (!process.env.QA_KEEP) fs.rmSync(profile, { recursive: true, force: true })
  }
}

main().catch((e) => { console.error('origin migration QA FAILED:', e && e.stack || e); process.exit(1) })
