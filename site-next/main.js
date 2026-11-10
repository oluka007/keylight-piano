// Keylight website: scroll reveals, the pinned scene, counters, the two piano stages and the Jam grid.
const still = matchMedia('(prefers-reduced-motion: reduce)').matches
const $ = (id) => document.getElementById(id)
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))

// ---------- reveal on scroll, count up ----------
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue
    e.target.classList.add('in')
    const n = e.target.querySelector('[data-count]')
    if (n) countUp(n)
    io.unobserve(e.target)
  }
}, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' })
document.querySelectorAll('.reveal').forEach((el) => io.observe(el))

function countUp(el) {
  const to = Number(el.dataset.count), pre = el.dataset.prefix || ''
  if (still || !to) { el.textContent = pre + to; return }
  const t0 = performance.now(), dur = 1400
  const step = (t) => {
    const p = clamp((t - t0) / dur), e = 1 - Math.pow(1 - p, 4)
    el.textContent = pre + Math.round(to * e)
    if (p < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

// ---------- nav hides on the way down, returns on the way up ----------
const nav = $('nav')
let lastY = 0, ticking = false
function onScroll() {
  const y = scrollY
  nav.classList.toggle('hide', y > lastY && y > 400)
  lastY = y
  scene()
  ticking = false
}
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll) } }, { passive: true })

// ---------- pinned scene: the window settles while three lines pass ----------
const sceneEl = $('how'), win = $('sceneWindow'), caps = [...$('captions').children]
const clips = [...$('sceneStack').children]
let shown = -1
function scene() {
  if (still) return
  const r = sceneEl.getBoundingClientRect()
  const p = clamp(-r.top / (r.height - innerHeight))
  win.style.setProperty('--s', (1.12 - 0.3 * clamp(p * 2.2)).toFixed(3))
  win.style.setProperty('--rx', (14 - 14 * clamp(p * 2.2)).toFixed(2) + 'deg')
  const i = p < 0.18 ? -1 : Math.min(2, Math.floor((p - 0.18) / 0.26))
  caps.forEach((c, k) => c.classList.toggle('on', k === i))
  // one clip per line; only the one on show plays, and only while the scene is on screen
  const onScreen = r.top < innerHeight && r.bottom > 0
  const want = onScreen ? Math.max(0, i) : -1
  if (want === shown) return
  shown = want
  clips.forEach((v, k) => {
    v.classList.toggle('on', k === Math.max(0, want))
    if (k === want) { if (v.readyState < 2) v.load(); v.play().catch(() => { v.controls = true }) } else v.pause()   // autoplay refused: let people press play
  })
}
scene()
if (still) clips.forEach((v) => { v.controls = true; v.preload = 'metadata' })   // reduced motion: all three clips are laid out in turn, each with its own play button

// ---------- cards: a soft light follows the pointer ----------
document.querySelectorAll('.card').forEach((card) => {
  card.addEventListener('pointermove', (e) => {
    const r = card.getBoundingClientRect()
    card.style.setProperty('--mx', e.clientX - r.left + 'px')
    card.style.setProperty('--my', e.clientY - r.top + 'px')
  })
})

// ---------- the piano stage ----------
// Eight white keys, C to C. Twinkle Twinkle, as key indexes and lengths in beats.
const TUNE = [[0, 1], [0, 1], [4, 1], [4, 1], [5, 1], [5, 1], [4, 2], [3, 1], [3, 1], [2, 1], [2, 1], [1, 1], [1, 1], [0, 2]]
const FREQ = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25]
const NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C']
const BLACK = [0, 1, 3, 4, 5]          // a black key sits after these white keys
const MINT = [124, 240, 198], PEACH = [255, 191, 148]
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`

function makeStage(canvas, { wait }) {
  const ctx = canvas.getContext('2d')
  let W = 0, H = 0, dpr = 1
  const glow = new Array(8).fill(0)        // how brightly each key is lit right now
  const sparks = []
  let beat = -3, idx = 0, last = 0, seen = false, done = false
  const starts = []; { let t = 0; for (const [, len] of TUNE) { starts.push(t); t += len } }
  const total = starts[starts.length - 1] + TUNE[TUNE.length - 1][1]
  const SPEED = 1.9                        // beats per second
  const AHEAD = 5                          // beats visible above the keys

  function size() {
    dpr = Math.min(2, devicePixelRatio || 1)
    W = canvas.clientWidth; H = canvas.clientHeight
    canvas.width = W * dpr; canvas.height = H * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  new ResizeObserver(() => { size(); draw() }).observe(canvas)

  function hit(k) {
    glow[k] = 1
    for (let i = 0; i < 9; i++) sparks.push({ k, x: (Math.random() - 0.5) * 0.8, v: 0.4 + Math.random() * 0.9, life: 1 })
  }
  function press(k) {
    if (!wait || done) return false
    if (k !== TUNE[idx][0]) { glow[k] = Math.max(glow[k], 0.35); return false }
    hit(k); beat = starts[idx] + 0.001; idx++
    if (idx >= TUNE.length) done = true
    return true
  }
  function restart() { beat = -2; idx = 0; done = false }

  function draw() {
    if (!W) return
    const keyH = H * 0.3, top = H - keyH, kw = W / 8
    ctx.clearRect(0, 0, W, H)
    // lanes
    for (let k = 0; k <= 8; k++) { ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fillRect(k * kw - 0.5, 0, 1, top) }
    // falling notes
    const pxPerBeat = top / AHEAD
    for (let i = 0; i < TUNE.length; i++) {
      for (const loop of wait ? [0] : [0, total + 2]) {
        const [k, len] = TUNE[i], s = starts[i] + loop
        const y1 = top - (s - beat) * pxPerBeat, y0 = y1 - len * pxPerBeat + 6
        if (y1 < -10 || y0 > top) continue
        const col = k % 2 ? PEACH : MINT, x = k * kw + kw * 0.2, w = kw * 0.6
        const g = ctx.createLinearGradient(0, y0, 0, y1)
        g.addColorStop(0, rgba(col, 0.25)); g.addColorStop(1, rgba(col, 0.95))
        ctx.fillStyle = g; ctx.shadowColor = rgba(col, 0.9); ctx.shadowBlur = 24
        ctx.beginPath(); ctx.roundRect(x, y0, w, Math.min(y1, top) - y0, Math.min(10, w / 3)); ctx.fill()
      }
    }
    ctx.shadowBlur = 0
    // sparks
    for (const s of sparks) {
      const col = s.k % 2 ? PEACH : MINT
      ctx.fillStyle = rgba(col, s.life)
      ctx.beginPath(); ctx.arc((s.k + 0.5 + s.x * (1 - s.life)) * kw, top - (1 - s.life) * 70 * s.v, 2.2, 0, 7); ctx.fill()
    }
    // white keys
    for (let k = 0; k < 8; k++) {
      const col = k % 2 ? PEACH : MINT, a = glow[k]
      const next = wait && !done && TUNE[idx][0] === k
      const pulse = next ? 0.45 + 0.25 * Math.sin(performance.now() / 260) : 0
      const lit = Math.max(a, pulse)
      ctx.fillStyle = '#ece9df'
      ctx.beginPath(); ctx.roundRect(k * kw + 2, top, kw - 4, keyH - 2, [0, 0, 10, 10]); ctx.fill()
      if (lit > 0.01) {
        ctx.fillStyle = rgba(col, lit); ctx.shadowColor = rgba(col, 1); ctx.shadowBlur = 40 * lit
        ctx.beginPath(); ctx.roundRect(k * kw + 2, top, kw - 4, keyH - 2, [0, 0, 10, 10]); ctx.fill()
        ctx.shadowBlur = 0
      }
      if (wait) { ctx.fillStyle = 'rgba(10,12,30,.55)'; ctx.font = `600 ${Math.max(11, kw * 0.16)}px -apple-system, Segoe UI, sans-serif`; ctx.textAlign = 'center'; ctx.fillText(NAMES[k], (k + 0.5) * kw, H - 14) }
    }
    // black keys
    ctx.fillStyle = '#12132b'
    for (const k of BLACK) { ctx.beginPath(); ctx.roundRect((k + 1) * kw - kw * 0.28, top, kw * 0.56, keyH * 0.6, [0, 0, 6, 6]); ctx.fill() }
    // the line where notes land
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(0, top - 1, W, 1)
  }

  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000 || 0); last = t
    if (seen) {
      if (wait) {
        const stopAt = done ? total + 1 : starts[idx]
        beat = Math.min(stopAt, beat + dt * SPEED * 1.4)
        if (done && beat >= total + 1) { /* stays finished until restarted */ }
      } else {
        const before = beat
        beat += dt * SPEED
        for (let i = 0; i < TUNE.length; i++) if (before < starts[i] && beat >= starts[i]) hit(TUNE[i][0])
        if (beat > total + 2) beat -= total + 2
      }
      for (let k = 0; k < 8; k++) glow[k] = Math.max(0, glow[k] - dt * 1.6)
      for (let i = sparks.length - 1; i >= 0; i--) { sparks[i].life -= dt * 1.5; if (sparks[i].life <= 0) sparks.splice(i, 1) }
      draw()
      requestAnimationFrame(frame)
    } else running = false       // off screen: stop the loop until it is seen again
  }
  let running = false
  size()
  if (still) { beat = 1.5; glow[0] = 1; draw() } else new IntersectionObserver(([e]) => {
    seen = e.isIntersecting
    if (seen && !running) { running = true; last = 0; requestAnimationFrame(frame) }
  }, { threshold: 0.05 }).observe(canvas)
  return { press, restart, next: () => (done ? -1 : TUNE[idx][0]), left: () => TUNE.length - idx, keyAt: (x) => clamp(Math.floor(x / (W / 8)), 0, 7), draw }
}

makeStage($('heroStage'), { wait: false })

// ---------- a light-up keyboard in step with the screen (an illustration) ----------
// Two octaves from C. Right hand plays Twinkle Twinkle, left hand holds the roots below it.
;(function sync() {
  const canvas = $('syncStage'), keysEl = $('syncKeys')
  const BLUE = [143, 176, 255]
  const R = [12, 12, 19, 19, 21, 21, 19, null, 17, 17, 16, 16, 14, 14, 12, null]      // one per beat; null holds the note before
  const L = [0, 0, 5, 0, 5, 0, 7, 0]                                                    // one per two beats
  const notes = []
  R.forEach((p, i) => { if (p !== null) notes.push({ k: p, s: i, len: R[i + 1] === null ? 2 : 1, col: PEACH }) })
  L.forEach((p, i) => notes.push({ k: p, s: i * 2, len: 2, col: BLUE }))
  const TOTAL = 18, SPEED = 1.7, AHEAD = 4.5
  // where each of the 24 keys sits: white keys fill 14 columns, black keys sit on the joins
  const WHITE = { 0: 0, 2: 1, 4: 2, 5: 3, 7: 4, 9: 5, 11: 6 }, BLACKS = { 1: 1, 3: 2, 6: 4, 8: 5, 10: 6 }
  const keyX = (k) => { const o = Math.floor(k / 12), s = k % 12; return s in WHITE ? (o * 7 + WHITE[s] + 0.5) / 14 : (o * 7 + BLACKS[s]) / 14 }
  const els = []
  for (let w = 0; w < 14; w++) keysEl.append(document.createElement('i'))
  for (let k = 0; k < 24; k++) {
    const s = k % 12
    if (s in WHITE) { els[k] = keysEl.children[Math.floor(k / 12) * 7 + WHITE[s]]; continue }
    const b = document.createElement('i'); b.className = 'b'; b.style.left = keyX(k) * 100 + '%'
    keysEl.append(b); els[k] = b
  }
  const ctx = canvas.getContext('2d')
  let W = 0, H = 0, beat = -2, last = 0, seen = false, running = false
  const shownA = new Array(24).fill(-1)
  function size() { const d = Math.min(2, devicePixelRatio || 1); W = canvas.clientWidth; H = canvas.clientHeight; canvas.width = W * d; canvas.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0) }
  function draw() {
    if (!W) return
    ctx.clearRect(0, 0, W, H)
    for (let w = 0; w <= 14; w++) { ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fillRect(w * W / 14 - 0.5, 0, 1, H) }
    const px = H / AHEAD, level = new Array(24).fill(0), colour = new Array(24).fill(null)
    for (const n of notes) for (const loop of [0, TOTAL]) {
      const s = n.s + loop, y1 = H - (s - beat) * px, y0 = y1 - n.len * px + 5
      const d = s - beat
      // the key glows a beat ahead, is brightest while the note sounds, then fades
      const a = d > 1 ? 0 : d > 0 ? 0.22 + 0.4 * (1 - d) : -d < n.len ? 1 : Math.max(0, 1 - (-d - n.len) / 0.5)
      if (a > level[n.k]) { level[n.k] = a; colour[n.k] = n.col }
      if (y1 < -8 || y0 > H) continue
      const w = W / 14 * 0.56, x = keyX(n.k) * W - w / 2
      const g = ctx.createLinearGradient(0, y0, 0, y1)
      g.addColorStop(0, rgba(n.col, 0.3)); g.addColorStop(1, rgba(n.col, 0.95))
      ctx.fillStyle = g; ctx.shadowColor = rgba(n.col, 0.9); ctx.shadowBlur = 22
      ctx.beginPath(); ctx.roundRect(x, y0, w, Math.min(y1, H) - y0, 8); ctx.fill()
    }
    ctx.shadowBlur = 0
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(0, H - 1.5, W, 1.5)
    for (let k = 0; k < 24; k++) {
      const a = Math.round(level[k] * 50) / 50
      if (a === shownA[k]) continue
      shownA[k] = a
      els[k].style.setProperty('--a', a)
      if (colour[k]) els[k].style.setProperty('--c', rgba(colour[k], 1))
    }
  }
  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000 || 0); last = t
    if (!seen) { running = false; return }
    beat += dt * SPEED
    if (beat > TOTAL - 2) beat -= TOTAL
    draw()
    requestAnimationFrame(frame)
  }
  new ResizeObserver(() => { size(); draw() }).observe(canvas)
  size()
  if (still) { beat = 2.4; draw() } else new IntersectionObserver(([e]) => {
    seen = e.isIntersecting
    if (seen && !running) { running = true; last = 0; requestAnimationFrame(frame) }
  }, { threshold: 0.05 }).observe(canvas)
})()

// ---------- try it: wait mode, with sound ----------
const tryStage = makeStage($('tryStage'), { wait: true })
const keysBox = $('tryKeys'), statusEl = $('tryStatus')
let audio = null
function tone(k) {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)()
    if (audio.state === 'suspended') audio.resume()
    const t = audio.currentTime, g = audio.createGain(), lp = audio.createBiquadFilter()
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(3800, t); lp.frequency.exponentialRampToValueAtTime(700, t + 1.2)
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.3, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0008, t + 1.6)
    for (const [mult, type, level] of [[1, 'triangle', 1], [2, 'sine', 0.3], [3, 'sine', 0.1]]) {
      const o = audio.createOscillator(), og = audio.createGain()
      o.type = type; o.frequency.value = FREQ[k] * mult; og.gain.value = level
      o.connect(og).connect(lp); o.start(t); o.stop(t + 1.7)
    }
    lp.connect(g).connect(audio.destination)
  } catch (_e) { /* no sound available: the lights still work */ }
}
const buttons = NAMES.map((n, k) => {
  const b = document.createElement('button')
  b.type = 'button'; b.textContent = n
  b.setAttribute('aria-label', `${n}${k === 7 ? ' high' : ''}`)
  b.addEventListener('click', () => play(k))
  keysBox.append(b)
  return b
})
function mark() {
  const n = tryStage.next()
  buttons.forEach((b, k) => b.classList.toggle('next', k === n))
}
function play(k) {
  if (tryStage.next() === -1) { tryStage.restart(); statusEl.textContent = 'Again from the top. Tap the glowing key.'; mark(); return }
  tone(k)
  if (tryStage.press(k)) {
    const left = tryStage.left()
    statusEl.textContent = left === 0 ? 'That was Twinkle Twinkle Little Star. Tap any key to play it again.' : left <= 3 ? 'Nearly there.' : 'Good. Keep following the light.'
  } else statusEl.textContent = `Not that one. Look for ${NAMES[tryStage.next()]}, the glowing key.`
  mark()
  if (still) tryStage.draw()
}
mark()
$('tryStage').addEventListener('pointerdown', (e) => { const r = e.currentTarget.getBoundingClientRect(); play(tryStage.keyAt(e.clientX - r.left)) })
const KEYMAP = { a: 0, s: 1, d: 2, f: 3, g: 4, h: 5, j: 6, k: 7 }
addEventListener('keydown', (e) => {
  if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return
  const k = KEYMAP[e.key.toLowerCase()]
  if (k === undefined) return
  const r = $('try').getBoundingClientRect()
  if (r.bottom < 0 || r.top > innerHeight) return      // only while the piano is on screen
  play(k)
})

// ---------- Jam: a sixteen-step pattern with a moving playhead ----------
const grid = $('jamGrid')
const PATTERN = ['x...x...x...x.x.', '....x.......x...', 'x.x.x.x.x.x.x.xx', 'x..x..x...x..x..']
const cells = PATTERN.map((row, r) => [...row].map((c) => {
  const i = document.createElement('i')
  i.className = 'r' + r + (c === 'x' ? ' on' : '')
  grid.append(i)
  return i
}))
if (!still) {
  let step = -1, jamSeen = false
  new IntersectionObserver(([e]) => { jamSeen = e.isIntersecting }).observe(grid)
  setInterval(() => {
    if (!jamSeen) return
    if (step >= 0) cells.forEach((row) => row[step].classList.remove('hit', 'col'))
    step = (step + 1) % 16
    cells.forEach((row) => row[step].classList.add(row[step].classList.contains('on') ? 'hit' : 'col'))
  }, 140)
}

// ---------- clips play only while they are on screen ----------
document.querySelectorAll('video.clip').forEach((v) => {
  if (still) { v.controls = true; return }       // reduced motion: nothing moves until asked
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting) v.play().catch(() => { v.controls = true })
    else v.pause()
  }, { threshold: 0.25 }).observe(v)
})

// ---------- switchers: tabs that swap one clip (views, hands) ----------
let switchers = 0
document.querySelectorAll('[data-switch]').forEach((box) => {
  const tabs = [...box.querySelectorAll('[role="tab"]')], video = box.querySelector('video'), note = box.querySelector('.switch-note')
  // tie the tabs to the one panel they all control
  const panel = box.querySelector('figure'), n = ++switchers
  panel.id = `switch-panel-${n}`
  panel.setAttribute('role', 'tabpanel')
  tabs.forEach((t, i) => { t.id = `switch-tab-${n}-${i}`; t.setAttribute('aria-controls', panel.id) })
  panel.setAttribute('aria-labelledby', tabs.find((t) => t.getAttribute('aria-selected') === 'true').id)
  let timer = 0
  function pick(tab, focus) {
    if (tab.getAttribute('aria-selected') === 'true' && !focus) return
    tabs.forEach((t) => { const on = t === tab; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1 })
    if (focus) tab.focus()
    note.textContent = tab.dataset.note
    panel.setAttribute('aria-labelledby', tab.id)
    box.classList.add('swap')
    clearTimeout(timer)       // a second click before the fade ends replaces the first
    timer = setTimeout(() => {
      video.poster = `video/${tab.dataset.clip}.jpg`
      video.src = `video/${tab.dataset.clip}.mp4`
      video.load()
      if (!still) video.play().catch(() => { video.controls = true })
      box.classList.remove('swap')
    }, still ? 0 : 220)
  }
  tabs.forEach((t, i) => {
    t.tabIndex = t.getAttribute('aria-selected') === 'true' ? 0 : -1
    t.addEventListener('click', () => pick(t))
    t.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
      if (!d) return
      e.preventDefault()
      pick(tabs[(i + d + tabs.length) % tabs.length], true)
    })
  })
})

// ---------- download buttons point straight at the newest release's files ----------
// Until this answers (or if it fails) the buttons open the releases page, which always shows the newest release.
;(async function downloads() {
  const base = 'https://github.com/scizerss/keylight-piano/releases/download/'
  try {
    const res = await fetch('https://api.github.com/repos/scizerss/keylight-piano/releases/latest', { signal: AbortSignal.timeout(6000) })
    if (!res.ok) return
    const rel = await res.json()
    if (!rel || rel.draft || rel.prerelease || !Array.isArray(rel.assets)) return
    const ok = rel.assets.filter((a) => a && typeof a.name === 'string' && a.name.startsWith('Keylight-') && typeof a.browser_download_url === 'string' &&
      a.browser_download_url.startsWith(base) && a.browser_download_url.endsWith('/' + a.name) && !/[?#\\\s]/.test(a.browser_download_url))
    const pick = (ends) => ends.map((e) => ok.find((a) => a.name.toLowerCase().endsWith(e))).find(Boolean)
    const files = { mac: pick(['.dmg', '-mac.zip']), win: pick(['-setup.exe', '-win-x64.zip']), android: pick(['.apk']) }
    for (const link of document.querySelectorAll('[data-dl]')) { const f = files[link.dataset.dl]; if (f) link.href = f.browser_download_url }
    if (typeof rel.tag_name === 'string' && /^v?[0-9][0-9A-Za-z.-]{0,30}$/.test(rel.tag_name)) $('dlVersion').textContent = 'Version ' + rel.tag_name.replace(/^v/, '') + '. Mac: a disk image. Windows: an installer. Android: an APK file you open on your phone.'
  } catch (_e) { /* offline or rate-limited: the buttons keep opening the releases page */ }
})()
