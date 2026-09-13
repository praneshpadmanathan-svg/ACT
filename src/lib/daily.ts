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

import { ALL_QUESTIONS } from '@/content';
import { DAILY_SIZE, dayKey, dueForReview, weakestTopics } from './progress';
import { fromDrillQuestion, runnableById } from './normalize';
import type { RunnableQuestion } from '@/components/QuestionRunner';
import type { Progress, SectionId } from '@/types';

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
 * `allowed` narrows the pool to a set of subjects. It exists because the
 * daily is the one screen that reaches across every section at once, which
 * made it a side door: on the free tier, step 3 would happily serve Math
 * questions from a road the student cannot open. Passing the list in keeps
 * this module free of any notion of entitlement — it is told which subjects
 * count, not asked to work it out. Omit it and nothing is filtered, which is
 * both the old behaviour and what a Pro student gets.
 *
 * `day` is injectable for the tests; nothing in the app passes it.
 */
export function pickDaily(
  p: Progress,
  day: string = dayKey(),
  allowed?: readonly SectionId[],
): RunnableQuestion[] {
  const picked: RunnableQuestion[] = [];
  const seen = new Set<string>();

  const permitted = (section: string) => !allowed || allowed.includes(section as SectionId);

  const take = (q: RunnableQuestion | undefined) => {
    if (!q || seen.has(q.id) || picked.length >= DAILY_SIZE) return;
    if (!permitted(q.section)) return;
    seen.add(q.id);
    picked.push(q);
  };

  /* 1. Due reviews, in the order the review queue already ranks them.

     Through `runnableById` rather than `getQuestion`, so a landmark question
     the student missed can actually turn up here. `getQuestion` reads the
     drill bank only, which meant every zone review silently evaporated at
     this line while still being counted in the "N due" the blurb prints. */
  for (const qid of dueForReview(p)) take(runnableById(qid));
  if (picked.length >= DAILY_SIZE) return picked;

  const next = rng(seedFrom(day));

  /* Anything already in the review ladder but not yet due is off limits for
     the filler steps. Answering it here runs it through `scheduleReview` and
     moves a date the student cannot see — pulling a question forward out of
     its own schedule is the one way this feature could quietly make the app
     worse at its job. Due questions are exempt, obviously: step 1 wants them. */
  const unscheduled = ALL_QUESTIONS.filter((q) => !(q.id in p.review) && permitted(q.section));

  // 2. Weakest topics.
  const weak = new Set(weakestTopics(p, 6).map((t) => t.topic));
  if (weak.size > 0) {
    for (const q of shuffleSeeded(
      unscheduled.filter((q) => weak.has(q.topic)),
      next,
    ))
      take(fromDrillQuestion(q));
    if (picked.length >= DAILY_SIZE) return picked;
  }

  /* 3. Day one: no misses, no weak topics, so anything unseen will do.

     Steps 2 and 3 stay on the drill bank. A landmark question belongs to a
     landmark you walk to, and handing one out here would let a student answer
     it away from the Study tab without the zone ever registering it. */
  for (const q of shuffleSeeded(unscheduled, next)) take(fromDrillQuestion(q));
  if (picked.length >= DAILY_SIZE) return picked;

  /* 4. Only reachable by a student who has every question in the bank on a
     review schedule — six hundred-odd questions in. At that point a short
     challenge beats reaching into their schedule, so this stops here rather
     than topping up from the ladder. */
  return picked;
}

/** Why today's five look the way they do — one line, shown above the set. */
export function dailyBlurb(p: Progress, allowed?: readonly SectionId[]): string {
  /* Counted the same way `pickDaily` picks, or the line above the set
     describes a different five questions than the ones below it. */
  const due = dueForReview(p)
    .map(runnableById)
    .filter((q) => q && (!allowed || allowed.includes(q.section as SectionId))).length;
  if (due >= DAILY_SIZE) return 'Five questions you have missed before.';
  if (due > 0) return `${due} you have missed before, plus a few from your weak spots.`;
  if (weakestTopics(p, 6).length > 0) return 'Five from the topics costing you the most.';
  return 'Five to start with. Tomorrow they will be aimed at your weak spots.';
}
