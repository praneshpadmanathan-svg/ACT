/* Reward feedback: XP popups, toasts, confetti and the rank-up cinematic.

   All of it is driven by explicit store events. Nothing here polls. */

import { useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';
import { RANKS } from '@/lib/progress';
import { PixelIcon } from './PixelIcon';
import { Button } from './ui';

/* --------------------------------------------------------------- confetti */

const CONFETTI_COLORS = ['#ffd23e', '#ff9d5c', '#3ad6f0', '#ff5d78', '#b79cff', '#ffffff'];

interface Particle {
  x: number; y: number; vx: number; vy: number;
  size: number; color: string; rot: number; vrot: number; life: number;
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
        const p = particles[i];
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
          x, y,
          vx: (Math.random() - 0.5) * spread,
          vy: -Math.random() * 13 - 3,
          size: 4 + Math.random() * 5,
          color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
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

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-[105]" aria-hidden="true" />;
}

/* ------------------------------------------------------------- xp popups */

export function XPPopups() {
  const { xpPops } = useStore();
  return (
    <div className="pointer-events-none fixed right-6 top-24 z-[80] flex flex-col items-end gap-1" aria-hidden="true">
      {xpPops.map((pop) => (
        <div
          key={pop.id}
          className="animate-rise font-pixel text-[15px] text-gold"
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
          className="pointer-events-auto flex animate-slidein items-center gap-3 rounded-lg border-2 border-edge-bright bg-ink-850/95 px-4 py-3 text-left shadow-pixel backdrop-blur"
          style={{ borderLeftWidth: 6, borderLeftColor: t.color ?? '#ffd23e' }}
        >
          {t.icon && <PixelIcon name={t.icon} unit={2} />}
          <span className="min-w-0">
            <span className="block font-screen text-[13px] uppercase tracking-wide text-white">{t.title}</span>
            {t.detail && <span className="mt-0.5 block text-xs leading-snug text-[#a89ac6]">{t.detail}</span>}
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
    const t1 = window.setTimeout(() => burstConfetti(60, window.innerWidth / 2 - 220, window.innerHeight / 2 - 60, 16), 350);
    const t2 = window.setTimeout(() => burstConfetti(60, window.innerWidth / 2 + 220, window.innerHeight / 2 - 60, 16), 500);
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
  const rank = RANKS[levelUpRank] ?? RANKS[RANKS.length - 1];
  const next = RANKS[levelUpRank + 1];

  return (
    <div
      className="fixed inset-0 z-[110] flex cursor-pointer items-center justify-center overflow-hidden"
      style={{ background: 'radial-gradient(circle at 50% 44%, rgba(20,28,60,.94), rgba(3,5,12,.97))' }}
      onClick={dismissLevelUp}
      role="dialog"
      aria-label={`Rank up: ${rank.name}`}
    >
      <div
        className="absolute rounded-full"
        style={{
          width: '160vmax',
          height: '160vmax',
          background: `repeating-conic-gradient(from 0deg, ${rank.color}22 0deg 9deg, transparent 9deg 18deg)`,
          animation: 'spin 16s linear infinite',
        }}
        aria-hidden="true"
      />
      <div className="relative px-6 text-center">
        <div
          className="font-pixel text-[clamp(28px,7vw,60px)] leading-[1.25] text-gold"
          style={{ textShadow: '0 0 24px rgba(255,210,62,.75), 4px 4px 0 #7a2d00' }}
        >
          {[...'RANK UP!'].map((ch, i) => (
            <span key={i} className="inline-block animate-pop" style={{ animationDelay: `${i * 55}ms` }}>
              {ch === ' ' ? ' ' : ch}
            </span>
          ))}
        </div>

        <div className="mt-7">
          <span
            className="inline-block rounded-md px-4 py-2 font-pixel text-[12px] text-[#04060d] shadow-pixel"
            style={{ background: rank.color }}
          >
            RANK {levelUpRank + 1}
          </span>
        </div>

        <div
          className="mt-3 font-pixel text-[clamp(15px,3.4vw,26px)] uppercase"
          style={{ color: rank.color, textShadow: `0 0 22px ${rank.color}cc, 3px 3px 0 #000` }}
        >
          {rank.name}
        </div>

        <div className="mt-4 font-digit text-[clamp(19px,2.6vw,26px)] text-[#a89ac6]">{rank.tagline}</div>

        <div className="mt-6 font-screen text-[12px] uppercase tracking-wide text-[#7a6a9e]">
          {next ? `Next — ${next.name} at ${next.xp.toLocaleString()} XP` : 'Maximum rank reached'}
        </div>

        <Button variant="gold" className="mt-8" onClick={dismissLevelUp}>
          Continue
        </Button>
      </div>
    </div>
  );
}
