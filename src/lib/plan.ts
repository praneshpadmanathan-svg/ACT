/* The study plan.

   Onboarding has always asked when the test is and what score you want, then
   written a `weeklyGoal` that **nothing in the app ever read**. You told it your
   date and it said nothing back. This is the part that answers.

   Three questions, in the order a student actually asks them: how long have I
   got, am I doing enough this week, and what should I do right now. */

import { TOPICS_BY_SECTION } from '@/content';
import type { Progress, SectionId } from '@/types';
import { dayKey, dueForReview, weakestTopics } from './progress';
import { canonicalTopic } from './utils';

/* ------------------------------------------------------------- the calendar */

/** Whole days from today until the test. Negative once it has been sat. */
export function daysUntilTest(p: Progress, today: Date = new Date()): number | null {
  const date = p.profile?.testDate;
  if (!date) return null;
  const target = new Date(`${date}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - start.getTime()) / 86_400_000);
}

/** How urgent things are, for wording and colour. */
export function testUrgency(days: number | null): 'none' | 'past' | 'close' | 'soon' | 'far' {
  if (days === null) return 'none';
  if (days < 0) return 'past';
  if (days <= 14) return 'close';
  if (days <= 60) return 'soon';
  return 'far';
}

/* ---------------------------------------------------------------- this week */

export interface WeekProgress {
  /** Questions answered in the last seven days, today included. */
  answered: number;
  goal: number;
  pct: number;
  /** Days in the last seven with any activity at all. */
  activeDays: number;
}

/* Measured in questions rather than XP.

   The goal used to be an XP number, which is a currency the app invented and a
   student has no feel for — "1,800 XP this week" means nothing until you have
   played for a month. Questions answered is the thing they are actually doing,
   it is legible on sight, and it cannot be inflated by a lucky streak bonus. */
export function weekProgress(p: Progress, today: Date = new Date()): WeekProgress {
  let answered = 0;
  let activeDays = 0;
  for (let i = 0; i < 7; i++) {
    const day = dayKey(new Date(today.getTime() - i * 86_400_000));
    const n = p.tally.daily[day] ?? 0;
    answered += n;
    if (n > 0) activeDays += 1;
  }
  const goal = Math.max(1, p.weeklyGoal);
  return { answered, goal, pct: Math.min(1, answered / goal), activeDays };
}

/** A weekly target in questions, from how close the test is. */
export function goalForTiming(when: NonNullable<Progress['profile']>['when']): number {
  return { soon: 150, mid: 110, far: 75, none: 50 }[when] ?? 75;
}

/* --------------------------------------------------------------- today's work */

export type PlanStepKind = 'review' | 'zone' | 'drill' | 'test';

export interface PlanStep {
  kind: PlanStepKind;
  title: string;
  detail: string;
  minutes: number;
  /** Where the button goes. */
  to:
    | { name: 'review' }
    | { name: 'zone'; zone: string }
    | { name: 'drill'; section: SectionId; topic?: string }
    | { name: 'tests' };
}

/** Roughly how long a question takes, averaged across sections. */
const MINUTES_PER_QUESTION = 0.75;

/**
 * The first topic from the placement test that is still worth drilling.
 *
 * `DiagnosticResult.weakTopics` is a list of names with no section attached,
 * so the section is recovered from the content library. Anything the student
 * has since answered three times is dropped: once there is real evidence the
 * diagnostic's one-question verdict has been superseded, and holding on to it
 * would keep pointing at a topic they have already fixed.
 */
export function coldStartTopic(p: Progress): { section: SectionId; topic: string } | null {
  const weakTopics = p.diagnostic?.weakTopics;
  if (!weakTopics?.length) return null;

  for (const raw of weakTopics) {
    const topic = canonicalTopic(raw);
    const section = topicSection(topic);
    if (!section) continue;
    const answered = p.tally.topics[`${section}::${topic}`]?.n ?? 0;
    if (answered < 3) return { section, topic };
  }
  return null;
}

function topicSection(topic: string): SectionId | null {
  for (const [section, topics] of Object.entries(TOPICS_BY_SECTION)) {
    if (topics.some((t) => canonicalTopic(t) === topic)) return section as SectionId;
  }
  return null;
}

export interface TodaysPlan {
  steps: PlanStep[];
  minutes: number;
  /** Already met today's share of the weekly goal. */
  done: boolean;
  answeredToday: number;
  targetToday: number;
}

/**
 * What to do in the next twenty-odd minutes.
 *
 * Ordered by what pays most, not by what is nearest: anything due for review
 * comes first, because a question you got wrong and never saw again is the most
 * expensive thing in a study plan. Then the road you are on, then the topic
 * hurting your score. Once the map is finished the only thing left is the trial.
 */
export function todaysPlan(
  p: Progress,
  currentZone: { id: string; name: string } | null,
  today: Date = new Date(),
): TodaysPlan {
  const steps: PlanStep[] = [];

  const due = dueForReview(p).length;
  if (due > 0) {
    steps.push({
      kind: 'review',
      title: `Review ${due} question${due === 1 ? '' : 's'}`,
      detail: 'Questions you missed, back at the right moment to make them stick.',
      minutes: Math.max(2, Math.round(due * MINUTES_PER_QUESTION)),
      to: { name: 'review' },
    });
  }

  if (currentZone) {
    steps.push({
      kind: 'zone',
      title: currentZone.name,
      detail: 'A short lesson, then the quiz that clears the landmark.',
      minutes: 12,
      to: { name: 'zone', zone: currentZone.id },
    });
  } else {
    steps.push({
      kind: 'test',
      title: 'The full timed trial',
      detail: 'Every landmark is cleared. All that is left is the summit.',
      minutes: 83,
      to: { name: 'tests' },
    });
  }

  const weak = weakestTopics(p, 1)[0];
  if (weak && weak.section !== 'zone') {
    steps.push({
      kind: 'drill',
      title: `Drill ${weak.topic}`,
      detail: `${Math.round(weak.accuracy * 100)}% so far — your weakest topic with enough answers to be sure.`,
      minutes: 8,
      to: { name: 'drill', section: weak.section, topic: weak.topic },
    });
  } else {
    /* Cold start.
     *
     * `weakestTopics` needs three attempts in a topic before it will name it,
     * which is correct — two answers is a coin flip — but it means the plan is
     * silent for the first week, which is exactly when a student most needs to
     * be told where to go. The diagnostic exists to fill that gap and its
     * `weakTopics` list is deliberately strict enough to trust here. */
    const cold = coldStartTopic(p);
    if (cold) {
      steps.push({
        kind: 'drill',
        title: `Drill ${cold.topic}`,
        detail: 'From your placement test — you did not get one of these right yet.',
        minutes: 8,
        to: { name: 'drill', section: cold.section, topic: cold.topic },
      });
    }
  }

  const { goal } = weekProgress(p, today);
  const targetToday = Math.max(5, Math.round(goal / 7));
  const answeredToday = p.tally.daily[dayKey(today)] ?? 0;

  return {
    steps,
    minutes: steps.reduce((n, s) => n + s.minutes, 0),
    done: answeredToday >= targetToday,
    answeredToday,
    targetToday,
  };
}
