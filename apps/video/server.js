// Video department server: ONE Node process serving both the jQuery frontend
// and the video API. Plain JavaScript.
//
// In development it runs Vite in middleware mode (HMR). In production
// (`--prod`) it serves the built `dist/` folder and does not load Vite.
//
// Request flow (both modes): API routes (/video/api/*) are handled first, then
// the frontend (Vite in dev, static files in prod) with an index.html fallback.
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { registerShutdown } from '@northridge/shared';
import { handleVideoApi } from './api/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3001;
const isProd = process.argv.includes('--prod');

function handleApi(req, res) {
  if (req.url && req.url.startsWith('/video/api/')) {
    if (!handleVideoApi(req, res)) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end('{"error":"not found"}');
    }
    return true;
  }
  return false;
}

let server;
let onClose = () => {};

if (isProd) {
  const { createStaticSpa } = await import('@northridge/shared/static.js');
  const serveStatic = createStaticSpa(join(__dirname, 'dist'), '/video');
  server = http.createServer((req, res) => {
    if (handleApi(req, res)) return;
    void serveStatic(req, res);
  });
} else {
  // IMPORTANT: pass the config inline with `configFile: false`.
  // If Vite loads a config *file*, it bundles it into a short-lived
  // `vite.config.js.timestamp-*.mjs` next to the source. Under `node --watch`
  // that transient file registers as a change and restarts the process, which
  // recompiles the config, which writes the temp file again — an infinite
  // restart loop. Passing the already-imported config object avoids that.
  const { createServer: createViteServer } = await import('vite');
  const { default: viteConfig } = await import('./vite.config.js');
  const vite = await createViteServer({ ...viteConfig, configFile: false });
  onClose = () => vite.close();

  server = http.createServer((req, res) => {
    if (handleApi(req, res)) return;
    vite.middlewares(req, res, async () => {
      try {
        const template = readFileSync(join(__dirname, 'index.html'), 'utf8');
        const html = await vite.transformIndexHtml(req.url || '/', template);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html');
        res.end(html);
      } catch (err) {
        vite.ssrFixStacktrace(err);
        res.statusCode = 500;
        res.end(String(err));
      }
    });
  });
}

server.listen(PORT, () => {
  console.log(
    `[video] serving http://localhost:${PORT}/video/ (${isProd ? 'production' : 'development'})`,
  );
});

registerShutdown(async () => {
  await onClose();
  server.close();
});
