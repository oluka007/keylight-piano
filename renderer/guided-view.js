import { HANDS, HAND_NAME, RATES, stepLabel } from './guided-course.js'

export function el(doc, tag, cls, text) {
  const element = doc.createElement(tag)
  if (cls) element.className = cls
  if (text != null) element.textContent = text
  return element
}

export function createGuidedView(doc, actions) {
  const button = el(doc, 'button', 'ghost guided-btn hidden', 'Guided practice')
  button.type = 'button'
  button.setAttribute('aria-haspopup', 'dialog')
  button.addEventListener('click', actions.open)
  const bar = doc.querySelector('.player-bottom')
  if (bar) bar.appendChild(button)
  const root = el(doc, 'div', 'guided hidden')
  root.setAttribute('role', 'dialog')
  root.setAttribute('aria-modal', 'true')
  root.setAttribute('aria-labelledby', 'guidedTitle')
  const panel = el(doc, 'div', 'guided-panel')
  const head = el(doc, 'div', 'guided-head')
  const title = el(doc, 'h2', 'guided-title')
  title.id = 'guidedTitle'
  const closeBtn = el(doc, 'button', 'link guided-close', 'Close')
  closeBtn.type = 'button'
  closeBtn.addEventListener('click', actions.close)
  head.append(title, closeBtn)
  const body = el(doc, 'div', 'guided-body')
  const verdict = el(doc, 'section', 'guided-verdict hidden')
  const lead = el(doc, 'p', 'guided-lead')
  const primary = el(doc, 'button', 'primary guided-primary', 'Start')
  primary.type = 'button'
  primary.addEventListener('click', actions.start)
  const note = el(doc, 'p', 'guided-note')
  const prefsRow = el(doc, 'div', 'guided-prefs')
  const phraseList = el(doc, 'ol', 'guided-phrases')
  const stepHead = el(doc, 'h3', 'guided-sub')
  const stepList = el(doc, 'ol', 'guided-steps')
  const lists = el(doc, 'div', 'guided-lists')
  const phraseCol = el(doc, 'div', 'guided-col')
  const stepCol = el(doc, 'div', 'guided-col')
  phraseCol.append(el(doc, 'h3', 'guided-sub', 'Phrases'), phraseList)
  stepCol.append(stepHead, stepList)
  lists.append(phraseCol, stepCol)
  body.append(verdict, lead, primary, note, prefsRow, lists)
  panel.append(head, body)
  root.appendChild(panel)
  doc.body.appendChild(root)
  const prefSelect = (label, key, options) => {
    const wrap = el(doc, 'label', 'guided-pref')
    const select = el(doc, 'select')
    for (const [value, text] of options) { const option = el(doc, 'option', null, text); option.value = String(value); select.appendChild(option) }
    select.addEventListener('change', () => actions.preference(key, select.value))
    wrap.append(el(doc, 'span', null, label), select)
    prefsRow.appendChild(wrap)
    return select
  }
  const selects = {
    hand: prefSelect('Hands', 'hand', HANDS.map((hand) => [hand, HAND_NAME[hand]])),
    mode: prefSelect('Start with', 'mode', [['wait', 'Wait mode, then timed'], ['timed', 'Timed only']]),
    rate: prefSelect('Top speed', 'rate', RATES.map((rate) => [rate, Math.round(rate * 100) + '%']))
  }
  return { button, root, closeBtn, primary, title, verdict, lead, note, selects, phraseList, stepList, stepHead }
}

export function paintGuidedSteps(doc, view, state) {
  const { current: cur, progress } = state
  view.list.replaceChildren()
  view.head.textContent = cur ? 'Steps for ' + cur.section.label.toLowerCase() : 'Steps'
  if (!cur) return
  for (const step of cur.steps) {
    const status = progress[step.id]?.passed ? 'Done' : step.id === cur.step.id ? 'Next' : 'Later'
    const row = el(doc, 'li', 'guided-step is-' + status.toLowerCase())
    const best = progress[step.id]?.best != null ? ' · best ' + Math.round(progress[step.id].best * 100) + '%' : ''
    row.append(el(doc, 'span', 'guided-step-name', stepLabel(step)), el(doc, 'span', 'guided-step-state', status + best))
    view.list.appendChild(row)
  }
}
