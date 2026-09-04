// The ONE way anything opens northridge.db.
//
// Centralizing this guarantees two things that are easy to forget:
//   1. PRAGMA foreign_keys = ON  — SQLite ignores FK constraints unless this is
//      set per-connection. Our whole normalized schema depends on it.
//   2. A single, absolute path to the database file, resolved the same way no
//      matter which service's cwd is in play.
//
// Written in plain JavaScript (with a hand-written db.d.ts) so the untyped
// JavaScript Video app and the TypeScript apps/gateway can all import it.

import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Absolute path to the single shared SQLite file (repo-root/data/northridge.db). */
export const DB_PATH = join(__dirname, '..', 'data', 'northridge.db');

/** Track open connections so we can close them all on shutdown. */
const openConnections = new Set();

/**
 * Open a connection to northridge.db with foreign keys enforced.
 * @param {object} [options]
 * @param {boolean} [options.readonly=false] Open the database read-only.
 * @returns {import('node:sqlite').DatabaseSync}
 */
export function openDb(options = {}) {
  const db = new DatabaseSync(DB_PATH, { readOnly: options.readonly === true });
  // Must run per-connection, before any FK-dependent statement.
  db.exec('PRAGMA foreign_keys = ON;');
  openConnections.add(db);
  return db;
}

/** Close every connection this process opened. Safe to call more than once. */
export function closeAll() {
  for (const db of openConnections) {
    try {
      db.close();
    } catch {
      // already closed — ignore
    }
  }
  openConnections.clear();
}

let shutdownHooked = false;

/**
 * Register SIGINT/SIGTERM handlers that close DB connections cleanly, then
 * run an optional caller-supplied cleanup (e.g. closing the HTTP server).
 * Idempotent: only the first call wires up the process listeners.
 * @param {() => void | Promise<void>} [onShutdown]
 */
export function registerShutdown(onShutdown) {
  if (shutdownHooked) return;
  shutdownHooked = true;

  let shuttingDown = false;
  const handle = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    try {
      if (onShutdown) await onShutdown();
    } finally {
      closeAll();
      process.exit(signal === 'SIGINT' ? 130 : 143);
    }
  };

  process.once('SIGINT', () => handle('SIGINT'));
  process.once('SIGTERM', () => handle('SIGTERM'));
}
