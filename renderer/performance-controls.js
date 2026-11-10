import { createMidiOut } from './midi-out.js'
import { createAirwave } from './airwave.js'
import { setAirExpression } from './audio.js'

export function mountPerformanceControls(notice) {
  const outputSelect = document.getElementById('instrumentOutput')
  const gestureSelect = document.getElementById('gestureInput')
  const gestureStatus = document.getElementById('gestureStatus')
  const outputStatus = document.getElementById('instrumentOutputStatus')
  const panicButton = document.getElementById('midiPanic')
  const output = createMidiOut()
  let access = null
  let pianoInputs = []
  let gestureId = ''
  const gesture = createAirwave({ onExpression: (value) => {
    const state = gesture.getState()
    const hasTilt = state.gestures.tiltLeft !== undefined || state.gestures.tiltRight !== undefined
    setAirExpression({ ...value, tilt: hasTilt ? value.tilt * 2 - 1 : 0 })
    gestureStatus.textContent = state.status === 'receiving' ? `Receiving gestures: raise ${Math.round(value.raise * 100)}%, grasp ${Math.round(value.grasp * 100)}%`
      : state.connected ? 'Waiting for expression MIDI from host software' : 'Off or disconnected'
  } })
  const fill = (select, ports, selected) => {
    select.replaceChildren(Object.assign(document.createElement('option'), { value: '', textContent: 'Off' }),
      ...ports.map((port) => Object.assign(document.createElement('option'), { value: port.id, textContent: port.name || 'Unnamed MIDI port' })))
    select.value = ports.some((port) => port.id === selected) ? selected : ''
  }
  const updateOutput = () => {
    const state = output.status()
    outputSelect.value = state.selectedId || ''
    panicButton.disabled = !state.selectedId
    outputStatus.textContent = state.error || (state.selectedId ? 'Your live playing is routed to this instrument' : 'Off. Keyboard lighting uses its own connection.')
  }
  outputSelect.onchange = () => { output.select(outputSelect.value); updateOutput() }
  gestureSelect.onchange = async () => {
    gestureId = gestureSelect.value
    const port = access?.inputs.get(gestureId) || null
    gesture.selectInput(port, pianoInputs)
    gesture.setEnabled(!!port)
    if (port) {
      try { await port.open() } catch (error) {
        if (!(error instanceof Error)) throw error
        gesture.disconnect(); gestureId = ''; gestureSelect.value = ''; notice('Gesture input unavailable: ' + error.message)
      }
    }
  }
  panicButton.onclick = () => { const sent = output.panic(); updateOutput(); notice(sent ? 'Sent sustain-off and all-notes-off to the selected external instrument' : 'No external instrument is connected') }
  updateOutput()
  const api = {
    updateMidi(midi, inputs = [], lightOutputs = []) {
      access = midi
      pianoInputs = inputs.filter(Boolean)
      const availableOutputs = midi ? [...midi.outputs.values()].filter((port) => port.state !== 'disconnected' && !lightOutputs.some((light) => light?.id === port.id)) : []
      output.setOutputs(new Map(availableOutputs.map((port) => [port.id, port])))
      fill(outputSelect, availableOutputs, output.status().selectedId)
      updateOutput()
      const availableInputs = midi ? [...midi.inputs.values()].filter((port) => port.state !== 'disconnected' && !pianoInputs.some((piano) => piano.id === port.id)) : []
      if (gestureId && !availableInputs.some((port) => port.id === gestureId)) { gesture.disconnect(); gestureId = '' }
      fill(gestureSelect, availableInputs, gestureId)
    },
    send(data) { const ok = output.send(data); if (!ok && output.status().error) updateOutput(); return ok },
    panic: () => output.panic(),
    gestureInputId: () => gestureId,
    describe: () => ({ gestureInput: access?.inputs.get(gestureId)?.name, instrumentOutput: access?.outputs.get(output.status().selectedId)?.name }),
    stop() { output.disconnect(); gesture.dispose() }
  }
  window.addEventListener('pagehide', api.stop)
  return api
}
