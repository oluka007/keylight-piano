import { attributeFingering } from './coaching.js'

export function mountCameraCoach({ settings, save, getTracker, getKeys, getKeyCount, sourceName = () => 'camera' }) {
  const toggle = document.getElementById('coachEnabled')
  const label = document.getElementById('coachFeedback')
  toggle.checked = !!settings.fingerCoaching
  const reset = () => {
    label.hidden = !settings.fingerCoaching
    label.textContent = `Finger coaching is advisory. Start and calibrate the ${sourceName()} to use it.`
    label.dataset.state = 'unknown'
  }
  toggle.onchange = () => { settings.fingerCoaching = toggle.checked; save(); reset() }
  reset()
  return {
    reset,
    notePlayed(pitch, note) {
      if (!settings.fingerCoaching) return
      label.hidden = false
      const observation = getTracker()?.getObservation()
      // the camera projection is only tuned for one 24-key row; the experimental Airwave source is
      // calibrated on the actual on-screen keys, so any key count the screen shows is allowed
      const calibratedOnKeys = observation?.source === 'ultraleap'
      if (!calibratedOnKeys && getKeyCount() !== 24) { label.textContent = 'Camera coaching currently covers one 24-key keyboard.'; label.dataset.state = 'unknown'; return }
      const result = attributeFingering({ pitch, note, keys: getKeys(), observation, now: performance.now() })
      label.dataset.state = result.status
      label.textContent = result.status === 'match' ? `Suggested finger ${note.finger}: observed ${result.observed.finger}, ${result.observed.side} hand.`
        : result.status === 'mismatch' ? `Right note. Suggested ${note.hand} finger ${note.finger}; observed ${result.observed.side} finger ${result.observed.finger}.`
          : 'Finger uncertain: ' + result.statusText + '. Your note score is unchanged.'
    }
  }
}
