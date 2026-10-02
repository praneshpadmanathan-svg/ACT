// @vitest-environment node
/* The CSP in vercel.json says `script-src 'self'` plus a hash for each inline
 * script in index.html. A hash is exact to the byte, so the failure this
 * guards is silent: someone fixes a typo in the too-old-browser notice, the
 * hash goes stale, production refuses the script, and the people it exists
 * for get the blank page again. Nobody notices, because a browser new enough
 * to be developing on never needs the notice — and the dev server sends no
 * CSP at all.
 *
 * Vite copies classic inline scripts into dist/index.html untouched, so the
 * source file is what gets hashed. */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
const vercel = JSON.parse(readFileSync(new URL('vercel.json', root), 'utf8'));

const csp = vercel.headers
  .flatMap((rule) => rule.headers)
  .find((h) => h.key === 'Content-Security-Policy').value;
const scriptSrc = csp
  .split(';')
  .map((d) => d.trim())
  .find((d) => d.startsWith('script-src '));

/* Only scripts with no `src` are inline; the module entry is covered by 'self'. */
const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
  (m) => m[1],
);

describe('CSP inline-script hashes', () => {
  it('finds the inline script it is meant to guard', () => {
    expect(inline.length).toBeGreaterThan(0);
  });

  it.each(inline.map((body, i) => [i, body]))(
    'script-src allows inline script #%i by hash',
    (_i, body) => {
      const hash = createHash('sha256').update(body, 'utf8').digest('base64');
      expect(scriptSrc).toContain(`'sha256-${hash}'`);
    },
  );

  it('never falls back to unsafe-inline', () => {
    expect(scriptSrc).not.toContain('unsafe-inline');
  });
});
