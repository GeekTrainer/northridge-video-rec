// Music vertical API tests — exercise the handler against the seeded DB.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleMusicApi } from '../../apps/music/api/index.ts';
import { makeReq, makeRes } from './_helpers.js';

function getPage(page) {
  const res = makeRes();
  const handled = handleMusicApi(
    makeReq('GET', '/music/api/products?page=' + page),
    res,
  );
  return { handled, res, body: res.json() };
}

// Collect every item across all pages.
function allItems() {
  const first = getPage(1).body;
  let items = [...first.items];
  for (let p = 2; p <= first.totalPages; p++) items.push(...getPage(p).body.items);
  return { items, meta: first };
}

test('GET /music/api/health reports ok', () => {
  const res = makeRes();
  const handled = handleMusicApi(makeReq('GET', '/music/api/health'), res);
  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { status: 'ok', vertical: 'music' });
});

test('GET /music/api/products returns a paginated envelope', () => {
  const { res, body } = getPage(1);
  assert.equal(res.statusCode, 200);
  assert.equal(body.pageSize, 12);
  assert.equal(body.page, 1);
  assert.ok(body.total > 12, 'seeded catalog should span multiple pages');
  assert.equal(body.items.length, 12);
  assert.equal(body.totalPages, Math.ceil(body.total / 12));
  for (const item of body.items) {
    assert.match(item.sku, /^MUS-/);
    assert.equal(typeof item.title, 'string');
    assert.equal(typeof item.price_cents, 'number');
  }
});

test('the last page holds the remainder and no more', () => {
  const first = getPage(1).body;
  const last = getPage(first.totalPages).body;
  const expected = first.total - (first.totalPages - 1) * 12;
  assert.equal(last.items.length, expected);
});

test('an out-of-range page is clamped to the last page', () => {
  const body = getPage(9999).body;
  assert.equal(body.page, body.totalPages);
});

test('music products include a flattened artist for albums', () => {
  const { items } = allItems();
  const album = items.find((i) => i.format === 'vinyl');
  assert.ok(album);
  assert.equal(typeof album.artist, 'string');
});

test('music hardware rows have a null artist', () => {
  const { items } = allItems();
  const hardware = items.find((i) => i.format === 'turntable');
  assert.ok(hardware);
  assert.equal(hardware.artist, null);
});

test('GET /music/api/products/:sku returns a single product', () => {
  const first = getPage(1).body.items[0];
  const res = makeRes();
  const handled = handleMusicApi(
    makeReq('GET', '/music/api/products/' + first.sku),
    res,
  );
  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  const item = res.json();
  assert.equal(item.sku, first.sku);
  assert.equal(typeof item.title, 'string');
  assert.equal(typeof item.price_cents, 'number');
});

test('GET /music/api/products/:sku 404s for an unknown sku', () => {
  const res = makeRes();
  handleMusicApi(makeReq('GET', '/music/api/products/MUS-999999'), res);
  assert.equal(res.statusCode, 404);
  assert.equal(res.json().error, 'not_found');
});

test('unknown music route is not handled', () => {
  const res = makeRes();
  const handled = handleMusicApi(makeReq('GET', '/music/api/nope'), res);
  assert.equal(handled, false);
});
