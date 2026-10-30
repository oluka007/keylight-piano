// Flip Electron's build-time fuses in a copied app bundle, without @electron/fuses.
// The fuse wire sits in the Electron Framework binary after a fixed sentinel:
//   <sentinel><version byte><length byte><one byte per fuse: '0' off, '1' on, 'r' removed>
// Fuse order (FuseV1Options): 0 RunAsNode, 1 EnableCookieEncryption,
// 2 EnableNodeOptionsEnvironmentVariable, 3 EnableNodeCliInspectArguments,
// 4 EnableEmbeddedAsarIntegrityValidation, 5 OnlyLoadAppFromAsar,
// 6 LoadBrowserProcessSpecificV8Snapshot, 7 GrantFileProtocolExtraPrivileges.
// Usage: node flip-fuses.js /path/to/App.app   (run before codesign)
const fs = require('node:fs')
const path = require('node:path')

const SENTINEL = 'dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX'
const OFF = 0x30
const TURN_OFF = { RunAsNode: 0, EnableNodeOptionsEnvironmentVariable: 2, EnableNodeCliInspectArguments: 3 }

const app = process.argv[2]
if (!app) { console.error('usage: flip-fuses.js <App.app>'); process.exit(2) }
const bin = path.join(app, 'Contents/Frameworks/Electron Framework.framework/Versions/A/Electron Framework')
const buf = fs.readFileSync(bin)
const at = buf.indexOf(SENTINEL, 0, 'latin1')
if (at < 0) { console.error('fuse sentinel not found in ' + bin); process.exit(1) }
const version = buf[at + SENTINEL.length]
const length = buf[at + SENTINEL.length + 1]
if (version !== 1 || length < 4) { console.error('unexpected fuse wire: version ' + version + ' length ' + length); process.exit(1) }
const base = at + SENTINEL.length + 2
for (const [name, i] of Object.entries(TURN_OFF)) {
  if (buf[base + i] === 0x72) continue   // removed from this build: nothing to do
  buf[base + i] = OFF
}
fs.writeFileSync(bin, buf)
const state = Array.from(buf.subarray(base, base + length), (b) => String.fromCharCode(b)).join('')
console.log('fuses: ' + state + ' (RunAsNode, NodeOptions and --inspect are off)')
