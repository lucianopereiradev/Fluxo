import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
  },
});
