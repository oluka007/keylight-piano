const http = require('node:http')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const net = require('node:net')
const { spawn, execFile } = require('node:child_process')
const { setTimeout: sleep } = require('node:timers/promises')

// Under plain Node (scripts/test-watchdog.js) this file only lends out the blocksd
// watchdog for testing: Electron, and with it the app, loads only under Electron.
const { app, BrowserWindow, session, nativeTheme, screen } = process.versions.electron ? require('electron') : {}

const ROOT = path.join(__dirname, 'renderer')
// Keylight runs on macOS and Windows. The few things that differ (blocksd, the window
// frame) check this; everything else is the same code on both.
const IS_WIN = process.platform === 'win32'

// App file log — needed because a Finder-launched app has nowhere to print.
// It lives in the profile folder (test profiles keep their own). Past 5 MB it
// starts over, keeping the last 1 MB of the old one as app.log.old.
let LOG_FILE = null
const LOG_MAX = 5 * 1024 * 1024
let logBytes = 0
function rotateLog() {
  const size = fs.statSync(LOG_FILE).size
  const keep = Math.min(size, 1024 * 1024)
  const buf = Buffer.alloc(keep)
  const fd = fs.openSync(LOG_FILE, 'r')
  try { fs.readSync(fd, buf, 0, keep, size - keep) } finally { fs.closeSync(fd) }
  fs.writeFileSync(LOG_FILE + '.old', buf)
  fs.writeFileSync(LOG_FILE, '')
}
function openLog(dir) {
  LOG_FILE = path.join(dir, 'app.log')
  try {
    fs.mkdirSync(dir, { recursive: true })
    if (fs.existsSync(LOG_FILE)) {
      if (fs.statSync(LOG_FILE).size > LOG_MAX) rotateLog()
      logBytes = fs.statSync(LOG_FILE).size
    }
  } catch (_e) {}
}
function log(...args) {
  const line = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')
  if (LOG_FILE) {
    try {
      const text = `[${new Date().toISOString()}] ${line}\n`
      logBytes += text.length
      if (logBytes > LOG_MAX) { rotateLog(); logBytes = text.length }
      fs.appendFileSync(LOG_FILE, text)
    } catch (_e) {}
  }
  // stdout can be a closed pipe (started from a terminal that went away): writing
  // to it then throws EPIPE, which must not be logged again or it loops forever
  try { console.log(line) } catch (_e) {}
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.mid': 'audio/midi', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.xml': 'application/xml', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.task': 'application/octet-stream', '.bin': 'application/octet-stream' }

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent((req.url || '/').split('?')[0])
      const file = path.join(ROOT, rel === '/' ? 'index.html' : rel)
      if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file)) { res.writeHead(404); return res.end('not found') }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' })
      fs.createReadStream(file).pipe(res)
    })
    const start = (port, canRetry) => {
      server.once('error', () => { if (canRetry) start(0, false) })
      server.listen(port, '127.0.0.1', () => resolve(server.address().port))
    }
    // Fixed port keeps the origin stable so localStorage progress persists.
    // Test profiles (LUMI_USERDATA) take any free port so they never steal the real one.
    start(Number(process.env.LUMI_PORT || (process.env.LUMI_USERDATA ? 0 : 47821)), true)
  })
}

// ---- blocksd ------------------------------------------------------------------
// The keyboard's per-key lighting is driven by the blocksd daemon. The app starts
// it when it is not running, so it works after a reboot without manual steps, and
// a watchdog brings the keyboard back when it drops off a running daemon.
// blocksd runs on macOS and Linux only, so on Windows none of this runs (openWindow):
// the keys light from plain MIDI notes there (renderer/app.js, "Tier-B light fallback").

const BLOCKSD = path.join(os.homedir(), '.local/bin/blocksd' + (IS_WIN ? '.exe' : ''))
const LED_PORT = 9010
const LED_WS_URL = `ws://127.0.0.1:${LED_PORT}/ws`

// Every 20 s ask blocksd what it sees. Once it has listed no device for a minute
// while macOS still shows the keyboard on USB, restart it, at most once every
// 3 minutes. A daemon that is not running at all is started straight away.
const WATCHDOG = { everyMs: 20000, missingMs: 60000, restartGapMs: 180000, replyMs: 5000 }
// How the keyboard shows up in `ioreg -p IOUSB`; the Piano M reports as LUMI Keys.
const USB_KEYBOARD = /LUMI Keys|\bPiano M\b/

// Number of devices in a blocksd discover reply (0 for anything unreadable).
// The uids are 64-bit and lose precision in JSON.parse, which is fine for counting.
function countDiscoveredDevices(text) {
  try {
    const msg = JSON.parse(text)
    return msg && msg.type === 'discover_response' && Array.isArray(msg.devices) ? msg.devices.length : 0
  } catch (_e) { return 0 }
}

function keyboardOnUsb(ioregText) {
  return USB_KEYBOARD.test(String(ioregText || ''))
}

// The watchdog's decisions, with all I/O passed in so scripts/test-watchdog.js can
// drive it with fake replies and a fake clock. probe() resolves to blocksd's
// discover reply text, or null when nothing answered; portOpen() then tells a
// stopped daemon (start it) from a hung one (counts as listing nothing).
function createLedWatchdog({ probe, portOpen, readUsb, start, restart, now, log }) {
  let missingSince = null     // since when blocksd has listed nothing while the keyboard is on USB
  let lastStart = -Infinity   // starts of a stopped daemon and restarts of a running one are
  let lastRestart = -Infinity // each limited to one per 3 minutes, so neither can loop
  let state = ''
  // log on changes only, so a steady state is one line in app.log, not one per check
  const enter = (next, message) => {
    if (next !== state) log('[watchdog] ' + message)
    state = next
    return next
  }

  async function tick() {
    const t = now()
    const reply = await probe()
    if (reply === null && !(await portOpen())) {
      missingSince = null
      if (t - lastStart < WATCHDOG.restartGapMs) return enter('down', 'blocksd is still not running')
      lastStart = t
      enter('start', 'blocksd is not running: starting it')
      await start()
      return 'start'
    }
    const devices = reply === null ? 0 : countDiscoveredDevices(reply)
    if (devices > 0) {
      missingSince = null
      return enter('ok', `blocksd sees ${devices} device${devices === 1 ? '' : 's'}`)
    }
    if (!keyboardOnUsb(await readUsb())) {
      missingSince = null
      return enter('unplugged', 'no keyboard on USB (switched off or unplugged)')
    }
    if (missingSince === null) missingSince = t
    const missedFor = t - missingSince
    if (missedFor < WATCHDOG.missingMs) {
      return enter('missing', reply === null ? 'blocksd does not answer while the keyboard is on USB'
        : 'the keyboard is on USB but blocksd lists no device')
    }
    if (t - lastRestart < WATCHDOG.restartGapMs) {
      return enter('waiting', 'blocksd still lists no keyboard; waiting before restarting it again')
    }
    lastRestart = t
    missingSince = null
    enter('restart', `no keyboard on blocksd for ${Math.round(missedFor / 1000)} s while it is on USB: restarting blocksd`)
    await restart()
    return 'restart'
  }

  return { tick }
}

// Resolves true when something accepts connections on the port.
function portOpen(port, timeoutMs = 1000) {
  return new Promise((resolve) => {
    const sock = net.connect({ host: '127.0.0.1', port })
    const done = (open) => { sock.destroy(); resolve(open) }
    sock.setTimeout(timeoutMs, () => done(false))
    sock.once('connect', () => done(true))
    sock.once('error', () => done(false))
  })
}

// Asks blocksd which devices it sees: resolves to the discover reply's text, or
// null when nothing answers within timeoutMs. Uses the global WebSocket (Node 22+,
// so Electron 45's main process has it).
function discoverLedDevices(url, timeoutMs) {
  return new Promise((resolve) => {
    let ws = null
    let timer = null
    const finish = (text) => {
      clearTimeout(timer)
      if (ws) {
        ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null
        try { ws.close() } catch (_e) {}
        ws = null
      }
      resolve(text)
    }
    timer = setTimeout(() => finish(null), timeoutMs)
    try { ws = new WebSocket(url) } catch (_e) { finish(null); return }
    ws.onopen = () => ws.send(JSON.stringify({ type: 'discover', id: 'watchdog' }))
    ws.onmessage = (ev) => {
      const text = String(ev.data)
      if (/"type"\s*:\s*"discover_response"/.test(text)) finish(text)
    }
    ws.onerror = () => finish(null)
    ws.onclose = () => finish(null)
  })
}

function readUsbDevices() {
  return new Promise((resolve) => {
    execFile('/usr/sbin/ioreg', ['-p', 'IOUSB', '-w0'], { timeout: 5000, maxBuffer: 8 * 1024 * 1024 },
      (_err, stdout) => resolve(String(stdout || '')))
  })
}

function run(cmd, args) {
  return new Promise((resolve) => execFile(cmd, args, { timeout: 5000 }, (err) => resolve(!err)))
}

async function waitPortClosed(port, timeoutMs) {
  const until = Date.now() + timeoutMs
  while (await portOpen(port, 500)) {
    if (Date.now() > until) return false
    await sleep(250)
  }
  return true
}

let reportedMissingBlocksd = false
function startBlocksd(reason) {
  if (!fs.existsSync(BLOCKSD)) {
    if (!reportedMissingBlocksd) log('[daemon] blocksd not installed at ' + BLOCKSD)
    reportedMissingBlocksd = true
    return
  }
  try {
    const child = spawn(BLOCKSD, ['run'], { detached: true, stdio: 'ignore', windowsHide: true })
    child.once('error', (e) => log('[daemon] failed to start blocksd: ' + e.message))
    child.unref()
    log('[daemon] started blocksd (' + reason + ')')
  } catch (e) { log('[daemon] failed to start blocksd: ' + e.message) }
}

async function restartBlocksd() {
  // never stop a daemon we could not start again
  if (!fs.existsSync(BLOCKSD)) { log('[daemon] not restarting blocksd: not installed at ' + BLOCKSD); return }
  await run('/usr/bin/pkill', ['-f', 'blocksd run'])
  if (!(await waitPortClosed(LED_PORT, 10000))) {
    log('[daemon] blocksd did not stop within 10 s: killing it')
    await run('/usr/bin/pkill', ['-KILL', '-f', 'blocksd run'])
    if (!(await waitPortClosed(LED_PORT, 5000))) { log('[daemon] port 9010 is still taken: not starting a second blocksd'); return }
  }
  log('[daemon] stopped blocksd')
  startBlocksd('watchdog restart')
}

// Checks blocksd now (starting it if it is not running) and then every 20 s. Test
// profiles (LUMI_USERDATA) only do the first check, so they never restart the
// daemon the real app is using; LUMI_WATCHDOG=1 or 0 forces the periodic check on or off.
function startLedWatchdog() {
  const watchdog = createLedWatchdog({
    probe: () => discoverLedDevices(LED_WS_URL, WATCHDOG.replyMs),
    portOpen: () => portOpen(LED_PORT),
    readUsb: readUsbDevices,
    start: () => startBlocksd('it was not running'),
    restart: restartBlocksd,
    now: () => performance.now(),
    log
  })
  const flag = process.env.LUMI_WATCHDOG
  const periodic = flag ? flag === '1' : !process.env.LUMI_USERDATA
  const check = async () => {
    try { await watchdog.tick() } catch (e) { log('[watchdog] check failed: ' + (e && e.message)) }
    if (periodic) setTimeout(check, WATCHDOG.everyMs)
  }
  check()
}

// ---- capture --------------------------------------------------------------------

// Screenshot harness: LUMI_SHOT=/path.png captures the page LUMI_SHOT_DELAY ms
// after it loads, then quits.
async function captureShot(win, file) {
  try {
    const img = await win.webContents.capturePage()
    fs.writeFileSync(file, img.toPNG())
    log('[shot] saved ' + file)
  } catch (e) { log('[shot] failed: ' + e.message) }
}

// Body of the PNG encoder threads. nativeImage.toPNG() takes ~80 ms a frame on the
// main thread, longer than a 15 fps frame lasts, so frames arrive as raw BGRA and
// are written as RGB PNGs (frames are opaque) with fast compression here.
function pngEncoderThread() {
  const { parentPort } = require('node:worker_threads')
  const fs = require('node:fs')
  const zlib = require('node:zlib')
  const chunk = (type, data) => {
    const out = Buffer.alloc(12 + data.length)
    out.writeUInt32BE(data.length, 0)
    out.write(type, 4, 'latin1')
    data.copy(out, 8)
    out.writeUInt32BE(zlib.crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
    return out
  }
  parentPort.on('message', ({ id, file, width, height, bgra }) => {
    try {
      const src = new Uint8Array(bgra)
      const rgb = Buffer.alloc((width * 3 + 1) * height) // each row: filter byte 0, then RGB
      for (let y = 0, s = 0, d = 0; y < height; y++) {
        d++
        for (let x = 0; x < width; x++, s += 4, d += 3) {
          rgb[d] = src[s + 2]
          rgb[d + 1] = src[s + 1]
          rgb[d + 2] = src[s]
        }
      }
      const header = Buffer.alloc(13)
      header.writeUInt32BE(width, 0)
      header.writeUInt32BE(height, 4)
      header[8] = 8 // bits per channel
      header[9] = 2 // RGB
      fs.writeFileSync(file, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(rgb, { level: 1 })), chunk('IEND', Buffer.alloc(0))]))
      parentPort.postMessage({ id })
    } catch (e) { parentPort.postMessage({ id, error: e.message }) }
  })
}

function createPngEncoder(threads) {
  const { Worker } = require('node:worker_threads')
  const workers = Array.from({ length: threads }, () => new Worker(`(${pngEncoderThread})()`, { eval: true }))
  const pending = new Map()
  let nextId = 0
  for (const w of workers) {
    w.on('message', ({ id, error }) => {
      const job = pending.get(id)
      pending.delete(id)
      if (error) job.reject(new Error(error))
      else job.resolve()
    })
  }
  return {
    get backlog() { return pending.size },
    // resolves once the frame is on disk
    encode(file, image) {
      const scale = image.getScaleFactors()[0] || 1
      const { width, height } = image.getSize(scale)
      const bitmap = image.toBitmap({ scaleFactor: scale })
      if (bitmap.length !== width * height * 4) return fs.promises.writeFile(file, image.toPNG())
      const id = nextId++
      const ab = bitmap.byteOffset === 0 && bitmap.byteLength === bitmap.buffer.byteLength ? bitmap.buffer : bitmap.buffer.slice(bitmap.byteOffset, bitmap.byteOffset + bitmap.byteLength)
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject })
        workers[id % workers.length].postMessage({ id, file, width, height, bgra: ab }, [ab])
      })
    },
    close: () => Promise.all(workers.map((w) => w.terminate()))
  }
}

// Demo-video frames: LUMI_FRAMES=<dir> saves frame-00001.png, frame-00002.png, ...
// at LUMI_FRAMES_FPS (15) for LUMI_FRAMES_SECONDS (12), then quits; scripts/record.sh
// turns them into an mp4 and a gif. Frame n is due at (n - 1) / fps seconds: when a
// capture runs late and a frame's slot has already passed (or the encoders fall
// behind), that slot repeats the previous frame, so the frames always play back in
// real time.
async function captureFrames(win, dir, fps, seconds) {
  const total = Math.max(1, Math.round(fps * seconds))
  const step = 1000 / fps
  const frame = (n) => path.join(dir, `frame-${String(n).padStart(5, '0')}.png`)
  const threads = Math.max(2, Math.min(4, os.availableParallelism() - 2))
  const encoder = createPngEncoder(threads)
  const writes = []
  const repeats = [] // [slot, frame it repeats]
  let last = 0
  let size = null
  let captureMs = 0
  try {
    fs.mkdirSync(dir, { recursive: true })
    const t0 = performance.now()
    for (let n = 1; n <= total; n++) {
      const due = t0 + (n - 1) * step
      const wait = due - performance.now()
      if (wait > 0) await sleep(wait)
      if (last && (performance.now() > due + step || encoder.backlog > threads * 3)) {
        repeats.push([n, last])
        continue
      }
      const started = performance.now()
      const img = await win.webContents.capturePage()
      size = size || img.getSize(img.getScaleFactors()[0] || 1)
      writes.push(encoder.encode(frame(n), img))
      captureMs += performance.now() - started
      last = n
    }
    await Promise.all(writes)
    for (const [n, from] of repeats) fs.copyFileSync(frame(from), frame(n))
    log(`[frames] saved ${total} frames (${size.width}x${size.height}, ${fps} fps) to ${dir}: ` +
      `${repeats.length} repeated to keep time, ${Math.round(captureMs / (total - repeats.length))} ms per capture`)
  } catch (e) {
    log('[frames] failed: ' + e.message)
  } finally {
    await encoder.close()
  }
}

// ---- takes ----------------------------------------------------------------------
// The take recorder (renderer/recorder.js) saves a take by downloading its video and
// its JSON sidecar from blob: URLs. Only downloads named like a take AND made from
// this app's own page (a blob: URL of http://127.0.0.1:<the port it is served on>)
// are handled here: they go straight to LUMI_REC_DIR, or Movies/Keylight, with no
// dialog. Every other download is left alone.
const TAKE_FILE = /^(keylight-take-\d{8}-\d{6})\.(mp4|webm|json)$/
const BLOB_ID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
function isTakeDownload(filename, url, port) {
  if (!TAKE_FILE.test(String(filename || ''))) return false
  const p = Number(port)
  if (!Number.isInteger(p) || p <= 0 || p > 65535) return false
  return new RegExp(`^blob:http://127\\.0\\.0\\.1:${p}/${BLOB_ID}$`, 'i').test(String(url || ''))
}

const takeDir = () => process.env.LUMI_REC_DIR || path.join(app.getPath('videos'), 'Keylight')

// LUMI_REC_QUIT=1 (scripts/record-clip.sh): quit once a take's video and JSON have both
// finished saving (or failed). Returns { finished(), saving(), idle(since, files, ms) }: idle
// resolves once `files` take files have finished since finished() read `since`, and
// none is still saving, or after ms.
function handleTakeDownloads(port) {
  const takes = new Map()   // stem -> { suffix, video, json }: a take's two files keep one name
  let saving = 0, finished = 0
  const waiters = new Set()
  const wake = () => { for (const w of waiters) w() }
  session.defaultSession.on('will-download', (_e, item) => {
    const name = item.getFilename()
    if (!isTakeDownload(name, item.getURL(), port)) return
    const [, stem, ext] = name.match(TAKE_FILE)
    const dir = takeDir()
    let entry = takes.get(stem)
    if (!entry) {
      // an older take of the same name in that folder is never overwritten
      let suffix = ''
      for (let n = 2; ['mp4', 'webm', 'json'].some((x) => fs.existsSync(path.join(dir, `${stem}${suffix}.${x}`))); n++) suffix = '-' + n
      entry = { suffix, video: null, json: null }
      takes.set(stem, entry)
    }
    const file = path.join(dir, `${stem}${entry.suffix}.${ext}`)
    try { fs.mkdirSync(dir, { recursive: true }) } catch (e) { log('[take] cannot make ' + dir + ': ' + e.message) }
    item.setSavePath(file)
    saving++
    item.once('done', (_ev, state) => {
      if (state === 'completed') log('[take] saved ' + file + ' (' + (item.getReceivedBytes() / 1e6).toFixed(2) + ' MB)')
      else log('[take] failed to save ' + file + ': ' + state)
      saving--
      finished++
      entry[ext === 'json' ? 'json' : 'video'] = state
      if (entry.video && entry.json) {
        takes.delete(stem)
        if (process.env.LUMI_REC_QUIT === '1') { log('[take] both files of ' + stem + ' are done: quitting (LUMI_REC_QUIT)'); setTimeout(() => app.quit(), 200) }
      }
      wake()
    })
  })
  return {
    finished: () => finished,
    saving: () => saving,
    idle: (since, files, ms) => new Promise((resolve) => {
      const target = since + files
      const check = () => { if (finished >= target && saving === 0) done() }
      const timer = setTimeout(() => done(), ms)
      function done() { clearTimeout(timer); waiters.delete(check); resolve(finished >= target && saving === 0) }
      waiters.add(check)
      check()
    })
  }
}

// A take still recording when the window closes (Cmd+Q, the close button) is saved
// before the app goes: the page stops it and downloads it (window.keylightSaveTake,
// renderer/app.js) and the close waits for those files, at most a minute. A page
// that does not say within 2 s whether it has a take is closed anyway.
function saveTakeOnClose(win, takes) {
  let asked = false
  const page = async (code, ms, fallback) => {
    try { return await Promise.race([win.webContents.executeJavaScript(code, true), sleep(ms).then(() => fallback)]) } catch (_e) { return fallback }
  }
  win.on('close', (e) => {
    if (asked) return
    asked = true
    e.preventDefault()
    const since = takes.finished()
    ;(async () => {
      if (await page('typeof window.keylightTakeBusy === "function" && window.keylightTakeBusy()', 2000, false)) {
        log('[take] the window is closing: saving the take first')
        const files = await page('window.keylightSaveTake()', 60000, 0)
        if (files > 0 && !(await takes.idle(since, files, 60000))) log('[take] gave up waiting for the take to save')
      } else if (takes.saving() > 0) {
        log('[take] the window is closing: letting the last take finish saving')
        await takes.idle(since, 0, 60000)
      }
      app.quit()
    })()
  })
}

function numberEnv(name, fallback, min, max) {
  const v = Number(process.env[name])
  return Number.isFinite(v) && v > 0 ? Math.min(max, Math.max(min, v)) : fallback
}

// ---- app ------------------------------------------------------------------------

function startApp() {
  // Progress lives in ~/Library/Application Support/lumi-app (%APPDATA%\lumi-app on
  // Windows), the folder the app has always used, whatever the product or bundle is
  // called, so it survives renames and rebuilt bundles. LUMI_USERDATA gives
  // screenshot/test runs their own profile (and their own single-instance lock) so
  // they can run beside the real app.
  let profileError = null
  try { app.setPath('userData', process.env.LUMI_USERDATA || path.join(app.getPath('appData'), 'lumi-app')) } catch (e) { profileError = e }
  openLog(app.getPath('userData'))
  log('--- app start pid=' + process.pid + ' version=' + app.getVersion() + ' packaged=' + app.isPackaged)
  if (profileError) log('could not use the profile folder, using ' + app.getPath('userData') + ': ' + profileError.message)
  process.stdout.on('error', () => {})
  process.on('uncaughtException', (e) => { if (e && e.code !== 'EPIPE') log('UNCAUGHT ' + (e && e.stack || e)) })

  // One instance only: a second click focuses the existing window instead of
  // spawning a rival renderer that fights over the LED daemon.
  if (!app.requestSingleInstanceLock()) { app.quit(); return }
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) { if (win.isMinimized()) win.restore(); if (IS_WIN) win.show(); win.focus() }
  })
  app.whenReady().then(openWindow)
}

// Windows: Electron's default menu bar (File, Edit, View…) hides until Alt is pressed,
// the title bar is dark like the page, and the window fits a small screen (1280x820 is
// taller than a 1080p screen at 150% scaling). Test runs keep off the taskbar.
function windowsWindowOptions(quiet) {
  nativeTheme.themeSource = 'dark'
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  return { width: Math.min(1280, width), height: Math.min(820, height), autoHideMenuBar: true, skipTaskbar: quiet }
}

// LUMI_SELFTEST_QUIT=1 (scripts/selftest.js, CI): the self-test leaves the app running,
// so quit when it reports: exit code 0 after SELFTEST done, 1 when it threw (SELFTEST
// FAIL …) or any check printed a FAIL line, and 2 when it has not finished after
// LUMI_SELFTEST_TIMEOUT seconds (default 300).
function watchSelfTest() {
  if (process.env.LUMI_SELFTEST_QUIT !== '1') return () => {}
  let failed = 0
  let quitting = false
  const quit = (code, why) => {
    if (quitting) return
    quitting = true
    log('[selftest] ' + why + ': quitting with exit code ' + code + ' (LUMI_SELFTEST_QUIT)')
    setTimeout(() => app.exit(code), 300)
  }
  const limit = numberEnv('LUMI_SELFTEST_TIMEOUT', 300, 10, 3600)
  setTimeout(() => quit(2, 'no SELFTEST done after ' + limit + ' s'), limit * 1000).unref()
  return (text) => {
    if (!/^SELFTEST /.test(text)) return
    if (/\bFAIL\b/.test(text)) failed++
    if (text.startsWith('SELFTEST FAIL')) quit(1, 'the self-test failed')
    else if (text === 'SELFTEST done') quit(failed ? 1 : 0, failed ? 'done, with ' + failed + ' FAIL line' + (failed === 1 ? '' : 's') : 'done')
  }
}

async function openWindow() {
  // blocksd runs on macOS and Linux only: on Windows it is never started or restarted, and
  // the keys light over MIDI. The page still uses a blocksd that is already running on
  // port 9010. LUMI_NO_KEYBOARD runs (tests, clips) keep off the keyboard and blocksd.
  if (IS_WIN) log('[daemon] Windows: blocksd is not started (it runs on macOS and Linux); the keys light over MIDI')
  else if (process.env.LUMI_NO_KEYBOARD === '1') log('[daemon] LUMI_NO_KEYBOARD: not checking blocksd')
  else startLedWatchdog()
  const port = await serve()
  // Web MIDI + SysEx, the camera (hand tracking) and the rest are granted to this app's
  // own page only, never to another origin
  const own = (url) => { try { return new URL(url).origin === `http://127.0.0.1:${port}` } catch (_e) { return false } }
  session.defaultSession.setPermissionRequestHandler((wc, _permission, cb, details) => cb(own((details && details.requestingUrl) || (wc && wc.getURL()))))
  session.defaultSession.setPermissionCheckHandler((_wc, _permission, origin) => own(origin))
  const takes = handleTakeDownloads(port)
  // Test, screenshot and self-test runs must not take the screen from whatever the
  // user is doing (a game, say): no Dock icon, and the window is shown invisible and
  // without activating the app. capturePage still sees the page at full opacity.
  const QUIET = !!(process.env.LUMI_SHOT || process.env.LUMI_FRAMES || process.env.LUMI_SELFTEST || process.env.LUMI_USERDATA)
  if (QUIET && app.dock) app.dock.hide()
  const win = new BrowserWindow({
    width: 1280, height: 820, backgroundColor: '#151245',
    title: 'Keylight',
    show: !QUIET,
    ...(IS_WIN ? windowsWindowOptions(QUIET) : {}),
    webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false }
  })
  saveTakeOnClose(win, takes)
  if (QUIET) {
    win.setOpacity(0)
    win.once('ready-to-show', () => win.showInactive())
    // and silent, unless a run asks for sound (LUMI_SOUND=1)
    if (!process.env.LUMI_SOUND) win.webContents.setAudioMuted(true)
    log('[quiet] hidden window, sound ' + (win.webContents.isAudioMuted() ? 'muted' : 'on (LUMI_SOUND)'))
  }
  let query = process.env.LUMI_SELFTEST ? '?selftest=1' : ''
  if (process.env.LUMI_QUERY) query = '?' + process.env.LUMI_QUERY
  if (process.env.LUMI_NO_KEYBOARD === '1') query += (query ? '&' : '?') + 'nokb=1'
  win.loadURL(`http://127.0.0.1:${port}/index.html${query}`)

  const framesDir = process.env.LUMI_FRAMES
  const shotFile = process.env.LUMI_SHOT
  if (framesDir || shotFile) {
    win.webContents.once('did-finish-load', async () => {
      await sleep(Number(process.env.LUMI_SHOT_DELAY || 3000))
      if (framesDir) {
        await captureFrames(win, framesDir, numberEnv('LUMI_FRAMES_FPS', 15, 1, 60), numberEnv('LUMI_FRAMES_SECONDS', 12, 0.1, 600))
      } else {
        await captureShot(win, shotFile)
      }
      app.quit()
    })
  }
  // Electron 35+ puts the text on the event; older ones passed it as an argument
  const selfTest = watchSelfTest()
  win.webContents.on('console-message', (e, _level, message) => {
    const text = e && e.message !== undefined ? e.message : message
    log('[renderer] ' + text)
    selfTest(String(text))
  })
}

module.exports = { WATCHDOG, createLedWatchdog, countDiscoveredDevices, keyboardOnUsb, discoverLedDevices, portOpen, isTakeDownload }

if (app) startApp()
