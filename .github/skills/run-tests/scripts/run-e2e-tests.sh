#!/usr/bin/env bash
# Runs the repository Playwright end-to-end suite with the standard npm script.

set -euo pipefail

npm run test:e2e
