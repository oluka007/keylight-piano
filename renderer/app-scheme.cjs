// The desktop page's own address: keylight://app/. Browser storage (progress, settings,
// imported songs) belongs to the page's origin, and this origin never changes, whatever
// happens to local ports. It used to be http://127.0.0.1:47821, which moved to a random
// port whenever 47821 was taken (renderer/origin-migration.cjs moves the data across once).
//
// Files are served from the renderer folder only, the same files the HTTP server served,
// with the same Content-Type and no other headers. No Electron imports here, so
// scripts/test-origin-migration.js runs these rules under plain Node.
const fs = require('node:fs')
const path = require('node:path')

const SCHEME = 'keylight'
const HOST = 'app'
const APP_ORIGIN = `${SCHEME}://${HOST}`

// Privileges: a standard, secure scheme gets an origin of its own (localStorage, IndexedDB),
// counts as a secure context (Web MIDI with SysEx, the camera, MediaRecorder) and can be read
// with fetch(). Nothing here bypasses CSP, allows service workers or lets other origins read it.
const PRIVILEGES = { standard: true, secure: true, supportFetchAPI: true, stream: true, codeCache: true }

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.mid': 'audio/midi', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.xml': 'application/xml', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.task': 'application/octet-stream', '.bin': 'application/octet-stream' }
const contentType = (file) => TYPES[path.extname(file)] || 'application/octet-stream'

// True only for keylight://app/... (no user name, password or port). Node's URL gives a
// non-special scheme the origin "null", so this reads the parts instead of .origin.
function isAppUrl(value) {
  if (typeof value !== 'string') return false
  try {
    const u = new URL(value)
    return u.protocol === SCHEME + ':' && u.host === HOST && !u.username && !u.password && !u.port
  } catch (_e) { return false }
}

// Which file a request asks for: { status: 200, file } or { status: 400 | 403 | 404 }.
// root is the renderer folder; realRoot its real path (symlinks resolved). A file must be a
// regular file whose real path is inside realRoot, so ../, encoded separators (%2f, %5c),
// symlinks pointing out and folders are all refused.
function resolveAppFile(url, root, realRoot = root) {
  let u
  try { u = new URL(url) } catch (_e) { return { status: 400 } }
  if (u.protocol !== SCHEME + ':' || u.host !== HOST || u.username || u.password || u.port) return { status: 403 }
  let rel
  try { rel = decodeURIComponent(u.pathname) } catch (_e) { return { status: 400 } }
  if (rel.includes('\0')) return { status: 400 }
  // after decoding, a backslash is a separator on Windows: refuse it everywhere
  if (rel.includes('\\')) return { status: 404 }
  const file = path.join(root, rel === '/' ? 'index.html' : rel)
  if (!file.startsWith(root + path.sep)) return { status: 404 }
  let real, stat
  try { real = fs.realpathSync(file); stat = fs.statSync(real) } catch (_e) { return { status: 404 } }
  if (!real.startsWith(realRoot + path.sep) || !stat.isFile()) return { status: 404 }
  return { status: 200, file: real, type: contentType(real) }
}

// The protocol.handle callback: a Response for each request (GET and HEAD only).
function createAppHandler({ root, Readable }) {
  const realRoot = fs.realpathSync(root)
  return (request) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('method not allowed', { status: 405 })
    const found = resolveAppFile(request.url, root, realRoot)
    if (found.status !== 200) return new Response(found.status === 400 ? 'bad request' : 'not found', { status: found.status })
    const body = request.method === 'HEAD' ? null : Readable.toWeb(fs.createReadStream(found.file))
    return new Response(body, { status: 200, headers: { 'Content-Type': found.type } })
  }
}

module.exports = { SCHEME, HOST, APP_ORIGIN, PRIVILEGES, TYPES, contentType, isAppUrl, resolveAppFile, createAppHandler }
