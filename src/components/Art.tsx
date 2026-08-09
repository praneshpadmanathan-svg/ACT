/* Every painted image in the app, served properly.
 *
 * Before this, all five assets were plain `<img src="/art/whatever.webp">`:
 * one size for every screen, no intrinsic dimensions, no modern format and no
 * placeholder. That is four separate problems and this component fixes all of
 * them from one manifest, so nobody has to remember any of it at a call site.
 *
 *   Responsive — `srcset` carries the widths `scripts/build-art.mjs` emitted
 *   and `sizes` says how big the box will be. A phone rendering the camp
 *   backdrop pulls 23 KB instead of the 114 KB everyone used to get.
 *
 *   AVIF first — offered ahead of the original WebP through `<picture>`, so a
 *   browser that cannot decode it silently takes the file it always took.
 *
 *   No layout shift — `width` and `height` come from the manifest, which reads
 *   them off the real files. The browser reserves the correct box from the
 *   aspect ratio before any bytes arrive. `className` still controls the
 *   rendered size; these attributes only supply the ratio.
 *
 *   A placeholder — a 20-px blur, inline as a data URI, sitting behind the
 *   image. About 400 bytes, and the difference between "the page is loading"
 *   and "the page is broken" on a slow connection.
 *
 * And `art-heavy`, which is the hook reduced-data mode hangs on: with the
 * setting on, `index.css` hides everything carrying that class. The class is
 * applied here so no screen can forget it — but only to the decorative
 * paintings. The world map is `essential`: hiding it would leave a student on
 * a blank screen with thirty-seven invisible buttons, which is not a
 * data-saving mode, it is a broken app.
 */

import { cx } from '@/lib/utils';
import manifest from '@/art.json';

export type ArtName = keyof typeof manifest;

interface Variant {
  w: number;
  src: string;
}

interface Entry {
  width: number;
  height: number;
  fallback: string;
  /** Null for cut-out figures — see the note in `scripts/build-art.mjs`. */
  lqip: string | null;
  avif: Variant[];
  webp: Variant[];
}

const setFor = (variants: Variant[]) => variants.map((v) => `${v.src} ${v.w}w`).join(', ');

export function Art({
  name,
  alt = '',
  className,
  /** Maps to the `sizes` attribute. Defaults to full viewport width, which is
   *  right for the backdrops and wrong-but-harmless for the small figures. */
  sizes = '100vw',
  priority = false,
  essential = false,
  style,
  draggable = false,
}: {
  name: ArtName;
  alt?: string;
  className?: string;
  sizes?: string;
  /** Above the fold: load eagerly and hint the decoder. Everything else is
   *  lazy, because the camp backdrop on the legal page can wait. */
  priority?: boolean;
  /** Carries information rather than atmosphere, so reduced-data mode keeps
   *  it. True for exactly one asset today: the world map. */
  essential?: boolean;
  style?: React.CSSProperties;
  draggable?: boolean;
}) {
  const entry = manifest[name] as Entry;

  /* `display: contents` makes the wrapper disappear from layout, so the `<img>`
     is laid out by whatever the parent is — a flex item stays a flex item, and
     `mx-auto` on the image still centres it. Without this, swapping a bare
     `<img>` for a `<picture>` silently changes the box model at every one of
     the eleven call sites. */
  return (
    <picture className="contents">
      <source type="image/avif" srcSet={setFor(entry.avif)} sizes={sizes} />
      <source type="image/webp" srcSet={setFor(entry.webp)} sizes={sizes} />
      <img
        src={entry.fallback}
        alt={alt}
        width={entry.width}
        height={entry.height}
        loading={priority ? 'eager' : 'lazy'}
        /* React 18's DOM typings know `fetchPriority`, so nothing here needs
           suppressing. The line that used to sit above this disabled
           `react/no-unknown-property` — a rule from `eslint-plugin-react`,
           which was never installed, so for as long as it existed it was a
           comment addressed to nobody. */
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        draggable={draggable}
        className={cx(!essential && 'art-heavy', className)}
        style={{
          /* The blur sits underneath and is covered the instant the real
             image paints. `background-size: cover` rather than `100% 100%`
             so an `object-cover` image and its placeholder crop identically.
             Absent on the cut-out figures, where there is nothing to cover it
             with. */
          ...(entry.lqip
            ? {
                backgroundImage: `url("${entry.lqip}")`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : null),
          ...style,
        }}
      />
    </picture>
  );
}
