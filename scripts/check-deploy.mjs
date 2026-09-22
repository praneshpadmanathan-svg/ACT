/* Ask the deployed site what it actually shipped.
 *
 * `supabase:doctor` asks the database, and every box on the launch checklist
 * is a claim someone ticks by hand. Between the two sits the thing neither of
 * them can see: whether the build that is live was given the configuration it
 * needed at the moment it was built.
 *
 * The trap this exists for: Vite only exposes variables carrying its `VITE_`
 * prefix, and the names Supabase's own Vercel integration writes when you
 * connect the two are `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Connect the
 * integration, read the dashboard, see both names present, and conclude the app
 * is configured — while `cloudEnabled = Boolean(url && anonKey)` is false,
 * because neither name is one this app reads. Nothing reports it. The app is
 * built to degrade to local-only guest mode, so it degrades: sign-in stays on
 * screen leading to an account system that cannot exist, and every student's
 * progress quietly lives only in their own browser. This project has both sets
 * of names on the same Vercel project, which is exactly the shape that makes
 * the dashboard unreadable as evidence.
 *
 * A build-time guard cannot catch it — CI builds with no Supabase variables on
 * purpose, and should keep passing. The only place the truth exists is the
 * artifact the browser downloads. So: fetch it and read it.
 *
 *   npm run check:deploy                       (act-red.vercel.app)
 *   npm run check:deploy -- https://other.tld
 *
 * Read-only. It makes GET requests to a public site and sends no credentials.
 */

const DEFAULT_SITE = 'https://act-red.vercel.app';

const site = (process.argv[2] ?? DEFAULT_SITE).replace(/\/+$/, '');

const results = [];
const ok = (name, detail) => results.push({ level: 'ok', name, detail });
const warn = (name, detail, fix) => results.push({ level: 'warn', name, detail, fix });
const fail = (name, detail, fix) => results.push({ level: 'fail', name, detail, fix });

/* Every request gets a deadline. A hung fetch here would hang a release check,
   and `fetch` has no default timeout. An AbortController that is cleared on the
   way out rather than `AbortSignal.timeout`, whose timer keeps the event loop
   alive long enough to turn a clean exit into a nonzero one. */
async function get(url) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 15_000);
  try {
    return await fetch(url, { signal: ac.signal, redirect: 'follow' });
  } finally {
    clearTimeout(timer);
  }
}

let html;
let res;
try {
  res = await get(`${site}/`);
  html = await res.text();
} catch (e) {
  console.error(`\n  check:deploy — cannot reach ${site}\n         ${e.message}\n`);
  process.exit(1);
}

if (!res.ok) {
  console.error(`\n  check:deploy — ${site} answered ${res.status} ${res.statusText}\n`);
  process.exit(1);
}

/* ------------------------------------------------------------- the bundle */

/* Only the scripts the document itself names. A lazily imported chunk is not
   reachable from here without executing the app, and the Supabase client is
   constructed at module scope in the entry graph, so the entry chunks are where
   the URL has to be if it is anywhere. */
const scripts = [
  ...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1])),
];

if (scripts.length === 0) {
  fail(
    'bundle',
    'The document references no /assets/*.js files.',
    'Check the deployment actually built — an empty shell usually means the output directory is wrong.',
  );
}

let code = '';
for (const path of scripts) {
  try {
    const r = await get(`${site}${path}`);
    if (r.ok) code += await r.text();
  } catch {
    /* One unreachable chunk should not mask the checks the others can answer;
       a wholly unreachable site already exited above. */
  }
}

/* ------------------------------------------------------- is the cloud on? */

const hosts = [
  ...new Set([...code.matchAll(/https:\/\/([a-z0-9]{8,})\.supabase\.co/g)].map((m) => m[1])),
];

if (hosts.length === 0) {
  fail(
    'cloud sync',
    'No Supabase host appears anywhere in the shipped JavaScript, so `cloudEnabled` is false in production: ' +
      'accounts, sign-in and cross-device sync do nothing, and every student’s progress lives only in their own browser.',
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY on the Vercel project, for every environment, then redeploy. ' +
      'The VITE_ prefix is not optional and the names Supabase’s Vercel integration writes (SUPABASE_URL, ' +
      'SUPABASE_ANON_KEY) are not the ones this app reads.',
  );
} else if (hosts.length > 1) {
  warn(
    'cloud sync',
    `The bundle names more than one Supabase project: ${hosts.join(', ')}.`,
    'Two projects in one build usually means a stale variable was left behind. Remove the one you do not use.',
  );
} else {
  ok('cloud sync', `Configured against ${hosts[0]}.supabase.co.`);
}

/* ------------------------------------------------- is the wrong key on it? */

/* The catastrophic version of a configuration mistake, and the one worth
   spending a decoder on. A Supabase anon key and a service_role key are both
   JWTs and look identical at a glance — same prefix, same length class, same
   place in the dashboard. They differ in one claim, and shipping the second one
   hands every visitor the ability to read and write every row in the database
   with RLS bypassed. Checking the shape is not enough; read the claim. */
for (const [jwt] of code.matchAll(
  /eyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{20,})\.[A-Za-z0-9_-]+/g,
)) {
  const payload = jwt.split('.')[1];
  let claims;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    continue;
  }
  if (claims.role && claims.role !== 'anon') {
    fail(
      'key in the bundle',
      `A JWT with role="${claims.role}" is in the shipped JavaScript. Anyone who opens the site has it.`,
      'Rotate that key in the Supabase dashboard immediately, then set VITE_SUPABASE_ANON_KEY to the anon/publishable key instead.',
    );
  }
}
/* The prefix alone is not a finding. supabase-js ships its own key-format
   guard — `e.startsWith('sb_publishable_') || e.startsWith('sb_secret_')` —
   so the bare string is in every bundle that imports the client, and matching
   on it reports a leaked secret key on a perfectly clean deployment. Require
   a key-shaped payload after the prefix, which the library's literal has not
   got. */
if (/sb_secret_[A-Za-z0-9_-]{16,}/.test(code)) {
  fail(
    'key in the bundle',
    'A Supabase secret key (sb_secret_…) is in the shipped JavaScript.',
    'Rotate it in the dashboard immediately and remove it from the build environment.',
  );
}
if (!results.some((r) => r.name === 'key in the bundle')) {
  ok('key in the bundle', 'No service_role or secret key is exposed to the browser.');
}

/* ------------------------------------------------------------ the headers */

/* vercel.json declares these, and a file in the repo declaring them is not
   evidence the edge is sending them: a header block only applies if the
   deployment picked that config up. */
const required = {
  'content-security-policy': 'Content-Security-Policy',
  'strict-transport-security': 'Strict-Transport-Security',
  'x-content-type-options': 'X-Content-Type-Options',
  'x-frame-options': 'X-Frame-Options',
  'referrer-policy': 'Referrer-Policy',
  'permissions-policy': 'Permissions-Policy',
  'cross-origin-opener-policy': 'Cross-Origin-Opener-Policy',
};

const missing = Object.entries(required)
  .filter(([h]) => !res.headers.get(h))
  .map(([, label]) => label);

if (missing.length) {
  fail(
    'security headers',
    `The live response is missing: ${missing.join(', ')}.`,
    'These are declared in vercel.json. If they are absent the deployment is not using that file — check the project root directory setting.',
  );
} else {
  ok('security headers', 'All seven declared headers are present on the live response.');
}

const csp = res.headers.get('content-security-policy') ?? '';
if (csp && !/frame-ancestors\s+'none'/.test(csp)) {
  warn(
    'clickjacking',
    'The CSP does not set frame-ancestors ‘none’.',
    'X-Frame-Options covers older browsers, frame-ancestors covers the rest.',
  );
}
if (hosts.length === 1 && csp && !/connect-src[^;]*supabase\.co/.test(csp)) {
  fail(
    'CSP vs Supabase',
    'The bundle talks to Supabase but connect-src does not allow supabase.co, so every request will be blocked in the browser.',
    'Add https://*.supabase.co and wss://*.supabase.co to connect-src in vercel.json.',
  );
}

/* ------------------------------------------------------------- the report */

const symbol = { ok: 'ok  ', warn: 'warn', fail: 'FAIL' };
console.log(`\n  check:deploy — ${site}\n`);
for (const r of results) {
  console.log(`  [${symbol[r.level]}] ${r.name}`);
  console.log(`         ${r.detail}`);
  if (r.fix) console.log(`         -> ${r.fix}`);
  console.log('');
}

const failed = results.filter((r) => r.level === 'fail');
const warnings = results.filter((r) => r.level === 'warn').length;

if (failed.length) {
  console.error(`  ${failed.length} failure(s), ${warnings} warning(s).\n`);
  process.exitCode = 1;
} else {
  console.log(`  No failures, ${warnings} warning(s).\n`);
}
