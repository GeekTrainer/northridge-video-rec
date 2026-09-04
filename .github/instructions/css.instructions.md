---
applyTo: "**/*.css"
---

# CSS conventions

Applies to `shared/theme.css` and `apps/video/client/legacy.css` (the only stylesheets in the repo).

## Two distinct visual systems — don't mix them

- **`shared/theme.css`** layers custom accents *on top of Bootstrap 4* for the Music and Books departments (and the gateway shell). It assumes Bootstrap's grid/utility classes are already loaded and only adds the Northridge-specific look (compact navbar, hero band, department cards, footer).
- **`apps/video/client/legacy.css`** is a fully hand-rolled sheet for the Video department with no framework dependency — it re-creates a Bootstrap-3-era look (glossy buttons, `.panel-legacy`, `.navbar-legacy`) from scratch. Do not add a Bootstrap dependency to Video, and do not pull `legacy.css` classes into Music/Books or vice versa.
- Keep new rules in the file matching the department's visual system; never introduce a third styling approach without updating this instruction.

## Naming

- Prefix custom (non-Bootstrap) classes with `nrv-` in `theme.css` (e.g. `.nrv-navbar`, `.nrv-hero`, `.nrv-dept-card`, `.nrv-detail-link`) to distinguish them from Bootstrap's own classes at a glance.
- Suffix custom classes with `-legacy` in `legacy.css` (e.g. `.btn-legacy`, `.panel-legacy`, `.list-item-legacy`, `.pagination-legacy`) for the same reason, and to signal they belong to the legacy visual system.
- Scope legacy rules under the root `.nrv-legacy` / `.container-legacy` wrapper classes already present on `<body>`/containers rather than relying on element selectors alone.

## Style

- Group related rules under a `/* ---- Section name ------- */`-style banner comment (see both files) so sections stay scannable as the sheet grows.
- Lead the file with a short block comment describing its purpose and relationship to the other stylesheet/framework, matching the existing header comments.
- Keep the design compact/mobile-aware: the site can run in a narrow panel, so prefer flex-wrap layouts and small font sizes over fixed-width, desktop-only rules (see the navbar wrapping behavior in `theme.css`).
- Favor small, composable rules over deeply nested selectors; keep specificity low so Bootstrap utility classes can still override where intended.
