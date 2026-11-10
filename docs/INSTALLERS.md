# Keylight installers

These targets wrap the existing payload builders. They build and inspect artifacts
without installing or launching Keylight. Run them again after the parent changes
app code, support UI, download pages, or version metadata. The artifacts described
below are build snapshots, not a final release or a publication.

## Build

Use the repository's supported Node version and `npm ci` first. Build from a stable
checkout; do not edit app files while either payload builder is copying them.
Run each target at most once concurrently in a checkout, because the existing
payload builders share staging and versioned ZIP paths.

On macOS, with the installed Electron bundle and Apple's command-line tools:

```sh
zsh scripts/package-dmg.sh
```

This ALWAYS calls `scripts/package.sh --zip-only`. Never replace that invocation
with bare `package.sh`: the bare command installs into `~/Applications` and changes
Desktop shortcuts. The DMG target extracts the freshly built ZIP into temporary
staging, adds an `/Applications` link and `INSTALL AND SUPPORT.txt`, creates a
compressed HFS+ image with `hdiutil`, and inspects a read-only, non-browsable mount.
The inspection detaches its mount afterward. No Finder window or app is opened.

For Windows packaging on macOS:

```sh
brew install nsis sevenzip
node scripts/package-installer.js
```

Homebrew currently resolves `nsis` to `makensis`. On Windows or Linux, install
NSIS 3 and a current 7-Zip through your normal toolchain, then run the same Node
command. The Mac payload target remains macOS-only. Override tool paths as needed:

```sh
MAKENSIS=/path/to/makensis SEVENZIP=/path/to/7zz node scripts/package-installer.js
```

For example, in PowerShell with NSIS and 7-Zip installed:

```powershell
$env:MAKENSIS = 'C:\Program Files (x86)\NSIS\makensis.exe'
$env:SEVENZIP = 'C:\Program Files\7-Zip\7z.exe'
node scripts/package-installer.js
```

The Windows target always invokes `node scripts/package-win.js --keep`. It checks
the ZIP and app EXE using that builder's exported helpers, then compiles
`keylight-installer.nsi` with `NOCONFIG` and warnings treated as errors. It does not
read or change a user's NSIS configuration. The intermediate EXE keeps its branded
filename: plain `Setup.exe` triggers NSIS's insecure compatibility-shim warning.

## The light daemon inside the Mac app

The Mac app carries the blocksd light daemon, so key lights need no Homebrew, uv or Terminal
step. `scripts/build-blocksd.sh` builds it once (Apple silicon, needs `uv` and Xcode's command
line tools, network the first time) into `native/build/darwin-arm64/blocksd/`:
blocksd's release tag v0.6.0 (`native/blocksd/VERSION`, with the tarball's SHA-256), the
`button_id` patch from the README, CPython 3.13, python-rtmidi compiled from source (it has no 3.13
wheel) and every Python dependency pinned with hashes in `native/blocksd/requirements.lock`,
frozen with PyInstaller `--onedir` (about 29 MB). The build is idempotent and fails with a plain
message when `uv`, the command line tools or the network are missing.

`scripts/package.sh` copies that folder to `Contents/Resources/blocksd` when it exists (the app
still builds without it, with a note), ad-hoc signs each Mach-O file in it (libraries and
extension modules first, the executable last) and then the app. It adds about 30 MB to the ZIP.
Run `scripts/build-blocksd.sh` before `scripts/package-dmg.sh` to get a DMG with lights. The
Windows installer never contains it (blocksd does not run on Windows).

At run time `renderer/blocksd-supervisor.cjs` starts it as a child of the app, loopback only, on
a random free port passed to the page as `?daemonPort=`; it restarts it with backoff, stops it
(by PID) when the app quits, and uses a blocksd already answering on 9010 instead. blocksd has no
authentication: the random port and the loopback binding are the only protection. A Unix socket
plus a bridge through the main process would be stronger (future work). Licences:
`LICENSES/blocksd-ISC.txt`, `LICENSES/blocksd-dependencies.md` (regenerate with
`scripts/blocksd-licenses.py`) and `THIRD_PARTY_NOTICES.md`, which also records the unresolved
provenance note about blocksd's protocol code.

The installers workflow builds the daemon before `package:dmg`. Still open: Developer ID signing and notarization (the daemon would need hardened-runtime signing
with a timestamp, and probably the library-validation entitlement exception because PyInstaller
loads its own libraries), an Intel or universal2 build (the macOS runner builds arm64 only),
Windows
(blocksd does not run there; keys light with plain MIDI notes).

## Outputs and installation behavior

Version comes from `package.json`; no target hard-codes a release version.

| Output in `dist/` | Purpose |
| --- | --- |
| `Keylight-<version>-mac.dmg` | Drag `Keylight.app` to Applications, then eject |
| `Keylight-<version>-win-x64-Setup.exe` | Per-user NSIS installation wizard |
| `<installer>.sha256` | SHA-256 digest of the inspected artifact |
| `<windows-installer>.json` | Size, digest, version, unsigned status, payload name and EXE inspection |

Existing installer outputs are retained: a repeated build appends a time/process
suffix to the installer filename. The underlying payload builders necessarily
refresh their current-version ZIPs and the Windows kept folder. ZIPs for other
versions are not touched. The Windows kept payload remains available for inspection.

The Windows wizard uses Unicode, DPI awareness, the Keylight icon, version metadata,
welcome/install/finish pages and a generated uninstaller. Its fixed destination is
`%LOCALAPPDATA%\Programs\Keylight`, with binaries under `app\`. It requests user
privileges, creates shortcuts in the current user's Start menu and registers with
Windows Settings > Apps under HKCU. There is no elevation request or Desktop shortcut.
The destination is fixed so the uninstaller's recursive deletion stays within its
private binary subtree. Do not put personal files in that subtree.

Before writing or removing files, setup and uninstall use Windows `tasklist` to
check for `Keylight.exe`. A matching process, or a failed enumeration, refuses the
operation and asks the user to quit Keylight and retry. Portable copies with that
name also cause refusal. Nothing calls `taskkill`, closes a process or schedules
replacement on reboot. File extraction cannot skip a failed file. The process
check is a preflight, not an atomic lock against someone starting the app afterward.

Uninstall removes the binary subtree, installer instructions, its uninstaller,
Start menu shortcuts and uninstall registration. It leaves `%APPDATA%\lumi-app`
(including progress/imports) and `Videos\Keylight` untouched. Mac updates/removal
also leave `~/Library/Application Support/lumi-app` and recorded takes untouched.

All core features remain free. Installation and Finish require no account,
donation, checkout or payment detection. Support text points to
https://ko-fi.com/scizers for optional pay-what-you-want donations. There is no
donation checkbox, automatic app launch or automatic browser open.

## Inspection tests

Each build runs the appropriate inspection before moving its final installer into
`dist`. To inspect an existing artifact against its exact payload ZIP:

```sh
node scripts/test-installer.js --mac dist/Keylight-<version>-mac.dmg dist/Keylight-<version>-mac.zip
node scripts/test-installer.js --windows dist/Keylight-<version>-win-x64-Setup.exe dist/Keylight-<version>-win-x64.zip
```

Replace `<version>` and any collision suffix with the actual output names. Keep
the matching ZIP alongside an installer: rebuilding a payload with different app
code can legitimately make an older installer fail the byte comparison.

The Mac inspection checks `hdiutil verify`, the Applications link, instructions,
the complete app layout, every file's SHA-256, symlink targets, executable permission
bits and `codesign --verify --deep --strict` against the ZIP round trip.

The Windows inspection uses 7-Zip's NSIS reader to test and extract without
execution. It requires the exact installed binary layout and every file to match
the verified ZIP, checks the app's x64 GUI EXE identity/version and disabled
RunAsNode/NodeOptions/inspect fuses, and checks the outer EXE's PE header and
installer instructions. Both modes print artifact size and SHA-256 and return
nonzero on failure. These are payload/format tests; they do not prove Windows
runtime behavior, shortcut creation, the running-process refusal or actual uninstall.
Those runtime checks require a separately authorized disposable Windows VM.

## Parent npm and CI integration recipe

The parent owns `package.json` and CI. Suggested additional npm commands:

```json
{
  "package:dmg": "zsh scripts/package-dmg.sh",
  "package:installer": "node scripts/package-installer.js",
  "inspect:installer": "node scripts/test-installer.js"
}
```

Keep the existing `npm test` tests. In a macOS packaging job, use this order:

```sh
npm ci
npm test
brew install nsis sevenzip
npm run package:dmg
npm run package:installer
```

Both packaging commands include artifact inspection; no extra inspection run is
needed in the same job. For separate Windows packaging jobs, provision NSIS and
7-Zip, set `MAKENSIS` and `SEVENZIP` when they are not on PATH, run `npm ci`,
`npm test`, then `npm run package:installer`. No Electron self-test or installer
execution is needed for these packaging checks.

Collect `dist/*.dmg`, `dist/*-Setup.exe`, their `.sha256`/`.json` sidecars, and the
matching `*-mac.zip`/`*-win-x64.zip` as CI artifacts. Uploading CI artifacts and
publishing a release belong to the parent workflow; these scripts do neither.

## Signing and verification status

No Developer ID, Apple notarization credentials or Windows signing certificate
are configured here. The Mac app has the existing builder's ad-hoc signature;
neither the DMG nor the Windows installer/app has a trusted publisher signature.
Gatekeeper, SmartScreen or Smart App Control can warn or block these files.
These targets do not strip download quarantine, disable protections or offer
warning-bypass steps. Apple's guidance: https://support.apple.com/102445.
Trusted signing/notarization requires a separate credentialed parent release step;
signing changes bytes, so generate final hashes after that step.

The initial local build used Node 24.14.0, Electron 45.1.0, NSIS 3.13 and 7-Zip
26.05 on Apple Silicon. Existing `npm test` passed (16 watchdog tests, 31 take
download cases, 38 Windows packaging checks). LSP diagnostics could not run because
the TypeScript language server is absent and its installation was previously
declined. No Keylight or installer process was launched.

Inspected development snapshots (rebuild after parent integration):

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `Keylight-0.2.4-mac.dmg` | 149344689 | `b391162fdad79c7f25c9054ab041dfa9da3e8851d0841331ef81a83383514757` |
| `Keylight-0.2.4-win-x64-Setup.exe` | 132054856 | `c96a055b504415284a8db290c6ac80947d85a994af8c1458f7bb18809dace884` |

The DMG comparison covered 367 bundle entries. The Setup comparison covered 178
installed payload files. These snapshots were built at different points during
parent work and must not be treated as one final cross-platform release.

NSIS references: [scripting](https://nsis.sourceforge.io/Docs/Chapter4.html),
[Modern UI 2](https://nsis.sourceforge.io/Docs/Modern%20UI%202/Readme.html).
