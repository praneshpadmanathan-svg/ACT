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

import { readFileSync } from 'node:fs';

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

/* Start from the scripts the document names, then follow the chunk names those
   scripts mention, and repeat until nothing new turns up.

   The document names 10 chunks; the app ships about 45. Every route past the
   entry — Legal, Auth, Zone, Boss — is a lazy import, so scanning only the
   named scripts reads roughly a fifth of the code and then reports "no secret
   key in the bundle" about the four fifths it never fetched. A leaked key is
   most likely in exactly the kind of feature module that gets split out.

   Vite writes each lazy import as a bare chunk filename inside the importing
   chunk, so the graph can be walked by reading strings — nothing is executed. */
const CHUNK = /["'`](?:\.\/|\/)?(?:assets\/)?([A-Za-z0-9_$-]+-[A-Za-z0-9_-]{8}\.js)["'`]/g;

const queue = [
  ...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1])),
];
const seen = new Set(queue);
const scripts = [];

let code = '';
while (queue.length) {
  const path = queue.shift();
  let text;
  try {
    const r = await get(`${site}${path}`);
    if (!r.ok) continue;
    text = await r.text();
  } catch {
    /* One unreachable chunk should not mask the checks the others can answer;
       a wholly unreachable site already exited above. */
    continue;
  }
  scripts.push(path);
  code += text;
  for (const [, name] of text.matchAll(CHUNK)) {
    const next = `/assets/${name}`;
    if (seen.has(next)) continue;
    seen.add(next);
    queue.push(next);
  }
}

if (scripts.length === 0) {
  fail(
    'bundle',
    'The document references no /assets/*.js files.',
    'Check the deployment actually built — an empty shell usually means the output directory is wrong.',
  );
} else {
  ok(
    'bundle',
    `Read ${scripts.length} chunks, ${Math.round(code.length / 1024)} kB of JavaScript.`,
  );
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

/* ------------------------------------------------------- how to reach anyone */

/* The privacy policy names an address and promises a reply to deletion
   requests, several of which carry statutory response windows. Two ways that
   goes wrong, and both are invisible from the repository:

   a free-mail address is a personal inbox on a public page aimed at minors,
   which will be scraped — and it arrives by either of two routes that look
   identical from outside: the VITE_CONTACT_* variables were never set on the
   deployment, so src/lib/contact.ts's FALLBACK shipped, or someone set a
   consumer address on purpose. The check below tells them apart, because the
   fix differs; and security.txt is a static file no env var can reach, so it
   drifts silently the moment the bundle's address changes. */

const FREE_MAIL = /@(gmail|googlemail|yahoo|hotmail|outlook|live|icloud|aol|proton(mail)?)\./i;

const bundleEmails = [
  ...new Set(
    [...code.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)]
      .map((m) => m[0])
      /* Dependencies carry author and issue-tracker addresses of their own, so
         narrow to addresses the app states as its own: a whole string literal,
         or the target of a mailto:. All three quote characters, because the
         minifier picks whichever it likes and this app's address happens to
         come out in backticks — a filter that checked only ' and " found
         nothing on a deployment that publishes the address on two pages. */
      .filter(
        (e) =>
          code.includes(`mailto:${e}`) ||
          [`"`, `'`, '`'].some((q) => code.includes(`${q}${e}${q}`)),
      ),
  ),
];

const personal = bundleEmails.filter((e) => FREE_MAIL.test(e));

if (personal.length) {
  /* Two different problems wear the same symptom, and printing the wrong fix
     sends you to the wrong place. Still the source fallback means the build was
     never given the variables; a *different* consumer-mail address means one
     was chosen on purpose. Both earn a warning on a page that offers minors a
     data-deletion route — a mailbox on a free provider cannot be handed to
     anyone else, dies with the personal account, and has no custody story for
     the access and deletion requests the privacy policy promises to honour —
     but only the first is a deployment mistake.

     Read the fallback out of the source rather than repeating it here. A second
     copy of that address in the repo is the thing commit 055a5f4 removed from
     Legal.tsx, and it would drift the moment either side changed. */
  const fallback = (readFileSync(new URL('../src/lib/contact.ts', import.meta.url), 'utf8').match(
    /FALLBACK\s*=\s*['"]([^'"]+)['"]/,
  ) ?? [])[1];
  const unset = Boolean(fallback) && personal.includes(fallback);

  warn(
    'contact address',
    `The live build publishes ${personal.join(', ')} as its contact address. ` +
      (unset
        ? 'That is still the fallback in src/lib/contact.ts, so the deployment was never given the contact variables.'
        : 'That is a consumer mail provider, so it was set deliberately — but it is still a personal mailbox on a public page aimed at minors.'),
    unset
      ? 'Set VITE_CONTACT_SUPPORT (and optionally VITE_CONTACT_PRIVACY, VITE_CONTACT_SECURITY) on the ' +
          'Vercel project and redeploy, then edit public/.well-known/security.txt to match by hand.'
      : 'Prefer an address on a domain you control: it can be handed over, it survives losing the ' +
          'personal account, and it does not tie the project to one individual. If this is a ' +
          'deliberate interim choice, it stays a warning and never becomes a failure.',
  );
} else if (bundleEmails.length) {
  ok('contact address', `Publishes ${bundleEmails.join(', ')}.`);
}

/* RFC 9116. Scanners and researchers read this before they resort to guessing
   an address or posting the finding publicly, so a stale one is worse than
   none: an expired file is formally unmaintained, and a Contact: line that no
   longer matches the app sends the report to an inbox nobody reads. */
try {
  const r = await get(`${site}/.well-known/security.txt`);
  if (!r.ok) {
    warn(
      'security.txt',
      `/.well-known/security.txt answered ${r.status}.`,
      'Researchers look here first. Without it a finding arrives by whatever route they improvise.',
    );
  } else {
    const txt = await r.text();
    const at = txt.match(/^Contact:\s*(?:mailto:)?(\S+@\S+)\s*$/im)?.[1];
    const until = txt.match(/^Expires:\s*(\S+)\s*$/im)?.[1];
    const expiry = until ? new Date(until) : null;

    if (expiry && !Number.isNaN(expiry.valueOf()) && expiry < new Date()) {
      fail(
        'security.txt',
        `Expired on ${expiry.toISOString().slice(0, 10)}. RFC 9116 says a file past its Expires is to be treated as unmaintained.`,
        'Renew the Expires date in public/.well-known/security.txt, or delete the file.',
      );
    } else if (at && bundleEmails.length && !bundleEmails.includes(at)) {
      fail(
        'security.txt',
        `It gives ${at}, but the app publishes ${bundleEmails.join(', ')}. A vulnerability report would go to the wrong place.`,
        'public/.well-known/security.txt is static — no env var reaches it. Edit its Contact: line to match.',
      );
    } else if (!at) {
      warn(
        'security.txt',
        'Served, but it has no parseable Contact: line.',
        'Contact: is the one required field in RFC 9116.',
      );
    } else {
      ok(
        'security.txt',
        `Served, contact ${at}, valid until ${expiry ? expiry.toISOString().slice(0, 10) : 'unstated'}.`,
      );
    }
  }
} catch {
  warn('security.txt', 'Could not be fetched.', 'Check it is committed under public/.well-known/.');
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
