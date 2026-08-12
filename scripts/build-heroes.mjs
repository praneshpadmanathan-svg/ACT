/* Cut the eight traveller sprites out of the generated sheet.
 *
 * The source is one image: eight pixel-art travellers in a 4×2 grid, a matched
 * set differing only in skin, hair and cloak. This turns it into eight clean
 * transparent sprites the app can use.
 *
 * Run with `npm run build:heroes`. Deliberately NOT part of `npm run build`,
 * for the same reason as `build:art`: it is slow, deterministic, and its
 * outputs are committed. Re-run it when the sheet in `art-src/` changes.
 *
 * Three things in here are not obvious, and all three were found the hard way.
 *
 * 1. The sheet's transparency is *painted on*. It arrived with the familiar
 *    grey checkerboard drawn into the pixels and alpha 255 everywhere, so the
 *    background has to be keyed out rather than simply used.
 *
 * 2. Keying on sampled colours does not work. The two checker greys are 198
 *    and 227 — 29 apart — and there is a faint vignette across the sheet, so
 *    the same square reads 198/227 in one corner and nearer 235/250 out by the
 *    staffs. Matching the two commonest corner colours within a tolerance
 *    picked two shades of the *light* square one apart from each other, and
 *    left solid white slabs around every figure. So it keys on the property
 *    instead: near-neutral and light. Nothing in this palette is neutral — the
 *    outlines are dark brown, the leather is warm, the cloaks are saturated.
 *
 * 3. It is a flood fill from the border, not a global colour match, so a light
 *    neutral pixel *inside* a figure — an eye highlight, a page of a scroll —
 *    is unreachable and survives.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHEET = path.join(root, 'art-src', 'travellers-sheet.png');
const OUT = path.join(root, 'public', 'art', 'heroes');
const MANIFEST = path.join(root, 'src', 'heroArt.json');

/** Reading order in the sheet: top row left to right, then bottom row. */
const IDS = ['ash', 'wren', 'juniper', 'kesh', 'noor', 'sable', 'linden', 'io'];

/** The height every sprite is emitted at. Large enough to be shown 1:1 in the
 *  chooser and on the profile, small enough that eight of them are cheap. */
const OUT_H = 176;

const neutral = (r, g, b, tol) =>
  Math.abs(r - g) <= tol && Math.abs(g - b) <= tol && Math.abs(r - b) <= tol;

/* ------------------------------------------------------------ colour space */

const rgb2hsl = (r, g, b) => {
  r /= 255;
  g /= 255;
  b /= 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h;
  if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (mx === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
};

const hue2rgb = (p, q, t) => {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
};
const hsl2rgb = (h, s, l) => {
  h /= 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3) * 255, hue2rgb(p, q, h) * 255, hue2rgb(p, q, h - 1 / 3) * 255];
};

/* --------------------------------------------------------------- correction
 *
 * Juniper's brief said "olive skin" and the generator read olive as a colour
 * rather than a complexion: she came back khaki-green, hue 43°, the one figure
 * in the set who does not look like a person.
 *
 * The fix rotates hue and leaves lightness alone. A per-channel gain was the
 * obvious first attempt and it wrecked the hands — being multiplicative, it
 * scaled the lighter tones (knuckles, the lit side of the face) past the base
 * tone and clipped them into a washed-out pink while the mid tones landed
 * correctly. Moving only along the axis that is actually wrong brings the
 * whole shading ramp across intact.
 *
 * The band is narrow enough to miss everything else she is wearing: her cloak
 * is teal (h≈180), her trousers are darker and greener (h>70), her leather is
 * already warm (h<32).
 */
const SKIN_FIX = {
  juniper: { hue: [34, 62], sat: [0.18, 0.62], light: [0.22, 0.82], target: 26 },
};

function correctSkin(data, W, H, C, fix) {
  let n = 0;
  for (let i = 0; i < W * H; i++) {
    const o = i * C;
    if (data[o + 3] < 128) continue;
    const [h, s, l] = rgb2hsl(data[o], data[o + 1], data[o + 2]);
    if (h < fix.hue[0] || h > fix.hue[1]) continue;
    if (s < fix.sat[0] || s > fix.sat[1]) continue;
    if (l < fix.light[0] || l > fix.light[1]) continue;
    const [r, g, b] = hsl2rgb(fix.target, Math.min(0.55, s * 1.08), l);
    data[o] = Math.round(r);
    data[o + 1] = Math.round(g);
    data[o + 2] = Math.round(b);
    n++;
  }
  return n;
}

/* ------------------------------------------------------------------- keying */

function keyBackground(data, W, H, C) {
  const at = (x, y) => (y * W + x) * C;
  const isBg = (x, y) => {
    const o = at(x, y);
    return data[o] >= 170 && neutral(data[o], data[o + 1], data[o + 2], 8);
  };

  const bg = new Uint8Array(W * H);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    if (bg[i] || !isBg(x, y)) return;
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

  /* Fringe pass. The sheet is upscaled pixel art, so its blocks carry a thin
     blended border where checker meets figure — neither pure grey nor pure
     sprite, so the fill stops at them and leaves a pale halo. Invisible on a
     white page; glaring on dark forest, which is half the map. Two rounds of
     eating any light near-neutral pixel that touches the background clears it
     without biting the ink outline, which is dark and brown. */
  for (let pass = 0; pass < 2; pass++) {
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
        if (data[o] >= 165 && neutral(data[o], data[o + 1], data[o + 2], 30)) eat.push(i);
      }
    }
    if (!eat.length) break;
    for (const i of eat) bg[i] = 1;
  }

  for (let i = 0; i < W * H; i++) if (bg[i]) data[i * C + 3] = 0;
}

/* ------------------------------------------------------------------ slicing */

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

  const alpha = (x, y) => data[(y * W + x) * C + 3];

  const colHas = new Uint8Array(W);
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      if (alpha(x, y) > 32) {
        colHas[x] = 1;
        break;
      }
    }
  }
  const cols = runs(colHas, 40);
  if (cols.length !== 4) throw new Error(`expected 4 columns of figures, found ${cols.length}`);

  /* Rows are found within each column, not across the whole sheet. Measured
     globally the two rows merge into one band: the columns are staggered
     enough that some column has ink at every y, so no scanline is empty all
     the way across. Per column the gap is clean. */
  const boxes = [];
  cols.forEach(([x0, x1], ci) => {
    const rowHas = new Uint8Array(H);
    for (let y = 0; y < H; y++) {
      for (let x = x0; x <= x1; x++) {
        if (alpha(x, y) > 32) {
          rowHas[y] = 1;
          break;
        }
      }
    }
    const rs = runs(rowHas, 40);
    if (rs.length !== 2) throw new Error(`column ${ci}: expected 2 figures, found ${rs.length}`);
    rs.forEach(([y0, y1], ri) => boxes.push({ ci, ri, x0, x1, y0, y1 }));
  });
  boxes.sort((a, b) => a.ri - b.ri || a.ci - b.ci);

  const keyed = await sharp(Buffer.from(data), { raw: { width: W, height: H, channels: C } })
    .png()
    .toBuffer();

  const manifest = {};
  for (let n = 0; n < boxes.length; n++) {
    const { x0, x1, y0, y1 } = boxes[n];
    const id = IDS[n];

    let cut = await sharp(keyed)
      .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const fix = SKIN_FIX[id];
    if (fix) {
      const n2 = correctSkin(cut.data, cut.info.width, cut.info.height, cut.info.channels, fix);
      console.log(`  ${id}: recoloured ${n2} skin pixels`);
    }

    /* A quantised PNG, and nothing else.
     *
     * Not the AVIF/WebP pair the paintings get. This is pixel art: flat colour
     * and hard edges, the exact case a lossy codec ruins, because it spends
     * its budget smearing the outlines that are the whole point.
     *
     * The palette is what actually matters. True pixel art has a few dozen
     * colours; this sheet came back with thousands, because it was generated
     * at high resolution and every block carries a faint gradient. Quantising
     * to 64 both restores the discipline the style is supposed to have and
     * takes a sprite from 13.6 KB to 5.2 KB — and once quantised, lossless
     * WebP lands within a tenth of a kilobyte of the PNG, so a second format
     * and a `<picture>` element around it would buy nothing but two more
     * things to keep in sync. (Measured, after guessing wrong: unquantised,
     * lossless WebP was 12.6 KB against the PNG's 13.6, which is where the
     * assumption that WebP would win came from.) */
    const png = await sharp(cut.data, {
      raw: { width: cut.info.width, height: cut.info.height, channels: cut.info.channels },
    })
      .resize({ height: OUT_H, fit: 'inside', withoutEnlargement: true })
      .png({ palette: true, colours: 64, compressionLevel: 9, effort: 10 })
      .toBuffer();
    await writeFile(path.join(OUT, `${id}.png`), png);

    const meta = await sharp(png).metadata();
    manifest[id] = {
      width: meta.width,
      height: meta.height,
      src: `/art/heroes/${id}.png`,
    };
    console.log(
      `  ${id.padEnd(8)} ${meta.width}×${meta.height}  ${(png.length / 1024).toFixed(1)} KB`,
    );
  }

  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`\nwrote ${path.relative(root, MANIFEST)}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
