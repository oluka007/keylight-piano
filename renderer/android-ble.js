// Bluetooth keyboard on Android: the controller (pure: node tests drive it with a fake host) and the
// dialog. The native side does the scanning and connecting (BleMidi.java); once connected the keyboard
// is just another MIDI port, so nothing else in the app knows it is wireless. Copy says "your keyboard".
export const LAST_KEY = 'keylight.ble.last'
const ADDRESS = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/
export const validAddress = (a) => typeof a === 'string' && ADDRESS.test(a)
const MAX_AUTO = 3

export const signal = (rssi) => (typeof rssi !== 'number' ? { label: 'Paired', bars: 0 } : rssi >= -60 ? { label: 'Strong signal', bars: 3 } : rssi >= -75 ? { label: 'Good signal', bars: 2 } : { label: 'Weak signal', bars: 1 })

export function readLast(storage) {
  try {
    const v = JSON.parse(storage.getItem(LAST_KEY) || 'null')
    return v && validAddress(v.address) ? { address: v.address, name: String(v.name || 'your keyboard').slice(0, 60) } : null
  } catch { return null }
}

/**
 * host: { request(op, args) -> Promise, subscribe(fn) -> unsubscribe }, storage: localStorage-like.
 * The controller keeps the last native state and the devices found; listeners get 'change' on any update.
 */
export function createBle({ host, storage, setTimer = setTimeout, clearTimer = clearTimeout }) {
  const listeners = new Set()
  let state = { supported: false, enabled: false, permission: 'needed', locationOn: true, scanning: false, connecting: null, connected: null, sdk: 0 }
  const devices = new Map()
  let ready = false, scanEnd = null, failure = '', last = readLast(storage), autoTries = 0, autoTimer = null, wasConnected = false, lost = false
  const emit = () => { for (const fn of [...listeners]) fn() }
  const save = (v) => { try { v ? storage.setItem(LAST_KEY, JSON.stringify(v)) : storage.removeItem(LAST_KEY) } catch {} }
  const applyState = (next) => {
    state = { ...state, ...next }
    if (state.connected) {
      const known = state.connected
      if (!last || last.address !== known.address || last.name !== known.name) { last = { address: known.address, name: known.name }; save(last) }
      autoTries = 0; failure = ''; lost = false
    } else if (wasConnected && !state.connecting) lost = true
    wasConnected = !!state.connected
    ready = true
  }
  const stopListening = host.subscribe((event) => {
    switch (event && event.kind) {
      case 'bleState': applyState(event); break
      case 'bleDevice':
        if (validAddress(event.address)) {
          devices.set(event.address, { address: event.address, name: String(event.name || 'Bluetooth keyboard').slice(0, 60), rssi: typeof event.rssi === 'number' ? event.rssi : null, bonded: !!event.bonded, open: !!event.open })
          scanEnd = null
        }
        break
      case 'bleScanEnd': scanEnd = { reason: String(event.reason), count: devices.size }; break
      case 'bleError':
        if (event.auto) return      // a quiet reconnect that failed is not worth a message
        failure = String(event.message || 'Could not connect'); break
      default: return
    }
    emit()
  })
  const call = async (op, args) => {
    try { return await host.request(op, args) }
    catch (error) { failure = error && error.message ? error.message : 'Bluetooth is unavailable'; emit(); return null }
  }
  const api = {
    get state() { return state }, get ready() { return ready }, get last() { return last }, get failure() { return failure },
    get scanEnd() { return scanEnd }, get lost() { return lost },
    devices: () => [...devices.values()].sort((a, b) => (b.rssi ?? -200) - (a.rssi ?? -200)),
    on(fn) { listeners.add(fn); return () => listeners.delete(fn) },
    async refresh() {
      const result = await call('bleState')
      if (result && typeof result === 'object') { applyState(result); emit() }
      return state
    },
    // The user's answer arrives later as a bleState event; the reply is the state right now (already allowed in Settings, say)
    async allow() { failure = ''; await api.apply(await call('blePermission')) },
    async turnOn() { failure = ''; await api.apply(await call('bleEnable')) },
    async apply(result) { if (result && typeof result === 'object') { applyState(result); emit() } },
    openSettings: () => call('bleOpenSettings'),
    async scan() {
      failure = ''; scanEnd = null; devices.clear(); emit()
      const result = await call('bleScanStart')
      if (result && result.ok === false) {
        if (result.code === 'rate-limit' || result.code === 'scan-failed') failure = result.message || 'Could not search'
        else await api.refresh()       // off, permission or location: the dialog shows the right step from the new state
        emit()
      }
      return result
    },
    stopScan: () => call('bleScanStop'),
    async connect(address) {
      if (!validAddress(address)) return null
      failure = ''; lost = false
      const result = await call('bleConnect', { address, auto: false })
      if (result && result.ok === false) { failure = result.message || 'Could not connect'; emit() }
      return result
    },
    async disconnect() { lost = false; wasConnected = false; if (autoTimer) { clearTimer(autoTimer); autoTimer = null }; await call('bleDisconnect') },
    async forget() { last = null; save(null); autoTries = 0; await api.disconnect(); emit() },
    /** Reconnect to the last keyboard without ever prompting: only if everything is already allowed. */
    async autoReconnect() {
      if (!last || autoTries >= MAX_AUTO) return false
      if (!ready) await api.refresh()
      if (!state.supported || !state.enabled || state.permission !== 'granted' || state.connected || state.connecting || state.scanning) return false
      autoTries++
      const result = await call('bleConnect', { address: last.address, auto: true })
      return !!(result && result.ok)
    },
    scheduleAuto(ms = 2500) { if (autoTimer) clearTimer(autoTimer); autoTimer = setTimer(() => { autoTimer = null; api.autoReconnect() }, ms) },
    destroy() { stopListening(); listeners.clear(); if (autoTimer) clearTimer(autoTimer) }
  }
  return api
}

/** What the dialog should show, from the controller's state. */
export function phaseOf(ble) {
  const s = ble.state
  if (ble.ready && !s.supported) return 'unsupported'
  if (s.connected) return 'connected'
  if (s.connecting) return 'connecting'
  if (!ble.ready) return 'checking'
  if (s.permission === 'blocked') return 'blocked'      // before 'off': Bluetooth cannot be switched on from here without the permission
  if (!s.enabled) return 'off'
  if (s.permission !== 'granted') return 'permission'
  if (!s.locationOn) return 'location'
  if (s.scanning) return 'scanning'
  if (ble.failure) return 'failed'
  if (ble.scanEnd) return 'done'
  return 'idle'
}

/* ---------- the dialog ---------- */
const el = (tag, attrs = {}, ...kids) => {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) { if (k === 'class') node.className = v; else if (k.startsWith('on')) node[k] = v; else node.setAttribute(k, v) }
  node.append(...kids.filter((k) => k != null))
  return node
}

export function mountBle({ storage = localStorage, host, notify = () => {}, doc = document } = {}) {
  const ble = createBle({ host, storage })
  const dialog = el('dialog', { id: 'bleDialog', class: 'support-dialog ble-dialog', 'aria-labelledby': 'bleHeading' })
  const heading = el('h2', { id: 'bleHeading', tabindex: '-1' }, 'Bluetooth keyboard')
  const status = el('p', { id: 'bleStatus', role: 'status', 'aria-live': 'polite' })
  const help = el('p', { class: 'support-secondary', id: 'bleHelp' })
  const list = el('ul', { class: 'ble-list', id: 'bleList', 'aria-label': 'Keyboards found' })
  const actions = el('div', { class: 'support-actions ble-actions' })
  dialog.append(heading, status, help, list, actions)
  doc.body.append(dialog)

  const btn = (text, cls, fn, extra = {}) => el('button', { type: 'button', class: cls, ...extra, onclick: fn }, text)
  const COPY = {
    checking: ['Checking Bluetooth…', ''],
    unsupported: ['This device can’t connect to a Bluetooth keyboard.', 'You can still plug your keyboard in with a USB cable.'],
    off: ['Bluetooth is turned off.', 'Turn it on so Keylight can find your keyboard.'],
    permission: ['Keylight needs your permission to find your keyboard.', ''],
    blocked: ['Bluetooth is blocked for Keylight.', 'Open the app’s settings, choose Permissions, and allow Nearby devices (or Location on older versions of Android).'],
    location: ['Location is switched off.', 'Older versions of Android only let apps find Bluetooth devices while Location is on. Keylight does not use your location. Turn it on in the quick settings, then check again.'],
    idle: ['Switch your keyboard on and keep it close.', ''],
    done: ['', 'Switch your keyboard on and keep it close. If it has a Bluetooth button, hold it until its light blinks.'],
    failed: ['', 'Switch your keyboard on, keep it close and try again.']
  }
  const render = () => {
    const phase = phaseOf(ble), s = ble.state
    const [line, extra] = COPY[phase] || ['', '']
    let text = line
    if (phase === 'connected') text = 'Connected to ' + s.connected.name + '.'
    else if (phase === 'connecting') text = 'Connecting to your keyboard…'
    else if (phase === 'scanning') text = ble.devices().length ? 'Choose your keyboard.' : 'Looking for your keyboard…'
    else if (phase === 'done') text = ble.devices().length ? 'Choose your keyboard.' : 'No keyboard found.'
    else if (phase === 'failed') text = ble.failure
    status.textContent = text
    help.textContent = phase === 'permission' ? (s.sdk >= 31 ? 'Android calls this “Nearby devices”. Keylight uses it only to reach your keyboard.' : 'Older versions of Android ask for Location to find Bluetooth devices. Keylight does not use your location.')
      : phase === 'connected' ? 'It plays like any other keyboard. Keylight reconnects to it when you open the app.'
      : phase === 'scanning' && !ble.devices().length ? 'Switch your keyboard on and keep it close. If it has a Bluetooth button, hold it until its light blinks.'
      : (phase === 'done' && ble.devices().length) || phase === 'connecting' ? '' : extra
    if (ble.lost && phase !== 'connected') help.textContent = 'Your keyboard disconnected. ' + help.textContent
    // the list
    list.replaceChildren()
    if (['scanning', 'done', 'failed', 'idle'].includes(phase)) for (const d of ble.devices()) {
      const sig = signal(d.rssi)
      const bars = el('span', { class: 'ble-bars', 'aria-hidden': 'true', 'data-bars': String(sig.bars) }, el('i'), el('i'), el('i'))
      list.append(el('li', {}, el('span', { class: 'ble-name' }, d.name), bars, el('span', { class: 'ble-signal' }, sig.label),
        btn('Connect', 'mini-btn', () => ble.connect(d.address).then(render), { 'aria-label': 'Connect to ' + d.name })))
    }
    // the buttons
    actions.replaceChildren()
    const close = btn('Close', phase === 'connected' ? 'primary' : 'ghost', () => dialog.close())
    const add = (...nodes) => actions.append(...nodes)
    if (phase === 'permission') add(btn('Allow', 'primary', () => ble.allow(), { id: 'bleAllow' }))
    else if (phase === 'blocked') add(btn('Open settings', 'primary', () => ble.openSettings(), { id: 'bleSettings' }))
    else if (phase === 'off') add(btn('Turn on Bluetooth', 'primary', () => ble.turnOn(), { id: 'bleTurnOn' }))
    else if (phase === 'location') add(btn('Check again', 'primary', () => ble.refresh().then(() => ble.scan()), { id: 'bleCheck' }))
    else if (phase === 'idle' || phase === 'done' || phase === 'failed') add(btn(phase === 'idle' ? 'Look for my keyboard' : 'Look again', 'primary', () => ble.scan(), { id: 'bleScan' }))
    else if (phase === 'scanning') add(btn('Stop looking', 'ghost', () => ble.stopScan(), { id: 'bleStop' }))
    else if (phase === 'connecting') add(btn('Cancel', 'ghost', () => ble.disconnect(), { id: 'bleCancel' }))
    else if (phase === 'connected') add(btn('Disconnect', 'ghost', () => ble.disconnect(), { id: 'bleDisconnect' }))
    if (ble.last && phase !== 'unsupported' && phase !== 'checking') add(btn('Forget ' + (ble.last.name || 'this keyboard'), 'ghost', () => ble.forget(), { id: 'bleForget' }))
    add(close)
    syncRows()
  }

  // the rows in Settings and in the "no keyboard found" hint
  let row = null, hint = null
  const rowLabel = () => (ble.state.connected ? ble.state.connected.name : ble.state.connecting ? 'Connecting…' : ble.last ? 'Remembered: ' + ble.last.name : 'Not connected')
  function syncRows() {
    const supported = !ble.ready || ble.state.supported
    if (row) { row.classList.toggle('hidden', !supported); row.querySelector('.ble-row-state').textContent = rowLabel() }
    const kbHelp = doc.getElementById('kbHelp')
    if (hint) hint.classList.toggle('hidden', !supported || !!ble.state.connected || !kbHelp || kbHelp.classList.contains('hidden'))
  }
  const openDialog = () => {
    if (dialog.open) return
    const back = doc.activeElement
    dialog.addEventListener('close', () => { ble.stopScan(); if (back && back.isConnected && back !== doc.body) back.focus() }, { once: true })
    dialog.showModal(); heading.focus({ preventScroll: true })
    ble.refresh().then(() => { render(); if (['idle'].includes(phaseOf(ble)) && !ble.last) ble.scan() })
    render()
  }
  const anchor = doc.getElementById('kbHelp')
  if (anchor) {
    row = el('div', { class: 'setting-row', id: 'bleRow' }, el('span', {}, 'Bluetooth keyboard'),
      el('span', {}, el('span', { class: 'ble-row-state' }, 'Not connected'), ' ', btn('Connect…', 'mini-btn', openDialog, { id: 'bleOpen' })))
    hint = el('div', { class: 'setting-row hidden', id: 'bleHintRow' }, el('span', {}, 'Using a Bluetooth keyboard?'), btn('Connect it', 'mini-btn', openDialog, { id: 'bleHintOpen' }))
    anchor.insertAdjacentElement('beforebegin', row)
    anchor.insertAdjacentElement('afterend', hint)
    new MutationObserver(syncRows).observe(anchor, { attributes: true, attributeFilter: ['class'] })
  }
  const was = { connected: false }
  ble.on(() => {
    if (dialog.open) render(); else syncRows()
    const now = !!ble.state.connected
    if (now && !was.connected) notify('Keyboard connected over Bluetooth')
    if (!now && was.connected && ble.lost && !doc.hidden) { notify('Your Bluetooth keyboard disconnected'); ble.scheduleAuto(3000) }
    was.connected = now
  })
  ble.refresh().then(() => { syncRows(); ble.scheduleAuto(800) })
  doc.addEventListener('visibilitychange', () => { if (!doc.hidden) ble.refresh().then(() => ble.scheduleAuto(600)) })
  return { ble, open: openDialog, dialog }
}
