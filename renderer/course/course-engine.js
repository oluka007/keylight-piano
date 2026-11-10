// Course progress logic. Pure: no DOM, no storage, no globals. Functions return new
// progress objects and never mutate their input. The app stores serializeProgress() text
// under one key (planned: 'lumi.course') and feeds it back through parseProgress().
//
// Progress: { version, lessons: { [lessonId]: { [itemId]: { accuracy, stars, tries, at } } },
//             exams: { [levelId]: { percent, passed, tries, at, placement } },
//             unlocked: number[]   // levels opened by skipping ahead
//             seconds: number }    // practice time reported by the runners

export const PROGRESS_VERSION = 1
export const DEFAULT_PASS_ACCURACY = 0.8
const STAR_AT = [0.5, 0.7, 0.85, 0.95, 0.995]   // same bars as scoring.js starsFor

const plain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
// Progress dictionaries are plain objects keyed by ids from stored data: these keys would reach Object.prototype
export const RESERVED_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
export const safeKey = (k) => typeof k === 'string' && k !== '' && !RESERVED_KEYS.has(k)
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k)
/** o[k] only when k is an own property (never something inherited from Object.prototype). */
export const ownGet = (o, k) => (o && own(o, k) ? o[k] : undefined)
export const starsFor = (accuracy) => STAR_AT.filter((a) => accuracy >= a).length

export const emptyProgress = () => ({ version: PROGRESS_VERSION, lessons: {}, exams: {}, unlocked: [], seconds: 0 })
const copy = (progress) => JSON.parse(JSON.stringify(progress))

// ---------- lookups ----------
export const findLevel = (course, ref) =>
  course.levels.find((l) => l.id === ref || l.number === ref) || null
export function findLesson(course, lessonId) {
  for (const level of course.levels) {
    const lesson = level.lessons.find((l) => l.id === lessonId)
    if (lesson) return { level, lesson }
  }
  return null
}
const isDraft = (level, lesson) => level.draft === true || lesson.draft === true

// ---------- items and lessons ----------
export function isItemDone(item, record, minStars = 0) {
  if (!record) return false
  const need = item.passAt || {}
  if (record.accuracy < (need.accuracy ?? (need.stars ? 0 : DEFAULT_PASS_ACCURACY))) return false
  if (need.stars && record.stars < need.stars) return false
  return record.stars >= minStars
}

/** Keeps the best accuracy and stars for an item; counts tries. Unknown lessons/items are stored too. */
export function recordItemResult(progress, lessonId, itemId, { accuracy, stars, at = Date.now(), seconds = 0 } = {}) {
  const acc = isNum(accuracy) ? clamp(accuracy, 0, 1) : 0
  const st = Number.isInteger(stars) ? clamp(stars, 0, 5) : starsFor(acc)
  const next = copy(progress)
  if (!safeKey(lessonId) || !safeKey(itemId)) return next          // a reserved id is never stored
  if (!own(next.lessons, lessonId)) next.lessons[lessonId] = {}
  const lesson = next.lessons[lessonId]
  const old = ownGet(lesson, itemId)
  lesson[itemId] = {
    accuracy: Math.max(old?.accuracy ?? 0, acc),
    stars: Math.max(old?.stars ?? 0, st),
    tries: (old?.tries ?? 0) + 1,
    at: isNum(at) ? at : Date.now()
  }
  if (isNum(seconds) && seconds > 0) next.seconds += seconds
  return next
}

export function isLessonDone(course, progress, lesson) {
  const found = findLesson(course, lesson.id)
  if (!found || isDraft(found.level, lesson)) return false
  const records = ownGet(progress.lessons, lesson.id) || {}
  const done = lesson.items.filter((it) => isItemDone(it, records[it.id], lesson.pass.minStars || 0)).length
  return done >= lesson.pass.minItemsDone
}

export const lessonItemStates = (progress, lesson) =>
  lesson.items.map((it) => { const rec = ownGet(ownGet(progress.lessons, lesson.id), it.id); return { id: it.id, done: isItemDone(it, rec, lesson.pass.minStars || 0), record: rec || null } })

// ---------- levels ----------
export function isLevelUnlocked(course, progress, levelRef) {
  const level = findLevel(course, levelRef)
  if (!level) return false
  if (level.number === 1 || progress.unlocked.includes(level.number)) return true
  const prev = course.levels[level.number - 2]
  return !!prev && ownGet(progress.exams, prev.id)?.passed === true
}

/** Skip ahead: opens level n and every level below it (a placement test result, or the learner's choice). */
export function unlockLevel(progress, n) {
  const next = copy(progress)
  for (let i = 2; i <= n; i++) if (!next.unlocked.includes(i)) next.unlocked.push(i)
  next.unlocked.sort((a, b) => a - b)
  return next
}

// Explicit unlocks allow early practice, but Guided order still waits for every
// earlier lesson and exam. A placement pass alone does not complete lessons.
function isLevelInOrder(course, progress, level) {
  return !level.draft && isLevelUnlocked(course, progress, level.number) &&
    course.levels.slice(0, course.levels.indexOf(level)).every((earlier) =>
      !earlier.draft && earlier.lessons.every((lesson) => isLessonDone(course, progress, lesson)) &&
      (!earlier.exam || ownGet(progress.exams, earlier.id)?.passed === true))
}

/**
 * 'done' once passed; 'open' for the recommended next lesson; 'ahead' for everything else (it comes after
 * something not finished yet). 'ahead' is advice, never a lock: any lesson can be opened and played.
 */
export function lessonStatus(course, progress, lessonId) {
  const found = findLesson(course, lessonId)
  if (!found) return 'ahead'
  const { level, lesson } = found
  if (isLessonDone(course, progress, lesson)) return 'done'
  if (isDraft(level, lesson) || !isLevelInOrder(course, progress, level)) return 'ahead'
  const i = level.lessons.indexOf(lesson)
  return level.lessons.slice(0, i).every((earlier) => isLessonDone(course, progress, earlier)) ? 'open' : 'ahead'
}

/** 'done' once the level exam is passed; 'open' when the level is the recommended place to be; otherwise 'ahead'. */
export function levelStatus(course, progress, levelRef) {
  const level = findLevel(course, levelRef)
  if (!level) return 'ahead'
  if (ownGet(progress.exams, level.id)?.passed === true) return 'done'
  return isLevelInOrder(course, progress, level) ? 'open' : 'ahead'
}

export function levelLessonsDone(course, progress, level) {
  return level.lessons.filter((l) => isLessonDone(course, progress, l)).length
}

/** 'done' once passed; 'open' when the level is open and all its lessons are done; 'ahead' otherwise; 'none' when there is no exam to take yet. */
export function examStatus(course, progress, levelRef) {
  const level = findLevel(course, levelRef)
  if (!level || !level.exam || level.draft) return 'none'
  if (ownGet(progress.exams, level.id)?.passed) return 'done'
  const ready = isLevelInOrder(course, progress, level) && levelLessonsDone(course, progress, level) === level.lessons.length
  return ready ? 'open' : 'ahead'
}

/** Overall percent across the exam's tasks plus the weakest task. taskPercents: 0-100 per item, in order. */
export function examScore(exam, taskPercents) {
  const tasks = exam.items.map((_, i) => clamp(isNum(taskPercents[i]) ? taskPercents[i] : 0, 0, 100))
  const percent = tasks.reduce((a, b) => a + b, 0) / tasks.length
  const weakest = Math.min(...tasks)
  return { percent, weakest, passed: percent >= exam.passPercent && weakest >= (exam.minTaskPercent ?? 0) }
}

/** Stores an exam attempt; a pass unlocks the next level. placement: true marks a test-out taken before finishing the lessons. */
export function recordExamResult(progress, levelId, { percent, passed, at = Date.now(), placement = false }) {
  const next = copy(progress)
  if (!safeKey(levelId)) return next
  const old = ownGet(next.exams, levelId)
  next.exams[levelId] = {
    percent: Math.max(old?.percent ?? 0, clamp(isNum(percent) ? percent : 0, 0, 100)),
    passed: !!(old?.passed || passed),
    tries: (old?.tries ?? 0) + 1,
    at: isNum(at) ? at : Date.now(),
    placement: !!(old?.placement || (passed && placement))
  }
  return next
}

// ---------- what to do next ----------
// The recommended next lesson is the one in state 'open'. Anything else that is not done is 'ahead': a lesson or
// level can still be opened early, and doing so never marks an earlier one as passed.
export function nextLesson(course, progress) {
  for (const level of course.levels) {
    if (!isLevelUnlocked(course, progress, level.number)) continue
    const lesson = level.lessons.find((l) => lessonStatus(course, progress, l.id) === 'open')
    if (lesson) return lesson
  }
  return null
}

/** { kind: 'lesson', level, lesson } | { kind: 'exam', level } | null when nothing is playable yet. */
export function nextStep(course, progress) {
  for (const level of course.levels) {
    if (!isLevelUnlocked(course, progress, level.number) || level.draft) continue
    const lesson = level.lessons.find((l) => lessonStatus(course, progress, l.id) === 'open')
    if (lesson) return { kind: 'lesson', level, lesson }
    if (examStatus(course, progress, level.number) === 'open') return { kind: 'exam', level }
  }
  return null
}

// ---------- summaries ----------
export function levelSummary(course, progress, levelRef) {
  const level = findLevel(course, levelRef)
  if (!level) return null
  const total = level.lessons.length
  const done = levelLessonsDone(course, progress, level)
  const playable = !level.draft
  return {
    id: level.id, number: level.number, total, done, playable,
    percent: total ? Math.round((done / total) * 100) : 0,
    unlocked: isLevelUnlocked(course, progress, level.number),
    status: levelStatus(course, progress, level.number),
    exam: examStatus(course, progress, level.number),
    minutesDone: level.lessons.filter((l) => isLessonDone(course, progress, l)).reduce((a, l) => a + l.minutes, 0)
  }
}

export function courseSummary(course, progress) {
  const levels = course.levels.map((l) => levelSummary(course, progress, l.id))
  const playable = levels.filter((l) => l.playable)
  const total = playable.reduce((a, l) => a + l.total, 0)
  const done = playable.reduce((a, l) => a + l.done, 0)
  return {
    levels, lessonsTotal: total, lessonsDone: done,
    percent: total ? Math.round((done / total) * 100) : 0,
    minutesPractised: Math.round(progress.seconds / 60),
    minutesDone: levels.reduce((a, l) => a + l.minutesDone, 0),
    examsPassed: Object.values(progress.exams).filter((e) => e.passed).length
  }
}

// ---------- storage ----------
export const serializeProgress = (progress) => JSON.stringify({ ...progress, version: PROGRESS_VERSION })

const goodRecord = (r) => plain(r) && isNum(r.accuracy) && isNum(r.stars) && isNum(r.tries) && isNum(r.at)

/** Accepts stored text or an object; anything corrupt is dropped, never thrown. Always returns a usable progress. */
export function parseProgress(raw) {
  let data = raw
  if (typeof raw === 'string') { try { data = JSON.parse(raw) } catch { return emptyProgress() } }
  if (!plain(data) || data.version !== PROGRESS_VERSION) return emptyProgress()   // a newer or unknown format is not guessed at
  const out = emptyProgress()
  if (plain(data.lessons)) {
    for (const [lessonId, items] of Object.entries(data.lessons)) {
      if (!safeKey(lessonId) || !plain(items)) continue
      for (const [itemId, r] of Object.entries(items)) {
        if (!safeKey(itemId) || !goodRecord(r)) continue
        if (!own(out.lessons, lessonId)) out.lessons[lessonId] = {}
        out.lessons[lessonId][itemId] = { accuracy: clamp(r.accuracy, 0, 1), stars: clamp(Math.trunc(r.stars), 0, 5), tries: Math.max(0, Math.trunc(r.tries)), at: r.at }
      }
    }
  }
  if (plain(data.exams)) {
    for (const [id, e] of Object.entries(data.exams)) {
      if (safeKey(id) && plain(e) && isNum(e.percent) && typeof e.passed === 'boolean' && isNum(e.tries) && isNum(e.at)) {
        out.exams[id] = { percent: clamp(e.percent, 0, 100), passed: e.passed, tries: Math.max(0, Math.trunc(e.tries)), at: e.at, placement: e.placement === true }
      }
    }
  }
  if (Array.isArray(data.unlocked)) out.unlocked = [...new Set(data.unlocked.filter((n) => Number.isInteger(n) && n >= 2 && n <= 99))].sort((a, b) => a - b)
  if (isNum(data.seconds) && data.seconds > 0) out.seconds = data.seconds
  return out
}
