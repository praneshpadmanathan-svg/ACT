/* Cut the loading scene out of `art-src/loading-scene.png`.
 *
 * Run with `npm run build:loading`. Prompt in `art-src/PROMPTS.md`.
 *
 * One object, so there is nothing to choose between — this only keys the
 * background, trims to the drawing, and scales. It still goes through the
 * shared slicer rather than a hand-written crop, because "find the ink" is
 * exactly what `findCells` does and a hardcoded rectangle would be wrong the
 * moment the scene is regenerated.
 *
 * The compass and the folded map underneath it are the two objects an image
 * model is most determined to cover in invented writing, which is why the
 * prompt bans text three separate times. Worth a look at the output before
 * shipping it: fake lettering survives every downscale as noise.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { findCells, loadSheet, png } from './lib/sheet.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHEET = path.join(root, 'art-src', 'loading-scene.png');
const OUT = path.join(root, 'public', 'art', 'scenes');
const MANIFEST = path.join(root, 'src', 'sceneArt.json');

/** Longest side. Drawn at ~150 CSS px, so 2× and a little. */
const BOX = 384;

async function main() {
  await mkdir(OUT, { recursive: true });

  const sheet = await loadSheet(SHEET);
  console.log(`sheet ${sheet.W}×${sheet.H}`);

  /* The lantern's glow spills onto the map below it, so the whole scene is one
     connected mass of ink and comes back as a single cell. If it ever splits,
     the union below still crops the lot. */
  const cells = findCells(sheet, { minRow: 60, minCol: 40 });
  if (!cells.length) throw new Error('no drawing found — is the background actually magenta?');
  console.log(`found ${cells.length} region(s), taking their union`);

  const x0 = Math.min(...cells.map((c) => c.x0));
  const y0 = Math.min(...cells.map((c) => c.y0));
  const x1 = Math.max(...cells.map((c) => c.x1));
  const y1 = Math.max(...cells.map((c) => c.y1));
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;

  const scale = BOX / Math.max(w, h);
  const width = Math.max(1, Math.round(w * scale));
  const height = Math.max(1, Math.round(h * scale));

  const buf = await png(
    sharp(sheet.keyed)
      .extract({ left: x0, top: y0, width: w, height: h })
      .resize({ width, height, kernel: 'lanczos3' }),
    128,
  );

  await writeFile(path.join(OUT, 'loading.png'), buf);
  console.log(`  loading  ${w}×${h} → ${width}×${height}  ${(buf.length / 1024).toFixed(1)} KB`);

  const manifest = { loading: { width, height, src: '/art/scenes/loading.png' } };
  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`wrote ${path.relative(root, MANIFEST)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
