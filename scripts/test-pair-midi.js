const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

class Port extends EventTarget {
  constructor(id) { super(); this.id = id; this.name = id; this.state = 'connected'; this.messages = [] }
  send(data) { this.messages.push([...data]) }
  clear() {}
}

async function main() {
  // Only the DOM and MIDI wire are faked; use the shipped controls and output controller.
  const elements = new Map()
  global.document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, { value: '', replaceChildren() {} })
      return elements.get(id)
    },
    createElement: () => ({})
  }
  global.window = new EventTarget()
  const { mountPerformanceControls } = await import('../renderer/performance-controls.js')
  const controls = mountPerformanceControls(() => {})
  const instrument = new Port('instrument'), lighting = new Port('lighting')
  controls.updateMidi({ inputs: new Map(), outputs: new Map([[instrument.id, instrument], [lighting.id, lighting]]) }, [], [lighting])
  elements.get('instrumentOutput').value = instrument.id
  elements.get('instrumentOutput').onchange()

  const source = readFileSync(require.resolve('../renderer/app.js'), 'utf8')
  // Execute the actual dispatchers without booting the renderer, audio or hardware.
  const single = source.slice(source.indexOf('function handleMidiMessage('), source.indexOf('function handleNoteOn('))
  const paired = source.slice(source.indexOf('const pair = '), source.indexOf('// With a light service,'))
  const local = { notes: [], sustain: [], pressure: [] }
  const context = vm.createContext({
    performanceControls: controls, settings: { expression: true, bendRange: 48 },
    setup: { open: false }, rawLogged: 0, base: 48, kbBase: () => context.base,
    saveSettings() {}, midiInput: { id: 'left' }, midiInput2: { id: 'right' },
    mpeFor: () => ({ feed() {}, bendRangeFor: () => null }),   // no keyboard announces anything here
    routeToJam: () => false, jamUi: null,   // the Jam screen is not showing in this slice
    handleNoteOn: (...args) => local.notes.push(['on', ...args]),
    handleNoteOff: (...args) => local.notes.push(['off', ...args]),
    setPolyPressure: (...args) => local.pressure.push(args),
    setSustain: (down) => local.sustain.push(down),
    logMidi() {}, logExpr() {}, logRaw() {}, setBend() {}, setPressure() {}, setSlide() {},
    console: { log() {} }
  })
  vm.runInContext(single + paired, context, { filename: 'renderer/app.js (production MIDI dispatch)' })
  const send = (slot, data) => context.pairMessage(slot, new Uint8Array(data))
  const take = () => instrument.messages.splice(0)
  try {
    send(0, [0x92, 50, 100]); send(1, [0x95, 50, 90])
    assert.deepEqual(take(), [[0x92, 50, 100], [0x95, 74, 90]], 'D2: mapped paired notes reach selected output exactly once on original MIDI channels')
    assert.deepEqual(local.notes, [['on', 50, 100, 2], ['on', 74, 90, 21]], 'internal channels retain slot separation')

    context.base = 60
    send(0, [0xA2, 50, 70]); send(1, [0xA5, 50, 80])
    send(0, [0x82, 50, 45]); send(1, [0x95, 50, 0])
    send(0, [0x82, 50, 0]); send(1, [0xA5, 50, 99])
    assert.deepEqual(take(), [[0xA2, 50, 70], [0xA5, 74, 80], [0x82, 50, 45], [0x95, 74, 0]], 'pressure and both release encodings use stored pitches after the row moves; orphan events are silent')

    context.settings.expression = false
    send(1, [0x93, 52, 88]); send(1, [0xA3, 52, 66]); send(1, [0x83, 52, 0])
    assert.deepEqual(take(), [[0x93, 88, 88], [0xA3, 88, 66], [0x83, 88, 0]], 'external pressure is independent of the internal expression setting')

    send(0, [0x91, 55, 100]); send(0, [0x96, 55, 80]); send(1, [0x91, 55, 90])
    send(0, [0xB1, 123, 0]); send(0, [0xB6, 120, 0]); send(1, [0x81, 55, 30])
    assert.deepEqual(take(), [[0x91, 67, 100], [0x96, 67, 80], [0x91, 91, 90], [0x81, 67, 0], [0x86, 67, 0], [0x81, 91, 30]], 'all-off releases mapped notes on their channels without killing the other device')

    const pedalFrame = (value) => Array.from({ length: 16 }, (_, ch) => [0xB0 | ch, 64, value])
    send(0, [0xB2, 64, 100]); send(1, [0xB5, 64, 127])
    send(0, [0xB2, 64, 0]); send(1, [0xB5, 64, 90]); send(1, [0xB5, 64, 0])
    assert.deepEqual(take(), [...pedalFrame(127), ...pedalFrame(0)], 'combined pedal transitions reach every performance channel once, even when pedals use different channels')
    assert.equal(local.sustain.at(-1), false)

    send(1, [0xE5, 12, 65]); send(0, [0xD2, 70]); send(0, [0xC2, 4]); send(1, [0xB5, 74, 80])
    send(0, [0xF0, 1, 0xF7])
    assert.deepEqual(take(), [[0xE5, 12, 65], [0xD2, 70], [0xC2, 4], [0xB5, 74, 80]], 'fallback voice messages forward once; SysEx stays off performance output')
    assert.deepEqual(lighting.messages, [], 'performance does not reach lighting output')
    console.log('Paired MIDI: production dispatch, mapped notes/releases/pressure, channel-safe all-off and combined sustain PASS (fake wire only)')
  } finally {
    controls.stop()
    delete global.document
    delete global.window
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
