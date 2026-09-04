// Seeds northridge.db with believable sample data.
//
// This is a full RESET: it drops every existing object, re-applies schema.sql,
// and re-inserts sample data — all so that running `npm run db:reset` twice in
// a row yields an identical, clean database (no duplicate-key errors, no drift).
//
// Run with:  npm run db:reset   (do NOT run while the dev servers hold the DB open)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { openDb, closeAll } from '../shared/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaSql = readFileSync(join(__dirname, 'schema.sql'), 'utf8');

const db = openDb();

// --- Reset: drop all existing objects -------------------------------------
// FK enforcement must be OFF while we drop (order-independent), and PRAGMA
// changes are no-ops inside a transaction, so toggle it out here.
db.exec('PRAGMA foreign_keys = OFF;');
const existing = db
  .prepare(
    "SELECT type, name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND type IN ('view','table')",
  )
  .all();
// Drop views before tables.
for (const o of existing.filter((o) => o.type === 'view')) {
  db.exec(`DROP VIEW IF EXISTS "${o.name}";`);
}
for (const o of existing.filter((o) => o.type === 'table')) {
  db.exec(`DROP TABLE IF EXISTS "${o.name}";`);
}

// Recreate schema, then re-enable FK enforcement for the inserts.
db.exec(schemaSql);
db.exec('PRAGMA foreign_keys = ON;');

// --- Small insert helpers --------------------------------------------------
/** Insert a lookup row, return its id. */
function lookup(table, name) {
  return Number(
    db.prepare(`INSERT INTO ${table} (name) VALUES (?)`).run(name).lastInsertRowid,
  );
}

// --- Seed data (wrapped in one transaction for speed + atomicity) ----------
db.exec('BEGIN;');
try {
  // ===== VIDEO =====================================================
  const vGenre = {
    scifi: lookup('video_genre', 'Science Fiction'),
    horror: lookup('video_genre', 'Horror'),
    action: lookup('video_genre', 'Action'),
    drama: lookup('video_genre', 'Drama'),
  };
  const director = {
    venheim: lookup('director', 'Marla Venheim'),
    karric: lookup('director', 'Dolph Karric'),
    anandsol: lookup('director', 'Priya Anand-Sol'),
    wexley: lookup('director', 'Casper Wexley'),
  };
  const studio = {
    orbital: lookup('studio', 'Orbital Crown Films'),
    nineharbor: lookup('studio', 'Nine Harbor Pictures'),
    vermillion: lookup('studio', 'Vermillion Reel Studios'),
  };
  const vp = {
    coyle: lookup('video_person', 'Renna Coyle'),
    frank: lookup('video_person', 'Tobias Frank'),
    vane: lookup('video_person', 'Marisol Vane'),
    kemper: lookup('video_person', 'Idris Kemper'),
    dohring: lookup('video_person', 'Whit Dohring'),
    ng: lookup('video_person', 'Sable Ng'),
    aldous: lookup('video_person', 'Corin Aldous'),
    malick: lookup('video_person', 'Petra Malick'),
    reeve: lookup('video_person', 'Jonas Reeve'),
    ashcroft: lookup('video_person', 'Delia Ashcroft'),
  };

  const insVideo = db.prepare(
    `INSERT INTO videos (sku, title, format, director_id, studio_id, genre_id, release_date, description, price_cents)
     VALUES (@sku, @title, @format, @director_id, @studio_id, @genre_id, @release_date, @description, @price_cents)`,
  );
  const insCast = db.prepare(
    'INSERT INTO video_cast (video_sku, person_id, ord) VALUES (?, ?, ?)',
  );

  function video(sku, row, cast = []) {
    insVideo.run({
      sku,
      director_id: null,
      studio_id: null,
      genre_id: null,
      release_date: null,
      description: null,
      ...row,
    });
    cast.forEach((personId, i) => insCast.run(sku, personId, i));
  }

  video(
    'VID-000001',
    {
      title: 'Nightfall on Cygnus',
      format: 'dvd',
      director_id: director.venheim,
      studio_id: studio.orbital,
      genre_id: vGenre.scifi,
      release_date: '1981-03-14',
      description: 'A salvage crew wakes to find their station drifting off course.',
      price_cents: 1499,
    },
    [vp.coyle, vp.frank],
  );
  video(
    'VID-000002',
    {
      title: 'The Tin Coyote',
      format: 'vhs',
      director_id: director.karric,
      studio_id: studio.nineharbor,
      genre_id: vGenre.action,
      release_date: '1988-07-22',
      description: 'A drifter and two mechanics outrun a desert cartel.',
      price_cents: 999,
    },
    [vp.vane, vp.kemper, vp.dohring],
  );
  video(
    'VID-000003',
    {
      title: 'Gearbreaker',
      format: 'dvd',
      director_id: director.karric,
      genre_id: vGenre.scifi,
      release_date: '1990-10-05',
      description: 'A factory android develops a conscience on the assembly line.',
      price_cents: 1299,
    },
    [vp.kemper, vp.ng, vp.frank],
  );
  video(
    'VID-000004',
    {
      title: 'Deepwater Hollow',
      format: 'vhs',
      director_id: director.wexley,
      studio_id: studio.vermillion,
      genre_id: vGenre.horror,
      release_date: '1985-08-30',
      description: 'A lakeside town keeps a very old, very hungry secret.',
      price_cents: 899,
    },
    [vp.aldous, vp.malick],
  );
  video(
    'VID-000005',
    {
      title: 'The Quiet Tenant',
      format: 'dvd',
      director_id: director.anandsol,
      studio_id: studio.vermillion,
      genre_id: vGenre.drama,
      release_date: '1993-11-19',
      description: 'A landlord slowly realizes his new renter is never seen leaving.',
      price_cents: 1199,
    },
    [vp.reeve, vp.ashcroft],
  );
  // Hardware — media-only FKs left null.
  video('VID-000006', {
    title: 'Corvex DV-210 Disc Player',
    format: 'player',
    description: 'Upscaling disc player with digital output.',
    price_cents: 4999,
  });
  video('VID-000007', {
    title: 'Halcyon 4-Head Tape Deck',
    format: 'player',
    description: 'Play back your classic tape collection.',
    price_cents: 6999,
  });
  video('VID-000008', {
    title: 'Corvex 20-inch Tube Display',
    format: 'tv',
    description: 'Authentic retro picture for your media room.',
    price_cents: 12999,
  });

  // ===== MUSIC =====================================================
  const mGenre = {
    rock: lookup('music_genre', 'Rock'),
    jazz: lookup('music_genre', 'Jazz'),
    hiphop: lookup('music_genre', 'Hip-Hop'),
    pop: lookup('music_genre', 'Pop'),
  };
  const artist = {
    lanterns: lookup('artist', 'The Paper Lanterns'),
    marchetti: lookup('artist', 'Odile Marchetti'),
    brassunion: lookup('artist', 'Brass Union Collective'),
    halcomb: lookup('artist', 'Junior Halcomb'),
  };
  const label = {
    sundog: lookup('record_label', 'Sundog Records'),
    cobalt: lookup('record_label', 'Cobalt Row'),
    meridian: lookup('record_label', 'Meridian Tapes'),
  };

  const insMusic = db.prepare(
    `INSERT INTO music (sku, title, format, artist_id, label_id, genre_id, release_date, description, price_cents)
     VALUES (@sku, @title, @format, @artist_id, @label_id, @genre_id, @release_date, @description, @price_cents)`,
  );
  function music(sku, row) {
    insMusic.run({
      sku,
      artist_id: null,
      label_id: null,
      genre_id: null,
      release_date: null,
      description: null,
      ...row,
    });
  }

  music('MUS-000001', {
    title: 'Amber Static',
    format: 'vinyl',
    artist_id: artist.lanterns,
    label_id: label.sundog,
    genre_id: mGenre.rock,
    release_date: '1979-04-02',
    description: 'Remastered on 180g vinyl.',
    price_cents: 2499,
  });
  music('MUS-000002', {
    title: 'Blue Notebook',
    format: 'vinyl',
    artist_id: artist.marchetti,
    label_id: label.cobalt,
    genre_id: mGenre.jazz,
    release_date: '1963-09-17',
    description: 'A late-night quartet session, pressed to audiophile vinyl.',
    price_cents: 2699,
  });
  music('MUS-000003', {
    title: 'Concrete Gardens',
    format: 'cd',
    artist_id: artist.brassunion,
    label_id: label.cobalt,
    genre_id: mGenre.hiphop,
    release_date: '1994-06-21',
    description: 'Horn-driven beats from the collective\u2019s debut.',
    price_cents: 1399,
  });
  music('MUS-000004', {
    title: 'Neon Sundays',
    format: 'cassette',
    artist_id: artist.halcomb,
    label_id: label.meridian,
    genre_id: mGenre.pop,
    release_date: '1986-12-01',
    description: 'On genuine retro cassette tape.',
    price_cents: 799,
  });
  // Hardware.
  music('MUS-000005', {
    title: 'Sundog TT-1 Belt-Drive Turntable',
    format: 'turntable',
    description: 'Fully automatic belt-drive turntable.',
    price_cents: 14999,
  });
  music('MUS-000006', {
    title: 'Meridian M2 Bookshelf Speakers',
    format: 'speakers',
    description: 'Powered bookshelf speakers, pair.',
    price_cents: 11999,
  });

  // ===== BOOKS =====================================================
  const bGenre = {
    fantasy: lookup('book_genre', 'Fantasy'),
    scifi: lookup('book_genre', 'Science Fiction'),
  };
  const publisher = {
    ashgrove: lookup('publisher', 'Ashgrove House'),
    tandem: lookup('publisher', 'Tandem & Vale'),
    hollowpine: lookup('publisher', 'Hollow Pine Press'),
  };
  const author = {
    calloway: lookup('author', 'Neve Calloway'),
    tamblin: lookup('author', 'Rex Tamblin'),
    fairweather: lookup('author', 'Ondine Fairweather'),
    bellweather: lookup('author', 'Marcus Bellweather'),
  };

  const insBook = db.prepare(
    `INSERT INTO books (sku, title, format, publisher_id, genre_id, isbn, release_date, description, price_cents)
     VALUES (@sku, @title, @format, @publisher_id, @genre_id, @isbn, @release_date, @description, @price_cents)`,
  );
  const insAuthor = db.prepare(
    'INSERT INTO book_authors (book_sku, author_id, ord) VALUES (?, ?, ?)',
  );
  function book(sku, row, authors = []) {
    insBook.run({
      sku,
      publisher_id: null,
      genre_id: null,
      isbn: null,
      release_date: null,
      description: null,
      ...row,
    });
    authors.forEach((authorId, i) => insAuthor.run(sku, authorId, i));
  }

  // Multi-author title.
  book(
    'BK-000001',
    {
      title: 'The Salt Kings',
      format: 'paperback',
      publisher_id: publisher.ashgrove,
      genre_id: bGenre.fantasy,
      isbn: '979-8-40000-001-7',
      release_date: '1997-05-01',
      description: 'Two rival dynasties war over the last inland sea.',
      price_cents: 1599,
    },
    [author.calloway, author.tamblin],
  );
  book(
    'BK-000002',
    {
      title: 'Ghost Circuit',
      format: 'paperback',
      publisher_id: publisher.tandem,
      genre_id: bGenre.scifi,
      isbn: '979-8-40000-002-4',
      release_date: '2001-07-01',
      description: 'A courier smuggles a dead programmer\u2019s last memory.',
      price_cents: 1299,
    },
    [author.fairweather],
  );
  book(
    'BK-000003',
    {
      title: "The Cartographer's Widow",
      format: 'hardcover',
      publisher_id: publisher.hollowpine,
      genre_id: bGenre.fantasy,
      isbn: '979-8-40000-003-1',
      release_date: '2005-08-01',
      description: 'She inherits maps of places that do not exist yet.',
      price_cents: 2999,
    },
    [author.bellweather],
  );
  book(
    'BK-000004',
    {
      title: 'Vessels of Small Gods',
      format: 'hardcover',
      publisher_id: publisher.ashgrove,
      genre_id: bGenre.fantasy,
      isbn: '979-8-40000-004-8',
      release_date: '2009-01-01',
      description: 'A potter discovers her kiln fires souls into clay.',
      price_cents: 1999,
    },
    [author.calloway],
  );

  // ===== GENERATED CATALOG =========================================
  // The curated items above (VID-000001..8, MUS-000001..6, BK-000001..4)
  // stay fixed so test fixtures hold. Everything below is generated from
  // sample component pools with a deterministic seeded RNG, so the catalog
  // is large, varied, and fully reproducible.

  let _seed = 0x4e5256; // 'NRV'
  function rnd() {
    _seed = (_seed * 1103515245 + 12345) & 0x7fffffff;
    return _seed / 0x7fffffff;
  }
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const randint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  function sample(arr, n) {
    const copy = arr.slice();
    const out = [];
    while (out.length < n && copy.length) {
      out.push(copy.splice(Math.floor(rnd() * copy.length), 1)[0]);
    }
    return out;
  }
  function isoDate(minYear, maxYear) {
    const y = randint(minYear, maxYear);
    const m = String(randint(1, 12)).padStart(2, '0');
    const d = String(randint(1, 28)).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Resolve (or create) a lookup row by name, caching ids and tolerating
  // collisions with the curated rows above.
  const idCache = Object.create(null);
  function ref(table, name) {
    const key = table + '|' + name;
    if (idCache[key]) return idCache[key];
    const found = db.prepare(`SELECT id FROM ${table} WHERE name = ?`).get(name);
    const id = found
      ? found.id
      : Number(db.prepare(`INSERT INTO ${table} (name) VALUES (?)`).run(name).lastInsertRowid);
    idCache[key] = id;
    return id;
  }

  // Sample name pool (First Last), reused across roles for realism.
  const FIRST = ['Renna','Tobias','Marisol','Idris','Whit','Sable','Corin','Petra','Jonas','Delia','Neve','Rex','Ondine','Marcus','Odile','Priya','Casper','Dolph','Marla','Cleo','Ravi','Ingrid','Milo','Yara','Soren','Nadia','Emmett','Lena','Cyrus','Beatrix','Elias','Freya','Hugo','Iris','Kofi','Lucia','Mateo','Noor','Otis','Rosa','Silas','Talia','Viktor','Wren','Zara','Anouk','Bram','Esme'];
  const LAST = ['Coyle','Frank','Vane','Kemper','Dohring','Aldous','Malick','Reeve','Ashcroft','Calloway','Tamblin','Fairweather','Bellweather','Brandt','Okafor','Lindqvist','Sato','Delgado','Rourke','Prentice','Vasquez','Holloway','Merrick','Yoon','Castellan','Beaumont','Ellsworth','Nakamura','Okonkwo','Sandoval','Trent','Ambrose','Falk','Greer','Hawthorne','Ives','Jarrah','Nilsen','Petrov','Quill','Rasmussen','Solano','Thorne','Ueda','Varga'];
  function makeNames(n) {
    const set = new Set();
    while (set.size < n) set.add(pick(FIRST) + ' ' + pick(LAST));
    return [...set];
  }

  // Distinct people/company pools (reused across items -> realistic).
  const castPool = makeNames(40);
  const directorPool = makeNames(12);
  const authorPool = makeNames(26);
  const studioPool = ['Orbital Crown Films','Nine Harbor Pictures','Vermillion Reel Studios','Halcyon Pictures','Blackpine Motion','Cobalt Lantern Films','Meridian Reel Co.','Sundown Cinema'];
  const labelPool = ['Sundog Records','Cobalt Row','Meridian Tapes','Wax Museum Records','Saltwater Sound','Paper Street Records','Ninth Ward Music','Gilded Fox Audio'];
  const publisherPool = ['Ashgrove House','Tandem & Vale','Hollow Pine Press','Blackwater Books','Marrow & Sons','Verren House','Gilded Fox Press','Northwind Publishing'];
  const artistPool = ['The Paper Lanterns','Odile Marchetti','Brass Union Collective','Junior Halcomb','The Wax Museums','Marble Arch','Neon Cartography','The Saltwater Choir','Velvet Static','Cass Merrow','The Tin Orchards','Delphine Roe','Ash & Ember','The Ninth Ward','Cobalt Sunday','Harlan Frost','The Paper Kites Society','Mira Vale','The Longwave','Kestrel Grey'];

  const videoGenres = ['Science Fiction','Horror','Action','Drama','Thriller','Comedy','Western','Mystery','Fantasy','War'];
  const musicGenres = ['Rock','Jazz','Hip-Hop','Pop','Blues','Folk','Electronic','Soul','Country','Punk'];
  const bookGenres = ['Fantasy','Science Fiction','Mystery','Thriller','History','Horror','Romance','Poetry','Biography'];

  // ---- Title generators (composed from word pools) --
  const vAdj = ['Silent','Crimson','Hollow','Broken','Last','Midnight','Iron','Velvet','Frozen','Burning','Distant','Savage','Quiet','Golden','Restless','Phantom','Shattered','Wandering','Pale','Feral','Endless','Cold','Electric'];
  const vNoun = ['Harbor','Signal','Empire','Mirage','Highway','Cathedral','Machine','Requiem','Horizon','Vendetta','Paradox','Exile','Frontier','Reckoning','Voyage','Circuit','Tempest','Meridian','Sabotage','Lantern','Threshold','Verdict','Cascade','Hollow'];
  const places = ['the North','Ash Valley','Cygnus','Harrow County','Delphi Station','Cobalt City','Port Verren','the Ninth Ward','Gallows Bend','Saint Merrow'];
  function videoTitle() {
    switch (randint(0, 2)) {
      case 0: return pick(vAdj) + ' ' + pick(vNoun);
      case 1: return 'The ' + pick(vNoun);
      default: return pick(vNoun) + ' of ' + pick(places);
    }
  }

  const mAdj = ['Amber','Cobalt','Velvet','Neon','Midnight','Golden','Silver','Electric','Hollow','Saltwater','Moonlit','Concrete','Crimson','Wild','Paper','Distant','Slow','Bright'];
  const mNoun = ['Static','Gardens','Sundays','Notebook','Harbor','Avenue','Machines','Echoes','Lanterns','Ghosts','Rivers','Signals','Basement','Orchard','Frequencies','Parade','Tides','Weather','Antenna','Cinema'];
  function musicTitle() {
    return randint(0, 1)
      ? pick(mAdj) + ' ' + pick(mNoun)
      : pick(mNoun) + ' & ' + pick(mNoun);
  }

  const bNoun = ['Cartographer','Widow','Salt','Kings','Circuit','Vessels','Lighthouse','Almanac','Clockwork','Orchard','Cipher','Marrow','Archive','Tide','Ember','Reliquary','Meridian','Fable','Cartography','Hollow','Aviary','Glasshouse'];
  function bookTitle() {
    switch (randint(0, 2)) {
      case 0: return 'The ' + pick(bNoun) + ' of ' + pick(bNoun);
      case 1: return 'The ' + pick(bNoun) + "'s " + pick(bNoun);
      default: return pick(vAdj) + ' ' + pick(bNoun);
    }
  }

  const vHardware = [
    ['Corvex DV-%N Disc Player', 'player'],
    ['Halcyon %N-Head Tape Deck', 'player'],
    ['Vantex VHS-%N VCR', 'player'],
    ['Kestrel DVD-%N Player', 'player'],
    ['Corvex %N-inch Tube Display', 'tv'],
    ['Aurex CRT-%N Television', 'tv'],
    ['Belmont Combo VCR/DVD %N', 'player'],
  ];
  const mHardware = [
    ['Sundog TT-%N Belt-Drive Turntable', 'turntable'],
    ['Meridian M%N Bookshelf Speakers', 'speakers'],
    ['Vantex DD-%N Direct-Drive Turntable', 'turntable'],
    ['Halcyon HS-%N Studio Monitors', 'speakers'],
    ['Kestrel PT-%N Portable Turntable', 'turntable'],
  ];

  const usedV = new Set(db.prepare('SELECT title FROM videos').all().map((r) => r.title));
  const usedM = new Set(db.prepare('SELECT title FROM music').all().map((r) => r.title));
  const usedB = new Set(db.prepare('SELECT title FROM books').all().map((r) => r.title));
  const uniq = (gen, seen) => {
    let t;
    let tries = 0;
    do {
      t = gen();
      tries++;
    } while (seen.has(t) && tries < 50);
    seen.add(t);
    return t;
  };

  let isbnCounter = 5; // continue after the curated 979-8-40000-0000X
  function nextIsbn() {
    return '979-8-40000-' + String(isbnCounter++).padStart(5, '0').replace(/(\d{4})(\d)/, '$1-$2');
  }

  // ---- Generate VIDEO: 27 films + 6 hardware (curated 8 -> total 41) ------
  let vSku = 9;
  const vSku6 = () => 'VID-' + String(vSku++).padStart(6, '0');
  for (let i = 0; i < 27; i++) {
    const fmt = rnd() < 0.6 ? 'dvd' : 'vhs';
    const price = fmt === 'dvd' ? randint(999, 2499) : randint(699, 1499);
    video(
      vSku6(),
      {
        title: uniq(videoTitle, usedV),
        format: fmt,
        director_id: ref('director', pick(directorPool)),
        studio_id: ref('studio', pick(studioPool)),
        genre_id: ref('video_genre', pick(videoGenres)),
        release_date: isoDate(1968, 1999),
        description: 'A ' + pick(videoGenres).toLowerCase() + ' feature from the Northridge vault.',
        price_cents: price,
      },
      sample(castPool, randint(2, 3)).map((n) => ref('video_person', n)),
    );
  }
  for (let i = 0; i < 6; i++) {
    const [tpl, fmt] = pick(vHardware);
    video(vSku6(), {
      title: tpl.replace('%N', String(randint(100, 999))),
      format: fmt,
      description: fmt === 'tv' ? 'Retro tube television for the media room.' : 'Playback hardware for your collection.',
      price_cents: randint(3999, 19999),
    });
  }

  // ---- Generate MUSIC: 31 media + 6 hardware (curated 6 -> total 43) ------
  let mSku = 7;
  const mSku6 = () => 'MUS-' + String(mSku++).padStart(6, '0');
  const mFormats = ['vinyl', 'vinyl', 'cd', 'cassette'];
  for (let i = 0; i < 31; i++) {
    const fmt = pick(mFormats);
    const price = fmt === 'vinyl' ? randint(1999, 3499) : fmt === 'cd' ? randint(999, 1699) : randint(699, 1199);
    music(mSku6(), {
      title: uniq(musicTitle, usedM),
      format: fmt,
      artist_id: ref('artist', pick(artistPool)),
      label_id: ref('record_label', pick(labelPool)),
      genre_id: ref('music_genre', pick(musicGenres)),
      release_date: isoDate(1965, 1998),
      description: 'A ' + pick(musicGenres).toLowerCase() + ' release, reissued for the shop.',
      price_cents: price,
    });
  }
  for (let i = 0; i < 6; i++) {
    const [tpl, fmt] = pick(mHardware);
    music(mSku6(), {
      title: tpl.replace('%N', String(randint(1, 90))),
      format: fmt,
      description: fmt === 'turntable' ? 'Turntable for vinyl playback.' : 'Powered speakers, sold as a pair.',
      price_cents: randint(7999, 24999),
    });
  }

  // ---- Generate BOOKS: 35 (curated 4 -> total 39) ------------------------
  let bSku = 5;
  const bSku6 = () => 'BK-' + String(bSku++).padStart(6, '0');
  for (let i = 0; i < 35; i++) {
    const fmt = rnd() < 0.5 ? 'paperback' : 'hardcover';
    const price = fmt === 'hardcover' ? randint(1899, 3299) : randint(999, 1799);
    book(
      bSku6(),
      {
        title: uniq(bookTitle, usedB),
        format: fmt,
        publisher_id: ref('publisher', pick(publisherPool)),
        genre_id: ref('book_genre', pick(bookGenres)),
        isbn: nextIsbn(),
        release_date: isoDate(1980, 2015),
        description: 'A ' + pick(bookGenres).toLowerCase() + ' title from the Northridge shelves.',
        price_cents: price,
      },
      // ~20% of books have two authors.
      sample(authorPool, rnd() < 0.2 ? 2 : 1).map((n) => ref('author', n)),
    );
  }

  db.exec('COMMIT;');
} catch (err) {
  db.exec('ROLLBACK;');
  closeAll();
  console.error('Seed failed:', err);
  process.exit(1);
}

// --- Summary ---------------------------------------------------------------
const counts = {
  videos: db.prepare('SELECT count(*) c FROM videos').get().c,
  music: db.prepare('SELECT count(*) c FROM music').get().c,
  books: db.prepare('SELECT count(*) c FROM books').get().c,
};
closeAll();
console.log(
  `Seeded northridge.db \u2014 ${counts.videos} videos, ${counts.music} music, ${counts.books} books.`,
);
