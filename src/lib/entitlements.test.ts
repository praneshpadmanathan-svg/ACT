/* The boundaries where money and access meet.

   Every case here is one where being wrong costs something real in one
   direction or the other: a paying subscriber locked out of a test they are
   halfway through, or an expired trial that never expires. Both fail
   silently — nobody files a bug saying "I am still getting Pro for free" —
   which is exactly why they are pinned here rather than trusted to a reread
   of the switch statement.

   `isPro` takes an injectable `now` for this reason; none of these tests
   touch the clock. */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cacheEntitlement,
  cachedEntitlement,
  clearCachedEntitlement,
  isPro,
  trialDaysLeft,
  trialExpired,
  type Entitlement,
} from './entitlements';

const DAY = 86_400_000;
const NOW = 1_750_000_000_000;

function ent(over: Partial<Entitlement> = {}): Entitlement {
  return {
    plan: 'pro',
    status: 'active',
    trialEndsAt: null,
    currentPeriodEnd: NOW + 30 * DAY,
    source: 'purchase',
    ...over,
  };
}

afterEach(() => {
  window.localStorage.clear();
  vi.useRealTimers();
});

describe('isPro', () => {
  it('is false with no entitlement at all', () => {
    // A missing row is the free tier, not an error state.
    expect(isPro(null, NOW)).toBe(false);
  });

  it('honours a trial right up to its final second, and not past it', () => {
    const trial = ent({ status: 'trialing', trialEndsAt: NOW + 1, currentPeriodEnd: null });
    expect(isPro(trial, NOW)).toBe(true);
    expect(isPro({ ...trial, trialEndsAt: NOW }, NOW)).toBe(false);
  });

  it('refuses a trialing row with no end date', () => {
    /* Null here would mean "a trial that never ends" if the check were a
       bare truthiness test on the status. The trigger always writes a date;
       a row without one is corrupt, and corrupt must fail closed. */
    expect(isPro(ent({ status: 'trialing', trialEndsAt: null }), NOW)).toBe(false);
  });

  it('keeps a cancelled subscription alive until the paid period ends', () => {
    const cancelled = ent({ status: 'canceled', currentPeriodEnd: NOW + DAY });
    expect(isPro(cancelled, NOW)).toBe(true);
    expect(isPro({ ...cancelled, currentPeriodEnd: NOW - 1 }, NOW)).toBe(false);
  });

  it('gives a cancelled subscription no renewal grace', () => {
    /* Grace exists to cover a late renewal webhook. A cancellation has no
       renewal coming, so extending it would be three free days handed to
       everyone who cancels — the one case where grace is just a leak. */
    expect(isPro(ent({ status: 'canceled', currentPeriodEnd: NOW - 1 }), NOW)).toBe(false);
  });

  it('carries an active subscription through a late renewal, but not indefinitely', () => {
    const lapsed = ent({ currentPeriodEnd: NOW - 2 * DAY });
    expect(isPro(lapsed, NOW)).toBe(true);
    expect(isPro({ ...lapsed, currentPeriodEnd: NOW - 4 * DAY }, NOW)).toBe(false);
  });

  it('treats a null period end on an active row as a non-expiring grant', () => {
    // This is what a redeemed code writes.
    expect(isPro(ent({ currentPeriodEnd: null, source: 'code' }), NOW)).toBe(true);
  });

  it('gives past_due the same grace window and no more', () => {
    expect(isPro(ent({ status: 'past_due', currentPeriodEnd: NOW - 2 * DAY }), NOW)).toBe(true);
    expect(isPro(ent({ status: 'past_due', currentPeriodEnd: NOW - 4 * DAY }), NOW)).toBe(false);
  });

  it('never grants past_due with no period end', () => {
    /* An active row with a null end is a deliberate permanent grant. A
       past_due row with a null end is a payment failure on a row we cannot
       date — it must not inherit the permanent-grant rule. */
    expect(isPro(ent({ status: 'past_due', currentPeriodEnd: null }), NOW)).toBe(false);
  });

  it('is false for expired regardless of what the dates say', () => {
    expect(isPro(ent({ status: 'expired', currentPeriodEnd: NOW + 30 * DAY }), NOW)).toBe(false);
  });
});

describe('trial reporting', () => {
  it('floors the days remaining', () => {
    const nearly = ent({
      status: 'trialing',
      trialEndsAt: NOW + 2 * DAY + 1,
      currentPeriodEnd: null,
    });
    expect(trialDaysLeft(nearly, NOW)).toBe(2);
  });

  it('reports zero on the final day, and nothing once it is over', () => {
    /* The distinction the plan panel got wrong: zero is a live trial ending
       tonight, null is no trial at all. Both used to be zero, and the panel
       went on calling an expired trial a running one. */
    const tonight = ent({ status: 'trialing', trialEndsAt: NOW + 60_000, currentPeriodEnd: null });
    expect(trialDaysLeft(tonight, NOW)).toBe(0);

    const over = ent({ status: 'trialing', trialEndsAt: NOW - DAY, currentPeriodEnd: null });
    expect(trialDaysLeft(over, NOW)).toBeNull();
    expect(trialExpired(over, NOW)).toBe(true);
  });

  it('reports nothing for anyone not on a trial', () => {
    // The HUD pill keys off null to render nothing at all for a subscriber.
    expect(trialDaysLeft(ent(), NOW)).toBeNull();
    expect(trialDaysLeft(null, NOW)).toBeNull();
  });

  it('distinguishes an ended trial from never having had one', () => {
    expect(trialExpired(ent({ status: 'trialing', trialEndsAt: NOW - 1 }), NOW)).toBe(true);
    expect(trialExpired(ent({ status: 'trialing', trialEndsAt: NOW + 1 }), NOW)).toBe(false);
    expect(trialExpired(ent(), NOW)).toBe(false);
    expect(trialExpired(null, NOW)).toBe(false);
  });
});

describe('the offline cache', () => {
  it('round-trips an entitlement for the account that wrote it', () => {
    cacheEntitlement('user-a', ent());
    expect(cachedEntitlement('user-a')).toEqual(ent());
  });

  it('does not hand one account the cache of another', () => {
    /* Sign out, sign in as someone else on a shared machine: the previous
       account's Pro must not follow them. The key is per-user and the stored
       id is checked again on read, so this fails twice over. */
    cacheEntitlement('user-a', ent());
    expect(cachedEntitlement('user-b')).toBeNull();
  });

  it('expires the cache rather than trusting it forever', () => {
    cacheEntitlement('user-a', ent());
    const eightDays = Date.now() + 8 * DAY;
    expect(cachedEntitlement('user-a', eightDays)).toBeNull();
  });

  it('still honours the cache inside the window', () => {
    cacheEntitlement('user-a', ent());
    expect(cachedEntitlement('user-a', Date.now() + 6 * DAY)).not.toBeNull();
  });

  it('forgets on demand', () => {
    cacheEntitlement('user-a', ent());
    clearCachedEntitlement('user-a');
    expect(cachedEntitlement('user-a')).toBeNull();
  });

  it('survives a corrupted cache entry without throwing', () => {
    window.localStorage.setItem('act-command:entitlement:v1:user-a', '{not json');
    expect(cachedEntitlement('user-a')).toBeNull();
  });
});
