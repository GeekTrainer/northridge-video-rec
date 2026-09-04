// Books department API (TypeScript). Reads the flattened book_catalog view.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { openDb } from '@northridge/shared';

export interface BookProduct {
  sku: string;
  title: string;
  format: string;
  genre: string | null;
  publisher: string | null;
  isbn: string | null;
  authors: string | null;
  release_date: string | null;
  description: string | null;
  price_cents: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const PAGE_SIZE = 12;
const db = openDb({ readonly: true });

const pageStmt = db.prepare(
  `SELECT sku, title, format, genre, publisher, isbn, authors, release_date, description, price_cents
     FROM book_catalog
    ORDER BY title
    LIMIT :limit OFFSET :offset`,
);
const countStmt = db.prepare('SELECT count(*) AS n FROM book_catalog');
const bySkuStmt = db.prepare(
  `SELECT sku, title, format, genre, publisher, isbn, authors, release_date, description, price_cents
     FROM book_catalog
    WHERE sku = :sku`,
);

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function resolvePage(param: string | null, totalPages: number): number {
  const requested = parseInt(param ?? '1', 10);
  if (!Number.isFinite(requested)) return 1;
  return Math.min(Math.max(requested, 1), totalPages);
}

// Returns true if it handled the request.
export function handleBooksApi(
  req: IncomingMessage,
  res: ServerResponse,
): boolean {
  const url = new URL(req.url ?? '', 'http://localhost');
  const path = url.pathname;

  if (req.method === 'GET' && path === '/books/api/products') {
    const total = (countStmt.get() as { n: number }).n;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = resolvePage(url.searchParams.get('page'), totalPages);
    const items = pageStmt.all({
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }) as unknown as BookProduct[];
    const body: Page<BookProduct> = {
      items,
      total,
      page,
      pageSize: PAGE_SIZE,
      totalPages,
    };
    sendJson(res, 200, body);
    return true;
  }

  if (req.method === 'GET' && path.startsWith('/books/api/products/')) {
    const sku = decodeURIComponent(path.slice('/books/api/products/'.length));
    const item = bySkuStmt.get({ sku }) as unknown as BookProduct | undefined;
    if (item) {
      sendJson(res, 200, item);
    } else {
      sendJson(res, 404, { error: 'not_found', sku });
    }
    return true;
  }

  if (req.method === 'GET' && path === '/books/api/health') {
    sendJson(res, 200, { status: 'ok', vertical: 'books' });
    return true;
  }

  return false;
}
