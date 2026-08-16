/* Guards on the map's coordinate table.

   `mapData.ts` states three placement rules in prose and enforced none of them.
   The one that had already drifted — the Science Cliffs walking one percent
   backwards between the anchored ship and the sea stack — is the kind of thing
   you introduce by nudging a single pin onto its feature and never looking at
   what it did to the pin either side. */

import { describe, expect, it } from 'vitest';

import {
  GUARDIAN_AT,
  MAP_H,
  MAP_W,
  REGIONS,
  REGION_BANDS,
  REGION_ORDER,
  SUMMIT_AT,
} from './mapData';

const everyPoint = (): [string, [number, number]][] => [
  ...REGION_ORDER.flatMap((id) =>
    REGIONS[id].pins.map((p, i): [string, [number, number]] => [`${id} pin ${i}`, p]),
  ),
  ...REGION_ORDER.map((id): [string, [number, number]] => [`${id} plaque`, REGIONS[id].labelAt]),
  ...REGION_ORDER.map((id): [string, [number, number]] => [`${id} guardian`, GUARDIAN_AT[id]]),
  ['summit', SUMMIT_AT],
];

describe('map coordinates', () => {
  it('walks the road forwards within every region', () => {
    for (const id of REGION_ORDER) {
      const xs = REGIONS[id].pins.map(([x]) => x);
      for (let i = 1; i < xs.length; i++) {
        expect(
          xs[i]! >= xs[i - 1]!,
          `${id}: pin ${i} steps back from x=${xs[i - 1]} to x=${xs[i]}`,
        ).toBe(true);
      }
    }
  });

  it('keeps every mark on the map', () => {
    for (const [what, [x, y]] of everyPoint()) {
      expect(x, `${what} x`).toBeGreaterThanOrEqual(0);
      expect(x, `${what} x`).toBeLessThanOrEqual(100);
      expect(y, `${what} y`).toBeGreaterThanOrEqual(0);
      expect(y, `${what} y`).toBeLessThanOrEqual(100);
    }
  });

  /* The plague, the mist and the storm all read their geometry from the bands,
     and all three feather to nothing at the edges — see the note on the export.
     Butting two together would put a transparent seam across the map. */
  it('overlaps each region band with its neighbour', () => {
    for (let i = 1; i < REGION_ORDER.length; i++) {
      const above = REGION_BANDS[REGION_ORDER[i - 1]!];
      const below = REGION_BANDS[REGION_ORDER[i]!];
      expect(
        below.top,
        `${REGION_ORDER[i]} starts at ${below.top}, past the end of ${REGION_ORDER[i - 1]}`,
      ).toBeLessThan(above.top + above.height);
    }
  });

  it('puts every landmark inside its own region band', () => {
    for (const id of REGION_ORDER) {
      const band = REGION_BANDS[id];
      for (const [i, [, y]] of REGIONS[id].pins.entries()) {
        expect(y, `${id} pin ${i}`).toBeGreaterThanOrEqual(band.top);
        expect(y, `${id} pin ${i}`).toBeLessThanOrEqual(band.top + band.height);
      }
    }
  });

  /* Every zone has a pin. The original build placed only the first five or six
     of each path, which left fifteen zones unreachable from the map. */
  it('has thirty-seven landmarks', () => {
    const total = REGION_ORDER.reduce((n, id) => n + REGIONS[id].pins.length, 0);
    expect(total).toBe(37);
  });

  it('matches the intrinsic size of the painting', () => {
    expect([MAP_W, MAP_H]).toEqual([768, 1376]);
  });
});
