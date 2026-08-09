/* Tests for the learning rules added in the ten-perspective review pass.
 *
 * `progress.test.ts` pins behaviour that already existed and must not drift.
 * This file pins behaviour that is *new* — the response-time-aware review
 * ladder, the streak shields, percentiles, pacing and the daily challenge —
 * and it exists as a separate file for one reason: every rule in here is a
 * judgement call about how a student should be treated, not a mechanical
 * invariant. When one of these tests fails, the right question is usually
 * "did we mean to change the rule?" rather than "what did we break?".
 *
 * The interesting cases are the boundaries, because that is where a rule
 * stops being a sentence in a comment and starts being arithmetic: 24.9s vs
 * 25.1s, the third miss, the day a shield is spent.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { Progress, SectionId, TestResult } from '@/types';
import { ALL_QUESTIONS, SECTIONS, getQuestion } from '@/content';
import { dailyBlurb, pickDaily } from './daily';
import {
  diagnosticLength,
  pickDiagnostic,
  placementShape,
  scoreDiagnostic,
} from './diagnostic';
import { coldStartTopic, todaysPlan } from './plan';
import {
  DAILY_SIZE,
  SECONDS_PER_QUESTION,
  applyDayStreak,
  comingDue,
  completeDaily,
  dailyDone,
  daysBetween,
  dayKey,
  dueForReview,
  emptyProgress,
  mergeProgress,
  paceHint,
  pacingFor,
  percentileFor,
  percentileInWords,
  scheduleReview,
  trackStatus,
} from './progress';

function progress(overrides: Partial<Progress> = {}): Progress {
  return { ...emptyProgress(), ...overrides };
}

/** A day key `n` days before today, in the same local-noon terms the app uses. */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dayKey(d);
}

const DAY = 86_400_000;

beforeEach(() => {
  localStorage.clear();
});

/* ------------------------------------------------- the review ladder */

describe('scheduleReview — response time changes the transition', () => {
  it('advances two boxes for a fast correct answer and one for a slow one', () => {
    const fast = scheduleReview({}, 'q1', true, 5_000);
    const slow = scheduleReview({}, 'q1', true, 90_000);
    expect(fast['q1']!.box).toBe(2);
    expect(slow['q1']!.box).toBe(1);
  });

  it('treats a fast wrong answer as a slip: down one box, not to zero', () => {
    const at3 = { q1: { box: 3, due: 0, misses: 0 } };
    expect(scheduleReview(at3, 'q1', false, 4_000)['q1']!.box).toBe(2);
    expect(scheduleReview(at3, 'q1', false, 90_000)['q1']!.box).toBe(0);
  });

  it('stops forgiving fast wrong answers once a question has been missed three times', () => {
    /* Three misses is the line between a slip and a misconception. A
       confidently-held wrong belief is answered just as fast as a mis-click,
       so speed alone cannot tell them apart — only the count can. */
    const nearlyChronic = { q1: { box: 3, due: 0, misses: 2 } };
    const chronic = { q1: { box: 3, due: 0, misses: 3 } };
    expect(scheduleReview(nearlyChronic, 'q1', false, 4_000)['q1']!.box).toBe(2);
    expect(scheduleReview(chronic, 'q1', false, 4_000)['q1']!.box).toBe(0);
  });

  it('holds the FAST_MS boundary at 25 seconds', () => {
    expect(scheduleReview({}, 'q1', true, 24_999)['q1']!.box).toBe(2);
    expect(scheduleReview({}, 'q1', true, 25_000)['q1']!.box).toBe(1);
  });

  it('never treats a missing or zero response time as fast', () => {
    /* `ms` is 0 when a question was never timed — an import, a restored
       session, a bug upstream. Reading that as "answered instantly" would
       silently push half a student's deck two boxes out. */
    expect(scheduleReview({}, 'q1', true, 0)['q1']!.box).toBe(1);
    expect(scheduleReview({}, 'q1', true)['q1']!.box).toBe(1);
  });

  it('counts every miss and never decrements the count on a correct answer', () => {
    let review = scheduleReview({}, 'q1', false, 90_000);
    review = scheduleReview(review, 'q1', false, 90_000);
    review = scheduleReview(review, 'q1', true, 90_000);
    expect(review['q1']!.misses).toBe(2);
  });

  it('retires a question that graduates the top box', () => {
    let review = scheduleReview({}, 'q1', true, 5_000); // box 2
    review = scheduleReview(review, 'q1', true, 5_000); // box 4
    expect(review['q1']!.box).toBe(4);
    review = scheduleReview(review, 'q1', true, 5_000); // box 5 = top → gone
    expect(review['q1']).toBeUndefined();
  });

  it('sets the due date from the box interval', () => {
    const now = Date.now();
    const review = scheduleReview({}, 'q1', true, 90_000); // box 1 = tomorrow
    expect(review['q1']!.due - now).toBeGreaterThanOrEqual(DAY - 1000);
    expect(review['q1']!.due - now).toBeLessThanOrEqual(DAY + 1000);
  });
});

describe('dueForReview — the hardest questions come first', () => {
  it('sorts by miss count before due date', () => {
    const p = progress({
      review: {
        easy: { box: 0, due: 1, misses: 0 },       // oldest due
        hard: { box: 0, due: 2_000, misses: 4 },
        medium: { box: 0, due: 1_500, misses: 1 },
      },
    });
    expect(dueForReview(p)).toEqual(['hard', 'medium', 'easy']);
  });

  it('breaks ties on due date, oldest first', () => {
    const p = progress({
      review: {
        later: { box: 0, due: 5_000, misses: 2 },
        earlier: { box: 0, due: 1_000, misses: 2 },
      },
    });
    expect(dueForReview(p)).toEqual(['earlier', 'later']);
  });

  it('excludes anything not yet due, and counts it as coming up instead', () => {
    const p = progress({
      review: {
        due: { box: 0, due: Date.now() - 1000, misses: 0 },
        tomorrow: { box: 1, due: Date.now() + DAY, misses: 0 },
        nextMonth: { box: 4, due: Date.now() + 30 * DAY, misses: 0 },
      },
    });
    expect(dueForReview(p)).toEqual(['due']);
    expect(comingDue(p, 3)).toBe(1);
    expect(comingDue(p, 60)).toBe(2);
  });
});

/* ------------------------------------------------------ streak shields */

describe('applyDayStreak', () => {
  it('does nothing at all on a second visit the same day', () => {
    const p = progress({ dayStreak: 4, lastActiveDay: dayKey() });
    const { progress: next, shieldsSpent } = applyDayStreak(p);
    expect(next).toBe(p); // identity, not just equality — no wasted write
    expect(shieldsSpent).toBe(0);
  });

  it('extends the streak when yesterday was the last active day', () => {
    const { progress: next } = applyDayStreak(
      progress({ dayStreak: 4, lastActiveDay: daysAgo(1) }),
    );
    expect(next.dayStreak).toBe(5);
  });

  it('spends a shield to bridge one missed day, and says how many it spent', () => {
    const { progress: next, shieldsSpent } = applyDayStreak(
      progress({ dayStreak: 9, lastActiveDay: daysAgo(2), streakShields: 2 }),
    );
    expect(shieldsSpent).toBe(1);
    expect(next.streakShields).toBe(1);
    // The missed day counts as attended, plus today: 9 → 11.
    expect(next.dayStreak).toBe(11);
  });

  it('resets when the gap is longer than the shields can cover', () => {
    const { progress: next, shieldsSpent } = applyDayStreak(
      progress({ dayStreak: 30, lastActiveDay: daysAgo(5), streakShields: 1 }),
    );
    expect(shieldsSpent).toBe(0);
    expect(next.dayStreak).toBe(1);
    expect(next.streakShields).toBe(1); // unspent, not confiscated
  });

  it('starts a streak at one for someone who has never been active', () => {
    expect(applyDayStreak(progress()).progress.dayStreak).toBe(1);
  });

  it('grants a shield on each seventh day, capped at two in hand', () => {
    const day7 = applyDayStreak(progress({ dayStreak: 6, lastActiveDay: daysAgo(1) })).progress;
    expect(day7.dayStreak).toBe(7);
    expect(day7.streakShields).toBe(1);

    /* The cap is what stops the mechanic becoming "the streak never breaks".
       Two is a fortnight of banked forgiveness, which covers a holiday; an
       uncapped stack would let someone earn a hundred-day streak they had
       attended sixty days of. */
    const capped = applyDayStreak(
      progress({ dayStreak: 13, lastActiveDay: daysAgo(1), streakShields: 2 }),
    ).progress;
    expect(capped.dayStreak).toBe(14);
    expect(capped.streakShields).toBe(2);
  });

  it('does not grant a shield on a day that is not a multiple of seven', () => {
    const day8 = applyDayStreak(progress({ dayStreak: 7, lastActiveDay: daysAgo(1) })).progress;
    expect(day8.streakShields).toBe(0);
  });
});

describe('daysBetween', () => {
  it('counts whole days forward and backward', () => {
    expect(daysBetween('2026-03-01', '2026-03-08')).toBe(7);
    expect(daysBetween('2026-03-08', '2026-03-01')).toBe(-7);
    expect(daysBetween('2026-03-08', '2026-03-08')).toBe(0);
  });

  it('survives a spring-forward daylight-saving boundary', () => {
    /* US DST began 2026-03-08. Parsed at midnight this returns 0 in a
       northern-hemisphere zone, because the interval is 23 hours; parsed at
       local noon it returns 1. A student in Chicago should not lose a streak
       day to a clock change. */
    expect(daysBetween('2026-03-07', '2026-03-08')).toBe(1);
    expect(daysBetween('2026-11-01', '2026-11-02')).toBe(1);
  });
});

/* --------------------------------------------------------- percentiles */

describe('percentileFor', () => {
  it('matches published national ranks at the anchor scores', () => {
    expect(percentileFor(36)).toBe(100);
    expect(percentileFor(21)).toBe(58); // roughly the national average composite
    expect(percentileFor(1)).toBe(1);
  });

  it('rounds a fractional composite to the nearest whole score', () => {
    expect(percentileFor(23.4)).toBe(percentileFor(23));
    expect(percentileFor(23.6)).toBe(percentileFor(24));
  });

  it('returns null rather than guessing for an out-of-range composite', () => {
    expect(percentileFor(0)).toBeNull();
    expect(percentileFor(40)).toBeNull();
  });

  it('never claims a higher rank for a lower score', () => {
    for (let s = 2; s <= 36; s += 1) {
      expect(percentileFor(s)!).toBeGreaterThanOrEqual(percentileFor(s - 1)!);
    }
  });
});

describe('percentileInWords', () => {
  it('describes the top of the range as a room rather than a number', () => {
    expect(percentileInWords(99)).toContain('top 1%');
    expect(percentileInWords(96)).toBe('the top 1 in 20');
    expect(percentileInWords(82)).toBe('the top quarter');
    expect(percentileInWords(52)).toBe('the top half');
  });

  it('falls back to a plain figure below the median, without flattery', () => {
    expect(percentileInWords(30)).toBe('ahead of 30 in 100 test-takers');
  });

  /* The score report renders this as "That is about {phrase}", so a branch that
     does not read correctly after "about" is a shipped grammar bug. */
  it('reads correctly after the word "about" across the whole range', () => {
    for (let p = 0; p <= 100; p++) {
      const s = `about ${percentileInWords(p)}`;
      expect(s).not.toContain('about about');
      expect(s).not.toContain('about the about');
    }
  });
});

/* -------------------------------------------------------------- pacing */

describe('pacingFor', () => {
  it('uses the real ACT per-question budget, not this app\'s shortened sections', () => {
    // English: 50 questions in 35 minutes.
    expect(SECONDS_PER_QUESTION.english).toBeCloseTo(42, 5);
    expect(SECONDS_PER_QUESTION.math).toBeCloseTo(66.67, 1);
    expect(SECONDS_PER_QUESTION.reading).toBeCloseTo(66.67, 1);
    expect(SECONDS_PER_QUESTION.science).toBe(60);
  });

  it('grades comfortable, tight and over against that budget', () => {
    expect(pacingFor('english', 10 * 30, 10)!.verdict).toBe('comfortable');
    expect(pacingFor('english', 10 * 43, 10)!.verdict).toBe('tight');
    expect(pacingFor('english', 10 * 60, 10)!.verdict).toBe('over');
  });

  it('reports the overrun signed, so the UI never has to recompute it', () => {
    const p = pacingFor('science', 10 * 75, 10)!;
    expect(p.actual).toBe(75);
    expect(p.budget).toBe(60);
    expect(p.overBy).toBe(15);
  });

  it('returns null rather than dividing by zero on an empty section', () => {
    expect(pacingFor('math', 0, 0)).toBeNull();
  });

  /* An accommodated student sits the real exam with the same 1.5x they get
     here. Judging them against the standard clock would report "over" for a
     pace that is, for them, exactly on time. */
  it('scales the budget by the extended-time allowance', () => {
    expect(pacingFor('science', 10 * 75, 10, 1)!.verdict).toBe('over');
    expect(pacingFor('science', 10 * 75, 10, 1.5)!.budget).toBe(90);
    expect(pacingFor('science', 10 * 75, 10, 1.5)!.overBy).toBe(-15);
    expect(pacingFor('science', 10 * 75, 10, 1.5)!.verdict).toBe('comfortable');
  });

  it('defaults to standard timing, so existing callers are unaffected', () => {
    expect(pacingFor('english', 10 * 43, 10)).toEqual(pacingFor('english', 10 * 43, 10, 1));
  });
});

describe('paceHint', () => {
  it('stays quiet through the opening fifth, where everyone is slow', () => {
    expect(paceHint(0, 20, 0.19)).toBeNull();
    expect(paceHint(0, 20, 0)).toBeNull();
  });

  it('stays quiet for a student who is on pace or only one behind', () => {
    // Half the clock gone, half the questions done.
    expect(paceHint(10, 20, 0.5)).toBeNull();
    expect(paceHint(9, 20, 0.5)).toBeNull();
    expect(paceHint(30, 20, 0.5)).toBeNull(); // ahead
  });

  it('names the question to aim for once two or more behind', () => {
    expect(paceHint(7, 20, 0.5)).toBe('Pace: aim to be on question 11');
    expect(paceHint(2, 25, 0.4)).toBe('Pace: aim to be on question 11');
  });

  it('never points past the last question', () => {
    expect(paceHint(0, 20, 0.99)).toBe('Pace: aim to be on question 20');
  });

  it('says nothing once the clock is spent — the report handles that', () => {
    expect(paceHint(0, 20, 1)).toBeNull();
    expect(paceHint(0, 20, 1.4)).toBeNull();
  });

  it('returns null rather than dividing an empty section', () => {
    expect(paceHint(0, 0, 0.5)).toBeNull();
  });
});

/* ----------------------------------------------------- daily challenge */

describe('the daily challenge', () => {
  it('is five questions', () => {
    expect(DAILY_SIZE).toBe(5);
  });

  it('awards XP once and then refuses to pay twice in a day', () => {
    const first = completeDaily(progress());
    expect(first.xpGained).toBeGreaterThan(0);
    expect(dailyDone(first.progress)).toBe(true);

    const second = completeDaily(first.progress);
    expect(second.xpGained).toBe(0);
    expect(second.progress).toBe(first.progress);
  });

  it('is available again the next day', () => {
    expect(dailyDone(progress({ dailyDoneOn: daysAgo(1) }))).toBe(false);
  });
});

describe('pickDaily — which five', () => {
  /** A review entry that is due now, with `misses` deciding its rank. */
  const due = (misses: number) => ({ due: Date.now() - DAY, box: 0, misses });

  it('gives a brand-new student five real questions', () => {
    const five = pickDaily(progress(), '2026-08-09');
    expect(five).toHaveLength(DAILY_SIZE);
    for (const q of five) expect(getQuestion(q.id)).toBeDefined();
  });

  it('never repeats a question inside one day', () => {
    const ids = pickDaily(progress(), '2026-08-09').map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('is stable across calls on the same day, and changes on the next', () => {
    const p = progress();
    const a = pickDaily(p, '2026-08-09').map((q) => q.id);
    const b = pickDaily(p, '2026-08-09').map((q) => q.id);
    expect(b).toEqual(a);

    // Different day, different five. (A collision on all five is possible in
    // principle and vanishingly unlikely over 754 questions.)
    const tomorrow = pickDaily(p, '2026-08-10').map((q) => q.id);
    expect(tomorrow).not.toEqual(a);
  });

  it('leads with what is due for review, hardest-earned first', () => {
    const [q1, q2] = ALL_QUESTIONS;
    const p = progress({ review: { [q1!.id]: due(1), [q2!.id]: due(4) } });

    const ids = pickDaily(p, '2026-08-09').map((q) => q.id);
    // Four misses outrank one, and both come before any filler.
    expect(ids.slice(0, 2)).toEqual([q2!.id, q1!.id]);
    expect(ids).toHaveLength(DAILY_SIZE);
  });

  it('is entirely review questions when five or more are due', () => {
    const scheduled = ALL_QUESTIONS.slice(0, 8);
    const review: Progress['review'] = {};
    scheduled.forEach((q, i) => { review[q.id] = due(i); });

    const ids = new Set(pickDaily(progress({ review }), '2026-08-09').map((q) => q.id));
    for (const id of ids) expect(scheduled.some((q) => q.id === id)).toBe(true);
  });

  /* The one way this feature could make the app worse: pulling a question
     forward out of the review ladder resets a date the student cannot see. */
  it('never uses a scheduled-but-not-due question as filler', () => {
    const weakTopic = ALL_QUESTIONS[0]!.topic;
    const inTopic = ALL_QUESTIONS.filter((q) => q.topic === weakTopic);
    const review: Progress['review'] = {};
    // Every question in the weak topic is scheduled for a week from now.
    for (const q of inTopic) review[q.id] = { due: Date.now() + 7 * DAY, box: 2 };

    const p = progress({
      review,
      tally: {
        answered: 10,
        correct: 2,
        topics: { [`english::${weakTopic}`]: { section: 'english', n: 10, ok: 2, ms: 100_000 } },
        daily: {},
      },
    });

    const ids = pickDaily(p, '2026-08-09').map((q) => q.id);
    expect(ids).toHaveLength(DAILY_SIZE);
    for (const id of ids) expect(id in review).toBe(false);
  });

  it('explains itself differently depending on where the five came from', () => {
    const fresh = dailyBlurb(progress());
    const review: Progress['review'] = {};
    for (const q of ALL_QUESTIONS.slice(0, 6)) review[q.id] = due(1);
    const missed = dailyBlurb(progress({ review }));

    expect(missed).not.toBe(fresh);
    expect(missed.toLowerCase()).toContain('missed');
  });
});

/* --------------------------------------------------- the placement test */

describe('pickDiagnostic', () => {
  const withProfile = (before: 'first' | 'b20' | 'b27' | 'b28') =>
    progress({ profile: { before } as Progress['profile'] });

  it('samples every section, and the same number from each', () => {
    const qs = pickDiagnostic(withProfile('first'));
    const counts = SECTIONS.map((s) => qs.filter((q) => q.section === s.id).length);
    expect(counts).toEqual([7, 7, 7, 7]);
    expect(qs).toHaveLength(diagnosticLength(withProfile('first')));
  });

  /* The one thing `OnboardingProfile.before` was collected for, four screens
     into onboarding, and then never read by anything. */
  it('is shorter for somebody who has already sat the real ACT', () => {
    expect(diagnosticLength(withProfile('b27'))).toBeLessThan(diagnosticLength(withProfile('first')));
    expect(pickDiagnostic(withProfile('b27'))).toHaveLength(diagnosticLength(withProfile('b27')));
  });

  it('never asks the same question twice', () => {
    const ids = pickDiagnostic(withProfile('first')).map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  /* An all-easy sample places everybody near the top of the scale and an
     all-hard one buries them, so the spread is the placement's accuracy. */
  it('spreads across difficulties rather than sampling one band', () => {
    const qs = pickDiagnostic(withProfile('first'));
    expect(new Set(qs.map((q) => q.difficulty)).size).toBeGreaterThan(1);
  });

  it('spreads across topics inside each section', () => {
    const qs = pickDiagnostic(withProfile('first'));
    for (const s of SECTIONS) {
      const topics = new Set(qs.filter((q) => q.section === s.id).map((q) => q.topic));
      // Reading has only six topics and we ask seven questions, so five is the
      // bar: it must not be drilling one topic seven times.
      expect(topics.size).toBeGreaterThanOrEqual(5);
    }
  });

  it('is stable — the same student gets the same test', () => {
    const p = withProfile('first');
    expect(pickDiagnostic(p).map((q) => q.id)).toEqual(pickDiagnostic(p).map((q) => q.id));
  });
});

describe('scoreDiagnostic', () => {
  const answers = (section: SectionId, topic: string, ok: number, wrong: number) => [
    ...Array.from({ length: ok }, () => ({ section, topic, correct: true })),
    ...Array.from({ length: wrong }, () => ({ section, topic, correct: false })),
  ];

  it('scores each answered section and leaves unanswered ones out', () => {
    const d = scoreDiagnostic([...answers('english', 'commas', 4, 2)]);
    expect(d.raw.english).toEqual([4, 6]);
    expect(d.scores.english).toBeGreaterThan(0);
    expect(d.scores.math).toBeUndefined();
    expect(d.asked).toBe(6);
  });

  /* One wrong out of two is a coin flip. The plan trusts this list on day one
     with no other evidence, so it may only contain topics where the student
     got *nothing* right. */
  it('names only topics with no correct answer at all', () => {
    const d = scoreDiagnostic([
      ...answers('english', 'commas', 0, 2),
      ...answers('english', 'pronouns', 1, 1),
      ...answers('math', 'circles', 0, 1),
    ]);
    expect(d.weakTopics).toContain('commas');
    expect(d.weakTopics).toContain('circles');
    expect(d.weakTopics).not.toContain('pronouns');
  });

  it('orders the weak topics by how much evidence there is', () => {
    const d = scoreDiagnostic([
      ...answers('math', 'circles', 0, 1),
      ...answers('english', 'commas', 0, 3),
    ]);
    expect(d.weakTopics[0]).toBe('commas');
  });

  it('ranks the sections against each other, which is what it can support', () => {
    const d = scoreDiagnostic([
      ...answers('english', 'commas', 6, 0),
      ...answers('math', 'circles', 1, 5),
    ]);
    expect(placementShape(d)).toEqual({ strongest: 'english', weakest: 'math' });
  });

  it('has no shape to report from a single section', () => {
    expect(placementShape(scoreDiagnostic(answers('english', 'commas', 3, 3)))).toBeNull();
  });
});

describe('coldStartTopic — the plan on day one', () => {
  const diagnostic = (weakTopics: string[]) => ({
    at: Date.now(), raw: {}, scores: {}, weakTopics, asked: 28,
  });

  it('says nothing without a placement test', () => {
    expect(coldStartTopic(progress())).toBeNull();
  });

  it('resolves a topic name back to its section', () => {
    expect(coldStartTopic(progress({ diagnostic: diagnostic(['commas']) })))
      .toEqual({ section: 'english', topic: 'commas' });
  });

  it('skips a name no section claims, rather than returning nothing', () => {
    expect(coldStartTopic(progress({ diagnostic: diagnostic(['not a topic', 'circles']) })))
      .toEqual({ section: 'math', topic: 'circles' });
  });

  /* Once there is real evidence, the diagnostic's one-question verdict has
     been superseded and holding on to it points at a topic already fixed. */
  it('drops a topic the student has since answered three times', () => {
    const p = progress({
      diagnostic: diagnostic(['commas', 'circles']),
      tally: {
        answered: 3, correct: 3, daily: {},
        topics: { 'english::commas': { section: 'english', n: 3, ok: 3, ms: 30_000 } },
      },
    });
    expect(coldStartTopic(p)).toEqual({ section: 'math', topic: 'circles' });
  });

  it('leads todaysPlan with the placement topic while there is nothing better', () => {
    const p = progress({ diagnostic: diagnostic(['commas']) });
    const drill = todaysPlan(p, null).steps.find((s) => s.kind === 'drill');
    expect(drill?.to).toEqual({ name: 'drill', section: 'english', topic: 'commas' });
  });
});

/* ------------------------------------------------------- am I on track */

describe('trackStatus', () => {
  /** Enough right answers in two sections for `estimatedComposite` to speak. */
  function withEstimate(pct: number, overrides: Partial<Progress> = {}): Progress {
    const topics: Progress['tally']['topics'] = {};
    for (const section of ['english', 'math'] as const) {
      topics[`${section}::t`] = { section, n: 20, ok: Math.round(20 * pct), ms: 20_000 };
    }
    return progress({
      tally: { answered: 40, correct: Math.round(40 * pct), topics, daily: {} },
      ...overrides,
    });
  }

  it('says nothing at all before there is enough evidence', () => {
    const status = trackStatus(progress({ targetScore: 30 }));
    expect(status.verdict).toBe('unknown');
    expect(status.current).toBeNull();
    expect(status.gap).toBeNull();
  });

  it('is ahead once the estimate reaches the target', () => {
    const status = trackStatus(withEstimate(0.95, { targetScore: 20 }));
    expect(status.verdict).toBe('ahead');
    expect(status.gap!).toBeLessThanOrEqual(0);
  });

  it('is behind when the remaining weeks cannot plausibly close the gap', () => {
    const soon = dayKey(new Date(Date.now() + 7 * DAY));
    const status = trackStatus(
      withEstimate(0.4, { targetScore: 32, profile: { testDate: soon } as Progress['profile'] }),
    );
    expect(status.verdict).toBe('behind');
    expect(status.daysLeft).toBe(7);
  });

  it('is on track when there is a long runway for the same gap', () => {
    const farOff = dayKey(new Date(Date.now() + 500 * DAY));
    const status = trackStatus(
      withEstimate(0.4, { targetScore: 32, profile: { testDate: farOff } as Progress['profile'] }),
    );
    expect(status.verdict).toBe('onTrack');
  });

  it('falls back to a small-gap rule when no test date is set', () => {
    /* Without a date, "will you get there in time" has no meaning, so the
       verdict degrades to "is the gap small". Two points is the line. */
    const wide = trackStatus(withEstimate(0.4, { targetScore: 32 }));
    expect(wide.verdict).toBe('behind');
    expect(wide.daysLeft).toBeNull();
    expect(wide.gap!).toBeGreaterThan(2);

    const narrow = trackStatus(withEstimate(0.95, { targetScore: 36 }));
    expect(narrow.gap!).toBeLessThanOrEqual(2);
    expect(narrow.verdict).toBe('onTrack');
    expect(narrow.daysLeft).toBeNull();
  });

  it('reports a change only once two tests anchor it', () => {
    const test = (at: number, composite: number): TestResult => ({
      id: `t${at}`, at, scores: {}, composite, raw: {}, durationSec: 100, sections: ['english'],
    });
    const one = withEstimate(0.8, { targetScore: 30, testHistory: [test(Date.now() - 10 * DAY, 20)] });
    expect(trackStatus(one).change).toBeNull();

    const two = withEstimate(0.8, {
      targetScore: 30,
      testHistory: [test(Date.now() - 30 * DAY, 20), test(Date.now() - 2 * DAY, 24)],
    });
    // Newest test against the oldest in the window: 24 - 20.
    expect(trackStatus(two).change).toBe(4);
  });

  /* The drill estimate and a scored test measure the same thing with different
     instruments. Differencing across them reports the instruments' offset as
     if it were progress, which is why the trend uses tests at both ends. */
  it('draws the trend from tests alone, never from the drill estimate', () => {
    const test = (at: number, composite: number): TestResult => ({
      id: `t${at}`, at, scores: {}, composite, raw: {}, durationSec: 100, sections: ['english'],
    });
    const history = [test(Date.now() - 30 * DAY, 22), test(Date.now() - 2 * DAY, 22)];

    // Two very different drill estimates, identical test history.
    const low = trackStatus(withEstimate(0.45, { targetScore: 30, testHistory: history }));
    const high = trackStatus(withEstimate(0.95, { targetScore: 30, testHistory: history }));

    expect(low.current).not.toBe(high.current);
    expect(low.change).toBe(0);
    expect(high.change).toBe(0);
  });

  it('ignores tests that fell out of the sixty-day window', () => {
    const test = (at: number, composite: number): TestResult => ({
      id: `t${at}`, at, scores: {}, composite, raw: {}, durationSec: 100, sections: ['english'],
    });
    const status = trackStatus(
      withEstimate(0.8, {
        targetScore: 30,
        testHistory: [test(Date.now() - 400 * DAY, 12), test(Date.now() - 2 * DAY, 24)],
      }),
    );
    // Only one test survives the filter, so there is no line to draw.
    expect(status.change).toBeNull();
  });
});

/* --------------------------------------- merging the new synced fields */

describe('mergeProgress — fields added by this pass', () => {
  it('unions bookmarks rather than letting one device clear the other', () => {
    const local = progress({ bookmarks: ['a', 'b'] });
    const remote = progress({ bookmarks: ['b', 'c'] });
    expect(mergeProgress(local, remote).bookmarks.sort()).toEqual(['a', 'b', 'c']);
  });

  it('takes the higher shield count, so a sync cannot spend one twice', () => {
    expect(mergeProgress(progress({ streakShields: 1 }), progress({ streakShields: 3 })).streakShields).toBe(3);
    expect(mergeProgress(progress({ streakShields: 3 }), progress({ streakShields: 1 })).streakShields).toBe(3);
  });

  it('keeps the later daily completion, so the phone cannot re-open it on the laptop', () => {
    const merged = mergeProgress(
      progress({ dailyDoneOn: daysAgo(3) }),
      progress({ dailyDoneOn: dayKey() }),
    );
    expect(merged.dailyDoneOn).toBe(dayKey());
  });

  it('takes the higher miss count per question', () => {
    const merged = mergeProgress(
      progress({ review: { q1: { box: 2, due: 100, misses: 1 } } }),
      progress({ review: { q1: { box: 0, due: 500, misses: 4 } } }),
    );
    expect(merged.review['q1']!.misses).toBe(4);
  });

  it('falls back to the default hero when a stored id no longer exists', () => {
    /* `hero` was a dead string field for months and old saves carry
       `'cadet'`, which is not in HEROES. Rendering nothing for those people
       would be the worst possible outcome of finally using the field. */
    const merged = mergeProgress(progress({ hero: 'cadet' }), progress({ hero: 'cadet' }));
    expect(merged.hero).toBe('ash');
  });

  it('keeps a locally-taken diagnostic when the remote has none', () => {
    const diagnostic = {
      at: Date.now(), raw: {}, scores: {}, weakTopics: ['english::commas'], asked: 12,
    };
    expect(mergeProgress(progress({ diagnostic }), progress()).diagnostic).toEqual(diagnostic);
    expect(mergeProgress(progress(), progress({ diagnostic })).diagnostic).toEqual(diagnostic);
  });
});
