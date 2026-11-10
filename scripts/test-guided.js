// Unit test for guided practice (renderer/guided.js): node scripts/test-guided.js
// Drives the real Player and scoring on a fake audio clock (no sound, no keyboard), and
// mounts the dialog into a small DOM stand-in that only has what guided.js touches.
const assert = require('node:assert/strict')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { readFileSync } = require('node:fs')
const { runInNewContext } = require('node:vm')

const load = (f) => import(pathToFileURL(path.join(__dirname, '..', 'renderer', f)).href)

// ---------- a small DOM ----------
class Node {
  constructor(doc, tag) { this.ownerDocument = doc; this.tagName = tag.toUpperCase(); this.children = []; this.parentNode = null; this.listeners = {}; this.attrs = {}; this.className = ''; this.id = ''; this._text = ''; this.disabled = false }
  get classList() {
    const set = () => new Set(this.className.split(/\s+/).filter(Boolean))
    const save = (s) => { this.className = [...s].join(' ') }
    return {
      add: (c) => { const s = set(); s.add(c); save(s) },
      remove: (c) => { const s = set(); s.delete(c); save(s) },
      contains: (c) => set().has(c),
      toggle: (c, on) => { const s = set(); const want = on === undefined ? !s.has(c) : !!on; want ? s.add(c) : s.delete(c); save(s); return want }
    }
  }
  appendChild(c) { if (c.parentNode) c.remove(); c.parentNode = this; this.children.push(c); return c }
  append(...cs) { for (const c of cs) this.appendChild(c) }
  insertBefore(c, ref) { if (c.parentNode) c.remove(); c.parentNode = this; const i = this.children.indexOf(ref); this.children.splice(i < 0 ? this.children.length : i, 0, c); return c }
  replaceChildren(...cs) { for (const c of this.children) c.parentNode = null; this.children = []; this.append(...cs) }
  remove() { if (this.parentNode) { const p = this.parentNode; p.children = p.children.filter((x) => x !== this); this.parentNode = null } }
  get firstChild() { return this.children[0] || null }
  get lastChild() { return this.children[this.children.length - 1] || null }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join('') }
  set textContent(v) { this.replaceChildren(); this._text = String(v) }
  setAttribute(k, v) { this.attrs[k] = String(v) }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn) }
  dispatchEvent(e) {
    e.target ||= this
    e.stopped = false
    e.stopPropagation = () => { e.stopped = true }
    e.preventDefault = () => { e.defaultPrevented = true }
    // bubbles up the tree, then to the document's own listeners
    for (let n = this; n && !e.stopped; n = n.parentNode) for (const fn of n.listeners[e.type] || []) fn(e)
    if (!e.stopped) for (const fn of this.ownerDocument.listeners[e.type] || []) fn(e)
    return e
  }
  click() { if (!this.disabled) this.dispatchEvent({ type: 'click' }) }
  focus() { this.ownerDocument.activeElement = this }
  contains(n) { for (; n; n = n.parentNode) if (n === this) return true; return false }
  matches(sel) { return sel.startsWith('#') ? this.id === sel.slice(1) : sel.startsWith('.') ? this.classList.contains(sel.slice(1)) : this.tagName === sel.toUpperCase() }
  all() { return this.children.flatMap((c) => [c, ...c.all()]) }
  querySelector(sel) {
    const parts = sel.split(/\s+/)
    return this.all().find((n) => { let i = parts.length - 1; if (!n.matches(parts[i])) return false; for (let a = n.parentNode; a && i > 0; a = a.parentNode) if (a.matches && a.matches(parts[i - 1])) i--; return i === 0 }) || null
  }
}
function makeDocument() {
  const doc = { listeners: {}, activeElement: null }
  doc.createElement = (tag) => new Node(doc, tag)
  doc.body = new Node(doc, 'body')
  doc.addEventListener = (t, fn) => { (doc.listeners[t] ||= []).push(fn) }
  doc.querySelector = (s) => doc.body.querySelector(s)
  doc.getElementById = (id) => doc.body.all().find((n) => n.id === id) || null
  const app = doc.createElement('div'); app.id = 'app'
  const bar = doc.createElement('div'); bar.className = 'player-bottom'
  app.appendChild(bar)
  const results = doc.createElement('div'); results.id = 'results'
  const actions = doc.createElement('div'); actions.className = 'results-actions'
  const close = doc.createElement('button'); close.id = 'resClose'
  actions.appendChild(close); results.appendChild(actions)
  doc.body.append(app, results)
  return doc
}
const memoryStore = () => {
  const m = new Map()
  return { map: m, get: (k, d) => (m.has(k) ? JSON.parse(m.get(k)) : d), set: (k, v) => m.set(k, JSON.stringify(v)) }
}
const byClass = (root, c) => root.all().filter((n) => n.classList.contains(c))
const text = (root, c) => byClass(root, c).map((n) => n.textContent)

// ---------- songs ----------
// 8 bars of 4/4 at 120 (2 s a bar): right hand a quarter-note melody, left hand a note per bar.
function eightBars(normalise, { bars = true, title = 'Test song' } = {}) {
  const notes = []
  for (let b = 0; b < 8; b++) {
    for (let q = 0; q < 4; q++) notes.push({ pitch: 64 + q, start: b * 2 + q * 0.5, dur: 0.4, hand: 'right' })
    notes.push({ pitch: 52, start: b * 2, dur: 1.8, hand: 'left' })
  }
  const parsed = { title, notes, tempo: 120, timeSignature: { beats: 4, beatType: 4 }, duration: 16 }
  if (bars) parsed.bars = Array.from({ length: 8 }, (_, i) => i * 2)
  return normalise(title, parsed)
}

// ---------- a player on a fake clock ----------
function rig(G, Player, song, opts = {}) {
  const doc = makeDocument()
  const store = opts.store || memoryStore()
  const ctx = { currentTime: 0, outputLatency: 0, baseLatency: 0 }
  const h = { doc, store, ctx, begun: [], notices: [], finished: [], hidden: 0, exits: 0, song }
  h.player = new Player({ getCtx: () => ctx, onFinish: (s) => h.finished.push(guided.onFinish(s)) })
  h.player.windowKeys = 49
  h.player.load(song)
  const guided = G.mountGuided({
    getPlayer: () => h.player,
    getSong: () => h.song,
    store,
    doc,
    notice: (m) => h.notices.push(m),
    hideResults: () => { h.hidden++ },
    onExit: () => { h.exits++ },
    // what the app's beginStep does: apply the step to the player, then play
    beginStep: (s) => {
      h.begun.push(s)
      const p = h.player
      p.setSection(s.from, s.to); p.setHandFilter(s.hand); p.setMode(s.mode); p.setRate(s.rate)
      p.restart(false); p.play()
    }
  })
  h.guided = guided
  guided.onSongLoaded()
  return h
}

// Play until the player finishes. Wait mode: press each awaited key (after a wrong key
// when `fumble` says so). Timed: press notes on time when `hit` says so.
function perform(h, { hit = () => true, fumble = () => false, onFrame = () => {} } = {}) {
  const p = h.player
  let last = p.currentPosition() - 1e-3
  for (let i = 0; i < 20000 && !p.finished; i++) {
    p.tick()
    if (p.waiting) {
      const group = p.snapshot().waitNotes
      if (group.some(fumble)) p.noteOn(30)
      for (const pitch of [...p.needPitches]) p.noteOn(pitch)
      continue
    }
    const pos = p.currentPosition()
    if (p.mode === 'PLAY') for (const n of p.playableNotes()) if (n.start > last && n.start <= pos && hit(n)) p.noteOn(n.pitch)
    last = pos
    onFrame(pos)
    h.ctx.currentTime += 0.005
  }
  assert.ok(p.finished, 'the run finished')
}

const tests = []
const test = (name, fn) => tests.push({ name, fn })

;(async () => {
  const G = await load('guided.js')
  const { Player } = await load('player.js')
  const { normalise } = await load('songloader.js')

  test('a score with bars is cut into four-bar phrases plus the whole song', () => {
    const c = G.buildCourse(eightBars(normalise))
    assert.equal(c.grid.estimated, false)
    assert.deepEqual(c.sections.map((s) => [s.label, s.from, s.to]), [['Bars 1–4', 0, 8], ['Bars 5–8', 8, null], ['Whole song', 0, null]])
    assert.deepEqual(c.sections[0].counts, { left: 4, right: 16 })
  })

  test('a MIDI song without bars says its phrases are estimated; a recording uses clock times', () => {
    const midi = eightBars(normalise, { bars: false })
    assert.equal(G.buildCourse(midi).grid.estimated, true)
    assert.equal(G.buildCourse(midi).sections[0].label, 'About bars 1–4')
    const audio = { ...midi, source: 'audio' }
    assert.equal(G.buildCourse(audio).sections[0].label, '0:00–0:08')
  })

  test('phrases with no notes on the keys are left out', () => {
    const c = G.buildCourse(eightBars(normalise), (n) => n.start >= 8)
    assert.deepEqual(c.sections.map((s) => s.label), ['Bars 5–8'])
  })

  test('the ladder: each hand waits, both hands, then rising speeds; settings shape it', () => {
    const s = G.buildCourse(eightBars(normalise)).sections[0]
    assert.deepEqual(G.stepsFor(s, { mode: 'wait', hand: 'both', rate: 1 }).map(G.stepLabel), [
      'Right hand · Wait mode', 'Left hand · Wait mode', 'Both hands · Wait mode',
      'Both hands · 60% speed', 'Both hands · 80% speed', 'Both hands · 100% speed'])
    assert.deepEqual(G.stepsFor(s, { mode: 'timed', hand: 'left', rate: 0.8 }).map((x) => x.id), ['left.PLAY.60', 'left.PLAY.80'])
    const rightOnly = { ...s, counts: { left: 0, right: 16 } }
    assert.deepEqual(G.stepsFor(rightOnly, { mode: 'wait', hand: 'both', rate: 1 }).map((x) => x.hand), ['right', 'right', 'right', 'right'])
    assert.deepEqual(G.stepsFor(rightOnly, { mode: 'wait', hand: 'left', rate: 1 }), [])
  })

  test('stored settings are parsed; unknown values fall back', () => {
    const store = memoryStore()
    store.set('lumi.guided.hand', 'feet'); store.set('lumi.guided.rate', 7); store.set('lumi.guided.mode', 'timed')
    assert.deepEqual(G.readPrefs(store), { mode: 'timed', hand: 'both', rate: 1 })
  })

  test('a clean Wait-mode run passes the step, is consumed and the next step follows', () => {
    const h = rig(G, Player, eightBars(normalise))
    h.guided.open()
    const primary = byClass(h.doc.body, 'guided-primary')[0]
    assert.equal(primary.textContent, 'Start')
    primary.click()
    assert.deepEqual(h.begun[0], { from: 0, to: 8, hand: 'right', mode: 'PRACTISE', rate: 1 })
    assert.ok(h.guided.root.classList.contains('hidden'), 'the dialog steps aside while you play')
    perform(h)
    assert.deepEqual(h.finished, [true])
    assert.equal(h.player.score.expected.length, 16, 'only the right hand in bars 1-4 was scored')
    const progress = h.store.get('lumi.guided.progress.' + h.song.title)
    assert.equal(progress['1-4']['right.PRACTISE.100'].passed, true)
    assert.ok(!h.guided.root.classList.contains('hidden'))
    assert.deepEqual(text(h.doc.body, 'guided-verdict-head'), ['Passed'])
    assert.equal(primary.textContent, 'Next step')
    primary.click()
    assert.equal(h.begun[1].hand, 'left')
  })

  test('a failed step does not advance', () => {
    const h = rig(G, Player, eightBars(normalise))
    h.guided.open()
    byClass(h.doc.body, 'guided-primary')[0].click()
    perform(h, { fumble: () => true })        // a wrong key before every group: all hinted
    assert.deepEqual(h.finished, [true])
    const step = h.store.get('lumi.guided.progress.' + h.song.title)['1-4']['right.PRACTISE.100']
    assert.deepEqual({ passed: step.passed, tries: step.tries }, { passed: false, tries: 1 })
    const primary = byClass(h.doc.body, 'guided-primary')[0]
    assert.equal(primary.textContent, 'Try again')
    primary.click()
    assert.deepEqual(h.begun[1], h.begun[0])
  })

  test('a timed step is judged in time and at its speed', () => {
    const store = memoryStore()
    store.set('lumi.guided.mode', 'timed'); store.set('lumi.guided.hand', 'right')
    const h = rig(G, Player, eightBars(normalise), { store })
    h.guided.open()
    byClass(h.doc.body, 'guided-primary')[0].click()
    assert.deepEqual(h.begun[0], { from: 0, to: 8, hand: 'right', mode: 'PLAY', rate: 0.6 })
    perform(h)
    assert.equal(store.get('lumi.guided.progress.' + h.song.title)['1-4']['right.PLAY.60'].passed, true)
    // the next step at 80%, slowed to 60% by hand during the run: played well, not passed
    byClass(h.doc.body, 'guided-primary')[0].click()
    h.player.setRate(0.6)
    perform(h)
    const r = store.get('lumi.guided.progress.' + h.song.title)['1-4']['right.PLAY.80']
    assert.equal(r.passed, false)
    assert.match(text(h.doc.body, 'guided-verdict-text')[0], /slower than 80% speed/)
  })

  test('accelerating during trailing rest cannot pass a slow timed attempt', () => {
    const store = memoryStore()
    store.set('lumi.guided.mode', 'timed'); store.set('lumi.guided.hand', 'right')
    const h = rig(G, Player, eightBars(normalise), { store })
    h.guided.open()
    byClass(h.doc.body, 'guided-primary')[0].click()
    h.player.setRate(0.5)
    perform(h, { onFrame: (pos) => { if (pos >= 7.9 && h.player.rate < 1) h.player.setRate(1) } })
    const result = store.get('lumi.guided.progress.' + h.song.title)['1-4']['right.PLAY.60']
    assert.equal(result.best, 1, 'all notes were played accurately')
    assert.equal(h.player.rate, 1, 'the run finished at full speed')
    assert.equal(result.passed, false, 'earlier slow playback still disqualifies the run')
  })

  for (const reset of ['restart', 'new step', 'new song', 'paused setup']) {
    test('a valid timed run passes after ' + reset + ' clears unrelated slow speed', () => {
      const store = memoryStore()
      store.set('lumi.guided.mode', 'timed'); store.set('lumi.guided.hand', 'right')
      const h = rig(G, Player, eightBars(normalise), { store })
      const p = h.player
      p.setRate(0.5)
      if (reset !== 'paused setup') { p.play(); h.ctx.currentTime += 0.2; p.pause() }
      if (reset === 'new song') p.load(h.song)
      h.guided.open()
      byClass(h.doc.body, 'guided-primary')[0].click()
      if (reset === 'restart') {
        p.setRate(0.5); h.ctx.currentTime += 0.2; p.pause()
        p.restart(false); p.setRate(0.6); p.play()
      }
      if (reset === 'paused setup') {
        p.pause(); p.setRate(0.5); p.setRate(0.6); p.play()
      }
      perform(h)
      assert.equal(store.get('lumi.guided.progress.' + h.song.title)['1-4']['right.PLAY.60'].passed, true)
      byClass(h.doc.body, 'guided-primary')[0].click()
      perform(h)
      assert.equal(store.get('lumi.guided.progress.' + h.song.title)['1-4']['right.PLAY.80'].passed, true, 'the next faster step starts fresh')
    })
  }

  test('production progress reset removes guided history and keeps preferences; cancellation keeps history', async () => {
    const source = readFileSync(path.join(__dirname, '..', 'renderer', 'app.js'), 'utf8')
    const start = source.indexOf('  const PROGRESS_KEY =')
    const end = source.indexOf("  if ($('resetSettings'))", start)
    assert.ok(start >= 0 && end > start, 'production reset registration is present')
    for (const accept of [false, true]) {
      const store = memoryStore()
      store.set('lumi.guided.mode', 'timed'); store.set('lumi.guided.hand', 'right'); store.set('lumi.guided.rate', 0.8)
      const h = rig(G, Player, eightBars(normalise), { store })
      h.guided.open(); byClass(h.doc.body, 'guided-primary')[0].click()
      perform(h, { hit: (n) => n.start >= 1 })
      const localStorage = Object.fromEntries(store.map)
      localStorage['lumi.best.song'] = '3'
      localStorage['lumi.settings'] = '{"volume":80}'
      localStorage['lumi.favourites'] = '["song"]'
      localStorage['lumi.guided.progression'] = 'unrelated'
      Object.defineProperty(localStorage, 'removeItem', { value: (key) => { delete localStorage[key] } })
      const before = { ...localStorage }
      const button = {}
      let reloads = 0
      runInNewContext(source.slice(start, end), {
        $: () => button, localStorage, askConfirm: async () => accept, THIS_COMPUTER: 'this computer', location: { reload: () => reloads++ }
      })
      await button.onclick()
      const expected = { ...before }
      if (accept) {
        delete expected['lumi.best.song']
        delete expected['lumi.guided.progress.' + h.song.title]
        delete expected['lumi.guided.weak.' + h.song.title]
        delete expected['lumi.guided.section.' + h.song.title]
      }
      assert.deepEqual({ ...localStorage }, expected)
      assert.equal(reloads, accept ? 1 : 0)
    }
  })

  test('watching and runs with no notes earn nothing', () => {
    const h = rig(G, Player, eightBars(normalise))
    h.guided.open()
    byClass(h.doc.body, 'guided-primary')[0].click()
    h.player.setMode('WATCH'); h.player.play()
    perform(h)
    assert.deepEqual(h.finished, [true])
    assert.equal(h.store.get('lumi.guided.progress.' + h.song.title, null), null)
    assert.deepEqual(text(h.doc.body, 'guided-verdict-head'), ['Watching doesn’t count as a try'])
    // a section of rests: nothing to score
    const p = h.player
    p.setMode('PRACTISE'); p.setSection(20, 30)
    const step = { hand: 'both', mode: 'PRACTISE', rate: 1, from: 20, to: 30 }
    assert.deepEqual(G.evaluateRun(step, p, { mode: 'PRACTISE', firstTime: 1 }), { earned: false, passed: false, reason: 'empty' })
  })

  test('an ordinary run returns false and offers the weak bars in the results', () => {
    const h = rig(G, Player, eightBars(normalise))
    h.player.setMode('PLAY')
    h.player.play()
    perform(h, { hit: (n) => !(n.start >= 10 && n.start < 12) })    // bar 6 missed
    assert.deepEqual(h.finished, [false])
    assert.deepEqual(h.store.get('lumi.guided.weak.' + h.song.title), { 5: 5 })
    const btn = byClass(h.doc.body, 'guided-weak')[0]
    assert.equal(btn.textContent, 'Practice bar 6')
    assert.equal(btn.parentNode.lastChild.id, 'resClose', 'Close stays last')
    btn.click()
    assert.equal(h.hidden, 1)
    assert.deepEqual(h.begun[0], { from: 10, to: 12, hand: 'both', mode: 'PRACTISE', rate: 1 })
    assert.equal(byClass(h.doc.body, 'guided-weak').length, 0)
    perform(h)
    assert.deepEqual(h.finished, [false, true])
    assert.deepEqual(h.store.get('lumi.guided.weak.' + h.song.title), {}, 'a clean drill clears the bar')
    assert.equal(h.store.get('lumi.guided.progress.' + h.song.title, null), null, 'a drill is not a course step')
  })

  test('closing after a step puts the player back; Escape closes and keys stay in the dialog', () => {
    const h = rig(G, Player, eightBars(normalise))
    h.player.setRate(0.9)
    let leaked = 0
    h.doc.addEventListener('keydown', () => leaked++)
    h.guided.open()
    byClass(h.doc.body, 'guided-primary')[0].click()
    perform(h)
    assert.equal(h.doc.getElementById('app').inert, true)
    h.guided.root.dispatchEvent({ type: 'keydown', key: ' ' })
    assert.equal(leaked, 0)
    h.guided.root.dispatchEvent({ type: 'keydown', key: 'Escape' })
    assert.ok(h.guided.root.classList.contains('hidden'))
    assert.equal(h.doc.getElementById('app').inert, false)
    const p = h.player
    assert.deepEqual([p.mode, p.handFilter, p.rate, p.sectionStart, p.endAt, h.exits], ['PLAY', 'both', 0.9, 0, null, 1])
  })

  test('opening guided practice pauses an ordinary run', () => {
    const h = rig(G, Player, eightBars(normalise))
    h.player.play()
    h.guided.open()
    assert.equal(h.player.active, false)
  })

  test('closing a reopened active step ends guided practice and restores the original loop', () => {
    const h = rig(G, Player, eightBars(normalise))
    h.player.setLoop(2, 4, true)
    h.guided.open()
    byClass(h.doc.body, 'guided-primary')[0].click()
    h.player.setLoop(null, null, false)
    h.guided.open()
    h.guided.close()
    assert.deepEqual(h.player.loop, { a: 2, b: 4, on: true })
    assert.equal(h.player.mode, 'PLAY')
  })

  test('a different song drops the running step, keeps progress per song and settings apart', () => {
    const h = rig(G, Player, eightBars(normalise))
    h.guided.open()
    byClass(h.doc.body, 'guided-primary')[0].click()
    // the app loads another song mid-step
    h.song = eightBars(normalise, { title: 'Other' })
    h.player = new Player({ getCtx: () => h.ctx, onFinish: (s) => h.finished.push(h.guided.onFinish(s)) })
    h.player.windowKeys = 49
    h.player.load(h.song)
    h.guided.onSongLoaded()
    h.player.setMode('PRACTISE'); h.player.play()
    perform(h)
    assert.deepEqual(h.finished, [false], 'the old step does not claim the new song')
    assert.equal(h.store.get('lumi.guided.progress.Other', null), null)
    h.guided.open()
    const hand = h.guided.root.all().find((n) => n.tagName === 'SELECT')
    hand.value = 'left'; hand.dispatchEvent({ type: 'change' })
    assert.equal(h.store.get('lumi.guided.hand'), 'left')
    assert.equal(h.store.get('lumi.settings', null), null)
    assert.match(byClass(h.doc.body, 'guided-lead')[0].textContent, /Left hand · Wait mode/)
  })

  test('song text is shown as text, and destroy removes everything it added', () => {
    const h = rig(G, Player, eightBars(normalise, { title: '<img src=x onerror=alert(1)>' }))
    h.guided.open()
    assert.equal(byClass(h.doc.body, 'guided-title')[0].textContent, '<img src=x onerror=alert(1)>')
    h.guided.destroy()
    assert.equal(byClass(h.doc.body, 'guided').length + byClass(h.doc.body, 'guided-btn').length, 0)
  })

  let failed = 0
  for (const t of tests) {
    try { await t.fn(); console.log('ok   ' + t.name) } catch (e) { failed++; console.log('FAIL ' + t.name + '\n     ' + (e && e.stack || e)) }
  }
  console.log(`${tests.length - failed}/${tests.length} passed`)
  process.exit(failed ? 1 : 0)
})()
