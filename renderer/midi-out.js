// Explicit performance output, independent of the keyboard-lighting connection.
// MIDIOutput ports are shared by Web MIDI; this controller never closes them.
export function createMidiOut() {
  let outputs = new Map()
  let output = null
  let error = null

  function attempt(action) {
    try { action(); error = null; return true } catch (cause) {
      if (!(cause instanceof Error)) throw cause
      error = cause.message
      return false
    }
  }

  function panic() {
    if (!output) return false
    return attempt(() => {
      output.clear()
      if (output.state === 'disconnected') return
      for (let channel = 0; channel < 16; channel++) {
        output.send([0xB0 | channel, 64, 0])
        output.send([0xB0 | channel, 123, 0])
        output.send([0xB0 | channel, 120, 0])
        output.send([0xE0 | channel, 0, 64])
      }
    })
  }

  function disconnect() {
    const ok = panic()
    if (output) output.removeEventListener('statechange', onStateChange)
    output = null
    return ok
  }

  function onStateChange() {
    if (output?.state === 'disconnected') {
      disconnect()
      error = 'MIDI output disconnected; select an output again to reconnect'
    }
  }

  function setOutputs(map) {
    const next = new Map(map)
    if (output && (next.get(output.id) !== output || output.state === 'disconnected')) disconnect()
    outputs = next
  }

  function select(id) {
    if (id == null || id === '') { disconnect(); return true }
    const next = outputs.get(id)
    if (!next || next.state === 'disconnected') {
      error = 'MIDI output unavailable'
      return false
    }
    if (output === next) return true
    disconnect()
    output = next
    output.addEventListener('statechange', onStateChange)
    error = null
    return true
  }

  // Channel voice messages only: notes, pedal/CC, program, pressure and bend.
  // timestamp is Web MIDI's absolute performance.now() clock in milliseconds.
  function send(data, timestamp) {
    const bytes = Array.from(data)
    const status = bytes[0]
    const length = status >= 0xC0 && status < 0xE0 ? 2 : 3
    if (!Number.isInteger(status) || status < 0x80 || status > 0xEF || bytes.length !== length ||
        bytes.slice(1).some((v) => !Number.isInteger(v) || v < 0 || v > 127)) {
      throw new TypeError('Expected one MIDI channel voice message')
    }
    if (timestamp !== undefined && (!Number.isFinite(timestamp) || timestamp < 0)) throw new RangeError('Invalid MIDI timestamp')
    if (!output || output.state === 'disconnected') { onStateChange(); return false }
    const ok = attempt(() => timestamp === undefined ? output.send(bytes) : output.send(bytes, timestamp))
    if (!ok) {
      const failure = error
      disconnect()
      error = failure
    }
    return ok
  }

  return {
    setOutputs, select, send, panic, disconnect,
    status: () => ({ selectedId: output?.id || null, error })
  }
}
