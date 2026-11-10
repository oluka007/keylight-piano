// Advanced and virtuoso piano pieces from the Mutopia Project (https://www.mutopiaproject.org).
// The compositions are in the public domain; each .mid is the work of its Mutopia typesetter and
// carries that piece's Mutopia licence (Public Domain, CC BY or CC BY-SA), listed per piece below
// and in LICENSES/mutopia-songs.md. The CC BY-SA files live in songs/mutopia-sa/ so they stay
// separable from the MIT-licensed code: they are attributed data files, not part of the program.
// The files are mechanical LilyPond previews (steady tempo, no rubato), which suits learning.
//   file: under songs/, id: also the cover name (covers/<id>.png, a generated tile shows until it exists),
//   heavy: very long or note-dense, so it may be slow to follow at full speed.
export const MUTOPIA_SONGS = [
  { id: "chopin-etude-op10-12", file: "mutopia/mutopia-743-op-10-12-wfi.mid", title: "Revolutionary Étude", artist: "Chopin", composer: "F. F. Chopin", cover: 'covers/chopin-etude-op10-12.png', level: "Virtuoso", genre: "Classical", hands: 'both', tier: 3,
    licence: "Public Domain", typesetter: "Roland Goretzki", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=743", mutopiaId: 743 },
  { id: "chopin-etude-op10-1", file: "mutopia/mutopia-914-chp-10-01.mid", title: "Étude Op. 10 No. 1", artist: "Chopin", composer: "F. F. Chopin", cover: 'covers/chopin-etude-op10-1.png', level: "Virtuoso", genre: "Classical", hands: 'both', tier: 3,
    licence: "Public Domain", typesetter: "Roland Goretzki", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=914", mutopiaId: 914 },
  { id: "chopin-etude-op10-5", file: "mutopia/mutopia-926-chp-10-05.mid", title: "Black Key Étude", artist: "Chopin", composer: "F. F. Chopin", cover: 'covers/chopin-etude-op10-5.png', level: "Virtuoso", genre: "Classical", hands: 'both', tier: 3,
    licence: "Public Domain", typesetter: "Roland Goretzki", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=926", mutopiaId: 926 },
  { id: "chopin-etude-op10-2", file: "mutopia/mutopia-508-10-02-i.mid", title: "Étude Op. 10 No. 2", artist: "Chopin", composer: "F. F. Chopin", cover: 'covers/chopin-etude-op10-2.png', level: "Virtuoso", genre: "Classical", hands: 'both', tier: 3,
    licence: "Public Domain", typesetter: "Roland Goretzki", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=508", mutopiaId: 508 },
  { id: "chopin-etude-op10-9", file: "mutopia/mutopia-484-chopin-op-10-09-wfi.mid", title: "Étude Op. 10 No. 9", artist: "Chopin", composer: "F. F. Chopin", cover: 'covers/chopin-etude-op10-9.png', level: "Virtuoso", genre: "Classical", hands: 'both', tier: 3,
    licence: "Public Domain", typesetter: "Roland Goretzki", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=484", mutopiaId: 484 },
  { id: "chopin-etude-op25-1", file: "mutopia/mutopia-489-chopin-op-25-01.mid", title: "Aeolian Harp Étude", artist: "Chopin", composer: "F. F. Chopin", cover: 'covers/chopin-etude-op25-1.png', level: "Virtuoso", genre: "Classical", hands: 'both', tier: 3,
    licence: "Public Domain", typesetter: "Roland Goretzki", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=489", mutopiaId: 489 },
  { id: "chopin-etude-op25-2", file: "mutopia/mutopia-757-ps-chopin-25-02.mid", title: "Étude Op. 25 No. 2", artist: "Chopin", composer: "F. F. Chopin", cover: 'covers/chopin-etude-op25-2.png', level: "Virtuoso", genre: "Classical", hands: 'both', tier: 3,
    licence: "Public Domain", typesetter: "Roland Goretzki", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=757", mutopiaId: 757 },
  { id: "chopin-ballade-4", file: "mutopia/mutopia-422-ballade-4.mid", title: "Ballade No. 4", artist: "Chopin", composer: "F. F. Chopin", cover: 'covers/chopin-ballade-4.png', level: "Virtuoso", genre: "Classical", hands: 'both', tier: 3,
    licence: "Public Domain", typesetter: "Bruce J Keeler", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=422", mutopiaId: 422, heavy: true },
  { id: "chopin-ballade-1", file: "mutopia-sa/mutopia-1959-chopin-op23-ballade-1.mid", title: "Ballade No. 1", artist: "Chopin", composer: "F. F. Chopin", cover: 'covers/chopin-ballade-1.png', level: "Virtuoso", genre: "Classical", hands: 'both', tier: 3,
    licence: "CC BY-SA 4.0", typesetter: "Javier Ruiz-Alma", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1959", mutopiaId: 1959, heavy: true, shareAlike: true },
  { id: "chopin-fantaisie-impromptu", file: "mutopia/mutopia-1693-chopin-fantaisie-impromptu.mid", title: "Fantaisie-Impromptu", artist: "Chopin", composer: "F. F. Chopin", cover: 'covers/chopin-fantaisie-impromptu.png', level: "Virtuoso", genre: "Classical", hands: 'both', tier: 3,
    licence: "Public Domain", typesetter: "Guy D. Lederfein", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1693", mutopiaId: 1693 },
  { id: "liszt-ballade-2", file: "mutopia/mutopia-236-ballade.mid", title: "Ballade No. 2 in B minor", artist: "Liszt", composer: "F. Liszt", cover: 'covers/liszt-ballade-2.png', level: "Virtuoso", genre: "Classical", hands: 'both', tier: 3,
    licence: "Public Domain", typesetter: "Vassily Checkin", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=236", mutopiaId: 236, heavy: true },
  { id: "scriabin-etude-op2-1", file: "mutopia/mutopia-1029-scriabin-etude-2-1.mid", title: "Étude Op. 2 No. 1", artist: "Scriabin", composer: "A. Scriabin", cover: 'covers/scriabin-etude-op2-1.png', level: "Advanced", genre: "Classical", hands: 'both', tier: 2,
    licence: "Public Domain", typesetter: "Guy D. Lederfein", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1029", mutopiaId: 1029 },
  { id: "beethoven-appassionata-3", file: "mutopia/mutopia-937-lvb-sonate-57-3.mid", title: "Appassionata, 3rd mvt.", artist: "Beethoven", composer: "L. V. Beethoven", cover: 'covers/beethoven-appassionata-3.png', level: "Virtuoso", genre: "Classical", hands: 'both', tier: 3,
    licence: "Public Domain", typesetter: "Stelios Samelis", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=937", mutopiaId: 937, heavy: true },
  { id: "beethoven-sonata-32-1", file: "mutopia/mutopia-1022-lvb-sonate-111-1.mid", title: "Sonata No. 32, 1st mvt.", artist: "Beethoven", composer: "L. V. Beethoven", cover: 'covers/beethoven-sonata-32-1.png', level: "Virtuoso", genre: "Classical", hands: 'both', tier: 3,
    licence: "Public Domain", typesetter: "Stelios Samelis", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1022", mutopiaId: 1022 },
  { id: "beethoven-tempest-1", file: "mutopia/mutopia-1509-lvb-sonate-31no2-1.mid", title: "Tempest, 1st mvt.", artist: "Beethoven", composer: "L. V. Beethoven", cover: 'covers/beethoven-tempest-1.png', level: "Advanced", genre: "Classical", hands: 'both', tier: 2,
    licence: "Public Domain", typesetter: "Stelios Samelis", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1509", mutopiaId: 1509 },
  { id: "beethoven-pathetique-1", file: "mutopia/mutopia-299-pathetique-1.mid", title: "Pathétique, 1st mvt.", artist: "Beethoven", composer: "L. V. Beethoven", cover: 'covers/beethoven-pathetique-1.png', level: "Advanced", genre: "Classical", hands: 'both', tier: 2,
    licence: "Public Domain", typesetter: "Chris Sawer", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=299", mutopiaId: 299 },
  { id: "chopin-sonata-2-finale", file: "mutopia/mutopia-1727-chp-op-35-4-scholz-fi.mid", title: "Sonata No. 2, Finale", artist: "Chopin", composer: "F. F. Chopin", cover: 'covers/chopin-sonata-2-finale.png', level: "Virtuoso", genre: "Classical", hands: 'both', tier: 3,
    licence: "Public Domain", typesetter: "Roland Goretzki", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1727", mutopiaId: 1727 },
  { id: "chopin-raindrop", file: "mutopia/mutopia-471-chop-28-15.mid", title: "Raindrop Prelude", artist: "Chopin", composer: "F. F. Chopin", cover: 'covers/chopin-raindrop.png', level: "Advanced", genre: "Classical", hands: 'both', tier: 2,
    licence: "Public Domain", typesetter: "Magnus Lewis-Smith", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=471", mutopiaId: 471 },
  { id: "chopin-minute-waltz", file: "mutopia/mutopia-483-chopin-valse-op64-no1.mid", title: "Minute Waltz", artist: "Chopin", composer: "F. F. Chopin", cover: 'covers/chopin-minute-waltz.png', level: "Advanced", genre: "Classical", hands: 'both', tier: 2,
    licence: "Public Domain", typesetter: "Magnus Lewis-Smith", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=483", mutopiaId: 483 },
  { id: "chopin-waltz-op69-2", file: "mutopia/mutopia-511-w10-h-moll-cfi.mid", title: "Waltz in B minor", artist: "Chopin", composer: "F. F. Chopin", cover: 'covers/chopin-waltz-op69-2.png', level: "Advanced", genre: "Classical", hands: 'both', tier: 2,
    licence: "Public Domain", typesetter: "Roland Goretzki", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=511", mutopiaId: 511 },
  { id: "chopin-nocturne-op9-2", file: "mutopia-sa/mutopia-1590-chopin-nocturne-op9-n2.mid", title: "Nocturne Op. 9 No. 2", artist: "Chopin", composer: "F. F. Chopin", cover: 'covers/chopin-nocturne-op9-2.png', level: "Intermediate", genre: "Classical", hands: 'both', tier: 1,
    licence: "CC BY-SA 3.0", typesetter: "Renato Biolcati Rinaldi", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1590", mutopiaId: 1590, shareAlike: true },
  { id: "debussy-arabesque-1", file: "mutopia/mutopia-1777-debussy-arabesque-1.mid", title: "Arabesque No. 1", artist: "Debussy", composer: "C. Debussy", cover: 'covers/debussy-arabesque-1.png', level: "Advanced", genre: "Classical", hands: 'both', tier: 2,
    licence: "Public Domain", typesetter: "Keith OHara", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1777", mutopiaId: 1777 },
  { id: "debussy-clair-de-lune", file: "mutopia/mutopia-1778-debussy-ste-bergamesq-clair.mid", title: "Clair de Lune", artist: "Debussy", composer: "C. Debussy", cover: 'covers/debussy-clair-de-lune.png', level: "Advanced", genre: "Classical", hands: 'both', tier: 2,
    licence: "Public Domain", typesetter: "Keith OHara", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1778", mutopiaId: 1778 },
  { id: "rachmaninoff-prelude-c-sharp-minor", file: "mutopia-sa/mutopia-2033-rach-prelude-op3-no2.mid", title: "Prelude in C-sharp minor", artist: "Rachmaninoff", composer: "S. Rachmaninoff", cover: 'covers/rachmaninoff-prelude-c-sharp-minor.png', level: "Advanced", genre: "Classical", hands: 'both', tier: 2,
    licence: "CC BY-SA 4.0", typesetter: "Petro Kostandy", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2033", mutopiaId: 2033, shareAlike: true },
  { id: "rachmaninoff-prelude-op23-5", file: "mutopia-sa/mutopia-2001-rach-prelude23-05.mid", title: "Prelude Op. 23 No. 5", artist: "Rachmaninoff", composer: "S. Rachmaninoff", cover: 'covers/rachmaninoff-prelude-op23-5.png', level: "Virtuoso", genre: "Classical", hands: 'both', tier: 3,
    licence: "CC BY-SA 4.0", typesetter: "Joram Berger", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2001", mutopiaId: 2001, shareAlike: true },
  { id: "rachmaninoff-prelude-op23-2", file: "mutopia-sa/mutopia-1960-rach-prelude23-02.mid", title: "Prelude Op. 23 No. 2", artist: "Rachmaninoff", composer: "S. Rachmaninoff", cover: 'covers/rachmaninoff-prelude-op23-2.png', level: "Virtuoso", genre: "Classical", hands: 'both', tier: 3,
    licence: "CC BY-SA 4.0", typesetter: "Abel Cheung", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1960", mutopiaId: 1960, shareAlike: true },
  { id: "mozart-rondo-alla-turca", file: "mutopia/mutopia-108-kv331-3-rondoallaturca.mid", title: "Rondo alla Turca", artist: "Mozart", composer: "W. A. Mozart", cover: 'covers/mozart-rondo-alla-turca.png', level: "Intermediate", genre: "Classical", hands: 'both', tier: 1,
    licence: "Public Domain", typesetter: "Rune Zedeler and Chris Sawer", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=108", mutopiaId: 108 },
  { id: "mozart-fantasia-d-minor", file: "mutopia/mutopia-2034-fantasia.mid", title: "Fantasia in D minor", artist: "Mozart", composer: "W. A. Mozart", cover: 'covers/mozart-fantasia-d-minor.png', level: "Advanced", genre: "Classical", hands: 'both', tier: 2,
    licence: "Public Domain", typesetter: "Andrés Necochea", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2034", mutopiaId: 2034 },
  { id: "mozart-sonata-457-1", file: "mutopia/mutopia-356-sonata1.mid", title: "Sonata in C minor, 1st mvt.", artist: "Mozart", composer: "W. A. Mozart", cover: 'covers/mozart-sonata-457-1.png', level: "Advanced", genre: "Classical", hands: 'both', tier: 2,
    licence: "Public Domain", typesetter: "Will Oram", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=356", mutopiaId: 356 },
  { id: "mozart-sonata-facile-1", file: "mutopia-sa/mutopia-998-k545-1.mid", title: "Sonata Facile, 1st mvt.", artist: "Mozart", composer: "W. A. Mozart", cover: 'covers/mozart-sonata-facile-1.png', level: "Intermediate", genre: "Classical", hands: 'both', tier: 1,
    licence: "CC BY-SA 3.0", typesetter: "Alejandro Sierra", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=998", mutopiaId: 998, shareAlike: true },
  { id: "beethoven-fur-elise-full", file: "mutopia/mutopia-931-fur-elise-woo59.mid", title: "Für Elise (full)", artist: "Beethoven", composer: "L. V. Beethoven", cover: 'covers/beethoven-fur-elise-full.png', level: "Intermediate", genre: "Classical", hands: 'both', tier: 1,
    licence: "Public Domain", typesetter: "Stelios Samelis", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=931", mutopiaId: 931 },
  { id: "schubert-impromptu-90-1", file: "mutopia/mutopia-1192-schubertf-d899-1-impromptu.mid", title: "Impromptu Op. 90 No. 1", artist: "Schubert", composer: "F. Schubert", cover: 'covers/schubert-impromptu-90-1.png', level: "Advanced", genre: "Classical", hands: 'both', tier: 2,
    licence: "Public Domain", typesetter: "Ph. Raynaud", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1192", mutopiaId: 1192, heavy: true },
  { id: "schubert-impromptu-90-2", file: "mutopia/mutopia-1551-schubertf-d899-2-impromptu.mid", title: "Impromptu Op. 90 No. 2", artist: "Schubert", composer: "F. Schubert", cover: 'covers/schubert-impromptu-90-2.png', level: "Advanced", genre: "Classical", hands: 'both', tier: 2,
    licence: "Public Domain", typesetter: "Ph. Raynaud", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1551", mutopiaId: 1551 },
  { id: "schubert-impromptu-90-4", file: "mutopia/mutopia-1552-schubertf-d899-4-impromptu.mid", title: "Impromptu Op. 90 No. 4", artist: "Schubert", composer: "F. Schubert", cover: 'covers/schubert-impromptu-90-4.png', level: "Advanced", genre: "Classical", hands: 'both', tier: 2,
    licence: "Public Domain", typesetter: "Ph. Raynaud", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1552", mutopiaId: 1552 },
  { id: "schubert-impromptu-142-1", file: "mutopia/mutopia-1194-schubertf-d935-1-impromptu.mid", title: "Impromptu Op. 142 No. 1", artist: "Schubert", composer: "F. Schubert", cover: 'covers/schubert-impromptu-142-1.png', level: "Advanced", genre: "Classical", hands: 'both', tier: 2,
    licence: "Public Domain", typesetter: "Ph. Raynaud", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1194", mutopiaId: 1194, heavy: true },
  { id: "schubert-impromptu-142-2", file: "mutopia/mutopia-1195-schubertf-d935-2-impromptu.mid", title: "Impromptu Op. 142 No. 2", artist: "Schubert", composer: "F. Schubert", cover: 'covers/schubert-impromptu-142-2.png', level: "Advanced", genre: "Classical", hands: 'both', tier: 2,
    licence: "Public Domain", typesetter: "Ph. Raynaud", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1195", mutopiaId: 1195 },
  { id: "schubert-moment-musical-3", file: "mutopia/mutopia-1023-momentsno3.mid", title: "Moment Musical No. 3", artist: "Schubert", composer: "F. Schubert", cover: 'covers/schubert-moment-musical-3.png', level: "Intermediate", genre: "Classical", hands: 'both', tier: 1,
    licence: "Public Domain", typesetter: "Claude Chaudron", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1023", mutopiaId: 1023 },
  { id: "schumann-traumerei", file: "mutopia/mutopia-504-schumannop15no07.mid", title: "Träumerei", artist: "Schumann", composer: "R. Schumann", cover: 'covers/schumann-traumerei.png', level: "Intermediate", genre: "Classical", hands: 'both', tier: 1,
    licence: "Public Domain", typesetter: "Ying-Chun Liu", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=504", mutopiaId: 504 },
  { id: "brahms-intermezzo-118-2", file: "mutopia/mutopia-535-intermezzo.mid", title: "Intermezzo Op. 118 No. 2", artist: "Brahms", composer: "J. Brahms", cover: 'covers/brahms-intermezzo-118-2.png', level: "Advanced", genre: "Classical", hands: 'both', tier: 2,
    licence: "Public Domain", typesetter: "Aron Fay", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=535", mutopiaId: 535 },
  { id: "brahms-waltz-39-10", file: "mutopia/mutopia-2164-waltz-op39-10.mid", title: "Waltz Op. 39 No. 10", artist: "Brahms", composer: "J. Brahms", cover: 'covers/brahms-waltz-39-10.png', level: "Intermediate", genre: "Classical", hands: 'both', tier: 1,
    licence: "Public Domain", typesetter: "John Mamoun", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2164", mutopiaId: 2164 },
  { id: "grieg-mountain-king", file: "mutopia/mutopia-1888-dans-l-antre-du-roi-de-la-montagne.mid", title: "In the Hall of the Mountain King", artist: "Grieg", composer: "E. Grieg", cover: 'covers/grieg-mountain-king.png', level: "Intermediate", genre: "Classical", hands: 'both', tier: 1,
    licence: "Public Domain", typesetter: "Coyau", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1888", mutopiaId: 1888 },
  { id: "grieg-troldhaugen", file: "mutopia/mutopia-781-troldhaugen.mid", title: "Wedding Day at Troldhaugen", artist: "Grieg", composer: "E. Grieg", cover: 'covers/grieg-troldhaugen.png', level: "Advanced", genre: "Classical", hands: 'both', tier: 2,
    licence: "Public Domain", typesetter: "David Whipple", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=781", mutopiaId: 781 },
  { id: "grieg-troldtog", file: "mutopia/mutopia-2014-troldtog.mid", title: "March of the Dwarfs", artist: "Grieg", composer: "E. Grieg", cover: 'covers/grieg-troldtog.png', level: "Advanced", genre: "Classical", hands: 'both', tier: 2,
    licence: "Public Domain", typesetter: "Anonymous", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2014", mutopiaId: 2014 },
  { id: "tchaikovsky-dumka", file: "mutopia/mutopia-341-dumka.mid", title: "Dumka", artist: "Tchaikovsky", composer: "P. I. Tchaikovsky", cover: 'covers/tchaikovsky-dumka.png', level: "Virtuoso", genre: "Classical", hands: 'both', tier: 3,
    licence: "Public Domain", typesetter: "Vassily Checkin", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=341", mutopiaId: 341, heavy: true },
  { id: "mendelssohn-scherzo-e-minor", file: "mutopia/mutopia-1653-mendelssohn-scherzo-eminor.mid", title: "Scherzo in E minor", artist: "Mendelssohn", composer: "F. Mendelssohn-Bartholdy", cover: 'covers/mendelssohn-scherzo-e-minor.png', level: "Advanced", genre: "Classical", hands: 'both', tier: 2,
    licence: "Public Domain", typesetter: "Andrew C. Norman", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1653", mutopiaId: 1653 },
  { id: "joplin-maple-leaf-rag", file: "mutopia/mutopia-23-maple.mid", title: "Maple Leaf Rag", artist: "Joplin", composer: "S. Joplin", cover: 'covers/joplin-maple-leaf-rag.png', level: "Intermediate", genre: "Ragtime", hands: 'both', tier: 1,
    licence: "Public Domain", typesetter: "Chris Sawer", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=23", mutopiaId: 23 },
  { id: "joplin-the-entertainer", file: "mutopia/mutopia-263-entertainer.mid", title: "The Entertainer", artist: "Joplin", composer: "S. Joplin", cover: 'covers/joplin-the-entertainer.png', level: "Intermediate", genre: "Ragtime", hands: 'both', tier: 1,
    licence: "Public Domain", typesetter: "Chris Sawer", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=263", mutopiaId: 263 },
  { id: "bach-prelude-c-bwv846", file: "mutopia/mutopia-5-wtk1-prelude1.mid", title: "Prelude in C (BWV 846)", artist: "Bach", composer: "J. S. Bach", cover: 'covers/bach-prelude-c-bwv846.png', level: "Intermediate", genre: "Classical", hands: 'both', tier: 1,
    licence: "Public Domain", typesetter: "Tobias Erbsland", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=5", mutopiaId: 5 },
  { id: "bach-toccata-bwv910", file: "mutopia/mutopia-1814-bwv910.mid", title: "Toccata in F-sharp minor", artist: "Bach", composer: "J. S. Bach", cover: 'covers/bach-toccata-bwv910.png', level: "Advanced", genre: "Classical", hands: 'both', tier: 2,
    licence: "Public Domain", typesetter: "Imre Polik", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1814", mutopiaId: 1814, heavy: true },
  { id: "bach-invention-13", file: "mutopia/mutopia-59-bach-invention-13.mid", title: "Invention No. 13", artist: "Bach", composer: "J. S. Bach", cover: 'covers/bach-invention-13.png', level: "Intermediate", genre: "Classical", hands: 'both', tier: 1,
    licence: "Public Domain", typesetter: "Allen Garvin", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=59", mutopiaId: 59 },
  { id: "liszt-consolation-3", file: "mutopia/mutopia-1647-liszt-consolation-no3.mid", title: "Consolation No. 3", artist: "Liszt", composer: "F. Liszt", cover: 'covers/liszt-consolation-3.png', level: "Advanced", genre: "Classical", hands: 'both', tier: 2,
    licence: "CC BY 3.0", typesetter: "Ryan Prince", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1647", mutopiaId: 1647 },
  { id: "liszt-consolation-1", file: "mutopia/mutopia-1654-liszt-consolation-no1.mid", title: "Consolation No. 1", artist: "Liszt", composer: "F. Liszt", cover: 'covers/liszt-consolation-1.png', level: "Intermediate", genre: "Classical", hands: 'both', tier: 1,
    licence: "CC BY 3.0", typesetter: "Ryan Prince", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1654", mutopiaId: 1654 },
  { id: "liszt-consolation-4", file: "mutopia/mutopia-1650-liszt-consolation-no4.mid", title: "Consolation No. 4", artist: "Liszt", composer: "F. Liszt", cover: 'covers/liszt-consolation-4.png', level: "Intermediate", genre: "Classical", hands: 'both', tier: 1,
    licence: "CC BY 3.0", typesetter: "Ryan Prince", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1650", mutopiaId: 1650 },
  { id: "joplin-pineapple-rag", file: "mutopia/mutopia-1899-pineapplerag.mid", title: "Pineapple Rag", artist: "Joplin", composer: "S. Joplin", cover: 'covers/joplin-pineapple-rag.png', level: "Intermediate", genre: "Ragtime", hands: 'both', tier: 1,
    licence: "Public Domain", typesetter: "Coyau", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1899", mutopiaId: 1899 },
  { id: "joplin-elite-syncopations", file: "mutopia/mutopia-1540-elitesyncopations.mid", title: "Elite Syncopations", artist: "Joplin", composer: "S. Joplin", cover: 'covers/joplin-elite-syncopations.png', level: "Intermediate", genre: "Ragtime", hands: 'both', tier: 1,
    licence: "Public Domain", typesetter: "Benjamin Bloomfield", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1540", mutopiaId: 1540 },
  { id: "joplin-breeze-from-alabama", file: "mutopia/mutopia-485-a-breeze-from-alabama.mid", title: "A Breeze from Alabama", artist: "Joplin", composer: "S. Joplin", cover: 'covers/joplin-breeze-from-alabama.png', level: "Intermediate", genre: "Ragtime", hands: 'both', tier: 1,
    licence: "Public Domain", typesetter: "Daniel Škarda", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=485", mutopiaId: 485 },
  { id: "joplin-magnetic-rag", file: "mutopia/mutopia-441-magnetic.mid", title: "Magnetic Rag", artist: "Joplin", composer: "S. Joplin", cover: 'covers/joplin-magnetic-rag.png', level: "Advanced", genre: "Ragtime", hands: 'both', tier: 2,
    licence: "Public Domain", typesetter: "Kurt Holtrop", source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=441", mutopiaId: 441, heavy: true },
]

// Default performance tempo: many files sit at a flat default tempo, so each piece may carry a
// tempoScale (multiplier on the file tempo; <1 slower) chosen from its typical performance length.
// `long` marks a piece that may exceed 12 minutes. Reasoning per piece: docs/SONG-TEMPOS.md.
const TEMPO = {
  'chopin-etude-op10-12': { tempoScale: 0.84 },
  'chopin-etude-op10-1': { tempoScale: 0.86 },
  'chopin-ballade-4': { tempoScale: 1.16 },
  'chopin-ballade-1': { tempoScale: 1.16 },
  'chopin-fantaisie-impromptu': { tempoScale: 0.85 },
  'liszt-ballade-2': { tempoScale: 1.66, long: true },
  'chopin-raindrop': { tempoScale: 0.74 },
  'chopin-minute-waltz': { tempoScale: 0.82 },
  'chopin-nocturne-op9-2': { tempoScale: 0.79 },
  'debussy-clair-de-lune': { tempoScale: 1.08 },
  'rachmaninoff-prelude-c-sharp-minor': { tempoScale: 0.82 },
  'mozart-rondo-alla-turca': { tempoScale: 1.42 },
  'beethoven-fur-elise-full': { tempoScale: 0.77 },
  'schumann-traumerei': { tempoScale: 0.74 },
  'brahms-intermezzo-118-2': { tempoScale: 0.87 },
  'mendelssohn-scherzo-e-minor': { tempoScale: 1.59 },
  'joplin-maple-leaf-rag': { tempoScale: 0.8 },
  'bach-toccata-bwv910': { tempoScale: 1.31 },
  'liszt-consolation-3': { tempoScale: 0.81 },
  'liszt-consolation-1': { tempoScale: 0.66 },
  'liszt-consolation-4': { tempoScale: 0.73 },
  'joplin-pineapple-rag': { tempoScale: 0.89 },
  'joplin-elite-syncopations': { tempoScale: 1.48 },
  'joplin-magnetic-rag': { tempoScale: 2.62 },
}
for (const s of MUTOPIA_SONGS) if (TEMPO[s.id]) Object.assign(s, TEMPO[s.id])

// Apply a tempoScale to a parsed song: every time and the tempo move together, so the length,
// falling-note speed and speed buttons all treat the song as if it had been played at that tempo.
export function applyTempoScale(song, scale) {
  if (!(scale > 0) || scale === 1) return song
  const k = 1 / scale
  for (const n of song.notes) { n.start *= k; n.dur *= k }
  song.duration *= k
  song.tempo = Math.max(20, Math.min(400, song.tempo * scale))
  if (Array.isArray(song.bars)) song.bars = song.bars.map((t) => t * k)
  return song
}


// the credit line shown with the song: who typeset it and under which licence
export function mutopiaCredit(s) {
  const by = s.typesetter ? ' · typeset by ' + s.typesetter + ' via Mutopia Project' : ' · via Mutopia Project'
  if (s.licence === 'Public Domain') return 'Public domain' + by
  if (s.shareAlike) return s.licence + by.replace(' · typeset by ', ' · ') + ' · share-alike data file'
  return s.licence + by.replace(' · typeset by ', ' · ')
}
