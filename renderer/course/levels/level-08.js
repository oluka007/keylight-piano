// Level 8: Intermediate. All lesson text, quizzes and every inline study in this file are original,
// written for this course as note lists. Every inline note stays inside C2-C6 (36-84), the span of a
// 49-key keyboard. Nothing here is borrowed, and no third-party edition or arrangement is used.
import { seq, itemsFor } from '../builders.js'

const lead = itemsFor('l8-leading-sevenths')
const both = itemsFor('l8-scales-together')
const voices = itemsFor('l8-two-voices')
const minor = itemsFor('l8-romantic-minor')
const minuet = itemsFor('l8-minuet-form')
const ballade = itemsFor('l8-ballade')
const sonata = itemsFor('l8-sonata-movement')
const reading = itemsFor('l8-reading-and-listening')
const exam = itemsFor('l8-exam')

// Original studies written for this level. Bars are whole bars of the metre named in the comments.

// Lesson 1: broken leading-tone seventh and broken dominant seventh, each resolving onto C major.
// 4/4, four bars each. In C the leading-tone seventh is B-D-F-A flat, the dominant seventh is G-B-D-F.
const DIM7_R = 'B3 D4 F4 Ab4 F4 D4 B3:2 C4 E4 G4 E4 C4:4'
const DOM7_R = 'G3 B3 D4 F4 D4 B3 G3:2 C4 E4 G4 E4 C4:4'

// Lesson 2: C major in contrary motion (4/4, four bars, the hands mirrored an octave apart), and a
// left-hand run of two octaves down, ending on the lowest C of the keyboard (4/4, four bars).
const CONTRA_R = 'C4 D4 E4 F4 G4 A4 B4 C5 C5 B4 A4 G4 F4 E4 D4 C4'
const CONTRA_L = 'C3 B2 A2 G2 F2 E2 D2 C2 C2 D2 E2 F2 G2 A2 B2 C3'
const RUN_LH = 'C4 B3 A3 G3 F3 E3 D3 C3 B2 A2 G2 F2 E2 D2 C2:2'

// Lesson 3: an original two-voice study in C (4/4, four bars). The left hand enters in bar 2 with the
// opening idea an octave lower, then the voices trade the answering figure.
const INV_R = 'C4 E4 G4 A4 G4:2 E4:2 C4:2 E4:2 C4:4'
const INV_L = 'r:4 C3 E3 G3 A3 G3:2 E3:2 C3:2 E3:2'
const INV_L_ALONE = 'C3 E3 G3 A3 G3:2 E3:2 C3:2 E3:2'   // the same line without the opening four beats

// Lesson 4: a Romantic study in A minor (4/4, four bars). The raised seventh G sharp in bar 2 rises
// to A in bar 3; the left hand holds the harmony: A minor, E, F, A minor.
const AMIN_R = 'A4 E5 C5 A4 B4:2 G#4:2 A4:2 C5:2 A4:4'
const AMIN_L = 'A3 E3 A3 E3 E3 B2 E3 B2 F3 C3 F3 C3 A3 E3 C4 E3'

// Lesson 5: an original minuet in C with an A B A shape (3/4, twelve bars). Bars 1-4 are the first
// section, bars 5-8 the middle section in G, bars 9-12 the return, closing with a V-I cadence.
const MIN_A_R = 'C5:2 E5 G5:2 E5 D5:2 B4 C5:3'
const MINUET_R = 'C5:2 E5 G5:2 E5 D5:2 B4 C5:3 F#5:2 G5 A5:3 G5:2 F#5 G5:3 C5:2 E5 G5:2 E5 D5:2 B4 C5:3'
const MINUET_L = 'C3 G3 G3 C3 G3 G3 G2 D3 D3 C3 G3 G3 G2 D3 D3 D3 A3 A3 G2 D3 D3 G2 D3 D3'
  + ' C3 G3 G3 C3 G3 G3 G2 D3 D3 C3 E3 G3'

// Lesson 6: an original ballade study in 6/8 (eight bars; one bar is three beats here). Bar 1 to bar 4
// is the quiet opening, bars 5 to 7 the rise, and bar 8 the close.
const BAL_R = 'E5:1 F5:0.5 G5:1 F5:0.5 E5:1 D5:0.5 C5:1 D5:0.5 E5:1.5 G5:0.5 E5:1 D5:3'
  + ' F5:1 G5:0.5 A5:1 G5:0.5 F5:1.5 E5:0.5 D5:1 E5:1 D5:0.5 C5:1 B4:0.5 C5:3'
const BAL_L = 'C3:1.5 G3:1.5 C3:1.5 G3:1.5 C3:1.5 G3:1.5 G2:1.5 D3:1.5'
  + ' F2:1.5 C3:1.5 D3:1.5 A3:1.5 G2:1.5 D3:1.5 C3:1.5 E3:1.5'

// Lesson 7: a dance movement in G with a contrasting trio in E minor (3/4, eight bars then four).
const MENUET_R = 'G5:2 D5 B4:2 G4 A4:2 B4 C5:3 D5:2 G5 A5:2 F#5 G5:2 A5 G5:3'
const MENUET_L = 'G2 D3 D3 G2 D3 D3 D3 A3 A3 A2 E3 E3 G2 D3 D3 D3 A3 A3 G2 D3 D3 G2 B2 D3'
const TRIO_R = 'B4:2 E5 G5:2 F#5 E5:2 D5 B4:3'
const TRIO_L = 'E2 G3 G3 B2 F#3 F#3 B2 F#3 F#3 E2 B2 B2'

export const level8 = {
  id: 'level-8', number: 8, title: 'Intermediate', grade: 'RCM 6, ABRSM Grade 5', keys: 49,
  blurb: 'Two-voice Baroque lines, the leading-tone and dominant sevenths, a moving bass under a singing tune, and the minuet and ballade shapes. Play this level on a 49-key keyboard: the studies reach down to the lowest C and use nearly the whole four-octave span.',
  lessons: [
    {
      id: 'l8-leading-sevenths', title: 'The leading-tone seventh and the dominant seventh', minutes: 16,
      goal: 'Play the diminished seventh on the leading tone and the dominant seventh, and hear how both of them pull home.',
      teach: [
        'The seventh note of a scale is the leading tone. It sits a half step below the tonic and leans up to it. In C minor, with the raised seventh B, a chord in thirds on B gives B, D, F and A flat. Composers borrow this chord in C major too.',
        'Four notes stacked in minor thirds make a diminished seventh chord. It sounds tense and restless, because two notes lean in opposite directions: the leading tone rises a half step to the tonic while the seventh above it falls a half step down.',
        'Broken into a rising pattern, those four notes make a restless arpeggio. Play it slowly and evenly, then let it land on the C major chord: C, E and G. Practise the same shape on other leading tones and listen for the same pull home.',
        'The dominant seventh is built on the fifth note of the scale: in C that is G, B, D and F. It is a major triad with a minor seventh above it, and it also wants to resolve, home to the tonic.'
      ],
      tip: 'Play the two chords one after the other and listen for how differently they pull towards C.',
      diagram: { type: 'keys', range: [59, 68], highlight: [59, 62, 65, 68], fingers: { 59: 1, 62: 2, 65: 3, 68: 4 } },
      items: [
        lead('dim7', 'The leading-tone seventh, broken', 'piece', { notes: seq(DIM7_R), tempo: 69, hand: 'right' }, { accuracy: 0.8 }),
        lead('dom7', 'The dominant seventh, broken', 'piece', { notes: seq(DOM7_R), tempo: 69, hand: 'right' }, { accuracy: 0.8 }),
        lead('arp-g', 'G major arpeggio, right hand', 'arpeggio', { tb: { type: 'chord', tonic: 7, hand: 'right' } }, { accuracy: 0.8 }),
        lead('echo', 'Echo the seventh figure', 'echo', { notes: seq('B3 D4 F4 Ab4 F4 D4'), tempo: 66, hand: 'right', rounds: 4 }, { accuracy: 0.8 }),
        lead('theory-notes', 'The leading-tone seventh', 'theory', { q: 'Which four notes make the diminished seventh chord on the leading tone of C minor?', options: ['B, D, F and A flat', 'B, D, F and A', 'G, B, D and F', 'B, D, F sharp and A flat'], answer: 0, why: 'Stacked in minor thirds above the leading tone B, the chord is B, D, F and A flat.' }, { accuracy: 1 }),
        lead('theory-dom', 'The dominant seventh', 'theory', { q: 'Which four notes make the dominant seventh chord in C major?', options: ['G, B, D and F sharp', 'G, B, D and F', 'C, E, G and B flat', 'G, B, D sharp and F'], answer: 1, why: 'The dominant seventh sits on the fifth note of the scale: root, major third, perfect fifth and minor seventh.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 4 }
    },
    {
      id: 'l8-scales-together', title: 'Hands together, and contrary motion', minutes: 18,
      goal: 'Play C and G major hands together, and C major in contrary motion, keeping the two hands level through every finger turn.',
      teach: [
        'Hands together is its own skill. The notes are already in your fingers, but the two hands must arrive at exactly the same moment. The places where they drift are the finger turns, so slow down there and listen for the two hands as one sound.',
        'In C major the right hand climbs 1 2 3 1 2 3 4 5 and the left hand climbs 5 4 3 2 1 3 2 1. The turns do not match: the right thumb passes under to F, but the left hand\'s third finger crosses over to A. Practise those two places slowly.',
        'Contrary motion means the hands move apart, one rising while the other falls. Start on C an octave apart with both thumbs. Now the fingering mirrors: both thumbs turn on the fourth note, F in the right hand and G in the left.',
        'Speed is the last step, not the first. Play slowly with a steady pulse, then take the same music a little faster, and only move on when each scale feels even and comfortable.'
      ],
      tip: 'Practise the outer octaves of the run first, then join them. The middle of a long scale is where the hands usually part.',
      diagram: { type: 'hands', hand: 'both', numbers: true },
      items: [
        both('scale-c', 'C major scale, hands together', 'scale', { tb: { type: 'scale', tonic: 0, hand: 'both' } }, { accuracy: 0.85 }),
        both('scale-g', 'G major scale, hands together', 'scale', { tb: { type: 'scale', tonic: 7, hand: 'both' } }, { accuracy: 0.85 }),
        both('contrary', 'C major in contrary motion', 'piece', { tracks: { right: seq(CONTRA_R), left: seq(CONTRA_L) }, tempo: 60 }, { accuracy: 0.75 }),
        both('run-lh', 'Two octaves down, left hand', 'piece', { notes: seq(RUN_LH), tempo: 66, hand: 'left' }, { accuracy: 0.8 }),
        both('rhythm', 'Tap even eighths, then quarters', 'rhythm', { pattern: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1, 1, 1, 1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1, 1, 1, 1], tempo: 60, timeSignature: '4/4' }, { accuracy: 0.8 }),
        both('theory', 'Contrary motion', 'theory', { q: 'In C major played in contrary motion, what do the hands do?', options: ['Move up together an octave apart', 'Play the same notes at the same time', 'Move apart, one rising while the other falls', 'Stay in one five-finger position'], answer: 2, why: 'Contrary motion means the voices move in opposite directions; the hands start on the same note name an octave apart.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 4 }
    },
    {
      id: 'l8-two-voices', title: 'Two voices that answer each other', minutes: 16,
      goal: 'Play two independent lines, one in each hand, with clear entries and the long notes held alive.',
      teach: [
        'Two-voice writing is a conversation. One voice states a short idea; the other answers with the same idea a little later. When the second voice copies the first, the writing is called imitative, and hearing that copy is the pleasure of this music.',
        'Each hand must keep its own line alive. When one voice moves, the other often holds a longer note, and that held note should stay audible to the end of its value. Bring the moving line out and keep the held note quiet.',
        'Learn each line on its own until you can sing it, then put the two together slowly. Think of two singers who take turns rather than two hands, and make each entry easy to hear.'
      ],
      tip: 'Work on the study\'s opening bars hands separately and slowly, and let the second voice answer.',
      diagram: { type: 'staff', clef: 'treble', notes: [{ p: 60 }, { p: 64 }, { p: 67 }, { p: 69 }] },
      items: [
        voices('lh', 'The answering line, left hand', 'piece', { notes: seq(INV_L_ALONE), tempo: 66, hand: 'left' }, { accuracy: 0.8 }),
        voices('both', 'A two-voice study, both hands', 'piece', { tracks: { right: seq(INV_R), left: seq(INV_L) }, tempo: 66 }, { accuracy: 0.75 }),
        voices('scale-a', 'A natural minor, hands together', 'scale', { tb: { type: 'minor', tonic: 9, hand: 'both' } }, { accuracy: 0.85 }),
        voices('echo', 'Echo an answering entry', 'echo', { notes: seq('C4 E4 G4 A4'), tempo: 66, hand: 'right', rounds: 4 }, { accuracy: 0.8 }),
        voices('theory', 'Two voices', 'theory', { q: 'The second voice enters later with the same idea as the first. What is that called?', options: ['A cadence', 'Imitation', 'Alberti bass', 'A trill'], answer: 1, why: 'When one voice copies the idea of another a little later, the writing is called imitative.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 4 }
    },
    {
      id: 'l8-romantic-minor', title: 'A Romantic study in a minor key', minutes: 16,
      goal: 'Shape a short study in A minor with a singing melody, a gentle accompaniment and the raised seventh leading home.',
      teach: [
        'Romantic piano music lives on mood, and a minor key sets a serious one. The tune still sings: long lines, a high point, and a small lift at the end of every phrase. Play the melody as if you were singing it, and let the accompaniment stay under it.',
        'In A minor the harmony often borrows the raised seventh, G sharp, so the line can lead strongly up to A. You met the harmonic form while you were learning scales; here you use it inside a piece, where it makes a phrase feel unfinished until it lands.',
        'Keep the accompaniment quieter than the tune, and give the phrase room to breathe. A small lift of the hand between phrases marks the end of a sentence, exactly as a singer takes a breath before the next line.'
      ],
      tip: 'Play the left hand alone first. When the accompaniment can run without you watching it, the melody is free to sing.',
      diagram: { type: 'keys', range: [57, 69], highlight: [57, 59, 60, 62, 64, 65, 68, 69], fingers: { 57: 1, 59: 2, 60: 3, 62: 1, 64: 2, 65: 3, 68: 4, 69: 5 } },
      items: [
        minor('scale-harm', 'A harmonic minor, right hand', 'scale', { tb: { type: 'harmonic', tonic: 9, hand: 'right' } }, { accuracy: 0.85 }),
        minor('scale-nat', 'A natural minor, right hand', 'scale', { tb: { type: 'minor', tonic: 9, hand: 'right' } }, { accuracy: 0.85 }),
        minor('melody', 'A minor study, right hand', 'piece', { notes: seq(AMIN_R), tempo: 72, hand: 'right' }, { accuracy: 0.8 }),
        minor('both', 'A minor study, both hands', 'piece', { tracks: { right: seq(AMIN_R), left: seq(AMIN_L) }, tempo: 69 }, { accuracy: 0.75 }),
        minor('echo', 'Echo the leading tone', 'echo', { notes: seq('A4 C5 B4 A4 G#4 A4'), tempo: 72, hand: 'right', rounds: 4 }, { accuracy: 0.8 }),
        minor('theory', 'The raised seventh', 'theory', { q: 'Which note is raised in A harmonic minor?', options: ['F to F sharp', 'G to G sharp', 'C to C sharp', 'E to E sharp'], answer: 1, why: 'The natural form of A minor uses the white keys, and the harmonic form raises the seventh note, G, to G sharp so that it leads up to A.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 4 }
    },
    {
      id: 'l8-minuet-form', title: 'The minuet and its A B A shape', minutes: 15,
      goal: 'Play a minuet in 3/4 with a contrasting middle section and a return of the opening, keeping the dance lift.',
      teach: [
        'A minuet is a courtly dance in 3/4. The first beat of each bar is the strongest, with two lighter beats after it, and the phrases usually come in pairs of four bars. Hold the dance in mind and the metre keeps itself.',
        'Many minuets follow the shape A B A. The first section states a short idea and comes to rest; the middle section moves away, very often to a new key; then the first section returns to close the dance. Hearing where the sections change tells you how to shape them.',
        'In the left hand the bass note falls on the first beat of the bar, with lighter notes after it, so the dance has a lift. Keep the first beat firm, the second and third light, and let the phrase close with a small lift.'
      ],
      tip: 'Count three quietly and let the first beat of each bar feel a little heavier. A minuet should never sound rushed.',
      diagram: { type: 'staff', clef: 'treble', notes: [{ p: 72 }, { p: 76 }, { p: 79 }, { p: 76 }] },
      items: [
        minuet('melody', 'Minuet, first section, right hand', 'piece', { notes: seq(MIN_A_R), tempo: 112, hand: 'right', timeSignature: '3/4' }, { accuracy: 0.8 }),
        minuet('both', 'Minuet in A B A, both hands', 'piece', { tracks: { right: seq(MINUET_R), left: seq(MINUET_L) }, tempo: 104, timeSignature: '3/4' }, { accuracy: 0.75 }),
        minuet('rhythm', 'Tap four bars of three', 'rhythm', { pattern: [1.5, 0.5, 1, 1.5, 0.5, 1, 3, 1.5, 0.5, 1], tempo: 104, timeSignature: '3/4' }, { accuracy: 0.8 }),
        minuet('theory-form', 'The shape of the sections', 'theory', { q: 'A piece is built A B A. What happens in the B section?', options: ['It repeats the first section exactly', 'It contrasts, often in a new key, before A returns', 'It is a faster version of A', 'It has no melody'], answer: 1, why: 'The middle section contrasts and often moves to a related key such as the dominant, and then the first section returns.' }, { accuracy: 1 }),
        minuet('theory-metre', 'Feeling the dance', 'theory', { q: 'How many beats are there in a bar of a minuet?', options: ['Two', 'Three', 'Four', 'Six'], answer: 1, why: 'A minuet is a dance in 3/4: a strong first beat with two lighter beats after it.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 3 }
    },
    {
      id: 'l8-ballade', title: 'A ballade: telling a story', minutes: 16,
      goal: 'Play a flowing study in 6/8 that grows through the middle and comes to rest quietly at the end.',
      teach: [
        'A ballade tells a story in sound, like a sung ballad. It is usually in a lilting six-time, and its music changes as the story unfolds. This study begins quietly, grows through the middle and settles at the end; many famous ballades end in a storm instead.',
        'Compound metre has two main beats in a bar, each one divided into three. In 6/8 you count one-and-a, two-and-a, with the first of each group of three slightly stronger. That gentle three-in-a-beat feel is what gives this study its flowing swing.',
        'Keep the accompaniment even and soft so the melody can rise above it. Save your biggest sound for the middle, and let the ending be quieter than the opening: a story that lands softly is easier to hear.'
      ],
      tip: 'Feel each bar as two groups of three, not six equal notes. The two main beats carry the shape.',
      items: [
        ballade('melody', 'A ballade study, right hand', 'piece', { notes: seq(BAL_R), tempo: 96, hand: 'right', timeSignature: '6/8' }, { accuracy: 0.8 }),
        ballade('both', 'A ballade study, both hands', 'piece', { tracks: { right: seq(BAL_R), left: seq(BAL_L) }, tempo: 92, timeSignature: '6/8' }, { accuracy: 0.75 }),
        ballade('rhythm', 'Tap two bars in 6/8', 'rhythm', { pattern: [1, 1, 1, 1, 1, 1, 2, 1, 2, 1], tempo: 192, timeSignature: '6/8' }, { accuracy: 0.8 }),
        ballade('theory-metre', 'Counting in 6/8', 'theory', { q: 'In 6/8, how many main beats does a bar have, and how does each one divide?', options: ['Three beats, each divided into two', 'Two beats, each divided into three', 'Six beats of equal weight', 'Four beats with two light ones'], answer: 1, why: '6/8 is compound duple: two main beats in a bar, each one divided into three eighth notes.' }, { accuracy: 1 }),
        ballade('theory-form', 'What a ballade does', 'theory', { q: 'What is a ballade for the piano?', options: ['A piece that tells a story in sound, often in a lilting six-time', 'A dance in quick two-time', 'A study in scales', 'A slow movement in sonata form'], answer: 0, why: 'A Romantic ballade is a narrative piece, often in 6/8 or 6/4. Its mood changes as the story unfolds, and many end dramatically.' }, { accuracy: 1 }),
        ballade('ear', 'Hear the interval', 'ear', { kind: 'interval', intervals: [2, 3, 4, 5, 7, 9, 12], rounds: 10 }, { accuracy: 0.8 })
      ],
      pass: { minItemsDone: 4 }
    },
    {
      id: 'l8-sonata-movement', title: 'A dance movement in a sonata', minutes: 17,
      goal: 'Play a minuet and trio movement with the same steady pulse in every section, from the first bar to the last.',
      teach: [
        'A Classical sonata is a large work made of several movements, and a dance movement often sits in the middle. Its shape is a minuet, a contrasting trio, then the minuet again. Each part is short, but the whole movement asks for a steady pulse from beginning to end.',
        'The trio often moves to a related key, or changes mode, and always brings a new mood, so it must not sound like a repeat. Play it a touch differently in colour, but keep the same speed, or the movement will fall apart when the minuet comes back.',
        'Playing a whole movement is a test of steadiness and memory rather than of any single bar. Learn the sections in order, join them slowly, and let each four-bar phrase answer the one before it. Keep the left hand firm on the first beat.'
      ],
      tip: 'Mark the end of every phrase with a small lift of the hand. Sections are easier to join when each one has a clear finish.',
      diagram: { type: 'staff', clef: 'treble', notes: [{ p: 79 }, { p: 74 }, { p: 71 }, { p: 67 }] },
      items: [
        sonata('menuet-r', 'A minuet movement, right hand', 'piece', { notes: seq(MENUET_R), tempo: 112, hand: 'right', timeSignature: '3/4' }, { accuracy: 0.8 }),
        sonata('menuet', 'A minuet movement, both hands', 'piece', { tracks: { right: seq(MENUET_R), left: seq(MENUET_L) }, tempo: 104, timeSignature: '3/4' }, { accuracy: 0.75 }),
        sonata('trio', 'The trio, both hands', 'piece', { tracks: { right: seq(TRIO_R), left: seq(TRIO_L) }, tempo: 104, timeSignature: '3/4' }, { accuracy: 0.75 }),
        sonata('echo', 'Echo the closing phrase', 'echo', { notes: seq('D5:2 G5 A5:2 F#5 G5:3'), tempo: 104, hand: 'right', rounds: 3 }, { accuracy: 0.8 }),
        sonata('rhythm', 'Tap a dotted bar in three', 'rhythm', { pattern: [1.5, 0.5, 1, 1.5, 0.5, 1], tempo: 108, timeSignature: '3/4' }, { accuracy: 0.8 }),
        sonata('theory', 'Minuet and trio', 'theory', { q: 'In a movement marked minuet and trio, what is played after the trio?', options: ['A second trio', 'The minuet again', 'Nothing, the movement ends there', 'The trio again, twice as fast'], answer: 1, why: 'The trio is a contrasting middle section, and after it the minuet returns to close the movement.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 4 }
    },
    {
      id: 'l8-reading-and-listening', title: 'Reading and listening: keys, form and ornaments', minutes: 14,
      goal: 'Spot a move to the dominant, tell binary from ternary form, name three ornaments, and read new lines in D and F.',
      teach: [
        'Music rarely stays in one key for long. The most common move is to the dominant, the key a fifth above: a piece in C major turns into G major for a while. The sign is the new leading tone, F sharp, which leans up to G.',
        'Pieces are built from sections. Two sections make binary form: the first moves away from the tonic, the second brings the music home. When a third section returns to the opening idea, the shape is ternary, A B A.',
        'Ornaments decorate single notes. A trill alternates a note quickly with the note above it; a mordent touches the neighbour note and returns at once; a turn circles around the note, above, back, below, back again. Play them lightly and in time.'
      ],
      tip: 'Read the key signature before the first note and watch for accidentals that are not in it: they usually mark the moment the music changes key.',
      items: [
        reading('theory-mod', 'Moving to the dominant', 'theory', { q: 'A piece in C major starts using F sharp and begins to settle on G. What has happened?', options: ['It has changed to 6/8', 'It has modulated to the dominant', 'It has become a rondo', 'It has come to an end'], answer: 1, why: 'G is a fifth above C, the dominant, and the new F sharp is the leading tone of G major.' }, { accuracy: 1 }),
        reading('theory-form', 'Two sections', 'theory', { q: 'A piece has two sections: the first moves away from the tonic, the second brings the music home. Which form is that?', options: ['Ternary form', 'Binary form', 'Rondo form', 'Theme and variations'], answer: 1, why: 'Two sections, A and B, make binary form; a third section repeating the first would make it ternary.' }, { accuracy: 1 }),
        reading('theory-orn', 'Names of ornaments', 'theory', { q: 'Which ornament alternates a note quickly with the note above it?', options: ['A mordent', 'A trill', 'A turn', 'A tie'], answer: 1, why: 'A trill alternates the written note with the note above it; a mordent touches the neighbour note and returns, and a turn circles the note.' }, { accuracy: 1 }),
        reading('game', 'Read the Bass', 'notegame', { game: 'read-bass', rounds: 18 }, { accuracy: 0.8 }),
        reading('sight-r', 'Sight-read a line in D', 'sight', { range: [60, 79], hand: 'right', key: 'D', length: 4 }, { accuracy: 0.7 }),
        reading('sight-l', 'Sight-read a bass line in F', 'sight', { range: [41, 64], hand: 'left', key: 'F', length: 4 }, { accuracy: 0.7 })
      ],
      pass: { minItemsDone: 4 }
    }
  ],
  exam: {
    id: 'l8-exam', title: 'Level 8 check-up', passPercent: 80, minTaskPercent: 65,
    items: [
      exam('technique', 'C major scale, hands together', 'scale', { tb: { type: 'scale', tonic: 0, hand: 'both' } }, { accuracy: 0.85 }),
      exam('minor', 'A harmonic minor, right hand', 'scale', { tb: { type: 'harmonic', tonic: 9, hand: 'right' } }, { accuracy: 0.85 }),
      exam('sevenths', 'The leading-tone seventh, broken', 'piece', { notes: seq(DIM7_R), tempo: 72, hand: 'right' }, { accuracy: 0.8 }),
      exam('two-voice', 'A two-voice study, both hands', 'piece', { tracks: { right: seq(INV_R), left: seq(INV_L) }, tempo: 66 }, { accuracy: 0.75 }),
      exam('minuet', 'A minuet movement, both hands', 'piece', { tracks: { right: seq(MENUET_R), left: seq(MENUET_L) }, tempo: 100, timeSignature: '3/4' }, { accuracy: 0.75 }),
      exam('sight', 'Sight-reading in G', 'sight', { range: [64, 81], hand: 'right', key: 'G', length: 4 }, { accuracy: 0.7 }),
      exam('ear', 'Hear the interval', 'ear', { kind: 'interval', intervals: [2, 3, 4, 5, 7, 9, 12], rounds: 5 }, { accuracy: 0.8 }),
      exam('theory', 'How the leading-tone seventh resolves', 'theory', { q: 'Where does the leading tone of C go when a diminished seventh chord resolves?', options: ['Down to A flat', 'Up a half step to C', 'Up a whole step to D', 'Down to G'], answer: 1, why: 'The leading tone B rises a half step to the tonic C, while the seventh above it falls a half step to G.' }, { accuracy: 1 })
    ]
  }
}
