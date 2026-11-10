const MESSAGES = Object.freeze({
  'no-suggestion': 'No fingering suggestion for this note',
  'wrong-note': 'Played note does not match the suggested note',
  inactive: 'Camera tracking is paused or stopped',
  uncalibrated: 'Calibrate the camera key row first',
  stale: 'Camera observation is missing or too old',
  'missing-key': 'Played key is outside the camera keyboard geometry',
  'missing-finger': 'No fingertip confidently located near the played key',
  ambiguous: 'Multiple fingertips or neighbouring keys are plausible',
  'low-confidence': 'Hand identity is uncertain',
  match: 'Observed finger matches the suggestion',
  mismatch: 'Right note, different observed finger'
})

export function attributeFingering(event, options = {}) {
  const { pitch, note, keys, observation, now } = event
  const { maxAgeMs = 200, minConfidence = 0.8, maxOff = 0.12, ambiguityRatio = 0.15 } = options
  // an experimental non-camera source names itself in the messages that mention the sensor
  const sensor = event.observation?.source === 'ultraleap' ? 'Airwave sensor' : null
  const result = (reason, observed = null) => ({
    status: reason === 'match' || reason === 'mismatch' ? reason : 'unknown',
    reason, statusText: sensor ? MESSAGES[reason].replace(/^Camera/, sensor).replace(/the camera/g, 'the sensor') : MESSAGES[reason],
    pitch, observed, affectsScore: false
  })
  if (!note || !Number.isInteger(note.finger) || note.finger < 1 || note.finger > 5 ||
      !['left', 'right'].includes(note.hand)) return result('no-suggestion')
  if (note.pitch !== pitch) return result('wrong-note')
  if (!observation?.active) return result('inactive')
  if (!observation.calibrated) return result('uncalibrated')
  const fresh = (timestamp) => Number.isFinite(now) && Number.isFinite(timestamp) &&
    now >= timestamp && now - timestamp <= maxAgeMs
  if (!fresh(observation.observedAt)) return result('stale')
  if (!keys || keys.length < 2) return result('missing-key')
  const target = keys.find((key) => key.pitch === pitch)
  const first = keys[0], last = keys[keys.length - 1]
  if (!target || !Number.isFinite(target.w) || target.w <= 0 || last.cx <= first.cx) return result('missing-key')
  const candidates = []
  let uncertainKey = false
  for (const tip of observation.fingertips) {
    if (!Number.isFinite(tip.t) || !Number.isFinite(tip.off) || Math.abs(tip.off) > maxOff ||
        tip.t < -0.02 || tip.t > 1.02) continue
    const x = first.cx + tip.t * (last.cx - first.cx)
    if (Math.abs(target.cx - x) > target.w * 0.65) continue
    const ranked = keys.map((key) => ({ key, distance: Math.abs(key.cx - x) * (key.black ? 1.6 : 1) }))
      .sort((a, b) => a.distance - b.distance)
    const [best, second] = ranked
    if (best.key.pitch !== pitch) {
      if (second.key.pitch === pitch && second.distance - best.distance <= target.w * ambiguityRatio) uncertainKey = true
      continue
    }
    if (second.distance - best.distance <= target.w * ambiguityRatio) uncertainKey = true
    candidates.push(tip)
  }
  if (uncertainKey || candidates.length > 1) return result('ambiguous')
  if (!candidates.length) return result('missing-finger')
  const tip = candidates[0]
  if (!fresh(tip.observedAt)) return result('stale')
  if (!Number.isFinite(tip.confidence) || tip.confidence < minConfidence ||
      !['left', 'right'].includes(tip.side) || !Number.isInteger(tip.finger) ||
      tip.finger < 1 || tip.finger > 5) return result('low-confidence')
  const observed = { side: tip.side, finger: tip.finger, confidence: tip.confidence,
    ageMs: now - tip.observedAt }
  return result(tip.side === note.hand && tip.finger === note.finger ? 'match' : 'mismatch', observed)
}
