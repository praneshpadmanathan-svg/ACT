/* Redeem a code for Pro.
 *
 * The one endpoint in the system that grants an entitlement, which makes it
 * the one worth being paranoid about. Three properties it has to hold:
 *
 *   1. **The caller cannot name someone else.** There is no user id in the
 *      body. The id comes from the JWT that Supabase itself verified, exactly
 *      as in delete-account — the only account this can upgrade is the one
 *      holding the token.
 *
 *   2. **A wrong code tells you nothing.** Every failure below the rate limit
 *      returns the same message and the same status. "No such code" and "that
 *      code is used up" are different facts, and leaking which one applies
 *      turns a guessing attack into a search with feedback.
 *
 *   3. **Guessing is expensive and bounded.** Codes carry ~125 bits, so the
 *      real defence is arithmetic; the limiter below is what stops somebody
 *      turning that arithmetic into a bill. It is checked *before* any hashing,
 *      so a flood costs a row count rather than a KDF.
 *
 * Deploy:  supabase functions deploy redeem-code
 *
 * `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are
 * injected by the platform. `SITE_URL` is the CORS allowlist, same as
 * delete-account.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

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

/* Five an hour. A person redeeming a code they were given types it once, maybe
   twice if they fumble it; five is generous for them and useless for anyone
   else. */
const MAX_ATTEMPTS_PER_HOUR = 5;

/* The single message every failed redemption gets. Property 2 above. */
const REJECTED = 'That code is not valid.';

/** Normalise what a human typed into what was generated. */
function tidy(input: string): string {
  /* Case and spacing are the two things people get wrong retyping a code off a
     phone screen, and neither is information — the alphabet is upper-case and
     the dashes are decoration. Stripping everything outside the alphabet also
     handles a code pasted with a trailing newline or a smart-quote wrapper. */
  return input.toUpperCase().replace(/[^0-9A-Z-]/g, '');
}

interface CodeRow {
  id: string;
  code_hash: string;
}

/** Constant-time compare. Length is not secret; content is. */
function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/**
 * Verify one candidate row.
 *
 * The stored format is self-describing — `pbkdf2-sha256$<iters>$<salt>$<hash>`
 * — so the parameters come out of the row rather than being assumed here. A
 * row written with a different cost keeps working after this file changes its
 * default, which is the whole point of storing them.
 */
async function matches(code: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2-sha256') return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 5_000_000) return false;

  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    salt = b64(parts[2]);
    expected = b64(parts[3]);
  } catch {
    return false;
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(code),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    expected.length * 8,
  );
  return sameBytes(new Uint8Array(bits), expected);
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
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Not signed in.' }, 401);

  let submitted = '';
  try {
    const body = (await req.json()) as { code?: unknown };
    if (typeof body.code === 'string') submitted = tidy(body.code);
  } catch {
    /* falls through to the length check */
  }
  /* A bound before anything else touches it: without one, a megabyte of text
     becomes a megabyte run through PBKDF2 once per candidate row. */
  if (submitted.length < 4 || submitted.length > 128) return json({ error: REJECTED }, 400);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  /* The caller's own token, verified with the anon key — using the service key
     here would accept a forged JWT without complaint. Same reasoning as
     delete-account. */
  const asCaller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await asCaller.auth.getUser();
  const user = userData?.user;
  if (userError || !user) return json({ error: 'Not signed in.' }, 401);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  /* ------------------------------------------------------- rate limit */

  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { count, error: countError } = await admin
    .from('redemption_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('at', since);

  /* Fail closed. If the limiter cannot be consulted, the safe answer is to
     refuse rather than to wave everything through — an outage in the counting
     table is otherwise an open season on the one endpoint that grants Pro. */
  if (countError) {
    console.error(`redeem-code: rate limit check failed (${countError.message})`);
    return json({ error: 'Could not check that just now. Try again in a minute.' }, 503);
  }
  if ((count ?? 0) >= MAX_ATTEMPTS_PER_HOUR) {
    return json({ error: 'Too many attempts. Try again in an hour.' }, 429);
  }

  /* Logged before the work, not after. Recording the attempt only on the way
     out means a request that times out mid-KDF — or one the client abandons —
     costs the attacker nothing, and the limiter never counts the attempts that
     matter most. */
  const { data: attempt, error: logError } = await admin
    .from('redemption_attempts')
    .insert({ user_id: user.id, ok: false })
    .select('id')
    .single<{ id: number }>();
  if (logError || !attempt) {
    console.error(`redeem-code: could not log attempt (${logError?.message})`);
    return json({ error: 'Could not check that just now. Try again in a minute.' }, 503);
  }

  /* ------------------------------------------------------- the lookup */

  /* Every live code, not a filtered query on the submitted value: there is no
     way to ask Postgres "find the row whose bcrypt-alike matches this" without
     hashing per row anyway, and a WHERE clause on the plaintext would put the
     code into the query log. This table holds a handful of rows by design. */
  const nowIso = new Date().toISOString();
  const { data: codes, error: codesError } = await admin
    .from('redemption_codes')
    .select('id, code_hash')
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .limit(200);

  if (codesError) {
    console.error(`redeem-code: could not read codes (${codesError.message})`);
    return json({ error: 'Could not check that just now. Try again in a minute.' }, 503);
  }

  let hit: CodeRow | null = null;
  for (const row of (codes ?? []) as CodeRow[]) {
    /* No early break. Stopping at the first match would make the response time
       depend on where in the table the matching row sits, and with a handful of
       rows the cost of finishing the loop is nothing. */
    if (await matches(submitted, row.code_hash)) hit = hit ?? row;
  }

  if (!hit) return json({ error: REJECTED }, 400);

  /* --------------------------------------------------------- the claim */

  const { data: result, error: claimError } = await admin.rpc('claim_code', {
    p_code_id: hit.id,
    p_user_id: user.id,
  });

  if (claimError) {
    console.error(`redeem-code: claim failed (${claimError.message})`);
    return json({ error: 'Could not apply that code. Try again in a minute.' }, 500);
  }

  /* 'exhausted' is deliberately given the same wording as an unknown code.
     Telling someone their guess was a real code that happens to be used up
     confirms the guess. */
  if (result === 'exhausted') return json({ error: REJECTED }, 400);

  /* Flip the row logged above rather than hunting for "the most recent one":
     PostgREST does not take an order or a limit on an UPDATE, and picking a
     row by recency would be a race with the caller's own next attempt anyway.
     Best effort — the grant has already been written, and failing to relabel a
     log line is not a reason to tell somebody their code did not work. */
  const { error: markError } = await admin
    .from('redemption_attempts')
    .update({ ok: true })
    .eq('id', attempt.id);
  if (markError) {
    console.error(`redeem-code: could not mark attempt ${attempt.id} successful (${markError.message})`);
  }

  /* 'already' is a success. They hold the code and they hold the entitlement;
     saying "no" to somebody redeeming on their second device would be a bug
     wearing an error message. */
  return json({ ok: true, alreadyHeld: result === 'already' }, 200);
});
