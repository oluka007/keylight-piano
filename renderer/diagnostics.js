import { downloadFile } from './download.js'

const text = (value) => String(value ?? '').slice(0, 160).replace(/[\r\n\t]/g, ' ')
const ports = (list) => (list || []).map((port) => `${text(port.name) || 'Unnamed port'} (${text(port.state) || 'unknown'})`).join(', ') || 'None'
const milliseconds = (seconds) => Number.isFinite(seconds) && seconds > 0 ? (seconds * 1000).toFixed(1) + ' ms' : 'Not reported'

export function diagnosticReport(snapshot) {
  const { audio = {}, camera = {}, lights = {} } = snapshot
  return [
    'Keylight connection report',
    'Version: ' + text(snapshot.version),
    'Platform: ' + text(snapshot.platform),
    'MIDI available: ' + (snapshot.midiAvailable ? 'Yes' : 'No'),
    'MIDI inputs: ' + ports(snapshot.inputs),
    'MIDI outputs: ' + ports(snapshot.outputs),
    'Keyboard input: ' + (text(snapshot.keyboard) || 'None selected'),
    'Second keyboard: ' + (text(snapshot.keyboard2) || 'None selected'),
    'Keyboard range: ' + text(snapshot.range),
    'Key light output: ' + (text(snapshot.lightOutput) || 'None selected'),
    'Light transport: ' + text(lights.transport),
    'Light service: ' + text(lights.state),
    'Full-colour boards: ' + (Number.isInteger(lights.boards) ? lights.boards : 0),
    'Audio buffer: ' + milliseconds(audio.base),
    'Output delay estimate: ' + milliseconds(audio.output),
    'Audio sample rate: ' + (Number.isFinite(audio.sampleRate) && audio.sampleRate > 0 ? audio.sampleRate + ' Hz' : 'Not reported'),
    'Camera: ' + (camera.running ? 'Running' : 'Off'),
    'Camera calibration: ' + (camera.calibrated ? 'Set' : 'Not set'),
    'Gesture MIDI input: ' + (text(snapshot.gestureInput) || 'Off'),
    'External instrument output: ' + (text(snapshot.instrumentOutput) || 'Off'),
    '',
    'This report contains port names and the settings above. It excludes music, recordings,',
    'device serial fields, local file paths, song titles, progress, and payment information.',
    'Nothing is sent automatically. Review it before sharing.'
  ].join('\n')
}

export function mountDiagnostics(getSnapshot) {
  const dialog = document.getElementById('diagnosticsDialog')
  const report = document.getElementById('diagnosticsReport')
  const status = document.getElementById('diagnosticsStatus')
  const refresh = () => { report.textContent = diagnosticReport(getSnapshot()); status.textContent = '' }
  document.getElementById('openDiagnostics').onclick = () => { refresh(); dialog.showModal() }
  document.getElementById('refreshDiagnostics').onclick = refresh
  document.getElementById('saveDiagnostics').onclick = () => {
    downloadFile(new Blob([report.textContent], { type: 'text/plain;charset=utf-8' }), 'keylight-connection-report.txt')
    status.textContent = 'Download requested. Review the report before sharing it.'
  }
  dialog.addEventListener('keydown', (event) => event.stopPropagation())
}
