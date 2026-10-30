#!/bin/zsh
# Record a demo video: scripts/record.sh '<LUMI_QUERY>' <out.mp4> [seconds]
#   scripts/record.sh 'demo=twinkle&pos=2' ~/Desktop/twinkle.mp4 8
# Runs the app from this checkout with a throwaway profile in $TMPDIR, saves PNG
# frames at 15 fps (main.js LUMI_FRAMES) and writes an H.264 mp4 (15 fps, crf 20)
# plus a gif next to it (720 px wide, 12 fps). Seconds default to 12.
# LUMI_SHOT_DELAY (ms, default 2500) waits after the page loads before recording;
# KEEP_FRAMES=1 keeps the frames; ELECTRON_APP picks the Electron bundle.
set -euo pipefail
ROOT=${0:A:h:h}
if (( $# < 2 )); then
  echo "usage: scripts/record.sh '<LUMI_QUERY>' <out.mp4> [seconds]" >&2
  exit 2
fi
QUERY=$1
OUT=${2:a}
DURATION=${3:-12}
DELAY=${LUMI_SHOT_DELAY:-2500}
FPS=15
GIF="${OUT:r}.gif"
FFMPEG=$(command -v ffmpeg || print -r -- /opt/homebrew/bin/ffmpeg)
[[ -x $FFMPEG ]] || { echo "error: ffmpeg not found (brew install ffmpeg)" >&2; exit 1; }
ELECTRON="$("$ROOT/scripts/find-electron.sh")/Contents/MacOS/Electron"

WORK=$(mktemp -d "${TMPDIR:-/tmp}/keylight-record.XXXXXX")
FRAMES="$WORK/frames"
PID=""
done_ok=0
cleanup() {
  [[ -n $PID ]] && kill $PID 2>/dev/null
  if (( done_ok )) && [[ ${KEEP_FRAMES:-} != 1 ]]; then rm -rf "$WORK"; else echo "frames and profile kept in $WORK"; fi
}
trap cleanup EXIT
trap 'exit 130' INT TERM

# A song demo should play: start it when recording starts (results demos stay on their overlay)
if [[ "$QUERY" == *demo=* && "$QUERY" != *autoplay=* && "$QUERY" != *res=* ]]; then QUERY="$QUERY&autoplay=$DELAY"; fi
echo "Recording ${DURATION}s of '$QUERY' (starts ${DELAY} ms after load)"
env -u ELECTRON_RUN_AS_NODE LUMI_USERDATA="$WORK/profile" LUMI_QUERY="$QUERY" LUMI_FRAMES="$FRAMES" \
  LUMI_FRAMES_FPS=$FPS LUMI_FRAMES_SECONDS=$DURATION LUMI_SHOT_DELAY=$DELAY \
  "$ELECTRON" "$ROOT" >/dev/null 2>&1 &
PID=$!
# The app quits by itself once the frames are saved; allow for start-up and slow captures.
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

frames=("$FRAMES"/frame-*.png(N))
if (( ${#frames} == 0 )); then
  echo "error: no frames were captured. End of the app log:" >&2
  tail -n 20 "$WORK/profile/app.log" >&2 2>/dev/null || true
  exit 1
fi
grep -h '\[frames\]' "$WORK/profile/app.log" 2>/dev/null | tail -n 1 | sed 's/^\[[^]]*\] //' || true

mkdir -p "${OUT:h}"
"$FFMPEG" -hide_banner -loglevel error -y -framerate $FPS -i "$FRAMES/frame-%05d.png" \
  -vf 'scale=trunc(iw/2)*2:trunc(ih/2)*2' -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p \
  -movflags +faststart -f mp4 "$OUT"
"$FFMPEG" -hide_banner -loglevel error -y -framerate $FPS -i "$FRAMES/frame-%05d.png" \
  -vf 'fps=12,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse' "$GIF"
done_ok=1
echo "Saved $OUT ($(du -h "$OUT" | cut -f1 | tr -d ' ')) and $GIF ($(du -h "$GIF" | cut -f1 | tr -d ' '))"
