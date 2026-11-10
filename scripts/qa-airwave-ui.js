// Drives the REAL app UI (isolated, muted profile) for the experimental Airwave source and
// prints what it sees. Needs the helper and fixture built (native/build.sh --fixture).
//   node scripts/qa-airwave-ui.js <screenshot-folder>
//   QA_APP=/path/to/packaged/executable node scripts/qa-airwave-ui.js <folder>   (packaged build)
//
// PROOF LEVEL: native ABI fixture. The library the helper loads is native/fake-leapc.c, a
// stand-in; no Ultraleap runtime or Airwave is involved.
//
// The app ships no test hook. Everything here is runtime-only instrumentation injected by
// the debugger before the page loads, at the real boundaries:
//   - navigator.requestMIDIAccess returns one synthetic keyboard; key presses are MIDI
//     messages delivered to the app's own MIDI handler,
//   - the light service socket (ws://127.0.0.1:9010) is replaced by one that never connects,
//     so the user's real keyboard and light daemon are never touched,
//   - canvas text is recorded so the on-canvas score and prompts can be read,
//   - blob downloads are recorded and also saved by the browser into a scratch folder.
// Waits are on real state (UI text, canvas text, the fixture's acknowledgement file), not timers.
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const assert = require('node:assert/strict')

const ROOT = path.join(__dirname, '..')
const ELECTRON = path.join(ROOT, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron')
const FIXTURE = path.join(ROOT, 'native/build/darwin-arm64/libLeapC-fixture.dylib')
const shots = path.resolve(process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'airwave-qa-')))
fs.mkdirSync(shots, { recursive: true })
const tick = (ms) => new Promise((r) => setTimeout(r, ms))   // only the poll interval of the waits below

const INSTRUMENT = `(() => {
  const realHas = URLSearchParams.prototype.has
  URLSearchParams.prototype.has = function (k) { return k === 'nokb' ? false : realHas.call(this, k) }
  window.WebSocket = class { constructor() { this.readyState = 0 } send() {} close() {} addEventListener() {} removeEventListener() {} }
  const listeners = new Set()
  const input = { id: 'qa-in', name: 'LUMI Keys BLOCK', manufacturer: 'ROLI', type: 'input', state: 'connected', connection: 'open',
    onmidimessage: null, open: () => Promise.resolve(input), close: () => Promise.resolve(input),
    addEventListener(t, fn) { if (t === 'midimessage') listeners.add(fn) }, removeEventListener(t, fn) { listeners.delete(fn) } }
  const access = { inputs: new Map([['qa-in', input]]), outputs: new Map(), sysexEnabled: true, onstatechange: null,
    addEventListener() {}, removeEventListener() {} }
  navigator.requestMIDIAccess = () => Promise.resolve(access)
  window.__qaKey = (pitch, on = true) => {
    const event = { data: new Uint8Array([on ? 0x90 : 0x80, pitch, on ? 90 : 0]) }
    if (input.onmidimessage) input.onmidimessage(event)
    for (const fn of listeners) fn(event)
  }
  const drawn = new Map()
  const fill = CanvasRenderingContext2D.prototype.fillText
  CanvasRenderingContext2D.prototype.fillText = function (text, ...rest) { drawn.set(String(text), performance.now()); return fill.call(this, text, ...rest) }
  window.__qaTexts = (withinMs = 400) => [...drawn].filter(([, at]) => performance.now() - at < withinMs).map(([t]) => t)
  window.__qaDownloads = []
  const create = URL.createObjectURL
  URL.createObjectURL = function (blob) { const url = create.call(this, blob); window.__qaDownloads.push({ url, type: blob.type, size: blob.size, text: blob.text() }); return url }
  const click = HTMLAnchorElement.prototype.click
  HTMLAnchorElement.prototype.click = function () { if (this.download) window.__qaDownloads.push({ name: this.download, clicked: true }); return click.call(this) }
})()`

async function session({ env, query }) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'keylight-qa-profile-'))
  const downloads = fs.mkdtempSync(path.join(os.tmpdir(), 'keylight-qa-downloads-'))
  const port = 9300 + Math.floor(Math.random() * 400)
  const childEnv = { ...process.env, LUMI_USERDATA: profile, LUMI_NO_KEYBOARD: '1', LUMI_QUERY: query, ...env }
  const flag = `--remote-debugging-port=${port}`
  const child = process.env.QA_APP ? spawn(process.env.QA_APP, [flag], { stdio: 'ignore', env: childEnv })
    : spawn(ELECTRON, ['.', flag], { cwd: ROOT, stdio: 'ignore', env: childEnv })
  let target
  for (let i = 0; i < 100 && !target; i++) {
    await tick(300)
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page' && /^keylight:\/\/app\/index\.html/.test(t.url)) } catch (_e) { /* not up yet */ }
  }
  assert.ok(target, 'app page did not appear')
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve) => { ws.onopen = resolve })
  let id = 0
  const pending = new Map()
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
  const send = (method, params = {}) => new Promise((resolve) => { const n = ++id; pending.set(n, resolve); ws.send(JSON.stringify({ id: n, method, params })) })
  await send('Page.enable')
  await send('Page.addScriptToEvaluateOnNewDocument', { source: INSTRUMENT })
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads })
  await send('Page.reload')
  const api = {
    downloads,
    async eval(expression) {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails))
      return r.result.result.value
    },
    async until(expression, what, ms = 25000) {
      const end = Date.now() + ms
      for (;;) {
        try { if (await api.eval(expression)) return } catch (_e) { /* page still loading */ }
        if (Date.now() > end) throw new Error('timed out waiting for ' + what + ' (page: ' + await api.eval("JSON.stringify({ screen: document.body.dataset.screen, air: document.getElementById('airStatus')?.textContent, coach: document.getElementById('coachFeedback')?.textContent, hud: document.getElementById('scoreHud')?.textContent, texts: window.__qaTexts?.() })") + ')')
        await tick(100)
      }
    },
    async shot(name, selector) {
      let clip
      if (selector) clip = await api.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, scale: 1 } })()`)
      const r = await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip } : {}) })
      if (!r.result?.data) throw new Error('screenshot failed: ' + JSON.stringify(r.error || r))
      fs.writeFileSync(path.join(shots, name + '.png'), Buffer.from(r.result.data, 'base64'))
    },
    text: (id2) => api.eval(`document.getElementById(${JSON.stringify(id2)}).textContent`),
    click: (id2) => api.eval(`document.getElementById(${JSON.stringify(id2)}).click()`),
    select: (id2, value) => api.eval(`(() => { const s = document.getElementById(${JSON.stringify(id2)}); s.value = ${JSON.stringify(value)}; s.dispatchEvent(new Event('change')) })()`),
    press: (pitch) => api.eval(`window.__qaKey(${pitch}, true); window.__qaKey(${pitch}, false)`),
    score: async () => {
      const m = (await api.eval("document.getElementById('scoreHud').textContent")).match(/^(\d+)% · (\d+) hit/)
      return m ? { accuracy: Number(m[1]), hits: Number(m[2]) } : null
    },
    async close() {
      try { ws.close() } catch (_e) { /* closed */ }
      const gone = new Promise((resolve) => child.once('exit', resolve))
      child.kill()
      await Promise.race([gone, tick(5000)])
      for (const dir of [profile, downloads]) fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
    }
  }
  return api
}

// clicks again until the app has finished starting and really shows Settings
const openSettings = (app) => app.until(`(() => { if (document.body.dataset.screen !== 'settings') document.getElementById('openSettings')?.click(); return document.body.dataset.screen === 'settings' && document.getElementById('airCard').getBoundingClientRect().width > 0 })()`, 'settings screen')

async function scenarioMissingRuntime() {
  const app = await session({ env: { KEYLIGHT_LEAPC_PATH: '/definitely/not/here.dylib' }, query: '' })
  try {
    await openSettings(app)
    assert.equal(await app.text('airStatus'), 'Off')
    await app.shot('1-off', '#airCard')
    await app.select('fingerSource', 'airwave')
    await app.click('airToggle')
    await app.until("document.getElementById('airStatus').textContent.includes('not found')", 'runtime-missing state')
    console.log('QA runtime missing ->', await app.text('airStatus'), '|', await app.text('airHelp'))
    await app.shot('2-runtime-missing', '#airCard')
    await app.click('airToggle')
    await app.until("document.getElementById('airStatus').textContent === 'Off'", 'disconnected')
  } finally { await app.close() }
}

// C3..B4 is the 24-key row the song screen shows; a white key's place along the row
const WHITE = [0, 2, 4, 5, 7, 9, 11]
const fractionOf = (pitch) => { const o = Math.floor((pitch - 48) / 12), pc = (pitch - 48) % 12; return (o * 7 + WHITE.indexOf(pc)) / 13 }

async function scenarioStreamCoachExport(dir) {
  const pose = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'airwave-pose-')), 'pose')
  // the pressing height: low Y for a sensor under the hand (dir +1), high Y for one above it (dir -1)
  const press = dir > 0 ? 22 : 300
  const read = (file) => { try { return fs.readFileSync(file, 'utf8').trim().split(/\s+/).map(Number) } catch (_e) { return [] } }
  const app = await session({ env: { KEYLIGHT_LEAPC_PATH: FIXTURE, KEYLIGHT_FAKE_POSE: pose, KEYLIGHT_FAKE_LIFT_DIR: String(dir) }, query: 'demo=twinkle&mode=PRACTISE' })
  // moves the fixture hand and waits until the app has received frames emitted after the move
  const frames = async () => Number(((await app.text('airFrames')).match(/^(\d+) frames/) || [])[1] || 0)
  async function move(x, finger, y = press) {
    fs.writeFileSync(pose, `${x} ${finger} ${y}`)
    let emitted
    const end = Date.now() + 10000
    for (;;) {
      const [ax, af, ay, n] = read(pose + '.ack')
      if (Math.abs(ax - x) < 0.01 && af === finger && Math.abs(ay - y) < 0.01) { emitted = n; break }
      if (Date.now() > end) throw new Error('the fixture never acknowledged the pose ' + x + ' ' + finger)
      await tick(20)
    }
    await app.until(`(() => { const m = document.getElementById('airFrames').textContent.match(/^(\\d+) frames/); return !!m && Number(m[1]) >= ${emitted + 3} })()`, 'frames after the move reached the app')
  }
  try {
    fs.writeFileSync(pose, `0 2 ${press}`)
    await app.until("document.body.dataset.screen === 'play'", 'song on screen')
    await app.until("document.querySelector('#kbStatus.on')", 'synthetic keyboard bound through MIDI')
    await openSettings(app)
    await app.select('fingerSource', 'airwave')
    await app.eval("(() => { const c = document.getElementById('coachEnabled'); c.checked = true; c.dispatchEvent(new Event('change')) })()")
    await app.click('airToggle')
    await app.until("document.getElementById('airStatus').textContent === 'Receiving fingertips'", 'streaming fingertips')
    console.log('QA streaming ->', await app.text('airStatus'), '|', await app.text('airFrames'))
    await app.shot('3-streaming', '#airCard')

    // calibrate with two real MIDI key presses: lowest key with the hand at x=-100, highest at x=+100
    await app.click('airCalibrate')
    await move(-100, 2)
    await app.press(48)
    await app.until("/Calibration 2 of 3/.test(document.getElementById('airHelp').textContent)", 'first calibration press accepted')
    await move(100, 2)
    await app.press(71)
    await app.until("/Calibration 3 of 3/.test(document.getElementById('airHelp').textContent)", 'second calibration press accepted')
    assert.equal(await app.text('airCalState'), 'Not set')       // not trusted until the lift direction is measured
    await move(100, 2, press + dir * 60)                         // lift the same finger about 6 cm and hold
    await app.until("document.getElementById('airCalState').textContent === 'Set'", 'calibration saved after the lift')
    await move(100, 2, press)
    console.log(`QA calibration (lift ${dir > 0 ? 'raises' : 'lowers'} Y) ->`, await app.text('airCalState'))

    // start the song in Wait mode and play its first note (C4, suggested right-hand thumb) with the thumb
    await app.click('back')
    await app.until("document.body.dataset.screen === 'home'", 'home screen')
    await app.click('continuePractise')   // the real "practise" button on the home screen: Twinkle in Wait mode
    await app.until("document.body.dataset.screen === 'play'", 'song screen')
    await app.click('btnPlay')
    await app.until("window.__qaTexts(150).some((t) => /Your turn/.test(t))", 'song waiting for the first note')
    const before = await app.score()
    await move(-100 + 200 * fractionOf(60), 1)
    await app.press(60)
    await app.until("/Suggested finger/.test(document.getElementById('coachFeedback').textContent)", 'match feedback')
    const matchText = await app.eval("document.getElementById('coachFeedback').textContent")
    console.log('QA coaching (thumb on the suggested thumb) ->', matchText)
    assert.equal(matchText, 'Suggested finger 1: observed 1, right hand.')
    await app.until("/^100% · 1 hit/.test(document.getElementById('scoreHud').textContent)", 'score after the first note')
    const afterMatch = await app.score()
    await app.shot('4-play-match')

    // the same opening chord also waits for the left-hand C3. The fixture only has a right hand, so
    // pressing it with the right index is a confident, different hand and finger: advisory mismatch
    const mid = await app.score()
    await move(-100 + 200 * fractionOf(48), 2)
    await app.press(48)
    await app.until("/Right note/.test(document.getElementById('coachFeedback').textContent)", 'mismatch feedback')
    const mismatchText = await app.eval("document.getElementById('coachFeedback').textContent")
    console.log('QA coaching (right index on the left-hand note) ->', mismatchText)
    assert.match(mismatchText, /^Right note\. Suggested left finger [1-5]; observed right finger 2\.$/)
    await app.until(`document.getElementById('scoreHud').textContent.startsWith('100% · ${(mid?.hits ?? 0) + 1} hit')`, 'score after the mismatch')
    const afterMismatch = await app.score()
    // note scoring is the same whatever the finger: both presses were the right key and both count
    assert.equal(before === null || before.hits === 0, true)
    assert.equal(afterMatch.hits, 1)
    assert.equal(afterMismatch.hits, afterMatch.hits + 1)
    assert.equal(afterMatch.accuracy, 100)
    assert.equal(afterMismatch.accuracy, 100)
    await app.shot('5-play-mismatch')

    // export: the button downloads a text report; read the saved file
    await openSettings(app)
    await app.click('airReport')
    const file = path.join(app.downloads, 'keylight-airwave-report.txt')
    for (let i = 0; i < 100 && !fs.existsSync(file); i++) await tick(100)
    const saved = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null
    const recorded = await app.eval('Promise.all(window.__qaDownloads.filter((d) => d.text).map((d) => d.text))')
    const report = saved ?? recorded[0]
    console.log('QA export ->', saved ? 'saved by the browser to a scratch folder' : 'blob recorded (browser did not save a file)', `(${report?.length} characters)`)
    assert.ok(report, 'the export produced no report')
    assert.deepEqual(await app.eval('window.__qaDownloads.filter((d) => d.clicked).map((d) => d.name)'), ['keylight-airwave-report.txt'])
    assert.match(report, /^Keylight experimental Airwave tracking report/)
    assert.match(report, /UNVERIFIED/)
    assert.match(report, /Route: native-helper/)
    assert.match(report, /Tracking device reported: Yes, class SIR170, type code 4611/)
    assert.match(report, /Library message layout check: Matches/)
    assert.match(report, /Distinct fingers seen \(of 10\): 5/)
    assert.match(report, /Key calibration set: Yes/)
    assert.match(report, dir > 0 ? /Measured lift direction \(sensor Y\): Raising a finger increases Y/ : /Measured lift direction \(sensor Y\): Raising a finger decreases Y/)
    assert.match(report, /Airwave-named MIDI input present: No/)
    assert.match(report, /Frames received: [1-9]\d*/)
    for (const secret of ['/Users', '/var/folders', os.homedir(), 'serial number', 'serial:', '-100', 'keylight-qa-profile', 'twinkle', 'Twinkle']) assert.equal(report.includes(secret), false, 'report leaked ' + secret)

    // switching back to the camera stops the helper and leaves the camera card untouched
    await app.select('fingerSource', 'camera')
    await app.until("document.getElementById('airStatus').textContent === 'Off'", 'helper stopped')
    assert.equal(await app.text('camStatus'), 'Off')
  } finally { await app.close() }
}

;(async () => {
  await scenarioMissingRuntime()
  await scenarioStreamCoachExport(1)
  await scenarioStreamCoachExport(-1)
  console.log('QA airwave UI done; screenshots in ' + shots)
})().catch((error) => { console.error(error); process.exitCode = 1 })
