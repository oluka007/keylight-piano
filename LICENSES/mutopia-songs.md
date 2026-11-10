# Mutopia Project songs

Keylight bundles 57 piano pieces as MIDI files from the [Mutopia Project](https://www.mutopiaproject.org)
(also served at https://sca.uwaterloo.ca/Mutopia/), in `renderer/songs/mutopia/` and `renderer/songs/mutopia-sa/`.
They are registered in `renderer/songs-mutopia.js`, and the app shows each piece's credit under the song title.

- **The compositions** are in the public domain (composers died in 1955 or earlier, source editions published before 1929).
- **Each MIDI file** is generated from a LilyPond file written by a Mutopia volunteer (the typesetter) and carries the
  licence that typesetter chose for that piece: Public Domain, CC BY or CC BY-SA. The licence is listed per piece below
  and on each source page (see the Mutopia legal page, https://sca.uwaterloo.ca/Mutopia/legal.html).
- **Public Domain** files need no credit; Keylight gives one anyway.
- **CC BY** files (3) are credited to their typesetter, with the licence, wherever the song is shown.
  Licence: https://creativecommons.org/licenses/by/3.0/
- **CC BY-SA** files (6) are kept apart in `renderer/songs/mutopia-sa/`. They are separate, attributed data files
  that the app loads at run time. They are not part of the MIT-licensed code, and the MIT licence does not apply to them:
  anyone who redistributes or adapts those files must keep the attribution and share the result under the same
  CC BY-SA licence. Licences: https://creativecommons.org/licenses/by-sa/3.0/ and https://creativecommons.org/licenses/by-sa/4.0/
- The files are provided as-is, with no warranty, and no claim that they match the printed editions.
- Files are unmodified Mutopia downloads (only renamed to `mutopia-<piece id>-<name>.mid`).

`scripts/test-song-licences.js` checks that every piece listed in `renderer/songs-mutopia.js` has a licence, a typesetter
credit, a source page and a file, that CC BY-SA pieces are only in `mutopia-sa/`, and that each one is listed in the tables below.

## Public Domain (48)

| Title | Composer | Licence | Typesetter / contributor | Source page | Mutopia | File (under `renderer/songs/`) |
|---|---|---|---|---|---|---|
| Revolutionary Étude | F. F. Chopin | Public Domain | Roland Goretzki | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=743 | Mutopia piece 743 | `mutopia/mutopia-743-op-10-12-wfi.mid` |
| Étude Op. 10 No. 1 | F. F. Chopin | Public Domain | Roland Goretzki | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=914 | Mutopia piece 914 | `mutopia/mutopia-914-chp-10-01.mid` |
| Black Key Étude | F. F. Chopin | Public Domain | Roland Goretzki | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=926 | Mutopia piece 926 | `mutopia/mutopia-926-chp-10-05.mid` |
| Étude Op. 10 No. 2 | F. F. Chopin | Public Domain | Roland Goretzki | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=508 | Mutopia piece 508 | `mutopia/mutopia-508-10-02-i.mid` |
| Étude Op. 10 No. 9 | F. F. Chopin | Public Domain | Roland Goretzki | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=484 | Mutopia piece 484 | `mutopia/mutopia-484-chopin-op-10-09-wfi.mid` |
| Aeolian Harp Étude | F. F. Chopin | Public Domain | Roland Goretzki | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=489 | Mutopia piece 489 | `mutopia/mutopia-489-chopin-op-25-01.mid` |
| Étude Op. 25 No. 2 | F. F. Chopin | Public Domain | Roland Goretzki | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=757 | Mutopia piece 757 | `mutopia/mutopia-757-ps-chopin-25-02.mid` |
| Ballade No. 4 | F. F. Chopin | Public Domain | Bruce J Keeler | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=422 | Mutopia piece 422 | `mutopia/mutopia-422-ballade-4.mid` |
| Fantaisie-Impromptu | F. F. Chopin | Public Domain | Guy D. Lederfein | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1693 | Mutopia piece 1693 | `mutopia/mutopia-1693-chopin-fantaisie-impromptu.mid` |
| Ballade No. 2 in B minor | F. Liszt | Public Domain | Vassily Checkin | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=236 | Mutopia piece 236 | `mutopia/mutopia-236-ballade.mid` |
| Étude Op. 2 No. 1 | A. Scriabin | Public Domain | Guy D. Lederfein | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1029 | Mutopia piece 1029 | `mutopia/mutopia-1029-scriabin-etude-2-1.mid` |
| Appassionata, 3rd mvt. | L. V. Beethoven | Public Domain | Stelios Samelis | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=937 | Mutopia piece 937 | `mutopia/mutopia-937-lvb-sonate-57-3.mid` |
| Sonata No. 32, 1st mvt. | L. V. Beethoven | Public Domain | Stelios Samelis | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1022 | Mutopia piece 1022 | `mutopia/mutopia-1022-lvb-sonate-111-1.mid` |
| Tempest, 1st mvt. | L. V. Beethoven | Public Domain | Stelios Samelis | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1509 | Mutopia piece 1509 | `mutopia/mutopia-1509-lvb-sonate-31no2-1.mid` |
| Pathétique, 1st mvt. | L. V. Beethoven | Public Domain | Chris Sawer | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=299 | Mutopia piece 299 | `mutopia/mutopia-299-pathetique-1.mid` |
| Sonata No. 2, Finale | F. F. Chopin | Public Domain | Roland Goretzki | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1727 | Mutopia piece 1727 | `mutopia/mutopia-1727-chp-op-35-4-scholz-fi.mid` |
| Raindrop Prelude | F. F. Chopin | Public Domain | Magnus Lewis-Smith | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=471 | Mutopia piece 471 | `mutopia/mutopia-471-chop-28-15.mid` |
| Minute Waltz | F. F. Chopin | Public Domain | Magnus Lewis-Smith | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=483 | Mutopia piece 483 | `mutopia/mutopia-483-chopin-valse-op64-no1.mid` |
| Waltz in B minor | F. F. Chopin | Public Domain | Roland Goretzki | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=511 | Mutopia piece 511 | `mutopia/mutopia-511-w10-h-moll-cfi.mid` |
| Arabesque No. 1 | C. Debussy | Public Domain | Keith OHara | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1777 | Mutopia piece 1777 | `mutopia/mutopia-1777-debussy-arabesque-1.mid` |
| Clair de Lune | C. Debussy | Public Domain | Keith OHara | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1778 | Mutopia piece 1778 | `mutopia/mutopia-1778-debussy-ste-bergamesq-clair.mid` |
| Rondo alla Turca | W. A. Mozart | Public Domain | Rune Zedeler and Chris Sawer | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=108 | Mutopia piece 108 | `mutopia/mutopia-108-kv331-3-rondoallaturca.mid` |
| Fantasia in D minor | W. A. Mozart | Public Domain | Andrés Necochea | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2034 | Mutopia piece 2034 | `mutopia/mutopia-2034-fantasia.mid` |
| Sonata in C minor, 1st mvt. | W. A. Mozart | Public Domain | Will Oram | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=356 | Mutopia piece 356 | `mutopia/mutopia-356-sonata1.mid` |
| Für Elise (full) | L. V. Beethoven | Public Domain | Stelios Samelis | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=931 | Mutopia piece 931 | `mutopia/mutopia-931-fur-elise-woo59.mid` |
| Impromptu Op. 90 No. 1 | F. Schubert | Public Domain | Ph. Raynaud | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1192 | Mutopia piece 1192 | `mutopia/mutopia-1192-schubertf-d899-1-impromptu.mid` |
| Impromptu Op. 90 No. 2 | F. Schubert | Public Domain | Ph. Raynaud | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1551 | Mutopia piece 1551 | `mutopia/mutopia-1551-schubertf-d899-2-impromptu.mid` |
| Impromptu Op. 90 No. 4 | F. Schubert | Public Domain | Ph. Raynaud | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1552 | Mutopia piece 1552 | `mutopia/mutopia-1552-schubertf-d899-4-impromptu.mid` |
| Impromptu Op. 142 No. 1 | F. Schubert | Public Domain | Ph. Raynaud | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1194 | Mutopia piece 1194 | `mutopia/mutopia-1194-schubertf-d935-1-impromptu.mid` |
| Impromptu Op. 142 No. 2 | F. Schubert | Public Domain | Ph. Raynaud | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1195 | Mutopia piece 1195 | `mutopia/mutopia-1195-schubertf-d935-2-impromptu.mid` |
| Moment Musical No. 3 | F. Schubert | Public Domain | Claude Chaudron | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1023 | Mutopia piece 1023 | `mutopia/mutopia-1023-momentsno3.mid` |
| Träumerei | R. Schumann | Public Domain | Ying-Chun Liu | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=504 | Mutopia piece 504 | `mutopia/mutopia-504-schumannop15no07.mid` |
| Intermezzo Op. 118 No. 2 | J. Brahms | Public Domain | Aron Fay | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=535 | Mutopia piece 535 | `mutopia/mutopia-535-intermezzo.mid` |
| Waltz Op. 39 No. 10 | J. Brahms | Public Domain | John Mamoun | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2164 | Mutopia piece 2164 | `mutopia/mutopia-2164-waltz-op39-10.mid` |
| In the Hall of the Mountain King | E. Grieg | Public Domain | Coyau | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1888 | Mutopia piece 1888 | `mutopia/mutopia-1888-dans-l-antre-du-roi-de-la-montagne.mid` |
| Wedding Day at Troldhaugen | E. Grieg | Public Domain | David Whipple | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=781 | Mutopia piece 781 | `mutopia/mutopia-781-troldhaugen.mid` |
| March of the Dwarfs | E. Grieg | Public Domain | Anonymous | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2014 | Mutopia piece 2014 | `mutopia/mutopia-2014-troldtog.mid` |
| Dumka | P. I. Tchaikovsky | Public Domain | Vassily Checkin | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=341 | Mutopia piece 341 | `mutopia/mutopia-341-dumka.mid` |
| Scherzo in E minor | F. Mendelssohn-Bartholdy | Public Domain | Andrew C. Norman | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1653 | Mutopia piece 1653 | `mutopia/mutopia-1653-mendelssohn-scherzo-eminor.mid` |
| Maple Leaf Rag | S. Joplin | Public Domain | Chris Sawer | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=23 | Mutopia piece 23 | `mutopia/mutopia-23-maple.mid` |
| The Entertainer | S. Joplin | Public Domain | Chris Sawer | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=263 | Mutopia piece 263 | `mutopia/mutopia-263-entertainer.mid` |
| Prelude in C (BWV 846) | J. S. Bach | Public Domain | Tobias Erbsland | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=5 | Mutopia piece 5 | `mutopia/mutopia-5-wtk1-prelude1.mid` |
| Toccata in F-sharp minor | J. S. Bach | Public Domain | Imre Polik | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1814 | Mutopia piece 1814 | `mutopia/mutopia-1814-bwv910.mid` |
| Invention No. 13 | J. S. Bach | Public Domain | Allen Garvin | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=59 | Mutopia piece 59 | `mutopia/mutopia-59-bach-invention-13.mid` |
| Pineapple Rag | S. Joplin | Public Domain | Coyau | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1899 | Mutopia piece 1899 | `mutopia/mutopia-1899-pineapplerag.mid` |
| Elite Syncopations | S. Joplin | Public Domain | Benjamin Bloomfield | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1540 | Mutopia piece 1540 | `mutopia/mutopia-1540-elitesyncopations.mid` |
| A Breeze from Alabama | S. Joplin | Public Domain | Daniel Škarda | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=485 | Mutopia piece 485 | `mutopia/mutopia-485-a-breeze-from-alabama.mid` |
| Magnetic Rag | S. Joplin | Public Domain | Kurt Holtrop | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=441 | Mutopia piece 441 | `mutopia/mutopia-441-magnetic.mid` |

## CC BY (3)

| Title | Composer | Licence | Typesetter / contributor | Source page | Mutopia | File (under `renderer/songs/`) |
|---|---|---|---|---|---|---|
| Consolation No. 3 | F. Liszt | CC BY 3.0 | Ryan Prince | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1647 | Mutopia piece 1647 | `mutopia/mutopia-1647-liszt-consolation-no3.mid` |
| Consolation No. 1 | F. Liszt | CC BY 3.0 | Ryan Prince | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1654 | Mutopia piece 1654 | `mutopia/mutopia-1654-liszt-consolation-no1.mid` |
| Consolation No. 4 | F. Liszt | CC BY 3.0 | Ryan Prince | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1650 | Mutopia piece 1650 | `mutopia/mutopia-1650-liszt-consolation-no4.mid` |

## CC BY-SA (6), separate data files

| Title | Composer | Licence | Typesetter / contributor | Source page | Mutopia | File (under `renderer/songs/`) |
|---|---|---|---|---|---|---|
| Ballade No. 1 | F. F. Chopin | CC BY-SA 4.0 | Javier Ruiz-Alma | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1959 | Mutopia piece 1959 | `mutopia-sa/mutopia-1959-chopin-op23-ballade-1.mid` |
| Nocturne Op. 9 No. 2 | F. F. Chopin | CC BY-SA 3.0 | Renato Biolcati Rinaldi | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1590 | Mutopia piece 1590 | `mutopia-sa/mutopia-1590-chopin-nocturne-op9-n2.mid` |
| Prelude in C-sharp minor | S. Rachmaninoff | CC BY-SA 4.0 | Petro Kostandy | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2033 | Mutopia piece 2033 | `mutopia-sa/mutopia-2033-rach-prelude-op3-no2.mid` |
| Prelude Op. 23 No. 5 | S. Rachmaninoff | CC BY-SA 4.0 | Joram Berger | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2001 | Mutopia piece 2001 | `mutopia-sa/mutopia-2001-rach-prelude23-05.mid` |
| Prelude Op. 23 No. 2 | S. Rachmaninoff | CC BY-SA 4.0 | Abel Cheung | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1960 | Mutopia piece 1960 | `mutopia-sa/mutopia-1960-rach-prelude23-02.mid` |
| Sonata Facile, 1st mvt. | W. A. Mozart | CC BY-SA 3.0 | Alejandro Sierra | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=998 | Mutopia piece 998 | `mutopia-sa/mutopia-998-k545-1.mid` |
