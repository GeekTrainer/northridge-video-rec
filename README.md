# Northridge Video

The e-commerce storefront for **Northridge Video** — a neighborhood media shop selling movies, music, books, and the hardware to play it all. The site began as a video-rental catalog and grew to cover music and books as the shop expanded.

## Overview

The storefront is a small set of Node services behind a single gateway:

- **One gateway** (TypeScript) on `:3000` is the single entry point. It reverse-proxies each department, serves the shared site chrome, provides cross-department **search** (one SQL query over a unified view, paginated), and the **checkout** endpoint.
- **Three department apps**, each a single Node process serving *both* its own frontend (via Vite middleware) and its own API. Each department also serves a **product detail page** at `/<department>/<sku>`.
- **One shared SQLite database** (`data/northridge.db`) via the built-in `node:sqlite` module — no separate database server. It's normalized (genre/artist/publisher/etc. as lookup tables; book authors and film cast as many-to-many join tables), with views that flatten the joins so application code reads plain rows. Every connection is opened through a single `openDb()` factory that enforces `PRAGMA foreign_keys = ON`.
- **The cart lives in the browser** (`localStorage`), shared across all departments because everything is served through the gateway origin.

```
Browser -- :3000 Gateway (TS: proxy + search + checkout + shell)
                 |-- /video/* -> Video app  (:3001, JS + jQuery)
                 |-- /music/* -> Music app  (:3002, TS + React)
                 |-- /books/* -> Books app  (:3003, TS + React)
                                   \-- all read -- data/northridge.db (node:sqlite)
```

The Video department is the oldest part of the codebase — it still runs on jQuery and plain JavaScript, while Music and Books were built later on React and TypeScript. Migrating Video to the newer stack is tracked as ongoing tech-debt work.

## Prerequisites

- **Node.js 24 LTS** (or newer). That's the only requirement — `node:sqlite` is built in, TypeScript runs directly via Node's type stripping (no build step in dev), and the database is a single file.

Check your version:

```bash
node --version   # should be v24.x or newer
```

## Getting started

```bash
npm install       # install workspace dependencies
npm run db:reset  # create + seed data/northridge.db
npm run dev       # start all four processes
```

Then open **http://localhost:3000**.

> [!IMPORTANT]
> Stop the dev servers before running `npm run db:reset` — the reset recreates the database file, and it's cleanest when nothing else holds it open.

### Ports

| Process | URL |
|---------|-----|
| Gateway (entry point) | http://localhost:3000 |
| Video app | http://localhost:3001/video/ |
| Music app | http://localhost:3002/music/ |
| Books app | http://localhost:3003/books/ |
| Schema MCP server (optional, standalone) | http://localhost:3100/mcp |

You normally only visit `:3000`; the gateway proxies the rest. (Each department also runs a dedicated Vite HMR socket on `24601`-`24603` for hot reload.)

The schema MCP server is registered in `.mcp.json` via stdio — the MCP client spawns `mcp-server/server.ts --stdio` directly, so there's nothing to start manually. `npm run dev:mcp` is only needed if you want it reachable as a standalone Streamable HTTP server on `:3100/mcp` instead.

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the gateway + all three departments (via `concurrently`). |
| `npm run dev:mcp` | Start the read-only schema MCP server as a standalone Streamable HTTP server on `:3100/mcp`. Not needed for the `.mcp.json` (stdio) registration — seeds the database automatically if it doesn't exist yet. |
| `npm run db:reset` | Drop, recreate, and re-seed `data/northridge.db`. |
| `npm test` | Run unit tests (`node:test`). |
| `npm run test:e2e` | Run end-to-end tests (Playwright). |
| `npm run typecheck` | Type-check the TypeScript (`tsc --noEmit`). |
| `npm run build` | Type-check, then build each department's frontend to `dist/`. |
| `npm start` | Run the production build: each department serves its built `dist/` (no Vite dev server). Run `npm run build` first. |

## Production build

In development each department runs Vite in middleware mode (with HMR). For a
production-style run, build the static frontends and start the servers in
production mode:

```bash
npm run build   # type-check + vite build for each department (outputs dist/)
npm start       # serve the built assets; each department serves its own dist/
```

In production mode the department servers serve their `dist/` output and do not
load Vite, so a production install can omit the dev dependencies. The gateway
still proxies `:3000` → each department exactly as in development. Deployment
(hosting, process management, TLS) is out of scope for this repository.

## Project layout

```
northridge-video/
|- data/            schema.sql, seed.js, northridge.db (generated)
|- shared/          openDb() factory, browser cart, shared CSS
|- gateway/         TS: proxy + search + checkout + shell
|- mcp-server/      TS: read-only schema MCP server (Streamable HTTP)
|- apps/
|  |- video/        JS  - jQuery client + API + Vite middleware
|  |- music/        TS  - React client + API + Vite middleware
|  \- books/        TS  - React client + API + Vite middleware
\- tests/
   |- unit/         node:test
   \- e2e/          Playwright
```

## Testing

- **Unit** (`npm test`): Node's built-in `node:test` — zero extra runners. The gateway, Music, and Books have full coverage; the Video department is thinly covered and being brought up to parity.
- **E2E** (`npm run test:e2e`): Playwright drives the full stack through the gateway (browse -> cart -> checkout).

## Azure CI/CD

The Azure Container Apps Terraform and GitHub Actions setup is documented in
[`infra/README.md`](infra/README.md). Run `scripts/setup-azure-oidc.sh` once to
configure OIDC, remote Terraform state, and repository variables.

## Notes

- **Shared database across services.** The department apps are built and run independently but share one SQLite file, so they are not fully isolated services — treat the tables each app reads as owned by that app by convention.
- **TypeScript with no build step in dev.** Node 24 strips types at load time. Keep TypeScript to erasable syntax (no `enum`, no parameter properties, no decorators); `npm run typecheck` does the actual type-checking.
