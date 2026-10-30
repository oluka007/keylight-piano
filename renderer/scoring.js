// Five-way judgement + star rating, aggregated as:
// {score, totalNotes, totalNotesHit, overallAccuracy, perfect, good, early,
//  late, missed, longestStreak, starRating}
// Notes found while the song waits (Practise) have no timing: they are 'cold' when
// found straight away and 'hinted' after a wrong key or a long look at the lit key,
// and a Practise run is rated by its share right first time.
import { COLORS } from './theme.js'

export const WINDOWS = {
  perfect: 0.040,   // +/- 40 ms
  good: 0.090,      // +/- 90 ms
  edge: 0.150       // early/late limit; beyond = missed
}

// Waiting longer than this on a note means the lit key showed you where it was.
export const HINT_AFTER = 1.5

const POINTS = { perfect: 100, good: 80, early: 55, late: 55, cold: 100, hinted: 40, missed: 0 }

export function createScore(notes) {
  return {
    total: notes.length,
    expected: notes.map((n) => ({ note: n, pitch: n.pitch, start: n.start, hand: n.hand, state: 'pending', wrong: 0 })),
    perfect: 0, good: 0, early: 0, late: 0, missed: 0, cold: 0, hinted: 0, wrong: 0,
    hits: 0, streak: 0, longestStreak: 0, points: 0,
    hands: { left: { hit: 0, miss: 0 }, right: { hit: 0, miss: 0 } }
  }
}

export function judgeHit(score, pitch, t) {
  let best = null, bestDt = Infinity
  for (const e of score.expected) {
    if (e.state !== 'pending' || e.pitch !== pitch) continue
    const dt = t - e.start
    if (Math.abs(dt) <= WINDOWS.edge && Math.abs(dt) < Math.abs(bestDt)) { best = e; bestDt = dt }
  }
  if (!best) return null
  best.state = 'hit'
  const a = Math.abs(bestDt)
  const kind = a <= WINDOWS.perfect ? 'perfect' : a <= WINDOWS.good ? 'good' : bestDt < 0 ? 'early' : 'late'
  best.kind = kind
  score[kind]++
  score.hits++
  score.points += POINTS[kind]
  score.streak++
  score.longestStreak = Math.max(score.longestStreak, score.streak)
  if (best.hand === 'left') score.hands.left.hit++; else score.hands.right.hit++
  return { kind, hand: best.hand, dt: bestDt }
}

// Wait-mode hit: the player found the right key while the song waited, so timing
// is not judged. `waited` is how long the song had been waiting (seconds): the
// note is right first time ('cold') unless a wrong key went down while its group
// waited or the wait ran past HINT_AFTER, then it needed the hint ('hinted').
export function markHit(score, note, waited = 0) {
  const e = score.expected.find((x) => x.note === note && x.state === 'pending')
  if (!e) return null
  const kind = e.wrong > 0 || waited > HINT_AFTER ? 'hinted' : 'cold'
  e.state = 'hit'
  e.kind = kind
  score[kind]++
  score.hits++
  score.points += POINTS[kind]
  // the streak counts notes you knew, so a hint ends it
  score.streak = kind === 'cold' ? score.streak + 1 : 0
  score.longestStreak = Math.max(score.longestStreak, score.streak)
  score.hands[e.hand === 'left' ? 'left' : 'right'].hit++
  return { kind, pitch: e.pitch, hand: e.hand, dt: 0 }
}

// A key the waiting group does not contain: counted per press, and every note of
// the group still to find will count as hinted.
export function markWrong(score, notes) {
  score.wrong++
  for (const e of score.expected) if (e.state === 'pending' && notes.includes(e.note)) e.wrong++
}

export function tickMisses(score, t) {
  const missedNow = []
  for (const e of score.expected) {
    if (e.state !== 'pending' || e.start + WINDOWS.edge >= t) continue
    e.state = 'missed'
    e.kind = 'missed'
    score.missed++
    score.streak = 0
    score.hands[e.hand === 'left' ? 'left' : 'right'].miss++
    missedNow.push(e)
  }
  return missedNow
}

// Rebuild for a new playable set (octave or hand change) while keeping every
// judgement already made on notes that are still playable.
export function carryOver(oldScore, notes) {
  const fresh = createScore(notes)
  if (!oldScore) return fresh
  const prev = new Map(oldScore.expected.map((e) => [e.note, e]))
  for (const e of fresh.expected) {
    const o = prev.get(e.note)
    if (!o) continue
    e.wrong = o.wrong || 0
    if (o.state === 'pending') continue
    e.state = o.state; e.kind = o.kind
    const h = fresh.hands[e.hand === 'left' ? 'left' : 'right']
    if (o.state === 'hit') { fresh[o.kind]++; fresh.hits++; fresh.points += POINTS[o.kind] || 0; h.hit++ }
    else if (o.state === 'missed') { fresh.missed++; h.miss++ }
  }
  fresh.streak = oldScore.streak
  fresh.longestStreak = oldScore.longestStreak
  fresh.wrong = oldScore.wrong || 0
  return fresh
}

// Put a judged note back to pending (a loop or a backwards seek replays it),
// taking its earlier judgement out of the totals so each note counts once.
export function resetExpected(score, e) {
  if (e.state === 'hit') {
    score[e.kind] = Math.max(0, score[e.kind] - 1)
    score.hits = Math.max(0, score.hits - 1)
    score.points = Math.max(0, score.points - (POINTS[e.kind] || 0))
    const h = score.hands[e.hand === 'left' ? 'left' : 'right']; h.hit = Math.max(0, h.hit - 1)
  } else if (e.state === 'missed') {
    score.missed = Math.max(0, score.missed - 1)
    const h = score.hands[e.hand === 'left' ? 'left' : 'right']; h.miss = Math.max(0, h.miss - 1)
  }
  e.state = 'pending'
  e.kind = null
  e.wrong = 0
}

// mode: the mode the run was played in. PRACTISE rates the share right first
// time (in time, or found with no hint). PLAY counts only notes played in time,
// so notes found while an earlier Practise stretch waited don't make a Challenge.
// Without a mode (the live HUD) a score with wait-mode notes reads as Practise.
export function summarize(score, mode) {
  // Notes skipped by seeking forward count as not played: skipping most of a
  // song must not earn stars.
  const skipped = score.expected.filter((e) => e.state === 'skipped').length
  const timed = score.perfect + score.good + score.early + score.late
  const waited = score.cold + score.hinted
  const judged = timed + waited + score.missed + skipped
  const practise = mode === 'PRACTISE' || (mode == null && waited > 0)
  const inTime = mode === 'PLAY'
  const hits = inTime ? timed : score.hits
  const firstTimeHits = timed + score.cold
  const firstTime = judged ? firstTimeHits / judged : 0
  const overallAccuracy = practise ? firstTime : judged ? hits / judged : 0
  const noteAccuracy = overallAccuracy
  const rhythmAccuracy = timed ? (score.perfect + score.good) / timed : 0
  const starRating = starsFor(overallAccuracy)
  return {
    score: Math.round(score.points),
    totalNotes: score.total,
    totalNotesHit: hits,
    overallAccuracy,
    perfect: score.perfect, good: score.good, early: score.early,
    late: score.late, missed: score.missed, skipped,
    cold: score.cold, hinted: score.hinted, wrong: score.wrong,
    firstTime, firstTimeHits,
    longestStreak: score.longestStreak,
    noteAccuracy,
    rhythmAccuracy,
    starRating,
    mode: mode || (practise ? 'PRACTISE' : null)
  }
}

export function starsFor(accuracy) {
  if (accuracy >= 0.995) return 5
  if (accuracy >= 0.95) return 4
  if (accuracy >= 0.85) return 3
  if (accuracy >= 0.70) return 2
  if (accuracy >= 0.50) return 1
  return 0
}

export function judgementColor(kind) {
  return COLORS.scoring[kind] || COLORS.scoring.missed
}
