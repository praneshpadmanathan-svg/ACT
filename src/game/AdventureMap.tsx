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
import { RankSigil } from '@/components/RankSigil';
import { rankProgress } from '@/lib/progress';
import { useStore } from '@/lib/store';
import { useNavigate } from '@/lib/router';
import { sfx } from '@/lib/sfx';
import { clamp, cx } from '@/lib/utils';
import type { SectionId, Zone } from '@/types';
import { GUARDIAN_AT, MAP_H, MAP_W, REGIONS, REGION_ORDER, SUMMIT_AT } from './mapData';
import { bossFor } from './bosses';
import { BossArt } from './BossArt';
import { activeQuest } from './story';
import { DISCOVERIES } from './discoveries';
import { courierFor, mapEchoes } from './mapEvents';
import { DiscoveryLayer } from './DiscoveryLayer';
import { MapJournal } from './MapJournal';
import { m, PIN_SPRING, SPRING, useReducedMotion } from '@/lib/motion';
import { MapFx } from './MapFx';
import { PlagueLayer, TrailLayer } from './MapLayers';
import { ClearedSigil, CrownSigil, LockSigil, MasterSigil } from './Sigils';
import { HeroSprite } from './HeroSprite';
import { Art } from '@/components/Art';

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
          zone,
          section,
          color: region.color,
          x: spot[0],
          y: spot[1],
          state,
          best,
          index,
        };
        pins.push(pin);
        if (state === 'current' && !current) current = pin;
      });
    }

    pins.sort(
      (a, b) =>
        REGION_ORDER.indexOf(a.section) - REGION_ORDER.indexOf(b.section) || a.index - b.index,
    );

    return { pins, current, cleared, total, allCleared: cleared === total && total > 0 };
    /* This carried an `eslint-disable-next-line react-hooks/exhaustive-deps`
       for as long as it existed, and the linter that could have judged it was
       never installed. Now that one is: the list below is complete, the
       suppression was protecting nothing, and it is gone. */
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
  const { progress, rank } = useStore();
  const navigate = useNavigate();
  const { pins, current, cleared, total } = useMapProgress();
  const rankPct = useMemo(() => rankProgress(progress.xp), [progress.xp]);
  const quest = useMemo(
    () => activeQuest(progress, { cleared, total }),
    [progress, cleared, total],
  );

  /* How far each region has been walked, 0-1 — drives how much of its mist has
     lifted and which discoveries have become reachable. */
  const clearedByRegion = useMemo(() => {
    const out = {} as Record<SectionId, number>;
    for (const id of REGION_ORDER) {
      const nodes = PATH_BY_ID[id]?.nodes ?? [];
      const done = nodes.filter((n) => progress.zonesCleared[n.id] !== undefined).length;
      out[id] = nodes.length ? done / nodes.length : 0;
    }
    return out;
  }, [progress.zonesCleared]);

  /* What is calling you back, and where. Keyed on the review ladder rather than
     on the whole progress object: an XP change should not re-sort the echoes. */
  const echoes = useMemo(() => mapEchoes(progress), [progress]);

  /* The courier stands on ground already walked. Cleared landmarks, plus the
     one the traveller is at — anything further on is still under mist, and
     sending someone to a place they cannot open is a worse invitation than
     none. */
  const courier = useMemo(() => {
    const reachable = pins
      .filter((p) => p.state === 'done' || p.state === 'current')
      .map((p) => p.zone.id);
    return courierFor(progress, reachable);
  }, [pins, progress]);

  const courierPin = useMemo(
    () => (courier ? (pins.find((p) => p.zone.id === courier.zoneId) ?? null) : null),
    [courier, pins],
  );

  /* Everything due in a region: its landmarks' own questions *plus* the drills
     filed under its topics.

     The rail showed only the drill count at first, which made it contradict the
     map beside it — the Grammar Village read "2 due" while four of its cottages
     were visibly glowing. A summary that disagrees with the thing it summarises
     is worse than no summary. */
  const dueByRegion = useMemo(() => {
    const out = {} as Record<SectionId, number>;
    for (const id of REGION_ORDER) {
      const zoneDue = (PATH_BY_ID[id]?.nodes ?? []).reduce(
        (n, node) => n + (echoes.byZone[node.id] ?? 0),
        0,
      );
      out[id] = zoneDue + (echoes.bySection[id] ?? 0);
    }
    return out;
  }, [echoes]);

  const foundCount = progress.discovered?.length ?? 0;
  const [journalOpen, setJournalOpen] = useState(false);
  const reducedMotion = useReducedMotion();

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

  /* The same clamp, but the edge pushes back instead of refusing.
   *
   * A hard stop at the boundary reads as a bug — the map simply stops
   * responding to a hand that is still moving. Letting it past with rising
   * resistance, then springing it home on release, is what makes an edge feel
   * like a physical limit rather than a broken control. Resistance rises to a
   * ceiling of 85% so a determined drag can never tear the map off screen. */
  const softClamp = useCallback((next: View, box: Size): View => {
    const zoom = clamp(next.zoom, MIN_ZOOM, MAX_ZOOM);
    const scale = Math.max(box.w / MAP_W, box.h / MAP_H) * zoom;
    const maxX = Math.max(0, (MAP_W * scale - box.w) / 2);
    const maxY = Math.max(0, (MAP_H * scale - box.h) / 2);

    const soften = (raw: number, limit: number, span: number) => {
      const hard = clamp(raw, -limit, limit);
      const over = raw - hard;
      if (!over) return hard;
      const give = 1 - Math.min(Math.abs(over) / (0.35 * span), 0.85);
      return hard + over * give;
    };

    return {
      zoom,
      x: soften(next.x, maxX, box.w),
      y: soften(next.y, maxY, box.h),
    };
  }, []);

  /* Zoom toward a point rather than the middle of the screen.
   *
   * Every zoom path used to keep x and y untouched, which anchors the scale to
   * the viewport centre. On a wheel that is merely unhelpful; on a pinch it is
   * plainly wrong, because the gesture names its own anchor — the point between
   * your fingers — and watching that point slide away is the single most
   * "this is a web page" moment the map had.
   *
   * `cx`/`cy` are offsets from the frame centre. Keeping the map point under
   * them fixed means the pan has to move by the same proportion the scale did. */
  const zoomAt = useCallback(
    (factor: number, cx = 0, cy = 0) => {
      setView((v) => {
        const zoom = clamp(v.zoom * factor, MIN_ZOOM, MAX_ZOOM);
        const k = zoom / v.zoom;
        if (k === 1) return v;
        return clampView({ zoom, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k }, frame);
      });
    },
    [clampView, frame],
  );

  /** Centre the view on a point given in map percentages. */
  const centreOn = useCallback(
    (px: number, py: number, zoom?: number) => {
      setView((prev) => {
        const z = zoom ?? prev.zoom;
        const scale = Math.max(frame.w / MAP_W, frame.h / MAP_H) * z;
        // Offset from the map's centre, in scaled pixels, negated to bring
        // that point to the middle of the frame.
        const dx = ((50 - px) / 100) * MAP_W * scale;
        const dy = ((50 - py) / 100) * MAP_H * scale;
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

  /* Declared before the keyboard handler below, which depends on it. */
  /* The +/- buttons and the keyboard have no cursor to anchor to, so these
     stay centred — which is correct for them, and is exactly what was wrong
     for the wheel and the pinch. */
  const zoomBy = useCallback(
    (factor: number) => {
      sfx.tick();
      zoomAt(factor);
    },
    [zoomAt],
  );

  /* ------------------------------------------------------------ keyboard

     The map had no keyboard handling at all: pan and zoom were pointer-only, so
     someone navigating by keyboard could tab between landmark pins but could
     not move the view to see where any of them were.

     Arrows pan, +/- zoom, 0 recentres on the traveller. Typing keys are left
     alone, and anything with a modifier is left to the browser. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      // A dialog is open over the map — it owns the keyboard.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;

      const STEP = 90;
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowRight':
        case 'ArrowUp':
        case 'ArrowDown': {
          e.preventDefault();
          const dx = e.key === 'ArrowLeft' ? STEP : e.key === 'ArrowRight' ? -STEP : 0;
          const dy = e.key === 'ArrowUp' ? STEP : e.key === 'ArrowDown' ? -STEP : 0;
          setView((v) => clampView({ ...v, x: v.x + dx, y: v.y + dy }, frame));
          break;
        }
        case '+':
        case '=':
          e.preventDefault();
          zoomBy(1.35);
          break;
        case '-':
        case '_':
          e.preventDefault();
          zoomBy(1 / 1.35);
          break;
        case '0': {
          e.preventDefault();
          const t = current ?? { x: SUMMIT_AT[0], y: SUMMIT_AT[1] };
          centreOn(t.x, t.y, 1.8);
          break;
        }
        default:
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clampView, frame, zoomBy, centreOn, current]);

  /* Focusing a pin with the keyboard brings it into view — otherwise tabbing
     moves an invisible focus ring around a map that never scrolls. */
  const revealOnFocus = useCallback(
    (x: number, y: number) => (e: React.FocusEvent) => {
      // Only for keyboard focus; a click already put the pin under the cursor.
      if (!e.target.matches(':focus-visible')) return;
      centreOn(x, y, Math.max(view.zoom, 1.4));
    },
    [centreOn, view.zoom],
  );

  /* ------------------------------------------------------------ gestures */

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ dist: number; zoom: number } | null>(null);
  const moved = useRef(false);

  /* --------------------------------------------------------- momentum

     The map used to stop dead the instant you lifted your finger. On a phone
     that reads as broken rather than precise: every other surface a student
     touches carries a flick, so a map that refuses to feels like one that did
     not hear them.

     Velocity is averaged over the last ~80ms of movement rather than taken from
     the final two events, because the last sample before a lift is usually
     noise — fingers decelerate as they leave the glass, and reading only that
     would kill most flicks before they started. */
  const drift = useRef<{ vx: number; vy: number; at: number }[]>([]);
  const glide = useRef<number | null>(null);

  const stopGlide = useCallback(() => {
    if (glide.current !== null) {
      cancelAnimationFrame(glide.current);
      glide.current = null;
    }
  }, []);

  /** Settle back inside the boundary after a rubber-band overshoot. */
  const settle = useCallback(() => {
    setView((v) => clampView(v, frame));
  }, [clampView, frame]);

  const startGlide = useCallback(() => {
    const recent = drift.current.filter((s) => performance.now() - s.at < 90);
    if (!recent.length) return settle();
    let vx = recent.reduce((n, s) => n + s.vx, 0) / recent.length;
    let vy = recent.reduce((n, s) => n + s.vy, 0) / recent.length;
    if (Math.hypot(vx, vy) < 1.4) return settle();

    const step = () => {
      // 0.94 per frame is ~0.9s of glide from a firm flick.
      vx *= 0.94;
      vy *= 0.94;
      setView((v) => clampView({ ...v, x: v.x + vx, y: v.y + vy }, frame));
      if (Math.hypot(vx, vy) > 0.3) {
        glide.current = requestAnimationFrame(step);
      } else {
        glide.current = null;
      }
    };
    glide.current = requestAnimationFrame(step);
  }, [clampView, frame, settle]);

  // Never leave a rAF loop running behind an unmounted map.
  useEffect(() => stopGlide, [stopGlide]);

  const onPointerDown = (e: React.PointerEvent) => {
    /* Touching the map takes it back. An animation you cannot interrupt reads
       as a cutscene, not as a control. */
    stopGlide();
    drift.current = [];
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

    const [a, b] = points;
    if (a && b) {
      // Pinch: track the distance between the first two contacts.
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (!pinchStart.current) {
        pinchStart.current = { dist, zoom: view.zoom };
      } else {
        const ratio = dist / pinchStart.current.dist;
        /* Anchored on the centroid between the fingers — the point the gesture
           is actually about — expressed as an offset from the frame centre. */
        const cx = (a.x + b.x) / 2 - frame.w / 2;
        const cy = (a.y + b.y) / 2 - frame.h / 2;
        setView((v) => {
          const zoom = clamp(pinchStart.current!.zoom * ratio, MIN_ZOOM, MAX_ZOOM);
          const k = zoom / v.zoom;
          return clampView({ zoom, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k }, frame);
        });
      }
      moved.current = true;
      return;
    }

    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) moved.current = true;
    drift.current.push({ vx: dx, vy: dy, at: performance.now() });
    if (drift.current.length > 12) drift.current.shift();
    // Soft while the hand is down, so the edge gives rather than refuses.
    setView((v) => softClamp({ ...v, x: v.x + dx, y: v.y + dy }, frame));
  };

  const endPointer = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 0) {
      setDragging(false);
      startGlide();
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    const factor = Math.exp(-e.deltaY * 0.0016);
    zoomAt(factor, e.clientX - frame.w / 2, e.clientY - frame.h / 2);
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
          /* Published so the hover cards can divide it back out. Everything in
             this layer is a thing in the world and should grow when the world
             does — except the labels, which are writing *about* the world and
             have to stay the size type is meant to be read at. See `.pin-card`
             in index.css. */
          ['--map-scale' as string]: coverScale,
        }}
      >
        {/* Marked essential: this is the screen, not decoration for it.
            Reduced-data mode drops the other four paintings and keeps this
            one, because a map you cannot see is thirty-seven invisible
            buttons. */}
        <Art
          name="world-map"
          essential
          priority
          sizes="(min-width: 1024px) 900px, 100vw"
          alt="A painted map of the realm: farmland and a village in the north, an enchanted forest, a desert of canyons and ruins, cliffs above a harbour, and a golden citadel on an island to the south."
          className="absolute inset-0 h-full w-full select-none"
        />

        {/* The plague sits directly on the painting and nothing else, because
            it works by blending with what is beneath it — put the road or the
            mist underneath and it would drain those too. */}
        <PlagueLayer cleared={clearedByRegion} />

        <MapFx />

        {/* The road goes over the weather but under the pins: you should be
            able to see where it leads through thin mist, and a pin should
            never be behind it. */}
        <TrailLayer cleared={clearedByRegion} />

        {/* Things to find, and cloud over ground not yet walked. */}
        <DiscoveryLayer clearedByRegion={clearedByRegion} />

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
          /* Questions from this landmark have come due. Only ever on cleared
             ground — you cannot be called back to somewhere you have not been,
             and the review ladder has no entries for a zone you never opened. */
          const echo = echoes.byZone[pin.zone.id] ?? 0;
          return (
            <span
              key={pin.zone.id}
              className="pin-anchor"
              style={{ left: `${pin.x}%`, top: `${pin.y}%`, ['--pin-i' as string]: i }}
            >
              <m.button
                type="button"
                onClick={() => openZone(pin)}
                onFocus={revealOnFocus(pin.x, pin.y)}
                aria-disabled={pin.state === 'locked'}
                /* A control should say it is a control before you press it, say
                 it heard you within a frame, and settle rather than stop. The
                 pins did none of the three — they were static discs that
                 navigated, which is the most legible "web page, not game"
                 signal there is.

                 The release overshoot is free: damping below critical means
                 letting go of 0.94 carries past 1 to about 1.06 before it
                 settles. That is the follow-through, and it costs no second
                 animation.

                 Reduced motion swaps the channel rather than dropping the
                 answer — silence would be worse than stillness. */
                whileHover={reducedMotion ? { filter: 'brightness(1.18)' } : { scale: 1.09, y: -3 }}
                whileTap={reducedMotion ? { filter: 'brightness(0.9)' } : { scale: 0.94, y: 0 }}
                transition={reducedMotion ? { duration: 0.12 } : PIN_SPRING}
                className={cx(
                  'pin group animate-popIn',
                  pin.state === 'done' && 'pin-done',
                  pin.state === 'current' && 'pin-current',
                  pin.state === 'locked' && 'pin-locked',
                )}
                style={{ animationDelay: `${i * 16}ms` }}
              >
                {pin.state === 'current' && (
                  <span
                    className="pointer-events-none absolute inset-0 animate-pulseRing rounded-full border-2 border-gold-bright"
                    aria-hidden="true"
                  />
                )}

                {/* The echo: this landmark has questions due again.

                    Deliberately a different shape from the current-landmark
                    ring — a slow halo rather than a pulse — because they mean
                    opposite things. Gold says "go here next"; this says "you
                    have been here, and it is fading." Two identical rings
                    meaning two different instructions would be worse than not
                    marking it at all. */}
                {echo > 0 && (
                  <>
                    <span className="echo-halo" aria-hidden="true" />
                    <span className="echo-count num" aria-hidden="true">
                      {echo}
                    </span>
                  </>
                )}

                {pin.state === 'locked' ? (
                  <LockSigil size={17} />
                ) : mastered ? (
                  <MasterSigil size={17} />
                ) : pin.state === 'done' ? (
                  <ClearedSigil size={17} />
                ) : (
                  <span className="num text-[14px] font-semibold leading-none">
                    {pin.index + 1}
                  </span>
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
                  {echo > 0 && (
                    <span className="mt-1 block font-script text-[11.5px] uppercase tracking-[0.12em] text-woods-text">
                      {echo === 1 ? '1 question' : `${echo} questions`} calling you back
                    </span>
                  )}
                </span>
              </m.button>
            </span>
          );
        })}

        {/* The four guardians.

            The story calls these the Seals and the whole quest chain turns on
            them, but they were only reachable from the region list — so the
            spine of the game was invisible on the map itself. Dormant while
            landmarks remain, awake once the region is clear, felled once
            beaten. */}
        {REGION_ORDER.map((id) => {
          const boss = bossFor(id);
          const spot = GUARDIAN_AT[id];
          if (!boss || !spot) return null;
          const done = clearedByRegion[id] ?? 0;
          const awake = done >= 1;
          const felled = progress.achievements.includes(`boss-${boss.id}`);

          return (
            <button
              key={`guardian-${id}`}
              type="button"
              onClick={() => {
                if (moved.current) return;
                if (!awake) {
                  sfx.locked();
                  return;
                }
                sfx.select();
                navigate({ name: 'boss', section: id });
              }}
              aria-disabled={!awake}
              aria-label={
                felled
                  ? `${boss.name} — defeated. Fight again.`
                  : awake
                    ? `${boss.name} — awake and waiting`
                    : `${boss.name} — sealed. Clear every landmark in ${REGIONS[id].title} first.`
              }
              className={cx(
                'guardian group',
                felled && 'guardian-felled',
                !felled && awake && 'guardian-awake',
                !awake && 'guardian-sealed',
              )}
              style={{ left: `${spot[0]}%`, top: `${spot[1]}%` }}
            >
              {awake && !felled && (
                <span
                  className="pointer-events-none absolute inset-0 animate-pulseRing rounded-full border-2"
                  style={{ borderColor: boss.color }}
                  aria-hidden="true"
                />
              )}
              <span className="guardian-art" aria-hidden="true">
                <BossArt section={id} state={felled ? 'defeated' : 'idle'} />
              </span>
              <span className="pin-card">
                <span className="block font-display text-[13px] font-semibold leading-tight text-ink">
                  {boss.name}
                </span>
                <span className="mt-0.5 block font-read text-[12.5px] leading-snug text-ink-soft">
                  {felled
                    ? 'Seal broken · fight again'
                    : awake
                      ? 'Awake — the Seal is yours to take'
                      : `Sealed · ${Math.round(done * 100)}% of the road walked`}
                </span>
              </span>
            </button>
          );
        })}

        {/* The courier.

            The daily challenge existed and lived at `#/daily`, reachable from
            a dashboard tile. Nothing about it was in the world — the map is
            where this game happens, and the one thing designed to be done every
            single day was the only thing not on it.

            So she stands at a landmark, a different one each day, chosen only
            from ground already walked. That is the whole mechanic: a reason to
            open the map on a day you were not going to, and somewhere to go
            when it is open. See `courierFor`. */}
        {courier && courierPin && (
          <m.button
            type="button"
            onClick={() => {
              if (moved.current) return;
              sfx.select();
              navigate({ name: 'daily' });
            }}
            className={cx('courier group', courier.done && 'courier-done')}
            style={{ left: `${courierPin.x}%`, top: `${courierPin.y}%` }}
            /* The position is keyed so that a courier who has moved overnight
               arrives rather than blinks into place — the same reasoning as the
               traveller walking between landmarks. */
            key={courier.zoneId}
            initial={reducedMotion ? false : { scale: 0, y: -12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={PIN_SPRING}
            whileHover={reducedMotion ? { filter: 'brightness(1.18)' } : { scale: 1.1, y: -3 }}
            whileTap={reducedMotion ? { filter: 'brightness(0.9)' } : { scale: 0.94 }}
            aria-label={
              courier.done
                ? `The courier at ${courierPin.zone.name} — today's challenge is done`
                : `The courier is waiting at ${courierPin.zone.name} — today's five questions`
            }
          >
            {!courier.done && (
              <span
                className="pointer-events-none absolute inset-0 animate-pulseRing rounded-full border-2 border-desert-text"
                aria-hidden="true"
              />
            )}
            <span className="courier-mark" aria-hidden="true">
              ✦
            </span>
            <span className="pin-card">
              <span className="block font-display text-[13px] font-semibold leading-tight text-ink">
                The Courier
              </span>
              <span className="mt-0.5 block font-read text-[12.5px] leading-snug text-ink-soft">
                {courier.done
                  ? 'Her round is done. She rides on at midnight.'
                  : `Five questions, waiting at ${courierPin.zone.name}.`}
              </span>
            </span>
          </m.button>
        )}

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

        {/* The traveller.

            He used to jump to the new landmark the instant one was cleared.
            Animating left/top means he actually walks the distance, so clearing
            a zone visibly advances you across the world instead of teleporting
            you. Percent-based, so it stays correct at any zoom. */}
        {current && (
          <m.div
            className="pointer-events-none absolute z-[15]"
            style={{ transform: 'translate(-50%, -100%)' }}
            initial={false}
            animate={{ left: `${current.x}%`, top: `${current.y}%` }}
            transition={{ type: 'spring', stiffness: 55, damping: 18, mass: 1.1 }}
          >
            {/* A pixel sprite, not a drawn mark. Three passes at drawing this
                figure in vectors all lost the same thing: a face small enough
                to fit on the map is a face too small to be anyone. Pixel art
                is drawn *for* this size.

                It is still keyed to the chosen hero, which is the point — the
                painted `hero-char` cutout this replaced years-ago was one boy
                with brown hair, so the chooser changed a picture on the profile
                screen and nothing in the world.

                46, against 34-unit landmark pins. A person should be a little
                taller than a signpost, and on a phone the cover scale runs
                under 1, so anything smaller lands near 30 screen pixels. The
                sprite's own 176px never gets upscaled: even at MAX_ZOOM this
                works out around 149, so the browser is always sampling down
                and the edges stay clean. */}
            <HeroSprite
              hero={progress.hero}
              height={46}
              className="animate-bobHero select-none"
              style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.55))' }}
            />
          </m.div>
        )}
      </div>

      {/* ------------------------------------------------------------ HUD */}

      <h1 className="sr-only">
        Adventure map — {cleared} of {total} landmarks cleared
      </h1>

      {/* Space for the chrome (finding 27: "nothing in the map's composition
          accounts for the HUD — overlay chrome sits on top of painted detail
          rather than in space left for it").

          The composition cannot be changed; the painting is the painting. So
          the space is made here instead, and the shape of it matters. A radial
          vignette darkens the *edges* evenly, which is not where the HUD is —
          the HUD is in two horizontal bars, and the middle of the left edge,
          which the radial darkened hardest, holds nothing at all.

          Two linear scrims along the top and bottom instead, deepest where the
          buttons are and gone by a third of the way in, with the radial kept
          underneath at half strength for the corners. Camp, the quest card,
          the zoom controls and the legend all now sit on their own ground. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, rgba(12,9,6,.72) 0%, rgba(12,9,6,.34) 12%, transparent 30%),' +
            'linear-gradient(to top, rgba(12,9,6,.76) 0%, rgba(12,9,6,.36) 13%, transparent 32%),' +
            'radial-gradient(ellipse at 50% 45%, transparent 58%, rgba(12,9,6,.42) 100%)',
        }}
        aria-hidden="true"
      />

      <div className="map-safe pointer-events-none absolute inset-0 flex flex-col justify-between">
        {/* The top band: Camp and the tallies share a row, and the objective
            drops beneath both.

            It used to be two columns side by side — Camp with the quest card
            under it on the left, the tallies on the right. On a phone that
            does not fit: the quest card is capped at `100vw - 1.5rem`, so the
            left column alone takes the whole width and the tallies were pushed
            426px wide off the right edge and across the Camp button. The
            counters were unreadable and Camp was unclickable on exactly the
            device most of this audience is holding.

            Putting the objective on its own line costs one row of height and
            makes the two things that must always be reachable — leave, and
            read your progress — fit at any width. */}
        <div className="flex flex-col items-start gap-2.5">
          <div className="flex w-full items-start justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                sfx.select();
                onExit?.();
              }}
              className="map-btn pointer-events-auto shrink-0"
              aria-label="Leave the map and return to camp"
            >
              <span aria-hidden="true">‹</span> Camp
            </button>

            {/* What has been counted, then who is counting. The rank sits under
                the tallies rather than inside them because it is not another
                number — it is the only thing on this screen that says who you
                have become, and a fifth item in that bar would have read as
                one. */}
            <div className="flex min-w-0 flex-col items-end gap-2">
              <div className="map-hud pointer-events-auto">
                {/* One flex child, not four. The bar wraps on a narrow screen, and
                loose spans would have let "5", "/" and "37" drift apart — or
                break across two lines mid-tally. */}
                <span className="whitespace-nowrap">
                  <span className="num text-[15px] text-gold">{cleared}</span>
                  <span className="text-ink-faint">/</span>
                  <span className="num text-[15px] text-parchment-dim">{total}</span>
                  <span className="ml-1 font-script text-[11px] uppercase tracking-[0.14em] text-ink-faint">
                    landmarks
                  </span>
                </span>
                {/* Opens the journal: what there is to find, and what the marks on
                the map mean. */}
                <button
                  type="button"
                  onClick={() => {
                    sfx.page();
                    setJournalOpen(true);
                  }}
                  className="map-hud-sep whitespace-nowrap transition-colors hover:text-parchment"
                  aria-label={`Journal — ${foundCount} of ${DISCOVERIES.length} discoveries found`}
                >
                  <span className="num text-[15px] text-gold-light">{foundCount}</span>
                  <span className="text-ink-faint">/</span>
                  <span className="num text-[15px] text-parchment-dim">{DISCOVERIES.length}</span>
                  <span className="ml-1 font-script text-[11px] uppercase tracking-[0.14em] text-ink-faint">
                    found
                  </span>
                </button>
                {/* Everything due, including the drill questions that belong to a
                topic rather than to any one landmark and so cannot be drawn on
                the map at all. Without this the HUD would quietly under-report
                the backlog whenever most of it came from drills. */}
                {echoes.total > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      sfx.select();
                      navigate({ name: 'review' });
                    }}
                    className="map-hud-sep whitespace-nowrap transition-colors hover:text-parchment"
                    aria-label={`${echoes.total} questions due for review — open the review session`}
                  >
                    <span className="num text-[15px] text-woods-text">{echoes.total}</span>
                    <span className="ml-1 font-script text-[11px] uppercase tracking-[0.14em] text-ink-faint">
                      due
                    </span>
                  </button>
                )}
                {progress.dayStreak > 0 && (
                  <span className="map-hud-sep font-script text-[11px] uppercase tracking-[0.14em] text-desert">
                    {progress.dayStreak}d streak
                  </span>
                )}
              </div>

              {/* Rank.
                Every other screen carries the rank sigil and the bar to the
                next one; the map, where a student spends most of their time,
                carried neither. So the one axis that runs the whole length of
                the game was invisible on the screen built to show a journey.

                It opens Stats rather than doing nothing, because the obvious
                question a bar four-fifths full provokes is "of what?", and the
                rank ladder that answers it already exists there. */}
              <button
                type="button"
                onClick={() => {
                  sfx.select();
                  navigate({ name: 'stats' });
                }}
                className="rank-cartouche pointer-events-auto"
                aria-label={
                  rankPct.next
                    ? `${rank.name} — ${rankPct.span - rankPct.into} XP to ${rankPct.next.name}. Open your stats.`
                    : `${rank.name}, the highest rank. Open your stats.`
                }
              >
                <RankSigil rank={rank} size={26} />
                <span className="flex flex-col items-start gap-1">
                  <span className="font-script text-[11px] uppercase leading-none tracking-[0.14em] text-parchment-dim">
                    {rank.name}
                  </span>
                  {/* At the top rank there is no "next", and a bar pinned full
                    forever reads as a broken bar. The XP total is the honest
                    thing to show once there is nothing left to fill. */}
                  {rankPct.next ? (
                    <span className="rank-cartouche-bar" aria-hidden="true">
                      <i
                        style={{
                          width: `${Math.round(rankPct.pct * 100)}%`,
                          background: rank.color,
                        }}
                      />
                    </span>
                  ) : (
                    <span className="num text-[11px] leading-none text-gold-light">
                      {progress.xp} xp
                    </span>
                  )}
                </span>
              </button>
            </div>
          </div>

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

        <div className="flex items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col items-start gap-2">
            {/* Fast travel.

                Thirty-seven landmarks across a portrait map on a landscape
                screen means the Science Cliffs are four drags from the Grammar
                Village, and the only way to know how a region was doing was to
                go and look at it. Four buttons: jump the camera, and read the
                count without going.

                A rail rather than a compass rose — a rose implies eight
                directions and there are four places, and the counts have to be
                legible, which a ring of glyphs cannot do. */}
            <div className="pointer-events-auto flex flex-wrap gap-1.5">
              {REGION_ORDER.map((id) => {
                const region = REGIONS[id];
                const nodes = PATH_BY_ID[id]?.nodes ?? [];
                const done = nodes.filter((n) => progress.zonesCleared[n.id] !== undefined).length;
                const dueHere = dueByRegion[id] ?? 0;

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      sfx.tick();
                      /* The centre of the region's own landmarks, not the
                         plaque: the plaque is placed for legibility against the
                         painting and sits off to one side of several bands. */
                      const spots = region.pins;
                      const cx0 = spots.reduce((n, p) => n + p[0], 0) / spots.length;
                      const cy0 = spots.reduce((n, p) => n + p[1], 0) / spots.length;
                      centreOn(cx0, cy0, 1.5);
                    }}
                    className="region-jump"
                    style={{ ['--region' as string]: region.color }}
                    aria-label={`${region.title} — ${done} of ${nodes.length} cleared${
                      dueHere ? `, ${dueHere} due for review` : ''
                    }. Jump there.`}
                  >
                    <span className="region-jump-dot" aria-hidden="true" />
                    <span className="num text-[12px] leading-none">
                      {done}
                      <span className="text-ink-faint">/{nodes.length}</span>
                    </span>
                    {dueHere > 0 && <span className="region-jump-due" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>

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
          </div>

          <div className="pointer-events-auto flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => zoomBy(1.35)}
              className="map-zoom"
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => zoomBy(1 / 1.35)}
              className="map-zoom"
              aria-label="Zoom out"
            >
              −
            </button>
          </div>
        </div>
      </div>

      {journalOpen && <MapJournal onClose={() => setJournalOpen(false)} />}
    </main>
  );
}
