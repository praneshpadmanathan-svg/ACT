/* Supabase auth + progress sync.

   This is the only account system now. The device-password path it used to
   share the job with is gone — see the note at the top of identity.ts.

   Config comes from env vars. With none set the app still runs completely,
   local-only, which is what `cloudEnabled` gates on. That keeps
   `git clone && npm install && npm run dev` working for anyone, and it is also
   the mode under-13s stay in. */

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { Progress } from '@/types';
import { emptyProgress } from './progress';
import { reportWarn } from './report';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const cloudEnabled = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = cloudEnabled
  ? createClient(url!, anonKey!, {
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
function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'That email and password combination did not match.';
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

export async function currentUser(): Promise<User | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
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
    window.history.replaceState(
      null,
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
  return error ? { flow, ok: false, error: friendlyError(error.message) } : { flow, ok: true };
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

export function compactForCloud(p: Progress): CloudProgress {
  const { attempts: _local, ...rest } = p;
  return { ...rest, testHistory: p.testHistory.slice(-MAX_TEST_HISTORY) };
}

/** Rebuild a full Progress from a row. The attempt log starts empty, which is
 *  correct: it is a local recent-history convenience, not shared state. */
export function expandFromCloud(row: CloudProgress): Progress {
  return { ...emptyProgress(), ...row, attempts: [] };
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
  | { status: 'ok'; data: Progress; updatedAt: number }
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
    updatedAt: new Date(data.updated_at).getTime(),
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
  | { status: 'ok'; updatedAt: number }
  | { status: 'conflict' }
  | { status: 'error'; message: string };

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
  expectedUpdatedAt: number | null,
): Promise<PushResult> {
  if (!supabase) return { status: 'error', message: 'Accounts are not configured.' };

  const { data, error } = await supabase.rpc('push_progress', {
    p_display_name: displayName,
    p_data: compactForCloud(progress),
    p_expected: expectedUpdatedAt === null ? null : new Date(expectedUpdatedAt).toISOString(),
  });

  if (error) {
    reportWarn('sync.push', error.message);
    return { status: 'error', message: error.message };
  }
  /* A null return is the function's way of saying "someone else wrote first".
     Distinguishing it from a thrown error is the whole point of the tri-state:
     one means retry, the other means stop. */
  if (data === null) return { status: 'conflict' };

  return { status: 'ok', updatedAt: new Date(data as string).getTime() };
}

/** Drop the saved row without touching the account. Used by "reset progress",
 *  which otherwise reloads and pulls everything straight back down. */
export async function deleteRemoteProgress(userId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('progress').delete().eq('user_id', userId);
  if (error) reportWarn('sync.reset', error.message);
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
