#!/bin/zsh
# Rebuild renderer/vendor/*.js (browser bundles) and renderer/models/basic-pitch from npm.
# Kept out of the repo's node_modules: everything is installed in a temp folder.
set -euo pipefail
ROOT=${0:A:h:h}
TMP=$(mktemp -d)
cd "$TMP"
npm init -y >/dev/null
npm install --no-audit --no-fund @spotify/basic-pitch@1.0.1 @tensorflow/tfjs@4.22.0 music-metadata@11.7.3 esbuild@0.25.10 @mediapipe/tasks-vision@0.10.21 >/dev/null
print -r -- "import * as tf from '@tensorflow/tfjs'
import { BasicPitch, noteFramesToTime, addPitchBendsToNoteEvents, outputToNotesPoly } from '@spotify/basic-pitch'
export { tf, BasicPitch, noteFramesToTime, addPitchBendsToNoteEvents, outputToNotesPoly }" > entry-transcribe.js
print -r -- "export { parseBlob } from 'music-metadata'" > entry-metadata.js
B="./node_modules/.bin/esbuild --bundle --format=esm --platform=browser --minify --legal-comments=eof"
eval $B entry-transcribe.js --outfile="$ROOT/renderer/vendor/transcribe.js"
eval $B entry-metadata.js --outfile="$ROOT/renderer/vendor/metadata.js"
cp node_modules/@spotify/basic-pitch/model/* "$ROOT/renderer/models/basic-pitch/"
cp node_modules/@spotify/basic-pitch/LICENSE "$ROOT/renderer/models/basic-pitch/LICENSE"
# hand tracking: MediaPipe tasks-vision (SIMD build only) + hand landmark model
mkdir -p "$ROOT/renderer/vendor/mediapipe/wasm"
cp node_modules/@mediapipe/tasks-vision/vision_bundle.mjs "$ROOT/renderer/vendor/mediapipe/"
cp node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.{js,wasm} "$ROOT/renderer/vendor/mediapipe/wasm/"
curl -sfL -o "$ROOT/renderer/models/hand_landmarker.task" \
  https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task
"$ROOT/scripts/vendor-licenses.sh" node_modules "$ROOT/renderer/vendor/LICENSES.txt"
# tasks-vision ships no licence file: it is Apache-2.0, the same text as Basic Pitch
cp "$ROOT/renderer/models/basic-pitch/LICENSE" "$ROOT/renderer/vendor/mediapipe/LICENSE"
rm -rf "$TMP"
echo "vendor bundles rebuilt"
