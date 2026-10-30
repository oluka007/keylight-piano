# Releasing Keylight

1. Set `version` in `package.json`. The bundle version and the zip name follow it.
2. Check the build:
   - `npm test` (blocksd watchdog, take downloads, the Windows build's zip and fuse code)
   - the engine self-test, which must end with `SELFTEST done` and no `FAIL` line:
     `npm run selftest` (it runs the app hidden in a throwaway profile and exits 0 or 1).
     CI runs it on macOS and on Windows, the latter from source and from the built
     `Keylight.exe`.
3. `scripts/package.sh --zip-only` writes `dist/Keylight-<version>-mac.zip`: a
   `Keylight-<version>` folder with `Keylight.app` and `README.txt` (the README's
   "Install" section). The script checks the signature again after a round
   trip through the zip. Plain `scripts/package.sh` also installs the build in
   `~/Applications` and refreshes the Desktop shortcuts.
   `npm run package:win` writes `dist/Keylight-<version>-win-x64.zip` (any system: it
   downloads Electron for Windows, checked against npm's `electron` checksums): a
   `Keylight-<version>-win-x64` folder with `README.txt` (the README's "Install on
   Windows" section) and a `Keylight` folder holding `Keylight.exe`. CI's `windows`
   job builds the same zip and keeps it for a week as the `keylight-win-x64` artifact.
4. Try the zip the way a tester gets it: download it with a browser (so macOS
   quarantines it), unzip, and follow `README.txt` on a Mac user account that has
   never run Keylight. On Windows, download the win zip with a browser, extract it and
   follow its `README.txt` (SmartScreen's **More info** > **Run anyway**), with the
   keyboard plugged in: the setup's Lights step should run a light across the keys.
5. Attach both zips to a GitHub release; a short clip from `scripts/record.sh` helps.

The build is ad-hoc signed and not notarised, hence the `xattr` step for testers. A
Developer ID signature plus notarisation would remove it. It is Apple Silicon only:
the bundle is the arm64 Electron from `node_modules`.

The Windows exe is not code-signed either, so SmartScreen warns on first run (and
again after each new version) until it is signed with an Authenticode certificate.
