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

import { heroFor, type Build, type Hero } from './heroes';

export type HeroExpression = 'calm' | 'pleased' | 'hurt';

const INK = '#241a10';

/** Shoulder half-width in viewBox units. */
const SHOULDER: Record<Build, number> = { slight: 26, even: 31, broad: 36 };

function Hair({ h, ink }: { h: Hero; ink: string }) {
  const hair = h.hair;
  switch (h.hairStyle) {
    case 'crop':
      return (
        <path
          d="M30 40c0-11 8-19 18-19s18 8 18 19c0-6-6-9-18-9s-18 3-18 9Z"
          fill={hair}
          stroke={ink}
          strokeWidth="2.6"
          strokeLinejoin="round"
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
          fill={hair}
          stroke={ink}
          strokeWidth="2.6"
          strokeLinejoin="round"
        />
      );

    /* A headwrap, not hair — some students cover, and an avatar set that has
       no way to show that is telling them it did not think of them.
       Which it was, in the first pass: the wrap was drawn in the *hair*
       colour, with a scooped front edge shaped exactly like a hairline, so
       what shipped was a girl with a bun and a lock in front of one ear. It
       is cloth now — the cloak's colour, from the same wardrobe — it covers
       the hairline flat instead of scooping around it, and it has folds. */
    case 'wrap':
      return (
        <g stroke={ink} strokeWidth="2.6" strokeLinejoin="round">
          <path
            d="M27.5 50c0-16.5 9-29 20.5-29s20.5 12.5 20.5 29c0-5.5-1.6-8-3.9-8.8-3.6 2.6-9.2 4-16.6 4s-13-1.4-16.6-4c-2.3.8-3.9 3.3-3.9 8.8Z"
            fill={h.cloak}
          />
          <path d="M28 50c-3 8-2 17 3 24l8-4c-4.5-6-5.5-13-3.5-19Z" fill={h.cloakShade} />
          <g fill="none" stroke={ink} strokeWidth="1.6" opacity=".5">
            <path d="M33 32c4 3 9 4.4 15 4.4s11-1.4 15-4.4" />
            <path d="M31 57c2.5 1 5 1 7.5-.4" />
          </g>
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
  style,
}: {
  hero: Hero | string;
  size?: number;
  expression?: HeroExpression;
  className?: string;
  style?: React.CSSProperties;
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
      style={style}
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
      <path
        d="M41 74h14v12h-14Z"
        fill={h.skinShade}
        stroke={INK}
        strokeWidth="2.6"
        strokeLinejoin="round"
      />

      {/* head */}
      <path
        d="M30 44c0-11 8-19 18-19s18 8 18 19v10c0 12-8 21-18 21s-18-9-18-21Z"
        fill={`url(#${id}-skin)`}
        stroke={INK}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* ears */}
      <path
        d="M30 52a4 4 0 0 0 0 8M66 52a4 4 0 0 1 0 8"
        fill={h.skin}
        stroke={INK}
        strokeWidth="2.4"
      />

      <Hair h={h} ink={INK} />

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

/* ------------------------------------------------------- the map marker */

/* Hem half-width. A build reads at 26px through silhouette or not at all. */
const HEM: Record<Build, number> = { slight: 6.4, even: 7.4, broad: 8.6 };

/* Hair, at map size, is three shapes and no more.
 *
 * A cap over the crown carries colour, a fall past the jaw carries length, and
 * curls break the outline. Six styles map onto those three, because a 26px
 * figure cannot tell locs from a braid and pretending otherwise just costs
 * paths. The cap is deliberately deep — down past the brow — since the first
 * draft used a thin crescent that its own 1px outline swallowed whole, which
 * turned every hair colour into the same dark ring and left Linden bald. */
const CAP =
  'M8.05 13.5a4.95 4.95 0 0 1 9.9 0c-.35-1.35-1.3-1.85-2.25-1.5-.8-1.05-1.75-1.6-2.7-1.6s-1.9.55-2.7 1.6c-.95-.35-1.9.15-2.25 1.5Z';
/* The same dome taken lower, and closed flat instead of with a fringe: cloth
   comes down over the brow, hair parts around it. Note the closing curve bows
   *downward*. The first version bowed up and overshot the arc it was closing,
   so the path crossed itself and filled almost nothing — Noor wore a sliver. */
const WRAP_CAP = 'M8.05 13.5a4.95 4.95 0 0 1 9.9 0c-1.15.6-2.7.95-4.95.95s-3.8-.35-4.95-.95Z';
const SIDE_FALL = 'M17.1 12.2c1.6 3.5 2 7.2 1.2 10.8l-2.6-.7c.7-3.1.4-6.3-.7-9.2Z';

/** Parchment. Drawn as a halo under the figure so a dark cloak on dark
 *  terrain still has an edge — Io's brown against the pine forest vanished
 *  outright without it. */
const RIM = '#f7edd8';

/**
 * The traveller as they appear walking the world — full length, ~26px wide.
 *
 * The map drew `hero-char.webp`, the single painted cutout, which meant the
 * avatar a student picked showed up on the profile screen and nowhere else.
 * The map is where the traveller *is*; a character choice invisible there is
 * a character choice in name only.
 *
 * This is not the portrait scaled down. At twenty-six pixels a head-and-
 * shoulders bust reads as a floating head, and the face detail that carries
 * the portrait — brows, eyes, mouth — is sub-pixel and turns to mud. What
 * survives at this size is silhouette and two colours, so that is all this
 * draws: the cloak, the hair, a skin-toned face with no features, and a hood
 * line to tell the head from the body. The identity is carried by exactly the
 * parameters that still resolve.
 */
export function TravellerMark({
  hero,
  size = 26,
  className,
  style,
}: {
  hero: Hero | string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const h = typeof hero === 'string' ? heroFor(hero) : hero;
  const hem = HEM[h.build];
  const id = `mark-${h.id}`;
  const cloak = `M${13 - hem} 37.4c-.3-8 1.4-14.5 4.2-18.6h${(hem - 4.2) * 2 + 0.4}c2.8 4.1 4.5 10.6 4.2 18.6Z`;

  /* The cap sits inside the head's own outline, so it takes half an ink line.
     A full one eats a five-unit shape down to two and turns blonde into a
     dark arc. Anything that breaks the outline keeps the full weight, or it
     reads as a smudge rather than a shape. */
  /* The wrap is cloth, so it takes the cloak's colour here too — see the
     portrait. A hooded figure whose hood matches the cloak is a stronger
     silhouette at this size than one whose hood matches nothing. */
  const cloth = h.hairStyle === 'wrap' ? h.cloak : h.hair;
  const cap = (d: string) => (
    <path d={d} fill={cloth} stroke={INK} strokeWidth=".6" strokeLinejoin="round" />
  );
  const past = (d: string) => (
    <path
      d={d}
      fill={h.hairStyle === 'wrap' ? h.cloakShade : h.hair}
      stroke={INK}
      strokeWidth="1"
      strokeLinejoin="round"
    />
  );

  return (
    <svg
      width={size}
      height={(size / 26) * 40}
      viewBox="0 0 26 40"
      className={className}
      style={style}
      role="img"
      aria-label={`${h.name}, your traveller`}
    >
      <defs>
        <linearGradient id={`${id}-cloak`} x1="0.15" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor={h.cloak} />
          <stop offset="1" stopColor={h.cloakShade} />
        </linearGradient>
      </defs>

      {/* Contact shadow. Without it the figure floats above the terrain
          instead of standing on it, which at this size is the difference
          between a character and a sticker. */}
      <ellipse cx="13" cy="37.6" rx={hem * 0.8} ry="1.7" fill="rgba(20,14,8,.42)" />

      {/* Parchment halo. The map is painted, and half of it is dark forest. */}
      <g fill="none" stroke={RIM} strokeWidth="3" strokeLinejoin="round" opacity=".5">
        <path d={cloak} />
        <circle cx="13" cy="12.6" r="5" />
      </g>

      {/* The cloak, hem to shoulder, with the sway of somebody mid-stride. */}
      <path
        d={cloak}
        fill={`url(#${id}-cloak)`}
        stroke={INK}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      {/* One fold, on the shaded side, so the cloak is not a flat wedge. */}
      <path
        d={`M14.6 20.4c1.4 4.6 2 10.4 1.8 16.6`}
        fill="none"
        stroke={h.cloakShade}
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity=".8"
      />

      {/* Face. No features on purpose — see the note above. */}
      <circle cx="13" cy="12.6" r="5" fill={h.skin} stroke={INK} strokeWidth="1.3" />

      {/* Hair — see the note by CAP. */}
      {h.hairStyle === 'wrap' ? (
        <>
          {cap(WRAP_CAP)}
          {past(SIDE_FALL)}
        </>
      ) : h.hairStyle === 'locs' || h.hairStyle === 'braid' ? (
        <>
          {cap(CAP)}
          {past(SIDE_FALL)}
        </>
      ) : h.hairStyle === 'curls' ? (
        <>
          {cap(CAP)}
          <g fill={h.hair} stroke={INK} strokeWidth="1" strokeLinejoin="round">
            <circle cx="9.5" cy="10.2" r="2.7" />
            <circle cx="13" cy="8.7" r="3.1" />
            <circle cx="16.5" cy="10.2" r="2.7" />
          </g>
        </>
      ) : (
        cap(CAP)
      )}

      {/* The hood line, which is what separates head from body at 26px. */}
      <path
        d={`M8.6 17.2c1.3 1.2 2.8 1.8 4.4 1.8s3.1-.6 4.4-1.8`}
        fill="none"
        stroke={INK}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
