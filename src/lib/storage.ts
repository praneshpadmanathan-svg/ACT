/* localStorage with the failure modes actually handled.

   Safari in private mode throws on setItem, and a corrupted value should not
   take the whole app down — the old build wrapped everything in bare
   try/catch and silently returned undefined, which made bugs invisible. */

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
  if (!available()) return memoryFallback.get(key) ?? null;
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
  } catch (err) {
    // Quota exceeded is the realistic case here. Fall back to memory so the
    // session keeps working rather than throwing mid-quiz.
    console.warn(`[storage] could not persist "${key}", keeping it in memory only`, err);
    memoryFallback.set(key, value);
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
  /** Progress written by the previous single-file build, migrated on boot. */
  legacyProgress: 'act-command:v1',
  legacyJourney: 'arcade:journey',
  legacyProfile: 'arcade:profile',
  legacyHero: 'arcade:hero',
} as const;
