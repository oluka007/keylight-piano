// Finger numbers for the notes: 1 = thumb ... 5 = little finger.
//
// assignFingering(notes, { tempo }) sets note.finger on every note that has none,
// hand by hand (fingering read from the score always stays and the guess works
// around it). Three layers, solved as one search per hand:
//  - Phrases: each hand's line is cut at rests of a beat or more, at leaps wider
//    than a sixth and at chords. A phrase that fits under five white keys is
//    played from one five-finger position, the textbook fingering of most first
//    tunes (Ode to Joy: 3 3 4 5 5 4 3 2 1 1 2 3 3 2 2).
//  - Longer phrases get the cheapest finger sequence (Viterbi over fingers 1-5),
//    with costs after Parncutt et al. (1997): spans outside the comfortable range
//    of the finger pair, one finger on two keys in a row, crossings other than the
//    thumb passing under 2-4 (or 2-4 over the thumb), thumb or fifth finger on a
//    black key, and a new finger on a repeated key. The left hand runs the same
//    model on mirrored intervals.
//  - Chords (one hand's notes starting together) go by rank, spread to fit the
//    chord: right hand lowest = 1 (C-E-G = 1 3 5), left hand lowest = 5.
// Between phrases the hand prefers to stay where it is, so a short phrase after a
// rest keeps the position it fits instead of jumping back to the thumb.

const CHORD_GAP = 0.03   // s: notes of one hand closer than this are one chord
const LEAP = 9           // semitones: a wider leap starts a new phrase
const SAME = 10          // one finger on two different keys in a row
const REPEAT = 2         // a new finger on a repeated key
const CROSS = 3          // each time the thumb passes under (or 2-4 over it)
const BAD_CROSS = 30     // any other crossing
const LEAP_CAP = 3       // on a leap the hand may jump, whatever the stretch
const MOVE = 0.3         // per white key the hand moves between phrases...
const MOVE_MAX = 3       // ...up to this many: past a hand's width a jump is a jump
const DRIFT = 0.02       // per white key moved, uncapped: the smaller jump wins a tie
const RANK = 0.3         // a chord whose lowest note is not 1 (right) or 5 (left)
const EDGE = 0.002       // no context: thumb on a short phrase's outer key (tie-break)
const SHIFT = 0.001      // inside a phrase, per change of hand position (tie-break)

const WHITE = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]
const BLACK = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0]
const pc = (p) => ((p % 12) + 12) % 12
const wIdx = (p) => Math.floor(p / 12) * 7 + WHITE[pc(p)]   // a black key counts as the white key below
const isBlack = (p) => BLACK[pc(p)] === 1
const valid = (f) => Number.isInteger(f) && f >= 1 && f <= 5

// Right hand, semitones from the lower-numbered finger's key up to the other's:
// practical min, comfortable min, relaxed min, relaxed max, comfortable max,
// practical max (Parncutt et al. 1997). Below zero the two fingers cross.
const SPANS = {
  12: [-5, -3, 1, 5, 8, 10], 13: [-4, -2, 3, 7, 10, 12], 14: [-3, -1, 5, 9, 12, 14], 15: [-1, 1, 7, 10, 13, 15],
  23: [1, 1, 1, 2, 3, 5], 24: [1, 1, 3, 4, 5, 7], 25: [2, 2, 5, 6, 8, 10],
  34: [1, 1, 1, 2, 2, 4], 35: [1, 1, 3, 4, 5, 7], 45: [1, 1, 1, 2, 3, 5]
}

function spanCost(lo, hi, x) {
  const [minP, minC, minR, maxR, maxC, maxP] = SPANS[lo * 10 + hi]
  const w = lo === 1 ? 1 : 2   // spans without the thumb are less forgiving
  let c = 0
  if (x < minC) c += 2 * (minC - x); else if (x > maxC) c += 2 * (x - maxC)
  if (x < minR) c += w * (minR - x); else if (x > maxR) c += w * (x - maxR)
  if (x < minP || x > maxP) c += 10
  return c
}

// Finger g on key q right after finger f on key p (pitches mirrored for the left
// hand; bp / bq: is the real key black).
function stepCost(f, p, g, q, bp, bq) {
  if (p === q) return f === g ? 0 : REPEAT
  if (f === g) return SAME
  const lo = f < g ? f : g, hi = f < g ? g : f
  const x = f < g ? q - p : p - q
  let c = 0
  if (x < 0) {
    if (lo !== 1 || hi === 5) return BAD_CROSS
    // a pass costs the same on a half or a whole step and more past that (a broken
    // C-E-G-C is 1 2 3 5, not 1 2 1 4), and more again where it stretches; on one
    // level it is plain, the thumb on black under a white key is not
    const [minP, minC] = SPANS[lo * 10 + hi]
    const tb = f === 1 ? bp : bq, ob = f === 1 ? bq : bp
    c += CROSS + (tb === ob ? 1 : tb ? 3 : 0)
    if (x < -2) c += 2 * (-2 - x)
    if (x < minC) c += 2 * (minC - x)
    if (x < minP) c += 10
  } else c += spanCost(lo, hi, x)
  if (bp !== bq) {
    // thumb or little finger on a black key next to a white one
    const onBlack = bq ? g : f
    if (onBlack === 1) c += 2; else if (onBlack === 5) c += 1
  }
  return c
}

// increasing finger sets of each size, for chords
const COMBOS = [[], [], [], [], [], []]
for (let mask = 1; mask < 32; mask++) {
  const set = [1, 2, 3, 4, 5].filter((f) => mask & (1 << (f - 1)))
  COMBOS[set.length].push(set)
}

function chordCands(keys, left) {
  const m = keys.length
  const w0 = wIdx(keys[0].pitch)
  const anchor = (fs) => (left ? w0 + fs[0] - 1 : w0 - fs[0] + 1)
  if (m > 5) {
    // more keys than fingers (two voices merged into one hand): spread by rank
    const fs = keys.map((_, r) => { const s = Math.round((r * 4) / (m - 1)); return left ? 5 - s : 1 + s })
    return [{ fs, cost: 0, anchor: anchor(fs) }]
  }
  let sets = COMBOS[m].map((s) => (left ? [...s].reverse() : s))
  const pinned = sets.filter((fs) => keys.every((k, i) => !k.pin || k.pin === fs[i]))
  if (pinned.length) sets = pinned
  return sets.map((fs) => {
    let cost = fs[0] === (left ? 5 : 1) ? 0 : RANK
    for (let i = 0; i < m; i++) if (isBlack(keys[i].pitch)) cost += fs[i] === 1 ? 1 : fs[i] === 5 ? 0.5 : 0
    for (let i = 0; i + 1 < m; i++) {
      const lo = Math.min(fs[i], fs[i + 1]), hi = Math.max(fs[i], fs[i + 1])
      cost += spanCost(lo, hi, keys[i + 1].pitch - keys[i].pitch)
      // tie-break: finger gaps that match the white-key gaps (C-E-G = 1 3 5, not 1 2 4)
      cost += 0.5 * Math.abs(hi - lo - (wIdx(keys[i + 1].pitch) - wIdx(keys[i].pitch)))
    }
    return { fs, cost, anchor: anchor(fs) }
  })
}

function singleCands(nd, left) {
  const key = nd.keys[0]
  const w = wIdx(key.pitch)
  const thumbOnBlack = isBlack(key.pitch) ? 1 : 0
  const cand = (f, extra) => ({ fs: [f], cost: (f === 1 ? thumbOnBlack : 0) + extra, anchor: left ? w + f - 1 : w - f + 1 })
  if (key.pin) return [cand(key.pin, 0)]
  if (nd.pos) {
    const out = []
    for (let a = nd.pos.from; a <= nd.pos.to; a++) out.push(cand(left ? a - w + 1 : w - a + 1, EDGE * Math.abs(a - nd.pos.edge)))
    return out
  }
  return [1, 2, 3, 4, 5].map((f) => cand(f, 0))
}

function fingerHand(list, left, beat) {
  list.sort((a, b) => a.start - b.start || a.pitch - b.pitch)
  // one node per onset: a single key, or a chord's distinct keys low to high
  const nodes = []
  for (let i = 0; i < list.length;) {
    let j = i + 1
    while (j < list.length && list[j].start - list[i].start < CHORD_GAP) j++
    const group = list.slice(i, j).sort((a, b) => a.pitch - b.pitch)
    const keys = []
    let end = 0
    for (const n of group) {
      end = Math.max(end, n.start + (n.dur || 0))
      let key = keys[keys.length - 1]
      if (!key || key.pitch !== n.pitch) keys.push(key = { pitch: n.pitch, notes: [], pin: 0 })
      key.notes.push(n)
      if (!key.pin && valid(n.finger)) key.pin = n.finger
    }
    nodes.push({ keys, start: list[i].start, end, pos: null })
    i = j
  }

  // why each node starts a new phrase (null: it carries on the last one)
  const brk = nodes.map((b, i) => {
    if (!i) return 'start'
    const a = nodes[i - 1]
    if (a.keys.length > 1 || b.keys.length > 1) return 'chord'
    if (b.start - a.end >= beat - 1e-3) return 'rest'
    if (Math.abs(b.keys[0].pitch - a.keys[0].pitch) > LEAP) return 'leap'
    return null
  })

  // phrases inside five white keys, with nothing authored and no key shared by a
  // sharp and its natural, are played from one hand position
  for (let i = 0; i < nodes.length;) {
    if (nodes[i].keys.length > 1) { i++; continue }
    let j = i + 1
    while (j < nodes.length && !brk[j]) j++
    let lo = Infinity, hi = -Infinity, ok = true
    for (let k = i; k < j; k++) {
      const p = nodes[k].keys[0].pitch, w = wIdx(p)
      if (w < lo) lo = w
      if (w > hi) hi = w
      if (nodes[k].keys[0].pin) ok = false
      if (k > i && nodes[k - 1].keys[0].pitch !== p && wIdx(nodes[k - 1].keys[0].pitch) === w) ok = false
    }
    if (ok && hi - lo <= 4) {
      // right hand: the thumb may sit anywhere from hi-4 to lo; left hand mirrored
      const pos = left ? { from: hi, to: lo + 4, edge: hi } : { from: hi - 4, to: lo, edge: lo }
      for (let k = i; k < j; k++) nodes[k].pos = pos
    }
    i = j
  }

  const cands = nodes.map((nd) => (nd.keys.length > 1 ? chordCands(nd.keys, left) : singleCands(nd, left)))
  const trans = (i, ca, cb) => {
    const d = Math.abs(ca.anchor - cb.anchor)
    const move = MOVE * Math.min(MOVE_MAX, d) + DRIFT * d
    const kind = brk[i]
    if (kind === 'chord' || kind === 'rest') return move
    const pa = nodes[i - 1].keys[0].pitch, pb = nodes[i].keys[0].pitch
    const step = stepCost(ca.fs[0], left ? -pa : pa, cb.fs[0], left ? -pb : pb, isBlack(pa), isBlack(pb))
    if (kind === 'leap') return Math.min(step, LEAP_CAP) + move
    if (nodes[i].pos) return ca.anchor === cb.anchor ? 0 : Infinity   // a five-finger position holds still
    // of two equal fingerings, the one that moves the hand less often (G5 E3 C1, not G4 E2 C1 D2)
    return ca.anchor === cb.anchor ? step : step + SHIFT
  }

  // Viterbi: the cheapest fingering of the whole line
  let cost = cands[0].map((c) => c.cost)
  const back = [null]
  for (let i = 1; i < nodes.length; i++) {
    const prev = cands[i - 1], cur = cands[i]
    const next = new Array(cur.length)
    const from = new Array(cur.length)
    for (let b = 0; b < cur.length; b++) {
      let best = Infinity, arg = 0
      for (let a = 0; a < prev.length; a++) {
        const c = cost[a] + trans(i, prev[a], cur[b])
        if (c < best) { best = c; arg = a }
      }
      next[b] = best + cur[b].cost
      from[b] = arg
    }
    back.push(from)
    cost = next
  }
  let pick = 0
  for (let b = 1; b < cost.length; b++) if (cost[b] < cost[pick]) pick = b
  for (let i = nodes.length - 1; i >= 0; i--) {
    const fs = cands[i][pick].fs
    nodes[i].keys.forEach((key, k) => { for (const n of key.notes) if (!valid(n.finger)) n.finger = fs[k] })
    if (i) pick = back[i][pick]
  }
}

// opts: { tempo } in bpm (how long a rest must be to end a phrase), or { beat } in seconds
export function assignFingering(notes, opts = {}) {
  if (!Array.isArray(notes) || !notes.length) return notes
  const beat = opts.beat > 0 ? opts.beat : 60 / (opts.tempo > 0 ? opts.tempo : 120)
  const right = [], left = []
  for (const n of notes) {
    if (!n || !Number.isFinite(n.pitch) || !Number.isFinite(n.start)) continue
    ;(n.hand === 'left' ? left : right).push(n)
  }
  if (right.length) fingerHand(right, false, beat)
  if (left.length) fingerHand(left, true, beat)
  return notes
}
