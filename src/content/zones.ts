/* The map: thirty-seven landmarks and the four roads they sit on.
 *
 * Split out of `index.ts` alongside `sections.ts`, and for the same reason.
 * `paths.json` is 10 kB; the rest of the library is 738 kB. Three things on
 * the app's eager path need only this file — `progress.ts` for the zone-topic
 * aliases, the story overlay and the landing page for the road names — and
 * before the split all three pulled the entire question bank in behind them.
 */

import type { Path, SectionId, Zone } from '@/types';
import { canonicalTopic } from '@/lib/utils';

import pathsJson from './paths.json';

export const PATHS = pathsJson as Path[];

export const PATH_BY_ID: Record<SectionId, Path> = Object.fromEntries(
  PATHS.map((p) => [p.id, p]),
) as Record<SectionId, Path>;

const ZONE_INDEX = new Map<string, { zone: Zone; path: Path; index: number }>();
PATHS.forEach((path) => {
  path.nodes.forEach((zone, index) => ZONE_INDEX.set(zone.id, { zone, path, index }));
});

export const getZone = (id: string) => ZONE_INDEX.get(id);
export const ALL_ZONES = [...ZONE_INDEX.values()];

/* --------------------------------------------------- zone name -> its topic

   The zone quizzes were tagged with the landmark's old shouting name —
   `COMMA CASTLE` — rather than the skill being tested, and questions with no
   tag at all fell back to the raw id, `comma_castle`. Both canonicalise to the
   same string, and this maps that string to the topic the path declares.

   It exists so progress recorded under a *place* can be folded into the skill
   it was really about, rather than stranding a student's comma history under
   the name of a landmark that was renamed two releases ago. */
export const TOPIC_BY_ZONE_ALIAS: Record<string, string> = {};
for (const { zone } of ALL_ZONES) {
  if (!zone.topic) continue;
  const topic = canonicalTopic(zone.topic);
  TOPIC_BY_ZONE_ALIAS[canonicalTopic(zone.id)] = topic;
  TOPIC_BY_ZONE_ALIAS[canonicalTopic(zone.name)] = topic;
}
