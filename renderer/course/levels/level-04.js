// Level 4: Moving Around the Keys. All lesson text, quizzes and exercises are original.
// The tunes below are short original studies written for this course, kept inside a 24-key range.
import { seq, itemsFor } from '../builders.js'

const g = itemsFor('l4-g-major')
const c = itemsFor('l4-cadence')
const a = itemsFor('l4-a-minor')
const r = itemsFor('l4-root-fifth')
const e = itemsFor('l4-etude')
const x = itemsFor('l4-expression')
const m = itemsFor('l4-romantic')
const exam = itemsFor('l4-exam')

// Original harmonised tune: one chord per bar, I - IV - V - I in C, 4/4.
const TUNE_R = 'C4 E4 G4 G4 A4 A4 G4 F4 G4 B4 B4 G4 C4:2 E4 C4'
const TUNE_L = 'C3 E3 G3 E3 F3 A3 C4 A3 G3 B3 D4 B3 C3 E3 G3 E3'
// Original tune over root-and-fifth bass notes, 4/4.
const FIFTH_R = 'E4 G4 G4 E4 F4 A4 A4 F4 G4 B4 B4 G4 G4 E4 C4:2'
const FIFTH_L = 'C3:2 G3:2 F3:2 C4:2 G3:2 D4:2 C3:2 G3:2'
// Original even-finger study, five-finger C, 4/4.
const ETUDE = 'C4 D4 E4 F4 G4 F4 E4 D4 C4 E4 G4 E4 C4:4'
const ETUDE_L = 'C3 D3 E3 F3 G3 F3 E3 D3 C3 E3 G3 E3 C3:4'
// Original singing tune, 4/4.
const EXPR = 'C4 D4 E4 F4 G4:2 E4:2 F4 G4 A4 G4 E4:2 C4:2'
// Original lyrical piece with a broken-chord accompaniment, 4/4.
const LYRIC_R = 'E4 G4 A4 G4 F4 A4 G4 F4 G4 B4 A4 G4 E4:2 C4:2'
const LYRIC_L = 'C3 G3 E3 G3 F3 C4 A3 C4 G3 D4 B3 D4 C3 G3 E3 G3'
// Original sad tune in A minor, 3/4.
const AMIN = 'A3 C4 E4 D4:2 C4 B3 D4 E4 C4:2 A3'

export const level4 = {
  id: 'level-4', number: 4, title: 'Moving Around the Keys', grade: 'RCM 1, ABRSM Initial-Grade 1', keys: 24,
  blurb: 'Climb into new keys: G major and A minor, three chords that harmonise a tune, a left-hand accompaniment and your first studies.',
  lessons: [
    {
      id: 'l4-g-major', title: 'The key of G', minutes: 14,
      goal: 'Play the G major scale in each hand and know the F sharp in its key signature.',
      teach: [
        'G major starts on G and keeps the same pattern of steps as C major: whole, whole, half, whole, whole, whole, half. Starting on a new note changes where the steps fall, so one note is raised.',
        'To keep that pattern, every F becomes F sharp. The key signature of G major is a single sharp, F sharp, written at the start of the line. Play an F sharp wherever the music calls for F.',
        'In the right hand the thumb starts on G, then the pattern is 1 2 3, thumb under, then 1 2 3 4 5. The left hand climbs 5 4 3 2 1, then 3 2 1.'
      ],
      tip: 'Say "G and F sharp" before you start, so your ear expects the raised note.',
      diagram: { type: 'keys', range: [67, 79], highlight: [67, 69, 71, 72, 74, 76, 78, 79], fingers: { 67: 1, 69: 2, 71: 3, 72: 1, 74: 2, 76: 3, 78: 4, 79: 5 } },
      items: [
        g('scale-r', 'G major scale, right hand', 'scale', { tb: { type: 'scale', tonic: 7, hand: 'right' } }, { accuracy: 0.85 }),
        g('scale-l', 'G major scale, left hand', 'scale', { tb: { type: 'scale', tonic: 7, hand: 'left' } }, { accuracy: 0.85 }),
        g('echo', 'Echo in the G position', 'echo', { notes: seq('G3 A3 B3 C4 D4'), tempo: 72, hand: 'left', rounds: 4 }, { accuracy: 0.8 }),
        g('theory-sharp', 'The sharp in G', 'theory', { q: 'Which note is sharp in the key of G major?', options: ['F', 'C', 'G', 'D'], answer: 0, why: 'G major has one sharp in its key signature: F sharp.' }, { accuracy: 1 }),
        g('theory-pattern', 'Same pattern, new start', 'theory', { q: 'G major keeps the pattern of C major. What changes to hold that pattern?', options: ['F becomes F sharp', 'Every note moves up one key', 'The pattern turns minor', 'Nothing changes'], answer: 0, why: 'Raising F to F sharp keeps the whole-and-half-step pattern of the major scale.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 3 }
    },
    {
      id: 'l4-cadence', title: 'Three chords and a cadence', minutes: 15,
      goal: 'Play the chords I, IV and V, feel how V leads home, and harmonise a short tune.',
      teach: [
        'In a key the first note is the tonic, and the chord built on it is chord I. Counting up the scale, the chord on the fourth note is IV and the one on the fifth is V. Roman numerals simply name a chord by its place in the scale.',
        'Chord V feels unsettled and pulls back to chord I. That move, V to I, is called a perfect (authentic) cadence: the musical full stop at the end of a phrase.',
        'In C major the three chords are C, F and G, each played as three notes. With just these you can harmonise a great many tunes. Listen for the cadence as the bass moves from G back to C.'
      ],
      tip: 'Hold the three notes of each chord together, softly and evenly, before you add any melody on top.',
      items: [
        c('cadence-c', 'Cadence in C', 'chord', { tb: { type: 'cadence', tonic: 0, hand: 'right' } }, { accuracy: 0.8 }),
        c('cadence-g', 'Cadence in G', 'chord', { tb: { type: 'cadence', tonic: 7, hand: 'right' } }, { accuracy: 0.8 }),
        c('ear', 'Major or minor?', 'ear', { kind: 'chord', rounds: 8 }, { accuracy: 0.8 }),
        c('theory-numeral', 'Which chord leads home', 'theory', { q: 'Which chord pulls back to the tonic and makes a cadence?', options: ['Chord V', 'Chord IV', 'Chord I', 'Chord II'], answer: 0, why: 'Chord V sounds unsettled and resolves to chord I, which is a cadence.' }, { accuracy: 1 }),
        c('theory-iv', 'Chord IV in C', 'theory', { q: 'In C major, which notes make chord IV?', options: ['F A C', 'C E G', 'G B D', 'D F A'], answer: 0, why: 'Chord IV is built on the fourth note of the scale, F, using F, A and C.' }, { accuracy: 1 }),
        c('piece', 'Three chords, one tune', 'piece', { tracks: { right: seq(TUNE_R), left: seq(TUNE_L) }, tempo: 84 }, { accuracy: 0.8 })
      ],
      pass: { minItemsDone: 4 }
    },
    {
      id: 'l4-a-minor', title: 'The first minor key', minutes: 14,
      goal: 'Play the A natural minor scale and hear why a minor key sounds sad.',
      teach: [
        'Every scale so far has been major and bright. A minor scale sounds darker. The simplest one starts on A and uses only the white keys: A B C D E F G A, with no sharps or flats.',
        'C major uses the same seven white keys. The difference is the starting note. In A minor the third note, C, sits a minor third above A, and that smaller third is what gives the scale its sad colour.',
        'The right-hand fingering is the same shape you already know: 1 2 3, thumb under, then 1 2 3 4 5, beginning on A.'
      ],
      tip: 'Play the A minor scale right after the C major scale. Hearing them side by side makes the major and minor colours clear.',
      diagram: { type: 'keys', range: [57, 69], highlight: [57, 59, 60, 62, 64, 65, 67, 69], fingers: { 57: 1, 59: 2, 60: 3, 62: 1, 64: 2, 65: 3, 67: 4, 69: 5 } },
      items: [
        a('five', 'Five-finger A minor', 'piece', { notes: seq('A3 B3 C4 D4 E4 D4 C4 B3 A3:4'), tempo: 72, hand: 'right' }, { accuracy: 0.8 }),
        a('scale', 'A natural minor scale', 'scale', { tb: { type: 'minor', tonic: 9, hand: 'right' } }, { accuracy: 0.85 }),
        a('piece', 'A tune in A minor', 'piece', { notes: seq(AMIN), tempo: 80, hand: 'right', timeSignature: '3/4' }, { accuracy: 0.8 }),
        a('ear', 'Major or minor', 'ear', { kind: 'chord', rounds: 8 }, { accuracy: 0.8 }),
        a('theory', 'Why minor sounds sad', 'theory', { q: 'A minor uses the same white keys as C major. What makes it minor?', options: ['It starts on A, so its third is a minor third', 'It uses black keys', 'It is played faster', 'It has no tonic'], answer: 0, why: 'Starting on A puts C a minor third above the tonic, and that lowered third gives the minor sound.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 3 }
    },
    {
      id: 'l4-root-fifth', title: 'A left-hand accompaniment', minutes: 14,
      goal: 'Play root-and-fifth bass notes under a melody and keep them soft and steady.',
      teach: [
        'An accompaniment should not compete with the tune. The left hand can play just two notes per chord, the root and the fifth. These sound open and steady and leave room for the melody.',
        'The fifth is the fifth note counting up from the root, with the root as one: C D E F G, so the fifth above C is G. Over F the pair is F and C; over G it is G and D. Play them low and even, and the tune sits comfortably on top.',
        'Keep the left hand softer than the right. The bass supports and the melody leads.'
      ],
      tip: 'Play the bass line alone first, counting its two long notes in every bar, then add the melody.',
      items: [
        r('lh', 'Left-hand five-finger walk', 'five-finger', { tb: { type: 'five', tonic: 0, hand: 'left' } }, { accuracy: 0.8 }),
        r('piece', 'Tune over root and fifth', 'piece', { tracks: { right: seq(FIFTH_R), left: seq(FIFTH_L) }, tempo: 80 }, { accuracy: 0.8 }),
        r('theory', 'The fifth above C', 'theory', { q: 'Which note is a fifth above C?', options: ['G', 'E', 'F', 'A'], answer: 0, why: 'Counting five scale steps from C gives C, D, E, F, G, so the fifth is G.' }, { accuracy: 1 }),
        r('theory2', 'Which hand accompanies', 'theory', { q: 'Which hand usually plays the root-and-fifth accompaniment?', options: ['The left hand', 'The right hand', 'Both equally', 'Neither'], answer: 0, why: 'The left hand plays the bass accompaniment underneath the right-hand melody.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 3 }
    },
    {
      id: 'l4-etude', title: 'A first etude', minutes: 15,
      goal: 'Play an even five-finger study and keep a steady tempo from the first note to the last.',
      teach: [
        'An etude is a short study that trains one skill. This one trains even fingers and a steady pulse. The notes are kept simple on purpose, so you can give all your attention to the sound.',
        'Aim for equal loudness and equal spacing. A common habit is to rush the easy notes and slow down at the harder ones. The steady beat of the app helps you hear this and correct it.',
        'Play slowly at first, and speed up only when every note is even.'
      ],
      tip: 'Count out loud as you play. If your voice and your fingers stay together, the tempo is steady.',
      items: [
        e('rh', 'Even fingers, right hand', 'piece', { notes: seq(ETUDE), tempo: 72, hand: 'right' }, { accuracy: 0.8 }),
        e('both', 'Even fingers, both hands', 'piece', { tracks: { right: seq(ETUDE), left: seq(ETUDE_L) }, tempo: 66 }, { accuracy: 0.75 }),
        e('rhythm', 'Tap steady eighths', 'rhythm', { pattern: [0.5, 0.5, 0.5, 0.5, 1, 1, 0.5, 0.5, 0.5, 0.5, 1, 1], tempo: 72, timeSignature: '4/4' }, { accuracy: 0.8 }),
        e('theory', 'Purpose of an etude', 'theory', { q: 'What is an etude for?', options: ['Training one skill with simple notes', 'Being a concert showpiece', 'Making you play as fast as possible', 'Avoiding the beat'], answer: 0, why: 'An etude concentrates on one technical skill, so its notes are kept simple.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 3 }
    },
    {
      id: 'l4-expression', title: 'Louder, softer, slower', minutes: 12,
      goal: 'Shape a tune with a crescendo and a diminuendo, and slow the ending with a ritardando.',
      teach: [
        'Music can grow louder or softer as it goes. A crescendo means gradually louder and a diminuendo means gradually softer. They are drawn as long hairpins that open or close across the notes.',
        'A ritardando means gradually slower. Players often use one at the end of a piece to let the last phrase settle.',
        'Make these changes smooth. Move the sound a little at a time over several notes, and let a slowing spread across a whole phrase rather than the last note alone.',
        'Tempo words set the speed. Allegro means fast, and andante means a walking pace. They stand above the first bar and tell you the character before you play a note.'
      ],
      items: [
        x('echo', 'Echo a rising phrase', 'echo', { notes: seq('C4 D4 E4 F4 G4'), tempo: 72, hand: 'right', rounds: 3 }, { accuracy: 0.8 }),
        x('piece', 'A tune to shape', 'piece', { notes: seq(EXPR), tempo: 76, hand: 'right' }, { accuracy: 0.8 }),
        x('theory-cresc', 'Crescendo', 'theory', { q: 'What does crescendo mean?', options: ['Gradually louder', 'Gradually softer', 'Gradually faster', 'Suddenly quiet'], answer: 0, why: 'A crescendo is a smooth, gradual increase in loudness.' }, { accuracy: 1 }),
        x('theory-rit', 'Ritardando', 'theory', { q: 'What does ritardando mean?', options: ['Gradually slower', 'Gradually faster', 'Louder', 'Silent'], answer: 0, why: 'A ritardando is a gradual slowing, often used to settle the end of a piece.' }, { accuracy: 1 }),
        x('theory-tempo', 'Tempo words', 'theory', { q: 'What does andante mean?', options: ['At a walking pace', 'Very fast', 'Very soft', 'Without rhythm'], answer: 0, why: 'Andante means at a walking pace, while allegro means fast.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 3 }
    },
    {
      id: 'l4-romantic', title: 'A song-like study', minutes: 16,
      goal: 'Shape a lyrical piece with a singing right hand over a flowing left-hand accompaniment.',
      teach: [
        'In the nineteenth century, composers wrote short expressive pieces for playing at home. They are warm and song-like and are often called character pieces. This study borrows that singing style.',
        'This piece moves at a walking pace. The right hand carries a smooth melody while the left hand ripples with broken-chord notes, low and high, on every beat.',
        'Keep the left hand even and soft, and let the melody rise and fall. Leaning slightly on the first note of each phrase gives it a singing shape.'
      ],
      tip: 'Sing the melody in your head as you play it. A melody you can sing is a melody you can shape.',
      items: [
        m('melody', 'A lyrical piece, right hand', 'piece', { notes: seq(LYRIC_R), tempo: 72, hand: 'right' }, { accuracy: 0.8 }),
        m('both', 'A lyrical piece, both hands', 'piece', { tracks: { right: seq(LYRIC_R), left: seq(LYRIC_L) }, tempo: 72 }, { accuracy: 0.8 }),
        m('echo', 'Echo a lyrical phrase', 'echo', { notes: seq('E4 G4 A4 G4'), tempo: 72, hand: 'right', rounds: 3 }, { accuracy: 0.8 }),
        m('theory', 'What is a character piece', 'theory', { q: 'What is a character piece?', options: ['A short expressive piece written for the home', 'A long symphony', 'A pure finger-speed study', 'A three-beat dance'], answer: 0, why: 'Character pieces are short, expressive works, often written for playing at home.' }, { accuracy: 1 }),
        m('theory2', 'The left hand', 'theory', { q: 'What does the left hand do in this piece?', options: ['A flowing broken chord under the tune', 'Plays the melody', 'Holds one note the whole time', 'Stays silent'], answer: 0, why: 'The left hand ripples with broken-chord notes while the right hand sings the melody.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 3 }
    }
  ],
  exam: {
    id: 'l4-exam', title: 'Level 4 check-up', passPercent: 80, minTaskPercent: 65,
    items: [
      exam('scale', 'G major scale, right hand', 'scale', { tb: { type: 'scale', tonic: 7, hand: 'right' } }, { accuracy: 0.85 }),
      exam('cadence', 'Cadence in C', 'chord', { tb: { type: 'cadence', tonic: 0, hand: 'right' } }, { accuracy: 0.8 }),
      exam('piece', 'Three chords, one tune', 'piece', { tracks: { right: seq(TUNE_R), left: seq(TUNE_L) }, tempo: 84 }, { accuracy: 0.8 }),
      exam('minor', 'A natural minor scale', 'scale', { tb: { type: 'minor', tonic: 9, hand: 'right' } }, { accuracy: 0.85 }),
      exam('sight', 'Sight-reading in G', 'sight', { range: [55, 71], hand: 'right', key: 'G', length: 4 }, { accuracy: 0.7 }),
      exam('ear', 'Major or minor', 'ear', { kind: 'chord', rounds: 5 }, { accuracy: 0.8 }),
      exam('rhythm', 'Tap a dotted rhythm', 'rhythm', { pattern: [1.5, 0.5, 1, 1, 1.5, 0.5, 2], tempo: 84, timeSignature: '4/4' }, { accuracy: 0.8 }),
      exam('theory', 'The tonic chord', 'theory', { q: 'In C major, which notes make the tonic chord, chord I?', options: ['C E G', 'F A C', 'G B D', 'A C E'], answer: 0, why: 'Chord I is built on the tonic C, using C, E and G.' }, { accuracy: 1 })
    ]
  }
}
