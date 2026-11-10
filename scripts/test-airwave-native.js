// Tests of the experimental native route through the PRODUCTION code: the compiled helper
// process, renderer/airwave-bridge.cjs and renderer/leap.js.
// PROOF LEVEL: "native ABI fixture". The helper is the real binary. The library it loads is
// native/fake-leapc.c, a stand-in written for these tests; it is NOT Ultraleap's runtime and
// no Airwave or other tracking device is involved. The hand structures it replays are laid
// out here byte by byte from the Apache-2.0 LeapC.cs binding (Pack = 1), independently of
// native/leapc_abi.h, so a wrong header layout fails these tests.
const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn, execFileSync } = require('node:child_process')
const bridgeModule = require('../renderer/airwave-bridge.cjs')

const ROOT = path.join(__dirname, '..')
const mac = process.platform === 'darwin' && process.arch === 'arm64'
const OUT = path.join(ROOT, 'native', 'build', 'darwin-arm64')
const HELPER = path.join(OUT, 'keylight-leap-helper')
const FIXTURE_LIB = path.join(OUT, 'libLeapC-fixture.dylib')
const skip = mac ? false : 'the native helper is built and tested on Apple-silicon macOS only'

if (mac) execFileSync('sh', [path.join(ROOT, 'native', 'build.sh'), '--fixture'], { stdio: 'pipe' })

// ---- independent LEAP_HAND layout (offsets from the binding, not from the header) --------
const HAND = 1084, DIGIT = 184, BONE = 44, FIRST_DIGIT = 120
function hand({ type, confidence, tips }) {
  const b = Buffer.alloc(HAND)
  b.writeUInt32LE(1, 0)                 // id
  b.writeUInt32LE(type, 8)              // eLeapHandType: 0 left, 1 right
  b.writeFloatLE(confidence, 12)
  tips.forEach((tip, finger) => {
    const digit = FIRST_DIGIT + finger * DIGIT
    b.writeInt32LE(finger, digit)       // finger_id
    // bones: metacarpal, proximal, intermediate, distal; each prev_joint, next_joint, width, rotation
    const distal = digit + 4 + 3 * BONE
    tip.forEach((v, axis) => b.writeFloatLE(v, distal + 12 + axis * 4))   // distal.next_joint = fingertip
    tip.forEach((v, axis) => b.writeFloatLE(v - 20, distal + axis * 4))   // prev_joint, deliberately different
  })
  return b
}
function framesFile(frames) {
  const parts = []
  for (const hands of frames) {
    const n = Buffer.alloc(4); n.writeUInt32LE(hands.length); parts.push(n, ...hands.map(hand))
  }
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'keylight-fake-')), 'frames.bin')
  fs.writeFileSync(file, Buffer.concat(parts))
  return file
}
const pose = (rightIndexX) => ({ type: 1, confidence: 0.97, tips: [[-60, 90, 10], [rightIndexX, 22, 5], [40, 80, 5], [60, 80, 5], [80, 80, 5]] })

function lines(env, ms = 4000) {
  return new Promise((resolve) => {
    const child = spawn(HELPER, [], { env: { ...env, PATH: process.env.PATH }, stdio: ['ignore', 'pipe', 'pipe'] })
    let out = '', err = ''
    child.stdout.on('data', (d) => { out += d })
    child.stderr.on('data', (d) => { err += d })
    const timer = setTimeout(() => child.kill(), ms)
    child.on('exit', (code) => { clearTimeout(timer); resolve({ code, err, messages: out.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)), raw: out }) })
  })
}

test('compiled helper uses the structure sizes derived from the LeapC binding', { skip }, async () => {
  const out = JSON.parse(execFileSync(HELPER, ['--abi']).toString())
  assert.deepEqual(out, { t: 'abi', hand: HAND, digit: DIGIT, bone: BONE, trackingEvent: 48, message: 20, deviceInfo: 60 })
})

test('bridge keeps only system-location search notes, whole or not at all', () => {
  const bad = bridgeModule.sanitize({ t: 'runtime', state: 'missing', tried: ['/Library/Application Support/Ultraleap', '/Users/x/lib', 'a\\"b', 5], seen: ['app:Ultraleap.app', 'lib:/Applications/../Users/x/libLeapC.dylib'], extra: 1 })
  assert.deepEqual(bad, { t: 'runtime', state: 'missing', tried: ['/Library/Application Support/Ultraleap'], seen: ['app:Ultraleap.app'] })
  assert.deepEqual(bridgeModule.sanitize({ t: 'runtime', state: 'missing', tried: [], seen: ['untrusted:libLeapC.dylib', 'override:rejected', 'unloadable:libLeapC.5.dylib'] }).seen, ['untrusted:libLeapC.dylib', 'override:rejected', 'unloadable:libLeapC.5.dylib'])
  assert.deepEqual(bridgeModule.sanitize({ t: 'runtime', state: 'missing', tried: ['/Applications/./x', '/Library/Application Support/Ultraleap'], seen: ['lib:/Library/Application Support/Ultraleap/libLeapC..dylib', 'lib:/Applications/../Users/x/libLeapC.dylib', 'lib:/Applications/x/./libLeapC.dylib'] }),
    { t: 'runtime', state: 'missing', tried: ['/Library/Application Support/Ultraleap'], seen: ['lib:/Library/Application Support/Ultraleap/libLeapC..dylib'] })
  const long = 'lib:/Applications/' + 'a'.repeat(64) + '.app/Contents/Resources/LeapSDK/lib/' + 'b'.repeat(64)
  assert.deepEqual(bridgeModule.sanitize({ t: 'runtime', state: 'missing', tried: [], seen: [long, 'x'.repeat(240)] }).seen, [long])
})

test('real helper reports a missing Ultraleap runtime on this machine', { skip }, async () => {
  const run = await lines({ KEYLIGHT_LEAPC_PATH: '/definitely/not/here.dylib' })
  if (run.messages.some((m) => m.t === 'runtime' && m.state === 'loaded')) return   // a real runtime is installed here
  assert.equal(run.code, 3)
  assert.deepEqual(run.messages.map((m) => [m.t, m.state]), [['hello', undefined], ['runtime', 'missing']])
  const search = run.messages[1]
  assert.ok(Array.isArray(search.tried) && search.tried.length >= 4 && Array.isArray(search.seen))
  assert.ok(search.tried.includes('/Applications/Ultraleap Hand Tracking.app/Contents/LeapSDK/lib'))
  assert.ok(search.tried.includes('/Applications/Ultraleap Hand Tracking Service.app/Contents/LeapSDK/lib'))
  assert.ok(search.tried.every((t) => t.startsWith('/Applications') || t.startsWith('/Library') || t.startsWith('(')))
  assert.equal(JSON.stringify(search).includes('definitely'), false)   // the override path is never reported
})

test('fixture frames travel helper -> bridge -> tracker -> calibration -> coaching', { skip }, async () => {
  const { createLeapTracker } = await import('../renderer/leap.js')
  const frames = framesFile([[pose(0)], [pose(0)], [{ type: 0, confidence: 0.9, tips: pose(0).tips }, pose(0)], [pose(0)]])
  let clock = 5000
  const incoming = []
  const bridge = bridgeModule.createAirwaveBridge({ spawn, findHelper: () => HELPER,
    env: { KEYLIGHT_LEAPC_PATH: FIXTURE_LIB, KEYLIGHT_FAKE_FRAMES: frames, PATH: process.env.PATH },
    send: (m) => { incoming.push(m); for (const fn of listeners) fn(m) } })
  const listeners = new Set()
  // what the preload exposes to the page, backed by the real bridge
  const api = { start: async () => bridge.start(), stop: async () => bridge.stop(), onMessage: (fn) => { listeners.add(fn); return () => listeners.delete(fn) } }
  const { nativeTransport } = await import('../renderer/leap.js')
  const states = []
  let whileStreaming = null
  const tracker = createLeapTracker({ transport: nativeTransport(api), now: () => clock, onState: (s) => { states.push(s); if (s === 'streaming' && !whileStreaming) whileStreaming = tracker.describe() }, setTimer: () => 1, clearTimer: () => {} })
  tracker.start()
  try {
    await new Promise((resolve, reject) => {
      const deadline = Date.now() + 10000
      const t = setInterval(() => {
        if (incoming.some((m) => m.t === 'service' && m.state === 'lost')) { clearInterval(t); resolve() }
        else if (Date.now() > deadline) { clearInterval(t); reject(new Error('helper never reported the connection lost')) }
      }, 20)
    })
  } catch (e) { tracker.stop(); bridge.stop(); throw e }
  assert.deepEqual(incoming.slice(0, 3).map((m) => m.t), ['hello', 'runtime', 'abi'])
  assert.deepEqual(incoming.find((m) => m.t === 'device'), { t: 'device', state: 'attached', streaming: true, class: 'SIR170', typeCode: 0x1203, identified: true })
  assert.ok(states.includes('connected') && states.includes('streaming'))
  const frameMsgs = incoming.filter((m) => m.t === 'frame')
  assert.equal(frameMsgs.length, 4)
  // fingertip values come from distal.next_joint, not prev_joint
  assert.deepEqual(frameMsgs[0].hands[0], { side: 'right', conf: 0.97, tips: [[-60, 90, 10], [0, 22, 5], [40, 80, 5], [60, 80, 5], [80, 80, 5]] })
  assert.equal(frameMsgs[2].hands[0].side, 'left')
  // the stream ended in a connection loss: observations are cleared, no stale fingers remain
  assert.equal(tracker.state, 'service-down')
  assert.deepEqual(tracker.getObservation().fingertips, [])
  const d = tracker.describe()
  assert.equal(d.route, 'native-helper')
  assert.equal(d.frames, 4)
  assert.deepEqual(whileStreaming.native.device, { class: 'SIR170', typeCode: 0x1203, identified: true, streaming: true })
  assert.equal(d.native.device, null)       // cleared again when the service connection was lost
  assert.equal(d.native.abiMatch, true)
  assert.equal(d.native.runtime, 'override')
  assert.equal(JSON.stringify(incoming).includes('serial'), false)
  tracker.stop()
  assert.equal(bridge.running(), false)
})

test('calibrated fixture fingertips attribute a middle key to the suggested finger, advisory only', { skip }, async () => {
  const [{ createLeapTracker, makeCalibration, liftDirection }, { attributeFingering }] = await Promise.all([import('../renderer/leap.js'), import('../renderer/coaching.js')])
  let clock = 1000
  let deliver
  const tracker = createLeapTracker({ now: () => clock, setTimer: () => 1, clearTimer: () => {},
    transport: { kind: 'native-helper', endpoint: 'test', open: (h) => { deliver = h; h.onOpen(); return { close() {} } } } })
  tracker.start()
  // right index at height y, other fingers 90 mm above it
  const frame = (x, y = 22, conf = 0.97) => ({ t: 'frame', ts: 1, fps: 90, hands: [{ side: 'right', conf, tips: [[x - 25, y + 90, 5], [x, y, 5], [x + 25, y + 90, 5], null, null] }] })
  const sample = (x, y) => { clock += 10; deliver.onMessage(frame(x, y)); return tracker.sampleFinger('right', 2, { at: clock + 5 }) }
  const a = sample(-100, 22), b = sample(100, 22), raised = sample(100, 85)
  assert.equal(a.ok && b.ok && raised.ok, true)
  const lift = liftDirection(22, raised.point.y)
  assert.equal(lift, 1)
  tracker.calib = makeCalibration({ ...a.point, f: 0 }, { ...b.point, f: 1 }, lift)
  clock += 10; deliver.onMessage(frame(0))
  const keys = [{ pitch: 60, cx: 0, w: 20, black: false }, { pitch: 61, cx: 20, w: 20, black: true }, { pitch: 62, cx: 40, w: 20, black: false }]
  const ask = (hand, finger) => attributeFingering({ pitch: 61, note: { pitch: 61, hand, finger }, keys, observation: tracker.getObservation(), now: clock + 20 })
  const hit = ask('right', 2)
  assert.equal(hit.status, 'match'); assert.equal(hit.affectsScore, false)
  assert.deepEqual(hit.observed.side + hit.observed.finger, 'right2')
  assert.equal(ask('right', 3).status, 'mismatch')
  clock += 500
  assert.equal(ask('right', 2).reason, 'stale')
  clock += 10; deliver.onMessage(frame(0, 22, 0.5))
  assert.equal(ask('right', 2).reason, 'low-confidence')
})

test('fixture device codes: Stereo IR 170 and unknown classes are reported without serial numbers', { skip }, async () => {
  const frames = framesFile([])
  const sir = await lines({ KEYLIGHT_LEAPC_PATH: FIXTURE_LIB, KEYLIGHT_FAKE_FRAMES: frames }, 3000)
  assert.equal(sir.messages.find((m) => m.t === 'device').class, 'SIR170')
  const other = await lines({ KEYLIGHT_LEAPC_PATH: FIXTURE_LIB, KEYLIGHT_FAKE_FRAMES: frames, KEYLIGHT_FAKE_DEVICE_TYPE: '9999' }, 3000)
  assert.deepEqual(other.messages.find((m) => m.t === 'device'), { t: 'device', state: 'attached', streaming: true, class: 'unknown', typeCode: 0x9999, identified: true })
  assert.equal(sir.raw.includes('serial'), false)
  assert.equal(/\/Users|\/Applications|fixture/.test(sir.raw), false)
})

test('a library that loads but whose service is not running is reported', { skip }, async () => {
  const run = await lines({ KEYLIGHT_LEAPC_PATH: FIXTURE_LIB, KEYLIGHT_FAKE_NOT_RUNNING: '1' }, 3500)
  assert.deepEqual(run.messages.map((m) => m.state ?? m.t).slice(0, 4), ['hello', 'missing'].slice(0, 1).concat(['loaded', 'not_running']))
})

test('bridge keeps only known shapes and bounds what reaches the page', () => {
  const { sanitize, helperPath } = bridgeModule
  assert.deepEqual(sanitize({ t: 'device', state: 'attached', streaming: true, class: 'SIR170', typeCode: 4611, identified: true, serial: 'ABC', path: '/Users/x' }),
    { t: 'device', state: 'attached', streaming: true, class: 'SIR170', typeCode: 4611, identified: true })
  assert.equal(sanitize({ t: 'device', state: 'attached', class: 'Some Name' }).class, 'unknown')
  assert.equal(sanitize({ t: 'shell', cmd: 'rm' }), null)
  assert.equal(sanitize({ t: 'frame', ts: 1, hands: Array(5).fill({ side: 'left', conf: 1, tips: Array(5).fill(null) }) }), null)
  assert.equal(sanitize({ t: 'frame', ts: 1, hands: [{ side: 'up', conf: 1, tips: Array(5).fill(null) }] }), null)
  assert.deepEqual(sanitize({ t: 'frame', ts: 1, fps: 90, hands: [{ side: 'left', conf: 7, tips: [[1, 2, 3], [1, NaN, 3], null, [1, 2], null] }] }).hands[0],
    { side: 'left', conf: 1, tips: [[1, 2, 3], null, null, null, null] })
  assert.equal(sanitize({ t: 'runtime', state: 'loaded', from: '/Users/someone/lib' }).from, 'system')
  assert.equal(helperPath({ root: '/r', resourcesPath: '/res', packaged: true, platform: 'darwin', arch: 'arm64', exists: () => true }), require('node:path').join('/res', 'native', 'darwin-arm64', 'keylight-leap-helper'))
  assert.equal(helperPath({ root: '/r', resourcesPath: '/res', packaged: false, platform: 'win32', arch: 'x64', exists: () => true }), require('node:path').join('/r', 'native', 'build', 'win32-x64', 'keylight-leap-helper.exe'))
  assert.equal(helperPath({ root: '/r', resourcesPath: '/res', packaged: true, platform: 'win32', arch: 'x64', exists: () => false }), null)
})

test('bridge start reports no-helper, refuses double start, drops oversized lines and reports exit', async () => {
  const sent = []
  const none = bridgeModule.createAirwaveBridge({ spawn, findHelper: () => null, send: (m) => sent.push(m) })
  assert.deepEqual(none.start(), { ok: false, reason: 'no-helper' })
  const { EventEmitter } = require('node:events')
  const fake = new EventEmitter(); fake.stdout = new EventEmitter(); fake.stdout.setEncoding = () => {}; fake.stdout.removeAllListeners = EventEmitter.prototype.removeAllListeners; fake.kill = () => { fake.killed = true }
  let spawned = 0
  const bridge = bridgeModule.createAirwaveBridge({ spawn: () => { spawned++; return fake }, findHelper: () => '/h', send: (m) => sent.push(m) })
  assert.deepEqual(bridge.start(), { ok: true }); assert.deepEqual(bridge.start(), { ok: true }); assert.equal(spawned, 1)
  fake.stdout.emit('data', '{"t":"service","state":"connected"}\nnot json\n{"t":"service","sta')
  fake.stdout.emit('data', 'te":"lost"}\n' + 'x'.repeat(20000))
  fake.stdout.emit('data', 'yyy\n{"t":"service","state":"connected"}\n')
  fake.emit('exit', 3, null)
  assert.deepEqual(sent.map((m) => m.t + ':' + (m.state ?? m.code)), ['service:connected', 'service:lost', 'service:connected', 'exit:3'])
  assert.equal(bridge.running(), false)
})

// ---- discovery against controlled folders (test-only helper build with redirectable roots) ----
const TEST_HELPER = path.join(OUT, 'keylight-leap-helper-test')
function world() {
  const base = fs.realpathSync(fs.mkdtempSync('/tmp/kl-'))
  const apps = path.join(base, 'Applications'), lib = path.join(base, 'Library')
  fs.mkdirSync(apps); fs.mkdirSync(lib)
  const env = { KEYLIGHT_TEST_APPS_ROOT: apps, KEYLIGHT_TEST_LIB_ROOT: lib, PATH: process.env.PATH }
  return { base, apps, lib, env, cleanup: () => fs.rmSync(base, { recursive: true, force: true }) }
}
function put(dir, name = 'libLeapC.dylib') {
  fs.mkdirSync(dir, { recursive: true })
  fs.copyFileSync(FIXTURE_LIB, path.join(dir, name))
  return path.join(dir, name)
}
function discover(env) {
  return new Promise((resolve) => {
    const child = spawn(TEST_HELPER, [], { env, stdio: ['ignore', 'pipe', 'ignore'] })
    let out = ''
    const finish = () => { clearTimeout(timer); child.kill(); resolve(out.split('\n').filter((l) => l.startsWith('{')).map((l) => JSON.parse(l)).find((m) => m.t === 'runtime')) }
    const timer = setTimeout(finish, 5000)
    child.stdout.on('data', (d) => { out += d; if (out.includes('"t":"runtime"') && out.endsWith('\n')) finish() })
    child.on('exit', () => { clearTimeout(timer); resolve(out.split('\n').filter((l) => l.startsWith('{')).map((l) => JSON.parse(l)).find((m) => m.t === 'runtime')) })
  })
}

test('discovery finds a normal install in each known layout and refuses untrusted ones', { skip }, async () => {
  const w = world()
  try {
    const tracking = path.join(w.apps, 'Ultraleap Hand Tracking.app', 'Contents', 'Frameworks')
    put(tracking)
    let r = await discover(w.env)
    assert.deepEqual([r.state, r.from], ['loaded', 'tracking-app'])
    // a group-writable parent folder: refused, and the report says so by name
    fs.chmodSync(tracking, 0o775)
    r = await discover(w.env)
    assert.equal(r.state, 'missing')
    assert.ok(r.seen.includes('untrusted:libLeapC.dylib'), JSON.stringify(r.seen))
    assert.ok(r.seen.includes('app:Ultraleap Hand Tracking.app'))
    fs.chmodSync(tracking, 0o755)
    // a symlink that leaves the system roots: refused
    fs.rmSync(path.join(tracking, 'libLeapC.dylib'))
    const outside = put(path.join(w.base, 'elsewhere'))
    fs.symlinkSync(outside, path.join(tracking, 'libLeapC.dylib'))
    r = await discover(w.env)
    assert.equal(r.state, 'missing')
    assert.ok(r.seen.includes('untrusted:libLeapC.dylib'))
    // a symlink that stays inside, with trusted parents: loaded
    fs.rmSync(path.join(tracking, 'libLeapC.dylib'))
    const real = put(path.join(w.apps, 'Ultraleap Hand Tracking.app', 'Contents', 'Resources'), 'libLeapC.5.dylib')
    fs.symlinkSync(real, path.join(tracking, 'libLeapC.dylib'))
    r = await discover(w.env)
    assert.equal(r.state, 'loaded')
    // a group-writable library file itself: refused
    fs.rmSync(path.join(tracking, 'libLeapC.dylib')); fs.chmodSync(real, 0o664)
    r = await discover(w.env)
    assert.equal(r.state, 'missing')
  } finally { w.cleanup() }
})

test('discovery is not starved by four app folders, and keeps long valid names', { skip }, async () => {
  const w = world()
  try {
    for (const n of ['Ultraleap A.app', 'Ultraleap B.app', 'Ultraleap C.app', 'Leap D.app']) fs.mkdirSync(path.join(w.apps, n, 'Contents', 'MacOS'), { recursive: true })
    const longApp = 'Ultraleap ' + 'x'.repeat(40) + '.app'
    put(path.join(w.apps, longApp, 'Contents', 'Resources', 'LeapSDK', 'lib'), 'libLeapC.9.dylib')
    fs.chmodSync(path.join(w.apps, longApp, 'Contents', 'Resources', 'LeapSDK', 'lib', 'libLeapC.9.dylib'), 0o664)   // refused, but its name must be reported
    put(path.join(w.lib, 'Application Support', 'Ultraleap'))
    const r = await discover(w.env)
    assert.deepEqual([r.state, r.from], ['loaded', 'library-scan'])
    fs.rmSync(path.join(w.lib, 'Application Support'), { recursive: true })
    const m = await discover(w.env)
    assert.equal(m.state, 'missing')
    assert.ok(m.seen.includes('app:' + longApp), JSON.stringify(m.seen))
    assert.ok(m.seen.some((x) => x.startsWith('lib:') && x.endsWith('/libLeapC.9.dylib')))
    assert.ok(m.seen.includes('untrusted:libLeapC.9.dylib'))
    const sys = (x) => x.split(w.apps).join('/Applications').split(w.lib).join('/Library')   // as the real roots would read
    const through = bridgeModule.sanitize({ t: 'runtime', state: 'missing', tried: m.tried.map(sys), seen: m.seen.map(sys) })
    assert.deepEqual(through.seen, m.seen.map(sys))   // nothing the helper reported is dropped by the bridge
    assert.equal(through.tried.length, m.tried.length)
    // a 100-character app name is not a valid name: it is skipped, not cut
    const hugeApp = 'Ultraleap ' + 'y'.repeat(100) + '.app'
    fs.mkdirSync(path.join(w.apps, hugeApp, 'Contents', 'MacOS'), { recursive: true })
    assert.equal((await discover(w.env)).seen.some((x) => x.includes('yyyyyyyy')), false)
  } finally { w.cleanup() }
})

test('an override that is cut off or relative is rejected, never loaded shortened', { skip }, async () => {
  const w = world()
  try {
    const padded = (n) => path.dirname(FIXTURE_LIB) + '/.'.repeat(n) + '/libLeapC-fixture.dylib'
    const okPath = padded(5)
    assert.ok(okPath.length < 600)
    assert.equal((await discover({ ...w.env, KEYLIGHT_LEAPC: okPath })).state, 'loaded')
    let long = padded(1)
    while (long.length < 650) long = padded(Math.ceil(long.length / 2) + 40)
    assert.ok(long.length >= 600 && fs.existsSync(long))     // a real library, reachable only by its long spelling
    for (const key of ['KEYLIGHT_LEAPC', 'KEYLIGHT_LEAPC_PATH']) {
      const r = await discover({ ...w.env, [key]: long })
      assert.equal(r.state, 'missing'); assert.ok(r.seen.includes('override:rejected'))
    }
    const rel = await discover({ ...w.env, KEYLIGHT_LEAPC: 'libLeapC-fixture.dylib' })
    assert.equal(rel.state, 'missing'); assert.ok(rel.seen.includes('override:rejected'))
    assert.equal(JSON.stringify(rel).includes('libLeapC-fixture'), false)   // the override itself is never reported
  } finally { w.cleanup() }
})

test('ACL write grants are refused and the loader search path cannot supply the library', { skip }, async () => {
  const w = world()
  try {
    const dir = path.join(w.apps, 'Ultraleap Hand Tracking.app', 'Contents', 'Frameworks')
    put(dir)
    assert.equal((await discover(w.env)).state, 'loaded')
    execFileSync('chmod', ['+a', 'group:everyone allow write,add_file,delete', dir])
    let r = await discover(w.env)
    assert.equal(r.state, 'missing'); assert.ok(r.seen.includes('untrusted:libLeapC.dylib'), JSON.stringify(r.seen))
    execFileSync('chmod', ['-N', dir])
    assert.equal((await discover(w.env)).state, 'loaded')
    // a read-only ACL entry is fine
    execFileSync('chmod', ['+a', 'group:everyone allow read', dir])
    assert.equal((await discover(w.env)).state, 'loaded')
    execFileSync('chmod', ['-N', dir])
    // no bare-name fallback: a library only reachable through the dynamic loader's paths is not loaded
    fs.rmSync(dir, { recursive: true })
    const stray = path.join(w.base, 'stray'); put(stray)
    r = await discover({ ...w.env, DYLD_LIBRARY_PATH: stray, DYLD_FALLBACK_LIBRARY_PATH: stray })
    assert.equal(r.state, 'missing')
    assert.equal(r.tried.some((t) => t.startsWith('(')), false)
  } finally { w.cleanup() }
})

// ---- diagnostics: why the service lists no camera (pure parsers, fake folder tree, guidance) ----
const SYSEXT = [
  '3 extension(s)',
  '--- com.apple.system_extension.driver_extension (Go to \'System Settings > General > Login Items & Extensions > Driver Extensions\' to modify these system extension(s))',
  'enabled\tactive\tteamID\tbundleID (version)\tname\t[state]',
  '*\t*\tAB12CD34EF\tcom.ultraleap.driver.UltraleapUVCDriver (1.2.0/120)\tUltraleapUVCDriver\t[activated enabled]',
  '\t\tZX98YW76VU\tcom.roli.airwave.cameradriver (2.0/7)\tROLI Camera\t[activated waiting for user]',
  '\t\tQQ11QQ11QQ\tcom.leapmotion.old.Driver (0.9/1)\tOld\t[terminated waiting to uninstall on reboot]',
  '*\t*\tUV55UV55UV\tcom.example.printer.driver (3.1/3)\tPrinter\t[activated enabled]',
  '\t\tHO00ST00ST\t/Users/jane/Library/leap/com.evil.roli (1.0) HOME\t[activated enabled]',
  '*\t*\tHO11ST11ST\tcom.roli.' + 'x'.repeat(300) + ' (1.0/1)\tLong\t[activated enabled]',
  '*\t*\tHO22ST22ST\tcom.luminary.driver (9.9.9.9.9.9.9.9.9.9.9.9/1)\tBad version\t[activated enabled]',
  'leap with no brackets at all'
].join('\n')

test('driver extension list keeps only matching lines and only id, version and state words', () => {
  const got = bridgeModule.parseExtensions(SYSEXT)
  assert.deepEqual(got, [
    { id: 'com.ultraleap.driver.UltraleapUVCDriver', version: '1.2.0/120', state: 'activated enabled' },
    { id: 'com.roli.airwave.cameradriver', version: '2.0/7', state: 'activated waiting for user' },
    { id: 'com.leapmotion.old.Driver', version: '0.9/1', state: 'terminated waiting to uninstall on reboot' }
  ].concat([{ id: 'com.evil.roli', version: '1.0', state: 'activated enabled' }, { id: 'com.luminary.driver', version: '', state: 'activated enabled' }]))   // the home-folder prefix never survives
  assert.equal(JSON.stringify(got).includes('/Users'), false)
  assert.equal(JSON.stringify(got).includes('printer'), false)
  assert.deepEqual(bridgeModule.parseExtensions(''), [])
  assert.equal(bridgeModule.parseExtensions(Array(30).fill('\t\tT\tcom.roli.a (1/1)\tn\t[activated enabled]').join('\n')).length, 8)
})

test('process names are base names only, matching, unique and capped', () => {
  const ps = ['/sbin/launchd', '/Applications/Ultraleap Hand Tracking.app/Contents/MacOS/ultraleap-tracking-service',
    '/Applications/ROLI Airwave Control.app/Contents/MacOS/Airwave Control', '/usr/bin/zsh', '/Users/jane/leap/--secret=1;rm',
    '/Applications/Ultraleap Hand Tracking.app/Contents/MacOS/ultraleap-tracking-service', '/Users/jane/bin/Leapfrog'].join('\n')
  assert.deepEqual(bridgeModule.parseProcessNames(ps), ['ultraleap-tracking-service', 'Airwave Control', 'Leapfrog'])
  const many = Array.from({ length: 40 }, (_, i) => '/x/leapd' + i).join('\n')
  assert.equal(bridgeModule.parseProcessNames(many).length, 12)
  assert.deepEqual(bridgeModule.parseTasklist('"System","4","Services","0","148 K"\r\n"LeapSvc.exe","812","Services","0","20,000 K"\r\n"notepad.exe","9","Console","1","1 K"\r\n'), ['LeapSvc.exe'])
})

test('service states keep names and state words only', () => {
  const sc = 'SERVICE_NAME: LeapService\nDISPLAY_NAME: Ultraleap Service\n        TYPE               : 10  WIN32_OWN_PROCESS\n        STATE              : 4  RUNNING\n                                (STOPPABLE)\n        BINARY_PATH_NAME   : C:\\Users\\jane\\x.exe\n\nSERVICE_NAME: Spooler\n        STATE              : 4  RUNNING\n\nSERVICE_NAME: UltraleapUpdater\n        STATE              : 1  STOPPED\n\nSERVICE_NAME: LeapWeird\n        STATE              : 4  HACKED\n'
  assert.deepEqual(bridgeModule.parseServices(sc), [{ name: 'LeapService', state: 'RUNNING' }, { name: 'UltraleapUpdater', state: 'STOPPED' }])
})

test('install candidates come from a bounded walk of system folders only', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'keylight-diag-'))
  const apps = path.join(root, 'Applications'), lib = path.join(root, 'Library', 'Application Support')
  const mk = (...p) => fs.mkdirSync(path.join(root, ...p), { recursive: true })
  mk('Applications', 'Ultraleap Hand Tracking.app', 'Contents', 'LeapSDK', 'lib')
  fs.writeFileSync(path.join(apps, 'Ultraleap Hand Tracking.app', 'Contents', 'LeapSDK', 'lib', 'libLeapC.5.dylib'), '')
  mk('Applications', 'ROLI Airwave Control.app', 'Contents', 'MacOS')
  mk('Applications', 'Safari.app'); mk('Applications', 'LeapFolder')   // not a match / not an app bundle
  mk('Library', 'Application Support', 'Ultraleap', 'a', 'b', 'c', 'd', 'e')
  fs.writeFileSync(path.join(lib, 'Ultraleap', 'a', 'b', 'c', 'd', 'e', 'libLeapC.dylib'), '')   // 6 folders deep: not found
  fs.writeFileSync(path.join(lib, 'Ultraleap', 'a', 'libLeapC.dylib'), '')
  mk('Library', 'Application Support', 'Other')
  fs.symlinkSync(os.homedir(), path.join(lib, 'Ultraleap', 'homelink'))   // links are never followed
  const found = bridgeModule.findCandidates({ fs, roots: [[apps, '/Applications', true], [lib, '/Library/Application Support', false]] })
  fs.rmSync(root, { recursive: true })
  assert.deepEqual(found.map((c) => c.path).sort(), ['/Applications/ROLI Airwave Control.app', '/Applications/Ultraleap Hand Tracking.app', '/Library/Application Support/Ultraleap'])
  const byPath = Object.fromEntries(found.map((c) => [c.path, c.libs]))
  assert.deepEqual(byPath['/Applications/Ultraleap Hand Tracking.app'], ['/Applications/Ultraleap Hand Tracking.app/Contents/LeapSDK/lib/libLeapC.5.dylib'])
  assert.deepEqual(byPath['/Library/Application Support/Ultraleap'], ['/Library/Application Support/Ultraleap/a/libLeapC.dylib'])
  assert.deepEqual(byPath['/Applications/ROLI Airwave Control.app'], [])
  // an already-expired clock stops the walk without throwing
  let t = 0
  assert.ok(Array.isArray(bridgeModule.findCandidates({ fs, now: () => (t += 5000) })))
})

test('candidate walk streams entries and enforces shared entry and time budgets before every read', () => {
  const entry = (name, directory = true) => ({ name, isDirectory: () => directory, isFile: () => !directory })
  const roots = [['/apps', '/Applications', true], ['/lib', '/Library/Application Support', false]]
  for (const nested of [false, true]) {
    let reads = 0, opened = 0, closed = 0
    const streamingFs = {
      readdirSync: () => assert.fail('whole-directory reads are not bounded'),
      opendirSync(dir, options) {
        assert.equal(options.bufferSize, 1)
        opened++
        let index = 0
        return {
          readSync() {
            reads++
            index++
            if (nested && dir === '/apps') return entry('Leap.app')
            return entry('unrelated-' + index, false)
          },
          closeSync() { closed++ }
        }
      }
    }
    bridgeModule.findCandidates({ fs: streamingFs, now: () => 0, roots })
    assert.equal(reads, 4000, 'even an unending directory cannot exhaustively allocate/read entries')
    assert.equal(opened, nested ? 2 : 1, 'exhausted budget does not open another directory')
    assert.equal(closed, opened, 'all handles close after entry exhaustion')
  }

  let time = 0, reads = 0, closed = 0
  const timedFs = {
    opendirSync() {
      return {
        readSync() {
          reads++
          time += 1000
          return entry('Leap.app')
        },
        closeSync() { closed++ }
      }
    }
  }
  bridgeModule.findCandidates({ fs: timedFs, now: () => time, roots })
  assert.equal(reads, 3, 'no entry is read after the shared time deadline')
  assert.equal(closed, 3, 'time exhaustion closes all recursive handles')
  let expiredOpens = 0, ticks = 0
  bridgeModule.findCandidates({ fs: {
    opendirSync() {
      expiredOpens++
      assert.fail('deadline already passed')
    }
  }, now: () => (ticks++ ? 3000 : 0), roots })
  assert.equal(expiredOpens, 0, 'an expired walk never opens a directory')
  let errorCloses = 0
  assert.doesNotThrow(() => bridgeModule.findCandidates({ fs: {
    opendirSync: () => ({
      readSync: () => { throw new Error('read failed') },
      closeSync() {
        errorCloses++
        throw new Error('close failed')
      }
    })
  }, roots }))
  assert.equal(errorCloses, 2, 'read failures still close each root handle')
})

test('diagnostics sanitiser drops unknown fields, home paths, user names and bad shapes', () => {
  const d = bridgeModule.sanitizeDiagnostics({ os: 'mac', macos: '15', secret: 'x',
    extensions: [{ id: 'com.roli.a', version: '1.0/1', state: 'activated enabled', extra: 1 }, { id: '/Users/x/leap', version: '1', state: 'a' }, { id: 'com.apple.thing', version: '1', state: 'a' }, { id: 'com.roli.b', version: 'v'.repeat(80), state: 'BAD;STATE' }, null],
    processes: ['Airwave Control', 'leap-jane-agent', '../leap', 'a;leap', 7, 'leap\nx'],
    installed: [{ path: '/Applications/Ultraleap.app', libs: ['/Applications/Ultraleap.app/x/libLeapC.dylib', '/Users/jane/libLeapC.dylib', '/Applications/../Users/jane/libLeapC.dylib'], x: 1 }, { path: '/Users/jane/Ultraleap.app', libs: [] }, { path: '/Library/Application Support/../etc', libs: [] }],
    services: [{ name: 'LeapService', state: 'RUNNING', pid: 4 }, { name: 'LeapService', state: 'NOPE' }] }, 'jane')
  assert.deepEqual(d, { os: 'mac', macos: '15',
    extensions: [{ id: 'com.roli.a', version: '1.0/1', state: 'activated enabled' }, { id: 'com.roli.b', version: '', state: '' }],
    processes: ['Airwave Control'],
    installed: [{ path: '/Applications/Ultraleap.app', libs: ['/Applications/Ultraleap.app/x/libLeapC.dylib'] }],
    services: [{ name: 'LeapService', state: 'RUNNING' }] })
  assert.deepEqual(bridgeModule.sanitizeDiagnostics('junk'), { os: 'other', macos: null, extensions: null, processes: null, installed: null, services: null })
  assert.equal(bridgeModule.sanitizeDiagnostics({ os: 'mac', macos: '15.1; rm' }).macos, null)
  assert.equal(bridgeModule.macMajor('24.1.0'), '15')
  assert.equal(bridgeModule.macMajor('25.5.0'), '26')
  assert.equal(bridgeModule.macMajor('19.0'), null)
})

test('every extension field applies the account-name filter before reaching a report', async () => {
  const { airwaveReport } = await import('../renderer/airwave-source.js')
  for (const field of ['id', 'version', 'state']) {
    const identity = { id: 'com.roli.JaNe.driver', version: '1.JaNe/1', state: 'activated jane' }
    const extension = { id: 'com.roli.driver', version: '1.0/1', state: 'activated enabled', [field]: identity[field] }
    const safe = { id: 'com.ultraleap.driver', version: '2/1', state: 'activated enabled' }
    const diagnostics = bridgeModule.sanitizeDiagnostics({ os: 'mac', extensions: [extension, safe] }, 'Jane')
    assert.deepEqual(diagnostics.extensions, [safe], `${field} containing the account name is dropped`)
    assert.equal(JSON.stringify(diagnostics).toLowerCase().includes('jane'), false)
    const report = airwaveReport({ version: 'test', platform: 'Mac', diagnostics })
    assert.equal(report.toLowerCase().includes('jane'), false, 'filtered extension never reaches the report')
  }
})

test('collector runs fixed absolute commands without a shell and degrades each failed probe to not available', async () => {
  const calls = []
  const execFile = (file, args, opts, cb) => {
    calls.push([file, args, opts.timeout])
    if (file === '/bin/ps') return cb(new Error('timed out'))
    cb(null, SYSEXT)
  }
  const got = await bridgeModule.collectDiagnostics({ execFile, fs, platform: 'darwin', release: '24.2.0', user: 'jane', now: () => 0 })
  assert.deepEqual(calls.map((c) => c[0]), ['/usr/bin/systemextensionsctl', '/bin/ps'])
  assert.ok(calls.every((c) => c[2] > 0 && c[2] <= 5000))
  assert.equal(got.os, 'mac'); assert.equal(got.macos, '15')
  assert.equal(got.extensions.length, 5); assert.equal(got.processes, null)
  assert.ok(Array.isArray(got.installed))
  const throwing = await bridgeModule.collectDiagnostics({ execFile: () => { throw new Error('ENOENT') }, fs: { opendirSync: () => { throw new Error('x') } }, platform: 'darwin', release: '23.0.0' })
  assert.deepEqual(throwing, { os: 'mac', macos: '14', extensions: null, processes: null, installed: [], services: null })
  const win = await bridgeModule.collectDiagnostics({ execFile: (f, a, o, cb) => cb(null, f.endsWith('sc.exe') ? 'SERVICE_NAME: LeapService\n STATE : 4  RUNNING\n' : '"LeapSvc.exe","1"\n'), fs, platform: 'win32', env: { SystemRoot: 'C:\\Windows' } })
  assert.deepEqual(win, { os: 'windows', macos: null, extensions: null, processes: ['LeapSvc.exe'], installed: null, services: [{ name: 'LeapService', state: 'RUNNING' }] })
  assert.equal((await bridgeModule.collectDiagnostics({ execFile, fs, platform: 'linux' })).os, 'other')
})

test('Windows service probe uses a large buffer and follows bounded continuation pages', async () => {
  const continuation = (index) => `Enum: more data, need 300000 bytes start resume at index ${index}\r\n`
  const calls = []
  const got = await bridgeModule.collectDiagnostics({ fs, platform: 'win32', execFile(file, args, options, cb) {
    assert.ok(options.timeout <= 4000 && options.maxBuffer <= 1024 * 1024)
    if (!file.endsWith('sc.exe')) return cb(null, '')
    calls.push(args)
    assert.deepEqual(args.slice(0, 5), ['query', 'state=', 'all', 'bufsize=', '262144'])
    if (calls.length === 1) return cb(Object.assign(new Error('more data'), { code: 234 }), 'SERVICE_NAME: Spooler\r\n STATE : 4 RUNNING\r\n\r\n' + continuation(150))
    assert.deepEqual(args.slice(5), ['ri=', '150'])
    cb(null, 'SERVICE_NAME: LeapService\r\n STATE : 4 RUNNING\r\n\r\nSERVICE_NAME: UltraleapUpdater\r\n STATE : 1 STOPPED\r\n')
  } })
  assert.equal(calls.length, 2)
  assert.deepEqual(got.services, [{ name: 'LeapService', state: 'RUNNING' }, { name: 'UltraleapUpdater', state: 'STOPPED' }])

  for (const repeated of [false, true]) {
    let pages = 0
    const bounded = await bridgeModule.collectDiagnostics({ fs, platform: 'win32', execFile(file, args, options, cb) {
      if (!file.endsWith('sc.exe')) return cb(null, '')
      pages++
      cb(null, continuation(repeated ? 1 : pages))
    } })
    assert.equal(pages, repeated ? 2 : 4, 'stale continuation indexes and endless pagination are bounded')
    assert.deepEqual(bounded.services, [])
  }
  for (const failure of ['throw', 'error', 'timeout', 'malformed']) {
    const failed = await bridgeModule.collectDiagnostics({ fs, platform: 'win32', execFile(file, args, options, cb) {
      if (!file.endsWith('sc.exe')) return cb(null, '')
      if (failure === 'throw') throw new Error('ENOENT')
      if (failure === 'malformed') return cb(null, continuation('9'.repeat(30)))
      cb(Object.assign(new Error(failure), { killed: failure === 'timeout' }), '')
    } })
    assert.deepEqual(failed.services, failure === 'malformed' ? [] : null, 'failed probes never throw')
  }
})

test('the card names the most likely fix the diagnostics support', async () => {
  const { readiness, noDeviceGuidance, airwaveReport } = await import('../renderer/airwave-source.js')
  const ext = (state) => ({ id: 'com.ultraleap.UltraleapUVCDriver', version: '1/1', state })
  const base = { os: 'mac', macos: '15', processes: [], installed: [], services: null }
  const desc = { state: 'connected', native: { runtime: 'service-app', device: null, devicesAttached: 0 } }
  const say = (diag) => readiness(desc, 'Mac', diag).action
  assert.equal(readiness(desc, 'Mac').action, readiness(desc, 'Mac', null).action)   // no diagnostics: today's message
  assert.equal(readiness(desc, 'Mac', null).code, 'no-device')
  assert.match(say({ ...base, extensions: [ext('activated waiting for user')] }), /likely installed but not switched on.*General > Login Items & Extensions > Driver Extensions/)
  assert.match(say({ ...base, macos: '26', extensions: [ext('activated waiting for user')] }), /Driver Extensions/)
  assert.match(say({ ...base, macos: '14', extensions: [ext('activated waiting for user')] }), /Privacy & Security and press Allow/)
  assert.match(say({ ...base, macos: null, extensions: [ext('activated waiting for user')] }), /macOS 15 or later.*macOS 14 or earlier/)
  assert.match(say({ ...base, extensions: [] }), /camera driver does not seem to be installed.*Reinstall the tracking software, approve its driver/)
  assert.equal(say({ ...base, extensions: null }), say(null))   // probe not available: today's message
  assert.match(say({ ...base, extensions: [ext('activated enabled')], processes: ['ultraleap-tracking-service', 'Airwave Control'] }), /Only one tracking program can use the sensor at a time, so quit Airwave Control/)
  assert.equal(say({ ...base, extensions: [ext('activated enabled')], processes: ['ultraleap-tracking-service'] }), say(null))
  assert.equal(say({ ...base, extensions: [ext('terminated waiting to uninstall on reboot')], processes: ['Airwave Control'] }), say(null))
  assert.match(say({ os: 'windows', macos: null, extensions: null, processes: ['ROLI Airwave.exe'], installed: null, services: [] }), /quit ROLI Airwave\.exe/)
  assert.equal(noDeviceGuidance(undefined), null)
  // a device that is reported keeps its own message, whatever the diagnostics say
  assert.equal(readiness({ state: 'connected', native: { device: { class: 'SIR170' } } }, 'Mac', { ...base, extensions: [] }).code, 'no-hands')
  // the report carries the new lines, names and states only
  const report = airwaveReport({ version: 't', platform: 'Mac', selected: true, leap: desc, airwaveMidi: false,
    diagnostics: { ...base, extensions: [ext('activated waiting for user')], processes: ['Airwave Control'], installed: [{ path: '/Applications/Ultraleap.app', libs: [] }] } })
  assert.match(report, /macOS major version: 15/)
  assert.match(report, /Camera driver extensions .*: com\.ultraleap\.UltraleapUVCDriver \(1\/1\) \[activated waiting for user\]/)
  assert.match(report, /Tracking-related programs running: Airwave Control/)
  assert.match(report, /Installed tracking software: \/Applications\/Ultraleap\.app \(no libLeapC found\)/)
  assert.match(report, /Readiness: Service running/)
  assert.match(airwaveReport({ version: 't', platform: 'Mac', leap: desc, diagnostics: { os: 'mac', macos: null, extensions: null, processes: null, installed: null, services: null } }), /Camera driver extensions .*: Not available/)
  assert.match(airwaveReport({ version: 't', platform: 'Mac', leap: desc }), /Driver and program checks: Not run/)
})
