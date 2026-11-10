# Keylight piano course: authoring guide

The course lives in `renderer/course/`. It is plain data plus a small pure engine; nothing there touches the DOM, storage or audio, so it runs under node and is tested by `scripts/test-course.js` (part of `npm test`). The UI that shows it is a later step.

| File | Role |
|---|---|
| `course-schema.js` | Data model (JSDoc at the top) and `validateCourse(course)`, which returns a list of problems |
| `course-engine.js` | Progress object, lesson/level/exam status, next step, summaries, `serializeProgress` / `parseProgress` |
| `builders.js` | `seq('E4 D4 C4:2 r:1')` writes tunes as text; `itemsFor(lessonId)` keeps item ids unique |
| `levels/level-NN.js` | One file per level |
| `index.js` | Exports `COURSE` (levels 1 to 3) and the engine |

## Data model

```
Course  { levels: Level[] }
Level   { id, number, title, grade, blurb, keys, lessons[], exam?, draft? }
Lesson  { id, title, minutes, goal, teach: string[], tip?, diagram?, items[], pass: { minItemsDone, minStars? }, draft? }
Item    { id, title, type, params, passAt: { accuracy?, stars? } }
Exam    { id, title, items[], passPercent, minTaskPercent? }
Diagram { type: 'keys' | 'staff' | 'hands', ... }
```

- Pitches are MIDI numbers (60 = middle C). A rest is `p: null`.
- `keys` is the smallest keyboard that plays the whole level (24, 48, 49, 61, 88). Levels 1 to 4 must work on 24 keys.
- `teach` paragraphs are short, plain language, second person, at most 60 words each (the test enforces it).
- `draft: true` marks a level or lesson that is only an outline (title and goal). Drafts are shown as "coming soon" and are never open.
- Every id is unique across the whole course (levels, lessons, items, exams). Item ids are `<lessonId>.<key>`.

## Item types

| Type | Status | Params |
|---|---|---|
| `five-finger`, `scale`, `arpeggio`, `chord` | exists | `{ tb: { type, tonic, hand } }`. `type` is a Scales & chords key in `TB_TYPES` (`five`, `scale`, `minor`, `harmonic`, `chord`, `minorarp`, `cadence`), `tonic` is 0 to 11, `hand` is right/left/both |
| `notegame` | exists | `{ game, rounds? }`, `game` is `find-the-key`, `read-treble` or `read-bass` |
| `piece` | exists for `song`; inline needs a small runner | `{ song, from?, to?, hand? }` for a file in `renderer/songs/`, or inline `{ notes: [{p, beats}], tempo, hand }`, or hands together `{ tracks: { right, left }, tempo }` (equal length) |
| `echo` | exists | `{ notes, tempo, hand, rounds? }`: the app plays a phrase, you play it back. `rounds` rounds, the phrase growing from its first two notes to the whole (the last round is the phrase as written) |
| `rhythm` | exists | `{ pattern, tempo, timeSignature? }`: beats per note, negative = rest; tap it on any key or Space after a one-bar count-in |
| `ear` | exists | `{ kind, rounds?, intervals?, qualities? }`: `higher-lower`, `same-different`, `step-skip`, `direction`, `interval`, `chord`. Optional `intervals` (semitones, default 3 4 5 7) and `qualities` (default major, minor) choose the options |
| `sight` | exists | `{ range: [lo, hi], hand, key, length }`: a seeded line of `length` bars of quarter notes in the key (`'G'`, `'Bb'`, `'Em'`), shown on a staff with its key signature |
| `theory` | exists | `{ q, options, answer, why }`: `answer` is the index of the right option |

`passAt` is the bar for one item: `accuracy` (0 to 1, default 0.8) and/or `stars` (1 to 5). The star bars match `scoring.js`.
A note game reports accuracy as right answers over answers given, and a `piece` item should be judged like guided practice (Wait mode 0.8 first time, timed 0.85).

## Progress and unlocking

Progress is one object (`emptyProgress()`), stored as one string by `serializeProgress`, read back with `parseProgress`, which drops anything corrupt and returns an empty progress for unknown versions. Planned storage key: `lumi.course`; add it to `renderer/storage-validation.js` and the backup allow-list when the UI is wired.

- `recordItemResult(progress, lessonId, itemId, { accuracy, stars?, at?, seconds? })` keeps the best accuracy and stars and counts tries. It returns a new object.
- A lesson is done when `pass.minItemsDone` items reach their `passAt` (and `pass.minStars`, if set).
- Inside a level lessons open in order; the first lesson of an unlocked level is open. A finished lesson stays done even if done out of order.
- The level exam opens when all the level's lessons are done (`examStatus`). `examScore(exam, taskPercents)` applies `passPercent` and the per-task floor `minTaskPercent`. `recordExamResult` stores the attempt; a pass is never lost.
- Level N+1 unlocks when level N's exam is passed. To skip ahead, `unlockLevel(progress, n)` opens levels 2 to n (use it after a placement test, or when the learner chooses); `recordExamResult(..., { placement: true })` records a test-out.
- `nextLesson` / `nextStep` say what to show on the Continue button; `levelSummary` / `courseSummary` give percent and minutes.

## Adding a lesson

1. Open the level file. Create the item factory at the top: `const foo = itemsFor('l2-foo')`.
2. Add a lesson object with a unique id (`l<level>-<slug>`), a goal, 1 to 3 short `teach` paragraphs, an optional `tip` and `diagram`, 2 to 4 items and `pass.minItemsDone`.
3. Write tunes with `seq('E4 D4 C4:2')`. Keep inside the level's `keys`.
4. Run `node scripts/test-course.js`. The validator names the path of any problem.

## Adding a level

Create `levels/level-NN.js` exporting a Level, import it in `index.js` and add it to `COURSE.levels`. `number` must equal its position. A level that is only an outline sets `draft: true` and needs no exam (see `level-03.js`).

## Licence rules for content

- Write every lesson text, quiz question and exercise ourselves. Never copy wording, exercise order or illustrations from method books (Alfred, Faber, Bastien, Thompson, Suzuki, RCM/ABRSM/Trinity books and their lists) or from CC BY-SA course text (Open Music Theory, Wikibooks). Facts such as scale patterns and skill order are free; sentences are not.
- Repertoire: only public-domain works or traditional tunes in our own arrangement, written as note lists or hand-encoded MusicXML. A Mutopia or other edition may be used only when its licence is Public Domain or CC BY (credit it in `THIRD_PARTY_NOTICES.md`); avoid CC BY-SA editions.
- Do not use modern arrangements, editors' fingerings and phrase marks, or pop songs.
- Do not name hardware brands in lesson text.
- Source for choices: the course research (licensing verdict and the 12-level outline with RCM/ABRSM mapping), which lists the verified public-domain pieces per level (Bach Notebook for Anna Magdalena, Burgmueller Op. 100, Czerny Op. 821/840, Kuhlau Op. 20, Tchaikovsky Op. 39, Beethoven, Mozart K. 331, Grieg and others).

## The UI (what exists now)

Files: `renderer/course/course-ui.js` (screens, diagrams, Home card, progress in localStorage `lumi.course`), `renderer/course/runners.js` (which item types run, `playableCourse`, `buildPieceSong`), plus the wiring in `app.js`, markup in `index.html` (`#screen-course`, `#courseHome`, the Course tab) and the `COURSE` section at the end of `glass.css`. `lumi.course` is validated in `storage-validation.js`, included in backups and cleared by Reset progress.

- **Course tab** (between Home and Search): a summary card with a Continue button (from `nextStep`), then a vertical path of level cards (progress ring, grade, lesson count, minutes, state chip). A level expands to its lessons (status icon plus a word, minutes, `aria-current="step"` on the current one) and its exam. Locked levels offer Skip ahead (`unlockLevel`, after a confirm) and, for the next one, Placement (the previous level's exam taken early, recorded with `placement: true`).
- **Lesson page**: serif title, goal, the teach text, the tip as a callout, the diagram (`keys` mini keyboard with names and finger numbers, `staff` on one or two staves, `hands` with finger numbers), a sticky Practice checklist (type icon, title, best accuracy against the bar, Start / Try again / Again), and a Lesson complete banner with a Next lesson button.
- **Exam page**: the tasks as a checklist; the best result of each task is kept under the exam id in `progress.lessons`, and once every task has a result `examScore` decides and `recordExamResult` stores it.
- **Home**: the old learning path rail is no longer drawn; a course card shows the next lesson, a progress ring and Continue (or Start the course for a new learner). The first-run hero and the setup's last step lead into lesson 1.
- **Runners**: `five-finger`, `scale`, `arpeggio`, `chord` open the toolbox exercise with the item's `tb`; `piece` plays a library `song` or an inline `notes` / `tracks` piece (Practice mode, waits for you); `notegame` runs the note game for `rounds` right answers (accuracy = right over answers given); `theory` is a question card with a steady shuffled option order and the "why" shown at once. Results go to `recordItemResult` before the results dialog, whose button becomes Next item or Back to lesson.
- **Exercises** (`exercise-ui.js`, logic in `exercise-logic.js`, tests in `scripts/test-course-exercises.js`): echo, rhythm, ear and sight run on their own screen (`#screen-exercise`), in the same glass card style. Every note you play (MIDI, the on-screen keys, the computer keys A S D F G H J) reaches the exercise through `handleNoteOn`; nothing needs audio hardware.
  - **echo**: the phrase plays and lights on a mini keyboard, you play it back (Hear again any time). Notes count by name in any octave. A try is scored by the notes in order (longest common run over the phrase length); 3 tries per round, each earlier try costs 10 points; the item's accuracy is the mean of the rounds.
  - **rhythm**: a count-in bar, then a beat track with a moving playhead and a click on every beat. Each note takes the nearest tap inside its window: perfect 1, good 0.75, early or late 0.4, missed 0; an extra tap takes 0.25 off. Windows scale with the pattern (never past half the gap between notes; perfect 40 to 60 ms, good 70 to 120 ms). Taps are timed from their own timestamps and corrected by the audio output latency. Hit markers show on the track afterwards.
  - **ear**: questions are generated from the kind with even, shuffled answers (a 10-question chord item has 5 of each); the sound uses held notes that overlap. Answer by button or keys 1 to 4, R replays; the right answer and the reason show at once. Accuracy is right over asked. The test recomputes every answer from the sounding pitches.
  - **sight**: a seeded line (item id and try number), mostly stepwise, ending on the tonic, drawn with the key signature; the line waits for the right note (any octave). Accuracy is notes right first time over the notes; pace is shown, and the fifth star needs 30 notes a minute.
  - Stars come from accuracy (`starsFor`), saved with `recordItemResult`; the result card then offers Next item or Back to lesson and Try again. A type this app does not know (from a newer course file) shows as an optional row and `playableCourse()` keeps it out of the engine.
- Self-test lines `SELFTEST course ...` cover the map, a quiz answer saved, the next lesson opening, every inline piece turning into a song, each exercise type run from the lesson page to a saved result and the next lesson, a toolbox exercise, a piece and a note game through the results dialog or quiz card, Skip ahead, Placement and the exam page.

Still to do: a real placement test (today Placement is the previous level's exam), review links from a failed exam, and the level 6+ content.
