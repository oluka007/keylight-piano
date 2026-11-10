# Contributing to Keylight

Thanks for wanting to help. Keylight is an independent, open-source piano-learning app
for the light-up keyboards ROLI made, for people whose keyboard lost its app when ROLI
Learn was discontinued. It is maintained by a small group of volunteers, so anything
you can do — a bug report, one testing session on your own hardware — makes a real
difference. You do not need to be an experienced developer or a good pianist: some of
the most useful reports come from people who just plugged in a keyboard and tried it.
By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## What kinds of help are wanted

- **Bug reports.** Something crashed, a screen looks wrong, a note was scored unfairly,
  the keyboard did not light up. See [Reporting a bug](#reporting-a-bug).
- **Feature requests.** Ideas for lessons, games, views, sounds or workflow. See
  [Suggesting a feature](#suggesting-a-feature).
- **Device reports.** The most valuable reports of all: what happens when a real
  keyboard meets real hardware. Windows, Android and the beta keyboards (the 49-key
  ROLI Piano, two keyboards joined as one) need testing on devices the maintainers may
  not own. Use the [device support form](.github/ISSUE_TEMPLATE/device_support.yml).
- **Testing on real devices.** Install a build, play a lesson, plug in a keyboard over
  USB, try the app on your system, and tell us what broke.
- **Songs and content under the licence rules.** New public-domain pieces, better
  arrangements and course fixes — but read [Content and
  licences](#content-and-licences) first, because music licensing is strict here.
- **Guide and documentation fixes.** A typo, a step that no longer matches the app, a
  sentence that could be clearer.
- **Code.** Bug fixes, new lessons, new exercises, performance and accessibility work,
  and support for more keyboards.

## Ways to contribute without code

- **Report a device outcome.** Run Settings → **Support my device** when a keyboard is
  missing, unlit or only half working, and attach the report to an issue. Every report
  becomes a device profile that helps the next person with the same keyboard.
- **Improve the words.** The in-app text and the docs are plain-language by design; if
  a step confuses you, you are exactly the right person to fix it.
- **Support the project** on [Ko-fi](https://ko-fi.com/scizers) so the maintainers can
  keep testing on real hardware. No feature is locked behind it.

## Reporting a bug

Search the existing issues first — someone may already have reported it. A good report
usually contains:

- **What happened**, and **what you expected** instead.
- **Steps to reproduce it**, numbered, starting from opening the app.
- **Your platform**: Mac, Windows, Android tablet, or the iPhone/iPad sideload build.
- **The Keylight version** (Settings → About) and your **OS version**.
- **Your keyboard**: LUMI Keys, ROLI Piano M, 49-key ROLI Piano, two keyboards joined,
  no keyboard, or other.
- **The log**, if the app misbehaved (Mac `~/Library/Application Support/lumi-app/app.log`,
  Windows `%APPDATA%\lumi-app\app.log`).
- **Screenshots or a clip** for anything visible.

**If the problem is with a keyboard** — not found, stays dark, or only half works —
start with the **Support my device** wizard (Settings → Support my device). It walks
through Detect, Test, About you, Review and Send and builds a plain-text report of what
Keylight can see. You read the exact text before anything leaves the app, then copy it,
save it, or open a pre-filled issue. Nothing is sent automatically, and the report never
contains serial numbers, file paths, user names, song titles, recordings or notes played.
Paste it into the [device support form](.github/ISSUE_TEMPLATE/device_support.yml).

Please use the issue forms — [bug report](.github/ISSUE_TEMPLATE/bug_report.yml),
[feature request](.github/ISSUE_TEMPLATE/feature_request.yml),
[device support](.github/ISSUE_TEMPLATE/device_support.yml) and
[question](.github/ISSUE_TEMPLATE/question.yml) — so we need not ask for these details.

## Suggesting a feature

Open a [feature request](.github/ISSUE_TEMPLATE/feature_request.yml) and describe:

- **The problem** you are trying to solve, in your own words, before the solution.
- **Your idea** for how Keylight could solve it.
- **Alternatives** you considered or already tried.
- Whether you are **willing to help** build or test it.

Requests are welcome, but Keylight is maintained by volunteers with a clear scope: it is
a learning app for these keyboards, not a DAW. A clear problem beats a large design.

## Set up and run

You need **git** and **Node.js 22.12 or newer**. To run the app from source:

```sh
git clone https://github.com/scizerss/keylight-piano.git keylight
cd keylight
npm ci
env -u ELECTRON_RUN_AS_NODE npm start    # run from source
```

`env -u ELECTRON_RUN_AS_NODE` matters when you launch the app from another Electron app
(such as an editor built on Electron): without it, Electron starts as plain Node.

Run the tests:

```sh
npm test             # unit tests: watchdog, takes, the Windows build, the course
npm run test:audio   # renders the bundled recordings and expression offline
npm run selftest     # the engine self-test
```

`npm run selftest` runs the app hidden and muted in a throwaway profile, off the
keyboard and off the light service, and checks the self-test ends with `SELFTEST done`
and no `FAIL` line. `scripts/selftest.js`, which CI runs on macOS and Windows, takes
`--expect-platform mac|win` (the platform path the page should have taken),
`--profile dir` (keeps the profile so its `app.log` can be read), `--timeout 300`
(seconds) and `--exe` (the packaged Windows build), for example:

    node scripts/selftest.js --expect-platform mac --profile /tmp/keylight-selftest --timeout 300

The full reference for test and screenshot flags (`LUMI_SELFTEST`, `LUMI_QUERY`,
`LUMI_SHOT`, `LUMI_FRAMES` and the rest) is in [docs/REFERENCE.md](docs/REFERENCE.md).
Building installers (`scripts/package.sh`, `npm run package:win`,
`npm run package:android` and the rest) is covered in
[docs/RELEASING.md](docs/RELEASING.md) and [docs/INSTALLERS.md](docs/INSTALLERS.md).

## Project layout

| Folder | What it is |
|---|---|
| `renderer/` | The app page itself: screens, player, note views, sound, key lights, lessons and exercises. Plain ES modules loaded directly by `index.html`, no build step. |
| `main.js` | The Electron main process: the local server, MIDI permission, starting and watching the macOS light service, the Windows window, screenshots and demo-video frames. |
| `native/` | Native pieces: the build of the blocksd light service for the Mac app, and the experimental Ultraleap helper. |
| `android/` | The Android host app: a Java host that bundles the renderer, uses native USB MIDI, and builds the APK. |
| `ios/` | The iOS app (deferred while the desktop and Android builds are developed). |
| `scripts/` | The test scripts (`test-*.js`), the packaging and icon scripts, the recording helpers and the self-test runner. |
| `docs/` | The reference, the user guide facts, the course authoring guide, the device-support notes and the release instructions. |
| `site-next/` | The static website and the user guide page. Static files, no build step. |

The full list of what each source file does is in the **Files** section of
[docs/REFERENCE.md](docs/REFERENCE.md).

## Code style

- **Plain ES modules** in `renderer/`, loaded by `<script type="module">`. No bundler,
  no transpiler, **no build step** for the app code.
- **2-space indentation**, **no semicolons**, **single quotes** for strings.
- Node-only scripts (tests and helpers) use CommonJS with
  `require('node:assert/strict')` and run directly with `node`.
- Comments explain *why*, in plain language, not *what*.
- **No new dependencies without discussion.** The dependency list is deliberately tiny
  (Electron, and the build-time `resedit`). Open an issue before adding a package, and
  expect a discussion about size, licence and whether it can be written by hand.

## Tests

**Every change should ship with a test where it makes sense.** A bug fix wants a test
that fails before the fix and passes after; new course content, parsing, scoring and
device-support fields all have a place to be checked.

- Each test is a **plain Node script** in `scripts/`, named `test-<area>.js`, run by `npm test`.
- They use `node:assert/strict` and load the real modules — no test framework, no
  mocking library. See the header of `scripts/test-course.js` for the shape.
- They must run offline, without a keyboard or sound hardware.

The app also carries its own **engine self-test**: the `SELFTEST …` lines in
`renderer/app.js` exercise the screens and the core engine — the player and Wait mode,
scoring, results, lessons, exercises, the course, imports and key lights — and print to
stdout and `app.log`. It ends with `SELFTEST done`; any failure prints `FAIL`.

## Content and licences

Music and lesson licensing is the one place where the rules are strict. The full rules
are in the **Licence rules for content** section of [docs/COURSE.md](docs/COURSE.md);
the short version:

- **Write every lesson text, quiz question and exercise ourselves.** Never copy
  wording, exercise order or illustrations from method books (Alfred, Faber, Bastien,
  Thompson, Suzuki, RCM/ABRSM/Trinity books and their lists) or from CC BY-SA course
  text (Open Music Theory, Wikibooks). Facts such as scale patterns and skill order are
  free; sentences are not.
- **Only public-domain works or traditional tunes**, in our own arrangement, written as
  note lists or hand-encoded MusicXML. A Mutopia or other edition may be used only when
  its licence is Public Domain or CC BY — credit it in
  [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). **Avoid CC BY-SA editions.**
- Do not use modern arrangements, editors' fingerings and phrase marks, or pop songs.
- Do not name hardware brands in lesson text.

**Any new third-party material — code, model, font, sound recording, song edition —
needs an entry in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)**, with its licence
and the files it covers (bundled npm packages are collected by
`scripts/vendor-licenses.sh`). If you are unsure whether a licence is fine, ask first.

## Making a pull request

1. **Fork** the repository and create a branch with a short, descriptive name.
2. Keep the change **small and focused** — one fix or feature per pull request.
3. Make **small, focused commits** with clear messages.
4. Run **`npm test`** (and `npm run test:audio` if you touched sound) plus the
   self-test, and make sure they pass.
5. Fill in the **pull request template** — what changed, why, and how you tested it.
6. Open the pull request and describe the change in plain language.

What a reviewer looks for: does it do what the description says and nothing unrelated;
is there a test, or a clear reason not; does it fit the code style and structure; are the
licence rules respected for new content or dependencies; are the docs updated; and does
it keep the app free of tracking, accounts and network calls it does not need.

Maintainers **may ask for changes**, and that is normal — it is about the change, not
you. Being unfamiliar with the codebase is fine; ask questions in the pull request or an
issue and someone will help. Small, well-explained contributions are always welcome.

## Things that are off limits

- **Never commit keystores, passwords or tokens.** The Android development signing key
  and its password live outside the repository and are backed up privately. Do not put
  secrets in a commit, an issue or a pull request.
- **Never bundle ROLI or Ultraleap runtimes, drivers, firmware or SDKs.** Keylight
  contains no ROLI software, firmware, artwork, fonts, sounds or lesson content. The
  Ultraleap helper loads the user's own installed runtime at run time; none of it is
  redistributed.
- **Do not copy code from KeyFall or other unlicensed projects.** KeyFall is credited as
  inspiration, not as a source to copy from. Only bring in code you have the right to
  use, with its licence noted in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Thanks for reading this far. Open an issue if anything here is unclear — improving this
file is a contribution too.
