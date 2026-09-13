/* Where the traveller stands, derived from cleared landmarks alone.
 *
 * This was `useMapProgress` inside `AdventureMap.tsx`, which meant the camp
 * dashboard and the guide both imported a 1500-line map component to ask one
 * question: what is next? When the map went, the question stayed — so the
 * answer moved here, to a module with no view in it at all.
 *
 * Unlocking is array order, not geography. Within a subject the first
 * uncleared landmark is `current` and everything after it is sealed; across
 * subjects nothing is gated, so all four first landmarks are open from the
 * start. That was true when it was a painted road and it is true now that it
 * is a list — no logic changed in the move, only the pin coordinates went.
 */

import { useMemo } from 'react';
import { PATH_BY_ID } from '@/content';
import { REGION_ORDER } from '@/content/regionFlavor';
import { useStore } from '@/lib/store';
import type { SectionId, Zone } from '@/types';

export interface ZoneStanding {
  zone: Zone;
  section: SectionId;
  /** Position within its subject's list, zero-based. */
  index: number;
  /** Best quiz score recorded here, or null if never cleared. */
  best: number | null;
}

export interface ZoneProgress {
  /** The next landmark to take, or null once every one is cleared. */
  current: ZoneStanding | null;
  cleared: number;
  total: number;
  allCleared: boolean;
  /** Fraction of each subject cleared, 0-1. */
  clearedByRegion: Record<SectionId, number>;
}

/** Shared by the dashboard, the guide and the Codex so all three agree. */
export function useZoneProgress(): ZoneProgress {
  const { progress } = useStore();
  /* The road the player chose wins; the onboarding answer is only a fallback
     for anyone who set out before there was a choice to make. */
  const preferred = progress.startRegion ?? progress.profile?.fear;

  return useMemo(() => {
    let current: ZoneStanding | null = null;
    let cleared = 0;
    let total = 0;
    const clearedByRegion = {} as Record<SectionId, number>;

    /* Onboarding promises to start you in the section you named, so that
       region is walked first when deciding where the traveller stands. */
    const order = preferred
      ? [preferred, ...REGION_ORDER.filter((id) => id !== preferred)]
      : REGION_ORDER;

    for (const section of order) {
      const path = PATH_BY_ID[section];
      if (!path) continue;

      let nextIsOpen = true;
      let doneHere = 0;

      path.nodes.forEach((zone, index) => {
        total += 1;

        const best = progress.zonesCleared[zone.id] ?? null;
        if (best !== null) {
          cleared += 1;
          doneHere += 1;
          return;
        }

        if (nextIsOpen) {
          nextIsOpen = false;
          if (!current) current = { zone, section, index, best };
        }
      });

      clearedByRegion[section] = path.nodes.length ? doneHere / path.nodes.length : 0;
    }

    return { current, cleared, total, allCleared: cleared === total && total > 0, clearedByRegion };
  }, [progress.zonesCleared, preferred]);
}
