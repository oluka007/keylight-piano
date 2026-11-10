#!/bin/bash
# Xcode build phase: copies the renderer (and the licence files) into Keylight.app/web, the folder the scheme handler serves.
# Desktop-only files are left out (*.cjs, package.json); the iOS bootstrap is added to index.html like the Android build does.
set -euo pipefail
REPO="$(cd "$SRCROOT/.." && pwd)"
DEST="$TARGET_BUILD_DIR/$UNLOCALIZED_RESOURCES_FOLDER_PATH/web"
rm -rf "$DEST"
mkdir -p "$DEST/renderer"
rsync -a --delete --exclude '*.cjs' --exclude 'package.json' --exclude '.DS_Store' "$REPO/renderer/" "$DEST/renderer/"
cp "$REPO/LICENSE" "$REPO/THIRD_PARTY_NOTICES.md" "$DEST/"
rsync -a --exclude '.DS_Store' "$REPO/LICENSES/" "$DEST/LICENSES/"
perl -0pi -e 's|<head>|<head>\n<script type="module" src="ios-host.js"></script>|' "$DEST/renderer/index.html"
grep -q 'ios-host.js' "$DEST/renderer/index.html" || { echo "error: could not add ios-host.js to index.html" >&2; exit 1; }
