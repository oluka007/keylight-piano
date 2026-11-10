// The Practice activity registry and the practice stats (pure: no DOM, storage, audio or clock).
//
// An activity is { id, title, blurb, kind, levels, makeItem(level, rng) }.
//   kind 'exercise'  runs through the course's mountExercise (echo, rhythm, ear, sight). makeItem(level, rng)
//                    returns an item of exactly the shape the course uses for that type, so the same
//                    exercise screen, grading and validator apply. Levels run 1..levels, easiest first.
//   kind 'screen'    has its own screen (or, with `panel`, its own panel on the Practice screen) and no item.
//                    The UI launches it through a callback keyed by its id.
// To add a screen activity: add one entry to ACTIVITIES below and one launch callback with the same id in app.js.
//
// Stats live in localStorage under STATS_KEY:
//   { v: 1, items: { [activityId]: { plays, best: { [level]: accuracy 0..1 }, lastLevel, lastAt } } }

export const STATS_KEY = 'lumi.practice'
export const MAX_LEVEL = 9
export const HARDER_AT = 0.9            // a result this good at a level suggests the next one
export const DEFAULT_IDS = ['playground', 'ear', 'rhythm']

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const pick = (rng, list) => list[Math.min(list.length - 1, Math.floor(rng() * list.length))]
const between = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1))
const MAJOR = [0, 2, 4, 5, 7, 9, 11]
const KEY_PC = { C: 0, G: 7, D: 2, F: 5, Bb: 10, A: 9 }

const passAt = (accuracy = 0.8) => ({ accuracy })
const make = (id, level, title, type, params, accuracy) => ({ id: `practice.${id}.${level}`, title: `${title}, level ${level}`, type, params, passAt: passAt(accuracy) })
const levelOf = (level, count) => clamp(Math.round(Number(level)) || 1, 1, count)

/* ============================== ear training ============================== */
// Each step adds answers to choose from: two choices, then three, four and seven.
const EAR_LADDER = [
  { kind: 'higher-lower' },
  { kind: 'step-skip' },
  { kind: 'chord', qualities: ['major', 'minor', 'diminished'] },
  { kind: 'interval', intervals: [3, 4, 5, 7] },
  { kind: 'interval', intervals: [2, 3, 4, 5, 7, 9, 12] }
]
function earItem(level) {
  const l = levelOf(level, EAR_LADDER.length)
  const step = EAR_LADDER[l - 1]
  const params = { kind: step.kind, rounds: 8 }
  if (step.qualities) params.qualities = step.qualities.slice()
  if (step.intervals) params.intervals = step.intervals.slice()
  return make('ear', l, 'Ear training', 'ear', params)
}

/* ============================== play it back (echo) ============================== */
// Longer phrases, a wider reach, bigger leaps, quicker tempo, more keys and mixed note lengths.
const ECHO_LADDER = [
  { len: 4, span: 5, maxStep: 1, keys: ['C'], tempo: 72, beats: [1], hands: ['right'], rounds: 3 },
  { len: 4, span: 6, maxStep: 2, keys: ['C', 'G'], tempo: 72, beats: [1], hands: ['right'], rounds: 3 },
  { len: 5, span: 7, maxStep: 2, keys: ['C', 'G', 'F'], tempo: 76, beats: [1], hands: ['right'], rounds: 3 },
  { len: 6, span: 8, maxStep: 3, keys: ['C', 'G', 'F', 'D'], tempo: 80, beats: [1, 1, 0.5, 2], hands: ['right', 'left'], rounds: 3 },
  { len: 8, span: 10, maxStep: 3, keys: ['C', 'G', 'F', 'D', 'Bb'], tempo: 88, beats: [1, 0.5, 0.5, 2, 1.5], hands: ['right', 'left'], rounds: 3 }
]
function echoItem(level, rng) {
  const l = levelOf(level, ECHO_LADDER.length)
  const s = ECHO_LADDER[l - 1]
  const hand = pick(rng, s.hands)
  const tonic = (hand === 'left' ? 48 : 60) + KEY_PC[pick(rng, s.keys)]
  let deg = pick(rng, [0, 2, 4])
  const degrees = [deg]
  while (degrees.length < s.len) {
    let next = deg + (rng() < 0.5 ? -1 : 1) * between(rng, 1, s.maxStep)
    if (next < 0) next = -next                                   // bounce off the edges of the reach
    else if (next >= s.span) next = 2 * (s.span - 1) - next
    next = clamp(next, 0, s.span - 1)
    if (next === deg) next = deg + 1 < s.span ? deg + 1 : deg - 1
    degrees.push(next); deg = next
  }
  const notes = degrees.map((d) => ({ p: tonic + 12 * Math.floor(d / 7) + MAJOR[d % 7], beats: pick(rng, s.beats) }))
  return make('echo', l, 'Play it back', 'echo', { notes, tempo: s.tempo, hand, rounds: s.rounds })
}

/* ============================== rhythm ============================== */
// Beat cells that each fill one bar. Later levels add rests, eighths, three-four, dotted notes and sixteenths.
const CELLS = {
  quarters: [[1, 1, 1, 1], [2, 1, 1], [1, 1, 2], [2, 2], [1, 2, 1], [4]],
  rests: [[1, 1, 1, -1], [2, -2], [1, -1, 1, 1], [2, 1, -1]],
  eighths: [[0.5, 0.5, 1, 1, 1], [1, 0.5, 0.5, 1, 1], [1, 1, 0.5, 0.5, 1], [0.5, 0.5, 0.5, 0.5, 2]],
  eighthRests: [[0.5, 0.5, 1, -1, 1], [1, 0.5, 0.5, -1, 1]],
  waltz: [[1, 1, 1], [2, 1], [1, 2], [3], [1.5, 0.5, 1], [1, 1.5, 0.5], [1, 1, -1], [2, -1]],
  waltzDotted: [[1.5, 0.5, 1], [1, 1.5, 0.5]],
  dotted: [[1.5, 0.5, 1, 1], [1, 1.5, 0.5, 1], [1.5, 0.5, 2], [2, 1.5, 0.5]],
  sixteenths: [[0.25, 0.25, 0.25, 0.25, 1, 1, 1], [0.5, 0.25, 0.25, 1, 1, 1], [1, 0.25, 0.25, 0.5, 1, 1], [0.25, 0.25, 0.5, 0.5, 0.5, 2]]
}
// signature: cells of which at least one bar is always used, so the new idea of the level is really heard
const RHYTHM_LADDER = [
  { ts: '4/4', bars: 2, tempo: 72, base: ['quarters'], signature: ['quarters'] },
  { ts: '4/4', bars: 2, tempo: 80, base: ['quarters', 'rests'], signature: ['rests'] },
  { ts: '4/4', bars: 3, tempo: 84, base: ['quarters', 'rests', 'eighths'], signature: ['eighths'] },
  { ts: '3/4', bars: 4, tempo: 92, base: ['waltz'], signature: ['waltzDotted'] },
  { ts: '4/4', bars: 4, tempo: 100, base: ['quarters', 'eighths', 'eighthRests', 'dotted', 'sixteenths'], signature: ['sixteenths'] }
]
const isRest = (cell) => cell.some((b) => b < 0)
function rhythmItem(level, rng) {
  const l = levelOf(level, RHYTHM_LADDER.length)
  const s = RHYTHM_LADDER[l - 1]
  const pool = s.base.flatMap((n) => CELLS[n])
  const sig = s.signature.flatMap((n) => CELLS[n])
  const sigBar = between(rng, sig.some((c) => !isRest(c)) ? 0 : 1, s.bars - 1)   // the first bar never opens on a rest
  const pattern = []
  for (let bar = 0; bar < s.bars; bar++) {
    let cell
    if (bar === sigBar) cell = pick(rng, bar === 0 ? sig.filter((c) => !isRest(c)) : sig)
    else cell = pick(rng, bar === 0 ? pool.filter((c) => !isRest(c)) : pool)
    pattern.push(...cell)
  }
  return make('rhythm', l, 'Rhythm', 'rhythm', { pattern, tempo: s.tempo, timeSignature: s.ts })
}

/* ============================== sight-reading ============================== */
// A wider range, more bars and more sharps and flats, then both hands.
const SIGHT_LADDER = [
  { range: [60, 67], hand: 'right', keys: ['C'], length: 1 },
  { range: [60, 67], hand: 'right', keys: ['C'], length: 2 },
  { range: [55, 71], hand: 'right', keys: ['G', 'C'], length: 3 },
  { range: [53, 72], hand: 'both', keys: ['F', 'G'], length: 4 },
  { range: [52, 79], hand: 'both', keys: ['D', 'Bb', 'A'], length: 4 }
]
function sightItem(level, rng) {
  const l = levelOf(level, SIGHT_LADDER.length)
  const s = SIGHT_LADDER[l - 1]
  return make('sight', l, 'Sight-reading', 'sight', { range: s.range.slice(), hand: s.hand, key: pick(rng, s.keys), length: s.length }, 0.7)
}

/* ============================== the registry ============================== */
const exercise = (id, title, blurb, makeItem, levels) => ({ id, title, blurb, kind: 'exercise', levels, makeItem })
const screen = (id, title, blurb, extra = {}) => ({ id, title, blurb, kind: 'screen', levels: 0, ...extra })

export const ACTIVITIES = [
  screen('playground', 'Playground', 'Play freely with any sound. No goals, no score.'),
  exercise('ear', 'Ear training', 'Listen, then say what you heard: higher or lower, chords, intervals.', earItem, EAR_LADDER.length),
  exercise('rhythm', 'Rhythm', 'Listen to the count, then tap the rhythm in time.', rhythmItem, RHYTHM_LADDER.length),
  exercise('sight', 'Sight-reading', 'Read a short line of notes and play it, one note at a time.', sightItem, SIGHT_LADDER.length),
  exercise('echo', 'Play it back', 'Hear a short phrase, then play it back from memory.', echoItem, ECHO_LADDER.length),
  screen('toolbox', 'Scales & chords', 'Pick a key and practise its scales, chords and arpeggios.'),
  screen('games', 'Games', 'Hit the notes in time and beat the pass mark.'),
  screen('jam', 'Jam', 'Build a tune from loops: record drums, bass, chords and a lead, and layer them.'),
  screen('metronome', 'Metronome', 'A steady click with an accent on beat one.', { panel: 'metronome' })
]
export const getActivity = (id) => ACTIVITIES.find((a) => a.id === id) || null
export const isExercise = (a) => !!a && a.kind === 'exercise'

/* ============================== tap tempo ============================== */
/** Beats per minute from tap times in ms: the last five taps, a gap over two seconds starts over. Null until two taps. */
export function tempoFromTaps(times) {
  const taps = []
  for (const t of times) {
    if (!Number.isFinite(t)) continue
    if (taps.length && t - taps[taps.length - 1] > 2000) taps.length = 0
    taps.push(t)
  }
  const last = taps.slice(-5)
  if (last.length < 2) return null
  const gap = (last[last.length - 1] - last[0]) / (last.length - 1)
  if (!(gap > 0)) return null
  return clamp(Math.round(60000 / gap), 40, 220)
}

/* ============================== stats ============================== */
export const emptyStats = () => ({ v: 1, items: {} })
const ID = /^[a-z][a-z0-9-]{0,31}$/
const cleanLevel = (n) => Number.isInteger(n) && n >= 1 && n <= MAX_LEVEL
const cleanEntry = (e) => {
  if (e === null || typeof e !== 'object' || Array.isArray(e)) return null
  const best = {}
  if (e.best && typeof e.best === 'object' && !Array.isArray(e.best)) {
    for (const [k, v] of Object.entries(e.best)) {
      const level = Number(k)
      if (cleanLevel(level) && String(level) === k && typeof v === 'number' && Number.isFinite(v)) best[k] = clamp(v, 0, 1)
    }
  }
  const plays = Number.isSafeInteger(e.plays) && e.plays >= 0 ? e.plays : Object.keys(best).length
  const lastLevel = cleanLevel(e.lastLevel) ? e.lastLevel : 1
  const lastAt = typeof e.lastAt === 'number' && Number.isFinite(e.lastAt) && e.lastAt >= 0 ? e.lastAt : 0
  return { plays, best, lastLevel, lastAt }
}

/** Stored text or value -> clean stats. Anything that is not stats gives empty stats; bad entries are dropped, bad fields repaired. */
export function parseStats(raw) {
  let v = raw
  if (typeof raw === 'string') { try { v = JSON.parse(raw) } catch { return emptyStats() } }
  if (v === null || typeof v !== 'object' || Array.isArray(v) || v.v !== 1 || v.items === null || typeof v.items !== 'object' || Array.isArray(v.items)) return emptyStats()
  const items = {}
  for (const [id, e] of Object.entries(v.items)) {
    if (!ID.test(id) || Object.keys(items).length >= 50) continue
    const c = cleanEntry(e)
    if (c) items[id] = c
  }
  return { v: 1, items }
}

const entryOf = (stats, id) => (stats && stats.items && Object.hasOwn(stats.items, id) ? stats.items[id] : null)

/** New stats after one finished round: plays, best accuracy at that level, last level and time. `result` is an accuracy 0..1 or { accuracy }. */
export function recordResult(stats, id, level, result, now) {
  const base = parseStats(stats)
  const acc = typeof result === 'number' ? result : result && result.accuracy
  if (!ID.test(String(id)) || !cleanLevel(level) || !Number.isFinite(acc) || !Number.isFinite(now)) return base
  const old = entryOf(base, id) || { plays: 0, best: {}, lastLevel: 1, lastAt: 0 }
  const a = clamp(acc, 0, 1)
  const key = String(level)
  const best = { ...old.best, [key]: Math.max(old.best[key] || 0, a) }
  return { v: 1, items: { ...base.items, [id]: { plays: old.plays + 1, best, lastLevel: level, lastAt: now } } }
}

/** New stats after an activity without a score (a screen) was opened: counts as a play and as the latest one. */
export function recordUse(stats, id, now) {
  const base = parseStats(stats)
  if (!ID.test(String(id)) || !Number.isFinite(now)) return base
  const old = entryOf(base, id) || { plays: 0, best: {}, lastLevel: 1, lastAt: 0 }
  return { v: 1, items: { ...base.items, [id]: { ...old, plays: old.plays + 1, lastAt: now } } }
}

/** The level to offer: the one last played, or one up when its best result is 0.9 or better, never above the activity's top level. */
export function suggestLevel(stats, id) {
  const a = getActivity(id)
  const top = a && a.levels > 0 ? a.levels : 1
  const e = entryOf(stats, id)
  if (!e) return 1
  const at = clamp(e.lastLevel, 1, top)
  return (e.best[String(at)] || 0) >= HARDER_AT ? Math.min(top, at + 1) : at
}

/** Best accuracy at a level, or null when it has not been played. */
export function bestAt(stats, id, level) {
  const e = entryOf(stats, id)
  return e && Object.hasOwn(e.best, String(level)) ? e.best[String(level)] : null
}

/** Ids of the n most recently used activities, newest first. */
export function recent(stats, n = 4) {
  const items = parseStats(stats).items
  return Object.keys(items).filter((id) => items[id].lastAt > 0).sort((x, y) => items[y].lastAt - items[x].lastAt || (x < y ? -1 : 1)).slice(0, Math.max(0, n))
}

/** The activities Home offers: the recent ones that still exist, then the defaults, up to n. */
export function railPicks(stats, n = 4) {
  const ids = []
  for (const id of recent(stats, ACTIVITIES.length)) if (getActivity(id) && !ids.includes(id)) ids.push(id)
  for (const id of DEFAULT_IDS) if (!ids.includes(id)) ids.push(id)
  return ids.slice(0, n).map(getActivity)
}
