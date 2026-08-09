/* Seven ranks, seven sigils.
 *
 * The old badge was one shield path with a star on it, recoloured seven
 * times. The art director's line: *"seven ranks should look like seven
 * achievements, not one badge with a palette swap."* A palette swap is also
 * the one thing a player cannot read at the size these render at — at 38px in
 * the rank list, hue is all you get, and hue alone does not say *earned*.
 *
 * So each rank gets its own silhouette, and the silhouettes escalate: a
 * notched wooden token, a book plaque, a laurelled shield, a cut gem, a
 * winged spearhead, a starburst, and finally a crowned sun. You can tell
 * Vanguard from Elite across a room, in greyscale, with the colours gone.
 *
 * All seven share the construction so they read as one set:
 *
 *   - 64×64 viewBox, same optical weight, same 2.5 ink ring
 *   - light from the upper left, matching `BossArt` and `HeroAvatar`
 *   - the rank's own `c1`/`c2` as the body gradient and `ring` as the metal
 *   - a device in near-white on top, because at 38px the device is the thing
 *     that actually differentiates them
 *
 * Keyed by name rather than by array index so that inserting a rank between
 * two existing ones does not silently hand everybody a different badge.
 */

import { useId } from 'react';
import { Glyph, type IconName } from './Icon';

export interface SigilColors {
  name: string;
  c1: string;
  c2: string;
  ring: string;
}

/** Near-white, warm. A pure white device on a warm badge reads as cut out. */
const DEVICE = 'rgba(255,251,240,.94)';

type Draw = (device: string) => React.ReactNode;

/* ------------------------------------------------------------- the shapes */

/** Recruit — a wooden token with one notch cut out of the rim. Deliberately
 *  the plainest thing in the set: rank one should look like the start. */
const recruit: { body: string; inner?: string; device: Draw } = {
  body: 'M32 4a28 28 0 1 1 0 56 28 28 0 0 1 0-56Z',
  inner: 'M32 11a21 21 0 1 1 0 42 21 21 0 0 1 0-42Z',
  device: (device) => (
    <g fill={device}>
      <path d="M32 20 L35 30 L32 44 L29 30 Z" />
      <circle cx="32" cy="17" r="3" />
    </g>
  ),
};

/** Scholar — a squared plaque holding an open book. */
const scholar = {
  body: 'M10 8h44a2 2 0 0 1 2 2v38l-24 12L8 48V10a2 2 0 0 1 2-2Z',
  inner: 'M15 14h34v31L32 54 15 45Z',
  device: (device: string) => (
    <g fill={device}>
      <path d="M31 25c-3-2.4-7-3-11-2.6v17c4-.4 8 .2 11 2.6Z" />
      <path d="M33 25c3-2.4 7-3 11-2.6v17c-4-.4-8 .2-11 2.6Z" />
      <rect x="31.1" y="24.4" width="1.8" height="17.6" rx=".8" />
    </g>
  ),
};

/** Honors — the classic shield, but now with laurels, so it is the *third*
 *  thing in a sequence rather than the only idea in the set. */
const honors = {
  body: 'M32 4 L54 12 V32 C54 45 44 55 32 60 C20 55 10 45 10 32 V12 Z',
  inner: 'M32 11 L48 17 V32 C48 42 40 50 32 54 C24 50 16 42 16 32 V17 Z',
  device: (device: string) => (
    <g fill={device}>
      <path d="M32 20 L35.2 28.4 L44.2 29 L37.3 34.6 L39.5 43.2 L32 38.4 L24.5 43.2 L26.7 34.6 L19.8 29 L28.8 28.4 Z" />
      {/* laurels, mirrored */}
      <g opacity=".8">
        <path d="M17 30c-1 6 1 12 6 16-1-6-2-11-2-16Z" />
        <path d="M47 30c1 6-1 12-6 16 1-6 2-11 2-16Z" />
      </g>
    </g>
  ),
};

/** Distinction — a cut gem. Facets rather than a flat field, which is the
 *  first badge in the set that catches light on its own. */
const distinction = {
  body: 'M32 3 L58 22 L48 56 H16 L6 22 Z',
  inner: 'M32 11 L50 24 L42 50 H22 L14 24 Z',
  device: (device: string) => (
    <g>
      <path d="M32 18 L42 27 L32 46 L22 27 Z" fill={device} />
      {/* the facet lines are the device — a solid diamond would be a blob */}
      <g stroke="rgba(40,26,10,.34)" strokeWidth="1.4" fill="none">
        <path d="M32 18 L32 46M22 27 L42 27M27 22.5 L32 27 L37 22.5" />
      </g>
    </g>
  ),
};

/** Vanguard — a winged spearhead. First one in the set that points. */
const vanguard = {
  body: 'M32 3 L52 16 L54 40 L32 61 L10 40 L12 16 Z',
  inner: 'M32 11 L46 20 L47.5 38 L32 53 L16.5 38 L18 20 Z',
  device: (device: string) => (
    <g fill={device}>
      <path d="M32 16 L38 32 L32 48 L26 32 Z" />
      <path d="M24 27 L15 33 L24 34 Z" opacity=".85" />
      <path d="M40 27 L49 33 L40 34 Z" opacity=".85" />
    </g>
  ),
};

/** Elite — an eight-pointed burst inside a ring. Radial where everything
 *  before it was axial. */
const elite = {
  body:
    'M32 2 L39 12 L51 9 L52 21 L62 28 L54 37 L59 48 L47 51 L43 62 L32 56 ' +
    'L21 62 L17 51 L5 48 L10 37 L2 28 L12 21 L13 9 L25 12 Z',
  inner: 'M32 12a20 20 0 1 1 0 40 20 20 0 0 1 0-40Z',
  device: (device: string) => (
    <g fill={device}>
      <path d="M32 17 L35 29 L47 32 L35 35 L32 47 L29 35 L17 32 L29 29 Z" />
      <path d="M32 24 L33.6 30.4 L40 32 L33.6 33.6 L32 40 L30.4 33.6 L24 32 L30.4 30.4 Z" fill="rgba(40,26,10,.3)" />
    </g>
  ),
};

/** Perfect 36 — a crowned sun. The only one with rays outside the ring, so
 *  the last rank is the only badge that does not fit in the same circle. */
const perfect = {
  body: 'M32 6a26 26 0 1 1 0 52 26 26 0 0 1 0-52Z',
  inner: 'M32 13a19 19 0 1 1 0 38 19 19 0 0 1 0-38Z',
  device: (device: string) => (
    <g>
      {/* rays */}
      <g stroke={device} strokeWidth="2.6" strokeLinecap="round" opacity=".9">
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * Math.PI) / 6;
          return (
            <line
              key={i}
              x1={32 + Math.cos(a) * 21}
              y1={32 + Math.sin(a) * 21}
              x2={32 + Math.cos(a) * 27}
              y2={32 + Math.sin(a) * 27}
            />
          );
        })}
      </g>
      {/* a crown, because "nothing left to miss" should look like something */}
      <path
        d="M22 38 L21 24 L27 29 L32 21 L37 29 L43 24 L42 38 Z"
        fill={device}
        stroke="rgba(40,26,10,.28)"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M22 39.5h20" stroke={device} strokeWidth="3" strokeLinecap="round" />
    </g>
  ),
};

const SIGILS: Record<string, typeof scholar> = {
  Recruit: recruit as typeof scholar,
  Scholar: scholar,
  Honors: honors,
  Distinction: distinction,
  Vanguard: vanguard,
  Elite: elite,
  'Perfect 36': perfect,
};

export function RankSigil({ rank, size = 56 }: { rank: SigilColors; size?: number }) {
  const uid = useId().replace(/:/g, '');
  /* Unknown names fall back to the shield rather than rendering nothing — a
     rank could be added tomorrow and an empty badge is worse than a generic
     one. */
  const sigil = SIGILS[rank.name] ?? honors;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={`${rank.name} rank`}
      style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.4))' }}
    >
      <defs>
        {/* Upper left to lower right, like every other lit thing in the app. */}
        <linearGradient id={`${uid}-body`} x1="0.15" y1="0.05" x2="0.85" y2="1">
          <stop offset="0" stopColor={rank.c1} />
          <stop offset="1" stopColor={rank.c2} />
        </linearGradient>
        {/* A specular sweep across the top-left third — what makes it metal
            rather than a coloured shape. */}
        <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.42" />
          <stop offset="0.45" stopColor="#ffffff" stopOpacity="0.06" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      <path
        d={sigil.body}
        fill={`url(#${uid}-body)`}
        stroke={rank.ring}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {sigil.inner && (
        <path d={sigil.inner} fill="none" stroke="rgba(0,0,0,.26)" strokeWidth="2" strokeLinejoin="round" />
      )}
      {sigil.device(DEVICE)}
      {/* Sheen over the device too, so the highlight sits on the object rather
          than underneath the thing engraved on it. */}
      <path d={sigil.body} fill={`url(#${uid}-sheen)`} pointerEvents="none" />
    </svg>
  );
}

/* ------------------------------------------------------- achievement medals

   Finding 21: *"no achievement/badge art — 15 achievements in `progress.ts`,
   all rendered as a generic icon name string."* The icon names were real
   intent that nothing ever drew, so every one of the fifteen showed the same
   ✦ and the achievement wall was fifteen identical rows.

   A struck medal rather than another shield: same family as the rank sigils
   but visibly a different *kind* of object, because a rank is a station and an
   achievement is a thing that happened. Three metals, assigned by how much
   work each represents — answering your first question and clearing all
   thirty-seven zones should not be the same colour.

   Locked medals are not hidden. Knowing what is out there is most of why an
   achievement list is motivating at all; a wall of question marks is a
   different, worse feature. */

const METAL: Record<'bronze' | 'silver' | 'gold', { c1: string; c2: string; ring: string }> = {
  bronze: { c1: '#d08a52', c2: '#8a4f22', ring: '#f0b47c' },
  silver: { c1: '#e8eef6', c2: '#95a6bd', ring: '#ffffff' },
  gold: { c1: '#ffe07a', c2: '#d99b12', ring: '#fff3b0' },
};

export function AchievementBadge({
  icon,
  tier,
  earned,
  size = 44,
}: {
  icon: IconName;
  tier: 'bronze' | 'silver' | 'gold';
  earned: boolean;
  size?: number;
}) {
  const uid = useId().replace(/:/g, '');
  const metal = METAL[tier];

  return (
    <span
      className="relative inline-flex flex-none items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        aria-hidden="true"
        style={earned ? { filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.45))' } : undefined}
      >
        <defs>
          <linearGradient id={`${uid}-m`} x1="0.15" y1="0.05" x2="0.85" y2="1">
            <stop offset="0" stopColor={metal.c1} />
            <stop offset="1" stopColor={metal.c2} />
          </linearGradient>
        </defs>
        {/* A twelve-sided medal — round enough to read as struck metal, faceted
            enough not to be mistaken for the app's several circles. */}
        <path
          d={twelveGon(24, 24, 21)}
          fill={earned ? `url(#${uid}-m)` : '#2a2118'}
          stroke={earned ? metal.ring : '#463a2a'}
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path
          d={twelveGon(24, 24, 16)}
          fill="none"
          stroke={earned ? 'rgba(0,0,0,.24)' : '#3a3022'}
          strokeWidth="1.6"
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center"
        style={{ color: earned ? 'rgba(38,26,10,.82)' : '#5b4c37' }}
      >
        <Glyph name={icon} size={Math.round(size * 0.42)} strokeWidth={2} />
      </span>
    </span>
  );
}

/** Twelve points on a circle, first point straight up. */
function twelveGon(cx: number, cy: number, r: number): string {
  return (
    Array.from({ length: 12 }, (_, i) => {
      const a = (i * Math.PI) / 6 - Math.PI / 2;
      return `${(cx + Math.cos(a) * r).toFixed(2)} ${(cy + Math.sin(a) * r).toFixed(2)}`;
    })
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p}`)
      .join(' ') + 'Z'
  );
}
