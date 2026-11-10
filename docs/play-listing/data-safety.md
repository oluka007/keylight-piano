# Play Console declarations for Keylight (Android)

Answers to type into Play Console > Policy and programs / App content. They describe the build in this repository (version 0.3.0 line). If a later build adds a network call, an SDK, ads or accounts, re-read this file and update the Console **before** shipping it. Google's forms change: where a question wording below differs from what you see, answer by the reasoning, not the exact words. Not verified against the live Console (needs an account).

## Data safety form

Basis: Google counts data as "collected" only when it is **transmitted off the device**. Keylight transmits nothing to its developer or anyone (see `docs/PRIVACY.md`): the web view is restricted by a Content-Security-Policy to local content (`connect-src 'self' blob:`), there is no analytics, ads, crash-reporting or account SDK, and AndroidX WebKit is the only library.

| Question | Answer | Why |
|---|---|---|
| Does your app collect or share any of the required user data types? | **No** | Everything (progress, settings, imported files, recordings) stays in private app storage. Camera frames are analysed in memory on the device and never stored or sent. Bluetooth/USB data only goes to the user's own keyboard. |
| Is all of the user data collected by your app encrypted in transit? | Not asked / N/A when nothing is collected | No data leaves the device. |
| Do you provide a way for users to request that their data be deleted? | Not asked / N/A | Data is local; uninstalling or clearing app storage deletes it. |
| Data types (location, personal info, financial, health, messages, photos/videos, audio, files, calendar, contacts, app activity, web browsing, app info and performance, device or other IDs) | **None of them** | Each stays local. In particular: Camera is "processed ephemerally on device", which Google excludes from "collected". |
| Data shared with third parties | **None** | No third-party code receives data. |
| Independent security review / Families policy | No | Not applicable. |
| Privacy policy URL | The page described in `docs/PLAY-STORE.md` | Required even though no data is collected, because the app uses the Camera permission. |

If the Console asks to confirm "no data collected" it generates the label "No data collected".
Caveat: the **desktop** app's optional cover-art/lyrics lookup (song title and artist sent to itunes.apple.com and lrclib.net) is disabled in the Android build. If it is ever enabled there, change the form to declare "App activity > Other user-generated content / App interactions" as **collected and shared**, optional, for app functionality, and update the privacy policy.

## Content rating (IARC questionnaire)

Category to pick: **Utility, Productivity, Communication, or other** if Reference/Educational is not offered; otherwise **Reference, News, or Educational**. A music-learning tool is not a game.

| Question | Answer |
|---|---|
| Violence (any kind, including cartoon) | No |
| Blood, gore | No |
| Sexual content or nudity | No |
| Profanity or crude humour | No |
| Controlled substances (drugs, alcohol, tobacco) | No |
| Gambling or simulated gambling, contests with real prizes | No |
| Fear or horror themes | No |
| Users can communicate or interact with each other | No |
| Shares the user's location with others | No |
| Allows purchase of digital goods | No (no in-app purchases) |
| Unrestricted internet access / user-generated web content | No (links open in the system browser; the app itself cannot browse) |
| Is the app a news or press product | No |

Expected result: **Everyone / PEGI 3 / USK 0 / ESRB Everyone**. If a questionnaire answer would change that, re-check the answer; do not pick a rating directly.

## Other declarations

| Declaration | Answer | Justification |
|---|---|---|
| App access | **All functionality is available without special access** | No login, no account, no region gate. A MIDI keyboard is optional (reviewers can use the app without one). |
| Ads | **No, my app does not contain ads** | No ad SDK, no ad network, no ad ID use. |
| Target audience and content | Target age groups: **13-15, 16-17, 18 and over**. Not designed for children. Does not appeal primarily to children. | Choosing any age band under 13 puts the app under Google's Families policy (stricter permissions, certified SDKs). Piano learners of all ages may use it, but the developer is not offering a product directed at children and collects no data from anyone. If you want younger bands later, review the Families policy first (the Camera permission and Bluetooth are where it bites). |
| News app | **No** | |
| Government app | **No** | |
| Financial features | **No** | |
| Health | **No health features** | |
| COVID-19 contact tracing / status | **No** | |
| Advertising ID | **No, the app does not use the advertising ID** | No ad SDK; the manifest does not declare it. |
| Data safety | See above (no data collected) | |
| Sensitive permission forms (SMS, call log, background location, all-files access, package visibility, photo and video permissions, exact alarms, full-screen intent) | **None needed** | The app uses none of them. Files come from the system file picker. |
| Permissions used | CAMERA (optional), Bluetooth permissions, location only up to Android 11 | See the next section. |
| App category | Apps > **Music & Audio** | |
| Pricing | **Free** | A free app can never be switched to paid later: decide now. |
| Government/restricted countries, export compliance | Accept the standard statements | The app does not add its own encryption. |

## Permission justifications (for any review question or the Permissions declaration)

- **CAMERA** (optional, requested only when the user switches on finger tracking): shows the player's hands in a preview and finds finger positions on the device to help with finger numbers. Frames are never saved or sent. The app works without it. The manifest declares `camera.any` as not required, so devices without a camera can install.
- **BLUETOOTH_SCAN (neverForLocation) and BLUETOOTH_CONNECT** (Android 12+), **BLUETOOTH, BLUETOOTH_ADMIN, ACCESS_COARSE_LOCATION, ACCESS_FINE_LOCATION** (up to Android 11 only): find and connect to the user's own Bluetooth MIDI keyboard. Location is only the old Android requirement for scanning; Keylight does not read or store location.
- **USB** (no permission string; the system asks per device): talks to the user's USB MIDI keyboard. `usb.host`, `bluetooth_le` and `software.midi` are all declared not required.
- **INTERNET**: not declared. The app makes no network requests of its own; links open in the system browser, which has its own permission. If a later release adds the permission back, update this file and `docs/PRIVACY.md`.
