/* Ask the live Supabase project whether it is actually set up.

   Every Supabase step in `docs/launch-checklist.md` is a box you tick by hand,
   and a ticked box is a claim, not a fact. The gap that motivated this script:
   the project has been live for weeks with `progress` and `push_progress()`
   missing from the database entirely, so every sync write has been failing
   server-side. Nothing in the repo could have told you that. The client reports
   it — `lastSyncError` is surfaced in the UI — but only to a signed-in student
   mid-session, which is the worst possible time and audience to find out.

   So: one command that talks to the real project and reports what is wrong.

   Everything here uses the anon key and nothing else. That is deliberate — the
   anon key already ships in the browser bundle, so this script can be run by
   anyone who can run the app, needs no secret in CI, and cannot itself become a
   way to leak the service_role key. The cost is that a few things genuinely
   cannot be seen from outside (the redirect allowlist needs the Management API
   and a personal access token); those stay in the checklist and say so below.

   Nothing here writes. The one call that reaches a function reaches it with no
   session, and `push_progress` raises before its first statement when
   `auth.uid()` is null — so a doctor run against production cannot create,
   modify or delete a row. */

import { readFileSync, existsSync } from 'node:fs';

/* ------------------------------------------------------------ environment */

/* Read `.env` the way Vite does, so this reports on the same project the dev
   server would talk to. A real environment variable wins, which is what makes
   the script usable in CI against a different project. */
function loadEnv() {
  const env = { ...process.env };
  if (!existsSync('.env')) return env;
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    const [, key, raw] = m;
    if (env[key]) continue;
    env[key] = raw.trim().replace(/^['"]|['"]$/g, '');
  }
  return env;
}

const env = loadEnv();
const url = (env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '');
const anon = env.VITE_SUPABASE_ANON_KEY ?? '';

/* ---------------------------------------------------------------- results */

const results = [];
const ok = (name, detail) => results.push({ level: 'ok', name, detail });
const warn = (name, detail, fix) => results.push({ level: 'warn', name, detail, fix });
const fail = (name, detail, fix) => results.push({ level: 'fail', name, detail, fix });

if (!url || !anon) {
  console.error(
    '\n  supabase doctor: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not set.\n\n' +
      '  Copy .env.example to .env and fill them in from the dashboard\n' +
      '  (Settings -> API), or export them before running this.\n\n' +
      '  Without them the app runs in local-only guest mode, which is a valid\n' +
      '  way to run it — there is just nothing for this script to check.\n',
  );
  process.exit(2);
}

const headers = { apikey: anon, Authorization: `Bearer ${anon}` };

/* Never let a hung project turn this into a script you have to Ctrl-C.

   An explicit controller rather than `AbortSignal.timeout`, because that one
   keeps its timer alive after the request settles: with a pending libuv handle
   still open, exiting non-zero trips an assertion inside libuv on Windows and
   the process reports 127 instead of 1. A doctor whose exit code is wrong is
   worse than no doctor, since the whole point is being callable from CI. */
async function req(path, init = {}) {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(new Error('timed out')), 15_000);
  try {
    const res = await fetch(`${url}${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers ?? {}) },
      signal: abort.signal,
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* Not JSON. A paused project serves an HTML holding page, which is itself
         the answer — keep the raw text for the message. */
    }
    return { res, text, json };
  } catch (err) {
    return { err: abort.signal.aborted ? new Error('timed out') : err };
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------- 1. is it awake? */

{
  const { res, err, text } = await req('/rest/v1/');
  if (err) {
    fail(
      'Project reachable',
      `${url} did not answer (${err.message}).`,
      'Check the URL, and check the dashboard for a paused project.',
    );
  } else if (res.status === 503 || /paused/i.test(text)) {
    fail(
      'Project reachable',
      'The project is paused.',
      'Restore it in the dashboard. Free projects pause after 7 days idle — ' +
        '.github/workflows/keepalive.yml exists to stop that happening again.',
    );
  } else if (res.status === 401 || res.status === 403) {
    fail(
      'Project reachable',
      `The anon key was rejected (HTTP ${res.status}).`,
      'Copy VITE_SUPABASE_ANON_KEY again from Settings -> API. Note this must ' +
        'be the anon/publishable key, not the service_role key.',
    );
  } else {
    ok('Project reachable', `HTTP ${res.status} from the REST endpoint`);
  }
}

/* ------------------------------------------- 2. migration 0001: the table */

{
  const { res, json, err } = await req('/rest/v1/progress?select=user_id&limit=1', {
    headers: { Prefer: 'count=exact' },
  });
  if (err) {
    fail('Table `progress` (migration 0001)', 'The request failed.', 'See above.');
  } else if (json?.code === 'PGRST205' || json?.code === '42P01' || res.status === 404) {
    fail(
      'Table `progress` (migration 0001)',
      json?.message ?? 'The table does not exist.',
      'Paste supabase/migrations/0001_initial_schema.sql into the SQL editor.',
    );
  } else if (!res.ok) {
    fail(
      'Table `progress` (migration 0001)',
      `HTTP ${res.status}: ${json?.message ?? 'unexpected response'}`,
      'Check the table exists and that anon has the default grants.',
    );
  } else {
    ok('Table `progress` (migration 0001)', 'exists and answers');
    /* `Content-Range` is PostgREST's count. Rows visible to an *unauthenticated*
       caller means row-level security is not filtering, which is the one
       finding here that is an active breach rather than a broken feature: the
       anon key is in the browser bundle, so every student's row would be
       readable by anyone who viewed source. */
    const range = res.headers.get('content-range') ?? '';
    const total = Number(range.split('/')[1]);
    if (Number.isFinite(total) && total > 0) {
      fail(
        'Row-level security on `progress`',
        `An unauthenticated caller can see ${total} row(s). RLS is off, or a ` +
          'policy is using `true` where it should compare `auth.uid()`.',
        'Re-run 0001 and confirm the shield in Table editor -> progress. ' +
          'Treat the rows as exposed until it is fixed.',
      );
    } else {
      /* Zero rows is the right answer, but it is also what an empty table
         returns with RLS off. Say so rather than claim a pass we cannot see. */
      warn(
        'Row-level security on `progress`',
        'No rows are visible without a session, which is correct — but an ' +
          'empty table looks identical from outside.',
        'Confirm the shield icon in Table editor -> progress once real ' +
          'accounts exist, then this becomes a definite pass.',
      );
    }
  }
}

/* ------------------------------------- 3. migration 0002: push_progress() */

{
  /* Arg names must match the signature exactly or PostgREST reports the
     function as missing rather than as forbidden, which would misdiagnose a
     correctly-applied 0002 as a missing one. */
  const { res, json, err } = await req('/rest/v1/rpc/push_progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_display_name: 'doctor', p_data: {}, p_expected: null }),
  });
  if (err) {
    fail('Function `push_progress` (migration 0002)', 'The request failed.', 'See above.');
  } else if (json?.code === 'PGRST202' || res.status === 404) {
    fail(
      'Function `push_progress` (migration 0002)',
      json?.message ?? 'The function does not exist.',
      'Paste supabase/migrations/0002_push_progress_concurrency.sql into the ' +
        'SQL editor. Until then every sync write fails and progress never leaves the device.',
    );
  } else if (res.status === 403 || json?.code === '42501') {
    /* The intended outcome. 0002 revokes execute from public and grants it to
       `authenticated`, so an anon caller is refused before the body runs. */
    ok('Function `push_progress` (migration 0002)', 'exists, and anon cannot execute it');
  } else if (json?.code === '28000') {
    warn(
      'Function `push_progress` (migration 0002)',
      'The function exists but anon is allowed to call it — it only refused ' +
        'because it checks `auth.uid()` itself.',
      'Re-run the last two lines of 0002 (the revoke and the grant). The ' +
        'function is safe either way; this is defence in depth, not a hole.',
    );
  } else {
    warn(
      'Function `push_progress` (migration 0002)',
      `Unexpected HTTP ${res.status}: ${json?.message ?? json?.code ?? 'no message'}`,
      'Check the function in the SQL editor.',
    );
  }
}

/* --------------------------------------------------------- 4. auth config */

{
  /* `/auth/v1/settings` is public by design — it is what the client reads to
     know which providers to render. It also tells us the two settings that
     decide whether sign-up works at all. */
  const { res, json, err } = await req('/auth/v1/settings');
  if (err || !res?.ok || !json) {
    warn(
      'Auth settings',
      'Could not read /auth/v1/settings.',
      'Check Authentication -> Providers by hand.',
    );
  } else {
    if (json.disable_signup === true) {
      fail(
        'Sign-up enabled',
        'Sign-ups are disabled. Nobody can create an account.',
        'Authentication -> Providers -> Email -> allow new users.',
      );
    } else {
      ok('Sign-up enabled', 'new accounts are allowed');
    }

    /* `mailer_autoconfirm: true` means Supabase marks addresses confirmed
       without sending anything — so anyone can register as anyone, which on an
       app for minors is the setting that matters most. */
    if (json.mailer_autoconfirm === true) {
      fail(
        'Email confirmation',
        'Confirmation is OFF (mailer_autoconfirm is true) — an address is ' +
          'trusted without ever being checked, so anyone can sign up as anyone.',
        'Authentication -> Providers -> Email -> turn "Confirm email" ON.',
      );
    } else {
      ok('Email confirmation', 'ON — addresses must be confirmed');
    }
  }
}

/* ------------------------------------------------ 5. the delete function */

{
  const { res, err } = await req('/functions/v1/delete-account', { method: 'POST' });
  if (err) {
    warn('Edge function `delete-account`', 'The request failed.', 'See above.');
  } else if (res.status === 404) {
    fail(
      'Edge function `delete-account`',
      'Not deployed. "Delete my account" cannot remove the auth user, which is ' +
        'a stated promise in the privacy policy.',
      'supabase functions deploy delete-account (see docs/launch-checklist.md).',
    );
  } else {
    /* Anything that is not a 404 means something is listening. A 401 is the
       expected answer to an unauthenticated call and is the good case. */
    ok('Edge function `delete-account`', `deployed (HTTP ${res.status} without a session)`);
  }
}

/* ----------------------------------------------------------------- report */

const symbol = { ok: 'ok  ', warn: 'warn', fail: 'FAIL' };
console.log(`\n  supabase doctor — ${url}\n`);
for (const r of results) {
  console.log(`  [${symbol[r.level]}] ${r.name}`);
  console.log(`         ${r.detail}`);
  if (r.fix) console.log(`         -> ${r.fix}`);
  console.log('');
}

console.log(
  '  Not checkable with the anon key, still on you:\n' +
    '    - the redirect allowlist has no wildcards (Authentication -> URL Configuration)\n' +
    '    - SITE_URL is set as a function secret\n' +
    '    - the email templates carry the six-digit code as well as the link\n',
);

const failed = results.filter((r) => r.level === 'fail');
const warnings = results.filter((r) => r.level === 'warn').length;

if (failed.length) {
  /* Name the consequence rather than a generic count. A missing migration and
     a missing edge function are both failures and mean completely different
     things to whoever is reading this at the time. */
  const migration = failed.some((r) => /migration 000/.test(r.name));
  console.error(
    `  ${failed.length} failure(s), ${warnings} warning(s).` +
      (migration ? ' Sync cannot work until the migrations are applied.' : '') +
      '\n',
  );
  /* `exitCode` rather than `exit()`: nothing is left pending by this point, so
     letting the process end on its own keeps the status honest. */
  process.exitCode = 1;
}
console.log(`  No failures, ${warnings} warning(s).\n`);
