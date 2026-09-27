import { describe, expect, it } from 'vitest';
import { emptyProgress, trackStatus } from './progress';
import type { SectionId, TestResult } from '@/types';

describe('trackStatus trend', () => {
  it('does not compare a single-section score with a full composite', () => {
    const sitting = (id: string, composite: number, sections: SectionId[]): TestResult => ({
      id,
      at: Date.now() - 1000,
      scores: {},
      composite,
      raw: {},
      durationSec: 100,
      sections,
    });
    const topics: ReturnType<typeof emptyProgress>['tally']['topics'] = {};
    for (const section of ['english', 'math'] as const) {
      topics[`${section}::t`] = { section, n: 20, ok: 16, ms: 20_000 };
    }
    const p = {
      ...emptyProgress(),
      tally: { answered: 40, correct: 32, topics, daily: {} },
      targetScore: 30,
      testHistory: [
        sitting('a', 22, ['english', 'math', 'reading', 'science']),
        sitting('b', 14, ['science']),
      ],
    };
    expect(trackStatus(p).current).not.toBeNull();
    expect(trackStatus(p).change).toBeNull();
  });
});
