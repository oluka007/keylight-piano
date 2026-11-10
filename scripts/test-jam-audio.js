// Own hidden, muted Electron process; all sound is rendered by OfflineAudioContext.
const { mkdtempSync, rmSync, readFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const path = require('node:path')

async function checkJam() {
  const check = (ok, message) => { if (!ok) throw new Error(message) }
  const sr = 44100
  const offline = (seconds) => new OfflineAudioContext(2, Math.round(sr * seconds), sr)
  const rms = (data, from, until) => {
    const values = data.subarray(Math.round(from * sr), Math.round(until * sr))
    return Math.sqrt(values.reduce((sum, v) => sum + v * v, 0) / values.length)
  }
  const peak = (data) => data.reduce((m, v) => Math.max(m, Math.abs(v)), 0)
  const finite = (data) => data.every((v) => Number.isFinite(v))
  const { DRUMS, playDrum } = await import('/renderer/jam/drums.js')
  const { createFx, reverbImpulse } = await import('/renderer/jam/fx.js')

  // ----- drums -----
  check(DRUMS.length === 8, 'eight drums')
  const lengths = []
  for (let i = 0; i < 8; i++) {
    const c = offline(1.5)
    playDrum(c, c.destination, i, { when: 0.05, velocity: 127 })
    const data = (await c.startRendering()).getChannelData(0)
    const p = peak(data)
    check(finite(data), DRUMS[i].id + ' finite')
    check(rms(data, 0.05, 0.3) > 0.005, DRUMS[i].id + ' is not silent')
    check(p > 0.1 && p < 1, DRUMS[i].id + ' peaks under 1.0 (' + p + ')')
    check(rms(data, 0.9, 1.5) < 1e-5, DRUMS[i].id + ' ends')
    const soft = offline(1)
    playDrum(soft, soft.destination, i, { when: 0, velocity: 30 })
    const quiet = (await soft.startRendering()).getChannelData(0)
    check(peak(quiet) < p * 0.6, DRUMS[i].id + ' velocity scales level')
    lengths.push(p.toFixed(2))
  }
  {
    const open = offline(1), cut = offline(1)
    playDrum(open, open.destination, 3, { when: 0 })
    playDrum(cut, cut.destination, 3, { when: 0 })
    playDrum(cut, cut.destination, 2, { when: 0.1, velocity: 1 })
    const a = (await open.startRendering()).getChannelData(0), b = (await cut.startRendering()).getChannelData(0)
    check(rms(a, 0.2, 0.3) > 0.003, 'open hat rings')
    check(rms(b, 0.2, 0.3) < rms(a, 0.2, 0.3) * 0.1, 'closed hat cuts the open hat')
    check(rms(b, 0.02, 0.09) > 0.003, 'open hat sounds before it is cut')
  }

  // ----- effects -----
  const tailCtx = (build) => {
    const c = offline(4)
    const fx = createFx(c, c.destination)
    build(fx, c)
    return { c, fx }
  }
  {
    const { c } = tailCtx((fx) => { fx.setDelay({ beats: 0.5, bpm: 120, feedback: 0.5, mix: 1 }); fx.setReverb({ size: 0.5, mix: 1 }) })
    check(peak((await c.startRendering()).getChannelData(0)) === 0, 'silent input stays silent')
  }
  {
    const { c } = tailCtx((fx, ctx) => {
      fx.setDelay({ beats: 0.5, bpm: 120, feedback: 0.5, mix: 0 }); fx.setReverb({ size: 0.5, mix: 1 })
      const buffer = ctx.createBuffer(1, 1, sr); buffer.getChannelData(0)[0] = 1
      const src = new AudioBufferSourceNode(ctx, { buffer }); src.connect(fx.input); src.start(0.01)
    })
    const data = (await c.startRendering()).getChannelData(0)
    check(finite(data) && rms(data, 0.05, 0.4) > 1e-4, 'impulse leaves a reverb tail')
    check(rms(data, 1.0, 1.4) < rms(data, 0.05, 0.4) * 0.5, 'reverb tail decays')
    check(rms(data, 3.0, 4.0) < 1e-4, 'reverb tail ends')
  }
  {
    const first = reverbImpulse(sr, 0.5), second = reverbImpulse(sr, 0.5)
    check(first[0].every((v, i) => v === second[0][i]) && first[1].every((v, i) => v === second[1][i]), 'reverb impulse identical across builds')
    check(first[0].some((v, i) => v !== first[1][i]), 'reverb impulse is stereo')
    check(reverbImpulse(sr, 1)[0].length > reverbImpulse(sr, 0)[0].length, 'size sets the length')
  }
  {
    const { c } = tailCtx((fx, ctx) => {
      fx.setDelay({ beats: 0.1, bpm: 60, feedback: 5, mix: 1 }); fx.setReverb({ size: 0.5, mix: 0 })
      const buffer = ctx.createBuffer(1, 400, sr); buffer.getChannelData(0).fill(0.5)
      const src = new AudioBufferSourceNode(ctx, { buffer }); src.connect(fx.input); src.start(0.01)
    })
    const data = (await c.startRendering()).getChannelData(0)
    check(finite(data) && rms(data, 0.5, 1) > 1e-4, 'delay repeats')
    check(rms(data, 3, 3.5) < rms(data, 0.5, 1) * 0.1, 'delay with feedback 0.75 decays')
    check(peak(data) < 1, 'delay does not run away')
  }

  // ----- tracks -----
  window.AudioContext = class extends OfflineAudioContext {
    constructor() { super(2, sr * 18, sr) }
    resume() { return Promise.resolve() }
  }
  const audio = await import('/renderer/audio.js')
  const ac = audio.initAudio()
  const resume = () => OfflineAudioContext.prototype.resume.call(ac)
  const pauses = []
  const at = (t, fn) => pauses.push(ac.suspend(t).then(async () => { try { await fn() } finally { await resume() } }))
  const errors = []
  const guard = (fn) => () => { try { return fn() } catch (e) { errors.push(e); throw e } }
  let disconnects = 0
  const realDisconnect = AudioNode.prototype.disconnect
  AudioNode.prototype.disconnect = function (...args) { disconnects++; return realDisconnect.apply(this, args) }
  check(audio.jamVoiceCount() === 0, 'no jam voices at the start')
  check(audio.jamFx() === audio.jamFx(), 'one shared effects unit')

  const A = audio.createTrack({ instrument: 'lead' })
  const B = audio.createTrack({ instrument: 'bass' })
  let held = null
  at(0.1, guard(() => {
    held = [A.noteOn(72, 100), B.noteOn(36, 100)]
    check(audio.jamVoiceCount() === 2, 'two tracks sound at once')
    check(held[0].voice.id === 'lead' && held[1].voice.id === 'bass', 'each track keeps its instrument')
  }))
  at(0.5, guard(() => {
    check(audio.setInstrument('epiano'), 'global instrument changes')
    check(audio.jamVoiceCount() === 2 && !held[0].done && !held[1].done, 'global setInstrument leaves jam voices alone')
    audio.noteOn(60, 90); audio.stopAll()
    check(audio.jamVoiceCount() === 2, 'stopAll leaves jam voices alone')
    check(audio.activeVoiceCount() === 0, 'jam does not use the key voices')
  }))
  at(1.0, guard(() => {
    A.bend(held[0], 2); A.press(held[0], 0.5); A.slide(held[0], 0.2)
    A.noteOff(held[0], { lift: 127 }); B.noteOff(held[1], { lift: 0 })
    A.bend(held[0], 1); A.noteOff(held[0]); A.press(held[0], 1)
  }))
  // lift: a fast lift stops a long release sooner than a slow one
  const P = audio.createTrack({ instrument: 'pad' })
  let p1 = null, p2 = null
  at(2.0, guard(() => { p1 = P.noteOn(60, 100) }))
  at(2.5, guard(() => P.noteOff(p1, { lift: 127 })))
  at(4.0, guard(() => { p2 = P.noteOn(60, 100) }))
  at(4.5, guard(() => P.noteOff(p2, { lift: 0 })))
  // mute and silence
  let m = null
  at(5.6, guard(() => { m = A.noteOn(60, 100) }))
  at(5.8, guard(() => A.setMute(true)))
  at(6.4, guard(() => {
    A.setMute(false)
    check(audio.jamVoiceCount() >= 1 && !m.done, 'muting keeps the voice')
    A.silence()
    check(m.done, 'silence() ends the track voices at once')
    check(audio.jamVoiceCount() <= 2, 'silence() only touches its own track')
  }))
  // drums on a track
  const D = audio.createTrack({ kind: 'drums' })
  at(8.0, guard(() => D.hit(0, { velocity: 120 })))
  at(8.8, guard(() => { D.setMute(true) }))
  at(9.0, guard(() => { D.hit(0, { velocity: 120 }) }))
  // cap and stealing order
  const X = audio.createTrack({ instrument: 'lead' })
  let stolen = null
  at(9.5, guard(() => {
    for (const t of [A, B, P, X]) t.silence()
    check(audio.jamVoiceCount() === 0, 'everything silenced')
    const now = ac.currentTime
    const s1 = X.noteOn(60, 90, now + 1), s2 = X.noteOn(61, 90, now + 1.1)
    const live = []
    for (let i = 0; i < 30; i++) live.push(X.noteOn(40 + i, 90))
    check(audio.jamVoiceCount() === 32, 'cap fills to 32')
    live.push(X.noteOn(80, 90))
    check(audio.jamVoiceCount() === 32 && s1.done && !s2.done && live.every((h) => !h.done), 'oldest replayed note goes first')
    live.push(X.noteOn(81, 90))
    check(audio.jamVoiceCount() === 32 && s2.done && live.every((h) => !h.done), 'then the next replayed note')
    live.push(X.noteOn(82, 90))
    check(audio.jamVoiceCount() === 32 && live[0].done && !live[1].done, 'only then the oldest live note')
    X.silence()
    check(audio.jamVoiceCount() === 0, 'silence() empties the allocator')
  }))
  // leak: hundreds of notes, by every route
  at(10.0, guard(() => {
    const before = disconnects
    const tracks = [A, B, P, X]
    for (let i = 0; i < 300; i++) {
      const t = tracks[i % 4]
      const h = t.noteOn(36 + (i % 40), 80, i % 7 === 0 ? ac.currentTime + 0.01 * (i % 5) : null)
      if (h && i % 3 === 0) t.noteOff(h, { lift: i % 128 })
      if (i % 50 === 49) t.silence()
    }
    check(audio.jamVoiceCount() <= 32, 'voice count stays capped')
    for (const t of tracks) t.silence()
    check(audio.jamVoiceCount() === 0, 'silence() empties the allocator after a few hundred notes')
    for (let i = 0; i < 150; i++) { const h = A.noteOn(50 + (i % 30), 90); A.noteOff(h, { lift: 127 }) }
    check(audio.jamVoiceCount() <= 32, 'released notes are stolen first')
    for (let i = 0; i < 100; i++) D.hit(i % 8, { velocity: 60 })
    D.silence()
    ;(globalThis.__jam = { before })
  }))
  at(11.5, guard(() => {
    check(audio.jamVoiceCount() === 0, 'jam voice count returns to 0 (' + audio.jamVoiceCount() + ')')
    check(disconnects - globalThis.__jam.before >= 150, 'ended voices disconnect their nodes (' + (disconnects - globalThis.__jam.before) + ')')
    for (const t of [A, B, P, X, D]) t.dispose()
    check(A.noteOn(60, 90) === null && audio.jamVoiceCount() === 0, 'disposed track makes no sound')
  }))
  // Future noteOff marks synth Voice.dead immediately, but the allocator must
  // retain the sounding entry and silence/steal must replace its scheduled end.
  const F = audio.createTrack({ instrument: 'lead' })
  let scheduled = null, stolenFuture = null, cancelled = null, natural = null
  at(12.0, guard(() => {
    scheduled = F.noteOn(60, 100, 12.05)
    F.noteOff(scheduled, { when: 13.2 })
  }))
  at(12.3, guard(() => {
    check(audio.jamVoiceCount() === 1 && !scheduled.done, 'future noteOff stays allocated while sounding')
    F.silence()
    check(scheduled.done && audio.jamVoiceCount() === 0, 'silence removes the future-released entry')
  }))
  at(13.5, guard(() => {
    stolenFuture = F.noteOn(60, 100, 13.55)
    F.noteOff(stolenFuture, { when: 15 })
  }))
  at(13.8, guard(() => {
    check(audio.jamVoiceCount() === 1 && !stolenFuture.done, 'scheduled end is still tracked before stealing')
    const queued = Array.from({ length: 31 }, (_, i) => F.noteOn(40 + i, 90, 16.5))
    check(audio.jamVoiceCount() === 32, 'future-released voice occupies its allocator slot')
    queued.push(F.noteOn(80, 90, 16.5))
    check(stolenFuture.done && queued.every((h) => !h.done), 'stealing prefers the future-released voice')
    check(audio.jamVoiceCount() === 32, 'stealing keeps the allocator bounded')
  }))
  at(14.5, guard(() => {
    F.silence()
    cancelled = F.noteOn(60, 100, 15.1)
    F.noteOff(cancelled, { when: 15.6 })
  }))
  at(14.6, guard(() => {
    F.silence()
    check(cancelled.done && audio.jamVoiceCount() === 0, 'silence also cancels a future start and end')
  }))
  at(16.0, guard(() => {
    natural = F.noteOn(60, 100)
    F.noteOff(natural, { when: 16.25 })
  }))
  at(16.1, guard(() => {
    check(audio.jamVoiceCount() === 1 && !natural.done, 'natural scheduled end remains allocated')
  }))
  at(16.8, guard(() => {
    check(natural.done && audio.jamVoiceCount() === 0, 'natural scheduled end eventually frees its slot')
    F.dispose()
  }))
  const result = await ac.startRendering()
  await Promise.all(pauses)
  AudioNode.prototype.disconnect = realDisconnect
  if (errors.length) throw errors[0]
  const left = result.getChannelData(0)
  check(finite(left) && peak(left) < 1, 'master output is finite and under 1.0')
  check(rms(left, 0.3, 0.45) > 0.003, 'two tracks sound together')
  check(rms(left, 1.3, 1.5) < 0.002, 'released notes stop')
  const fast = rms(left, 2.9, 3.1), slow = rms(left, 4.9, 5.1)
  check(slow > 0.001 && fast < slow * 0.3, 'fast lift releases sooner than slow lift (' + fast + ' vs ' + slow + ')')
  check(rms(left, 5.65, 5.78) > 0.003, 'track note sounds')
  check(rms(left, 6.1, 6.3) < 0.0005, 'mute silences the track')
  check(rms(left, 6.6, 6.9) < 0.0005, 'silence() stops the track')
  check(rms(left, 8.02, 8.2) > 0.01, 'drum track sounds')
  check(rms(left, 9.02, 9.3) < 0.0005, 'muted drum track is silent')
  check(rms(left, 12.12, 12.25) > 0.003, 'future-released note sounds before silence')
  check(rms(left, 12.5, 12.8) < 0.0005, 'silence cuts a future noteOff short in rendered audio')
  check(rms(left, 13.62, 13.75) > 0.003, 'future-released note sounds before stealing')
  check(rms(left, 14.05, 14.3) < 0.0005, 'stealing cuts a future noteOff short in rendered audio')
  check(rms(left, 15.1, 15.4) < 0.0005, 'cancelled future start never sounds')
  check(rms(left, 16.05, 16.2) > 0.003, 'uncancelled scheduled note sounds')
  check(rms(left, 16.8, 17.5) < 0.0005, 'all scheduled voices end without leaking')
  return 'Jam audio: 8 drums (peaks ' + lengths.join(' ') + '), effects, tracks, allocator, scheduled release cancellation, lift, mute, silence, no leaks PASS (offline only)'
}

if (!process.versions.electron) {
  const { spawn } = require('node:child_process')
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE
  const child = spawn(require('electron'), [__filename], { env, stdio: 'inherit' })
  const timer = setTimeout(() => child.kill('SIGKILL'), 90000)
  child.on('error', (error) => { clearTimeout(timer); console.error(error); process.exitCode = 1 })
  child.on('exit', (code, signal) => {
    clearTimeout(timer)
    if (signal) console.error('Jam audio Electron process terminated by ' + signal)
    process.exitCode = code === null ? 1 : code
  })
} else {
  const { app, BrowserWindow, session } = require('electron')
  const http = require('node:http')
  const profile = mkdtempSync(path.join(tmpdir(), 'keylight-jam-audio-'))
  app.setPath('userData', profile)
  app.whenReady().then(async () => {
    let win = null, server = null
    let code = 0
    try {
      session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
      const root = path.resolve(__dirname, '..', 'renderer')
      server = http.createServer((req, res) => {
        if (req.url === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><title>Offline jam audio test</title>'); return }
        const file = path.resolve(root, '.' + decodeURIComponent(req.url).replace(/^\/renderer/, ''))
        if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return }
        try {
          const bytes = readFileSync(file)
          res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : 'audio/mpeg')
          res.end(bytes)
        } catch (error) {
          if (!(error instanceof Error)) throw error
          res.writeHead(404); res.end(error.message)
        }
      })
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
      win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true } })
      win.webContents.setAudioMuted(true)
      await win.loadURL(`http://127.0.0.1:${server.address().port}/`)
      console.log(await win.webContents.executeJavaScript(`(${checkJam.toString()})()`))
    } catch (error) { console.error(error); code = 1 }
    finally {
      if (win) win.destroy()
      if (server) await new Promise((resolve) => server.close(resolve))
      rmSync(profile, { recursive: true, force: true })
      app.exit(code)
    }
  })
}
