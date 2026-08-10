/* Delete the caller's account, permanently.
 *
 * This exists because removing a row from `auth.users` requires the
 * `service_role` key, which bypasses row-level security entirely. That key must
 * never reach a browser bundle — anyone who copied it out of the JavaScript
 * would be able to read and delete every account in the project.
 *
 * So the key lives here, server side, and the function does exactly one thing:
 * it verifies the caller's own JWT, extracts the id that Supabase itself
 * decoded, and deletes that id. There is no user id in the request body, and no
 * way to name a different one — the only account you can delete through this
 * endpoint is your own.
 *
 * Deploy:  supabase functions deploy delete-account
 *
 * `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected into the
 * function's environment by the platform; there is nothing to configure.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

/* Which origins may call this.
 *
 * `SITE_URL` is a comma-separated allowlist. It used to fall back to `*`, which
 * is the wrong default for the one endpoint in the system that permanently
 * destroys an account: any page on the internet could then invoke it, and while
 * it still takes a valid token to do damage, a wildcard turns a stolen or
 * leaked token into a one-request account deletion from anywhere.
 *
 * With nothing configured it now falls back to localhost only, so a
 * misconfigured deployment fails closed and loudly instead of open and quietly.
 */
const ALLOWED = (Deno.env.get('SITE_URL') ?? 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

function corsFor(req: Request): Record<string, string> {
  const origin = (req.headers.get('Origin') ?? '').replace(/\/$/, '');
  return {
    'Access-Control-Allow-Origin': ALLOWED.includes(origin) ? origin : ALLOWED[0],
    Vary: 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '3600',
  };
}

Deno.serve(async (req: Request) => {
  const cors = corsFor(req);
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Not signed in.' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  /* Identify the caller with the *anon* key and their own token, so the JWT is
     actually verified rather than taken at face value. Doing this with the
     service key would happily accept a forged one. */
  const asCaller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await asCaller.auth.getUser();
  const user = userData?.user;
  if (userError || !user) {
    return json({ error: 'Not signed in.' }, 401);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  /* Order matters, and it used to be the other way round.
   *
   * This deleted the progress row first and then the auth user, as two
   * independent calls with no transaction across them and no rollback. If the
   * second failed, the first had already succeeded: the account survived with
   * every trace of its data gone. That state is worse than either outcome on
   * its own — the student is told deletion failed, signs back in, and finds an
   * account that looks brand new. Their work is gone and their account is not,
   * which is precisely backwards from what they asked for, and nothing
   * anywhere reports it.
   *
   * Deleting the user first makes the failure safe. `on delete cascade` on
   * `progress.user_id` takes the row as part of the same statement, so success
   * removes both and failure removes neither. There is no in-between for a
   * partial failure to land in.
   */
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    /* Nothing has been destroyed. The account and the data are both intact and
       the student can try again. */
    return json({ error: `Could not delete your account: ${deleteError.message}` }, 500);
  }

  /* Compensating cleanup for the one case the cascade cannot cover: if the
     foreign key is ever altered or dropped, the row outlives its owner and
     becomes unreachable — no auth user can authenticate as that id, so RLS
     hides it from every client, and it sits in the table forever holding a
     deleted student's answer history.

     Best effort by design: the account is already gone and the deletion
     genuinely succeeded, so this must not turn into a 500 that tells the
     student otherwise. It is reported instead, because an operator needs to
     know the cascade has stopped working. */
  const { error: rowError } = await admin.from('progress').delete().eq('user_id', user.id);
  if (rowError) {
    console.error(
      `delete-account: account ${user.id} was deleted but its progress row could not be ` +
        `removed (${rowError.message}). The ON DELETE CASCADE may no longer be in place.`,
    );
  }

  return json({ ok: true }, 200);
});
