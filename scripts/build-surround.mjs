/* The world map's surround — the sea and far coast the map floats in.
 *
 * Two modes, because the interesting half of this job happens outside the repo:
 *
 *   npm run build:surround -- --canvas
 *     Writes `art-src/surround-canvas.png`: `world-map.webp` centred on a
 *     1152x2048 field of flat grey. That file is the *input* to the image
 *     model. Hand it over with the prompt in `art-src/PROMPTS.md` (Sheet 7).
 *
 *   npm run build:surround
 *     Takes the model's answer back — `art-src/surround.png` — and writes
 *     `public/art/world-surround.webp`, with the grey margin's contents kept
 *     and the middle thrown away.
 *
 * **Why a padded canvas rather than four separate panels.** The map has been
 * extended twice before and the extension was thrown away both times, for the
 * same reason each time: the new art came back at roughly four times fewer
 * metres per pixel, so the map's village read as the size of the new art's
 * mountain range. `art-src/PROMPTS.md` Sheet 4 has the measurement. Both
 * attempts asked a text prompt to paint "what is off the edges" and left scale
 * to the model. Putting the map *inside the frame the model is painting* takes
 * scale off the table — it is no longer something to describe, it is something
 * visible in the input at the exact pixels it has to match.
 *
 * **Why the middle is thrown away.** The model returns a whole new image, not a
 * patch: the map area comes back repainted, resampled and subtly wrong. Nothing
 * it draws inside the map's rectangle is ever used. `world-map.webp` is
 * composited over its own footprint at runtime, at its own resolution, pristine
 * — so the model is only ever supplying the surround, and the only thing that
 * can be wrong with the result is the surround.
 *
 * That leaves one seam, where the map's rectangular edge meets the painting
 * behind it, and `MapLayers` dissolves it with a mask rather than matching it.
 * A hard rectangle is the one thing that would read as two pictures.
 */

import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'art-src');
const OUT = path.join(root, 'public', 'art');

/** Intrinsic size of `world-map.webp`. Kept here rather than imported from
 *  `src/game/mapData.ts` because this is a plain Node script and that file is
 *  TypeScript — asserted against the real image below instead, which is the
 *  check that actually matters. */
const MAP_W = 768;
const MAP_H = 1376;

/* 1.5x the map, to the nearest size the generator will actually return.
 *
 * 9:16 at "2K" comes back about 1152x2048. Exactly 1.5x would be 1152x2064 —
 * sixteen pixels taller — and chasing that would mean either upscaling the
 * answer or cropping sixteen pixels off the far sea. Neither is worth doing:
 * the surround is a backdrop behind an opaque map, so a 0.8% difference between
 * the horizontal and vertical margin is not a thing anyone can see. The margin
 * is what matters and it is 192px on each side, 336px top and bottom. */
const CANVAS_W = 1152;
const CANVAS_H = 2048;

/** Flat mid-grey, deliberately not a colour in the painting.
 *
 *  Filling the margin with parchment cream would have been the obvious choice
 *  and is the wrong one: it is a colour the map already uses, so "leave the
 *  paper blank" becomes a valid reading of the input and the model takes it.
 *  Grey appears nowhere in an atlas plate of forest, rock, sand and sea, so
 *  there is exactly one thing it can mean. */
const FILL = { r: 128, g: 128, b: 128, alpha: 1 };

const mapPath = path.join(OUT, 'world-map.webp');
const left = Math.round((CANVAS_W - MAP_W) / 2);
const top = Math.round((CANVAS_H - MAP_H) / 2);

async function canvas() {
  const map = sharp(mapPath);
  const meta = await map.metadata();
  if (meta.width !== MAP_W || meta.height !== MAP_H) {
    throw new Error(
      `world-map.webp is ${meta.width}x${meta.height}, expected ${MAP_W}x${MAP_H}. ` +
        'Update MAP_W/MAP_H here and in src/game/mapData.ts together, or every ' +
        'percentage coordinate in the game is now pointing at the wrong place.',
    );
  }

  const out = path.join(SRC, 'surround-canvas.png');
  await mkdir(SRC, { recursive: true });
  await sharp({
    create: { width: CANVAS_W, height: CANVAS_H, channels: 4, background: FILL },
  })
    .composite([{ input: await map.png().toBuffer(), left, top }])
    .png()
    .toFile(out);

  console.log(`  ${path.relative(root, out)}  ${CANVAS_W}x${CANVAS_H}`);
  console.log(`  map placed at ${left},${top} — margin ${left}px sides, ${top}px top/bottom`);
  console.log('\n  Hand this to the image model with Sheet 7 of art-src/PROMPTS.md.');
  console.log('  Save what comes back as art-src/surround.png, then run without --canvas.');
}

async function assemble() {
  const src = path.join(SRC, 'surround.png');
  const img = sharp(src);
  const meta = await img.metadata();

  /* The generator is allowed to hand back any size it likes as long as the
     shape is right — 1K, 2K and 4K of the same aspect are all usable, and
     refusing 2044px because it is not 2048 would be pedantry. What is not
     usable is a different aspect ratio, because then the map's footprint is
     somewhere other than where this script is about to assume it is. */
  const aspect = meta.width / meta.height;
  const want = CANVAS_W / CANVAS_H;
  if (Math.abs(aspect - want) > 0.01) {
    throw new Error(
      `surround.png is ${meta.width}x${meta.height} (aspect ${aspect.toFixed(3)}), ` +
        `expected ${want.toFixed(3)}. Regenerate at 9:16 — a different shape puts ` +
        "the map's footprint somewhere other than the centre and the whole join moves.",
    );
  }

  await mkdir(OUT, { recursive: true });
  const out = path.join(OUT, 'world-surround.webp');
  await img.resize(CANVAS_W, CANVAS_H, { fit: 'fill' }).webp({ quality: 78 }).toFile(out);

  const { size } = await stat(out);
  console.log(
    `  ${path.relative(root, out)}  ${CANVAS_W}x${CANVAS_H}  ${Math.round(size / 1024)} KB`,
  );
}

const mode = process.argv.includes('--canvas') ? canvas : assemble;
await mode();
