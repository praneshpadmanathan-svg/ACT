/* Recovering from a deploy that happened while the tab was open.

   Every screen and every piece of the question bank is a lazily fetched
   chunk with a content hash in its name. Deploy, and the old hashes stop
   existing: a student who opened the app before the deploy and taps into a
   screen they have not visited yet asks for a file that is gone. The import
   rejects, and it rejects *permanently* — React caches a rejected `lazy()`
   promise, and the browser caches a failed dynamic import — so the crash
   screen's "Try again" re-rendered into the same failure, over and over.

   The only real fix is a fresh page, which loads the new build's index and
   its new hashes. So: reload, once. A flag in sessionStorage records when we
   did, so a chunk that is missing for some other reason (the CDN is down, the
   device is offline) gets one reload and then the error screen, rather than a
   reload loop. The flag carries a timestamp rather than a yes, so the same
   tab can recover again from the *next* deploy an hour later. */

const FLAG = 'act-command:chunk-reload';

/** A second failure within this long of the last reload is not a stale
 *  build — the reload already fetched the current one — so stop and show it. */
export const RELOAD_COOLDOWN_MS = 60_000;

/** The messages each engine uses for a dynamic import or preload that failed. */
const CHUNK_FAILURE =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|Loading (CSS )?chunk [\w-]+ failed|ChunkLoadError/i;

export function isChunkLoadError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { name, message } = error as { name?: unknown; message?: unknown };
  return name === 'ChunkLoadError' || (typeof message === 'string' && CHUNK_FAILURE.test(message));
}

function lastReload(): number {
  try {
    return Number(window.sessionStorage.getItem(FLAG)) || 0;
  } catch {
    return 0;
  }
}

/**
 * Reload the page to pick up the current build, unless that was already
 * tried in the last minute. Returns whether a reload was started — when it
 * was, the caller should show nothing and wait for the page to go.
 */
export function reloadForNewBuild(now: number = Date.now()): boolean {
  if (now - lastReload() < RELOAD_COOLDOWN_MS) return false;
  try {
    window.sessionStorage.setItem(FLAG, String(now));
  } catch {
    /* Without the flag there is no loop guard, so do not reload at all. */
    return false;
  }
  window.location.reload();
  return true;
}

/**
 * Wrap a dynamic import so that a stale-build failure reloads the page
 * instead of reaching an error boundary. While the reload is under way the
 * promise never settles, which keeps the Suspense skeleton on screen rather
 * than flashing an error the student has no time to read.
 */
export function reloadOnChunkError<T>(load: Promise<T>): Promise<T> {
  return load.catch((error: unknown) => {
    if (isChunkLoadError(error) && reloadForNewBuild()) return new Promise<T>(() => {});
    throw error;
  });
}
