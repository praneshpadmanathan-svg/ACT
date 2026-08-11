/* Things the map knows about that are not terrain: what is calling you back,
   and where today's courier is standing.

   ── Why this file does not import the question bank ──────────────────────────

   Both features below need to know which landmark a question belongs to, and
   the obvious way to get that is to look the question up in `@/content`. That
   would pull all 621 kB of the library into the map chunk, which is the exact
   regression the content split was done to prevent — the map is a lazy route
   precisely so that opening it does not cost the whole bank.

   It turns out not to be necessary. Question ids already carry their origin:

     `comma_castle-q3`   a zone quiz — the id before `-q` *is* the landmark
     `e001` `m014`       a drill question — the first letter is the section

   That is enough to place a review on the map without reading a single
   question. It is a real coupling to an id format, so `check-content.mjs`
   enforces the drill prefixes and `normalize.ts` owns the zone-quiz form; if
   either changes, this file has to change with it. The alternative was a
   megabyte of JSON to draw a ring around a pin. */

import { dayKey, dueForReview } from '@/lib/progress';
import type { Progress, SectionId } from '@/types';

/** First letter of a drill question id -> the section it belongs to. */
const SECTION_BY_PREFIX: Record<string, SectionId> = {
  e: 'english',
  m: 'math',
  r: 'reading',
  s: 'science',
};

export interface MapEchoes {
  /** Zone id -> how many of its own questions are due right now. */
  byZone: Record<string, number>;
  /** Section -> due drill questions, which belong to a topic, not a landmark. */
  bySection: Partial<Record<SectionId, number>>;
  /** Everything due, however it is filed. */
  total: number;
}

/**
 * What is due for review, arranged by where on the map you learned it.
 *
 * The point is to make spaced repetition a *place*. A list of "12 questions
 * due" is a chore with a number on it; three landmarks you have already walked
 * quietly glowing again is somewhere to go back to. The map is the only screen
 * in the app that can say it that way.
 *
 * Drill questions cannot be placed on a landmark — they are filed under a topic
 * and a topic spans several zones — so they are counted per region instead and
 * reported in the HUD rather than pinned to a spot the student never actually
 * stood on.
 */
export function mapEchoes(progress: Progress): MapEchoes {
  const due = dueForReview(progress);
  const byZone: Record<string, number> = {};
  const bySection: Partial<Record<SectionId, number>> = {};

  for (const qid of due) {
    const cut = qid.lastIndexOf('-q');
    if (cut > 0) {
      const zoneId = qid.slice(0, cut);
      byZone[zoneId] = (byZone[zoneId] ?? 0) + 1;
      continue;
    }
    const section = SECTION_BY_PREFIX[qid[0] ?? ''];
    if (section) bySection[section] = (bySection[section] ?? 0) + 1;
  }

  return { byZone, bySection, total: due.length };
}

/* ------------------------------------------------------------- the courier */

/**
 * A deterministic index into `length`, derived from a string.
 *
 * FNV-1a, because the requirement is "the same all day and different tomorrow",
 * not cryptographic anything. `Math.random()` would move the courier on every
 * re-render — and the map re-renders on every pan — which would read as a bug
 * rather than a character.
 */
function hashPick(seed: string, length: number): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return Math.abs(h) % length;
}

export interface Courier {
  /** The zone the courier is standing at today. */
  zoneId: string;
  /** True once today's challenge is done — she stays, but she is finished. */
  done: boolean;
}

/**
 * Where today's daily challenge is waiting.
 *
 * The daily challenge already existed and lived at `#/daily`, reachable from
 * the dashboard. Nothing about it was in the world: the map is where this game
 * happens and the one thing designed to be done every single day was not on it.
 *
 * So she stands somewhere. Somewhere *specific*, chosen from ground the student
 * has actually walked, because a courier waiting at a landmark still under mist
 * is an invitation to a place you cannot go. She moves each day, which is the
 * cheapest possible reason to open the map on a day you were not going to.
 *
 * Seeded on the date *and* the account's own progress, so two students on the
 * same day are not sent to the same cottage — and so the shape of the walk is
 * yours.
 */
export function courierFor(progress: Progress, reachableZoneIds: string[]): Courier | null {
  if (reachableZoneIds.length === 0) return null;

  const today = dayKey();
  /* Sorted, so the seed does not depend on the order the caller happened to
     build the list in. Without this the courier could move when an unrelated
     part of the map re-sorted its pins. */
  const pool = [...reachableZoneIds].sort();
  const seed = `${today}:${pool.length}:${pool[0]}`;

  return {
    zoneId: pool[hashPick(seed, pool.length)]!,
    done: progress.dailyDoneOn === today,
  };
}
