import { defineConfig } from 'vite';

// base relative : la démo fonctionne aussi bien à la racine d'un domaine que dans un sous-dossier
// (GitHub Pages, itch.io, Netlify…).
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
  },
  server: { host: true },
});
