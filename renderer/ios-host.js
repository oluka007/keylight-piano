// Bootstrap of the iPhone/iPad app, added to index.html by ios/scripts/bundle-renderer.sh (the desktop page never loads it):
// the MIDI shim, file exports through the share sheet, WebAudio recovery after interruptions, and a stand-in for the
// camera/device API that WKWebView leaves out on a custom-scheme page.
import { requestMIDIAccess, onNativeEvent } from './ios-midi.js'
import { exportBlob } from './ios-export.js'

Object.defineProperty(navigator, 'requestMIDIAccess', { value: requestMIDIAccess, configurable: true })

// downloads: <a download href=blob:...> goes to the share sheet (Save to Files, AirDrop, ...)
const blobs = new Map()
const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL)
URL.createObjectURL = (blob) => { const url = create(blob); blobs.set(url, blob); return url }
URL.revokeObjectURL = (url) => { blobs.delete(url); revoke(url) }
let exports = Promise.resolve()
function download(anchor) {
  const blob = blobs.get(anchor.href)
  if (!blob || !anchor.download) return false
  exports = exports.then(() => exportBlob(blob, anchor.download)).catch((error) => {
    if (!(error instanceof Error)) throw error
    alert('Export failed: ' + error.message)
  })
  return true
}
const click = HTMLAnchorElement.prototype.click
HTMLAnchorElement.prototype.click = function () { if (!download(this)) click.call(this) }
document.addEventListener('click', (event) => {
  const anchor = event.target instanceof Element ? event.target.closest('a[download]') : null
  if (anchor && download(anchor)) event.preventDefault()
}, true)

// WebAudio: iOS suspends (or "interrupts") the context for a call, Siri, an alarm or a route change; the host says when to resume.
const contexts = new Set()
for (const name of ['AudioContext', 'webkitAudioContext']) {
  const Native = globalThis[name]
  if (!Native) continue
  globalThis[name] = class extends Native { constructor(...args) { super(...args); contexts.add(this) } }
}
const resume = () => { for (const ctx of contexts) if (ctx.state !== 'running') ctx.resume().catch(() => {}) }
onNativeEvent((event) => { if (event && event.kind === 'audio') resume() })
// a touch is a user gesture: it also brings back a context that was interrupted while the page was in front
document.addEventListener('pointerdown', resume, { capture: true, passive: true })

// An insecure (custom scheme) page has no navigator.mediaDevices; the renderer only lists outputs and asks for the camera there.
if (!navigator.mediaDevices) {
  const stub = new EventTarget()
  stub.enumerateDevices = async () => []
  stub.getUserMedia = async () => { throw new DOMException('Camera is not available in this build', 'NotSupportedError') }
  Object.defineProperty(navigator, 'mediaDevices', { value: stub, configurable: true })
}
