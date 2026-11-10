const CONTROLS = Object.freeze({
  21: 'grasp', 22: 'slideLeft', 23: 'slideRight', 24: 'glideLeft', 25: 'glideRight',
  26: 'raiseLeft', 27: 'raiseRight', 28: 'tiltLeft', 29: 'tiltRight',
  30: 'flexLeft', 31: 'flexRight'
})

export function decodeAirwave(data) {
  if (!data || data.length !== 3) return null
  const [status, cc, value] = data
  if (!Number.isInteger(status) || status < 0xb0 || status > 0xbf ||
      !Number.isInteger(cc) || !Number.isInteger(value) || value < 0 || value > 127) return null
  const control = CONTROLS[cc]
  return control ? { control, value: value / 127, channel: status & 15 } : null
}

export function createAirwave({ onExpression = () => {} } = {}) {
  let input = null
  let enabled = false
  let status = 'disabled'
  let gestures = {}
  let expression = { raise: 0, tilt: 0, grasp: 0 }

  const snapshot = () => ({ enabled, connected: !!input && input.state !== 'disconnected',
    status, gestures: { ...gestures }, expression: { ...expression } })
  const reset = () => {
    gestures = {}
    expression = { raise: 0, tilt: 0, grasp: 0 }
    onExpression({ ...expression })
  }
  const consume = (data, sourceId) => {
    if (!enabled || !input || sourceId !== input.id || input.state === 'disconnected') return null
    const decoded = decodeAirwave(data)
    if (!decoded) return null
    gestures[decoded.control] = decoded.value
    const mean = (a, b) => {
      const values = [gestures[a], gestures[b]].filter((value) => value !== undefined)
      return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
    }
    expression = { raise: mean('raiseLeft', 'raiseRight'), tilt: mean('tiltLeft', 'tiltRight'),
      grasp: gestures.grasp ?? 0 }
    status = 'receiving'
    onExpression({ ...expression })
    return { ...expression }
  }
  const onMessage = (event) => consume(event.data, input?.id)
  const detach = () => {
    if (input) {
      input.removeEventListener('midimessage', onMessage)
      input.removeEventListener('statechange', onState)
    }
    input = null
  }
  const disconnect = () => {
    detach()
    status = enabled ? 'disconnected' : 'disabled'
    reset()
    return snapshot()
  }
  const onState = () => { if (input?.state === 'disconnected') disconnect() }

  return {
    getState: snapshot,
    consume,
    selectInput(port, pianoInputs = []) {
      if (port && (!port.id || port.type !== 'input' ||
          pianoInputs.some((piano) => piano && piano.id === port.id))) {
        detach()
        status = 'input-conflict'
        reset()
        return snapshot()
      }
      detach()
      input = port
      if (input?.state === 'disconnected') input = null
      if (input) {
        input.addEventListener('midimessage', onMessage)
        input.addEventListener('statechange', onState)
      }
      status = enabled ? (input ? 'waiting' : 'disconnected') : 'disabled'
      reset()
      return snapshot()
    },
    setEnabled(value) {
      enabled = value === true
      status = enabled ? (input ? 'waiting' : 'disconnected') : 'disabled'
      reset()
      return snapshot()
    },
    disconnect,
    dispose() { enabled = false; return disconnect() }
  }
}
