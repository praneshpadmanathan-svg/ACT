/* Motion setup and shared presets.

   The ambient scenery on the map stays in CSS — 170-odd elements on infinite
   GPU-composited keyframes is exactly what CSS is best at, and handing that to
   JavaScript would cost frames for nothing. Motion is here for the things CSS
   genuinely cannot do:

     - exit animations (an element leaving the DOM)
     - springs, so motion decelerates like weight rather than on a curve
     - orchestrated stagger, where children are timed off their parent
     - animating to a value computed at runtime

   Bundle: the full `motion` component is ~34kb, so this uses the `m` component
   with LazyMotion and the `domAnimation` feature set instead, which is about
   4.6kb. `domAnimation` covers enter/exit, variants and stagger — it excludes
   layout projection and drag, neither of which we use.

   `MotionConfig reducedMotion="user"` makes Motion drop transform and layout
   animation for anyone who asks the OS for reduced motion, matching what the
   media query in index.css already does to the CSS keyframes. */

import { type ReactNode } from 'react';
import { LazyMotion, MotionConfig } from 'motion/react';

/* Fetched as its own chunk after first paint — see motionFeatures.ts. */
const loadFeatures = () => import('./motionFeatures').then((mod) => mod.default);

/* Everything comes from the one entry on purpose.

   Sourcing `AnimatePresence` from `motion/react` and `m` from `motion/react-m`
   gives two module instances with two separate presence contexts, so an exiting
   child never registers itself with the AnimatePresence above it. With
   mode="wait" that is fatal rather than cosmetic: the wrapper waits forever for
   an exit that never starts, and the next screen never mounts — every route
   rendered whatever page happened to be showing first.

   LazyMotion still keeps the heavy part out of the initial bundle, and `strict`
   below throws if a full `motion.*` component sneaks in. */
export { AnimatePresence, m, useReducedMotion } from 'motion/react';

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}

/* ------------------------------------------------------- one rule about exits

   Never gate rendering on an animation completing.

   Motion runs on requestAnimationFrame, and a browser stops rAF in a hidden
   tab — measured here at zero frames per second. So anything that waits for an
   animation to finish before it will show content (classically
   `AnimatePresence mode="wait"`) can strand the user on a stale screen the
   moment they switch tabs mid-navigation. Prefer remounting on a key, which
   animates in and cannot get stuck. AnimatePresence is still exported for
   genuinely decorative exits, where failing to finish costs nothing. */

/* ------------------------------------------------------------------ presets

   One place for timing, so motion across the app reads as one hand. Springs
   for anything with a sense of weight, short eases for anything that is just
   getting out of the way. */

/** Settling with weight — bars, counters, things that move to a new value. */
export const SPRING = { type: 'spring', stiffness: 260, damping: 26, mass: 0.9 } as const;

/** A firmer spring for impacts: a hit landing, a pin popping in. */
export const SPRING_SNAP = { type: 'spring', stiffness: 520, damping: 22, mass: 0.7 } as const;

/** Plain and quick, for fades and anything leaving. */
export const EASE = { duration: 0.26, ease: [0.22, 1, 0.36, 1] } as const;

/* --------------------------------------------------------------- variants */

/** A page arriving. There is deliberately no exit — see the note above. */
export const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
} as const;

/** Put on a list; children using `riseItem` then time themselves off it. */
export const staggerList = {
  initial: {},
  animate: { transition: { staggerChildren: 0.045, delayChildren: 0.04 } },
} as const;

export const riseItem = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: SPRING },
} as const;

/** For cards that should feel like they were placed rather than faded in. */
export const popItem = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1, transition: SPRING_SNAP },
} as const;

/* Direct manipulation — a control answering a hand.

   Stiff enough to reach its target in about 90ms, which is inside the window
   where the response still feels like part of the press rather than a reaction
   to it. Damping is deliberately below critical: releasing a pressed control
   carries past its resting size by roughly 6% before settling, and that
   overshoot is the follow-through. It falls out of the physics rather than
   needing a second animation chained onto the first. */
export const PIN_SPRING = { type: 'spring', stiffness: 380, damping: 18, mass: 0.8 } as const;
