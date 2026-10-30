// Key lighting for ROLI Piano M / LUMI.
//
// pack7() and checksum() are adapted from ROLILearn4All (MIT, see
// LICENSES/ROLILearn4All-MIT.txt and THIRD_PARTY_NOTICES.md).
//
// Protocol: ROLI SysEx, manufacturer 00 21 10, device id 0x00 (this Piano M
// answers on 0x00; LUMI docs say 0x37 but that frame is silent here).
// Command framing documented by the LUMI-lights project (SYSEX.txt) and the
// JUCE Blocks protocol definitions:
//   F0 00 21 10 77 <dev> <8 packed 7-bit bytes> <checksum> F7
//
// Key-by-key lighting is not a config command: the block's running Littlefoot
// program maps MIDI notes to LEDs, so individual keys are lit with note-on/off.

const ROLI_MFR = [0x00, 0x21, 0x10]
const DEV = [0x77, 0x00]

function checksum(values) {
  let c = values.length
  for (const b of values) c = (c * 3 + b) & 0xff
  return c & 0x7f
}

// Pack (value, bit-width) fields into 7-bit MIDI bytes, LSB-first — the encoding
// used by the JUCE Blocks config protocol (see LUMI-lights SYSEX.txt examples).
function pack7(fields) {
  let bits = 0n, count = 0
  for (const [value, size] of fields) {
    bits |= BigInt(value >>> 0) << BigInt(count)
    count += size
  }
  const out = []
  while (count > 0) { out.push(Number(bits & 0x7fn)); bits >>= 7n; count -= 7 }
  while (out.length < 8) out.push(0)
  return out
}

function send(port, body) {
  if (!port) return
  port.send([0xf0, ...ROLI_MFR, ...DEV, ...body, checksum(body), 0xf7])
}

/* ---------- documented config commands ---------- */

// Brightness 0..100% (wire value is percent/4, max 0x19).
export function setBrightnessPct(port, pct) {
  const v = Math.round((Math.max(0, Math.min(100, pct)) / 100) * 25)
  send(port, [0x10, 0x40, 0x04, v, 0, 0, 0, 0])
}

// App-level 0..127 scale mapped onto the documented 0..100%.
export function setBrightness(port, value) {
  setBrightnessPct(port, Math.round((Math.max(0, Math.min(127, value)) / 127) * 100))
}

// Global key colour, packing per SYSEX.txt.
export function setGlobalKeyColor(port, r, g, b) {
  const v1 = (((b & 0x03) << 5) | 0x04) & 0x7f
  const v2 = (((b >> 2) & 0x3f) | (g & 0x01)) & 0x7f
  const v3 = (g >> 1) & 0x7f
  const v4 = r & 0x7f
  const v5 = ((r >> 7) | 0x7e) & 0x7f
  send(port, [0x10, 0x20, v1, v2, v3, v4, v5, 0x03])
}

export const COLOR_MODE = { rainbow: 0x02, scale: 0x22, piano: 0x42, night: 0x62 }
export function setColorModeNamed(port, name) {
  send(port, [0x10, 0x40, COLOR_MODE[name] ?? COLOR_MODE.piano, 0, 0, 0, 0, 0])
}

/* ---------- program-event lighting ----------
   The messages the keyboard's built-in program listens for, framed as in the JUCE
   BLOCKS protocol definitions (studied for interoperability; none of that program is
   included here):
     host->device packet: F0 00 21 10 77 00 <7-bit packed> <checksum> F7
     message type 0x03 = programEventMessage, payload = 3 x uint32 (action, arg1, arg2)
     message type 0x01 = deviceCommandMessage, payload = uint9 command
   Actions: 0 turn-off-all, 1 set-all-keys-colour, 2 set-key-on(note,argb),
            3 set-key-off(note), 5 set-lighting-mode(mode, immediate), 11 brightness.
*/

function sendPacket(port, fields) {
  if (!port) return
  const body = pack7(fields)
  port.send([0xf0, ...ROLI_MFR, 0x77, 0x00, ...body, checksum(body), 0xf7])
}

export function beginApiMode(port) { sendPacket(port, [[0x01, 7], [0x00, 9]]) }
export function endApiMode(port) { sendPacket(port, [[0x01, 7], [0x02, 9]]) }
export function ping(port) { sendPacket(port, [[0x01, 7], [0x03, 9]]) }

export function programEvent(port, action, arg1, arg2) {
  sendPacket(port, [[0x03, 7], [action, 32], [arg1 >>> 0, 32], [arg2 >>> 0, 32]])
}

export const LIGHTING_MODE = { default: 0, playingSong: 1, failed: 6, singleColor: 14 }
export function setLightingMode(port, mode, immediately = 1) {
  programEvent(port, 5, mode, immediately)
}
export function setKeyOn(port, midiNote, argb) { programEvent(port, 2, midiNote, argb) }
export function setKeyOff(port, midiNote) { programEvent(port, 3, midiNote, 0) }
export function turnOffAllKeys(port) { programEvent(port, 0, 0, 0) }
export function setAllKeysToColor(port, argb) { programEvent(port, 1, 0, argb) }
export function setProgramBrightness(port, value) { programEvent(port, 11, value, 0) }

/* ---------- note-driven key lighting (fallback transport) ---------- */

export function noteOn(port, pitch, vel = 127, channel = 0) {
  if (!port) return
  port.send([0x90 + (channel & 0x0f), pitch & 0x7f, Math.max(1, Math.min(127, vel))])
}

export function noteOff(port, pitch, channel = 0) {
  if (!port) return
  port.send([0x80 + (channel & 0x0f), pitch & 0x7f, 0])
}

// Compatibility shim: app addresses keys by index; the block wants pitches.
export function setKeyColor(port, id, r, g, b) {
  if (r === 0 && g === 0 && b === 0) noteOff(port, 48 + id)
  else noteOn(port, 48 + id, 127)
}

export function clearLights(port) {
  if (!port) return
  port.send([0xb0, 64, 0])
  for (let p = 0; p < 128; p++) port.send([0x80, p, 0])
  port.send([0xb0, 123, 0])
}

/* ---------- diagnostics ---------- */

export async function noteSweep(port, sleep = (ms) => new Promise((r) => setTimeout(r, ms))) {
  if (!port) return
  setBrightnessPct(port, 100)
  for (const ch of [0, 1]) {
    for (let p = 48; p < 60; p++) { port.send([0x90 + ch, p, 127]); await sleep(60) }
    await sleep(700)
    for (let p = 48; p < 60; p++) port.send([0x80 + ch, p, 0])
    await sleep(250)
  }
}

// Documented octave command (10 40 00 <32-bit value>), value -4..5.
export function setOctave(port, octave) {
  send(port, pack7([[0x10, 7], [0x40, 7], [0b00000, 5], [octave, 32]]))
}

// Documented transpose command (10 50 00 <32-bit value>), semitones.
export function setTranspose(port, semitones) {
  send(port, pack7([[0x10, 7], [0x50, 7], [0b00000, 5], [semitones, 32]]))
}

export async function testLights(port, sleep = (ms) => new Promise((r) => setTimeout(r, ms))) {
  if (!port) return
  beginApiMode(port)
  await sleep(200)
  setLightingMode(port, 1, 1)          // PLAYING_SONG
  await sleep(200)
  setAllKeysToColor(port, 0xffff00ff)  // whole keyboard magenta
  await sleep(2200)
  turnOffAllKeys(port)
  await sleep(300)

  // per-key rainbow: exercises SET_KEY_ON with ARGB
  const hues = [0xffff0000, 0xffff8000, 0xffffff00, 0xff40ff40, 0xff00ffff, 0xff4080ff, 0xffff40ff]
  for (let i = 0; i < 12; i++) setKeyOn(port, 60 + i, hues[i % hues.length])
  await sleep(2600)
  turnOffAllKeys(port)
  setLightingMode(port, 0, 1)          // back to DEFAULT
  endApiMode(port)
}
