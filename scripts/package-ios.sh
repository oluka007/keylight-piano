#!/usr/bin/env bash
# Builds and tests the iPhone/iPad app WITHOUT signing: XcodeGen project, simulator build, a generic-device build with
# CODE_SIGNING_ALLOWED=NO (proves it compiles for hardware), the Swift unit tests and the node tests. No archive, no upload.
# Needs Xcode and xcodegen (brew install xcodegen). Usage: scripts/package-ios.sh [--no-sim-tests]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DD="${KEYLIGHT_IOS_DERIVED:-${TMPDIR:-/tmp}/keylight-ios-dd}"
SIM="${KEYLIGHT_IOS_SIM:-iPad Pro 13-inch (M5)}"
export KEYLIGHT_VERSION="$(node -p 'require(process.argv[1]).version' "$ROOT/package.json")"
export KEYLIGHT_BUILD="${KEYLIGHT_BUILD:-1}"
command -v xcodegen >/dev/null || { echo 'xcodegen is missing: brew install xcodegen' >&2; exit 1; }
node "$ROOT/scripts/test-ios-midi.js"
cd "$ROOT/ios"
xcodegen generate
echo '--- simulator build'
xcodebuild build -quiet -project Keylight.xcodeproj -scheme Keylight -destination 'generic/platform=iOS Simulator' -derivedDataPath "$DD" CODE_SIGNING_ALLOWED=NO
echo '--- device build (unsigned, Release)'
xcodebuild build -quiet -project Keylight.xcodeproj -scheme Keylight -configuration Release -destination 'generic/platform=iOS' -derivedDataPath "$DD" CODE_SIGNING_ALLOWED=NO
APP="$DD/Build/Products/Release-iphoneos/Keylight.app"
[[ -f "$APP/web/renderer/index.html" ]] || { echo 'renderer missing from the app bundle' >&2; exit 1; }
grep -q 'ios-host.js' "$APP/web/renderer/index.html" || { echo 'bootstrap missing from index.html' >&2; exit 1; }
echo '--- privacy manifest vs required-reason APIs in the Release binary'
MANIFEST="$APP/PrivacyInfo.xcprivacy"
[[ -f "$MANIFEST" ]] || { echo 'PrivacyInfo.xcprivacy is not in the app bundle' >&2; exit 1; }
SYMS="$(nm -u "$APP/Keylight" 2>/dev/null || true)"
declare -a CHECKS=(
  'NSPrivacyAccessedAPICategoryFileTimestamp#^_(stat|fstat|lstat|fstatat|getattrlist|fgetattrlist|getattrlistbulk)$'
  'NSPrivacyAccessedAPICategorySystemBootTime#^_(mach_absolute_time|clock_gettime_nsec_np)$'
  'NSPrivacyAccessedAPICategoryDiskSpace#^_(statfs|fstatfs|statvfs|fstatvfs)$'
  'NSPrivacyAccessedAPICategoryUserDefaults#NSUserDefaults|^_CFPreferences'
)
for check in "${CHECKS[@]}"; do
  IFS='#' read -r category pattern <<<"$check"
  declared=no; plutil -extract NSPrivacyAccessedAPITypes xml1 -o - "$MANIFEST" | grep -q "$category" && declared=yes
  used=no; grep -Eq "$pattern" <<<"$SYMS" && used=yes
  echo "  $category: used-in-binary=$used declared=$declared"
  if [[ $used == yes && $declared == no ]]; then echo "error: $category is used but not declared in PrivacyInfo.xcprivacy" >&2; exit 1; fi
done
if [[ "${1:-}" != --no-sim-tests ]]; then
  echo "--- Swift tests on $SIM"
  xcodebuild test -quiet -project Keylight.xcodeproj -scheme Keylight -destination "platform=iOS Simulator,name=$SIM" -derivedDataPath "$DD" CODE_SIGNING_ALLOWED=NO
  xcrun simctl shutdown all || true
fi
echo "OK: unsigned build at $APP"
