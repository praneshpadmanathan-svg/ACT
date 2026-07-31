/* The service worker. Hand-written, and short enough to hold in your head.

   Workbox does this job, but it arrives with a dependency tree that currently
   carries eight high-severity advisories, all of them build-time transitive
   junk (a templating engine, a make clone, a glob matcher). For a static SPA
   with a hash router the routing engine it provides is not needed: there is one
   HTML document, a handful of hashed assets, and one API origin to leave alone.

   The whole strategy:

   - **Assets** (`/assets/*`, art, fonts) are content-hashed by Vite, so a URL's
     contents can never change. Cache first, forever, no revalidation.
   - **The document** is network-first with a cached fallback. It is the one
     file whose URL stays the same while its contents change, so serving it from
     cache without asking would pin people to an old build — the classic way a
     service worker bricks a site.
   - **Everything else** — Supabase, anything cross-origin — is never touched.
     Caching an auth call would be a security bug, not a performance win.
*/

/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

/* Match on the URL and nothing else.
 *
 * Without this the whole cache silently does nothing. Hosts send
 * `Vary: Origin` on static assets, and the Cache API honours Vary: it compares
 * the named headers on the *stored* request against the incoming one. The
 * worker's own precache fetches carry an `Origin` header; a browser loading a
 * same-origin module script does not send one. So every hashed asset —
 * the app bundle, the 600 kB question library, the stylesheet — was stored
 * successfully and then never matched again.
 *
 * The failure is invisible online, because a miss just goes to the network and
 * everything looks fine. It only shows up offline, which is the one moment the
 * cache exists for. Everything here is static, same-origin and content-hashed,
 * so the URL alone identifies the bytes and Vary has nothing useful to add. */
const MATCH = { ignoreVary: true } as const;

/** Injected at build time by the manifest plugin in vite.config.ts. */
declare const __PRECACHE__: string[];
declare const __BUILD_ID__: string;

const CACHE = `act-command-${__BUILD_ID__}`;

/* ------------------------------------------------------------------ install */

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      /* Individually, not addAll: addAll rejects the whole batch if a single
         request fails, which would leave the worker uninstalled and the app
         with no offline support at all because one image 404'd. */
      await Promise.all(
        __PRECACHE__.map(async (url) => {
          try {
            await cache.add(new Request(url, { cache: 'reload' }));
          } catch {
            console.warn('[sw] could not precache', url);
          }
        }),
      );
    })(),
  );
});

/* ----------------------------------------------------------------- activate */

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n.startsWith('act-command-') && n !== CACHE).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

/* Waiting is the default: a new worker sits idle until every tab using the old
   one has gone. The app offers a reload instead, and this is how it takes it —
   so an update never yanks the page out from under someone mid-question. */
self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | undefined)?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

/* -------------------------------------------------------------------- fetch */

const isAsset = (url: URL) =>
  url.pathname.startsWith('/assets/') ||
  url.pathname.startsWith('/art/') ||
  /\.(?:woff2?|png|svg|webp|ico)$/.test(url.pathname);

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Someone else's origin — Supabase above all — is none of our business.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(CACHE);
          cache.put('/index.html', fresh.clone());
          return fresh;
        } catch {
          const cached = await caches.match('/index.html', MATCH);
          if (cached) return cached;
          return new Response('Offline, and no cached copy of the app yet.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          });
        }
      })(),
    );
    return;
  }

  if (!isAsset(url)) return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(request, MATCH);
      if (cached) return cached;
      const fresh = await fetch(request);
      if (fresh.ok) {
        const cache = await caches.open(CACHE);
        cache.put(request, fresh.clone());
      }
      return fresh;
    })(),
  );
});

export {};
