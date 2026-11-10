// The hidden maintenance page (renderer/maintenance-host.cjs opens it, never shown). One job
// per load, named by ?task=:
//   export  on the OLD address: read every localStorage key and every IndexedDB record
//           (recordings in 4 MB slices) and hand them to the main process. Reads only.
//   import  on keylight://app: write them, keeping every key and record already here.
//   list    on keylight://app: what this address holds now (the check after an import).
//   backup  on keylight://app: an automatic backup in the format of backup-format.js.
const bridge = window.keylightMaintenance
const call = (name, payload) => bridge.call(name, payload)
const CHUNK = 4 * 1024 * 1024
const BLOB_MARK = '__keylightBlob'

const request = (r) => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })

// Opens a database that exists, at its own version: never creates or upgrades one.
function openExisting(name) {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(name)
    r.onupgradeneeded = () => { r.transaction.abort() }
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error || new Error('could not open ' + name))
    r.onblocked = () => reject(new Error(name + ' is blocked'))
  })
}

function createDatabase({ name, version, stores }) {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(name, version)
    r.onupgradeneeded = () => {
      for (const s of stores) {
        const store = r.result.createObjectStore(s.name, { keyPath: s.keyPath, autoIncrement: s.autoIncrement })
        for (const i of s.indexes) store.createIndex(i.name, i.keyPath, { unique: i.unique, multiEntry: i.multiEntry })
      }
    }
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error || new Error('could not create ' + name))
    r.onblocked = () => reject(new Error(name + ' is blocked'))
  })
}

function schema(db, name) {
  const store = db.transaction(name).objectStore(name)
  const indexes = [...store.indexNames].map((n) => {
    const i = store.index(n)
    return { name: n, keyPath: i.keyPath, unique: i.unique, multiEntry: i.multiEntry }
  })
  return { name, keyPath: store.keyPath, autoIncrement: store.autoIncrement, indexes }
}

const isPlain = (v) => v !== null && typeof v === 'object' && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null)

// Blobs and Files cannot cross to the main process: each becomes { __keylightBlob: n }.
function strip(value, blobs) {
  if (value instanceof Blob) { blobs.push(value); return { [BLOB_MARK]: blobs.length - 1 } }
  if (Array.isArray(value)) return value.map((v) => strip(v, blobs))
  if (isPlain(value)) {
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = strip(v, blobs)
    return out
  }
  return value
}
function restore(value, blobs) {
  if (Array.isArray(value)) return value.map((v) => restore(v, blobs))
  if (isPlain(value)) {
    const keys = Object.keys(value)
    if (keys.length === 1 && keys[0] === BLOB_MARK && Number.isInteger(value[BLOB_MARK])) return blobs[value[BLOB_MARK]]
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = restore(v, blobs)
    return out
  }
  return value
}
const blobMeta = (b) => ({ size: b.size, type: b.type || '', name: b instanceof File ? b.name : null, lastModified: b instanceof File ? b.lastModified : null })

function storageKeys() {
  const keys = []
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k !== null) keys.push(k) }
  return keys
}

async function exportAll() {
  const storage = {}
  for (const k of storageKeys()) storage[k] = localStorage.getItem(k)
  await call('export:storage', storage)
  let records = 0
  for (const info of await indexedDB.databases()) {
    if (!info.name) continue
    const db = await openExisting(info.name)
    try {
      const stores = [...db.objectStoreNames].map((n) => schema(db, n))
      await call('export:db', { name: db.name, version: db.version, stores })
      for (const s of stores) {
        const keys = await request(db.transaction(s.name).objectStore(s.name).getAllKeys())
        // one record at a time, each in its own read: a recording is never held twice
        for (const key of keys) {
          const value = await request(db.transaction(s.name).objectStore(s.name).get(key))
          if (value === undefined) continue
          const blobs = []
          const plain = strip(value, blobs)
          const record = await call('export:record', { db: db.name, store: s.name, key, value: plain, blobs: blobs.map(blobMeta) })
          for (let b = 0; b < blobs.length; b++) {
            for (let offset = 0; offset < blobs[b].size; offset += CHUNK) {
              const data = new Uint8Array(await blobs[b].slice(offset, offset + CHUNK).arrayBuffer())
              await call('export:chunk', { record, blob: b, offset, data })
            }
          }
          records++
        }
      }
    } finally { db.close() }
  }
  return { ok: true, storageKeys: Object.keys(storage).length, records }
}

// Adds a record unless its key is already here (ConstraintError): the newer data stays.
function addIfAbsent(db, storeName, value, key) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(storeName, 'readwrite', { durability: 'strict' })
    const store = t.objectStore(storeName)
    let kept = false
    const r = store.keyPath === null ? store.add(value, key) : store.add(value)
    r.onerror = (e) => {
      if (r.error && r.error.name === 'ConstraintError') { kept = true; e.preventDefault(); e.stopPropagation() }
    }
    t.oncomplete = () => resolve(kept ? 'kept' : 'added')
    t.onerror = () => reject(t.error || r.error)
    t.onabort = () => reject(t.error || r.error || new Error('the write was aborted'))
  })
}

async function importAll() {
  const plan = await call('import:plan', { storageKeys: storageKeys() })
  for (const [k, v] of Object.entries(plan.storage)) localStorage.setItem(k, v)
  const here = new Set((await indexedDB.databases()).map((d) => d.name))
  const dbs = new Map()
  const skippedStores = []
  try {
    for (const d of plan.dbs) {
      const db = here.has(d.name) ? await openExisting(d.name) : await createDatabase(d)
      dbs.set(d.name, db)
      for (const s of d.stores) if (!db.objectStoreNames.contains(s.name)) skippedStores.push(d.name + '/' + s.name)
    }
    let added = 0, kept = 0
    for (let i = 0; i < plan.records; i++) {
      const r = await call('import:record', i)
      if (skippedStores.includes(r.db + '/' + r.store)) continue
      const blobs = []
      for (let b = 0; b < r.blobs.length; b++) {
        const m = r.blobs[b]
        // grown a slice at a time: the browser keeps Blob data out of the page's memory
        let data = new Blob([])
        for (let offset = 0; offset < m.size; offset += CHUNK) data = new Blob([data, await call('import:chunk', { record: i, blob: b, offset })])
        blobs.push(m.name !== null ? new File([data], m.name, { type: m.type, lastModified: m.lastModified }) : new Blob([data], { type: m.type }))
      }
      if ((await addIfAbsent(dbs.get(r.db), r.store, restore(r.value, blobs), r.key)) === 'added') added++
      else kept++
    }
    return { ok: true, storageSet: Object.keys(plan.storage).length, added, kept, skippedStores }
  } finally { for (const db of dbs.values()) db.close() }
}

async function listAll() {
  const stores = []
  for (const info of await indexedDB.databases()) {
    if (!info.name) continue
    const db = await openExisting(info.name)
    try {
      for (const name of db.objectStoreNames) stores.push({ db: db.name, store: name, keys: await request(db.transaction(name).objectStore(name).getAllKeys()) })
    } finally { db.close() }
  }
  return { ok: true, storageKeys: storageKeys(), stores }
}

async function backup() {
  const { createBackup } = await import('./backup-format.js')
  const { listImported } = await import('./importer.js')
  const { blob, songs, keys, skipped } = await createBackup({ songs: await listImported(), storage: localStorage })
  const answer = await call('backup:begin', { size: blob.size, songs, keys, skipped: skipped.map((s) => `${s.title} (${s.reason})`) })
  if (!answer || !answer.go) return { ok: true, written: false, songs, keys }
  for (let offset = 0; offset < blob.size; offset += CHUNK) {
    await call('backup:chunk', { offset, data: new Uint8Array(await blob.slice(offset, offset + CHUNK).arrayBuffer()) })
  }
  return { ok: true, written: true, songs, keys, size: blob.size }
}

const TASKS = { export: exportAll, import: importAll, list: listAll, backup }
const task = TASKS[new URLSearchParams(location.search).get('task')]
;(async () => {
  let report
  try { report = task ? await task() : { ok: false, error: 'no such task' } } catch (e) { report = { ok: false, error: String((e && e.message) || e) } }
  await call('done', report)
})()
