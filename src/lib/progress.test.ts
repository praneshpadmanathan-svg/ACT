/* Regression tests for the riskiest functions in progress.ts — the ones
   that already shipped a silent bug once (the tally-backfill check), or
   whose failure mode is invisible for days rather than throwing (the
   Leitner scheduler), or whose invariants are easy to break by "simplifying"
   the merge logic without reading the comment explaining why it's shaped
   that way. See docs/program-improvement-roadmap.md §1.

   Each test pins a specific, previously-reasoned-about behavior rather than
   just exercising the happy path, so a future change that silently alters
   that behavior fails here instead of surfacing as a support email days
   later. */

import { beforeEach, describe, expect, it } from 'vitest';
import type { Attempt, Progress, TestResult } from '@/types';
import {
  RANKS,
  awardXP,
  compositeOf,
  dueForReview,
  emptyProgress,
  loadProgress,
  mergeProgress,
  mergeTally,
  rankFor,
  rankProgress,
  recordAttempt,
  recordTest,
  saveProgress,
  scaleScore,
  scheduleReview,
  tallyFromAttempts,
} from './progress';
import { STORAGE_KEYS, readJSON, writeJSON } from './storage';

function attempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    qid: 'e001',
    section: 'english',
    topic: 'commas',
    correct: true,
    ms: 4000,
    at: Date.now(),
    ...overrides,
  };
}

function progress(overrides: Partial<Progress> = {}): Progress {
  return { ...emptyProgress(), ...overrides };
}

beforeEach(() => {
  localStorage.clear();
});

/* --------------------------------------------------- tallyFromAttempts */

describe('tallyFromAttempts', () => {
  it('sums attempts into per-topic totals, keyed by section::topic', () => {
    const tally = tallyFromAttempts([
      attempt({ topic: 'commas', correct: true, ms: 1000 }),
      attempt({ topic: 'commas', correct: false, ms: 2000 }),
      attempt({ topic: 'commas', correct: true, ms: 500 }),
    ]);
    expect(tally.answered).toBe(3);
    expect(tally.correct).toBe(2);
    expect(tally.topics['english::commas']).toEqual({
      section: 'english',
      n: 3,
      ok: 2,
      ms: 3500,
    });
  });

  it('keeps different topics separate', () => {
    const tally = tallyFromAttempts([
      attempt({ topic: 'commas' }),
      attempt({ topic: 'dashes', section: 'english' }),
    ]);
    expect(Object.keys(tally.topics).sort()).toEqual(['english::commas', 'english::dashes']);
  });

  it('returns a well-formed empty tally for no attempts', () => {
    const tally = tallyFromAttempts([]);
    expect(tally).toEqual({ answered: 0, correct: 0, topics: {}, daily: {} });
  });
});

/* -------------------------------------------------- loadProgress backfill

   The exact bug that shipped: the backfill guard tested `merged.tally`
   instead of `stored?.tally`. `merged` is `stored` spread over
   `emptyProgress()`, which always supplies a well-formed empty tally — so
   the old guard was asking "did the default I just applied work?", which is
   always yes, and the backfill never ran for a single returning player. */

describe('loadProgress backfill', () => {
  it('backfills the tally from attempts when a stored record predates tallies', () => {
    const legacyRecord = {
      ...emptyProgress(),
      attempts: [attempt({ topic: 'commas', correct: true }), attempt({ topic: 'commas', correct: false })],
      // No `tally` field at all — the exact shape of a pre-tally save.
      tally: undefined,
    };
    delete (legacyRecord as { tally?: unknown }).tally;
    writeJSON(STORAGE_KEYS.progress, legacyRecord);

    const loaded = loadProgress();
    expect(loaded.tally.answered).toBe(2);
    expect(loaded.tally.correct).toBe(1);
  });

  it('does not overwrite an already-populated tally with a backfill from a shorter attempt log', () => {
    // A tally that has more history than the (trimmed) local attempt log —
    // exactly the shape of a long-lived account, since `attempts` is capped
    // at 300 while `tally` is never trimmed.
    const stored = progress({
      tally: { answered: 500, correct: 400, topics: {}, daily: {} },
      attempts: [attempt()], // one attempt left in the trimmed local log
    });
    writeJSON(STORAGE_KEYS.progress, stored);

    const loaded = loadProgress();
    expect(loaded.tally.answered).toBe(500);
    expect(loaded.tally.correct).toBe(400);
  });

  it('gives a brand-new profile an empty tally rather than backfilling from nothing', () => {
    expect(readJSON(STORAGE_KEYS.progress, null)).toBeNull();
    const loaded = loadProgress();
    expect(loaded.tally).toEqual({ answered: 0, correct: 0, topics: {}, daily: {} });
  });

  it('round-trips through saveProgress unchanged', () => {
    const p = recordAttempt(progress(), attempt(), 10).progress;
    saveProgress(p);
    const reloaded = loadProgress();
    expect(reloaded.xp).toBe(p.xp);
    expect(reloaded.tally).toEqual(p.tally);
  });
});

/* --------------------------------------------------------- scheduleReview

   An off-by-one here wouldn't surface until the box interval had actually
   elapsed — days later, not on the next answer. */

describe('scheduleReview', () => {
  it('starts a new question at box 1 on a correct answer', () => {
    const review = scheduleReview({}, 'e001', true);
    expect(review.e001.box).toBe(1);
  });

  it('resets to box 0 on an incorrect answer, regardless of prior progress', () => {
    const advanced = { e001: { box: 3, due: Date.now() } };
    const review = scheduleReview(advanced, 'e001', false);
    expect(review.e001.box).toBe(0);
  });

  it('advances one box at a time on repeated correct answers', () => {
    let review = scheduleReview({}, 'e001', true); // box 1
    review = scheduleReview(review, 'e001', true); // box 2
    review = scheduleReview(review, 'e001', true); // box 3
    expect(review.e001.box).toBe(3);
  });

  it('drops the question from the queue once it graduates the last box', () => {
    // BOX_INTERVALS has 6 entries (indices 0-5); 5 correct answers in a row
    // reaches the last box, at which point it graduates and leaves the queue.
    let review: Progress['review'] = { e001: { box: 4, due: 0 } };
    review = scheduleReview(review, 'e001', true);
    expect(review.e001).toBeUndefined();
  });

  it('sets a later due date the further along the box', () => {
    const box1 = scheduleReview({}, 'q', true);
    let box2 = scheduleReview(box1, 'q', true);
    expect(box2.q.due).toBeGreaterThan(box1.q.due);
  });
});

describe('dueForReview', () => {
  it('returns only items whose due date has passed, oldest first', () => {
    const now = Date.now();
    const p = progress({
      review: {
        future: { box: 1, due: now + 1_000_000 },
        overdue: { box: 1, due: now - 2_000_000 },
        justDue: { box: 1, due: now - 1_000 },
      },
    });
    expect(dueForReview(p)).toEqual(['overdue', 'justDue']);
  });

  it('returns nothing when no items are due', () => {
    const p = progress({ review: { q: { box: 1, due: Date.now() + 1_000_000 } } });
    expect(dueForReview(p)).toEqual([]);
  });
});

/* --------------------------------------------------------------- scaleScore */

describe('scaleScore', () => {
  it('pins the endpoints', () => {
    expect(scaleScore(0)).toBe(1);
    expect(scaleScore(1)).toBe(36);
  });

  it('pins known interior table values exactly', () => {
    expect(scaleScore(0.5)).toBe(21);
    expect(scaleScore(0.8)).toBe(29);
    expect(scaleScore(0.94)).toBe(34);
  });

  it('is monotonically non-decreasing across the whole range', () => {
    let prev = scaleScore(0);
    for (let pct = 0.01; pct <= 1; pct += 0.01) {
      const score = scaleScore(pct);
      expect(score).toBeGreaterThanOrEqual(prev);
      prev = score;
    }
  });

  it('interpolates between table points rather than stepping', () => {
    // Halfway between the 0.4 -> 18 and 0.5 -> 21 rows should land near 19-20,
    // not jump straight to either endpoint.
    const score = scaleScore(0.45);
    expect(score).toBeGreaterThan(18);
    expect(score).toBeLessThan(21);
  });
});

describe('compositeOf', () => {
  it('averages and rounds the section scores present', () => {
    expect(compositeOf({ english: 30, math: 28, reading: 32, science: 26 })).toBe(29);
  });

  it('ignores sections with no score rather than treating them as zero', () => {
    expect(compositeOf({ english: 30 })).toBe(30);
  });

  it('returns 0 for no scores at all', () => {
    expect(compositeOf({})).toBe(0);
  });
});

/* ------------------------------------------------------------ XP & ranks */

describe('rankIndexFor / rankProgress', () => {
  it('places exactly-at-threshold XP in the rank it just reached, not the one before', () => {
    // A boundary value is the classic off-by-one spot.
    const honorsThreshold = RANKS.find((r) => r.name === 'Honors')!.xp;
    expect(rankFor(honorsThreshold).name).toBe('Honors');
    expect(rankFor(honorsThreshold - 1).name).toBe('Scholar');
  });

  it('caps at the top rank and reports full progress with no next rank', () => {
    const top = RANKS[RANKS.length - 1];
    const result = rankProgress(top.xp + 999_999);
    expect(result.pct).toBe(1);
    expect(result.next).toBeNull();
  });

  it('reports fractional progress toward the next rank', () => {
    const recruit = RANKS[0];
    const scholar = RANKS[1];
    const midpoint = recruit.xp + (scholar.xp - recruit.xp) / 2;
    const result = rankProgress(midpoint);
    expect(result.pct).toBeCloseTo(0.5, 5);
    expect(result.next?.name).toBe('Scholar');
  });
});

describe('awardXP / recordAttempt rank-up detection', () => {
  it('reports rankedUp only when XP crosses into a new rank', () => {
    const scholarThreshold = RANKS.find((r) => r.name === 'Scholar')!.xp;
    const justBelow = progress({ xp: scholarThreshold - 5 });

    const stillRecruit = awardXP(justBelow, 3);
    expect(stillRecruit.rankedUp).toBe(false);

    const crossedOver = awardXP(justBelow, 10);
    expect(crossedOver.rankedUp).toBe(true);
    expect(crossedOver.newRankIndex).toBe(1);
  });

  it('recordAttempt awards only 2 XP for a wrong answer regardless of difficulty', () => {
    const result = recordAttempt(progress(), attempt({ correct: false }), 2);
    expect(result.xpGained).toBe(2);
    expect(result.progress.xp).toBe(2);
  });
});

/* -------------------------------------------------------------- mergeProgress

   The merge is deliberately asymmetric: counters take the max, sets union,
   review keeps whichever side is further along. These tests pin exactly
   those invariants so a "simplification" that changes the arithmetic fails
   here instead of quietly losing someone's progress on their second device. */

describe('mergeProgress', () => {
  it('takes the maximum XP rather than summing or picking a side', () => {
    const local = progress({ xp: 500 });
    const remote = progress({ xp: 800 });
    expect(mergeProgress(local, remote).xp).toBe(800);
    expect(mergeProgress(remote, local).xp).toBe(800);
  });

  it('unions notesRead and achievements rather than one side winning', () => {
    const local = progress({ notesRead: ['a', 'b'], achievements: ['first-blood'] });
    const remote = progress({ notesRead: ['b', 'c'], achievements: ['ten-q'] });
    const merged = mergeProgress(local, remote);
    expect(new Set(merged.notesRead)).toEqual(new Set(['a', 'b', 'c']));
    expect(new Set(merged.achievements)).toEqual(new Set(['first-blood', 'ten-q']));
  });

  it('keeps zonesCleared at the best percent seen on either device', () => {
    const local = progress({ zonesCleared: { comma_castle: 100 } });
    const remote = progress({ zonesCleared: { comma_castle: 60 } });
    expect(mergeProgress(local, remote).zonesCleared.comma_castle).toBe(100);
  });

  it('actually merges tally via mergeTally rather than picking one side', () => {
    // A regression that swaps `mergeTally(local.tally, remote.tally)` for
    // plain `local.tally` still type-checks and still passes every other
    // test here — this is the one that catches it.
    const local = progress({
      tally: { answered: 5, correct: 4, topics: { 'english::commas': { section: 'english', n: 5, ok: 4, ms: 0 } }, daily: {} },
    });
    const remote = progress({
      tally: { answered: 3, correct: 3, topics: { 'math::functions': { section: 'math', n: 3, ok: 3, ms: 0 } }, daily: {} },
    });
    const merged = mergeProgress(local, remote);
    expect(merged.tally.answered).toBe(8);
    expect(Object.keys(merged.tally.topics).sort()).toEqual(['english::commas', 'math::functions']);
  });

  it('keeps whichever review box is further along per question, not the freshest write', () => {
    const local = progress({ review: { q1: { box: 4, due: 1 } } });
    const remote = progress({ review: { q1: { box: 1, due: 999_999 } } });
    // local is further along despite an *earlier* due timestamp — box wins, not recency.
    expect(mergeProgress(local, remote).review.q1.box).toBe(4);
  });

  it('never merges the raw attempt log — keeps whichever side is running', () => {
    const local = progress({ attempts: [attempt({ qid: 'local-only' })] });
    const remote = progress({ attempts: [attempt({ qid: 'remote-only' })] });
    expect(mergeProgress(local, remote).attempts.map((a) => a.qid)).toEqual(['local-only']);
  });

  it("first choice wins for startRegion — a second device can't relocate the traveller", () => {
    const local = progress({ startRegion: 'english' });
    const remote = progress({ startRegion: 'math' });
    expect(mergeProgress(local, remote).startRegion).toBe('english');
    // And a device with no choice yet inherits the other side's.
    const undecided = progress({ startRegion: null });
    expect(mergeProgress(undecided, remote).startRegion).toBe('math');
  });

  it('deduplicates testHistory by id+timestamp rather than concatenating', () => {
    const shared: TestResult = {
      id: 't1',
      at: 1000,
      scores: { english: 30 },
      composite: 30,
      raw: { english: [40, 50] },
      durationSec: 600,
      sections: ['english'],
    };
    const local = progress({ testHistory: [shared] });
    const remote = progress({ testHistory: [shared] });
    expect(mergeProgress(local, remote).testHistory).toHaveLength(1);
  });
});

describe('mergeTally', () => {
  it('takes the max per topic rather than summing, per the documented under-count tradeoff', () => {
    const local = { answered: 5, correct: 4, topics: { 'english::commas': { section: 'english' as const, n: 5, ok: 4, ms: 5000 } }, daily: {} };
    const remote = { answered: 3, correct: 2, topics: { 'english::commas': { section: 'english' as const, n: 3, ok: 2, ms: 3000 } }, daily: {} };
    const merged = mergeTally(local, remote);
    // Max(5,3)=5, not 5+3=8 — this is the deliberate under-count, not a bug.
    expect(merged.topics['english::commas'].n).toBe(5);
    expect(merged.answered).toBe(5);
  });

  it('sums correctly across genuinely different topics', () => {
    const local = { answered: 5, correct: 4, topics: { 'english::commas': { section: 'english' as const, n: 5, ok: 4, ms: 5000 } }, daily: {} };
    const remote = { answered: 3, correct: 3, topics: { 'math::functions': { section: 'math' as const, n: 3, ok: 3, ms: 3000 } }, daily: {} };
    const merged = mergeTally(local, remote);
    expect(merged.answered).toBe(8);
    expect(merged.correct).toBe(7);
  });
});

/* --------------------------------------------------------------- recordTest */

describe('recordTest', () => {
  it('awards the full-test bonus only when all four sections are present', () => {
    const fullResult: TestResult = {
      id: 't1', at: Date.now(), scores: {}, composite: 25, raw: {}, durationSec: 100,
      sections: ['english', 'math', 'reading', 'science'],
    };
    const partialResult: TestResult = { ...fullResult, id: 't2', sections: ['english'] };

    expect(recordTest(progress(), fullResult).xpGained).toBe(900);
    expect(recordTest(progress(), partialResult).xpGained).toBe(250);
  });
});
