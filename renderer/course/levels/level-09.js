// Level 9: Upper Intermediate. All lesson text, quiz questions, diagrams and every inline study in
// this file are original, written for this course as note lists. Every inline note stays inside
// C2-C7 (36-96), the span of a 61-key keyboard, and every bar adds up to the metre named beside it.
// Three items point at registered library works (ids in renderer/songs-mutopia.js); nothing is copied
// from any score, edition, arrangement or method book.
import { seq, itemsFor } from '../builders.js'

const four = itemsFor('l9-four-note-chords')
const rep = itemsFor('l9-repeated-notes')
const voic = itemsFor('l9-voicing')
const cant = itemsFor('l9-cantabile')
const cpt = itemsFor('l9-counterpoint')
const sonf = itemsFor('l9-sonata-first-movement')
const orn = itemsFor('l9-ornaments')
const read = itemsFor('l9-reading-and-listening')
const exam = itemsFor('l9-exam')

// Registered public-domain works in the library, named by their library id.
const FUR_ELISE = 'beethoven-fur-elise-full'
const TRAUMEREI = 'schumann-traumerei'
const INVENTION13 = 'bach-invention-13'

// --- Lesson 1: four-note chords, blocked and broken, in C. Each bar is 4/4 (four beats). ---
// Right hand, C on up to C5 and back, then F, G and C again: one bar per harmony.
const CH4_R = 'C4:0.5 E4:0.5 G4:0.5 C5:0.5 G4:0.5 E4:0.5 C4:1 ' +
  'F4:0.5 A4:0.5 C5:0.5 F5:0.5 C5:0.5 A4:0.5 F4:1 ' +
  'G4:0.5 B4:0.5 D5:0.5 G5:0.5 D5:0.5 B4:0.5 G4:1 ' +
  'C4:0.5 E4:0.5 G4:0.5 C5:0.5 G4:0.5 E4:0.5 C4:1'
// The same four-note chords an octave lower in the left hand.
const CH4_L = 'C3:0.5 E3:0.5 G3:0.5 C4:0.5 G3:0.5 E3:0.5 C3:1 ' +
  'F3:0.5 A3:0.5 C4:0.5 F4:0.5 C4:0.5 A3:0.5 F3:1 ' +
  'G2:0.5 B2:0.5 D3:0.5 G3:0.5 D3:0.5 B2:0.5 G2:1 ' +
  'C3:0.5 E3:0.5 G3:0.5 C4:0.5 G3:0.5 E3:0.5 C3:1'
// One root held through each bar, for the left hand under the broken chords.
const CH4_BASS = 'C3:4 F3:4 G2:4 C3:4'

// --- Lesson 2: repeated notes over a changing left hand, A minor, 4/4, four bars. ---
const REP_R = 'A4:0.5 A4:0.5 A4:0.5 B4:0.5 C5:0.5 C5:0.5 B4:0.5 A4:0.5 ' +
  'E5:0.5 E5:0.5 E5:0.5 D5:0.5 C5:0.5 D5:0.5 E5:1 ' +
  'F5:0.5 F5:0.5 F5:0.5 E5:0.5 D5:0.5 C5:0.5 B4:0.5 A4:0.5 ' +
  'A4:1 G#4:1 A4:2'
// The same music an octave lower, with the harmony moving: A minor, A minor, F to G, A minor.
const REP_L = 'A2:1 E3:1 A2:1 E3:1 A2:1 E3:1 E2:1 E3:1 ' +
  'F2:1 C3:1 G2:1 D3:1 A2:1 E3:1 A2:2'

// --- Lesson 3: a singing melody over a soft broken-chord accompaniment, F major, 4/4, four bars. ---
const VOICE_R = 'C5:1 A4:0.5 C5:0.5 F5:1 E5:1 D5:1 C5:1 Bb4:2 ' +
  'C5:1 D5:0.5 C5:0.5 A4:1 G4:1 A4:1 G4:1 F4:2'
const VOICE_L = 'F3:0.5 C4:0.5 A3:0.5 C4:0.5 F3:0.5 C4:0.5 A3:0.5 C4:0.5 ' +
  'Bb2:0.5 F3:0.5 D4:0.5 F3:0.5 Bb2:0.5 F3:0.5 D4:0.5 F3:0.5 ' +
  'C3:0.5 G3:0.5 E3:0.5 G3:0.5 C3:0.5 G3:0.5 E3:0.5 G3:0.5 ' +
  'F3:0.5 C4:0.5 A3:0.5 C4:0.5 F3:0.5 C4:0.5 A3:0.5 C4:0.5'

// --- Lesson 4: a cantabile study in F major, 4/4, four bars, one harmony per bar for the pedal. ---
const CANT_R = 'F4:2 A4:1 C5:1 Bb4:2 A4:2 G4:1 A4:1 Bb4:2 A4:4'
const CANT_L = 'F3:2 C4:2 Bb3:2 D4:2 C3:2 G3:2 F3:2 C4:2'

// --- Lesson 5: two voices that answer each other, A minor, 4/4, four bars. The left hand waits
// two beats, then enters with the shape of the opening idea, an octave lower. ---
const CP_R = 'A4:0.5 B4:0.5 C5:0.5 B4:0.5 A4:0.5 G#4:0.5 A4:1 ' +
  'B4:0.5 C5:0.5 D5:0.5 C5:0.5 B4:1 A4:1 ' +
  'E5:0.5 D5:0.5 C5:0.5 B4:0.5 C5:0.5 D5:0.5 C5:1 ' +
  'B4:2 A4:2'
const CP_L = 'r:2 A3:0.5 B3:0.5 C4:0.5 B3:0.5 A3:0.5 G#3:0.5 A3:1 ' +
  'B3:0.5 C4:0.5 D4:0.5 C4:0.5 B3:2 A3:2 ' +
  'E3:2 A3:2'

// --- Lesson 6: a first-movement study in C, 4/4, eight bars. Bars 1 to 4 are the first idea in C;
// bars 5 to 8 are the second idea, which moves to G with F sharp and closes there. ---
const SON_R = 'E5:1 D5:1 C5:2 D5:1 E5:1 F5:2 G5:1 E5:1 C5:2 D5:2 C5:2 ' +
  'F#5:1 G5:1 A5:2 B5:1 A5:1 G5:2 A5:1 G5:1 F#5:1 D5:1 G5:4'
const SON_L = 'C3:1 G3:1 E3:1 G3:1 C3:1 G3:1 F3:1 A3:1 C3:1 G3:1 E3:1 G3:1 G2:1 D3:1 G2:1 B2:1 ' +
  'D3:1 A3:1 F#3:1 A3:1 G2:1 D3:1 G2:1 B2:1 D3:1 A3:1 D3:1 F#3:1 G2:1 D3:1 G2:1 D3:1'

// --- Lesson 7: ornaments written out as ordinary notes, G major, 4/4, four bars. Bar 1 and bar 3
// write a trill out in sixteenth notes; bar 2 writes a turn on D5; bar 4 closes the phrase. ---
const TR_R = 'A4:0.25 B4:0.25 A4:0.25 B4:0.25 A4:0.25 B4:0.25 A4:0.25 B4:0.25 G4:2 ' +
  'E5:0.25 D5:0.25 C5:0.25 D5:0.25 E5:1 D5:1 B4:1 ' +
  'G4:0.25 A4:0.25 G4:0.25 A4:0.25 G4:0.25 A4:0.25 G4:0.25 A4:0.25 F#4:2 ' +
  'G4:1 A4:0.5 B4:0.5 A4:0.5 F#4:0.5 G4:1'
const TR_L = 'G2:2 B2:2 D3:2 F#3:2 D3:2 A3:2 G2:2 B2:2'

export const level9 = {
  id: 'level-9', number: 9, title: 'Upper Intermediate', grade: 'RCM 7, ABRSM Grade 6', keys: 88,
  blurb: 'Level 9 works on a 61-key keyboard for the studies; two library pieces (a famous bagatelle and a Schumann miniature) reach beyond 61 keys, so a full-size keyboard shows them best. Four-note chords and arpeggios in both hands, repeated-note control, voicing, a singing line, two-voice counterpoint, ornaments and the shape of a sonata first movement.',
  lessons: [
    {
      id: 'l9-four-note-chords', title: 'Four-note chords and arpeggios in both hands', minutes: 17,
      goal: 'Play four-note chords blocked and broken in each hand, a cadence in two keys, and the C major arpeggio with the hands together.',
      teach: [
        'Your chords have held three notes so far. Add the octave above the root and you have four, which sounds fuller and steadier. In C they are C, E, G and the C above. Play them 1, 2, 3, 5 in the right hand, 5, 3, 2, 1 in the left.',
        'An inversion moves the lowest note of a chord up an octave, so a different note sits in the bass. Root position puts the root at the bottom, first inversion the third, and second inversion the fifth. The notes never change, only their order.',
        'With four notes you can also keep the left hand near the middle of the keyboard: choose each chord in the nearest position, so the bass moves by a step or a small skip instead of jumping about. Play every chord softly and evenly.',
        'This lesson gives you the cadence, the same chords broken into single notes, and the arpeggio in both hands. Play each chord blocked first, then open it out.'
      ],
      tip: 'Say the lowest note of each chord out loud. The bass note tells you which position you are playing.',
      diagram: { type: 'keys', range: [60, 72], highlight: [60, 64, 67, 72], fingers: { 60: 1, 64: 2, 67: 3, 72: 5 } },
      items: [
        four('cad-c', 'I-IV-V-I in C, hands together', 'chord', { tb: { type: 'cadence', tonic: 0, hand: 'both' } }, { accuracy: 0.85 }),
        four('cad-g', 'I-IV-V-I in G, left hand', 'chord', { tb: { type: 'cadence', tonic: 7, hand: 'left' } }, { accuracy: 0.8 }),
        four('arp-both', 'C major arpeggio, hands together', 'arpeggio', { tb: { type: 'chord', tonic: 0, hand: 'both' } }, { accuracy: 0.8 }),
        four('broken-l', 'Four-note chords, broken, left hand', 'piece', { notes: seq(CH4_L), tempo: 66, hand: 'left', timeSignature: '4/4' }, { accuracy: 0.8 }),
        four('broken-both', 'Broken four-note chords over a held bass', 'piece', { tracks: { right: seq(CH4_R), left: seq(CH4_BASS) }, tempo: 63, timeSignature: '4/4' }, { accuracy: 0.75 }),
        four('theory', 'Where the note sits', 'theory', { q: 'Which note is in the bass in the first inversion of a triad?', options: ['The third', 'The root', 'The fifth', 'The octave'], answer: 0, why: 'First inversion lifts the root an octave, so the third becomes the lowest note.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 4 }
    },
    {
      id: 'l9-repeated-notes', title: 'Repeated notes and a changing left hand', minutes: 19,
      goal: 'Play a long line of repeated notes with a loose hand while the left hand changes harmony, and start the set piece in the practice list.',
      teach: [
        'Repeated notes are harder than they look. Striking the same key again and again, the hand can tighten before you notice. Let each key rise all the way before you play it again, and drop into the note from a light wrist. In fast repetitions, change fingers, 3 2 1.',
        'In the piece in your practice list, the stormy middle episode has a low A repeated over and over in the left hand while the chords change above it. The repeated note stays the same; the harmony moves, and that is what shapes the phrase.',
        'The piece is a bagatelle in A minor, built as a rondo, A B A C A: the opening idea is heard three times with new music in between. Learn the returning idea first, slowly, and the rest will feel like rooms you already know.',
        'Keep the left hand light, and listen to the bass line on its own once. Notice where it changes: that is where the music moves on, and it is what makes a repeated note sound new.'
      ],
      tip: 'Play the repeated notes slowly with a completely loose hand. If the arm tightens, stop, shake out the hand, and start again more slowly.',
      diagram: { type: 'keys', range: [45, 69], highlight: [45, 48, 52, 57, 60, 64, 69] },
      items: [
        rep('melody', 'Repeated notes, right hand', 'piece', { notes: seq(REP_R), tempo: 76, hand: 'right', timeSignature: '4/4' }, { accuracy: 0.8 }),
        rep('both', 'Repeated notes with a changing left hand', 'piece', { tracks: { right: seq(REP_R), left: seq(REP_L) }, tempo: 72, timeSignature: '4/4' }, { accuracy: 0.75 }),
        rep('fur-elise', 'Für Elise, both hands', 'piece', { song: FUR_ELISE }, { accuracy: 0.7 }),
        rep('echo', 'Echo a repeated figure', 'echo', { notes: seq('A4:0.5 A4:0.5 A4:0.5 C5:0.5 B4:1'), tempo: 76, hand: 'right', rounds: 4 }, { accuracy: 0.8 }),
        rep('rhythm', 'Tap repeated eighths', 'rhythm', { pattern: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1, 1, 1, 1], tempo: 76, timeSignature: '4/4' }, { accuracy: 0.8 }),
        rep('theory', 'Why repeated notes are hard', 'theory', { q: 'What is the main risk in a long line of repeated notes?', options: ['The hand and arm tighten up', 'You forget the key signature', 'The pedal will not lift', 'The left hand speeds up'], answer: 0, why: 'Repeating one note with one finger invites tension; a loose hand and a light finger keep the repetitions even.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 3 }
    },
    {
      id: 'l9-voicing', title: 'Voicing: the tune above the accompaniment', minutes: 17,
      goal: 'Bring the melody out above a soft accompaniment, and hear which line leads in your own playing.',
      teach: [
        'When a tune and an accompaniment sound together, one of them must lead. Usually that is the top line. Let the melody ring a little louder and everything under it stay soft, and the ear will follow the tune even when the accompaniment is busy.',
        'Weight comes from the arm, not from a stiff finger. Let the arm settle gently into the melody note, and play the quieter notes with a light touch and no extra movement in the hand.',
        'Practise the balance in three steps: the melody alone; the accompaniment alone as softly as you can; then the two together with the melody on top. If the tune disappears in the last step, the accompaniment is still too loud.',
        'The same idea works inside one hand. When several notes of a chord sound at once, the top note is usually the melody. Give it the weight and keep the notes below even and quiet: that balance is called voicing.'
      ],
      tip: 'Play the piece for someone and ask which line they heard first. If they say the accompaniment, soften it and try again.',
      diagram: { type: 'hands', hand: 'both', numbers: true },
      items: [
        voic('melody', 'A singing melody, right hand', 'piece', { notes: seq(VOICE_R), tempo: 69, hand: 'right', timeSignature: '4/4' }, { accuracy: 0.8 }),
        voic('both', 'The melody above a soft accompaniment', 'piece', { tracks: { right: seq(VOICE_R), left: seq(VOICE_L) }, tempo: 66, timeSignature: '4/4' }, { accuracy: 0.75 }),
        voic('cadence-f', 'I-IV-V-I in F, hands together', 'chord', { tb: { type: 'cadence', tonic: 5, hand: 'both' } }, { accuracy: 0.8 }),
        voic('theory', 'What voicing means', 'theory', { q: 'When a melody and chords sound together, what does voicing mean?', options: ['Bringing one line out above the others', 'Playing everything as loudly as possible', 'Playing only the left hand', 'Changing the key of the piece'], answer: 0, why: 'Voicing is the balance between the lines: the melody leads and the accompaniment stays under it.' }, { accuracy: 1 }),
        voic('sight', 'Sight-read a singing line', 'sight', { range: [60, 77], hand: 'right', key: 'F', length: 4 }, { accuracy: 0.7 })
      ],
      pass: { minItemsDone: 3 }
    },
    {
      id: 'l9-cantabile', title: 'A singing line: cantabile and long phrases', minutes: 19,
      goal: 'Shape a slow piece phrase by phrase in a singing tone, with the pedal joining the sounds and changing with the harmony.',
      teach: [
        'Cantabile means in a singing style. A singer shapes a whole phrase in one breath, so play phrase by phrase: let the line rise towards its middle, then relax as it comes to rest. Never let the end of a phrase sound cut off.',
        'In a singing piece the melody sits on top, with chords or broken figures underneath. Hold each melody note for its full length, keep the accompaniment soft and even, and let the tune breathe where the phrase ends.',
        'Use the pedal to join the sounds, changing it where the harmony changes. In a slow piece one pedal change for each harmony keeps the tune smooth without blurring the chords together.',
        'The piece in your list is a calm character piece in F major, from a set of short piano pieces about childhood. Its singing top line over soft chords makes it a good study for this style.'
      ],
      tip: 'Sing the melody out loud once before you play it. A line you can sing is a line you can shape.',
      diagram: { type: 'staff', clef: 'treble', notes: [{ p: 65 }, { p: 69 }, { p: 72 }, { p: 69 }] },
      items: [
        cant('study', 'A singing study, right hand', 'piece', { notes: seq(CANT_R), tempo: 63, hand: 'right', timeSignature: '4/4' }, { accuracy: 0.8 }),
        cant('both', 'A singing study, both hands', 'piece', { tracks: { right: seq(CANT_R), left: seq(CANT_L) }, tempo: 60, timeSignature: '4/4' }, { accuracy: 0.75 }),
        cant('traumerei', 'Träumerei, both hands', 'piece', { song: TRAUMEREI }, { accuracy: 0.7 }),
        cant('echo', 'Echo a long phrase', 'echo', { notes: seq('F4:2 A4:1 C5:1 Bb4:2 A4:2'), tempo: 63, hand: 'right', rounds: 3 }, { accuracy: 0.8 }),
        cant('theory', 'Cantabile', 'theory', { q: 'What does cantabile mean?', options: ['In a singing style', 'Very fast', 'Detached and short', 'As loud as possible'], answer: 0, why: 'Cantabile asks for a smooth, singing line, shaped as a singer would shape a phrase.' }, { accuracy: 1 }),
        cant('theory2', 'The key of the piece', 'theory', { q: 'How many flats are in the key signature of F major?', options: ['One', 'Two', 'Three', 'None'], answer: 0, why: 'F major has one flat, B flat, in its key signature, and that B flat appears all through the piece.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 4 }
    },
    {
      id: 'l9-counterpoint', title: 'Two voices: counterpoint and imitation', minutes: 18,
      goal: 'Play two independent lines, each with its own shape, and hear the second voice answer the first.',
      teach: [
        'Counterpoint means two independent lines sounding at once. In a two-voice piece each hand has its own tune, and each line should make sense on its own: sing it alone and it still sounds like music.',
        'The opening idea is called the subject. A second voice that copies it a little later is imitating it. In a two-part invention the copy usually comes an octave lower, as in the study below; in a fugue the second entry, called the answer, comes on the dominant.',
        'Play each voice alone first, slowly, and decide where it breathes. Then join them, keeping the moving line a little louder and the held line quieter, so that both are heard. A hand that merely follows the other is no longer a voice.',
        'Held notes matter. When one voice moves, the other often holds a long note, and that note must keep ringing. Learn the piece in short sections, hands separately, and join them at the speed where both lines stay clear.'
      ],
      tip: 'Play one voice and sing the other. If you can hold the second line in your head while you play, the voices are truly independent.',
      diagram: { type: 'staff', clef: 'treble', notes: [{ p: 69 }, { p: 71 }, { p: 72 }, { p: 71 }] },
      items: [
        cpt('lh', 'The answering line, left hand', 'piece', { notes: seq(CP_L), tempo: 69, hand: 'left', timeSignature: '4/4' }, { accuracy: 0.8 }),
        cpt('both', 'A two-voice study, both hands', 'piece', { tracks: { right: seq(CP_R), left: seq(CP_L) }, tempo: 66, timeSignature: '4/4' }, { accuracy: 0.75 }),
        cpt('invention', 'Invention No. 13, both hands', 'piece', { song: INVENTION13 }, { accuracy: 0.7 }),
        cpt('echo', 'Echo an answering entry', 'echo', { notes: seq('A4 B4 C5 B4 A4 G#4 A4:2'), tempo: 69, hand: 'right', rounds: 4 }, { accuracy: 0.8 }),
        cpt('theory', 'Subject and answer', 'theory', { q: 'In the two-voice study, how does the left hand imitate the right?', options: ['The same idea an octave lower, two beats later', 'The same idea a fifth higher', 'A new idea in a new key', 'The idea upside down'], answer: 0, why: 'The left hand enters two beats later with the right-hand idea an octave lower: imitation at the octave, as in many two-part inventions.' }, { accuracy: 1 }),
        cpt('theory2', 'When one voice holds', 'theory', { q: 'In two-voice writing, what should a long held note do while the other voice moves?', options: ['Keep ringing so that both lines are heard', 'Stop at once', 'Be repeated in every bar', 'Be played louder than the moving line'], answer: 0, why: 'The held note keeps the second line alive; if it fades away the writing sounds like one tune with an accompaniment.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 4 }
    },
    {
      id: 'l9-sonata-first-movement', title: 'The first movement of a sonata', minutes: 19,
      goal: 'Play a first-movement study with two ideas, the second in the dominant, and name what each part of sonata form does.',
      teach: [
        'Sonata form shapes a whole movement. The exposition presents the ideas, the development works on them, and the recapitulation brings them back. In a big Classical sonata the middle section can wander far from home before the return.',
        'A movement in this form usually has two ideas. The first is in the home key. The second, often more song-like, arrives in the dominant when the piece is major, or in the relative major when it is minor.',
        'In the recapitulation both ideas come back in the home key, so the second idea has to move home as well. Following that change from the dominant back to the tonic is the easiest way to hear the shape of the movement.',
        'Mozart\'s Sonata in C, K. 545, often called the easy sonata, is a good piece to listen to next. Its first movement shows the form in a short, friendly shape, and it bends one rule: its first theme returns in F, the subdominant, before the music turns home.'
      ],
      tip: 'Play the two ideas one after the other and name the key of each. The keys tell you where you are in the form.',
      diagram: { type: 'staff', clef: 'treble', notes: [{ p: 72 }, { p: 74 }, { p: 76 }, { p: 76 }] },
      items: [
        sonf('exposition', 'A first-movement study, right hand', 'piece', { notes: seq(SON_R), tempo: 96, hand: 'right', timeSignature: '4/4' }, { accuracy: 0.8 }),
        sonf('both', 'A first-movement study, both hands', 'piece', { tracks: { right: seq(SON_R), left: seq(SON_L) }, tempo: 92, timeSignature: '4/4' }, { accuracy: 0.75 }),
        sonf('sight', 'Sight-read in G', 'sight', { range: [62, 81], hand: 'both', key: 'G', length: 4 }, { accuracy: 0.7 }),
        sonf('theory', 'The second idea', 'theory', { q: 'In the exposition of a major-key movement in sonata form, which key does the second idea normally take?', options: ['The dominant, a fifth above', 'The tonic', 'The parallel minor', 'The subdominant'], answer: 0, why: 'The second idea contrasts in the dominant, a fifth above the home key, and the exposition settles there.' }, { accuracy: 1 }),
        sonf('theory2', 'The recapitulation', 'theory', { q: 'What happens in the recapitulation of a movement in sonata form?', options: ['Both ideas return in the home key', 'New ideas appear for the first time', 'Only the first idea returns, in the dominant', 'The movement stops on the dominant'], answer: 0, why: 'The recapitulation brings the ideas back in the tonic key, which is what makes the movement sound finished.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 4 }
    },
    {
      id: 'l9-ornaments', title: 'Ornaments: trills, turns and grace notes', minutes: 15,
      goal: 'Play written-out trills and turns evenly in time, and name the ornaments you meet in the music.',
      teach: [
        'Ornaments decorate a single note. A trill alternates the written note with the note above it, quickly and evenly. A turn circles the note: the note above, the note itself, the note below, and the note again.',
        'A mordent touches a neighbouring note and returns. An appoggiatura is a small note beside the main note: it leans on it, takes some of its length, and resolves by step. A small note with a slash through it is an acciaccatura: crushed in quickly, with almost no time of its own.',
        'Play ornaments in time, usually on the beat, and keep them light. They belong to the melody, so they must not break the pulse or cover the notes around them.',
        'Learn each ornament slowly as ordinary notes first: four even notes for a turn, three for a mordent (the note, its neighbour, the note again). Speed comes later, and only when the shape is even.'
      ],
      tip: 'Practise the ornament on its own, without the rest of the bar. A decoration you can play evenly twenty times is ready to join the melody.',
      diagram: { type: 'keys', range: [67, 74], highlight: [67, 69, 71, 72, 74], fingers: { 67: 1, 69: 2, 71: 3, 72: 4, 74: 5 } },
      items: [
        orn('written', 'Ornaments written out, right hand', 'piece', { notes: seq(TR_R), tempo: 69, hand: 'right', timeSignature: '4/4' }, { accuracy: 0.8 }),
        orn('both', 'Ornaments written out, both hands', 'piece', { tracks: { right: seq(TR_R), left: seq(TR_L) }, tempo: 66, timeSignature: '4/4' }, { accuracy: 0.75 }),
        orn('echo', 'Echo a turn', 'echo', { notes: seq('E5:0.25 D5:0.25 C5:0.25 D5:0.25 E5:1'), tempo: 72, hand: 'right', rounds: 4 }, { accuracy: 0.8 }),
        orn('theory-turn', 'Naming the ornaments', 'theory', { q: 'Which ornament moves to the note above, back to the note, down to the note below, and back again?', options: ['A turn', 'A trill', 'A mordent', 'An appoggiatura'], answer: 0, why: 'A turn circles the written note: upper neighbour, the note, lower neighbour, the note.' }, { accuracy: 1 }),
        orn('theory-appog', 'The leaning note', 'theory', { q: 'What does an appoggiatura, a small note without a slash, do?', options: ['It leans on the main note and takes some of its length', 'It is played after the main note', 'It replaces the main note', 'It is held until the end of the bar'], answer: 0, why: 'An appoggiatura leans on the main note, takes part of its length, and then resolves by step.' }, { accuracy: 1 })
      ],
      pass: { minItemsDone: 3 }
    },
    {
      id: 'l9-reading-and-listening', title: 'Keys, terms, forms and cadences', minutes: 15,
      goal: 'Tell relative from parallel keys, name Italian terms, tell the forms apart, hear cadences and read a line in a new key.',
      teach: [
        'Two keys can be related in two ways. A relative minor shares the major key signature and begins on its sixth note: A minor belongs with C major. A parallel minor keeps the same tonic but changes the signature, as C minor does against C major.',
        'Italian words tell you the character. Dolce means sweetly, cantabile in a singing style, espressivo with expression, and rubato a flexible give and take. A tempo tells you to return to the first speed after a slowing or a rubato.',
        'Forms are easy to hear once you know the letters. Binary has two sections, A B. Ternary comes back to its opening, A B A. A rondo keeps its refrain returning, A B A C A. Sonata form uses exposition, development and recapitulation.',
        'Cadences end phrases. A perfect cadence is V to I, a plagal cadence IV to I, a half cadence stops on V, and a deceptive cadence moves V to vi. The cadence tells you whether the music has finished or is still going.'
      ],
      tip: 'Read the key signature before the first note and watch for accidentals that are not in it: they usually mark the moment the music changes key.',
      items: [
        read('theory-relpar', 'Relative and parallel keys', 'theory', { q: 'What is the difference between a relative minor and a parallel minor?', options: ['The relative minor shares the key signature; the parallel minor shares the tonic', 'The relative minor is faster', 'The parallel minor has no key signature', 'They are two names for the same key'], answer: 0, why: 'A minor and C major share a signature and are relatives; C minor and C major share the tonic note but not the signature.' }, { accuracy: 1 }),
        read('theory-term', 'An Italian term', 'theory', { q: 'Which word tells you to return to the first speed after a rubato or a slowing?', options: ['A tempo', 'Adagio', 'Dolce', 'Legato'], answer: 0, why: 'A tempo means in time again, back at the speed the piece began.' }, { accuracy: 1 }),
        read('theory-form', 'Telling forms apart', 'theory', { q: 'A piece returns to its first section after a contrasting middle one. Which form is that?', options: ['Ternary form', 'Binary form', 'Rondo form', 'Sonata form'], answer: 0, why: 'Ternary form is A B A: the opening section returns after a contrasting middle. Binary form would simply be A B.' }, { accuracy: 1 }),
        read('theory-cadence', 'Cadences', 'theory', { q: 'Which two chords make a plagal cadence?', options: ['IV to I', 'V to I', 'V to vi', 'I to V'], answer: 0, why: 'A plagal cadence moves from the subdominant chord, IV, down to the tonic, I.' }, { accuracy: 1 }),
        read('ear', 'Hear the interval', 'ear', { kind: 'interval', intervals: [1, 2, 3, 4, 5, 7, 8, 9, 12], rounds: 10 }, { accuracy: 0.8 }),
        read('sight', 'Sight-read in A', 'sight', { range: [57, 81], hand: 'both', key: 'A', length: 4 }, { accuracy: 0.7 })
      ],
      pass: { minItemsDone: 4 }
    }
  ],
  exam: {
    id: 'l9-exam', title: 'Level 9 check-up', passPercent: 80, minTaskPercent: 65,
    items: [
      exam('technique', 'I-IV-V-I in C, hands together', 'chord', { tb: { type: 'cadence', tonic: 0, hand: 'both' } }, { accuracy: 0.85 }),
      exam('arpeggio', 'C major arpeggio, hands together', 'arpeggio', { tb: { type: 'chord', tonic: 0, hand: 'both' } }, { accuracy: 0.8 }),
      exam('chords', 'Broken four-note chords over a held bass', 'piece', { tracks: { right: seq(CH4_R), left: seq(CH4_BASS) }, tempo: 63, timeSignature: '4/4' }, { accuracy: 0.8 }),
      exam('repeated', 'Repeated notes with a changing left hand', 'piece', { tracks: { right: seq(REP_R), left: seq(REP_L) }, tempo: 72, timeSignature: '4/4' }, { accuracy: 0.75 }),
      exam('voicing', 'The melody above a soft accompaniment', 'piece', { tracks: { right: seq(VOICE_R), left: seq(VOICE_L) }, tempo: 66, timeSignature: '4/4' }, { accuracy: 0.75 }),
      exam('counterpoint', 'A two-voice study, both hands', 'piece', { tracks: { right: seq(CP_R), left: seq(CP_L) }, tempo: 66, timeSignature: '4/4' }, { accuracy: 0.75 }),
      exam('ornaments', 'Ornaments written out, right hand', 'piece', { notes: seq(TR_R), tempo: 69, hand: 'right', timeSignature: '4/4' }, { accuracy: 0.8 }),
      exam('sight', 'Sight-reading in A', 'sight', { range: [57, 81], hand: 'both', key: 'A', length: 4 }, { accuracy: 0.7 }),
      exam('ear', 'Hear the interval', 'ear', { kind: 'interval', intervals: [1, 2, 3, 4, 5, 7, 8, 9, 12], rounds: 5 }, { accuracy: 0.8 }),
      exam('rhythm', 'Tap a repeated-note pattern', 'rhythm', { pattern: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1, 1, 1, 1], tempo: 76, timeSignature: '4/4' }, { accuracy: 0.8 }),
      exam('theory', 'Sonata form', 'theory', { q: 'In sonata form, what does the development do?', options: ['It works on the ideas heard in the exposition', 'It presents the ideas for the first time', 'It repeats the exposition exactly', 'It ends the movement'], answer: 0, why: 'The exposition presents the ideas, the development takes them apart and moves through other keys, and the recapitulation brings them back.' }, { accuracy: 1 })
    ]
  }
}
