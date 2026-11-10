#!/usr/bin/env bash
# Creates the Keylight Google Play UPLOAD keystore. Run once. The keystore and its random
# password are written OUTSIDE the repository with private permissions (0600 files, 0700
# folder) and the password is never printed. BACK THEM UP (see docs/PLAY-STORE.md).
set -euo pipefail
set +x
DIR="${KEYLIGHT_RELEASE_DIR:-$HOME/Library/Application Support/keylight-release}"
# The repository root comes from the script's PHYSICAL location: follow symlinks to the real file first (macOS has no readlink -f).
SRC="${BASH_SOURCE[0]}"
while [[ -L "$SRC" ]]; do
  SRC_DIR="$(cd -P "$(dirname "$SRC")" && pwd -P)"; SRC="$(readlink "$SRC")"
  [[ "$SRC" == /* ]] || SRC="$SRC_DIR/$SRC"
done
ROOT="$(cd -P "$(dirname "$SRC")/.." && pwd -P)"
# Resolve the target to a canonical path WITHOUT creating anything: walk up to the nearest existing directory, resolve it
# physically (symlinks, "." and ".." included), then append the part that does not exist yet. A relative path, "." or a symlink
# alias of the repository therefore cannot slip past the guard.
canonical() {
  local path="$1" rest="" head
  [[ "$path" == /* ]] || path="$PWD/$path"
  while [[ ! -d "$path" ]]; do
    [[ -L "$path" ]] && return 1                    # a dangling symlink in the path: refuse rather than guess
    rest="/${path##*/}$rest"; head="${path%/*}"; [[ -n "$head" ]] || head="/"; path="$head"
  done
  [[ "$rest" == *"/.."* || "$rest" == *"/./"* || "$rest" == */. ]] && return 1   # ".." after a folder that does not exist cannot be resolved
  printf '%s%s\n' "$(cd -P "$path" && pwd -P)" "$rest"
}
TARGET="$(canonical "$DIR")" || { printf '%s\n' 'Refusing: the keystore folder path cannot be resolved safely (broken symlink or .. after a missing folder)' >&2; exit 1; }
# Refuse when the target is the repository or anywhere inside it. -ef compares the real directories (inode), so symlinks and a
# case-insensitive file system cannot fool it; the string test covers a folder that does not exist yet.
probe="$TARGET"
while :; do
  if [[ "$probe" == "$ROOT" || ( -e "$probe" && "$probe" -ef "$ROOT" ) ]]; then
    printf '%s\n' 'Refusing to create the keystore inside the repository' >&2; exit 1
  fi
  [[ "$probe" == "/" || -z "$probe" ]] && break
  probe="${probe%/*}"; [[ -n "$probe" ]] || probe="/"
done
DIR="$TARGET"
export JAVA_HOME="${JAVA_HOME:-$(/usr/libexec/java_home -v 17)}"
export PATH="$JAVA_HOME/bin:$PATH"
umask 077
mkdir -p "$DIR"; chmod 700 "$DIR"
KS="$DIR/upload.jks"; PW="$DIR/upload-password"
if [[ -e "$KS" || -e "$PW" || -L "$KS" || -L "$PW" ]]; then
  printf 'Already exists in %s. Not overwriting; restore from backup instead of creating a new upload key.\n' "$DIR" >&2
  exit 1
fi
openssl rand -hex 32 > "$PW"; chmod 600 "$PW"
KEYLIGHT_KEYSTORE_PASSWORD="$(< "$PW")" keytool -genkeypair -keystore "$KS" \
  -storepass:env KEYLIGHT_KEYSTORE_PASSWORD -keypass:env KEYLIGHT_KEYSTORE_PASSWORD \
  -alias keylight-upload -keyalg RSA -keysize 4096 -validity 10000 \
  -dname 'CN=Keylight Upload Key, O=Keylight, C=EG' >/dev/null 2>&1 || KEYTOOL_FAILED=1
if [[ -n "${KEYTOOL_FAILED:-}" ]]; then
  rm -f "$KS" "$PW"
  printf '%s\n' 'keytool failed' >&2
  exit 1
fi
chmod 600 "$KS"
printf 'Created upload keystore: %s\nPassword file (private, not printed): %s\nBACK UP BOTH FILES NOW to an encrypted place outside this computer.\n' "$KS" "$DIR/upload-password"
