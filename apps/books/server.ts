// Books department server (TypeScript): one Node process serving the React
// frontend and the books API.
//
// In development it runs Vite in middleware mode (HMR). In production
// (`--prod`) it serves the built `dist/` folder and does not load Vite.
import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { registerShutdown } from '@northridge/shared';
import { handleBooksApi } from './api/index.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3003;
const isProd = process.argv.includes('--prod');

function handleApi(req: IncomingMessage, res: ServerResponse): boolean {
  if (req.url && req.url.startsWith('/books/api/')) {
    if (!handleBooksApi(req, res)) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end('{"error":"not found"}');
    }
    return true;
  }
  return false;
}

let server: http.Server;
let onClose: () => void | Promise<void> = () => {};

if (isProd) {
  const { createStaticSpa } = await import('@northridge/shared/static.js');
  const serveStatic = createStaticSpa(join(__dirname, 'dist'), '/books');
  server = http.createServer((req, res) => {
    if (handleApi(req, res)) return;
    void serveStatic(req, res);
  });
} else {
  const { createServer: createViteServer } = await import('vite');
  const { default: viteConfig } = await import('./vite.config.ts');
  const vite = await createViteServer({ ...viteConfig, configFile: false });
  onClose = () => vite.close();

  server = http.createServer((req, res) => {
    if (handleApi(req, res)) return;
    vite.middlewares(req, res, async () => {
      try {
        const template = readFileSync(join(__dirname, 'index.html'), 'utf8');
        const html = await vite.transformIndexHtml(req.url ?? '/', template);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html');
        res.end(html);
      } catch (err) {
        vite.ssrFixStacktrace(err as Error);
        res.statusCode = 500;
        res.end(String(err));
      }
    });
  });
}

server.listen(PORT, () => {
  console.log(
    `[books] serving http://localhost:${PORT}/books/ (${isProd ? 'production' : 'development'})`,
  );
});

registerShutdown(async () => {
  await onClose();
  server.close();
});
