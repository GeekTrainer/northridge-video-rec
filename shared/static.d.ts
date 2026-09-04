import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Build a request handler that serves the built SPA in `dir` mounted at
 * `basePrefix` (e.g. '/music'), with an index.html fallback for unknown routes.
 */
export declare function createStaticSpa(
  dir: string,
  basePrefix: string,
): (req: IncomingMessage, res: ServerResponse) => Promise<void>;
