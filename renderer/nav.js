// Navigation stack: where "Back" goes. Pure logic, no DOM, so it runs under Node
// (scripts/test-nav.js). The app supplies what actually switches the screen (onShow).
//
// An entry is { screen, params, scroll }. Transient screens (the player, a quiz, an
// exercise) are dropped from the stack when they are left, so Back never re-enters a
// finished song, quiz or exercise.
//
// screens: { [name]: { transient, save(entry), handleBack(entry) } }, all optional.
//   transient   the screen is never a place to go back to
//   save        called when the screen is left forward: fills entry.params / entry.scroll
//   handleBack  lets the screen use a Back press itself; returns true when it did
// onShow(entry, { back }) switches to the entry; back is true when it is being returned to.
// root: the screen the app leaves from; Back on any other lone entry goes there first.
// initial: the screen already on show when the nav is created (onShow is not called for it).
export function createNav({ screens = {}, onShow, max = 20, root = 'home', initial = null } = {}) {
  const stack = []
  const overlays = []
  const hook = (name) => screens[name] || {}
  const top = () => stack[stack.length - 1]
  const make = (screen, params) => ({ screen, params: params === undefined ? {} : params, scroll: 0 })
  const show = (entry, back) => { if (onShow) onShow(entry, { back }) }
  const trim = () => { while (stack.length > max) stack.shift() }
  const saveTop = () => {
    const e = top()
    if (e && hook(e.screen).save) hook(e.screen).save(e)
  }

  if (initial) stack.push(make(initial))

  function go(screen, params) {
    const cur = top()
    if (!cur) { stack.push(make(screen, params)); show(top(), false); return }
    if (cur.screen === screen) { stack[stack.length - 1] = make(screen, params); show(top(), false); return }
    if (hook(cur.screen).transient) {
      stack.pop()
      const below = top()
      if (below && below.screen === screen) {
        if (params !== undefined) below.params = params
        show(below, true)
        return
      }
    } else saveTop()
    stack.push(make(screen, params))
    trim()
    show(top(), false)
  }

  function replace(screen, params) {
    if (!stack.length) { stack.push(make(screen, params)); show(top(), false); return }
    stack[stack.length - 1] = make(screen, params)
    show(top(), false)
  }

  function resetTo(screen, params) {
    stack.length = 0
    stack.push(make(screen, params))
    show(top(), false)
  }

  function back() {
    if (overlays.length) { overlays.pop().close(); return true }
    const cur = top()
    if (cur && hook(cur.screen).handleBack && hook(cur.screen).handleBack(cur)) return true
    if (stack.length > 1) {
      stack.pop()
      show(top(), true)
      return true
    }
    if (cur && cur.screen !== root) { resetTo(root); return true }
    return false
  }

  function pushOverlay(close) {
    const item = { close }
    overlays.push(item)
    return () => {
      const i = overlays.indexOf(item)
      if (i >= 0) overlays.splice(i, 1)
    }
  }

  const current = () => (top() ? { ...top() } : null)
  const depth = () => stack.length
  const canGoBack = () => overlays.length > 0 || stack.length > 1 || (!!top() && top().screen !== root)

  return { go, back, replace, resetTo, current, canGoBack, depth, pushOverlay }
}
