/* The Supabase URL and publishable key, read from the live site.
 *
 * Both values are public by design: they are compiled into the JavaScript every
 * visitor downloads, and row-level security is what protects the data. Anything
 * that only needs the public pair — the keepalive, the doctor — can therefore
 * read it from production instead of from a secret or a local `.env`. That
 * removes a setup step, and it cannot drift: it is by definition the pair the
 * students' browsers are using right now.
 *
 * Never extend this to anything privileged. A service_role or secret key must
 * not be in the bundle at all (`check:deploy` fails if one is), so there is
 * nothing more to find here, and nothing more should ever be looked for.
 *
 *   import { liftPublicConfig } from './public-config.mjs';
 *   node scripts/public-config.mjs --github-env   # appends to $GITHUB_ENV
 */

import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const DEFAULT_SITE = 'https://act-red.vercel.app';

const CHUNK = /["'`](?:\.\/|\/)?(?:assets\/)?([A-Za-z0-9_$-]+-[A-Za-z0-9_-]{8}\.js)["'`]/g;
const URL_RE = /https:\/\/[a-z0-9]{8,}\.supabase\.co/;
const KEY_RE =
  /sb_publishable_[A-Za-z0-9_-]{10,}|eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+/;

async function get(url) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 15_000);
  try {
    const r = await fetch(url, { signal: ac.signal, redirect: 'follow' });
    return r.ok ? await r.text() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* Anon JWTs and publishable keys can both appear; only an anon-role JWT is
   acceptable, for the same reason check:deploy decodes the claim. */
function isPublic(key) {
  if (key.startsWith('sb_publishable_')) return true;
  try {
    const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'));
    return claims.role === 'anon';
  } catch {
    return false;
  }
}

export async function liftPublicConfig(site = DEFAULT_SITE) {
  site = site.replace(/\/+$/, '');
  const html = await get(`${site}/`);
  if (!html) throw new Error(`${site} did not answer.`);

  const queue = [
    ...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1])),
  ];
  const seen = new Set(queue);
  let url = null;
  let key = null;

  while (queue.length && seen.size <= 200 && !(url && key)) {
    const text = await get(`${site}${queue.shift()}`);
    if (!text) continue;
    url ??= (text.match(URL_RE) ?? [])[0] ?? null;
    const candidate = (text.match(KEY_RE) ?? [])[0];
    if (!key && candidate && isPublic(candidate)) key = candidate;
    for (const [, name] of text.matchAll(CHUNK)) {
      const next = `/assets/${name}`;
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }

  if (!url || !key) {
    throw new Error(
      `Could not find both the Supabase URL and a public key in ${site}'s bundle ` +
        `(url: ${Boolean(url)}, key: ${Boolean(key)}). Run \`npm run check:deploy\` to see what shipped.`,
    );
  }
  return { url, key };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    const { url, key } = await liftPublicConfig(process.argv.find((a) => a.startsWith('http')));
    if (process.argv.includes('--github-env')) {
      appendFileSync(process.env.GITHUB_ENV, `SUPABASE_URL=${url}\nSUPABASE_ANON_KEY=${key}\n`);
      console.log(`Read the public config from the live site: ${url}`);
    } else {
      console.log(url);
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
