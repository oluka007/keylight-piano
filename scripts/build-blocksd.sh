#!/bin/zsh
# Build the blocksd light daemon (https://github.com/hyperb1iss/blocksd, ISC) as a
# self-contained PyInstaller folder, for scripts/package.sh to put inside the Mac app.
#   scripts/build-blocksd.sh            build (or reuse) native/build/darwin-arm64/blocksd/
#   scripts/build-blocksd.sh --force    rebuild from scratch
# Needs: macOS on Apple silicon, uv (brew install uv), Xcode command line tools
# (python-rtmidi has no Python 3.13 wheel, so it is compiled), and network the first time.
# Pinned: the blocksd release tag + tarball SHA256 in native/blocksd/VERSION, every Python
# dependency (with hashes) in native/blocksd/requirements.lock. Regenerate the lock with
#   uv pip compile native/blocksd/requirements.in --python-version 3.13 --generate-hashes -o native/blocksd/requirements.lock
# One patch is applied: blocksd leaves button_id out of its button events, so Keylight's
# arrow and mode buttons could not be told apart (README, "Hardware buttons").
set -euo pipefail
ROOT=${0:A:h:h}
SRC="$ROOT/native/blocksd"
OUT_ROOT="$ROOT/native/build/darwin-arm64"
OUT="$OUT_ROOT/blocksd"
WORK="$OUT_ROOT/blocksd-work"      # throwaway: download, patched source, venv, PyInstaller scratch
FORCE=0
[[ ${1:-} == --force ]] && FORCE=1
fail() { echo "error: $*" >&2; exit 1; }

[[ $(uname -s) == Darwin && $(uname -m) == arm64 ]] || fail "this builds the macOS Apple-silicon daemon; this machine is $(uname -s) $(uname -m)"
command -v uv >/dev/null || fail "uv is missing: install it (brew install uv)"
xcode-select -p >/dev/null 2>&1 && command -v clang >/dev/null || fail "Xcode command line tools are missing (xcode-select --install): python-rtmidi is built from source"

TAG=$(sed -n 's/^tag=//p' "$SRC/VERSION"); SHA=$(sed -n 's/^sha256=//p' "$SRC/VERSION"); URL=$(sed -n 's/^url=//p' "$SRC/VERSION")
[[ -n $TAG && -n $SHA && -n $URL ]] || fail "native/blocksd/VERSION is incomplete"
STAMP="$TAG $(shasum -a 256 "$SRC/requirements.lock" "$SRC/entry.py" "$0" | awk '{print $1}' | shasum -a 256 | cut -c1-16)"
if (( ! FORCE )) && [[ -x $OUT/blocksd && -f $OUT/.build-stamp && $(<"$OUT/.build-stamp") == $STAMP ]]; then
  echo "blocksd $TAG already built: $OUT ($(du -sh "$OUT" | cut -f1 | tr -d ' '))"; exit 0
fi

rm -rf "$WORK" "$OUT"; mkdir -p "$WORK" "$OUT_ROOT"
echo "Fetching blocksd $TAG"
curl -fsSL "$URL" -o "$WORK/blocksd.tgz" || fail "could not download $URL (network?)"
[[ $(shasum -a 256 "$WORK/blocksd.tgz" | cut -d' ' -f1) == $SHA ]] || fail "blocksd tarball does not match the pinned SHA256"
tar xzf "$WORK/blocksd.tgz" -C "$WORK"
BSRC=("$WORK"/blocksd-*(/N)); [[ ${#BSRC} == 1 ]] || fail "unexpected tarball layout"
BSRC=$BSRC

# The button_id patch (a no-op if a later blocksd already has it)
EVENTS="$BSRC/src/blocksd/api/events.py"
if ! grep -q '"button_id"' "$EVENTS"; then
  /usr/bin/perl -0pi -e 's/(            "uid": event\.uid,\n)(            "action": "press" if event\.is_down)/$1            "button_id": event.button_id,\n$2/' "$EVENTS"
  grep -q '"button_id": event.button_id' "$EVENTS" || fail "could not apply the button_id patch (blocksd changed?)"
  echo "Applied the button_id patch"
fi

echo "Creating a Python 3.13 environment"
uv venv --python 3.13 --python-preference only-managed --seed "$WORK/venv" >/dev/null 2>&1 \
  || uv venv --python 3.13 "$WORK/venv" || fail "no Python 3.13 (uv could not find or fetch one)"
PY="$WORK/venv/bin/python"
echo "Installing the pinned dependencies (python-rtmidi compiles from source)"
uv pip install --python "$PY" --require-hashes --no-binary python-rtmidi -r "$SRC/requirements.lock" || fail "dependency install failed"
uv pip install --python "$PY" --no-deps "$BSRC" || fail "could not install blocksd"

echo "Freezing"
"$PY" -I -m PyInstaller --noconfirm --clean --onedir --name blocksd \
  --distpath "$WORK/dist" --workpath "$WORK/pyi" --specpath "$WORK/pyi" \
  --collect-submodules blocksd --collect-all rtmidi \
  --hidden-import pydantic --hidden-import pydantic_core \
  --exclude-module tkinter --exclude-module unittest --exclude-module pydoc --exclude-module setuptools --exclude-module pkg_resources \
  "$SRC/entry.py" >"$WORK/pyinstaller.log" 2>&1 || { tail -30 "$WORK/pyinstaller.log" >&2; fail "PyInstaller failed (log: $WORK/pyinstaller.log)"; }
mv "$WORK/dist/blocksd" "$OUT"

# Facts for the notices and the report
PYV=$("$PY" -c 'import sys; print("%d.%d.%d" % sys.version_info[:3])')
{ echo "blocksd $TAG (button_id patch applied)"; echo "Python $PYV"; "$PY" -m pip --version >/dev/null 2>&1 || true
  uv pip freeze --python "$PY" | grep -v '^blocksd'; } > "$OUT/BUILD-INFO.txt"
cp "$BSRC/LICENSE" "$OUT/LICENSE-blocksd.txt"
print -r -- "$STAMP" > "$OUT/.build-stamp"
"$OUT/blocksd" --help >/dev/null || fail "the built daemon does not run"
echo "blocksd $TAG built with Python $PYV: $OUT ($(du -sh "$OUT" | cut -f1 | tr -d ' '))"
echo "Throwaway build files stay in ${WORK#$ROOT/} (safe to delete)"
