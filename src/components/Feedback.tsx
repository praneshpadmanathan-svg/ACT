/* Reward feedback: XP popups, toasts, confetti and the rank-up cinematic.

   All of it is driven by explicit store events. Nothing here polls. */

import { useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';
import { RANKS } from '@/lib/progress';
import { useDialogFocus } from '@/lib/useDialogFocus';
import { Button, RankBadge } from './ui';

/* --------------------------------------------------------------- confetti */

/* Gold leaf and lantern sparks — the palette has to survive being thrown
   over the painted map. */
const CONFETTI_COLORS = ['#f2cf5b', '#d4a017', '#e8c34a', '#c98b2e', '#f7e6ae', '#9c7410'];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rot: number;
  vrot: number;
  life: number;
}

let burstFn: ((count: number, x: number, y: number, spread?: number) => void) | null = null;

/** Fire confetti from anywhere. No-op until the canvas has mounted. */
export function burstConfetti(count = 90, x?: number, y?: number, spread = 18) {
  burstFn?.(count, x ?? window.innerWidth / 2, y ?? window.innerHeight / 2, spread);
}

export function ConfettiCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const tick = () => {
      frameRef.current = requestAnimationFrame(tick);
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        // Walking its own length backwards, and the only splice is below.
        const p = particles[i]!;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.32;
        p.vx *= 0.99;
        p.rot += p.vrot;
        p.life -= 1;
        if (p.life <= 0 || p.y > window.innerHeight + 24) {
          particles.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
      if (!particles.length && frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };

    burstFn = (count, x, y, spread = 18) => {
      const particles = particlesRef.current;
      for (let i = 0; i < count; i++) {
        particles.push({
          x,
          y,
          vx: (Math.random() - 0.5) * spread,
          vy: -Math.random() * 13 - 3,
          size: 4 + Math.random() * 5,
          color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]!,
          rot: Math.random() * Math.PI,
          vrot: (Math.random() - 0.5) * 0.3,
          life: 90 + Math.random() * 50,
        });
      }
      if (!frameRef.current) tick();
    };

    return () => {
      window.removeEventListener('resize', resize);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      burstFn = null;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[105]"
      aria-hidden="true"
    />
  );
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
          style={{ textShadow: '0 2px 0 #000, 0 0 12px rgba(255,210,62,.8)' }}
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
    <div className="pointer-events-none fixed right-4 top-20 z-[90] flex w-[min(340px,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismissToast(t.id)}
          className="pointer-events-auto flex animate-slidein items-center gap-3 rounded-lg border-2 border-gold-deep bg-leather-850/95 px-4 py-3 text-left shadow-card backdrop-blur"
          style={{ borderLeftWidth: 6, borderLeftColor: t.color ?? '#ffd23e' }}
        >
          <span className="text-[17px] text-gold" aria-hidden="true">
            ✦
          </span>
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

export function LevelUpOverlay() {
  const { levelUpRank, dismissLevelUp } = useStore();
  const dialogRef = useRef<HTMLDivElement>(null);

  /* This covers the whole viewport but left the page behind it in the tab
     order — the same gap the story overlay and the road chooser already had
     fixed. A student who ranks up mid-drill could tab straight back into the
     question they cannot see. */
  useDialogFocus(dialogRef, levelUpRank !== null);

  useEffect(() => {
    if (levelUpRank === null) return;
    burstConfetti(110, window.innerWidth / 2, window.innerHeight / 2, 22);
    const t1 = window.setTimeout(
      () => burstConfetti(60, window.innerWidth / 2 - 220, window.innerHeight / 2 - 60, 16),
      350,
    );
    const t2 = window.setTimeout(
      () => burstConfetti(60, window.innerWidth / 2 + 220, window.innerHeight / 2 - 60, 16),
      500,
    );
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') dismissLevelUp();
    };
    window.addEventListener('keydown', escape);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener('keydown', escape);
    };
  }, [levelUpRank, dismissLevelUp]);

  if (levelUpRank === null) return null;
  const rank = RANKS[levelUpRank] ?? RANKS[RANKS.length - 1]!;
  const next = RANKS[levelUpRank + 1];

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[110] flex cursor-pointer items-center justify-center overflow-hidden"
      style={{
        background: 'radial-gradient(circle at 50% 42%, rgba(46,37,26,.95), rgba(12,9,6,.97))',
      }}
      onClick={dismissLevelUp}
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
          className="heading animate-stamp text-[clamp(2.2rem,min(11vw,15vh),5.5rem)] font-black uppercase leading-none"
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
          <div className="w-fit animate-popIn [animation-delay:.34s]">
            <RankBadge rank={rank} size={104} />
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

        <Button variant="primary" size="lg" className="mt-6 sm:mt-8 [@media(max-height:520px)]:mt-4" onClick={dismissLevelUp}>
          Onward ▸
        </Button>
      </div>
    </div>
  );
}
