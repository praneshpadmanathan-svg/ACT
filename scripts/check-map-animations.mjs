/* Two rules about map scenery that a typecheck cannot see, and that have each
   already shipped a bug.

   Rule 1 — keyframes must preserve the centring transform.
     `.mapfx > span` applies `transform: translate(-50%, -50%)` to position an
     effect by its middle. A @keyframes block that sets `transform` without
     re-including that translate makes the element jump half its own size the
     instant the animation starts. Classes that deliberately anchor to their
     left edge opt out with `transform: none` and are skipped.

   Rule 2 — an `animation` shorthand needs a duration somewhere.
     Most effects get theirs from an inline style, because each instance runs
     on its own clock. But a shorthand with no <time> and no inline duration
     computes to 0s, and the effect silently never runs. That is how the
     citadel banner sat motionless from the day it was added.

   Run: node scripts/check-map-animations.mjs   (also runs in `npm run build`)
*/

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const css = readFileSync(join(root, 'src/index.css'), 'utf8');

/** Every .tsx under src/game, where the effects are rendered. */
const sources = readdirSync(join(root, 'src/game'))
  .filter((f) => f.endsWith('.tsx'))
  .map((f) => readFileSync(join(root, 'src/game', f), 'utf8'))
  .join('\n');

const failures = [];

/* ------------------------------------------------- rule 1: centring kept

   Only `.mapfx > span` gets the centring, so three groups are legitimately
   exempt and are listed rather than guessed at. An earlier version of this
   script inferred membership from whether a class name appeared anywhere in
   the source, which flagged all three and buried the one real bug in ten
   false positives.

   Verified against the source, and each is checkable in one grep:
     - nested inside another effect, so never a direct child of .mapfx
     - rendered by DiscoveryLayer, which is a *sibling* of <MapFx /> in
       AdventureMap.tsx, so it is not inside the .mapfx layer at all
     - anchored to its own left edge via `transform: none`, in CSS or inline

   Note the rule checks the X centring only. Effects that fall, rise or drift
   vertically keep `translate(-50%, …)` and animate the Y freely; that is
   correct and must not be flagged. */
const EXEMPT = new Set([
  // nested children of a crossing track
  'mapfx-wing', 'mapfx-cloud-body', 'mapfx-cloud-shadow', 'mapfx-squall',
  // rendered by DiscoveryLayer, outside the .mapfx layer
  'mapfx-grey-flash', 'mapfx-grey-tendril', 'mapfx-mist',
]);

/** Classes anchoring to their left edge — `transform: none` in CSS or inline. */
const optedOut = new Set([
  ...[...css.matchAll(/\.(mapfx-[a-z-]+)\s*\{[^}]*?transform:\s*none/gs)].map((m) => m[1]),
  ...[...sources.matchAll(/className="(mapfx-[a-z-]+)"[\s\S]{0,400}?transform:\s*'none'/g)].map(
    (m) => m[1],
  ),
]);

/** class -> the keyframe name it animates. */
const usesKeyframe = new Map();
for (const m of css.matchAll(/\.(mapfx-[a-z-]+)\s*\{([^}]*)\}/gs)) {
  const animation = /animation:\s*([a-z0-9-]+)/i.exec(m[2]);
  if (animation) usesKeyframe.set(m[1], animation[1]);
}

/* `\n {2}\}` rather than a literal two spaces: this depends on the closing
   brace of a keyframe block sitting at exactly one indent level, and two
   spaces you have to count are two spaces somebody eventually miscounts. */
for (const m of css.matchAll(/@keyframes\s+(fx-[a-z0-9-]+)\s*\{([\s\S]*?)\n {2}\}/g)) {
  const [, name, body] = m;

  const drivers = [...usesKeyframe.entries()]
    .filter(([, k]) => k === name)
    .map(([c]) => c)
    .filter((c) => !EXEMPT.has(c) && !optedOut.has(c));
  if (!drivers.length) continue;

  for (const t of body.matchAll(/transform:\s*([^;]+);/g)) {
    const value = t[1].trim();
    if (!/^translate\(-50%,/.test(value)) {
      failures.push(
        `${name}: "transform: ${value}" drops the centring.\n` +
          `    Driven by .${drivers.join(', .')}, a direct child of .mapfx, so it will\n` +
          `    jump half its own width when the animation starts. Keep translate(-50%, …)\n` +
          `    as the first function; the Y value is yours to animate.`,
      );
    }
  }
}

/* ------------------------------------------- rule 2: a duration exists */

const TIME = /\b\d*\.?\d+m?s\b/;

for (const m of css.matchAll(/\.(mapfx-[a-z-]+)\s*\{([^}]*)\}/gs)) {
  const [, cls, block] = m;
  const shorthand = /animation:\s*([^;]+);/.exec(block);
  if (!shorthand) continue;
  if (TIME.test(shorthand[1])) continue;

  // No time in the shorthand — an inline animationDuration must supply it.
  // Look for the class being rendered with one nearby.
  const rendered = new RegExp(
    `className="${cls}"[\\s\\S]{0,400}?animationDuration|` +
      `animationDuration[\\s\\S]{0,400}?className="${cls}"`,
  ).test(sources);

  if (!rendered) {
    failures.push(
      `.${cls}: "animation: ${shorthand[1].trim()}" has no duration,\n` +
        `    and no inline animationDuration was found for it. It computes to 0s\n` +
        `    and will never run.`,
    );
  }
}

/* ----------------------------------------------------------------- report */

if (failures.length) {
  console.error(`\n  map animation check failed — ${failures.length} problem(s):\n`);
  for (const f of failures) console.error(`  • ${f}\n`);
  process.exit(1);
}

console.log('  map animation check: keyframes keep their centring, every animation has a duration');
