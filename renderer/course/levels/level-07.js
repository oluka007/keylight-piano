// Level 7: Early Intermediate. Every lesson text, quiz and exercise in this file is original,
// written for this course. Every inline piece is a short study written as a note list or as two
// note lists (right and left hand), and every one keeps its bars in time. No third-party scores,
// editions, arrangements or melodies are used or quoted. This level assumes a 49-key keyboard.
import { seq, itemsFor } from '../builders.js'

const d7 = itemsFor('l7-dominant-seventh')
const chr = itemsFor('l7-chromatic')
const cmp = itemsFor('l7-compound-time')
const etd = itemsFor('l7-etude')
const son = itemsFor('l7-sonatina-exposition')
const andante = itemsFor('l7-sonatina-andante')
const ron = itemsFor('l7-rondo')
const rom = itemsFor('l7-romantic')
const exam = itemsFor('l7-exam')

// Original studies written for this level.
// G7 spelled out, then resolving to C; and D7 spelled out, then resolving to G.
const G7_C = 'G3 B3 D4 F4 E4:2 C4:2'
const D7_G = 'D3 F#3 A3 C4 B3:2 G3:2'
// The chromatic scale, right hand up and down, four bars of 4/4.
const CHROM_R = 'C4:0.5 C#4:0.5 D4:0.5 D#4:0.5 E4:0.5 F4:0.5 F#4:0.5 G4:0.5 ' +
  'G#4:0.5 A4:0.5 A#4:0.5 B4:0.5 C5:1 r:1 ' +
  'C5:0.5 B4:0.5 A#4:0.5 A4:0.5 G#4:0.5 G4:0.5 F#4:0.5 F4:0.5 E4:0.5 D#4:0.5 D4:0.5 C#4:0.5 C4:2'
// The chromatic scale, left hand, two bars of 4/4.
const CHROM_L = 'C3:0.5 C#3:0.5 D3:0.5 D#3:0.5 E3:0.5 F3:0.5 F#3:0.5 G3:0.5 G#3:0.5 A3:0.5 A#3:0.5 B3:0.5 C4:2'
// Original flowing study in 6/8, four bars, both hands.
const SIX_R = 'E4:1.5 D4:0.5 C4:0.5 D4:0.5 E4:1.5 G4:0.5 E4:0.5 C4:0.5 F4:1.5 A4:0.5 C5:0.5 A4:0.5 G4:0.5 A4:0.5 G4:0.5 E4:0.5 C4:1'
const SIX_L = 'C3:1.5 G3:1.5 C3:1.5 G3:1.5 F3:1.5 C4:1.5 G3:1.5 C3:1.5'
// Original even-finger study, eight bars of 4/4, a pattern moved up the five-finger position.
const ETUDE_R = 'C4:0.5 D4:0.5 E4:0.5 F4:0.5 G4:0.5 F4:0.5 E4:0.5 D4:0.5 ' +
  'D4:0.5 E4:0.5 F4:0.5 G4:0.5 A4:0.5 G4:0.5 F4:0.5 E4:0.5 ' +
  'E4:0.5 F4:0.5 G4:0.5 A4:0.5 B4:0.5 A4:0.5 G4:0.5 F4:0.5 ' +
  'F4:0.5 G4:0.5 A4:0.5 B4:0.5 C5:0.5 B4:0.5 A4:0.5 G4:0.5 ' +
  'G4:1 B4:1 A4:1 G4:1 F4:1 A4:1 G4:1 F4:1 E4:1 G4:1 F4:1 E4:1 D4:0.5 C4:0.5 D4:0.5 E4:0.5 C4:2'
const ETUDE_L = 'C3:2 G3:2 D3:2 A3:2 E3:2 B3:2 F3:2 C4:2 G3:2 B3:2 F3:2 A3:2 E3:2 G3:2 C3:2 G3:2'
// Original exposition-style study: a first idea in C, then a second idea that moves to G and closes.
const EXP_R = 'E4:1 D4:1 C4:2 D4:1 E4:1 F4:2 G4:1 E4:1 C4:2 D4:1 E4:1 D4:2 ' +
  'F#4:1 G4:1 A4:2 B4:1 A4:1 G4:2 A4:1 B4:1 A4:1 G4:1 F#4:1 G4:3'
const EXP_L = 'C3:2 G3:2 C3:2 G3:2 C3:2 G3:2 G3:2 B3:2 D3:2 A3:2 G3:2 B3:2 D3:2 G3:2 D3:1 G3:3'
// Original song-like middle movement in F major, eight bars of 3/4, cantabile.
const AND_R = 'A4:1 G4:1 F4:1 G4:2 A4:1 Bb4:2 A4:1 G4:3 A4:1 Bb4:1 C5:1 D5:2 C5:1 Bb4:2 A4:1 F4:3'
const AND_L = 'F3:2 C4:1 C3:2 G3:1 Bb3:2 F3:1 C3:2 G3:1 F3:2 A3:1 Bb3:2 D4:1 C3:3 F3:3'
// Original rondo refrain (8 bars of 2/4) and an episode that moves to the dominant.
const RONDO_R = 'C4:0.5 E4:0.5 G4:1 E4:0.5 C4:0.5 E4:1 D4:0.5 F4:0.5 A4:1 F4:0.5 D4:0.5 F4:1 ' +
  'C4:0.5 E4:0.5 G4:0.5 E4:0.5 D4:0.5 F4:0.5 B4:0.5 G4:0.5 C4:0.5 E4:0.5 G4:0.5 C5:0.5 G4:0.5 E4:0.5 C4:1'
const EPISODE_R = 'D4:0.5 F#4:0.5 G4:1 A4:0.5 G4:0.5 F#4:1 G4:0.5 B4:0.5 D5:1 B4:0.5 G4:0.5 D4:1'
const RONDO_L = 'C3 G3 C3 G3 F3 C4 G3 B3 C3 G3 G3 B3 C3 G3 C3 G3'
// Original lyrical study in A minor, eight bars of 4/4, a singing line over broken chords.
const LYRIC_R = 'E4:1 A4:1 C5:1 B4:1 A4:2 G4:2 F4:1 A4:1 D5:1 C5:1 B4:2 A4:2 ' +
  'E4:1 A4:1 C5:1 E5:1 D5:2 C5:2 B4:1 A4:1 G4:1 A4:1 B4:1 A4:3'
const LYRIC_L = 'A2:0.5 E3:0.5 A3:0.5 C4:0.5 A3:0.5 E3:0.5 A3:0.5 E3:0.5 ' +
  'A2:0.5 E3:0.5 A3:0.5 C4:0.5 A3:0.5 E3:0.5 A3:0.5 E3:0.5 ' +
  'D3:0.5 A3:0.5 D4:0.5 F4:0.5 D4:0.5 A3:0.5 D4:0.5 A3:0.5 ' +
  'E3:0.5 B3:0.5 E4:0.5 G#4:0.5 A2:0.5 E3:0.5 A3:0.5 C4:0.5 ' +
  'A2:0.5 E3:0.5 A3:0.5 C4:0.5 A3:0.5 E3:0.5 A3:0.5 E3:0.5 ' +
  'F3:0.5 C4:0.5 F4:0.5 A4:0.5 F4:0.5 C4:0.5 F4:0.5 C4:0.5 ' +
  'E3:0.5 B3:0.5 E4:0.5 B3:0.5 E4:0.5 B3:0.5 E3:0.5 B3:0.5 ' +
  'A2:0.5 E3:0.5 A3:0.5 C4:0.5 A3:0.5 E3:0.5 A3:0.5 E3:0.5'

export const level7 = {
  id: 'level-7', number: 7, title: 'Early Intermediate', grade: 'RCM 5, ABRSM Grade 4-5', keys: 49,
  blurb: 'On a 49-key keyboard: dominant seventh chords, the chromatic scale, compound time, and Classical forms from a sonatina exposition to a rondo.',
  lessons: [
    {
      id: 'l7-dominant-seventh', title: 'The dominant seventh', minutes: 16,
      goal: 'Build the dominant seventh chord on the fifth step, play it in a broken pattern, and hear it lean back to the tonic.',
      teach: [
        'The chord on the fifth step of a key is the dominant, written V. Adding one more note on top of it makes a dominant seventh, written V7. In C major the fifth step is G, so the chord is G B D F and is called G7.',
        'Two notes inside it do the work. The third, B, is the leading tone and wants to rise to C. The seventh, F, wants to fall to E. The pull between B and F, which is a tritone, is what makes V7 lean so strongly to chord I.',
        'G7 belongs to C major, and D7, which is D F sharp A C, belongs to G major. Play the four notes slowly, one at a time at first, and let the seventh fall as the leading tone rises.'
      ],
      tip: 'Hold the four notes of the chord together once, then let them go into the home chord. Hearing the seventh step down is the whole point.',
      diagram: { type: 'keys', range: [55, 65], highlight: [55, 59, 62, 65], fingers: { 55: 1, 59: 2, 62: 3, 65: 4 } },
      items: [
        d7('cadence', 'The chords I IV V I in C', 'chord', { tb: { type: 'cadence', tonic: 0, hand: 'right' } }, { accuracy: 0.8 }),
        d7('g7', 'G7 broken, resolving to C', 'piece', { notes: seq(G7_C), tempo: 76, hand: 'right' }, { accuracy: 0.8 }),
        d7('d7', 'D7 broken, resolving to G', 'piece', { notes: seq(D7_G), tempo: 76, hand: 'right' }, { accuracy: 0.8 }),
        d7('theory-notes', 'Spelling the dominant seventh', 'theory', { q: 'In C major, which four notes make the dominant seventh, G7?', options: ['G B D F', 'G B D E', 'G C E G', 'G A C E'], answer: 0, why: 'G7 stacks the dominant triad G B D with the seventh note F on top.' }, { accuracy: 1 }),
        d7('theory-bass', 'First inversion', 'theory', { q: 'Which note is in the bass when G7 is played in its first inversion?', options: ['B', 'G', 'D', 'F'], answer: 0, why: 'First inversion puts the third in the bass, so the notes run B D F G from the bottom.' }, { accuracy: 1 }),
        d7('theory-resolve', 'Where the notes go', 'theory', { q: 'In a V7 to I cadence, how do the leading tone and the seventh move?', options: ['The leading tone rises and the seventh falls', 'Both rise', 'Both stay still', 'The seventh rises and the leading tone falls'], answer: 0, why: 'The leading tone steps up to the tonic and the seventh steps down, which is what makes the cadence feel settled.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 4 }
    },
    {
      id: 'l7-chromatic', title: 'The chromatic scale', minutes: 14,
      goal: 'Play one octave of the chromatic scale up and down in an even line, with one calm fingering.',
      teach: [
        'The chromatic scale uses every note, black and white, all in half steps. From C up to the next C you play twelve notes: C C sharp D D sharp E F F sharp G G sharp A A sharp B C. Each step is the smallest one the keyboard has.',
        'Use one easy fingering. The thumb plays the white keys and the third finger each black key. Where two white keys sit together, use 1 and 2: right hand going up, E 1 then F 2, B 1 then C 2; left hand going up, E 2 then F 1, B 2 then C 1.',
        'Every black key has two names. The key between C and D is C sharp if you raise C, or D flat if you lower D; it is the same key either way. Play the line evenly, with no accent on any note.'
      ],
      tip: 'Keep the hand close to the black keys and let it glide along with the thumb.',
      items: [
        chr('updown', 'Chromatic scale up and back', 'piece', { notes: seq(CHROM_R), tempo: 72, hand: 'right' }, { accuracy: 0.85 }),
        chr('left', 'Chromatic line, left hand', 'piece', { notes: seq(CHROM_L), tempo: 72, hand: 'left' }, { accuracy: 0.8 }),
        chr('theory-count', 'Counting half steps', 'theory', { q: 'How many half steps are there between one C and the C an octave above?', options: ['Twelve', 'Seven', 'Eight', 'Five'], answer: 0, why: 'The chromatic scale moves in half steps, and there are twelve half steps in an octave.' }, { accuracy: 1 }),
        chr('theory-names', 'Two names, one key', 'theory', { q: 'What are the two names for the black key between C and D?', options: ['C sharp and D flat', 'B sharp and C flat', 'D sharp and E flat', 'C flat and C sharp'], answer: 0, why: 'The same black key can be written as C sharp (C raised by a half step) or D flat (D lowered by a half step).' }, { accuracy: 1 }),
        chr('sight', 'Sight-read in C', 'sight', { range: [60, 72], hand: 'right', key: 'C', length: 2 }, { accuracy: 0.7 })
      ],
      pass: { minItemsDone: 3 }
    },
    {
      id: 'l7-compound-time', title: '6/8 and compound time', minutes: 14,
      goal: 'Feel two main beats in a 6/8 bar, count them as two groups of three, and tell 6/8 from 3/4 by ear and eye.',
      teach: [
        '6/8 means six eighth notes in a bar. They group into two lots of three, so the bar has two main beats, each one a dotted quarter long. Because each main beat divides into three, 6/8 is called a compound metre.',
        '3/4 also adds up to six eighth notes, but it is three beats of two, not two beats of three. Count 6/8 as one and a, two and a, with a little weight at the start of each group. That lilt is what makes many rocking songs flow.',
        'Rest the beat on the dotted quarter, not the eighth note. If you count all six eighths as equal beats, the bar loses its two-beat swing and turns into six flat beats.'
      ],
      tip: 'Tap your foot twice per bar, once for each group of three. The foot, not the finger, keeps the main beat.',
      items: [
        cmp('tap1', 'Tap two bars of 6/8', 'rhythm', { pattern: [3, 1, 1, 1, 1, 1, 1, 3], tempo: 168, timeSignature: '6/8' }, { accuracy: 0.8 }),
        cmp('tap2', 'Tap two bars of 6/8 with a rest', 'rhythm', { pattern: [3, 1, 1, 1, -3, 1, 1, 1], tempo: 168, timeSignature: '6/8' }, { accuracy: 0.8 }),
        cmp('piece', 'A study in 6/8, both hands', 'piece', { tracks: { right: seq(SIX_R), left: seq(SIX_L) }, tempo: 84, timeSignature: '6/8' }, { accuracy: 0.8 }),
        cmp('theory', 'Beats in 6/8', 'theory', { q: 'How many main beats are there in a bar of 6/8?', options: ['Two', 'Three', 'Six', 'Four'], answer: 0, why: '6/8 groups its six eighth notes into two groups of three, so it has two main beats.' }, { accuracy: 1 }),
        cmp('theory2', '3/4 or 6/8', 'theory', { q: 'Both 3/4 and 6/8 add up to six eighth notes. What is the difference?', options: ['3/4 has three beats of two; 6/8 has two beats of three', '3/4 is faster', '6/8 has no beats', 'There is no difference at all'], answer: 0, why: '3/4 divides the bar into three groups of two eighths, and 6/8 into two groups of three.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 3 }
    },
    {
      id: 'l7-etude', title: 'A melodic etude: even and independent fingers', minutes: 16,
      goal: 'Play an even-finger study in a steady pulse, with each finger moving on its own.',
      teach: [
        'This study plays a five-finger pattern, up five notes and back, and moves it up one step each bar. The repetition is the point: each time round, the same fingers do the same job, so any finger that is lazy shows up at once.',
        'Fingers four and five are the least strong for most players, so they get the most work here. Keep every note the same length and the same loudness. Evenness matters more than speed, and it is what your ear notices first.',
        'Keep the fingers close to the keys and move only the playing finger. If the other fingers jump up, the hand wobbles and the pulse goes with it.'
      ],
      tip: 'Count out loud as you play. If your voice and your fingers stay together, the tempo is steady.',
      items: [
        etd('right', 'Even fingers, right hand', 'piece', { notes: seq(ETUDE_R), tempo: 76, hand: 'right' }, { accuracy: 0.8 }),
        etd('both', 'Even fingers, both hands', 'piece', { tracks: { right: seq(ETUDE_R), left: seq(ETUDE_L) }, tempo: 72 }, { accuracy: 0.75 }),
        etd('echo', 'Echo a short figure', 'echo', { notes: seq('C4:0.5 D4:0.5 E4:0.5 F4:0.5 G4:1'), tempo: 76, hand: 'right', rounds: 4 }, { accuracy: 0.8 }),
        etd('theory', 'What an etude trains', 'theory', { q: 'What does a study of finger independence ask each finger to do?', options: ['Lift and play without pulling the others out of place', 'Press as hard as possible', 'Play at the same volume as the hand', 'Stay off the keys'], answer: 0, why: 'Independence means one finger can move on its own while the rest of the hand stays still and relaxed.' }, { accuracy: 1 }),
        etd('theory2', 'The quiet fingers', 'theory', { q: 'Which two fingers need the most practice in a study like this?', options: ['The fourth and fifth', 'The thumb and the second', 'The third and fourth', 'The first and second'], answer: 0, why: 'The fourth and fifth fingers are the least used and the least strong for most players, so studies give them extra work.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 3 }
    },
    {
      id: 'l7-sonatina-exposition', title: 'A sonatina: the exposition', minutes: 17,
      goal: 'Play the opening section of a sonatina-style movement, with a first idea in the tonic and a second idea that moves to the dominant.',
      teach: [
        'A sonatina is a short sonata, most often in three movements: a quick first movement, a slow song-like second, and a lively finale. The first movement is the one written in sonata form.',
        'Sonata form has three parts. The exposition presents the themes, the development works on them, and the recapitulation brings them back. In a short sonatina the development is brief, so the exposition and the return carry most of the shape.',
        'In the exposition of a major-key piece, the first theme sits in the home key and the second theme comes in the dominant, a fifth higher. Your study does the same: an idea in C, then a second idea that moves to G and closes there.'
      ],
      tip: 'Play each phrase on its own and listen for its ending. A phrase usually comes to rest on a longer note before the next one begins.',
      items: [
        son('melody', 'The exposition, right hand', 'piece', { notes: seq(EXP_R), tempo: 96, hand: 'right' }, { accuracy: 0.8 }),
        son('both', 'The exposition, both hands', 'piece', { tracks: { right: seq(EXP_R), left: seq(EXP_L) }, tempo: 92 }, { accuracy: 0.8 }),
        son('sight', 'Sight-read in C', 'sight', { range: [60, 79], hand: 'right', key: 'C', length: 4 }, { accuracy: 0.7 }),
        son('theory', 'What a sonatina is', 'theory', { q: 'What is a sonatina?', options: ['A short sonata, usually in three movements', 'A long symphony', 'A dance in three beats', 'A study for one finger'], answer: 0, why: 'A sonatina is a smaller sonata: shorter, lighter, and most often in three movements.' }, { accuracy: 1 }),
        son('theory2', 'The second theme', 'theory', { q: 'In the exposition of a major-key sonatina, which key does the second theme usually take?', options: ['The dominant', 'The tonic', 'The subdominant', 'The relative minor'], answer: 0, why: 'The first theme is in the home key and the second theme contrasts in the dominant, a fifth above.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 3 }
    },
    {
      id: 'l7-sonatina-andante', title: 'The song-like middle movement', minutes: 15,
      goal: 'Play a slow, singing middle movement, shape long phrases, and know where such a movement usually sits in key.',
      teach: [
        'The middle movement of a sonatina is usually slow and song-like. Players call this style cantabile, which means in a singing style. Think of a singer taking a long breath before each phrase.',
        'The slow movement often sits in a related key, so the ear gets a change without losing the home base. The subdominant and the relative minor are the favourite choices. This study is in F, the subdominant of C.',
        'Shape the line and keep the left hand quiet. Give the melody a gentle rise and fall, and let each phrase settle on its last note as a singer would, while the beat keeps going.'
      ],
      tip: 'Sing the melody in your head as you play it. A melody you can sing is a melody you can shape.',
      items: [
        andante('melody', 'The middle movement, right hand', 'piece', { notes: seq(AND_R), tempo: 72, hand: 'right', timeSignature: '3/4' }, { accuracy: 0.8 }),
        andante('both', 'The middle movement, both hands', 'piece', { tracks: { right: seq(AND_R), left: seq(AND_L) }, tempo: 69, timeSignature: '3/4' }, { accuracy: 0.8 }),
        andante('echo', 'Echo a singing phrase', 'echo', { notes: seq('A4:1 Bb4:1 C5:1 Bb4:1 A4:1'), tempo: 66, hand: 'right', rounds: 3 }, { accuracy: 0.8 }),
        andante('theory', 'Cantabile', 'theory', { q: 'What does cantabile mean?', options: ['In a singing style', 'Very fast', 'Very loud', 'Without any expression'], answer: 0, why: 'Cantabile tells you to play in a smooth, singing style, as if the melody were being sung.' }, { accuracy: 1 }),
        andante('theory2', 'The key of a slow movement', 'theory', { q: 'Where does the slow middle movement of a sonatina often sit in key?', options: ['In a related key, such as the subdominant or the relative minor', 'Always in the tonic', 'A semitone higher than the first movement', 'In no key at all'], answer: 0, why: 'A slow movement usually moves to a related key for contrast, most often the subdominant or the relative minor.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 3 }
    },
    {
      id: 'l7-rondo', title: 'A rondo', minutes: 16,
      goal: 'Play a rondo refrain and a contrasting episode that moves to the dominant.',
      teach: [
        'A rondo keeps one tune coming back. That tune is the refrain, and the new ideas between its returns are the episodes. The usual plan is A B A C A: the refrain, a new idea, the refrain, a different idea, and the refrain again.',
        'The refrain stays in the home key, and the episodes wander to related keys, so the return of the refrain feels like coming home. Rondos are lively and often close a sonatina or a sonata.',
        'Play the refrain the same way every time; the repetition is the pleasure. Let the episode feel brighter or lighter, and mark clearly the moment the refrain comes back.'
      ],
      tip: 'Count the bars of the refrain so you know exactly where it returns. Knowing the shape keeps the pulse steady.',
      items: [
        ron('refrain', 'Rondo refrain, right hand', 'piece', { notes: seq(RONDO_R), tempo: 100, hand: 'right', timeSignature: '2/4' }, { accuracy: 0.8 }),
        ron('both', 'Rondo refrain, both hands', 'piece', { tracks: { right: seq(RONDO_R), left: seq(RONDO_L) }, tempo: 96, timeSignature: '2/4' }, { accuracy: 0.8 }),
        ron('episode', 'An episode in the dominant', 'piece', { notes: seq(EPISODE_R), tempo: 100, hand: 'right', timeSignature: '2/4' }, { accuracy: 0.8 }),
        ron('theory', 'What a rondo is', 'theory', { q: 'What is a rondo?', options: ['A form where one theme keeps returning between contrasting episodes', 'A piece with no repeated music', 'A slow song', 'A scale study'], answer: 0, why: 'In a rondo the refrain returns again and again, separated by different episodes.' }, { accuracy: 1 }),
        ron('theory2', 'The shape of a rondo', 'theory', { q: 'Which letter pattern shows a rondo?', options: ['A B A C A', 'A A A A', 'A B C D', 'A B B A'], answer: 0, why: 'The refrain A comes back between new episodes B and C, giving the shape A B A C A.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 3 }
    },
    {
      id: 'l7-romantic', title: 'Mood and rubato', minutes: 16,
      goal: 'Play a lyrical piece in a singing tone and use a little rubato without losing the pulse.',
      teach: [
        'Rubato means stolen time. You lean on a note and give the beat back a moment later, so the line breathes while the pulse stays underneath. A little rubato shapes a phrase; too much loses the shape.',
        'Use it where the music sighs: at the top of a phrase, on a long note, or in the bar before the last. The words a tempo, written afterwards, tell you to return to the first speed.',
        'Romantic composers wrote many short, warm pieces like this one. Keep the left hand soft and let the right hand sing. Dolce means sweetly and espressivo means expressively: two words for the sound you are after.'
      ],
      tip: 'Practise with a steady beat first, then add the rubato. Steal only a little time, and always give it back.',
      items: [
        rom('melody', 'A lyrical study, right hand', 'piece', { notes: seq(LYRIC_R), tempo: 72, hand: 'right' }, { accuracy: 0.8 }),
        rom('both', 'A lyrical study, both hands', 'piece', { tracks: { right: seq(LYRIC_R), left: seq(LYRIC_L) }, tempo: 69 }, { accuracy: 0.8 }),
        rom('echo', 'Echo a lyrical phrase', 'echo', { notes: seq('E4:1 A4:1 C5:1 B4:1 A4:1'), tempo: 66, hand: 'right', rounds: 3 }, { accuracy: 0.8 }),
        rom('theory', 'Rubato', 'theory', { q: 'What does rubato mean?', options: ['A flexible give-and-take in tempo', 'Strict, even time', 'As fast as possible', 'A sudden stop'], answer: 0, why: 'Rubato means robbed time: you lean on some notes and hurry others while the underlying pulse stays steady.' }, { accuracy: 1 }),
        rom('theory2', 'Dolce', 'theory', { q: 'What does dolce mean?', options: ['Sweetly and softly', 'Loud and heavy', 'Fast and furious', 'Short and detached'], answer: 0, why: 'Dolce asks for a sweet, soft sound, most often in a lyrical slow passage.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 3 }
    }
  ],
  exam: {
    id: 'l7-exam', title: 'Level 7 check-up', passPercent: 80, minTaskPercent: 65,
    items: [
      exam('chromatic', 'Chromatic scale, right hand', 'piece', { notes: seq(CHROM_R), tempo: 76, hand: 'right' }, { accuracy: 0.85 }),
      exam('seventh', 'G7 broken, resolving to C', 'piece', { notes: seq(G7_C), tempo: 76, hand: 'right' }, { accuracy: 0.8 }),
      exam('compound', 'A study in 6/8, both hands', 'piece', { tracks: { right: seq(SIX_R), left: seq(SIX_L) }, tempo: 84, timeSignature: '6/8' }, { accuracy: 0.8 }),
      exam('sonatina', 'The exposition, both hands', 'piece', { tracks: { right: seq(EXP_R), left: seq(EXP_L) }, tempo: 92 }, { accuracy: 0.8 }),
      exam('sight', 'Sight-reading in C', 'sight', { range: [60, 74], hand: 'right', key: 'C', length: 4 }, { accuracy: 0.7 }),
      exam('ear', 'Steps or skips', 'ear', { kind: 'step-skip', rounds: 5 }, { accuracy: 0.8 }),
      exam('rhythm', 'Tap a 6/8 pattern', 'rhythm', { pattern: [1, 1, 1, 3, 1, 1, 1, 3], tempo: 168, timeSignature: '6/8' }, { accuracy: 0.8 }),
      exam('theory', 'Rondo form', 'theory', { q: 'In a rondo, what is the tune that keeps returning called?', options: ['The refrain', 'The episode', 'The cadence', 'The development'], answer: 0, why: 'The refrain is the main tune; the episodes are the contrasting ideas heard between its returns.' }, { accuracy: 1 })
    ]
  }
}
