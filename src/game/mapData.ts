/* Where each zone sits on the painted map.

   Coordinates are percentages of the map image, so they stay correct at any
   render size. The four regions correspond to real places in the artwork:

     Grammar Village  — the farmland and cottages across the top
     Enchanted Woods  — the glowing forest and great tree
     Number Desert    — the canyon, ruins and arch in the middle band
     Science Cliffs   — the rocky coast and harbour at the lower left
     The Summit       — the golden citadel on its island at the bottom

   The original build only placed pins for the first 5-6 zones of each path,
   which left 15 of the 37 zones unreachable from the map. Every zone has a
   pin here. */

import type { SectionId } from '@/types';

export interface RegionMeta {
  id: SectionId;
  /** The in-world name shown as an engraved plaque. */
  title: string;
  /** Plaque position, percent of the map. */
  labelAt: [number, number];
  color: string;
  /** Pin positions, one per zone, in path order. */
  pins: [number, number][];
}

export const SUMMIT_AT: [number, number] = [47, 90.5];

/* Placements were checked by compositing the pins onto the illustration and
   looking at the result. Three rules came out of that:

   - Pins stay inside their region's terrain band. The earlier set put village
     pins in the river, forest pins on the crystal cave, and science pins out
     at sea.
   - Plaques sit *inside* the terrain they name. Placing them in the gap above
     each band made every one caption the wrong region — "The Number Desert"
     sat over the forest, "The Science Cliffs" over the sand.
   - Every pin sits on the feature its zone is *named* after. The names used to
     be alliterative and arbitrary — Comma Castle, Fragment Forest, Dash
     Dungeon and Modifier Marsh all stood on open farmland, and the Enchanted
     Woods contained a Desert, an Icefield, a Tundra and an Estuary. Each zone
     is now named for what is actually painted under its pin, so the coordinate
     and the name have to be changed together. Read them off the enlarged crops
     before moving anything.

   Within a region the x values only ever increase, so the road reads as a walk
   across the terrain rather than a scribble. */

export const REGIONS: Record<SectionId, RegionMeta> = {
  english: {
    id: 'english',
    title: 'The Grammar Village',
    labelAt: [46, 8],
    color: '#d9a441',
    // Cottages, the old oak, the barley field, the standing stone, the
    // farmhouse, the crossroads, the tilled field and the river bridge.
    pins: [
      [11, 16], [16, 18.5], [22, 11], [31, 19.5], [42, 11.5],
      [47, 17], [56, 12], [63, 16], [72, 17.5],
    ],
  },
  reading: {
    id: 'reading',
    title: 'The Enchanted Woods',
    labelAt: [46, 25],
    color: '#5fa86b',
    // The lake grove, the glowing groves, the shrine, the great tree and the
    // ruined tower. Stops short of the waterfall on the left and the crystal
    // cave on the right.
    pins: [
      [17, 30], [24, 35], [30, 26], [36, 32], [43, 36],
      [52, 28], [58, 33], [70, 25], [76, 39.5],
    ],
  },
  math: {
    id: 'math',
    title: 'The Number Desert',
    labelAt: [44, 58],
    color: '#d2703a',
    // The mesas and cave mouth, the broken aqueduct, the colonnade, the great
    // arch, the watchtower, the volcano and the signal fire on its spire.
    pins: [
      [19, 47], [27.5, 51.5], [34, 48], [37, 56], [49, 47],
      [53, 53], [61, 47], [66, 44.5], [79, 45], [88, 52.5],
    ],
  },
  science: {
    id: 'science',
    title: 'The Science Cliffs',
    labelAt: [36, 77.5],
    color: '#4f9dc9',
    // The anchored ship and sea stack, the lighthouse, the cliff hamlet, the
    // stone stair, and the citadel's observatory, telescope yard and clock
    // tower. Starts at x=19: anything further left is open sea, not cliff.
    pins: [
      [19, 64], [21, 73], [33, 66], [37, 72.5], [42, 67],
      [50, 72], [59, 64.5], [68, 70], [76, 63],
    ],
  },
};

export const REGION_ORDER: SectionId[] = ['english', 'reading', 'math', 'science'];

/* Where each region's guardian stands: just past its last landmark, so it reads
   as the thing at the end of that road. Checked against the illustration with
   every pin and discovery composited alongside — all four are on land and clear
   of other markers. The Seals in the story are these four. */
export const GUARDIAN_AT: Record<SectionId, [number, number]> = {
  english: [79, 19],
  reading: [82, 36],
  math: [93, 50],
  science: [84, 71],
};

/** Decorative drifting clouds: [topPercent, widthPx, opacity, durationSec]. */
export const CLOUDS: [number, number, number, number][] = [
  [4, 150, 0.34, 132],
  [11, 96, 0.24, 168],
  [19, 128, 0.3, 146],
  [34, 110, 0.2, 184],
  [51, 92, 0.26, 158],
  [68, 132, 0.22, 176],
  [81, 104, 0.28, 150],
];
