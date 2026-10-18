/* Route changes as one movement instead of a cut.

   Same-document View Transitions (Baseline since October 2025: Chrome 111,
   Safari 18, Firefox 144) let the browser snapshot the outgoing screen, apply
   the change, and animate between the two — on the compositor, with the new
   screen already live underneath. That is the platform doing what this app
   used to approximate with a 40%-opacity fade-in.

   Three parts, all styled in index.css under "view transitions":

   - The chrome stays put. The rail and the top bar carry their own transition
     names with no animation, so navigating reads as the page changing inside
     a fixed frame rather than the whole window being swapped.
   - The page moves. Root crossfades with a small lift: the old screen rises a
     few pixels as it dissolves, the new one settles up into place.
   - Things enter from where they came from (premium-redesign-plan §7). The
     card or button you pressed inside the page is named `vt-origin` for the
     old snapshot, and the new page's heading takes the name for the new one,
     so the thing you chose visibly becomes the title of where you arrived.

   And the rule that governs every animation in this app (lib/motion.tsx):
   nothing may wait on one. A transition is only started when it can run — a
   visible tab, a supporting browser, no reduced-motion preference — and the
   update callback applies the route change synchronously whatever happens to
   the animation. A skipped or failed transition changes nothing but the look. */

import { flushSync } from 'react-dom';

type Doc = Document & {
  startViewTransition?: (update: () => void | Promise<void>) => {
    finished: Promise<void>;
    skipTransition: () => void;
  };
};

/* The last control pressed inside the page, if recent. A route change more
   than this long after a press was not caused by it (a timer, a redirect). */
const ORIGIN_WINDOW_MS = 700;
let pressed: { el: Element; at: number } | null = null;

if (typeof document !== 'undefined') {
  document.addEventListener(
    'click',
    (e) => {
      const el = e.target instanceof Element ? e.target.closest('a[href], button') : null;
      /* Only presses inside the page. A rail item flying into the heading
         would be the navigation moving, which is exactly what the fixed
         chrome is there to prevent. */
      pressed = el && el.closest('#main') ? { el, at: performance.now() } : null;
    },
    true,
  );
}

function reduced(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** A pressed element that can sensibly morph: still on the page, on screen,
 *  and not so large that scaling it into a heading reads as the page tearing. */
function originOf(): HTMLElement | null {
  if (!pressed || performance.now() - pressed.at > ORIGIN_WINDOW_MS) return null;
  const el = pressed.el;
  if (!(el instanceof HTMLElement) || !el.isConnected) return null;
  const r = el.getBoundingClientRect();
  const visible = r.bottom > 0 && r.top < window.innerHeight && r.width > 0;
  const modest = r.width * r.height < window.innerWidth * window.innerHeight * 0.35;
  return visible && modest ? el : null;
}

const ORIGIN = 'vt-origin';

/** How long the update step may wait for the new screen's heading. Rendering
 *  is held for that long, so it is short: under a fifth of a second. */
const HEADING_WAIT_MS = 180;

/* Timers, not animation frames: the browser suppresses rendering — and with
   it frame callbacks — while a transition's update step is pending. */
function heading(ms: number): Promise<HTMLElement | null> {
  const find = () => document.querySelector<HTMLElement>('#main h1');
  return new Promise((resolve) => {
    const started = performance.now();
    const look = () => {
      const h = find();
      if (h || performance.now() - started >= ms) resolve(h);
      else window.setTimeout(look, 16);
    };
    look();
  });
}

/**
 * Apply a route change, animated when the browser can.
 *
 * `apply` must perform the whole change — it is run synchronously inside the
 * transition's update callback, wrapped in `flushSync` so React has committed
 * the new screen before the browser snapshots it.
 */
export function transition(apply: () => void): void {
  const doc = document as Doc;
  if (!doc.startViewTransition || document.hidden || reduced()) {
    apply();
    return;
  }

  const origin = originOf();
  pressed = null;
  /* Transition names exist only while a transition runs (index.css keys
     them off this), so they can never change stacking or layout otherwise.
     Also switches off the old CSS page fade, which would double up. */
  const root = document.documentElement;
  root.dataset.vt = '';
  if (origin) origin.style.viewTransitionName = ORIGIN;
  let target: HTMLElement | null = null;

  const vt = doc.startViewTransition(async () => {
    /* The old snapshot is taken; the name has done its job on the way out
       and must not collide with the heading on the way in. */
    if (origin) origin.style.viewTransitionName = '';
    // The route change itself, applied now and unconditionally.
    flushSync(apply);
    if (!origin) return;
    /* Most screens are lazy, so straight after the change the page can still
       be its loading placeholder, with no heading to arrive at. Wait for it
       briefly: the new screen is already applied and simply not yet shown,
       and the chunk is usually prefetched. Past the cap, the pressed card
       gets a quick exit of its own instead of fading as a ghost over the
       new page. */
    target = await heading(HEADING_WAIT_MS);
    if (target) target.style.viewTransitionName = ORIGIN;
    else root.dataset.vtLone = '';
  });

  const clear = () => {
    delete root.dataset.vt;
    delete root.dataset.vtLone;
    if (origin) origin.style.viewTransitionName = '';
    if (target) target.style.viewTransitionName = '';
  };
  /* `finished` also rejects when a transition is skipped (a second
     navigation inside the first, say). Either way the names come off. */
  vt.finished.then(clear, clear);
}
