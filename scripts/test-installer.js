// Artifact inspection only: never runs Keylight, Setup.exe, or an uninstaller.
// node scripts/test-installer.js --windows <Setup.exe> <payload.zip>
// node scripts/test-installer.js --mac <image.dmg> <payload.zip>
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')
const { execFileSync } = require('node:child_process')
const { verifyZip, readZipEntry, describeExe } = require('./package-win.js')

function run(command, args) {
  return execFileSync(command, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
}

function hash(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap((entry) => {
    const file = path.join(dir, entry.name)
    return entry.isDirectory() ? files(file).map((name) => entry.name + '/' + name) : [entry.name]
  })
}

async function windows(installer, zip) {
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'keylight-inspect-win-'))
  try {
    const sevenzip = process.env.SEVENZIP || '7zz'
    run(sevenzip, ['t', installer])
    run(sevenzip, ['x', '-y', `-o${stage}`, installer])
    // 7-Zip decodes the NSIS archive; it does not execute any installer instructions.
    const entries = verifyZip(zip).entries.filter((entry) => entry.name.startsWith('Keylight/') && !entry.name.endsWith('/'))
    const app = path.join(stage, 'app')
    assert.deepEqual(files(app).sort(), entries.map((entry) => entry.name.slice('Keylight/'.length)).sort(), 'complete installed binary layout')
    const fd = fs.openSync(zip, 'r')
    try {
      for (const entry of entries) {
        assert.equal(hash(path.join(app, entry.name.slice('Keylight/'.length))),
          crypto.createHash('sha256').update(readZipEntry(fd, entry)).digest('hex'), entry.name)
      }
    } finally { fs.closeSync(fd) }
    const info = await describeExe(path.join(app, 'Keylight.exe'))
    const pkg = JSON.parse(fs.readFileSync(path.join(app, 'resources/app/package.json'), 'utf8'))
    assert.equal(info.strings.ProductName, 'Keylight')
    assert.equal(info.strings.ProductVersion, pkg.version)
    for (const index of [0, 2, 3]) assert.equal(info.fuses[index], '0', 'unsafe Electron fuse disabled')
    const setup = fs.readFileSync(installer)
    assert.equal(setup.toString('ascii', 0, 2), 'MZ')
    const pe = setup.readUInt32LE(0x3c)
    assert.equal(setup.toString('ascii', pe, pe + 4), 'PE\0\0')
    assert.ok(fs.existsSync(path.join(stage, 'INSTALL.txt')), 'installer-specific instructions included')
    console.log(`Windows installer: NSIS CRC, ${entries.length} installed files byte-identical to verified ZIP; ${info.machine} EXE ${pkg.version}, fuses ${info.fuses}`)
  } finally { fs.rmSync(stage, { recursive: true, force: true }) }
}

function mac(image, zip) {
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'keylight-inspect-mac-'))
  const mount = path.join(stage, 'mounted')
  let attached = false
  try {
    run('hdiutil', ['verify', image])
    run('ditto', ['-x', '-k', zip, path.join(stage, 'zip')])
    const roots = fs.readdirSync(path.join(stage, 'zip')).filter((name) => name.startsWith('Keylight-'))
    assert.equal(roots.length, 1)
    const source = path.join(stage, 'zip', roots[0], 'Keylight.app')
    run('hdiutil', ['attach', '-readonly', '-nobrowse', '-noautoopen', '-mountpoint', mount, image])
    attached = true
    const app = path.join(mount, 'Keylight.app')
    assert.equal(fs.readlinkSync(path.join(mount, 'Applications')), '/Applications')
    assert.ok(fs.existsSync(path.join(mount, 'INSTALL AND SUPPORT.txt')))
    const names = files(source)
    assert.deepEqual(files(app), names, 'complete DMG bundle layout')
    for (const name of names) {
      const original = path.join(source, name)
      const copy = path.join(app, name)
      if (fs.lstatSync(original).isSymbolicLink()) assert.equal(fs.readlinkSync(copy), fs.readlinkSync(original), name)
      else assert.equal(hash(copy), hash(original), name)
      assert.equal(fs.statSync(copy).mode & 0o111, fs.statSync(original).mode & 0o111, name + ' executable permissions')
    }
    run('codesign', ['--verify', '--deep', '--strict', app])
    console.log(`Mac DMG: hdiutil verified, Applications link, ${names.length} bundle entries match fresh ZIP, strict ad-hoc signature verified`)
  } finally {
    if (attached) run('hdiutil', ['detach', mount])
    fs.rmSync(stage, { recursive: true, force: true })
  }
}

async function main() {
  const [kind, artifact, zip] = process.argv.slice(2)
  assert.equal(process.argv.length, 5, 'usage: node scripts/test-installer.js --windows|--mac <artifact> <payload.zip>')
  switch (kind) {
    case '--windows': await windows(path.resolve(artifact), path.resolve(zip)); break
    case '--mac': mac(path.resolve(artifact), path.resolve(zip)); break
    default: assert.fail('Expected --windows or --mac')
  }
  console.log(`SHA256 ${hash(artifact)}  ${path.basename(artifact)} (${fs.statSync(artifact).size} bytes)`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
