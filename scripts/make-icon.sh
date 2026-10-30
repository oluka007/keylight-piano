#!/bin/zsh
# Build assets/icon.icns (the app icon) from assets/icon.png, a 1024x1024 PNG.
# Without assets/icon.png it draws a stand-in (scripts/placeholder-icon.js) so
# packaging never fails; drop the real icon in and run this (or package.sh) again.
# Drawing the stand-in needs node, or ELECTRON_BIN (an Electron binary run as Node).
set -euo pipefail
ROOT=${0:A:h:h}
ASSETS="$ROOT/assets"
SRC="$ASSETS/icon.png"
SET="$ASSETS/icon.iconset"
OUT="$ASSETS/icon.icns"
TMP=$(mktemp -d "${TMPDIR:-/tmp}/keylight-icon.XXXXXX")
trap 'rm -rf "$TMP" "$SET"' EXIT
mkdir -p "$ASSETS"

if [[ ! -f $SRC ]]; then
  SRC="$TMP/placeholder.png"
  if command -v node >/dev/null; then
    node "$ROOT/scripts/placeholder-icon.js" "$SRC"
  elif [[ -n ${ELECTRON_BIN:-} ]]; then
    ELECTRON_RUN_AS_NODE=1 "$ELECTRON_BIN" "$ROOT/scripts/placeholder-icon.js" "$SRC"
  else
    echo "error: assets/icon.png is missing and there is no node to draw a stand-in" >&2
    exit 1
  fi
  echo "assets/icon.png not found: using a generated stand-in icon"
fi

W=$(sips -g pixelWidth "$SRC" | awk '/pixelWidth/ { print $2 }')
H=$(sips -g pixelHeight "$SRC" | awk '/pixelHeight/ { print $2 }')
[[ $W == $H ]] || echo "warning: the icon is ${W}x${H}; it will be squashed square" >&2
(( W >= 1024 )) || echo "warning: the icon is ${W}x${H}; 1024x1024 keeps the large sizes sharp" >&2

rm -rf "$SET"
mkdir -p "$SET"
for size in 16 32 128 256 512; do
  sips -s format png -z $size $size "$SRC" --out "$SET/icon_${size}x${size}.png" >/dev/null
  sips -s format png -z $((size * 2)) $((size * 2)) "$SRC" --out "$SET/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$SET" -o "$OUT"
echo "Built assets/icon.icns"
