# Publishing Keylight on Google Play: step by step

For the owner, no prior Play Console experience assumed. Everything marked **(verify)** comes from general knowledge of Google's rules, not from a live check: Google changes fees, tester counts and screens often, so confirm each on the linked Google page before you rely on it. Nothing here has been run against a real Play Console account.

What is ready in the repo: release build script, upload-key script, privacy policy, listing text, store graphics, declaration answers.

| Thing | Where |
|---|---|
| Build the files for Play | `bash scripts/package-android.sh --release` |
| Make the upload key (once) | `bash scripts/android-keystore.sh` |
| Listing text | `docs/play-listing/en-US/` |
| Declarations (Data safety, rating, ads, audience) | `docs/play-listing/data-safety.md` |
| Privacy policy | `docs/PRIVACY.md` |
| Icon and feature graphic | `android/store/` |

## 1. Before you start: the keys and the build

1. Run `bash scripts/android-keystore.sh` once. It creates the **upload keystore** and a random password in `~/Library/Application Support/keylight-release/` (`upload.jks`, `upload-password`, folder mode 700, files mode 600). The password is never printed.
2. **Back both files up now**, to an encrypted place off this Mac (password manager attachment, encrypted USB drive). The two files are only useful together.
3. How much does losing them hurt? Google Play App Signing keeps the real app-signing key; the upload key only proves uploads come from you. If you lose it, you can ask Google to reset the upload key (Play Console > Test and release > App integrity > App signing > Request upload key reset; takes a few days). What you cannot recover: sideload updates. The GitHub APK is signed with the same upload key, so people who installed that APK can only update from APKs signed with it. Note also that the Play-distributed app is signed with Google's key, so someone who installed the GitHub APK cannot update to the Play version in place (they must uninstall first; this loses local progress). Say so in the release notes.
4. Build: `bash scripts/package-android.sh --release`. Output in `dist/`: `Keylight-<ver>-android.aab` (upload this to Play) and `Keylight-<ver>-android-release.apk` (for GitHub releases). `KEYLIGHT_KEYSTORE` / `KEYLIGHT_KEYSTORE_PASSWORD` can override the default key location. Optional `KEYLIGHT_BUILD_NUMBER` (0 to 99) raises the version code for a re-upload of the same version (once you use it, always use it, or the code would go down).
5. Every upload to Play needs a **higher versionCode** than the last. The code is major x 10000 + minor x 100 + patch (0.3.0 gives 300).

## 2. Create the developer account

1. Go to https://play.google.com/console/signup with a Google account you will keep long-term (use a dedicated one for the project if you can). **(verify)** A personal account is the "yourself" type; an organisation account needs a D-U-N-S number and a registered business.
2. Pay the one-time registration fee, about 25 US dollars **(verify)**, by card. You need a payment profile for it. Check on https://support.google.com/googleplay/android-developer/answer/10532353 (supported countries for developer registration and for merchant payments) **before** paying whether **Egypt** is listed: registration, and receiving payouts, depend on the country list. Keylight is free so you will never receive payouts, but the card still has to work for the fee. If Egypt, or the card, is not accepted: try a card from a bank that issues international online payments (some Egyptian cards block them until enabled in the bank app), or a virtual prepaid card; if the country is not on Google's registration list, the realistic options are an organisation account registered in a supported country, or a trusted friend/family member in a supported country as the account holder (they become the legal publisher: only do this with someone you trust fully). Do not use a fake address or identity: accounts are closed for it.
3. Verify your identity: Google asks for a government photo ID (passport or national ID) and sometimes proof of address, and a working phone number and email. Use your real legal name; it is shown in the store listing for personal accounts **(verify)**. Verification can take days.
4. Verify a real Android device: Google may ask you to confirm the account with a physical Android device through the Play Console mobile app **(verify)**.

## 3. Create the app

1. Play Console > Create app. Name: `Keylight: Piano Lessons & Keys` (30 characters max, see `docs/play-listing/en-US/title.txt`). Default language English (United States). **App** (not Game). **Free**. This choice is permanent: a free app can never become paid.
2. Tick the declarations (Developer Program Policies, US export laws).
3. Dashboard > "Set up your app" tasks, in order:
   - **Privacy policy**: see section 4.
   - **App access**: all functionality available without restrictions (`docs/play-listing/data-safety.md`).
   - **Ads**: no ads. **Content rating**: answer the IARC questionnaire exactly as in `data-safety.md`. **Target audience**: 13 and over, not for children. **News app**: no. **Data safety**: no data collected. **Government, financial, health**: none.
   - **Store listing**: paste from `docs/play-listing/en-US/` (title, short description, full description). Upload `android/store/icon-512.png` and `feature-graphic-1024x500.png`, and the phone screenshots (see `android/store/README.md`: at least 2, plus tablet sets). Category Music & Audio. Contact: a **project** email address (it is public), website `https://github.com/scizerss/keylight-piano`.
   - **Permissions declarations**: Keylight uses none of the sensitive permissions that need an extra form. If a reviewer asks, use the justification texts at the end of `data-safety.md` (Camera: optional on-device finger tracking, frames never saved or sent; Bluetooth: connect to the user's own keyboard; USB: the user's own MIDI keyboard).
4. Turn on **Play App Signing** when you upload the first bundle (default for new apps, can't be turned off). Choose "Use a Google-generated key": Google keeps the real signing key; you sign uploads with the upload key from step 1.

## 4. Host the privacy policy (free)

Play needs a public web page (not a PDF), reachable without login, that names the app and developer.
- **Quickest**: use the GitHub page of the file: `https://github.com/scizerss/keylight-piano/blob/main/docs/PRIVACY.md`. It works, but is a repository view, not a clean page. The file must be on the `main` branch and the repository public.
- **Better**: GitHub Pages. The repo has a manual `download-page` workflow that publishes the folder `site/`. Run `node scripts/render-privacy.js site/privacy.html`, commit it, and run the workflow once (GitHub > Actions > download-page > Run workflow; Settings > Pages > Source: GitHub Actions). The final URL is `https://scizerss.github.io/keylight-piano/privacy.html` **(verify the user name part in the Pages settings)**. Paste that URL in Play Console > App content > Privacy policy and in your store listing. Rerun the renderer whenever `docs/PRIVACY.md` changes.

## 5. Upload to a closed test (required first for new personal accounts)

1. Test and release > Testing > Closed testing > Create track (or use the default "Alpha"). Create release, upload `Keylight-<ver>-android.aab`. Release name = the version. Release notes: paste `docs/play-listing/en-US/release-notes.txt` (500 characters max).
2. Testers tab: create an email list (up to 100) or a Google Group, and copy the **opt-in link**. Testers must open the link, accept, and install from the Play Store (a web link works on their phone; they need to be signed in with the email you added).
3. Send the release for review (first reviews can take several days **(verify)**).

### The 12 testers / 14 days rule **(verify)**

For personal developer accounts created after 13 November 2023, Google requires a closed test with at least **12 testers who stay opted in for 14 continuous days** before you can apply for production access **(verify on https://support.google.com/googleplay/android-developer/answer/14151465: the number was 20 earlier and has been reduced; check the current one and the exact wording)**. Tips: recruit 15 to 20 people so a few dropouts don't reset the clock; ask them to keep the app installed and to open it now and then; it is the opt-in that counts, not usage, but active testers make the production application stronger. An **organisation** account (D-U-N-S) is not subject to this rule **(verify)** and is the alternative if recruiting fails.

### Message for recruiting testers (paste on the project's Reddit community)

> **Help me put Keylight on Google Play: testers wanted (Android)**
> Keylight is the free, open-source piano-learning app for light-up MIDI keyboards (no account, no ads, works offline, MIT licence). I'm releasing the Android version on Google Play, and Google requires 12 testers to use a closed test for 14 days first.
> What I need: an Android phone or tablet (Android 8 or newer), a Google account, and about five minutes to install it and have a look. A MIDI keyboard is welcome but not required.
> How: comment or message me **the Gmail address of your Google account** and I'll add you to the tester list. You'll get a link, tap "Become a tester", install, and please **leave it installed for the 14 days**. Feedback (what works, what breaks, which keyboard you used) on the GitHub issues page is very welcome: https://github.com/scizerss/keylight-piano
> Thank you! Your email is only used by Google Play for the tester list; I won't use it for anything else.

(Do not post testers' emails publicly; ask for them by private message.)

## 6. Production access

After 14 days with enough testers, Dashboard > "Apply for production" **(verify the button name)**. Answer the questions: how you recruited testers, what feedback you got and acted on, what changed in the app, and why it is ready. Be factual; list real changes made after tester feedback. Google replies in about a week **(verify)**. Then Production > Create release > roll out (start with 100% since the audience is small; staged rollout is available).

## 7. Updating the app later

1. Raise `version` in `package.json` (and add a fix note). The version code derives from it (or use `KEYLIGHT_BUILD_NUMBER`).
2. `bash scripts/package-android.sh --release`.
3. Play Console > Production (or a test track first) > Create release > upload the new AAB > release notes > review and roll out. Also attach the release APK to the GitHub release.
4. Keep tests and docs updated: `npm test` must pass.

### Rotating or recovering keys

- Lost or leaked **upload key**: Play Console > App integrity > Request upload key reset; make a new key with `scripts/android-keystore.sh` after moving the old folder away (the script never overwrites), and tell Google the new certificate. Details on https://support.google.com/googleplay/android-developer/answer/9842756 **(verify)**.
- The **app signing key** is Google's; you cannot lose it. Do not rely on being able to export it.

## 8. Installing outside Play (GitHub APK) and Google's developer verification

Google has announced a developer verification requirement for apps installed on certified Android devices **even from outside Play**, starting in some countries in 2026 and widening after **(verify the dates and countries at https://developer.android.com/developer-verification)**. Apps from Play are covered by the Play account verification you already do. For the GitHub APK: register the package name `org.keylight.piano` and the upload key's certificate in Android Developer Console, in the same developer identity; there is a free path for hobby/students **(verify)**, and an "advanced flow" for experienced users to install unverified apps. Follow Google's page as the rollout reaches Egypt and your testers' countries. Sideloaders also see the usual "install unknown apps" prompt.

## 9. Pre-submission checklist

- [ ] `npm test` passes (includes `scripts/test-android-release.js`).
- [ ] Release build succeeded; APK `apksigner verify` OK; app not debuggable; versionCode higher than the last upload.
- [ ] Upload keystore backed up off the Mac (two files), password not in the repo or logs.
- [ ] Installed the **release** APK on a real phone and a tablet: opens, plays a song, USB and Bluetooth keyboard connect, camera permission asks only when finger tracking is turned on.
- [ ] Store listing complete: title (30), short (80), full (4000), 2+ phone screenshots, 512 icon, 1024x500 feature graphic, category, contact email (project address), website, privacy policy URL that opens without login.
- [ ] Privacy policy matches the build (no network calls from the app; if that changes, update the policy and Data safety).
- [ ] Data safety, content rating, ads, target audience, app access forms completed as in `data-safety.md`.
- [ ] No brand or trademark names in the listing (the tests check this); screenshots do not show other companies' logos.
- [ ] The Ko-fi support link: Play's payments policy limits links that ask for money inside apps. A voluntary support link opening in the browser is common but **(verify)** Google's current Payments policy; if unsure, hide the Support section in the Android build before submitting.
- [ ] Open source licence notices included (the app bundles `LICENSES/` and `THIRD_PARTY_NOTICES.md`).
- [ ] Closed test has 12+ testers opted in for 14 days; production access applied.
