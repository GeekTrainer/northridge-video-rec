---
name: run-tests
description: 'Run the Northridge Video test suites consistently: seed the database, run unit tests, run end-to-end tests, and report anything that failed. Use when the user asks to run tests, verify behavior, check regressions, or summarize test failures.'
---

# Run Tests for Northridge Video

**PROJECT SKILL** - runs the repository test suites in the same order every time and produces a failure-focused report.

## Workflow

1. Run from the repository root.
2. Use the shared report runner:

```bash
   node .github/skills/run-tests/scripts/run-tests-with-report.mjs
```

3. Read the generated Markdown report path printed by the runner.
4. Summarize the outcome to the user. Lead with pass/fail status, then highlight failed suites and the most relevant failure lines from the report.

## What the runner does

The runner performs these steps in order:

1. Seeds the shared SQLite database with `npm run db:reset`.
2. Runs unit tests via `.github/skills/run-tests/scripts/run-unit-tests.sh`.
3. Runs end-to-end tests via `.github/skills/run-tests/scripts/run-e2e-tests.sh`.
4. Writes logs and a Markdown report under `.copilot-test-reports/<timestamp>/`.

The runner continues to end-to-end tests even if unit tests fail so the report captures all currently visible failures.

## Report expectations

- The Markdown report includes command, status, duration, and log path for each step.
- Failed steps include the tail of their captured output so the agent can quickly identify the issue.
- If Playwright creates `playwright-report/`, mention that the HTML report is available there when e2e tests fail.

## Troubleshooting

If end-to-end tests fail because the Playwright browser executable is missing, run:

```bash
npx playwright install chromium
```

Then rerun the shared report runner once.

## Direct scripts

Use these only when the user asks for a specific suite:

```bash
.github/skills/run-tests/scripts/run-unit-tests.sh
.github/skills/run-tests/scripts/run-e2e-tests.sh
```

When running an individual suite directly, create a short chat report that includes the command, pass/fail status, and the relevant failure output.
