// Level 12: Advanced II. Every lesson text, quiz question and every inline study in this file is
// original, written for this course as note lists. The registered library pieces are named by their
// library id (renderer/songs-mutopia.js); nothing is copied from any score, edition or arrangement,
// and no melody from a known work is quoted. The level assumes an 88-key keyboard: the studies reach
// down to A1 and up to B5, and the registered works are advanced repertoire.
import { seq, itemsFor } from '../builders.js'

const storm = itemsFor('l12-storm-and-recitative')
const vars = itemsFor('l12-theme-and-variations')
const fugue = itemsFor('l12-fugue-texture')
const song = itemsFor('l12-chopin-song')
const waltz = itemsFor('l12-chopin-waltz')
const char = itemsFor('l12-grieg-character')
const colour = itemsFor('l12-debussy-colour')
const read = itemsFor('l12-reading-and-listening')
const recap = itemsFor('l12-recital-and-memory')
const exam = itemsFor('l12-exam')

// Registered public-domain works from the library (ids in renderer/songs-mutopia.js).
const TEMPEST = 'beethoven-tempest-1'
const APPASSIONATA = 'beethoven-appassionata-3'
const RAINDROP = 'chopin-raindrop'
const MINUTE = 'chopin-minute-waltz'
const TROLDHAUGEN = 'grieg-troldhaugen'
const ARABESQUE = 'debussy-arabesque-1'
const TOCCATA = 'bach-toccata-bwv910'
const MOZART_C_MINOR = 'mozart-sonata-457-1'
const INTERMEZZO = 'brahms-intermezzo-118-2'

// --- Lesson 1: a slow recitative in D minor over a held bass (three bars of 4/4, 12 beats) and a
// four-bar agitated study in D minor (4/4, 16 beats) over an even left hand. ---
const RECIT_R = 'A3 C#4 E4 A4 A4 E4 C#4 A3 D4:4'
const RECIT_L = 'A1:4 A1:4 D2:4'
const STORM_R = 'D4:0.25 F4:0.25 A4:0.25 D5:0.25 D4:0.25 F4:0.25 A4:0.25 D5:0.25 D4:0.25 F4:0.25 A4:0.25 D5:0.25 D4:0.25 F4:0.25 A4:0.25 D5:0.25 '
  + 'A3:0.25 C#4:0.25 E4:0.25 A4:0.25 A3:0.25 C#4:0.25 E4:0.25 A4:0.25 A3:0.25 C#4:0.25 E4:0.25 A4:0.25 A3:0.25 C#4:0.25 E4:0.25 A4:0.25 '
  + 'Bb3:0.25 D4:0.25 F4:0.25 Bb4:0.25 Bb3:0.25 D4:0.25 F4:0.25 Bb4:0.25 Bb3:0.25 D4:0.25 F4:0.25 Bb4:0.25 Bb3:0.25 D4:0.25 F4:0.25 Bb4:0.25 '
  + 'A3:0.25 C#4:0.25 E4:0.25 A4:0.25 A3:0.25 C#4:0.25 E4:0.25 A4:0.25 A3:0.25 C#4:0.25 E4:0.25 A4:0.25 A3:1'
const STORM_L = 'D3:2 A2:2 A2:2 E3:2 Bb2:2 F3:2 A2:2 C#3:2'

// --- Lesson 2: a theme in F minor (4/4, eight bars, 32 beats), a first variation that keeps the
// melody over broken chords in the left hand, and a second variation that runs in sixteenth notes
// over accented bass notes. Harmony per bar: F, F, D flat, C, F, D flat-C, F, F. ---
const THEME_R = 'C5:1 Db5:1 C5:1 Bb4:1 Ab4:2 F4:2 Ab4:1 Bb4:1 C5:1 Db5:1 C5:4 '
  + 'C5:1 Db5:1 C5:1 Bb4:1 Ab4:2 E4:2 F4:3 r:1 F4:2 C4:2'
const THEME_L = 'F2:2 C3:2 F2:2 C3:2 Db3:2 Ab2:2 C3:2 G2:2 F2:2 C3:2 Db3:2 C3:2 F2:2 C3:2 F2:4'
const VAR1_L = 'F3:0.5 Ab3:0.5 F3:0.5 Ab3:0.5 F3:0.5 Ab3:0.5 F3:0.5 Ab3:0.5 '
  + 'F3:0.5 Ab3:0.5 F3:0.5 Ab3:0.5 F3:0.5 Ab3:0.5 F3:0.5 Ab3:0.5 '
  + 'Db3:0.5 F3:0.5 Db3:0.5 F3:0.5 Db3:0.5 F3:0.5 Db3:0.5 F3:0.5 '
  + 'C3:0.5 E3:0.5 C3:0.5 E3:0.5 C3:0.5 E3:0.5 C3:0.5 E3:0.5 '
  + 'F3:0.5 Ab3:0.5 F3:0.5 Ab3:0.5 F3:0.5 Ab3:0.5 F3:0.5 Ab3:0.5 '
  + 'Db3:0.5 F3:0.5 Db3:0.5 F3:0.5 C3:0.5 E3:0.5 C3:0.5 E3:0.5 '
  + 'F3:0.5 Ab3:0.5 F3:0.5 Ab3:0.5 F3:0.5 Ab3:0.5 F3:0.5 Ab3:0.5 '
  + 'F3:0.5 Ab3:0.5 F3:0.5 Ab3:0.5 F3:0.5 Ab3:0.5 F3:0.5 Ab3:0.5'
const VAR2_R = 'F4:0.25 Ab4:0.25 C5:0.25 F5:0.25 F4:0.25 Ab4:0.25 C5:0.25 F5:0.25 F4:0.25 Ab4:0.25 C5:0.25 F5:0.25 F4:0.25 Ab4:0.25 C5:0.25 F5:0.25 '
  + 'Db4:0.25 F4:0.25 Ab4:0.25 Db5:0.25 Db4:0.25 F4:0.25 Ab4:0.25 Db5:0.25 Db4:0.25 F4:0.25 Ab4:0.25 Db5:0.25 Db4:0.25 F4:0.25 Ab4:0.25 Db5:0.25 '
  + 'C4:0.25 E4:0.25 G4:0.25 C5:0.25 C4:0.25 E4:0.25 G4:0.25 C5:0.25 C4:0.25 E4:0.25 G4:0.25 C5:0.25 C4:0.25 E4:0.25 G4:0.25 C5:0.25 '
  + 'F5:0.25 Eb5:0.25 Db5:0.25 C5:0.25 Db5:0.25 C5:0.25 Bb4:0.25 C5:0.25 F5:2'
const VAR2_L = 'F2:1 F3:1 F2:1 F3:1 Db2:1 Db3:1 Db2:1 Db3:1 C2:1 C3:1 C2:1 C3:1 F2:2 C3:2'

// --- Lesson 3: a two-voice fugue exposition in C, 4/4. The right hand states the subject (bars 1-2),
// the left hand enters with the answer a fourth (an eleventh) lower (bars 3-4) while the right hand
// plays the countersubject, bars 5-6 are an episode, and bars 7-8 bring the subject back over a
// free counterpoint in the lower voice. Each line lasts eight bars (32 beats). ---
const SUBJECT = 'C5:0.5 D5:0.5 E5:1 G5:2 F5:1 E5:1 D5:1 C5:1'
const ANSWER_L = 'G3:0.5 A3:0.5 B3:1 D4:2 C4:1 B3:1 A3:1 G3:1'
const COUNTER_R = 'B4:1 G4:1 F#4:2 A4:1 G4:1 F#4:1 G4:1'
const COUNTER_L = 'E3:1 C3:1 B2:2 A2:1 G2:1 G2:1 C3:1'
const EPISODE_R = 'C5:1 B4:1 A4:1 G4:1 F4:1 E4:1 D4:2'
const EPISODE_L = 'r:2 C4:1 B3:1 A3:1 G3:1 F3:2'
const FUGUE_R = `${SUBJECT} ${COUNTER_R} ${EPISODE_R} ${SUBJECT}`
const FUGUE_L = `r:8 ${ANSWER_L} ${EPISODE_L} ${COUNTER_L}`

// --- Lesson 4: a singing study in D flat major, 4/4, eight bars (32 beats), with a written-out turn
// in the last bar; then the repeating-note accompaniment on its own, four bars (16 beats). ---
const SONG_R = 'Ab4:2 F4:2 Db5:2 Ab4:2 Bb4:1 Ab4:1 Gb4:2 F4:4 Ab4:2 F4:2 Db5:2 Eb5:2 F5:1 Eb5:1 Db5:2 '
  + 'Db5:1 Eb5:0.25 Db5:0.25 C5:0.25 Db5:0.25 Ab4:2'
const SONG_L = 'Db2:2 Ab2:2 Db2:2 Ab2:2 Gb2:2 Db3:2 Db2:2 Ab2:2 Db2:2 Ab2:2 Gb2:2 Db3:2 Ab2:2 Eb3:2 Db2:4'
const DROP_L = 'Db2:2 Ab3:0.5 Ab3:0.5 Ab3:0.5 Ab3:0.5 Gb2:2 Ab3:0.5 Ab3:0.5 Ab3:0.5 Ab3:0.5 '
  + 'Ab2:2 Ab3:0.5 Ab3:0.5 Ab3:0.5 Ab3:0.5 Db2:2 Ab3:0.5 Ab3:0.5 Ab3:0.5 Ab3:0.5'

// --- Lesson 5: a waltz in A minor and a waltz in D flat major, each 3/4, eight bars (24 beats). ---
const WALTZ_A_R = 'A4:1 C5:1 E5:1 D5:2 C5:1 B4:1 C5:1 D5:1 C5:3 A4:1 C5:1 E5:1 D5:2 B4:1 G#4:1 B4:1 E5:1 A4:3'
const WALTZ_A_L = 'A2:1 E3:1 A3:1 D3:1 F3:1 A3:1 G2:1 B3:1 D4:1 C3:1 E3:1 G3:1 '
  + 'A2:1 E3:1 A3:1 D3:1 F3:1 A3:1 E2:1 E3:1 G#3:1 A2:1 E3:1 A3:1'
const WALTZ_DB_R = 'Ab4:1 Db5:1 F5:1 Eb5:2 Db5:1 C5:1 Db5:1 Eb5:1 Db5:3 '
  + 'Ab4:1 Db5:1 F5:1 Eb5:2 C5:1 Ab4:1 C5:1 Eb5:1 Db5:3'
const WALTZ_DB_L = 'Db3:1 Ab3:1 Db4:1 Ab2:1 Eb3:1 Ab3:1 Ab2:1 Eb3:1 Gb3:1 Db3:1 Ab3:1 Db4:1 '
  + 'Db3:1 Ab3:1 Db4:1 Gb2:1 Db3:1 Gb3:1 Ab2:1 Eb3:1 Ab3:1 Db3:1 Ab3:1 Db4:1'

// --- Lesson 6: a processional in D major, 4/4, eight bars (32 beats), and its quiet middle section
// in B minor, four bars (16 beats). ---
const PROC_R = 'D5:1 E5:1 F#5:1 A5:1 G5:2 F#5:2 E5:1 F#5:1 G5:1 B5:1 A5:4 '
  + 'D5:1 E5:1 F#5:1 A5:1 G5:2 E5:2 F#5:1 E5:1 D5:1 E5:1 D5:4'
const PROC_L = 'D2:2 A2:2 G2:2 D3:2 G2:2 B2:2 A2:2 E3:2 D2:2 A2:2 G2:2 D3:2 A2:2 E3:2 D2:4'
const MID_R = 'B4:2 D5:2 F#5:2 E5:2 D5:1 C#5:1 B4:2 B4:4'
const MID_L = 'B2:2 F#3:2 B2:2 G2:2 F#2:2 B2:2 B2:2 F#3:2'

// --- Lesson 7: three against two. In 6/8 the right hand keeps the two dotted-quarter beats of 6/8
// while the left hand plays three equal quarters, the duple grouping against the written triple metre.
// Four bars, twelve beats. Then parallel triads, 4/4, four bars (16 beats), over single low notes. ---
const CROSS_R = 'E5:1.5 G#5:1.5 B5:1.5 A5:1.5 G#5:1.5 E5:1.5 F#5:1.5 E5:1.5'
const CROSS_L = 'E2:1 B2:1 E3:1 B1:1 F#2:1 B2:1 E2:1 B2:1 E3:1 B1:1 E2:1 B2:1'
const PLANE_R = 'E4 G#4 B4 E5 D4 F#4 A4 D5 C4 E4 G4 C5 B3 D#4 F#4 B4'
const PLANE_L = 'E2:4 D2:4 C2:4 B1:4'

export const level12 = {
  id: 'level-12', number: 12, title: 'Advanced II', grade: 'RCM 10, post-Grade 8', keys: 88,
  blurb: 'The last level, on an 88-key keyboard: the storm of a minor-key sonata, a theme and its variations, a two-voice fugue exposition, Chopin singing lines and waltzes, Grieg and Debussy in colour, and a memorised recital piece to close the course.',
  lessons: [
    {
      id: 'l12-storm-and-recitative', title: 'A sonata storm: recitative and agitation', minutes: 20,
      goal: 'Play a slow arpeggiated opening and a fast agitated study in D minor, and know how a dramatic first movement is shaped.',
      teach: [
        'A dramatic first movement often opens slowly, in a free rhythm that sounds like speech. The right hand rolls a chord upward while the left hand holds a low note, and a fermata asks you to wait longer than the note is worth. Then the character changes and the fast music begins.',
        'In the fast section the hands move in broken chords while the harmony shifts beneath them. In D minor the music turns to the chord on the sixth degree, B flat major, then pauses on the dominant. Sudden stops are part of the drama: silence can be as loud as sound.',
        'Practise the slow bars with weight and space, then the fast bars lightly and evenly. Give the running figures a steady pulse; the storm comes from the harmony and the accents, not from rushing. The sonata in the practice list shows all of this at full size.'
      ],
      tip: 'Count the pause in the slow bar out loud. A fermata lengthens a note; it never lets the pulse wander.',
      diagram: { type: 'keys', range: [50, 69], highlight: [57, 61, 64, 69], fingers: { 57: 1, 61: 2, 64: 3, 69: 5 } },
      items: [
        storm('recit', 'The recitative, right hand', 'piece', { notes: seq(RECIT_R), tempo: 54, hand: 'right', timeSignature: '4/4' }, { accuracy: 0.8 }),
        storm('recit-both', 'The recitative, both hands', 'piece', { tracks: { right: seq(RECIT_R), left: seq(RECIT_L) }, tempo: 50, timeSignature: '4/4' }, { accuracy: 0.75 }),
        storm('storm-r', 'The agitated study, right hand', 'piece', { notes: seq(STORM_R), tempo: 88, hand: 'right', timeSignature: '4/4' }, { accuracy: 0.8 }),
        storm('storm-both', 'The agitated study, both hands', 'piece', { tracks: { right: seq(STORM_R), left: seq(STORM_L) }, tempo: 84, timeSignature: '4/4' }, { accuracy: 0.75 }),
        storm('theory', 'Holding a note longer', 'theory', { q: 'What does a fermata over a note tell you?', options: ['Hold it longer than its written value', 'Play it as short as possible', 'Repeat it', 'Play it an octave higher'], answer: 0, why: 'A fermata suspends the pulse for that note or rest: you hold it longer than written, usually about twice as long, and then go on.' }, { accuracy: 1 }),
        storm('piece', 'Tempest, 1st mvt.', 'piece', { song: TEMPEST }, { accuracy: 0.7 })
      ],
      pass: { minItemsDone: 4 }
    },
    {
      id: 'l12-theme-and-variations', title: 'Theme and variations', minutes: 22,
      goal: 'Play a quiet theme in F minor and two variations of it, keeping the harmony while the surface changes.',
      teach: [
        'A theme and variations begins with a melody, then plays it again and again with a new surface each time. The tune, the bass and the harmony stay recognisable; what changes is the figuration, the register and the speed. Counting the variations helps you keep your place.',
        'The Sonata in F minor by Beethoven, the Appassionata, has a quiet middle movement built as variations, and it runs into the stormy finale without a pause: attacca, go on at once. Its theme is in D flat major; the study below is an original theme in F minor.',
        'A variation keeps its own character but the same pulse. The first variation here keeps the melody and sets it over flowing broken chords; the second follows the theme\'s chords in a shorter, four-bar form, with the right hand running in sixteenth notes. In both, the left hand holds the harmony together.'
      ],
      tip: 'Learn the theme by heart before the variations. If you can hum it, you will hear at once when a variation leaves it.',
      diagram: { type: 'keys', range: [41, 57], highlight: [41, 44, 48], fingers: { 41: 5, 44: 3, 48: 1 } },
      items: [
        vars('theme-r', 'The theme, right hand', 'piece', { notes: seq(THEME_R), tempo: 76, hand: 'right', timeSignature: '4/4' }, { accuracy: 0.8 }),
        vars('theme-both', 'The theme, both hands', 'piece', { tracks: { right: seq(THEME_R), left: seq(THEME_L) }, tempo: 72, timeSignature: '4/4' }, { accuracy: 0.8 }),
        vars('var1', 'Variation one, both hands', 'piece', { tracks: { right: seq(THEME_R), left: seq(VAR1_L) }, tempo: 76, timeSignature: '4/4' }, { accuracy: 0.75 }),
        vars('var2', 'Variation two, both hands', 'piece', { tracks: { right: seq(VAR2_R), left: seq(VAR2_L) }, tempo: 100, timeSignature: '4/4' }, { accuracy: 0.75 }),
        vars('theory', 'What a variation keeps', 'theory', { q: 'In a theme and variations movement, what stays the same from one variation to the next?', options: ['The harmony and the shape of the phrases', 'The figuration and the register', 'The speed and the loudness', 'Nothing at all'], answer: 0, why: 'Each variation keeps the harmony and the phrase shape of the theme and changes the surface: the figuration, the register, the texture or the speed.' }, { accuracy: 1 }),
        vars('piece', 'Appassionata, finale (the movement the variations lead into)', 'piece', { song: APPASSIONATA }, { accuracy: 0.7 })
      ],
      pass: { minItemsDone: 4 }
    },
    {
      id: 'l12-fugue-texture', title: 'Fugue: the subject, the answer and the episode', minutes: 21,
      goal: 'Play a two-voice fugue exposition, enter with the answer at the right moment, and name the parts of a fugue.',
      teach: [
        'A fugue is built from one idea. The first voice states the subject alone; a second voice then enters with the same idea a fifth away, and that entry is the answer. The counterpoint that accompanies the answer is called the countersubject.',
        'Between the entries come episodes, where fragments of the subject are passed from voice to voice and moved into new keys. When the answer begins before the subject has finished, the entries overlap, and that is called a stretto. Listening for the subject is the whole art of playing a fugue.',
        'Invertible counterpoint means two lines can trade places, the upper working as well below. In this short study the lower line in bars 7-8 is a free counterpoint, written to fit the subject. Know which voice holds the subject, make each entry clear, and keep the other voice a little quieter.'
      ],
      tip: 'Count the rests before your entry out loud. A fugue comes apart at late entries, not in the fast notes.',
      diagram: { type: 'staff', clef: 'treble', notes: [{ p: 72 }, { p: 74 }, { p: 76 }, { p: 79 }] },
      items: [
        fugue('subject', 'The subject, right hand', 'piece', { notes: seq(SUBJECT), tempo: 60, hand: 'right', timeSignature: '4/4' }, { accuracy: 0.8 }),
        fugue('answer', 'The answer, left hand', 'piece', { notes: seq(ANSWER_L), tempo: 60, hand: 'left', timeSignature: '4/4' }, { accuracy: 0.8 }),
        fugue('exposition', 'The exposition, both hands', 'piece', { tracks: { right: seq(FUGUE_R), left: seq(FUGUE_L) }, tempo: 58, timeSignature: '4/4' }, { accuracy: 0.75 }),
        fugue('echo', 'Echo the opening of the subject', 'echo', { notes: seq('C5:0.5 D5:0.5 E5:1 G5:2'), tempo: 60, hand: 'right', rounds: 3 }, { accuracy: 0.8 }),
        fugue('theory-answer', 'Naming the second entry', 'theory', { q: 'A second voice enters with the subject a fifth away. What is that entry called?', options: ['The answer', 'The episode', 'The stretto', 'The countersubject'], answer: 0, why: 'The first entry states the subject; the second voice enters with the answer, normally on the dominant, a fifth above. The music that goes with it is the countersubject.' }, { accuracy: 1 }),
        fugue('theory-episode', 'What an episode does', 'theory', { q: 'What is an episode in a fugue?', options: ['A passage between entries where fragments are passed between the voices', 'The first statement of the subject', 'The last chord of the piece', 'A repeat of the whole fugue'], answer: 0, why: 'Episodes link the entries. The subject is broken into fragments, worked in imitation or in sequence, and often moved into a new key.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 4 }
    },
    {
      id: 'l12-chopin-song', title: 'Chopin: the singing line and the pedal', minutes: 20,
      goal: 'Shape a long melody in D flat major, play a written-out turn in time, and change the pedal with the harmony.',
      teach: [
        'Chopin shaped his piano melodies the way a singer shapes a phrase. The line is long, the accompaniment is widely spaced and soft, and each phrase grows to one high point before it falls. Keep the melody on top and the fingers close to the keys.',
        'The pedal is part of the sound, not an extra. Press it just after a new harmony sounds and lift it exactly when the harmony changes, so the chords never smear into one another. In a slow piece, one pedal for each harmony is usually right.',
        'The prelude in D flat major called the Raindrop keeps one note repeating softly under a flowing melody, and its middle section darkens into the minor before the opening comes back. Repetition can be the most expressive thing in a piece: keep those repeated notes even and quiet.'
      ],
      tip: 'Play the melody alone and sing it. Then add the left hand with no pedal, and only then let the pedal join the two.',
      diagram: { type: 'keys', range: [61, 68], highlight: [61, 65, 68], fingers: { 61: 1, 65: 3, 68: 5 } },
      items: [
        song('melody', 'The singing study, right hand', 'piece', { notes: seq(SONG_R), tempo: 66, hand: 'right', timeSignature: '4/4' }, { accuracy: 0.8 }),
        song('both', 'The singing study, both hands', 'piece', { tracks: { right: seq(SONG_R), left: seq(SONG_L) }, tempo: 63, timeSignature: '4/4' }, { accuracy: 0.75 }),
        song('drop', 'The repeating note, left hand', 'piece', { notes: seq(DROP_L), tempo: 66, hand: 'left', timeSignature: '4/4' }, { accuracy: 0.8 }),
        song('ear', 'Hear the interval', 'ear', { kind: 'interval', intervals: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], rounds: 10 }, { accuracy: 0.8 }),
        song('theory', 'Changing the pedal', 'theory', { q: 'A new harmony sounds while you are using the damper pedal. What keeps the sound clean?', options: ['Lift the pedal and press it again as the new harmony sounds', 'Hold the pedal down through the whole phrase', 'Press the pedal down harder', 'Play the new chord more quietly'], answer: 0, why: 'The pedal is changed with the harmony. Lifting it just as the new chord sounds clears the old chord and joins the notes of the new one.' }, { accuracy: 1 }),
        song('piece', 'Raindrop Prelude', 'piece', { song: RAINDROP }, { accuracy: 0.7 })
      ],
      pass: { minItemsDone: 4 }
    },
    {
      id: 'l12-chopin-waltz', title: 'Chopin: the waltz and tempo rubato', minutes: 19,
      goal: 'Play a waltz with a firm first beat, shape it with a little rubato, and keep the accompaniment in time.',
      teach: [
        'A waltz is in three-four. The first beat carries the bass note and the weight; the second and third strokes are light. In the left hand the pattern is a low note, then a chord, then a chord, and dancers hear that rocking shape as clearly as they hear the tune.',
        'Chopin\'s waltzes belong to the concert room rather than the ballroom. The short one in D flat major, nicknamed the Minute Waltz, is a whirl of running figures; the nickname describes its small size, not a race against the clock.',
        'Tempo rubato means stolen time. In this music the melody may lean and hurry a little while the accompaniment keeps the pulse, so the two hands breathe differently. Use it only where the phrase asks for it, and keep the left hand as steady as a conductor.'
      ],
      tip: 'Practise the melody and the accompaniment apart, then join them with the left hand in strict time. Add the rubato last.',
      diagram: { type: 'staff', clef: 'treble', notes: [{ p: 68 }, { p: 73 }, { p: 77 }] },
      items: [
        waltz('waltz-a', 'A waltz in A minor, both hands', 'piece', { tracks: { right: seq(WALTZ_A_R), left: seq(WALTZ_A_L) }, tempo: 108, timeSignature: '3/4' }, { accuracy: 0.8 }),
        waltz('waltz-db', 'A waltz in D flat major, both hands', 'piece', { tracks: { right: seq(WALTZ_DB_R), left: seq(WALTZ_DB_L) }, tempo: 104, timeSignature: '3/4' }, { accuracy: 0.75 }),
        waltz('rhythm', 'Tap two waltz bars', 'rhythm', { pattern: [1.5, 0.5, 1, 1, 0.5, 0.5, 1], tempo: 104, timeSignature: '3/4' }, { accuracy: 0.8 }),
        waltz('echo', 'Echo the opening of the waltz', 'echo', { notes: seq('Ab4:1 Db5:1 F5:1'), tempo: 104, hand: 'right', rounds: 3 }, { accuracy: 0.8 }),
        waltz('theory', 'What rubato asks for', 'theory', { q: 'What does tempo rubato mean?', options: ['The melody moves freely while the pulse underneath stays steady', 'The whole piece gets faster and faster', 'Strict, unvarying time', 'A sudden silence'], answer: 0, why: 'Rubato is stolen time: a flexible give and take in the melody while the underlying pulse, usually the left hand, keeps the beat.' }, { accuracy: 1 }),
        waltz('piece', 'Minute Waltz', 'piece', { song: MINUTE }, { accuracy: 0.7 })
      ],
      pass: { minItemsDone: 4 }
    },
    {
      id: 'l12-grieg-character', title: 'Grieg: a character piece for a celebration', minutes: 20,
      goal: 'Play a processional in D major with a contrasting minor middle section, and know what a character piece is.',
      teach: [
        'A character piece is a short work that paints one mood or scene instead of following a large form. Grieg wrote many of them under the title Lyric Pieces, and one of the best known pictures a wedding day at his home near Bergen.',
        'This piece opens like a procession: a march rhythm, firm bass notes, and a tune that rises step by step. In the middle the music turns to the minor and grows quieter and more thoughtful, and then the first music returns to close the piece.',
        'A character piece lives on contrast. The march wants a steady, weighty pulse and a firm touch; the middle section wants a softer sound and a longer breath; the return should feel like coming home. Make the difference plain from the first bar.'
      ],
      tip: 'Keep the same pulse in every section. A character piece changes its colour, not its speed.',
      diagram: { type: 'keys', range: [38, 50], highlight: [38, 45, 50], fingers: { 38: 5, 45: 2, 50: 1 } },
      items: [
        char('processional', 'The processional, both hands', 'piece', { tracks: { right: seq(PROC_R), left: seq(PROC_L) }, tempo: 100, timeSignature: '4/4' }, { accuracy: 0.8 }),
        char('middle', 'The middle section, both hands', 'piece', { tracks: { right: seq(MID_R), left: seq(MID_L) }, tempo: 72, timeSignature: '4/4' }, { accuracy: 0.8 }),
        char('echo', 'Echo the processional opening', 'echo', { notes: seq('D5:1 E5:1 F#5:1 A5:1'), tempo: 100, hand: 'right', rounds: 3 }, { accuracy: 0.8 }),
        char('ear', 'Name the chord quality', 'ear', { kind: 'chord', qualities: ['major', 'minor', 'diminished', 'augmented'], rounds: 10 }, { accuracy: 0.8 }),
        char('theory', 'What a character piece is', 'theory', { q: 'Which description fits a character piece such as one of the Lyric Pieces?', options: ['A short piano work that paints one mood or scene', 'A long work in three movements for orchestra', 'A four-voice hymn', 'A set of variations on someone else\'s theme'], answer: 0, why: 'A character piece is short and describes one mood or picture. Its title usually names the scene, and the music changes colour rather than building a large form.' }, { accuracy: 1 }),
        char('piece', 'Wedding Day at Troldhaugen', 'piece', { song: TROLDHAUGEN }, { accuracy: 0.7 })
      ],
      pass: { minItemsDone: 4 }
    },
    {
      id: 'l12-debussy-colour', title: 'Debussy: colour, and three against two', minutes: 20,
      goal: 'Play three against two with the pulse intact, and move parallel chords as a way of changing colour.',
      teach: [
        'In six-eight a bar holds two beats, each divided into three. A hemiola borrows the opposite grouping: three equal notes are played where two were expected. When one hand keeps the two dotted-quarter beats and the other plays three even notes, you hear three against two.',
        'Debussy often used chords for colour rather than for direction. Blocks of the same chord shape can move in parallel, step by step, and the ear hears a change of light rather than a progression. He also wrote with the whole-tone scale, which divides the octave into six equal steps.',
        'His Arabesque in E major floats a flowing figure under a melody, and the two rhythms rest against each other. Play it without hurry, change the pedal with each harmony, and let the sound blur just enough to glow.'
      ],
      tip: 'Tap the two-note side with your foot while the other hand plays three, slowly, before you join the hands.',
      diagram: { type: 'keys', range: [64, 71], highlight: [64, 68, 71], fingers: { 64: 1, 68: 2, 71: 3 } },
      items: [
        colour('cross', 'Three against two, both hands', 'piece', { tracks: { right: seq(CROSS_R), left: seq(CROSS_L) }, tempo: 84, timeSignature: '6/8' }, { accuracy: 0.8 }),
        colour('parallel', 'Parallel chord shapes, broken', 'piece', { tracks: { right: seq(PLANE_R), left: seq(PLANE_L) }, tempo: 72, timeSignature: '4/4' }, { accuracy: 0.75 }),
        colour('ear', 'Hear the interval', 'ear', { kind: 'interval', intervals: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], rounds: 10 }, { accuracy: 0.8 }),
        colour('sight', 'Sight-read in E', 'sight', { range: [64, 84], hand: 'right', key: 'E', length: 4 }, { accuracy: 0.7 }),
        colour('theory', 'In the time of two', 'theory', { q: 'In six-eight the bar divides into two beats of three. What happens in a hemiola?', options: ['Three equal notes are set against two, working across the metre', 'The bar loses one of its beats', 'The piece changes key', 'Both hands play exactly the same rhythm'], answer: 0, why: 'A hemiola sets three equal notes against two. In six-eight the duple grouping is played across the written triple beat, and the two groupings meet.' }, { accuracy: 1 }),
        colour('piece', 'Arabesque No. 1', 'piece', { song: ARABESQUE }, { accuracy: 0.7 })
      ],
      pass: { minItemsDone: 4 }
    },
    {
      id: 'l12-reading-and-listening', title: 'Reading and listening: intervals, form and distant keys', minutes: 18,
      goal: 'Name intervals up to an octave by their half steps, tell binary, ternary and sonata form apart, and read new lines in A major.',
      teach: [
        'An interval is the distance between two notes, measured in half steps. A minor second is one, a major second two, a minor third three, a major third four, a perfect fourth five, a tritone six and a perfect fifth seven. A major sixth is nine, a major seventh eleven, and an octave twelve.',
        'Pieces are built from sections. Two sections make binary form; three sections, with the first idea returning at the end, make ternary form, A B A. A sonata movement goes further: an exposition presents the ideas, a development works on them, and a recapitulation brings them back.',
        'Music also moves between keys. A piece in C major may turn to G major, a fifth above, or to its relative minor, A minor, which shares the same key signature. The subdominant, a fifth below, is just as close. Moving to a key a third away changes the colour of a whole section.'
      ],
      tip: 'Read the key signature before the first note and watch for accidentals that are not in it: they usually mark a change of key.',
      items: [
        read('theory-intervals', 'Counting half steps', 'theory', { q: 'How many half steps are there in a perfect fifth?', options: ['Seven', 'Five', 'Six', 'Nine'], answer: 0, why: 'A perfect fifth spans seven half steps. A perfect fourth is five, a tritone is six, and an octave is twelve.' }, { accuracy: 1 }),
        read('theory-form', 'Naming a form', 'theory', { q: 'A movement has an exposition, a development and a recapitulation. Which form is that?', options: ['Sonata form', 'Binary form', 'Ternary form', 'Rondo form'], answer: 0, why: 'Those three stages are the shape of a sonata movement. Binary form has two sections, ternary returns to the opening idea, and a rondo repeats a refrain.' }, { accuracy: 1 }),
        read('theory-fugue', 'The line against the answer', 'theory', { q: 'In a fugue the second voice enters with the answer. What is the music the first voice plays against it called?', options: ['The countersubject', 'The stretto', 'The coda', 'The pedal point'], answer: 0, why: 'The countersubject is the counterpoint that the first voice keeps going while the answer is stated. It often returns with every later entry.' }, { accuracy: 1 }),
        read('game', 'Read the Treble', 'notegame', { game: 'read-treble', rounds: 20 }, { accuracy: 0.8 }),
        read('ear', 'Hear the interval', 'ear', { kind: 'interval', intervals: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], rounds: 10 }, { accuracy: 0.8 }),
        read('sight', 'Sight-read a line in A', 'sight', { range: [57, 81], hand: 'both', key: 'A', length: 4 }, { accuracy: 0.7 })
      ],
      pass: { minItemsDone: 4 }
    },
    {
      id: 'l12-recital-and-memory', title: 'The recital: a piece from memory', minutes: 22,
      goal: 'Memorise a piece in sections, play it through without stopping, and plan a short recital programme.',
      teach: [
        'Memory is built, not hoped for. Learn a piece in small sections and name what each one does: here the theme is stated, here it is sequenced, here the phrase closes. When you can describe the piece away from the keyboard, you know it.',
        'Choose a few starting points: bars you can begin from cold. Practise beginning in the middle, not only at the first bar. If a slip happens in a performance, carry on from the next starting point instead of going back; the pulse matters more than the wrong note.',
        'A short recital programme balances two pieces: one contrapuntal or Classical, one Romantic or pictorial. Plan where you will breathe, let the last bars be as carefully shaped as the first, and play the whole programme through once for a listener before the day.'
      ],
      tip: 'Practise the ending first, and the bars just before it more than any others. An ending you trust frees the rest of the piece.',
      diagram: { type: 'hands', hand: 'both', numbers: true },
      items: [
        recap('memory', 'The singing study from memory', 'piece', { tracks: { right: seq(SONG_R), left: seq(SONG_L) }, tempo: 63, timeSignature: '4/4' }, { accuracy: 0.85 }),
        recap('echo', 'Echo the closing turn', 'echo', { notes: seq('Db5:1 Eb5:0.5 Db5:0.5 C5:1 Db5:1'), tempo: 63, hand: 'right', rounds: 3 }, { accuracy: 0.8 }),
        recap('part-one', 'A contrapuntal recital piece', 'piece', { song: TOCCATA }, { accuracy: 0.7 }),
        recap('part-two', 'A Classical recital piece', 'piece', { song: MOZART_C_MINOR }, { accuracy: 0.7 }),
        recap('theory', 'Carrying on after a slip', 'theory', { q: 'You are playing from memory and a slip happens in the middle of a phrase. What is the best thing to do in a performance?', options: ['Keep the pulse and carry on from the next starting point', 'Stop and begin the piece again', 'Repeat the bar until it is right', 'Wait for the audience to tell you the note'], answer: 0, why: 'Stopping breaks the pulse and the listeners\' attention. Starting points let you carry on, and the phrase keeps its shape.' }, { accuracy: 1 }),
        recap('intermezzo', 'Intermezzo Op. 118 No. 2', 'piece', { song: INTERMEZZO }, { accuracy: 0.7 })
      ],
      pass: { minItemsDone: 4 }
    }
  ],
  exam: {
    id: 'l12-exam', title: 'Level 12 recital check', passPercent: 80, minTaskPercent: 65,
    items: [
      exam('technique', 'F harmonic minor, hands together', 'scale', { tb: { type: 'harmonic', tonic: 5, hand: 'both' } }, { accuracy: 0.85 }),
      exam('arpeggio', 'E flat major arpeggio, right hand', 'arpeggio', { tb: { type: 'chord', tonic: 3, hand: 'right' } }, { accuracy: 0.85 }),
      exam('piece-one', 'Tempest, 1st mvt.', 'piece', { song: TEMPEST }, { accuracy: 0.7 }),
      exam('piece-two', 'Raindrop Prelude', 'piece', { song: RAINDROP }, { accuracy: 0.7 }),
      exam('fugue', 'The exposition, both hands', 'piece', { tracks: { right: seq(FUGUE_R), left: seq(FUGUE_L) }, tempo: 58, timeSignature: '4/4' }, { accuracy: 0.75 }),
      exam('variation', 'Variation two, both hands', 'piece', { tracks: { right: seq(VAR2_R), left: seq(VAR2_L) }, tempo: 96, timeSignature: '4/4' }, { accuracy: 0.8 }),
      exam('cross', 'Three against two, both hands', 'piece', { tracks: { right: seq(CROSS_R), left: seq(CROSS_L) }, tempo: 84, timeSignature: '6/8' }, { accuracy: 0.8 }),
      exam('sight', 'Sight-reading in A', 'sight', { range: [57, 81], hand: 'both', key: 'A', length: 4 }, { accuracy: 0.7 }),
      exam('ear', 'Hear the interval', 'ear', { kind: 'interval', intervals: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], rounds: 5 }, { accuracy: 0.8 }),
      exam('theory-answer', 'The answer of a fugue', 'theory', { q: 'Where does the answer of a fugue usually enter?', options: ['On the dominant, a fifth above the subject', 'On the tonic, an octave below', 'On the subdominant, a fourth above', 'On the relative minor'], answer: 0, why: 'The second voice answers on the dominant, a fifth above (or a fourth below) the subject, so the entry is heard as a copy in a new key area.' }, { accuracy: 1 }),
      exam('theory-variation', 'What a variation changes', 'theory', { q: 'In a theme and variations, what changes from one variation to the next?', options: ['The figuration, the register and the texture', 'The harmony of the theme', 'The phrase structure of the theme', 'The key of the whole movement'], answer: 0, why: 'The harmony and the phrase shape stay. Each variation dresses the same music in new figuration, a new register or a new texture, and sometimes at a new speed.' }, { accuracy: 1 })
    ]
  }
}
