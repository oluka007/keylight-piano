// Authoring helpers for level files: write tunes as text instead of arrays of objects.
const SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/** 'C4:2' -> MIDI 60 held 2 beats; 'r:1' is a one-beat rest; beats default to 1. */
export function seq(text) {
  return text.trim().split(/\s+/).map((tok) => {
    const [name, len] = tok.split(':')
    const beats = len === undefined ? 1 : Number(len)
    if (name === 'r') return { p: null, beats }
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(name)
    if (!m || !(beats > 0)) throw new Error(`bad note "${tok}"`)
    return { p: (Number(m[3]) + 1) * 12 + SEMITONE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0), beats }
  })
}

/** Item factory bound to a lesson id, so item ids stay unique: item('find', title, type, params, passAt). */
export const itemsFor = (lessonId) => (key, title, type, params, passAt = { accuracy: 0.8 }) =>
  ({ id: `${lessonId}.${key}`, title, type, params, passAt })
