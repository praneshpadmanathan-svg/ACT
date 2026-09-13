/* The juice bus — impact feedback, in one place.

   A hit in a game is not an animation. It is several things inside a tenth of a
   second: a sound, a pause, a kick, a flash. Individually each one is trivial
   and none of them reads as force on its own; fired together on the same frame
   they do. The app had the sound and, sometimes, one visual, and never at the
   same moment as each other.

   So this is one module every surface calls instead of calling `sfx` directly.
   Screens describe what happened — `juice.correct()` — and the bus decides what
   that looks like, which means the answer is the same everywhere and tuning it
   is one edit rather than fourteen.

   See docs/game-feel-plan.md, items 279-283.

   Three things it deliberately does not do:

   It does not go through React. A shake writes to `style.transform` sixty times
   a second; routing that through state would re-render the tree on every frame
   to move one element. Nothing here causes a render.

   It does not pause the world. Real hit-stop freezes the game loop, and the web
   equivalent — pausing every running animation — costs two full style recalcs
   across the whole document for a 50ms effect, on a page that can have 240
   animations running. On a quiz screen there is no continuous motion to freeze
   anyway, so `freeze` is a delay before the reaction rather than a pause of the
   world. That is most of the felt weight for none of the cost. A duel, where
   there genuinely is motion to stop, can revisit it.

   It does not decide policy per caller. Reduced motion, the flash budget and
   the kill switch are enforced here, so no screen can forget them. */

import { sfx } from './sfx';

/* ---------------------------------------------------------------- switches */

/** `?juice=0` turns the whole bus off, for debugging a layout under a shake. */
const OFF =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('juice') === '0';

let reduceQuery: MediaQueryList | null = null;

/* Read live rather than cached: the setting can change while the app is open,
   and someone turning it on mid-session is exactly the person who needs it to
   take effect without a reload. */
function prefersReduced(): boolean {
  if (typeof window === 'undefined') return false;
  reduceQuery ??= window.matchMedia('(prefers-reduced-motion: reduce)');
  return reduceQuery.matches;
}

/* --------------------------------------------------------------- the stage

   The element a shake moves. `App` registers it; see the note there for why it
   wraps what it wraps.

   The transform is applied only while a shake is running and removed — not
   zeroed — when it stops. A transform on an ancestor becomes the containing
   block for `position: fixed` descendants, which would pin a fixed overlay to
   the stage instead of the viewport and drop it by the scroll offset. Leaving
   `translate3d(0,0,0)` behind would make that permanent. `will-change` would
   too, which is why it is not set here: it buys a layer promotion this does not
   need, and pays for it with the same bug. */

let stage: HTMLElement | null = null;

export function registerStage(el: HTMLElement | null): void {
  // Any shake in flight was aimed at the outgoing element; retire it.
  shakeGen++;
  if (stage) stage.style.transform = '';
  stage = el;
}

/* ---------------------------------------------------------------- the shake */

/** Pixels of travel at full power. Small on purpose: a UI shake that reads as
 *  violent on a 27-inch monitor is nauseating on a phone held at arm's length. */
const MAX_TRAVEL_PX = 14;

/** Milliseconds for the amplitude to fall by a factor of e. */
const DECAY_MS = 90;

/** Below this the movement is sub-pixel and only costs frames. */
const FLOOR_PX = 0.35;

let shakeFrame: number | null = null;

/* Which shake a queued frame belongs to.

   `cancelAnimationFrame` is not enough on its own. A callback already dispatched
   for the current frame cannot be cancelled, so a second `shake()` — or the
   teardown below — can cancel the *next* frame while a stale closure is still
   about to run and write a transform nobody asked for. Verified: a frame
   arriving after teardown put a transform straight back on the stage, which is
   the containing-block bug this file exists to avoid.

   Bumping a counter makes every superseded closure a no-op, so the invariant
   holds by construction rather than by trusting the cancel to win a race. */
let shakeGen = 0;

export type ShakeAxis = 'both' | 'x' | 'y';

/**
 * Kick the stage. `power` is 0–1 and scales everything, so one number tunes a
 * whole reaction.
 *
 * The axis carries meaning and is worth choosing rather than defaulting:
 * vertical movement reads as impact, horizontal reads as refusal. A wrong
 * answer shaking up and down says something hit you; side to side says no.
 */
export function shake(power = 0.5, axis: ShakeAxis = 'both'): void {
  if (OFF || prefersReduced() || !stage) return;

  const el = stage;
  const peak = Math.max(0, Math.min(1, power)) * MAX_TRAVEL_PX;
  const startedAt = performance.now();
  const gen = ++shakeGen;

  if (shakeFrame !== null) cancelAnimationFrame(shakeFrame);

  /* Decayed on elapsed time, not on frames. A per-frame multiplier would make
     the shake half as long on a 120Hz display as on a 60Hz one. */
  const step = (now: number) => {
    if (gen !== shakeGen) return;
    const amp = peak * Math.exp(-(now - startedAt) / DECAY_MS);
    if (amp < FLOOR_PX) {
      el.style.transform = '';
      shakeFrame = null;
      return;
    }
    const x = axis === 'y' ? 0 : (Math.random() * 2 - 1) * amp;
    const y = axis === 'x' ? 0 : (Math.random() * 2 - 1) * amp;
    el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    shakeFrame = requestAnimationFrame(step);
  };

  shakeFrame = requestAnimationFrame(step);
}

/* ---------------------------------------------------------------- the flash */

export type Tone = 'gold' | 'ruin' | 'cold';

const TONE_RGB: Record<Tone, string> = {
  gold: '242, 207, 91',
  ruin: '176, 74, 52',
  cold: '150, 160, 178',
};

/* WCAG 2.3.1 allows three flashes in any one second, where a flash is a change
   crossing 10% relative luminance. The tinted washes below peak at 14% opacity
   over a near-black ground and do not come close to that bar — but the budget
   is enforced anyway, and enforced *here* rather than in each caller, because
   the failure mode is a screen nobody planned: three surfaces each firing their
   own perfectly reasonable single flash at the same moment.

   A suppressed flash is dropped, not queued. A flash that arrives late is a
   flash attached to nothing. */
const MAX_FLASHES_PER_SECOND = 3;
const flashLog: number[] = [];

let flashEl: HTMLDivElement | null = null;

function flashLayer(): HTMLDivElement {
  if (flashEl) return flashEl;
  const el = document.createElement('div');
  el.className = 'juice-flash';
  el.setAttribute('aria-hidden', 'true');
  document.body.appendChild(el);
  flashEl = el;
  return el;
}

/**
 * A wash of colour across the viewport. Not a camera flash — it comes in from
 * the edges and leaves the middle alone, so it reads as the world reacting
 * rather than a light being switched on in the reader's face.
 */
export function flash(tone: Tone = 'gold', power = 0.5): void {
  if (OFF || typeof document === 'undefined') return;

  const now = performance.now();
  while (flashLog.length && now - flashLog[0]! > 1000) flashLog.shift();
  if (flashLog.length >= MAX_FLASHES_PER_SECOND) return;
  flashLog.push(now);

  const soft = prefersReduced();
  const peak = Math.max(0, Math.min(1, power)) * (soft ? 0.09 : 0.14);

  const el = flashLayer();
  el.style.setProperty('--juice-tone', TONE_RGB[tone]);

  /* Slower and dimmer under reduced motion, so the same event still registers
     as feedback but arrives as a tint rather than as a flash. */
  el.animate([{ opacity: String(peak) }, { opacity: '0' }], {
    duration: soft ? 620 : 260,
    easing: 'ease-out',
  });
}

/* --------------------------------------------------------------- the pause */

/**
 * The beat between the hit landing and the world answering for it. See the note
 * at the top of the file for why this is a delay rather than a freeze.
 *
 * Never gate input on this. It resolves off `setTimeout`, which keeps running in
 * a hidden tab — unlike `requestAnimationFrame`, which does not — but a caller
 * that will not accept a tap until a reaction finishes is a caller that can be
 * stalled by anything.
 */
export function freeze(ms: number): Promise<void> {
  if (OFF || ms <= 0) return Promise.resolve();
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/* ------------------------------------------------------------------ the hit */

export interface HitOpts {
  /** 0–1. Scales travel and flash together. */
  power?: number;
  /** Omit for no flash. */
  tone?: Tone | null;
  axis?: ShakeAxis;
  /** Fired at contact, before the pause. */
  sound?: () => void;
  /** The beat between contact and reaction. */
  pause?: number;
}

/**
 * One call: sound at contact, a beat, then the world answers.
 *
 * The ordering is the point. Firing everything on the same tick produces a
 * blur of feedback; the sound landing first and the reaction arriving a moment
 * later is what reads as cause and effect.
 */
export async function hit({
  power = 0.5,
  tone = null,
  axis = 'both',
  sound,
  pause = 45,
}: HitOpts = {}): Promise<void> {
  if (OFF) {
    sound?.();
    return;
  }
  sound?.();
  await freeze(pause);
  shake(power, axis);
  if (tone) flash(tone, power);
}

/* ------------------------------------------------------------- going away

   Everything above is driven by the frame clock, and the frame clock stops when
   the page is hidden. Measured, not assumed: with the tab in the background
   `requestAnimationFrame` fires zero times and `document.timeline.currentTime`
   does not advance at all, so an effect interrupted by a tab switch does not
   finish — it freezes exactly where it was and stays there until the page comes
   back.

   For the flash that is cosmetic; `fill: none` means it cannot outlive its own
   interval once the clock restarts. For the shake it is not, because a frozen
   shake leaves a transform on the stage, and a transform on the stage is a
   containing block for every `position: fixed` descendant for as long as it
   sits there. The region backdrop is fixed, and so are the toasts, Wizzy and
   the flash itself. That is a layout bug waiting for someone to switch tabs at
   the wrong moment, and it would be almost impossible to reproduce on purpose.

   So both are torn down on the way out. The effect is lost rather than
   completed, which is the right trade: an impact that lands while nobody is
   looking has nothing left to communicate. */
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    shakeGen++;
    if (shakeFrame !== null) {
      cancelAnimationFrame(shakeFrame);
      shakeFrame = null;
    }
    if (stage) stage.style.transform = '';
    flashEl?.getAnimations().forEach((a) => a.cancel());
    flashLog.length = 0;
  });
}

/* -------------------------------------------------------------- the presets

   What screens actually call. Keeping the numbers here rather than at the call
   sites is the whole point of the module: a correct answer feels the same in a
   drill, a zone and a boss, and making it feel different is one edit. */

export interface PresetOpts {
  /* False during a timed test, where the app deliberately withholds whether an
     answer was right until the end.

     Only the visuals are withheld. The sound still fires, because that is what
     the app already did before this module existed and changing it is a
     separate decision about test fidelity, not a side effect of adding shake.
     Worth noting that it *is* a decision someone should make: an audible
     right-answer cue during a mock test tells a student something the real ACT
     never would. */
  visuals?: boolean;
}

export const juice = {
  registerStage,
  shake,
  flash,
  freeze,
  hit,

  /** A right answer. Warm, light, and over quickly — this fires hundreds of
   *  times a session and anything heavier would wear out by the third zone. */
  correct({ visuals = true }: PresetOpts = {}): void {
    if (!visuals) {
      sfx.correct();
      return;
    }
    void hit({ power: 0.35, tone: 'gold', sound: () => sfx.correct(), pause: 45 });
  },

  /** A wrong answer. Sideways only, and no flash: being wrong should register
   *  as a refusal, not as a punishment. Deliberately quieter than `correct` —
   *  the app's own sound design already made this call, and the visuals should
   *  not undo it. */
  wrong({ visuals = true }: PresetOpts = {}): void {
    if (!visuals) {
      sfx.wrong();
      return;
    }
    void hit({ power: 0.26, axis: 'x', sound: () => sfx.wrong(), pause: 55 });
  },

  /** A streak reaching a tier, on top of the correct answer that earned it.
   *  No pause: the answer's own beat already happened and a second one would
   *  read as a stutter. */
  combo(n: number, { visuals = true }: PresetOpts = {}): void {
    if (!visuals) {
      sfx.combo(n);
      return;
    }
    void hit({
      power: Math.min(0.3 + n * 0.08, 0.7),
      tone: 'gold',
      sound: () => sfx.combo(n),
      pause: 0,
    });
  },
};
