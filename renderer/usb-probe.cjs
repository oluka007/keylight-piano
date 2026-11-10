// "Support my device": what the operating system says about USB music keyboards, read in the
// main process and handed to the page. Only the fields a device profile needs leave this file:
// vendor id, product id, product and maker strings, the device release (bcdDevice) and class.
// Serial numbers, location ids (they reveal which port the cable is in), instance paths and
// anything under a home folder never do. The tools run without a shell, with fixed arguments,
// a short timeout and a size cap, and any failure reads as "not available".
const os = require('node:os')
const fs = require('node:fs')
const path = require('node:path')

const MAX_DEVICES = 40
const MAX_DEPTH = 12
const MAX_NODES = 2000
const MAX_TEXT = 80
const MAX_OUTPUT = 2_000_000
const TIMEOUT_MS = 6000

// The probe does not guess which devices matter: it lists every USB device that is not a hub and
// not an Apple part (the Mac's own keyboard, trackpad, camera, hubs), and the person ticks the ones
// to include. Only what they tick leaves the page.
const HUB = /\bhubs?\b|root hub|host controller/i
const APPLE_VENDOR = 0x05ac

// The shared sanitiser (renderer/sanitize-text.js, also used for the report) is an ES module, loaded
// once before any probe. Until it has loaded a string comes out empty: it fails closed.
let sanitize = null
let names = []
async function ready() {
  if (!sanitize) sanitize = (await import(require('node:url').pathToFileURL(path.join(__dirname, 'sanitize-text.js')).href)).sanitizeText
}
function cleanText(value) { return sanitize ? sanitize(value, MAX_TEXT, { redact: names }) : '' }
function hex4(value) {
  const n = typeof value === 'number' ? value : parseInt(String(value).trim(), /^0x/i.test(String(value).trim()) ? 16 : 10)
  return Number.isInteger(n) && n >= 0 && n <= 0xffff ? '0x' + n.toString(16).padStart(4, '0') : ''
}
const hexIn = (value) => { const m = /0x([0-9a-f]{1,4})\b/i.exec(String(value || '')); return m ? hex4('0x' + m[1]) : '' }
function bcd(value) {
  if (typeof value === 'number') return Number.isInteger(value) && value >= 0 && value <= 0xffff ? (value >> 8) + '.' + (value & 0xff).toString(16).padStart(2, '0') : ''
  const t = String(value == null ? '' : value).trim()
  if (/^0x[0-9a-f]{1,4}$/i.test(t)) return bcd(parseInt(t, 16))
  return /^\d{1,3}\.\d{1,3}$/.test(t) ? t : ''
}

function shape(raw) {
  return {
    vendorId: raw.vendorId || '', productId: raw.productId || '',
    product: cleanText(raw.product), manufacturer: cleanText(raw.manufacturer),
    bcdDevice: raw.bcdDevice || '', class: cleanText(raw.class)
  }
}
function keep(raw) {
  if (!raw.vendorId || !raw.productId) return false
  if (raw.apple || parseInt(raw.vendorId, 16) === APPLE_VENDOR || /^apple\b/i.test(raw.manufacturer || '')) return false
  if (raw.hub || HUB.test(raw.product || '')) return false
  return true
}
function finish(list) {
  const seen = new Set()
  const out = []
  for (const raw of list) {
    if (!keep(raw)) continue
    const item = shape(raw)
    const key = [item.vendorId, item.productId, item.product].join('|')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
    if (out.length >= MAX_DEVICES) break
  }
  return out
}

// system_profiler SPUSBDataType -json: a tree of _items (host controller -> hub -> hub -> device, at any
// depth). Walked with an explicit stack, so no nesting can overflow it; depth and node count are capped.
// A key can be missing anywhere; serial_num and location_id are read by nobody here.
// roots are counted before anything is allocated: a huge array costs one pass over MAX_NODES entries at most
const profilerRoots = (data) => {
  const roots = []
  if (data && typeof data === 'object') {
    for (const key of Object.keys(data).slice(0, 20)) {
      if (!/^SPUSB/i.test(key) || !Array.isArray(data[key])) continue
      const list = data[key]
      for (let i = 0; i < list.length && roots.length < MAX_NODES; i++) roots.push(list[i])
    }
  }
  return roots
}
const vendorOf = (value) => (typeof value === 'number' ? hex4(value) : hexIn(value))
const makerFromVendor = (value) => { const m = /\(([^)]+)\)/.exec(String(value || '')); return m ? m[1].trim() : '' }
function parseMacProfiler(text) {
  try { return parseMacProfilerUnsafe(text) } catch (_e) { return null }
}
function parseMacProfilerUnsafe(text) {
  let data
  try { data = JSON.parse(text) } catch (_e) { return null }
  if (!data || typeof data !== 'object') return null
  const found = []
  const stack = profilerRoots(data).reverse().map((node) => ({ node, depth: 0 }))   // at most MAX_NODES
  let seen = 0
  while (stack.length && seen < MAX_NODES) {
    const { node: item, depth } = stack.pop()
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    seen++
    const children = Array.isArray(item._items) ? item._items : []
    const vendorText = String(item.vendor_id == null ? '' : item.vendor_id)
    found.push({
      vendorId: vendorOf(item.vendor_id), productId: vendorOf(item.product_id),
      product: typeof item._name === 'string' ? item._name : '',
      manufacturer: typeof item.manufacturer === 'string' && item.manufacturer ? item.manufacturer : makerFromVendor(vendorText),
      bcdDevice: bcd(item.bcd_device), class: item.device_class || (item.Media ? 'audio' : ''),
      hub: children.length > 0, apple: /apple_vendor_id/i.test(vendorText)
    })
    if (depth < MAX_DEPTH) {
      const room = Math.max(0, MAX_NODES - seen - stack.length)       // never queue more than can still be visited
      for (let i = Math.min(children.length, room) - 1; i >= 0; i--) stack.push({ node: children[i], depth: depth + 1 })
    }
  }
  return finish(found)
}

// ioreg -p IOUSB -l -w0: one block per device, each property on its own line
function parseIoreg(text) {
  const found = []
  for (const block of String(text || '').split(/^[\s|]*\+-o /m).slice(1)) {
    const num = (key) => { const m = new RegExp('"' + key + '"\\s*=\\s*(\\d+)').exec(block); return m ? Number(m[1]) : NaN }
    const str = (key) => { const m = new RegExp('"' + key + '"\\s*=\\s*"([^"]*)"').exec(block); return m ? m[1] : '' }
    const cls = num('bDeviceClass')
    found.push({
      vendorId: hex4(num('idVendor')), productId: hex4(num('idProduct')),
      product: str('USB Product Name') || str('kUSBProductString') || block.split(/[@\s<]/)[0],
      manufacturer: str('USB Vendor Name') || str('kUSBVendorString'),
      bcdDevice: bcd(num('bcdDevice')), class: cls === 1 ? 'audio' : ''
    })
  }
  return finish(found)
}

// Get-PnpDevice ... | ConvertTo-Json: the instance id carries VID, PID and (after the last
// backslash) a serial or a port path: only the first two are read
function parsePowerShell(text) {
  let data
  try { data = JSON.parse(text) } catch (_e) { return null }
  const rows = Array.isArray(data) ? data : data && typeof data === 'object' ? [data] : []
  const found = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const id = String(row.InstanceId || '')
    const m = /^USB\\VID_([0-9A-F]{4})&PID_([0-9A-F]{4})(?:&REV_([0-9A-F]{4}))?/i.exec(id)
    if (!m) continue
    const rev = m[3] ? parseInt(m[3], 16) : NaN
    found.push({
      vendorId: hex4('0x' + m[1]), productId: hex4('0x' + m[2]),
      product: row.FriendlyName || row.Name, manufacturer: row.Manufacturer,
      bcdDevice: bcd(rev), class: /^MEDIA$/i.test(row.Class || '') ? 'audio' : String(row.Class || '')
    })
  }
  return finish(found)
}

const POWERSHELL_SCRIPT = 'Get-PnpDevice -PresentOnly -Class MEDIA,USB | Select-Object FriendlyName,Manufacturer,InstanceId,Class | ConvertTo-Json -Compress'
// Tools are named by absolute path (never looked up on PATH, which a program in the working
// folder or a changed PATH could hijack). The Windows path is built from SystemRoot.
function windowsPowerShell(env = process.env) {
  const root = env.SystemRoot || env.SYSTEMROOT || env.windir || 'C:\\Windows'
  return path.win32.join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
}
function commandsFor(platform, env = process.env) {
  if (platform === 'darwin') return [
    { cmd: '/usr/sbin/system_profiler', args: ['SPUSBDataType', '-json'], parse: parseMacProfiler, source: 'system_profiler' },
    { cmd: '/usr/sbin/ioreg', args: ['-p', 'IOUSB', '-l', '-w0'], parse: parseIoreg, source: 'ioreg' }
  ]
  if (platform === 'win32') return [
    { cmd: windowsPowerShell(env), args: ['-NoProfile', '-NonInteractive', '-Command', POWERSHELL_SCRIPT], parse: parsePowerShell, source: 'Get-PnpDevice' }
  ]
  return []
}

// resolves { text } or { reason } with a short plain reason; never rejects
function run(spawn, { cmd, args }, { timeoutMs = TIMEOUT_MS, maxBytes = MAX_OUTPUT } = {}) {
  return new Promise((resolve) => {
    let out = '', size = 0, settled = false, child
    const end = (value) => { if (settled) return; settled = true; clearTimeout(timer); resolve(value) }
    const timer = setTimeout(() => { try { child && child.kill() } catch (_e) {} end({ reason: 'timed out' }) }, timeoutMs)
    try { child = spawn(cmd, args, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }) } catch (_e) { end({ reason: 'could not start' }); return }
    child.on('error', () => end({ reason: 'could not start' }))
    child.stdout.on('data', (chunk) => {
      size += chunk.length
      if (size > maxBytes) { try { child.kill() } catch (_e) {} end({ reason: 'output too large' }); return }
      out += chunk
    })
    child.on('close', (code) => end(code === 0 ? { text: out } : { reason: 'tool failed' }))
  })
}

// The real macOS version ("27.0"): the kernel number alone does not tell a person which macOS they run.
// On Windows the OS's own name string ("Windows 11 Pro"). Fail soft: '' when unknown.
async function readOsVersion({ spawn, platform, exists, options }) {
  try {
    if (platform === 'win32') return typeof os.version === 'function' ? cleanText(os.version()).slice(0, 40) : ''
    if (platform !== 'darwin' || !exists(SW_VERS)) return ''
    const res = await run(spawn, { cmd: SW_VERS, args: ['-productVersion'] }, { timeoutMs: Math.min(2000, (options && options.timeoutMs) || 2000), maxBytes: 200 })
    const v = String(res.text || '').trim()
    return /^\d{1,3}(\.\d{1,3}){0,2}$/.test(v) ? v : ''
  } catch (_e) { return '' }
}
const SW_VERS = '/usr/bin/sw_vers'

// resolves { ok, devices, source, os: { platform, release, arch }, redact: [names] }: never rejects
async function collectUsb(args = {}) {
  try { return await collectUsbUnsafe(args) } catch (_e) {
    return { ok: false, devices: [], source: '', reason: 'unexpected error', os: { platform: String(args.platform || process.platform), release: '', arch: '', version: '' }, redact: [] }
  }
}
async function collectUsbUnsafe({ spawn, platform = process.platform, options, env = process.env, exists = fs.existsSync } = {}) {
  await ready()
  const info = { platform, release: String(os.release()).slice(0, 40), arch: os.arch(), version: '' }
  // names this computer knows, for the page to blank out of free text: they are never put in the report
  const redact = []
  try {
    const host = os.hostname()
    redact.push(os.userInfo().username, path.basename(os.homedir()), host, String(host).split('.')[0])
  } catch (_e) {}
  const known = [...new Set(redact.filter((name) => name && name.length >= 3))]
  redact.length = 0; redact.push(...known)
  names = known
  const result = { ok: false, devices: [], source: '', reason: platform === 'darwin' || platform === 'win32' ? 'tool not found' : 'not supported on this system', os: info, redact }
  let firstReason = ''
  for (const command of commandsFor(platform, env)) {
    if (!exists(command.cmd)) { firstReason = firstReason || 'tool not found'; continue }
    const res = await run(spawn, command, options)
    let devices = null
    try { devices = res.text == null ? null : command.parse(res.text) } catch (_e) { devices = null }
    if (devices) { result.ok = true; result.devices = devices; result.source = command.source; result.reason = ''; break }
    firstReason = firstReason || res.reason || 'unreadable output'
  }
  if (!result.ok && firstReason) result.reason = firstReason
  info.version = await readOsVersion({ spawn, platform, exists, options })
  return result
}

// One probe at a time, and at most one per cooldown: a page that asks again gets the same answer.
function createCachedCollect(collect, { cooldownMs = 3000, now = Date.now } = {}) {
  let inflight = null, last = null, at = -Infinity
  return () => {
    if (inflight) return inflight
    if (last && now() - at < cooldownMs) return Promise.resolve(last)
    inflight = Promise.resolve().then(collect).then((result) => { last = result; at = now(); return result }).finally(() => { inflight = null })
    return inflight
  }
}

// The only IPC the feature has: no arguments at all, and only the app's own page may ask.
function createProbeHandler({ own, collect }) {
  return (event, ...args) => {
    const url = event && event.senderFrame && event.senderFrame.url
    if (args.length !== 0 || !own(url)) return { ok: false, devices: [], source: '', reason: 'refused' }
    return collect()
  }
}

module.exports = { parseMacProfiler, parseIoreg, parsePowerShell, collectUsb, createProbeHandler, createCachedCollect, commandsFor, windowsPowerShell, cleanText, ready }
