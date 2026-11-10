const assert = require('node:assert/strict')

const load = (f) => import(require('node:url').pathToFileURL(require('node:path').join(__dirname, '..', 'renderer', f)).href)

;(async () => {
  const {
    DAY, REMIND_DAYS, MIN_LAUNCHES,
    initialState, parseState, shouldOfferSupport,
    recordLaunch, recordShown, snooze, neverAgain, serialise
  } = await load('support-reminder.js')

  const now = 1700000000000
  const later = now + REMIND_DAYS * DAY
  const launches = (state, count) => {
    let next = state
    for (let i = 0; i < count; i++) next = recordLaunch(next)
    return next
  }

  // A fresh user is not offered before 14 days and before 3 launches.
  const fresh = initialState(now)
  assert.equal(shouldOfferSupport(fresh, now, 'calm'), false)
  assert.equal(shouldOfferSupport(fresh, later - 1, 'calm'), false)
  assert.equal(shouldOfferSupport(launches(fresh, MIN_LAUNCHES), now, 'calm'), false)
  // ... and is offered at a calm moment once both hold.
  assert.equal(shouldOfferSupport(launches(fresh, MIN_LAUNCHES), later, 'calm'), true)

  // Never offered at any moment other than 'calm'.
  const ready = launches(fresh, MIN_LAUNCHES)
  for (const moment of ['launch', 'setup', 'play', undefined]) {
    assert.equal(shouldOfferSupport(ready, later, moment), false)
  }

  // Snooze blocks for 14 days, then allows again after 3 more launches.
  const snoozed = snooze(ready, later)
  assert.equal(shouldOfferSupport(snoozed, later, 'calm'), false)
  assert.equal(shouldOfferSupport(snoozed, later + REMIND_DAYS * DAY - 1, 'calm'), false)
  assert.equal(shouldOfferSupport(snoozed, later + REMIND_DAYS * DAY, 'calm'), false)
  assert.equal(shouldOfferSupport(launches(snoozed, MIN_LAUNCHES), later + REMIND_DAYS * DAY, 'calm'), true)

  // neverAgain blocks for ever.
  const never = neverAgain(ready)
  assert.equal(shouldOfferSupport(never, later + 1000 * DAY, 'calm'), false)

  // A legacy user is not offered on the day of the update ...
  const legacy = initialState(now, true)
  assert.equal(legacy.lastShown, now)
  assert.equal(shouldOfferSupport(launches(legacy, MIN_LAUNCHES), now, 'calm'), false)
  assert.equal(shouldOfferSupport(launches(legacy, MIN_LAUNCHES), later - 1, 'calm'), false)
  // ... but is after 14 days and 3 launches.
  assert.equal(shouldOfferSupport(launches(legacy, MIN_LAUNCHES), later, 'calm'), true)

  // parseState falls back to a fresh state on garbage input.
  const base = {
    firstLaunch: now - 20 * DAY,
    lastShown: now - 20 * DAY,
    snoozeUntil: 0,
    never: false,
    launchesSinceShown: 3
  }
  for (const bad of [null, '', 'x', '[]', 'null', '{"never":"yes"}']) {
    assert.deepEqual(parseState(bad, now), initialState(now))
  }

  // parseState repairs each malformed field.
  const repairs = (patch) => parseState(JSON.stringify({ ...base, ...patch }), now)
  assert.equal(repairs({ firstLaunch: now + 5 * DAY }).firstLaunch, now)
  assert.equal(repairs({ lastShown: now + 5 * DAY }).lastShown, now)
  assert.equal(repairs({ snoozeUntil: now + 1000 * DAY }).snoozeUntil, now + REMIND_DAYS * DAY)
  assert.equal(repairs({ firstLaunch: 0 }).firstLaunch, now)
  assert.equal(repairs({ launchesSinceShown: 999999 }).launchesSinceShown, 100000)
  assert.equal(repairs({ launchesSinceShown: -5 }).launchesSinceShown, 0)
  // A sound state is copied field by field and left alone.
  assert.deepEqual(repairs({}), base)

  // No function mutates its input.
  const frozen = Object.freeze({ ...base })
  assert.notEqual(recordLaunch(frozen), frozen)
  assert.notEqual(recordShown(frozen, now), frozen)
  assert.notEqual(snooze(frozen, now), frozen)
  assert.notEqual(neverAgain(frozen), frozen)
  shouldOfferSupport(frozen, now, 'calm')
  serialise(frozen)
  assert.deepEqual(frozen, base)

  // serialise then parseState round-trips.
  const stored = {
    firstLaunch: now - 20 * DAY,
    lastShown: now - 10 * DAY,
    snoozeUntil: now + 3 * DAY,
    never: true,
    launchesSinceShown: 7
  }
  assert.deepEqual(parseState(serialise(stored), now), stored)

  console.log('support-reminder: ok')
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
