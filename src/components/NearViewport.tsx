/* Render children once they are within a screen and a half of the viewport.
 *
 * Written for the landing page's "try one question" section, which is the only
 * thing on the front door that needs the question bank. The measurement is the
 * whole argument for it: `lazy` alone took the 607 kB bank off the critical
 * path — it stopped being a `modulepreload` in the HTML — but React mounts a
 * lazy component as soon as the page renders, so the bank was still fetched
 * 93 ms after load, on every single visit. Off the critical path is not the
 * same as not downloaded. Someone who read the promise, decided this was not
 * for them and closed the tab was paying for 754 questions they never saw.
 *
 * 150% of the viewport as the margin, because the point is not to defer the
 * fetch until the section is visible — that would put a placeholder in front of
 * the one interactive thing on the page. It is to start the fetch when
 * scrolling says someone is heading that way, which at any normal reading pace
 * is several seconds of runway.
 *
 * Two independent triggers, because the failure mode of this optimisation must
 * be the old behaviour and never a section that silently does not exist:
 *
 *   1. No `IntersectionObserver` at all — render immediately.
 *   2. An observer that exists and never fires — render after a timeout.
 *
 * The second is not defensive programming against a hypothetical. It was
 * observed: in an embedded browser view that does not composite frames, the
 * observer constructs and `observe()` succeeds, but no callback is ever
 * delivered — not on scroll, not even the initial one, and not with a zero
 * margin. Keyed only on the observer, the section rendered as 420 px of
 * nothing, permanently, on the page whose entire job is to persuade someone.
 * A hidden or backgrounded tab throttles rendering the same way, which is the
 * ordinary-browser version of the same trap.
 *
 * Ten seconds for the backstop. Long enough that the common case is still the
 * observer firing first and a bounce still costing nothing — someone who reads
 * the promise and leaves is gone well inside it — and short enough that anybody
 * actually reading the page has the content long before they scroll to it.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';

export const FALLBACK_MOUNT_MS = 10_000;

export function NearViewport({
  children,
  minHeight,
}: {
  children: ReactNode;
  /** Height held while the children are still unmounted, so the page does not
   *  jump when they arrive. Pass the same height the Suspense fallback uses. */
  minHeight: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    if (near) return;
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: '150% 0px' },
    );
    io.observe(el);

    const backstop = window.setTimeout(() => setNear(true), FALLBACK_MOUNT_MS);
    return () => {
      io.disconnect();
      window.clearTimeout(backstop);
    };
  }, [near]);

  return (
    <div ref={ref} style={near ? undefined : { minHeight }}>
      {near ? children : null}
    </div>
  );
}
