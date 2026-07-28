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
import { sfx } from './sfx';
import {
  cloudEnabled,
  currentUser,
  displayNameOf,
  mergeProgress,
  pullProgress,
  pushProgress,
  signOut as cloudSignOut,
  supabase,
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

interface StoreValue {
  progress: Progress;
  rank: Rank;
  rankIndex: number;

  /** null while auth is still resolving, so screens can avoid flashing. */
  authReady: boolean;
  userId: string | null;
  playerName: string;
  isGuest: boolean;
  syncing: boolean;
  lastSyncError: string | null;

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

  continueAsGuest: () => void;
  refreshAuth: () => Promise<void>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
  resetEverything: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}

let nextId = 1;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<Progress>(() => loadProgress());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [xpPops, setXPPops] = useState<XPPop[]>([]);
  const [levelUpRank, setLevelUpRank] = useState<number | null>(null);

  const [authReady, setAuthReady] = useState(!cloudEnabled);
  const [userId, setUserId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState('Guest');
  const [isGuest, setIsGuest] = useState(() => readRaw(STORAGE_KEYS.guest) === '1');
  const [syncing, setSyncing] = useState(false);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);

  // Latest progress, readable from callbacks without re-subscribing.
  const progressRef = useRef(progress);
  progressRef.current = progress;

  /* ---------------------------------------------------------- persistence */

  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

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

  const syncWithCloud = useCallback(
    async (uid: string, name: string) => {
      setSyncing(true);
      setLastSyncError(null);
      try {
        const remote = await pullProgress(uid);
        const local = progressRef.current;
        const merged = remote ? mergeProgress(local, remote.data) : local;
        setProgress(merged);
        progressRef.current = merged;
        const ok = await pushProgress(uid, name, merged);
        if (!ok) setLastSyncError('Progress is saved on this device but could not reach the cloud.');
      } catch (err) {
        setLastSyncError(err instanceof Error ? err.message : 'Sync failed.');
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
    const user = await currentUser();
    if (user) {
      const name = displayNameOf(user);
      setUserId(user.id);
      setPlayerName(name);
      setIsGuest(false);
      removeRaw(STORAGE_KEYS.guest);
      await syncWithCloud(user.id, name);
    } else {
      setUserId(null);
      setPlayerName('Guest');
    }
    setAuthReady(true);
  }, [syncWithCloud]);

  useEffect(() => {
    void refreshAuth();
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

  const continueAsGuest = useCallback(() => {
    writeRaw(STORAGE_KEYS.guest, '1');
    setIsGuest(true);
  }, []);

  const signOutFn = useCallback(async () => {
    await cloudSignOut();
    setUserId(null);
    setPlayerName('Guest');
    setIsGuest(false);
    removeRaw(STORAGE_KEYS.guest);
  }, []);

  const syncNow = useCallback(async () => {
    if (userId) await syncWithCloud(userId, playerName);
  }, [userId, playerName, syncWithCloud]);

  const resetEverything = useCallback(() => {
    removeRaw(STORAGE_KEYS.progress);
    removeRaw(STORAGE_KEYS.guest);
    removeRaw(STORAGE_KEYS.legacyProgress);
    removeRaw(STORAGE_KEYS.legacyJourney);
    removeRaw(STORAGE_KEYS.legacyProfile);
    removeRaw(STORAGE_KEYS.seenIntro);
    window.location.hash = '#/';
    window.location.reload();
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      progress,
      rank: rankFor(progress.xp),
      rankIndex: rankIndexFor(progress.xp),
      authReady,
      userId,
      playerName: userId ? playerName : 'Guest',
      isGuest,
      syncing,
      lastSyncError,
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
      continueAsGuest,
      refreshAuth,
      signOut: signOutFn,
      syncNow,
      resetEverything,
    }),
    [
      progress, authReady, userId, playerName, isGuest, syncing, lastSyncError,
      toasts, xpPops, levelUpRank, dismissLevelUp, pushToast, dismissToast,
      answerQuestion, markNoteRead, clearZone, finishTest, updateProgress,
      continueAsGuest, refreshAuth, signOutFn, syncNow, resetEverything,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
