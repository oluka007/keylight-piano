# Song formats

Keylight plays songs from three kinds of score file:

- **MusicXML**: `.musicxml` or `.xml`
- **Compressed MusicXML**: `.mxl`
- **Standard MIDI**: `.mid` or `.midi`

It can also turn an audio recording into notes. This page is about score files: what Keylight reads from each format, and how to prepare a file in MuseScore so that it imports well.

The code lives in:

- `renderer/musicxml.js`: MusicXML
- `renderer/smf.js`: MIDI
- `renderer/importer.js`: `.mxl` unpacking and the import itself
- `renderer/songloader.js`: turns every format into one song model
- `renderer/fingering.js`: finger numbers

## At a glance

| | MusicXML / .mxl | MIDI |
|---|---|---|
| Notes | every part, ties merged, chords | every track and channel except channel 10 (drums) |
| Hands | upper staff = right, lower staff = left | worked out from the tracks and channels, see below |
| Fingering | read from the score, and guessed where the score has none | guessed |
| Repeats | played out, with voltas and a simple D.C. / D.S. | as written (a MIDI file is already played out) |
| Tempo | `<sound tempo>`, otherwise `<metronome>` | tempo map |
| Time signature | first `<time>` | first time-signature event |
| Title / composer | work and movement title, composer | the sequence name (title only) |
| Parts list | yes | yes |

## MusicXML and .mxl

### Notes

- **All parts are merged into one song.** Each note keeps `part`, the index of its part. `song.parts` lists the parts with these fields:
  - name
  - MIDI channel (0-15)
  - MIDI program (0-127)
  - note count
  - lowest and highest pitch
  - hand
- **Ties:** tied notes become one long note, across bar lines and across repeat jumps.
- **Not played:**
  - Grace notes are skipped.
  - Cue notes (`<cue/>`) are silent, but still take their time in their voice.
- **Velocity:** dynamics are not read, so every note plays at velocity 100.

### Hands

- **A part on two staves (a piano grand staff):** notes on the upper staff go to the right hand, notes on the lower staff to the left.
- **A part on one staff:** the whole part goes to one hand, by register. If its average pitch is below middle C (C4, MIDI 60) it is the left hand, otherwise the right.
- **Two hands as separate parts:** a part named "Piano RH" on one staff and a part named "Piano LH" on another also works, because each is placed by its register.

### Fingering

- **Read from the score:** a `<notations><technical><fingering>` mark gives that note its finger.
  - The first digit from 1 to 5 is used, so `3-1` (a finger change on a held note) gives 3.
  - Marks with `alternate="yes"` or `substitution="yes"` are skipped.
- **Guessed:** notes without a mark get a guessed finger, which works around the marks that are there. See [Fingering](#fingering-1).

### Repeats and jumps

**Played out in playing order, before timing:**

- Repeat barlines: forward and backward.
  - A backward repeat without a forward one goes back to the start, or to just after the previous repeat.
  - `times="3"` plays the section three times.
- Voltas (first and second endings, `<ending>`), including endings for several passes such as `1, 2` and `3`.
  - Without a `times` attribute, a repeat inside a volta goes round as often as its voltas need.

**D.C. and D.S.** are followed only when they are simple. That means one D.C. or D.S. in the whole score, written as a `<sound>` jump mark, which is how MuseScore writes them. Then:

- The second pass starts at the beginning (D.C.) or at the segno (D.S.).
- On the second pass, repeats are not taken and only the last volta of each set is played.
- The second pass stops at Fine, or skips from To Coda to the Coda.
- If any of this does not apply, for example two jumps or no segno, the score is played straight through with its repeats.

`song.bars` lists the time, in seconds, at which each bar starts, in playing order.

### Tempo and time signature

**Tempo:**

- Tempo comes from `<sound tempo="…">`, which MuseScore writes for its tempo markings.
- Where a direction has no `<sound tempo>`, its `<metronome>` mark is used.
  - The mark is converted to quarter notes per minute: a dotted quarter at 60 is 90 bpm.
  - At the same position, a `<sound tempo>` wins over a bare metronome mark.
- If the first tempo mark comes after the start, it applies from the start.
- With no tempo mark at all, the tempo is 120 bpm.

**Time signature:** the first `<time>` becomes `song.timeSignature`, for example `{ beats: 3, beatType: 4 }`. A time signature such as `3+2` over 8 gives 5 beats.

### Title and composer

**Title**, in this order:

1. `<work-title>` and `<movement-title>`. When both are present and different, they are joined as "Work: Movement".
2. A title credit (`<credit-type>title</credit-type>`).
3. Otherwise, the credit text in the biggest font.

**Composer:** `<creator type="composer">`, then the arranger.

**Placeholders are ignored:** the text a new MuseScore score starts with, such as "Untitled score", "Title", "Composer" and "Composer / arranger".

### .mxl

- An `.mxl` file is a zip archive. Keylight reads the archive's central directory itself, without a library.
- It finds the score through `META-INF/container.xml`, using the first MusicXML rootfile listed there.
- If there is no container file, it uses the first `.xml` or `.musicxml` file outside `META-INF`.
- Entries may be stored or deflate-compressed, which is what every MusicXML writer uses.
- Encrypted and ZIP64 archives are not supported.

### File contents, not names

- **Zip or text:** Keylight looks at a score file's first bytes, not only its extension. A zip archive is read as compressed MusicXML and XML text as plain MusicXML, so a compressed score saved as `.xml`, or a plain one saved as `.mxl`, still opens.
- **Text encoding:** UTF-8, or UTF-16 with or without a byte order mark.

### Not supported

- Timewise MusicXML (`<score-timewise>`). Save the score as ordinary (partwise) MusicXML instead.
- Percussion parts (unpitched notes).
- Ornaments written as symbols. A trill or turn plays as its main note.
- Lyrics.
- D.C. and D.S. combinations with more than one jump.

## MIDI

### Reading

- **Formats:** format 0 and format 1. Format 2 is treated like format 1.
- **Timing:** both tick-based and SMPTE time.
- **Running status:** carries on across meta and sysex events.
- **Damaged files:** a file that is cut short keeps the notes read before the cut.
- **Repeated notes:** a key written as "note on, then note off" on the same tick keeps both strikes.
- **Drums:** channel 10 is skipped.

### Parts

- Every track and channel pair that has notes is a part, listed in `song.parts`. Each part has:
  - `index`: the track number, counting from 0
  - `name`: the track name, or its instrument name
  - `channel`: 0-15
  - `program`: 0-127
  - `noteCount`, `low`, `high`
  - `hand`
- Every note keeps `part`, `track`, `trackName`, `channel` and `program`.

### Hands

**Two parts:** the part with the higher average pitch is the right hand, the other the left. This covers right-hand and left-hand tracks, and two channels in a format 0 file.

**One part:**

- **A single line of melody** (never two notes at once) is one hand: the right, unless its average pitch is below G3.
- **Anything with chords or two lines** is split at middle C, with hysteresis:
  - F4 and above go to the right hand; F#3 and below go to the left.
  - G3 to E4 stay with the hand whose line they carry on: within a fifth of that hand's last note, starting less than a beat after that note ends. If neither hand's line qualifies, the note goes by the split: below middle C left, otherwise right.
  - When both lines are equally close, the note goes to the hand that played last.
  - The hands never cross within one chord.

So a right-hand line stepping down from D4 to A3 stays in the right hand, and a left-hand line climbing to C4 stays in the left.

**Three or more parts:** each part goes to one hand by its average pitch (below middle C means left).

### Title and time signature

- **Title:** the sequence name. That is the track name in a format 0 file, or in a format 1 file the name of the first track when that track holds no notes (the tempo track).
  - Generic names such as "Piano", "Track 1", "Untitled" and copyright lines are ignored.
- **Time signature:** the first time-signature event becomes `song.timeSignature`.
- **Not in MIDI:** a MIDI file carries no composer and no fingering.

## Title and artist on import

When you add a score file, Keylight picks the title and artist in this order:

1. The file's own title and composer, as described above.
2. "Artist - Title" from the file name. For example, `Beethoven - Ode to Joy.mid`.
3. The file name.

If nothing gives an artist, the artist is "Imported".

## Fingering

Every note of a song loaded through `songloader.normalise` gets a finger number (1 = thumb … 5 = little finger) in `note.finger`. That covers the library songs and every import. Songs imported before fingering existed get their fingers when they are opened again.

- **Authored fingering:** fingering read from MusicXML always stays as written.
- **The guess** fills in every other note, separately for each hand:
  1. **Phrases.** Each hand's line is cut into phrases:
     - at rests of a beat or more
     - at leaps wider than a sixth
     - at chords

     A phrase that fits under five white keys is played from one five-finger position. This gives Ode to Joy as `3 3 4 5 5 4 3 2 1 1 2 3 3 2 2`. Between phrases the hand stays where it is if the next phrase fits there.
  2. **Longer phrases** get the cheapest finger sequence, with costs after Parncutt et al. (1997). The following cost extra:
     - a stretch beyond what a pair of fingers spans comfortably
     - one finger on two keys in a row
     - crossings, which are allowed only as the thumb passing under fingers 2-4 or fingers 2-4 passing over the thumb. A crossing over a half or whole step costs the same; a wider one costs more, so a broken C-E-G-C is `1 2 3 5` and not `1 2 1 4`
     - the thumb or the little finger on a black key
     - a new finger on a repeated key

     The left hand uses the same model, mirrored. This gives the C major scale as `1 2 3 1 2 3 4 5 / 5 4 3 2 1 3 2 1` in the right hand and `5 4 3 2 1 3 2 1 / 1 2 3 1 2 3 4 5` in the left. Every major scale on a white key comes out as the method books finger it, in both hands (F major right hand `1 2 3 4 1 2 3 4`, B major left hand `4 3 2 1 4 3 2 1`).

     When two fingerings cost the same, the one that changes hand position less often wins.
  3. **Chords** are fingered by rank and spread to fit their shape:
     - Right hand: the lowest note gets 1, so C-E-G is `1 3 5` and E-G-C is `1 2 5`.
     - Left hand: the lowest note gets 5, so C-E-G is `5 3 1`.

The guess is quick: about 10-15 ms for 2,000 notes on a recent Mac.

## The 24-key range

- The keyboard has 24 lit keys, C3-B4 by default. The octave buttons move that window, but every note of a song must fit inside one 24-semitone window to be playable.
- Keylight picks the window that covers the most notes.
- Notes outside the window are played for you, not by you.

## Preparing a file in MuseScore

These steps are for MuseScore 4. MuseScore 3 is much the same; its Score Properties is MuseScore 4's Project Properties.

1. **Instrument.** Use a piano (grand staff). Put the right hand on the upper staff and the left hand on the lower one. That staff split is what Keylight uses for hands.
2. **Range.** Keep the piece within two octaves, ideally C3-B4. Use *Tools → Transpose* if it sits too high or too low.
3. **Title and composer.** Fill in *File → Project properties* (Work title, Composer), or edit the title frame. Replace the placeholder text, which Keylight ignores.
4. **Tempo.** Add a tempo marking from the *Tempo* palette at the first note. MuseScore exports it as a sound tempo, which sets the count-in and the metronome.
5. **Fingering.** Add finger numbers from the *Fingering* palette to any notes you care about. Keylight shows yours and guesses the rest around them.
6. **Repeats.** Use repeat barlines and volta brackets from the *Repeats & jumps* palette instead of writing the music out twice. Keylight plays them in order. D.C. / D.S. with Fine, To Coda and Coda from the same palette work too, if there is only one jump.
7. **What is left out:** grace notes are skipped, cue notes are silent and dynamics are ignored. Write ornaments out as notes if they should be played.
8. **Export.** Use *File → Export*, format *MusicXML*. Compressed (`.mxl`) and uncompressed (`.musicxml`) both import.
   - Prefer MusicXML over MIDI: a MIDI export loses the fingering, the composer and the staff split.

**MIDI from a DAW or another program:**

- Put each hand on its own track, or on its own channel.
- Name the first track after the song.
- Keep drums on channel 10, which Keylight skips.
