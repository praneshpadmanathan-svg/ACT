/* Crop the four loading backdrops out of `art-src/scene-*.png` and drop them
 * into `public/art/` for `build-art.mjs` to pick up.
 *
 * Run with `npm run build:scenes`, then `npm run build:art`. Prompts in
 * `art-src/PROMPTS.md`.
 *
 * This is the only sheet in the project with **no magenta and no keying**. The
 * whole image is the asset — there is nothing to cut out of it — so all this
 * does is remove the generator's signature and re-encode.
 *
 * **The crop is asymmetric on purpose.** The sparkle sits in the bottom-right
 * corner, starting around x=940 of 1024 with a 33 px margin. Taking it off the
 * right and bottom only costs 96 px twice; taking it off symmetrically to keep
 * the exact centre would cost 96 px *four* times, and these are 1024 px
 * originals being stretched over a full screen — there is no spare resolution
 * to spend on tidiness. Moving the optical centre 48 px in a 928 px frame is
 * 5%, which is well inside the slop `object-cover` introduces anyway. What is
 * lost is the bottom and right edge, which in all four paintings is foreground
 * grass, rock or water: the cheapest content in the frame.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'art-src');
const OUT = path.join(root, 'public', 'art');

const SCENES = ['scene-ridge', 'scene-river', 'scene-pass', 'scene-harbour'];

/** Pixels taken off the right and bottom edges. See the note above. */
const TRIM = 96;

/** The sparkle's bounding box, as measured on the sources. Nothing may survive
 *  inside it — the whole point of the trim — so the script asserts rather than
 *  trusting that the generator put its mark where it did last time. */
const MARK = { x: 934, y: 934 };

async function main() {
  await mkdir(OUT, { recursive: true });

  for (const name of SCENES) {
    const abs = path.join(SRC, `${name}.png`);
    const { width, height } = await sharp(abs).metadata();

    const w = width - TRIM;
    const h = height - TRIM;
    if (w > MARK.x || h > MARK.y) {
      throw new Error(
        `${name}: crop to ${w}×${h} leaves the generator mark at ${MARK.x},${MARK.y} in frame`,
      );
    }

    /* WebP because that is what `build-art.mjs` reads.

       Quality 82 rather than the 92 a *source* file wants, because this one is
       not only a source: it is also the `<img src>` fallback and the offline
       fallback, so it is precached on every installed device. Measured across
       all four — 92 costs 484 KB of everyone's storage and 88 costs 364 KB,
       against 271 KB here, and the 768-px AVIF set those three produce differs
       by 3 KB in total. Generation loss is theoretical on painted, low-
       frequency art that ships under a 72%-black scrim; 213 KB of a student's
       phone is not. */
    const buf = await sharp(abs)
      .extract({ left: 0, top: 0, width: w, height: h })
      .webp({ quality: 82, effort: 6 })
      .toBuffer();

    await writeFile(path.join(OUT, `${name}.webp`), buf);
    console.log(
      `  ${name.padEnd(15)} ${width}×${height} → ${w}×${h}  ${(buf.length / 1024).toFixed(0)} KB`,
    );
  }

  console.log(`\n${SCENES.length} backdrops written. Now run \`npm run build:art\`.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
