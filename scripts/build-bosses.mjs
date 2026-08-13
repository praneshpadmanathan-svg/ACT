/* Cut the four guardians out of their generated frames.
 *
 * Run with `npm run build:bosses`. Prompts in `art-src/PROMPTS.md`.
 *
 * These replace the procedural SVG in `src/game/BossArt.tsx`, which was the
 * weakest art in the app by a distance.
 *
 * **Three files, four bosses.** The prompt asked for one boss per image, and
 * the model put the Number Crusher and the Lab Leviathan in a single frame
 * anyway. That is ordinary and it is not worth re-rolling: they are cleanly
 * separated by background, so the slicer cuts whatever is in each file and an
 * explicit table says which cell becomes which boss. A source that names its
 * own contents beats a guess about how many things came back.
 *
 * **Each boss is fitted to its own box, unlike the ranks.** The rank badges
 * share one scale because their size ladder *is* the ranking. Bosses never
 * appear together — each is shown alone in a duel — so a leviathan drawn small
 * on its sheet would simply be a small leviathan forever. Fit each to the box
 * and let the duel decide how big a guardian is.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { findCells, loadSheet, png } from './lib/sheet.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'public', 'art', 'bosses');
const MANIFEST = path.join(root, 'src', 'bossArt.json');

/* Keyed by `SectionId`, because that is what `BossArt` is handed. The ids are
   what the duel, the map plaque and the seal all agree on; the display names
   live in `bosses.ts` and are copy. */
const FRAMES = [
  { file: 'boss-grammar.png', slots: ['english'] },
  { file: 'boss-passage.png', slots: ['reading'] },
  // Left to right in the frame: the desert tyrant, then the leviathan.
  { file: 'boss-number-lab.png', slots: ['math', 'science'] },
];

/** Longest side. Drawn at up to ~260 CSS px in the duel, so this is 2× for a
 *  retina screen and no more. */
const BOX = 512;

async function main() {
  await mkdir(OUT, { recursive: true });
  const manifest = {};

  for (const { file, slots } of FRAMES) {
    const sheet = await loadSheet(path.join(root, 'art-src', file));
    /* A boss fills most of its frame, so anything small is a speck or the
       generator's signature sparkle. */
    const cells = findCells(sheet, { minRow: 120, minCol: 60 });
    console.log(`${file}  ${sheet.W}×${sheet.H} → ${cells.length} figure(s)`);

    if (cells.length !== slots.length) {
      throw new Error(
        `${file}: expected ${slots.length} figure(s) (${slots.join(', ')}) but found ` +
          `${cells.length}. Re-read the frame and update FRAMES — do not guess.`,
      );
    }

    for (let i = 0; i < cells.length; i++) {
      const id = slots[i];
      const { x0, y0, w, h } = cells[i];
      const scale = BOX / Math.max(w, h);
      const width = Math.max(1, Math.round(w * scale));
      const height = Math.max(1, Math.round(h * scale));

      const buf = await png(
        sharp(sheet.keyed)
          .extract({ left: x0, top: y0, width: w, height: h })
          .resize({ width, height, kernel: 'lanczos3' }),
        128,
      );

      await writeFile(path.join(OUT, `${id}.png`), buf);
      manifest[id] = { width, height, src: `/art/bosses/${id}.png` };
      console.log(
        `  ${id.padEnd(8)} ${w}×${h} → ${width}×${height}  ${(buf.length / 1024).toFixed(1)} KB`,
      );
    }
  }

  const want = FRAMES.flatMap((f) => f.slots);
  const missing = want.filter((id) => !manifest[id]);
  if (missing.length) throw new Error(`no art emitted for: ${missing.join(', ')}`);

  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`wrote ${path.relative(root, MANIFEST)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
