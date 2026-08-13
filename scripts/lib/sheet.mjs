/* Shared plumbing for cutting generated sheets.
 *
 * `build-heroes.mjs` and `build-ranks.mjs` came first and each carry their own
 * copy of this; they are done, their output is committed, and rewriting a
 * working slicer to save duplication is a bad trade. Everything after them
 * imports from here.
 *
 * The two ideas worth knowing before using any of it:
 *
 * 1. **The background is keyed on *being* magenta, not on distance to a
 *    sampled colour.** It arrives near #FF00FF but drifts across a sheet, and
 *    every drawn edge blends into it. Testing the property — red and blue both
 *    high, green far below both — catches the drift and the blend in one go,
 *    and cannot touch art in any palette used here, since no natural colour
 *    puts green that far under both of the others.
 *
 * 2. **Never ask a model for a transparent background.** It returns a *painted*
 *    checkerboard with alpha 255 everywhere, which then has to be keyed anyway
 *    and is far more dangerous, because the key eats pale neutrals in the art.
 */

import sharp from 'sharp';

/** Red and blue strong, green well below both. `slack` loosens every bound at
 *  once, for eating half-and-half edge blends. */
export const isMagenta = (r, g, b, slack = 0) =>
  r > 120 - slack && b > 120 - slack && g < r - (70 - slack) && g < b - (70 - slack);

/** Runs of truthy values at least `minLen` long, as inclusive [start, end]. */
export function runs(arr, minLen) {
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
}

/** Flood the magenta in from the border and punch it to alpha 0, then eat the
 *  fringe. Mutates `data`.
 *
 *  The flood starts at the border rather than testing every pixel so that a
 *  magenta-ish colour *inside* the art is never removed. The fringe passes
 *  exist because these sheets are upscaled pixel art: every edge carries a ring
 *  where the drawing blends into the background, too mixed for the flood to
 *  claim and magenta enough to glow on a dark page.
 *
 *  `interior` then claims the pockets a border flood structurally cannot
 *  reach: the gap between an arm and a torso, the hole inside a coil, the space
 *  under an archway. Measured on the guardians — without it the Number Crusher
 *  keeps 8,456 magenta pixels between his arms and legs, which on a dark duel
 *  screen is a figure cut out of hot pink. Turn it off only for art that is
 *  itself magenta, where a pocket might be something drawn on purpose. */
export function keyBackground(data, W, H, C, { fringe = 3, slack = 34, interior = true } = {}) {
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
  const drain = () => {
    while (stack.length) {
      const y = stack.pop();
      const x = stack.pop();
      push(x + 1, y);
      push(x - 1, y);
      push(x, y + 1);
      push(x, y - 1);
    }
  };
  drain();

  /* Anything still magenta after that is a pocket the border could not reach,
     because every component connected to the edge has already been taken. */
  if (interior) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (bg[y * W + x]) continue;
        const o = at(x, y);
        if (!isMagenta(data[o], data[o + 1], data[o + 2])) continue;
        push(x, y);
        drain();
      }
    }
  }

  for (let pass = 0; pass < fringe; pass++) {
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
        if (isMagenta(data[o], data[o + 1], data[o + 2], slack)) eat.push(i);
      }
    }
    if (!eat.length) break;
    for (const i of eat) bg[i] = 1;
  }

  for (let i = 0; i < W * H; i++) if (bg[i]) data[i * C + 3] = 0;
}

/** Read a sheet, key it, and hand back both the raw pixels and a PNG buffer to
 *  cut from. */
export async function loadSheet(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  keyBackground(data, W, H, C);
  const keyed = await sharp(Buffer.from(data), { raw: { width: W, height: H, channels: C } })
    .png()
    .toBuffer();
  return { data, W, H, C, keyed, ink: (x, y) => data[(y * W + x) * C + 3] > 32 };
}

/** Find drawn items: row bands first, then columns inside each band.
 *
 *  Rows before columns is the opposite of the obvious order and it is the one
 *  that works on these sheets. A model lays rows out cleanly and staggers the
 *  columns, so a single global column projection smears items in one row into
 *  the gaps of the other. Projecting columns *within* a band cannot.
 *
 *  `minRow`/`minCol` drop the generator's signature sparkle and any stray
 *  speck — by size, anywhere on the sheet, rather than by hardcoded position.
 */
export function findCells(sheet, { minRow = 80, minCol = 40 } = {}) {
  const { W, H, ink } = sheet;

  const rowHas = new Uint8Array(H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (ink(x, y)) {
        rowHas[y] = 1;
        break;
      }
    }
  }

  const cells = [];
  for (const [y0, y1] of runs(rowHas, 1).filter(([a, b]) => b - a >= minRow)) {
    const colHas = new Uint8Array(W);
    for (let x = 0; x < W; x++) {
      for (let y = y0; y <= y1; y++) {
        if (ink(x, y)) {
          colHas[x] = 1;
          break;
        }
      }
    }
    for (const [x0, x1] of runs(colHas, minCol)) {
      /* Tighten vertically inside the cell. The band is as tall as the tallest
         item in the row, so a short one would otherwise carry the difference as
         dead space and come out scaled small. */
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
      cells.push({ x0, x1, y0: t, y1: b, w: x1 - x0 + 1, h: b - t + 1 });
    }
  }
  return cells;
}

/** Quantised PNG and nothing else. This is flat colour with hard edges — the
 *  exact case a lossy codec spends its whole budget ruining. */
export const png = (img, colours = 64) =>
  img.png({ palette: true, colours, compressionLevel: 9, effort: 10 }).toBuffer();
