// Schubert, Schumann, Brahms, Grieg, Tchaikovsky, Mendelssohn.
const L = require('./lib.js'), M = require('./motifs.js')
const { rect, circ, ell, path, poly, line, stroke, g, tf, op, bands, glow, sparkle, stars, moon, cloud, rays, hills, mountains, snowcap, pines, pine, waves, lightPath, cypress, birch, note, f, rng } = L
const dove = (x, y, s, col, shade) => tf(path('M-40 4Q-10 -14 30 -6Q50 -2 62 -14Q60 4 44 12Q10 28 -40 4Z', col) + path('M-6 -4Q-24 -70 24 -92Q20 -50 24 -8Z', col) + path('M-6 -4Q-40 -40 -56 -34Q-34 -4 -6 4Z', shade) + path('M-40 4L-80 -4L-76 14Z', shade) + circ(60, -14, 12, col) + path('M70 -16L90 -10L70 -6Z', '#e8a040') + circ(64, -17, 2.5, '#2a1a30'), `translate(${x} ${y}) scale(${s})`)
const swan = (x, y, s, col, beak, dark) => tf(path('M-80 10Q-70 -26 -20 -24Q20 -24 44 -44Q70 -30 60 8Q30 24 -20 26Q-60 28 -80 10Z', col) + stroke('M44 -40Q80 -50 76 -90Q74 -122 50 -122', col, 15) + circ(50, -122, 14, col) + path('M42 -126L22 -118L42 -112Z', beak) + circ(50, -126, 2.5, dark) + path('M-80 10Q-100 0 -96 -16Q-80 -4 -62 -10Z', col), `translate(${x} ${y}) scale(${s})`)
const dwarf = (x, y, s, body, hat, lan) => tf(path('M-16 -50Q-18 -20 -16 0L16 0Q18 -20 16 -50Q0 -58 -16 -50Z', body) + circ(0, -62, 12, '#e8b890') + path('M-13 -66L-6 -118L0 -112L12 -66Z', hat) + path('M-12 -60Q-14 -30 0 -22Q14 -30 12 -60Q0 -48 -12 -60Z', '#e8e0d0') + rect(-14, -2, 12, 14, '#2a1a10') + rect(2, -2, 12, 14, '#2a1a10') + stroke('M14 -40Q36 -40 40 -26', body, 6) + rect(37, -26, 2, 12, '#2a1a10') + rect(30, -14, 16, 20, lan) + circ(38, -4, 24, lan, 'opacity=".2"'), `translate(${x} ${y}) scale(${s})`)
const fairy = (x, y, s) => tf(ell(-30, -38, 30, 14, '#cfe8ff', 'opacity=".75" transform="rotate(-30 -30 -38)"') + ell(30, -38, 30, 14, '#cfe8ff', 'opacity=".75" transform="rotate(30 30 -38)"') + ell(-22, -14, 20, 9, '#ffd8f0', 'opacity=".7" transform="rotate(30 -22 -14)"') + ell(22, -14, 20, 9, '#ffd8f0', 'opacity=".7" transform="rotate(-30 22 -14)"') + circ(0, -48, 11, '#ffe6d0') + path('M-8 -54Q0 -68 10 -52Q4 -46 -8 -54Z', '#8a5a3a') + path('M-8 -38L8 -38L26 8L-26 8Z', '#e86ab8') + stroke('M0 -34L0 -16', '#e86ab8', 6) + rect(-8, 6, 5, 22, '#ffe6d0') + rect(3, 6, 5, 22, '#ffe6d0') + stroke('M14 -26Q40 -40 52 -66', '#fff0b0', 3) + sparkle(54, -70, 10, '#fff0b0'), `translate(${x} ${y}) scale(${s})`)
module.exports = {
  'schubert-impromptu-90-1': { pal: { bg: ['#1c2440'], ink: '#0c1226' }, draw: () => {
    let o = bands(['#1c2440', '#3a4470', '#7a6a90', '#d89a8a', '#ffd8a0'], 0, 330) + glow(330, 300, 54, '#fff0c8', 3, .14) + circ(330, 300, 54, '#fff6dc') + cloud(110, 170, 180, '#7a6a90', 'opacity=".7"')
    o += mountains(340, [[110, 150, 120], [400, 190, 140], [250, 110, 100]], '#4a4e7a') + mountains(370, [[40, 100, 110], [470, 120, 110]], '#2a3058') + rect(0, 360, 512, 160, '#14183a')
    o += path('M236 360Q290 380 250 410Q180 440 250 470Q330 490 300 520L120 520Q160 490 110 470Q50 440 170 410Q220 390 224 360Z', '#d8b890') + path('M236 360Q290 380 250 410Q180 440 250 470', 'none', 'stroke="#f4dcb0" stroke-width="3" opacity=".6"')
    o += tf(path('M-9 -56Q-12 -30 -12 -4L12 -4Q12 -30 9 -56Z', '#0c1226') + circ(0, -64, 10, '#0c1226') + path('M-16 -76L16 -76L10 -70L-10 -70Z', '#0c1226') + stroke('M12 -46L24 -60', '#0c1226', 5) + rect(22, -86, 4, 90, '#0c1226') + stroke('M-12 -4L-14 14M12 -4L16 14', '#0c1226', 6), 'translate(225 408) scale(.95)')
    return o + stars(14, 10, 20, 500, 180, 3, '#e8e0ff', 5)
  } },
  'schubert-impromptu-90-2': { pal: { bg: ['#0e3a2a'], ink: '#06201a' }, draw: () => {
    let o = bands(['#06201a', '#0e3a2a', '#1a5a3a', '#4a9a58', '#c8e48a'], 0, 460) + rays(256, 60, 20, 700, 18, '#fff6c0', .18)
    o += pines([[40, 470, 380], [110, 480, 300], [480, 470, 400], [420, 480, 310]], '#06201a') + pines([[180, 300, 150], [330, 300, 160], [270, 290, 120]], '#14502e')
    o += path('M210 300Q300 330 240 380Q150 430 260 470Q330 500 300 522L120 522Q170 480 90 440Q30 400 150 360Q210 330 200 300Z', '#5ab8c8') + path('M236 310Q290 335 240 380Q170 420 246 460', 'none', 'stroke="#e8f8ff" stroke-width="4" opacity=".85"')
    for (const [x, y, w] of [[210, 360, 60], [200, 420, 80], [250, 470, 70], [170, 500, 60], [225, 330, 40]]) o += stroke(`M${x - w / 2} ${y}q${w / 4} -8 ${w / 2} 0t${w / 2} 0`, '#ffffff', 3.5, 'opacity=".8"')
    o += [[100, 500, 30], [370, 490, 40], [420, 440, 26]].map(([x, y, r]) => ell(x, y, r, r * .6, '#06201a')).join('') + [[330, 150], [150, 200], [420, 240]].map(([x, y]) => sparkle(x, y, 8, '#fff6c0')).join('')
    return o + [[300, 200], [200, 150], [350, 250], [140, 280]].map(([x, y], i) => ell(x, y, 5, 2.6, '#ffe58a', `transform="rotate(${i * 50} ${x} ${y})"`)).join('')
  } },
  'schubert-impromptu-90-4': { pal: { bg: ['#06303a'], ink: '#03202a' }, draw: () => {
    let o = bands(['#03202a', '#06303a', '#0a4452', '#126070'], 0, 512) + glow(256, 120, 60, '#cfe8ff', 3, .1) + circ(256, 120, 50, '#e8f2ff', 'opacity=".25"')
    for (const r of [200, 150, 105, 66, 32]) o += ell(256, 270, r * 1.4, r * .5, 'none', `stroke="#8fe0e0" stroke-width="3" opacity="${f(.15 + (200 - r) / 400)}"`)
    const pad = (x, y, w, c) => ell(x, y, w, w * .36, c) + poly([[x, y], [x + w * .9, y - w * .12], [x + w * .9, y + w * .1]], '#0a4452')
    o += pad(90, 400, 76, '#2a9a6a') + pad(420, 380, 84, '#2a9a6a') + pad(300, 460, 70, '#1f8a5a') + pad(150, 180, 54, '#1f8a5a') + pad(400, 160, 50, '#2a9a6a') + pad(100, 290, 50, '#2a9a6a')
    const lotus = (x, y, s) => [-50, -25, 0, 25, 50].map((a) => ell(x, y - s * .5, s * .2, s * .55, a ? '#ff9ac0' : '#ffc2d8', `transform="rotate(${a} ${x} ${y})"`)).join('') + ell(x, y - s * .3, s * .15, s * .38, '#ffe0ec') + ell(x, y + 2, s * .55, s * .14, '#ff7aa8')
    o += lotus(256, 280, 120) + lotus(90, 390, 52) + lotus(420, 370, 58)
    o += tf(ell(0, 0, 3, 22, '#ffe58a') + ell(-16, -4, 16, 5, '#cfe8ff', 'opacity=".8" transform="rotate(-20)"') + ell(16, -4, 16, 5, '#cfe8ff', 'opacity=".8" transform="rotate(20)"') + circ(0, -22, 4, '#ffe58a'), 'translate(390 250) rotate(40)')
    return o + stars(10, 10, 10, 500, 90, 3, '#cfe8ff', 5)
  } },
  'schubert-impromptu-142-1': { pal: { bg: ['#06122a'], ink: '#030a1c' }, draw: () => {
    let o = bands(['#030a1c', '#06122a', '#0c2848', '#145a6a'], 0, 400) + stars(30, 10, 20, 500, 220, 2, '#e8f4ff', 5)
    o += [['#3ae0a0', 90], ['#58f0c8', 60], ['#7ad0ff', 40]].map(([c, w], i) => path(`M-20 ${200 + i * 20}C100 ${90 + i * 30} 200 ${230 - i * 20} 300 ${110 + i * 10}S470 ${60 + i * 20} 540 ${130 + i * 10}L540 ${130 + i * 10 + w}C470 ${60 + i * 20 + w} 380 ${200 + w} 300 ${110 + i * 10 + w}S100 ${230 + w} -20 ${200 + i * 20 + w}Z`, c, `opacity="${.28 - i * .05}"`)).join('')
    o += hills(380, 14, '#c8e0f0', 4, 3) + hills(410, 12, '#8ab0d0', 9, 3) + rect(0, 450, 512, 70, '#e8f4ff')
    o += pines([[40, 440, 220], [100, 450, 160], [470, 440, 240], [410, 452, 170], [330, 430, 90]], '#030a1c')
    o += rect(180, 350, 160, 100, '#4a2a1a') + poly([[165, 352], [260, 280], [355, 352]], '#e8f4ff') + poly([[175, 350], [260, 288], [345, 350]], '#2a1a14', 'opacity=".0"') + rect(205, 380, 34, 34, '#ffcf6a') + rect(280, 380, 34, 34, '#ffcf6a') + rect(255, 405, 0, 0, '#000') + rect(243, 395, 30, 55, '#2a1a14') + rect(298, 308, 18, 40, '#4a2a1a') + rect(294, 300, 26, 10, '#e8f4ff') + circ(256, 410, 160, '#ffcf6a', 'opacity=".06"')
    o += [0, 1, 2, 3, 4, 5].map((i) => stroke(`M${300 + i * 4} ${290 - i * 28}q12 -12 0 -24`, '#c8d8e8', 5, 'opacity=".5"')).join('').slice(0, 0)
    return o + Array.from({ length: 40 }, (_, i) => circ((i * 137) % 512, (i * 71) % 440, 2 + i % 3, '#ffffff', 'opacity=".8"')).join('')
  } },
  'schubert-impromptu-142-2': { pal: { bg: ['#3a1a4a'], ink: '#1a0a28' }, draw: () => {
    let o = bands(['#3a1a4a', '#7a2a6a', '#c04a6a', '#f08a5a', '#ffc87a'], 0, 330) + glow(256, 330, 80, '#fff0c0', 4, .12) + circ(256, 330, 80, '#fff4d0')
    o += cloud(100, 170, 190, '#c04a6a', 'opacity=".7"') + cloud(420, 140, 160, '#7a2a6a', 'opacity=".7"')
    o += mountains(332, [[80, 60, 100], [440, 80, 110]], '#3a1a4a') + rect(0, 330, 512, 190, '#2a1040') + lightPath(256, 336, 500, '#ffc87a', 150, 8)
    o += waves(430, 3, ['#3a1a4a', '#2a1040', '#1a0a28'], 5, 4, 50)
    o += swan(260, 400, 1.25, '#fff4e4', '#f0a040', '#1a0a28') + ell(260, 424, 120, 8, '#f6dcc0', 'opacity=".35"')
    return o + stars(14, 10, 20, 500, 110, 3, '#ffe0e8', 5)
  } },
  'schubert-moment-musical-3': { pal: { bg: ['#6ab0e8'], ink: '#1a3a5a' }, draw: () => {
    let o = bands(['#5aa0e0', '#7ab8ee', '#a8d4f6', '#ffe8c0'], 0, 330) + glow(400, 150, 40, '#fff6c0', 3, .15) + circ(400, 150, 38, '#fff9d8') + cloud(110, 130, 170, '#ffffff', 'opacity=".9"') + cloud(300, 190, 120, '#ffffff', 'opacity=".8"')
    o += mountains(340, [[130, 190, 130], [380, 230, 150]], '#6a88b8') + snowcap(130, 340, 190, 130, '#ffffff') + snowcap(380, 340, 230, 150, '#ffffff') + mountains(380, [[250, 90, 140]], '#4a8a68')
    o += hills(390, 12, '#5ab858', 3, 3) + hills(430, 12, '#3a9a48', 8, 3) + rect(0, 470, 512, 50, '#2a7a3a')
    o += rect(320, 340, 90, 70, '#8a5230') + poly([[308, 342], [365, 292], [422, 342]], '#c2302a') + rect(338, 362, 22, 22, '#ffe08a') + rect(375, 372, 22, 38, '#4a2a18')
    const r = rng(4); const fc = ['#ff5a7a', '#ffd93c', '#ffffff', '#ff9a3c']
    for (let i = 0; i < 38; i++) { const x = r() * 512, y = 420 + r() * 90; o += stroke(`M${f(x)} ${f(y + 8)}L${f(x)} ${f(y)}`, '#2a7a3a', 2) + circ(x, y, 3.5 + r() * 3, fc[i % 4]) }
    o += tf(path('M-10 -6Q-12 14 -16 20L16 20Q12 14 10 -6Z', '#d8a040') + rect(-2, -14, 4, 8, '#2a1a10') + circ(0, 20, 4, '#2a1a10'), 'translate(130 410) scale(1.1)') + stroke('M130 388L130 360', '#6a4a2a', 3)
    return o
  } },
  'schumann-traumerei': { pal: { bg: ['#1c1a4a'], ink: '#0e0c2e' }, draw: () => {
    let o = bands(['#0e0c2e', '#1c1a4a', '#2e2a72', '#4a3a92'], 0, 512) + stars(40, 10, 10, 500, 360, 4, '#e8e0ff', 7)
    o += circ(256, 200, 190, '#f6e8b0', 'opacity=".06"') + circ(256, 200, 150, '#f6e8b0', 'opacity=".07"') + moon(256, 210, 118, '#fbeec0', { crescent: .62 })
    for (const [x, y, len] of [[170, 270, 100], [210, 310, 130], [150, 220, 70]]) o += line(x, y, x, y + len, '#f6e8b0', 2, 'opacity=".6"') + sparkle(x, y + len, 12, '#fff3c0')
    o += cloud(110, 420, 260, '#6a5ab8', 'opacity=".9"') + cloud(400, 440, 280, '#8a78d0') + cloud(250, 470, 300, '#a894e8') + cloud(60, 480, 200, '#a894e8')
    o += tf(poly([[-44, 0], [44, 0], [28, 26], [-28, 26]], '#f6f0e0') + poly([[0, 0], [0, -62], [40, 0]], '#e0d6f0') + poly([[0, -4], [0, -62], [-36, -4]], '#fff8e8') + rect(-1.5, -62, 3, 66, '#cfc4e8'), 'translate(300 380) rotate(-6)')
    o += stroke('M110 300Q200 330 230 300', 'none', 'opacity="0"')
    return o
  } },
  'brahms-intermezzo-118-2': { pal: { bg: ['#3a1c14'], ink: '#1e0c08' }, draw: () => {
    let o = bands(['#2a1410', '#5a2a1c', '#a8502a', '#e0884a', '#ffc27a'], 0, 400) + glow(120, 360, 60, '#ffe0a0', 3, .12) + circ(120, 360, 56, '#fff0c8')
    o += hills(390, 12, '#5a2a1c', 3, 3) + rect(0, 430, 512, 90, '#1e0c08') + hills(420, 8, '#2e1610', 6, 4)
    o += rect(318, 190, 30, 250, '#1e0c08') + stroke('M333 260Q280 220 250 150M333 230Q390 190 440 150M333 300Q290 290 240 300M333 210Q330 150 350 100M333 280Q390 270 450 240', '#1e0c08', 14) + stroke('M280 190Q250 170 220 130M400 190Q430 170 460 130M350 140Q380 120 400 90', '#1e0c08', 7)
    const r = rng(8); const lc = ['#e8742a', '#ffb347', '#c2302a', '#f0a030']
    for (let i = 0; i < 56; i++) { const a = r() * 6.28, d = r() * 150; const x = 335 + Math.cos(a) * d * 1.1, y = 160 + Math.sin(a) * d * .6; o += path(`M${f(x)} ${f(y - 9)}Q${f(x + 8)} ${f(y)} ${f(x)} ${f(y + 9)}Q${f(x - 8)} ${f(y)} ${f(x)} ${f(y - 9)}Z`, lc[i % 4], `transform="rotate(${Math.floor(r() * 180)} ${f(x)} ${f(y)})"`) }
    for (let i = 0; i < 18; i++) { const x = 20 + r() * 470, y = 250 + r() * 220; o += path(`M${f(x)} ${f(y - 8)}Q${f(x + 7)} ${f(y)} ${f(x)} ${f(y + 8)}Q${f(x - 7)} ${f(y)} ${f(x)} ${f(y - 8)}Z`, lc[i % 4], `transform="rotate(${Math.floor(r() * 180)} ${f(x)} ${f(y)})"`) }
    o += rect(130, 390, 130, 10, '#e0a060') + rect(138, 400, 8, 38, '#e0a060') + rect(244, 400, 8, 38, '#e0a060') + rect(130, 366, 130, 8, '#e0a060') + rect(136, 366, 6, 30, '#e0a060') + rect(248, 366, 6, 30, '#e0a060')
    return o
  } },
  'brahms-waltz-39-10': { pal: { bg: ['#0e3a30'], ink: '#06201a' }, draw: () => {
    let o = bands(['#06201a', '#0e3a30', '#16503e'], 0, 512) + glow(256, 270, 150, '#ffe4a0', 3, .07)
    const gold = '#f4c46a'
    o += rect(253, 0, 6, 120, gold) + circ(256, 120, 14, gold) + path('M256 134Q150 134 120 200M256 134Q362 134 392 200', 'none', `stroke="${gold}" stroke-width="7"`) + path('M256 134Q200 190 176 290M256 134Q312 190 336 290', 'none', `stroke="${gold}" stroke-width="6"`) + path('M256 134L256 330', 'none', `stroke="${gold}" stroke-width="6"`)
    for (const [x, y] of [[120, 200], [176, 290], [256, 330], [336, 290], [392, 200]]) o += rect(x - 5, y - 28, 10, 28, '#fff4d8') + M.flame(x, y - 28, 22, '#ffb347', '#fff2b0') + circ(x, y - 40, 34, '#ffb347', 'opacity=".12"') + ell(x, y + 2, 20, 5, gold)
    for (const [x, y] of [[120, 206], [176, 296], [256, 336], [336, 296], [392, 206]]) o += line(x, y + 4, x, y + 36 + (x % 3) * 10, '#cfe8ff', 2) + path(`M${x} ${y + 40 + (x % 3) * 10}l-6 10l6 10l6 -10Z`, '#cfe8ff')
    o += stroke('M-10 430Q130 380 256 430T522 430', '#ff9ac0', 12, 'opacity=".5"') + stroke('M-10 460Q130 410 256 460T522 460', '#f4c46a', 8, 'opacity=".5"')
    o += stars(18, 10, 10, 500, 100, 7, '#ffe8b0', 6)
    return o + [[70, 300], [450, 310], [90, 220], [440, 240]].map(([x, y]) => sparkle(x, y, 11, '#ffe8b0')).join('')
  } },
  'grieg-mountain-king': { pal: { bg: ['#1a0804'], ink: '#0e0402' }, draw: () => {
    let o = bands(['#0e0402', '#2a0c06', '#5a1a0a', '#a8300e'], 0, 512) + glow(256, 330, 140, '#ff8a2c', 3, .1)
    o += path('M-10 520L-10 100Q60 60 100 130Q130 40 200 60Q256 20 312 60Q380 40 412 130Q452 60 522 100L522 520Z', '#0e0402')
    o += path('M80 520L80 300Q100 190 256 170Q412 190 432 300L432 520Z', '#a8300e', 'opacity=".25"') + path('M120 520L120 310Q140 220 256 200Q372 220 392 310L392 520Z', '#ff8a2c', 'opacity=".25"')
    for (const [x, w, h] of [[30, 30, 70], [90, 36, 110], [150, 24, 60], [200, 30, 90], [270, 24, 50], [320, 34, 120], [380, 26, 70], [440, 34, 100], [490, 22, 60]]) o += poly([[x - w / 2, 60], [x + w / 2, 60], [x, 60 + h]], '#0e0402')
    o += [[150, 290], [230, 250], [300, 250], [360, 290]].map(([x, y], i) => ell(x, y, 12, i % 2 ? 6 : 8, '#ffe03c', `transform="rotate(${i % 2 ? -14 : 14} ${x} ${y})"`) + ell(x + 34, y, 12, i % 2 ? 6 : 8, '#ffe03c', `transform="rotate(${i % 2 ? 14 : -14} ${x + 34} ${y})"`) + ell(x + 2, y, 3, 6, '#0e0402') + ell(x + 34, y, 3, 6, '#0e0402')).join('')
    o += poly([[0, 520], [0, 380], [60, 400], [120, 440], [140, 520]], '#0e0402') + poly([[512, 520], [512, 390], [450, 410], [390, 450], [370, 520]], '#0e0402') + poly([[160, 520], [200, 440], [312, 440], [352, 520]], '#2a0c06')
    o += tf(poly([[-34, 0], [-34, -34], [-20, -16], [0, -42], [20, -16], [34, -34], [34, 0]], '#f4c46a') + circ(0, -44, 5, '#c2302a') + circ(-34, -36, 4, '#c2302a') + circ(34, -36, 4, '#c2302a') + rect(-34, -4, 68, 8, '#c9983a'), 'translate(256 440)')
    o += M.flame(70, 395, 60, '#ff8a2c', '#ffe03c') + rect(66, 395, 8, 40, '#4a2a14') + M.flame(442, 410, 60, '#ff8a2c', '#ffe03c') + rect(438, 410, 8, 40, '#4a2a14')
    return o
  } },
  'grieg-troldhaugen': { pal: { bg: ['#4a90d8'], ink: '#14304a' }, draw: () => {
    let o = bands(['#4a90d8', '#72b0ea', '#a8d4f6', '#e8f4ff'], 0, 300) + cloud(100, 110, 170, '#ffffff', 'opacity=".9"') + cloud(420, 150, 140, '#ffffff', 'opacity=".9"')
    o += tf(circ(0, 0, 22, 'none', 'stroke="#ffd45c" stroke-width="7"') + circ(24, 8, 22, 'none', 'stroke="#f4a82c" stroke-width="7"'), 'translate(430 214) rotate(-20)') + sparkle(380, 186, 12, '#ffe58a')
    o += mountains(300, [[80, 190, 120], [440, 210, 130]], '#4a6a9a') + snowcap(80, 300, 190, 120, '#ffffff') + snowcap(440, 300, 210, 130, '#ffffff') + mountains(310, [[260, 100, 130]], '#2a4a78')
    o += rect(0, 300, 512, 220, '#1a5a8a') + lightPath(256, 310, 400, '#cfe8ff', 100, 6).slice(0, 0) + waves(330, 3, ['#1a5a8a', '#14487a', '#0e3a68'], 4, 6, 60).slice(0, 0)
    o += path('M-10 330C60 300 160 330 230 380C300 430 400 410 522 380L522 522L-10 522Z', '#3a8a48') + path('M-10 400C100 380 200 430 300 450C380 465 450 440 522 450L522 522L-10 522Z', '#2a7038')
    o += rect(310, 350, 100, 68, '#c2302a') + poly([[298, 352], [360, 302], [422, 352]], '#4a2a1a') + rect(322, 368, 20, 22, '#fff4d8') + rect(354, 368, 20, 22, '#fff4d8') + rect(386, 368, 16, 22, '#fff4d8') + rect(342, 394, 22, 24, '#fff4d8') + rect(296, 350, 126, 5, '#fff4d8') + rect(380, 318, 14, 28, '#c2302a')
    o += [[90, 420, 140], [150, 440, 100], [460, 440, 110]].map(([x, y, h]) => birch(x, y, h, '#f6f0e0', '#2a2a2a', x) + circ(x, y - h, h * .22, '#7ac86a') + circ(x - h * .1, y - h * .85, h * .14, '#5ab858')).join('')
    return o
  } },
  'grieg-troldtog': { pal: { bg: ['#0a2a2a'], ink: '#041616' }, draw: () => {
    let o = bands(['#041616', '#0a2a2a', '#124444', '#1f6a60'], 0, 512) + glow(400, 120, 40, '#e8f4c8', 3, .1) + circ(400, 120, 36, '#f4f8d8') + stars(24, 10, 10, 360, 200, 3, '#d8f4e0', 5)
    o += pines([[20, 330, 300], [90, 320, 220], [460, 320, 320], [510, 330, 260], [320, 300, 150], [190, 300, 140]], '#06282a')
    o += hills(380, 12, '#0a3a38', 4, 3) + rect(0, 400, 512, 120, '#041616')
    const cols = ['#c2302a', '#2a6ac2', '#c28a2a', '#7a2ac2', '#2ac28a']
    ;[[70, 372, 1.0], [165, 376, 1.12], [262, 372, 1.25], [362, 376, 1.12], [452, 372, 1.0]].forEach(([x, y, s], i) => { o += dwarf(x, y + 10, s * 1.5, '#0c2a2a', cols[i], '#ffcf6a') + path(`M${x - 13 * s} ${y - 56 * s - 12}L${x - 6 * s} ${y - 118 * s * 1.05 - 6}L${x} ${y - 112 * s * 1.05 - 6}L${x + 12 * s} ${y - 66 * s - 12}Z`, cols[i], 'opacity="0"') })
    o += tf(path('M-13 -66L-6 -118L0 -112L12 -66Z', '#c2302a'), 'translate(0 0)').slice(0, 0)
    return o
  } },
  'tchaikovsky-dumka': { pal: { bg: ['#3a2a5a'], ink: '#1a1030' }, draw: () => {
    let o = bands(['#1a1030', '#3a2a5a', '#6a3a7a', '#c25a5a', '#ffa860'], 0, 380) + glow(256, 330, 90, '#ffd8a0', 4, .1) + circ(256, 330, 90, '#ffe8c0')
    o += rect(0, 380, 512, 140, '#e8e4f4') + rect(0, 380, 512, 6, '#ffa860', 'opacity=".4"') + hills(420, 10, '#c8c4e0', 3, 4)
    o += [[30, 130], [90, 160], [150, 180], [230, 120], [330, 190], [390, 140], [450, 170], [490, 120]].map(([x, h], i) => birch(x, 470 - (i % 3) * 14, h * 2.2, '#f6f0e0', '#1a1030', i + 3)).join('')
    o += [[60, 40], [150, 50], [330, 30], [420, 40], [260, 60]].map(([x, h]) => '').join('')
    o += stroke('M-10 470Q130 440 260 470T522 470', '#a8a4d0', 5, 'opacity=".6"')
    const r = rng(6); for (let i = 0; i < 70; i++) o += circ(r() * 512, r() * 470, 1.6 + r() * 2.4, '#ffffff', 'opacity=".85"')
    o += M.lantern(256, 478, 1.1, '#1a1030', '#ffcf6a').replace('<g', '<g').slice(0, 0)
    return o
  } },
  'mendelssohn-scherzo-e-minor': { pal: { bg: ['#122a4a'], ink: '#0a1830' }, draw: () => {
    let o = bands(['#0a1830', '#122a4a', '#1f4a6a', '#2a7a7a'], 0, 512) + glow(256, 190, 100, '#d8f4ff', 3, .08) + circ(256, 190, 100, '#e8f8ff') + circ(256, 190, 100, '#a8d8f0', 'opacity=".25"')
    o += pines([[30, 470, 400], [100, 480, 300], [480, 470, 420], [420, 480, 310], [340, 500, 180], [170, 500, 180]], '#0a1830')
    o += hills(440, 10, '#06101e', 3, 3) + rect(0, 470, 512, 50, '#06101e') + ell(256, 408, 70, 18, '#c2302a') + ell(256, 404, 70, 16, '#e8504a') + [[226, 404], [256, 394], [286, 404]].map(([x, y]) => circ(x, y, 5, '#fff0e0')).join('') + rect(246, 408, 20, 40, '#f0e0d0')
    o += fairy(256, 392, 1.7)
    const r = rng(12); for (let i = 0; i < 40; i++) { const x = r() * 512, y = 150 + r() * 330; o += circ(x, y, 7, '#e8ff8a', 'opacity=".18"') + circ(x, y, 2.6, '#f4ffb0') }
    return o
  } },
}
