import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const root = fileURLToPath(new URL('.', import.meta.url));
const buildId = Date.now().toString(36);

/** Every file under public/, as absolute URL paths. */
function publicAssets(dir: string = join(root, 'public'), base = ''): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...publicAssets(full, `${base}/${entry}`));
    else out.push(`${base}/${entry}`);
  }
  return out;
}

/**
 * Build the service worker as a second pass, with the list of files to
 * precache baked in.
 *
 * This is the one part of the job that cannot be written by hand ahead of time:
 * asset filenames carry a content hash that does not exist until the bundle
 * does. So the worker is compiled after the main build, once the manifest can
 * be read off the emitted chunks.
 *
 * Doing it here rather than taking the Workbox dependency keeps eight
 * high-severity advisories out of the tree — all of them in its transitive
 * build tooling — for about forty lines of config.
 */
function serviceWorker(): Plugin {
  return {
    name: 'act-command:service-worker',
    apply: 'build',
    enforce: 'post',
    async writeBundle(options, bundle) {
      const outDir = options.dir ?? join(root, 'dist');

      /* What is worth carrying offline.
       *
       * Fontsource ships a `.woff` beside every `.woff2` for browsers older
       * than about 2015, and a Vietnamese subset for a font used here to set
       * English lessons. No browser that supports service workers will ever
       * request either, so precaching them is a third of a megabyte spent to
       * hold files nobody fetches. They stay in `dist` — the CSS still
       * references them and a museum browser can still have them — they just
       * do not get stuffed into everyone's offline cache. */
      const deadWeight = (name: string) =>
        name.endsWith('.map') ||
        name.endsWith('.woff') ||
        name.includes('-vietnamese-');

      const emitted = Object.values(bundle)
        .map((chunk) => `/${chunk.fileName}`)
        // The worker precaches its dependencies, never itself.
        .filter((name) => !name.endsWith('/sw.js') && !deadWeight(name));

      const precache = [...new Set(['/index.html', ...emitted, ...publicAssets()])];

      const { build } = await import('vite');
      await build({
        configFile: false,
        logLevel: 'warn',
        define: {
          __PRECACHE__: JSON.stringify(precache),
          __BUILD_ID__: JSON.stringify(buildId),
        },
        build: {
          outDir,
          emptyOutDir: false,
          target: 'es2022',
          lib: {
            entry: join(root, 'src/sw.ts'),
            formats: ['es'],
            fileName: () => 'sw',
          },
          rollupOptions: { output: { entryFileNames: 'sw.js' } },
        },
      });

      // A record of what the worker decided to hold, for when it misbehaves.
      writeFileSync(
        join(outDir, 'precache-manifest.json'),
        JSON.stringify({ buildId, count: precache.length, precache }, null, 2),
      );
      console.log(`\n  service worker: precaching ${precache.length} files (build ${buildId})`);
    },
  };
}

export default defineConfig({
  plugins: [react(), serviceWorker()],
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
        /* The function form rather than the object map: Rollup 4 narrowed the
           object overload out of the type, and matching on the directory is
           more accurate anyway — it catches every JSON file in the library, not
           just whatever `index.ts` happens to re-export. */
        manualChunks(id) {
          if (id.includes('/src/content/') || id.includes('\\src\\content\\')) return 'content';
          return undefined;
        },
      },
    },
  },
});
