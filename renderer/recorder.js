// Take recorder: the player's picture (the #stage canvas) and the app's own sound
// (after the volume and the limiter, audio.js recordingStream) recorded together into
// one video file, plus a JSON sidecar with what was played on the keyboard, so a
// phone video of your hands can be lined up with the take later (by its sound).
//
// Nothing here runs until a take starts: the canvas capture stream, the MediaRecorder
// and the audio tap are all made in startTake() and taken apart when the take ends.
//
// Files are saved without a dialog: the page downloads them from blob: URLs, and
// main.js saves downloads named keylight-take-YYYYMMDD-HHMMSS.(mp4|webm|json) from
// this page into Movies/Keylight (or LUMI_REC_DIR).
import { recordingStream, latencyInfo } from './audio.js'

// The first one this browser can record wins: H.264 + AAC in an mp4 plays everywhere
// (and is encoded in hardware: VP9 can't keep up with 60 fps here)
export const MIME_TYPES = [
  'video/mp4;codecs=avc1.640033,mp4a.40.2',
  'video/mp4;codecs=avc1,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm'
]
// what main.js saves (keep in step with TAKE_FILE there)
export const TAKE_NAME = /^keylight-take-\d{8}-\d{6}\.(mp4|webm|json)$/
export const FPS = 60
export const VIDEO_BPS = 16e6
export const AUDIO_BPS = 256e3
export const MAX_TAKE_MS = 15 * 60 * 1000   // a forgotten take stops by itself
const MAX_MIDI = 100000

export function pickMimeType(supported = (t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t), formats = MIME_TYPES) {
  return formats.find((t) => { try { return supported(t) } catch (_e) { return false } }) || ''
}
export const extensionFor = (mimeType) => (/^video\/mp4/.test(mimeType) ? 'mp4' : 'webm')

const pad = (n) => String(n).padStart(2, '0')
// keylight-take-YYYYMMDD-HHMMSS, in local time
export function takeStem(d = new Date()) {
  return `keylight-take-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

// The app's version, from the user agent Electron builds (".. Keylight/0.2.0 Chrome/..")
function appVersions() {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || ''
  const app = ua.match(/\b(?:Keylight|lumi-app)\/(\d[\w.-]*)/i)
  const electron = ua.match(/\bElectron\/(\d[\w.-]*)/)
  return { version: app ? app[1] : '', electron: electron ? electron[1] : '' }
}

let take = null
let lastStem = ''
const listeners = new Set()
// fn(state) on every start and stop: state is null, or { stem, startedPerf, stopping,
// reason } (reason: why it is stopping, 'time limit' when it ran out of time)
export function onTakeChange(fn) { listeners.add(fn); return () => listeners.delete(fn) }
function emit() {
  const state = take ? { stem: take.stem, startedPerf: take.t0, stopping: !!take.stopping, reason: take.stopReason } : null
  for (const fn of listeners) { try { fn(state) } catch (_e) {} }
}

export const isRecording = () => !!take && !take.stopping
export const takeBusy = () => !!take        // recording, or still saving the last take
export const takeElapsed = () => (take ? (performance.now() - take.t0) / 1000 : 0)
// The page calls this right after it draws a frame of the recorded canvas: the first
// one after the start is the first frame of the file (see the sync note above).
export function takeFrameDrawn() {
  if (take && take.firstFrameMs === null) take.firstFrameMs = performance.now() - take.t0
}

// Start recording `canvas` and the app's sound. meta goes into the sidecar as it is
// (song, mode, rate, hands, view, kind, ...). save: false keeps the files in memory
// (the self-test), handed back by stopTake() and onStop(result), however the take
// ends. Returns the take's file stem, or '' when a take is already running or this
// browser cannot record.
export function startTake({ canvas, meta = {}, save = true, maxMs = MAX_TAKE_MS, log = console.log, formats = MIME_TYPES, onStop = null } = {}) {
  if (take) return ''
  const mimeType = pickMimeType(undefined, formats)
  if (!mimeType || !canvas || !canvas.captureStream) { log('TAKE cannot record here (no supported format)'); return '' }
  const started = new Date()
  // two takes in the same second would share a name: the later one takes the next free second
  let stem = takeStem(started)
  for (let s = 1; stem <= lastStem; s++) stem = takeStem(new Date(started.getTime() + s * 1000))
  lastStem = stem
  let video = null, audio = null, recorder = null
  try {
    video = canvas.captureStream(FPS)
    audio = recordingStream()
    const stream = new MediaStream([...video.getVideoTracks(), ...audio.stream.getAudioTracks()])
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: VIDEO_BPS, audioBitsPerSecond: AUDIO_BPS })
  } catch (e) {
    if (video) for (const t of video.getTracks()) t.stop()
    if (audio) audio.release()
    log('TAKE could not start: ' + (e && e.message))
    return ''
  }
  const lat = latencyInfo()
  const t = {
    stem, mimeType, recorder, video, audio, save, log,
    chunks: [], midi: [], midiDropped: 0,
    t0: performance.now(), firstFrameMs: null, startEventMs: null, started,
    width: canvas.width, height: canvas.height,
    outputLatencyMs: Math.round((lat.base + lat.output) * 10000) / 10,
    sampleRate: audio.sampleRate,
    meta, onStop, stopping: null, stopReason: '', timer: 0, error: ''
  }
  recorder.ondataavailable = (e) => { if (e.data && e.data.size) t.chunks.push(e.data) }
  recorder.onstart = () => { t.startEventMs = Math.round((performance.now() - t.t0) * 10) / 10 }
  recorder.onerror = (e) => { t.error = (e && e.error && e.error.message) || 'recorder error'; log('TAKE recorder error: ' + t.error); stopTake('error') }
  // a slice a second keeps the file growing in pieces instead of one block at the end
  recorder.start(1000)
  t.timer = setTimeout(() => stopTake('time limit'), maxMs)
  take = t
  log(`TAKE start ${stem} ${mimeType} ${t.width}x${t.height} outputLatency=${t.outputLatencyMs}ms rate=${t.sampleRate}`)
  emit()
  return stem
}

// What the player played on the keyboard, timed from the start of the take:
// logMidi('on', pitch, velocity), logMidi('off', pitch), logMidi('cc', controller, value)
export function logMidi(type, a, b, channel) {
  if (!take || take.stopping) return
  if (take.midi.length >= MAX_MIDI) { take.midiDropped++; return }
  const e = { t: performance.now() - take.t0, type }
  if (type === 'on') { e.pitch = a; e.velocity = b }
  else if (type === 'off') e.pitch = a
  else if (type === 'cc') { e.cc = a; e.value = b }
  if (channel) e.channel = channel
  take.midi.push(e)
}

/* ---------- lining the sound up with the picture ----------
   Chrome's recorder starts each track of the file at its own first sample: the picture
   at the first frame drawn after the take started, the sound at its first sample plus
   the AAC encoder's start-up delay (2112 samples of "priming"). In the raw file the
   sound is therefore late against the picture, by AUDIO_PIPELINE_MS plus the time to
   that first frame (0-17 ms, different every take). Both are measured: the picture
   with a draw-time barcode stamped into frames, the sound with the count-in click
   (Electron 45 / Chromium 142 on macOS, 128-frame output buffer).
   The saved mp4 is lined up so the sound sits where the speakers played it against the
   picture: a sound made at draw time T is in the file at the frame drawn at T plus the
   output latency (buffer + device), as it was heard while the picture showed. The
   player draws the song's notes that late too, so a song's notes and their sound line
   up; a key you press lights at once and its sound follows by the output latency.
   This is done with an edit list on the sound track (moov/trak/edts/elst), which
   ffmpeg and AVFoundation (QuickTime, iMovie, Photos, Final Cut) read alike: skip the
   priming and the lateness at the start of the sound, and when the lateness is less
   than the priming, start the sound that much after the first frame instead. (A
   fragment's start time, tfdt, is no good for this: ffmpeg uses it, AVFoundation
   ignores it. And AVFoundation always skips at least the priming of an AAC track.)
   The picture starts at 0 and the media itself is not touched. */
export const AUDIO_PIPELINE_MS = { 48000: 45.4, 44100: 52.2 }
export const AAC_PRIMING = 2112
const pipelineMs = (rate) => AUDIO_PIPELINE_MS[rate] ?? AUDIO_PIPELINE_MS[48000]

// How late the sound is against the picture in the raw file, in ms (negative: early)
export function soundLateMs({ sampleRate, firstFrameMs, outputLatencyMs }) {
  return pipelineMs(sampleRate) + (firstFrameMs || 0) - (outputLatencyMs || 0)
}

// The sound track's edit for that: skip `skip` units of its timescale (samples) at its
// start, never less than the priming, and start it `delay` units of the movie's
// timescale after the picture when that is not enough to skip.
export function audioEdit(lateMs, timescale, movieTimescale = 1000, priming = AAC_PRIMING) {
  const primingMs = (priming * 1000) / timescale
  const delay = Math.max(0, Math.ceil(((primingMs - lateMs) * movieTimescale) / 1000 - 1e-6))
  const delayMs = (delay * 1000) / movieTimescale
  return { delay, delayMs, skip: Math.max(priming, Math.round(((lateMs + delayMs) * timescale) / 1000)) }
}

// The older way, for a file that can't take the edit list: move the early track's
// fragments later (ms, >= 0). Right in ffmpeg only.
export function syncShift(lateMs) {
  return { videoMs: Math.max(0, lateMs), audioMs: Math.max(0, -lateMs) }
}

/* ---------- fragmented mp4 ----------
   Chrome writes ftyp, moov, then a moof + mdat pair per slice. Each moof's traf holds,
   per track, the fragment's start (tfdt) and each sample's duration (trun), in that
   track's timescale (moov/trak/mdia/mdhd). Only the small boxes are read; the mdat
   payloads stay slices of the original blob, so even a long take is not copied.
   Throws on anything unexpected.
   Chrome's fragments don't add up: the last frame of each fragment gets a made-up
   33.3 ms where the next fragment starts about 16.7 ms later, and the sound's
   durations are mostly rounded down (1023 of an AAC frame's 1024 samples). ffmpeg places each
   fragment at its tfdt and never notices; AVFoundation adds up the durations, and in
   QuickTime the picture fell behind the sound by about 7 ms a second. So every
   fragment's durations are made to add up to where the next one starts (the sound's
   frames all equal), and the media durations Chrome writes into the moov's mdhd (the
   first fragment's ms, in the track's own timescale) are cleared: AVFoundation adds
   them to the fragments as a phantom 37-59 ms at the end. */
async function boxAt(blob, off) {
  const dv = new DataView(await blob.slice(off, off + 16).arrayBuffer())
  if (dv.byteLength < 8) return null
  let size = dv.getUint32(0)
  const type = String.fromCharCode(dv.getUint8(4), dv.getUint8(5), dv.getUint8(6), dv.getUint8(7))
  let header = 8
  if (size === 1) { size = Number(dv.getBigUint64(8)); header = 16 } else if (size === 0) size = blob.size - off
  if (size < header || off + size > blob.size) throw new Error('bad box ' + type + ' at ' + off)
  return { type, size, header }
}
const typeAt = (dv, at) => String.fromCharCode(dv.getUint8(at), dv.getUint8(at + 1), dv.getUint8(at + 2), dv.getUint8(at + 3))
function children(dv, from, to) {
  const out = []
  for (let off = from; off + 8 <= to;) {
    const size = dv.getUint32(off)
    const type = typeAt(dv, off + 4)
    if (size < 8 || off + size > to) throw new Error('bad box ' + type)
    out.push({ type, off, size })
    off += size
  }
  return out
}
// a full box's field: version 1 boxes have 64-bit times, version 0 32-bit ones
const v1 = (dv, box) => dv.getUint8(box.off + 8) === 1

// The picture's real size, from the H.264 sequence parameter set in the avcC box (the
// encoder drops an odd row or column of the canvas). null when it can't be read.
function spsSize(dv, avcC) {
  try {
    const p = avcC.off + 8
    if ((dv.getUint8(p + 5) & 0x1f) < 1) return null
    const nal = new Uint8Array(dv.buffer, dv.byteOffset + p + 8, dv.getUint16(p + 6))
    const rbsp = []
    for (let i = 1, zeros = 0; i < nal.length; i++) {   // after the NAL header; drop emulation-prevention bytes
      if (zeros >= 2 && nal[i] === 3) { zeros = 0; continue }
      zeros = nal[i] === 0 ? zeros + 1 : 0
      rbsp.push(nal[i])
    }
    let bit = 0
    const u = (n) => {
      let v = 0
      for (let k = 0; k < n; k++, bit++) {
        if ((bit >> 3) >= rbsp.length) throw new Error('short sps')
        v = v * 2 + ((rbsp[bit >> 3] >> (7 - (bit & 7))) & 1)
      }
      return v
    }
    const ue = () => { let z = 0; while (u(1) === 0) if (++z > 31) throw new Error('bad sps'); return 2 ** z - 1 + u(z) }
    const se = () => { const k = ue(); return k & 1 ? (k + 1) / 2 : -k / 2 }
    const profile = u(8)
    u(16); ue()                                   // constraint flags, level, sps id
    let chroma = 1
    if ([100, 110, 122, 244, 44, 83, 86, 118, 128, 138, 139, 134, 135].includes(profile)) {
      chroma = ue()
      if (chroma === 3) u(1)
      ue(); ue(); u(1)                            // bit depths, qpprime bypass
      if (u(1)) {
        for (let i = 0; i < (chroma === 3 ? 12 : 8); i++) {
          if (!u(1)) continue
          for (let j = 0, last = 8, next = 8; j < (i < 6 ? 16 : 64); j++) {
            if (next !== 0) next = (last + se() + 256) % 256
            last = next === 0 ? last : next
          }
        }
      }
    }
    ue()                                          // log2 max frame num
    const poc = ue()
    if (poc === 0) ue()
    else if (poc === 1) { u(1); se(); se(); for (let i = ue(); i > 0; i--) se() }
    ue(); u(1)                                    // reference frames, gaps allowed
    const wMbs = ue() + 1, hMap = ue() + 1, frameMbsOnly = u(1)
    if (!frameMbsOnly) u(1)
    u(1)
    let l = 0, r = 0, t = 0, b = 0
    if (u(1)) { l = ue(); r = ue(); t = ue(); b = ue() }
    const cx = chroma === 1 || chroma === 2 ? 2 : 1, cy = (chroma === 1 ? 2 : 1) * (2 - frameMbsOnly)
    const width = wMbs * 16 - (l + r) * cx, height = (2 - frameMbsOnly) * hMap * 16 - (t + b) * cy
    return width > 0 && height > 0 ? { width, height } : null
  } catch (_e) { return null }
}
function avcCof(dv, minf) {
  try {
    const stbl = children(dv, minf.off + 8, minf.off + minf.size).find((b) => b.type === 'stbl')
    const stsd = stbl && children(dv, stbl.off + 8, stbl.off + stbl.size).find((b) => b.type === 'stsd')
    if (!stsd) return null
    const entry = children(dv, stsd.off + 16, stsd.off + stsd.size)[0]
    if (!entry || !/^avc[13]$/.test(entry.type)) return null
    return children(dv, entry.off + 86, entry.off + entry.size).find((b) => b.type === 'avcC') || null
  } catch (_e) { return null }
}

function readMoov(buf) {
  const dv = new DataView(buf)
  const kids = children(dv, 8, dv.byteLength)
  const mvhd = kids.find((b) => b.type === 'mvhd')
  const movieTimescale = mvhd ? dv.getUint32(mvhd.off + (v1(dv, mvhd) ? 28 : 20)) : 0
  const tracks = new Map()   // track id -> { id, kind: 'vide' | 'soun', timescale, trak, tkhdEnd, mdhd, elst, size }
  for (const trak of kids.filter((b) => b.type === 'trak')) {
    const tr = { id: 0, kind: '', timescale: 0, trak, tkhdEnd: 0, mdhd: null, elst: null, size: null }
    for (const b of children(dv, trak.off + 8, trak.off + trak.size)) {
      if (b.type === 'tkhd') { tr.id = dv.getUint32(b.off + (v1(dv, b) ? 28 : 20)); tr.tkhdEnd = b.off + b.size }
      if (b.type === 'edts') {
        const elst = children(dv, b.off + 8, b.off + b.size).find((e) => e.type === 'elst')
        tr.elst = []
        if (elst) {
          const big = v1(dv, elst), n = dv.getUint32(elst.off + 12)
          for (let i = 0, p = elst.off + 16; i < n && p + (big ? 20 : 12) <= elst.off + elst.size; i++, p += big ? 20 : 12) {
            tr.elst.push(big ? [Number(dv.getBigUint64(p)), Number(dv.getBigInt64(p + 8))] : [dv.getUint32(p), dv.getInt32(p + 4)])
          }
        }
      }
      if (b.type !== 'mdia') continue
      for (const m of children(dv, b.off + 8, b.off + b.size)) {
        if (m.type === 'mdhd') { tr.mdhd = m; tr.timescale = dv.getUint32(m.off + (v1(dv, m) ? 28 : 20)) }
        if (m.type === 'hdlr') tr.kind = typeAt(dv, m.off + 16)
        if (m.type === 'minf') { const avcC = avcCof(dv, m); if (avcC) tr.size = spsSize(dv, avcC) }
      }
    }
    if (tr.id && tr.timescale) tracks.set(tr.id, tr)
  }
  return { tracks, movieTimescale }
}
const mdhdDuration = (dv, m) => (v1(dv, m) ? Number(dv.getBigUint64(m.off + 32)) : dv.getUint32(m.off + 24))
function clearMdhdDuration(dv, m) { if (v1(dv, m)) dv.setBigUint64(m.off + 32, 0n); else dv.setUint32(m.off + 24, 0) }

// Each track fragment: { tr, dv, tfdt (offset), durs (offsets of its sample durations, or
// null when the trun leaves them to the defaults) }
function readMoof(buf, tracks, out) {
  const dv = new DataView(buf)
  for (const traf of children(dv, 8, dv.byteLength).filter((b) => b.type === 'traf')) {
    const kids = children(dv, traf.off + 8, traf.off + traf.size)
    const tfhd = kids.find((b) => b.type === 'tfhd'), tfdt = kids.find((b) => b.type === 'tfdt')
    if (!tfhd || !tfdt) throw new Error('traf without tfhd/tfdt')
    const tr = tracks.get(dv.getUint32(tfhd.off + 12))
    if (!tr) continue
    let durs = []
    for (const run of kids.filter((b) => b.type === 'trun')) {
      const flags = dv.getUint32(run.off + 8) & 0xffffff, n = dv.getUint32(run.off + 12)
      let p = run.off + 16 + (flags & 1 ? 4 : 0) + (flags & 4 ? 4 : 0)
      const per = 4 * [0x100, 0x200, 0x400, 0x800].filter((f) => flags & f).length
      if (!(flags & 0x100) || p + n * per > run.off + run.size) { durs = null; break }
      for (let i = 0; i < n; i++, p += per) durs.push(p)
    }
    out.push({ tr, dv, tfdt: tfdt.off, durs })
  }
}

async function readMp4(blob) {
  const parts = [], trafs = []
  let moov = null, fragments = 0
  for (let off = 0; off < blob.size;) {
    const box = await boxAt(blob, off)
    if (!box) throw new Error('truncated at ' + off)
    if (box.type === 'moov' || box.type === 'moof') {
      if (box.header !== 8) throw new Error('large ' + box.type)
      const buf = await blob.slice(off, off + box.size).arrayBuffer()
      if (box.type === 'moov') moov = { buf, part: parts.length, ...readMoov(buf) }
      else {
        if (!moov) throw new Error('moof before moov')
        readMoof(buf, moov.tracks, trafs)
        fragments++
      }
      parts.push(buf)
    } else {
      parts.push(blob.slice(off, off + box.size))
    }
    off += box.size
  }
  if (!moov || !fragments) throw new Error('not a fragmented mp4')
  const track = (kind) => {
    const tr = [...moov.tracks.values()].find((t) => t.kind === kind)
    return tr ? { tr, list: trafs.filter((f) => f.tr === tr) } : null
  }
  return { parts, moov, fragments, video: track('vide'), audio: track('soun') }
}

const tfdtGet = (dv, at) => (dv.getUint8(at + 8) === 1 ? Number(dv.getBigUint64(at + 12)) : dv.getUint32(at + 12))
function tfdtAdd(dv, at, add) {
  if (dv.getUint8(at + 8) === 1) dv.setBigUint64(at + 12, dv.getBigUint64(at + 12) + BigInt(add))
  else dv.setUint32(at + 12, dv.getUint32(at + 12) + add)
}
const durationsOf = (f) => f.durs.map((at) => f.dv.getUint32(at))
const median = (a) => [...a].sort((x, y) => x - y)[a.length >> 1]

// How far each fragment's durations are from where the next fragment starts, in all
// (ms: + when they add up to more)
function fragmentDrift({ tr, list }) {
  let off = 0
  for (let i = 0; i + 1 < list.length; i++) {
    if (!list[i].durs) continue
    off += durationsOf(list[i]).reduce((a, b) => a + b, 0) - (tfdtGet(list[i + 1].dv, list[i + 1].tfdt) - tfdtGet(list[i].dv, list[i].tfdt))
  }
  return Math.round((off * 1e4) / tr.timescale) / 10
}

// Make every fragment's sample durations add up to the start of the next fragment. The
// sound has no gaps inside a fragment, so its frames are made equal; the picture's
// frames keep their own durations but the last one, which gets the rest. The last
// fragment has no next one: its last frame is made as long as its others (the sound:
// all of them as long as the frames before).
function fixDurations({ tr, list }) {
  let fixed = 0, frame = 0
  for (let i = 0; i < list.length; i++) {
    const f = list[i]
    if (!f.durs || !f.durs.length) continue
    const durs = durationsOf(f), n = durs.length
    const others = durs.slice(0, -1), sumOthers = others.reduce((a, b) => a + b, 0)
    const next = list[i + 1]
    let gap
    if (next) gap = tfdtGet(next.dv, next.tfdt) - tfdtGet(f.dv, f.tfdt)
    else if (tr.kind === 'soun') {
      // an AAC frame is 1024 samples (the sound's timescale is its sample rate)
      const nominal = frame || (n > 1 && Math.abs(median(others) - 1024) <= 2 ? 1024 : 0)
      gap = nominal ? n * nominal : sumOthers + (n > 1 ? median(others) : durs[0])
    } else gap = sumOthers + (n > 1 ? median(others) : durs[0])
    if (!(gap > 0)) continue
    const even = Math.round(gap / n), tol = Math.max(2, even / 100)
    if (tr.kind === 'soun' && others.every((d) => Math.abs(d - even) <= tol) && Math.abs(gap - even * (n - 1) - even) <= tol) {
      for (let k = 0; k < n - 1; k++) f.dv.setUint32(f.durs[k], even)
      f.dv.setUint32(f.durs[n - 1], gap - even * (n - 1))
      frame = even
    } else {
      const last = gap - sumOthers
      if (last < 1) continue
      f.dv.setUint32(f.durs[n - 1], last)
    }
    fixed++
  }
  return fixed
}

function edtsBox(entries) {   // [[duration in the movie's timescale, media time or -1], ...]
  const size = 24 + 12 * entries.length
  const dv = new DataView(new ArrayBuffer(size))
  dv.setUint32(0, size); dv.setUint32(4, 0x65647473)          // 'edts'
  dv.setUint32(8, size - 8); dv.setUint32(12, 0x656c7374)     // 'elst', version 0
  dv.setUint32(20, entries.length)
  entries.forEach(([d, m], i) => { dv.setUint32(24 + 12 * i, d); dv.setInt32(28 + 12 * i, m); dv.setInt16(32 + 12 * i, 1) })
  return new Uint8Array(dv.buffer)
}

// Line a take's sound up with its picture (lateMs: how late the sound is in the raw
// file, soundLateMs) and make its fragments add up. Returns the new blob and what was done.
export async function fixMp4(blob, { lateMs = 0 } = {}) {
  const { parts, moov, fragments, video, audio } = await readMp4(blob)
  if (!video || !video.list.length) throw new Error('no picture track')
  const info = { fragments, size: video.tr.size, drift: {}, fixed: {} }
  for (const [name, track] of [['video', video], ['audio', audio]]) {
    if (!track) continue
    info.drift[name] = fragmentDrift(track)
    info.fixed[name] = fixDurations(track)
  }
  const mdv = new DataView(moov.buf)
  for (const tr of moov.tracks.values()) if (tr.mdhd) clearMdhdDuration(mdv, tr.mdhd)
  // both tracks start at 0 (as Chrome writes them): a start AVFoundation would ignore is
  // folded into the lateness
  const startMs = (t) => (t && t.list.length ? (tfdtGet(t.list[0].dv, t.list[0].tfdt) * 1000) / t.tr.timescale : 0)
  const late = lateMs - (startMs(audio) - startMs(video))
  for (const t of [video, audio]) {
    const first = t && t.list.length ? tfdtGet(t.list[0].dv, t.list[0].tfdt) : 0
    if (first) for (const f of t.list) tfdtAdd(f.dv, f.tfdt, -first)
  }
  const at = audio && audio.list.length && audio.tr.tkhdEnd && !audio.tr.elst && moov.movieTimescale ? audio : null
  if (at) {
    const { delay, delayMs, skip } = audioEdit(late, at.tr.timescale, moov.movieTimescale)
    const last = at.list[at.list.length - 1]
    const total = tfdtGet(last.dv, last.tfdt) + (last.durs ? durationsOf(last).reduce((a, b) => a + b, 0) : 0)
    const edts = edtsBox([...(delay ? [[delay, -1]] : []), [Math.max(1, Math.ceil(((total - skip) * moov.movieTimescale) / at.tr.timescale)), skip]])
    const src = new Uint8Array(moov.buf), out = new Uint8Array(src.length + edts.length)
    const cut = at.tr.tkhdEnd
    out.set(src.subarray(0, cut)); out.set(edts, cut); out.set(src.subarray(cut), cut + edts.length)
    const odv = new DataView(out.buffer)
    odv.setUint32(0, out.length)
    odv.setUint32(at.tr.trak.off, at.tr.trak.size + edts.length)
    parts[moov.part] = out.buffer
    Object.assign(info, { method: 'edit list', videoStartMs: 0, audioDelayMs: delayMs, audioSkip: skip })
  } else {
    // no sound track to edit (or it has an edit list already): move a track's fragments
    const shift = syncShift(late)
    for (const t of [video, audio]) {
      if (!t) continue
      const add = Math.round(((t === video ? shift.videoMs : shift.audioMs) * t.tr.timescale) / 1000)
      if (add) for (const f of t.list) tfdtAdd(f.dv, f.tfdt, add)
    }
    Object.assign(info, { method: 'tfdt', videoStartMs: shift.videoMs, videoShiftMs: shift.videoMs, audioShiftMs: shift.audioMs })
  }
  return { blob: new Blob(parts, { type: blob.type }), ...info }
}

// How a take's mp4 is laid out, for the self-test: per track, where its first fragment
// starts (ms), its edit list (delay ms, samples skipped), how far its durations are
// from the fragment starts (ms) and the moov's media duration; the picture's size.
export async function mp4Timeline(blob) {
  const { moov, fragments, video, audio } = await readMp4(blob)
  const mdv = new DataView(moov.buf)
  const out = { fragments }
  for (const [name, t] of [['video', video], ['audio', audio]]) {
    if (!t) continue
    const edits = t.tr.elst || []
    const empty = edits.filter(([, m]) => m === -1).reduce((a, [d]) => a + d, 0)
    const media = edits.find(([, m]) => m !== -1)
    out[name] = {
      startMs: t.list.length ? (tfdtGet(t.list[0].dv, t.list[0].tfdt) * 1000) / t.tr.timescale : null,
      delayMs: moov.movieTimescale ? (empty * 1000) / moov.movieTimescale : 0,
      skip: media ? media[1] : 0,
      driftMs: fragmentDrift(t),
      mdhd: t.tr.mdhd ? mdhdDuration(mdv, t.tr.mdhd) : null
    }
  }
  if (video) out.size = video.tr.size
  return out
}

function sidecar(t, durationSec, sync, midiOffsetMs, size) {
  const { song, kind, mode, rate, hands, view, trigger, ...more } = t.meta || {}
  const { version, electron } = appVersions()
  return {
    app: 'Keylight', version, electron,
    take: t.stem, file: t.stem + '.' + extensionFor(t.mimeType),
    song: song || null, kind: kind || null,
    mode: mode || null, rate: rate ?? null, hands: hands || null, view: view || null,
    ...more,
    trigger: trigger || null,
    startedAt: t.started.toISOString(), startedEpochMs: t.started.getTime(),
    durationSec: Math.round(durationSec * 1000) / 1000,
    stopReason: t.stopReason,
    // the picture's size in the file (H.264 drops an odd row or column of the canvas)
    fps: FPS, width: size.width, height: size.height, mimeType: t.mimeType,
    canvasWidth: t.width, canvasHeight: t.height,
    videoBitsPerSecond: VIDEO_BPS, audioBitsPerSecond: AUDIO_BPS,
    // base + output latency of the sound output when the take started
    outputLatencyMs: t.outputLatencyMs,
    audioSampleRate: t.sampleRate,
    // how the sound was lined up with the picture in this file (see recorder.js)
    sync,
    // t: seconds into the saved video, when the app got the message from the keyboard
    // (the key lights in the next frame; its sound follows by outputLatencyMs)
    midi: t.midi.map((e) => ({ ...e, t: Math.round(e.t + midiOffsetMs) / 1000 })),
    midiDropped: t.midiDropped || undefined,
    startEventMs: t.startEventMs,
    error: t.error || undefined
  }
}

function download(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  // the download reads the blob on its own; let go of it once that has surely finished
  setTimeout(() => URL.revokeObjectURL(url), Math.max(60000, blob.size / 20e3))
}

// Stop the take and save it. Resolves to { stem, video, json, blob, jsonBlob, sidecar, saved }
// (or null when nothing was recording); a second call while stopping gets the same promise.
export function stopTake(reason = 'stop') {
  if (!take) return Promise.resolve(null)
  if (take.stopping) return take.stopping
  const t = take
  clearTimeout(t.timer)
  t.stopReason = reason
  const durationSec = (performance.now() - t.t0) / 1000
  t.stopping = new Promise((resolve) => {
    const finish = () => save().catch((e) => {
      t.log('TAKE could not be saved: ' + (e && e.message))
      take = null
      emit()
      resolve(null)
    })
    const save = async () => {
      for (const tr of t.video.getTracks()) tr.stop()
      t.audio.release()
      let blob = new Blob(t.chunks, { type: t.mimeType.split(';')[0] })
      const mp4 = extensionFor(t.mimeType) === 'mp4'
      const lateMs = soundLateMs({ sampleRate: t.sampleRate, firstFrameMs: t.firstFrameMs, outputLatencyMs: t.outputLatencyMs })
      const r1 = (v) => Math.round(v * 10) / 10
      const sync = {
        applied: false, method: null,
        // how late the sound was against the picture in Chrome's recording
        lateMs: r1(lateMs),
        firstFrameMs: t.firstFrameMs === null ? null : r1(t.firstFrameMs),
        pipelineMs: pipelineMs(t.sampleRate), measuredRate: t.sampleRate in AUDIO_PIPELINE_MS
      }
      // H.264 drops an odd row or column; the file's own size replaces this when it can be read
      let size = mp4 ? { width: t.width & ~1, height: t.height & ~1 } : { width: t.width, height: t.height }
      let videoStartMs = 0
      if (blob.size && mp4) {
        try {
          const r = await fixMp4(blob, { lateMs })
          blob = r.blob
          videoStartMs = r.videoStartMs
          if (r.size) size = r.size
          Object.assign(sync, { applied: true, method: r.method })
          // the edit list: the sound starts audioDelayMs after the first frame, from its
          // audioSkipSamples-th sample (the encoder's priming and the lateness skipped)
          if (r.method === 'edit list') Object.assign(sync, { audioDelayMs: r1(r.audioDelayMs), audioSkipSamples: r.audioSkip, primingSamples: AAC_PRIMING })
          else Object.assign(sync, { videoShiftMs: r1(r.videoShiftMs), audioShiftMs: r1(r.audioShiftMs) })
          // how far Chrome's sample durations were from its fragment starts, in all (ms),
          // before they were made to agree
          Object.assign(sync, { fragments: r.fragments, durationsOffMs: r.drift, durationsFixed: r.fixed })
        } catch (e) { sync.error = e.message; t.log('TAKE could not line up the sound: ' + e.message) }
      }
      // keyboard times on the file's timeline: it starts at the first frame (moved later
      // by the shift when the fragments had to be moved instead)
      const midiOffsetMs = -(t.firstFrameMs || 0) + videoStartMs
      const info = sidecar(t, durationSec, sync, midiOffsetMs, size)
      const json = new Blob([JSON.stringify(info, null, 1)], { type: 'application/json' })
      const video = info.file, jsonName = t.stem + '.json'
      if (t.save && blob.size) { download(blob, video); download(json, jsonName) }
      t.log(`TAKE stop ${t.stem} reason=${reason} ${durationSec.toFixed(1)}s ${(blob.size / 1e6).toFixed(2)}MB midi=${t.midi.length} ` +
        `${size.width}x${size.height} firstFrame=${sync.firstFrameMs}ms late=${sync.lateMs}ms ` +
        (sync.method === 'edit list' ? `audioDelay=${sync.audioDelayMs}ms audioSkip=${sync.audioSkipSamples}` : `videoShift=${sync.videoShiftMs}ms audioShift=${sync.audioShiftMs}ms`) +
        (sync.applied ? ` durationsOff=${sync.durationsOffMs.video}/${sync.durationsOffMs.audio}ms` : ' (not lined up)') + `${t.save && blob.size ? ' saving' : ''}`)
      take = null
      emit()
      const result = { stem: t.stem, video, json: jsonName, blob, jsonBlob: json, sidecar: info, saved: !!(t.save && blob.size) }
      if (t.onStop) { try { t.onStop(result) } catch (_e) {} }
      resolve(result)
    }
    if (t.recorder.state === 'inactive') { finish(); return }
    t.recorder.onstop = finish
    try { t.recorder.stop() } catch (_e) { finish() }
  })
  emit()
  return t.stopping
}
