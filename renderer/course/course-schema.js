// Course data model and validator. Pure data + checks, no DOM, runs under node.
//
// A Course is { levels: Level[] }. Pitches are MIDI numbers (60 = middle C).
//
// Level   { id, number, title, grade, blurb, keys, lessons: Lesson[], exam?: Exam, draft? }
//   grade  approximate RCM/ABRSM text, e.g. 'RCM Prep A, pre-Initial'
//   keys   smallest keyboard that plays the whole level: 24 | 48 | 49 | 61 | 88
//   draft  true = structure only (titles and goals, no items yet); the UI shows it as "coming soon"
// Lesson  { id, title, minutes, goal, teach: string[], tip?, diagram?, items: Item[], pass, draft? }
//   teach  short original paragraphs, plain language, second person, at most MAX_TEACH_WORDS each
//   pass   { minItemsDone, minStars? }  the lesson is done when that many items are done
// Diagram { type: 'keys',  range: [lo, hi], highlight?: number[], names?: boolean, fingers?: {pitch: 1..5} }
//         | { type: 'staff', clef: 'treble'|'bass'|'grand', notes: [{ p, label? }] }
//         | { type: 'hands', hand: 'right'|'left'|'both', numbers?: boolean }
// Item    { id, title, type, params, passAt }   passAt: { accuracy?: 0..1, stars?: 1..5 }
// Exam    { id, title, items: Item[], passPercent, minTaskPercent? }   (overall and per-task floor)
//
// Item types                 status      params
//   five-finger|scale|arpeggio|chord   existing  { tb: { type, tonic, hand } }  -> app.js TB_TYPES
//   notegame                   existing    { game, rounds? }   game is a NOTE_GAMES id
//   piece                      existing/inline  { song, from?, to?, hand? }  (a file in renderer/songs)
//                                          or    { notes: [{ p, beats }], tempo, hand, timeSignature? }
//                                          or    { tracks: { right: notes, left: notes }, tempo }  (hands together, equal length)
//                                          p = MIDI pitch, or null for a rest
//   echo                       NEW (needs runner)  { notes: [{ p, beats }], tempo, hand, rounds? }
//   rhythm                     NEW  { pattern: number[], tempo, timeSignature? }  beats; negative = rest
//   ear                        NEW  { kind: 'higher-lower'|'same-different'|'step-skip'|'direction'|'interval'|'chord', rounds? }
//   sight                      NEW  { range: [lo, hi], hand, key, length }   length in bars
//   theory                     NEW  { q, options: string[], answer: index, why }
// 'five-finger'|'scale'|'arpeggio'|'chord' map onto TB_TYPES: five-finger -> five, scale -> scale|minor|harmonic,
// arpeggio -> chord|minorarp, chord -> cadence (params.tb.type holds the real TB_TYPES key).

export const MAX_TEACH_WORDS = 60
export const TB_KEYS = ['scale', 'minor', 'harmonic', 'five', 'chord', 'minorarp', 'cadence']
export const NOTE_GAME_IDS = ['find-the-key', 'read-treble', 'read-bass']
export const EAR_KINDS = ['higher-lower', 'same-different', 'step-skip', 'direction', 'interval', 'chord']
export const ITEM_TYPES = {
  'five-finger': { existing: true }, scale: { existing: true }, arpeggio: { existing: true }, chord: { existing: true },
  notegame: { existing: true }, piece: { existing: true },
  echo: { existing: false }, rhythm: { existing: false }, ear: { existing: false }, sight: { existing: false }, theory: { existing: false }
}
const HANDS = ['right', 'left', 'both']
const KEY_SIZES = [24, 48, 49, 61, 88]

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
const plain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const text = (v) => typeof v === 'string' && v.trim().length > 0
const pitch = (v) => Number.isInteger(v) && v >= 0 && v <= 127
export const wordCount = (s) => String(s).trim().split(/\s+/).filter(Boolean).length

function checkNotes(notes, at, bad) {
  if (!Array.isArray(notes) || notes.length === 0) return bad(at, 'notes must be a non-empty array')
  notes.forEach((n, i) => {
    if (!plain(n) || !(n.p === null || pitch(n.p)) || !(isNum(n.beats) && n.beats > 0)) bad(`${at}[${i}]`, 'needs p (MIDI or null for a rest) and beats > 0')
  })
}

function checkParams(item, at, bad) {
  const p = item.params
  if (!plain(p)) return bad(at, 'params must be an object')
  switch (item.type) {
    case 'five-finger': case 'scale': case 'arpeggio': case 'chord': {
      const tb = p.tb
      if (!plain(tb) || !TB_KEYS.includes(tb.type) || !(Number.isInteger(tb.tonic) && tb.tonic >= 0 && tb.tonic < 12) || !HANDS.includes(tb.hand)) bad(at, 'params.tb needs {type in TB_TYPES, tonic 0-11, hand}')
      break
    }
    case 'notegame':
      if (!NOTE_GAME_IDS.includes(p.game)) bad(at, `unknown note game "${p.game}"`)
      if (p.rounds !== undefined && !(Number.isInteger(p.rounds) && p.rounds > 0)) bad(at, 'rounds must be a positive integer')
      break
    case 'piece':
      if (p.tracks !== undefined) {
        if (!plain(p.tracks) || !HANDS.slice(0, 2).every((h) => Array.isArray(p.tracks[h]))) bad(at, 'tracks needs right and left note lists')
        else {
          for (const h of ['right', 'left']) checkNotes(p.tracks[h], `${at}.tracks.${h}`, bad)
          const len = (h) => p.tracks[h].reduce((a, n) => a + (isNum(n?.beats) ? n.beats : 0), 0)
          if (len('right') !== len('left')) bad(at, 'both tracks must last the same number of beats')
        }
        if (!(isNum(p.tempo) && p.tempo > 0)) bad(at, 'inline piece needs tempo')
      } else if (p.notes === undefined) { if (!text(p.song)) bad(at, 'piece needs params.song, params.notes or params.tracks') } else {
        checkNotes(p.notes, `${at}.notes`, bad)
        if (!(isNum(p.tempo) && p.tempo > 0)) bad(at, 'inline piece needs tempo')
        if (!HANDS.includes(p.hand)) bad(at, 'inline piece needs hand')
      }
      break
    case 'echo':
      checkNotes(p.notes, `${at}.notes`, bad)
      if (!(isNum(p.tempo) && p.tempo > 0) || !HANDS.includes(p.hand)) bad(at, 'echo needs tempo and hand')
      break
    case 'rhythm':
      if (!Array.isArray(p.pattern) || p.pattern.length === 0 || !p.pattern.every((b) => isNum(b) && b !== 0)) bad(at, 'pattern must be non-zero beat numbers (negative = rest)')
      if (!(isNum(p.tempo) && p.tempo > 0)) bad(at, 'rhythm needs tempo')
      break
    case 'ear':
      if (!EAR_KINDS.includes(p.kind)) bad(at, `unknown ear kind "${p.kind}"`)
      break
    case 'sight':
      if (!Array.isArray(p.range) || p.range.length !== 2 || !p.range.every(pitch) || p.range[0] >= p.range[1]) bad(at, 'sight needs range [lo, hi]')
      if (!HANDS.includes(p.hand) || !text(p.key) || !(Number.isInteger(p.length) && p.length > 0)) bad(at, 'sight needs hand, key, length')
      break
    case 'theory':
      if (!text(p.q) || !Array.isArray(p.options) || p.options.length < 2 || !p.options.every(text)) bad(at, 'theory needs q and 2+ options')
      else if (!(Number.isInteger(p.answer) && p.answer >= 0 && p.answer < p.options.length)) bad(at, 'theory answer must be an option index')
      if (!text(p.why)) bad(at, 'theory needs a why')
      break
    default: break
  }
}

function checkItem(item, at, bad, ids) {
  if (!plain(item)) return bad(at, 'item must be an object')
  if (!text(item.id)) bad(at, 'item needs an id')
  else if (ids.has(item.id)) bad(at, `duplicate id "${item.id}"`)
  else ids.add(item.id)
  if (!text(item.title)) bad(at, 'item needs a title')
  if (!Object.hasOwn(ITEM_TYPES, item.type)) return bad(at, `unknown item type "${item.type}"`)
  checkParams(item, at, bad)
  const pa = item.passAt
  if (!plain(pa) || (pa.accuracy === undefined && pa.stars === undefined)) bad(at, 'passAt needs accuracy and/or stars')
  else {
    if (pa.accuracy !== undefined && !(isNum(pa.accuracy) && pa.accuracy > 0 && pa.accuracy <= 1)) bad(at, 'passAt.accuracy must be in (0, 1]')
    if (pa.stars !== undefined && !(Number.isInteger(pa.stars) && pa.stars >= 1 && pa.stars <= 5)) bad(at, 'passAt.stars must be 1-5')
  }
}

function checkDiagram(d, at, bad) {
  if (!plain(d)) return bad(at, 'diagram must be an object')
  if (d.type === 'keys') {
    if (!Array.isArray(d.range) || d.range.length !== 2 || !d.range.every(pitch) || d.range[0] >= d.range[1]) bad(at, 'keys diagram needs range [lo, hi]')
  } else if (d.type === 'staff') {
    if (!['treble', 'bass', 'grand'].includes(d.clef) || !Array.isArray(d.notes) || !d.notes.every((n) => plain(n) && pitch(n.p))) bad(at, 'staff diagram needs clef and notes [{p}]')
  } else if (d.type === 'hands') {
    if (!HANDS.includes(d.hand)) bad(at, 'hands diagram needs hand')
  } else bad(at, `unknown diagram type "${d.type}"`)
}

function checkLesson(lesson, at, bad, ids, draftLevel) {
  if (!plain(lesson)) return bad(at, 'lesson must be an object')
  if (!text(lesson.id)) bad(at, 'lesson needs an id')
  else if (ids.has(lesson.id)) bad(at, `duplicate id "${lesson.id}"`)
  else ids.add(lesson.id)
  if (!text(lesson.title)) bad(at, 'lesson needs a title')
  if (!text(lesson.goal)) bad(at, 'lesson needs a goal')
  if (!(isNum(lesson.minutes) && lesson.minutes > 0)) bad(at, 'lesson needs minutes > 0')
  const draft = draftLevel || lesson.draft === true
  const teach = lesson.teach
  if (!Array.isArray(teach) || (!draft && teach.length === 0)) bad(at, 'lesson needs teach paragraphs')
  else teach.forEach((t, i) => {
    if (!text(t)) bad(`${at}.teach[${i}]`, 'empty paragraph')
    else if (wordCount(t) > MAX_TEACH_WORDS) bad(`${at}.teach[${i}]`, `${wordCount(t)} words, limit is ${MAX_TEACH_WORDS}`)
  })
  if (lesson.tip !== undefined && !text(lesson.tip)) bad(at, 'tip must be text')
  if (lesson.diagram !== undefined) checkDiagram(lesson.diagram, `${at}.diagram`, bad)
  if (!Array.isArray(lesson.items)) return bad(at, 'items must be an array')
  if (!draft && lesson.items.length === 0) bad(at, 'a non-draft lesson needs items')
  lesson.items.forEach((it, i) => checkItem(it, `${at}.items[${i}]`, bad, ids))
  const pass = lesson.pass
  if (!plain(pass) || !(Number.isInteger(pass.minItemsDone) && pass.minItemsDone >= 1)) bad(at, 'pass.minItemsDone must be an integer >= 1')
  else if (!draft && pass.minItemsDone > lesson.items.length) bad(at, 'pass.minItemsDone exceeds the number of items')
  if (plain(pass) && pass.minStars !== undefined && !(Number.isInteger(pass.minStars) && pass.minStars >= 1 && pass.minStars <= 5)) bad(at, 'pass.minStars must be 1-5')
}

function checkExam(exam, at, bad, ids) {
  if (!plain(exam)) return bad(at, 'exam must be an object')
  if (!text(exam.id)) bad(at, 'exam needs an id')
  else if (ids.has(exam.id)) bad(at, `duplicate id "${exam.id}"`)
  else ids.add(exam.id)
  if (!text(exam.title)) bad(at, 'exam needs a title')
  if (!(isNum(exam.passPercent) && exam.passPercent > 0 && exam.passPercent <= 100)) bad(at, 'exam.passPercent must be in (0, 100]')
  if (exam.minTaskPercent !== undefined && !(isNum(exam.minTaskPercent) && exam.minTaskPercent >= 0 && exam.minTaskPercent <= 100)) bad(at, 'exam.minTaskPercent must be 0-100')
  if (!Array.isArray(exam.items) || exam.items.length === 0) return bad(at, 'exam needs items')
  exam.items.forEach((it, i) => checkItem(it, `${at}.items[${i}]`, bad, ids))
}

/** Returns a list of problem strings; an empty list means the course is valid. */
export function validateCourse(course) {
  const problems = []
  const bad = (at, msg) => problems.push(`${at}: ${msg}`)
  if (!plain(course) || !Array.isArray(course.levels) || course.levels.length === 0) return ['course: needs a non-empty levels array']
  const ids = new Set()
  course.levels.forEach((level, i) => {
    const at = `level[${i}]`
    if (!plain(level)) return bad(at, 'level must be an object')
    if (!text(level.id)) bad(at, 'level needs an id')
    else if (ids.has(level.id)) bad(at, `duplicate id "${level.id}"`)
    else ids.add(level.id)
    if (level.number !== i + 1) bad(at, `number must be ${i + 1}`)
    for (const f of ['title', 'grade', 'blurb']) if (!text(level[f])) bad(at, `level needs ${f}`)
    if (!KEY_SIZES.includes(level.keys)) bad(at, `keys must be one of ${KEY_SIZES.join(', ')}`)
    if (!Array.isArray(level.lessons) || level.lessons.length === 0) return bad(at, 'level needs lessons')
    level.lessons.forEach((l, j) => checkLesson(l, `${at}.lesson[${j}]`, bad, ids, level.draft === true))
    if (level.exam === undefined) { if (level.draft !== true) bad(at, 'a non-draft level needs an exam') } else checkExam(level.exam, `${at}.exam`, bad, ids)
  })
  return problems
}
