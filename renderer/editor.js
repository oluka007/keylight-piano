// Note correction for the song in the player: change a note's pitch, start, length,
// hand or finger, add and remove notes, undo, and correct the tempo, then save.
//
// The draft (NoteDraft) holds the notes being edited and an undo history; the dialog
// built by mountEditor shows them as rows of labelled fields, a page at a time. Saving
// hands the parent one checked song: the same song with its new notes, its cover,
// lyrics, audio and other details untouched. Once a note's pitch, timing or hand
// changes, the original score is dropped (score: null) so the sheet music never shows
// notes that are no longer played. A built-in song is never changed in place: its
// edit is saved as a new copy (no id).
import { NoteDraft, pitchName } from './editor-model.js'
export { NoteDraft, pitchName, parsePitch, checkNote, checkNotes, MAX_SECONDS, MAX_NOTES } from './editor-model.js'
const PAGE = 50

// ---------- the dialog ----------

const FIELDS = [
  { field: 'pitch', label: 'Note', kind: 'text' },
  { field: 'start', label: 'Start (s)', kind: 'number' },
  { field: 'dur', label: 'Length (s)', kind: 'number' },
  { field: 'hand', label: 'Hand', kind: 'hand' },
  { field: 'finger', label: 'Finger', kind: 'finger' }
]
const shown = (n, field) => {
  switch (field) {
    case 'pitch': return pitchName(n.pitch)
    case 'start': case 'dur': return String(Math.round(n[field] * 1000) / 1000)
    case 'hand': return n.hand
    case 'finger': return n.finger ? String(n.finger) : ''
    default: throw new Error('Unknown note field ' + field)
  }
}
const h = (tag, props = {}, kids = []) => {
  const el = Object.assign(document.createElement(tag), props)
  for (const k of [].concat(kids)) if (k != null) el.append(k)
  return el
}
const option = (value, text) => h('option', { value, textContent: text })

// mountEditor({ getSong, saveSong, notice, root? }) -> { open, close }
//   getSong(): the song now in the player (may return a promise), or null. An imported
//     song carries importedId; one without it is saved as a new copy.
//   saveSong(song): the checked, edited song; the parent stores and reopens it. A
//     rejection keeps the dialog open with the message.
//   notice(text): a short message once the dialog has closed.
export function mountEditor({ getSong, saveSong, notice, root = document.body }) {
  let dlg = null, draft = null, page = 0, lastKey = null, saving = false
  const els = {}
  const errors = new Map()          // input -> message, for typed values not taken yet

  function build() {
    els.tempo = h('input', { type: 'number', min: 20, max: 400, step: 'any', className: 'ed-input', id: 'edTempo' })
    els.tempoErr = h('span', { className: 'ed-err', id: 'edTempoErr' })
    els.undo = h('button', { type: 'button', className: 'ghost ed-tool', textContent: 'Undo' })
    els.add = h('button', { type: 'button', className: 'ghost ed-tool', textContent: 'Add note' })
    els.sub = h('p', { className: 'ed-sub', id: 'edSub' })
    els.rows = h('ol', { className: 'ed-rows', ariaLabel: 'Notes' })
    els.prev = h('button', { type: 'button', className: 'ghost ed-tool', textContent: 'Earlier notes' })
    els.next = h('button', { type: 'button', className: 'ghost ed-tool', textContent: 'Later notes' })
    els.range = h('span', { className: 'ed-range' })
    els.status = h('p', { className: 'ed-status', role: 'status' })
    els.cancel = h('button', { type: 'button', className: 'ghost', textContent: 'Cancel' })
    els.save = h('button', { type: 'submit', className: 'primary ed-save', textContent: 'Save' })
    els.form = h('form', { className: 'ed-form', noValidate: true }, [
      h('header', { className: 'ed-head' }, [
        h('h2', { id: 'edTitle', textContent: 'Correct notes' }), els.sub,
        h('div', { className: 'ed-tools' }, [
          h('label', { className: 'ed-field ed-tempo', htmlFor: 'edTempo' }, [h('span', { textContent: 'Tempo (beats a minute)' }), els.tempo, els.tempoErr]),
          els.undo, els.add
        ])
      ]),
      h('div', { className: 'ed-body' }, [els.rows, h('nav', { className: 'ed-pager', ariaLabel: 'Pages of notes' }, [els.prev, els.range, els.next])]),
      h('footer', { className: 'ed-foot' }, [els.status, els.cancel, els.save])
    ])
    els.tempo.setAttribute('aria-describedby', 'edTempoErr')
    dlg = h('dialog', { className: 'ed' }, els.form)
    dlg.setAttribute('aria-labelledby', 'edTitle')
    dlg.setAttribute('aria-describedby', 'edSub')
    root.append(dlg)

    // keys typed here stay here: the player's shortcuts must not fire under the dialog
    dlg.addEventListener('keydown', (e) => {
      e.stopPropagation()
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        const t = e.target
        if (t instanceof HTMLInputElement && t.value !== t.defaultValue) return   // the field's own typing undo
        e.preventDefault()
        undo()
      }
    })
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); cancel() })
    // the browser may still close on a repeated Escape: unsaved notes are asked about
    dlg.addEventListener('close', () => {
      if (!draft) return
      if (draft.dirty && !confirm('Discard your changes to these notes?')) dlg.showModal()
      else draft = null
    })
    els.form.addEventListener('submit', (e) => { e.preventDefault(); save() })
    els.cancel.onclick = cancel
    els.undo.onclick = undo
    els.add.onclick = () => {
      const key = draft.add(lastKey)
      say('Note added')
      showNote(key, 'pitch')
    }
    els.prev.onclick = () => { page--; render(); focusFirst() }
    els.next.onclick = () => { page++; render(); focusFirst() }
    els.tempo.addEventListener('change', () => {
      const err = draft.setTempo(els.tempo.value)
      mark(els.tempo, els.tempoErr, err)
      if (!err) { els.tempo.defaultValue = els.tempo.value; refreshTools() }
    })
    els.rows.addEventListener('focusin', (e) => {
      const row = e.target.closest('.ed-row')
      if (row) lastKey = Number(row.dataset.key)
    })
    els.rows.addEventListener('change', (e) => {
      const input = e.target
      const row = input.closest('.ed-row')
      if (!row || !input.dataset.field) return
      const key = Number(row.dataset.key)
      const field = input.dataset.field
      const before = draft.indexOf(key)
      const err = draft.set(key, field, input.value)
      mark(input, row.querySelector(`[data-err="${field}"]`), err)
      if (err) return
      refreshTools()
      const i = draft.indexOf(key)
      // a note that moved in time order is shown in its new place; one that stayed is
      // updated where it is, so other fields keep what is typed in them
      if (i !== before) { showNote(key, field); return }
      const n = draft.notes[i]
      input.value = shown(n, field)
      if (input instanceof HTMLInputElement) input.defaultValue = input.value
      row.querySelector('.ed-remove').ariaLabel = `Remove note ${i + 1}, ${pitchName(n.pitch)}`
    })
    els.rows.addEventListener('click', (e) => {
      const btn = e.target.closest('.ed-remove')
      if (!btn) return
      const key = Number(btn.closest('.ed-row').dataset.key)
      const i = draft.indexOf(key)
      draft.remove(key)
      say('Note removed. Undo brings it back.')
      const next = draft.notes[Math.min(i, draft.notes.length - 1)]
      if (next) showNote(next.key, 'remove')
      else { render(); els.add.focus() }
    })
  }

  function mark(input, errEl, err) {
    input.setAttribute('aria-invalid', err ? 'true' : 'false')
    if (errEl) errEl.textContent = err || ''
    if (err) errors.set(input, err)
    else errors.delete(input)
  }
  const say = (text) => { els.status.textContent = text }
  function refreshTools() {
    els.undo.disabled = !draft.canUndo
    els.sub.textContent = `${draft.original.title || 'This song'} · ${draft.notes.length} ${draft.notes.length === 1 ? 'note' : 'notes'}` +
      (draft.copy ? ' · built-in songs are saved as your own copy' : '')
  }

  function row(n, i) {
    const li = h('li', { className: 'ed-row' })
    li.dataset.key = n.key
    li.append(h('span', { className: 'ed-num', textContent: String(i + 1), ariaHidden: 'true' }))
    for (const f of FIELDS) {
      const id = `ed-${n.key}-${f.field}`
      let input
      switch (f.kind) {
        case 'text': input = h('input', { type: 'text', className: 'ed-input', autocomplete: 'off', spellcheck: false }); break
        case 'number': input = h('input', { type: 'number', className: 'ed-input', min: 0, step: 0.01, inputMode: 'decimal' }); break
        case 'hand': input = h('select', { className: 'ed-input' }, [option('left', 'Left'), option('right', 'Right')]); break
        case 'finger': input = h('select', { className: 'ed-input' }, [option('', 'Auto'), ...[1, 2, 3, 4, 5].map((k) => option(String(k), String(k)))]); break
        default: throw new Error('Unknown field kind ' + f.kind)
      }
      Object.assign(input, { id, value: shown(n, f.field) })
      if (input instanceof HTMLInputElement) input.defaultValue = input.value
      input.dataset.field = f.field
      input.setAttribute('aria-describedby', id + '-err')
      const err = h('span', { className: 'ed-err', id: id + '-err' })
      err.dataset.err = f.field
      li.append(h('label', { className: `ed-field ed-${f.field}`, htmlFor: id }, [h('span', { textContent: f.label }), input, err]))
    }
    const rm = h('button', { type: 'button', className: 'iconbtn ed-remove', ariaLabel: `Remove note ${i + 1}, ${pitchName(n.pitch)}`, title: 'Remove note' })
    rm.innerHTML = '<svg aria-hidden="true"><use href="#i-close"/></svg>'
    li.append(rm)
    return li
  }

  function render() {
    errors.clear()
    const count = draft.notes.length
    const pages = Math.max(1, Math.ceil(count / PAGE))
    page = Math.min(Math.max(0, page), pages - 1)
    const from = page * PAGE
    const slice = draft.notes.slice(from, from + PAGE)
    els.rows.replaceChildren(...(slice.length ? slice.map((n, i) => row(n, from + i)) : [h('li', { className: 'ed-empty', textContent: 'No notes left. Add a note to start again, or Undo.' })]))
    els.range.textContent = count ? `Notes ${from + 1}-${from + slice.length} of ${count}` : ''
    els.prev.disabled = page === 0
    els.next.disabled = page >= pages - 1
    els.prev.parentElement.hidden = pages < 2
    els.tempo.value = els.tempo.defaultValue = String(draft.tempo)
    mark(els.tempo, els.tempoErr, null)
    refreshTools()
  }
  // render the page holding note `key` and focus its field
  function showNote(key, field) {
    page = Math.floor(Math.max(0, draft.indexOf(key)) / PAGE)
    render()
    const li = els.rows.querySelector(`.ed-row[data-key="${key}"]`)
    const target = li && (field === 'remove' ? li.querySelector('.ed-remove') : li.querySelector(`[data-field="${field}"]`))
    if (target) target.focus()
    lastKey = key
  }
  const focusFirst = () => { const f = els.rows.querySelector('input, select, button'); if (f) f.focus() }

  function undo() {
    if (!draft.undo()) { say('Nothing to undo'); return }
    render()
    say('Undone')
    focusFirst()
  }
  function close() {
    draft = null
    if (dlg && dlg.open) dlg.close()
  }
  function cancel() {
    if (saving) return
    if (draft && draft.dirty && !confirm('Discard your changes to these notes?')) return
    close()
  }
  async function save() {
    if (saving) return
    const bad = [...errors.keys()][0]
    if (bad) { say('Fix the marked field first: ' + errors.get(bad)); bad.focus(); return }
    const { song, error } = draft.build()
    if (error) { say(error); return }
    saving = true
    els.save.disabled = true
    say('Saving')
    try {
      await saveSong(song)
      close()
      notice(song.id === undefined ? 'Saved as your own copy' : 'Notes saved')
    } catch (e) {
      say('Could not save: ' + (e && e.message ? e.message : String(e)))
    } finally {
      saving = false
      els.save.disabled = false
    }
  }

  async function open() {
    const song = await getSong()
    if (!song || !Array.isArray(song.notes) || !song.notes.length) { notice('Open a song to correct its notes'); return }
    if (!dlg) build()
    draft = new NoteDraft(song)
    page = 0
    lastKey = null
    say('')
    render()
    dlg.showModal()
    focusFirst()
  }
  return { open, close }
}
