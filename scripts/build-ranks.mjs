/* Cut the seven rank emblems out of the generated sheet.
 *
 * Run with `npm run build:ranks`. Deliberately NOT part of `npm run build`,
 * for the same reason as `build:heroes`: slow, deterministic, outputs
 * committed. Re-run it when the sheet in `art-src/` changes.
 *
 * The prompt that produced the sheet is in `art-src/PROMPTS.md`, along with
 * the reasoning for the two things this script depends on — a magenta
 * background rather than a painted checkerboard, and emblems laid out with
 * clear space between them.
 *
 * Four things here are not obvious.
 *
 * 1. **The sheet has nine emblems, not seven.** The prompt asked for one row
 *    of seven; what came back is five and four across two rows, with
 *    Lorewarden drawn twice and Proofbreaker's hammer and slate split into
 *    separate cells. That is normal and it is why `SLOTS` below is an explicit
 *    map from detected cell to rank rather than a zip of two lists — the
 *    script's job is to cut what is there, and choosing among it is a
 *    judgement that belongs in source where it can be read and changed.
 *
 * 2. **Rows are found before columns**, the opposite way round from
 *    `build-heroes.mjs`. There the columns were clean and the rows merged; here
 *    the two rows are cleanly separated but the columns are staggered, so a
 *    global column projection smears cells 3-4 into 6-7.
 *
 * 3. **The background is keyed on being magenta, not on distance to a sampled
 *    colour.** It arrives around #EA1AE0 but drifts several units across the
 *    sheet, and the emblems' own edges blend into it. Keying on the property —
 *    red and blue both high, green far below both — catches the drift and the
 *    blend in one test, and cannot touch the palette: the closest any emblem
 *    gets is Proofbreaker's violet (200,170,255), whose green sits *above* the
 *    threshold rather than below it.
 *
 * 4. **Every emblem is scaled by the same factor**, not fitted individually to
 *    its box. The model drew the ink pot small and the crown large, which is
 *    the escalation the prompt asked for; normalising each one to fill its
 *    canvas would throw that away and make rank one exactly as imposing as
 *    rank seven.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHEET = path.join(root, 'art-src', 'ranks-sheet.png');
const OUT = path.join(root, 'public', 'art', 'ranks');
const MANIFEST = path.join(root, 'src', 'rankArt.json');

/* Detected cells in reading order — top row left to right, then bottom row —
   mapped to the rank each one becomes. `null` means "cut it, then throw it
   away", and both nulls are deliberate:

   - cell 3 is a second Lorewarden, a steel-and-gold shield carrying a tome. It
     is the better *drawing* of the two, and it loses on colour: the ladder's
     hues are load-bearing (they drive the rank-up flash, the badge glow and
     the progress bar), and a steel-grey badge sitting at Lorewarden's teal
     would put the art and the UI in disagreement everywhere else.
   - cell 6 is Proofbreaker's warhammer with nothing to hit. Cell 5 is the same
     idea after impact — a slate splitting, shards in the air — which is both
     the stronger emblem and the one that keeps a weapon out of a ladder about
     reading.

   Note what cell 5 also carries: the cracked question mark that was specced
   for Doubtbane. The model put the two together, and it is better than what
   was asked for — Proofbreaker is the rank for breaking the question open, so
   a shattered question mark is exactly its emblem, and Doubtbane keeps the
   sword-through-stone that reads as the harder, later thing. */
const SLOTS = [
  'inkling',
  'pagewalker',
  'quillbearer',
  null,
  'lorewarden',
  'proofbreaker',
  null,
  'doubtbane',
  'sagecrown',
];

/** The square every emblem is centred on. Rendered at 104 in the rank-up
 *  cinematic, so this is a shade under 2× for a retina screen. */
const BOX = 192;

/* ------------------------------------------------------------------ keying */

/** Magenta: red and blue both strong, green well below both. Nothing in the
 *  rank palette satisfies this — see note 3 at the top. */
const isMagenta = (r, g, b, slack = 0) =>
  r > 120 - slack && b > 120 - slack && g < r - (70 - slack) && g < b - (70 - slack);

function keyBackground(data, W, H, C) {
  const at = (x, y) => (y * W + x) * C;

  const bg = new Uint8Array(W * H);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    if (bg[i]) return;
    const o = at(x, y);
    if (!isMagenta(data[o], data[o + 1], data[o + 2])) return;
    bg[i] = 1;
    stack.push(x, y);
  };
  for (let x = 0; x < W; x++) {
    push(x, 0);
    push(x, H - 1);
  }
  for (let y = 0; y < H; y++) {
    push(0, y);
    push(W - 1, y);
  }
  while (stack.length) {
    const y = stack.pop();
    const x = stack.pop();
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  /* Fringe. The sheet is upscaled pixel art, so every emblem carries a thin
     ring where its edge blends into the background — too mixed for the fill to
     claim, magenta enough to glow on a dark page. Three rounds of eating any
     still-magenta-ish pixel that touches the background clears it. The slack
     loosens the test just enough to catch a half-and-half blend while staying
     clear of the violet. */
  for (let pass = 0; pass < 3; pass++) {
    const eat = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (bg[i]) continue;
        const touches =
          (x > 0 && bg[i - 1]) ||
          (x < W - 1 && bg[i + 1]) ||
          (y > 0 && bg[i - W]) ||
          (y < H - 1 && bg[i + W]);
        if (!touches) continue;
        const o = at(x, y);
        if (isMagenta(data[o], data[o + 1], data[o + 2], 34)) eat.push(i);
      }
    }
    if (!eat.length) break;
    for (const i of eat) bg[i] = 1;
  }

  for (let i = 0; i < W * H; i++) if (bg[i]) data[i * C + 3] = 0;
}

/* ----------------------------------------------------------------- slicing */

/** Runs of truthy values at least `minLen` long, as [start, end] inclusive. */
const runs = (arr, minLen) => {
  const out = [];
  let s = -1;
  for (let i = 0; i <= arr.length; i++) {
    if (i < arr.length && arr[i] && s < 0) s = i;
    else if ((i === arr.length || !arr[i]) && s >= 0) {
      if (i - s >= minLen) out.push([s, i - 1]);
      s = -1;
    }
  }
  return out;
};

async function main() {
  await mkdir(OUT, { recursive: true });

  const { data, info } = await sharp(SHEET).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  console.log(`sheet ${W}×${H}`);

  keyBackground(data, W, H, C);
  const ink = (x, y) => data[(y * W + x) * C + 3] > 32;

  /* Row bands. The generator's signature sparkle sits in the bottom-right
     corner below everything else, so it lands in a band of its own; anything
     shorter than a real emblem is dropped rather than special-cased by
     position, which also covers stray specks anywhere else on the sheet. */
  const rowHas = new Uint8Array(H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (ink(x, y)) {
        rowHas[y] = 1;
        break;
      }
    }
  }
  const bands = runs(rowHas, 1).filter(([y0, y1]) => y1 - y0 >= 80);

  const cells = [];
  for (const [y0, y1] of bands) {
    const colHas = new Uint8Array(W);
    for (let x = 0; x < W; x++) {
      for (let y = y0; y <= y1; y++) {
        if (ink(x, y)) {
          colHas[x] = 1;
          break;
        }
      }
    }
    for (const [x0, x1] of runs(colHas, 40)) {
      /* Tighten vertically inside this cell: the band is as tall as the
         tallest emblem in the row, and a short one would otherwise carry the
         difference as dead space and come out scaled small. */
      let t = y1;
      let b = y0;
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          if (ink(x, y)) {
            if (y < t) t = y;
            if (y > b) b = y;
            break;
          }
        }
      }
      cells.push({ x0, x1, y0: t, y1: b });
    }
  }

  console.log(`found ${cells.length} emblems in ${bands.length} rows`);
  if (cells.length !== SLOTS.length) {
    throw new Error(
      `SLOTS describes ${SLOTS.length} emblems but the sheet has ${cells.length}. ` +
        `Re-read the sheet and update SLOTS — do not guess.`,
    );
  }

  /* One scale for all of them, from the largest emblem that is actually being
     kept. See note 4 at the top. */
  const kept = cells.filter((_, i) => SLOTS[i]);
  const span = Math.max(...kept.map((c) => Math.max(c.x1 - c.x0 + 1, c.y1 - c.y0 + 1)));
  const scale = BOX / span;
  console.log(`largest kept emblem ${span}px → scale ${scale.toFixed(3)}`);

  const keyed = await sharp(Buffer.from(data), { raw: { width: W, height: H, channels: C } })
    .png()
    .toBuffer();

  const manifest = {};
  for (let i = 0; i < cells.length; i++) {
    const id = SLOTS[i];
    const { x0, x1, y0, y1 } = cells[i];
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    if (!id) {
      console.log(`  cell ${i}  ${w}×${h}  — skipped`);
      continue;
    }

    const sprite = await sharp(keyed)
      .extract({ left: x0, top: y0, width: w, height: h })
      .resize({
        width: Math.max(1, Math.round(w * scale)),
        height: Math.max(1, Math.round(h * scale)),
        /* Nearest neighbour. Every other kernel resamples a hard pixel edge
           into a two-tone ramp, which is the one thing this style cannot
           survive — and it would undo the fringe work above by reintroducing
           blended edges, this time against transparency. */
        kernel: 'nearest',
      })
      .toBuffer();

    /* Centred on a fixed square so the badges line up in a column and a rank
       list does not jitter as it descends. */
    const png = await sharp({
      create: { width: BOX, height: BOX, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([{ input: sprite, gravity: 'centre' }])
      /* Quantised PNG and nothing else, for the reasons written out at length
         in `build-heroes.mjs`: this is flat colour with hard edges, the exact
         case a lossy codec spends its budget ruining. */
      .png({ palette: true, colours: 64, compressionLevel: 9, effort: 10 })
      .toBuffer();

    await writeFile(path.join(OUT, `${id}.png`), png);
    manifest[id] = { width: BOX, height: BOX, src: `/art/ranks/${id}.png` };
    console.log(`  cell ${i}  ${w}×${h} → ${id.padEnd(12)} ${(png.length / 1024).toFixed(1)} KB`);
  }

  const missing = SLOTS.filter(Boolean).filter((id) => !manifest[id]);
  if (missing.length) throw new Error(`no art emitted for: ${missing.join(', ')}`);

  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`wrote ${path.relative(root, MANIFEST)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
