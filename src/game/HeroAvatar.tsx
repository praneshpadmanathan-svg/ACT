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

/** Parchment. Drawn as a halo under the figure so a dark cloak on dark
 *  terrain still has an edge — Io's brown against the pine forest vanished
 *  outright without it. */
const RIM = '#f7edd8';

/* One set of travelling gear, shared by all eight.
 *
 * The heroes parameterise the things a student picks themselves — skin, hair,
 * cloak. The pack, bedroll, belt, boots and staff are the world's, not the
 * character's, and eight palettes for them would only make the map noisier
 * without making anybody more recognisable.
 *
 * `build` is deliberately no longer read here. It was a hem half-width, which
 * is the one difference a figure this small cannot show: three wedge widths a
 * few tenths of a unit apart, on a shape whose own outline is thicker than the
 * difference between them. It still shapes the portrait, where there is room
 * for it to mean something. */
const WOOD = '#8a6a43';
const LEATHER = '#8a6a45';
const LEATHER_DARK = '#5f4527';
const BOOT = '#4a3524';
const BRASS = '#d9a838';
const FLAME = '#ffd97a';
const PAPER = '#e8dcbc';
const BEDROLL = '#b8563f';

/**
 * The traveller as they appear walking the world — full length, ~26px wide.
 *
 * The map drew `hero-char.webp`, the single painted cutout, which meant the
 * avatar a student picked showed up on the profile screen and nowhere else.
 * The map is where the traveller *is*; a character choice invisible there is
 * a character choice in name only.
 *
 * This is not the portrait scaled down — a head-and-shoulders bust at this
 * size reads as a floating head. But the first version of this mark cut too
 * far the other way. Reasoning that face detail goes sub-pixel at 26px, it
 * drew only a cloak, hair, and a blank skin-toned oval: a green cone with an
 * egg on top. It was not a traveller, it was a chess pawn, and it replaced a
 * painted character who had a face, a pack, boots and a walking staff.
 *
 * Two things were wrong with that reasoning. The mark is inside the map's
 * transformed layer, so it is never actually 26 CSS pixels on screen — it is
 * 43 at the default zoom and up to 88 zoomed in, which is ample for eyes. And
 * "what survives at small size" is silhouette, which is an argument *for* the
 * staff and the boots, not against them: the staff is the one shape that
 * breaks the outline and says at a glance that this figure is walking
 * somewhere.
 *
 * So it draws a person: staff, tunic, legs, boots, satchel, and two eyes. The
 * eight heroes still differ only in the parameters a student chose — skin,
 * hair, cloak, build — and everything else is shared gear. Checked by
 * rendering all eight at 26, 44 and 88 pixels before it shipped.
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
  const id = `mark-${h.id}`;

  /* The head is the anchor of the whole drawing: r 7.2 on a 26-wide box, so it
     is a bit over half the figure's width. That is deliberately out of human
     proportion. A correctly-proportioned figure spends most of its height on a
     body, and a body at map size is a coloured wedge — the face, which is the
     only part that carries who this person is, ends up too small to survive.
     Oversizing the head puts the pixels where the character lives. */
  const HEAD_Y = 12.4;
  const HEAD_R = 7.2;

  /* Short torso under the big head. The hem bows out at the end of the path so
     it does not close on a flat line, which reads as the base of a cone. */
  const tunic =
    'M6.9 31.4c-.3-5.2 1.2-8.8 3.4-10.2h5.4c2.2 1.4 3.7 5 3.4 10.2q-3.1 1.2-6.1 1.2t-6.1-1.2Z';

  /* Drawn as a dark stroke with a lighter one on top rather than as an
     outlined shape: a 1-unit-wide path with a 1-unit outline has no inside. */
  const STAFF = 'M21.2 8.4 20.4 36.2';

  /* Hair, and the reason each style is drawn differently.

     The first pass gave every style the same cap: the head's own top half,
     edge to edge. Its outline was therefore exactly the head's outline, the
     two heavy ink strokes stacked, and what you saw was not hair but a dark
     ring — every hero looked like they were wearing a hood. These sit inside
     the head and stop above the brow, so the hair has a shape of its own and
     there is forehead between it and the eyes. */
  const hair =
    h.hairStyle === 'wrap' ? (
      <>
        <path
          d="M5.9 11.9a7.2 7.2 0 0 1 14.2 0c-1.7.9-4 1.4-7.1 1.4s-5.4-.5-7.1-1.4Z"
          fill={h.cloak}
          stroke={INK}
          strokeWidth=".7"
          strokeLinejoin="round"
        />
        <path
          d="M19.4 10.8c1.9 3.6 2.4 7.3 1.5 11l-2.9-.8c.8-3.2.4-6.4-.9-9.3Z"
          fill={h.cloakShade}
          stroke={INK}
          strokeWidth=".9"
          strokeLinejoin="round"
        />
      </>
    ) : h.hairStyle === 'curls' ? (
      <>
        <path
          d="M5.9 12.1a7.2 7.2 0 0 1 14.2 0c-.5-2-1.8-2.6-3.2-2.1-1.2-1.5-2.5-2.2-3.9-2.2s-2.7.7-3.9 2.2c-1.4-.5-2.7.1-3.2 2.1Z"
          fill={h.hair}
          stroke={INK}
          strokeWidth=".7"
          strokeLinejoin="round"
        />
        <g fill={h.hair} stroke={INK} strokeWidth=".85" strokeLinejoin="round">
          <circle cx="8.2" cy="7.9" r="2.5" />
          <circle cx="13" cy="6.4" r="2.9" />
          <circle cx="17.8" cy="7.9" r="2.5" />
        </g>
      </>
    ) : h.hairStyle === 'locs' || h.hairStyle === 'braid' ? (
      <>
        <path
          d="M5.9 12.1a7.2 7.2 0 0 1 14.2 0c-.5-2-1.8-2.6-3.2-2.1-1.2-1.5-2.5-2.2-3.9-2.2s-2.7.7-3.9 2.2c-1.4-.5-2.7.1-3.2 2.1Z"
          fill={h.hair}
          stroke={INK}
          strokeWidth=".7"
          strokeLinejoin="round"
        />
        <g stroke={h.hair} strokeWidth="1.5" strokeLinecap="round" fill="none">
          <path d="M6.4 11.6 5.2 17.4" />
          <path d="M19.6 11.6 20.8 17.4" />
        </g>
      </>
    ) : (
      <path
        d="M6.1 11a7.2 7.2 0 0 1 13.8 0c-.75-1.2-1.85-1.35-2.9-.6-1.15-1.75-2.5-2.6-3.9-2.6-2.35 0-4.2 1.5-5.1 4-.4-.7-1.1-1-1.9-.8Z"
        fill={h.hair}
        stroke={INK}
        strokeWidth=".75"
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
      <ellipse cx="13" cy="37.2" rx="6.6" ry="1.7" fill="rgba(20,14,8,.42)" />

      {/* One parchment halo over the whole silhouette. The map is painted, and
          half of it is dark forest — a dark cloak has nothing to separate
          against without this. */}
      <g
        fill="none"
        stroke={RIM}
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity=".55"
      >
        <circle cx="13" cy={HEAD_Y} r={HEAD_R} />
        <path d={tunic} />
        <rect x="9.3" y="29.6" width="3.3" height="6.4" rx="1.4" />
        <rect x="13.4" y="29.6" width="3.3" height="6.4" rx="1.4" />
        <path d={STAFF} />
        <rect x="4.2" y="19.4" width="4.6" height="6.2" rx="1.5" />
      </g>

      {/* The pack, behind the body: a bedroll strapped across it and a rolled
          scroll poking out of the top. */}
      <path d="M6.2 19.2h2.4" stroke={PAPER} strokeWidth="2.1" strokeLinecap="round" />
      <rect
        x="4.2"
        y="19.4"
        width="4.6"
        height="6.2"
        rx="1.5"
        fill={LEATHER}
        stroke={INK}
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <rect
        x="3.7"
        y="20.8"
        width="5.6"
        height="1.9"
        rx=".8"
        fill={BEDROLL}
        stroke={INK}
        strokeWidth=".9"
        strokeLinejoin="round"
      />

      {/* The staff, behind the hand that holds it.

          Its head is a lit lamp rather than a carved knob. A lantern used to
          hang off a bracket out to the right; at 44px it was a loose yellow
          speck floating clear of the silhouette and read as a rendering fault
          rather than a lamp. The light works far better as part of the shape
          it belongs to, and it is the one warm accent on a figure that is
          otherwise all cloth and leather. */}
      <path d={STAFF} stroke={INK} strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d={STAFF} stroke={WOOD} strokeWidth="1.15" strokeLinecap="round" fill="none" />
      <circle cx="21.3" cy="7.9" r="2.15" fill={FLAME} opacity=".38" />
      <circle cx="21.3" cy="7.9" r="1.05" fill={FLAME} stroke={INK} strokeWidth=".75" />

      {/* Legs and boots, then the tunic over the top of them. */}
      <rect
        x="9.3"
        y="29.6"
        width="3.3"
        height="6.4"
        rx="1.4"
        fill={BOOT}
        stroke={INK}
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <rect
        x="13.4"
        y="29.6"
        width="3.3"
        height="6.4"
        rx="1.4"
        fill={BOOT}
        stroke={INK}
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {/* Cuff lines: without them the two boots merge into one dark bar. */}
      <path d="M9.3 31.6h3.3M13.4 31.6h3.3" stroke={LEATHER_DARK} strokeWidth=".8" fill="none" />

      <path
        d={tunic}
        fill={`url(#${id}-cloak)`}
        stroke={INK}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {/* One fold, on the shaded side, so the tunic is not a flat wedge. */}
      <path
        d="M13.6 21.8c1 2.6 1.4 5.4 1.2 8"
        fill="none"
        stroke={h.cloakShade}
        strokeWidth=".9"
        strokeLinecap="round"
        opacity=".7"
      />

      {/* Belt, buckle, hip pouch, and the strap that explains the pack. */}
      <path d="M7.4 26.9q5.6 1.5 11.2 0" fill="none" stroke={LEATHER_DARK} strokeWidth="1.5" />
      <path
        d="M7.4 26.9q5.6 1.5 11.2 0"
        fill="none"
        stroke={INK}
        strokeWidth=".5"
        opacity=".55"
      />
      <rect x="11.9" y="26" width="2.2" height="2" rx=".5" fill={BRASS} stroke={INK} strokeWidth=".7" />
      <rect
        x="16.4"
        y="26.6"
        width="2.6"
        height="2.6"
        rx=".6"
        fill={LEATHER}
        stroke={INK}
        strokeWidth=".85"
        strokeLinejoin="round"
      />
      <path
        d="M9.6 20.9 8 24.6"
        stroke={LEATHER_DARK}
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
      />

      {/* The near arm, reaching the staff. This is the line that says walking
          rather than standing. */}
      <path
        d="M16.6 22.4c1.6.7 2.6 1.8 3 3.2"
        fill="none"
        stroke={INK}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M16.6 22.4c1.6.7 2.6 1.8 3 3.2"
        fill="none"
        stroke={h.cloak}
        strokeWidth="1.55"
        strokeLinecap="round"
      />
      <circle cx="19.8" cy="25.9" r="1.15" fill={h.skin} stroke={INK} strokeWidth=".8" />

      {/* Face. */}
      <circle cx="13" cy={HEAD_Y} r={HEAD_R} fill={h.skin} stroke={INK} strokeWidth="1.4" />
      <path
        d="M7.6 16c1.3 2.1 3.2 3.2 5.4 3.2s4.1-1.1 5.4-3.2"
        fill="none"
        stroke={h.skinShade}
        strokeWidth=".9"
        opacity=".65"
      />

      {hair}

      {/* Eyes, drawn after the hair so a deep fringe cannot bury them. The
          head is big enough here to carry a highlight and a mouth, which is
          the whole reason for making it big. */}
      <g fill={INK}>
        <circle cx="10.7" cy="13.8" r=".95" />
        <circle cx="15.3" cy="13.8" r=".95" />
      </g>
      <g fill="#fff" opacity=".85">
        <circle cx="10.98" cy="13.5" r=".3" />
        <circle cx="15.58" cy="13.5" r=".3" />
      </g>
      <path
        d="M11.7 16.5c.85.65 1.75.65 2.6 0"
        fill="none"
        stroke={INK}
        strokeWidth=".8"
        strokeLinecap="round"
      />
      <g fill="#e08b7a" opacity=".45">
        <ellipse cx="8.7" cy="15.4" rx="1.2" ry=".85" />
        <ellipse cx="17.3" cy="15.4" rx="1.2" ry=".85" />
      </g>

      {/* Cloak clasp at the throat — what separates head from body. */}
      <circle cx="13" cy="20.4" r=".95" fill={BRASS} stroke={INK} strokeWidth=".7" />
    </svg>
  );
}
