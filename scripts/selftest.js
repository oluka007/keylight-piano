// Runs the engine self-test (LUMI_SELFTEST) and checks it, on macOS or Windows:
//   npm run selftest [-- --exe path/to/Keylight.exe] [--profile dir] [--timeout 300] [--query platform=win]
//                       [--expect-platform win|mac]
// The app runs hidden and muted in a throwaway profile, off the keyboard and blocksd
// (LUMI_NO_KEYBOARD), and quits itself when the test reports (LUMI_SELFTEST_QUIT). This
// prints the SELFTEST lines and exits 0 when they end with SELFTEST done and none says
// FAIL. Without --exe it runs this checkout with the Electron in node_modules (npm ci
// downloads it). The profile is kept (its app.log is CI's artifact) when --profile is given.
// --query adds to the page's query, e.g. platform=win runs it with the Windows page on a Mac.
// The page must also report the platform it took (SELFTEST platform isWin=...): the one
// --expect-platform names, else the one --query forces, else this system's (win on
// Windows, mac elsewhere); and Web MIDI with sysex must open (SELFTEST midi access ok).
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')

const ROOT = path.join(__dirname, '..')
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined }
const exe = arg('--exe')
const keepProfile = !!arg('--profile')
const profile = path.resolve(arg('--profile') || fs.mkdtempSync(path.join(os.tmpdir(), 'keylight-selftest-')))
const timeoutS = Number(arg('--timeout')) || 300
const query = arg('--query')
const forced = /(?:^|&)platform=(win|mac)\b/.exec(query || '')
const expectPlatform = arg('--expect-platform') || (forced && forced[1]) || (process.platform === 'win32' ? 'win' : 'mac')
if (!['win', 'mac'].includes(expectPlatform)) { console.error('--expect-platform takes win or mac, not ' + expectPlatform); process.exit(2) }

let cmd, args
if (exe) { cmd = path.resolve(exe); args = [] }
else {
  try { cmd = require('electron') } catch (_e) { cmd = null }
  if (typeof cmd !== 'string' || !fs.existsSync(cmd)) {
    console.error('no Electron binary in node_modules: run npm ci (without --ignore-scripts), or node node_modules/electron/install.js')
    process.exit(2)
  }
  args = [ROOT]
}

fs.mkdirSync(profile, { recursive: true })
const log = path.join(profile, 'app.log')
fs.rmSync(log, { force: true })
const env = { ...process.env, LUMI_USERDATA: profile, LUMI_SELFTEST: '1', LUMI_SELFTEST_QUIT: '1', LUMI_NO_KEYBOARD: '1', LUMI_WATCHDOG: '0', LUMI_SELFTEST_TIMEOUT: String(timeoutS) }
delete env.ELECTRON_RUN_AS_NODE   // else Electron runs as plain Node
delete env.LUMI_SOUND             // the test stays muted
delete env.LUMI_QUERY
if (query) env.LUMI_QUERY = 'selftest=1&' + query

console.log(`self-test: ${cmd} ${args.join(' ')} (profile ${profile})`)
const started = Date.now()
const child = spawn(cmd, args, { env, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true })
let stderr = ''
child.stderr.on('data', (d) => { stderr = (stderr + d).slice(-4000) })
// the app has its own timeout; this one catches an app that never got that far
const killer = setTimeout(() => { console.error(`self-test: no exit after ${timeoutS + 60} s: killing it`); child.kill('SIGKILL') }, (timeoutS + 60) * 1000)
child.on('error', (e) => { console.error('self-test: could not start: ' + e.message); process.exit(2) })
child.on('exit', (code, signal) => {
  clearTimeout(killer)
  const text = fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : ''
  const lines = text.split('\n').map((l) => l.replace(/^\[[^\]]+\] (\[renderer\] )?/, '')).filter((l) => /^SELFTEST |^\[selftest\]/.test(l))
  for (const l of lines) console.log('  ' + l)
  const results = lines.filter((l) => l.startsWith('SELFTEST '))
  const fails = results.filter((l) => /\bFAIL\b/.test(l))
  const done = results.includes('SELFTEST done')
  const secs = ((Date.now() - started) / 1000).toFixed(0)
  // the page took this system's path (or the forced one), and Web MIDI opened
  const plat = results.find((l) => l.startsWith('SELFTEST platform '))
  const took = plat && (/isWin=true\b/.test(plat) ? 'win' : /isWin=false\b/.test(plat) ? 'mac' : null)
  const platformOk = took === expectPlatform
  const midiOk = results.some((l) => /^SELFTEST midi access ok\b/.test(l))
  console.log(`self-test: platform ${took ? 'is ' + took : 'not reported'}, expected ${expectPlatform}: ${platformOk ? 'ok' : 'WRONG'}; ` +
    `Web MIDI ${midiOk ? 'opened' : 'did NOT open'}`)
  console.log(`self-test: ${results.length} SELFTEST lines, ${fails.length} FAIL, ${done ? 'done' : 'NOT done'}; app exit ${code === null ? signal : code} after ${secs} s`)
  if (!text) console.log('self-test: no app.log was written' + (stderr ? '; stderr:\n' + stderr : ''))
  if (!keepProfile) fs.rmSync(profile, { recursive: true, force: true })
  process.exit(done && fails.length === 0 && platformOk && midiOk && code === 0 ? 0 : 1)
})
