/* Compose the link-preview card.  node scripts/build-og.mjs
 *
 * `og:image` pointed at `/art/landing-hero.webp`: a 1024×559 painting with no
 * words on it, in a format several crawlers still refuse. So a student who
 * sent the app to a friend got a picture of some hills, in the wrong aspect
 * ratio, sometimes with no image at all — and sharing a link to a friend is
 * realistically the app's entire distribution.
 *
 * This builds the card the platforms actually want: 1200×630 PNG, the app's
 * own artwork behind its own typeface, with the facts that decide whether
 * someone taps — what it is, how much there is, what it costs.
 *
 * Two things had to be solved to set it in Cinzel and IM Fell rather than
 * whatever serif the machine happened to have:
 *
 *   1. @fontsource ships `.woff` only, which fontconfig will not index. So
 *      `lib/woff2ttf.mjs` unpacks the sfnt back out of the WOFF wrapper.
 *
 *   2. Pointing `FONTCONFIG_PATH` at those unpacked files still did not take
 *      — every family, including a deliberately bogus one, resolved to the
 *      same fallback, so librsvg's `<text>` was never going to work here.
 *      sharp's own text API takes an explicit `fontfile` and skips font
 *      matching altogether, so the type is rendered as image layers and
 *      composited, and the SVG layer is left to do only the drawing.
 *
 * Everything is generated, so changing the wording is editing this file
 * rather than opening an image editor.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';
import { woffToSfnt } from './lib/woff2ttf.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* ------------------------------------------------------------------ fonts */

const cache = resolve(root, 'node_modules/.cache/act-fonts');
mkdirSync(cache, { recursive: true });

/** Unpack a WOFF from node_modules and return the path to a real sfnt. */
function sfnt(pkgPath, out) {
  const dest = resolve(cache, out);
  writeFileSync(dest, woffToSfnt(readFileSync(resolve(root, 'node_modules', pkgPath))));
  return dest;
}

/* `family` is what Pango is told to use; it must match the font's own name
   table, which is why Inter's is "Inter Medium" rather than "Inter". */
const DISPLAY = {
  family: 'Cinzel',
  file: sfnt('@fontsource/cinzel/files/cinzel-latin-700-normal.woff', 'Cinzel-Bold.ttf'),
};
const SCRIPT = {
  family: 'IM FELL English SC',
  file: sfnt('@fontsource/im-fell-english-sc/files/im-fell-english-sc-latin-400-normal.woff', 'IMFellSC.ttf'),
};
const SANS = {
  family: 'Inter Medium',
  file: sfnt('@fontsource/inter/files/inter-latin-500-normal.woff', 'Inter-Medium.ttf'),
};

/* ----------------------------------------------------------------- pieces */

const W = 1200;
const H = 630;

const GOLD = '#f0cf7a';
const GOLD_DEEP = '#d4a017';
const PARCHMENT = '#f4e8cf';
const MUTED = '#cbb68f';
const LEATHER = '#141009';

/** Render one line of type to an RGBA layer.
 *
 *  Pango sizes in thousandths of a point, so rendering at 72 dpi makes one
 *  point one pixel and `px` mean what it says. `letter_spacing` uses 1/1024
 *  pt units, which is a different unit in the same attribute list — hence
 *  doing the conversion here once rather than at every call site. */
async function line(text, { font, px, color, tracking = 0 }) {
  const attrs = [`size="${Math.round(px * 1000)}"`, `foreground="${color}"`];
  if (tracking) attrs.push(`letter_spacing="${Math.round(tracking * 1024)}"`);
  const img = sharp({
    text: {
      text: `<span ${attrs.join(' ')}>${text}</span>`,
      font: font.family,
      fontfile: font.file,
      rgba: true,
      dpi: 72,
    },
  });
  const { width, height } = await img.metadata();
  return { buf: await img.png().toBuffer(), width, height };
}

/** The compass from the favicon, reused at card scale. */
const mark = readFileSync(resolve(root, 'public/favicon.svg'), 'utf8')
  .replace(/<svg[^>]*>/, '')
  .replace('</svg>', '')
  .replace(/<!--[\s\S]*?-->/g, '');

const BULLETS = [
  '754 questions, every choice explained',
  '60 lessons, timed sections and full tests',
  'Free — and no account needed to start',
];

/* Where each element sits. Kept together so the vertical rhythm is one thing
   you can read, rather than a magic number per composite call. */
const X = 74;
const RULE_Y = 306;
const BULLET_TOP = 436;
const BULLET_STEP = 46;

const decor = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <!-- The artwork is busiest on the right, so the scrim is heaviest on the
         left where the words go, and lifts off the painting on the right. -->
    <linearGradient id="scrim" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0"    stop-color="${LEATHER}" stop-opacity="0.96"/>
      <stop offset="0.54" stop-color="${LEATHER}" stop-opacity="0.88"/>
      <stop offset="1"    stop-color="${LEATHER}" stop-opacity="0.40"/>
    </linearGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${LEATHER}" stop-opacity="0"/>
      <stop offset="1" stop-color="${LEATHER}" stop-opacity="0.72"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#scrim)"/>
  <rect width="${W}" height="${H}" fill="url(#floor)"/>

  <!-- Tooled border. Platforms crop these cards differently and a hard frame
       is what makes an off-centre crop still look deliberate. -->
  <rect x="18" y="18" width="${W - 36}" height="${H - 36}" rx="10"
        fill="none" stroke="${GOLD_DEEP}" stroke-opacity="0.5" stroke-width="2"/>
  <rect x="27" y="27" width="${W - 54}" height="${H - 54}" rx="6"
        fill="none" stroke="${GOLD_DEEP}" stroke-opacity="0.22" stroke-width="1"/>

  <g transform="translate(${X} 62) scale(2.4)">${mark}</g>

  <path d="M${X + 2} ${RULE_Y} H${X + 350}" stroke="${GOLD_DEEP}" stroke-opacity="0.75" stroke-width="2"/>

  ${BULLETS.map((_, i) => `<circle cx="${X + 8}" cy="${BULLET_TOP + i * BULLET_STEP + 13}" r="4.5" fill="${GOLD_DEEP}"/>`).join('\n  ')}
</svg>`;

/* ------------------------------------------------------------------ build */

const title = await line('ACT COMMAND', { font: DISPLAY, px: 76, color: GOLD, tracking: 2 });
const tag = await line('Free prep for the Enhanced ACT', { font: SCRIPT, px: 36, color: PARCHMENT });
const sub = await line('A world map you climb one skill at a time.', { font: SANS, px: 25, color: MUTED });
const bullets = await Promise.all(BULLETS.map((t) => line(t, { font: SANS, px: 24, color: PARCHMENT })));

const layers = [
  { input: Buffer.from(decor), left: 0, top: 0 },
  { input: title.buf, left: X, top: RULE_Y - 24 - title.height },
  { input: tag.buf, left: X, top: RULE_Y + 26 },
  { input: sub.buf, left: X, top: RULE_Y + 26 + tag.height + 16 },
  ...bullets.map((b, i) => ({ input: b.buf, left: X + 30, top: BULLET_TOP + i * BULLET_STEP })),
];

const card = await sharp(resolve(root, 'public/art/world-map.webp'))
  .resize(W, H, { fit: 'cover', position: 'attention' })
  .composite(layers)
  /* PNG is what every crawler accepts; the palette is small enough that
     quantising costs nothing visible and roughly halves the file. */
  .png({ compressionLevel: 9, palette: true, quality: 92 })
  .toBuffer();

writeFileSync(resolve(root, 'public/og.png'), card);
console.log(`public/og.png  ${W}×${H}  ${(card.length / 1024).toFixed(0)} KB`);
