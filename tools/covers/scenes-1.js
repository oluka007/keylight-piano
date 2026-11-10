// Chopin, Liszt and Scriabin.
const L = require('./lib.js'), M = require('./motifs.js')
const { rect, circ, ell, path, poly, line, stroke, g, tf, op, bands, glow, sparkle, stars, moon, cloud, rays, hills, mountains, snowcap, pines, pine, waves, lightPath, cypress, note, beamed, f, rng } = L

const maple = (cx, cy, s, col, vein) => {
  const h = [[0, -48], [9, -28], [20, -34], [17, -12], [38, -22], [32, -4], [48, 6], [22, 18], [25, 28], [6, 25], [3, 48]]
  const pts = h.concat(h.slice(1, -1).reverse().map(([x, y]) => [-x, y])).map(([x, y]) => [cx + x * s, cy + y * s])
  return poly(pts, col) + (vein ? stroke(`M${cx} ${cy + 46 * s}L${cx} ${cy - 30 * s}M${cx} ${cy + 18 * s}L${cx + 36 * s} ${cy - 10 * s}M${cx} ${cy + 18 * s}L${cx - 36 * s} ${cy - 10 * s}M${cx} ${cy - 2 * s}L${cx + 22 * s} ${cy - 24 * s}M${cx} ${cy - 2 * s}L${cx - 22 * s} ${cy - 24 * s}`, vein, 2.5 * s) : '')
}
module.exports = {
  'chopin-etude-op10-12': { pal: { bg: ['#1c0710'], ink: '#1c0710' }, draw: () => {
    let fl = ''; for (const [x, h, c] of [[40, 90, 0], [110, 130, 1], [190, 100, 0], [290, 140, 1], [400, 110, 0], [470, 95, 1]]) fl += M.flame(x, 330, h, c ? '#ff7a2c' : '#e2442a', '#ffd27a')
    let sky = bands(['#1c0710', '#4a0f1c', '#8f1a25', '#d9442a', '#ff9a3c', '#ffd27a'], 0, 360)
    const bld = [[0, 70, 280], [60, 50, 300], [110, 60, 270], [170, 40, 310], [210, 70, 285], [350, 50, 300], [400, 60, 275], [460, 70, 290]].map(([x, w, y]) => rect(x, y, w, 380 - y, '#2a0a14') + [0, 1, 2].map((i) => rect(x + 10 + i * 18, y + 18, 8, 12, '#ffb347', 'opacity=".85"')).join('')).join('')
    const smoke = cloud(120, 130, 190, '#2a0a14', 'opacity=".8"') + cloud(400, 100, 210, '#3a0e1a', 'opacity=".85"') + cloud(260, 180, 150, '#4a0f1c', 'opacity=".7"')
    const barr = poly([[0, 400], [512, 372], [512, 512], [0, 512]], '#12040a') + poly([[10, 392], [140, 360], [150, 384], [20, 420]], '#3a0c16') + poly([[150, 372], [300, 350], [304, 374], [152, 398]], '#4a1220') + poly([[310, 360], [440, 336], [448, 360], [318, 388]], '#3a0c16') +
      circ(86, 410, 46, 'none', 'stroke="#4a1220" stroke-width="9"') + [0, 1, 2, 3, 4, 5].map((i) => line(86, 410, 86 + 46 * Math.cos(i * Math.PI / 3), 410 + 46 * Math.sin(i * Math.PI / 3), '#4a1220', 5)).join('') + circ(86, 410, 9, '#4a1220')
    const flagY = 130
    const flag = rect(327, 100, 7, 330, '#12040a') + circ(330, 96, 8, '#ffd27a') + path(`M334 ${flagY - 12}C372 ${flagY - 34} 400 ${flagY + 6} 446 ${flagY - 12}L430 ${flagY + 12}L450 ${flagY + 34}L440 ${flagY + 40}C400 ${flagY + 58} 372 ${flagY + 22} 334 ${flagY + 40}Z`, '#fff1d6') + path(`M334 ${flagY + 4}C372 ${flagY - 18} 400 ${flagY + 22} 440 ${flagY + 2}L436 ${flagY + 16}C400 ${flagY + 34} 372 ${flagY + 4} 334 ${flagY + 22}Z`, '#d9442a')
    return sky + glow(250, 340, 90, '#ffd27a', 3, .14) + smoke + fl + bld + barr + flag + stars(10, 20, 150, 300, 290, 7, '#ffd27a', 5)
  } },
  'chopin-etude-op10-1': { pal: { bg: ['#062a35'], ink: '#04202a' }, draw: () => {
    let o = bands(['#062a35', '#0b3f4d', '#12596a'], 0, 440)
    ;[[370, '#0f4f5e'], [320, '#16707b'], [270, '#1f9a96'], [220, '#8fd9b6'], [170, '#f4d77a'], [120, '#ffb347'], [70, '#ff7a3d']].forEach(([r, c]) => { o += circ(256, 450, r, c) })
    o += M.sweepNotes(256, 450, 295, Math.PI * 1.04, Math.PI * 1.96, 9, 17, '#fff2d0') + M.sweepNotes(256, 450, 195, Math.PI * 1.08, Math.PI * 1.92, 7, 14, '#04202a') + M.sweepNotes(256, 450, 95, Math.PI * 1.12, Math.PI * 1.88, 5, 11, '#fff2d0')
    o += rect(0, 440, 512, 72, '#04202a') + Array.from({ length: 13 }, (_, i) => rect(i * 40 + 2, 446, 36, 70, '#f6f0dc', 'rx="4"')).join('') + [1, 2, 4, 5, 6, 8, 9, 11, 12].map((i) => rect(i * 40 - 11, 446, 22, 42, '#04202a', 'rx="3"')).join('')
    return o + stars(14, 20, 40, 500, 200, 3, '#bfe9d6', 5)
  } },
  'chopin-etude-op10-5': { pal: { bg: ['#120a2a'], ink: '#0a0418' }, draw: () => {
    let o = bands(['#0a0418', '#1c0a3c', '#33135f'], 0, 200) + M.spot(256, 120, 560, 0, 400, '#ff7ae6', .16)
    o += Array.from({ length: 8 }, (_, i) => rect(i * 64 + 2, 190, 60, 340, i % 2 ? '#e6dcf8' : '#f4ecff', 'rx="6"')).join('')
    o += [1, 2, 4, 5, 6].map((i) => glow(i * 64, 300, 40, '#ff4fd8', 2, .06).replace(/<circle/g, '<circle').slice(0, 0)).join('')
    for (const i of [1, 2, 4, 5, 6]) o += rect(i * 64 - 25, 170, 50, 260, '#0d0620', 'rx="7"') + rect(i * 64 - 20, 176, 8, 230, '#5a2fa8', 'rx="4"') + rect(i * 64 - 19, 420, 38, 8, '#ff4fd8', 'rx="3"') + rect(i * 64 - 25, 168, 50, 14, '#ff4fd8', 'opacity=".8" rx="6"')
    o += [[70, 160, '#ff7ae6'], [150, 130, '#7ae6ff'], [370, 150, '#ff7ae6'], [450, 125, '#7ae6ff']].map(([x, y, c], i) => note(x, y, 24, c, { flag: i % 2 === 0 })).join('') + stars(18, 10, 20, 500, 150, 9, '#e8d8ff', 6)
    return o
  } },
  'chopin-etude-op10-2': { pal: { bg: ['#0a1f2c'], ink: '#071520' }, draw: () => {
    let o = bands(['#0a1f2c', '#0f3a45', '#17606a', '#3fa58f', '#b8e07a'], 0, 460) + glow(410, 170, 52, '#fff2a8', 4, .13)
    o += mountains(400, [[120, 120, 110], [330, 90, 120]], '#12505a', 'opacity=".7"')
    for (let i = 0; i < 13; i++) { const black = [1, 3, 6, 8, 10].includes(i) || (i % 2 === 1); const y = 420 - i * 21 - (black ? 10 : 0); o += rect(18 + i * 36, y, 38, 520 - y, black ? '#0a1018' : '#f4f0dc', 'rx="3"') + rect(18 + i * 36, y, 38, 6, black ? '#2c4660' : '#ffffff') + rect(18 + i * 36 + 36, y + 6, 2, 520 - y, '#1f3a4a', 'opacity=".35"') }
    o += [[60, 330, 20], [160, 290, 18], [270, 240, 18], [370, 190, 16]].map(([x, y, s], i) => note(x, y, s, '#fff2a8', { flag: i % 2 === 0 })).join('') + stars(14, 20, 40, 300, 160, 5, '#bfe9d6', 5)
    return o
  } },
  'chopin-etude-op10-9': { pal: { bg: ['#2a1240'], ink: '#1a0a2c' }, draw: () => {
    let o = bands(['#2a1240', '#5a2060', '#a8386a', '#ee7a5a', '#ffc27a'], 0, 380) + glow(150, 372, 70, '#ffe0a0', 3, .14) + circ(150, 372, 70, '#fff0c8')
    o += hills(360, 16, '#5a1f58', 2, 3) + hills(400, 14, '#3a1448', 8, 3) + rect(0, 440, 512, 80, '#1a0a2c')
    const lean = (x, y, h) => tf(pine(0, 0, h, '#1a0a2c'), `translate(${x} ${y}) skewX(-16)`)
    o += [[300, 445, 150], [360, 450, 190], [425, 445, 140], [485, 452, 175], [90, 450, 90], [40, 445, 70]].map(([x, y, h]) => lean(x, y, h)).join('')
    o += [0, 1, 2, 3, 4, 5, 6].map((i) => stroke(`M${-20 + (i * 53) % 90} ${150 + i * 38}q${90 + i * 6} ${-30 + (i % 3) * 18} ${200 + i * 12} ${-6 + (i % 2) * 20}t${160} ${i % 2 ? 14 : -10}`, '#fff0e0', i % 2 ? 3 : 5, 'opacity=".42"')).join('')
    o += [[330, 210], [410, 250], [260, 300], [470, 180], [180, 250], [380, 330]].map(([x, y], i) => ell(x, y, 9, 4.5, i % 2 ? '#ffb347' : '#ff6a4a', `transform="rotate(${i * 40} ${x} ${y})"`)).join('')
    return o
  } },
  'chopin-etude-op25-1': { pal: { bg: ['#0c3a4a'], ink: '#062632' }, draw: () => {
    let o = bands(['#0c3a4a', '#17687a', '#46a3a6', '#bfe6d4', '#fff0d0'], 0, 400) + circ(380, 150, 44, '#fff6e0') + cloud(110, 130, 130, '#e8f6ee', 'opacity=".85"') + cloud(430, 230, 120, '#e8f6ee', 'opacity=".8"')
    o += mountains(400, [[110, 150, 120], [400, 190, 130]], '#2a8196') + mountains(420, [[250, 110, 140]], '#17687a') + rect(0, 440, 512, 80, '#062632')
    const X = (x) => 150 + (x - 150)
    const yt = (x) => 160 + (x - 150) * (80 / 215) - 44 * Math.sin(Math.PI * (x - 150) / 215), yb = (x) => 215 + (x - 150) * (200 / 215)
    let neck = 'M150 160', box = 'M150 215'
    for (let x = 150; x <= 365; x += 5) neck += `L${x} ${f(yt(x))}`
    for (let x = 150; x <= 365; x += 5) box += `L${x} ${f(yb(x))}`
    let strings = ''; for (let i = 0; i < 14; i++) { const x = 168 + i * 14.2; strings += line(x, yt(x) + 6, x, yb(x) - 6, '#fff0d0', 2.2) }
    o += tf(stroke(neck, '#8a4a22', 20) + stroke(box, '#c97b3a', 30) + rect(357, yt(365), 16, 440 - yt(365), '#8a4a22', 'rx="4"') + strings + circ(150, 160, 9, '#ffb347') + path(`M158 168L340 ${f(yb(340) - 15)}`, 'none', 'stroke="#e2a060" stroke-width="5" stroke-linecap="round" opacity=".5"'), 'translate(0 -4)')
    o += [0, 1, 2].map((i) => stroke(`M-10 ${210 + i * 55}C120 ${150 + i * 55} 200 ${290 + i * 40} 300 ${230 + i * 50}S470 ${200 + i * 40} 530 ${250 + i * 30}`, '#ffffff', 4 - i * .6, 'opacity=".7"')).join('')
    o += [[90, 200], [450, 300], [60, 340]].map(([x, y]) => sparkle(x, y, 10, '#ffffff')).join('')
    return o
  } },
  'chopin-etude-op25-2': { pal: { bg: ['#2a1204'], ink: '#1c0c04' }, draw: () => {
    let o = rect(0, 0, 512, 512, '#2a1204') + M.hexgrid(-20, -10, 540, 560, 36, ['#e8941c', '#f0aa2c', '#c9740e', '#f6c344', '#b05a0a'], 6) + circ(256, 250, 250, '#1c0c04', 'opacity=".34"') + glow(256, 250, 120, '#ffe08a', 3, .1)
    o += stroke('M120 400C40 330 60 220 150 240C230 260 250 140 330 110C400 90 440 150 400 200', '#fff6dc', 4, 'stroke-dasharray="3 14" opacity=".8"')
    o += M.bee(268, 262, 1.55, '#ffc933', '#1c0c04', '#fff6dc') + M.bee(90, 300, .4, '#ffc933', '#1c0c04', '#fff6dc') + M.bee(420, 140, .42, '#ffc933', '#1c0c04', '#fff6dc')
    return o
  } },
  'chopin-ballade-4': { pal: { bg: ['#140c2e'], ink: '#0b0620' }, draw: () => {
    let o = bands(['#140c2e', '#2a1858', '#4c2a82', '#7a4aa0', '#c28ac8'], 0, 360) + glow(330, 200, 88, '#ffe9c4', 4, .1) + circ(330, 200, 88, '#fff1d8')
    o += cloud(90, 250, 200, '#2a1858', 'opacity=".9"') + cloud(440, 120, 160, '#3a2070', 'opacity=".9"')
    const sail = (x, y1, y2, w) => path(`M${x - w} ${y1}Q${x} ${y1 + 12} ${x + w} ${y1}L${x + w * .86} ${y2}Q${x} ${y2 + 16} ${x - w * .86} ${y2}Z`, '#f3e3c9') + path(`M${x + w * .2} ${y1}Q${x + w * .55} ${y1 + 10} ${x + w} ${y1}L${x + w * .86} ${y2}Q${x + w * .5} ${y2 + 14} ${x + w * .2} ${y2}Z`, '#c9b0c8')
    o += waves(380, 1, ['#2a1858'], 8, 3, 56)
    o += poly([[110, 346], [420, 346], [392, 398], [330, 408], [190, 408], [140, 388]], '#0b0620') + rect(120, 346, 300, 5, '#7a4aa0') + stroke('M110 346L40 318', '#0b0620', 6)
    o += [[190, 120, 70], [264, 92, 78], [340, 130, 66]].map(([x, top, h]) => rect(x - 2.5, top - 14, 5, 346 - top + 14, '#0b0620')).join('')
    o += sail(190, 150, 214, 46) + sail(190, 226, 284, 52) + sail(264, 122, 190, 52) + sail(264, 204, 268, 58) + sail(340, 160, 220, 44) + sail(340, 232, 290, 50)
    o += poly([[110, 346], [186, 160], [186, 346]], '#e6d4bc', 'opacity=".9"').replace('/>', '/>') + poly([[110, 346], [60, 322], [186, 160]], '#c9b0c8')
    o += [190, 264, 340].map((x, i) => poly([[x, [106, 78, 116][i]], [x + 30, [112, 84, 122][i]], [x, [118, 90, 128][i]]], '#ff8a5c')).join('')
    o += waves(392, 5, ['#1c1040', '#2a1858', '#140c2e', '#0b0620'], 9, 5, 50) + stars(16, 10, 30, 240, 200, 4, '#f0e0ff', 6)
    return o
  } },
  'chopin-ballade-1': { pal: { bg: ['#0f1b33'], ink: '#070e1c' }, draw: () => {
    let o = bands(['#0f1b33', '#1d3354', '#31527a', '#6d87a8', '#d7c9a8'], 0, 400) + glow(256, 220, 96, '#fff0cf', 4, .1) + circ(256, 220, 96, '#fff4d8') + stars(20, 10, 30, 500, 250, 3, '#dde8ff', 6)
    o += mountains(370, [[60, 170, 120], [450, 150, 130]], '#22385a')
    const tower = (x, y, w, h, roof) => rect(x, y - h, w, h, '#070e1c') + poly([[x - 5, y - h], [x + w / 2, y - h - roof], [x + w + 5, y - h]], '#070e1c') + rect(x + w / 2 - 4, y - h + 14, 8, 14, '#ffcf6a')
    o += mountains(480, [[256, 160, 260]], '#0c1a30')
    o += tower(212, 330, 28, 110, 40) + tower(272, 330, 28, 140, 50) + rect(190, 300, 130, 40, '#070e1c') + tower(180, 330, 24, 70, 30) + tower(312, 330, 24, 80, 34) + [0, 1, 2, 3, 4, 5].map((i) => rect(194 + i * 22, 292, 12, 12, '#070e1c')).join('') + [0, 1, 2].map((i) => rect(210 + i * 40, 312, 8, 14, '#ffcf6a')).join('')
    o += poly([[256, 440], [200, 512], [330, 512]], '#d7c9a8', 'opacity=".0"')
    o += rect(0, 400, 512, 112, '#070e1c') + rect(0, 380, 512, 30, '#6d87a8', 'opacity=".25"') + rect(0, 396, 512, 12, '#31527a', 'opacity=".25"')
    o += [[90, 140], [140, 110], [400, 130], [370, 170]].map(([x, y]) => L.path(`M${x - 14} ${y}Q${x - 6} ${y - 8} ${x} ${y}Q${x + 6} ${y - 8} ${x + 14} ${y}Q${x + 6} ${y - 2} ${x} ${y + 4}Q${x - 6} ${y - 2} ${x - 14} ${y}Z`, '#070e1c')).join('')
    return o
  } },
  'chopin-fantaisie-impromptu': { pal: { bg: ['#08102e'], ink: '#050a20' }, draw: () => {
    let o = bands(['#050a20', '#0a1440', '#12206a'], 0, 512) + glow(256, 250, 40, '#ffffff', 5, .12)
    const arm = (a0, col, w, r0, k) => { let d = ''; for (let t = 0; t <= 3.3 * Math.PI; t += .12) { const r = (r0 + k * t) * .82, a = a0 + t; d += (t ? 'L' : 'M') + f(256 + r * Math.cos(a)) + ' ' + f(250 + r * Math.sin(a) * .9) } return stroke(d, col, w) }
    const cols = ['#45d1ff', '#ff4f9a', '#3b5bff', '#bdeaff']
    for (let i = 0; i < 4; i++) o += arm(i * Math.PI / 2, cols[i], 26 - i * 3, 14, 20) + arm(i * Math.PI / 2, '#ffffff', 5, 14, 20)
    let nn = ''; for (let i = 0; i < 4; i++) for (let k = 1; k < 7; k++) { const t = k * .5 + .2, r = 12 + 16 * t + 14, a = i * Math.PI / 2 + t; nn += note(256 + r * Math.cos(a), 250 + r * Math.sin(a) * .9, 10 + k * 2.8, k % 2 ? '#fff6d0' : '#ffd27a', { flag: k % 2 === 0 }) }
    return o + nn + circ(256, 250, 20, '#ffffff') + stars(26, 10, 10, 500, 500, 8, '#cfe6ff', 6)
  } },
  'liszt-ballade-2': { pal: { bg: ['#071826'], ink: '#04101a' }, draw: () => {
    let o = bands(['#071826', '#0c2c40', '#144a60', '#2a7a88'], 0, 380) + cloud(120, 110, 220, '#04101a', 'opacity=".85"') + cloud(380, 80, 240, '#0c2c40', 'opacity=".9"') + L.lightning(380, 120, 90, '#fff4c8')
    o += poly([[128, 150], [500, 80], [500, 210]], '#fff4c8', 'opacity=".22"')
    o += poly([[40, 440], [60, 360], [170, 350], [200, 440]], '#04101a') + poly([[100, 350], [106, 200], [134, 200], [140, 350]], '#f4ece0') + poly([[104, 300], [137, 300], [138, 330], [102, 330]], '#c2302a') + poly([[104, 236], [136, 236], [136, 262], [105, 262]], '#c2302a') + rect(98, 188, 44, 12, '#04101a') + rect(106, 164, 28, 24, '#ffd45c') + poly([[100, 164], [120, 140], [140, 164]], '#04101a')
    o += path('M-10 440C60 400 150 300 270 250C360 210 440 230 470 300C430 280 400 280 390 310C420 310 440 340 420 380C460 350 500 370 522 400L522 522L-10 522Z', '#1f6b7c') + path('M120 440C190 400 250 330 330 300C380 290 420 300 440 330C410 320 385 330 380 350C400 350 410 365 400 380C380 370 350 390 340 400L-10 522Z', '#2a8f9a', 'opacity=".8"') + path('M270 250C360 210 440 230 470 300C430 280 400 280 390 310C440 290 450 240 400 225C350 215 300 235 270 250Z', '#e8f6f0')
    o += [[400, 250, 7], [430, 235, 5], [378, 222, 6], [455, 270, 4], [335, 245, 5]].map(([x, y, r]) => circ(x, y, r, '#e8f6f0')).join('')
    o += waves(430, 3, ['#144a60', '#0c2c40', '#04101a'], 10, 6, 52)
    return o
  } },
  'scriabin-etude-op2-1': { pal: { bg: ['#120826'], ink: '#0a0418' }, draw: () => {
    let o = bands(['#0a0418', '#160a32', '#220f46', '#38176a'], 0, 512) + stars(50, 0, 0, 512, 512, 2, '#e8d8ff', 7)
    const cols = ['#ff4b4b', '#ff9a3c', '#ffd93c', '#b6e05a', '#4bd98a', '#35d0d0', '#3b9bff', '#5b5bff', '#8f4bff', '#c24bff', '#ff4bd8', '#ff4b8c']
    o += circ(256, 235, 190, '#ffffff', 'opacity=".05"') + circ(256, 235, 168, '#ffffff', 'opacity=".06"')
    cols.forEach((c, i) => { const a0 = i * Math.PI / 6 - Math.PI / 2, a1 = a0 + Math.PI / 6 - .04, R = 148, r = 88; o += path(`M${f(256 + r * Math.cos(a0))} ${f(235 + r * Math.sin(a0))}L${f(256 + R * Math.cos(a0))} ${f(235 + R * Math.sin(a0))}A${R} ${R} 0 0 1 ${f(256 + R * Math.cos(a1))} ${f(235 + R * Math.sin(a1))}L${f(256 + r * Math.cos(a1))} ${f(235 + r * Math.sin(a1))}A${r} ${r} 0 0 0 ${f(256 + r * Math.cos(a0))} ${f(235 + r * Math.sin(a0))}Z`, c) })
    o += circ(256, 235, 80, '#0a0418') + rays(256, 235, 26, 74, 16, '#ffd45c', .9) + circ(256, 235, 22, '#fff4c8') + rays(256, 235, 158, 200, 24, '#ffffff', .22)
    return o + rect(0, 440, 512, 72, '#0a0418', 'opacity=".5"')
  } },
}
