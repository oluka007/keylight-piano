// Level 6: Scales, Chords and Style. All lesson text, quiz questions and exercises are original.
// Every inline piece is a short study written as a note list for this course; no third-party
// scores, editions or arrangements are used. The level assumes a 49-key keyboard.
import { seq, itemsFor } from '../builders.js'

const arp = itemsFor('l6-arpeggios')
const inv = itemsFor('l6-inversions')
const alb = itemsFor('l6-alberti')
const dance = itemsFor('l6-baroque-dance')
const son = itemsFor('l6-sonatina')
const ch = itemsFor('l6-character')
const ped = itemsFor('l6-pedal')
const read = itemsFor('l6-reading')
const exam = itemsFor('l6-exam')

// Original studies written for this level.
// Alberti bass in C: C - F - G - C, one bar each in 4/4, with a simple tune above (4/4).
const ALB_L = 'C3:0.5 G3:0.5 E3:0.5 G3:0.5 C3:0.5 G3:0.5 E3:0.5 G3:0.5 F3:0.5 C4:0.5 A3:0.5 C4:0.5 F3:0.5 C4:0.5 A3:0.5 C4:0.5 G3:0.5 D4:0.5 B3:0.5 D4:0.5 G3:0.5 D4:0.5 B3:0.5 D4:0.5 C3:0.5 G3:0.5 E3:0.5 G3:0.5 C3:0.5 G3:0.5 E3:0.5 G3:0.5'
const ALB_R = 'E4 F4 G4:2 A4 G4 F4:2 G4 B4 D5:2 C5:4'
// Original minuet in G, 3/4, eight bars, one bass note per bar.
const MIN_R = 'G4:2 A4 B4:2 C5 D5 C5 B4 A4:3 G4:2 F#4 E4:2 F#4 G4 A4 B4 G4:3'
const MIN_L = 'G3:3 B3:3 D4:3 D3:3 D3:3 D3:3 G3:3 G3:3'
// Original musette in G, 2/4, eight bars, with an open-fifth drone in the left hand.
const MUS_R = 'D5 B4 C5 A4 B4 G4 A4:2 D5 B4 C5 F#4 B4 G4 G4:2'
const MUS_L = 'G3 D4 G3 D4 G3 D4 G3 D4 G3 D4 G3 D4 G3 D4 G3 D4'
// Original Classical study, 4/4, eight bars: a question on the dominant, an answer on the tonic.
const SON_R = 'E5:2 D5:2 C5 D5 E5:2 F5 E5 D5:2 D5:4 E5:2 D5:2 C5 B4 A4:2 G4 A4 B4:2 C5:4'
const SON_L = 'C3:2 G3:2 C3:2 G3:2 F3:2 C4:2 G3:2 D4:2 C3:2 G3:2 F3:2 A3:2 G3:2 B3:2 C3:4'
// Original pastoral study in G, 6/8, eight bars, over a quiet drone.
const PAST_R = 'D5:1.5 B4 G4:0.5 A4:1.5 B4 C5:0.5 D5:1.5 B4 A4:0.5 G4:3 B4:1.5 C5 D5:0.5 C5:1.5 B4 A4:0.5 B4:1.5 A4 G4:0.5 G4:3'
const PAST_L = 'G3:1.5 D4:1.5 G3:1.5 D4:1.5 G3:1.5 D4:1.5 G3:3 G3:1.5 D4:1.5 D4:1.5 G3:1.5 G3:1.5 D4:1.5 G3:3'
// Original flowing study in F, 6/8, eight bars, over a broken-chord left hand.
const FLOW_R = 'C5:1.5 A4 F4:0.5 G4:1.5 A4 Bb4:0.5 C5:1.5 A4 G4:0.5 F4:3 Bb4:1.5 D5 Bb4:0.5 Bb4:1.5 A4 G4:0.5 A4:1.5 G4 F4:0.5 F4:3'
const FLOW_L = 'F3:1.5 C4:1.5 F3:1.5 C4:1.5 F3:1.5 C4:1.5 F3:3 Bb3:1.5 D4:1.5 C4:1.5 G3:1.5 F3:1.5 C4:1.5 F3:3'
// Original slow study in C, 3/4, eight bars, one harmony per bar for pedal changes.
const PED_R = 'E4:2 G4 F4:3 G4:2 A4 G4:3 A4:2 F4 G4:3 E4:2 D4 C4:3'
const PED_L = 'C3:3 F3:3 C3:3 G3:3 F3:3 G3:3 C3:3 C3:3'

export const level6 = {
  id: 'level-6', number: 6, title: 'Scales, Chords and Style', grade: 'RCM 4, ABRSM Grade 3-4', keys: 49,
  blurb: 'A 49-key keyboard opens the whole level: arpeggios and chord inversions, an Alberti bass, two Baroque dances, a Classical question-and-answer phrase, two studies in six-eight and your first work with the pedal.',
  lessons: [
    {
      id: 'l6-arpeggios', title: 'Arpeggios in four keys', minutes: 16,
      goal: 'Play the major arpeggios of D, A, B flat and E flat up and back, one octave in the right hand, with a smooth, even line.',
      teach: [
        'An arpeggio plays the notes of a chord one after another: root, third, fifth and the octave. The D major arpeggio is D, F sharp, A, D. Play it up and back in one smooth shape, with no bump at the top.',
        'Over one octave the hand stretches instead of crossing: right hand 1 2 3 5 for D and A, left hand 5 3 2 1. In B flat and E flat the thumb must not sit on the black root: right hand 2 1 2 4, thumb on the first white key (D in B flat, G in E flat).',
        'Four keys cover the arpeggios of this grade: D, A, B flat and E flat. Say the notes before you play them: D F sharp A, A C sharp E, B flat D F, E flat G B flat. Naming the third keeps the spelling right.'
      ],
      tip: 'Practise each arpeggio slowly in the right hand, then try D and A in the left hand too, fingered 5 3 2 1.',
      diagram: { type: 'keys', range: [62, 74], highlight: [62, 66, 69, 74] },
      items: [
        arp('arp-d', 'D major arpeggio, right hand', 'arpeggio', { tb: { type: 'chord', tonic: 2, hand: 'right' } }, { accuracy: 0.85 }),
        arp('arp-a', 'A major arpeggio, right hand', 'arpeggio', { tb: { type: 'chord', tonic: 9, hand: 'right' } }, { accuracy: 0.85 }),
        arp('arp-bb', 'B flat major arpeggio, right hand', 'arpeggio', { tb: { type: 'chord', tonic: 10, hand: 'right' } }, { accuracy: 0.8 }),
        arp('arp-eb', 'E flat major arpeggio, right hand', 'arpeggio', { tb: { type: 'chord', tonic: 3, hand: 'right' } }, { accuracy: 0.8 }),
        arp('ear', 'Major or minor', 'ear', { kind: 'chord', rounds: 8 }, { accuracy: 0.8 }),
        arp('theory', 'Spelling the arpeggio', 'theory', { q: 'Which notes make the D major arpeggio?', options: ['D, F sharp and A', 'D, F and A', 'D, G and B', 'D, A and E'], answer: 0, why: 'A major triad stacks a root, a major third and a perfect fifth: D, F sharp and A.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 4 }
    },
    {
      id: 'l6-inversions', title: 'Inversions: root, first and second', minutes: 16,
      goal: 'Play a triad in root position, first inversion and second inversion, broken, and hear the difference.',
      teach: [
        'A triad has three positions. Root position puts the root at the bottom, as in C, E, G. First inversion lifts the root an octave, so the third is lowest: E, G, C. Second inversion puts the fifth lowest: G, C, E.',
        'The notes never change, only their order. Listen to how each position colours the chord. Root position sounds settled, first inversion sounds lighter, and second inversion sounds least stable, ready to move on.',
        'Play each position blocked first, then broken. Move the hand as little as possible between one position and the next. When you play in both hands, keep both hands on the notes of the same triad.'
      ],
      tip: 'Say the lowest note of each position out loud. The lowest note is what names the inversion.',
      items: [
        inv('cad-c', 'I-IV-V-I in C', 'chord', { tb: { type: 'cadence', tonic: 0, hand: 'both' } }, { accuracy: 0.8 }),
        inv('arp-c', 'C major arpeggio, left hand', 'arpeggio', { tb: { type: 'chord', tonic: 0, hand: 'left' } }, { accuracy: 0.8 }),
        inv('cad-g', 'I-IV-V-I in G', 'chord', { tb: { type: 'cadence', tonic: 7, hand: 'both' } }, { accuracy: 0.8 }),
        inv('broken', 'C major triad in three positions, broken', 'piece', { notes: seq('C4 E4 G4 E4 E4 G4 C5 G4 G4 C5 E5 C5 C4:4'), tempo: 72, hand: 'right', timeSignature: '4/4' }, { accuracy: 0.8 }),
        inv('ear', 'Major or minor', 'ear', { kind: 'chord', rounds: 8 }, { accuracy: 0.8 }),
        inv('theory-first', 'First inversion', 'theory', { q: 'Which note is lowest in the first inversion of the C major triad?', options: ['E', 'C', 'G', 'A'], answer: 0, why: 'First inversion puts the third at the bottom, so the C major triad stands as E, G, C.' }, { accuracy: 1 }),
        inv('theory-second', 'Second inversion', 'theory', { q: 'In the second inversion of a triad, which note is at the bottom?', options: ['The fifth', 'The root', 'The third', 'The octave'], answer: 0, why: 'Second inversion places the fifth lowest, as in G, C, E for the C major triad.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 4 }
    },
    {
      id: 'l6-alberti', title: 'The Alberti bass', minutes: 16,
      goal: 'Play an Alberti bass in the left hand under a right-hand tune, changing chord where the harmony moves.',
      teach: [
        'An Alberti bass plays a chord as low, high, middle, high. Over a C chord that is C, G, E, G. Instead of one block of sound, the harmony ripples in small even steps, and Classical composers used this figure constantly.',
        'Play the four notes evenly and softly. The figure repeats under the tune, so it should sound like a quiet ripple and never cover the melody. Keep the hand still and let the fingers do the walking.',
        'Change to the new chord where the harmony moves, usually at the start of a bar or half bar. In the study below the left hand goes from C to F to G and back to C while the right hand carries a simple tune.'
      ],
      tip: 'Learn the left hand alone until the pattern runs by itself, then add the melody and keep the bass softer.',
      diagram: { type: 'keys', range: [48, 55], highlight: [48, 52, 55], fingers: { 48: 5, 52: 3, 55: 1 } },
      items: [
        alb('arp-l', 'C major arpeggio, left hand', 'arpeggio', { tb: { type: 'chord', tonic: 0, hand: 'left' } }, { accuracy: 0.8 }),
        alb('cadence', 'I-IV-V-I in C, left hand', 'chord', { tb: { type: 'cadence', tonic: 0, hand: 'left' } }, { accuracy: 0.8 }),
        alb('piece-lh', 'Alberti bass, left hand alone', 'piece', { notes: seq(ALB_L), tempo: 66, hand: 'left', timeSignature: '4/4' }, { accuracy: 0.8 }),
        alb('piece-both', 'Alberti bass under a tune', 'piece', { tracks: { right: seq(ALB_R), left: seq(ALB_L) }, tempo: 66, timeSignature: '4/4' }, { accuracy: 0.75 }),
        alb('theory', 'The Alberti pattern', 'theory', { q: 'In which order does an Alberti bass play the notes of a C chord?', options: ['Low, high, middle, high', 'Low, middle, high, middle', 'High, low, middle, low', 'All the notes together'], answer: 0, why: 'The Alberti figure takes the lowest note, then the highest, then the middle, then the highest again: C, G, E, G.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 3 }
    },
    {
      id: 'l6-baroque-dance', title: 'Two Baroque dances', minutes: 17,
      goal: 'Play an original minuet and an original musette with a crisp, dancing touch and a clear strong beat.',
      teach: [
        'Baroque dances have a steady, danceable pulse. A minuet is in three time, with one strong beat and two lighter ones. A musette is a French dance with a drone bass, where the left hand repeats the open fifth of the key like a small bagpipe.',
        'Play dance music with a crisp, lifted touch. Give the first beat of each bar a little more weight and keep the other beats light, so the step is easy to feel. Let the ends of phrases lift off the key.',
        'A musette usually keeps its drone on the tonic, and that drone makes the harmony sound still and open. Keep the drone even and quiet, and let the melody dance above it. Both dances are short, so play them a few times and enjoy the swing.'
      ],
      tip: 'Count the beats out loud and step them with your foot. A dance you can feel is a dance you can play.',
      items: [
        dance('minuet-rh', 'A minuet, right hand', 'piece', { notes: seq(MIN_R), tempo: 100, hand: 'right', timeSignature: '3/4' }, { accuracy: 0.8 }),
        dance('minuet-both', 'A minuet, both hands', 'piece', { tracks: { right: seq(MIN_R), left: seq(MIN_L) }, tempo: 96, timeSignature: '3/4' }, { accuracy: 0.75 }),
        dance('musette-rh', 'A musette, right hand', 'piece', { notes: seq(MUS_R), tempo: 96, hand: 'right', timeSignature: '2/4' }, { accuracy: 0.8 }),
        dance('musette-both', 'A musette, both hands', 'piece', { tracks: { right: seq(MUS_R), left: seq(MUS_L) }, tempo: 92, timeSignature: '2/4' }, { accuracy: 0.75 }),
        dance('echo', 'Echo a dance phrase', 'echo', { notes: seq('D5 G4 A4 B4 C5:2'), tempo: 96, hand: 'right', rounds: 3 }, { accuracy: 0.8 }),
        dance('theory', 'The musette drone', 'theory', { q: 'What is the drone in a musette?', options: ['A repeated open fifth in the bass', 'A fast scale in the treble', 'A silent bar', 'A change of key in every bar'], answer: 0, why: 'The musette keeps a bagpipe-like drone, usually the tonic and fifth repeated or held in the left hand.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 4 }
    },
    {
      id: 'l6-sonatina', title: 'Question and answer: a Classical phrase', minutes: 17,
      goal: 'Shape an eight-bar Classical study as a question and an answer, resting on the dominant and then closing on the tonic.',
      teach: [
        'A sonatina is a short Classical piece, and its first phrase usually asks a question. The music moves away from the tonic and stops on the dominant, which sounds unfinished. That resting point is called a half cadence.',
        'The second phrase answers. It begins like the first, then turns home and ends on the tonic with a full stop, a perfect cadence. Question and answer: that pair of phrases shapes many Classical themes.',
        'Play the question with a rising feeling and let it hang on the dominant. Give the answer a settled close, easing into the final tonic so it sounds finished. Keep the left hand soft under both phrases.'
      ],
      tip: 'Listen for the note the question stops on. If it does not sound finished, you have found the half cadence.',
      items: [
        son('piece-rh', 'Question and answer, right hand', 'piece', { notes: seq(SON_R), tempo: 80, hand: 'right', timeSignature: '4/4' }, { accuracy: 0.8 }),
        son('piece-both', 'Question and answer, both hands', 'piece', { tracks: { right: seq(SON_R), left: seq(SON_L) }, tempo: 76, timeSignature: '4/4' }, { accuracy: 0.75 }),
        son('cadence', 'I-IV-V-I in C', 'chord', { tb: { type: 'cadence', tonic: 0, hand: 'both' } }, { accuracy: 0.8 }),
        son('echo', 'Echo the question', 'echo', { notes: seq('E5:2 D5:2 C5 D5 E5:2'), tempo: 80, hand: 'right', rounds: 3 }, { accuracy: 0.8 }),
        son('theory', 'The half cadence', 'theory', { q: 'Where does the first phrase of a Classical piece usually stop?', options: ['On the dominant, an unfinished sound', 'On the tonic, fully finished', 'On a rest', 'On a note outside the key'], answer: 0, why: 'The first phrase ends on the dominant in a half cadence, so it sounds like a question waiting for an answer.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 3 }
    },
    {
      id: 'l6-character', title: 'Two studies in six-eight', minutes: 16,
      goal: 'Play in 6/8 time with two beats in a bar, a gentle pastoral drone and a flowing melody.',
      teach: [
        'In 6/8 time each bar holds six eighth notes, felt as two groups of three. Count one, two, three, four, five, six, and feel the weight on the first and the fourth. It is a flowing, rocking metre, common in gentle pieces.',
        'A pastorale is calm and open, often with a drone in the bass and a lilting tune above. Keep the left hand quiet and even, like a distant bagpipe, and let the right hand sing in long smooth phrases.',
        'The second study flows in the same metre with a broken-chord left hand. Keep the hands together at the change of each group, and let the melody rise to a small peak before it settles back home.'
      ],
      tip: 'Count the six eighths in two groups of three. Counted as three groups of two, the piece will limp.',
      items: [
        ch('past-rh', 'Pastoral study, right hand', 'piece', { notes: seq(PAST_R), tempo: 84, hand: 'right', timeSignature: '6/8' }, { accuracy: 0.8 }),
        ch('past-both', 'Pastoral study, both hands', 'piece', { tracks: { right: seq(PAST_R), left: seq(PAST_L) }, tempo: 80, timeSignature: '6/8' }, { accuracy: 0.75 }),
        ch('flow-rh', 'Flowing study in F, right hand', 'piece', { notes: seq(FLOW_R), tempo: 84, hand: 'right', timeSignature: '6/8' }, { accuracy: 0.8 }),
        ch('flow-both', 'Flowing study in F, both hands', 'piece', { tracks: { right: seq(FLOW_R), left: seq(FLOW_L) }, tempo: 80, timeSignature: '6/8' }, { accuracy: 0.75 }),
        ch('rhythm', 'Tap in six-eight', 'rhythm', { pattern: [1, 1, 1, 3, 3, 1, 1, 1], tempo: 168, timeSignature: '6/8' }, { accuracy: 0.8 }),
        ch('theory', 'Feeling six-eight', 'theory', { q: 'How many eighth notes are in one bar of 6/8?', options: ['Six', 'Three', 'Four', 'Eight'], answer: 0, why: 'The lower number 8 says the counting unit is an eighth note, and the upper number 6 says there are six of them in a bar, felt as two beats of three.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 4 }
    },
    {
      id: 'l6-pedal', title: 'The damper pedal', minutes: 15,
      goal: 'Use the damper pedal: change it with each new harmony, lifting as the chord sounds and pressing again just after.',
      teach: [
        'The right pedal is the damper pedal. Press it and the dampers lift, so notes keep sounding after you let go of the keys. It joins notes into a warmer sound and lets you hold a chord while the hand moves.',
        'The skill is the change. Play the new chord, lift the pedal as it sounds, and press it down again a moment later, while the fingers still hold the keys. The old harmony clears and the new one rings. Change too late and the chords smear.',
        'In the study below the harmony changes once a bar. Press the pedal on the first beat, hold it through the bar, and change it on the next downbeat. Written music marks the pedal with Ped. and a release sign.'
      ],
      tip: 'Change the pedal on the beat, not before it. The new chord sounds first, then the change clears the old one.',
      items: [
        ped('piece-rh', 'A slow study, right hand', 'piece', { notes: seq(PED_R), tempo: 60, hand: 'right', timeSignature: '3/4' }, { accuracy: 0.8 }),
        ped('piece-both', 'A slow study, both hands', 'piece', { tracks: { right: seq(PED_R), left: seq(PED_L) }, tempo: 56, timeSignature: '3/4' }, { accuracy: 0.75 }),
        ped('echo', 'Echo a calm phrase', 'echo', { notes: seq('E4 G4 F4 A4'), tempo: 60, hand: 'right', rounds: 3 }, { accuracy: 0.8 }),
        ped('theory-change', 'Changing the pedal', 'theory', { q: 'When should you change the damper pedal?', options: ['Just after the new chord sounds', 'Long before the new chord', 'Only at the end of the piece', 'On every note'], answer: 0, why: 'The new chord sounds first, then a quick lift and press clears the old harmony without a gap.' }, { accuracy: 1 }),
        ped('theory-mark', 'The pedal mark', 'theory', { q: 'What does the mark Ped. tell you to do?', options: ['Press the damper pedal down', 'Play more softly', 'Lift the left hand', 'Play the notes short'], answer: 0, why: 'Ped. marks where the damper pedal is pressed, and a release sign shows where it lifts.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 3 }
    },
    {
      id: 'l6-reading', title: 'Intervals, hearing and first sight-reading', minutes: 15,
      goal: 'Name intervals by number, hear the difference between a major and a minor triad, and read a short line at sight.',
      teach: [
        'Intervals are named by counting letters from the bottom note, including both ends. C up to D is a second, C to E a third, C to F a fourth, C to G a fifth, and C to the next C an octave.',
        'Two intervals can share a number and still differ in size. A major third is four semitones, as from C to E. A minor third is three semitones, as from E to G. Counting semitones tells the two apart.',
        'Sight-reading means playing a piece you have never seen, once, without stopping. Look at the key signature and the time signature first, count a bar in your head, then keep going even if a note goes wrong.'
      ],
      tip: 'Before you start, find the highest and lowest notes and where your hands will sit. A moment of looking saves many stops.',
      items: [
        read('theory-fifth', 'Naming an interval', 'theory', { q: 'What interval is C up to G?', options: ['A fifth', 'A third', 'A fourth', 'An octave'], answer: 0, why: 'Counting the letters from C to G gives C, D, E, F, G: five notes, so the interval is a fifth.' }, { accuracy: 1 }),
        read('theory-third', 'Counting semitones', 'theory', { q: 'How many semitones are in a major third?', options: ['Four', 'Three', 'Five', 'Two'], answer: 0, why: 'A major third spans four semitones, as from C up to E. A minor third spans three, as from E to G.' }, { accuracy: 1 }),
        read('ear-interval', 'Hear the interval', 'ear', { kind: 'interval', rounds: 10 }, { accuracy: 0.8 }),
        read('ear-chord', 'Major or minor', 'ear', { kind: 'chord', rounds: 8 }, { accuracy: 0.8 }),
        read('game', 'Read the Treble', 'notegame', { game: 'read-treble', rounds: 12 }, { accuracy: 0.75 }),
        read('sight', 'Sight-read in G', 'sight', { range: [55, 74], hand: 'both', key: 'G', length: 4 }, { accuracy: 0.7 })
      ],
      pass: { minItemsDone: 4 }
    }
  ],
  exam: {
    id: 'l6-exam', title: 'Level 6 check-up', passPercent: 80, minTaskPercent: 65,
    items: [
      exam('arpeggio', 'D major arpeggio, right hand', 'arpeggio', { tb: { type: 'chord', tonic: 2, hand: 'right' } }, { accuracy: 0.85 }),
      exam('scale', 'D major scale, right hand', 'scale', { tb: { type: 'scale', tonic: 2, hand: 'right' } }, { accuracy: 0.85 }),
      exam('inversions', 'I-IV-V-I in G', 'chord', { tb: { type: 'cadence', tonic: 7, hand: 'both' } }, { accuracy: 0.8 }),
      exam('alberti', 'Alberti bass under a tune', 'piece', { tracks: { right: seq(ALB_R), left: seq(ALB_L) }, tempo: 66, timeSignature: '4/4' }, { accuracy: 0.75 }),
      exam('dance', 'A minuet, both hands', 'piece', { tracks: { right: seq(MIN_R), left: seq(MIN_L) }, tempo: 96, timeSignature: '3/4' }, { accuracy: 0.8 }),
      exam('sonatina', 'Question and answer, right hand', 'piece', { notes: seq(SON_R), tempo: 80, hand: 'right', timeSignature: '4/4' }, { accuracy: 0.8 }),
      exam('sight', 'Sight-reading in F', 'sight', { range: [53, 72], hand: 'both', key: 'F', length: 4 }, { accuracy: 0.7 }),
      exam('ear', 'Major or minor', 'ear', { kind: 'chord', rounds: 5 }, { accuracy: 0.8 }),
      exam('rhythm', 'Tap in six-eight', 'rhythm', { pattern: [1, 1, 1, 3, 3, 1, 1, 1], tempo: 168, timeSignature: '6/8' }, { accuracy: 0.8 }),
      exam('theory', 'The Alberti bass', 'theory', { q: 'Which notes does an Alberti bass play over a C chord?', options: ['C, G, E, G', 'C, E, G, E', 'C, C, G, G', 'C, E, G, C'], answer: 0, why: 'The Alberti figure goes lowest, highest, middle, highest: over C that is C, G, E, G.' }, { accuracy: 1 })
    ]
  }
}
