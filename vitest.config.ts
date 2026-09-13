import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

/* Separate from vite.config.ts on purpose.

   That file resolves Supabase env vars and runs a second build pass to
   compile the service worker — neither belongs in a test run, and the second
   would try to write to dist/ on every `vitest` invocation. The one thing
   worth sharing is the `@/*` path alias, so tests can import the same way
   the app does. */
export default defineConfig({
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
