---
applyTo: "gateway/**/*.ts,apps/music/**/*.ts,apps/music/**/*.tsx,apps/books/**/*.ts,apps/books/**/*.tsx,shared/**/*.ts,tests/**/*.ts"
---

# TypeScript conventions

These apply to the gateway, the Music and Books departments, `shared/`, and TS tests — i.e. everything covered by `tsconfig.json`. `apps/video/` is plain JavaScript and is out of scope; see `jquery.instructions.md`.

## No build step — erasable syntax only

Node 24 strips types at load time with no compile step in dev. `npm run typecheck` (`tsc --noEmit`) is the only place actual type-checking happens.

- **Never** use `enum`, TypeScript parameter properties (`constructor(private x: string)`), or decorators — these are not erasable and Node will fail to run the file.
- Use `.ts`/`.tsx` extensions in relative imports (e.g. `from './api/index.ts'`), matching `allowImportingTsExtensions` / `rewriteRelativeImportExtensions`.
- Prefer `type`/`interface` and plain object/union types over class-heavy designs.

## Types

- Annotate parameters and return types for every function, including handlers and helpers (`function sendJson(res: ServerResponse, status: number, body: unknown): void`).
- Define request/response payload shapes as `interface`s colocated with the API handler that produces them (e.g. `BookProduct`, `Page<T>` in `apps/books/api/index.ts`), and import them elsewhere with `import type { ... }`.
- Import Node HTTP types explicitly: `import type { IncomingMessage, ServerResponse } from 'node:http';`.
- Avoid `any`; when narrowing an unknown shape from `JSON.parse`/`fetch`, cast through `unknown` (`as unknown as BookProduct[]`) rather than casting directly.

## Module style

- Use ESM `import`/`export` only (`"type": "module"`, `verbatimModuleSyntax` is on) — no `require`, no default+named mixed exports unless the file already does it.
- Keep one shared `openDb()`-backed connection per API module, opened at module scope, not per-request (see `apps/books/api/index.ts`).
- Dynamic `await import(...)` is used deliberately in server files to defer loading Vite vs. static-serving code based on `--prod`; follow that pattern rather than importing both eagerly.

## API handler shape

- Export a single `handle<Dept>Api(req: IncomingMessage, res: ServerResponse): boolean` per department that returns `true` once it has handled and responded to a request, `false` otherwise, so the caller can fall through to Vite/static serving.
- Use a local `sendJson(res, status, body)` helper for all JSON responses.
- Return paginated collections as `{ items, total, page, pageSize, totalPages }`.

## Testing

- Unit tests (`tests/unit/*.ts`) use `node:test` + `node:assert/strict`, importing the handler directly and driving it with `makeReq`/`makeRes` from `tests/unit/_helpers.js`.
- Run `npm run typecheck` and `npm test` after any TypeScript change.
