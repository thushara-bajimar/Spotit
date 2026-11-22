import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// In development the client calls relative /api/... URLs and Vite forwards
// them to the Express server, so no CORS setup is needed and auth cookies
// (Phase 2) stay first-party.
const API_TARGET = process.env.API_PROXY_TARGET || 'http://localhost:4000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: API_TARGET },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': { target: API_TARGET },
    },
  },
  test: {
    environment: 'node',
  },
});
