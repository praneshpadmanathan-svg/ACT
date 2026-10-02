/* How a question gets its permanent id — shared by the app and the build.
 *
 * Moved out of `lib/normalize.ts` so the build can compute the same ids the
 * runtime does. The content index (see `vitePlugin.ts`) lists every id that
 * names a real question, so that counting a review queue does not mean
 * downloading the questions in it; a zone question's id is a hash of its
 * text, so the build has to hash it exactly as the app will, and the only
 * honest way to guarantee that is to run the same function.
 *
 * Pure, and type-only on `@/types`: `vite.config.ts` imports this file through
 * the plugin, and the config loader does not know the `@/` alias. */

import type { ZoneQuestion } from '@/types';

/** Stable 32-bit hash of a string (FNV-1a), so an order or an id never drifts. */
export function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) || 1;
}

/* A zone question's permanent id.
 *
 * It was `${zoneId}-q${index}`, where `index` was the question's place in a
 * freshly shuffled six-question sample — so `comma_castle-q0` named a
 * different question on every visit. Spaced repetition files a miss under that
 * id and brings it back days later, which meant it was bringing back whichever
 * question happened to land in slot 0 that day. Every miss on the map went
 * into the review ladder as noise, and none of it could be looked up again
 * anyway: the id matched nothing in any bank.
 *
 * Hashed from the prompt rather than counted from a position, so inserting a
 * question into a zone's pool renumbers nothing. A positional id would hand
 * one student's review history to a different question the next time anybody
 * edited the JSON. Editing a question's text does retire its entry, which is
 * right — it is not the same question any more.
 *
 * The `h` is a format marker. Load-time pruning uses it to recognise the
 * positional ids that can never resolve, so keep it.
 *
 * The stem alone is not enough to identify a question: three pairs in the
 * bank share one — `Choose the correct sentence:` in the apostrophe zone is
 * asked twice, about two different sentences. So the fingerprint covers the
 * choices too, sorted, because the runner reshuffles them at display time
 * and the order they were typed in therefore means nothing. An id that
 * changed when somebody rearranged four lines of JSON would be the same
 * mistake as the positional one, just rarer.
 */
export function zoneQuestionId(zoneId: string, q: ZoneQuestion): string {
  const fingerprint = [q.q, ...[...q.opts].sort(), q.opts[q.a] ?? ''].join('\u0000');
  return `${zoneId}-h${hashId(fingerprint).toString(36)}`;
}
