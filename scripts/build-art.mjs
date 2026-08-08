/* Turn five hand-painted WebPs into a responsive, CLS-free, low-bandwidth
 * image set — and write down what it produced so the app can use it without
 * anybody hardcoding a pixel dimension again.
 *
 * The problem this solves, in order of how much it costs a student:
 *
 *   1. `world-map.webp` is 290 KB and was served at that size to a phone
 *      rendering it 360 px wide. On a school 4G connection that is most of a
 *      second of nothing. Now every asset ships at the widths it is actually
 *      displayed at, and the browser picks.
 *
 *   2. Nothing declared an intrinsic size, so every screen with art on it
 *      jumped when the art landed. `art.json` carries real width and height
 *      for each asset and `<Art>` puts them on the tag, which reserves the box
 *      before a single byte of image arrives.
 *
 *   3. AVIF is roughly half the bytes of WebP at the same quality on this kind
 *      of painted, low-frequency artwork. `<picture>` offers it first and
 *      falls back to the WebP that was already there, so a browser that cannot
 *      decode AVIF is no worse off than before.
 *
 *   4. A 20-px-wide blur, inlined as a data URI, gives the shape and the
 *      colour of the picture immediately — so the page is never a grey hole
 *      waiting for a download.
 *
 * Run with `npm run build:art`. Deliberately NOT part of `npm run build`: it
 * is slow, it is deterministic, and its outputs are committed. Re-run it when
 * an asset in `public/art/` changes.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'public', 'art');
const OUT = path.join(root, 'public', 'art', 'gen');
const MANIFEST = path.join(root, 'src', 'art.json');

/* The widths each asset is actually rendered at, largest first. There is no
   point emitting a 1600 px hero for a picture whose CSS box never exceeds
   1024, and no point emitting a 320 px one for the map, which is pannable and
   is zoomed into. Measured from the components, not guessed. */
const WIDTHS = {
  'world-map': [768, 1152, 1536],
  'camp-bg': [640, 1024, 1376],
  'landing-hero': [512, 768, 1024],
  'hero-char': [173, 346],
  wizzy: [235, 470],
};

const AVIF = { quality: 52, effort: 6, chromaSubsampling: '4:2:0' };
const WEBP = { quality: 80, effort: 6 };

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

async function main() {
  await mkdir(OUT, { recursive: true });

  const sources = readdirSync(SRC).filter((f) => f.endsWith('.webp'));
  const manifest = {};
  let before = 0;
  let after = 0;

  for (const file of sources) {
    const name = path.basename(file, '.webp');
    const abs = path.join(SRC, file);
    const image = sharp(abs);
    const meta = await image.metadata();
    before += statSync(abs).size;

    /* Never upscale. A 346-px-wide source asked for at 692 would be a blurry
       file that is bigger than the sharp one — the worst of both. */
    const widths = (WIDTHS[name] ?? [meta.width]).filter((w) => w <= meta.width);
    if (!widths.length) widths.push(meta.width);

    const variants = { avif: [], webp: [] };

    for (const width of widths) {
      const resized = () => sharp(abs).resize({ width, withoutEnlargement: true });

      const avifName = `${name}-${width}.avif`;
      const webpName = `${name}-${width}.webp`;
      const avifBuf = await resized().avif(AVIF).toBuffer();
      const webpBuf = await resized().webp(WEBP).toBuffer();

      await writeFile(path.join(OUT, avifName), avifBuf);
      await writeFile(path.join(OUT, webpName), webpBuf);

      variants.avif.push({ w: width, src: `/art/gen/${avifName}` });
      variants.webp.push({ w: width, src: `/art/gen/${webpName}` });
      after += avifBuf.length;

      console.log(
        `  ${avifName.padEnd(26)} ${kb(avifBuf.length).padStart(7)}` +
          `   (webp ${kb(webpBuf.length)})`,
      );
    }

    /* The placeholder. Twenty pixels wide, blurred, as a data URI — about
       400 bytes, which is cheaper than the HTTP request it replaces. It is
       stretched to the full box by CSS, so the blur does the rest.

       Only for opaque assets. A blurred rectangle painted behind a cut-out
       figure like Wizzy is not a placeholder, it is a permanent grey box he
       stands on: the transparent pixels never get covered, so the background
       shows through forever rather than for 200ms. `stats().isOpaque` is the
       real test rather than `metadata().hasAlpha` — a file can carry an alpha
       channel that is entirely 255. */
    const { isOpaque } = await sharp(abs).stats();
    const lqip = isOpaque
      ? `data:image/webp;base64,${(
          await sharp(abs).resize({ width: 20 }).blur(1.4).webp({ quality: 40 }).toBuffer()
        ).toString('base64')}`
      : null;

    manifest[name] = {
      width: meta.width,
      height: meta.height,
      /* The original, kept as the `<img src>` so the tag is valid and useful
         on its own even if every `srcset` candidate somehow fails. */
      fallback: `/art/${file}`,
      lqip,
      ...variants,
    };
  }

  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(
    `\n${sources.length} assets → ${Object.values(manifest).reduce((n, m) => n + m.avif.length, 0)} AVIF + ` +
      `as many WebP.\nOriginals ${kb(before)} → AVIF set ${kb(after)}.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
