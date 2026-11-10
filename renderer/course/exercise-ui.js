// The four course exercises that are not a toolbox run, a piece or a quiz card: echo, rhythm, ear
// and sight. This file is the showing and the timing; what is right or wrong lives in
// exercise-logic.js (pure, tested under node). app.js hands in `deps` (sound, the shared note
// path, the clock) and course-ui.js hands in `host`, which saves a result and says what comes next.
//
//   const ex = mountExercise(root, { item, deps, host })
//   deps: { press(p), release(p), schedule(p, vel, offsetSec, durSec), click(accent, delaySec),
//           stopSound(), now(), latencyMs?() }
//   host: { record({accuracy, stars, seconds}) -> { passed, lessonDone, exam }, next(passed) -> { label, primary, go },
//           title, back(), againLabel? }   againLabel replaces the Play again / Try again text
// Notes you play reach the exercise through ex.input(pitch, t): the app calls it from its one
// note-on path, so a MIDI keyboard, the on-screen keys and the computer keys all count the same.
import {
  echoRounds, echoTry, echoRoundScore, echoAccuracy, ECHO_TRIES, ECHO_RETRY_COST,
  rhythmPlan, judgeRhythm, RHYTHM_EXTRA_COST,
  earSet, hashSeed, EAR_DEFAULT_ROUNDS,
  generateSight, spellPitch, gradeSight, starsFor, pc
} from './exercise-logic.js'
import { passText } from './runners.js'
import { TOUCH } from '../platform.js'

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
const WHITE_PC = [0, 2, 4, 5, 7, 9, 11]
const isWhite = (p) => WHITE_PC.includes(pc(p))
const noteName = (p) => NAMES[pc(p)]
const pct = (x) => Math.round(x * 100)

const SVG = {
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  replay: '<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4.5V9h4.5"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
  back: '<path d="m14.5 5-7 7 7 7"/>',
  star: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z"/>',
  speaker: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  tip: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>'
}
const ic = (n, cls = 'ex-ic') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${SVG[n] || ''}</svg>`

/* ---------- computer keys that play the pad (any layout: they use the physical key) ---------- */
const KEY_SEMIS = { KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13, KeyL: 14, KeyP: 15, Semicolon: 16 }

/* ---------- a mini keyboard you can look at and play ---------- */
function padRange(pitches, minOctaves = 1) {
  let lo = Math.min(...pitches), hi = Math.max(...pitches)
  lo -= pc(lo)                                   // down to a C
  hi += (11 - pc(hi))                            // up to a B
  if (hi - lo < 12 * minOctaves - 1) hi = lo + 12 * minOctaves - 1
  return [lo, hi]
}
export function padSvg([lo, hi], { names = true } = {}) {
  const W = 40, H = 124, BW = 25, BH = 76
  const whites = []
  for (let p = lo; p <= hi; p++) if (isWhite(p)) whites.push(p)
  const idx = new Map(whites.map((p, i) => [p, i]))
  let out = ''
  for (const p of whites) {
    const x = idx.get(p) * W
    out += `<rect class="dk-w ex-key" data-p="${p}" x="${x + 1}" y="1" width="${W - 2}" height="${H - 2}" rx="5"/>`
    if (names) out += `<text class="dk-name ex-kname" x="${x + W / 2}" y="${H - 10}" text-anchor="middle" pointer-events="none">${NAMES[pc(p)]}</text>`
  }
  for (let p = lo; p <= hi; p++) {
    if (isWhite(p)) continue
    const prev = idx.get(p - 1)
    if (prev === undefined) continue
    out += `<rect class="dk-b ex-key" data-p="${p}" x="${(prev + 1) * W - BW / 2}" y="1" width="${BW}" height="${BH}" rx="4"/>`
  }
  return `<svg class="ex-padsvg" viewBox="0 0 ${whites.length * W} ${H}" style="max-width:${Math.max(300, whites.length * 62)}px" role="group" aria-label="Keyboard from ${NAMES[pc(lo)]} to ${NAMES[pc(hi)]}">${out}</svg>`
}

/* ============================== the mount ============================== */
export function mountExercise(root, { item, deps, host }) {
  const type = item.type
  const params = item.params
  let alive = true
  let token = 0
  const timers = new Set()
  let raf = 0
  let unlisten = []
  let run = null                      // the running exercise's handlers: { input(pitch, t), key(e), stop() }
  let tries = 0                       // how many times this item has been started (seeds the questions)
  let lastResult = null

  const now = () => deps.now()
  const later = (fn, ms) => { const my = token; const id = setTimeout(() => { timers.delete(id); if (alive && my === token) fn() }, Math.max(0, ms)); timers.add(id); return id }
  const clearTimers = () => { for (const id of timers) clearTimeout(id); timers.clear(); if (raf) cancelAnimationFrame(raf); raf = 0 }
  const stopSound = () => { try { deps.stopSound() } catch { /* no audio yet */ } }
  const on = (target, ev, fn, opts) => { target.addEventListener(ev, fn, opts); unlisten.push(() => target.removeEventListener(ev, fn, opts)) }
  const live = () => root.querySelector('.ex-live')
  const say = (text) => { const l = live(); if (l) l.textContent = text }
  const q = (sel) => root.querySelector(sel)
  // every note this exercise starts is remembered until it is let go, so leaving (or restarting) can never leave one sounding
  const sounding = new Set()
  const rawTimers = new Set()         // key-release and flash timers that must outlive a token change but not the mount
  const rawLater = (fn, ms) => { const id = setTimeout(() => { rawTimers.delete(id); fn() }, ms); rawTimers.add(id); return id }
  const pressKey = (p) => { sounding.add(p); return deps.press ? deps.press(p) : api.input(p, now()) }
  const releaseKey = (p) => { if (sounding.delete(p) && deps.release) deps.release(p) }
  const releaseAll = () => { for (const p of [...sounding]) releaseKey(p) }
  const tapNote = (p) => { pressKey(p); rawLater(() => releaseKey(p), 120) }

  const KIND = { echo: ['ECHO', 'Listen, then play it back'], rhythm: ['RHYTHM', 'Tap the rhythm'], ear: ['EAR TRAINING', 'Listen, then choose'], sight: ['SIGHT READING', 'Read it and play it'] }[type] || ['EXERCISE', '']
  const shell = (stage, extra = '') => {
    root.innerHTML = `<div class="cr-page ex-page ex-${type}" data-focus-root>
      <button class="cr-back" data-ex="back">${ic('back', 'cr-back-ic')}<span>${esc(host.title || 'Back')}</span></button>
      <section class="ex-card" aria-labelledby="ex-title">
        <header class="ex-head">
          <div><div class="kicker">${KIND[0]}<span class="cr-dot"></span>AIM FOR ${esc(passText(item)).toUpperCase()}</div>
          <h2 class="ex-title" id="ex-title" tabindex="-1">${esc(item.title)}</h2></div>
          <div class="ex-chips" data-ex="chips"></div>
        </header>
        <div class="ex-stage" data-ex="stage">${stage}</div>
        ${extra}
        <div class="ex-live sr-only" role="status" aria-live="polite"></div>
      </section></div>`
  }
  const chips = (list) => { const c = q('[data-ex="chips"]'); if (c) c.innerHTML = list.map((t) => `<span class="ex-chip">${t}</span>`).join('') }
  const setKey = (p, cls, onOff = true) => { const k = root.querySelector(`.ex-key[data-p="${p}"]`); if (k) k.classList.toggle(cls, onOff) }
  const clearKeys = (...cls) => root.querySelectorAll('.ex-key').forEach((k) => k.classList.remove(...(cls.length ? cls : ['lit', 'ok', 'bad', 'down'])))

  /* ----- the pad takes the mouse, touch and computer keys; MIDI arrives through input() ----- */
  function wirePad(range) {
    const pad = q('.ex-pad')
    if (!pad) return
    const held = new Map()
    const down = (e) => {
      const k = e.target.closest && e.target.closest('.ex-key')
      if (!k || e.button > 0) return
      e.preventDefault()
      const p = Number(k.dataset.p)
      try { k.setPointerCapture(e.pointerId) } catch { /* not needed */ }
      held.set(e.pointerId, p)
      k.classList.add('down')
      pressKey(p)
    }
    const up = (e) => {
      const p = held.get(e.pointerId)
      if (p === undefined) return
      held.delete(e.pointerId)
      setKey(p, 'down', false)
      releaseKey(p)
    }
    pad.addEventListener('pointerdown', down)
    pad.addEventListener('pointerup', up)
    pad.addEventListener('pointercancel', up)
    const base = range[0]
    const typed = new Map()
    on(document, 'keydown', (e) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || !(e.code in KEY_SEMIS)) return
      if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return
      const p = base + KEY_SEMIS[e.code]
      if (p > range[1]) return
      e.preventDefault()
      typed.set(e.code, p)
      setKey(p, 'down', true)
      pressKey(p)
    })
    on(document, 'keyup', (e) => {
      const p = typed.get(e.code)
      if (p === undefined) return
      typed.delete(e.code)
      setKey(p, 'down', false)
      releaseKey(p)
    })
  }

  /* ----- the result card every exercise ends with ----- */
  function finish({ accuracy, stars, seconds, lines = [], headline }) {
    // the run is over: no pending callback may fire, nothing may keep sounding
    token++; clearTimers(); stopSound(); releaseAll()
    const result = host.record({ accuracy, stars, seconds })
    lastResult = { accuracy, stars, ...result }
    const next = host.next(result.passed)
    const st = stars ?? starsFor(accuracy)
    const starRow = Array.from({ length: 5 }, (_, i) => `<svg class="ex-star${i < st ? ' on' : ''}" viewBox="0 0 24 24" aria-hidden="true">${SVG.star}</svg>`).join('')
    const need = item.passAt || {}
    const runOk = accuracy >= (need.accuracy ?? (need.stars ? 0 : 0.8)) && (!need.stars || st >= need.stars)
    const verdict = runOk ? 'Item passed' : result.passed ? 'Not this time: your earlier pass still counts' : `Not there yet: aim for ${passText(item)}`
    const stage = q('[data-ex="stage"]')
    stage.innerHTML = `<div class="ex-result ${runOk ? 'ok' : 'miss'}" tabindex="-1" data-ex="result">
      <div class="ex-rscore"><b>${pct(accuracy)}</b><i>%</i></div>
      <div class="ex-rbody">
        <div class="ex-rhead">${esc(headline || verdict)}</div>
        <div class="ex-stars" role="img" aria-label="${st} of 5 stars">${starRow}</div>
        <div class="ex-rverdict">${esc(headline ? verdict : '')}${result.lessonDone ? `${headline ? ' · ' : ''}Lesson complete` : ''}${result.exam ? ` · Exam ${Math.round(result.exam.percent)}%` : ''}</div>
        ${lines.length ? `<ul class="ex-rlines">${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
      </div></div>
      <div class="ex-acts">
        <button class="${next.primary ? 'primary' : 'ghost'}" data-ex="next">${esc(next.label)}</button>
        <button class="${next.primary ? 'ghost' : 'primary'}" data-ex="again">${esc(host.againLabel || (result.passed ? 'Play again' : 'Try again'))}</button>
      </div>`
    const nb = stage.querySelector('[data-ex="next"]')
    nb.onclick = () => { api.destroy(); next.go() }
    stage.querySelector('[data-ex="again"]').onclick = () => start()
    run = { input() {}, key(e) { if (e.key === 'Enter' && !e.repeat && document.activeElement && document.activeElement.tagName !== 'BUTTON') { e.preventDefault(); (next.primary ? nb : stage.querySelector('[data-ex="again"]')).click() } }, stop() {} }
    chips([`${pct(accuracy)}%`])
    say(`${pct(accuracy)} percent. ${verdict}.${result.lessonDone ? ' Lesson complete.' : ''}`)
    const r = q('[data-ex="result"]'); if (r) r.focus({ preventScroll: true })
  }

  /* ============================== echo ============================== */
  function startEcho() {
    const rounds = echoRounds(params)
    const beatSec = 60 / params.tempo
    const full = params.notes.filter((n) => n.p !== null && n.p !== undefined)
    const range = padRange(full.map((n) => n.p))
    const scores = []
    const st = { round: 0, attempts: [], played: [], phase: 'listen', roundOver: false }
    shell(`<div class="ex-status" data-ex="msg" aria-hidden="true"></div>
      <div class="ex-slots" data-ex="slots" aria-hidden="true"></div>
      <div class="ex-pad" data-ex="pad">${padSvg(range)}</div>
      <p class="ex-hint">${TOUCH ? 'Play it on your keyboard or tap the keys above.' : 'Play it on your keyboard, the keys above, or the computer keys A S D F G H J.'}</p>
      <div class="ex-acts" data-ex="acts"></div>`)
    wirePad(range)
    const msg = (t, cls = '') => { const m = q('[data-ex="msg"]'); if (m) { m.textContent = t; m.className = 'ex-status ' + cls } }
    const phrase = () => rounds[st.round]
    const slots = () => {
      const n = phrase().length
      q('[data-ex="slots"]').innerHTML = Array.from({ length: n }, (_, i) => {
        const p = st.played[i]
        const ok = p !== undefined && pc(p) === pc(phrase()[i].p)
        return `<span class="ex-slot${p === undefined ? '' : ok ? ' ok' : ' bad'}">${p === undefined ? '' : noteName(p)}</span>`
      }).join('')
    }
    const head = () => chips([`Round ${st.round + 1} of ${rounds.length}`, `Try ${st.attempts.length + 1} of ${ECHO_TRIES}`])
    const acts = (html) => { q('[data-ex="acts"]').innerHTML = html }
    const hearBtn = `<button class="ghost" data-ex="hear">${ic('replay', 'ex-bic')}Hear again</button>`

    function playPhrase(then) {
      st.phase = 'listen'; clearKeys(); stopSound(); token++
      const my = token
      msg('Listen…', 'listen'); acts(`<button class="ghost" disabled>${ic('speaker', 'ex-bic')}Listening</button>`)
      slots()
      const ph = phrase()
      const first = ph[0].beat
      ph.forEach((n) => {
        const at = (n.beat - first) * beatSec + 0.25, dur = Math.max(0.12, n.beats * beatSec * 0.92)
        deps.schedule(n.p, 84, at, dur)
        later(() => { clearKeys('lit'); setKey(n.p, 'lit') }, at * 1000)
        later(() => setKey(n.p, 'lit', false), (at + dur) * 1000)
      })
      const last = ph[ph.length - 1]
      later(() => { if (my === token) then() }, ((last.beat - first) * beatSec + 0.25 + Math.max(0.2, last.beats * beatSec * 0.92)) * 1000 + 250)
    }
    // after a round is over, Hear again only plays the phrase: no new try starts
    function hearOnly() {
      stopSound(); token++
      const ph = phrase(), first = ph[0].beat
      ph.forEach((n) => {
        const at = (n.beat - first) * beatSec + 0.1, dur = Math.max(0.12, n.beats * beatSec * 0.92)
        deps.schedule(n.p, 84, at, dur)
        later(() => setKey(n.p, 'down', true), at * 1000)
        later(() => setKey(n.p, 'down', false), (at + dur) * 1000)
      })
    }
    function yourTurn() {
      st.roundOver = false
      st.phase = 'play'; st.played = []; clearKeys(); head()
      msg('Your turn: play it back', 'turn')
      acts(hearBtn)
      slots()
      say(`Your turn. Play back ${phrase().length} notes.`)
      st.t0 = now()
    }
    function tryEnded() {
      st.phase = 'between'
      const ph = phrase()
      const t = echoTry(ph, st.played)
      st.attempts.push(t.accuracy)
      const exact = t.exact
      const roundOver = exact || st.attempts.length >= ECHO_TRIES
      slots()
      ph.forEach((n) => setKey(n.p, exact ? 'ok' : 'lit', true))
      const last = st.round === rounds.length - 1
      if (exact) {
        const cost = st.attempts.length > 1 ? ` (try ${st.attempts.length}: ${pct(echoRoundScore(st.attempts))}%)` : ''
        msg('Exactly right' + cost, 'ok'); say('Exactly right.')
      } else {
        msg(roundOver ? `Not this time. It was ${ph.map((n) => noteName(n.p)).join(' ')}` : `Not quite: ${pct(t.accuracy)}% in order. Listen again`, 'no')
        say(roundOver ? 'It was ' + ph.map((n) => noteName(n.p)).join(', ') : 'Not quite. Try again.')
      }
      st.roundOver = roundOver
      if (roundOver) {
        scores.push(echoRoundScore(st.attempts))
        acts(`<button class="primary" data-ex="advance">${last ? 'See your result' : 'Next round'}</button>${hearBtn}`)
      } else acts(`<button class="primary" data-ex="retry">Try again</button>${hearBtn}`)
      const b = q('[data-ex="advance"], [data-ex="retry"]'); if (b) b.focus({ preventScroll: true })
    }
    function nextRound() {
      if (st.round >= rounds.length - 1) {
        const accuracy = echoAccuracy(scores)
        const tried = scores.map((s, i) => `Round ${i + 1}: ${pct(s)}%`)
        return finish({ accuracy, seconds: Math.round((now() - st.start) / 1000), lines: [...tried, `A second or third try on a round costs ${pct(ECHO_RETRY_COST)}% each.`] })
      }
      st.round++; st.attempts = []; st.played = []; st.roundOver = false; head()
      playPhrase(yourTurn)
    }
    st.start = now()
    head()
    playPhrase(yourTurn)
    q('[data-ex="acts"]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-ex]'); if (!b) return
      if (b.dataset.ex === 'hear') { if (st.roundOver) hearOnly(); else { st.played = []; playPhrase(yourTurn) } }
      else if (b.dataset.ex === 'retry') { st.played = []; playPhrase(yourTurn) }
      else if (b.dataset.ex === 'advance') nextRound()
    })
    run = {
      input(pitch) {
        if (st.phase !== 'play') return
        const ph = phrase()
        const i = st.played.length
        if (!ph || i >= ph.length) return                 // the phrase is complete: more keys are not part of it
        const right = pc(pitch) === pc(ph[i].p)
        st.played.push(pitch)
        clearKeys('ok', 'bad'); setKey(pitch, right ? 'ok' : 'bad')
        slots()
        if (st.played.length >= ph.length) { st.phase = 'between'; later(tryEnded, 180) }   // input closes now, feedback follows
      },
      key(e) {
        if (e.key === 'Enter' && !e.repeat) { const b = q('[data-ex="advance"], [data-ex="retry"]'); if (b && document.activeElement !== b) { e.preventDefault(); b.click() } }
        if (e.key === 'h' || e.key === 'H' ) { if (!e.repeat && !e.metaKey && !e.ctrlKey) { const h = q('[data-ex="hear"]'); if (h) h.click() } }
      },
      state: () => ({ round: st.round, rounds: rounds.length, tryNo: st.attempts.length, played: st.played.length, phase: st.phase }),
      phrase: () => phrase().map((n) => n.p),
      skipListening() { if (st.phase === 'listen') { token++; clearTimers(); yourTurn() } }
    }
  }

  /* ============================== rhythm ============================== */
  function startRhythm() {
    const plan = rhythmPlan(params)
    const { beatMs, bar, totalBeats, windows } = plan
    const st = { phase: 'ready', taps: [], start: 0, p0: 0, ended: false, scheduledTo: 0, demo: false }
    const label = (n) => (Number.isInteger(n) ? String(n) : String(+n.toFixed(2)))
    const x = (ms) => `${(ms / plan.totalMs) * 100}%`
    const grid = Array.from({ length: Math.ceil(totalBeats) }, (_, b) => `<i class="rx-beat${b % bar === 0 ? ' bar' : ''}" style="left:${x(b * beatMs)}"><em>${(b % bar) + 1}</em></i>`).join('')
    const cells = plan.cells.map((c, i) => `<span class="rx-cell${c.rest ? ' rest' : ''}" data-i="${i}" style="left:${x(c.ms)};width:calc(${(c.durMs / plan.totalMs) * 100}% - 4px)">${c.rest ? '<b>rest</b>' : '<b></b>'}</span>`).join('')
    const pulses = Array.from({ length: bar }, (_, i) => `<i class="rx-dot${i === 0 ? ' acc' : ''}" data-d="${i}">${i + 1}</i>`).join('')
    shell(`<div class="rx-top">
        <div class="rx-pulse" data-ex="pulse" aria-hidden="true">${pulses}</div>
        <div class="ex-status" data-ex="msg">Look at the rhythm, then tap it on any key</div>
      </div>
      <div class="rx-track" data-ex="track" aria-hidden="true">
        <div class="rx-grid">${grid}</div>
        <div class="rx-cells">${cells}</div>
        <div class="rx-play" data-ex="head"></div>
        <div class="rx-marks" data-ex="marks"></div>
      </div>
      <div class="rx-sr sr-only">Rhythm: ${params.pattern.map((b) => (b < 0 ? 'rest ' : '') + label(Math.abs(b))).join(', ')} beats, at ${params.tempo} beats a minute in ${esc(params.timeSignature || '4/4')}.</div>
      <button class="rx-pad" data-ex="tap" aria-label="Tap here, or press the space bar or any key">
        <span class="rx-pad-t">Tap</span><span class="rx-pad-s">${TOUCH ? 'on this pad, or play on your keyboard' : 'on your keyboard, here, or press Space'}</span>
      </button>
      <div class="ex-acts" data-ex="acts"></div>`)
    chips([`${params.tempo} BPM`, esc(params.timeSignature || '4/4')])
    const acts = (html) => { q('[data-ex="acts"]').innerHTML = html }
    const msg = (t, cls = '') => { const m = q('[data-ex="msg"]'); if (m) { m.textContent = t; m.className = 'ex-status ' + cls } }
    acts(`<button class="primary" data-ex="go">${ic('play', 'ex-bic')}Start with a count-in</button><button class="ghost" data-ex="demo">${ic('speaker', 'ex-bic')}Hear it first</button>`)
    const goBtn = q('[data-ex="go"]'); if (goBtn) goBtn.focus({ preventScroll: true })
    const head = q('[data-ex="head"]'), marks = q('[data-ex="marks"]'), pulse = q('[data-ex="pulse"]')
    const tapPad = q('[data-ex="tap"]')
    const lat = () => (deps.latencyMs ? deps.latencyMs() : 0)

    // the click track: scheduled a little ahead on the audio clock, so a busy page never makes it wobble.
    // Click n sits n beats after the first beat of the pattern; the count-in is the negative ones.
    let nextN = 0, endN = 0
    const lookahead = () => {
      const t = now()
      while (nextN < endN && st.p0 + nextN * beatMs <= t + 140) {
        const inBar = ((nextN % bar) + bar) % bar
        deps.click(inBar === 0, Math.max(0, (st.p0 + nextN * beatMs - t) / 1000))
        nextN++
      }
    }
    function runClock(my, onDone, endMs) {
      const tick = () => {
        if (!alive || my !== token) return
        lookahead()
        const t = now() - st.p0
        const which = ((Math.floor(t / beatMs) % bar) + bar) % bar
        pulse.querySelectorAll('.rx-dot').forEach((d, i) => d.classList.toggle('now', i === which && t >= -plan.countInBeats * beatMs))
        head.style.left = x(Math.min(plan.totalMs, Math.max(0, t)))
        head.classList.toggle('show', t >= -30 && t <= plan.totalMs + 30)
        pulse.classList.toggle('counting', t < 0 && !st.demo)
        if (t < 0 && !st.demo) msg(`Count in: ${Math.floor((t + plan.countInBeats * beatMs) / beatMs) + 1} of ${bar}`, 'listen')
        else if (st.phase === 'tap') msg('Tap it', 'turn')
        else if (st.phase === 'demo') msg('Listen to the rhythm', 'listen')
        if (t >= endMs) return onDone()
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }
    function begin(demo) {
      token++; const my = token
      clearTimers(); stopSound()
      st.demo = demo; st.taps = []; st.ended = false
      marks.innerHTML = ''; q('[data-ex="track"]').classList.remove('judged')
      root.querySelectorAll('.rx-cell').forEach((c) => c.classList.remove('hit', 'perfect', 'good', 'early', 'late', 'missed'))
      st.phase = demo ? 'demo' : 'countin'
      st.p0 = now() + 250 + (demo ? 0 : plan.countInBeats * beatMs)     // the first beat of the pattern
      nextN = demo ? 0 : -plan.countInBeats; endN = Math.ceil(totalBeats)
      if (demo) plan.onsets.forEach((o) => deps.schedule(72, 80, (st.p0 - now() + o.ms) / 1000, Math.max(0.12, (o.durMs / 1000) * 0.9)))
      acts(`<button class="ghost" data-ex="stop">Stop</button>`)
      tapPad.disabled = false
      if (!demo) tapPad.focus({ preventScroll: true })
      // the whole pattern is judged, trailing rests included: taps stay open until its full length (plus a tolerance)
      const endMs = demo ? plan.totalMs + 200 : Math.max(plan.totalMs, plan.onsets[plan.onsets.length - 1].ms + windows.edge) + 250
      if (!demo) later(() => { st.phase = 'tap' }, st.p0 - now())
      st.endMs = endMs
      runClock(my, demo ? ready : judge, endMs)
      say(demo ? 'Listening to the rhythm.' : `Count-in of ${bar} beats, then tap.`)
    }
    function ready() {
      token++; clearTimers(); stopSound(); st.phase = 'ready'
      head.classList.remove('show'); pulse.querySelectorAll('.rx-dot').forEach((d) => d.classList.remove('now'))
      msg('Look at the rhythm, then tap it on any key')
      acts(`<button class="primary" data-ex="go">${ic('play', 'ex-bic')}Start with a count-in</button><button class="ghost" data-ex="demo">${ic('speaker', 'ex-bic')}Hear it first</button>`)
      const g = q('[data-ex="go"]'); if (g) g.focus({ preventScroll: true })
    }
    const KIND_TEXT = { perfect: 'Spot on', good: 'Good', early: 'Early', late: 'Late', missed: 'Missed' }
    function paint(taps) {
      const j = judgeRhythm(plan, taps)
      root.querySelectorAll('.rx-cell:not(.rest)').forEach((c, i) => {
        const r = j.results[i]
        c.classList.remove('hit', 'perfect', 'good', 'early', 'late', 'missed')
        if (r.tap !== null) c.classList.add('hit', r.kind)
      })
      const items = []
      j.results.forEach((r) => { if (r.tap !== null) items.push(`<i class="rx-mark ${r.kind}" style="left:${x(r.tap)}" title="${KIND_TEXT[r.kind]} ${Math.round(r.dt)} ms"><u>${r.kind === 'early' ? '◂' : r.kind === 'late' ? '▸' : '●'}</u></i>`) })
      j.extras.forEach((t) => items.push(`<i class="rx-mark extra" style="left:${x(Math.min(Math.max(t, 0), plan.totalMs))}" title="Extra tap"><u>×</u></i>`))
      marks.innerHTML = items.join('')
      return j
    }
    function judge() {
      if (st.ended) return
      st.ended = true; st.phase = 'done'; token++; clearTimers()
      tapPad.disabled = true
      head.classList.remove('show'); pulse.querySelectorAll('.rx-dot').forEach((d) => d.classList.remove('now'))
      const j = paint(st.taps)
      q('[data-ex="track"]').classList.add('judged')
      j.results.forEach((r, i) => { if (r.kind === 'missed') root.querySelectorAll('.rx-cell:not(.rest)')[i]?.classList.add('missed') })
      const timed = j.results.filter((r) => r.dt !== null)
      const avg = timed.length ? timed.reduce((a, r) => a + r.dt, 0) / timed.length : 0
      const c = j.counts
      const lines = [
        `${c.perfect} spot on, ${c.good} good, ${c.early} early, ${c.late} late, ${c.missed} missed`,
        ...(j.extras.length ? [`${j.extras.length} extra tap${j.extras.length > 1 ? 's' : ''} (each costs ${pct(RHYTHM_EXTRA_COST)}% of a note)`] : []),
        timed.length >= 2 && Math.abs(avg) >= 25 ? `You tapped ${Math.abs(Math.round(avg))} ms ${avg < 0 ? 'ahead of' : 'behind'} the beat on average.` : 'Your taps sat close to the beat.'
      ]
      const stage = q('[data-ex="stage"]')
      const keep = stage.querySelector('.rx-track'), sr = stage.querySelector('.rx-sr')
      // keep the judged track on screen above the result card
      finish({ accuracy: j.accuracy, seconds: Math.round(totalBeats * beatMs / 1000 + plan.countInBeats * beatMs / 1000), lines })
      const s2 = q('[data-ex="stage"]')
      s2.insertBefore(keep, s2.firstChild); if (sr) s2.insertBefore(sr, keep.nextSibling)
    }
    // the same finish when a run is cut short by a test or by Stop
    const record = (t) => {
      if (st.phase !== 'tap' && st.phase !== 'countin') return
      const rel = t - st.p0 - lat()
      st.taps.push(rel)
      if (rel >= -windows.edge) paint(st.taps.filter((v) => v >= -windows.edge))
      tapPad.classList.add('hit'); rawLater(() => tapPad.classList.remove('hit'), 90)
    }
    q('[data-ex="acts"]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-ex]'); if (!b) return
      if (b.dataset.ex === 'go') begin(false)
      else if (b.dataset.ex === 'demo') begin(true)
      else if (b.dataset.ex === 'stop') ready()
    })
    on(tapPad, 'pointerdown', (e) => { if (e.button > 0) return; e.preventDefault(); tapNote(72) })
    run = {
      input(pitch, t) { record(t) },
      key(e) {
        if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
        const typing = e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)
        if (typing) return
        if (st.phase === 'tap' || st.phase === 'countin') {
          if (e.code === 'Space' || e.code in KEY_SEMIS || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); tapNote(72) }
          return
        }
        if (e.code === 'Space' || e.key === 'Enter') { const b = q('[data-ex="go"], [data-ex="next"]'); if (b && document.activeElement !== b) { e.preventDefault(); b.click() } }
      },
      stop() {},
      state: () => ({ phase: st.phase, taps: st.taps.length, p0: st.p0, endMs: st.endMs }),
      plan: () => plan,
      // for tests: tap at a time (ms from the first beat) and end the run now
      tapAt(ms) { st.taps.push(ms) },
      judgeNow() { st.phase = 'tap'; judge() }
    }
  }

  /* ============================== ear training ============================== */
  function startEar() {
    const seed = hashSeed(item.id) + tries * 7919
    const set = earSet(params, seed)
    const st = { i: 0, right: 0, answered: false, picks: [], start: now() }
    const letters = 'ABCDEF'
    shell(`<div class="er-card">
        <div class="er-listen"><button class="er-speaker" data-ex="replay" aria-label="Play the sound again">${ic('speaker', 'er-sp-ic')}<span class="er-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span></button>
        <div class="er-ptxt"><div class="er-prompt" data-ex="prompt"></div><div class="er-sub">${TOUCH ? 'Tap the speaker to hear it again, then tap your answer.' : 'Press R to hear it again. Choose with 1 to 4.'}</div></div></div>
        <div class="cr-opts er-opts" data-ex="opts" role="group" aria-label="Answers"></div>
        <div data-ex="fb"></div>
      </div>
      <div class="ex-acts" data-ex="acts"></div>`)
    const dots = () => `<span class="er-dots" aria-hidden="true">${set.map((_, k) => `<i class="${k < st.i ? (st.picks[k] ? 'ok' : 'no') : k === st.i ? 'now' : ''}"></i>`).join('')}</span>`
    const play = () => {
      stopSound(); token++
      const qn = set[st.i]
      const dur = Math.max(...qn.notes.map((n) => n.at + n.dur)) + 0.2
      qn.notes.forEach((n) => deps.schedule(n.p, 82, n.at + 0.12, n.dur))
      const sp = q('.er-speaker'); if (sp) sp.classList.add('sounding')
      later(() => { const s = q('.er-speaker'); if (s) s.classList.remove('sounding') }, dur * 1000)
    }
    function show() {
      const qn = set[st.i]
      st.answered = false
      chips([`Question ${st.i + 1} of ${set.length}`, dots()])
      q('[data-ex="prompt"]').textContent = qn.prompt
      q('[data-ex="opts"]').innerHTML = qn.options.map((o, k) => `<button class="cr-opt" data-ex="pick" data-id="${esc(o.id)}"><span class="cr-opt-l">${letters[k]}</span><span class="cr-opt-t">${esc(o.label)}</span></button>`).join('')
      q('[data-ex="fb"]').innerHTML = ''
      q('[data-ex="acts"]').innerHTML = ''
      say(`Question ${st.i + 1} of ${set.length}. ${qn.prompt}`)
      later(play, 350)
    }
    function pick(id) {
      if (st.answered) return
      st.answered = true
      const qn = set[st.i]
      const right = id === qn.answer
      st.picks[st.i] = right
      if (right) st.right++
      q('[data-ex="opts"]').querySelectorAll('.cr-opt').forEach((b) => {
        const mine = b.dataset.id === id, correct = b.dataset.id === qn.answer
        b.setAttribute('aria-disabled', 'true')
        b.classList.toggle('right', correct); b.classList.toggle('wrong', mine && !correct)
        const tag = correct ? '<span class="cr-opt-tag">Correct answer</span>' : mine ? '<span class="cr-opt-tag">Your answer</span>' : ''
        b.insertAdjacentHTML('beforeend', tag + (correct ? ic('check', 'cr-opt-ic') : ''))
      })
      const answerLabel = qn.options.find((o) => o.id === qn.answer).label
      q('[data-ex="fb"]').innerHTML = `<div class="cr-fb ${right ? 'ok' : 'no'}" role="status" tabindex="-1"><div class="cr-fb-t">${ic(right ? 'check' : 'tip', 'cr-fb-ic')}${right ? 'Correct' : 'Not quite: it was ' + esc(answerLabel)}</div><p>${esc(qn.why)}</p></div>`
      chips([`Question ${st.i + 1} of ${set.length}`, dots()])
      const last = st.i === set.length - 1
      q('[data-ex="acts"]').innerHTML = `<button class="primary" data-ex="nxt">${last ? 'See your result' : 'Next question'}</button><button class="ghost" data-ex="replay">${ic('replay', 'ex-bic')}Hear it again</button>`
      say((right ? 'Correct. ' : 'Not quite, it was ' + answerLabel + '. ') + qn.why)
      const n = q('[data-ex="nxt"]'); if (n) n.focus({ preventScroll: true })
    }
    function next() {
      if (!st.answered) return
      if (st.i >= set.length - 1) {
        stopSound()
        const accuracy = st.right / set.length
        return finish({ accuracy, seconds: Math.round((now() - st.start) / 1000), lines: [`${st.right} of ${set.length} right`] })
      }
      st.i++; show()
    }
    show()
    root.querySelector('.ex-card').addEventListener('click', (e) => {
      const b = e.target.closest('[data-ex]'); if (!b) return
      if (b.dataset.ex === 'pick') pick(b.dataset.id)
      else if (b.dataset.ex === 'replay') { if (st.i < set.length) play() }
      else if (b.dataset.ex === 'nxt') next()
    })
    run = {
      input() {},
      key(e) {
        if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return
        if (e.key === 'r' || e.key === 'R') { play(); return }
        const n = Number(e.key)
        if (n >= 1 && n <= 6 && !st.answered) { const b = q('[data-ex="opts"]').children[n - 1]; if (b) { e.preventDefault(); b.click() } }
        else if (e.key === 'Enter' && st.answered && document.activeElement && document.activeElement.tagName !== 'BUTTON') { e.preventDefault(); next() }
      },
      state: () => ({ i: st.i, of: set.length, right: st.right, answered: st.answered, timers: timers.size }),
      question: () => set[st.i],
      pick, next
    }
  }

  /* ============================== sight reading ============================== */
  function startSight() {
    const seed = hashSeed(item.id) + tries * 104729
    const line = generateSight(params, seed)
    const range = padRange([...line.notes], 1)
    const st = { i: 0, wrong: 0, firstTry: 0, mistakes: new Array(line.notes.length).fill(0), t0: 0, done: false, startedAt: 0 }
    const staff = sightStaffSvg(line)
    shell(`<div class="sg-staff" data-ex="staff">${staff.svg}</div>
      <div class="ex-status" data-ex="msg">Play the highlighted note: the line waits for you</div>
      <div class="ex-pad" data-ex="pad">${padSvg(range)}</div>
      <p class="ex-hint">Any octave counts. ${TOUCH ? 'Play on your keyboard or tap the keys above.' : 'Play on your keyboard, the keys above, or the computer keys A S D F G H J.'}</p>
      <div class="ex-acts" data-ex="acts"></div>`)
    wirePad(range)
    const msg = (t, cls = '') => { const m = q('[data-ex="msg"]'); if (m) { m.textContent = t; m.className = 'ex-status ' + cls } }
    const total = line.notes.length
    const mark = () => {
      root.querySelectorAll('.sg-n').forEach((g, k) => {
        g.classList.toggle('cur', k === st.i && !st.done)
        g.classList.toggle('ok', k < st.i && st.mistakes[k] === 0)
        g.classList.toggle('retry', k < st.i && st.mistakes[k] > 0)
      })
      chips([`Note ${Math.min(st.i + 1, total)} of ${total}`, `${line.key.known ? esc(params.key) : 'C'} · ${params.hand}`])
    }
    mark()
    say(`A line of ${total} notes in ${params.key}. Play note 1.`)
    run = {
      input(pitch, t) {
        if (st.done) return
        if (!st.startedAt) st.startedAt = t
        const need = line.notes[st.i]
        clearKeys('ok', 'bad')
        if (pc(pitch) === pc(need)) {
          setKey(pitch, 'ok')
          if (st.mistakes[st.i] === 0) st.firstTry++
          st.i++
          if (st.i >= total) return end(t)
          mark(); msg('Good: the next note', 'ok')
        } else {
          st.mistakes[st.i]++; st.wrong++
          setKey(pitch, 'bad')
          const el = root.querySelectorAll('.sg-n')[st.i]
          if (el) { el.classList.remove('shake'); void el.getBoundingClientRect(); el.classList.add('shake') }
          msg(st.mistakes[st.i] >= 2 ? `That was ${noteName(pitch)}. Look for ${noteName(need)}` : `That was ${noteName(pitch)}: try again`, 'no')
          if (st.mistakes[st.i] >= 3) setKey(need, 'lit')
          say(`${noteName(pitch)} is not it. Try again.`)
        }
      },
      key(e) { if (e.key === 'Enter' && !e.repeat && st.done) { const b = q('[data-ex="next"]'); if (b) b.click() } },
      state: () => ({ i: st.i, of: total, wrong: st.wrong, done: st.done }),
      line: () => line
    }
    function end(t) {
      st.done = true; mark()
      const seconds = Math.max(1, (t - st.startedAt) / 1000)
      const g = gradeSight(total, st.firstTry, seconds)
      const keep = root.querySelector('.sg-staff')
      finish({ accuracy: g.accuracy, stars: g.stars, seconds: Math.round(seconds), lines: [`${st.firstTry} of ${total} notes right first time`, `Pace: ${Math.round(g.pace)} notes a minute`, ...(g.accuracy >= 0.95 && g.stars < 5 ? ['A fifth star needs 30 notes a minute or more.'] : [])] })
      if (keep) { const s2 = q('[data-ex="stage"]'); s2.insertBefore(keep, s2.firstChild) }
    }
  }

  /* ----- lifecycle ----- */
  function start() {
    clearTimers(); stopSound(); token++
    for (const f of unlisten) f()
    unlisten = []
    for (const id of rawTimers) clearTimeout(id)
    rawTimers.clear(); releaseAll()
    tries++
    run = null
    if (type === 'echo') startEcho()
    else if (type === 'rhythm') startRhythm()
    else if (type === 'ear') startEar()
    else if (type === 'sight') startSight()
    on(document, 'keydown', (e) => { if (run && run.key) run.key(e) }, true)
    root.querySelector('[data-ex="back"]').onclick = () => { api.destroy(); host.back() }
    const t = q('.ex-title'); if (t && !q('[data-ex="go"],[data-ex="acts"] .primary')) t.focus({ preventScroll: true })
  }

  const api = {
    type, item,
    input(pitch, t = now()) { if (alive && run) run.input(pitch, t) },
    get run() { return run },
    get result() { return lastResult },
    restart: start,
    destroy() {
      if (!alive) return
      alive = false; token++
      clearTimers(); stopSound()
      for (const f of unlisten) f()
      unlisten = []
      for (const id of rawTimers) clearTimeout(id)
      rawTimers.clear(); releaseAll()
    }
  }
  start()
  return api
}

/* ============================== the staff for sight reading ============================== */
const TREBLE_SIG = { sharp: [45, 42, 46, 43, 40, 44, 41], flat: [41, 44, 40, 43, 39, 42, 38] }
const BASS_SIG = { sharp: [31, 28, 32, 29, 26, 30, 27], flat: [27, 30, 26, 29, 25, 28, 24] }

/** A line of quarter notes (four to a bar, two bars to a row) on one staff, with the key signature. */
export function sightStaffSvg(line) {
  const gap = 15, W = 760, left = 22, sigW = 15
  const bottom = line.clef === 'treble' ? 37 : 25
  const sigSteps = (line.clef === 'treble' ? TREBLE_SIG : BASS_SIG)[line.key.fifths >= 0 ? 'sharp' : 'flat']
  const nSig = Math.abs(line.key.fifths)
  const headX = left + (line.clef === 'treble' ? 64 : 62) + nSig * sigW + 22
  const barsPerRow = 2
  const rows = Math.ceil(line.bars / barsPerRow)
  const rowH = 4 * gap + 112
  const perBar = line.beatsPerBar
  const barW = (W - headX - 16) / barsPerRow
  let out = ''
  const note = (k, rowTop, col) => {
    const sp = spellPitch(line.notes[k], line.key)
    const y = (s) => rowTop + 4 * gap - (s - bottom) * (gap / 2)
    const cx = headX + col * (barW / perBar) + barW / perBar / 2 + 4
    const cy = y(sp.step)
    let g = ''
    for (let s = bottom - 2; s >= sp.step; s -= 2) g += `<line class="sg-led" x1="${cx - 17}" x2="${cx + 17}" y1="${y(s)}" y2="${y(s)}"/>`
    for (let s = bottom + 10; s <= sp.step; s += 2) g += `<line class="sg-led" x1="${cx - 17}" x2="${cx + 17}" y1="${y(s)}" y2="${y(s)}"/>`
    const up = sp.step < bottom + 4
    g += `<rect class="sg-hl" x="${cx - 24}" y="${rowTop - 30}" width="48" height="${4 * gap + 60}" rx="14"/>`
    g += `<line class="sg-stem" x1="${up ? cx + 9.6 : cx - 9.6}" x2="${up ? cx + 9.6 : cx - 9.6}" y1="${cy}" y2="${up ? cy - 44 : cy + 44}"/>`
    g += `<ellipse class="sg-head" cx="${cx}" cy="${cy}" rx="11.5" ry="8" transform="rotate(-20 ${cx} ${cy})"/>`
    return `<g class="sg-n" data-k="${k}">${g}</g>`
  }
  for (let r = 0; r < rows; r++) {
    const top = r * rowH + 56
    for (let k = 0; k < 5; k++) out += `<line class="sg-line" x1="${left}" x2="${W - 8}" y1="${top + k * gap}" y2="${top + k * gap}"/>`
    out += `<line class="sg-bar" x1="${left}" x2="${left}" y1="${top}" y2="${top + 4 * gap}"/>`
    out += line.clef === 'treble'
      ? `<text class="sg-clef" x="${left + 6}" y="${top + 4 * gap + 10}" font-size="96">𝄞</text>`
      : `<text class="sg-clef" x="${left + 8}" y="${top + 3 * gap + 6}" font-size="66">𝄢</text>`
    for (let i = 0; i < nSig; i++) {
      const sy = top + 4 * gap - (sigSteps[i] - bottom) * (gap / 2)
      out += `<text class="sg-acc" x="${left + (line.clef === 'treble' ? 62 : 60) + i * sigW}" y="${sy + (line.key.fifths > 0 ? 6 : 5)}" font-size="${line.key.fifths > 0 ? 26 : 30}">${line.key.fifths > 0 ? '♯' : '♭'}</text>`
    }
    for (let b = 0; b <= barsPerRow; b++) {
      const bx = headX + b * barW - (b === 0 ? 8 : 0)
      const first = r * barsPerRow * perBar
      if (b > 0 && first + b * perBar - 1 >= line.notes.length) break
      if (b > 0) out += `<line class="sg-bar" x1="${bx}" x2="${bx}" y1="${top}" y2="${top + 4 * gap}"/>`
    }
    for (let c = 0; c < barsPerRow * perBar; c++) {
      const k = r * barsPerRow * perBar + c
      if (k < line.notes.length) out += note(k, top, c)
    }
  }
  const names = line.notes.map((p) => NAMES[pc(p)]).join(' ')
  const svg = `<svg viewBox="0 0 ${W} ${rows * rowH + 26}" role="img" aria-label="A line of ${line.notes.length} quarter notes on the ${line.clef} staff in ${esc(line.key.name)}${line.key.minor ? ' minor' : ''}: ${names}">${out}</svg>`
  return { svg }
}
