// Builds the Windows (x64) release zip, on macOS, Linux or Windows alike:
//   dist/Keylight-<version>-win-x64.zip
// holding README.txt (the README's "Install on Windows" steps, as plain text) and
// Keylight/ (Keylight.exe, Electron's files, the app in resources/app, and the licences)
// at its top. Windows' Extract All puts them in a Keylight-<version>-win-x64 folder by
// itself, so the zip has no folder of its own around them.
//
// 1. Electron for win32-x64, the version package.json pins, is downloaded once into a
//    cache (KEYLIGHT_CACHE, else ~/Library/Caches/keylight, %LOCALAPPDATA%\keylight\Cache
//    or ~/.cache/keylight) and checked against the SHA-256 in node_modules/electron's
//    checksums.json, which came from npm with the package-lock's integrity hash.
//    ELECTRON_MIRROR changes where it is downloaded from, as for npm's electron.
// 2. electron.exe becomes Keylight.exe with the app's icon (assets/icon.ico) and version
//    strings (resedit, a pure-JS PE editor), then the RunAsNode, NODE_OPTIONS and
//    --inspect fuses are turned off (scripts/flip-fuses.js).
// 3. The zip is written and read back: every entry must inflate to its CRC.
//
// Usage: npm run package:win [-- --keep]   (--keep also leaves the unzipped files in
// dist/Keylight-<version>-win-x64/, as Extract All lays them out)
// Needs npm ci (--ignore-scripts is enough: the Mac's Electron is not used).
// The exe is not code-signed, so Windows SmartScreen warns on first run (README.txt).
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const zlib = require('node:zlib')
const crypto = require('node:crypto')
const { promisify } = require('node:util')
const { Readable } = require('node:stream')
const { pipeline } = require('node:stream/promises')
const { flipFuses, readFuses } = require('./flip-fuses.js')

const ROOT = path.join(__dirname, '..')
const NAME = 'Keylight'
const COMPANY = 'scizerss'
const deflateRaw = promisify(zlib.deflateRaw)

/* ------------------------------------------------------------------ zip files */
// Just enough of the zip format for this build: no zip64 (the zip is ~170 MB, the
// biggest file ~240 MB), no encryption, methods 0 (stored) and 8 (deflate).

const SIG = { local: 0x04034b50, central: 0x02014b50, end: 0x06054b50 }
const UTF8 = 0x0800

function dosDateTime(date) {
  const d = new Date(Math.max(date.getTime(), Date.UTC(1980, 0, 1, 12)))
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  }
}

// The entries of a zip file, from its central directory
function listZip(file) {
  const fd = fs.openSync(file, 'r')
  try {
    const size = fs.fstatSync(fd).size
    const tailLen = Math.min(size, 22 + 65535)
    const tail = Buffer.alloc(tailLen)
    fs.readSync(fd, tail, 0, tailLen, size - tailLen)
    let end = -1
    for (let i = tailLen - 22; i >= 0; i--) if (tail.readUInt32LE(i) === SIG.end) { end = i; break }
    if (end < 0) throw new Error(file + ' is not a zip file (no end of central directory)')
    const count = tail.readUInt16LE(end + 10)
    const cdSize = tail.readUInt32LE(end + 12)
    const cdOffset = tail.readUInt32LE(end + 16)
    if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) throw new Error(file + ' is a zip64 file, which this script does not read')
    const cd = Buffer.alloc(cdSize)
    fs.readSync(fd, cd, 0, cdSize, cdOffset)
    const entries = []
    for (let p = 0, n = 0; n < count; n++) {
      if (cd.readUInt32LE(p) !== SIG.central) throw new Error(file + ': broken central directory at entry ' + n)
      const nameLen = cd.readUInt16LE(p + 28), extraLen = cd.readUInt16LE(p + 30), commentLen = cd.readUInt16LE(p + 32)
      entries.push({
        name: cd.toString('utf8', p + 46, p + 46 + nameLen),
        flags: cd.readUInt16LE(p + 8),
        method: cd.readUInt16LE(p + 10),
        crc: cd.readUInt32LE(p + 16),
        compressedSize: cd.readUInt32LE(p + 20),
        size: cd.readUInt32LE(p + 24),
        offset: cd.readUInt32LE(p + 42)
      })
      p += 46 + nameLen + extraLen + commentLen
    }
    return entries
  } finally { fs.closeSync(fd) }
}

// One entry's contents, checked against its CRC-32
function readZipEntry(fd, entry) {
  const head = Buffer.alloc(30)
  fs.readSync(fd, head, 0, 30, entry.offset)
  if (head.readUInt32LE(0) !== SIG.local) throw new Error('no local header for ' + entry.name)
  const start = entry.offset + 30 + head.readUInt16LE(26) + head.readUInt16LE(28)
  const raw = Buffer.alloc(entry.compressedSize)
  if (raw.length) fs.readSync(fd, raw, 0, raw.length, start)
  if (entry.flags & 1) throw new Error(entry.name + ' is encrypted')
  const data = entry.method === 0 ? raw : entry.method === 8 ? zlib.inflateRawSync(raw) : null
  if (!data) throw new Error(entry.name + ': unsupported compression method ' + entry.method)
  if (data.length !== entry.size || zlib.crc32(data) !== entry.crc) throw new Error(entry.name + ': size or CRC does not match')
  return data
}

// Unzips into dir; refuses names that would land outside it
function extractZip(file, dir) {
  const entries = listZip(file)
  const fd = fs.openSync(file, 'r')
  try {
    for (const e of entries) {
      const dest = path.resolve(dir, e.name)
      if (path.isAbsolute(e.name) || e.name.includes('\\') || (dest !== path.resolve(dir) && !dest.startsWith(path.resolve(dir) + path.sep))) {
        throw new Error('unsafe path in ' + file + ': ' + e.name)
      }
      if (e.name.endsWith('/')) { fs.mkdirSync(dest, { recursive: true }); continue }
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      fs.writeFileSync(dest, readZipEntry(fd, e))
    }
  } finally { fs.closeSync(fd) }
  return entries.length
}

// Every file and folder under dir, as zip names (forward slashes, folders end in /), sorted
function walk(dir, prefix = '') {
  const out = []
  for (const d of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    const rel = prefix + d.name
    if (d.isDirectory()) out.push(rel + '/', ...walk(path.join(dir, d.name), rel + '/'))
    else if (d.isFile()) out.push(rel)
    else throw new Error('not a file or folder: ' + path.join(dir, d.name))
  }
  return out
}

// Zips the folder `base` (under root) as `base/...`, or with no base what is in root, at
// the zip's top. Files are deflated a few at a time on zlib's thread pool and written
// in order.
async function writeZip(zipFile, root, base, { level = 9, date = new Date(), parallel = 4 } = {}) {
  const names = base ? [base + '/', ...walk(path.join(root, base), base + '/')] : walk(root)
  const { time, date: day } = dosDateTime(date)
  const fd = fs.openSync(zipFile, 'w')
  const central = []
  let offset = 0
  const write = (buf) => { fs.writeSync(fd, buf); offset += buf.length }
  const pack = async (name) => {
    if (name.endsWith('/')) return { name, method: 0, crc: 0, size: 0, body: Buffer.alloc(0), dir: true }
    const data = fs.readFileSync(path.join(root, ...name.split('/')))
    const packed = await deflateRaw(data, { level })
    const stored = packed.length >= data.length
    return { name, method: stored ? 0 : 8, crc: zlib.crc32(data), size: data.length, body: stored ? data : packed, dir: false }
  }
  try {
    const jobs = new Map()
    const start = (i) => { if (i < names.length) jobs.set(i, pack(names[i])) }
    for (let i = 0; i < parallel; i++) start(i)
    for (let i = 0; i < names.length; i++) {
      const e = await jobs.get(i)
      jobs.delete(i)
      start(i + parallel)
      const name = Buffer.from(e.name, 'utf8')
      if (offset + 30 + name.length + e.body.length > 0xffffffff || e.size > 0xffffffff) throw new Error('the zip would need zip64, which this script does not write')
      const local = Buffer.alloc(30)
      local.writeUInt32LE(SIG.local, 0)
      local.writeUInt16LE(20, 4)                 // version needed: 2.0
      local.writeUInt16LE(UTF8, 6)
      local.writeUInt16LE(e.method, 8)
      local.writeUInt16LE(time, 10)
      local.writeUInt16LE(day, 12)
      local.writeUInt32LE(e.crc, 14)
      local.writeUInt32LE(e.body.length, 18)
      local.writeUInt32LE(e.size, 22)
      local.writeUInt16LE(name.length, 26)
      central.push({ ...e, name, compressedSize: e.body.length, offset })
      write(local); write(name); write(e.body)
    }
    const cdStart = offset
    for (const e of central) {
      const c = Buffer.alloc(46)
      c.writeUInt32LE(SIG.central, 0)
      c.writeUInt16LE(20, 4)                     // made by: MS-DOS / FAT, zip 2.0
      c.writeUInt16LE(20, 6)
      c.writeUInt16LE(UTF8, 8)
      c.writeUInt16LE(e.method, 10)
      c.writeUInt16LE(time, 12)
      c.writeUInt16LE(day, 14)
      c.writeUInt32LE(e.crc, 16)
      c.writeUInt32LE(e.compressedSize, 20)
      c.writeUInt32LE(e.size, 24)
      c.writeUInt16LE(e.name.length, 28)
      c.writeUInt32LE(e.dir ? 0x10 : 0, 38)     // the DOS directory attribute
      c.writeUInt32LE(e.offset, 42)
      write(c); write(e.name)
    }
    if (central.length > 0xfffe) throw new Error('too many files for a zip without zip64')
    const end = Buffer.alloc(22)
    end.writeUInt32LE(SIG.end, 0)
    end.writeUInt16LE(central.length, 8)
    end.writeUInt16LE(central.length, 10)
    end.writeUInt32LE(offset - cdStart, 12)
    end.writeUInt32LE(cdStart, 16)
    write(end)
  } finally { fs.closeSync(fd) }
  return names.length
}

// Reads the whole zip back: every entry must inflate to its size and CRC
function verifyZip(zipFile) {
  const entries = listZip(zipFile)
  const fd = fs.openSync(zipFile, 'r')
  let bytes = 0
  try { for (const e of entries) bytes += readZipEntry(fd, e).length } finally { fs.closeSync(fd) }
  return { entries, bytes }
}

/* ------------------------------------------------------------------ the exe */

// What a Windows exe says about itself: machine, subsystem, version strings, icon sizes
// and fuses. Throws when it is not a 64-bit x86 GUI program.
async function describeExe(file) {
  const buf = fs.readFileSync(file)
  if (buf.toString('latin1', 0, 2) !== 'MZ') throw new Error(file + ': no MZ header')
  const pe = buf.readUInt32LE(0x3c)
  if (buf.toString('latin1', pe, pe + 4) !== 'PE\0\0') throw new Error(file + ': no PE header')
  const machine = buf.readUInt16LE(pe + 4)
  const optional = pe + 24
  const magic = buf.readUInt16LE(optional)
  const subsystem = buf.readUInt16LE(optional + 68)
  if (machine !== 0x8664 || magic !== 0x20b) throw new Error(file + ': not a 64-bit x86 exe (machine 0x' + machine.toString(16) + ')')
  if (subsystem !== 2) throw new Error(file + ': not a Windows GUI program (subsystem ' + subsystem + ')')
  const ResEdit = await import('resedit')
  const res = ResEdit.NtExecutableResource.from(ResEdit.NtExecutable.from(buf))
  const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0]
  const strings = vi ? vi.getStringValues(vi.getAllLanguagesForStringValues()[0]) : {}
  const icons = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries)
  // each icon image: its size and whether it is a PNG or a bitmap (DIB)
  const images = new Map(res.entries.filter((e) => e.type === 3 && icons.length && e.lang === icons[0].lang).map((e) => [e.id, Buffer.from(e.bin)]))
  return {
    machine: 'x64', subsystem: 'GUI', strings,
    iconSizes: icons.length ? icons[0].icons.map((i) => i.width || 256) : [],
    iconFormats: icons.length ? icons[0].icons.map((i) => {
      const bin = images.get(i.iconID)
      return (i.width || 256) + ':' + (!bin ? 'missing' : bin.readUInt32BE(0) === 0x89504e47 ? 'png' : bin.readUInt32LE(0) === 40 ? 'bmp' : 'unknown')
    }) : [],
    fuses: readFuses(buf, file)
  }
}

// Icon and version strings, in place (Electron's exe is unsigned, so nothing breaks)
async function setExeResources(exe, icoFile, version, copyright) {
  const ResEdit = await import('resedit')
  const pe = ResEdit.NtExecutable.from(fs.readFileSync(exe))
  const res = ResEdit.NtExecutableResource.from(pe)
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries)
  if (!groups.length) throw new Error('no icon in ' + exe)
  // Electron's first icon group is the exe's, its taskbar button's and its windows'
  const icon = ResEdit.Data.IconFile.from(fs.readFileSync(icoFile))
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, groups[0].id, groups[0].lang, icon.icons.map((i) => i.data))
  const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0]
  if (!vi) throw new Error('no version info in ' + exe)
  const [a = 0, b = 0, c = 0] = version.split(/[.+-]/).slice(0, 3).map((n) => parseInt(n, 10) || 0)
  vi.setFileVersion(a, b, c, 0)
  vi.setProductVersion(a, b, c, 0)
  for (const lang of vi.getAllLanguagesForStringValues()) {
    vi.removeAllStringValues(lang)
    vi.setStringValues(lang, {
      CompanyName: COMPANY,
      FileDescription: NAME,
      FileVersion: version,
      InternalName: NAME,
      LegalCopyright: copyright,
      OriginalFilename: NAME + '.exe',
      ProductName: NAME,
      ProductVersion: version
    })
  }
  vi.outputToResourceEntries(res.entries)
  res.outputResource(pe)
  fs.writeFileSync(exe, Buffer.from(pe.generate()))
}

/* ------------------------------------------------------------------ the build */

function cacheDir() {
  if (process.env.KEYLIGHT_CACHE) return process.env.KEYLIGHT_CACHE
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library/Caches/keylight')
  if (process.platform === 'win32') return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData/Local'), 'keylight', 'Cache')
  return path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), 'keylight')
}

async function sha256(file) {
  const hash = crypto.createHash('sha256')
  await pipeline(fs.createReadStream(file), hash)
  return hash.digest('hex')
}

// The Electron zip, from the cache or downloaded; always checked against `want`
async function electronZip(version, want) {
  const name = `electron-v${version}-win32-x64.zip`
  const file = path.join(cacheDir(), name)
  if (fs.existsSync(file)) {
    if ((await sha256(file)) === want) { console.log(`  electron   ${name} (cached, sha256 ok)`); return file }
    console.log(`  electron   cached ${name} does not match its checksum: downloading it again`)
  }
  const mirror = (process.env.ELECTRON_MIRROR || 'https://github.com/electron/electron/releases/download/').replace(/\/?$/, '/')
  const url = `${mirror}v${version}/${name}`
  console.log(`  electron   downloading ${url}`)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const part = file + '.part'
  const res = await fetch(url)
  if (!res.ok || !res.body) throw new Error(`download failed: ${res.status} ${res.statusText} (${url})`)
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(part))
  const got = await sha256(part)
  if (got !== want) { fs.rmSync(part, { force: true }); throw new Error(`${name}: sha256 ${got} does not match checksums.json (${want})`) }
  rename(part, file)
  console.log(`  electron   ${name} (${(fs.statSync(file).size / 1e6).toFixed(1)} MB, sha256 ok)`)
  return file
}

// Windows virus scanners hold a freshly written exe for a moment: renames retry
function rename(from, to) {
  for (let i = 0; ; i++) {
    try { return fs.renameSync(from, to) } catch (e) {
      if (i >= 20 || !['EBUSY', 'EPERM', 'EACCES'].includes(e.code)) throw e
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250)
    }
  }
}

function copyTree(from, to) {
  fs.cpSync(from, to, { recursive: true, filter: (src) => path.basename(src) !== '.DS_Store' })
}

// Markdown to the plain text Notepad shows: [text](url) becomes "text: url", and the
// **bold** and `code` marks go
function plainText(md) {
  return md
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text, url) => url.startsWith('#') ? text : `${text}: ${url}`)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
}

// The "## Install on Windows" section of docs/REFERENCE.md, for README.txt (plain text, Windows line ends)
function windowsInstallText(version, readme = fs.readFileSync(path.join(ROOT, 'docs', 'REFERENCE.md'), 'utf8')) {
  readme = readme.replace(/\r\n/g, '\n')   // in case a checkout has CRLF
  const m = readme.match(/^## Install on Windows\n([\s\S]*?)(?=^## |(?![\s\S]))/m)
  if (!m) throw new Error('docs/REFERENCE.md has no "## Install on Windows" section')
  const body = plainText(m[1].trim().replaceAll('<version>', version))
  return (`${NAME} ${version} for Windows (x64)\n\n${body}\n\nhttps://github.com/scizerss/keylight-piano\n`).replace(/\r?\n/g, '\r\n')
}

async function main() {
  const keep = process.argv.includes('--keep')
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
  const version = pkg.version
  const electronVersion = pkg.devDependencies.electron
  if (!/^\d+\.\d+\.\d+$/.test(electronVersion)) throw new Error('package.json must pin an exact electron version, not ' + electronVersion)
  let checksums
  try {
    const installed = require(path.join(ROOT, 'node_modules/electron/package.json')).version
    if (installed !== electronVersion) throw new Error(`node_modules has electron ${installed}, package.json pins ${electronVersion}: run npm ci`)
    checksums = require(path.join(ROOT, 'node_modules/electron/checksums.json'))
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') throw new Error('node_modules/electron is missing: run npm ci (or npm ci --ignore-scripts) first')
    throw e
  }
  const want = checksums[`electron-v${electronVersion}-win32-x64.zip`]
  if (!want) throw new Error(`node_modules/electron/checksums.json has no win32-x64 zip for ${electronVersion}`)
  const copyright = (fs.readFileSync(path.join(ROOT, 'LICENSE'), 'utf8').match(/^Copyright .*$/m) || ['Copyright (c) scizerss'])[0]

  console.log(`Building ${NAME} ${version} for Windows x64 from Electron ${electronVersion}`)
  const zipIn = await electronZip(electronVersion, want)

  const dist = path.join(ROOT, 'dist')
  const folder = `${NAME}-${version}-win-x64`
  const stage = path.join(dist, '.win-stage')
  fs.rmSync(stage, { recursive: true, force: true })
  const pkgDir = path.join(stage, folder)   // what goes in the zip, at its top
  const appDir = path.join(pkgDir, NAME)
  fs.mkdirSync(appDir, { recursive: true })
  try {
    console.log(`  unzipped   ${extractZip(zipIn, appDir)} files`)
    const exe = path.join(appDir, NAME + '.exe')
    rename(path.join(appDir, 'electron.exe'), exe)
    // Electron loads resources/app once the default app is gone
    fs.rmSync(path.join(appDir, 'resources/default_app.asar'), { force: true })
    for (const f of ['LICENSE', 'LICENSES.chromium.html']) {
      if (fs.existsSync(path.join(appDir, f))) rename(path.join(appDir, f), path.join(appDir, 'electron-' + f))
      else console.warn('  warning: Electron\'s ' + f + ' is missing')
    }
    // app code: main.js, package.json and renderer/ only, as in the Mac build
    const app = path.join(appDir, 'resources/app')
    fs.mkdirSync(app, { recursive: true })
    for (const f of ['main.js', 'package.json']) fs.copyFileSync(path.join(ROOT, f), path.join(app, f))
    copyTree(path.join(ROOT, 'renderer'), path.join(app, 'renderer'))
    // licence notices travel with the binary
    for (const f of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) fs.copyFileSync(path.join(ROOT, f), path.join(appDir, f))
    copyTree(path.join(ROOT, 'LICENSES'), path.join(appDir, 'LICENSES'))

    await setExeResources(exe, path.join(ROOT, 'assets/icon.ico'), version, copyright)
    // fuses last: resedit rewrites the whole exe
    flipFuses(exe)
    const info = await describeExe(exe)
    const fuses = info.fuses
    if (fuses[0] !== '0' || fuses[2] !== '0' || fuses[3] !== '0') throw new Error('fuses did not flip: ' + fuses)
    console.log(`  exe        ${NAME}.exe: ${info.machine} ${info.subsystem}, ${info.strings.ProductName} ${info.strings.FileVersion}, ` +
      `icon ${info.iconFormats.join(' ')}, fuses ${fuses} (RunAsNode, NodeOptions and --inspect off)`)

    fs.writeFileSync(path.join(pkgDir, 'README.txt'), windowsInstallText(version))

    fs.mkdirSync(dist, { recursive: true })
    const zip = path.join(dist, folder + '.zip')
    fs.rmSync(zip, { force: true })
    const t0 = Date.now()
    const count = await writeZip(zip, pkgDir)
    const check = verifyZip(zip)
    if (check.entries.length !== count) throw new Error(`the zip lists ${check.entries.length} entries, ${count} were written`)
    console.log(`  zip        ${path.relative(ROOT, zip)} (${(fs.statSync(zip).size / 1e6).toFixed(1)} MB, ${count} entries, ` +
      `${(check.bytes / 1e6).toFixed(0)} MB unpacked, read back ok, ${((Date.now() - t0) / 1000).toFixed(0)} s)`)
    if (keep) {
      const kept = path.join(dist, folder)
      fs.rmSync(kept, { recursive: true, force: true })
      rename(pkgDir, kept)
      console.log(`  folder     ${path.relative(ROOT, kept)}`)
    }
  } finally {
    fs.rmSync(stage, { recursive: true, force: true, maxRetries: 10 })
  }
}

module.exports = { listZip, readZipEntry, extractZip, writeZip, verifyZip, describeExe, windowsInstallText, plainText, dosDateTime }

if (require.main === module) {
  main().catch((e) => { console.error('error: ' + (e && e.message)); process.exit(1) })
}
