// Loaded in <head>, before the first paint, so the page never flashes its heavy look first.
(() => {
// Visual effects Full / Lite: html.fx-lite is what glass.css reads. The choice is Settings › Display
// (settings.fx = 'full' | 'lite'); with none made, Android runs Lite and the desktop Full. A system request for
// reduced transparency always means Lite. app.js calls window.keylightSetFx(value) when the setting changes.
const root = document.documentElement
const readChoice = () => { try { return (JSON.parse(localStorage.getItem('lumi.settings')) || {}).fx } catch (_e) { return undefined } }
const transparencyOff = matchMedia('(prefers-reduced-transparency: reduce)')
let chosen = readChoice()
const lite = () => transparencyOff.matches || (chosen ? chosen === 'lite' : /Android/i.test(navigator.userAgent))
const syncFx = () => root.classList.toggle('fx-lite', lite())
syncFx()
transparencyOff.addEventListener?.('change', syncFx)
window.keylightSetFx = (value) => { chosen = value === 'lite' || value === 'full' ? value : undefined; syncFx() }
})()
