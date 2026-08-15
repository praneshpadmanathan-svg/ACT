/* Cut the map props out of `art-src/props-sheet.png`.
 *
 * Run with `npm run build:props`. Prompt in `art-src/PROMPTS.md`.
 *
 * **One shared scale, not one per prop.** Every other slicer here fits each
 * cell to its own box, which is right when the sprites are never seen together
 * — a guardian fills a duel screen alone, a loading object is the only thing on
 * its screen. These are the opposite case: they get scattered across one map in
 * view of each other, so their *relative* sizes are the whole point. Fitting
 * each to its own box would make the three-rock cluster the same size as the
 * broadleaf tree, and a boulder as tall as an oak is not a map, it is a
 * collage. So the tallest prop sets the scale and everything else is measured
 * against it, exactly as `build-foliage.mjs` does for the leaves.
 *
 * The sheet arrives with cast shadows painted under six of the nine, in a
 * darker magenta than the background. They key out with everything else —
 * `isMagenta` tests the property rather than a sampled colour, and rgb(148,22,
 * 121) passes it as readily as rgb(245,12,235) — which is the outcome we want.
 * A shadow baked into the sprite would be lit from one fixed direction and
 * painted onto whatever terrain the prop lands on; the map draws its own.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { findCells, loadSheet, png } from './lib/sheet.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHEET = path.join(root, 'art-src', 'props-sheet.png');
const OUT = path.join(root, 'public', 'art', 'props');
const MANIFEST = path.join(root, 'src', 'propArt.json');

/** Longest side of the *tallest* prop. Everything else comes out smaller in
 *  proportion. The pine is the tallest at 310 px on the sheet. */
const MAX = 192;

/** Reading order: top row left to right, then the bottom row. */
const SLOTS = [
  'tree-broadleaf',
  'tree-pine',
  'tree-dead',
  'boulder',
  'rocks',
  'arch',
  'waystone',
  'tent',
  'signpost',
];

async function main() {
  await mkdir(OUT, { recursive: true });

  const sheet = await loadSheet(SHEET);
  const cells = findCells(sheet, { minRow: 100, minCol: 60 });
  console.log(`sheet ${sheet.W}×${sheet.H}  →  ${cells.length} cells for ${SLOTS.length} slots`);
  if (cells.length !== SLOTS.length) {
    throw new Error(`${cells.length} cells but ${SLOTS.length} slots — fix the table`);
  }

  const scale = MAX / Math.max(...cells.map((c) => Math.max(c.w, c.h)));
  const manifest = {};

  for (const [i, id] of SLOTS.entries()) {
    const c = cells[i];
    const width = Math.max(1, Math.round(c.w * scale));
    const height = Math.max(1, Math.round(c.h * scale));

    const buf = await png(
      sharp(sheet.keyed)
        .extract({ left: c.x0, top: c.y0, width: c.w, height: c.h })
        /* lanczos going down. Nearest is for upscaling only: shrinking with it
           discards pixels and eats the dark ink outline these silhouettes are
           entirely made of. */
        .resize({ width, height, kernel: 'lanczos3' }),
      64,
    );

    await writeFile(path.join(OUT, `${id}.png`), buf);
    manifest[id] = { width, height, src: `/art/props/${id}.png` };
    console.log(
      `  ${id.padEnd(15)} ${c.w}×${c.h} → ${width}×${height}  ${(buf.length / 1024).toFixed(1)} KB`,
    );
  }

  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`\n${SLOTS.length} props → ${path.relative(root, MANIFEST)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
