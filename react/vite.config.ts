/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// portfolio-react — vite.config.ts
// The bundles go under bundles/ rather than Vite's default assets/, because public/assets/ holds the
// fonts and images shared with the static site and the deploy syncs the two folders with different
// cache headers. Nothing is inlined: the site's Content Security Policy allows no inline script or style.
// cssTarget names browsers that support light-dark(), which react.css uses for this edition's palette.
// Without it Vite's CSS minifier rewrites light-dark() into a variable polyfill that depends on the
// color-scheme declaration being in the same file; it lives in the shared styles.css, so the polyfill
// never resolves and every token goes invalid. Older browsers ignore light-dark() and keep the shared
// Rider palette, the same fallback the other editions get.
export default defineConfig({
  plugins: [react()],
  build: {
    assetsDir: 'bundles',
    assetsInlineLimit: 0,
    cssTarget: ['chrome123', 'edge123', 'firefox120', 'safari17.5'],
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/testing/setup.ts'],
  },
});
