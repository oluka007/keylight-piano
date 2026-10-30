import { COLORS, FONTS, MODES, NOTE_VIEWS, NOTE_LABELS } from './theme.js'
import { IS_WIN, THIS_COMPUTER, TAKES_FOLDER } from './platform.js'
import { Player } from './player.js'
import { drawScene, noteName } from './views.js'
import { loadSongFile } from './songloader.js'
import { assignFingering } from './fingering.js'
import { parseMusicXml } from './musicxml.js'
import { LedDaemon } from './daemon.js'
import { SongScheduler } from './scheduler.js'
import { HandTracker, listCameras, BONES, TIPS } from './handtrack.js'
import { summarize } from './scoring.js'
import { Voice } from './instruments.js'
import {
  initAudio, audioContext, playNote, stopNote, noteOn, noteOff, stopAll, click,
  loadBackingFile, hasBacking, backingDuration, playBacking, stopBacking,
  setBackingVolume, setVolume, playBass, playHat, pickStem,
  setInstrument, currentInstrument, instrumentList, setBend, setPressure, setSlide,
  setPolyPressure, setBendRange, activeVoiceCount, voiceState, clearBacking, isBackingPlaying, setSustain,
  loadRecording, unloadRecording, hasRecording, playRecording, pauseRecording, recordingPosition, nudgeRecording,
  listOutputs, setOutput, latencyInfo
} from './audio.js'
import {
  importFile, saveImported, listImported, getImported, deleteImported, isLyricsFile, parseLrc, isSafeCover
} from './importer.js'
import {
  noteOn as syNoteOn, noteOff as syNoteOff, clearLights,
  beginApiMode, setLightingMode, turnOffAllKeys, LIGHTING_MODE
} from './lights.js'
import {
  startTake, stopTake, isRecording, takeBusy, logMidi, onTakeChange, takeElapsed, takeFrameDrawn,
  pickMimeType, MIME_TYPES, TAKE_NAME, mp4Timeline, audioEdit, AAC_PRIMING
} from './recorder.js'

/* ============================== state ============================== */
const $ = (id) => document.getElementById(id)
const canvas = $('stage')
const ctx2d = canvas.getContext('2d')
// the pixel ratio the stage was last sized for: a take keeps the stage's size (and this
// ratio) when the window's ratio changes, and everything is drawn with it until it ends
let stageDpr = window.devicePixelRatio || 1

// Built-in songs. cover: a square PNG in renderer/covers/ (the generated tile shows while it
// loads and stays if the file is missing); level: the difficulty badge.
const LIBRARY = [
  { file: 'c-major-scale.xml', title: 'C Major Scale', artist: 'Exercise', cover: 'covers/c-major-scale.png', level: 'Level 1', genre: 'Exercise', hands: 'right' },
  { file: 'twinkle.xml', title: 'Twinkle Twinkle Little Star', artist: 'Traditional', cover: 'covers/twinkle.png', level: 'Level 1', genre: 'Traditional', hands: 'both' },
  { file: 'mary-had-a-little-lamb.xml', title: 'Mary Had a Little Lamb', artist: 'Traditional', cover: 'covers/mary-had-a-little-lamb.png', level: 'Level 1', genre: 'Traditional', hands: 'both' },
  { file: 'ode-to-joy.xml', title: 'Ode to Joy', artist: 'Beethoven', cover: 'covers/ode-to-joy.png', level: 'Level 1', genre: 'Classical', hands: 'both' },
  { file: 'jingle-bells.xml', title: 'Jingle Bells', artist: 'James Lord Pierpont', cover: 'covers/jingle-bells.png', level: 'Level 1', genre: 'Traditional', hands: 'both' },
  { file: 'au-clair-de-la-lune.xml', title: 'Au clair de la lune', artist: 'Traditional', cover: 'covers/au-clair-de-la-lune.png', level: 'Level 1', genre: 'Traditional', hands: 'both' },
  { file: 'frere-jacques.xml', title: 'Frère Jacques', artist: 'Traditional', cover: 'covers/frere-jacques.png', level: 'Level 2', genre: 'Traditional', hands: 'both' },
  { file: 'when-the-saints.xml', title: 'When the Saints Go Marching In', artist: 'Traditional', cover: 'covers/when-the-saints.png', level: 'Level 2', genre: 'Traditional', hands: 'both' },
  { file: 'happy-birthday.xml', title: 'Happy Birthday', artist: 'Mildred & Patty Hill', cover: 'covers/happy-birthday.png', level: 'Level 2', genre: 'Traditional', hands: 'both' },
  { file: 'amazing-grace.xml', title: 'Amazing Grace', artist: 'Traditional', cover: 'covers/amazing-grace.png', level: 'Level 2', genre: 'Traditional', hands: 'both' },
  { file: 'morning-mood.xml', title: 'Morning Mood', artist: 'Grieg', cover: 'covers/morning-mood.png', level: 'Level 2', genre: 'Classical', hands: 'both' },
  { file: 'brahms-lullaby.xml', title: "Brahms' Lullaby", artist: 'Brahms', cover: 'covers/brahms-lullaby.png', level: 'Beginner', genre: 'Classical', hands: 'right' },
  { file: 'scarborough-fair.xml', title: 'Scarborough Fair', artist: 'Traditional', cover: 'covers/scarborough-fair.png', level: 'Beginner', genre: 'Traditional', hands: 'right' },
  { file: 'silent-night.xml', title: 'Silent Night', artist: 'Gruber', cover: 'covers/silent-night.png', level: 'Beginner', genre: 'Traditional', hands: 'right' },
  { file: 'auld-lang-syne.xml', title: 'Auld Lang Syne', artist: 'Traditional', cover: 'covers/auld-lang-syne.png', level: 'Beginner', genre: 'Traditional', hands: 'right' },
  { file: 'greensleeves.xml', title: 'Greensleeves', artist: 'Traditional', cover: 'covers/greensleeves.png', level: 'Easy', genre: 'Traditional', hands: 'right' },
  { file: 'canon-in-d.xml', title: 'Canon in D', artist: 'Pachelbel', cover: 'covers/canon-in-d.png', level: 'Easy', genre: 'Classical', hands: 'right' },
  { file: 'minuet-in-g.xml', title: 'Minuet in G', artist: 'Petzold', cover: 'covers/minuet-in-g.png', level: 'Easy', genre: 'Classical', hands: 'right' },
  { file: 'fur-elise.xml', title: 'Für Elise', artist: 'Beethoven', cover: 'covers/fur-elise.png', level: 'Easy', genre: 'Classical', hands: 'right' }
]
const LEVELS = ['Level 1', 'Level 2', 'Beginner', 'Easy']   // easiest first (Sort: Level)

const DEFAULTS = {
  brightness: 255, volume: 80, backingVolume: 70,
  countIn: 4, metronome: false, labels: 'off', view: 'CASCADE',
  hands: 'both', rate: 1, band: false, waitMode: 'pauseAndSnap', instrument: 'grand', keyboardMode: 'Pro', bendRange: 12,
  accompany: true, kbZero: 48, userColor: '#a78bfa', expression: null, audioOutput: '',
  recordTakes: false
}

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v) } catch { return d } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }
}
const settings = Object.assign({}, DEFAULTS, store.get('lumi.settings', {}))
const saveSettings = () => store.set('lumi.settings', settings)
// Light style and expression used to be one setting ("Piano" meant no expression)
if (settings.expression == null) settings.expression = settings.keyboardMode !== 'Piano'
delete settings.ledTransport

let screen = 'home'
let player = null
let song = null
let daemon = null
let daemonState = 'checking'
let midi = null, midiInput = null, midiOutput = null
let freeplay = false
let feedback = new Map()        // pitch -> { kind, until }
let missedBlink = new Map()     // pitch -> until
let backingName = null
let fullName = null
let lastFrame = 0
let drawErrorLogged = false
let bandEvents = []
let bandPos = 0
let litNotes = new Map()
const scheduler = new SongScheduler()
let ledOverrideUntil = 0     // a light ceremony owns the keys until then
let importedSongs = []       // records from the on-disk library (newest first)
let backdropImg = null       // imported cover, drawn blurred behind the notes
let backingEpoch = -1        // player epoch the recording was last synced to
let recordingEpoch = -1      // same, for an imported song's own recording
let mediaToken = 0           // bumped per song, so late loads from the last song are ignored
let showLyrics = true
let ceremonyTimers = []
function cancelCeremony() {
  for (const t of ceremonyTimers) clearTimeout(t)
  ceremonyTimers = []
  ledOverrideUntil = 0
}
let exerciseMeta = null        // {type, tonic, hand} when playing a toolbox exercise
let lastSummary = null
let lastMode = 'PLAY'

const TONICS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const SCALE_STEPS = [0, 2, 4, 5, 7, 9, 11, 12]
const CHORD_STEPS = [0, 4, 7, 12]
const tb = { type: 'scale', tonic: 0, hand: 'both' }

// Guided lessons: three steps per lesson, unlocking
// sequentially, stars persisted per step.
let lessonMeta = null
let searchTerm = ''
const LESSONS = [
  { id: 'first-notes', title: 'Your first notes', sub: 'C major scale · up one octave', file: 'c-major-scale.xml', from: 0, to: 6 },
  { id: 'twinkle', title: 'Twinkle, both hands', sub: 'Traditional · first line, both hands', file: 'twinkle.xml', from: 0, to: 10 },
  { id: 'ode', title: 'Ode to Joy phrase', sub: 'Beethoven · first phrase, both hands', file: 'ode-to-joy.xml', from: 0, to: 9.23 },
  { id: 'jingle', title: 'Jingle Bells chorus', sub: 'Traditional · first half of the chorus, both hands', file: 'jingle-bells.xml', from: 0, to: 16 },
  { id: 'grace', title: 'Amazing Grace', sub: 'Traditional · first two lines, slow, both hands', file: 'amazing-grace.xml', from: 0, to: 18 }
]
const LESSON_STEPS = ['WATCH', 'PRACTISE', 'PLAY']

// Arcade levels, easiest first.
const GAMES = [
  { id: 'springboard', name: 'Warm-up', file: 'twinkle.xml', rate: 1, threshold: 0.60, sub: 'Traditional · gentle' },
  { id: 'cascade', name: 'Cascade', file: 'ode-to-joy.xml', rate: 1, threshold: 0.70, sub: 'Beethoven · steady' },
  { id: 'rainbow', name: 'Rainbow Run', file: 'jingle-bells.xml', rate: 1, threshold: 0.75, sub: 'Traditional · bouncy' },
  { id: 'superluminal', name: 'Lightspeed', file: 'canon-in-d.xml', rate: 0.75, threshold: 0.80, sub: 'Pachelbel · fast' }
]
let gameMeta = null
function gameBest(id) { return store.get('lumi.game.' + id, 0) }

/* ============================== boot ============================== */
function boot() {
  const q = new URLSearchParams(location.search)
  if (IS_WIN) applyWindowsPage()
  wireUI()
  const ob = $('onboarding')
  const skipOb = q.has('demo') || q.has('screen') || q.has('tb') || q.has('importdemo') || q.has('freeplay') || q.has('selftest') || q.has('perf')
  // setup=1..4 opens the setup at that step even once it is done (screenshots, support)
  if (q.has('setup')) openSetup(Number(q.get('setup')) || 1)
  else if (ob && !store.get('lumi.onboarded', false) && !skipOb) openSetup(1)
  // open the audio output now, so the first key you press doesn't wait for it
  initAudio()
  setOutput(settings.audioOutput || '')
  setVolume(settings.volume / 100)
  setBackingVolume(settings.backingVolume / 100)
  // nokb=1 (LUMI_NO_KEYBOARD=1, as scripts/record-clip.sh runs): no MIDI and no key lights,
  // so a test or clip run neither hears someone playing the keyboard nor takes its lights
  // and settings from the app they are playing in
  if (!q.has('nokb')) { initDaemon(); initMidi() }
  renderLibrary()
  renderRecent()
  updateHome()
  loadImportedLibrary()
  requestAnimationFrame(frame)
  setInterval(pumpAudio, 25)
  if (q.get('demo')) {
    openLibrary(q.get('demo') + '.xml').then(() => {
      if (!player) return
      const pos = Number(q.get('pos') || 0)
      if (pos) player.seek(pos)
      if (q.get('mode')) setMode(q.get('mode'))
      if (q.get('view')) { settings.view = q.get('view'); player.setView(settings.view); syncHudButtons() }
      if (q.get('labels')) { settings.labels = q.get('labels'); player.setNoteLabels(settings.labels); syncHudButtons() }
      // autoplay=1 (or a delay in ms) starts playback: used by scripts/record.sh.
      // rec=<seconds> also records that much of it as a take, whatever the setting
      // (scripts/record-clip.sh)
      const recSecs = Number(q.get('rec')) || 0
      if (q.get('autoplay')) setTimeout(() => {
        if (!player || player.active) return
        if (recSecs > 0 && beginTake('rec query')) setTimeout(() => endTake('rec ' + recSecs + ' s'), recSecs * 1000)
        togglePlay()
      }, Math.max(400, Number(q.get('autoplay')) || 0))
      if (q.get('res')) {
        showResults({ overallAccuracy: 0.86, noteAccuracy: 0.86, rhythmAccuracy: 0.76, totalNotes: 42, totalNotesHit: 36, perfect: 24, good: 8, early: 2, late: 2, missed: 6, longestStreak: 11, starRating: 4 })
      }
    })
  }
  if (q.get('freeplay') !== null && q.get('freeplay') !== undefined && q.has('freeplay')) startFreeplay(Number(q.get('freeplay') || 0))
  if (q.get('style')) setLightStyle(q.get('style'), false)
  if (q.get('chip')) searchChip = q.get('chip')
  if (q.get('screen')) showScreen(q.get('screen'))
  if (q.get('tb')) {
    tb.type = q.get('tb')
    tb.tonic = Number(q.get('tonic') || 0)
    tb.hand = q.get('hand') || 'both'
    renderToolbox()
  renderLessons()
  renderGames()
    if (q.get('start')) startExercise()
  }
  if (location.search.includes('selftest')) runSelfTest()
  if (q.has('perf')) runPerfProbe()
  if (q.get('importdemo')) {
    const tune = [55, 60, 64, 60, 64, 62, 60, 57, 55, 55, 60, 64, 60, 64, 62, 67]
    synthTestRecording('Traditional - Amazing Grace.wav', tune).then((f) => handleImportFile(f)).then(() => {
      if (q.get('importdemo') === 'play' && importedRecord) { closeImportSheet(); openImported(importedRecord.id).then(() => { if (player) player.seek(Number(q.get('pos') || 4)) }) }
    })
  }
  if (q.get('sheet')) openImportSheet()
}

/* ============================== first-run setup ============================== */
// Three live checks: a key sounds, the keyboard's two end keys pin down the range it
// plays, the key lights sweep and you say whether you saw them; then Lesson 1. Each
// step reads what the app sees right now and can be skipped. lumi.onboarded is only
// set at the end, so quitting halfway brings the setup back next time.
const SETUP_STEPS = ['sound', 'keyboard', 'lights', 'ready']
const setup = {
  open: false, step: 0, furthest: 0, openedAt: 0, timer: 0, raf: 0,
  heard: null,        // the last note the keyboard sent on the sound step
  lowKey: null,       // keyboard step: the far-left key, waiting for the far-right one
  wrongKey: null,     // ...or the key that was neither
  rangeDone: false,
  lights: null,       // the answer to "did your keys light up?": null, 'yes' or 'no'
  sweepAt: 0,
  seen: new Set(), lastTick: 0, glow: new Array(14).fill(0),
  returnFocus: null   // what had focus before the setup opened (Run setup again)
}
const keysRange = () => noteName(kbBase()) + '–' + noteName(kbBase() + 23)
const setText = (el, text) => { if (el && el.textContent !== text) el.textContent = text }
const SETUP_CHECK = '<svg><use href="#i-check"/></svg>'

function openSetup(step = 1) {
  const ob = $('onboarding')
  if (!ob) return
  const now = performance.now()
  Object.assign(setup, { open: true, openedAt: now, furthest: 0, heard: null, lowKey: null, wrongKey: null, rangeDone: false, lights: null, sweepAt: 0, seen: new Set(held), lastTick: now, returnFocus: document.activeElement })
  ob.classList.remove('hidden')
  // a first run is left step by step; once it has been done, it can just be closed
  const again = store.get('lumi.onboarded', false)
  $('obClose').classList.toggle('hidden', !again)
  setText(ob.querySelector('.ob-kicker'), again ? 'SETUP' : 'WELCOME TO KEYLIGHT')
  setText(ob.querySelector('.ob-title'), again ? 'Check your keyboard' : 'Let’s set up your keyboard')
  setText(ob.querySelector('.ob-copy'), again ? 'Three quick checks: sound, keys and lights.' : 'Three quick checks, then your first lesson.')
  $('obVolume').value = String(settings.volume)
  $('app').inert = true
  clearInterval(setup.timer)
  setup.timer = setInterval(setupPoll, 500)
  cancelAnimationFrame(setup.raf)
  setup.raf = requestAnimationFrame(setupKeysTick)
  goSetupStep(step - 1)
  console.log('SETUP open step=' + SETUP_STEPS[setup.step])
}

function closeSetup() {
  setup.open = false
  clearInterval(setup.timer)
  cancelAnimationFrame(setup.raf)
  $('onboarding').classList.add('hidden')
  $('app').inert = false
  const back = setup.returnFocus
  setup.returnFocus = null
  if (back && back.isConnected && back !== document.body) back.focus({ preventScroll: true })
}

function finishSetup(lesson) {
  store.set('lumi.onboarded', true)
  closeSetup()
  console.log('SETUP done sound=' + (setup.heard != null) + ' keys=' + setup.rangeDone + ' lights=' + (setup.lights || 'skipped'))
  if (lesson) startLessonStep(LESSONS[0], 'WATCH')
  else { showScreen('home'); status('Pick a lesson or a song to start') }
}

function goSetupStep(i) {
  setup.step = Math.max(0, Math.min(SETUP_STEPS.length - 1, i))
  setup.furthest = Math.max(setup.furthest, setup.step)
  const step = SETUP_STEPS[setup.step]
  if (step === 'keyboard') { setup.lowKey = null; setup.wrongKey = null }
  if (step === 'lights' && setup.lights !== 'yes') setup.lights = null
  renderSetup()
  if (step === 'lights') sweepSetupLights()
  $('obStepTitle').focus({ preventScroll: true })
}
const setupNext = () => (SETUP_STEPS[setup.step] === 'ready' ? finishSetup(true) : goSetupStep(setup.step + 1))
const setupSkip = () => (SETUP_STEPS[setup.step] === 'ready' ? finishSetup(false) : goSetupStep(setup.step + 1))
function setupPassed(step) {
  return step === 'sound' ? setup.heard != null : step === 'keyboard' ? setup.rangeDone : step === 'lights' ? setup.lights === 'yes' : false
}

// Twice a second: the keyboard and the light service can come and go while the setup
// is open, and the output latency only reads true once the device has played a moment.
function setupPoll() {
  if (!setup.open) return
  renderSetup()
  if (SETUP_STEPS[setup.step] === 'lights' && setup.lights == null && performance.now() - setup.sweepAt > 1600) sweepSetupLights()
}

// The light style's own sweep (drawStylePreview) runs along the keys, and along the drawn ones
function sweepSetupLights() {
  const lights = setupLightsState()
  if (lights !== 'on' && lights !== 'midi') return
  if (lights === 'midi') midiLightSweep()
  setup.sweepAt = performance.now()
  stylePreviewAt = setup.sweepAt
  const keys = $('obKeys')
  keys.classList.remove('sweep')
  void keys.offsetWidth
  keys.classList.add('sweep')
}

function setupLightsState() {
  if (daemon && daemon.ready) return 'on'
  // Windows has no light service: the keyboard lights keys from MIDI notes ('midi'), once
  // its MIDI output is found ('no-output' until then; 'checking' while MIDI starts)
  if (IS_WIN) return midiOutput ? 'midi' : !midi && performance.now() - setup.openedAt < 3000 ? 'checking' : 'no-output'
  return daemonState === 'no-device' ? 'no-device' : daemonState === 'checking' ? 'checking' : 'off'
}

// New presses, read each frame from held and letGoAt (handleNoteOn / handleNoteOff keep
// them), so a tap shorter than a frame still counts. The drawn keys light under your fingers.
function setupKeysTick() {
  if (!setup.open) return
  setup.raf = requestAnimationFrame(setupKeysTick)
  const now = performance.now()
  const fresh = [...held].filter((p) => !setup.seen.has(p))
  for (const [p, t] of letGoAt) if (t > setup.lastTick && !setup.seen.has(p) && !held.has(p)) fresh.push(p)
  setup.seen = new Set(held)
  setup.lastTick = now
  for (const p of fresh) onSetupKey(p)
  for (const p of held) { const i = drawnKeyIndex(p); if (i >= 0) setup.glow[i] = now + 60 }
  for (const p of fresh) { const i = drawnKeyIndex(p); if (i >= 0) setup.glow[i] = Math.max(setup.glow[i], now + 200) }
  const keys = $('obKeys').children
  for (let i = 0; i < keys.length; i++) {
    const on = setup.glow[i] > now
    if (keys[i].classList.contains('down') !== on) keys[i].classList.toggle('down', on)
  }
}
// Which of the 14 drawn white keys a note lands on (a black key lights the white key below it)
function drawnKeyIndex(pitch) {
  const r = pitch - kbBase()
  if (r < 0 || r >= 24) return -1
  return Math.floor(r / 12) * 7 + [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6][r % 12]
}

function onSetupKey(pitch) {
  const step = SETUP_STEPS[setup.step]
  if (step === 'sound') {
    if (setup.heard == null) console.log('SETUP heard ' + noteName(pitch))
    setup.heard = pitch
    renderSetup()
  } else if (step === 'keyboard' && !setup.rangeDone) {
    const r = readEndKeys(setup.lowKey, pitch, kbBase())
    if (r.done) {
      if (r.shift) recalibrate(r.shift, 'setup: end keys ' + setup.lowKey + ' and ' + pitch)
      setup.rangeDone = true
      console.log('SETUP end keys ' + setup.lowKey + ' and ' + pitch + ': keys play ' + keysRange() + (r.shift ? ' (was off by ' + r.shift + ')' : ''))
    } else { setup.lowKey = r.low; setup.wrongKey = r.wrong ?? null }
    renderSetup()
  }
}

// The keyboard step's two presses. The far-left key is always a C and the far-right one
// is 23 keys above it. Only the pair pins the range down: one press of a C can't tell the
// bottom C from the middle one. When done, shift is how far `base` (the range the app
// assumed, kbBase) was off.
function readEndKeys(low, pitch, base) {
  if (low != null && pitch === low + 23) return { done: true, shift: low - base }
  if ((((pitch - base) % 12) + 12) % 12 === 0) return { low: pitch }
  return { low: null, wrong: pitch }
}

function answerLights(yes) {
  setup.lights = yes ? 'yes' : 'no'
  console.log('SETUP lights seen=' + setup.lights)
  renderSetup()
}

// The current step's text, check, panel and buttons, from the live state
function renderSetup() {
  if (!setup.open) return
  const step = SETUP_STEPS[setup.step]
  const ob = $('onboarding')
  if (ob.dataset.step !== step) ob.dataset.step = step
  // MIDI access takes a moment at start-up: say "looking" until it has had a chance.
  // A port that was unplugged stays picked but reads 'disconnected'.
  const kb = midiInput && midiInput.state !== 'disconnected' ? 'on' : !midi && performance.now() - setup.openedAt < 3000 ? 'checking' : 'off'
  const lights = setupLightsState()
  const canLight = lights === 'on' || lights === 'midi'
  const noKeyboard = kb === 'checking' ? ['wait', 'Looking for your keyboard…'] : ['warn', 'No keyboard found yet. Plug it in over USB and switch it on.']
  const lit = lights === 'on' ? ' (it’s lit)' : ''
  let v
  if (step === 'sound') {
    const heard = setup.heard != null && noteName(setup.heard)
    v = {
      title: 'Press any key on your keyboard',
      copy: 'You should hear a note. If you don’t, turn the volume up.',
      check: heard ? (settings.volume > 0 ? ['ok', 'Got ' + heard + ' from your keyboard'] : ['warn', 'Got ' + heard + ', but the volume is all the way down'])
        : kb === 'on' ? ['wait', 'Waiting for a key…'] : noKeyboard
    }
  } else if (step === 'keyboard') {
    v = {
      title: 'Press the lowest key',
      copy: 'That’s the key at the far left. Then press the one at the far right, so the lights land on the keys you play.',
      check: setup.rangeDone ? ['ok', 'Got it: your keys play ' + keysRange()]
        : kb !== 'on' ? noKeyboard
        : setup.wrongKey != null ? ['warn', 'That was ' + noteName(setup.wrongKey) + '. Start with the key at the far left' + lit]
        : setup.lowKey == null ? ['wait', 'Keyboard connected. Press the key at the far left' + lit]
        : ['wait', 'Now press the key at the far right' + lit]
    }
  } else if (step === 'lights') {
    v = {
      title: canLight ? 'Watch your keys' : 'Light up your keys',
      copy: canLight ? 'A light runs along your keys from left to right.'
        : IS_WIN ? 'Your keys light up to show you what to play next, in your keyboard’s own colours.'
        : 'Your keys light up to show you what to play next. A free helper, blocksd, drives the lights.',
      check: canLight
        ? (setup.lights === 'yes' ? ['ok', 'Your keys light up']
          : setup.lights === 'no' ? ['warn', 'Check the keyboard is switched on and plugged in over USB, then show the lights again.']
          : ['wait', 'Did your keys light up?'])
        : lights === 'no-device' ? ['warn', 'The light service is running but can’t find your keyboard. Plug it in over USB and switch it on.']
        : lights === 'checking' ? ['wait', IS_WIN ? 'Looking for your keyboard…' : 'Looking for the light service…']
        : lights === 'no-output' ? ['warn', 'No keyboard found yet. Plug it in over USB and switch it on.']
        : ['warn', 'The light service isn’t running, so your keys can’t light up yet.'],
      skip: canLight && setup.lights == null ? 'Skip' : 'Continue without key lights'
    }
  } else {
    const all = SETUP_STEPS.slice(0, 3).every(setupPassed)
    v = {
      title: all ? 'You’re ready to play' : 'Ready when you are',
      copy: 'Lesson 1 shows you your first notes: watch it once, then play it yourself.',
      check: null, next: 'Start your first lesson', skip: 'Go to Home'
    }
  }
  const passed = step === 'ready' || setupPassed(step)
  setText($('obStepTitle'), v.title)
  setText($('obStepCopy'), v.copy)
  const chk = $('obCheck')
  chk.classList.toggle('hidden', !v.check)
  if (v.check) {
    if (chk.dataset.state !== v.check[0]) chk.dataset.state = v.check[0]
    setText($('obCheckText'), v.check[1])
  }
  $('obAnswer').classList.toggle('hidden', !(step === 'lights' && canLight && setup.lights == null))
  for (const p of ob.querySelectorAll('.ob-panel')) p.classList.toggle('hidden', p.dataset.panel !== step)
  // Bluetooth headphones are the usual cause of a long output delay
  const ac = audioContext()
  const out = ac ? ac.outputLatency || 0 : 0
  $('obLatency').classList.toggle('hidden', !(out > 0.05))
  if (out > 0.05) setText($('obLatency'), 'Your speakers or headphones add about ' + Math.round(out * 1000) + ' ms of delay; wired headphones keep you in time. Bluetooth is the usual cause.')
  $('obInstall').classList.toggle('hidden', lights !== 'off')
  $('obLightsAgain').classList.toggle('hidden', !(canLight && setup.lights === 'no'))
  if (step === 'ready') renderSetupSummary(lights)
  ob.querySelectorAll('#obSteps li').forEach((li, i) => {
    const done = setupPassed(SETUP_STEPS[i]) && i !== setup.step
    li.classList.toggle('on', i === setup.step)
    li.classList.toggle('done', done)
    const b = li.firstElementChild
    b.disabled = i > setup.furthest
    if (i === setup.step) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current')
    const mark = done ? 'done' : String(i + 1)
    if (b.dataset.mark !== mark) { b.dataset.mark = mark; b.firstElementChild.innerHTML = done ? SETUP_CHECK : mark }
  })
  const next = $('obNext'), skip = $('obSkip')
  setText(next, v.next || 'Continue')
  next.disabled = !passed
  setText(skip, v.skip || 'Skip')
  skip.classList.toggle('hidden', passed && step !== 'ready')
  // the drawn keyboard marks the end key to press next
  const guide = step === 'keyboard' && !setup.rangeDone && kb === 'on' ? (setup.lowKey == null ? 0 : 13) : -1
  const keys = $('obKeys').children
  for (let i = 0; i < keys.length; i++) if (keys[i].classList.contains('guide') !== (i === guide)) keys[i].classList.toggle('guide', i === guide)
}

function renderSetupSummary(lights) {
  const rows = [
    ['Sound', setup.heard != null, setup.heard != null ? 'Your keyboard plays and sounds' : 'Skipped'],
    ['Keyboard', setup.rangeDone, setup.rangeDone ? 'Your keys play ' + keysRange() : 'Skipped: Keylight also learns your keys as you play'],
    ['Lights', setup.lights === 'yes', setup.lights === 'yes' ? 'Your keys light up'
      : lights === 'off' ? 'Off for now: the light service isn’t running'
      : lights === 'no-output' ? 'Off for now: no keyboard found'
      : setup.lights === 'no' ? 'Not seen yet: run the setup again from Settings' : 'Skipped']
  ]
  const html = rows.map(([name, ok, text]) => `<li data-state="${ok ? 'ok' : 'skip'}"><span class="ob-mark">${SETUP_CHECK}</span><b>${name}</b><span>${text}</span></li>`).join('')
  const list = $('obSummary')
  if (list.dataset.html !== html) { list.dataset.html = html; list.innerHTML = html }
}

function wireFirstRunUI() {
  // octave − / +: the player HUD and Settings, plus Z / X in the player
  $('btnOctDown').onclick = () => shiftOctave(-1)
  $('btnOctUp').onclick = () => shiftOctave(1)
  $('setOctDown').onclick = () => shiftOctave(-1)
  $('setOctUp').onclick = () => shiftOctave(1)
  document.addEventListener('keydown', onOctaveKey)
  syncOctaveUI()
  // setup
  $('runSetup').onclick = () => openSetup(1)
  $('obNext').onclick = setupNext
  $('obSkip').onclick = setupSkip
  $('obClose').onclick = closeSetup
  for (const b of document.querySelectorAll('#obSteps button')) b.onclick = () => goSetupStep(Number(b.dataset.step))
  $('obVolume').oninput = (e) => {
    settings.volume = Number(e.target.value); saveSettings(); setVolume(settings.volume / 100)
    $('volume').value = e.target.value
    renderSetup()
  }
  $('obTestNote').onclick = () => { initAudio(); noteOn(72, 96, 0); setTimeout(() => noteOff(72, 0), 450) }
  $('obLightsYes').onclick = () => answerLights(true)
  $('obLightsNo').onclick = () => answerLights(false)
  $('obLightsAgain').onclick = () => { setup.lights = null; renderSetup(); sweepSetupLights() }
  $('obCopy').onclick = async () => {
    try { await navigator.clipboard.writeText($('obCode').textContent); status('Copied: paste it into Terminal') } catch { status('Select the two lines and copy them with ⌘C') }
  }
  ;[...$('obKeys').children].forEach((k, i) => k.style.setProperty('--i', i))
  document.addEventListener('keydown', onSetupKeydown)
  // the engine announces keyboard connection changes; the poll above covers older builds
  window.addEventListener('keylight:midi', () => renderSetup(), true)
}

// In the setup, Return takes the step's main button once its check has passed (focus sits
// on the step title, where Return does nothing), and Escape closes a setup run from Settings.
function onSetupKeydown(e) {
  if (!setup.open || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
  if (e.key === 'Escape' && store.get('lumi.onboarded', false)) { e.preventDefault(); closeSetup(); return }
  const t = e.target
  if (e.key !== 'Enter' || (t && t.closest && t.closest('button, input, select, textarea, a'))) return
  if (!$('obNext').disabled) { e.preventDefault(); setupNext() }
}

// Z / X move the keys an octave in the player (the main keydown handler has Space, 1-3 and Esc)
function onOctaveKey(e) {
  if (screen !== 'play' || setup.open || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
  const t = e.target
  if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
  if (!$('results').classList.contains('hidden') || viewMenuOpen()) return
  const k = (e.key || '').toLowerCase()
  if (k !== 'z' && k !== 'x') return
  e.preventDefault()
  shiftOctave(k === 'z' ? -1 : 1)
}

// "Sound delay" in Settings: the browser buffer plus what the output device adds
function showAudioLatency() {
  const el = $('audioLatency')
  if (!el) return
  const l = latencyInfo()
  el.textContent = l.output
    ? Math.round((l.base + l.output) * 1000) + ' ms (' + (l.base * 1000).toFixed(1) + ' buffer + ' + Math.round(l.output * 1000) + ' output)'
    : '—'
}

function wireUI() {
  wireKeysUI()
  for (const b of document.querySelectorAll('#nav button')) b.onclick = () => showScreen(b.dataset.screen)
  $('back').onclick = () => showScreen(screen === 'play' ? prevScreen : 'home')
  $('openSettings').onclick = () => showScreen('settings')
  for (const b of document.querySelectorAll('#speedTrack button')) b.onclick = () => setSpeed(b.dataset.speed)
  $('btnWatch').onclick = toggleWatch
  for (const c of document.querySelectorAll('#searchChips button')) c.onclick = () => { searchChip = c.dataset.chip; renderLibrary() }
  $('sortBtn').onclick = () => {
    const modes = Object.keys(SORT_LABELS)
    sortMode = modes[(modes.indexOf(sortMode) + 1) % modes.length]
    renderLibrary()
  }
  $('accompanyToggle').checked = settings.accompany !== false
  $('accompanyToggle').onchange = (e) => { settings.accompany = e.target.checked; saveSettings(); if (player) player.epoch++; status(settings.accompany ? 'The app plays the other hand for you' : 'Only your own playing sounds') }
  $('btnPlay').onclick = togglePlay
  $('btnRestart').onclick = () => { if (player) { player.restart(); } }
  $('btnMetro').onclick = () => toggleSetting('metronome')
  $('btnLabels').onclick = cycleLabels
  $('btnHands').onclick = cycleHands
  $('btnView').onclick = toggleViewMenu
  $('btnLoop').onclick = toggleLoop
  $('selCountIn').onchange = (e) => { settings.countIn = Number(e.target.value); saveSettings(); if (player) player.setCountIn(settings.countIn) }
  for (const t of document.querySelectorAll('[data-go]')) t.onclick = () => tileAction(t.dataset.go)
  $('search').oninput = (e) => { searchTerm = e.target.value.trim().toLowerCase(); renderLibrary() }
  // playground scale picker
  $('fpRoot').innerHTML = NOTE_PCS.map((n, i) => `<option value="${i}">${n}</option>`).join('')
  $('fpScale').innerHTML = SCALES.map(([n], i) => `<option value="${i}">${n}</option>`).join('')
  $('fpRoot').onchange = (e) => { freeRoot = Number(e.target.value); syncFreeplayBar() }
  $('fpScale').onchange = (e) => { freeScaleIdx = Number(e.target.value); syncFreeplayBar() }
  // hand tracking
  $('camMirror').checked = !!settings.camMirror
  $('camMirror').onchange = (e) => { settings.camMirror = e.target.checked; saveSettings(); if (tracker) tracker.mirror = settings.camMirror }
  $('camSelect').onchange = (e) => { settings.camId = e.target.value; saveSettings(); if (cameraOn()) startCamera() }
  $('camToggle').onclick = () => (cameraOn() ? stopCamera() : startCamera())
  $('camAuto').onclick = autoCalibrate
  $('camManual').onclick = () => { if (!cameraOn()) { status('Start the camera first'); return } camPicking = 'a'; camStatus('Click the centre of the leftmost key in the picture') }
  $('camSetupCanvas').onclick = (e) => {
    if (!camPicking || !tracker) return
    const r = e.target.getBoundingClientRect()
    let x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    if (tracker.mirror) x = 1 - x
    if (camPicking === 'a') { tracker._pickA = { x, y }; camPicking = 'b'; camStatus('Now click the centre of the rightmost key') }
    else {
      tracker.calib = { a: tracker._pickA, b: { x, y } }
      settings.camCalib = tracker.calib; saveSettings(); camPicking = null
      camStatus('Tracking — keys set')
    }
  }
  $('btnCamera').onclick = () => {
    if (!cameraOn()) { showScreen('settings'); status('Start the camera here, then find the keys'); return }
    $('camPip').classList.toggle('hidden')
  }
  refreshCameraList()
  $('openImport').onclick = openImportSheet
  $('importClose').onclick = closeImportSheet
  $('importFile').onchange = async (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) await handleImportFile(f) }
  $('impPlay').onclick = async () => { await renameImported(); closeImportSheet(); if (importedRecord) openImported(importedRecord.id) }
  $('impAnother').onclick = async () => { await renameImported(); openImportSheet() }
  $('impTitle').onchange = renameImported
  $('impArtist').onchange = renameImported
  $('btnLyrics').onclick = () => { showLyrics = !showLyrics; if (song) applySongMedia({ ...song, audio: null, cover: song.cover }); $('btnLyrics').classList.toggle('on', showLyrics) }
  // drop a song anywhere in the window
  let dragDepth = 0
  window.addEventListener('dragenter', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { dragDepth++; $('dropOverlay').classList.remove('hidden'); $('dropZone').classList.add('over') } })
  window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('dropOverlay').classList.add('hidden'); $('dropZone').classList.remove('over') } })
  window.addEventListener('dragover', (e) => e.preventDefault())
  window.addEventListener('drop', (e) => {
    e.preventDefault()
    dragDepth = 0
    $('dropOverlay').classList.add('hidden'); $('dropZone').classList.remove('over')
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]
    if (f) handleImportFile(f)
  })
  $('backingFile').onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return
    try {
      const d = await loadBackingFile(f, 'backing')
      backingName = f.name
      $('backingState').textContent = `${f.name} (${d.toFixed(1)}s)`
      status('Accompaniment attached (piano muted): ' + f.name)
    } catch (err) { status('Could not decode audio: ' + err.message) }
  }
  $('fullMixFile').onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return
    try {
      const d = await loadBackingFile(f, 'full')
      fullName = f.name
      $('fullState').textContent = `${f.name} (${d.toFixed(1)}s)`
      status('Full mix attached (used in Watch): ' + f.name)
    } catch (err) { status('Could not decode audio: ' + err.message) }
  }
  $('waitMode').value = settings.waitMode || 'pauseAndSnap'
  $('waitMode').onchange = (e) => {
    settings.waitMode = e.target.value; saveSettings()
    if (player && player.mode === 'PRACTISE') player.setAdvancement(settings.waitMode)
    status('Practise wait: ' + (settings.waitMode === 'pauseAndSnap' ? 'wait for the note' : 'pause & continue'))
  }
  const instSel = $('instrument')
  if (instSel) {
    instSel.replaceChildren()
    for (const inst of instrumentList()) {
      const o = document.createElement('option')
      o.value = inst.id; o.textContent = inst.name
      instSel.appendChild(o)
    }
    instSel.value = settings.instrument
    instSel.onchange = (e) => { settings.instrument = e.target.value; saveSettings(); setInstrument(settings.instrument); syncHudButtons(); status('Instrument: ' + e.target.selectedOptions[0].textContent) }
  }
  const kbdSel = $('kbdMode')
  if (kbdSel) {
    kbdSel.value = settings.keyboardMode
    kbdSel.onchange = (e) => setLightStyle(e.target.value)
  }
  $('userColor').value = settings.userColor
  $('userColor').oninput = (e) => { settings.userColor = e.target.value; saveSettings(); stylePreviewAt = performance.now() }
  $('userColorRow').classList.toggle('hidden', settings.keyboardMode !== 'User')
  $('exprToggle').checked = !!settings.expression
  $('mpeState').textContent = settings.expression ? 'waiting for bend/pressure…' : 'off'
  $('exprToggle').onchange = (e) => {
    settings.expression = e.target.checked
    saveSettings()
    applyDeviceMode()
    $('mpeState').textContent = settings.expression ? 'waiting for bend/pressure…' : 'off'
    status(settings.expression ? 'Pitch bend and pressure on: wiggle or press into a key' : 'Pitch bend and pressure off: keys play like a piano')
  }
  const bendSel = $('bendRange')
  if (bendSel) {
    bendSel.value = String(settings.bendRange)
    bendSel.onchange = (e) => { settings.bendRange = Number(e.target.value); saveSettings(); setBendRange(settings.bendRange); syncHudButtons(); applyDeviceMode() }
  }
  setInstrument(settings.instrument || 'grand')
  setBendRange(settings.bendRange || 12)
  $('btnInst').onclick = cycleInstrument
  $('bandToggle').checked = !!settings.band
  $('recordTakes').checked = !!settings.recordTakes
  $('recordTakes').onchange = (e) => {
    settings.recordTakes = e.target.checked
    saveSettings()
    if (!settings.recordTakes) endTake('switched off')
    status(settings.recordTakes ? 'Each run in the player is recorded to ' + TAKES_FOLDER : 'Takes are no longer recorded')
  }
  $('recPill').onclick = () => { takeDeclined = freeplay ? 'playground' : player; endTake('REC button') }
  onTakeChange(syncRecPill)
  // a take stopped by its time limit isn't followed by a new one of the same run: a song
  // left looping would otherwise be recorded 15 minutes at a time for ever
  onTakeChange((state) => { if (state && state.stopping && state.reason === 'time limit' && takeRun) takeDeclined = takeRun })
  $('bandToggle').onchange = (e) => { settings.band = e.target.checked; saveSettings(); status('Generated band ' + (settings.band ? 'on' : 'off')) }
  // show and apply the saved values (the sliders used to come back at their defaults)
  $('brightness').value = String(settings.brightness)
  $('volume').value = String(settings.volume)
  $('backingVolume').value = String(settings.backingVolume)
  $('brightness').oninput = (e) => { settings.brightness = Number(e.target.value); saveSettings(); daemon && daemon.brightness(settings.brightness) }
  $('volume').oninput = (e) => { settings.volume = Number(e.target.value); saveSettings(); setVolume(settings.volume / 100) }
  // Audio output: which device the sound goes to, and how long it takes to get there
  const outSel = $('audioOutput')
  const fillOutputs = async () => {
    const list = await listOutputs()
    outSel.replaceChildren(...list.map((o) => { const el = document.createElement('option'); el.value = o.id; el.textContent = o.label; return el }))
    // a saved output that is unplugged right now stays the choice (sound returns to it
    // when it is back); show that, so picking the default is a real change
    if (settings.audioOutput && !list.some((o) => o.id === settings.audioOutput)) {
      const el = document.createElement('option')
      el.value = settings.audioOutput; el.textContent = 'Saved output (not connected now)'
      outSel.appendChild(el)
    }
    outSel.value = settings.audioOutput || ''
  }
  outSel.onchange = async () => {
    settings.audioOutput = outSel.value
    saveSettings()
    const ok = await setOutput(settings.audioOutput)
    status(ok ? 'Sound plays on ' + outSel.selectedOptions[0].textContent : 'That output is not available, using the system default')
    setTimeout(showAudioLatency, 1500)   // the output figure settles once the device has played a moment
  }
  navigator.mediaDevices.addEventListener('devicechange', fillOutputs)
  fillOutputs()
  $('backingVolume').oninput = (e) => { settings.backingVolume = Number(e.target.value); saveSettings(); setBackingVolume(settings.backingVolume / 100) }
  // Progress and settings reset apart, each after saying what goes: settings hold the
  // keyboard's octave calibration, your light style and colour. Only progress keys go,
  // so favourites, added songs and anything else stored stay.
  const PROGRESS_KEY = /^lumi\.(best|game|lesson|lessonwatched|lessonpractised|exercise|days|streak|recent)(\.|$)/
  $('resetProgress').onclick = () => {
    if (!confirm('Reset your progress on ' + THIS_COMPUTER + '?\n\nThis erases your stars and best scores, lessons, games, Scales & chords, minutes played, your streak and recently played songs. Your settings, favourites and added songs are kept.')) return
    for (const k of Object.keys(localStorage)) if (PROGRESS_KEY.test(k)) localStorage.removeItem(k)
    location.reload()
  }
  if ($('resetSettings')) $('resetSettings').onclick = () => {
    if (!confirm('Put every setting back to its default?\n\nThis resets sound, lights, practice options, your colour and the keyboard octave calibration. Your progress is kept.')) return
    localStorage.removeItem('lumi.settings')
    location.reload()
  }
  // results actions
  $('resAgain').onclick = () => { hideResults(); cancelCeremony(); if (player) { player.restart(); } }
  $('resPractice').onclick = () => {
    hideResults()
    // Watch → Practise → Challenge (Play), and back to Practise after a Play run
    const target = lastMode === 'WATCH' ? 'PRACTISE' : lastMode === 'PRACTISE' ? 'PLAY' : 'PRACTISE'
    const lesson = lessonMeta && LESSONS.find((l) => l.id === lessonMeta.id)
    if (lesson) return startLessonStep(lesson, target)
    setMode(target)
    if (player) { player.restart() }
  }
  $('resClose').onclick = hideResults
  // progress seek / loop markers
  $('progress').onclick = (e) => {
    if (!player || !song) return
    const r = $('progress').getBoundingClientRect()
    const from = player.sectionStart || 0
    const frac = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
    player.seek(from + frac * (player.end - from))
    syncBacking()
  }
  document.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return
    // The results are a dialog: its keys never reach the player behind it (a focused
    // Play button used to restart the finished song on Space)
    if (!$('results').classList.contains('hidden')) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.key === 'Tab') return
      e.preventDefault()
      if (e.key === 'Escape') hideResults()
      else if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
        const f = document.activeElement
        const btn = f && f.tagName === 'BUTTON' && $('results').contains(f) ? f : resultsPrimary
        if (btn) btn.click()
      }
      return
    }
    if (viewMenuOpen() && handleViewMenuKey(e)) return
    if (e.key === 'Escape') {
      if (screen === 'play') showScreen(prevScreen)
      return
    }
    if (screen !== 'play') return
    if (e.code === 'Space') { e.preventDefault(); togglePlay() }
    if (e.key === '1') setMode('WATCH')
    if (e.key === '2') setMode('PRACTISE')
    if (e.key === '3') setMode('PLAY')
  })
  window.addEventListener('resize', () => { resize(); syncHudButtons(); if (viewMenuOpen()) placeViewMenu() })
  // note view picker: built from VIEW_INFO, closed by a click outside it or Escape
  buildViewMenu()
  document.addEventListener('pointerdown', (e) => {
    if (viewMenuOpen() && !$('viewMenu').contains(e.target) && !$('btnView').contains(e.target)) closeViewMenu()
  }, true)
  // a cover that fails to load is removed, so the generated art under it shows instead
  document.addEventListener('error', (e) => {
    const img = e.target
    if (!(img instanceof HTMLImageElement) || !img.classList.contains('c-img')) return
    const src = img.getAttribute('src') || ''
    if (!src.startsWith('data:')) missingCovers.add(src)
    img.remove()
  }, true)
  // UI hook for screenshots: viewmenu=1 opens the view picker once the player is up
  if (new URLSearchParams(location.search).has('viewmenu')) {
    let tries = 0
    const open = () => { if (screen === 'play' && $('btnView').offsetWidth) openViewMenu(); else if (++tries < 80) setTimeout(open, 100) }
    open()
  }
  wireFirstRunUI()
}

/* ============================== screens ============================== */
// Search has no title: its "Search here" pill sits in the middle of the top bar instead
const SCREEN_TITLES = {
  home: ['', ''], search: ['', ''], achievements: ['Achievements', 'Your progress on ' + THIS_COMPUTER],
  toolbox: ['Scales & chords', 'Pick a key, then practise it'], games: ['Games', 'Hit the notes in time, beat the pass mark'],
  settings: ['Settings', 'Lights, sound and practice']
}
let prevScreen = 'home'
function showScreen(name) {
  if (name === 'learn') name = 'search'
  closeViewMenu()
  if (name === 'play' && !song && !freeplay) {
    const r = recent()[0]
    if (r) { openLibrary(r.file); return }
  }
  if (screen === 'play' && name !== 'play') {
    endTake('left the player')
    clearNoteLights()
    if (player && player.active) { player.pause(); stopBacking(); pauseRecording() }
  }
  if (name !== 'play' && screen !== name) prevScreen = ['home', 'search', 'achievements'].includes(screen) ? screen : prevScreen
  screen = name
  document.body.dataset.screen = name
  document.body.classList.toggle('freeplay', name === 'play' && freeplay)
  for (const s of document.querySelectorAll('.screen')) s.classList.add('hidden')
  const el = $('screen-' + name)
  if (el) { el.classList.remove('hidden'); el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '' }
  for (const b of document.querySelectorAll('#nav button')) b.classList.toggle('on', b.dataset.screen === name)
  const t = SCREEN_TITLES[name]
  if (t) { $('title').textContent = t[0]; $('subtitle').textContent = t[1] }
  if (name === 'home') updateHome()
  if (name === 'settings') showAudioLatency()
  if (name === 'search') { renderLibrary(); setTimeout(() => $('search').focus(), 50) }
  if (name === 'achievements') renderAchievements()
  if (name === 'games') renderGames()
  if (name === 'toolbox') renderToolbox()
  if (name === 'settings') { refreshProgressUI(); syncKbRange() }
  if (name === 'play') { $('title').textContent = song ? song.title : freeplay ? 'Playground' : 'Play'; $('subtitle').textContent = song ? (song.artist || '') : '' }
  resize()
}

function tileAction(go) {
  if (go === 'search' || go === 'learn') return showScreen('search')
  if (go === 'freeplay') return startFreeplay()
  if (go === 'toolbox') return showScreen('toolbox')
  if (go === 'games') return showScreen('games')
}

/* ============================== achievements ============================== */
function totalStars() {
  let n = 0
  for (const k of Object.keys(localStorage)) {
    if (!/^lumi\.(best|game|lesson|exercise)\./.test(k)) continue
    if (k.endsWith('.bpm') || k.startsWith('lumi.best.lumi.')) continue   // exercise speed / duplicate of the exercise key
    const v = Number(store.get(k, 0))
    if (Number.isInteger(v) && v >= 0 && v <= 5) n += v
  }
  return n
}
function renderAchievements() {
  const days = store.get('lumi.days', {})
  const minutes = Math.round(Object.values(days).reduce((a, b) => a + b, 0) / 60)
  const songs = allSongs()
  const played = songs.filter((l) => bestFor(l.file) > 0).length
  expireStreak()
  const streak = store.get('lumi.streak.count', 0)
  const stars = totalStars()
  $('achStreak').textContent = streak
  $('achMinutes').textContent = minutes
  $('achStars').textContent = stars
  $('achSongs').textContent = played
  // this week, in local days
  const week = $('weekBars')
  week.replaceChildren()
  const today = new Date()
  const vals = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
    vals.push({ d, secs: days[dayKey(d)] || 0 })
  }
  const max = Math.max(60, ...vals.map((v) => v.secs))
  vals.forEach((v, i) => {
    const el = document.createElement('div')
    el.className = 'day' + (i === 6 ? ' today' : '')
    el.innerHTML = `<div class="bar" style="height:0%"></div><span>${v.d.toLocaleDateString(undefined, { weekday: 'short' })}</span>`
    week.appendChild(el)
    requestAnimationFrame(() => { el.querySelector('.bar').style.height = Math.max(3, (v.secs / max) * 100) + '%' })
  })
  // badges
  const lessonsDone = LESSONS.filter(lessonComplete).length
  const BADGES = [
    { name: 'First notes', sub: 'Play your first song', on: played >= 1, icon: 'i-keys' },
    { name: 'Five stars', sub: 'Get 5 stars on a song', on: songs.some((l) => bestFor(l.file) >= 5), icon: 'i-star' },
    { name: 'On a roll', sub: '3-day streak', on: streak >= 3, icon: 'i-flame' },
    { name: 'Week warrior', sub: '7-day streak', on: streak >= 7, icon: 'i-flame' },
    { name: 'Student', sub: 'Finish a lesson', on: lessonsDone >= 1, icon: 'i-check' },
    { name: 'Graduate', sub: 'Finish every lesson', on: lessonsDone === LESSONS.length, icon: 'i-trophy' },
    { name: 'Arcade', sub: 'Pass a game', on: GAMES.some((g) => gameBest(g.id) > 0), icon: 'i-trophy' },
    { name: 'Hour of music', sub: 'Play for 60 minutes', on: minutes >= 60, icon: 'i-clock' }
  ]
  const bg = $('badgeGrid')
  bg.innerHTML = BADGES.map((b) => `<div class="badge ${b.on ? 'on' : ''}"><div class="b-icon"><svg><use href="#${b.icon}"/></svg></div><div class="b-name">${b.name}</div><div class="b-sub">${b.sub}</div></div>`).join('')
  // best scores
  const bl = $('bestList')
  const rows = songs.map((l) => ({ l, b: bestFor(l.file) })).filter((x) => x.b > 0).sort((a, b) => b.b - a.b)
  bl.innerHTML = rows.length
    ? rows.map(({ l, b }) => `<div class="best-row">${itemCover(l, { showTitle: false })}<div class="br-name">${escapeHtml(l.title)}<div class="tile-sub">${escapeHtml(l.artist)}</div></div><span class="g-stars">${Array.from({ length: 5 }, (_, i) => `<svg class="${i < b ? 'on' : ''}"><use href="#i-star"/></svg>`).join('')}</span></div>`).join('')
    : '<div class="empty" style="padding:24px 0">Finish a song to see your best scores here.</div>'
}

/* ============================== library ============================== */
function recent() { return store.get('lumi.recent', []) }
function pushRecent(file) {
  const list = recent().filter((r) => r.file !== file)
  list.unshift({ file, at: Date.now() })
  store.set('lumi.recent', list.slice(0, 6))
}
function bestFor(file) { return store.get('lumi.best.' + file, 0) }

// Square cover art generated per song in the original library's style: a duotone field,
// one big shape (a rising sun, waves, a diagonal split or keys) and the title in caps along
// the top. A song's own cover image, when it has one, is laid over it (see itemCover).
const COVER_PALETTES = [
  ['#ffd1b3', '#a1006b', '#8a005c'], ['#ff8a4c', '#c2302a', '#8f1d18'], ['#c9f3ff', '#a3106f', '#7a0b53'],
  ['#ff8fc8', '#7b1fa2', '#5c1180'], ['#13213f', '#ffe08a', '#ffe08a'], ['#1f8a99', '#ffc2d4', '#ffe3ec'],
  ['#ff4b4b', '#c9f3ff', '#ffffff'], ['#7a12c4', '#ffe68a', '#ffe68a'], ['#2448d8', '#ff8a7a', '#ffd9d2'],
  ['#9ff0d0', '#123a7a', '#123a7a'], ['#ffd84d', '#2a1f8f', '#2a1f8f'], ['#d9c7ff', '#008a73', '#3b1d8f']
]
// FNV-1a with a final bit mix, so the low bits that pick the palette and shape spread out
function hashStr(str) {
  let h = 2166136261
  for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15
  return h >>> 0
}
// img: an image laid over the art; level: the teal badge; extra: more overlay markup
function coverHTML(item, { stars = 0, showTitle = true, img = null, level = null, extra = '' } = {}) {
  // each built-in song has its own palette and shape; anything else is picked by a hash
  const lib = LIBRARY.findIndex((l) => l.file === item.file)
  const h = lib >= 0 ? lib : hashStr(item.file || item.title)
  const [bg, fg, ink] = COVER_PALETTES[h % COVER_PALETTES.length]
  const kind = (lib >= 0 ? lib : h >>> 4) % 4
  const svg = (body) => `<svg class="c-art" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${body}</svg>`
  let art
  if (kind === 0) art = svg(`<circle cx="50" cy="104" r="46" fill="${fg}"/>`)
  else if (kind === 1) art = svg(`<path d="M0 66 Q25 50 50 66 T100 66 V100 H0Z" fill="${fg}"/><path d="M0 82 Q25 66 50 82 T100 82 V100 H0Z" fill="${ink}" opacity=".35"/>`)
  else if (kind === 2) art = svg(`<path d="M0 100 L100 34 V100Z" fill="${fg}"/><path d="M40 100 L100 62 V100Z" fill="${ink}" opacity=".3"/>`)
  else art = svg([18, 34, 50, 66, 82].map((x, i) => `<rect x="${x - 5}" y="${44 + (i % 2) * 10}" width="10" height="${60 - (i % 2) * 10}" rx="3" fill="${fg}"/>`).join(''))
  const title = showTitle ? `<div class="c-title" style="color:${ink}">${escapeHtml(item.title)}</div>` : ''
  const photo = img ? `<img class="c-img" src="${img}" alt="" draggable="false">` : ''
  const badge = level ? `<span class="c-level">${escapeHtml(level)}</span>` : ''
  const starRow = stars ? `<div class="c-stars" title="Best: ${stars} of 5 stars">${'<svg><use href="#i-star"/></svg>'.repeat(stars)}</div>` : ''
  return `<div class="cover" style="background:${bg}">${art}${title}${photo}${badge}${starRow}${extra}</div>`
}
const isFav = (file) => store.get('lumi.fav.' + file, false)
let searchChip = 'songs'
let sortMode = 'title'
const SORT_LABELS = { title: 'Title', level: 'Level', recent: 'Recently played' }
// Imported songs show their own cover, built-in ones their covers/ file, both over the
// generated art: a cover that fails to load is removed (wireUI) and the art shows instead.
const missingCovers = new Set()      // cover files that failed to load, not asked for again
function coverSrc(item) {
  // only validated base64 image data URLs (imported covers) and our own covers/ files go in the page
  if (isSafeCover(item.cover)) return item.cover
  return /^covers\/[\w-]+\.png$/.test(item.cover || '') && !missingCovers.has(item.cover) ? item.cover : null
}
// opts.level false hides the level badge (imported songs never have one)
function itemCover(item, opts = {}) {
  return coverHTML(item, { ...opts, img: coverSrc(item), level: opts.level === false || item.imported ? null : item.level })
}
const escapeHtml = (t) => String(t || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
function allSongs() {
  const mine = importedSongs.map((r) => ({ file: r.file, id: r.id, title: r.title, artist: r.artist || (r.source === 'audio' ? 'Recording' : 'Imported'), cover: r.cover, imported: true }))
  return [...mine, ...LIBRARY]
}
const findSong = (file) => allSongs().find((l) => l.file === file)
function openItem(item) { return item.imported ? openImported(item.id) : openLibrary(item.file) }
async function loadImportedLibrary() {
  try { importedSongs = (await listImported()).sort((a, b) => (b.added || 0) - (a.added || 0)) } catch (e) { console.log('IMPORT library unavailable: ' + e.message); importedSongs = [] }
  renderLibrary(); updateHome()
}

function coverTile(item) {
  const b = document.createElement('div')
  b.className = 'cover-tile'
  const extra = item.imported
    ? '<span class="c-badge">YOURS</span><span class="c-del" title="Remove from library"><svg><use href="#i-close"/></svg></span>'
    : ''
  const fav = isFav(item.file)
  b.innerHTML = `<button class="cover-btn">${itemCover(item, { stars: bestFor(item.file), extra })}</button>
    <div class="tile-meta"><div><div class="tile-name">${escapeHtml(item.title)}</div><div class="tile-sub">${escapeHtml(item.artist)}</div></div>
    <button class="heart ${fav ? 'on' : ''}" title="Favourite" aria-label="Favourite" aria-pressed="${fav}"><svg><use href="#i-heart"/></svg></button></div>`
  b.querySelector('.cover-btn').onclick = (e) => {
    if (e.target.closest('.c-del')) {
      e.stopPropagation()
      if (!confirm(`Remove "${item.title}" from your library?`)) return
      deleteImported(item.id).then(() => {
        localStorage.removeItem('lumi.best.' + item.file)
        localStorage.removeItem('lumi.fav.' + item.file)
        store.set('lumi.recent', recent().filter((r) => r.file !== item.file))
        return loadImportedLibrary()
      }).then(renderRecent)
      return
    }
    openItem(item)
  }
  b.querySelector('.heart').onclick = (e) => {
    e.stopPropagation()
    store.set('lumi.fav.' + item.file, !isFav(item.file))
    renderLibrary()
    renderRecent()
  }
  return b
}
// Sort: Title (A to Z), Level (easiest first, imported songs last) or Recently played
// (latest first, then the rest by title).
function sortSongs(list) {
  const byTitle = (a, b) => a.title.localeCompare(b.title)
  let rank = null
  if (sortMode === 'level') rank = (i) => { const r = LEVELS.indexOf(i.level); return r < 0 ? LEVELS.length : r }
  if (sortMode === 'recent') {
    const played = recent().map((r) => r.file)
    rank = (i) => { const r = played.indexOf(i.file); return r < 0 ? played.length : r }
  }
  return [...list].sort(rank ? (a, b) => rank(a) - rank(b) || byTitle(a, b) : byTitle)
}
function renderLibrary() {
  const grid = $('libraryGrid')
  grid.replaceChildren()
  // the Imported chip shows once there is something in it (or while it is the one chosen)
  const hasImported = importedSongs.length > 0
  let lib = allSongs().filter((i) => !searchTerm || [i.title, i.artist, i.genre, i.level].join(' ').toLowerCase().includes(searchTerm))
  if (searchChip === 'fav') lib = lib.filter((i) => isFav(i.file))
  if (searchChip === 'imported') lib = lib.filter((i) => i.imported)
  for (const item of sortSongs(lib)) grid.appendChild(coverTile(item))
  const rail = $('songRail')
  if (rail) { rail.replaceChildren(); for (const item of allSongs()) rail.appendChild(coverTile(item)) }
  const showSongs = searchChip === 'songs' || searchChip === 'fav' || searchChip === 'imported'
  grid.classList.toggle('hidden', !showSongs)
  $('lessonList').classList.toggle('hidden', searchChip !== 'lessons')
  $('searchGames').classList.toggle('hidden', searchChip !== 'games')
  $('searchEmpty').classList.toggle('hidden', !(showSongs && !lib.length))
  $('searchEmpty').textContent = searchChip === 'fav' ? 'Tap the heart on a song to keep it here.' : searchChip === 'imported' ? 'Songs you add show up here.' : 'No songs match that search.'
  for (const c of document.querySelectorAll('#searchChips button')) {
    c.classList.toggle('on', c.dataset.chip === searchChip)
    if (c.dataset.chip === 'imported') c.classList.toggle('hidden', !hasImported && searchChip !== 'imported')
  }
  $('sortLabel').textContent = SORT_LABELS[sortMode] || SORT_LABELS.title
  $('sortBtn').classList.toggle('hidden', !showSongs)
  renderToolbox()
  renderLessons()
  renderGames()
}

function renderRecent() {
  const list = $('recentList')
  list.replaceChildren()
  const items = recent()
  if (!items.length) { list.innerHTML = '<div class="empty" style="padding:20px 0">Songs you play show up here.</div>'; return }
  for (const r of items) {
    const item = findSong(r.file)
    if (item) list.appendChild(coverTile(item))
  }
}

function updateHome() {
  const hour = new Date().getHours()
  $('greeting').textContent = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  $('streakChip').textContent = store.get('lumi.streak.count', 0)
  $('minutesChip').textContent = Math.round((store.get('lumi.days', {})[todayKey()] || 0) / 60)
  const r = recent()[0]
  const item = (r && findSong(r.file)) || LIBRARY.find((l) => l.file === 'twinkle.xml')
  $('continueKicker').textContent = r ? 'Continue learning' : 'Start here'
  $('continueTitle').textContent = item.title
  const best = bestFor(item.file)
  $('continueSub').textContent = `${item.artist} · ${best ? best + ' of 5 stars' : 'Not played yet'}`
  $('continueArt').innerHTML = itemCover(item, { stars: best })
  $('continuePlay').onclick = () => openItem(item)
  $('continuePractise').onclick = () => openItem(item).then(() => setMode('PRACTISE'))
  renderRecent()
}

/* ============================== games ============================== */
const GAME_ART = {
  springboard: 'linear-gradient(200deg,#ffc2d9 0%,#f06aa5 50%,#9b1f63 100%)',
  cascade: 'radial-gradient(ellipse at 50% 120%,#2ec4b6 0%,#0d3b66 60%,#081f33 100%)',
  rainbow: 'linear-gradient(120deg,#ff6b6b,#ffce48,#3dbe74,#3d8bff,#8a5cf0)',
  superluminal: 'radial-gradient(ellipse at 50% 110%,#3b2fb8 0%,#120f3a 70%)'
}
function gameCard(g) {
  const stars = gameBest(g.id)
  const card = document.createElement('button')
  card.className = 'game-card'
  card.innerHTML = `<div class="g-art" style="background:${GAME_ART[g.id] || GAME_ART.cascade}"><div class="g-name">${g.name}</div></div>
    <div class="g-meta"><span>${g.sub} · pass ${Math.round(g.threshold * 100)}%</span>
    <span class="g-stars">${Array.from({ length: 5 }, (_, i) => `<svg class="${i < stars ? 'on' : ''}"><use href="#i-star"/></svg>`).join('')}</span></div>`
  card.onclick = () => startGame(g)
  return card
}
function renderGames() {
  for (const id of ['gameList', 'searchGames']) {
    const wrap = $(id)
    if (!wrap) continue
    wrap.replaceChildren()
    for (const g of GAMES) if (!searchTerm || g.name.toLowerCase().includes(searchTerm)) wrap.appendChild(gameCard(g))
  }
}

async function startGame(g) {
  try {
    const res = await fetch('songs/' + g.file)
    if (!res.ok) throw new Error('HTTP ' + res.status)
    song = await loadSongFile({ name: g.file, text: () => res.text() })
    const meta = LIBRARY.find((l) => l.file === g.file) || {}
    song.file = g.file
    song.title = meta.title || song.title
    song.artist = meta.artist || ''
    resetSession({ game: { id: g.id, name: g.name, threshold: g.threshold, rate: g.rate } })
    player = new Player({ getCtx: audioContext, onState: onPlayerState, onJudgement: onJudgement, onFinish: onFinish })
    loadIntoPlayer(song)
    player.setCountIn(settings.countIn)
    player.setMetronome(settings.metronome)
    player.setView(settings.view)
    player.setNoteLabels(settings.labels)
    player.setHandFilter('both')      // a level is played with both hands, whatever Hands is set to
    player.setMode('PLAY')
    player.setRate(g.rate)
    bandEvents = computeBand(song); resetBand(0)
    showScreen('play')
    $('title').textContent = g.name
    $('subtitle').textContent = 'Arcade · ' + (g.rate !== 1 ? Math.round(g.rate * 100) + '% speed · ' : '') + 'pass mark ' + Math.round(g.threshold * 100) + '%'
    syncHudButtons(); resize()
    status('Game ready — press Play. Score above ' + Math.round(g.threshold * 100) + '% to pass.')
  } catch (e) { status('Could not start game: ' + e.message) }
}

/* ============================== lessons ============================== */
function lessonStepKey(lessonId, step) { return `lumi.lesson.${lessonId}.${step}` }
function lessonStepStars(lessonId, step) { return store.get(lessonStepKey(lessonId, step), 0) }
function lessonComplete(lesson) { return lessonStepStars(lesson.id, 'PLAY') >= 2 }
// Watch and Practise keep no stars: each is just done or not (stored apart from star
// ratings; Practise runs from older versions may still have stars).
const watchedKey = (lessonId) => `lumi.lessonwatched.${lessonId}`
const practisedKey = (lessonId) => `lumi.lessonpractised.${lessonId}`
function lessonStepDone(lessonId, step) {
  const flag = step === 'WATCH' ? watchedKey(lessonId) : step === 'PRACTISE' ? practisedKey(lessonId) : null
  return (!!flag && !!store.get(flag, false)) || lessonStepStars(lessonId, step) > 0
}
function lessonUnlocked(index) { return index === 0 || lessonComplete(LESSONS[index - 1]) }

// fallback art for a lesson whose song is not in LIBRARY (every built-in lesson's song is)
const LESSON_ART = [
  'linear-gradient(135deg,#3d8bff,#0064c8)', 'linear-gradient(135deg,#00a482,#0a5c52)',
  'linear-gradient(135deg,#ff5c8a,#a1006b)', 'linear-gradient(135deg,#f5be27,#ff8a3d)',
  'linear-gradient(135deg,#8a5cf0,#3b32c5)'
]
const lessonArt = (lesson, idx) => {
  const item = LIBRARY.find((l) => l.file === lesson.file)
  return item ? itemCover(item, { level: false }) : `<div class="cover" style="background:${LESSON_ART[idx % LESSON_ART.length]}"></div>`
}
const stepLabel = (step) => (step === 'PLAY' ? 'Challenge' : step === 'PRACTISE' ? 'Practise' : 'Watch')
// The step to open when a lesson card is tapped: the first one not done yet.
function nextLessonStep(lesson) {
  return LESSON_STEPS.find((st) => !lessonStepDone(lesson.id, st)) || 'PLAY'
}
function renderLessons() {
  const wrap = $('lessonList')
  if (!wrap) return
  wrap.replaceChildren()
  const list = searchTerm
    ? LESSONS.filter((l) => (l.title + ' ' + l.sub).toLowerCase().includes(searchTerm))
    : LESSONS
  list.forEach((lesson) => {
    const idx = LESSONS.indexOf(lesson)
    const unlocked = lessonUnlocked(idx)
    const card = document.createElement('div')
    card.className = 'lesson-card' + (unlocked ? '' : ' locked')
    const steps = LESSON_STEPS.map((step) => {
      const stars = step === 'WATCH' ? 0 : lessonStepStars(lesson.id, step)
      const done = lessonStepDone(lesson.id, step)
      const mark = step === 'WATCH' ? (done ? '✓' : '') : (stars ? '★'.repeat(stars) : '')
      return `<button class="step ${done ? 'done' : ''}" data-step="${step}">${stepLabel(step)}<span class="st-stars">${mark}</span></button>`
    }).join('')
    card.innerHTML = `<div class="lc-art">${lessonArt(lesson, idx)}</div><div class="lc-body">
      <div class="lesson-head"><div class="lesson-title">${idx + 1}. ${lesson.title}</div><div>${lessonComplete(lesson) ? '<svg class="done"><use href="#i-check"/></svg>' : unlocked ? '' : '<svg><use href="#i-lock"/></svg>'}</div></div>
      <div class="lesson-sub">${lesson.sub}</div>
      <div class="lesson-steps">${steps}</div>
      <div class="lesson-progress">${lessonComplete(lesson) ? 'Completed' : unlocked ? 'Next up' : 'Finish the previous lesson to unlock'}</div></div>`
    card.querySelectorAll('button.step').forEach((b) => {
      b.onclick = () => { if (unlocked) startLessonStep(lesson, b.dataset.step) }
    })
    wrap.appendChild(card)
  })
  const rail = $('lessonRail')
  if (!rail) return
  rail.replaceChildren()
  let done = 0
  LESSONS.forEach((lesson, idx) => {
    const unlocked = lessonUnlocked(idx)
    if (lessonComplete(lesson)) done++
    const t = document.createElement('button')
    t.className = 'lesson-tile' + (unlocked ? '' : ' locked')
    const steps = LESSON_STEPS.map((st) => `<i class="${lessonStepDone(lesson.id, st) ? 'done' : ''}"></i>`).join('')
    t.innerHTML = `<div class="l-art">${lessonArt(lesson, idx)}${unlocked ? '' : '<span class="l-lock"><svg><use href="#i-lock"/></svg></span>'}</div>
      <div class="l-body"><div class="l-num">LESSON ${idx + 1}</div><div class="l-title">${lesson.title}</div><div class="l-sub">${unlocked ? (lessonComplete(lesson) ? 'Completed' : 'Next: ' + stepLabel(nextLessonStep(lesson))) : 'Locked'}</div><div class="l-steps">${steps}</div></div>`
    t.onclick = () => { if (unlocked) startLessonStep(lesson, nextLessonStep(lesson)); else status('Finish lesson ' + idx + ' to unlock this one') }
    rail.appendChild(t)
  })
  if ($('pathNote')) $('pathNote').textContent = `${done} of ${LESSONS.length} lessons complete`
}

async function startLessonStep(lesson, step) {
  try {
    const res = await fetch('songs/' + lesson.file)
    if (!res.ok) throw new Error('HTTP ' + res.status)
    song = await loadSongFile({ name: lesson.file, text: () => res.text() })
    const meta = LIBRARY.find((l) => l.file === lesson.file) || {}
    song.file = lesson.file
    song.title = meta.title || song.title
    song.artist = meta.artist || ''
    resetSession({ lesson: { id: lesson.id, step } })
    player = new Player({ getCtx: audioContext, onState: onPlayerState, onJudgement: onJudgement, onFinish: onFinish })
    loadIntoPlayer(song)
    player.setCountIn(settings.countIn)
    player.setMetronome(settings.metronome)
    player.setView(settings.view)
    player.setNoteLabels(settings.labels)
    player.setHandFilter('both')      // lessons are played with both hands, whatever Hands is set to
    player.setMode(step)
    if (step === 'PRACTISE') { player.setAdvancement(settings.waitMode || 'pauseAndSnap'); player.setRate(0.75) }
    else player.setRate(1)
    // the lesson's section plays once, then the step ends with a result
    player.setSection(lesson.from, lesson.to)
    // from here on a mode change makes this run that step (set up only now: a new
    // player starts in Play)
    player.onState = (ev) => { onPlayerState(ev); syncLessonStep() }
    showScreen('play')
    $('title').textContent = lesson.title
    $('subtitle').textContent = lessonSubtitle(step, player.rate)
    syncHudButtons(); resize(); status('Lesson: press Play')
  } catch (e) { status('Could not start lesson: ' + e.message) }
}

// The subtitle under a lesson's title: the step, and its speed when not full speed.
const lessonSubtitle = (step, rate) => stepLabel(step) + (step !== 'WATCH' && Math.abs((rate || 1) - 1) > 1e-3 ? ' · ' + Math.round(rate * 100) + '%' : '')
// The mode can change during a step (the speed track, or keys 1-3): the run then
// counts as the step actually played, so its result is kept where it belongs.
function syncLessonStep() {
  if (!lessonMeta || !player) return
  lessonMeta.step = player.mode
  const sub = lessonSubtitle(player.mode, player.rate)
  if (screen === 'play' && $('subtitle').textContent !== sub) $('subtitle').textContent = sub
}

/* ============================== toolbox exercises ============================== */
function exerciseKey() { return `lumi.exercise.${tb.type}.${tb.tonic}.${tb.hand}` }
function exerciseStars() { return store.get(exerciseKey(), 0) }

function renderToolbox() {
  const tonicWrap = $('tbTonic')
  if (!tonicWrap) return
  tonicWrap.replaceChildren()
  TONICS.forEach((name, i) => {
    const b = document.createElement('button')
    b.textContent = name
    b.classList.toggle('on', tb.tonic === i)
    b.onclick = () => { tb.tonic = i; renderToolbox() }
    tonicWrap.appendChild(b)
  })
  for (const b of document.querySelectorAll('#tbType button')) {
    b.classList.toggle('on', b.dataset.t === tb.type)
    b.onclick = () => { tb.type = b.dataset.t; renderToolbox() }
  }
  for (const b of document.querySelectorAll('#tbHand button')) {
    b.classList.toggle('on', b.dataset.h === tb.hand)
    b.onclick = () => { tb.hand = b.dataset.h; renderToolbox() }
  }
  $('tbStart').onclick = startExercise
  const scaleName = tb.type === 'scale' ? 'major scale' : 'major chord'
  $('tbInfo').textContent = `${TONICS[tb.tonic]} ${scaleName} · ${tb.hand === 'both' ? 'both hands' : tb.hand + ' hand'}`
  const stars = exerciseStars()
  $('tbStars').textContent = '★'.repeat(stars) + '☆'.repeat(Math.max(0, 5 - stars))
  // the notes you'll play, in order
  const notesEl = $('tbNotes')
  if (notesEl) {
    const steps = tb.type === 'scale' ? SCALE_STEPS : CHORD_STEPS
    notesEl.innerHTML = steps.map((st, i) => `<span class="tb-note" style="animation-delay:${i * 0.04}s;background:${COLORS.playground[(tb.tonic + st) % 12]}">${TONICS[(tb.tonic + st) % 12]}</span>`).join('')
  }
}

function makeExerciseSong() {
  const steps = tb.type === 'scale' ? SCALE_STEPS : CHORD_STEPS
  const seq = [...steps, ...[...steps].slice(0, -1).reverse()]
  const interval = 0.5                // one note a beat at 120 BPM
  // the left hand plays an octave below the right
  const part = (hand, t0) => seq.map((step, i) => ({
    pitch: (hand === 'left' ? 48 : 60) + tb.tonic + step, start: t0 + i * interval, dur: interval * 0.85, vel: 100, hand
  }))
  let notes = part(tb.hand === 'left' ? 'left' : 'right', 0)
  let windows = null
  let hands = tb.hand + ' hand'
  if (tb.hand === 'both') {
    notes = [...part('left', 0), ...part('right', 0)].sort((a, b) => a.start - b.start)
    // Hands together needs both octaves on the 24 keys at once. A one-octave scale
    // or arpeggio an octave apart spans 25, so it is played left hand, then right
    // hand, and the keys move up an octave in the bar's rest between the two.
    const pitches = notes.map((n) => n.pitch)
    const lo = Math.min(...pitches), hi = Math.max(...pitches)
    if (hi < Math.floor(lo / 12) * 12 + 24) hands = 'both hands'
    else {
      const leftEnd = seq.length * interval
      notes = [...part('left', 0), ...part('right', leftEnd + 4 * interval)]
      windows = [{ at: 0 }, { at: leftEnd }]
      hands = 'left, then right'
    }
  }
  assignFingering(notes, { tempo: 120 })   // the notes are 0.5 s apart
  return {
    title: `${TONICS[tb.tonic]} ${tb.type === 'scale' ? 'scale' : 'chord'} · ${hands}`,
    notes,
    windows,
    duration: notes[notes.length - 1].start + interval,
    tempo: 60 / interval,           // the count-in and the click agree with the notes
    artist: 'Exercise'
  }
}

function startExercise() {
  initAudio()
  resetSession({ exercise: { type: tb.type, tonic: tb.tonic, hand: tb.hand } })
  song = makeExerciseSong()
  song.file = exerciseKey()
  // a left-then-right exercise moves the keyboard up for the right hand (and back on a restart)
  const onWindow = (start) => { if (song) song.fitStart = start; setKeyboardWindow(start) }
  player = new Player({ getCtx: audioContext, onState: onPlayerState, onJudgement: onJudgement, onFinish: onFinish, onWindow })
  loadIntoPlayer(song)
  player.setMode('PRACTISE')
  player.setAdvancement(settings.waitMode || 'pauseAndSnap')
  player.setCountIn(settings.countIn)
  player.setMetronome(settings.metronome)
  player.setView(settings.view)
  player.setNoteLabels(settings.labels)
  player.setHandFilter(tb.hand === 'both' ? 'both' : tb.hand)
  showScreen('play')
  $('title').textContent = song.title
  $('subtitle').textContent = 'Toolbox exercise'
  syncHudButtons(); resize()
  status(song.windows ? 'Left hand first, then the keys move up for the right — press Play' : 'Exercise ready — press Play')
}

/* ============================== song loading ============================== */
async function openLibrary(file) {
  try {
    const res = await fetch('songs/' + file)
    if (!res.ok) throw new Error('HTTP ' + res.status)
    song = await loadSongFile({ name: file, text: () => res.text() })
    const meta = LIBRARY.find((l) => l.file === file) || {}
    song.file = file
    song.title = meta.title || song.title
    song.artist = meta.artist || ''
    pushRecent(file)
    startSong()
  } catch (e) { status('Could not load song: ' + e.message) }
}

async function openImported(id) {
  try {
    const rec = await getImported(id)
    if (!rec) { status('That song is no longer in your library'); return loadImportedLibrary() }
    song = { title: rec.title, artist: rec.artist, notes: rec.notes, duration: rec.duration, tempo: rec.tempo,
      timeSignature: rec.timeSignature || null, parts: rec.parts || null, bars: rec.bars || null,
      cover: rec.cover, lyrics: rec.lyrics, lyricsFromFile: rec.lyricsFromFile, audio: rec.audio, source: rec.source, file: rec.file, importedId: rec.id }
    pushRecent(rec.file)
    startSong()
  } catch (e) { status('Could not open song: ' + e.message) }
}

async function openFile(file) {
  try {
    song = await loadSongFile(file)
    song.file = file.name
    song.artist = song.artist || 'Imported'   // a score's composer beats the placeholder
    startSong()
  } catch (e) { status('Could not read song: ' + e.message) }
}

// Every song, lesson, game or exercise start clears what the last one left behind:
// free play, game/lesson/exercise state and any light ceremony still running.
function resetSession({ exercise = null, lesson = null, game = null } = {}) {
  endTake('another song')
  takeDeclined = null
  mediaToken++
  unloadRecording()            // the last song's recording; stems attached in Settings stay
  stopBacking()
  recordingEpoch = -1
  backingEpoch = -1
  backdropImg = null
  $('lyrics').classList.add('hidden')
  $('btnLyrics').classList.add('hidden')
  freeplay = false
  exerciseMeta = exercise
  lessonMeta = lesson
  gameMeta = game
  cancelCeremony()
  hideResults()
}

// Load a song and move the keyboard's octave to the song's 24-key window.
function loadIntoPlayer(song) {
  scheduler.reset()
  player.load(song)
  song.fitStart = player.windowStart
  setKeyboardWindow(song.fitStart)
  song.handCounts = player.handCounts()     // notes per hand on the 24 keys: Hands skips an empty one
  if (settings.rate && settings.rate !== 1) player.setRate(settings.rate)
}

function startSong() {
  resetSession()
  initAudio()
  applySongMedia(song)
  player = new Player({
    getCtx: audioContext,
    onState: onPlayerState,
    onJudgement: onJudgement,
    onFinish: onFinish
  })
  loadIntoPlayer(song)
  player.setCountIn(settings.countIn)
  player.setMetronome(settings.metronome)
  player.setView(settings.view)
  player.setNoteLabels(settings.labels)
  // Hands stays as you set it, but a song without that hand's part opens with both
  const missing = settings.hands !== 'both' && !!song.handCounts && !song.handCounts[settings.hands]
  player.setHandFilter(missing ? 'both' : settings.hands)
  player.setAdvancement(settings.waitMode || 'pauseAndSnap')
  bandEvents = computeBand(song); resetBand(0)
  showScreen('play')
  $('title').textContent = song.title
  $('subtitle').textContent = `${song.artist || ''} · ${song.notes.length} notes`
  syncHudButtons()
  resize()
  status(missing ? noHandPart(settings.hands) : song.source === 'audio' ? 'Ready — the recording plays along. Press Play' : 'Ready — press Play')
}

// An imported recording plays along (in sync with the song clock), its cover
// sits behind the notes, and time-synced lyrics scroll at the top.
function applySongMedia(s) {
  if (s.audio) {
    const tok = mediaToken
    loadRecording(s.audio)
      .then((ok) => {
        if (!ok || tok !== mediaToken) return
        // the recording now plays the song: cancel the stand-in piano and start it
        recordingEpoch = -1
        scheduler.reset()
        syncRecording()
      })
      .catch((e) => status('Could not play the recording: ' + e.message))
  }
  if (isSafeCover(s.cover)) {
    const img = new Image()
    img.src = s.cover
    backdropImg = img
  }
  const synced = s.lyrics && s.lyrics.synced && s.lyrics.synced.length && (s.source === 'audio' || s.lyricsFromFile)
  $('btnLyrics').classList.toggle('hidden', !synced)
  $('lyrics').classList.toggle('hidden', !(synced && showLyrics))
  lyricIndex = -2
}

// Keep the recording on the song clock: restart it at every transport change
// (play, pause, seek, wait, loop, speed), starting exactly when the clock does.
function syncRecording() {
  if (!player) return
  if (hasRecording()) {
    if (player.epoch !== recordingEpoch) {
      recordingEpoch = player.epoch
      pauseRecording()
      if (player.clockRunning) {
        // stop exactly at the next wait, loop end or section end
        const until = Math.min(player.nextWaitTime(), player.loop.on && player.loop.b != null ? player.loop.b : Infinity, player.end)
        playRecording(Math.max(0, player._anchorPos), player.rate, player._anchorAt, until)
      }
    } else if (player.clockRunning && player.now() > player._anchorAt + 0.3) {
      // media elements drift a little: pull it back when it's audibly off
      const at = recordingPosition()
      const want = player.renderPosition()
      if (at != null && Math.abs(at - want) > 0.08) nudgeRecording(want)
    }
    return
  }
  if (!hasBacking() || player.epoch === backingEpoch) return
  backingEpoch = player.epoch
  stopBacking()
  if (player.clockRunning) playBacking(Math.max(0, player._anchorPos), player.rate, player.mode === 'WATCH', player._anchorAt)
}

let lyricIndex = -2
function updateLyrics(pos) {
  const lines = song && song.lyrics && song.lyrics.synced
  if (!lines || $('lyrics').classList.contains('hidden')) return
  // show a line a moment before it is sung
  let i = -1
  for (let k = 0; k < lines.length; k++) { if (lines[k].t <= pos + 0.25) i = k; else break }
  if (i === lyricIndex) return
  lyricIndex = i
  const now = $('lyNow')
  now.textContent = i >= 0 ? lines[i].text : ''
  $('lyNext').textContent = lines[i + 1] ? lines[i + 1].text : ''
  now.classList.remove('swap'); void now.offsetWidth; now.classList.add('swap')
}

/* ============================== hand tracking ============================== */
let tracker = null
let camPicking = null       // manual calibration: null, 'a' (left key), 'b' (right key)
const camStatus = (t) => { const el = $('camStatus'); if (el) el.textContent = t }

async function refreshCameraList() {
  try {
    const cams = await listCameras()
    const sel = $('camSelect')
    sel.innerHTML = '<option value="">Default camera</option>' + cams.map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.label)}</option>`).join('')
    sel.value = settings.camId || ''
  } catch (_e) {}
}

async function startCamera() {
  tracker = tracker || new HandTracker()
  tracker.onEnded = () => { stopCamera(); camStatus('Camera disconnected'); status('The camera disconnected') }
  tracker.mirror = !!settings.camMirror
  if (settings.camCalib) tracker.calib = settings.camCalib
  camStatus('Starting…')
  try {
    await tracker.start(settings.camId || undefined)
    camStatus(tracker.calib ? 'Tracking' : 'Tracking — now find the keys')
    $('camToggle').textContent = 'Stop camera'
    $('camEmpty').classList.add('hidden')
    $('btnCamera').classList.add('on')
    refreshCameraList()   // labels appear once permission is granted
    console.log('HANDS camera started')
  } catch (e) {
    camStatus('Camera unavailable: ' + e.message)
    console.log('HANDS camera failed: ' + e.message)
  }
}
function stopCamera() {
  if (tracker) tracker.stop()
  $('camToggle').textContent = 'Start camera'
  $('camEmpty').classList.remove('hidden')
  $('btnCamera').classList.remove('on')
  $('camPip').classList.add('hidden')
  camStatus('Off')
}
const cameraOn = () => !!(tracker && tracker.running)

// Light one key (or none) so the camera can find it.
function lightKey(i) {
  if (!daemon || !daemon.ready) return
  const f = Array.from({ length: 24 }, () => [0, 0, 0])
  if (i != null) f[i] = [255, 255, 255]
  daemon.send(f)
}
// Settings → Test lights. (The keyboard's own buttons are handled in initDaemon.)
function wireKeysUI() {
  $('testLights').onclick = runLightTest
}
// A light runs up the keys in a colour per note and back down in white (2 s), then two
// all-off frames clear any light left stuck on.
const LIGHT_TEST_STEP_MS = 40
function lightTestFrames(base = kbBase()) {
  const steps = 2000 / LIGHT_TEST_STEP_MS
  const frames = []
  for (let f = 0; f < steps; f++) {
    const t = f / (steps - 1)
    const x = (t <= 0.5 ? t * 2 : 2 - t * 2) * 23
    frames.push(Array.from({ length: 24 }, (_, i) => {
      const k = Math.max(0, 1 - Math.abs(i - x) / 2.2)
      return k > 0 ? dimRgb(t <= 0.5 ? stageRgb(base + i) : [255, 255, 255], k) : [0, 0, 0]
    }))
  }
  const off = Array.from({ length: 24 }, () => [0, 0, 0])
  return [...frames, off, off]
}
// The test owns the keys like a ceremony does, so the frame loop waits, then puts the
// current picture back. A key still marked as held (its note-off got lost) is let go too.
function runLightTest() {
  if (IS_WIN && !(daemon && daemon.ready)) { runMidiLightTest(); return }
  if (!daemon || !daemon.ready) {
    // without the light service the keyboard lights keys from MIDI notes: switch those off
    if (midiOutput) { clearLights(midiOutput); litNotes.clear() }
    status(daemonState === 'no-device' ? 'The light service has not found your keyboard: check it is plugged in over USB and switched on'
      : 'The light service is not running, so the lights cannot be tested')
    return
  }
  // camera set-up lights one key at a time to find them; a sweep would spoil it
  if (performance.now() < ledOverrideUntil && !ceremonyTimers.length) { status('The keys are busy with the camera. Try again in a moment'); return }
  cancelCeremony()
  held.clear(); letGoAt.clear()
  const frames = lightTestFrames()
  const sweep = frames.length - 2
  const at = (i) => (i < sweep ? i * LIGHT_TEST_STEP_MS : sweep * LIGHT_TEST_STEP_MS + (i - sweep) * 150)
  const done = at(frames.length - 1) + 150
  ledOverrideUntil = performance.now() + done + 100
  ceremonyTimers = frames.map((fr, i) => setTimeout(() => { if (daemon && daemon.ready) daemon.send(fr) }, at(i)))
  ceremonyTimers.push(setTimeout(() => {
    ledOverrideUntil = 0
    if (daemon) daemon.lastSig = ''      // resend the current picture even if it matches the last frame
    status('Light test done: every key should have lit up, and stuck lights are cleared')
  }, done))
  // the button comes back on its own timer: a ceremony that cuts the test short clears the others
  const btn = $('testLights')
  btn.disabled = true
  btn.textContent = 'Testing…'
  setTimeout(() => { btn.disabled = false; btn.textContent = 'Test lights' }, done)
  status('Testing the lights: a light runs across every key and back')
}
async function autoCalibrate() {
  if (!cameraOn()) { status('Start the camera first'); return }
  if (IS_WIN && !(daemon && daemon.ready)) { status('Finding the keys needs colour key lights, which Windows does not have yet: use Click the end keys'); return }
  if (!daemon || !daemon.ready) { status('The keyboard lights are needed to find the keys'); return }
  cancelCeremony()
  ledOverrideUntil = performance.now() + 4000
  camStatus('Finding the keys…')
  const ok = await tracker.autoCalibrate(lightKey)
  ledOverrideUntil = 0
  if (ok) { settings.camCalib = tracker.calib; saveSettings(); camStatus('Tracking — keys found'); status('Found the keyboard in the camera') }
  else camStatus('Could not see the lit keys — try "Click the end keys"')
}

// Draw the camera picture with the hands and the calibrated key row on top.
function drawCamera(canvas) {
  if (!cameraOn() || !canvas) return
  const v = tracker.video
  if (!v.videoWidth) return
  const r = canvas.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  if (canvas.width !== Math.round(r.width * dpr)) { canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr) }
  const g = canvas.getContext('2d')
  const W = canvas.width, H = canvas.height
  g.save()
  if (tracker.mirror) { g.translate(W, 0); g.scale(-1, 1) }
  g.drawImage(v, 0, 0, W, H)
  const P = (p) => [p.x * W, p.y * H]
  if (tracker.calib) {
    const [ax, ay] = P(tracker.calib.a), [bx, by] = P(tracker.calib.b)
    g.strokeStyle = 'rgba(244,239,231,.8)'; g.lineWidth = 2 * dpr; g.setLineDash([6 * dpr, 5 * dpr])
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); g.setLineDash([])
    for (const [x, y] of [[ax, ay], [bx, by]]) { g.fillStyle = '#f5be27'; g.beginPath(); g.arc(x, y, 5 * dpr, 0, Math.PI * 2); g.fill() }
  }
  for (const h of tracker.hands) {
    const col = h.side === 'left' ? COLORS.hand.left : COLORS.hand.right
    g.strokeStyle = col; g.lineWidth = 2.5 * dpr
    for (const [i, j] of BONES) { const [x1, y1] = P(h.points[i]), [x2, y2] = P(h.points[j]); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke() }
    TIPS.forEach((idx) => { const [x, y] = P(h.points[idx]); g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, 4.5 * dpr, 0, Math.PI * 2); g.fill() })
  }
  g.restore()
}

// Fingers over the on-screen keys: { pitch -> { side, finger } }, from the camera.
function fingerHover(geo) {
  const out = new Map()
  if (!cameraOn() || !tracker.calib || !geo || !geo.keys || !geo.keys.length) return out
  const k0 = geo.keys[0], kN = geo.keys[geo.keys.length - 1]
  for (const f of tracker.fingertipsOverKeys()) {
    const x = k0.cx + f.t * (kN.cx - k0.cx)
    // nearest key; a black key only when the tip is close to its centre
    let best = null, bestD = Infinity
    for (const k of geo.keys) {
      const d = Math.abs(k.cx - x) * (k.black ? 1.6 : 1)
      if (d < bestD) { bestD = d; best = k }
    }
    if (best && !out.has(best.pitch)) out.set(best.pitch, { side: f.side, finger: f.finger, cx: best.farCx != null ? best.farCx : best.cx })
  }
  return out
}
function drawFingerBadges(g, geo, hover) {
  for (const [, h] of hover) {
    const x = h.cx, y = geo.kbTop - 18
    g.fillStyle = h.side === 'left' ? COLORS.hand.left : COLORS.hand.right
    g.beginPath(); g.arc(x, y, 11, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#141312'; g.font = '700 12px Outfit, system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'
    g.fillText(String(h.finger), x, y + 0.5)
  }
}

/* ============================== add a song ============================== */
let importedRecord = null
function openImportSheet() {
  $('importSheet').classList.remove('hidden')
  $('impProgress').classList.add('hidden')
  $('impResult').classList.add('hidden')
  $('dropZone').classList.remove('hidden')
}
function closeImportSheet() { $('importSheet').classList.add('hidden') }

async function handleImportFile(file) {
  if (!file) return
  // a lyrics file attaches to the song that's open
  if (isLyricsFile(file)) {
    const lines = parseLrc(await file.text())
    if (!lines.length) { status('That file has no timed lyric lines ([mm:ss] stamps), so nothing was changed'); return }
    const lyrics = { synced: lines }
    // the song just added in the sheet, otherwise the song that's open
    const sheetOpen = !$('importSheet').classList.contains('hidden') && importedRecord
    const targetId = sheetOpen ? importedRecord.id : song && song.importedId
    if (!sheetOpen && !song) { status('Open a song first, then drop its .lrc lyrics'); return }
    if (!sheetOpen) {
      song.lyrics = lyrics
      song.lyricsFromFile = true
      applySongMedia({ ...song, audio: null })
    }
    if (targetId) {
      const rec = await getImported(targetId)
      if (rec) {
        const saved = await saveImported({ ...rec, lyrics, lyricsFromFile: true })
        if (sheetOpen) { importedRecord = saved; showImportResult(saved) }
      }
    }
    status(`Lyrics added: ${lines.length} lines`)
    return
  }
  openImportSheet()
  $('dropZone').classList.add('hidden')
  $('impProgress').classList.remove('hidden')
  const setStage = (text, frac) => {
    $('impStage').textContent = text + (frac > 0.04 && frac < 1 ? ` · ${Math.round(frac * 100)}%` : '')
    $('impBar').style.width = Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%'
  }
  try {
    const t0 = performance.now()
    const imported = await importFile(file, {
      ctx: initAudio(), simplify: $('impSimplify').checked, lookup: $('impLookup').checked, onStage: setStage
    })
    importedRecord = await saveImported(imported)
    console.log(`IMPORT ${imported.source} "${imported.title}" notes=${imported.notes.length} tempo=${imported.tempo} cover=${!!imported.cover} lyrics=${imported.lyrics ? (imported.lyrics.synced ? 'synced' : 'plain') : 'none'} in ${((performance.now() - t0) / 1000).toFixed(1)}s`)
    await loadImportedLibrary()
    showImportResult(importedRecord)
  } catch (e) {
    console.log('IMPORT failed: ' + e.message)
    $('impProgress').classList.add('hidden')
    $('dropZone').classList.remove('hidden')
    status('Could not add that song: ' + e.message)
  }
}

function showImportResult(rec) {
  $('impProgress').classList.add('hidden')
  $('impResult').classList.remove('hidden')
  $('impCover').innerHTML = itemCover({ ...rec, cover: rec.cover })
  $('impTitle').value = rec.title || ''
  $('impArtist').value = rec.artist || ''
  const secs = Math.round(rec.duration || 0), mins = Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0')
  const lyr = rec.lyrics ? (rec.lyrics.synced ? 'synced lyrics' : 'lyrics (not timed)') : 'no lyrics found'
  $('impMeta').innerHTML = `${rec.notes.length} notes · ${mins} · ${Math.round(rec.tempo)} bpm<br>${rec.cover ? 'Cover found' : 'No cover found'} · ${lyr}${rec.source === 'audio' ? '<br>The recording plays along while you play.' : ''}`
}

async function renameImported() {
  if (!importedRecord) return
  const title = $('impTitle').value.trim() || importedRecord.title
  const artist = $('impArtist').value.trim()
  if (title === importedRecord.title && artist === importedRecord.artist) return
  importedRecord = await saveImported({ ...importedRecord, title, artist })
  await loadImportedLibrary()
}

/* ============================== free play ============================== */
// The keyboard firmware's own 19 scales, in its order (12-bit masks: bit n =
// n semitones above the root), as documented by the GRAB project from ROLI
// Dashboard's Scale.littlefoot.
const SCALES = [
  ['Major', 0xab5], ['Minor', 0x5ad], ['Harmonic minor', 0x9ad], ['Pentatonic neutral', 0x4a5],
  ['Pentatonic major', 0x295], ['Pentatonic minor', 0x4a9], ['Blues', 0x4e9], ['Dorian', 0x6ad],
  ['Phrygian', 0x5ab], ['Lydian', 0xad5], ['Mixolydian', 0x6b5], ['Locrian', 0x56b],
  ['Whole tone', 0x555], ['Arabic A', 0xb6d], ['Arabic B', 0x575], ['Japanese', 0x8d1],
  ['Ryukyu', 0x8b1], ['8-tone Spanish', 0x57b], ['Chromatic', 0xfff]
]
const NOTE_PCS = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B']
let freeRoot = 0, freeScaleIdx = 0
let held = new Set()
const freeScalePcs = () => Array.from({ length: 12 }, (_, i) => i).filter((st) => (SCALES[freeScaleIdx][1] >> st) & 1).map((st) => (st + freeRoot) % 12)
const freeScaleLabel = () => `${NOTE_PCS[freeRoot]} ${SCALES[freeScaleIdx][0].toLowerCase()}`

// Chord names. A template is a chord's notes above its root (a 12-bit mask), listed common
// to rare, so a set that reads two ways with neither root in the bass takes the commoner
// name (E G A C is Am7/E, not C6/E).
const CHORD_TEMPLATES = [
  ['', 0, 4, 7], ['m', 0, 3, 7], ['7', 0, 4, 7, 10], ['m7', 0, 3, 7, 10], ['maj7', 0, 4, 7, 11],
  ['dim', 0, 3, 6], ['aug', 0, 4, 8], ['sus4', 0, 5, 7], ['sus2', 0, 2, 7], ['6', 0, 4, 7, 9],
  ['m6', 0, 3, 7, 9], ['m7♭5', 0, 3, 6, 10], ['dim7', 0, 3, 6, 9], ['9', 0, 2, 4, 7, 10],
  ['add9', 0, 2, 4, 7], ['m(maj7)', 0, 3, 7, 11], ['5', 0, 7]
].map(([suffix, ...steps]) => ({ suffix, mask: steps.reduce((m, st) => m | (1 << st), 0) }))
const INTERVAL_NAMES = ['octave', 'minor second', 'major second', 'minor third', 'major third', 'perfect fourth',
  'tritone', 'perfect fifth', 'minor sixth', 'major sixth', 'minor seventh', 'major seventh']

// Name what is held: one note by its name, two by their interval (C and the C above are an
// octave), more as a chord with the lowest note as its root when that reads as a chord, else
// as a slash chord over the bass (E G C is C/E). spell(pc) names a pitch class.
function chordName(pitches, spell = (pc) => NOTE_PCS[pc]) {
  const notes = [...new Set(pitches)].sort((a, b) => a - b)
  if (!notes.length) return ''
  if (notes.length === 2) return INTERVAL_NAMES[(notes[1] - notes[0]) % 12]
  const pcs = [...new Set(notes.map((p) => ((p % 12) + 12) % 12))]
  const bass = pcs[0]
  if (pcs.length === 1) return spell(bass)
  const maskFrom = (root, set) => set.reduce((m, pc) => m | (1 << ((pc - root + 12) % 12)), 0)
  const match = (set) => {
    let best = null
    for (const root of set) {
      const t = CHORD_TEMPLATES.findIndex((c) => c.mask === maskFrom(root, set))
      if (t < 0) continue
      if (root === bass) return { root, t }
      if (!best || t < best.t) best = { root, t }
    }
    return best
  }
  // a chord in full; then the notes above the bass as a chord of their own over it (Em7/C)
  const m = match(pcs) || (pcs.length > 3 && !notes.slice(1).some((p) => (((p % 12) + 12) % 12) === bass) ? match(pcs.slice(1)) : null)
  if (m) return spell(m.root) + CHORD_TEMPLATES[m.t].suffix + (m.root === bass ? '' : '/' + spell(bass))
  // two notes doubled (C E C): their interval; anything else has no name
  return pcs.length === 2 ? INTERVAL_NAMES[(pcs[1] - bass + 12) % 12] : ''
}

// Note names in the Playground's key: its key signature (B♭ in F, F♯ in G), a letter of
// its own for a scale note outside that (G♯ in A harmonic minor), and the usual names
// (C♯ E♭ F♯ A♭ B♭) for anything else.
const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B']
function chordSpeller(root, mask) {
  const pcsOf = (r, m) => { const s = new Set(); for (let st = 0; st < 12; st++) if ((m >> st) & 1) s.add((st + r) % 12); return s }
  const scale = pcsOf(root, mask)
  // the major key that holds the scale: its own tonic, its relative major, then any; a scale
  // no major key holds (blues, whole tone, …) goes by its third
  const fits = (t) => [...scale].every((pc) => pcsOf(t, 0xab5).has(pc))
  const minorish = scale.has((root + 3) % 12) && !scale.has((root + 4) % 12)
  let tonic = [root, (root + 3) % 12, ...Array.from({ length: 12 }, (_, t) => t)].find(fits)
  if (tonic == null) tonic = minorish ? (root + 3) % 12 : root
  const label = NOTE_PCS[root]      // the key picker's name for the root always wins
  const names = label.includes('♭') ? FLAT_NAMES : label.includes('♯') ? SHARP_NAMES
    : tonic === 0 ? NOTE_PCS : [5, 10, 3, 8, 1].includes(tonic) ? FLAT_NAMES : SHARP_NAMES
  const inKey = pcsOf(tonic, 0xab5)
  const letters = new Set([...scale].filter((pc) => inKey.has(pc)).map((pc) => names[pc][0]))
  return (pc) => {
    if (inKey.has(pc)) return names[pc]
    if (scale.has(pc)) {
      const free = [SHARP_NAMES[pc], FLAT_NAMES[pc]].filter((n) => !letters.has(n[0]))
      if (free.length === 1) return free[0]
    }
    return NOTE_PCS[pc]
  }
}

// The Playground's chord: the keys you hold, the ones the pedal keeps ringing, and (for
// screenshots) chord=60,64,67 from the query. A new set of notes is named once it has
// settled, so a chord pressed or let go a key at a time never flashes the names of the
// notes in between; the name stays a second after you let go, fading out.
import { sustainDown as pedalHeld } from './audio.js'   // hoisted like the imports at the top
let fpChord = { name: '', at: 0 }        // the name shown; at: when its keys were let go (0 while held)
let fpNotes = { key: '', since: 0 }      // the notes sounding now, and since when
let fpRinging = new Set()
let fpPrevHeld = new Set()
let fpDemo = null
let fpSpell = (pc) => NOTE_PCS[pc]
const CHORD_SETTLE_MS = 60
const CHORD_FADE_MS = 1000
// Called every Playground frame; returns the label's opacity (1 while held, then down to 0).
function updateFreeplayChord(now) {
  if (pedalHeld()) { for (const p of fpPrevHeld) if (!held.has(p)) fpRinging.add(p) } else fpRinging.clear()
  fpPrevHeld = new Set(held)
  const pitches = [...held, ...fpRinging, ...(fpDemo || [])]
  const key = [...new Set(pitches)].sort((a, b) => a - b).join(',')
  if (key !== fpNotes.key) fpNotes = { key, since: now }
  if (!pitches.length || now - fpNotes.since >= CHORD_SETTLE_MS) {
    const name = chordName(pitches, fpSpell)
    if (name) fpChord = { name, at: 0 }
    else if (fpChord.name && !fpChord.at) fpChord.at = now
  }
  if (fpChord.at && now - fpChord.at >= CHORD_FADE_MS) fpChord = { name: '', at: 0 }
  const alpha = fpChord.at ? Math.max(0, 1 - (now - fpChord.at) / CHORD_FADE_MS) : 1
  syncFreeplaySubtitle(alpha)
  return alpha
}
// "C major · Am7" under the title: the chord name in white, fading with the one on the stage
function syncFreeplaySubtitle(alpha = 1) {
  const el = $('subtitle')
  const label = freeScaleLabel()
  if (el.textContent !== label + (fpChord.name ? ' · ' + fpChord.name : '')) {
    el.textContent = label
    if (fpChord.name) {
      const c = document.createElement('span')
      const b = document.createElement('b')
      c.className = 'fp-chord'
      b.textContent = fpChord.name
      c.append(' · ', b)
      el.append(c)
    }
  }
  const c = el.querySelector('.fp-chord')
  if (c) c.style.opacity = alpha < 1 ? alpha.toFixed(2) : ''
}

function startFreeplay(root) {
  initAudio()
  resetSession()
  freeplay = true
  song = null
  player = null
  const saved = settings.freeScale || {}
  freeRoot = ((Number(root != null ? root : saved.root) || 0) % 12 + 12) % 12
  freeScaleIdx = Number.isInteger(saved.idx) && SCALES[saved.idx] ? saved.idx : 0
  const demo = new URLSearchParams(location.search).get('chord')
  fpDemo = demo ? demo.split(',').map(Number).filter((p) => Number.isInteger(p) && p >= 0 && p < 128) : null
  fpChord = { name: '', at: 0 }
  fpNotes = { key: '', since: 0 }
  fpRinging.clear()
  showScreen('play')
  $('title').textContent = 'Playground'
  syncFreeplayBar()
  syncHudButtons()
  status('Playground — the lit keys are in the scale. Play anything.')
  resize()
  maybeStartTake()
}
function syncFreeplayBar() {
  fpSpell = chordSpeller(freeRoot, SCALES[freeScaleIdx][1])
  syncFreeplaySubtitle()
  $('fpRoot').value = String(freeRoot)
  $('fpScale').value = String(freeScaleIdx)
  settings.freeScale = { root: freeRoot, idx: freeScaleIdx }
  saveSettings()
}

/* ============================== device mode ============================== */
// Expression on the keyboard itself: MIDI_USE_MPE=2, KEY_PITCH_BEND_AMOUNT=41,
// PITCH_BEND_RANGE=3, and per firmware mode N (base 100 + 7*N) pitchEnable base+2
// and pressureEnable base+3 (roli_BlockConfigId.h).
// The light style is drawn by the app (blocksd's program owns the LEDs), so the
// device config only carries expression. All four firmware modes get the same
// setting, so it holds whichever mode the keyboard is in, and nothing depends on
// the daemon knowing the active mode (it often doesn't: it only knows items it
// has been asked about).
const MODE_BASE = (modeIndex) => 100 + 7 * modeIndex
function desiredDeviceConfig() {
  const on = settings.expression ? 1 : 0
  const bend = Math.max(1, Math.min(12, settings.bendRange || 12))
  const want = { 2: on, 41: bend, 3: bend }
  for (let m = 0; m < 4; m++) { want[MODE_BASE(m) + 2] = on; want[MODE_BASE(m) + 3] = on }
  return want
}

// The device drops bursty config writes, so they are staggered, then read back.
let configAttempts = 0
let configTimers = []
function writeDeviceConfig(items) {
  for (const t of configTimers) clearTimeout(t)
  const entries = Object.entries(items)
  configTimers = entries.map(([item, value], i) =>
    setTimeout(() => { if (daemon && daemon.ready) daemon.setConfig(Number(item), value) }, 120 * i))
  configTimers.push(setTimeout(() => { if (daemon && daemon.ready) daemon.configGet() }, 900 + 120 * entries.length))
}
function applyDeviceMode() {
  if (!daemon || !daemon.ready) return
  configAttempts = 0
  writeDeviceConfig(desiredDeviceConfig())
}

// Called with the daemon's copy of the device config: check the writes landed,
// and write again what didn't (a few times).
function onDeviceConfig(values) {
  if (!daemon || !daemon.ready) return
  const want = desiredDeviceConfig()
  const missing = Object.entries(want).filter(([k, v]) => values[k] !== v)
  if (!missing.length) {
    console.log('DEVICE config CONFIRMED expression=' + (settings.expression ? 'on' : 'off') + ' bend=' + want[41] +
      (values[20] != null ? ' activeMode=' + values[20] : ''))
    configAttempts = 0
  } else if (configAttempts < 3) {
    configAttempts++
    console.log('DEVICE config retry ' + configAttempts + ' items=' + missing.map(([k]) => k).join(','))
    writeDeviceConfig(Object.fromEntries(missing))
  } else {
    console.log('DEVICE config MISMATCH after retries want=' + JSON.stringify(want) + ' got=' + JSON.stringify(values))
    configAttempts = 0
  }
}

/* ============================== generated band ============================== */
function computeBand(song) {
  if (!song || !song.notes || !song.notes.length) return []
  const beat = 60 / (song.tempo || 120)
  const events = []
  const total = Math.ceil(song.duration / beat)
  for (let b = 0; b < total; b++) {
    const t0 = b * beat, t1 = t0 + beat
    const inBeat = song.notes.filter((n) => n.start < t1 && n.start + n.dur > t0)
    let pitch = null
    if (inBeat.length) {
      const low = inBeat.reduce((m, n) => (n.pitch < m.pitch ? n : m))
      pitch = 36 + (((low.pitch % 12) + 12) % 12)
    }
    events.push({ time: t0, pitch, accent: b % 4 === 0 })
  }
  return events
}
function resetBand(pos) {
  bandPos = Math.max(0, pos)
  for (const ev of bandEvents) if (ev.time >= bandPos - 0.02 && ev.pitch && ev.time < bandPos + 0.02) { bandPos = ev.time; break }
}
/* ============================== Tier-B light fallback ============================== */
// If the blocksd daemon is absent the stock Littlefoot program still lights keys
// from plain MIDI note-ons (velocity indexes a fixed colour table). midiOutput is
// only ever the keyboard itself (pickPorts): on any other output these notes would
// play a synth or a DAW.
function updateNoteLights(desired) {
  if (!midiOutput) return
  for (const [pitch, vel] of desired) {
    const prev = litNotes.get(pitch)
    if (prev === vel) continue
    try { midiOutput.send([0x90, pitch, vel & 0x7f]) } catch (_e) {}
    litNotes.set(pitch, vel)
  }
  for (const pitch of [...litNotes.keys()]) {
    if (desired.has(pitch)) continue
    try { midiOutput.send([0x80, pitch, 0]) } catch (_e) {}
    litNotes.delete(pitch)
  }
}
function clearNoteLights() {
  if (!midiOutput) return
  for (const pitch of [...litNotes.keys()]) { try { midiOutput.send([0x80, pitch, 0]) } catch (_e) {} }
  litNotes.clear()
}
// Windows: the setup's light check and Test lights run a light along the 24 keys with
// note-ons (each key stays lit for three steps), in under the setup's 1.6 s between
// sweeps. The notes bypass litNotes, so the frame loop's updateNoteLights leaves them
// alone; a sweep that starts over first lets go of the keys the last one still holds.
// Returns how long the sweep takes (ms). port: the keyboard's output (the self-test's stand-in).
const MIDI_SWEEP_STEP_MS = 55
let midiSweepTimers = []
const midiSweepLit = new Map()   // pitch -> the port it was lit on
function midiLightSweep(port = midiOutput) {
  for (const t of midiSweepTimers) clearTimeout(t)
  midiSweepTimers = []
  const send = (to, msg) => { try { to.send(msg) } catch (_e) {} }
  for (const [pitch, litOn] of midiSweepLit) send(litOn, [0x80, pitch, 0])
  midiSweepLit.clear()
  if (!port) return 0
  const base = kbBase()
  for (let i = 0; i < 24; i++) {
    const pitch = base + i
    if (pitch < 0 || pitch > 127) continue
    midiSweepTimers.push(setTimeout(() => { send(port, [0x90, pitch, 127]); midiSweepLit.set(pitch, port) }, i * MIDI_SWEEP_STEP_MS))
    midiSweepTimers.push(setTimeout(() => { send(port, [0x80, pitch, 0]); midiSweepLit.delete(pitch) }, (i + 3) * MIDI_SWEEP_STEP_MS))
  }
  return (24 + 3) * MIDI_SWEEP_STEP_MS
}
function runMidiLightTest() {
  if (!midiOutput) { status('No keyboard found: plug it in over USB and switch it on'); return }
  clearLights(midiOutput)
  litNotes.clear()
  const ms = midiLightSweep()
  const btn = $('testLights')
  btn.disabled = true
  btn.textContent = 'Testing…'
  setTimeout(() => {
    if (midiOutput) { clearLights(midiOutput); litNotes.clear() }
    btn.disabled = false
    btn.textContent = 'Test lights'
    status('Light test done: every key should have lit up, and stuck lights are cleared')
  }, ms + 150)
  status('Testing the lights: a light runs across every key')
}

/* ============================== backing track sync ============================== */
function syncBacking() {
  backingEpoch = -1
  recordingEpoch = -1
  syncRecording()
}

/* ============================== transport ============================== */
function togglePlay() {
  if (!player) { if (song) return startSong(); return }
  initAudio()
  if (player.active) { player.pause(); stopBacking() }
  else { cancelCeremony(); player.play(); syncBacking() }
  pumpAudio()
  syncHudButtons()
}

function setMode(mode) {
  if (!player) return
  player.setMode(mode)
  stopBacking()
  if (mode === 'PRACTISE') player.setAdvancement(settings.waitMode || 'pauseAndSnap')
  status(mode === 'WATCH' ? 'Watch — sit back and listen, the keys show you how' : mode === 'PRACTISE' ? 'Wait mode — the song waits for you on every note' : 'Play — keep up with the song, every note is scored')
  syncHudButtons()
}
// Speed track: Wait (practise, waits for you) · 0.5x · 0.75x · Full speed.
function setSpeed(value) {
  if (!player) return
  if (value === 'wait') {
    setMode('PRACTISE')
  } else {
    settings.rate = Number(value); saveSettings()
    if (player.mode === 'PRACTISE') setMode('PLAY')
    player.setRate(settings.rate)
    syncBacking()
    status(settings.rate === 1 ? 'Full speed' : `${settings.rate}x speed`)
  }
  syncHudButtons()
}
function toggleWatch() {
  if (!player) return
  setMode(player.mode === 'WATCH' ? 'PLAY' : 'WATCH')
}

function toggleSetting(name) {
  settings[name] = !settings[name]; saveSettings()
  if (player) player.setMetronome(settings.metronome)
  syncHudButtons()
}
function cycleInstrument() {
  const list = instrumentList()
  const i = list.findIndex((x) => x.id === settings.instrument)
  const next = list[(i + 1) % list.length]
  settings.instrument = next.id; saveSettings()
  setInstrument(next.id)
  syncHudButtons()
  status('Instrument: ' + next.name)
}
function cycleLabels() {
  const i = NOTE_LABELS.indexOf(settings.labels)
  settings.labels = NOTE_LABELS[(i + 1) % NOTE_LABELS.length]; saveSettings()
  if (player) player.setNoteLabels(settings.labels)
  syncHudButtons()
}
// A hand with no notes on the 24 keys would leave you nothing to play, so Hands
// skips it and says why.
const noHandPart = (hand) => `This song has no ${hand}-hand part`
function cycleHands() {
  const order = ['both', 'left', 'right']
  const counts = player && player.song ? player.handCounts() : null
  let hand = player ? player.handFilter : settings.hands
  let skipped = null
  for (let i = 0; i < 2; i++) {
    hand = order[(order.indexOf(hand) + 1) % 3]
    if (hand === 'both' || !counts || counts[hand]) break
    skipped = skipped || hand
  }
  if (hand !== 'both' && counts && !counts[hand]) hand = 'both'
  settings.hands = hand; saveSettings()
  if (player) player.setHandFilter(hand)
  syncHudButtons()
  if (skipped) status(noHandPart(skipped))
}
// Note view picker: a popover under the View button
// with the four views, a glyph and a line each. Choosing one applies it as cycling used to.
const VIEW_INFO = {
  CASCADE: { name: 'Cascade', desc: '3D perspective', glyph: '<path d="M3.5 20.5 9 3.5M20.5 20.5 15 3.5M12 3.5v17" opacity=".5"/><rect x="9.3" y="7" width="2" height="5" rx="1" fill="currentColor" stroke="none"/><rect x="12.9" y="11.5" width="2.6" height="6.5" rx="1.3" fill="currentColor" stroke="none"/>' },
  RAINBOW: { name: 'Rainbow', desc: 'A colour per note', glyph: '<rect x="3.5" y="9" width="3.2" height="10" rx="1.6" fill="#ff6b6b" stroke="none"/><rect x="8" y="4.5" width="3.2" height="9" rx="1.6" fill="#ffce48" stroke="none"/><rect x="12.6" y="11" width="3.2" height="8.5" rx="1.6" fill="#3dbe74" stroke="none"/><rect x="17.2" y="5.5" width="3.2" height="8" rx="1.6" fill="#3d8bff" stroke="none"/>' },
  COLORNOTE: { name: 'Colornote', desc: 'Note names on the notes', glyph: '<rect x="6.5" y="3" width="11" height="18" rx="5.5" fill="#f47676" stroke="none"/><text x="12" y="15.4" text-anchor="middle" font-size="9" font-weight="700" fill="#151245" stroke="none" font-family="Outfit, sans-serif">C</text>' },
  CLASSIC: { name: 'Classic', desc: 'Flat lanes', glyph: '<path d="M4.5 3.5v17M9.5 3.5v17M14.5 3.5v17M19.5 3.5v17" opacity=".4"/><rect x="5.6" y="6" width="2.8" height="6.5" rx="1" fill="currentColor" stroke="none"/><rect x="15.6" y="10.5" width="2.8" height="8" rx="1" fill="currentColor" stroke="none"/>' }
}
const viewMenuOpen = () => !$('viewMenu').classList.contains('hidden')
function buildViewMenu() {
  const menu = $('viewMenu')
  menu.innerHTML = NOTE_VIEWS.map((v) => `<button class="vm-item" role="menuitemradio" aria-checked="false" data-view="${v}">
    <span class="vm-glyph"><svg viewBox="0 0 24 24" aria-hidden="true">${VIEW_INFO[v].glyph}</svg></span>
    <span><span class="vm-name">${VIEW_INFO[v].name}</span><span class="vm-desc">${VIEW_INFO[v].desc}</span></span>
    <svg class="vm-check" aria-hidden="true"><use href="#i-check"/></svg></button>`).join('')
  for (const b of menu.querySelectorAll('.vm-item')) b.onclick = () => { chooseView(b.dataset.view); closeViewMenu(); $('btnView').focus() }
}
function syncViewMenu() {
  for (const b of $('viewMenu').querySelectorAll('.vm-item')) b.setAttribute('aria-checked', String(b.dataset.view === settings.view))
}
// below the button, centred on it but kept inside the window; the nub points at the button
function placeViewMenu() {
  const menu = $('viewMenu')
  const r = $('btnView').getBoundingClientRect()
  const w = menu.offsetWidth || 300
  const left = Math.max(12, Math.min(window.innerWidth - w - 12, r.left + r.width / 2 - w / 2))
  menu.style.left = left + 'px'
  menu.style.top = Math.round(r.bottom + 10) + 'px'
  menu.style.setProperty('--nub', Math.round(r.left + r.width / 2 - left) + 'px')
}
function openViewMenu() {
  const menu = $('viewMenu')
  syncViewMenu()
  menu.classList.remove('hidden')
  $('btnView').setAttribute('aria-expanded', 'true')
  placeViewMenu()
  const current = menu.querySelector('[aria-checked="true"]') || menu.querySelector('.vm-item')
  if (current) current.focus({ preventScroll: true })
}
function closeViewMenu() {
  if (!viewMenuOpen()) return
  $('viewMenu').classList.add('hidden')
  $('btnView').setAttribute('aria-expanded', 'false')
}
function toggleViewMenu() { if (viewMenuOpen()) closeViewMenu(); else openViewMenu() }
// Escape closes, the arrow keys move between views, Enter / Space choose the focused one
// (true: the key belongs to the menu, so the player's own shortcuts leave it alone)
function handleViewMenuKey(e) {
  const items = [...$('viewMenu').querySelectorAll('.vm-item')]
  const i = items.indexOf(document.activeElement)
  if (e.key === 'Escape') { e.preventDefault(); closeViewMenu(); $('btnView').focus(); return true }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    const step = e.key === 'ArrowDown' ? 1 : -1
    items[i < 0 ? 0 : (i + step + items.length) % items.length].focus()
    return true
  }
  return i >= 0 && (e.key === 'Enter' || e.code === 'Space')
}
function chooseView(view) {
  if (!NOTE_VIEWS.includes(view)) return
  settings.view = view; saveSettings()
  if (player) player.setView(settings.view)
  syncHudButtons()
}
function toggleLoop() {
  if (!player || !song) return
  if (player.loop.on) { player.setLoop(null, null, false) }
  else {
    const a = Math.max(0, player.currentPosition() - 0.5)
    const b = Math.min(song.duration, a + 8)
    player.setLoop(a, b, true)
  }
  syncHudButtons()
}

function syncHudButtons() {
  const setLbl = (id, v) => { const el = $(id); if (el) el.textContent = v }
  const inst = instrumentList().find((x) => x.id === settings.instrument)
  setLbl('lblInst', inst ? inst.short : 'Piano')
  if ($('voiceCount')) $('voiceCount').textContent = String(activeVoiceCount())
  $('btnMetro').classList.toggle('on', settings.metronome)
  setLbl('lblLabels', settings.labels === 'names' ? 'Names' : settings.labels === 'fingers' ? 'Fingers' : 'Labels')
  $('btnLabels').classList.toggle('on', settings.labels !== 'off')
  // the hand actually in use: a lesson, a game or a song without that part plays both
  const hands = player ? player.handFilter : settings.hands
  setLbl('lblHands', hands === 'both' ? 'Both' : hands === 'left' ? 'Left' : 'Right')
  $('btnHands').classList.toggle('on', hands !== 'both')
  setLbl('lblView', (VIEW_INFO[settings.view] || VIEW_INFO.CASCADE).name)
  syncViewMenu()
  $('btnLoop').classList.toggle('on', !!(player && player.loop.on))
  $('btnWatch').classList.toggle('on', !!(player && player.mode === 'WATCH'))
  setPlayIcon(!!(player && player.active))
  // speed track thumb
  const sel = player && player.mode === 'PRACTISE' ? 'wait' : String(player ? player.rate : settings.rate)
  let onBtn = null
  for (const b of document.querySelectorAll('#speedTrack button')) {
    const on = b.dataset.speed === sel
    b.classList.toggle('on', on)
    if (on) onBtn = b
  }
  const thumb = $('speedThumb')
  if (thumb && onBtn && onBtn.offsetWidth) {
    thumb.style.left = (onBtn.offsetLeft - 6) + 'px'
    thumb.style.width = onBtn.offsetWidth + 'px'
  }
  $('selCountIn').value = String(settings.countIn)
  if ($('waitMode')) $('waitMode').value = settings.waitMode || 'pauseAndSnap'
  if ($('backingState') && backingName) $('backingState').textContent = backingName
  if ($('fullState') && fullName) $('fullState').textContent = fullName
  if ($('kbdMode')) $('kbdMode').value = settings.keyboardMode
  if ($('exprToggle')) $('exprToggle').checked = !!settings.expression
  if ($('userColorRow')) $('userColorRow').classList.toggle('hidden', settings.keyboardMode !== 'User')
}
let playIconState = null
function setPlayIcon(playing) {
  if (playIconState === playing) return
  playIconState = playing
  $('btnPlay').innerHTML = `<svg><use href="#${playing ? 'i-pause' : 'i-play'}"/></svg>`
}
function syncKbRange() {
  const el = $('kbRange')
  if (el) el.textContent = noteName(kbBase()) + ' – ' + noteName(kbBase() + 23)
}

/* ============================== takes ============================== */
// Settings > Sound > Record my takes: the player records each run as a video with the
// app's own sound (recorder.js; main.js saves it to Movies/Keylight). A take starts
// when a song, lesson, game or exercise starts playing, keeps rolling through pauses
// and restarts, and is saved when the results show, the player is left or another
// song opens. The Playground is recorded from entering it to leaving it. The red REC
// pill over the stage stops a take early; so does the 15-minute limit, and neither run
// is recorded again. With the switch off, beginTake() is never called, so no capture
// stream, recorder or audio tap is ever made.
let takeDeclined = null       // stopped with the REC pill or the time limit: that run (its player) isn't recorded again
let takeRun = null            // the run the last take recorded: its player, or 'playground'
let recPillTimer = 0
let takeSave = true           // the self-test keeps its takes in memory

function takeMeta(trigger) {
  const kind = freeplay ? 'playground' : exerciseMeta ? 'exercise' : lessonMeta ? 'lesson' : gameMeta ? 'game' : 'song'
  const meta = {
    trigger, kind,
    song: freeplay ? { id: 'playground', title: 'Playground', artist: '' }
      : song ? { id: song.importedId || song.file || null, title: song.title || '', artist: song.artist || '' } : null,
    mode: freeplay ? 'FREE' : player ? player.mode : null,
    rate: player ? player.rate : 1,
    hands: player ? player.handFilter : 'both',
    view: freeplay ? 'CASCADE' : settings.view,
    instrument: settings.instrument,
    keyboard: { lowest: player ? player.windowStart : kbBase(), keys: 24 }   // the keys on screen
  }
  if (lessonMeta) meta.lesson = { id: lessonMeta.id, step: lessonMeta.step }
  if (gameMeta) meta.game = { id: gameMeta.id, name: gameMeta.name }
  if (exerciseMeta) meta.exercise = { ...exerciseMeta }
  if (freeplay) meta.scale = freeScaleLabel()
  return meta
}

function beginTake(trigger) {
  const onStop = (r) => { if (r.saved && r.sidecar.stopReason === 'time limit') status('Takes stop after 15 minutes: this one is saved in ' + TAKES_FOLDER) }
  const run = freeplay ? 'playground' : player
  const stem = startTake({ canvas, meta: takeMeta(trigger), save: takeSave, onStop })
  if (stem) takeRun = run
  else if (trigger === 'switch') status('This take could not be recorded')
  return stem
}

// A take that is still being saved holds the next one back: once it is saved, the
// run playing now (a quick Try again, say) is picked up.
function endTake(reason) {
  if (!isRecording()) return
  stopTake(reason).then((r) => {
    if (r && r.blob && r.blob.size) status('Take saved to ' + TAKES_FOLDER)
    maybeStartTake()
  })
}

// main.js asks these when the window is closing: a take still going is stopped and
// saved first. keylightSaveTake resolves to the number of files being saved.
window.keylightTakeBusy = () => takeBusy()
window.keylightSaveTake = async () => {
  const r = await stopTake('app closed')
  return r && r.saved ? 2 : 0
}

// A take still being saved holds a new one back (endTake starts it once that is done;
// starting it now would only fail, and say so).
function maybeStartTake() {
  if (!settings.recordTakes || takeBusy() || screen !== 'play') return
  if (!$('results').classList.contains('hidden')) return
  if (freeplay) { if (takeDeclined !== 'playground') beginTake('switch'); return }
  if (player && song && player.active && takeDeclined !== player) beginTake('switch')
}

function syncRecPill() {
  const on = isRecording()
  $('recPill').classList.toggle('hidden', !on)
  clearInterval(recPillTimer)
  recPillTimer = 0
  if (!on) { if (canvas.classList.contains('take-locked')) resize(); return }
  const tick = () => { const t = Math.floor(takeElapsed()); setText($('recTime'), Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0')) }
  tick()
  recPillTimer = setInterval(tick, 1000)
}

/* ============================== player callbacks ============================== */
function onPlayerState(ev) {
  if (player && player.active && ceremonyTimers.length) cancelCeremony()
  if (player && player.active) maybeStartTake()
  syncHudButtons()
}

function onJudgement(res) {
  if (!res) return
  if (res.kind === 'missed') {
    feedback.set(res.pitch, { kind: 'missed', until: performance.now() + 420 })
    missedBlink.set(res.pitch, performance.now() + 420)
  } else if (res.kind === 'perfect' || res.kind === 'good' || res.kind === 'early' || res.kind === 'late') {
    feedback.set(0, { kind: res.kind, until: performance.now() + 260 })
  }
}

function onFinish(summary) {
  stopBacking()
  // the mode the run was scored in (a mode change part way through carries the score over)
  const mode = summary.mode || (player ? player.mode : 'PLAY')
  if (mode === 'WATCH') {
    // Watching counts as done for a lesson's Watch step; nothing is scored.
    // only the lesson's own Watch step is marked; watching inside another step isn't a result
    if (lessonMeta && lessonMeta.step === 'WATCH') {
      store.set(watchedKey(lessonMeta.id), true)
      renderLessons()
    }
    summary.watched = true
    showResults(summary)
    renderLibrary(); renderRecent(); updateHome()
    syncHudButtons()
    return
  }
  // Practise (the song waits for you) shows how much you got right first time, but
  // only a run played in time keeps stars: a best, a Challenge, an exercise, a level
  const practise = mode === 'PRACTISE'
  if (exerciseMeta) {
    if (!practise) {
      const key = exerciseKey()
      store.set(key, Math.max(store.get(key, 0), summary.starRating))
      store.set(key + '.bpm', player ? Math.round(player.rate * 100) : 100)
    }
    renderToolbox()
  }
  if (lessonMeta) {
    // kept under the step actually played (syncLessonStep follows a mode change)
    if (practise) store.set(practisedKey(lessonMeta.id), true)
    else {
      const key = lessonStepKey(lessonMeta.id, 'PLAY')
      store.set(key, Math.max(store.get(key, 0), summary.starRating))
    }
    renderLessons()
  }
  if (gameMeta && !practise) {
    // a level is passed at its own speed or faster, and a failed one shows no stars
    const slow = !!player && player.rate < (gameMeta.rate || 1) - 1e-3
    const passed = !slow && summary.overallAccuracy >= gameMeta.threshold
    if (!passed) summary.starRating = 0
    store.set('lumi.game.' + gameMeta.id, Math.max(gameBest(gameMeta.id), summary.starRating))
    summary.game = { ...gameMeta, passed, slow }
    renderGames()
  }
  const file = song && song.file
  const stars = summary.starRating
  if (file && !practise && !gameMeta && !lessonMeta && !exerciseMeta && stars > (bestFor(file) || 0)) store.set('lumi.best.' + file, stars)
  showResults(summary)
  // gold stars, or the fail flash; a Practise run without stars gets neither
  if (summary.totalNotes && !(practise && !stars)) celebrate(stars)
  renderLibrary(); renderRecent(); updateHome()
  syncHudButtons()
}

/* ============================== local progress ============================== */
// Days are local calendar days (YYYY-MM-DD), so the streak, "min today" and the week
// bars turn over at your own midnight, not at UTC's.
const dayKey = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
function todayKey() { return dayKey(new Date()) }
function yesterdayKey() { const d = new Date(); return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1)) }
function recordPractice(seconds) {
  if (!(seconds > 0)) return
  const days = store.get('lumi.days', {})
  const k = todayKey()
  days[k] = Math.round((days[k] || 0) + seconds)
  store.set('lumi.days', days)
  const last = store.get('lumi.streak.last', null)
  let streak = store.get('lumi.streak.count', 0)
  // keys compare as text; a last day after today (the clock went back) is left alone
  if (!last || last < k) {
    streak = last === yesterdayKey() ? streak + 1 : 1
    store.set('lumi.streak.last', k)
    store.set('lumi.streak.count', streak)
  }
}
// A streak with a missed day behind it is over: it reads 0 until you play again.
function expireStreak() {
  const last = store.get('lumi.streak.last', null)
  if (last && last < yesterdayKey() && store.get('lumi.streak.count', 0)) store.set('lumi.streak.count', 0)
}

// Practice time, counted a second at a time while you are at it: always while the song
// clock runs (a count-in or a demo too), and while the song waits for you or the
// Playground is open only if a key went down in the last 20 s, so a song left waiting
// over a break doesn't count.
const IDLE_AFTER_MS = 20000
let lastKeyAt = -Infinity       // performance.now() of the last key you pressed
let tickDay = null
function practiceTick() {
  const day = todayKey()
  if (day !== tickDay) { tickDay = day; expireStreak() }    // and again after midnight
  if (screen !== 'play') return
  const keys = performance.now() - lastKeyAt < IDLE_AFTER_MS
  if (freeplay ? keys : player && song && (player.clockRunning || (player.waiting && keys))) recordPractice(1)
}
expireStreak()                  // before Home first shows the streak
setInterval(practiceTick, 1000)

function refreshProgressUI() {
  expireStreak()
  const days = store.get('lumi.days', {})
  const secs = days[todayKey()] || 0
  const el = $('playedToday')
  if (el) el.textContent = Math.round(secs / 60) + ' min · streak ' + store.get('lumi.streak.count', 0) + 'd'
}

/* ============================== results ============================== */
// The results are a modal dialog (role="dialog" on #results): while they are open the
// app behind is inert, the way on has focus, Enter or Space presses it and Escape
// closes them (the keydown handler).
let resultsPrimary = null
let resultsReturnFocus = null
function openResults(primary) {
  resultsPrimary = primary
  for (const b of [$('resAgain'), $('resNext')]) { b.classList.toggle('primary', b === primary); b.classList.toggle('ghost', b !== primary) }
  if ($('results').classList.contains('hidden')) resultsReturnFocus = document.activeElement
  $('results').classList.remove('hidden')
  $('app').inert = true
  primary.focus({ preventScroll: true })
}

const speedName = (rate) => (rate >= 0.999 ? 'full speed' : Math.round(rate * 100) + '% speed')
// Where the results lead on: the next step or lesson in a lesson, the next level in a
// game, otherwise the next song in the library. primary: it is the way forward.
function resultsNext(s) {
  if (lessonMeta) {
    const i = LESSONS.findIndex((l) => l.id === lessonMeta.id)
    if (i < 0) return null
    if (lastMode !== 'PLAY') {
      const step = LESSON_STEPS[LESSON_STEPS.indexOf(lastMode) + 1]
      return step ? { label: 'Next step: ' + stepLabel(step), go: () => startLessonStep(LESSONS[i], step), primary: true } : null
    }
    const after = LESSONS[i + 1]
    return after && lessonComplete(LESSONS[i]) ? { label: 'Next lesson', go: () => startLessonStep(after, nextLessonStep(after)), primary: s.starRating >= 2 } : null
  }
  if (gameMeta) {
    const i = GAMES.findIndex((g) => g.id === gameMeta.id)
    return s.game && s.game.passed && GAMES[i + 1] ? { label: 'Next level', go: () => startGame(GAMES[i + 1]), primary: true } : null
  }
  const idx = song && !exerciseMeta ? LIBRARY.findIndex((l) => l.file === song.file) : -1
  return idx >= 0 && idx < LIBRARY.length - 1 ? { label: 'Next song', go: () => openLibrary(LIBRARY[idx + 1].file) } : null
}

function showResults(s) {
  closeViewMenu()
  endTake('results')
  takeDeclined = null
  lastSummary = s
  lastMode = s.mode || (player ? player.mode : 'PLAY')
  const practiceBtn = $('resPractice')
  const nextBtn = $('resNext')
  const watchBtn = $('resWatch')
  const next = resultsNext(s)
  nextBtn.classList.toggle('hidden', !next || (!!s.watched && !lessonMeta))
  if (next) { nextBtn.textContent = next.label; nextBtn.onclick = () => { hideResults(); next.go() } }
  const primary = next && next.primary && !nextBtn.classList.contains('hidden') ? nextBtn : $('resAgain')
  // in a lesson, Next step is the step the Practise button would open
  practiceBtn.classList.toggle('hidden', !!lessonMeta && lastMode !== 'PLAY')
  $('results').classList.toggle('watched', !!s.watched)
  if (s.watched) {
    $('resKicker').textContent = 'WATCHED'
    $('resHead').textContent = 'Now try it yourself'
    practiceBtn.textContent = 'Practise it'
    $('resAgain').textContent = 'Watch again'
    watchBtn.classList.add('hidden')
    $('resAcc').textContent = 'Practise waits for you on every note. Play keeps time and scores you.'
    $('celebrate').replaceChildren()
    openResults(primary)
    return
  }
  $('resAgain').textContent = 'Try again'
  const practise = lastMode === 'PRACTISE'
  const acc = Math.round(s.overallAccuracy * 100)
  const game = s.game
  $('resKicker').textContent = game ? (game.passed ? 'LEVEL COMPLETE' : 'GAME OVER') : lastMode === 'WATCH' ? 'WATCH COMPLETE' : practise ? 'PRACTICE COMPLETE' : 'SONG COMPLETE'
  $('resHead').textContent = game
    ? (game.passed ? 'Level passed!' : game.slow ? 'Pass it at ' + speedName(game.rate || 1) : 'So close — try again')
    : s.starRating >= 4 ? 'Beautiful!' : s.starRating >= 2 ? 'Nicely done' : 'Keep going'
  $('resStars').innerHTML = Array.from({ length: 5 }, (_, i) =>
    `<span class="rstar ${i < s.starRating ? 'on' : ''}" style="animation-delay:${(0.25 + i * 0.14).toFixed(2)}s"><svg><use href="#i-star"/></svg></span>`).join('')
  // accuracy ring fills and the number counts up
  const ring = $('resRing')
  ring.style.transition = 'none'; ring.style.strokeDashoffset = '326.7'
  void ring.getBoundingClientRect()
  ring.style.transition = ''
  requestAnimationFrame(() => { ring.style.strokeDashoffset = String(326.7 * (1 - s.overallAccuracy)) })
  const t0 = performance.now()
  const countUp = (t) => {
    const k = Math.min(1, (t - t0 - 200) / 1100)
    $('resBig').textContent = Math.round(acc * (k <= 0 ? 0 : 1 - Math.pow(1 - k, 3))) + '%'
    if (k < 1) requestAnimationFrame(countUp)
  }
  requestAnimationFrame(countUp)
  // Practise is rated by the share right first time: in time, or found with no wrong
  // key and no long wait
  const firstTime = s.firstTimeHits ?? s.totalNotesHit
  $('resSub').textContent = practise ? 'right first time' : `${s.totalNotesHit} of ${s.totalNotes} notes`
  $('resAcc').textContent = game
    ? `pass mark ${Math.round(game.threshold * 100)}%${game.slow ? ' at ' + speedName(game.rate || 1) : ''} · your accuracy ${acc}%`
    : practise
      ? `${firstTime} of ${s.totalNotes} notes right first time · the Challenge keeps your stars`
      : `note accuracy ${Math.round(s.noteAccuracy * 100)}% · rhythm accuracy ${Math.round(s.rhythmAccuracy * 100)}%`
  // Practise has no timing to judge: its cards count notes right first time, notes
  // found after a hint and wrong keys instead of the five timings
  const cards = practise
    ? { 'k-perfect': ['First time', firstTime], 'k-good': ['With a hint', s.hinted], 'k-missed': ['Wrong keys', s.wrong], 'k-streak': ['Best streak', s.longestStreak] }
    : { 'k-perfect': ['Perfect', s.perfect], 'k-good': ['Good', s.good], 'k-early': ['Early', s.early], 'k-late': ['Late', s.late], 'k-missed': ['Missed', s.missed], 'k-streak': ['Best streak', s.longestStreak] }
  let shown = 0
  for (const card of document.querySelectorAll('#results .rcard')) {
    const v = cards[[...card.classList].find((c) => c.startsWith('k-'))]
    card.classList.toggle('hidden', !v)
    if (!v) continue
    shown++
    card.querySelector('span').textContent = v[0]
    card.querySelector('b').textContent = v[1] || 0
  }
  const grid = document.querySelector('#results .results-cards')
  if (grid) grid.style.gridTemplateColumns = practise ? `repeat(${shown}, 1fr)` : ''
  const hands = player ? player.score.hands : { left: { hit: 0, miss: 0 }, right: { hit: 0, miss: 0 } }
  const hAcc = (h) => { const n = h.hit + h.miss; return n ? Math.round((100 * h.hit) / n) : 0 }
  $('resHands').innerHTML = `<span class="lh">Left hand</span> ${hands.left.hit + hands.left.miss ? hAcc(hands.left) + '%' : '—'} &nbsp;·&nbsp; <span class="rh">Right hand</span> ${hands.right.hit + hands.right.miss ? hAcc(hands.right) + '%' : '—'}`
  // mode-specific next steps
  watchBtn.classList.toggle('hidden', lastMode === 'WATCH')
  watchBtn.onclick = () => { hideResults(); setMode('WATCH'); if (player) player.restart(false) }
  practiceBtn.textContent = lastMode === 'WATCH' ? 'Try yourself' : practise ? 'Challenge' : 'Practise'
  burstStars(s.starRating)
  openResults(primary)
}
function burstStars(stars) {
  const wrap = $('celebrate')
  if (!wrap) return
  wrap.replaceChildren()
  if (stars < 3) return
  const colours = ['#f5be27', '#3d8bff', '#a3ffeb', '#00a482', '#ff5c8a', '#ffffff']
  for (let i = 0; i < 70; i++) {
    const c = document.createElement('i')
    const ang = Math.random() * Math.PI * 2
    const dist = 180 + Math.random() * 320
    c.style.left = '50%'; c.style.top = '34%'
    c.style.background = colours[i % colours.length]
    c.style.setProperty('--dx', Math.cos(ang) * dist + 'px')
    c.style.setProperty('--dy', Math.sin(ang) * dist + 120 + 'px')
    c.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg')
    c.style.animationDelay = (0.35 + Math.random() * 0.25).toFixed(2) + 's'
    wrap.appendChild(c)
  }
}

function hideResults() {
  const el = $('results')
  if (el.classList.contains('hidden')) return
  el.classList.add('hidden')
  $('app').inert = false
  // focus goes back where it was (the Play button, say), if that is still on screen
  const back = resultsReturnFocus
  resultsReturnFocus = null
  if (back && back !== document.body && back.isConnected && back.getClientRects().length) back.focus({ preventScroll: true })
}

// Keyboard light ceremony: star groups then a streak flash.
function celebrate(stars) {
  console.log('CEREMONY stars=' + stars + ' daemon=' + (daemon && daemon.ready ? 'ready' : 'absent'))
  if (!daemon || !daemon.ready) return
  const off = () => Array.from({ length: 24 }, () => [0, 0, 0])
  const seq = []
  if (stars === 0) {
    // fail: red flash, three times
    for (let i = 0; i < 3; i++) {
      seq.push(() => daemon.send(Array.from({ length: 24 }, () => [225, 110, 115])))
      seq.push(() => daemon.send(off()))
    }
  } else {
    // star rating: gold groups fill in, one per star (~3 s)
    const groups = 5
    const keysPerGroup = Math.floor(24 / groups)
    for (let g = 0; g < groups; g++) {
      seq.push(() => {
        const frame = off()
        if (g < stars) for (let k = 0; k < keysPerGroup; k++) frame[g * keysPerGroup + k] = [245, 190, 39]
        daemon.send(frame)
      })
    }
    // streak complete: teal sweep (2.25 s)
    for (let i = 0; i < 4; i++) {
      seq.push(() => {
        const frame = off()
        for (let k = 0; k < 24; k++) if ((k + i) % 4 === 0) frame[k] = [0, 165, 130]
        daemon.send(frame)
      })
    }
  }
  seq.push(() => daemon.send(off()))
  cancelCeremony()
  ledOverrideUntil = performance.now() + seq.length * 380 + 100
  ceremonyTimers = seq.map((fn, i) => setTimeout(fn, i * 380))
}

/* ============================== input ============================== */
const exprLog = { bend: 0, pressure: 0, slide: 0, poly: 0 }
function logExpr(kind, detail) {
  const el = $('mpeState')
  if (el) el.textContent = kind + ' · ' + detail.replace('ch=', 'ch ')
  if (exprLog[kind] > 4) return
  exprLog[kind]++
  console.log('EXPR ' + kind + ' ' + detail + (exprLog[kind] === 5 ? ' (further messages quiet)' : ''))
}
let rawLogged = 0
function logRaw(data) {
  if (rawLogged > 12) return
  rawLogged++
  console.log('MIDI raw ' + [...data].map((b) => b.toString(16).padStart(2, '0')).join(' '))
}

function handleMidiMessage(data) {
  const status = data[0]
  if (status == null || status < 0x80) return
  if (status === 0xf0) {   // device SysEx (config replies etc.) — don't spam the log
    if (rawLogged < 2) logRaw(data)
    return
  }
  const type = status & 0xf0
  const ch = status & 0x0f
  const d1 = data[1] || 0, d2 = data[2] || 0
  if (type === 0x90 && d2 > 0) { handleNoteOn(d1, d2, ch); return }
  if (type === 0x80 || (type === 0x90 && d2 === 0)) { handleNoteOff(d1, ch); return }
  if (type === 0xB0 && d1 === 64) { logMidi('cc', 64, d2, ch); setSustain(d2 >= 64); return }          // sustain pedal
  if (type === 0xB0 && (d1 === 120 || d1 === 123)) { stopAll(); return }    // all sound / notes off
  if (!settings.expression) return   // expression off: keys play like a piano
  if (type === 0xE0) {
    const raw = (d2 << 7) | d1
    const norm = (raw - 8192) / 8192
    setBend(ch, norm * settings.bendRange)
    logExpr('bend', 'ch=' + ch + ' semis=' + (norm * settings.bendRange).toFixed(2))
  } else if (type === 0xD0) {
    setPressure(ch, d1 / 127)
    logExpr('pressure', 'ch=' + ch + ' value=' + d1)
  } else if (type === 0xB0 && d1 === 74) {
    setSlide(ch, d2 / 127)
    logExpr('slide', 'ch=' + ch + ' value=' + d2)
  } else if (type === 0xA0) {
    setPolyPressure(d1, ch, d2 / 127)
    logExpr('poly', 'ch=' + ch + ' note=' + d1 + ' value=' + d2)
  } else {
    logRaw(data)
  }
}

function handleNoteOn(pitch, vel, channel = 0) {
  initAudio()
  lastKeyAt = performance.now()
  noteOn(pitch, vel, channel)
  logMidi('on', pitch, vel, channel)
  held.add(pitch)
  calibrateFromNote(pitch)
  if (!player || player.mode === 'WATCH') return
  const need = player.waiting ? new Set(player.needPitches) : null
  const res = player.noteOn(pitch)
  if (need) checkOctaveMismatch(pitch, need)
  if (res && res.kind && ['perfect', 'good', 'early', 'late'].includes(res.kind)) feedback.set(pitch, { kind: res.kind, until: performance.now() + 220 })
}
function handleNoteOff(pitch, channel = 0) { noteOff(pitch, channel); logMidi('off', pitch, 0, channel); held.delete(pitch); letGoAt.set(pitch, performance.now()) }

// The keyboard's ports: one named for it first (LUMI, then any other ROLI name, as a
// Piano M may show up), else an input that looks like a keyboard: a hardware port,
// never a software bus (IAC, a network session, a DAW's virtual port), which would
// feed the app another program's notes. Lights only go to an output named for the
// keyboard, since any other output would play the light notes as music. A Piano M may
// name its ports "LUMI Keys BLOCK", "ROLI Piano M" or just "Piano M".
const KB_PORT = /lumi|\bpiano m\b/i, KB_MAKER = /roli/i
const SOFT_PORT = /\biac\b|\bbus\b|network|session|virtual|loopback|loopmidi|through|\bthru\b|rtp/i
function pickPorts(ins, outs) {
  const label = (p) => (p.name || '') + ' ' + (p.manufacturer || '')
  const rank = (p) => (KB_PORT.test(label(p)) ? 3 : KB_MAKER.test(label(p)) ? 2 : SOFT_PORT.test(label(p)) ? 0 : 1)
  const best = (list, min) => {
    let pick = null
    for (const p of list) if (p && p.state !== 'disconnected' && rank(p) >= min && (!pick || rank(p) > rank(pick))) pick = p
    return pick
  }
  return { input: best([...ins], 1), output: best([...outs], 2) }
}

let midiState = null    // what the last 'keylight:midi' event said
// Called at boot and whenever a port comes or goes (opening one counts too), so a
// keyboard switched on or woken from sleep after launch plays, waits and lights like
// one found at boot. The onboarding listens for 'keylight:midi'.
function bindMidiPorts() {
  if (!midi) return
  const { input, output } = pickPorts(midi.inputs.values(), midi.outputs.values())
  if (input !== midiInput) {
    if (midiInput) midiInput.onmidimessage = null
    midiInput = input
    if (midiInput) midiInput.onmidimessage = (ev) => handleMidiMessage(ev.data)
  }
  if (output !== midiOutput) { midiOutput = output; litNotes.clear() }
  updateKbChip()
  const detail = { connected: !!midiInput, name: midiInput ? midiInput.name : null }
  if (midiState && midiState.connected === detail.connected && midiState.name === detail.name) return
  midiState = detail
  const obd = $('obDevice')
  if (obd) obd.textContent = midiInput ? 'Keyboard connected' : 'No keyboard found — plug in your keyboard'
  console.log('MIDI keyboard ' + (midiInput ? 'in=' + midiInput.name + ' out=' + (midiOutput ? midiOutput.name : 'none') : 'none') +
    ' (inputs=' + [...midi.inputs.values()].map((p) => p.name + (p.state === 'disconnected' ? ' (gone)' : '')).join('|') + ')')
  window.dispatchEvent(new CustomEvent('keylight:midi', { detail }))
}

async function initMidi() {
  try {
    midi = await navigator.requestMIDIAccess({ sysex: true })
    console.log('MIDI ready: inputs=' + [...midi.inputs.values()].map((p) => p.name).join('|') + ' outputs=' + [...midi.outputs.values()].map((p) => p.name).join('|'))
    midi.onstatechange = () => bindMidiPorts()
    bindMidiPorts()
  } catch (e) { console.log('MIDI failed: ' + e.message) }
}

function updateKbChip() {
  const chip = $('kbStatus')
  if (!chip) return
  const connected = !!midiInput
  chip.classList.toggle('on', connected)
  const lit = (daemon && daemon.ready) || (IS_WIN && !!midiOutput)
  $('kbStatusText').textContent = connected ? (lit ? 'Keyboard connected' : 'Keyboard · lights off') : 'No keyboard'
  if (IS_WIN) showWindowsLights()
}

// Windows: Settings → Keyboard lights says how the keys light (there is no light service
// to report on), and the brightness works only with a blocksd someone runs themselves.
function showWindowsLights() {
  const ready = !!(daemon && daemon.ready)
  const el = $('daemonState')
  if (el) el.textContent = ready ? 'Full colour (blocksd)' : midiOutput ? 'The keyboard’s own colours' : midi ? 'No keyboard found' : 'checking…'
  const b = $('brightness')
  if (b) {
    b.disabled = !ready
    b.title = ready ? '' : 'The keyboard sets its own brightness on Windows'
  }
}

// Windows wording on the page (index.html is written for the Mac)
function applyWindowsPage() {
  document.documentElement.classList.add('win')
  const set = (id, text) => { const el = $(id); if (el) el.textContent = text }
  set('lightsLabel', 'Key lights')
  set('recordTakesNote', 'Saves each run in the player as a video with Keylight’s sound to ' + TAKES_FOLDER + ', for making videos.')
  set('importPrivacy', 'A recording becomes notes on your keys. MIDI and MusicXML files are read as written. Everything stays on ' + THIS_COMPUTER + '.')
  set('camHelp', 'Point a camera down at the keyboard. Keylight then shows which finger is over which key, before you press it.')
  showWindowsLights()
}

/* ============================== keyboard octave ============================== */
// The Piano M's 24 keys play the notes kbBase()..kbBase()+23. The device octave
// (config OCTAVE = 4, range -4..5) moves that range. settings.kbZero is the note
// the leftmost key plays at octave 0; it is learned from what the keys send, so
// the lit key and the note the key plays can't drift apart.
let kbOctave = 0
let kbSetAt = 0
let octaveMiss = { offset: 0, pitches: [] }
const kbBase = () => settings.kbZero + 12 * kbOctave

function setKeyboardWindow(start) {
  kbOctave = Math.max(-4, Math.min(5, Math.round((start - settings.kbZero) / 12)))
  kbSetAt = performance.now()
  if (daemon && daemon.ready) {
    daemon.setConfig(5, 0)          // transpose off: keys play plain octaves
    daemon.setConfig(4, kbOctave)
  }
  if (player) player.setWindowStart(kbBase())
  console.log('KEYBOARD octave=' + kbOctave + ' base=' + kbBase())
  syncOctaveUI()
}

// The octave − / + (HUD, Settings, Z / X and the keyboard's own buttons). The keys get a
// sweep that travels the way they moved.
function shiftOctave(delta) {
  // without the light service the app can't move the keyboard's octave, only follow it
  if (!daemon || !daemon.ready) {
    status(IS_WIN ? 'Use the octave buttons on your keyboard to move the keys: Keylight follows them'
      : 'Moving the keys from here needs the light service: use the octave buttons on your keyboard')
    return
  }
  const from = kbBase()
  setKeyboardWindow(from + 12 * delta)
  if (kbBase() === from) { status('The keys are already at their ' + (delta < 0 ? 'lowest' : 'highest') + ' octave'); return }
  if (song) song.fitStart = kbBase()
  octaveSweepAt = performance.now()
  octaveSweepDir = Math.sign(delta)
  status('Keys now play ' + noteName(kbBase()) + '–' + noteName(kbBase() + 23))
}

// The range the keys play, wherever it shows: the HUD's Octave control and Settings
function syncOctaveUI() {
  setText($('lblOctave'), keysRange())
  syncKbRange()
  // the device octave runs from -4 to 5 (setKeyboardWindow)
  for (const id of ['btnOctDown', 'setOctDown']) if ($(id)) $(id).disabled = kbOctave <= -4
  for (const id of ['btnOctUp', 'setOctUp']) if ($(id)) $(id).disabled = kbOctave >= 5
}

// Our idea of the keys' range was off by `shift` semitones: fix the calibration
// and put the keyboard back on the window the song wants.
function recalibrate(shift, reason) {
  if (!daemon || !daemon.ready) {
    // We can't move the keyboard's octave right now, so we don't know it either:
    // follow the keys for this session without saving a calibration.
    kbOctave += shift / 12
    if (player) player.setWindowStart(kbBase())
    syncOctaveUI()
    console.log('KEYBOARD following keys base=' + kbBase() + ' (' + reason + ', light service offline)')
    return
  }
  settings.kbZero += shift
  saveSettings()
  console.log('KEYBOARD calibrated zero=' + settings.kbZero + ' (' + reason + ')')
  setKeyboardWindow(player && song ? (song.fitStart ?? player.windowStart) : kbBase())
}

// A note outside the window can only mean the range is wrong.
function calibrateFromNote(pitch) {
  const base = kbBase()
  if (pitch >= base && pitch < base + 24) return
  if (performance.now() - kbSetAt < 700) return     // octave change still landing
  let nb = base
  while (pitch < nb) nb -= 12
  while (pitch >= nb + 24) nb += 12
  recalibrate(nb - base, 'note ' + pitch + ' outside ' + base + '-' + (base + 23))
}

// Inside the window but exactly an octave away from what practice waits for, on
// two different notes in a row (or the only wanted note, three times running):
// the keys are shifted by an octave. One repeated slip doesn't count.
function checkOctaveMismatch(pitch, need) {
  if (need.has(pitch)) { octaveMiss = { offset: 0, pitches: [] }; return }
  const offset = need.has(pitch - 12) ? 12 : need.has(pitch + 12) ? -12 : 0
  if (!offset) { octaveMiss = { offset: 0, pitches: [] }; return }
  if (octaveMiss.offset !== offset) octaveMiss = { offset, pitches: [], presses: 0 }
  if (!octaveMiss.pitches.includes(pitch)) octaveMiss.pitches.push(pitch)
  octaveMiss.presses = (octaveMiss.presses || 0) + 1
  // two different notes, or (when only one note is wanted) the same one three times
  if (octaveMiss.pitches.length >= 2 || (need.size === 1 && octaveMiss.presses >= 3)) {
    status('Your keys seemed an octave off, so I moved them')
    octaveMiss = { offset: 0, pitches: [] }
    recalibrate(offset, 'two different notes played an octave ' + (offset > 0 ? 'above' : 'below') + ' the target')
  }
}

/* ============================== LED daemon ============================== */
function initDaemon() {
  daemon = new LedDaemon((state, info, device) => {
    if (state === 'info') { showKeyboardInfo(info); return }   // a battery update from the same keyboard
    daemonState = state
    const el = $('daemonState')
    // a refused frame still means the service is there
    if (el) el.textContent = state === 'connected' || state === 'rejected' ? 'Connected' : state === 'no-device' ? 'Running, no keyboard found'
      : state === 'unavailable' || state === 'disconnected' ? 'Not running' : state
    updateKbChip()
    if (state !== 'rejected') showKeyboardInfo(state === 'connected' ? device : null)
    if (state === 'connected') {
      console.log('LED daemon ready device=' + (info || '?'))
      daemon.brightness(settings.brightness)
      applyDeviceMode()
      setKeyboardWindow(player && song ? (song.fitStart ?? player.windowStart) : kbBase())
    } else console.log('LED daemon: ' + state)
  }, handleKeyButton, onDeviceConfig)
  daemon.connect()
}

// Battery from the light service: a row under Light service in Settings, and the keyboard
// chip's tooltip; once a session, a word when it runs low off the charger.
let lowBatteryWarned = false
function showKeyboardInfo(dev) {
  const text = dev && dev.battery != null ? dev.battery + '%' + (dev.charging ? ' · charging' : '') : ''
  const row = $('batteryRow')
  if (row) { row.classList.toggle('hidden', !text); $('kbBattery').textContent = text }
  const chip = $('kbStatus')
  if (chip) chip.title = text ? 'Battery ' + text : ''
  if (dev && dev.battery != null && dev.battery <= 15 && !dev.charging && !lowBatteryWarned) {
    lowBatteryWarned = true
    status('Your keyboard battery is low (' + dev.battery + '%): plug it in to keep playing')
  }
}

// The keyboard's buttons, numbered like its Littlefoot handleButtonDown: 0 mode, 1 minus,
// 2 plus, 3 left arrow, 4 right arrow; blocksd reports press and release. − / + always move
// the octave (the app owns it, so the lit keys and the keys' notes move together); the
// arrows and the mode button do what fits where you are.
const MODE_HOLD_MS = 600
let modeHold = null             // the mode button while it is down in the player
let buttonIdWarned = false
// at: where you are, from keyButtonContext()
function keyButtonAction(id, at) {
  if (id === 1) return 'octave-down'
  if (id === 2) return 'octave-up'
  if (id === 0) return at.player ? 'mode-hold' : 'light-style'
  if ((id !== 3 && id !== 4) || at.overlay) return null    // nothing behind the welcome or import sheet
  const right = id === 4
  if (at.results) return right ? 'results-next' : 'results-close'
  if (at.freeplay) return right ? 'scale-next' : 'scale-prev'
  if (at.player) return at.loopSections ? (right ? 'loop-later' : 'loop-earlier') : (right ? 'restart' : 'play-pause')
  if (at.screen === 'home') return right ? 'continue' : null
  return null
}
function keyButtonContext() {
  const shown = (id) => { const el = $(id); return !!el && !el.classList.contains('hidden') }
  const results = shown('results')
  const play = screen === 'play' && !results
  return {
    screen, results, overlay: shown('onboarding') || shown('importSheet'),
    freeplay: play && freeplay, player: play && !freeplay && !!player && !!song, loopSections: play && !freeplay && !!loopSections()
  }
}
// at: the context, for the self-test (blocksd's events use where you are now)
function handleKeyButton(id, action, at = null) {
  if (id == null) {
    // upstream blocksd leaves button_id out of its button events, so no button can be told apart
    if (!buttonIdWarned) {
      buttonIdWarned = true
      console.log('BUTTON event without button_id: the light service needs the button patch')
      status('Keyboard buttons need the updated light service (see Hardware buttons on github.com/scizerss/keylight-piano)')
    }
    return
  }
  if (action === 'release') {
    // the mode button let go before the hold time: a short press
    if (id === 0 && modeHold) { clearTimeout(modeHold.timer); if (!modeHold.long) cycleLightStyle(); modeHold = null }
    return
  }
  if (action !== 'press') return
  const what = keyButtonAction(id, at || keyButtonContext())
  if (what === 'octave-down') shiftOctave(-1)
  else if (what === 'octave-up') shiftOctave(1)
  else if (what === 'light-style') cycleLightStyle()
  else if (what === 'mode-hold') {
    // held for MODE_HOLD_MS: Wait ⇄ Play; let go sooner: the next light style
    if (modeHold) clearTimeout(modeHold.timer)
    const hold = { long: false, timer: 0 }
    hold.timer = setTimeout(() => { hold.long = true; if (player) setMode(player.mode === 'PRACTISE' ? 'PLAY' : 'PRACTISE') }, MODE_HOLD_MS)
    modeHold = hold
  } else if (what === 'results-next') {
    // whichever next step the results lead with (the filled button)
    const next = document.querySelector('#results .results-actions .primary:not(.hidden)') || $('resAgain')
    next.click()
  } else if (what === 'results-close') $('resClose').click()
  else if (what === 'scale-next' || what === 'scale-prev') {
    freeScaleIdx = (freeScaleIdx + (what === 'scale-next' ? 1 : SCALES.length - 1)) % SCALES.length
    syncFreeplayBar()
    status('Scale: ' + freeScaleLabel())
  } else if (what === 'loop-later' || what === 'loop-earlier') walkLoop(what === 'loop-later' ? 1 : -1)
  else if (what === 'play-pause') togglePlay()
  else if (what === 'restart') { cancelCeremony(); player.restart() }
  else if (what === 'continue') $('continuePlay').click()
}

// Bar starts in seconds, when the song carries them (song.bars): with the loop on, the
// arrows then walk it a section at a time; without them they stay play/pause and restart.
const loopSections = () => (player && player.loop.on && player.loop.a != null && player.loop.b != null &&
  song && Array.isArray(song.bars) && song.bars.length > 1 ? song.bars : null)
// The loop one section earlier (dir -1) or later (+1), keeping its length in whole bars and
// within from..end (a lesson's part of the song); null when it is already at that end.
function loopWalkRange(a, b, bars, dir, from, end) {
  const edges = [from, ...bars.filter((t) => t > from + 1e-3 && t < end - 1e-3), end]
  const near = (t) => edges.reduce((best, x, i) => (Math.abs(x - t) < Math.abs(edges[best] - t) ? i : best), 0)
  const i0 = near(a)
  const len = Math.min(edges.length - 1, Math.max(1, near(b) - i0))
  const j0 = Math.max(0, Math.min(edges.length - 1 - len, i0 + dir * len))
  return j0 === i0 ? null : { a: edges[j0], b: edges[j0 + len] }
}
function walkLoop(dir) {
  const r = loopWalkRange(player.loop.a, player.loop.b, loopSections(), dir, player.sectionStart || 0, player.end)
  if (!r) { status(dir > 0 ? 'The loop is already at the end' : 'The loop is already at the start'); return }
  player.setLoop(r.a, r.b, true)
  player.seek(r.a)
  syncBacking()
  syncHudButtons()
  status(dir > 0 ? 'Loop moved one section later' : 'Loop moved one section earlier')
}

/* ============================== light styles ============================== */
// The keyboard's lights are drawn by the app on every screen, in one of four styles:
//   Piano  white light under your fingers; song notes in white
//   Pro    hand colours: song notes blue (left) / orange (right); keys you press
//          light in the colour of the hand that side of the keyboard belongs to
//   Stage  a colour per note: the whole keyboard glows faintly in a rainbow
//   User   your own colour for everything
// Pro and User mark every C faintly (in its hand's colour / yours) so you can find your place.
const LIGHT_STYLES = ['Piano', 'Pro', 'Stage', 'User']
const STYLE_LABELS = { Piano: 'Piano — white', Pro: 'Pro — hand colours', Stage: 'Stage — a colour per note', User: 'User — your own colour' }
const lightStyle = () => (LIGHT_STYLES.includes(settings.keyboardMode) ? settings.keyboardMode : 'Pro')
let stylePreviewAt = 0          // a new style sweeps across the keys once
const letGoAt = new Map()       // pitch -> when the key came up (its light fades out)

function setLightStyle(style, announce = true) {
  if (!LIGHT_STYLES.includes(style)) return
  settings.keyboardMode = style
  saveSettings()
  stylePreviewAt = performance.now()
  syncHudButtons()
  if (announce) status('Light style: ' + STYLE_LABELS[style])
}
function cycleLightStyle() {
  setLightStyle(LIGHT_STYLES[(LIGHT_STYLES.indexOf(lightStyle()) + 1) % LIGHT_STYLES.length])
}

// LED level for the next note group. LEDs are linear while eyes are not, so
// "dim" has to be far below half to read as clearly dimmer than "now".
const NEXT_LEVEL = 0.16
const REST_LEVEL = 0.1
// Scale a colour down without losing its hue: RGB565 drops anything under 8,
// so non-zero channels keep at least one step.
function dimRgb(c, k) { return c.map((v) => (v === 0 ? 0 : Math.max(8, Math.round(v * k)))) }
function stageRgb(pitch) {
  const h = (((pitch % 12) + 12) % 12) / 12
  const k = (n) => (n + h * 12) % 12
  const f = (n) => 0.5 - 0.5 * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)]
}
const userRgb = () => hexToRgb(/^#[0-9a-f]{6}$/i.test(settings.userColor || '') ? settings.userColor : DEFAULTS.userColor)
// Colour of a song note on the keys.
function noteRgb(n, style = lightStyle()) {
  if (style === 'Piano') return [255, 255, 255]
  if (style === 'Stage') return stageRgb(n.pitch)
  if (style === 'User') return userRgb()
  return hexToRgb(n.hand === 'left' ? COLORS.hand.left : COLORS.hand.right)
}
// Colour of a key you press (key index i on the 24-key row).
function pressRgb(pitch, i, style = lightStyle()) {
  if (style === 'Pro') return hexToRgb(i < 12 ? COLORS.hand.left : COLORS.hand.right)
  return noteRgb({ pitch }, style)
}
// What a key shows when nothing is happening on it (key index i on the row).
function restRgb(pitch, i, style = lightStyle()) {
  const pc = ((pitch % 12) + 12) % 12
  if (style === 'Stage') return dimRgb(stageRgb(pitch), REST_LEVEL)
  if (pc !== 0 || style === 'Piano') return [0, 0, 0]
  return dimRgb(pressRgb(pitch, i, style), REST_LEVEL)
}
const brighter = (a, b) => a.map((v, c) => Math.max(v, b[c]))
// Keys you are playing, on top of `frame`: full light while held, fading out over
// a quarter second after you let go.
function drawPlayedKeys(frame, base, level = 1) {
  const now = performance.now()
  for (let i = 0; i < 24; i++) {
    const pitch = base + i
    if (held.has(pitch)) { frame[i] = dimRgb(pressRgb(pitch, i), level); continue }
    const t = letGoAt.get(pitch)
    if (t == null) continue
    const k = 1 - (now - t) / 250
    if (k <= 0) { letGoAt.delete(pitch); continue }
    frame[i] = brighter(frame[i], dimRgb(pressRgb(pitch, i), level * k))
  }
}
// A new style sweeps across the keys once (about half a second).
function drawStylePreview(frame, base) {
  const t = (performance.now() - stylePreviewAt) / 520
  if (t < 0 || t > 1) return
  for (let i = 0; i < 24; i++) {
    const k = Math.max(0, 1 - Math.abs(t * 30 - 3 - i) / 3)
    if (k > 0) frame[i] = brighter(frame[i], dimRgb(pressRgb(base + i, i), k))
  }
}
// Moving the keys an octave (shiftOctave) sends a light along them the same way: a
// bright head with a five-key tail, about half a second end to end.
let octaveSweepAt = 0
let octaveSweepDir = 0
function drawOctaveSweep(frame, base) {
  const t = (performance.now() - octaveSweepAt) / 480
  if (!octaveSweepDir || t < 0 || t > 1) return
  const head = t * 31 - 3
  for (let i = 0; i < 24; i++) {
    const d = head - (octaveSweepDir > 0 ? i : 23 - i)     // how far behind the head this key is
    const k = d < 0 ? Math.max(0, 1 + d) : Math.max(0, 1 - d / 5)
    if (k > 0) frame[i] = brighter(frame[i], dimRgb(pressRgb(base + i, i), k))
  }
}
// The setup's keyboard step pulses the end key to press next (key 0, then key 23)
function drawSetupGuide(frame, base) {
  if (!setup.open || SETUP_STEPS[setup.step] !== 'keyboard' || setup.rangeDone || !midiInput) return
  const i = setup.lowKey == null ? 0 : 23
  const k = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(performance.now() / 160))
  frame[i] = brighter(frame[i], dimRgb(pressRgb(base + i, i), k))
}
// Keys away from a song (home, library, settings): the style's resting look plus
// whatever you play.
function restFrame() {
  const base = kbBase()
  const frame = Array.from({ length: 24 }, (_, i) => restRgb(base + i, i))
  drawPlayedKeys(frame, base)
  drawStylePreview(frame, base)
  drawOctaveSweep(frame, base)
  drawSetupGuide(frame, base)
  return frame
}

function buildKeyFrame(s) {
  const frame = Array.from({ length: 24 }, () => [0, 0, 0])
  const now = performance.now()
  if (freeplay) {
    // Playground: the scale's keys glow faintly in the style's colour, the root brighter
    const scale = freeScalePcs()
    const base = kbBase()
    for (let i = 0; i < 24; i++) {
      const pitch = base + i
      const pc = ((pitch % 12) + 12) % 12
      if (pc === freeRoot) frame[i] = dimRgb(pressRgb(pitch, i), 0.45)
      else if (scale.includes(pc)) frame[i] = dimRgb(pressRgb(pitch, i), REST_LEVEL)
    }
    drawPlayedKeys(frame, base)
    drawStylePreview(frame, base)
    drawOctaveSweep(frame, base)
    return frame
  }
  if (!s || !s.song) return frame
  const snap = s.snapshot
  const mode = lightStyle()
  const ws = s.windowStart
  const put = (pitch, rgb) => { const i = pitch - ws; if (i >= 0 && i < 24) frame[i] = rgb }

  // count-in: show where the first notes are and pulse them on every beat
  const ac = audioContext()
  const ctxNow = ac ? ac.currentTime : 0
  if (s.countInUntil && s.countInUntil > ctxNow) {
    // on the beat of the running count-in, which follows the speed (tempo x rate)
    const beats = Math.max(1, player ? player.countIn : 4)
    const beat = (s.countInStart > 0 ? s.countInUntil - s.countInStart : s.countInSeconds) / beats
    const phase = beat > 0 ? (((ctxNow - s.countInStart) / beat) % 1 + 1) % 1 : 0
    const k = 0.2 + 0.8 * Math.pow(1 - phase, 3)
    for (const n of [...snap.activeNotes, ...snap.upcomingNotes]) put(n.pitch, dimRgb(noteRgb(n, mode), k))
    return frame
  }

  // keys you are playing that the song isn't asking for: a softer version of your light
  drawPlayedKeys(frame, ws, 0.3)
  drawOctaveSweep(frame, ws)
  // next group: dim, in its hand colour
  for (const n of snap.upcomingNotes) put(n.pitch, dimRgb(noteRgb(n, mode), NEXT_LEVEL))
  // sounding now: full colour
  for (const n of snap.activeNotes) put(n.pitch, noteRgb(n, mode))
  // waiting for you: the keys to press breathe in their hand colour
  if (snap.waiting) {
    const pulse = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(now / 160))
    for (const n of snap.waitNotes || []) if (snap.needPitches.has(n.pitch)) put(n.pitch, dimRgb(noteRgb(n, mode), pulse))
  }
  // judgement flashes win over everything
  for (const [pitch, fb] of feedback) {
    if (!pitch || fb.until <= now || !fb.kind || !COLORS.scoring[fb.kind]) continue
    if (fb.kind === 'missed') {
      const on = Math.floor(now / 120) % 2 === 0
      put(pitch, on ? hexToRgb(COLORS.scoring.missed) : [0, 0, 0])
    } else put(pitch, hexToRgb(COLORS.scoring[fb.kind]))
  }
  return frame
}

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

/* ============================== render loop ============================== */
function resize() {
  const wrap = canvas.parentElement
  const dpr = window.devicePixelRatio || 1
  const w = Math.max(1, Math.trunc(wrap.clientWidth * dpr)), h = Math.max(1, Math.trunc(wrap.clientHeight * dpr))
  // a take's picture can't change size part way (the file would break): while one
  // records, the stage keeps its size and is shown scaled to fit; it fills the window
  // again when the take ends (syncRecPill)
  const locked = isRecording() && (w !== canvas.width || h !== canvas.height)
  canvas.classList.toggle('take-locked', locked)
  if (locked) return
  canvas.width = w
  canvas.height = h
  stageDpr = dpr
  ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0)
}

// Send a key frame only when it changed (the daemon is ACK-gated anyway).
function sendKeys(frame) {
  if (!daemon || !daemon.ready || frame.join('|') === daemon.lastSig) return
  daemon.send(frame)
}

function frame(ts) {
  requestAnimationFrame(frame)
  if (tracker) tracker.active = screen === 'settings' || screen === 'play'
  if (screen === 'settings') drawCamera($('camSetupCanvas'))
  if (screen !== 'play') {
    if (performance.now() > ledOverrideUntil) sendKeys(restFrame())
    return
  }
  // at most 60 frames a second (a 120 Hz screen draws every other frame). The 3 ms of
  // slack keeps every frame of a 60 Hz display, whose frames come 14.6-18.7 ms apart: the
  // plain test skipped about a third of them, so the notes juddered at ~38 fps. The key
  // lights cannot be flooded by this: daemon.js sends only the newest frame, once blocksd
  // has taken the last one.
  if (ts - lastFrame < 1000 / 60 - 3) return
  lastFrame = ts

  // the ratio the stage was sized for, not the window's: they differ while a take keeps
  // the stage's size after the window's ratio changed (a zoom, another screen)
  const W = canvas.width / stageDpr, H = canvas.height / stageDpr

  if (freeplay) {
    const chordAlpha = updateFreeplayChord(performance.now())
    let fpGeo = null
    try { fpGeo = drawScene(ctx2d, W, H, {
      position: 0, notes: [], activeNotes: [], upcomingNotes: [],
      view: 'CASCADE', noteLabels: 'off', windowStart: kbBase(),
      waiting: false, needPitches: new Set(), playing: false,
      countInUntil: 0, countInSeconds: 0, tempo: 120, now: performance.now() / 1000,
      handFilter: 'both', loop: {}, held: fpDemo ? new Set([...held, ...fpDemo]) : held, feedback,
      scale: freeScalePcs(),
      scaleRoot: freeRoot,
      chordName: fpChord.name,
      chordAlpha
    }) } catch (e) { if (!drawErrorLogged) { drawErrorLogged = true; console.log('RENDER ERROR (freeplay) ' + (e && e.message)) } }
    if (cameraOn() && fpGeo) {
      drawFingerBadges(ctx2d, fpGeo, fingerHover(fpGeo))
      if (!$('camPip').classList.contains('hidden')) drawCamera($('camPipCanvas'))
    }
    takeFrameDrawn()
    if (performance.now() > ledOverrideUntil) sendKeys(buildKeyFrame(null))
    return
  }
  if (!player || !song) return

  const snap = player.tick()
  player.snapshot.activeNotes = snap.activeNotes
  player.snapshot.upcomingNotes = snap.upcomingNotes

  try {
  const geo = drawScene(ctx2d, W, H, {
    position: snap.position,
    notes: player.speedNotes,
    activeNotes: snap.activeNotes,
    upcomingNotes: snap.upcomingNotes,
    view: settings.view,
    noteLabels: settings.labels,
    windowStart: snap.windowStart,
    waiting: snap.waiting,
    needPitches: snap.needPitches,
    playing: snap.playing,
    countInStart: snap.countInStart,
    countInUntil: snap.countInUntil,
    countInSeconds: snap.countInSeconds,
    countIn: player.countIn,
    tempo: snap.tempo,
    now: snap.now,
    handFilter: snap.handFilter,
    loop: snap.loop,
    held,
    waitNotes: snap.waitNotes,
    feedback,
    backdrop: backdropImg
  })
  if (cameraOn()) {
    drawFingerBadges(ctx2d, geo, fingerHover(geo))
    if (!$('camPip').classList.contains('hidden')) drawCamera($('camPipCanvas'))
  }
  } catch (e) {
    if (!drawErrorLogged) { drawErrorLogged = true; console.log('RENDER ERROR ' + (e && e.message)) }
  }
  takeFrameDrawn()   // the first frame of a take: recorder.js lines its sound up with it

  pumpAudio()
  syncRecording()
  updateLyrics(snap.position)

  // lights
  if (!daemon || !daemon.ready) {
    const desired = new Map()
    if (midiOutput) {
      const activeP = new Set(snap.activeNotes.map((n) => n.pitch))
      const upP = new Set(snap.upcomingNotes.map((n) => n.pitch))
      for (const pitch of activeP) desired.set(pitch, 127)
      for (const pitch of upP) if (!desired.has(pitch)) desired.set(pitch, 20)
      if (snap.waiting) for (const pitch of snap.needPitches) desired.set(pitch, 110)
    }
    updateNoteLights(desired)
  }
  if (performance.now() > ledOverrideUntil) {
    sendKeys(buildKeyFrame({
      snapshot: snap,
      windowStart: snap.windowStart,
      countInStart: snap.countInStart,
      countInUntil: snap.countInUntil,
      countInSeconds: snap.countInSeconds,
      song
    }))
  }

  // HUD
  const secFrom = player.sectionStart || 0
  const secLen = Math.max(0.001, player.end - secFrom)
  const pct = Math.max(0, Math.min(1, (snap.position - secFrom) / secLen))
  $('progressFill').style.width = (pct * 100).toFixed(2) + '%'
  const loop = snap.loop || {}
  const region = $('loopRegion'), mA = $('loopMarkerA'), mB = $('loopMarkerB')
  const at = (t) => Math.max(0, Math.min(100, ((t - secFrom) / secLen) * 100))
  if (loop.on && loop.a != null && loop.b != null && song.duration) {
    region.style.display = 'block'
    region.style.left = at(loop.a) + '%'
    region.style.width = (at(loop.b) - at(loop.a)) + '%'
    mA.style.display = mB.style.display = 'block'
    mA.style.left = at(loop.a) + '%'
    mB.style.left = at(loop.b) + '%'
  } else { region.style.display = mA.style.display = mB.style.display = 'none' }
  const fmt = (t) => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0')
  $('timeLabel').textContent = fmt(Math.max(0, snap.position - secFrom)) + ' / ' + fmt(secLen)
  setPlayIcon(snap.playing || snap.waiting)
  $('playhead').style.left = (pct * 100).toFixed(2) + '%'
  if (player.mode === 'WATCH') $('scoreHud').textContent = 'Watching'
  else if (player.score) {
    const s = summarize(player.score)
    $('scoreHud').textContent = s.totalNotesHit + s.missed ? `${Math.round(s.overallAccuracy * 100)}% · ${s.totalNotesHit} hit` : `${player.score.total} notes`
  }
}

// Queue upcoming song audio on the audio clock. Called from the render loop and
// from a timer, so playback keeps going even when frames are slow.
function pumpAudio() {
  if (freeplay || !player || !song) return
  const ac = audioContext()
  if (!ac) return
  const recording = hasRecording()
  scheduler.pump(player, { ctx: ac, accompany: settings.accompany !== false && !recording, watchSynth: !recording, band: settings.band && !recording ? bandEvents : null })
}

/* ============================== misc UI ============================== */
let toastTimer = null
function status(msg) {
  const el = $('status')
  if (!el || !msg) return
  el.textContent = msg
  el.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600)
}

// A short synthetic recording (one sine note per half second) as a WAV File.
async function synthTestRecording(name, tune) {
  const sr = 44100, dur = Math.max(2, tune.length * 0.5 + 0.5)
  const off = new OfflineAudioContext(1, Math.round(sr * dur), sr)
  tune.forEach((p, i) => {
    const o = off.createOscillator(); const g = off.createGain()
    o.frequency.value = 440 * Math.pow(2, (p - 69) / 12)
    const t = i * 0.5
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.3, t + 0.01); g.gain.exponentialRampToValueAtTime(0.01, t + 0.45)
    o.connect(g).connect(off.destination); o.start(t); o.stop(t + 0.48)
  })
  const buf = await off.startRendering()
  const pcm = buf.getChannelData(0)
  const wav = new DataView(new ArrayBuffer(44 + pcm.length * 2))
  const w = (o, str) => { for (let i = 0; i < str.length; i++) wav.setUint8(o + i, str.charCodeAt(i)) }
  w(0, 'RIFF'); wav.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVEfmt '); wav.setUint32(16, 16, true); wav.setUint16(20, 1, true); wav.setUint16(22, 1, true)
  wav.setUint32(24, sr, true); wav.setUint32(28, sr * 2, true); wav.setUint16(32, 2, true); wav.setUint16(34, 16, true); w(36, 'data'); wav.setUint32(40, pcm.length * 2, true)
  for (let i = 0; i < pcm.length; i++) wav.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 32767, true)
  return new File([wav.buffer], name, { type: 'audio/wav' })
}

/* ============================== self test ============================== */
async function runSelfTest() {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  try {
    const res = await fetch('songs/twinkle.xml')
    song = await loadSongFile({ name: 'twinkle.xml', text: () => res.text() })
    song.title = 'Twinkle Twinkle Little Star'
    showScreen('play')
    console.log(`SELFTEST song notes=${song.notes.length} dur=${song.duration.toFixed(2)}`)

    // A) wait mode: engage, resume, advance to the next group
    const p1 = new Player({ getCtx: audioContext })
    p1.load(song); p1.setCountIn(0); p1.setMode('PRACTISE'); p1.play()
    await sleep(90)
    let s1 = p1.tick()
    console.log(`SELFTEST wait engaged=${s1.waiting} need=[${[...s1.needPitches]}]`)
    for (const n of (p1._groups[0] ? p1._groups[0].notes : [])) p1.noteOn(n.pitch)
    await sleep(80)
    let s2 = p1.tick()
    console.log(`SELFTEST wait resumed=${!s2.waiting && s2.playing} pos=${s2.position.toFixed(2)}`)
    await sleep(750)
    let s3 = p1.tick()
    console.log(`SELFTEST next wait=${s3.waiting} need=[${[...s3.needPitches]}] pos=${s3.position.toFixed(2)}`)
    p1.pause()

    // B) scoring: exact-time hits
    const p2 = new Player({ getCtx: audioContext })
    p2.load(song); p2.setMode('PLAY')
    p2.setCountIn(0); if (!p2.active) p2.play()
    for (const n of song.notes.slice(0, 6)) { p2.seek(n.start); p2.noteOn(n.pitch) }
    p2.pause()
    const sum = summarize(p2.score)
    console.log(`SELFTEST score hits=${sum.totalNotesHit} perfect=${sum.perfect} good=${sum.good} missed=${sum.missed} stars=${sum.starRating}`)

    // C) loop: jump back at the end marker
    const p3 = new Player({ getCtx: audioContext })
    p3.load(song); p3.setMode('PLAY'); p3.setRate(1)
    p3.setLoop(0.5, 1.5, true); p3.seek(1.4); p3.play()
    await sleep(320)
    const s4 = p3.tick()
    console.log(`SELFTEST loop pos=${s4.position.toFixed(2)} (expect <=1.5)`)

    // D) count-in
    const p4 = new Player({ getCtx: audioContext })
    p4.load(song); p4.setCountIn(4); p4.play()
    const s5 = p4.tick()
    console.log(`SELFTEST countIn seconds=${s5.countInSeconds.toFixed(2)} pos=${s5.position.toFixed(2)}`)
    p4.pause()

    // E) results overlay
    showResults(sum)
    console.log('SELFTEST results visible=' + !$('results').classList.contains('hidden') + ' stars=' + sum.starRating)
    hideResults()

    // F) watch mode has no scoring
    const p5 = new Player({ getCtx: audioContext })
    p5.load(song); p5.setMode('WATCH'); p5.play()
    await sleep(60); const s6 = p5.tick()
    console.log(`SELFTEST watch mode=${s6.mode} score=${s6.summary === null ? 'none' : 'present'} pos=${s6.position.toFixed(2)}`)
    p5.pause()

    // G) ceremony + practice time recording
    celebrate(sum?.starRating || 4)
    recordPractice(90)
    refreshProgressUI()
    console.log('SELFTEST streak=' + store.get('lumi.streak.count', 0) + ' playedToday=' + ($('playedToday') ? $('playedToday').textContent : 'n/a'))

    // H) toolbox exercise + rating persistence
    tb.type = 'scale'; tb.tonic = 0; tb.hand = 'both'
    exerciseMeta = { type: tb.type, tonic: tb.tonic, hand: tb.hand }
    const exSong = makeExerciseSong()
    const p6 = new Player({ getCtx: audioContext })
    p6.load(exSong); p6.setMode('PLAY')
    p6.setCountIn(0); if (!p6.active) p6.play()
    for (const n of exSong.notes.slice(0, 4)) { p6.seek(n.start); p6.noteOn(n.pitch) }
    p6.pause()
    onFinish(summarize(p6.score))
    console.log('SELFTEST exercise notes=' + exSong.notes.length + ' stars stored=' + store.get(exerciseKey(), 0) + ' key=' + exerciseKey())
    exerciseMeta = null
    hideResults()

    // I) lessons: run a challenge step, store stars, unlock next lesson
    const lockedBefore = lessonUnlocked(1)
    await startLessonStep(LESSONS[0], 'PLAY')
    if (player) {
      player.setCountIn(0); if (!player.active) player.play()
    for (const n of song.notes.slice(0, 5)) { player.seek(n.start); player.noteOn(n.pitch) }
    player.pause()
      console.log('SELFTEST lesson debug hits=' + player.score.hits + ' mode=' + player.mode + ' meta=' + JSON.stringify(lessonMeta))
      onFinish(summarize(player.score))
      console.log('SELFTEST lesson stored=' + JSON.stringify(store.get(lessonStepKey(lessonMeta ? lessonMeta.id : 'x', lessonMeta ? lessonMeta.step : 'x'), -1)))
      hideResults()
    }
    console.log(`SELFTEST lesson step stars=${lessonStepStars(LESSONS[0].id, 'PLAY')} nextLockedBefore=${lockedBefore} nextUnlocked=${lessonUnlocked(1)}`)
    lessonMeta = null

    // J) generated band + Tier-B fallback
    bandEvents = computeBand(song)
    console.log('SELFTEST band events=' + bandEvents.length + ' firstPitch=' + (bandEvents[0] ? bandEvents[0].pitch : 'none'))
    // K) audio scheduler: exact note times, repeated pitches re-struck, waits respected
    {
      initAudio()
      const ac = audioContext()
      if (ac.state === 'suspended') await ac.resume()
      console.log('SELFTEST audio state=' + ac.state + ' outputLatency=' + ((ac.outputLatency || ac.baseLatency || 0) * 1000).toFixed(1) + 'ms')
      const tw = await loadSongFile({ name: 'twinkle.xml', text: () => fetch('songs/twinkle.xml').then((r) => r.text()) })
      const rec = []
      const sink = { note: (pitch, vel, when, dur) => rec.push({ pitch, when, dur }), cancel: () => {}, click: () => {}, bass: () => {}, hat: () => {} }
      const sch = new SongScheduler(sink)
      const pw = new Player({ getCtx: audioContext })
      pw.load(tw); pw.setCountIn(0); pw.setMode('WATCH'); pw.play()
      for (let i = 0; i < 40; i++) { sch.pump(pw, { ctx: ac, accompany: true, band: null }); await sleep(25) }
      pw.pause()
      const expect = tw.notes.filter((n) => n.start < 0.9)
      let worst = 0
      for (const n of expect) {
        const hit = rec.find((r) => r.pitch === n.pitch && Math.abs((r.when - pw.timeAt(0)) - n.start) < 0.005)
        worst = Math.max(worst, hit ? Math.abs((hit.when - pw.timeAt(0)) - n.start) : 1)
      }
      const firstPitch = tw.notes[0].pitch
      const repeats = rec.filter((r) => r.pitch === firstPitch).length
      console.log(`SELFTEST scheduler notes=${rec.length} expected>=${expect.length} worstError=${(worst * 1000).toFixed(2)}ms repeatsOfFirstPitch=${repeats} (expect >=2)`)

      const rec2 = []
      const sch2 = new SongScheduler({ ...sink, note: (pitch, vel, when) => rec2.push({ pitch, when }) })
      const pp = new Player({ getCtx: audioContext })
      pp.load(tw); pp.setCountIn(0); pp.setMode('PRACTISE'); pp.setHandFilter('left'); pp.play()
      for (let i = 0; i < 20; i++) { pp.tick(); sch2.pump(pp, { ctx: ac, accompany: true, band: null }); await sleep(25) }
      console.log(`SELFTEST accompaniment (practise left hand, right hand auto) scheduled=${rec2.length} waiting=${pp.waiting}`)
      pp.pause()
    }
    // K2) a lesson section ends with a result instead of looping forever
    {
      const tw = await loadSongFile({ name: 'twinkle.xml', text: () => fetch('songs/twinkle.xml').then((r) => r.text()) })
      let finished = false
      const ps = new Player({ getCtx: audioContext, onFinish: () => { finished = true } })
      ps.load(tw); ps.setCountIn(0); ps.setMode('PLAY'); ps.setSection(0, 4)
      ps.seek(3.85); ps.play()
      for (let i = 0; i < 12 && !finished; i++) { await sleep(40); ps.tick() }
      console.log(`SELFTEST section finished=${finished} end=${ps.end} pos=${ps.position.toFixed(2)}`)
      // switching to Wait mid-song waits at the playhead, not back at 0:00
      const pw2 = new Player({ getCtx: audioContext })
      pw2.load(tw); pw2.setCountIn(0); pw2.setMode('PLAY'); pw2.seek(5); pw2.setMode('PRACTISE'); pw2.play()
      await sleep(60)
      const sw = pw2.tick()
      console.log(`SELFTEST practise-from-middle waiting=${sw.waiting} pos=${sw.position.toFixed(2)} (expect ~5, not 0)`)
      pw2.pause()
    }
    // N) importing a recording: synthesise one, transcribe it, save, reopen, delete
    {
      const ac = initAudio()
      const file = await synthTestRecording('Test Artist - Test Tune.wav', [60, 60, 67, 67, 69, 69, 67])
      const t0 = performance.now()
      const imp = await importFile(file, { ctx: ac, simplify: false, lookup: false })
      console.log(`SELFTEST import notes=${imp.notes.length} pitches=${imp.notes.slice(0, 7).map((n) => n.pitch).join(',')} (expect 60,60,67,67,69,69,67) title="${imp.title}" artist="${imp.artist}" tempo=${imp.tempo} in ${((performance.now() - t0) / 1000).toFixed(1)}s`)
      const rec = await saveImported(imp)
      const back = await getImported(rec.id)
      console.log(`SELFTEST import saved id=${rec.id} reopened notes=${back.notes.length} audio=${back.audio ? back.audio.size : 0}B`)
      await deleteImported(rec.id)
      console.log(`SELFTEST import deleted=${!(await getImported(rec.id))}`)
      const { fetchLyrics, fetchCover } = await import('./importer.js')
      const [ly, cv] = await Promise.all([fetchLyrics('Amazing Grace', '', null), fetchCover('Ode to Joy', 'Beethoven')])
      console.log(`SELFTEST lookup lyrics=${ly ? (ly.synced ? 'synced ' + ly.synced.length : 'plain') : 'none'} cover=${cv ? Math.round(cv.length / 1024) + 'KB' : 'none'}`)
    }
    // O) hand tracking model loads and runs (no camera needed)
    try {
      const { selfTestLandmarker } = await import('./handtrack.js')
      const t0 = performance.now()
      const n = await selfTestLandmarker()
      console.log(`SELFTEST hands model ok, hands on a blank picture=${n} in ${((performance.now() - t0) / 1000).toFixed(1)}s`)
      const ht = new HandTracker()
      ht.calib = { a: { x: 0.1, y: 0.5 }, b: { x: 0.9, y: 0.5 } }
      const q = ht.project({ x: 0.5, y: 0.52 })
      console.log(`SELFTEST hands projection t=${q.t.toFixed(2)} off=${q.off.toFixed(3)} (expect 0.50, about -0.014 with 16:9 scaling)`)
    } catch (e) { console.log('SELFTEST hands FAIL ' + e.message) }
    // L) MusicXML: chords start together, ties merge, staff picks the hand
    {
      const xml = `<score-partwise><part id="P1"><measure><attributes><divisions>1</divisions></attributes>
        <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><tie type="start"/><staff>1</staff></note>
        <note><chord/><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><staff>1</staff></note>
        <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><tie type="stop"/><staff>1</staff></note>
        <backup><duration>2</duration></backup>
        <note><pitch><step>C</step><octave>3</octave></pitch><duration>2</duration><staff>2</staff></note>
      </measure></part></score-partwise>`
      const parsed = parseMusicXml(xml)
      const d = parsed.notes.map((n) => `${n.pitch}@${n.start.toFixed(2)}/${n.dur.toFixed(2)}/${n.hand}`).join(' ')
      console.log('SELFTEST musicxml ' + d + ' (expect 48@0/1.00/left 60@0/1.00/right 64@0/0.50/right)')
    }
    // L2) fingering, MusicXML title / metre / metronome / voltas / cue + grace, and an .mxl import
    try {
      const scale = await loadSongFile({ name: 'c-major-scale.xml', text: () => fetch('songs/c-major-scale.xml').then((r) => r.text()) })
      console.log('SELFTEST fingering c-major-scale=' + scale.notes.map((n) => n.finger).join('') + ' (expect 1231234554321321)')
      const p = parseMusicXml(`<score-partwise><work><work-title>Lightly Row</work-title></work><identification><creator type="composer">Traditional</creator></identification>
        <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1">
        <measure number="1"><barline location="left"><repeat direction="forward"/></barline><attributes><divisions>1</divisions><time><beats>3</beats><beat-type>4</beat-type></time></attributes>
          <direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>90</per-minute></metronome></direction-type></direction>
          <note><grace/><pitch><step>B</step><octave>3</octave></pitch></note>
          <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><notations><technical><fingering>2</fingering></technical></notations></note>
          <note><cue/><pitch><step>A</step><octave>5</octave></pitch><duration>1</duration></note></measure>
        <measure number="2"><barline location="left"><ending number="1" type="start"/></barline><note><pitch><step>D</step><octave>4</octave></pitch><duration>3</duration></note>
          <barline location="right"><ending number="1" type="stop"/><repeat direction="backward"/></barline></measure>
        <measure number="3"><barline location="left"><ending number="2" type="start"/></barline><note><pitch><step>E</step><octave>4</octave></pitch><duration>3</duration></note>
          <barline location="right"><ending number="2" type="discontinue"/></barline></measure></part></score-partwise>`)
      const ts = p.timeSignature ? p.timeSignature.beats + '/' + p.timeSignature.beatType : 'none'
      console.log(`SELFTEST musicxml depth title="${p.title}" artist="${p.artist}" time=${ts} tempo=${p.tempo} play=${p.notes.map((n) => n.pitch + '@' + n.start.toFixed(1)).join(',')} fingers=${p.notes.map((n) => n.finger || '-').join('')} (expect "Lightly Row" "Traditional" 3/4 90 60@0.0,62@2.0,60@4.0,64@6.0 2-2-)`)
      // an .mxl made with the zip tool: container.xml + deflated score.xml
      const mxl = Uint8Array.from(atob('UEsDBBQAAAAIAKurXV1WmLb/YgAAAIQAAAAWAAAATUVUQS1JTkYvY29udGFpbmVyLnhtbE3NMQ6AIAyF4d1TEFajXAC9SwM1NimUQDV6e3HS7Q3fy++DZAXKWFdfRXQjxvZNsx3MUwHdF9uCVJyvxNYkjAST3gUXC6UwBVCS7M4c54rdReg0HY1C9+P7cat3v4D7usMDUEsDBBQAAAAIAKqrXV35qzlQkQEAAN0EAAAJAAAAc2NvcmUueG1stVSxctswDN37FTrtOsZNRphL2mbN0KkbRcExLhKpglB8+fuQJn1UbGdIc10kAHx4eAAFQbCesZsNy4ECajh4fs7PTkhG1H9obn5jEFCrYHY00IBOaEfWCHmnwTIa8dzI64zb1vpp9gG51YmguS8uqAKLNOcESUg3UhANVVlDw7Z93LTl2JkJ9SMZ50HVAKiaoMtBJnpPMaEJC2PjlqlH3rYp1hseyWEz+qxj2464k3jAOEelzUCMNh/sPB8MD62KNUqaBiPC1C+CQcNALxQiNOgNqOqAUBLZR7qg72Lu0Tj6XZrWKZYdUBmu3jMXFSuzwCcU9s6fKnSLI9F/l9h4GncNwYzcTeQiod7c3MQxVR/UikWdV1Cr6s4n+Exi9/GaBGd9H6ef3uCtmJdjM8WKJTJuWDjfcRrLyU5URysNCO3exQ9h1LAj94QcHwlcnTiVilGrVJUVXer68a+6PmT8+b86vf1ap7++2OnlCjA97a/vQG/s8+USqLJZlyv2vb2m+OETiu+uKK71VNn5s3/ZtzdQSwECHgMUAAAACACrq11dVpi2/2IAAACEAAAAFgAAAAAAAAABAAAApIEAAAAATUVUQS1JTkYvY29udGFpbmVyLnhtbFBLAQIeAxQAAAAIAKqrXV35qzlQkQEAAN0EAAAJAAAAAAAAAAEAAACkgZYAAABzY29yZS54bWxQSwUGAAAAAAIAAgB7AAAATgIAAAAA'), (c) => c.charCodeAt(0))
      const imp = await importFile(new File([mxl], 'Someone - Other Name.mxl'), { lookup: false })
      console.log(`SELFTEST mxl import title="${imp.title}" artist="${imp.artist}" notes=${imp.notes.map((n) => n.pitch).join(',')} fingers=${imp.notes.map((n) => n.finger).join('')} tempo=${imp.tempo} (expect "Zip Test" "Test Composer" 60,62,64,65,60,62,64,65,67 123412345 100)`)
    } catch (e) { console.log('SELFTEST learn FAIL ' + e.message) }
    // M) octave calibration from what the keys send
    {
      const savedZero = settings.kbZero, savedOct = kbOctave
      kbSetAt = 0
      const before = kbBase()
      const played = before + 30
      calibrateFromNote(played)
      const nb = settings.kbZero + 12 * savedOct
      console.log(`SELFTEST calibrate played=${played} oldBase=${before} newBaseAtSameOctave=${nb} contains=${played >= nb && played < nb + 24}`)
      settings.kbZero = savedZero; saveSettings()
      setKeyboardWindow(savedZero + 12 * savedOct)
    }
    const before = litNotes.size
    updateNoteLights(new Map([[60, 127], [64, 20]]))
    console.log('SELFTEST noteLight fallback lit=' + litNotes.size + ' (was ' + before + ')')
    clearNoteLights()
    console.log('SELFTEST noteLight cleared=' + litNotes.size)
    // the Windows light sweep on a stand-in port: every key on, then off, and a sweep that
    // starts over lets go of the keys the first one still held
    {
      const sent = []
      const port = { send: (m) => sent.push(m) }
      midiLightSweep(port)
      await new Promise((r) => setTimeout(r, 200))
      const ms = midiLightSweep(port)
      await new Promise((r) => setTimeout(r, ms + 100))
      const count = new Map()
      for (const [st, p] of sent) count.set(p, (count.get(p) || 0) + (st === 0x90 ? 1 : -1))
      const ons = sent.filter((m) => m[0] === 0x90)
      console.log(`SELFTEST windows light sweep keys=${new Set(ons.map((m) => m[1])).size} ons=${ons.length} stuck=${[...count.values()].filter((c) => c !== 0).length} ms=${ms} (expect 24, over 24, 0, under 1600)`)
    }

    // K) game: passing run stores stars
    const g = GAMES[0]
    await startGame(g)
    if (player) {
      player.setCountIn(0); if (!player.active) player.play()
    for (const n of song.notes.slice(0, 8)) { player.seek(n.start); player.noteOn(n.pitch) }
    player.pause()
      const gsum = summarize(player.score)
      onFinish(gsum)
      console.log(`SELFTEST game=${g.id} accuracy=${(gsum.overallAccuracy * 100).toFixed(0)}% pass=${gsum.game ? gsum.game.passed : '?'} bestStars=${gameBest(g.id)}`)
      hideResults()
    }
    gameMeta = null

    // L) stems + wait-mode advancement
    console.log('SELFTEST stem pick (no audio)=' + pickStem(false) + '/' + pickStem(true))
    const p7 = new Player({ getCtx: audioContext })
    p7.load(song); p7.setMode('PRACTISE'); p7.setAdvancement('pauseAndPlay')
    console.log('SELFTEST advancement=' + p7.advancement)
    p7.setAdvancement('pauseAndSnap')
    console.log('SELFTEST advancement2=' + p7.advancement)

    // M) MPE expression, sustain pedal, light styles
    initAudio()
    setBendRange(12); setInstrument('flute')
    noteOn(60, 100, 1)
    setPressure(1, 0.9); setSlide(1, 0.6); setBend(1, 4)   // 4 of 12 semitones
    console.log('SELFTEST mpe voice=' + JSON.stringify(voiceState(1, 60)) + ' active=' + activeVoiceCount())
    noteOff(60, 1)
    setInstrument('grand')
    noteOn(62, 100, 0); setSustain(true); noteOff(62, 0)
    const underPedal = activeVoiceCount()
    setSustain(false)
    console.log('SELFTEST pedal ringing=' + underPedal + ' afterPedalUp=' + activeVoiceCount() + ' (expect 1 then 0)')
    // a held piano note keeps sounding; held instruments start at once; pressure never ducks
    const env = []
    for (const [id, p0] of [['grand', false], ['cello', false], ['cello', true], ['flute', false]]) env.push(await envelopeReport(id, p0))
    console.log('SELFTEST envelope ' + env.join(' | '))
    const savedStyle = settings.keyboardMode
    const styleFrames = {}
    held.clear()
    for (const m of LIGHT_STYLES) {
      settings.keyboardMode = m
      stylePreviewAt = 0
      const f = buildKeyFrame({ snapshot: { activeNotes: [{ pitch: 60, hand: 'right' }], upcomingNotes: [{ pitch: 64, hand: 'left' }], waiting: false, needPitches: new Set() }, windowStart: 60, song })
      const r = restFrame()
      held.add(kbBase() + 2)
      const pressed = restFrame()[2]
      held.clear()
      styleFrames[m] = 'now ' + f[0].join(',') + ' next ' + f[4].join(',') + ' rest lit=' + r.filter((c) => c.some((v) => v > 0)).length + ' press ' + pressed.join(',')
    }
    console.log('SELFTEST styles ' + JSON.stringify(styleFrames))
    settings.keyboardMode = 'Piano'; cycleLightStyle()
    console.log('SELFTEST mode button Piano->' + settings.keyboardMode + ' (expect Pro)')
    settings.keyboardMode = savedStyle
    const savedExpr = settings.expression
    settings.expression = false
    const off = desiredDeviceConfig()
    settings.expression = true
    const on = desiredDeviceConfig()
    settings.expression = savedExpr
    console.log('SELFTEST device config off=' + [2, 102, 103, 109, 110, 116, 117, 123, 124].map((k) => off[k]).join('') +
      ' on=' + [2, 102, 103, 109, 110, 116, 117, 123, 124].map((k) => on[k]).join('') + ' (expect 000000000 / 111111111)')

    // N) render smoke test (count-in HUD used to crash with s.now number)
    try {
      drawScene(ctx2d, canvas.width / stageDpr, canvas.height / stageDpr, {
        position: 0.5, notes: song.notes, activeNotes: [], upcomingNotes: [],
        view: 'CASCADE', noteLabels: 'names', windowStart: player ? player.windowStart : 60,
        waiting: true, needPitches: new Set([60]), playing: true,
        countInUntil: audioContext() ? audioContext().currentTime + 2 : 0, countInSeconds: 2.5,
        tempo: 120, now: performance.now() / 1000, handFilter: 'both', loop: {}
      })
      console.log('SELFTEST render ok')
    } catch (e) { console.log('SELFTEST render FAIL ' + e.message) }

    // O) lights frame + daemon
    const frame = buildKeyFrame({ snapshot: { activeNotes: [], upcomingNotes: [], waiting: false, needPitches: new Set() }, windowStart: 60, song })
    console.log('SELFTEST led frame keys=' + frame.length + ' daemon=' + (daemon && daemon.ready ? 'ready' : 'absent'))

    // P) first-run setup: the two end keys pin the range; the setup opens and closes cleanly
    {
      const e = [readEndKeys(null, 48, 48), readEndKeys(48, 71, 48), readEndKeys(60, 83, 48), readEndKeys(null, 50, 48)]
      console.log(`SELFTEST setup end keys low=${e[0].low} done=${e[1].done} shift=${e[1].shift} octaveOff=${e[2].shift} wrong=${e[3].wrong} (expect 48 true 0 12 50)`)
      const onboarded = store.get('lumi.onboarded', false)
      openSetup(2)
      const shown = !$('onboarding').classList.contains('hidden') && $('onboarding').dataset.step
      closeSetup()
      console.log(`SELFTEST setup opened=${shown} closed=${$('onboarding').classList.contains('hidden')} appInert=${$('app').inert} onboardedKept=${store.get('lumi.onboarded', false) === onboarded} (expect keyboard true false true)`)
    }
    // Q) octave − / +: the range moves 12 and back, and the sweep travels the way it moved
    {
      const lead = () => {
        const f = Array.from({ length: 24 }, () => [0, 0, 0])
        drawOctaveSweep(f, kbBase())
        let best = -1, top = 0
        f.forEach((c, i) => { if (c[0] + c[1] + c[2] > top) { top = c[0] + c[1] + c[2]; best = i } })
        return best
      }
      const from = kbBase()
      shiftOctave(1)
      const up = kbBase() - from
      if (up) {
        await sleep(120); const a = lead(); await sleep(180); const b = lead()
        shiftOctave(-1)
        await sleep(120); const c = lead(); await sleep(180); const d = lead()
        console.log(`SELFTEST octave up=${up} sweep ${a}->${b}, down back=${kbBase() === from} sweep ${c}->${d} label=${$('lblOctave').textContent} (expect 12, rising, true, falling)`)
      } else console.log(`SELFTEST octave buttons need the light service: moved=${up} daemon=${daemon && daemon.ready ? 'ready' : 'absent'}`)
    }
    // keys) Playground chord names, the keyboard's buttons by context, the light test; a block
    // of its own, so its names cannot clash with the other checks here
    {
      const chordCases = [[[60, 64, 67], 'C'], [[57, 60, 64], 'Am'], [[60, 64, 67, 70], 'C7'], [[64, 67, 72], 'C/E'],
        [[55, 59, 62, 66], 'Gmaj7'], [[60, 63, 66, 69], 'Cdim7'], [[62, 66, 69, 72], 'D7'], [[52, 55, 57, 60], 'Am7/E'],
        [[60, 67], 'perfect fifth'], [[61], 'C♯'], [[60, 61, 62], ''], [[], '']]
      const chordBad = chordCases.filter(([ps, want]) => chordName(ps) !== want).map(([ps, want]) => ps.join(',') + '=' + chordName(ps) + '(want ' + want + ')')
      const inF = chordSpeller(5, SCALES[0][1]), inG = chordSpeller(7, SCALES[0][1])
      console.log('SELFTEST chordName cases=' + chordCases.length + ' bad=' + (chordBad.join(' ') || 'none') +
        ' F:' + chordName([58, 62, 65], inF) + ' G:' + chordName([54, 57, 60, 64], inG) + ' (expect B♭ / F♯m7♭5)')
      const at = (o) => Object.assign({ screen: 'play', results: false, overlay: false, freeplay: false, player: false, loopSections: false }, o)
      const buttonCases = [
        [4, at({ results: true }), 'results-next'], [3, at({ results: true }), 'results-close'],
        [4, at({ freeplay: true }), 'scale-next'], [3, at({ freeplay: true }), 'scale-prev'],
        [3, at({ player: true }), 'play-pause'], [4, at({ player: true }), 'restart'],
        [3, at({ player: true, loopSections: true }), 'loop-earlier'], [4, at({ player: true, loopSections: true }), 'loop-later'],
        [4, at({ screen: 'home' }), 'continue'], [3, at({ screen: 'home' }), null], [4, at({ screen: 'home', overlay: true }), null],
        [4, at({ screen: 'settings' }), null], [0, at({ player: true }), 'mode-hold'], [0, at({ screen: 'home' }), 'light-style'],
        [1, at({ freeplay: true }), 'octave-down'], [2, at({ results: true }), 'octave-up']
      ]
      const buttonBad = buttonCases.filter(([id, c, want]) => keyButtonAction(id, c) !== want).map(([id, c, want]) => id + JSON.stringify(c) + '=' + keyButtonAction(id, c) + '(want ' + want + ')')
      console.log('SELFTEST keyButtons cases=' + buttonCases.length + ' bad=' + (buttonBad.join(' ') || 'none'))
      const walk = (a, b, dir) => JSON.stringify(loopWalkRange(a, b, [0, 2, 4, 6, 8, 10], dir, 0, 12))
      console.log('SELFTEST loop walk ' + walk(0, 4, 1) + ' ' + walk(4.3, 7.9, -1) + ' ' + walk(8, 12, 1) + ' (expect {"a":4,"b":8} {"a":0,"b":4} null)')
      buttonIdWarned = false
      handleKeyButton(undefined, 'press')
      const noIdToast = $('status').textContent
      $('status').textContent = ''
      handleKeyButton(undefined, 'release')
      console.log('SELFTEST keyButtons no button_id toast="' + noIdToast + '" again=' + ($('status').textContent ? 'yes' : 'no (expect no)'))
      if (player) {
        // the mode button: held past MODE_HOLD_MS flips Wait/Play and keeps the style; a tap moves the style on
        const mode0 = player.mode, style0 = lightStyle(), inPlayer = at({ player: true })
        handleKeyButton(0, 'press', inPlayer); await sleep(MODE_HOLD_MS + 80); handleKeyButton(0, 'release', inPlayer)
        const modeHeld = player.mode, styleHeld = lightStyle()
        handleKeyButton(0, 'press', inPlayer); await sleep(120); handleKeyButton(0, 'release', inPlayer)
        console.log('SELFTEST keyButtons mode hold ' + mode0 + '->' + modeHeld + ' style kept=' + (styleHeld === style0) + ' tap ' + style0 + '->' + lightStyle())
        setLightStyle(style0, false); setMode(mode0)
      }
      const idx0 = freeScaleIdx, sub0 = $('subtitle').textContent
      handleKeyButton(4, 'press', at({ freeplay: true })); const scaleUp = freeScaleIdx
      handleKeyButton(3, 'press', at({ freeplay: true })); handleKeyButton(3, 'press', at({ freeplay: true }))
      console.log('SELFTEST keyButtons scales ' + idx0 + '->' + scaleUp + '->' + freeScaleIdx + ' of ' + SCALES.length)
      freeScaleIdx = idx0; syncFreeplayBar(); $('subtitle').textContent = sub0
      const lt = lightTestFrames(48)
      const everyKey = Array.from({ length: 24 }, (_, i) => lt.some((f) => f[i].some((v) => v > 0))).every(Boolean)
      const endsOff = lt.slice(-2).every((f) => f.every((c) => c.every((v) => v === 0)))
      console.log('SELFTEST light test frames=' + lt.length + ' (' + (lt.length - 2) * LIGHT_TEST_STEP_MS + ' ms sweep) everyKeyLit=' + everyKey + ' endsAllOff=' + endsOff)
      console.log('SELFTEST keyboard info ' + JSON.stringify(daemon ? daemon.device : null))
    }
    // engine: count-in at half speed, local days, hands, wait-mode hints, ports, the
    // practice ticker, results keys, lesson and game results. A fake audio clock
    // (clk.currentTime) steps time without waiting for it.
    {
      const tw = await loadSongFile({ name: 'twinkle.xml', text: () => fetch('songs/twinkle.xml').then((r) => r.text()) })
      const clk = { currentTime: 100 }
      const clicks = []
      const sch = new SongScheduler({ note: () => {}, cancel: () => {}, click: (accent, at) => clicks.push(at), bass: () => {}, hat: () => {} })
      const pc = new Player({ getCtx: () => clk })
      pc.load(tw); pc.setRate(0.5); pc.setCountIn(4); pc.play()
      const running = pc.snapshot().countInSeconds
      for (let i = 0; i < 100 && clicks.length < 4; i++) { sch.pump(pc, { ctx: clk, accompany: false, band: null }); clk.currentTime += 0.1 }
      const beat = 60 / (tw.tempo * 0.5)
      console.log(`SELFTEST engine countIn rate=0.5 seconds=${pc.countInSeconds.toFixed(3)} running=${running.toFixed(3)} clicks=${clicks.length} gaps=${clicks.slice(1).map((t, i) => (t - clicks[i]).toFixed(3)).join(',')} (expect ${(4 * beat).toFixed(3)}, 4 clicks ${beat.toFixed(3)} apart)`)

      console.log(`SELFTEST engine dayKey=${dayKey(new Date(2026, 0, 5, 23, 30))} today=${todayKey()} local=${todayKey() === new Date().toLocaleDateString('sv-SE')} yesterday=${yesterdayKey()} (expect 2026-01-05, local=true)`)

      // Left on a song with no left-hand part opens with both hands, and Hands skips Left
      const savedHands = settings.hands
      settings.hands = 'left'
      song = { title: 'Right hand only', artist: 'Test', file: 'selftest-right.xml', tempo: 120, duration: 2.2, notes: [60, 62, 64, 65].map((pitch, i) => ({ pitch, start: i * 0.5, dur: 0.4, vel: 100, hand: 'right' })) }
      startSong()
      const opened = player.handFilter, label = $('lblHands').textContent, toast = $('status').textContent
      cycleHands()
      console.log(`SELFTEST engine hands counts=${JSON.stringify(song.handCounts)} saved=left opened=${opened} label=${label} toast="${toast}" cycle->${player.handFilter} (expect both, Both, no left-hand part, right)`)
      settings.hands = savedHands; saveSettings(); player.setHandFilter(savedHands)

      // wait mode: found at once = cold; after a wrong key or a wait over 1.5 s = hinted
      const ph = new Player({ getCtx: () => clk })
      ph.load(song); ph.setCountIn(0); ph.setMode('PRACTISE'); ph.play()
      const at = (dt) => { clk.currentTime += dt; return ph.tick() }
      const waits = [at(0.01).waiting]
      ph.noteOn(60)
      waits.push(at(0.5).waiting); ph.noteOn(61); ph.noteOn(62)
      waits.push(at(0.5).waiting); clk.currentTime += 2; ph.noteOn(64)
      waits.push(at(0.5).waiting); ph.noteOn(65)
      const hs = summarize(ph.score, 'PRACTISE')
      console.log(`SELFTEST engine hints waits=${waits.join(',')} kinds=${ph.score.expected.map((e) => e.kind).join(',')} wrong=${hs.wrong} firstTime=${Math.round(hs.overallAccuracy * 100)}% stars=${hs.starRating} (expect all true, cold,hinted,hinted,cold, 1, 50%, 1)`)

      const port = (name, more = {}) => ({ name, manufacturer: '', state: 'connected', ...more })
      const pa = pickPorts([port('IAC Driver Bus 1', { manufacturer: 'Apple Inc.' }), port('LUMI Keys BLOCK', { manufacturer: 'ROLI Ltd.' })], [port('IAC Driver Bus 1'), port('LUMI Keys BLOCK')])
      const pb = pickPorts([port('IAC Driver Bus 1'), port('Network Session 1')], [port('IAC Driver Bus 1'), port('Network Session 1')])
      const pd = pickPorts([port('LUMI Keys BLOCK', { state: 'disconnected' }), port('Digital Piano')], [port('LUMI Keys BLOCK', { state: 'disconnected' }), port('Digital Piano')])
      const nm = (p) => (p ? p.name : 'none')
      console.log(`SELFTEST engine ports lumi=${nm(pa.input)}/${nm(pa.output)} busOnly=${nm(pb.input)}/${nm(pb.output)} lumiGone=${nm(pd.input)}/${nm(pd.output)} live=${midiInput ? midiInput.name : 'none'} (expect LUMI Keys BLOCK/LUMI Keys BLOCK, none/none, Digital Piano/none)`)
      const pm = pickPorts([port('Piano M')], [port('Piano M')])
      const pr = pickPorts([port('ROLI Piano M')], [port('ROLI Piano M')])
      console.log(`SELFTEST engine ports pianoM=${nm(pm.input)}/${nm(pm.output)} roliPianoM=${nm(pr.input)}/${nm(pr.output)} (expect Piano M/Piano M, ROLI Piano M/ROLI Piano M)`)

      // the practice ticker, on the right-hand-only song: waiting counts only with a key
      // in the last 20 s; a running clock always counts
      player.setCountIn(0); player.setMode('PRACTISE'); player.play()
      await sleep(80); player.tick()
      const today = () => store.get('lumi.days', {})[todayKey()] || 0
      const s0 = today(), waiting = player.waiting
      lastKeyAt = -Infinity; practiceTick(); const idle = today() - s0
      lastKeyAt = performance.now(); practiceTick(); const keyed = today() - s0
      lastKeyAt = performance.now() - 30000; practiceTick(); const stale = today() - s0
      player.pause(); player.setMode('PLAY'); player.play(); practiceTick(); const clock = today() - s0
      player.pause()
      console.log(`SELFTEST engine ticker waiting=${waiting} idle=+${idle} key=+${keyed} after20s=+${stale} clock=+${clock} (expect true, +0 +1 +1 +2)`)

      // results: a dialog with the way on focused; Escape closes it and nothing restarts
      showResults(summarize(player.score, 'PLAY'))
      const focused = document.activeElement && document.activeElement.id, inert = $('app').inert
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }))
      console.log(`SELFTEST engine results focus=${focused} inert=${inert} escape closed=${$('results').classList.contains('hidden')} inertAfter=${$('app').inert} playing=${player.active} (expect resAgain true true false false)`)

      // a finished lesson Practise step is done (no stars) and leads to the Challenge;
      // a Practise step switched to full speed counts as the Challenge
      await startLessonStep(LESSONS[0], 'PRACTISE')
      onFinish({ ...summarize(player.score, 'PRACTISE'), mode: 'PRACTISE' })
      console.log(`SELFTEST engine lesson practise done=${lessonStepDone(LESSONS[0].id, 'PRACTISE')} stars=${lessonStepStars(LESSONS[0].id, 'PRACTISE')} next="${$('resNext').classList.contains('hidden') ? '' : $('resNext').textContent}" primary=${resultsPrimary && resultsPrimary.id} practiseBtn=${!$('resPractice').classList.contains('hidden')} (expect true 0, Next step: Challenge, resNext, false)`)
      hideResults()
      const before = lessonMeta && lessonMeta.step
      setSpeed('1')
      console.log(`SELFTEST engine lesson retarget ${before}->${lessonMeta && lessonMeta.step} subtitle=${$('subtitle').textContent} hands=${player.handFilter} (expect PRACTISE->PLAY Challenge both)`)
      cancelCeremony(); lessonMeta = null

      // a failed level shows no stars and gets the fail flash; a passed one offers the next level
      await startGame(GAMES[3])
      const gs = { ...summarize(player.score, 'PLAY'), overallAccuracy: 0.78, starRating: 2, totalNotes: 20, mode: 'PLAY' }
      onFinish(gs)
      console.log(`SELFTEST engine game fail stars=${gs.starRating} lit=${$('resStars').querySelectorAll('.on').length} head="${$('resHead').textContent}" next=${!$('resNext').classList.contains('hidden')} (expect 0 0 So close, false)`)
      hideResults(); cancelCeremony()
      await startGame(GAMES[0])
      onFinish({ ...summarize(player.score, 'PLAY'), overallAccuracy: 0.9, starRating: 3, totalNotes: 20, mode: 'PLAY' })
      console.log(`SELFTEST engine game pass next="${$('resNext').textContent}" primary=${resultsPrimary && resultsPrimary.id} (expect Next level, resNext)`)
      hideResults(); cancelCeremony(); gameMeta = null
    }

    // take recorder (recorder.js): a short take of a small canvas with the app's sound,
    // keys through the keyboard's own path, the mp4's tracks lined up; then the switch
    // in the player: on, a run is recorded through a pause until the results; off, nothing
    {
      console.log('SELFTEST take formats ' + MIME_TYPES.map((t) => (MediaRecorder.isTypeSupported(t) ? '+' : '-') + t).join(' ') + ' picked=' + pickMimeType())
      // an odd size on purpose: H.264 drops the odd row and column, the sidecar says so
      const c = document.createElement('canvas')
      c.width = 321; c.height = 181
      const g = c.getContext('2d')
      let n = 0, drawing = true
      const draw = () => { if (!drawing) return; g.fillStyle = `hsl(${(n++ * 9) % 360} 70% 50%)`; g.fillRect(0, 0, 321, 181); takeFrameDrawn(); requestAnimationFrame(draw) }
      const savedPlayer = player
      player = null                      // the keys below only sound, they don't play the song
      const stem = startTake({ canvas: c, meta: { kind: 'selftest', song: { id: 'selftest', title: 'Self-test', artist: '' } }, save: false })
      requestAnimationFrame(draw)
      await sleep(200)
      handleMidiMessage([0x90, 60, 100]); await sleep(120)
      handleMidiMessage([0xB0, 64, 127]); await sleep(60)
      handleMidiMessage([0x80, 60, 0]); await sleep(60)
      handleMidiMessage([0xB0, 64, 0]); await sleep(1800)   // a few fragments (a second each)
      const r = await stopTake('selftest')
      drawing = false
      player = savedPlayer
      const sc = r.sidecar, midi = sc.midi
      const inc = midi.every((e, i) => i === 0 || e.t > midi[i - 1].t)
      console.log(`SELFTEST take file ${r.video} named=${TAKE_NAME.test(r.video) && TAKE_NAME.test(r.json) && r.video.startsWith(stem)} blob=${r.blob.size}B type=${r.blob.type} picked=${sc.mimeType} ${sc.width}x${sc.height} canvas=${sc.canvasWidth}x${sc.canvasHeight} rate=${sc.audioSampleRate} (expect named=true, a non-empty video/mp4, 320x180 from the 321x181 canvas)`)
      console.log(`SELFTEST take midi ${midi.map((e) => e.type + (e.type === 'cc' ? e.cc + '=' + e.value : e.pitch)).join(',')} t=${midi.map((e) => e.t.toFixed(3)).join(',')} increasing=${inc} (expect on60,cc64=127,off60,cc64=0 increasing=true)`)
      // the file: the picture starts at 0 with no edit; the sound's edit list skips the
      // encoder's priming and the lateness (and starts it later when that is not enough);
      // every fragment's durations add up to where the next one starts (Chrome's don't),
      // and the moov's media durations are 0 (Chrome writes the first fragment's ms there)
      const tl = await mp4Timeline(r.blob).catch((e) => ({ error: e.message }))
      const tv = tl.video || {}, ta = tl.audio || {}, sy = sc.sync
      const agrees = ta.delayMs === sy.audioDelayMs && ta.skip === sy.audioSkipSamples && ta.skip >= AAC_PRIMING
      console.log(`SELFTEST take sync applied=${sy.applied} method=${sy.method} late=${sy.lateMs}ms fragments=${tl.fragments}; ` +
        `video start=${tv.startMs}ms delay=${tv.delayMs}ms skip=${tv.skip} off=${tv.driftMs}ms mdhd=${tv.mdhd}; ` +
        `audio start=${ta.startMs}ms delay=${ta.delayMs}ms skip=${ta.skip} off=${ta.driftMs}ms mdhd=${ta.mdhd}; sidecar agrees=${agrees}; ` +
        `size=${tl.size && tl.size.width + 'x' + tl.size.height}; Chrome's durations were off by video=${sy.durationsOffMs && sy.durationsOffMs.video}ms audio=${sy.durationsOffMs && sy.durationsOffMs.audio}ms${tl.error ? ' error=' + tl.error : ''} ` +
        `(expect edit list, >=2 fragments, video start/delay/skip/off/mdhd 0/0/0/0/0, audio 0/the sidecar's delay/>=${AAC_PRIMING}/0/0, agrees=true, size=320x180)`)
      // the edit's maths: lateness 38.6 ms (MacBook speakers), 60 ms (a late first frame), -150 ms (Bluetooth)
      const ed = [38.6, 60, -150].map((ms) => { const e = audioEdit(ms, 48000); return e.delayMs + '/' + e.skip + '/' + Math.round((e.skip / 48 - e.delayMs) * 10) / 10 })
      console.log(`SELFTEST take edit list maths delay/skip/moved ${ed.join(' ')} (expect 6/2141/38.6 0/2880/60 194/2112/-150)`)
      // the sound in the take, although this page is muted: decode it offline (no output opened)
      let peak = -Infinity
      try {
        const ab = await new OfflineAudioContext(2, 128, 48000).decodeAudioData(await r.blob.arrayBuffer())
        for (let ch = 0; ch < ab.numberOfChannels; ch++) for (const v of ab.getChannelData(ch)) peak = Math.max(peak, Math.abs(v))
      } catch (e) { console.log('SELFTEST take decode failed: ' + e.message) }
      console.log(`SELFTEST take sound peak=${(20 * Math.log10(Math.max(1e-9, peak))).toFixed(1)}dBFS (expect well above -60: the key's note is in the take)`)
      // a take stops by itself at its time limit (15 minutes for real ones)
      let limited = null
      drawing = true
      requestAnimationFrame(draw)
      startTake({ canvas: c, save: false, maxMs: 500, onStop: (res) => { limited = res } })
      await sleep(1200)
      drawing = false
      console.log(`SELFTEST take time limit stopped=${!!limited && !takeBusy()} reason=${limited && limited.sidecar.stopReason} duration=${limited && limited.sidecar.durationSec}s (expect true, time limit, about 0.5)`)

      // the switch: a run is a take from play, through a pause, to the results; leaving stops one too
      const savedSwitch = settings.recordTakes
      settings.recordTakes = true
      takeSave = false
      startSong()
      player.setCountIn(0)
      togglePlay()
      const onPlay = isRecording(), pill = !$('recPill').classList.contains('hidden')
      // the window changes size: the take's picture keeps its size until the take ends
      const w0 = canvas.width, wrap = canvas.parentElement
      wrap.style.width = '600px'; resize()
      const kept = canvas.width === w0 && canvas.classList.contains('take-locked')
      await sleep(300)
      togglePlay()
      const onPause = isRecording()
      togglePlay()
      await sleep(300)
      showResults(summarize(player.score, 'PLAY'))
      const onResults = isRecording()
      await sleep(400)
      const refit = canvas.width === Math.trunc(600 * (window.devicePixelRatio || 1)) && !canvas.classList.contains('take-locked')
      wrap.style.width = ''; resize()
      hideResults()
      player.restart(false); togglePlay()
      await sleep(50)
      const again = isRecording()
      await sleep(300)
      showScreen('home')
      const onLeave = isRecording()
      await sleep(400)

      // the time limit (the recorder's own timer calls stopTake('time limit')): the run is
      // not recorded again at its next event (a loop going round, a pause)
      startSong()
      player.setCountIn(0)
      togglePlay()
      const limitOn = isRecording()
      await sleep(300)
      await stopTake('time limit')
      player.setLoop(0, 2.5, true)
      togglePlay(); togglePlay()
      await sleep(300)
      const limitAfter = isRecording(), limitDeclined = takeDeclined === player
      player.setLoop(0, 0, false)
      console.log(`SELFTEST take time limit in the player: recording=${limitOn} then after the limit, a loop and a pause: recording=${limitAfter} declined=${limitDeclined} (expect true false true)`)

      // a take still saving holds the next one back, without saying it could not record
      startSong()
      player.setCountIn(0)
      togglePlay()
      await sleep(300)
      const songBefore = song
      showScreen('home'); startFreeplay()
      const savingMsg = $('status').textContent, saving = takeBusy() && !isRecording()
      await sleep(800)
      const fpAfter = isRecording()
      showScreen('home')
      await sleep(400)
      song = songBefore                  // the Playground let go of it
      console.log(`SELFTEST take while the last one saves: saving=${saving} status="${savingMsg}" then the Playground take=${fpAfter} (expect true, not "This take could not be recorded", true)`)

      // the window's pixel ratio changes while a take records (a zoom, another screen): the
      // stage keeps its size and is drawn with the ratio it was sized for; it refits after
      startSong()
      player.setCountIn(0)
      togglePlay()
      await sleep(100)
      const dpr0 = stageDpr, cw0 = canvas.width, dprDesc = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio')
      let dprKept = false, dprRefit = false
      try {
        Object.defineProperty(window, 'devicePixelRatio', { value: dpr0 * 2, configurable: true, writable: true })
        resize()
        await sleep(100)
        dprKept = isRecording() && canvas.width === cw0 && canvas.classList.contains('take-locked') && stageDpr === dpr0 && ctx2d.getTransform().a === dpr0
        $('recPill').click()
        await sleep(400)
        dprRefit = !isRecording() && stageDpr === dpr0 * 2 && ctx2d.getTransform().a === dpr0 * 2 &&
          canvas.width === Math.max(1, Math.trunc(canvas.parentElement.clientWidth * dpr0 * 2)) && !canvas.classList.contains('take-locked')
      } finally {
        if (dprDesc) Object.defineProperty(window, 'devicePixelRatio', dprDesc)
        else delete window.devicePixelRatio
        resize()
      }
      player.pause()
      console.log(`SELFTEST take pixel ratio ${dpr0}->${dpr0 * 2} while recording: kept and drawn at ${dpr0}=${dprKept}, refit at ${dpr0 * 2} after=${dprRefit}, back to ${stageDpr} (expect true true ${dpr0})`)

      settings.recordTakes = false
      startSong()
      player.setCountIn(0)
      togglePlay()
      await sleep(100)
      const off = isRecording()
      player.pause()
      settings.recordTakes = savedSwitch
      takeSave = true
      console.log(`SELFTEST take switch on: play=${onPlay} pill=${pill} pause=${onPause} results=${onResults} again=${again} leave=${onLeave}; off: play=${off} (expect true true true false true false; false)`)
      console.log(`SELFTEST take window resized while recording: size kept=${kept} refit after=${refit} (expect true true)`)
    }

    // the scheduler queues a note on a pump's boundary once: a horizon a float hair past
    // a note (here 2.5 s: 102.4 + 0.2 - 100.1 = 2.500000000000014) used to queue it twice,
    // which made that chord 6 dB too loud in about one take in six
    {
      const clk = { currentTime: 100.1 }
      const notesAt = [], clicksAt = []
      const sch = new SongScheduler({ note: (p, v, at) => notesAt.push(at), cancel: () => {}, click: (accent, at) => clicksAt.push(at), bass: () => {}, hat: () => {} })
      const pb = new Player({ getCtx: () => clk })
      pb.load({ title: 'boundary', tempo: 96, duration: 6, notes: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((t) => ({ pitch: 60, start: t, dur: 0.4, vel: 90, hand: 'right' })) })
      pb.setMode('WATCH'); pb.setCountIn(0); pb.setMetronome(true); pb.play()
      for (const t of [100.1, 101.0, 102.0, 102.4, 102.41, 102.6, 103.0, 103.5]) { clk.currentTime = t; sch.pump(pb, { ctx: clk, accompany: true, watchSynth: true, band: null }) }
      const count = (list, t) => list.filter((x) => Math.abs(x - (100.1 + t)) < 1e-6).length
      console.log(`SELFTEST engine scheduler boundary note2.5=x${count(notesAt, 2.5)} click2.5=x${count(clicksAt, 2.5)} notes=${notesAt.length} clicks=${clicksAt.length} (expect x1 x1 8 6)`)
    }

    console.log('SELFTEST done')
  } catch (e) { console.log('SELFTEST FAIL ' + (e && e.message)) }
}
/* ============================== perf probe (?perf=1) ============================== */
// How a held note sounds, per instrument, rendered offline: when it becomes
// audible and how much is left after 1, 3 and 6 seconds. Pressure 0 arrives at
// 0.3 s, like a key that is held without pushing (expressive styles).
async function envelopeReport(id, pressureZero) {
  const sr = 48000, secs = 8
  const oc = new OfflineAudioContext(1, sr * secs, sr)
  const v = new Voice(oc, oc.destination, 60, 90, id, 12)
  if (pressureZero) oc.suspend(0.3).then(() => { v.setPressure(0); oc.resume() })
  oc.suspend(7).then(() => { v.release(); oc.resume() })
  const buf = await oc.startRendering()
  const d = buf.getChannelData(0)
  const win = Math.round(sr * 0.01)
  const rms = []
  for (let i = 0; i + win <= d.length; i += win) {
    let a = 0
    for (let j = i; j < i + win; j++) a += d[j] * d[j]
    rms.push(Math.sqrt(a / win))
  }
  const peak = Math.max(...rms.slice(0, 100)) || 1e-9
  const db = (t) => (20 * Math.log10((rms[Math.round(t * 100)] || 1e-9) / peak)).toFixed(0)
  return id + (pressureZero ? '+p0' : '') + ' onset(-6dB)=' + onsetMs(d, sr).toFixed(1) + 'ms 1s=' + db(1) + 'dB 3s=' + db(3) + 'dB 6s=' + db(6) + 'dB'
}

// Milliseconds until a note reaches half (-6 dB) of its highest RMS in its first
// second. The RMS is over the 7.6 ms before each moment (one period of C3, so layers an
// octave down don't ripple it); a sound starting at full level reads 1.9 ms on that,
// which is taken off.
function onsetMs(d, sr) {
  const w = Math.round(sr / 130.81), end = Math.min(d.length, sr)
  const cum = new Float64Array(end + 1)
  for (let i = 0; i < end; i++) cum[i + 1] = cum[i] + d[i] * d[i]
  let top = 0
  for (let i = w; i <= end; i++) top = Math.max(top, cum[i] - cum[i - w])
  for (let i = 1; i <= end; i++) if (cum[i] - cum[Math.max(0, i - w)] >= top / 4) return Math.max(0, ((i - w / 4) / sr) * 1000)
  return NaN
}

// ITU-R BS.1770 loudness (LUFS) of the loudest 400 ms, for stereo at 48 kHz.
function loudness(chs, sr) {
  const biquad = (x, b, a) => {
    const y = new Float32Array(x.length)
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0
    for (let i = 0; i < x.length; i++) {
      const o = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2
      x2 = x1; x1 = x[i]; y2 = y1; y1 = o; y[i] = o
    }
    return y
  }
  const kw = chs.map((x) => biquad(biquad(x, [1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]),
    [1, -2, 1], [1, -1.99004745483398, 0.99007225036621]))
  const w = Math.round(0.4 * sr), hop = Math.round(0.1 * sr)
  let best = 0
  for (let s = 0; s + w <= kw[0].length; s += hop) {
    let z = 0
    for (const c of kw) { let a = 0; for (let i = s; i < s + w; i++) a += c[i] * c[i]; z += a / w }
    best = Math.max(best, z)
  }
  return -0.691 + 10 * Math.log10(best + 1e-12)
}

// Levels at the final output with the volume at 80 %, rendered offline through the
// same output chain as the live sound (buildOutputChain): one mf note (middle C,
// velocity 90) and a loud chord (C E G C, velocity 110). The limiter's input is
// recorded beside its output: over = how long it was above the knee, err = how much
// of the signal it changed (dB relative to the signal).
async function levelReport(id, buildOutputChain) {
  const sr = 48000
  const render = async (pitches, vel) => {
    const oc = new OfflineAudioContext(4, sr * 2, sr)
    const chain = buildOutputChain(oc, 0.8)
    const taps = new ChannelMergerNode(oc, { numberOfInputs: 4 })
    const post = new ChannelSplitterNode(oc, { numberOfOutputs: 2 })
    const pre = new ChannelSplitterNode(oc, { numberOfOutputs: 2 })
    chain.output.connect(post)
    chain.input.connect(pre)
    post.connect(taps, 0, 0); post.connect(taps, 1, 1); pre.connect(taps, 0, 2); pre.connect(taps, 1, 3)
    taps.connect(oc.destination)
    for (const p of pitches) new Voice(oc, chain.input, p, vel, id, 12)
    const b = await oc.startRendering()
    const y = [b.getChannelData(0), b.getChannelData(1)]
    const x = [b.getChannelData(2), b.getChannelData(3)].map((c) => c.map((s) => s * chain.range))
    let peak = 0, inPeak = 0, sq = 0, errSq = 0, refSq = 0, over = 0
    for (let i = 0; i < y[0].length; i++) {
      let above = false
      for (let c = 0; c < 2; c++) {
        const o = y[c][i], s = x[c][i]
        peak = Math.max(peak, Math.abs(o))
        inPeak = Math.max(inPeak, Math.abs(s))
        if (i < sr) sq += o * o
        errSq += (o - s) * (o - s)
        refSq += s * s
        if (Math.abs(s) > chain.knee) above = true
      }
      if (above) over++
    }
    return { peak, inPeak, rms: Math.sqrt(sq / (2 * sr)), loud: loudness(y, sr), over: (over / sr) * 1000, err: 10 * Math.log10(errSq / refSq + 1e-12), onset: onsetMs(y[0], sr) }
  }
  return { note: await render([60], 90), chord: await render([60, 64, 67, 72], 110) }
}

// Audio nodes one key press creates (counts node constructor calls during one voice).
function nodesPerVoice(id) {
  const names = ['OscillatorNode', 'GainNode', 'BiquadFilterNode', 'ChannelMergerNode', 'AudioBufferSourceNode', 'WaveShaperNode', 'StereoPannerNode']
  const real = names.map((n) => window[n])
  let count = 0
  names.forEach((n, i) => { window[n] = class extends real[i] { constructor(...a) { super(...a); count++ } } })
  try {
    const oc = new OfflineAudioContext(2, 128, 48000)
    new Voice(oc, oc.destination, 60, 90, id, 12)
  } finally { names.forEach((n, i) => { window[n] = real[i] }) }
  return count
}

async function runPerfProbe() {
  const out = (m) => console.log('PERF ' + m)
  const fails = []
  const fail = (m) => { fails.push(m); out('FAIL ' + m) }
  const dB = (x) => (20 * Math.log10(Math.max(1e-9, x))).toFixed(1)
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  try {
    const audio = await import('./audio.js')
    const { prepareInstrument } = await import('./instruments.js')
    for (const inst of instrumentList()) out(await envelopeReport(inst.id, false))
    for (const id of ['grand', 'cello']) out(await envelopeReport(id, true))

    // levels per instrument, and how alike they are
    const levels = {}
    for (const inst of instrumentList()) {
      const id = inst.id
      const { note: n, chord: c } = (levels[id] = await levelReport(id, audio.buildOutputChain))
      out(`level ${id.padEnd(7)} note  peak=${dB(n.peak)}dBFS rms=${dB(n.rms)}dBFS loud=${n.loud.toFixed(1)}LUFS limiter in=${dB(n.inPeak)} out=${dB(n.peak)}dBFS onset=${n.onset.toFixed(1)}ms nodes=${nodesPerVoice(id)}`)
      out(`level ${id.padEnd(7)} chord peak=${dB(c.peak)}dBFS rms=${dB(c.rms)}dBFS loud=${c.loud.toFixed(1)}LUFS limiter in=${dB(c.inPeak)} out=${dB(c.peak)}dBFS max|s|=${c.peak.toFixed(3)} over-knee=${c.over.toFixed(0)}ms err=${c.err.toFixed(0)}dB`)
      if (c.peak >= 0.99) fail(id + ' chord clips: max|s|=' + c.peak.toFixed(3))
      if (n.onset > 25) fail(id + ' onset ' + n.onset.toFixed(1) + 'ms')
    }
    const g = levels.grand.note
    if (g.peak < 10 ** (-9.5 / 20) || g.peak > 10 ** (-6.5 / 20)) fail('grand mf note peaks at ' + dB(g.peak) + 'dBFS (want about -8)')
    const loud = Object.values(levels).map((l) => l.note.loud)
    out('level spread (note loudness, loudest - quietest)=' + (Math.max(...loud) - Math.min(...loud)).toFixed(1) + 'dB')
    for (const [id, l] of Object.entries(levels)) if (Math.abs(l.note.loud - g.loud) > 3) fail(id + ' is ' + (l.note.loud - g.loud).toFixed(1) + 'dB from the piano')

    // the first note on a fresh context, with and without building the instrument first
    // (offline: opening another live context would disturb the app's own output)
    const firstNote = (prepare) => {
      const c = new OfflineAudioContext(2, 128, 48000)
      if (prepare) prepareInstrument(c, 'grand')
      const t = performance.now()
      new Voice(c, c.destination, 60, 90, 'grand', 12)
      return performance.now() - t
    }
    out('first note on a fresh context: ' + firstNote(false).toFixed(2) + 'ms unprepared, ' + firstNote(true).toFixed(2) + 'ms prepared (initAudio prepares)')

    // the live output, muted (the press timing below would otherwise blare)
    const ac = initAudio()
    await ac.resume()
    audio.setVolume(0)
    await sleep(300)
    const li = audio.latencyInfo()
    out('audio baseLatency=' + (li.base * 1000).toFixed(1) + 'ms outputLatency=' + (li.output * 1000).toFixed(1) + 'ms sampleRate=' + li.sampleRate + ' sink=' + (li.sinkId || 'default') + ' underruns=' + li.underruns)
    const outputs = await audio.listOutputs()
    out('outputs ' + outputs.length + ': ' + outputs.map((o) => o.label).join(' | '))
    // where the next rendered sample will be heard, from the device's own timestamps
    const ahead = []
    for (let i = 0; i < 10; i++) {
      await sleep(30)
      const ts = ac.getOutputTimestamp()
      if (ts.contextTime > 0) ahead.push(ts.performanceTime + (ac.currentTime - ts.contextTime) * 1000 - performance.now())
    }
    ahead.sort((a, b) => a - b)
    if (ahead.length) out('scheduled now -> heard after ' + ahead[ahead.length >> 1].toFixed(1) + 'ms (getOutputTimestamp, median of ' + ahead.length + ')')

    // main-thread delay a key press can meet while a song plays; MIDI messages that
    // arrive meanwhile (play some keys) show the browser's own MIDI -> handler delay
    const midiLags = []
    const onMidi = (e) => midiLags.push(performance.now() - e.timeStamp)
    if (midiInput) midiInput.addEventListener('midimessage', onMidi)
    await openLibrary('twinkle.xml')
    if (player) player.play()
    const lags = []
    const ch = new MessageChannel()
    let sentAt = 0
    ch.port1.onmessage = () => { lags.push(performance.now() - sentAt) }
    const until = performance.now() + 5000
    await new Promise((resolve) => {
      const tick = () => {
        if (performance.now() > until) { resolve(); return }
        sentAt = performance.now(); ch.port2.postMessage(0)
        setTimeout(tick, 7)
      }
      tick()
    })
    if (midiInput) midiInput.removeEventListener('midimessage', onMidi)
    lags.sort((a, b) => a - b)
    const pct = (a, p) => a[Math.min(a.length - 1, Math.floor(a.length * p))].toFixed(1)
    out('main-thread wait during play: median=' + pct(lags, 0.5) + 'ms p95=' + pct(lags, 0.95) + 'ms max=' + pct(lags, 1) + 'ms samples=' + lags.length)
    midiLags.sort((a, b) => a - b)
    out(midiLags.length ? 'MIDI message -> handler: median=' + pct(midiLags, 0.5) + 'ms max=' + pct(midiLags, 1) + 'ms messages=' + midiLags.length : 'MIDI message -> handler: no messages arrived (press keys during the probe to measure)')

    // key press cost on the main thread: the app's whole path, and the sound alone
    const perPress = (fn, n) => {
      const t = performance.now()
      for (let i = 0; i < n; i++) fn(60 + (i % 12))
      return (performance.now() - t) / n
    }
    const whole = perPress((p) => { handleNoteOn(p, 100, 0); handleNoteOff(p, 0) }, 100)
    const sound = perPress((p) => { audio.noteOn(p, 100, 0); audio.noteOff(p, 0) }, 100)
    out('key press handling=' + whole.toFixed(3) + 'ms per press (making the sound: ' + sound.toFixed(3) + 'ms)')
    if (player) player.pause()
    await sleep(400)
    audio.setVolume(settings.volume / 100)
    out(fails.length ? fails.length + ' FAIL' : 'all checks passed')
  } catch (e) { out('FAIL ' + (e && e.stack || e)) }
  out('done')
}

boot()
