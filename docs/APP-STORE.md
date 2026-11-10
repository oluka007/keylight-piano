# Keylight on the App Store: submission notes

Prepared for later. Publishing needs the Apple Developer Program ($99 a year). Nothing here has been submitted, and nothing was checked against App Store Connect itself (no account). Items marked **UNVERIFIED** are from memory of Apple's rules or from reading Apple's public pages and need a look in App Store Connect before submitting.

Verified from Apple's public pages while preparing this: the screenshot sizes below (App Store Connect help, "Screenshot specifications") and the privacy-manifest reason codes (developer.apple.com documentation, "NSPrivacyAccessedAPITypeReasons").

## Listing text (generic wording: no keyboard-maker or trademarked names)

- **Name** (30 characters max): `Keylight: Piano Lessons`
- **Subtitle** (30): `Learn piano, light up the keys`
- **Promotional text** (170): `A complete piano course and a library of songs. Falling notes and sheet music, on-screen keys, and support for MIDI keyboards over USB and Bluetooth. Free and open source.`
- **Keywords** (100 characters, comma-separated, no spaces after commas): `piano,lessons,learn,keyboard,midi,sheet music,songs,practice,notes,scales,sight reading,ear training`
- **Description**:

> Keylight teaches you piano from the first note.
>
> The course takes you through 12 levels and 94 short lessons, from finding middle C to advanced studies. Every lesson has something to read, something to hear and something to play: echo games, rhythm tapping, ear training, sight-reading, scales, chords and pieces.
>
> Play along with a library of 76 songs, from simple tunes to classical favourites. Watch the notes fall onto the keys or follow the sheet music, slow a passage down, practise one hand, and see your score and stars.
>
> No keyboard? Play on the on-screen keys with your fingers: chords work, because every finger counts. Have a MIDI keyboard? Plug it in with a USB adapter or pair it over Bluetooth from Settings, and Keylight lights the keys on screen as you play.
>
> Private by design: no account, no ads, no tracking. Everything works offline and stays on your device. Free and open source (MIT licence).

- **Category**: Primary **Education**, secondary **Music**. (Education suits the course; Music is where people look for keyboard apps. Either order is acceptable.)
- **Support URL**: `https://github.com/scizerss/keylight-piano/issues` (**UNVERIFIED**: Apple wants a page where users can get support; an issues page is usually accepted, a small GitHub Pages "Support" page is safer).
- **Marketing URL** (optional): `https://github.com/scizerss/keylight-piano`
- **Privacy policy URL**: the GitHub Pages copy of `docs/PRIVACY.md`, for example `https://scizerss.github.io/keylight-piano/privacy` (**UNVERIFIED**: Pages is not set up yet). The policy text today names Android and the desktop apps only; add an iOS paragraph before submitting (the iOS app is the same: no network, no accounts; the Bluetooth permission is for the MIDI keyboard; the camera permission is declared but the camera feature is unavailable in this build, see risks).
- **Copyright**: `2026 Keylight contributors`
- **Age rating questionnaire** (answers; **UNVERIFIED** against the current questionnaire, which Apple revises): all "None" or "No": cartoon or fantasy violence, realistic violence, sexual content, nudity, profanity, horror, alcohol, tobacco or drugs, simulated gambling, contests, medical information; unrestricted web access: No; user-generated content: No; messaging or chat: No; loot boxes: No. Expected rating 4+.

## App Privacy ("nutrition label")

Answer **Data Not Collected**. Basis: no network code, no third-party SDK, no analytics, no accounts. Settings, progress and imported files stay in the app's own storage. The page is served from files inside the app (`keylight-app://`), the content-security policy refuses every outside connection, and the app has no networking entitlement beyond the system default.

- Tracking: **No** (`NSPrivacyTracking` is false, no tracking domains).
- Collected data types: none (`NSPrivacyCollectedDataTypes` is empty).

## PrivacyInfo.xcprivacy review (ios/Keylight/PrivacyInfo.xcprivacy)

Required-reason APIs that the shipped (Release) code uses:

| API category | Where | Declared reason |
|---|---|---|
| System boot time (`mach_absolute_time`, `DispatchTime.uptimeNanoseconds`) | `MidiBridge.swift`: batching timers, scheduling delayed MIDI messages | `35F9.1` (measure time elapsed between events in the app or run timers) and `8FFB.1` (absolute timestamps for events in the app: CoreMIDI timestamps are host-time values) |

Checked and not used by Release code, so not declared: user defaults (only inside `#if DEBUG` launch-argument hooks), file timestamps (no `stat`, modification dates or attributes are read; files are only opened and written), disk space (none), active keyboards (none). The Release binary's imported symbols were checked for these (see `scripts/package-ios.sh` output notes in docs/IOS.md). The previous manifest declared file timestamp and user defaults reasons that the code did not need; they were removed. If a later change reads any of those, add the category with a reason from Apple's list.

Web content inside the web view is Apple's WebKit; WebKit's own use of these APIs is covered by the system.

## Export compliance

`ITSAppUsesNonExemptEncryption` is set to `NO` in Info.plist. The app uses no encryption of its own: no network, no TLS code, no custom or third-party cryptography. The only hashing (SHA-256 of a MIDI port id, via CryptoKit) is not encryption. Answer "No" to "Does your app use encryption?" if asked in App Store Connect (**UNVERIFIED**: if the form insists, choose "uses only exempt encryption"). No annual self-classification report is needed for this case.

## Screenshots (verified sizes)

Required: iPad 13-inch 2064x2752 (portrait) or 2752x2064 (landscape), and iPhone 6.9-inch 1320x2868 (portrait) or 2868x1320. An 11-inch iPad set is optional (1668x2420 accepted; if omitted Apple scales the 13-inch set). The files are in `ios/store/screenshots/` (see the README there).

## App Review notes (paste into the "Notes" box)

> Keylight is a free, offline piano-learning app. There is no account, no login and no server.
>
> You do not need a MIDI keyboard to review it:
> 1. Open the app. Home shows "Start lesson 1". Tap it, then tap Start next to "Find the Key" or open any exercise in the Course tab. The on-screen keys play sound when you tap them with one or several fingers.
> 2. Course tab: 12 levels, 94 lessons. Lesson 1 is open; later lessons unlock as you pass items (or use "Skip ahead" on a level to open it).
> 3. Search tab: 75 bundled songs. Tap one, then use the on-screen keys at the bottom of the player. Falling notes and sheet music are shown; the "Sheet" button toggles notation.
> 4. Settings has everything else, including "Pair Bluetooth keyboard...", which opens Apple's system Bluetooth MIDI sheet.
>
> Hardware (optional): a class-compliant MIDI keyboard connected with the Apple USB camera adapter, or a Bluetooth LE MIDI keyboard paired from Settings, plays the same notes and lights the matching on-screen keys. Keylight uses Bluetooth only to connect to a MIDI keyboard the user picks. The camera permission text is declared for an optional finger-preview feature, which is switched off in this iOS build (web content from a custom scheme has no camera access). No data leaves the device.
>
> The content (songs, lessons, images, piano sounds) ships inside the app. Licences are listed under Settings > About and credits.

## TestFlight steps (later)

1. Join the Apple Developer Program; create the App ID `org.keylight.piano.ios` (or choose another bundle id and change it in `ios/project.yml`).
2. In Xcode: set the Team in Signing & Capabilities (regenerate the project with `xcodegen generate` and `KEYLIGHT_VERSION`/`KEYLIGHT_BUILD` set, as `scripts/package-ios.sh` does). Choose "Any iOS Device (arm64)", Product > Archive.
3. Organizer > Distribute App > App Store Connect > Upload. Each upload needs a higher build number (`KEYLIGHT_BUILD`).
4. App Store Connect > TestFlight: answer the export-compliance question (see above), add internal testers (up to 100, no review), later external testers (first build goes through a light Beta App Review).
5. Fill the listing, add screenshots, set Pricing to free, attach the build, Submit for Review.

## Guideline risks

- **4.2 Minimum functionality / "web wrapper"**: the app is a native UIKit host with a native CoreMIDI bridge, native Bluetooth pairing (CoreAudioKit), audio-session handling and a native share sheet for exports. All content is bundled and works offline; nothing loads from the web. Reviewers dislike thin wrappers around a website: this one is a full offline app, but say so in the review notes (done above) and expect a question.
- **2.1 App completeness / hardware**: review is done without MIDI hardware; the on-screen keys cover that (notes above). CoreMIDI does not run in the Simulator, so MIDI hardware paths are verified only on a real device (checklist in docs/IOS.md). **UNVERIFIED** until tested on a device.
- **5.1.1 Permissions**: purpose strings exist for Bluetooth and camera. A camera string without a reachable camera feature can draw a question; consider removing `NSCameraUsageDescription` if the camera stays unavailable on iOS (then also hide the camera controls).
- **4.0 / 4.1 Copying and 5.2 Intellectual property**: the song library is public-domain or openly licensed (see `LICENSES/`); the piano samples are CC BY 3.0 (credit is in About). No third-party brand names are used in the listing. Keep it that way; do not name keyboard makers in the title, subtitle or keywords.
- **3.1 / payments**: free, no in-app purchases, no ads.
- **Privacy manifest and required-reason APIs**: declared above; third-party code is none.
- **Open-source licence**: MIT. Nothing in the App Store terms forbids it; note that Apple's licence terms apply to the binary distribution.
- **Account deletion (5.1.1(v))**: not applicable, there are no accounts.
- **Free Apple ID distribution** remains the alternative for personal use (docs/IOS.md): a 7-day signature, at most three apps.
