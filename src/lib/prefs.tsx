/* How the app is rendered, as opposed to what it knows about you.
 *
 * Deliberately separate from `store.tsx`. Progress is per-identity, synced to
 * the cloud and merged across devices; a preference is per-*device* and must
 * never be. Someone who turns on high-legibility type on the school library
 * machine has not asked for it on their phone, and a preference travelling
 * through the sync merge would be one more field with an opinion about which
 * side wins. Two concerns, two stores, one localStorage key each.
 *
 * Every setting is applied as an attribute or a custom property on
 * `<html>`, which means:
 *   - CSS does the work, so nothing re-renders when a preference changes;
 *   - the state is visible in devtools;
 *   - `applyStoredPrefs()` can run from `main.tsx` before React mounts, so
 *     the first paint is already in the chosen theme rather than flashing
 *     dark and then correcting itself.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { readJSON, writeJSON } from './storage';

export const PREFS_KEY = 'act-command:prefs:v1';

export type ThemeChoice = 'dark' | 'light' | 'system';
/** Multiplier applied to every font size. See scripts/postcss-text-scale.mjs. */
export type TextScale = 0.9 | 1 | 1.15 | 1.3;
/** Multiplier applied to every timed-section clock. */
export type TimeAllowance = 1 | 1.5 | 2;

export interface Prefs {
  theme: ThemeChoice;
  textScale: TextScale;
  /** Swap Newsreader/Inter for Atkinson Hyperlegible everywhere. */
  legibleFont: boolean;
  /** Offer a read-aloud control on questions, passages and lessons. */
  readAloud: boolean;
  /** Suppress the large painted backgrounds and character cutouts. */
  reducedData: boolean;
  /** The extended-time accommodation the real ACT grants. */
  timeAllowance: TimeAllowance;
}

export const DEFAULT_PREFS: Prefs = {
  theme: 'dark',
  textScale: 1,
  legibleFont: false,
  readAloud: false,
  reducedData: false,
  timeAllowance: 1,
};

/* ------------------------------------------------------------------ reading */

const TEXT_SCALES: readonly TextScale[] = [0.9, 1, 1.15, 1.3];
const TIME_ALLOWANCES: readonly TimeAllowance[] = [1, 1.5, 2];

/** Coerce whatever is on disk into a valid Prefs. A stored value from a
 *  future build, a hand-edited key, or a half-written object must not be able
 *  to put the app into a state no setting can get it out of. */
export function normalisePrefs(raw: unknown): Prefs {
  const p = (raw ?? {}) as Partial<Prefs>;
  const oneOf = <T,>(value: unknown, allowed: readonly T[], fallback: T): T =>
    allowed.includes(value as T) ? (value as T) : fallback;

  return {
    theme: oneOf(p.theme, ['dark', 'light', 'system'] as const, DEFAULT_PREFS.theme),
    textScale: oneOf(p.textScale, TEXT_SCALES, DEFAULT_PREFS.textScale),
    legibleFont: p.legibleFont === true,
    readAloud: p.readAloud === true,
    reducedData: p.reducedData === true,
    timeAllowance: oneOf(p.timeAllowance, TIME_ALLOWANCES, DEFAULT_PREFS.timeAllowance),
  };
}

export function loadPrefs(): Prefs {
  return normalisePrefs(readJSON<unknown>(PREFS_KEY, null));
}

/* ------------------------------------------------------------------ applying */

/** `system` resolves against the OS at the moment it is asked. */
export function resolveTheme(choice: ThemeChoice): 'dark' | 'light' {
  if (choice !== 'system') return choice;
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/* The legibility font is a fifth family and the review's own item 38 says four
   was already too many — so it is never in the main bundle. This dynamic
   import makes Vite emit it as its own CSS chunk, fetched the first time
   somebody turns the setting on and cached from then on. `void` because a
   failed font fetch degrades to the default face, which is not an error worth
   surfacing to a student. */
let legibleFontRequested = false;
function ensureLegibleFont(): void {
  if (legibleFontRequested) return;
  legibleFontRequested = true;
  void import('@fontsource/atkinson-hyperlegible/latin-400.css');
  void import('@fontsource/atkinson-hyperlegible/latin-700.css');
}

/** Write the whole preference set onto `<html>`. Idempotent. */
export function applyPrefs(prefs: Prefs): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  root.dataset.theme = resolveTheme(prefs.theme);
  root.style.setProperty('--text-scale', String(prefs.textScale));
  root.dataset.font = prefs.legibleFont ? 'legible' : 'default';
  root.dataset.data = prefs.reducedData ? 'reduced' : 'full';

  if (prefs.legibleFont) ensureLegibleFont();

  /* The browser chrome — the address bar on Android, the status bar on an
     installed PWA — is coloured by this tag and would otherwise stay
     lantern-dark above a light page. */
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = resolveTheme(prefs.theme) === 'light' ? '#e3d7be' : '#14100b';
}

/**
 * Apply what is on disk, before React mounts.
 *
 * Called from `main.tsx` at module scope. Without it the first paint is the
 * default dark theme at the default type size, and the correction lands one
 * frame later as a visible flash — which is worst for exactly the person who
 * chose light mode because the dark one hurt to look at.
 */
export function applyStoredPrefs(): Prefs {
  const prefs = loadPrefs();
  applyPrefs(prefs);
  return prefs;
}

/* ------------------------------------------------------------------- context */

interface PrefsValue {
  prefs: Prefs;
  setPref: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void;
  resetPrefs: () => void;
  /** What `theme: 'system'` currently resolves to, for UI that has to say. */
  effectiveTheme: 'dark' | 'light';
}

const PrefsContext = createContext<PrefsValue | null>(null);

export function usePrefs(): PrefsValue {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error('usePrefs must be used inside <PrefsProvider>');
  return ctx;
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [effectiveTheme, setEffectiveTheme] = useState(() => resolveTheme(prefs.theme));

  useEffect(() => {
    applyPrefs(prefs);
    setEffectiveTheme(resolveTheme(prefs.theme));
    writeJSON(PREFS_KEY, prefs);
  }, [prefs]);

  /* Follow the OS while the choice is `system`. Someone with an automatic
     night shift schedule expects the app to turn over with everything else,
     and without this listener it would only change on a reload. */
  useEffect(() => {
    if (prefs.theme !== 'system' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-color-scheme: light)');
    const sync = () => {
      applyPrefs(prefs);
      setEffectiveTheme(resolveTheme('system'));
    };
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, [prefs]);

  const setPref = useCallback<PrefsValue['setPref']>((key, value) => {
    setPrefs((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
  }, []);

  const resetPrefs = useCallback(() => setPrefs(DEFAULT_PREFS), []);

  const value = useMemo<PrefsValue>(
    () => ({ prefs, setPref, resetPrefs, effectiveTheme }),
    [prefs, setPref, resetPrefs, effectiveTheme],
  );

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}
