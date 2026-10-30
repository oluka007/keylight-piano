// Flip Electron's build-time fuses in a copied app, without @electron/fuses.
// The fuse wire sits in one binary after a fixed sentinel: on macOS the Electron Framework
// inside the bundle, on Windows the exe itself.
//   <sentinel><version byte><length byte><one byte per fuse: '0' off, '1' on, 'r' removed>
// Fuse order (FuseV1Options): 0 RunAsNode, 1 EnableCookieEncryption,
// 2 EnableNodeOptionsEnvironmentVariable, 3 EnableNodeCliInspectArguments,
// 4 EnableEmbeddedAsarIntegrityValidation, 5 OnlyLoadAppFromAsar,
// 6 LoadBrowserProcessSpecificV8Snapshot, 7 GrantFileProtocolExtraPrivileges.
// Usage: node flip-fuses.js /path/to/App.app     (macOS; run before codesign)
//        node flip-fuses.js /path/to/Keylight.exe (Windows; run after the exe's resources are set)
const fs = require('node:fs')
const path = require('node:path')

const SENTINEL = 'dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX'
const OFF = 0x30
const TURN_OFF = { RunAsNode: 0, EnableNodeOptionsEnvironmentVariable: 2, EnableNodeCliInspectArguments: 3 }

// Where the fuse wire of a buffer starts, and its length; throws when it is missing,
// repeated or of an unknown version.
function findWire(buf, name) {
  const at = buf.indexOf(SENTINEL, 0, 'latin1')
  if (at < 0) throw new Error('fuse sentinel not found in ' + name)
  if (buf.indexOf(SENTINEL, at + 1, 'latin1') >= 0) throw new Error('more than one fuse sentinel in ' + name)
  const version = buf[at + SENTINEL.length]
  const length = buf[at + SENTINEL.length + 1]
  if (version !== 1 || length < 4) throw new Error('unexpected fuse wire in ' + name + ': version ' + version + ' length ' + length)
  return { base: at + SENTINEL.length + 2, length }
}

// The wire as text, e.g. '000000011'
function readFuses(buf, name = 'the binary') {
  const { base, length } = findWire(buf, name)
  return buf.toString('latin1', base, base + length)
}

// Turns RunAsNode, NODE_OPTIONS and --inspect off in the buffer (in place); returns the wire.
function flipFusesInBuffer(buf, name = 'the binary') {
  const { base, length } = findWire(buf, name)
  for (const i of Object.values(TURN_OFF)) {
    if (buf[base + i] === 0x72) continue   // removed from this build: nothing to do
    buf[base + i] = OFF
  }
  return buf.toString('latin1', base, base + length)
}

// The binary holding the fuses: an .app bundle's framework, or the file itself
function fuseBinary(target) {
  return fs.statSync(target).isDirectory()
    ? path.join(target, 'Contents/Frameworks/Electron Framework.framework/Versions/A/Electron Framework')
    : target
}

function flipFuses(target) {
  const bin = fuseBinary(target)
  const buf = fs.readFileSync(bin)
  const state = flipFusesInBuffer(buf, bin)
  fs.writeFileSync(bin, buf)
  return state
}

module.exports = { SENTINEL, TURN_OFF, readFuses, flipFusesInBuffer, flipFuses, fuseBinary }

if (require.main === module) {
  const target = process.argv[2]
  if (!target) { console.error('usage: flip-fuses.js <App.app | app.exe>'); process.exit(2) }
  try {
    console.log('fuses: ' + flipFuses(target) + ' (RunAsNode, NodeOptions and --inspect are off)')
  } catch (e) { console.error(e.message); process.exit(1) }
}
