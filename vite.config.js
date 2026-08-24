import { defineConfig } from 'vite';

// The 57 legacy files in public/ are static assets, NOT bundler inputs.
//
// That is deliberate and load-bearing. They are classic scripts that patch each
// other's globals at runtime -- patch.js overrides window.coach, water-search.js
// overrides window.searchWater, mission-v3.js overrides again -- so their load
// order is semantics, not style. And pwa.js lazily injects 19 of them by
// hardcoded '/module.js' URL. Treating them as entries would let Rollup reorder,
// rename, hash, tree-shake, or strict-mode them, and every one of those breaks
// the app. publicDir copies them byte-for-byte at unchanged URLs.
//
// Only genuinely new code lives in src/ and gets bundled.
export default defineConfig({
  // Wrangler's Vite auto-configuration requires an explicit plugins array.
  plugins: [],
  root: '.',
  publicDir: 'public',
  envPrefix: 'VITE_',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // The app already ships optional chaining and nullish coalescing, so it has
    // never supported anything older than this anyway.
    target: 'es2020',
    sourcemap: true,
    rollupOptions: {
      input: { main: 'index.html' },
      output: {
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash][extname]',
      },
    },
  },
  server: { port: 5173 },
});
