// Main-process side of the experimental Airwave tracking source: starts Keylight's own
// native helper (native/keylight-leap-helper.c) on request, reads its one-JSON-object-per-
// line output, keeps only the fields Keylight understands, and hands those to the window.
// Plain CommonJS with injected spawn/fs so it is tested without Electron.
const path = require('node:path')

const MAX_LINE = 16 * 1024
const OS = new Set(['mac', 'windows'])
const FROM = new Set(['override', 'service-app', 'tracking-app', 'library-support', 'app-scan', 'library-scan', 'program-files', 'system'])
const RUNTIME = new Set(['missing', 'loaded', 'incompatible'])
const SERVICE = new Set(['connected', 'lost', 'not_running'])
const DEVICE = new Set(['attached', 'lost', 'failed'])
const CLASSES = new Set(['peripheral', 'dragonfly', 'nightcrawler', 'rigel', 'SIR170', '3Di', 'LMC2', 'unknown'])
const STAGES = new Set(['create', 'open', 'poll'])
// A search note is a system install location or a plain file name, never a home-folder path.
const NOTE = /^(?:(?:app|lib|unloadable|untrusted|override):)?(?:\/(?:Applications|Library)\/[\w .()+\-/]*|[\w .()+\-]*)$/
const notes = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.length < 240 && NOTE.test(x) && !x.split('/').some((seg) => seg === '..' || seg === '.')).slice(0, 40) : [])
const num = (v) => typeof v === 'number' && Number.isFinite(v)
const uint = (v) => Number.isSafeInteger(v) && v >= 0

// One parsed helper line -> the message the window receives, or null when it is not one
// of the known shapes. Nothing else (extra fields, strings, huge arrays) passes through.
function sanitize(m) {
  if (!m || typeof m !== 'object') return null
  switch (m.t) {
    case 'hello': return OS.has(m.os) ? { t: 'hello', os: m.os } : null
    case 'runtime':
      if (!RUNTIME.has(m.state)) return null
      if (m.state === 'missing') return { t: 'runtime', state: 'missing', tried: notes(m.tried), seen: notes(m.seen) }
      return m.state === 'loaded' ? { t: 'runtime', state: 'loaded', from: FROM.has(m.from) ? m.from : 'system' } : { t: 'runtime', state: m.state }
    case 'service': return SERVICE.has(m.state) ? { t: 'service', state: m.state } : null
    case 'device':
      if (!DEVICE.has(m.state)) return null
      return { t: 'device', state: m.state, streaming: m.streaming === true,
        class: CLASSES.has(m.class) ? m.class : 'unknown', typeCode: uint(m.typeCode) ? m.typeCode : 0, identified: m.identified === true }
    case 'abi':
      return num(m.messageSize) && num(m.expected) ? { t: 'abi', messageSize: m.messageSize, expected: m.expected } : null
    case 'error': return STAGES.has(m.stage) && num(m.code) ? { t: 'error', stage: m.stage, code: m.code } : null
    case 'frame': {
      if (!Array.isArray(m.hands) || m.hands.length > 4 || !num(m.ts)) return null
      const hands = []
      for (const h of m.hands) {
        if (!h || (h.side !== 'left' && h.side !== 'right') || !Array.isArray(h.tips) || h.tips.length !== 5) return null
        const tips = h.tips.map((t) => (Array.isArray(t) && t.length === 3 && t.every(num) ? t : null))
        hands.push({ side: h.side, conf: num(h.conf) ? Math.max(0, Math.min(1, h.conf)) : 0, tips })
      }
      return { t: 'frame', ts: m.ts, fps: num(m.fps) ? m.fps : 0, hands }
    }
    default: return null
  }
}

// Where the helper binary is, or null when this build does not carry one for this platform.
function helperPath({ root, resourcesPath, packaged, platform = process.platform, arch = process.arch, exists }) {
  const name = platform === 'win32' ? 'keylight-leap-helper.exe' : 'keylight-leap-helper'
  const dir = `${platform}-${arch}`
  const file = packaged ? path.join(resourcesPath, 'native', dir, name) : path.join(root, 'native', 'build', dir, name)
  return exists(file) ? file : null
}

function createAirwaveBridge({ spawn, findHelper, send, log = () => {}, env = {} }) {
  let child = null
  const stop = () => {
    const c = child
    child = null
    if (c) { c.stdout.removeAllListeners('data'); try { c.kill() } catch (_e) { /* already gone */ } }
  }
  return {
    running: () => !!child,
    start() {
      if (child) return { ok: true }
      const file = findHelper()
      if (!file) return { ok: false, reason: 'no-helper' }
      let c
      try { c = spawn(file, [], { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true, env }) } catch (e) {
        log('[airwave] could not start the helper: ' + e.code)
        return { ok: false, reason: 'spawn-failed' }
      }
      child = c
      let buffer = ''
      let skipping = false
      c.stdout.setEncoding('utf8')
      c.stdout.on('data', (chunk) => {
        buffer += chunk
        let at
        while ((at = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, at)
          buffer = buffer.slice(at + 1)
          if (skipping) { skipping = false; continue }
          if (line.length > MAX_LINE) continue
          let parsed
          try { parsed = JSON.parse(line) } catch (_e) { continue }
          const message = sanitize(parsed)
          if (message) send(message)
        }
        if (buffer.length > MAX_LINE) { buffer = ''; skipping = true }
      })
      const ended = (code, signal) => {
        if (child !== c) return
        child = null
        send({ t: 'exit', code: Number.isInteger(code) ? code : null, signal: typeof signal === 'string' ? signal : null })
      }
      c.on('error', (e) => { log('[airwave] helper error: ' + e.code); ended(null, null) })
      c.on('exit', ended)
      return { ok: true }
    },
    stop
  }
}

// ---- Diagnostics: why does the tracking service list no camera? --------------------------
// Read-only probes, run only when the person exports the report: the system's list of driver
// extensions, running process NAMES, installed app/folder names under /Applications and
// /Library, and on Windows the service states. Every parser is a pure function of text; every
// result passes through sanitizeDiagnostics, and a probe that fails becomes null ("not available").
const WORDS = /ultraleap|leap|roli|luminary|airwave/i
const PROBE_MS = 4000
const SERVICE_BUFFER = 256 * 1024
const SERVICE_PAGES = 4
const SERVICE_CONTINUATION = /Enum:\s+more data,\s+need\s+\d+\s+bytes\s+start resume at index\s+(\d+)/i
const WALK = { depth: 4, entries: 4000, ms: 2000, candidates: 10, libs: 3 }
const BUNDLE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/
const EXT_VERSION = /^[0-9A-Za-z.+-]{1,11}(?:\/[0-9A-Za-z.+-]{1,11})?$/
const EXT_STATE = /^[a-z][a-z ]{0,49}$/
const PROC_NAME = /^[\w .()+-]{1,60}$/
const SVC_STATE = new Set(['STOPPED', 'START_PENDING', 'STOP_PENDING', 'RUNNING', 'CONTINUE_PENDING', 'PAUSE_PENDING', 'PAUSED'])
const SYSTEM_PATH = /^\/(?:Applications|Library)\/[\w .()+\-/]{0,200}$/
const noDots = (p) => !p.split('/').some((seg) => seg === '..' || seg === '.')

// `systemextensionsctl list` text -> [{ id, version, state }] for the matching lines only
function parseExtensions(text) {
  const out = []
  for (const line of String(text || '').split('\n')) {
    if (out.length >= 8) break
    if (line.length > 600 || !WORDS.test(line)) continue
    const m = /([A-Za-z0-9][A-Za-z0-9._-]*)\s+\(([^()]*)\)[^[\]]*\[([^\]]*)\]\s*$/.exec(line)
    if (!m) continue
    const entry = cleanExtension({ id: m[1], version: m[2].trim(), state: m[3].trim().toLowerCase() })
    if (entry) out.push(entry)
  }
  return out
}
function cleanExtension(e) {
  if (!e || typeof e.id !== 'string' || !BUNDLE_ID.test(e.id) || !WORDS.test(e.id)) return null
  const version = typeof e.version === 'string' && EXT_VERSION.test(e.version) ? e.version : ''
  const state = typeof e.state === 'string' && EXT_STATE.test(e.state) ? e.state : ''
  return { id: e.id, version, state }
}

// one program name per line (a path or a bare name) -> unique base names that match, at most 12
function parseProcessNames(text, sep = '/') {
  const seen = new Set()
  for (const raw of String(text || '').split('\n')) {
    const name = raw.trim().split(sep).pop().trim()
    if (name && PROC_NAME.test(name) && WORDS.test(name)) seen.add(name)
    if (seen.size >= 12) break
  }
  return [...seen]
}
// `tasklist /fo csv /nh`: "image.exe","pid",...
function parseTasklist(text) {
  const names = []
  for (const line of String(text || '').split('\n')) {
    const m = /^"([^"]{1,80})"/.exec(line.trim())
    if (m) names.push(m[1])
  }
  return parseProcessNames(names.join('\n'), '\\')
}
// `sc.exe query state= all`: SERVICE_NAME: x ... STATE : 4  RUNNING
function parseServices(text) {
  const out = []
  for (const block of String(text || '').split(/\r?\n\s*\r?\n/)) {
    const name = /SERVICE_NAME:\s*(.+)/.exec(block)
    const state = /STATE\s*:\s*\d+\s+([A-Z_]+)/.exec(block)
    if (!name || !state || !SVC_STATE.has(state[1]) || !PROC_NAME.test(name[1].trim()) || !WORDS.test(name[1])) continue
    out.push({ name: name[1].trim(), state: state[1] })
    if (out.length >= 8) break
  }
  return out
}

// Names of app bundles in /Applications and folders in /Library/Application Support that match,
// and which libLeapC*.dylib files each holds (up to 4 folders deep, never following links).
// Bounded by an entry count and a time limit; whatever was found by then is reported.
function findCandidates({ fs, now = Date.now, roots = [['/Applications', '/Applications', true], ['/Library/Application Support', '/Library/Application Support', false]] }) {
  const deadline = now() + WALK.ms
  let budget = WALK.entries
  const out = []
  function *list(dir, stop) {
    let handle
    try {
      if (budget <= 0 || now() > deadline || stop()) return
      handle = fs.opendirSync(dir, { bufferSize: 1 })
      while (budget > 0 && now() <= deadline && !stop()) {
        const entry = handle.readSync()
        if (!entry) break
        budget--
        if (now() > deadline) break
        yield entry
      }
    } catch (_e) {
      // Missing folders, read failures and permission errors are unavailable.
    } finally {
      if (handle) { try { handle.closeSync() } catch (_e) {} }
    }
  }
  const find = (dir, depth, found) => {
    for (const e of list(dir, () => found.length >= WALK.libs)) {
      const full = dir + '/' + e.name
      if (e.isDirectory() && depth < WALK.depth) find(full, depth + 1, found)
      else if (e.isFile() && /^libLeapC.*\.dylib$/i.test(e.name)) found.push(full)
    }
  }
  for (const [dir, shown, apps] of roots) {
    for (const e of list(dir, () => out.length >= WALK.candidates)) {
      if (!e.isDirectory() || !WORDS.test(e.name) || (apps && !/\.app$/i.test(e.name))) continue
      const found = []
      find(dir + '/' + e.name, 1, found)
      const base = shown + '/' + e.name
      out.push({ path: base, libs: found.map((f) => shown + f.slice(dir.length)) })
    }
  }
  return out
}

const macMajor = (release) => {
  const d = parseInt(String(release), 10)
  return Number.isInteger(d) && d >= 20 ? String(d <= 24 ? d - 9 : d + 1) : null   // Darwin 24 = macOS 15, Darwin 25 = macOS 26
}

// Anything that is not one of the known shapes is dropped; a missing or malformed section is
// null ("not available"). `user` is the account name, never allowed in any string.
function sanitizeDiagnostics(d, user = '') {
  const clean = (list, one, cap) => (Array.isArray(list) ? list.slice(0, cap).map(one).filter(Boolean) : null)
  const bad = (s) => !!user && String(s).toLowerCase().includes(String(user).toLowerCase())
  const src = d && typeof d === 'object' ? d : {}
  const name = (v) => (typeof v === 'string' && PROC_NAME.test(v) && WORDS.test(v) && !bad(v) ? v : null)
  const place = (v) => (typeof v === 'string' && v.length < 240 && SYSTEM_PATH.test(v) && noDots(v) && !bad(v) ? v : null)
  return {
    os: src.os === 'mac' || src.os === 'windows' ? src.os : 'other',
    macos: typeof src.macos === 'string' && /^\d{1,2}$/.test(src.macos) ? src.macos : null,
    extensions: clean(src.extensions, (e) => {
      const entry = cleanExtension(e)
      return entry && !Object.values(entry).some(bad) ? entry : null
    }, 8),
    processes: clean(src.processes, name, 12),
    installed: clean(src.installed, (c) => {
      const p = c && place(c.path)
      return p ? { path: p, libs: clean(c.libs, place, WALK.libs) || [] } : null
    }, WALK.candidates),
    services: clean(src.services, (s) => (s && name(s.name) && SVC_STATE.has(s.state) ? { name: s.name, state: s.state } : null), 8)
  }
}

// Runs the probes for this platform. Each one fails alone: its section is then null.
async function collectDiagnostics({ execFile, fs, platform = process.platform, release = '', user = '', env = process.env, now = Date.now }) {
  const run = (file, args, servicePage = false) => new Promise((resolve) => {
    try {
      execFile(file, args, { timeout: PROBE_MS, maxBuffer: 1024 * 1024, windowsHide: true, encoding: 'utf8' },
        (err, stdout) => {
          const partial = servicePage && typeof stdout === 'string' && SERVICE_CONTINUATION.test(stdout)
          resolve(typeof stdout !== 'string' || (err && !partial) ? null : stdout)
        })
    } catch (_e) { resolve(null) }
  })
  const guard = async (fn) => { try { return await fn() } catch (_e) { return null } }
  const raw = { os: 'other', macos: null, extensions: null, processes: null, installed: null, services: null }
  if (platform === 'darwin') {
    raw.os = 'mac'
    raw.macos = macMajor(release)
    raw.extensions = await guard(async () => { const t = await run('/usr/bin/systemextensionsctl', ['list']); return t === null ? null : parseExtensions(t) })
    raw.processes = await guard(async () => { const t = await run('/bin/ps', ['-axo', 'comm=']); return t === null ? null : parseProcessNames(t) })
    raw.installed = await guard(async () => findCandidates({ fs, now }))
  } else if (platform === 'win32') {
    raw.os = 'windows'
    const sys = path.win32.join(env.SystemRoot || 'C:\\Windows', 'System32')
    raw.services = await guard(async () => {
      const services = new Map()
      let resume = 0
      for (let page = 0; page < SERVICE_PAGES; page++) {
        const args = ['query', 'state=', 'all', 'bufsize=', String(SERVICE_BUFFER)]
        if (resume) args.push('ri=', String(resume))
        const t = await run(path.win32.join(sys, 'sc.exe'), args, true)
        if (t === null) return null
        for (const service of parseServices(t)) services.set(service.name, service)
        const continuation = SERVICE_CONTINUATION.exec(t)
        if (!continuation) return [...services.values()].slice(0, 8)
        const next = Number(continuation[1])
        if (!Number.isSafeInteger(next) || next <= resume || services.size >= 8) break
        resume = next
      }
      return [...services.values()].slice(0, 8)
    })
    raw.processes = await guard(async () => { const t = await run(path.win32.join(sys, 'tasklist.exe'), ['/fo', 'csv', '/nh']); return t === null ? null : parseTasklist(t) })
  }
  return sanitizeDiagnostics(raw, user)
}

module.exports = { sanitize, helperPath, createAirwaveBridge, collectDiagnostics, sanitizeDiagnostics, parseExtensions, parseProcessNames, parseTasklist, parseServices, findCandidates, macMajor }
