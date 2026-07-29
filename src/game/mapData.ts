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
   looking at the result. Two rules came out of that:

   - Pins stay inside their region's terrain band. The earlier set put village
     pins in the river, forest pins on the crystal cave, and science pins out
     at sea.
   - Plaques sit in the clear gap *above* each band, horizontally centred.
     Edge-anchored labels were clipped on the left and right at every width. */

export const REGIONS: Record<SectionId, RegionMeta> = {
  english: {
    id: 'english',
    title: 'The Grammar Village',
    labelAt: [46, 5],
    color: '#d9a441',
    // Cottages, fields, the standing stone and the bridge across the farmland.
    pins: [
      [11, 16], [22, 12], [30, 14.5], [40, 11], [47, 17],
      [56, 12], [64, 15], [72, 17.5], [24, 20],
    ],
  },
  reading: {
    id: 'reading',
    title: 'The Enchanted Woods',
    labelAt: [46, 22.5],
    color: '#5fa86b',
    // The great tree and the glowing mushroom groves around it. Stops short of
    // the waterfall on the left and the crystal cave on the right.
    pins: [
      [17, 30], [26, 27], [24, 35], [34, 31], [43, 36],
      [52, 28], [58, 33], [65, 27], [70, 33],
    ],
  },
  math: {
    id: 'math',
    title: 'The Number Desert',
    labelAt: [48, 42.5],
    color: '#d2703a',
    // Mesas, the ruined colonnade, the great arch, and the volcano.
    pins: [
      [19, 47], [26, 53], [34, 48], [41, 54], [49, 47],
      [56, 52], [64, 46], [71, 52], [79, 45], [85, 51],
    ],
  },
  science: {
    id: 'science',
    title: 'The Science Cliffs',
    labelAt: [42, 59.5],
    color: '#4f9dc9',
    // The coast road, the cliffs above the harbour, and the stone observatory
    // city — all above the citadel's island.
    // Starts at x=19: anything further left is open sea, not cliff.
    pins: [
      [19, 64], [24, 70], [30, 65], [35, 71], [42, 67],
      [50, 72], [58, 66], [66, 71], [74, 66],
    ],
  },
};

export const REGION_ORDER: SectionId[] = ['english', 'reading', 'math', 'science'];

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
