/* The world map.

   Four subject regions plus base camp and the summit, laid out along a
   winding trail over the pixel landscape. Node positions are percentages of
   the scene box, so the whole thing scales cleanly from phone to desktop
   instead of the old fixed-pixel overlay that clipped on small screens. */

import { useMemo } from 'react';
import { PATH_BY_ID, SECTIONS } from '@/content';
import { useStore } from '@/lib/store';
import { useNavigate } from '@/lib/router';
import { sfx } from '@/lib/sfx';
import { cx } from '@/lib/utils';
import type { SectionId } from '@/types';
import { PixelScene } from './scene';
import { HeroSprite } from './heroes';

interface MapNode {
  id: string;
  label: string;
  sub: string;
  /** Percent of the scene box. */
  x: number;
  y: number;
  color: string;
  kind: 'camp' | 'region' | 'summit';
  section?: SectionId;
}

const NODES: MapNode[] = [
  { id: 'camp', label: 'Base Camp', sub: 'Your dashboard', x: 10, y: 88, color: '#ff9d5c', kind: 'camp' },
  { id: 'english', label: 'English', sub: 'Grammar Grove', x: 27, y: 74, color: '#ffd23e', kind: 'region', section: 'english' },
  { id: 'math', label: 'Math', sub: 'Numeric Cliffs', x: 47, y: 62, color: '#3ad6f0', kind: 'region', section: 'math' },
  { id: 'reading', label: 'Reading', sub: 'Passage Pass', x: 33, y: 46, color: '#ff8298', kind: 'region', section: 'reading' },
  { id: 'science', label: 'Science', sub: 'Data Ridge', x: 57, y: 34, color: '#b79cff', kind: 'region', section: 'science' },
  { id: 'summit', label: 'Summit 36', sub: 'The perfect score', x: 82, y: 16, color: '#ffb347', kind: 'summit' },
];

/** Dotted trail between consecutive nodes, in scene percentage space. */
function TrailPath() {
  const dots: JSX.Element[] = [];
  for (let i = 0; i < NODES.length - 1; i++) {
    const a = NODES[i];
    const b = NODES[i + 1];
    const steps = 14;
    for (let t = 1; t < steps; t++) {
      const k = t / steps;
      // Slight arc so the trail bends rather than running dead straight.
      const bow = Math.sin(k * Math.PI) * 2.5 * (i % 2 === 0 ? 1 : -1);
      dots.push(
        <rect
          key={`${i}-${t}`}
          x={a.x + (b.x - a.x) * k + bow}
          y={a.y + (b.y - a.y) * k}
          width={0.9}
          height={0.7}
          fill="#e8d8a0"
          opacity={0.55}
        />,
      );
    }
  }
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
      {dots}
    </svg>
  );
}

function ProgressRing({ value, color, size = 54 }: { value: number; color: string; size?: number }) {
  const r = 22;
  const circumference = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 52 52" className="absolute -inset-[9px]" aria-hidden="true">
      <circle cx="26" cy="26" r={r} fill="none" stroke="rgba(8,5,20,.75)" strokeWidth="4" />
      <circle
        cx="26"
        cy="26"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - value)}
        transform="rotate(-90 26 26)"
        style={{ transition: 'stroke-dashoffset .9s cubic-bezier(.22,1,.36,1)' }}
      />
    </svg>
  );
}

export function WorldMap() {
  const { progress } = useStore();
  const navigate = useNavigate();

  /* Zones cleared per subject, and the furthest region the player has
     touched — that's where the hero sprite stands. */
  const { byRegion, heroAt, overall } = useMemo(() => {
    const result: Record<string, { done: number; total: number; pct: number }> = {};
    let furthest = 0;
    let doneAll = 0;
    let totalAll = 0;

    SECTIONS.forEach((section) => {
      const path = PATH_BY_ID[section.id];
      const total = path?.nodes.length ?? 0;
      const done = path?.nodes.filter((n) => progress.zonesCleared[n.id] !== undefined).length ?? 0;
      result[section.id] = { done, total, pct: total ? done / total : 0 };
      doneAll += done;
      totalAll += total;
      if (done > 0) {
        const index = NODES.findIndex((n) => n.id === section.id);
        if (index > furthest) furthest = index;
      }
    });

    return {
      byRegion: result,
      heroAt: NODES[Math.max(0, furthest)],
      overall: totalAll ? doneAll / totalAll : 0,
    };
  }, [progress.zonesCleared]);

  const open = (node: MapNode) => {
    sfx.select();
    if (node.kind === 'camp') navigate({ name: 'home' });
    else if (node.kind === 'summit') navigate({ name: 'tests' });
    else if (node.section) navigate({ name: 'path', section: node.section });
  };

  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border-2 border-edge shadow-pixel-lg sm:aspect-[16/9]">
      <PixelScene seed={21} className="absolute inset-0 h-full w-full" showTrees />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950/70 via-transparent to-ink-950/40" />
      <TrailPath />

      {/* overall climb readout */}
      <div className="absolute left-3 top-3 z-20 rounded-lg border-2 border-edge bg-ink-950/85 px-3 py-2 backdrop-blur-sm sm:left-4 sm:top-4">
        <div className="font-screen text-[10px] uppercase tracking-[0.16em] text-[#8f86b5]">The climb</div>
        <div className="num mt-0.5 text-[22px] leading-none text-gold">{Math.round(overall * 100)}%</div>
      </div>

      {/* nodes */}
      {NODES.map((node) => {
        const stats = node.section ? byRegion[node.section] : null;
        const complete = stats ? stats.done === stats.total && stats.total > 0 : false;

        return (
          <button
            key={node.id}
            type="button"
            onClick={() => open(node)}
            className="group absolute z-10 -translate-x-1/2 -translate-y-1/2 text-center focus-visible:outline-none"
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
            aria-label={`${node.label} — ${node.sub}${stats ? `, ${stats.done} of ${stats.total} zones cleared` : ''}`}
          >
            <span className="relative mx-auto block h-[22px] w-[22px]">
              {stats && <ProgressRing value={stats.pct} color={node.color} />}
              <span
                className={cx(
                  'block h-[22px] w-[22px] rounded border-[3px] border-[#0d0620] transition-transform duration-150',
                  'group-hover:scale-125 group-focus-visible:scale-125',
                  node.kind === 'summit' && 'animate-pulse',
                )}
                style={{ background: node.color, boxShadow: `0 3px 0 rgba(0,0,0,.6), 0 0 14px ${node.color}` }}
              />
              {complete && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-[#0d0620] bg-mint text-[9px] font-bold text-[#04200f]">
                  ✓
                </span>
              )}
            </span>

            <span
              className="mt-2 block whitespace-nowrap font-pixel text-[8px] uppercase text-white sm:text-[9px]"
              style={{ textShadow: '2px 2px 0 #000' }}
            >
              {node.label}
            </span>
            <span className="mt-1 block whitespace-nowrap font-digit text-[13px] text-[#c8bde8] opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
              {stats ? `${stats.done}/${stats.total} zones` : node.sub}
            </span>
          </button>
        );
      })}

      {/* the player */}
      <div
        className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full"
        style={{ left: `${heroAt.x}%`, top: `${heroAt.y - 3}%` }}
      >
        <HeroSprite hero={progress.hero} unit={3} />
      </div>
    </div>
  );
}
