#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODE=debug
case "${1:-}" in
  '') ;;
  --release) MODE=release ;;
  *) printf 'Usage: %s [--release]\n' "$0" >&2; exit 2 ;;
esac
set +x
CACHE="$HOME/Library/Caches/keylight/android"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export JAVA_HOME="${JAVA_HOME:-$(/usr/libexec/java_home -v 17)}"
export PATH="$JAVA_HOME/bin:$PATH"
GRADLE_VERSION=8.13
mkdir -p "$CACHE" "$ROOT/dist"
if [[ ! -x "$CACHE/gradle-$GRADLE_VERSION/bin/gradle" ]]; then
  curl --fail --location --retry 2 "https://services.gradle.org/distributions/gradle-$GRADLE_VERSION-bin.zip" -o "$CACHE/gradle.zip"
  EXPECTED=20f1b1176237254a6fc204d8434196fa11a4cfb387567519c61556e8710aed78
  ACTUAL="$(shasum -a 256 "$CACHE/gradle.zip")"
  [[ "${ACTUAL%% *}" == "$EXPECTED" ]] || { printf '%s\n' 'Gradle checksum mismatch' >&2; exit 1; }
  unzip -q -o "$CACHE/gradle.zip" -d "$CACHE"
fi
umask 077
if [[ "$MODE" == release ]]; then
  # The upload key lives OUTSIDE the repo; KEYLIGHT_KEYSTORE / KEYLIGHT_KEYSTORE_PASSWORD override the defaults.
  RELDIR="${KEYLIGHT_RELEASE_DIR:-$HOME/Library/Application Support/keylight-release}"
  export KEYLIGHT_KEYSTORE="${KEYLIGHT_KEYSTORE:-$RELDIR/upload.jks}"
  if [[ -z "${KEYLIGHT_KEYSTORE_PASSWORD:-}" && -f "$RELDIR/upload-password" ]]; then
    KEYLIGHT_KEYSTORE_PASSWORD="$(< "$RELDIR/upload-password")"
  fi
  if [[ ! -f "$KEYLIGHT_KEYSTORE" || -z "${KEYLIGHT_KEYSTORE_PASSWORD:-}" ]]; then
    printf '%s\n' 'Release build needs the upload keystore. Run scripts/android-keystore.sh once, or set KEYLIGHT_KEYSTORE and KEYLIGHT_KEYSTORE_PASSWORD.' >&2
    exit 1
  fi
  export KEYLIGHT_KEYSTORE_PASSWORD
  unset KEYLIGHT_ANDROID_KEYSTORE KEYLIGHT_ANDROID_PASSWORD
  VERSION="$(node -p 'require(process.argv[1]).version' "$ROOT/package.json")"
  BT="$ANDROID_HOME/build-tools/36.1.0"
  node "$ROOT/scripts/test-android-midi.js"
  "$CACHE/gradle-$GRADLE_VERSION/bin/gradle" -p "$ROOT/android" --no-daemon --console=plain :app:bundleRelease :app:assembleRelease
  # lint is reported but does not block the files (fix the findings before submitting to Play)
  "$CACHE/gradle-$GRADLE_VERSION/bin/gradle" -p "$ROOT/android" --no-daemon --console=plain :app:lintRelease || printf '%s\n' 'WARNING: lintRelease reported errors; see android/app/build/intermediates/lint_intermediate_text_report/release' >&2
  APK="$ROOT/dist/Keylight-$VERSION-android-release.apk"
  AAB="$ROOT/dist/Keylight-$VERSION-android.aab"
  cp "$ROOT/android/app/build/outputs/apk/release/app-release.apk" "$APK"
  cp "$ROOT/android/app/build/outputs/bundle/release/app-release.aab" "$AAB"
  "$BT/apksigner" verify --verbose --print-certs "$APK" | grep -v '^$'
  "$BT/zipalign" -c -P 16 4 "$APK"
  BADGING="$("$BT/aapt2" dump badging "$APK")"
  printf '%s\n' "$BADGING" | grep -E "^package:|^sdkVersion|^minSdkVersion|^targetSdkVersion|^uses-permission|^uses-feature|^uses-implied|^application-debuggable|^native-code" || true
  if printf '%s\n' "$BADGING" | grep -q 'application-debuggable'; then printf '%s\n' 'Release APK is debuggable' >&2; exit 1; fi
  AABLIST="$(unzip -l "$AAB")"
  [[ "$AABLIST" == *'base/assets/renderer/index.html'* ]] || { printf '%s\n' 'AAB is missing the renderer assets' >&2; exit 1; }
  if [[ "$AABLIST" == *'.so'$'\n'* ]]; then printf '%s\n' 'Unexpected native libraries in AAB' >&2; exit 1; fi
  jarsigner -verify "$AAB" | head -1
  shasum -a 256 "$APK" "$AAB"
  ls -l "$APK" "$AAB" | awk '{print $5, $9}'
  printf 'Release APK (GitHub): %s\nRelease AAB (Google Play): %s\n' "$APK" "$AAB"
  exit 0
fi
export KEYLIGHT_ANDROID_KEYSTORE="$CACHE/development.jks"
if [[ ! -f "$KEYLIGHT_ANDROID_KEYSTORE" ]]; then
  [[ ! -f "$CACHE/signing-password" ]] || { printf '%s\n' 'Key missing but password exists; restore cached signing key before building' >&2; exit 1; }
  openssl rand -hex 32 > "$CACHE/signing-password"
  export KEYLIGHT_ANDROID_PASSWORD="$(< "$CACHE/signing-password")"
  keytool -genkeypair -keystore "$KEYLIGHT_ANDROID_KEYSTORE" -storepass:env KEYLIGHT_ANDROID_PASSWORD \
    -keypass:env KEYLIGHT_ANDROID_PASSWORD -alias keylight-development -keyalg RSA -keysize 3072 -validity 10000 \
    -dname 'CN=Keylight Development, O=Keylight, C=US'
fi
export KEYLIGHT_ANDROID_PASSWORD="$(< "$CACHE/signing-password")"
node "$ROOT/scripts/test-android-midi.js"
"$CACHE/gradle-$GRADLE_VERSION/bin/gradle" -p "$ROOT/android" --no-daemon --console=plain :app:assembleDebug :app:lintDebug
VERSION="$(node -p 'require(process.argv[1]).version' "$ROOT/package.json")"
APK="$ROOT/dist/Keylight-$VERSION-android.apk"
cp "$ROOT/android/app/build/outputs/apk/debug/app-debug.apk" "$APK"
"$ANDROID_HOME/build-tools/36.1.0/apksigner" verify --verbose --print-certs "$APK"
"$ANDROID_HOME/build-tools/36.1.0/zipalign" -c -P 16 4 "$APK"
shasum -a 256 "$APK"
printf 'Signed development APK: %s\n' "$APK"
