import { defineConfig } from 'vite';

// base relative: works on GitHub Pages (/jjb-digital-twin/) and as a single file.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
    rollupOptions: { output: { entryFileNames: 'assets/app.js', assetFileNames: 'assets/[name][extname]' } },
  },
  test: { globals: true, include: ['tests/**/*.test.ts'] },
});
