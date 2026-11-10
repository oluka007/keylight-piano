// Run with node scripts/test-android-midi.js. A wire fake replaces only Android.
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const { pathToFileURL } = require('node:url')

async function main() {
  const source = await fs.readFile(new URL('../renderer/android-midi.js', pathToFileURL(__filename)), 'utf8')
  const { requestMIDIAccess } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
  await assert.rejects(requestMIDIAccess(), { name: 'NotSupportedError' })
  const cases = [
    { chunks: [[0x90, 60], [100, 61, 0]], messages: [[0x90, 60, 100], [0x90, 61, 0]] },
    { chunks: [[0xf0, 1, 0xf8], [2, 0xf7]], messages: [[0xf8], [0xf0, 1, 2, 0xf7]] },
    { chunks: [[0xc2, 7, 8, 0xd2, 9]], messages: [[0xc2, 7], [0xc2, 8], [0xd2, 9]] },
    { chunks: [[0x90, 60, 1, 0xf2, 1], [2, 61, 1, 0xf6]], messages: [[0x90, 60, 1], [0xf2, 1, 2], [0xf6]] },
    { chunks: [[0xf0, 1, 0x91, 62, 90]], messages: [[0x91, 62, 90]] },
    { chunks: [[1, 2, 0x80, 60, 0, 0xfe]], messages: [[0x80, 60, 0], [0xfe]] }
  ]
  const received = []
  const cleared = []
  const ports = [{ id: '1:input:0', type: 'input', name: 'USB keyboard', manufacturer: 'Test' },
    { id: '1:output:0', type: 'output', name: 'USB keyboard', manufacturer: 'Test' }]
  globalThis.KeylightNative = { postMessage(raw) {
    const message = JSON.parse(raw)
    if (message.op === 'send') received.push(message.bytes)
    if (message.op === 'clear') cleared.push(message.port)
    queueMicrotask(() => globalThis.__keylightNativeReceive({ id: message.id, result: message.op === 'list' ? ports : true }))
  } }
  const access = await requestMIDIAccess()
  const input = access.inputs.get(ports[0].id), output = access.outputs.get(ports[1].id)
  for (const { chunks, messages } of cases) {
    await input.close()
    const actual = []; input.onmidimessage = (event) => actual.push([...event.data])
    await input.open()
    for (const chunk of chunks) globalThis.__keylightNativeReceive({ kind: 'data', port: input.id, bytes: chunk })
    assert.deepEqual(actual, messages)
  }
  const messages = []; input.onmidimessage = (event) => messages.push([...event.data])
  await input.open()
  globalThis.__keylightNativeReceive({ kind: 'data', port: input.id, bytes: [0x90, 60] })
  globalThis.__keylightNativeReceive({ kind: 'data', port: input.id, bytes: [100, 61, 80] })
  assert.deepEqual(messages, [[0x90, 60, 100], [0x90, 61, 80]])
  output.send([0x90, 64, 100]); output.send([0x80, 64, 0])
  await output.open()
  assert.deepEqual(received, [[0x90, 64, 100], [0x80, 64, 0]])
  output.clear()
  await output.open()
  assert.deepEqual(cleared, [output.id])
  assert.throws(() => output.send([256]), TypeError)
  await input.close()
  globalThis.__keylightNativeReceive({ kind: 'data', port: input.id, bytes: [0x90, 62, 90] })
  assert.equal(messages.length, 2)
  let disconnected
  access.onstatechange = (event) => { disconnected = event.port }
  globalThis.__keylightNativeReceive({ kind: 'ports', ports: [] })
  assert.equal(access.inputs.size + access.outputs.size, 0)
  assert.equal(disconnected.state, 'disconnected')
  assert.throws(() => output.send([0x90, 1, 1]), { name: 'InvalidStateError' })
  globalThis.__keylightNativeReceive({ kind: 'ports', ports })
  const reconnected = access.inputs.get(ports[0].id)
  const afterReconnect = []
  reconnected.onmidimessage = (event) => afterReconnect.push([...event.data])
  await reconnected.open()
  globalThis.__keylightNativeReceive({ kind: 'data', port: reconnected.id, bytes: [1, 2, 0x90, 65, 90] })
  assert.deepEqual(afterReconnect, [[0x90, 65, 90]])
  console.log('Android MIDI: 6 stream cases, native delivery, ordered sends, close and hotplug passed')
  await testExport(source)
  await testBle(source)
  await testHostTools(source)
  testJvm()
}

async function testExport(adapterSource) {
  const bootstrap = await fs.readFile(new URL('../android/host-bootstrap.js', pathToFileURL(__filename)), 'utf8')
  const adapterUrl = `data:text/javascript;base64,${Buffer.from(adapterSource).toString('base64')}`
  const transfers = new Map(), saved = []
  let complete
  globalThis.KeylightNative = { postMessage(raw) {
    const message = JSON.parse(raw)
    let result = true
    switch (message.op) {
      case 'exportBegin': {
        const token = String(message.id)
        transfers.set(token, { name: message.name, mime: message.mime, size: message.size, chunks: [] })
        result = token; break
      }
      case 'exportChunk': {
        const bytes = Buffer.from(message.data, 'base64')
        assert.ok(bytes.length <= 32768)
        transfers.get(message.token).chunks.push(bytes); break
      }
      case 'exportFinish': {
        const transfer = transfers.get(message.token)
        const bytes = Buffer.concat(transfer.chunks)
        assert.equal(bytes.length, transfer.size)
        saved.push({ name: transfer.name, mime: transfer.mime, bytes })
        transfers.delete(message.token); complete?.(); break
      }
      case 'exportAbort': transfers.delete(message.token); break
      default: assert.fail('Unexpected export operation')
    }
    queueMicrotask(() => globalThis.__keylightNativeReceive({ id: message.id, result }))
  } }
  Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true })
  globalThis.HTMLAnchorElement = class { click() { assert.fail('Blob download escaped native handoff') } }
  globalThis.document = { addEventListener() {} }
  globalThis.alert = (message) => assert.fail(message)
  const executable = bootstrap.replace("'./android-midi.js'", JSON.stringify(adapterUrl))
  const { exportBlob } = await import(`data:text/javascript;base64,${Buffer.from(executable).toString('base64')}`)
  const bytes = Uint8Array.from({ length: 70001 }, (_, i) => i % 256)
  await exportBlob(new Blob([bytes], { type: 'video/mp4;codecs=avc1' }), 'take.mp4')
  assert.deepEqual(saved[0], { name: 'take.mp4', mime: 'video/mp4', bytes: Buffer.from(bytes) })
  const completion = new Promise((resolve) => { complete = resolve })
  const anchor = new HTMLAnchorElement()
  anchor.href = URL.createObjectURL(new Blob(['{"notes":3}'], { type: 'application/json' }))
  anchor.download = 'take.json'
  anchor.click(); URL.revokeObjectURL(anchor.href)
  await completion
  assert.deepEqual(saved[1], { name: 'take.json', mime: 'application/json', bytes: Buffer.from('{"notes":3}') })
  await assert.rejects(exportBlob({ size: 256 * 1024 * 1024 + 1 }, 'large.mp4'), RangeError)
  console.log('Android export: bounded multi-chunk byte delivery, MIME, revoked Blob download and size limit passed')
}

async function testBle(adapterSource) {
  const bleSource = await fs.readFile(new URL('../renderer/android-ble.js', pathToFileURL(__filename)), 'utf8')
  const { createBle, phaseOf, validAddress, signal, readLast, LAST_KEY } = await import(`data:text/javascript;base64,${Buffer.from(bleSource).toString('base64')}`)
  const A = 'AA:BB:CC:00:11:22', B = '01:23:45:67:89:AB'
  assert.ok(validAddress(A) && !validAddress('aa:bb:cc:00:11:22') && !validAddress('AA:BB:CC:00:11') && !validAddress('AA:BB:CC:00:11:22;rm') && !validAddress(null))
  assert.deepEqual([signal(-50).bars, signal(-70).bars, signal(-90).bars, signal(null).bars], [3, 2, 1, 0])
  const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) } }
  // A fake native host that enforces what BleMidi.java enforces: the order of preconditions and argument checks.
  const fakeHost = (initial = {}) => {
    const native = { supported: true, enabled: true, permission: 'granted', locationOn: true, scanning: false, connecting: null, connected: null, sdk: 34, ...initial }
    const sent = []; let subscriber = () => {}; let scans = 0
    const push = () => subscriber({ kind: 'bleState', ...native })
    return {
      native, sent, push, event: (e) => subscriber(e),
      subscribe(fn) { subscriber = fn; return () => { subscriber = () => {} } },
      async request(op, args = {}) {
        sent.push({ op, ...args })
        switch (op) {
          case 'bleState': return { kind: 'bleState', ...native }
          case 'blePermission': native.permission = 'granted'; push(); return { ...native }
          case 'bleEnable': native.enabled = true; push(); return { ...native }
          case 'bleOpenSettings': return true
          case 'bleScanStart':
            if (!native.supported) return { ok: false, code: 'unsupported' }
            if (!native.enabled) return { ok: false, code: 'bluetooth-off' }
            if (native.permission !== 'granted') return { ok: false, code: 'permission' }
            if (!native.locationOn) return { ok: false, code: 'location-off' }
            if (++scans > 4) return { ok: false, code: 'rate-limit', message: 'Searched too often: wait half a minute and try again' }
            native.scanning = true; push(); return { ok: true }
          case 'bleScanStop': native.scanning = false; push(); return true
          case 'bleConnect':
            if (!validAddress(args.address)) throw new DOMException('Invalid Bluetooth address', 'OperationError')
            if (!native.enabled) return { ok: false, code: 'bluetooth-off', message: 'Bluetooth is off' }
            if (native.permission !== 'granted') return { ok: false, code: 'permission', message: 'Bluetooth permission is needed' }
            native.connecting = args.address; native.scanning = false; push(); return { ok: true }
          case 'bleDisconnect': native.connecting = null; native.connected = null; push(); return true
          default: throw new DOMException('Unknown Bluetooth operation', 'OperationError')
        }
      }
    }
  }
  // phases
  const phase = (initial) => {
    const host = fakeHost(initial); const ble = createBle({ host, storage: memory() })
    host.push()
    return phaseOf(ble)
  }
  assert.equal(phase({ supported: false }), 'unsupported')
  assert.equal(phase({ enabled: false }), 'off')
  assert.equal(phase({ enabled: false, permission: 'blocked' }), 'blocked')
  assert.equal(phase({ permission: 'needed' }), 'permission')
  assert.equal(phase({ permission: 'blocked' }), 'blocked')
  assert.equal(phase({ locationOn: false, sdk: 29 }), 'location')
  assert.equal(phase({}), 'idle')
  assert.equal(phase({ scanning: true }), 'scanning')
  assert.equal(phase({ connecting: A }), 'connecting')
  assert.equal(phase({ connected: { address: A, name: 'Keys' } }), 'connected')
  assert.equal(phaseOf(createBle({ host: fakeHost(), storage: memory() })), 'checking')

  // scan, devices sorted by signal, scan end, connect, remember
  let host = fakeHost(), storage = memory(), ble = createBle({ host, storage })
  await ble.refresh()
  await ble.scan()
  assert.equal(phaseOf(ble), 'scanning')
  host.event({ kind: 'bleDevice', address: A, name: 'Far keys', rssi: -85, bonded: false, open: false })
  host.event({ kind: 'bleDevice', address: B, name: 'Near keys', rssi: -45, bonded: true, open: false })
  host.event({ kind: 'bleDevice', address: 'not-an-address', name: 'Bad', rssi: -1 })
  assert.deepEqual(ble.devices().map((d) => d.name), ['Near keys', 'Far keys'])
  host.native.scanning = false; host.event({ kind: 'bleScanEnd', reason: 'timeout', count: 2 })
  assert.equal(ble.scanEnd.reason, 'timeout')
  assert.equal(await ble.connect('xx'), null, 'invalid address never reaches native')
  assert.ok(!host.sent.some((m) => m.op === 'bleConnect' && m.address === 'xx'))
  await ble.connect(B)
  assert.equal(phaseOf(ble), 'connecting')
  host.native.connecting = null; host.native.connected = { address: B, name: 'Near keys' }; host.push()
  assert.equal(phaseOf(ble), 'connected')
  assert.deepEqual(readLast(storage), { address: B, name: 'Near keys' })
  // unexpected loss versus a deliberate disconnect
  host.native.connected = null; host.push()
  assert.equal(ble.lost, true)
  host.native.connected = { address: B, name: 'Near keys' }; host.push()
  assert.equal(ble.lost, false)
  await ble.disconnect()
  assert.equal(ble.lost, false)
  // a manual disconnect cancels a pending automatic reconnect
  { let fired = null, cleared = false
    const h = fakeHost(); const b = createBle({ host: h, storage: memory(), setTimer: (fn) => { fired = fn; return 7 }, clearTimer: () => { cleared = true; fired = null } })
    b.scheduleAuto(100); await b.disconnect(); assert.ok(cleared && fired === null) }
  // forget removes the remembered address and disconnects
  await ble.forget()
  assert.equal(storage.getItem(LAST_KEY), null)
  assert.equal(ble.last, null)

  // errors: a manual failure is shown, an automatic one stays silent
  host = fakeHost(); ble = createBle({ host, storage: memory() })
  host.event({ kind: 'bleError', code: 'connect-timeout', message: 'The keyboard did not answer', address: A, auto: false })
  assert.equal(ble.failure, 'The keyboard did not answer')
  host = fakeHost(); ble = createBle({ host, storage: memory() })
  host.event({ kind: 'bleError', code: 'connect-failed', message: 'x', address: A, auto: true })
  assert.equal(ble.failure, '')
  // permission refusal on a manual connect surfaces the message; scan rate limit too
  host = fakeHost({ permission: 'needed' }); ble = createBle({ host, storage: memory() }); await ble.refresh()
  await ble.connect(A)
  assert.equal(ble.failure, 'Bluetooth permission is needed')
  await ble.allow(); assert.equal(ble.state.permission, 'granted')
  host = fakeHost(); ble = createBle({ host, storage: memory() }); await ble.refresh()
  for (let i = 0; i < 4; i++) await ble.scan()
  await ble.scan()
  assert.match(ble.failure, /too often/)
  // scan while Bluetooth is off falls back to the state that says what to do
  host = fakeHost({ enabled: false }); ble = createBle({ host, storage: memory() }); await ble.refresh()
  await ble.scan(); assert.equal(phaseOf(ble), 'off')
  await ble.turnOn(); assert.equal(phaseOf(ble), 'idle')

  // auto-reconnect never prompts and only runs when everything is already allowed
  const withLast = (initial) => { const st = memory(); st.setItem(LAST_KEY, JSON.stringify({ address: A, name: 'Keys' })); const h = fakeHost(initial); return { h, ble: createBle({ host: h, storage: st }) } }
  for (const initial of [{ enabled: false }, { permission: 'needed' }, { permission: 'blocked' }, { supported: false }, { connecting: B }, { connected: { address: B, name: 'k' } }]) {
    const { h, ble: b } = withLast(initial)
    assert.equal(await b.autoReconnect(), false)
    assert.ok(!h.sent.some((m) => ['bleConnect', 'blePermission', 'bleEnable', 'bleScanStart', 'bleOpenSettings'].includes(m.op)), JSON.stringify(initial))
  }
  const none = createBle({ host: fakeHost(), storage: memory() })
  assert.equal(await none.autoReconnect(), false)
  { const { h, ble: b } = withLast({})
    assert.equal(await b.autoReconnect(), true)
    assert.deepEqual(h.sent.filter((m) => m.op === 'bleConnect'), [{ op: 'bleConnect', address: A, auto: true }])
    h.native.connecting = null; h.push()
    for (let i = 0; i < 3; i++) { await b.autoReconnect(); h.native.connecting = null; h.push() }
    assert.equal(h.sent.filter((m) => m.op === 'bleConnect').length, 3, 'automatic attempts are bounded')
    h.native.connected = { address: A, name: 'Keys' }; h.push()   // success resets the budget
  }
  // a stored value that is not an address is ignored
  const bad = memory(); bad.setItem(LAST_KEY, JSON.stringify({ address: 'zz', name: 'x' }))
  assert.equal(readLast(bad), null)

  // the adapter: BLE events reach subscribers, and a Bluetooth port syncs like a USB one
  globalThis.KeylightNative = { postMessage(raw) {
    const message = JSON.parse(raw)
    queueMicrotask(() => globalThis.__keylightNativeReceive({ id: message.id, result: message.op === 'list' ? [] : true }))
  } }
  const adapterUrl = `data:text/javascript;base64,${Buffer.from(adapterSource + '\n// ble').toString('base64')}`
  const adapter = await import(adapterUrl)
  const heard = []; const stop = adapter.onNativeEvent((e) => heard.push(e.kind))
  const access = await adapter.requestMIDIAccess()
  globalThis.__keylightNativeReceive({ kind: 'bleState', supported: true })
  globalThis.__keylightNativeReceive({ kind: 'ports', ports: [{ id: '7:input:0', type: 'input', name: 'Keys', transport: 'ble', address: A }, { id: '7:output:0', type: 'output', name: 'Keys', transport: 'ble', address: A }] })
  assert.deepEqual(heard, ['bleState', 'ports'])
  assert.equal(access.inputs.get('7:input:0').transport, 'ble')
  stop(); globalThis.__keylightNativeReceive({ kind: 'bleState' }); assert.equal(heard.length, 2)
  console.log('Android Bluetooth: phases, scan, connect, remember/forget, errors, rate limit, bounded silent auto-reconnect and BLE ports passed')
}

// Link, clipboard and USB bridge methods: the page-side rules, the same rules as the desktop allow-list, and (when a JDK
// is installed) the Java port of them that the host runs again.
async function testHostTools(adapterSource) {
  const read = (path) => fs.readFile(new URL(path, pathToFileURL(__filename)), 'utf8')
  const dataUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
  const policySource = await read('../renderer/host-policy.js')
  const { isAllowedLink, cleanUsb } = await import(dataUrl(policySource))
  const desktop = require('../renderer/external-links.cjs')
  const GOOD = [
    'https://ko-fi.com/scizers', 'https://ko-fi.com/scizers/', 'https://github.com/scizerss/keylight-piano', 'https://github.com/scizerss/keylight-piano/issues',
    'https://github.com/scizerss/keylight-piano/releases', 'https://github.com/scizerss/keylight-piano/releases/latest', 'https://github.com/demixme/GRAB',
    'https://github.com/scizerss/keylight-piano/issues/new?title=Support%20my%20device&body=Report%0A%0Aline',
    'https://github.com/scizerss/keylight-piano/issues/new?body=x&title=y'
  ]
  const BAD = [
    '', 'http://github.com/scizerss/keylight-piano', 'https://github.com.evil.com/scizerss/keylight-piano', 'https://evil.com/https://github.com/scizerss/keylight-piano',
    'https://github.com@evil.com/scizerss/keylight-piano', 'https://user@github.com/scizerss/keylight-piano/issues/new?title=a&body=b',
    'https://github.com:444/scizerss/keylight-piano/issues/new?title=a&body=b', 'https://github.com:443/scizerss/keylight-piano/issues/new?title=a&body=b',
    'https://GITHUB.com/scizerss/keylight-piano', 'https://github.com./scizerss/keylight-piano', 'https://github.com/scizerss/keylight-piano/',
    'https://github.com/scizerss/keylight-piano/issues/', 'https://github.com/scizerss/keylight-piano/issues/new', 'https://github.com/scizerss/keylight-piano/issues/new?',
    'https://github.com/scizerss/keylight-piano/issues/new?title=a', 'https://github.com/scizerss/keylight-piano/issues/new?title=a&body=b&labels=x',
    'https://github.com/scizerss/keylight-piano/issues/new?title=a&title=b', 'https://github.com/scizerss/keylight-piano/issues/new?title=a&body=b#x',
    'https://github.com/scizerss/keylight-piano/issues/new?title=a&body=%2525', 'https://github.com/scizerss/keylight-piano/issues/new?title=a&body=%zz',
    'https://github.com/scizerss/keylight-piano/issues/new?title=a&body=b c', 'https://github.com/scizerss/keylight-piano/issues/new?title=a&body=%e9',
    'https://github.com/scizerss/keylight-piano/issues/new?title=a&body=<b>', 'https://github.com/scizerss/keylight-piano/issues/new?title=&body=b',
    'https://github.com/scizerss/keylight-piano/issues/new?title=a&body=b\\@evil.com', 'https://github.com/scizerss/keylight-piano/issues/new/../../../evil?title=a&body=b',
    'https://github.com/scizerss/keylight-piano/pulls', 'https://github.com/scizerss/keylight-piano/releases/download/x/y.apk',
    'https://ko-fi.com/scizers/shop', 'https://ko-fi.com/other', 'javascript:alert(1)', 'intent://x#Intent;scheme=https;end', 'file:///etc/passwd', 'content://x/y',
    'market://details?id=org.keylight.piano', ' https://ko-fi.com/scizers', 'https://ko-fi.com/scizers\n', 'https://ko-fi.com/scizers?x=1',
    'https://github.com/scizerss/keylight-piano/issues/new?title=a&body=' + 'a'.repeat(2000)
  ]
  for (const url of GOOD) { assert.equal(isAllowedLink(url), true, url); assert.equal(desktop.isAllowedExternalUrl(url), true, url) }
  for (const url of BAD) { assert.equal(isAllowedLink(url), false, JSON.stringify(url)); assert.equal(desktop.isAllowedExternalUrl(url), false, JSON.stringify(url)) }
  for (const value of [null, undefined, 5, {}, [], ['https://ko-fi.com/scizers'], { toString: () => 'https://ko-fi.com/scizers' }]) assert.equal(isAllowedLink(value), false)

  // the Java port agrees on every address
  const { spawnSync } = require('node:child_process'), os = require('node:os'), path = require('node:path'), fsSync = require('node:fs')
  const javac = spawnSync('javac', ['-version'], { encoding: 'utf8' })
  let java = 'skipped (no JDK on the PATH)'
  if (javac.status === 0) {
    const dir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'keylight-link-'))
    try {
      const pkg = path.join(dir, 'org', 'keylight', 'piano'); fsSync.mkdirSync(pkg, { recursive: true })
      fsSync.copyFileSync(path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'java', 'org', 'keylight', 'piano', 'LinkPolicy.java'), path.join(pkg, 'LinkPolicy.java'))
      fsSync.writeFileSync(path.join(pkg, 'LinkCheck.java'), 'package org.keylight.piano;\nimport java.io.*;\npublic class LinkCheck { public static void main(String[] a) throws Exception {\n' +
        ' BufferedReader in = new BufferedReader(new InputStreamReader(System.in, "UTF-8")); String line; StringBuilder out = new StringBuilder();\n' +
        ' while ((line = in.readLine()) != null) { String url = java.net.URLDecoder.decode(line.replace("+", "%2B"), "UTF-8"); out.append(LinkPolicy.allowed(url) ? "1" : "0"); }\n System.out.println(out); } }\n')
      const build = spawnSync('javac', ['-d', dir, path.join(pkg, 'LinkPolicy.java'), path.join(pkg, 'LinkCheck.java')], { encoding: 'utf8' })
      assert.equal(build.status, 0, build.stderr)
      const all = [...GOOD, ...BAD]
      const run = spawnSync('java', ['-cp', dir, 'org.keylight.piano.LinkCheck'], { input: all.map((u) => encodeURIComponent(u)).join('\n') + '\n', encoding: 'utf8' })
      assert.equal(run.status, 0, run.stderr)
      assert.equal(run.stdout.trim(), all.map((u) => (isAllowedLink(u) ? '1' : '0')).join(''), 'Java LinkPolicy and the page rules agree on every address')
      java = 'agrees on ' + all.length + ' addresses'
    } finally { fsSync.rmSync(dir, { recursive: true, force: true }) }
  }

  // the USB answer is rebuilt field by field: a serial, a path or a bad id never gets through
  const hostile = { ok: true, source: 'x', reason: 'y', redact: ['name'], os: { platform: 'darwin', release: '15 (API 35)', arch: 'arm64-v8a', serial: 'S1' },
    devices: [
      { vendorId: '0x2a00', productId: '0x0001', product: 'Piano\u0000 M', manufacturer: 'Maker', bcdDevice: '1.02', class: 'audio', subclass: 3, protocol: 0, serial: 'SECRET123', serialNumber: 'SECRET456', deviceName: '/dev/bus/usb/001/004', location: 'port 3' },
      { vendorId: '2a00', productId: '0x0001' }, { vendorId: '0x2A00', productId: '0x0001' }, { vendorId: '0x2a00', productId: '0x00010' }, null, 'x',
      { vendorId: '0x1111', productId: '0x2222', product: 'x'.repeat(500), bcdDevice: 'v1', class: 'hid', subclass: 999, protocol: -1 }
    ] }
  const clean = cleanUsb(hostile)
  assert.equal(clean.devices.length, 2)
  assert.deepEqual(Object.keys(clean.devices[0]).sort(), ['bcdDevice', 'class', 'manufacturer', 'product', 'productId', 'protocol', 'subclass', 'vendorId'])
  assert.equal(clean.devices[0].product, 'Piano  M')
  assert.equal(clean.devices[1].product.length, 80); assert.equal(clean.devices[1].class, ''); assert.equal(clean.devices[1].bcdDevice, ''); assert.equal(clean.devices[1].subclass, 0)
  assert.equal(clean.os.platform, 'android'); assert.deepEqual(clean.redact, [])
  const text = JSON.stringify(clean)
  for (const secret of ['SECRET123', 'SECRET456', '/dev/bus', 'port 3', 'S1', 'serial', 'location', 'deviceName']) assert.ok(!text.includes(secret), secret)
  for (const bad of [null, undefined, 'x', 5, [], {}, { ok: false, devices: [] }, { ok: true }, { ok: true, devices: 'x' }]) assert.equal(cleanUsb(bad), null)
  assert.equal(cleanUsb({ ok: true, devices: Array.from({ length: 40 }, (_, i) => ({ vendorId: '0x1000', productId: '0x' + (0x2000 + i).toString(16) })) }).devices.length, 12)

  // host-tools.js on a wire fake of the bridge: what it sends, and what it refuses to
  const toolsSource = (await read('../renderer/host-tools.js'))
    .replace(/^import \{ IS_ANDROID \}.*$/m, 'const IS_ANDROID = true')
    .replace(/^import \{ nativeRequest \}.*$/m, 'const nativeRequest = (op, args) => globalThis.__bridge(op, args)')
    .replace(/^import \{ isAllowedLink, cleanUsb \}.*$/m, policySource.replace(/^export /gm, ''))
  const tools = await import(dataUrl(toolsSource))
  const sent = []
  globalThis.window = globalThis
  globalThis.__bridge = async (op, args) => {
    sent.push({ op, ...args })
    if (op === 'deviceUsb') return { ok: true, devices: [{ vendorId: '0x2a00', productId: '0x0001', product: 'Piano M', serial: 'SECRET', bcdDevice: '1.00', class: 'audio' }], os: { release: '14', arch: 'arm64-v8a' } }
    return true
  }
  await tools.copyText('report text')
  assert.deepEqual(sent.pop(), { op: 'clipboard', text: 'report text' })
  assert.equal(tools.openExternal('https://evil.com/'), false); assert.equal(tools.openExternal('javascript:alert(1)'), false); assert.equal(sent.length, 0)
  assert.equal(tools.openExternal('https://github.com/scizerss/keylight-piano/issues/new?title=a&body=b'), true)
  assert.deepEqual(sent.pop(), { op: 'openLink', url: 'https://github.com/scizerss/keylight-piano/issues/new?title=a&body=b' })
  const probe = await tools.usbProbe()
  assert.equal(probe.ok, true); assert.equal(probe.devices[0].vendorId, '0x2a00'); assert.ok(!JSON.stringify(probe).includes('SECRET'))
  globalThis.__bridge = async () => { throw new Error('offline') }
  assert.equal(await tools.usbProbe(), null)
  delete globalThis.__bridge; delete globalThis.window

  // downloads: a title with an apostrophe, an accent or a slash still saves, under a plain name
  const { safeName } = await import(dataUrl(/export function safeName[\s\S]*?\n}\n/.exec(await read('../android/host-bootstrap.js'))[0]))
  {
    assert.equal(safeName("Für Elise - take 1.mp4"), 'Fur Elise - take 1.mp4'); assert.equal(safeName("../../etc/passwd"), 'etc-passwd'); assert.equal(safeName('..'), 'keylight-file')
    assert.ok(/^[A-Za-z0-9][A-Za-z0-9._ -]{0,127}$/.test(safeName("O'Brien: Prelude?.json"))); assert.equal(safeName('x'.repeat(300)).length, 128)
  }
  console.log('Android host tools: link allow-list (' + (GOOD.length + BAD.length) + ' addresses; Java ' + java + '), clipboard, USB descriptors without serials, plain file names passed')
}
const deadline = setTimeout(() => { console.error('Android bridge tests timed out'); process.exit(1) }, 40000)
main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => clearTimeout(deadline))

// Pure host logic (bounded MIDI buffer, Bluetooth attempt state machine, picker URI rules) runs on a plain JVM.
function testJvm() {
  const { spawnSync } = require('node:child_process')
  const os = require('node:os'), path = require('node:path')
  const root = path.join(__dirname, '..')
  let javaHome = process.env.JAVA_HOME
  if (!javaHome) { const r = spawnSync('/usr/libexec/java_home', ['-v', '17'], { encoding: 'utf8' }); if (r.status === 0) javaHome = r.stdout.trim() }
  const bin = (name) => javaHome ? path.join(javaHome, 'bin', name) : name
  if (spawnSync(bin('javac'), ['-version'], { encoding: 'utf8' }).error) { console.log('jvm host logic: skipped (no JDK found)'); return }
  const out = require('node:fs').mkdtempSync(path.join(os.tmpdir(), 'keylight-jvm-'))
  try {
    const dir = path.join(root, 'android/app/src/main/java/org/keylight/piano')
    const compile = spawnSync(bin('javac'), ['-d', out, ...['MidiBuffer', 'PortFeed', 'StagingPolicy', 'AttemptTracker', 'UriPolicy'].map((n) => path.join(dir, n + '.java')), path.join(root, 'android/jvm-test/HostLogicTests.java')], { encoding: 'utf8' })
    assert.equal(compile.status, 0, compile.stdout + compile.stderr)
    const run = spawnSync(bin('java'), ['-ea', '-cp', out, 'org.keylight.piano.HostLogicTests'], { encoding: 'utf8' })
    assert.equal(run.status, 0, run.stdout + run.stderr)
    process.stdout.write(run.stdout)
  } finally { require('node:fs').rmSync(out, { recursive: true, force: true }) }
}
