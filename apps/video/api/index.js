// Video department API. Plain JavaScript (untyped) — this is the legacy service.
// Reads the flattened video_catalog view via the shared openDb() factory.
import { openDb } from '@northridge/shared';

const PAGE_SIZE = 12;

// One read-only connection for the life of the process.
const db = openDb({ readonly: true });

const pageStmt = db.prepare(
  `SELECT sku, title, format, genre, director, studio, starring, release_date, description, price_cents
     FROM video_catalog
    ORDER BY title
    LIMIT :limit OFFSET :offset`,
);
const countStmt = db.prepare('SELECT count(*) AS n FROM video_catalog');
const bySkuStmt = db.prepare(
  `SELECT sku, title, format, genre, director, studio, starring, release_date, description, price_cents
     FROM video_catalog
    WHERE sku = :sku`,
);

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(payload);
}

// Routes handled by this vertical, matched in server.js before Vite.
// Returns true if it handled the request.
export function handleVideoApi(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;

  if (req.method === 'GET' && path === '/video/api/products') {
    const total = countStmt.get().n;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const requested = parseInt(url.searchParams.get('page') ?? '1', 10);
    const page = Number.isFinite(requested)
      ? Math.min(Math.max(requested, 1), totalPages)
      : 1;
    const items = pageStmt.all({
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    });
    sendJson(res, 200, { items, total, page, pageSize: PAGE_SIZE, totalPages });
    return true;
  }

  if (req.method === 'GET' && path.startsWith('/video/api/products/')) {
    const sku = decodeURIComponent(path.slice('/video/api/products/'.length));
    const item = bySkuStmt.get({ sku });
    if (item) {
      sendJson(res, 200, item);
    } else {
      sendJson(res, 404, { error: 'not_found', sku });
    }
    return true;
  }

  if (req.method === 'GET' && path === '/video/api/health') {
    sendJson(res, 200, { status: 'ok', vertical: 'video' });
    return true;
  }

  return false;
}
