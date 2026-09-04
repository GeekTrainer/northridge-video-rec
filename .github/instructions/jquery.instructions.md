---
applyTo: "apps/video/client/**/*.js"
---

# jQuery conventions (Video department)

Applies to the legacy Video department frontend (`apps/video/client/*.js`). Video is intentionally kept on **plain JavaScript + jQuery** — do not introduce React, TypeScript, or a build-dependent framework here unless the change is explicitly part of migrating Video to the newer stack (see repo `README.md` tech-debt note).

## File conventions

- Untyped ES modules (`import`/`export`), no `.ts`/`.tsx`, no JSDoc type annotations beyond what already exists.
- Import jQuery as `import $ from 'jquery';` and the department stylesheet with `import './legacy.css';` at the top of `main.js`.
- Import `addToCart` from `@northridge/shared/cart.js` and `mountCartBadge` from `@northridge/shared/cart-ui.js`; call `mountCartBadge()` once at module scope, same as the React departments.

## Rendering pattern

- Build HTML via string concatenation (`'<div class="...">' + value + '</div>'`), not template literals mixed with `$()` chains — follow the existing string-building style in `renderCatalog`/`renderPager`/`detailRow`.
- Render by replacing markup wholesale: `$('#app').html(...)` for a full view swap, rather than incremental DOM mutation.
- Cache the top-level `$app = $('#app')` selector once per module and reuse it; don't re-query `#app` in every function.
- Keep a module-level variable (e.g. `let currentItems = []`) to remember the currently rendered page's data so click handlers can look up an item by SKU without re-fetching.

## Events

- Use **delegated** event binding on the persistent container, not per-element `.click()`: `$app.on('click', 'button.add', function () { ... })`. This is required because rows are re-rendered wholesale via `.html()`.
- Read data from `data-*` attributes via `.data('sku')` / `.attr('data-...')`, not closures over loop variables, since handlers run after the HTML has already been serialized.
- Guard pager clicks against `disabled`/`active` state before navigating (`if ($li.hasClass('disabled') || $li.hasClass('active')) return;`) and always call `e.preventDefault()` for anchor-based controls.

## Data & routing

- Fetch JSON with the native `fetch()` API (not `$.ajax`); check `res.ok` / `res.status === 404` explicitly and throw/handle accordingly, matching `loadCatalog`/`loadDetail`.
- Route client-side by matching `window.location.pathname` with a regex keyed to the department's SKU prefix (e.g. `/^\/video\/(VID-[^/]+)\/?$/`) in a single `route()` function called once at the bottom of the file; call `.catch()` on the resulting promise chain to render errors into `$app`.
- Escape any user/catalog text placed into `data-*` attributes (e.g. `item.title.replace(/"/g, '&quot;')`) since markup is built via concatenation.

## Styling

- Use the hand-rolled classes in `legacy.css` (prefixed `-legacy`, e.g. `.btn-legacy`, `.panel-legacy`, `.list-item-legacy`, `.pagination-legacy`) — this app does not use Bootstrap. Add new legacy-styled elements as `*-legacy` classes in that same file rather than pulling in Bootstrap or another framework.
