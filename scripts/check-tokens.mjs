/* Token guardrails, run as part of `npm run build`.
 *
 * The palette comments in index.css record real contrast measurements, and
 * that habit is the only reason the gold-on-leather bug was ever found. But a
 * comment is a claim about code that keeps changing, and the claim was checked
 * by hand exactly once. This runs the same measurement on every build.
 *
 * What it caught on the day it was written: `ink-faint`, chosen to clear 4.5:1
 * against leather-850 and measured only there, read 4.21:1 on leather-750 —
 * the identical mistake, one token over. Checking one surface is what lets
 * that through, so this checks every surface a text role can land on and
 * reports the worst.
 *
 * Colour maths is OKLCH → linear sRGB → WCAG relative luminance. The tokens
 * are authored in OKLCH (see index.css), so there is no sRGB round-trip to
 * introduce error.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(ROOT, 'src/index.css'), 'utf8');

/* The two theme blocks. `paper` and `gilt` are declared once above both,
   because they are pinned in either theme on purpose, so a token missing from
   a theme slice falls back to the file rather than counting as an error. */
const lightAt = css.indexOf("[data-theme='light']");
if (lightAt < 0) {
  console.error("check-tokens: could not find the [data-theme='light'] block in index.css");
  process.exit(1);
}
const THEMES = { dark: css.slice(0, lightAt), light: css.slice(lightAt) };

function token(block, name) {
  const re = new RegExp('--c-' + name + ':\\s*([\\d.]+)%\\s+([\\d.]+)\\s+([\\d.]+);');
  const m = block.match(re) ?? css.match(re);
  if (!m) throw new Error(`token --c-${name} is not declared as an OKLCH triple`);
  return { L: +m[1] / 100, C: +m[2], H: +m[3] };
}

function srgb({ L, C, H }) {
  const h = (H * Math.PI) / 180;
  const A = C * Math.cos(h);
  const B = C * Math.sin(h);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((c) => Math.min(1, Math.max(0, c)));
}

const luminance = (a) => 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];

function ratio(fg, bg) {
  const x = luminance(srgb(fg));
  const y = luminance(srgb(bg));
  const [hi, lo] = x > y ? [x, y] : [y, x];
  return (hi + 0.05) / (lo + 0.05);
}

/* Every chrome surface text can land on, and every role that lands on it.
   `parchment-edge` and `parchment-deep` are deliberately absent: grep finds no
   `text-parchment-edge` anywhere in the app — they are border and rule
   colours, and including them reports failures on pairings that never render. */
const CHROME = ['leather-950', 'leather-900', 'leather-850', 'leather-800', 'leather-750'];
const ON_CHROME = ['parchment', 'parchment-dim', 'ink-faint', 'gold', 'gold-light'];
const SHEETS = ['paper', 'paper-dim'];
const ON_PAPER = ['ink', 'ink-soft'];

const MIN = 4.5;
const failures = [];
for (const name of ['village', 'woods', 'desert', 'cliffs', 'summit', 'blood']) {
  const contrast = ratio(token(THEMES.light, name), token(THEMES.light, 'paper'));
  if (contrast < 4.5) failures.push(`Light region ${name} fails on paper: ${contrast.toFixed(2)}`);
}
for (const name of [
  'series-1',
  'series-2',
  'series-3',
  'series-4',
  'series-5',
  'feedback-correct',
  'feedback-medium',
  'feedback-wrong',
]) {
  const contrast = ratio(token(THEMES.dark, name), token(THEMES.dark, 'paper'));
  if (contrast < 4.5) failures.push(`${name} fails on paper: ${contrast.toFixed(2)}`);
}
const lines = [];

for (const [theme, block] of Object.entries(THEMES)) {
  for (const [roles, surfaces] of [
    [ON_CHROME, CHROME],
    [ON_PAPER, SHEETS],
  ]) {
    for (const fg of roles) {
      const measured = surfaces.map((bg) => ({ bg, r: ratio(token(block, fg), token(block, bg)) }));
      const worst = measured.reduce((a, b) => (b.r < a.r ? b : a));
      if (worst.r < MIN)
        failures.push(`${theme}: ${fg} on ${worst.bg} is ${worst.r.toFixed(2)}:1, below ${MIN}:1`);
      lines.push(
        `  ${theme.padEnd(5)} ${fg.padEnd(14)} ${worst.r.toFixed(2).padStart(5)}:1  worst on ${worst.bg}`,
      );
    }
  }
}

/* A ramp whose lightness is not monotonic means the token names stop carrying
   meaning — `leather-900` ought to be darker than `leather-850` in whichever
   direction the theme runs, and a developer reading the class name has no
   other signal. This is a warning rather than an error: the light theme is
   knowingly non-monotonic today and rewiring it is its own piece of work. */
const warnings = [];
for (const [theme, block] of Object.entries(THEMES)) {
  const ramp = CHROME.map((n) => ({ n, L: token(block, n).L }));
  const up = ramp.every((s, i) => i === 0 || s.L > ramp[i - 1].L);
  const down = ramp.every((s, i) => i === 0 || s.L < ramp[i - 1].L);
  if (!up && !down) {
    warnings.push(
      `${theme}: the leather ramp is not monotonic — ${ramp.map((s) => `${s.n.slice(8)} ${(s.L * 100).toFixed(0)}`).join(', ')}`,
    );
  }
}

console.log('contrast — worst surface per text role\n' + lines.join('\n'));
for (const w of warnings) console.log('\nWARN  ' + w);

if (failures.length) {
  console.log(`\n${failures.length} contrast failure(s):`);
  for (const f of failures) console.log('  x ' + f);
  process.exit(1);
}
console.log(`\nok — every text role clears ${MIN}:1 on every surface it can land on`);
