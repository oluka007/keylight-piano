// Runs a blocksd light daemon as a tracked child process of the app and keeps it running.
// Used for the daemon that ships inside the Mac app (Contents/Resources/blocksd) and, from
// a source checkout, for a blocksd installed by hand (then on its fixed port 9010, no token).
//
// - loopback only; the bundled daemon gets a random free port, retried with another one if
//   it fails to come up, and the same port is reused by restarts so the open page keeps working
// - a blocksd that already answers on the usual port with a real blocksd reply (one the user
//   runs) is used as it is: nothing is started, nothing of it is ever stopped or restarted
//   (a plain TCP listener does not count)
// - restarts with growing delays; every exit after a run shorter than HEALTHY_MS counts as a
//   failure, and after MAX_FAILURES in a row it gives up and reports 'failed'
// - on quit: SIGTERM, then SIGKILL after a short grace; the pid file stays until the child is
//   confirmed dead. The child also ends itself when this app dies (native/blocksd/entry.py
//   watches its stdin pipe and parent), and a left-over daemon is only ever stopped when its
//   live command line, start time and per-launch token all match the pid file.
//
// blocksd has no login: anything on this Mac that can reach the port can drive the keyboard.
// The port is random per launch and the server listens on 127.0.0.1 only; a Unix socket with a
// bridge in the main process would be stronger (future work).
// All I/O is passed in so scripts/test-blocksd-supervisor.js can fake it.

const crypto = require('node:crypto')
const fs = require('node:fs')
const net = require('node:net')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const DEFAULTS = {
  externalPort: 9010,
  backoffMs: [1000, 2000, 4000, 8000, 15000, 30000],
  healthyMs: 30000,       // a run shorter than this counts as a failure, a longer one clears the count
  maxFailures: 6,
  killWaitMs: 2000,
  readyMs: 6000,          // how long start() waits for a new daemon to answer
  startAttempts: 3,       // ports tried before the first start gives up
  probeMs: 1500
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.once('error', reject)
    srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)) })
  })
}

function tcpOpen(port, timeoutMs = 1000) {
  return new Promise((resolve) => {
    const sock = net.connect({ host: '127.0.0.1', port })
    const done = (open) => { sock.destroy(); resolve(open) }
    sock.setTimeout(timeoutMs, () => done(false))
    sock.once('connect', () => done(true))
    sock.once('error', () => done(false))
  })
}

// True only when a blocksd answers a discover request on the port with a well-formed reply.
// Uses the global WebSocket (Node 22+, so Electron's main process has it).
function probeBlocksd(port, timeoutMs = DEFAULTS.probeMs) {
  return new Promise((resolve) => {
    let ws = null, timer = null
    const finish = (ok) => {
      clearTimeout(timer)
      if (ws) { ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null; try { ws.close() } catch (_e) {} ws = null }
      resolve(ok)
    }
    timer = setTimeout(() => finish(false), timeoutMs)
    try { ws = new WebSocket(`ws://127.0.0.1:${port}/ws`) } catch (_e) { finish(false); return }
    ws.onopen = () => ws.send(JSON.stringify({ type: 'discover', id: 'keylight-probe' }))
    ws.onmessage = (ev) => {
      try { const m = JSON.parse(String(ev.data)); if (m && m.type === 'discover_response' && Array.isArray(m.devices)) return finish(true) } catch (_e) {}
    }
    ws.onerror = () => finish(false)
    ws.onclose = () => finish(false)
  })
}

function configText(port) {
  // no Unix socket (the default one is shared with a user-installed blocksd); only the loopback web/WebSocket server
  return `# written by Keylight on every start\napi_enabled = false\nweb_enabled = true\nweb_host = "127.0.0.1"\nweb_port = ${port}\n`
}

// What `ps` says about a live PID: { command, started } or null
function processInfo(pid) {
  if (!(pid > 0)) return null
  try {
    const ps = (field) => String(execFileSync('/bin/ps', ['-p', String(pid), '-o', field + '='], { encoding: 'utf8', timeout: 3000, env: { LC_ALL: 'C', PATH: '/bin:/usr/bin' } })).trim()
    const command = ps('command'), started = ps('lstart')
    return command && started ? { command, started } : null
  } catch (_e) { return null }
}

const TOKEN_FLAG = '--keylight-token'

// opts: spawn, executable, configDir, pidFile, log, env, fixedPort (use that port, no token, no config),
// extraArgs (with fixedPort), probe(port), externalAnswers(), pickPort(), setTimer/clearTimer, now(),
// processInfo(pid), onState(status), options
function createBlocksdSupervisor(opts) {
  const o = { ...DEFAULTS, ...(opts.options || {}) }
  const log = opts.log || (() => {})
  const setTimer = opts.setTimer || setTimeout
  const clearTimer = opts.clearTimer || clearTimeout
  const now = opts.now || (() => Date.now())
  const pickPort = opts.pickPort || freePort
  const probe = opts.probe || ((port) => probeBlocksd(port, o.probeMs))
  const externalAnswers = opts.externalAnswers || (() => probe(o.externalPort))
  const infoOf = opts.processInfo || processInfo
  const tokened = !opts.fixedPort

  const s = { state: 'idle', reason: '', port: null, child: null, startedAt: 0, failures: 0, attempt: 0, timer: null, stopped: false,
    exitWaiters: [], token: '', lastStatus: '', starting: false, inflight: null }

  // What the page needs to know: starting | ready | failed | external, with a short reason
  function status() {
    const map = { idle: 'starting', running: 'starting', restarting: 'starting', ready: 'ready', external: 'external', failed: 'failed', stopped: 'failed' }
    return { state: map[s.state] || 'starting', port: s.port, reason: s.reason }
  }
  function emit() {
    const st = status(), key = JSON.stringify(st)
    if (key === s.lastStatus) return
    s.lastStatus = key
    if (opts.onState) { try { opts.onState(st) } catch (_e) {} }
  }
  function set(state, reason = '') { s.state = state; s.reason = reason; emit() }

  function writePid(pid, started) {
    if (!opts.pidFile) return
    try { fs.writeFileSync(opts.pidFile, JSON.stringify({ pid, exe: opts.executable, started, token: s.token })) } catch (_e) {}
  }
  function clearPid() { if (opts.pidFile) { try { fs.unlinkSync(opts.pidFile) } catch (_e) {} } }

  // Stop a daemon an earlier run of the app left behind (crash, force quit). Only when the live process
  // is exactly our executable (argv[0], not a substring of an argument), started at the recorded time,
  // and carries the recorded token; anything else just loses its stale pid file.
  // The record stays until the old daemon is confirmed dead. Resolves false if it would not die.
  async function reapStale() {
    if (!opts.pidFile) return true
    let rec = null
    try { rec = JSON.parse(fs.readFileSync(opts.pidFile, 'utf8')) } catch (_e) { clearPid(); return true }
    const ours = () => {
      if (!rec || !(rec.pid > 1) || !rec.token || rec.exe !== opts.executable) return false
      const live = infoOf(rec.pid)
      return !!live && live.started === rec.started && live.command.startsWith(opts.executable + ' ') && live.command.split(' ').includes(rec.token)
    }
    if (!ours()) { clearPid(); return true }              // gone, reused or someone else's: only the stale file goes
    const waitDead = async (ms) => {
      const until = Date.now() + ms
      while (Date.now() < until) { if (!ours()) return true; await new Promise((r) => setTimeout(r, 50)) }
      return !ours()
    }
    try { process.kill(rec.pid, 'SIGTERM') } catch (_e) {}
    log(`[blocksd] stopping a daemon left from an earlier run (pid ${rec.pid})`)
    if (!(await waitDead(o.killWaitMs))) {
      if (ours()) { try { process.kill(rec.pid, 'SIGKILL') } catch (_e) {} }   // identity revalidated just above
      if (!(await waitDead(o.killWaitMs))) { log('[blocksd] the earlier daemon will not stop'); return false }
    }
    clearPid()
    return true
  }

  function buildArgs(config) {
    if (opts.fixedPort) return ['run', ...(opts.extraArgs || [])]
    return ['run', '--config', config, TOKEN_FLAG, s.token]
  }

  function spawnChild() {
    s.attempt += 1
    const config = path.join(opts.configDir || '', 'blocksd.toml')
    if (!opts.fixedPort) {
      try { fs.mkdirSync(opts.configDir, { recursive: true }); fs.writeFileSync(config, configText(s.port)) } catch (e) { fail('could not write the daemon config: ' + e.message); return null }
    }
    let child
    try {
      child = opts.spawn(opts.executable, buildArgs(config), { stdio: [tokened ? 'pipe' : 'ignore', 'pipe', 'pipe'], windowsHide: true, env: opts.env })
    } catch (e) { onExit(null, null, e); return null }
    s.child = child
    s.startedAt = now()
    set('running')
    child.stdin && child.stdin.on && child.stdin.on('error', () => {})   // our end of the lifetime pipe: closed when we die
    const started = (infoOf(child.pid) || {}).started || ''
    if (tokened) writePid(child.pid, started)
    log(`[blocksd] started the daemon (pid ${child.pid}, port ${s.port}, attempt ${s.attempt})`)
    for (const stream of [child.stdout, child.stderr]) {
      if (!stream) continue
      let rest = ''
      stream.setEncoding && stream.setEncoding('utf8')
      stream.on('data', (chunk) => {
        const lines = (rest + chunk).split('\n')
        rest = lines.pop()
        for (const line of lines) if (line.trim() && !/WebSocket client (dis)?connected/.test(line)) log('[blocksd] ' + line.trim())
      })
      stream.on('error', () => {})
    }
    child.once('error', (e) => { if (s.child === child) onExit(null, null, e) })
    child.once('exit', (code, signal) => { if (s.child === child) onExit(code, signal) })
    return child
  }

  function fail(why) {
    set('failed', why)
    log('[blocksd] the daemon will not stay up (' + why + '): lights use plain MIDI notes unless blocksd is installed by hand')
  }

  function onExit(code, signal, error) {
    const ran = now() - s.startedAt
    s.child = null
    clearPid()                                    // the child is confirmed gone
    const waiters = s.exitWaiters; s.exitWaiters = []
    for (const w of waiters) w()
    if (s.stopped) { set('stopped'); return }
    if (s.starting) return                        // start() is watching this attempt and decides what next
    if (error) log('[blocksd] could not start the daemon: ' + error.message)
    else log(`[blocksd] the daemon exited (${signal ? 'signal ' + signal : 'code ' + code}) after ${(ran / 1000).toFixed(1)} s`)
    // one rule: a run shorter than healthyMs is a failure, a longer one starts the count over
    s.failures = !error && ran >= o.healthyMs ? 0 : s.failures + 1
    if (s.failures >= o.maxFailures) return fail(s.failures + ' failed runs in a row' + (error ? ': ' + error.message : ''))
    const delay = o.backoffMs[Math.min(Math.max(s.failures - 1, 0), o.backoffMs.length - 1)]
    set('restarting', 'restarting')
    log(`[blocksd] restarting in ${Math.round(delay / 1000)} s`)
    s.timer = setTimer(() => {
      s.timer = null
      if (s.stopped) return
      const child = spawnChild()
      if (child) watchReady(child)
    }, delay)
  }

  // a restarted daemon gets the same readiness check as the first start: it becomes 'ready' when it
  // answers; one that stays up but never answers is killed, which counts as a failed run
  async function watchReady(child) {
    if (await waitReady(child)) { if (s.child === child) { s.startedAt = now(); set('ready') } return }
    if (s.child === child && !s.stopped) {
      log('[blocksd] the restarted daemon does not answer: stopping it')
      await api.killChild()
    }
  }

  // resolves true once the daemon answers, false if it exits first or readyMs pass
  async function waitReady(child) {
    const until = Date.now() + o.readyMs
    let gone = false
    child.once('exit', () => { gone = true })
    child.once('error', () => { gone = true })
    while (!gone && s.child === child && Date.now() < until) {
      if (await probe(s.port)) return true
      await new Promise((r) => setTimeout(r, 100))
    }
    return false
  }

  async function startOnce() {
    s.stopped = false
    s.starting = true                               // an exit during start/retry is ours, not a crash to restart from
    if (s.timer) { clearTimer(s.timer); s.timer = null }
    if (s.child) await api.killChild()
    if (await externalAnswers()) {
      s.starting = false
      s.port = o.externalPort
      set('external')
      log(`[blocksd] a blocksd already answers on port ${o.externalPort}: using it, not starting another`)
      return { mode: 'external', port: s.port }
    }
    if (!(await reapStale())) { s.starting = false; fail('an earlier daemon will not stop'); return { mode: 'failed', port: null } }
    s.failures = 0
    set('running')
    for (let attempt = 1; attempt <= (opts.fixedPort ? 1 : o.startAttempts); attempt++) {
      if (opts.fixedPort) s.port = opts.fixedPort
      else { try { s.port = await pickPort() } catch (e) { s.starting = false; fail('no free port: ' + e.message); return { mode: 'failed', port: null } } }
      s.token = tokened ? crypto.randomBytes(12).toString('hex') : ''
      const child = spawnChild()
      if (!child) { if (s.state === 'failed') { s.starting = false; return { mode: 'failed', port: null } } continue }
      if (await waitReady(child)) { s.starting = false; s.startedAt = now(); set('ready'); return { mode: 'bundled', port: s.port } }
      // not up: probably the port was taken in between, or it crashed. Stop it and try another port.
      log(`[blocksd] the daemon did not come up on port ${s.port} (attempt ${attempt})`)
      await api.killChild()                         // starting=true: this exit is ours, not a crash to restart from
    }
    s.starting = false
    fail(s.lastError || 'did not start')
    return { mode: 'failed', port: null }
  }

  const api = {
    get state() { return status().state },
    get detail() { return s.state },     // idle | running | ready | restarting | external | failed | stopped
    get port() { return s.port },
    get pid() { return s.child ? s.child.pid : null },
    get external() { return s.state === 'external' },
    status,

    // Picks the daemon to use. Resolves with { mode: 'external' | 'bundled' | 'failed', port }.
    start() {
      if (!s.inflight) s.inflight = startOnce().finally(() => { s.inflight = null })
      return s.inflight
    },
    retry() { return api.start() },

    // The watchdog's restart: only ever our own child. The exit handler starts it again.
    async restart() {
      if (s.state === 'external') { log('[blocksd] not restarting: the daemon on the usual port is not ours'); return false }
      if (!s.child) return false
      return api.killChild()
    },

    // Stops the tracked child: SIGTERM, then SIGKILL after killWaitMs; resolves when it has exited
    killChild() {
      const child = s.child
      if (!child) return Promise.resolve(false)
      return new Promise((resolve) => {
        let killTimer = null, giveUp = null
        const done = (v) => { clearTimer(killTimer); clearTimer(giveUp); resolve(v) }
        s.exitWaiters.push(() => done(true))
        try { child.kill('SIGTERM') } catch (_e) {}
        killTimer = setTimer(() => { try { child.kill('SIGKILL') } catch (_e) {} }, o.killWaitMs)
        giveUp = setTimer(() => done(false), o.killWaitMs * 3)
      })
    },

    // App quit: no more restarts, the child goes now
    async stop() {
      s.stopped = true
      if (s.timer) { clearTimer(s.timer); s.timer = null }
      if (s.state !== 'external') await api.killChild()
      set('stopped')
    },

    // For process.on('exit'): nothing can be awaited, so a child still alive gets SIGKILL now.
    // The pid file stays (it goes when the exit is seen); a later launch checks it.
    stopNow() {
      s.stopped = true
      if (s.timer) { clearTimer(s.timer); s.timer = null }
      if (s.child) { try { s.child.kill('SIGKILL') } catch (_e) {} }
    }
  }
  return api
}

module.exports = { createBlocksdSupervisor, configText, freePort, tcpOpen, probeBlocksd, processInfo, DEFAULTS, TOKEN_FLAG }
