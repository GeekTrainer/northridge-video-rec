# Copilot instructions for Northridge Video


## Developer notes

Some core practices to follow when creating code:

- Use DRY principles. Don't repeat yourself. Always look for opportunities for reuse.
- Simplest thing that works. We prize simplicity and readability in our codebase.
 - YAGNI principle. You aren't gonna need it. While we don't want to box ourselves in, we want to develop for today.

## Agent notes

- Always look for the best tool for the job. Explore the MCP servers, skills, custom agents, and LSP servers.
 - It's OK to ask questions if you're unsure of something. Asking questions isn't a sign of failure. It allows us to move faster as we know we're aligned on the task.

## Architecture

- **Gateway** (`gateway/`, TypeScript) is the single entry point on `:3000`. It reverse-proxies the three department apps, serves the shared shell, and owns cross-department **search** and **checkout**.
- **Three department apps**, each one Node process serving both its own frontend (Vite middleware) and its own API:
  - `apps/video/` — **plain JavaScript + jQuery**. The legacy department; keep it JS unless the change is specifically part of migrating it to TypeScript.
  - `apps/music/`, `apps/books/` — **TypeScript + React + Bootstrap 4**.
- **One shared SQLite database** (`data/northridge.db`) via the built-in `node:sqlite` module. Normalized schema (lookup tables, many-to-many joins) with flattened views (e.g. `book_catalog`, `video_catalog`) for app reads. Treat each app's tables as owned by that app by convention, even though the DB file is shared.
- **Cart** lives in the browser (`localStorage`) via `shared/cart.js`, shared across departments since everything is served from the gateway origin.

## Conventions to follow

### Data layer
- Define tables/views only in `data/schema.sql`; keep it fully normalized.
- Always open the database through `openDb()` from `@northridge/shared` (`shared/db.js`) — never instantiate `DatabaseSync` directly. This is what enforces `PRAGMA foreign_keys = ON`.
- Use `openDb({ readonly: true })` for a module-level, process-lifetime connection in API handlers (see `apps/books/api/index.ts`, `apps/video/api/index.js`).
- Prepare statements once at module load, reuse across requests; use named parameters (`:limit`, `:sku`, etc.).
- Keep all seed/sample data invented — never real product, company, or person names.
- Add/update unit tests for any data-layer change.

### Backend/API pattern
- Each department exposes a single `handle<Dept>Api(req, res): boolean` function that returns `true` if it handled the request, `false` otherwise (so the server falls through to Vite/static).
- Use a `sendJson(res, status, body)` helper; set `Content-Type: application/json` and end with `JSON.stringify`.
- Paginated list endpoints return the shape `{ items, total, page, pageSize, totalPages }`; page size is a module constant (`PAGE_SIZE = 12`).
- Health endpoints: `GET /<dept>/api/health` → `{ status: 'ok', vertical: '<dept>' }`.
- Servers (`server.ts`/`server.js`) branch on `process.argv.includes('--prod')`: dev mode uses Vite middleware for HMR, prod mode serves the built `dist/` via `createStaticSpa` from `@northridge/shared/static.js`. Preserve this dual-mode structure when touching a server file.
- Call `registerShutdown()` from `@northridge/shared` once per process for clean SIGINT/SIGTERM handling.

### TypeScript
- Use type hints for all function parameters and return values in TypeScript verticals (gateway, music, books, shared `.ts`/`.d.ts`).
- Keep TypeScript to **erasable syntax only** — no `enum`, no parameter properties, no decorators — so Node 24's type stripping can run it directly without a build step. `npm run typecheck` (`tsc --noEmit`) is what actually type-checks.
- Prefer explicit `interface`s for API payload shapes (e.g. `BookProduct`, `Page<T>`) placed alongside the API handler that produces them, and import them with `import type` in clients.
- Use `.ts`/`.tsx` extensions in relative imports (`allowImportingTsExtensions` + `rewriteRelativeImportExtensions` are enabled).

### Frontend
- Music and Books: React function components with Bootstrap 4 classes; keep components small and colocated in `client/main.tsx`.
- Video: jQuery + plain JS; do not introduce React/TS here as part of unrelated changes.
- Add `data-*` attributes or stable class names to interactive elements so tests can target them.
- Mount the shared cart badge via `mountCartBadge()` and use `addToCart()` from `@northridge/shared/cart.js` for cart interactions.

### Comments & style
- Lead each new file with a short comment explaining its role (see existing files for tone) — most files open with a 1–3 line purpose comment.
- Keep functions small and single-purpose; favor early returns over nested conditionals (see routing in API handlers).

## Testing

- **Unit tests** (`tests/unit/`, run via `npm test` / `node --test`): exercise API handlers directly against the seeded DB using `makeReq`/`makeRes` from `tests/unit/_helpers.js`. Follow the existing pattern of iterating all pages via `totalPages` when asserting over the full catalog.
- **E2E tests** (`tests/e2e/`, Playwright, `npm run test:e2e`): drive the full stack through the gateway (browse → cart → checkout).
- Run `npm run db:reset` before tests if the schema/seed changed. Stop dev servers first — the reset recreates the DB file.
- All three suites (`npm run typecheck`, `npm test`, `npm run test:e2e`) must pass before submitting a change; CI (`.github/workflows/ci.yml`) runs them in that order.

## Workflow

- Every change should trace back to an issue.
- Keep PRs focused; unrelated changes go in separate PRs.
- Update `README.md`/`CONTRIBUTING.md` if a change affects how the app is run or contributed to.
