// Level 5: Longer Studies. All text and all music in this file are original: every inline piece is
// a short study written as a note list. Every inline note stays inside C3-B4; scale and arpeggio
// exercises use the app's own window. No third-party scores, editions or arrangements are used.
import { seq, itemsFor } from '../builders.js'

const long = itemsFor('l5-long-lines')
const two = itemsFor('l5-d-and-bflat')
const dmin = itemsFor('l5-d-minor')
const brok = itemsFor('l5-broken-chords')
const march = itemsFor('l5-march')
const hymn = itemsFor('l5-hymn')
const fast = itemsFor('l5-fast-study')
const sig = itemsFor('l5-key-signatures')
const exam = itemsFor('l5-exam')

// Original studies written for this level.
const SCALE_LH = 'C3 D3 E3 F3 G3 A3 B3 C4 B3 A3 G3 F3 E3 D3 C3:2'
const LONG_R = 'C4 D4 E4 F4 G4 A4 B4 A4 G4 F4 E4 D4 C4:4'
const HOLD = 'C3:4 C3:4 C3:4 C3:4'
const D_TUNE = 'D4 F#4 A4 F#4 D4 E4 F#4:2 G4 F#4 E4 D4 E4:2 D4:2'
const BB_TUNE = 'Bb3 D4 F4 D4 Bb3 C4 D4:2 Eb4 D4 C4 Bb3 C4:2 Bb3:2'
const MINOR_TUNE = 'D4 E4 F4 G4 A4:2 F4:2 E4 F4 G4 A4 Bb4:2 A4:2 G4 F4 E4 D4 D4:4'
const LEAD_LH = 'D3:2 F3:2 A3:2 D4:2 A3:2 C#4:2 D4:4'
const AM_R = 'E4 F4 G4 A4 G4:2 E4:2 F4 G4 A4 B4 A4:4'
const AM_L = 'A3 C4 E4 C4 E4 C4 A3:2 D3 F3 A3 F3 A3 C4 A3:2'
const MARCH_R = 'C4 E4 G4 E4 C4:2 E4:2 D4 F4 A4 F4 G4:4'
const MARCH_L = 'C3:2 G3:2 C3:2 G3:2 D3:2 A3:2 G3:4'
const HYMN_R = 'A4:2 F4:2 G4:2 A4:2 Bb4:2 G4:2 F4:4'
const HYMN_L = 'F3:4 C3:4 C3:4 F3:4'
// The fast study: sixteen sixteenth notes in bar 1, twelve plus a quarter note in bar 2.
const STUDY = 'C4:0.25 D4:0.25 E4:0.25 F4:0.25 G4:0.25 F4:0.25 E4:0.25 D4:0.25 C4:0.25 D4:0.25 E4:0.25 F4:0.25 G4:0.25 F4:0.25 E4:0.25 D4:0.25 E4:0.25 F4:0.25 G4:0.25 F4:0.25 E4:0.25 D4:0.25 E4:0.25 F4:0.25 E4:0.25 D4:0.25 C4:0.25 D4:0.25 C4:1'
const STUDY_L = 'C3:2 G3:2 G3:2 C3:2'

export const level5 = {
  id: 'level-5', number: 5, title: 'Longer Studies', grade: 'RCM 3, ABRSM Grade 2-3', keys: 24,
  blurb: 'Longer scale lines, three new keys, a moving left hand, and short studies in march, hymn and study style.',
  lessons: [
    {
      id: 'l5-long-lines', title: 'Longer lines: the scale and the arpeggio', minutes: 15,
      goal: 'Play the C major scale and the C major arpeggio along a whole octave, with one smooth thumb pass.',
      teach: [
        'So far you have played one octave of the C major scale. Now play it smoothly and evenly from C up to C and back, with one quiet thumb pass each way. A two-octave scale repeats the same pattern: the thumb plays every C and F except the top C, which takes finger 5.',
        'Moving down is the mirror. The little finger starts, and when you reach F the third finger steps over the thumb. Play the descent as slowly as the climb: uneven hands rush on the way up and stumble on the way down.',
        'An arpeggio plays the notes of a chord one after another. The C major arpeggio is C E G C. Your hand opens wider than in a scale, with skips instead of steps, and the thumb passes under to carry on into the next octave.'
      ],
      tip: 'Practise the thumb pass on its own, slowly, before you play the whole line.',
      diagram: { type: 'keys', range: [60, 71], highlight: [60, 62, 64, 65, 67, 69, 71], fingers: { 60: 1, 62: 2, 64: 3, 65: 1, 67: 2, 69: 3, 71: 4 } },
      items: [
        long('scale-r', 'C major scale, right hand', 'scale', { tb: { type: 'scale', tonic: 0, hand: 'right' } }, { accuracy: 0.85 }),
        long('arp-r', 'C major arpeggio, right hand', 'arpeggio', { tb: { type: 'chord', tonic: 0, hand: 'right' } }, { accuracy: 0.8 }),
        long('piece-l', 'Long line, left hand', 'piece', { notes: seq(SCALE_LH), tempo: 66, hand: 'left' }, { accuracy: 0.8 }),
        long('both', 'Long line over a held bass', 'piece', { tracks: { right: seq(LONG_R), left: seq(HOLD) }, tempo: 66 }, { accuracy: 0.75 }),
        long('echo', 'Echo a longer line', 'echo', { notes: seq('C4 D4 E4 F4 G4 A4'), tempo: 70, hand: 'right', rounds: 4 }, { accuracy: 0.8 }),
        long('theory', 'The thumb in a long scale', 'theory', { q: 'In the right-hand C major scale, which notes does the thumb play?', options: ['C and F', 'C, E and G', 'Every note', 'Only the top C'], answer: 0, why: 'The fingering is 1 2 3 1 2 3 4 5: the thumb plays C, then passes under to F. The top C takes finger 5.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 3 }
    },
    {
      id: 'l5-d-and-bflat', title: 'Two new keys: D major and B flat major', minutes: 16,
      goal: 'Play the D major and B flat major scales and name the sharps and flats of each key.',
      teach: [
        'D major uses two sharps: F sharp and C sharp. Keep the white keys D E G A B and add the two black keys F sharp and C sharp. The pattern of whole and half steps is the same as in C major, so the scale sounds like the same shape, only higher.',
        'B flat major uses two flats: B flat and E flat. On the keyboard the black key just left of any B is B flat, and the black key just left of any E is E flat. Say the two flats out loud before you start, so your fingers expect them.',
        'Starting on a black key feels odd at first. In B flat major the thumb goes on C and F, never on a black key: right hand 2 1 2 3 1 2 3 4 from B flat up. Play black keys near their front edge, fingers a little flatter, and keep the wrist level.'
      ],
      tip: 'Warm up with the C scale you know, then move the same shape to D. Only two notes change.',
      diagram: { type: 'keys', range: [62, 69], highlight: [62, 64, 66, 67, 69], fingers: { 62: 1, 64: 2, 66: 3, 67: 4, 69: 5 } },
      items: [
        two('five-d', 'Five-finger D, right hand', 'five-finger', { tb: { type: 'five', tonic: 2, hand: 'right' } }, { accuracy: 0.8 }),
        two('scale-d', 'D major scale, right hand', 'scale', { tb: { type: 'scale', tonic: 2, hand: 'right' } }, { accuracy: 0.85 }),
        two('scale-bb', 'B flat major scale, right hand', 'scale', { tb: { type: 'scale', tonic: 10, hand: 'right' } }, { accuracy: 0.85 }),
        two('piece-d', 'A tune in D major', 'piece', { notes: seq(D_TUNE), tempo: 76, hand: 'right' }, { accuracy: 0.8 }),
        two('piece-bb', 'A tune in B flat major', 'piece', { notes: seq(BB_TUNE), tempo: 76, hand: 'right' }, { accuracy: 0.8 }),
        two('theory', 'Two sharps', 'theory', { q: 'Which two notes are sharp in the key of D major?', options: ['F and G', 'C and G', 'F and C', 'B and E'], answer: 2, why: 'D major has F sharp and C sharp in its key signature.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 4 }
    },
    {
      id: 'l5-d-minor', title: 'D minor and the raised seventh', minutes: 15,
      goal: 'Play D minor in its natural and harmonic forms and hear how the raised seventh pulls home.',
      teach: [
        'D minor uses the same key signature as F major: one flat, B flat. The scale is D E F G A B flat C D. Its third note, F, is a half step lower than the F sharp of D major, and that lowered third is what makes a minor scale sound sad.',
        'In the harmonic form the seventh note is raised: C becomes C sharp. The raised seventh sits a half step below the tonic, so it leans up to D and the music feels as if it must arrive there. That note is called the leading tone.',
        'Play the natural form first and listen to the gap between C and D. Then play it again with C sharp and hear how much more strongly the line wants to finish. Both forms are D minor; the harmonic form is the usual choice at the end of a phrase.'
      ],
      diagram: { type: 'keys', range: [62, 74], highlight: [62, 64, 65, 67, 69, 70, 73, 74], fingers: { 62: 1, 64: 2, 65: 3, 67: 1, 69: 2, 70: 3, 73: 4, 74: 5 } },
      items: [
        dmin('scale-nat', 'D natural minor, right hand', 'scale', { tb: { type: 'minor', tonic: 2, hand: 'right' } }, { accuracy: 0.85 }),
        dmin('scale-harm', 'D harmonic minor, right hand', 'scale', { tb: { type: 'harmonic', tonic: 2, hand: 'right' } }, { accuracy: 0.85 }),
        dmin('piece-l', 'The leading tone, left hand', 'piece', { notes: seq(LEAD_LH), tempo: 72, hand: 'left' }, { accuracy: 0.8 }),
        dmin('piece-r', 'A tune in D minor', 'piece', { notes: seq(MINOR_TUNE), tempo: 72, hand: 'right' }, { accuracy: 0.8 }),
        dmin('echo', 'Echo a minor phrase', 'echo', { notes: seq('A4 G4 F4 E4 D4 F4'), tempo: 72, hand: 'right', rounds: 4 }, { accuracy: 0.8 }),
        dmin('theory', 'The raised seventh', 'theory', { q: 'In D harmonic minor, which note is raised?', options: ['F to F sharp', 'C to C sharp', 'B flat to B natural', 'A to A sharp'], answer: 1, why: 'The seventh note of D minor is C, raised to C sharp in the harmonic form so that it leads up to D.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 4 }
    },
    {
      id: 'l5-broken-chords', title: 'Broken chords in the left hand', minutes: 16,
      goal: 'Play a moving left hand of root, third and fifth while the right hand keeps the tune.',
      teach: [
        'A blocked chord sounds all its notes at once. The same notes in a broken pattern come one after another, and a moving left hand keeps the music alive under a long melody. In C the three notes are C, E and G; in A minor they are A, C and E.',
        'Keep the left hand soft and even. The tune is still the main line, so the broken chord must not cover it. Aim for the same volume on every note of the pattern, and let the wrist float over the keys instead of jumping.',
        'Practise the left hand alone until the pattern feels automatic, then add the right hand. If the two hands lose each other, slow down and check where the changes land: the left hand normally changes chord at the start of a bar or half bar.'
      ],
      items: [
        brok('arp-c', 'C major arpeggio, left hand', 'arpeggio', { tb: { type: 'chord', tonic: 0, hand: 'left' } }, { accuracy: 0.8 }),
        brok('arp-g', 'G major arpeggio, left hand', 'arpeggio', { tb: { type: 'chord', tonic: 7, hand: 'left' } }, { accuracy: 0.8 }),
        brok('cadence', 'I-IV-V-I in C', 'chord', { tb: { type: 'cadence', tonic: 0, hand: 'both' } }, { accuracy: 0.8 }),
        brok('piece', 'Broken chords under a tune', 'piece', { tracks: { right: seq(AM_R), left: seq(AM_L) }, tempo: 72 }, { accuracy: 0.75 }),
        brok('theory', 'Which three notes', 'theory', { q: 'Which three notes make the A minor triad?', options: ['A, C sharp and E', 'A, D and F', 'C, E and G', 'A, C and E'], answer: 3, why: 'The A minor triad stacks A, C and E, a skip apart from each other.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 3 }
    },
    {
      id: 'l5-march', title: 'A march: short notes and accents', minutes: 15,
      goal: 'Play in march character, with detached notes and a firm accent on the first beat of each bar.',
      teach: [
        'A march moves with two heavy beats in a bar, like feet on a path. In 4/4 the strongest beat is the first, with a lighter accent on the third. Some marches are written in 2/4, where every bar has just two beats: strong, then weak.',
        'An accent mark, a small wedge pointing right, tells you to give that note extra weight. Keep the notes short as well: marches are often played detached, with every note lifted off the key as soon as it sounds.',
        'Use a little more arm on the accented note and keep the fingers close to the keys everywhere else. A march should sound firm, not stiff: the beat is steady, but the hands stay relaxed between the accents.'
      ],
      tip: 'Count out loud as you march. One, two, three, four in a firm voice, on the same pulse as your playing.',
      items: [
        march('rhythm', 'Tap a march', 'rhythm', { pattern: [1, 1, 1, 1, 1, 1, 2], tempo: 96, timeSignature: '4/4' }, { accuracy: 0.8 }),
        march('piece-r', 'March, right hand', 'piece', { notes: seq(MARCH_R), tempo: 92, hand: 'right' }, { accuracy: 0.8 }),
        march('piece-both', 'March, both hands', 'piece', { tracks: { right: seq(MARCH_R), left: seq(MARCH_L) }, tempo: 88 }, { accuracy: 0.75 }),
        march('echo', 'Echo a march phrase', 'echo', { notes: seq('C4 E4 G4 E4 C4:2'), tempo: 92, hand: 'right', rounds: 3 }, { accuracy: 0.8 }),
        march('theory', 'Feeling a march', 'theory', { q: 'Where does the strongest accent fall in a march in 4/4?', options: ['On the second beat', 'On the last beat', 'On no beat in particular', 'On the first beat of the bar'], answer: 3, why: 'The first beat carries the main accent, with a lighter one on the third beat.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 3 }
    },
    {
      id: 'l5-hymn', title: 'Chordal style and balance', minutes: 15,
      goal: 'Play hymn-style music with an even texture and bring the melody out above the lower parts.',
      teach: [
        'Hymn music is written in four parts: soprano, alto, tenor and bass. All four move together, one chord at a time. At the piano the right hand usually takes the soprano and alto and the left hand the tenor and bass, so each hand plays two notes at once.',
        'When several notes sound together, one of them should lead. The top note is normally the melody, so give it slightly more weight and keep the notes below softer and even. That is called voicing, and it turns a block of sound into a line.',
        'Build the chord from the bottom. Practise the lower notes alone first, then add the melody on top and listen to the top line only. If you can still hear the tune, the balance is right.'
      ],
      tip: 'This phrase gives you the outer parts, soprano and bass; the I-IV-V-I item puts three notes in the right hand for voicing practice.',
      items: [
        hymn('cadence-f', 'I-IV-V-I in F', 'chord', { tb: { type: 'cadence', tonic: 5, hand: 'both' } }, { accuracy: 0.8 }),
        hymn('cadence-c', 'I-IV-V-I in C, left hand', 'chord', { tb: { type: 'cadence', tonic: 0, hand: 'left' } }, { accuracy: 0.8 }),
        hymn('piece', 'A hymn phrase, both hands', 'piece', { tracks: { right: seq(HYMN_R), left: seq(HYMN_L) }, tempo: 66 }, { accuracy: 0.75 }),
        hymn('echo', 'Echo a hymn phrase', 'echo', { notes: seq('A4 F4 G4 A4 Bb4 G4'), tempo: 66, hand: 'right', rounds: 3 }, { accuracy: 0.8 }),
        hymn('theory', 'Four parts', 'theory', { q: 'In hymn style, which parts does the left hand usually play?', options: ['Soprano and alto', 'Soprano and bass', 'The melody only', 'Tenor and bass'], answer: 3, why: 'The left hand takes the two lower parts, tenor and bass, while the right hand takes soprano and alto.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 3 }
    },
    {
      id: 'l5-fast-study', title: 'Even groups of four: a fast study', minutes: 16,
      goal: 'Play four quick notes per beat evenly, and keep the same evenness as the tempo rises.',
      teach: [
        'Four quick notes in one beat are written with two beams and are called sixteenth notes. Count them one, e, and, a inside the beat. Four short sounds fill the space where one quarter note would sit, so the pulse itself does not change.',
        'Speed is a result, not a target. Play the group slowly and evenly first: four notes of the same length and the same volume. Uneven fingers are the real problem in fast music, not a slow tempo.',
        'Raise the tempo only when a group feels comfortable four times in a row. If a group turns muddy, go back to the slower speed, play it alone a few times, and then rejoin. A clean slow run is worth more than a rushed fast one.'
      ],
      tip: 'Keep the fingers close to the keys in fast groups. Big finger movements cost time you do not have.',
      items: [
        fast('rhythm', 'Tap even sixteenths', 'rhythm', { pattern: [0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 1, 1, 1, 1, 1, 1], tempo: 72, timeSignature: '4/4' }, { accuracy: 0.8 }),
        fast('piece', 'Study in even groups', 'piece', { notes: seq(STUDY), tempo: 72, hand: 'right' }, { accuracy: 0.8 }),
        fast('piece-both', 'Study with the left hand', 'piece', { tracks: { right: seq(STUDY), left: seq(STUDY_L) }, tempo: 69 }, { accuracy: 0.75 }),
        fast('echo', 'Echo a quick group', 'echo', { notes: seq('E4:0.25 F4:0.25 G4:0.25 A4:0.25 G4:1'), tempo: 72, hand: 'right', rounds: 4 }, { accuracy: 0.8 }),
        fast('theory', 'Four in a beat', 'theory', { q: 'How many sixteenth notes fill one beat in 4/4?', options: ['Two', 'Three', 'Four', 'Eight'], answer: 2, why: 'Four sixteenth notes last one beat, because each of them is a quarter of a beat.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 3 }
    },
    {
      id: 'l5-key-signatures', title: 'Key signatures and the relative minor', minutes: 14,
      goal: 'Read the key signatures of G, D, F and B flat major, name relative minors, and spot accidentals.',
      teach: [
        'A key signature is the group of sharps or flats at the start of a piece. It tells you which notes stay sharp or flat all the way through, so each sign is written once instead of on every note. Learn them by count: one sharp is G major, two sharps is D major.',
        'Flat keys work the same way: one flat is F major and two flats is B flat major. You already know F major from level 3. Sharps and flats always arrive in the same order, so each new key signature adds just one sign to the one before it.',
        'Name what you hear. A move to the next letter name is a step (C to D), skipping one letter is a skip (C to E), and anything larger is a leap. Naming the move is faster than naming the notes, and it is how players read several notes at once.',
        'Every major key has a relative minor with the same key signature. It starts on the sixth note of the major scale, a minor third below the tonic. A minor belongs to C major, D minor to F major, B minor to D major. The last note usually tells you which key you are in.'
      ],
      tip: 'Read the key signature before the first note, every time. It takes a second and saves a wrong note in the first bar.',
      items: [
        sig('theory-d', 'Count the sharps', 'theory', { q: 'A piece starts with two sharps after the clef. Which key is it most likely to be?', options: ['G major', 'D major', 'F major', 'B flat major'], answer: 1, why: 'Two sharps, F sharp and C sharp, belong to D major.' }, { accuracy: 1 }),
        sig('theory-rel', 'Relative minor', 'theory', { q: 'Which minor key is the relative minor of C major?', options: ['E minor', 'A minor', 'D minor', 'G minor'], answer: 1, why: 'A minor uses the same key signature as C major: no sharps and no flats.' }, { accuracy: 1 }),
        sig('theory-acc', 'Accidentals', 'theory', { q: 'You are in G major and a natural sign appears before an F. Which note do you play?', options: ['F sharp', 'F flat', 'No note at all', 'F natural'], answer: 3, why: 'A natural sign cancels the sharp from the key signature, so you play F natural, and every later F in that bar too.' }, { accuracy: 1 }),
        sig('ear', 'Step or skip', 'ear', { kind: 'step-skip', rounds: 10 }, { accuracy: 0.8 }),
        sig('game', 'Read the Bass', 'notegame', { game: 'read-bass', rounds: 12 }, { accuracy: 0.75 }),
        sig('sight', 'Sight-read in D', 'sight', { range: [62, 71], hand: 'right', key: 'D', length: 2 }, { accuracy: 0.7 })
      ],
      pass: { minItemsDone: 4 }
    }
  ],
  exam: {
    id: 'l5-exam', title: 'Level 5 check-up', passPercent: 80, minTaskPercent: 65,
    items: [
      exam('technique', 'D major scale, right hand', 'scale', { tb: { type: 'scale', tonic: 2, hand: 'right' } }, { accuracy: 0.85 }),
      exam('minor', 'D harmonic minor, right hand', 'scale', { tb: { type: 'harmonic', tonic: 2, hand: 'right' } }, { accuracy: 0.85 }),
      exam('piece', 'A tune in D major', 'piece', { notes: seq(D_TUNE), tempo: 80, hand: 'right' }, { accuracy: 0.8 }),
      exam('together', 'A hymn phrase, both hands', 'piece', { tracks: { right: seq(HYMN_R), left: seq(HYMN_L) }, tempo: 66 }, { accuracy: 0.75 }),
      exam('chords', 'I-IV-V-I in C', 'chord', { tb: { type: 'cadence', tonic: 0, hand: 'both' } }, { accuracy: 0.8 }),
      exam('rhythm', 'Tap a march bar', 'rhythm', { pattern: [1, 1, 1, 1, 1, 1, 2], tempo: 96, timeSignature: '4/4' }, { accuracy: 0.8 }),
      exam('ear', 'Step or skip', 'ear', { kind: 'step-skip', rounds: 5 }, { accuracy: 0.8 }),
      exam('theory', 'Key signature', 'theory', { q: 'Which major key has a key signature of two flats?', options: ['D major', 'B flat major', 'F major', 'G major'], answer: 1, why: 'Two flats, B flat and E flat, belong to B flat major.' }, { accuracy: 1 })
    ]
  }
}
