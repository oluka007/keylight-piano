// Fingertip tracking from an Ultraleap-compatible tracking service (second source next to
// the camera). The service is a separate program the user installs. Two ways in, both
// local: Keylight's own native helper (which loads the user's installed LeapC library and
// reports through the main process), or, in a plain browser, the legacy LeapJS "v6" JSON
// WebSocket on the loopback interface. Nothing proprietary is redistributed. Whether a ROLI Airwave is accepted by that service is NOT established here:
// this module consumes frames, whatever device produced them.
//
// Frame fields used (v6): hands[].{id,type,confidence}, pointables[].{handId,type 0..4,
// tipPosition [x,y,z] millimetres}. Timing uses the local receive time, because the frame
// timestamp is the service's own microsecond clock.

export const LEAP_URL = 'ws://127.0.0.1:6437/v6.json'
export const STATES = Object.freeze(['off', 'connecting', 'unreachable', 'no-helper', 'runtime-missing', 'service-down',
  'connected', 'streaming'])

const finiteVec = (v) => Array.isArray(v) && v.length >= 3 && v.slice(0, 3).every(Number.isFinite)

// One frame -> fingertips in device millimetres, thumb first (finger 1..5). Hands without
// a usable left/right type or a confidence number keep confidence 0 and are never trusted.
export function parseLeapFrame(frame, observedAt) {
  if (!frame || !Array.isArray(frame.hands) || !Array.isArray(frame.pointables)) return null
  const hands = new Map()
  for (const hand of frame.hands) {
    if (hand && Number.isFinite(hand.id)) hands.set(hand.id, hand)
  }
  const tips = []
  for (const p of frame.pointables) {
    if (!p || p.tool === true || !Number.isInteger(p.type) || p.type < 0 || p.type > 4) continue
    const hand = hands.get(p.handId)
    if (!hand || !finiteVec(p.tipPosition)) continue
    const typed = hand.type === 'left' || hand.type === 'right'
    const confidence = typed && Number.isFinite(hand.confidence) ? Math.max(0, Math.min(1, hand.confidence)) : 0
    tips.push({ side: typed ? hand.type : 'right', finger: p.type + 1, x: p.tipPosition[0],
      y: p.tipPosition[1], z: p.tipPosition[2], confidence, observedAt })
  }
  return tips
}

// Two calibration points: where two known keys were pressed. `f` is the key's fraction
// along the key row (0 = first key centre, 1 = last), `x`/`z` the tip position in mm and
// `y` its height. Returns the same { t, off } as the camera projection, `off` in row
// lengths, or null when the two points are unusable.
export function projectTip(calib, tip) {
  if (!calib) return null
  const { a, b } = calib
  const dx = b.x - a.x, dz = b.z - a.z
  const len = Math.hypot(dx, dz)
  const df = b.f - a.f
  if (!(len > 0) || !Number.isFinite(df) || df === 0) return null
  const px = tip.x - a.x, pz = tip.z - a.z
  const along = (px * dx + pz * dz) / len
  const across = (px * dz - pz * dx) / len
  const rowLen = len / Math.abs(df)
  return { t: a.f + (along / len) * df, off: across / rowLen * Math.sign(df) }
}

// Build calibration from two key presses and the lift direction. `lift` is +1 when raising a
// finger away from the keys increases the sensor's Y reading and -1 when it decreases it; it
// is measured, never assumed, because the sensor can face up (table top) or down (overhead).
// All three pieces must be unambiguous: keys clearly apart, and a clear lift.
export function makeCalibration(a, b, lift, { minKeyFraction = 0.25, minDistanceMm = 60 } = {}) {
  for (const p of [a, b]) {
    if (!p || ![p.x, p.y, p.z, p.f].every(Number.isFinite)) return null
  }
  if (lift !== 1 && lift !== -1) return null
  if (Math.abs(b.f - a.f) < minKeyFraction) return null
  if (Math.hypot(b.x - a.x, b.z - a.z) < minDistanceMm) return null
  return { a: { x: a.x, y: a.y, z: a.z, f: a.f }, b: { x: b.x, y: b.y, z: b.z, f: b.f }, lift }
}

// The sign of a lift from the resting height to a raised height of the SAME finger, or null
// when the difference is too small to tell which way is up.
export function liftDirection(restY, raisedY, minMm = 25) {
  if (![restY, raisedY].every(Number.isFinite) || Math.abs(raisedY - restY) < minMm) return null
  return raisedY > restY ? 1 : -1
}

// ---- transports: each delivers parsed messages and says when the line is lost ----------

export function websocketTransport({ WebSocketImpl = globalThis.WebSocket, url = LEAP_URL } = {}) {
  return {
    kind: 'websocket',
    endpoint: 'loopback ' + new URL(url.replace(/^ws/, 'http')).host,
    open({ onOpen, onMessage, onLost }) {
      if (typeof WebSocketImpl !== 'function') { onLost('no-websocket'); return { close() {} } }
      let s
      try { s = new WebSocketImpl(url) } catch (_e) { onLost('refused'); return { close() {} } }
      s.onopen = () => { onOpen(); try { s.send(JSON.stringify({ background: true })) } catch (_e) { /* onclose follows */ } }
      s.onmessage = (event) => {
        let message
        try { message = JSON.parse(typeof event.data === 'string' ? event.data : '') } catch (_e) { return }
        onMessage(message)
      }
      s.onerror = () => onLost('error')
      s.onclose = () => onLost('closed')
      return { close() { s.onopen = s.onmessage = s.onerror = s.onclose = null; try { s.close() } catch (_e) { /* already closed */ } } }
    }
  }
}

// `api` is window.keylightNative.airwave from the preload: start/stop the helper process
// and subscribe to its sanitised messages.
export function nativeTransport(api = globalThis.keylightNative?.airwave) {
  if (!api) return null
  return {
    kind: 'native-helper',
    endpoint: 'bundled helper',
    open({ onOpen, onMessage, onLost }) {
      let live = true
      const off = api.onMessage((message) => { if (live) onMessage(message) })
      api.start().then((result) => {
        if (!live) return
        if (result?.ok) onOpen(); else onLost(result?.reason || 'start-failed')
      }, () => { if (live) onLost('start-failed') })
      return { close() { live = false; off(); api.stop().catch(() => {}) } }
    }
  }
}

export function createLeapTracker({ transport, WebSocketImpl, url, now = () => performance.now(),
  setTimer = setTimeout, clearTimer = clearTimeout, onState = () => {}, hoverMm = 60, retryMs = 2000,
  runtimeRetryMs = 5000 } = {}) {
  const line = transport || nativeTransport() || websocketTransport({ ...(WebSocketImpl !== undefined ? { WebSocketImpl } : {}), ...(url ? { url } : {}) })
  let open = null
  let state = 'off'
  let wanted = false
  let timer = null
  let tips = []
  let observedAt = null
  let calib = null
  const stats = { frames: 0, framesWithHands: 0, firstAt: null, serverVersion: null, devices: [], closes: 0, tipsSeen: new Set(),
    native: { runtimeFrom: null, search: null, abi: null, device: null, exitCode: null, errors: 0, attached: 0 } }

  const setState = (next) => { if (state !== next) { state = next; onState(next) } }
  const clearData = () => { tips = []; observedAt = null }
  const clearRetry = () => { if (timer !== null) { clearTimer(timer); timer = null } }
  const closeLine = () => { const o = open; open = null; if (o) o.close() }
  const schedule = (ms) => { clearRetry(); if (wanted) timer = setTimer(connect, ms) }
  const lost = (next = 'unreachable', ms = retryMs) => {
    stats.closes++; closeLine(); attempt++; clearData()
    if (wanted) { setState(next); schedule(ms) }
  }

  // legacy WebSocket dialect: version and device control messages, then v6 frames
  const noteControl = (message) => {
    if (Number.isInteger(message.version)) stats.serverVersion = message.version
    const device = message.event?.state ?? message.deviceEvent
    if (device && typeof device === 'object' && stats.devices.length < 8) {
      const entry = { attached: device.attached === true, streaming: device.streaming === true,
        kind: ['peripheral', 'keyboard', 'laptop'].includes(device.type) ? device.type : 'unknown' }
      if (!stats.devices.some((d) => d.attached === entry.attached && d.streaming === entry.streaming && d.kind === entry.kind)) stats.devices.push(entry)
    }
  }
  const take = (parsed, at) => {
    tips = parsed
    observedAt = at
    stats.frames++
    if (stats.firstAt === null) stats.firstAt = at
    if (parsed.length) { stats.framesWithHands++; for (const tip of parsed) stats.tipsSeen.add(tip.side + tip.finger) }
    setState('streaming')
  }
  const onWebSocket = (message) => {
    const at = now()
    noteControl(message)
    const parsed = parseLeapFrame(message, at)
    if (parsed) take(parsed, at)
  }
  // native helper dialect (renderer/airwave-bridge.cjs has already validated the shapes)
  const onNative = (m) => {
    const n = stats.native
    switch (m.t) {
      case 'runtime':
        if (m.state === 'loaded') n.runtimeFrom = m.from
        else if (m.state === 'missing') { n.runtimeFrom = 'missing'; n.search = { tried: m.tried || [], seen: m.seen || [] }; clearData(); setState('runtime-missing') }
        else if (m.state === 'incompatible') { n.runtimeFrom = 'incompatible'; clearData(); setState('runtime-missing') }
        break
      case 'service':
        if (m.state === 'connected') setState('connected')
        else { clearData(); n.device = null; setState('service-down') }
        break
      case 'device':
        if (m.state === 'attached') { n.attached++; n.device = { class: m.class, typeCode: m.typeCode, identified: m.identified, streaming: m.streaming } }
        else { n.device = null; clearData() }
        break
      case 'abi': n.abi = { messageSize: m.messageSize, expected: m.expected }; break
      case 'error': n.errors++; break
      case 'frame': {
        const at = now()
        const parsed = []
        for (const hand of m.hands) {
          hand.tips.forEach((t, f) => {
            if (t) parsed.push({ side: hand.side, finger: f + 1, x: t[0], y: t[1], z: t[2], confidence: hand.conf, observedAt: at })
          })
        }
        take(parsed, at)
        break
      }
      case 'exit':
        n.exitCode = m.code
        // a helper that ends by itself (no runtime, crash) is restarted later; a missing
        // runtime is retried slowly because the person may install it while Keylight is open
        lost(state === 'runtime-missing' ? 'runtime-missing' : 'unreachable', state === 'runtime-missing' ? runtimeRetryMs : retryMs)
        break
      default: break
    }
  }

  let attempt = 0
  function connect() {
    timer = null
    if (!wanted || open) return
    setState('connecting')
    const mine = ++attempt
    let ended = false
    const handlers = {
      onOpen: () => {
        if (mine !== attempt || ended) return
        if (line.kind === 'websocket') setState('connected')
      },
      onMessage: (message) => { if (mine === attempt && !ended) (line.kind === 'websocket' ? onWebSocket : onNative)(message) },
      onLost: (reason) => {
        if (mine !== attempt || ended) return
        ended = true
        if (reason === 'no-helper') { closeLine(); clearData(); setState('no-helper'); return }
        lost()
      }
    }
    let o
    try { o = line.open(handlers) } catch (_e) { handlers.onLost('refused'); return }
    if (ended) { try { o?.close() } catch (_e) { /* nothing open */ } return }
    open = o
  }

  return {
    get state() { return state },
    get kind() { return line.kind },
    get calib() { return calib },
    set calib(value) { calib = value },
    start() { wanted = true; clearRetry(); if (!open) connect() },
    stop() { wanted = false; clearRetry(); closeLine(); attempt++; clearData(); setState('off') },
    resetStats() {
      Object.assign(stats, { frames: 0, framesWithHands: 0, firstAt: null, closes: 0, devices: [], tipsSeen: new Set() })
      stats.native = { runtimeFrom: null, search: null, abi: null, device: null, exitCode: null, errors: 0, attached: 0 }
    },
    // Frames can stop while the service is up, so streaming is judged by age too.
    fresh(limitMs = 500) { return observedAt !== null && now() - observedAt <= limitMs },
    // Same shape as HandTracker.getObservation(); tips well above the pressing height are
    // hovering and not offered as candidates for a pressed key.
    getObservation() {
      const fingertips = []
      if (calib) {
        // height measured away from the keys: a tip more than hoverMm above the pressing height hovers
        const rest = calib.lift * (calib.a.y + calib.b.y) / 2
        for (const tip of tips) {
          if (calib.lift * tip.y > rest + hoverMm) continue
          const q = projectTip(calib, tip)
          if (q) fingertips.push({ ...q, side: tip.side, finger: tip.finger, confidence: tip.confidence,
            observedAt: tip.observedAt })
        }
      }
      return { active: state === 'streaming', calibrated: !!calib, observedAt, fingertips, source: 'ultraleap' }
    },
    // Calibration asks for one named finger (the right index), so no height ranking is needed:
    // the sample is that finger's tip, fresh and confidently on the named hand.
    sampleFinger(side, finger, { at = now(), maxAgeMs = 200, minConfidence = 0.8 } = {}) {
      if (state !== 'streaming' || observedAt === null) return { ok: false, reason: 'not-streaming' }
      if (!(at >= observedAt) || at - observedAt > maxAgeMs) return { ok: false, reason: 'stale' }
      const tip = tips.find((t) => t.side === side && t.finger === finger)
      if (!tip) return { ok: false, reason: 'no-finger' }
      if (tip.confidence < minConfidence) return { ok: false, reason: 'low-confidence' }
      return { ok: true, point: { x: tip.x, y: tip.y, z: tip.z } }
    },
    // Privacy-filtered facts for a tester report: counts, flags and device classes only; no
    // positions, identifiers, serials or paths.
    describe() {
      const span = stats.firstAt !== null && observedAt !== null ? (observedAt - stats.firstAt) / 1000 : 0
      const n = stats.native
      return { state, route: line.kind, endpoint: line.endpoint, serverVersion: stats.serverVersion,
        frames: stats.frames, framesWithHands: stats.framesWithHands,
        framesPerSecond: span >= 1 ? Math.round(stats.frames / span) : 0,
        fingersSeen: stats.tipsSeen.size, devices: stats.devices.map((d) => ({ ...d })),
        connectionsLost: stats.closes, calibrated: !!calib, liftDirection: calib ? calib.lift : null,
        lastFrameAgeMs: observedAt === null ? null : Math.round(now() - observedAt),
        native: line.kind === 'native-helper' ? { runtime: n.runtimeFrom, search: n.search && { tried: [...n.search.tried], seen: [...n.search.seen] }, device: n.device && { ...n.device },
          abiMatch: n.abi ? n.abi.messageSize === n.abi.expected : null, helperExitCode: n.exitCode, errors: n.errors, devicesAttached: n.attached } : null }
    },
    fingertipsOverKeys(maxOff = 0.12) {
      if (!this.fresh(300)) return []
      return this.getObservation().fingertips
        .filter((tip) => tip.t >= -0.02 && tip.t <= 1.02 && Math.abs(tip.off) <= maxOff)
        .map((tip) => ({ side: tip.side, finger: tip.finger, t: Math.max(0, Math.min(1, tip.t)) }))
    }
  }
}
