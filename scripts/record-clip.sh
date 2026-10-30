#!/bin/zsh
# Record a demo clip with the app's own sound: scripts/record-clip.sh '<LUMI_QUERY>' <out.mp4> [seconds]
#   scripts/record-clip.sh 'demo=twinkle&pos=0' ~/Desktop/twinkle.mp4 8
# Runs the app from this checkout with a throwaway profile in $TMPDIR, quietly: no Dock
# icon, an invisible window that never takes focus, and the speakers muted (the take
# still records the app's sound). The app plays the song itself (mode=WATCH unless the
# query sets a mode), records <seconds> of it with its own take recorder (rec=<seconds>,
# renderer/recorder.js) and quits. The take becomes <out.mp4>: constant 60 fps H.264
# (crf 16, yuv420p, +faststart) with AAC 256k audio, and its JSON sidecar is written
# next to it as <out>.json. Seconds default to 12. The query must open a song (demo=...).
# LUMI_SHOT_DELAY (ms, default 2500) waits after the page loads before the song starts;
# KEEP_TAKE=1 keeps the raw take and the profile; ELECTRON_APP picks the Electron bundle.
# LUMI_SCALE=2 draws the stage at twice the pixels (2560 wide), as on a Retina screen;
# a hidden test window otherwise draws at 1x (1280 wide) whatever the display.
# The run never opens the keyboard (LUMI_NO_KEYBOARD=1): someone playing it, or the
# Keylight they are playing in, cannot end up in the clip or lose its key lights.
set -euo pipefail
ROOT=${0:A:h:h}
if (( $# < 2 )); then
  echo "usage: scripts/record-clip.sh '<LUMI_QUERY>' <out.mp4> [seconds]" >&2
  exit 2
fi
QUERY=$1
OUT=${2:a}
DURATION=${3:-12}
DELAY=${LUMI_SHOT_DELAY:-2500}
SIDECAR="${OUT:r}.json"
[[ "$QUERY" == *demo=* ]] || { echo "error: the query must open a song with demo=<song> (for example 'demo=twinkle&pos=0')" >&2; exit 2; }
[[ $DURATION == <-> || $DURATION == <->.<-> ]] && (( DURATION > 0 )) || { echo "error: seconds must be a positive number" >&2; exit 2; }
FFMPEG=$(command -v ffmpeg || print -r -- /opt/homebrew/bin/ffmpeg)
FFPROBE=$(command -v ffprobe || print -r -- /opt/homebrew/bin/ffprobe)
[[ -x $FFMPEG && -x $FFPROBE ]] || { echo "error: ffmpeg/ffprobe not found (brew install ffmpeg)" >&2; exit 1; }
ELECTRON="$("$ROOT/scripts/find-electron.sh")/Contents/MacOS/Electron"
SCALE=${LUMI_SCALE:-}
[[ -z $SCALE || $SCALE == (1|1.5|2|3) ]] || { echo "error: LUMI_SCALE must be 1, 1.5, 2 or 3" >&2; exit 2; }
SCALE_ARGS=()
[[ -n $SCALE ]] && SCALE_ARGS=(--force-device-scale-factor=$SCALE)

WORK=$(mktemp -d "${TMPDIR:-/tmp}/keylight-clip.XXXXXX")
TAKES="$WORK/takes"
PID=""
done_ok=0
cleanup() {
  [[ -n $PID ]] && kill $PID 2>/dev/null
  if (( done_ok )) && [[ ${KEEP_TAKE:-} != 1 ]]; then rm -rf "$WORK"; else echo "take and profile kept in $WORK"; fi
}
trap cleanup EXIT
trap 'exit 130' INT TERM

# The app plays the song (Watch) unless the query picks a mode; the take starts with it
[[ "$QUERY" == *mode=* ]] || QUERY="$QUERY&mode=WATCH"
[[ "$QUERY" == *autoplay=* ]] || QUERY="$QUERY&autoplay=$DELAY"
[[ "$QUERY" == *rec=* ]] || QUERY="$QUERY&rec=$DURATION"
echo "Recording ${DURATION}s of '$QUERY' with sound (starts ${DELAY} ms after load)"
env -u ELECTRON_RUN_AS_NODE -u LUMI_SOUND LUMI_NO_KEYBOARD=1 LUMI_USERDATA="$WORK/profile" LUMI_QUERY="$QUERY" \
  LUMI_REC_DIR="$TAKES" LUMI_REC_QUIT=1 "$ELECTRON" "$ROOT" "${SCALE_ARGS[@]}" >/dev/null 2>&1 &
PID=$!
# The app quits by itself once the take's video and JSON are saved.
deadline=$(( SECONDS + DELAY / 1000.0 + DURATION + 60 ))
while kill -0 $PID 2>/dev/null; do
  if (( SECONDS > deadline )); then
    echo "error: the app did not finish in time; stopping it" >&2
    kill $PID 2>/dev/null; sleep 2; kill -9 $PID 2>/dev/null || true
    break
  fi
  sleep 0.5
done
wait $PID 2>/dev/null || true
PID=""

takes=("$TAKES"/keylight-take-*.(mp4|webm)(N))
jsons=("$TAKES"/keylight-take-*.json(N))
if (( ${#takes} == 0 || ${#jsons} == 0 )); then
  echo "error: no take was saved. End of the app log:" >&2
  tail -n 20 "$WORK/profile/app.log" >&2 2>/dev/null || true
  exit 1
fi
TAKE=${takes[1]}
grep -h 'TAKE stop' "$WORK/profile/app.log" 2>/dev/null | tail -n 1 | sed 's/^\[[^]]*\] \[renderer\] //' || true

# The clip starts at the take's first frame. The take's picture starts at 0 and its
# sound at once or a few ms later (lined up with an edit list, renderer/recorder.js),
# which the clip keeps; a take lined up the older way (its picture moved later) is cut
# at its first frame.
START=$("$FFPROBE" -v error -select_streams v:0 -show_entries stream=start_time -of csv=p=0 "$TAKE" | tr -d ',\n')
[[ $START == (<->|<->.<->) ]] || START=0
mkdir -p "${OUT:h}"
"$FFMPEG" -hide_banner -loglevel error -y -ss "$START" -i "$TAKE" -map 0:v:0 -map 0:a:0 \
  -vf 'fps=60,scale=trunc(iw/2)*2:trunc(ih/2)*2:out_range=tv,format=yuv420p' \
  -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -color_range tv -fps_mode cfr -r 60 \
  -c:a aac -b:a 256k -movflags +faststart -f mp4 "$OUT"

# The sidecar goes along, its keyboard times moved onto the clip's timeline (node, or
# Electron's own when there is none)
JS=(env ELECTRON_RUN_AS_NODE=1 "$ELECTRON")
command -v node >/dev/null && JS=(node)
"${JS[@]}" -e '
  const fs = require("fs")
  const [src, dst, start, clip] = process.argv.slice(1)
  const j = JSON.parse(fs.readFileSync(src, "utf8"))
  const cut = Number(start) || 0
  j.midi = (j.midi || []).map((e) => ({ ...e, t: Math.round((e.t - cut) * 1000) / 1000 }))
  j.clip = { file: clip, from: j.file, cutSec: cut, fps: 60, note: "re-encoded by scripts/record-clip.sh from the take, starting at its first frame" }
  fs.writeFileSync(dst, JSON.stringify(j, null, 1))
' "${jsons[1]}" "$SIDECAR" "$START" "${OUT:t}"
done_ok=1
echo "Saved $OUT ($(du -h "$OUT" | cut -f1 | tr -d ' ')) and $SIDECAR"
