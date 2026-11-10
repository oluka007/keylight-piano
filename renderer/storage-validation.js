// Shapes written by app.js and guided.js. Unknown settings remain forward compatible.
export const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
export const plain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const text = (v) => typeof v === 'string'
const bool = (v) => typeof v === 'boolean'
const positive = (v) => isNum(v) && v >= 0
const count = (v) => Number.isSafeInteger(v) && v >= 0
const stars = (v) => count(v) && v <= 5
const mapOf = (v, check) => plain(v) && Object.values(v).every(check)
// ids in the course dictionaries: a key that names Object.prototype members is never valid
const RESERVED = ['__proto__', 'constructor', 'prototype']
const idMap = (v, check) => plain(v) && Object.keys(v).every((k) => k !== '' && !RESERVED.includes(k)) && Object.values(v).every(check)
const point = (v) => plain(v) && isNum(v.x) && isNum(v.y)
// lumi.course: course/course-engine.js progress, { version, lessons: {lesson: {item: record}}, exams, unlocked, seconds }
const courseRecord = (r) => plain(r) && isNum(r.accuracy) && r.accuracy >= 0 && r.accuracy <= 1 && stars(r.stars) && count(r.tries) && isNum(r.at)
const courseExam = (e) => plain(e) && isNum(e.percent) && e.percent >= 0 && e.percent <= 100 && bool(e.passed) && count(e.tries) && isNum(e.at) && (e.placement === undefined || bool(e.placement))
const courseProgress = (v) => plain(v) && v.version === 1 && idMap(v.lessons, (items) => idMap(items, courseRecord)) && idMap(v.exams, courseExam) &&
  Array.isArray(v.unlocked) && v.unlocked.every((n) => Number.isInteger(n) && n >= 2 && n <= 99) && positive(v.seconds)
const step = (v) => plain(v) && bool(v.passed) && positive(v.best) && v.best <= 1 && count(v.tries)

const settingChecks = {
  brightness: isNum, volume: isNum, backingVolume: isNum, countIn: isNum, rate: isNum,
  bendRange: isNum, kbZero: isNum,
  metronome: bool, band: bool, accompany: bool, kbLightsSwap: bool, recordTakes: bool,
  sheet: bool, camMirror: bool, fingerCoaching: bool,
  labels: text, view: text, hands: text, waitMode: text, instrument: text, keyboardMode: text,
  fx: (v) => v === 'full' || v === 'lite',
  fingerSource: (v) => v === 'camera' || v === 'airwave',
  kbPort: text, kbLast: text, kbLightsLeft: text, userColor: text, audioOutput: text, camId: text,
  expression: (v) => v === null || bool(v),
  kbKeysFor: (v) => mapOf(v, (n) => [24, 48, 49].includes(n)),
  kbBaseFor: (v) => mapOf(v, isNum),
  kbPair: (v) => mapOf(v, (p) => plain(p) && (p.side === 0 || p.side === 1) && isNum(p.low)),
  airCalib: (v) => v === null || (plain(v) && [v.a, v.b].every((p) => plain(p) && isNum(p.x) && isNum(p.y) && isNum(p.z) && isNum(p.f)) && (v.lift === undefined || v.lift === 1 || v.lift === -1) && (v.n === undefined || Number.isInteger(v.n))),
  camCalib: (v) => v === null || (plain(v) && point(v.a) && point(v.b)),
  freeScale: (v) => plain(v) && isNum(v.root) && count(v.idx)
}

export function validStoredValue(key, value) {
  switch (key) {
    case 'lumi.settings':
      return plain(value) && Object.entries(value).every(([name, v]) =>
        !Object.hasOwn(settingChecks, name) || settingChecks[name](v))
    case 'lumi.days': return mapOf(value, positive)
    case 'lumi.course': return courseProgress(value)
    case 'lumi.recent':
      return Array.isArray(value) && value.every((v) => plain(v) && text(v.file) && positive(v.at))
    case 'lumi.streak.count': return count(value)
    case 'lumi.streak.last': return value === null || text(value)
    case 'lumi.onboarded': return bool(value)
    case 'lumi.audioSafeBuffer':
    case 'lumi.supportOfferSeen': return value === 1
    case 'lumi.guided.mode': return value === 'wait' || value === 'timed'
    case 'lumi.guided.hand': return ['both', 'right', 'left'].includes(value)
    case 'lumi.guided.rate': return [0.6, 0.8, 1].includes(value)
    default: break
  }
  if (key.startsWith('lumi.guided.progress.')) return mapOf(value, (section) => mapOf(section, step))
  if (key.startsWith('lumi.guided.weak.')) return mapOf(value, count)
  if (key.startsWith('lumi.guided.section.')) return value === null || text(value)
  if (/^lumi\.(fav|lessonwatched|lessonpractised)\./.test(key)) return bool(value)
  if (key.startsWith('lumi.exercise.') && key.endsWith('.bpm')) return positive(value)
  if (/^lumi\.(best|game|lesson|exercise)\./.test(key)) return stars(value)
  return true
}
