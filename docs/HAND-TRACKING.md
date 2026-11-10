# Hand tracking (first version)

The original app's Airwave add-on was a camera on a stand above the keys. It watched your
hands and gave feedback on which finger played which note. Keylight now does a first
version of the same thing with any camera you already have.

## What you need

| Camera | How well it works | Notes |
|---|---|---|
| **iPhone in Desk View** (Continuity Camera) | Best | Mount the iPhone on top of the MacBook screen (or on a stand). macOS's Desk View uses the ultra-wide camera to show the desk from above, which is exactly the angle hand tracking wants. Your iPhone already shows up as a camera on this Mac. |
| **iPhone on a stand or phone clamp above the keys** | Very good | Pointing straight down, about 40–60 cm above the keyboard. Pick it as a normal Continuity Camera. |
| **USB webcam on a clamp / gooseneck** | Good | Any 720p+ webcam looking down at the keys. Your Mac lists one as "Integrated Camera". |
| **MacBook's built-in camera** | Poor | It faces you, so it sees the backs of your hands at a low angle. Fine for trying it out only. |

Lighting: a normally lit room is enough. Avoid a bright window behind the keyboard.

## How to use it

1. **Settings → Hand tracking**: pick the camera and press **Start camera** (macOS asks for
   camera permission the first time).
2. Make sure the whole 24-key row is in the picture, then press **Find the keys**. The
   keyboard lights its first and last key, and the camera finds them. If that doesn't
   work (glare, an angle where the lights are hidden), use **Click the end keys** and
   click the leftmost and rightmost key in the picture.
3. Open a song. Small numbered circles appear above the on-screen keys your fingers are
   over (1 = thumb … 5 = little finger; blue = left hand, orange = right). The camera
   button in the player shows a small live picture with your hands drawn on it.
4. **Mirror the picture** only if your camera shows a mirrored image (hands come out
   swapped).

## How it works

- Google's **MediaPipe Hand Landmarker** (Apache-2.0, runs locally, no video leaves the
  computer) finds 21 points per hand, up to two hands. The camera requests 30 fps and
  inference is throttled to about 15 detections per second.
- Calibration stores where the first and last key sit in the picture. Each fingertip is
  projected onto that line to get a position along the 24 keys, then snapped to the
  nearest real key in the on-screen keyboard's own geometry (black keys only when the tip
  is close to one).
- Fingertips too far from the key row (in the air, resting on the case) are ignored.

## Limits of version 1

- One camera gives no depth, so a finger hovering just above a key and a finger pressing
  it look the same. The keyboard itself still decides what was played; the camera only
  tells you which finger is where.
- Black vs white key under a fingertip is a best guess from left-right position.
- The calibration assumes a fairly straight view of the key row. A strong perspective
  angle makes the far end less accurate.

## What comes next (in order of value)

1. **Fingering feedback**: advisory comparison is implemented behind Settings > Advisory
   finger coaching. It uses a MIDI press plus fresh, sufficiently confident observations;
   uncertain attribution is not judged. It never changes the note score. Validate accuracy
   on hardware before considering scored fingering.
2. **Get ready hints**: when practice waits for a note, light the key brighter once the
   correct finger is above it, and show the suggested finger on screen.
3. **Hand posture**: flag collapsed fingers or a dropped wrist from the 3D landmarks.
4. **Better calibration**: four-corner calibration (perspective correction) and
   automatic re-finding of the keyboard if it moves.
5. **Depth**: iPhones with LiDAR (Pro models) or two cameras could tell hovering from
   pressing.
