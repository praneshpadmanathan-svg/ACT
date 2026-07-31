/* The progress model: XP, ranks, streaks, spaced repetition and score
   estimation. Pure functions over a single serialisable `Progress` object,
   so it can be persisted locally and synced to Supabase without ceremony. */

import type { Attempt, Difficulty, Progress, SectionId, Tally, TestResult } from '@/types';
import { TOPIC_BY_ZONE_ALIAS } from '@/content';
import { readJSON, STORAGE_KEYS, writeJSON } from './storage';
import { canonicalTopic } from './utils';

/* ------------------------------------------------------------------- ranks */

export interface Rank {
  name: string;
  xp: number;
  color: string;
  /** Badge gradient stops. */
  c1: string;
  c2: string;
  ring: string;
  tagline: string;
}

export const RANKS: Rank[] = [
  { name: 'Recruit', xp: 0, c1: '#e58a4e', c2: '#a4551f', ring: '#ffb877', color: '#e58a4e', tagline: 'Every 36 starts here.' },
  { name: 'Scholar', xp: 900, c1: '#eef3fb', c2: '#9fb2cc', ring: '#ffffff', color: '#cdd9ec', tagline: 'The habit is forming.' },
  { name: 'Honors', xp: 2400, c1: '#ffe07a', c2: '#dfa018', ring: '#fff3b0', color: '#ffd23e', tagline: 'Consistency is your edge.' },
  { name: 'Distinction', xp: 4800, c1: '#63f0e0', c2: '#1c94ab', ring: '#b6fff5', color: '#43e0e0', tagline: 'Precision under pressure.' },
  { name: 'Vanguard', xp: 8400, c1: '#c8aaff', c2: '#7a4fd0', ring: '#e6d8ff', color: '#c6a8ff', tagline: 'Few make it this far.' },
  { name: 'Elite', xp: 13500, c1: '#ff8ec2', c2: '#d43f8c', ring: '#ffc9e5', color: '#ff8ec2', tagline: 'Top-decile territory.' },
  { name: 'Perfect 36', xp: 21000, c1: '#ffe36e', c2: '#ff8c3b', ring: '#fff3b0', color: '#ffe36e', tagline: 'Nothing left to miss.' },
];

export function rankIndexFor(xp: number): number {
  let idx = 0;
  for (let i = 0; i < RANKS.length; i++) if (xp >= RANKS[i].xp) idx = i;
  return idx;
}

export function rankFor(xp: number): Rank {
  return RANKS[rankIndexFor(xp)];
}

/** Progress through the current rank, 0-1. Maxes out at the top rank. */
export function rankProgress(xp: number): { pct: number; into: number; span: number; next: Rank | null } {
  const i = rankIndexFor(xp);
  const next = RANKS[i + 1] ?? null;
  if (!next) return { pct: 1, into: 0, span: 0, next: null };
  const span = next.xp - RANKS[i].xp;
  const into = xp - RANKS[i].xp;
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
    hero: 'cadet',
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
  for (const k of kept) out[k] = daily[k];
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
  const legacyJourney = readJSON<{ done?: Record<string, boolean> }>(STORAGE_KEYS.legacyJourney, {});
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
    if (typeof legacy.bestCorrectStreak === 'number') next.bestCorrectStreak = legacy.bestCorrectStreak;
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

/** Bump the day streak if this is the first activity today. */
export function touchDayStreak(p: Progress): Progress {
  const today = dayKey();
  if (p.lastActiveDay === today) return p;

  const yesterday = dayKey(new Date(Date.now() - 86_400_000));
  const dayStreak = p.lastActiveDay === yesterday ? p.dayStreak + 1 : 1;
  return { ...p, dayStreak, lastActiveDay: today };
}

/* ------------------------------------------------- spaced repetition (review) */

/** Leitner boxes, in days. A missed question resets to box 0. */
const BOX_INTERVALS = [0, 1, 3, 7, 16, 35];

export function scheduleReview(
  review: Progress['review'],
  qid: string,
  correct: boolean,
): Progress['review'] {
  const existing = review[qid];
  const box = correct ? Math.min((existing?.box ?? 0) + 1, BOX_INTERVALS.length - 1) : 0;

  // Once a question graduates the last box it leaves the review queue.
  if (correct && box === BOX_INTERVALS.length - 1 && existing) {
    const { [qid]: _drop, ...rest } = review;
    return rest;
  }
  return { ...review, [qid]: { box, due: Date.now() + BOX_INTERVALS[box] * 86_400_000 } };
}

export function dueForReview(p: Progress): string[] {
  const now = Date.now();
  return Object.entries(p.review)
    .filter(([, v]) => v.due <= now)
    .sort((a, b) => a[1].due - b[1].due)
    .map(([qid]) => qid);
}

/* ------------------------------------------------------------ recording work */

export interface RecordResult {
  progress: Progress;
  xpGained: number;
  rankedUp: boolean;
  newRankIndex: number;
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

  let next: Progress = {
    ...p,
    xp: p.xp + xpGained,
    tally: tallyAnswer(p.tally, attempt),
    // Local-only recent log; the durable count lives in the tally.
    attempts: [...p.attempts, { ...attempt, at: Date.now() }].slice(-RECENT_ATTEMPTS),
    currentCorrectStreak,
    bestCorrectStreak: Math.max(p.bestCorrectStreak, currentCorrectStreak),
    review: scheduleReview(p.review, attempt.qid, attempt.correct),
  };
  next = touchDayStreak(next);

  const afterRank = rankIndexFor(next.xp);
  return {
    progress: next,
    xpGained,
    rankedUp: afterRank > beforeRank,
    newRankIndex: afterRank,
  };
}

export function awardXP(p: Progress, amount: number): RecordResult {
  const beforeRank = rankIndexFor(p.xp);
  const next = touchDayStreak({ ...p, xp: p.xp + amount });
  const afterRank = rankIndexFor(next.xp);
  return { progress: next, xpGained: amount, rankedUp: afterRank > beforeRank, newRankIndex: afterRank };
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

export function sectionAccuracy(p: Progress, section: SectionId): { n: number; ok: number; pct: number } {
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
    [0, 1], [0.1, 8], [0.2, 12], [0.3, 15], [0.4, 18], [0.5, 21],
    [0.6, 23], [0.7, 26], [0.8, 29], [0.88, 32], [0.94, 34], [0.98, 35], [1, 36],
  ];
  for (let i = table.length - 1; i >= 0; i--) {
    if (pct >= table[i][0]) {
      const [lowPct, lowScore] = table[i];
      const upper = table[i + 1];
      if (!upper) return lowScore;
      const t = (pct - lowPct) / (upper[0] - lowPct);
      return Math.round(lowScore + t * (upper[1] - lowScore));
    }
  }
  return 1;
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

export function recordTest(p: Progress, result: TestResult): RecordResult {
  const beforeRank = rankIndexFor(p.xp);
  const gain = result.sections.length === 4 ? XP.fullTest : XP.testSection * result.sections.length;
  const next = touchDayStreak({
    ...p,
    xp: p.xp + gain,
    testHistory: [...p.testHistory, result],
  });
  const afterRank = rankIndexFor(next.xp);
  return { progress: next, xpGained: gain, rankedUp: afterRank > beforeRank, newRankIndex: afterRank };
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

  // Keep whichever review schedule is further along per question.
  const review: Progress['review'] = { ...remote.review };
  for (const [qid, entry] of Object.entries(local.review)) {
    const existing = review[qid];
    review[qid] = !existing || entry.box > existing.box ? entry : existing;
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
    zonesCleared,
    review,
    dayStreak: Math.max(local.dayStreak, remote.dayStreak),
    bestCorrectStreak: Math.max(local.bestCorrectStreak, remote.bestCorrectStreak),
    profile: newer.profile ?? local.profile ?? remote.profile,
  };
}

export function mergeTally(local: Tally, remote: Tally): Tally {
  const topics: Tally['topics'] = { ...remote.topics };
  for (const [key, t] of Object.entries(local.topics)) {
    const other = topics[key];
    topics[key] = other
      ? { section: t.section, n: Math.max(t.n, other.n), ok: Math.max(t.ok, other.ok), ms: Math.max(t.ms, other.ms) }
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
  icon: string;
  test: (p: Progress) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-blood', name: 'First Contact', detail: 'Answer your first question.', icon: 'star', test: (p) => p.tally.answered >= 1 },
  { id: 'ten-q', name: 'Warmed Up', detail: 'Answer 10 questions.', icon: 'bolt', test: (p) => p.tally.answered >= 10 },
  { id: 'hundred-q', name: 'Century', detail: 'Answer 100 questions.', icon: 'sword', test: (p) => p.tally.answered >= 100 },
  { id: 'five-hundred-q', name: 'Grinder', detail: 'Answer 500 questions.', icon: 'flame', test: (p) => p.tally.answered >= 500 },
  { id: 'streak-10', name: 'On Fire', detail: 'Get 10 correct in a row.', icon: 'flame', test: (p) => p.bestCorrectStreak >= 10 },
  { id: 'streak-25', name: 'Untouchable', detail: 'Get 25 correct in a row.', icon: 'flame', test: (p) => p.bestCorrectStreak >= 25 },
  { id: 'reader-10', name: 'Well Read', detail: 'Finish 10 note pages.', icon: 'book', test: (p) => p.notesRead.length >= 10 },
  { id: 'reader-all', name: 'The Archive', detail: 'Finish every note page.', icon: 'book', test: (p) => p.notesRead.length >= 60 },
  { id: 'zone-5', name: 'Trailblazer', detail: 'Clear 5 zones.', icon: 'map', test: (p) => Object.keys(p.zonesCleared).length >= 5 },
  { id: 'zone-all', name: 'Cartographer', detail: 'Clear every zone.', icon: 'map', test: (p) => Object.keys(p.zonesCleared).length >= 37 },
  { id: 'first-test', name: 'Boss Slain', detail: 'Finish a full-length test.', icon: 'trophy', test: (p) => p.testHistory.length >= 1 },
  { id: 'day-7', name: 'Week Streak', detail: 'Study 7 days in a row.', icon: 'calendar', test: (p) => p.dayStreak >= 7 },
  { id: 'day-30', name: 'Unbreakable', detail: 'Study 30 days in a row.', icon: 'calendar', test: (p) => p.dayStreak >= 30 },
  { id: 'rank-honors', name: 'Honors', detail: 'Reach the Honors rank.', icon: 'trophy', test: (p) => p.xp >= 2400 },
  { id: 'rank-elite', name: 'Elite', detail: 'Reach the Elite rank.', icon: 'trophy', test: (p) => p.xp >= 13500 },
];

/** Returns any achievements newly satisfied by this state. */
export function checkAchievements(p: Progress): Achievement[] {
  return ACHIEVEMENTS.filter((a) => !p.achievements.includes(a.id) && a.test(p));
}
