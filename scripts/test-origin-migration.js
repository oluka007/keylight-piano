// Unit test for the fixed page address and the one-time move of saved data:
// node scripts/test-origin-migration.js
// renderer/app-scheme.cjs: which files keylight://app serves (never anything outside the
// renderer folder). renderer/origin-migration.cjs: when the move is tried, that an empty or
// failed read is never "done", that keys already at the new address win, the check after an
// import, and which automatic backups are written and pruned.
// The whole move in a real app: scripts/qa-origin-migration.js.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { Readable } = require('node:stream')
const scheme = require('../renderer/app-scheme.cjs')
const m = require('../renderer/origin-migration.cjs')

let n = 0
const eq = (a, b, what) => { assert.deepEqual(a, b, what); n++ }

async function main() {
  // ---- the address ----
  eq(scheme.APP_ORIGIN, 'keylight://app', 'origin')
  for (const url of ['keylight://app/index.html', 'keylight://app/', 'keylight://app', 'keylight://app/index.html?selftest=1#x']) eq(scheme.isAppUrl(url), true, url)
  // Chromium hands over standard-scheme URLs in lower case; anything else is refused
  for (const url of ['keylight://APP/x','keylight://app.evil/', 'keylight://evil/', 'keylight://user@app/', 'keylight://app:1/', 'http://127.0.0.1:47821/index.html',
    'http://app/', 'file:///app/index.html', 'blob:keylight://app/1234', 'null', '', null, undefined, 42]) eq(scheme.isAppUrl(url), false, String(url))
  eq(scheme.PRIVILEGES.bypassCSP, undefined, 'never bypasses CSP')
  eq(scheme.PRIVILEGES.allowServiceWorkers, undefined, 'no service workers')
  eq(scheme.PRIVILEGES.corsEnabled, undefined, 'other origins cannot read it')

  // ---- the files it serves ----
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'keylight-scheme-'))
  const root = path.join(tmp, 'renderer')
  fs.mkdirSync(path.join(root, 'songs'), { recursive: true })
  fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html>')
  fs.writeFileSync(path.join(root, 'app.js'), 'x')
  fs.writeFileSync(path.join(root, 'songs', 'a b.xml'), '<x/>')
  fs.writeFileSync(path.join(tmp, 'secret.txt'), 'secret')
  let linked = true
  try {
    fs.symlinkSync(path.join(tmp, 'secret.txt'), path.join(root, 'link.txt'))
    fs.symlinkSync(path.join(tmp), path.join(root, 'outside'), 'dir')
  } catch (_e) { linked = false }  // Windows without the right to make symlinks
  const real = fs.realpathSync(root)
  const at = (p) => scheme.resolveAppFile('keylight://app' + p, root, real)
  eq(at('/').status, 200, 'root serves index.html')
  eq(path.basename(at('/').file), 'index.html', 'root file')
  eq(at('/').type, 'text/html', 'html type')
  eq(at('/app.js').type, 'text/javascript', 'module type')
  eq(at('/songs/a%20b.xml').status, 200, 'encoded space')
  eq(at('/songs/a%20b.xml').type, 'application/xml', 'xml type')
  eq(at('/app.js?x=1#y').status, 200, 'query and hash ignored')
  for (const p of ['/../secret.txt', '/%2e%2e/secret.txt', '/..%2fsecret.txt', '/songs/..%2f..%2fsecret.txt', '/..%5csecret.txt', '/songs%5c..%5c..%5csecret.txt',
    '/songs', '/songs/', '/nope.js', '/%00', '/.%2e/secret.txt']) {
    const r = at(p)
    assert.ok(r.status !== 200, p + ' must not be served (got ' + r.status + ')'); n++
  }
  eq(at('/%E0%A4%A').status, 400, 'malformed escape is a bad request')
  if (linked) {
    eq(at('/link.txt').status, 404, 'a symlink out of the folder is refused')
    eq(at('/outside/secret.txt').status, 404, 'a linked folder out of the folder is refused')
  }
  eq(scheme.resolveAppFile('keylight://evil/index.html', root, real).status, 403, 'other host')
  eq(scheme.resolveAppFile('keylight://app:9/index.html', root, real).status, 403, 'a port')
  eq(scheme.resolveAppFile('not a url', root, real).status, 400, 'not a URL')
  const handle = scheme.createAppHandler({ root, Readable })
  const ok = await handle({ method: 'GET', url: 'keylight://app/songs/a%20b.xml' })
  eq([ok.status, ok.headers.get('content-type'), await ok.text()], [200, 'application/xml', '<x/>'], 'handler serves the file')
  const head = await handle({ method: 'HEAD', url: 'keylight://app/app.js' })
  eq([head.status, await head.text()], [200, ''], 'HEAD has no body')
  eq((await handle({ method: 'POST', url: 'keylight://app/app.js' })).status, 405, 'POST refused')
  eq((await handle({ method: 'GET', url: 'keylight://app/../secret.txt' })).status, 404, 'handler refuses traversal')
  fs.rmSync(tmp, { recursive: true, force: true })

  // ---- the marker ----
  const marker = m.markerText({ from: 'http://127.0.0.1:47821', to: 'keylight://app', at: '2026-11-09T00:00:00.000Z', result: { recordsMoved: 1 } })
  eq(m.migrationDone(marker), true, 'a written marker reads as done')
  for (const bad of ['', null, undefined, '{', '{}', '{"version":1,"done":"true"}', '{"version":2,"done":true}', '{"version":1,"done":false}', 'null', '[]']) eq(m.migrationDone(bad), false, 'not done: ' + bad)

  // ---- when to try, and from where ----
  eq(m.migrationPlan({ env: {}, markerText: '' }), { attempt: true, port: 47821, from: 'http://127.0.0.1:47821' }, 'normal start: 47821')
  eq(m.migrationPlan({ env: {}, buildPort: 47900, markerText: '' }).port, 47900, 'a tester build: its own port')
  eq(m.migrationPlan({ env: { LUMI_PORT: '5000' }, buildPort: 47900 }).port, 5000, 'LUMI_PORT first')
  eq(m.migrationPlan({ env: {}, markerText: marker }).attempt, false, 'done once: never again')
  eq(m.migrationPlan({ env: { LUMI_USERDATA: '/tmp/p' } }).attempt, false, 'test profiles leave the real port alone')
  eq(m.migrationPlan({ env: { LUMI_USERDATA: '/tmp/p', LUMI_PORT: '5001' } }).port, 5001, 'a test names its old port')
  eq(m.migrationPlan({ env: { LUMI_MIGRATE: '0' } }).attempt, false, 'LUMI_MIGRATE=0')
  eq(m.migrationPlan({ env: { LUMI_PORT: '70000' } }).attempt, false, 'no nonsense port')
  eq(m.migrationPlan({ env: { LUMI_PORT: 'abc' } }).attempt, false, 'no nonsense port text')

  // ---- never trust an empty source ----
  eq(m.exportVerdict({ ok: true, storageKeys: 3, records: 1 }), { next: 'import', keys: 3, records: 1 }, 'data: import')
  eq(m.exportVerdict({ ok: true, storageKeys: 0, records: 2 }).next, 'import', 'songs only: import')
  eq(m.exportVerdict({ ok: true, storageKeys: 0, records: 0 }).next, 'retry', 'empty: not done')
  eq(m.exportVerdict({ ok: true }).next, 'retry', 'no counts: not done')
  eq(m.exportVerdict({ ok: false, error: 'x', storageKeys: 9, records: 9 }).next, 'retry', 'failed read: not done even with counts')
  eq(m.exportVerdict(null).next, 'retry', 'no report')
  eq(m.exportVerdict({ ok: 'yes', storageKeys: 1 }).next, 'retry', 'ok must be true')

  // ---- the merge: newer data at the new address wins ----
  eq(m.mergeStorage(['lumi.settings', 'lumi.support'], { 'lumi.settings': 'old', 'lumi.course': 'c', 'lumi.support': 's', 'other': 'o' }),
    { set: { 'lumi.course': 'c', other: 'o' }, skipped: ['lumi.settings', 'lumi.support'] }, 'existing keys kept and named')
  eq(m.mergeStorage([], { a: '1', b: 2 }), { set: { a: '1' }, skipped: [] }, 'only strings')
  eq(m.mergeStorage(null, null), { set: {}, skipped: [] }, 'nothing')

  // ---- the check after the import ----
  eq(m.keyId('a'), 's:a', 'string key')
  eq(m.keyId(1), 'n:1', 'number key')
  eq(m.keyId(new Date(5)), 'd:5', 'date key')
  eq(m.keyId(['a', 1]), 'a:[s:a,n:1]', 'array key')
  eq(m.keyId('1') === m.keyId(1), false, 'string and number differ')
  eq(m.keyId(new Uint8Array(1)), null, 'binary keys are not carried')
  const exported = { storageKeys: ['lumi.a', 'lumi.b'], records: [{ db: 'keylight', store: 'songs', key: 'imp-1' }, { db: 'x', store: 'y', key: 3 }] }
  eq(m.verifyImport(exported, { storageKeys: ['lumi.a', 'lumi.b', 'lumi.c'], stores: [{ db: 'keylight', store: 'songs', keys: ['imp-1', 'imp-2'] }, { db: 'x', store: 'y', keys: [3] }] }), { ok: true, missing: [] }, 'all there')
  eq(m.verifyImport(exported, { storageKeys: ['lumi.a', 'lumi.b'], stores: [{ db: 'keylight', store: 'songs', keys: ['imp-1'] }] }).missing,
    ['record x/y n:3'], 'a store the new address could not take keeps the move open')
  eq(m.verifyImport(exported, { storageKeys: ['lumi.a'], stores: [{ db: 'keylight', store: 'songs', keys: [] }] }).missing,
    ['localStorage lumi.b', 'record keylight/songs s:imp-1', 'record x/y n:3'], 'missing named')
  eq(m.verifyImport(exported, { storageKeys: [], stores: [] }).ok, false, 'an empty new address fails the check')
  eq(m.verifyImport(exported, null).ok, false, 'no listing fails the check')

  // ---- automatic backups ----
  const now = new Date(2026, 10, 9, 8, 5, 7)
  eq(m.backupName(now), 'keylight-auto-20261109-080507.keylightbackup', 'name')
  assert.ok(m.backupName(now).endsWith('.keylightbackup') && m.AUTO_BACKUP.test(m.backupName(now))); n++
  eq(m.backupDue([], now), true, 'none yet: due')
  eq(m.backupDue(['keylight-auto-20261108-235959.keylightbackup'], now), true, 'yesterday: due')
  eq(m.backupDue(['keylight-auto-20261109-000001.keylightbackup'], now), false, 'today already: not due')
  eq(m.backupDue(['keylight-auto-20261109-000001.keylightbackup.part', 'keylight-backup-20261109-0800.keylightbackup'], now), true, 'parts and manual backups do not count')
  const names = ['keylight-auto-20261101-090000.keylightbackup', 'notes.txt', 'keylight-auto-20261105-090000.keylightbackup',
    'keylight-backup-20261001-0900.keylightbackup', 'keylight-auto-20261103-090000.keylightbackup', 'keylight-auto-20261109-090000.keylightbackup']
  eq(m.backupsToPrune(names), ['keylight-auto-20261101-090000.keylightbackup'], 'the oldest automatic one goes; others are never touched')
  eq(m.backupsToPrune(names.slice(0, 3)), [], 'two kept')
  eq(m.backupsToPrune(names, 1), ['keylight-auto-20261101-090000.keylightbackup', 'keylight-auto-20261103-090000.keylightbackup', 'keylight-auto-20261105-090000.keylightbackup'], 'keep 1')
  eq(m.backupWorthKeeping({ songs: 0, keys: 0 }), false, 'an empty backup is never written')
  eq(m.backupWorthKeeping({ songs: 0, keys: 1 }), true, 'settings only')
  eq(m.backupWorthKeeping({ songs: 2, keys: 0 }), true, 'songs only')
  eq(m.backupWorthKeeping({}), false, 'nothing known')

  console.log(`origin migration: ${n} cases pass`)
}

main().catch((e) => { console.error(e); process.exit(1) })
