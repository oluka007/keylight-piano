// Main-process side of the hidden maintenance page (renderer/maintenance.js):
//  - migrate(): the one-time move of saved data from the old page address
//    (http://127.0.0.1:<port>) to keylight://app, recorded in <profile>/origin-migration.json;
//  - backup(): at most one automatic backup a day in <profile>/backups, the last three kept.
// The rules (when to try, never trust an empty read, which keys win, which backups go) are in
// renderer/origin-migration.cjs. The old address's data is only ever read, never changed.
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const rules = require('./origin-migration.cjs')

const CHUNK = 4 * 1024 * 1024
const PAGE_FILES = { '/maintenance.html': 'text/html', '/maintenance.js': 'text/javascript' }

// The old address, served for the export only: exactly this port (no fallback, a different
// port is a different address and would read as empty), and only the maintenance page.
function listenExactly(root, port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const rel = String(req.url || '').split('?')[0]
      if (req.method !== 'GET' || !Object.hasOwn(PAGE_FILES, rel)) { res.writeHead(404); res.end('not found'); return }
      res.writeHead(200, { 'Content-Type': PAGE_FILES[rel] })
      fs.createReadStream(path.join(root, rel.slice(1))).pipe(res)
    })
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => resolve(server))
  })
}

const closeServer = (server) => new Promise((resolve) => {
  server.close(() => resolve())
  server.closeAllConnections()
})

function writeAtomically(file, text) {
  const tmp = file + '.tmp'
  fs.writeFileSync(tmp, text)
  fs.renameSync(tmp, file)
}

function createMaintenance({ BrowserWindow, ipcMain, session, root, profileDir, appOrigin, log }) {
  let active = null   // the one helper page at work: { id, prefix, handlers, finish }

  ipcMain.handle('maintenance', async (event, name, payload) => {
    const job = active
    const url = (event.senderFrame && event.senderFrame.url) || ''
    if (!job || event.sender.id !== job.id || !url.startsWith(job.prefix)) throw new Error('refused')
    if (name === 'done') { job.finish(payload && typeof payload === 'object' ? payload : { ok: false, error: 'no report' }); return true }
    if (!Object.hasOwn(job.handlers, name)) throw new Error('unknown call ' + name)
    return job.handlers[name](payload)
  })

  // Loads the maintenance page for one task in a hidden window; resolves to its report
  // ({ ok: false, error } when it fails, closes or takes longer than timeoutMs).
  function runPage(origin, task, handlers, timeoutMs) {
    return new Promise((resolve) => {
      const win = new BrowserWindow({ show: false, skipTaskbar: true, width: 400, height: 300,
        webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false,
          preload: path.join(root, 'maintenance-preload.cjs') } })
      const contents = win.webContents
      contents.setAudioMuted(true)
      contents.setWindowOpenHandler(() => ({ action: 'deny' }))
      contents.on('will-navigate', (e) => e.preventDefault())
      let settled = false
      const finish = (report) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        if (active && active.id === contents.id) active = null
        if (!win.isDestroyed()) win.destroy()
        resolve(report)
      }
      const timer = setTimeout(() => finish({ ok: false, error: 'timed out' }), timeoutMs)
      active = { id: contents.id, prefix: `${origin}/maintenance.html`, handlers, finish }
      contents.on('did-fail-load', (_e, code, desc, _url, mainFrame) => { if (mainFrame) finish({ ok: false, error: `could not load (${code} ${desc})` }) })
      contents.on('render-process-gone', (_e, d) => finish({ ok: false, error: 'the page stopped (' + (d && d.reason) + ')' }))
      win.on('closed', () => finish({ ok: false, error: 'closed' }))
      contents.on('console-message', (e) => { if (e && e.level === 'error') log('[maintenance] ' + e.message) })
      win.loadURL(`${origin}/maintenance.html?task=${task}`)
    })
  }

  async function migrate({ port, from }) {
    let server
    try { server = await listenExactly(root, port) } catch (e) {
      log(`[migrate] the old address ${from} is not free (${(e && (e.code || e.message)) || 'error'}): saved data stays there and is moved on a later start`)
      return { done: false }
    }
    let staging = null
    try {
      staging = fs.mkdtempSync(path.join(profileDir, 'origin-migration-'))
      const exp = { storage: null, dbs: [], records: [] }
      const report = await runPage(from, 'export', {
        'export:storage': (s) => {
          if (!s || typeof s !== 'object' || exp.storage) throw new Error('bad storage')
          exp.storage = Object.fromEntries(Object.entries(s).filter(([, v]) => typeof v === 'string'))
          return true
        },
        'export:db': (d) => { exp.dbs.push(d); return true },
        'export:record': (r) => {
          const i = exp.records.length
          const blobs = (r.blobs || []).map((m, b) => {
            const file = path.join(staging, `${i}-${b}.bin`)
            fs.writeFileSync(file, '')
            return { size: Number(m.size) || 0, type: String(m.type || ''), name: m.name === null ? null : String(m.name), lastModified: m.lastModified, file, written: 0 }
          })
          exp.records.push({ db: r.db, store: r.store, key: r.key, value: r.value, blobs })
          return i
        },
        'export:chunk': ({ record, blob, offset, data }) => {
          const m = exp.records[record] && exp.records[record].blobs[blob]
          if (!m || offset !== m.written || !data || !data.length || m.written + data.length > m.size) throw new Error('bad chunk')
          fs.appendFileSync(m.file, data)
          m.written += data.length
          return true
        }
      }, 10 * 60 * 1000)
      await closeServer(server)
      server = null
      const incomplete = exp.records.some((r) => r.blobs.some((m) => m.written !== m.size))
      const counted = report.ok && exp.storage && report.storageKeys === Object.keys(exp.storage).length && report.records === exp.records.length
      const verdict = rules.exportVerdict(incomplete || !counted ? { ok: false, error: report.error || 'the read was incomplete' } : report)
      if (verdict.next !== 'import') { log('[migrate] ' + from + ': ' + verdict.why); return { done: false } }
      log(`[migrate] read ${verdict.keys} saved entries and ${verdict.records} stored records from ${from}`)

      let merge = null
      const imp = await runPage(appOrigin, 'import', {
        'import:plan': ({ storageKeys }) => {
          merge = rules.mergeStorage(storageKeys, exp.storage)
          return { storage: merge.set, dbs: exp.dbs, records: exp.records.length }
        },
        'import:record': (i) => {
          const r = exp.records[i]
          if (!r) throw new Error('no record ' + i)
          return { db: r.db, store: r.store, key: r.key, value: r.value, blobs: r.blobs.map(({ size, type, name, lastModified }) => ({ size, type, name, lastModified })) }
        },
        'import:chunk': ({ record, blob, offset }) => {
          const m = exp.records[record] && exp.records[record].blobs[blob]
          if (!m || !Number.isInteger(offset) || offset < 0 || offset >= m.size) throw new Error('bad chunk')
          const buf = Buffer.alloc(Math.min(CHUNK, m.size - offset))
          const fd = fs.openSync(m.file, 'r')
          try { fs.readSync(fd, buf, 0, buf.length, offset) } finally { fs.closeSync(fd) }
          return buf
        }
      }, 10 * 60 * 1000)
      if (!imp.ok) { log('[migrate] writing to the new address failed (' + imp.error + '): trying again on a later start'); return { done: false } }
      if (imp.skippedStores && imp.skippedStores.length) log('[migrate] stores the new address does not have (their records stay at the old address): ' + imp.skippedStores.join(', '))
      session.flushStorageData()

      // checked by a freshly loaded page, not by the importer's own word
      const present = await runPage(appOrigin, 'list', {}, 60 * 1000)
      const check = rules.verifyImport({
        storageKeys: Object.keys(exp.storage),
        records: exp.records.map(({ db, store, key }) => ({ db, store, key }))
      }, present)
      if (!present.ok || !check.ok) {
        log('[migrate] the new address does not hold everything after the move (' + (present.error || check.missing.slice(0, 5).join('; ')) + '): trying again on a later start')
        return { done: false }
      }
      const result = {
        storageMoved: imp.storageSet, storageKeptNewer: merge.skipped, recordsMoved: imp.added,
        recordsKeptNewer: imp.kept
      }
      writeAtomically(path.join(profileDir, rules.MARKER_FILE), rules.markerText({ from, to: appOrigin, at: new Date().toISOString(), result }))
      log(`[migrate] done: ${imp.storageSet} saved entries and ${imp.added} records moved from ${from} to ${appOrigin}; the old data is left as it was`)
      if (merge.skipped.length) log('[migrate] kept the newer value already at the new address for: ' + merge.skipped.join(', '))
      if (imp.kept) log(`[migrate] ${imp.kept} records were already at the new address and were kept`)
      return { done: true, result }
    } catch (e) {
      log('[migrate] failed (' + ((e && e.message) || e) + '): trying again on a later start')
      return { done: false }
    } finally {
      if (server) await closeServer(server)
      if (staging) fs.rmSync(staging, { recursive: true, force: true })
    }
  }

  async function backup(now = new Date()) {
    const dir = path.join(profileDir, rules.BACKUP_DIR)
    fs.mkdirSync(dir, { recursive: true })
    const names = fs.readdirSync(dir)
    // a backup cut short (the app quit while writing) is never left behind
    for (const n of names) if (n.endsWith('.part') && rules.AUTO_BACKUP.test(n.slice(0, -5))) fs.rmSync(path.join(dir, n), { force: true })
    if (!rules.backupDue(names, now)) return { written: false, why: 'already backed up today' }
    const name = rules.backupName(now)
    const part = path.join(dir, name + '.part')
    let meta = null, fd = null, written = 0
    try {
      const report = await runPage(appOrigin, 'backup', {
        'backup:begin': (m) => {
          meta = m
          if (!rules.backupWorthKeeping(m)) return { go: false }
          fd = fs.openSync(part, 'w')
          return { go: true }
        },
        'backup:chunk': ({ offset, data }) => {
          if (fd === null || offset !== written || !data || !data.length || written + data.length > meta.size) throw new Error('bad chunk')
          fs.writeSync(fd, data)
          written += data.length
          return true
        }
      }, 10 * 60 * 1000)
      if (fd !== null) { fs.fsyncSync(fd); fs.closeSync(fd); fd = null }
      if (!report.ok) { log('[backup] failed: ' + report.error); return { written: false, why: report.error } }
      if (!report.written) { log('[backup] nothing saved yet: no backup written'); return { written: false, why: 'empty' } }
      if (!meta || written !== meta.size) { log('[backup] incomplete: ' + written + ' of ' + (meta && meta.size) + ' bytes'); return { written: false, why: 'incomplete' } }
      fs.renameSync(part, path.join(dir, name))
      const pruned = rules.backupsToPrune(fs.readdirSync(dir))
      for (const n of pruned) fs.rmSync(path.join(dir, n), { force: true })
      log(`[backup] saved ${name} (${meta.songs} songs, ${meta.keys} settings and progress entries, ${(written / 1e6).toFixed(2)} MB)` +
        (meta.skipped && meta.skipped.length ? '; left out: ' + meta.skipped.join(', ') : '') + (pruned.length ? '; removed the older ' + pruned.join(', ') : ''))
      return { written: true, name }
    } finally {
      if (fd !== null) fs.closeSync(fd)
      fs.rmSync(part, { force: true })
    }
  }

  return { migrate, backup }
}

module.exports = { createMaintenance, listenExactly }
