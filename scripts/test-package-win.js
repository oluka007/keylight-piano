// Unit tests for the Windows build's pieces: node scripts/test-package-win.js
// The zip writer and reader of scripts/package-win.js (round trip, CRC check, unsafe
// names refused), the fuse flip of scripts/flip-fuses.js on a made-up fuse wire, and
// README.txt coming from the README's "Install on Windows" section. No download, no exe.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const crypto = require('node:crypto')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { listZip, extractZip, writeZip, verifyZip, windowsInstallText, dosDateTime } = require('./package-win.js')
const { SENTINEL, flipFusesInBuffer, readFuses } = require('./flip-fuses.js')

let n = 0
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'keylight-test-win-'))

;(async () => {
  try {
    // ---- zip round trip: text, an incompressible file, an empty one and a nested folder
    const src = path.join(tmp, 'src')
    fs.mkdirSync(path.join(src, 'Pack/sub/deeper'), { recursive: true })
    const text = 'Keylight '.repeat(5000)
    const noise = crypto.randomBytes(70000)
    fs.writeFileSync(path.join(src, 'Pack/readme.txt'), text)
    fs.writeFileSync(path.join(src, 'Pack/sub/noise.bin'), noise)
    fs.writeFileSync(path.join(src, 'Pack/sub/deeper/empty'), '')
    const zip = path.join(tmp, 'out.zip')
    const count = await writeZip(zip, src, 'Pack', { date: new Date(2026, 9, 30, 21, 15, 42) })
    assert.equal(count, 6); n++   // Pack/, readme.txt, sub/, deeper/, empty, noise.bin
    const entries = listZip(zip)
    assert.deepEqual(entries.map((e) => e.name), ['Pack/', 'Pack/readme.txt', 'Pack/sub/', 'Pack/sub/deeper/', 'Pack/sub/deeper/empty', 'Pack/sub/noise.bin']); n++
    const byName = Object.fromEntries(entries.map((e) => [e.name, e]))
    assert.equal(byName['Pack/readme.txt'].method, 8, 'text is deflated'); n++
    assert.ok(byName['Pack/readme.txt'].compressedSize < text.length / 10); n++
    assert.equal(byName['Pack/sub/noise.bin'].method, 0, 'incompressible data is stored'); n++
    assert.equal(verifyZip(zip).bytes, text.length + noise.length); n++
    const out = path.join(tmp, 'out')
    extractZip(zip, out)
    assert.equal(fs.readFileSync(path.join(out, 'Pack/readme.txt'), 'utf8'), text); n++
    assert.ok(fs.readFileSync(path.join(out, 'Pack/sub/noise.bin')).equals(noise)); n++
    assert.equal(fs.statSync(path.join(out, 'Pack/sub/deeper/empty')).size, 0); n++
    const { time, date } = dosDateTime(new Date(2026, 9, 30, 21, 15, 42))
    assert.equal(date, ((2026 - 1980) << 9) | (10 << 5) | 30); n++
    assert.equal(time, (21 << 11) | (15 << 5) | 21); n++
    // another unzip agrees, where there is one
    try {
      const listing = execFileSync('unzip', ['-t', zip], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      assert.match(listing, /No errors detected/); n++
    } catch (e) { if (e.code !== 'ENOENT') throw e }

    // ---- a damaged entry is caught
    const bad = path.join(tmp, 'bad.zip')
    const buf = fs.readFileSync(zip)
    const at = buf.indexOf(Buffer.from('Pack/sub/noise.bin')) + 'Pack/sub/noise.bin'.length + 100
    buf[at] ^= 0xff
    fs.writeFileSync(bad, buf)
    assert.throws(() => verifyZip(bad), /CRC/); n++

    // ---- a name that climbs out of the folder is refused, nothing is written outside
    const evil = path.join(tmp, 'evil.zip')
    fs.mkdirSync(path.join(tmp, 'src2/ab'), { recursive: true })
    fs.writeFileSync(path.join(tmp, 'src2/ab/cd'), 'x')
    await writeZip(evil, path.join(tmp, 'src2'), 'ab')
    const eb = fs.readFileSync(evil)
    for (let i = eb.indexOf('ab/cd'); i >= 0; i = eb.indexOf('ab/cd', i + 1)) eb.write('../cd', i, 'latin1')
    fs.writeFileSync(evil, eb)
    assert.throws(() => extractZip(evil, path.join(tmp, 'evil-out')), /unsafe path/); n++
    assert.equal(fs.existsSync(path.join(tmp, 'cd')), false); n++

    // ---- fuses: RunAsNode, NODE_OPTIONS and --inspect go off, the rest stay, 'r' is kept
    const wire = (state) => Buffer.concat([Buffer.from('junk'), Buffer.from(SENTINEL, 'latin1'), Buffer.from([1, state.length]), Buffer.from(state, 'latin1'), Buffer.from('tail')])
    const w1 = wire('101100011')
    assert.equal(flipFusesInBuffer(w1), '000000011'); n++
    assert.equal(readFuses(w1), '000000011'); n++
    const w2 = wire('1r11')
    assert.equal(flipFusesInBuffer(w2), '0r00'); n++
    assert.throws(() => flipFusesInBuffer(Buffer.concat([wire('1111'), wire('1111')])), /more than one/); n++
    assert.throws(() => flipFusesInBuffer(Buffer.from('no wire here')), /not found/); n++

    // ---- README.txt is the README's Windows install section, with the version filled in
    const txt = windowsInstallText('9.8.7')
    assert.match(txt, /^Keylight 9\.8\.7 for Windows \(x64\)\r\n/); n++
    assert.match(txt, /Keylight-9\.8\.7-win-x64\.zip/); n++
    assert.match(txt, /Run anyway/); n++
    assert.doesNotMatch(txt, /<version>|xattr|^## /m); n++
    assert.doesNotMatch(txt, /[^\r]\n/); n++

    console.log(`package-win: ${n} checks passed`)
  } finally { fs.rmSync(tmp, { recursive: true, force: true }) }
})().catch((e) => { console.error(e); process.exitCode = 1 })
