/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// portfolio-react — vite.config.ts
// The bundles go under bundles/ rather than Vite's default assets/, because public/assets/ holds the
// fonts and images shared with the static site and the deploy syncs the two folders with different
// cache headers. Nothing is inlined: the site's Content Security Policy allows no inline script or style.
export default defineConfig({
  plugins: [react()],
  build: {
    assetsDir: 'bundles',
    assetsInlineLimit: 0,
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/testing/setup.ts'],
  },
});
