import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import '@northridge/shared/theme.css';
import { addToCart } from '@northridge/shared/cart.js';
import { mountCartBadge } from '@northridge/shared/cart-ui.js';
import type { BookProduct, Page } from '../api/index.ts';

mountCartBadge();

function priceUSD(cents: number): string {
  return '$' + (cents / 100).toFixed(2);
}

function Pager({
  page,
  totalPages,
  onSelect,
}: {
  page: number;
  totalPages: number;
  onSelect: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  return (
    <nav aria-label="Catalog pages">
      <ul className="pagination justify-content-center">
        <li className={'page-item' + (page === 1 ? ' disabled' : '')}>
          <button
            className="page-link"
            onClick={() => onSelect(page - 1)}
            disabled={page === 1}
          >
            Previous
          </button>
        </li>
        {pages.map((p) => (
          <li key={p} className={'page-item' + (p === page ? ' active' : '')}>
            <button className="page-link" onClick={() => onSelect(p)}>
              {p}
            </button>
          </li>
        ))}
        <li className={'page-item' + (page === totalPages ? ' disabled' : '')}>
          <button
            className="page-link"
            onClick={() => onSelect(page + 1)}
            disabled={page === totalPages}
          >
            Next
          </button>
        </li>
      </ul>
    </nav>
  );
}

function Catalog() {
  const [data, setData] = useState<Page<BookProduct> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetch('/books/api/products?page=' + page)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load catalog: ' + res.status);
        return res.json() as Promise<Page<BookProduct>>;
      })
      .then(setData)
      .catch((err: unknown) => setError(String(err)));
  }, [page]);

  function selectPage(p: number) {
    setPage(p);
    window.scrollTo({ top: 0 });
  }

  if (error) return <div className="container my-4"><div className="alert alert-danger">{error}</div></div>;
  if (!data) return <div className="container my-4"><p className="text-muted">Loading the books department…</p></div>;

  return (
    <main className="container my-4">
      <h1>Books</h1>
      <p className="text-muted">
        Fiction, science fiction, fantasy and more.{' '}
        <span className="small">({data.total} items)</span>
      </p>
      <div className="row">
        {data.items.map((item) => (
          <div className="col-sm-6 col-lg-4 mb-4 nrv-product" key={item.sku}>
            <div className="card h-100">
              <div className="card-body d-flex flex-column">
                <h5 className="card-title">
                  <a className="nrv-detail-link" href={'/books/' + item.sku}>
                    {item.title}
                  </a>
                </h5>
                <p className="card-text text-muted mb-3">
                  <span className="badge badge-secondary text-uppercase">
                    {item.format}
                  </span>
                  {item.authors ? ' ' + item.authors : ''}
                </p>
                <div className="mt-auto d-flex justify-content-between align-items-center">
                  <span className="h5 mb-0">{priceUSD(item.price_cents)}</span>
                  <button
                    type="button"
                    className="btn btn-primary nrv-add"
                    onClick={() =>
                      addToCart({
                        sku: item.sku,
                        title: item.title,
                        price_cents: item.price_cents,
                      })
                    }
                  >
                    Add to cart
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <Pager page={data.page} totalPages={data.totalPages} onSelect={selectPage} />
    </main>
  );
}

const container = document.getElementById('root');

function DetailRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="row py-1 border-bottom">
      <div className="col-4 col-sm-3 text-muted">{label}</div>
      <div className="col-8 col-sm-9">{value}</div>
    </div>
  );
}

function Detail({ sku }: { sku: string }) {
  const [item, setItem] = useState<BookProduct | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'missing'>('loading');

  useEffect(() => {
    fetch('/books/api/products/' + encodeURIComponent(sku))
      .then((res) => {
        if (res.status === 404) {
          setStatus('missing');
          return null;
        }
        if (!res.ok) throw new Error('Failed to load: ' + res.status);
        return res.json() as Promise<BookProduct>;
      })
      .then((data) => {
        if (data) {
          setItem(data);
          setStatus('ok');
        }
      })
      .catch(() => setStatus('missing'));
  }, [sku]);

  if (status === 'loading')
    return <div className="container my-4"><p className="text-muted">Loading…</p></div>;
  if (status === 'missing' || !item)
    return (
      <div className="container my-4">
        <div className="alert alert-warning">
          That item could not be found. <a href="/books/">Back to Books</a>.
        </div>
      </div>
    );

  return (
    <main className="container my-4">
      <p className="mb-2">
        <a href="/books/">&laquo; Back to Books</a>
      </p>
      <div className="card">
        <div className="card-body">
          <h1 className="h3">{item.title}</h1>
          <p>
            <span className="badge badge-secondary text-uppercase">
              {item.format}
            </span>{' '}
            {item.authors && <span className="ml-1">{item.authors}</span>}
          </p>
          {item.description && <p className="lead">{item.description}</p>}
          <div className="my-3">
            <DetailRow label="Authors" value={item.authors} />
            <DetailRow label="Genre" value={item.genre} />
            <DetailRow label="Publisher" value={item.publisher} />
            <DetailRow label="ISBN" value={item.isbn} />
            <DetailRow label="Format" value={item.format} />
            <DetailRow label="Released" value={item.release_date} />
            <DetailRow label="SKU" value={item.sku} />
          </div>
          <div className="d-flex justify-content-between align-items-center">
            <span className="h4 mb-0">{priceUSD(item.price_cents)}</span>
            <button
              type="button"
              className="btn btn-primary nrv-add"
              onClick={() =>
                addToCart({
                  sku: item.sku,
                  title: item.title,
                  price_cents: item.price_cents,
                })
              }
            >
              Add to cart
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

// Route on the path: /books/<SKU> shows a detail page, otherwise the catalog.
function App() {
  const m = window.location.pathname.match(/^\/books\/(BK-[^/]+)\/?$/);
  return m ? <Detail sku={m[1]} /> : <Catalog />;
}

if (container) {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
