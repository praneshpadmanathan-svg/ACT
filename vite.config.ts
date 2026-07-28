import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // The content chunk is ~600 kB of static JSON by design (754 questions,
    // 60 note pages, 27 passages). It is split out so the app shell paints
    // first and the browser caches the library separately across deploys.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          content: [
            './src/content/index.ts',
          ],
        },
      },
    },
  },
});
