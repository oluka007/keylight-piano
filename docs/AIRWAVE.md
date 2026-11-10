# Airwave MIDI consumption and camera fingering

These standalone renderer modules provide an integration boundary for the parent
application. This change does not wire Settings, note handling, or audio in app.js.
It requests no MIDI permissions, opens no camera, and installs no runtime.

## Two distinct hardware routes

The Airwave host MIDI route requires host software that already produces gesture
CCs. Feed that software's explicitly selected MIDI input into `createAirwave`.
The decoder consumes that stream; MIDI CCs contain no fingertip landmarks and
cannot supply camera fingering evidence.

The Ultraleap SDK route would require a separate native tracking service, device
compatibility testing, calibration and a renderer transport for hand observations.
No such service is implemented here. Public runtime support for Airwave on Apple
Silicon remains unproven. **Full Ultraleap camera replacement remains an unverified
hardware experiment. This change does not establish IR170 support or drive IR170.**
No proprietary runtime or SDK is redistributed.

Ordinary camera tracking continues through MediaPipe with two hands, two-point
key-row calibration and the existing 66 ms throttle (approximately 15 inference
frames per second). A requested 30 fps video stream is not 30 fps inference.
The older `HAND-TRACKING.md` description of 30 detections per second does not
describe this throttle.

## Gesture controller API

```js
import { createAirwave, decodeAirwave } from './airwave.js'

const airwave = createAirwave({
  onExpression: (expression) => audio.setAirExpression(expression)
})
airwave.selectInput(gestureInput, [midiInput, midiInput2])
airwave.setEnabled(true)
```

The parent supplies an explicitly chosen Web MIDI `MIDIInput` object; there is no
automatic device-name matching or fallback to the piano. Pass **every** current
piano input in the second argument. A port with a matching ID is rejected with
`input-conflict`, detached and reset. When piano input selection changes, call
`selectInput` again with the updated piano inputs before routing further events.
Never route gesture input to the piano's `handleMidiMessage` handler.

`selectInput(port, pianoInputs = [])` adds `midimessage` and `statechange` listeners
without replacing other listeners. `selectInput(null)` detaches. It does not call
`requestMIDIAccess`, select a port, or manage the piano's listeners.

`setEnabled(boolean)` starts disabled and clears all previous values on every
call. Selection, disable, replacement, `disconnect()` and `dispose()` emit the
neutral `{ raise: 0, tilt: 0, grasp: 0 }`. `disconnect()` keeps the enable setting
but forgets the port; a port's disconnected state event invokes it automatically.
`dispose()` disables and detaches. Reconnection requires explicit reselection.

For a parent that already routes MIDI, use `consume(data, sourceId)` instead of
dispatching the same message through both paths. It accepts only the selected
port's ID while enabled and connected. It returns the current expression for an
accepted CC, or `null` for ignored input. Missing source IDs are ignored.

`decodeAirwave(data)` accepts exactly three bytes, a channel CC status (0xB0 through
0xBF), a supported controller and integer value 0..127. It returns
`{ control, value, channel }`, where value is divided by 127 and channel is 0..15;
malformed, unrelated and note messages return `null`.

| CC | control |
| --- | --- |
| 21 | grasp |
| 22 / 23 | slideLeft / slideRight |
| 24 / 25 | glideLeft / glideRight |
| 26 / 27 | raiseLeft / raiseRight |
| 28 / 29 | tiltLeft / tiltRight |
| 30 / 31 | flexLeft / flexRight |

All values, including tilt, are unipolar **0..1**, with no inferred signed centre.
The expression callback receives only `{ raise, tilt, grasp }`. Raise and tilt
are the arithmetic mean of received left/right values, using the sole received
side until both arrive. Grasp is CC21. Channels are accepted independently by the
decoder but the controller uses the latest value for each named control across
channels, rather than adding values or generating notes. Slide, glide and flex
remain available as diagnostic gesture data and do not alter expression.

`getState()` and the lifecycle methods return a detached snapshot:
`{ enabled, connected, status, gestures, expression }`. Status is `disabled`,
`waiting`, `receiving`, `disconnected`, or `input-conflict`. The parent renders
these strings and maps them to UI text as needed. No input names, IDs or raw MIDI
packets are included in snapshots or emitted to logs. Values remain held until
reset or changed; the CC protocol supplies no observation timestamp or reliable
hand-presence signal, so a silent host that remains connected cannot be diagnosed
as disconnected by this controller.

## Camera observation API

`HandTracker` retains its existing methods, `hands`, `lastSeen`, and `onFrame`.
Every detected hand now also has `confidence` and `observedAt`. The exported
`handObservations(result, observedAt, mirror = false)` performs the same conversion
for a MediaPipe result, including the existing non-mirrored handedness swap.
Missing handedness metadata produces confidence zero rather than confident
identity. Confidence is the model's handedness score, **not a per-fingertip,
contact, or overall landmark accuracy score**.

`tracker.getObservation()` returns:

```js
{
  active: true,
  calibrated: true,
  observedAt: 1000,
  fingertips: [
    { side: 'right', finger: 2, t: 0.5, off: 0,
      confidence: 0.95, observedAt: 1000 }
  ]
}
```

Times are milliseconds on the `performance.now()` clock, captured at inference,
including frames with no hands. Finger numbers are 1..5, thumb first. `t` and
`off` are the existing aspect-correct key-row projections, left unsnapped and
unclamped so coaching can assess uncertainty. `active` requires running and active
tracking. Stopping clears hands and the observation timestamp. Drawing and hover
badges can continue to use `fingertipsOverKeys()` unchanged.

## Note-on coaching API

```js
import { attributeFingering } from './coaching.js'

const feedback = attributeFingering({
  pitch,
  note: matchedNote,
  keys: geo.keys,
  observation: tracker.getObservation(),
  now: performance.now()
}, { maxOff: 0.12 * 24 / kbKeys() })
```

Call once for a genuine key MIDI note-on, with the pitch after the parent's normal
keyboard mapping. MIDI is the source of note truth. `note` is that event's matched
song note `{ pitch, hand, finger }`, not the first upcoming note or a different
member of its chord. For the current player, snapshot the pending score entries
for this pitch immediately before `player.noteOn(pitch)`, then find the entry that
transitioned to `state === 'hit'` during that call. Pass its `.note` only if exactly
one entry transitioned. This works for both wait-mode `markHit` and timed
`judgeHit`, whose result objects do not currently return the note itself. Pass
`null` when no unique matched note is available. Capture the camera observation
and event time at the key press, before any asynchronous rendering work.

`keys` uses the existing ordered keyboard geometry `{ pitch, cx, w, black }`, with
centres increasing from left to right in the same pitch range as the MIDI event.
The helper projects unsnapped tips into that geometry, uses the existing black-key
distance weighting (1.6), and accepts only tips within 0.65 target-key widths.
Two fingertips near the target are ambiguous, even across hands or when one has
low confidence. Neighbouring-key distance differences within 0.15 target-key
widths also produce unknown. This avoids picking the first finger or using the
suggested hand to hide a competing candidate.

Options default to `{ maxAgeMs: 200, minConfidence: 0.8, maxOff: 0.12,
ambiguityRatio: 0.15 }`. Frame and fingertip timestamps must both be at or before
the event time, at most 200 ms old; exactly 200 ms is accepted. Confidence must
be at least 0.8. The parent may tune these finite thresholds for its geometry.

The return value is `{ status, reason, statusText, pitch, observed, affectsScore }`.
`status` is `match`, `mismatch`, or `unknown`. A confident unique attribution
returns `observed: { side, finger, confidence, ageMs }`, then compares **both** hand
and finger to that note's suggestion. Unknown returns `observed: null`.
Reasons are `no-suggestion`, `wrong-note`, `inactive`, `uncalibrated`, `stale`,
`missing-key`, `missing-finger`, `ambiguous`, `low-confidence`, `match`, or
`mismatch`. `statusText` supplies display text for the parent's UI.

`affectsScore` is always false. The helper never mutates the event, note or score;
unknown must never reduce score, streak, accuracy or stars. Confident mismatch is
also advisory here. A two-point camera projection cannot prove which finger
physically pressed a key, resolve occlusion, or distinguish hovering from contact.

## Verification

Run without hardware, camera access, MIDI access, or an app launch:

```sh
node scripts/test-airwave.js
node scripts/test-coaching.js
npm test
```

The synthetic tests exercise every gesture CC on all 16 channels, normalization,
malformed input, separate port selection and lifecycle reset; real projection of
synthetic landmarks, confidence and timestamp retention, exact-note fingering,
wrong-finger feedback, stale and ambiguous evidence, threshold boundaries, hover
compatibility and stopped tracking. The existing package test command is unchanged;
the parent must explicitly include the two new scripts in its eventual test gate.
No hardware, host software, SDK route or parent UI/audio integration is verified
by these tests.
