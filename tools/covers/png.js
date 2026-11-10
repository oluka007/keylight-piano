// Minimal indexed-colour PNG writer with a median-cut palette (pure Node, no dependencies).
const zlib = require('zlib')
const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c })
const crc = (b) => { let c = -1; for (let i = 0; i < b.length; i++) c = crcT[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0 }
const chunk = (t, d) => { const b = Buffer.alloc(12 + d.length); b.writeUInt32BE(d.length, 0); b.write(t, 4, 'latin1'); d.copy(b, 8); b.writeUInt32BE(crc(b.subarray(4, 8 + d.length)), 8 + d.length); return b }

function medianCut(hist, n) { // hist: Map key(rgb 24bit)->count
  let boxes = [[...hist.entries()].map(([k, c]) => ({ r: k >> 16, g: (k >> 8) & 255, b: k & 255, c }))]
  while (boxes.length < n) {
    let bi = -1, bs = 0
    boxes.forEach((bx, i) => { if (bx.length < 2) return; let mn = [255, 255, 255], mx = [0, 0, 0]; for (const p of bx) { mn = [Math.min(mn[0], p.r), Math.min(mn[1], p.g), Math.min(mn[2], p.b)]; mx = [Math.max(mx[0], p.r), Math.max(mx[1], p.g), Math.max(mx[2], p.b)] } const s = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) * Math.sqrt(bx.reduce((a, p) => a + p.c, 0)); if (s > bs) { bs = s; bi = i } })
    if (bi < 0) break
    const bx = boxes[bi]; let mn = [255, 255, 255], mx = [0, 0, 0]
    for (const p of bx) { mn = [Math.min(mn[0], p.r), Math.min(mn[1], p.g), Math.min(mn[2], p.b)]; mx = [Math.max(mx[0], p.r), Math.max(mx[1], p.g), Math.max(mx[2], p.b)] }
    const ch = ['r', 'g', 'b'][[mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]].reduce((a, v, i, arr) => (v > arr[a] ? i : a), 0)]
    bx.sort((a, b) => a[ch] - b[ch])
    const tot = bx.reduce((a, p) => a + p.c, 0); let acc = 0, cut = 1
    for (let i = 0; i < bx.length; i++) { acc += bx[i].c; if (acc >= tot / 2) { cut = Math.max(1, Math.min(bx.length - 1, i + 1)); break } }
    boxes.splice(bi, 1, bx.slice(0, cut), bx.slice(cut))
  }
  return boxes.map((bx) => { const t = bx.reduce((a, p) => a + p.c, 0); return [Math.round(bx.reduce((a, p) => a + p.r * p.c, 0) / t), Math.round(bx.reduce((a, p) => a + p.g * p.c, 0) / t), Math.round(bx.reduce((a, p) => a + p.b * p.c, 0) / t)] })
}
function encodeIndexed(bgra, w, h, ncol = 128) {
  const hist = new Map()
  for (let i = 0; i < w * h; i++) { const k = (bgra[i * 4 + 2] << 16) | (bgra[i * 4 + 1] << 8) | bgra[i * 4]; hist.set(k, (hist.get(k) || 0) + 1) }
  const pal = hist.size <= ncol ? [...hist.keys()].map((k) => [k >> 16, (k >> 8) & 255, k & 255]) : medianCut(hist, ncol)
  const cache = new Map()
  const near = (k) => { let v = cache.get(k); if (v !== undefined) return v; const r = k >> 16, g = (k >> 8) & 255, b = k & 255; let best = 0, bd = 1e9; for (let i = 0; i < pal.length; i++) { const d = (pal[i][0] - r) ** 2 + (pal[i][1] - g) ** 2 + (pal[i][2] - b) ** 2; if (d < bd) { bd = d; best = i } } cache.set(k, best); return best }
  const raw = Buffer.alloc((w + 1) * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; raw[y * (w + 1) + 1 + x] = near((bgra[i + 2] << 16) | (bgra[i + 1] << 8) | bgra[i]) }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 3
  const plte = Buffer.from(pal.flat())
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('PLTE', plte), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}
module.exports = { encodeIndexed }
