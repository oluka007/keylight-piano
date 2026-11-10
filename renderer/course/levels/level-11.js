// Level 11: Advanced I. Every lesson text, quiz question and every inline study in this file is
// original, written for this course as note lists. The registered library pieces are named by their
// library id (renderer/songs-mutopia.js); nothing is copied from any score, edition or arrangement,
// and no melody from a known work is quoted. The level assumes an 88-key keyboard: the studies reach
// down to B1 and up to G5, and the scale and arpeggio drills use the app's own full-range window.
import { seq, itemsFor } from '../builders.js'

const twelve = itemsFor('l11-twelve-keys')
const pre = itemsFor('l11-prelude-figuration')
const cant = itemsFor('l11-cantabile')
const two = itemsFor('l11-two-voices')
const ost = itemsFor('l11-ostinato')
const son = itemsFor('l11-sonata-drama')
const orn = itemsFor('l11-ornaments')
const cad = itemsFor('l11-cadences-and-inversions')
const exam = itemsFor('l11-exam')

// Registered library works (ids in renderer/songs-mutopia.js).
const PRELUDE = 'bach-prelude-c-bwv846'
const CONSOLATION = 'liszt-consolation-3'
const MOUNTAIN = 'grieg-mountain-king'
const PATHETIQUE = 'beethoven-pathetique-1'

// --- Lesson 2: a prelude study of broken chords, 4/4, eight bars (32 beats). One harmony per bar:
// C, A minor, F, G, C, F, G, C. The right hand walks the chord, the left hand holds its root. ---
const PRE_R = 'C4:0.5 E4:0.5 G4:0.5 C5:0.5 C5:0.5 G4:0.5 E4:0.5 G4:0.5 ' +
  'A3:0.5 C4:0.5 E4:0.5 A4:0.5 A4:0.5 E4:0.5 C4:0.5 E4:0.5 ' +
  'F4:0.5 A4:0.5 C5:0.5 F5:0.5 F5:0.5 C5:0.5 A4:0.5 C5:0.5 ' +
  'G4:0.5 B4:0.5 D5:0.5 G5:0.5 G5:0.5 D5:0.5 B4:0.5 D5:0.5 ' +
  'C4:0.5 E4:0.5 G4:0.5 C5:0.5 C5:0.5 G4:0.5 E4:0.5 G4:0.5 ' +
  'F4:0.5 A4:0.5 C5:0.5 F5:0.5 F5:0.5 C5:0.5 A4:0.5 C5:0.5 ' +
  'G4:0.5 B4:0.5 D5:0.5 G5:0.5 G5:0.5 D5:0.5 B4:0.5 D5:0.5 ' +
  'C4:0.5 E4:0.5 G4:0.5 C5:0.5 C5:0.5 G4:0.5 E4:0.5 C4:0.5'
const PRE_L = 'C3:4 A2:4 F2:4 G2:4 C3:4 F2:4 G2:4 C3:4'

// --- Lesson 3: a cantabile study in A minor, 3/4, eight bars (24 beats). The right hand sings;
// the left hand rocks root, fifth, octave under it. ---
const CANT_R = 'A4:1 C5:1 E5:1 D5:1.5 C5:0.5 B4:1 B4:1.5 A4:0.5 G#4:1 A4:3 ' +
  'E5:1 C5:1 A4:1 F4:1 A4:1 D5:1 E5:1 D5:1 B4:1 A4:3'
const CANT_L = 'A2:1 E3:1 A3:1 D3:1 A3:1 D4:1 E3:1 B3:1 E4:1 A2:1 E3:1 A3:1 ' +
  'A2:1 E3:1 A3:1 D3:1 A3:1 D4:1 E3:1 B3:1 E4:1 A2:1 E3:1 A3:1'

// --- Lesson 4: a canon at the octave in C, 4/4. The left hand enters one bar later and an octave
// lower, playing the right hand's first five bars; bar 6 of the right hand closes on C. Both hands
// last six bars (24 beats). ---
const CANON_R = 'C5 E5 G5 E5 A4 G4 B4 C5 F5 E5 D5 E5 D5 C5 B4 C5 F5 E5 D5 C5 A4 G4 B4 C5'
const CANON_L = 'r:4 C4 E4 G4 E4 A3 G3 B3 C4 F4 E4 D4 E4 D4 C4 B3 C4 F4 E4 D4 C4'
// The same answering line on its own, without the opening rest: five bars (20 beats).
const CANON_L_ALONE = 'C4 E4 G4 E4 A3 G3 B3 C4 F4 E4 D4 E4 D4 C4 B3 C4 F4 E4 D4 C4'

// --- Lesson 5: an ostinato study in A minor, 4/4, eight bars (32 beats). The left hand repeats
// A, E, A, E in quarter notes without a change; the right hand grows above it. ---
const OST_L = 'A2:1 E3:1 A3:1 E3:1 A2:1 E3:1 A3:1 E3:1 A2:1 E3:1 A3:1 E3:1 A2:1 E3:1 A3:1 E3:1 ' +
  'A2:1 E3:1 A3:1 E3:1 A2:1 E3:1 A3:1 E3:1 A2:1 E3:1 A3:1 E3:1 A2:1 E3:1 A3:1 E3:1'
const OST_R = 'A4:1 B4:1 C5:2 D5:1 C5:1 B4:2 C5:0.5 D5:0.5 E5:1 C5:1 B4:1 A4:2 B4:2 ' +
  'C5:0.5 D5:0.5 E5:0.5 F5:0.5 E5:1 D5:1 C5:1 B4:1 A4:2 E5:0.5 D5:0.5 C5:0.5 B4:0.5 A4:2 A4:4'

// --- Lesson 6: a dramatic opening in C minor, 4/4, four bars (16 beats): a tremolo on the tonic,
// then the diminished seventh on B, then the resolution. Both hands together. ---
const DRAM_R = 'Eb4:0.5 C5:0.5 Eb4:0.5 C5:0.5 Eb4:0.5 C5:0.5 Eb4:0.5 C5:0.5 ' +
  'B3:0.5 D4:0.5 F4:0.5 Ab4:0.5 B4:0.5 Ab4:0.5 F4:0.5 D4:0.5 C5:2 Eb5:2 C5:4'
const DRAM_L = 'C2:0.5 G2:0.5 C2:0.5 G2:0.5 C2:0.5 G2:0.5 C2:0.5 G2:0.5 ' +
  'B1:0.5 F2:0.5 B1:0.5 F2:0.5 B1:0.5 F2:0.5 B1:0.5 F2:0.5 ' +
  'C2:0.5 G2:0.5 C2:0.5 G2:0.5 C2:0.5 G2:0.5 C2:0.5 G2:0.5 C2:4'
// An Allegro study in C minor, 4/4, eight bars (32 beats): a phrase on the tonic, a half cadence on
// the dominant, then the same phrase again closing on the tonic.
const ALLEGRO_R = 'G4:1 C5:1 Eb5:2 D5:1 Eb5:1 F5:2 Eb5:1 D5:1 C5:2 B4:1 D5:1 G4:2 ' +
  'G4:1 C5:1 Eb5:2 D5:1 Eb5:1 F5:2 G5:1 F5:1 Eb5:2 C5:4'
const ALLEGRO_L = 'C3:1 G3:1 C3:1 G3:1 Bb2:1 F3:1 Bb2:1 F3:1 C3:1 G3:1 C3:1 G3:1 G2:1 D3:1 G2:1 D3:1 ' +
  'C3:1 G3:1 C3:1 G3:1 Bb2:1 F3:1 Bb2:1 F3:1 C3:1 G3:1 C3:1 G3:1 C3:4'

// --- Lesson 7: an ornament study in C, 4/4, four bars (16 beats): a written-out turn on C, a
// written-out trill on F, a written-out upper mordent on E, and a closing C. ---
const ORNAMENTS = 'C5:1 D5:0.25 C5:0.25 B4:0.25 C5:0.25 C5:2 ' +
  'F5:0.25 G5:0.25 F5:0.25 G5:0.25 F5:0.25 G5:0.25 F5:0.25 G5:0.25 F5:1 E5:1 ' +
  'E5:0.25 F5:0.25 E5:1.5 D5:2 C5:4'

// --- Lesson 8: a phrase that turns aside at the last moment, 4/4, four bars (16 beats). The
// harmony is C, F, G7 and then A minor: V moves to vi, an interrupted cadence. ---
const DECEPT_R = 'C5:1 D5:1 E5:2 F5:1 E5:1 D5:2 B4:1 D5:1 F5:2 E5:2 C5:2'
const DECEPT_L = 'C3:4 F2:4 G2:4 A2:4'

export const level11 = {
  id: 'level-11', number: 11, title: 'Advanced I', grade: 'RCM 9, ABRSM Grade 8', keys: 88,
  blurb: 'Advanced work on an 88-key keyboard: scales in distant keys at speed, a broken-chord prelude, a singing cantabile line, two-voice counterpoint, an ostinato that grows, a dramatic minor-key sonata, ornaments, and the cadences and inversions that close a phrase.',
  lessons: [
    {
      id: 'l11-twelve-keys', title: 'Scales in distant keys', minutes: 21,
      goal: 'Play major and minor scales and arpeggios in distant keys with both hands, and name the key signature of each one.',
      teach: [
        'A scale belongs to a key, and keys are neighbours. Add one sharp and you move up a fifth; add one flat and you move down a fifth. C, G, D, A, E and B major sit in that order, and their key signatures grow by one sharp each time.',
        'The order of sharps never changes: F, C, G, D, A, E, B. The order of flats is the same list backwards: B, E, A, D, G, C, F. Say the order out loud and you can work out any key signature from memory.',
        'Scales at this level are played hands together, and in an exam over four octaves. Each key has its own fingering. E major is like C: right 1 2 3 1 2 3 4 5, left 5 4 3 2 1 3 2 1.',
        'B major keeps the right hand of C but the left starts on 4: 4 3 2 1 4 3 2 1. C sharp harmonic minor: right 3 4 1 2 3 1 2 3, left 3 2 1 4 3 2 1 3. The thumbs never land on a black key.'
      ],
      tip: 'Practise the thumb turns on their own, slowly, before you join a whole octave. Almost every stumble hides in the turn.',
      diagram: { type: 'keys', range: [47, 59], highlight: [47, 49, 51, 52, 54, 56, 58, 59], fingers: { 47: 4, 49: 3, 51: 2, 52: 1, 54: 4, 56: 3, 58: 2, 59: 1 } },
      items: [
        twelve('scale-e', 'E major scale, hands together', 'scale', { tb: { type: 'scale', tonic: 4, hand: 'both' } }, { accuracy: 0.85 }),
        twelve('scale-b', 'B major scale, hands together', 'scale', { tb: { type: 'scale', tonic: 11, hand: 'both' } }, { accuracy: 0.85 }),
        twelve('scale-cs-minor', 'C sharp harmonic minor, hands together', 'scale', { tb: { type: 'harmonic', tonic: 1, hand: 'both' } }, { accuracy: 0.85 }),
        twelve('arp-e', 'E major arpeggio, left hand', 'arpeggio', { tb: { type: 'chord', tonic: 4, hand: 'left' } }, { accuracy: 0.85 }),
        twelve('arp-b', 'B major arpeggio, right hand', 'arpeggio', { tb: { type: 'chord', tonic: 11, hand: 'right' } }, { accuracy: 0.85 }),
        twelve('theory', 'The order of sharps', 'theory', { q: 'A key signature has four sharps. Which key is it, and in what order do the sharps appear?', options: ['E major: F sharp, C sharp, G sharp, D sharp', 'A major: F sharp, C sharp, G sharp, D sharp', 'E major: B flat, E flat, A flat, D flat', 'B major: F sharp, C sharp, G sharp, D sharp'], answer: 0, why: 'Sharps always arrive in the order F, C, G, D, A, E, B. Four of them give F sharp, C sharp, G sharp and D sharp, and that key signature belongs to E major, whose relative minor is C sharp minor.' }, { accuracy: 1 }),
        twelve('sight', 'Sight-read in E', 'sight', { range: [64, 83], hand: 'right', key: 'E', length: 4 }, { accuracy: 0.7 })
      ],
      pass: { minItemsDone: 4 }
    },
    {
      id: 'l11-prelude-figuration', title: 'A prelude of broken chords', minutes: 19,
      goal: 'Play a broken-chord prelude study in both hands, keep each harmony clear, and hear the harmony inside fast figuration.',
      teach: [
        'A Baroque prelude often works from one idea repeated. The first prelude of Bach\'s Well-Tempered Clavier keeps the same shape of broken chords through nearly every bar, and each bar holds a single harmony. The pattern is simple; the harmony is where the music lives.',
        'Play such a piece by feeling the chord under your fingers, not by reading each note. When the harmony changes, the whole pattern moves to the new chord. Know which chord each bar holds and the notes take care of themselves.',
        'Keep the touch even and let the pedal change with each harmony. Hold the pattern at one dynamic level so the chords can be heard through it. A prelude of this kind should sound calm, steady and unhurried, like a quiet walk through a series of chords.'
      ],
      tip: 'Practise one bar at a time, saying the chord name as you play it. C, A minor, F, G is easy to remember and easy to hear.',
      diagram: { type: 'staff', clef: 'treble', notes: [{ p: 60 }, { p: 64 }, { p: 67 }, { p: 72 }] },
      items: [
        pre('study-r', 'The prelude study, right hand', 'piece', { notes: seq(PRE_R), tempo: 66, hand: 'right', timeSignature: '4/4' }, { accuracy: 0.8 }),
        pre('study-both', 'The prelude study, both hands', 'piece', { tracks: { right: seq(PRE_R), left: seq(PRE_L) }, tempo: 63, timeSignature: '4/4' }, { accuracy: 0.75 }),
        pre('piece', 'Prelude in C, BWV 846', 'piece', { song: PRELUDE }, { accuracy: 0.7 }),
        pre('rhythm', 'Tap even sixteenths', 'rhythm', { pattern: [0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], tempo: 66, timeSignature: '4/4' }, { accuracy: 0.8 }),
        pre('ear', 'Name the chord quality', 'ear', { kind: 'chord', qualities: ['major', 'minor', 'diminished', 'augmented'], rounds: 10 }, { accuracy: 0.8 }),
        pre('theory', 'Where the music changes', 'theory', { q: 'In a prelude built from one broken-chord pattern, where does the music change?', options: ['In the harmony, when the pattern moves to a new chord', 'In the tempo of every bar', 'In the metre, which changes each bar', 'Nowhere: every bar is identical'], answer: 0, why: 'The figuration stays the same while the harmony moves from chord to chord. Following the harmony is what shapes the piece.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 4 }
    },
    {
      id: 'l11-cantabile', title: 'Cantabile: the singing line', minutes: 18,
      goal: 'Play a slow singing melody over a quiet accompaniment, shape a long phrase, and pedal legato without smudging the harmony.',
      teach: [
        'Cantabile means in a singing style. The melody must sound as if a voice were carrying it: joined, steady in tone, and shaped in long phrases. Let the fingers stay close to the keys and move from one note into the next without a gap.',
        'Shape comes from weight, not volume. Lean gently into the top of the phrase and let it fall away at the end, as a singer does at the close of a line. The accompaniment stays below, soft and even, so the melody is never covered.',
        'The skill is the change. Play the new chord, lift the pedal as it sounds, and press it down again moments later, fingers still holding the keys. The old harmony clears; the new rings. Change too late and the chords smear. In a slow piece, change the pedal with the harmony, not with every note.'
      ],
      tip: 'Sing the melody out loud before you play it. If you can sing the shape, your fingers will find it.',
      diagram: { type: 'staff', clef: 'treble', notes: [{ p: 69 }, { p: 72 }, { p: 76 }, { p: 74 }] },
      items: [
        cant('melody', 'A cantabile study, right hand', 'piece', { notes: seq(CANT_R), tempo: 69, hand: 'right', timeSignature: '3/4' }, { accuracy: 0.8 }),
        cant('both', 'A cantabile study, both hands', 'piece', { tracks: { right: seq(CANT_R), left: seq(CANT_L) }, tempo: 66, timeSignature: '3/4' }, { accuracy: 0.75 }),
        cant('piece', 'Consolation No. 3', 'piece', { song: CONSOLATION }, { accuracy: 0.7 }),
        cant('echo', 'Echo a singing phrase', 'echo', { notes: seq('A4:1 C5:1 E5:1 D5:1 C5:1'), tempo: 66, hand: 'right', rounds: 3 }, { accuracy: 0.8 }),
        cant('ear', 'Hear the interval', 'ear', { kind: 'interval', intervals: [1,2,3,4,5,6,7,8,9,10,11,12], rounds: 8 }, { accuracy: 0.8 }),
        cant('theory', 'What cantabile asks for', 'theory', { q: 'What does cantabile mean?', options: ['In a singing style', 'As fast as possible', 'Short and detached', 'Very loud'], answer: 0, why: 'Cantabile means in a singing style: a joined, shapely line, carried above a quiet accompaniment.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 4 }
    },
    {
      id: 'l11-two-voices', title: 'Two independent voices', minutes: 19,
      goal: 'Play two lines at once, hear exactly where the second voice enters, and keep each line even and alive while the other moves.',
      teach: [
        'Two-voice music is a conversation. One voice states an idea and the other answers with the same idea, later and usually lower. When the copy runs all the way through, the writing is a canon; when an idea returns in another voice during a piece, players call it imitation.',
        'Each line must stay alive on its own. When one voice moves, the other often holds a long note, and that note should stay audible to the end of its value. Bring out the moving line and keep the held note quiet but present.',
        'Learn each line alone until you can sing it, then join them slowly. Think of two singers taking turns rather than two hands. Make each entry clear, and let the second voice be heard as an answer.'
      ],
      tip: 'Count the rests in the second voice out loud. An entry that arrives late sounds like a mistake; one that arrives early breaks the imitation.',
      diagram: { type: 'staff', clef: 'treble', notes: [{ p: 72 }, { p: 76 }, { p: 79 }, { p: 76 }] },
      items: [
        two('alone-l', 'The answering voice alone, left hand', 'piece', { notes: seq(CANON_L_ALONE), tempo: 69, hand: 'left' }, { accuracy: 0.8 }),
        two('both', 'A canon at the octave, both hands', 'piece', { tracks: { right: seq(CANON_R), left: seq(CANON_L) }, tempo: 66 }, { accuracy: 0.75 }),
        two('scale-a', 'A natural minor, hands together', 'scale', { tb: { type: 'minor', tonic: 9, hand: 'both' } }, { accuracy: 0.85 }),
        two('echo', 'Echo the answering entry', 'echo', { notes: seq('C5 E5 G5 E5'), tempo: 66, hand: 'right', rounds: 4 }, { accuracy: 0.8 }),
        two('theory-imitation', 'Naming the imitation', 'theory', { q: 'One voice plays an idea and a second voice answers with the same idea a moment later. What is that called?', options: ['Imitation', 'A cadence', 'An Alberti bass', 'A turn'], answer: 0, why: 'When a voice takes up the idea of another a little later, the writing is imitative. If the copy continues all the way through, it is a canon.' }, { accuracy: 1 }),
        two('theory-held', 'The held note', 'theory', { q: 'While one voice moves, the other holds a long note. How should that held note be played?', options: ['Quietly, but still ringing', 'Loudly, so it leads the texture', 'Released at once', 'Ignored'], answer: 0, why: 'A held note keeps the harmony alive. It should stay quiet under the moving line, but it should not fade away to nothing.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 4 }
    },
    {
      id: 'l11-ostinato', title: 'Ostinato: a figure that never stops', minutes: 18,
      goal: 'Play a repeated bass figure while the melody grows above it, and hold a steady pulse through a long crescendo.',
      teach: [
        'An ostinato is a short figure repeated many times while everything around it changes. In Grieg\'s In the Hall of the Mountain King, the same short tune comes round again and again, starting low and quiet and growing louder and faster, and the effect is of something creeping closer.',
        'A long crescendo is planned, not squeezed. Decide where the sound begins and where it peaks, and let it rise in small steps, a little on each repeat. If it starts too loudly there is nowhere left to grow.',
        'Accelerando means gradually faster. Keep the left-hand figure absolutely even and let the speed come from the shape of the whole piece rather than from a rush. The ostinato is the anchor: if it wobbles, everything wobbles.'
      ],
      tip: 'Practise the repeating figure at one speed and let it run on its own. A bass figure that needs watching will never hold the piece together.',
      diagram: { type: 'keys', range: [45, 57], highlight: [45, 52, 57], fingers: { 45: 5, 52: 3, 57: 1 } },
      items: [
        ost('ostinato', 'The ostinato alone, left hand', 'piece', { notes: seq(OST_L), tempo: 96, hand: 'left', timeSignature: '4/4' }, { accuracy: 0.8 }),
        ost('melody', 'The growing melody, right hand', 'piece', { notes: seq(OST_R), tempo: 96, hand: 'right', timeSignature: '4/4' }, { accuracy: 0.8 }),
        ost('both', 'Ostinato and melody, both hands', 'piece', { tracks: { right: seq(OST_R), left: seq(OST_L) }, tempo: 92, timeSignature: '4/4' }, { accuracy: 0.75 }),
        ost('piece', 'In the Hall of the Mountain King', 'piece', { song: MOUNTAIN }, { accuracy: 0.7 }),
        ost('rhythm', 'Tap over the ostinato', 'rhythm', { pattern: [1, 1, 0.5, 0.5, 1, 1, 1, 0.5, 0.5, 1], tempo: 96, timeSignature: '4/4' }, { accuracy: 0.8 }),
        ost('theory', 'What an ostinato is', 'theory', { q: 'What is an ostinato?', options: ['A short figure repeated many times while the music changes around it', 'A sudden change of key', 'A single long chord', 'A form with three sections'], answer: 0, why: 'An ostinato is a repeated figure. It is usually short and stays the same while the melody, the harmony or the loudness changes above it.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 4 }
    },
    {
      id: 'l11-sonata-drama', title: 'A dramatic sonata movement', minutes: 20,
      goal: 'Play a study in a minor key with a heavy opening, a diminished seventh and a fast section, and know how a sonata movement is built.',
      teach: [
        'A sonata movement is built from three stages: an exposition that presents the ideas, a development that works on them, and a recapitulation that brings them back, often followed by a coda. A dramatic minor-key first movement may open with a slow, heavy introduction before the fast music begins.',
        'A diminished seventh chord is built from minor thirds stacked on the leading tone, and it sounds restless. It appears at moments of tension and then resolves into the tonic chord. In C minor the leading tone is B, so the chord uses the notes B, D, F and A flat.',
        'Play the drama with contrast, not force. The slow bars need weight and space; the fast bars need a steady pulse and light fingers. An accent marked sf, sforzando, is one sharp push, and a tremolo repeats two notes quickly to build tension.'
      ],
      tip: 'Let the slow bars finish before the fast ones start. Loud, fast music only sounds dramatic when the quiet music has been genuinely quiet.',
      diagram: { type: 'keys', range: [60, 67], highlight: [60, 63, 67], fingers: { 60: 1, 63: 3, 67: 5 } },
      items: [
        son('grave', 'A dramatic opening, both hands', 'piece', { tracks: { right: seq(DRAM_R), left: seq(DRAM_L) }, tempo: 60, timeSignature: '4/4' }, { accuracy: 0.75 }),
        son('allegro-r', 'The Allegro study, right hand', 'piece', { notes: seq(ALLEGRO_R), tempo: 100, hand: 'right', timeSignature: '4/4' }, { accuracy: 0.8 }),
        son('allegro-both', 'The Allegro study, both hands', 'piece', { tracks: { right: seq(ALLEGRO_R), left: seq(ALLEGRO_L) }, tempo: 96, timeSignature: '4/4' }, { accuracy: 0.75 }),
        son('piece', 'Pathétique, 1st mvt.', 'piece', { song: PATHETIQUE }, { accuracy: 0.7 }),
        son('theory-form', 'How a sonata movement is built', 'theory', { q: 'Which answer names the three stages of a sonata movement in the right order?', options: ['Exposition, development, recapitulation', 'Refrain, episode, refrain', 'Theme, variation, coda', 'Introduction, trio, minuet'], answer: 0, why: 'The exposition presents the ideas, the development works on them, and the recapitulation brings them back. A coda often closes the movement.' }, { accuracy: 1 }),
        son('theory-dim7', 'The leading-tone seventh in C minor', 'theory', { q: 'Which four notes make the diminished seventh chord on the leading tone of C minor?', options: ['B, D, F and A flat', 'B, D, F and A', 'C, E flat, G and B flat', 'B, D sharp, F sharp and A'], answer: 0, why: 'The leading tone of C minor is B. Stacking minor thirds above it gives B, D, F and A flat.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 4 }
    },
    {
      id: 'l11-ornaments', title: 'Ornaments in time', minutes: 17,
      goal: 'Play a trill, a mordent, a turn and an appoggiatura, always inside the beat, and read a line in C at sight.',
      teach: [
        'Ornaments decorate notes and usually belong to the beat, not the space before it. A trill alternates the written note with the note above; Baroque and Classical trills usually start on the upper note, though the study\'s trill starts on the main note. A mordent touches a neighbour note and returns at once.',
        'A turn circles the note: the note above, the note itself, the note below, and back. An appoggiatura is a leaning grace note that takes time from the main note and sounds on the beat. An acciaccatura is crushed against the main note almost without time of its own.',
        'Play ornaments in a calm tempo and give them the time they need. A trill that starts early, or a turn that lands late, upsets the bar for everything that follows. Practise the ornament alone first, then fit it back into the phrase.'
      ],
      tip: 'Count the ornament as part of its beat, never as an extra beat. Whatever you add, the bar must still hold the same number of beats.',
      diagram: { type: 'staff', clef: 'treble', notes: [{ p: 72 }, { p: 74 }, { p: 72 }, { p: 71 }] },
      items: [
        orn('study', 'An ornament study, right hand', 'piece', { notes: seq(ORNAMENTS), tempo: 72, hand: 'right', timeSignature: '4/4' }, { accuracy: 0.8 }),
        orn('echo', 'Echo a written-out trill', 'echo', { notes: seq('F5:0.25 G5:0.25 F5:0.25 G5:0.25 F5:0.25 G5:0.25 F5:0.25 G5:0.25 F5:1'), tempo: 72, hand: 'right', rounds: 4 }, { accuracy: 0.8 }),
        orn('theory-trill', 'Naming the ornaments', 'theory', { q: 'Which ornament shakes quickly between the written note and the note above it?', options: ['A trill', 'A mordent', 'A turn', 'An appoggiatura'], answer: 0, why: 'A trill alternates the written note with the note above. A mordent touches a neighbour once and returns, and a turn circles the note above and below.' }, { accuracy: 1 }),
        orn('theory-app', 'The leaning grace note', 'theory', { q: 'How does an appoggiatura behave?', options: ['It leans on the main note and takes time from it, on the beat', 'It is played as fast as possible before the beat', 'It replaces the main note altogether', 'It is played after the main note'], answer: 0, why: 'An appoggiatura leans into the main note, taking part of its length and sounding on the beat. An acciaccatura, by contrast, is crushed into the note almost without time of its own.' }, { accuracy: 1 }),
        orn('sight', 'Sight-read a line in C', 'sight', { range: [67, 84], hand: 'right', key: 'C', length: 4 }, { accuracy: 0.7 })
      ],
      pass: { minItemsDone: 3 }
    },
    {
      id: 'l11-cadences-and-inversions', title: 'Cadences, inversions and four parts', minutes: 18,
      goal: 'Name the main cadences, read a figured bass for inverted chords, and play a phrase that turns aside with an interrupted cadence.',
      teach: [
        'A cadence is the punctuation at the end of a phrase. The strongest is the perfect cadence, V to I, with the bass moving from dominant to tonic and the top voice landing on the tonic. A plagal cadence, IV to I, is the quiet close; a half cadence stops on the dominant.',
        'An interrupted cadence turns aside at the last moment: V moves not to I but to the minor chord on the sixth degree, vi, so the phrase sounds surprised rather than closed.',
        'A figure under the bass shows the inversion. A six means first inversion, with the third in the bass; a six-four means second inversion, with the fifth lowest. The dominant seventh turns the same way: root position, then first, second and third inversion as the chord is turned upside down.',
        'Four-part writing gives each chord to four voices: soprano, alto, tenor and bass. At the piano the right hand takes the upper two parts and the left hand the lower two, and the melody is the top line.'
      ],
      tip: 'Name the cadence out loud as you reach it. Naming is the fastest way to notice which kind of close you just played.',
      diagram: { type: 'keys', range: [43, 53], highlight: [43, 47, 50, 53], fingers: { 43: 5, 47: 3, 50: 2, 53: 1 } },
      items: [
        cad('cadence-c', 'I-IV-V-I in C, both hands', 'chord', { tb: { type: 'cadence', tonic: 0, hand: 'both' } }, { accuracy: 0.8 }),
        cad('cadence-ab', 'I-IV-V-I in A flat, both hands', 'chord', { tb: { type: 'cadence', tonic: 8, hand: 'both' } }, { accuracy: 0.8 }),
        cad('deceptive', 'An interrupted cadence, both hands', 'piece', { tracks: { right: seq(DECEPT_R), left: seq(DECEPT_L) }, tempo: 72, timeSignature: '4/4' }, { accuracy: 0.75 }),
        cad('ear-chord', 'Name the chord quality', 'ear', { kind: 'chord', qualities: ['major', 'minor', 'diminished', 'augmented'], rounds: 10 }, { accuracy: 0.8 }),
        cad('theory-cadence', 'Naming a cadence', 'theory', { q: 'A phrase ends with the chords V then vi instead of V then I. Which cadence is that?', options: ['An interrupted cadence', 'A perfect cadence', 'A plagal cadence', 'A half cadence'], answer: 0, why: 'An interrupted cadence turns V aside to the minor chord on the sixth degree, so the phrase sounds diverted rather than closed.' }, { accuracy: 1 }),
        cad('theory-figure', 'Reading a figure', 'theory', { q: 'In a figured bass, what does the figure 6 under a chord tell you?', options: ['First inversion: the third is in the bass', 'Root position', 'Second inversion: the fifth is in the bass', 'That the chord is a seventh chord'], answer: 0, why: 'A six means first inversion, so the third of the chord is its lowest note. A six-four would mean second inversion, with the fifth lowest.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 4 }
    }
  ],
  exam: {
    id: 'l11-exam', title: 'Level 11 check-up', passPercent: 80, minTaskPercent: 65,
    items: [
      exam('scale', 'E major scale, hands together', 'scale', { tb: { type: 'scale', tonic: 4, hand: 'both' } }, { accuracy: 0.85 }),
      exam('minor', 'C sharp harmonic minor, hands together', 'scale', { tb: { type: 'harmonic', tonic: 1, hand: 'both' } }, { accuracy: 0.85 }),
      exam('arpeggio', 'B major arpeggio, right hand', 'arpeggio', { tb: { type: 'chord', tonic: 11, hand: 'right' } }, { accuracy: 0.85 }),
      exam('prelude', 'The prelude study, both hands', 'piece', { tracks: { right: seq(PRE_R), left: seq(PRE_L) }, tempo: 63, timeSignature: '4/4' }, { accuracy: 0.8 }),
      exam('cantabile', 'A cantabile study, both hands', 'piece', { tracks: { right: seq(CANT_R), left: seq(CANT_L) }, tempo: 66, timeSignature: '3/4' }, { accuracy: 0.8 }),
      exam('canon', 'A canon at the octave, both hands', 'piece', { tracks: { right: seq(CANON_R), left: seq(CANON_L) }, tempo: 66 }, { accuracy: 0.75 }),
      exam('ostinato', 'Ostinato and melody, both hands', 'piece', { tracks: { right: seq(OST_R), left: seq(OST_L) }, tempo: 92, timeSignature: '4/4' }, { accuracy: 0.8 }),
      exam('piece', 'The Allegro study, both hands', 'piece', { tracks: { right: seq(ALLEGRO_R), left: seq(ALLEGRO_L) }, tempo: 96, timeSignature: '4/4' }, { accuracy: 0.8 }),
      exam('sight', 'Sight-reading in D', 'sight', { range: [59, 84], hand: 'both', key: 'D', length: 4 }, { accuracy: 0.7 }),
      exam('ear', 'Hear the interval', 'ear', { kind: 'interval', intervals: [1,2,3,4,5,6,7,8,9,10,11,12], rounds: 5 }, { accuracy: 0.8 }),
      exam('rhythm', 'Tap a growing figure', 'rhythm', { pattern: [0.5, 0.5, 1, 1, 1, 0.5, 0.5, 1, 1, 1], tempo: 96, timeSignature: '4/4' }, { accuracy: 0.8 }),
      exam('theory', 'Reading a cadence', 'theory', { q: 'A phrase ends with the chords IV then I. Which cadence is that?', options: ['A plagal cadence', 'A perfect cadence', 'An interrupted cadence', 'A half cadence'], answer: 0, why: 'The move from IV to I is the plagal cadence, the quiet close sometimes called the amen cadence.' }, { accuracy: 1 })
    ]
  }
}
