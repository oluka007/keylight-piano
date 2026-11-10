const assert = require('node:assert/strict')

class Port extends EventTarget {
  constructor(id) { super(); this.id = id; this.state = 'connected'; this.messages = []; this.queue = []; this.cleared = 0 }
  send(data, timestamp) {
    if (this.failSend) throw new DOMException('Cannot send', 'InvalidStateError')
    if (this.state === 'disconnected') throw new DOMException('Disconnected', 'InvalidStateError')
    const message = { data: [...data], timestamp }
    if (timestamp !== undefined) this.queue.push(message)
    else this.messages.push(message)
  }
  clear() { this.queue = []; this.cleared++ }
  unplug() { this.state = 'disconnected'; this.dispatchEvent(new Event('statechange')) }
}

async function main() {
  const { createMidiOut } = await import('../renderer/midi-out.js')
  const a = new Port('a'), b = new Port('b'), lighting = new Port('lights')
  const out = createMidiOut()
  out.setOutputs(new Map([['a', a], ['b', b], ['lights', lighting]]))
  assert.equal(out.send([0x90, 60, 100]), false, 'enumeration must not select an output')
  assert.equal(a.messages.length + b.messages.length + lighting.messages.length, 0)
  assert.equal(out.select('missing'), false)
  assert.equal(out.select('a'), true)
  for (const data of [[0x91, 60, 100], [0x81, 60, 0], [0xB1, 64, 127], [0xD1, 80], [0xA1, 60, 80], [0xE1, 0, 64], [0xC1, 4]]) {
    assert.equal(out.send(new Uint8Array(data)), true)
    assert.deepEqual(a.messages.at(-1), { data, timestamp: undefined })
  }
  assert.equal(out.send([0x90, 64, 99], 1234.5), true)
  assert.deepEqual(a.queue, [{ data: [0x90, 64, 99], timestamp: 1234.5 }])
  for (const data of [[0xF0, 0, 0xF7], [0x90, 128, 3], [0x90, 60], [0xD0, 60, 3]]) assert.throws(() => out.send(data), TypeError)
  assert.throws(() => out.send([0x90, 60, 90], NaN), RangeError)

  out.select('b')
  assert.equal(a.queue.length, 0, 'switching clears future notes on the old port')
  for (let ch = 0; ch < 16; ch++) {
    for (const data of [[0xB0 | ch, 64, 0], [0xB0 | ch, 123, 0], [0xB0 | ch, 120, 0], [0xE0 | ch, 0, 64]]) {
      assert.ok(a.messages.some((m) => JSON.stringify(m.data) === JSON.stringify(data)), 'panic resets every channel')
    }
  }
  assert.equal(b.messages.length, 0, 'selecting must not send any setup notes')
  out.send([0x92, 67, 100], 2000)
  out.panic()
  assert.equal(b.queue.length, 0)
  out.send([0x90, 60, 100], 3000)
  b.unplug()
  assert.equal(b.queue.length, 0, 'disconnect clears queued notes')
  assert.equal(out.status().selectedId, null)
  b.state = 'connected'
  out.setOutputs(new Map([['b', b]]))
  assert.equal(out.send([0x90, 60, 100]), false, 'reconnection requires explicit selection')
  out.select('b')
  out.setOutputs(new Map())
  assert.equal(out.status().selectedId, null, 'removed ports are detached')
  out.setOutputs(new Map([['a', a]])); out.select('a'); out.disconnect()
  assert.equal(out.send([0x90, 60, 100]), false)
  out.select('a'); a.failSend = true
  assert.equal(out.send([0x90, 60, 100]), false)
  assert.equal(out.status().selectedId, null, 'send failure detaches output')
  assert.equal(out.status().error, 'Cannot send', 'send failure remains visible')
  assert.equal(lighting.messages.length, 0, 'lighting port stays untouched')
  console.log('MIDI output: explicit routing, messages, timestamps, panic and disconnect PASS (fake ports only)')
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
