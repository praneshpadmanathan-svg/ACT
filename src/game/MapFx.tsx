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
import { CLOUDS } from '@/game/mapData';

/* -------------------------------------------------------------- waterfall */

/* Geometry read off the artwork rather than guessed.

   Sampling `world-map.webp`: the lip is the pale band at y 35.5-36.5, the water
   column runs x 7.4-11.8, and there is painted foam in the plunge pool from
   y 42 to y 46, spreading right to x 15. The previous streaks started at
   y 32.5 — above the drop, still river — and ran to x 12.5, so half of them
   fell down the bare rock beside the falls. */
const FALL = {
  left: 9.6, // centre of the column
  width: 4.4, // 7.4 -> 11.8
  lip: 36, // where the water turns over
  base: 42.4, // where it lands
  pool: 43.6, // the pool surface
};

function Waterfall() {
  const rng = seeded(41);

  /* More streaks than before, and narrower. A waterfall is not a dozen ropes
     of water — it is a mass, and the mass reads better from many thin strands
     at different speeds than from a few thick ones. */
  const streaks = Array.from({ length: 26 }, () => {
    const width = 0.16 + rng() * 0.26;
    return {
      left: FALL.left - FALL.width / 2 + rng() * FALL.width,
      // Start just under the lip, with a little scatter so the edge is not a line.
      top: FALL.lip + 0.2 + rng() * 0.8,
      height: (FALL.base - FALL.lip) * (0.55 + rng() * 0.5),
      width,
      delay: rng() * 2.2,
      /* Thin strands fall faster than wide ones, which is not physics but is
         what makes the column look like it has depth. */
      duration: 1.15 + rng() * 0.9 + width,
      opacity: 0.28 + rng() * 0.5,
    };
  });

  return (
    <>
      {/* the lip, catching the light as the river turns over */}
      <span
        className="mapfx-crest"
        style={{
          left: `${FALL.left}%`,
          top: `${FALL.lip}%`,
          width: `${FALL.width + 0.6}%`,
          height: '0.75%',
        }}
      />

      {/* the falling column */}
      {streaks.map((s, i) => (
        <span
          key={i}
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

      {/* two veils over the strands, so they read as one body of water */}
      {[0, 1].map((i) => (
        <span
          key={`veil${i}`}
          className="mapfx-veil"
          style={{
            left: `${FALL.left + (i ? 0.5 : -0.5)}%`,
            top: `${(FALL.lip + FALL.base) / 2}%`,
            width: `${FALL.width - 0.4}%`,
            height: `${FALL.base - FALL.lip}%`,
            animationDelay: `${i * 1.3}s`,
            animationDuration: `${2.4 + i * 0.7}s`,
          }}
        />
      ))}

      {/* where it lands */}
      <span
        className="mapfx-impact"
        style={{
          left: `${FALL.left}%`,
          top: `${FALL.base}%`,
          width: `${FALL.width + 1.4}%`,
          height: '2.4%',
          animationDuration: '1.7s',
        }}
      />

      {/* mist hanging over the pool, and the light through it */}
      {[
        { dx: -0.6, dy: -0.4, w: 6.5, h: 5, dur: 7.5, delay: 0 },
        { dx: 1.8, dy: 0.6, w: 5, h: 3.8, dur: 9.5, delay: -3.2 },
        { dx: 3.6, dy: 0.2, w: 4, h: 3, dur: 11, delay: -6 },
      ].map((m, i) => (
        <span
          key={`mist${i}`}
          className="mapfx-mistball"
          style={{
            left: `${FALL.left + m.dx}%`,
            top: `${FALL.base + m.dy}%`,
            width: `${m.w}%`,
            height: `${m.h}%`,
            animationDuration: `${m.dur}s`,
            animationDelay: `${m.delay}s`,
          }}
        />
      ))}

      {/* the rainbow standing in the spray */}
      <span
        className="mapfx-bow"
        style={{
          left: `${FALL.left + 1.4}%`,
          top: `${FALL.base + 0.6}%`,
          width: '7.5%',
          height: '3.2%',
        }}
      />

      {/* rings spreading off the impact, across the painted foam */}
      {[0, 1, 2].map((i) => (
        <span
          key={`ripple${i}`}
          className="mapfx-ripple"
          style={{
            left: `${FALL.left + 0.8}%`,
            top: `${FALL.pool}%`,
            width: '7%',
            height: '1.9%',
            animationDuration: '4.2s',
            animationDelay: `${i * 1.4}s`,
          }}
        />
      ))}

      {/* spray thrown up off the rocks, arcing out over the pool */}
      {Array.from({ length: 16 }, (_, i) => {
        const spread = (rng() - 0.5) * FALL.width * 1.9;
        return (
          <span
            key={`spray${i}`}
            className="mapfx-spray"
            style={{
              left: `${FALL.left + spread}%`,
              top: `${FALL.base - 0.3 + rng() * 1.4}%`,
              width: `${0.9 + rng() * 1.1}%`,
              animationDelay: `${rng() * 2.6}s`,
              animationDuration: `${1.9 + rng() * 1.4}s`,
            }}
          />
        );
      })}
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
  /* Was { left: 66, top: 8, w: 26 }, which spans x 53-79 — pixel-sampling the
     artwork there returns rgb(136,151,100), farmland. A specular water shimmer
     was playing over a hillside. The river in this band actually runs x 76-88
     at y 10.5-13.5, so the patch now sits on it. */
  { left: 82, top: 12, w: 14, h: 6, delay: 1.8 },
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

/* The crater, found by sampling rather than by eye: the hottest pixels in the
   desert band sit at x 81-82, y 41-43 — rgb(246,214,33) and rgb(240,116,45).
   The heat shimmer used to sit at x 77.5, glowing over plain canyon rock four
   percent away from the thing it was meant to be coming out of. */
const CRATER = { x: 81.5, y: 42 };

function Volcano() {
  const rng = seeded(233);

  return (
    <>
      {/* light spilling onto the rock, under everything else */}
      <span
        className="mapfx-craterlight"
        style={{
          left: `${CRATER.x}%`,
          top: `${CRATER.y + 0.3}%`,
          width: '11%',
          height: '7%',
          animationDuration: '5.5s',
        }}
      />

      {/* the molten core */}
      <span
        className="mapfx-crater"
        style={{
          left: `${CRATER.x}%`,
          top: `${CRATER.y}%`,
          width: '3.2%',
          height: '2%',
          animationDuration: '4.2s',
        }}
      />

      {/* heat shimmer, now actually above the crater */}
      <span className="mapfx-heat" style={{ left: `${CRATER.x}%`, top: `${CRATER.y - 1.2}%` }} />

      {/* the ash plume: several puffs on one long clock, leaning downwind */}
      {Array.from({ length: 7 }, (_, i) => (
        <span
          key={`plume${i}`}
          className="mapfx-plume"
          style={{
            left: `${CRATER.x + (rng() - 0.5) * 1.4}%`,
            top: `${CRATER.y - 0.6}%`,
            width: `${2.2 + rng() * 1.8}%`,
            height: `${1.6 + rng() * 1.2}%`,
            animationDuration: `${9 + rng() * 6}s`,
            animationDelay: `${-rng() * 12}s`,
          }}
        />
      ))}

      {/* embers, rising from the crater rather than beside it */}
      {Array.from({ length: 16 }, (_, i) => (
        <span
          key={`ember${i}`}
          className="mapfx-ember"
          style={{
            left: `${CRATER.x + (rng() - 0.5) * 2.6}%`,
            top: `${CRATER.y - 0.2}%`,
            width: `${0.22 + rng() * 0.3}%`,
            animationDelay: `${rng() * 5}s`,
            animationDuration: `${2.6 + rng() * 2.8}s`,
          }}
        />
      ))}

      {/* and every twenty seconds or so, it throws */}
      <span
        className="mapfx-surge"
        style={{
          left: `${CRATER.x}%`,
          top: `${CRATER.y - 0.4}%`,
          width: '5%',
          height: '3.2%',
          animationDuration: '19s',
        }}
      />
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

/* --------------------------------------------------------- village smoke */

/** Chimney smoke curling off the cottages. */
const CHIMNEYS: [number, number][] = [
  [12, 15], [23, 11], [31, 13.5], [41, 10], [57, 11], [65, 14],
];

function Smoke() {
  return (
    <>
      {CHIMNEYS.map(([left, top], i) =>
        Array.from({ length: 3 }, (_, puff) => (
          <span
            key={`${i}-${puff}`}
            className="mapfx-smoke"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              animationDelay: `${(i * 1.3 + puff * 1.9) % 6}s`,
              animationDuration: `${5.5 + (i % 3)}s`,
            }}
          />
        )),
      )}
    </>
  );
}

/* ------------------------------------------------------------------ waves */

/** Foam breaking along the shoreline and the citadel island. */
const SHORES: [number, number, number][] = [
  [8, 55, 1], [10, 72, 1.2], [20, 84, 1], [33, 80, 0.9],
  [40, 88, 1.3], [55, 86, 1], [64, 82, 1.1], [78, 84, 1],
  [47, 95, 1.4], [88, 76, 0.9],
];

function Waves() {
  return (
    <>
      {SHORES.map(([left, top, scale], i) => (
        <span
          key={i}
          className="mapfx-wave"
          style={{
            left: `${left}%`,
            top: `${top}%`,
            width: `${5 * scale}%`,
            animationDelay: `${(i * 0.83) % 5}s`,
            animationDuration: `${4 + (i % 3) * 0.8}s`,
          }}
        />
      ))}
    </>
  );
}

/* ------------------------------------------------------------------- wind */

/** Leaves lifting off the canopy and drifting across the forest. */
function Leaves() {
  const rng = seeded(1201);
  return (
    <>
      {Array.from({ length: 10 }, (_, i) => (
        <span
          key={i}
          className="mapfx-leaf"
          style={{
            left: `${14 + rng() * 52}%`,
            top: `${25 + rng() * 12}%`,
            animationDelay: `${rng() * 14}s`,
            animationDuration: `${9 + rng() * 7}s`,
            ['--lift' as string]: `${-6 - rng() * 6}%`,
            ['--sway' as string]: `${8 + rng() * 14}%`,
          }}
        />
      ))}
    </>
  );
}

/* ------------------------------------------------------------------- dust */

/** Dust devils drifting over the sand. */
function Dust() {
  const rng = seeded(877);
  return (
    <>
      {Array.from({ length: 6 }, (_, i) => (
        <span
          key={i}
          className="mapfx-dust"
          style={{
            left: `${20 + rng() * 60}%`,
            top: `${46 + rng() * 12}%`,
            width: `${3 + rng() * 3}%`,
            animationDelay: `${rng() * 16}s`,
            animationDuration: `${11 + rng() * 8}s`,
          }}
        />
      ))}
    </>
  );
}

/* --------------------------------------------------------- shooting star */

/** Rare, so it stays a small surprise rather than decoration. */
function ShootingStar() {
  return <span className="mapfx-shoot" style={{ left: '68%', top: '6%' }} />;
}

/* ------------------------------------------------------------------ birds

   These used to be the character U+1DBA set in the display face, which read as
   literal letters drifting across the sky. They are drawn now. */

function Birds() {
  const rng = seeded(613);
  return (
    <>
      {Array.from({ length: 7 }, (_, i) => {
        const size = 9 + rng() * 7;
        const flap = 0.5 + rng() * 0.45;
        return (
          <span
            key={i}
            className="mapfx-crossing"
            style={{
              top: `${5 + rng() * 18}%`,
              animationDelay: `${i * 7 + rng() * 5}s`,
              animationDuration: `${34 + rng() * 22}s`,
              ['--peak' as string]: 0.75,
            }}
          >
            {/* a wing pair, flapping on its own clock */}
            <svg
              width={size}
              height={size * 0.5}
              viewBox="0 0 20 10"
              className="mapfx-wing"
              style={{ animationDuration: `${flap}s` }}
              aria-hidden="true"
            >
              <path
                d="M1 7 Q5.5 1 10 6 Q14.5 1 19 7"
                fill="none"
                stroke="rgba(52,40,26,.62)"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </span>
        );
      })}
    </>
  );
}

/* ----------------------------------------------------------------- clouds

   CLOUDS has been sitting in mapData since the map was built and was never
   imported, so the sky above the world never moved. Each cloud is a few soft
   blobs in one drifting group, with a shadow that crosses the terrain under it
   at the same rate. */

function Clouds() {
  const rng = seeded(2207);
  return (
    <>
      {CLOUDS.map(([top, width, opacity, duration], i) => {
        const puffs = Array.from({ length: 4 }, () => ({
          x: rng() * 62,
          y: rng() * 26,
          r: 26 + rng() * 30,
        }));
        return (
          <span
            key={i}
            className="mapfx-crossing"
            style={{
              top: `${top}%`,
              animationDuration: `${duration}s`,
              animationDelay: `${-rng() * duration}s`,
              ['--peak' as string]: opacity,
            }}
          >
            <span className="mapfx-cloud-body" style={{ width: `${width}px` }}>
              <svg viewBox="0 0 120 60" aria-hidden="true">
                {puffs.map((p, j) => (
                  <circle key={j} cx={p.x + 28} cy={p.y + 22} r={p.r} fill="#fffaf0" />
                ))}
              </svg>
            </span>
          </span>
        );
      })}
      {/* the shadows they cast, drifting in step but slightly behind */}
      {CLOUDS.filter((_, i) => i % 2 === 0).map(([top, width, opacity, duration], i) => (
        <span
          key={`shadow${i}`}
          className="mapfx-crossing"
          style={{
            top: `${top + 3.5}%`,
            animationDuration: `${duration}s`,
            animationDelay: `${-rng() * duration}s`,
            ['--peak' as string]: opacity * 0.5,
          }}
        >
          <span className="mapfx-cloud-shadow" style={{ width: `${width * 1.15}px` }} />
        </span>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------- wind

   Gusts sweeping the open ground: the barley and tilled fields up in the
   village, and the grass shelf above the science cliffs. */

const GUSTS: { left: number; top: number; w: number; delay: number; dur: number }[] = [
  { left: 22, top: 11, w: 9, delay: 0, dur: 6.5 },
  { left: 63, top: 16, w: 11, delay: 2.2, dur: 7.4 },
  { left: 42, top: 12.5, w: 8, delay: 4.1, dur: 6 },
  { left: 35, top: 13.5, w: 7, delay: 1.4, dur: 8 },  // was 50,72 — the lighthouse causeway, not open ground
];

function Wind() {
  return (
    <>
      {GUSTS.map((g, i) => (
        <span
          key={i}
          className="mapfx-gust"
          style={{
            left: `${g.left}%`,
            top: `${g.top}%`,
            width: `${g.w}%`,
            animationDelay: `${g.delay}s`,
            animationDuration: `${g.dur}s`,
          }}
        />
      ))}
    </>
  );
}

/* ------------------------------------------------------------ lit windows

   The cottages and the citadel come up warm, each on its own slow cycle, so
   the settled parts of the world look inhabited. */

const WINDOWS: [number, number][] = [
  [11.4, 16.6], [12.2, 17.4], [16.6, 12.2], [42.4, 11.8], [56.4, 12.4],
  [37.2, 72.8], [59.4, 65], [68.4, 70.4], [76.2, 63.4], [70.4, 25.4],
];

function Windows() {
  const rng = seeded(88);
  return (
    <>
      {WINDOWS.map(([left, top], i) => (
        <span
          key={i}
          className="mapfx-window"
          style={{
            left: `${left}%`,
            top: `${top}%`,
            width: `${0.6 + rng() * 0.5}%`,
            animationDelay: `${rng() * 5}s`,
            animationDuration: `${3.4 + rng() * 3}s`,
          }}
        />
      ))}
    </>
  );
}

/* ------------------------------------------------------------- sailing ship

   The moored boats only rock in place. This one actually crosses the bay below
   the science cliffs, so the sea has something travelling on it. */

function Sail() {
  return (
    <span className="mapfx-sail" style={{ top: '79.5%' }}>
      <svg viewBox="0 0 30 26" width="22" height="19" aria-hidden="true">
        <path d="M15 2 L15 19" stroke="rgba(48,36,24,.6)" strokeWidth="1.4" />
        <path d="M15 3 Q25 9 15 17 Z" fill="rgba(250,242,226,.7)" stroke="rgba(48,36,24,.5)" strokeWidth="1" />
        <path d="M5 19 Q15 25 25 19 Z" fill="rgba(70,50,32,.6)" />
      </svg>
    </span>
  );
}

/* ------------------------------------------------------------ new weather */

/** Rain squalls dragging across the open water, on a crossing track. */
function Squalls() {
  const rng = seeded(9041);
  return (
    <>
      {[
        { top: 70, w: 26, h: 13, dur: 74 },
        { top: 84, w: 34, h: 15, dur: 96 },
      ].map((s, i) => (
        <span
          key={i}
          className="mapfx-crossing"
          style={{
            top: `${s.top}%`,
            animationDuration: `${s.dur}s`,
            animationDelay: `${-rng() * s.dur}s`,
            ['--peak' as string]: 0.5,
          }}
        >
          <span
            className="mapfx-squall"
            style={{ display: 'block', width: `${s.w}%`, height: `${s.h}vh` }}
          />
        </span>
      ))}
    </>
  );
}

/** The aurora over the northern sky. Slow enough to notice only on the second
 *  look, which is the right speed for something that is meant to be scenery. */
function Aurora() {
  return (
    <>
      {[
        { left: 32, top: 6, w: 54, h: 13, dur: 42, delay: 0 },
        { left: 66, top: 4, w: 44, h: 10, dur: 55, delay: -18 },
      ].map((a, i) => (
        <span
          key={i}
          className="mapfx-aurora"
          style={{
            left: `${a.left}%`,
            top: `${a.top}%`,
            width: `${a.w}%`,
            height: `${a.h}%`,
            animationDuration: `${a.dur}s`,
            animationDelay: `${a.delay}s`,
          }}
        />
      ))}
    </>
  );
}

/** Butterflies over the forest clearings, wandering rather than crossing. */
function Butterflies() {
  const rng = seeded(4477);
  return (
    <>
      {Array.from({ length: 5 }, (_, i) => {
        const dur = 16 + rng() * 10;
        return (
          <span
            key={i}
            className="mapfx-flutter"
            style={{
              left: `${18 + rng() * 20}%`,
              top: `${26 + rng() * 12}%`,
              animationDuration: `${dur}s`,
              animationDelay: `${-rng() * dur}s`,
            }}
          >
            <svg width="9" height="8" viewBox="0 0 12 10" aria-hidden="true">
              <path
                d="M6 5 Q1 0 1.5 4.5 Q2 8.5 6 5 Q10 8.5 10.5 4.5 Q11 0 6 5Z"
                fill={i % 2 ? 'rgba(255,214,120,.85)' : 'rgba(198,166,255,.8)'}
              />
            </svg>
          </span>
        );
      })}
    </>
  );
}

/** Tumbleweed along the desert floor. Rides a crossing track so the roll
 *  covers the desert and stops there rather than rolling into the sea. */
function Tumbleweed() {
  const rng = seeded(3312);
  return (
    <>
      {[
        { top: 52, size: 11, dur: 46 },
        { top: 58.5, size: 8, dur: 61 },
      ].map((t, i) => (
        <span
          key={i}
          className="mapfx-tumble"
          style={{
            left: '38%',
            top: `${t.top}%`,
            width: '30%',
            height: 0,
            transform: 'none',
            animationDuration: `${t.dur}s`,
            animationDelay: `${-rng() * t.dur}s`,
          }}
        >
          <svg width={t.size} height={t.size} viewBox="0 0 14 14" aria-hidden="true">
            <g fill="none" stroke="rgba(122,92,52,.7)" strokeWidth="1.1" strokeLinecap="round">
              <circle cx="7" cy="7" r="5.4" />
              <path d="M2 5 L12 9 M2 9 L12 5 M7 1.6 L7 12.4" />
            </g>
          </svg>
        </span>
      ))}
    </>
  );
}

/** The banner over the citadel gate, at the Summit. */
function Banner() {
  return (
    <span className="mapfx-banner" style={{ left: '88.5%', top: '92%' }}>
      <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true">
        <path d="M0 0 H15 L11.5 6 L15 12 H0 Z" fill="rgba(232,195,74,.75)" />
      </svg>
    </span>
  );
}

/* ------------------------------------------------------------------ export */

/** All scenery motion. Memoised — none of it depends on app state, so it
 *  should never re-render when progress changes. */
export const MapFx = memo(function MapFx() {
  return (
    <div className="mapfx" aria-hidden="true">
      <Water />
      <Waves />
      <Waterfall />
      <Mushrooms />
      <Fireflies />
      <Leaves />
      <Crystals />
      <Volcano />
      <Dust />
      <Beacons />
      <Smoke />
      <Boats />
      <Sail />
      <Windows />
      <Wind />
      <Birds />
      <Butterflies />
      <Tumbleweed />
      <Banner />
      <Clouds />
      <Squalls />
      <Aurora />
      <ShootingStar />
    </div>
  );
});
