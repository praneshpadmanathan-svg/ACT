/* Who to write to, in one place.
 *
 * The address used to be a `const` in the middle of `Legal.tsx`, and it was a
 * personal Gmail. Two separate reviewers flagged the same thing: it sits on a
 * public page aimed at minors, so it will be scraped; whoever answers it may
 * not always be the person who wrote the app; and, as the parent's review put
 * it, that one detail undercuts the professionalism of everything around it.
 *
 * Three roles rather than one inbox, because they have genuinely different
 * urgency and different readers:
 *
 *   support   — "how do I", "this question looks wrong", account trouble
 *   privacy   — data access, deletion and correction requests, which have
 *               statutory response windows attached in several states
 *   security  — vulnerability disclosure, which needs to reach someone who
 *               can act on it and must never sit behind a support queue
 *
 * All three read from build-time env vars so a deployment can point them
 * wherever it likes without a code change, and all three fall back to the
 * same address so a fork with nothing configured still has a working contact
 * rather than a broken `mailto:`.
 *
 * One address this file does NOT reach: `public/.well-known/security.txt` is a
 * static file copied verbatim into the build, so an env var cannot touch it and
 * its `Contact:` line has to be edited by hand. `npm run check:deploy` fetches
 * the live file and fails when it drifts from the address in the bundle, which
 * is the only reason the two can be trusted to agree.
 */

const FALLBACK = 'pranesh.padmanathan@gmail.com';

const read = (value: unknown): string | null => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.includes('@') ? text : null;
};

export const CONTACT = {
  support: read(import.meta.env.VITE_CONTACT_SUPPORT) ?? FALLBACK,
  privacy:
    read(import.meta.env.VITE_CONTACT_PRIVACY) ??
    read(import.meta.env.VITE_CONTACT_SUPPORT) ??
    FALLBACK,
  security:
    read(import.meta.env.VITE_CONTACT_SECURITY) ??
    read(import.meta.env.VITE_CONTACT_SUPPORT) ??
    FALLBACK,
} as const;

/** True while the deployment is still using the hard-coded personal address.
 *
 *  Read by `npm run check:deploy`, which looks for this address in the shipped
 *  JavaScript rather than trusting a checklist tick: the build that is live is
 *  the only thing that knows which env vars it was actually given. */
export const CONTACT_IS_PLACEHOLDER = CONTACT.support === FALLBACK;

/** Build a `mailto:` with the subject and body pre-filled and escaped. */
export function mailto(to: string, { subject, body }: { subject: string; body?: string }): string {
  const params = new URLSearchParams({ subject });
  if (body) params.set('body', body);
  // URLSearchParams encodes spaces as `+`, which mail clients show literally.
  return `mailto:${to}?${params.toString().replace(/\+/g, '%20')}`;
}
