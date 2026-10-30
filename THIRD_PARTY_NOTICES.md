# Third-party notices

Keylight is MIT-licensed (see `LICENSE`). It bundles or adapts the following.

## ROLILearn4All — MIT
The SysEx config-packet encoder in `renderer/lights.js` (7-bit packing and checksum) is
adapted from [ROLILearn4All](https://github.com/ClockworkPirate/ROLILearn4All), which in
turn ports the ROLI BLOCKS protocol encoding from the original `blocks.py`.
Copyright (c) 2026 ClockworkPirate and contributors; Copyright (c) 2026 Ehsan Sayyad
(upstream ROLI-for-Live code). Full licence: `LICENSES/ROLILearn4All-MIT.txt`.

## Basic Pitch — Apache License 2.0
`renderer/models/basic-pitch/` (model weights) and the Basic Pitch code bundled in
`renderer/vendor/transcribe.js` come from [Basic Pitch](https://github.com/spotify/basic-pitch-ts)
by Spotify AB (full text in `renderer/models/basic-pitch/LICENSE`).

## TensorFlow.js — Apache License 2.0 (parts of tfjs-layers: MIT)
Bundled in `renderer/vendor/transcribe.js` (4.22.0, plus the 3.21.0 copy Basic Pitch
depends on), with seedrandom (MIT), long (Apache-2.0), midi-file and @tonejs/midi (MIT)
and others. Copyright Google LLC; the MIT parts of tfjs-layers: Copyright 2018 Google
LLC, Copyright 2022-2023 CodeSmith LLC.

## music-metadata — MIT
Bundled in `renderer/vendor/metadata.js` (reads tags, cover art and lyrics from audio
files), with strtok3, token-types, file-type, @tokenizer/inflate, uint8array-extras,
@borewit/text-codec, content-type, media-typer, debug and ms (all MIT) and ieee754
(BSD-3-Clause). Copyright Borewit and the respective authors.

## MediaPipe Tasks Vision — Apache License 2.0
`renderer/vendor/mediapipe/` (tasks-vision 0.10.21) and `renderer/models/hand_landmarker.task`
(the hand landmark model, see the
[model card](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Hand%20Tracking%20(Lite_Full)%20with%20Fairness%20Oct%202021.pdf))
by Google LLC. Licence: `renderer/vendor/mediapipe/LICENSE`. Used for camera hand tracking.

The licence of every npm package in the vendor bundles is collected in
`renderer/vendor/LICENSES.txt` (written by `scripts/vendor-licenses.sh` on each
`scripts/build-vendor.sh` run).

## Outfit font — SIL Open Font License 1.1
`renderer/fonts/Outfit-latin.woff2`, Copyright 2021 The Outfit Project Authors.
Licence text in `renderer/fonts/OFL.txt`.

## Electron
The app runs on [Electron](https://www.electronjs.org) (MIT), with Chromium and its
components; their licences travel with the app as `electron-LICENSE` and
`electron-LICENSES.chromium.html`. The Windows build's exe icon and version details are
written with [resedit](https://github.com/jet2jet/resedit-js) (MIT), a build tool that
is not bundled.

## blocksd
The key lights on a Mac are driven by [blocksd](https://github.com/hyperb1iss/blocksd) by
hyperb1iss, installed separately (not bundled). The LED command framing follows the
public notes of the LUMI-lights project and the JUCE BLOCKS protocol definitions.

## Songs and artwork
The built-in songs are public-domain compositions; the arrangements in `renderer/songs/`
were written for this project and are covered by its MIT licence. The cover art in
`renderer/covers/` and the app icon were made with AI image tools for this project and,
to the extent anyone holds rights in them, are released under the project's MIT licence.

## Online lookups
Imported songs can ask the iTunes Search API (cover art) and LRCLIB (lyrics) for
metadata. The hand-tracking model is downloaded from Google's MediaPipe storage only by
`scripts/build-vendor.sh`. Nothing else is downloaded.

## Not affiliated with ROLI
Keylight is an independent, unofficial project. It is not affiliated with, endorsed by
or supported by ROLI Ltd or Luminary ROLI. ROLI, LUMI, Piano M, ROLI Learn and BLOCKS
are trademarks of their respective owners and are used only to say which keyboards
Keylight works with. Keylight contains no ROLI software, firmware, artwork, fonts,
sounds or lesson content.
