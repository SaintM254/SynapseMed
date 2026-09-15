import { defineConfig } from 'vite';

// Relative base so the same build works on a project page
// (https://<user>.github.io/SynapseMed/) and on a root domain.
export default defineConfig({
  base: './',
  server: {
    host: true, // listen on 0.0.0.0 (LAN / sandbox previews)
    allowedHosts: true, // accept the preview proxy host
    port: 5173
  },
  preview: {
    host: true,
    allowedHosts: true,
    port: 4173
  },
  build: {
    target: 'es2022',
    // pdf.js is heavy but lazy-loaded (only when a PDF is opened),
    // so the initial bundle stays tiny. Silence the size warning for it.
    chunkSizeWarningLimit: 1600
  }
});
