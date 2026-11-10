<h1 align="center">Keylight</h1>

<p align="center">Follow the light. A free, open-source piano teacher for light-up keyboards.</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="Licence: MIT"></a>
  <a href="https://github.com/scizerss/keylight-piano/releases/latest"><img src="https://img.shields.io/github/v/release/scizerss/keylight-piano?label=release" alt="Latest release"></a>
  <img src="https://img.shields.io/badge/platforms-Mac%20%7C%20Windows%20%7C%20Android-lightgrey.svg" alt="Platforms: Mac, Windows and Android">
  <a href="https://ko-fi.com/scizers"><img src="https://img.shields.io/badge/Support%20on%20Ko--fi-FF5E5B?logo=ko-fi&logoColor=white" alt="Support on Ko-fi"></a>
</p>

<p align="center">
  <a href="https://github.com/scizerss/keylight-piano/releases/latest">Download</a> ·
  <a href="docs/GUIDE.md">User guide</a> ·
  <a href="docs/REFERENCE.md">Reference</a> ·
  <a href="https://keylightpiano.app">Website</a> ·
  <a href="CONTRIBUTING.md">Contribute</a>
</p>

<p align="center">
  <img src="docs/media/wait-mode.gif" width="760" alt="Twinkle Twinkle in Wait mode: the falling notes stop at the keyboard until the right key is played, then the song moves on">
</p>

Keylight shows falling notes over a keyboard that looks like yours, lights the next key on the keyboard itself, and runs lessons, songs, games and a Playground on your own computer with no account.

## Download

| Platform | File | Notes |
|---|---|---|
| Mac | Disk image (`.dmg`) | Apple silicon, macOS 13 or newer. Open the image and drag Keylight to Applications. The app is ad-hoc signed, not notarised, so macOS refuses to open it until the download quarantine is cleared: the image includes the steps. |
| Windows | Installer (`.exe`) | Windows 10 or 11, 64-bit. **Beta.** The wizard installs for the current user without administrator privileges. Keylight is not code-signed, so the first time Windows may say "Windows protected your PC": click **More info**, then **Run anyway**. |
| Android | APK file (`.apk`) | Android 8.0 or newer. **Beta.** Installed from the APK file. |
| iPhone and iPad | coming soon | They can reach the App Store if supporters cover Apple's 99 US dollar yearly developer fee; until then the app can be installed by sideloading, see [docs/IOS.md](docs/IOS.md). |

All files are on the [latest release page](https://github.com/scizerss/keylight-piano/releases/latest).

Windows and Android are beta and have not yet been tested on many real devices. If something is wrong, open an [issue](https://github.com/scizerss/keylight-piano/issues) and it gets fixed.

## What it does

### Follow the light

Notes fall toward a keyboard that looks like yours, and the keyboard's own keys light the note to play next. In Wait mode the song stops until you play the right note, so you can learn a piece at your own pace. On a Mac the keys light in full colour and the keyboard's arrow and mode buttons work. The first start runs a short setup that checks the sound, the keys and the lights, and you can run it again from Settings.

<p align="center">
  <img src="docs/media/screen-home.jpg" width="760" alt="The Home screen with today's goal, the next lesson and the course">
</p>

### Add any song, even an MP3

Drop a recording on the window, or use **Add a song** in Search: MP3, M4A, WAV, FLAC, AAC, OGG or AIFF, up to 20 minutes. Keylight listens to the recording and writes the notes, on your computer, and the file is never uploaded. The original recording plays along in sync and keeps its pitch at 0.5x and 0.75x. MIDI and MusicXML files are read as written, and title, artist and cover come from the file.

<p align="center">
  <img src="docs/media/add-a-song.gif" width="760" alt="A recording is added in Keylight: the app listens to it and shows the notes it found">
</p>

### Four views and a sheet-only view

Pick the view that reads best for you, in the middle of a song too: Cascade, Rainbow, Colornote and Classic. **Sheet only** gives the stage to the score for songs that have one, with the line showing where you are and your keys still lighting the way.

<table>
  <tr>
    <td width="400"><img src="docs/media/four-views.gif" width="400" alt="Switching between the four note views while a song plays"></td>
    <td width="400"><img src="docs/media/sheet-only.gif" width="400" alt="The Sheet only view: notes on a staff scroll past a glowing line while the song waits for each one"></td>
  </tr>
</table>

### One hand at a time

Choose left, right or both hands; the app plays the hand you are not practising. Labels can be off, note names or finger numbers. Guided practice goes further: the song is split into phrases, hands separately first, Wait mode first and then faster steps, and it brings back the bars you got wrong.

<p align="center">
  <img src="docs/media/finger-numbers.gif" width="760" alt="A piece with a finger number on every falling note">
</p>

### Course, Practice and Jam

The course has 12 levels and 94 short lessons, from finding middle C, and each level ends with an exam; you can follow it in order or open anything you like, because nothing is locked. The Practice tab holds ear training, rhythm, sight-reading and Play it back with five difficulty levels each, plus scales and chords, games, a metronome and the Playground. Jam gives you four tracks with four loop slots each, and you can export the session as a MIDI file.

<table>
  <tr>
    <td width="270"><img src="docs/media/screen-course.jpg" width="270" alt="The course screen, a map of levels and lessons"></td>
    <td width="270"><img src="docs/media/screen-practice.jpg" width="270" alt="The Practice tab with exercises as cards"></td>
    <td width="270"><img src="docs/media/screen-jam.jpg" width="270" alt="The Jam screen with tracks and loop slots"></td>
  </tr>
</table>

### Two keyboards as one **Beta**

Two 24-key keyboards can be joined as one 48-key row, with two USB cables or snapped together with one cable. On a Mac with the light service each keyboard gets its own frame, so the light styles work across both.

<p align="center">
  <img src="docs/media/two-keyboards.jpg" width="760" alt="The player with a four-octave keyboard made of two joined keyboards">
</p>

## Experimental

- **Camera coach (experimental)** shows numbered finger badges over the keys and compares your fingering with the suggested one. It cannot tell hovering from pressing, and accuracy drops at steep angles.
- **Airwave gestures (experimental)** use the Airwave's hand-gesture MIDI (raise, tilt, grasp) to shape the sound. Finger tracking from the Airwave is being tested with volunteers and is not confirmed to work.
- **49-key ROLI Piano (beta)** shows all 49 keys and works with songs, lessons and the Playground. It was built from a tester's measurements; Mac and ROLI's own driver are still untried.
- **Two keyboards as one (beta)** plays two keyboards as one row of 48 keys. A community tester confirmed the magnetically chained arrangement; the two-cable arrangement still needs hardware reports.

## Works with

- **Keyboards:** LUMI Keys and ROLI Piano M over USB (24 keys). On Android also over Bluetooth. A 49-key ROLI Piano works (**beta**). Two 24-key keyboards can be joined as one 48-key row (**beta**).
- **Mac:** the keys light in full colour and the keyboard's arrow and mode buttons work. macOS 13 or newer on Apple silicon.
- **Windows (beta):** the keys light from the notes. Close ROLI Connect or any music software using the keyboard first. These are not available on Windows yet: brightness slider, the light show after a song, find-the-keys, battery level, arrow and mode buttons.
- **Android (beta):** USB and Bluetooth. Android 8.0 or newer.

Keylight is an unofficial community project. It is not affiliated with or endorsed by ROLI.

## Privacy

- No account, no ads, no analytics, no tracking.
- Songs, recordings, progress and settings stay on your device. Nothing is uploaded, and the app has no server of its own.
- One optional feature on the desktop app goes online: with "Find cover art and lyrics online" switched on, a song's title, artist and length are sent to Apple's iTunes Search service for cover art and to LRCLIB for lyrics, only while you import.

The full text is in [docs/PRIVACY.md](docs/PRIVACY.md).

## Documentation

| Document | What it covers |
|---|---|
| [docs/GUIDE.md](docs/GUIDE.md) | The user guide: setup, songs, course, practice, jam and troubleshooting |
| [docs/REFERENCE.md](docs/REFERENCE.md) | The full reference: install, build, lighting, sound, files and the 49-key keyboard |
| [docs/COURSE.md](docs/COURSE.md) | Course design, the lesson data model and the content licence rules |
| [docs/DEVICE-SUPPORT.md](docs/DEVICE-SUPPORT.md) | Adding support for a keyboard that does not work yet |
| [docs/ANDROID.md](docs/ANDROID.md) | The Android build, signing and validation limits |
| [docs/IOS.md](docs/IOS.md) | The iPhone and iPad app and installing it yourself |
| [docs/PRIVACY.md](docs/PRIVACY.md) | The privacy policy |
| [docs/RELEASING.md](docs/RELEASING.md) | The release checklist |

## Contributing

- Bug reports, feature requests and device reports use the [issue forms](https://github.com/scizerss/keylight-piano/issues/new/choose).
- Pull requests are welcome. Small ones are easiest to review.
- Read [CONTRIBUTING.md](CONTRIBUTING.md) before you start.
- Good first changes: fix a typo in the guide, add a song arrangement under the licence rules in [docs/COURSE.md](docs/COURSE.md), or test on a device and report what happens.
- Before a pull request, run `npm test` and `npm run selftest`; the self-test should end with `SELFTEST done`.

## Build from source

Needs git and Node.js 22.12 or newer.

On an Apple silicon Mac:

```bash
git clone https://github.com/scizerss/keylight-piano.git keylight
cd keylight
npm ci
env -u ELECTRON_RUN_AS_NODE npm start    # run from source
npm test                                 # unit tests (watchdog, takes, Windows build)
```

`env -u ELECTRON_RUN_AS_NODE` is needed when launching from another Electron app, otherwise Electron runs as plain Node.

On Windows, in PowerShell or Command Prompt:

```bash
git clone https://github.com/scizerss/keylight-piano.git keylight
cd keylight
npm ci
npm start                                # run from source
npm test
```

Building the installers, the test flags and the demo-video scripts are in [docs/REFERENCE.md](docs/REFERENCE.md#build-from-source).

## Support the project

Keylight is free and stays free: nothing is locked, and there is no account or subscription. It is made by one person in spare time. Tips pay for the tools used to build and test each release and for keyboards to add support for, and they are what would cover Apple's developer fee so the app can reach the App Store for iPhone and iPad. If it has earned a place on your desk, you can [leave a tip on Ko-fi](https://ko-fi.com/scizers).

## Thanks and credits

- [GRAB](https://www.demix.me/GRAB/) ([source](https://github.com/demixme/GRAB)) by Sam Hocking and the GRAB contributors, whose published research on the Airwave sensor and the wider device protocols helped.
- The Salamander Grand Piano recordings by Alexander Holm, licensed under Creative Commons Attribution 3.0 Unported (CC BY 3.0).
- The 57 advanced pieces are MIDI files from the [Mutopia Project](https://www.mutopiaproject.org), whose volunteers typeset them.
- [ROLILearn4All](https://github.com/ClockworkPirate/ROLILearn4All) (MIT), which the SysEx config-packet encoder in `renderer/lights.js` is adapted from.

Everything bundled keeps its own licence; the full list is in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Licence

MIT, see [LICENSE](LICENSE). Bundled third-party code, models, fonts and samples keep their own licences: see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

The six CC BY-SA 3.0 and 4.0 Mutopia songs live apart as data files, not part of the MIT-licensed code; keep their credit and licence if you copy or adapt them. See [LICENSES/mutopia-songs.md](LICENSES/mutopia-songs.md).
