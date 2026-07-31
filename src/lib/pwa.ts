/* Registering the service worker, and telling people when a new build is ready.

   The worker never takes over on its own. A new one installs, then waits, and
   the app surfaces a prompt — because activating immediately would swap the
   code out from under someone halfway through a timed section, and the one
   thing a test timer must not do is surprise you. */

const UPDATE_EVENT = 'act-command:update-ready';

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  // The dev server serves modules unbundled; a worker over that is only ever
  // a source of confusing stale-cache bugs.
  if (import.meta.env.DEV) return;

  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register('/sw.js', { type: 'module' })
      .then((registration) => {
        if (registration.waiting) announceUpdate(registration);

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            /* `controller` is null on the very first install — that is a fresh
               visitor getting offline support, not an update to announce. */
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              announceUpdate(registration);
            }
          });
        });
      })
      .catch((err) => console.warn('[pwa] registration failed', err));

    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  });
}

function announceUpdate(registration: ServiceWorkerRegistration): void {
  window.dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail: registration }));
}

/** Subscribe to "a newer build is sitting in the wings". */
export function onUpdateReady(handler: (apply: () => void) => void): () => void {
  const listener = (event: Event) => {
    const registration = (event as CustomEvent<ServiceWorkerRegistration>).detail;
    handler(() => registration.waiting?.postMessage({ type: 'SKIP_WAITING' }));
  };
  window.addEventListener(UPDATE_EVENT, listener);
  return () => window.removeEventListener(UPDATE_EVENT, listener);
}
