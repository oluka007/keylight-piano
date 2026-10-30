# Filming Keylight with the real keyboard

Keylight can record its own picture and sound while you play (a "take"). Film your hands
with a phone at the same time, and `scripts/sync-take.py` lines the two up from the sound
and stacks them: Keylight's falling notes on top, your hands and the key lights below.

## Before you start

1. **Sound out of the MacBook speakers.** No AirPods or other Bluetooth headphones: they
   add a delay, and the phone has to hear the piano to line the videos up. Volume around
   60–70 %.
2. **Turn takes on.** In Keylight, Settings → Sound → **Record my takes**. From then on,
   every song you play is saved to **Movies › Keylight** with the app's own sound. Turn
   it off again when you're done filming.
3. **Phone settings (iPhone).** Settings → Camera → Record Video → **1080p at 60 fps** (4K
   at 60 is fine too). Turn **HDR Video** off if you can; HDR footage works, but the
   colours of the key lights come out more natural without it.
4. **Lock the exposure.** In the Camera app, hold your finger on the keyboard until
   **AE/AF LOCK** shows, then drag the sun icon down a little so the key lights don't
   blow out to white.
5. **Light.** Normal room light, no bright window behind the keyboard. A slightly dim
   room makes the key lights pop.

## The shots

Film landscape, keep the phone still (a stand, a stack of books or a shelf), and do one
song per video.

| # | What | Camera | Keylight | Length |
|---|------|--------|----------|--------|
| 1 | **Playing a song** (the main video) | Behind and above your shoulder, or 45° to the side, the whole keyboard and both hands in frame | A song you can play without many mistakes. 0.5x or 0.75x speed is fine | 30–45 s |
| 2 | **The key lights, close up** | Low and close, looking along the keys at an angle, no hands needed | Press **Watch** on a busy song (Für Elise or Canon in D) so the keys light up on their own | 10–20 s |
| 3 | **Learning in Wait mode** | Straight down from above, hands on the keys | Speed **Wait**, Labels → **Fingers**. The song waits for each key; play slowly | 20–30 s |
| 4 | *(optional)* **Light styles** | Close up on the keys | In the Playground hold a chord and press the keyboard's mode button to step through Piano, Pro, Stage and your colour | 10 s |

For each video:

1. Start the phone recording.
2. In Keylight, press play. The take starts by itself (a red **REC** shows over the notes).
3. Play. When the song ends and the results show, the take saves itself.
4. Stop the phone a couple of seconds later.

Mistakes and talking are fine; the lining-up uses the whole song. Do as many tries as you
like and keep the best one.

## Handing the videos over

AirDrop the phone videos to the Mac (they land in Downloads). The Keylight takes are in
Movies › Keylight, named `keylight-take-<date>-<time>.mp4` with a `.json` next to each.

## Making the combined video

```sh
scripts/sync-take.py --app ~/Movies/Keylight/keylight-take-20261030-201500.mp4 \
  --camera ~/Downloads/IMG_1234.MOV --out ~/Desktop/keylight-play.mp4
```

It prints how far apart the two recordings started and how sure it is, then renders the
part where both were recording. Useful options (`scripts/sync-take.py --help` lists all):

- `--layout stack` (default: notes on top, camera below), `pip` (camera full screen with
  the notes as an inset) or `vertical` (1080×1920 for phones).
- `--audio app` (default: Keylight's clean sound), `camera` (the phone's sound) or `mix`.
- `--max-mb 10` keeps the file under Discord's 10 MB upload limit.
- `--offset <seconds>` sets the gap by hand if the sound match fails (for example when
  the phone couldn't hear the speakers).
