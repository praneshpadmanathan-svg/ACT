/* The progress model: XP, ranks, streaks, spaced repetition and score
   estimation. Pure functions over a single serialisable `Progress` object,
   so it can be persisted locally and synced to Supabase without ceremony. */

import type {
  Attempt,
  Difficulty,
  Progress,
  ReviewEntry,
  SectionId,
  Tally,
  TestResult,
} from '@/types';
import type { IconName } from '@/components/Icon';
/* `@/content/zones`, not `@/content`. This module is reached from the store,
   which is reached from `main.tsx`, so whatever it imports is in the first
   paint — and the barrel is 738 kB of question bank to obtain one lookup
   table built from a 10 kB file. */
import { TOPIC_BY_ZONE_ALIAS } from '@/content/zones';
import { DEFAULT_HERO_ID, isHeroId } from '@/game/heroes';
import { readJSON, STORAGE_KEYS, writeJSON } from './storage';
import { canonicalTopic } from './utils';

/* ------------------------------------------------------------------- ranks */

export interface Rank {
  /* Stable, and separate from `name` on purpose. The sigils used to be keyed
     by display name, which quietly made the name a piece of API: renaming a
     rank silently dropped it to the fallback badge. Names are copy and copy
     gets rewritten — this set has been rewritten once already. */
  id: string;
  name: string;
  xp: number;
  color: string;
  /** Badge gradient stops. */
  c1: string;
  c2: string;
  ring: string;
  tagline: string;
}

/* Seven ranks, named for what you are doing to the Grey.
 *
 * They started as Recruit, Scholar, Honors, Distinction, Vanguard, Elite and
 * Perfect 36 — an American honour roll dropped into a world with a plague, a
 * mist, four sealed guardians and a summit. Every other noun the student meets
 * belongs to the fiction; the one thing measuring them did not, and it read
 * like a report card taped to the side of a game.
 *
 * The first rewrite fixed the setting and undershot the register: Wanderer and
 * Lampbearer and Daybreak are the vocabulary of a quiet novel, and this is a
 * rank ladder a fifteen-year-old is meant to want to climb. A rank should hit
 * like a rank. So they are compounds now, each one a verb aimed at the Grey —
 * you drift, you find the road, you carry fire, you hold the road, you break
 * what was shut, you become the thing the Grey loses to, and then you are
 * crowned. Hard consonants, no abstractions, and the top of the ladder is a
 * title rather than a time of day.
 *
 * Thresholds and colours are untouched across both rewrites — nobody loses a
 * rank, and nobody's badge changes hue, over a copy change.
 *
 * The taglines still have a job beyond flavour: rank six and seven say plainly
 * where a student actually stands, because "Greybane" on its own does not tell
 * anyone they are into the top tenth. */
export const RANKS: Rank[] = [
  {
    id: 'drifter',
    name: 'Drifter',
    xp: 0,
    c1: '#e58a4e',
    c2: '#a4551f',
    ring: '#ffb877',
    color: '#e58a4e',
    tagline: 'Every 36 starts here.',
  },
  {
    id: 'pathfinder',
    name: 'Pathfinder',
    xp: 900,
    c1: '#eef3fb',
    c2: '#9fb2cc',
    ring: '#ffffff',
    color: '#cdd9ec',
    tagline: 'You do not guess the road any more. The habit is forming.',
  },
  {
    id: 'torchbearer',
    name: 'Torchbearer',
    xp: 2400,
    c1: '#ffe07a',
    c2: '#dfa018',
    ring: '#fff3b0',
    color: '#ffd23e',
    tagline: 'You carry your own fire now.',
  },
  {
    id: 'roadwarden',
    name: 'Roadwarden',
    xp: 4800,
    c1: '#63f0e0',
    c2: '#1c94ab',
    ring: '#b6fff5',
    color: '#43e0e0',
    tagline: 'The road behind you stays open. Precision under pressure.',
  },
  {
    id: 'gatebreaker',
    name: 'Gatebreaker',
    xp: 8400,
    c1: '#c8aaff',
    c2: '#7a4fd0',
    ring: '#e6d8ff',
    color: '#c6a8ff',
    tagline: 'Sealed does not mean shut. Not to you.',
  },
  {
    id: 'greybane',
    /* Was rose. Rose is a lovely colour and it does not say *bane* — this one
       is the ember at the end of a long night, and it has to sit next to the
       violet above it and the sunrise below without turning into the red the
       app already uses for a wrong answer. */
    name: 'Greybane',
    xp: 13500,
    c1: '#ff8a6b',
    c2: '#c9341f',
    ring: '#ffc4ae',
    color: '#ff8a6b',
    tagline: 'The Grey has learned your name. Top-decile territory.',
  },
  {
    id: 'stormcrown',
    /* Was Daybreak. A sunrise is a thing that happens to you; a crown is a
       thing you take. Same gold — the colour was never the problem. */
    name: 'Stormcrown',
    xp: 21000,
    c1: '#ffe36e',
    c2: '#ff8c3b',
    ring: '#fff3b0',
    color: '#ffe36e',
    tagline: 'Nothing left to miss.',
  },
];

/** Look a rank up by its stable id. Throws on an unknown one, deliberately —
 *  every caller is a literal in this file, so a miss is a typo, not a runtime
 *  condition, and a silent fallback would hide it. */
export function rankById(id: string): Rank {
  const rank = RANKS.find((r) => r.id === id);
  if (!rank) throw new Error(`unknown rank id: ${id}`);
  return rank;
}

export function rankIndexFor(xp: number): number {
  let idx = 0;
  RANKS.forEach((rank, i) => {
    if (xp >= rank.xp) idx = i;
  });
  return idx;
}

export function rankFor(xp: number): Rank {
  // `rankIndexFor` only ever returns an index it walked, and RANKS is a
  // non-empty literal, so index 0 is the floor.
  return RANKS[rankIndexFor(xp)]!;
}

/** Progress through the current rank, 0-1. Maxes out at the top rank. */
export function rankProgress(xp: number): {
  pct: number;
  into: number;
  span: number;
  next: Rank | null;
} {
  const here = rankFor(xp);
  const next = RANKS[rankIndexFor(xp) + 1] ?? null;
  if (!next) return { pct: 1, into: 0, span: 0, next: null };
  const span = next.xp - here.xp;
  const into = xp - here.xp;
  return { pct: Math.min(1, into / span), into, span, next };
}

/* ---------------------------------------------------------------------- xp */

const XP_BY_DIFFICULTY: Record<Difficulty, number> = { easy: 10, medium: 16, hard: 24 };

export const XP = {
  question: (difficulty: Difficulty, correct: boolean, streak: number) => {
    if (!correct) return 2; // showing up still counts for a little
    const base = XP_BY_DIFFICULTY[difficulty];
    // Streak bonus caps so a long session can't run away with the rank ladder.
    const bonus = Math.min(streak, 10) * 2;
    return base + bonus;
  },
  zoneQuestion: (d: number, correct: boolean, streak: number) => {
    if (!correct) return 2;
    const base = d >= 3 ? 22 : d === 2 ? 15 : 10;
    return base + Math.min(streak, 10) * 2;
  },
  notePage: 40,
  zoneCleared: 120,
  zonePerfect: 80,
  testSection: 250,
  fullTest: 900,
  dailyChallenge: 60,
};

/* ---------------------------------------------------------------- defaults */

export function emptyTally(): Tally {
  return { answered: 0, correct: 0, topics: {}, daily: {} };
}

export function emptyProgress(): Progress {
  return {
    version: 2,
    xp: 0,
    tally: emptyTally(),
    attempts: [],
    notesRead: [],
    zonesCleared: {},
    testHistory: [],
    achievements: [],
    dayStreak: 0,
    lastActiveDay: null,
    currentCorrectStreak: 0,
    bestCorrectStreak: 0,
    targetScore: 30,
    /** Questions per week, not XP — see the migration in `loadProgress`. */
    weeklyGoal: 75,
    profile: null,
    hero: DEFAULT_HERO_ID,
    bookmarks: [],
    streakShields: 0,
    dailyDoneOn: null,
    diagnostic: null,
    storySeen: [],
    oath: null,
    startRegion: null,
    discovered: [],
    review: {},
  };
}

/* -------------------------------------------------------------------- tally */

export const topicKey = (section: SectionId | 'zone', topic: string) => `${section}::${topic}`;

/** How many days of per-day counts to keep. The activity chart shows 12 weeks;
 *  120 days leaves headroom without the map growing without bound. */
const DAILY_DAYS = 120;

function trimDaily(daily: Record<string, number>): Record<string, number> {
  const keys = Object.keys(daily);
  if (keys.length <= DAILY_DAYS) return daily;
  const kept = keys.sort().slice(-DAILY_DAYS);
  const out: Record<string, number> = {};
  for (const k of kept) out[k] = daily[k] ?? 0;
  return out;
}

/** Fold one answer into the running totals. Pure. */
export function tallyAnswer(tally: Tally, attempt: Omit<Attempt, 'at'>): Tally {
  const key = topicKey(attempt.section, attempt.topic);
  const prev = tally.topics[key] ?? { section: attempt.section, n: 0, ok: 0, ms: 0 };
  const today = dayKey();

  return {
    answered: tally.answered + 1,
    correct: tally.correct + (attempt.correct ? 1 : 0),
    topics: {
      ...tally.topics,
      [key]: {
        section: attempt.section,
        n: prev.n + 1,
        ok: prev.ok + (attempt.correct ? 1 : 0),
        ms: prev.ms + attempt.ms,
      },
    },
    daily: trimDaily({ ...tally.daily, [today]: (tally.daily[today] ?? 0) + 1 }),
  };
}

/** Rebuild the totals from a raw attempt log.
 *
 *  Used to backfill anyone whose progress predates the tally. It is only ever
 *  as complete as the log it reads, and that log was capped at 4,000 — so a
 *  player past that cap comes back with a slightly low lifetime count. That is
 *  a one-time cosmetic loss on a number that was already wrong for exactly the
 *  same reason, and it is the last time it can happen. */
export function tallyFromAttempts(attempts: Attempt[]): Tally {
  const tally = emptyTally();
  for (const a of attempts) {
    const key = topicKey(a.section, a.topic);
    const prev = tally.topics[key] ?? { section: a.section, n: 0, ok: 0, ms: 0 };
    tally.topics[key] = {
      section: a.section,
      n: prev.n + 1,
      ok: prev.ok + (a.correct ? 1 : 0),
      ms: prev.ms + a.ms,
    };
    const day = dayKey(new Date(a.at));
    tally.daily[day] = (tally.daily[day] ?? 0) + 1;
    tally.answered += 1;
    if (a.correct) tally.correct += 1;
  }
  tally.daily = trimDaily(tally.daily);
  return tally;
}

/** Answers per day for the last `days` days, oldest first. */
export function dailyActivity(p: Progress, days: number): number[] {
  const out = new Array<number>(days).fill(0);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() - (days - 1 - i) * 86_400_000);
    out[i] = p.tally.daily[dayKey(d)] ?? 0;
  }
  return out;
}

/* ---------------------------------------------------------------- migration */

/** Pull forward whatever the previous single-file build saved, so returning
 *  users don't lose their XP. Runs once; safe to call repeatedly. */
export function migrateLegacy(current: Progress): Progress {
  const legacy = readJSON<Record<string, unknown> | null>(STORAGE_KEYS.legacyProgress, null);
  const legacyJourney = readJSON<{ done?: Record<string, boolean> }>(
    STORAGE_KEYS.legacyJourney,
    {},
  );
  const legacyProfile = readJSON<Progress['profile']>(STORAGE_KEYS.legacyProfile, null);

  if (!legacy && !legacyProfile && !legacyJourney.done) return current;
  // Only migrate into a fresh profile — never clobber real v2 progress.
  if (current.xp > 0 || current.tally.answered > 0) return current;

  const next: Progress = { ...current };
  if (legacy) {
    if (typeof legacy.xp === 'number') next.xp = legacy.xp;
    if (Array.isArray(legacy.notesRead)) next.notesRead = legacy.notesRead as string[];
    if (Array.isArray(legacy.achievements)) next.achievements = legacy.achievements as string[];
    if (typeof legacy.dayStreak === 'number') next.dayStreak = legacy.dayStreak;
    if (typeof legacy.targetScore === 'number') next.targetScore = legacy.targetScore;
    if (typeof legacy.weeklyGoal === 'number') next.weeklyGoal = legacy.weeklyGoal;
    if (typeof legacy.bestCorrectStreak === 'number')
      next.bestCorrectStreak = legacy.bestCorrectStreak;
  }
  if (legacyProfile) next.profile = legacyProfile;
  if (legacyJourney.done) {
    for (const id of Object.keys(legacyJourney.done)) next.zonesCleared[id] = 100;
  }
  return next;
}

/* ------------------------------------------------------------------ loading */

export function loadProgress(key: string = STORAGE_KEYS.progress): Progress {
  const stored = readJSON<Partial<Progress> | null>(key, null);
  const base = emptyProgress();
  const merged: Progress = stored ? { ...base, ...stored, version: 2 } : base;
  // Guard every collection — a half-written object should not crash a render.
  merged.attempts = Array.isArray(merged.attempts) ? merged.attempts : [];
  merged.notesRead = Array.isArray(merged.notesRead) ? merged.notesRead : [];
  merged.testHistory = Array.isArray(merged.testHistory) ? merged.testHistory : [];
  merged.achievements = Array.isArray(merged.achievements) ? merged.achievements : [];
  merged.zonesCleared = merged.zonesCleared ?? {};
  merged.review = merged.review ?? {};
  merged.storySeen = Array.isArray(merged.storySeen) ? merged.storySeen : [];
  merged.bookmarks = Array.isArray(merged.bookmarks) ? merged.bookmarks : [];
  merged.streakShields = typeof merged.streakShields === 'number' ? merged.streakShields : 0;
  merged.dailyDoneOn = typeof merged.dailyDoneOn === 'string' ? merged.dailyDoneOn : null;
  merged.diagnostic = merged.diagnostic ?? null;

  /* `hero` was written once as the string `'cadet'` and read by nothing, so
     every save in existence holds a value that is not a real hero id. Coerce
     it rather than trusting it: an unknown id would render an empty avatar. */
  if (!isHeroId(merged.hero)) merged.hero = DEFAULT_HERO_ID;

  /* Backfill the totals for anyone whose progress predates them. Without this
     an established player would open the app to a lifetime count of zero.

     Ask the *stored* record, not the merged one. `merged` is the stored record
     spread over `emptyProgress()`, which always supplies a well-formed empty
     tally — so testing `merged.tally` was asking "did the default I just
     applied work?", which is always yes, and the backfill it guards never ran
     once. The bug was invisible in testing because a new account looks
     identical either way; it only showed on a record written before tallies
     existed, which is every returning player.

     General shape worth remembering: after spreading defaults, you can no
     longer ask whether a field was present. Ask the input. */
  merged.tally = isTally(stored?.tally) ? merged.tally : tallyFromAttempts(merged.attempts);

  /* Fold together topics that were the same skill under different spellings.
     Anyone who played before the two question banks agreed on a vocabulary has
     `zone::COMMA CASTLE` sitting beside `english::commas`; this merges the
     buckets rather than stranding the old one under a name that means nothing
     to them. See `canonicalTopic`. */
  merged.tally = canonicaliseTally(merged.tally);

  /* The weekly goal changed units, from XP to questions answered.

     XP is a currency this app invented; nobody has a feel for whether 1,800 of
     it is a good week. Questions are the thing you are actually doing. Old
     saves hold the XP figure (900 to 2,400), so anything up in that range is
     converted at roughly the average XP a question pays. */
  if (merged.weeklyGoal > LEGACY_XP_GOAL_FLOOR) {
    merged.weeklyGoal = Math.round(merged.weeklyGoal / 16);
  }

  return stored ? merged : migrateLegacy(merged);
}

/** Above this, a weekly goal must be the old XP-denominated kind: the largest
 *  question goal we set is 150, the smallest legacy XP goal was 900. */
const LEGACY_XP_GOAL_FLOOR = 400;

function isTally(value: unknown): value is Tally {
  const t = value as Tally | undefined;
  return Boolean(t && typeof t.answered === 'number' && t.topics && t.daily);
}

/* Rewrite every topic key to its canonical spelling, summing any that collide.
 *
 * Merges the case and punctuation variants — `Commas` with `commas`,
 * `Subject–verb agreement` with `subject-verb agreement` — and then puts
 * anything recorded under a landmark's name back under the skill it was
 * testing, so a student's comma history is not split between `commas` and the
 * old shouted tag `COMMA CASTLE`.
 */
function canonicaliseTally(tally: Tally): Tally {
  const topics: Tally['topics'] = {};
  let changed = false;

  for (const [key, t] of Object.entries(tally.topics)) {
    const sep = key.indexOf('::');
    const section = sep < 0 ? String(t.section) : key.slice(0, sep);
    const raw = canonicalTopic(sep < 0 ? key : key.slice(sep + 2));
    const next = `${section}::${TOPIC_BY_ZONE_ALIAS[raw] ?? raw}`;
    if (next !== key) changed = true;

    const existing = topics[next];
    topics[next] = existing
      ? { section: t.section, n: existing.n + t.n, ok: existing.ok + t.ok, ms: existing.ms + t.ms }
      : { ...t };
  }

  return changed ? { ...tally, topics } : tally;
}

export function saveProgress(p: Progress, key: string = STORAGE_KEYS.progress): void {
  writeJSON(key, p);
}

/* ------------------------------------------------------------------ streaks */

export const dayKey = (d: Date = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** How many days a shield can bridge, and how many can be held at once. */
const MAX_SHIELDS = 2;
/** A completed week earns one. */
const SHIELD_EVERY = 7;

/**
 * Bump the day streak if this is the first activity today.
 *
 * The rule used to be absolute: miss one day and the count goes back to 1.
 * The student's review said what that does — *"the streak breaks and that's
 * it. No grace, no freeze, no way back. After one missed day I stop caring
 * about the number."* A counter whose only function is to bring somebody back
 * tomorrow should not be destroyed by the first Tuesday they have homework.
 *
 * So a missed day can be spent against a shield, earned one per completed
 * week and capped at two. The important properties:
 *
 *  - it is earned, not given, so the streak still means something;
 *  - it is capped, so a long absence cannot be bridged and the number never
 *    claims a run that did not happen;
 *  - it is spent automatically, because asking somebody to remember to burn a
 *    streak freeze is the same trap in a nicer coat;
 *  - it bridges *gaps*, not the whole absence — two shields cover a two-day
 *    gap and nothing longer.
 *
 * Returns the number of shields spent alongside the progress, so the caller
 * can say so. A shield spent silently is a feature nobody knows they have.
 */
export function touchDayStreak(p: Progress): Progress {
  return applyDayStreak(p).progress;
}

export function applyDayStreak(p: Progress): { progress: Progress; shieldsSpent: number } {
  const today = dayKey();
  if (p.lastActiveDay === today) return { progress: p, shieldsSpent: 0 };

  /* Whole days between the last active day and today. 1 is "yesterday", which
     continues the streak for free; 2 means one day was missed; and so on. */
  const gap = p.lastActiveDay ? daysBetween(p.lastActiveDay, today) : Infinity;
  const missed = Number.isFinite(gap) ? Math.max(0, gap - 1) : Infinity;

  let dayStreak: number;
  let shieldsSpent = 0;
  let streakShields = p.streakShields;

  if (missed === 0) {
    dayStreak = p.dayStreak + 1;
  } else if (missed <= streakShields) {
    // Bridge the gap: the streak counts the missed days as attended.
    shieldsSpent = missed;
    streakShields -= missed;
    dayStreak = p.dayStreak + missed + 1;
  } else {
    dayStreak = 1;
  }

  /* Earn on the way past each week boundary, so a 14-day streak has granted
     two and a 15-day streak has not granted a third it would only lose. */
  if (dayStreak > 0 && dayStreak % SHIELD_EVERY === 0) {
    streakShields = Math.min(MAX_SHIELDS, streakShields + 1);
  }

  return {
    progress: { ...p, dayStreak, lastActiveDay: today, streakShields },
    shieldsSpent,
  };
}

/** Whole days from one `yyyy-mm-dd` to another. Parsed as local noon so a
 *  daylight-saving shift cannot turn 24 hours into 23 and lose a day. */
export function daysBetween(from: string, to: string): number {
  const at = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12).getTime();
  };
  return Math.round((at(to) - at(from)) / 86_400_000);
}

/* ------------------------------------------------- spaced repetition (review) */

/** Leitner boxes, in days. */
const BOX_INTERVALS = [0, 1, 3, 7, 16, 35];
const TOP_BOX = BOX_INTERVALS.length - 1;

/* Under this, an answer was fast enough that the person knew it rather than
   worked it out. Over the second, they were reasoning from scratch. Both are
   deliberately generous: a Reading question with a passage attached is slow
   for everyone, and the cost of misreading one answer is small because the
   next one corrects it. */
const FAST_MS = 25_000;
const SLOW_MS = 75_000;

/** A question missed this many times is no longer given the benefit of the
 *  doubt on a fast wrong answer — see the note in `scheduleReview`. */
const CHRONIC_MISSES = 3;

/**
 * Move a question along the review ladder.
 *
 * The old rule was a plain Leitner box: right advances one, wrong resets to
 * zero, no matter how the answer was given. That treats *"I knew this
 * instantly"* and *"I worked at it for ninety seconds and just got there"* as
 * the same event, and it treats a mis-click the same as a misconception. The
 * review's own words were "it doesn't seem to know the difference between 'I
 * guessed' and 'I nearly had it'."
 *
 * Rather than replace the boxes with SM-2 or FSRS — which need a per-item
 * ease factor, a different stored shape and a migration for every question
 * already in flight — the transition *rule* changes and `BOX_INTERVALS` does
 * not. The signal is the response time, which the app has been recording into
 * `Tally.topics[].ms` since the beginning and has never once read back.
 *
 *   fast + correct    → advance two boxes. Recall this quick is genuine.
 *   correct           → advance one, as before.
 *   fast + incorrect  → drop one box, not to zero. A wrong answer given in
 *                       four seconds is usually a slip.
 *   slow + incorrect  → straight to zero. This one is not known.
 *
 * The obvious hole in "fast wrong is a slip" is a confidently-held
 * misconception, which is *also* answered fast and is the more dangerous of
 * the two. That is what `misses` is for: once a question has been got wrong
 * three times, speed stops earning leniency and every miss is a full reset.
 * The count is the thing that can tell the two apart, and the box index
 * cannot — a slip and a misconception both sit at box 0.
 */
export function scheduleReview(
  review: Progress['review'],
  qid: string,
  correct: boolean,
  ms = SLOW_MS,
): Progress['review'] {
  const existing = review[qid];
  const currentBox = existing?.box ?? 0;
  const misses = existing?.misses ?? 0;
  const fast = ms > 0 && ms < FAST_MS;

  let box: number;
  if (correct) {
    box = Math.min(currentBox + (fast ? 2 : 1), TOP_BOX);
  } else if (fast && misses < CHRONIC_MISSES) {
    box = Math.max(0, currentBox - 1);
  } else {
    box = 0;
  }

  // Once a question graduates the last box it leaves the review queue.
  if (correct && box === TOP_BOX && existing) {
    const { [qid]: _drop, ...rest } = review;
    return rest;
  }

  const next: ReviewEntry = {
    box,
    due: Date.now() + BOX_INTERVALS[box]! * 86_400_000,
    misses: misses + (correct ? 0 : 1),
  };
  return { ...review, [qid]: next };
}

/**
 * Everything due, hardest-earned first.
 *
 * Sorted by miss count before due date. A session is capped at twenty
 * questions, so when more than twenty are due the order decides what actually
 * gets practised — and the right answer there is the question that has beaten
 * you four times, not the one that happened to come due at 3am. Due date
 * breaks the tie, so within a miss count it is still oldest-first.
 */
export function dueForReview(p: Progress): string[] {
  const now = Date.now();
  return Object.entries(p.review)
    .filter(([, v]) => v.due <= now)
    .sort((a, b) => (b[1].misses ?? 0) - (a[1].misses ?? 0) || a[1].due - b[1].due)
    .map(([qid]) => qid);
}

/** How many questions come due in the next `days` days, for the nudge copy. */
export function comingDue(p: Progress, days: number): number {
  const horizon = Date.now() + days * 86_400_000;
  return Object.values(p.review).filter((v) => v.due > Date.now() && v.due <= horizon).length;
}

/* ------------------------------------------------------------ recording work */

export interface RecordResult {
  progress: Progress;
  xpGained: number;
  rankedUp: boolean;
  newRankIndex: number;
  /** Missed days a streak shield just covered, so the UI can say so. */
  shieldsSpent?: number;
}

/** How much of the raw answer log to keep on the device. Nothing reads an
 *  individual attempt, so this is a debugging convenience, not a record. */
const RECENT_ATTEMPTS = 300;

export function recordAttempt(
  p: Progress,
  attempt: Omit<Attempt, 'at'>,
  xpGained: number,
): RecordResult {
  const beforeRank = rankIndexFor(p.xp);
  const currentCorrectStreak = attempt.correct ? p.currentCorrectStreak + 1 : 0;

  const staged: Progress = {
    ...p,
    xp: p.xp + xpGained,
    tally: tallyAnswer(p.tally, attempt),
    // Local-only recent log; the durable count lives in the tally.
    attempts: [...p.attempts, { ...attempt, at: Date.now() }].slice(-RECENT_ATTEMPTS),
    currentCorrectStreak,
    bestCorrectStreak: Math.max(p.bestCorrectStreak, currentCorrectStreak),
    /* The response time is handed to the scheduler rather than dropped. It is
       the only signal the app has for how *confidently* an answer was given,
       and it has been recorded and unused since the first build. */
    review: scheduleReview(p.review, attempt.qid, attempt.correct, attempt.ms),
  };
  const { progress: next, shieldsSpent } = applyDayStreak(staged);

  const afterRank = rankIndexFor(next.xp);
  return {
    progress: next,
    xpGained,
    rankedUp: afterRank > beforeRank,
    newRankIndex: afterRank,
    shieldsSpent,
  };
}

export function awardXP(p: Progress, amount: number): RecordResult {
  const beforeRank = rankIndexFor(p.xp);
  const { progress: next, shieldsSpent } = applyDayStreak({ ...p, xp: p.xp + amount });
  const afterRank = rankIndexFor(next.xp);
  return {
    progress: next,
    xpGained: amount,
    rankedUp: afterRank > beforeRank,
    newRankIndex: afterRank,
    shieldsSpent,
  };
}

/* ---------------------------------------------------------------- analytics */

export interface TopicStat {
  topic: string;
  section: SectionId | 'zone';
  attempts: number;
  correct: number;
  accuracy: number;
  avgSeconds: number;
}

/* Both of these used to scan the raw attempt log. They read the running totals
   now, which is the same arithmetic without holding every answer in memory —
   and, more to the point, it keeps working after the log has been trimmed. */

export function topicStats(p: Progress, section?: SectionId): TopicStat[] {
  return Object.entries(p.tally.topics)
    .filter(([, t]) => !section || t.section === section)
    .map(([key, t]) => ({
      topic: key.slice(key.indexOf('::') + 2),
      section: t.section,
      attempts: t.n,
      correct: t.ok,
      accuracy: t.n ? t.ok / t.n : 0,
      avgSeconds: t.n ? t.ms / t.n / 1000 : 0,
    }))
    .sort((a, b) => a.accuracy - b.accuracy);
}

export function sectionAccuracy(
  p: Progress,
  section: SectionId,
): { n: number; ok: number; pct: number } {
  let n = 0;
  let ok = 0;
  for (const t of Object.values(p.tally.topics)) {
    if (t.section !== section) continue;
    n += t.n;
    ok += t.ok;
  }
  return { n, ok, pct: n ? ok / n : 0 };
}

/** The weakest topics with enough attempts to be meaningful. */
export function weakestTopics(p: Progress, limit = 5): TopicStat[] {
  return topicStats(p)
    .filter((t) => t.attempts >= 3 && t.accuracy < 0.8)
    .slice(0, limit);
}

/* ----------------------------------------------------------- score estimate */

/** Percent-correct -> ACT scaled score. Approximates the published curves;
 *  it is a study aid, not an official concordance. */
export function scaleScore(pct: number): number {
  const table: [number, number][] = [
    [0, 1],
    [0.1, 8],
    [0.2, 12],
    [0.3, 15],
    [0.4, 18],
    [0.5, 21],
    [0.6, 23],
    [0.7, 26],
    [0.8, 29],
    [0.88, 32],
    [0.94, 34],
    [0.98, 35],
    [1, 36],
  ];
  for (let i = table.length - 1; i >= 0; i--) {
    const row = table[i];
    if (!row) continue;
    if (pct >= row[0]) {
      const [lowPct, lowScore] = row;
      const upper = table[i + 1];
      if (!upper) return lowScore;
      const t = (pct - lowPct) / (upper[0] - lowPct);
      return Math.round(lowScore + t * (upper[1] - lowScore));
    }
  }
  return 1;
}

/* -------------------------------------------------------------- percentile

   *"A composite of 28 means nothing to me without knowing what percentage of
   people I just beat."* — and the app had no percentile anywhere.

   These are ACT's published national ranks for recent graduating cohorts,
   rounded to whole percents. They are the *composite* ranks, which is the
   number a student actually wants; section-level ranks differ by a few points
   either way and are not worth four more tables for a figure that is labelled
   approximate anyway.

   Two honesty constraints, both enforced in the UI that renders this:
     - it is always shown as "about", never as a precise figure;
     - it is never shown for the drill-derived estimate, only for a completed
       test, because a percentile on twelve English questions is a fiction
       with a decimal point.  */
const PERCENTILE_BY_COMPOSITE: Record<number, number> = {
  36: 100,
  35: 99,
  34: 99,
  33: 98,
  32: 96,
  31: 95,
  30: 93,
  29: 91,
  28: 89,
  27: 86,
  26: 82,
  25: 78,
  24: 74,
  23: 69,
  22: 64,
  21: 58,
  20: 52,
  19: 46,
  18: 40,
  17: 34,
  16: 27,
  15: 20,
  14: 13,
  13: 7,
  12: 4,
  11: 2,
  10: 1,
  9: 1,
  8: 1,
  7: 1,
  6: 1,
  5: 1,
  4: 1,
  3: 1,
  2: 1,
  1: 1,
};

/** Roughly what share of test-takers score at or below this composite. */
export function percentileFor(composite: number): number | null {
  const key = Math.round(composite);
  return PERCENTILE_BY_COMPOSITE[key] ?? null;
}

/** "The top 1 in 10" — a percentile a fifteen-year-old can picture. A bare
 *  90th percentile is a number; "1 in 10" is a room.
 *
 *  Every branch returns a phrase that reads correctly after the word "about",
 *  because the one place this is rendered is legally and pedagogically obliged
 *  to hedge it, and a sentence that only parses for the flattering half of the
 *  range is how "about the about 30 in 100" ships. */
export function percentileInWords(percentile: number): string {
  if (percentile >= 99) return 'the top 1% of test-takers';
  if (percentile >= 95) return 'the top 1 in 20';
  if (percentile >= 90) return 'the top 1 in 10';
  if (percentile >= 75) return 'the top quarter';
  if (percentile >= 50) return 'the top half';
  return `ahead of ${percentile} in 100 test-takers`;
}

export function compositeOf(scores: Partial<Record<SectionId, number>>): number {
  const values = Object.values(scores).filter((v): v is number => typeof v === 'number');
  if (!values.length) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

/** Best guess at the user's current composite, from drill accuracy. Needs at
 *  least a handful of attempts per section before it says anything. */
export function estimatedComposite(p: Progress): number | null {
  const scores: Partial<Record<SectionId, number>> = {};
  let covered = 0;
  for (const id of ['english', 'math', 'reading', 'science'] as SectionId[]) {
    const { n, pct } = sectionAccuracy(p, id);
    if (n >= 8) {
      scores[id] = scaleScore(pct);
      covered += 1;
    }
  }
  if (covered < 2) return null;
  return compositeOf(scores);
}

/* --------------------------------------------------------- am I on track?

   *"Nothing tells me if I'm on track for the score I said I wanted."* The app
   collected a target on the first screen of onboarding and then never once
   mentioned it again.

   This is deliberately a *trend*, not a prediction. It compares the estimate
   now against the oldest completed test inside a sixty-day window and says
   which way it is going and whether that direction reaches the target before
   the test date. Sixty days rather than a fortnight because two weeks is
   frequently zero tests, and a trend drawn from one point is not a trend.

   Anything more confident than this would be dressing up a hand-fit curve over
   drill accuracy as a forecast, which is exactly the thing a competitor would
   and should attack. */

export type TrackVerdict = 'ahead' | 'onTrack' | 'behind' | 'unknown';

export interface TrackStatus {
  verdict: TrackVerdict;
  current: number | null;
  target: number;
  /** Scaled points gained over the window, positive or negative. */
  change: number | null;
  /** Points still needed. */
  gap: number | null;
  /** Days to the test, when a date is set. */
  daysLeft: number | null;
}

/** Points per week a student typically moves with steady work. Used only to
 *  decide whether the remaining time is plausibly enough, never displayed. */
const POINTS_PER_WEEK = 0.4;

export function trackStatus(p: Progress): TrackStatus {
  const current = estimatedComposite(p);
  const target = p.targetScore;
  const testDate = p.profile?.testDate ?? null;
  const daysLeft = testDate ? Math.max(0, daysBetween(dayKey(), testDate)) : null;

  if (current === null) {
    return { verdict: 'unknown', current: null, target, change: null, gap: null, daysLeft };
  }

  const gap = target - current;

  /* The trend is drawn from completed tests only, newest against oldest inside
     the window.

     It is tempting to use the drill estimate as the near end of the line —
     it is always available, where a second test may not be — but the estimate
     and a scored test are two different instruments, and the difference
     between them is a systematic offset, not progress. Subtracting one from
     the other reports the offset as movement. Two tests, or no number. */
  const recent = p.testHistory.filter((t) => Date.now() - t.at < 60 * 86_400_000);
  const change =
    recent.length >= 2 ? recent[recent.length - 1]!.composite - recent[0]!.composite : null;

  if (gap <= 0) return { verdict: 'ahead', current, target, change, gap, daysLeft };

  if (daysLeft === null) {
    // No date, so "on track" has no meaning — report the gap and stop.
    return { verdict: gap <= 2 ? 'onTrack' : 'behind', current, target, change, gap, daysLeft };
  }

  const reachable = (daysLeft / 7) * POINTS_PER_WEEK;
  return {
    verdict: reachable >= gap ? 'onTrack' : 'behind',
    current,
    target,
    change,
    gap,
    daysLeft,
  };
}

/* --------------------------------------------------------------- pacing

   Per-question timing has been captured into `Tally.topics[].ms` since the
   first build and surfaced nowhere. A student's third complaint was "I don't
   find out I'm too slow until the timer runs out", which is a reporting
   failure rather than a missing measurement. */

export interface Pacing {
  /** Seconds per question the section's real timing allows. */
  budget: number;
  /** Seconds per question actually taken. */
  actual: number;
  /** Positive means over budget. */
  overBy: number;
  verdict: 'comfortable' | 'tight' | 'over';
}

/* Real ACT seconds per question, from the published timings:
   English 50Q/35min, Math 45Q/50min, Reading 36Q/40min, Science 40Q/40min.
   Deliberately the *real* budget, not this app's scaled-down section length —
   pacing practice against a shortened section teaches the wrong tempo. */
export const SECONDS_PER_QUESTION: Record<SectionId, number> = {
  english: (35 * 60) / 50,
  math: (50 * 60) / 45,
  reading: (40 * 60) / 36,
  science: (40 * 60) / 40,
};

/** `allowance` is the extended-time multiplier the student actually sat the
 *  section under. Judging an accommodated student against the standard clock
 *  would tell them they are slow when they are not; they get the same 1.5x or
 *  2x on test day that they get here. */
export function pacingFor(
  section: SectionId,
  seconds: number,
  questions: number,
  allowance = 1,
): Pacing | null {
  if (questions <= 0) return null;
  const budget = SECONDS_PER_QUESTION[section] * (allowance > 0 ? allowance : 1);
  const actual = seconds / questions;
  const overBy = actual - budget;
  return {
    budget,
    actual,
    overBy,
    verdict: overBy <= -2 ? 'comfortable' : overBy <= 4 ? 'tight' : 'over',
  };
}

/* Where the student should be by now, given how much of the clock has gone.
 *
 * The complaint — *"I don't find out I'm too slow until the timer runs out"* —
 * is only answered by something that speaks up *during* the section, and such
 * a thing is only tolerable if it is quiet. Three rules:
 *
 *   - silent before a fifth of the section has gone, because the first two
 *     questions are always slow and a warning there is noise;
 *   - silent until the student is a clear two questions behind, so a normal
 *     wobble does not trigger it;
 *   - it names the question they should be on rather than saying "hurry up".
 *     A pace is actionable; an instruction to panic is not.
 *
 * `elapsedFrac` is fraction of the section's clock spent — the clock the
 * student was actually given, so extended time needs no special case here. */
export function paceHint(answered: number, questions: number, elapsedFrac: number): string | null {
  if (questions <= 0 || elapsedFrac < 0.2 || elapsedFrac >= 1) return null;
  const expected = Math.floor(questions * elapsedFrac);
  if (answered >= expected - 1) return null;
  return `Pace: aim to be on question ${Math.min(questions, expected + 1)}`;
}

/* ---------------------------------------------------------- daily challenge

   `XP.dailyChallenge` was defined in this file and referenced nowhere — one of
   three fields the engineer's review flagged as looking like a half-shipped
   feature. Either build it or delete it; a constant that names a feature the
   app does not have is worse than both. Built.

   The design constraint came from the student: *"nothing to do in 90 seconds.
   No daily question, no quick hit — the smallest unit of engagement is a whole
   drill."* So: five questions, drawn from whatever is due for review first and
   topped up from the weakest topics, once a day. */

export const DAILY_SIZE = 5;

export const dailyDone = (p: Progress): boolean => p.dailyDoneOn === dayKey();

export function completeDaily(p: Progress): RecordResult {
  if (dailyDone(p)) {
    return { progress: p, xpGained: 0, rankedUp: false, newRankIndex: rankIndexFor(p.xp) };
  }
  return awardXP({ ...p, dailyDoneOn: dayKey() }, XP.dailyChallenge);
}

export function recordTest(p: Progress, result: TestResult): RecordResult {
  const beforeRank = rankIndexFor(p.xp);
  const gain = result.sections.length === 4 ? XP.fullTest : XP.testSection * result.sections.length;
  const { progress: next, shieldsSpent } = applyDayStreak({
    ...p,
    xp: p.xp + gain,
    testHistory: [...p.testHistory, result],
  });
  const afterRank = rankIndexFor(next.xp);
  return {
    progress: next,
    xpGained: gain,
    rankedUp: afterRank > beforeRank,
    newRankIndex: afterRank,
    shieldsSpent,
  };
}

/* -------------------------------------------------------------------- merge */

/* Combine two histories rather than letting one silently win.

   Used for two things: syncing a device against the cloud, and folding guest
   progress into a freshly created account. An early build did a
   fire-and-forget push, so opening the app on a second device could overwrite
   good progress with an empty profile.

   The rule throughout is **you can only move forward**. Counters take the
   maximum, sets are unioned, review schedules keep whichever is further along.

   The one honest limitation is in the tally. Individual answers used to be
   unioned by `qid@timestamp`, which deduplicated exactly; running totals cannot
   be deduplicated, because 100 + 100 is indistinguishable from the same 100
   counted twice. So topic totals take the maximum instead. Work on *different*
   topics still combines correctly — English on the laptop and Math on the phone
   both survive, which is the case that actually happens. Only the same topic
   advanced on two devices between syncs loses the smaller side. That direction
   is deliberate: under-counting tells a student they have done less work than
   they have, which is recoverable; over-counting would inflate their accuracy
   and quietly corrupt the score estimate they are trusting. */
export function mergeProgress(local: Progress, remote: Progress): Progress {
  const testKey = (t: { id: string; at: number }) => `${t.id}@${t.at}`;
  const tests = new Map<string, Progress['testHistory'][number]>();
  for (const t of [...remote.testHistory, ...local.testHistory]) tests.set(testKey(t), t);

  const zonesCleared: Record<string, number> = { ...remote.zonesCleared };
  for (const [id, pct] of Object.entries(local.zonesCleared)) {
    zonesCleared[id] = Math.max(zonesCleared[id] ?? 0, pct);
  }

  /* Keep whichever review schedule is further along per question — but take
     the *higher* miss count either way. Forgetting a miss because the other
     device happens to sit in a higher box is the one direction that quietly
     makes a chronically-missed question look mastered, and the miss count is
     precisely what stops a fast wrong answer being forgiven forever. */
  const review: Progress['review'] = { ...remote.review };
  for (const [qid, entry] of Object.entries(local.review)) {
    const existing = review[qid];
    const misses = Math.max(entry.misses ?? 0, existing?.misses ?? 0);
    const ahead = !existing || entry.box > existing.box ? entry : existing;
    review[qid] = misses ? { ...ahead, misses } : ahead;
  }

  const newer = (local.lastActiveDay ?? '') >= (remote.lastActiveDay ?? '') ? local : remote;

  return {
    ...remote,
    ...newer,
    version: 2,
    xp: Math.max(local.xp, remote.xp),
    tally: mergeTally(local.tally, remote.tally),
    /* Not merged: the raw log never leaves its device, so there is nothing on
       the other side to merge it with. Keep whichever one we are running on. */
    attempts: local.attempts,
    testHistory: [...tests.values()].sort((a, b) => a.at - b.at),
    notesRead: [...new Set([...remote.notesRead, ...local.notesRead])],
    achievements: [...new Set([...remote.achievements, ...local.achievements])],
    storySeen: [...new Set([...(remote.storySeen ?? []), ...(local.storySeen ?? [])])],
    oath: local.oath ?? remote.oath ?? null,
    /* First choice made wins — a second device must not relocate the traveller. */
    startRegion: local.startRegion ?? remote.startRegion ?? null,
    /* Unioned: finding something on one device cannot un-find it on another. */
    discovered: [...new Set([...(remote.discovered ?? []), ...(local.discovered ?? [])])],
    /* Same rule — bookmarking on the laptop must survive opening the phone.
       Un-bookmarking does not propagate, which is the deliberate trade: the
       cost of a stale bookmark is one extra tap, and the cost of losing a
       saved question is that the feature cannot be trusted. */
    bookmarks: [...new Set([...(remote.bookmarks ?? []), ...(local.bookmarks ?? [])])],
    zonesCleared,
    review,
    dayStreak: Math.max(local.dayStreak, remote.dayStreak),
    bestCorrectStreak: Math.max(local.bestCorrectStreak, remote.bestCorrectStreak),
    /* Counters take the max like everything else, so a shield spent on one
       device is not silently refunded by the other. */
    streakShields: Math.max(local.streakShields ?? 0, remote.streakShields ?? 0),
    /* Latest wins: doing the daily on your phone must count on your laptop. */
    dailyDoneOn:
      (local.dailyDoneOn ?? '') >= (remote.dailyDoneOn ?? '')
        ? local.dailyDoneOn
        : remote.dailyDoneOn,
    /* Taken once; whichever side has one is the one that has it. */
    diagnostic: local.diagnostic ?? remote.diagnostic ?? null,
    /* The traveller you picked is a choice, not a counter — `newer` already
       carries it, and this only guards the case where the newer side is a
       fresh install that has never chosen.

       Every candidate is validated, not just the first. Saves written before
       the hero set existed all carry the string `'cadet'`, which is not a
       hero; falling through to an unchecked `local.hero ?? remote.hero` would
       hand that dead value straight back and leave the chooser with nothing
       selected on both devices. */
    hero: [newer.hero, local.hero, remote.hero].find(isHeroId) ?? DEFAULT_HERO_ID,
    profile: newer.profile ?? local.profile ?? remote.profile,
  };
}

export function mergeTally(local: Tally, remote: Tally): Tally {
  const topics: Tally['topics'] = { ...remote.topics };
  for (const [key, t] of Object.entries(local.topics)) {
    const other = topics[key];
    topics[key] = other
      ? {
          section: t.section,
          n: Math.max(t.n, other.n),
          ok: Math.max(t.ok, other.ok),
          ms: Math.max(t.ms, other.ms),
        }
      : t;
  }

  const daily: Tally['daily'] = { ...remote.daily };
  for (const [day, n] of Object.entries(local.daily)) {
    daily[day] = Math.max(daily[day] ?? 0, n);
  }

  /* Derived from the merged topics rather than maxed on their own, so studying
     different topics on different devices adds up instead of one side winning.
     `tallyAnswer` maintains the same invariant, so this stays consistent. */
  let answered = 0;
  let correct = 0;
  for (const t of Object.values(topics)) {
    answered += t.n;
    correct += t.ok;
  }

  return { answered, correct, topics, daily: trimDaily(daily) };
}

/* -------------------------------------------------------------- achievements */

export interface Achievement {
  id: string;
  name: string;
  detail: string;
  /* Typed against the real icon set rather than left as `string`. All fifteen
     of these named an icon; none of the icons existed, so every achievement
     rendered the same ✦ and the field was decoration on a data structure. */
  icon: IconName;
  /** Which tier the badge is struck in — see `AchievementBadge`. */
  tier: 'bronze' | 'silver' | 'gold';
  test: (p: Progress) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-blood',
    name: 'First Contact',
    detail: 'Answer your first question.',
    icon: 'star',
    tier: 'bronze',
    test: (p) => p.tally.answered >= 1,
  },
  {
    id: 'ten-q',
    name: 'Warmed Up',
    detail: 'Answer 10 questions.',
    icon: 'bolt',
    tier: 'bronze',
    test: (p) => p.tally.answered >= 10,
  },
  {
    id: 'hundred-q',
    name: 'Century',
    detail: 'Answer 100 questions.',
    icon: 'sword',
    tier: 'silver',
    test: (p) => p.tally.answered >= 100,
  },
  {
    id: 'five-hundred-q',
    name: 'Grinder',
    detail: 'Answer 500 questions.',
    icon: 'flame',
    tier: 'gold',
    test: (p) => p.tally.answered >= 500,
  },
  {
    id: 'streak-10',
    name: 'On Fire',
    detail: 'Get 10 correct in a row.',
    icon: 'flame',
    tier: 'bronze',
    test: (p) => p.bestCorrectStreak >= 10,
  },
  {
    id: 'streak-25',
    name: 'Untouchable',
    detail: 'Get 25 correct in a row.',
    icon: 'flame',
    tier: 'silver',
    test: (p) => p.bestCorrectStreak >= 25,
  },
  {
    id: 'reader-10',
    name: 'Well Read',
    detail: 'Finish 10 note pages.',
    icon: 'book',
    tier: 'bronze',
    test: (p) => p.notesRead.length >= 10,
  },
  {
    id: 'reader-all',
    name: 'The Archive',
    detail: 'Finish every note page.',
    icon: 'book',
    tier: 'gold',
    test: (p) => p.notesRead.length >= 60,
  },
  {
    id: 'zone-5',
    name: 'Trailblazer',
    detail: 'Clear 5 zones.',
    icon: 'map',
    tier: 'bronze',
    test: (p) => Object.keys(p.zonesCleared).length >= 5,
  },
  {
    id: 'zone-all',
    name: 'Cartographer',
    detail: 'Clear every zone.',
    icon: 'map',
    tier: 'gold',
    test: (p) => Object.keys(p.zonesCleared).length >= 37,
  },
  {
    id: 'first-test',
    name: 'Boss Slain',
    detail: 'Finish a full-length test.',
    icon: 'trophy',
    tier: 'silver',
    test: (p) => p.testHistory.length >= 1,
  },
  {
    id: 'day-7',
    name: 'Week Streak',
    detail: 'Study 7 days in a row.',
    icon: 'calendar',
    tier: 'bronze',
    test: (p) => p.dayStreak >= 7,
  },
  {
    id: 'day-30',
    name: 'Unbreakable',
    detail: 'Study 30 days in a row.',
    icon: 'calendar',
    tier: 'gold',
    test: (p) => p.dayStreak >= 30,
  },
  /* The two rank achievements. Their `id`s stay as they are: an id is what a
     saved profile already holds, and renaming one would hand every existing
     student a fresh "achievement unlocked" for something they earned months
     ago. The names and thresholds read off RANKS instead of repeating it —
     they were hardcoded 2400 and 13500, which is two more places for a
     threshold change to be half-applied. */
  {
    id: 'rank-honors',
    name: rankById('torchbearer').name,
    detail: `Reach the ${rankById('torchbearer').name} rank.`,
    icon: 'trophy',
    tier: 'silver',
    test: (p) => p.xp >= rankById('torchbearer').xp,
  },
  {
    id: 'rank-elite',
    name: rankById('greybane').name,
    detail: `Reach the ${rankById('greybane').name} rank.`,
    icon: 'trophy',
    tier: 'gold',
    test: (p) => p.xp >= rankById('greybane').xp,
  },
];

/** Returns any achievements newly satisfied by this state. */
export function checkAchievements(p: Progress): Achievement[] {
  return ACHIEVEMENTS.filter((a) => !p.achievements.includes(a.id) && a.test(p));
}
