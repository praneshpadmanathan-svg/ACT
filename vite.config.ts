import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const root = fileURLToPath(new URL('.', import.meta.url));
const buildId = Date.now().toString(36);

/* ------------------------------------------------- finding the Supabase keys

   Vite only exposes `VITE_`-prefixed variables to the browser. The official
   Vercel-Supabase integration does not create any: it injects
   `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and
   friends, because it was built for Next.js. So connecting the integration
   appears to work, populates a dozen variables in the Vercel dashboard, and
   the deployed app still has no accounts — `cloudEnabled` stays false and
   nothing anywhere says why.

   The tempting fix is to widen `envPrefix` to `SUPABASE_`. **Do not.** The same
   integration also injects `SUPABASE_SECRET_KEY`, `POSTGRES_PASSWORD` and
   `POSTGRES_URL`, and widening the prefix would compile every one of them into
   the public JavaScript bundle. A service-role key in a browser bundle bypasses
   row-level security completely — it is read and write access to every
   student's account for anyone who opens devtools.

   So: an explicit allowlist of names that are *publishable by design*, and
   nothing else is ever read. */
const URL_NAMES = ['VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL'];

const KEY_NAMES = [
  'VITE_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_ANON_KEY',
];

/** True for a key that must never reach a browser. */
function isSecretKey(key: string): boolean {
  if (/^sb_secret_/.test(key)) return true;
  // A service-role JWT carries its role in the payload.
  const payload = key.split('.')[1];
  if (!payload) return false;
  try {
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
    return /"role"\s*:\s*"service_role"/.test(json);
  } catch {
    return false;
  }
}

function resolveSupabase(mode: string): { url: string; key: string } {
  // '' reads every name from .env files; process.env carries what Vercel set.
  const env = { ...loadEnv(mode, root, ''), ...process.env } as Record<string, string | undefined>;
  const pick = (names: string[]) => names.map((n) => env[n]).find((v) => v && v.trim()) ?? '';

  const url = pick(URL_NAMES).replace(/\/+$/, '');
  const key = pick(KEY_NAMES);

  /* A wrong paste here is not a broken build, it is a data breach that ships
     and looks fine. Refuse rather than warn. */
  if (key && isSecretKey(key)) {
    throw new Error(
      'Refusing to build: the resolved Supabase key is a secret/service_role key.\n' +
        'That key bypasses row-level security and must never enter a browser bundle.\n' +
        'Use the anon / publishable key instead.',
    );
  }

  if (url && key) {
    console.log(`  supabase: accounts enabled (${new URL(url).hostname})`);
  } else {
    console.log('  supabase: not configured — building in local-only mode');
  }
  return { url, key };
}

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
        name.includes('-vietnamese-') ||
        /* The responsive art variants under `/art/gen/`. There are twenty-two
           of them and any one device requests about five — the browser picks
           by viewport and pixel ratio, so precaching the set would cost around
           1.2 MB of everyone's storage quota to hold twenty files they will
           never ask for. The five originals stay precached, and `sw.ts` falls
           back to the matching original when a variant is wanted offline and
           has never been fetched. */
        name.startsWith('/art/gen/') ||
        /* The share card. A quarter of a megabyte that only ever gets fetched
           by Facebook's and Slack's crawlers — the app itself never renders
           it, and no student is offline inside a link preview. */
        name === '/og.png';

      const emitted = Object.values(bundle)
        .map((chunk) => `/${chunk.fileName}`)
        // The worker precaches its dependencies, never itself.
        .filter((name) => !name.endsWith('/sw.js') && !deadWeight(name));

      /* `deadWeight` has to run over the public files too, not just the
         emitted chunks. It did not, which quietly undid most of what it was
         written for: every one of the twenty-two responsive art variants
         lives in `public/`, so the exclusion that exists to keep them out was
         filtering a list they were never in. Verified against `dist/sw.js`
         after this change — the precache drops from 53 entries to 30, and
         the five original paintings the fallback needs are all still in it. */
      const precache = [
        ...new Set(['/index.html', ...emitted, ...publicAssets().filter((n) => !deadWeight(n))]),
      ];

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

export default defineConfig(({ mode }) => {
  const supabase = resolveSupabase(mode);

  return {
    plugins: [react(), serviceWorker()],
    /* The app reads `import.meta.env.VITE_SUPABASE_*`. These are substituted at
     build time from whichever publishable name the host actually provided, so
     the same source works with a hand-written .env or with the Vercel
     integration's Next.js-shaped variables. */
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabase.url),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabase.key),
    },
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
  };
});
