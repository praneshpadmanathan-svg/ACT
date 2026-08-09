/* One place every failure goes.
 *
 * The review's finding was that eleven `console.warn`/`console.error` sites
 * are scattered through the app and every one of them is swallowed into a
 * browser console nobody is watching. A student hits a failed sync, a
 * precache miss or a crash, and the operator finds out only if they write in.
 *
 * The obvious fix is Sentry. Two things stop it being the fix *here*:
 *
 *  1. It needs an account and a DSN this repository does not have, so wiring
 *     it in would ship a no-op that looks like monitoring.
 *  2. The privacy policy promises no third-party anything, and this app's
 *     users are minors. Sending a stack trace with a URL and a user agent to
 *     a vendor is a policy change, not a code change — and the policy change
 *     has to land *first*. (It has: see the operational-telemetry paragraph
 *     added to `Legal.tsx`.)
 *
 * So this is a first-party reporter with the vendor left as a hole to fill:
 *
 *  - a bounded in-memory ring of the most recent events, always on;
 *  - the same ring mirrored to localStorage, so a crash that reloads the page
 *    does not take the evidence with it;
 *  - a **Diagnostics** panel in the profile screen that renders the ring and
 *    offers a one-tap copy, which turns "it broke" into a paste an operator
 *    can actually read;
 *  - an optional `VITE_REPORT_ENDPOINT`. Unset — which is the default and the
 *    current deployment — nothing ever leaves the device.
 *
 * Nothing here records what a student answered, what they scored, or who they
 * are. The payload is a category, a message, a timestamp and the route name.
 */

import { readJSON, writeJSON } from './storage';

export type ReportLevel = 'warn' | 'error';

export interface ReportEvent {
  at: number;
  level: ReportLevel;
  /** A stable, greppable slug: `sync.push`, `sw.precache`, `auth.bootstrap`. */
  scope: string;
  message: string;
  /** Route name at the time, which is usually the whole reproduction. */
  route: string;
}

const STORE_KEY = 'act-command:diagnostics:v1';

/* Small on purpose. This is the last N things that went wrong, not a log —
   the point is that an operator can read the whole thing, and that it cannot
   grow into the localStorage quota that `storage.ts` already has to defend. */
const RING_SIZE = 40;

let ring: ReportEvent[] = [];
let loaded = false;

type Listener = (events: ReportEvent[]) => void;
const listeners = new Set<Listener>();

function load(): void {
  if (loaded) return;
  loaded = true;
  const stored = readJSON<ReportEvent[] | null>(STORE_KEY, null);
  ring = Array.isArray(stored) ? stored.slice(-RING_SIZE) : [];
}

function currentRoute(): string {
  if (typeof window === 'undefined') return 'unknown';
  // The hash router's path, without any ids that might identify a person.
  return window.location.hash.replace(/^#\/?/, '').split('/')[0] || 'landing';
}

const endpoint = (import.meta.env.VITE_REPORT_ENDPOINT as string | undefined)?.trim();

/* Fire-and-forget, and deliberately unable to fail loudly.
 *
 * `keepalive` so a report raised during page teardown still goes out, and a
 * `catch` that does nothing at all: a reporter that throws while reporting an
 * error turns one problem into an infinite loop. */
function forward(event: ReportEvent): void {
  if (!endpoint) return;
  try {
    void fetch(endpoint, {
      method: 'POST',
      keepalive: true,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(event),
    }).catch(() => undefined);
  } catch {
    /* nothing useful to do — see above */
  }
}

/**
 * Record something that went wrong.
 *
 * Call this *instead of* a bare `console.warn` at any site whose failure an
 * operator would want to know about. It still logs to the console, so local
 * debugging is unchanged.
 */
export function report(level: ReportLevel, scope: string, message: unknown): void {
  load();

  const text =
    message instanceof Error
      ? `${message.name}: ${message.message}`
      : typeof message === 'string'
        ? message
        : (() => {
            try {
              return JSON.stringify(message);
            } catch {
              return String(message);
            }
          })();

  const event: ReportEvent = {
    at: Date.now(),
    level,
    scope,
    message: text.slice(0, 400),
    route: currentRoute(),
  };

  ring = [...ring, event].slice(-RING_SIZE);
  writeJSON(STORE_KEY, ring);
  forward(event);

  const line = `[${scope}] ${text}`;
  if (level === 'error') console.error(line);
  else console.warn(line);

  for (const listener of listeners) listener(ring);
}

export const reportWarn = (scope: string, message: unknown): void => report('warn', scope, message);
export const reportError = (scope: string, message: unknown): void =>
  report('error', scope, message);

export function diagnostics(): ReportEvent[] {
  load();
  return ring;
}

export function clearDiagnostics(): void {
  ring = [];
  loaded = true;
  writeJSON(STORE_KEY, ring);
  for (const listener of listeners) listener(ring);
}

export function onDiagnostics(listener: Listener): () => void {
  load();
  listeners.add(listener);
  listener(ring);
  return () => listeners.delete(listener);
}

/** Everything in the ring as pasteable text, for a support email. */
export function diagnosticsText(): string {
  load();
  if (!ring.length) return 'No problems recorded on this device.';
  const header = `ACT Command diagnostics — ${ring.length} event(s)\n${navigator.userAgent}\n`;
  const body = ring
    .map(
      (e) =>
        `${new Date(e.at).toISOString()}  ${e.level.toUpperCase()}  ${e.scope}  @${e.route}\n    ${e.message}`,
    )
    .join('\n');
  return `${header}\n${body}`;
}

/* --------------------------------------------------------------- global hooks */

let installed = false;

/**
 * Catch the two classes of failure no component can.
 *
 * A promise rejecting with nothing awaiting it is invisible everywhere except
 * `unhandledrejection` — no React error boundary sees it, because boundaries
 * only catch errors thrown during render. `store.tsx`'s auth bootstrap used to
 * be exactly this: an unguarded network call whose failure left the app stuck
 * on "Loading…" forever with nothing surfaced anywhere. That call is guarded
 * now; this stays as the backstop for whatever the next unguarded await turns
 * out to be.
 *
 * `error` catches the other half — a throw inside an event handler or a
 * `setTimeout` callback, which a boundary also cannot see.
 */
export function installErrorReporting(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('unhandledrejection', (event) => {
    reportError('unhandled.rejection', event.reason);
  });

  window.addEventListener('error', (event) => {
    // Resource load failures arrive here too and are not app errors.
    if (event.target && event.target !== window) return;
    reportError('unhandled.error', event.error ?? event.message);
  });
}
