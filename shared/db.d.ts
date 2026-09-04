import type { DatabaseSync } from 'node:sqlite';

/** Absolute path to the single shared SQLite file. */
export declare const DB_PATH: string;

export interface OpenDbOptions {
  /** Open the database read-only. Defaults to false. */
  readonly?: boolean;
}

/**
 * Open a connection to northridge.db with `PRAGMA foreign_keys = ON` already applied.
 * This is the only supported way to open the database.
 */
export declare function openDb(options?: OpenDbOptions): DatabaseSync;

/** Close every connection opened by this process. Safe to call repeatedly. */
export declare function closeAll(): void;

/**
 * Register SIGINT/SIGTERM handlers that close DB connections cleanly, then run
 * an optional caller-supplied cleanup. Idempotent.
 */
export declare function registerShutdown(
  onShutdown?: () => void | Promise<void>,
): void;
