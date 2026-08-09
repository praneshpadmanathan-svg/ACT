/* The plague, the territories, and the trail.
 *
 * Three findings from the art-director pass, all with the same root cause and
 * so one file:
 *
 *   23. "It is one flat bitmap, and that caps everything — most importantly it
 *       cannot show the grey plague receding, which is the core narrative
 *       promise the story text makes to the player. The art cannot deliver the
 *       story the writing sells."
 *   25. "A per-region cleared variant, so beating a region visibly heals that
 *       part of the world. Currently clearing a region changes a pin's state
 *       and nothing about the world."
 *   28. "The four regions are not visually separated enough at a glance."
 *   29. "The road between landmarks is painted into the bitmap, so it can't
 *       draw itself forward as you unlock."
 *
 * The honest constraint: there is one painting and no layered source for it,
 * so genuine parallax and a repainted "healed" variant are not available
 * without commissioning new art. What *is* available is compositing — and the
 * plague was always a colour problem, not a geometry one. A grey world that
 * regains its colour is exactly a saturation blend whose strength is tied to
 * progress, and that runs over the flat bitmap perfectly well.
 *
 * So:
 *
 *   PlagueLayer  desaturates and ashes each region's band, and lifts as you
 *                clear its landmarks. At zero progress the realm is grey; at
 *                full progress it is the painting at full strength, slightly
 *                warmer than the file. The healing *is* the reward.
 *   TrailLayer   a dotted trail through each region's landmarks: lit in the
 *                region's colour where you have walked, faint where you have
 *                not, and running on to the citadel once a guardian falls.
 *
 * Both live inside the map's transformed world layer, in the same percentage
 * space as the pins, so they pan and zoom locked to the terrain.
 */

import { memo, useId } from 'react';

import type { SectionId } from '@/types';
import {
  GUARDIAN_AT,
  MAP_H,
  MAP_W,
  REGION_BANDS,
  REGION_ORDER,
  REGIONS,
  SUMMIT_AT,
} from './mapData';

type Cleared = Record<SectionId, number>;

/* ------------------------------------------------------------- the plague */

/** Feather profile shared by every band, so the four read as one weather system. */
const FEATHER = 'linear-gradient(to bottom, transparent 0%, #000 16%, #000 84%, transparent 100%)';

/** For the band that runs to the edge of the map: fade in at the top, then
 *  hold — feathering the bottom would leave a bright strip along the sea. */
const FEATHER_TOP_ONLY = 'linear-gradient(to bottom, transparent 0%, #000 12%, #000 100%)';

/* How grey the world gets at zero progress.
 *
 * Not 1. A fully desaturated map is a grey rectangle, and a grey rectangle is
 * not a world worth saving — a first-time player has to want to go there. At
 * 0.86 the terrain still reads as farmland and forest and canyon; it just
 * looks like the life has been drained out of it, which is the thing the story
 * actually says.
 *
 * The split between this and the ash below was set by compositing both over
 * the real painting and looking at the four states side by side. A heavier
 * wash and a lighter drain gave something that read as *fog* — weather, not
 * blight, and the map already has weather. Letting the desaturation do most
 * of the work and the wash only tint the greys is what reads as drained. */
const MAX_DRAIN = 0.86;

/** Ash wash over a plagued region: cold, slightly blue, and very light. */
const ASH = 'rgba(126, 130, 146, 0.20)';

export const PlagueLayer = memo(function PlagueLayer({ cleared }: { cleared: Cleared }) {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {REGION_ORDER.map((id, i) => {
        const band = REGION_BANDS[id];
        const region = REGIONS[id];
        const health = Math.min(1, Math.max(0, cleared[id] ?? 0));
        const blight = 1 - health;

        /* The last band runs off the bottom of the map instead of stopping at
           its region's edge. The bands describe where the four *territories*
           are, and south of the cliffs there is only open sea and the
           citadel's island — no territory, but very much part of the world.
           Left alone it stayed at full saturation, so a vivid teal sea sat
           directly under ashen grey cliffs and read as a rendering fault.
           The plague has to reach the edge of the world.

           The mist cannot do the same, which is why this is here and not in
           the shared band geometry: fog over the citadel would hide the goal. */
        const last = i === REGION_ORDER.length - 1;
        const height = last ? 100 - band.top : band.height;

        const box = {
          left: 0,
          width: '100%',
          top: `${band.top}%`,
          height: `${height}%`,
          WebkitMaskImage: last ? FEATHER_TOP_ONLY : FEATHER,
          maskImage: last ? FEATHER_TOP_ONLY : FEATHER,
        } as const;

        return (
          <div key={id}>
            {/* Drain.
                `mix-blend-mode: saturation` takes the saturation of *this*
                element and the hue and lightness of what is under it — so a
                flat grey source pulls the colour out of the painting beneath
                without touching its drawing at all.

                The opacity sits on the blending element itself rather than on
                a wrapper. A wrapper with opacity < 1 becomes an isolated
                group, and an isolated group has nothing but transparency
                behind it, so the blend would silently do nothing. This is the
                classic way to lose an afternoon to `mix-blend-mode`. */}
            <div
              className="absolute transition-opacity duration-[1200ms]"
              style={{
                ...box,
                background: '#808080',
                mixBlendMode: 'saturation',
                opacity: blight * MAX_DRAIN,
              }}
            />

            {/* Pallor. Desaturation alone reads as "old photograph"; the cold
                wash is what makes it read as *sick*. */}
            <div
              className="absolute transition-opacity duration-[1200ms]"
              style={{ ...box, background: ASH, opacity: blight }}
            />

            {/* Territory (finding 28).
                A constant, very low wash in the region's own hue. It has to be
                constant rather than earned, because the player who most needs
                to see "these are four distinct territories" is the one who has
                cleared nothing and is looking at the map for the first time.
                `overlay` deepens what is already dark and lifts what is light,
                so the wash tints without flattening the painting.

                It strengthens a little as the region heals, so a cleared
                region is not just un-grey but visibly *more itself*. */}
            <div
              className="absolute transition-opacity duration-[1200ms]"
              style={{
                ...box,
                background: region.color,
                mixBlendMode: 'overlay',
                opacity: 0.1 + health * 0.11,
              }}
            />
          </div>
        );
      })}
    </div>
  );
});

/* --------------------------------------------------------------- the trail */

/* Finding 29 asked for "a vector path over the art" so the road can draw
   itself forward. The first build did exactly that — a stroked, splined road
   through each region's landmarks — and it was wrong twice over.
 
   The pins zigzag, because each one sits on the feature its zone is named
   after rather than anywhere convenient, so a continuous stroke through them
   came out as a seismograph trace. And the painting already has roads in it:
   pale winding trails between the cottages and up through the canyon. A second
   road drawn on top did not read as a road at all, it read as a graph.
 
   Dots instead — the travel-line idiom every adventure map already uses. A
   dotted trail is legibly an *annotation over* a map rather than a feature
   *of* one, so it stops competing with the painted trails; and it tolerates
   the zigzag, because a curve you read as a sequence of marks does not have to
   flow the way a drawn road does. */

/** The map's aspect, so the trail's round dots stay round. */
const ASPECT = MAP_H / MAP_W;

/** A Catmull-Rom spline through the points, as cubic béziers.
 *
 *  Slack tangents (a sixth of the chord) give a lazy curve that still passes
 *  exactly through every landmark. Coordinates come in as map percentages and
 *  go out in the viewBox's y-stretched space. */
function spline(points: [number, number][]): string {
  if (points.length < 2) return '';
  const at = (i: number) => {
    const p = points[Math.min(points.length - 1, Math.max(0, i))]!;
    return [p[0], p[1] * ASPECT] as const;
  };

  const [sx, sy] = at(0);
  let d = `M${sx.toFixed(2)} ${sy.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = at(i - 1);
    const [x1, y1] = at(i);
    const [x2, y2] = at(i + 1);
    const [x3, y3] = at(i + 2);
    d +=
      ` C${(x1 + (x2 - x0) / 6).toFixed(2)} ${(y1 + (y2 - y0) / 6).toFixed(2)}` +
      ` ${(x2 - (x3 - x1) / 6).toFixed(2)} ${(y2 - (y3 - y1) / 6).toFixed(2)}` +
      ` ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }
  return d;
}

/** Length of that spline, by sampling.
 *
 *  The obvious way to express progress along a path is `pathLength="1"` with
 *  `stroke-dasharray="1"` — the offset is then just the fraction. It is also a
 *  silent-failure trap: where `pathLength` is not honoured the dash pattern
 *  falls back to user units, which on a path this long means dashes
 *  everywhere and the mask reveals the *whole* trail. Caught exactly that way
 *  while checking the render, and a bug whose failure mode is "shows you the
 *  route you have not walked" is not one to leave resting on a feature test.
 *
 *  Measuring here instead costs one loop and depends on nothing. The sample
 *  count is per curve segment, and 32 is comfortably past the point where more
 *  changes the total. */
function splineLength(points: [number, number][]): number {
  const at = (i: number) => {
    const p = points[Math.min(points.length - 1, Math.max(0, i))]!;
    return [p[0], p[1] * ASPECT] as const;
  };

  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = at(i - 1);
    const [x1, y1] = at(i);
    const [x2, y2] = at(i + 1);
    const [x3, y3] = at(i + 2);
    let px = x1;
    let py = y1;
    for (let s = 1; s <= 32; s++) {
      const t = s / 32;
      const t2 = t * t;
      const t3 = t2 * t;
      // Catmull-Rom, the same curve the béziers above describe.
      const x =
        0.5 *
        (2 * x1 +
          (-x0 + x2) * t +
          (2 * x0 - 5 * x1 + 4 * x2 - x3) * t2 +
          (-x0 + 3 * x1 - 3 * x2 + x3) * t3);
      const y =
        0.5 *
        (2 * y1 +
          (-y0 + y2) * t +
          (2 * y0 - 5 * y1 + 4 * y2 - y3) * t2 +
          (-y0 + 3 * y1 - 3 * y2 + y3) * t3);
      total += Math.hypot(x - px, y - py);
      px = x;
      py = y;
    }
  }
  return total;
}

/* A zero-length dash with a round cap is a dot, so the whole trail is one
   stroked path rather than the six hundred-odd <circle> elements the same
   thing would take, all panning and zooming with the map.

   Sizes are in viewBox units, and one unit is a hundredth of the map's width —
   7.68 of the painting's own pixels. Worth stating because it is the easy
   mistake here: numbers that look like sensible pixel values produce dots five
   times too big. These are the pixel sizes wanted, divided through. */
const UNIT = MAP_W / 100;
const DOT_GAP = 11.5 / UNIT;
const DOT_FAINT = 2.6 / UNIT;
const DOT_BED = 7 / UNIT;
const DOT_LIT = 4.4 / UNIT;

/* Trail colours, lighter than the regions' own.
 *
 * `REGIONS[].color` is chosen to sit on dark leather chrome; on the painting
 * it lands at almost exactly the value of the terrain it crosses — a gold
 * trail over gold farmland, a green one through the forest — and disappeared.
 * These are the same hues lifted to read against their own ground. */
const TRAIL_COLOR: Record<SectionId, string> = {
  english: '#ffd98a',
  reading: '#a8e6b4',
  math: '#ffb183',
  science: '#a5d8f7',
};

export const TrailLayer = memo(function TrailLayer({ cleared }: { cleared: Cleared }) {
  const uid = useId().replace(/:/g, '');

  return (
    /* The viewBox is y-stretched to the map's real aspect rather than 0-100
       square with `preserveAspectRatio="none"`. Under a non-uniform scale a
       round line cap becomes an ellipse, and the dots are round caps. */
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 100 ${(100 * ASPECT).toFixed(2)}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        {REGION_ORDER.map((id) => {
          const region = REGIONS[id];
          const n = region.pins.length;
          const health = Math.min(1, Math.max(0, cleared[id] ?? 0));

          /* The trail runs landmark to landmark and then on to the guardian,
             so there are `n` segments for `n` pins. Clearing `health` of the
             landmarks should carry it to the one you are standing on rather
             than stopping short, hence the extra segment's worth. */
          const walked = Math.min(1, (health * n) / Math.max(1, n - 1));

          /* Progress is a mask rather than a second, shorter path, so the
             trail can actually *draw itself forward*: `stroke-dashoffset` is
             animatable and a changing `d` is not. One dash as long as the
             whole path, slid along by the unwalked fraction.

             The mask stroke is only a little wider than the dots. Wide enough
             to cover them, narrow enough that where the trail doubles back on
             itself it does not reveal the neighbouring limb. */
          const path = spline([...region.pins, GUARDIAN_AT[id]]);
          const len = splineLength([...region.pins, GUARDIAN_AT[id]]);

          return (
            <mask key={id} id={`${uid}-${id}`} maskUnits="userSpaceOnUse">
              <path
                d={path}
                fill="none"
                stroke="#fff"
                strokeWidth={DOT_BED * 1.35}
                strokeLinecap="butt"
                strokeDasharray={len}
                strokeDashoffset={len * (1 - walked)}
                style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(.22,1,.36,1)' }}
              />
            </mask>
          );
        })}
      </defs>

      {REGION_ORDER.map((id) => {
        const region = REGIONS[id];
        const health = Math.min(1, Math.max(0, cleared[id] ?? 0));
        const d = spline([...region.pins, GUARDIAN_AT[id]]);

        return (
          <g key={id}>
            {/* Where you have not been: faint, so the shape of the journey is
                legible before you take it without advertising itself. */}
            <path
              d={d}
              fill="none"
              stroke="rgba(30, 21, 12, 0.30)"
              strokeWidth={DOT_FAINT}
              strokeLinecap="round"
              strokeDasharray={`0 ${DOT_GAP}`}
            />

            {/* Where you have. Two passes: a dark bed a touch larger than the
                bright dot on top, so the trail holds against both the pale
                farmland and the dark forest. */}
            <g mask={`url(#${uid}-${id})`}>
              <path
                d={d}
                fill="none"
                stroke="rgba(24, 16, 9, 0.72)"
                strokeWidth={DOT_BED}
                strokeLinecap="round"
                strokeDasharray={`0 ${DOT_GAP}`}
              />
              <path
                d={d}
                fill="none"
                stroke={TRAIL_COLOR[id]}
                strokeWidth={DOT_LIT}
                strokeLinecap="round"
                strokeDasharray={`0 ${DOT_GAP}`}
              />
            </g>

            {/* Once the guardian is down the trail carries on to the citadel —
                the four seals, converging. Gold and wider-spaced, because it is
                a promise rather than a route anyone has walked yet. */}
            {health >= 1 && (
              <path
                d={spline([GUARDIAN_AT[id], SUMMIT_AT])}
                fill="none"
                stroke="#f0cf7a"
                strokeOpacity="0.62"
                strokeWidth={DOT_LIT}
                strokeLinecap="round"
                strokeDasharray={`0 ${DOT_GAP * 1.5}`}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
});
