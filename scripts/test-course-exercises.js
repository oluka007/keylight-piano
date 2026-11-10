// Unit test for the course's four exercise types (echo, rhythm, ear, sight): renderer/course/exercise-logic.js
// and how the real course content feeds it. Pure logic, no window or sound: node scripts/test-course-exercises.js
const assert = require('node:assert/strict')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const load = (f) => import(pathToFileURL(path.join(__dirname, '..', 'renderer', 'course', f)).href)

;(async () => {
  const L = await load('exercise-logic.js')
  const { seq } = await load('builders.js')
  const E = await load('course-engine.js')
  const R = await load('runners.js')
  const approx = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`)
  const warnings = []

  /* ---------- random numbers ---------- */
  assert.equal(L.hashSeed('abc'), L.hashSeed('abc'))
  assert.notEqual(L.hashSeed('abc'), L.hashSeed('abd'))
  const r1 = L.mulberry32(7), r2 = L.mulberry32(7)
  for (let i = 0; i < 5; i++) { const v = r1(); assert.equal(v, r2()); assert.ok(v >= 0 && v < 1) }

  /* ---------- echo ---------- */
  const phrase = L.echoPhrase(seq('C4 D4 r:1 E4 F4:2'))
  assert.deepEqual(phrase.map((n) => n.p), [60, 62, 64, 65])
  assert.deepEqual(phrase.map((n) => n.beat), [0, 1, 3, 4])
  const lens = (rounds, n) => L.echoRounds({ notes: seq(Array(n).fill('C4').join(' ')), rounds }).map((r) => r.length)
  assert.deepEqual(lens(3, 4), [2, 3, 4])
  assert.deepEqual(lens(4, 4), [2, 3, 3, 4])
  assert.deepEqual(lens(4, 6), [2, 3, 5, 6])
  assert.deepEqual(lens(1, 5), [5])
  assert.deepEqual(lens(undefined, 5).length, L.ECHO_DEFAULT_ROUNDS)
  assert.deepEqual(lens(3, 1), [1, 1, 1])
  const exp = L.echoPhrase(seq('C4 D4 E4 D4'))
  approx(L.echoTry(exp, [60, 62, 64, 62]).accuracy, 1)
  assert.equal(L.echoTry(exp, [60, 62, 64, 62]).exact, true)
  approx(L.echoTry(exp, [72, 74, 76, 74]).accuracy, 1)            // any octave counts
  approx(L.echoTry(exp, [60, 62, 65, 62]).accuracy, 0.75)         // one wrong note
  approx(L.echoTry(exp, [62, 64, 62]).accuracy, 0.75)             // a missed first note: the rest is still in order
  approx(L.echoTry(exp, [64, 62, 60, 62]).accuracy, 0.5)
  approx(L.echoTry(exp, []).accuracy, 0)
  assert.deepEqual(L.echoTry(exp, [60, 62, 65, 62]).right, [true, true, false, true])
  approx(L.echoRoundScore([1]), 1)
  approx(L.echoRoundScore([0.5, 1]), 0.9)                          // right on the second try costs a little
  approx(L.echoRoundScore([0.25, 0.5, 1]), 0.8)
  approx(L.echoRoundScore([0.5, 0.5, 0.5]), 0.5)
  approx(L.echoRoundScore([]), 0)
  approx(L.echoAccuracy([1, 0.9, 0.8]), 0.9)

  /* ---------- rhythm ---------- */
  const plan = L.rhythmPlan({ pattern: [1, 1, 2], tempo: 60, timeSignature: '4/4' })
  assert.equal(plan.beatMs, 1000)
  assert.deepEqual(plan.onsets.map((o) => o.ms), [0, 1000, 2000])
  assert.equal(plan.totalBeats, 4); assert.equal(plan.bars, 1); assert.equal(plan.countInBeats, 4)
  const withRests = L.rhythmPlan({ pattern: [1, -1, 2, -2], tempo: 120, timeSignature: '4/4' })
  assert.deepEqual(withRests.onsets.map((o) => o.beat), [0, 2])      // rests give no onset
  assert.equal(withRests.cells.length, 4)
  assert.equal(L.rhythmPlan({ pattern: [1, 1, 1], tempo: 80, timeSignature: '3/4' }).countInBeats, 3)
  assert.equal(L.parseTimeSignature(undefined).num, 4)
  assert.ok(L.rhythmFillsBars({ pattern: [1, 1, 2], timeSignature: '4/4' }))
  assert.ok(!L.rhythmFillsBars({ pattern: [1, 1, 1], timeSignature: '4/4' }))
  // the windows never reach past half the gap between notes
  for (const params of [{ pattern: [0.25, 0.25, 0.25, 0.25, 1], tempo: 72 }, { pattern: [1, 1, 2], tempo: 60 }, { pattern: [0.5, 0.5, 1], tempo: 120 }]) {
    const p = L.rhythmPlan(params)
    const gap = Math.min(...p.onsets.slice(1).map((o, i) => o.ms - p.onsets[i].ms))
    assert.ok(p.windows.edge <= gap / 2 + 1e-9 || p.windows.edge <= 60, 'edge ' + p.windows.edge + ' gap ' + gap)
    assert.ok(p.windows.perfect <= p.windows.good && p.windows.good <= p.windows.edge)
  }
  const exact = [0, 1000, 2000]
  let j = L.judgeRhythm(plan, exact)
  assert.equal(j.accuracy, 1); assert.deepEqual(j.results.map((r) => r.kind), ['perfect', 'perfect', 'perfect']); assert.equal(j.extras.length, 0)
  j = L.judgeRhythm(plan, [20, 1030, 1990])
  assert.equal(j.accuracy, 1)                                       // within the perfect window
  const w = plan.windows
  j = L.judgeRhythm(plan, [0, 1000 + (w.good - 1), 2000 - (w.edge - 1)])
  assert.deepEqual(j.results.map((r) => r.kind), ['perfect', 'good', 'early'])
  approx(j.accuracy, (1 + 0.75 + 0.4) / 3)
  j = L.judgeRhythm(plan, [0, 1000, 2000 + (w.edge - 1)])
  assert.equal(j.results[2].kind, 'late')
  j = L.judgeRhythm(plan, [0, 1000])                                // a missed note
  assert.equal(j.results[2].kind, 'missed'); approx(j.accuracy, 2 / 3); assert.equal(j.counts.missed, 1)
  j = L.judgeRhythm(plan, [0, 500, 1000, 2000])                     // an extra tap costs
  assert.equal(j.extras.length, 1); approx(j.accuracy, (3 - L.RHYTHM_EXTRA_COST) / 3)
  j = L.judgeRhythm(plan, [-3000, -2000, 0, 1000, 2000])            // count-in taps are not counted against you
  assert.equal(j.accuracy, 1)
  j = L.judgeRhythm(plan, [])
  assert.equal(j.accuracy, 0)
  j = L.judgeRhythm(plan, [0, 0, 0, 0, 0, 0, 0, 0])                 // mashing never beats playing it
  assert.ok(j.accuracy < 0.4)
  // one tap meets one note only, even when two notes are close
  const quick = L.rhythmPlan({ pattern: [0.5, 0.5, 1], tempo: 120, timeSignature: '4/4' })
  j = L.judgeRhythm(quick, [250])
  assert.equal(j.results.filter((r) => r.tap !== null).length, 1)

  /* ---------- ear: every question matches its options ---------- */
  const rand = L.mulberry32(11)
  for (const kind of L.EAR_KINDS) {
    const answers = L.earAnswers(kind)
    for (let n = 0; n < 40; n++) {
      const want = answers[n % answers.length]
      const q = L.earQuestion(kind, want, rand)
      assert.equal(q.answer, want)
      assert.ok(q.options.some((o) => o.id === q.answer), kind + ' answer is an option')
      assert.equal(new Set(q.options.map((o) => o.id)).size, q.options.length)
      assert.equal(L.earTruth(q), q.answer, `${kind}: the notes say ${L.earTruth(q)}, the answer says ${q.answer}`)
      assert.ok(q.why.length > 15)
      assert.ok(q.notes.every((x) => x.p >= 36 && x.p <= 84 && x.dur > 0 && x.at >= 0))
    }
  }
  // the facts a teacher would check
  const one = (kind, want, params) => L.earQuestion(kind, want, L.mulberry32(3), params)
  assert.equal(one('interval', '4').notes.map((n) => n.p).reduce((a, b) => Math.abs(b - a)), 4)
  assert.equal(Math.abs(one('interval', '7').notes[1].p - one('interval', '7').notes[0].p), 7)
  assert.deepEqual(one('chord', 'major').notes.map((n) => n.p - one('chord', 'major').notes[0].p), [0, 4, 7])
  assert.deepEqual(one('chord', 'minor').notes.map((n) => n.p - one('chord', 'minor').notes[0].p), [0, 3, 7])
  assert.ok(one('higher-lower', 'higher').notes[1].p > one('higher-lower', 'higher').notes[0].p)
  assert.ok(one('higher-lower', 'lower').notes[1].p < one('higher-lower', 'lower').notes[0].p)
  assert.equal(one('chord', 'major').options.map((o) => o.label).join(), 'Major,Minor')
  assert.equal(L.INTERVAL_NAMES[4], 'Major 3rd'); assert.equal(L.INTERVAL_NAMES[7], 'Perfect 5th')
  assert.equal(one('interval', '4').options.find((o) => o.id === '4').label, 'Major 3rd')
  assert.equal(one('interval', '7').options.find((o) => o.id === '7').label, 'Perfect 5th')
  // a set is balanced, repeatable, and has the rounds asked for
  const set = L.earSet({ kind: 'chord', rounds: 10 }, 99)
  assert.equal(set.length, 10); assert.equal(set.filter((q) => q.answer === 'major').length, 5)
  assert.deepEqual(L.earSet({ kind: 'chord', rounds: 10 }, 99).map((q) => q.answer), set.map((q) => q.answer))
  assert.notDeepEqual(L.earSet({ kind: 'chord', rounds: 10 }, 100).map((q) => q.answer), set.map((q) => q.answer))
  assert.equal(L.earSet({ kind: 'step-skip' }, 1).length, L.EAR_DEFAULT_ROUNDS)
  for (const kind of L.EAR_KINDS) for (const q of L.earSet({ kind, rounds: 12 }, 5)) assert.equal(L.earTruth(q), q.answer)
  assert.ok(new Set(L.earSet({ kind: 'chord', rounds: 12 }, 5).map((q) => q.answer)).size === 2)
  assert.throws(() => L.earQuestion('bogus', 'x', L.mulberry32(1)))
  approx(L.earAccuracy(4, 5), 0.8)

  /* ---------- sight ---------- */
  const key = (n) => L.parseKey(n)
  assert.equal(key('C').fifths, 0); assert.equal(key('G').fifths, 1); assert.equal(key('D').fifths, 2); assert.equal(key('F').fifths, -1)
  assert.equal(key('Bb').fifths, -2); assert.equal(key('A').fifths, 3); assert.equal(key('Em').fifths, 1); assert.equal(key('Am').fifths, 0)
  assert.equal(key('Dm').fifths, -1); assert.equal(key('Dm').minor, true); assert.equal(key('Gb').fifths, -6)
  assert.deepEqual(key('G').sig, { F: 1 }); assert.deepEqual(key('F').sig, { B: -1 })
  assert.equal(key('nonsense').name, 'C'); assert.equal(key('nonsense').known, false)
  // F-sharp in G major sits on the F line, B-flat in F major on the B line
  const f4 = L.spellPitch(66, key('G')); assert.equal(f4.step, L.spellPitch(65, key('C')).step); assert.equal(f4.off, 1)
  const bb4 = L.spellPitch(70, key('F')); assert.equal(bb4.step, L.spellPitch(71, key('C')).step); assert.equal(bb4.off, -1)
  assert.equal(L.spellPitch(60, key('C')).step, 35)
  const sight = (params, seed = 1) => L.generateSight(params, seed)
  const params = { range: [60, 67], hand: 'right', key: 'C', length: 2 }
  const a = sight(params, 42), b = sight(params, 42), c = sight(params, 43)
  assert.deepEqual(a.notes, b.notes)
  assert.notDeepEqual(a.notes, c.notes)
  assert.equal(a.notes.length, 8); assert.equal(a.clef, 'treble'); assert.equal(a.bars, 2)
  assert.equal(sight({ ...params, length: 4 }).notes.length, 16)
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) for (const p of [
    { range: [60, 67], hand: 'right', key: 'C', length: 1 }, { range: [48, 55], hand: 'left', key: 'C', length: 1 },
    { range: [55, 71], hand: 'right', key: 'G', length: 4 }, { range: [62, 71], hand: 'right', key: 'D', length: 2 },
    { range: [53, 70], hand: 'right', key: 'F', length: 2 }, { range: [45, 62], hand: 'left', key: 'Am', length: 2 }
  ]) {
    const s = sight(p, seed), k = L.parseKey(p.key)
    assert.equal(s.notes.length, p.length * 4)
    assert.ok(s.notes.every((n) => n >= p.range[0] && n <= p.range[1]), 'in range ' + JSON.stringify(p))
    assert.ok(s.notes.every((n) => k.steps.includes(L.pc(n - k.tonic))), 'in key ' + JSON.stringify(p))
    assert.ok(s.notes.every((n, i) => i === 0 || n !== s.notes[i - 1] || s.notes.length < 4), 'no repeated notes')
    if (p.length > 1) assert.equal(L.pc(s.notes[s.notes.length - 1]), k.tonic, 'ends on the tonic')
  }
  assert.equal(sight({ range: [48, 55], hand: 'left', key: 'C', length: 1 }).clef, 'bass')
  assert.equal(sight({ range: [60, 67], hand: 'both', key: 'C', length: 1 }).clef, 'treble')
  assert.throws(() => sight({ range: [61, 62], hand: 'right', key: 'C', length: 1 }))
  let g = L.gradeSight(8, 8, 8)                                      // 60 a minute
  assert.equal(g.accuracy, 1); assert.equal(g.stars, 5); approx(g.pace, 60)
  g = L.gradeSight(8, 8, 60); assert.equal(g.stars, 4)                // right but slow: four stars
  g = L.gradeSight(8, 6, 10); approx(g.accuracy, 0.75); assert.equal(g.stars, 2)
  assert.equal(L.gradeSight(0, 0, 0).accuracy, 0)

  /* ---------- the real course feeds the runners ---------- */
  const { COURSE } = await load('index.js')
  const types = { echo: 0, rhythm: 0, ear: 0, sight: 0 }
  const items = []
  for (const level of COURSE.levels) {
    for (const lesson of level.lessons) for (const it of lesson.items) items.push({ level, owner: lesson.id, it })
    if (level.exam) for (const it of level.exam.items) items.push({ level, owner: level.exam.id, it })
  }
  for (const { it, owner } of items) {
    const where = `${owner}/${it.id}`
    const p = it.params
    if (it.type === 'echo') {
      types.echo++
      const ph = L.echoPhrase(p.notes), rounds = L.echoRounds(p)
      assert.ok(ph.length >= 2, where + ' echo phrase has two notes')
      assert.ok(rounds.length >= 1 && rounds[rounds.length - 1].length === ph.length, where + ' last round is the whole phrase')
      assert.ok(rounds.every((r, i) => i === 0 || r.length >= rounds[i - 1].length), where + ' rounds grow')
      assert.ok(p.tempo >= 40 && p.tempo <= 160, where + ' echo tempo')
    } else if (it.type === 'rhythm') {
      types.rhythm++
      const plan = L.rhythmPlan(p)
      assert.ok(plan.onsets.length >= 2 && plan.onsets.length <= 24, where + ' rhythm notes')
      assert.ok(plan.windows.edge >= 60, where)
      const compound = /^(6|9|12)\/8$/.test(p.timeSignature || '')   // counted in eighths: 168 is a dotted-quarter pulse of 56
      assert.ok(p.tempo >= 40 && p.tempo <= (compound ? 200 : 160), where + ' rhythm tempo')
      assert.ok(L.parseTimeSignature(p.timeSignature).num >= 2, where + ' time signature')
      if (!L.rhythmFillsBars(p)) warnings.push(`${where}: rhythm does not fill whole bars (${p.pattern.reduce((a, b) => a + Math.abs(b), 0)} beats in ${p.timeSignature || '4/4'})`)
    } else if (it.type === 'ear') {
      types.ear++
      assert.ok(L.EAR_KINDS.includes(p.kind), where + ' ear kind')
      const qs = L.earSet(p, L.hashSeed(it.id))
      assert.equal(qs.length, p.rounds || L.EAR_DEFAULT_ROUNDS)
      for (const q of qs) assert.equal(L.earTruth(q), q.answer, where)
    } else if (it.type === 'sight') {
      types.sight++
      const s = L.generateSight(p, L.hashSeed(it.id))
      assert.equal(s.notes.length, p.length * 4, where)
      assert.ok(s.key.known, where + ' unknown key ' + p.key)
      assert.ok(s.notes.every((n) => n >= p.range[0] && n <= p.range[1]), where)
    }
  }
  console.log('exercise items in the course: ' + JSON.stringify(types))
  assert.ok(types.echo > 0 && types.rhythm > 0 && types.ear > 0 && types.sight > 0)

  /* ---------- every type is runnable and the engine sees the whole course ---------- */
  for (const t of ['five-finger', 'scale', 'arpeggio', 'chord', 'notegame', 'piece', 'theory', 'echo', 'rhythm', 'ear', 'sight']) assert.ok(R.SUPPORTED.has(t), t + ' supported')
  assert.deepEqual(R.playableCourse(COURSE), JSON.parse(JSON.stringify(COURSE)), 'no item is hidden from the engine')
  assert.equal(R.isRunnable({ type: 'from-the-future' }), false)

  /* ---------- reachability: a perfect run of every item walks the whole course ---------- */
  let progress = E.emptyProgress()
  const seen = new Set()
  const finish = (ownerId, it) => { progress = E.recordItemResult(progress, ownerId, it.id, { accuracy: 1, seconds: 30 }) }
  for (let guard = 0; guard < 400; guard++) {
    const step = E.nextStep(COURSE, progress)
    if (!step) break
    if (step.kind === 'lesson') {
      const lesson = step.lesson
      assert.ok(!seen.has(lesson.id), 'the walk meets ' + lesson.id + ' once')
      seen.add(lesson.id)
      assert.ok(lesson.items.length >= lesson.pass.minItemsDone, `${lesson.id} has ${lesson.items.length} items but needs ${lesson.pass.minItemsDone}`)
      for (const it of lesson.items) { assert.ok(R.isRunnable(it), it.id + ' can run'); finish(lesson.id, it) }
      assert.ok(E.isLessonDone(COURSE, progress, lesson), lesson.id + ' completes on perfect runs')
    } else {
      const { level } = step
      for (const it of level.exam.items) finish(level.exam.id, it)
      const score = E.examScore(level.exam, level.exam.items.map(() => 100))
      assert.ok(score.passed, level.id + ' exam passes on perfect runs')
      progress = E.recordExamResult(progress, level.id, { percent: score.percent, passed: true })
      assert.ok(E.examStatus(COURSE, progress, level.number) === 'done')
    }
  }
  const playable = COURSE.levels.filter((l) => !l.draft)
  assert.equal(seen.size, playable.reduce((n, l) => n + l.lessons.length, 0), 'every lesson of every open level is reachable')
  for (const level of playable) assert.ok(progress.exams[level.id]?.passed, level.id + ' exam reached and passed')

  // and a pass at exactly the bar of each item is enough, never more than the bar
  let p2 = E.emptyProgress()
  for (const level of playable) for (const lesson of level.lessons) for (const it of lesson.items) {
    const need = it.passAt.accuracy ?? (it.passAt.stars ? 0 : 0.8)
    p2 = E.recordItemResult(p2, lesson.id, it.id, { accuracy: need, stars: it.passAt.stars })
    assert.ok(E.isItemDone(it, p2.lessons[lesson.id][it.id]), it.id + ' passes at its own bar')
  }

  // a task that needs both hands is told apart from a one-hand one (app.js refuses a one-hand run as a pass)
  assert.equal(R.requiredHand({ type: 'piece', params: { tracks: { right: [], left: [] } } }), 'both')
  assert.equal(R.requiredHand({ type: 'piece', params: { hand: 'right' } }), 'right')
  assert.equal(R.requiredHand({ type: 'scale', params: { tb: { hand: 'left' } } }), 'left')
  assert.equal(R.requiredHand({ type: 'scale', params: { tb: { hand: 'both' } } }), 'both')

  // every library piece a course item names (levels 1 to 12, read from the files) is a registered song or a real file
  {
    const fs = require('node:fs')
    const root = path.join(__dirname, '..', 'renderer')
    const mut = await import(pathToFileURL(path.join(root, 'songs-mutopia.js')).href)
    const appSrc = fs.readFileSync(path.join(root, 'app.js'), 'utf8')
    const files = new Set([...appSrc.matchAll(/^\s*\{ file: '([^']+)'/gm)].map((m) => m[1]))
    const ids = new Set(mut.MUTOPIA_SONGS.map((m) => m.id))
    for (const m of mut.MUTOPIA_SONGS) files.add(m.file)
    let used = 0
    const levelDir = path.join(root, 'course', 'levels')
    for (const f of fs.readdirSync(levelDir).filter((n) => /^level-\d+\.js$/.test(n)).sort()) {
      const mod = await import(pathToFileURL(path.join(levelDir, f)).href)
      for (const level of Object.values(mod)) {
        const items = [...level.lessons.flatMap((l) => l.items), ...(level.exam ? level.exam.items : [])]
        for (const it of items) {
          if (it.type !== 'piece' || !it.params.song) continue
          used++
          const ref = it.params.song
          assert.ok(ids.has(ref) || files.has(ref), `${f} ${it.id}: params.song "${ref}" is not a registered library id or file`)
          const file = ids.has(ref) ? mut.MUTOPIA_SONGS.find((m) => m.id === ref).file : ref
          assert.ok(fs.existsSync(path.join(root, 'songs', file)), `${f} ${it.id}: songs/${file} does not exist`)
        }
      }
    }
    assert.ok(used > 0, 'some library pieces are used')
  }

  for (const w of warnings) console.log('note: ' + w)
  console.log('exercise logic: ok')
})().catch((e) => { console.error(e); process.exit(1) })
