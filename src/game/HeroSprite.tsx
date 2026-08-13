/* The traveller, as a pixel-art sprite.
 *
 * This replaces the drawn `TravellerMark` on the map. That mark went through
 * three passes — a cloaked figure, then one with legs and boots, then one with
 * an oversized head and a full kit of gear — and the honest read on all three
 * is that a vector figure a few dozen pixels tall is a hard brief, and it was
 * losing. Pixel art is not a decoration here: it is a medium built for exactly
 * this size, where every pixel is placed on purpose and nothing has to survive
 * being scaled down from a drawing meant to be bigger.
 *
 * The eight sprites are cut from one generated sheet by
 * `scripts/build-heroes.mjs`; `heroArt.json` is what that script writes. Sizes
 * come from the manifest rather than being hardcoded, so re-running the build
 * at a different resolution cannot leave a stale number here.
 */

import heroArt from '@/heroArt.json';
import { heroFor, type Hero } from './heroes';

type HeroArtEntry = { width: number; height: number; src: string };
const ART = heroArt as Record<string, HeroArtEntry>;

/** The width the sprite will occupy at `height`, from the same manifest the
 *  component uses. Exported so a caller can work out the traveller's footprint
 *  without waiting for him to be in the DOM and measuring him — the map needs
 *  it while he is mid-walk, when a measured rect is a frame behind the truth. */
export function heroSpriteWidth(hero: Hero | string, height: number): number {
  const h = typeof hero === 'string' ? heroFor(hero) : hero;
  const art = ART[h.id] ?? ART.ash!;
  return Math.round((art.width / art.height) * height);
}

export function HeroSprite({
  hero,
  height,
  className,
  style,
  alt,
}: {
  hero: Hero | string;
  /** Rendered height in CSS pixels. Width follows the sprite's own ratio. */
  height: number;
  className?: string;
  style?: React.CSSProperties;
  /** Omit for decoration; the map passes a real one. */
  alt?: string;
}) {
  const h = typeof hero === 'string' ? heroFor(hero) : hero;
  const art = ART[h.id] ?? ART.ash!;
  const width = heroSpriteWidth(h, height);

  return (
    <img
      src={art.src}
      width={width}
      height={height}
      alt={alt ?? ''}
      aria-hidden={alt ? undefined : true}
      decoding="async"
      draggable={false}
      className={className}
      style={{
        /* Nearest-neighbour only when the sprite is being *enlarged*.
           Upscaled with smoothing, pixel art turns to mush and stops being
           pixel art; downscaled with `pixelated` it aliases into sparkling
           noise, because dropping pixels from a hard-edged image is exactly
           the case smoothing exists for. So the rule follows the direction of
           the scale rather than picking one and living with it. */
        imageRendering: height > art.height ? 'pixelated' : 'auto',
        ...style,
      }}
    />
  );
}
