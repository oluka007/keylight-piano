// Player canvas renderer: falling notes over the keyboard (24 keys, or 49 on the ROLI Piano).
//   CASCADE   - the keyboard as a 3D object seen from above and in front; the notes ride a plane
//               that recedes behind it towards a vanishing point above the top edge. Hand colours.
//   RAINBOW   - CASCADE, a vivid hue per pitch
//   COLORNOTE - CASCADE, the playground colour per note name, with the names on the bars
//   CLASSIC   - flat lanes over a flat keyboard
// Free play (no notes, s.scale set): the 3D keyboard with the scale lit, and rising bubbles.
// The stage with its lanes, and the keyboard in its current lit state, are drawn into offscreen
// layers that are redrawn only when they change; a frame mostly draws the notes.
import { COLORS } from './theme.js'

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
export const noteName = (p) => NOTE_NAMES[((p % 12) + 12) % 12] + (Math.floor(p / 12) - 1)
const BAR_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
const pcOf = (p) => ((p % 12) + 12) % 12

/* ------------------------------------------------------------------ palette */
// The stage colours are the CSS tokens in style.css :root (read once the stylesheet is in);
// the literals here are the defaults. Hand colours always come from theme.js.
const PAL = {
  bgTop: '#2b2b32',
  bgBot: '#141418',
  bed: '#0f0f13',
  white: '#d9d9de',
  whiteOff: '#bfbfc6',
  black: '#1b1b21',
  blackScale: '#2a2a33',
  accent: '#0064C8',
  accentHi: '#3D8BFF',
  accent2: '#a9ccff',
  cream: '#ffffff',
  ink: '#12122D',
  right: (COLORS && COLORS.hand && COLORS.hand.right) || '#FF8A3D',
  left: (COLORS && COLORS.hand && COLORS.hand.left) || '#3D8BFF'
}
const PAL_TOKENS = {
  bgTop: '--stage-top', bgBot: '--stage-bottom', bed: '--key-bed', white: '--key-white', whiteOff: '--key-white-off',
  black: '--key-black', blackScale: '--key-black-scale', accent: '--accent', accentHi: '--accent-hi',
  accent2: '--accent-2', cream: '--text', ink: '--ink'
}
// The old flat theme's stage and key values (a dark violet "white" key) can't light a 3D
// keyboard; while a stylesheet still carries them, those few keep the defaults above.
const OLD_STAGE = {
  '--stage-top': '#0b0a12', '--stage-bottom': '#151224', '--key-bed': '#07060c', '--key-white': '#37324b',
  '--key-white-off': '#27233a', '--key-black': '#0e0c17', '--key-black-scale': '#2b2640'
}
let palReady = false
let palTries = 0
// true when the palette changed (cached layers, gradients and tones must be rebuilt)
function readPalette() {
  if (palReady || typeof document === 'undefined' || !document.documentElement) return false
  const cs = getComputedStyle(document.documentElement)
  // stylesheet not applied yet; after a few seconds without one, settle for the defaults
  if (!cs.getPropertyValue('--text').trim() && !cs.getPropertyValue('--stage-top').trim() && ++palTries < 240) return false
  for (const k in PAL_TOKENS) {
    const name = PAL_TOKENS[k]
    const v = cs.getPropertyValue(name).trim().toLowerCase()
    if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/.test(v) && OLD_STAGE[name] !== v) PAL[k] = v
  }
  palReady = true
  return true
}
const FONT = '"Outfit", -apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif'
const SCORING_FALLBACK = { perfect: '#A3FFEB', good: '#FFCE48', early: '#B28EF3', late: '#FFA0C5', missed: '#E16E73' }
const PLAYGROUND_FALLBACK = ['#F47676', '#F39271', '#F2B363', '#F0D665', '#F0F36E', '#AAF089',
  '#6DE8A5', '#47CEE1', '#7A9AE6', '#A390EE', '#C386DF', '#F189BE']
const WORDS = { perfect: 'Perfect', good: 'Good', early: 'Early', late: 'Late', missed: 'Miss' }

const scoringColor = (kind) => (COLORS && COLORS.scoring && COLORS.scoring[kind]) || SCORING_FALLBACK[kind] || PAL.cream
const playgroundColor = (pc) => (COLORS && COLORS.playground && COLORS.playground[pc]) || PLAYGROUND_FALLBACK[pc]

function hslHex(h, s, l) {
  const k = (n) => (n + h * 12) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const hx = (v) => Math.round(v * 255).toString(16).padStart(2, '0')
  return '#' + hx(f(0)) + hx(f(8)) + hx(f(4))
}
// vivid hue per pitch class, C = red going round the wheel
const RAINBOW = Array.from({ length: 12 }, (_, pc) => hslHex((pc / 12) * 0.92, 0.92, 0.6))

/* ------------------------------------------------------------ colour utils */
const rgbCache = new Map()
function rgbOf(c) {
  if (c && c[0] === '#') {
    let v = rgbCache.get(c)
    if (!v) {
      let h = c.slice(1)
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
      const n = parseInt(h.slice(0, 6), 16) || 0
      v = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
      rgbCache.set(c, v)
    }
    return v
  }
  const m = typeof c === 'string' ? c.match(/[\d.]+/g) : null
  return m && m.length >= 3 ? [+m[0], +m[1], +m[2]] : [255, 255, 255]
}
function mix(a, b, t) {
  const A = rgbOf(a), B = rgbOf(b)
  return 'rgb(' + Math.round(A[0] + (B[0] - A[0]) * t) + ',' + Math.round(A[1] + (B[1] - A[1]) * t) + ',' +
    Math.round(A[2] + (B[2] - A[2]) * t) + ')'
}
function rgba(c, a) {
  const A = rgbOf(c)
  return 'rgba(' + A[0] + ',' + A[1] + ',' + A[2] + ',' + (a < 0 ? 0 : a > 1 ? 1 : a).toFixed(3) + ')'
}
// Shades of one note colour. Few distinct colours, so cached.
const toneCache = new Map()
function tone(c) {
  let t = toneCache.get(c)
  if (!t) {
    t = {
      base: c,
      deep: mix(c, PAL.bgTop, 0.3),          // flat bars: far end
      lite: mix(c, '#FFFFFF', 0.16),         // flat bars: near end
      hot: mix(c, '#FFFFFF', 0.5),           // flat bars: sounding now
      hotTop: mix(c, '#FFFFFF', 0.12),
      lit: mix(c, '#FFFFFF', 0.3),           // 3D bar top while it sounds
      top: mix(c, PAL.bgTop, 0.14),          // 3D bar top before it sounds: a little dimmer
      side: mix(c, '#000000', 0.48),         // 3D bar front and sides
      sideHot: mix(c, '#000000', 0.2),
      rim: rgba(mix(c, '#FFFFFF', 0.6), 0.6),
      spark: mix(c, '#FFFFFF', 0.45),
      blackKey: mix(c, '#000000', 0.12),
      keyTop: mix(c, '#FFFFFF', 0.12),
      keyLit: mix(c, '#FFFFFF', 0.45),
      keyFront: mix(c, '#000000', 0.3),
      nextW: mix(PAL.white, c, 0.3),         // a key whose note comes next
      nextB: mix(PAL.black, c, 0.42),
      col: rgba(c, 0.2),
      col0: rgba(c, 0)
    }
    toneCache.set(c, t)
  }
  return t
}

function noteColor(n, view) {
  const pc = pcOf(n.pitch)
  if (view === 'RAINBOW') return RAINBOW[pc]
  if (view === 'COLORNOTE') return playgroundColor(pc)
  return n.hand === 'left' ? PAL.left : PAL.right
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

// Soft round light, one small sprite per colour, stretched where it is drawn: much cheaper than
// shadowBlur or a fresh radial gradient every frame.
const glowCache = new Map()
function glowSprite(c) {
  let s = glowCache.get(c)
  if (!s) {
    s = document.createElement('canvas')
    s.width = s.height = 64
    const g = s.getContext('2d')
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    gr.addColorStop(0, rgba(c, 1)); gr.addColorStop(0.3, rgba(c, 0.5)); gr.addColorStop(1, rgba(c, 0))
    g.fillStyle = gr
    g.fillRect(0, 0, 64, 64)
    glowCache.set(c, s)
  }
  return s
}
// expects globalCompositeOperation 'lighter'
function drawGlow(ctx, c, x, y, rx, ry, alpha) {
  if (!(alpha > 0.004) || !(rx > 0) || !(ry > 0)) return
  ctx.globalAlpha = alpha > 1 ? 1 : alpha
  ctx.drawImage(glowSprite(c), x - rx, y - ry, rx * 2, ry * 2)
}

// Shades of the keys that only depend on the palette.
const KT = {}
function keyTones() {
  KT.rootW = mix(PAL.white, PAL.accent, 0.62)
  KT.rootB = mix(PAL.black, PAL.accent, 0.7)
  KT.scaleW = mix(PAL.white, PAL.accent2, 0.14)
  KT.inkLabel = rgba(PAL.ink, 0.36)
  KT.inkLabelC = rgba(PAL.ink, 0.66)
  KT.inkLit = rgba(PAL.ink, 0.75)
  KT.inkBar = rgba(PAL.ink, 0.82)
}
keyTones()

/* --------------------------------------------------------- keyboard layout */
const MAX_KEYS = 49
const IS_BLACK = [false, true, false, true, false, false, true, false, true, false, true, false]
// Black-key centre offset from the white-key boundary it sits on, in white-key widths (real piano spacing).
const BLACK_SHIFT = [0, -0.08, 0, 0.08, 0, 0, -0.1, 0, 0, 0, 0.1, 0]
const WHITE_INDEX = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]
const BLACK_W = 0.58            // black key width, in white-key widths

// The 3D keyboard, in white-key widths. Depth d grows away from the player: d = 0 is the
// keyboard's far edge, where the notes land, and the keys lie at d < 0. Heights z are measured
// from the white key tops, which are level with the note plane.
const M = {
  whiteLen: 3.4,
  blackLen: 2.2,
  blackH: 0.34,           // black key height above the white keys
  blackInset: 0.06,       // the black key's top face is this much narrower at each side...
  blackSlope: 0.14,       // ...and starts this far behind its front (bevelled sides, sloped front)
  whiteFront: 0.24,       // white key front face
  caseFront: 0.16,        // case slab under the keys
  cheek: 0.24,            // case beyond the outer keys
  keyGap: 0.022,          // dark gap at each side of a white key
  corner: 0.12,           // white key front corner radius
  dip: 0.1,               // how far a played key's front goes down
  barWhite: 0.68,         // note bar width in a white key's lane...
  barBlack: 0.44,         // ...and in a black key's
  noteH: 0.14             // note bar thickness
}
const HZ = 0.55     // on-screen height of 1 unit up, relative to 1 unit across: a camera ~57° down
const RHO = 0.36    // lane width at the top of the canvas relative to the now line (perspective strength)
const LOOK = 3.0    // seconds of music between the now line and the top edge
const UMAX = 1.15   // notes are drawn a little beyond the top edge

const keys = []
const G = {
  W: -1, H: -1, ws: NaN, ctx: null, flat: false, dpr: 1, id: 0,
  kbTop: 0, kbH: 0, span: 14, nWhite: 14, ww: 0, farWW: 0, bh: 0, x0: 0,
  bg: null, floor: null, fog: null, fogH: 0, fogFlat: null, lineBand: null, line: null,
  whiteShade: null, blackShade: null, kbShadow: null, beamTop: 0
}
// 3D projection of a point (x across, d deep, z up), with s = k / (k + d):
//   X = cx + x * w0 * s        Y = yV + s * (a - z * w0 * hz)
// A plane seen through a camera with its image plane upright: lines stay lines, lanes meet at
// (cx, yV), and w0 is the size of one white key at the now line (Y = yV + a).
const P = { cx: 0, yV: 0, a: 1, w0: 1, k: 1, hz: HZ, g: 0, df: 0, dbf: 0, dTop: 1, speed: 1, ring: 0.35 }
const X3 = (x, d) => P.cx + (x * P.w0 * P.k) / (P.k + d)
const Y3 = (d, z) => P.yV + (P.k / (P.k + d)) * (P.a - z * P.w0 * P.hz)

// What app.js needs to put things on the keys (hand-tracking badges). keys[i].x / w / cx are the
// key's span along the keyboard's front edge (black keys included, so the row is one straight
// line); farX / farW / farCx the same along the far edge (kbTop), where its notes land.
// keyAt(x, y) is the index of the key at a screen point (along the front edge when y is left out),
// -1 for none; keyX(i) is key i's left x on the front edge.
const GEO = { kbTop: 0, kbH: 0, keyW: 0, keyCount: 0, frontY: 0, keys, keyX: (i) => (keys[i] ? keys[i].x : -1), keyAt }

// How many keys the keyboard on screen has. The next frame lays it out again.
export function setKeyCount(n) {
  if (n === keys.length) return
  keys.length = 0
  for (let i = 0; i < n; i++) {
    keys.push({ i, pitch: 0, pc: 0, black: false, x: 0, w: 0, cx: 0, laneW: 0, farX: 0, farW: 0, farCx: 0, lx0: 0, lx1: 0, lc: 0 })
  }
  GEO.keyCount = n
  G.W = -1
}
setKeyCount(24)

function keyAt(x, y) {
  if (!Number.isFinite(x)) return -1
  const hasY = Number.isFinite(y)
  if (hasY && y < G.kbTop) return -1
  if (G.flat) {
    if (hasY && y <= G.kbTop + G.bh) for (const k of keys) if (k.black && x >= k.x && x < k.x + k.w) return k.i
    for (const k of keys) if (!k.black && x >= k.x && x < k.x + k.w) return k.i
    return -1
  }
  // back onto the key tops: the depth under (x, y), else the front edge (white keys only there)
  let d = P.df
  if (hasY) {
    const s = (y - P.yV) / P.a
    if (!(s > 0)) return -1
    d = Math.max(P.df, P.k / s - P.k)
  }
  const lx = ((x - P.cx) * (P.k + d)) / (P.w0 * P.k) + G.span / 2
  if (hasY && d >= P.dbf) for (const k of keys) if (k.black && lx >= k.lx0 && lx < k.lx1) return k.i
  for (const k of keys) if (!k.black && lx >= k.lx0 && lx < k.lx1) return k.i
  return -1
}

function layout(ctx, W, H, ws, flat, dpr) {
  if (G.W === W && G.H === H && G.ws === ws && G.ctx === ctx && G.flat === flat && G.dpr === dpr) return
  Object.assign(G, { W, H, ws, ctx, flat, dpr })
  G.id++
  beamCache.clear()
  // across, in white-key widths from the keyboard's left end
  let wx = IS_BLACK[pcOf(ws)] ? 0.5 : 0
  let nWhite = 0
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]
    k.pitch = ws + i
    k.pc = pcOf(k.pitch)
    k.black = IS_BLACK[k.pc]
    if (!k.black) { k.lx0 = wx; k.lx1 = wx + 1; wx += 1; nWhite++ }
    else { const c = wx + BLACK_SHIFT[k.pc]; k.lx0 = c - BLACK_W / 2; k.lx1 = c + BLACK_W / 2 }
    k.lc = (k.lx0 + k.lx1) / 2
  }
  G.span = wx + (IS_BLACK[pcOf(ws + keys.length - 1)] ? 0.5 : 0)
  G.nWhite = nWhite
  G.kbH = Math.round(Math.min(Math.max(110, H * 0.225), H * 0.5))
  G.kbTop = H - G.kbH
  if (flat) layoutFlat(ctx, W, H)
  else layout3D(ctx, W, H)
  GEO.kbTop = G.kbTop
  GEO.kbH = G.kbH
}

// Fit the camera to the canvas: the keyboard's front edge spans the width, its far edge is the
// now line at kbTop, and the lanes shrink to RHO of their width by the top edge.
function layout3D(ctx, W, H) {
  const yN = G.kbTop
  const margin = Math.max(8, Math.round(W * 0.01))
  const wf = (W - 2 * margin) / (G.span + 2 * M.cheek)    // one white key, at the front edge
  // a = distance from the vanishing point down to the now line; on a wide, short canvas it is
  // stretched so the outer lanes don't lean over too far
  const a = Math.max(yN / (1 - RHO), ((G.span / 2 + M.cheek) * wf) / 0.9)
  const yV = yN - a
  const mb = Math.max(3, Math.round(G.kbH * 0.03))
  const faces = M.whiteFront + M.caseFront
  // a short, wide canvas: flatten the front faces before the key tops get too short
  const minTop = 0.85 * wf
  let hz = HZ
  if (H - mb - yN - faces * wf * hz < minTop) hz = Math.max(0.2, (H - mb - yN - minTop) / (faces * wf))
  const B = Math.max(6, H - mb - yN - faces * wf * hz)      // now line to the keys' front edge
  const sf = 1 + B / a                                      // front edge size relative to the now line
  const w0 = wf / sf
  // The strip behind the keys is just deep enough for the raised black keys to stay below the
  // now line: solved for its depth g with k = (g + whiteLen) * sf / (sf - 1).
  const c = sf / (sf - 1)
  const ce = Math.min(0.7, (c * (1 + M.blackH * w0 * hz)) / (a + 1))
  const g = (M.whiteLen * ce) / (1 - ce)
  const k = (g + M.whiteLen) * c
  // dTop: the depth seen at the top edge (Y = 0), where LOOK seconds from now arrive
  Object.assign(P, { cx: W / 2, yV, a, w0, k, hz, g, df: -(g + M.whiteLen), dbf: -(g + M.blackLen), dTop: (k * yN) / (a - yN) })
  P.speed = P.dTop / LOOK
  P.ring = a / (k * w0)    // depth foreshortening at the now line: a circle on the plane is this flat
  const h = G.span / 2
  for (const kk of keys) {
    kk.x = X3(kk.lx0 - h, P.df)
    kk.w = (kk.lx1 - kk.lx0) * wf
    kk.cx = kk.x + kk.w / 2
    kk.laneW = (kk.black ? M.barBlack : M.barWhite) * wf
    kk.farX = X3(kk.lx0 - h, 0)
    kk.farW = (kk.lx1 - kk.lx0) * w0
    kk.farCx = kk.farX + kk.farW / 2
  }
  G.ww = wf
  G.farWW = w0
  GEO.keyW = wf
  GEO.frontY = Y3(P.df, 0)

  let gr = ctx.createLinearGradient(0, 0, 0, H)
  gr.addColorStop(0, PAL.bgTop); gr.addColorStop(yN / H, mix(PAL.bgTop, PAL.bgBot, 0.55)); gr.addColorStop(1, PAL.bgBot)
  G.bg = gr
  // the far end of the plane fades into the stage
  G.fogH = Math.round(yN * 0.36)
  gr = ctx.createLinearGradient(0, 0, 0, G.fogH)
  gr.addColorStop(0, rgba(PAL.bgTop, 1)); gr.addColorStop(0.4, rgba(PAL.bgTop, 0.72)); gr.addColorStop(1, rgba(PAL.bgTop, 0))
  G.fog = gr
  gr = ctx.createLinearGradient(0, yN - 24, 0, yN)
  gr.addColorStop(0, rgba(PAL.accentHi, 0)); gr.addColorStop(1, rgba(PAL.accentHi, 0.1))
  G.lineBand = gr
  const x0 = X3(-h, 0), x1 = X3(h, 0)
  gr = ctx.createLinearGradient(x0, 0, x1, 0)
  gr.addColorStop(0, rgba(PAL.accent2, 0.2)); gr.addColorStop(0.5, rgba(mix(PAL.accent2, PAL.cream, 0.6), 0.9)); gr.addColorStop(1, rgba(PAL.accent2, 0.2))
  G.line = gr
  G.beamTop = Y3(P.dTop * 0.55, 0)
}

function layoutFlat(ctx, W, H) {
  const ww = W / G.span, kbTop = G.kbTop
  for (const k of keys) {
    k.x = k.lx0 * ww
    k.w = (k.lx1 - k.lx0) * ww
    k.cx = k.x + k.w / 2
    k.laneW = k.black ? k.w * 0.84 : ww * 0.64
    k.farX = k.x; k.farW = k.w; k.farCx = k.cx
  }
  Object.assign(G, { ww, farWW: ww, bh: Math.round(G.kbH * 0.62), x0: (IS_BLACK[pcOf(G.ws)] ? 0.5 : 0) * ww })
  GEO.keyW = ww
  GEO.frontY = H

  // cached gradients (they only depend on the canvas size)
  let g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, PAL.bgTop); g.addColorStop(1, PAL.bgBot)
  G.bg = g
  // accent glow pooled on the floor of the note field, just above the keys
  g = ctx.createRadialGradient(W / 2, kbTop, 0, W / 2, kbTop, Math.max(W * 0.62, 10))
  g.addColorStop(0, rgba(PAL.accent, 0.16)); g.addColorStop(0.45, rgba(PAL.accent, 0.06)); g.addColorStop(1, rgba(PAL.accent, 0))
  G.floor = g
  g = ctx.createLinearGradient(0, 0, 0, kbTop * 0.18)
  g.addColorStop(0, rgba(PAL.bgTop, 0.95)); g.addColorStop(1, rgba(PAL.bgTop, 0))
  G.fogFlat = g
  g = ctx.createLinearGradient(0, kbTop - 34, 0, kbTop)
  g.addColorStop(0, rgba(PAL.accentHi, 0)); g.addColorStop(1, rgba(PAL.accentHi, 0.16))
  G.lineBand = g
  // the now-line: accent at the edges, near-white in the middle
  g = ctx.createLinearGradient(0, 0, W, 0)
  g.addColorStop(0, rgba(PAL.accent, 0.35)); g.addColorStop(0.5, rgba(mix(PAL.accent2, PAL.cream, 0.6), 0.95)); g.addColorStop(1, rgba(PAL.accent, 0.35))
  G.line = g
  // white keys: in the shadow of the keybed at the top, a little darker at the front
  g = ctx.createLinearGradient(0, kbTop, 0, H)
  g.addColorStop(0, 'rgba(0,0,0,0.2)'); g.addColorStop(0.1, 'rgba(0,0,0,0.04)')
  g.addColorStop(0.75, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.14)')
  G.whiteShade = g
  g = ctx.createLinearGradient(0, kbTop, 0, kbTop + G.bh)
  g.addColorStop(0, 'rgba(255,255,255,0.02)'); g.addColorStop(0.75, 'rgba(255,255,255,0.05)'); g.addColorStop(1, 'rgba(255,255,255,0.10)')
  G.blackShade = g
  g = ctx.createLinearGradient(0, kbTop, 0, kbTop + 12)
  g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)')
  G.kbShadow = g
}

/* ------------------------------------------------------- note-array meta */
const metaCache = new WeakMap()
function notesMeta(notes) {
  let m = metaCache.get(notes)
  if (!m || m.len !== notes.length) {
    let maxDur = 0, sorted = true
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i]
      if (n.dur > maxDur) maxDur = n.dur
      if (i && n.start < notes[i - 1].start) sorted = false
    }
    m = { len: notes.length, maxDur, sorted, fingers: null }
    metaCache.set(notes, m)
  }
  return m
}
function firstIndexFrom(notes, t) {
  let lo = 0, hi = notes.length
  while (lo < hi) { const mid = (lo + hi) >> 1; if (notes[mid].start < t) lo = mid + 1; else hi = mid }
  return lo
}

// Simple fingering heuristic: chords by rank, single notes by a sliding five-finger hand position.
const whiteIdx = (p) => Math.floor(p / 12) * 7 + WHITE_INDEX[pcOf(p)]
function computeFingers(notes) {
  const out = new Map()
  for (const left of [false, true]) {
    const list = notes.filter((n) => (n.hand === 'left') === left).sort((a, b) => a.start - b.start || a.pitch - b.pitch)
    let anchor = null
    for (let i = 0; i < list.length;) {
      let j = i
      while (j < list.length && list[j].start - list[i].start < 0.03) j++
      const m = j - i
      if (m > 1) {
        for (let g = 0; g < m; g++) {
          const rank = left ? m - 1 - g : g
          out.set(list[i + g], m <= 5 ? rank + 1 : 1 + Math.round((rank / (m - 1)) * 4))
        }
        anchor = whiteIdx(list[left ? j - 1 : i].pitch)
      } else {
        const w = whiteIdx(list[i].pitch)
        if (anchor === null) {
          let lo = w, hi = w
          for (let q = i; q < Math.min(list.length, i + 6); q++) { const v = whiteIdx(list[q].pitch); if (v < lo) lo = v; if (v > hi) hi = v }
          anchor = left ? hi : lo
        }
        if (!left) { if (w < anchor) anchor = w; else if (w > anchor + 4) anchor = w - 4; out.set(list[i], w - anchor + 1) }
        else { if (w > anchor) anchor = w; else if (w < anchor - 4) anchor = w + 4; out.set(list[i], anchor - w + 1) }
      }
      i = j
    }
  }
  return out
}

/* ------------------------------------------------------- per-frame state */
const kAct = new Array(MAX_KEYS).fill(null)
const kNext = new Array(MAX_KEYS).fill(null)
const kWait = new Array(MAX_KEYS).fill(null)
const kFb = new Array(MAX_KEYS).fill(null)
const kFbA = new Float32Array(MAX_KEYS)
const kHeld = new Uint8Array(MAX_KEYS)
const kPrevHeld = new Uint8Array(MAX_KEYS)
const kNextBubble = new Float64Array(MAX_KEYS)
// what each key looks like this frame, before the animated overlays (wait pulse, judgement flash)
const kFill = new Array(MAX_KEYS).fill('')
const kLit = new Uint8Array(MAX_KEYS)
const kDown = new Uint8Array(MAX_KEYS)

let lastPos = 0
let burstEpoch = 1
let countingIn = false   // song not started yet: notes at the line are not "sounding"
const clockNow = (s) => (typeof s.now === 'function' ? s.now() : s.now)
const burstDone = new WeakMap()
const seenFeedback = new WeakSet()

// flat view (CLASSIC): u = 0 at the now line, 1 at the top edge
const flatY = (u) => G.kbTop * (1 - u)

/* ------------------------------------------------------------- particles */
const SPARKS = []
for (let i = 0; i < 260; i++) SPARKS.push({ t0: -9, life: 0, x: 0, y: 0, vx: 0, vy: 0, size: 0, color: '#fff', ring: false })
let sparkHead = 0
function nextSpark() { const p = SPARKS[sparkHead]; sparkHead = (sparkHead + 1) % SPARKS.length; return p }
function spawnBurst(x, y, color, hw, t) {
  const tn = tone(color)
  let p = nextSpark()
  p.t0 = t; p.life = 0.45; p.x = x; p.y = y; p.size = hw; p.color = tn.base; p.ring = true
  for (let j = 0; j < 22; j++) {
    p = nextSpark()
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.2
    const sp = 120 + Math.random() * 260
    p.t0 = t; p.life = 0.3 + Math.random() * 0.45
    p.x = x + (Math.random() - 0.5) * hw * 1.4; p.y = y - 1
    p.vx = Math.cos(ang) * sp; p.vy = Math.sin(ang) * sp
    p.size = 1.4 + Math.random() * 1.8
    p.color = j % 3 === 0 ? PAL.accent2 : tn.spark
    p.ring = false
  }
}
function drawSparks(ctx, t) {
  let any = false
  for (let i = 0; i < SPARKS.length; i++) {
    const p = SPARKS[i]
    const age = t - p.t0
    if (age < 0 || age > p.life) continue
    if (!any) { any = true; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round' }
    const k = age / p.life
    if (p.ring) {
      // a ring lying on the plane, so as flat as the plane is foreshortened
      const r = p.size * (0.7 + 1.5 * k)
      ctx.globalAlpha = (1 - k) * 0.75
      ctx.strokeStyle = p.color
      ctx.lineWidth = 0.6 + 2.6 * (1 - k)
      ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * P.ring, 0, 0, Math.PI * 2); ctx.stroke()
    } else {
      const g = 380
      const x = p.x + p.vx * age, y = p.y + p.vy * age + 0.5 * g * age * age
      const vx = p.vx, vy = p.vy + g * age
      ctx.globalAlpha = Math.pow(1 - k, 1.4)
      ctx.strokeStyle = p.color
      ctx.lineWidth = p.size * (1 - 0.5 * k)
      ctx.beginPath(); ctx.moveTo(x - vx * 0.045, y - vy * 0.045); ctx.lineTo(x, y); ctx.stroke()
    }
  }
  if (any) ctx.restore()
}

const BUBBLES = []
for (let i = 0; i < 180; i++) BUBBLES.push({ t0: -99, life: 0, x: 0, y: 0, r: 0, vy: 0, drift: 0, ph: 0, color: '#fff' })
let bubbleHead = 0
function spawnBubble(k, t, big) {
  const b = BUBBLES[bubbleHead]; bubbleHead = (bubbleHead + 1) % BUBBLES.length
  const r = (big ? 0.42 : 0.16 + Math.random() * 0.22) * G.farWW
  b.t0 = t; b.life = 2.6 + Math.random() * 1.6
  b.r = Math.max(6, Math.min(r, 46))
  b.x = k.farCx + (Math.random() - 0.5) * k.farW * 0.9
  b.y = G.kbTop - b.r * 0.6
  b.vy = 60 + Math.random() * 70 + (big ? 10 : 0)
  b.drift = 8 + Math.random() * 22
  b.ph = Math.random() * Math.PI * 2
  b.color = playgroundColor(k.pc)
}
function updateBubbles(s, t) {
  for (let i = 0; i < keys.length; i++) {
    const held = kHeld[i]
    if (held) {
      if (!kPrevHeld[i]) { spawnBubble(keys[i], t, true); kNextBubble[i] = t + 0.14 }
      else {
        let c = 0
        while (t >= kNextBubble[i] && c < 2) { spawnBubble(keys[i], t, false); kNextBubble[i] += 0.13 + Math.random() * 0.1; c++ }
        if (t >= kNextBubble[i]) kNextBubble[i] = t + 0.13
      }
    }
    kPrevHeld[i] = held
  }
}
function drawBubbles(ctx, t) {
  let alive = 0
  for (let i = 0; i < BUBBLES.length; i++) {
    const b = BUBBLES[i]
    const age = t - b.t0
    if (age < 0 || age > b.life) continue
    alive++
    const k = age / b.life
    const y = b.y - b.vy * age - 10 * age * age
    if (y < -b.r * 2) continue
    const x = b.x + b.drift * Math.sin(age * 1.8 + b.ph)
    const r = b.r * (0.55 + 0.45 * Math.min(1, age * 4)) * (1 + 0.15 * k)
    const a = Math.min(1, age * 6) * Math.pow(1 - k, 1.3)
    ctx.globalAlpha = a * 0.8
    ctx.fillStyle = b.color
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
    ctx.globalAlpha = a * 0.85
    ctx.strokeStyle = b.color; ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.globalAlpha = a * 0.35
    ctx.fillStyle = PAL.cream
    ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.38, r * 0.22, 0, Math.PI * 2); ctx.fill()
  }
  ctx.globalAlpha = 1
  return alive
}

// judgement words that float up from a key after a hit / miss
const WORDPOOL = []
for (let i = 0; i < 8; i++) WORDPOOL.push({ t0: -9, x: 0, kind: 'good' })
let wordHead = 0
function spawnWord(x, kind, t) { const w = WORDPOOL[wordHead]; wordHead = (wordHead + 1) % WORDPOOL.length; w.t0 = t; w.x = x; w.kind = kind }
function drawWords(ctx, t) {
  const life = 0.75
  for (const w of WORDPOOL) {
    const age = t - w.t0
    if (age < 0 || age > life) continue
    const k = age / life
    const pop = k < 0.15 ? 0.8 + (k / 0.15) * 0.3 : 1.1 - Math.min(0.1, (k - 0.15) * 0.4)
    ctx.globalAlpha = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4
    ctx.fillStyle = scoringColor(w.kind)
    ctx.font = `700 ${Math.round(14 * pop)}px ${FONT}`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    const x = Math.max(34, Math.min(G.W - 34, w.x))
    ctx.fillText(WORDS[w.kind] || w.kind, x, G.kbTop - 30 - 28 * k)
  }
  ctx.globalAlpha = 1
}

/* ------------------------------------------------------------ shape paths */
const K_ELL = 0.5523
// Flat bars (CLASSIC): rounded rectangle, upright around the bottom centre and sheared along the lane.
function capsulePath(ctx, cT, hT, yt, cB, hB, yb) {
  const len = Math.max(0.5, yb - yt)
  const rT = Math.min(5, len / 2, hT)
  const rB = Math.min(5, len / 2, hB)
  const shear = (cT - cB) / (yt - yb || -1)
  const c = cB
  ctx.save()
  if (shear) ctx.transform(1, 0, shear, 1, -shear * yb, 0)
  ctx.beginPath()
  ctx.moveTo(c - hT, yt + rT)
  ctx.bezierCurveTo(c - hT, yt + rT * (1 - K_ELL), c - hT + rT * (1 - K_ELL), yt, c - hT + rT, yt)
  ctx.lineTo(c + hT - rT, yt)
  ctx.bezierCurveTo(c + hT - rT * (1 - K_ELL), yt, c + hT, yt + rT * (1 - K_ELL), c + hT, yt + rT)
  ctx.lineTo(c + hB, yb - rB)
  ctx.bezierCurveTo(c + hB, yb - rB * (1 - K_ELL), c + hB - rB * (1 - K_ELL), yb, c + hB - rB, yb)
  ctx.lineTo(c - hB + rB, yb)
  ctx.bezierCurveTo(c - hB + rB * (1 - K_ELL), yb, c - hB, yb - rB * (1 - K_ELL), c - hB, yb - rB)
  ctx.closePath()
  ctx.restore()
  return rB
}
// key: flat top, rounded bottom corners
function keyPath(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r); ctx.closePath()
}
function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath(); ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr); ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr); ctx.arcTo(x, y, x + w, y, rr); ctx.closePath()
}
// points in the 3D view
const moveP = (g, x, d, z) => g.moveTo(X3(x, d), Y3(d, z))
const lineP = (g, x, d, z) => g.lineTo(X3(x, d), Y3(d, z))
const curveP = (g, cx, cd, cz, x, d, z) => g.quadraticCurveTo(X3(cx, cd), Y3(cd, cz), X3(x, d), Y3(d, z))
// a strip of the plane (z = 0) between x0..x1 and depths d0..d1
function planeQuad(g, x0, x1, d0, d1) {
  moveP(g, x0, d0, 0); lineP(g, x1, d0, 0); lineP(g, x1, d1, 0); lineP(g, x0, d1, 0); g.closePath()
}

/* ================================================================ scene */
// Blurred, cover-fitted copy of a backdrop image, rebuilt only when the image or
// the size changes (blurring every frame would be far too slow).
let bdCache = { img: null, w: 0, h: 0, canvas: null, ver: 0 }
function backdropFor(img, w, h) {
  if (!img || !img.complete || !img.naturalWidth || !(w > 0) || !(h > 0)) return null
  w = Math.round(w); h = Math.round(h)
  if (bdCache.img === img && bdCache.w === w && bdCache.h === h) return bdCache.canvas
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const g = c.getContext('2d')
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight) * 1.15
  const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale
  g.filter = 'blur(28px) saturate(1.25)'
  g.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh)
  bdCache = { img, w, h, canvas: c, ver: bdCache.ver + 1 }
  return c
}

// drawScene timing, logged once to app.log: the first 120 frames, and the first 120 with a song playing
const PERF = { all: [], play: [] }
function notePerf(list, label, ms, W, H, view) {
  if (list.length >= 120) return
  list.push(ms)
  if (list.length < 120) return
  const sorted = list.slice().sort((a, b) => a - b)
  const avg = list.reduce((a, b) => a + b, 0) / list.length
  console.log(`VIEW drawScene ${label}: avg=${avg.toFixed(2)}ms median=${sorted[60].toFixed(2)}ms p95=${sorted[113].toFixed(2)}ms ` +
    `max=${sorted[119].toFixed(2)}ms over 120 frames, ${Math.round(W)}x${Math.round(H)} @${G.dpr}x, ${view}`)
}

export function drawScene(ctx, W, H, s) {
  if (!ctx || !(W > 0) || !(H > 0) || !s) return GEO
  const t0 = performance.now()
  if (readPalette()) { G.W = -1; toneCache.clear(); glowCache.clear(); keyTones() }
  const ws = Number.isFinite(s.windowStart) ? s.windowStart : 60
  const view = s.view === 'RAINBOW' || s.view === 'COLORNOTE' || s.view === 'CLASSIC' ? s.view : 'CASCADE'
  const notes = Array.isArray(s.notes) ? s.notes : []
  const freeplay = notes.length === 0 && Array.isArray(s.scale)
  const flat = view === 'CLASSIC' && !freeplay
  const m = typeof ctx.getTransform === 'function' ? ctx.getTransform() : null
  const dpr = m && m.a > 0 ? m.a : (typeof window !== 'undefined' && window.devicePixelRatio) || 1
  layout(ctx, W, H, ws, flat, dpr)
  const wall = performance.now() / 1000
  const pos = Number.isFinite(s.position) ? s.position : 0
  if (pos < lastPos - 0.25) burstEpoch++
  lastPos = pos
  const clk = clockNow(s)
  countingIn = Number.isFinite(clk) && s.countInUntil > clk

  ctx.save()
  try {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    prepareKeys(s, view, ws, wall, freeplay, pos)
    const scaleSet = freeplay ? scaleSetOf(s.scale) : null
    const root = freeplay && s.scaleRoot != null ? pcOf(s.scaleRoot) : -1
    const sig = keyStates(freeplay, scaleSet, root)
    if (flat) drawFrameFlat(ctx, s, W, H, view, notes, pos, wall)
    else drawFrame3D(ctx, s, W, H, view, notes, freeplay, pos, wall, sig)
  } finally {
    ctx.restore()
  }
  const ms = performance.now() - t0
  notePerf(PERF.all, 'first frames', ms, W, H, view)
  if (s.playing && !s.waiting && !countingIn && notes.length) notePerf(PERF.play, 'while playing', ms, W, H, view)
  return GEO
}

function prepareKeys(s, view, ws, wall, freeplay, pos) {
  for (let i = 0; i < keys.length; i++) { kAct[i] = null; kNext[i] = null; kWait[i] = null; kFb[i] = null; kFbA[i] = 0; kHeld[i] = 0 }
  const waiting = !!s.waiting
  if (waiting && s.needPitches && typeof s.needPitches[Symbol.iterator] === 'function') {
    for (const p of s.needPitches) {
      const i = p - ws
      if (i < 0 || i >= keys.length) continue
      let c = null
      if (Array.isArray(s.waitNotes)) for (const n of s.waitNotes) if (n.pitch === p) { c = noteColor(n, view); break }
      kWait[i] = c || noteColor({ pitch: p, hand: p < 60 ? 'left' : 'right' }, view)
    }
  }
  if (Array.isArray(s.activeNotes)) {
    for (const n of s.activeNotes) {
      const i = n.pitch - ws
      if (i < 0 || i >= keys.length || kWait[i]) continue
      if (countingIn) { kNext[i] = noteColor(n, view); continue }
      kAct[i] = noteColor(n, view)
      // spark burst when a note reaches the line
      if (s.playing && !waiting && pos - n.start < 0.2 && pos >= n.start - 0.02 && burstDone.get(n) !== burstEpoch) {
        burstDone.set(n, burstEpoch)
        if (view !== 'CLASSIC') spawnBurst(keys[i].farCx, G.kbTop, kAct[i], ((keys[i].black ? M.barBlack : M.barWhite) * G.farWW) / 2, wall)
      }
    }
  }
  if (Array.isArray(s.upcomingNotes)) {
    for (const n of s.upcomingNotes) {
      const i = n.pitch - ws
      if (i >= 0 && i < keys.length && !kAct[i] && !kNext[i]) kNext[i] = noteColor(n, view)
    }
  }
  if (s.held && typeof s.held[Symbol.iterator] === 'function') {
    for (const p of s.held) { const i = p - ws; if (i >= 0 && i < keys.length) kHeld[i] = 1 }
  }
  const fb = s.feedback
  if (fb && typeof fb.forEach === 'function') {
    const now = wall * 1000
    for (let i = 0; i < keys.length; i++) {
      const e = fb.get(ws + i)
      if (!e || !(e.until > now)) continue
      kFb[i] = scoringColor(e.kind)
      kFbA[i] = clamp01((e.until - now) / 220)
      if (!seenFeedback.has(e)) { seenFeedback.add(e); spawnWord(keys[i].farCx, e.kind, wall) }
    }
  }
}

let scaleKey = '', scaleSetCache = null
function scaleSetOf(scale) {
  if (!Array.isArray(scale)) return null
  const key = scale.join(',')
  if (key !== scaleKey) { scaleKey = key; scaleSetCache = new Set(scale.map(pcOf)) }
  return scaleSetCache
}
// Each key's fill, lit and pressed state for this frame; returns a signature of them all, which
// tells the cached keyboard layer when to redraw.
function keyStates(freeplay, scaleSet, root) {
  let sig = ''
  for (const k of keys) {
    const i = k.i
    let c = k.black ? PAL.black : PAL.white
    let lit = 0, down = 0
    if (freeplay && scaleSet) {
      if (k.pc === root) c = k.black ? KT.rootB : KT.rootW
      else if (scaleSet.has(k.pc)) c = k.black ? PAL.blackScale : KT.scaleW
      else c = k.black ? PAL.black : PAL.whiteOff
    }
    if (freeplay && kHeld[i]) { c = playgroundColor(k.pc); lit = 1; down = 1 }
    else if (kAct[i]) { c = k.black ? tone(kAct[i]).blackKey : kAct[i]; lit = 1; down = 1 }
    else {
      if (kNext[i]) c = k.black ? tone(kNext[i]).nextB : tone(kNext[i]).nextW
      if (kHeld[i]) { c = mix(c, PAL.accentHi, k.black ? 0.3 : 0.24); down = 1 }
    }
    kFill[i] = c
    kLit[i] = lit
    kDown[i] = down
    sig += c
    sig += lit ? '*' : down ? 'v' : ','
  }
  return sig
}

/* ============================================================ 3D frame */
function drawFrame3D(ctx, s, W, H, view, notes, freeplay, pos, wall, sig) {
  const pulse = 0.5 + 0.5 * Math.sin(wall * Math.PI * 2 * 1.3)
  ctx.drawImage(fieldLayer(s), 0, 0, W, H)
  if (!freeplay) drawBeatLines(ctx, s.tempo, pos)
  drawBeams(ctx, freeplay)
  if (freeplay) {
    updateBubbles(s, wall)
    const alive = drawBubbles(ctx, wall)
    if (!alive && !s.chordName) {
      ctx.fillStyle = rgba(PAL.accent2, 0.4)
      ctx.font = `500 15px ${FONT}`
      ctx.fillText('Play anything — the keys are yours', W / 2, G.kbTop * 0.45)
    }
  } else {
    for (let i = 0; i < keys.length; i++) kPrevHeld[i] = kHeld[i]
    drawHotSpots3D(ctx)
    drawNotes3D(ctx, s, notes, view, pos, pulse)
  }
  ctx.fillStyle = G.fog
  ctx.fillRect(0, 0, W, G.fogH)
  if (freeplay) drawChordName(ctx, s, W, wall)
  if (!freeplay) drawLoopMarkers3D(ctx, s, pos)
  drawNowLine3D(ctx)
  const kb = keyboardLayer(sig)
  ctx.drawImage(kb.canvas, 0, kb.top, W, H - kb.top)
  drawKeyOverlays3D(ctx, pulse)
  drawKeyGlows3D(ctx, pulse)
  drawSparks(ctx, wall)
  drawWords(ctx, wall)
  drawHud(ctx, s, wall)
}

// Playground: the chord you hold (s.chordName), large and upright above the keys. It pops
// in when it changes and fades out with s.chordAlpha once you let go.
let chordShown = '', chordSince = 0
function drawChordName(ctx, s, W, wall) {
  const name = typeof s.chordName === 'string' ? s.chordName : ''
  if (name !== chordShown) { chordShown = name; chordSince = wall }
  const a = clamp01(s.chordAlpha == null ? 1 : s.chordAlpha)
  if (!name || !(a > 0)) return
  const k = clamp01((wall - chordSince) / 0.2)
  const pop = 0.9 + 0.1 * (1 - Math.pow(1 - k, 3))
  // a chord or note name is big; an interval ("perfect fifth") smaller; never wider than the stage
  const symbol = /^[A-G]/.test(name)
  let size = Math.min(symbol ? 112 : 56, G.kbTop * (symbol ? 0.26 : 0.14))
  ctx.font = `700 ${Math.round(size)}px ${FONT}`
  const tw = ctx.measureText(name).width
  if (tw > W * 0.8) { size *= (W * 0.8) / tw; ctx.font = `700 ${Math.round(size)}px ${FONT}` }
  ctx.save()
  ctx.translate(W / 2, G.kbTop * 0.4)
  ctx.scale(pop, pop)
  ctx.globalAlpha = a
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.shadowColor = rgba(PAL.bed, 0.7)
  ctx.shadowBlur = size * 0.35
  ctx.fillStyle = PAL.cream
  ctx.fillText(name, 0, 0)
  ctx.restore()
}

// The stage behind the notes: background, an imported song's cover, the plane and its lanes.
const FIELD = { canvas: null, key: '' }
function fieldLayer(s) {
  const bd = backdropFor(s.backdrop, G.W, G.kbTop)
  const key = G.id + ':' + (bd ? bdCache.ver : 0)
  if (FIELD.key === key && FIELD.canvas) return FIELD.canvas
  const c = FIELD.canvas || (FIELD.canvas = document.createElement('canvas'))
  const cw = Math.max(1, Math.round(G.W * G.dpr)), ch = Math.max(1, Math.round(G.H * G.dpr))
  if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch }
  const g = c.getContext('2d')
  g.setTransform(G.dpr, 0, 0, G.dpr, 0, 0)
  g.clearRect(0, 0, G.W, G.H)
  renderField(g, bd)
  FIELD.key = key
  return c
}

function renderField(g, bd) {
  const W = G.W, H = G.H, yN = G.kbTop
  g.fillStyle = G.bg
  g.fillRect(0, 0, W, H)
  if (bd) {
    // an imported song's cover, blurred; a solid dark tint keeps any cover, even a white one, behind the notes
    g.drawImage(bd, 0, 0, W, yN)
    g.fillStyle = rgba(PAL.bgTop, 0.8)
    g.fillRect(0, 0, W, yN)
  }
  const h = G.span / 2
  const dEnd = P.dTop * 1.25
  // light pooled on the floor in front of the keys, flattened like the plane
  g.save()
  g.translate(W / 2, yN)
  g.scale(1, 0.42)
  let gr = g.createRadialGradient(0, 0, 0, 0, 0, W * 0.55)
  gr.addColorStop(0, rgba(PAL.accent, 0.2)); gr.addColorStop(0.5, rgba(PAL.accent, 0.06)); gr.addColorStop(1, rgba(PAL.accent, 0))
  g.fillStyle = gr
  g.fillRect(-W * 0.6, -W * 0.6, W * 1.2, W * 0.6)
  g.restore()
  // the plane under the notes: a faint lift that fades into the distance
  g.beginPath()
  planeQuad(g, -h, h, 0, dEnd)
  gr = g.createLinearGradient(0, yN, 0, 0)
  gr.addColorStop(0, rgba(PAL.cream, 0.05)); gr.addColorStop(0.6, rgba(PAL.cream, 0.02)); gr.addColorStop(1, rgba(PAL.cream, 0))
  g.fillStyle = gr
  g.fill()
  // black-key lanes a shade darker
  g.beginPath()
  for (const k of keys) if (k.black) planeQuad(g, k.lx0 - h, k.lx1 - h, 0, dEnd)
  g.fillStyle = 'rgba(0,0,0,0.13)'
  g.fill()
  // lane lines between white keys; between octaves (before each C) and at the ends a little stronger
  const yEnd = Y3(dEnd, 0)
  g.lineWidth = 1
  g.beginPath()
  for (const k of keys) {
    if (k.black || k.pc === 0 || k.i === 0) continue
    const x = k.lx0 - h
    g.moveTo(X3(x, 0), yN); g.lineTo(X3(x, dEnd), yEnd)
  }
  g.strokeStyle = rgba(PAL.cream, 0.07)
  g.stroke()
  g.beginPath()
  for (const k of keys) {
    if (k.black || k.pc !== 0 || k.i === 0) continue
    const x = k.lx0 - h
    g.moveTo(X3(x, 0), yN); g.lineTo(X3(x, dEnd), yEnd)
  }
  for (const x of [-h, h]) { g.moveTo(X3(x, 0), yN); g.lineTo(X3(x, dEnd), yEnd) }
  g.strokeStyle = rgba(PAL.accent2, 0.17)
  g.stroke()
  // darker at the sides
  gr = g.createRadialGradient(W / 2, yN * 0.55, Math.min(W, H) * 0.25, W / 2, yN * 0.55, Math.max(W, H) * 0.75)
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.32)')
  g.fillStyle = gr
  g.fillRect(0, 0, W, yN)
}

// soft lines across the plane on every beat, moving with the music
function drawBeatLines(ctx, tempo, pos) {
  const beat = 60 / (tempo > 0 ? tempo : 120)
  if (!(beat > 0.08)) return
  const dEnd = P.dTop * UMAX
  const tEnd = pos + dEnd / P.speed
  const h = G.span / 2
  ctx.beginPath()
  let n = 0
  for (let t = Math.floor(pos / beat + 1) * beat; t < tEnd && n < 48; t += beat, n++) {
    const d = (t - pos) * P.speed
    const y = Y3(d, 0)
    ctx.moveTo(X3(-h, d), y); ctx.lineTo(X3(h, d), y)
  }
  ctx.strokeStyle = rgba(PAL.cream, 0.075)
  ctx.lineWidth = 1
  ctx.stroke()
}

// light thrown up the lane of a sounding (or, in free play, held) key
const beamCache = new Map()
function drawBeams(ctx, freeplay) {
  const h = G.span / 2, dEnd = P.dTop * 0.55
  for (const k of keys) {
    const c = kAct[k.i] || kWait[k.i] || (freeplay && kHeld[k.i] ? playgroundColor(k.pc) : null)
    if (!c) continue
    let gr = beamCache.get(c)
    if (!gr) {
      gr = ctx.createLinearGradient(0, G.kbTop, 0, G.beamTop)
      gr.addColorStop(0, rgba(c, 0.24)); gr.addColorStop(1, rgba(c, 0))
      beamCache.set(c, gr)
    }
    ctx.beginPath()
    planeQuad(ctx, k.lx0 - h, k.lx1 - h, 0, dEnd)
    ctx.fillStyle = gr
    ctx.fill()
  }
}

// light pooled where sounding notes meet the line (under the bars, so labels stay legible)
function drawHotSpots3D(ctx) {
  let on = false
  for (const k of keys) {
    const c = kAct[k.i]
    if (!c) continue
    if (!on) { on = true; ctx.globalCompositeOperation = 'lighter' }
    const r = k.farW * 1.5
    drawGlow(ctx, c, k.farCx, G.kbTop, r, r * 0.55, 0.55)
  }
  if (on) { ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1 }
}

function drawNowLine3D(ctx) {
  const h = G.span / 2, y = G.kbTop
  const x0 = X3(-h, 0), x1 = X3(h, 0)
  ctx.fillStyle = G.lineBand
  ctx.fillRect(x0, y - 24, x1 - x0, 24)
  ctx.fillStyle = G.line
  ctx.fillRect(x0, y - 1.5, x1 - x0, 2)
}

/* -------------------------------------------------------------- 3D notes */
const fontCache = new Map()
function barFont(fs) {
  const q = Math.round(fs * 2) / 2
  let f = fontCache.get(q)
  if (!f) { f = `700 ${q}px ${FONT}`; fontCache.set(q, f) }
  return f
}

function drawNotes3D(ctx, s, notes, view, pos, pulse) {
  if (!notes.length) return
  const meta = notesMeta(notes)
  const ws = G.ws
  let labels = s.noteLabels === 'names' || s.noteLabels === 'fingers' ? s.noteLabels : null
  if (view === 'COLORNOTE' && labels !== 'fingers') labels = 'names'
  if (labels === 'fingers' && !meta.fingers) meta.fingers = notes.some((n) => !n.finger) ? computeFingers(notes) : new Map()
  const waiting = !!s.waiting
  const waitList = waiting && Array.isArray(s.waitNotes) ? s.waitNotes : null
  const handOnly = s.handFilter === 'left' || s.handFilter === 'right' ? s.handFilter : null
  const tMax = pos + (P.dTop * UMAX) / P.speed
  const lo = meta.sorted ? firstIndexFrom(notes, pos - meta.maxDur - 0.05) : 0
  const hi = meta.sorted ? firstIndexFrom(notes, tMax) : notes.length
  // far to near, white-key lanes first so black-key bars sit on top where they touch
  for (let pass = 0; pass < 2; pass++) {
    for (let i = hi - 1; i >= lo; i--) {
      const n = notes[i]
      if (n.start >= tMax || n.start + n.dur <= pos) continue
      const k = keys[n.pitch - ws]
      if (!k || k.black !== (pass === 1)) continue
      if (waitList && waitList.indexOf(n) >= 0) continue
      const dim = handOnly && n.hand !== handOnly
      drawNote3D(ctx, n, k, pos, view, labels, meta, dim ? 0.38 : 1, 0)
    }
  }
  if (waiting) {
    ctx.fillStyle = rgba(PAL.bed, 0.5)
    ctx.fillRect(0, 0, G.W, G.kbTop)
    if (waitList) {
      for (let pass = 0; pass < 2; pass++) {
        for (const n of waitList) {
          const k = keys[n.pitch - ws]
          if (!k || k.black !== (pass === 1)) continue
          drawNote3D(ctx, n, k, pos, view, labels, meta, 1, 0.35 + 0.65 * pulse)
        }
      }
    }
  }
}

// A rounded rectangle lying on the plane at height z (corner radius rc), projected. dy moves it down
// the screen: the outline dropped by the bar's thickness draws its front and sides.
function notePath(ctx, xl, xr, d0, d1, z, rc, dy) {
  const k = P.k, w0 = P.w0, cx = P.cx, yV = P.yV, az = P.a - z * P.w0 * P.hz
  const s0 = k / (k + d0), sa = k / (k + d0 + rc), sb = k / (k + d1 - rc), s1 = k / (k + d1)
  const y0 = yV + s0 * az + dy, ya = yV + sa * az + dy, yb = yV + sb * az + dy, y1 = yV + s1 * az + dy
  const xlr = xl + rc, xrr = xr - rc
  ctx.moveTo(cx + xl * w0 * sa, ya)
  ctx.quadraticCurveTo(cx + xl * w0 * s0, y0, cx + xlr * w0 * s0, y0)
  ctx.lineTo(cx + xrr * w0 * s0, y0)
  ctx.quadraticCurveTo(cx + xr * w0 * s0, y0, cx + xr * w0 * sa, ya)
  ctx.lineTo(cx + xr * w0 * sb, yb)
  ctx.quadraticCurveTo(cx + xr * w0 * s1, y1, cx + xrr * w0 * s1, y1)
  ctx.lineTo(cx + xlr * w0 * s1, y1)
  ctx.quadraticCurveTo(cx + xl * w0 * s1, y1, cx + xl * w0 * sb, yb)
  ctx.closePath()
}

function drawNote3D(ctx, n, k, pos, view, labels, meta, alpha, waitPulse) {
  const gap = Math.min(0.08, n.dur * 0.2)
  const t0 = n.start - pos
  const t1 = n.start + n.dur - gap - pos
  if (t1 <= 0) return
  const dMax = P.dTop * UMAX
  const d0 = t0 > 0 ? t0 * P.speed : 0
  if (d0 >= dMax) return
  const half = (k.black ? M.barBlack : M.barWhite) / 2
  let d1 = Math.min(dMax, t1 * P.speed)
  if (t0 > 0 && d1 - d0 < half * 2.2) d1 = d0 + half * 2.2    // very short notes still read as bars
  if (d1 - d0 < 0.02) return
  const rc = Math.min(half * 0.55, (d1 - d0) * 0.45)
  const xc = k.lc - G.span / 2, xl = xc - half, xr = xc + half
  const active = t0 <= 0.001 && !countingIn && !waitPulse
  const color = noteColor(n, view)
  const tn = tone(color)
  const s0 = P.k / (P.k + d0)
  const th = M.noteH * P.w0 * s0 * P.hz
  const yTop0 = Y3(d0, M.noteH), yTop1 = Y3(d1, M.noteH)

  if (active || waitPulse) {
    // glow around the bar, stretched along its lane
    const xa = P.cx + xc * P.w0 * s0, xb = X3(xc, d1)
    const dx = xb - xa, dy = yTop1 - yTop0
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.translate((xa + xb) / 2, (yTop0 + yTop1 + th) / 2)
    ctx.rotate(Math.atan2(dy, dx) + Math.PI / 2)
    drawGlow(ctx, color, 0, 0, half * P.w0 * s0 + 16, Math.hypot(dx, dy) / 2 + 16, (active ? 0.5 : 0.18 + 0.32 * waitPulse) * alpha)
    ctx.restore()
  }
  ctx.globalAlpha = alpha
  ctx.beginPath()
  notePath(ctx, xl, xr, d0, d1, M.noteH, rc, th)
  ctx.fillStyle = active ? tn.sideHot : tn.side
  ctx.fill()
  ctx.beginPath()
  notePath(ctx, xl, xr, d0, d1, M.noteH, rc, 0)
  ctx.fillStyle = active ? tn.lit : waitPulse ? mix(color, '#FFFFFF', 0.12 + 0.34 * waitPulse) : tn.top
  ctx.fill()
  ctx.strokeStyle = tn.rim
  ctx.lineWidth = active ? 1.5 : 1
  ctx.stroke()
  ctx.globalAlpha = 1

  if (labels && alpha > 0.5) {
    const halfPx = half * P.w0 * s0
    const fs = Math.max(8, Math.min(14, halfPx * 0.62))
    const len = yTop0 - yTop1
    if (len < fs * 1.5 || halfPx * 2 < fs * 1.1) return
    const ty = yTop0 - Math.max(fs * 0.95, rc * P.w0 * s0 * P.ring + fs * 0.55)
    if (ty - fs * 0.5 < yTop1 + 2) return
    // the lane's centre line at that height
    const xa = P.cx + xc * P.w0 * s0, xb = X3(xc, d1)
    const text = labels === 'fingers' ? String(n.finger || (meta.fingers && meta.fingers.get(n)) || 1) : BAR_NAMES[k.pc]
    ctx.font = barFont(fs)
    ctx.fillStyle = KT.inkBar
    ctx.fillText(text, xa + (xb - xa) * ((yTop0 - ty) / len), ty)
  }
}

function drawLoopMarkers3D(ctx, s, pos) {
  const lp = s.loop
  if (!lp || !lp.on || !Number.isFinite(lp.a) || !Number.isFinite(lp.b)) return
  const h = G.span / 2
  ctx.setLineDash(LANE_DASH)
  ctx.lineWidth = 1.5
  ctx.font = `600 10px ${FONT}`
  for (let j = 0; j < 2; j++) {
    const t = j ? lp.b : lp.a
    const d = (t - pos) * P.speed
    if (d <= 0 || d > P.dTop) continue
    const y = Y3(d, 0)
    const xa = X3(-h, d), xb = X3(h, d)
    ctx.strokeStyle = rgba(PAL.accent2, 0.5)
    ctx.beginPath(); ctx.moveTo(xa, y); ctx.lineTo(xb, y); ctx.stroke()
    ctx.fillStyle = rgba(PAL.ink, 0.9)
    const lx = Math.max(4, xa - 26)
    roundRect(ctx, lx, y - 9, 20, 18, 9); ctx.fill()
    ctx.strokeStyle = rgba(PAL.accentHi, 0.6); ctx.setLineDash(NO_DASH); ctx.lineWidth = 1; ctx.stroke()
    ctx.setLineDash(LANE_DASH); ctx.lineWidth = 1.5
    ctx.fillStyle = PAL.accent2
    ctx.fillText(j ? 'B' : 'A', lx + 10, y + 0.5)
  }
  ctx.setLineDash(NO_DASH)
}

/* ----------------------------------------------------------- 3D keyboard */
// The keyboard in its current lit state, drawn once into its own layer and reused until a key
// changes (a note starts or ends, a key goes down or up).
const KB = { canvas: null, key: '', top: 0 }
function keyboardLayer(sig) {
  const fonts = typeof document !== 'undefined' && document.fonts ? document.fonts.status : ''
  const key = G.id + ':' + fonts + ':' + sig
  if (KB.key === key && KB.canvas) return KB
  const top = Math.floor(G.kbTop - 2)
  const c = KB.canvas || (KB.canvas = document.createElement('canvas'))
  const cw = Math.max(1, Math.round(G.W * G.dpr)), ch = Math.max(1, Math.round((G.H - top) * G.dpr))
  if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch }
  const g = c.getContext('2d')
  g.setTransform(G.dpr, 0, 0, G.dpr, 0, -top * G.dpr)
  g.clearRect(0, top, G.W, G.H - top)
  g.textAlign = 'center'; g.textBaseline = 'middle'
  drawKeyboard3D(g)
  KB.key = key
  KB.top = top
  return KB
}

function drawKeyboard3D(g) {
  const h = G.span / 2, L = -h - M.cheek, R = h + M.cheek, df = P.df
  // the case: its top behind and beside the keys, then its front face under them
  g.beginPath()
  planeQuad(g, L, R, 0, df)
  g.fillStyle = PAL.bed
  g.fill()
  const xl = X3(L, df), xr = X3(R, df), y0 = Y3(df, 0), y1 = Y3(df, -(M.whiteFront + M.caseFront))
  let gr = g.createLinearGradient(0, y0, 0, y1)
  gr.addColorStop(0, mix(PAL.bed, '#FFFFFF', 0.12)); gr.addColorStop(0.4, mix(PAL.bed, '#FFFFFF', 0.05)); gr.addColorStop(1, PAL.bed)
  g.fillStyle = gr
  keyPath(g, xl, y0, xr - xl, y1 - y0, Math.min(8, (y1 - y0) * 0.5))
  g.fill()
  // its front edge catches the light
  g.fillStyle = 'rgba(255,255,255,0.16)'
  g.fillRect(xl + 4, y0, xr - xl - 8, 1)
  // the strip behind the keys, in the keys' shadow
  gr = g.createLinearGradient(0, G.kbTop, 0, Y3(-P.g, 0))
  gr.addColorStop(0, 'rgba(255,255,255,0.05)'); gr.addColorStop(1, 'rgba(0,0,0,0.3)')
  g.beginPath()
  planeQuad(g, L, R, 0, -P.g)
  g.fillStyle = gr
  g.fill()

  for (const k of keys) if (!k.black) drawWhiteKey(g, k, kFill[k.i], kLit[k.i], kDown[k.i])
  for (const k of keys) if (k.black) drawBlackShadow(g, k)
  for (const k of keys) if (k.black) drawBlackKey(g, k, kFill[k.i], kLit[k.i], kDown[k.i])
  for (const k of keys) if (!k.black) drawWhiteLabel(g, k, false)
  // lit keys glow a little into their neighbours
  g.globalCompositeOperation = 'lighter'
  for (const k of keys) {
    if (!kLit[k.i]) continue
    const d = (df + -P.g) / 2
    drawGlow(g, kFill[k.i], X3(k.lc - h, d), Y3(d, 0), k.w * 0.9, (Y3(df, 0) - G.kbTop) * 0.6, 0.35)
  }
  g.globalCompositeOperation = 'source-over'
  g.globalAlpha = 1
}

// the name at the front of a white key, the Cs with their octave
function drawWhiteLabel(g, k, flashed) {
  const isC = k.pc === 0, d = P.df + 0.5
  const fs = Math.max(9, Math.min(12, G.ww * 0.13))
  g.font = `${isC ? 700 : 500} ${fs}px ${FONT}`
  g.fillStyle = kLit[k.i] || flashed ? KT.inkLit : isC ? KT.inkLabelC : KT.inkLabel
  g.fillText(isC ? noteName(k.pitch) : NOTE_NAMES[k.pc], X3(k.lc - G.span / 2, d), Y3(d, kDown[k.i] ? -M.dip * 0.85 : 0))
}

// white key top: full width at the back, rounded corners at the front
function whiteTopPath(g, k, down) {
  const h = G.span / 2, x0 = k.lx0 - h + M.keyGap, x1 = k.lx1 - h - M.keyGap
  const db = -P.g, df = P.df, r = M.corner, zf = down ? -M.dip : 0
  moveP(g, x0, db, 0)
  lineP(g, x1, db, 0)
  lineP(g, x1, df + r, zf)
  curveP(g, x1, df, zf, x1 - r, df, zf)
  lineP(g, x0 + r, df, zf)
  curveP(g, x0, df, zf, x0, df + r, zf)
  g.closePath()
}
// white key front: the rounded front outline, extruded down
function whiteFrontPath(g, k, down) {
  const h = G.span / 2, x0 = k.lx0 - h + M.keyGap, x1 = k.lx1 - h - M.keyGap
  const df = P.df, r = M.corner, z0 = down ? -M.dip : 0, z1 = z0 - M.whiteFront
  moveP(g, x0, df + r, z0)
  curveP(g, x0, df, z0, x0 + r, df, z0)
  lineP(g, x1 - r, df, z0)
  curveP(g, x1, df, z0, x1, df + r, z0)
  lineP(g, x1, df + r, z1)
  curveP(g, x1, df, z1, x1 - r, df, z1)
  lineP(g, x0 + r, df, z1)
  curveP(g, x0, df, z1, x0, df + r, z1)
  g.closePath()
}

function drawWhiteKey(g, k, fill, lit, down) {
  const df = P.df, yb = Y3(-P.g, 0), yf = Y3(df, down ? -M.dip : 0)
  g.beginPath()
  whiteFrontPath(g, k, down)
  let gr = g.createLinearGradient(0, yf, 0, Y3(df, -M.whiteFront))
  if (lit) { const tn = tone(fill); gr.addColorStop(0, tn.base); gr.addColorStop(1, tn.keyFront) }
  else { gr.addColorStop(0, mix(fill, '#000000', 0.22)); gr.addColorStop(1, mix(fill, '#000000', 0.42)) }
  g.fillStyle = gr
  g.fill()
  g.beginPath()
  whiteTopPath(g, k, down)
  gr = g.createLinearGradient(0, yb, 0, yf)
  if (lit) {
    const tn = tone(fill)
    gr.addColorStop(0, tn.keyTop); gr.addColorStop(1, tn.keyLit)
  } else {
    // a little darker under the fallboard, a soft sheen towards the front
    gr.addColorStop(0, mix(fill, '#000000', 0.16)); gr.addColorStop(0.3, fill)
    gr.addColorStop(0.82, mix(fill, '#FFFFFF', 0.22)); gr.addColorStop(1, mix(fill, '#FFFFFF', 0.12))
  }
  g.fillStyle = gr
  g.fill()
  // the rounded front edge catches the light
  const h = G.span / 2, x0 = k.lx0 - h + M.keyGap + M.corner, x1 = k.lx1 - h - M.keyGap - M.corner
  g.fillStyle = lit ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.6)'
  g.fillRect(X3(x0, df), yf - 1, X3(x1, df) - X3(x0, df), 1)
}

// a black key standing on the white keys darkens them around its foot (cache only: shadowBlur is slow)
function drawBlackShadow(g, k) {
  const h = G.span / 2, c = k.lc - h, hw = BLACK_W / 2
  g.save()
  g.shadowColor = 'rgba(0,0,0,0.55)'
  g.shadowBlur = Math.max(2, G.farWW * 0.1) * G.dpr      // shadow sizes ignore the canvas transform
  g.shadowOffsetY = Math.max(1, G.farWW * 0.03) * G.dpr
  g.beginPath()
  planeQuad(g, c - hw - 0.02, c + hw + 0.02, -P.g, P.dbf - 0.04)
  g.fillStyle = 'rgba(0,0,0,0.5)'
  g.fill()
  g.restore()
}

// corners of a black key, projected: base (z = 0) and the narrower, raised top
const BK = new Float64Array(16)
function blackCorners(k, down) {
  const h = G.span / 2, c = k.lc - h, hw = BLACK_W / 2, ti = M.blackInset
  const db = -P.g, df = P.dbf, dt = df + M.blackSlope
  const zb = M.blackH, zf = down ? M.blackH - M.dip * 0.8 : M.blackH
  const pts = [
    [c - hw, df, 0], [c + hw, df, 0], [c + hw, db, 0], [c - hw, db, 0],          // base: fl fr br bl
    [c - hw + ti, dt, zf], [c + hw - ti, dt, zf], [c + hw - ti, db, zb], [c - hw + ti, db, zb] // top
  ]
  for (let i = 0; i < 8; i++) { BK[i * 2] = X3(pts[i][0], pts[i][1]); BK[i * 2 + 1] = Y3(pts[i][1], pts[i][2]) }
  return BK
}
// faces as corner indices, counter-clockwise seen from outside; on screen a face we can see
// winds the same way as the top face
const BK_FACES = { top: [4, 5, 6, 7], front: [0, 1, 5, 4], right: [1, 2, 6, 5], left: [3, 0, 4, 7] }
function facePath(g, f) {
  g.beginPath()
  g.moveTo(BK[f[0] * 2], BK[f[0] * 2 + 1])
  for (let j = 1; j < 4; j++) g.lineTo(BK[f[j] * 2], BK[f[j] * 2 + 1])
  g.closePath()
}
function faceVisible(f) {
  let a = 0
  for (let j = 0; j < 4; j++) {
    const p = f[j], q = f[(j + 1) % 4]
    a += BK[p * 2] * BK[q * 2 + 1] - BK[q * 2] * BK[p * 2 + 1]
  }
  return a < 0
}

function drawBlackKey(g, k, fill, lit, down) {
  blackCorners(k, down)
  const F = BK_FACES
  // dark underlay, so no seams show between the faces
  g.beginPath()
  for (const f of [F.front, F.top]) {
    g.moveTo(BK[f[0] * 2], BK[f[0] * 2 + 1])
    for (let j = 1; j < 4; j++) g.lineTo(BK[f[j] * 2], BK[f[j] * 2 + 1])
    g.closePath()
  }
  g.fillStyle = mix(fill, '#000000', 0.5)
  g.fill()
  const side = mix(fill, '#000000', lit ? 0.3 : 0.25)
  for (const f of [F.left, F.right]) {
    if (!faceVisible(f)) continue
    facePath(g, f)
    g.fillStyle = side
    g.fill()
  }
  facePath(g, F.front)
  g.fillStyle = mix(fill, '#000000', lit ? 0.32 : 0.42)
  g.fill()
  facePath(g, F.top)
  const gr = g.createLinearGradient(0, BK[7 * 2 + 1], 0, BK[4 * 2 + 1])
  if (lit) { gr.addColorStop(0, fill); gr.addColorStop(1, mix(fill, '#FFFFFF', 0.3)) }
  else { gr.addColorStop(0, mix(fill, '#FFFFFF', 0.03)); gr.addColorStop(1, mix(fill, '#FFFFFF', 0.13)) }
  g.fillStyle = gr
  g.fill()
  // the gloss: a soft reflection along the key, a little left of its middle
  const lx = (a, b, t) => BK[a * 2] + (BK[b * 2] - BK[a * 2]) * t
  const ly = (a, b, t) => BK[a * 2 + 1] + (BK[b * 2 + 1] - BK[a * 2 + 1]) * t
  g.beginPath()
  g.moveTo(lx(4, 5, 0.2), ly(4, 5, 0.2)); g.lineTo(lx(4, 5, 0.45), ly(4, 5, 0.45))
  g.lineTo(lx(7, 6, 0.45), ly(7, 6, 0.45)); g.lineTo(lx(7, 6, 0.2), ly(7, 6, 0.2))
  g.closePath()
  g.fillStyle = lit ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)'
  g.fill()
  // highlight along the top face's front and sides
  g.beginPath()
  g.moveTo(BK[7 * 2], BK[7 * 2 + 1]); g.lineTo(BK[4 * 2], BK[4 * 2 + 1]); g.lineTo(BK[5 * 2], BK[5 * 2 + 1]); g.lineTo(BK[6 * 2], BK[6 * 2 + 1])
  g.strokeStyle = lit ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.16)'
  g.lineWidth = 1
  g.stroke()
}

// The wait pulse and judgement flashes change every frame, so they go over the cached keyboard;
// the black keys beside a redrawn white key are drawn again to stay on top.
const kRedrawBlack = new Uint8Array(MAX_KEYS)
function drawKeyOverlays3D(ctx, pulse) {
  let any = false
  for (const k of keys) {
    const i = k.i
    if (!kWait[i] && !kFb[i]) continue
    any = true
    if (k.black) continue
    ctx.beginPath()
    whiteTopPath(ctx, k, kDown[i])
    whiteFrontPath(ctx, k, kDown[i])
    if (kWait[i]) { ctx.globalAlpha = 0.22 + 0.5 * pulse; ctx.fillStyle = kWait[i]; ctx.fill() }
    if (kFb[i]) { ctx.globalAlpha = 0.85 * kFbA[i]; ctx.fillStyle = kFb[i]; ctx.fill() }
    ctx.globalAlpha = 1
    if (kWait[i]) {
      ctx.beginPath()
      whiteTopPath(ctx, k, kDown[i])
      ctx.strokeStyle = rgba(kWait[i], 0.5 + 0.5 * pulse)
      ctx.lineWidth = 2
      ctx.stroke()
    }
    drawWhiteLabel(ctx, k, !!kFb[i])
    if (i > 0 && keys[i - 1].black) kRedrawBlack[i - 1] = 1
    if (i < keys.length - 1 && keys[i + 1].black) kRedrawBlack[i + 1] = 1
  }
  if (!any) return
  for (const k of keys) {
    const i = k.i
    if (!k.black) continue
    const own = kWait[i] || kFb[i]
    if (!kRedrawBlack[i] && !own) continue
    kRedrawBlack[i] = 0
    drawBlackKey(ctx, k, kFill[i], kLit[i], kDown[i])
    if (!own) continue
    ctx.beginPath()
    facePath(ctx, BK_FACES.top)
    if (kWait[i]) { ctx.globalAlpha = 0.25 + 0.55 * pulse; ctx.fillStyle = kWait[i]; ctx.fill() }
    if (kFb[i]) { ctx.globalAlpha = 0.85 * kFbA[i]; ctx.fillStyle = kFb[i]; ctx.fill() }
    ctx.globalAlpha = 1
    if (kWait[i]) { ctx.strokeStyle = rgba(kWait[i], 0.5 + 0.5 * pulse); ctx.lineWidth = 2; ctx.stroke() }
  }
}

// light spilling from lit and waiting keys onto the strip behind them
function drawKeyGlows3D(ctx, pulse) {
  let on = false
  for (const k of keys) {
    const i = k.i
    const c = kLit[i] ? kFill[i] : kWait[i]
    if (!c) continue
    if (!on) { on = true; ctx.globalCompositeOperation = 'lighter' }
    const r = k.farW * 0.9
    drawGlow(ctx, c, k.farCx, G.kbTop + 2, r, r * 0.4, kLit[i] ? 0.4 : 0.15 + 0.3 * pulse)
  }
  if (on) { ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1 }
}

/* ========================================================== flat frame */
function drawFrameFlat(ctx, s, W, H, view, notes, pos, wall) {
  ctx.fillStyle = G.bg; ctx.fillRect(0, 0, W, H)
  const bd = backdropFor(s.backdrop, W, G.kbTop)
  if (bd) {
    ctx.drawImage(bd, 0, 0, W, G.kbTop)
    ctx.fillStyle = rgba(PAL.bgTop, 0.8); ctx.fillRect(0, 0, W, G.kbTop)
  }
  ctx.fillStyle = G.floor; ctx.fillRect(0, 0, W, G.kbTop)
  drawLanes(ctx)
  for (let i = 0; i < keys.length; i++) kPrevHeld[i] = kHeld[i]
  drawHotSpots(ctx)
  drawNotes(ctx, s, notes, view, pos, wall)
  ctx.fillStyle = G.fogFlat
  ctx.fillRect(0, 0, W, G.kbTop * 0.18)
  drawLoopMarkers(ctx, s, pos)
  drawJudgementLine(ctx)
  drawKeyboardFlat(ctx, wall)
  drawWords(ctx, wall)
  drawHud(ctx, s, wall)
}

/* -------------------------------------------------------------- flat field */
const LANE_DASH = [5, 7]
const NO_DASH = []
function drawLanes(ctx) {
  const yJ = G.kbTop
  // darker stripes under the black-key lanes
  ctx.beginPath()
  for (const k of keys) if (k.black) ctx.rect(k.x, 0, k.w, yJ)
  ctx.fillStyle = rgba(PAL.bed, 0.3); ctx.fill()
  // white-key lane boundaries; octave lines a touch brighter
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let j = 0; j <= G.nWhite; j++) {
    const x = G.x0 + j * G.ww
    ctx.moveTo(x, yJ); ctx.lineTo(x, 0)
  }
  ctx.strokeStyle = rgba(PAL.accent2, 0.055); ctx.stroke()
  ctx.beginPath()
  for (const k of keys) {
    if (k.pc !== 0 || k.i === 0) continue
    ctx.moveTo(k.x, yJ); ctx.lineTo(k.x, 0)
  }
  ctx.strokeStyle = rgba(PAL.accent2, 0.13); ctx.stroke()
  // light columns above sounding keys
  for (const k of keys) {
    const c = kAct[k.i] || kWait[k.i]
    if (!c) continue
    const tn = tone(c)
    const yTop = flatY(0.62)
    const g = ctx.createLinearGradient(0, yJ, 0, yTop)
    g.addColorStop(0, tn.col); g.addColorStop(1, tn.col0)
    ctx.fillStyle = g
    ctx.fillRect(k.cx - k.w / 2, yTop, k.w, yJ - yTop)
  }
}

function drawNotes(ctx, s, notes, view, pos, wall) {
  if (!notes.length) return
  const meta = notesMeta(notes)
  const ws = G.ws
  const labels = s.noteLabels === 'names' || s.noteLabels === 'fingers' ? s.noteLabels : null
  if (labels === 'fingers' && !meta.fingers) meta.fingers = notes.some((n) => !n.finger) ? computeFingers(notes) : new Map()
  const waiting = !!s.waiting
  const waitList = waiting && Array.isArray(s.waitNotes) ? s.waitNotes : null
  const handOnly = s.handFilter === 'left' || s.handFilter === 'right' ? s.handFilter : null
  const lo = meta.sorted ? firstIndexFrom(notes, pos - meta.maxDur - 0.05) : 0
  const tMax = pos + LOOK * UMAX
  const pulse = 0.5 + 0.5 * Math.sin(wall * Math.PI * 2 * 1.3)

  ctx.save()
  ctx.beginPath(); ctx.rect(0, 0, G.W, G.kbTop); ctx.clip()
  for (let pass = 0; pass < 2; pass++) {
    for (let i = lo; i < notes.length; i++) {
      const n = notes[i]
      if (n.start > tMax) { if (meta.sorted) break; continue }
      if (n.start + n.dur <= pos) continue
      const k = keys[n.pitch - ws]
      if (!k || k.black !== (pass === 1)) continue
      if (waitList && waitList.indexOf(n) >= 0) continue
      const dim = handOnly && n.hand !== handOnly
      drawNote(ctx, n, k, pos, view, labels, meta, dim ? 0.38 : 1, 0)
    }
  }
  if (waiting) {
    ctx.fillStyle = rgba(PAL.bed, 0.5)
    ctx.fillRect(0, 0, G.W, G.kbTop)
    if (waitList) {
      for (let pass = 0; pass < 2; pass++) {
        for (const n of waitList) {
          const k = keys[n.pitch - ws]
          if (!k || k.black !== (pass === 1)) continue
          drawNote(ctx, n, k, pos, view, labels, meta, 1, 0.35 + 0.65 * pulse)
        }
      }
    }
  }
  ctx.restore()
}

function drawNote(ctx, n, k, pos, view, labels, meta, alpha, waitPulse) {
  const gap = Math.min(0.08, n.dur * 0.2)
  const dt0 = n.start - pos
  const dt1 = n.start + n.dur - gap - pos
  if (dt1 <= 0) return
  let u0 = dt0 / LOOK, u1 = dt1 / LOOK
  if (u0 > UMAX) return
  if (u1 > UMAX) u1 = UMAX
  if (u0 < -0.3) u0 = -0.3
  const yb = flatY(u0)
  if (yb < -4) return
  const hB = k.laneW / 2
  let yt = flatY(u1)
  if (yb - yt < hB * 1.7) yt = yb - hB * 1.7     // very short notes still read as bars
  const active = dt0 <= 0.001 && !countingIn
  const color = noteColor(n, view)
  const tn = tone(color)

  capsulePath(ctx, k.cx, hB, yt, k.cx, hB, yb)
  ctx.globalAlpha = alpha
  if (active || waitPulse) {
    ctx.shadowColor = color
    ctx.shadowBlur = active ? 26 : 8 + 22 * waitPulse
  }
  const g = ctx.createLinearGradient(0, yt, 0, yb)
  if (active) { g.addColorStop(0, tn.hotTop); g.addColorStop(1, tn.hot) }
  else if (waitPulse) { g.addColorStop(0, tn.base); g.addColorStop(1, mix(color, '#FFFFFF', 0.15 + 0.35 * waitPulse)) }
  else { g.addColorStop(0, tn.deep); g.addColorStop(1, tn.lite) }
  ctx.fillStyle = g
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.shadowColor = 'rgba(0,0,0,0)'
  // crisp rim
  ctx.globalAlpha = alpha * (active ? 0.9 : 0.55)
  ctx.strokeStyle = active ? PAL.cream : tn.hot
  ctx.lineWidth = active ? 1.6 : 1
  ctx.stroke()
  ctx.globalAlpha = 1

  if (labels && alpha > 0.5) {
    const len = yb - yt
    const fs = Math.max(8, Math.min(14, hB * 0.62))
    if (len < fs * 1.5 || hB * 2 < fs * 1.1) return
    let ty = yb - Math.max(4, fs * 0.9)
    if (ty > G.kbTop - fs * 1.5) ty = G.kbTop - fs * 1.5
    if (ty - fs * 0.5 < yt + 2) return
    const text = labels === 'fingers' ? String(n.finger || (meta.fingers && meta.fingers.get(n)) || 1) : BAR_NAMES[k.pc]
    ctx.font = barFont(fs)
    ctx.fillStyle = KT.inkBar
    ctx.fillText(text, k.cx, ty)
  }
}

function drawLoopMarkers(ctx, s, pos) {
  const lp = s.loop
  if (!lp || !lp.on || !Number.isFinite(lp.a) || !Number.isFinite(lp.b)) return
  ctx.setLineDash(LANE_DASH)
  ctx.lineWidth = 1.5
  ctx.font = `600 10px ${FONT}`
  for (let j = 0; j < 2; j++) {
    const t = j ? lp.b : lp.a
    const u = (t - pos) / LOOK
    if (u <= 0 || u > 1) continue
    const y = flatY(u)
    const xa = G.x0, xb = G.W - G.x0
    ctx.strokeStyle = rgba(PAL.accent2, 0.45)
    ctx.beginPath(); ctx.moveTo(xa, y); ctx.lineTo(xb, y); ctx.stroke()
    ctx.fillStyle = rgba(PAL.ink, 0.9)
    const lx = Math.max(4, xa + 6)
    roundRect(ctx, lx, y - 9, 20, 18, 9); ctx.fill()
    ctx.strokeStyle = rgba(PAL.accentHi, 0.6); ctx.setLineDash(NO_DASH); ctx.lineWidth = 1; ctx.stroke()
    ctx.setLineDash(LANE_DASH); ctx.lineWidth = 1.5
    ctx.fillStyle = PAL.accent2
    ctx.fillText(j ? 'B' : 'A', lx + 10, y + 0.5)
  }
  ctx.setLineDash(NO_DASH)
}

// glow pooled where sounding notes meet the line (drawn under the note bars so labels stay legible)
function drawHotSpots(ctx) {
  let on = false
  for (const k of keys) {
    const c = kAct[k.i]
    if (!c) continue
    if (!on) { on = true; ctx.globalCompositeOperation = 'lighter' }
    const r = k.w * 1.2
    ctx.save()
    ctx.beginPath(); ctx.rect(k.cx - r, G.kbTop - r, r * 2, r); ctx.clip()
    drawGlow(ctx, c, k.cx, G.kbTop, r, r, 0.55)
    ctx.restore()
  }
  if (on) { ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1 }
}
function drawJudgementLine(ctx) {
  const y = G.kbTop
  ctx.fillStyle = G.lineBand; ctx.fillRect(0, y - 34, G.W, 34)
  ctx.fillStyle = G.line; ctx.fillRect(0, y - 2, G.W, 2)
}

function drawKeyboardFlat(ctx, wall) {
  const top = G.kbTop, H = G.H, W = G.W
  const pulse = 0.5 + 0.5 * Math.sin(wall * Math.PI * 2 * 1.3)
  ctx.fillStyle = PAL.bed; ctx.fillRect(0, top, W, G.kbH)

  const wTop = top + 2, wH = H - wTop - 2
  const fs = Math.max(9, Math.min(12, G.ww * 0.15))
  // white keys
  for (const k of keys) {
    if (k.black) continue
    const i = k.i
    const lit = kLit[i]
    const dy = kDown[i] ? 1.5 : 0
    keyPath(ctx, k.x + 1, wTop + dy, k.w - 2, wH - dy, 5)
    if (lit) { ctx.shadowColor = kFill[i]; ctx.shadowBlur = 18 }
    ctx.fillStyle = kWait[i] ? mix(kFill[i], kWait[i], 0.3 + 0.6 * pulse) : kFill[i]
    ctx.fill()
    if (lit) { ctx.shadowBlur = 0; ctx.shadowColor = 'rgba(0,0,0,0)' }
    if (kWait[i]) { ctx.strokeStyle = rgba(kWait[i], 0.5 + 0.5 * pulse); ctx.lineWidth = 2; ctx.stroke() }
    if (kFb[i]) { ctx.globalAlpha = 0.85 * kFbA[i]; ctx.fillStyle = kFb[i]; ctx.fill(); ctx.globalAlpha = 1 }
    ctx.fillStyle = G.whiteShade; ctx.fill()
    // label
    const isC = k.pc === 0
    ctx.font = `${isC ? 700 : 500} ${fs}px ${FONT}`
    ctx.fillStyle = lit || kFb[i] ? KT.inkLit : isC ? KT.inkLabelC : KT.inkLabel
    ctx.fillText(isC ? noteName(k.pitch) : NOTE_NAMES[k.pc], k.cx, H - 10 - fs * 0.5 + dy)
  }
  // black keys
  const bh = G.bh
  for (const k of keys) {
    if (!k.black) continue
    const i = k.i
    // soft shadow cast on the white keys
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    roundRect(ctx, k.x + 1, top, k.w + 2, bh + 3, 4); ctx.fill()
    const lit = kLit[i]
    const dy = kDown[i] ? 1.5 : 0
    keyPath(ctx, k.x, top, k.w, bh - 2 + dy, 4)
    if (lit) { ctx.shadowColor = kFill[i]; ctx.shadowBlur = 16 }
    ctx.fillStyle = kWait[i] ? mix(kFill[i], kWait[i], 0.3 + 0.6 * pulse) : kFill[i]
    ctx.fill()
    if (lit) { ctx.shadowBlur = 0; ctx.shadowColor = 'rgba(0,0,0,0)' }
    if (kWait[i]) { ctx.strokeStyle = rgba(kWait[i], 0.5 + 0.5 * pulse); ctx.lineWidth = 2; ctx.stroke() }
    if (kFb[i]) { ctx.globalAlpha = 0.85 * kFbA[i]; ctx.fillStyle = kFb[i]; ctx.fill(); ctx.globalAlpha = 1 }
    ctx.fillStyle = G.blackShade; ctx.fill()
    // front bevel
    ctx.fillStyle = lit ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.07)'
    roundRect(ctx, k.x + 2.5, top + bh - 9 + dy, k.w - 5, 5, 2.5); ctx.fill()
  }
  ctx.fillStyle = G.kbShadow; ctx.fillRect(0, top, W, 12)
}

/* --------------------------------------------------------------------- HUD */
function drawHud(ctx, s, wall) {
  const W = G.W, fieldH = G.kbTop
  const now = clockNow(s)
  if (countingIn) {
    const total = s.countInSeconds > 0 ? s.countInSeconds : 0
    const beatGuess = 60 / (s.tempo > 0 ? s.tempo : 120)
    const beats = s.countIn > 0 ? Math.round(s.countIn) : Math.max(1, Math.round(total / beatGuess) || 1)
    const beatLen = total > 0 ? total / beats : beatGuess
    const start = s.countInStart > 0 ? s.countInStart : s.countInUntil - beats * beatLen
    const el = Math.max(0, now - start)
    const idx = Math.min(beats - 1, Math.floor(el / beatLen))
    const ph = clamp01((el - idx * beatLen) / beatLen)
    const num = beats - idx
    const cx = W / 2, cy = fieldH * 0.46
    const ease = 1 - Math.pow(1 - ph, 3)
    ctx.fillStyle = rgba(PAL.bed, 0.35); ctx.fillRect(0, 0, W, fieldH)
    const disc = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(fieldH * 0.6, 240))
    disc.addColorStop(0, rgba(PAL.bgTop, 0.82)); disc.addColorStop(0.6, rgba(PAL.bgTop, 0.55)); disc.addColorStop(1, rgba(PAL.bgTop, 0))
    ctx.fillStyle = disc; ctx.fillRect(cx - 260, cy - 260, 520, 520)
    // expanding ring
    const R = Math.min(fieldH * 0.3, 120)
    ctx.globalAlpha = (1 - ph) * 0.6
    ctx.strokeStyle = num === 1 ? PAL.accentHi : PAL.accent2
    ctx.lineWidth = 2 + 4 * (1 - ph)
    ctx.beginPath(); ctx.arc(cx, cy, R * (0.6 + 0.6 * ease), 0, Math.PI * 2); ctx.stroke()
    // number
    const size = Math.min(150, fieldH * 0.42) * (1.25 - 0.25 * ease)
    ctx.globalAlpha = 1 - 0.55 * ph
    ctx.fillStyle = PAL.cream
    ctx.font = `700 ${Math.round(size)}px ${FONT}`
    ctx.fillText(String(num), cx, cy + size * 0.04)
    ctx.globalAlpha = 0.55
    ctx.font = `600 12px ${FONT}`
    ctx.fillText('GET READY', cx, cy + Math.min(150, fieldH * 0.42) * 0.62 + 10)
    // beat dots
    const dotGap = 14, dx0 = cx - ((beats - 1) * dotGap) / 2
    for (let b = 0; b < beats && beats <= 12; b++) {
      ctx.globalAlpha = b <= idx ? 0.9 : 0.25
      ctx.fillStyle = b <= idx ? PAL.accentHi : PAL.cream
      ctx.beginPath(); ctx.arc(dx0 + b * dotGap, cy + Math.min(150, fieldH * 0.42) * 0.62 + 30, 3.2, 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalAlpha = 1
  }
  if (s.waiting) {
    const pulse = 0.5 + 0.5 * Math.sin(wall * Math.PI * 2 * 1.3)
    ctx.font = `600 13px ${FONT}`
    const text = 'Your turn — play the glowing keys'
    const tw = ctx.measureText(text).width
    const pw = tw + 44, ph = 30, x = W / 2 - pw / 2, y = 14
    ctx.fillStyle = rgba(PAL.ink, 0.86)
    roundRect(ctx, x, y, pw, ph, ph / 2); ctx.fill()
    ctx.strokeStyle = rgba(PAL.accentHi, 0.4); ctx.lineWidth = 1; ctx.stroke()
    ctx.fillStyle = PAL.accentHi
    ctx.globalAlpha = 0.45 + 0.55 * pulse
    ctx.beginPath(); ctx.arc(x + 17, y + ph / 2, 4, 0, Math.PI * 2); ctx.fill()
    ctx.globalAlpha = 1
    ctx.fillStyle = PAL.cream
    ctx.fillText(text, x + pw / 2 + 8, y + ph / 2 + 0.5)
  }
}
