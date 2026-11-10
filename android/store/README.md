# Google Play store graphics

| File | Size | Play requirement |
|---|---|---|
| `icon-512.png` | 512 x 512, 32-bit PNG with alpha, ~370 KB | App icon: 512 x 512, 32-bit PNG, up to 1 MB. Full-bleed square (Play rounds the corners itself), cropped from `assets/icon.png`. |
| `feature-graphic-1024x500.png` | 1024 x 500, 24-bit PNG, no alpha, ~350 KB | Feature graphic: exactly 1024 x 500, JPEG or 24-bit PNG (no alpha). |
| `feature-graphic.source.html` | | Source of the feature graphic. Replace the `file://FILL` prefixes with this repo's absolute path, then render with the Electron script (`electron render.js <outdir> 1024 500 feature-graphic.source.html`, content size). |

## Screenshots (taken from the debug build on the Android emulator, real app screens, no device frames)

Rules (verify on Google's "Add preview assets" help page; they change): PNG or JPEG (24-bit, no alpha), each side 320 px to 3840 px, the longer side at most 2 times the shorter side; 2 to 8 screenshots per device type; for recommendations to larger-screen surfaces use at least 1080 px on the short side.

| Set | Required | Suggested size |
|---|---|---|
| Phone | at least 2 | 1080 x 1920 (9:16) or 1080 x 2400, portrait |
| 7-inch tablet | optional, strongly advised (the app targets tablets) | 1200 x 1920 or 1920 x 1200 |
| 10-inch tablet | optional, strongly advised | 1600 x 2560 or 2560 x 1600 |

Take them from the emulator in the app's real state (a song playing, the lesson course, sheet music, Playground). Do not add fake device frames or claims that the app does not support. A promo video is optional (a YouTube URL).

Produced (8 each, 24-bit PNG without alpha; the emulator's own status bar is in the frame, set to 10:00 and full battery):

| Folder | Size | Emulator setting |
|---|---|---|
| `screenshots/phone/` | 1080 x 1920 (9:16) | `wm size 1080x1920`, density 420 |
| `screenshots/tablet7/` | 1920 x 1200 | `wm size 1920x1200`, density 320 (a 960 x 600 dp page) |
| `screenshots/tablet10/` | 2560 x 1600 | `wm size 2560x1600`, density 320 (a 1280 x 800 dp page) |

Files: `01-home`, `02-course-map`, `03-lesson` (the five-finger keyboard diagram), `04-ear-training`, `05-rhythm`, `06-player` (falling notes and sheet music), `07-library` (Chopin filter), `08-settings`. The Bluetooth dialog is not included: its device list needs hardware. The course card shows 20 % (seeded progress), which is a real state, not a claim about the app.
