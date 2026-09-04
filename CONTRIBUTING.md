# Contributing to Northridge Video

[fork]: https://github.com/GeekTrainer/northridge-video/fork
[pr]: https://github.com/GeekTrainer/northridge-video/compare

Thank you for your interest in contributing to Northridge Video! Contributions that keep the storefront approachable, well-tested, and easy to work on are especially welcome.

Contributions to this project are [released](https://help.github.com/articles/github-terms-of-service/#6-contributions-under-repository-license) to the public under the [project's open source license](LICENSE).

## Getting Started

### Prerequisites

Before you can run and test the application locally, you'll need to install:

- **Node.js 24 LTS** (or newer) — [Download](https://nodejs.org/) | [Homebrew](https://formulae.brew.sh/formula/node). This is the only runtime requirement: the database is the built-in `node:sqlite` module, and TypeScript runs directly via Node's type stripping (no build step).
- **Git** — [Download](https://git-scm.com/downloads) | [Homebrew](https://formulae.brew.sh/formula/git)

### Setting Up Your Development Environment

1. Fork and clone the repository:
   ```bash
   git clone https://github.com/YOUR-USERNAME/northridge-video.git
   cd northridge-video
   ```

2. Install dependencies:
   ```bash
   npm install
   npx playwright install chromium   # only needed for the E2E tests
   ```

3. Create and seed the database:
   ```bash
   npm run db:reset
   ```

4. Start all four processes:
   ```bash
   npm run dev
   ```

5. Open your browser to [http://localhost:3000](http://localhost:3000)

## Project Structure

- `data/` — `schema.sql`, the seed script, and the generated `northridge.db`
- `shared/` — the `openDb()` connection factory, the browser cart, and shared CSS
- `gateway/` — the TypeScript gateway: reverse proxy, cross-vertical search, fake checkout, and the shared shell
- `apps/video/` — the Video department: **jQuery + plain JavaScript** (the older app, being migrated to the newer stack)
- `apps/music/`, `apps/books/` — the Music and Books departments: **React + TypeScript**
- `tests/unit/` — `node:test` unit tests
- `tests/e2e/` — Playwright end-to-end tests

## Making Changes

### Data layer (`node:sqlite`)

- Define tables and views in `data/schema.sql`; keep it fully normalized (lookup tables and many-to-many join tables), with views that flatten joins for the app code.
- Always open the database through the shared `openDb()` factory so foreign-key enforcement is applied.
- Keep all seed/sample data invented — do not use real product, work, company, or person names.
- Add or update unit tests for any data-layer change.

### Backends (Node HTTP + Vite middleware)

- Use type hints for all function parameters and return values in the TypeScript verticals.
- Keep TypeScript to erasable syntax only (no `enum`, parameter properties, or decorators) so Node's type stripping can run it directly; `npm run typecheck` does the actual type-checking.
- The Video app is still on plain JavaScript; keep it that way unless your change is specifically part of migrating it to TypeScript.

### Frontends

- Music and Books use React with Bootstrap 4 styling; Video uses jQuery with an older look.
- Add `data-*` hooks or stable class names to interactive elements so they can be targeted by tests.

## Testing

Run the suites before submitting; all tests must pass:

```bash
npm run typecheck
npm test          # unit tests (node:test)
npm run test:e2e  # end-to-end tests (Playwright)
```

The Video department is currently thinly covered by tests; changes to Video should add coverage where practical.

## Submitting a Pull Request

### Issues

All change requests should start with an issue. You're welcome to file the issue alongside the PR, but an issue should always exist.

### Workflow

1. Create a new branch from `main` for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes, following the documented conventions.

3. Run the test suites to ensure nothing is broken:
   ```bash
   npm run typecheck
   npm test
   npm run test:e2e
   ```

4. Commit your changes with a clear, descriptive message.

5. Push to your fork and [submit a pull request][pr].

6. Wait for your pull request to be reviewed and merged.

### Pull Request Guidelines

- Keep your changes focused. Unrelated changes should be separate pull requests.
- Write clear commit messages that explain *what* and *why*.
- Update documentation if your changes affect how the application works.
- Ensure all tests pass before requesting a review.

## Reporting Issues

Found a bug or have a feature request? Please [open an issue](https://github.com/GeekTrainer/northridge-video/issues/new) with:

- A clear, descriptive title
- Steps to reproduce (for bugs)
- Expected vs. actual behavior
- Your environment details (OS, Node version)

## Resources

- [How to Contribute to Open Source](https://opensource.guide/how-to-contribute/)
- [Using Pull Requests](https://help.github.com/articles/about-pull-requests/)
- [GitHub Help](https://help.github.com)
