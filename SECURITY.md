# Security policy

Keylight is a free, open-source, local-first app. It is built by volunteers and, like
any project, it can have security problems. If you find one, please report it
privately so it can be fixed before anyone can take advantage of it.

## Reporting a vulnerability privately

Use GitHub's private vulnerability reporting:

1. Open the repository on GitHub.
2. Go to the **Security** tab.
3. Click **Report a vulnerability**.
4. Describe the problem in the form that opens.

This starts a private conversation with the maintainers that stays out of the public
issue tracker until a fix is ready. It is the preferred way to report anything
security-related.

Please **do not** open a public issue for a security problem, and **do not** publish
details anywhere before a fix has been released. Give the maintainers a reasonable
chance to fix it first.

## What to include

- **What the problem is**, and roughly how serious you think it is.
- **Steps to reproduce it**, or the smallest example that shows it.
- **Which version** of Keylight you were running (Settings → About), and on which
  platform (Mac, Windows or Android).
- **Any files or output** that help: a log line, a report from Settings → Support my
  device, or a short clip.
- A way to **contact you** if the private report needs follow-up.

You do not need a working exploit or a polished write-up. A clear description of what
you saw is enough to start.

## What is in scope

- **The desktop app** (Mac and Windows): the Electron main process, the renderer, and
  the bundled light service and third-party libraries.
- **The Android app.** It is installed from an APK and uses native USB/Bluetooth MIDI
  and a system WebView.
- **The website** (`site-next/` and the published pages) and the download pages.

## What Keylight is not

Keylight has **no user accounts and no servers of its own.** It does not sign you in,
does not store anything in the cloud, and does not send your songs, recordings or
progress anywhere. There is therefore no account system, no user database and no
backend to breach. Please keep that in mind when judging what counts as a
vulnerability here.

The app does make optional network requests in two places, described in
[docs/PRIVACY.md](docs/PRIVACY.md): the cover-art and lyrics lookup for imported songs
(only while importing and only if you leave it on), and links you open in your browser.

## Supported versions

Only the **latest release** is supported with security fixes. Older builds do not
receive patches; if you are running one, please update before reporting, or say that
you cannot and why.

## No bug bounty

There is no bug bounty and no payment for reports. Keylight is a volunteer project and
has no funds for it. We are grateful for every report all the same, and we will credit
you in the fix if you would like to be named.

## After you report

The maintainers will look at the report, try to reproduce it, and work on a fix. This
is a volunteer project, so it may take some time — thank you for your patience. Once a
fix is released, we will explain what was wrong, without publishing details before
then.
