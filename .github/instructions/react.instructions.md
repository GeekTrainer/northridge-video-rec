---
applyTo: "apps/music/client/**/*.tsx,apps/books/client/**/*.tsx"
---

# React component conventions (Music & Books)

Applies to the React frontends in `apps/music/client/` and `apps/books/client/`. Video (`apps/video/`) is jQuery, not React — see `jquery.instructions.md`.

## Structure

- Each department's UI lives in a single `client/main.tsx` with small function components (`Catalog`, `Detail`, `Pager`, `DetailRow`) defined top-to-bottom in the file; there is no separate `components/` directory today. Keep new components in the same file unless it grows large enough to justify splitting.
- Call `mountCartBadge()` once at module scope (top of the file, before any component) and use `addToCart()` from `@northridge/shared/cart.js` for cart mutations — both imported from `@northridge/shared/...`.
- Import shared types with `import type { ... } from '../api/index.ts'` (e.g. `MusicProduct`, `Page<T>`); do not redeclare API shapes in the client.
- Mount with `createRoot` + `<StrictMode>`, matching the existing `main.tsx` bootstrap.

## Component patterns

- Type all component props inline as an object type (`{ page, totalPages, onSelect }: { page: number; totalPages: number; onSelect: (p: number) => void }`) rather than a separate named props interface, matching `Pager`/`DetailRow`.
- Data-fetching components (`Catalog`, `Detail`) manage their own `useState`/`useEffect` and fetch directly from the department's `/​<dept>​/api/...` endpoints with the browser `fetch` API — no shared data-fetching library or context.
- Model loading/error/empty states explicitly with local state (`data: T | null`, `error: string | null`, or a status union like `'loading' | 'ok' | 'missing'`), and return early JSX for each state before the main render (see `Catalog`, `Detail`).
- Return `null` from small presentational components when there is nothing to show (e.g. `Pager` returns `null` when `totalPages <= 1`; `DetailRow` returns `null` when `value` is falsy).
- Reset scroll on pagination via `window.scrollTo({ top: 0 })`, not a full page reload.

## Styling & markup

- Use Bootstrap 4 utility/component classes (`container`, `row`, `card`, `badge badge-secondary`, `btn btn-primary`) for all layout and styling — do not hand-roll CSS in these components. Reserve custom CSS for `shared/theme.css` accent classes (prefixed `nrv-`, e.g. `nrv-detail-link`, `nrv-product`).
- Add a stable hook class for interactive/testable elements following existing names, e.g. `nrv-add` on add-to-cart buttons, `nrv-product` on catalog cards, `nrv-detail-link` on detail links.
- Format prices with a local `priceUSD(cents: number): string` helper (`'$' + (cents / 100).toFixed(2)`) — don't introduce a different currency formatter.
- Keep JSX free of `dangerouslySetInnerHTML`; build markup declaratively with JSX, not string concatenation (that pattern is specific to the legacy jQuery app).

## Data flow

- Product detail routes are `/​<dept>​/<sku>` server-rendered into the department's SPA; the `Detail` component reads the `sku` from a prop supplied by the app's own router logic in `main.tsx`.
- Treat `404` responses from the API as a normal "not found" UI state (`status: 'missing'`), not a thrown error.
