// Own hidden, muted Electron process; all sound is rendered by OfflineAudioContext.
const { mkdtempSync, rmSync, readFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const path = require('node:path')

async function checkSamples() {
  const check = (ok, message) => { if (!ok) throw new Error(message) }
  const { loadPiano, pianoStatus, SampleVoice, PianoSampleError, PIANO_SAMPLES } = await import('/renderer/sampler.js')
  const { Voice, INSTRUMENTS, prepareInstrument } = await import('/renderer/instruments.js')
  const audio = await import('/renderer/audio.js')
  const sr = 44100
  const offline = (seconds = 2) => new OfflineAudioContext(2, sr * seconds, sr)
  const rms = (data, from, until) => {
    const values = data.subarray(Math.round(from * sr), Math.round(until * sr))
    return Math.sqrt(values.reduce((sum, v) => sum + v * v, 0) / values.length)
  }
  for (const instrument of INSTRUMENTS) {
    for (const pitch of [36, 60, 84]) {
      const c = offline(3)
      await prepareInstrument(c, instrument.id)
      const v = new Voice(c, c.destination, pitch, 100, instrument.id, 12, 0.1)
      const expression = c.suspend(0.4).then(() => {
        v.setBend(2); v.setPressure(0.8); v.setSlide(0.9)
        check(v.bend === 2 && v.pressure === 0.8 && v.slide === 0.9, instrument.id + ' expression state')
        if (v.oscillators) check(v.oscillators.every((o, i) => Math.abs(o.detune.value - v.detunes[i]) < 0.01), instrument.id + ' bend starts from each layer detune')
        v.release(undefined, 0.9)
        return c.resume()
      })
      const buffer = await c.startRendering()
      await expression
      for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const data = buffer.getChannelData(ch)
        check(data.every(Number.isFinite), instrument.id + ' finite at ' + pitch)
        check(rms(data, 0.15, 0.35) > 0.001, instrument.id + ' sounds at ' + pitch)
        check(rms(data, 0.5, 0.7) > 0.0001, instrument.id + ' sounds with expression at ' + pitch)
        check(rms(data, 2.6, 3) === 0, instrument.id + ' releases at ' + pitch)
      }
      check(v.dead, instrument.id + ' releases its voice')
    }
  }
  const oc = offline()
  check(pianoStatus(oc).state === 'idle', 'initial sample status')
  let threw = false
  try { new SampleVoice(oc, oc.destination, { pitch: 60, velocity: 90, bendRange: 12 }) } catch (e) { threw = e instanceof PianoSampleError }
  check(threw, 'unloaded samples must not become a synthesised fallback')
  const loading = loadPiano(oc)
  check(pianoStatus(oc).state === 'loading', 'explicit loading state')
  check(loadPiano(oc) === loading, 'one concurrent load per context')
  const ready = await loading
  check(ready.state === 'ready' && ready.loaded === PIANO_SAMPLES.length, 'every bundled sample decodes')
  const voice = new Voice(oc, oc.destination, 61, 100, 'sampled-piano', 12, 0.25)
  voice.release(0.12, 0.6)
  const rendered = (await oc.startRendering()).getChannelData(0)
  check(rms(rendered, 0, 0.24) === 0, 'scheduled note starts on audio clock')
  check(rms(rendered, 0.28, 0.5) > 0.01, 'transposed sampled note produces audio')
  check(rms(rendered, 0.9, 1.1) === 0, 'release stops sampled note')

  const render = async (velocity, cancel = false) => {
    const c = offline(3)
    await loadPiano(c)
    const v = new SampleVoice(c, c.destination, { pitch: 60, velocity, bendRange: 12, when: 0.1 })
    v.release(0.2, 1.5)
    if (cancel) v.release(0.04)
    return (await c.startRendering()).getChannelData(0)
  }
  const soft = await render(30), hard = await render(120), cancelled = await render(100, true)
  check(rms(hard, 0.15, 0.5) > 3 * rms(soft, 0.15, 0.5), 'velocity changes loudness')
  check(rms(hard, 0.9, 1.3) > 0.001, 'held piano retains its recorded decay')
  check(rms(cancelled, 0.15, 2) === 0, 'cancellation replaces a scheduled release before onset')

  const realFetch = window.fetch
  window.fetch = async () => new Response(new Uint8Array([1, 2, 3]))
  const broken = offline()
  try { check((await loadPiano(broken)).state === 'unavailable' && !!pianoStatus(broken).error, 'decode failure reports unavailable') }
  finally { window.fetch = realFetch }
  check((await loadPiano(broken)).state === 'ready', 'explicit load retries an unavailable bank')

  // initAudio uses an offline context here, so even live note calls cannot reach hardware.
  window.AudioContext = class extends OfflineAudioContext {
    constructor() { super(2, sr * 5, sr) }
    resume() { return Promise.resolve() }
  }
  check(audio.setInstrument('sampled-piano') === false && audio.currentInstrument() === 'grand', 'unready selection preserves built-in grand')
  const ac = audio.initAudio()
  await audio.loadSampledPiano()
  check(audio.sampledPianoStatus().state === 'ready', 'parent status hook')
  check(audio.setInstrument('sampled-piano'), 'ready sample instrument can be selected')
  for (let pitch = 30; pitch < 75; pitch++) audio.noteOn(pitch, 90)
  check(audio.activeVoiceCount() === 40, '40 live voices retained')
  check(audio.voiceState(0, 30) === null && !!audio.voiceState(0, 74), 'oldest live voice stolen')
  audio.stopAll()
  audio.noteOn(60, 90, 1)
  audio.setSustain(true); audio.noteOff(60, 1)
  check(audio.activeVoiceCount() === 1, 'sustain retains released sampled key')
  audio.setSustain(false)
  check(audio.activeVoiceCount() === 0, 'pedal up releases sampled key')
  audio.noteOn(60, 90, 1)
  audio.setBend(1, 3); audio.setPressure(1, 0.8); audio.setSlide(1, 0.2)
  const state = audio.voiceState(1, 60)
  check(state.instrument === 'sampled-piano' && state.bend === 3 && state.pressure === 0.8 && state.slide === 0.2, 'sample voice expression interface')
  audio.stopAll()
  audio.setVolume(0.6)
  const live = audio.noteOn(60, 90)
  audio.scheduleNote(67, 90, 3.5, 0.2)
  const resume = () => OfflineAudioContext.prototype.resume.call(ac)
  const pauses = [
    ac.suspend(0.5).then(() => { audio.noteOff(60); return resume() }),
    ac.suspend(0.7).then(() => { audio.setAirExpression({ raise: 50, tilt: -50, grasp: 50 }); return resume() }),
    ac.suspend(0.9).then(() => { audio.noteOn(60, 90); return resume() }),
    ac.suspend(1.4).then(() => { audio.noteOff(60); return resume() }),
    ac.suspend(1.6).then(() => { audio.setAirExpression({ raise: 1, tilt: -1, grasp: 1 }); return resume() }),
    ac.suspend(1.8).then(() => { audio.noteOn(60, 90); return resume() }),
    ac.suspend(2.3).then(() => { audio.noteOff(60); return resume() }),
    ac.suspend(2.5).then(() => { audio.setAirExpression(null); return resume() }),
    ac.suspend(2.7).then(() => { audio.noteOn(60, 90); return resume() }),
    ac.suspend(3.2).then(() => { audio.noteOff(60); return resume() }),
    ac.suspend(4.1).then(() => { audio.scheduleNote(60, 90, 4.4, 0.2); audio.cancelScheduled(); return resume() })
  ]
  const result = await ac.startRendering()
  await Promise.all(pauses)
  const left = result.getChannelData(0), right = result.getChannelData(1)
  const neutral = rms(left, 0.15, 0.4), reset = rms(left, 2.85, 3.1)
  check(live.id === 'sampled-piano' && neutral > 0.001, 'live sample reaches final output chain')
  check(rms(left, 1.05, 1.3) > 2 * rms(right, 1.05, 1.3), 'bounded tilt pans the actual audio')
  check(Math.abs(rms(left, 1.05, 1.3) / rms(left, 1.95, 2.2) - 1) < 0.05, 'extreme expression matches clamped endpoint')
  check(Math.abs(reset / neutral - 1) < 0.05, 'disable restores neutral sound without changing master volume')
  check(rms(left, 3.55, 3.65) > 0.001, 'audio.scheduleNote uses the sample instrument')
  check(rms(left, 4.5, 4.8) === 0, 'cancelScheduled silences a future sampled note')
  return 'Sampler: 16 assets decoded; live/scheduled output, velocity, decay, release/cancel, failure/retry, sustain, 40 voices and bounded expression/reset PASS (offline only)'
}

if (!process.versions.electron) {
  const { spawn } = require('node:child_process')
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE
  const child = spawn(require('electron'), [__filename], { env, stdio: 'inherit' })
  const timer = setTimeout(() => child.kill('SIGKILL'), 90000)
  child.on('error', (error) => { clearTimeout(timer); console.error(error); process.exitCode = 1 })
  child.on('exit', (code) => { clearTimeout(timer); process.exitCode = code === null ? 1 : code })
} else {
  const { app, BrowserWindow, session } = require('electron')
  const http = require('node:http')
  const profile = mkdtempSync(path.join(tmpdir(), 'keylight-sampler-'))
  app.setPath('userData', profile)
  app.whenReady().then(async () => {
    let win = null, server = null
    let code = 0
    try {
      session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
      const root = path.resolve(__dirname, '..', 'renderer')
      server = http.createServer((req, res) => {
        if (req.url === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><title>Offline sampler test</title>'); return }
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
      console.log(await win.webContents.executeJavaScript(`(${checkSamples.toString()})()`))
    } catch (error) { console.error(error); code = 1 }
    finally {
      if (win) win.destroy()
      if (server) await new Promise((resolve) => server.close(resolve))
      rmSync(profile, { recursive: true, force: true })
      app.exit(code)
    }
  })
}
