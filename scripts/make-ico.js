// assets/icon.png -> assets/icon.ico, the Windows build's icon (scripts/package-win.js).
// The .ico is committed, so a Windows build needs no image tools; run this on a Mac (it
// resizes with sips) after changing icon.png. Sizes up to 64 px are stored as 32-bit
// bitmaps (a DIB with an alpha channel plus the 1-bit AND mask), as Electron's own exe
// and Windows' icons do, since some older code and icon caches handle small PNG icons
// poorly; 128 and 256 px stay PNG, which Windows Vista and later read.
// Usage: node scripts/make-ico.js [icon.png] [icon.ico]
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const zlib = require('node:zlib')
const { execFileSync } = require('node:child_process')

const ROOT = path.join(__dirname, '..')
const SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256]
const BMP_UP_TO = 64

// An 8-bit, non-interlaced RGB or RGBA PNG (what sips writes) as { width, height, rgba }
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47 || buf.readUInt32BE(4) !== 0x0d0a1a0a) throw new Error('not a PNG')
  let width, height, depth, type, interlace
  const idat = []
  for (let p = 8; p < buf.length;) {
    const len = buf.readUInt32BE(p), kind = buf.toString('latin1', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len)
    if (kind === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); depth = data[8]; type = data[9]; interlace = data[12] }
    else if (kind === 'IDAT') idat.push(data)
    else if (kind === 'IEND') break
    p += 12 + len
  }
  if (depth !== 8 || (type !== 6 && type !== 2) || interlace !== 0) throw new Error(`unsupported PNG: depth ${depth}, colour type ${type}, interlace ${interlace}`)
  const bpp = type === 6 ? 4 : 3
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const stride = width * bpp
  const px = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    const out = px.subarray(y * stride, (y + 1) * stride)
    const prev = y ? px.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride)
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0
      let v
      if (filter === 0) v = 0
      else if (filter === 1) v = a
      else if (filter === 2) v = b
      else if (filter === 3) v = (a + b) >> 1
      else if (filter === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v = pa <= pb && pa <= pc ? a : pb <= pc ? b : c }
      else throw new Error('bad PNG filter ' + filter)
      out[x] = (line[x] + v) & 0xff
    }
  }
  if (bpp === 4) return { width, height, rgba: px }
  const rgba = Buffer.alloc(width * height * 4)
  for (let i = 0; i < width * height; i++) { px.copy(rgba, i * 4, i * 3, i * 3 + 3); rgba[i * 4 + 3] = 255 }
  return { width, height, rgba }
}

// An icon image as a 32-bit DIB: BITMAPINFOHEADER (height doubled for the mask), BGRA rows
// bottom-up, then the AND mask (1 = transparent), rows padded to 4 bytes
function dibFromRgba(width, height, rgba) {
  const maskStride = Math.ceil(width / 32) * 4
  const head = Buffer.alloc(40)
  head.writeUInt32LE(40, 0)
  head.writeInt32LE(width, 4)
  head.writeInt32LE(height * 2, 8)
  head.writeUInt16LE(1, 12)                  // planes
  head.writeUInt16LE(32, 14)                 // bits per pixel
  head.writeUInt32LE(0, 16)                  // BI_RGB
  head.writeUInt32LE(width * height * 4 + maskStride * height, 20)
  const pixels = Buffer.alloc(width * height * 4)
  const mask = Buffer.alloc(maskStride * height)
  for (let y = 0; y < height; y++) {
    const row = height - 1 - y
    for (let x = 0; x < width; x++) {
      const s = (y * width + x) * 4, d = (row * width + x) * 4
      pixels[d] = rgba[s + 2]; pixels[d + 1] = rgba[s + 1]; pixels[d + 2] = rgba[s]; pixels[d + 3] = rgba[s + 3]
      if (rgba[s + 3] === 0) mask[row * maskStride + (x >> 3)] |= 0x80 >> (x & 7)
    }
  }
  return Buffer.concat([head, pixels, mask])
}

// The .ico file for images [{ size, data }] (data: PNG or DIB bytes)
function icoFile(images) {
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
  return Buffer.concat([header, dir, ...images.map((im) => im.data)])
}

function main() {
  const src = process.argv[2] || path.join(ROOT, 'assets/icon.png')
  const out = process.argv[3] || path.join(ROOT, 'assets/icon.ico')
  if (process.platform !== 'darwin') { console.error('make-ico.js resizes with macOS sips: run it on a Mac'); process.exit(1) }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'keylight-ico-'))
  let images
  try {
    images = SIZES.map((size) => {
      const file = path.join(tmp, size + '.png')
      execFileSync('/usr/bin/sips', ['-s', 'format', 'png', '-z', String(size), String(size), src, '--out', file], { stdio: 'ignore' })
      const png = fs.readFileSync(file)
      if (size > BMP_UP_TO) return { size, data: png, kind: 'png' }
      const { width, height, rgba } = decodePng(png)
      if (width !== size || height !== size) throw new Error(`sips made ${width}x${height}, not ${size}x${size}`)
      return { size, data: dibFromRgba(size, size, rgba), kind: 'bmp' }
    })
  } finally { fs.rmSync(tmp, { recursive: true, force: true }) }
  fs.writeFileSync(out, icoFile(images))
  console.log(`${path.relative(process.cwd(), out)}: ${images.map((im) => im.size + ':' + im.kind).join(' ')}, ${fs.statSync(out).size} bytes`)
}

module.exports = { SIZES, BMP_UP_TO, decodePng, dibFromRgba, icoFile }

if (require.main === module) main()
