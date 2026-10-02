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
import type { Attempt, DiagnosticResult, Progress, SectionId, TestResult } from '@/types';
import type { User } from '@supabase/supabase-js';
import {
  awardXP as awardXPPure,
  checkAchievements,
  completeDaily as completeDailyPure,
  dailyClaimed,
  dayKey,
  emptyProgress,
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
  type RecordResult,
} from './progress';
import { readRaw, removeRaw, STORAGE_KEYS, sweepRetiredData, writeRaw } from './storage';
import { reportWarn } from './report';
import { progressKeyFor, retireDeviceAccounts, type Identity } from './identity';
import { TEST_SESSION_KEY } from './testSession';
import { sfx } from './sfx';
import type { IconName } from '@/components/Icon';
import {
  cloudEnabled,
  consumeAuthRedirect,
  deleteAccount as cloudDeleteAccount,
  deleteRemoteProgress,
  displayNameOf,
  dropLocalSession,
  pullProgress,
  pushProgress,
  sessionUser,
  signOut as cloudSignOut,
  storedSessionUser,
  supabase,
  verifySession,
  type AuthRedirect,
  type PushResult,
} from './supabase';

/* What a write attempt came to. `deferred` is neither success nor failure: the
   write was correctly refused twice and the next debounce tick will carry it,
   so the student is told nothing and no error state is set. `too-large` is the
   database refusing the row itself, which no retry will change. */
type SyncOutcome = 'ok' | 'deferred' | 'error' | 'too-large';

const GUEST_KEY = progressKeyFor({ kind: 'guest' });

const PUSH_FAILED = 'Progress is saved on this device but could not reach the cloud.';
const PULL_FAILED = 'Could not reach the cloud. Your progress is safe on this device.';
const TOO_LARGE =
  'Your progress is saved on this device, but it has grown too large to back up to your account. Please let us know through Send feedback.';

/** How long signing out waits for the last push before going anyway. */
const SIGN_OUT_FLUSH_MS = 5_000;

/* ------------------------------------------------------------------ toasts */

export interface Toast {
  id: number;
  title: string;
  detail?: string;
  color?: string;
  icon?: IconName;
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
    /* Narrower than what `Attempt` stores, deliberately: old saves hold the
       legacy `'zone'` and the loader has to be able to read it, but nothing
       may write it again. */
    section: SectionId;
    topic: string;
    correct: boolean;
    ms: number;
    xp: number;
  }) => void;
  markNoteRead: (pageId: string) => void;
  clearZone: (zoneId: string, percent: number) => void;
  finishTest: (result: TestResult) => void;
  /** Mark today's daily challenge done and pay for it. Idempotent per day. */
  /** `day` is the day the challenge was opened on, so one begun before midnight is not stamped with the next day. */
  finishDaily: (day?: string) => void;
  /** Save a completed placement test, replacing any earlier one. */
  finishDiagnostic: (result: DiagnosticResult) => void;
  /** First win against a guardian: the achievement and its bounty, once. */
  defeatBoss: (bossId: string) => void;
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
  resetEverything: () => Promise<{ ok: boolean; error?: string }>;
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
if (typeof window !== 'undefined') sweepRetiredData();

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

  /* The `updated_at` this device last saw on its own row, and the basis of
     every write: `pushProgress` refuses to overwrite anything newer. Null means
     "no row" — either never synced, or just deleted — which the database treats
     as a distinct expectation rather than as "don't care". Reset on identity
     change, because one account's timestamp says nothing about another's. */
  const remoteUpdatedAtRef = useRef<string | null>(null);

  /* Who the cloud work in flight belongs to. A pull that set off for one
     account can land after a sign-out or a switch to another; merging it then
     would pour that account's history into whoever is here now. Every await
     that returns remote data checks this before touching state. */
  const activeUidRef = useRef<string | null>(null);

  /** Set while a reset is deleting the cloud row, so nothing writes it back. */
  const resettingRef = useRef(false);

  /* The account whose first sync has read the cloud row. Until it has, no
     debounced push may run: this device does not yet know whether there is a
     row, so a push could only guess — and the guess it made was "no row",
     which inserted the empty world it had just loaded. That beat the sync's
     own write, the account now had a row, and the guest world the student had
     asked to bring with them was refused as belonging to an existing account. */
  const syncedUidRef = useRef<string | null>(null);
  const syncInFlightRef = useRef(false);

  /* The guest world has been merged into the signed-in account's progress
     but no push has confirmed it yet. While this is set the guest key still
     holds the same work, so anything that ends the session has to clear it
     rather than leave it for the next person at this browser. */
  const claimMergedRef = useRef(false);

  /** Said once a session; it will not change until somebody fixes it. */
  const toldTooLargeRef = useRef(false);

  /* ---------------------------------------------------------- persistence */

  const storageKey = useMemo(() => progressKeyFor(identity), [identity]);

  useEffect(() => {
    saveProgress(progress, storageKey);
  }, [progress, storageKey]);

  /* Two tabs of the same world each hold a copy in memory and write the whole
     thing on every change, so without this the last tab to answer a question
     silently erased everything the other one had done. Follow the other tab's
     write instead; the next change here then builds on it. */
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      /* A removed key (or `localStorage.clear()`, which reports a null key)
         is followed too, and reads back as an empty world. Ignoring removals
         is how a reset in one tab was undone by the next answer in another:
         the other tab still held the whole history and wrote it straight back.
         Every remover of a progress key means it — a reset, an account
         deletion, a claimed guest world moving into an account. */
      if (e.key !== storageKey && e.key !== null) return;
      const next = loadProgress(storageKey);
      progressRef.current = next;
      setProgress(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [storageKey]);

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
      color: 'oklch(var(--c-gold))',
      icon: 'star',
    });
  }, [pushToast]);

  /* ------------------------------------------------------ reward pipeline */

  /** Applies a progress change and fires whatever feedback it earned. */
  const applyResult = useCallback(
    (result: RecordResult) => {
      const unlocked: Achievement[] = checkAchievements(result.progress);
      const next: Progress = unlocked.length
        ? {
            ...result.progress,
            achievements: [...result.progress.achievements, ...unlocked.map((a) => a.id)],
          }
        : result.progress;

      setProgress(next);
      popXP(result.xpGained);

      if (result.rankedUp) {
        setLevelUpRank(result.newRankIndex);
        sfx.fanfare();
      }

      /* A streak shield is only worth having if the student finds out it was
         spent — silently absorbing a missed day looks identical to the app
         having failed to notice, and next time they will assume the streak is
         safe when it is not. Said plainly, and said before the achievement
         toasts, because it is about the day they missed rather than today. */
      if (result.shieldsSpent) {
        const n = result.shieldsSpent;
        pushToast({
          title: n === 1 ? 'Streak freeze used' : `${n} streak freezes used`,
          detail: `${n === 1 ? 'A missed day' : `${n} missed days`} covered — your ${result.progress.dayStreak}-day streak is intact.`,
          color: 'oklch(var(--c-cliffs-text))',
          icon: 'shield',
        });
      }

      unlocked.forEach((a, i) => {
        window.setTimeout(
          () => {
            pushToast({
              title: a.name,
              detail: a.detail,
              color: 'oklch(var(--c-gold))',
              icon: a.icon,
            });
            sfx.achieve();
          },
          result.rankedUp ? 1400 + i * 400 : i * 400,
        );
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
      pushToast({
        title: 'Page complete',
        detail: `+${XP.notePage} XP`,
        color: 'oklch(var(--c-cliffs-text))',
        icon: 'book',
      });
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
      const gain =
        previous < 0 ? XP.zoneCleared + (percent === 100 ? XP.zonePerfect : 0) : improved ? 40 : 0;
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

  /* The five answers have already been recorded one at a time through
     `answerQuestion`, exactly as a drill would; this only pays the bonus and
     stamps the day. `completeDailyPure` is a no-op on a day already claimed,
     so a double-submit or a re-mounted summary cannot pay twice. */
  const finishDaily = useCallback(
    (day?: string) => {
      const p = progressRef.current;
      if (dailyClaimed(p, day ?? dayKey())) return;
      applyResult(completeDailyPure(p, day));
      pushToast({
        title: 'Daily challenge done',
        detail: `+${XP.dailyChallenge} XP — back tomorrow`,
        color: 'oklch(var(--c-gold))',
        icon: 'flame',
      });
    },
    [applyResult, pushToast],
  );

  /* The individual answers have already been recorded through
     `answerQuestion`; this stores the placement they add up to. No XP of its
     own — the questions paid for themselves, and putting a bounty on the
     diagnostic would give a student a reason to retake it for the money. */
  const finishDiagnostic = useCallback((result: DiagnosticResult) => {
    setProgress((prev) => ({ ...prev, diagnostic: result }));
  }, []);

  /* Through the reward pipeline like every other payout. The duel screen used
     to add its 400 straight onto `xp` via updateProgress, so the rank-up it
     frequently causes never played, no XP pop appeared, and achievements keyed
     on the new total waited for some later answer to notice them. */
  const defeatBoss = useCallback(
    (bossId: string) => {
      const p = progressRef.current;
      const id = `boss-${bossId}`;
      if (p.achievements.includes(id)) return;
      applyResult(awardXPPure({ ...p, achievements: [...p.achievements, id] }, XP.bossDefeated));
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
  /**
   * Write the current progress, and deal with losing the race.
   *
   * A `conflict` means another device wrote between our last look and this
   * write, so this one was refused rather than allowed to clobber it. The
   * answer is the same thing the sign-in path does — pull, merge, write again —
   * which is why the merge is a pure function on two progresses rather than
   * something only the auth flow knows how to do.
   *
   * Exactly one retry. If the second write also conflicts, two devices are
   * writing faster than they can reconcile, and looping would be a spin: the
   * work is already safe on this device and the next debounce tick will carry
   * it up with a fresher timestamp.
   */
  /** The claim is done: the guest world lives in the account now, so the copy
   *  under the guest key goes. Left there, the next person to press "play as
   *  guest" at this browser opened someone else's world — and signing up
   *  absorbed it into *their* account. */
  const finishClaim = useCallback(() => {
    claimMergedRef.current = false;
    removeRaw(CLAIM_GUEST_KEY);
    removeRaw(GUEST_KEY);
  }, []);

  const pushSynced = useCallback(
    async (uid: string, name: string, keepalive = false): Promise<SyncOutcome> => {
      if (resettingRef.current) return 'deferred';
      const attempt = async (): Promise<PushResult> =>
        pushProgress(name, progressRef.current, remoteUpdatedAtRef.current, { keepalive });

      let result = await attempt();

      if (result.status === 'conflict') {
        const remote = await pullProgress(uid);
        if (activeUidRef.current !== uid) return 'deferred';
        if (remote.status === 'error') return 'error';

        if (remote.status === 'ok') {
          const merged = mergeProgress(progressRef.current, remote.data);
          progressRef.current = merged;
          setProgress(merged);
          remoteUpdatedAtRef.current = remote.updatedAt;
        } else {
          /* The row went away between the refusal and the re-read — a delete on
             another device, or an account reset. Expect nothing and insert. */
          remoteUpdatedAtRef.current = null;
        }
        result = await attempt();
      }

      if (result.status === 'ok') {
        remoteUpdatedAtRef.current = result.updatedAt;
        if (claimMergedRef.current && activeUidRef.current === uid) finishClaim();
        return 'ok';
      }
      /* A second conflict is not an error to show anyone — nothing was lost and
         nothing is wrong. It is reported so an operator can see if it is
         happening constantly, which would mean the debounce is too slow. */
      if (result.status === 'conflict') {
        reportWarn('sync.push', 'conflicted twice; deferring to the next push');
        return 'deferred';
      }
      return result.status === 'too-large' ? 'too-large' : 'error';
    },
    [finishClaim],
  );

  /* Say what a push came to, through the one sync status the UI already shows
     (Settings reads `lastSyncError`). The debounced push used to drop its
     result on the floor, so a row the database refused failed every four
     seconds for the rest of the account's life and nobody was ever told. */
  const reportPush = useCallback(
    (outcome: SyncOutcome) => {
      if (outcome === 'ok') setLastSyncError(null);
      else if (outcome === 'error') setLastSyncError(PUSH_FAILED);
      else if (outcome === 'too-large') {
        setLastSyncError(TOO_LARGE);
        if (!toldTooLargeRef.current) {
          toldTooLargeRef.current = true;
          pushToast({
            title: 'Cloud backup paused',
            detail: 'Your progress is safe on this device. See Settings for details.',
            color: 'oklch(var(--c-blood-text))',
            icon: 'shield',
          });
        }
      }
    },
    [pushToast],
  );

  const syncWithCloud = useCallback(
    async (uid: string, name: string, claimGuest = false) => {
      syncInFlightRef.current = true;
      setSyncing(true);
      setLastSyncError(null);
      try {
        const remote = await pullProgress(uid);
        if (activeUidRef.current !== uid) return;

        if (remote.status === 'error') {
          /* Do not push. Local might be an empty profile on a fresh device and
             the row we could not read might be a year of work — writing over it
             is the one unrecoverable mistake available here. Try again later.

             The claim flag stays where it is, too. It used to be spent before
             this pull, so a dropped connection at the one moment it mattered
             cost the student the world they had built before signing up. */
          setLastSyncError(PULL_FAILED);
          return;
        }

        /* Merge into what is loaded *now*, not a snapshot taken when the sync
           started: the app opens before the pull, so anything answered while
           it was in flight exists only in the live copy. */
        let merged = progressRef.current;
        if (remote.status === 'ok') {
          merged = mergeProgress(merged, remote.data);
          remoteUpdatedAtRef.current = remote.updatedAt;
          /* The account already has a row, so this is not a new account and a
             pending claim does not apply. That is an answer, so it is spent. */
          if (claimGuest) removeRaw(CLAIM_GUEST_KEY);
        } else {
          // `empty` is a fact, not a failure: this account has no row yet.
          remoteUpdatedAtRef.current = null;
          if (claimGuest) {
            /* Reset epochs are a fact about one identity's history and do not
               travel with a claim: a guest world reset last week is still the
               world being brought along, and must not erase the account's. */
            const { resetAt, ...account } = merged;
            const { resetAt: _guestEpoch, ...guest } = loadProgress(GUEST_KEY);
            merged = { ...mergeProgress(guest, account), ...(resetAt ? { resetAt } : {}) };
            claimMergedRef.current = true;
          }
        }

        setProgress(merged);
        progressRef.current = merged;
        syncedUidRef.current = uid;
        reportPush(await pushSynced(uid, name));
      } catch (err) {
        reportWarn('sync.cycle', err);
        setLastSyncError(PULL_FAILED);
      } finally {
        syncInFlightRef.current = false;
        setSyncing(false);
      }
    },
    [pushSynced, reportPush],
  );

  /* Load the guest world along with the guest identity. Switching only the
     identity left the account's progress in state, and the save effect then
     wrote it under the guest key — so signing out handed the account's whole
     history to whoever used the browser next. */
  const becomeGuest = useCallback(() => {
    const guest = loadProgress(GUEST_KEY);
    activeUidRef.current = null;
    remoteUpdatedAtRef.current = null;
    syncedUidRef.current = null;
    claimMergedRef.current = false;
    setUserId(null);
    setPlayerName('Traveller');
    setIdentity({ kind: 'guest' });
    setProgress(guest);
    progressRef.current = guest;
    setAuthReady(true);
  }, []);

  /* Check the session with the server, behind the app, once per sign-in.
     Only an answer from the auth server that the session is over signs this
     device out; silence, a timeout, a 5xx or a 429 change nothing. */
  const checkSession = useCallback(
    async (uid: string) => {
      const check = await verifySession();
      if (activeUidRef.current !== uid) return;
      if (check.status === 'valid') {
        setPlayerName(displayNameOf(check.user));
        return;
      }
      if (check.status !== 'invalid') return;
      reportWarn('auth.verify', 'the server ended this session; signing out on this device');
      await dropLocalSession();
      /* The account's progress stays on disk under its own key — nothing
         unsynced is lost, and signing back in picks it up. */
      if (activeUidRef.current === uid) becomeGuest();
    },
    [becomeGuest],
  );

  /** Load an account's world and sync it behind the app. */
  const adoptAccount = useCallback(
    (user: User) => {
      const next: Identity = { kind: 'cloud', userId: user.id };
      const name = displayNameOf(user);

      /* Already loaded — a second caller for the same sign-in. Sign-up awaits
         this while the SIGNED_IN listener fires it too; the later one used to
         reload progress from disk over the guest world the first had just
         claimed and merged. Only the name can have changed (USER_UPDATED). */
      if (activeUidRef.current === user.id) {
        setPlayerName(name);
        setAuthReady(true);
        return;
      }

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
         wrong and gets dropped. The flag is cleared by the sync once it has an
         answer, not here: a pull that fails must leave it for the next try. */
      const base = loadProgress(progressKeyFor(next));
      const claimGuest = readRaw(CLAIM_GUEST_KEY) === '1';

      activeUidRef.current = user.id;
      remoteUpdatedAtRef.current = null;
      syncedUidRef.current = null;
      claimMergedRef.current = false;
      setUserId(user.id);
      setPlayerName(name);
      setIdentity(next);
      setProgress(base);
      progressRef.current = base;
      writeRaw(STORAGE_KEYS.guest, '1');
      setHasStarted(true);

      /* Let the app in *now*, and sync behind it.

         `authReady` used to be set after the sync, which quietly redefined it
         from "we know who you are" — all of which is already decided above,
         from disk — into "the cloud has finished talking to us". So a signed-in
         student on a slow train, or against a Supabase project that had gone to
         sleep, sat on the boot screen watching a compass spin for as long as
         the network felt like taking, with no way past and nothing to read.
         Their whole world was on the device the entire time.

         Nothing downstream needs the sync to have landed: `progress` is already
         this account's saved progress, the merge writes state again when it
         returns, and the two things the sync can report — `syncing` and
         `lastSyncError` — are both surfaced in the UI where a person can see
         them. Not awaited, so a hung request costs a stale number on a badge
         instead of the entire app. */
      setAuthReady(true);
      void syncWithCloud(user.id, name, claimGuest);
      void checkSession(user.id);
    },
    [syncWithCloud, checkSession],
  );

  const refreshAuth = useCallback(async () => {
    if (!cloudEnabled) {
      setAuthReady(true);
      return;
    }
    /* Identity comes from the session on this device (see `sessionUser`), so
       being offline, or Supabase being down, is no longer the same thing as
       being signed out. A throw is still caught — an app stuck on "Loading…"
       forever is the one outcome worse than any wrong guess — and it falls
       back to the stored session before it falls back to a guest. */
    let user: User | null;
    try {
      user = await sessionUser();
    } catch (err) {
      reportWarn('auth.bootstrap', err);
      user = storedSessionUser();
    }
    if (user) adoptAccount(user);
    else becomeGuest();
  }, [adoptAccount, becomeGuest]);

  useEffect(() => {
    /* A deadline on the boot screen itself.

       Requests carry their own timeout (supabase.ts), identity is read from
       the device, and the sync does not block this path — but `authReady`
       gates the only thing a first visitor can see, and "the app shows
       nothing at all" is too expensive a failure to leave resting on every
       call downstream continuing to behave. The slow part left is settling an
       email link, which is a network exchange.

       If the answer is not back in eight seconds, open the app as whoever the
       stored session says this is — not as a guest. Opening as a guest used to
       be the fallback, and it put a signed-in student into the guest world
       with every answer saved under the guest key, where their account never
       saw it. With no stored session, a guest is the truth. `refreshAuth`
       still runs to the end and corrects either answer if it has to. */
    let settled = false;
    const openAnyway = setTimeout(() => {
      if (settled) return;
      reportWarn('auth.bootstrap', 'timed out; opening from the stored session');
      const stored = storedSessionUser();
      if (stored) adoptAccount(stored);
      else setAuthReady(true);
    }, 8_000);

    /* Settle any link clicked in an email before asking who is signed in — the
       exchange is what creates the session a password reset then depends on.
       Guarded: a broken or already-used confirmation link is a plausible way
       to hit a raw network or provider error here, and `refreshAuth()` below
       must still run even if the redirect never settles. */
    void (async () => {
      let redirect: Awaited<ReturnType<typeof consumeAuthRedirect>> = null;
      try {
        redirect = await consumeAuthRedirect();
      } catch (err) {
        reportWarn('auth.redirect', err);
      }
      if (redirect) setAuthRedirect(redirect);
      await refreshAuth();
      settled = true;
      clearTimeout(openAnyway);
    })();

    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      /* Supabase re-announces SIGNED_IN whenever a tab regains focus, and
         TOKEN_REFRESHED every hour. For the account already loaded neither is
         news — treating them as sign-ins reloaded progress from disk and ran a
         full sync on every alt-tab. For an account that is *not* loaded they
         are, so either one switches to it.

         Deferred a tick: supabase-js calls this while holding its auth lock,
         and `refreshAuth` asks it for the session, which waits on that lock. */
      const rerun = () => window.setTimeout(() => void refreshAuth(), 0);
      if (event === 'SIGNED_OUT' || event === 'USER_UPDATED') rerun();
      else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user.id !== activeUidRef.current) rerun();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [refreshAuth, adoptAccount]);

  /* Push on a debounce while signed in, so a session's work survives a
     closed tab without hammering the API on every answer.

     Not before the first sync for this account has read the row — see
     `syncedUidRef`. If that sync failed (offline at boot), the tick retries
     the whole sync instead, pull first, so a session that started offline
     still reaches the cloud once the connection is back. */
  const pushTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!userId || !cloudEnabled) return;
    if (pushTimer.current) window.clearTimeout(pushTimer.current);
    pushTimer.current = window.setTimeout(() => {
      if (activeUidRef.current !== userId) return;
      if (syncedUidRef.current !== userId) {
        if (!syncInFlightRef.current) {
          void syncWithCloud(userId, playerName, readRaw(CLAIM_GUEST_KEY) === '1');
        }
        return;
      }
      void pushSynced(userId, playerName).then(reportPush);
    }, 4000);
    return () => {
      if (pushTimer.current) window.clearTimeout(pushTimer.current);
    };
  }, [progress, userId, playerName, pushSynced, reportPush, syncWithCloud]);

  /* Last-chance flush when the tab goes away. Sent with `keepalive` so the
     request can finish after the page is gone — best effort: supabase-js
     reads the session before it sends, and a browser that freezes the page
     first gets no request at all. The debounce above is the real guarantee. */
  useEffect(() => {
    if (!userId) return;
    const flush = () => {
      if (document.visibilityState !== 'hidden' || syncedUidRef.current !== userId) return;
      if (pushTimer.current) window.clearTimeout(pushTimer.current);
      void pushSynced(userId, playerName, true);
    };
    document.addEventListener('visibilitychange', flush);
    return () => document.removeEventListener('visibilitychange', flush);
  }, [userId, playerName, pushSynced]);

  const switchIdentity = useCallback((next: Identity) => {
    const loaded = loadProgress(progressKeyFor(next));
    setIdentity(next);
    setProgress(loaded);
    progressRef.current = loaded;
    /* A different account's row has a different history. Carrying the previous
       one's timestamp over would make the first write for this identity claim
       to have seen a row it never read. */
    remoteUpdatedAtRef.current = null;
  }, []);

  /* Refused while signed in. Switching to the guest world leaves `userId` set,
     so the push effect above would write the guest's progress — under the
     name 'Traveller' — into the account's cloud row. Reachable from the
     Landing header's "Sign in" link, which signed-in users also see. */
  const continueAsGuest = useCallback(() => {
    if (userId) return;
    writeRaw(STORAGE_KEYS.guest, '1');
    setHasStarted(true);
    setPlayerName('Traveller');
    switchIdentity({ kind: 'guest' });
  }, [userId, switchIdentity]);

  const claimGuestProgress = useCallback(() => {
    writeRaw(CLAIM_GUEST_KEY, '1');
  }, []);

  const releaseGuestClaim = useCallback(() => {
    removeRaw(CLAIM_GUEST_KEY);
  }, []);

  const clearAuthRedirect = useCallback(() => setAuthRedirect(null), []);

  const signOutFn = useCallback(async () => {
    /* Save first. The debounced push was simply cancelled here, so the last
       four seconds of work — the answer that made them think "done for
       today" — never left the device, and the next device they signed in on
       did not have it. Bounded, because a sign-out that hangs on a dead
       network is a sign-out that does not happen; the work is still on disk
       under the account's key either way, and goes up at the next sign-in. */
    const uid = activeUidRef.current;
    if (pushTimer.current) window.clearTimeout(pushTimer.current);
    if (uid && syncedUidRef.current === uid) {
      let timer: number | undefined;
      await Promise.race([
        pushSynced(uid, playerName),
        new Promise<void>((resolve) => {
          timer = window.setTimeout(resolve, SIGN_OUT_FLUSH_MS);
        }),
      ]);
      window.clearTimeout(timer);
    }

    /* Let go of the account before the network round trip. A pull still in
       flight checks this ref before merging; left set, it could land after
       the switch below and merge the account into the guest world. */
    activeUidRef.current = null;
    remoteUpdatedAtRef.current = null;
    syncedUidRef.current = null;

    /* Leave nothing at this browser that the next person could inherit: no
       claim flag for their sign-up to act on, and — if this session merged
       the guest world into the account but never got to confirm it in the
       cloud — not that guest world either. It is in the account's own save
       now, and goes up at the next sign-in. */
    removeRaw(CLAIM_GUEST_KEY);
    if (claimMergedRef.current) removeRaw(GUEST_KEY);
    claimMergedRef.current = false;

    await cloudSignOut();
    setUserId(null);
    setPlayerName('Traveller');
    switchIdentity({ kind: 'guest' });
  }, [playerName, pushSynced, switchIdentity]);

  /* Carries a pending claim, so a sign-up whose first sync failed can finish
     claiming from the Settings button rather than only from a reload. */
  const syncNow = useCallback(async () => {
    if (userId) await syncWithCloud(userId, playerName, readRaw(CLAIM_GUEST_KEY) === '1');
  }, [userId, playerName, syncWithCloud]);

  /* Wipe progress without touching the account.

     The remote row has to go first. This used to clear localStorage and
     reload — whereupon refreshAuth pulled the cloud copy straight back down and
     merged it into the empty local one, so everything the player had just asked
     to delete reappeared. Deleting locally only is not deleting. */
  const resetEverything = useCallback(async () => {
    /* Stop every write first. A debounced push still pending, or the flush
       that fires as the reload hides the page, would carry the old progress
       straight back into the row this is about to delete. */
    resettingRef.current = true;
    if (pushTimer.current) window.clearTimeout(pushTimer.current);

    /* And mark when. Deleting the row was not enough on its own: another
       device, or another tab, still held the whole history, and its next sync
       found no row and pushed everything straight back. The fresh world
       carries `resetAt`, and `mergeProgress` discards whichever side is older
       than it — so the reset reaches every copy, instead of the first copy to
       sync undoing it. */
    const fresh: Progress = { ...emptyProgress(), resetAt: Date.now() };

    if (userId && !(await deleteRemoteProgress(userId))) {
      /* Clearing this device anyway would look like success until the next
         sign-in pulled every bit of it back down. Say so and change nothing. */
      resettingRef.current = false;
      return {
        ok: false,
        error:
          'Could not reach the cloud, so nothing was reset. Check your connection and try again.',
      };
    }
    if (userId) {
      /* Into the row the delete just emptied, so the other devices hear about
         the reset rather than finding nothing. If this one write fails the
         reset still stands here and in the cloud; only a device that pushes
         before this one next syncs could bring old work back. */
      const seeded = await pushProgress(playerName, fresh, null);
      if (seeded.status !== 'ok')
        reportWarn('sync.reset', `epoch row not written: ${seeded.status}`);
    }
    saveProgress(fresh, storageKey);
    removeRaw(STORAGE_KEYS.progress);
    removeRaw(STORAGE_KEYS.guest);
    removeRaw(STORAGE_KEYS.legacyProgress);
    removeRaw(STORAGE_KEYS.legacyJourney);
    removeRaw(STORAGE_KEYS.legacyProfile);
    removeRaw(STORAGE_KEYS.seenIntro);
    /* A timed test left half-done would otherwise offer to resume after the
       reload, and finishing it would score a pre-reset test into the fresh
       world. */
    removeRaw(TEST_SESSION_KEY);
    window.location.hash = '#/';
    window.location.reload();
    return { ok: true };
  }, [storageKey, userId, playerName]);

  /** Delete the account itself, and every trace of it on this device. */
  const deleteAccountFn = useCallback(async () => {
    // As in resetEverything: no write may follow the account out.
    resettingRef.current = true;
    if (pushTimer.current) window.clearTimeout(pushTimer.current);
    const result = await cloudDeleteAccount();
    if (!result.ok) {
      resettingRef.current = false;
      return result;
    }
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
      finishDaily,
      finishDiagnostic,
      defeatBoss,
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
      progress,
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
      finishDaily,
      finishDiagnostic,
      defeatBoss,
      updateProgress,
      identity,
      continueAsGuest,
      claimGuestProgress,
      releaseGuestClaim,
      refreshAuth,
      signOutFn,
      syncNow,
      resetEverything,
      deleteAccountFn,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
