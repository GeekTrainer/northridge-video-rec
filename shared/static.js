// Minimal static file server for a built single-page app.
//
// In production each department serves its Vite build output (a `dist/` folder)
// instead of running the Vite dev server. This helper resolves a request to a
// file inside the build directory and falls back to `index.html` for unknown
// paths so client-side routes (e.g. product detail pages) still load.
//
// Plain JavaScript so both the JS Video app and the TS apps can import it.

import { readFile } from 'node:fs/promises';
import { join, normalize, extname, resolve, sep } from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * Build a request handler that serves the SPA in `dir` mounted at `basePrefix`.
 * @param {string} dir Absolute path to the build output directory.
 * @param {string} basePrefix URL prefix the app is mounted at, e.g. '/music'.
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => Promise<void>}
 */
export function createStaticSpa(dir, basePrefix) {
  const root = resolve(dir);
  const indexPath = join(root, 'index.html');

  async function sendFile(res, filePath) {
    const data = await readFile(filePath);
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME[extname(filePath)] || 'application/octet-stream');
    res.end(data);
  }

  return async function serve(req, res) {
    // Strip query string and the mount prefix, then normalize.
    let rel = (req.url || '/').split('?')[0];
    if (rel.startsWith(basePrefix)) rel = rel.slice(basePrefix.length);
    try {
      rel = decodeURIComponent(rel);
    } catch {
      // malformed escape — treat as a fallback to index.html
      rel = '/';
    }

    // Resolve within root and reject any path traversal.
    const candidate = resolve(join(root, normalize('/' + rel)));
    const withinRoot = candidate === root || candidate.startsWith(root + sep);

    try {
      if (withinRoot && rel !== '/' && rel !== '') {
        try {
          await sendFile(res, candidate);
          return;
        } catch {
          // fall through to the SPA index below
        }
      }
      // SPA fallback: serve index.html for '/', unknown routes, etc.
      await sendFile(res, indexPath);
    } catch {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Not found');
    }
  };
}
