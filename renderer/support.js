import { parseState, recordLaunch, recordShown, shouldOfferSupport, snooze, neverAgain, serialise } from './support-reminder.js'

const dialog = document.getElementById('supportDialog')
const card = document.getElementById('supportReminder')
const seenKey = 'lumi.supportOfferSeen'
const stateKey = 'lumi.support'

function read(key) {
  try {
    return localStorage.getItem(key)
  } catch (error) {
    if (!(error instanceof DOMException)) throw error
    return null
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value)
    return true
  } catch (error) {
    if (!(error instanceof DOMException)) throw error
    return false
  }
}

function rememberOffer() {
  if (!write(seenKey, '1')) document.getElementById('supportStorage').textContent = 'Your browser could not remember this choice.'
}

// The reminder state lives in 'lumi.support'. It is read each time it is needed, so a change made
// elsewhere (or by hand) counts. A profile that saw the first offer before the reminder existed
// starts its countdown on the day it updates.
function loadState() {
  return parseState(read(stateKey), Date.now(), read(seenKey) === '1')
}

function saveState(state) {
  write(stateKey, serialise(state))
}

function hideCard() {
  card.classList.add('hidden')
}

function openSupport() {
  if (dialog.open) return
  rememberOffer()
  saveState(recordShown(loadState(), Date.now()))
  hideCard()
  dialog.showModal()
}

for (const button of document.querySelectorAll('[data-support]')) button.addEventListener('click', openSupport)
dialog.addEventListener('keydown', (event) => event.stopPropagation())
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) {
    const rect = dialog.getBoundingClientRect()
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close()
  }
})

window.addEventListener('keylight:first-run-complete', () => {
  if (read(seenKey) === '1') return
  openSupport()
})

// One launch is counted per app start. A first launch only stores the starting state.
{
  const raw = read(stateKey)
  const state = loadState()
  saveState(recordLaunch(state))   // every start counts, the first one too
}

// A calm moment: the user is back on Home after passing a song or a course item. The card is never shown
// on another screen, during setup or while a dialog is open.
function calmOk() {
  const onboarding = document.getElementById('onboarding')
  if (document.body.dataset.screen !== 'home') return false
  if (onboarding && !onboarding.classList.contains('hidden')) return false
  return !document.querySelector('dialog[open]')
}

window.addEventListener('keylight:calm-moment', () => {
  if (!calmOk() || !card.classList.contains('hidden')) return
  if (shouldOfferSupport(loadState(), Date.now(), 'calm')) card.classList.remove('hidden')
})

card.querySelector('[data-reminder="support"]').addEventListener('click', openSupport)
card.querySelector('[data-reminder="later"]').addEventListener('click', () => {
  saveState(snooze(loadState(), Date.now()))
  hideCard()
})
card.querySelector('[data-reminder="never"]').addEventListener('click', () => {
  saveState(neverAgain(loadState()))
  hideCard()
})
