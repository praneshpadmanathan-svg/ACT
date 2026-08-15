/* Turn the four map panels into the four region backdrops.
 *
 * Run with `npm run build:regions`, then `npm run build:art`. Prompts in
 * `art-src/PROMPTS.md`.
 *
 * These were painted to extend the world map and cannot: assembled at real
 * scale the original ends up 18% of the total, the four panels leave blank
 * corners because north and south only span the map's width, and — the part no
 * amount of cropping fixes — they are drawn at roughly four times fewer metres
 * per pixel. The map draws a village, a great tree and a castle. The panels
 * draw whole mountain ranges. Side by side the village reads as the size of a
 * range, and matching the cartography would mean shrinking each panel to about
 * a 768x110 strip, which is a border rather than an extension.
 *
 * As full-bleed plates behind the four path screens, none of that matters —
 * nothing is next to anything, so there is no scale to disagree with. The
 * terrain each one got is the terrain its region is named for:
 *
 *   reading  ← north   black pine forest         The Enchanted Woods
 *   math     ← east    red canyons, dry riverbeds The Number Desert
 *   science  ← west    drowned ruins, islands     The Science Cliffs
 *   english  ← south   marsh and dunes            The Grammar Village
 *
 * The first three are exact. English is the one left over, and an estuary
 * delta is at least the settled lowland its region is meant to be.
 *
 * Two things get trimmed. The generator's sparkle sits about 33 px into the
 * bottom-right corner, so 96 px comes off the right and bottom. And the east
 * panel came back inside a painted parchment frame the prompt asked it not to
 * have; that is found by walking in from each edge while the rows stay pale
 * and unsaturated, rather than by a hardcoded number, so it costs nothing on
 * the three panels that do not have one.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'art-src');
const OUT = path.join(root, 'public', 'art');

/* `dead` is the fraction of one edge to throw away on top of everything else.
 *
 * Each panel was painted to butt against the world map, so the edge that faced
 * the map is open ocean — that is what a coastline looks like from the side it
 * joins. It reads as sea on a map and as a black hole behind a page: a fifth of
 * the east panel is empty water, and under the scrim that is a dead band down
 * one side of the screen with nothing in it. Composited at 1280x800 it also put
 * a dead tree in the middle of the sea, because `object-cover` decides which
 * part of the picture survives and the props do not know what is underneath
 * them. Cutting the water solves both at once, and costs nothing that was ever
 * going to be looked at. Measured off the plates, not guessed. */
const REGIONS = [
  { id: 'reading', panel: 'panel-north' },
  { id: 'math', panel: 'panel-east', dead: { side: 'left', frac: 0.22 } },
  { id: 'science', panel: 'panel-west', dead: { side: 'right', frac: 0.14 } },
  { id: 'english', panel: 'panel-south' },
];

/** Off the right and bottom, to take the generator's mark with them. */
const MARK = 96;

/** Longest side of the written file, and the quality it is written at.
 *
 *  Both are lower than anything else in `public/art/`, on purpose. These four
 *  are the *only* assets in the folder that are never looked at directly: a
 *  path screen paints a `leather-950/74` scrim over the whole thing and the
 *  body grain sits on top of that, so the backdrop arrives at the eye already
 *  a quarter of its own contrast. At native size and q82 the set came to
 *  605 KB, and `vite.config.ts`'s `deadWeight` deliberately keeps the
 *  originals in the precache — that is 605 KB of every installed phone's
 *  storage quota, more than the entire rest of the art folder, spent on
 *  texture the scrim throws away. 1024/q72 is 383 KB for a picture nobody can
 *  tell apart from the big one once it is behind the scrim it was made for. */
const LONG = 1024;
const QUALITY = 72;

/** A row or column counts as frame while it is this pale and this unsaturated.
 *  The painted parchment border sits around L217-223 at S<45; the artwork
 *  behind it drops to L100 or lifts its saturation well past 45 within a pixel
 *  or two, so the walk stops immediately on a panel that has no frame. */
const isFrame = (L, S) => L > 205 && S < 45;

/** How far the pale border runs in from one edge, capped so a genuinely pale
 *  painting — the dunes in the south panel — can never eat itself. */
function frameDepth(read, count, cap) {
  let d = 0;
  while (d < cap && isFrame(...read(d))) d++;
  return d;
}

async function main() {
  await mkdir(OUT, { recursive: true });

  for (const { id, panel, dead } of REGIONS) {
    const abs = path.join(SRC, `${panel}.png`);
    const { data, info } = await sharp(abs).raw().toBuffer({ resolveWithObject: true });
    const { width: W, height: H, channels: C } = info;

    const stat = (pixels) => {
      let sum = 0;
      let sat = 0;
      for (const o of pixels) {
        const r = data[o];
        const g = data[o + 1];
        const b = data[o + 2];
        sum += (r + g + b) / 3;
        sat += Math.max(r, g, b) - Math.min(r, g, b);
      }
      return [sum / pixels.length, sat / pixels.length];
    };
    const row = (y) => {
      const p = [];
      for (let x = 0; x < W; x++) p.push((y * W + x) * C);
      return stat(p);
    };
    const col = (x) => {
      const p = [];
      for (let y = 0; y < H; y++) p.push((y * W + x) * C);
      return stat(p);
    };

    const cap = Math.round(Math.min(W, H) * 0.06);
    const top = frameDepth((d) => row(d), H, cap);
    const bottom = frameDepth((d) => row(H - 1 - d), H, cap);
    const left = frameDepth((d) => col(d), W, cap);
    const right = frameDepth((d) => col(W - 1 - d), W, cap);

    const box = {
      left,
      top,
      width: W - left - right - MARK,
      height: H - top - bottom - MARK,
    };

    if (dead) {
      const cut = Math.round(box.width * dead.frac);
      box.width -= cut;
      if (dead.side === 'left') box.left += cut;
    }

    const out = await sharp(abs)
      .extract(box)
      /* `inside` rather than a width, because two of the four are portrait —
         the long side is the one to cap whichever way round it is. */
      .resize({
        width: LONG,
        height: LONG,
        fit: 'inside',
        withoutEnlargement: true,
        kernel: 'lanczos3',
      })
      .webp({ quality: QUALITY, effort: 6 })
      .toBuffer({ resolveWithObject: true });

    await writeFile(path.join(OUT, `region-${id}.webp`), out.data);
    console.log(
      `  region-${id.padEnd(8)} ${panel.padEnd(12)} ${W}×${H} → ${out.info.width}×${out.info.height}` +
        `  (frame t${top} r${right} b${bottom} l${left})  ${(out.data.length / 1024).toFixed(0)} KB`,
    );
  }

  console.log(`\n${REGIONS.length} backdrops written. Now run \`npm run build:art\`.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
