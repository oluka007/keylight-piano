// Pure logic behind the course's four exercise types (echo, rhythm, ear, sight): patterns,
// questions, timing windows and grading. No DOM, storage, audio or clock, so it runs under node
// (scripts/test-course-exercises.js). exercise-ui.js does the showing and playing.
import { starsFor } from './course-engine.js'

export { starsFor }
export const pc = (p) => ((p % 12) + 12) % 12
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const sum = (a) => a.reduce((x, y) => x + y, 0)

/* ---------- seeded random numbers, so a test (or a retry of the same seed) sees the same line ---------- */
export function hashSeed(text) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const pick = (rand, list) => list[Math.floor(rand() * list.length) % list.length]
function shuffle(list, rand) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

/* ============================== echo ============================== */
export const ECHO_TRIES = 3
export const ECHO_RETRY_COST = 0.1       // each extra try on a round takes this much off its score
export const ECHO_DEFAULT_ROUNDS = 3

/** The pitches of an echo phrase in order (rests dropped), with their beat positions. */
export function echoPhrase(notes) {
  const out = []
  let beat = 0
  for (const n of notes) {
    if (n.p !== null && n.p !== undefined) out.push({ p: n.p, beat, beats: n.beats })
    beat += n.beats
  }
  return out
}

/**
 * The phrases a run asks for. The item has one phrase and `rounds` rounds: the phrase grows from its
 * first two notes to the whole thing, so the last round is always the phrase as written.
 */
export function echoRounds(params) {
  const phrase = echoPhrase(params.notes)
  const rounds = Math.max(1, Math.floor(params.rounds || ECHO_DEFAULT_ROUNDS))
  const len = phrase.length
  const start = Math.min(len, 2)
  const out = []
  for (let r = 0; r < rounds; r++) {
    const n = rounds === 1 ? len : Math.round(start + (len - start) * (r / (rounds - 1)))
    out.push(phrase.slice(0, clamp(n, 1, len)))
  }
  return out
}

/** One try: how much of the phrase was played back in order (longest common run of pitch names, any octave). */
export function echoTry(expected, played) {
  const a = expected.map((n) => pc(n.p ?? n)), b = played.map((p) => pc(p))
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])
  const right = a.map((v, i) => b[i] === v)   // which positions match as played, for colouring
  return { accuracy: a.length ? dp[a.length][b.length] / a.length : 0, right, exact: right.every(Boolean) && b.length === a.length }
}

/** A round's score: its best try, less ECHO_RETRY_COST for each try before it. */
export function echoRoundScore(tryAccuracies) {
  let best = 0
  tryAccuracies.forEach((acc, i) => { best = Math.max(best, acc - ECHO_RETRY_COST * i) })
  return clamp(best, 0, 1)
}
export const echoAccuracy = (roundScores) => (roundScores.length ? sum(roundScores) / roundScores.length : 0)

/* ============================== rhythm ============================== */
export const RHYTHM_CREDIT = { perfect: 1, good: 0.75, early: 0.4, late: 0.4, missed: 0 }
export const RHYTHM_EXTRA_COST = 0.25      // each tap that matches no note takes this much off one note's credit

export function parseTimeSignature(ts) {
  const m = /^(\d+)\s*\/\s*(\d+)$/.exec(ts || '4/4')
  const num = m ? Number(m[1]) : 4, den = m ? Number(m[2]) : 4
  return { num: num > 0 ? num : 4, den: den > 0 ? den : 4 }
}

/** Beats in one bar: the top number of the time signature (a beat is the note the lower number names, as the tempo says). */
export const beatsPerBar = (ts) => parseTimeSignature(ts).num

/**
 * Everything a rhythm run needs: where each note starts, and the timing windows that fit the pattern.
 * Times are ms from the first beat of the pattern (the count-in sits before, at negative times).
 */
export function rhythmPlan(params) {
  const beatMs = 60000 / params.tempo
  const bar = beatsPerBar(params.timeSignature)
  const cells = []
  let beat = 0
  for (const b of params.pattern) {
    const len = Math.abs(b)
    cells.push({ beat, beats: len, rest: b < 0, ms: beat * beatMs, durMs: len * beatMs })
    beat += len
  }
  const totalBeats = beat
  const onsets = cells.filter((c) => !c.rest)
  let gapMin = beatMs
  for (let i = 1; i < onsets.length; i++) gapMin = Math.min(gapMin, onsets[i].ms - onsets[i - 1].ms)
  // a window never reaches past half the gap to the next note, so one tap can only mean one note
  const edge = clamp(0.45 * gapMin, 60, 200)
  const good = Math.min(edge, Math.max(70, 0.6 * edge))
  const perfect = Math.min(good, Math.max(40, 0.3 * edge))
  return {
    beatMs, bar, cells, onsets, totalBeats, bars: Math.ceil(totalBeats / bar - 1e-9),
    countInBeats: bar, totalMs: totalBeats * beatMs, windows: { perfect, good, edge }
  }
}

/** Does the pattern fill whole bars of its time signature? (content check) */
export const rhythmFillsBars = (params) => {
  const bars = sum(params.pattern.map(Math.abs)) / beatsPerBar(params.timeSignature)
  return Math.abs(bars - Math.round(bars)) < 1e-9
}

/**
 * Judge a list of taps (ms from the first beat, count-in taps are negative) against the plan.
 * Every note takes the nearest free tap inside the edge window. Taps that match nothing count as extras.
 */
export function judgeRhythm(plan, taps) {
  const { perfect, good, edge } = plan.windows
  const live = taps.filter((t) => t >= -edge).sort((a, b) => a - b)
  const pairs = []
  plan.onsets.forEach((o, oi) => live.forEach((t, ti) => { const dt = t - o.ms; if (Math.abs(dt) <= edge) pairs.push({ oi, ti, dt }) }))
  pairs.sort((a, b) => Math.abs(a.dt) - Math.abs(b.dt) || a.oi - b.oi)
  const byOnset = new Array(plan.onsets.length).fill(null), usedTap = new Set()
  for (const p of pairs) {
    if (byOnset[p.oi] || usedTap.has(p.ti)) continue
    byOnset[p.oi] = p; usedTap.add(p.ti)
  }
  const counts = { perfect: 0, good: 0, early: 0, late: 0, missed: 0 }
  const results = plan.onsets.map((o, oi) => {
    const m = byOnset[oi]
    if (!m) { counts.missed++; return { onset: oi, kind: 'missed', tap: null, dt: null } }
    const a = Math.abs(m.dt)
    const kind = a <= perfect ? 'perfect' : a <= good ? 'good' : m.dt < 0 ? 'early' : 'late'
    counts[kind]++
    return { onset: oi, kind, tap: live[m.ti], dt: m.dt }
  })
  const extras = live.filter((_, i) => !usedTap.has(i))
  const credit = sum(results.map((r) => RHYTHM_CREDIT[r.kind])) - RHYTHM_EXTRA_COST * extras.length
  const accuracy = plan.onsets.length ? clamp(credit / plan.onsets.length, 0, 1) : 0
  return { results, extras, counts, accuracy }
}

/* ============================== ear training ============================== */
export const EAR_KINDS = ['higher-lower', 'same-different', 'step-skip', 'direction', 'interval', 'chord']
export const EAR_DEFAULT_ROUNDS = 8
export const INTERVAL_NAMES = {
  1: 'Minor 2nd', 2: 'Major 2nd', 3: 'Minor 3rd', 4: 'Major 3rd', 5: 'Perfect 4th', 6: 'Tritone', 7: 'Perfect 5th',
  8: 'Minor 6th', 9: 'Major 6th', 10: 'Minor 7th', 11: 'Major 7th', 12: 'Octave'
}
export const CHORD_QUALITIES = {
  major: { label: 'Major', notes: [0, 4, 7], why: 'A major chord is a root, a major third (4 semitones) and a perfect fifth (7). That wide third makes it sound bright.' },
  minor: { label: 'Minor', notes: [0, 3, 7], why: 'A minor chord has a minor third (3 semitones) above the root, one step narrower than major. That is what makes it sound darker.' },
  diminished: { label: 'Diminished', notes: [0, 3, 6], why: 'A diminished chord stacks two minor thirds (0, 3, 6), so the fifth is squeezed and the chord sounds tense.' },
  augmented: { label: 'Augmented', notes: [0, 4, 8], why: 'An augmented chord stacks two major thirds (0, 4, 8), so the fifth is stretched and the chord sounds unsettled.' },
  dominant7: { label: 'Dominant 7th', notes: [0, 4, 7, 10], why: 'A dominant seventh is a major chord with a minor seventh (10 semitones) added on top. It sounds like it wants to move on.' }
}
const MAJOR = [0, 2, 4, 5, 7, 9, 11]
const INTERVAL_WHY = {
  1: 'A minor 2nd is the smallest step on the keyboard: 1 semitone.', 2: 'A major 2nd is a whole tone: 2 semitones.',
  3: 'A minor 3rd is 3 semitones: it sounds sad or soft.', 4: 'A major 3rd is 4 semitones: it sounds bright and settled.',
  5: 'A perfect 4th is 5 semitones: open and steady, like the start of a wedding march.', 6: 'A tritone is 6 semitones, half an octave: tense and unsettled.',
  7: 'A perfect 5th is 7 semitones: hollow and strong.', 8: 'A minor 6th is 8 semitones: wistful.', 9: 'A major 6th is 9 semitones: warm and open.',
  10: 'A minor 7th is 10 semitones: bluesy.', 11: 'A major 7th is 11 semitones: dreamy, almost an octave.', 12: 'An octave is 12 semitones: the same note name, higher.'
}
const opt = (id, label) => ({ id, label })

function melodic(pitches, gap = 0.85, dur = 1.5) { return pitches.map((p, i) => ({ p, at: i * gap, dur })) }

/** One question of a kind. `want` is the answer id to build (so a set can be balanced); rand drives the rest. */
export function earQuestion(kind, want, rand, params = {}) {
  switch (kind) {
    case 'higher-lower': {
      const a = 55 + Math.floor(rand() * 13), d = 1 + Math.floor(rand() * 7)
      const b = want === 'higher' ? a + d : a - d
      return { kind, prompt: 'Is the second note higher or lower than the first?', options: [opt('higher', 'Higher'), opt('lower', 'Lower')], answer: want,
        notes: melodic([a, b]), why: want === 'higher' ? `The second note is ${d} semitone${d > 1 ? 's' : ''} up the keyboard, to the right of the first. Higher notes are to the right.` : `The second note is ${d} semitone${d > 1 ? 's' : ''} down the keyboard, to the left of the first. Lower notes are to the left.` }
    }
    case 'same-different': {
      const a = 55 + Math.floor(rand() * 13)
      const d = 1 + Math.floor(rand() * 4)
      const b = want === 'same' ? a : a + (rand() < 0.5 ? d : -d)
      return { kind, prompt: 'Are the two notes the same or different?', options: [opt('same', 'The same'), opt('different', 'Different')], answer: want,
        notes: melodic([a, b]), why: want === 'same' ? 'Both notes are the same key played twice.' : `The notes are ${d} semitone${d > 1 ? 's' : ''} apart, so they are different notes.` }
    }
    case 'step-skip': {
      const root = 55 + Math.floor(rand() * 8)
      const degree = Math.floor(rand() * 5)                    // a start inside the major scale, with room above
      const up = rand() < 0.5
      const scale = (d) => root + 12 * Math.floor(d / 7) + MAJOR[((d % 7) + 7) % 7]
      const from = degree + 2, to = from + (up ? 1 : -1) * (want === 'step' ? 1 : 2)
      const a = scale(from), b = scale(to)
      return { kind, prompt: 'Does the melody move by a step or a skip?', options: [opt('step', 'A step'), opt('skip', 'A skip')], answer: want,
        notes: melodic([a, b]), why: want === 'step' ? 'A step goes to the very next note of the scale (1 or 2 semitones). Next-door keys.' : 'A skip jumps over one note of the scale (3 or 4 semitones), landing two notes away.' }
    }
    case 'direction': {
      const root = 58 + Math.floor(rand() * 7)
      const s = (d) => root + 12 * Math.floor(d / 7) + MAJOR[((d % 7) + 7) % 7]
      const base = Math.floor(rand() * 3) + 1
      const shapes = { up: [0, 1, 2, 3], down: [3, 2, 1, 0], arch: [0, 2, 3, 1] }
      const label = { up: 'Going up', down: 'Going down', arch: 'Up, then down' }
      const pitches = shapes[want].map((d) => s(base + d))
      return { kind, prompt: 'Which way does the melody go?', options: ['up', 'down', 'arch'].map((id) => opt(id, label[id])), answer: want, notes: melodic(pitches, 0.7),
        why: want === 'up' ? 'Each note is higher than the one before, so the melody climbs.' : want === 'down' ? 'Each note is lower than the one before, so the melody falls.' : 'The melody climbs to its highest note and then drops back.' }
    }
    case 'interval': {
      const semis = Number(want)
      const up = rand() < 0.5
      const a = (up ? 52 : 52 + semis + 2) + Math.floor(rand() * 9)
      const b = up ? a + semis : a - semis
      const pool = (params.intervals && params.intervals.length ? params.intervals : DEFAULT_INTERVALS).slice().sort((x, y) => x - y)
      return { kind, prompt: 'Which interval do you hear?', options: pool.map((n) => opt(String(n), INTERVAL_NAMES[n])), answer: String(semis),
        notes: melodic([a, b], 0.95, 1.8), why: `${INTERVAL_WHY[semis]} The two notes are ${semis} semitones apart${up ? ', the second one higher' : ', the second one lower'}.` }
    }
    case 'chord': {
      const q = CHORD_QUALITIES[want]
      const root = 48 + Math.floor(rand() * 13)
      return { kind, prompt: 'What kind of chord is this?', options: chordPool(params).map((id) => opt(id, CHORD_QUALITIES[id].label)), answer: want,
        notes: q.notes.map((n) => ({ p: root + n, at: 0, dur: 2.2 })), why: q.why }
    }
    default: throw new Error('unknown ear kind ' + kind)
  }
}
export const DEFAULT_INTERVALS = [3, 4, 5, 7]
const chordPool = (params) => (params.qualities && params.qualities.length ? params.qualities : ['major', 'minor'])

/** The answer ids a kind chooses from. */
export function earAnswers(kind, params = {}) {
  switch (kind) {
    case 'higher-lower': return ['higher', 'lower']
    case 'same-different': return ['same', 'different']
    case 'step-skip': return ['step', 'skip']
    case 'direction': return ['up', 'down', 'arch']
    case 'interval': return (params.intervals && params.intervals.length ? params.intervals : DEFAULT_INTERVALS).map(String)
    case 'chord': return chordPool(params)
    default: throw new Error('unknown ear kind ' + kind)
  }
}

/** The questions for a run: answers come round in a shuffled, even order (a 10-question chord item has 5 of each). */
export function earSet(params, seed) {
  const rounds = Math.max(1, Math.floor(params.rounds || EAR_DEFAULT_ROUNDS))
  const rand = mulberry32(seed)
  const answers = earAnswers(params.kind, params)
  let order = []
  while (order.length < rounds) order = order.concat(shuffle(answers, rand))
  order = order.slice(0, rounds)
  // never the same answer three times running
  for (let i = 2; i < order.length; i++) if (order[i] === order[i - 1] && order[i] === order[i - 2]) { const j = order.findIndex((v, k) => k > i && v !== order[i]); if (j > 0) [order[i], order[j]] = [order[j], order[i]] }
  return order.map((a) => earQuestion(params.kind, a, rand, params))
}

/** What the notes of a question really are, worked out from the pitches alone (the test compares it with the answer and options). */
export function earTruth(q) {
  const ps = q.notes.map((n) => n.p)
  switch (q.kind) {
    case 'higher-lower': return ps[1] > ps[0] ? 'higher' : 'lower'
    case 'same-different': return ps[1] === ps[0] ? 'same' : 'different'
    case 'step-skip': return Math.abs(ps[1] - ps[0]) <= 2 ? 'step' : 'skip'
    case 'direction': {
      const d = ps.slice(1).map((p, i) => Math.sign(p - ps[i]))
      return d.every((x) => x > 0) ? 'up' : d.every((x) => x < 0) ? 'down' : 'arch'
    }
    case 'interval': return String(Math.abs(ps[1] - ps[0]))
    case 'chord': {
      const root = Math.min(...ps)
      const shape = ps.map((p) => p - root).sort((a, b) => a - b).join(',')
      return Object.keys(CHORD_QUALITIES).find((id) => CHORD_QUALITIES[id].notes.join(',') === shape) || null
    }
    default: return null
  }
}

export const earAccuracy = (right, asked) => (asked ? right / asked : 0)

/* ============================== sight reading ============================== */
export const SIGHT_BEATS_PER_BAR = 4
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11]
const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B']
const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F']

/** 'G', 'F#', 'Bb', 'Em': the key's tonic, mode, key signature and how each of its notes is spelled. Unknown names fall back to C major. */
export function parseKey(name) {
  const m = /^([A-Ga-g])([#b♯♭]?)(m|min|minor)?$/.exec(String(name || '').trim())
  const known = !!m
  const letter = known ? m[1].toUpperCase() : 'C'
  const acc = known ? (m[2] === '#' || m[2] === '♯' ? 1 : m[2] === 'b' || m[2] === '♭' ? -1 : 0) : 0
  const minor = known && !!m[3]
  const tonic = pc(LETTER_PC[LETTERS.indexOf(letter)] + acc)
  const majorPc = minor ? pc(tonic + 3) : tonic
  let fifths = (majorPc * 7) % 12
  if (fifths > 6) fifths -= 12
  if (fifths === 6 && acc < 0) fifths = -6
  const sig = {}
  const list = fifths >= 0 ? SHARP_ORDER.slice(0, fifths) : FLAT_ORDER.slice(0, -fifths)
  for (const l of list) sig[l] = fifths > 0 ? 1 : -1
  const steps = minor ? [0, 2, 3, 5, 7, 8, 10] : MAJOR
  const tonicLetter = LETTERS.indexOf(letter)
  const spell = {}     // pitch class -> { letter index, accidental offset shown by the key signature }
  steps.forEach((s, i) => {
    const li = (tonicLetter + i) % 7
    const natural = LETTER_PC[li]
    const off = pc(tonic + s) - natural
    spell[pc(tonic + s)] = { letter: li, off: off > 6 ? off - 12 : off < -6 ? off + 12 : off }
  })
  return { name: known ? name : 'C', known, tonic, minor, fifths, sig, steps, spell }
}

/** The staff position of a pitch spelled in a key: { step (diatonic, C4 = 35), accidental (-1, 0, 1 as written in the key signature) }. */
export function spellPitch(p, key) {
  const s = key.spell[pc(p)]
  if (!s) { const li = LETTER_PC.findIndex((x) => x === pc(p)); return { step: Math.floor(p / 12) * 7 + (li >= 0 ? li : LETTER_PC.findIndex((x) => x === pc(p - 1))), off: li >= 0 ? 0 : 1 } }
  const natural = p - s.off
  return { step: Math.floor(natural / 12) * 7 + s.letter, off: s.off }
}

/** Which clef a line is written in. */
export const sightClef = (params) => (params.hand === 'left' ? 'bass' : params.hand === 'right' ? 'treble' : (params.range[0] + params.range[1]) / 2 >= 57 ? 'treble' : 'bass')

/**
 * A line of quarter notes in 4/4 (`length` bars): scale notes of the key inside the range, mostly stepwise,
 * starting near the tonic and ending on it. Same params and seed give the same line.
 */
export function generateSight(params, seed) {
  const key = parseKey(params.key)
  const [lo, hi] = params.range
  const scale = []
  for (let p = lo; p <= hi; p++) if (key.steps.includes(pc(p - key.tonic))) scale.push(p)
  if (scale.length < 2) throw new Error('the range holds fewer than two notes of the key')
  const rand = mulberry32(seed)
  const count = Math.max(1, Math.floor(params.length)) * SIGHT_BEATS_PER_BAR
  const tonics = scale.map((p, i) => ({ p, i })).filter((x) => pc(x.p) === key.tonic)
  const mid = (scale.length - 1) / 2
  const startPool = tonics.length ? tonics : [{ p: scale[0], i: 0 }]
  let i = startPool.reduce((best, x) => (Math.abs(x.i - mid) < Math.abs(best.i - mid) ? x : best)).i
  const idx = [i]
  const moves = [-2, -1, -1, -1, 1, 1, 1, 2, -3, 3]
  for (let n = 1; n < count; n++) {
    let next = i
    for (let tries = 0; tries < 12; tries++) {
      const j = i + pick(rand, moves)
      if (j >= 0 && j < scale.length && j !== i) { next = j; break }
    }
    if (next === i) next = i + 1 < scale.length ? i + 1 : i - 1
    idx.push(next); i = next
  }
  // finish on the tonic nearest the last note, without repeating the note before it
  if (count > 2 && tonics.length) {
    const prev = idx.length - 2
    const near = tonics.filter((x) => x.i !== idx[prev]).sort((a, b) => Math.abs(a.i - i) - Math.abs(b.i - i))[0]
    if (near) idx[idx.length - 1] = near.i
    else {                                   // the only tonic is the note before: end on it, and step in from beside it
      const t = tonics[0].i
      const ok = (j) => j >= 0 && j < scale.length && (prev === 0 || idx[prev - 1] !== j)
      idx[idx.length - 1] = t
      idx[prev] = ok(t + 1) ? t + 1 : ok(t - 1) ? t - 1 : t + 2
    }
  }
  const notes = idx.map((k) => scale[k])
  return { notes, key, clef: sightClef(params), bars: Math.max(1, Math.floor(params.length)), beatsPerBar: SIGHT_BEATS_PER_BAR }
}

/** Notes right first time over the notes in the line; pace in notes a minute; stars from accuracy, the fifth star only for a steady pace. */
export const SIGHT_PACE_FOR_FIFTH_STAR = 30
export function gradeSight(total, firstTimeRight, seconds) {
  const accuracy = total ? firstTimeRight / total : 0
  const pace = seconds > 0 ? (total / seconds) * 60 : 0
  let stars = starsFor(accuracy)
  if (stars >= 5 && pace < SIGHT_PACE_FOR_FIFTH_STAR) stars = 4
  return { accuracy, pace, stars }
}

/** Stars for a run whose score is an accuracy (echo, rhythm, ear). */
export const starsForAccuracy = (accuracy) => starsFor(accuracy)
