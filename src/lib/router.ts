/* A hash router small enough to read in one sitting.

   Hash-based so the app deploys to any static host without rewrite rules,
   and so the browser back button works — the old build trapped people in
   full-screen overlays with no way back. */

import { useCallback, useEffect, useSyncExternalStore } from 'react';

/** `forgot` asks for the reset email; `reset` is where the link lands. */
export type AuthMode = 'signin' | 'signup' | 'forgot' | 'reset';

const AUTH_MODES: AuthMode[] = ['signin', 'signup', 'forgot', 'reset'];

export type Route =
  | { name: 'landing' }
  | { name: 'auth'; mode: AuthMode }
  | { name: 'privacy' }
  | { name: 'terms' }
  | { name: 'onboarding' }
  | { name: 'home' }
  | { name: 'map' }
  | { name: 'path'; section: string }
  | { name: 'zone'; zone: string }
  | { name: 'boss'; section: string }
  | { name: 'notes'; section?: string }
  | { name: 'note'; page: string }
  | { name: 'drills'; section?: string }
  | { name: 'drill'; section: string; topic?: string }
  | { name: 'review' }
  | { name: 'bookmarks' }
  | { name: 'daily' }
  | { name: 'diagnostic' }
  | { name: 'tests' }
  | { name: 'test'; config: string }
  | { name: 'report'; id: string }
  | { name: 'stats' }
  | { name: 'profile' };

const listeners = new Set<() => void>();

function currentHash(): string {
  return window.location.hash.replace(/^#\/?/, '');
}

export function parseRoute(hash: string = currentHash()): Route {
  const [path, query] = hash.split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  const params = new URLSearchParams(query ?? '');

  switch (parts[0]) {
    case undefined:
    case '':
      return { name: 'landing' };
    case 'auth': {
      const mode = AUTH_MODES.find((m) => m === parts[1]) ?? 'signup';
      return { name: 'auth', mode };
    }
    case 'privacy':
      return { name: 'privacy' };
    case 'terms':
      return { name: 'terms' };
    case 'onboarding':
      return { name: 'onboarding' };
    case 'home':
      return { name: 'home' };
    case 'map':
      return { name: 'map' };
    case 'path':
      return parts[1] ? { name: 'path', section: parts[1] } : { name: 'map' };
    case 'zone':
      return parts[1] ? { name: 'zone', zone: parts[1] } : { name: 'map' };
    case 'boss':
      return parts[1] ? { name: 'boss', section: parts[1] } : { name: 'map' };
    case 'notes':
      return { name: 'notes', section: parts[1] };
    case 'note':
      return parts[1] ? { name: 'note', page: parts[1] } : { name: 'notes' };
    case 'drills':
      return { name: 'drills', section: parts[1] };
    case 'drill':
      return parts[1]
        ? { name: 'drill', section: parts[1], topic: params.get('topic') ?? undefined }
        : { name: 'drills' };
    case 'review':
      return { name: 'review' };
    case 'bookmarks':
      return { name: 'bookmarks' };
    case 'daily':
      return { name: 'daily' };
    case 'diagnostic':
      return { name: 'diagnostic' };
    case 'tests':
      return { name: 'tests' };
    case 'test':
      return parts[1] ? { name: 'test', config: parts[1] } : { name: 'tests' };
    case 'report':
      return parts[1] ? { name: 'report', id: parts[1] } : { name: 'tests' };
    case 'stats':
      return { name: 'stats' };
    case 'profile':
      return { name: 'profile' };
    default:
      return { name: 'home' };
  }
}

export function hrefFor(route: Route): string {
  switch (route.name) {
    case 'landing':
      return '#/';
    case 'auth':
      return `#/auth/${route.mode}`;
    case 'path':
      return `#/path/${route.section}`;
    case 'zone':
      return `#/zone/${route.zone}`;
    case 'boss':
      return `#/boss/${route.section}`;
    case 'notes':
      return route.section ? `#/notes/${route.section}` : '#/notes';
    case 'note':
      return `#/note/${route.page}`;
    case 'drills':
      return route.section ? `#/drills/${route.section}` : '#/drills';
    case 'drill':
      return route.topic
        ? `#/drill/${route.section}?topic=${encodeURIComponent(route.topic)}`
        : `#/drill/${route.section}`;
    case 'test':
      return `#/test/${route.config}`;
    case 'report':
      return `#/report/${route.id}`;
    default:
      return `#/${route.name}`;
  }
}

export function navigate(route: Route, opts: { replace?: boolean } = {}): void {
  const href = hrefFor(route);
  if (opts.replace) {
    window.history.replaceState(null, '', href);
    listeners.forEach((l) => l());
  } else {
    window.location.hash = href.slice(1);
  }
  // Full-screen route changes should always start at the top.
  window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let cachedHash = typeof window === 'undefined' ? '' : currentHash();
let cachedRoute: Route = parseRoute(cachedHash);

function getSnapshot(): Route {
  const hash = currentHash();
  if (hash !== cachedHash) {
    cachedHash = hash;
    cachedRoute = parseRoute(hash);
  }
  return cachedRoute;
}

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => listeners.forEach((l) => l()));
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useNavigate() {
  return useCallback((route: Route, opts?: { replace?: boolean }) => navigate(route, opts), []);
}

/** Warn before leaving a timed test with work in progress. */
export function useConfirmExit(active: boolean, message: string) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = message;
      return message;
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [active, message]);
}
