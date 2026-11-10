// Unit test for the supervisor of the bundled blocksd (renderer/blocksd-supervisor.cjs):
// node scripts/test-blocksd-supervisor.js
// Uses a tiny fake daemon (scripts/fixtures/fake-blocksd.js) on random ports. The real
// blocksd, port 9010 and anything the user runs are never touched.
// The bundled light service is Mac-only (Windows lights use plain MIDI notes), and these tests rely on POSIX
// signals and `ps`, so they do not apply on Windows.
if (process.platform === 'win32') { console.log('blocksd supervisor tests skipped on Windows: the bundled light service is Mac-only'); process.exit(0) }
const assert = require('node:assert/strict')
const fs = require('node:fs')
const net = require('node:net')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
const { pathToFileURL } = require('node:url')
const { setTimeout: sleep } = require('node:timers/promises')
const { createBlocksdSupervisor, configText, freePort, tcpOpen, probeBlocksd, processInfo } = require('../renderer/blocksd-supervisor.cjs')

const FAKE = path.join(__dirname, 'fixtures', 'fake-blocksd.js')
const tests = []
const test = (name, fn) => tests.push({ name, fn })
const alive = (pid) => { try { process.kill(pid, 0); return true } catch (_e) { return false } }
async function until(fn, ms = 5000) { const t = Date.now() + ms; while (Date.now() < t) { if (await fn()) return true; await sleep(25) } return false }

// A supervisor that runs the fake daemon with node. manual: timers are captured and run on demand.
function make(extra = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'keylight-bsd-'))
  const h = { dir, logs: [], spawns: [], timers: [], children: [], states: [] }
  const sup = createBlocksdSupervisor({
    executable: process.execPath,
    spawn: (exe, args, o) => {
      const c = spawn(exe, [FAKE, ...args], { ...o, env: { ...process.env, ...(extra.env || {}), ...(extra.envFor ? extra.envFor(h.spawns.length + 1) : {}) } })
      h.spawns.push(args); h.children.push(c); return c
    },
    // never look at the real port 9010 (a blocksd of the person running the tests may answer there)
    externalAnswers: extra.options && extra.options.externalPort ? undefined : async () => false,
    configDir: dir, pidFile: path.join(dir, 'blocksd.pid'), log: (m) => h.logs.push(m),
    onState: (st) => h.states.push(st.state + (st.reason ? ':' + st.reason : '')),
    options: { readyMs: 4000, ...(extra.options || {}) },
    setTimer: extra.manual ? (fn, ms) => { const t = { fn, ms }; h.timers.push(t); return t } : undefined,
    clearTimer: extra.manual ? (t) => { if (t) t.cleared = true } : undefined,
    ...extra.opts
  })
  h.sup = sup
  return h
}
// the executable's command as ps shows it starts with node's path, so a daemon spawned through make() has a real argv[0]
const startedOf = (pid) => processInfo(pid).started

test('picks a free loopback port, writes the config, starts the daemon there and waits until it answers', async () => {
  const h = make()
  const r = await h.sup.start()
  assert.equal(r.mode, 'bundled')
  assert.ok(r.port >= 1024 && r.port !== 9010, 'random unprivileged port, not the usual one')
  const cfg = fs.readFileSync(path.join(h.dir, 'blocksd.toml'), 'utf8')
  assert.equal(cfg, configText(r.port))
  assert.match(cfg, /web_host = "127\.0\.0\.1"/)
  assert.match(cfg, /api_enabled = false/)
  assert.ok(await probeBlocksd(r.port), 'a real discover reply comes back')
  const rec = JSON.parse(fs.readFileSync(path.join(h.dir, 'blocksd.pid'), 'utf8'))
  assert.equal(rec.pid, h.sup.pid); assert.equal(rec.exe, process.execPath); assert.ok(rec.token.length >= 16); assert.ok(rec.started)
  assert.ok(h.spawns[0].includes('--keylight-token'))
  assert.deepEqual(h.states.filter((x, i, a) => a.indexOf(x) === i), ['starting', 'ready'])
  await h.sup.stop()
})

test('daemon output goes to the log with a prefix; connection chatter is dropped', async () => {
  const h = make()
  await h.sup.start()
  assert.ok(await until(() => h.logs.some((l) => l === '[blocksd] INFO a stderr line')))
  assert.ok(h.logs.some((l) => l.startsWith('[blocksd] fake blocksd ready on ')))
  assert.ok(!h.logs.some((l) => /WebSocket client/.test(l)))
  await h.sup.stop()
})

test('two different launches get different ports', async () => {
  const seen = new Set()
  for (let i = 0; i < 3; i++) { const h = make(); const r = await h.sup.start(); seen.add(r.port); await h.sup.stop() }
  assert.ok(seen.size >= 2, 'ports ' + [...seen])
})

test('port race: a port taken between choosing and binding is retried with a new one', async () => {
  const squatter = net.createServer().listen(0, '127.0.0.1')
  await new Promise((r) => squatter.once('listening', r))
  const taken = squatter.address().port
  const ports = [taken, await freePort()]
  const h = make({ opts: { pickPort: async () => ports.shift() } })
  try {
    const r = await h.sup.start()
    assert.equal(r.mode, 'bundled'); assert.notEqual(r.port, taken)
    assert.ok(h.logs.some((l) => /did not come up on port/.test(l)))
    assert.ok(await probeBlocksd(r.port))
  } finally { await h.sup.stop(); squatter.close() }
})

test('start gives up when no attempt comes up, and says why', async () => {
  const h = make({ env: { FAKE_BLOCKSD_EXIT_MS: '10' }, options: { startAttempts: 2 } })
  const r = await h.sup.start()
  assert.equal(r.mode, 'failed'); assert.equal(h.sup.state, 'failed')
  assert.equal(h.spawns.length, 2)
  assert.equal(h.sup.pid, null)
  assert.ok(h.states.at(-1).startsWith('failed'))
})

test('a missing executable fails start without throwing', async () => {
  const h = make({ opts: { executable: '/nonexistent/blocksd', spawn: (exe, args, o) => spawn(exe, args, o) }, options: { startAttempts: 2 } })
  assert.equal((await h.sup.start()).mode, 'failed')
  assert.equal(h.sup.state, 'failed')
})

test('a crashed daemon restarts with growing delays, on the same port', async () => {
  const h = make({ manual: true, env: { FAKE_BLOCKSD_EXIT_MS: '900' } })
  const { port } = await h.sup.start()
  const delays = []
  for (let i = 0; i < 3; i++) {
    assert.ok(await until(() => h.timers.filter((t) => t.ms >= 1000 && t.ms !== 2000 * 3).length > i, 8000), 'restart scheduled after exit ' + (i + 1))
    const t = h.timers.filter((x) => x.ms !== 6000 && x.ms !== 2000)[i] || h.timers[i]
    delays.push(t.ms); t.fn()
  }
  assert.deepEqual(delays.slice(0, 2), [1000, 4000].slice(0, 0).concat([1000, delays[1]]))
  assert.equal(h.sup.port, port)
  assert.equal(new Set(h.spawns.map((a) => fs.readFileSync(a[a.indexOf('--config') + 1], 'utf8'))).size, 1, 'every start used the same config/port')
  await h.sup.stop()
})

// exit-timing rule, driven with a fake clock and a daemon that exits when told to
test('backoff: every run under 30 s counts as a failure (4, 6, 29 s), a run of 31 s starts over', async () => {
  for (const [seconds, failuresAfter] of [[4, 1], [6, 1], [29, 1], [31, 0]]) {
    let clock = 0
    const h = make({ manual: true, opts: { now: () => clock } })
    await h.sup.start()
    // run two quick failures first so the effect of the next exit is visible in the delay
    for (let i = 0; i < 2; i++) {
      h.children.at(-1).kill('SIGKILL')
      assert.ok(await until(() => h.timers.some((t) => !t.fired && !t.cleared && t.ms !== 2000 * 3 && t.ms >= 1000 && !t.done)), 'timer')
      const t = h.timers.filter((x) => !x.done && x.ms >= 1000).at(-1); t.done = true; t.fn()
      assert.ok(await until(() => h.sup.pid))
    }
    clock += seconds * 1000
    const before = h.timers.length
    h.children.at(-1).kill('SIGKILL')
    assert.ok(await until(() => h.timers.length > before))
    const delay = h.timers.at(-1).ms
    assert.equal(delay, failuresAfter === 0 ? 1000 : 4000, `${seconds} s run: delay ${delay}`)
    await h.sup.stop()
  }
})

test('backoff: after six short runs in a row it gives up and reports failed', async () => {
  const h = make({ manual: true })
  await h.sup.start()
  for (let i = 0; i < 12 && h.sup.state !== 'failed'; i++) {
    h.children.at(-1).kill('SIGKILL')
    assert.ok(await until(() => h.sup.state === 'failed' || h.timers.filter((t) => !t.done && t.ms >= 1000 && t.ms < 60000).length > 0))
    const t = h.timers.find((x) => !x.done && x.ms >= 1000 && x.ms < 60000)
    if (t) { t.done = true; t.fn(); assert.ok(await until(() => h.sup.pid)) }
  }
  assert.equal(h.sup.state, 'failed')
  assert.match(h.states.at(-1), /^failed:6 failed runs/)
  assert.equal(h.timers.filter((t) => t.ms >= 1000 && t.ms <= 30000).length, 5, 'five restarts, then it stops')
})

test('quit stops the tracked child; the pid file goes once the child is confirmed dead', async () => {
  const h = make({ manual: true })
  const { port } = await h.sup.start()
  const pid = h.sup.pid
  await h.sup.stop()
  assert.ok(!alive(pid), 'child is gone')
  assert.ok(!fs.existsSync(path.join(h.dir, 'blocksd.pid')))
  assert.equal(h.sup.detail, 'stopped')
  assert.ok(!(await tcpOpen(port)))
})

test('a child that ignores SIGTERM is killed with SIGKILL after the grace period', async () => {
  const h = make({ env: { FAKE_BLOCKSD_IGNORE_TERM: '1' }, options: { killWaitMs: 300 } })
  await h.sup.start()
  const pid = h.sup.pid
  const t = Date.now()
  await h.sup.stop()
  assert.ok(!alive(pid), 'stubborn child is gone')
  assert.ok(Date.now() - t >= 250, 'it was given the grace period first')
})

test('stopNow (process exit) SIGKILLs a child that is still alive and keeps the pid file', async () => {
  const h = make({ env: { FAKE_BLOCKSD_IGNORE_TERM: '1' } })
  await h.sup.start()
  const pid = h.sup.pid
  h.sup.stopNow()
  assert.ok(await until(() => !alive(pid)), 'child killed')
})

test('the watchdog restart replaces only our child', async () => {
  const h = make({ manual: true })
  await h.sup.start()
  const first = h.sup.pid
  assert.equal(await h.sup.restart(), true)
  assert.ok(!alive(first))
  assert.ok(await until(() => h.timers.some((t) => t.ms === 1000 && !t.cleared)))
  h.timers.find((t) => t.ms === 1000).fn()
  assert.ok(h.sup.pid && h.sup.pid !== first)
  await h.sup.stop()
})

// a daemon that really answers, on a port of its own, standing in for one the user runs
async function externalDaemon(env = {}) {
  const port = await freePort()
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'keylight-ext-'))
  fs.writeFileSync(path.join(dir, 'c.toml'), configText(port))
  const child = spawn(process.execPath, [FAKE, 'run', '--config', path.join(dir, 'c.toml')], { stdio: 'ignore', env: { ...process.env, ...env } })
  assert.ok(await until(() => tcpOpen(port)))
  return { port, child }
}

test('a real blocksd already answering on the usual port is used and never stopped or restarted', async () => {
  const ext = await externalDaemon()
  const h = make({ options: { externalPort: ext.port } })
  try {
    const r = await h.sup.start()
    assert.equal(r.mode, 'external'); assert.equal(r.port, ext.port)
    assert.equal(h.sup.status().state, 'external')
    assert.equal(h.spawns.length, 0, 'nothing of ours was started')
    assert.equal(await h.sup.restart(), false)
    await h.sup.stop(); h.sup.stopNow()
    assert.ok(alive(ext.child.pid), 'the external daemon is still running')
    assert.ok(await probeBlocksd(ext.port), 'and still answering')
  } finally { ext.child.kill('SIGKILL') }
})

test('a plain TCP listener (or a non-blocksd WebSocket) on the usual port does not count as a blocksd', async () => {
  const plain = net.createServer((s) => s.on('data', () => {})).listen(0, '127.0.0.1')
  await new Promise((r) => plain.once('listening', r))
  const notBlocksd = await externalDaemon({ FAKE_BLOCKSD_PLAIN: '1' })
  try {
    for (const port of [plain.address().port, notBlocksd.port]) {
      assert.ok(!(await probeBlocksd(port, 500)), 'probe rejects it')
      const h = make({ options: { externalPort: port } })
      const r = await h.sup.start()
      assert.equal(r.mode, 'bundled', 'our own daemon starts')
      await h.sup.stop()
    }
  } finally { plain.close(); notBlocksd.child.kill('SIGKILL') }
})

test('retry looks for an external daemon again and reports the new state', async () => {
  const h = make({ options: { startAttempts: 1 }, opts: { executable: '/nonexistent/blocksd', spawn: (e, a, o) => spawn(e, a, o) } })
  assert.equal((await h.sup.start()).mode, 'failed')
  const ext = await externalDaemon()
  try {
    const h2 = h.sup
    // same supervisor, now an external daemon is there: its usual port is not ours to move, so use a fresh one with that port
    const h3 = make({ options: { startAttempts: 1, externalPort: ext.port }, opts: { executable: '/nonexistent/blocksd', spawn: (e, a, o) => spawn(e, a, o) } })
    assert.equal(h3.sup.state, 'starting')
    assert.equal((await h3.sup.retry()).mode, 'external')
    assert.equal(h3.sup.status().state, 'external'); assert.equal(h3.sup.status().port, ext.port)
    assert.equal(h2.status().state, 'failed')
  } finally { ext.child.kill('SIGKILL') }
})

// a stand-in for a daemon left behind by a crashed run: a node process whose command line is exactly "<node> -e <code> run --keylight-token <token>"
function leftover(token) {
  return spawn(process.execPath, ['-e', 'setInterval(()=>{},1e6)', 'run', '--keylight-token', token], { stdio: 'ignore' })
}
test('a daemon left behind is stopped only when path, start time and token all match', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'keylight-stale-'))
  const pidFile = path.join(dir, 'blocksd.pid')
  const mk = () => make({ opts: { configDir: dir, pidFile } })
  const procs = []
  try {
    const cases = [
      ['token differs', (p, i) => ({ pid: p.pid, exe: process.execPath, started: i.started, token: 'WRONG' }), false],
      ['start time differs (PID reuse)', (p, i) => ({ pid: p.pid, exe: process.execPath, started: 'Mon Jan  1 00:00:00 2001', token: 'TOK123' }), false],
      ['exe in the record is another path', (p, i) => ({ pid: p.pid, exe: '/usr/bin/vim', started: i.started, token: 'TOK123' }), false],
      ['not a record at all', () => 'garbage', false],
      ['everything matches', (p, i) => ({ pid: p.pid, exe: process.execPath, started: i.started, token: 'TOK123' }), true]
    ]
    for (const [name, rec, killed] of cases) {
      const p = leftover('TOK123'); procs.push(p)
      assert.ok(await until(() => processInfo(p.pid)))
      const info = processInfo(p.pid)
      fs.writeFileSync(pidFile, typeof rec(p, info) === 'string' ? rec(p, info) : JSON.stringify(rec(p, info)))
      const h = mk(); await h.sup.start(); await h.sup.stop()
      if (killed) assert.ok(await until(() => !alive(p.pid)), name + ': stopped')
      else assert.ok(alive(p.pid), name + ': left alone')
    }
  } finally { for (const p of procs) p.kill('SIGKILL') }
})

test('an unrelated process whose arguments merely mention our executable is never stopped', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'keylight-stale-'))
  const bystander = spawn(process.execPath, ['-e', 'setInterval(()=>{},1e6)', 'blocksd-notes.txt', process.execPath], { stdio: 'ignore' })
  try {
    assert.ok(await until(() => processInfo(bystander.pid)))
    // a record that would match everything except the token, which the process does not carry
    fs.writeFileSync(path.join(dir, 'blocksd.pid'), JSON.stringify({ pid: bystander.pid, exe: process.execPath, started: startedOf(bystander.pid), token: 'ABCDEF0123456789' }))
    const h = make({ opts: { configDir: dir, pidFile: path.join(dir, 'blocksd.pid') } })
    await h.sup.start(); await h.sup.stop()
    assert.ok(alive(bystander.pid))
  } finally { bystander.kill('SIGKILL') }
})

test('a left-over daemon that ignores SIGTERM is escalated to SIGKILL; the record stays until it is dead', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'keylight-stale-'))
  const pidFile = path.join(dir, 'blocksd.pid')
  const p = spawn(process.execPath, ['-e', "process.on('SIGTERM',()=>{});setInterval(()=>{},1e6)", 'run', '--keylight-token', 'TOK123'], { stdio: 'ignore' })
  try {
    assert.ok(await until(() => processInfo(p.pid)))
    fs.writeFileSync(pidFile, JSON.stringify({ pid: p.pid, exe: process.execPath, started: processInfo(p.pid).started, token: 'TOK123' }))
    const h = make({ opts: { configDir: dir, pidFile }, options: { killWaitMs: 300 } })
    const r = await h.sup.start()
    assert.equal(r.mode, 'bundled')
    assert.ok(!alive(p.pid), 'the stubborn left-over daemon is dead before the replacement was started')
    assert.notEqual(JSON.parse(fs.readFileSync(pidFile, 'utf8')).pid, p.pid, 'the file now describes the new child')
    await h.sup.stop()
  } finally { p.kill('SIGKILL') }
})

test('concurrent start/retry calls share one start: one child, and stop kills it', async () => {
  const h = make()
  const [a, b, c] = await Promise.all([h.sup.start(), h.sup.retry(), h.sup.retry()])
  assert.equal(h.spawns.length, 1, 'exactly one child was spawned')
  assert.deepEqual([a.port, b.port], [c.port, c.port])
  const pid = h.sup.pid
  await h.sup.stop()
  assert.ok(!alive(pid))
  assert.ok(h.children.every((ch) => !alive(ch.pid)), 'no child survives')
})

test('a restarted daemon is checked like the first start: ready when it answers, stopped when it hangs', async () => {
  // restart 1 answers, restart 2 accepts connections but never speaks blocksd
  const h = make({ manual: true, options: { readyMs: 600 }, envFor: (n) => (n === 3 ? { FAKE_BLOCKSD_PLAIN: '1' } : {}) })
  await h.sup.start()
  h.children.at(-1).kill('SIGKILL')
  assert.ok(await until(() => h.timers.some((t) => t.ms === 1000 && !t.done)))
  const t1 = h.timers.find((t) => t.ms === 1000 && !t.done); t1.done = true; t1.fn()
  assert.equal(h.sup.status().state, 'starting', 'starting while it comes up')
  assert.ok(await until(() => h.sup.status().state === 'ready'), 'ready once it answers')
  h.children.at(-1).kill('SIGKILL')
  assert.ok(await until(() => h.timers.some((t) => t.ms >= 1000 && !t.done)))
  const t2 = h.timers.find((t) => t.ms >= 1000 && !t.done); t2.done = true; t2.fn()
  const hung = h.children.at(-1)
  assert.ok(await until(() => !alive(hung.pid), 8000), 'the hung restart was stopped')
  assert.ok(await until(() => h.timers.some((t) => !t.done && t.ms >= 1000)), 'and another restart is scheduled')
  assert.ok(h.logs.some((l) => /does not answer/.test(l)))
  await h.sup.stop()
})

test('the watchdog asks for the daemon port on every check', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8')
  assert.match(src, /portNow\(\)/)
  assert.ok(!/const port = supervisor && supervisor\.port/.test(src), 'the port is not captured once')
})

// native/blocksd/entry.py: the daemon ends when Keylight goes away (needs the built daemon)
const BUILT = path.join(__dirname, '..', 'native', 'build', 'darwin-arm64', 'blocksd', 'blocksd')
test('the real daemon exits when its parent is killed (stdin pipe / parent watch)', async () => {
  if (!fs.existsSync(BUILT)) { console.log('     (skipped: the daemon is not built, scripts/build-blocksd.sh)'); return }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'keylight-orphan-'))
  const port = await freePort()
  fs.writeFileSync(path.join(dir, 'c.toml'), configText(port))
  // a parent that starts the daemon the way the supervisor does, prints its pid, then waits
  const parent = spawn(process.execPath, ['-e', `const c=require('node:child_process').spawn(${JSON.stringify(BUILT)},['run','--config',${JSON.stringify(path.join(dir, 'c.toml'))},'--keylight-token','t'],{stdio:['pipe','ignore','ignore']});console.log(c.pid);setInterval(()=>{},1e6)`], { stdio: ['ignore', 'pipe', 'inherit'] })
  const pid = await new Promise((resolve) => parent.stdout.once('data', (d) => resolve(Number(String(d).trim()))))
  try {
    assert.ok(await until(() => probeBlocksd(port), 10000), 'daemon came up')
    parent.kill('SIGKILL')
    assert.ok(await until(() => !alive(pid), 12000), 'the daemon ended itself after its parent died')
  } finally { parent.kill('SIGKILL'); try { process.kill(pid, 'SIGKILL') } catch (_e) {} }
})

test('the page reads the daemon port from the query string, 9010 otherwise', async () => {
  const { daemonPort, bundledDaemon, daemonStart } = await import(pathToFileURL(path.join(__dirname, '..', 'renderer', 'daemon.js')).href)
  assert.equal(daemonPort(''), 9010)
  assert.equal(daemonPort('?x=1&daemonPort=54321'), 54321)
  assert.equal(daemonPort('?daemonPort=80'), 9010, 'privileged or junk ports are ignored')
  assert.equal(daemonPort('?daemonPort=abc'), 9010)
  assert.equal(bundledDaemon('?bundledDaemon=1'), true)
  assert.equal(bundledDaemon(''), false)
  assert.equal(daemonStart('?daemonStart=failed'), 'failed')
  assert.equal(daemonStart('?daemonStart=bogus'), 'starting')
})

test('notices and the package script cover the bundled daemon', () => {
  const root = path.join(__dirname, '..')
  const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
  assert.match(read('LICENSES/blocksd-ISC.txt'), /^ISC License/)
  assert.match(read('LICENSES/blocksd-dependencies.md'), /python-rtmidi/)
  assert.match(read('LICENSES/blocksd-dependencies.md'), /pydantic/)
  assert.match(read('THIRD_PARTY_NOTICES.md'), /blocksd — ISC/)
  const pkg = read('scripts/package.sh')
  assert.match(pkg, /Resources\/blocksd|\$RES\/blocksd/)
  assert.match(pkg, /codesign --force -s - "\$f"/)
  assert.match(read('native/blocksd/VERSION'), /^tag=v0\.6\.0$/m)
  assert.match(read('native/blocksd/requirements.lock'), /python-rtmidi==1\.5\.8/)
})

;(async () => {
  let failed = 0
  for (const t of tests) {
    try { await Promise.race([t.fn(), new Promise((_r, rej) => setTimeout(() => rej(new Error('test timed out after 40 s')), 40000).unref())]); console.log('ok   ' + t.name) } catch (e) { failed++; console.log('FAIL ' + t.name + '\n     ' + (e && e.stack || e)) }
  }
  console.log(failed ? failed + ' failed' : 'all ' + tests.length + ' passed')
  process.exit(failed ? 1 : 0)
})()
