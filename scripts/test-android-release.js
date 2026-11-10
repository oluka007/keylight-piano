// Checks the Google Play preparation: listing limits and wording, manifest permissions and
// optional hardware flags, privacy policy coverage, and that no script can print the keystore password.
const fs = require('fs')
const path = require('path')
const assert = require('assert')
const root = path.join(__dirname, '..')
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
const listing = (n) => read('docs/play-listing/en-US/' + n).replace(/\n$/, '')
let n = 0
const ok = (name) => { n++; console.log('ok - ' + name) }

// listing limits
assert(listing('title.txt').length <= 30, 'title <= 30'); ok('title length ' + listing('title.txt').length)
assert(listing('short-description.txt').length <= 80, 'short <= 80'); ok('short description length ' + listing('short-description.txt').length)
assert(listing('full-description.txt').length <= 4000, 'full <= 4000'); ok('full description length ' + listing('full-description.txt').length)
assert(listing('release-notes.txt').length <= 500, 'notes <= 500'); ok('release notes length ' + listing('release-notes.txt').length)
for (const f of ['title.txt', 'short-description.txt', 'full-description.txt', 'release-notes.txt']) assert(listing(f).trim().length > 0, f + ' is empty')

// no trademarked names in anything that goes to the store
const brands = /\b(roli|lumi|blocks|seaboard|synthesia|simply piano|yousician|flowkey|pianote|skoove|garageband|keyfall|midi ?pal|apple|ipad|iphone|youtube|spotify)\b/i
for (const f of fs.readdirSync(path.join(root, 'docs/play-listing/en-US'))) {
  const m = brands.exec(read('docs/play-listing/en-US/' + f))
  assert(!m, 'brand name "' + (m && m[0]) + '" in ' + f)
}
ok('listing text has no brand names')
for (const f of ['title.txt', 'short-description.txt', 'full-description.txt']) assert(!/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(listing(f)), 'emoji in ' + f)
const full = listing('full-description.txt').toLowerCase() + listing('short-description.txt').toLowerCase()
for (const w of ['free', 'open source', 'offline', 'no ads', 'usb', 'bluetooth']) assert(full.includes(w), 'listing should mention ' + w)
ok('listing mentions free, open source, offline, no ads, USB, Bluetooth')

// manifest: optional hardware and the documented permission set only
const manifest = read('android/app/src/main/AndroidManifest.xml')
const features = [...manifest.matchAll(/<uses-feature[^>]*>/g)].map((m) => m[0])
for (const f of ['bluetooth_le', 'camera.any', 'usb.host', 'software.midi', 'hardware.bluetooth"', 'hardware.camera"', 'hardware.location']) {
  const tag = features.find((t) => t.includes('"android.hardware.' + f + '"') || t.includes('"android.software.' + f.replace('software.', '') + '"') || t.includes(f))
  assert(tag && /android:required="false"/.test(tag), f + ' must be uses-feature required=false')
}
assert(features.every((t) => /android:required="false"/.test(t)), 'every uses-feature is optional')
ok('all uses-feature entries are required=false')
const allowed = new Set(['INTERNET', 'CAMERA', 'BLUETOOTH', 'BLUETOOTH_ADMIN', 'ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION', 'BLUETOOTH_SCAN', 'BLUETOOTH_CONNECT'])
const perms = [...manifest.matchAll(/<uses-permission[^>]*android:name="android\.permission\.([A-Z_]+)"/g)].map((m) => m[1])
assert(perms.length > 0)
for (const p of perms) assert(allowed.has(p), 'undocumented permission ' + p)
const old = /ACCESS_(COARSE|FINE)_LOCATION|"android.permission.BLUETOOTH(_ADMIN)?"/
for (const m of manifest.matchAll(/<uses-permission[^>]*>/g)) if (old.test(m[0])) assert(/maxSdkVersion="30"/.test(m[0]), 'legacy permission must be maxSdkVersion 30: ' + m[0])
ok('permissions are only the documented set (' + perms.join(', ') + ')')
const dataSafety = read('docs/play-listing/data-safety.md')
for (const p of perms) assert(dataSafety.includes(p), p + ' not justified in data-safety.md')
ok('every permission is justified in data-safety.md')

// privacy policy covers every online lookup in the renderer and names the contact
const privacy = read('docs/PRIVACY.md')
const hosts = new Set()
for (const f of fs.readdirSync(path.join(root, 'renderer')).filter((x) => x === 'importer.js')) {
  for (const m of read('renderer/' + f).matchAll(/fetchSoon\(\s*[`'"]https:\/\/([a-z0-9.-]+)/g)) hosts.add(m[1])
}
assert(hosts.size >= 2, 'expected the lookup hosts in importer.js')
for (const h of hosts) assert(privacy.includes(h), 'privacy policy must mention ' + h)
assert(privacy.includes('https://github.com/scizerss/keylight-piano'), 'privacy policy contact URL')
for (const w of ['no accounts', 'no ads', 'analytics', 'camera', 'Bluetooth', 'USB']) assert(privacy.toLowerCase().includes(w.toLowerCase()), 'privacy policy should cover ' + w)
ok('privacy policy covers ' + [...hosts].join(', '))

// scripts never print or log the keystore password, never sit in the repo
for (const f of ['scripts/android-keystore.sh', 'scripts/package-android.sh']) {
  const s = read(f)
  assert(!/^\s*set\s+-\w*x/m.test(s.replace(/set \+x/g, '')), f + ' must not enable xtrace')
  for (const line of s.split('\n')) {
    if (/\b(echo|printf)\b/.test(line)) assert(!/\$\{?\w*PASSWORD|\$\{?PW\b|\$\(<?[^)]*password/i.test(line), f + ' prints a password: ' + line.trim())
  }
}
const ks = read('scripts/android-keystore.sh')
assert(/-storepass:env/.test(ks) && /-keypass:env/.test(ks), 'keytool must take passwords from the environment, not argv')
assert(/chmod 600/.test(ks) && /umask 077/.test(ks), 'keystore files must be private')
assert(/-validity (\d+)/.test(ks) && Number(/-validity (\d+)/.exec(ks)[1]) >= 9125, 'validity must be 25+ years')
assert(/Library\/Application Support\/keylight-release/.test(ks), 'default keystore location outside the repo')
const pk = read('scripts/package-android.sh')
assert(/--release/.test(pk) && /bundleRelease/.test(pk) && /apksigner/.test(pk), 'release mode builds and verifies')
const gradle = read('android/app/build.gradle')
assert(/debuggable false/.test(gradle) && /GradleException/.test(gradle) && /KEYLIGHT_KEYSTORE_PASSWORD/.test(gradle), 'release is non-debuggable and fails without the keystore')
assert(!/storePassword\s+['"]/.test(gradle), 'no literal password in build.gradle')
ok('scripts and gradle never print or embed the keystore password')
const tracked = require('child_process').execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n')
assert(!tracked.some((f) => /\.(jks|keystore|p12)$/.test(f) || /password/i.test(path.basename(f))), 'no keystore or password file tracked by git')
ok('no keystore tracked in git')

// keystore guard: the folder is resolved physically; relative paths, "." and symlink aliases of the repository are refused
// android-keystore.sh is a bash script for the maintainer's Mac: its tests do not apply on Windows
if (process.platform === 'win32') console.log('skipped - keystore script tests (bash script, not used on Windows)')
else {
  const { spawnSync } = require('child_process')
  const os = require('os')
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'keylight-ks-')))
  const script = path.join(root, 'scripts/android-keystore.sh')
  const run = (dir, cwd) => spawnSync('bash', [script], { cwd, encoding: 'utf8', env: { ...process.env, KEYLIGHT_RELEASE_DIR: dir } })
  const leaked = () => ['upload.jks', 'upload-password'].filter((f) => fs.existsSync(path.join(root, f)) || fs.existsSync(path.join(root, 'scripts', f)))
  try {
    fs.symlinkSync(root, path.join(tmp, 'alias'))
    fs.symlinkSync(path.join(root, 'scripts'), path.join(tmp, 'alias-scripts'))
    fs.mkdirSync(path.join(tmp, 'outside'))
    fs.symlinkSync(path.join(tmp, 'outside'), path.join(tmp, 'safe-link'))
    const refused = [
      ['.', root], ['./', root], ['..', path.join(root, 'scripts')], ['../', path.join(root, 'scripts')], [root, tmp],
      [path.join(root, 'scripts'), tmp], [path.join(root, 'new', 'deeper'), tmp], ['new-folder', root],
      [path.join(tmp, 'alias'), tmp], [path.join(tmp, 'alias', 'x'), tmp], ['alias', tmp], ['alias-scripts', tmp], [path.join(tmp, 'alias-scripts', 'a', 'b'), tmp],
      [path.join(tmp, 'missing', '..', 'alias'), tmp], [path.join(root, 'scripts', '..'), tmp],
      [root.toUpperCase(), tmp]
    ]
    for (const [dir, cwd] of refused) {
      if (dir === root.toUpperCase() && !fs.existsSync(dir)) continue      // only meaningful on a case-insensitive file system
      const r = run(dir, cwd)
      assert.notEqual(r.status, 0, 'keystore script accepted ' + dir + ' from ' + cwd)
      assert(/Refusing/.test(r.stderr), 'expected a refusal for ' + dir + ': ' + r.stderr)
      assert.equal(r.stdout, '', 'nothing printed on refusal')
    }
    // the script reached through a symlink that lives outside the repository must still know where the repository is
    fs.mkdirSync(path.join(tmp, 'bin')); fs.symlinkSync(script, path.join(tmp, 'bin', 'android-keystore.sh'))
    fs.symlinkSync(path.join(tmp, 'bin', 'android-keystore.sh'), path.join(tmp, 'second-link.sh'))
    for (const link of [path.join(tmp, 'bin', 'android-keystore.sh'), path.join(tmp, 'second-link.sh')]) {
      for (const dir of [path.join(root, 'inside-repo'), '.', path.join(tmp, 'alias', 'x')]) {
        const cwd = dir === '.' ? root : tmp
        const r = spawnSync('bash', [link], { cwd, encoding: 'utf8', env: { ...process.env, KEYLIGHT_RELEASE_DIR: dir } })
        assert.notEqual(r.status, 0, 'symlinked script accepted ' + dir); assert(/Refusing/.test(r.stderr), r.stderr)
      }
    }
    assert(!fs.existsSync(path.join(root, 'inside-repo')))
    assert.deepEqual(leaked(), [], 'no keystore or password file created in the repository')
    assert(!fs.existsSync(path.join(root, 'new')) && !fs.existsSync(path.join(root, 'new-folder')) && !fs.existsSync(path.join(root, 'scripts/new-folder')), 'refusal creates no folders in the repository')
    ok('keystore script refuses ".", relative paths, ".." and symlink aliases of the repository without creating anything')
    // a safe location (also reached through a symlink or a relative path) works, is private, and never prints the password
    const java = spawnSync('/usr/libexec/java_home', ['-v', '17'], { encoding: 'utf8' })
    const javaHome = process.env.JAVA_HOME || (java.status === 0 ? java.stdout.trim() : '')
    if (javaHome && fs.existsSync(path.join(javaHome, 'bin', 'keytool'))) {
      const first = spawnSync('bash', [script], { cwd: tmp, encoding: 'utf8', env: { ...process.env, JAVA_HOME: javaHome, KEYLIGHT_RELEASE_DIR: 'safe-link/keys' } })
      assert.equal(first.status, 0, first.stderr)
      const dir = path.join(tmp, 'outside', 'keys')
      const password = fs.readFileSync(path.join(dir, 'upload-password'), 'utf8').trim()
      assert(password.length >= 32 && !(first.stdout + first.stderr).includes(password), 'password is never printed')
      assert.equal(fs.statSync(dir).mode & 0o777, 0o700); assert.equal(fs.statSync(path.join(dir, 'upload.jks')).mode & 0o777, 0o600); assert.equal(fs.statSync(path.join(dir, 'upload-password')).mode & 0o777, 0o600)
      const again = spawnSync('bash', [script], { cwd: tmp, encoding: 'utf8', env: { ...process.env, JAVA_HOME: javaHome, KEYLIGHT_RELEASE_DIR: dir } })
      assert.notEqual(again.status, 0); assert(/Not overwriting/.test(again.stderr)); assert(!again.stderr.includes(password))
      assert.equal(fs.readFileSync(path.join(dir, 'upload-password'), 'utf8').trim(), password, 'existing password untouched')
      assert.deepEqual(leaked(), [])
      ok('keystore script writes 0700/0600 files outside the repo, never prints the password, never overwrites')
    } else console.log('skipped - keystore creation test (no JDK 17)')
  } finally { fs.rmSync(tmp, { recursive: true, force: true }) }
}
console.log(n + ' android release checks passed')
