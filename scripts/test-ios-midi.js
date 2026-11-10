// Run with node scripts/test-ios-midi.js. The JS side of the iPhone/iPad app against a fake host (the Swift host speaks the
// Android JSON RPC; see ios/Keylight/BridgeMessage.swift and MidiBridge.swift, tested by xcodebuild test).
const assert = require('node:assert/strict')
const { pathToFileURL } = require('node:url')
const path = require('node:path')
const load = (file) => import(pathToFileURL(path.join(__dirname, '..', 'renderer', file)).href)

const ports = [{ id: '0123456789ab:input', type: 'input', name: 'Piano', portName: 'Piano', transport: 'usb', manufacturer: 'Test', version: '' },
  { id: 'ba9876543210:output', type: 'output', name: 'Piano', portName: 'Piano', transport: 'usb', manufacturer: 'Test', version: '' }]
const log = []
let respond = (message) => (message.op === 'list' ? ports : true)
globalThis.KeylightNative = { postMessage(raw) {
  const message = JSON.parse(raw)
  log.push(message)
  queueMicrotask(() => {
    try { globalThis.__keylightNativeReceive({ id: message.id, result: respond(message) }) }
    catch (error) { globalThis.__keylightNativeReceive({ id: message.id, error: error.message }) }
  })
} }

async function main() {
  const realError = console.error; console.error = () => {}   // the adapter logs host errors; expected here
  const ios = await load('ios-midi.js')
  const android = await load('android-midi.js')
  assert.equal(ios.requestMIDIAccess, android.requestMIDIAccess, 'one adapter, one bridge')
  const access = await ios.requestMIDIAccess()
  assert.deepEqual([...access.inputs.keys()], [ports[0].id]); assert.deepEqual([...access.outputs.keys()], [ports[1].id])
  const input = access.inputs.get(ports[0].id), output = access.outputs.get(ports[1].id)

  // requests carry the exact shape the Swift validator accepts
  const seen = []
  input.onmidimessage = (event) => seen.push([...event.data])
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.deepEqual(log.at(-1), { id: log.at(-1).id, op: 'open', port: ports[0].id })
  globalThis.__keylightNativeReceive({ kind: 'data', port: input.id, bytes: [0x90, 60] })
  globalThis.__keylightNativeReceive({ kind: 'data', port: input.id, bytes: [100, 61, 0, 0xf0, 1, 2] })
  globalThis.__keylightNativeReceive({ kind: 'data', port: input.id, bytes: [3, 0xf7, 0xf8] })
  assert.deepEqual(seen, [[0x90, 60, 100], [0x90, 61, 0], [0xf0, 1, 2, 3, 0xf7], [0xf8]])
  output.send([0x90, 64, 100], performance.now() + 20)
  await new Promise((resolve) => setTimeout(resolve, 0))
  const sent = log.at(-1)
  assert.deepEqual(Object.keys(sent).sort(), ['bytes', 'delay', 'id', 'op', 'port']); assert.equal(sent.op, 'send'); assert.deepEqual(sent.bytes, [0x90, 64, 100]); assert.ok(sent.delay >= 0 && sent.delay <= 20)
  for (const op of log) assert.match(op.port ?? 'x:input', /^[0-9a-f]{12}:(input|output)$|^x:input$/)
  // validation on this side too
  assert.throws(() => output.send([]), TypeError); assert.throws(() => output.send([256]), TypeError); assert.throws(() => output.send([1.5]), TypeError)
  assert.throws(() => output.send(new Array(65537).fill(1)), TypeError); assert.throws(() => output.send([1], NaN), TypeError)
  assert.throws(() => input.send([1]), { name: 'InvalidStateError' })
  // a host error rejects, and the page hears it as an error event
  let failed
  access.onerror = (error) => { failed = error }
  respond = () => { throw new Error('MIDI device disconnected') }
  output.send([0x90, 1, 1]); await new Promise((resolve) => setTimeout(resolve, 5))
  assert.equal(failed.message, 'MIDI device disconnected')
  respond = (message) => (message.op === 'list' ? ports : true)
  // native error event
  failed = null
  globalThis.__keylightNativeReceive({ kind: 'error', error: 'MIDI input overflowed; 3 messages dropped' })
  assert.match(failed.message, /overflowed/)
  // hot-plug: a keyboard appears, then everything goes
  const changes = []
  access.onstatechange = (event) => changes.push([event.port.id, event.port.state])
  const added = { id: 'aaaaaaaaaaaa:input', type: 'input', name: 'Bluetooth keyboard', transport: 'ble', manufacturer: '', version: '' }
  globalThis.__keylightNativeReceive({ kind: 'ports', ports: [...ports, added] })
  assert.ok(access.inputs.has(added.id)); assert.ok(changes.some(([id]) => id === added.id))
  globalThis.__keylightNativeReceive({ kind: 'ports', ports: [] })
  assert.equal(access.inputs.size + access.outputs.size, 0); assert.equal(input.state, 'disconnected')
  assert.throws(() => output.send([0x90, 1, 1]), { name: 'InvalidStateError' })
  globalThis.__keylightNativeReceive({ kind: 'ports', ports })
  assert.equal(access.inputs.get(ports[0].id).state, 'connected')
  // events of other bridge consumers (audio) are ignored by the MIDI adapter and reach subscribers
  const heard = []
  const stop = ios.onNativeEvent((event) => heard.push(event.kind))
  globalThis.__keylightNativeReceive({ kind: 'audio', state: 'resume' }); stop()
  assert.ok(heard.includes('audio'))
  // pairing sheet request
  assert.equal(await ios.pairBluetooth(), true); assert.equal(log.at(-1).op, 'blePair')
  console.error = realError
  console.log('iOS MIDI: shared adapter, request shapes, stream parsing, send validation, errors, hotplug and pairing passed')
}

async function exports() {
  const { exportBlob, safeName } = await load('ios-export.js')
  const transfers = new Map(), saved = []
  respond = (message) => {
    switch (message.op) {
      case 'exportBegin': assert.match(message.name, /^[A-Za-z0-9][A-Za-z0-9._ -]{0,127}$/); assert.match(message.mime, /^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/); transfers.set(String(message.id), { ...message, chunks: [] }); return String(message.id)
      case 'exportChunk': { const bytes = Buffer.from(message.data, 'base64'); assert.ok(bytes.length <= 32768); transfers.get(message.token).chunks.push(bytes); return true }
      case 'exportFinish': { const t = transfers.get(message.token); saved.push({ name: t.name, mime: t.mime, bytes: Buffer.concat(t.chunks) }); return true }
      default: return true
    }
  }
  const bytes = Uint8Array.from({ length: 70001 }, (_, i) => i % 256)
  await exportBlob(new Blob([bytes], { type: 'video/mp4;codecs=avc1' }), 'Take: Für Elise.mp4')
  assert.equal(saved[0].name, 'Take- Fur Elise.mp4'); assert.equal(saved[0].mime, 'video/mp4'); assert.deepEqual(saved[0].bytes, Buffer.from(bytes))
  await exportBlob(new Blob(['x']), 'a.bin'); assert.equal(saved[1].mime, 'application/octet-stream')
  for (const hostile of ['../../etc/passwd', '.hidden', '', '///', 'a..b', 'é']) assert.match(safeName(hostile), /^[A-Za-z0-9][A-Za-z0-9._ -]*$/, hostile)
  assert.ok(!safeName('a..b').includes('..'))
  await assert.rejects(exportBlob({ size: 256 * 1024 * 1024 + 1, type: '' }, 'big.mp4'), RangeError)
  respond = (message) => { if (message.op === 'exportChunk') throw new Error('Invalid export data'); return message.op === 'exportBegin' ? 'tokentoken' : true }
  const before = log.length
  await assert.rejects(exportBlob(new Blob(['x']), 'a.bin'), /Invalid export data/)
  assert.equal(log.at(-1).op, 'exportAbort'); assert.ok(log.length > before)
  respond = (message) => (message.op === 'list' ? ports : true)
  console.log('iOS export: chunked delivery, name and MIME tidying, size limit and abort on failure passed')
}

async function pairing() {
  const { mountPairing } = await load('ios-ble.js')
  class Node { constructor(tag) { this.tag = tag; this.kids = []; this.attrs = {}; this.classes = new Set(); this.className = '' }
    setAttribute(k, v) { this.attrs[k] = v; if (k === 'id') this.id = v }
    append(...k) { this.kids.push(...k) }
    get classList() { return { toggle: (c, on) => (on ? this.classes.add(c) : this.classes.delete(c)), contains: (c) => this.classes.has(c) || this.className.split(' ').includes(c) } }
    insertAdjacentElement(where, el) { this.inserted = (this.inserted || []).concat([[where, el]]) } }
  globalThis.MutationObserver = class { observe() {} }
  const anchor = new Node('p'); anchor.id = 'kbHelp'; anchor.classes.add('hidden')
  const doc = { createElement: (t) => new Node(t), getElementById: (id) => (id === 'kbHelp' ? anchor : null) }
  const notes = []
  const mounted = mountPairing({ host: { request: (op) => { notes.push(op); return Promise.resolve(false) } }, notify: (m) => notes.push(m), doc })
  assert.deepEqual(anchor.inserted.map(([w]) => w), ['beforebegin', 'afterend'])
  assert.equal(mounted.hint.classes.has('hidden'), true)
  anchor.classes.delete('hidden'); await mounted.pair()
  assert.deepEqual(notes, ['blePair', 'Close the other sheet first, then try again'])
  console.log('iOS pairing: button asks the host for the system sheet and reports a busy screen')
}

// The Xcode build phase must put every renderer file (the 76 illustrated covers above all) into the app's web folder.
function bundle() {
  const fs = require('node:fs'), os = require('node:os'), { spawnSync } = require('node:child_process')
  const root = path.join(__dirname, '..')
  const probe = spawnSync('sh', ['-c', 'command -v rsync && command -v perl'])
  if (probe.status !== 0) { console.log('iOS bundle copy: skipped (rsync or perl missing)'); return }
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'kl-bundle-'))
  try {
    const run = spawnSync('bash', [path.join(root, 'ios', 'scripts', 'bundle-renderer.sh')], { env: { ...process.env, SRCROOT: path.join(root, 'ios'), TARGET_BUILD_DIR: out, UNLOCALIZED_RESOURCES_FOLDER_PATH: 'Keylight.app' }, encoding: 'utf8' })
    assert.equal(run.status, 0, run.stderr)
    const web = path.join(out, 'Keylight.app', 'web', 'renderer')
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)).map((f) => path.join(e.name, f)) : [e.name]))
    const wanted = walk(path.join(root, 'renderer')).filter((f) => !f.endsWith('.cjs') && path.basename(f) !== 'package.json' && path.basename(f) !== '.DS_Store')
    const missing = wanted.filter((f) => !fs.existsSync(path.join(web, f)))
    assert.deepEqual(missing, [], 'files missing from the bundle')
    const covers = fs.readdirSync(path.join(root, 'renderer', 'covers')).filter((f) => f.endsWith('.png'))
    assert.ok(covers.length >= 70, 'the repository has its cover art')
    for (const f of covers) assert.equal(fs.statSync(path.join(web, 'covers', f)).size, fs.statSync(path.join(root, 'renderer', 'covers', f)).size, f)
    assert.ok(!walk(web).some((f) => f.endsWith('.cjs')), 'desktop-only files stay out')
    assert.match(fs.readFileSync(path.join(web, 'index.html'), 'utf8'), /ios-host\.js/)
    console.log(`iOS bundle copy: ${wanted.length} renderer files, ${covers.length} covers, bootstrap added`)
  } finally { fs.rmSync(out, { recursive: true, force: true }) }
}

main().then(exports).then(pairing).then(bundle).catch((error) => { console.error(error); process.exit(1) })
