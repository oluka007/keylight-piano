# Jam mode: module contracts (version 1)

Status (2026-11-09): design for the build. See `NEXT-ARCHITECTURE.md` section 3 for why.

Jam is a loop-and-layer sketchpad: four tracks (one drum track, three instrument tracks),
four loop slots per track, a shared tempo clock, a scale lock, delay and reverb. It has
its own screen. Nothing of any other maker's app, presets or samples is used; all sounds
are synthesised in code.

Files live in `renderer/jam/`. Pure modules take no browser globals so they run under
Node tests. Times inside clips are in **beats** (quarter notes, float); audio times are
seconds on the AudioContext clock.

## 1. `renderer/jam/clock.js` (pure)

```js
createClock({ now, setTimer, clearTimer, bpm = 100, beatsPerBar = 4, lookahead = 0.12, interval = 25 })
```

- `now()` returns seconds (the audio clock in the app, a fake in tests). `setTimer(fn, ms)`
  / `clearTimer(id)` default to `setInterval` / `clearInterval`.
- `start(at = now() + 0.05)`: beat 0 falls at `at`. `stop()`. `running`.
- `setBpm(bpm)`: clamps 40..220, keeps the current beat position continuous.
- `beatAt(time)`, `timeOfBeat(beat)`, `bpm`, `beatsPerBar`, `barOf(beat)`.
- `onWindow(fn)`: while running, every `interval` ms calls
  `fn({ fromBeat, toBeat, timeOfBeat })` for the next not-yet-covered stretch of beats up
  to `now() + lookahead`. Windows never overlap and never leave gaps, also across
  `setBpm`. Returns an unsubscribe function.
- `swing` (0..0.6): helper `swungBeat(beat)` delays every second sixteenth by
  `swing * 0.25 / 2` beats. Stored on the clock; consumers apply it.

## 2. `renderer/jam/looper.js` (pure)

Data:

```js
// a clip
{ lengthBeats, events: [ { t, dur, pitch, vel, lift, g: [ { dt, k, v } ] } ] }
// t: start beat inside the clip (0 <= t < lengthBeats); dur in beats; vel 1..127;
// lift 0..127 (release speed, 64 when unknown); g: gesture stream relative to the note
// start, dt in beats, k one of 'bend' (semitones), 'press' (0..1), 'slide' (0..1)
```

API:

```js
createLooper({ beatsPerBar = 4, slots = 4 })
```

- `beginTake({ startBeat, overdubOnto = null })`; `takeNoteOn(id, pitch, vel, beat)`;
  `takeGesture(id, k, v, beat)`; `takeNoteOff(id, lift, beat)`; `endTake(beat, { quantise = 0 })`
  returns a clip. `id` is any key that pairs on/off (channel:pitch).
- Length rule: the take's span is rounded to the nearest of 1, 2, 4, 8 bars (never less
  than 1 bar; a span of under a quarter bar past a boundary rounds down). Event times
  wrap modulo the length. A note still held at `endTake` is closed there.
- `quantise`: 0 off, or a grid in beats (0.25 = sixteenths, 0.5 = eighths). Moves note
  starts to the nearest grid line; durations keep at least half a grid step.
- Overdub: `overdubOnto` is an existing clip; the result has its length and both event
  sets. Gesture streams are thinned: drop a gesture closer than 1/96 beat to the previous
  one of the same kind with a value change under 0.01 (0.05 semitone for bend).
- `eventsInWindow(clip, fromBeat, toBeat)`: the events whose start falls in
  `[fromBeat, toBeat)` of global time, the clip looping forever from beat 0. Each result
  is `{ event, beat }` with `beat` the global start beat. Handles windows longer than
  the clip and windows crossing the loop point.
- Undo: `pushUndo(slotKey, clip)` / `popUndo(slotKey)`, depth 8 per slot.
- `serialise(session)` / `parse(json)`: versioned (`{ v: 1, bpm, swing, key, scale, tracks: [...] }`);
  `parse` rejects anything malformed and clamps numbers (never trust a stored file).

Drum track clips use the same clip shape; pitch is the drum index 0..7 and `dur` is
ignored. A step grid is a view over such a clip: `gridFromClip(clip, steps = 16)` and
`toggleStep(clip, drum, step, vel = 100)` (steps are sixteenths over one bar; a longer
clip has `16 * bars` steps).

## 3. `renderer/jam/scales.js` (pure)

- `SCALES`: major, minor, major pentatonic, minor pentatonic, blues, dorian, chromatic.
- `inScale(pitch, key, scaleId)`, `snap(pitch, key, scaleId)` (nearest scale note, ties
  go down), `scalePitches(key, scaleId, lo, hi)`.

## 4. Audio: tracks (additions to `renderer/audio.js`)

Additive only. No existing export changes behaviour. Tracks never touch `voices`,
`pedalled` or `scheduled`, so the global `setInstrument`, `stopAll` and
`cancelScheduled` leave them alone.

```js
createTrack({ kind = 'notes', instrument = 'lead', level = 0.8, send = 0 })
```

A notes track returns

- `noteOn(pitch, velocity, when = null)` -> handle, or `null` (disposed track, or the
  sampled piano not loaded). Wraps a `Voice` built with this track's instrument and
  output, never the global instrument. The handle is internal state (`done`, `released`
  are readable); pass it back to the gesture calls.
- `noteOff(handle, { lift = 64, when = null })`: release time is the instrument's own
  `shape.release` times `liftFactor(lift)`: 2x at lift 0, 1x at 64, 0.35x at 127.
- `bend(handle, semitones)`, `press(handle, v)`, `slide(handle, v)`: applied at once;
  a no-op once the note has been released, stolen or ended.
- `setInstrument(id)` -> bool (affects new notes only), `instrument()`, `setLevel(v)`,
  `setSend(v)`, `setMute(bool)`, `silence()` (release this track's voices now),
  `dispose()` (silence, disconnect; later `noteOn` returns `null`).

A drums track (`kind: 'drums'`, trim 1 instead of 0.5) returns
`hit(index, { when = null, velocity = 100 })` plus `setLevel`, `setSend`, `setMute`,
`silence`, `dispose`. Drum hits are not counted by `jamVoiceCount()`; they clean up
their own nodes.

Other exports: `jamFx()` (the shared effects unit, created on first use; it also calls
`initAudio()`), `jamVoiceCount()`, `liftFactor(lift)`.

- Routing: voice -> track gain -> `synthIn`; track gain -> send gain -> `jamFx().input`.
  Tracks do not pass through the Airwave expression stage. The track gain is
  `level x 0.5` for notes (four default tracks sum to about one hand of chords on the
  normal path) and `level` for drums. Level and send changes glide linearly over 10 ms.
- One allocator for all tracks: at most 32 track voices. When full, steal first a
  released note still fading, then the oldest voice started with a `when` (a replayed
  note), then the oldest live one. A voice leaves the allocator when it ends (its
  oscillator or sample source fires `ended`), is stolen, or on `silence()`/`dispose()`.
  A released note still counts until it has faded out.
- `createTrack` and `jamFx` call `initAudio()`; they need a user gesture like any audio.

## 5. `renderer/jam/fx.js`

```js
createFx(ctx, destination) -> { input, setDelay({ beats, bpm, feedback, mix }), setReverb({ size, mix }), dispose() }
reverbImpulse(sampleRate, size) -> [left, right]   // Float32Arrays, deterministic
reverbSeconds(size)                                // 0.4 s at size 0 to 3 s at size 1
```

- Delay: `DelayNode` (time = beats x 60 / bpm, clamped to 3.9 s) with the feedback gain
  capped at 0.75 and a 3.2 kHz low-pass in the loop. Defaults: 0.375 s, feedback 0.35,
  mix 0.25. Each argument is optional.
- Reverb: `ConvolverNode` whose stereo impulse is generated in code (seeded generator,
  exponential decay to -60 dB over its length, so identical on every run). No sample
  files. Defaults: size 0.5, mix 0.25.
- Output goes to `destination` (the synth bus, before the limiter). A track's send is
  what reaches it; a silent input gives silence.

## 6. `renderer/jam/drums.js`

```js
DRUMS = [kick, snare, closed hat, open hat, clap, low tom, high tom, rim]   // { id, name }, index 0..7
playDrum(ctx, out, index, { when = null, velocity = 100 }) -> { stop(at) }
```

All synthesised (sine sweeps, filtered noise from a seeded buffer). A closed hat cuts a
ringing open hat on the same `out`. Each hit disconnects its nodes when it ends. Peak
levels at velocity 127: kick 0.80, tom 0.70, open hat 0.59, snare 0.45, closed hat 0.42,
clap 0.40, rim 0.30; velocity scales level.

## 7. `renderer/jam/session.js`, `jam-ui.js`, `jam.css` and the screen (as shipped)

```js
mountJam(root, deps) -> { destroy(), noteOn(pitch, vel, channel), noteOff(pitch, lift, channel),
                          bend(channel, semis), press(channel, v), slide(channel, v), state() }
```

`deps`: `{ audio: { audioContext, initAudio, createTrack, jamFx, click, instrumentList, sampledPianoStatus? },
lights: { show(pitches, colour), clear() } | null, store: { get(key, fallback), set(key, value) },
exit(), download?(filename, bytes, mime) }`. `lights` is null when no light-capable keyboard is
connected; the app ignores `colour` and lights the keys in the user's own colour. Without `download`
the screen saves through a Blob link. The sampled piano is offered only when `sampledPianoStatus()`
says it is ready. Mounting on an element that already holds a Jam screen destroys the old one first.

`session.js` is the pure state container (no DOM, no audio; `scripts/test-jam-session.js`). State:
`{ v, bpm, swing, key, scale, tracks[4] (0 drums, 1 bass, 2 chords, 3 lead; each { kind, name,
instrument, level, send, mute, slots[4], active: [] | [slot] }), prefs { scaleLock, snap, quantise,
metronome, delay, reverb, track, slots }, playing, queue, rec, canUndo, announce }`. The part
`looper.serialise` knows is stored as it is and `prefs` travels beside it in the same JSON. Bad stored
data gives the default session (a drum track with a starter beat in slot 1).

Record state machine, driven by `onBar(beat)`: armed, recording from the next bar line, stopping,
closing, idle. Arming while stopped adds a one-bar count-in. The engine looks ahead of the audio, so
a take that ends is first committed at once ("closing") and rebuilt by `settle(nowBeat)` once the
audio reaches the bar line, so notes played just before it are kept; notes played up to a quarter
beat before the bar line a take starts on are kept too (pre-roll). A take ends at 8 bars at the
latest, or at once when the transport stops. Fresh takes keep their place in the bars they were
played in; overdubs align to the loop. The click sounds with the metronome on, through the
count-in, and on the bar line that starts a take.

Playback: on each clock window the screen splits the window at bar lines (queued loop changes and the
record state machine move there), schedules every unmuted track's active clip with `eventsInWindow`,
and applies note ends and gestures of notes that have gestures from a 20 ms sweep.

Storage: the session is stored under `lumi.jam` through `deps.store` (debounced 500 ms, flushed on
destroy). It is creative work, not progress: "Reset progress" keeps it and says so; backups include it.

App wiring: Practice has a Jam card (`ACTIVITIES` entry `jam`); `screen-jam` is a transient screen, so
Back, Escape, Android back and switching tabs all destroy the screen and Back lands on Practice. While
it shows, `handleNoteOn`/`handleNoteOff` (with the key's release velocity), pitch bend (in semitones,
with the app's bend range), channel and poly pressure and CC 74 go to the mounted screen instead of the
synth; sustain and device handling are unchanged. Jam counts toward the daily goal while its transport
runs or a key was played in the last 20 s.
