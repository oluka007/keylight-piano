// The Practice hub: a card per activity, and the metronome panel. DOM is built with createElement and
// textContent only. Everything that touches the app is injected through `deps`:
//   deps.activities            the registry list (default: ACTIVITIES)
//   deps.getStats() / deps.setStats(stats)   read and write the practice stats (lumi.practice)
//   deps.launch(activity, level)             start an activity: an exercise at a level, or a screen (level is 0)
//   deps.now()                               ms for stats timestamps (default Date.now)
//   deps.audio: { init(), now(), click(accent, when), cancelClicks() }   the audio clock and the click sound
//   deps.createClock, deps.setTimer, deps.clearTimer, deps.tapNow   (optional) for tests
// mountPractice(root, deps) -> { refresh(), stopMetronome(), metronomeRunning(), metronome(), destroy() }
import { ACTIVITIES, suggestLevel, bestAt, parseStats, recordUse, tempoFromTaps, isExercise } from './registry.js'
import { createClock } from '../jam/clock.js'

const BAR_SIZES = [2, 3, 4, 6]
const pct = (x) => Math.round(x * 100) + '%'

function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue
    if (k === 'class') e.className = v
    else if (k === 'text') e.textContent = v
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v)
    else e.setAttribute(k, v === true ? '' : v)
  }
  for (const kid of kids) if (kid) e.append(kid)
  return e
}

export function mountPractice(root, deps) {
  const activities = deps.activities || ACTIVITIES
  const nowMs = deps.now || (() => Date.now())
  const audio = deps.audio
  const mkClock = deps.createClock || createClock
  const setTimer = deps.setTimer || ((fn, ms) => setTimeout(fn, ms))
  const clearTimer = deps.clearTimer || ((id) => clearTimeout(id))
  const tapNow = deps.tapNow || (() => performance.now())
  const stats = () => parseStats(deps.getStats())
  const picks = new Map()                  // activity id -> its level picker, the best-result line and the Start button

  /* ----- the metronome ----- */
  const metro = { bpm: 80, bpb: 4, accent: true, running: false, beat: -1, clock: null, off: null, timers: new Set(), taps: [] }
  let ui = null                            // the metronome's controls, set by buildMetronome

  function paintBeat() {
    if (!ui) return
    ui.dots.forEach((d, i) => {
      d.classList.toggle('now', metro.running && i === metro.beat)
      d.classList.toggle('first', i === 0)
    })
    ui.beatText.textContent = metro.running && metro.beat >= 0 ? `Beat ${metro.beat + 1} of ${metro.bpb}` : 'Stopped'
  }
  function paintMetro() {
    if (!ui) return
    ui.tempo.value = String(metro.bpm)
    ui.slider.value = String(metro.bpm)
    ui.slider.setAttribute('aria-valuetext', metro.bpm + ' beats per minute')
    for (const b of ui.bars) b.setAttribute('aria-pressed', String(Number(b.dataset.n) === metro.bpb))
    ui.accent.checked = metro.accent
    ui.toggle.textContent = metro.running ? 'Stop' : 'Start'
    ui.toggle.setAttribute('aria-label', metro.running ? 'Stop the metronome' : 'Start the metronome')
    ui.toggle.classList.toggle('primary', !metro.running)
    ui.toggle.classList.toggle('ghost', metro.running)
    ui.panel.classList.toggle('running', metro.running)
    paintBeat()
  }
  function buildDots() {
    ui.dotRow.replaceChildren(...Array.from({ length: metro.bpb }, () => el('span', { class: 'pr-dot' })))
    ui.dots = [...ui.dotRow.children]
  }
  function onWindow({ fromBeat, toBeat, timeOfBeat }) {
    for (let b = Math.ceil(fromBeat - 1e-9); b < toBeat - 1e-9; b++) {
      const when = timeOfBeat(b)
      const inBar = ((b % metro.bpb) + metro.bpb) % metro.bpb
      audio.click(metro.accent && inBar === 0, when)
      const id = setTimer(() => { metro.timers.delete(id); metro.beat = inBar; paintBeat() }, Math.max(0, (when - audio.now()) * 1000))
      metro.timers.add(id)
    }
  }
  function startMetro() {
    if (metro.running) return
    audio.init()
    metro.clock = mkClock({ now: () => audio.now(), bpm: metro.bpm, beatsPerBar: metro.bpb })
    metro.off = metro.clock.onWindow(onWindow)
    metro.clock.start()
    metro.running = true
    metro.beat = -1
    deps.setStats(recordUse(stats(), 'metronome', nowMs()))
    paintMetro()
  }
  function stopMetro() {
    if (!metro.running && !metro.clock) return
    if (metro.off) metro.off()
    if (metro.clock) metro.clock.stop()
    metro.off = null; metro.clock = null
    for (const id of metro.timers) clearTimer(id)
    metro.timers.clear()
    try { audio.cancelClicks() } catch { /* no audio yet */ }
    metro.running = false
    metro.beat = -1
    paintMetro()
  }
  function setTempo(v) {
    const n = Math.min(220, Math.max(40, Math.round(Number(v)) || metro.bpm))
    metro.bpm = n
    if (metro.clock) metro.clock.setBpm(n)
    paintMetro()
  }
  function setBar(n) {
    if (!BAR_SIZES.includes(n) || n === metro.bpb) return
    const was = metro.running
    stopMetro()
    metro.bpb = n
    buildDots()
    paintMetro()
    if (was) startMetro()
  }
  function tap() {
    const t = tapNow()
    metro.taps = metro.taps.filter((x) => t - x <= 2000)
    metro.taps.push(t)
    const bpm = tempoFromTaps(metro.taps)
    if (bpm) setTempo(bpm)
  }

  function buildMetronome(activity) {
    const tempo = el('input', { type: 'number', id: 'prTempo', min: 40, max: 220, step: 1, inputmode: 'numeric', class: 'pr-num' })
    const slider = el('input', { type: 'range', min: 40, max: 220, step: 1, class: 'pr-slider', 'aria-label': 'Tempo slider, 40 to 220 beats per minute' })
    const bars = BAR_SIZES.map((n) => el('button', { type: 'button', class: 'pr-seg', 'data-n': n, 'aria-pressed': 'false', 'aria-label': `${n} beats per bar`, text: String(n), onclick: () => setBar(n) }))
    const accent = el('input', { type: 'checkbox', id: 'prAccent', checked: true })
    const toggle = el('button', { type: 'button', class: 'primary pr-start', onclick: () => (metro.running ? stopMetro() : startMetro()), text: 'Start' })
    const dotRow = el('div', { class: 'pr-dots', 'aria-hidden': 'true' })
    const beatText = el('span', { class: 'pr-beattext', text: 'Stopped' })
    const panel = el('div', { class: 'pr-metro', role: 'group', 'aria-label': 'Metronome controls' },
      el('div', { class: 'pr-row' },
        el('label', { for: 'prTempo', class: 'pr-lab', text: 'Tempo (beats per minute)' }), tempo,
        el('button', { type: 'button', class: 'ghost pr-tap', text: 'Tap tempo', 'aria-label': 'Tap tempo: tap along with the beat', onclick: tap })),
      slider,
      el('div', { class: 'pr-row' }, el('span', { class: 'pr-lab', id: 'prBarsLab', text: 'Beats per bar' }), el('div', { class: 'pr-segs', role: 'group', 'aria-labelledby': 'prBarsLab' }, ...bars)),
      el('label', { class: 'pr-check' }, accent, el('span', { text: 'Accent on beat one' })),
      el('div', { class: 'pr-row pr-beatrow' }, dotRow, beatText),
      el('div', { class: 'pr-acts' }, toggle))
    tempo.addEventListener('change', () => setTempo(tempo.value))
    slider.addEventListener('input', () => setTempo(slider.value))
    accent.addEventListener('change', () => { metro.accent = accent.checked })
    ui = { panel, tempo, slider, bars, accent, toggle, dotRow, beatText, dots: [] }
    buildDots()
    paintMetro()
    return panel
  }

  /* ----- the hub ----- */
  function bestLine(a, level) {
    const best = bestAt(stats(), a.id, level)
    return best === null ? 'Not played at this level yet' : `Best at this level: ${pct(best)}`
  }
  function card(a) {
    const head = [el('h3', { class: 'pr-title', text: a.title }), el('p', { class: 'pr-blurb', text: a.blurb })]
    if (a.panel === 'metronome') return el('article', { class: 'pr-card pr-wide', 'data-id': a.id }, ...head, buildMetronome(a))
    if (!isExercise(a)) {
      const go = el('button', { type: 'button', class: 'primary', 'data-act': 'start', 'aria-label': `Open ${a.title}`, text: 'Open', onclick: () => launch(a, 0) })
      return el('article', { class: 'pr-card', 'data-id': a.id }, ...head, el('div', { class: 'pr-acts' }, go))
    }
    const selId = `prLevel-${a.id}`
    const select = el('select', { id: selId, class: 'pr-select', 'data-act': 'level' })
    for (let l = 1; l <= a.levels; l++) select.append(el('option', { value: String(l), text: `Level ${l}` }))
    const best = el('p', { class: 'pr-best' })
    const go = el('button', { type: 'button', class: 'primary', 'data-act': 'start', 'aria-label': `Start ${a.title}`, text: 'Start', onclick: () => launch(a, Number(select.value)) })
    select.addEventListener('change', () => { best.textContent = bestLine(a, Number(select.value)) })
    picks.set(a.id, { select, best, activity: a })
    return el('article', { class: 'pr-card', 'data-id': a.id }, ...head,
      el('div', { class: 'pr-pick' }, el('label', { for: selId, class: 'pr-lab', text: 'Level' }), select), best,
      el('div', { class: 'pr-acts' }, go))
  }
  const launch = (a, level) => deps.launch(a, level)

  /** Repaint the suggested levels and best results from the stored stats (the metronome keeps running and keeps its settings). */
  function refresh() {
    const s = stats()
    for (const [id, p] of picks) {
      const suggested = suggestLevel(s, id)
      for (const o of p.select.options) o.textContent = Number(o.value) === suggested ? `Level ${o.value} (suggested)` : `Level ${o.value}`
      p.select.value = String(suggested)
      p.best.textContent = bestLine(p.activity, suggested)
    }
  }

  const grid = el('div', { class: 'pr-grid' }, ...activities.map(card))
  root.replaceChildren(el('div', { class: 'pr-page' },
    el('p', { class: 'pr-lead', text: 'Pick something and start. Practice never changes your course progress, and every minute counts toward today’s goal.' }),
    grid))
  refresh()

  return {
    refresh,
    stopMetronome: stopMetro,
    metronomeRunning: () => metro.running,
    metronome: () => ({ running: metro.running, bpm: metro.bpm, beatsPerBar: metro.bpb, accent: metro.accent, beat: metro.beat }),
    destroy() { stopMetro(); root.replaceChildren() }
  }
}
