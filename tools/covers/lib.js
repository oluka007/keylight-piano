// Shared drawing helpers and the house-style composer for the Keylight cover art.
// Every function returns an SVG fragment string in a 512x512 viewBox.
'use strict'
const W = 512
const f = (n) => +Number(n).toFixed(1)
let _uid = 0
const uid = (p = 'u') => `${p}${++_uid}`
const rng = (seed) => { let t = seed >>> 0; return () => { t = (t + 0x6D2B79F5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296 } }
const hashStr = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0 }

// ---- primitives ----
const rect = (x, y, w, h, fill, x2 = '') => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${fill}" ${x2}/>`
const circ = (cx, cy, r, fill, x2 = '') => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${fill}" ${x2}/>`
const ell = (cx, cy, rx, ry, fill, x2 = '') => `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}" ${x2}/>`
const path = (d, fill, x2 = '') => `<path d="${d}" fill="${fill}" ${x2}/>`
const poly = (pts, fill, x2 = '') => `<polygon points="${pts.map((p) => p.map(f).join(',')).join(' ')}" fill="${fill}" ${x2}/>`
const line = (x1, y1, x2, y2, stroke, w = 3, x3 = '') => `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" ${x3}/>`
const stroke = (d, col, w = 3, x2 = '') => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${x2}/>`
const g = (inner, attrs = '') => `<g ${attrs}>${inner}</g>`
const tf = (inner, t) => `<g transform="${t}">${inner}</g>`
const op = (inner, o) => `<g opacity="${o}">${inner}</g>`

// ---- sky, light, weather ----
const bands = (cols, y0 = 0, y1 = W) => cols.map((c, i) => rect(0, y0 + (y1 - y0) * i / cols.length - 0.5, W, (y1 - y0) / cols.length + 1, c)).join('')
const glow = (cx, cy, r, col, steps = 4, o = 0.16) => Array.from({ length: steps }, (_, i) => circ(cx, cy, r * (1 + (steps - i) * 0.34), col, `opacity="${o}"`)).join('') + circ(cx, cy, r, col)
const sparkle = (x, y, s, col, x2 = '') => path(`M${f(x)} ${f(y - s)}Q${f(x + s * .14)} ${f(y - s * .14)} ${f(x + s)} ${f(y)}Q${f(x + s * .14)} ${f(y + s * .14)} ${f(x)} ${f(y + s)}Q${f(x - s * .14)} ${f(y + s * .14)} ${f(x - s)} ${f(y)}Q${f(x - s * .14)} ${f(y - s * .14)} ${f(x)} ${f(y - s)}Z`, col, x2)
const stars = (n, x0, y0, x1, y1, seed, col, big = 6) => { const r = rng(seed); let o = ''; for (let i = 0; i < n; i++) { const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0), k = r(); o += k > .8 ? sparkle(x, y, big * (.6 + r() * .7), col) : circ(x, y, 1 + r() * 1.5, col, `opacity="${f(.55 + r() * .45)}"`) } return o }
const moon = (cx, cy, r, col, { crescent = 0, shade = null } = {}) => {
  if (!crescent) return circ(cx, cy, r, col) + (shade ? circ(cx - r * .3, cy - r * .2, r * .22, shade, 'opacity=".35"') + circ(cx + r * .35, cy + r * .3, r * .3, shade, 'opacity=".3"') + circ(cx + r * .1, cy - r * .5, r * .14, shade, 'opacity=".3"') : '')
  const id = uid('m')
  return `<mask id="${id}"><rect width="512" height="512" fill="#fff"/><circle cx="${f(cx + r * crescent)}" cy="${f(cy - r * .15)}" r="${f(r * .92)}" fill="#000"/></mask><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${col}" mask="url(#${id})"/>`
}
const cloud = (cx, cy, w, col, x2 = '') => { const h = w * .22; return path(`M${f(cx - w / 2)} ${f(cy + h)}a${f(h)} ${f(h)} 0 0 1 ${f(h * .6)} ${f(-h * 1.3)}a${f(h * 1.2)} ${f(h * 1.2)} 0 0 1 ${f(h * 2.2)} ${f(-h * .7)}a${f(h * 1.5)} ${f(h * 1.5)} 0 0 1 ${f(h * 2.6)} ${f(h * .2)}a${f(h)} ${f(h)} 0 0 1 ${f(w - h * 5.6 + h * .6)} ${f(h * 1.8)}Z`, col, x2) }
const rays = (cx, cy, r0, r1, n, col, o = 1, rot = 0) => { let d = ''; for (let i = 0; i < n; i++) { const a = rot + i * 2 * Math.PI / n, a2 = a + Math.PI / n * .55; d += `M${f(cx + r0 * Math.cos(a))} ${f(cy + r0 * Math.sin(a))}L${f(cx + r1 * Math.cos(a))} ${f(cy + r1 * Math.sin(a))}L${f(cx + r1 * Math.cos(a2))} ${f(cy + r1 * Math.sin(a2))}L${f(cx + r0 * Math.cos(a2))} ${f(cy + r0 * Math.sin(a2))}Z` } return path(d, col, `opacity="${o}"`) }
const lightning = (x, y, s, col) => poly([[x + s * .25, y], [x - s * .35, y + s * .55], [x - s * .02, y + s * .55], [x - s * .4, y + s * 1.1], [x + s * .35, y + s * .42], [x + s * .04, y + s * .42], [x + s * .38, y]], col)

// ---- land ----
const hills = (y, amp, col, seed = 1, n = 3, x2 = '') => { const r = rng(seed); let d = `M-10 ${f(y)}`; const pts = []; for (let i = 0; i <= n * 2; i++) pts.push([-10 + (W + 20) * i / (n * 2), y + (i % 2 ? -1 : 1) * amp * (.4 + r() * .6)]); for (let i = 1; i < pts.length; i++) { const p = pts[i - 1], q = pts[i], mx = (p[0] + q[0]) / 2; d += `C${f(mx)} ${f(p[1])} ${f(mx)} ${f(q[1])} ${f(q[0])} ${f(q[1])}` } return path(d + `L522 522L-10 522Z`, col, x2) }
const mountains = (base, peaks, col, x2 = '') => { let d = `M-10 ${base + 2}`; let px = -10; for (const [x, h, w = 70] of peaks) { d += `L${f(x - w)} ${f(base - h * .25)}L${f(x - w * .22)} ${f(base - h * .85)}L${f(x)} ${f(base - h)}L${f(x + w * .3)} ${f(base - h * .7)}L${f(x + w)} ${f(base - h * .2)}`; px = x } return path(d + `L522 ${base + 2}L522 522L-10 522Z`, col, x2) }
const snowcap = (x, base, h, w, col) => poly([[x - w * .22, base - h * .85], [x, base - h], [x + w * .3, base - h * .7], [x + w * .12, base - h * .66], [x, base - h * .74], [x - w * .1, base - h * .62]], col)
const pine = (x, y, h, col, w = null) => { w = w || h * .42; return rect(x - h * .03, y - h * .1, h * .06, h * .12, col) + [0, 1, 2].map((i) => poly([[x, y - h + i * h * .24], [x + w * (.42 + i * .2), y - h * .3 + i * h * .14 - (2 - i) * h * .0], [x - w * (.42 + i * .2), y - h * .3 + i * h * .14]], col)).join('') }
const pines = (list, col) => list.map(([x, y, h]) => pine(x, y, h, col)).join('')
const waves = (y, rows, cols, amp = 12, seed = 3, step = 48) => { let o = ''; const r = rng(seed); for (let k = 0; k < rows; k++) { const yy = y + k * (512 - y) / rows; let d = `M-20 ${f(yy)}`; for (let x = -20, i = 0; x < 540; x += step, i++) { const a = amp * (.7 + r() * .6); d += `q${f(step / 2)} ${f(-a * 2)} ${f(step)} 0`; } o += path(d + `L540 522L-20 522Z`, cols[k % cols.length]) } return o }
const lightPath = (cx, y0, y1, col, w0 = 40, n = 9) => Array.from({ length: n }, (_, i) => { const t = i / (n - 1), y = y0 + (y1 - y0) * t, w = w0 * (.3 + t * .9); return rect(cx - w / 2, y, w, (y1 - y0) / n * .55, col, `rx="${f((y1 - y0) / n * .27)}"`) }).join('')
const cypress = (x, y, h, col) => path(`M${f(x)} ${f(y - h)}C${f(x + h * .14)} ${f(y - h * .6)} ${f(x + h * .13)} ${f(y - h * .2)} ${f(x + h * .02)} ${f(y)}L${f(x - h * .02)} ${f(y)}C${f(x - h * .13)} ${f(y - h * .2)} ${f(x - h * .14)} ${f(y - h * .6)} ${f(x)} ${f(y - h)}Z`, col)
const birch = (x, y, h, trunk, mark, seed = 1) => { const r = rng(seed); let o = rect(x - h * .018, y - h, h * .036, h, trunk); for (let i = 0; i < 6; i++) o += rect(x - h * .018, y - h * (.1 + r() * .8), h * .036, 3, mark); return o }
const grass = (y, col, seed = 2) => { const r = rng(seed); let d = `M-10 522L-10 ${y}`; for (let x = -10; x < 530; x += 9) d += `L${f(x + 4)} ${f(y - 8 - r() * 16)}L${f(x + 9)} ${f(y)}`; return path(d + 'L522 522Z', col) }
const brick = (x, y, w, h, col, wins = null, winCol = null) => rect(x, y, w, h, col) + (wins || []).map(([wx, wy, ww = 9, wh = 14]) => rect(x + wx, y + wy, ww, wh, winCol)).join('')

// ---- music ----
const note = (x, y, s, col, { flag = false, flip = false, x2 = '' } = {}) => {
  const hr = s * .34, ry = s * .24, sx = x + hr * .86, top = y - s * 1.55
  return `<g ${x2}>` + ell(x, y, hr, ry, col, `transform="rotate(-22 ${f(x)} ${f(y)})"`) + rect(sx - s * .045, top, s * .09, y - top, col) + (flag ? path(`M${f(sx)} ${f(top)}c${f(s * .5)} ${f(s * .25)} ${f(s * .62)} ${f(s * .55)} ${f(s * .3)} ${f(s * .95)}c${f(s * .12)} ${f(-s * .35)} ${f(-s * .15)} ${f(-s * .5)} ${f(-s * .3)} ${f(-s * .45)}Z`, col) : '') + '</g>'
}
const beamed = (x, y, s, col, n = 2) => { let o = ''; for (let i = 0; i < n; i++) o += ell(x + i * s * .95, y + (n - 1 - i) * -s * .0, s * .34, s * .24, col, `transform="rotate(-22 ${f(x + i * s * .95)} ${f(y)})"`) + rect(x + i * s * .95 + s * .26, y - s * 1.55, s * .09, s * 1.55, col); return o + poly([[x + s * .26, y - s * 1.55], [x + (n - 1) * s * .95 + s * .35, y - s * 1.55], [x + (n - 1) * s * .95 + s * .35, y - s * 1.2], [x + s * .26, y - s * 1.2]], col) }
const keys = (x, y, w, h, n, white, black, ink = null) => { const kw = w / n; let o = ''; for (let i = 0; i < n; i++) o += rect(x + i * kw + 1, y, kw - 2, h, white, 'rx="3"'); for (let i = 0; i < n - 1; i++) if (![2, 6, 9, 13].includes(i % 7 === 2 || i % 7 === 6 ? i % 7 : -1) && i % 7 !== 2 && i % 7 !== 6) o += rect(x + (i + 1) * kw - kw * .3, y, kw * .6, h * .62, black, 'rx="2"'); return o }
const grandPiano = (x, y, s, body, lid, hi) => tf(
  path('M0 40C0 10 20 0 70 0L190 0C230 0 250 20 250 44L250 70L0 70Z', body) +
  path('M10 -2L170 -30L250 4Z', lid) +
  rect(0, 70, 250, 9, hi) + rect(14, 79, 10, 62, body) + rect(226, 79, 10, 62, body) + rect(116, 79, 8, 46, body) +
  rect(6, 60, 238, 6, hi, 'opacity=".5"'), `translate(${x} ${y}) scale(${s})`)

// ---- composer ----
function compose(id, spec) {
  const P = spec.pal
  const inner = spec.draw(P)
  const ink = P.ink
  const htId = uid('ht'), hmId = uid('hm')
  const scrim = `<linearGradient id="${hmId}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${ink}" stop-opacity=".66"/><stop offset=".55" stop-color="${ink}" stop-opacity=".2"/><stop offset="1" stop-color="${ink}" stop-opacity="0"/></linearGradient><rect width="512" height="170" fill="url(#${hmId}s)"/>`
  const defs = `<defs><pattern id="${htId}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx="3.5" cy="3.5" r="1.7" fill="${ink}"/></pattern>` +
    `<linearGradient id="${hmId}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".95"/></linearGradient>` +
    `<mask id="${hmId}"><rect x="0" y="300" width="512" height="212" fill="url(#${hmId}g)"/></mask></defs>`
  const grainDots = rect(0, 300, W, 212, `url(#${htId})`, `mask="url(#${hmId})" opacity=".38"`)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${defs}<rect width="512" height="512" fill="${P.bg[0]}"/>${inner}${scrim}${grainDots}</svg>`
}
module.exports = { W, f, uid, rng, hashStr, rect, circ, ell, path, poly, line, stroke, g, tf, op, bands, glow, sparkle, stars, moon, cloud, rays, lightning, hills, mountains, snowcap, pine, pines, waves, lightPath, cypress, birch, grass, brick, note, beamed, keys, grandPiano, compose }
