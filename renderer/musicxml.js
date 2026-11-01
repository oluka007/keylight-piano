// MusicXML -> notes, all parts, in the order a player plays them: repeats and
// voltas are played out, and a simple D.C. / D.S. (al Fine, al Coda) is followed.
// Hand comes from the piano staff in a part on two staves (staff 1 = right, the
// staves below = left); single-staff parts fall back to a low/high part guess.
// Each note keeps its part's index; song.parts lists the parts. Also read: fingering
// (<technical><fingering>), title and composer, the first time signature, and the
// tempo from <sound tempo>, or from <metronome> where a direction has no sound.
// Grace notes and cue notes are not played.

const STEPS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const UNIT = { long: 16, breve: 8, whole: 4, half: 2, quarter: 1, eighth: 0.5, '16th': 0.25, '32nd': 0.125, '64th': 0.0625 }
// what notation programs leave in a new score's title and composer boxes
const PLACEHOLDER = /^(untitled( score)?|title|subtitle|composer|composer ?\/ ?arranger|arranger|lyricist|score)$/i
const MAX_TIMES = 8   // a repeat played more often than this is a typo

const kid = (el, tag) => { for (const c of el.children) if (c.tagName === tag) return c; return null }
const kids = (el, tag) => [...el.children].filter((c) => c.tagName === tag)
const num = (el, tag, d = 0) => { const c = el && kid(el, tag); const v = c ? parseFloat(c.textContent) : NaN; return Number.isFinite(v) ? v : d }
const clean = (s) => (s || '').replace(/\s+/g, ' ').trim()

// "1, 2" or "1-3" -> [1, 2] / [1, 2, 3]
function voltaNumbers(s) {
  const out = []
  for (const m of String(s || '').matchAll(/(\d+)(?:\s*-\s*(\d+))?/g)) {
    const a = Number(m[1]), b = m[2] ? Math.min(Number(m[2]), a + 16) : a
    for (let i = a; i <= b; i++) out.push(i)
  }
  return out.length ? out : [1]
}

// <metronome> in quarter notes per minute; a metric modulation (note = note) has no number
function metronomeBpm(met) {
  const unit = kid(met, 'beat-unit'), per = kid(met, 'per-minute')
  if (!unit || !per) return 0
  const n = parseFloat((per.textContent.match(/\d+(\.\d+)?/) || [])[0])
  let dots = 0
  for (let c = unit.nextElementSibling; c && c.tagName === 'beat-unit-dot'; c = c.nextElementSibling) dots++
  const q = (UNIT[clean(unit.textContent)] || 1) * (2 - 1 / 2 ** dots)
  return n > 0 ? n * q : 0
}

// One measure of one part: notes and tempo marks at offsets (quarter notes) from
// its start, how far it reaches, and its repeat / volta / jump marks.
// st carries divisions and staff count from measure to measure.
function readMeasure(measure, st) {
  const m = { len: 0, notes: [], tempos: [], time: null, fwd: false, back: false, times: 0, voltaStart: null, voltaStop: false, jump: {} }
  let pos = 0, furthest = 0, lastStart = 0
  const dur = (el) => num(el, 'duration') / st.divisions
  const sound = (s) => {
    const t = parseFloat(s.getAttribute('tempo'))
    if (t > 0) m.tempos.push({ off: pos, bpm: t, prio: 1 })
    for (const a of ['dacapo', 'dalsegno', 'segno', 'coda', 'tocoda', 'fine']) {
      const v = s.getAttribute(a)
      if (v != null && v !== 'no' && !(a in m.jump)) m.jump[a] = v || 'yes'
    }
  }
  for (const el of measure.children) {
    const tag = el.tagName
    if (tag === 'attributes') {
      const d = num(el, 'divisions')
      if (d > 0) st.divisions = d
      const staves = num(el, 'staves')
      if (staves > st.staves) st.staves = staves
      const time = kid(el, 'time')
      if (time && !m.time) {
        // "3+2" beats add up
        const beats = String(kid(time, 'beats')?.textContent || '').split('+').reduce((a, b) => a + (parseFloat(b) || 0), 0)
        const beatType = num(time, 'beat-type')
        if (beats > 0 && beatType > 0) m.time = { beats, beatType }
      }
    } else if (tag === 'sound') {
      sound(el)
    } else if (tag === 'direction') {
      const s = kid(el, 'sound')
      if (s) sound(s)
      if (!s || !s.hasAttribute('tempo')) {
        const met = el.querySelector('direction-type > metronome')
        const bpm = met ? metronomeBpm(met) : 0
        if (bpm) m.tempos.push({ off: pos, bpm, prio: 0 })
      }
      if (!('segno' in m.jump) && el.querySelector('direction-type > segno')) m.jump.segno = 'yes'
    } else if (tag === 'backup') {
      pos = Math.max(0, pos - dur(el))
    } else if (tag === 'forward') {
      pos += dur(el)
    } else if (tag === 'barline') {
      const rep = kid(el, 'repeat')
      if (rep && rep.getAttribute('direction') === 'forward') m.fwd = true
      else if (rep) { m.back = true; m.times = parseInt(rep.getAttribute('times') || '0', 10) || 0 }
      const volta = kid(el, 'ending')
      if (volta && volta.getAttribute('type') === 'start') m.voltaStart = voltaNumbers(volta.getAttribute('number'))
      else if (volta) m.voltaStop = true
    } else if (tag === 'note') {
      if (kid(el, 'grace')) continue   // grace notes take no time and are not played
      const d = dur(el)
      const isChord = !!kid(el, 'chord')
      // chord notes start with the previous note, not after it
      const start = isChord ? lastStart : pos
      const pitchEl = kid(el, 'pitch')
      // cue notes take their time in their voice but are silent
      if (pitchEl && !kid(el, 'rest') && !kid(el, 'cue')) {
        const step = clean(kid(pitchEl, 'step')?.textContent) || 'C'
        const alter = Math.round(num(pitchEl, 'alter'))
        const octave = num(pitchEl, 'octave', 4)
        const staff = num(el, 'staff')
        if (staff > st.staves) st.staves = staff
        let finger = 0
        for (const f of el.querySelectorAll('notations > technical > fingering')) {
          if (f.getAttribute('substitution') === 'yes' || f.getAttribute('alternate') === 'yes') continue
          const digit = /[1-5]/.exec(f.textContent || '')
          if (digit) { finger = Number(digit[0]); break }
        }
        m.notes.push({
          pitch: (octave + 1) * 12 + (STEPS[step] ?? 0) + alter, off: start, dur: d, staff,
          voice: clean(kid(el, 'voice')?.textContent) || '1', ties: kids(el, 'tie').map((t) => t.getAttribute('type')), finger
        })
      }
      if (!isChord) { lastStart = pos; pos += d }
    }
    if (pos > furthest) furthest = pos
  }
  m.len = furthest
  return m
}

// The order measures are played in. bars: per measure index, the marks of all
// parts merged. Repeats go round `times` (2, or as many as the voltas need);
// a volta is played on the passes it is numbered for. Then one D.C. or D.S. is
// followed when it is simple: the second time through takes no repeats, plays
// only the last volta of each set, and stops at Fine or skips from To Coda to Coda.
function playOrder(bars) {
  const n = bars.length
  const limit = n * 10 + 100
  const voltas = []
  let open = null
  for (let k = 0; k < n; k++) {
    if (bars[k].voltaStart) { if (open) voltas.push(open); open = { first: k, last: k, nums: bars[k].voltaStart } }
    else if (open) open.last = k
    if (open && bars[k].voltaStop) { voltas.push(open); open = null }
  }
  if (open) voltas.push(open)
  const voltaAt = new Map(voltas.map((v) => [v.first, v]))
  const inVolta = new Array(n).fill(null)
  for (let i = voltas.length - 1; i >= 0; i--) {
    const v = voltas[i]
    v.next = voltas[i + 1] && voltas[i + 1].first === v.last + 1 ? voltas[i + 1] : null
    // the highest number still to come in this set of voltas
    v.top = Math.max(...v.nums, v.next ? v.next.top : 0)
    for (let k = v.first; k <= v.last; k++) inVolta[k] = v
  }

  let order = []
  let k = 0, start = 0, pass = 1, jumped = false
  while (k < n && order.length < limit) {
    const b = bars[k]
    if (b.fwd && !jumped) { start = k; pass = 1 }
    jumped = false
    const v = voltaAt.get(k)
    if (v && !v.nums.includes(pass)) {
      // not this time round; past the last volta of a set, that repeat is done
      if (!v.next) { pass = 1; start = v.last + 1 }
      k = v.last + 1
      continue
    }
    order.push(k)
    const vol = inVolta[k]
    if (b.back) {
      const times = Math.min(MAX_TIMES, b.times || (vol ? Math.max(2, vol.top) : 2))
      if (pass < times) { pass++; k = start; jumped = true; continue }
      pass = 1; start = k + 1
    } else if (vol && k === vol.last && !vol.next) {
      pass = 1; start = k + 1   // the last volta of a set: that repeat is done
    }
    k++
  }

  const jumps = []
  bars.forEach((b, i) => { if (b.jump.dacapo || b.jump.dalsegno) jumps.push(i) })
  if (jumps.length !== 1) return order
  const j = jumps[0], jb = bars[j].jump
  let target = 0
  if (jb.dalsegno) {
    const named = bars.findIndex((b, i) => i <= j && b.jump.segno && b.jump.segno === jb.dalsegno)
    target = named >= 0 ? named : bars.findIndex((b, i) => i <= j && b.jump.segno)
  }
  const last = order.lastIndexOf(j)
  if (target < 0 || last < 0) return order
  const fine = bars.findIndex((b, i) => i >= target && b.jump.fine)
  const toCoda = bars.findIndex((b, i) => i >= target && i <= j && b.jump.tocoda)
  const coda = bars.findIndex((b, i) => i > j && b.jump.coda)
  order = order.slice(0, last + 1)
  for (let i = target; i < n && order.length < limit;) {
    const v = voltaAt.get(i)
    if (v && v.next) { i = v.last + 1; continue }
    order.push(i)
    if (i === fine) break
    if (i === toCoda && coda > i) { i = coda; continue }
    i++
  }
  return order
}

function scoreTitle(doc) {
  const real = (s) => (s && !PLACEHOLDER.test(s) ? s : '')
  const work = real(clean(doc.querySelector('work > work-title')?.textContent))
  const movement = real(clean(doc.querySelector('movement-title')?.textContent))
  if (work && movement && !work.includes(movement) && !movement.includes(work)) return work + ': ' + movement
  if (work || movement) return work || movement
  // otherwise the words printed as the title: a title credit, else the biggest credit text
  const credits = [...doc.querySelectorAll('credit')]
  const typed = credits.find((c) => clean(kid(c, 'credit-type')?.textContent) === 'title')
  if (typed) return real(clean(kid(typed, 'credit-words')?.textContent))
  let best = null, size = 0, tie = false
  for (const w of doc.querySelectorAll('credit > credit-words')) {
    const s = parseFloat(w.getAttribute('font-size')) || 0
    if (s > size) { best = w; size = s; tie = false } else if (s === size) tie = true
  }
  return best && !tie ? real(clean(best.textContent)) : ''
}

function scoreComposer(doc) {
  const real = (s) => (s && !PLACEHOLDER.test(s) ? s : '')
  const creators = [...doc.querySelectorAll('identification > creator')]
  const of = (type) => creators.find((c) => c.getAttribute('type') === type)
  const c = of('composer') || of('arranger') || creators.find((x) => !x.getAttribute('type'))
  if (c) return real(clean(c.textContent))
  const typed = [...doc.querySelectorAll('credit')].find((x) => clean(kid(x, 'credit-type')?.textContent) === 'composer')
  return typed ? real(clean(kid(typed, 'credit-words')?.textContent)) : ''
}

// Seconds at a played position (in quarter notes) through a tempo map of { beat, bpm }.
export function secondsAt(map, b) {
  let s = 0
  for (let i = 0; i < map.length; i++) {
    const from = map[i].beat
    const to = i + 1 < map.length ? map[i + 1].beat : Infinity
    if (b <= from) break
    s += (Math.min(b, to) - from) * 60 / map[i].bpm
  }
  return s
}

export function parseMusicXml(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('Invalid MusicXML')
  const root = doc.documentElement
  if (root.tagName === 'score-timewise') throw new Error('Timewise MusicXML is not supported; save it as partwise MusicXML')
  let parts = kids(root, 'part')
  if (!parts.length) parts = [...doc.querySelectorAll('part')]
  if (!parts.length) throw new Error('MusicXML has no <part>')

  const info = new Map()
  for (const sp of doc.querySelectorAll('part-list > score-part')) {
    const mi = sp.querySelector('midi-instrument')
    info.set(sp.getAttribute('id'), {
      name: clean(kid(sp, 'part-name')?.textContent),
      channel: mi ? Math.max(0, num(mi, 'midi-channel', 1) - 1) : 0,
      program: mi ? Math.max(0, num(mi, 'midi-program', 1) - 1) : 0
    })
  }

  // every measure of every part, read once in written order
  const firstDivisions = parseFloat(doc.querySelector('divisions')?.textContent || '1') || 1
  const read = parts.map((part) => {
    const st = { divisions: firstDivisions, staves: 1 }
    const measures = kids(part, 'measure').map((el) => readMeasure(el, st))
    return { measures, staves: st.staves, info: info.get(part.getAttribute('id')) || { name: '', channel: 0, program: 0 } }
  })

  // a bar lasts as long as its longest part (an empty bar: as its time signature says)
  const count = read.reduce((a, r) => Math.max(a, r.measures.length), 0)
  const bars = []
  let meter = null, meterLen = 4
  for (let k = 0; k < count; k++) {
    const bar = { len: 0, fwd: false, back: false, times: 0, voltaStart: null, voltaStop: false, jump: {} }
    for (const r of read) {
      const m = r.measures[k]
      if (!m) continue
      if (m.len > bar.len) bar.len = m.len
      if (m.fwd) bar.fwd = true
      if (m.back) { bar.back = true; bar.times = Math.max(bar.times, m.times) }
      if (m.voltaStart && !bar.voltaStart) bar.voltaStart = m.voltaStart
      if (m.voltaStop) bar.voltaStop = true
      for (const a in m.jump) if (!(a in bar.jump)) bar.jump[a] = m.jump[a]
      if (m.time) { if (!meter) meter = m.time; meterLen = (m.time.beats * 4) / m.time.beatType }
    }
    if (!bar.len) bar.len = meterLen
    bars.push(bar)
  }

  // where each played bar starts, in quarter notes
  const order = playOrder(bars)
  const starts = []
  let beat = 0
  for (const k of order) { starts.push(beat); beat += bars[k].len }

  // Positions are counted in quarter notes, then turned into seconds through one
  // tempo map shared by every part (tempo marks usually live in the first part
  // only, but apply to the whole score).
  const tempoMarks = []   // { beat, bpm, part, prio, seq }
  const placed = []
  read.forEach((r, p) => {
    const notes = []
    const tied = new Map()   // staff:voice:pitch -> note still being extended by a tie
    order.forEach((k, i) => {
      const m = r.measures[k]
      if (!m) return
      const base = starts[i]
      const prevBase = i ? starts[i - 1] : base
      for (const t of m.tempos) tempoMarks.push({ beat: base + t.off, bpm: t.bpm, part: p, prio: t.prio, seq: tempoMarks.length })
      for (const ev of m.notes) {
        const start = base + ev.off
        const tieKey = ev.staff + ':' + ev.voice + ':' + ev.pitch
        let open = null, openKey = tieKey
        if (ev.ties.includes('stop')) {
          // the same staff and voice first, if it ends here (or, across a bar line,
          // ends inside the bar just played); ties may also cross voices or staves
          const same = tied.get(tieKey)
          const meets = (n) => Math.abs(n.endBeat - start) < 1e-6
          if (same && (meets(same) || (ev.off < 1e-6 && same.endBeat > prevBase + 1e-6 && same.endBeat < start + 1e-6))) open = same
          else {
            for (const [key, n] of tied) {
              if (n.pitch === ev.pitch && meets(n) && (!open || key.startsWith(ev.staff + ':'))) { open = n; openKey = key }
            }
          }
        }
        if (open) {
          // continuation of a tied note: lengthen it instead of striking again
          open.endBeat = start + ev.dur
          tied.delete(openKey)
          if (ev.ties.includes('start')) tied.set(tieKey, open)
        } else {
          const note = { pitch: ev.pitch, vel: 100, startBeat: start, endBeat: start + ev.dur, staff: ev.staff, finger: ev.finger }
          notes.push(note)
          if (ev.ties.includes('start')) tied.set(tieKey, note)
        }
      }
    })
    placed.push(notes)
  })

  // tempo map: at the same beat the first part wins over later parts; within a
  // part a <sound tempo> wins over a bare metronome mark, then the last mark
  // written wins (a correction after a default)
  tempoMarks.sort((a, b) => a.beat - b.beat || a.part - b.part || a.prio - b.prio || a.seq - b.seq)
  const map = []
  for (const m of tempoMarks) {
    const last = map[map.length - 1]
    if (!last || m.beat > last.beat + 1e-6) map.push(m)
    else if (m.part === last.part) map[map.length - 1] = m
  }
  if (!map.length || map[0].beat > 1e-6) map.unshift({ beat: 0, bpm: map.length ? map[0].bpm : 120 })
  const secAt = (b) => secondsAt(map, b)

  const all = []
  const partList = []
  placed.forEach((notes, p) => {
    const r = read[p]
    if (!notes.length) return
    let sum = 0, low = 127, high = 0
    for (const n of notes) { sum += n.pitch; if (n.pitch < low) low = n.pitch; if (n.pitch > high) high = n.pitch }
    const partHand = sum / notes.length < 60 ? 'left' : 'right'
    // staff numbers only mean hands in a part written on two staves
    const twoStaves = r.staves >= 2
    const index = partList.length
    partList.push({ index, name: r.info.name, channel: r.info.channel, program: r.info.program, noteCount: notes.length, low, high, hand: twoStaves ? 'both' : partHand })
    for (const n of notes) {
      const hand = twoStaves ? (n.staff >= 2 ? 'left' : 'right') : partHand
      const start = secAt(n.startBeat)
      const note = { pitch: n.pitch, vel: n.vel, start, dur: Math.max(0.05, secAt(n.endBeat) - start), hand, part: index }
      if (n.finger) note.finger = n.finger
      all.push(note)
    }
  })
  const tempo = map[0].bpm
  if (!all.length) throw new Error('No notes found in MusicXML')
  all.sort((a, b) => a.start - b.start)
  return {
    notes: all,
    duration: all.reduce((m, n) => Math.max(m, n.start + n.dur), 0),
    tempo,
    title: scoreTitle(doc),
    artist: scoreComposer(doc),
    timeSignature: meter,
    parts: partList,
    bars: starts.map(secAt),
    // for drawing the score and following it (sheet.js): the file, and how its measures are played
    score: { xml: text, order, starts, tempo: map.map(({ beat, bpm }) => ({ beat, bpm })) }
  }
}
