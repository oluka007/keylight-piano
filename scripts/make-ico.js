// assets/icon.png -> assets/icon.ico, the Windows build's icon (scripts/package-win.js).
// The .ico is committed, so a Windows build needs no image tools; run this on a Mac (it
// resizes with sips) after changing icon.png. Every size is stored as a PNG, which
// Windows Vista and later read at all sizes.
// Usage: node scripts/make-ico.js [icon.png] [icon.ico]
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const ROOT = path.join(__dirname, '..')
const src = process.argv[2] || path.join(ROOT, 'assets/icon.png')
const out = process.argv[3] || path.join(ROOT, 'assets/icon.ico')
const SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256]

if (process.platform !== 'darwin') { console.error('make-ico.js resizes with macOS sips: run it on a Mac'); process.exit(1) }
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'keylight-ico-'))
let images
try {
  images = SIZES.map((size) => {
    const file = path.join(tmp, size + '.png')
    execFileSync('/usr/bin/sips', ['-s', 'format', 'png', '-z', String(size), String(size), src, '--out', file], { stdio: 'ignore' })
    return { size, data: fs.readFileSync(file) }
  })
} finally { fs.rmSync(tmp, { recursive: true, force: true }) }

const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0)               // reserved
header.writeUInt16LE(1, 2)               // 1 = icon
header.writeUInt16LE(images.length, 4)
const dir = Buffer.alloc(16 * images.length)
let offset = header.length + dir.length
images.forEach((im, i) => {
  const o = i * 16
  dir[o] = im.size >= 256 ? 0 : im.size  // 0 means 256
  dir[o + 1] = im.size >= 256 ? 0 : im.size
  dir.writeUInt16LE(1, o + 4)            // colour planes
  dir.writeUInt16LE(32, o + 6)           // bits per pixel
  dir.writeUInt32LE(im.data.length, o + 8)
  dir.writeUInt32LE(offset, o + 12)
  offset += im.data.length
})
fs.writeFileSync(out, Buffer.concat([header, dir, ...images.map((im) => im.data)]))
console.log(`${path.relative(process.cwd(), out)}: ${images.length} sizes (${SIZES.join(', ')}), ${fs.statSync(out).size} bytes`)
