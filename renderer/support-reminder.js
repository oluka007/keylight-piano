// Support reminder: decides when to offer the "support the project" nudge.
//
// Pure and free of side effects: no DOM, no localStorage and no Date.now, so
// time is always passed in as a number of milliseconds. The stored state is
// five fields:
//   firstLaunch        when the app was first seen (ms)
//   lastShown          when the reminder was last shown (0 if never, ms)
//   snoozeUntil        the reminder stays quiet until this moment (ms)
//   never              the user asked to never be reminded again
//   launchesSinceShown launches since the reminder was last shown
//
// The reminder is only offered at a 'calm' moment (never mid-song), at least
// REMIND_DAYS after the later of the first launch and the last showing, and
// only once the user has launched the app MIN_LAUNCHES times since then.

export const DAY = 86400000
export const REMIND_DAYS = 14
export const MIN_LAUNCHES = 3

const MAX_LAUNCHES = 100000
const MAX_SNOOZE_DAYS = 366

// A fresh state. A legacy user (one seen before the reminder existed) starts
// with lastShown already at now, so the countdown begins on the update day.
export function initialState(now, legacySeen = false) {
  return {
    firstLaunch: now,
    lastShown: legacySeen ? now : 0,
    snoozeUntil: 0,
    never: false,
    launchesSinceShown: 0
  }
}

// A time field is usable only as a finite number of milliseconds >= 0.
function isTime(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Parse a stored state, repairing values that are plausible in type but out of
// range. Anything unusable falls back to a fresh state.
export function parseState(raw, now, legacySeen = false) {
  if (typeof raw !== 'string' || raw.trim() === '') return initialState(now, legacySeen)
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return initialState(now, legacySeen)
  }
  if (!isPlainObject(parsed)) return initialState(now, legacySeen)
  if (!isTime(parsed.firstLaunch) || !isTime(parsed.lastShown) || !isTime(parsed.snoozeUntil)) {
    return initialState(now, legacySeen)
  }
  if (typeof parsed.never !== 'boolean') return initialState(now, legacySeen)
  if (typeof parsed.launchesSinceShown !== 'number' || !Number.isFinite(parsed.launchesSinceShown)) {
    return initialState(now, legacySeen)
  }
  // Copy only the five known fields, then repair them.
  let firstLaunch = parsed.firstLaunch
  let lastShown = parsed.lastShown
  let snoozeUntil = parsed.snoozeUntil
  // A clock set forward and back must not silence the reminder for ever.
  if (firstLaunch > now) firstLaunch = now
  if (lastShown > now) lastShown = now
  // firstLaunch 0 is not a real launch time.
  if (firstLaunch === 0) firstLaunch = now
  // A snooze further out than a year is not believable.
  if (snoozeUntil > now + MAX_SNOOZE_DAYS * DAY) snoozeUntil = now + REMIND_DAYS * DAY
  const launchesSinceShown = Math.min(Math.max(Math.floor(parsed.launchesSinceShown), 0), MAX_LAUNCHES)
  return { firstLaunch, lastShown, snoozeUntil, never: parsed.never, launchesSinceShown }
}

// Offer the reminder only at a calm moment, once the wait and the launches are
// both satisfied and the user has not snoozed or opted out.
export function shouldOfferSupport(state, now, moment) {
  return state.never === false &&
    moment === 'calm' &&
    now >= state.snoozeUntil &&
    now - Math.max(state.lastShown, state.firstLaunch) >= REMIND_DAYS * DAY &&
    state.launchesSinceShown >= MIN_LAUNCHES
}

export function recordLaunch(state) {
  return { ...state, launchesSinceShown: Math.min(state.launchesSinceShown + 1, MAX_LAUNCHES) }
}

export function recordShown(state, now) {
  return { ...state, lastShown: now, launchesSinceShown: 0 }
}

export function snooze(state, now) {
  return {
    ...state,
    lastShown: now,
    snoozeUntil: now + REMIND_DAYS * DAY,
    launchesSinceShown: 0
  }
}

export function neverAgain(state) {
  return { ...state, never: true }
}

export function serialise(state) {
  return JSON.stringify({
    firstLaunch: state.firstLaunch,
    lastShown: state.lastShown,
    snoozeUntil: state.snoozeUntil,
    never: state.never,
    launchesSinceShown: state.launchesSinceShown
  })
}
