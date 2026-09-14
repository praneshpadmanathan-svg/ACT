/* What the person in front of us is entitled to.
 *
 * The row this reads is written only by Edge Functions holding the service
 * role key — see supabase/migrations/0003_entitlements.sql, which enables RLS
 * and then deliberately declares no policy but SELECT. So nothing in this file
 * can grant anything; it reads a server's answer and decides what to show.
 *
 * Two things here are load bearing and easy to get wrong:
 *
 *   1. A *cancelled* subscription keeps Pro until the period the person
 *      already paid for runs out. Cutting them off at the moment they click
 *      cancel is the single most common billing complaint there is, and it is
 *      also just taking money for nothing.
 *
 *   2. The offline cache is bounded. The app works fully offline and that must
 *      not regress, so the last known entitlement is honoured while the
 *      network is gone — but for a fixed window, and never as a bare boolean
 *      that outlives a sign-out. An unbounded cached `isPro: true` is a
 *      permanent unlock for anyone who goes offline once.
 */

import { supabase, cloudEnabled } from './supabase';
import { readJSON, removeRaw, writeJSON, STORAGE_KEYS } from './storage';
import { reportWarn } from './report';

export type Plan = 'free' | 'pro';

export type EntitlementStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired';

export type EntitlementSource = 'trial' | 'purchase' | 'code';

export interface Entitlement {
  plan: Plan;
  status: EntitlementStatus;
  /** Epoch ms, or null once they are a paying subscriber. */
  trialEndsAt: number | null;
  /** Epoch ms. Null means "granted and does not expire" — what a redeemed
   *  code writes. */
  currentPeriodEnd: number | null;
  source: EntitlementSource | null;
}

/* Grace on a subscription whose period end has passed but whose status still
 * says active or past_due.
 *
 * Renewal is a webhook, and a webhook can be late: the provider can have an
 * incident, our function can be down, a delivery can be retried for an hour.
 * Being strict to the second means a paying subscriber is locked out of a test
 * they are in the middle of because someone else's server hiccupped. Being
 * lenient forever means a lapsed subscription never lapses. Three days is long
 * enough to cover any realistic delivery failure and short enough that an
 * abandoned card stops working in the same week. */
const RENEWAL_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * The one question the whole scheme answers.
 *
 * Exported on its own, with `now` injectable, because the trial boundary is
 * exactly the kind of thing that is only ever tested if testing it is easy.
 */
export function isPro(e: Entitlement | null, now: number = Date.now()): boolean {
  if (!e) return false;
  switch (e.status) {
    case 'trialing':
      return e.trialEndsAt !== null && e.trialEndsAt > now;

    case 'active':
      // Null period end is the non-expiring grant a code redemption writes.
      return e.currentPeriodEnd === null || e.currentPeriodEnd + RENEWAL_GRACE_MS > now;

    // Cancelled but paid through, or a failed payment the provider is still
    // retrying. Both keep what they paid for until it actually runs out.
    case 'past_due':
      return e.currentPeriodEnd !== null && e.currentPeriodEnd + RENEWAL_GRACE_MS > now;
    case 'canceled':
      return e.currentPeriodEnd !== null && e.currentPeriodEnd > now;

    case 'expired':
      return false;
  }
}

/**
 * Whole days of trial left, floored, or null if there is no trial running.
 *
 * Null covers three different situations that every caller wants to treat the
 * same way: never had a trial, already a subscriber, and — the one that bit —
 * a trial that has already ended. This used to return `0` for that last case,
 * which reads as "a trial with no days left" rather than "no trial", and the
 * plan panel duly went on describing an expired trial as a running one while
 * the header beside it said Unlock Pro. `0` now means exactly one thing: the
 * trial is live and ends before tomorrow. Ask `trialExpired` for the other.
 */
export function trialDaysLeft(e: Entitlement | null, now: number = Date.now()): number | null {
  if (!e || e.status !== 'trialing' || e.trialEndsAt === null) return null;
  const ms = e.trialEndsAt - now;
  if (ms <= 0) return null;
  return Math.floor(ms / 86_400_000);
}

/** True once a trial has run out and nothing has replaced it. */
export function trialExpired(e: Entitlement | null, now: number = Date.now()): boolean {
  return e !== null && e.status === 'trialing' && e.trialEndsAt !== null && e.trialEndsAt <= now;
}

/* ------------------------------------------------------------------ loading */

interface EntitlementRow {
  plan: Plan;
  status: EntitlementStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
  source: EntitlementSource | null;
}

const ms = (iso: string | null): number | null => (iso ? new Date(iso).getTime() : null);

function fromRow(row: EntitlementRow): Entitlement {
  return {
    plan: row.plan,
    status: row.status,
    trialEndsAt: ms(row.trial_ends_at),
    currentPeriodEnd: ms(row.current_period_end),
    source: row.source,
  };
}

export type EntitlementResult =
  | { status: 'ok'; entitlement: Entitlement }
  /** Signed in, but no row — treat as free, not as an error. */
  | { status: 'none' }
  | { status: 'error'; message: string };

/**
 * Read the caller's own entitlement.
 *
 * No user id is passed. The RLS policy compares `auth.uid()` against the row,
 * so the only row this can return is the caller's — there is no parameter here
 * that could name someone else's.
 */
export async function fetchEntitlement(): Promise<EntitlementResult> {
  if (!supabase) return { status: 'error', message: 'Accounts are not configured.' };
  const { data, error } = await supabase
    .from('entitlements')
    .select('plan, status, trial_ends_at, current_period_end, source')
    .maybeSingle<EntitlementRow>();

  if (error) {
    reportWarn('entitlement.fetch', error.message);
    return { status: 'error', message: error.message };
  }
  if (!data) return { status: 'none' };
  return { status: 'ok', entitlement: fromRow(data) };
}

/* -------------------------------------------------------------- the cache */

/* How long a cached entitlement is honoured with no successful refresh.
 *
 * This is what keeps a subscriber working on a plane. It is not a second
 * source of truth: every load still asks the server, and a *successful* answer
 * always wins, including a successful answer that says "free". Only silence
 * falls back to this, and only for a week. */
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface CachedEntitlement {
  /** Which account this belongs to. A cache from another sign-in is ignored. */
  userId: string;
  fetchedAt: number;
  entitlement: Entitlement;
}

const cacheKey = (userId: string) => `${STORAGE_KEYS.entitlement}:${userId}`;

export function cacheEntitlement(userId: string, entitlement: Entitlement): void {
  writeJSON(cacheKey(userId), { userId, fetchedAt: Date.now(), entitlement });
}

/** The last known entitlement for this account, if it is still fresh. */
export function cachedEntitlement(userId: string, now: number = Date.now()): Entitlement | null {
  const raw = readJSON<CachedEntitlement | null>(cacheKey(userId), null);
  if (!raw || raw.userId !== userId) return null;
  if (!Number.isFinite(raw.fetchedAt) || now - raw.fetchedAt > CACHE_TTL_MS) return null;
  return raw.entitlement;
}

export function clearCachedEntitlement(userId: string): void {
  removeRaw(cacheKey(userId));
}

/* ---------------------------------------------------------------- the gate */

/**
 * Whether Pro features are open, for the app as a whole.
 *
 * `cloudEnabled` is false when no Supabase env vars are set. That is the
 * documented `git clone && npm install && npm run dev` mode, and it is also how
 * anyone self-hosting this runs it. There is no account system in that mode, so
 * there is nothing an entitlement could be attached to and no one to bill —
 * gating there would only break the setup the README promises. Everything is
 * open.
 */
export function proUnlocked(entitlement: Entitlement | null, now?: number): boolean {
  if (!cloudEnabled) return true;
  return isPro(entitlement, now);
}

/* ------------------------------------------------------------- redeeming */

export type RedeemResult =
  { status: 'ok'; alreadyHeld: boolean } | { status: 'error'; message: string };

/**
 * Hand a code to the server and see what it says.
 *
 * Note what this function does *not* do: it does not decide anything. There is
 * no comparison here, no list of valid codes, no `if (code === ...)`. The whole
 * point of the scheme is that a browser cannot tell a real code from a wrong
 * one — everything the bundle can check, a reader of the bundle can forge — so
 * the only thing on this side is a POST and a message to display.
 *
 * On success the caller must refresh the entitlement rather than assume: the
 * grant is a row the server wrote, and reading it back is what keeps this file
 * free of any opinion about what was granted.
 */
export async function redeemCode(code: string): Promise<RedeemResult> {
  if (!supabase) return { status: 'error', message: 'Accounts are not configured.' };

  const trimmed = code.trim();
  /* A local length check, but only to save a round trip on an empty box — the
     server applies its own, and the server's is the one that counts. */
  if (trimmed.length < 4) return { status: 'error', message: 'Enter your code.' };

  const { data, error } = await supabase.functions.invoke<{
    ok?: boolean;
    alreadyHeld?: boolean;
    error?: string;
  }>('redeem-code', { method: 'POST', body: { code: trimmed } });

  if (error) {
    /* `functions.invoke` reports any non-2xx as an error and leaves the body
       in `context`, so the server's own wording — "too many attempts", "that
       code is not valid" — has to be dug out or it is replaced by a generic
       network message that tells the person nothing. */
    const fromServer = await readFunctionError(error);
    reportWarn('entitlement.redeem', fromServer ?? error.message);
    return { status: 'error', message: fromServer ?? 'Could not reach the server. Try again.' };
  }
  if (data?.error) return { status: 'error', message: data.error };
  if (!data?.ok) return { status: 'error', message: 'Could not apply that code.' };

  return { status: 'ok', alreadyHeld: data.alreadyHeld === true };
}

/** Pull the JSON `error` out of a FunctionsHttpError, if there is one. */
async function readFunctionError(error: unknown): Promise<string | null> {
  const res = (error as { context?: unknown })?.context;
  if (!(res instanceof Response)) return null;
  try {
    const body = (await res.json()) as { error?: unknown };
    return typeof body.error === 'string' ? body.error : null;
  } catch {
    return null;
  }
}
