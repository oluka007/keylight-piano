// Reusable, hand-drawn motifs (flat vector) used by the scene specs.
'use strict'
const L = require('./lib.js')
const { f, rect, circ, ell, path, poly, line, stroke, g, tf, op, rng } = L

const flame = (x, y, h, col, inner = null) => {
  const w = h * .42
  const d = `M${f(x)} ${f(y - h)}C${f(x + w * .2)} ${f(y - h * .7)} ${f(x + w * 1.1)} ${f(y - h * .5)} ${f(x + w)} ${f(y - h * .2)}C${f(x + w * .95)} ${f(y + 0)} ${f(x + w * .4)} ${f(y)} ${f(x)} ${f(y)}C${f(x - w * .4)} ${f(y)} ${f(x - w * .95)} ${f(y)} ${f(x - w)} ${f(y - h * .25)}C${f(x - w * .9)} ${f(y - h * .45)} ${f(x - w * .4)} ${f(y - h * .5)} ${f(x - w * .3)} ${f(y - h * .7)}C${f(x - w * .15)} ${f(y - h * .8)} ${f(x - w * .05)} ${f(y - h * .9)} ${f(x)} ${f(y - h)}Z`
  return path(d, col) + (inner ? tf(path(d, inner), `translate(${f(x)} ${f(y)}) scale(.55) translate(${f(-x)} ${f(-y)})`) : '')
}
const hexgrid = (x0, y0, x1, y1, r, cols, seed = 4, gap = 3) => {
  const rr = rng(seed); let o = ''; const h = r * Math.sqrt(3)
  for (let row = 0; y0 + row * h * .5 < y1 + h; row++) for (let c = 0; x0 + c * r * 3 < x1 + r * 2; c++) {
    const cx = x0 + c * r * 3 + (row % 2 ? r * 1.5 : 0), cy = y0 + row * h * .5
    let d = ''; for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k; d += (k ? 'L' : 'M') + f(cx + (r - gap) * Math.cos(a)) + ' ' + f(cy + (r - gap) * Math.sin(a)) }
    o += path(d + 'Z', cols[Math.floor(rr() * cols.length)])
  }
  return o
}
const bee = (x, y, s, body, stripe, wing) => tf(
  ell(-26, -34, 22, 40, wing, 'opacity=".78" transform="rotate(-28 -26 -34)"') + ell(10, -38, 20, 38, wing, 'opacity=".68" transform="rotate(18 10 -38)"') +
  ell(0, 0, 48, 32, body) + path('M-14 -30L-4 -30L-6 30L-18 28Z', stripe) + path('M10 -31L22 -28L22 28L8 31Z', stripe) +
  circ(-52, 4, 22, stripe) + circ(-58, -2, 5, wing) + path('M46 -6L74 2L46 10Z', stripe) +
  stroke('M-62 -18Q-74 -42 -90 -40', stripe, 4) + stroke('M-54 -20Q-58 -46 -72 -52', stripe, 4) + circ(-90, -40, 4, stripe) + circ(-72, -52, 4, stripe), `translate(${x} ${y}) scale(${s})`)
const dancers = (x, y, s, col, skirt = col) => tf(
  circ(0, -104, 10, col) + path('M-14 -92L14 -92L18 -50L-18 -50Z', col) + path('M-12 -50L-4 -50L-8 0L-20 0Z', col) + path('M2 -50L13 -50L20 0L8 0Z', col) +
  stroke('M12 -84Q30 -96 36 -104', col, 6) +
  circ(46, -106, 9, skirt) + path('M38 -97L58 -97L52 -66L42 -66Z', skirt) + stroke('M40 -92Q20 -78 14 -70', skirt, 5) +
  path('M42 -66Q0 -50 -4 -4Q10 6 26 -2Q44 8 60 -2Q76 8 100 -4Q104 -50 52 -66Z', skirt), `translate(${x} ${y}) scale(${s})`)
const bell = (x, y, s, col, hi) => tf(
  path('M-8 -60Q-8 -74 0 -74Q8 -74 8 -60L40 -40Q60 -6 52 6Q70 12 72 22L-72 22Q-70 12 -52 6Q-60 -6 -40 -40Z', col) + rect(-68, 18, 136, 10, col) + circ(0, 40, 13, col) + path('M-30 -34Q-44 -8 -38 0', 'none', `stroke="${hi}" stroke-width="7" stroke-linecap="round"`), `translate(${x} ${y}) scale(${s})`)
const lantern = (x, y, s, col, glowc) => tf(
  rect(-2, -70, 4, 30, col) + rect(-16, -42, 32, 8, col) + rect(-14, -34, 28, 44, glowc) + rect(-14, -34, 28, 3, col) + rect(-14, 7, 28, 3, col) + rect(-1.5, -34, 3, 44, col, 'opacity=".5"') + path('M-16 10L16 10L10 18L-10 18Z', col), `translate(${x} ${y}) scale(${s})`)
const candle = (x, y, s, wax, flameC, flameIn) => tf(
  rect(-16, 0, 32, 88, wax, 'rx="3"') + ell(0, 0, 16, 5, wax) + ell(0, 0, 11, 3, flameIn, 'opacity=".0"') + rect(-1.5, -14, 3, 14, '#2a1a14') + flame(0, -12, 46, flameC, flameIn), `translate(${x} ${y}) scale(${s})`)
const birdV = (x, y, s, col) => path(`M${f(x - s)} ${f(y)}Q${f(x - s * .5)} ${f(y - s * .55)} ${f(x)} ${f(y)}Q${f(x + s * .5)} ${f(y - s * .55)} ${f(x + s)} ${f(y)}Q${f(x + s * .5)} ${f(y - s * .28)} ${f(x)} ${f(y + s * .12)}Q${f(x - s * .5)} ${f(y - s * .28)} ${f(x - s)} ${f(y)}Z`, col)
const column = (x, y, w, h, col, shade) => rect(x - w / 2, y, w, h, col) + rect(x - w * .22, y, w * .12, h, shade, 'opacity=".55"') + rect(x - w * .7, y - 14, w * 1.4, 14, col) + rect(x - w * .6, y - 24, w * 1.2, 10, col) + rect(x - w * .66, y + h, w * 1.32, 12, col) +
  [0, 1, 2, 3].map((i) => rect(x - w / 2 + 3 + i * (w - 6) / 4, y, 2.5, h, shade, 'opacity=".35"')).join('')
const onion = (x, y, w, h, col, hi) => path(`M${f(x)} ${f(y - h)}C${f(x + w * .1)} ${f(y - h * .82)} ${f(x + w * .62)} ${f(y - h * .62)} ${f(x + w * .5)} ${f(y - h * .3)}C${f(x + w * .45)} ${f(y - h * .14)} ${f(x + w * .22)} ${f(y - h * .08)} ${f(x + w * .22)} ${f(y)}L${f(x - w * .22)} ${f(y)}C${f(x - w * .22)} ${f(y - h * .08)} ${f(x - w * .45)} ${f(y - h * .14)} ${f(x - w * .5)} ${f(y - h * .3)}C${f(x - w * .62)} ${f(y - h * .62)} ${f(x - w * .1)} ${f(y - h * .82)} ${f(x)} ${f(y - h)}Z`, col) + rect(x - 1.5, y - h - 16, 3, 18, col) + rect(x - 7, y - h - 11, 14, 3, col) + path(`M${f(x - w * .2)} ${f(y - h * .45)}Q${f(x - w * .3)} ${f(y - h * .25)} ${f(x - w * .12)} ${f(y - h * .18)}`, 'none', `stroke="${hi}" stroke-width="3" stroke-linecap="round" opacity=".6"`)
const house = (x, y, w, h, wall, roof, win, snow = null) => rect(x, y - h, w, h, wall) + poly([[x - 6, y - h], [x + w / 2, y - h - w * .42], [x + w + 6, y - h]], snow || roof) + rect(x + w * .18, y - h * .62, w * .2, h * .3, win) + rect(x + w * .6, y - h * .62, w * .2, h * .3, win)
const crescentStar = (cx, cy, r, col, bg) => { const id = L.uid('cs'); return `<mask id="${id}"><rect width="512" height="512" fill="#fff"/><circle cx="${f(cx + r * .32)}" cy="${f(cy)}" r="${f(r * .8)}" fill="#000"/></mask><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${col}" mask="url(#${id})"/>` + star5(cx + r * .62, cy, r * .3, col) }
const star5 = (cx, cy, r, col, rot = -Math.PI / 2) => poly(Array.from({ length: 10 }, (_, i) => { const a = rot + i * Math.PI / 5, rr = i % 2 ? r * .42 : r; return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)] }), col)
const tulip = (x, y, h, col, leaf) => stroke(`M${f(x)} ${f(y)}L${f(x)} ${f(y - h * .6)}`, leaf, 4) + path(`M${f(x - h * .16)} ${f(y - h * .6)}Q${f(x - h * .2)} ${f(y - h * .95)} ${f(x)} ${f(y - h)}Q${f(x + h * .2)} ${f(y - h * .95)} ${f(x + h * .16)} ${f(y - h * .6)}Q${f(x)} ${f(y - h * .5)} ${f(x - h * .16)} ${f(y - h * .6)}Z`, col) + path(`M${f(x - h * .16)} ${f(y - h * .6)}Q${f(x - h * .12)} ${f(y - h * .9)} ${f(x - h * .02)} ${f(y - h * .72)}Q${f(x + h * .08)} ${f(y - h * .95)} ${f(x + h * .16)} ${f(y - h * .6)}Z`, col, 'opacity=".5"') + path(`M${f(x)} ${f(y - h * .1)}Q${f(x - h * .22)} ${f(y - h * .2)} ${f(x - h * .26)} ${f(y - h * .42)}Q${f(x - h * .06)} ${f(y - h * .3)} ${f(x)} ${f(y - h * .1)}Z`, leaf)
const horseshoe = (cx, cy, r, w, col, tip, tip2) => {
  const ri = r - w
  const body = `M${f(cx - r)} ${f(cy)}A${r} ${r} 0 0 1 ${f(cx + r)} ${f(cy)}L${f(cx + ri)} ${f(cy)}A${ri} ${ri} 0 0 0 ${f(cx - ri)} ${f(cy)}Z`
  return path(body, col) + rect(cx - r, cy, w, r * .55, col) + rect(cx + ri, cy, w, r * .55, col) + rect(cx - r, cy + r * .55 - r * .26, w, r * .26, tip) + rect(cx + ri, cy + r * .55 - r * .26, w, r * .26, tip2)
}
const pipes = (x, y, n, w, hmin, hmax, col, hi, gapc = 6) => { let o = ''; for (let i = 0; i < n; i++) { const t = Math.abs((i - (n - 1) / 2) / ((n - 1) / 2)), h = hmax - (hmax - hmin) * (1 - t * t) * 0 - (hmax - hmin) * (1 - t); const xx = x + i * (w + gapc); o += rect(xx, y - h, w, h, col, 'rx="3"') + rect(xx + w * .14, y - h, w * .16, h, hi, 'opacity=".5"') + path(`M${f(xx + 2)} ${f(y - h * .78)}Q${f(xx + w / 2)} ${f(y - h * .7)} ${f(xx + w - 2)} ${f(y - h * .78)}L${f(xx + w - 2)} ${f(y - h * .72)}Q${f(xx + w / 2)} ${f(y - h * .64)} ${f(xx + 2)} ${f(y - h * .72)}Z`, 'rgba(0,0,0,.28)') + ell(xx + w / 2, y - h + 12, w * .26, w * .22, 'rgba(0,0,0,.3)') } return o }
const spot = (x, w0, w1, y0, y1, col, o = .22) => poly([[x - w0 / 2, y0], [x + w0 / 2, y0], [x + w1 / 2, y1], [x - w1 / 2, y1]], col, `opacity="${o}"`)
const vine = (d, col, w = 4, leaves = 0, leafCol = col, seed = 1) => stroke(d, col, w)
const sweepNotes = (cx, cy, r, from, to, n, s, col) => { let o = ''; for (let i = 0; i < n; i++) { const a = from + (to - from) * i / (n - 1); o += L.note(cx + r * Math.cos(a), cy + r * Math.sin(a), s, col, { flag: i % 2 === 0 }) } return o }
module.exports = { flame, hexgrid, bee, dancers, bell, lantern, candle, birdV, column, onion, house, crescentStar, star5, tulip, horseshoe, pipes, spot, sweepNotes }
