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
  | { name: 'cookies' }
  | { name: 'faq' }
  | { name: 'onboarding' }
  | { name: 'home' }
  | { name: 'path'; section?: string }
  | { name: 'zone'; zone: string }
  | { name: 'duels' }
  | { name: 'boss'; section: string }
  | { name: 'codex' }
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
  | { name: 'profile' }
  | { name: 'settings' }
  | { name: 'feedback' };

const listeners = new Set<() => void>();

function currentHash(): string {
  return window.location.hash.replace(/^#\/?/, '');
}

export function parseRoute(hash: string = currentHash()): Route {
  // `split` on a non-empty separator always yields at least one element, but
  // the type does not say so.
  const [path = '', query] = hash.split('?');
  let parts: string[];
  try {
    parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  } catch {
    return { name: 'landing' };
  }
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
    case 'cookies':
      return { name: 'cookies' };
    case 'faq':
      return { name: 'faq' };
    case 'onboarding':
      return { name: 'onboarding' };
    case 'home':
      return { name: 'home' };
    /* `#/map` was the adventure map. Old bookmarks and any link that escaped
       into the wild land on the subject list, which is what replaced it. */
    case 'map':
    case 'path':
      return { name: 'path', section: parts[1] };
    case 'zone':
      return parts[1] ? { name: 'zone', zone: parts[1] } : { name: 'path' };
    case 'duels':
      return { name: 'duels' };
    case 'boss':
      return parts[1] ? { name: 'boss', section: parts[1] } : { name: 'duels' };
    case 'codex':
      return { name: 'codex' };
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
    case 'settings':
      return { name: 'settings' };
    case 'feedback':
      return { name: 'feedback' };
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
      return route.section ? `#/path/${route.section}` : '#/path';
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

/* While a timed test runs, `useConfirmExit` puts its warning here. The browser's
   own `beforeunload` prompt only covers closing the tab — the nav rail, a
   back-swipe and every in-app link change the hash instead, and those left a
   running test without a word. */
let exitGuard: string | null = null;
/* Set when `navigate` has already asked, so the hashchange it causes does not ask again. */
let confirmedLeave = false;

/* A path that is not a route at all — `#/nonsense`, a typo, a link to a
   screen that was removed. `parseRoute` shows Home for those, which left the
   bad address in the bar to be bookmarked and shared. Only word-like first
   segments count: an auth redirect's `#access_token=…` must never be
   rewritten before the auth client has read it. */
function isUnknownPath(hash: string): boolean {
  const first = hash.split('?')[0]!.split('/')[0]!;
  return /^[\w-]+$/.test(first) && first !== 'home' && parseRoute(hash).name === 'home';
}

/* Where this tab is in its own history.

   Every entry the app lands on is stamped with its position in
   `history.state`. Cancelling the leave-confirm needs it: the browser has
   already moved by the time `hashchange` fires, and the old fix — replacing
   the new entry's URL with the test's — overwrote the page *before* the test
   with a second copy of the test. Back from a test, cancel, and the page you
   came from was gone from the stack. Knowing both positions, the cancel can
   undo exactly the move that happened: forward again after a back, back
   again after a link pushed a new entry. */
const IDX = 'actIdx';
let entryIndex = 0;

function stampedIndex(): number | null {
  const state: unknown = window.history.state;
  if (state && typeof state === 'object' && IDX in state) {
    const idx = (state as Record<string, unknown>)[IDX];
    if (typeof idx === 'number') return idx;
  }
  return null;
}

function stamp(idx: number, url?: string): void {
  const state: unknown = window.history.state;
  const base = state && typeof state === 'object' ? state : {};
  window.history.replaceState({ ...base, [IDX]: idx }, '', url);
}

if (typeof window !== 'undefined') {
  const idx = stampedIndex();
  if (idx === null) stamp(0);
  else entryIndex = idx;
  if (isUnknownPath(currentHash())) stamp(entryIndex, '#/home');
}

let lastHash = typeof window === 'undefined' ? '' : currentHash();

/** True while a screen has work in progress that leaving would lose. */
export const exitGuarded = (): boolean => exitGuard !== null;

export function navigate(route: Route, opts: { replace?: boolean } = {}): void {
  const href = hrefFor(route);
  const target = href.replace(/^#\/?/, '');
  if (target !== currentHash() && exitGuard) {
    if (!window.confirm(exitGuard)) return;
    confirmedLeave = true;
  }
  if (opts.replace) {
    stamp(entryIndex, href);
    confirmedLeave = false;
    lastHash = currentHash();
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

/* `lastHash`, not the address bar. Between a cancelled leave and the
   `history.go` that undoes it, the bar briefly shows the page that was
   refused; a render in that gap — a timed test re-renders every second —
   would otherwise mount that page and throw away the test it just kept. */
function getSnapshot(): Route {
  const hash = lastHash;
  if (hash !== cachedHash) {
    cachedHash = hash;
    cachedRoute = parseRoute(hash);
  }
  return cachedRoute;
}

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    let hash = currentHash();
    const asked = confirmedLeave;
    confirmedLeave = false;
    const landed = stampedIndex();
    if (!asked && exitGuard && hash !== lastHash && !window.confirm(exitGuard)) {
      /* Undo the move rather than overwrite where it landed (see `entryIndex`).
         An unstamped entry is one a link just pushed, so step back off it; a
         stamped one was reached by back or forward, so go the other way by
         the same distance. The screen never moved — `getSnapshot` reads
         `lastHash` — and the hashchange that the undo fires matches it. */
      if (landed === null) window.history.back();
      else if (landed !== entryIndex) window.history.go(entryIndex - landed);
      else stamp(entryIndex, '#/' + lastHash);
      return;
    }
    if (landed === null) {
      entryIndex += 1;
      stamp(entryIndex);
    } else {
      entryIndex = landed;
    }
    if (isUnknownPath(hash)) {
      stamp(entryIndex, '#/home');
      hash = currentHash();
    }
    lastHash = hash;
    listeners.forEach((l) => l());
  });
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
    exitGuard = message;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = message;
      return message;
    };
    window.addEventListener('beforeunload', handler);
    return () => {
      if (exitGuard === message) exitGuard = null;
      window.removeEventListener('beforeunload', handler);
    };
  }, [active, message]);
}
