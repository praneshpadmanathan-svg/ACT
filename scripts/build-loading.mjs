/* Cut the loading-screen objects out of `art-src/loading-objects.png`, plus the
 * older single scene in `art-src/loading-scene.png`.
 *
 * Run with `npm run build:loading`. Prompts in `art-src/PROMPTS.md`.
 *
 * Nine objects rather than one, because the screen picks a different one each
 * cold start. That is the only reason quantity matters here: a loading screen
 * is seen more often than any other screen in the app and looked at less
 * carefully than any of them, so the thing it must not become is *memorised*.
 *
 * **Every sprite is padded to the same square.** The natural thing is to trim
 * each object to its ink and let the manifest carry nine different aspect
 * ratios, and it is wrong: the screen sets one CSS width, so a tall hourglass
 * and a wide rolled map would render at wildly different visual sizes, and the
 * box would jump between reloads. Fitting each into a fixed square instead
 * means one CSS rule sizes all nine identically, the reserved box never
 * changes, and a wide object simply sits shorter inside it — which is what a
 * wide object should do. The transparent margin costs almost nothing in a
 * palette PNG.
 *
 * The compass, the maps and the book covers are the things an image model is
 * most determined to cover in invented writing, which is why the prompt bans
 * text four separate ways. Worth looking at the output before shipping: fake
 * lettering survives every downscale as noise.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { findCells, loadSheet, png } from './lib/sheet.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'art-src');
const OUT = path.join(root, 'public', 'art', 'scenes');
const MANIFEST = path.join(root, 'src', 'sceneArt.json');

/** Side of the square every sprite is fitted into. Drawn at ~190 CSS px, so 2×. */
const BOX = 384;

/* Reading order, left to right along the top row then the bottom row. The
   sheet came back with exactly these eight and nothing else — the generator's
   sparkle is dropped by `findCells`'s size floor rather than by position, so
   it stays dropped if it moves. Still a table rather than a zip: the count
   matching the prompt is the exception, not something to design around. */
const SHEETS = [
  {
    file: 'loading-objects.png',
    find: { minRow: 100, minCol: 60 },
    slots: ['compass', 'lantern', 'hourglass', 'scroll', 'inkwell', 'spyglass', 'journals', 'pack'],
  },
  /* The original scene, kept in the rotation. It is a composition rather than
     an object — a lit lantern beside an open compass on a folded map — so it
     reads as different from the eight even though it shares two of their
     props. `union: true` because the lantern's glow spills onto the map and the
     whole thing is one connected mass of ink; if it ever splits into several
     regions, taking their union still crops the lot. */
  { file: 'loading-scene.png', find: { minRow: 60, minCol: 40 }, slots: ['desk'], union: true },
];

async function main() {
  await mkdir(OUT, { recursive: true });
  const objects = [];

  for (const { file, find, slots, union } of SHEETS) {
    const sheet = await loadSheet(path.join(SRC, file));
    let cells = findCells(sheet, find);
    if (!cells.length) throw new Error(`${file}: no drawing found — is the background magenta?`);

    if (union) {
      cells = [
        {
          x0: Math.min(...cells.map((c) => c.x0)),
          y0: Math.min(...cells.map((c) => c.y0)),
          x1: Math.max(...cells.map((c) => c.x1)),
          y1: Math.max(...cells.map((c) => c.y1)),
        },
      ];
    }
    console.log(`${file}  ${sheet.W}×${sheet.H}  →  ${cells.length} cell(s) for ${slots.length}`);
    if (cells.length !== slots.length) {
      throw new Error(`${file}: ${cells.length} cells but ${slots.length} slots — fix the table`);
    }

    for (const [i, id] of slots.entries()) {
      const c = cells[i];
      const w = c.x1 - c.x0 + 1;
      const h = c.y1 - c.y0 + 1;

      const buf = await png(
        sharp(sheet.keyed)
          .extract({ left: c.x0, top: c.y0, width: w, height: h })
          /* `contain` scales the longest side to BOX and pads the other with
             transparency, centred — the square in one call. lanczos going down,
             never nearest: shrinking with nearest drops pixels and eats the ink
             outline the silhouette depends on. */
          .resize({
            width: BOX,
            height: BOX,
            fit: 'contain',
            kernel: 'lanczos3',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          }),
        128,
      );

      const name = `loading-${id}.png`;
      await writeFile(path.join(OUT, name), buf);
      objects.push({ id, src: `/art/scenes/${name}` });
      console.log(`  ${id.padEnd(10)} ${w}×${h} → ${BOX}²  ${(buf.length / 1024).toFixed(1)} KB`);
    }
  }

  await writeFile(MANIFEST, `${JSON.stringify({ box: BOX, objects }, null, 2)}\n`);
  console.log(`\n${objects.length} objects → ${path.relative(root, MANIFEST)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
