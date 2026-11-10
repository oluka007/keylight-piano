# Mutopia song default tempos

The Mutopia MIDI files are mechanical LilyPond renderings; many sit at a flat default tempo (often 60 BPM) and play far too slow or fast. `renderer/songs-mutopia.js` therefore carries a per-piece `tempoScale` (multiplier on the file tempo; below 1 = slower) applied when the song is opened, so duration, bars, falling-note speed, scoring and the speed buttons all behave normally. Targets are typical performance lengths (estimates from musical knowledge, kept a little slow for the hard pieces; Wait mode and 0.5x/0.75x speed still apply). Pieces whose file tempo already lands near a typical performance are left at 1. "uncertain" = unsure, left unscaled. "long" = may exceed 12 min.

Summary: 24 scaled, 19 left alone, 14 uncertain (left alone).

| Title (id) | file tempo BPM | target length | scale | resulting duration | notes/s | notes |
|---|---|---|---|---|---|---|
| Revolutionary Étude (chopin-etude-op10-12) | 160 | 2:30 | 0.84 | 2:29 | 14.0 | Presto con fuoco; slightly under the usual ~2:30 so the left-hand run is learnable |
| Étude Op. 10 No. 1 (chopin-etude-op10-1) | 176 | 2:05 | 0.86 | 2:05 | 10.7 | Allegro; typical ~2:00-2:15, kept a touch slower |
| Black Key Étude (chopin-etude-op10-5) | 116 | - | 1 | 1:30 | 18.1 | file tempo is already close to a typical performance |
| Étude Op. 10 No. 2 (chopin-etude-op10-2) | 144 | - | 1 | 1:22 | 17.9 | file tempo is already close to a typical performance |
| Étude Op. 10 No. 9 (chopin-etude-op10-9) | 144 | - | 1 | 1:23 | 14.8 | uncertain; unsure of a typical length against this file; left unscaled |
| Aeolian Harp Étude (chopin-etude-op25-1) | 104 | - | 1 | 1:54 | 19.5 | uncertain; unsure of a typical length against this file; left unscaled |
| Étude Op. 25 No. 2 (chopin-etude-op25-2) | 224 | - | 1 | 1:19 | 15.2 | file tempo is already close to a typical performance |
| Ballade No. 4 (chopin-ballade-4) | 60 | 10:20 | 1.16 | 10:18 | 9.8 | Andante con moto 6/8; file runs near 12 min at a flat 60 |
| Ballade No. 1 (chopin-ballade-1) | 65 | 10:00 | 1.16 | 9:59 | 8.4 | file tempo map is too slow overall; typical 9-10 min |
| Fantaisie-Impromptu (chopin-fantaisie-impromptu) | 168 | 5:00 | 0.85 | 4:58 | 10.1 | typical ~5:00 with the slow middle section |
| Ballade No. 2 in B minor (liszt-ballade-2) | 60 | 14:00 | 1.66 | 14:00 | 8.3 | long; ~14 min is typical (file: ~23 min); flagged long |
| Étude Op. 2 No. 1 (scriabin-etude-op2-1) | 60 | - | 1 | 2:15 | 8.3 | uncertain; unsure of a typical length against this file; left unscaled |
| Appassionata, 3rd mvt. (beethoven-appassionata-3) | 134 | - | 1 | 8:16 | 14.6 | uncertain; unsure of a typical length against this file; left unscaled |
| Sonata No. 32, 1st mvt. (beethoven-sonata-32-1) | 52 | - | 1 | 7:17 | 12.2 | uncertain; unsure of a typical length against this file; left unscaled |
| Tempest, 1st mvt. (beethoven-tempest-1) | 40 | - | 1 | 6:13 | 7.7 | file tempo is already close to a typical performance |
| Pathétique, 1st mvt. (beethoven-pathetique-1) | 33 | - | 1 | 6:15 | 11.4 | uncertain; unsure of a typical length against this file; left unscaled |
| Sonata No. 2, Finale (chopin-sonata-2-finale) | 224 | - | 1 | 1:22 | 21.9 | file tempo is already close to a typical performance |
| Raindrop Prelude (chopin-raindrop) | 80 | 6:00 | 0.74 | 6:01 | 4.2 | Sostenuto, ~6:00 |
| Minute Waltz (chopin-minute-waltz) | 280 | 1:50 | 0.82 | 1:49 | 12.5 | file is at the fast end (quarter 280); ~1:50 is learner-friendly |
| Waltz in B minor (chopin-waltz-op69-2) | 152 | - | 1 | 2:52 | 9.3 | file tempo is already close to a typical performance |
| Nocturne Op. 9 No. 2 (chopin-nocturne-op9-2) | 66 | 4:15 | 0.79 | 4:16 | 4.9 | Andante, ~4:15-4:30 typical |
| Arabesque No. 1 (debussy-arabesque-1) | 144 | - | 1 | 2:56 | 8.2 | uncertain; unsure of a typical length against this file; left unscaled |
| Clair de Lune (debussy-clair-de-lune) | 60 | 5:00 | 1.08 | 4:59 | 4.9 | ~5:00 |
| Prelude in C-sharp minor (rachmaninoff-prelude-c-sharp-minor) | 60 | 3:20 | 0.82 | 3:20 | 8.6 | Lento/Agitato; typical ~3:20 |
| Prelude Op. 23 No. 5 (rachmaninoff-prelude-op23-5) | 108 | - | 1 | 3:47 | 17.0 | file tempo is already close to a typical performance |
| Prelude Op. 23 No. 2 (rachmaninoff-prelude-op23-2) | 80 | - | 1 | 3:05 | 17.1 | uncertain; unsure of a typical length against this file; left unscaled |
| Rondo alla Turca (mozart-rondo-alla-turca) | 60 | 3:00 | 1.42 | 2:60 | 9.0 | Allegretto, ~3:00 (file: flat 60) |
| Fantasia in D minor (mozart-fantasia-d-minor) | 80 | - | 1 | 4:43 | 5.3 | uncertain; unsure of a typical length against this file; left unscaled |
| Sonata in C minor, 1st mvt. (mozart-sonata-457-1) | 168 | - | 1 | 4:24 | 8.2 | file tempo is already close to a typical performance |
| Sonata Facile, 1st mvt. (mozart-sonata-facile-1) | 132 | - | 1 | 2:12 | 9.7 | uncertain; unsure of a typical length against this file; left unscaled |
| Für Elise (full) (beethoven-fur-elise-full) | 72 | 2:50 | 0.77 | 2:49 | 5.3 | Poco moto, full bagatelle ~3:00; slightly slower |
| Impromptu Op. 90 No. 1 (schubert-impromptu-90-1) | 44 | - | 1 | 9:28 | 8.8 | file tempo is already close to a typical performance |
| Impromptu Op. 90 No. 2 (schubert-impromptu-90-2) | 160 | - | 1 | 5:19 | 9.9 | uncertain; unsure of a typical length against this file; left unscaled |
| Impromptu Op. 90 No. 4 (schubert-impromptu-90-4) | 130 | - | 1 | 7:35 | 12.8 | file tempo is already close to a typical performance |
| Impromptu Op. 142 No. 1 (schubert-impromptu-142-1) | 110 | - | 1 | 9:07 | 11.5 | file tempo is already close to a typical performance |
| Impromptu Op. 142 No. 2 (schubert-impromptu-142-2) | 100 | - | 1 | 7:13 | 6.3 | file tempo is already close to a typical performance |
| Moment Musical No. 3 (schubert-moment-musical-3) | 80 | - | 1 | 1:57 | 9.1 | file tempo is already close to a typical performance |
| Träumerei (schumann-traumerei) | 60 | 2:30 | 0.74 | 2:30 | 2.3 | typical ~2:30 (file ritards are mechanical) |
| Intermezzo Op. 118 No. 2 (brahms-intermezzo-118-2) | 80 | 5:20 | 0.87 | 5:21 | 5.2 | Andante teneramente, ~5:00-6:00 |
| Waltz Op. 39 No. 10 (brahms-waltz-39-10) | 160 | - | 1 | 0:36 | 12.7 | uncertain; unsure of a typical length against this file; left unscaled |
| In the Hall of the Mountain King (grieg-mountain-king) | 138 | - | 1 | 2:25 | 10.0 | file tempo is already close to a typical performance |
| Wedding Day at Troldhaugen (grieg-troldhaugen) | 120 | - | 1 | 6:06 | 10.5 | file tempo is already close to a typical performance |
| March of the Dwarfs (grieg-troldtog) | 120 | - | 1 | 3:13 | 11.3 | file tempo is already close to a typical performance |
| Dumka (tchaikovsky-dumka) | 60 | - | 1 | 9:33 | 7.5 | uncertain; unsure of a typical length against this file; left unscaled |
| Scherzo in E minor (mendelssohn-scherzo-e-minor) | 60 | 4:30 | 1.59 | 4:30 | 7.8 | uncertain; Presto/leggiero scherzo; file flat 60 gives 7 min; estimate |
| Maple Leaf Rag (joplin-maple-leaf-rag) | 120 | 3:00 | 0.8 | 3:00 | 14.3 | with repeats ~3:00; Joplin: "never play fast" |
| The Entertainer (joplin-the-entertainer) | 72 | - | 1 | 4:13 | 10.4 | file tempo is already close to a typical performance |
| Prelude in C (BWV 846) (bach-prelude-c-bwv846) | 60 | - | 1 | 2:20 | 3.9 | file tempo is already close to a typical performance |
| Toccata in F-sharp minor (bach-toccata-bwv910) | 60 | 10:00 | 1.31 | 10:00 | 6.9 | ~10 min typical; file 13 min at flat 60 |
| Invention No. 13 (bach-invention-13) | 100 | - | 1 | 1:00 | 9.4 | uncertain; unsure of a typical length against this file; left unscaled |
| Consolation No. 3 (liszt-consolation-3) | 60 | 5:00 | 0.81 | 5:00 | 3.4 | Lento placido ~5:00 |
| Consolation No. 1 (liszt-consolation-1) | 60 | 2:30 | 0.66 | 2:30 | 1.8 | Andante con moto ~2:30 |
| Consolation No. 4 (liszt-consolation-4) | 60 | 3:10 | 0.73 | 3:09 | 2.7 | Quasi adagio ~3:10 |
| Pineapple Rag (joplin-pineapple-rag) | 100 | 3:20 | 0.89 | 3:19 | 12.5 | ~3:20 typical |
| Elite Syncopations (joplin-elite-syncopations) | 60 | 3:20 | 1.48 | 3:20 | 11.2 | ~3:15 typical (file flat 60) |
| A Breeze from Alabama (joplin-breeze-from-alabama) | 82 | - | 1 | 4:12 | 11.7 | file tempo is already close to a typical performance |
| Magnetic Rag (joplin-magnetic-rag) | 60 | 4:50 | 2.62 | 4:50 | 10.4 | ~4:45 typical (file flat 60 = 12.7 min) |
