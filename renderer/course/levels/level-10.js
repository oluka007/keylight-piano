// Level 10: Early Advanced. All lesson text, quiz questions and every inline study in this file are
// original, written for this course as note lists. The registered library pieces are named by their
// library id (renderer/songs-mutopia.js); nothing is copied from any score, edition or arrangement.
// The level assumes an 88-key keyboard: the four-octave runs reach C2 at the bottom and C7 at the top.
import { seq, itemsFor } from '../builders.js'

const oct = itemsFor('l10-four-octave-scales')
const arp = itemsFor('l10-arpeggios-and-inversions')
const turca = itemsFor('l10-rondo-alla-turca')
const vars = itemsFor('l10-theme-and-variations')
const rag = itemsFor('l10-ragtime-syncopation')
const atmo = itemsFor('l10-atmosphere-and-pedal')
const read = itemsFor('l10-reading-and-listening')
const exam = itemsFor('l10-exam')

// Registered library works (ids in renderer/songs-mutopia.js).
const TURCA = 'mozart-rondo-alla-turca'
const ENTERTAINER = 'joplin-the-entertainer'
const MAPLE = 'joplin-maple-leaf-rag'
const CLAIR = 'debussy-clair-de-lune'

// --- Lesson 1: four-octave scales, hands together. Each run is four bars of 4/4 (sixteen beats). ---
// C major up four octaves, right hand C3 to C7: twenty-eight half-beat notes, then the top C held two beats.
const SCALE4_R = 'C3:0.5 D3:0.5 E3:0.5 F3:0.5 G3:0.5 A3:0.5 B3:0.5 C4:0.5 D4:0.5 E4:0.5 F4:0.5 G4:0.5 ' +
  'A4:0.5 B4:0.5 C5:0.5 D5:0.5 E5:0.5 F5:0.5 G5:0.5 A5:0.5 B5:0.5 C6:0.5 D6:0.5 E6:0.5 F6:0.5 G6:0.5 A6:0.5 B6:0.5 C7:2'
// The same scale an octave lower, left hand C2 to C6, so the two hands stay exactly an octave apart.
const SCALE4_L = 'C2:0.5 D2:0.5 E2:0.5 F2:0.5 G2:0.5 A2:0.5 B2:0.5 C3:0.5 D3:0.5 E3:0.5 F3:0.5 G3:0.5 ' +
  'A3:0.5 B3:0.5 C4:0.5 D4:0.5 E4:0.5 F4:0.5 G4:0.5 A4:0.5 B4:0.5 C5:0.5 D5:0.5 E5:0.5 F5:0.5 G5:0.5 A5:0.5 B5:0.5 C6:2'

// --- Lesson 2: four-octave arpeggios. Two bars of 4/4 each (eight beats). ---
// C major broken in root position, C3 up to C7, twelve half-beat notes then a held C7.
const ARP4_R = 'C3:0.5 E3:0.5 G3:0.5 C4:0.5 E4:0.5 G4:0.5 C5:0.5 E5:0.5 G5:0.5 C6:0.5 E6:0.5 G6:0.5 C7:2'
// The same arpeggio an octave lower, C2 up to C6.
const ARP4_L = 'C2:0.5 E2:0.5 G2:0.5 C3:0.5 E3:0.5 G3:0.5 C4:0.5 E4:0.5 G4:0.5 C5:0.5 E5:0.5 G5:0.5 C6:2'

// --- Lesson 3: repeated-note control, in A minor, 2/4, four bars. ---
const REP_R = 'A4:0.5 A4:0.5 A4:0.5 C5:0.5 B4:0.5 B4:0.5 A4:0.5 G#4:0.5 ' +
  'A4:0.5 A4:0.5 C5:0.5 E5:0.5 D5:0.5 C5:0.5 B4:0.5 A4:0.5'
const REP_L = 'A2:1 E3:1 E2:1 E3:1 A2:1 E3:1 E2:1 A2:1'

// --- Lesson 4: a theme in C and two variations, 4/4, eight bars each (32 beats). ---
const THEME_R = 'C5:1 D5:1 E5:1 G5:1 F5:1 E5:1 D5:2 ' +
  'E5:1 F5:1 G5:1 A5:1 G5:2 E5:2 ' +
  'F5:1 E5:1 D5:1 C5:1 D5:1 E5:1 F5:2 ' +
  'G5:1 F5:1 E5:1 D5:1 C5:4'
// The harmony of the theme, kept for every variation: C, G, C, C, F, G, G, C.
const THEME_L = 'C3:2 G3:2 G2:2 D3:2 C3:2 G3:2 C3:2 E3:2 F3:2 A3:2 G2:2 D3:2 G2:2 B3:2 C3:4'
// Variation 1: the same tune moved into flowing eighth notes, over the same bass.
const VAR1_R = 'E5:0.5 G5:0.5 F5:0.5 E5:0.5 D5:0.5 E5:0.5 F5:0.5 D5:0.5 ' +
  'E5:0.5 G5:0.5 A5:0.5 G5:0.5 F5:0.5 E5:0.5 D5:1 ' +
  'E5:0.5 G5:0.5 A5:0.5 B5:0.5 A5:0.5 G5:0.5 F5:0.5 E5:0.5 ' +
  'G5:0.5 A5:0.5 G5:0.5 E5:0.5 D5:1 E5:1 ' +
  'F5:0.5 A5:0.5 G5:0.5 F5:0.5 E5:0.5 F5:0.5 G5:0.5 E5:0.5 ' +
  'D5:0.5 F5:0.5 E5:0.5 D5:0.5 E5:0.5 F5:0.5 A5:1 ' +
  'G5:0.5 B5:0.5 A5:0.5 G5:0.5 F5:0.5 E5:0.5 D5:0.5 B4:0.5 ' +
  'C5:1 G5:1 E5:1 C5:1'
// Variation 2: the same harmony dressed as broken chords, one triad per bar.
const VAR2_R = 'E5:0.5 G5:0.5 C6:0.5 G5:0.5 E5:0.5 G5:0.5 C6:0.5 G5:0.5 ' +
  'D5:0.5 G5:0.5 B5:0.5 G5:0.5 D5:0.5 G5:0.5 B5:0.5 G5:0.5 ' +
  'E5:0.5 G5:0.5 C6:0.5 G5:0.5 E5:0.5 G5:0.5 C6:0.5 G5:0.5 ' +
  'C5:0.5 E5:0.5 G5:0.5 E5:0.5 C5:0.5 E5:0.5 G5:0.5 E5:0.5 ' +
  'F5:0.5 A5:0.5 C6:0.5 A5:0.5 F5:0.5 A5:0.5 C6:0.5 A5:0.5 ' +
  'D5:0.5 G5:0.5 B5:0.5 G5:0.5 D5:0.5 G5:0.5 B5:0.5 G5:0.5 ' +
  'D5:0.5 G5:0.5 B5:0.5 G5:0.5 D5:0.5 G5:0.5 B5:0.5 G5:0.5 ' +
  'C5:0.5 E5:0.5 G5:0.5 E5:0.5 C5:2'

// --- Lesson 5: a syncopated ragtime study in C, 2/4, four bars (eight beats). ---
// The left hand plays an oom-pah: a bass note on beat one, a chord tone on beat two.
const RAG_R = 'C4:0.5 E4:1 G4:0.5 A4:0.5 G4:1 E4:0.5 D4:0.5 F4:1 B3:0.5 C4:2'
const RAG_L = 'C3:1 G3:1 C3:1 G3:1 G2:1 D3:1 C3:1 G3:1'

// --- Lesson 6: an atmospheric study in D flat major, 4/4, four bars (16 beats), for pedal. ---
const ATMO_L = 'Db3:0.5 Ab3:0.5 F3:0.5 Ab3:0.5 Db3:0.5 Ab3:0.5 F3:0.5 Ab3:0.5 ' +
  'Bb2:0.5 F3:0.5 Db3:0.5 F3:0.5 Bb2:0.5 F3:0.5 Db3:0.5 F3:0.5 ' +
  'Gb2:0.5 Db3:0.5 Bb3:0.5 Db3:0.5 Gb2:0.5 Db3:0.5 Bb3:0.5 Db3:0.5 ' +
  'Ab2:0.5 Eb3:0.5 C4:0.5 Eb3:0.5 Db3:0.5 Ab3:0.5 F3:0.5 Ab3:0.5'
const ATMO_R = 'F4:1 Ab4:1 Db5:2 C5:1 Db5:1 Bb4:2 Bb4:1 Ab4:1 Gb4:2 F4:1 Eb4:1 Db4:2'

export const level10 = {
  id: 'level-10', number: 10, title: 'Early Advanced', grade: 'RCM 8, ABRSM Grade 7', keys: 88,
  blurb: 'Early advanced: four-octave scales and arpeggios at speed, showpieces such as the Turkish rondo, ragtime syncopation, and atmospheric music shaped with the pedal. Play this level on an 88-key keyboard, where the four-octave runs reach the bottom and the top of the range.',
  lessons: [
    {
      id: 'l10-four-octave-scales', title: 'Four-octave scales, hands together', minutes: 20,
      goal: 'Play C, G and D major hands together, then C major across four octaves, with an even line.',
      teach: [
        'A four-octave scale is the pattern you know, stretched across the whole keyboard. The fingering is the same in every octave, so once one octave is secure you can play all four. Play it slowly first and listen for one even line, with no bump where the hand turns.',
        'Hands together, the two hands must sound each note at exactly the same moment. The awkward places are the turns, where the thumb passes under in the right hand and where a finger crosses over the thumb in the left. Slow down there, practise the turn on its own, and only then rejoin the run.',
        'Speed comes last. Play at a comfortable tempo, then nudge the metronome up a little. Move on only when four octaves feel even and calm at the new speed. A rushed scale is worth less than a steady one.'
      ],
      tip: 'Practise the two turns on their own as a loop, slowly, before you play the whole run. The turns are where hands-together scales fall apart.',
      diagram: { type: 'keys', range: [60, 71], highlight: [60, 62, 64, 65, 67, 69, 71], fingers: { 60: 1, 62: 2, 64: 3, 65: 1, 67: 2, 69: 3, 71: 4 } },
      items: [
        oct('scale-c', 'C major scale, hands together', 'scale', { tb: { type: 'scale', tonic: 0, hand: 'both' } }, { accuracy: 0.85 }),
        oct('scale-g', 'G major scale, hands together', 'scale', { tb: { type: 'scale', tonic: 7, hand: 'both' } }, { accuracy: 0.85 }),
        oct('scale-d', 'D major scale, hands together', 'scale', { tb: { type: 'scale', tonic: 2, hand: 'both' } }, { accuracy: 0.85 }),
        oct('run', 'Four octaves up, both hands', 'piece', { tracks: { right: seq(SCALE4_R), left: seq(SCALE4_L) }, tempo: 72, timeSignature: '4/4' }, { accuracy: 0.75 }),
        oct('theory', 'Playing a scale hands together', 'theory', { q: 'When you play a scale with both hands, what matters most for a smooth result?', options: ['Both hands sounding each note at exactly the same moment', 'The right hand always running ahead of the left', 'Each hand moving at a different speed', 'Lifting the fingers high on every note'], answer: 0, why: 'Hands-together playing is about coincidence: each note should speak at the same instant in both hands. The turns are the hardest places, so they need slow, careful practice.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 3 }
    },
    {
      id: 'l10-arpeggios-and-inversions', title: 'Arpeggios, inversions and the I-IV-V-I progression', minutes: 20,
      goal: 'Play four-octave arpeggios in both hands, name root position and the two inversions of a triad, and play I-IV-V-I cleanly.',
      teach: [
        'An arpeggio opens the hand wider than a scale, with skips instead of steps. Four octaves of C major run C, E, G, C again and again up to the top of the keyboard. Keep the hand relaxed and let the arm follow the line.',
        'A triad has three positions: root position and two inversions. Root position puts the root lowest, first inversion puts the third lowest, and second inversion puts the fifth lowest. The notes never change; only their order does.',
        'The chord progression I, IV, V, I uses the three main chords of a key. In C they are C, F and G. Play the progression in both hands and check that each hand moves to the notes of the same chord.'
      ],
      tip: 'Say the lowest note out loud in each inversion. The lowest note is what names the position.',
      diagram: { type: 'keys', range: [60, 72], highlight: [60, 64, 67, 72], fingers: { 60: 1, 64: 2, 67: 3, 72: 5 } },
      items: [
        arp('arp-c', 'C major arpeggio, hands together', 'arpeggio', { tb: { type: 'chord', tonic: 0, hand: 'both' } }, { accuracy: 0.85 }),
        arp('arp-g', 'G major arpeggio, hands together', 'arpeggio', { tb: { type: 'chord', tonic: 7, hand: 'both' } }, { accuracy: 0.85 }),
        arp('cadence', 'I-IV-V-I in C, both hands', 'chord', { tb: { type: 'cadence', tonic: 0, hand: 'both' } }, { accuracy: 0.8 }),
        arp('run', 'Four octaves of C, broken, both hands', 'piece', { tracks: { right: seq(ARP4_R), left: seq(ARP4_L) }, tempo: 72, timeSignature: '4/4' }, { accuracy: 0.75 }),
        arp('theory', 'Naming an inversion', 'theory', { q: 'Which note is lowest in the second inversion of the C major triad?', options: ['G', 'C', 'E', 'A'], answer: 0, why: 'Second inversion places the fifth at the bottom, so the C major triad stands as G, C and E, with the fifth sounding lowest.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 3 }
    },
    {
      id: 'l10-rondo-alla-turca', title: 'A Turkish rondo: control, speed and ornaments', minutes: 22,
      goal: 'Shape a quick rondo with a steady march pulse, light repeated notes, and ornaments played in time.',
      teach: [
        'A rondo keeps one tune returning between contrasting episodes. In this Turkish rondo the music that keeps returning is the march in A major, with its drumming left hand, the janissary-band sound that gives it its name.',
        'Quick music is a test of control, not of force. Keep the pulse steady and play repeated notes lightly from the key surface, with a calm wrist. Let the left hand stay firm and even, like a drum, so the right hand can move freely above it.',
        'Ornaments decorate single notes. A trill shakes between a note and the one above it. A mordent touches the neighbour note and returns at once. A small note that leans on the main note on the beat, taking part of its time, is an appoggiatura. Play every ornament in time, never as an extra beat.'
      ],
      tip: 'Count in a firm two and keep the left hand as steady as a drum. The rondo should sparkle, never rush.',
      diagram: { type: 'staff', clef: 'treble', notes: [{ p: 69 }, { p: 69 }, { p: 71 }, { p: 69 }] },
      items: [
        turca('piece', 'A Turkish rondo', 'piece', { song: TURCA }, { accuracy: 0.7 }),
        turca('repeated', 'Repeated notes, right hand', 'piece', { notes: seq(REP_R), tempo: 104, hand: 'right', timeSignature: '2/4' }, { accuracy: 0.8 }),
        turca('both', 'Repeated notes over the left hand', 'piece', { tracks: { right: seq(REP_R), left: seq(REP_L) }, tempo: 100, timeSignature: '2/4' }, { accuracy: 0.75 }),
        turca('rhythm', 'Tap a march-like figure', 'rhythm', { pattern: [0.5, 0.5, 0.5, 0.5, 1, 1], tempo: 104, timeSignature: '2/4' }, { accuracy: 0.8 }),
        turca('theory', 'Playing repeated notes', 'theory', { q: 'What is the safest way to play a fast run of repeated notes?', options: ['Lightly, from the key surface, with a calm wrist', 'With heavy arm weight on every note', 'By lifting each finger high above the key', 'As slowly as possible at all times'], answer: 0, why: 'Repeated notes are most even when the fingers stay close and the wrist stays calm. Large movements slow the run and make it uneven.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 3 }
    },
    {
      id: 'l10-theme-and-variations', title: 'Theme and variations', minutes: 20,
      goal: 'Play a theme and two variations that keep the same harmony while the rhythm and texture change.',
      teach: [
        'Theme and variations takes one tune and presents it again and again, each time changed in a different way. The harmony usually stays the same, so the listener can still follow the tune underneath, even when its surface is new.',
        'A first variation often changes the rhythm, turning long notes into flowing ones. A later variation may break the tune into chords, add ornaments, or hand the melody to the left hand. The theme is the seed, and each variation is a fresh view of it.',
        'Keep the pulse steady from one variation to the next and make the start of each one clear. Listeners follow the shape when they can hear the theme return, so whatever clothes the melody wears, keep that line easy to hear.'
      ],
      tip: 'Learn the theme alone first, in both hands. Everything after it grows from that shape.',
      diagram: { type: 'staff', clef: 'treble', notes: [{ p: 72 }, { p: 74 }, { p: 76 }, { p: 79 }] },
      items: [
        vars('theme-r', 'The theme, right hand', 'piece', { notes: seq(THEME_R), tempo: 84, hand: 'right', timeSignature: '4/4' }, { accuracy: 0.8 }),
        vars('theme', 'The theme, both hands', 'piece', { tracks: { right: seq(THEME_R), left: seq(THEME_L) }, tempo: 80, timeSignature: '4/4' }, { accuracy: 0.75 }),
        vars('var1', 'Variation 1, flowing eighths', 'piece', { tracks: { right: seq(VAR1_R), left: seq(THEME_L) }, tempo: 80, timeSignature: '4/4' }, { accuracy: 0.75 }),
        vars('var2', 'Variation 2, broken chords', 'piece', { tracks: { right: seq(VAR2_R), left: seq(THEME_L) }, tempo: 80, timeSignature: '4/4' }, { accuracy: 0.75 }),
        vars('theory', 'What a variation keeps', 'theory', { q: 'In theme and variations, what usually stays the same from one variation to the next?', options: ['The harmony of the theme', 'The rhythm of the melody', 'The texture of the melody', 'Nothing at all'], answer: 0, why: 'A variation dresses the same tune in a new rhythm, texture or ornaments, but the underlying harmony usually stays, so the theme remains recognisable.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 3 }
    },
    {
      id: 'l10-ragtime-syncopation', title: 'Ragtime and syncopation', minutes: 20,
      goal: 'Play a syncopated right hand over a strict oom-pah left hand, and hear how syncopation shifts the accent.',
      teach: [
        'Ragtime is dance music built on two layers that disagree. The left hand keeps a steady oom-pah: a low bass note on the first beat, a higher chord tone on the second, over and over. The right hand does the talking.',
        'Syncopation shifts the accent. The right hand places notes between the beats and holds them across, so a weak part of the beat is stressed. Against the square left hand that off-balance swing is the whole point of ragtime.',
        'Keep the left hand light and strict, like a drummer, while the right hand plays freely. Work slowly so each syncopated note lands in exactly the right place, then let the tempo rise without losing the lift.'
      ],
      tip: 'Tap the left-hand pulse with your foot while the right hand plays. Two steady taps a bar, even when the melody dodges them.',
      diagram: { type: 'staff', clef: 'treble', notes: [{ p: 60 }, { p: 64 }, { p: 67 }, { p: 72 }] },
      items: [
        rag('entertainer', 'The Entertainer', 'piece', { song: ENTERTAINER }, { accuracy: 0.7 }),
        rag('maple', 'Maple Leaf Rag', 'piece', { song: MAPLE }, { accuracy: 0.7 }),
        rag('study', 'A syncopated study, both hands', 'piece', { tracks: { right: seq(RAG_R), left: seq(RAG_L) }, tempo: 96, timeSignature: '2/4' }, { accuracy: 0.75 }),
        rag('rhythm', 'Tap a syncopated bar', 'rhythm', { pattern: [0.5, 1, 0.5, 0.5, 1, 0.5], tempo: 96, timeSignature: '2/4' }, { accuracy: 0.8 }),
        rag('theory', 'What syncopation does', 'theory', { q: 'What does syncopation do to the rhythm?', options: ['It accents notes that fall between or across the beats', 'It puts every note exactly on the beat', 'It removes the beat altogether', 'It doubles the tempo'], answer: 0, why: 'Syncopation shifts the accent onto weak or off-beat notes. That is what gives ragtime its springy, off-balance swing.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 3 }
    },
    {
      id: 'l10-atmosphere-and-pedal', title: 'Atmosphere, colour and the pedal', minutes: 20,
      goal: 'Play a quiet, flowing study in D flat major with a singing melody and pedal changes on each harmony.',
      teach: [
        'Some piano music is built on colour and mood rather than a strong tune. Soft, flowing broken chords, a gentle melody floating above them, and the damper pedal held through each harmony create a hazy, dreamy sound.',
        'The pedal is the painter here. Change it just after each new harmony sounds, so one chord glows into the next without smearing. Keep the touch quiet and let the melody stand only a little above the accompaniment, so it floats free.',
        'Such a piece is marked andante, at a walking pace, and asks for a very expressive, singing touch. Lean a little at the top of a phrase and give the time back. Above all, keep the soft passages soft: the atmosphere depends on restraint.'
      ],
      tip: 'Change the pedal on the new harmony, not on the bar line. The harmony, not the metre, tells you when to change.',
      diagram: { type: 'keys', range: [61, 73], highlight: [61, 65, 68, 73], fingers: { 61: 2, 65: 1, 68: 2, 73: 4 } },
      items: [
        atmo('piece', 'Clair de Lune', 'piece', { song: CLAIR }, { accuracy: 0.7 }),
        atmo('melody', 'The melody alone', 'piece', { notes: seq(ATMO_R), tempo: 60, hand: 'right', timeSignature: '4/4' }, { accuracy: 0.8 }),
        atmo('both', 'A flowing study in D flat, both hands', 'piece', { tracks: { right: seq(ATMO_R), left: seq(ATMO_L) }, tempo: 60, timeSignature: '4/4' }, { accuracy: 0.75 }),
        atmo('ear', 'Hear the interval', 'ear', { kind: 'interval', intervals: [1, 2, 3, 4, 5, 7, 8, 9, 12], rounds: 10 }, { accuracy: 0.8 }),
        atmo('theory', 'What andante means', 'theory', { q: 'What does the tempo word andante tell you to do?', options: ['Play at a walking pace', 'Play as fast as possible', 'Play very loudly', 'Play as slowly as possible'], answer: 0, why: 'Andante means at a moderate, walking pace. It asks for a calm, steady flow rather than a rush or a crawl.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 3 }
    },
    {
      id: 'l10-reading-and-listening', title: 'Reading and listening: ornaments, form and related keys', minutes: 18,
      goal: 'Name three ornaments, tell the main forms apart, tell relative from parallel keys, and read a new line at sight.',
      teach: [
        'Ornaments decorate a single note. A trill alternates the note with the one above it. A mordent touches the neighbour note and returns at once. A turn circles the note, above, back, below, back. Play them lightly and exactly in time.',
        'Form tells you how a piece is built. Two sections make binary form; a third section that returns to the opening makes ternary, A B A. A rondo brings its refrain back between episodes, and a sonata sets an exposition against a development and a return.',
        'Related keys sit close by. The relative minor shares a key signature with its major. The parallel minor starts on the same note but changes the signature. A move to the dominant, a fifth up, is the commonest change of key in a piece.'
      ],
      tip: 'Before sight-reading, read the key signature and time signature, find the highest and lowest notes, then keep going without stopping.',
      items: [
        read('theory-orn', 'Naming an ornament', 'theory', { q: 'Which ornament touches the note above or below and returns to the written note at once?', options: ['A mordent', 'A trill', 'A turn', 'A tie'], answer: 0, why: 'A mordent plays the written note, touches its neighbour, and returns straight away. A trill shakes with the note above, and a turn circles the note.' }, { accuracy: 1 }),
        read('theory-form', 'Naming a form', 'theory', { q: 'A piece has three sections, and the third returns to the music of the first. Which form is that?', options: ['Ternary, A B A', 'Binary form', 'Rondo form', 'Theme and variations'], answer: 0, why: 'When a third section brings back the opening, the shape is ternary, A B A. Two sections alone would be binary form.' }, { accuracy: 1 }),
        read('theory-key', 'Relative or parallel', 'theory', { q: 'What is the relationship between C major and A minor?', options: ['A minor is the relative minor of C major', 'A minor is the parallel minor of C major', 'They have different key signatures', 'They are the same key'], answer: 0, why: 'A minor shares the key signature of C major, with no sharps and no flats, so it is its relative minor. A parallel minor would start on C.' }, { accuracy: 1 }),
        read('ear', 'Hear the interval', 'ear', { kind: 'interval', intervals: [1, 2, 3, 4, 5, 7, 8, 9, 12], rounds: 10 }, { accuracy: 0.8 }),
        read('game', 'Read the Treble', 'notegame', { game: 'read-treble', rounds: 18 }, { accuracy: 0.8 }),
        read('sight', 'Sight-read a wide line', 'sight', { range: [48, 84], hand: 'both', key: 'C', length: 4 }, { accuracy: 0.7 })
      ],
      pass: { minItemsDone: 4 }
    }
  ],
  exam: {
    id: 'l10-exam', title: 'Level 10 check-up', passPercent: 80, minTaskPercent: 65,
    items: [
      exam('scale', 'C major scale, hands together', 'scale', { tb: { type: 'scale', tonic: 0, hand: 'both' } }, { accuracy: 0.85 }),
      exam('arpeggio', 'C major arpeggio, hands together', 'arpeggio', { tb: { type: 'chord', tonic: 0, hand: 'both' } }, { accuracy: 0.85 }),
      exam('chords', 'I-IV-V-I in C, both hands', 'chord', { tb: { type: 'cadence', tonic: 0, hand: 'both' } }, { accuracy: 0.8 }),
      exam('run', 'Four octaves up, both hands', 'piece', { tracks: { right: seq(SCALE4_R), left: seq(SCALE4_L) }, tempo: 72, timeSignature: '4/4' }, { accuracy: 0.8 }),
      exam('variation', 'A variation over the theme', 'piece', { tracks: { right: seq(VAR1_R), left: seq(THEME_L) }, tempo: 80, timeSignature: '4/4' }, { accuracy: 0.75 }),
      exam('ragtime', 'A syncopated study, both hands', 'piece', { tracks: { right: seq(RAG_R), left: seq(RAG_L) }, tempo: 96, timeSignature: '2/4' }, { accuracy: 0.8 }),
      exam('piece', 'A Turkish rondo', 'piece', { song: TURCA }, { accuracy: 0.7 }),
      exam('sight', 'Sight-reading, both hands', 'sight', { range: [48, 84], hand: 'both', key: 'C', length: 4 }, { accuracy: 0.7 }),
      exam('ear', 'Hear the interval', 'ear', { kind: 'interval', intervals: [1, 2, 3, 4, 5, 7, 8, 9, 12], rounds: 5 }, { accuracy: 0.8 }),
      exam('rhythm', 'Tap a syncopated bar', 'rhythm', { pattern: [0.5, 1, 0.5, 0.5, 1, 0.5], tempo: 96, timeSignature: '2/4' }, { accuracy: 0.8 }),
      exam('theory', 'Naming an ornament', 'theory', { q: 'Which ornament shakes quickly between a note and the note above it?', options: ['A trill', 'A mordent', 'A turn', 'A grace note'], answer: 0, why: 'A trill alternates the written note with the one above it. A mordent touches the neighbour and returns, and a turn circles the note.' }, { accuracy: 1 })
    ]
  }
}
