// Schema + seed acceptance tests. Runs against the seeded northridge.db.
// Run:  npm run db:reset && node --test tests/unit/schema.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, closeAll } from '../../shared/db.js';

const db = openDb({ readonly: true });

test.after(() => closeAll());

test('foreign key enforcement is ON for this connection', () => {
  const { foreign_keys } = db.prepare('PRAGMA foreign_keys').get();
  assert.equal(foreign_keys, 1);
});

test('every vertical has seeded products', () => {
  for (const table of ['videos', 'music', 'books']) {
    const { c } = db.prepare(`SELECT count(*) c FROM ${table}`).get();
    assert.ok(c > 0, `${table} should have rows`);
  }
});

test('unified catalog view spans all three verticals', () => {
  const rows = db
    .prepare('SELECT DISTINCT vertical FROM catalog ORDER BY vertical')
    .all()
    .map((r) => r.vertical);
  assert.deepEqual(rows, ['books', 'music', 'video']);
});

test('multi-author book flattens to a comma-joined string', () => {
  const row = db
    .prepare('SELECT authors FROM book_catalog WHERE sku = ?')
    .get('BK-000001');
  assert.equal(row.authors, 'Neve Calloway, Rex Tamblin');
});

test('multi-cast film flattens deterministically by billing order', () => {
  const row = db
    .prepare('SELECT starring FROM video_catalog WHERE sku = ?')
    .get('VID-000002');
  assert.equal(row.starring, 'Marisol Vane, Idris Kemper, Whit Dohring');
});

test('hardware rows carry a format but null media contributors', () => {
  const row = db
    .prepare('SELECT format, artist FROM music_catalog WHERE sku = ?')
    .get('MUS-000005');
  assert.equal(row.format, 'turntable');
  assert.equal(row.artist, null);
});

test('foreign keys reject an invalid genre reference', () => {
  const write = openDb();
  try {
    assert.throws(() => {
      write
        .prepare(
          "INSERT INTO music (sku, title, format, genre_id, price_cents) VALUES ('MUS-BAD', 'x', 'cd', 99999, 100)",
        )
        .run();
    }, /FOREIGN KEY|SQLITE/i);
  } finally {
    write.close();
  }
});
