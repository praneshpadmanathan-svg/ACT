/* "Has this been looked at yet?", with the same two backstops `NearViewport`
 * carries — and for the same reason, which is worth restating because it is not
 * a hypothetical.
 *
 * An `IntersectionObserver` can construct successfully, accept `observe()`, and
 * then never deliver a callback: not on scroll, not the initial one. It happens
 * in embedded browser views that do not composite frames, and it happens in a
 * backgrounded tab. Anything keyed only on the observer is therefore keyed on
 * something that is allowed to never happen.
 *
 * For `NearViewport` the consequence was a section of the landing page that
 * silently did not exist. Here it would be a headline number frozen at zero on
 * the page whose whole job is to say how many questions there are — a worse
 * failure than no animation at all, because it states something false.
 *
 * So: no observer means true immediately, and an observer that has not fired
 * inside the backstop means true anyway. The effect is an enhancement with a
 * deadline, never a gate.
 */

import { useEffect, useRef, useState } from 'react';

/** Long enough that the common case is always the observer winning, short
 *  enough that a stuck one is invisible to anybody actually reading. */
export const IN_VIEW_FALLBACK_MS = 2_500;

export function useInView<T extends Element>(rootMargin = '0px 0px -12% 0px') {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    if (seen) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setSeen(true);
      },
      { rootMargin },
    );
    observer.observe(el);
    const backstop = window.setTimeout(() => setSeen(true), IN_VIEW_FALLBACK_MS);

    return () => {
      observer.disconnect();
      window.clearTimeout(backstop);
    };
    /* `seen` is deliberately in the deps and deliberately one-way: once it is
       true the effect tears the observer down and never sets it up again. This
       answers "has it been seen", not "is it on screen now". */
  }, [seen, rootMargin]);

  return [ref, seen] as const;
}
