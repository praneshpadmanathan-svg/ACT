/* The adventure map — a full-viewport world you pan and zoom around.

   The illustration is portrait (768x1376) and screens are landscape, so
   there is no framing that shows all of it well. Instead it behaves like a
   game world map: it fills the viewport, you drag to pan and scroll or pinch
   to zoom, and it opens centred on wherever you have got to.

   Everything positioned on the map — pins, plaques, scenery motion, the
   traveller — lives in percentage space inside a single transformed layer,
   so one transform moves the whole world and nothing can drift out of
   register. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PATH_BY_ID } from '@/content';
import { useStore } from '@/lib/store';
import { useNavigate } from '@/lib/router';
import { sfx } from '@/lib/sfx';
import { clamp, cx } from '@/lib/utils';
import type { SectionId, Zone } from '@/types';
import { REGIONS, REGION_ORDER, SUMMIT_AT } from './mapData';
import { activeQuest } from './story';
import { m, SPRING } from '@/lib/motion';
import { MapFx } from './MapFx';
import { ClearedSigil, CrownSigil, LockSigil, MasterSigil } from './Sigils';

const MAP_W = 768;
const MAP_H = 1376;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3.4;

interface PlacedPin {
  zone: Zone;
  section: SectionId;
  color: string;
  x: number;
  y: number;
  state: 'done' | 'current' | 'locked';
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
  /* The road the player chose on the map wins; the onboarding answer is only a
     fallback for anyone who set out before there was a choice to make. */
  const preferred = progress.startRegion ?? progress.profile?.fear;

  return useMemo(() => {
    const pins: PlacedPin[] = [];
    let current: PlacedPin | null = null;
    let cleared = 0;
    let total = 0;

    /* Onboarding promises to start you in the section you named, so that
       region is walked first when deciding where the traveller stands. */
    const order = preferred
      ? [preferred, ...REGION_ORDER.filter((id) => id !== preferred)]
      : REGION_ORDER;

    for (const section of order) {
      const region = REGIONS[section];
      const path = PATH_BY_ID[section];
      if (!path) continue;

      let nextIsOpen = true;
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
        } else if (nextIsOpen) {
          state = 'current';
          nextIsOpen = false;
        } else {
          state = 'locked';
        }

        const pin: PlacedPin = {
          zone, section, color: region.color,
          x: spot[0], y: spot[1], state, best, index,
        };
        pins.push(pin);
        if (state === 'current' && !current) current = pin;
      });
    }

    pins.sort(
      (a, b) => REGION_ORDER.indexOf(a.section) - REGION_ORDER.indexOf(b.section) || a.index - b.index,
    );

    return { pins, current, cleared, total, allCleared: cleared === total && total > 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress.zonesCleared, preferred]);
}

/* -------------------------------------------------------------- the view */

interface Size {
  w: number;
  h: number;
}

interface View {
  zoom: number;
  /** Pan offset in CSS pixels, applied before scale. */
  x: number;
  y: number;
}

export function AdventureMap({ onExit }: { onExit?: () => void }) {
  const { progress } = useStore();
  const navigate = useNavigate();
  const { pins, current, cleared, total } = useMapProgress();
  const quest = useMemo(() => activeQuest(progress, { cleared, total }), [progress, cleared, total]);

  const frameRef = useRef<HTMLDivElement>(null);
  /* The frame is `fixed inset-0`, so it is always exactly the viewport —
     read that directly rather than measuring the element. Measuring meant
     the first paint had no size yet (cover scale fell back to 1 and the map
     did not fill the screen), and a ResizeObserver only reports while the
     page is actually painting. window dimensions are available immediately
     and always correct. */
  const [frame, setFrame] = useState(() => ({
    w: typeof window === 'undefined' ? 0 : window.innerWidth,
    h: typeof window === 'undefined' ? 0 : window.innerHeight,
  }));
  const [view, setView] = useState<View>({ zoom: 1.35, x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [ready, setReady] = useState(false);

  /* The map is sized to cover the viewport at zoom 1, so panning is only ever
     within the overflow. Clamping to that keeps empty gutters off screen. */
  const clampView = useCallback((next: View, box: Size): View => {
    const zoom = clamp(next.zoom, MIN_ZOOM, MAX_ZOOM);
    const scale = Math.max(box.w / MAP_W, box.h / MAP_H) * zoom;
    const w = MAP_W * scale;
    const h = MAP_H * scale;
    const maxX = Math.max(0, (w - box.w) / 2);
    const maxY = Math.max(0, (h - box.h) / 2);
    return { zoom, x: clamp(next.x, -maxX, maxX), y: clamp(next.y, -maxY, maxY) };
  }, []);

  /** Centre the view on a point given in map percentages. */
  const centreOn = useCallback(
    (px: number, py: number, zoom?: number) => {
      setView((prev) => {
        const z = zoom ?? prev.zoom;
        const scale = Math.max(frame.w / MAP_W, frame.h / MAP_H) * z;
        // Offset from the map's centre, in scaled pixels, negated to bring
        // that point to the middle of the frame.
        const dx = (50 - px) / 100 * MAP_W * scale;
        const dy = (50 - py) / 100 * MAP_H * scale;
        return clampView({ zoom: z, x: dx, y: dy }, frame);
      });
    },
    [clampView, frame],
  );

  // Open looking at the traveller.
  useEffect(() => {
    const target = current ?? { x: SUMMIT_AT[0], y: SUMMIT_AT[1] };
    const id = window.setTimeout(() => {
      centreOn(target.x, target.y, 1.55);
      setReady(true);
    }, 60);
    return () => window.clearTimeout(id);
  }, [current, centreOn]);

  // Keep the view legal when the window changes size.
  useEffect(() => {
    const onResize = () => {
      const next = { w: window.innerWidth, h: window.innerHeight };
      setFrame(next);
      setView((v) => clampView(v, next));
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clampView]);

  /* ------------------------------------------------------------ gestures */

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ dist: number; zoom: number } | null>(null);
  const moved = useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
    if (pointers.current.size === 1) setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;

    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const points = [...pointers.current.values()];

    if (points.length >= 2) {
      // Pinch: track the distance between the first two contacts.
      const dist = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      if (!pinchStart.current) {
        pinchStart.current = { dist, zoom: view.zoom };
      } else {
        const ratio = dist / pinchStart.current.dist;
        setView((v) => clampView({ ...v, zoom: pinchStart.current!.zoom * ratio }, frame));
      }
      moved.current = true;
      return;
    }

    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) moved.current = true;
    setView((v) => clampView({ ...v, x: v.x + dx, y: v.y + dy }, frame));
  };

  const endPointer = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 0) setDragging(false);
  };

  const onWheel = (e: React.WheelEvent) => {
    const factor = Math.exp(-e.deltaY * 0.0016);
    setView((v) => clampView({ ...v, zoom: v.zoom * factor }, frame));
  };

  /* --------------------------------------------------------------- pins */

  const openZone = (pin: PlacedPin) => {
    // A drag that ends over a pin should not also open it.
    if (moved.current) return;
    if (pin.state === 'locked') {
      sfx.locked();
      return;
    }
    sfx.select();
    navigate({ name: 'zone', zone: pin.zone.id });
  };

  const zoomBy = (factor: number) => {
    sfx.tick();
    setView((v) => clampView({ ...v, zoom: v.zoom * factor }, frame));
  };

  /* Cover scale: the factor that makes the portrait map fill a landscape
     frame at zoom 1. Multiplied by the user's zoom for the final transform. */
  const coverScale =
    frame.w > 0 ? Math.max(frame.w / MAP_W, frame.h / MAP_H) * view.zoom : view.zoom;

  return (
    /* A landmark and a heading, because the map suppresses the top bar and so
       had no <main>, no <nav> and no <h1> at all — a screen reader landed on 38
       unlabelled-in-context buttons with no way to orient. The heading is
       visually hidden; the map itself is the visual title. */
    <main
      ref={frameRef}
      className={cx(
        'fixed inset-0 overflow-hidden bg-leather-950 touch-none select-none',
        dragging ? 'cursor-grabbing' : 'cursor-grab',
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onWheel={onWheel}
      /* Deliberately not role="application": that suppresses browse mode for
         everything inside, so a screen reader user loses normal reading of the
         38 landmark buttons and the HUD in exchange for drag gestures they
         cannot perform anyway. Panning is mouse/touch only; zoom has buttons. */
      aria-label="Adventure map. Drag to pan, scroll to zoom."
    >
      {/* the world: one transformed layer holding art, motion and pins */}
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: MAP_W,
          height: MAP_H,
          transform: `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${coverScale})`,
          transformOrigin: 'center center',
          transition: dragging ? 'none' : 'transform .5s cubic-bezier(.22,1,.36,1)',
          opacity: ready ? 1 : 0,
        }}
      >
        <img
          src="/art/world-map.webp"
          alt="A painted map of the realm: farmland and a village in the north, an enchanted forest, a desert of canyons and ruins, cliffs above a harbour, and a golden citadel on an island to the south."
          className="absolute inset-0 h-full w-full select-none"
          draggable={false}
        />

        <MapFx />

        {/* region plaques */}
        {REGION_ORDER.map((id) => {
          const region = REGIONS[id];
          return (
            <span
              key={id}
              className="region-plaque"
              style={{ left: `${region.labelAt[0]}%`, top: `${region.labelAt[1]}%`, fontSize: 19 }}
            >
              {region.title}
            </span>
          );
        })}

        {/* zone pins */}
        {pins.map((pin, i) => {
          const mastered = pin.best === 100;
          return (
            <button
              key={pin.zone.id}
              type="button"
              onClick={() => openZone(pin)}
              aria-disabled={pin.state === 'locked'}
              aria-label={
                pin.state === 'locked'
                  ? `${pin.zone.name}, sealed — clear the landmark before it first`
                  : `${pin.zone.name}: ${pin.zone.sub}${pin.best !== null ? `, best ${pin.best}%` : ''}`
              }
              className={cx(
                'pin group animate-popIn',
                pin.state === 'done' && 'pin-done',
                pin.state === 'current' && 'pin-current',
                pin.state === 'locked' && 'pin-locked',
              )}
              style={{ left: `${pin.x}%`, top: `${pin.y}%`, animationDelay: `${i * 16}ms` }}
            >
              {pin.state === 'current' && (
                <span
                  className="pointer-events-none absolute inset-0 animate-pulseRing rounded-full border-2 border-gold-bright"
                  aria-hidden="true"
                />
              )}

              {pin.state === 'locked' ? (
                <LockSigil size={17} />
              ) : mastered ? (
                <MasterSigil size={17} />
              ) : pin.state === 'done' ? (
                <ClearedSigil size={17} />
              ) : (
                <span className="num text-[14px] font-semibold leading-none">{pin.index + 1}</span>
              )}

              <span className="pin-card">
                <span className="block font-display text-[13px] font-semibold leading-tight text-ink">
                  {pin.zone.name}
                </span>
                <span className="mt-0.5 block font-read text-[12.5px] leading-snug text-ink-soft">
                  {pin.state === 'locked'
                    ? 'Sealed'
                    : pin.best !== null
                      ? `Cleared · best ${pin.best}%`
                      : pin.zone.sub}
                </span>
              </span>
            </button>
          );
        })}

        {/* the summit */}
        <button
          type="button"
          onClick={() => {
            if (moved.current) return;
            sfx.select();
            navigate({ name: 'tests' });
          }}
          className="pin pin-summit group animate-popIn"
          style={{
            left: `${SUMMIT_AT[0]}%`,
            top: `${SUMMIT_AT[1]}%`,
            width: 44,
            height: 44,
            animationDelay: `${pins.length * 16}ms`,
          }}
          aria-label="The Final Summit — take a full mock test"
        >
          <CrownSigil size={22} />
          <span className="pin-card">
            <span className="block font-display text-[13px] font-semibold text-ink">
              The Final Summit
            </span>
            <span className="mt-0.5 block font-read text-[12.5px] text-ink-soft">
              Full timed mock test
            </span>
          </span>
        </button>

        {/* the traveller */}
        {current && (
          <div
            className="pointer-events-none absolute z-[15]"
            style={{ left: `${current.x}%`, top: `${current.y}%`, transform: 'translate(-50%, -100%)' }}
          >
            {/* 26px, not the 54px this used to be. Composited against the
                village at four candidate widths: at 54 the traveller stood as
                tall as the cottages behind him. A pin marks the same spot, and
                "Find my traveller" recentres on it, so he does not need to be
                large to be found. */}
            <img
              src="/art/hero-char.webp"
              alt=""
              className="animate-bobHero w-[26px] select-none"
              style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.55))' }}
              draggable={false}
            />
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------ HUD */}

      <h1 className="sr-only">
        Adventure map — {cleared} of {total} landmarks cleared
      </h1>

      {/* vignette so the controls always have something to sit against */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 45%, transparent 52%, rgba(12,9,6,.62) 100%)' }}
        aria-hidden="true"
      />

      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          {/* Top-left column: Camp, then the current objective beneath it. The
              quest card used to be centred in the middle of the map, which put
              it straight over the artwork. */}
          <div className="flex min-w-0 flex-col items-start gap-2.5">
            <button
              type="button"
              onClick={() => {
                sfx.select();
                onExit?.();
              }}
              className="map-btn pointer-events-auto"
              aria-label="Leave the map and return to camp"
            >
              <span aria-hidden="true">‹</span> Camp
            </button>

            {/* Keyed on the quest id, so finishing one objective brings the
                next card in rather than swapping the text underneath you.
                Deliberately not wrapped in AnimatePresence: an exit that never
                completes (hidden tab, no rAF) would leave a stale objective on
                screen. Remounting can't get stuck. */}
            {quest && (
                <m.div
                  key={quest.quest.id}
                  className="quest-card pointer-events-none w-[min(19rem,calc(100vw-1.5rem))]"
                  initial={{ opacity: 0, x: -18, scale: 0.97 }}
                  animate={{ opacity: 1, x: 0, scale: 1, transition: SPRING }}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="eyebrow text-[11.5px]">
                      ✦ Quest {quest.step} of {quest.total}
                    </span>
                    <span className="num text-[12.5px] text-parchment-dim">
                      {Math.min(quest.have, quest.need)}/{quest.need}
                    </span>
                  </div>
                  <p className="mt-1 font-display text-[14px] font-semibold leading-snug text-gold-light">
                    {quest.quest.name}
                  </p>
                  <p className="mt-0.5 font-read text-[13px] leading-snug text-parchment-dim">
                    {quest.quest.objective}
                  </p>
                  {/* The bar settles with weight instead of sliding linearly,
                      so progress reads as something landing. */}
                  <span className="quest-bar mt-2">
                    <m.i
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (quest.have / quest.need) * 100)}%` }}
                      transition={SPRING}
                    />
                  </span>
                </m.div>
              )}
          </div>

          <div className="map-hud pointer-events-auto">
            <span className="num text-[15px] text-gold">{cleared}</span>
            <span className="text-ink-faint">/</span>
            <span className="num text-[15px] text-parchment-dim">{total}</span>
            <span className="ml-1 font-script text-[11px] uppercase tracking-[0.14em] text-ink-faint">
              landmarks
            </span>
            {progress.dayStreak > 0 && (
              <span className="ml-2 border-l border-leather-700 pl-2 font-script text-[11px] uppercase tracking-[0.14em] text-desert">
                {progress.dayStreak}d streak
              </span>
            )}
          </div>
        </div>

        <div className="flex items-end justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              const t = current ?? { x: SUMMIT_AT[0], y: SUMMIT_AT[1] };
              sfx.tick();
              centreOn(t.x, t.y, 1.8);
            }}
            className="map-btn pointer-events-auto"
          >
            Find my traveller
          </button>

          <div className="pointer-events-auto flex flex-col gap-1.5">
            <button type="button" onClick={() => zoomBy(1.35)} className="map-zoom" aria-label="Zoom in">+</button>
            <button type="button" onClick={() => zoomBy(1 / 1.35)} className="map-zoom" aria-label="Zoom out">−</button>
          </div>
        </div>
      </div>
    </main>
  );
}
