/* The daily challenge — five questions, once a day.
 *
 * *"There is nothing to do in 90 seconds. No daily question, no quick hit —
 * the smallest unit of engagement is a whole drill."*
 *
 * `progress.ts` already had the scoring half of this (`DAILY_SIZE`,
 * `dailyDone`, `completeDaily`, `XP.dailyChallenge`) and nothing that chose
 * the questions, so the feature was a constant with an XP value and no way to
 * earn it. This module is the missing half. It lives outside `progress.ts`
 * because it needs the content library, and `progress.ts` is deliberately
 * almost content-free so it stays cheap to test.
 *
 * The selection is ordered, not random:
 *
 *   1. whatever is due for review, hardest-earned first — a student's own
 *      misses are always the best five questions available to them;
 *   2. topped up from their weakest topics, excluding anything already
 *      scheduled for review, because a question in the review ladder has a
 *      date and pulling it forward here quietly resets that schedule;
 *   3. topped up from the whole bank, for a first-day student who has neither.
 *
 * Stable for the whole calendar day. A daily challenge that reshuffles when
 * you refresh is not a daily challenge, and the seed is the day key so it
 * needs nothing stored.
 */

import { ALL_QUESTIONS, getQuestion } from '@/content';
import { DAILY_SIZE, dayKey, dueForReview, weakestTopics } from './progress';
import type { Progress, Question } from '@/types';

/** A small deterministic hash, so a day key becomes a shuffle seed. */
function seedFrom(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — four lines, good enough to pick five questions with. */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleSeeded<T>(items: readonly T[], next: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * The five questions for today. Deterministic for a given progress state and
 * calendar day, so a refresh mid-challenge does not hand out a new set.
 *
 * `day` is injectable for the tests; nothing in the app passes it.
 */
export function pickDaily(p: Progress, day: string = dayKey()): Question[] {
  const picked: Question[] = [];
  const seen = new Set<string>();

  const take = (q: Question | undefined) => {
    if (!q || seen.has(q.id) || picked.length >= DAILY_SIZE) return;
    seen.add(q.id);
    picked.push(q);
  };

  // 1. Due reviews, in the order the review queue already ranks them.
  for (const qid of dueForReview(p)) take(getQuestion(qid));
  if (picked.length >= DAILY_SIZE) return picked;

  const next = rng(seedFrom(day));

  /* Anything already in the review ladder but not yet due is off limits for
     the filler steps. Answering it here runs it through `scheduleReview` and
     moves a date the student cannot see — pulling a question forward out of
     its own schedule is the one way this feature could quietly make the app
     worse at its job. Due questions are exempt, obviously: step 1 wants them. */
  const unscheduled = ALL_QUESTIONS.filter((q) => !(q.id in p.review));

  // 2. Weakest topics.
  const weak = new Set(weakestTopics(p, 6).map((t) => t.topic));
  if (weak.size > 0) {
    for (const q of shuffleSeeded(
      unscheduled.filter((q) => weak.has(q.topic)),
      next,
    ))
      take(q);
    if (picked.length >= DAILY_SIZE) return picked;
  }

  // 3. Day one: no misses, no weak topics, so anything unseen will do.
  for (const q of shuffleSeeded(unscheduled, next)) take(q);
  if (picked.length >= DAILY_SIZE) return picked;

  /* 4. Only reachable by a student who has every question in the bank on a
     review schedule — six hundred-odd questions in. At that point a short
     challenge beats reaching into their schedule, so this stops here rather
     than topping up from the ladder. */
  return picked;
}

/** Why today's five look the way they do — one line, shown above the set. */
export function dailyBlurb(p: Progress): string {
  const due = dueForReview(p).length;
  if (due >= DAILY_SIZE) return 'Five questions you have missed before.';
  if (due > 0) return `${due} you have missed before, plus a few from your weak spots.`;
  if (weakestTopics(p, 6).length > 0) return 'Five from the topics costing you the most.';
  return 'Five to start with. Tomorrow they will be aimed at your weak spots.';
}
