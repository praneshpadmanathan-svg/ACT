/* Cut the twelve nature particles out of `art-src/foliage-sheet.png`.
 *
 * Run with `npm run build:foliage`. Not part of `npm run build` — slow,
 * deterministic, output committed. Prompt in `art-src/PROMPTS.md`.
 *
 * These are the answer to "there should be green stuff coming off the trees".
 * Note what is deliberately *not* here: frames of a swaying tree. A model will
 * not hold a tree identical across four frames, and a four-frame loop reads as
 * a loop inside two cycles. One leaf thrown a hundred ways by a simulation
 * never repeats, so the motion lives in `RankAura.tsx` and this is only the
 * ammunition.
 *
 * Two things differ from the badge slicer:
 *
 * 1. **Tight crops, no padding.** A badge is centred on a fixed square so a
 *    rank list does not jitter as it descends. A particle is positioned by the
 *    engine at its own centre, and padding would just be transparent pixels
 *    pushed through a rotate on every frame.
 *
 * 2. **One shared scale, from the largest.** The broad leaf is drawn much
 *    bigger than a pollen mote, and that ratio is real information — pollen
 *    *is* tiny. Fitting each to its own box would make a speck of dust the
 *    size of a leaf.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { findCells, loadSheet, png } from './lib/sheet.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHEET = path.join(root, 'art-src', 'foliage-sheet.png');
const OUT = path.join(root, 'public', 'art', 'particles');
const MANIFEST = path.join(root, 'src', 'particleArt.json');

/* Reading order, top row then bottom. All twelve came back, correctly drawn,
   first try — but as *thirteen* cells.

   The prompt asked for pollen as "three tiny round pollen motes clustered
   loosely", and loosely is exactly what it got: one mote sits far enough from
   the other two that the column projection puts a gap between them. That is
   the sheet being right and the slicer being literal, not a generation
   failure, so the fix belongs here. A `span` says how many consecutive cells
   are one particle. */
const SLOTS = [
  'leaf-flat',
  'leaf-edge',
  'leaf-curl',
  'leaf-dry',
  'petal',
  'seed-fluff',
  { id: 'pollen', span: 2 },
  'rain',
  'snow',
  'dust',
  'ember',
  'smoke',
];

/** Longest side of the largest particle. Drawn on the map somewhere between 4
 *  and 14 CSS pixels, so this is deep retina headroom and still a rounding
 *  error in bytes at this palette depth. */
const MAX = 40;

async function main() {
  await mkdir(OUT, { recursive: true });

  const sheet = await loadSheet(SHEET);
  console.log(`sheet ${sheet.W}×${sheet.H}`);

  /* Lower thresholds than the badge sheet: a pollen mote is a handful of
     pixels across, and the defaults would throw it away as a speck. */
  const raw = findCells(sheet, { minRow: 24, minCol: 8 });

  /* Fold each slot's span of cells into one box. */
  const want = SLOTS.map((s) => (typeof s === 'string' ? { id: s, span: 1 } : s));
  const need = want.reduce((n, s) => n + s.span, 0);
  console.log(`found ${raw.length} cells for ${want.length} particles`);
  if (raw.length !== need) {
    throw new Error(
      `SLOTS accounts for ${need} cells but the sheet has ${raw.length}. ` +
        `Re-read the sheet and update SLOTS — do not guess.`,
    );
  }

  const cells = [];
  let at = 0;
  for (const { id, span } of want) {
    const group = raw.slice(at, at + span);
    at += span;
    const x0 = Math.min(...group.map((c) => c.x0));
    const y0 = Math.min(...group.map((c) => c.y0));
    const x1 = Math.max(...group.map((c) => c.x1));
    const y1 = Math.max(...group.map((c) => c.y1));
    cells.push({ id, x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1, span });
  }

  const span = Math.max(...cells.map((c) => Math.max(c.w, c.h)));
  const scale = MAX / span;
  console.log(`largest particle ${span}px → scale ${scale.toFixed(3)}`);

  const manifest = {};
  for (let i = 0; i < cells.length; i++) {
    const { id, x0, y0, w, h } = cells[i];
    const width = Math.max(1, Math.round(w * scale));
    const height = Math.max(1, Math.round(h * scale));

    const buf = await png(
      sharp(sheet.keyed)
        .extract({ left: x0, top: y0, width: w, height: h })
        /* Down, so not nearest: shrinking with nearest *discards* pixels, and
           on something already only a few dozen across that eats the outline
           the silhouette depends on. */
        .resize({ width, height, kernel: 'lanczos3' }),
      32,
    );

    await writeFile(path.join(OUT, `${id}.png`), buf);
    manifest[id] = { width, height, src: `/art/particles/${id}.png` };
    console.log(`  ${id.padEnd(11)} ${w}×${h} → ${width}×${height}  ${(buf.length / 1024).toFixed(1)} KB`);
  }

  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`wrote ${path.relative(root, MANIFEST)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
