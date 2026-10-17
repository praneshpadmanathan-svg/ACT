/* Keep hover styles off devices that cannot hover.
 *
 * A touchscreen has no pointer resting over anything, but mobile browsers
 * still apply `:hover` to whatever was last tapped and leave it there until
 * the next tap lands somewhere else. Every lifted card, gilded border and
 * swept highlight in this stylesheet — about forty hand-written rules and
 * seventy `hover:` utilities — therefore stuck on a phone after a tap: the
 * answer you just picked kept its hover lift beside the verdict, and the nav
 * item you left kept glowing on the next screen.
 *
 * Tailwind has a flag for its own utilities (`hoverOnlyWhenSupported`), but
 * it does nothing for the components layer, which is where most of the hover
 * rules live. So: a build step, like `postcss-text-scale`. Every rule whose
 * selector uses `:hover` is wrapped in `@media (hover: hover)`. A rule that
 * mixes hover and non-hover selectors — `.rail-item:hover .rail-meta,
 * .rail-item-active .rail-meta` — is split, so the active half still applies
 * everywhere.
 *
 * Runs after Tailwind in the postcss chain, so it catches generated utility
 * classes as well as the hand-written components layer. `:active` and
 * `:focus-visible` are untouched: those are the states a touch and a keyboard
 * actually produce.
 */

const QUERY = '(hover: hover)';

/** True when `node` already sits inside a hover media query. */
function insideHoverQuery(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (p.type === 'atrule' && p.name === 'media' && p.params.includes('hover')) return true;
  }
  return false;
}

/** @returns {import('postcss').Plugin} */
export default function hoverOnly() {
  return {
    postcssPlugin: 'act-command:hover-only',
    prepare() {
      /* Rules this plugin created, so a rule moved into its new media query is
         not visited a second time and wrapped again. */
      const done = new WeakSet();
      return {
        Rule(rule, { AtRule }) {
          if (done.has(rule) || !rule.selector.includes(':hover')) return;
          // Keyframe steps are rules too, and never carry a pseudo-class.
          if (rule.parent?.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) return;
          if (insideHoverQuery(rule)) return;

          const hover = rule.selectors.filter((s) => s.includes(':hover'));
          const rest = rule.selectors.filter((s) => !s.includes(':hover'));

          const media = new AtRule({ name: 'media', params: QUERY });
          const moved = rule.clone({ selectors: hover });
          done.add(moved);
          media.append(moved);

          if (rest.length) {
            rule.selectors = rest;
            done.add(rule);
            rule.after(media);
          } else {
            rule.replaceWith(media);
          }
        },
      };
    },
  };
}
hoverOnly.postcss = true;
