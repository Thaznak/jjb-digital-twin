import { defineConfig, type Plugin } from 'vite';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

/** Stamps the service worker with a build id so phones pick up new versions. */
function stampServiceWorker(): Plugin {
  return {
    name: 'stamp-sw',
    apply: 'build',
    closeBundle() {
      const f = 'dist/sw.js';
      if (existsSync(f)) writeFileSync(f, readFileSync(f, 'utf8').replace('__BUILD__', Date.now().toString(36)));
    },
  };
}

// base relative: works on GitHub Pages (/<repo>/) and as a single file.
export default defineConfig({
  base: './',
  plugins: [stampServiceWorker()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
    rollupOptions: { output: { entryFileNames: 'assets/app.js', assetFileNames: 'assets/[name][extname]' } },
  },
  test: { globals: true, include: ['tests/**/*.test.ts'] },
});
