import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));

// The Books app (the newest vertical): React + TS.
// Served under /books/ directly (:3003) and through the gateway (:3000).
export default defineConfig({
  root,
  base: '/books/',
  appType: 'custom',
  plugins: [react()],
  server: {
    middlewareMode: true,
    hmr: { port: 24603 },
  },
});
