// Course item runners: what the app can run today, and the pure helpers behind it.
// Nothing here touches the DOM or storage, so it loads under node. app.js does the playing
// (it owns the player, the keyboard and the results dialog); course-ui.js does the showing.
import { assignFingering } from '../fingering.js'
import { findLesson, findLevel } from './course-engine.js'

/** Item types the app can run. Every type the schema knows has a runner; a type from a newer course file that is not here shows as a quiet optional row. */
export const SUPPORTED = new Set(['five-finger', 'scale', 'arpeggio', 'chord', 'notegame', 'piece', 'theory', 'echo', 'rhythm', 'ear', 'sight'])
export const isRunnable = (item) => SUPPORTED.has(item.type)

/** Types that run in their own exercise screen (exercise-ui.js). */
export const EXERCISE_TYPES = new Set(['echo', 'rhythm', 'ear', 'sight'])

/** Types that play through the existing practice player (a toolbox exercise or a piece). */
export const PLAYER_TYPES = new Set(['five-finger', 'scale', 'arpeggio', 'chord', 'piece'])

export const TYPE_LABEL = {
  'five-finger': 'Five-finger pattern', scale: 'Scale', arpeggio: 'Arpeggio', chord: 'Chords', notegame: 'Note game',
  piece: 'Tune', echo: 'Echo', rhythm: 'Rhythm', ear: 'Ear training', sight: 'Sight reading', theory: 'Quiz'
}

/**
 * The engine's view of the course. Every shipped item type runs, so this returns the course
 * unchanged; an item of a type this app does not know (from a newer course file) is left out and
 * its lesson's pass count lowered, so no lesson waits on something that cannot be played.
 */
export function playableCourse(course, supported = SUPPORTED) {
  const keep = (items) => items.filter((it) => supported.has(it.type))
  return {
    levels: course.levels.map((level) => ({
      ...level,
      lessons: level.lessons.map((lesson) => {
        const items = keep(lesson.items)
        return { ...lesson, items, pass: { ...lesson.pass, minItemsDone: Math.max(1, Math.min(lesson.pass.minItemsDone, items.length)) } }
      }),
      exam: level.exam ? { ...level.exam, items: keep(level.exam.items) } : level.exam
    }))
  }
}

/** The lesson or exam that owns an item id's records: lesson ids for lessons, the exam id for exams. */
export function findOwner(course, ownerId) {
  const found = findLesson(course, ownerId)
  if (found) return { kind: 'lesson', level: found.level, lesson: found.lesson, items: found.lesson.items }
  for (const level of course.levels) if (level.exam && level.exam.id === ownerId) return { kind: 'exam', level, exam: level.exam, items: level.exam.items }
  return null
}
export { findLevel }

/** An inline piece (notes, or tracks for both hands) as the app's own song object, the way makeCadenceSong builds one. */
export function buildPieceSong(params, title = 'Course piece') {
  if (!params || !(params.tempo > 0)) throw new Error('a piece needs a tempo')
  const beat = 60 / params.tempo
  const notes = []
  let total = 0
  const lay = (list, hand) => {
    let t = 0
    for (const n of list) {
      if (n.p !== null && n.p !== undefined) notes.push({ pitch: n.p, start: t * beat, dur: n.beats * beat * 0.9, vel: 100, hand })
      t += n.beats
    }
    total = Math.max(total, t)
  }
  if (params.tracks) { lay(params.tracks.right, 'right'); lay(params.tracks.left, 'left') } else lay(params.notes, params.hand === 'left' ? 'left' : 'right')
  if (!notes.length) throw new Error('a piece needs at least one note')
  notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch)
  assignFingering(notes, { tempo: params.tempo })
  return { title, notes, windows: null, duration: total * beat, tempo: params.tempo, artist: 'Course' }
}

/** Which hands a piece uses: the filter the player starts with. */
export const pieceHand = (params) => (params.tracks ? 'both' : params.hand === 'left' ? 'left' : params.hand === 'right' ? 'right' : 'both')

/** The hands a player-run item needs: 'both', 'left' or 'right'. A run with Hands set to one side that is not this one is not a course pass. */
export function requiredHand(item) {
  const p = (item && item.params) || {}
  if (item && item.type === 'piece') return pieceHand(p)
  const h = p.tb && p.tb.hand
  return h === 'left' || h === 'right' ? h : 'both'
}

/** What a note game item asks for: { rounds, passAt }. A round is one right answer; wrong keys count against accuracy. */
export function noteGameAccuracy(rounds, right, wrong) {
  const asked = Math.max(rounds, right + wrong)
  return asked ? right / asked : 0
}

/** Short line for a row: what the learner must reach. */
export const passText = (item) => {
  const p = item.passAt || {}
  const parts = []
  if (p.accuracy !== undefined) parts.push(Math.round(p.accuracy * 100) + '%')
  else if (!p.stars) parts.push('80%')
  if (p.stars) parts.push(p.stars + (p.stars === 1 ? ' star' : ' stars'))
  return parts.join(' and ')
}
