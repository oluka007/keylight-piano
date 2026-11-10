// Unit test for the piano course (renderer/course/): node scripts/test-course.js
// Pure data and logic, no window, keyboard or sound.
const assert = require('node:assert/strict')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const load = (f) => import(pathToFileURL(path.join(__dirname, '..', 'renderer', 'course', f)).href)

;(async () => {
  const { COURSE } = await load('index.js')
  const schema = await load('course-schema.js')
  const E = await load('course-engine.js')
  const { seq } = await load('builders.js')
  const { validateCourse, wordCount, MAX_TEACH_WORDS } = schema
  const clone = (o) => JSON.parse(JSON.stringify(o))
  const [L1, L2, L3] = COURSE.levels
  const approx = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`)

  // ---------- the shipped course ----------
  assert.deepEqual(validateCourse(COURSE), [])
  const ids = []
  for (const level of COURSE.levels) {
    ids.push(level.id)
    if (level.exam) { ids.push(level.exam.id); level.exam.items.forEach((i) => ids.push(i.id)) }
    for (const lesson of level.lessons) {
      ids.push(lesson.id)
      assert.ok(lesson.goal && lesson.goal.length > 10, `${lesson.id} goal`)
      lesson.items.forEach((i) => ids.push(i.id))
      if (!level.draft) {
        assert.ok(lesson.teach.length > 0, `${lesson.id} teach`)
        for (const t of lesson.teach) assert.ok(wordCount(t) <= MAX_TEACH_WORDS, `${lesson.id}: paragraph of ${wordCount(t)} words`)
        assert.ok(!/\b(roli|lumi)\b/i.test(JSON.stringify(lesson)), `${lesson.id} names a brand`)
      }
    }
  }
  assert.equal(new Set(ids).size, ids.length, 'ids are unique')
  assert.ok(L1.lessons.length >= 7 && L2.lessons.length >= 7)
  assert.ok(L3.lessons.length >= 7 && L3.lessons.every((l) => l.items.length >= 3 && l.goal && l.teach.length >= 2))
  // 24-key levels stay inside two octaves of reachable notes per hand window
  for (const level of [L1, L2]) assert.equal(level.keys, 24)

  // ---------- builders ----------
  assert.deepEqual(seq('C4 D#4:0.5 r:2 Bb3'), [{ p: 60, beats: 1 }, { p: 63, beats: 0.5 }, { p: null, beats: 2 }, { p: 58, beats: 1 }])
  assert.throws(() => seq('H4'))

  // ---------- validator catches mistakes ----------
  const problems = (mutate) => { const c = clone(COURSE); mutate(c); return validateCourse(c) }
  assert.ok(validateCourse(null).length > 0)
  assert.ok(validateCourse({ levels: [] }).length > 0)
  assert.ok(problems((c) => { c.levels[0].lessons[0].teach[0] = 'word '.repeat(61) }).some((p) => /words/.test(p)))
  assert.ok(problems((c) => { c.levels[0].lessons[1].id = c.levels[0].lessons[0].id }).some((p) => /duplicate/.test(p)))
  assert.ok(problems((c) => { c.levels[1].number = 5 }).some((p) => /number/.test(p)))
  assert.ok(problems((c) => { c.levels[0].lessons[0].items[0].type = 'bogus' }).some((p) => /unknown item type/.test(p)))
  assert.ok(problems((c) => { c.levels[0].lessons[0].items[0].params.answer = 9 }).some((p) => /answer/.test(p)))
  assert.ok(problems((c) => { c.levels[0].lessons[0].pass.minItemsDone = 99 }).some((p) => /exceeds/.test(p)))
  assert.ok(problems((c) => { delete c.levels[0].lessons[0].goal }).some((p) => /goal/.test(p)))
  assert.ok(problems((c) => { delete c.levels[0].exam }).some((p) => /exam/.test(p)))
  assert.ok(problems((c) => { c.levels[1].lessons[7].items[1].params.tracks.left.pop() }).some((p) => /beats/.test(p)))
  assert.ok(problems((c) => { c.levels[0].lessons[4].items[2].params.notes[0].p = 200 }).some((p) => /MIDI/.test(p)))
  assert.ok(problems((c) => { c.levels[0].lessons[0].items[0].passAt = {} }).some((p) => /passAt/.test(p)))
  assert.ok(problems((c) => { c.levels[0].lessons[3].items[0].params.tb.type = 'nope' }).some((p) => /params\.tb/.test(p)))

  // ---------- progress and status ----------
  const lessonOf = (n, i) => COURSE.levels[n - 1].lessons[i]
  const passAll = (progress, lesson, accuracy = 1) => lesson.items.reduce((p, it) => E.recordItemResult(p, lesson.id, it.id, { accuracy, at: 1 }), progress)
  let prog = E.emptyProgress()
  assert.equal(prog.version, E.PROGRESS_VERSION)
  assert.equal(E.lessonStatus(COURSE, prog, L1.lessons[0].id), 'open')
  assert.equal(E.lessonStatus(COURSE, prog, L1.lessons[1].id), 'ahead')
  assert.equal(E.lessonStatus(COURSE, prog, L2.lessons[0].id), 'ahead')
  assert.equal(E.lessonStatus(COURSE, prog, L3.lessons[0].id), 'ahead')
  assert.equal(E.lessonStatus(COURSE, prog, 'no-such-lesson'), 'ahead')
  assert.equal(E.nextLesson(COURSE, prog).id, L1.lessons[0].id)

  // below the bar does not count; keeps the best result
  const first = L1.lessons[0]
  prog = E.recordItemResult(prog, first.id, first.items[0].id, { accuracy: 0.5 })
  assert.equal(E.lessonStatus(COURSE, prog, first.id), 'open')
  const frozen = JSON.stringify(prog)
  const prog2 = E.recordItemResult(prog, first.id, first.items[0].id, { accuracy: 1, stars: 5, at: 5 })
  assert.equal(JSON.stringify(prog), frozen, 'input is not mutated')
  const rec = prog2.lessons[first.id][first.items[0].id]
  assert.deepEqual([rec.accuracy, rec.stars, rec.tries, rec.at], [1, 5, 2, 5])
  const worse = E.recordItemResult(prog2, first.id, first.items[0].id, { accuracy: 0.2 })
  assert.equal(worse.lessons[first.id][first.items[0].id].accuracy, 1, 'best accuracy is kept')
  assert.equal(E.recordItemResult(prog, 'x', 'y', { accuracy: 7 }).lessons.x.y.accuracy, 1, 'accuracy clamps')
  assert.equal(E.recordItemResult(prog, 'x', 'y', { accuracy: 'bad' }).lessons.x.y.accuracy, 0)
  assert.equal(E.starsFor(0.3), 0); assert.equal(E.starsFor(0.7), 2); assert.equal(E.starsFor(1), 5)

  // a lesson is done once enough items pass
  prog = passAll(E.emptyProgress(), first)
  assert.equal(E.lessonStatus(COURSE, prog, first.id), 'done')
  assert.equal(E.lessonStatus(COURSE, prog, L1.lessons[1].id), 'open')
  assert.equal(E.nextLesson(COURSE, prog).id, L1.lessons[1].id)

  // out of order: finishing lesson 3 first leaves 1 open, 2 ahead and 3 done
  let ooo = passAll(E.emptyProgress(), L1.lessons[2])
  assert.equal(E.lessonStatus(COURSE, ooo, L1.lessons[2].id), 'done')
  assert.equal(E.lessonStatus(COURSE, ooo, L1.lessons[1].id), 'ahead')
  assert.equal(E.nextLesson(COURSE, ooo).id, L1.lessons[0].id)
  // Passing lesson 2 early must not make lesson 3 open across the unfinished 1.
  let secondEarly = passAll(E.emptyProgress(), L1.lessons[1])
  assert.deepEqual(L1.lessons.slice(0, 3).map((l) => E.lessonStatus(COURSE, secondEarly, l.id)), ['open', 'done', 'ahead'])
  assert.equal(E.nextLesson(COURSE, secondEarly).id, L1.lessons[0].id)
  assert.equal(E.nextStep(COURSE, secondEarly).lesson.id, L1.lessons[0].id)
  assert.equal(E.levelStatus(COURSE, secondEarly, 1), 'open')
  assert.equal(E.examStatus(COURSE, secondEarly, 1), 'ahead')
  for (const lesson of L1.lessons.slice(2)) secondEarly = passAll(secondEarly, lesson)
  assert.equal(E.examStatus(COURSE, secondEarly, 1), 'ahead', 'every lesson is required, including an earlier gap')
  secondEarly = passAll(secondEarly, L1.lessons[0])
  assert.equal(E.nextLesson(COURSE, secondEarly), null)
  assert.equal(E.nextStep(COURSE, secondEarly).kind, 'exam')
  assert.equal(E.examStatus(COURSE, secondEarly, 1), 'open')
  // results for unknown lessons are kept but harmless
  ooo = E.recordItemResult(ooo, 'old-lesson', 'old-item', { accuracy: 1 })
  assert.equal(E.lessonStatus(COURSE, ooo, 'old-lesson'), 'ahead')

  // minItemsDone and minStars
  const strict = { id: 'l1-strict', items: [{ id: 'a', passAt: { accuracy: 0.8 } }, { id: 'b', passAt: { accuracy: 0.8 } }], pass: { minItemsDone: 1, minStars: 3 } }
  const strictCourse = { levels: [{ ...L1, lessons: [strict] }] }
  let sp = E.recordItemResult(E.emptyProgress(), 'l1-strict', 'a', { accuracy: 0.9, stars: 2 })
  assert.equal(E.isLessonDone(strictCourse, sp, strict), false)
  sp = E.recordItemResult(sp, 'l1-strict', 'b', { accuracy: 0.9, stars: 3 })
  assert.equal(E.isLessonDone(strictCourse, sp, strict), true)
  assert.equal(E.isItemDone({ passAt: { stars: 4 } }, { accuracy: 1, stars: 3 }), false)
  assert.equal(E.isItemDone({ passAt: { accuracy: 0.8 } }, undefined), false)

  // ---------- levels and exams ----------
  let all = E.emptyProgress()
  for (const l of L1.lessons) all = passAll(all, l)
  assert.equal(E.examStatus(COURSE, all, 1), 'open')
  assert.equal(E.examStatus(COURSE, E.emptyProgress(), 1), 'ahead')
  assert.equal(E.examStatus(COURSE, all, 2), 'ahead')
  assert.equal(E.examStatus(COURSE, all, 3), 'ahead', 'a later level exam is ahead')
  const draftCourse = { levels: [{ ...L1, draft: true }] }
  assert.equal(E.examStatus(draftCourse, E.emptyProgress(), 1), 'none', 'a draft level has no exam to take')
  assert.equal(E.isLevelUnlocked(COURSE, all, 2), false, 'lessons alone do not open level 2')
  assert.equal(E.nextStep(COURSE, all).kind, 'exam')

  const score = E.examScore(L1.exam, [100, 100, 100, 100, 100, 0])
  approx(score.percent, 500 / 6); assert.equal(score.passed, false, 'a task under the floor fails')
  assert.equal(E.examScore(L1.exam, [90, 90, 90, 90, 90, 90]).passed, true)
  assert.equal(E.examScore(L1.exam, []).percent, 0)
  assert.equal(E.examScore(L1.exam, [70, 70, 70, 70, 70, 70]).passed, false, 'below the pass mark')

  let failed = E.recordExamResult(all, 'level-1', { percent: 60, passed: false, at: 2 })
  assert.equal(E.isLevelUnlocked(COURSE, failed, 2), false)
  assert.equal(E.examStatus(COURSE, failed, 1), 'open')
  const passed = E.recordExamResult(failed, 'level-1', { percent: 90, passed: true, at: 3 })
  assert.equal(passed.exams['level-1'].tries, 2)
  assert.equal(E.examStatus(COURSE, passed, 1), 'done')
  assert.equal(E.isLevelUnlocked(COURSE, passed, 2), true)
  assert.equal(E.lessonStatus(COURSE, passed, L2.lessons[0].id), 'open')
  assert.equal(E.nextLesson(COURSE, passed).id, L2.lessons[0].id)
  const later = E.recordExamResult(passed, 'level-1', { percent: 10, passed: false })
  assert.equal(later.exams['level-1'].passed, true, 'a pass is never lost'); assert.equal(later.exams['level-1'].percent, 90)

  // skip ahead
  const skipped = E.unlockLevel(E.emptyProgress(), 3)
  assert.deepEqual(skipped.unlocked, [2, 3])
  assert.equal(E.isLevelUnlocked(COURSE, skipped, 2), true)
  assert.equal(E.lessonStatus(COURSE, skipped, L2.lessons[0].id), 'ahead', 'an explicit unlock allows practice without changing Guided order')
  assert.equal(E.lessonStatus(COURSE, skipped, L2.lessons[1].id), 'ahead', 'lessons inside a level still go in order')
  assert.equal(E.lessonStatus(COURSE, skipped, L3.lessons[0].id), 'ahead', 'a skipped-to level still follows earlier levels in Guided order')
  assert.equal(E.lessonStatus(COURSE, skipped, L3.lessons[1].id), 'ahead')
  assert.equal(E.nextLesson(COURSE, skipped).id, L1.lessons[0].id)
  assert.equal(E.nextStep(COURSE, skipped).lesson.id, L1.lessons[0].id)
  assert.equal(E.levelStatus(COURSE, skipped, 2), 'ahead')
  assert.equal(E.levelStatus(COURSE, skipped, 3), 'ahead')
  let skippedReady = skipped
  for (const lesson of L2.lessons) skippedReady = passAll(skippedReady, lesson)
  assert.equal(E.examStatus(COURSE, skippedReady, 2), 'ahead', 'a later exam waits for earlier levels even with all its lessons done')
  assert.equal(E.nextStep(COURSE, skippedReady).lesson.id, L1.lessons[0].id)
  // An isolated later exam pass must not make the following level recommended.
  let laterPass = E.recordExamResult(E.emptyProgress(), L2.id, { percent: 100, passed: true })
  assert.equal(E.isLevelUnlocked(COURSE, laterPass, 3), true)
  assert.equal(E.levelStatus(COURSE, laterPass, 2), 'done')
  assert.equal(E.levelStatus(COURSE, laterPass, 3), 'ahead')
  assert.equal(E.lessonStatus(COURSE, laterPass, L3.lessons[0].id), 'ahead')
  for (const lesson of L3.lessons) laterPass = passAll(laterPass, lesson)
  assert.equal(E.examStatus(COURSE, laterPass, 3), 'ahead')
  assert.equal(E.nextLesson(COURSE, laterPass).id, L1.lessons[0].id)
  assert.equal(E.nextStep(COURSE, laterPass).lesson.id, L1.lessons[0].id)
  assert.equal(E.isLevelUnlocked(COURSE, E.emptyProgress(), 99), false)
  assert.equal(E.isLevelUnlocked(COURSE, E.emptyProgress(), 1), true)
  const placed = E.recordExamResult(E.emptyProgress(), 'level-1', { percent: 95, passed: true, placement: true })
  assert.equal(E.isLevelUnlocked(COURSE, placed, 2), true, 'a placement pass opens the next level')
  assert.equal(placed.exams['level-1'].placement, true)

  // ---------- ahead is advice, never a lock ----------
  const states = (progress, level) => level.lessons.map((l) => E.lessonStatus(COURSE, progress, l.id))
  const fresh0 = E.emptyProgress()
  assert.deepEqual(states(fresh0, L1), ['open', ...L1.lessons.slice(1).map(() => 'ahead')], 'fresh learner: one open, the rest ahead')
  assert.ok(states(fresh0, L2).every((x) => x === 'ahead'), 'a later level is all ahead')
  assert.ok(!COURSE.levels.some((lv) => states(fresh0, lv).includes('locked')), 'no lesson answers locked')
  assert.deepEqual([E.levelStatus(COURSE, fresh0, 1), E.levelStatus(COURSE, fresh0, 2), E.levelStatus(COURSE, fresh0, 42)], ['open', 'ahead', 'ahead'])
  assert.equal(E.levelSummary(COURSE, fresh0, 2).status, 'ahead')
  assert.equal(E.examStatus(COURSE, fresh0, 1), 'ahead', 'the exam comes after the lessons')

  // after passing one lesson the next one is the recommendation
  const one = passAll(fresh0, L1.lessons[0])
  assert.deepEqual(states(one, L1).slice(0, 3), ['done', 'open', 'ahead'])
  assert.equal(E.nextLesson(COURSE, one).id, L1.lessons[1].id)
  assert.equal(E.nextStep(COURSE, one).lesson.id, L1.lessons[1].id)

  // opening an ahead lesson and passing it marks nothing else
  const skipTo = L1.lessons[3]
  assert.equal(E.lessonStatus(COURSE, one, skipTo.id), 'ahead')
  const early = passAll(one, skipTo, 0.9)
  assert.equal(E.lessonStatus(COURSE, early, skipTo.id), 'done')
  assert.equal(E.lessonStatus(COURSE, early, L1.lessons[1].id), 'open', 'the skipped lessons are not passed')
  assert.equal(E.lessonStatus(COURSE, early, L1.lessons[2].id), 'ahead')
  assert.equal(E.isLessonDone(COURSE, early, L1.lessons[1]), false)
  assert.equal(E.isLessonDone(COURSE, early, L1.lessons[2]), false)
  assert.equal(E.levelLessonsDone(COURSE, early, L1), 2)
  assert.deepEqual(Object.keys(early.lessons).sort(), [L1.lessons[0].id, skipTo.id].sort(), 'only what was played has a record')
  assert.equal(E.nextLesson(COURSE, early).id, L1.lessons[1].id, 'Continue still points at the recommended lesson')
  assert.equal(E.nextStep(COURSE, early).lesson.id, L1.lessons[1].id)
  assert.equal(E.examStatus(COURSE, early, 1), 'ahead')
  assert.deepEqual(early.unlocked, [], 'opening early does not unlock a level')

  // levels: playing a later level early does not open it or pass the one before
  const lv2 = passAll(fresh0, L2.lessons[0])
  assert.equal(E.lessonStatus(COURSE, lv2, L2.lessons[0].id), 'done')
  assert.equal(E.isLevelUnlocked(COURSE, lv2, 2), false)
  assert.equal(E.levelStatus(COURSE, lv2, 2), 'ahead')
  assert.equal(E.levelStatus(COURSE, lv2, 1), 'open')
  assert.equal(E.nextLesson(COURSE, lv2).id, L1.lessons[0].id)
  assert.equal(E.nextStep(COURSE, lv2).lesson.id, L1.lessons[0].id)
  assert.equal(E.lessonStatus(COURSE, lv2, L2.lessons[1].id), 'ahead')
  // only a passed exam makes a level done and opens the next one
  assert.equal(E.levelStatus(COURSE, passed, 1), 'done')
  assert.equal(E.levelStatus(COURSE, passed, 2), 'open')
  assert.equal(E.levelStatus(COURSE, skipped, 3), 'ahead')

  // exam entry: ahead until the level's lessons are done, open after, done once passed; an exam taken early is a placement
  assert.equal(E.examStatus(COURSE, early, 1), 'ahead')
  assert.equal(E.examStatus(COURSE, all, 1), 'open')
  const placedEarly = E.recordExamResult(early, 'level-1', { percent: 92, passed: true, placement: true })
  assert.equal(E.examStatus(COURSE, placedEarly, 1), 'done')
  assert.equal(E.levelStatus(COURSE, placedEarly, 1), 'done')
  assert.equal(E.lessonStatus(COURSE, placedEarly, L1.lessons[1].id), 'open', 'a placement pass does not mark lessons passed')
  assert.equal(E.isLevelUnlocked(COURSE, placedEarly, 2), true)
  assert.equal(E.levelStatus(COURSE, placedEarly, 2), 'ahead', 'unfinished earlier lessons still determine Guided order after placement')
  assert.equal(E.lessonStatus(COURSE, placedEarly, L2.lessons[0].id), 'ahead')
  assert.equal(E.nextStep(COURSE, placedEarly).lesson.id, L1.lessons[1].id, 'unfinished lessons stay the recommendation')

  // finishing everything playable
  let full = E.emptyProgress()
  const playable = COURSE.levels.filter((lv) => !lv.draft && lv.exam)
  for (const level of playable) {
    for (const l of level.lessons) full = passAll(full, l)
    full = E.recordExamResult(full, level.id, { percent: 100, passed: true })
  }
  assert.equal(E.nextLesson(COURSE, full), null)
  assert.equal(E.nextStep(COURSE, full), null, 'draft levels offer nothing yet')
  const sum = E.courseSummary(COURSE, full)
  assert.equal(sum.percent, 100); assert.equal(sum.examsPassed, playable.length)
  assert.equal(sum.lessonsTotal, playable.reduce((n, lv) => n + lv.lessons.length, 0))

  // summaries
  const empty = E.courseSummary(COURSE, E.emptyProgress())
  assert.equal(empty.percent, 0); assert.equal(empty.minutesPractised, 0)
  const part = E.recordItemResult(E.emptyProgress(), 'x', 'y', { accuracy: 1, seconds: 125 })
  assert.equal(E.courseSummary(COURSE, part).minutesPractised, 2)
  const ls = E.levelSummary(COURSE, prog, 1)
  assert.deepEqual([ls.done, ls.total, ls.unlocked, ls.exam, ls.playable], [1, L1.lessons.length, true, 'ahead', true])
  assert.equal(ls.minutesDone, first.minutes)
  const lastLevel = COURSE.levels[COURSE.levels.length - 1]
  assert.equal(E.levelSummary(COURSE, prog, lastLevel.number).playable, !lastLevel.draft)
  assert.equal(E.levelSummary(COURSE, prog, 42), null)

  // ---------- serialization ----------
  const round = E.parseProgress(E.serializeProgress(E.unlockLevel(full, 3)))
  assert.deepEqual(round, E.unlockLevel(full, 3))
  assert.equal(JSON.parse(E.serializeProgress(prog)).version, E.PROGRESS_VERSION)
  const fresh = JSON.stringify(E.emptyProgress())
  for (const bad of [null, undefined, '', 'not json', '[]', '42', '{"version":99}', 7, [], '{"version":1,"lessons":5,"exams":"x","unlocked":"y","seconds":"z"}']) {
    assert.equal(JSON.stringify(E.parseProgress(bad)), fresh, `corrupt: ${String(bad)}`)
  }
  const dirty = E.parseProgress(JSON.stringify({
    version: 1, seconds: 30, unlocked: [3, 3, 'x', -4, 1.5, 2],
    lessons: { good: { a: { accuracy: 2, stars: 9, tries: 1.7, at: 5 }, b: { accuracy: 'x' }, c: null }, junk: 5 },
    exams: { 'level-1': { percent: 150, passed: true, tries: 1, at: 2 }, 'level-2': { percent: 1 } }
  }))
  assert.deepEqual(dirty.unlocked, [2, 3])
  assert.deepEqual(dirty.lessons, { good: { a: { accuracy: 1, stars: 5, tries: 1, at: 5 } } })
  assert.deepEqual(Object.keys(dirty.exams), ['level-1']); assert.equal(dirty.exams['level-1'].percent, 100)
  assert.equal(dirty.seconds, 30)

  // reserved keys never reach Object.prototype, in stored text or in recorded results
  const hostile = '{"version":1,"seconds":0,"unlocked":[],"lessons":{"__proto__":{"l1-find-c":{"accuracy":1,"stars":5,"tries":1,"at":1}},"constructor":{"x":{"accuracy":1,"stars":5,"tries":1,"at":1}},"l1":{"__proto__":{"accuracy":1,"stars":5,"tries":1,"at":1},"prototype":{"accuracy":1,"stars":5,"tries":1,"at":1},"ok":{"accuracy":1,"stars":5,"tries":1,"at":1}}},"exams":{"__proto__":{"percent":100,"passed":true,"tries":1,"at":1},"constructor":{"percent":100,"passed":true,"tries":1,"at":1}}}'
  const clean = E.parseProgress(hostile)
  assert.deepEqual(Object.keys(clean.lessons), ['l1'])
  assert.deepEqual(Object.keys(clean.lessons.l1), ['ok'])
  assert.deepEqual(Object.keys(clean.exams), [])
  assert.equal(Object.prototype['l1-find-c'], undefined)
  let hp = E.emptyProgress()
  for (const bad of ['__proto__', 'constructor', 'prototype']) {
    hp = E.recordItemResult(hp, bad, 'x', { accuracy: 1 })
    hp = E.recordItemResult(hp, 'l1-find-c', bad, { accuracy: 1 })
    hp = E.recordExamResult(hp, bad, { percent: 100, passed: true })
  }
  assert.deepEqual(hp, E.emptyProgress())
  hp = E.recordItemResult(hp, 'l1-find-c', 'a', { accuracy: 0.9, at: 5 })
  hp = E.recordItemResult(hp, 'l1-find-c', 'a', { accuracy: 0.5, at: 6 })
  assert.equal(hp.lessons['l1-find-c'].a.tries, 2)
  assert.equal(Object.prototype.a, undefined)
  assert.equal(E.ownGet(hp.lessons, 'constructor'), undefined)
  assert.equal(E.ownGet(hp.lessons, 'toString'), undefined)
  // serialize / parse stays round-trip compatible: same shape, version field
  const roundTrip = E.parseProgress(E.serializeProgress(hp))
  assert.deepEqual(roundTrip, hp)
  assert.equal(JSON.parse(E.serializeProgress(hp)).version, 1)
  const old = '{"version":1,"lessons":{"a":{"b":{"accuracy":0.8,"stars":2,"tries":3,"at":9}}},"exams":{"level-1":{"percent":90,"passed":true,"tries":1,"at":2,"placement":true}},"unlocked":[2],"seconds":61}'
  assert.equal(E.serializeProgress(E.parseProgress(old)), old)

  console.log('course: ok')
})().catch((e) => { console.error(e); process.exit(1) })
