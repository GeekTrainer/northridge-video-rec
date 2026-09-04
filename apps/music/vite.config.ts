import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));

// The Music app (vinyl / CD / cassette + turntables & speakers): React + TS.
// Served under /music/ directly (:3002) and through the gateway (:3000).
export default defineConfig({
  root,
  base: '/music/',
  appType: 'custom', // server.ts serves index.html itself
  plugins: [react()],
  server: {
    middlewareMode: true,
    // Direct-connect HMR on a dedicated port (see architecture notes).
    hmr: { port: 24602 },
  },
});
