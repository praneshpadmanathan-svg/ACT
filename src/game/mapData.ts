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

export const REGIONS: Record<SectionId, RegionMeta> = {
  english: {
    id: 'english',
    title: 'The Grammar Village',
    labelAt: [45, 5.5],
    color: '#d9a441',
    pins: [
      [16, 15], [30, 11.5], [43, 14], [56, 10.5], [62, 16.5],
      [70, 12], [79, 15.5], [86, 11], [24, 19.5],
    ],
  },
  reading: {
    id: 'reading',
    title: 'The Enchanted Woods',
    labelAt: [79, 20.5],
    color: '#5fa86b',
    pins: [
      [11, 32], [22, 28], [30, 34], [40, 30.5], [47, 34.5],
      [57, 29], [66, 26.5], [76, 30], [88, 27.5],
    ],
  },
  math: {
    id: 'math',
    title: 'The Number Desert',
    labelAt: [72, 62],
    color: '#d2703a',
    pins: [
      [16, 47], [25, 53], [34, 48.5], [42, 53.5], [50, 47.5],
      [58, 52], [66, 45.5], [74, 50.5], [82, 45], [88, 53],
    ],
  },
  science: {
    id: 'science',
    title: 'The Science Cliffs',
    labelAt: [21, 87],
    color: '#4f9dc9',
    pins: [
      [14, 66], [24, 72], [33, 66.5], [42, 73], [52, 67],
      [62, 72.5], [72, 66], [81, 71], [90, 65.5],
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
