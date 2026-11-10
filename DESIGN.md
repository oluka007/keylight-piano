# Keylight interface contract

## 1. Identity

Preserve the existing indigo learning app and charcoal player. Outfit, illustrated song covers,
hand colours and the piano are the identity. New controls explain actions rather than advertise
features. The free download and ordinary playing remain available without an account or payment.

## 2. Colour

The app's source of colour tokens is `renderer/style.css :root`: `--bg` #151245,
`--surface` #221d7a, `--surface-2` #28228b, `--text` white, `--muted` #a6a5b8,
`--accent` #0064c8, `--accent-2` #a9ccff, `--line` translucent white.
Player colours and hand colours remain as declared there. New app UI references these tokens.
The download page repeats the identity with a system light variant and no external font requests.

## 3. Typography

App: bundled Outfit with system fallback. Body 15px, secondary 14px, section headings 20px,
dialog headings 28px, line-height 1.5. Touch forms use at least 16px inputs. The download page
uses the system font, 17px body and a responsive 32-48px title. No new icon family.

## 4. Layout

Keep existing shell and screen scroll ownership. New spacing uses 4, 8, 12, 16, 24, 32px;
radii reuse `--radius` and `--radius-lg`. Controls on touch surfaces are at least 44px tall.

Layout: support dialog = centred stack, dialog is the only scroll owner, wrapping action cluster,
maximum width 560px, 16px viewport inset. No nested cards, fixed footer or decoration.
Layout: download page = document-scrolling single column, maximum text width 68ch, download
choices before the optional support link. No payment overlay or countdown.
Layout: compact player = two-row toolbar, transport below stage, horizontal scroll owner only
for the secondary HUD row. The main document never grows wider than the viewport. Compact
Settings uses one column with each screen as its scroll owner. Diagnostics scrolls the whole
dialog, starts focused at its heading, and keeps report text selectable.

## 5. Components and required content

Reuse `.primary`, `.ghost`, `.mini-btn`, `.settings-card` and existing focus states.
Support dialog primary action: Continue for free. Priorities: free access, purpose of support,
then the optional external Ko-fi link. Required: free/offline promise, one-time or monthly choice
handled on Ko-fi, external-browser explanation, close/continue action, no locked features.
Native dialog supplies focus containment, Escape and return focus. Loading a payment page never
blocks playing. No donor status or payment records are stored in Keylight.

Download page primary action: Download for free. Required: desktop and Android capability wording,
public release link, optional donation link, source link, and no claim of a published build that
has only been built locally. Keep the page usable without JavaScript.

## 6. Motion

Retain existing 120/180ms control feedback. No new entrance effects. New dialogs use native modal
behaviour. Reduced-motion removes positional screen transitions, while the musical playhead still
represents playback.

## 7. Surfaces

Tonal surfaces with existing neutral hairlines. No coloured side stripes, accent card outlines,
glass, new gradients or promotional badges. Status is conveyed in words as well as colour.

## 8. Accessibility and existing limitations

New flows must be keyboard operable, visibly focused and readable at 320px; test at 390 and 1440px.
The inherited app currently has one dark theme. A global light theme is not introduced by the
support flow. Desktop player density at compact widths is an existing gap to address for Android.
Do not report whole-app WCAG certification from testing only the changed dialogs.

## 9. Gap ledger

| Gap | Evidence | Intended proof | State |
| --- | --- | --- | --- |
| No optional support flow in app | baseline Settings capture | dialog rendered at390/1440, interaction checks pending | implemented |
| External links lack an explicit browser boundary | main.js BrowserWindow setup | 18 URL cases, mutation rejects unsafe URL | implemented |
| No tablet viewport declaration | renderer/index.html head | viewport390 holds390 on Home/Settings/Player | implemented |
| New installers not yet available | dist holds portable zip builds | build and inspect DMG/Setup.exe/APK | locally built and inspected after the gate fixes; unpublished, not run on Windows |
