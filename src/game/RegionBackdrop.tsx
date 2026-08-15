/* The painted plate behind a region's road.
 *
 * These four pictures were commissioned as map *extensions* — north, south,
 * east and west of `world-map.webp` — and they cannot do that job. Assembled at
 * real scale the original map ends up eighteen percent of the total, the four
 * leave blank corners, and they are drawn at roughly four times fewer metres
 * per pixel: the map draws a village, a great tree and a castle, the panels
 * draw whole mountain ranges. Butted together the village reads as the size of
 * a range. `scripts/build-regions.mjs` has the full measurement.
 *
 * As a full-bleed plate behind one path screen each, none of that matters.
 * Nothing is next to anything, so there is no scale to disagree with — and the
 * terrain each region was named for finally appears somewhere:
 *
 *   The Enchanted Woods  black pine forest under snow-capped peaks
 *   The Number Desert    red canyon country cut by dry riverbeds
 *   The Science Cliffs   a drowned city of causeways and islands
 *   The Grammar Village  an estuary of marsh, mangrove and dune
 *
 * Three things about how it is put together are deliberate.
 *
 * **It is rendered from `App.tsx`, not from `PathScreen`.** Every non-map route
 * is wrapped in a keyed `m.div` that animates `y: 12 → 0`, and a transform on
 * an ancestor makes it the containing block for anything `position: fixed`
 * inside it. A backdrop rendered within the screen would therefore be pinned to
 * the page rather than the viewport, and would scroll away down a ten-landmark
 * road. Rendered as a sibling of that wrapper it has no transformed ancestor
 * and stays put.
 *
 * **It sits at `-z-10`, which works here and would not work one level up.**
 * `index.css` gives every direct child of `<body>` `position: relative;
 * z-index: 1`, so `#root` is a stacking context painting above the fixed grain
 * at `z-index: 0`. A negative-z child of `<body>` would vanish behind the body
 * background; a negative-z child *inside* `#root` paints at the bottom of
 * `#root`'s own stacking context, which is still above the grain and below
 * every screen. No other z-index in the app has to move for this.
 *
 * **The props are foreground, not scenery.** The first version scattered nine
 * of them across the picture the way you would dress a map, and compositing it
 * at 1280x800 showed why that cannot work: the props are positioned against the
 * viewport and the plate is `object-cover`, so which part of the painting ends
 * up under any given prop depends entirely on the window's aspect ratio. The
 * test render put a dead tree in open sea. It is also redundant — these
 * paintings already contain thousands of trees, and adding one more to a forest
 * is not decoration, it is noise.
 *
 * So they do the one job the painting cannot do for itself: depth. Three per
 * region, large, hard against the bottom edge with their bases cut off by it,
 * and darkened well past the plate. A tree that close to the camera does not
 * need ground under it — being cut off is what says it is near — so there is no
 * aspect ratio at which it can land somewhere wrong.
 *
 * **And they go under the scrim, not over it.** A sprite laid on top of a
 * darkened painting reads as a sticker no matter how well it is drawn; the
 * giveaway is that it is brighter than the world it stands in. Passing them
 * through the same wash as the ground costs nothing but the order of two
 * elements.
 */

import { Art } from '@/components/Art';
import propArt from '@/propArt.json';
import type { SectionId } from '@/types';

type PropName = keyof typeof propArt;

interface Placement {
  id: PropName;
  /** Percent from the left edge of the viewport, or from the right if `right`.
   *  Anchored to an edge rather than the centre so all three stay in the margin
   *  the reading column leaves, at every width. */
  x: number;
  right?: boolean;
  /** Percent of the prop's own height that hangs below the bottom of the
   *  viewport. Negative `bottom`, in other words — the cut-off base is what
   *  reads as "near the camera". */
  sink: number;
  /** Multiplies the shared `--prop` size. Relative sizes are the point — the
   *  sheet was sliced at one scale for exactly this reason (`build-props.mjs`),
   *  so a boulder is never as tall as an oak. */
  k: number;
  flip?: boolean;
}

/* Three per region: a tall one at each margin and one low silhouette between
   them, all cut by the bottom edge. Chosen for the terrain — pines for the
   forest, canyon rock for the desert, ruined stone for the drowned city, a
   camp and a signpost for the settled lowland. */
const SCATTER: Record<SectionId, Placement[]> = {
  reading: [
    { id: 'tree-pine', x: -2, sink: 26, k: 1.5 },
    { id: 'tree-pine', x: 6, right: true, sink: 34, k: 1.25, flip: true },
    { id: 'rocks', x: 24, right: true, sink: 46, k: 0.72 },
  ],
  math: [
    { id: 'tree-dead', x: -1, sink: 30, k: 1.35, flip: true },
    { id: 'boulder', x: 3, right: true, sink: 42, k: 1.3 },
    { id: 'rocks', x: 22, sink: 48, k: 0.7 },
  ],
  science: [
    { id: 'arch', x: -3, sink: 34, k: 1.45 },
    { id: 'tree-broadleaf', x: 2, right: true, sink: 38, k: 1.2, flip: true },
    { id: 'waystone', x: 25, right: true, sink: 40, k: 0.6 },
  ],
  english: [
    { id: 'tree-broadleaf', x: -2, sink: 32, k: 1.35 },
    { id: 'signpost', x: 5, right: true, sink: 28, k: 1.15 },
    { id: 'tent', x: 23, sink: 50, k: 0.85, flip: true },
  ],
};

/* Heaviest at the top, where `SectionHeading`'s eyebrow, title and detail sit
   on bare background and are the only text in the screen not carried by a
   `.panel` (which is 90% opaque and blurred, and can look after itself). It
   opens up through the middle so the picture is actually visible, and closes
   again at the foot so the props read as silhouette rather than clip art.
   Written against the `--c-leather-950` custom property rather than a literal,
   so light mode gets a pale wash under dark text instead of a dark one. */
const SCRIM =
  'linear-gradient(to bottom,' +
  ' rgb(var(--c-leather-950) / 0.94) 0%,' +
  ' rgb(var(--c-leather-950) / 0.93) 20%,' +
  ' rgb(var(--c-leather-950) / 0.74) 52%,' +
  ' rgb(var(--c-leather-950) / 0.86) 100%)';

/** The section comes off the URL, so it can be anything at all — `/#/path/frog`
 *  is a link a person can type, and `PathScreen` answers it with "No such
 *  region". The backdrop has to survive the same input without reaching into a
 *  manifest for a key that is not there. */
const isSection = (id: string): id is SectionId => id in SCATTER;

export function RegionBackdrop({ section }: { section: string }) {
  if (!isSection(section)) return null;
  const scatter = SCATTER[section];

  return (
    /* `art-heavy` on the wrapper rather than letting `<Art>` put it on the
       `<img>` alone: in reduced-data mode the whole layer should go, props and
       scrim included, not leave a dark wash over nothing. */
    <div
      aria-hidden
      className="art-heavy pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ ['--prop' as string]: 'clamp(72px, 15vmin, 150px)' }}
    >
      <Art name={`region-${section}`} priority className="h-full w-full select-none object-cover" />

      {scatter.map((p, i) => {
        const art = propArt[p.id];
        return (
          <img
            key={`${p.id}-${i}`}
            src={art.src}
            width={art.width}
            height={art.height}
            alt=""
            decoding="async"
            draggable={false}
            className="absolute select-none"
            style={{
              [p.right ? 'right' : 'left']: `${p.x}%`,
              /* Percent `bottom` resolves against the container, not the
                 element, so it cannot express "a third of my own height below
                 the edge". A translate can, and it composites on the GPU. */
              bottom: 0,
              transform: `translateY(${p.sink}%)${p.flip ? ' scaleX(-1)' : ''}`,
              width: `calc(var(--prop) * ${p.k})`,
              height: 'auto',
              /* Down towards silhouette. The plate behind them has already lost
                 three quarters of its light to the scrim, and a prop at full
                 brightness under the same scrim is the brightest thing on the
                 screen — which is the sticker effect, arriving by a different
                 route. Brought down to roughly where the ground is, with the
                 colour pulled out so it does not fight the region's palette. */
              filter: 'brightness(.5) saturate(.55) drop-shadow(0 8px 14px rgba(0,0,0,.5))',
            }}
          />
        );
      })}

      <div className="absolute inset-0" style={{ background: SCRIM }} />
    </div>
  );
}
