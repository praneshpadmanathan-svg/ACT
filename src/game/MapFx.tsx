/* Living detail layered over the painted map.

   The illustration is a flat image, so everything that moves is an overlay
   positioned in map-percentage space — the same coordinate system the pins
   use, which means it all stays locked to its landmark at any pan or zoom.

   Effects are keyed to real features in the artwork:
     waterfall (left cliff)      falling water streaks + spray
     rivers and sea              slow specular shimmer
     forest                      pulsing mushroom glow + drifting fireflies
     crystal caves               staggered sparkle glints
     volcano                     rising embers + heat glow
     lighthouse                  sweeping beam
     citadel                     breathing golden light
     boats                       gentle bob
   Everything is CSS-driven and `pointer-events: none`, so it costs nothing on
   the interaction side and stops entirely under prefers-reduced-motion. */

import { memo } from 'react';
import { seeded } from '@/lib/utils';

/* -------------------------------------------------------------- waterfall */

function Waterfall() {
  const rng = seeded(41);
  const streaks = Array.from({ length: 14 }, (_, i) => ({
    key: i,
    left: 8.3 + rng() * 4.2,
    top: 32.5 + rng() * 1.5,
    height: 5 + rng() * 4,
    width: 0.22 + rng() * 0.3,
    delay: rng() * 2.4,
    duration: 1.5 + rng() * 1.3,
    opacity: 0.3 + rng() * 0.45,
  }));

  return (
    <>
      {streaks.map((s) => (
        <span
          key={s.key}
          className="mapfx-fall"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            height: `${s.height}%`,
            width: `${s.width}%`,
            opacity: s.opacity,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
          }}
        />
      ))}
      {/* spray at the plunge pool */}
      {Array.from({ length: 7 }, (_, i) => (
        <span
          key={`spray${i}`}
          className="mapfx-spray"
          style={{
            left: `${9 + (i % 4) * 1.1}%`,
            top: `${40.5 + (i % 3) * 0.6}%`,
            animationDelay: `${i * 0.42}s`,
          }}
        />
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ water */

/** Slow specular bands across the sea and the wide river. */
const WATER_PATCHES: { left: number; top: number; w: number; h: number; delay: number }[] = [
  { left: 2, top: 46, w: 12, h: 10, delay: 0 },
  { left: 0, top: 62, w: 16, h: 14, delay: 2.4 },
  { left: 4, top: 80, w: 26, h: 16, delay: 1.2 },
  { left: 55, top: 84, w: 40, h: 15, delay: 3.1 },
  { left: 72, top: 74, w: 24, h: 10, delay: 4.3 },
  { left: 66, top: 8, w: 26, h: 9, delay: 1.8 },
];

function Water() {
  return (
    <>
      {WATER_PATCHES.map((p, i) => (
        <span
          key={i}
          className="mapfx-water"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: `${p.w}%`,
            height: `${p.h}%`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </>
  );
}

/* ----------------------------------------------------------------- forest */

/** Glowing mushroom clusters, matched to the clumps in the illustration. */
const MUSHROOMS: [number, number, string, number][] = [
  [21, 27.5, '#c86bd8', 1],
  [26.5, 30.5, '#5fe0c0', 1.2],
  [23, 33.5, '#7ad4ff', 0.9],
  [30, 28.5, '#c86bd8', 1.1],
  [33, 34, '#8ce06b', 1],
  [38, 26.5, '#c86bd8', 0.85],
  [40, 33, '#7ad4ff', 1.15],
  [47, 30, '#a97ce8', 1],
  [51, 35.5, '#5fe0c0', 0.9],
  [56, 27.5, '#8ce06b', 1.1],
  [59, 34.5, '#7ad4ff', 1],
  [64, 30.5, '#c86bd8', 0.95],
  [68, 27, '#5fe0c0', 1.05],
  [71, 34, '#8ce06b', 0.9],
];

function Mushrooms() {
  return (
    <>
      {MUSHROOMS.map(([left, top, color, scale], i) => (
        <span
          key={i}
          className="mapfx-glow"
          style={{
            left: `${left}%`,
            top: `${top}%`,
            width: `${2.6 * scale}%`,
            background: `radial-gradient(circle, ${color}cc 0%, ${color}44 38%, transparent 70%)`,
            animationDelay: `${(i * 0.47) % 3.4}s`,
            animationDuration: `${2.6 + (i % 4) * 0.6}s`,
          }}
        />
      ))}
    </>
  );
}

/** Fireflies drifting through the trees. */
function Fireflies() {
  const rng = seeded(97);
  const flies = Array.from({ length: 22 }, (_, i) => ({
    key: i,
    left: 14 + rng() * 60,
    top: 24 + rng() * 15,
    delay: rng() * 9,
    duration: 7 + rng() * 6,
    drift: (rng() - 0.5) * 5,
  }));

  return (
    <>
      {flies.map((f) => (
        <span
          key={f.key}
          className="mapfx-fly"
          style={{
            left: `${f.left}%`,
            top: `${f.top}%`,
            animationDelay: `${f.delay}s`,
            animationDuration: `${f.duration}s`,
            ['--drift' as string]: `${f.drift}%`,
          }}
        />
      ))}
    </>
  );
}

/* --------------------------------------------------------------- crystals */

/** The two crystal seams — upper right cave and lower right geode. */
const CRYSTALS: [number, number, number][] = [
  [90, 25.5, 0.9], [93.5, 28, 1.1], [88.5, 30.5, 0.8], [95, 32, 1],
  [91, 63, 1.2], [94.5, 66, 0.9], [89, 68.5, 1.05], [96, 70.5, 0.85], [92, 72.5, 1],
];

function Crystals() {
  return (
    <>
      {CRYSTALS.map(([left, top, scale], i) => (
        <span
          key={i}
          className="mapfx-sparkle"
          style={{
            left: `${left}%`,
            top: `${top}%`,
            width: `${1.5 * scale}%`,
            animationDelay: `${(i * 0.83) % 5}s`,
          }}
        />
      ))}
    </>
  );
}

/* ---------------------------------------------------------------- volcano */

function Volcano() {
  const rng = seeded(233);
  const embers = Array.from({ length: 12 }, (_, i) => ({
    key: i,
    left: 78.5 + rng() * 3.2,
    delay: rng() * 4.5,
    duration: 3 + rng() * 2.6,
    size: 0.28 + rng() * 0.34,
  }));

  return (
    <>
      <span className="mapfx-heat" style={{ left: '77.5%', top: '40.5%' }} />
      {embers.map((e) => (
        <span
          key={e.key}
          className="mapfx-ember"
          style={{
            left: `${e.left}%`,
            top: '41.5%',
            width: `${e.size}%`,
            animationDelay: `${e.delay}s`,
            animationDuration: `${e.duration}s`,
          }}
        />
      ))}
    </>
  );
}

/* ------------------------------------------------------- beacons and boats */

function Beacons() {
  return (
    <>
      {/* lighthouse sweep, on the harbour spit */}
      <span className="mapfx-beam" style={{ left: '72.3%', top: '75.5%' }} />
      {/* the citadel breathing gold */}
      <span className="mapfx-citadel" style={{ left: '47%', top: '89%' }} />
      {/* watchtower brazier, north-east */}
      <span
        className="mapfx-glow"
        style={{
          left: '85.6%',
          top: '17%',
          width: '2%',
          background: 'radial-gradient(circle, #ffca6acc 0%, #ff9d3c55 40%, transparent 70%)',
          animationDuration: '2.2s',
        }}
      />
      {/* torch above the eastern cliff */}
      <span
        className="mapfx-glow"
        style={{
          left: '87.4%',
          top: '50.5%',
          width: '1.6%',
          background: 'radial-gradient(circle, #ffb45ccc 0%, #ff8a3355 40%, transparent 70%)',
          animationDuration: '1.7s',
        }}
      />
    </>
  );
}

const BOATS: [number, number, number][] = [
  [6.5, 47.5, 0], [11.5, 64, 1.4], [16.5, 88.5, 0.7],
  [31, 78, 2.1], [69, 80.5, 1.1], [79, 78, 2.6],
];

function Boats() {
  return (
    <>
      {BOATS.map(([left, top, delay], i) => (
        <span
          key={i}
          className="mapfx-boat"
          style={{ left: `${left}%`, top: `${top}%`, animationDelay: `${delay}s` }}
        />
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ birds */

function Birds() {
  const rng = seeded(613);
  return (
    <>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className="mapfx-bird"
          style={{
            top: `${6 + rng() * 16}%`,
            animationDelay: `${i * 9 + rng() * 6}s`,
            animationDuration: `${34 + rng() * 20}s`,
            fontSize: `${0.7 + rng() * 0.5}rem`,
          }}
        >
          ᶺ
        </span>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ export */

/** All scenery motion. Memoised — none of it depends on app state, so it
 *  should never re-render when progress changes. */
export const MapFx = memo(function MapFx() {
  return (
    <div className="mapfx" aria-hidden="true">
      <Water />
      <Waterfall />
      <Mushrooms />
      <Fireflies />
      <Crystals />
      <Volcano />
      <Beacons />
      <Boats />
      <Birds />
    </div>
  );
});
