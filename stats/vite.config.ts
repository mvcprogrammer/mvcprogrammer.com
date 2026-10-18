/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// portfolio-stats — vite.config.ts
// The same shape as the React edition's config: bundles under bundles/ (public/assets/ holds the
// shared fonts and is synced with other cache headers), nothing inlined because the site's Content
// Security Policy allows no inline script or style, and cssTarget pinned to browsers that support
// light-dark() so the CSS minifier leaves it alone (see ../react/vite.config.ts for the history).
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
