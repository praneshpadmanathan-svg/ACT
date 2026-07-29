/* The adventure map — the centrepiece of the app.

   A painted world with a landmark pin for every zone, engraved region
   plaques, drifting cloud shadows, and the traveller standing wherever you
   have got to. Zones unlock in order along each path.

   The map image has a fixed aspect ratio and every pin is positioned as a
   percentage of it, so the whole scene scales from phone to desktop without
   any pin drifting off its landmark. */

import { useEffect, useMemo, useRef } from 'react';
import { PATH_BY_ID } from '@/content';
import { useStore } from '@/lib/store';
import { useNavigate } from '@/lib/router';
import { sfx } from '@/lib/sfx';
import { cx } from '@/lib/utils';
import type { SectionId, Zone } from '@/types';
import { CLOUDS, REGIONS, REGION_ORDER, SUMMIT_AT } from './mapData';

/* The source illustration is 768x1376. */
const MAP_ASPECT = 768 / 1376;

interface PlacedPin {
  zone: Zone;
  section: SectionId;
  color: string;
  x: number;
  y: number;
  state: 'done' | 'current' | 'open' | 'locked';
  best: number | null;
  index: number;
}

export interface MapProgress {
  pins: PlacedPin[];
  current: PlacedPin | null;
  cleared: number;
  total: number;
  allCleared: boolean;
}

/** Shared by the map and the dashboard so both agree on "what's next". */
export function useMapProgress(): MapProgress {
  const { progress } = useStore();
  const preferred = progress.profile?.fear;

  return useMemo(() => {
    const pins: PlacedPin[] = [];
    let current: PlacedPin | null = null;
    let cleared = 0;
    let total = 0;

    /* Onboarding asks which section worries you most and promises to start
       there, so that region is visited first when deciding where the
       traveller stands. Without this the dashboard sends you to English
       regardless of what onboarding just told you. */
    const order = preferred
      ? [preferred, ...REGION_ORDER.filter((id) => id !== preferred)]
      : REGION_ORDER;

    for (const section of order) {
      const region = REGIONS[section];
      const path = PATH_BY_ID[section];
      if (!path) continue;

      let unlockedSoFar = true;
      path.nodes.forEach((zone, index) => {
        const spot = region.pins[index];
        if (!spot) return;
        total += 1;

        const best = progress.zonesCleared[zone.id] ?? null;
        const done = best !== null;
        if (done) cleared += 1;

        let state: PlacedPin['state'];
        if (done) {
          state = 'done';
        } else if (unlockedSoFar) {
          state = 'current';
          unlockedSoFar = false;
        } else {
          state = 'locked';
        }

        const pin: PlacedPin = {
          zone, section, color: region.color,
          x: spot[0], y: spot[1], state, best, index,
        };
        pins.push(pin);
        // The traveller stands at the first unfinished zone overall.
        if (state === 'current' && !current) current = pin;
      });
    }

    // Pins are drawn in map order regardless of which region we walked first.
    pins.sort((a, b) => REGION_ORDER.indexOf(a.section) - REGION_ORDER.indexOf(b.section) || a.index - b.index);

    return { pins, current, cleared, total, allCleared: cleared === total && total > 0 };
  }, [progress.zonesCleared, preferred]);
}

export function AdventureMap() {
  const { progress } = useStore();
  const navigate = useNavigate();
  const { pins, current, cleared, total } = useMapProgress();
  const heroRef = useRef<HTMLDivElement>(null);

  // Bring the traveller into view on first paint — on a tall map the current
  // zone is often well below the fold.
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const t = window.setTimeout(() => {
      hero.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 260);
    return () => window.clearTimeout(t);
  }, [current?.zone.id]);

  const openZone = (pin: PlacedPin) => {
    if (pin.state === 'locked') {
      sfx.warn();
      return;
    }
    sfx.select();
    navigate({ name: 'zone', zone: pin.zone.id });
  };

  return (
    <div className="relative">
      <div
        className="relative mx-auto overflow-hidden rounded-2xl border border-leather-700 shadow-card"
        style={{ maxWidth: 1000 }}
      >
        <div className="relative w-full" style={{ aspectRatio: `${MAP_ASPECT}` }}>
          <img
            src="/art/world-map.webp"
            alt="A painted map of the realm: a village and farmland in the north, an enchanted forest, a desert of canyons and ruins, cliffs above a harbour, and a golden citadel on an island to the south."
            className="absolute inset-0 h-full w-full select-none object-cover"
            draggable={false}
          />

          {/* drifting cloud shadows */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            {CLOUDS.map(([top, width, opacity, duration], i) => (
              <div
                key={i}
                className="absolute animate-drift"
                style={{
                  top: `${top}%`,
                  width,
                  opacity,
                  animationDuration: `${duration}s`,
                  animationDelay: `-${i * 14}s`,
                }}
              >
                <svg viewBox="0 0 120 60" className="w-full">
                  <g fill="#ffffff">
                    <ellipse cx="40" cy="40" rx="34" ry="15" />
                    <ellipse cx="70" cy="34" rx="26" ry="17" />
                    <ellipse cx="94" cy="42" rx="20" ry="13" />
                    <ellipse cx="56" cy="30" rx="19" ry="13" />
                  </g>
                </svg>
              </div>
            ))}
          </div>

          {/* region plaques */}
          {REGION_ORDER.map((id) => {
            const region = REGIONS[id];
            return (
              <span
                key={id}
                className="region-plaque"
                style={{ left: `${region.labelAt[0]}%`, top: `${region.labelAt[1]}%` }}
              >
                {region.title}
              </span>
            );
          })}

          {/* zone pins */}
          {pins.map((pin, i) => (
            <button
              key={pin.zone.id}
              type="button"
              onClick={() => openZone(pin)}
              aria-disabled={pin.state === 'locked'}
              aria-label={
                pin.state === 'locked'
                  ? `${pin.zone.name}, locked — clear the previous zone first`
                  : `${pin.zone.name}: ${pin.zone.sub}${pin.best !== null ? `, best ${pin.best}%` : ''}`
              }
              className={cx(
                'pin group animate-popIn',
                pin.state === 'done' && 'pin-done',
                pin.state === 'current' && 'pin-current',
                pin.state === 'open' && 'pin-open',
                pin.state === 'locked' && 'pin-locked',
              )}
              style={{ left: `${pin.x}%`, top: `${pin.y}%`, animationDelay: `${i * 18}ms` }}
            >
              {pin.state === 'current' && (
                <span
                  className="pointer-events-none absolute inset-0 animate-pulseRing rounded-full border-2 border-gold-bright"
                  aria-hidden="true"
                />
              )}

              <span className="num text-[13px] font-semibold leading-none">
                {pin.state === 'done' ? '✓' : pin.state === 'locked' ? '🔒' : pin.index + 1}
              </span>

              {/* hover card */}
              <span
                className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden
                           w-max max-w-[190px] -translate-x-1/2 rounded-lg border
                           border-parchment-edge bg-parchment px-3 py-2 text-left shadow-card
                           group-hover:block group-focus-visible:block"
              >
                <span className="block font-display text-[12px] font-semibold leading-tight text-ink">
                  {pin.zone.name}
                </span>
                <span className="mt-0.5 block font-read text-[12px] leading-snug text-ink-soft">
                  {pin.state === 'locked'
                    ? 'Locked'
                    : pin.best !== null
                      ? `Cleared · best ${pin.best}%`
                      : pin.zone.sub}
                </span>
              </span>
            </button>
          ))}

          {/* the summit */}
          <button
            type="button"
            onClick={() => {
              sfx.select();
              navigate({ name: 'tests' });
            }}
            className="pin pin-summit group animate-popIn"
            style={{
              left: `${SUMMIT_AT[0]}%`,
              top: `${SUMMIT_AT[1]}%`,
              transform: 'translate(-50%,-50%) scale(1.28)',
              animationDelay: `${pins.length * 18}ms`,
            }}
            aria-label="The Final Summit — take a full mock test"
          >
            <span className="text-[17px] leading-none">♛</span>
            <span
              className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-max
                         -translate-x-1/2 rounded-lg border border-parchment-edge bg-parchment
                         px-3 py-2 shadow-card group-hover:block group-focus-visible:block"
            >
              <span className="block font-display text-[12px] font-semibold text-ink">
                The Final Summit
              </span>
              <span className="mt-0.5 block font-read text-[12px] text-ink-soft">
                Full timed mock test
              </span>
            </span>
          </button>

          {/* the traveller */}
          {current && (
            <div
              ref={heroRef}
              className="pointer-events-none absolute z-[15]"
              style={{
                left: `${current.x}%`,
                top: `${current.y}%`,
                transform: 'translate(-50%, -100%)',
              }}
            >
              <img
                src="/art/hero-char.webp"
                alt=""
                className="animate-floatHero select-none"
                style={{
                  width: 'clamp(38px, 5.2vw, 62px)',
                  filter: 'drop-shadow(0 4px 6px rgba(0,0,0,.5))',
                }}
                draggable={false}
              />
            </div>
          )}
        </div>
      </div>

      {/* progress readout */}
      <div className="mx-auto mt-4 flex max-w-[1000px] flex-wrap items-center justify-center gap-3">
        <span className="chip">
          <span className="num text-gold">{cleared}</span> of {total} zones cleared
        </span>
        {progress.dayStreak > 0 && (
          <span className="chip text-desert">🔥 {progress.dayStreak} day streak</span>
        )}
      </div>
    </div>
  );
}
