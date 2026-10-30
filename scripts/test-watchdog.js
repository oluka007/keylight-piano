// Unit test for the blocksd watchdog in main.js: node scripts/test-watchdog.js
// Drives its decisions with fake discover replies, fake `ioreg` output and a fake
// clock, then checks the real WebSocket probe against a fake blocksd on a random
// port (the real daemon on 9010 is never touched).
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const http = require('node:http')
const path = require('node:path')
const { WATCHDOG, createLedWatchdog, countDiscoveredDevices, keyboardOnUsb, discoverLedDevices, portOpen } =
  require(path.join(__dirname, '..', 'main.js'))

// A reply shaped like blocksd's (the uid is 64-bit: JSON.parse rounds it, which is fine for counting)
const REPLY_DEVICE = '{"type":"discover_response","devices":[{"uid":12345678901234567890,"serial":"LKBTESTSERIAL000",' +
  '"block_type":"lumi_keys","name":"\\u0000","battery_level":31,"battery_charging":true,"grid_width":0,"grid_height":0,' +
  '"key_count":24,"firmware_version":"1.3.4\\u0000"}],"id":"watchdog"}'
const REPLY_NONE = '{"type":"discover_response","devices":[],"id":"watchdog"}'
const IOREG_KEYBOARD = `+-o Root  <class IORegistryEntry, id 0x100000100, retain 32>
  +-o AppleT8112USBXHCI@00000000  <class AppleT8112USBXHCI, id 0x1000002f4, registered, matched, active, busy 0 (2 ms), retain 72>
  | +-o LUMI Keys BLOCK@01100000  <class IOUSBHostDevice, id 0x100231a6e, registered, matched, active, busy 0 (950 ms), retain 36>
  +-o AppleT8112USBXHCI@01000000  <class AppleT8112USBXHCI, id 0x1000002f8, registered, matched, active, busy 0 (1 ms), retain 60>
    +-o USB Receiver@01100000  <class IOUSBHostDevice, id 0x100002a11, registered, matched, active, busy 0 (12 ms), retain 30>
`
const IOREG_NO_KEYBOARD = IOREG_KEYBOARD.split('\n').filter((l) => !l.includes('LUMI')).join('\n') +
  '    +-o Digital Piano MIDI@01200000  <class IOUSBHostDevice, id 0x100002b22, registered, matched, active, busy 0 (3 ms), retain 22>\n'

const tests = []
const test = (name, fn) => tests.push({ name, fn })

// A watchdog wired to fakes. h.at(seconds) runs one check at that time and returns its outcome.
function harness() {
  const h = { clock: 0, reply: REPLY_DEVICE, port: true, usb: IOREG_KEYBOARD, starts: [], restarts: [], logs: [] }
  const dog = createLedWatchdog({
    probe: async () => h.reply,
    portOpen: async () => h.port,
    readUsb: async () => h.usb,
    start: async () => { h.starts.push(h.clock / 1000) },
    restart: async () => { h.restarts.push(h.clock / 1000) },
    now: () => h.clock,
    log: (m) => h.logs.push(m)
  })
  h.at = (seconds) => { h.clock = seconds * 1000; return dog.tick() }
  // checks every 20 s from `from` to `to` inclusive; returns the outcome at each
  h.run = async (from, to) => {
    const out = {}
    for (let s = from; s <= to; s += WATCHDOG.everyMs / 1000) out[s] = await h.at(s)
    return out
  }
  return h
}

test('timings are the ones asked for', () => {
  assert.equal(WATCHDOG.everyMs, 20000)
  assert.equal(WATCHDOG.missingMs, 60000)
  assert.equal(WATCHDOG.restartGapMs, 180000)
})

test('discover replies are counted', () => {
  assert.equal(countDiscoveredDevices(REPLY_DEVICE), 1)
  assert.equal(countDiscoveredDevices(REPLY_NONE), 0)
  assert.equal(countDiscoveredDevices('{"type":"discover_response","devices":[{"uid":1},{"uid":2}]}'), 2)
  assert.equal(countDiscoveredDevices('{"type":"discover_response"}'), 0)
  assert.equal(countDiscoveredDevices('{"type":"error","message":"unknown type: discover"}'), 0)
  assert.equal(countDiscoveredDevices('{"type":"pong","devices":[{"uid":1}]}'), 0)
  assert.equal(countDiscoveredDevices('not json'), 0)
  assert.equal(countDiscoveredDevices(''), 0)
})

test('ioreg output is searched for the keyboard', () => {
  assert.equal(keyboardOnUsb(IOREG_KEYBOARD), true)
  assert.equal(keyboardOnUsb(IOREG_NO_KEYBOARD), false)
  assert.equal(keyboardOnUsb('  +-o ROLI Piano M@01100000  <class IOUSBHostDevice>'), true)
  assert.equal(keyboardOnUsb(''), false)
  assert.equal(keyboardOnUsb(null), false)
})

test('a healthy daemon is left alone and logged once', async () => {
  const h = harness()
  const out = await h.run(0, 600)
  assert.ok(Object.values(out).every((o) => o === 'ok'))
  assert.deepEqual(h.restarts, [])
  assert.deepEqual(h.starts, [])
  assert.deepEqual(h.logs, ['[watchdog] blocksd sees 1 device'])
})

test('keyboard drops off while on USB: restart after a minute of misses', async () => {
  const h = harness()
  assert.equal(await h.at(0), 'ok')
  h.reply = REPLY_NONE
  assert.deepEqual(await h.run(20, 60), { 20: 'missing', 40: 'missing', 60: 'missing' })
  assert.equal(await h.at(80), 'restart')
  assert.deepEqual(h.restarts, [80])
  h.reply = REPLY_DEVICE
  assert.equal(await h.at(100), 'ok')
  assert.ok(h.logs.some((l) => /restarting blocksd/.test(l) && /60 s/.test(l)))
  assert.equal(h.logs.at(-1), '[watchdog] blocksd sees 1 device')
})

test('keyboard switched off or unplugged: never restart', async () => {
  const h = harness()
  h.reply = REPLY_NONE
  h.usb = IOREG_NO_KEYBOARD
  const out = await h.run(0, 900)
  assert.ok(Object.values(out).every((o) => o === 'unplugged'))
  assert.deepEqual(h.restarts, [])
  assert.equal(h.logs.length, 1)
})

test('restarts are at least 3 minutes apart', async () => {
  const h = harness()
  h.reply = REPLY_NONE
  const out = await h.run(0, 500)
  assert.deepEqual(h.restarts, [60, 240, 420])
  assert.equal(out[140], 'waiting')
  assert.equal(out[220], 'waiting')
  // the missing minute starts again after each restart
  assert.deepEqual([out[80], out[100], out[120]], ['missing', 'missing', 'missing'])
})

test('the minute only counts while the keyboard is on USB', async () => {
  const h = harness()
  h.reply = REPLY_NONE
  assert.equal(await h.at(0), 'missing')
  assert.equal(await h.at(20), 'missing')
  h.usb = IOREG_NO_KEYBOARD
  assert.equal(await h.at(40), 'unplugged')
  h.usb = IOREG_KEYBOARD
  assert.deepEqual(await h.run(60, 100), { 60: 'missing', 80: 'missing', 100: 'missing' })
  assert.equal(await h.at(120), 'restart')
  assert.deepEqual(h.restarts, [120])
})

test('a device seen in between resets the minute', async () => {
  const h = harness()
  h.reply = REPLY_NONE
  await h.run(0, 40)
  h.reply = REPLY_DEVICE
  assert.equal(await h.at(50), 'ok')
  h.reply = REPLY_NONE
  assert.deepEqual(await h.run(60, 100), { 60: 'missing', 80: 'missing', 100: 'missing' })
  assert.equal(await h.at(120), 'restart')
})

test('a daemon that does not answer counts as listing nothing', async () => {
  const h = harness()
  h.reply = null
  h.port = true
  assert.deepEqual(await h.run(0, 40), { 0: 'missing', 20: 'missing', 40: 'missing' })
  assert.equal(await h.at(60), 'restart')
  assert.deepEqual(h.starts, [])
  assert.match(h.logs[0], /does not answer/)
})

test('unreadable replies count as listing nothing', async () => {
  const h = harness()
  h.reply = '{"type":"error","message":"boom"}'
  await h.run(0, 40)
  assert.equal(await h.at(60), 'restart')
})

test('a stopped daemon is started at once, then at most every 3 minutes', async () => {
  const h = harness()
  h.reply = null
  h.port = false
  const out = await h.run(0, 400)
  assert.equal(out[0], 'start')
  assert.equal(out[20], 'down')
  assert.deepEqual(h.starts, [0, 180, 360])
  assert.deepEqual(h.restarts, [])
  // started, then comes up without the keyboard: the restart rule takes over
  const g = harness()
  g.reply = null
  g.port = false
  assert.equal(await g.at(0), 'start')
  g.reply = REPLY_NONE
  g.port = true
  assert.deepEqual(await g.run(20, 60), { 20: 'missing', 40: 'missing', 60: 'missing' })
  assert.equal(await g.at(80), 'restart')
})

// ---- the real probe against a fake blocksd ---------------------------------

// Minimal WebSocket server: answers discover per `mode` ('device', 'none', 'silent').
function fakeBlocksd(mode) {
  const received = []
  const server = http.createServer((_req, res) => { res.writeHead(404); res.end() })
  const sockets = new Set()
  server.on('upgrade', (req, socket) => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
    if (req.url !== '/ws') { socket.destroy(); return }
    const accept = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64')
    socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`)
    let buf = Buffer.alloc(0)
    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk])
      for (let frame; (frame = readClientFrame(buf)); buf = frame.rest) {
        if (frame.opcode === 8) { socket.end(); return }
        if (frame.opcode !== 1) continue
        const msg = JSON.parse(frame.payload.toString())
        received.push(msg)
        if (msg.type === 'discover' && mode !== 'silent') socket.write(textFrame(mode === 'device' ? REPLY_DEVICE : REPLY_NONE))
      }
    })
    socket.on('error', () => {})
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({
    port: server.address().port,
    received,
    close: () => { for (const s of sockets) s.destroy(); return new Promise((r) => server.close(r)) }
  })))
}

function readClientFrame(buf) {
  if (buf.length < 2) return null
  let len = buf[1] & 0x7f
  let off = 2
  if (len === 126) { if (buf.length < 4) return null; len = buf.readUInt16BE(2); off = 4 }
  else if (len === 127) { if (buf.length < 10) return null; len = Number(buf.readBigUInt64BE(2)); off = 10 }
  const masked = (buf[1] & 0x80) !== 0
  const mask = masked ? buf.subarray(off, off + 4) : null
  if (masked) off += 4
  if (buf.length < off + len) return null
  const payload = Buffer.from(buf.subarray(off, off + len))
  if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3]
  return { opcode: buf[0] & 0x0f, payload, rest: buf.subarray(off + len) }
}

function textFrame(text) {
  const payload = Buffer.from(text)
  const header = payload.length < 126 ? Buffer.from([0x81, payload.length]) : Buffer.from([0x81, 126, payload.length >> 8, payload.length & 255])
  return Buffer.concat([header, payload])
}

async function closedPort() {
  const s = http.createServer()
  await new Promise((r) => s.listen(0, '127.0.0.1', r))
  const port = s.address().port
  await new Promise((r) => s.close(r))
  return port
}

test('probe: the reply lists the keyboard', async () => {
  const fake = await fakeBlocksd('device')
  try {
    const text = await discoverLedDevices(`ws://127.0.0.1:${fake.port}/ws`, 2000)
    assert.equal(countDiscoveredDevices(text), 1)
    assert.deepEqual(fake.received, [{ type: 'discover', id: 'watchdog' }])
    assert.equal(await portOpen(fake.port), true)
  } finally { await fake.close() }
})

test('probe: the reply lists nothing', async () => {
  const fake = await fakeBlocksd('none')
  try {
    assert.equal(countDiscoveredDevices(await discoverLedDevices(`ws://127.0.0.1:${fake.port}/ws`, 2000)), 0)
  } finally { await fake.close() }
})

test('probe: a daemon that never answers times out', async () => {
  const fake = await fakeBlocksd('silent')
  try {
    const t0 = Date.now()
    assert.equal(await discoverLedDevices(`ws://127.0.0.1:${fake.port}/ws`, 800), null)
    assert.ok(Date.now() - t0 >= 750, 'waited for the timeout')
    assert.equal(fake.received.length, 1)
  } finally { await fake.close() }
})

test('probe: nothing listening gives null quickly', async () => {
  const port = await closedPort()
  const t0 = Date.now()
  assert.equal(await discoverLedDevices(`ws://127.0.0.1:${port}/ws`, 3000), null)
  assert.ok(Date.now() - t0 < 2000, 'did not wait for the timeout')
  assert.equal(await portOpen(port), false)
})

;(async () => {
  let failed = 0
  for (const { name, fn } of tests) {
    try { await fn(); console.log('ok   ' + name) } catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + (e && e.stack || e).split('\n').slice(0, 6).join('\n     ')) }
  }
  console.log(`${tests.length - failed}/${tests.length} watchdog tests passed`)
  process.exit(failed ? 1 : 0)
})()
