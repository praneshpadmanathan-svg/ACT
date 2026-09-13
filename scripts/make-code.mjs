#!/usr/bin/env node
/* Mint a redemption code.
 *
 *   node scripts/make-code.mjs --label "master"
 *   node scripts/make-code.mjs --label "launch promo" --max-uses 100 --expires 2026-12-31
 *
 * Prints two things: the code, once, for your password manager — and a SQL
 * INSERT holding only its hash, for the Supabase SQL editor.
 *
 * The split matters. The Supabase SQL editor keeps a query history, so a
 * plaintext code pasted into it survives in the dashboard of anyone who can
 * open that project. Hashing here means the only place the plaintext ever
 * exists is this terminal and wherever you choose to put it. Nothing is
 * written to disk by this script, deliberately: a file is something you have
 * to remember to delete.
 *
 * No dependencies. PBKDF2 is in `node:crypto`'s Web Crypto, and the Edge
 * Function verifies with the same primitive from Deno's — see
 * supabase/functions/redeem-code/index.ts.
 */

import { webcrypto, randomBytes } from 'node:crypto';

/* Crockford base32 without I, L, O and U: no character pair in this set can be
   confused for another in a terminal font or read wrong down a phone line, and
   dropping U means the generator cannot accidentally spell anything. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const GROUPS = 5;
const GROUP_LEN = 5;

/* 25 characters over a 32-symbol alphabet is 125 bits. That number is the
   whole security argument: the hash below is not what stops someone guessing a
   code, the entropy is, and 125 bits is not guessable by anyone at any budget.
   Everything else here — the KDF, the rate limiter — is defence in depth. */
function makeCode() {
  const out = [];
  for (let g = 0; g < GROUPS; g++) {
    let group = '';
    /* Rejection sampling rather than `% 32`. 256 happens to be divisible by 32
       so a modulo would be unbiased here, but writing it that way makes the
       code silently wrong the day somebody edits the alphabet. */
    while (group.length < GROUP_LEN) {
      for (const byte of randomBytes(GROUP_LEN * 2)) {
        if (byte >= 256 - (256 % ALPHABET.length)) continue;
        group += ALPHABET[byte % ALPHABET.length];
        if (group.length === GROUP_LEN) break;
      }
    }
    out.push(group);
  }
  return out.join('-');
}

/* Written into the stored value rather than agreed with the verifier: the Edge
   Function reads the cost out of each row, so raising this only affects codes
   minted afterwards and existing ones keep working. It must stay under the
   ceiling that function refuses above — src/lib/redemption.test.ts checks that.
   See 0004_redeem.sql for why it is moderate rather than maximal. */
const ITERATIONS = 100_000;

async function hash(code, salt) {
  const key = await webcrypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(code),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await webcrypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    key,
    256,
  );
  return Buffer.from(bits);
}

function arg(name, fallback = null) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1]
    : fallback;
}

const sql = (v) => (v === null ? 'null' : `'${String(v).replace(/'/g, "''")}'`);

const label = arg('label', 'master');
const grants = arg('grants', 'pro');
const maxUses = arg('max-uses');
const expires = arg('expires');

if (maxUses !== null && !/^\d+$/.test(maxUses)) {
  console.error('--max-uses must be a whole number.');
  process.exit(1);
}
if (expires !== null && Number.isNaN(Date.parse(expires))) {
  console.error('--expires must be a date Postgres can read, e.g. 2026-12-31.');
  process.exit(1);
}

const code = makeCode();
const salt = randomBytes(16);
const digest = await hash(code, salt);
const stored = `pbkdf2-sha256$${ITERATIONS}$${salt.toString('base64')}$${digest.toString('base64')}`;

console.log(`
  ┌─────────────────────────────────────────────────┐
  │  ${code}                    │
  └─────────────────────────────────────────────────┘

  Put that in your password manager now. It is not stored anywhere
  and this script cannot print it again.

  Then run this in the Supabase SQL editor — it contains only the
  hash, so it is safe to leave in the query history:

insert into public.redemption_codes (code_hash, label, grants, max_uses, expires_at)
values (
  '${stored}',
  ${sql(label)},
  ${sql(grants)},
  ${maxUses === null ? 'null' : maxUses},
  ${expires === null ? 'null' : `${sql(expires)}::timestamptz`}
);

  label     ${label}
  grants    ${grants}
  max uses  ${maxUses === null ? 'unlimited' : maxUses}
  expires   ${expires === null ? 'never' : expires}
`);
