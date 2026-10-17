/* Reward feedback: XP popups, toasts, confetti and the rank-up cinematic.

   All of it is driven by explicit store events. Nothing here polls. */

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useStore } from '@/lib/store';
import { RANKS } from '@/lib/progress';
import { useDialogFocus } from '@/lib/useDialogFocus';
import { fx } from '@/lib/fx';
import { Button, RankBadge } from './ui';
import { Glyph } from './Icon';

/* --------------------------------------------------------------- confetti */

/** Fire confetti from anywhere: gold leaf, tumbling and catching the light.
 *
 *  This used to be its own canvas with its own loop, drawing flat coloured
 *  squares — a second full-screen layer running beside the light layer. It
 *  is one preset of that layer now (`fx.confetti` in lib/fx.ts), sharing its
 *  pool, its budget and its frame. Same signature, so callers are unchanged.
 *  Silent under reduced motion, as before: a hundred flakes flung across the
 *  viewport is exactly the motion that setting asks us not to make. */
export function burstConfetti(count = 90, x?: number, y?: number, spread = 18) {
  fx.confetti(count, x, y, spread);
}

/* ------------------------------------------------------------- xp popups */

export function XPPopups() {
  const { xpPops } = useStore();
  return (
    <div
      className="pointer-events-none fixed right-6 top-24 z-[80] flex flex-col items-end gap-1"
      aria-hidden="true"
    >
      {xpPops.map((pop) => (
        <div
          key={pop.id}
          className="animate-rise font-display text-[15px] text-gold"
          style={{
            textShadow: '0 2px 0 oklch(var(--c-leather-950)), 0 0 12px oklch(var(--c-gold) / .6)',
          }}
        >
          +{pop.amount} XP
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- toasts */

export function Toasts() {
  const { toasts, dismissToast } = useStore();
  return (
    /* Bottom-left. Top-right sat squarely on the question HUD — the Exit
       button, the calculator and the clock — at exactly the moment an
       achievement lands, which is mid-question. Bottom-right is the tool dock.

       Except on a phone, where bottom-left is under the thumb: the answer
       that earns an achievement is followed by a "Next question" button the
       runner scrolls to the foot of the screen, and a 340px toast was the
       full width of it. There the toasts sit just under the 56px top bar
       (and the notch): over the top of the page rather than over the button
       the student is about to press. */
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed left-4 z-[90] flex w-[min(340px,calc(100vw-2rem))] flex-col gap-2 max-sm:top-[calc(env(safe-area-inset-top,0px)+4rem)] sm:bottom-4 lg:left-[252px]"
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismissToast(t.id)}
          className="pointer-events-auto flex animate-riseIn items-center gap-3 rounded-lg border-2 border-gold-deep bg-leather-850/95 px-4 py-3 text-left shadow-card backdrop-blur"
          style={{ borderLeftWidth: 6, borderLeftColor: t.color ?? 'oklch(var(--c-gold))' }}
        >
          <Glyph name={t.icon ?? 'spark'} size={17} className="flex-none text-gold" />
          <span className="min-w-0">
            <span className="block font-script text-[13px] uppercase tracking-wide text-parchment">
              {t.title}
            </span>
            {t.detail && (
              <span className="mt-0.5 block text-xs leading-snug text-parchment-dim">
                {t.detail}
              </span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- level up */

/** Long enough to swallow the rest of a double-click or a key's first repeat,
 *  short enough that nobody reaching for "Onward" ever meets it. */
export const DISMISS_GRACE_MS = 450;

export function LevelUpOverlay() {
  const { levelUpRank, dismissLevelUp } = useStore();
  const dialogRef = useRef<HTMLDivElement>(null);

  /* This covers the whole viewport but left the page behind it in the tab
     order — the same gap the story overlay and the road chooser already had
     fixed. A student who ranks up mid-drill could tab straight back into the
     question they cannot see. */
  useDialogFocus(dialogRef, levelUpRank !== null);

  /* The whole screen dismisses this, and it opens in response to an answer —
     so the second click of a double-click on that answer, or a held Enter
     repeating, landed on it and closed the rank-up before it was ever seen.
     A beat of grace after opening absorbs both. Stamped in a layout effect,
     which runs before the browser can deliver the next input event. */
  const openedAt = useRef(0);
  useLayoutEffect(() => {
    if (levelUpRank !== null) openedAt.current = performance.now();
  }, [levelUpRank]);
  const dismiss = useCallback(() => {
    if (performance.now() - openedAt.current < DISMISS_GRACE_MS) return;
    dismissLevelUp();
  }, [dismissLevelUp]);

  useEffect(() => {
    if (levelUpRank === null) return;
    burstConfetti(110, window.innerWidth / 2, window.innerHeight / 2, 22);
    /* Light behind the gold leaf: the seal lands in a shockwave of lamplight.
       Timed to its pop-in (delayed .34s below) and fired from where it
       actually sits, which moves between the stacked and side-by-side layouts. */
    const t0 = window.setTimeout(() => {
      const seal = dialogRef.current?.querySelector('[data-fx-seal]')?.getBoundingClientRect();
      if (seal) fx.celebrate(seal.left + seal.width / 2, seal.top + seal.height / 2);
      else fx.celebrate();
    }, 380);
    const t1 = window.setTimeout(
      () => burstConfetti(60, window.innerWidth / 2 - 220, window.innerHeight / 2 - 60, 16),
      350,
    );
    const t2 = window.setTimeout(
      () => burstConfetti(60, window.innerWidth / 2 + 220, window.innerHeight / 2 - 60, 16),
      500,
    );
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' && e.key !== 'Enter' && e.key !== ' ') return;
      /* Handled here, so a focused "Onward" does not also fire its own click
         from the same key. */
      e.preventDefault();
      if (!e.repeat) dismiss();
    };
    window.addEventListener('keydown', escape);
    return () => {
      window.clearTimeout(t0);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener('keydown', escape);
    };
  }, [levelUpRank, dismiss]);

  if (levelUpRank === null) return null;
  const rank = RANKS[levelUpRank] ?? RANKS[RANKS.length - 1]!;
  const next = RANKS[levelUpRank + 1];

  return (
    <div
      ref={dialogRef}
      className="story-overlay fixed inset-0 z-[110] flex cursor-pointer items-center justify-center overflow-hidden"
      style={{
        background: 'radial-gradient(circle at 50% 42%, rgba(46,37,26,.95), rgba(12,9,6,.97))',
      }}
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
      aria-label={`Rank up — ${rank.name}`}
    >
      {/* lantern rays sweeping the tent */}
      <div
        className="absolute rounded-full"
        style={{
          width: '170vmax',
          height: '170vmax',
          background: `repeating-conic-gradient(from 0deg, ${rank.color}1f 0deg 8deg, transparent 8deg 16deg)`,
          animation: 'spin 26s linear infinite',
        }}
        aria-hidden="true"
      />

      {/* The impact. One flash, tinted to the rank rather than white, gone in
          half a second — it exists to make the stamp land, and anything longer
          becomes a strobe on a screen a teenager is holding at arm's length. */}
      <div
        className="pointer-events-none absolute inset-0 animate-flashOut"
        /* `opacity: 0` is the base state, not the animation's business. The
           keyframe opens at .55 and holds 0 at the end, so it overrides this
           for exactly as long as it runs — and if it ever fails to apply, the
           failure is a flash that never happens rather than a solid sheet of
           rank colour parked over the whole screen forever. */
        style={{ background: rank.color, opacity: 0 }}
        aria-hidden="true"
      />

      {/* Scrollable, and sized off the shorter axis.

          A phone held sideways is 380px tall. The old cinematic stacked badge,
          eyebrow, name, tagline, next-rank line and button down the middle of
          it, and the result — measured, at 740x380 — was the heading starting
          16px above the top of the screen and "Onward" sitting 16px below the
          bottom, inside a container with `overflow-hidden`. The only way out
          was a stray tap on the backdrop, and nothing said so.

          Type now scales off whichever axis is scarcer, and if it still does
          not fit, the column scrolls rather than hiding its own exit. */}
      <div className="relative max-h-full overflow-y-auto px-6 py-8 text-center [@media(max-height:520px)]:py-4">
        {/* RANK UP, at the top and the largest thing on the screen.
            The old version opened with a small "A new rank" eyebrow over the
            rank's name, which is the same information delivered in a whisper:
            you had to already know the seven rank names to understand that
            something had been earned. The event now announces itself, and the
            name of the rank is what you read second. */}
        <div
          className="heading animate-stamp text-[clamp(2.2rem,min(11vw,15vh),5.5rem)] font-bold uppercase leading-none"
          style={{
            color: rank.color,
            WebkitTextStroke: '2px rgba(0,0,0,.55)',
            textShadow: `0 4px 0 rgba(0,0,0,.5), 0 0 46px ${rank.color}aa, 0 0 90px ${rank.color}55`,
          }}
        >
          Rank up
        </div>

        <div
          className="mx-auto my-4 h-px w-40 sm:my-6 [@media(max-height:520px)]:my-2 animate-fadein"
          style={{ background: `linear-gradient(90deg, transparent, ${rank.color}, transparent)` }}
          aria-hidden="true"
        />

        {/* Badge and name on one line from `sm` up. Stacked, the sequence ran
            past the fold on a phone in landscape and the "Onward" button — the
            only way out other than a stray tap — went with it. */}
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6 [@media(max-height:520px)]:gap-2">
          <div className="w-fit animate-popIn [animation-delay:.34s]" data-fx-seal>
            <RankBadge rank={rank} size={104} decorative />
          </div>
          <h2
            className="heading animate-popIn text-[clamp(1.6rem,min(5.5vw,8vh),3.2rem)] leading-tight [animation-delay:.44s]"
            style={{ color: rank.color, textShadow: `0 0 28px ${rank.color}66` }}
          >
            {rank.name}
          </h2>
        </div>

        <p className="mx-auto mt-4 max-w-md sm:mt-5 [@media(max-height:520px)]:mt-2 font-read text-[clamp(1.05rem,2.2vw,1.35rem)] italic leading-relaxed text-parchment-dim">
          {rank.tagline}
        </p>

        <div className="mt-6 font-script text-[13px] [@media(max-height:520px)]:mt-3 uppercase tracking-[0.18em] text-ink-faint">
          {next
            ? `Next — ${next.name} at ${next.xp.toLocaleString()} XP`
            : 'The highest rank there is'}
        </div>

        <Button
          variant="primary"
          size="lg"
          trailing
          className="mt-6 sm:mt-8 [@media(max-height:520px)]:mt-4"
          onClick={(e) => {
            // The backdrop's click would dismiss a second time.
            e.stopPropagation();
            dismiss();
          }}
        >
          Onward
        </Button>
      </div>
    </div>
  );
}
