// Books vertical API tests — exercise the handler against the seeded DB.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleBooksApi } from '../../apps/books/api/index.ts';
import { makeReq, makeRes } from './_helpers.js';

function getPage(page) {
  const res = makeRes();
  handleBooksApi(makeReq('GET', '/books/api/products?page=' + page), res);
  return res.json();
}

function allItems() {
  const first = getPage(1);
  let items = [...first.items];
  for (let p = 2; p <= first.totalPages; p++) items.push(...getPage(p).items);
  return items;
}

test('GET /books/api/health reports ok', () => {
  const res = makeRes();
  const handled = handleBooksApi(makeReq('GET', '/books/api/health'), res);
  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { status: 'ok', vertical: 'books' });
});

test('GET /books/api/products returns a paginated envelope', () => {
  const body = getPage(1);
  assert.equal(body.pageSize, 12);
  assert.ok(body.total > 12, 'seeded catalog should span multiple pages');
  assert.equal(body.items.length, 12);
  assert.equal(body.totalPages, Math.ceil(body.total / 12));
  for (const item of body.items) {
    assert.match(item.sku, /^BK-/);
    assert.equal(typeof item.title, 'string');
    assert.equal(typeof item.price_cents, 'number');
  }
});

test('a multi-author book flattens its authors into one string', () => {
  const multi = allItems().find((i) => i.authors && i.authors.includes(','));
  assert.ok(multi, 'expected at least one multi-author book');
  assert.ok(multi.authors.split(',').length >= 2);
});

test('GET /books/api/products/:sku returns a single product', () => {
  const first = getPage(1).items[0];
  const res = makeRes();
  const handled = handleBooksApi(
    makeReq('GET', '/books/api/products/' + first.sku),
    res,
  );
  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().sku, first.sku);
});

test('GET /books/api/products/:sku 404s for an unknown sku', () => {
  const res = makeRes();
  handleBooksApi(makeReq('GET', '/books/api/products/BK-999999'), res);
  assert.equal(res.statusCode, 404);
  assert.equal(res.json().error, 'not_found');
});

test('unknown books route is not handled', () => {
  const res = makeRes();
  const handled = handleBooksApi(makeReq('GET', '/books/api/nope'), res);
  assert.equal(handled, false);
});
