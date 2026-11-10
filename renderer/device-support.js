// "Support my device": a wizard that gathers what we need to add a keyboard to Keylight, shows the
// exact report, and lets the person copy it, save it, or open a GitHub issue. Nothing is sent
// anywhere by Keylight: the person pastes or attaches the report themselves.
//
// The first half of this file is pure (parsing, statistics, the report, the issue link) so
// scripts/test-device-support.js can run it in Node. The second half is the dialog.
import { downloadFile } from './download.js'

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
export const SCHEMA = 'keylight-device-report/1'
export const SCHEMA_REVISION = 2     // new fields are added under the same schema string: this counts them
export const ISSUE_URL = 'https://github.com/scizerss/keylight-piano/issues/new'
export const ISSUE_URL_MAX = 1800
export const NAME_MAX = 80
export const NOTE_MAX = 1000
export const INQUIRY = [0xf0, 0x7e, 0x7f, 0x06, 0x01, 0xf7]
export const EXCLUDED = 'serial numbers, device locations, file paths, user names, song titles, recordings, progress, and the notes you played'

import { sanitizeText } from './sanitize-text.js'
export { sanitizeText }

// a short stable stand-in for a port id: enough to tell two ports apart, nothing to look up
export function idHash(id) {
  let h = 0x811c9dc5
  for (const ch of String(id == null ? '' : id)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0 }
  return h.toString(16).padStart(8, '0')
}

/* ---------- MIDI Universal Device Inquiry reply ---------- */
const hexBytes = (bytes) => bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ')
// F0 7E <device> 06 02 <maker: 1 byte, or 00 + 2 bytes> <family 2> <model 2> <version 4> F7
export function parseIdentityReply(data) {
  if (!data || typeof data.length !== 'number') return null
  const bytes = Array.from(data)
  if (bytes.length < 2 || bytes[0] !== 0xf0 || bytes.some((b) => !Number.isInteger(b) || b < 0 || b > 0xff)) return null
  const end = bytes[bytes.length - 1] === 0xf7 ? bytes.length - 1 : bytes.length
  const body = bytes.slice(1, end)               // 7E <device> 06 02 ...
  if (body.length < 4 || body[0] !== 0x7e || body[2] !== 0x06 || body[3] !== 0x02) return null
  if (body.slice(4).some((b) => b > 0x7f)) return null
  const rest = body.slice(4)
  const long = rest[0] === 0
  const makerLen = long ? 3 : 1
  if (rest.length !== makerLen + 8) return null
  const maker = rest.slice(0, makerLen)
  const family = rest.slice(makerLen, makerLen + 2)
  const model = rest.slice(makerLen + 2, makerLen + 4)
  const version = rest.slice(makerLen + 4, makerLen + 8)
  return {
    manufacturerId: hexBytes(maker), family: hexBytes(family), model: hexBytes(model),
    familyCode: family[0] | (family[1] << 7), modelCode: model[0] | (model[1] << 7),
    versionBytes: hexBytes(version), version: version.join('.')
  }
}

/* ---------- capture statistics: numbers only, never the notes ---------- */
const range = () => ({ count: 0, min: null, max: null })
const widen = (r, v) => { r.count++; r.min = r.min == null ? v : Math.min(r.min, v); r.max = r.max == null ? v : Math.max(r.max, v) }
export function newCapture() {
  return { messages: 0, noteOn: 0, noteOff: 0, low: null, high: null, velocity: range(), polyAftertouch: range(), channelPressure: range(),
    pitchBend: range(), cc: {}, channels: {}, noteChannels: {}, held: {}, multi: false, mpeSeen: false, programChange: 0, clock: 0, activeSensing: 0, sysex: 0, other: 0, ports: {} }
}
// the checklist shows at most USB_MAX devices and the report holds at most USB_MAX: the two never differ
export const USB_MAX = 24
export const MAX_CAPTURE_PORTS = 24, PORT_CC_LIMIT = 16
const portKey = (id) => 'p:' + String(id == null ? '' : id)   // the whole id: two ids that differ late stay two ports
// The reducer keeps counts, extremes and which channels or controllers appeared. It has no list,
// no order and no timing, so there is nothing to play back.
export function captureAdd(cap, data, ccLimit = 32) {
  const status = data && data[0]
  if (!Number.isInteger(status) || status < 0x80) return cap
  cap.messages++
  if (status === 0xf8) { cap.clock++; return cap }
  if (status === 0xfe) { cap.activeSensing++; return cap }
  if (status === 0xf0) { cap.sysex++; return cap }
  if (status >= 0xf0) { cap.other++; return cap }
  const type = status & 0xf0, ch = (status & 0x0f) + 1
  const d1 = (data[1] || 0) & 0x7f, d2 = (data[2] || 0) & 0x7f
  cap.channels[ch] = true
  if (type === 0x90 && d2 > 0) {
    cap.noteOn++; widen(cap.velocity, d2)
    cap.noteChannels[ch] = true
    // Transient occupancy: how many notes are sounding on each channel right now. Only the two verdicts below are kept.
    cap.held[ch] = (cap.held[ch] || 0) + 1
    if (cap.held[ch] > 1) cap.multi = true
    if (Object.values(cap.held).filter((n) => n > 0).length >= 3) cap.mpeSeen = true
    cap.low = cap.low == null ? d1 : Math.min(cap.low, d1)
    cap.high = cap.high == null ? d1 : Math.max(cap.high, d1)
  } else if (type === 0x80 || type === 0x90) { cap.noteOff++; if (cap.held[ch] > 0) cap.held[ch]-- }
  else if (type === 0xa0) widen(cap.polyAftertouch, d2)
  else if (type === 0xd0) widen(cap.channelPressure, d1)
  else if (type === 0xe0) widen(cap.pitchBend, (d2 << 7) | d1)
  else if (type === 0xb0) {
    if (d1 === 120 || d1 === 123) cap.held[ch] = 0   // all sound off, all notes off: nothing sounds on that channel now
    if (cap.cc[d1] || Object.keys(cap.cc).length < ccLimit) { cap.cc[d1] = cap.cc[d1] || range(); widen(cap.cc[d1], d2) }
  } else if (type === 0xc0) cap.programChange++
  return cap
}
// One message from one input: it counts in the total and in that input's own statistics. The input is
// known only by idHash, and there is room for MAX_CAPTURE_PORTS of them, so memory stays small however
// much is played.
export function captureFeed(cap, data, portId) {
  captureAdd(cap, data)
  if (portId == null) return cap
  const key = portKey(portId)
  let own = cap.ports[key]
  if (!own) { if (Object.keys(cap.ports).length >= MAX_CAPTURE_PORTS) return cap; own = cap.ports[key] = newCapture() }
  captureAdd(own, data, PORT_CC_LIMIT)
  return cap
}
// whatever arrives is rebuilt field by field, so only numbers of the known shape get through
export function normalizeCapture(c, depth = 0) {
  c = c && typeof c === 'object' ? c : {}
  const n = newCapture(), int = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : null)
  const rng = (r, hi) => { const o = range(); if (r && Number.isInteger(r.count) && r.count > 0 && int(r.min, 0, hi) != null && int(r.max, 0, hi) != null) { o.count = r.count; o.min = r.min; o.max = r.max } return o }
  for (const k of ['messages', 'noteOn', 'noteOff', 'programChange', 'clock', 'activeSensing', 'sysex', 'other']) n[k] = Number.isInteger(c[k]) && c[k] >= 0 ? c[k] : 0
  n.low = int(c.low, 0, 127); n.high = int(c.high, 0, 127)
  n.velocity = rng(c.velocity, 127); n.polyAftertouch = rng(c.polyAftertouch, 127); n.channelPressure = rng(c.channelPressure, 127); n.pitchBend = rng(c.pitchBend, 16383)
  for (const k of Object.keys(c.cc || {}).slice(0, 32)) { const cc = int(Number(k), 0, 127); if (cc != null) { const r = rng(c.cc[k], 127); if (r.count) n.cc[cc] = r } }
  for (const k of Object.keys(c.channels || {})) { const ch = int(Number(k), 1, 16); if (ch != null) n.channels[ch] = true }
  for (const k of Object.keys(c.noteChannels || {})) { const ch = int(Number(k), 1, 16); if (ch != null) n.noteChannels[ch] = true }
  n.mpeSeen = c.mpeSeen === true; n.multi = c.multi === true
  if (depth < 1) for (const k of Object.keys(c.ports || {}).slice(0, MAX_CAPTURE_PORTS)) if (/^p:/.test(k)) n.ports[k] = normalizeCapture(c.ports[k], depth + 1)
  return n
}
const span = (r) => (r.count ? { count: r.count, min: r.min, max: r.max } : null)
export function captureSummary(cap) {
  if (!cap) return null
  const ccs = Object.keys(cap.cc).map(Number).sort((a, b) => a - b)
  return {
    noteOn: cap.noteOn, noteOff: cap.noteOff, lowestNote: cap.low, highestNote: cap.high,
    velocity: cap.velocity.count ? { min: cap.velocity.min, max: cap.velocity.max } : null,
    polyAftertouch: span(cap.polyAftertouch), channelPressure: span(cap.channelPressure), pitchBend: span(cap.pitchBend),
    modWheel: cap.cc[1] ? { min: cap.cc[1].min, max: cap.cc[1].max } : null,
    sustainPedal: cap.cc[64] ? { min: cap.cc[64].min, max: cap.cc[64].max } : null,
    controllers: ccs.slice(0, 32).map((n) => ({ cc: n, count: cap.cc[n].count, min: cap.cc[n].min, max: cap.cc[n].max })),
    otherControllers: ccs.filter((n) => n !== 1 && n !== 64).map((n) => ({ cc: n, count: cap.cc[n].count, min: cap.cc[n].min, max: cap.cc[n].max })),
    channels: Object.keys(cap.channels).map(Number).sort((a, b) => a - b), messages: cap.messages,
    programChange: cap.programChange, sendsClock: cap.clock > 0, sendsActiveSensing: cap.activeSensing > 0, sysexMessages: cap.sysex
  }
}

// "One channel per note" is claimed only when notes were heard sounding together on 3 or more channels,
// each channel holding a single note at a time. Anything less is reported as the plain fact (which channels
// notes arrived on). Neither verdict keeps an order or a time.
export const mpeLike = (cap) => !!cap && cap.mpeSeen === true && cap.multi !== true
// Collision-free report ids: the short hash of the port id, with -2, -3 added when two ports hash alike
export function reportIds(ports) {
  const used = new Set()
  return (ports || []).map((p) => {
    const base = idHash(p && p.id)
    let id = base, n = 1
    while (used.has(id)) id = base + '-' + (++n)
    used.add(id)
    return id
  })
}
// one block per input port, in the same terms as the whole-capture summary
export function portSummaries(cap, inputs = []) {
  if (!cap) return []
  const rows = []
  const used = new Set()
  const uniq = (base) => { let id = base, n = 1; while (used.has(id)) id = base + '-' + (++n); used.add(id); return id }
  const seen = new Set()
  const add = (key, base, name) => {
    if (seen.has(key) || rows.length >= MAX_CAPTURE_PORTS) return
    seen.add(key)
    const own = cap.ports && cap.ports[key]
    const sum = own ? captureSummary(own) : null
    rows.push({ id: uniq(base), name, messages: own ? own.messages : 0, ...(sum ? {
      noteOn: sum.noteOn, noteOff: sum.noteOff, lowestNote: sum.lowestNote, highestNote: sum.highestNote, velocity: sum.velocity,
      polyAftertouch: sum.polyAftertouch, channelPressure: sum.channelPressure, pitchBend: sum.pitchBend,
      controllers: sum.controllers.slice(0, PORT_CC_LIMIT), programChange: sum.programChange, channels: sum.channels,
      noteChannels: Object.keys(own.noteChannels || {}).map(Number).sort((a, b) => a - b), sysexMessages: sum.sysexMessages,
      mpeLike: mpeLike(own)
    } : {}) })
  }
  const ids = reportIds(inputs)
  inputs.forEach((p, i) => add(portKey(p.id), ids[i], p.name || ''))
  for (const key of Object.keys(cap.ports || {})) add(key, idHash(key.slice(2)), '')
  return rows
}

/* ---------- the report ---------- */
const GOALS = ['Key lights', 'Learning songs', 'Expression (pitch bend, pressure)', 'Playing wirelessly', 'Something else']
const FEATURES = ['Keylight finds my keyboard', 'Notes play', 'Key lights', 'Sustain pedal', 'Pitch bend or pressure']
export const DEVICE_GOALS = GOALS
export const DEVICE_FEATURES = FEATURES

const pickList = (list, allowed) => (Array.isArray(list) ? list.filter((x) => allowed.includes(x)) : [])
const num = (v) => (Number.isFinite(v) ? v : null)
const dateOnly = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d)) ? String(d) : new Date().toISOString().slice(0, 10)

// Every field is copied by name and sanitised: anything else in the input (a serial, a path, a
// song title) has nowhere to go.
export function reportData(input = {}) {
  const redact = Array.isArray(input.redact) ? input.redact.map(String) : []
  const s = (v, max = NAME_MAX) => sanitizeText(v, max, { redact })
  const port = (p, id) => ({ name: s(p && p.name), manufacturer: s(p && p.manufacturer), idHash: id, state: s(p && p.state, 20), connection: s(p && p.connection, 20) })
  const ports = input.ports || {}
  const about = input.about || {}
  // Only the devices the person ticked reach this point (the wizard passes just those); how many were shown is a bare number.
  const hex4 = (v) => (typeof v === 'string' && /^0x[0-9a-f]{4}$/.test(v) ? v : '')
  const probe = input.usb && typeof input.usb === 'object' ? input.usb : null
  const picked = probe && probe.ok ? (Array.isArray(probe.devices) ? probe.devices : []).filter((d) => d && hex4(d.vendorId) && hex4(d.productId)).slice(0, USB_MAX).map((d) => ({
    vendorId: d.vendorId, productId: d.productId, product: s(d.product), manufacturer: s(d.manufacturer),
    bcdDevice: /^\d{1,3}\.\d{1,3}$/.test(d.bcdDevice) ? d.bcdDevice : '', class: s(d.class, 30)
  })) : []
  const usb = !probe ? null : probe.ok
    ? { available: true, source: s(probe.source, 30), shown: Number.isInteger(probe.shown) && probe.shown >= picked.length && probe.shown <= USB_MAX ? probe.shown : picked.length, devices: picked }
    : { available: false, source: '', reason: s(probe.reason, 40) || 'unknown', shown: 0, devices: [] }
  const lights = input.lights || {}
  const keysChosen = input.keys && input.keys.chosen
  return {
    schema: SCHEMA,
    schemaRevision: SCHEMA_REVISION,
    date: dateOnly(input.date),
    app: { version: s(input.app && input.app.version, 40), platform: s(input.app && input.app.platform, 20) },
    os: { platform: ({ darwin: 'macOS (Darwin kernel)', win32: 'Windows', linux: 'Linux' })[input.os && input.os.platform] || s(input.os && input.os.platform, 30), release: s(input.os && input.os.release, 40), arch: s(input.os && input.os.arch, 20), version: s(input.os && input.os.version, 40) },
    device: {
      name: s(about.name),
      goals: pickList(about.goals, GOALS),
      works: pickList(about.works, FEATURES),
      doesNotWork: pickList(about.doesNotWork, FEATURES),
      note: sanitizeText(about.note, NOTE_MAX, { redact, keepLines: true })
    },
    keys: { chosen: keysChosen && keysChosen !== 'auto' && Number.isInteger(Number(keysChosen)) ? Number(keysChosen) : 'auto', app: num(input.keys && input.keys.app) },
    midi: {
      sysex: !!input.sysex,
      inputs: (ports.inputs || []).slice(0, 24).map((p, i, all) => port(p, reportIds(all)[i])),
      outputs: (ports.outputs || []).slice(0, 24).map((p, i, all) => port(p, reportIds(all)[i])),
      identity: (input.identity || []).slice(0, 24).map((r) => ({
        port: s(r.port), manufacturerId: s(r.manufacturerId, 12), family: s(r.family, 8), model: s(r.model, 8), version: s(r.version, 16), versionBytes: s(r.versionBytes, 16)
      }))
    },
    usb,
    capture: input.capture ? (() => { const n = normalizeCapture(input.capture); const sum = captureSummary(n); sum.ports = portSummaries(n, ports.inputs || []).map((r) => ({ ...r, name: s(r.name) })); return sum })() : null,
    lights: {
      route: s(lights.route, 40), tested: !!lights.tested,
      result: ['yes', 'partly', 'no'].includes(lights.result) ? lights.result : '',
      colours: pickList(lights.colours, LIGHT_COLOURS)
    }
  }
}
export const LIGHT_COLOURS = ['More than one colour', 'One colour only', 'Some keys stayed lit afterwards']

// user text in the readable half: nothing that could open a fence, a quote, a table or markup
const md = (v) => String(v == null ? '' : v).replace(/[`~]/g, "'").replace(/</g, '\u2039').replace(/>/g, '\u203a').replace(/\|/g, '\u00a6').replace(/\r?\n/g, ' ')
const dash = (v) => (v === '' || v == null ? '-' : v)
// "macOS 27.0 (Darwin 27.0.0) arm64", or what is known; Windows shows the system's own name string
function systemText(o) {
  const rel = dash(md(o.release)), arch = md(o.arch)
  const head = o.version && /^macOS/.test(o.platform) ? `macOS ${md(o.version)} (Darwin ${rel})` : o.version && o.platform === 'Windows' ? `${md(o.version)} (build ${rel})` : `${dash(md(o.platform))} ${rel}`
  return (head + ' ' + dash(arch)).trim()
}
const rangeText = (r) => (r ? `${r.count} seen, ${r.min}-${r.max}` : 'not seen')

export function buildReport(input) {
  const d = reportData(input)
  const out = []
  const line = (t = '') => out.push(t)
  line('Keylight device report')
  line('schema: ' + d.schema)
  line('date: ' + d.date)
  line()
  line('Device: ' + (md(d.device.name) || 'not given'))
  line('Wants to: ' + (d.device.goals.join(', ') || 'not given'))
  line(`Keylight: ${dash(md(d.app.version))} (${dash(md(d.app.platform))})`)
  line('System: ' + systemText(d.os))
  line('Number of keys: ' + (d.keys.chosen === 'auto' ? 'automatic' : d.keys.chosen) + (d.keys.app ? ` (Keylight uses ${d.keys.app})` : ''))
  line()
  line(`MIDI inputs (${d.midi.inputs.length}):`)
  for (const p of d.midi.inputs) line(`  - ${dash(md(p.name))} | maker: ${dash(md(p.manufacturer))} | id: ${p.idHash} | ${dash(p.state)} | ${dash(p.connection)}`)
  line(`MIDI outputs (${d.midi.outputs.length}):`)
  for (const p of d.midi.outputs) line(`  - ${dash(md(p.name))} | maker: ${dash(md(p.manufacturer))} | id: ${p.idHash} | ${dash(p.state)} | ${dash(p.connection)}`)
  line('System exclusive allowed: ' + (d.midi.sysex ? 'yes' : 'no'))
  line('Identity replies (' + d.midi.identity.length + '):')
  if (!d.midi.identity.length) line('  none')
  for (const r of d.midi.identity) line(`  - ${dash(md(r.port))} | maker ${dash(md(r.manufacturerId))} | family ${dash(r.family)} | model ${dash(r.model)} | firmware ${dash(r.version)}`)
  if (d.usb && !d.usb.available) line('USB probe unavailable: ' + (d.usb.reason === 'not available' ? 'not supported here' : md(d.usb.reason)))
  else line('USB devices: ' + (d.usb ? `${d.usb.devices.length} of ${d.usb.shown} shown (${dash(d.usb.source)}); only the ticked ones are listed` : 'not available'))
  if (d.usb) for (const u of d.usb.devices) line(`  - ${dash(md(u.product))} | maker: ${dash(md(u.manufacturer))} | vendor ${dash(u.vendorId)} | product ${dash(u.productId)} | release ${dash(u.bcdDevice)} | class ${dash(u.class)}`)
  const c = d.capture
  if (c) {
    line('Key press test (statistics only):')
    line(`  notes on/off: ${c.noteOn}/${c.noteOff} | lowest ${dash(c.lowestNote)} | highest ${dash(c.highestNote)} | velocity ${c.velocity ? c.velocity.min + '-' + c.velocity.max : 'none'}`)
    line(`  polyphonic aftertouch: ${rangeText(c.polyAftertouch)} | channel pressure: ${rangeText(c.channelPressure)} | pitch bend: ${rangeText(c.pitchBend)}`)
    line(`  mod wheel: ${c.modWheel ? c.modWheel.min + '-' + c.modWheel.max : 'not seen'} | sustain pedal: ${c.sustainPedal ? c.sustainPedal.min + '-' + c.sustainPedal.max : 'not seen'}`)
    line('  other controllers: ' + (c.otherControllers.map((x) => `CC${x.cc} ${x.min}-${x.max}`).join(', ') || 'none') + ' | channels: ' + (c.channels.join(', ') || 'none'))
    line(`  clock: ${c.sendsClock ? 'yes' : 'no'} | active sensing: ${c.sendsActiveSensing ? 'yes' : 'no'}`)
    line('Per input port (the same test, counted separately):')
    for (const p of c.ports) {
      line(`  ${dash(md(p.name))} | id: ${p.id} | messages: ${p.messages}`)
      if (!p.messages) { line('    nothing received'); continue }
      line(`    notes on/off: ${p.noteOn}/${p.noteOff} | lowest ${dash(p.lowestNote)} | highest ${dash(p.highestNote)} | velocity ${p.velocity ? p.velocity.min + '-' + p.velocity.max : 'none'} | channels: ${p.channels.join(', ') || 'none'}${p.mpeLike ? ' | notes sounded together on separate channels, one note each' : p.noteChannels.length >= 3 ? ' | notes arrived on channels ' + p.noteChannels.join(', ') : ''}`)
      line(`    polyphonic aftertouch: ${rangeText(p.polyAftertouch)} | channel pressure: ${rangeText(p.channelPressure)} | pitch bend: ${rangeText(p.pitchBend)}`)
      line('    controllers: ' + (p.controllers.map((x) => `CC${x.cc} ${x.min}-${x.max}`).join(', ') || 'none') + ` | program changes: ${p.programChange} | system exclusive: ${p.sysexMessages}`)
    }
  } else line('Key press test: skipped')
  line('Lights check: ' + (d.lights.tested ? `${d.lights.result || 'no answer'}${d.lights.colours.length ? ' (' + d.lights.colours.join(', ') + ')' : ''}` : 'skipped') + ` | route: ${dash(md(d.lights.route))}`)
  line('Works: ' + (d.device.works.join(', ') || 'not given'))
  line('Does not work: ' + (d.device.doesNotWork.join(', ') || 'not given'))
  if (d.device.note) { line('Note:'); for (const l of d.device.note.split('\n')) line('  > ' + md(l)) } else line('Note: none')
  line()
  const json = JSON.stringify(d, null, 2)
  const fence = '`'.repeat(Math.max(3, Math.max(0, ...(json.match(/`+/g) || []).map((r) => r.length)) + 1))   // longer than any run inside
  line(fence + 'json')
  line(json)
  line(fence)
  line()
  line('Excluded: ' + EXCLUDED + '.')
  line('Nothing is sent automatically. Review this report, then paste or attach it yourself.')
  return out.join('\n')
}

export const reportSize = (text) => ({ chars: text.length, bytes: new TextEncoder().encode(text).length })

// the short lines the GitHub issue starts with: counts and answers, never the report itself
export function summaryLines(input) {
  const d = reportData(input)
  const lines = [`MIDI ports: ${d.midi.inputs.length} in, ${d.midi.outputs.length} out`]
  lines.push('Identity reply: ' + (d.midi.identity.length ? d.midi.identity.map((r) => `maker ${r.manufacturerId}`).join('; ') : 'none'))
  if (d.usb && d.usb.devices.length) lines.push(`USB: ${d.usb.devices[0].vendorId}:${d.usb.devices[0].productId}`)
  lines.push('Key press test: ' + (d.capture ? `${d.capture.noteOn} notes` : 'skipped'))
  lines.push('Lights check: ' + (d.lights.tested ? d.lights.result || 'no answer' : 'skipped'))
  return lines
}

// A fixed address with a short title and body. Longer text is cut until the whole address fits;
// the report is never in it.
export function buildIssueUrl(input) {
  const d = reportData(input)
  const name = sanitizeText(d.device.name, 40).replace(/%/g, '') || 'my keyboard'
  const title = 'Support request: ' + name
  const head = [`Device: ${name}`, `System: ${[d.os.platform, d.os.release, d.os.arch].filter(Boolean).join(' ') || 'unknown'}`, `Keylight: ${d.app.version || 'unknown'}`, '', ...summaryLines(input).map((l) => '- ' + l), '']
  const tail = 'Please paste or attach the report (Copy report or Save as file in Keylight, Settings, Support my device).'
  const make = (lines) => `${ISSUE_URL}?title=${encodeURIComponent(title)}&body=${encodeURIComponent([...lines, tail].join('\n').replace(/%/g, ''))}`
  let lines = head
  let url = make(lines)
  while (url.length > ISSUE_URL_MAX && lines.length > 3) { lines = lines.slice(0, -1); url = make(lines) }
  if (url.length > ISSUE_URL_MAX) url = `${ISSUE_URL}?title=${encodeURIComponent('Support request')}&body=${encodeURIComponent(tail)}`
  return url
}

/* ---------- USB checklist: nothing is guessed to be relevant, but what shares a word with a MIDI port is ticked ---------- */
const GENERIC = new Set(['usb', 'midi', 'device', 'devices', 'port', 'ports', 'input', 'output', 'audio', 'the', 'and', 'for', 'with', 'ltd', 'inc', 'corp', 'corporation', 'company', 'limited', 'gmbh', 'electronics', 'technology', 'technologies', 'generic', 'standard', 'unknown', 'not', 'reported'])
const tokens = (text) => String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !GENERIC.has(t) && !/^\d+$/.test(t))
// one boolean per device: true when its product or maker text shares a word with any MIDI port name or maker
export function defaultUsbPicks(devices, portList) {
  const known = new Set()
  for (const p of portList || []) for (const t of [...tokens(p && p.name), ...tokens(p && p.manufacturer)]) known.add(t)
  return (Array.isArray(devices) ? devices : []).map((d) => !!d && [...tokens(d.product), ...tokens(d.manufacturer)].some((t) => known.has(t)))
}
// the best guess for "Device": the first input that is not a pedal or expression sub-port, else an identity reply's port
export function guessDeviceName(inputs, identity) {
  const SUB = /pedal|expression|sensor|loopback|iac|session|network|through|virtual|bus \d/i
  const first = (inputs || []).find((p) => p && p.name && !SUB.test(p.name))
  if (first) return first.name
  const reply = (identity || []).find((r) => r && r.port)
  return reply ? reply.port : ''
}

/* ---------- a stand-in keyboard for screenshots and the self-test (?devicefake=1) ---------- */
export function fakeMidiAccess({ openDelay = 0, openFails = false } = {}) {
  const listeners = new Set()
  const input = { id: 'fake-in-1', name: 'Example Keyboard', manufacturer: 'Example Maker', state: 'connected', connection: 'closed', type: 'input',
    open: async () => { if (openDelay) await wait(openDelay); if (openFails) throw new Error('refused'); return input },
    listenerCount: () => listeners.size,
    addEventListener: (t, fn) => { if (t === 'midimessage') listeners.add(fn) }, removeEventListener: (t, fn) => listeners.delete(fn) }
  const output = { id: 'fake-out-1', name: 'Example Keyboard', manufacturer: 'Example Maker', state: 'connected', connection: 'closed', type: 'output',
    open: async () => output,
    send(data) {
      if (data[1] === 0x7e && data[3] === 0x06 && data[4] === 0x01) {
        setTimeout(() => { for (const fn of listeners) fn({ data: new Uint8Array([0xf0, 0x7e, 0x00, 0x06, 0x02, 0x00, 0x21, 0x10, 0x04, 0x00, 0x15, 0x00, 0x02, 0x01, 0x00, 0x03, 0xf7]) }) }, 30)
      }
    } }
  return { sysexEnabled: true, inputs: new Map([[input.id, input]]), outputs: new Map([[output.id, output]]), fake: true }
}
export const fakeUsb = async () => ({ ok: true, source: 'system_profiler', devices: [
  { vendorId: '0x1234', productId: '0x0042', product: 'Example Keyboard', manufacturer: 'Example Maker', bcdDevice: '1.05', class: 'audio' },
  { vendorId: '0x1235', productId: '0x1000', product: 'Example Pedal', manufacturer: 'Example Maker', bcdDevice: '1.00', class: '' },
  { vendorId: '0x2936', productId: '0x1202', product: 'Tracking Camera', manufacturer: 'Sensorco', bcdDevice: '3.94', class: '' },
  { vendorId: '0x046d', productId: '0xc077', product: 'USB Optical Mouse', manufacturer: 'Mousecorp', bcdDevice: '72.00', class: '' },
  { vendorId: '0x0781', productId: '0x5581', product: 'USB Drive', manufacturer: 'Diskco', bcdDevice: '1.00', class: '' }],
  os: { platform: 'darwin', release: '27.0.0', arch: 'arm64', version: '27.0' }, redact: [] })

/* ---------- the dialog ---------- */
const STEPS = ['detect', 'test', 'about', 'review', 'send']
const COUNT_CHOICES = [25, 32, 37, 48, 49, 61, 76, 88]
const CAPTURE_MS = 10000, IDENTITY_MS = 1500

export function mountDeviceSupport(ctx) {
  const $ = (id) => document.getElementById(id)
  const dialog = $('deviceDialog')
  if (!dialog) return null
  const calm = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches
  const st = {
    step: 0, detected: false, busy: false, ports: { inputs: [], outputs: [] }, identity: [], sysex: false, usb: null, os: null, redact: [],
    usbPick: new Set(), usbChoice: new Map(), usbReason: '', nameTouched: false, capture: null, capturing: null, lights: { tested: false, result: '', colours: [] }, keys: 'auto',
    about: { name: '', goals: [], works: [], doesNotWork: [], note: '' }
  }
  const fake = !!ctx.fake
  const say = (id, text) => { const el = $(id); if (el) el.textContent = text }
  const ports = (kind) => { const m = ctx.getMidi(); return m ? [...(kind === 'in' ? m.inputs : m.outputs).values()] : [] }
  const portRow = (p) => ({ id: p.id, name: p.name, manufacturer: p.manufacturer, state: p.state, connection: p.connection })

  /* ----- step 1: detect ----- */
  const detectRun = { id: 0, listeners: [], wake: null }
  function cancelDetect() {
    detectRun.id++
    for (const [port, fn] of detectRun.listeners) { try { port.removeEventListener('midimessage', fn) } catch (_e) {} }
    detectRun.listeners = []
    if (detectRun.wake) detectRun.wake()
    if (st.busy) { st.busy = false; $('dsDetectBtn').disabled = false }
  }
  async function detect() {
    if (st.busy) return
    const run = ++detectRun.id
    const alive = () => run === detectRun.id
    st.busy = true
    $('dsDetectBtn').disabled = true
    say('dsDetectState', 'Looking…')
    const midi = ctx.getMidi()
    st.ports = { inputs: ports('in').map(portRow), outputs: ports('out').map(portRow) }
    st.sysex = !!(midi && midi.sysexEnabled)
    st.identity = []
    paintDetect()
    if (midi && st.sysex) {
      const heard = new Map()
      for (const input of ports('in')) {
        const fn = (ev) => { const r = parseIdentityReply(ev.data); if (r) heard.set(input.id + '|' + r.manufacturerId + r.family + r.model + r.versionBytes, { port: input.name, ...r }) }
        detectRun.listeners.push([input, fn])          // recorded before anything is awaited
        try { input.addEventListener('midimessage', fn); if (input.open) await input.open() } catch (_e) { try { input.removeEventListener('midimessage', fn) } catch (_e2) {} }
        if (!alive()) return
      }
      for (const output of ports('out')) { try { if (output.open) await output.open(); if (!alive()) return; output.send(INQUIRY) } catch (_e) {} }
      await new Promise((resolve) => { const t = setTimeout(resolve, fake ? 200 : IDENTITY_MS); detectRun.wake = () => { clearTimeout(t); resolve() } })
      detectRun.wake = null
      if (!alive()) return
      for (const [port, fn] of detectRun.listeners) { try { port.removeEventListener('midimessage', fn) } catch (_e) {} }
      detectRun.listeners = []
      st.identity = [...heard.values()]
    }
    try {
      const probe = ctx.usbProbe ? await ctx.usbProbe() : null
      if (probe && probe.ok) {
        st.usb = probe; st.usbReason = ''; st.os = probe.os; st.redact = probe.redact || []
        // A device keeps the choice the person made for it, also when they ticked nothing at all; only a device
        // seen for the first time gets the default.
        const defaults = defaultUsbPicks(probe.devices, st.ports.inputs.concat(st.ports.outputs))
        probe.devices.forEach((d, i) => { if (!st.usbChoice.has(usbKey(d))) st.usbChoice.set(usbKey(d), defaults[i]) })
        st.usbPick = new Set(probe.devices.slice(0, USB_MAX).map((d, i) => i).filter((i) => st.usbChoice.get(usbKey(probe.devices[i]))))
      } else { st.usb = null; st.usbPick = new Set(); st.usbReason = probe && probe.reason ? String(probe.reason) : ''; if (probe && probe.os) { st.os = probe.os; st.redact = probe.redact || [] } }
    } catch (_e) { st.usb = null; st.usbPick = new Set() }
    if (!alive()) return
    if (!st.nameTouched && !$('dsName').value) {
      $('dsName').value = sanitizeText(guessDeviceName(st.ports.inputs, st.identity), NAME_MAX, { redact: st.redact })
      if ($('dsNameHint')) $('dsNameHint').hidden = !$('dsName').value
    }
    st.detected = true
    st.busy = false
    $('dsDetectBtn').disabled = false
    $('dsDetectBtn').textContent = 'Look again'
    paintDetect()
  }
  const usbKey = (d) => [d.vendorId, d.productId, d.product].join('|')
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e }
  function portCard(p, kind) {
    const card = el('li', 'ds-port')
    const top = el('div', 'ds-port-top')
    top.append(el('strong', '', p.name || 'Unnamed port'), el('span', 'ds-pill' + (p.state === 'connected' ? ' on' : ''), p.state || 'unknown'))
    card.append(top, el('span', 'ds-port-meta', `${kind} · ${p.manufacturer || 'maker not reported'} · id ${idHash(p.id)} · ${p.connection || 'unknown'}`))
    return card
  }
  function paintDetect() {
    const list = $('dsPorts')
    list.replaceChildren(...st.ports.inputs.map((p) => portCard(p, 'input')), ...st.ports.outputs.map((p) => portCard(p, 'output')))
    $('dsNoPorts').hidden = st.ports.inputs.length + st.ports.outputs.length > 0
    const id = $('dsIdentity')
    id.replaceChildren()
    if (!st.sysex) id.append(el('p', 'ds-muted', 'Your keyboard was not asked for its identity: system exclusive messages are not allowed here.'))
    else if (!st.identity.length) id.append(el('p', 'ds-muted', st.detected ? 'No identity reply. Many keyboards do not send one, and that is fine.' : 'Asking each port who it is…'))
    for (const r of st.identity) {
      const row = el('div', 'ds-ident')
      row.append(el('strong', '', r.port || 'Port'), el('span', '', `Maker code ${r.manufacturerId} · family ${r.family} · model ${r.model} · firmware ${r.version}`))
      id.append(row)
    }
    const usb = $('dsUsb')
    usb.replaceChildren()
    if (!st.detected) return
    const where = ctx.platform === 'Android' ? 'this device' : 'this computer'
    if (!st.usb) usb.append(el('p', 'ds-muted', 'USB details: not available on ' + where + '.'))
    else if (!st.usb.devices.length) usb.append(el('p', 'ds-muted', 'No USB devices were listed besides hubs. A Bluetooth keyboard will not appear here.'))
    else {
      usb.append(el('p', 'ds-muted', 'USB devices found. Tick the ones that belong to your keyboard or its accessories. Only ticked devices go into the report; unticked ones stay on this computer. Unticking a USB device removes its USB line only. The names of your MIDI ports are part of the report: you will see them on the Review step before anything is shared.'))
      const list = el('div', 'ds-usb-list')
      st.usb.devices.slice(0, USB_MAX).forEach((u, i) => {
        const label = el('label', 'ds-check ds-usb')
        const box = el('input'); box.type = 'checkbox'; box.checked = st.usbPick.has(i)
        box.onchange = () => { if (box.checked) st.usbPick.add(i); else st.usbPick.delete(i); st.usbChoice.set(usbKey(u), box.checked) }
        const text = el('span', 'ds-usb-text')
        text.append(el('strong', '', u.product || 'USB device'), el('span', 'ds-muted', `${u.manufacturer || 'maker not reported'} · ${String(u.vendorId).slice(2)}:${String(u.productId).slice(2)}`))
        label.append(box, text)
        list.append(label)
      })
      usb.append(list)
      if (st.usb.devices.length > USB_MAX) usb.append(el('p', 'ds-muted', `Showing the first ${USB_MAX} of ${st.usb.devices.length} USB devices.`))
    }
    say('dsDetectState', `${st.ports.inputs.length} input${st.ports.inputs.length === 1 ? '' : 's'}, ${st.ports.outputs.length} output${st.ports.outputs.length === 1 ? '' : 's'}`)
  }

  /* ----- step 2: test ----- */
  const capture = { cap: null, timer: null, tick: null }
  // a port the app has not bound is listened to directly; a bound one reaches feed() from the app's handler
  const bound = () => (ctx.boundInputs ? ctx.boundInputs() : [])
  let direct = [], captureRun = 0
  function stopCapture(done = true) {
    captureRun++                                  // an unfinished start() sees this and does nothing more
    clearTimeout(capture.timer); clearInterval(capture.tick)
    for (const [port, fn] of direct) { try { port.removeEventListener('midimessage', fn) } catch (_e) {} }
    direct = []
    if (!st.capturing) return
    st.capturing = null
    $('dsCaptureBtn').textContent = done ? 'Run it again' : 'Start'
    $('dsCaptureBar').style.setProperty('--p', '0')
    say('dsCaptureLive', '')
    if (done) st.capture = capture.cap
    paintCapture()
  }
  // portId: which input the message came from (counted per input as well as in the total)
  function feed(data, portId) { if (st.capturing && capture.cap) { captureFeed(capture.cap, data, portId); paintLive() } }
  async function startCapture() {
    if (st.capturing) { stopCapture(true); return }
    capture.cap = newCapture()
    st.capturing = true
    const run = ++captureRun
    for (const input of ports('in')) {
      // Every input is listened to, and the binding is read when a message arrives: one the app has
      // bound reaches feed() through the app already, so counting it here too would double it, and one
      // it unbinds mid-test would otherwise be lost.
      const fn = (ev) => { if (!bound().some((p) => p && p.id === input.id)) feed(ev.data, input.id) }
      direct.push([input, fn])                    // recorded before anything is awaited, so any exit cleans it up
      try { input.addEventListener('midimessage', fn); if (input.open) await input.open() } catch (_e) { try { input.removeEventListener('midimessage', fn) } catch (_e2) {} }
      if (run !== captureRun) return
    }
    const started = performance.now()
    $('dsCaptureBtn').textContent = 'Stop'
    say('dsCaptureState', 'Press a few keys, move the wheels, use the pedal… (or just move a hand above a sensor)')
    capture.tick = setInterval(() => $('dsCaptureBar').style.setProperty('--p', String(Math.min(1, (performance.now() - started) / CAPTURE_MS))), 100)
    capture.timer = setTimeout(() => stopCapture(true), CAPTURE_MS)
    paintLive()
  }
  function paintLive() {
    const c = capture.cap
    say('dsCaptureLive', c ? `${c.noteOn} key presses, ${c.messages} messages so far` : '')
  }
  function paintCapture() {
    const s = captureSummary(st.capture)
    const box = $('dsCaptureResult')
    box.replaceChildren()
    if (!s) { say('dsCaptureState', 'Optional. Takes 10 seconds. Only counts and ranges are kept, never the notes you play.'); return }
    if (!s.messages) { say('dsCaptureState', 'Nothing arrived from any input. Is it switched on and chosen?'); return }
    say('dsCaptureState', 'Done. This is all that will be in the report:')
    const rows = [
      ['Key presses', `${s.noteOn} on, ${s.noteOff} off`], ['Lowest and highest key', s.lowestNote == null ? 'none' : `${s.lowestNote} to ${s.highestNote}`],
      ['Velocity', s.velocity ? `${s.velocity.min} to ${s.velocity.max}` : 'none'], ['Aftertouch or pressure', s.polyAftertouch || s.channelPressure ? [s.polyAftertouch && 'per key', s.channelPressure && 'whole keyboard'].filter(Boolean).join(' and ') : 'not seen'],
      ['Pitch bend and mod wheel', [s.pitchBend && 'pitch bend', s.modWheel && 'mod wheel'].filter(Boolean).join(' and ') || 'not seen'], ['Sustain pedal', s.sustainPedal ? 'seen' : 'not seen'],
      ['Other controls', s.otherControllers.map((x) => 'CC' + x.cc).join(', ') || 'none'], ['Channels', s.channels.join(', ') || 'none']
    ]
    for (const [k, v] of rows) { const r = el('div', 'ds-row'); r.append(el('span', '', k), el('strong', '', v)); box.append(r) }
    // one block per input: which port sent what
    const named = portSummaries(normalizeCapture(st.capture), st.ports.inputs)
    for (const p of named) {
      const blk = el('div', 'ds-port-stats')
      blk.append(el('strong', '', p.name || 'Input ' + p.id))
      if (!p.messages) { blk.append(el('span', 'ds-muted', 'nothing received')); box.append(blk); continue }
      const bits = [`${p.messages} messages`, p.noteOn ? `${p.noteOn} notes` : '', p.channelPressure ? 'pressure' : '', p.pitchBend ? 'pitch bend' : '', p.polyAftertouch ? 'per-key pressure' : '',
        p.controllers.length ? 'controls ' + p.controllers.map((x) => 'CC' + x.cc).join(', ') : '', p.channels.length ? 'channels ' + p.channels.join(', ') : '', p.mpeLike ? 'notes sounded together on separate channels' : p.noteChannels.length >= 3 ? 'notes arrived on channels ' + p.noteChannels.join(', ') : '']
      blk.append(el('span', 'ds-muted', bits.filter(Boolean).join(' · ')))
      box.append(blk)
    }
  }
  function lightsReady() { return !!(ctx.canTestLights && ctx.canTestLights()) }
  function paintLights() {
    const ready = lightsReady()
    $('dsLightsBtn').disabled = !ready
    say('dsLightsState', ready ? 'Optional. A light runs across the keys. Nothing new is sent to your keyboard: this is the same test as Test lights in Settings.' : 'Not available: Keylight has no way to light this keyboard yet, which is exactly what the report helps with.')
    $('dsLightsAsk').hidden = !st.lights.tested
    for (const r of document.querySelectorAll('input[name="dsLights"]')) r.checked = r.value === st.lights.result
    for (const c of document.querySelectorAll('input[name="dsColour"]')) c.checked = st.lights.colours.includes(c.value)
  }
  function runLights() { if (!lightsReady()) return; st.lights.tested = true; ctx.testLights(); paintLights(); const first = document.querySelector('input[name="dsLights"]'); if (first) first.focus() }
  function paintKeys() {
    const sel = $('dsKeys')
    sel.value = String(st.keys)
  }

  /* ----- step 3: about you ----- */
  function readAbout() {
    st.about.name = sanitizeText($('dsName').value, NAME_MAX, { redact: st.redact })
    st.about.goals = [...document.querySelectorAll('input[name="dsGoal"]:checked')].map((c) => c.value)
    st.about.works = [...document.querySelectorAll('input[name="dsWorks"]:checked')].map((c) => c.value)
    st.about.doesNotWork = [...document.querySelectorAll('input[name="dsNot"]:checked')].map((c) => c.value)
    st.about.note = $('dsNote').value
  }
  function paintCounters() {
    say('dsNoteCount', `${$('dsNote').value.length} / ${NOTE_MAX}`)
  }

  /* ----- steps 4 and 5: review and send ----- */
  // only the ticked USB devices go into the report; the others are counted, never named
  const usbForReport = () => (st.usb ? { ...st.usb, shown: Math.min(st.usb.devices.length, USB_MAX), devices: st.usb.devices.slice(0, USB_MAX).filter((d, i) => st.usbPick.has(i)) } : st.usbReason ? { ok: false, reason: st.usbReason } : null)
  const input = () => ({
    app: { version: ctx.version, platform: ctx.platform }, os: st.os || { platform: ctx.platform, release: '', arch: '' }, redact: st.redact,
    ports: st.ports, identity: st.identity, sysex: st.sysex, usb: usbForReport(), capture: st.capture,
    lights: { ...st.lights, route: ctx.lightRoute ? ctx.lightRoute() : '' }, keys: { chosen: st.keys, app: ctx.appKeys ? ctx.appKeys() : null },
    about: st.about, date: new Date().toISOString().slice(0, 10)
  })
  const preview = () => { readAbout(); return buildReport(input()) }
  function paintReview() {
    const text = preview()
    $('dsPreview').textContent = text
    const size = reportSize(text)
    say('dsSize', `${size.chars.toLocaleString()} characters, ${(size.bytes / 1024).toFixed(1)} KB`)
    return text
  }
  async function copyReport() {
    const text = preview()
    try { await ctx.copy(text); say('dsSendState', 'Copied. Paste it into the issue, or into a message to us.'); return true } catch (_e) { say('dsSendState', 'Could not copy. Use Save as file instead.'); return false }
  }
  function saveReport() {
    const text = preview()
    ;(ctx.download || downloadFile)(new Blob([text], { type: 'text/plain;charset=utf-8' }), `keylight-device-report-${new Date().toISOString().slice(0, 10)}.txt`)
    say('dsSendState', 'Save requested. Attach the file to the issue.')
  }
  function openIssue() {
    readAbout()
    const url = buildIssueUrl(input())
    ctx.openLink(url)
    say('dsSendState', 'The issue form opens in your browser with a short description. Paste or attach the report there.')
    return url
  }

  /* ----- navigation ----- */
  function go(n) {
    if (st.capturing) stopCapture(false)
    readAbout()
    st.step = Math.max(0, Math.min(STEPS.length - 1, n))
    const name = STEPS[st.step]
    for (const panel of dialog.querySelectorAll('[data-ds-panel]')) panel.hidden = panel.dataset.dsPanel !== name
    dialog.querySelectorAll('#dsSteps button').forEach((b, i) => { b.setAttribute('aria-current', i === st.step ? 'step' : 'false'); b.classList.toggle('done', i < st.step) })
    $('dsBack').hidden = st.step === 0
    $('dsNext').hidden = st.step === STEPS.length - 1
    $('dsNext').textContent = ['Next: tests', 'Next: about you', 'Next: review', 'Next: send', ''][st.step]
    if (name === 'test') { paintCapture(); paintLights(); paintKeys() }
    if (name === 'review') paintReview()
    $('dsHeading').focus({ preventScroll: true })
    const body = dialog.querySelector('.ds-body'); if (body) body.scrollTop = 0
  }
  function open(step = 0) {
    if (!dialog.open) dialog.showModal()
    go(step)
    if (!st.detected && !st.busy) detect()
  }
  dialog.addEventListener('keydown', (e) => e.stopPropagation())
  dialog.addEventListener('close', () => { cancelDetect(); if (st.capturing) stopCapture(false); if (ctx.cancelLights) ctx.cancelLights() })
  $('dsDetectBtn').onclick = detect
  $('dsBack').onclick = () => go(st.step - 1)
  $('dsNext').onclick = () => go(st.step + 1)
  dialog.querySelectorAll('#dsSteps button').forEach((b, i) => { b.onclick = () => go(i) })
  $('dsCaptureBtn').onclick = startCapture
  $('dsLightsBtn').onclick = runLights
  for (const r of document.querySelectorAll('input[name="dsLights"]')) r.onchange = () => { st.lights.result = r.value }
  for (const c of document.querySelectorAll('input[name="dsColour"]')) c.onchange = () => { st.lights.colours = [...document.querySelectorAll('input[name="dsColour"]:checked')].map((x) => x.value) }
  $('dsKeys').onchange = (e) => { st.keys = e.target.value === 'auto' ? 'auto' : Number(e.target.value) }
  $('dsName').oninput = () => { st.nameTouched = true; if ($('dsNameHint')) $('dsNameHint').hidden = true }
  $('dsNote').oninput = paintCounters
  $('dsCopy').onclick = copyReport
  $('dsSave').onclick = saveReport
  $('dsIssue').onclick = openIssue
  for (const b of document.querySelectorAll('[data-device-support]')) b.addEventListener('click', () => open(0))
  // choices that need building
  const fill = (id, name, values, cls) => { $(id).replaceChildren(...values.map((v) => { const l = el('label', cls || 'ds-check'); const i = el('input'); i.type = 'checkbox'; i.name = name; i.value = v; l.append(i, el('span', '', v)); return l })) }
  fill('dsGoals', 'dsGoal', GOALS); fill('dsWorks', 'dsWorks', FEATURES); fill('dsNot', 'dsNot', FEATURES)
  $('dsKeys').replaceChildren(...[['auto', 'Automatic'], ...COUNT_CHOICES.map((n) => [String(n), n + ' keys'])].map(([v, t]) => { const o = el('option', '', t); o.value = v; return o }))
  $('dsName').maxLength = NAME_MAX
  $('dsNote').maxLength = NOTE_MAX
  paintCounters()

  return { open, go, detect, cancelDetect, feed, preview, copyReport, saveReport, openIssue, state: () => st, usbForReport, startCapture, stopCapture, readAbout, runLights }
}
