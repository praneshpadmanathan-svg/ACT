/* The progress model: XP, ranks, streaks, spaced repetition and score
   estimation. Pure functions over a single serialisable `Progress` object,
   so it can be persisted locally and synced to Supabase without ceremony. */

import type { Attempt, Difficulty, Progress, SectionId, TestResult } from '@/types';
import { readJSON, STORAGE_KEYS, writeJSON } from './storage';

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

export function emptyProgress(): Progress {
  return {
    version: 2,
    xp: 0,
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
    weeklyGoal: 1800,
    profile: null,
    hero: 'cadet',
    review: {},
  };
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
  if (current.xp > 0 || current.attempts.length > 0) return current;

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

export function loadProgress(): Progress {
  const stored = readJSON<Partial<Progress> | null>(STORAGE_KEYS.progress, null);
  const base = emptyProgress();
  const merged: Progress = stored ? { ...base, ...stored, version: 2 } : base;
  // Guard every collection — a half-written object should not crash a render.
  merged.attempts = Array.isArray(merged.attempts) ? merged.attempts : [];
  merged.notesRead = Array.isArray(merged.notesRead) ? merged.notesRead : [];
  merged.testHistory = Array.isArray(merged.testHistory) ? merged.testHistory : [];
  merged.achievements = Array.isArray(merged.achievements) ? merged.achievements : [];
  merged.zonesCleared = merged.zonesCleared ?? {};
  merged.review = merged.review ?? {};
  return stored ? merged : migrateLegacy(merged);
}

export function saveProgress(p: Progress): void {
  writeJSON(STORAGE_KEYS.progress, p);
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
    attempts: [...p.attempts, { ...attempt, at: Date.now() }].slice(-4000),
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

export function topicStats(p: Progress, section?: SectionId): TopicStat[] {
  const buckets = new Map<string, { section: SectionId | 'zone'; n: number; ok: number; ms: number }>();
  for (const a of p.attempts) {
    if (section && a.section !== section) continue;
    const key = `${a.section}::${a.topic}`;
    const b = buckets.get(key) ?? { section: a.section, n: 0, ok: 0, ms: 0 };
    b.n += 1;
    if (a.correct) b.ok += 1;
    b.ms += a.ms;
    buckets.set(key, b);
  }
  return [...buckets.entries()]
    .map(([key, b]) => ({
      topic: key.split('::')[1],
      section: b.section,
      attempts: b.n,
      correct: b.ok,
      accuracy: b.n ? b.ok / b.n : 0,
      avgSeconds: b.n ? b.ms / b.n / 1000 : 0,
    }))
    .sort((a, b) => a.accuracy - b.accuracy);
}

export function sectionAccuracy(p: Progress, section: SectionId): { n: number; ok: number; pct: number } {
  let n = 0;
  let ok = 0;
  for (const a of p.attempts) {
    if (a.section !== section) continue;
    n += 1;
    if (a.correct) ok += 1;
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

/* -------------------------------------------------------------- achievements */

export interface Achievement {
  id: string;
  name: string;
  detail: string;
  icon: string;
  test: (p: Progress) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-blood', name: 'First Contact', detail: 'Answer your first question.', icon: 'star', test: (p) => p.attempts.length >= 1 },
  { id: 'ten-q', name: 'Warmed Up', detail: 'Answer 10 questions.', icon: 'bolt', test: (p) => p.attempts.length >= 10 },
  { id: 'hundred-q', name: 'Century', detail: 'Answer 100 questions.', icon: 'sword', test: (p) => p.attempts.length >= 100 },
  { id: 'five-hundred-q', name: 'Grinder', detail: 'Answer 500 questions.', icon: 'flame', test: (p) => p.attempts.length >= 500 },
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
