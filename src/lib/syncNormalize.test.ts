import { describe, expect, it } from 'vitest';
import { ALL_ZONES } from '@/content/zones';
import { emptyProgress, loadProgress, mergeProgress, saveProgress } from './progress';
import { compactForCloud, expandFromCloud } from './supabase';

describe('a cloud row written before the tally migrations', () => {
  it('does not grow the answer count on every sync and reload', () => {
    const { zone } = ALL_ZONES.find((z) => z.zone.topic && z.path.id === 'english')!;
    const legacy = emptyProgress();
    legacy.lastActiveDay = '2026-08-01';
    legacy.tally = {
      answered: 30,
      correct: 20,
      topics: {
        [`zone::${zone.name}`]: { section: 'zone' as never, n: 10, ok: 7, ms: 1000 },
        [`english::${zone.topic}`]: { section: 'english', n: 20, ok: 13, ms: 2000 },
      },
      daily: {},
    };
    legacy.weeklyGoal = 1800;

    const KEY = 'test:sync-normalize';
    localStorage.setItem(KEY, JSON.stringify(legacy));
    let local = loadProgress(KEY);
    const before = local.tally.answered;

    let row = compactForCloud(legacy);
    for (let cycle = 0; cycle < 3; cycle++) {
      const merged = mergeProgress(local, expandFromCloud(row));
      row = compactForCloud(merged);
      saveProgress(merged, KEY);
      local = loadProgress(KEY);
    }

    expect(local.tally.answered).toBe(before);
    expect(Object.keys(local.tally.topics).some((k) => k.startsWith('zone::'))).toBe(false);
    expect(expandFromCloud(compactForCloud(legacy)).weeklyGoal).toBeLessThanOrEqual(150);
  });
});
