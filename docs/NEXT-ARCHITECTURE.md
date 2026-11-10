# Keylight: architecture plan after 0.3.0

Status (2026-11-09): a plan for discussion. Nothing in it is built. Line numbers refer to
commit `1aaf2de` on `release/0.3.0`. An independent review (Codex) checked the claims
against the code; its corrections are folded in.

Contents:

1. Airwave finger tracking: what to try next
2. The four remarks, checked against the code, with a design for each
3. Jam mode (a loop-and-layer sketchpad inside Keylight)
4. Foundations that should be fixed along the way
5. Smaller additions worth considering
6. Suggested order
7. Decisions that are yours

---

## 1. Airwave finger tracking

### Where it stands

Facts from the tester's exp5 reports:

- The sensor's camera is on USB ("Tracking Camera", vendor 0x2936, product 0x1202).
- Ultraleap's public Hand Tracking app is installed. Keylight finds its library, the message
  layout matches, the service connects, and it lists zero devices. Ultraleap's own Control
  Panel says the same.
- ROLI's apps were not running during the test. Whether they are installed on that Mac is
  not known.

### What changes the picture

We have been testing against the wrong tracking software. ROLI ships its own tracking
stack for the Airwave: a camera driver extension and a background service, licensed from
Ultraleap. Search results for ROLI's support pages say three things:

- Ultraleap's public Hand Tracking app is incompatible with the Airwave software and
  should be uninstalled.
- On macOS the camera needs ROLI's driver extension (named "UltraleapUVCDriver") to be
  allowed in System Settings.
- Airwave Control has a Tracking Mode setting ("On Demand" or "Always on").

**These three points are not verified.** They come from search excerpts. ROLI's support
site refused to show the articles when opened directly today (it asks for a login). The
tester can confirm them in two minutes by looking at his own Mac.

If they are true, "zero devices" from Ultraleap's public service says very little. That
service was never the one meant to run this camera.

### Routes, in the order worth trying

**Route A: ROLI's installed tracking service (the lead).**
If ROLI's software is built on Ultraleap's standard service, ROLI's install contains its
own copy of the LeapC library, and a local service that library talks to. Keylight's
helper already speaks LeapC and already loads a library from any path given in
`KEYLIGHT_LEAPC` (`native/keylight-leap-helper.c:242`; `main.js:629` passes the variable
through). So the first test needs no new build: exp7 can do it.

Possible outcomes and what Keylight would do:

| Outcome | Meaning | Next step |
| --- | --- | --- |
| Frames with fingers arrive | The route is real | Add ROLI's install paths to the helper's search list. The Airwave card says "needs the Airwave software installed and tracking switched on". Nothing of ROLI's or Ultraleap's is bundled. |
| Library found, service connects, still zero devices | The service is there but does not serve us (private endpoint name, or a client check) | One more experiment with LeapC's connection options. If that fails, the route is closed. |
| No LeapC library anywhere in ROLI's install | ROLI talks to the camera some private way | Route closed. We do not take ROLI's software apart. |

Two open questions on this route, even if it works:

- **Licence.** Whether ROLI's and Ultraleap's terms allow another app to read hands from
  their service. I cannot judge that. It needs their licence text, or a question to ROLI.
- **Sharing.** Whether Airwave Player and Keylight can both read at once. Ultraleap's
  standard service allows several clients; ROLI's build may not.

**Route B: Ultraleap's public service with ROLI's driver out of the way.**
One guess is that ROLI's driver holds the camera so Ultraleap's service cannot open it.
Testing it means disabling ROLI's driver on the tester's Mac, which breaks his Airwave
until he re-enables it. Even if it worked, people would have to choose between ROLI's
apps and Keylight. Not worth trying unless route A is closed and the tester offers.

**Route C: read the camera ourselves and run our own hand model.**
Still a no-go as a committed feature, for the reasons in `AIRWAVE-RESEARCH.md`: no public
protocol, the vendor's camera tool does not support macOS and comes under a licence that
forbids reverse engineering, and nobody has shown the hand model Keylight already uses
(`renderer/handtrack.js`) working on infrared fisheye pictures. One free check decides
whether it deserves even a short experiment: does the camera show up as an ordinary
camera in QuickTime? If it does not, this route is closed for good.

**What already works regardless:** the sensor's Expression MIDI port (hand-level
movement, no fingers) and the webcam coach.

### What to ask the tester

All checks are read-only except the optional uninstall in step 5. About ten minutes.

1. Is ROLI's Airwave software installed (ROLI Connect, Airwave Control, Airwave Player)?
   Does Airwave Player show his hands when it runs? If the answer is no, nothing else
   here means much until it does.
2. System Settings > General > Login Items & Extensions > Driver Extensions: is there an
   entry from ROLI or Ultraleap, and is it switched on?
3. In Terminal:
   ```bash
   systemextensionsctl list
   ```
   ```bash
   ps aux | grep -i -E "leap|ultraleap|roli|airwave" | grep -v grep
   ```
4. Look for LeapC libraries (he should blank his user name in any path before sending):
   ```bash
   find /Applications /Library "$HOME/Library" -iname "*leapc*" 2>/dev/null
   ```
5. If step 4 shows a library that is not inside "Ultraleap Hand Tracking.app": open
   Airwave Control, set Tracking Mode to "Always on", then start exp7 from Terminal with
   that library, open the Airwave card and export the test report.
   ```bash
   KEYLIGHT_LEAPC="/the/path/from/step/4" "/path/to/Keylight Airwave Test.app/Contents/MacOS/Keylight Airwave Test"
   ```
   Ultraleap's public service may answer instead of ROLI's while it is installed. If the
   result is again zero devices, the clean repeat is to uninstall Ultraleap Hand Tracking
   (ROLI reportedly advises this anyway) and run the same line again. That is his call.
6. QuickTime Player > File > New Movie Recording > the arrow next to the record button:
   is "Tracking Camera" in the camera list? If yes, what does the picture look like?

### Stop rule

If route A ends in "no library" or "service does not serve us", and step 6 shows no
camera, finger tracking from the Airwave is closed. Keylight then says so plainly in the
Airwave card and the docs, and keeps the expression port and the webcam coach.

---

## 2. The four remarks

### 2.1 Back should go to the previous page

**Verdict: true.** There is no history. `showScreen` keeps a single `prevScreen`
(`renderer/app.js:1329`). The back button returns there only from the play screen, and
from a course quiz it returns to Course; from Settings, Scales & chords, Games and the
rest it goes Home (`app.js:949`). Escape and the Android back button have their own
separate rules (`app.js:1213`, `app.js:1301`); Android back also presses the course's own
internal back button (`app.js:1316`).

**Design: one navigation module, `renderer/nav.js`.**

- A stack of entries `{ screen, params, scroll }`. `params` holds what is needed to
  rebuild the screen: the open course level, the search text and filter, the chosen
  scale.
- `nav.go(screen, params)` pushes. `nav.back()` pops and restores, including scroll
  position. `nav.replace()` swaps the top entry.
- Pressing a tab in the nav bar starts a fresh stack at that tab.
- The play screen is never a place to go back *to*. Leaving it pops to whatever launched
  it. Finishing a course item replaces the entry, so back does not replay it.
- Dialogs and sheets register on a small overlay list. Back closes the top overlay first.
- The back button, Escape and the Android back button all call the same `nav.back()`.
  The hand-written rule sets go away. Android still gets its yes-or-no answer ("handled"
  or "leave the app").
- The stack is not saved between launches and is capped at about 20 entries.

Two things the module must respect, or it will break what works today:

- **The Course screen is several pages in one.** The level map, a lesson, an exam and a
  theory page all live on one screen and keep their state privately
  (`renderer/course/course-ui.js:167`, `:250`, `:514`). Each of those becomes its own
  stack entry, and the course gets a "restore this page" hook.
- **Leaving a screen does cleanup today.** `showScreen` stops the player, ends a
  recording and tears down a running exercise (`app.js:1338` onward). Every screen
  registers `enter(params)` and `leave()` with the nav module so that cleanup is kept.

The iOS edge swipe is switched off in the iOS host today
(`ios/Keylight/WebViewController.swift:63`). Turning it on is a separate, optional step.

It is a pure module, so it gets a table-driven unit test: a list of moves and the screen
expected after each. This is also the first piece taken out of `app.js` (see 4.2).

### 2.2 Lessons should offer to unlock, not force the order

**Verdict: partly true.** A whole level can already be skipped (with a confirmation) and
there is a placement test (`renderer/course/course-ui.js:315`, `:521`, `:535`). Inside a
level the lessons are locked in sequence, the locked rows are disabled buttons
(`course-ui.js:337`), and there is no way to open everything.

**Design: locks become a recommendation.**

- The engine stops answering "locked" and answers `ahead` instead
  (`renderer/course/course-engine.js:96`). The existing `open` state keeps its name and
  meaning (the recommended next one), because "Continue" and the next-step finder search
  for it by name (`course-engine.js:143`, `:153`).
- The same applies one floor up: a level that is ahead can be opened the same way. Level
  access, exam entry and the level cards each have their own check today
  (`course-engine.js:80`, `course-ui.js:513`); all of them change together.
- Tapping an `ahead` lesson or level opens a small sheet: "This comes after *Lesson X*."
  with two buttons, **Start anyway** and **Take me to Lesson X**.
- A setting, **Course order**: *Guided* (default, asks as above) or *Open* (never asks,
  only marks the recommended next lesson).
- Opening a lesson early never marks earlier ones as passed. Stars, completion and the
  level badge still come only from passing. The level exam still decides "level
  complete"; it no longer decides access.
- Placement test and level skip stay as they are.

A contained change: engine status, the checks listed above, one sheet, one setting, and
tests for each state at lesson and level height.

### 2.3 Playground and the exercises are hard to find

**Verdict: true.** Playground is the third card in an "Explore" section low on Home
(`renderer/index.html:114-170`) and is not in the nav bar. Ear training, play-it-back,
rhythm and sight-reading exist only as steps inside course lessons, so nobody can reach
them without walking the course to the right lesson. A tooltip on the Search screen
promises "ear exercises" in a place that has none (`index.html:192`).

**Design: a Practice tab.**

- A new top-level screen, **Practice**, in the nav bar. Cards: Playground, Jam (section
  3), Ear training, Rhythm, Sight-reading, Play it back, Scales & chords, Games. Each
  card has one line saying what it is, and a difficulty choice where that applies.
- Behind it, an **activity registry**: one list of
  `{ id, title, kind, levels, launch(level, host) }`. Each entry knows how to start
  itself, because the activities do not all start the same way:
  - Ear training, rhythm, sight-reading and play-it-back go through the existing
    `mountExercise` (`renderer/course/exercise-ui.js:72`). It handles exactly these four
    kinds (`exercise-ui.js:647`) and already takes the result handler as a parameter.
  - Playground, Scales & chords, Games and theory quizzes run on the play screen or
    their own screens, so each gets a small adapter around its existing start function.
- The blocker today is the launcher in `app.js:2171-2210`, which always passes the
  course's result handler. It takes the handler from its caller instead. The course
  passes one that records course progress; Practice passes one that records practice
  stats (best score, last level) under its own key. Course results are also written in
  three other places (`app.js:1849`, `:3508`, `course-ui.js:529`); none of those may run
  for a Practice session.
- **Practice time counts toward the daily goal.** The goal and streak timer only runs on
  the play screen today (`app.js:1421`, `:3588`). It moves behind the registry so every
  activity feeds it.
- Home gets a "Practice" rail above Songs showing the last-used activities, and the
  wrong tooltip is fixed.
- The nav bar has five slots today (Home, Course, Search, Achievements, Settings). A
  sixth is too tight on a phone. My suggestion: Practice takes the Achievements slot and
  Achievements moves next to the goal ring on Home. That is a product choice (section 7).

### 2.4 The support dialog

**Verdict: by the code, it opens by itself once, not on every start.**
`renderer/support.js` opens the dialog when first-run setup ends with "skip"
(`app.js:556`), and only if a saved flag says it was never shown. It then saves the flag.
There is no timer. The "Support" buttons open it whenever they are pressed.

So it can only come back when the saved flag is gone, and then first-run setup comes
back with it. That happens with a fresh profile (test runs use one each time), and
whenever the app's local address changes, which empties all saved data (the weakness in
4.1). Tester builds keep one profile, so they should not show it twice. **I need you to
tell me where you saw it repeatedly, and whether first-run setup appeared each time
too.** If setup did not reappear, there is a bug I have not found, and that comes first.

**Design, if you want a gentle reminder:**

- State: `{ lastShown, snoozeUntil, never, launchesSinceShown }`.
- The first offer stays where it is today, at the end of first-run setup.
- After that, one pure function, `shouldOfferSupport(state, now, moment)`, unit-tested.
  It says yes only when all of these hold: not `never`; `now` is past `snoozeUntil`; at
  least 14 days since `lastShown`; at least 3 app launches since; and the moment is a
  calm one (back on Home after passing a song or lesson). Never at launch, never during
  setup, never on the play screen.
- After the first time it is a card on Home, not a dialog that blocks the app.
- Buttons: **Support Keylight**, **Maybe later** (sets `snoozeUntil` 14 days ahead),
  **Don't ask again**.
- People who already have the old "seen" flag start with `lastShown` set to the day of
  the update, so nobody gets a reminder straight after updating.
- "Reset progress" does not clear **Don't ask again**.

---

## 3. Jam mode

The idea: a place to build a groove in layers, the way ROLI's Noise app worked. A drum
pattern, a bass line, chords, a lead, each recorded as a short loop, all playing
together. It gets its own name and its own sounds; nothing of ROLI's is copied.

**What exists to build on.** The synth follows glide, pressure and slide per note while
the note is being played live (`renderer/audio.js:194-205`). Notes can be scheduled
ahead of time (`audio.js:221`), and the sound output can be tapped (`audio.js:279`).
There is a sampled piano beside the synth instruments, and a gain, tone and pan stage
used by the Airwave expression controls.

**What does not exist.** A clock that runs without a song, a drum kit, delay or reverb,
sounds that can be edited, anything that records and replays loops, and a screen for it.

**The hard part: the synth has no idea of "tracks".** This is the real cost of Jam, and
the review made it plain:

- Gestures reach only notes that are sounding live. A scheduled note carries no channel,
  no sound choice and no gesture data (`audio.js:221`), so a replayed loop would lose
  all its expression.
- How fast a key is released is thrown away where MIDI comes in (`app.js:3829`).
- There is one instrument for the whole app, and changing it cuts off every sounding
  note (`audio.js:142`).
- The 40-voice limit counts live notes only; scheduled notes are outside it
  (`audio.js:168`, `:220`).

So Jam starts with a new voice contract: every voice belongs to a track; a track has its
own sound; live and replayed notes go through one allocator; and a recorded note is a
note plus a timed stream of gestures that can be replayed and cancelled.

**Modules:**

| Module | Job |
| --- | --- |
| Voice contract (in `audio.js`) | Tracks, a sound per track, one voice allocator for live and replayed notes, gesture streams on scheduled notes. Everything below depends on it. |
| `tempo-clock.js` | A free-running bar-and-beat clock on the audio clock, with look-ahead scheduling, tempo and swing. It runs on a timer of its own, not on the play screen's drawing loop (`app.js:4840`). The metronome click moves here, so songs, exercises and Jam share one clock. |
| `patch.js` | A sound described as data: oscillator layers, envelope, filter, and what each gesture controls (pressure to loudness or brightness, slide to filter, glide to pitch, release speed to fade). The built-in synth instruments are rewritten as patches; today they are tables in code in `instruments.js`. The sampled piano stays as it is. |
| `fx-bus.js` | A shared send bus before the limiter: delay and reverb. The reverb's room sound is generated in code, so there are no sample files to license. |
| `drums.js` | A synthesised kit (kick, snare, hats, clap, toms). Synthesised for the same licence reason. Played from the keys or a 4 by 4 pad grid on screen. |
| `looper.js` | Records what is played, gestures included, against the clock; snaps the loop length to 1, 2, 4 or 8 bars; replays through the scheduler. Overdub, undo last take, clear. |
| Jam screen | Its own screen: tracks down the side, loop slots, transport, key and scale. **Not** a seventh mode of the play screen, which already carries six behind flags. |

Details that matter:

- **Scale lock.** Pick a key and scale and the LUMI keys light only those notes. This is
  what makes it fun for a beginner, and the light code already exists.
- **Voice budget.** Loops and live playing share one limit; the allocator needs a rule
  for which notes give way (the live hand always wins).
- **Saving and export.** Sessions are saved after the fix in 4.1 is in. Export needs new
  code: the existing recorder films the screen and produces video
  (`renderer/recorder.js:75`), so audio-only export and MIDI-file export are both new.
- **Phones.** Android WebView audio delay is noticeably higher than desktop. Jam works
  there but recording to the beat needs a per-device delay setting.

**Sizes.** Version 1: the voice contract, clock, drum kit, one synth track, four loop
slots, scale lock, delay and reverb. Version 2: four tracks, patches you can edit, save
and export. Version 1 is a large piece of work, larger than everything in section 2
together, and the voice contract touches the sound engine every other screen relies on.

---

## 4. Foundations

Things I found while mapping the app. Ordered by how much they can hurt a user.

### 4.1 Progress can be lost silently (do this before adding new kinds of saved data)

All progress lives in the browser storage of the page `http://127.0.0.1:47821`. If that
port is taken, the app picks another, and the page then sees empty storage: the log line
at `main.js:83` says "progress saved on this run will not carry over". The user sees
their progress gone, with no explanation. The only safety net is a manual backup file.

Imported songs and their audio are in the same position: they sit in the browser's
database for that address (`renderer/importer.js:403`).

There are two ways to fix it. I recommend trying the first.

**Option A: give the page an address that never changes.**
Serve the app from a fixed private address (an Electron custom scheme) instead of a
local port. Saved progress and imported songs then stay put whatever happens to the
port, and no code that reads or writes them has to change. On top, the main process
writes an automatic backup file now and then, using the existing backup format.
*Not proven:* whether MIDI access, the light service and the recorder all work from a
custom address. That needs a short experiment before committing.

**Option B: the main process owns the data in a file.**
A JSON file in the profile folder with atomic writes and the last three copies kept,
behind the `store` wrapper the app already has (`app.js:98`). More robust, but much more
work, because of how the app uses storage today:

- Settings and course progress are read while the page's code is still loading
  (`app.js:102`, `course-ui.js:166`), so the data must be in memory before any of it
  runs.
- The interface needs delete and list as well as get and set, and writes that are
  confirmed and kept in order: reset reloads the page at once (`app.js:1158`), backup
  walks every key (`renderer/backup-format.js:131`), and course saving retries failed
  writes (`course-ui.js:170`).
- Several files skip the wrapper and use browser storage directly (`support.js` is one).
- Imported songs need their own move out of the browser's database.

**Either way, the one-time move must not trust an empty source.** Only the default
address (port 47821) holds the old data. If that address cannot be reached on the first
start after the update, the move is retried on a later start; it is never marked "done"
from an empty read. Android and iOS are unaffected: their page address does not change.

**And either way:** an explicit list of saved keys with an owner each. "Reset progress"
uses that list. Today it matches key names by pattern (`app.js:1155-1163`), which a new
key can slip past.

### 4.2 `app.js` is 7,280 lines with 94 shared variables

About 2,300 of those lines are the self-test, the performance probe and demo scripts,
shipped inside the production file. Three test files work by cutting pieces out of the
source text and running them.

**Design: take pieces out when a feature touches them, not as one big rewrite.**

- `nav.js` first (2.1 needs it).
- A single play-session object, `{ kind: 'song' | 'freeplay' | 'lesson' | 'game' |
  'exercise' | 'course', ... }`, replacing the six separate flags that decide what the
  play screen is doing.
- Self-test, probe and demos move to `renderer/selftest/`, loaded only when the page is
  opened with the self-test flag.
- Tests import modules instead of cutting source text.

### 4.3 Three learning systems side by side

The old lesson list (`app.js:179`), the course, and the toolbox with its games each keep
their own progress, and course steps borrow the toolbox's state object. With the
activity registry from 2.3, the toolbox and games become registry entries and the old
lesson list is retired. Retiring it needs a one-time carry-over of its progress and
badges, so nobody loses what they earned there.

### 4.4 Expressive-keyboard handling has gaps

The app never reads the message in which a keyboard announces its expressive zone layout
and bend range; the bend range comes only from the Keylight setting (default 12, pushed
into the sound engine at start, `app.js:1100`). The sustain pedal is one global switch.
This is fine for a LUMI. It will be wrong for other expressive keyboards, and Jam leans
on it. Fix: read the zone messages and let them set the bend range, and track sustain
per channel.

### 4.5 Platform checks are scattered

Conditions like "Windows or a phone host" are repeated through the code, iOS borrows the
`android` style class, and the rules for which links and USB devices are allowed exist
in four languages. Fix: one `platform.js` that answers capability questions (has
Bluetooth, has USB lights, is touch), a style class per platform, and the allow rules in
one data file every host reads.

### 4.6 Smaller items

- **Docs are out of date.** The README says the iOS port is deferred and Android has no
  Bluetooth. `COURSE.md` calls saved course progress "planned". The course schema marks
  five step types as not existing, which do exist.
- **Test gaps.** No direct tests for scoring, the views, the recorder, the lights or the
  sheet-music importer.
- **A leftover privacy leak in the support report.** "Jane Doe's iPad" becomes
  "Jane [name]'s iPad": the first name of a two-word owner name survives.

---

## 5. Smaller additions worth considering

Ideas, not findings. Each should be checked against what already exists before it is
planned.

- **A standalone metronome** in Practice. The click exists but only runs inside a song.
  It falls out of the tempo clock in section 3 almost for free.
- **A daily warm-up**: a five-minute mix made from the registry, weighted toward what
  the player got wrong recently. Needs the practice stats from 2.3.
- **Move to another device**: with the automatic backup from 4.1, moving everything
  to another device becomes "pick the latest backup" instead of remembering to make one.

---

## 6. Suggested order

1. **Navigation stack, open course order, support reminder rule, the wrong tooltip.**
   Small, visible, low risk. All of section 2 except the Practice tab.
2. **Saved-data fix (4.1).** A short experiment on option A first. Before Practice and
   Jam add new saved data.
3. **Practice tab and activity registry.** Retires the old lesson list on the way.
4. **Jam version 1**, starting with the voice contract, then the clock and the drum kit.
5. **Expressive-keyboard fixes**, before or with Jam.

Airwave runs beside all of this at the tester's pace. No Keylight code changes until his
answers are in.

The `app.js` split is not a step of its own. Each step above takes its piece out.

---

## 7. Decisions that are yours

1. **Nav bar:** does Practice take the Achievements slot, with Achievements moving onto
   Home?
2. **Course order:** *Guided* by default with "Start anyway", or *Open* by default?
3. **Support dialog:** did you see it repeatedly in a normally installed copy, or only
   in test builds? And do you want the 14-day reminder at all, given the app currently
   asks once and never again?
4. **Jam:** is version 1 as scoped the right size, or smaller (drums and one loop)?
5. **Airwave:** shall I send the tester the six checks, including the optional uninstall
   of Ultraleap's app?
6. **What to build first.**
