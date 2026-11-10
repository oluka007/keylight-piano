// Level 1: First Steps. Everything here is original text; the tunes are traditional or public domain
// (Hot Cross Buns, Mary Had a Little Lamb, Au clair de la lune, Ode to Joy) written as note lists.
import { seq, itemsFor } from '../builders.js'

const FIVE_C = { 60: 1, 62: 2, 64: 3, 65: 4, 67: 5 }
const find = itemsFor('l1-find-c')
const alpha = itemsFor('l1-alphabet')
const fing = itemsFor('l1-fingers')
const five = itemsFor('l1-five-c')
const steps = itemsFor('l1-steps')
const beat = itemsFor('l1-beat')
const left = itemsFor('l1-left')
const land = itemsFor('l1-landmarks')
const exam = itemsFor('l1-exam')

const MARY = 'E4 D4 C4 D4 E4 E4 E4:2 D4 D4 D4:2 E4 G4 G4:2 E4 D4 C4 D4 E4 E4 E4 E4 D4 D4 E4 D4 C4:4'
const BUNS = 'E4 D4 C4:2 E4 D4 C4:2 C4 C4 C4 C4 D4 D4 D4 D4 E4 D4 C4:2'
const AU_CLAIR_LH = 'C3 C3 C3 D3 E3:2 D3:2 C3 E3 D3 D3 C3:4'
const ODE = 'E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4 D4 D4:2'

export const level1 = {
  id: 'level-1', number: 1, title: 'First Steps', grade: 'RCM Prep A, before ABRSM Initial', keys: 24,
  blurb: 'Sit comfortably, find your way around the keys and play your first tunes with each hand.',
  lessons: [
    {
      id: 'l1-find-c', title: 'Find middle C', minutes: 8,
      goal: 'Find every C on your keyboard using the groups of black keys.',
      teach: [
        'Look at the black keys. They come in groups: two together, then three together, then two again. The pattern repeats along the whole keyboard, so it works like a map.',
        'Find a group of two black keys. The white key just to the left of that group is C. Every group of two gives you one C. The C closest to the middle of your keyboard is called middle C.'
      ],
      tip: 'Say each note name out loud as you press it. Hearing the name while you play helps it stay in your memory.',
      diagram: { type: 'keys', range: [60, 72], highlight: [60, 72], names: true },
      items: [
        find('theory', 'Spot the C', 'theory', { q: 'Which white key is C?', options: ['Just left of a group of two black keys', 'Just left of a group of three black keys', 'The lowest key, always', 'Between two groups'], answer: 0, why: 'C sits directly to the left of every group of two black keys.' }, { accuracy: 1 }),
        find('game', 'Find the Key', 'notegame', { game: 'find-the-key', rounds: 10 }, { accuracy: 0.8 })
      ],
      pass: { minItemsDone: 2 }
    },
    {
      id: 'l1-alphabet', title: 'The musical alphabet', minutes: 8,
      goal: 'Name the white keys from C up to the next C.',
      teach: [
        'Music uses only seven letters: A B C D E F G. After G the alphabet starts again at A. Moving right on the keyboard the sound gets higher, and moving left it gets lower.',
        'Start on C and walk right along the white keys: C, D, E, F, G, A, B, then C again. D sits between the two black keys of a group of two. F sits just left of a group of three.'
      ],
      diagram: { type: 'keys', range: [60, 72], highlight: [60, 62, 64, 65, 67, 69, 71, 72], names: true },
      items: [
        alpha('theory', 'What comes after G?', 'theory', { q: 'Which letter comes right after G?', options: ['H', 'A', 'B', 'C'], answer: 1, why: 'The alphabet has only seven letters, so after G it starts again at A.' }, { accuracy: 1 }),
        alpha('theory2', 'Up or down', 'theory', { q: 'You play a key to the right of the one before. What happens to the sound?', options: ['It gets higher', 'It gets lower', 'It stays the same', 'It gets louder'], answer: 0, why: 'Keys further right sound higher; keys further left sound lower.' }, { accuracy: 1 }),
        alpha('game', 'Find the Key', 'notegame', { game: 'find-the-key', rounds: 15 }, { accuracy: 0.8 })
      ],
      pass: { minItemsDone: 2 }
    },
    {
      id: 'l1-fingers', title: 'Fingers and a relaxed hand', minutes: 8,
      goal: 'Number your fingers 1 to 5 and sit with relaxed, curved hands.',
      teach: [
        'Pianists number their fingers. The thumb is 1, then 2, 3, 4, and the little finger is 5. Both hands use the same numbers, so you always have a finger 1 to 5 on each side.',
        'Sit tall, a little forward on the seat, with your forearms level with the keys. Curve your fingers as if you were holding a small ball, and play with the tips. Keep your wrists and shoulders loose.'
      ],
      tip: 'If your hand feels tense, shake it out for a moment and start again. A relaxed hand is a fast hand.',
      diagram: { type: 'hands', hand: 'both', numbers: true },
      items: [
        fing('theory', 'Which finger?', 'theory', { q: 'Which finger is number 3?', options: ['Thumb', 'Index finger', 'Middle finger', 'Little finger'], answer: 2, why: 'Thumb is 1, index 2, middle 3, ring 4, little finger 5.' }, { accuracy: 1 }),
        fing('theory2', 'Left or right', 'theory', { q: 'In the left hand, which finger is number 1?', options: ['Thumb', 'Little finger', 'Middle finger', 'It has none'], answer: 0, why: 'The thumb is 1 in both hands.' }, { accuracy: 1 }),
        fing('first', 'Three slow notes', 'piece', { notes: seq('C4:2 D4:2 E4:2'), tempo: 60, hand: 'right' }, { accuracy: 0.8 })
      ],
      pass: { minItemsDone: 2 }
    },
    {
      id: 'l1-five-c', title: 'The five-finger C position', minutes: 10,
      goal: 'Play C D E F G with your right hand, one finger per key.',
      teach: [
        'Rest your right thumb (1) on middle C. Your fingers 2, 3, 4 and 5 fall naturally onto D, E, F and G. This is the five-finger C position, and many first pieces live inside it.',
        'Press each key with its own finger and let it come back up before the next one. Go slowly and aim for an even sound, so every note is as loud as its neighbour.'
      ],
      diagram: { type: 'keys', range: [60, 67], highlight: [60, 62, 64, 65, 67], fingers: FIVE_C },
      items: [
        five('pattern', 'Walk up and down', 'five-finger', { tb: { type: 'five', tonic: 0, hand: 'right' } }, { accuracy: 0.8 }),
        five('up-down', 'Up and back, slowly', 'piece', { notes: seq('C4 D4 E4 F4 G4 F4 E4 D4 C4:2'), tempo: 66, hand: 'right' }, { accuracy: 0.8 })
      ],
      pass: { minItemsDone: 2 }
    },
    {
      id: 'l1-steps', title: 'Steps, skips and repeats', minutes: 12,
      goal: 'Hear and play steps, skips and repeated notes, and play Mary Had a Little Lamb.',
      teach: [
        'From one note to the next you can repeat it, move to the neighbouring white key (a step), or jump over one key (a skip). Music is made of these three moves.',
        'Listen first, then play. Steps and skips have a sound you will soon recognise, and noticing them helps you read faster later, because you see shapes instead of single letters.'
      ],
      diagram: { type: 'keys', range: [60, 67], highlight: [60, 62, 64], fingers: { 60: 1, 62: 2, 64: 3 } },
      items: [
        steps('echo-steps', 'Echo: steps', 'echo', { notes: seq('C4 D4 E4 D4'), tempo: 72, hand: 'right', rounds: 4 }, { accuracy: 0.8 }),
        steps('echo-skips', 'Echo: skips', 'echo', { notes: seq('C4 E4 G4 E4'), tempo: 72, hand: 'right', rounds: 4 }, { accuracy: 0.8 }),
        steps('mary', 'Mary Had a Little Lamb', 'piece', { notes: seq(MARY), tempo: 80, hand: 'right' }, { accuracy: 0.8 })
      ],
      pass: { minItemsDone: 2 }
    },
    {
      id: 'l1-beat', title: 'A steady beat', minutes: 12,
      goal: 'Keep a steady pulse and tell quarter, half and whole notes apart.',
      teach: [
        'Music has a pulse, like a walking pace. Count it as 1 2 3 4, over and over, and keep it even. Notes are named by how many beats they last.',
        'A quarter note lasts 1 beat, a half note lasts 2 beats and a whole note lasts 4. Count the length out loud while you hold the key, and lift your finger exactly on time.'
      ],
      tip: 'Tap your foot gently. If the beat is in your body, your fingers will follow it.',
      items: [
        beat('tap-a', 'Tap: quarters and a half', 'rhythm', { pattern: [1, 1, 2], tempo: 80, timeSignature: '4/4' }, { accuracy: 0.8 }),
        beat('tap-b', 'Tap: halves and a whole', 'rhythm', { pattern: [2, 2, 4], tempo: 80, timeSignature: '4/4' }, { accuracy: 0.8 }),
        beat('theory', 'Count the beats', 'theory', { q: 'How many beats does a half note last?', options: ['1', '2', '3', '4'], answer: 1, why: 'A half note lasts two beats, half of a whole note.' }, { accuracy: 1 }),
        beat('buns', 'Hot Cross Buns', 'piece', { notes: seq(BUNS), tempo: 80, hand: 'right' }, { accuracy: 0.8 })
      ],
      pass: { minItemsDone: 3 }
    },
    {
      id: 'l1-left', title: 'The left hand and the bass clef', minutes: 12,
      goal: 'Play the five-finger position with your left hand.',
      teach: [
        'The left hand mostly plays the lower notes, written in the bass clef. Rest your little finger (5) on the C below middle C. Your fingers 4, 3, 2 and 1 then sit on D, E, F and G.',
        'Notice that finger 5 is now the lowest note and the thumb is the highest. Play slowly and keep the hand curved, just as you did on the right.'
      ],
      diagram: { type: 'keys', range: [48, 55], highlight: [48, 50, 52, 53, 55], fingers: { 48: 5, 50: 4, 52: 3, 53: 2, 55: 1 } },
      items: [
        left('pattern', 'Left-hand walk', 'five-finger', { tb: { type: 'five', tonic: 0, hand: 'left' } }, { accuracy: 0.8 }),
        left('au-clair', 'Au clair de la lune, left hand', 'piece', { notes: seq(AU_CLAIR_LH), tempo: 72, hand: 'left' }, { accuracy: 0.8 }),
        left('theory', 'Which clef?', 'theory', { q: 'Which clef usually holds the left hand\'s notes?', options: ['Treble clef', 'Bass clef', 'Neither', 'Both equally'], answer: 1, why: 'The bass clef is for lower notes, which the left hand normally plays.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 2 }
    },
    {
      id: 'l1-landmarks', title: 'Landmarks and Ode to Joy', minutes: 14,
      goal: 'Recognise middle C, treble G and bass F on the staff, then play Ode to Joy with each hand.',
      teach: [
        'Notes are written on a staff of five lines. In the treble clef, the curl of the clef circles the line for G. Middle C sits on a short line just below the staff.',
        'In the bass clef, the two dots of the clef surround the line for F. Learn these landmarks and you can find any nearby note by counting steps up or down from one of them.',
        'Now put it to work. Play the famous tune from Beethoven\'s Ninth Symphony, first with the right hand, then with the left an octave lower.'
      ],
      diagram: { type: 'staff', clef: 'grand', notes: [{ p: 60, label: 'C' }, { p: 67, label: 'G' }, { p: 53, label: 'F' }] },
      items: [
        land('theory', 'The treble landmark', 'theory', { q: 'Which note does the curl of the treble clef circle?', options: ['C', 'E', 'G', 'B'], answer: 2, why: 'The treble clef is also called the G clef: its curl circles the G line.' }, { accuracy: 1 }),
        land('game', 'Read the Treble', 'notegame', { game: 'read-treble', rounds: 10 }, { accuracy: 0.7 }),
        land('ode-r', 'Ode to Joy, right hand', 'piece', { notes: seq(ODE), tempo: 72, hand: 'right' }, { accuracy: 0.8 }),
        land('ode-l', 'Ode to Joy, left hand', 'piece', { notes: seq(ODE.replace(/4/g, '3')), tempo: 72, hand: 'left' }, { accuracy: 0.8 })
      ],
      pass: { minItemsDone: 3 }
    }
  ],
  exam: {
    id: 'l1-exam', title: 'Level 1 check-up', passPercent: 80, minTaskPercent: 65,
    items: [
      exam('technique', 'Five-finger C, right hand', 'five-finger', { tb: { type: 'five', tonic: 0, hand: 'right' } }, { accuracy: 0.8 }),
      exam('piece', 'Mary Had a Little Lamb', 'piece', { notes: seq(MARY), tempo: 80, hand: 'right' }, { accuracy: 0.8 }),
      exam('left', 'Au clair de la lune, left hand', 'piece', { notes: seq(AU_CLAIR_LH), tempo: 72, hand: 'left' }, { accuracy: 0.8 }),
      exam('rhythm', 'Tap the rhythm', 'rhythm', { pattern: [1, 1, 2, 4], tempo: 80, timeSignature: '4/4' }, { accuracy: 0.8 }),
      exam('names', 'Name the notes', 'notegame', { game: 'find-the-key', rounds: 10 }, { accuracy: 0.8 }),
      exam('theory', 'Quarter note', 'theory', { q: 'How many beats does a quarter note last?', options: ['1', '2', '3', '4'], answer: 0, why: 'A quarter note lasts one beat.' }, { accuracy: 1 })
    ]
  }
}
