# Keylight privacy policy

Last updated: 2026-11-09. Applies to Keylight for Android (package `org.keylight.piano`), and to the Keylight desktop apps where noted.

Keylight is a free, open-source piano-learning app. The short version: **no accounts, no ads, no analytics, no tracking. What you do in the app stays on your device.**

## What Keylight does not do

- It does not ask you to create an account or sign in.
- It does not contain advertising, analytics, crash-reporting or tracking code from anyone, and no third-party SDK that collects data.
- It does not sell or share personal data, because it does not collect any.
- It does not upload your songs, recordings, practice progress or settings anywhere.

## Data that stays on your device

Settings, practice progress, imported songs and recordings are saved only in the app's private storage on your device. Android does not back them up to the cloud, and uninstalling Keylight deletes them. The app has no server of its own.

## Permissions and why

- **Bluetooth (Nearby devices) and USB**: used only to find and talk to the MIDI keyboard you choose: receiving the notes you play and, on compatible keyboards, sending light and setup messages. Nothing is sent over the internet. On Android 11 and older, Android requires Location permission for Bluetooth scanning; Keylight does not read your location.
- **Camera (optional)**: used only for the optional finger-tracking preview, and only after you switch it on and allow it. Video frames are analysed on your device and are never saved, recorded or uploaded. You can say no and use everything else.
- **Files you choose**: when you import a song, recording or score, Keylight reads that file through Android's file picker. It is converted on the device and stays on the device.
- **Internet**: the Android app does not ask for the internet permission at all, so it cannot connect to any server. See the next section.

## Network requests

The Android app shows its screens from files inside the app and does not contact any server to work. It does not hold Android's internet permission, and its web view is also set to block page connections to other sites. The only times it leaves the app are when you tap a link (for example the project page or the optional Ko-fi support page): the link opens in your browser and that site's own privacy policy applies.

The desktop app (Mac, Windows) has one optional feature that goes online: when you import a recording and leave "Look up cover art and lyrics" switched on, Keylight sends the song title and artist (and the track length) to two public services to fetch a cover image and timed lyrics:

- `itunes.apple.com` (Apple's public search service), for cover art. Apple's privacy policy applies.
- `lrclib.net` (LRCLIB, an open lyrics database), for lyrics. LRCLIB's policy applies.

This happens only while you import, only if the option is on, and nothing else is sent. The Android app does not make these requests.

## Support my device report

Settings has a "Support my device" tool that builds a plain-text report about your keyboard (device names, MIDI capabilities, a short test) to help add support for it. You read it first. Keylight does not send it: it leaves your device only if you copy it, save it, or attach it to a GitHub issue yourself. It contains no serial numbers, file paths, user names, song titles or recordings.

## Children

Keylight is a general-audience music-learning app. It collects no personal information from anyone, including children.

## Changes and contact

If this policy changes, the new version is published here with a new date. Questions, or a request about data: open an issue at https://github.com/scizerss/keylight-piano/issues. The source code is public at https://github.com/scizerss/keylight-piano, so you can check every statement above.
