import { requestMIDIAccess, nativeRequest } from './android-midi.js'

Object.defineProperty(navigator, 'requestMIDIAccess', { value: requestMIDIAccess, configurable: true })
const blobs = new Map()
const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL)
URL.createObjectURL = (blob) => { const url = create(blob); blobs.set(url, blob); return url }
URL.revokeObjectURL = (url) => { blobs.delete(url); revoke(url) }
let exports = Promise.resolve()

// The host accepts only plain file names (letters, digits, . _ - and space, starting with a letter or digit): a song
// title with an apostrophe or an accent in it is tidied here instead of failing the save.
export function safeName(name) {
  const clean = String(name).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9._ -]+/g, '-').replace(/^[^A-Za-z0-9]+/, '').slice(0, 128)
  return clean || 'keylight-file'
}

export async function exportBlob(blob, rawName) {
  const name = safeName(rawName)
  if (blob.size > 256 * 1024 * 1024) throw new RangeError('Android export limit is 256 MiB; record a shorter take')
  const token = await nativeRequest('exportBegin', { name, mime: blob.type.split(';')[0] || 'application/octet-stream', size: blob.size })
  try {
    for (let offset = 0; offset < blob.size; offset += 32768) {
      const bytes = new Uint8Array(await blob.slice(offset, offset + 32768).arrayBuffer())
      let binary = ''
      for (const byte of bytes) binary += String.fromCharCode(byte)
      await nativeRequest('exportChunk', { token, data: btoa(binary) })
    }
    await nativeRequest('exportFinish', { token })
  } catch (error) {
    await nativeRequest('exportAbort', { token })
    throw error
  }
}

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
