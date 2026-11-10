// Build the per-user Windows installer without executing it, on any build host.
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const { verifyZip, describeExe } = require('./package-win.js')

const ROOT = path.join(__dirname, '..')

function main() {
  assert.equal(process.argv.length, 2, 'usage: node scripts/package-installer.js')
  const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
  assert.match(version, /^\d+\.\d+\.\d+$/, 'Expected a numeric release version')
  const compiler = process.env.MAKENSIS || 'makensis'
  execFileSync(compiler, [process.platform === 'win32' ? '/VERSION' : '-VERSION'], { stdio: 'inherit' })
  // Always build a fresh payload. --keep is required for the compiler's File command.
  execFileSync(process.execPath, [path.join(__dirname, 'package-win.js'), '--keep'], { stdio: 'inherit' })
  return build(version, compiler)
}

async function build(version, compiler) {
  const base = `Keylight-${version}-win-x64`
  const dist = path.join(ROOT, 'dist')
  const payload = path.join(dist, base, 'Keylight')
  const zip = path.join(dist, base + '.zip')
  verifyZip(zip)
  const exe = await describeExe(path.join(payload, 'Keylight.exe'))
  assert.equal(exe.strings.ProductVersion, version)
  const original = path.join(dist, `${base}-Setup.exe`)
  const output = fs.existsSync(original)
    ? path.join(dist, `${base}-${Date.now()}-${process.pid}-Setup.exe`) : original
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'keylight-installer-'))
  try {
    const readme = path.join(stage, 'INSTALL AND SUPPORT.txt')
    fs.writeFileSync(readme, `Keylight ${version} for Windows x64\r\n\r\n` +
      'Open Setup.exe to install for your account without administrator rights.\r\n' +
      'Quit Keylight before installing an update. Start Keylight from the Start menu.\r\n' +
      'Remove it using Windows Settings > Apps. Progress stays in %APPDATA%\\lumi-app;\r\n' +
      'recordings in Videos\\Keylight are also preserved.\r\n\r\n' +
      'Keylight is free. All core features work without payment or an account.\r\n' +
      'Optional pay-what-you-want support: https://ko-fi.com/scizers\r\n' +
      'No donation is needed to install, continue, or use Keylight.\r\n\r\n' +
      'Requires Windows 10/11 x64. This installer and app are unsigned. Windows may\r\n' +
      'warn or block them. Follow your security policy; no protection is disabled.\r\n' +
      'Help: https://github.com/scizerss/keylight-piano/issues\r\n' +
      'Attach %APPDATA%\\lumi-app\\app.log when reporting a problem.\r\n' +
      'Licenses and third-party notices are in the installed app folder.\r\n')
    const temporary = path.join(stage, path.basename(output))
    const flag = process.platform === 'win32' ? '/' : '-'
    execFileSync(compiler, [`${flag}NOCONFIG`, `${flag}WX`, `${flag}DVERSION=${version}`,
      `${flag}DPAYLOAD=${payload}`, `${flag}DOUTPUT=${temporary}`, `${flag}DINSTALL_README=${readme}`,
      `${flag}DAPP_ICON=${path.join(ROOT, 'assets/icon.ico')}`,
      path.join(__dirname, 'keylight-installer.nsi')],
      // makensis aborts (std::bad_alloc) on macOS and Linux when the shell has no UTF-8 locale
      { stdio: 'inherit', env: process.platform === 'win32' ? process.env : { ...process.env, LC_ALL: process.env.LC_ALL || 'en_US.UTF-8' } })
    execFileSync(process.execPath, [path.join(__dirname, 'test-installer.js'), '--windows', temporary, zip], { stdio: 'inherit' })
    fs.copyFileSync(temporary, output, fs.constants.COPYFILE_EXCL)
    const { createHash } = require('node:crypto')
    const sha256 = createHash('sha256').update(fs.readFileSync(output)).digest('hex')
    fs.writeFileSync(output + '.sha256', `${sha256}  ${path.basename(output)}\n`)
    fs.writeFileSync(output + '.json', JSON.stringify({ file: path.basename(output), version,
      bytes: fs.statSync(output).size, sha256, signed: false, payload: path.basename(zip),
      inspection: 'NSIS extracted without execution; all payload files match verified ZIP', exe }, null, 2) + '\n')
    console.log(`Built and inspected: ${output}`)
  } finally {
    fs.rmSync(stage, { recursive: true, force: true })
  }
}

// CLI boundary: report build failures and retain a nonzero exit status.
Promise.resolve().then(main).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
