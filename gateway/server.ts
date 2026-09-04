// Northridge Video gateway — the single entry point on :3000.
//
// Responsibilities:
//   * Reverse-proxy /video/* /music/* /books/* to each vertical (plain HTTP,
//     no WebSocket handling — Vite HMR connects directly to each vertical).
//   * Serve the shared retro shell at /.
//   * (Later) cross-vertical search + fake checkout.
//
// Exposed as createGateway() + a thin listen entrypoint so tests can bind an
// ephemeral port.
import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { openDb } from '@northridge/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHARED_DIR = join(__dirname, '..', 'shared');
const BOOTSTRAP_CSS = join(
  __dirname,
  '..',
  'node_modules',
  'bootstrap',
  'dist',
  'css',
  'bootstrap.min.css',
);
const FAVICON = join(SHARED_DIR, 'favicon.svg');

// Static shared assets the gateway serves at /shared/* (allowlisted).
const SHARED_ASSETS: Record<string, string> = {
  '/shared/theme.css': 'text/css',
  '/shared/cart.js': 'text/javascript',
  '/shared/cart-ui.js': 'text/javascript',
};

interface VerticalTarget {
  prefix: string;
  host: string;
  port: number;
}

const VERTICALS: VerticalTarget[] = [
  { prefix: '/video', host: '127.0.0.1', port: 3001 },
  { prefix: '/music', host: '127.0.0.1', port: 3002 },
  { prefix: '/books', host: '127.0.0.1', port: 3003 },
];

interface CatalogRow {
  vertical: string;
  sku: string;
  title: string;
  item_type: string;
  price_cents: number;
}

// Cross-vertical search reads the unified `catalog` view — one query, no
// fan-out to the verticals. Read-only connection for the gateway's lifetime.
const db = openDb({ readonly: true });
const SEARCH_PAGE_SIZE = 12;
const searchStmt = db.prepare(
  `SELECT vertical, sku, title, item_type, price_cents
     FROM catalog
    WHERE title LIKE :q
    ORDER BY title
    LIMIT 50`,
);
const searchPageStmt = db.prepare(
  `SELECT vertical, sku, title, item_type, price_cents
     FROM catalog
    WHERE title LIKE :q
    ORDER BY title
    LIMIT :limit OFFSET :offset`,
);
const searchCountStmt = db.prepare(
  'SELECT count(*) AS n FROM catalog WHERE title LIKE :q',
);

function matchVertical(
  url: string,
  targets: VerticalTarget[],
): VerticalTarget | undefined {
  return targets.find(
    (v) => url === v.prefix || url.startsWith(v.prefix + '/'),
  );
}

// Forward a request to a vertical, preserving method, headers, body, and the
// full path (prefix included). Streams both directions.
function proxy(
  target: VerticalTarget,
  req: IncomingMessage,
  res: ServerResponse,
): void {
  const upstream = http.request(
    {
      host: target.host,
      port: target.port,
      method: req.method,
      path: req.url,
      headers: req.headers,
    },
    (upRes) => {
      res.writeHead(upRes.statusCode || 502, upRes.headers);
      upRes.pipe(res);
    },
  );

  upstream.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
    }
    res.end(
      JSON.stringify({
        error: 'bad_gateway',
        detail: `${target.prefix} vertical is not reachable on :${target.port}`,
      }),
    );
  });

  req.pipe(upstream);
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

// GET /api/search?q=term — cross-vertical search over the unified catalog view.
function handleSearch(url: URL, res: ServerResponse): void {
  const q = (url.searchParams.get('q') ?? '').trim();
  if (!q) {
    sendJson(res, 200, { query: '', results: [] });
    return;
  }
  const results = searchStmt.all({ q: `%${q}%` }) as unknown as CatalogRow[];
  sendJson(res, 200, { query: q, results });
}

// POST /api/checkout — checkout stub. The cart lives in the browser's
// localStorage; this endpoint acknowledges the order with a confirmation
// number. Payment processing is not yet wired up.
function handleCheckout(res: ServerResponse): void {
  const confirmation = 'NRV-' + Date.now().toString(36).toUpperCase();
  sendJson(res, 200, {
    ok: true,
    confirmation,
    message: 'Thank you! Your order is confirmed.',
  });
}

// --- Bootstrap 4 chrome (shared by gateway-served pages) -------------------
const BS_NAVBAR = `<nav class="navbar navbar-dark bg-dark nrv-navbar">
  <div class="container">
    <a class="navbar-brand nrv-brand" href="/">&#127909; Northridge Video</a>
    <ul class="navbar-nav">
      <li class="nav-item"><a class="nav-link" href="/video/">Video</a></li>
      <li class="nav-item"><a class="nav-link" href="/music/">Music</a></li>
      <li class="nav-item"><a class="nav-link" href="/books/">Books</a></li>
    </ul>
    <a href="/cart" class="btn btn-sm btn-outline-light">&#128722; <span class="badge badge-warning" id="nrv-cart-count">0</span></a>
    <form class="form-inline nrv-search" action="/search" method="get">
      <input class="form-control form-control-sm" type="search" name="q" placeholder="Search the store" aria-label="Search" />
      <button class="btn btn-sm btn-warning ml-2" type="submit">Search</button>
    </form>
  </div>
</nav>`;

const BS_FOOTER = `<footer class="nrv-footer text-center py-4 mt-5">
  <div class="container">
    <p class="mb-1"><strong>NORTHRIDGE VIDEO</strong> &middot; Serving the neighborhood since 1982</p>
    <p class="mb-0"><a href="/video/">Video</a> &middot; <a href="/music/">Music</a> &middot; <a href="/books/">Books</a></p>
  </div>
</footer>`;

// Bootstrap 4 page wrapper for all gateway-served pages.
function bsPage(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <link rel="icon" href="/favicon.svg" />
    <link rel="stylesheet" href="/vendor/bootstrap.min.css" />
    <link rel="stylesheet" href="/shared/theme.css" />
  </head>
  <body>
    ${BS_NAVBAR}
    ${body}
    ${BS_FOOTER}
    <script type="module">
      import { mountCartBadge } from '/shared/cart-ui.js';
      mountCartBadge();
    </script>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function priceUSD(cents: number): string {
  return '$' + (cents / 100).toFixed(2);
}

function serveShell(res: ServerResponse): void {
  const body = `<div class="nrv-hero py-4 mb-4">
    <div class="container text-center">
      <h1 class="h4">Northridge Video</h1>
      <p class="nrv-hero-tag">Movies, music &amp; books &mdash; your neighborhood megastore since 1982.</p>
    </div>
  </div>

  <div class="container">
    <h2 class="h5 text-center mb-3">Shop by Department</h2>
    <div class="row">
      <div class="col-12 col-md-4 mb-3">
        <div class="card nrv-dept-card text-center">
          <div class="card-body py-3">
            <div class="nrv-dept-icon">&#128252;</div>
            <h5 class="card-title h6 mt-2">Video</h5>
            <p class="card-text text-muted small">DVDs, VHS, players and TVs.</p>
            <a href="/video/" class="btn btn-sm btn-primary">Shop Video</a>
          </div>
        </div>
      </div>
      <div class="col-12 col-md-4 mb-3">
        <div class="card nrv-dept-card text-center">
          <div class="card-body py-3">
            <div class="nrv-dept-icon">&#127925;</div>
            <h5 class="card-title h6 mt-2">Music</h5>
            <p class="card-text text-muted small">Vinyl, CDs, cassettes, turntables &amp; speakers.</p>
            <a href="/music/" class="btn btn-sm btn-primary">Shop Music</a>
          </div>
        </div>
      </div>
      <div class="col-12 col-md-4 mb-3">
        <div class="card nrv-dept-card text-center">
          <div class="card-body py-3">
            <div class="nrv-dept-icon">&#128218;</div>
            <h5 class="card-title h6 mt-2">Books</h5>
            <p class="card-text text-muted small">Fiction, sci-fi, fantasy &amp; more.</p>
            <a href="/books/" class="btn btn-sm btn-primary">Shop Books</a>
          </div>
        </div>
      </div>
    </div>
  </div>`;
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(bsPage('Northridge Video', body));
}

// Server-rendered numbered pager (Bootstrap 4) that preserves the query.
function searchPager(q: string, page: number, totalPages: number): string {
  if (totalPages <= 1) return '';
  const href = (p: number) =>
    `/search?q=${encodeURIComponent(q)}&page=${p}`;
  const item = (p: number, label: string, disabled: boolean, active: boolean) =>
    `<li class="page-item${disabled ? ' disabled' : ''}${active ? ' active' : ''}">` +
    (disabled
      ? `<span class="page-link">${label}</span>`
      : `<a class="page-link" href="${href(p)}">${label}</a>`) +
    `</li>`;
  let html = '<nav aria-label="Search pages"><ul class="pagination justify-content-center">';
  html += item(page - 1, 'Previous', page === 1, false);
  for (let p = 1; p <= totalPages; p++) {
    html += item(p, String(p), false, p === page);
  }
  html += item(page + 1, 'Next', page === totalPages, false);
  html += '</ul></nav>';
  return html;
}

// Server-rendered cross-vertical search results.
function serveSearchPage(url: URL, res: ServerResponse): void {
  const q = (url.searchParams.get('q') ?? '').trim();
  let body: string;
  if (!q) {
    body = `<div class="container my-5"><h2>Search</h2><p class="text-muted">Type something in the search box above.</p></div>`;
  } else {
    const total = (searchCountStmt.get({ q: `%${q}%` }) as { n: number }).n;
    const totalPages = Math.max(1, Math.ceil(total / SEARCH_PAGE_SIZE));
    const reqPage = parseInt(url.searchParams.get('page') ?? '1', 10);
    const page = Number.isFinite(reqPage)
      ? Math.min(Math.max(reqPage, 1), totalPages)
      : 1;
    const results = searchPageStmt.all({
      q: `%${q}%`,
      limit: SEARCH_PAGE_SIZE,
      offset: (page - 1) * SEARCH_PAGE_SIZE,
    }) as unknown as CatalogRow[];
    const list = total
      ? `<div class="list-group nrv-results">${results
          .map(
            (r) =>
              `<a href="/${r.vertical}/${r.sku}" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
                 <span><span class="badge badge-secondary text-uppercase mr-2">${r.vertical}</span> ${escapeHtml(
                   r.title,
                 )} <small class="text-muted">${escapeHtml(r.item_type)}</small></span>
                 <span class="font-weight-bold">${priceUSD(r.price_cents)}</span>
               </a>`,
          )
          .join('')}</div>${searchPager(q, page, totalPages)}`
      : `<p class="text-muted">No results for &ldquo;${escapeHtml(q)}&rdquo;.</p>`;
    body = `<div class="container my-5">
      <h2>Search</h2>
      <p class="text-muted">${total} result${total === 1 ? '' : 's'} for &ldquo;${escapeHtml(q)}&rdquo;:</p>
      ${list}
    </div>`;
  }
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(bsPage('Search — Northridge Video', body));
}

// The cart + fake checkout page. Cart lives entirely in localStorage; the
// script renders it and "Buy Now" POSTs to /api/checkout for a confirmation.
function serveCartPage(res: ServerResponse): void {
  const body = `<div class="container my-5">
    <h2 class="mb-4">Your Cart</h2>
    <div id="cart-view"><p class="text-muted">Loading cart…</p></div>
  </div>
  <script type="module">
    import { getCart, removeFromCart, clearCart, cartTotalCents } from '/shared/cart.js';
    const view = document.getElementById('cart-view');
    function usd(c) { return '$' + (c / 100).toFixed(2); }
    function render() {
      const items = getCart();
      if (!items.length) {
        view.innerHTML = '<div class="alert alert-secondary">Your cart is empty. <a href="/">Browse the store</a>.</div>';
        return;
      }
      const rows = items.map(i =>
        '<li class="list-group-item d-flex justify-content-between align-items-center" data-sku="' + i.sku + '">' +
        '<span><strong>' + i.title + '</strong> <span class="badge badge-light">x' + i.qty + '</span></span>' +
        '<span><span class="mr-3 font-weight-bold">' + usd(i.price_cents * i.qty) + '</span>' +
        '<button class="btn btn-sm btn-outline-danger remove" type="button">Remove</button></span></li>'
      ).join('');
      view.innerHTML =
        '<ul class="list-group mb-3">' + rows + '</ul>' +
        '<div class="d-flex justify-content-between align-items-center">' +
        '<h4 class="mb-0">Total: ' + usd(cartTotalCents()) + '</h4>' +
        '<button id="buy" class="btn btn-success btn-lg" type="button">Buy Now</button></div>';
    }
    view.addEventListener('click', async (e) => {
      const btn = e.target;
      if (btn.classList.contains('remove')) {
        removeFromCart(btn.closest('li').dataset.sku);
        render();
      } else if (btn.id === 'buy') {
        const res = await fetch('/api/checkout', { method: 'POST' });
        const data = await res.json();
        clearCart();
        view.innerHTML =
          '<div class="alert alert-success nrv-confirmation"><h4 class="alert-heading">Order confirmed!</h4>' +
          'Confirmation <strong>' + data.confirmation + '</strong>' +
          '<p class="mb-0 mt-2">' + data.message + '</p>' +
          '<hr><a href="/" class="btn btn-outline-success">Continue shopping</a></div>';
      }
    });
    render();
  </script>`;
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(bsPage('Cart — Northridge Video', body));
}

export function createGateway(
  targets: VerticalTarget[] = VERTICALS,
): http.Server {
  return http.createServer((req, res) => {
    const rawUrl = req.url || '/';
    const url = new URL(rawUrl, 'http://localhost');
    const path = url.pathname;

    // Shared static assets.
    if (SHARED_ASSETS[path]) {
      try {
        const file = readFileSync(join(SHARED_DIR, path.slice('/shared/'.length)));
        res.writeHead(200, { 'Content-Type': SHARED_ASSETS[path] });
        res.end(file);
      } catch {
        res.writeHead(404).end('Not found');
      }
      return;
    }

    // Vendored Bootstrap 4 CSS (served from node_modules).
    if (path === '/vendor/bootstrap.min.css') {
      try {
        res.writeHead(200, { 'Content-Type': 'text/css' });
        res.end(readFileSync(BOOTSTRAP_CSS));
      } catch {
        res.writeHead(404).end('Not found');
      }
      return;
    }

    // Favicon (SVG). Browsers also auto-request /favicon.ico — serve the same.
    if (path === '/favicon.svg' || path === '/favicon.ico') {
      try {
        res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
        res.end(readFileSync(FAVICON));
      } catch {
        res.writeHead(404).end('Not found');
      }
      return;
    }

    // Gateway-owned API: search + fake checkout.
    if (req.method === 'GET' && path === '/api/search') {
      handleSearch(url, res);
      return;
    }
    if (req.method === 'POST' && path === '/api/checkout') {
      handleCheckout(res);
      return;
    }

    // Gateway-owned pages.
    if (req.method === 'GET' && path === '/search') {
      serveSearchPage(url, res);
      return;
    }
    if (req.method === 'GET' && path === '/cart') {
      serveCartPage(res);
      return;
    }

    // Proxy vertical traffic (prefix preserved, HTTP only — no ws).
    const target = matchVertical(rawUrl, targets);
    if (target) {
      proxy(target, req, res);
      return;
    }

    // Shared retro shell.
    if (path === '/' || path === '/index.html') {
      serveShell(res);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  });
}

// Thin listen entrypoint (skipped when imported by tests).
const isMain =
  process.argv[1] &&
  import.meta.url === `file://${process.argv[1]}`.replace(/\\/g, '/');

if (isMain) {
  const PORT = Number(process.env.PORT) || 3000;
  const server = createGateway();
  server.listen(PORT, () => {
    console.log(`[gateway] http://localhost:${PORT}`);
  });
  const shutdown = () => server.close(() => process.exit(0));
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
