/* The traveller, drawn.
 *
 * One 96×112 head-and-shoulders portrait built from the parameters in
 * `heroes.ts`, so eight distinct characters cost one component. Everything is
 * on the same 3px dark-ink outline the redrawn bosses use — see the note at
 * the top of `BossArt.tsx` about picking one outline treatment for the whole
 * product, which was art-direction finding number 7.
 *
 * Light comes from the upper left in every hero, because the camp and the map
 * are lit from the upper left. Getting that wrong was finding number 6: the
 * old cutout carried soft top-left studio light while the camp behind it was
 * lit warm from frame-right, and the two visibly disagreed about where the sun
 * was.
 *
 * `expression` exists because the review asked for it (finding 35): the hero
 * had no reaction to a correct answer, a boss hit or a rank-up. Three states
 * is enough to carry all three moments and cheap enough to be two paths.
 */

import { heroFor, type Build, type HairStyle, type Hero } from './heroes';

export type HeroExpression = 'calm' | 'pleased' | 'hurt';

const INK = '#241a10';

/** Shoulder half-width in viewBox units. */
const SHOULDER: Record<Build, number> = { slight: 26, even: 31, broad: 36 };

function Hair({ style, hair, ink }: { style: HairStyle; hair: string; ink: string }) {
  switch (style) {
    case 'crop':
      return (
        <path
          d="M30 40c0-11 8-19 18-19s18 8 18 19c0-6-6-9-18-9s-18 3-18 9Z"
          fill={hair} stroke={ink} strokeWidth="2.6" strokeLinejoin="round"
        />
      );

    case 'locs':
      return (
        <g fill={hair} stroke={ink} strokeWidth="2.4" strokeLinejoin="round">
          <path d="M30 41c0-12 8-20 18-20s18 8 18 20c0-6-6-10-18-10s-18 4-18 10Z" />
          <path d="M29 38c-2 8-3 15-2 22l5-1c-1-7 0-14 1-20Z" />
          <path d="M67 38c2 8 3 15 2 22l-5-1c1-7 0-14-1-20Z" />
          <path d="M35 33c-3 9-4 17-3 25l4-1c-1-8 0-15 2-22Z" />
          <path d="M61 33c3 9 4 17 3 25l-4-1c1-8 0-15-2-22Z" />
        </g>
      );

    case 'braid':
      return (
        <g fill={hair} stroke={ink} strokeWidth="2.6" strokeLinejoin="round">
          <path d="M29 42c0-12 8-21 19-21s19 9 19 21c0-7-7-11-19-11s-19 4-19 11Z" />
          <path d="M64 42c4 10 5 20 3 30l-6-2c2-9 1-18-2-26Z" />
          <path d="M62 60c2 1 4 1 6 0M62.5 66c2 1 4 1 6 0" fill="none" strokeWidth="1.8" />
        </g>
      );

    case 'wave':
      return (
        <path
          d="M29 43c0-13 9-22 19-22s19 9 19 22c-2-4-5-7-9-6-3-3-7-4-11-3-4-1-8 0-11 3-3-1-6 2-7 6Z"
          fill={hair} stroke={ink} strokeWidth="2.6" strokeLinejoin="round"
        />
      );

    /* A headwrap, not hair — some students cover, and an avatar set that has
       no way to show that is telling them it did not think of them. */
    case 'wrap':
      return (
        <g stroke={ink} strokeWidth="2.6" strokeLinejoin="round">
          <path d="M28 44c0-13 9-23 20-23s20 10 20 23c0 3-1 6-2 8l-4-3c1-9-5-16-14-16s-15 7-14 16l-4 3c-1-2-2-5-2-8Z" fill={hair} />
          <path d="M28 46c-3 8-2 17 3 24l7-4c-4-6-5-13-3-19Z" fill={hair} />
          <path d="M30 50c3 1 6 1 9-1" fill="none" strokeWidth="1.7" opacity=".55" />
        </g>
      );

    case 'curls':
      return (
        <g fill={hair} stroke={ink} strokeWidth="2.4">
          <circle cx="34" cy="34" r="8" />
          <circle cx="48" cy="28" r="9.5" />
          <circle cx="62" cy="34" r="8" />
          <circle cx="41" cy="26" r="7" />
          <circle cx="55" cy="26" r="7" />
        </g>
      );
  }
}

export function HeroAvatar({
  hero,
  size = 96,
  expression = 'calm',
  className,
}: {
  hero: Hero | string;
  size?: number;
  expression?: HeroExpression;
  className?: string;
}) {
  const h = typeof hero === 'string' ? heroFor(hero) : hero;
  const shoulder = SHOULDER[h.build];
  const id = `hero-${h.id}`;

  return (
    <svg
      width={size}
      height={(size / 96) * 112}
      viewBox="0 0 96 112"
      className={className}
      role="img"
      aria-label={`${h.name}, your traveller`}
    >
      <defs>
        {/* One warm key from the upper left, matching the camp and the map. */}
        <linearGradient id={`${id}-cloak`} x1="0.15" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor={h.cloak} />
          <stop offset="1" stopColor={h.cloakShade} />
        </linearGradient>
        <linearGradient id={`${id}-skin`} x1="0.2" y1="0.1" x2="0.85" y2="0.95">
          <stop offset="0" stopColor={h.skin} />
          <stop offset="1" stopColor={h.skinShade} />
        </linearGradient>
      </defs>

      {/* shoulders and cloak */}
      <path
        d={`M${48 - shoulder} 112c0-16 8-26 ${shoulder - 6} -29h12c${shoulder - 6} 3 ${shoulder} 13 ${shoulder} 29Z`}
        fill={`url(#${id}-cloak)`}
        stroke={INK}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* a clasp, so the cloak reads as worn rather than painted on */}
      <circle cx="48" cy="92" r="4" fill={h.cloakShade} stroke={INK} strokeWidth="2.4" />

      {/* neck */}
      <path d="M41 74h14v12h-14Z" fill={h.skinShade} stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />

      {/* head */}
      <path
        d="M30 44c0-11 8-19 18-19s18 8 18 19v10c0 12-8 21-18 21s-18-9-18-21Z"
        fill={`url(#${id}-skin)`}
        stroke={INK}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* ears */}
      <path d="M30 52a4 4 0 0 0 0 8M66 52a4 4 0 0 1 0 8" fill={h.skin} stroke={INK} strokeWidth="2.4" />

      <Hair style={h.hairStyle} hair={h.hair} ink={INK} />

      {/* eyes — closed and curved when pleased, squeezed shut when hurt */}
      {expression === 'pleased' ? (
        <g fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round">
          <path d="M38 54c1.5-2.5 4.5-2.5 6 0" />
          <path d="M52 54c1.5-2.5 4.5-2.5 6 0" />
        </g>
      ) : expression === 'hurt' ? (
        <g fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round">
          <path d="M38 52.5c1.5 2.5 4.5 2.5 6 0" />
          <path d="M52 52.5c1.5 2.5 4.5 2.5 6 0" />
        </g>
      ) : (
        <g fill={INK}>
          <ellipse cx="41" cy="54" rx="2.4" ry="2.9" />
          <ellipse cx="55" cy="54" rx="2.4" ry="2.9" />
        </g>
      )}

      {/* brows carry most of the expression at this size */}
      <g fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round">
        {expression === 'hurt' ? (
          <>
            <path d="M36.5 48.5 44 46" />
            <path d="M59.5 48.5 52 46" />
          </>
        ) : (
          <>
            <path d="M36.5 47.5h7" />
            <path d="M52.5 47.5h7" />
          </>
        )}
      </g>

      {/* mouth */}
      <path
        d={
          expression === 'pleased'
            ? 'M43 63c2.5 3.5 7.5 3.5 10 0'
            : expression === 'hurt'
              ? 'M43 65c2.5-3 7.5-3 10 0'
              : 'M44 64h8'
        }
        fill="none"
        stroke={INK}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
