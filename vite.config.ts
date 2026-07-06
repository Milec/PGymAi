/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Base path: '/' for local dev/preview, '/<repo>/' for GitHub Pages.
// The Pages workflow sets VITE_BASE=/PGymAi/.
const base = process.env.VITE_BASE || '/';

export default defineConfig({
  base,
  resolve: {
    alias: { '@': new URL('./src', import.meta.url).pathname },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'fonts/*.woff2'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: `${base}index.html`,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'stride-fonts',
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      manifest: {
        name: 'STRIDE — Strength Tracker',
        short_name: 'STRIDE',
        description:
          'Offline-first strength-tracking PWA with bodyweight-relative strength comparison.',
        theme_color: '#05070f',
        background_color: '#05070f',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        id: base,
        categories: ['health', 'fitness', 'sports'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
