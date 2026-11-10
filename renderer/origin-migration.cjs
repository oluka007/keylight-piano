// Rules for the one-time move of saved data from the old page address
// (http://127.0.0.1:47821, or a tester build's own port) to keylight://app, and for the
// automatic safety backups. Pure: no Electron, no file access, so
// scripts/test-origin-migration.js checks every rule under plain Node.
// renderer/maintenance-host.cjs does the work with these answers.

const MARKER_FILE = 'origin-migration.json'
const MARKER_VERSION = 1
const DEFAULT_LEGACY_PORT = 47821

// The marker is the main process's own record that the move finished. Anything else in the
// file (unreadable, an older or newer shape, done not exactly true) counts as not done.
function migrationDone(markerText) {
  if (typeof markerText !== 'string' || !markerText) return false
  try {
    const m = JSON.parse(markerText)
    return !!m && typeof m === 'object' && m.version === MARKER_VERSION && m.done === true
  } catch (_e) { return false }
}

function markerText({ from, to, at, result }) {
  return JSON.stringify({ version: MARKER_VERSION, done: true, from, to, at, ...result }, null, 2) + '\n'
}

// Whether this start should try the move, and from which port. Only the address the old
// app used can hold the old data: LUMI_PORT, else the tester build's port, else 47821.
// Test profiles (LUMI_USERDATA) never had an old address unless a test names one with
// LUMI_PORT, so they are left alone (and never touch the real app's port).
function migrationPlan({ env = {}, buildPort, markerText: text }) {
  if (migrationDone(text)) return { attempt: false, reason: 'already moved' }
  if (env.LUMI_MIGRATE === '0') return { attempt: false, reason: 'LUMI_MIGRATE=0' }
  if (env.LUMI_USERDATA && !env.LUMI_PORT) return { attempt: false, reason: 'a test profile (LUMI_USERDATA) without LUMI_PORT' }
  const port = Number(env.LUMI_PORT || buildPort || DEFAULT_LEGACY_PORT)
  if (!Number.isInteger(port) || port < 1 || port > 65535) return { attempt: false, reason: 'no valid old port (' + (env.LUMI_PORT || buildPort) + ')' }
  return { attempt: true, port, from: `http://127.0.0.1:${port}` }
}

// What to do with what the old page read. Never trust an empty or failed read: an empty
// result is exactly what a wrong address or a broken read looks like, so it is never
// "done"; the next start looks again.
function exportVerdict(report) {
  if (!report || report.ok !== true) return { next: 'retry', why: 'the old page could not be read' + (report && report.error ? ': ' + report.error : '') }
  const keys = Number(report.storageKeys) || 0
  const records = Number(report.records) || 0
  if (keys + records === 0) return { next: 'retry', why: 'the old page holds nothing (or could not be read): looking again on a later start' }
  return { next: 'import', keys, records }
}

// localStorage merge: the new address keeps every key it already has (newer data, written
// by this version), and gets the old value only for keys it does not have.
function mergeStorage(existingKeys, incoming) {
  const have = new Set(Array.isArray(existingKeys) ? existingKeys : [])
  const set = {}
  const skipped = []
  for (const [k, v] of Object.entries(incoming || {})) {
    if (typeof v !== 'string') continue
    if (have.has(k)) skipped.push(k)
    else set[k] = v
  }
  return { set, skipped }
}

// A stable text for an IndexedDB key (string, number, Date, array of those), or null for a
// kind of key the move does not carry (binary keys: no store of this app uses them).
function keyId(key) {
  if (typeof key === 'string') return 's:' + key
  if (typeof key === 'number' && !Number.isNaN(key)) return 'n:' + key
  if (key instanceof Date && !Number.isNaN(key.getTime())) return 'd:' + key.getTime()
  if (Array.isArray(key)) {
    const parts = key.map(keyId)
    return parts.includes(null) ? null : 'a:[' + parts.join(',') + ']'
  }
  return null
}

// After the import, a freshly loaded page of the new address lists what it holds. The move is
// done only when every old localStorage key and every old record is there; a record whose store
// the new address lacks keeps the move open (the old data stays where it is, and is named in app.log).
function verifyImport({ storageKeys = [], records = [] }, present) {
  const missing = []
  const keys = new Set((present && present.storageKeys) || [])
  for (const k of storageKeys) if (!keys.has(k)) missing.push('localStorage ' + k)
  const stores = new Map()
  for (const s of (present && present.stores) || []) stores.set(s.db + '/' + s.store, new Set((s.keys || []).map(keyId)))
  for (const r of records) {
    const where = r.db + '/' + r.store
    const have = stores.get(where)
    if (!have || !have.has(keyId(r.key))) missing.push('record ' + where + ' ' + keyId(r.key))
  }
  return { ok: missing.length === 0, missing }
}

// ---- automatic backups ------------------------------------------------------------
// Kept in <profile>/backups as keylight-auto-YYYYMMDD-HHMMSS.keylightbackup (the format of
// renderer/backup-format.js, so "Restore a backup" reads them). Only files with this
// name are ever pruned; anything else in the folder is left alone.
const BACKUP_DIR = 'backups'
const BACKUP_KEEP = 3
const AUTO_BACKUP = /^keylight-auto-(\d{8})-(\d{6})\.keylightbackup$/
const pad = (n) => String(n).padStart(2, '0')
const dayStamp = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
const backupName = (d) => `keylight-auto-${dayStamp(d)}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.keylightbackup`

const autoBackups = (names) => (names || []).filter((n) => AUTO_BACKUP.test(n)).sort()

// At most one a calendar day (local time): due when no automatic backup carries today's date.
function backupDue(names, now) {
  const today = dayStamp(now)
  return !autoBackups(names).some((n) => AUTO_BACKUP.exec(n)[1] === today)
}

// The automatic backups to delete so that the newest `keep` remain.
function backupsToPrune(names, keep = BACKUP_KEEP) {
  const all = autoBackups(names)
  return all.slice(0, Math.max(0, all.length - keep))
}

// A backup with no songs and no settings is never written: a few starts with empty storage
// (the very failure these backups are for) would otherwise push every good copy out.
const backupWorthKeeping = ({ songs, keys }) => (Number(songs) || 0) + (Number(keys) || 0) > 0

module.exports = {
  MARKER_FILE, MARKER_VERSION, DEFAULT_LEGACY_PORT, migrationDone, markerText, migrationPlan, exportVerdict,
  mergeStorage, keyId, verifyImport,
  BACKUP_DIR, BACKUP_KEEP, AUTO_BACKUP, backupName, backupDue, backupsToPrune, backupWorthKeeping
}
