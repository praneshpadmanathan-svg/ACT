/* Seven ranks, seven emblems — now generated pixel art rather than SVG.
 *
 * What was here before: seven hand-written SVG silhouettes, built because the
 * badge used to be one shield path recoloured seven times and *"seven ranks
 * should look like seven achievements, not one badge with a palette swap."*
 * That reasoning still holds; the SVGs were only ever the cheapest way to
 * satisfy it, and they were drawn against an earlier, softer version of the
 * ladder — a book plaque, a laurel wreath, a crowned sun.
 *
 * They are replaced by a sliced generated sheet: `art-src/ranks-sheet.png`,
 * cut by `scripts/build-ranks.mjs`, prompt and reasoning in
 * `art-src/PROMPTS.md`. Each emblem is a scholar's object rendered as game
 * loot, which is the same escalation argument the SVGs were making, made
 * better than a path can make it.
 *
 * Three things carried over deliberately:
 *
 *   - **Keyed by `Rank.id`, never by display name.** The ladder has been
 *     renamed three times; every rename would have silently dropped all seven
 *     badges to a fallback if the art were keyed on copy.
 *   - **A fallback for an unknown id.** A rank could be added tomorrow, and an
 *     empty badge is worse than a generic one.
 *   - **Uniform footprint, non-uniform emblem.** Every sprite is centred on the
 *     same square canvas so a rank list does not jitter as it descends, but the
 *     emblems inside are at a single shared scale, so Inkling's cracked pot is
 *     genuinely smaller than Sagecrown's crown. That size difference is the
 *     ladder, visible standing still.
 *
 * The one thing SVG did better is small sizes: a path stays crisp at 26px in
 * the map HUD, and downscaled pixel art goes soft. Native size is 192, so
 * every use below 96 is a downscale — hence `imageRendering` switching on that
 * boundary rather than being set to `pixelated` unconditionally, which is the
 * usual reflex and is exactly wrong on the way down: nearest-neighbour
 * *discards* pixels when shrinking, and on art this dense it eats the outline
 * that makes the silhouette readable in the first place.
 */

import { useId } from 'react';
import rankArt from '@/rankArt.json';
import { Glyph, type IconName } from './Icon';
import { RankAura, hasAura } from './RankAura';

type ArtEntry = { width: number; height: number; src: string };
const ART = rankArt as Record<string, ArtEntry>;

export interface SigilColors {
  /** Which emblem to draw. Stable across renames — see `Rank.id`. */
  id: string;
  /** What to call it, for the label. Copy, not a key. */
  name: string;
  /** The rank's own colour, used for the glow behind the emblem. */
  color: string;
  c1: string;
  c2: string;
  ring: string;
}

/** Below this, the emblem is a small icon in a list and a particle field would
 *  be both illegible and wasteful — seven live canvases to decorate seven
 *  38px thumbnails. Above it, the badge is the subject of the screen. */
const AURA_FROM = 64;

export function RankSigil({
  rank,
  size = 56,
  aura,
}: {
  rank: SigilColors;
  size?: number;
  /** Defaults to on at `AURA_FROM` and up. Pass `false` to force it off. */
  aura?: boolean;
}) {
  const art = ART[rank.id] ?? ART.inkling;
  const live = (aura ?? size >= AURA_FROM) && hasAura(rank.id);

  if (!art) return null;

  return (
    <span
      className="relative inline-flex flex-none items-center justify-center"
      style={{ width: size, height: size }}
    >
      {live && <RankAura rankId={rank.id} size={size} />}
      <img
        src={art.src}
        width={size}
        height={size}
        /* The native mechanism, not `role="img"` + `aria-label`. The SVG this
           replaced needed those because an `<svg>` has no `alt`. */
        alt={`${rank.name} rank`}
        decoding="async"
        draggable={false}
        className="relative select-none"
        style={{
          imageRendering: size > art.width ? 'pixelated' : 'auto',
          /* Two shadows doing different jobs: a tight dark one to seat the
             emblem on the page, and a wide one in the rank's own colour so the
             badge throws a little light of its own even when the aura is off. */
          filter: `drop-shadow(0 2px 3px rgba(0,0,0,.45)) drop-shadow(0 0 ${Math.round(
            size * 0.12,
          )}px ${rank.color}55)`,
        }}
      />
    </span>
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
