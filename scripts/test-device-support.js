const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const probe = require('../renderer/usb-probe.cjs')
const { isAllowedExternalUrl } = require('../renderer/external-links.cjs')

// realistic fixtures, each carrying a serial, a location and a home-folder path that must not survive
const MAC_PROFILER = JSON.stringify({ SPUSBDataType: [{ _name: 'USB31Bus', host_controller: 'AppleT8112USBXHCI', _items: [
  { _name: 'USB3.0 Hub', vendor_id: '0x0bda  (Realtek Semiconductor Corp.)', product_id: '0x0411', serial_num: 'HUBSERIAL1', location_id: '0x01100000 / 1', _items: [
    { _name: 'Example Keyboard', vendor_id: '0x1234', product_id: '0x0042', manufacturer: 'Example Maker Ltd.', bcd_device: '1.05', serial_num: 'SECRET-SERIAL-9917', location_id: '0x01110000 / 4', Media: [{ _name: 'x' }] } ] },
  { _name: 'Magic Keyboard', vendor_id: 'apple_vendor_id', product_id: '0x029c', manufacturer: 'Apple Inc.', serial_num: 'APPLEBOARD', location_id: '0x02100000 / 2' },
  { _name: 'USB MIDI Interface', vendor_id: '0x0582  (Roland Corporation)', product_id: '0x012a', serial_num: 'ROLAND123', location_id: '0x02200000 / 3', bcd_device: '2.00' } ] }] })
const IOREG = [
  '+-o Root  <class IORegistryEntry, id 0x100000100, retain 25>',
  '  +-o Example Digital Piano@01110000  <class AppleUSBDevice, id 0x10000a1f0, registered, matched, active, busy 0 (14 ms), retain 20>',
  '    | {',
  '    |   "idVendor" = 4660', '    |   "idProduct" = 66', '    |   "bcdDevice" = 261',
  '    |   "bDeviceClass" = 0', '    |   "USB Product Name" = "Example Digital Piano"', '    |   "USB Vendor Name" = "Example Maker Ltd."',
  '    |   "USB Serial Number" = "SECRET-SERIAL-9917"', '    |   "locationID" = 17891328', '    |   "IOCFPlugInTypes" = {"x"="/Users/jane/Library/plugin.bundle"}', '    | }'
].join('\n')
const POWERSHELL = JSON.stringify([
  { FriendlyName: 'USB Audio Device', Manufacturer: 'Example Maker Ltd.', InstanceId: 'USB\\VID_1234&PID_0042\\SECRET-SERIAL-9917', Class: 'MEDIA' },
  { FriendlyName: 'Generic USB Hub', Manufacturer: '(Standard USB HUBs)', InstanceId: 'USB\\VID_8087&PID_0026\\5&2A3B4C&0&1', Class: 'USB' },
  { FriendlyName: 'Example Keyboard', Manufacturer: 'Example Maker Ltd.', InstanceId: 'USB\\VID_1234&PID_0043&MI_00\\7&1F2E3D&0&0000', Class: 'USB' },
  { FriendlyName: 'Realtek Audio', Manufacturer: 'Realtek', InstanceId: 'HDAUDIO\\FUNC_01&VEN_10EC\\4&1', Class: 'MEDIA' }
])

async function main() {
  const ds = await import('../renderer/device-support.js')
  await probe.ready()

  // ---- identity reply parser ----
  const one = ds.parseIdentityReply([0xf0, 0x7e, 0x00, 0x06, 0x02, 0x41, 0x01, 0x02, 0x03, 0x04, 0x01, 0x00, 0x00, 0x00, 0xf7])
  assert.deepEqual(one, { manufacturerId: '41', family: '01 02', model: '03 04', familyCode: 1 | (2 << 7), modelCode: 3 | (4 << 7), versionBytes: '01 00 00 00', version: '1.0.0.0' })
  const three = ds.parseIdentityReply(new Uint8Array([0xf0, 0x7e, 0x7f, 0x06, 0x02, 0x00, 0x21, 0x10, 0x04, 0x00, 0x15, 0x00, 0x02, 0x01, 0x00, 0x03, 0xf7]))
  assert.equal(three.manufacturerId, '00 21 10'); assert.equal(three.family, '04 00'); assert.equal(three.model, '15 00'); assert.equal(three.version, '2.1.0.3')
  assert.ok(ds.parseIdentityReply([0xf0, 0x7e, 0x00, 0x06, 0x02, 0x41, 0x01, 0x02, 0x03, 0x04, 0x01, 0x00, 0x00, 0x00]), 'a missing F7 is tolerated')
  for (const bad of [null, undefined, [], [0xf0], [0xf0, 0x7e, 0x00, 0x06, 0x02, 0x41, 0x01, 0xf7],               // short
    [0xf0, 0x7e, 0x00, 0x06, 0x01, 0xf7],                                                                          // the inquiry itself
    [0x90, 0x7e, 0x00, 0x06, 0x02, 0x41, 1, 2, 3, 4, 1, 0, 0, 0, 0xf7],                                          // wrong start
    [0xf0, 0x7d, 0x00, 0x06, 0x02, 0x41, 1, 2, 3, 4, 1, 0, 0, 0, 0xf7],                                          // wrong header
    [0xf0, 0x7e, 0x00, 0x06, 0x02, 0x00, 0x21, 0x10, 1, 2, 3, 4, 1, 0, 0, 0xf7],                                 // 3-byte maker too short
    [0xf0, 0x7e, 0x00, 0x06, 0x02, 0x41, 1, 2, 3, 4, 1, 0, 0, 0, 0, 0xf7],                                       // too long
    [0xf0, 0x7e, 0x00, 0x06, 0x02, 0x41, 1, 2, 3, 4, 1, 0, 0, 0x90, 0xf7], 'text']) assert.equal(ds.parseIdentityReply(bad), null, JSON.stringify(bad))
  assert.deepEqual(ds.INQUIRY, [0xf0, 0x7e, 0x7f, 0x06, 0x01, 0xf7])

  // ---- capture reducer ----
  const cap = ds.newCapture()
  const sent = [[0x90, 60, 80], [0x90, 62, 100], [0x80, 60, 0], [0x90, 64, 0], [0xa0, 60, 33], [0xd1, 70], [0xe0, 0, 96], [0xb0, 1, 10], [0xb0, 64, 127], [0xb1, 74, 5], [0xf8], [0xfe], [0xf0, 1, 2, 0xf7], [0xc0, 3]]
  for (const m of sent) ds.captureAdd(cap, m)
  const sum = ds.captureSummary(cap)
  assert.equal(sum.noteOn, 2); assert.equal(sum.noteOff, 2); assert.equal(sum.lowestNote, 60); assert.equal(sum.highestNote, 62)
  assert.deepEqual(sum.velocity, { min: 80, max: 100 }); assert.deepEqual(sum.polyAftertouch, { count: 1, min: 33, max: 33 })
  assert.deepEqual(sum.channelPressure, { count: 1, min: 70, max: 70 }); assert.equal(sum.pitchBend.max, 96 << 7)
  assert.deepEqual(sum.modWheel, { min: 10, max: 10 }); assert.deepEqual(sum.sustainPedal, { min: 127, max: 127 })
  assert.deepEqual(sum.otherControllers.map((c) => c.cc), [74]); assert.deepEqual(sum.channels, [1, 2])
  assert.equal(sum.sendsClock, true); assert.equal(sum.sendsActiveSensing, true); assert.equal(sum.programChange, 1)
  const flat = JSON.stringify([cap, sum])
  assert.ok(!/"(notes|sequence|events|times?)"/.test(flat), 'no note list')
  const walk = (v) => { if (Array.isArray(v)) assert.ok(v.length <= 32 && v.every((x) => typeof x !== 'object' || x === null || !Array.isArray(x)), 'arrays stay short'); if (v && typeof v === 'object') Object.values(v).forEach(walk) }
  walk(cap); walk(sum)
  const big = ds.newCapture()
  for (let i = 0; i < 5000; i++) ds.captureAdd(big, [0x90, i % 128, 1 + (i % 127)])
  assert.ok(JSON.stringify(big).length < 1500, 'size does not grow with the music')
  const again = ds.newCapture(); for (const m of [...sent].reverse()) ds.captureAdd(again, m)
  assert.deepEqual(ds.captureSummary(again).otherControllers, sum.otherControllers, 'order is not stored')
  assert.equal(ds.captureAdd(ds.newCapture(), null).noteOn, 0)

  // ---- report builder ----
  const dirty = {
    app: { version: '0.3.0', platform: 'Mac' }, os: { platform: 'darwin', release: '25.5.0', arch: 'arm64' }, redact: ['jane'],
    ports: { inputs: [{ id: 'abc', name: "Jane's Piano /Users/jane/x", manufacturer: 'Example', state: 'connected', connection: 'open', serial: 'SECRET-SERIAL-9917', path: '/Users/jane/a' }], outputs: [] },
    identity: [{ port: 'Piano', manufacturerId: '00 21 10', family: '04 00', model: '15 00', version: '2.1.0.3', versionBytes: '02 01 00 03', serial: 'SECRET-SERIAL-9917' }],
    sysex: true, usb: { ok: true, source: 'ioreg', devices: [{ vendorId: '0x1234', productId: '0x0042', product: 'Piano', manufacturer: 'Ex', bcdDevice: '1.05', class: 'audio', serial: 'SECRET-SERIAL-9917', locationId: '0x01110000' }, { vendorId: 'bad', productId: 'x', product: 'drop-me-id' }] },
    capture: Object.assign(cap, { songTitle: 'Private Song', notes: [60, 62] }),
    lights: { tested: true, result: 'partly', colours: ['One colour only', 'Hacked colour'], route: 'MIDI notes' },
    keys: { chosen: 49, app: 49 }, date: '2026-11-09',
    about: { name: 'A'.repeat(200) + ' /Users/jane/Desktop', goals: ['Key lights', 'Invented goal'], works: ['Notes play'], doesNotWork: ['Key lights'],
      note: 'Serial number: SECRET-SERIAL-9917, mail me at jane@example.com\nfile C:\\Users\\Jane\\Music\\song.mid ```evil``` ' + 'x'.repeat(2000) },
    songTitle: 'Private Song', progress: { stars: 3 }, token: 'private-token', serial: 'SECRET-SERIAL-9917'
  }
  const text = ds.buildReport(dirty)
  for (const secret of ['SECRET-SERIAL-9917', '/Users/jane', 'Jane\\Music', 'jane@example.com', 'Private Song', 'private-token', 'Desktop', '0x01110000', 'Hacked colour', 'Invented goal', 'drop-me-id', 'stars', 'locationId'])
    assert.equal(text.toLowerCase().includes(secret.toLowerCase()), false, 'leaked ' + secret)
  assert.ok(!/jane/i.test(text), 'the user name is redacted')
  assert.ok(text.startsWith('Keylight device report\nschema: keylight-device-report/1'))
  assert.match(text, /Excluded: serial numbers, device locations, file paths, user names, song titles, recordings, progress, and the notes you played\./)
  assert.match(text, /Nothing is sent automatically/)
  const fences = text.match(/```/g); assert.equal(fences.length, 2, 'only the JSON fence is left')
  const data = JSON.parse(/```json\n([\s\S]*?)\n```/.exec(text)[1])
  assert.equal(data.schema, 'keylight-device-report/1'); assert.equal(data.date, '2026-11-09'); assert.equal(data.keys.chosen, 49)
  assert.ok(data.device.name.length <= 80); assert.ok(data.device.note.length <= 1000)
  assert.deepEqual(data.device.goals, ['Key lights']); assert.deepEqual(data.lights.colours, ['One colour only']); assert.equal(data.lights.result, 'partly')
  assert.equal(data.midi.identity[0].manufacturerId, '00 21 10'); assert.equal(data.usb.devices.length, 1); assert.equal(data.usb.devices[0].vendorId, '0x1234')
  assert.equal(data.capture.noteOn, 2); assert.equal(data.midi.inputs[0].idHash, ds.idHash('abc')); assert.notEqual(data.midi.inputs[0].idHash, 'abc')
  assert.ok(!('notes' in data.capture) && !('songTitle' in data.capture))
  assert.match(data.midi.inputs[0].name, /\[user\]'s Piano \[path removed\]/)
  const empty = ds.buildReport({})
  assert.equal(JSON.parse(/```json\n([\s\S]*?)\n```/.exec(empty)[1]).usb, null); assert.match(empty, /Key press test: skipped/); assert.match(empty, /USB devices: not available/)
  assert.match(ds.sanitizeText('a\u0000b\u0007c'), /^a b c$/)
  assert.equal(ds.sanitizeText('/variable and ~5 keys and and/or'), '/variable and ~5 keys and and/or')
  const size = ds.reportSize(text); assert.ok(size.chars === text.length && size.bytes >= size.chars)

  // ---- GitHub link ----
  const url = ds.buildIssueUrl(dirty)
  assert.ok(url.startsWith('https://github.com/scizerss/keylight-piano/issues/new?title=')); assert.ok(url.length <= 1800, String(url.length))
  const u = new URL(url)
  assert.equal(u.origin, 'https://github.com'); assert.deepEqual([...u.searchParams.keys()], ['title', 'body'])
  assert.match(u.searchParams.get('body'), /Please paste or attach the report/); assert.ok(u.searchParams.get('title').length < 70)
  assert.ok(!url.includes('SECRET') && !url.includes('schema') && !url.includes('```') && !/jane/i.test(url))
  const long = ds.buildIssueUrl({ about: { name: 'é&?#= '.repeat(60) }, os: { platform: 'x'.repeat(200) }, usb: { ok: true, devices: [] }, ports: { inputs: Array(24).fill({ name: 'p' }) } })
  assert.ok(long.length <= 1800 && long.startsWith('https://github.com/scizerss/keylight-piano/issues/new?'), String(long.length))
  assert.equal(isAllowedExternalUrl(url), true); assert.equal(isAllowedExternalUrl(long), true)
  const NEW = 'https://github.com/scizerss/keylight-piano/issues/new'
  assert.equal(isAllowedExternalUrl(NEW + '?body=b&title=a'), true, 'either order')
  for (const bad of [NEW + '?title=a', NEW + '?body=b', NEW + '?title=a&body=b&labels=bug', NEW + '?labels=bug&title=a&body=b', NEW + '?title=a&body=b&title=c', NEW + '?title=a&title=b',
    NEW + '?title=a&body=b%2520c', NEW + '?title=a&body=100%', NEW + '?title=a&body=b c', NEW + '?title=a&body=', NEW + '?title=a&body=b&', NEW + '?title=a&body=b#x', NEW + '?title=a&body=b%2f',
    'https://user:pw@github.com/scizerss/keylight-piano/issues/new?title=a&body=b', 'https://github.com:443/scizerss/keylight-piano/issues/new?title=a&body=b', 'https://github.com:8443/scizerss/keylight-piano/issues/new?title=a&body=b',
    'https://GitHub.com/scizerss/keylight-piano/issues/new?title=a&body=b', 'https://github.com./scizerss/keylight-piano/issues/new?title=a&body=b',
    'https://github.com\\scizerss\\keylight-piano\\issues\\new?title=a&body=b', 'https://github.com/scizerss/keylight-piano/issues\\new?title=a&body=b', 'https://github.com/scizerss/keylight-piano/issues/new/?title=a&body=b',
    'https://github.com/scizerss/keylight-piano/issues/%6Eew?title=a&body=b', 'https://github.com/scizerss/keylight-piano/issues/new?title=a&body=b&assignees=x',
    'https://github.com/scizerss/keylight-piano/issues/new', 'https://github.com/scizerss/keylight-piano/issues/new?title=a&assignees=x', 'https://github.com/scizerss/keylight-piano/issues/new?title=a&title=b',
    'https://github.com.evil.example/scizerss/keylight-piano/issues/new?title=a', 'https://evil.example/scizerss/keylight-piano/issues/new?title=a', 'http://github.com/scizerss/keylight-piano/issues/new?title=a',
    'https://github.com/scizerss/other/issues/new?title=a', 'https://github.com/scizerss/keylight-piano/issues/new?title=' + 'a'.repeat(2100), url + '#frag', 'https://user@github.com/scizerss/keylight-piano/issues/new?title=a'])
    assert.equal(isAllowedExternalUrl(bad), false, bad)

  // ---- free text: whole paths, serial aliases, machine names ----
  const clean = (t, redact = []) => ds.sanitizeText(t, 400, { redact })
  for (const [text, gone] of [['C:\\Users\\Jane Doe\\Music\\Private Song.mid', ['Doe', 'Private', 'Music']], ['see /Users/Jane Doe/My Songs/Private Song.mid please', ['Doe', 'Private', 'Songs']],
    ['\\\\NAS\\share\\Jane Doe\\x.mid', ['NAS', 'Doe']], ['Piano S/N: ABC12345', ['ABC12345']], ['SN 99887766', ['99887766']], ['serial number AB-12-CD', ['AB-12-CD']], ['UUID 123e4567-e89b-12d3-a456-426614174000', ['426614174000']],
    ['mac aa:bb:cc:dd:ee:ff here', ['aa:bb']], ['id 0123456789abcdef0123', ['0123456789ab']], ['mail jane@example.com', ['jane@']], ['~/Documents/Private Song.mid', ['Private']]])
    for (const g of gone) assert.equal(clean(text).includes(g), false, text + ' leaked ' + g)
  assert.equal(clean('Jane-MacBook.local MIDI Session', ['Jane-MacBook.local', 'Jane-MacBook']).includes('Jane'), false)
  assert.equal(clean('Jane-MacBook MIDI', ['jane-macbook', 'jane']).includes('Jane'), false)
  assert.equal(clean('serial lights and SN lights stay'), 'serial lights and SN lights stay')
  assert.equal(clean('https://github.com/scizerss/keylight-piano/issues/1'), 'https://github.com/scizerss/keylight-piano/issues/1')
  assert.equal(clean('Launchkey 49 MK3 and 00 21 10'), 'Launchkey 49 MK3 and 00 21 10')
  const tricky = ds.buildReport({ about: { name: 'Piano S/N: ABC12345', note: 'C:\\Users\\Jane Doe\\Music\\Private Song.mid' }, ports: { inputs: [{ id: 'x', name: 'Jane-MacBook.local MIDI Session' }] }, redact: ['Jane-MacBook.local', 'Jane-MacBook', 'jane'] })
  for (const g of ['ABC12345', 'Doe ', 'Doe\\', 'Private', 'Jane']) assert.equal(tricky.includes(g), false, 'report leaked ' + g)

  for (const [text, gone] of [['S/N: ABCDEFGH', ['ABCDEFGH']], ['s/n ABCDEFGH', ['ABCDEFGH']], ['Seriennummer: HELLOWORLD', ['HELLOWORLD']], ['serial number: NODIGITSHERE', ['NODIGITSHERE']], ['Serial: ABCDEFGH, more', ['ABCDEFGH']], ['serial # XYZXYZ', ['XYZXYZ']]])
    for (const g of gone) assert.equal(clean(text).includes(g), false, text + ' leaked ' + g)
  assert.equal(clean('S/N: ABCDEFGH, more'), 'S/N: [removed], more')

  // ---- Markdown structure: a CommonMark-style fence scan ----
  const fenceScan = (md) => {
    const blocks = []; let open = null
    for (const line of md.split('\n')) {
      const m = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line)
      if (!open) { if (m && !(m[1][0] === '`' && m[2].includes('`'))) open = { ch: m[1][0], len: m[1].length, info: m[2].trim(), lines: [] } ; continue }
      if (m && m[1][0] === open.ch && m[1].length >= open.len && m[2].trim() === '') { blocks.push(open); open = null } else open.lines.push(line)
    }
    return { blocks, unclosed: !!open }
  }
  for (const note of ['hello\n~~~\nhidden', '```\n```json\n{"schema":"evil"}\n```', '    ~~~\n~~~~~~\n# heading\n> quote\n| a | b |\n<script>x</script>', '~~~json\n{"schema":"x"}\n~~~', '`````\nstill hidden'])
    for (const name of ['plain', note]) {
      const out = ds.buildReport({ about: { name, note }, ports: { inputs: [{ id: 'a', name: note }] }, identity: [{ port: note, manufacturerId: '41' }] })
      const scan = fenceScan(out)
      assert.equal(scan.unclosed, false); assert.equal(scan.blocks.length, 1, 'one fenced block for: ' + JSON.stringify(note))
      assert.equal(scan.blocks[0].info, 'json'); assert.equal(JSON.parse(scan.blocks[0].lines.join('\n')).schema, 'keylight-device-report/1')
      assert.ok(out.trimEnd().endsWith('Review this report, then paste or attach it yourself.')); assert.match(out.split(/\n`{3,}\n/).pop(), /^\s*Excluded:/)
      assert.ok(!/^(#|>|\|)/m.test(out.split('\n').filter((l) => !l.startsWith('  > ')).join('\n')), 'no stray markdown line starts')
    }

  // ---- USB filters ----
  const mac = probe.parseMacProfiler(MAC_PROFILER)
  assert.deepEqual(mac.map((d) => d.product), ['Example Keyboard', 'USB MIDI Interface'])
  assert.deepEqual(mac[0], { vendorId: '0x1234', productId: '0x0042', product: 'Example Keyboard', manufacturer: 'Example Maker Ltd.', bcdDevice: '1.05', class: 'audio' })
  const ior = probe.parseIoreg(IOREG)
  assert.equal(ior.length, 1); assert.deepEqual(ior[0], { vendorId: '0x1234', productId: '0x0042', product: 'Example Digital Piano', manufacturer: 'Example Maker Ltd.', bcdDevice: '1.05', class: '' })
  const ps = probe.parsePowerShell(POWERSHELL)
  assert.deepEqual(ps.map((d) => d.product), ['USB Audio Device', 'Example Keyboard']); assert.equal(ps[0].class, 'audio'); assert.equal(ps[1].productId, '0x0043')
  for (const out of [mac, ior, ps]) {
    const flatUsb = JSON.stringify(out)
    for (const secret of ['SECRET-SERIAL', 'HUBSERIAL', 'APPLEBOARD', 'ROLAND123', '5&2A3B4C', '7&1F2E3D', '/Users/jane', 'location', '17891328', '0x0111'])
      assert.equal(flatUsb.includes(secret), false, 'usb leaked ' + secret)
    assert.deepEqual(Object.keys(out[0]).sort(), ['bcdDevice', 'class', 'manufacturer', 'product', 'productId', 'vendorId'])
  }
  assert.equal(probe.parseMacProfiler('not json'), null); assert.equal(probe.parsePowerShell('{'), null); assert.deepEqual(probe.parseIoreg(''), [])
  assert.deepEqual(probe.parsePowerShell(JSON.stringify({ FriendlyName: 'USB Audio Device', InstanceId: 'USB\\VID_0582&PID_012A\\S', Class: 'MEDIA' })).length, 1)
  await probe.ready()
  assert.equal(probe.cleanText('x\n/Users/a/b y').includes('/Users'), false)

  const viaUsb = probe.parseMacProfiler(JSON.stringify({ SPUSBDataType: [{ _items: [{ _name: 'C:\\Users\\Jane Doe\\Music\\Private Song.mid keyboard', vendor_id: '0x1234', product_id: '0x0042', manufacturer: 'Piano S/N: ABCDEFGH' }] }] }))
  assert.equal(viaUsb.length, 1); assert.equal(viaUsb[0].product, '[path removed]')
  for (const g of ['Doe', 'Private', 'Music', 'ABCDEFGH']) assert.equal(JSON.stringify(viaUsb).includes(g), false, 'usb leaked ' + g)
  const longPath = probe.parseMacProfiler(JSON.stringify({ SPUSBDataType: [{ _items: [{ _name: 'Piano ' + 'x'.repeat(60) + ' /Users/Jane Doe/Music/Private Song.mid', vendor_id: '0x1234', product_id: '0x0042', manufacturer: 'M' }] }] }))
  assert.ok(!/Doe|Private/.test(JSON.stringify(longPath)), 'sanitised before it is cut')
  assert.equal(require('node:fs').readFileSync(require.resolve('../renderer/usb-probe.cjs'), 'utf8').includes('PATH = '), false, 'one sanitiser only')

  // ---- the tools run safely and fail soft ----
  const calls = []
  const spawnWith = (stdout, code = 0) => (cmd, args, opts) => { calls.push({ cmd, args, opts }); const c = new EventEmitter(); c.stdout = new EventEmitter(); c.kill = () => {}; setImmediate(() => { c.stdout.emit('data', Buffer.from(stdout)); c.emit('close', code) }); return c }
  const okRun = await probe.collectUsb({ spawn: spawnWith(MAC_PROFILER), platform: 'darwin', exists: () => true })
  assert.equal(okRun.ok, true); assert.equal(okRun.source, 'system_profiler'); assert.equal(okRun.devices.length, 2)
  assert.deepEqual(Object.keys(okRun.os).sort(), ['arch', 'platform', 'release', 'version']); assert.ok(!JSON.stringify(okRun.devices).includes('SECRET'))
  assert.ok(calls.every((c) => c.opts.shell === false && Array.isArray(c.args) && c.opts.windowsHide === true), 'no shell, fixed arguments')
  assert.deepEqual(calls[0].args, ['SPUSBDataType', '-json'])
  const fallback = await probe.collectUsb({ spawn: (cmd, args, o) => (cmd.includes('system_profiler') ? spawnWith('', 1)(cmd, args, o) : spawnWith(IOREG)(cmd, args, o)), platform: 'darwin', exists: () => true })
  assert.equal(fallback.source, 'ioreg'); assert.equal(fallback.devices.length, 1)
  const win = await probe.collectUsb({ spawn: spawnWith(POWERSHELL), platform: 'win32', exists: () => true }); assert.equal(win.source, 'Get-PnpDevice')
  assert.ok(calls.at(-1).args.join(' ').includes('Get-PnpDevice')); assert.ok(calls.at(-1).args.every((a) => typeof a === 'string'))
  const failed = await probe.collectUsb({ spawn: () => { throw new Error('no such tool') }, platform: 'darwin', exists: () => true }); assert.equal(failed.ok, false); assert.deepEqual(failed.devices, [])
  const garbage = await probe.collectUsb({ spawn: spawnWith('garbage'), platform: 'win32', exists: () => true }); assert.equal(garbage.ok, false)
  const linux = await probe.collectUsb({ spawn: spawnWith('x'), platform: 'linux', exists: () => true }); assert.equal(linux.ok, false)
  const huge = await probe.collectUsb({ spawn: spawnWith('x'.repeat(300)), platform: 'darwin', exists: () => true, options: { maxBytes: 100, timeoutMs: 500 } }); assert.equal(huge.ok, false, 'output size cap')
  const slow = await probe.collectUsb({ spawn: () => { const c = new EventEmitter(); c.stdout = new EventEmitter(); c.kill = () => { c.killed = true }; return c }, platform: 'darwin', exists: () => true, options: { timeoutMs: 30 } }); assert.equal(slow.ok, false, 'timeout')

  // ---- trusted tool paths ----
  const winCalls = []
  const winSpawn = (cmd, args, o) => { winCalls.push({ cmd, args }); return spawnWith(POWERSHELL)(cmd, args, o) }
  await probe.collectUsb({ spawn: winSpawn, platform: 'win32', env: { SystemRoot: 'D:\\WinRoot' }, exists: () => true })
  assert.equal(winCalls[0].cmd, 'D:\\WinRoot\\System32\\WindowsPowerShell\\v1.0\\powershell.exe')
  assert.ok(/^[A-Za-z]:\\/.test(probe.windowsPowerShell({})), 'absolute even without SystemRoot')
  assert.ok(!winCalls[0].args.includes('Bypass') && !winCalls[0].args.includes('-ExecutionPolicy') && winCalls[0].args.slice(0, 3).join(' ') === '-NoProfile -NonInteractive -Command')
  const missing = []
  const gone = await probe.collectUsb({ spawn: (c) => { missing.push(c); throw new Error('must not run') }, platform: 'win32', env: { SystemRoot: 'C:\\Windows' }, exists: () => false })
  assert.equal(gone.ok, false); assert.equal(missing.length, 0, 'a missing tool is never spawned')
  for (const platform of ['darwin', 'win32']) for (const c of probe.commandsFor(platform, { SystemRoot: 'C:\\Windows' })) assert.ok(/^(\/|[A-Za-z]:\\)/.test(c.cmd), 'absolute: ' + c.cmd)
  const named = await probe.collectUsb({ spawn: spawnWith(MAC_PROFILER), platform: 'darwin', exists: () => true })
  assert.ok(named.redact.every((n) => typeof n === 'string' && n.length >= 3) && named.redact.length >= 1, 'names for blanking free text')
  assert.ok(!JSON.stringify(named.devices).includes(require('node:os').hostname()) || require('node:os').hostname().length < 3)

  // ---- one probe at a time, one per cooldown ----
  let spawned = 0, clock = 1000
  const slowCollect = () => new Promise((resolve) => { spawned++; setTimeout(() => resolve({ ok: true, devices: [], n: spawned }), 20) })
  const cached = probe.createCachedCollect(slowCollect, { cooldownMs: 3000, now: () => clock })
  const burst = await Promise.all(Array.from({ length: 100 }, () => cached()))
  assert.equal(spawned, 1, '100 calls, one probe'); assert.ok(burst.every((r) => r === burst[0]))
  clock += 1000; await cached(); assert.equal(spawned, 1, 'inside the cooldown: the cached answer')
  clock += 3000; await cached(); assert.equal(spawned, 2, 'after the cooldown: a new probe')
  const viaHandler = probe.createProbeHandler({ own: () => true, collect: probe.createCachedCollect(slowCollect, { cooldownMs: 3000, now: () => clock }) })
  spawned = 0
  await Promise.all(Array.from({ length: 100 }, () => viaHandler({ senderFrame: { url: 'x' } }))); assert.equal(spawned, 1)

  // ---- joined keyboards: the device capture sees every message exactly once ----
  const vm = require('node:vm'), src = require('node:fs').readFileSync(require.resolve('../renderer/app.js'), 'utf8')
  const single = src.slice(src.indexOf('function handleMidiMessage('), src.indexOf('function handleNoteOn('))
  const paired = src.slice(src.indexOf('const pair = '), src.indexOf('// With a light service,'))
  const fed = []
  const ctx = vm.createContext({ deviceSupport: { feed: (d, id) => fed.push([...d, id]) }, performanceControls: { send() {}, panic() {} }, settings: { expression: true, bendRange: 48, kbPair: {}, kbZero: 48 }, setup: { open: false, pressOf: new Map() }, rawLogged: 0, kbBase: () => 48,
    routeToJam: () => false, jamUi: null, mpeFor: () => ({ feed() {}, bendRangeFor: () => null }),
    saveSettings() {}, midiInput: { id: 'l' }, midiInput2: { id: 'r' }, handleNoteOn() {}, handleNoteOff() {}, setPolyPressure() {}, setSustain() {}, logMidi() {}, logExpr() {}, logRaw() {}, setBend() {}, setPressure() {}, setSlide() {}, stopAll() {}, console: { log() {} } })
  vm.runInContext(single + paired, ctx)
  const msgs = [[0x90, 50, 100], [0x80, 50, 0], [0xb0, 64, 127], [0xa0, 50, 30], [0xd0, 40], [0xe0, 0, 64], [0xb0, 1, 9], [0xf8]]
  for (const slot of [0, 1]) for (const m of msgs) ctx.pairMessage(slot, new Uint8Array(m))
  assert.equal(fed.length, msgs.length * 2, 'once per paired message'); assert.deepEqual([...new Set(fed.map((m) => m.at(-1)))], ['l', 'r'], 'each message carries its own port'); fed.length = 0
  for (const m of msgs) ctx.handleMidiMessage(new Uint8Array(m), 0, false, 'solo')
  assert.equal(fed.length, msgs.length, 'once per single-keyboard message'); assert.ok(fed.every((m) => m.at(-1) === 'solo'))

  // ---- one physical message is counted once, whichever order the binding changes in ----
  class Stub {
    constructor() { this.value = ''; this.textContent = ''; this.hidden = false; this.disabled = false; this.children = []; this.dataset = {}; this.style = { setProperty() {} }; this.classList = { toggle() {}, add() {}, remove() {} }; this.l = {} }
    addEventListener(t, fn) { (this.l[t] = this.l[t] || new Set()).add(fn) }
    removeEventListener(t, fn) { if (this.l[t]) this.l[t].delete(fn) }
    replaceChildren() {} append() {} setAttribute() {} focus() {} showModal() { this.open = true } close() { this.open = false }
    querySelectorAll() { return [] } querySelector() { return null }
  }
  const els = new Map()
  global.document = { getElementById: (id) => { if (!els.has(id)) els.set(id, new Stub()); return els.get(id) }, createElement: () => new Stub(), querySelectorAll: () => [] }
  const port = (id) => { const p = new Stub(); p.id = id; p.name = id; p.open = async () => p; p.emit = (data) => { for (const fn of p.l.midimessage || []) fn({ data }) }; return p }
  const first = port('a'), second = port('b')
  let boundNow = []
  const dsm = ds.mountDeviceSupport({ getMidi: () => ({ inputs: new Map([['a', first], ['b', second]]), outputs: new Map(), sysexEnabled: false }), boundInputs: () => boundNow, platform: 'Mac', version: 't', copy() {}, openLink() {} })
  const physical = (p, data) => { p.emit(data); if (boundNow.includes(p)) dsm.feed(data) }       // the app feeds what it has bound
  await dsm.startCapture()
  physical(first, [0x90, 60, 90])                              // unbound: counted directly
  boundNow = [first]                                           // pairing binds it mid-test
  physical(first, [0x90, 61, 90]); physical(second, [0x90, 62, 90])
  boundNow = [second]                                          // and moves to the other
  physical(first, [0x90, 63, 90]); physical(second, [0x90, 64, 90])
  boundNow = []
  physical(first, [0x90, 65, 90]); physical(second, [0x90, 66, 90])
  dsm.stopCapture(true)
  assert.equal(dsm.state().capture.noteOn, 7, 'every message exactly once')
  boundNow = [first, second]
  await dsm.startCapture(); physical(first, [0x90, 60, 90]); physical(second, [0x90, 60, 90]); dsm.stopCapture(true)
  assert.equal(dsm.state().capture.noteOn, 2, 'bound from the start: counted once')
  assert.ok((first.l.midimessage || new Set()).size === 0 && (second.l.midimessage || new Set()).size === 0, 'listeners removed')
  // 3 and 7 in the wizard: choices survive a refresh (also an empty selection), and 13+ selected devices all reach the report
  {
    const gadgets = Array.from({ length: 30 }, (_v, i) => ({ vendorId: '0x1111', productId: '0x' + (i + 1).toString(16).padStart(4, '0'), product: 'Gadget ' + i, manufacturer: 'Maker', bcdDevice: '', class: '' }))
    const gp = port('Gadget')
    const w = ds.mountDeviceSupport({ getMidi: () => ({ inputs: new Map([['Gadget', gp]]), outputs: new Map(), sysexEnabled: false }), boundInputs: () => [], platform: 'Mac', version: 't', copy() {}, openLink() {},
      usbProbe: async () => ({ ok: true, source: 'system_profiler', devices: gadgets, os: { platform: 'darwin', release: '27.0.0', arch: 'arm64', version: '27.0' }, redact: [] }) })
    await w.detect()
    assert.equal(w.state().usbPick.size, 24, 'defaults tick what shares a word with a port, up to the shared cap'); assert.equal(w.state().os.version, '27.0')
    let r = w.usbForReport(); assert.equal(r.devices.length, 24); assert.equal(r.shown, 24)
    assert.equal(JSON.parse(/```json\n([\s\S]*?)\n```/.exec(w.preview())[1]).usb.devices.length, 24, '13 or more selected devices all reach the report')
    for (const g of gadgets) w.state().usbChoice.set([g.vendorId, g.productId, g.product].join('|'), false)   // the person unticked everything
    w.state().usbPick.clear()
    await w.detect()
    assert.equal(w.state().usbPick.size, 0, 'Look again keeps an intentionally empty selection'); assert.equal(w.usbForReport().devices.length, 0)
    w.state().usbChoice.set([gadgets[3].vendorId, gadgets[3].productId, gadgets[3].product].join('|'), true)
    await w.detect(); assert.deepEqual([...w.state().usbPick], [3], 'a kept choice for a device that is still there')
    w.cancelDetect()
  }
  delete global.document


  // ---- exp5: the tester's tree (bus -> hub -> hub -> devices), every device listed, nothing guessed by name ----
  const TESTER = {
    SPUSBDataType: [
      { _name: 'USB31Bus', host_controller: 'AppleT8103USBXHCI', _items: [
        { _name: 'USB2.1 Hub', vendor_id: '0x05e3  (Genesys Logic, Inc.)', product_id: '0x0610', manufacturer: 'GenesysLogic', serial_num: 'HUBSER1', location_id: '0x01000000 / 1', _items: [
          { _name: 'USB 2.0 Hub [MTT]', vendor_id: '0x2109  (VIA Labs, Inc.)', product_id: '0x2817', serial_num: 'HUBSER2', location_id: '0x01100000 / 2', _items: [
            { _name: 'ROLI Airwave Pedal', vendor_id: '0x2af4', product_id: '0x1000', manufacturer: 'Roli Ltd.', bcd_device: '1.00', serial_num: 'PEDALSERIAL', location_id: '0x01110000 / 5' },
            { _name: 'Tracking Camera', vendor_id: '0x2936', product_id: '0x1202', manufacturer: 'Ultraleap', bcd_device: '3.94', serial_num: 'LE31SECRET', location_id: '0x01120000 / 6' } ] } ] },
        { _name: 'USB Optical Mouse', vendor_id: '0x046d  (Logitech Inc.)', product_id: '0xc077', manufacturer: 'Logitech', bcd_device: '72.00', serial_num: 'MOUSESER', location_id: '0x01200000 / 3' },
        { _name: 'Extreme SSD', vendor_id: '0x0781  (SanDisk Corp.)', product_id: '0x5581', serial_num: 'DRIVESER', location_id: '0x01300000 / 4', Media: [{ _name: 'Extreme', bsd_name: 'disk4', volumes: [{ mount_point: '/Volumes/Jane Private' }] }] },
        { _name: 'Apple Internal Hub', vendor_id: 'apple_vendor_id', product_id: '0x8007', manufacturer: 'Apple Inc.', serial_num: 'APPLEHUB', _items: [
          { _name: 'Apple Internal Keyboard / Trackpad', vendor_id: 'apple_vendor_id', product_id: '0x0340', manufacturer: 'Apple Inc.', serial_num: 'APPLEKB' } ] } ] } ] }
  const tester = probe.parseMacProfiler(JSON.stringify(TESTER))
  assert.deepEqual(tester.map((d) => d.product), ['ROLI Airwave Pedal', 'Tracking Camera', 'USB Optical Mouse', 'Extreme SSD'], 'every non-hub, non-Apple device, in tree order')
  assert.deepEqual(tester[1], { vendorId: '0x2936', productId: '0x1202', product: 'Tracking Camera', manufacturer: 'Ultraleap', bcdDevice: '3.94', class: '' })
  assert.equal(tester[2].manufacturer, 'Logitech'); assert.equal(tester[3].manufacturer, 'SanDisk Corp.', 'maker read from the vendor_id text when manufacturer is missing')
  for (const secret of ['SERIAL', 'LE31SECRET', 'SER1', 'location', '0x0111', '/Volumes', 'Jane Private', 'disk4', 'APPLE']) assert.equal(JSON.stringify(tester).includes(secret), false, 'tester tree leaked ' + secret)
  // any depth: 11 levels deep is found, past the cap of 12 is not, and a missing key never throws
  const nest = (depth) => { let node = { _name: 'Deep Sensor', vendor_id: '0x2936', product_id: '0x1202' }; for (let i = 0; i < depth; i++) node = { _name: 'Hub ' + i, _items: [node] }; return { SPUSBDataType: [node] } }
  assert.equal(probe.parseMacProfiler(JSON.stringify(nest(11))).length, 1); assert.equal(probe.parseMacProfiler(JSON.stringify(nest(300))).length, 0, 'depth cap, no stack overflow')
  const wide = { SPUSBDataType: [{ _items: Array.from({ length: 5000 }, (_v, i) => ({ _name: 'Gadget ' + i, vendor_id: '0x1111', product_id: '0x' + (i % 65536).toString(16).padStart(4, '0') })) }] }
  assert.ok(probe.parseMacProfiler(JSON.stringify(wide)).length <= 40, 'node and device caps')
  assert.deepEqual(probe.parseMacProfiler(JSON.stringify({ SPUSBHostDataType: [{ _items: [{ _name: 'X Sensor', vendor_id: 4660, product_id: 66, bcd_device: '0x0394' }] }] })).map((d) => [d.vendorId, d.productId, d.bcdDevice]), [['0x1234', '0x0042', '3.94']], 'new root key, numeric ids, hex bcd')
  for (const odd of [{}, { SPUSBDataType: [] }, { SPUSBDataType: [null, 5, 'x', [], { _items: 'no' }, { _items: [null] }, { vendor_id: '0x2936' }] }]) assert.deepEqual(probe.parseMacProfiler(JSON.stringify(odd)), [])
  assert.equal(probe.parseMacProfiler('null'), null); assert.equal(probe.parseMacProfiler('"x"'), null)

  // the probe says why it failed, and fills in the real macOS version
  const spawnByCmd = (table) => (cmd, args, o) => { const hit = table[cmd]; return hit ? spawnWith(hit[0], hit[1] || 0)(cmd, args, o) : spawnWith('', 1)(cmd, args, o) }
  const withVersion = await probe.collectUsb({ spawn: spawnByCmd({ '/usr/sbin/system_profiler': [JSON.stringify(TESTER)], '/usr/bin/sw_vers': ['27.0\n'] }), platform: 'darwin', exists: () => true })
  assert.equal(withVersion.os.version, '27.0'); assert.equal(withVersion.devices.length, 4)
  const swCall = calls.filter((c) => c.cmd === '/usr/bin/sw_vers').at(-1); assert.deepEqual(swCall.args, ['-productVersion']); assert.equal(swCall.opts.shell, false)
  const badVersion = await probe.collectUsb({ spawn: spawnByCmd({ '/usr/sbin/system_profiler': [JSON.stringify(TESTER)], '/usr/bin/sw_vers': ['rm -rf /; 27.0'] }), platform: 'darwin', exists: () => true })
  assert.equal(badVersion.os.version, '', 'only a version number is accepted')
  const noProfiler = await probe.collectUsb({ spawn: spawnByCmd({ '/usr/sbin/system_profiler': ['not json'], '/usr/sbin/ioreg': ['not an ioreg listing'] }), platform: 'darwin', exists: () => true })
  assert.equal(noProfiler.ok, true, 'ioreg answered, empty'); assert.equal(noProfiler.source, 'ioreg')
  const dead = await probe.collectUsb({ spawn: spawnByCmd({ '/usr/sbin/system_profiler': ['not json'] }), platform: 'darwin', exists: (c) => c.includes('system_profiler') })
  assert.equal(dead.ok, false); assert.equal(dead.reason, 'unreadable output')
  assert.equal((await probe.collectUsb({ spawn: spawnWith('', 1), platform: 'darwin', exists: (c) => c.includes('system_profiler') })).reason, 'tool failed')
  assert.equal((await probe.collectUsb({ spawn: () => { throw new Error('x') }, platform: 'darwin', exists: (c) => c.includes('system_profiler') })).reason, 'could not start')
  assert.equal((await probe.collectUsb({ spawn: spawnWith('x'), platform: 'darwin', exists: () => false })).reason, 'tool not found')

  // ---- checklist defaults: a shared word with any MIDI port name or maker ----
  const midiPorts = [{ name: 'ROLI Airwave Pedal', manufacturer: 'Roli Ltd.' }, { name: 'ROLI Airwave Expression', manufacturer: '' }, { name: 'ROLI Piano', manufacturer: 'ROLI Ltd.' }]
  assert.deepEqual(ds.defaultUsbPicks(tester, midiPorts), [true, false, false, false], 'only the pedal is ticked; the Ultraleap camera is offered, unticked')
  assert.deepEqual(ds.defaultUsbPicks(tester, []), [false, false, false, false]); assert.deepEqual(ds.defaultUsbPicks(null, midiPorts), []); assert.deepEqual(ds.defaultUsbPicks([null, {}], midiPorts), [false, false])
  assert.deepEqual(ds.defaultUsbPicks([{ product: 'USB MIDI Device', manufacturer: 'Corp Inc.' }], [{ name: 'USB MIDI Device', manufacturer: 'Corp Inc.' }]), [false], 'generic words do not tick anything')
  assert.equal(ds.guessDeviceName([{ name: 'ROLI Airwave Pedal' }, { name: 'ROLI Airwave Expression' }, { name: 'ROLI Piano' }], []), 'ROLI Piano')
  assert.equal(ds.guessDeviceName([{ name: 'Pedal Port' }], [{ port: 'Example Board' }]), 'Example Board'); assert.equal(ds.guessDeviceName([], []), '')

  // ---- per-port capture ----
  const hA = ds.idHash('in-a'), hB = ds.idHash('in-b'), hC = ds.idHash('in-c')
  const pc = ds.newCapture()
  for (const [m, id] of [[[0x90, 60, 80], 'in-a'], [[0x80, 60, 0], 'in-a'], [[0xd0, 70], 'in-b'], [[0xd0, 20], 'in-b'], [[0xb0, 74, 9], 'in-b'], [[0xe0, 0, 64], 'in-b'], [[0xc0, 3], 'in-b'], [[0xf0, 1, 0xf7], 'in-b'],
    [[0x90, 50, 40], 'in-c'], [[0x91, 52, 41], 'in-c'], [[0x92, 54, 42], 'in-c'], [[0x93, 56, 43], 'in-c'], [[0xfe], 'in-a']]) ds.captureFeed(pc, new Uint8Array(m), id)
  const rows = ds.portSummaries(pc, [{ id: 'in-a', name: 'Port A' }, { id: 'in-b', name: 'Port B' }, { id: 'in-c', name: 'Port C' }, { id: 'in-d', name: 'Silent' }])
  const [ra, rb, rc, rd] = rows
  assert.deepEqual(rows.map((r) => r.id), [hA, hB, hC, ds.idHash('in-d')]); assert.ok(!JSON.stringify(rows).includes('in-a'), 'the raw id never reaches the report rows'); assert.equal(ra.noteOn, 1); assert.equal(ra.mpeLike, false); assert.deepEqual(ra.channels, [1])
  assert.deepEqual(rb.channelPressure, { count: 2, min: 20, max: 70 }); assert.equal(rb.pitchBend.count, 1); assert.deepEqual(rb.controllers, [{ cc: 74, count: 1, min: 9, max: 9 }]); assert.equal(rb.programChange, 1); assert.equal(rb.sysexMessages, 1); assert.equal(rb.noteOn, 0)
  assert.equal(rc.mpeLike, true); assert.deepEqual(rc.channels, [1, 2, 3, 4]); assert.equal(rd.messages, 0); assert.equal('noteOn' in rd, false)
  assert.equal(ds.captureSummary(pc).noteOn, 5, 'the aggregate still counts everything'); assert.equal(pc.messages, 13)
  // a flood: nothing is kept per note, ports are capped, controllers are capped at 16, unknown ids are ignored
  const flood = ds.newCapture()
  for (let i = 0; i < 20000; i++) ds.captureFeed(flood, [0x90 + (i % 16), i % 128, 1 + (i % 127)], 'p' + (i % 40))
  for (let c = 0; c < 100; c++) ds.captureFeed(flood, [0xb0, c, 5], 'p0')
  assert.ok(Object.keys(flood.ports).length <= 24, 'ports capped'); assert.ok(JSON.stringify(flood).length < 40000, 'size does not grow with the music: ' + JSON.stringify(flood).length)
  assert.ok(Object.keys(flood.ports['p:p0'].cc).length <= 16, 'controllers capped per port'); assert.equal(flood.messages, 20100)
  assert.ok(!/"(notes|sequence|events|times?)"/.test(JSON.stringify(flood)))
  assert.deepEqual(ds.normalizeCapture(JSON.parse(JSON.stringify(flood))).ports['p:p0'].noteChannels, flood.ports['p:p0'].noteChannels)
  assert.deepEqual(ds.normalizeCapture({ ports: { x: { noteOn: 5 }, 'p:a': { noteOn: 'many', velocity: { count: 1, min: 500, max: 1 } } } }).ports, { 'p:a': ds.normalizeCapture({}, 1) })

  // ---- the report with the new fields ----
  const fresh = {
    app: { version: '0.3.0', platform: 'Mac' }, os: { platform: 'darwin', release: '27.0.0', arch: 'arm64', version: '27.0' },
    ports: { inputs: [{ id: 'in-a', name: 'ROLI Airwave Pedal', manufacturer: 'Roli Ltd.' }, { id: 'in-b', name: 'ROLI Airwave Expression' }, { id: 'in-c', name: 'ROLI Piano' }], outputs: [] },
    usb: { ok: true, source: 'system_profiler', shown: 4, devices: [tester[0], tester[1]] }, capture: pc, about: { name: 'ROLI Piano' }, date: '2026-11-09'
  }
  const rep = ds.buildReport(fresh)
  assert.match(rep, /System: macOS 27\.0 \(Darwin 27\.0\.0\) arm64/); assert.match(rep, /USB devices: 2 of 4 shown \(system_profiler\)/); assert.match(rep, /Per input port/)
  assert.match(rep, /ROLI Airwave Expression \| id: [0-9a-f]{8} \| messages: 6/); assert.match(rep, /notes sounded together on separate channels/)
  const fr = JSON.parse(/```json\n([\s\S]*?)\n```/.exec(rep)[1])
  assert.equal(fr.schema, 'keylight-device-report/1'); assert.equal(fr.schemaRevision, 2); assert.equal(fr.os.version, '27.0'); assert.equal(fr.usb.shown, 4); assert.equal(fr.usb.devices.length, 2)
  assert.equal(fr.capture.ports.length, 3); assert.equal(fr.capture.ports[1].name, 'ROLI Airwave Expression'); assert.equal(fr.capture.ports[2].mpeLike, true); assert.equal(fr.capture.ports[1].id, ds.idHash('in-b'))
  for (const gone of ['USB Optical Mouse', 'Extreme SSD', 'Logitech', 'SanDisk', 'Jane']) assert.equal(rep.includes(gone), false, 'unticked device named: ' + gone)
  assert.match(ds.buildReport({ ...fresh, usb: { ok: false, reason: 'unreadable output' } }), /USB probe unavailable: unreadable output/)
  assert.equal(JSON.parse(/```json\n([\s\S]*?)\n```/.exec(ds.buildReport({ ...fresh, usb: { ok: false, reason: 'tool failed' } }))[1]).usb.available, false)
  assert.match(ds.buildReport({ os: { platform: 'win32', release: '10.0.22631', arch: 'x64', version: 'Windows 11 Pro' } }), /System: Windows 11 Pro \(build 10\.0\.22631\) x64/)
  assert.match(ds.buildReport({ os: { platform: 'darwin', release: '27.0.0', arch: 'arm64' } }), /System: macOS \(Darwin kernel\) 27\.0\.0 arm64/, 'no version: the old line')
  const withoutPorts = ds.buildReport({ ...fresh, capture: undefined }); assert.match(withoutPorts, /Key press test: skipped/)


  // ---- codex review fixes ----
  // 1. personal names: the exact repro, with and without the system's own name data
  const jane = (t, redact) => ds.sanitizeText(t, 80, { redact })
  assert.equal(jane("Jane's iPad", ['janedoe']).includes('Jane'), false); assert.equal(jane("Jane's iPad", []).includes('Jane'), false); assert.equal(jane('Jane’s iPad', []), "[name]’s iPad")
  assert.equal(jane("Magdy's Piano", undefined), "[name]'s Piano"); assert.equal(jane("Janedoe Piano", ['janedoe']), '[user] Piano')
  assert.equal(jane('Cjs Piano', ['Cjs-Mac-mini']).includes('Cjs'), false); assert.equal(jane('Mac mini Piano', ['Cjs-Mac-mini']), 'Mac mini Piano', 'everyday words stay')
  assert.equal(jane('Jane Keyboard', ['janedoe']).includes('Jane'), false, 'a prefix of the user name')
  assert.equal(jane("It's a keyboard and what's up", []), "It's a keyboard and what's up", 'ordinary contractions stay')
  // multi-word owner names: the name-like words before the possessive go with it
  assert.equal(jane("Jane Doe's iPad", []), "[name]'s iPad")
  assert.equal(jane("Mary Jane Watson's Keyboard", []), "[name]'s Keyboard")
  assert.equal(jane("José García's Piano", []), "[name]'s Piano")
  assert.equal(jane("Anne-Marie's Piano", []), "[name]'s Piano")
  assert.equal(jane("USB Jane's Piano", []), "USB [name]'s Piano")
  assert.equal(jane("MIDI Jane Doe's Piano", []), "MIDI [name]'s Piano")
  assert.equal(jane("Jane's iPad", []), "[name]'s iPad")
  assert.equal(jane('LUMI Keys Block 1', []), 'LUMI Keys Block 1')
  for (const [field, build] of [['name', (n) => ({ about: { name: n } })], ['port', (n) => ({ ports: { inputs: [{ id: 'x', name: n }] } })]]) {
    const rep2 = ds.buildReport({ ...build("Jane's iPad"), redact: ['janedoe'] }); assert.equal(/Jane/.test(rep2), false, 'report leaked a name via ' + field)
    assert.equal(/Jane/.test(ds.buildIssueUrl({ ...build("Jane's iPad"), redact: ['janedoe'] })), false)
  }
  assert.equal(probe.cleanText("Jane's Hub").includes('Jane'), false)

  // 2. the sentence the Detect and Review steps carry, and docs
  const html = require('node:fs').readFileSync(require.resolve('../renderer/index.html'), 'utf8')
  assert.ok(html.includes('The names of your MIDI ports are part of this report'), 'Review note'); assert.ok(html.includes('id="dsNameHint"'))
  assert.ok(require('node:fs').readFileSync(require.resolve('../renderer/device-support.js'), 'utf8').includes('The names of your MIDI ports are part of the report: you will see them on the Review step before anything is shared.'))

  // 4. hostile profiler output: always an answer, never a throw
  const nulls = JSON.stringify({ SPUSBDataType: new Array(150000).fill(null) })
  assert.deepEqual(probe.parseMacProfiler(nulls), [])
  const kids = JSON.stringify({ SPUSBDataType: [{ _items: new Array(150000).fill(null) }] }); assert.deepEqual(probe.parseMacProfiler(kids), [])
  const bomb = await probe.collectUsb({ spawn: spawnWith(nulls), platform: 'darwin', exists: () => true, options: { maxBytes: 4000000 } })
  assert.equal(bomb.ok, true, 'ioreg or profiler answered'); assert.ok(Array.isArray(bomb.devices))
  const thrower = await probe.collectUsb({ spawn: spawnWith('{}'), platform: 'darwin', exists: () => true }); assert.ok(typeof thrower.reason === 'string')
  const evil = await probe.collectUsb({ spawn: () => { throw new RangeError('x') }, platform: 'darwin', exists: () => true }); assert.equal(evil.ok, false); assert.ok(evil.reason)
  const rejects = await probe.collectUsb({ spawn: spawnWith(MAC_PROFILER), platform: 'darwin', exists: () => { throw new Error('boom') } }); assert.equal(rejects.ok, false); assert.equal(rejects.reason, 'unexpected error')

  // 5. two ids with the same short hash stay two ports
  assert.equal(ds.idHash('costarring'), ds.idHash('liquid'), 'the collision this test relies on')
  const col = ds.newCapture()
  ds.captureFeed(col, [0x90, 60, 90], 'costarring'); ds.captureFeed(col, [0x90, 70, 90], 'liquid'); ds.captureFeed(col, [0x90, 71, 90], 'liquid')
  const colRows = ds.portSummaries(col, [{ id: 'costarring', name: 'One' }, { id: 'liquid', name: 'Two' }])
  assert.deepEqual(colRows.map((r) => [r.name, r.noteOn]), [['One', 1], ['Two', 2]]); assert.deepEqual(colRows.map((r) => r.id), ['5e4daa9d', '5e4daa9d-2'])
  const colRep = JSON.parse(/```json\n([\s\S]*?)\n```/.exec(ds.buildReport({ ports: { inputs: [{ id: 'costarring', name: 'One' }, { id: 'liquid', name: 'Two' }] }, capture: col }))[1])
  assert.deepEqual(colRep.midi.inputs.map((p) => p.idHash), ['5e4daa9d', '5e4daa9d-2']); assert.deepEqual(colRep.capture.ports.map((p) => p.id), colRep.midi.inputs.map((p) => p.idHash))

  // 6. "one channel per note" only when measured
  const feedAll = (list) => { const c = ds.newCapture(); for (const m of list) ds.captureFeed(c, m, 'z'); return ds.portSummaries(c, [{ id: 'z', name: 'Z' }])[0] }
  const twoEach = feedAll([[0x90, 60, 80], [0x90, 61, 80], [0x91, 62, 80], [0x91, 63, 80], [0x92, 64, 80], [0x92, 65, 80]])
  assert.equal(twoEach.mpeLike, false, 'two notes at once on each of three channels is not one channel per note'); assert.deepEqual(twoEach.noteChannels, [1, 2, 3])
  assert.equal(feedAll([[0x90, 60, 80], [0x91, 62, 80], [0x92, 64, 80]]).mpeLike, true, 'three notes at once on three channels')
  assert.equal(feedAll([[0x90, 60, 80], [0x80, 60, 0], [0x91, 62, 80], [0x81, 62, 0], [0x92, 64, 80], [0x82, 64, 0]]).mpeLike, false, 'three channels one after the other: only the fact is reported')
  assert.match(ds.buildReport({ ports: { inputs: [{ id: 'z', name: 'Z' }] }, capture: (() => { const c = ds.newCapture(); for (const m of [[0x90, 60, 80], [0x80, 60, 0], [0x91, 62, 80], [0x81, 62, 0], [0x92, 64, 80]]) ds.captureFeed(c, m, 'z'); return c })() }), /notes arrived on channels 1, 2, 3/)
  const noSeq = JSON.stringify(feedAll([[0x90, 60, 80], [0x91, 62, 80], [0x92, 64, 80]])); assert.ok(!/held|sequence|times?/.test(noSeq))


  // last round: name variants, long ids, channel-mode messages
  assert.equal(jane('janes-ipad', ['janedoe']).includes('janes'), false); assert.equal(jane('JANE-DOE-MBP', ['janedoe']).includes('DOE'), false); assert.equal(jane('JANE-DOE-MBP', ['janedoe']).includes('JANE'), false)
  assert.equal(jane("jane's piano", []).includes('jane'), false); assert.equal(jane('JANE\u2019S PIANO', []).includes('JANE'), false); assert.equal(jane('Jane Doe', ['janedoe']).includes('Doe'), false, 'components that spell the name')
  assert.equal(jane('Jane_Doe iPad', ['janedoe']).includes('Doe'), false); assert.equal(jane("it's the keyboard's pedal", []), "it's the keyboard's pedal"); assert.equal(jane('Mac mini', ['Cjs-Mac-mini']), 'Mac mini')
  const base = 'x'.repeat(250), idA = base + 'a'.repeat(50), idB = base + 'b'.repeat(50)
  const longCap = ds.newCapture(); ds.captureFeed(longCap, [0x90, 60, 90], idA); ds.captureFeed(longCap, [0x90, 61, 90], idB); ds.captureFeed(longCap, [0x90, 62, 90], idB)
  assert.deepEqual(ds.portSummaries(longCap, [{ id: idA, name: 'A' }, { id: idB, name: 'B' }]).map((r) => [r.name, r.noteOn]), [['A', 1], ['B', 2]], 'ids that share a long prefix stay two ports')
  for (const cc of [120, 123]) assert.equal(feedAll([[0x90, 60, 80], [0xb0, cc, 0], [0x91, 62, 80], [0xb1, cc, 0], [0x92, 64, 80]]).mpeLike, false, 'CC' + cc + ' clears what is sounding: sequential notes are not MPE-like')
  assert.equal(feedAll([[0x90, 60, 80], [0xb1, 123, 0], [0x91, 62, 80], [0x92, 64, 80]]).mpeLike, true, 'a message on another channel clears nothing here')
  // 7. checklist and report share one cap, and the UI says when it cut
  const many = Array.from({ length: 30 }, (_v, i) => ({ vendorId: '0x1111', productId: '0x' + (i + 1).toString(16).padStart(4, '0'), product: 'Gadget ' + i, manufacturer: 'Maker', bcdDevice: '', class: '' }))
  assert.equal(ds.USB_MAX, 24)
  assert.equal(JSON.parse(/```json\n([\s\S]*?)\n```/.exec(ds.buildReport({ usb: { ok: true, source: 's', shown: 24, devices: many } }))[1]).usb.devices.length, 24)

  // ---- IPC argument validation ----
  let collected = 0
  const handler = probe.createProbeHandler({ own: (url) => url === 'http://127.0.0.1:1234/index.html', collect: () => { collected++; return { ok: true, devices: [] } } })
  const own = { senderFrame: { url: 'http://127.0.0.1:1234/index.html' } }
  assert.deepEqual(await handler(own), { ok: true, devices: [] }); assert.equal(collected, 1)
  for (const [event, args] of [[own, ['rm -rf /']], [own, [{ cmd: 'x' }]], [own, [null]], [{ senderFrame: { url: 'https://evil.example/' } }, []], [{ senderFrame: {} }, []], [{}, []], [undefined, []]]) {
    const r = await handler(event, ...args); assert.equal(r.ok, false); assert.equal(r.reason, 'refused')
  }
  assert.equal(collected, 1, 'refused calls run nothing')
  console.log('device-support: identity parser, capture statistics, report privacy, issue link, USB filters, tool limits and IPC validation pass')
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
