// Sheet music above the falling notes, for songs that come from a MusicXML score.
//
// OpenSheetMusicDisplay draws the whole score on one long line; the line then slides under a
// fixed playhead. Where the playhead points comes from musicxml.js's own played order and tempo
// map, not from OSMD's repeat logic: the two disagree (OSMD ignores repeat times="3" and follows
// a D.C. written only as words), and the notes on screen follow musicxml.js.

import { secondsAt } from './musicxml.js'

const LIB_URL = 'vendor/opensheetmusicdisplay.min.js'
const MAX_ZOOM = 1.25
const UNIT_PX = 10          // OSMD's unit in pixels at zoom 1
const OPTIONS = {
  backend: 'svg', autoResize: false, renderSingleHorizontalStaffline: true,
  drawingParameters: 'compacttight', drawMetronomeMarks: false,
  drawTitle: false, drawSubtitle: false, drawComposer: false, drawLyricist: false, drawCredits: false,
  drawPartNames: false, drawPartAbbreviations: false, drawMeasureNumbers: true,
  followCursor: false, disableCursor: true, defaultColorMusic: '#FFFFFF'
}

// A classic script: the bundle sets a global, and fails when import()ed.
let lib = null
function loadLib() {
  if (lib) return lib
  lib = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = LIB_URL
    s.onload = () => resolve(window.opensheetmusicdisplay)
    s.onerror = () => { lib = null; reject(new Error('the notation library did not load')) }
    document.head.appendChild(s)
  })
  return lib
}

// Every position on the drawn line, in written order: which measure, how far into it (in
// quarter notes) and at what x. Only valid straight after a render.
function writtenPositions(osmd) {
  const g = osmd.GraphicSheet, px = UNIT_PX * osmd.zoom, rows = []
  for (const c of g.VerticalGraphicalStaffEntryContainers) {
    const es = c.StaffEntries.filter((e) => e && g.isReliableCursorXAnchor(e))
    if (!es.length) continue
    const m = es[0].parentMeasure.parentSourceMeasure
    rows.push({
      measure: m.measureListIndex,
      quarters: (c.AbsoluteTimestamp.RealValue - m.AbsoluteTimestamp.RealValue) * 4,
      x: Math.min(...es.map((e) => e.PositionAndShape.AbsolutePosition.x)) * px
    })
  }
  return rows
}

// Those positions in played order and in song seconds: score is what musicxml.js worked out
// (order: written measure per played bar, starts: quarter notes up to each played bar, tempo).
// A bar played twice appears twice, so x jumps back at a repeat; jump marks the first position
// after any jump in the written order (a repeat, a volta, a coda).
export function playedTimeline(rows, score) {
  const byMeasure = new Map()
  for (const r of rows) {
    if (!byMeasure.has(r.measure)) byMeasure.set(r.measure, [])
    byMeasure.get(r.measure).push(r)
  }
  for (const list of byMeasure.values()) list.sort((a, b) => a.quarters - b.quarters)
  const timeline = []
  let jumped = false
  score.order.forEach((measure, bar) => {
    if (bar && measure !== score.order[bar - 1] + 1) jumped = true
    for (const r of byMeasure.get(measure) || []) {
      timeline.push({ t: secondsAt(score.tempo, score.starts[bar] + r.quarters), x: r.x, jump: jumped })
      jumped = false
    }
  })
  return timeline
}

// The x for a moment in the song: gliding between positions, and holding still before a jump
// (a repeat, a volta) rather than sliding across the music in between.
export function timelineX(timeline, pos) {
  if (!timeline.length) return 0
  let lo = 0, hi = timeline.length - 1
  if (pos <= timeline[0].t) return timeline[0].x
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (timeline[mid].t <= pos) lo = mid
    else hi = mid - 1
  }
  const a = timeline[lo], b = timeline[lo + 1]
  if (!b || b.jump || b.x <= a.x || b.t <= a.t) return a.x
  return a.x + (b.x - a.x) * Math.min(1, (pos - a.t) / (b.t - a.t))
}

export class SheetStrip {
  constructor(box, music) {
    this.box = box
    this.music = music
    this.osmd = null
    this.score = null        // the score now drawn
    this.timeline = []
    this.token = 0           // a slower render of an earlier song can't land on this one
    this.headX = 0
    this.lastX = NaN
    this.onError = null
  }

  async show(score) {
    if (score === this.score) return true
    const token = ++this.token
    this.score = null
    this.timeline = []
    this.lastX = NaN
    this.music.style.transform = ''
    const { OpenSheetMusicDisplay } = await loadLib()
    if (token !== this.token) return false
    if (!this.osmd) {
      this.osmd = new OpenSheetMusicDisplay(this.music, OPTIONS)
      this.osmd.EngravingRules.SheetMaximumWidth = 400000     // past 32767 px it would wrap
    }
    const osmd = this.osmd
    // a string needs the prolog to be taken as XML; without one, a Document says it
    const xml = score.xml
    await osmd.load(/^\s*﻿?<\?xml/.test(xml) ? xml : new DOMParser().parseFromString(xml, 'application/xml'))
    if (token !== this.token) return false
    osmd.Zoom = 1
    osmd.render()
    // fit the line to the strip's height (load() put the zoom back to 1, so it's set here)
    const svg = this.music.querySelector('svg')
    const height = svg ? parseFloat(svg.getAttribute('height')) : 0
    const room = this.box.clientHeight - 8
    if (height > 0 && room > 0) { osmd.Zoom = Math.min(MAX_ZOOM, room / height); osmd.render() }
    // past OSMD's longest line it wraps, and then x no longer follows the song
    const pages = osmd.GraphicSheet.MusicPages
    if (pages && pages[0] && pages[0].MusicSystems && pages[0].MusicSystems.length > 1) throw new Error('this score is too long to show on one line')
    this.timeline = playedTimeline(writtenPositions(osmd), score)
    this.score = score
    this.place()
    console.log('SHEET drawn zoom=' + osmd.zoom.toFixed(2) + ' positions=' + this.timeline.length)
    return true
  }

  // Where the playhead sits follows the window's width, read here rather than every frame.
  place() {
    this.headX = Math.round(this.box.clientWidth * 0.28)
    this.box.style.setProperty('--sheet-head', this.headX + 'px')
    this.lastX = NaN
  }

  // A draw still under way is dropped: the strip it was measuring for has gone.
  cancel() { this.token++ }

  // Called every frame: touches the page only when the line has moved.
  update(pos) {
    if (!this.timeline.length) return
    const x = Math.round(timelineX(this.timeline, pos) * 2) / 2
    if (x === this.lastX) return
    this.lastX = x
    this.music.style.transform = 'translate3d(' + (this.headX - x) + 'px,0,0)'
  }
}
