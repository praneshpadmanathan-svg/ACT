/* The four regions, as flavour rather than geography.
 *
 * These used to live in `src/game/mapData.ts` alongside pin coordinates, which
 * meant six screens that only ever wanted a region's name or accent colour
 * imported a module full of map-percentage tuples. When the painted map was
 * replaced by tabs, the coordinates went and this stayed: the in-world names
 * are still on every subject screen, and the accents are still what the
 * progress rings and the guardian cards are drawn in.
 *
 * The colours are deliberately *not* `SECTION_BY_ID[id].color`. Those are the
 * bright UI accents (English is #ffd23e there); these are the muted, painted
 * versions the world was drawn in. Both are in use, side by side, on purpose.
 */

import type { SectionId } from '@/types';

export interface RegionFlavor {
  id: SectionId;
  /** The in-world name, shown as the heading on a subject screen. */
  title: string;
  /** The painted accent for this region. Not the section's UI accent.
   *  A token reference rather than a hex, for the reason given on
   *  `SectionMeta.color` — these are painted inline onto themed chrome. */
  color: string;
}

export const REGIONS: Record<SectionId, RegionFlavor> = {
  english: { id: 'english', title: 'The Grammar Village', color: 'oklch(var(--c-region-english))' },
  reading: { id: 'reading', title: 'The Enchanted Woods', color: 'oklch(var(--c-region-reading))' },
  math: { id: 'math', title: 'The Number Desert', color: 'oklch(var(--c-region-math))' },
  science: { id: 'science', title: 'The Science Cliffs', color: 'oklch(var(--c-region-science))' },
};

/* The order the world was walked in, which is not the order the real test runs
   in. Onboarding, the story chain and the region lists all read it from here so
   they cannot drift apart. */
export const REGION_ORDER: SectionId[] = ['english', 'reading', 'math', 'science'];
