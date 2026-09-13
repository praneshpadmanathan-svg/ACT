/* Decorative Unicode glyphs do not belong in component markup.
 *
 * The app had arrows and stars typed straight into JSX — `← Back`, `Next ▶`,
 * `✦` as a bullet. Three things are wrong with that:
 *
 *   · they render in whatever font happens to resolve them, which is not one
 *     of the app's four faces, so they arrive at a different weight and
 *     baseline on every OS;
 *   · they do not scale with the type around them and cannot take a stroke
 *     width, so they never match a real icon set;
 *   · a screen reader says "black right-pointing triangle" in the middle of a
 *     button label.
 *
 * Utility icons come from the app's own set instead — `<Glyph>` in
 * `src/components/Icon.tsx`, drawn on the same 24×24 grid and the same 1.7px
 * round-capped stroke as the nav. That file exists precisely so the app never
 * falls back to a character, and pulling in an off-the-shelf icon package
 * would have put a second, foreign stroke weight next to it — the same
 * inconsistency one level up. Identity glyphs — the tent, map, book, sword,
 * shield and crown in NavGlyph — stay hand-drawn for the same reason; they are
 * SVG paths, not characters, so nothing here touches them.
 *
 * Typography is explicitly NOT the target: em dashes, ellipses, curly quotes
 * and the guillemets that mark underlined spans in the question bank are all
 * correct and stay. Content files are exempt for the same reason.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* Arrows, triangles, stars, ticks, crosses, the heraldic marks that crept into
   the eyebrow strings, and every emoji.

   Deliberately NOT banned, because each is real typography or real content:
   — – … ‘ ’ “ ” « » ° × · • (the password field's dots), − (U+2212, the true
   minus sign in question text) and √ (the calculator's square-root key, where
   the character *is* the label). */
const BANNED =
  /[←→↑↓↔⇒⇐▶◀▸◂▴▾►◄▲▼✦✧★☆✪✓✔✗✘✕✖➜➔⟶⚑⚐⚔⚠☀☁☹☺♦♠♣♥]|\p{Extended_Pictographic}/gu;

/* `IconName` values, not free text — the suggestion is meant to be pasteable.
   A glyph with no entry is still banned; it just has no obvious house icon
   yet, which is a prompt to draw one rather than to type the character. */
const NAMES = {
  '←': 'arrowLeft',
  '→': 'arrowRight',
  '↑': 'chevronUp',
  '↓': 'chevronDown',
  '▶': 'chevronRight',
  '▸': 'chevronRight',
  '◀': 'chevronLeft',
  '◂': 'chevronLeft',
  '▲': 'chevronUp',
  '▼': 'chevronDown',
  '★': 'star',
  '☆': 'star',
  '✦': 'spark',
  '✧': 'spark',
  '✓': 'check',
  '✔': 'check',
  '✕': 'cross',
  '✖': 'cross',
  '✗': 'cross',
  '✘': 'cross',
  '⚑': 'flag',
  '⚐': 'flag',
  '⚔': 'sword',
  '⚠': 'alert',
  '☀': 'calendar',
  '🔒': 'lock',
  '🔥': 'flame',
  '⭐': 'star',
  '🏆': 'trophy',
  '🎯': 'target',
};

/* Comments are prose written for people and may contain anything. Stripping
   them first is what keeps this from flagging the explanation of itself.
   Replaced with equal-length blanks so reported line numbers stay true. */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + m.slice(p.length).replace(/./g, ' '));
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(entry) && !/\.test\.tsx$/.test(entry)) out.push(p);
  }
  return out;
}

const findings = [];
for (const dir of ['src/components', 'src/screens', 'src/game']) {
  for (const file of walk(join(ROOT, dir))) {
    const raw = readFileSync(file, 'utf8');
    const code = stripComments(raw);
    const lines = code.split('\n');
    lines.forEach((line, i) => {
      for (const m of line.matchAll(BANNED)) {
        findings.push({
          file: relative(ROOT, file).replace(/\\/g, '/'),
          line: i + 1,
          glyph: m[0],
          text: raw.split('\n')[i].trim().slice(0, 92),
        });
      }
    });
  }
}

if (!findings.length) {
  console.log('ok — no decorative glyphs in component markup');
  process.exit(0);
}

const byGlyph = findings.reduce((t, f) => ((t[f.glyph] = (t[f.glyph] ?? 0) + 1), t), {});
console.log(`${findings.length} decorative glyph(s) in markup:\n`);
for (const f of findings) {
  console.log(`  ${f.file}:${f.line}`);
  console.log(`    ${f.glyph}  ${f.text}`);
}
console.log('\nreplace with <Glyph> from src/components/Icon.tsx:');
for (const [g, n] of Object.entries(byGlyph)) {
  const name = NAMES[g];
  console.log(
    name
      ? `  ${g} x${n}  ->  <Glyph name="${name}" size={14} />`
      : `  ${g} x${n}  ->  no house icon yet — draw one in Icon.tsx`,
  );
}
console.log('\nA trailing chevron on a <Button> is the `trailing` prop, not an icon child.');
process.exit(1);
