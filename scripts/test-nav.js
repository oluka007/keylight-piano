// Unit test for the navigation stack (renderer/nav.js): node scripts/test-nav.js
// Pure logic, no window. Each case is a list of moves and what is expected after each.
const assert = require('node:assert/strict')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const load = (f) => import(pathToFileURL(path.join(__dirname, '..', 'renderer', f)).href)

;(async () => {
  const { createNav } = await load('nav.js')

  function make(opts = {}) {
    const shown = []
    const closed = []
    const screens = {
      play: { transient: true },
      quiz: { transient: true },
      exercise: { transient: true },
      course: { handleBack: () => (opts.courseInner ? opts.courseInner() : false) },
      search: { save: (e) => { e.params = { text: 'abc' }; e.scroll = 120 } },
      ...(opts.screens || {})
    }
    const nav = createNav({ screens, onShow: (e, o) => shown.push(`${e.screen}${o.back ? '<' : '>'}`), max: opts.max || 20, initial: 'home' })
    return { nav, shown, closed }
  }

  // [move, expected screen after it, expected depth]
  const cases = {
    'back from Settings lands on Home': [['go settings', 'settings', 2], ['back', 'home', 1]],
    'back from Search lands on the page before it': [['go search', 'search', 2], ['go settings', 'settings', 3], ['back', 'search', 2], ['back', 'home', 1]],
    'a song is never gone back to': [['go play', 'play', 2], ['back', 'home', 1], ['back!', 'home', 1]],
    'song launched from Search returns to Search': [['go search', 'search', 2], ['go play', 'play', 3], ['back', 'search', 2]],
    'a song replaced by the next one is still one entry': [['go play', 'play', 2], ['go play', 'play', 2], ['back', 'home', 1]],
    'quiz and exercise drop out when left': [['go course', 'course', 2], ['go quiz', 'quiz', 3], ['go exercise', 'exercise', 3], ['back', 'course', 2]],
    'going to the page below a transient one just returns to it': [['go course', 'course', 2], ['go play', 'play', 3], ['go course', 'course', 2]],
    'going to the screen already on show replaces it': [['go settings', 'settings', 2], ['go settings', 'settings', 2], ['back', 'home', 1]],
    'replace swaps the top entry': [['go search', 'search', 2], ['replace games', 'games', 2], ['back', 'home', 1]],
    'resetTo starts a fresh stack': [['go search', 'search', 2], ['go settings', 'settings', 3], ['reset course', 'course', 1]],
    'back on a lone non-root screen goes to the root': [['reset settings', 'settings', 1], ['back', 'home', 1]],
    'back on the root with nothing before it is not handled': [['back!', 'home', 1]]
  }
  for (const [name, moves] of Object.entries(cases)) {
    const { nav } = make()
    for (const [move, screen, depth] of moves) {
      const [op, arg] = move.split(' ')
      if (op === 'go') nav.go(arg)
      else if (op === 'replace') nav.replace(arg)
      else if (op === 'reset') nav.resetTo(arg)
      else if (op === 'back') assert.equal(nav.back(), true, `${name}: ${move} handled`)
      else if (op === 'back!') assert.equal(nav.back(), false, `${name}: ${move} not handled`)
      assert.equal(nav.current().screen, screen, `${name}: after "${move}" the screen`)
      assert.equal(nav.depth(), depth, `${name}: after "${move}" the depth`)
    }
  }

  // onShow is told whether it is a return
  {
    const { nav, shown } = make()
    nav.go('search'); nav.go('settings'); nav.back()
    assert.deepEqual(shown, ['search>', 'settings>', 'search<'])
  }

  // the page being left saves its state, and back hands it to onShow
  {
    const seen = []
    const nav = createNav({ screens: { search: { save: (e) => { e.params = { text: 'abc', chip: 'fav' }; e.scroll = 120 } } }, onShow: (e, o) => seen.push([e.screen, o.back, e.scroll, e.params]), initial: 'home' })
    nav.go('search'); nav.go('settings'); nav.back()
    assert.deepEqual(seen[2], ['search', true, 120, { text: 'abc', chip: 'fav' }])
    assert.deepEqual(nav.current().params, { text: 'abc', chip: 'fav' })
  }

  // a transient screen does not save, and leaving forward from it needs no save call
  {
    let saved = 0
    const nav = createNav({ screens: { play: { transient: true, save: () => { saved++ } } }, onShow() {}, initial: 'home' })
    nav.go('play'); nav.go('settings')
    assert.equal(saved, 0)
  }

  // a screen can take a back press itself (the course's inner pages)
  {
    let inner = 2
    const { nav } = make({ courseInner: () => { if (inner > 0) { inner--; return true } return false } })
    nav.go('course')
    assert.equal(nav.back(), true); assert.equal(nav.current().screen, 'course')
    assert.equal(nav.back(), true); assert.equal(nav.current().screen, 'course')
    assert.equal(nav.back(), true); assert.equal(nav.current().screen, 'home')
    assert.equal(inner, 0)
  }

  // overlays close first, top one first, and can be removed again
  {
    const { nav } = make()
    const log = []
    nav.go('settings')
    const removeA = nav.pushOverlay(() => log.push('a'))
    nav.pushOverlay(() => log.push('b'))
    assert.equal(nav.canGoBack(), true)
    assert.equal(nav.back(), true); assert.deepEqual(log, ['b']); assert.equal(nav.current().screen, 'settings')
    removeA(); removeA()
    assert.equal(nav.back(), true); assert.deepEqual(log, ['b']); assert.equal(nav.current().screen, 'home')
    assert.equal(nav.canGoBack(), false)
  }

  // the stack is capped, dropping the oldest entries
  {
    const { nav } = make({ max: 4 })
    for (const s of ['a', 'b', 'c', 'd', 'e', 'f']) nav.go(s)
    assert.equal(nav.depth(), 4)
    for (const s of ['e', 'd', 'c']) { nav.back(); assert.equal(nav.current().screen, s) }
    assert.equal(nav.back(), true); assert.equal(nav.current().screen, 'home')
  }

  // an empty nav takes its first move without a back
  {
    const shown = []
    const nav = createNav({ onShow: (e) => shown.push(e.screen) })
    assert.equal(nav.current(), null); assert.equal(nav.canGoBack(), false); assert.equal(nav.back(), false)
    nav.go('home')
    assert.deepEqual(shown, ['home']); assert.equal(nav.depth(), 1)
  }

  console.log('nav ok')
})().catch((e) => { console.error(e); process.exit(1) })
