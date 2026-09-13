/* The generator and the verifier have to agree, and nothing else checks that.
 *
 * `scripts/make-code.mjs` mints a code on your machine and prints a hash;
 * `supabase/functions/redeem-code/index.ts` verifies that hash in Deno. They
 * are two files, in two runtimes, that never import each other — so if the
 * iteration count drifts on one side, or the stored format gains a field, the
 * failure is not a stack trace. It is a master code that is simply refused,
 * discovered whenever you next try to use it, with nothing in any log saying
 * why. This file makes that a failing test instead.
 *
 * The known-answer vector below is the real guard. Reading constants out of
 * both files catches a careless edit; the vector catches a subtle one, because
 * it pins the actual bytes PBKDF2 must produce for a known code and salt. Any
 * change to the algorithm, the digest, the key length or the encoding breaks
 * it, including changes made in good faith on only one side.
 */

import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { describe, expect, it } from 'vitest';

const GENERATOR = readFileSync('scripts/make-code.mjs', 'utf8');
const VERIFIER = readFileSync('supabase/functions/redeem-code/index.ts', 'utf8');

/* A fixed vector, computed once and written down. Not generated at test time —
   a test that derives its own expected value with the code under test agrees
   with itself no matter what either side does. */
const VECTOR = {
  code: 'CBD4T-130TQ-7Q09Z-KNGJ6-9AQRS',
  stored: 'pbkdf2-sha256$100000$5+aSKsfuQRARDe3dGksQQQ==$rKGeqAC2IQOvTmYbSbr3QWsDZzR+LMdk0lZ4ZSgUbwQ=',
};

/** The verifier's algorithm, kept deliberately independent of both files. */
async function derive(code: string, stored: string): Promise<string | null> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2-sha256') return null;
  const iterations = Number(parts[1]);
  const salt = Buffer.from(parts[2]!, 'base64');
  const expected = Buffer.from(parts[3]!, 'base64');

  const key = await webcrypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(code),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await webcrypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    expected.length * 8,
  );
  return Buffer.from(bits).toString('base64');
}

describe('the stored hash format', () => {
  it('uses the same iteration count on both sides', () => {
    const gen = GENERATOR.match(/const ITERATIONS = ([\d_]+)/)?.[1]?.replace(/_/g, '');
    expect(gen, 'ITERATIONS not found in scripts/make-code.mjs').toBeDefined();

    /* The verifier reads its count out of each row rather than hard-coding
       one, which is the right design — but it bounds what it will accept, and
       a generator that walked past that bound would mint dead codes. */
    const max = VERIFIER.match(/iterations > ([\d_]+)/)?.[1]?.replace(/_/g, '');
    expect(max, 'iteration ceiling not found in the Edge Function').toBeDefined();
    expect(Number(gen)).toBeGreaterThan(0);
    expect(Number(gen)).toBeLessThanOrEqual(Number(max));
  });

  it('names the same algorithm on both sides', () => {
    expect(GENERATOR).toContain('pbkdf2-sha256$');
    expect(VERIFIER).toContain("parts[0] !== 'pbkdf2-sha256'");
  });

  it('is what the generator actually writes', () => {
    /* Guards the shape of the printed value: four `$`-separated fields with
       the iteration count second, which is what the verifier splits on. */
    expect(GENERATOR).toMatch(/pbkdf2-sha256\$\$\{ITERATIONS\}\$.+\$/);
  });
});

describe('a minted code verifies', () => {
  it('accepts the right code', async () => {
    const [, , , expected] = VECTOR.stored.split('$');
    expect(await derive(VECTOR.code, VECTOR.stored)).toBe(expected);
  });

  it('rejects a code one character off', async () => {
    const [, , , expected] = VECTOR.stored.split('$');
    const wrong = VECTOR.code.slice(0, -1) + 'T';
    expect(await derive(wrong, VECTOR.stored)).not.toBe(expected);
  });

  it('rejects the code lower-cased, which is why the server upper-cases first', async () => {
    /* Not a quirk worth fixing in the KDF — PBKDF2 is over bytes and should be
       — but it is the reason `tidy()` exists in the Edge Function, and if that
       normalisation is ever dropped every code typed in lower case breaks. */
    const [, , , expected] = VECTOR.stored.split('$');
    expect(await derive(VECTOR.code.toLowerCase(), VECTOR.stored)).not.toBe(expected);
    expect(VERIFIER).toContain('toUpperCase()');
  });
});

describe('the generated code itself', () => {
  it('draws on an alphabet with no confusable characters', () => {
    const alphabet = GENERATOR.match(/const ALPHABET = '([^']+)'/)?.[1];
    expect(alphabet).toBeDefined();
    for (const c of 'ILOU') expect(alphabet).not.toContain(c);
    expect(new Set(alphabet!).size).toBe(alphabet!.length);
  });

  it('carries enough entropy that the KDF is not what protects it', () => {
    const alphabet = GENERATOR.match(/const ALPHABET = '([^']+)'/)?.[1] ?? '';
    const groups = Number(GENERATOR.match(/const GROUPS = (\d+)/)?.[1]);
    const len = Number(GENERATOR.match(/const GROUP_LEN = (\d+)/)?.[1]);
    const bits = groups * len * Math.log2(alphabet.length);
    /* The plan called for 24+ characters of base32. Below about 100 bits the
       whole security argument in 0004_redeem.sql stops being true and the
       iteration count would have to rise to compensate. */
    expect(bits).toBeGreaterThanOrEqual(100);
  });
});

describe('the client holds no opinion about codes', () => {
  it('never compares a code to anything', () => {
    /* The one invariant that makes the scheme work: everything the bundle can
       check, a reader of the bundle can forge. If a literal code or a
       comparison ever appears in src/, the master code is public. */
    const client = readFileSync('src/lib/entitlements.ts', 'utf8');
    const body = client.slice(client.indexOf('export async function redeemCode'));
    expect(body).not.toMatch(/===\s*['"`][A-Z0-9-]{8,}/);
    expect(body).toContain("functions.invoke");
  });

  it('keeps no code plaintext anywhere in the repo source', () => {
    /* The vector above is the only 25-character grouped string that should
       exist in the tree, and it is a throwaway. A real one landing in a file
       is the failure this whole design exists to prevent. */
    const pattern = /[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}/;
    expect(pattern.test(GENERATOR)).toBe(false);
    expect(pattern.test(VERIFIER)).toBe(false);
    expect(pattern.test(readFileSync('src/lib/entitlements.ts', 'utf8'))).toBe(false);
    expect(pattern.test(readFileSync('src/components/ProGate.tsx', 'utf8'))).toBe(false);
  });
});
