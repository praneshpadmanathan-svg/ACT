/* Reward feedback: XP popups, toasts, confetti and the rank-up cinematic.

   All of it is driven by explicit store events. Nothing here polls. */

import { useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';
import { RANKS } from '@/lib/progress';
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
      className="fixed inset-0 z-[110] flex cursor-pointer items-center justify-center overflow-hidden"
      style={{
        background: 'radial-gradient(circle at 50% 42%, rgba(46,37,26,.95), rgba(12,9,6,.97))',
      }}
      onClick={dismissLevelUp}
      role="dialog"
      aria-label={`A new rank: ${rank.name}`}
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

      <div className="relative px-6 text-center">
        <div className="mx-auto w-fit animate-popIn">
          <RankBadge rank={rank} size={96} />
        </div>

        <div className="eyebrow mt-6">A new rank</div>

        <h2
          className="heading mt-2 text-[clamp(2rem,6vw,3.4rem)] leading-tight"
          style={{ color: rank.color, textShadow: `0 0 28px ${rank.color}66` }}
        >
          {rank.name}
        </h2>

        <p className="mx-auto mt-4 max-w-md font-read text-[clamp(1.05rem,2.2vw,1.35rem)] italic leading-relaxed text-parchment-dim">
          {rank.tagline}
        </p>

        <div className="mt-6 font-script text-[13px] uppercase tracking-[0.18em] text-ink-faint">
          {next
            ? `Next — ${next.name} at ${next.xp.toLocaleString()} XP`
            : 'The highest rank there is'}
        </div>

        <Button variant="primary" size="lg" className="mt-8" onClick={dismissLevelUp}>
          Onward ▸
        </Button>
      </div>
    </div>
  );
}
