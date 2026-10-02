/* localStorage with the failure modes actually handled.

   Safari in private mode throws on setItem, and a corrupted value should not
   take the whole app down — the old build wrapped everything in bare
   try/catch and silently returned undefined, which made bugs invisible.

   The three `console.warn` sites below are the only ones left in the app that
   do *not* go through `lib/report.ts`, and that is deliberate rather than an
   oversight. The reporter persists its ring buffer by calling `writeJSON`,
   which is this file — so a quota-exceeded warning reported through it would
   write, fail, warn, report, write, and recurse until the stack gave out. The
   failure this module has to survive is precisely the one that would make
   reporting it impossible. The events are still visible in the console, and a
   storage failure announces itself loudly enough elsewhere: nothing saves. */

const memoryFallback = new Map<string, string>();
let storageWorks: boolean | null = null;

function available(): boolean {
  if (storageWorks !== null) return storageWorks;
  try {
    const probe = '__act_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    storageWorks = true;
  } catch {
    storageWorks = false;
  }
  return storageWorks;
}

export function readRaw(key: string): string | null {
  /* The in-memory copy wins whenever there is one. A write that hit the quota
     lands here while localStorage still holds the *previous* value, so reading
     localStorage first handed back the state from before the failed write —
     the session appeared to work and then quietly ran on stale progress. */
  const held = memoryFallback.get(key);
  if (held !== undefined) return held;
  if (!available()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeRaw(key: string, value: string): void {
  if (!available()) {
    memoryFallback.set(key, value);
    return;
  }
  try {
    window.localStorage.setItem(key, value);
    // Persisted after all; a stale memory copy would now shadow it.
    memoryFallback.delete(key);
  } catch (err) {
    // Quota exceeded is the realistic case here. Fall back to memory so the
    // session keeps working rather than throwing mid-quiz.
    console.warn(`[storage] could not persist "${key}", keeping it in memory only`, err);
    memoryFallback.set(key, value);
  }
}

/**
 * Delete data a retired build wrote and nothing reads any more.
 *
 * The paywall cached each signed-in user's entitlement under
 * `act-command:entitlement:v1:<account id>`. The paywall is gone, so that is
 * an account id sitting in a browser for no reason. Data kept "just in case"
 * is data that can leak, so it goes on the next load.
 */
export function sweepRetiredData(): void {
  if (!available()) return;
  try {
    const doomed: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(STORAGE_KEYS.entitlement)) doomed.push(key);
    }
    for (const key of doomed) window.localStorage.removeItem(key);
  } catch {
    /* A locked-down browser: nothing was stored, so nothing to sweep. */
  }
}

export function removeRaw(key: string): void {
  memoryFallback.delete(key);
  if (!available()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* nothing useful to do */
  }
}

/**
 * Delete everything this app saved on this device, except what must survive.
 *
 * The escape hatch on the crash screen: a saved record bad enough to crash
 * every render leaves no other way back in short of devtools. Supabase's own
 * session (`sb-…`) is not ours and is left alone, so a signed-in student stays
 * signed in and their cloud copy comes straight back down. The age gate's
 * refusal is kept as well — clearing it would make this button a way round
 * the gate.
 */
export function clearDeviceData(keep: readonly string[] = []): void {
  for (const key of [...memoryFallback.keys()]) if (!keep.includes(key)) memoryFallback.delete(key);
  if (!available()) return;
  try {
    const doomed: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || keep.includes(key)) continue;
      if (key.startsWith('act-command:') || key.startsWith('arcade:')) doomed.push(key);
    }
    for (const key of doomed) window.localStorage.removeItem(key);
  } catch {
    /* nothing useful to do */
  }
}

export function readJSON<T>(key: string, fallback: T): T {
  const raw = readRaw(key);
  if (raw === null) return fallback;
  try {
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    console.warn(`[storage] "${key}" held invalid JSON and was reset`);
    removeRaw(key);
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    writeRaw(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`[storage] could not serialise "${key}"`, err);
  }
}

export const STORAGE_KEYS = {
  progress: 'act-command:progress:v2',
  session: 'act-command:session',
  guest: 'act-command:guest',
  muted: 'act-command:muted',
  seenIntro: 'act-command:seen-intro',
  /** Unused since the paywall came out. Kept named so `sweepRetiredData` can find and delete
   *  what a returning visitor still has. The account id is
   *  appended — nothing
   *  read a cache written under a different sign-in. */
  entitlement: 'act-command:entitlement:v1',
  /** Progress written by the previous single-file build, migrated on boot. */
  legacyProgress: 'act-command:v1',
  legacyJourney: 'arcade:journey',
  legacyProfile: 'arcade:profile',
  legacyHero: 'arcade:hero',
} as const;
