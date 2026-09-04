---
applyTo: "**/*.html"
---

# HTML conventions

Applies to the department entry HTML files (`apps/*/index.html`) and any other static HTML in the repo.

## Structure

- Keep entry pages minimal: `<!doctype html>`, `lang="en"`, a `<meta charset="UTF-8">` and a responsive viewport meta tag, a `<title>` in the form `"Northridge Video — <Department>"`, and the shared `<link rel="icon" href="/favicon.svg" />`.
- The shared top nav (brand link, Video/Music/Books links, cart count, search form) is duplicated per department today — when editing it in one `index.html`, check whether the same change is needed in the others for consistency, since there is no shared layout partial.
- Each department mounts its app into a single container: `<div id="app">...</div>` (Video, plain JS) or `<div id="root"></div>` (Music/Books, React), with a human-readable loading fallback as the initial content (e.g. `Loading the video department…`).
- Load the client entry as a module script at the end of `<body>`: `<script type="module" src="/client/main.js"></script>` (or `.tsx` where applicable via Vite's transform).

## Conventions

- Use semantic elements where practical (`<nav>`, `<form>`) and keep ids/classes consistent with what the corresponding client script queries (e.g. `#nrv-cart-count`, `#app`, `#root`) — don't rename these without updating the matching JS/TSX.
- Cart count and other dynamic placeholders are plain `<span id="...">0</span>` elements updated by `shared/cart-ui.js`; don't hardcode dynamic values beyond a sane placeholder.
- Prefer accessible form controls: label search inputs with `aria-label`, keep `<nav>` landmarks for pagers (`aria-label="Catalog pages"` in the React pager output).
- New static HTML should stay framework-agnostic markup — actual styling comes from `legacy.css` (Video) or Bootstrap 4 + `theme.css` (Music/Books/gateway shell), not inline `style` attributes.
