// Keylight motion helpers (glass.css, phase 5). Presentation only: it never changes what is shown, only
// tags elements so the CSS can animate them. Everything here is a no-op under reduced motion or in a hidden window.
const root = document.documentElement
const body = document.body
const nav = document.getElementById('nav')
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches

// no motion work while the window is hidden
const syncVisibility = () => root.classList.toggle('mo-idle', document.hidden)
document.addEventListener('visibilitychange', syncVisibility)
syncVisibility()

// covers fade in when they have loaded (load does not bubble, so listen in the capture phase)
document.addEventListener('load', (e) => {
  const t = e.target
  if (t instanceof HTMLImageElement && t.classList.contains('c-img')) t.classList.add('ld')
}, true)
const sweepImages = () => { for (const i of document.querySelectorAll('img.c-img:not(.ld)')) if (i.complete && i.naturalWidth) i.classList.add('ld') }

// which side a screen enters from: forward tabs slide in from the right, Back from the left
const ORDER = ['home', 'course', 'practice', 'search', 'settings']
const setSx = (px) => root.style.setProperty('--sx', px + 'px')
if (nav) nav.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('button[data-screen]')
  if (!b) return
  const from = ORDER.indexOf(body.dataset.screen), to = ORDER.indexOf(b.dataset.screen)
  setSx(from < 0 || to < 0 || from === to ? 0 : to > from ? 14 : -14)
}, true)
const backBtn = document.getElementById('back')
if (backBtn) backBtn.addEventListener('click', () => setSx(-14), true)

// the tab bar pill: one element, moved with a transform to the active tab
let ind = null
let indShown = false
function place(instant) {
  if (!nav) return
  if (!ind) {
    ind = document.createElement('span')
    ind.className = 'nav-ind'
    ind.setAttribute('aria-hidden', 'true')
    nav.prepend(ind)
    nav.classList.add('has-ind')
    instant = true
  }
  const b = nav.querySelector('button.on')
  if (!b || !b.offsetWidth) { ind.style.opacity = '0'; indShown = false; return }
  const jump = instant || document.hidden || !indShown
  if (jump) ind.style.transition = 'none'
  ind.style.width = b.offsetWidth + 'px'
  ind.style.transform = 'translateX(' + b.offsetLeft + 'px)'
  ind.style.opacity = '1'
  if (jump) { void ind.offsetWidth; ind.style.transition = '' }
  indShown = true
}
let resizeQueued = false
window.addEventListener('resize', () => {
  if (resizeQueued) return
  resizeQueued = true
  requestAnimationFrame(() => { resizeQueued = false; place(true) })
})

// staggered reveal: only when a screen is entered, never when its content re-renders
const REVEAL = { home: '.home-head, .hero, .course-card, .cover-tile, .explore-card', search: '.chip-row, .cover-tile, .empty', course: '.cr-hero, .cr-level, .cr-back, .cr-lhead, .cr-complete, .cr-prose, .cr-sidecard, .cr-qcard' }
const untag = (el) => { el.classList.remove('rv'); el.style.removeProperty('--i') }
document.addEventListener('animationend', (e) => { if (e.animationName === 'mRise' && e.target.classList.contains('rv')) untag(e.target) }, true)
function reveal(screen) {
  const sel = REVEAL[screen]
  const host = sel && document.getElementById('screen-' + screen)
  if (!host) return
  for (const el of host.querySelectorAll('.rv')) untag(el)
  if (calm() || document.hidden) return
  let i = 0
  for (const el of host.querySelectorAll(sel)) {
    if (i >= 10) break
    const r = el.getBoundingClientRect()
    if (!r.width || r.top > innerHeight || r.left > innerWidth) continue
    el.style.setProperty('--i', i++)
    el.classList.add('rv')
  }
}

// showScreen sets body[data-screen]; by the time this runs the screen is rendered
new MutationObserver(() => {
  place(false)
  sweepImages()
  reveal(body.dataset.screen)
  setTimeout(() => setSx(0), 320)
}).observe(body, { attributes: true, attributeFilter: ['data-screen'] })
place(true)
