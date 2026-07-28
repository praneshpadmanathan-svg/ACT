/* The pixel landscape used behind the landing, map and trail screens.

   Everything is generated as crisp-edged SVG rects from a seeded PRNG, so it
   is deterministic — the same seed always draws the same mountains. The old
   build re-rolled the scenery on every render, which made the background
   visibly twitch whenever React repainted.

   Layers, back to front:
     sky gradient -> stars -> moon -> far ridge -> mid ridge -> clouds ->
     near ridge -> treeline -> foreground

   Each layer is a separate <g> so the caller can parallax them. */

import { useMemo } from 'react';
import { seeded } from '@/lib/utils';

export interface Palette {
  sky: [string, string, string, string];
  far: string;
  mid: string;
  near: string;
  ground: string;
  snow: string;
  treeDark: string;
  treeLight: string;
  cloud: string;
}

export const PALETTES: Record<string, Palette> = {
  /* Deep night over violet peaks — the default identity. */
  night: {
    sky: ['#07040f', '#120c30', '#2a1a4e', '#41295f'],
    far: '#241a4e',
    mid: '#332063',
    near: '#1d1140',
    ground: '#140b2c',
    snow: '#cbb0ea',
    treeDark: '#0d3c2e',
    treeLight: '#166a4d',
    cloud: '#5c3f78',
  },
  /* Dawn — used for the summit / high-progress states. */
  dawn: {
    sky: ['#160c2a', '#3d1f4e', '#8a3b5c', '#e0764f'],
    far: '#3a2352',
    mid: '#4d2b5c',
    near: '#241543',
    ground: '#170d2e',
    snow: '#ffd9b8',
    treeDark: '#123a30',
    treeLight: '#1c6350',
    cloud: '#94506e',
  },
};

/* ------------------------------------------------------------- primitives */

/** A pixel-stepped ridge polygon built from a height profile. */
function ridgePoints(heights: number[], step: number, baseY: number): string {
  let pts = `0,${baseY}`;
  heights.forEach((h, i) => {
    const x = i * step;
    const y = baseY - h;
    pts += ` ${x},${y} ${x + step},${y}`;
  });
  pts += ` ${heights.length * step},${baseY}`;
  return pts;
}

/** Snow caps on local maxima above a threshold. */
function snowCaps(heights: number[], step: number, baseY: number, minHeight: number, color: string) {
  const caps: JSX.Element[] = [];
  for (let i = 1; i < heights.length - 1; i++) {
    if (heights[i] >= minHeight && heights[i] > heights[i - 1] && heights[i] >= heights[i + 1]) {
      const x = i * step;
      const y = baseY - heights[i];
      caps.push(<rect key={`c${i}`} x={x} y={y} width={step} height={3} fill={color} />);
      caps.push(
        <rect key={`c${i}b`} x={x - 2} y={y + 3} width={step + 4} height={2} fill={color} opacity={0.7} />,
      );
    }
  }
  return caps;
}

/** Generate a ridge profile: layered sine waves plus noise, quantised. */
function makeRidge(count: number, base: number, amp: number, seed: number): number[] {
  const rng = seeded(seed);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const wave =
      Math.sin(i * 0.31) * amp * 0.5 +
      Math.sin(i * 0.13 + 1.7) * amp * 0.35 +
      Math.sin(i * 0.71 + 0.4) * amp * 0.18;
    const noise = (rng() - 0.5) * amp * 0.3;
    out.push(Math.max(4, Math.round((base + wave + noise) / 2) * 2));
  }
  return out;
}

function PineTree({ x, y, size, dark, light }: { x: number; y: number; size: number; dark: string; light: string }) {
  return (
    <g>
      <rect x={x - size / 4} y={y} width={size / 2} height={size / 2} fill="#3a2a18" />
      <rect x={x - size * 1.5} y={y - size} width={size * 3} height={size} fill={dark} />
      <rect x={x - size} y={y - size * 2} width={size * 2} height={size} fill={dark} />
      <rect x={x - size / 2} y={y - size * 3} width={size} height={size} fill={light} />
    </g>
  );
}

/* ------------------------------------------------------------------ scene */

interface SceneProps {
  seed?: number;
  palette?: keyof typeof PALETTES;
  className?: string;
  /** Hide the treeline for map screens where nodes sit low on the canvas. */
  showTrees?: boolean;
  showMoon?: boolean;
}

const WIDTH = 320;
const HEIGHT = 180;

export function PixelScene({
  seed = 7,
  palette = 'night',
  className,
  showTrees = true,
  showMoon = true,
}: SceneProps) {
  const pal = PALETTES[palette] ?? PALETTES.night;
  const gradientId = `sky-${seed}-${palette}`;

  const { far, mid, near, stars, trees } = useMemo(() => {
    const rng = seeded(seed * 31 + 11);
    const starField = Array.from({ length: 52 }, (_, i) => ({
      key: i,
      x: Math.floor(rng() * WIDTH),
      y: Math.floor(rng() * HEIGHT * 0.55),
      color: rng() > 0.8 ? '#9be8ff' : '#e8ecff',
      slow: i % 3 === 0,
      delay: `${(rng() * 2400) | 0}ms`,
    }));

    const treeRng = seeded(seed * 17 + 3);
    const treeLine = Array.from({ length: 9 }, (_, i) => ({
      key: i,
      x: 12 + i * 36 + Math.floor(treeRng() * 18),
      y: 170 + Math.floor(treeRng() * 8),
      size: 3 + Math.floor(treeRng() * 2),
    }));

    return {
      far: makeRidge(41, 52, 46, seed + 1),
      mid: makeRidge(41, 40, 62, seed + 2),
      near: makeRidge(41, 16, 22, seed + 3),
      stars: starField,
      trees: treeLine,
    };
  }, [seed]);

  return (
    <svg
      className={className}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMid slice"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={pal.sky[0]} />
          <stop offset="0.5" stopColor={pal.sky[1]} />
          <stop offset="0.78" stopColor={pal.sky[2]} />
          <stop offset="1" stopColor={pal.sky[3]} />
        </linearGradient>
      </defs>

      <rect width={WIDTH} height={HEIGHT} fill={`url(#${gradientId})`} />

      {/* stars */}
      <g>
        {stars.map((s) => (
          <rect
            key={s.key}
            x={s.x}
            y={s.y}
            width={1.6}
            height={1.6}
            fill={s.color}
            className="animate-twinkle"
            style={{ animationDelay: s.delay, animationDuration: s.slow ? '3.4s' : '2.2s' }}
          />
        ))}
      </g>

      {/* moon */}
      {showMoon && (
        <g>
          <rect x={262} y={20} width={16} height={16} fill="#ffe9a8" />
          <rect x={258} y={24} width={4} height={8} fill="#ffe9a8" />
          <rect x={278} y={24} width={4} height={8} fill="#ffe9a8" />
          <rect x={266} y={16} width={8} height={4} fill="#ffe9a8" />
          <rect x={266} y={36} width={8} height={4} fill="#ffe9a8" />
          <rect x={268} y={26} width={4} height={4} fill="#e8cf8a" />
          <rect x={273} y={31} width={3} height={3} fill="#e8cf8a" />
        </g>
      )}

      {/* far ridge */}
      <polygon points={ridgePoints(far, 8, 180)} fill={pal.far} />
      {snowCaps(far, 8, 180, 72, pal.snow)}

      {/* mid ridge */}
      <polygon points={ridgePoints(mid, 8, 184)} fill={pal.mid} />
      {snowCaps(mid, 8, 184, 84, pal.snow)}

      {/* drifting clouds — between the mid and near ridges reads as depth */}
      <g className="animate-drift" style={{ animationDuration: '58s' }}>
        <rect x={0} y={64} width={38} height={5} fill={pal.cloud} opacity={0.75} />
        <rect x={7} y={59} width={22} height={5} fill={pal.cloud} opacity={0.75} />
      </g>
      <g className="animate-drift" style={{ animationDuration: '86s', animationDelay: '-40s' }}>
        <rect x={0} y={88} width={46} height={5} fill={pal.cloud} opacity={0.6} />
        <rect x={11} y={83} width={24} height={5} fill={pal.cloud} opacity={0.6} />
      </g>

      {/* near ridge */}
      <polygon points={ridgePoints(near, 8, 188)} fill={pal.near} />

      {showTrees && (
        <g>
          {trees.map((t) => (
            <PineTree key={t.key} x={t.x} y={t.y} size={t.size} dark={pal.treeDark} light={pal.treeLight} />
          ))}
        </g>
      )}

      <rect y={176} width={WIDTH} height={4} fill={pal.ground} />
    </svg>
  );
}

/** Full-bleed background wrapper with the CRT + vignette treatment. */
export function SceneBackdrop({
  seed,
  palette,
  children,
  crt = true,
}: {
  seed?: number;
  palette?: keyof typeof PALETTES;
  children?: React.ReactNode;
  crt?: boolean;
}) {
  return (
    <div className={`relative isolate overflow-hidden ${crt ? 'crt vignette' : ''}`}>
      <PixelScene seed={seed} palette={palette} className="absolute inset-0 h-full w-full" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
