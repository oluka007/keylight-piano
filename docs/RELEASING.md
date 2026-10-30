# Releasing Keylight

1. Set `version` in `package.json`. The bundle version and the zip name follow it.
2. Check the build:
   - `npm test` (blocksd watchdog)
   - the engine self-test, which must end with `SELFTEST done` in the test profile's log:

     ```sh
     LUMI_USERDATA=/tmp/kl-test LUMI_SELFTEST=1 LUMI_SHOT=/tmp/kl-test.png LUMI_SHOT_DELAY=45000 \
       env -u ELECTRON_RUN_AS_NODE npm start
     grep SELFTEST /tmp/kl-test/app.log | tail -1
     ```
3. `scripts/package.sh --zip-only` writes `dist/Keylight-<version>-mac.zip`: a
   `Keylight-<version>` folder with `Keylight.app` and `README.txt` (the README's
   "Install" section). The script checks the signature again after a round
   trip through the zip. Plain `scripts/package.sh` also installs the build in
   `~/Applications` and refreshes the Desktop shortcuts.
4. Try the zip the way a tester gets it: download it with a browser (so macOS
   quarantines it), unzip, and follow `README.txt` on a Mac user account that has
   never run Keylight.
5. Attach the zip to a GitHub release; a short clip from `scripts/record.sh` helps.

The build is ad-hoc signed and not notarised, hence the `xattr` step for testers. A
Developer ID signature plus notarisation would remove it. It is Apple Silicon only:
the bundle is the arm64 Electron from `node_modules`.
