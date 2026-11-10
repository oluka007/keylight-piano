const assert = require('node:assert/strict')
const { test } = require('node:test')
const moduleReady = import('../renderer/airwave.js')

class MidiInput extends EventTarget {
  constructor(id) { super(); this.id = id; this.type = 'input'; this.state = 'connected' }
  send(data) { this.dispatchEvent(Object.assign(new Event('midimessage'), { data })) }
  unplug() { this.state = 'disconnected'; this.dispatchEvent(new Event('statechange')) }
}

test('decodes all host CC controls on every MIDI channel with independent endpoint expectations', async () => {
  const { decodeAirwave } = await moduleReady
  const controls = ['grasp', 'slideLeft', 'slideRight', 'glideLeft', 'glideRight',
    'raiseLeft', 'raiseRight', 'tiltLeft', 'tiltRight', 'flexLeft', 'flexRight']
  for (let channel = 0; channel < 16; channel++) {
    for (const [index, control] of controls.entries()) {
      for (const [raw, expected] of [[0, 0], [127, 1], [31, 31 / 127]]) {
        assert.deepEqual(decodeAirwave(new Uint8Array([0xb0 + channel, 21 + index, raw])),
          { control, value: expected, channel })
      }
    }
  }
})

test('rejects malformed bytes, non-CC messages and unrelated controllers', async () => {
  const { decodeAirwave } = await moduleReady
  for (const data of [null, [], [0xb0, 21], [0xb0, 21, 127, 0], [0x90, 21, 127],
    [0xf0, 21, 127], [0xb0, 64, 127], [0xb0, 21, -1], [0xb0, 21, 128],
    [0xb0, 21, NaN], [0xb0, 21, 0.5], [0xb0, 21.5, 0], ['176', 21, 0]]) {
    assert.equal(decodeAirwave(data), null)
  }
})

test('selected gesture input produces bounded expression and retains slide, glide and flex', async () => {
  const { createAirwave } = await moduleReady
  const output = []
  const controller = createAirwave({ onExpression: (value) => output.push(value) })
  const gesture = new MidiInput('gesture')
  controller.selectInput(gesture, [new MidiInput('piano')])
  controller.setEnabled(true)
  for (const data of [[0xb0, 26, 127], [0xb0, 27, 0], [0xb0, 28, 127],
    [0xb0, 29, 0], [0xb0, 21, 127], [0xb0, 22, 127], [0xb0, 24, 0], [0xb0, 30, 127]]) gesture.send(data)
  assert.deepEqual(output.at(-1), { raise: 0.5, tilt: 0.5, grasp: 1 })
  assert.equal(controller.getState().status, 'receiving')
  assert.equal(controller.getState().gestures.slideLeft, 1)
  assert.equal(controller.getState().gestures.glideLeft, 0)
  assert.equal(controller.getState().gestures.flexLeft, 1)
  output.at(-1).raise = 42
  assert.equal(controller.getState().expression.raise, 0.5)
  controller.dispose()
})

test('ignores unselected sources and never takes a declared piano input', async () => {
  const { createAirwave } = await moduleReady
  const output = []
  const controller = createAirwave({ onExpression: (value) => output.push(value) })
  const piano = new MidiInput('piano'), gesture = new MidiInput('gesture')
  controller.selectInput(gesture, [piano])
  controller.setEnabled(true)
  assert.equal(controller.consume([0xb0, 26, 127], piano.id), null)
  assert.equal(controller.consume([0xb0, 26, 127]), null)
  assert.deepEqual(output.at(-1), { raise: 0, tilt: 0, grasp: 0 })
  assert.equal(controller.selectInput(new MidiInput('piano'), [piano]).status, 'input-conflict')
  gesture.send([0xb0, 26, 127])
  assert.deepEqual(output.at(-1), { raise: 0, tilt: 0, grasp: 0 })
  controller.dispose()
})

for (const action of ['disable', 'unplug', 'disconnect', 'replace', 'dispose']) {
  test(`${action} resets output and removes the previous gesture values`, async () => {
    const { createAirwave } = await moduleReady
    const output = []
    const controller = createAirwave({ onExpression: (value) => output.push(value) })
    const gesture = new MidiInput('gesture')
    controller.selectInput(gesture)
    controller.setEnabled(true)
    gesture.send([0xb0, 26, 127])
    assert.deepEqual(output.at(-1), { raise: 1, tilt: 0, grasp: 0 })
    switch (action) {
      case 'disable': controller.setEnabled(false); break
      case 'unplug': gesture.unplug(); break
      case 'disconnect': controller.disconnect(); break
      case 'replace': controller.selectInput(new MidiInput('replacement')); break
      case 'dispose': controller.dispose(); break
      default: assert.fail('unexpected test action')
    }
    const count = output.length
    gesture.send([0xb0, 21, 127])
    assert.deepEqual(output.at(-1), { raise: 0, tilt: 0, grasp: 0 })
    assert.equal(output.length, count)
    assert.deepEqual(controller.getState().gestures, {})
    controller.dispose()
  })
}
