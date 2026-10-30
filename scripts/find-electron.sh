#!/bin/zsh
# Prints the Electron.app that runs and packages Keylight: $ELECTRON_APP when set,
# else this checkout's node_modules/electron/dist/Electron.app, else the main
# checkout's when this is a git worktree (worktrees share the repository, not
# node_modules).
set -euo pipefail
ROOT=${0:A:h:h}
main=""
if [[ -e "$ROOT/.git" ]]; then
  common=$(git -C "$ROOT" rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || common=""
  [[ -n $common ]] && main="${common:h}/node_modules/electron/dist/Electron.app"
fi
for candidate in "${ELECTRON_APP:-}" "$ROOT/node_modules/electron/dist/Electron.app" "$main"; do
  if [[ -n $candidate && -x "$candidate/Contents/MacOS/Electron" ]]; then
    print -r -- "$candidate"
    exit 0
  fi
done
echo "error: no Electron.app found (after npm ci, run npm start once: Electron downloads itself on first run; or set ELECTRON_APP)" >&2
exit 1
