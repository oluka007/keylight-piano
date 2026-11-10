// Per-key LED control via the blocksd daemon (https://github.com/hyperb1iss/blocksd).
//
// blocksd owns the ROLI protocol: it uploads a LittleFoot renderer to the keyboard,
// keeps API mode alive, and exposes a local WebSocket API. We send one RGB888 frame
// per keyboard (24 keys each) at up to 30 fps; frames are coalesced and ACK-gated.
//
// The device UID is a 64-bit integer, which JavaScript cannot represent exactly -
// so the UID is kept as raw decimal text and spliced into the JSON by hand.

// The packaged Mac app starts its own blocksd on a random loopback port and passes it as
// ?daemonPort=N; otherwise (a blocksd installed by hand, a development checkout) it is 9010.
export function daemonPort(search = typeof location !== 'undefined' ? location.search : '') {
  const n = Number(new URLSearchParams(search).get('daemonPort'))
  return Number.isInteger(n) && n >= 1024 && n <= 65535 ? n : 9010
}
// True when the app carries its own light service (the packaged Mac app)
export function bundledDaemon(search = typeof location !== 'undefined' ? location.search : '') {
  return new URLSearchParams(search).get('bundledDaemon') === '1'
}
// The service's state when the page loaded: starting | ready | failed | external
export function daemonStart(search = typeof location !== 'undefined' ? location.search : '') {
  const v = new URLSearchParams(search).get('daemonStart')
  return ['starting', 'ready', 'failed', 'external'].includes(v) ? v : 'starting'
}
const KEY_COUNT = 24
const INFO_ID = 'lumi-app-info'      // the battery check's discover (the level only comes with one)
const INFO_MS = 60000

// What blocksd reports about a keyboard, for onStatus. battery_level is the device's raw
// 5-bit reading (0-31), so it becomes a percentage here.
export function deviceInfo(dev) {
  if (!dev) return null
  const level = dev.battery_level == null ? NaN : Number(dev.battery_level)
  return {
    type: dev.block_type || dev.device_type || '',
    keyCount: Number(dev.key_count) > 0 ? Number(dev.key_count) : KEY_COUNT,
    battery: Number.isFinite(level) ? Math.round((Math.max(0, Math.min(31, level)) / 31) * 100) : null,
    charging: !!dev.battery_charging
  }
}
const describe = (d) => (d ? ' keys=' + d.keyCount + (d.battery != null ? ' battery=' + d.battery + '%' + (d.charging ? ' charging' : '') : '') : '')

export class LedDaemon {
  constructor(onStatus, onButton, onConfig) {
    this.onStatus = onStatus || (() => {})
    this.onButton = onButton || (() => {})
    this.onConfig = onConfig || (() => {})
    this.lastConfig = {}
    this.ws = null
    this.boards = []        // the keyboards being driven, left to right: { uidText, serial, device, pending, busy }
    this.leftSerial = ''    // which of two keyboards is on the left, where someone has said so
    this.closed = false
    this.reconnectTimer = null
    this.discoverTimer = null
    this.frames = 0
    this.rejects = 0
    this.lastSig = ''      // the last frame asked for, so unchanged frames can be skipped
    this.infoTimer = null
    this.port = daemonPort()
  }

  get ready() { return !!(this.ws && this.boards.length) }
  get count() { return this.boards.length }
  get uidText() { return this.boards.length ? this.boards[0].uidText : null }
  get device() { return this.boards.length ? this.boards[0].device : null }   // deviceInfo() of the first keyboard
  get devices() { return this.boards.map((b) => b.device).filter(Boolean) }   // deviceInfo() of every keyboard

  connect() {
    this.closed = false
    if (this.ws) return
    let ws
    try { ws = new WebSocket(`ws://127.0.0.1:${this.port}/ws`) } catch (e) { this.onStatus('unavailable', e.message); this.scheduleReconnect(); return }
    this.ws = ws
    ws.onopen = () => {
      // device events arrive even before a keyboard is found, so a late keyboard is picked up
      try { ws.send(JSON.stringify({ type: 'subscribe', events: ['button', 'device'] })) } catch {}
      this.discover()
      // ask again now and then, for the battery level
      clearInterval(this.infoTimer)
      this.infoTimer = setInterval(() => this.refreshInfo(), INFO_MS)
    }
    ws.onmessage = (ev) => this.handle(String(ev.data))
    ws.onclose = () => {
      this.ws = null; this.boards = []
      clearTimeout(this.discoverTimer); this.discoverTimer = null
      clearInterval(this.infoTimer); this.infoTimer = null
      this.onStatus('disconnected')
      this.scheduleReconnect()
    }
    ws.onerror = () => {}
  }

  // The service moved to another port (the app restarted it, or found another one): reconnect there
  setPort(port) {
    if (!Number.isInteger(port) || port === this.port) return
    this.port = port
    if (this.ws) { try { this.ws.close() } catch (_e) {} }
    this.retry()
  }

  // "Try again": look now instead of at the next 2 s retry
  retry() {
    this.closed = false
    if (this.ws && this.ws.readyState === 1) this.discover()
    else { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; this.connect() }
  }

  discover() {
    clearTimeout(this.discoverTimer)
    this.discoverTimer = null
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify({ type: 'discover', id: 'lumi-app' }))
  }

  refreshInfo() {
    if (this.ready && this.ws.readyState === 1) this.ws.send(JSON.stringify({ type: 'discover', id: INFO_ID }))
  }

  // No keyboard yet (blocksd still scanning, or it's switched off): ask again shortly.
  scheduleDiscover() {
    if (this.closed || this.discoverTimer) return
    this.discoverTimer = setTimeout(() => { this.discoverTimer = null; this.discover() }, 2000)
  }

  scheduleReconnect() {
    if (this.closed || this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => { this.reconnectTimer = null; this.connect() }, 2000)
  }

  // The keyboard someone said is on the left goes first; otherwise blocksd's order stands.
  setLeft(serial) {
    this.leftSerial = serial || ''
    this.sortBoards()
    this.lastSig = ''
  }
  sortBoards() {
    const left = this.boards.findIndex((b) => b.serial && b.serial === this.leftSerial)
    if (left > 0) this.boards.unshift(this.boards.splice(left, 1)[0])
  }

  // The keyboards in a discover reply. The uids are 64-bit, so they are read as raw digits, in the
  // same order as the devices. Any other kind of block (a Lightpad) is left out, unless there's
  // nothing else.
  readBoards(raw, msg) {
    const devices = msg.devices || []
    const all = [...raw.matchAll(/"uid"\s*:\s*(-?\d+)/g)].map((m, i) => ({ uidText: m[1], dev: devices[i] }))
    const keys = all.filter((b) => b.dev && Number(b.dev.key_count) === KEY_COUNT)
    const seen = new Set()
    const list = []
    for (const { uidText, dev } of keys.length ? keys : all.slice(0, 1)) {
      if (seen.has(uidText)) continue
      seen.add(uidText)
      const known = this.boards.find((b) => b.uidText === uidText)
      list.push({ uidText, serial: (dev && dev.serial) || '', device: deviceInfo(dev), pending: known ? known.pending : null, busy: known ? known.busy : false })
    }
    return list
  }

  handle(raw) {
    let msg
    try { msg = JSON.parse(raw) } catch { return }
    if (msg.type === 'discover_response') {
      const was = this.boards
      const list = this.readBoards(raw, msg)
      if (!list.length) { this.boards = []; this.onStatus('no-device'); this.scheduleDiscover(); return }
      this.boards = list
      this.sortBoards()
      const sameSet = was.length === list.length && list.every((b) => was.some((o) => o.uidText === b.uidText))
      // the keyboards already being driven (the battery check, or a second discover that was
      // in flight at connect): nothing to set up again
      if (sameSet) { this.onStatus('info', this.device); return }
      this.lastSig = ''
      const dev = msg.devices && msg.devices.find((d) => d.serial === this.boards[0].serial) || (msg.devices && msg.devices[0])
      console.log('LED daemon ready uid=' + this.uidText + ' device=' + (dev ? (dev.block_type || dev.device_type) : '?') + describe(this.device) + (list.length > 1 ? ' keyboards=' + list.length + ' serials=' + list.map((b) => b.serial).join(',') : ''))
      if (was.length && was[0].uidText === this.uidText) this.onStatus('boards')
      else this.onStatus('connected', dev ? (dev.block_type || dev.device_type) : '', this.device)
      this.flush()
    } else if (msg.type === 'config_ack') {
      console.log('LED config_ack item=' + msg.item + ' ok=' + msg.ok)
    } else if (msg.type === 'config_values') {
      this.lastConfig = Object.fromEntries((msg.values || []).map((v) => [v.item, v.value]))
      const wants = [20, 2, 3, 41, 102, 103, 109, 110, 116, 117, 123, 124]
      console.log('LED config values ' + wants.filter((i) => i in this.lastConfig).map((i) => i + '=' + this.lastConfig[i]).join(' '))
      this.onConfig(this.lastConfig)
    } else if (msg.type === 'device_added') {
      // blocksd announces a device once it can take frames; one we already know
      // may have turned frames down until now, so send the current picture again
      const uid = (raw.match(/"uid"\s*:\s*(-?\d+)/) || [])[1]
      const known = this.boards.find((b) => b.uidText === uid)
      if (!known) this.discover()
      else {
        this.lastSig = ''
        if (msg.device) {
          known.device = deviceInfo(msg.device)
          this.onStatus('info', this.device)
        }
      }
    } else if (msg.type === 'device_removed') {
      // uid is 64-bit: compare the raw digits, not a JS number
      const m = raw.match(/"uid"\s*:\s*(-?\d+)/)
      const at = m ? this.boards.findIndex((b) => b.uidText === m[1]) : -1
      if (at < 0) return
      this.boards.splice(at, 1)
      if (this.boards.length) { this.lastSig = ''; this.onStatus('boards'); return }
      this.onStatus('no-device')
      this.scheduleDiscover()
    } else if (msg.type === 'button') {
      console.log('BUTTON id=' + (msg.button_id == null ? '?' : msg.button_id) + ' action=' + msg.action)
      this.onButton(msg.button_id, msg.action)
    } else if (msg.type === 'subscribed') {
      console.log('LED daemon subscribed events=' + (msg.events || []).join(','))
    } else if (msg.type === 'key_frame_ack') {
      const uid = (raw.match(/"uid"\s*:\s*(-?\d+)/) || [])[1]
      const board = this.boards.find((b) => b.uidText === uid) || this.boards[0]
      if (board) board.busy = false
      if (!msg.accepted) {
        this.rejects++
        console.log('LED frame REJECTED')
        this.onStatus('rejected')
        // try the same picture again shortly (not every frame: a lasting refusal
        // would otherwise resend 60 times a second)
        clearTimeout(this.retryTimer)
        this.retryTimer = setTimeout(() => { this.lastSig = '' }, 300)
      }
      else if (this.frames <= 3) console.log('LED frame ack #' + this.frames)
      this.flush()
    }
  }

  // Send a device config item (e.g. MPE enable, keyboard mode, bend range) to every keyboard.
  setConfig(item, value) {
    if (!this.ready) return false
    for (const b of this.boards) this.ws.send(`{"type":"config_set","uid":${b.uidText},"item":${item},"value":${value}}`)
    return true
  }

  // Ask the daemon for the first keyboard's current config values (diagnostics).
  configGet() {
    if (!this.ready) return false
    this.ws.send(`{"type":"config_get","uid":${this.uidText},"id":"get"}`)
    return true
  }

  // 0..255 global key brightness (blocksd converts to the device's heap brightness)
  brightness(value) {
    if (!this.ready) return
    this.lastSig = ''      // blocksd applies brightness to the next frame, so resend it
    const v = Math.max(0, Math.min(255, Math.round(value)))
    for (const b of this.boards) this.ws.send(`{"type":"brightness","uid":${b.uidText},"value":${v}}`)
  }

  // colors: array of [r,g,b], 24 per keyboard from the left
  send(colors) {
    this.boards.forEach((b, i) => {
      const part = colors.slice(i * KEY_COUNT, (i + 1) * KEY_COUNT)
      // a keyboard this frame doesn't reach goes dark once, rather than keeping its last picture
      if (part.length || !b.dark) b.pending = part
      b.dark = !part.length
    })
    this.lastSig = colors.join('|')
    this.flush()
  }

  flush() {
    if (!this.ready) return
    for (const b of this.boards) {
      if (b.busy || !b.pending) continue
      const colors = b.pending
      b.pending = null
      const px = new Uint8Array(KEY_COUNT * 3)
      for (let i = 0; i < KEY_COUNT; i++) {
        const c = colors[i] || [0, 0, 0]
        px[i * 3] = c[0] & 255; px[i * 3 + 1] = c[1] & 255; px[i * 3 + 2] = c[2] & 255
      }
      let bin = ''
      for (let i = 0; i < px.length; i++) bin += String.fromCharCode(px[i])
      const b64 = btoa(bin)
      b.busy = true
      this.frames++
      this.ws.send(`{"type":"key_frame","uid":${b.uidText},"pixels":"${b64}"}`)
    }
  }

  close() {
    this.closed = true
    clearTimeout(this.reconnectTimer)
    clearTimeout(this.discoverTimer)
    clearTimeout(this.retryTimer)
    clearInterval(this.infoTimer)
    this.reconnectTimer = null
    this.discoverTimer = null
    this.infoTimer = null
    if (this.ws) { try { this.ws.close() } catch {} ; this.ws = null }
    this.boards = []
  }
}

// HSL -> RGB for key colouring
export function hsl(h, s, l) {
  const k = (n) => (n + h * 12) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)]
}
