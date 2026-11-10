const assert = require('node:assert/strict')

async function main() {
  const { diagnosticReport } = await import('../renderer/diagnostics.js')
  const report = diagnosticReport({
    version: '0.3.0', platform: 'Windows', midiAvailable: true,
    inputs: [{ name: 'Keyboard', state: 'connected', serial: 'secret-serial' }], outputs: [],
    keyboard: 'Keyboard', range: 'C3-B4', audio: { base: .002, output: .028, sampleRate: 48000 },
    lights: { transport: 'MIDI notes', state: 'Disconnected', boards: 0 },
    camera: { running: true, calibrated: false },
    song: { title: 'private-song' }, token: 'private-token', path: '/private/home/person'
  })
  assert.match(report, /Keyboard \(connected\)/)
  assert.match(report, /Audio buffer: 2\.0 ms/)
  assert.match(report, /Output delay estimate: 28\.0 ms/)
  assert.match(report, /Camera calibration: Not set/)
  for (const secret of ['secret-serial', 'private-song', 'private-token', '/private/home/person']) assert.equal(report.includes(secret), false)
  assert.match(diagnosticReport({ version: 'dev', platform: 'Android' }), /MIDI available: No/)
  assert.match(diagnosticReport({ version: 'dev', platform: 'Android' }), /Audio buffer: Not reported/)
  console.log('diagnostics: connection values, unavailable measurements and private-field exclusion pass')
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
