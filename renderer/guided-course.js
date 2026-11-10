export const RATES = [0.6, 0.8, 1]
export const PASS = { wait: 0.8, timed: 0.85 }
const BARS_PER_PHRASE = 4
export const KEY = 'lumi.guided.'
export const HANDS = ['both', 'right', 'left']
export const HAND_NAME = { both: 'Both hands', right: 'Right hand', left: 'Left hand' }

export function readPrefs(store) {
  const mode = store.get(KEY + 'mode', 'wait')
  const hand = store.get(KEY + 'hand', 'both')
  const rate = Number(store.get(KEY + 'rate', 1))
  return { mode: mode === 'timed' ? 'timed' : 'wait', hand: HANDS.includes(hand) ? hand : 'both', rate: RATES.find((r) => Math.abs(r - rate) < 1e-3) || 1 }
}
export const songKey = (song) => String(song.file || song.importedId || song.title || 'song')
const clock = (t) => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0')

export function barGrid(song) {
  if (Array.isArray(song.bars) && song.bars.length > 1) return { starts: song.bars.slice(), estimated: false }
  const ts = song.timeSignature || {}
  const beats = (ts.beats || 4) * 4 / (ts.beatType || 4)
  const sec = Math.min(8, Math.max(1, (beats * 60) / (song.tempo || 120)))
  const count = Math.max(1, Math.ceil((song.duration - 1e-3) / sec))
  return { starts: Array.from({ length: count }, (_, i) => i * sec), estimated: true }
}
export function barAt(starts, t) {
  let i = 0
  while (i + 1 < starts.length && starts[i + 1] <= t + 1e-4) i++
  return i
}
export function spanLabel(song, grid, a, b) {
  if (grid.estimated && song.source === 'audio') return clock(grid.starts[a]) + '–' + clock(grid.starts[b + 1] ?? song.duration)
  const bars = a === b ? 'bar ' + (a + 1) : 'bars ' + (a + 1) + '–' + (b + 1)
  return grid.estimated ? 'About ' + bars : bars[0].toUpperCase() + bars.slice(1)
}
export function buildCourse(song, reach = () => true) {
  const grid = barGrid(song)
  const n = grid.starts.length
  const section = (key, label, from, to) => {
    const counts = { left: 0, right: 0 }
    for (const note of song.notes) {
      if (note.start < from - 1e-4 || (to != null && note.start >= to - 1e-4) || !reach(note)) continue
      counts[note.hand === 'left' ? 'left' : 'right']++
    }
    return { key, label, from, to, counts }
  }
  const sections = []
  for (let a = 0; a < n;) {
    let b = Math.min(n, a + BARS_PER_PHRASE) - 1
    if (n - 1 - b < 2) b = n - 1
    sections.push(section(`${a + 1}-${b + 1}`, spanLabel(song, grid, a, b), a === 0 ? 0 : grid.starts[a], b + 1 < n ? grid.starts[b + 1] : null))
    a = b + 1
  }
  const phrases = sections.filter((s) => s.counts.left + s.counts.right > 0)
  if (phrases.length > 1) phrases.push(section('all', 'Whole song', 0, null))
  return { grid, sections: phrases }
}
export function stepsFor(section, prefs) {
  const has = (h) => section.counts[h] > 0
  const final = prefs.hand !== 'both' ? prefs.hand : has('left') && has('right') ? 'both' : has('right') ? 'right' : 'left'
  if (final !== 'both' && !has(final)) return []
  const hands = final === 'both' ? ['right', 'left', 'both'] : [final]
  const steps = []
  if (prefs.mode === 'wait') for (const hand of hands) steps.push({ hand, mode: 'PRACTISE', rate: 1 })
  const rates = section.key === 'all' ? [prefs.rate] : RATES.filter((r) => r <= prefs.rate + 1e-3)
  for (const rate of rates) steps.push({ hand: final, mode: 'PLAY', rate })
  return steps.map((s) => ({ ...s, id: `${s.hand}.${s.mode}.${Math.round(s.rate * 100)}` }))
}
export function stepLabel(step) {
  return HAND_NAME[step.hand] + ' · ' + (step.mode === 'PRACTISE' ? 'Wait mode' : Math.round(step.rate * 100) + '% speed')
}
export function evaluateRun(step, player, summary) {
  const expected = player.score ? player.score.expected : []
  if (summary.mode === 'WATCH' || player.mode === 'WATCH') return { earned: false, passed: false, reason: 'watch' }
  if (!expected.length) return { earned: false, passed: false, reason: 'empty' }
  const sameTo = step.to == null ? player.endAt == null : Math.abs((player.endAt ?? -1) - step.to) < 1e-3
  const same = player.handFilter === step.hand && player.mode === step.mode && sameTo && Math.abs((player.sectionStart || 0) - step.from) < 1e-3
  if (!same) return { earned: false, passed: false, reason: 'changed' }
  const timed = step.mode === 'PLAY'
  const accuracy = timed ? summary.overallAccuracy : summary.firstTime
  const need = timed ? PASS.timed : PASS.wait
  const slow = Math.min(player.rate, timed ? player.minRate : Infinity) < step.rate - 1e-3
  return { earned: true, passed: !slow && accuracy >= need, slow, accuracy, need, notes: expected.length }
}
export function weakBars(expected, starts) {
  const bars = new Map()
  for (const e of expected) {
    const i = barAt(starts, e.start)
    const b = bars.get(i) || { bar: i, total: 0, weak: 0 }
    b.total++
    if (e.state !== 'hit' || e.kind === 'hinted' || e.kind === 'early' || e.kind === 'late' || e.wrong > 0) b.weak++
    bars.set(i, b)
  }
  const weak = [...bars.values()].filter((b) => b.weak > 0 && b.weak / b.total >= 0.34)
  return { covered: [...bars.keys()], weak: weak.sort((x, y) => y.weak / y.total - x.weak / x.total || x.bar - y.bar) }
}
