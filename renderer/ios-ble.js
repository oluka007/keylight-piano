// Bluetooth keyboards on iOS: pairing is done by the system sheet (CoreAudioKit's CABTMIDICentralViewController), so the page only
// offers a button that asks the host to show it. A paired keyboard then appears as an ordinary MIDI port (hot-plug event).
const el = (doc, tag, attrs = {}, ...kids) => {
  const node = doc.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) { if (k === 'class') node.className = v; else if (k.startsWith('on')) node[k] = v; else node.setAttribute(k, v) }
  node.append(...kids)
  return node
}

/** host: { request(op, args) -> Promise }. Adds a row to Settings and one to the "no keyboard found" hint. */
export function mountPairing({ host, notify = () => {}, doc = document } = {}) {
  const anchor = doc.getElementById('kbHelp')
  if (!anchor || doc.getElementById('blePairRow')) return null
  const pair = () => host.request('blePair').then((shown) => { if (shown === false) notify('Close the other sheet first, then try again') })
    .catch((error) => notify('Could not open Bluetooth pairing: ' + (error && error.message ? error.message : 'unavailable')))
  const button = (id) => el(doc, 'button', { type: 'button', class: 'mini-btn', id, onclick: pair }, 'Pair Bluetooth keyboard…')
  const row = el(doc, 'div', { class: 'setting-row', id: 'blePairRow' }, el(doc, 'span', {}, 'Bluetooth keyboard'), button('blePairOpen'))
  const hint = el(doc, 'div', { class: 'setting-row hidden', id: 'blePairHint' }, el(doc, 'span', {}, 'Using a Bluetooth keyboard?'), button('blePairHintOpen'))
  anchor.insertAdjacentElement('beforebegin', row)
  anchor.insertAdjacentElement('afterend', hint)
  const sync = () => hint.classList.toggle('hidden', anchor.classList.contains('hidden'))
  new MutationObserver(sync).observe(anchor, { attributes: true, attributeFilter: ['class'] })
  sync()
  return { row, hint, pair }
}
