/* The single source of truth for progress, identity and reward feedback.

   One store, one place that writes to localStorage, one place that talks to
   Supabase. The previous build had three layers polling localStorage on a
   1.2s interval and diffing it to guess what happened; this replaces all of
   that with explicit calls. */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Attempt, Progress, SectionId, TestResult } from '@/types';
import {
  awardXP as awardXPPure,
  checkAchievements,
  loadProgress,
  mergeProgress,
  rankFor,
  rankIndexFor,
  recordAttempt as recordAttemptPure,
  recordTest as recordTestPure,
  saveProgress,
  XP,
  type Achievement,
  type Rank,
} from './progress';
import { readRaw, removeRaw, STORAGE_KEYS, writeRaw } from './storage';
import { progressKeyFor, retireDeviceAccounts, type Identity } from './identity';
import { sfx } from './sfx';
import {
  cloudEnabled,
  consumeAuthRedirect,
  currentUser,
  deleteAccount as cloudDeleteAccount,
  deleteRemoteProgress,
  displayNameOf,
  pullProgress,
  pushProgress,
  signOut as cloudSignOut,
  supabase,
  type AuthRedirect,
} from './supabase';

/* ------------------------------------------------------------------ toasts */

export interface Toast {
  id: number;
  title: string;
  detail?: string;
  color?: string;
  icon?: string;
}

/* --------------------------------------------------------------- xp popups */

export interface XPPop {
  id: number;
  amount: number;
}

/** Set at sign-up so the guest world the player just built follows them into
 *  the new account. Lives in localStorage because email confirmation takes them
 *  out of the app and back in through a fresh page load. */
const CLAIM_GUEST_KEY = 'act-command:claim-guest';

interface StoreValue {
  progress: Progress;
  rank: Rank;
  rankIndex: number;

  /** null while auth is still resolving, so screens can avoid flashing. */
  authReady: boolean;
  userId: string | null;
  playerName: string;
  isGuest: boolean;
  /** Whether they have begun at all — the landing page is the door until they
   *  have. Distinct from `isGuest`, which is now true for everyone without an
   *  account, including a first-time visitor who has not clicked anything. */
  hasStarted: boolean;
  syncing: boolean;
  lastSyncError: string | null;
  /** Why we are back from an email link, for the screen that has to react. */
  authRedirect: AuthRedirect | null;
  clearAuthRedirect: () => void;

  toasts: Toast[];
  xpPops: XPPop[];
  levelUpRank: number | null;
  dismissLevelUp: () => void;
  pushToast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: number) => void;

  answerQuestion: (input: {
    qid: string;
    section: SectionId | 'zone';
    topic: string;
    correct: boolean;
    ms: number;
    xp: number;
  }) => void;
  markNoteRead: (pageId: string) => void;
  clearZone: (zoneId: string, percent: number) => void;
  finishTest: (result: TestResult) => void;
  updateProgress: (fn: (p: Progress) => Progress) => void;

  /** Who the loaded progress belongs to. */
  identity: Identity;
  /** Begin playing without an account. */
  continueAsGuest: () => void;
  /** Called at sign-up: carry this guest's world into the account being made. */
  claimGuestProgress: () => void;
  /** Called if that sign-up then fails, so the claim cannot outlive it. */
  releaseGuestClaim: () => void;
  refreshAuth: () => Promise<void>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
  resetEverything: () => Promise<void>;
  deleteAccount: () => Promise<{ ok: boolean; error?: string }>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}

let nextId = 1;

/* Retire the old on-device credential store before anything reads progress.
   Module scope so it happens exactly once per load, not once per mount. */
const retired = typeof window === 'undefined' ? null : retireDeviceAccounts();

export function StoreProvider({ children }: { children: ReactNode }) {
  /* Progress is stored per identity so two people sharing a browser cannot
     overwrite each other, and signing out of an account does not expose it.
     Boot always starts as a guest: a cloud session is confirmed asynchronously
     by refreshAuth, and guessing before then would flash the wrong world. */
  const [identity, setIdentity] = useState<Identity>({ kind: 'guest' });
  const [progress, setProgress] = useState<Progress>(() =>
    loadProgress(progressKeyFor({ kind: 'guest' })),
  );
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [xpPops, setXPPops] = useState<XPPop[]>([]);
  const [levelUpRank, setLevelUpRank] = useState<number | null>(null);

  const [authReady, setAuthReady] = useState(!cloudEnabled);
  const [userId, setUserId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState('Traveller');
  const [syncing, setSyncing] = useState(false);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const [authRedirect, setAuthRedirect] = useState<AuthRedirect | null>(null);
  const [hasStarted, setHasStarted] = useState(() => readRaw(STORAGE_KEYS.guest) === '1');

  const isGuest = identity.kind === 'guest';

  // Latest progress, readable from callbacks without re-subscribing.
  const progressRef = useRef(progress);
  progressRef.current = progress;

  /* ---------------------------------------------------------- persistence */

  const storageKey = useMemo(() => progressKeyFor(identity), [identity]);

  useEffect(() => {
    saveProgress(progress, storageKey);
  }, [progress, storageKey]);

  /* --------------------------------------------------------------- toasts */

  const pushToast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { ...t, id }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4200);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const popXP = useCallback((amount: number) => {
    if (amount <= 0) return;
    const id = nextId++;
    setXPPops((prev) => [...prev, { id, amount }]);
    window.setTimeout(() => setXPPops((prev) => prev.filter((x) => x.id !== id)), 1250);
  }, []);

  /* Tell anyone whose device account was retired where their world went, once. */
  useEffect(() => {
    if (!retired) return;
    pushToast({
      title: 'Welcome back',
      detail: `Accounts moved to the cloud — ${retired.migratedName}'s progress is here.`,
      color: '#ffd23e',
      icon: 'star',
    });
  }, [pushToast]);

  /* ------------------------------------------------------ reward pipeline */

  /** Applies a progress change and fires whatever feedback it earned. */
  const applyResult = useCallback(
    (result: { progress: Progress; xpGained: number; rankedUp: boolean; newRankIndex: number }) => {
      const unlocked: Achievement[] = checkAchievements(result.progress);
      const next: Progress = unlocked.length
        ? { ...result.progress, achievements: [...result.progress.achievements, ...unlocked.map((a) => a.id)] }
        : result.progress;

      setProgress(next);
      popXP(result.xpGained);

      if (result.rankedUp) {
        setLevelUpRank(result.newRankIndex);
        sfx.fanfare();
      }

      unlocked.forEach((a, i) => {
        window.setTimeout(() => {
          pushToast({ title: a.name, detail: a.detail, color: '#ffd23e', icon: a.icon });
          sfx.achieve();
        }, result.rankedUp ? 1400 + i * 400 : i * 400);
      });
    },
    [popXP, pushToast],
  );

  const answerQuestion = useCallback<StoreValue['answerQuestion']>(
    ({ qid, section, topic, correct, ms, xp }) => {
      const attempt: Omit<Attempt, 'at'> = { qid, section, topic, correct, ms };
      applyResult(recordAttemptPure(progressRef.current, attempt, xp));
    },
    [applyResult],
  );

  const markNoteRead = useCallback(
    (pageId: string) => {
      const p = progressRef.current;
      if (p.notesRead.includes(pageId)) return;
      const withNote = { ...p, notesRead: [...p.notesRead, pageId] };
      applyResult(awardXPPure(withNote, XP.notePage));
      pushToast({ title: 'Page complete', detail: `+${XP.notePage} XP`, color: '#3ad6f0', icon: 'book' });
    },
    [applyResult, pushToast],
  );

  const clearZone = useCallback(
    (zoneId: string, percent: number) => {
      const p = progressRef.current;
      const previous = p.zonesCleared[zoneId] ?? -1;
      const improved = percent > previous;
      const withZone: Progress = improved
        ? { ...p, zonesCleared: { ...p.zonesCleared, [zoneId]: percent } }
        : p;

      // Clearing pays once; beating your own best pays a smaller bonus.
      const gain = previous < 0 ? XP.zoneCleared + (percent === 100 ? XP.zonePerfect : 0) : improved ? 40 : 0;
      applyResult(awardXPPure(withZone, gain));
    },
    [applyResult],
  );

  const finishTest = useCallback(
    (result: TestResult) => {
      applyResult(recordTestPure(progressRef.current, result));
    },
    [applyResult],
  );

  const updateProgress = useCallback((fn: (p: Progress) => Progress) => {
    setProgress((prev) => fn(prev));
  }, []);

  const dismissLevelUp = useCallback(() => setLevelUpRank(null), []);

  /* ----------------------------------------------------------------- auth */

  /**
   * Reconcile this device against the cloud.
   *
   * `claimGuest` folds in the world built before signing up, and is honoured
   * **only when the account provably has no saved row**. Anything else — an
   * existing account, or a pull that simply failed — and the guest history
   * stays where it is. The difference matters: someone who played on a shared
   * laptop and then signed in must not absorb the previous person's work, and
   * a dropped connection must never be mistaken for a new account.
   */
  const syncWithCloud = useCallback(
    async (uid: string, name: string, base: Progress, claimGuest = false) => {
      setSyncing(true);
      setLastSyncError(null);
      try {
        const remote = await pullProgress(uid);

        if (remote.status === 'error') {
          /* Do not push. Local might be an empty profile on a fresh device and
             the row we could not read might be a year of work — writing over it
             is the one unrecoverable mistake available here. Try again later. */
          setLastSyncError('Could not reach the cloud. Your progress is safe on this device.');
          return;
        }

        let merged = base;
        if (remote.status === 'ok') {
          merged = mergeProgress(base, remote.data);
        } else if (claimGuest) {
          merged = mergeProgress(loadProgress(progressKeyFor({ kind: 'guest' })), base);
        }

        setProgress(merged);
        progressRef.current = merged;
        const ok = await pushProgress(uid, name, merged);
        if (!ok) setLastSyncError('Progress is saved on this device but could not reach the cloud.');
      } catch (err) {
        console.warn('[sync] failed', err);
        setLastSyncError('Could not reach the cloud. Your progress is safe on this device.');
      } finally {
        setSyncing(false);
      }
    },
    [],
  );

  const refreshAuth = useCallback(async () => {
    if (!cloudEnabled) {
      setAuthReady(true);
      return;
    }
    /* `currentUser()` throws on a raw network failure (DNS, CORS, an offline
       first load) rather than returning the Supabase `{error}` shape the rest
       of this file is written to expect — every other call in this module
       goes through the tri-state ok/empty/error results in supabase.ts, but
       this one call to auth.getUser() does not. Uncaught here, that throw
       used to leave the app on "Loading…" forever: the function returns
       without reaching `setAuthReady(true)` below, and nothing render-side
       can recover from a promise that never settles. Fall back to a signed-out
       guest rather than hang — a login attempt right afterward will surface
       the same network error somewhere the person can actually see it. */
    let user: Awaited<ReturnType<typeof currentUser>> = null;
    try {
      user = await currentUser();
    } catch (err) {
      console.warn('[auth] could not resolve session', err);
    }
    if (user) {
      const next: Identity = { kind: 'cloud', userId: user.id };
      const name = displayNameOf(user);

      /* Start from *this account's* own saved progress, not from whatever
         happens to be loaded. Reading progressRef here would fold a guest
         session into whichever account signed in next — so someone who played
         on a friend's laptop and then signed in would absorb the friend's work.

         The one time that folding is wanted is the account's first moments,
         when the player has just built a world as a guest and is claiming it.
         That is opt-in, set at sign-up, and survives the round trip through the
         confirmation email because it is written to disk. The claim is handed
         to the sync rather than applied here, because only the sync can see
         whether this account already has a row — and if it does, the claim is
         wrong and gets dropped. */
      const base = loadProgress(progressKeyFor(next));
      const claimGuest = readRaw(CLAIM_GUEST_KEY) === '1';
      removeRaw(CLAIM_GUEST_KEY);

      setUserId(user.id);
      setPlayerName(name);
      setIdentity(next);
      setProgress(base);
      progressRef.current = base;
      writeRaw(STORAGE_KEYS.guest, '1');
      setHasStarted(true);

      await syncWithCloud(user.id, name, base, claimGuest);
    } else {
      setUserId(null);
      setPlayerName('Traveller');
      setIdentity({ kind: 'guest' });
    }
    setAuthReady(true);
  }, [syncWithCloud]);

  useEffect(() => {
    /* Settle any link clicked in an email before asking who is signed in — the
       exchange is what creates the session a password reset then depends on.
       `consumeAuthRedirect` can throw the same way `currentUser` could (see
       the comment in `refreshAuth`) — a broken or already-used confirmation
       link is a plausible way to hit a raw network/provider error here, not
       just the well-typed one the function is written to return. Guarded for
       the same reason: `refreshAuth()` below is what resolves `authReady`,
       and it must still run even if the redirect never settles. */
    void (async () => {
      let redirect: Awaited<ReturnType<typeof consumeAuthRedirect>> = null;
      try {
        redirect = await consumeAuthRedirect();
      } catch (err) {
        console.warn('[auth] could not settle the redirect', err);
      }
      if (redirect) setAuthRedirect(redirect);
      await refreshAuth();
    })();

    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        void refreshAuth();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [refreshAuth]);

  /* Push on a debounce while signed in, so a session's work survives a
     closed tab without hammering the API on every answer. */
  const pushTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!userId || !cloudEnabled) return;
    if (pushTimer.current) window.clearTimeout(pushTimer.current);
    pushTimer.current = window.setTimeout(() => {
      void pushProgress(userId, playerName, progressRef.current);
    }, 4000);
    return () => {
      if (pushTimer.current) window.clearTimeout(pushTimer.current);
    };
  }, [progress, userId, playerName]);

  // Last-chance flush when the tab goes away.
  useEffect(() => {
    if (!userId) return;
    const flush = () => {
      if (document.visibilityState === 'hidden') {
        void pushProgress(userId, playerName, progressRef.current);
      }
    };
    document.addEventListener('visibilitychange', flush);
    return () => document.removeEventListener('visibilitychange', flush);
  }, [userId, playerName]);

  const switchIdentity = useCallback((next: Identity) => {
    const loaded = loadProgress(progressKeyFor(next));
    setIdentity(next);
    setProgress(loaded);
    progressRef.current = loaded;
  }, []);

  const continueAsGuest = useCallback(() => {
    writeRaw(STORAGE_KEYS.guest, '1');
    setHasStarted(true);
    setPlayerName('Traveller');
    switchIdentity({ kind: 'guest' });
  }, [switchIdentity]);

  const claimGuestProgress = useCallback(() => {
    writeRaw(CLAIM_GUEST_KEY, '1');
  }, []);

  const releaseGuestClaim = useCallback(() => {
    removeRaw(CLAIM_GUEST_KEY);
  }, []);

  const clearAuthRedirect = useCallback(() => setAuthRedirect(null), []);

  const signOutFn = useCallback(async () => {
    await cloudSignOut();
    setUserId(null);
    setPlayerName('Traveller');
    switchIdentity({ kind: 'guest' });
  }, [switchIdentity]);

  const syncNow = useCallback(async () => {
    if (userId) await syncWithCloud(userId, playerName, progressRef.current);
  }, [userId, playerName, syncWithCloud]);

  /* Wipe progress without touching the account.

     The remote row has to go first. This used to clear localStorage and
     reload — whereupon refreshAuth pulled the cloud copy straight back down and
     merged it into the empty local one, so everything the player had just asked
     to delete reappeared. Deleting locally only is not deleting. */
  const resetEverything = useCallback(async () => {
    if (userId) await deleteRemoteProgress(userId);
    removeRaw(storageKey);
    removeRaw(STORAGE_KEYS.progress);
    removeRaw(STORAGE_KEYS.guest);
    removeRaw(STORAGE_KEYS.legacyProgress);
    removeRaw(STORAGE_KEYS.legacyJourney);
    removeRaw(STORAGE_KEYS.legacyProfile);
    removeRaw(STORAGE_KEYS.seenIntro);
    window.location.hash = '#/';
    window.location.reload();
  }, [storageKey, userId]);

  /** Delete the account itself, and every trace of it on this device. */
  const deleteAccountFn = useCallback(async () => {
    const result = await cloudDeleteAccount();
    if (!result.ok) return result;
    removeRaw(storageKey);
    removeRaw(STORAGE_KEYS.guest);
    removeRaw(CLAIM_GUEST_KEY);
    window.location.hash = '#/';
    window.location.reload();
    return { ok: true };
  }, [storageKey]);

  const value = useMemo<StoreValue>(
    () => ({
      progress,
      rank: rankFor(progress.xp),
      rankIndex: rankIndexFor(progress.xp),
      authReady,
      userId,
      playerName,
      isGuest,
      hasStarted,
      syncing,
      lastSyncError,
      authRedirect,
      clearAuthRedirect,
      toasts,
      xpPops,
      levelUpRank,
      dismissLevelUp,
      pushToast,
      dismissToast,
      answerQuestion,
      markNoteRead,
      clearZone,
      finishTest,
      updateProgress,
      identity,
      continueAsGuest,
      claimGuestProgress,
      releaseGuestClaim,
      refreshAuth,
      signOut: signOutFn,
      syncNow,
      resetEverything,
      deleteAccount: deleteAccountFn,
    }),
    [
      progress, authReady, userId, playerName, isGuest, hasStarted, syncing, lastSyncError,
      authRedirect, clearAuthRedirect, toasts, xpPops, levelUpRank, dismissLevelUp,
      pushToast, dismissToast, answerQuestion, markNoteRead, clearZone, finishTest,
      updateProgress, identity, continueAsGuest, claimGuestProgress, releaseGuestClaim, refreshAuth,
      signOutFn, syncNow, resetEverything, deleteAccountFn,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
