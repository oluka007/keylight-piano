// Library discovery and the daily goal: pure helpers, no DOM and no storage, so the self-test can check them.

/** Daily practice goals offered in Settings, in minutes. */
export const GOAL_CHOICES = [5, 10, 15, 20, 30]
export const DEFAULT_GOAL = 10

/** A goal read from settings: one of the choices, or the default. */
export function cleanGoal(v) { return GOAL_CHOICES.includes(Number(v)) ? Number(v) : DEFAULT_GOAL }

/** Today's progress: whole minutes played, the goal, how full the ring is (0 to 1) and what is left. */
export function goalProgress(seconds, goalMin) {
  const goal = cleanGoal(goalMin)
  const secs = Math.max(0, Number(seconds) || 0)
  const mins = Math.floor(secs / 60)
  const frac = Math.min(1, secs / (goal * 60))
  return { mins, goal, frac, done: secs >= goal * 60, left: Math.max(0, goal - mins) }
}

/** True when this second of practice carried today past the goal (it was short of it a second ago). */
export function crossedGoal(secondsBefore, secondsAfter, goalMin) {
  const need = cleanGoal(goalMin) * 60
  return secondsBefore < need && secondsAfter >= need
}

// Names that are not people: they are not offered as composers
const NOT_COMPOSERS = new Set(['Exercise', 'Imported', 'Recording', ''])

/** The levels that songs actually have, easiest first (levelOrder is the app's own ordering). */
export function levelsPresent(songs, levelOrder) {
  const have = new Set(songs.map((s) => s.level).filter(Boolean))
  return levelOrder.filter((l) => have.has(l))
}

/** Composers (the song's artist) with their song counts: most songs first, then A to Z. */
export function composersOf(songs) {
  const n = new Map()
  for (const s of songs) { const a = s.artist; if (a && !NOT_COMPOSERS.has(a)) n.set(a, (n.get(a) || 0) + 1) }
  return [...n].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

/** A saved filter made safe: a level the library has and a composer that exists, else '' for each. */
export function cleanFilter(f, levels, composers) {
  const level = f && levels.includes(f.level) ? f.level : ''
  const composer = f && composers.some((c) => c.name === f.composer) ? f.composer : ''
  return { level, composer }
}

/** Keep the songs that pass the level and composer filter ('' means any). */
export function applyFilter(songs, f) {
  return songs.filter((s) => (!f.level || s.level === f.level) && (!f.composer || s.artist === f.composer))
}

/** "42 songs", "1 song", "No songs". */
export function countLabel(n) { return n === 0 ? 'No songs' : n === 1 ? '1 song' : n + ' songs' }
