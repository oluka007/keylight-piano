// Electron main for scripts/qa-origin-migration.js: opens a blank page at the OLD address
// (http://127.0.0.1:<port>) or the NEW one (keylight://app) in a given profile, runs one job
// on that address's storage, prints the result as one JSON line and quits.
//   electron origin-storage-probe.cjs <profile> <old|new> <port> <job> [arg]
// Jobs: seed (a few localStorage keys and one IndexedDB song with a 9 MB recording),
// read (every key and record, recordings as SHA-256), set <key=value>.
const http = require('node:http')
const { app, BrowserWindow, protocol, session } = require('electron')

const [profile, where, port, job, arg] = process.argv.slice(-5)
app.setPath('userData', profile)
protocol.registerSchemesAsPrivileged([{ scheme: 'keylight', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, codeCache: true } }])
const PAGE = '<!doctype html><meta charset="utf-8"><title>probe</title>'

const JOBS = {
  seed: `(async () => {
    localStorage.setItem('lumi.qa.note', JSON.stringify({ from: 'old' }))
    localStorage.setItem('lumi.onboarded', 'true')
    localStorage.setItem('lumi.streak.count', '5')
    localStorage.setItem('qa-other', 'kept as is')
    const bytes = new Uint8Array(9 * 1024 * 1024)
    for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 31 + 7) % 251
    const db = await new Promise((res, rej) => { const q = indexedDB.open('keylight', 1); q.onupgradeneeded = () => q.result.createObjectStore('songs', { keyPath: 'id' }); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error) })
    await new Promise((res, rej) => {
      const t = db.transaction('songs', 'readwrite', { durability: 'strict' })
      t.objectStore('songs').put({ id: 'imp-qa1', file: 'imported:imp-qa1', title: 'QA Song', artist: 'QA', notes: [{ pitch: 60, start: 0, dur: 0.5, vel: 100, hand: 'right', finger: 1 }],
        duration: 1, tempo: 100, added: 1700000000000, source: 'audio', lyrics: { synced: [{ t: 0, text: 'la' }] },
        audio: new File([bytes], 'qa song.mp3', { type: 'audio/mpeg', lastModified: 1690000000000 }) })
      t.oncomplete = res; t.onerror = () => rej(t.error)
    })
    db.close()
    return { ok: true }
  })()`,
  read: `(async () => {
    const storage = {}
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); storage[k] = localStorage.getItem(k) }
    const records = []
    for (const info of await indexedDB.databases()) {
      const db = await new Promise((res, rej) => { const q = indexedDB.open(info.name); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error) })
      for (const name of db.objectStoreNames) {
        const all = await new Promise((res, rej) => { const q = db.transaction(name).objectStore(name).getAll(); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error) })
        for (const r of all) {
          const out = { db: info.name, store: name, id: r.id, title: r.title, notes: r.notes, lyrics: r.lyrics }
          if (r.audio instanceof Blob) {
            const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', await r.audio.arrayBuffer()))
            out.audio = { size: r.audio.size, type: r.audio.type, name: r.audio.name, lastModified: r.audio.lastModified, file: r.audio instanceof File, sha256: [...hash].map((b) => b.toString(16).padStart(2, '0')).join('') }
          }
          records.push(out)
        }
      }
      db.close()
    }
    return { ok: true, storage, records }
  })()`,
  set: `(() => { const [k, v] = ${JSON.stringify(String(arg || '='))}.split('='); localStorage.setItem(k, v); return { ok: true } })()`
}

app.whenReady().then(async () => {
  let url, server
  if (where === 'old') {
    server = http.createServer((_q, r) => { r.writeHead(200, { 'Content-Type': 'text/html' }); r.end(PAGE) })
    await new Promise((res, rej) => { server.once('error', rej); server.listen(Number(port), '127.0.0.1', res) })
    url = `http://127.0.0.1:${port}/probe.html`
  } else {
    protocol.handle('keylight', () => new Response(PAGE, { headers: { 'Content-Type': 'text/html' } }))
    url = 'keylight://app/probe.html'
  }
  const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, sandbox: true } })
  let result
  try {
    await win.loadURL(url)
    result = await win.webContents.executeJavaScript(JOBS[job], true)
  } catch (e) { result = { ok: false, error: String((e && e.message) || e) } }
  session.defaultSession.flushStorageData()
  process.stdout.write('PROBE ' + JSON.stringify(result) + '\n')
  win.destroy()
  if (server) server.close()
  setTimeout(() => app.quit(), 300)
})
