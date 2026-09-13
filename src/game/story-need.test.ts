/* The quest chain has to stay completable against the realm that actually
   exists.

   The last quest used to be `need: 37` with "thirty-seven" written into
   Wizzy's lines. That number was a copy of the zone count, not a reference to
   it, so adding or removing a landmark would have left the final quest
   unreachable (or satisfied early) while the script cheerfully said the wrong
   number out loud. It now derives from ctx.total; these tests hold that line,
   and check that the earlier milestones still fit inside the real realm. */
import { describe, it, expect } from 'vitest';
import { QUESTS, needOf, activeQuest, CHAPTERS } from './story';
import { ALL_ZONES } from '@/content/zones';
import type { Progress } from '@/types';

const REAL_TOTAL = ALL_ZONES.length;

const progress = (over: Partial<Progress> = {}) =>
  ({
    achievements: [],
    testHistory: [],
    storySeen: [],
    ...over,
  }) as unknown as Progress;

const finished = progress({
  achievements: ['boss-english', 'boss-math', 'boss-reading', 'boss-science'],
  testHistory: [{ sections: ['english', 'math', 'reading', 'science'] }],
} as Partial<Progress>);

describe('the final quest tracks the live realm', () => {
  const whole = QUESTS.find((q) => q.id === 'summit-road')!;

  it('resolves against ctx.total rather than a baked-in count', () => {
    expect(needOf(whole, { cleared: 0, total: REAL_TOTAL })).toBe(REAL_TOTAL);
    expect(needOf(whole, { cleared: 0, total: REAL_TOTAL + 4 })).toBe(REAL_TOTAL + 4);
  });

  it('completes the chain when every landmark is cleared, at either size', () => {
    for (const total of [REAL_TOTAL, REAL_TOTAL + 4]) {
      expect(activeQuest(finished, { cleared: total, total })).toBeNull();
    }
  });

  it('still has the realm outstanding one landmark short', () => {
    const total = REAL_TOTAL + 4;
    const q = activeQuest(
      progress({ achievements: ['boss-english', 'boss-math', 'boss-reading', 'boss-science'] }),
      { cleared: total - 1, total },
    );
    expect(q?.quest.id).toBe('summit-road');
    expect(q?.need).toBe(total);
  });
});

describe('the chain is reachable in the realm that ships', () => {
  it('never asks for more landmarks than exist', () => {
    const ctx = { cleared: 0, total: REAL_TOTAL };
    const landmarkCounted = QUESTS[0]!.count;
    for (const quest of QUESTS) {
      if (quest.count !== landmarkCounted) continue; // landmark-counted quests only
      expect(needOf(quest, ctx)).toBeLessThanOrEqual(REAL_TOTAL);
    }
  });
});

describe('the script quotes no landmark count', () => {
  it('has no hardcoded total left in Wizzy lines', () => {
    const spoken = JSON.stringify(CHAPTERS.map((c) => c.beats));
    expect(spoken).not.toMatch(/thirty-seven|37 landmark/i);
  });
});
