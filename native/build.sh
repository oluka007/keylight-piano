#!/bin/sh
# Builds the helper for the host platform into native/build/<os>-<arch>/.
# macOS arm64 is the supported, tested target. The source is portable C but a Windows build
# has not been made or run, so no Windows helper ships. --fixture also builds the test stand-in.
set -eu
cd "$(dirname "$0")"
case "$(uname -s)" in
  Darwin) OS=darwin ;;
  *) echo "native helper builds are only set up for macOS" >&2; exit 2 ;;
esac
ARCH=$(uname -m); [ "$ARCH" = x86_64 ] && ARCH=x64
OUT="build/$OS-$ARCH"
mkdir -p "$OUT"
clang -std=c11 -O2 -Wall -Wextra -Werror -mmacosx-version-min=13.0 -o "$OUT/keylight-leap-helper" keylight-leap-helper.c
if [ "${1:-}" = "--fixture" ]; then
  # test-only build whose search roots can be redirected to temp folders; never packaged
  clang -std=c11 -O2 -Wall -Wextra -Werror -mmacosx-version-min=13.0 -DKEYLIGHT_TEST_ROOTS -o "$OUT/keylight-leap-helper-test" keylight-leap-helper.c
  clang -std=c11 -O1 -Wall -Wextra -Werror -dynamiclib -fvisibility=hidden -o "$OUT/libLeapC-fixture.dylib" fake-leapc.c
fi
echo "$OUT/keylight-leap-helper"
