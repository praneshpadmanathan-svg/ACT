import { beforeEach, describe, expect, it } from 'vitest';
import type { RunnableQuestion } from '@/components/QuestionRunner';
import {
  addTime,
  clearSession,
  createSession,
  isExpired,
  loadSession,
  moveTo,
  parseSession,
  recordsFor,
  remainingSec,
  saveSession,
  sectionLimitMs,
  selectAnswer,
  startNextSection,
  submitSection,
  TEST_SESSION_KEY,
  toggleFlag,
  unansweredCount,
  type TestSession,
} from './testSession';

const T0 = 1_700_000_000_000;
const HOUR = 3_600_000;
const ids = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i}`);
const exists = () => true;

function full(now = T0): TestSession {
  return createSession({
    config: 'full',
    sections: ['english', 'math'],
    questionIds: { english: ids('e', 3), math: ids('m', 2) },
    allowance: 1,
    now,
  });
}

/* What storage would hand back: the session after a JSON round trip. */
const roundTrip = (s: TestSession) => JSON.parse(JSON.stringify(s)) as unknown;

describe('answer sheet', () => {
  it('marks, changes and keeps answers without advancing', () => {
    let s = full();
    s = selectAnswer(s, 'e1', 'B');
    s = selectAnswer(s, 'e1', 'C');
    expect(s.progress.english?.answers).toEqual({ e1: 'C' });
    expect(s.progress.english?.cursor).toBe(0);
    expect(unansweredCount(s, 'english')).toBe(2);
  });

  it('ignores ids from another section', () => {
    const s = selectAnswer(full(), 'm0', 'A');
    expect(s.progress.english?.answers).toEqual({});
    expect(s.progress.math?.answers).toEqual({});
  });

  it('toggles flags and clamps the cursor', () => {
    let s = toggleFlag(full(), 'e2');
    expect(s.progress.english?.flags).toEqual(['e2']);
    s = toggleFlag(s, 'e2');
    expect(s.progress.english?.flags).toEqual([]);
    expect(moveTo(s, 99).progress.english?.cursor).toBe(2);
    expect(moveTo(s, -4).progress.english?.cursor).toBe(0);
  });

  it('accumulates viewing time and drops nonsense', () => {
    let s = addTime(full(), 'e0', 1500);
    s = addTime(s, 'e0', 500);
    s = addTime(s, 'e0', -20);
    expect(s.progress.english?.ms).toEqual({ e0: 2000 });
  });
});

describe('clock and submission', () => {
  it('runs on an absolute deadline', () => {
    const s = full();
    const limit = sectionLimitMs('english', 1);
    expect(remainingSec(s, T0)).toBe(limit / 1000);
    expect(remainingSec(s, T0 + 61_000)).toBe(limit / 1000 - 61);
    expect(isExpired(s, T0 + limit - 1)).toBe(false);
    expect(isExpired(s, T0 + limit)).toBe(true);
  });

  it('submits once, moves to the break, and refuses edits afterwards', () => {
    const s = selectAnswer(full(), 'e0', 'A');
    const first = submitSection(s, T0 + 90_000);
    expect(first.accepted).toBe(true);
    expect(first.finished).toBe(false);
    expect(first.session.stage).toEqual({ kind: 'break', nextIndex: 1 });
    expect(first.session.sectionSec.english).toBe(90);

    const again = submitSection(first.session, T0 + 95_000);
    expect(again.accepted).toBe(false);
    expect(selectAnswer(first.session, 'e1', 'B')).toBe(first.session);
  });

  it('charges an expired section its allowance, not the time away', () => {
    const s = full();
    const { session } = submitSection(s, T0 + 10 * HOUR);
    expect(session.sectionSec.english).toBe(sectionLimitMs('english', 1) / 1000);
  });

  it('starts the next clock from the break and finishes on the last section', () => {
    const afterFirst = submitSection(full(), T0 + 1000).session;
    const second = startNextSection(afterFirst, T0 + 5 * 60_000);
    expect(second.stage).toMatchObject({ kind: 'section', index: 1, startedAt: T0 + 5 * 60_000 });
    const done = submitSection(second, T0 + 6 * 60_000);
    expect(done.finished).toBe(true);
    expect(done.session.submitted).toEqual([0, 1]);
  });
});

describe('restore', () => {
  it('round-trips a session in progress', () => {
    let s = selectAnswer(full(), 'e2', 'D');
    s = toggleFlag(moveTo(s, 2), 'e1');
    expect(parseSession(roundTrip(s), T0 + HOUR, exists)).toEqual(s);
  });

  it('restores a break', () => {
    const s = submitSection(full(), T0 + 1000).session;
    expect(parseSession(roundTrip(s), T0 + 2000, exists)?.stage).toEqual({
      kind: 'break',
      nextIndex: 1,
    });
  });

  it('keeps an expired section so the runner can auto-submit it', () => {
    const restored = parseSession(roundTrip(full()), T0 + 2 * HOUR, exists);
    expect(restored).not.toBeNull();
    expect(isExpired(restored!, T0 + 2 * HOUR)).toBe(true);
  });

  it('drops sessions older than a day', () => {
    expect(parseSession(roundTrip(full()), T0 + 25 * HOUR, exists)).toBeNull();
  });

  it('drops sessions naming a question the bank no longer has', () => {
    expect(parseSession(roundTrip(full()), T0, (id) => id !== 'm1')).toBeNull();
  });

  it('drops sessions whose last section was already recorded', () => {
    const second = startNextSection(submitSection(full(), T0).session, T0);
    const done = submitSection(second, T0 + 1000).session;
    expect(parseSession(roundTrip(done), T0 + 2000, exists)).toBeNull();
  });

  it('drops malformed data and strips stray answers', () => {
    expect(parseSession(null, T0, exists)).toBeNull();
    expect(parseSession({ v: 2 }, T0, exists)).toBeNull();
    expect(parseSession({ ...full(), sections: ['history'] }, T0, exists)).toBeNull();
    expect(
      parseSession({ ...full(), stage: { kind: 'section', index: 7 } }, T0, exists),
    ).toBeNull();

    const raw = roundTrip(full()) as {
      progress: { english: { answers: Record<string, unknown> } };
    };
    raw.progress.english.answers = { e0: 'A', zz: 'B', e1: 7 };
    expect(parseSession(raw, T0, exists)?.progress.english?.answers).toEqual({ e0: 'A' });
  });
});

describe('storage', () => {
  beforeEach(() => window.localStorage.clear());

  it('saves, loads and clears', () => {
    const s = selectAnswer(full(), 'e0', 'A');
    saveSession(s, T0 + 5000);
    const loaded = loadSession(T0 + 6000, exists);
    expect(loaded?.progress.english?.answers).toEqual({ e0: 'A' });
    expect(loaded?.savedAt).toBe(T0 + 5000);
    clearSession();
    expect(loadSession(T0 + 6000, exists)).toBeNull();
  });

  it('removes a corrupt or stale entry instead of re-reading it', () => {
    window.localStorage.setItem(TEST_SESSION_KEY, '{not json');
    expect(loadSession(T0, exists)).toBeNull();
    expect(window.localStorage.getItem(TEST_SESSION_KEY)).toBeNull();

    saveSession(full(), T0);
    expect(loadSession(T0 + 30 * HOUR, exists)).toBeNull();
    expect(window.localStorage.getItem(TEST_SESSION_KEY)).toBeNull();
  });
});

describe('scoring', () => {
  const q = (id: string, correctKey: string) =>
    ({ id, correctKey, choices: [], why: {} }) as unknown as RunnableQuestion;

  it('scores every question, blanks as wrong', () => {
    let s = selectAnswer(full(), 'e0', 'A');
    s = selectAnswer(s, 'e1', 'B');
    s = addTime(s, 'e0', 4000);
    const records = recordsFor([q('e0', 'A'), q('e1', 'C'), q('e2', 'D')], s.progress.english);
    expect(records.map((r) => [r.chosen, r.correct, r.ms])).toEqual([
      ['A', true, 4000],
      ['B', false, 0],
      [null, false, 0],
    ]);
  });
});
