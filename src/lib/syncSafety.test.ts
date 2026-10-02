/* Pins for the pre-launch sync and storage fixes. Each block names the failure
   it exists to prevent, because every one of them was silent: nothing threw,
   the app kept working, and the student's data quietly went somewhere wrong. */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
} from '@supabase/supabase-js';
import type { Progress } from '@/types';
import {
  completeDaily,
  emptyProgress,
  loadProgress,
  mergeProgress,
  normalizeProgress,
  recordAttempt,
  saveProgress,
  XP,
} from './progress';
import {
  CLOUD_ROW_BUDGET,
  compactForCloud,
  friendlyError,
  isCheckViolation,
  isDefinitiveAuthFailure,
  KEEPALIVE_HEADER,
  keepaliveFetch,
} from './supabase';
import { clearDeviceData, readRaw, STORAGE_KEYS, writeRaw } from './storage';
import { progressKeyFor } from './identity';
import { isChunkLoadError, reloadForNewBuild, RELOAD_COOLDOWN_MS } from './chunkReload';

const DAY = 86_400_000;
const GUEST = progressKeyFor({ kind: 'guest' });

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

/* ------------------------------------------------------------ the row cap */

describe('compactForCloud', () => {
  function heavy(n: number): Progress {
    const p = emptyProgress();
    for (let i = 0; i < n; i++) {
      p.review[`english-${i.toString(36).padStart(6, '0')}`] = {
        box: i % 5,
        due: 1_790_000_000_000 + i * 1000,
        misses: i % 3,
      };
    }
    return p;
  }

  it('leaves an ordinary row untouched', () => {
    const p = heavy(200);
    expect(compactForCloud(p).review).toEqual(p.review);
  });

  /* 0001 refuses rows over 256 KB, and a heavy user's review map got there:
     every push after that failed, forever. The row is now held under budget. */
  it('holds a heavy user under the budget, keeping the questions that matter', () => {
    const p = heavy(6000);
    expect(JSON.stringify(p).length).toBeGreaterThan(CLOUD_ROW_BUDGET);

    const row = compactForCloud(p);
    expect(JSON.stringify(row).length).toBeLessThanOrEqual(CLOUD_ROW_BUDGET);
    const kept = Object.values(row.review);
    expect(kept.length).toBeGreaterThan(1000);
    // Everything in box 0 survives; whatever went, went from the top.
    const box0 = Object.values(p.review).filter((e) => e.box === 0).length;
    expect(kept.filter((e) => e.box === 0)).toHaveLength(box0);
    // The device's own copy is never trimmed.
    expect(Object.keys(p.review)).toHaveLength(6000);
  });
});

describe('isCheckViolation', () => {
  it('recognises the size cap by SQLSTATE or by message', () => {
    expect(isCheckViolation({ code: '23514', message: '' })).toBe(true);
    expect(
      isCheckViolation({
        message: 'new row for relation "progress" violates check constraint "progress_data_size"',
      }),
    ).toBe(true);
    expect(isCheckViolation({ code: '08006', message: 'connection failure' })).toBe(false);
  });
});

/* ---------------------------------------------------- deciding who you are */

describe('isDefinitiveAuthFailure', () => {
  /* Being offline, or Supabase having a bad minute, used to sign a student out
     into the guest world. Only the server saying "no" may do that. */
  it('treats network failures, 5xx and 429 as no answer', () => {
    expect(isDefinitiveAuthFailure(new AuthRetryableFetchError('Failed to fetch', 0))).toBe(false);
    expect(isDefinitiveAuthFailure(new AuthRetryableFetchError('Bad gateway', 502))).toBe(false);
    expect(isDefinitiveAuthFailure(new AuthApiError('Too many requests', 429, undefined))).toBe(
      false,
    );
    expect(isDefinitiveAuthFailure(new TypeError('Failed to fetch'))).toBe(false);
  });

  it('treats a missing or rejected session as over', () => {
    expect(isDefinitiveAuthFailure(new AuthSessionMissingError())).toBe(true);
    expect(isDefinitiveAuthFailure(new AuthApiError('bad jwt', 403, 'bad_jwt'))).toBe(true);
    expect(
      isDefinitiveAuthFailure(
        new AuthApiError('Invalid Refresh Token', 400, 'refresh_token_not_found'),
      ),
    ).toBe(true);
  });
});

/* ------------------------------------------------------------ copy mapping */

describe('friendlyError', () => {
  it('says what is actually wrong with a reused password', () => {
    expect(friendlyError('New password should be different from the old password.')).toBe(
      'Your new password must be different from your current one.',
    );
    expect(friendlyError('Password should be at least 8 characters.')).toBe(
      'Password must be at least 8 characters.',
    );
  });

  it('turns the email cooldown into a plain instruction', () => {
    expect(
      friendlyError('For security purposes, you can only request this after 42 seconds.'),
    ).toBe('Please wait a minute before asking for another email.');
  });
});

/* ------------------------------------------------------------- keepalive */

describe('keepaliveFetch', () => {
  it('strips the marker and sets keepalive on a small marked request', async () => {
    const base = vi.fn(async () => new Response('ok'));
    const f = keepaliveFetch(base as unknown as typeof fetch);
    await f('https://x.test/rpc', {
      method: 'POST',
      body: '{"a":1}',
      headers: new Headers({ [KEEPALIVE_HEADER]: '1', apikey: 'k' }),
    });
    const init = (base.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.keepalive).toBe(true);
    expect(new Headers(init.headers).has(KEEPALIVE_HEADER)).toBe(false);
    expect(new Headers(init.headers).get('apikey')).toBe('k');
  });

  /* Over 64 KiB the browser rejects a keepalive request outright, which is
     worse than an ordinary best-effort send. */
  it('sends a large body without the flag', async () => {
    const base = vi.fn(async () => new Response('ok'));
    await keepaliveFetch(base as unknown as typeof fetch)('https://x.test/rpc', {
      method: 'POST',
      body: 'x'.repeat(70_000),
      headers: { [KEEPALIVE_HEADER]: '1' },
    });
    const init = (base.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.keepalive).toBeUndefined();
  });

  it('leaves unmarked requests exactly as they were', async () => {
    const base = vi.fn(async () => new Response('ok'));
    const init = { method: 'GET' };
    await keepaliveFetch(base as unknown as typeof fetch)('https://x.test/', init);
    expect((base.mock.calls[0] as unknown as [string, RequestInit])[1]).toBe(init);
  });
});

/* ---------------------------------------------------------- the daily bonus */

describe('completeDaily', () => {
  it('does not pay for a day already covered by a later stamp', () => {
    const p = { ...emptyProgress(), dailyDoneOn: '2026-10-02' };
    expect(completeDaily(p, '2026-10-01').xpGained).toBe(0);
    expect(completeDaily(p, '2026-10-02').xpGained).toBe(0);
    expect(completeDaily(p, '2026-10-03').xpGained).toBe(XP.dailyChallenge);
  });
});

/* ------------------------------------------------------- graduated reviews */

describe('mergeProgress and graduated reviews', () => {
  it('does not resurrect a question graduated on one device from another device’s stale copy', () => {
    const scheduled = Date.now() - 20 * DAY;
    const stale = { box: 4, due: scheduled + 16 * DAY };
    const phone = { ...emptyProgress(), review: { q1: stale } };
    // On the laptop the question went 4 -> graduated.
    const laptop = recordAttempt(
      { ...emptyProgress(), review: { q1: stale } },
      { qid: 'q1', section: 'english', topic: 'commas', correct: true, ms: 40_000 },
      10,
    ).progress;
    expect(laptop.review.q1).toBeUndefined();

    expect(mergeProgress(laptop, phone).review.q1).toBeUndefined();
    expect(mergeProgress(phone, laptop).review.q1).toBeUndefined();
  });

  it('keeps a miss that came after the graduation', () => {
    const graduatedAt = Date.now() - 10 * DAY;
    const freshMiss = { box: 0, due: Date.now(), misses: 1 };
    const a = { ...emptyProgress(), graduated: { q1: graduatedAt } };
    const b = { ...emptyProgress(), review: { q1: freshMiss } };
    expect(mergeProgress(a, b).review.q1).toEqual(freshMiss);
  });
});

/* ------------------------------------------------------------- reset epoch */

describe('mergeProgress across a reset', () => {
  it('discards the side from before the reset, in either direction', () => {
    const old = { ...emptyProgress(), xp: 5000, notesRead: ['n1'] };
    const fresh = { ...emptyProgress(), resetAt: Date.now() };
    for (const merged of [mergeProgress(old, fresh), mergeProgress(fresh, old)]) {
      expect(merged.xp).toBe(0);
      expect(merged.notesRead).toEqual([]);
      expect(merged.resetAt).toBe(fresh.resetAt);
    }
  });

  it('merges normally once both sides share the epoch', () => {
    const at = Date.now();
    const a = { ...emptyProgress(), resetAt: at, xp: 30 };
    const b = { ...emptyProgress(), resetAt: at, xp: 50 };
    expect(mergeProgress(a, b).xp).toBe(50);
  });
});

/* -------------------------------------------------------- legacy migration */

describe('the single-file build’s save', () => {
  function plantLegacy() {
    localStorage.setItem(STORAGE_KEYS.legacyProgress, JSON.stringify({ xp: 1234 }));
  }

  it('migrates into the guest world once, and is removed', () => {
    plantLegacy();
    expect(loadProgress(GUEST).xp).toBe(1234);
    expect(localStorage.getItem(STORAGE_KEYS.legacyProgress)).toBeNull();
    expect(loadProgress(GUEST).xp).toBe(1234); // saved, not re-derived
  });

  /* It used to land in every empty identity — including every account that
     signed in on this browser for the first time, which then synced it up. */
  it('never lands in an account', () => {
    plantLegacy();
    expect(loadProgress(progressKeyFor({ kind: 'cloud', userId: 'u1' })).xp).toBe(0);
  });
});

/* ------------------------------------------------------------ bad records */

describe('normalizeProgress on a damaged record', () => {
  it('replaces every wrong-typed field instead of crashing a render', () => {
    const p = normalizeProgress({
      xp: null,
      lastActiveDay: 20260801,
      dailyDoneOn: {},
      dayStreak: 'seven',
      review: { q1: null, q2: { due: 'soon', box: 1 }, q3: { due: 5, box: 9 } },
      notesRead: ['a', 3, null],
      zonesCleared: { z1: 'x', z2: 90 },
      tally: { answered: 2, correct: 1, topics: { 'english::a': null }, daily: { d: 'x' } },
      profile: 'yes',
      attempts: [null, { qid: 'q' }],
    } as unknown as Partial<Progress>);

    expect(p.xp).toBe(0);
    expect(p.lastActiveDay).toBeNull();
    expect(p.dailyDoneOn).toBeNull();
    expect(p.dayStreak).toBe(0);
    expect(Object.keys(p.review)).toEqual(['q3']);
    expect(p.review.q3!.box).toBe(5);
    expect(p.notesRead).toEqual(['a']);
    expect(p.zonesCleared).toEqual({ z2: 90 });
    expect(p.tally.topics).toEqual({});
    expect(p.tally.daily).toEqual({});
    expect(p.profile).toBeNull();
    expect(p.attempts).toEqual([]);
  });

  it('treats a stored non-object as no record', () => {
    expect(normalizeProgress(42 as unknown as Partial<Progress>)).toEqual(emptyProgress());
  });
});

/* -------------------------------------------------------------- storage */

describe('storage when the quota is full', () => {
  afterEach(() => vi.restoreAllMocks());

  /* The failed write was kept in memory, but reads went to localStorage first
     and handed back the value from before it. */
  it('reads back the value it could not persist, not the stale one', () => {
    writeRaw('act-command:test', 'old');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    writeRaw('act-command:test', 'new');
    expect(readRaw('act-command:test')).toBe('new');

    vi.restoreAllMocks();
    writeRaw('act-command:test', 'newer'); // persisted after all
    expect(readRaw('act-command:test')).toBe('newer');
  });

  it('clears this app’s data but keeps what it is told to keep', () => {
    localStorage.setItem('act-command:progress:v2:guest', '{}');
    localStorage.setItem('act-command:age-verdict', 'too-young');
    localStorage.setItem('sb-proj-auth-token', '{}');
    clearDeviceData(['act-command:age-verdict']);
    expect(localStorage.getItem('act-command:progress:v2:guest')).toBeNull();
    expect(localStorage.getItem('act-command:age-verdict')).toBe('too-young');
    expect(localStorage.getItem('sb-proj-auth-token')).toBe('{}');
  });
});

/* ---------------------------------------------------------- stale deploys */

describe('chunk reload', () => {
  afterEach(() => vi.restoreAllMocks());

  it('recognises each engine’s failed dynamic import', () => {
    expect(
      isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /a.js')),
    ).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('error loading dynamically imported module'))).toBe(true);
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
  });

  it('reloads once, then not again until the cooldown has passed', () => {
    const reload = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      reload,
    } as Location);
    const t = 1_800_000_000_000;
    expect(reloadForNewBuild(t)).toBe(true);
    expect(reloadForNewBuild(t + 1000)).toBe(false);
    expect(reloadForNewBuild(t + RELOAD_COOLDOWN_MS + 1)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });
});

/* The other half of a reset: the fresh world written to disk must come back as
   a fresh world with its epoch, or the next merge cannot honour it. */
describe('a reset written to disk', () => {
  it('loads back as an empty world carrying its epoch', () => {
    const fresh = { ...emptyProgress(), resetAt: 123 };
    saveProgress(fresh, GUEST);
    expect(loadProgress(GUEST).resetAt).toBe(123);
  });
});
