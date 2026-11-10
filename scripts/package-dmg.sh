#!/bin/zsh
# Build only: never install the app or open a Finder window.
set -euo pipefail
ROOT=${0:A:h:h}
[[ $# == 0 ]] || { print -u2 'usage: zsh scripts/package-dmg.sh'; exit 2; }
VERSION=$(plutil -extract version raw -o - "$ROOT/package.json")
[[ $VERSION =~ '^[0-9]+\.[0-9]+\.[0-9]+$' ]] || { print -u2 'Expected a numeric release version'; exit 2; }
command -v hdiutil >/dev/null
# This flag is mandatory: the default builder changes Applications and Desktop.
"$ROOT/scripts/package.sh" --zip-only
ZIP="$ROOT/dist/Keylight-$VERSION-mac.zip"
STAGE=$(mktemp -d "${TMPDIR:-/tmp}/keylight-dmg.XXXXXX")
trap 'rm -rf "$STAGE"' EXIT
ditto -x -k "$ZIP" "$STAGE/unpacked"
mkdir "$STAGE/image"
mv "$STAGE/unpacked/Keylight-$VERSION/Keylight.app" "$STAGE/image/"
ln -s /Applications "$STAGE/image/Applications"
cat > "$STAGE/image/INSTALL AND SUPPORT.txt" <<TXT
KEYLIGHT $VERSION FOR MAC

1. Quit Keylight before updating.
2. Drag Keylight.app onto Applications. If asked to replace an older copy,
   choose Replace only when you intend to update it.
3. Eject this disk image and open Keylight from Applications.

Keylight is free, with all core features available without payment or an account.
Optional pay-what-you-want support: https://ko-fi.com/scizers
No donation is needed to install, continue, or use Keylight.

This build is ad-hoc signed, not Developer ID signed or Apple notarized.
macOS may block it. Follow your organization's security policy and Apple's
guidance; this image does not remove quarantine or bypass security warnings:
https://support.apple.com/102445

Requires Apple Silicon and the macOS version required by the bundled Electron.
Piano M / LUMI key lights need no extra install: the app carries its own light
service (blocksd, https://github.com/hyperb1iss/blocksd) and starts it itself.
Setup and keyboard details: https://github.com/scizerss/keylight-piano#install

Updates keep progress in ~/Library/Application Support/lumi-app/.
Removing the app does not remove progress or your recorded takes.
Help / report a problem: https://github.com/scizerss/keylight-piano/issues
Attach app.log from that Application Support folder when reporting a problem.
Licenses and third-party notices are in Keylight.app/Contents/Resources/.
TXT
OUT="$ROOT/dist/Keylight-$VERSION-mac.dmg"
[[ ! -e $OUT ]] || OUT="$ROOT/dist/Keylight-$VERSION-mac-$(date +%Y%m%d-%H%M%S)-$$.dmg"
hdiutil create -quiet -fs HFS+ -format UDZO -volname "Keylight $VERSION" \
  -srcfolder "$STAGE/image" "$STAGE/Keylight.dmg"
node "$ROOT/scripts/test-installer.js" --mac "$STAGE/Keylight.dmg" "$ZIP"
mv "$STAGE/Keylight.dmg" "$OUT"
(cd "$(dirname "$OUT")" && shasum -a 256 "$(basename "$OUT")" > "$OUT.sha256")
print -r -- "Built and inspected: $OUT"
