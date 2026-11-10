// Scales for the Jam scale lock. Keys are pitch classes 0..11 (0 = C).

export const SCALES = {
  major: { id: 'major', name: 'Major', intervals: [0, 2, 4, 5, 7, 9, 11] },
  minor: { id: 'minor', name: 'Minor', intervals: [0, 2, 3, 5, 7, 8, 10] },
  majorPentatonic: { id: 'majorPentatonic', name: 'Major pentatonic', intervals: [0, 2, 4, 7, 9] },
  minorPentatonic: { id: 'minorPentatonic', name: 'Minor pentatonic', intervals: [0, 3, 5, 7, 10] },
  blues: { id: 'blues', name: 'Blues', intervals: [0, 3, 5, 6, 7, 10] },
  dorian: { id: 'dorian', name: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10] },
  chromatic: { id: 'chromatic', name: 'Chromatic', intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] }
}

const mod12 = (n) => ((n % 12) + 12) % 12

// Own properties only: ids such as 'constructor', 'toString' or '__proto__' must never
// reach Object.prototype. An unknown or non-string id is not a scale.
const scaleOf = (id) => (typeof id === 'string' && Object.hasOwn(SCALES, id) ? SCALES[id] : null)

export function inScale(pitch, key, scaleId) {
  const s = scaleOf(scaleId)
  if (!s) return false
  return s.intervals.includes(mod12(pitch - key))
}

// Nearest scale note; a tie goes down. An unknown id leaves the pitch where it is,
// which is the same result as the chromatic scale (every pitch is already in it).
export function snap(pitch, key, scaleId) {
  if (inScale(pitch, key, scaleId)) return pitch
  for (let d = 1; d < 12; d++) {
    if (inScale(pitch - d, key, scaleId)) return pitch - d
    if (inScale(pitch + d, key, scaleId)) return pitch + d
  }
  return pitch
}

export function scalePitches(key, scaleId, lo, hi) {
  const out = []
  for (let p = lo; p <= hi; p++) if (inScale(p, key, scaleId)) out.push(p)
  return out
}
