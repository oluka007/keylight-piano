#!/bin/zsh
# Build Keylight.app from the npm Electron bundle, install it as ~/Applications/Keylight.app,
# refresh the Desktop shortcuts and zip it for testers as dist/Keylight-<version>-mac.zip.
#
# The installed app may be running: the new bundle is built in a temp folder and
# swapped in with mv, and the previous one is kept as Keylight.app.old to delete
# once it has quit. Progress is not in the bundle (it lives in
# ~/Library/Application Support/lumi-app), so it carries over.
#   scripts/package.sh             build, zip, install, update the Desktop shortcuts
#   scripts/package.sh --zip-only  build and zip only
# ELECTRON_APP=/path/to/Electron.app picks the Electron bundle to build from.
set -euo pipefail
ROOT=${0:A:h:h}
ZIP_ONLY=0
case ${1:-} in
  --zip-only) ZIP_ONLY=1 ;;
  "") ;;
  *) echo "usage: scripts/package.sh [--zip-only]" >&2; exit 2 ;;
esac
# KEYLIGHT_APP_NAME / KEYLIGHT_BUNDLE_ID name a tester build apart from the normal app
NAME=${KEYLIGHT_APP_NAME:-Keylight}
BUNDLE_ID=${KEYLIGHT_BUNDLE_ID:-app.keylight.desktop}
APPS="$HOME/Applications"
APP="$APPS/$NAME.app"
VERSION=$(plutil -extract version raw -o - "$ROOT/package.json")

ELECTRON=$("$ROOT/scripts/find-electron.sh")
ELECTRON_VERSION=$(plutil -extract CFBundleShortVersionString raw -o - "$ELECTRON/Contents/Info.plist")
echo "Building $NAME $VERSION from Electron $ELECTRON_VERSION ($ELECTRON)"

STAGE=$(mktemp -d "${TMPDIR:-/tmp}/keylight-build.XXXXXX")
trap 'rm -rf "$STAGE"' EXIT
PKG="$STAGE/$NAME-$VERSION"          # what the zip holds: the app and a README
NEW="$PKG/$NAME.app"
mkdir -p "$PKG"
ditto "$ELECTRON" "$NEW"

# The main executable takes the app's name (process list, crash reports, and
# app.isPackaged). The helper apps in Contents/Frameworks keep their names:
# Electron looks them up as "Electron Helper*.app".
mv "$NEW/Contents/MacOS/Electron" "$NEW/Contents/MacOS/$NAME"
EXES=("$NEW"/Contents/MacOS/*(N:t))
(( ${#EXES} == 1 )) || { echo "error: expected one executable in Contents/MacOS, found: ${EXES[*]}" >&2; exit 1; }
EXE=${EXES[1]}

# App code: main.js, package.json and renderer/ only (no node_modules, samples,
# docs, scripts, .git or dist). The default app goes: Electron loads Resources/app.
RES="$NEW/Contents/Resources"
rm -f "$RES/default_app.asar" "$RES/electron.icns"
mkdir -p "$RES/app"
cp "$ROOT/main.js" "$ROOT/package.json" "$RES/app/"
rsync -a --exclude '.DS_Store' "$ROOT/renderer/" "$RES/app/renderer/"
# A tester build ("keylightBuild" in package.json) carries the Airwave tracking helper for this Mac
HELPER_DIR="$ROOT/native/build/darwin-arm64"
if plutil -extract keylightBuild json -o - "$ROOT/package.json" >/dev/null 2>&1; then
  [[ -x $HELPER_DIR/keylight-leap-helper ]] || { echo "error: build the helper first (native/build.sh)" >&2; exit 1; }
  mkdir -p "$RES/native/darwin-arm64"
  cp "$HELPER_DIR/keylight-leap-helper" "$RES/native/darwin-arm64/"
  cp "$ROOT/docs/AIRWAVE-TESTER-STEPS.md" "$PKG/Airwave tester steps.md"
fi
# The light daemon (scripts/build-blocksd.sh), so the keys light with no install step. Optional:
# without it the app still builds, and the Mac user falls back to the manual blocksd install.
BLOCKSD_DIR="$ROOT/native/build/darwin-arm64/blocksd"
HAVE_BLOCKSD=0
if [[ -x $BLOCKSD_DIR/blocksd ]]; then
  ditto "$BLOCKSD_DIR" "$RES/blocksd"
  rm -f "$RES/blocksd/.build-stamp"
  HAVE_BLOCKSD=1
else
  echo "note: no bundled light daemon (run scripts/build-blocksd.sh first): this build lights keys only if blocksd is installed by hand" >&2
fi
# licence notices travel with the binary
cp "$ROOT/THIRD_PARTY_NOTICES.md" "$ROOT/LICENSE" "$RES/"
cp -R "$ROOT/LICENSES" "$RES/"
for f in LICENSE LICENSES.chromium.html; do
  if [[ -f "${ELECTRON:h}/$f" ]]; then cp "${ELECTRON:h}/$f" "$RES/electron-$f"; else echo "warning: ${ELECTRON:h}/$f not found" >&2; fi
done

ELECTRON_BIN="$ELECTRON/Contents/MacOS/Electron" "$ROOT/scripts/make-icon.sh"
cp "$ROOT/assets/icon.icns" "$RES/$NAME.icns"

PL="$NEW/Contents/Info.plist"
set_string() { plutil -replace "$1" -string "$2" "$PL"; }
set_string CFBundleName "$NAME"
set_string CFBundleDisplayName "$NAME"
set_string CFBundleIdentifier "$BUNDLE_ID"
set_string CFBundleExecutable "$EXE"
set_string CFBundleIconFile "$NAME.icns"
set_string CFBundleVersion "$VERSION"
set_string CFBundleShortVersionString "$VERSION"
set_string LSApplicationCategoryType public.app-category.music
set_string NSCameraUsageDescription "Keylight uses the camera for hand tracking"
# Electron's stock plist asks for the microphone, audio capture and Bluetooth; Keylight uses none of them
for key in NSMicrophoneUsageDescription NSAudioCaptureUsageDescription NSBluetoothAlwaysUsageDescription NSBluetoothPeripheralUsageDescription; do
  plutil -remove "$key" "$PL" 2>/dev/null || true
done
# integrity entry for the removed default_app.asar; LSMinimumSystemVersion stays Electron's
plutil -remove ElectronAsarIntegrity "$PL" 2>/dev/null || true
plutil -lint "$PL" >/dev/null
MIN_MACOS=$(plutil -extract LSMinimumSystemVersion raw -o - "$PL")

# Ad-hoc signature. Leftover extended attributes would fail the strict check.
xattr -cr "$NEW"
# Turn off the fuses that let another process run this signed binary as plain Node
# (ELECTRON_RUN_AS_NODE, NODE_OPTIONS, --inspect): with them on, anything on the Mac
# could borrow the app's camera permission.
node "$ROOT/scripts/flip-fuses.js" "$NEW"
# The daemon's own Mach-O files are not in a place codesign --deep walks: sign each one,
# inside-out (libraries and extension modules first, the main executable last), then the app.
if (( HAVE_BLOCKSD )); then
  MACHO=()
  for f in "$RES"/blocksd/**/*(.N); do
    [[ $f == */blocksd && $f == "$RES/blocksd/blocksd" ]] && continue
    file -b "$f" | grep -q 'Mach-O' && MACHO+=("$f")
  done
  for f in "${MACHO[@]}"; do
    if ! out=$(codesign --force -s - "$f" 2>&1); then print -r -- "$out" >&2; exit 1; fi
  done
  if ! out=$(codesign --force -s - "$RES/blocksd/blocksd" 2>&1); then print -r -- "$out" >&2; exit 1; fi
  codesign --verify --strict "$RES/blocksd/blocksd"
  echo "signed the light daemon (${#MACHO} libraries + executable)"
fi
if ! out=$(codesign --force --deep -s - "$NEW" 2>&1); then print -r -- "$out" >&2; exit 1; fi
codesign --verify --deep --strict "$NEW"

# Release zip: Keylight-<version>/ with Keylight.app and the install steps from docs/REFERENCE.md.
INSTALL=$(awk '/^## Install$/ { on = 1; next } on && /^## / { exit } on' "$ROOT/docs/REFERENCE.md")
[[ -n $INSTALL ]] || INSTALL=$(<"$ROOT/docs/REFERENCE.md")
print -r -- "$NAME $VERSION"$'\n\n'"${INSTALL//"<version>"/$VERSION}" > "$PKG/README.txt"
DIST="$ROOT/dist"
ZIP="$DIST/$NAME-$VERSION-mac.zip"
mkdir -p "$DIST"
rm -f "$ZIP"
# --norsrc: no extended attributes (macOS provenance tags) as ._ files in the zip
ditto -c -k --norsrc --keepParent "$PKG" "$ZIP"
# what testers get must still verify after a round trip through the zip
mkdir "$STAGE/unzipped"
ditto -x -k "$ZIP" "$STAGE/unzipped"
codesign --verify --deep --strict "$STAGE/unzipped/$NAME-$VERSION/$NAME.app"
ARCHS=$(file -b "$NEW/Contents/MacOS/$EXE" | grep -oE 'arm64|x86_64' | sort -u | paste -sd ' ' -)
echo
echo "$NAME $VERSION (Electron $ELECTRON_VERSION, macOS $MIN_MACOS+, $ARCHS), ad-hoc signed$( (( HAVE_BLOCKSD )) && echo ', with the light daemon' )"
echo "  zip        ${ZIP#$ROOT/} ($(du -h "$ZIP" | cut -f1 | tr -d ' '))"
(( ZIP_ONLY )) && exit 0

# Swap the bundle in. A running Keylight keeps running from the renamed old bundle.
mkdir -p "$APPS"
RUNNING=$(pgrep -f "$APP/Contents/MacOS/" || true)
OLD=""
if [[ -e $APP ]]; then
  OLD="$APP.old"
  [[ -e $OLD ]] && OLD="$APP.old-$(date +%Y%m%d-%H%M%S)"
  mv "$APP" "$OLD"
fi
mv "$NEW" "$APP"
LSREGISTER=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister
[[ -x $LSREGISTER ]] && "$LSREGISTER" -f "$APP" >/dev/null 2>&1 || true

# Desktop shortcut + terminal fallback launcher
DESK="$HOME/Desktop"
if [[ -L "$DESK/$NAME.app" || ! -e "$DESK/$NAME.app" ]]; then
  ln -sfn "$APP" "$DESK/$NAME.app"
else
  echo "note: $DESK/$NAME.app is not a shortcut, left it alone"
fi
cat > "$DESK/Start $NAME.command" <<CMD
#!/bin/zsh
# Fallback launcher: opens a Terminal window and starts Keylight directly.
echo "Starting Keylight…  (this window stays open while the app runs)"
exec env -u ELECTRON_RUN_AS_NODE "$APP/Contents/MacOS/$EXE"
CMD
chmod +x "$DESK/Start $NAME.command"

echo "  installed  $APP"
echo "  desktop    $NAME.app shortcut, Start $NAME.command"
BACKUPS=("$APP".old*(N))
if (( ${#BACKUPS} )); then
  for b in $BACKUPS; do echo "  old bundle $b"; done
  echo "             nothing needs these: delete them once Keylight has quit"
fi
if [[ -n $RUNNING ]]; then
  echo "  running    Keylight (pid ${RUNNING//$'\n'/, }) is running the previous build: quit it and open Keylight again"
fi
