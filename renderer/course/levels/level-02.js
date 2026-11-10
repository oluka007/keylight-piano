// Level 2: Reading & Rhythm. Original text; tunes are traditional (Hot Cross Buns, Au clair de la lune)
// or the exercises are our own, all written as note lists.
import { seq, itemsFor } from '../builders.js'

const tre = itemsFor('l2-treble')
const bas = itemsFor('l2-bass')
const rst = itemsFor('l2-rests')
const tim = itemsFor('l2-time')
const eig = itemsFor('l2-eighths')
const gpo = itemsFor('l2-g-position')
const exp = itemsFor('l2-expression')
const tog = itemsFor('l2-together')
const exam = itemsFor('l2-exam')

// Real rhythm: the four C's and four D's are eighth notes.
const BUNS = 'E4 D4 C4:2 E4 D4 C4:2 C4:0.5 C4:0.5 C4:0.5 C4:0.5 D4:0.5 D4:0.5 D4:0.5 D4:0.5 E4 D4 C4:2'
const AU_CLAIR_G = 'G4 G4 G4 A4 B4:2 A4:2 G4 B4 A4 A4 G4:4'
const REST_SONG = 'C4 E4 G4 r E4 F4 G4 r G4 E4 C4:2'

export const level2 = {
  id: 'level-2', number: 2, title: 'Reading & Rhythm', grade: 'RCM Prep B, ABRSM Initial', keys: 24,
  blurb: 'Read notes on both staves, count rests and eighth notes, and play with both hands together.',
  lessons: [
    {
      id: 'l2-treble', title: 'Reading the treble staff', minutes: 12,
      goal: 'Read notes from middle C to G by moving up and down from a landmark.',
      teach: [
        'Each note sits on a line or in a space. Going up the staff, lines and spaces alternate, and every step to the next line or space is one step up the keyboard\'s white keys.',
        'Start from a landmark. Middle C is just below the staff, and G is on the second line. A note one space above G is A, and one line above that is B. Read the neighbours, not each note from scratch.'
      ],
      diagram: { type: 'staff', clef: 'treble', notes: [{ p: 60, label: 'C' }, { p: 62, label: 'D' }, { p: 64, label: 'E' }, { p: 65, label: 'F' }, { p: 67, label: 'G' }] },
      items: [
        tre('theory', 'Reading by landmark', 'theory', { q: 'A note sits one space above the G line. Which note is it?', options: ['F', 'A', 'B', 'E'], answer: 1, why: 'Moving up from G to the next space gives the next letter, A.' }, { accuracy: 1 }),
        tre('game', 'Read the Treble', 'notegame', { game: 'read-treble', rounds: 15 }, { accuracy: 0.75 }),
        tre('sight', 'First sight-reading', 'sight', { range: [60, 67], hand: 'right', key: 'C', length: 1 }, { accuracy: 0.7 })
      ],
      pass: { minItemsDone: 2 }
    },
    {
      id: 'l2-bass', title: 'Reading the bass staff', minutes: 12,
      goal: 'Read notes from the C below middle C up to G in the bass clef.',
      teach: [
        'The bass staff works the same way, but its lines carry different letters. The landmark is F, on the line between the two dots of the clef. Middle C sits on a short line above the staff.',
        'The notes of your left-hand position, C D E F G, climb from the second space to the top space of the staff. Find F first, then count steps away from it.'
      ],
      diagram: { type: 'staff', clef: 'bass', notes: [{ p: 48, label: 'C' }, { p: 50, label: 'D' }, { p: 52, label: 'E' }, { p: 53, label: 'F' }, { p: 55, label: 'G' }] },
      items: [
        bas('theory', 'The bass landmark', 'theory', { q: 'Which line do the two dots of the bass clef surround?', options: ['C', 'F', 'G', 'A'], answer: 1, why: 'The bass clef is the F clef: its dots hug the F line.' }, { accuracy: 1 }),
        bas('game', 'Read the Bass', 'notegame', { game: 'read-bass', rounds: 15 }, { accuracy: 0.75 }),
        bas('sight', 'Left-hand sight-reading', 'sight', { range: [48, 55], hand: 'left', key: 'C', length: 1 }, { accuracy: 0.7 })
      ],
      pass: { minItemsDone: 2 }
    },
    {
      id: 'l2-rests', title: 'Rests: silence that counts', minutes: 10,
      goal: 'Count and play rests, and keep the beat through them.',
      teach: [
        'A rest is a silence of a set length, and it still counts. The pulse never stops, even when your fingers do. A quarter rest lasts 1 beat, a half rest lasts 2 beats and a whole rest fills any whole bar.',
        'Count through the rests out loud: "1, 2, 3, (4)", saying the rest\'s beat softly. Lift your hand off the keys quietly, wait, then play exactly on the next beat.'
      ],
      tip: 'Silence is part of the music. Players who rush usually rush through their rests.',
      items: [
        rst('tap-a', 'Tap with a rest', 'rhythm', { pattern: [1, 1, 1, -1], tempo: 80, timeSignature: '4/4' }, { accuracy: 0.8 }),
        rst('tap-b', 'Tap with a long rest', 'rhythm', { pattern: [2, -2, 1, 1, 2], tempo: 80, timeSignature: '4/4' }, { accuracy: 0.8 }),
        rst('theory', 'Count the rest', 'theory', { q: 'You see a half rest in 4/4. How many beats of silence is that?', options: ['1', '2', '3', '4'], answer: 1, why: 'A half rest is as long as a half note: two beats.' }, { accuracy: 1 }),
        rst('song', 'Echo with gaps', 'piece', { notes: seq(REST_SONG), tempo: 80, hand: 'right' }, { accuracy: 0.8 })
      ],
      pass: { minItemsDone: 3 }
    },
    {
      id: 'l2-time', title: 'Bars and time signatures', minutes: 12,
      goal: 'Tell 4/4 from 3/4 and play a dotted half note.',
      teach: [
        'Bar lines cut the music into equal groups of beats. The two numbers at the start, the time signature, tell you how: the top number is beats in a bar, and the bottom number says which note counts as one beat.',
        'In 4/4 you count 1 2 3 4. In 3/4 you count 1 2 3, like a waltz. A half note with a dot after it lasts three beats, which fills a whole 3/4 bar.'
      ],
      items: [
        tim('tap-a', 'Tap in 3/4', 'rhythm', { pattern: [1, 1, 1, 3], tempo: 84, timeSignature: '3/4' }, { accuracy: 0.8 }),
        tim('tap-b', 'Tap a waltz', 'rhythm', { pattern: [3, 1, 1, 1, 3], tempo: 84, timeSignature: '3/4' }, { accuracy: 0.8 }),
        tim('theory', 'Top number', 'theory', { q: 'In the time signature 3/4, what does the top number 3 tell you?', options: ['Three beats in each bar', 'Three bars in the piece', 'Play three times', 'Play at speed three'], answer: 0, why: 'The top number is the number of beats in each bar.' }, { accuracy: 1 }),
        tim('walk', 'A three-beat walk', 'piece', { notes: seq('C4:3 E4 E4 E4 G4:3 E4 E4 E4 C4:3'), tempo: 84, hand: 'right', timeSignature: '3/4' }, { accuracy: 0.8 })
      ],
      pass: { minItemsDone: 3 }
    },
    {
      id: 'l2-eighths', title: 'Eighth notes', minutes: 12,
      goal: 'Play two notes in one beat and tap the rhythm "one-and".',
      teach: [
        'An eighth note lasts half a beat, so two of them fit in a single beat. Count them as "1 and 2 and 3 and 4 and", saying the numbers on the beat and "and" in between.',
        'Hot Cross Buns uses them for "one a penny, two a penny": four quick C notes, then four quick D notes. Keep the beat steady underneath and make the quick notes even.'
      ],
      items: [
        eig('tap-a', 'Tap eighths', 'rhythm', { pattern: [0.5, 0.5, 1, 0.5, 0.5, 1], tempo: 72, timeSignature: '4/4' }, { accuracy: 0.8 }),
        eig('tap-b', 'Tap a mixed bar', 'rhythm', { pattern: [1, 0.5, 0.5, 0.5, 0.5, 1], tempo: 72, timeSignature: '4/4' }, { accuracy: 0.8 }),
        eig('theory', 'How many?', 'theory', { q: 'How many eighth notes fit into one half note?', options: ['2', '3', '4', '8'], answer: 2, why: 'A half note lasts 2 beats, and each beat holds 2 eighth notes: 4 in total.' }, { accuracy: 1 }),
        eig('buns', 'Hot Cross Buns, real rhythm', 'piece', { notes: seq(BUNS), tempo: 76, hand: 'right' }, { accuracy: 0.8 })
      ],
      pass: { minItemsDone: 3 }
    },
    {
      id: 'l2-g-position', title: 'The G position', minutes: 12,
      goal: 'Move your hand to a new five-finger position on G and play a tune you already know.',
      teach: [
        'A position is where your five fingers rest. Move your right thumb to G and your fingers fall on A, B, C and D. The shape of the hand is identical, only the keys under it have changed.',
        'Au clair de la lune, which you played in the left hand, fits this position and uses only G, A and B. Look at the first note, move your hand there, and read from that anchor. The tune sounds the same, only higher.'
      ],
      diagram: { type: 'keys', range: [67, 74], highlight: [67, 69, 71, 72, 74], fingers: { 67: 1, 69: 2, 71: 3, 72: 4, 74: 5 } },
      items: [
        gpo('pattern', 'Five-finger G', 'five-finger', { tb: { type: 'five', tonic: 7, hand: 'right' } }, { accuracy: 0.8 }),
        gpo('au-clair', 'Au clair de la lune in G', 'piece', { notes: seq(AU_CLAIR_G), tempo: 76, hand: 'right' }, { accuracy: 0.8 }),
        gpo('theory', 'Same shape, new keys', 'theory', { q: 'You move from the C position to the G position. What stays the same?', options: ['The keys under each finger', 'The shape of your hand', 'The note names', 'Nothing'], answer: 1, why: 'Only the starting key changes. Your hand keeps the same relaxed five-finger shape.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 2 }
    },
    {
      id: 'l2-expression', title: 'Smooth, short and soft', minutes: 10,
      goal: 'Know legato, staccato and the dynamic marks p and f, and use them in a tune.',
      teach: [
        'Notes can be joined or separated. Legato means smooth and connected: move to the next key just as you leave the last one. Staccato means short and detached, shown by a dot above or below the note.',
        'Dynamics tell you how loud to play. The letter p means soft, and f means loud. Try the echo below twice: once legato and soft, once short and loud, and hear how the mood changes.'
      ],
      items: [
        exp('theory', 'Legato', 'theory', { q: 'What does legato mean?', options: ['Short and detached', 'Smooth and connected', 'Very loud', 'Very fast'], answer: 1, why: 'Legato notes are joined with no gap between them.' }, { accuracy: 1 }),
        exp('theory2', 'Soft or loud', 'theory', { q: 'You see the letter p under a note. How should you play it?', options: ['Loud', 'Soft', 'Fast', 'Slow'], answer: 1, why: 'p stands for piano, the Italian word for soft.' }, { accuracy: 1 }),
        exp('echo', 'Echo, smooth', 'echo', { notes: seq('C4 D4 E4 F4 G4 F4 E4 D4'), tempo: 72, hand: 'right', rounds: 3 }, { accuracy: 0.8 })
      ],
      pass: { minItemsDone: 2 }
    },
    {
      id: 'l2-together', title: 'Both hands together', minutes: 14,
      goal: 'Play with both hands at the same moment, then add a held note in the left hand.',
      teach: [
        'Playing with two hands means two jobs at once. Start with the easiest case: both hands play the same notes, one octave apart, moving in the same direction. Watch the fingers: when the right hand uses 1 2 3, the left hand uses 5 4 3.',
        'Next, let the right hand play the tune while the left hand holds a long note. Listen to the left hand as much as the right: both must start together and stay in time.'
      ],
      tip: 'If one hand wanders, slow right down, or play each hand alone once more before putting them together.',
      items: [
        tog('walk', 'Five-finger C, both hands', 'five-finger', { tb: { type: 'five', tonic: 0, hand: 'both' } }, { accuracy: 0.75 }),
        tog('octaves', 'Two hands, one pulse', 'piece', { tracks: { right: seq('C4:2 D4:2 E4:4 E4:2 D4:2 C4:4'), left: seq('C3:2 D3:2 E3:4 E3:2 D3:2 C3:4') }, tempo: 66 }, { accuracy: 0.8 }),
        tog('held', 'Tune over a held note', 'piece', { tracks: { right: seq('E4 E4 F4 G4 G4 F4 E4 D4'), left: seq('C3:4 G3:4') }, tempo: 66 }, { accuracy: 0.8 })
      ],
      pass: { minItemsDone: 2 }
    }
  ],
  exam: {
    id: 'l2-exam', title: 'Level 2 check-up', passPercent: 80, minTaskPercent: 65,
    items: [
      exam('technique', 'Five-finger G, right hand', 'five-finger', { tb: { type: 'five', tonic: 7, hand: 'right' } }, { accuracy: 0.8 }),
      exam('piece', 'Hot Cross Buns', 'piece', { notes: seq(BUNS), tempo: 76, hand: 'right' }, { accuracy: 0.8 }),
      exam('together', 'Two hands, one pulse', 'piece', { tracks: { right: seq('C4:2 D4:2 E4:4 E4:2 D4:2 C4:4'), left: seq('C3:2 D3:2 E3:4 E3:2 D3:2 C3:4') }, tempo: 66 }, { accuracy: 0.8 }),
      exam('rhythm', 'Tap with rests', 'rhythm', { pattern: [1, 0.5, 0.5, -1, 1, 2, -2], tempo: 76, timeSignature: '4/4' }, { accuracy: 0.8 }),
      exam('treble', 'Read the Treble', 'notegame', { game: 'read-treble', rounds: 10 }, { accuracy: 0.8 }),
      exam('bass', 'Read the Bass', 'notegame', { game: 'read-bass', rounds: 10 }, { accuracy: 0.8 }),
      exam('theory', 'Time signature', 'theory', { q: 'Which time signature has three beats in every bar?', options: ['2/4', '3/4', '4/4', '6/4'], answer: 1, why: 'The top number gives the beats in each bar, so 3/4 has three.' }, { accuracy: 1 })
    ]
  }
}
