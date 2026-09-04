// Gateway tests — bind createGateway() to an ephemeral port and make real
// HTTP requests. The gateway has no Vite dependency, so it starts instantly.
// Requires a seeded northridge.db (run `npm run db:reset` first).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createGateway } from '../../gateway/server.ts';

let server;
let base;

before(async () => {
  // Point the vertical at a closed port so the proxy test is deterministic
  // regardless of whether the real dev stack happens to be running.
  server = createGateway([{ prefix: '/video', host: '127.0.0.1', port: 59999 }]);
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://localhost:${server.address().port}`;
});

after(() => {
  server.close();
});

test('GET / serves the retro shell', async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  const html = await res.text();
  assert.match(html, /NORTHRIDGE VIDEO/);
});

test('GET /shared/theme.css serves the shared stylesheet', async () => {
  const res = await fetch(`${base}/shared/theme.css`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/css/);
});

test('GET /api/search finds items across verticals', async () => {
  const res = await fetch(`${base}/api/search?q=the`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.query, 'the');
  assert.ok(Array.isArray(data.results));
  assert.ok(data.results.length > 0);
  // Results should span more than one vertical for a broad term.
  const verticals = new Set(data.results.map((r) => r.vertical));
  assert.ok(verticals.size >= 2);
});

test('GET /api/search filters results by department', async () => {
  const res = await fetch(`${base}/api/search?q=the&department=music`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.results.length > 0);
  assert.ok(data.results.every((result) => result.vertical === 'music'));
});

test('GET /api/search accepts every supported department', async () => {
  for (const department of ['video', 'music', 'books']) {
    const res = await fetch(`${base}/api/search?q=the&department=${department}`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.results.length > 0);
    assert.ok(data.results.every((result) => result.vertical === department));
  }
});

test('GET /api/search with empty query returns no results', async () => {
  const res = await fetch(`${base}/api/search?q=`);
  const data = await res.json();
  assert.deepEqual(data, { query: '', results: [] });
});

test('POST /api/checkout returns a fake confirmation', async () => {
  const res = await fetch(`${base}/api/checkout`, { method: 'POST' });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.match(data.confirmation, /^NRV-/);
});

test('GET /search renders a server-side results page with a pager', async () => {
  const res = await fetch(`${base}/search?q=e`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /results for/i);
  // A broad query spans multiple pages, so a numbered pager is rendered.
  assert.match(html, /class="pagination/);
});

test('GET /search?page=2 returns a different slice of results', async () => {
  const page1 = await (await fetch(`${base}/search?q=e&page=1`)).text();
  const page2 = await (await fetch(`${base}/search?q=e&page=2`)).text();
  assert.notEqual(page1, page2);
});

test('GET /search filters by department and preserves it in the pager', async () => {
  const res = await fetch(`${base}/search?q=e&department=books`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /name="department"/);
  assert.match(html, /<option value="books" selected>/);
  assert.match(html, /department=books/);
  assert.doesNotMatch(html, /badge badge-secondary text-uppercase mr-2">music</);
});

test('GET /cart renders the cart page', async () => {
  const res = await fetch(`${base}/cart`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Your Cart/);
});

test('proxying to a down vertical yields 502', async () => {
  const res = await fetch(`${base}/video/api/health`);
  assert.equal(res.status, 502);
});

test('unknown path yields 404', async () => {
  const res = await fetch(`${base}/nope`);
  assert.equal(res.status, 404);
});
