// Level 3: Hands Together. All text is original. The tunes are traditional, public-domain works
// (Twinkle, Twinkle, Little Star) or short original exercises, written as note lists.
import { seq, itemsFor } from '../builders.js'

const sc1 = itemsFor('l3-scale-right')
const sc2 = itemsFor('l3-scale-left')
const mel = itemsFor('l3-melody-bass')
const tri = itemsFor('l3-triad')
const keyf = itemsFor('l3-f-major')
const dot = itemsFor('l3-dotted')
const cls = itemsFor('l3-first-classic')
const exam = itemsFor('l3-exam')

// Twinkle, Twinkle, Little Star (traditional): the opening phrase, 4/4.
const TWINKLE = 'C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2'
// Original study: a melody over held bass notes, one chord per bar.
const BELLS_R = 'C4 E4 G4:2 F4:2 A4:2 G4 E4 C4:2 C4:4'
const BELLS_L = 'C3:4 F3:4 C3:4 C3:4'
// Original tune in F major, 3/4.
const F_TUNE = 'F4 A4 Bb4 A4:2 G4 F4 G4 A4 F4:3'
// Original triple-time dance (an original exercise in the manner of a minuet), 3/4, eight bars.
const DANCE = 'C4 E4 G4 E4:2 C4 D4 F4 A4 G4:3 C4 E4 G4 F4:2 D4 E4 D4 C4 C4:3'
const DANCE_L = 'C3:3 C3:3 D3:3 G3:3 C3:3 F3:3 C3:3 C3:3'

export const level3 = {
  id: 'level-3', number: 3, title: 'Hands Together', grade: 'RCM 1, ABRSM Grade 1', keys: 24,
  blurb: 'Your first real scale, a melody over an accompaniment, the triad and a first dance in classical style.',
  lessons: [
    {
      id: 'l3-scale-right', title: 'The C major scale, right hand', minutes: 14,
      goal: 'Play one octave of the C major scale with the right hand and make the thumb pass smoothly.',
      teach: [
        'The C major scale is eight notes from C to the next C: C D E F G A B C. Unlike a five-finger position, it climbs further, and your hand has to move. Every note sits on the neighbouring white key, with no skips.',
        'Your right hand uses the finger pattern 1 2 3, then 1 2 3 4 5. After the third finger plays E, the thumb tucks under to F and the hand carries on upward. Coming down, reverse the pattern.',
        'The steps between the notes are not all the same size. Two of them, E to F and B to C, are half steps; the rest are whole steps. The full pattern is whole, whole, half, whole, whole, whole, half.'
      ],
      tip: 'Practise the thumb pass slowly on its own. A quiet, even pass is worth more than speed.',
      diagram: { type: 'keys', range: [60, 72], highlight: [60, 62, 64, 65, 67, 69, 71, 72], fingers: { 60: 1, 62: 2, 64: 3, 65: 1, 67: 2, 69: 3, 71: 4, 72: 5 } },
      items: [
        sc1('scale', 'C major scale, right hand', 'scale', { tb: { type: 'scale', tonic: 0, hand: 'right' } }, { accuracy: 0.85 }),
        sc1('theory-steps', 'Whole or half step', 'theory', { q: 'Which pair of white keys is a half step apart?', options: ['E and F', 'C and D', 'F and G', 'A and B'], answer: 0, why: 'E to F and B to C have no black key between them, so they are half steps.' }, { accuracy: 1 }),
        sc1('theory-fingers', 'The thumb pass', 'theory', { q: 'In the right-hand C major scale, which finger comes right after the third finger on E?', options: ['Thumb (1)', 'Fourth finger (4)', 'Fifth finger (5)', 'Second finger (2)'], answer: 0, why: 'The thumb passes under to F, so the pattern is 1 2 3 1 2 3 4 5.' }, { accuracy: 1 }),
        sc1('updown', 'One octave up and back', 'piece', { notes: seq('C4 D4 E4 F4 G4 A4 B4 C5 B4 A4 G4 F4 E4 D4 C4:2'), tempo: 66, hand: 'right' }, { accuracy: 0.8 })
      ],
      pass: { minItemsDone: 3 }
    },
    {
      id: 'l3-scale-left', title: 'The scale in the left hand', minutes: 12,
      goal: 'Play the C major scale with the left hand, one hand at a time.',
      teach: [
        'Your left hand plays the scale with the little finger starting on C, going up to the thumb on G, then the third finger crosses over to A. The pattern is 5 4 3 2 1, then 3 2 1.',
        'Notice the mirror. In the right hand the thumb passes under; in the left hand a finger crosses over. The notes are the same C major scale, just lower and played with the other hand.',
        'Play each hand on its own before trying anything else. Hearing the two hands separately makes each one clearer, and the shapes stay in your fingers.'
      ],
      tip: 'Right hand, then left hand, then each once more. Comparing the two hands helps each one learn the shape.',
      diagram: { type: 'keys', range: [48, 60], highlight: [48, 50, 52, 53, 55, 57, 59, 60], fingers: { 48: 5, 50: 4, 52: 3, 53: 2, 55: 1, 57: 3, 59: 2, 60: 1 } },
      items: [
        sc2('scale', 'C major scale, left hand', 'scale', { tb: { type: 'scale', tonic: 0, hand: 'left' } }, { accuracy: 0.85 }),
        sc2('theory', 'Left-hand fingering', 'theory', { q: 'In the left-hand C major scale, which finger plays the top C?', options: ['Thumb (1)', 'Fourth finger (4)', 'Little finger (5)', 'Second finger (2)'], answer: 0, why: 'The left hand climbs 5 4 3 2 1 3 2 1, so the thumb ends on the top C.' }, { accuracy: 1 }),
        sc2('echo', 'Echo: a short scale', 'echo', { notes: seq('C3 D3 E3 F3 G3'), tempo: 70, hand: 'left', rounds: 4 }, { accuracy: 0.8 }),
        sc2('updown', 'Left hand up and back', 'piece', { notes: seq('C3 D3 E3 F3 G3 A3 B3 C4 B3 A3 G3 F3 E3 D3 C3:2'), tempo: 66, hand: 'left' }, { accuracy: 0.8 })
      ],
      pass: { minItemsDone: 3 }
    },
    {
      id: 'l3-melody-bass', title: 'A melody over a held bass', minutes: 15,
      goal: 'Play a tune in the right hand while the left hand holds long notes underneath.',
      teach: [
        'In level 2 both hands moved together. Now they get different jobs: the left hand holds a long note while the right hand plays the tune. The held note is the bass, and it supports the melody above it.',
        'Start by holding one bass note and playing the tune on top. Then let the left hand change note at the start of a phrase, where the melody pauses. The bass moves far less than the melody, and that is normal.',
        'Listen to both parts as one sound. The tune should sing above the bass, so play the left hand a little softer than the right.'
      ],
      tip: 'Play the bass alone first and count its long beats out loud. Only then add the melody.',
      items: [
        mel('twinkle', 'Twinkle, Twinkle, Little Star (melody)', 'piece', { notes: seq(TWINKLE), tempo: 76, hand: 'right' }, { accuracy: 0.8 }),
        mel('bells', 'Bells, both hands', 'piece', { tracks: { right: seq(BELLS_R), left: seq(BELLS_L) }, tempo: 66 }, { accuracy: 0.75 }),
        mel('twinkle-both', 'Twinkle with a held bass', 'piece', { tracks: { right: seq(TWINKLE), left: seq('C3:4 C3:4 C3:4 C3:4') }, tempo: 72 }, { accuracy: 0.75 }),
        mel('theory', 'Which hand holds', 'theory', { q: 'In a melody over a held bass, what does the left hand usually do?', options: ['Plays fast notes', 'Holds long notes underneath', 'Plays the melody', 'Stays silent'], answer: 1, why: 'The left hand holds the bass notes while the right hand plays the tune.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 3 }
    },
    {
      id: 'l3-triad', title: 'The C triad', minutes: 13,
      goal: 'Build and play the chord C E G, blocked and broken, and hear a major triad.',
      teach: [
        'A triad is a chord of three notes built in skips. Start on the root, skip a note, then skip another: C, E, G. These are the first, third and fifth notes of the C major scale.',
        'The distance from C up to E is a major third, and from E up to G is a minor third. Major third below, minor third above makes a major triad, bright and settled. Swap them, minor below and major above, as in A C E, and you get a darker minor triad.',
        'You can play the three notes together, which is called blocked, or one after another, which is broken and also called an arpeggio. Blocked gives a full sound; broken lets each note ring on its own.'
      ],
      tip: 'Play the blocked chord softly and evenly. A comfortable hand makes a full, round sound.',
      items: [
        tri('broken', 'Broken triad', 'arpeggio', { tb: { type: 'chord', tonic: 0, hand: 'right' } }, { accuracy: 0.8 }),
        tri('ear', 'Major or minor?', 'ear', { kind: 'chord', rounds: 10 }, { accuracy: 0.8 }),
        tri('theory', 'Building a triad', 'theory', { q: 'A triad is built from which notes of the scale?', options: ['1, 3 and 5', '1, 2 and 3', '1, 4 and 7', '2, 4 and 6'], answer: 0, why: 'A triad stacks the root, third and fifth of the scale in skips.' }, { accuracy: 1 }),
        tri('theory2', 'C up to E', 'theory', { q: 'What is the interval from C up to E?', options: ['Major third', 'Minor third', 'Perfect fifth', 'Perfect fourth'], answer: 0, why: 'C to E spans two whole steps, which is a major third.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 3 }
    },
    {
      id: 'l3-f-major', title: 'The key of F', minutes: 14,
      goal: 'Play the F major scale and five-finger position, and understand the flat in the key signature.',
      teach: [
        'F major starts on F: F G A Bb C D E F. To keep the major pattern of whole and half steps, one note is lowered: B becomes B flat, the black key just left of B.',
        'The key signature of F major has a single flat, B flat. A key signature is written at the start of the music and tells you which notes to play flat throughout, so you do not write the flat on every single B.',
        'In the five-finger F position the thumb rests on F and finger 4 plays B flat. The F major scale uses a different fingering from C: 1 2 3 4 on F G A B flat, thumb under to C, then 1 2 3 4. The thumb never lands on the black key.'
      ],
      tip: 'Say "F, and B flat" before you start, so your ear expects the lowered note.',
      diagram: { type: 'keys', range: [65, 72], highlight: [65, 67, 69, 70, 72], fingers: { 65: 1, 67: 2, 69: 3, 70: 4, 72: 5 } },
      items: [
        keyf('position', 'Five-finger F, right hand', 'five-finger', { tb: { type: 'five', tonic: 5, hand: 'right' } }, { accuracy: 0.8 }),
        keyf('scale', 'F major scale, right hand', 'scale', { tb: { type: 'scale', tonic: 5, hand: 'right' } }, { accuracy: 0.85 }),
        keyf('theory', 'The flat in F', 'theory', { q: 'Which note is flattened in the key of F major?', options: ['B', 'E', 'A', 'F'], answer: 0, why: 'F major has one flat in its key signature: B flat.' }, { accuracy: 1 }),
        keyf('piece', 'A tune in F', 'piece', { notes: seq(F_TUNE), tempo: 72, hand: 'right', timeSignature: '3/4' }, { accuracy: 0.8 }),
        keyf('echo', 'Echo in F', 'echo', { notes: seq('F4 G4 A4 Bb4'), tempo: 70, hand: 'right', rounds: 4 }, { accuracy: 0.8 })
      ],
      pass: { minItemsDone: 3 }
    },
    {
      id: 'l3-dotted', title: 'Dotted notes, ties and pick-ups', minutes: 13,
      goal: 'Count a dotted quarter, play tied notes as one long note, and start a piece on a pick-up.',
      teach: [
        'A dot after a note adds half of its length. A dotted quarter is one beat plus half a beat, so it lasts one and a half beats. It lands on the beat and holds through the "and".',
        'A tie is a curved line joining two notes of the same pitch. You play the first note and hold it through the value of the second, so the two sound as one longer note with no break.',
        'Some pieces begin before the first full bar with one or more notes called a pick-up, or anacrusis. Count those notes as the last beats of a bar you have not heard yet, so the first strong beat still lands in the right place.'
      ],
      tip: 'For a one-beat pick-up in 3/4, count "one, two" silently and play the pick-up on "three". The next note is beat one of the first full bar.',
      items: [
        dot('tap', 'Tap a dotted rhythm', 'rhythm', { pattern: [1.5, 0.5, 1, 1], tempo: 84, timeSignature: '4/4' }, { accuracy: 0.8 }),
        dot('tap2', 'Tap with a tie', 'rhythm', { pattern: [1, 1, 1, 2, 1, 1, 1], tempo: 84, timeSignature: '4/4' }, { accuracy: 0.8 }),
        dot('theory', 'Dotted quarter', 'theory', { q: 'How long does a dotted quarter note last?', options: ['One beat', 'One and a half beats', 'Two beats', 'Three beats'], answer: 1, why: 'The dot adds half the note\'s length: a quarter note (1 beat) plus half a beat is 1.5 beats.' }, { accuracy: 1 }),
        dot('theory2', 'What a tie does', 'theory', { q: 'What does a tie between two notes of the same pitch tell you?', options: ['Play both notes quickly', 'Hold the first through the value of the second', 'Play the second louder', 'Skip the second note'], answer: 1, why: 'A tie joins the two into one longer sound, held without a break.' }, { accuracy: 1 }),
        dot('piece', 'A tune with a pick-up', 'piece', { notes: seq('r:2 G4 C4 D4 E4 F4 G4:2 F4 E4 D4 C4:3'), tempo: 76, hand: 'right', timeSignature: '3/4' }, { accuracy: 0.8 })
      ],
      pass: { minItemsDone: 3 }
    },
    {
      id: 'l3-first-classic', title: 'A dance in classical style', minutes: 15,
      goal: 'Shape the phrases of a gentle triple-time dance and play it with both hands.',
      teach: [
        'A phrase is a short musical sentence, usually two or four bars long. It rises and falls like a spoken line. Notice where a phrase ends: it often comes to rest on a longer note before the next one begins.',
        'This little dance is in 3/4, the metre of a minuet. Count one strong beat followed by two lighter ones, over and over, like a slow, dignified step. Let the first beat of each bar feel a little heavier.',
        'Play the right hand first and sing the shape of each phrase. Then add the left hand, which holds one bass note per bar. Keep the bass calm and even so the melody can breathe.'
      ],
      tip: 'Between phrases, lift your hand gently as if taking a breath. The smallest pause marks the end of a sentence.',
      items: [
        cls('melody', 'Dance, right hand', 'piece', { notes: seq(DANCE), tempo: 96, hand: 'right', timeSignature: '3/4' }, { accuracy: 0.8 }),
        cls('both', 'Dance, both hands', 'piece', { tracks: { right: seq(DANCE), left: seq(DANCE_L) }, tempo: 88, timeSignature: '3/4' }, { accuracy: 0.75 }),
        cls('echo', 'Echo a phrase', 'echo', { notes: seq('C4 E4 G4 E4:2 C4'), tempo: 80, hand: 'right', rounds: 3 }, { accuracy: 0.8 }),
        cls('theory', 'Feeling the bar', 'theory', { q: 'In a minuet in 3/4, which beat of the bar feels strongest?', options: ['The first', 'The second', 'The third', 'None of them'], answer: 0, why: '3/4 is a dance metre with a strong first beat and two lighter beats after it.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 3 }
    }
  ],
  exam: {
    id: 'l3-exam', title: 'Level 3 check-up', passPercent: 80, minTaskPercent: 65,
    items: [
      exam('scale', 'C major scale, right hand', 'scale', { tb: { type: 'scale', tonic: 0, hand: 'right' } }, { accuracy: 0.85 }),
      exam('piece', 'A tune in F', 'piece', { notes: seq(F_TUNE), tempo: 76, hand: 'right', timeSignature: '3/4' }, { accuracy: 0.8 }),
      exam('both', 'Dance, both hands', 'piece', { tracks: { right: seq(DANCE), left: seq(DANCE_L) }, tempo: 88, timeSignature: '3/4' }, { accuracy: 0.8 }),
      exam('sight', 'Sight-reading in C', 'sight', { range: [60, 67], hand: 'right', key: 'C', length: 2 }, { accuracy: 0.7 }),
      exam('ear', 'Major or minor', 'ear', { kind: 'chord', rounds: 5 }, { accuracy: 0.8 }),
      exam('rhythm', 'Tap a dotted rhythm', 'rhythm', { pattern: [1.5, 0.5, 2, 1.5, 0.5, 2], tempo: 84, timeSignature: '4/4' }, { accuracy: 0.8 }),
      exam('theory', 'Key of F', 'theory', { q: 'How many flats are in the key signature of F major?', options: ['None', 'One', 'Two', 'Three'], answer: 1, why: 'F major has one flat, B flat.' }, { accuracy: 1 })
    ]
  }
}
