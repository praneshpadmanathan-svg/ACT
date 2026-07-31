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
    'Vary': 'Origin',
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

  /* Delete the progress row first. `on delete cascade` would take it anyway,
     but doing it explicitly means a failure here is reported rather than
     leaving a stranded row if the cascade is ever changed. */
  const { error: rowError } = await admin.from('progress').delete().eq('user_id', user.id);
  if (rowError) {
    return json({ error: `Could not delete your progress: ${rowError.message}` }, 500);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return json({ error: `Could not delete your account: ${deleteError.message}` }, 500);
  }

  return json({ ok: true }, 200);
});
