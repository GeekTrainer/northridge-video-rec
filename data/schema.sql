-- Northridge Video — schema for the single shared northridge.db
--
-- Design notes:
--   * Fully normalized: descriptive entities (genre, artist, label, director,
--     studio, publisher, people) are lookup tables referenced by FK, never
--     free-text. Books-authors and film-cast are many-to-many join tables.
--   * Each department owns its own lookup + people tables (no shared global
--     `person`), since each app is built and deployed independently.
--   * SKUs are GLOBALLY UNIQUE (prefixed VID-/MUS-/BK-) so the browser cart
--     can key on sku alone.
--   * Hardware (players, TVs, turntables, speakers) lives inside its vertical
--     as a `format` value; its media-only FKs (director/artist/genre/...) are
--     NULLABLE and left null for hardware rows.
--   * Convenience views flatten joins (deterministic group_concat) so service
--     code reads flat rows; the unified `catalog` view powers gateway search.
--
-- Requires `PRAGMA foreign_keys = ON` per connection (handled by shared/db.js).

--------------------------------------------------------------------------------
-- VIDEO vertical
--------------------------------------------------------------------------------
CREATE TABLE video_genre (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE director (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE studio (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- People who appear in videos (cast). Kept separate from `director`.
CREATE TABLE video_person (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE videos (
  sku          TEXT PRIMARY KEY,               -- e.g. 'VID-000001'
  title        TEXT NOT NULL,
  format       TEXT NOT NULL                   -- dvd | vhs | player | tv
                 CHECK (format IN ('dvd', 'vhs', 'player', 'tv')),
  director_id  INTEGER REFERENCES director(id),      -- null for hardware
  studio_id    INTEGER REFERENCES studio(id),        -- null for hardware
  genre_id     INTEGER REFERENCES video_genre(id),   -- null for hardware
  release_date TEXT,                            -- ISO 8601 'YYYY-MM-DD'
  description  TEXT,
  price_cents  INTEGER NOT NULL CHECK (price_cents >= 0)
);

-- Film cast (many-to-many). `ord` gives deterministic billing order.
CREATE TABLE video_cast (
  video_sku TEXT NOT NULL REFERENCES videos(sku) ON DELETE CASCADE,
  person_id INTEGER NOT NULL REFERENCES video_person(id),
  ord       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (video_sku, person_id)
);

--------------------------------------------------------------------------------
-- MUSIC vertical
--------------------------------------------------------------------------------
CREATE TABLE music_genre (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE artist (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE record_label (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE music (
  sku          TEXT PRIMARY KEY,               -- e.g. 'MUS-000001'
  title        TEXT NOT NULL,
  format       TEXT NOT NULL                   -- vinyl | cd | cassette | turntable | speakers
                 CHECK (format IN ('vinyl', 'cd', 'cassette', 'turntable', 'speakers')),
  artist_id    INTEGER REFERENCES artist(id),        -- null for hardware
  label_id     INTEGER REFERENCES record_label(id),  -- null for hardware
  genre_id     INTEGER REFERENCES music_genre(id),   -- null for hardware
  release_date TEXT,
  description  TEXT,
  price_cents  INTEGER NOT NULL CHECK (price_cents >= 0)
);

--------------------------------------------------------------------------------
-- BOOKS vertical
--------------------------------------------------------------------------------
CREATE TABLE book_genre (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE publisher (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE author (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE books (
  sku          TEXT PRIMARY KEY,               -- e.g. 'BK-000001'
  title        TEXT NOT NULL,
  format       TEXT NOT NULL                   -- hardcover | paperback
                 CHECK (format IN ('hardcover', 'paperback')),
  publisher_id INTEGER REFERENCES publisher(id),
  genre_id     INTEGER REFERENCES book_genre(id),
  isbn         TEXT,
  release_date TEXT,
  description  TEXT,
  price_cents  INTEGER NOT NULL CHECK (price_cents >= 0)
);

-- Book authorship (many-to-many). `ord` gives deterministic author order.
CREATE TABLE book_authors (
  book_sku  TEXT NOT NULL REFERENCES books(sku) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES author(id),
  ord       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (book_sku, author_id)
);

--------------------------------------------------------------------------------
-- Convenience views — flatten joins so service code reads plain rows.
-- `contributors` is a display string; hardware rows resolve to NULL there.
--------------------------------------------------------------------------------
CREATE VIEW video_catalog AS
SELECT
  v.sku,
  v.title,
  v.format,
  g.name  AS genre,
  d.name  AS director,
  s.name  AS studio,
  (SELECT group_concat(vp.name, ', ' ORDER BY vc.ord, vp.name)
     FROM video_cast vc
     JOIN video_person vp ON vp.id = vc.person_id
    WHERE vc.video_sku = v.sku) AS starring,
  v.release_date,
  v.description,
  v.price_cents
FROM videos v
LEFT JOIN video_genre g ON g.id = v.genre_id
LEFT JOIN director    d ON d.id = v.director_id
LEFT JOIN studio      s ON s.id = v.studio_id;

CREATE VIEW music_catalog AS
SELECT
  m.sku,
  m.title,
  m.format,
  g.name AS genre,
  a.name AS artist,
  l.name AS label,
  m.release_date,
  m.description,
  m.price_cents
FROM music m
LEFT JOIN music_genre  g ON g.id = m.genre_id
LEFT JOIN artist       a ON a.id = m.artist_id
LEFT JOIN record_label l ON l.id = m.label_id;

CREATE VIEW book_catalog AS
SELECT
  b.sku,
  b.title,
  b.format,
  g.name AS genre,
  p.name AS publisher,
  b.isbn,
  (SELECT group_concat(a.name, ', ' ORDER BY ba.ord, a.name)
     FROM book_authors ba
     JOIN author a ON a.id = ba.author_id
    WHERE ba.book_sku = b.sku) AS authors,
  b.release_date,
  b.description,
  b.price_cents
FROM books b
LEFT JOIN book_genre g ON g.id = b.genre_id
LEFT JOIN publisher  p ON p.id = b.publisher_id;

--------------------------------------------------------------------------------
-- Unified catalog view — one row per product across all verticals.
-- Powers cross-vertical gateway search with a single query.
--   vertical  : which app owns it (video|music|books)
--   item_type : the product's format (dvd, vinyl, turntable, hardcover, ...)
--------------------------------------------------------------------------------
CREATE VIEW catalog AS
  SELECT 'video' AS vertical, sku, title, format AS item_type, price_cents FROM videos
  UNION ALL
  SELECT 'music' AS vertical, sku, title, format AS item_type, price_cents FROM music
  UNION ALL
  SELECT 'books' AS vertical, sku, title, format AS item_type, price_cents FROM books;
