// Beethoven, Chopin (sonata, raindrop, waltzes, nocturne), Debussy, Rachmaninoff, Mozart, Für Elise.
const L = require('./lib.js'), M = require('./motifs.js')
const { rect, circ, ell, path, poly, line, stroke, g, tf, op, bands, glow, sparkle, stars, moon, cloud, rays, hills, mountains, pines, pine, waves, lightPath, cypress, note, f, rng } = L
const rose = (x, y, r, col, dark) => { let o = circ(x, y, r, col); for (let i = 0; i < 4; i++) o += stroke(`M${f(x - r * .7 + i * r * .1)} ${f(y - r * .1)}Q${f(x)} ${f(y - r * (.9 - i * .18))} ${f(x + r * .7 - i * r * .1)} ${f(y - r * .1)}`, dark, 3.2) + stroke(`M${f(x + r * .6 - i * r * .12)} ${f(y + r * .25)}Q${f(x)} ${f(y + r * (.9 - i * .2))} ${f(x - r * .6 + i * r * .12)} ${f(y + r * .25)}`, dark, 2.6, 'opacity=".7"'); return o + circ(x, y, r * .16, dark) }
const spiral = (cx, cy, r0, turns, dir, col, w, rot = 0) => { let d = ''; for (let t = 0; t <= turns * 2 * Math.PI; t += .15) { const r = r0 * (1 - t / (turns * 2 * Math.PI) * .88), a = rot + dir * t; d += (t ? 'L' : 'M') + f(cx + r * Math.cos(a)) + ' ' + f(cy + r * Math.sin(a)) } return stroke(d, col, w) }
module.exports = {
  'beethoven-appassionata-3': { pal: { bg: ['#1a0608'], ink: '#120406' }, draw: () => {
    let o = bands(['#1a0608', '#4a0e10', '#9a1e14', '#e2561c', '#ffb03c'], 0, 400) + glow(256, 200, 60, '#ffb03c', 4, .15) + cloud(110, 120, 210, '#2a0a0c', 'opacity=".9"') + cloud(410, 90, 230, '#3a0e10', 'opacity=".9"') + cloud(250, 60, 190, '#2a0a0c', 'opacity=".9"')
    o += path('M-10 430C70 380 140 350 210 232L230 200L284 200L304 232C380 350 450 390 522 430L522 522L-10 522Z', '#2a0a0c') + path('M230 200L284 200L292 214C270 226 246 226 222 214Z', '#ffd27a') + path('M240 214C236 270 226 300 196 350C230 330 252 290 256 240C262 290 280 340 300 380C300 330 290 270 276 222Z', '#ff6a2c') + path('M256 226C250 290 262 330 230 400', 'none', 'stroke="#ffd27a" stroke-width="6" stroke-linecap="round"')
    o += [[210, 150, 6], [290, 130, 5], [250, 100, 7], [330, 160, 4], [180, 110, 4]].map(([x, y, r]) => circ(x, y, r, '#ffd27a')).join('') + M.flame(256, 205, 70, '#ff7a2c', '#ffd27a')
    o += hills(450, 12, '#120406', 4, 3) + stars(16, 20, 160, 500, 400, 5, '#ffb03c', 4)
    return o
  } },
  'beethoven-sonata-32-1': { pal: { bg: ['#120a28'], ink: '#0a0418' }, draw: () => {
    let o = rect(0, 0, 512, 512, '#120a28') + rays(256, 190, 40, 600, 24, '#ffd878', .22) + glow(256, 190, 66, '#ffe9a0', 4, .13)
    o += path('M120 512L120 250Q120 100 256 90Q392 100 392 250L392 512Z', '#0a0418') + path('M164 512L164 258Q164 140 256 132Q348 140 348 258L348 512Z', '#ffe9a0')
    for (let i = 0; i < 8; i++) { const y = 512 - i * 38, w = 300 - i * 24; o += rect(256 - w / 2, y - 30, w, 38, i % 2 ? '#2a1a52' : '#3a2670') + rect(256 - w / 2, y - 30, w, 5, '#8a78d8') }
    o += path('M236 300Q230 270 256 262Q282 270 276 300Z', '#0a0418') + circ(256, 252, 9, '#0a0418')
    return o + stars(22, 10, 10, 500, 90, 6, '#e8dcff', 6)
  } },
  'beethoven-tempest-1': { pal: { bg: ['#0b1a22'], ink: '#061015' }, draw: () => {
    let o = bands(['#0b1a22', '#18323f', '#2c5566', '#5b8795'], 0, 360) + cloud(100, 120, 240, '#061015', 'opacity=".85"') + cloud(420, 90, 260, '#0b1a22', 'opacity=".9"') + cloud(300, 190, 200, '#18323f', 'opacity=".9"') + L.lightning(270, 90, 140, '#fff4b0') + glow(270, 230, 30, '#fff4b0', 2, .1)
    o += waves(330, 1, ['#2c5566'], 20, 2, 64) + waves(350, 5, ['#1f4658', '#183848', '#112c3a', '#0b1f2a', '#061015'], 16, 7, 70)
    o += tf(poly([[-34, 0], [34, 0], [26, 18], [-26, 18]], '#f4ece0') + rect(-1.5, -90, 3, 90, '#f4ece0') + poly([[3, -88], [3, -8], [44, -8]], '#e8dcc8') + poly([[-3, -80], [-3, -8], [-30, -8]], '#c8bca8'), 'translate(256 372) rotate(-10)')
    o += waves(395, 4, ['#183848', '#112c3a', '#0b1f2a', '#061015'], 20, 9, 66) + [[60, 420], [180, 440], [400, 430], [470, 400]].map(([x, y]) => circ(x, y, 5, '#e8f4f0', 'opacity=".7"')).join('')
    return o
  } },
  'beethoven-pathetique-1': { pal: { bg: ['#2a0d14'], ink: '#0e0508' }, draw: () => {
    let o = bands(['#3a1424', '#4e1a2e', '#66223a'], 0, 420) + M.spot(260, 60, 440, 0, 430, '#ffe4b0', .3) + ell(256, 440, 230, 38, '#ffe4b0', 'opacity=".3"') + rect(0, 420, 512, 92, '#2a0a14')
    o += L.grandPiano(150, 270, 1.3, '#0e0508', '#1c0a10', '#c9a060') + rect(130, 360, 8, 70, '#0e0508')
    o += rect(66, 400, 62, 8, '#0e0508') + rect(76, 408, 6, 28, '#0e0508') + rect(112, 408, 6, 28, '#0e0508') + path('M96 396C76 380 74 330 88 300C100 270 128 262 150 280L168 330L150 336L142 306C126 296 112 304 112 330C112 360 120 380 124 396Z', '#0e0508') + circ(116, 262, 17, '#0e0508') + stroke('M128 318Q170 340 200 346', '#0e0508', 9) + stroke('M96 396L76 424M120 396L136 424', '#0e0508', 11)
    o += note(380, 160, 20, '#c9a060') + note(430, 210, 15, '#c9a060', { flag: true }) + sparkle(60, 150, 10, '#ffe4b0')
    return o
  } },
  'chopin-sonata-2-finale': { pal: { bg: ['#10181a'], ink: '#080e10' }, draw: () => {
    let o = bands(['#10181a', '#1b2a2c', '#2d4344', '#587272', '#9bb0a8'], 0, 420) + glow(380, 160, 38, '#e8f0dc', 3, .12) + circ(380, 160, 38, '#f0f4e4')
    o += [0, 1, 2, 3, 4, 5].map((i) => stroke(`M${-30 + (i * 83) % 120} ${130 + i * 50}q80 ${-26 + (i % 2) * 20} 190 ${-8 + (i % 3) * 14}t170 ${i % 2 ? 12 : -12}t170 6`, '#e8f0dc', 4 - (i % 3), 'opacity=".4"')).join('')
    o += hills(400, 10, '#1b2a2c', 3, 3) + rect(0, 440, 512, 80, '#080e10') + mountains(442, [[90, 0, 10]], '#080e10')
    const stone = (x, y, w, h, lean) => tf(path(`M${-w / 2} 0L${-w / 2} ${-h + w / 2}A${w / 2} ${w / 2} 0 0 1 ${w / 2} ${-h + w / 2}L${w / 2} 0Z`, '#080e10') + rect(-3, -h + 14, 6, 24, '#1b2a2c') + rect(-10, -h + 22, 20, 6, '#1b2a2c'), `translate(${x} ${y}) rotate(${lean})`)
    o += [[70, 470, 46, 110, -4], [180, 480, 52, 130, 3], [330, 470, 48, 100, -3], [440, 480, 54, 140, 5]].map((a) => stone(...a)).join('') + cypress(250, 450, 190, '#080e10') + cypress(500, 450, 130, '#080e10') + cypress(10, 450, 120, '#080e10')
    o += [[120, 130], [180, 90], [300, 110], [460, 100]].map(([x, y]) => L.path(`M${x - 14} ${y}Q${x - 6} ${y - 9} ${x} ${y}Q${x + 6} ${y - 9} ${x + 14} ${y}Q${x + 6} ${y - 2} ${x} ${y + 4}Q${x - 6} ${y - 2} ${x - 14} ${y}Z`, '#080e10')).join('')
    return o
  } },
  'chopin-raindrop': { pal: { bg: ['#0c1c2c'], ink: '#050c14' }, draw: () => {
    let o = bands(['#0c1c2c', '#12304a', '#1b4466'], 0, 512)
    const r = rng(9); const bok = ['#ffb347', '#ff6a8a', '#7ae6ff', '#ffd27a', '#ff8a4c']
    for (let i = 0; i < 26; i++) o += circ(30 + r() * 450, 180 + r() * 260, 14 + r() * 26, bok[i % 5], `opacity="${f(.28 + r() * .3)}"`)
    o += rect(0, 380, 512, 132, '#0a1624', 'opacity=".7"')
    for (let i = 0; i < 40; i++) { const x = 20 + r() * 470, y = 60 + r() * 380, s = 4 + r() * 7; o += stroke(`M${f(x)} ${f(y - s * 3 - r() * 40)}L${f(x)} ${f(y)}`, '#dff4ff', 1.6, 'opacity=".35"') + path(`M${f(x)} ${f(y - s * 1.7)}Q${f(x + s)} ${f(y - s * .2)} ${f(x)} ${f(y + s * .9)}Q${f(x - s)} ${f(y - s * .2)} ${f(x)} ${f(y - s * 1.7)}Z`, '#cfe8f8', 'opacity=".72"') + circ(x - s * .3, y - s * .2, s * .22, '#ffffff') }
    o += path('M240 160Q276 118 276 208Q276 250 240 250Q204 250 204 208Q204 160 240 160Z', '#dff4ff', 'opacity=".5"').replace('M240 160Q276 118 276 208', 'M240 130Q290 190 280 220').slice(0, 0)
    const drop = (x, y, s) => path(`M${x} ${y - s * 1.8}Q${x + s * 1.1} ${y - s * .2} ${x} ${y + s}Q${x - s * 1.1} ${y - s * .2} ${x} ${y - s * 1.8}Z`, '#d8ecfa', 'opacity=".8"') + ell(x - s * .3, y - s * .1, s * .2, s * .5, '#ffffff', 'opacity=".9"') + circ(x + s * .2, y + s * .3, s * .28, '#ffb347', 'opacity=".8"')
    o += drop(256, 240, 46) + drop(120, 330, 24) + drop(400, 300, 30)
    const fr = 'fill="#0a1220"'
    o += `<path d="M-10 -10H522V522H-10Z M40 60H238V250H40Z M274 60H472V250H274Z M40 282H238V470H40Z M274 282H472V470H274Z" fill-rule="evenodd" fill="#0a1220"/>`
    o += rect(30, 470, 452, 14, '#1c2c40') + rect(30, 466, 452, 5, '#3a5470')
    o += M.candle(420, 466, .5, '#f4e4c0', '#ffb347', '#fff2b0').replace(/translate\(420 466\)/, 'translate(432 470)')
    return o
  } },
  'chopin-minute-waltz': { pal: { bg: ['#ff9d3a'], ink: '#2a1020' }, draw: () => {
    const dk = '#2a1020'
    const dog = g(ell(0, 0, 62, 26, dk) + circ(-66, -34, 23, dk) + path('M-78 -30L-122 -14Q-130 -6 -122 4L-84 6Z', dk) + circ(-124, -8, 7, dk) + path('M-52 -52Q-34 -64 -38 -20Q-48 -14 -60 -26Z', '#4a2030') + circ(-72, -40, 4.5, '#ffd8a0') +
      [[-46, 14], [-26, 20], [30, 20], [50, 14]].map(([x, y]) => rect(x - 5, y, 10, 44, dk, 'rx="5"')).join('') + stroke('M58 -10Q92 -28 88 -62Q84 -90 58 -94', dk, 11), 'transform="translate(256 240)"')
    let ticks = ''; for (let i = 0; i < 60; i++) { const a = i * Math.PI / 30, r0 = i % 5 ? 160 : 148; ticks += line(256 + r0 * Math.sin(a), 250 - r0 * Math.cos(a), 256 + 170 * Math.sin(a), 250 - 170 * Math.cos(a), '#c2302a', i % 5 ? 2 : 5) }
    const arc = (r, a0, a1, w, o_) => { const p = (a) => [256 + r * Math.cos(a), 250 + r * Math.sin(a)]; const [x0, y0] = p(a0), [x1, y1] = p(a1); return path(`M${f(x0)} ${f(y0)}A${r} ${r} 0 0 1 ${f(x1)} ${f(y1)}`, 'none', `stroke="#c2302a" stroke-width="${w}" stroke-linecap="round" opacity="${o_}"`) }
    return rays(256, 250, 190, 800, 28, '#ffb85e', 1) + circ(256, 250, 194, '#6a1b3a') + circ(256, 250, 180, '#fff2d8') + ticks + rect(246, 40, 20, 20, '#6a1b3a') + rect(234, 30, 44, 12, '#6a1b3a', 'rx="5"') +
      arc(124, 2.2, 3.9, 8, .9) + arc(124, 4.3, 5.8, 8, .6) + arc(124, 6.0, 7.4, 8, .35) + poly([[154, 150], [134, 170], [172, 172]], '#c2302a', 'opacity=".0"') + dog + sparkle(430, 110, 14, '#fff2d8') + sparkle(92, 370, 10, '#fff2d8')
  } },
  'chopin-waltz-op69-2': { pal: { bg: ['#2a1038'], ink: '#14081c' }, draw: () => {
    let o = bands(['#14081c', '#2a1038', '#431a56'], 0, 512)
    o += path('M110 470L110 200Q110 90 256 80Q402 90 402 200L402 470Z', '#f4c46a') + path('M128 470L128 204Q128 108 256 98Q384 108 384 204L384 470Z', '#1a2a5a') + glow(256, 210, 50, '#fff0c8', 3, .12) + circ(256, 210, 50, '#fff4d8') + stars(24, 135, 110, 380, 330, 4, '#ffe8b0', 6)
        o += rect(0, 440, 512, 72, '#14081c') + [0, 1, 2, 3, 4, 5, 6].map((i) => poly([[i * 80 - 20, 512], [i * 80 + 8, 440], [i * 80 + 14, 440], [i * 80 - 12, 512]], '#431a56')).join('')
    o += M.dancers(160, 450, 2.1, '#f4c46a', '#ffd9a0') + circ(256, 460, 0, '#000')
    return o + [[70, 120], [450, 150], [60, 280], [460, 300]].map(([x, y]) => sparkle(x, y, 12, '#ffe8b0')).join('')
  } },
  'chopin-nocturne-op9-2': { pal: { bg: ['#0e1840'], ink: '#080f2a' }, draw: () => {
    let o = bands(['#080f2a', '#0e1840', '#1a2c64', '#2e4a8a'], 0, 380) + stars(40, 10, 20, 500, 260, 7, '#dfe8ff', 6) + glow(120, 140, 40, '#f7d98a', 3, .12) + moon(120, 140, 40, '#fff3cf', { crescent: .5 })
    o += hills(360, 12, '#12204e', 5, 3) + hills(410, 14, '#0a1436', 9, 3) + rect(0, 450, 512, 70, '#060c22')
    o += rect(300, 250, 26, 210, '#060c22') + stroke('M313 330Q270 300 240 240M313 300Q350 270 400 250M313 360Q280 350 250 330', '#060c22', 12)
    const r = rng(5); const bl = ['#ff9ac0', '#ffc2d8', '#ffffff', '#ff7aa8']
    for (let i = 0; i < 34; i++) { const a = r() * 6.28, d = r() * 110; o += circ(312 + Math.cos(a) * d * 1.25, 230 + Math.sin(a) * d * .7, 11 + r() * 12, bl[i % 4], 'opacity=".95"') }
    o += [[240, 330], [220, 380], [370, 360], [400, 400], [260, 420], [150, 400]].map(([x, y], i) => ell(x, y, 6, 3, '#ffc2d8', `transform="rotate(${i * 50} ${x} ${y})"`)).join('')
    o += M.lantern(110, 440, 1.1, '#060c22', '#ffcf6a') + glow(110, 405, 30, '#ffcf6a', 2, .1).slice(0, 0) + circ(110, 405, 56, '#ffcf6a', 'opacity=".12"') + rect(60, 436, 110, 10, '#060c22')
    o += [[180, 300], [210, 250], [60, 330], [420, 330], [460, 270]].map(([x, y]) => circ(x, y, 3.5, '#ffe58a')).join('')
    return o
  } },
  'debussy-arabesque-1': { pal: { bg: ['#0a3a3a'], ink: '#062828' }, draw: () => {
    let o = bands(['#062828', '#0a3a3a', '#0e4a48'], 0, 512) + circ(256, 250, 220, '#f4c46a', 'opacity=".08"')
    const gold = '#f4c46a', cream = '#fff0cc'
    for (const m of [1, -1]) {
      const T = (x) => 256 + m * x
      o += stroke(`M256 440C${T(40)} 400 ${T(140)} 420 ${T(150)} 340C${T(160)} 270 ${T(80)} 270 ${T(80)} 220C${T(80)} 170 ${T(150)} 160 ${T(150)} 110`, gold, 6)
      o += stroke(`M256 360C${T(90)} 350 ${T(100)} 280 ${T(60)} 300`, cream, 3)
      o += spiral(T(146), 330, 56, 1.6, m, gold, 5, 1.2) + spiral(T(150), 120, 40, 1.4, -m, gold, 5, 3.6) + spiral(T(70), 210, 34, 1.3, m, cream, 3.5, 2)
      for (const [x, y, a] of [[100, 405, 30], [150, 340, 10], [90, 255, -40], [140, 170, -60], [130, 100, -10]]) o += ell(T(x), y, 18, 8, gold, `transform="rotate(${m * a} ${T(x)} ${y})"`)
      o += [[160, 250], [58, 160]].map(([x, y]) => circ(T(x), y, 6, cream)).join('')
    }
    o += path('M256 100Q290 130 256 160Q222 130 256 100Z', cream) + path('M256 440Q290 420 256 392Q222 420 256 440Z', cream) + circ(256, 250, 22, gold) + circ(256, 250, 10, '#062828') + rays(256, 250, 30, 48, 12, cream, .9)
    return o + stars(14, 20, 20, 500, 100, 4, '#bfe9d6', 5)
  } },
  'debussy-clair-de-lune': { pal: { bg: ['#0e1a3d'], ink: '#070d26' }, draw: () =>
    bands(['#0e1a3d', '#14275a', '#1d3a78', '#2b5392'], 0, 312) + stars(36, 10, 20, 500, 220, 11, '#dfe8ff', 7) +
    glow(256, 205, 74, '#bcd2ff', 4, .1) + moon(256, 205, 74, '#fff3cf', { shade: '#e8c26e' }) +
    cloud(110, 215, 150, '#0e1a3d', 'opacity=".75"') + cloud(420, 160, 130, '#14275a', 'opacity=".9"') +
    hills(300, 14, '#0a1330', 5, 3) + cypress(52, 330, 90, '#070d26') + cypress(80, 330, 62, '#070d26') + cypress(450, 330, 76, '#070d26') +
    rect(0, 312, 512, 200, '#13306a') + rect(0, 312, 512, 3, '#6c8fd0', 'opacity=".5"') + lightPath(256, 320, 470, '#fbe3a0', 120, 10) +
    [[360, 90], [400, 300], [430, 150], [450, 400], [380, 440]].map(([y, x]) => rect(x - 30, y, 60, 4, '#2b5392', 'rx="2"')).join('') + waves(470, 3, ['#0e2552', '#0a1c44', '#070d26'], 5, 3, 42) },
  'rachmaninoff-prelude-c-sharp-minor': { pal: { bg: ['#1a1020'], ink: '#0e0814' }, draw: () => {
    let o = bands(['#0e0814', '#1a1020', '#2e1a30', '#4a2a3a'], 0, 512) + glow(256, 200, 100, '#c9803a', 3, .08)
    ;[150, 205, 260].forEach((r, i) => { o += circ(256, 230, r, 'none', `stroke="#c9803a" stroke-width="${6 - i * 1.5}" opacity="${.45 - i * .12}"`) })
    o += rect(150, 60, 212, 14, '#0e0814') + rect(150, 60, 18, 452, '#0e0814') + rect(344, 60, 18, 452, '#0e0814') + path('M168 120Q256 40 344 120L344 60L168 60Z', '#0e0814')
    o += M.bell(256, 250, 2.1, '#c9803a', '#ffd27a') + rect(240, 62, 32, 10, '#8a5222')
    o += tf(M.bell(0, 0, 1, '#8a5222', '#c9803a'), 'translate(130 400) scale(.55)') + tf(M.bell(0, 0, 1, '#8a5222', '#c9803a'), 'translate(390 410) scale(.5)')
    o += [0, 1, 2].map((i) => stroke(`M${120 - i * 22} ${220 + i * 30}Q${100 - i * 24} ${260 + i * 30} ${120 - i * 22} ${300 + i * 30}`, '#ffd27a', 4, `opacity="${.5 - i * .12}"`) + stroke(`M${392 + i * 22} ${220 + i * 30}Q${412 + i * 24} ${260 + i * 30} ${392 + i * 22} ${300 + i * 30}`, '#ffd27a', 4, `opacity="${.5 - i * .12}"`)).join('')
    return o
  } },
  'rachmaninoff-prelude-op23-5': { pal: { bg: ['#1a0a24'], ink: '#10061a' }, draw: () => {
    let o = bands(['#1a0a24', '#4a1238', '#a5253a', '#ee6a3a', '#ffc064'], 0, 400) + glow(256, 330, 70, '#fff0c0', 4, .14) + circ(256, 330, 70, '#fff4d0')
    o += cloud(90, 190, 190, '#4a1238', 'opacity=".8"') + cloud(430, 150, 200, '#5a1a40', 'opacity=".8"')
    const dome = (x, y, w, h, c) => rect(x - w * .3, y, w * .6, 512 - y, '#10061a') + M.onion(x, y, w, h, c, '#ff9a7a')
    o += rect(0, 440, 512, 80, '#10061a') + dome(256, 400, 90, 120, '#10061a') + dome(150, 410, 70, 90, '#2a0e30') + dome(370, 410, 70, 90, '#2a0e30') + dome(66, 420, 56, 70, '#10061a') + dome(450, 420, 56, 70, '#10061a')
    o += rect(0, 440, 512, 80, '#10061a') + rect(0, 436, 512, 6, '#e8c8d8', 'opacity=".35"')
    o += [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => rect(20 + i * 56, 450, 10, 30, '#10061a') + circ(25 + i * 56, 446, 7, '#10061a')).join('') + stars(24, 10, 20, 500, 260, 11, '#ffd0c0', 5)
    return o
  } },
  'rachmaninoff-prelude-op23-2': { pal: { bg: ['#2a2a6a'], ink: '#14144a' }, draw: () => {
    let o = bands(['#2a2a6a', '#4a4a9a', '#9a6ab0', '#e08a9a', '#ffc89a', '#ffe8b8'], 0, 380) + glow(256, 340, 90, '#fff6dc', 4, .12) + circ(256, 340, 90, '#fff9e8')
    o += rays(256, 340, 100, 600, 22, '#fff6dc', .12) + cloud(100, 170, 170, '#f0b0b8', 'opacity=".7"') + cloud(420, 230, 150, '#f0b0b8', 'opacity=".7"')
    o += hills(360, 16, '#6a4a8a', 3, 3) + hills(390, 14, '#4a3a7a', 7, 3) + hills(430, 12, '#2a2a6a', 2, 3) + rect(0, 460, 512, 60, '#14144a')
    for (let i = 0; i < 24; i++) o += stroke(`M${10 + i * 22} 520Q${14 + i * 22} 480 ${20 + i * 22} ${450 - (i % 3) * 8}`, '#e8b04a', 3, 'opacity=".7"')
    o += [[120, 120, 24], [190, 80, 18], [330, 110, 26], [400, 70, 16], [440, 150, 20], [250, 180, 14], [80, 220, 14]].map(([x, y, s]) => M.birdV(x, y, s, '#14144a')).join('')
    return o
  } },
  'mozart-rondo-alla-turca': { pal: { bg: ['#7a1020'], ink: '#3a0610' }, draw: () => {
    let o = rect(0, 0, 512, 512, '#7a1020')
    for (let y = 20; y < 540; y += 52) for (const x of [28, 484]) o += M.tulip(x, y + 30, 40, y % 104 ? '#f6e3b0' : '#e8a23a', '#4a9a7a')
    o += rect(58, 0, 3, 512, '#f6e3b0', 'opacity=".6"') + rect(451, 0, 3, 512, '#f6e3b0', 'opacity=".6"')
    o += path('M96 470L96 250Q96 180 256 80Q416 180 416 250L416 470Z', '#f6e3b0') + path('M118 470L118 254Q118 192 256 112Q394 192 394 254L394 470Z', '#14224a') + stars(30, 130, 140, 380, 360, 3, '#ffe9a8', 6)
    o += glow(256, 250, 56, '#ffd45c', 2, .1).slice(0, 0) + M.crescentStar(244, 250, 64, '#ffd45c')
    const dome = (x, y, w, h) => rect(x - w / 2, y - h * .3, w, h * .3 + 90, '#0a1230') + path(`M${x - w / 2} ${y - h * .3}Q${x - w / 2} ${y - h} ${x} ${y - h}Q${x + w / 2} ${y - h} ${x + w / 2} ${y - h * .3}Z`, '#0a1230') + rect(x - 1.5, y - h - 14, 3, 14, '#0a1230')
    o += dome(256, 400, 120, 70) + dome(170, 420, 60, 40) + dome(342, 420, 60, 40) + [140, 372].map((x) => rect(x - 5, 300, 10, 160, '#0a1230') + poly([[x - 7, 300], [x, 276], [x + 7, 300]], '#0a1230')).join('')
    o += rect(118, 440, 276, 30, '#0a1230')
    return o
  } },
  'mozart-fantasia-d-minor': { pal: { bg: ['#1a0408'], ink: '#0e0204' }, draw: () => {
    let o = bands(['#0e0204', '#1a0408'], 0, 512) + M.spot(256, 40, 420, 0, 440, '#ffe4b0', .2) + ell(256, 440, 190, 34, '#ffe4b0', 'opacity=".3"') + rect(0, 440, 512, 72, '#2a0a10')
    const drape = (x0, dir) => { let d = `M${x0} 0`; return path(`M${x0} 0L${x0 + dir * 190} 0Q${x0 + dir * 160} 200 ${x0 + dir * 110} 440L${x0} 460Z`, '#8a1424') + [0, 1, 2, 3, 4].map((i) => path(`M${x0 + dir * (20 + i * 36)} 0Q${x0 + dir * (24 + i * 30)} 220 ${x0 + dir * (12 + i * 24)} 450`, 'none', `stroke="${i % 2 ? '#c2263c' : '#5a0a18'}" stroke-width="14" opacity=".7"`)).join('') }
    o += drape(0, 1) + drape(512, -1) + rect(0, 0, 512, 46, '#5a0a18') + path('M0 46Q64 74 128 46Q192 74 256 46Q320 74 384 46Q448 74 512 46L512 38L0 38Z', '#c2263c') + rect(0, 44, 512, 5, '#f4c46a')
    o += M.candle(256, 340, 1.05, '#f4e4c0', '#ffb347', '#fff2b0') + glow(256, 262, 40, '#ffb347', 3, .14).slice(0, 0) + circ(256, 270, 70, '#ffb347', 'opacity=".12"')
    o += [[100, 380], [412, 390]].map(([x, y]) => rect(x, y, 6, 52, '#f4c46a') + circ(x + 3, y + 54, 9, '#f4c46a')).join('')
    return o + sparkle(210, 300, 9, '#ffe4b0') + sparkle(310, 250, 7, '#ffe4b0')
  } },
  'mozart-sonata-457-1': { pal: { bg: ['#140a2a'], ink: '#0a0418' }, draw: () => {
    let o = bands(['#0a0418', '#140a2a', '#241048'], 0, 512) + rays(256, 260, 80, 700, 28, '#7a5ad8', .12) + stars(34, 10, 20, 500, 500, 8, '#d8c8ff', 6)
    o += path('M256 100Q290 40 330 20Q300 80 290 120Z', '#2ac0b0') + path('M256 100Q320 60 396 70Q330 100 290 126Z', '#f4c46a') + path('M256 100Q330 110 396 150Q330 160 292 136Z', '#2ac0b0')
    o += path('M96 250Q256 130 416 250Q440 330 380 380Q330 340 300 366Q256 320 212 366Q182 340 132 380Q72 330 96 250Z', '#f6ecd8') + path('M96 250Q256 130 416 250Q410 262 400 268Q256 168 112 268Q102 262 96 250Z', '#f4c46a')
    o += path('M120 270Q256 190 392 270Q400 330 370 356Q330 326 300 344Q256 306 212 344Q182 326 142 356Q112 330 120 270Z', 'none', 'stroke="#f4c46a" stroke-width="3"')
    o += path('M150 272Q190 250 232 292Q200 322 156 306Q140 290 150 272Z', '#0a0418') + path('M362 272Q322 250 280 292Q312 322 356 306Q372 290 362 272Z', '#0a0418')
    o += path('M244 290Q256 250 268 290Q262 340 256 360Q250 340 244 290Z', '#e0d0b0')
    o += [[130, 226], [256, 190], [382, 226]].map(([x, y]) => circ(x, y, 8, '#2ac0b0')).join('') + [[170, 235], [210, 210], [302, 210], [342, 235]].map(([x, y]) => circ(x, y, 5, '#f4c46a')).join('')
    o += stroke('M96 250Q70 230 40 250M416 250Q442 230 472 250', '#f4c46a', 6)
    o += M.spot(256, 10, 10, 0, 0, '#000', 0)
    return o + path('M132 380Q256 480 380 380', 'none', 'stroke="#2ac0b0" stroke-width="5" opacity=".5"')
  } },
  'mozart-sonata-facile-1': { pal: { bg: ['#bfe0f6'], ink: '#2a4a7a' }, draw: () => {
    let o = bands(['#a8d4f2', '#c4e2f6', '#dff0fa', '#fdf3dc'], 0, 512) + cloud(110, 150, 170, '#ffffff', 'opacity=".9"') + cloud(420, 110, 190, '#ffffff', 'opacity=".9"') + cloud(380, 280, 120, '#ffffff', 'opacity=".8"')
    o += poly([[110, 300], [150, 140], [362, 140], [402, 300]], '#e8a05c') + poly([[126, 296], [160, 156], [352, 156], [386, 296]], '#fff0d0') + circ(256, 226, 30, '#d8ecfa') + sparkle(256, 226, 14, '#fff')
    o += rect(90, 300, 332, 110, '#c9783a', 'rx="10"') + rect(104, 312, 304, 14, '#8a4a22', 'rx="4"') + rect(104, 290, 304, 34, '#f4c46a') + rect(104, 290, 304, 4, '#fff0c0')
    for (let i = 0; i < 24; i++) o += rect(112 + i * 12, 296 + (i * 7) % 20, 6, 22 - (i * 7) % 20, '#8a4a22') + circ(115 + i * 12, 300 + (i * 5) % 10, 2.5, '#fff0c0')
    o += rect(90, 400, 332, 10, '#8a4a22') + rect(130, 410, 24, 14, '#8a4a22') + rect(358, 410, 24, 14, '#8a4a22') + rect(240, 340, 32, 28, '#f4c46a', 'rx="14"') + circ(256, 354, 4, '#8a4a22')
    o += [[130, 120, 22, '#e2542b'], [380, 70, 18, '#2a4a7a'], [440, 220, 16, '#e2542b'], [70, 230, 18, '#2a4a7a']].map(([x, y, s, c], i) => note(x, y, s, c, { flag: i % 2 === 0 })).join('') + sparkle(256, 90, 14, '#f4c46a') + sparkle(80, 160, 9, '#f4c46a') + sparkle(450, 140, 9, '#f4c46a')
    return o
  } },
  'beethoven-fur-elise-full': { pal: { bg: ['#16362f'], ink: '#0c211c' }, draw: () => {
    let o = bands(['#0c211c', '#16362f', '#1f4a40'], 0, 512) + M.spot(256, 80, 460, 0, 440, '#ffe4b0', .12)
    o += tf(rect(-130, -86, 260, 172, '#f6ecd8', 'rx="6"') + poly([[-130, -86], [0, 20], [130, -86]], '#e4d4b8') + poly([[-130, 86], [-34, 8], [-20, 18]], '#ebdcc0') + poly([[130, 86], [34, 8], [20, 18]], '#ebdcc0') + path('M-130 86L-6 -4Q0 -8 6 -4L130 86Z', '#f6ecd8') + path('M-130 -86L0 20L130 -86', 'none', 'stroke="#c9b490" stroke-width="3"'), 'translate(256 280) rotate(-6)')
    o += tf(circ(0, 18, 28, '#b01c2c') + circ(0, 18, 20, '#c9283a') + M.star5(0, 18, 12, '#b01c2c') + path('M-26 38L-34 60L-18 50Z', '#b01c2c') + path('M26 38L34 60L18 50Z', '#b01c2c'), 'translate(256 280) rotate(-6)')
    o += rose(400, 130, 40, '#d9384a', '#8a1424') + path('M400 168Q380 230 380 290', 'none', 'stroke="#4a9a6a" stroke-width="7"') + path('M386 230Q350 200 340 190Q360 230 386 240Z', '#4a9a6a') + path('M384 262Q420 240 430 226Q420 270 384 270Z', '#4a9a6a')
    o += [[120, 120, 22], [90, 200, 16], [180, 80, 14]].map(([x, y, s], i) => note(x, y, s, '#f6ecd8', { flag: i % 2 === 0 })).join('') + [[330, 400], [200, 430], [120, 380], [420, 420]].map(([x, y], i) => path(`M${x} ${y}Q${x + 12} ${y - 14} ${x + 24} ${y}Q${x + 12} ${y + 12} ${x} ${y}Z`, '#d9384a', `opacity=".85" transform="rotate(${i * 50} ${x} ${y})"`)).join('')
    return o
  } },
}
