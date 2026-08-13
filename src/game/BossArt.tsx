/* The four guardians — now generated pixel art rather than procedural SVG.
 *
 * What was here: ~470 lines of hand-written SVG per boss, with gradients, a
 * shared `feTurbulence` grain, a soft ground shadow and two-pass ink. It was
 * careful work and it was the weakest art in the app by a distance, for a
 * reason no amount of path-tuning fixes: a guardian is the largest single
 * figure a student ever sees, shown alone on a duel screen, and vector shapes
 * assembled into a monster read as a diagram of a monster.
 *
 * They are replaced by four generated frames, cut by `scripts/build-bosses.mjs`
 * — prompts and reasoning in `art-src/PROMPTS.md`.
 *
 * Four things carried over deliberately:
 *
 *   - **The exported surface is unchanged.** `BossArt({ section, state,
 *     className })` and `BossState` are what nine call sites already pass. A
 *     new art pipeline is not a reason to touch the duel screen.
 *   - **The same four state animations.** `animate-bossIdle` / `bossHurt` /
 *     `bossLunge` / `bossDown` already exist in `index.css` and already express
 *     this game's sense of weight. They apply to an `<img>` exactly as they
 *     applied to an `<svg>`, so the choreography survives the change of medium
 *     with no new CSS at all.
 *   - **The 200×220 box.** The old SVG had that viewBox and every call site is
 *     laid out around it. The generated figures have four different aspects
 *     (the crusher is wide, the leviathan tall), so they are contained inside
 *     the original box rather than driving it. Nothing above them moves.
 *   - **Keyed by `SectionId`.** Same as before, and the same reason the ranks
 *     are keyed by id: these ids are what the map plaque, the seal and the duel
 *     all agree on, while the guardians' names are copy that can change.
 *
 * The colours in `bosses.ts` still drive the duel's glow and hit flashes, and
 * each prompt carried its boss's colour so the art agrees with them.
 */

import bossArt from '@/bossArt.json';
import { cx } from '@/lib/utils';
import type { SectionId } from '@/types';

export type BossState = 'idle' | 'hurt' | 'attacking' | 'defeated';

interface Props {
  section: SectionId;
  state: BossState;
  className?: string;
}

type ArtEntry = { width: number; height: number; src: string };
const ART = bossArt as Record<string, ArtEntry>;

/** What each guardian is, for a screen reader meeting it in a duel. The duel
 *  announces the name in text beside this, so these describe the *figure* —
 *  saying the name twice would be noise. */
const DESCRIPTION: Record<SectionId, string> = {
  english: 'An armoured warden in gold and brass, carrying a tower shield and a chained ledger.',
  reading: 'A moss-covered forest giant of bark and stone, with many pale eyes.',
  math: 'A massive desert tyrant of sun-baked stone and bronze, sand pouring from its shoulders.',
  science: 'A deep-sea leviathan in cold blue and steel, glass vials fused into its hide.',
};

export function BossArt({ section, state, className }: Props) {
  const art = ART[section] ?? ART.english;
  if (!art) return null;

  return (
    <div className={className}>
      <img
        src={art.src}
        alt={DESCRIPTION[section] ?? ''}
        decoding="async"
        draggable={false}
        className={cx(
          /* The box the old viewBox described, kept so no caller's layout
             shifts, with each figure contained inside its own aspect. */
          'w-full select-none object-contain [aspect-ratio:200/220]',
          state === 'idle' && 'animate-bossIdle',
          state === 'hurt' && 'animate-bossHurt',
          state === 'attacking' && 'animate-bossLunge',
          state === 'defeated' && 'animate-bossDown',
        )}
        style={{
          /* Native is 512 on the long side and the largest draw is ~260, so
             this is always a downscale — `pixelated` would be exactly wrong
             here, discarding pixels and eating the ink outline that makes the
             silhouette readable. Smoothing is what a shrink wants.

             The drop shadow replaces the SVG's painted ground shadow: it
             follows the actual silhouette, which a hand-placed ellipse never
             quite did. */
          filter: 'drop-shadow(0 6px 10px rgba(0,0,0,.55))',
        }}
      />
    </div>
  );
}
