// Guided practice: a course for any loaded song. The song is cut into phrases (its own
// bars when the score has them, estimated otherwise), and each phrase climbs a ladder:
// each hand in Wait mode, both hands, then timed at rising speeds. A step is passed by a
// real run of exactly that phrase, hand, mode and speed; the notes that went wrong are
// kept per bar so the weak bars can be drilled.
//
// The app owns the player: beginStep({ from, to, hand, mode, rate }) applies those
// settings and plays. This module owns its dialog, its button in the player bar and its
// lumi.guided.* keys.
import { KEY, HAND_NAME, readPrefs, songKey, buildCourse, stepsFor, stepLabel, evaluateRun, weakBars, spanLabel } from './guided-course.js'
import { el, createGuidedView, paintGuidedSteps } from './guided-view.js'
export { RATES, PASS, readPrefs, songKey, barGrid, barAt, spanLabel, buildCourse, stepsFor, stepLabel, evaluateRun, weakBars } from './guided-course.js'

export function mountGuided({ getPlayer, getSong, store, beginStep, notice = () => {}, hideResults = null, onExit = () => {}, doc = globalThis.document }) {
  let course = null       // for the song below
  let song = null
  let selected = 0        // index into course.sections
  let active = null       // { song, step, sectionKey } while a guided run plays
  let saved = null        // the player's own settings, put back when guided practice ends
  let last = null         // the last run's verdict, shown at the top of the dialog
  let weakBtn = null
  let returnFocus = null

  const { button, root, closeBtn, primary, title, verdict, lead, note, selects, phraseList, stepList, stepHead } = createGuidedView(doc, {
    open, close, start: startCurrent,
    preference: (key, value) => { store.set(KEY + key, key === 'rate' ? Number(value) : value); last = null; render() }
  })

  // The dialog's keys never reach the player behind it; Escape closes it, Tab stays inside.
  root.addEventListener('keydown', (e) => {
    e.stopPropagation()
    if (e.key === 'Escape') { e.preventDefault(); close() }
    else if (e.key === 'Tab') {
      const items = [closeBtn, ...verdict.children, primary, ...Object.values(selects), ...[...phraseList.children].map((li) => li.firstChild)]
        .filter((x) => (x.tagName === 'BUTTON' || x.tagName === 'SELECT') && !x.disabled)
      const i = items.indexOf(doc.activeElement)
      if (e.shiftKey ? i <= 0 : i === items.length - 1) { e.preventDefault(); items[e.shiftKey ? items.length - 1 : 0].focus() }
    }
  })

  const progressKey = () => KEY + 'progress.' + songKey(song)
  const weakKey = () => KEY + 'weak.' + songKey(song)
  const sectionKey = () => KEY + 'section.' + songKey(song)
  const progressOf = (key) => store.get(progressKey(), {})[key] || {}
  const nextIn = (s, prefs) => { const steps = stepsFor(s, prefs); const p = progressOf(s.key); return steps.find((x) => !(p[x.id] && p[x.id].passed)) || null }

  function loadCourse() {
    const p = getPlayer()
    song = getSong()
    const reach = p ? (n) => n.pitch >= p.windowAt(n.start) && n.pitch < p.windowAt(n.start) + p.windowKeys : undefined
    course = song && song.notes && song.notes.length ? buildCourse(song, reach) : null
    if (!course) return
    const prefs = readPrefs(store)
    const want = course.sections.findIndex((s) => s.key === store.get(sectionKey(), null))
    const first = course.sections.findIndex((s) => nextIn(s, prefs))
    selected = want >= 0 && nextIn(course.sections[want], prefs) ? want : first >= 0 ? first : Math.max(0, want)
  }

  // The step the primary button plays: the selected phrase's first step not yet passed,
  // or its last step again once all are passed.
  function current() {
    const s = course && course.sections[selected]
    if (!s) return null
    const prefs = readPrefs(store)
    const steps = stepsFor(s, prefs)
    const step = nextIn(s, prefs) || steps[steps.length - 1]
    return step ? { section: s, step: { ...step, from: s.from, to: s.to }, steps } : null
  }

  function render() {
    const prefs = readPrefs(store)
    for (const k of Object.keys(selects)) selects[k].value = String(prefs[k])
    title.textContent = song ? song.title || 'This song' : 'No song'
    renderVerdict()
    const cur = current()
    const anyProgress = course && course.sections.some((s) => Object.keys(progressOf(s.key)).length)
    const guided = last && !last.drill
    primary.disabled = !cur
    primary.textContent = !cur ? 'Nothing to practise' : !nextIn(cur.section, prefs) ? 'Play it again'
      : guided && last.earned && !last.passed ? 'Try again' : guided && last.passed ? 'Next step' : anyProgress ? 'Continue' : 'Start'
    lead.textContent = !course ? 'Load a song with notes to practise it here.'
      : !cur ? 'None of this song’s notes are on your keys for ' + HAND_NAME[prefs.hand].toLowerCase() + '. Choose other hands below.'
      : cur.section.label + ' · step ' + (cur.steps.findIndex((x) => x.id === cur.step.id) + 1) + ' of ' + cur.steps.length + ': ' + stepLabel(cur.step)
    note.textContent = !course ? '' : course.grid.estimated
      ? 'This song has no written bars, so the phrases are estimated from its tempo.'
      : 'Phrases follow the bars of the score.'
    renderPhrases(prefs)
    paintGuidedSteps(doc, { list: stepList, head: stepHead }, { current: cur, progress: cur ? progressOf(cur.section.key) : {} })
  }

  function renderVerdict() {
    verdict.replaceChildren()
    verdict.classList.toggle('hidden', !last)
    if (!last) return
    const pct = (x) => Math.round(x * 100) + '%'
    const what = last.reason === 'watch' ? 'Watching doesn’t count as a try'
      : last.reason === 'empty' ? 'There were no notes to play in that run'
        : last.reason === 'changed' ? 'The hand, mode or phrase changed during the run, so it doesn’t count'
          : last.passed ? 'Passed' : 'Not yet'
    verdict.appendChild(el(doc, 'h3', 'guided-verdict-head', what))
    if (last.earned) {
      const measure = last.step.mode === 'PRACTISE' ? 'right first time' : 'in time'
      const text = pct(last.accuracy) + ' ' + measure + ' (' + pct(last.need) + ' passes)' +
        (last.slow ? ', but slower than ' + pct(last.step.rate) + ' speed' : '')
      verdict.appendChild(el(doc, 'p', 'guided-verdict-text', stepLabel(last.step) + ': ' + text))
    }
    const drill = drillFor()
    if (drill) {
      const b = el(doc, 'button', 'ghost guided-drill', 'Practice ' + drill.label.toLowerCase())
      b.type = 'button'
      b.addEventListener('click', () => start({ step: drill.step, sectionKey: null, drill: true }))
      verdict.append(el(doc, 'p', 'guided-verdict-text', 'Needs work: ' + drill.label.toLowerCase()), b)
    }
  }

  function renderPhrases(prefs) {
    phraseList.replaceChildren()
    const weak = store.get(weakKey(), {})
    ;(course ? course.sections : []).forEach((s, i) => {
      const steps = stepsFor(s, prefs)
      const p = progressOf(s.key)
      const done = steps.filter((x) => p[x.id] && p[x.id].passed).length
      const row = el(doc, 'li')
      const b = el(doc, 'button', 'guided-phrase')
      b.type = 'button'
      if (i === selected) b.setAttribute('aria-current', 'step')
      b.disabled = !steps.length
      const status = !steps.length ? 'No notes for these hands' : done === steps.length ? 'Done' : done + ' of ' + steps.length + ' steps'
      const sore = s.key === 'all' ? 0 : Object.keys(weak).filter((k) => { const t = course.grid.starts[k]; return t >= s.from - 1e-4 && (s.to == null || t < s.to - 1e-4) }).length
      b.append(el(doc, 'span', 'guided-phrase-name', s.label), el(doc, 'span', 'guided-phrase-status', status + (sore ? ' · ' + sore + (sore === 1 ? ' weak bar' : ' weak bars') : '')))
      b.addEventListener('click', () => { selected = i; store.set(sectionKey(), s.key); last = null; render() })
      row.appendChild(b)
      phraseList.appendChild(row)
    })
  }

  // The weakest bar (with its weak neighbour) as a Wait-mode drill for the hand in use.
  function drillFor() {
    if (!course) return null
    const weak = store.get(weakKey(), {})
    const bars = Object.keys(weak).map(Number).sort((x, y) => weak[y] - weak[x] || x - y)
    if (!bars.length) return null
    const a = bars[0], b = weak[a + 1] ? a + 1 : a
    const starts = course.grid.starts
    const p = getPlayer()
    const step = { hand: p ? p.handFilter : 'both', mode: 'PRACTISE', rate: 1, id: 'drill', from: starts[a], to: starts[b + 1] ?? null }
    return { label: spanLabel(song, course.grid, a, b), step }
  }

  // Remember which bars went wrong: bars this run played clean are cleared.
  function recordWeak(player) {
    if (!course || !player.score) return
    const { covered, weak } = weakBars(player.score.expected, course.grid.starts)
    const kept = store.get(weakKey(), {})
    for (const i of covered) delete kept[i]
    for (const w of weak) kept[w.bar] = w.weak
    store.set(weakKey(), kept)
  }

  function start({ step, sectionKey: key, drill = false }) {
    const p = getPlayer()
    if (!p || !song) return
    if (!saved) saved = { song, mode: p.mode, advancement: p.advancement, hand: p.handFilter, rate: p.rate, from: p.sectionStart || 0, to: p.endAt, loop: { ...p.loop } }
    active = { song, step, sectionKey: key, drill }
    hide()
    beginStep({ from: step.from, to: step.to, hand: step.hand, mode: step.mode, rate: step.rate })
  }

  function startCurrent() {
    const cur = current()
    if (cur) { store.set(sectionKey(), cur.section.key); start({ step: cur.step, sectionKey: cur.section.key }) }
  }

  function show() {
    if (!root.classList.contains('hidden')) return
    returnFocus = doc.activeElement
    root.classList.remove('hidden')
    const app = doc.getElementById('app')
    if (app) app.inert = true
    ;(primary.disabled ? closeBtn : primary).focus()
  }

  function hide() {
    if (root.classList.contains('hidden')) return
    root.classList.add('hidden')
    const app = doc.getElementById('app')
    if (app) app.inert = false
    if (returnFocus && returnFocus.focus) returnFocus.focus()
    returnFocus = null
  }

  // Leaving guided practice puts the player back the way it was before the first step.
  function restore() {
    const p = getPlayer()
    if (saved && p && p.song === saved.song) {
      p.setMode(saved.mode)
      p.setAdvancement(saved.advancement)
      p.setHandFilter(saved.hand)
      p.setRate(saved.rate)
      p.setSection(saved.from, saved.to)
      p.setLoop(saved.loop.a, saved.loop.b, saved.loop.on)
      p.restart(false)
      onExit()
    }
    saved = null
  }

  function clearWeakAction() { if (weakBtn) { weakBtn.remove(); weakBtn = null } }

  function open() {
    getPlayer()?.pause()
    if (getSong() !== song || !course) loadCourse()
    render()
    show()
  }

  function close() {
    hide()
    active = null
    restore()
  }

  function reset() {
    hide()
    clearWeakAction()
    active = null
    saved = null
    last = null
    course = null
    song = null
    button.classList.add('hidden')
  }

  function onSongLoaded() {
    reset()
    loadCourse()
    button.classList.toggle('hidden', !course)
  }

  // A finished run. true: it was a guided step, judged and shown here (the app shows no
  // results of its own); false: an ordinary run, which may add a weak-bars action to the
  // app's results.
  function onFinish(summary) {
    clearWeakAction()
    const p = getPlayer()
    if (active && (active.song !== getSong() || !p || p.song !== active.song)) { active = null; saved = null }
    if (!active) {
      if (p && song === getSong() && course && summary.mode !== 'WATCH' && p.score && p.score.expected.length) {
        recordWeak(p)
        const drill = hideResults && drillFor()
        const host = drill && doc.querySelector('#results .results-actions')
        if (host) {
          weakBtn = el(doc, 'button', 'ghost guided-weak', 'Practice ' + drill.label.toLowerCase())
          weakBtn.type = 'button'
          weakBtn.addEventListener('click', () => { hideResults(); clearWeakAction(); start({ step: drill.step, sectionKey: null, drill: true }) })
          host.insertBefore(weakBtn, host.lastChild)
        }
      }
      return false
    }
    const { step, sectionKey: key, drill } = active
    active = null
    const r = evaluateRun(step, p, summary)
    if (r.earned) recordWeak(p)
    if (r.earned && key) {
      const all = store.get(progressKey(), {})
      const sec = all[key] || (all[key] = {})
      const was = sec[step.id] || { passed: false, best: 0, tries: 0 }
      sec[step.id] = { passed: was.passed || r.passed, best: Math.max(was.best, r.accuracy), tries: was.tries + 1 }
      store.set(progressKey(), all)
      // a finished phrase moves on to the next one with steps left
      const prefs = readPrefs(store)
      if (r.passed && !nextIn(course.sections[selected], prefs)) {
        const nxt = course.sections.findIndex((s) => nextIn(s, prefs))
        if (nxt >= 0) { selected = nxt; store.set(sectionKey(), course.sections[nxt].key) }
      }
    }
    last = { ...r, step, drill }
    notice(r.passed ? stepLabel(step) + ' passed' : r.earned ? 'Not passed yet. Try it again' : 'That run didn’t count')
    render()
    show()
    return true
  }

  function destroy() {
    reset()
    button.remove()
    root.remove()
  }

  return { open, close, reset, onSongLoaded, onFinish, destroy, button, root }
}
