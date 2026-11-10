// The keyboard-shortcuts and About dialogs. Both are styled <dialog>s in index.html: showModal() makes the
// app behind them inert, focus lands on the Close button and goes back to where it was when they close.
// No network calls: everything shown here is static text or the version the app was started with.

const $ = (id) => document.getElementById(id)

function openDialog(dlg) {
  if (!dlg || dlg.open) return false
  const back = document.activeElement
  dlg.addEventListener('close', () => { if (back && back.isConnected && back !== document.body) back.focus() }, { once: true })
  dlg.showModal()
  const first = dlg.querySelector('.support-actions .primary')
  if (first) first.focus({ preventScroll: true })
  return true
}

/** True when typing in this element should not trigger a shortcut. */
function typing(t) {
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
}

/**
 * Wire the two dialogs.
 * @param {{version: string, songCount: number, mutopiaCount: number, canOpen: () => boolean}} o
 *   canOpen: false while something else owns the keyboard (the results, the setup)
 */
export function mountInfoDialogs(o) {
  const shortcuts = $('shortcutsDialog'), about = $('aboutDialog')
  if (!shortcuts || !about) return { openShortcuts() {}, openAbout() {} }
  $('aboutVersion').textContent = /^\d/.test(o.version) ? 'v' + o.version : o.version
  $('aboutMusic').textContent = `${o.songCount - o.mutopiaCount} easy songs are public domain. ${o.mutopiaCount} advanced piano pieces are public-domain compositions from the Mutopia Project, each typeset by a volunteer who chose its licence (shown under the song title while you play, and listed in LICENSES/mutopia-songs.md). The README has the full Music credits.`
  const openShortcuts = () => openDialog(shortcuts)
  const openAbout = () => openDialog(about)
  const swap = (from, to) => () => { from.close(); to.showModal(); const b = to.querySelector('.support-actions .primary'); if (b) b.focus({ preventScroll: true }) }
  $('shortcutsAbout').onclick = swap(shortcuts, about)
  $('aboutShortcuts').onclick = swap(about, shortcuts)
  const link = (id, fn) => { const b = $(id); if (b) b.onclick = fn }
  link('openShortcuts', openShortcuts)
  link('openAbout', openAbout)
  document.addEventListener('keydown', (e) => {
    if (e.key !== '?' || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
    if (typing(e.target) || document.querySelector('dialog[open]') || !o.canOpen()) return
    e.preventDefault()
    openShortcuts()
  })
  return { openShortcuts, openAbout }
}
