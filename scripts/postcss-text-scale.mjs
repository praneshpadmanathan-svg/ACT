/* Make every font size in the compiled stylesheet respond to one variable.
 *
 * The student's complaint was "no way to make the text bigger on my phone".
 * The usual answer — set `html { font-size }` and let `rem` do the work —
 * does not apply here: this codebase sets type in arbitrary pixel values
 * (`text-[15px]`, `text-[13.5px]`) in about six hundred places, and pixels do
 * not care what the root font size is. Rewriting all of them to `rem` would
 * change every rendered size on the site and is a much larger diff than this.
 *
 * The other tempting answer is `zoom` on the content wrapper. That scales the
 * boxes too, so at 130% a phone gets larger text *and* larger padding, larger
 * gaps and a narrower measure — the line length gets worse exactly when the
 * person asking for bigger text needs it to get better.
 *
 * So: a build step. Every `font-size` declaration Tailwind and this
 * stylesheet emit is wrapped in `calc(… * var(--text-scale, 1))`. The text
 * grows; the padding, the gaps and the grid do not. `calc` multiplies any
 * length by a unitless number, so this works unchanged on `px`, `rem`, `em`
 * and even the `clamp()` in `.heading` — which is why the value is wrapped
 * whole rather than parsed and rebuilt.
 *
 * Runs after Tailwind in the postcss chain, so it catches generated utility
 * classes as well as the hand-written components layer.
 */

/** Values that are not lengths and must be left alone. */
const KEYWORDS = new Set([
  'inherit',
  'initial',
  'unset',
  'revert',
  'revert-layer',
  'xx-small',
  'x-small',
  'small',
  'medium',
  'large',
  'x-large',
  'xx-large',
  'xxx-large',
  'smaller',
  'larger',
]);

/** @returns {import('postcss').Plugin} */
export default function textScale({ variable = '--text-scale' } = {}) {
  const token = `var(${variable}, 1)`;

  return {
    postcssPlugin: 'act-command:text-scale',
    Declaration: {
      'font-size': (decl) => {
        const value = decl.value.trim();

        // Already wrapped (a second pass, or hand-written), or a keyword.
        if (value.includes(variable)) return;
        if (KEYWORDS.has(value.toLowerCase())) return;

        /* A bare `0` is legal and scaling it is a no-op, but wrapping it in
           calc costs bytes for nothing. Percentages are relative to the
           parent, which is already scaled — scaling again would compound. */
        if (value === '0' || value.endsWith('%')) return;

        decl.value = `calc((${value}) * ${token})`;
      },
    },
  };
}

textScale.postcss = true;
