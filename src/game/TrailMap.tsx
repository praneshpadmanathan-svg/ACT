/* A subject's zones, laid out as a serpentine trail that climbs the screen.

   Zone counts differ per subject (5-10), so the layout is generated from the
   count rather than hand-placed. Nodes alternate left and right of centre,
   which keeps the path legible at any length and works down to a phone
   width — the old fixed-coordinate map overlapped its own labels below
   about 700px. */

import { useMemo } from 'react';
import type { Path, Zone } from '@/types';
import { useStore } from '@/lib/store';
import { useNavigate } from '@/lib/router';
import { sfx } from '@/lib/sfx';
import { cx } from '@/lib/utils';
import { PixelScene } from './scene';
import { HeroSprite } from './heroes';

const ROW_HEIGHT = 118;
const AMPLITUDE = 30;

interface Placed {
  zone: Zone;
  index: number;
  /** Percent across the trail column. */
  x: number;
  /** Pixels from the bottom of the trail. */
  y: number;
  state: 'cleared' | 'current' | 'locked';
  score: number | null;
}

export function TrailMap({ path }: { path: Path }) {
  const { progress } = useStore();
  const navigate = useNavigate();

  const { placed, height, heroNode } = useMemo(() => {
    // A zone unlocks once the one before it has been cleared. The first is
    // always open, so a new player can start immediately.
    let firstUnclearedSeen = false;

    const nodes: Placed[] = path.nodes.map((zone, index) => {
      const score = progress.zonesCleared[zone.id] ?? null;
      const cleared = score !== null;
      let state: Placed['state'];
      if (cleared) {
        state = 'cleared';
      } else if (!firstUnclearedSeen) {
        state = 'current';
        firstUnclearedSeen = true;
      } else {
        state = 'locked';
      }

      return {
        zone,
        index,
        x: 50 + Math.sin(index * 0.95) * AMPLITUDE,
        y: index * ROW_HEIGHT + 70,
        state,
        score,
      };
    });

    return {
      placed: nodes,
      height: path.nodes.length * ROW_HEIGHT + 150,
      heroNode: nodes.find((n) => n.state === 'current') ?? nodes[nodes.length - 1],
    };
  }, [path, progress.zonesCleared]);

  const openZone = (p: Placed) => {
    if (p.state === 'locked') {
      sfx.warn();
      return;
    }
    sfx.select();
    navigate({ name: 'zone', zone: p.zone.id });
  };

  return (
    <div
      className="relative overflow-hidden rounded-xl border-2 border-edge shadow-pixel-lg"
      style={{ height }}
    >
      <PixelScene seed={path.id.length * 13 + 5} className="absolute inset-0 h-full w-full" showTrees={false} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink-950/75 via-ink-950/35 to-ink-950/80" />

      {/* the path itself */}
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden="true">
        {placed.slice(0, -1).map((p, i) => {
          const next = placed[i + 1];
          const done = next.state === 'cleared' || p.state === 'cleared';
          return (
            <line
              key={p.zone.id}
              x1={`${p.x}%`}
              y1={height - p.y}
              x2={`${next.x}%`}
              y2={height - next.y}
              stroke={done ? path.color : '#3a2a62'}
              strokeWidth={5}
              strokeLinecap="round"
              strokeDasharray="2 11"
              opacity={done ? 0.9 : 0.55}
            />
          );
        })}
      </svg>

      {/* boss marker at the top */}
      <div className="absolute left-1/2 z-10 -translate-x-1/2 text-center" style={{ top: 20 }}>
        <div
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border-[3px] border-[#0d0620]"
          style={{ background: '#ff5d78', boxShadow: '0 4px 0 rgba(0,0,0,.6), 0 0 22px rgba(255,93,120,.6)' }}
        >
          <span className="text-xl">♛</span>
        </div>
        <div className="mt-2 font-pixel text-[9px] uppercase text-white" style={{ textShadow: '2px 2px 0 #000' }}>
          {path.boss.name}
        </div>
        <div className="mt-1 font-digit text-[14px] text-[#c8bde8]">{path.boss.sub}</div>
      </div>

      {/* zones */}
      {placed.map((p) => {
        const locked = p.state === 'locked';
        return (
          <button
            key={p.zone.id}
            type="button"
            onClick={() => openZone(p)}
            aria-disabled={locked}
            aria-label={
              locked
                ? `${p.zone.name}, locked. Clear the previous zone to unlock.`
                : `${p.zone.name} — ${p.zone.sub}${p.score !== null ? `, best ${p.score}%` : ''}`
            }
            className={cx(
              'group absolute z-10 w-[168px] -translate-x-1/2 -translate-y-1/2 text-center',
              locked ? 'cursor-not-allowed' : 'cursor-pointer',
            )}
            style={{ left: `${p.x}%`, top: height - p.y }}
          >
            <span
              className={cx(
                'relative mx-auto flex h-11 w-11 items-center justify-center rounded-lg border-[3px] border-[#0d0620] transition-transform duration-150',
                !locked && 'group-hover:scale-110 group-focus-visible:scale-110',
              )}
              style={{
                background: locked ? '#241b3f' : path.color,
                boxShadow: locked
                  ? '0 3px 0 rgba(0,0,0,.6)'
                  : `0 4px 0 rgba(0,0,0,.6), 0 0 18px ${path.color}99`,
              }}
            >
              {p.state === 'cleared' ? (
                <span className="font-pixel text-[13px] text-[#1a1000]">✓</span>
              ) : locked ? (
                <span className="text-[15px] opacity-50">🔒</span>
              ) : (
                <span className="num text-[19px] leading-none text-[#1a1000]">{p.index + 1}</span>
              )}

              {p.score !== null && (
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border-2 border-[#0d0620] bg-ink-900 px-1.5 font-digit text-[12px] leading-tight text-mint">
                  {p.score}%
                </span>
              )}
            </span>

            <span
              className={cx(
                'mt-3 block font-pixel text-[8px] uppercase leading-[1.5]',
                locked ? 'text-[#6b5f90]' : 'text-white',
              )}
              style={{ textShadow: '2px 2px 0 #000' }}
            >
              {p.zone.name}
            </span>
            <span className="mt-1 block px-1 font-digit text-[13px] leading-tight text-[#b3a8d4]">
              {locked ? 'Locked' : p.zone.sub}
            </span>
          </button>
        );
      })}

      {/* the player, standing at the current zone */}
      {heroNode && (
        <div
          className="pointer-events-none absolute z-20"
          style={{
            left: `${heroNode.x}%`,
            top: height - heroNode.y - 34,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <HeroSprite hero={progress.hero} unit={3} />
        </div>
      )}
    </div>
  );
}
