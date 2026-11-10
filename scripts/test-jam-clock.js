// Pure clock regression tests: node scripts/test-jam-clock.js
const assert = require('node:assert/strict')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const near = (a, b, message) => assert.ok(Math.abs(a - b) < 1e-9, `${message}: ${a} vs ${b}`)

async function main() {
  const { createClock } = await import(pathToFileURL(path.join(__dirname, '..', 'renderer', 'jam', 'clock.js')).href)
  for (const [initial, tempos] of [[60, [180, 90, 220, 40]], [220, [40, 160, 60, 120]]]) {
    let now = 0
    const clock = createClock({ now: () => now, bpm: initial, lookahead: 0.2, setTimer: () => 1, clearTimer: () => {} })
    const windows = []
    clock.onWindow((window) => windows.push(window))
    clock.start(0)
    clock.tick()
    for (const bpm of tempos) {
      const previous = windows[windows.length - 1]
      const boundary = previous.toBeat
      const endTime = previous.timeOfBeat(boundary)
      const playhead = clock.beatAt(now)
      const oldTimes = windows.map((w) => w.timeOfBeat((w.fromBeat + w.toBeat) / 2))
      clock.setBpm(bpm)
      assert.equal(clock.bpm, bpm)
      near(clock.beatAt(now), playhead, 'tempo waits for the covered horizon')
      near(clock.timeOfBeat(boundary), endTime, 'new tempo starts at the old time endpoint')
      near(clock.beatAt(endTime), boundary, 'new tempo starts at the old beat endpoint')
      near(clock.timeOfBeat(boundary + 1) - endTime, 60 / bpm, 'new tempo after the horizon')
      windows.forEach((w, i) => {
        const beat = (w.fromBeat + w.toBeat) / 2
        near(w.timeOfBeat(beat), oldTimes[i], 'emitted window stays immutable')
        near(clock.timeOfBeat(beat), oldTimes[i], 'covered beats keep their old mapping')
      })
      const count = windows.length
      clock.tick()
      assert.equal(windows.length, count, 'changing tempo alone does not emit covered time again')
      for (let i = 0; i < 12; i++) {
        now += i === 6 ? 0.65 : 0.025
        clock.tick()
      }
      assert.ok(windows.length > count)
    }

    // Every half-open window touches the next in both beats and audio time.
    // A dense beat grid and the exact boundaries each belong to one window.
    for (let i = 0; i < windows.length; i++) {
      const w = windows[i]
      assert.ok(w.toBeat > w.fromBeat)
      assert.ok(w.timeOfBeat(w.toBeat) > w.timeOfBeat(w.fromBeat))
      if (i) {
        const previous = windows[i - 1]
        assert.equal(w.fromBeat, previous.toBeat, 'no skipped or duplicated beat interval')
        near(w.timeOfBeat(w.fromBeat), previous.timeOfBeat(previous.toBeat), 'no time gap or overlap')
      }
      assert.equal(windows.filter((other) => w.fromBeat >= other.fromBeat && w.fromBeat < other.toBeat).length, 1)
    }
    const end = windows[windows.length - 1].toBeat
    let lastTime = -Infinity
    for (let beat = 0; beat < end; beat += 1 / 128) {
      const owners = windows.filter((w) => beat >= w.fromBeat && beat < w.toBeat)
      assert.equal(owners.length, 1, `beat ${beat} is covered exactly once`)
      const time = owners[0].timeOfBeat(beat)
      assert.ok(time > lastTime, 'scheduled beat times stay strictly monotonic')
      near(clock.beatAt(time), beat, 'piecewise mapping stays invertible')
      lastTime = time
    }
    clock.stop()
  }

  // Multiple changes before the next window share one boundary; changing tempo
  // before the transport starts must preserve its scheduled start time as well.
  let now = 0
  const clock = createClock({ now: () => now, bpm: 120, setTimer: () => 1, clearTimer: () => {} })
  clock.start(1)
  clock.setBpm(180)
  clock.setBpm(60)
  near(clock.timeOfBeat(0), 1, 'tempo change before first window keeps the start')
  now = 1
  const windows = []
  clock.onWindow((w) => windows.push(w))
  clock.tick()
  const boundary = windows[0].toBeat
  const endTime = windows[0].timeOfBeat(boundary)
  clock.setBpm(220)
  clock.setBpm(40)
  near(clock.timeOfBeat(boundary), endTime, 'repeated changes keep the same horizon')
  near(clock.timeOfBeat(boundary + 1), endTime + 1.5, 'last tempo wins beyond the horizon')
  now += 0.05
  clock.tick()
  near(windows[1].timeOfBeat(windows[1].fromBeat), endTime, 'next window starts at the shared horizon')
  clock.stop()
  clock.setBpm(100)
  clock.start(2)
  near(clock.timeOfBeat(1), 2.6, 'restart resets the tempo history')
  clock.stop()
  console.log('Jam clock tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
