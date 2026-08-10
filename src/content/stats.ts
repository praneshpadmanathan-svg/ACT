/* How big the library is, without loading the library.
 *
 * These five numbers used to be computed at module load by counting the real
 * arrays — honest, and it meant the landing page could not say "342 practice
 * questions" without first downloading all 342 of them. 185 kB gzipped, on the
 * first screen a stranger sees, to render one sentence.
 *
 * So the totals are a build artifact now. `scripts/check-content.mjs`
 * recomputes them from the JSON on every build and fails if `stats.json`
 * disagrees, which is what keeps this from being a number somebody typed once
 * and forgot. `npm run check:content -- --write` updates it after a content
 * change.
 */

import totals from './stats.json';

export const LIBRARY_STATS = {
  drillQuestions: totals.drillQuestions,
  zoneQuestions: totals.zoneQuestions,
  notePages: totals.notePages,
  passages: totals.passages,
  zones: totals.zones,
  get totalQuestions() {
    return this.drillQuestions + this.zoneQuestions;
  },
};
