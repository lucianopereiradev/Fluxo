import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

/** Preloads the two Latin font files used above the fold, with their hashed build names. */
function preloadFonts(patterns: RegExp[]): Plugin {
  return {
    name: 'fluxo:preload-fonts',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const files = Object.keys(ctx.bundle ?? {}).filter((f) => patterns.some((p) => p.test(f)));
        return files.map((f) => ({
          tag: 'link',
          attrs: { rel: 'preload', href: `/${f}`, as: 'font', type: 'font/woff2', crossorigin: '' },
          injectTo: 'head',
        }));
      },
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    preloadFonts([/fraunces-latin-soft-normal-.*\.woff2$/, /geist-latin-wght-normal-.*\.woff2$/]),
    VitePWA({
      // The app asks before activating a new version (see UpdatePrompt).
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'theme-init.js'],
      manifest: {
        name: 'Fluxo — local-first personal finance',
        short_name: 'Fluxo',
        description:
          'A private, offline-first personal finance organizer. Your financial data never leaves your device.',
        lang: 'en',
        start_url: '/app',
        scope: '/',
        display: 'standalone',
        background_color: '#f4f1ea',
        theme_color: '#a84c26',
        categories: ['finance', 'productivity'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [{ name: 'New entry', url: '/app?quick=1' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // In development the Worker runs separately (npm run worker:dev) and the API is proxied.
    proxy: { '/api': 'http://localhost:8787' },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    // ECharts is the only large chunk and it loads lazily on the Reports page.
    chunkSizeWarningLimit: 700,
  },
});
