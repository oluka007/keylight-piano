# Device support reports (for maintainers)

Settings, "Support my device" opens a wizard: Detect, Test, About you, Review, Send. It builds one
plain-text report the person reads first, then copies, saves, or attaches to a GitHub issue
(`https://github.com/scizerss/keylight-piano/issues/new`, pre-filled with only a short title and body).
Keylight sends nothing itself. Code: `renderer/device-support.js` (report, parser, statistics, dialog),
`renderer/usb-probe.cjs` (USB descriptors, main process, IPC `device:usb`, no arguments).

## Report format

A human summary on top, then a fenced `json` block (the first one in the file) with
`"schema": "keylight-device-report/1"`, then the "Excluded:" footer. Parse the JSON; the summary only repeats it.
Keys are stable within schema 1; new fields are added under the same schema string and counted by the integer
`schemaRevision` (1 = the first release, 2 = per-port capture, the USB checklist and the OS version). A reader that
ignores unknown keys works with every revision; a report without `schemaRevision` is revision 1.

| Key | Meaning |
|---|---|
| `schema`, `schemaRevision`, `date` | Format id, revision (integer, 2 now), UTC date |
| `app.version`, `app.platform`, `os.*` | Keylight build, OS name, kernel release, architecture, and `os.version` (revision 2): the product version from `/usr/bin/sw_vers -productVersion` on macOS ("27.0"), the system's own name string on Windows; empty when unknown |
| `device.name/goals/works/doesNotWork/note` | What the person typed (name 80 chars, note 1000, sanitised) |
| `keys.chosen`, `keys.app` | Key count the person picked (or `"auto"`) and the one Keylight uses |
| `midi.inputs[]`, `midi.outputs[]` | `name`, `manufacturer`, `idHash` (hash of the port id), `state`, `connection` |
| `midi.sysex` | System exclusive was allowed |
| `midi.identity[]` | Universal Device Inquiry reply: `manufacturerId` (1 or 3 bytes, hex), `family`, `model`, `version` |
| `usb` | `null` when no probe ran. Otherwise `available`, `source`, `shown` (how many USB devices the wizard listed, at most 24, the same number the report can hold; the wizard says "Showing the first 24 of N" when more exist: every device that is not a hub and not an Apple part), and `devices[]` with only the ones the person ticked (`vendorId`, `productId`, `product`, `manufacturer`, `bcdDevice`, `class`). Unticked devices are only counted in `shown`, never named. With `available: false` there is a short `reason` (the readable report says "USB probe unavailable: ..."). Ports whose name or maker shares a word with a MIDI port are ticked by default; nothing is guessed by name beyond that. |
| `capture` | Statistics of a 10 s key test: note on/off counts, lowest/highest note, velocity range, aftertouch, pitch bend, mod wheel, sustain, other CC numbers, channels, clock, active sensing. Never notes or timing. Revision 2 adds `messages`, `controllers[]` (every controller seen with count, min, max) and `ports[]`: the same statistics per MIDI input (`id` = the `idHash` of `midi.inputs[]`, `name`, `messages`, note counts and range, `velocity`, `polyAftertouch`, `channelPressure`, `pitchBend` (count, min, max each), `controllers[]` (at most 16 numbers), `programChange`, `channels`, `sysexMessages`, and `noteChannels` (channels notes arrived on) and `mpeLike`, true only when notes were heard sounding together on 3 or more channels with one note per channel at a time; otherwise only the observed channels are reported. `ports[].id` is the `idHash` of the input, with `-2`, `-3` added when two ports hash alike, and the same ids are used in `midi.inputs[].idHash`). A port that sent nothing has `messages: 0`. The capture also runs when no key is pressed, so a sensor that sends only controllers or pressure shows up. |
| `lights` | `tested`, `result` (yes/partly/no), `colours`, `route` (full colour frames, MIDI notes, none) |

Unticking a USB device removes its USB line only. MIDI port names and makers are part of the report (the wizard says so on the Detect and Review steps); the "Device" name is prefilled from a port name and stays editable. Free text drops names this computer knows (user, home folder, host and their parts) and any capitalised owner name before an apostrophe-s ("Jane's iPad" becomes "[name]'s iPad").

Never included: serial numbers, USB location ids, file paths, user names, song titles, recordings, progress, notes played.

## Using a report

- Identity reply: the maker id plus family and model make a profile key (match on `manufacturerId` + `family` + `model`).
  USB `vendorId:productId` is the fallback and the way to match when the keyboard sends no reply.
- Port names: today's detection matches names (`KB_PORT` in `renderer/app.js`); a new name goes there.
- `capture`: aftertouch or channel pressure present means the expression mapping applies; listed CC numbers
  show which controls exist; `lowestNote`/`highestNote` plus `keys.chosen` give the key count and range.
- `lights`: `yes` with route `MIDI notes` means the note-light path works; `full colour frames` means the
  light service path; `no` or `none` means a new lighting path is needed (ask for a MIDI capture of the maker's app).

## Device profile entry (template)

```js
{
  id: 'maker-model',            // lower-case, stable
  name: 'Maker Model',
  match: { manufacturerId: '00 21 10', family: '04 00', model: '15 00', usb: '0x1234:0x0042', portName: /maker model/i },
  keys: 49, lowestNote: 36,
  lights: 'none',               // 'notes' | 'frames' | 'none'
  expression: { polyAftertouch: false, channelPressure: true, pitchBend: true, cc: [1, 64] },
  source: 'issue #NN'           // the report it came from
}
```

## Tests

`node scripts/test-device-support.js` covers the reply parser, capture statistics, report privacy, the issue
link, the USB filters (macOS profiler, ioreg, PowerShell fixtures), tool limits and IPC argument checks. The self-test
has `SELFTEST device support ...` lines; `?devicefake=1` opens the app with a stand-in keyboard for screenshots.
