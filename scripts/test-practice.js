// Unit test for the Practice registry and stats (renderer/practice/registry.js): node scripts/test-practice.js
// Pure logic, no window. Items are checked with the course's own validator and exercise logic.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const load = (f) => import(pathToFileURL(path.join(__dirname, '..', 'renderer', f)).href)

;(async () => {
  const reg = await load('practice/registry.js')
  const { validateCourse } = await load('course/course-schema.js')
  const logic = await load('course/exercise-logic.js')
  const { EXERCISE_TYPES } = await load('course/runners.js')
  const { mulberry32 } = logic
  const { ACTIVITIES, getActivity } = reg

  const exercises = ACTIVITIES.filter((a) => a.kind === 'exercise')
  const screens = ACTIVITIES.filter((a) => a.kind === 'screen')
  const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1)
  const itemsOf = (a, level) => SEEDS.map((s) => a.makeItem(level, mulberry32(s)))
  const mean = (xs) => xs.reduce((x, y) => x + y, 0) / xs.length

  // ---- the registry ----
  {
    assert.deepEqual(ACTIVITIES.map((a) => a.id), ['playground', 'ear', 'rhythm', 'sight', 'echo', 'toolbox', 'games', 'jam', 'metronome'])
    assert.equal(new Set(ACTIVITIES.map((a) => a.id)).size, ACTIVITIES.length, 'ids are unique')
    for (const a of ACTIVITIES) {
      assert.ok(a.title && a.blurb && !/[\n]/.test(a.blurb), a.id + ' has a title and a one-line blurb')
      assert.ok(a.kind === 'exercise' || a.kind === 'screen')
    }
    assert.deepEqual(exercises.map((a) => a.id), ['ear', 'rhythm', 'sight', 'echo'])
    for (const a of exercises) { assert.equal(a.levels, 5, a.id + ' has five levels'); assert.equal(typeof a.makeItem, 'function') }
    for (const a of screens) { assert.equal(a.makeItem, undefined, a.id + ' has no item'); assert.equal(a.levels, 0) }
    assert.equal(getActivity('nope'), null)
    assert.equal(getActivity('ear').title, 'Ear training')
    assert.equal(ACTIVITIES.find((a) => a.id === 'metronome').panel, 'metronome')
  }

  // ---- every item is valid, in the course's shape, and known to the exercise screen ----
  {
    let n = 0
    for (const a of exercises) {
      for (let level = 1; level <= a.levels; level++) {
        for (const item of itemsOf(a, level)) {
          n++
          const course = { levels: [{ id: 'p1', number: 1, title: 'P', grade: 'G', blurb: 'B', keys: 88, draft: true,
            lessons: [{ id: 'p1.l', title: 'L', goal: 'G', minutes: 1, teach: [], items: [item], pass: { minItemsDone: 1 } }] }] }
          assert.deepEqual(validateCourse(course), [], `${a.id} level ${level}`)
          assert.ok(EXERCISE_TYPES.has(item.type), item.type + ' is run by mountExercise')
          assert.equal(item.type, { ear: 'ear', rhythm: 'rhythm', sight: 'sight', echo: 'echo' }[a.id])
          assert.match(item.id, /^practice\.[a-z]+\.[1-5]$/)
          assert.ok(item.passAt.accuracy > 0 && item.passAt.accuracy <= 1)
          // the exercise logic can build a run from it
          if (item.type === 'ear') {
            const set = logic.earSet(item.params, 7)
            assert.equal(set.length, item.params.rounds)
            for (const q of set) { assert.equal(logic.earTruth(q), q.answer); assert.ok(q.options.some((o) => o.id === q.answer)) }
          } else if (item.type === 'rhythm') {
            assert.ok(logic.rhythmFillsBars(item.params), 'whole bars: ' + JSON.stringify(item.params.pattern))
            const plan = logic.rhythmPlan(item.params)
            assert.ok(plan.onsets.length >= 2 && plan.onsets[0].beat === 0, 'starts on a note')
          } else if (item.type === 'sight') {
            const line = logic.generateSight(item.params, 3)
            assert.equal(line.notes.length, item.params.length * 4)
            assert.ok(line.notes.every((p) => p >= item.params.range[0] && p <= item.params.range[1]))
          } else if (item.type === 'echo') {
            const rounds = logic.echoRounds(item.params)
            assert.equal(rounds.length, item.params.rounds)
            assert.equal(rounds[rounds.length - 1].length, item.params.notes.length)
          }
        }
      }
    }
    assert.equal(n, 4 * 5 * 40)
    // out of range levels are held to the ladder
    assert.equal(getActivity('ear').makeItem(0, mulberry32(1)).id, 'practice.ear.1')
    assert.equal(getActivity('ear').makeItem(99, mulberry32(1)).id, 'practice.ear.5')
    assert.equal(getActivity('ear').makeItem('x', mulberry32(1)).id, 'practice.ear.1')
  }

  // ---- determinism ----
  {
    for (const a of exercises) for (let level = 1; level <= 5; level++) {
      const a1 = a.makeItem(level, mulberry32(1234)), a2 = a.makeItem(level, mulberry32(1234))
      assert.deepEqual(a1, a2, a.id + ' level ' + level + ' repeats under the same seed')
    }
    // different seeds give variety where the type has any (ear items are fixed by level, their questions use the seed)
    for (const id of ['rhythm', 'echo']) {
      const a = getActivity(id)
      const seen = new Set(itemsOf(a, 5).map((i) => JSON.stringify(i.params)))
      assert.ok(seen.size > 5, id + ' level 5 varies with the seed: ' + seen.size)
    }
    // sight-reading items vary only by key; the line itself is drawn from a seed when the exercise starts
    assert.equal(new Set(itemsOf(getActivity('sight'), 5).map((i) => i.params.key)).size, 3)
    // a real random source works too
    for (const a of exercises) assert.ok(a.makeItem(3, Math.random).params)
  }

  // ---- the ladders get harder ----
  {
    const nondecreasing = (xs, what) => { for (let i = 1; i < xs.length; i++) assert.ok(xs[i] >= xs[i - 1] - 1e-9, `${what} drops at level ${i + 1}: ${xs.map((x) => +x.toFixed(2))}`); assert.ok(xs[4] > xs[0], what + ' ends higher than it starts') }
    const lvl = (a, f) => [1, 2, 3, 4, 5].map((l) => f(itemsOf(a, l)))
    const range = (item) => { const ps = item.params.notes.filter((n) => n.p !== null).map((n) => n.p); return Math.max(...ps) - Math.min(...ps) }

    // ear: how many answers to choose from
    nondecreasing(lvl(getActivity('ear'), (items) => logic.earAnswers(items[0].params.kind, items[0].params).length), 'ear answers')
    assert.deepEqual(lvl(getActivity('ear'), (items) => logic.earAnswers(items[0].params.kind, items[0].params).length), [2, 2, 3, 4, 7])
    // echo: notes in the phrase, how far it ranges, the tempo, and the number of keys it may be in
    nondecreasing(lvl(getActivity('echo'), (items) => items[0].params.notes.length), 'echo notes')
    nondecreasing(lvl(getActivity('echo'), (items) => mean(items.map(range))), 'echo range')
    nondecreasing(lvl(getActivity('echo'), (items) => items[0].params.tempo), 'echo tempo')
    // rhythm: length in beats, tempo, and the shortest note shrinks (never gets longer)
    const beats = (item) => item.params.pattern.reduce((x, b) => x + Math.abs(b), 0)
    const shortest = (item) => Math.min(...item.params.pattern.map(Math.abs))
    nondecreasing(lvl(getActivity('rhythm'), (items) => Math.min(...items.map(beats))), 'rhythm beats')
    nondecreasing(lvl(getActivity('rhythm'), (items) => items[0].params.tempo), 'rhythm tempo')
    nondecreasing(lvl(getActivity('rhythm'), (items) => 1 / Math.max(...items.map(shortest))), 'rhythm density')
    assert.deepEqual(lvl(getActivity('rhythm'), (items) => Math.max(...items.map(shortest))).slice(2), [0.5, 0.5, 0.25], 'from level 3 every item has an eighth, level 5 a sixteenth')
    assert.ok(itemsOf(getActivity('rhythm'), 2).every((i) => i.params.pattern.some((b) => b < 0)), 'level 2 always has a rest')
    assert.ok(itemsOf(getActivity('rhythm'), 1).every((i) => i.params.pattern.every((b) => b > 0)), 'level 1 has no rests')
    assert.ok(itemsOf(getActivity('rhythm'), 4).every((i) => i.params.timeSignature === '3/4'))
    // sight: bars, width of the range
    nondecreasing(lvl(getActivity('sight'), (items) => items[0].params.length), 'sight length')
    nondecreasing(lvl(getActivity('sight'), (items) => items[0].params.range[1] - items[0].params.range[0]), 'sight width')
    nondecreasing(lvl(getActivity('sight'), (items) => items[0].params.range[1] - items[0].params.range[0] + 10 * items[0].params.length), 'sight reach')
    // sight keys with more accidentals appear later
    const sharps = (key) => Math.abs(logic.parseKey(key).fifths)
    nondecreasing(lvl(getActivity('sight'), (items) => Math.max(...items.map((i) => sharps(i.params.key)))), 'sight signature')
  }

  // ---- tap tempo ----
  {
    assert.equal(reg.tempoFromTaps([]), null)
    assert.equal(reg.tempoFromTaps([1000]), null)
    assert.equal(reg.tempoFromTaps([1000, 1500]), 120)
    assert.equal(reg.tempoFromTaps([0, 600, 1200, 1800]), 100)
    assert.equal(reg.tempoFromTaps([0, 500, 1000, 1500, 2000, 2500, 3600, 4800]), 73, 'the last five taps')
    assert.equal(reg.tempoFromTaps([0, 5000, 5500]), 120, 'a long pause starts over')
    assert.equal(reg.tempoFromTaps([0, 10]), 220, 'capped')
    assert.equal(reg.tempoFromTaps([0, 1900]), 40, 'floor')
    assert.equal(reg.tempoFromTaps([5, 5]), null)
    assert.equal(reg.tempoFromTaps([0, NaN, 500]), 120)
  }

  // ---- stats ----
  {
    const { recordResult, recordUse, suggestLevel, recent, bestAt, parseStats, emptyStats, railPicks, STATS_KEY } = reg
    assert.equal(STATS_KEY, 'lumi.practice')
    const s0 = emptyStats()
    const s1 = recordResult(s0, 'ear', 1, 0.7, 1000)
    assert.deepEqual(s0, emptyStats(), 'the input is not changed')
    assert.deepEqual(s1, { v: 1, items: { ear: { plays: 1, best: { 1: 0.7 }, lastLevel: 1, lastAt: 1000 } } })
    const s2 = recordResult(s1, 'ear', 1, 0.5, 2000)
    assert.equal(bestAt(s2, 'ear', 1), 0.7, 'a worse result keeps the best')
    assert.equal(s2.items.ear.plays, 2); assert.equal(s2.items.ear.lastAt, 2000)
    const s3 = recordResult(s2, 'ear', 2, { accuracy: 0.95 }, 3000)
    assert.equal(bestAt(s3, 'ear', 2), 0.95); assert.equal(s3.items.ear.lastLevel, 2)
    assert.equal(bestAt(s3, 'ear', 3), null); assert.equal(bestAt(s3, 'rhythm', 1), null)
    // out of range accuracy is held to 0..1; junk changes nothing
    assert.equal(bestAt(recordResult(s0, 'ear', 1, 7, 1), 'ear', 1), 1)
    assert.equal(bestAt(recordResult(s0, 'ear', 1, -2, 1), 'ear', 1), 0)
    for (const bad of [[s0, 'ear', 0, 0.5, 1], [s0, 'ear', 1.5, 0.5, 1], [s0, 'ear', 1, NaN, 1], [s0, 'ear', 1, 'x', 1], [s0, 'ear', 1, 0.5, NaN], [s0, '__proto__', 1, 0.5, 1], [s0, '', 1, 0.5, 1]]) {
      assert.deepEqual(recordResult(...bad), emptyStats(), JSON.stringify(bad))
    }
    assert.deepEqual(recordResult(null, 'ear', 1, 0.5, 5).items.ear.best, { 1: 0.5 }, 'missing stats start fresh')

    // suggestLevel: stay, or one up after 0.9 at the current level, capped
    assert.equal(suggestLevel(s0, 'ear'), 1)
    assert.equal(suggestLevel(s1, 'ear'), 1, '70% stays')
    assert.equal(suggestLevel(recordResult(s0, 'ear', 1, 0.89, 1), 'ear'), 1)
    assert.equal(suggestLevel(recordResult(s0, 'ear', 1, 0.9, 1), 'ear'), 2)
    assert.equal(suggestLevel(s3, 'ear'), 3, '95% at level 2')
    assert.equal(suggestLevel(recordResult(s0, 'ear', 5, 1, 1), 'ear'), 5, 'capped at the top level')
    assert.equal(suggestLevel(recordResult(s0, 'ear', 4, 0.2, 1), 'ear'), 4, 'stays where you were')
    assert.equal(suggestLevel(recordResult(s0, 'ear', 4, 0.95, 1), 'ear'), 5)
    assert.equal(suggestLevel(s3, 'nope'), 1)
    assert.equal(suggestLevel(null, 'ear'), 1)
    assert.equal(suggestLevel(recordResult(s0, 'ear', 8, 1, 1), 'ear'), 5, 'a stored level above the ladder is held to it')

    // screens count as use only
    const u = recordUse(s0, 'playground', 4000)
    assert.deepEqual(u.items.playground, { plays: 1, best: {}, lastLevel: 1, lastAt: 4000 })
    assert.equal(suggestLevel(u, 'playground'), 1)
    assert.equal(recordUse(u, 'playground', 4500).items.playground.plays, 2)
    assert.deepEqual(recordUse(s0, 'x y', 1), emptyStats())

    // recent: newest first, ids only
    let st = emptyStats()
    st = recordResult(st, 'ear', 1, 0.5, 10)
    st = recordUse(st, 'playground', 30)
    st = recordResult(st, 'rhythm', 2, 0.5, 20)
    st = recordResult(st, 'sight', 1, 0.5, 5)
    assert.deepEqual(recent(st, 2), ['playground', 'rhythm'])
    assert.deepEqual(recent(st, 10), ['playground', 'rhythm', 'ear', 'sight'])
    assert.deepEqual(recent(st, 0), []); assert.deepEqual(recent(emptyStats(), 4), []); assert.deepEqual(recent(null, 4), [])

    // the Home rail: recent first, then the defaults, four at most, no repeats
    assert.deepEqual(railPicks(emptyStats(), 4).map((a) => a.id), ['playground', 'ear', 'rhythm'])
    assert.deepEqual(railPicks(st, 4).map((a) => a.id), ['playground', 'rhythm', 'ear', 'sight'])
    const one = recordResult(emptyStats(), 'games', 1, 0.5, 9)
    assert.deepEqual(railPicks(one, 4).map((a) => a.id), ['games', 'playground', 'ear', 'rhythm'])
    assert.deepEqual(railPicks(one, 2).map((a) => a.id), ['games', 'playground'])
    const ghost = recordResult(emptyStats(), 'gone', 1, 0.5, 9)
    assert.deepEqual(railPicks(ghost, 4).map((a) => a.id), ['playground', 'ear', 'rhythm'], 'an activity that no longer exists is skipped')

    // parseStats: round trip, repair, reject
    assert.deepEqual(parseStats(JSON.stringify(st)), st)
    assert.deepEqual(parseStats(st), st)
    for (const bad of [null, undefined, '', 'not json', '[]', '{}', '5', 'null', '{"v":2,"items":{}}', '{"v":1}', '{"v":1,"items":[]}', '{"v":1,"items":5}', 7, [], true]) {
      assert.deepEqual(parseStats(bad), emptyStats(), 'rejects ' + JSON.stringify(bad))
    }
    const messy = parseStats(JSON.stringify({ v: 1, items: {
      ear: { plays: -3, best: { 1: 2, 2: 'x', 99: 0.5, '01': 0.5, 3: 0.4 }, lastLevel: 'x', lastAt: 'now' },
      '__proto__': { plays: 1, best: {}, lastLevel: 1, lastAt: 1 },
      'Bad Id': { plays: 1, best: {}, lastLevel: 1, lastAt: 1 },
      rhythm: 5,
      sight: { plays: 2.5, best: { 1: 0.8 }, lastLevel: 4, lastAt: 77 },
      echo: null
    } }))
    assert.deepEqual(Object.keys(messy.items).sort(), ['ear', 'sight'])
    assert.deepEqual(messy.items.ear, { plays: 2, best: { 1: 1, 3: 0.4 }, lastLevel: 1, lastAt: 0 })
    assert.deepEqual(messy.items.sight, { plays: 1, best: { 1: 0.8 }, lastLevel: 4, lastAt: 77 })
    assert.equal(Object.getPrototypeOf(messy.items), Object.prototype)
    assert.equal(({}).plays, undefined, 'the prototype was not polluted')
    // at most 50 entries are kept
    const many = { v: 1, items: {} }
    for (let i = 0; i < 80; i++) many.items['a' + i] = { plays: 1, best: {}, lastLevel: 1, lastAt: i }
    assert.equal(Object.keys(parseStats(many).items).length, 50)
    // stats survive a storage round trip through the writers
    assert.deepEqual(parseStats(JSON.stringify(recordResult(st, 'ear', 3, 0.91, 99))), recordResult(st, 'ear', 3, 0.91, 99))
  }

  // ---- the UI file is plain: no dynamic innerHTML ----
  {
    const ui = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'practice', 'practice-ui.js'), 'utf8')
    assert.ok(!/innerHTML|insertAdjacentHTML|outerHTML/.test(ui), 'practice-ui.js builds its DOM without innerHTML')
  }

  console.log('practice ok')
})().catch((e) => { console.error(e); process.exit(1) })
