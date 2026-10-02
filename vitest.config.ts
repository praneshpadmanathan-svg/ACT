import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

import { contentModules } from './src/content/vitePlugin.ts';

/* Separate from vite.config.ts on purpose.

   That file resolves Supabase env vars and runs a second build pass to
   compile the service worker — neither belongs in a test run, and the second
   would try to write to dist/ on every `vitest` invocation. The things
   worth sharing are the `@/*` path alias, so tests can import the same way
   the app does — and the content plugin, which assembles the question bank's
   pieces and without which `@/content` does not resolve. */
export default defineConfig({
  plugins: [contentModules(fileURLToPath(new URL('./src/content', import.meta.url)))],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    /* Pure-function unit tests live beside the module they test — including
       under scripts/, where the perfect36 importer's two content transforms
       live. Build tooling is normally left untested here because it fails
       loudly, but those two produce plausible-looking wrong content instead. */
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.mjs'],
  },
});
