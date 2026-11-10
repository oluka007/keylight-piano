// Joplin rags, Bach, Liszt consolations.
const L = require('./lib.js'), M = require('./motifs.js')
const { rect, circ, ell, path, poly, line, stroke, g, tf, op, bands, glow, sparkle, stars, moon, cloud, rays, hills, mountains, waves, lightPath, note, f, rng } = L
const FONT = "font-family=\"Rockwell, 'Rockwell Extra Bold', Clarendon, Georgia, serif\" font-weight=\"800\""
// ragtime poster frame: striped ground, double border, lettered banner, piano keys
const rag = (P, art, text, tl = 380) => {
  let o = ''
  for (let i = 0; i < 16; i++) o += rect(i * 32, 0, 32, 512, i % 2 ? P.s1 : P.s2)
  o += art
  o += rect(18, 18, 476, 476, 'none', `stroke="${P.gold}" stroke-width="5"`) + rect(30, 30, 452, 452, 'none', `stroke="${P.gold}" stroke-width="1.8"`)
  o += rect(60, 322, 392, 62, P.ink) + rect(66, 328, 380, 50, 'none', `stroke="${P.gold}" stroke-width="2.5"`) + `<text x="256" y="364" text-anchor="middle" ${FONT} font-size="30" fill="${P.gold}" textLength="${tl}" lengthAdjust="spacingAndGlyphs">${text}</text>` + poly([[60, 322], [38, 353], [60, 384]], P.ink) + poly([[452, 322], [474, 353], [452, 384]], P.ink)
  o += rect(18, 410, 476, 84, '#f6f0e0') + Array.from({ length: 14 }, (_, i) => rect(18 + i * 34, 410, 1.5, 84, '#9a8a70')).join('') + [0, 1, 3, 4, 5, 7, 8, 10, 11, 12].map((i) => rect(18 + (i + 1) * 34 - 11, 410, 22, 50, P.ink, 'rx="2"')).join('')
  return o
}
const star = M.star5
const tophat = (x, y, s, body, band) => tf(ell(0, 0, 78, 14, body) + rect(-48, -92, 96, 92, body) + ell(0, -92, 48, 10, '#000', 'opacity=".25"') + rect(-48, -26, 96, 18, band) + path('M-40 -88L-40 -8', 'none', 'stroke="#fff" stroke-width="5" opacity=".18"'), `translate(${x} ${y}) scale(${s})`)
module.exports = {
  'joplin-maple-leaf-rag': { pal: { bg: ['#8a1a14'], ink: '#3a0a08' }, draw: (P) => {
    const Q = { s1: '#b8261c', s2: '#9a1a14', gold: '#ffd86a', ink: '#3a0a08' }
    const h = [[0, -48], [9, -28], [20, -34], [17, -12], [38, -22], [32, -4], [48, 6], [22, 18], [25, 28], [6, 25], [3, 48]]
    const pts = (cx, cy, s) => h.concat(h.slice(1, -1).reverse().map(([x, y]) => [-x, y])).map(([x, y]) => [cx + x * s, cy + y * s])
    const leaf = rays(256, 190, 100, 330, 20, '#ffd86a', .2) + glow(256, 190, 110, '#ffd86a', 2, .1).slice(0, 0) + poly(pts(256, 188, 2.7), '#3a0a08', 'transform="translate(5 6)" opacity=".5"') + poly(pts(256, 188, 2.7), '#f08a1c') + poly(pts(256, 188, 2.2), '#ffb03c') + stroke('M256 296L256 130M256 250L330 190M256 250L182 190M256 200L310 140M256 200L202 140', '#c2601a', 6) + rect(251, 290, 10, 40, '#c2601a')
    return rag(Q, leaf, 'MAPLE LEAF RAG', 340)
  } },
  'joplin-the-entertainer': { pal: { bg: ['#14224a'], ink: '#0a1230' }, draw: () => {
    const Q = { s1: '#1c2e62', s2: '#14224a', gold: '#ffd86a', ink: '#0a1230' }
    let a = ''; const n = 22; for (let i = 0; i < n; i++) { const t = i / n * Math.PI * 2; a += circ(256 + 136 * Math.cos(t), 186 + 136 * Math.sin(t), 7, i % 2 ? '#fff4c0' : '#ffb347') + circ(256 + 136 * Math.cos(t), 186 + 136 * Math.sin(t), 14, '#ffd86a', 'opacity=".2"') }
    a += circ(256, 186, 124, '#8a1424') + circ(256, 186, 112, '#b01c2c') + rays(256, 186, 20, 110, 18, '#d8283c', .6) + tophat(256, 250, 1.1, '#0a1230', '#ffd86a') + stroke('M345 290L405 120', '#f4ecd8', 7) + circ(407, 114, 11, '#ffd86a') + sparkle(150, 120, 14, '#fff4c0') + sparkle(360, 100, 10, '#fff4c0')
    return rag(Q, a, 'THE ENTERTAINER', 340)
  } },
  'joplin-pineapple-rag': { pal: { bg: ['#0e5a4a'], ink: '#062a24' }, draw: () => {
    const Q = { s1: '#127a62', s2: '#0e5a4a', gold: '#ffe08a', ink: '#062a24' }
    let a = rays(256, 190, 90, 340, 22, '#ffe08a', .2)
    for (const [dx, dy, r, c] of [[0, -150, 0, '#1f9a4a'], [-40, -140, -32, '#2ab05a'], [40, -140, 32, '#2ab05a'], [-70, -112, -62, '#1f9a4a'], [70, -112, 62, '#1f9a4a']]) a += ell(256 + dx, 118 + (dy + 150) * .2 + 0, 16, 56, c, `transform="rotate(${r} ${256 + dx} ${120 + (dy + 150) * .2 + 40})"`)
    a += ell(256, 215, 92, 112, '#f4b82c') + tf(ell(0, 0, 92, 112, '#f4b82c'), 'translate(256 215)').slice(0, 0)
    const cp = `<clipPath id="pc"><ellipse cx="256" cy="215" rx="92" ry="112"/></clipPath>`
    let hatch = ''; for (let i = -8; i < 9; i++) hatch += line(256 - 130 + i * 28, 90, 256 + 130 + i * 28, 340, '#b8741a', 4) + line(256 + 130 + i * 28, 90, 256 - 130 + i * 28, 340, '#b8741a', 4)
    a += cp + g(hatch + [-2, -1, 0, 1, 2].map((i) => [-2, -1, 0, 1, 2, 3].map((j) => circ(256 + i * 28 + (j % 2) * 14, 130 + j * 36, 4, '#8a4a0a')).join('')).join(''), 'clip-path="url(#pc)"') + ell(256, 215, 92, 112, 'none', 'stroke="#c2801a" stroke-width="5"') + ell(222, 170, 12, 34, '#fff0b0', 'opacity=".5"')
    return rag(Q, a, 'PINEAPPLE RAG', 320)
  } },
  'joplin-elite-syncopations': { pal: { bg: ['#4a1a5a'], ink: '#1e0828' }, draw: () => {
    const Q = { s1: '#6a2a7a', s2: '#4a1a5a', gold: '#ffd86a', ink: '#1e0828' }
    let a = rays(256, 180, 80, 340, 24, '#ffd86a', .18)
    a += tf(poly([[-90, -40], [-8, -8], [-8, 8], [-90, 40]], '#e8283c') + poly([[90, -40], [8, -8], [8, 8], [90, 40]], '#e8283c') + path('M-90 -40L-8 -8L-8 8L-90 40Z', 'none', 'stroke="#ffd86a" stroke-width="4"') + path('M90 -40L8 -8L8 8L90 40Z', 'none', 'stroke="#ffd86a" stroke-width="4"') + rect(-22, -22, 44, 44, '#b01c2c', 'rx="10"') + [-70, -50, 50, 70].map((x) => line(x, -26, x, 26, '#ffd86a', 3, 'opacity=".7"')).join(''), 'translate(256 165) scale(1.45)')
    a += stroke('M120 280Q200 230 256 255T392 220', '#f4ecd8', 6) + circ(392, 218, 12, '#ffd86a') + [[110, 100], [410, 120], [90, 250], [430, 260], [256, 60]].map(([x, y]) => sparkle(x, y, 14, '#fff4c0')).join('')
    a += poly([[256, 275], [276, 292], [256, 310], [236, 292]], '#7ae6ff') + poly([[256, 275], [266, 292], [256, 310]], '#bff4ff')
    return rag(Q, a, 'ELITE SYNCOPATIONS', 340)
  } },
  'joplin-breeze-from-alabama': { pal: { bg: ['#1a5a6a'], ink: '#0a2a34' }, draw: () => {
    const Q = { s1: '#1f6e80', s2: '#1a5a6a', gold: '#ffe8a8', ink: '#0a2a34' }
    let a = rays(256, 190, 100, 340, 22, '#ffe8a8', .14)
    for (const [x, y, r] of [[170, 240, -50], [350, 250, 40], [256, 270, 0], [190, 150, -80], [330, 140, 80]]) a += ell(x, y, 32, 74, '#2a8a5a', `transform="rotate(${r} 256 190)"`).slice(0, 0)
    for (const [x, y, r] of [[150, 215, -70], [362, 215, 70], [210, 270, -30], [302, 270, 30]]) a += ell(x, y, 24, 56, '#1f7a4a', `transform="rotate(${r} ${x} ${y})"`) + line(x, y - 40 * 0, x, y, '#14583a', 0)
    const pet = (n, r, col, ang0) => Array.from({ length: n }, (_, i) => { const a_ = ang0 + i * 360 / n; return ell(256, 190 - r, r * .42, r * .8, col, `transform="rotate(${a_} 256 190)" opacity="1"`) }).join('')
    a += pet(6, 92, '#f4ecd8', 0) + pet(6, 70, '#fff9ea', 30) + pet(5, 44, '#f4e4b8', 10) + circ(256, 190, 22, '#e8c860') + [0, 1, 2, 3, 4, 5, 6, 7].map((i) => circ(256 + 14 * Math.cos(i), 190 + 14 * Math.sin(i), 2.6, '#a8782a')).join('')
    a += [0, 1, 2].map((i) => stroke(`M-10 ${110 + i * 90}C90 ${60 + i * 90} 150 ${170 + i * 90} 250 ${110 + i * 90}S420 ${60 + i * 90} 530 ${120 + i * 90}`, '#ffffff', 5 - i, 'opacity=".55"')).join('')
    return rag(Q, a, 'A BREEZE FROM ALABAMA', 350)
  } },
  'joplin-magnetic-rag': { pal: { bg: ['#1a2a5a'], ink: '#0a1230' }, draw: () => {
    const Q = { s1: '#243a78', s2: '#1a2a5a', gold: '#ffd86a', ink: '#0a1230' }
    let a = rays(256, 220, 90, 340, 22, '#7ab8ff', .15)
    for (const r of [60, 90, 120]) a += path(`M${256 - r - 40} 200Q${256 - r - 40} ${120 - r * .3} 256 ${110 - r * .5}Q${256 + r + 40} ${120 - r * .3} ${256 + r + 40} 200`, 'none', `stroke="#ffd86a" stroke-width="3" stroke-dasharray="3 9" opacity="${.9 - r / 200}" stroke-linecap="round"`).slice(0, 0)
    a += tf(L.path('M-84 0A84 84 0 0 1 84 0L44 0A44 44 0 0 0 -44 0Z', '#d8283c') + rect(-84, 0, 40, 70, '#d8283c') + rect(44, 0, 40, 70, '#d8283c') + rect(-84, 44, 40, 26, '#d8d8e8') + rect(44, 44, 40, 26, '#d8d8e8') + path('M-72 -4Q-60 -56 0 -66', 'none', 'stroke="#ff8a8a" stroke-width="7" stroke-linecap="round"'), 'translate(256 210) scale(1.35) translate(0 -20)')
    a += [[130, 140, 24], [380, 120, 20], [90, 250, 18], [420, 250, 22], [256, 60, 20]].map(([x, y, s], i) => note(x, y, s, i % 2 ? '#ffd86a' : '#fff4c0', { flag: i % 2 === 0 })).join('')
    a += [-1, 1].map((m) => [0, 1, 2].map((i) => stroke(`M${256 + m * 90} 296Q${256 + m * (140 + i * 24)} ${280 + i * 10} ${256 + m * (170 + i * 30)} ${210 - i * 20}`, '#ffd86a', 3, 'stroke-dasharray="2 9" opacity=".8"')).join('')).join('')
    return rag(Q, a, 'MAGNETIC RAG', 300)
  } },
  'bach-prelude-c-bwv846': { pal: { bg: ['#1a2a52'], ink: '#0a1230' }, draw: () => {
    let o = rect(0, 0, 512, 512, '#1a2a52') + rays(256, 250, 20, 700, 26, '#ffe8a0', .16)
    const cols = ['#0a1230', '#1a2a52', '#2a4a8a', '#4a72b8', '#8ab0e0', '#f4d890']
    for (let i = 0; i < 6; i++) { const w = 460 - i * 72, top = 70 + i * 30, bot = 512 - i * 18; o += path(`M${256 - w / 2} 530L${256 - w / 2} ${top + w / 2}A${w / 2} ${w / 2} 0 0 1 ${256 + w / 2} ${top + w / 2}L${256 + w / 2} 530Z`, cols[i]) }
    o += circ(256, 250, 22, '#fff6d0') + glow(256, 250, 22, '#fff6d0', 3, .15)
    for (let i = 0; i < 5; i++) o += rect(256 - 230 + i * 36, 505 - i * 2, 4, 0, '#000')
    o += poly([[0, 512], [130, 400], [380, 400], [512, 512]], '#d8cfa8', 'opacity=".0"')
    o += Array.from({ length: 5 }, (_, i) => rect(40, 330 + i * 22, 432, 1.6, '#f4d890', 'opacity=".3"')).join('')
    o += [0, 1, 2, 3, 4, 5, 6, 7].map((i) => note(100 + i * 44, 436 - Math.sin(i * .8) * 30, 14, '#f4d890', { flag: i % 3 === 0 })).join('')
    return o + sparkle(256, 250, 34, '#ffffff', 'opacity=".9"')
  } },
  'bach-toccata-bwv910': { pal: { bg: ['#120408'], ink: '#0a0204' }, draw: () => {
    let o = bands(['#0a0204', '#1a0610', '#3a0a18', '#6a1420'], 0, 512) + rays(256, 360, 40, 700, 24, '#ff8a3c', .18) + glow(256, 330, 80, '#ff8a3c', 3, .08)
    o += M.pipes(18, 440, 16, 22, 120, 380, '#c9a04a', '#fff0c0', 8)
    o += M.flame(40, 440, 70, '#ff6a2c', '#ffd27a') + M.flame(480, 440, 70, '#ff6a2c', '#ffd27a') + M.flame(256, 440, 90, '#ff6a2c', '#ffd27a').slice(0, 0)
    o += rect(0, 440, 512, 72, '#0a0204') + Array.from({ length: 12 }, (_, i) => rect(10 + i * 42, 448, 38, 70, '#f4ecd8', 'rx="3"')).join('') + [0, 1, 3, 4, 5, 7, 8, 10].map((i) => rect(10 + (i + 1) * 42 - 12, 448, 24, 42, '#0a0204', 'rx="2"')).join('')
    return o + [[70, 100, 22], [440, 120, 18], [250, 90, 16]].map(([x, y, s], i) => note(x, y, s, '#ffd27a', { flag: i % 2 === 0 })).join('')
  } },
  'bach-invention-13': { pal: { bg: ['#0e2438'], ink: '#071624' }, draw: () => {
    let o = bands(['#071624', '#0e2438', '#143450'], 0, 512) + Array.from({ length: 5 }, (_, i) => rect(0, 150 + i * 26, 512, 1.6, '#f4ecd8', 'opacity=".22"')).join('')
    const wave = (ph, col, w) => { let d = ''; for (let x = -10; x <= 522; x += 8) { const y = 255 + Math.sin(x / 512 * Math.PI * 4 + ph) * 90; d += (x < 0 ? 'M' : 'L') + x + ' ' + f(y) } return d }
    for (let k = 0; k < 2; k++) { const d = wave(k * Math.PI, 0, 0); o += stroke(d, '#071624', 34) }
    o += stroke(wave(0), '#f08a5a', 26) + stroke(wave(0), '#ffc8a0', 5, 'opacity=".7"')
    // over-under: redraw second ribbon in segments
    let seg = ''; for (let k = 0; k < 4; k++) { const x0 = k * 128 + 64, x1 = x0 + 64; let d = ''; for (let x = x0; x <= x1; x += 4) d += (x === x0 ? 'M' : 'L') + x + ' ' + f(255 + Math.sin(x / 512 * Math.PI * 4 + Math.PI) * 90); seg += d }
    o += stroke(wave(Math.PI), '#2ac0c8', 26) + stroke(wave(Math.PI), '#a8f0f0', 5, 'opacity=".7"')
    for (let k = 0; k < 4; k++) { const x0 = k * 128 + 40, x1 = x0 + 48; let d = ''; for (let x = x0; x <= x1; x += 4) d += (x === x0 ? 'M' : 'L') + x + ' ' + f(255 + Math.sin(x / 512 * Math.PI * 4) * 90); o += stroke(d, '#071624', 32).slice(0, 0) + stroke(d, '#f08a5a', 26) + stroke(d, '#ffc8a0', 5, 'opacity=".7"') }
    for (let i = 0; i < 12; i++) { const x = 20 + i * 44; o += circ(x, 255 + Math.sin(x / 512 * Math.PI * 4) * 90, 5, '#fff4d8') + circ(x + 22, 255 + Math.sin((x + 22) / 512 * Math.PI * 4 + Math.PI) * 90, 5, '#fff4d8') }
    return o + sparkle(70, 90, 12, '#a8f0f0') + sparkle(450, 400, 12, '#ffc8a0')
  } },
  'liszt-consolation-3': { pal: { bg: ['#2a4a8a'], ink: '#14284a' }, draw: () => {
    let o = bands(['#2a4a8a', '#5a7ab8', '#a8a8d0', '#f0b8b0', '#ffe0b0'], 0, 400) + glow(256, 360, 100, '#fff0c8', 4, .1) + circ(256, 360, 90, '#fff6dc') + rays(256, 360, 100, 600, 22, '#fff6dc', .14)
    o += cloud(90, 150, 170, '#e8d8f0', 'opacity=".7"') + cloud(430, 220, 150, '#f8d8d0', 'opacity=".7"')
    o += hills(380, 14, '#5a6a9a', 3, 3) + hills(420, 12, '#3a4a7a', 7, 3) + rect(0, 460, 512, 60, '#14284a')
    o += M.birdV(100, 120, 12, '#14284a').slice(0, 0) + dove(256, 230, 1.6)
    return o
  } },
  'liszt-consolation-1': { pal: { bg: ['#5a2a3a'], ink: '#2a1018' }, draw: () => {
    let o = rect(0, 0, 512, 512, '#3a1a2a') + path('M110 440L110 130Q110 70 256 60Q402 70 402 130L402 440Z', '#2a1018') + path('M126 440L126 134Q126 86 256 76Q386 86 386 134L386 440Z', '#e8784a')
    o += bands(['#5a2a6a', '#a84a6a', '#e8784a', '#ffb06a', '#ffd890'], 76, 440).replace(/<rect/g, '<rect clip-path="url(#wn)"') + `<clipPath id="wn"><path d="M126 440L126 134Q126 86 256 76Q386 86 386 134L386 440Z"/></clipPath>`
    o += g(glow(256, 330, 50, '#fff0c8', 3, .15) + circ(256, 330, 44, '#fff6dc') + mountains(420, [[190, 90, 90], [330, 120, 100]], '#5a2a6a') + hills(420, 6, '#3a1a4a', 5, 3), 'clip-path="url(#wn)"')
    o += rect(110, 436, 292, 14, '#4a2a2a') + rect(96, 446, 320, 14, '#2a1018')
    const stem = (x, y1, y2, r) => stroke(`M${x} ${y1}Q${x + r} ${(y1 + y2) / 2} ${x} ${y2}`, '#3a8a4a', 5)
    o += path('M216 440L206 380Q256 392 306 380L296 440Z', '#2a5a8a') + path('M214 410Q256 420 298 410', 'none', 'stroke="#8ab8e8" stroke-width="3"') + ell(256, 380, 50, 7, '#3a7ab8')
    for (const [x, y, c] of [[220, 290, '#e83a5a'], [256, 262, '#ffd93c'], [292, 292, '#e83a5a'], [236, 322, '#ffffff'], [276, 320, '#ff8a5a']]) o += stroke(`M256 378L${x} ${y}`, '#3a8a4a', 4) + [0, 1, 2, 3, 4].map((i) => circ(x + Math.cos(i * 1.256) * 11, y + Math.sin(i * 1.256) * 11, 9, c)).join('') + circ(x, y, 6, '#ffe58a')
    o += rect(251, 76, 10, 364, '#2a1018') + rect(126, 250, 260, 8, '#2a1018')
    return o
  } },
  'liszt-consolation-4': { pal: { bg: ['#0e1a3a'], ink: '#060c22' }, draw: () => {
    let o = bands(['#060c22', '#0e1a3a', '#1a2c5a'], 0, 512) + stars(40, 10, 10, 500, 300, 4, '#dfe8ff', 5)
    o += hills(250, 12, '#0a1430', 3, 3) + rect(0, 262, 512, 250, '#12244e') + rect(0, 262, 512, 3, '#4a6aa8', 'opacity=".6"')
    const r = rng(6)
    for (const [x, y, s] of [[256, 190, 1.5], [120, 130, 1], [390, 110, .9], [70, 330, 1.1], [180, 310, 1.2], [340, 330, 1.3], [450, 300, .9], [260, 410, 1.4], [120, 450, 1], [400, 440, 1.1]]) {
      const c = ['#ff9a5a', '#ffc85a', '#ff7a8a'][Math.floor(r() * 3)], above = y < 262
      o += circ(x, y, 46 * s, '#ffcf6a', 'opacity=".12"') + rect(x - 18 * s, y - 24 * s, 36 * s, 48 * s, c, 'rx="' + 10 * s + '"') + rect(x - 18 * s, y - 24 * s, 36 * s, 5 * s, '#4a2a1a') + rect(x - 18 * s, y + 20 * s, 36 * s, 5 * s, '#4a2a1a') + [-8, 0, 8].map((dx) => rect(x + dx * s - 1, y - 20 * s, 2, 40 * s, '#c2602a', 'opacity=".5"')).join('') + circ(x, y, 9 * s, '#fff2b0', 'opacity=".7"')
      if (!above) o += rect(x - 18 * s, 262 + (262 - y) * -1 + 0, 0, 0, '#000') + rect(x - 14 * s, y + 40 * s, 28 * s, 5, c, 'opacity=".25"')
    }
    return o
  } },
}
const dove = (x, y, s) => tf(path('M-40 4Q-10 -14 30 -6Q50 -2 62 -14Q60 4 44 12Q10 28 -40 4Z', '#fff8ee') + path('M-6 -4Q-24 -70 24 -92Q20 -50 24 -8Z', '#fff8ee') + path('M-6 -4Q-40 -40 -56 -34Q-34 -4 -6 4Z', '#d8cfe8') + path('M-40 4L-80 -4L-76 14Z', '#d8cfe8') + circ(60, -14, 12, '#fff8ee') + path('M70 -16L90 -10L70 -6Z', '#e8a040') + circ(64, -17, 2.5, '#2a1a30') + stroke('M84 -6Q104 8 120 4', '#4a9a5a', 4) + ell(106, 0, 9, 4, '#4a9a5a', 'transform="rotate(-20 106 0)"') + ell(120, 8, 9, 4, '#4a9a5a', 'transform="rotate(30 120 8)"'), `translate(${x} ${y}) scale(${s})`)
