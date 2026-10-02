/* Supabase auth + progress sync.

   This is the only account system now. The device-password path it used to
   share the job with is gone — see the note at the top of identity.ts.

   Config comes from env vars. With none set the app still runs completely,
   local-only, which is what `cloudEnabled` gates on. That keeps
   `git clone && npm install && npm run dev` working for anyone, and it is also
   the mode under-13s stay in. */

import {
  createClient,
  isAuthApiError,
  isAuthRetryableFetchError,
  isAuthSessionMissingError,
  type SupabaseClient,
  type User,
} from '@supabase/supabase-js';
import type { Progress } from '@/types';
import { normalizeProgress } from './progress';
import { reportWarn, setRemoteSink, type RemoteError } from './report';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const cloudEnabled = Boolean(url && anonKey);

/* Every request to Supabase gets a deadline.

   None of them had one. `fetch` has no default timeout, so a request that is
   accepted and then never answered — a paused free-tier project waking up, a
   captive-portal wifi that swallows TLS, a phone that changed networks
   mid-flight — leaves a promise that never settles. Every caller in this file
   is written to handle a *failure*; not one of them can handle silence. The
   symptom is the whole app frozen on its loading screen with nothing to tap.

   20 seconds is well past a slow-but-working request on a phone, and well
   short of a person's patience. A timeout surfaces as an `AbortError`, which
   is a network failure like any other and already lands in the tri-state
   error paths below. */
export const REQUEST_TIMEOUT_MS = 20_000;

/** Wrap a fetch so no request can outlive `ms`. Exported for its test. */
export function withTimeout(base: typeof fetch, ms = REQUEST_TIMEOUT_MS): typeof fetch {
  return (input, init) => {
    const outer = init?.signal;
    if (outer?.aborted) return base(input, init);
    const ctrl = new AbortController();
    const timer = setTimeout(
      () => ctrl.abort(new DOMException('Request timed out', 'TimeoutError')),
      ms,
    );
    // A caller's own abort (a React unmount, a retry) still has to win.
    outer?.addEventListener('abort', () => ctrl.abort(outer.reason), { once: true });
    return base(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer));
  };
}

/** A request header that never leaves the browser: it asks `keepaliveFetch`
 *  to send this one request with `keepalive`, and is stripped before it does. */
export const KEEPALIVE_HEADER = 'x-act-keepalive';

/** Chrome refuses a keepalive request whose body pushes the in-flight total
 *  past 64 KiB, rather than sending it without the flag. Leave headroom. */
const KEEPALIVE_MAX_BODY = 60_000;

/**
 * Let one marked request outlive the page.
 *
 * The flush when a tab is hidden is the last chance to save a session's work,
 * and an ordinary fetch is cancelled the moment the page unloads. `keepalive`
 * is what lets it finish — but supabase-js has no per-call fetch options, so
 * the call is marked with a header and the flag is applied here. Only below
 * the size limit: over it, the browser rejects the request outright, which is
 * worse than the best-effort send it would otherwise get. Exported for its test.
 */
export function keepaliveFetch(base: typeof fetch): typeof fetch {
  return (input, init) => {
    const headers = new Headers(init?.headers);
    if (!headers.has(KEEPALIVE_HEADER)) return base(input, init);
    headers.delete(KEEPALIVE_HEADER);
    const body = init?.body;
    const small = typeof body === 'string' && body.length < KEEPALIVE_MAX_BODY;
    return base(input, { ...init, headers, ...(small ? { keepalive: true } : {}) });
  };
}

const timedFetch: typeof fetch = (input, init) => withTimeout(keepaliveFetch(fetch))(input, init);

export const supabase: SupabaseClient | null = cloudEnabled
  ? createClient(url!, anonKey!, {
      global: { fetch: timedFetch },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        /* PKCE, and the redirect handled by hand.

           Two reasons, both about this app's hash router.

           The implicit flow returns tokens in the URL *fragment*
           (`#access_token=...`), which is the same place `#/map` lives. The
           router would parse the token as a route and the app would land
           somewhere arbitrary with the credential sitting in the address bar.
           PKCE returns `?code=` in the query string instead, which the hash
           router ignores completely.

           And `detectSessionInUrl` races that same router: it consumes the code
           asynchronously on client construction, while the app is already
           deciding what to render. Doing the exchange ourselves in
           `consumeAuthRedirect` means the answer is known before the first
           paint, and the reason we are back on the site — confirmation, reset,
           magic link — survives the round trip. */
        flowType: 'pkce',
        detectSessionInUrl: false,
      },
    })
  : null;

/** Row shape of the `progress` table. See supabase/migrations/. */
interface ProgressRow {
  user_id: string;
  display_name: string | null;
  data: CloudProgress;
  updated_at: string;
}

export interface AuthResult {
  ok: boolean;
  /** Set when the provider wants the address confirmed before first sign-in. */
  needsConfirmation?: boolean;
  error?: string;
}

/* Turn a provider error into something a 15-year-old can act on.
 *
 * The default case is deliberately generic. It used to return the provider's
 * own message, which puts text we do not control and have not read onto the
 * screen — internal identifiers, policy names, whatever a future Supabase
 * release decides to say. Anything worth telling someone is matched
 * explicitly; everything else is a bug for us to find in the console, not a
 * riddle for them to solve. */
export function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'That email and password combination did not match.';
  /* Both of these mention a password or a limit, so they have to be matched
     before the broad rules below — which turned "pick a different password
     from your old one" into "must be at least 8 characters", advice the
     student had already followed. */
  if (m.includes('should be different from the old password')) {
    return 'Your new password must be different from your current one.';
  }
  if (m.includes('for security purposes') && m.includes('only request this after')) {
    return 'Please wait a minute before asking for another email.';
  }
  if (m.includes('weak') || m.includes('pwned') || m.includes('compromised')) {
    return 'That password has turned up in a known data breach. Please pick a different one.';
  }
  if (m.includes('should be at least') || m.includes('password')) {
    return 'Password must be at least 8 characters.';
  }
  if (m.includes('rate limit') || m.includes('too many') || m.includes('429')) {
    return 'Too many attempts. Wait a minute and try again.';
  }
  if (m.includes('expired') || m.includes('invalid token') || m.includes('otp')) {
    return 'That code has expired or was mistyped. Ask for a new one.';
  }
  if (m.includes('session') && m.includes('missing')) {
    return 'This link has expired. Ask for a new one and open it straight away.';
  }
  if (m.includes('email') && m.includes('confirm')) {
    return 'Confirm your email first — check your inbox for the link we sent.';
  }
  if (m.includes('fetch') || m.includes('network') || m.includes('failed to fetch')) {
    return 'Could not reach the server. Check your connection and try again.';
  }
  reportWarn('auth.unmapped', message);
  return 'Something went wrong at our end. Please try again in a moment.';
}

/* Whether a given email already has an account here is not something a
   stranger gets to find out.
 *
 * The password form is already careful — a wrong address and a wrong password
 * produce the same sentence. These two paths quietly undid that: sign-up
 * answered "that email already has an account", and the emailed-code path,
 * which passes `shouldCreateUser: false`, errored for any address without one.
 * Either would let someone check a list of addresses against this site, and
 * this site's users are children.
 *
 * So both now give the identical answer either way, and the email does the
 * disambiguating — it arrives only for the person who owns the address. */
const enumerationSafe = (message: string): boolean => {
  const m = message.toLowerCase();
  return (
    m.includes('already registered') ||
    m.includes('already been registered') ||
    m.includes('user already exists') ||
    m.includes('signups not allowed') ||
    m.includes('not found')
  );
};

/** Where Supabase sends people back to, carrying why they left. */
function redirectTo(flow: 'confirm' | 'reset'): string {
  return `${window.location.origin}/?flow=${flow}`;
}

/* ------------------------------------------------------------------- auth */

export async function signUp(name: string, email: string, password: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: 'Accounts are not configured for this deployment.' };
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: name }, emailRedirectTo: redirectTo('confirm') },
  });
  if (error) {
    /* "That address is taken" is the same sentence as "that address has an
       account here", so it goes to the check-your-email screen instead. The
       person who owns the inbox finds out; nobody else does. */
    if (enumerationSafe(error.message)) return { ok: true, needsConfirmation: true };
    return { ok: false, error: friendlyError(error.message) };
  }
  // No session back means the project requires email confirmation.
  return { ok: true, needsConfirmation: !data.session };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: 'Accounts are not configured for this deployment.' };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: friendlyError(error.message) };
  return { ok: true };
}

/** Email a one-time code (and a link, which also works) to an existing account. */
export async function sendLoginCode(email: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: 'Accounts are not configured for this deployment.' };
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: redirectTo('confirm') },
  });
  if (error) {
    // Same answer whether or not the address has an account — see above.
    if (enumerationSafe(error.message)) return { ok: true };
    return { ok: false, error: friendlyError(error.message) };
  }
  return { ok: true };
}

export async function verifyLoginCode(email: string, token: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: 'Accounts are not configured for this deployment.' };
  const { error } = await supabase.auth.verifyOtp({ email, token: token.trim(), type: 'email' });
  if (error) return { ok: false, error: friendlyError(error.message) };
  return { ok: true };
}

export async function requestPasswordReset(email: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: 'Accounts are not configured for this deployment.' };
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectTo('reset'),
  });
  if (error) return { ok: false, error: friendlyError(error.message) };
  return { ok: true };
}

export async function setNewPassword(password: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: 'Accounts are not configured for this deployment.' };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: friendlyError(error.message) };
  return { ok: true };
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}

/* ------------------------------------------------------- who is signed in */

/* Who is signed in is decided from what is on this device, and only *checked*
   against the server.

   This used to ask `auth.getUser()`, which is a network round trip, and treat
   anything but a user as "signed out". So on a train, in a lift, during a
   Supabase outage or a 429, a signed-in student booted as a guest: onboarding
   again, and every answer that session saved under the guest key, where their
   account never saw it. A failed request is not evidence of anything about
   the session. Only the auth server saying so is. */

/** How long boot waits on `getSession()` before reading the stored copy. It is
 *  local unless the access token has expired, when it refreshes — which,
 *  offline, retries with backoff for up to half a minute. */
const SESSION_LOOKUP_MS = 4_000;

/** The key supabase-js persists the session under — its own default, which
 *  this app has never overridden, so existing sessions stay where they are. */
const sessionStorageKey = url ? `sb-${new URL(url).hostname.split('.')[0]}-auth-token` : '';

/** The signed-in user as last persisted, read straight off disk. No network,
 *  no lock, no refresh: the identity a session belongs to, nothing more. */
export function storedSessionUser(): User | null {
  if (!sessionStorageKey) return null;
  try {
    const raw = window.localStorage.getItem(sessionStorageKey);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { refresh_token?: unknown; user?: User } | null;
    return typeof saved?.refresh_token === 'string' && typeof saved.user?.id === 'string'
      ? saved.user
      : null;
  } catch {
    return null;
  }
}

/**
 * Whether an auth error is the server saying this session is over — as
 * opposed to failing to say anything.
 *
 * Over: no session at all, or a 4xx from the auth API (a revoked or rotated
 * refresh token, a deleted user, a JWT it refuses). Not over: a network
 * failure, a timeout, any 5xx, and a 429 — which is the server being busy,
 * and says nothing about who you are.
 */
export function isDefinitiveAuthFailure(error: unknown): boolean {
  if (isAuthSessionMissingError(error)) return true;
  if (isAuthRetryableFetchError(error)) return false;
  if (!isAuthApiError(error)) return false;
  return [400, 401, 403, 404].includes(error.status);
}

/**
 * The account this device is signed in to, decided locally.
 *
 * `getSession()` first, which is the library's own answer and reads storage
 * unless a refresh is due. If that refresh cannot reach the server — or takes
 * longer than boot should wait — the stored session is still there (the
 * library only deletes it when the server rejects it), so its user is read
 * directly. Null only when there is no session, or the server has ended it.
 */
export async function sessionUser(): Promise<User | null> {
  if (!supabase) return null;
  const client = supabase;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const lookup = await Promise.race([
      client.auth.getSession(),
      new Promise<'slow'>((resolve) => {
        timer = setTimeout(() => resolve('slow'), SESSION_LOOKUP_MS);
      }),
    ]);
    if (lookup === 'slow') return storedSessionUser();
    const { data, error } = lookup;
    if (data.session?.user) return data.session.user;
    if (error && !isDefinitiveAuthFailure(error)) return storedSessionUser();
    return null;
  } catch (err) {
    reportWarn('auth.session', err);
    return storedSessionUser();
  } finally {
    clearTimeout(timer);
  }
}

export type SessionCheck =
  | { status: 'valid'; user: User }
  /** The server ended the session: signed out elsewhere, revoked, deleted. */
  | { status: 'invalid' }
  /** No answer worth acting on — offline, a timeout, a 5xx, a 429. */
  | { status: 'unknown' };

/** Ask the auth server whether the session is still good. In the background:
 *  nothing waits on this, and only an `invalid` changes anything. */
export async function verifySession(): Promise<SessionCheck> {
  if (!supabase) return { status: 'unknown' };
  try {
    const { data, error } = await supabase.auth.getUser();
    if (data.user) return { status: 'valid', user: data.user };
    if (error && isDefinitiveAuthFailure(error)) return { status: 'invalid' };
    return { status: 'unknown' };
  } catch (err) {
    reportWarn('auth.verify', err);
    return { status: 'unknown' };
  }
}

/** Forget the session on this device only — for one the server has already
 *  ended, where a global sign-out call would just fail. */
export async function dropLocalSession(): Promise<void> {
  try {
    await supabase?.auth.signOut({ scope: 'local' });
  } catch (err) {
    reportWarn('auth.drop', err);
  }
}

export function displayNameOf(user: User | null): string {
  if (!user) return 'Traveller';
  const meta = user.user_metadata as { display_name?: string } | undefined;
  return meta?.display_name || user.email?.split('@')[0] || 'Traveller';
}

/* --------------------------------------------------------- the return trip */

export type AuthRedirect = { flow: 'confirm' | 'reset'; ok: boolean; error?: string };

/**
 * Handle a link clicked in an email: exchange the code for a session, then
 * scrub it out of the address bar.
 *
 * Called once on boot, before the app decides what to render, so a password
 * reset can land on the right screen with the session already live. Removing
 * the code from the URL afterwards matters — a single-use credential in the
 * address bar ends up in browser history and in whatever the student pastes
 * into a group chat.
 */
export async function consumeAuthRedirect(): Promise<AuthRedirect | null> {
  if (!supabase) return null;

  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const flow = params.get('flow') === 'reset' ? 'reset' : 'confirm';
  const errorDescription = params.get('error_description');

  if (!code && !errorDescription) return null;

  const clean = () => {
    const keep = new URLSearchParams(window.location.search);
    for (const k of ['code', 'flow', 'error', 'error_description', 'error_code']) keep.delete(k);
    const query = keep.toString();
    /* `history.state`, not null: the router keeps this entry's position in
       it (see `entryIndex` in router.ts), and wiping it would make a later
       cancelled leave-confirm misread how it got here. */
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`,
    );
  };

  if (errorDescription) {
    clean();
    return { flow, ok: false, error: friendlyError(errorDescription) };
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code!);
  clean();
  if (!error) return { flow, ok: true };

  /* PKCE ties the link to the browser that asked for it: the other half of
     the exchange sits in that browser's storage. Open the email on your phone
     after signing up on a laptop and the exchange fails — but Supabase has
     already confirmed the address before redirecting here, so for a sign-up
     the honest message is "done, now log in", not an error. */
  if (/code verifier|pkce/i.test(error.message)) {
    return {
      flow,
      ok: false,
      error:
        flow === 'reset'
          ? 'Reset links only work in the browser you asked for them from. Ask for a new one here and open it on this device.'
          : 'Your email is confirmed. That link opened in a different browser from the one you signed up in, so log in here.',
    };
  }
  return { flow, ok: false, error: friendlyError(error.message) };
}

/* ------------------------------------------------------------------- sync */

/* What actually goes in the row.

   `attempts` is dropped entirely. It was the whole raw answer log — up to
   4,000 entries, roughly 440 KB — and nothing on any screen ever read an
   individual attempt; they all wanted counts and averages, which now live in
   `tally` at a few kilobytes. On Supabase's free tier that is the difference
   between the 500 MB database filling at around a thousand players and it
   comfortably outlasting the 50,000-monthly-user auth allowance.

   `testHistory` is capped too. It was the only other collection with no bound
   at all, and a full result is ~300 bytes. Fifty full-length tests is far more
   than anyone will sit, and keeping the most recent is the right fifty. */
export type CloudProgress = Omit<Progress, 'attempts'>;

const MAX_TEST_HISTORY = 50;

/* And the review queue is budgeted, because it is the one collection that
   grows with how much a student uses the app rather than with how much there
   is: one entry, about fifty bytes, per distinct question ever missed or
   answered once. Migration 0001 refuses any row over 256 KB, and a heavy user
   — three and a half to four and a half thousand questions in — got there.
   From then on every push failed, silently, and nothing they did reached the
   cloud again.

   So the row is held to a size, measured rather than estimated, well inside
   the limit (`pg_column_size` measures the stored jsonb, which is usually
   smaller than the text, but not something to bet the sync on). What goes
   first when it is over: the graduation records, oldest first, then the
   review entries furthest from mattering — the highest boxes, due latest.
   Box 0 and 1, the questions a student is actually struggling with, are the
   last thing to leave. The device keeps everything; only the copy that has to
   cross to another device is trimmed, and the merge on that side keeps
   whatever it already had. */
export const CLOUD_ROW_BUDGET = 160_000;

const jsonSize = (value: unknown) => JSON.stringify(value).length;

export function compactForCloud(p: Progress): CloudProgress {
  const { attempts: _local, ...rest } = p;
  const row: CloudProgress = { ...rest, testHistory: p.testHistory.slice(-MAX_TEST_HISTORY) };
  if (jsonSize(row) <= CLOUD_ROW_BUDGET) return row;

  const { review, graduated, ...fixed } = row;
  /* Everything but the two trimmable collections, plus the brackets and keys
     those two need even when empty. Whatever is left is theirs. */
  let room = CLOUD_ROW_BUDGET - jsonSize({ ...fixed, review: {}, graduated: {} });

  const keptReview: Progress['review'] = {};
  const byUrgency = Object.entries(review).sort(([, a], [, b]) => a.box - b.box || a.due - b.due);
  for (const [qid, entry] of byUrgency) {
    const cost = jsonSize(qid) + jsonSize(entry) + 2; // colon and comma
    if (cost > room) break;
    keptReview[qid] = entry;
    room -= cost;
  }

  const keptGraduated: Record<string, number> = {};
  const newestFirst = Object.entries(graduated ?? {}).sort(([, a], [, b]) => b - a);
  for (const [qid, at] of newestFirst) {
    const cost = jsonSize(qid) + jsonSize(at) + 2;
    if (cost > room) break;
    keptGraduated[qid] = at;
    room -= cost;
  }

  return { ...fixed, review: keptReview, graduated: keptGraduated };
}

/** Rebuild a full Progress from a row. The attempt log starts empty, which is
 *  correct: it is a local recent-history convenience, not shared state. */
export function expandFromCloud(row: CloudProgress): Progress {
  return normalizeProgress({ ...row, attempts: [] });
}

/* Three outcomes, not two.
 *
 * This used to return `null` for both "this account has never synced" and "the
 * query failed", which are opposite facts and the caller has to act on them
 * differently. Conflating them meant a network blip on sign-in looked exactly
 * like a brand-new account — so the client would treat an empty local profile
 * as authoritative and push it over a year of real progress. That is the
 * fire-and-forget clobber this module was rewritten to prevent, arriving
 * through the back door. */
export type PullResult =
  /* `updatedAt` is the database's own string, never parsed. Postgres keeps
     microseconds and a JS Date keeps milliseconds, so a round trip through
     `getTime()` handed `push_progress` a value that could never equal the
     row's: every push after the first came back as a conflict, and the
     cloud copy froze at its first write. It is an opaque token — compared by
     the database, never by us. */
  | { status: 'ok'; data: Progress; updatedAt: string }
  | { status: 'empty' }
  | { status: 'error'; message: string };

export async function pullProgress(userId: string): Promise<PullResult> {
  if (!supabase) return { status: 'error', message: 'Accounts are not configured.' };
  const { data, error } = await supabase
    .from('progress')
    .select('data, updated_at')
    .eq('user_id', userId)
    .maybeSingle<Pick<ProgressRow, 'data' | 'updated_at'>>();

  if (error) {
    reportWarn('sync.pull', error.message);
    return { status: 'error', message: error.message };
  }
  if (!data?.data) return { status: 'empty' };
  return {
    status: 'ok',
    data: expandFromCloud(data.data),
    updatedAt: data.updated_at,
  };
}

/* Three outcomes here too, and for the same reason as `PullResult`.
 *
 * `conflict` is not an error: it means the row changed under us and the write
 * was correctly refused. The caller's job is to pull, merge and try again — not
 * to tell the student anything, because nothing has gone wrong. Reporting it as
 * a failure would put a scary toast in front of the one case the system is
 * handling properly. */
export type PushResult =
  | { status: 'ok'; updatedAt: string }
  | { status: 'conflict' }
  /* The row was refused by a check constraint — in practice 0001's size cap.
     Its own status because it is the opposite of a network blip: retrying
     changes nothing, and "could not reach the cloud" would be a lie. */
  | { status: 'too-large'; message: string }
  | { status: 'error'; message: string };

/** The longest display name the row will take — migration 0007's check. */
export const MAX_DISPLAY_NAME = 64;

/**
 * Write the caller's progress, but only over the row it last saw.
 *
 * `expectedUpdatedAt` is the `updated_at` from the last successful pull or
 * push, or `null` for "there was no row." The database compares it and refuses
 * the write if anything has changed since — see
 * supabase/migrations/0002_push_progress_concurrency.sql for why a plain upsert
 * was losing a second device's work in the several-second gap between pull and
 * a debounced push.
 *
 * The user id is not sent. The function reads it from the verified JWT, so
 * there is no parameter here that could name someone else's row.
 */
export async function pushProgress(
  displayName: string,
  progress: Progress,
  expectedUpdatedAt: string | null,
  options: { keepalive?: boolean } = {},
): Promise<PushResult> {
  if (!supabase) return { status: 'error', message: 'Accounts are not configured.' };

  let call = supabase.rpc('push_progress', {
    /* Cut here as well as in the database: a name is whatever the student
       typed at sign-up, and a refused write is worse than a shortened name. */
    p_display_name: [...displayName].slice(0, MAX_DISPLAY_NAME).join(''),
    p_data: compactForCloud(progress),
    p_expected: expectedUpdatedAt,
  });
  if (options.keepalive) call = call.setHeader(KEEPALIVE_HEADER, '1');
  const { data, error } = await call;

  if (error) {
    reportWarn('sync.push', error.message);
    if (isCheckViolation(error)) return { status: 'too-large', message: error.message };
    return { status: 'error', message: error.message };
  }
  /* A null return is the function's way of saying "someone else wrote first".
     Distinguishing it from a thrown error is the whole point of the tri-state:
     one means retry, the other means stop. */
  if (data === null) return { status: 'conflict' };

  return { status: 'ok', updatedAt: data as string };
}

/** SQLSTATE 23514, check_violation — or its message, if the code is lost. */
export function isCheckViolation(error: { code?: string; message?: string }): boolean {
  return (
    error.code === '23514' ||
    /violates check constraint|progress_data_size/i.test(error.message ?? '')
  );
}

/** Drop the saved row without touching the account. Used by "reset progress",
 *  which otherwise reloads and pulls everything straight back down. */
/** False when the row may still be there — the caller must not report success. */
export async function deleteRemoteProgress(userId: string): Promise<boolean> {
  if (!supabase) return true;
  const { error } = await supabase.from('progress').delete().eq('user_id', userId);
  if (error) {
    reportWarn('sync.reset', error.message);
    return false;
  }
  return true;
}

/* ----------------------------------------------------------------- erasure */

/**
 * Delete the account and everything attached to it.
 *
 * Removing an auth user needs the `service_role` key, which must never reach a
 * browser bundle — so this calls an Edge Function that holds the key server
 * side, verifies the caller's JWT, and deletes only that caller. See
 * supabase/functions/delete-account.
 */
export async function deleteAccount(): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: 'Accounts are not configured for this deployment.' };
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) return { ok: false, error: friendlyError(error.message) };
  await supabase.auth.signOut();
  return { ok: true };
}

/* ---------------------------------------------------------------- feedback */

export type FeedbackKind = 'bug' | 'content' | 'idea' | 'other';

export interface FeedbackInput {
  kind: FeedbackKind;
  area?: string;
  message: string;
  contact?: string;
}

/**
 * Add one row to `feedback` (migration 0006). Write-only: the table has no
 * select policy, so this sends with the default `return=minimal` and never
 * asks for the row back. `user_id` is filled server-side from the session.
 *
 * `missing` means the table is not there yet — the migration has not been
 * run — so the caller can offer email instead of a bare failure.
 */
export async function sendFeedback(
  input: FeedbackInput,
): Promise<{ ok: true } | { ok: false; missing: boolean; limited?: boolean; error: string }> {
  if (!supabase) return { ok: false, missing: true, error: 'No feedback server is connected.' };
  const { error } = await supabase.from('feedback').insert({
    kind: input.kind,
    area: input.area?.slice(0, 40) || null,
    message: input.message.trim().slice(0, 4000),
    contact: input.contact?.trim().slice(0, 200) || null,
    user_agent: navigator.userAgent.slice(0, 400),
  });
  if (!error) return { ok: true };
  /* Migration 0007's cap. Not a fault and not worth a diagnostics entry: the
     server is doing exactly what it was told to. */
  if (error.message?.includes('feedback_rate_limited')) {
    return {
      ok: false,
      missing: false,
      limited: true,
      error: 'You’ve sent a lot of feedback recently — try again later.',
    };
  }
  reportWarn('feedback.send', error.message);
  const missing = error.code === 'PGRST205' || error.code === '42P01';
  return { ok: false, missing, error: friendlyError(error.message) };
}

/* ------------------------------------------------------------ crash reports */

/**
 * Add one row to `client_errors` (migration 0007). Called only by the
 * reporter in report.ts, which has already sanitised, deduplicated and
 * budgeted the report.
 *
 * Unable to fail loudly by design: a crash reporter that throws, or that
 * reports its own failure, turns one error into a loop. Every outcome —
 * success, a refusal from the rate cap, a missing table, no network — ends
 * here in silence. Write-only, so it never asks for the row back.
 */
export async function sendClientError(report: RemoteError): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from('client_errors').insert({
      build_id: report.buildId.slice(0, 64) || null,
      route: report.route.slice(0, 120) || null,
      message: report.message.slice(0, 500) || 'unknown error',
      stack: report.stack?.slice(0, 2000) || null,
      user_agent: navigator.userAgent.slice(0, 400),
    });
  } catch {
    /* see above */
  }
}

/* Registered here rather than imported by report.ts, which this module
   already imports: the reporter stays free of any Supabase dependency, and a
   build with no project configured never registers a sink at all. */
if (supabase) setRemoteSink(sendClientError);
