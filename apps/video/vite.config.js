import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));

// The Video app: plain jQuery, no framework plugin.
// Served under /video/ both directly (:3001) and through the gateway (:3000).
export default defineConfig({
  root,
  base: '/video/',
  appType: 'custom', // we serve index.html ourselves from server.js
  server: {
    middlewareMode: true,
    // Direct-connect HMR: Vite runs its own WebSocket on a dedicated port and
    // the browser connects straight to it (localhost), so the gateway never has
    // to proxy WebSocket upgrades. Each vertical uses a distinct HMR port.
    hmr: { port: 24601 },
  },
});
