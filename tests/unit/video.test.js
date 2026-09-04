// Video department tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleVideoApi } from '../../apps/video/api/index.js';
import { makeReq, makeRes } from './_helpers.js';

test('GET /video/api/health reports ok', () => {
  const res = makeRes();
  const handled = handleVideoApi(makeReq('GET', '/video/api/health'), res);
  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { status: 'ok', vertical: 'video' });
});

test('GET /video/api/products returns a non-empty page of items', () => {
  const res = makeRes();
  handleVideoApi(makeReq('GET', '/video/api/products'), res);
  assert.equal(res.statusCode, 200);
  assert.ok(res.json().items.length > 0);
});

test('GET /video/api/products/:sku returns a single product', () => {
  const res = makeRes();
  handleVideoApi(makeReq('GET', '/video/api/products/VID-000002'), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().sku, 'VID-000002');
});
