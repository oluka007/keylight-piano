// Draws a stand-in app icon (1024x1024 PNG) for scripts/make-icon.sh when
// assets/icon.png is missing: a purple rounded square with notes falling onto
// lit keys. Plain Node (zlib only), so the build needs no image tools.
// usage: node scripts/placeholder-icon.js <out.png>
const fs = require('node:fs')
const zlib = require('node:zlib')

const S = 1024
const px = new Float32Array(S * S * 4) // premultiplied RGBA, 0..1

const hex = (h, a = 1) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).concat(a)
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t)
const clamp01 = (v) => Math.min(1, Math.max(0, v))

// signed distance to a rounded rectangle (negative inside)
function roundRectDistance(x, y, x0, y0, x1, y1, r) {
  const qx = Math.abs(x - (x0 + x1) / 2) - (x1 - x0) / 2 + r
  const qy = Math.abs(y - (y0 + y1) / 2) - (y1 - y0) / 2 + r
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
}

// Paints a rounded rectangle over what is there. color(x, y) -> [r, g, b, a];
// soft is the width of the edge in pixels: 1 is a crisp anti-aliased edge, more is a glow.
function roundRect(x0, y0, x1, y1, r, color, soft = 1) {
  const pad = Math.ceil(soft)
  for (let y = Math.max(0, Math.floor(y0 - pad)); y < Math.min(S, Math.ceil(y1 + pad)); y++) {
    for (let x = Math.max(0, Math.floor(x0 - pad)); x < Math.min(S, Math.ceil(x1 + pad)); x++) {
      const cover = clamp01(0.5 - roundRectDistance(x + 0.5, y + 0.5, x0, y0, x1, y1, r) / soft)
      if (cover === 0) continue
      const [cr, cg, cb, ca] = color(x + 0.5, y + 0.5)
      const a = ca * cover
      const i = (y * S + x) * 4
      px[i] = cr * a + px[i] * (1 - a)
      px[i + 1] = cg * a + px[i + 1] * (1 - a)
      px[i + 2] = cb * a + px[i + 2] * (1 - a)
      px[i + 3] = a + px[i + 3] * (1 - a)
    }
  }
}
const solid = (c) => () => c
const vertical = (y0, y1, top, bottom) => (_x, y) => mix(top, bottom, clamp01((y - y0) / (y1 - y0)))

// body: the macOS icon grid's 824 px rounded square, with a soft shadow; the app's purples
roundRect(100, 114, 924, 938, 185, solid([0, 0, 0, 0.4]), 44)
roundRect(100, 100, 924, 924, 185, (_x, y) => {
  const t = (y - 100) / 824
  return t < 0.5 ? mix(hex('#9a74ff'), hex('#5530d9'), t / 0.5) : mix(hex('#5530d9'), hex('#23165e'), (t - 0.5) / 0.5)
})
roundRect(100, 100, 924, 924, 185, (_x, y) => [1, 1, 1, 0.12 * clamp01(1 - (y - 100) / 320)])

// one octave of keys; keys 2 and 4 are lit by the notes falling onto them
const KEYS_X0 = 168, KEYS_X1 = 856, KEYS_TOP = 612, KEYS_BOTTOM = 858, GAP = 10
const keyW = (KEYS_X1 - KEYS_X0 - 6 * GAP) / 7
const keyCenter = (k) => KEYS_X0 + k * (keyW + GAP) + keyW / 2
const notes = [
  { key: 0, top: 196, bottom: 360, color: hex('#F47676'), lit: false },
  { key: 2, top: 268, bottom: 584, color: hex('#47CEE1'), lit: true },
  { key: 4, top: 404, bottom: 584, color: hex('#F2B363'), lit: true }
]

// hit line where the notes meet the keys
roundRect(KEYS_X0 - 8, 592, KEYS_X1 + 8, 600, 4, solid([1, 1, 1, 0.35]), 14)

for (const n of notes) {
  const cx = keyCenter(n.key)
  roundRect(cx - 34, n.top, cx + 34, n.bottom, 34, solid([...n.color.slice(0, 3), 0.45]), 40)
  roundRect(cx - 34, n.top, cx + 34, n.bottom, 34, vertical(n.top, n.bottom, mix(n.color, [1, 1, 1, 1], 0.1), mix(n.color, [1, 1, 1, 1], 0.45)))
}

const white = hex('#f6f3ff')
for (let k = 0; k < 7; k++) {
  const x0 = KEYS_X0 + k * (keyW + GAP)
  const note = notes.find((n) => n.lit && n.key === k)
  const color = note ? vertical(KEYS_TOP, KEYS_BOTTOM, mix(note.color, white, 0.25), mix(note.color, white, 0.7)) : solid(white)
  if (note) roundRect(x0, KEYS_TOP, x0 + keyW, KEYS_BOTTOM, 16, solid([...note.color.slice(0, 3), 0.6]), 36)
  roundRect(x0, KEYS_TOP, x0 + keyW, KEYS_BOTTOM, 16, color)
}
for (const k of [0, 1, 3, 4, 5]) {
  const cx = KEYS_X0 + (k + 1) * (keyW + GAP) - GAP / 2
  roundRect(cx - 29, KEYS_TOP - 2, cx + 29, KEYS_TOP + 150, 10, vertical(KEYS_TOP, KEYS_TOP + 150, hex('#140d33'), hex('#2a1c63')))
}

// ---- PNG encoding ---------------------------------------------------------------
const CRC = new Int32Array(256).map((_v, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c
})
function crc32(buf) {
  let c = -1
  for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  data.copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}

const raw = Buffer.alloc((S * 4 + 1) * S) // each row: filter byte 0, then straight-alpha RGBA
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4
    const o = y * (S * 4 + 1) + 1 + x * 4
    const a = px[i + 3]
    for (let c = 0; c < 3; c++) raw[o + c] = a > 0 ? Math.round(clamp01(px[i + c] / a) * 255) : 0
    raw[o + 3] = Math.round(clamp01(a) * 255)
  }
}
const header = Buffer.alloc(13)
header.writeUInt32BE(S, 0)
header.writeUInt32BE(S, 4)
header[8] = 8 // bit depth
header[9] = 6 // RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', header),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
])

const out = process.argv[2]
if (!out) { console.error('usage: node scripts/placeholder-icon.js <out.png>'); process.exit(2) }
fs.writeFileSync(out, png)
