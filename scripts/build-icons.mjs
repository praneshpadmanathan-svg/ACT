/* Rasterise the app icons from one drawn source.
 *
 * There were four icon PNGs in `public/` and no record of where they came
 * from — a 192, a 512, a maskable 512 and a 180 Apple touch icon, all showing
 * a purple pixel-art mountain from an identity the app no longer has. Editing
 * them meant opening an image editor and matching four crops by eye, so in
 * practice nobody was ever going to.
 *
 * Now they come from `public/favicon.svg` and the geometry below, and
 * `npm run build:icons` regenerates the set. Three framings, because the
 * platforms genuinely want three different things:
 *
 *   any        rounded rect, transparent corners — what a browser or a
 *              desktop launcher draws as-is
 *   maskable   full-bleed square with the mark inside the 80%-diameter safe
 *              circle, because Android crops adaptive icons to whatever shape
 *              the launcher feels like (circle, squircle, teardrop)
 *   apple      full-bleed square, opaque — iOS applies its own squircle mask,
 *              and transparent corners come out black on the home screen
 *
 * Run after editing `favicon.svg`:  node scripts/build-icons.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pub = (name) => resolve(root, 'public', name);

const LEATHER = '#1c1610';

/** The favicon, minus its outer plate — the compass itself. */
function markOnly() {
  const svg = readFileSync(pub('favicon.svg'), 'utf8');
  /* Drop the two <rect> plates; keep the defs and everything circular. A
     regex over our own hand-written file rather than a parser: it is one
     file, we control it, and a mismatch here fails loudly at render time. */
  return svg.replace(/^\s*<rect[^>]*\/>\s*$/gm, '');
}

/** Full-bleed square, mark scaled to `inset` of the canvas and centred. */
function framed(inset) {
  const size = 32;
  const m = markOnly()
    .replace(/<svg[^>]*>/, '')
    .replace('</svg>', '');
  const scale = inset;
  const offset = ((1 - scale) * size) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${LEATHER}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">${m}</g>
</svg>`;
}

const png = (svg, size) =>
  sharp(Buffer.from(svg), { density: 512 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

const rounded = readFileSync(pub('favicon.svg'));

const jobs = [
  ['icon-192.png', () => png(rounded, 192)],
  ['icon-512.png', () => png(rounded, 512)],
  /* 0.62 keeps every gold pixel inside Android's safe circle even when a
     launcher crops hardest; the leather runs to the edge behind it. */
  ['maskable-512.png', () => png(framed(0.62), 512)],
  /* iOS crops less, so the mark can breathe wider. */
  ['apple-touch-icon.png', () => png(framed(0.86), 180)],
];

for (const [name, make] of jobs) {
  const buf = await make();
  writeFileSync(pub(name), buf);
  console.log(`${name.padEnd(22)} ${(buf.length / 1024).toFixed(1)} KB`);
}
