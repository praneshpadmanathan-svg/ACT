/* Supabase auth + progress sync.

   Config comes from env vars. With none set the app still runs completely —
   it just stays local-only, which is what `cloudEnabled` gates on. That keeps
   `git clone && npm install && npm run dev` working for anyone. */

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { Progress } from '@/types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const cloudEnabled = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = cloudEnabled
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/** Row shape of the `progress` table. See README for the schema. */
interface ProgressRow {
  user_id: string;
  display_name: string | null;
  data: Progress;
  updated_at: string;
}

export interface AuthResult {
  ok: boolean;
  /** Set when the provider wants the address confirmed before first sign-in. */
  needsConfirmation?: boolean;
  error?: string;
}

function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'That email and password combination did not match.';
  if (m.includes('already registered')) return 'That email already has an account — try signing in.';
  if (m.includes('password')) return 'Password must be at least 6 characters.';
  if (m.includes('rate limit')) return 'Too many attempts. Wait a minute and try again.';
  if (m.includes('fetch') || m.includes('network')) return 'Could not reach the server. Check your connection.';
  return message;
}

export async function signUp(name: string, email: string, password: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: 'Cloud sync is not configured.' };
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: name } },
  });
  if (error) return { ok: false, error: friendlyError(error.message) };
  // No session back means the project requires email confirmation.
  return { ok: true, needsConfirmation: !data.session };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: 'Cloud sync is not configured.' };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
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
  if (!user) return 'Guest';
  const meta = user.user_metadata as { display_name?: string } | undefined;
  return meta?.display_name || user.email?.split('@')[0] || 'Player';
}

/* ------------------------------------------------------------------- sync */

/** Pull the saved row. Returns null when the user has never synced. */
export async function pullProgress(userId: string): Promise<{ data: Progress; updatedAt: number } | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('progress')
    .select('data, updated_at')
    .eq('user_id', userId)
    .maybeSingle<Pick<ProgressRow, 'data' | 'updated_at'>>();

  if (error) {
    console.warn('[sync] pull failed', error.message);
    return null;
  }
  if (!data) return null;
  return { data: data.data, updatedAt: new Date(data.updated_at).getTime() };
}

export async function pushProgress(
  userId: string,
  displayName: string,
  progress: Progress,
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('progress').upsert(
    {
      user_id: userId,
      display_name: displayName,
      data: progress,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (error) {
    console.warn('[sync] push failed', error.message);
    return false;
  }
  return true;
}

/* Merge remote and local progress rather than letting one silently win.

   The old build did a fire-and-forget push, so opening the app on a second
   device could overwrite good progress with an empty profile. Merging on the
   monotonic fields (XP, streaks, attempts, cleared zones) makes that
   impossible: you can only ever move forward. */
export function mergeProgress(local: Progress, remote: Progress): Progress {
  const attemptKey = (a: { qid: string; at: number }) => `${a.qid}@${a.at}`;
  const attempts = new Map<string, Progress['attempts'][number]>();
  for (const a of [...remote.attempts, ...local.attempts]) attempts.set(attemptKey(a), a);

  const testKey = (t: { id: string; at: number }) => `${t.id}@${t.at}`;
  const tests = new Map<string, Progress['testHistory'][number]>();
  for (const t of [...remote.testHistory, ...local.testHistory]) tests.set(testKey(t), t);

  const zonesCleared: Record<string, number> = { ...remote.zonesCleared };
  for (const [id, pct] of Object.entries(local.zonesCleared)) {
    zonesCleared[id] = Math.max(zonesCleared[id] ?? 0, pct);
  }

  // Keep whichever review schedule is further along per question.
  const review: Progress['review'] = { ...remote.review };
  for (const [qid, entry] of Object.entries(local.review)) {
    const existing = review[qid];
    review[qid] = !existing || entry.box > existing.box ? entry : existing;
  }

  const newer = (local.lastActiveDay ?? '') >= (remote.lastActiveDay ?? '') ? local : remote;

  return {
    ...remote,
    ...newer,
    version: 2,
    xp: Math.max(local.xp, remote.xp),
    attempts: [...attempts.values()].sort((a, b) => a.at - b.at).slice(-4000),
    testHistory: [...tests.values()].sort((a, b) => a.at - b.at),
    notesRead: [...new Set([...remote.notesRead, ...local.notesRead])],
    achievements: [...new Set([...remote.achievements, ...local.achievements])],
    storySeen: [...new Set([...(remote.storySeen ?? []), ...(local.storySeen ?? [])])],
    oath: local.oath ?? remote.oath ?? null,
    /* First choice made wins — a second device must not relocate the traveller. */
    startRegion: local.startRegion ?? remote.startRegion ?? null,
    zonesCleared,
    review,
    dayStreak: Math.max(local.dayStreak, remote.dayStreak),
    bestCorrectStreak: Math.max(local.bestCorrectStreak, remote.bestCorrectStreak),
    profile: newer.profile ?? local.profile ?? remote.profile,
  };
}
