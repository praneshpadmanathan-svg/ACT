/* The exploration layer: things to find, and mist over what you have not.

   Two pieces, both living inside the map's transformed world layer so they pan
   and zoom with the terrain.

   Markers — an undiscovered one is a faint glint that catches the eye without
   announcing itself, so finding it feels like noticing rather than being told.
   Once found it becomes a small drawn sigil and stays.

   Mist — a region you have not started is under cloud. It thins as you clear
   landmarks there and lifts entirely once the region is done. This is what
   makes the map visibly change as you work, which is most of the difference
   between a map you look at and a map you explore. Discoveries under mist stay
   hidden, so there is always somewhere left to go. */

import { useRef, useState } from 'react';

import { useStore } from '@/lib/store';
import { sfx } from '@/lib/sfx';
import { cx } from '@/lib/utils';
import { useDialogFocus } from '@/lib/useDialogFocus';
import { m, SPRING } from '@/lib/motion';
import type { SectionId } from '@/types';
import { DISCOVERIES, type Discovery } from './discoveries';
/* The mist bands are the region bands — see `mapData.ts` for why they overlap
   their neighbours rather than butting together. */
import { REGIONS, REGION_ORDER, REGION_BANDS as MIST_BANDS } from './mapData';
import { Band } from './mapView';

/* Where the storm light sits inside a band, as a fraction of its height, and
   how often it fires. The long, uneven durations keep the four regions from
   flashing in chorus — a storm on a metronome reads as a broken light. */
const STORM_AT = [
  { left: 22, at: 0.32, size: 16, dur: 17, delay: 0 },
  { left: 58, at: 0.55, size: 21, dur: 23, delay: -6 },
  { left: 81, at: 0.28, size: 14, dur: 29, delay: -14 },
];

/* The turning sheets a bank is made of.

   Three, because two read as a moire and four cost more than they add. The
   durations do not divide into one another and the middle sheet drifts against
   the other two: what makes it boil is that no two ever return to the same
   relative offset, so the pattern never repeats within a session. Slow — most
   of a minute per cycle — is deliberate. Fog that visibly races is a fan; fog
   that has changed shape when you look back at it is weather.

   Dark on the leading sheet, pale behind it. That ordering matters: a dark
   core seen *through* pale haze reads as depth, and the reverse reads as a
   smudge on the glass.

   `blur` and `scale` are a pair. The sheet is rasterised at 48% of the bank
   and blown up by `scale`, so the blur written here is what gets applied
   *before* that — a 3px blur at scale 3 reads as 9px on screen. Raising one
   without the other changes the picture. */
const SHEETS = [
  {
    dur: 46,
    cx: 20,
    cy: 14,
    scale: 3,
    blur: 3,
    opacity: 0.66,
    background:
      'radial-gradient(ellipse 44% 60% at 24% 36%, rgba(232, 236, 244, 0.94), transparent 66%),' +
      'radial-gradient(ellipse 50% 56% at 72% 62%, rgba(88, 94, 112, 0.5), transparent 64%),' +
      'radial-gradient(ellipse 38% 44% at 52% 18%, rgba(244, 246, 252, 0.7), transparent 70%)',
  },
  {
    dur: 31,
    cx: -26,
    cy: 17,
    scale: 3.4,
    blur: 1.6,
    opacity: 0.52,
    background:
      'radial-gradient(ellipse 34% 48% at 66% 30%, rgba(70, 76, 92, 0.62), transparent 62%),' +
      'radial-gradient(ellipse 42% 38% at 28% 70%, rgba(226, 231, 240, 0.86), transparent 68%)',
  },
  {
    dur: 67,
    cx: 14,
    cy: -23,
    scale: 3.8,
    blur: 4,
    opacity: 0.46,
    background:
      'radial-gradient(ellipse 60% 70% at 44% 52%, rgba(214, 219, 230, 0.8), transparent 72%),' +
      'radial-gradient(ellipse 30% 40% at 84% 44%, rgba(96, 102, 120, 0.45), transparent 66%)',
  },
];

/** Wisps reaching down out of the underside of a mist bank. */
const TENDRIL_AT = [
  { left: 14, w: 2.6, h: 7, dur: 11, delay: 0, lash: 9 },
  { left: 37, w: 3.4, h: 9, dur: 14, delay: -4, lash: -6 },
  { left: 63, w: 2.2, h: 6, dur: 9.5, delay: -7, lash: 12 },
  { left: 88, w: 3, h: 8, dur: 13, delay: -2, lash: -8 },
];

interface Props {
  /** Fraction of each region cleared, 0-1, for how far the mist has lifted. */
  clearedByRegion: Record<SectionId, number>;
  onFound?: (d: Discovery) => void;
}

export function DiscoveryLayer({ clearedByRegion, onFound }: Props) {
  const { progress, updateProgress } = useStore();
  const [open, setOpen] = useState<Discovery | null>(null);
  const found = new Set(progress.discovered ?? []);

  /* A discovery is reachable once its region has been started. The summit ones
     wait until the whole map is done. */
  const reachable = (d: Discovery) => {
    if (d.region === 'summit') {
      return REGION_ORDER.every((id) => (clearedByRegion[id] ?? 0) >= 1);
    }
    return (clearedByRegion[d.region] ?? 0) > 0;
  };

  const find = (d: Discovery) => {
    if (found.has(d.id)) {
      setOpen(d);
      sfx.page();
      return;
    }
    sfx.achieve();
    updateProgress((p) => ({
      ...p,
      discovered: p.discovered.includes(d.id) ? p.discovered : [...p.discovered, d.id],
      xp: p.xp + d.xp,
    }));
    setOpen(d);
    onFound?.(d);
  };

  return (
    <>
      {/* ------------------------------------------------------------- the Grey

          A region you have not started is under storm. It thins as you clear
          landmarks there and lifts entirely once the region is done, which is
          most of the difference between a map you look at and a map you
          explore.

          One <Band> per region, so a bank nowhere near the frame is not in the
          document at all. This is the layer that made the map slow: four banks
          of blurred, animating sheets, three quarters of them off screen. See
          mapView.tsx for the measurement. */}
      {REGION_ORDER.map((id) => {
        const band = MIST_BANDS[id];
        const done = clearedByRegion[id] ?? 0;
        if (done >= 1) return null;
        const alive = 1 - done;

        return (
          <Band key={`grey-${id}`} top={band.top} height={band.height}>
            <div
              className="mapfx-grey-bank"
              aria-hidden="true"
              style={{
                top: `${band.top}%`,
                height: `${band.height}%`,
                /* Thin enough to read the terrain through. It started at 0.88,
                   which buried whole regions in grey — you could not see what
                   you were being invited to explore, which defeats the point.
                   The Grey is a hint that ground is unvisited, not a blackout. */
                opacity: 0.52 * alive,
              }}
            >
              {SHEETS.map((sheet, i) => (
                <span
                  key={i}
                  className="mapfx-grey-churn"
                  style={{
                    background: sheet.background,
                    filter: `blur(${sheet.blur}px)`,
                    opacity: sheet.opacity,
                    animationDuration: `${sheet.dur}s`,
                    /* Negative, so the three are already mid-turn on the first
                       frame rather than all starting square to the frame. */
                    animationDelay: `-${sheet.dur * (i + 1) * 0.17}s`,
                    ['--cx' as string]: `${sheet.cx}%`,
                    ['--cy' as string]: `${sheet.cy}%`,
                    ['--churn-scale' as string]: sheet.scale,
                  }}
                />
              ))}

              {/* The swell. Slowest thing in the bank, and the only one that
                  changes the mass rather than the pattern. */}
              <span
                className="mapfx-grey-surge"
                style={{
                  background:
                    'radial-gradient(ellipse 70% 60% at 50% 62%, rgba(206, 212, 226, 0.9), transparent 70%)',
                  filter: 'blur(6px)',
                  animationDuration: '13s',
                  animationDelay: `-${band.top * 0.11}s`,
                }}
              />
            </div>

            {/* Storm light and the wisps it throws, keyed to the same fraction as
                the bank so a region falls quiet as it clears. These sit outside
                the bank's clipping box on purpose: a tendril reaching below the
                band is the point of it. */}
            <div aria-hidden="true">
              {STORM_AT.map((s, i) => (
                <span
                  key={`flash-${i}`}
                  className="mapfx-grey-flash"
                  style={{
                    left: `${s.left}%`,
                    top: `${band.top + band.height * s.at}%`,
                    width: `${s.size}%`,
                    height: `${s.size * 0.6}%`,
                    animationDuration: `${s.dur}s`,
                    animationDelay: `${s.delay}s`,
                    opacity: alive,
                  }}
                />
              ))}
              {TENDRIL_AT.map((t, i) => (
                <span
                  key={`tendril-${i}`}
                  className="mapfx-grey-tendril"
                  style={{
                    left: `${t.left}%`,
                    top: `${band.top + band.height * 0.82}%`,
                    width: `${t.w}%`,
                    height: `${t.h}%`,
                    animationDuration: `${t.dur}s`,
                    animationDelay: `${t.delay}s`,
                    opacity: alive,
                    ['--lash' as string]: `${t.lash}deg`,
                  }}
                />
              ))}
            </div>
          </Band>
        );
      })}

      {/* ----------------------------------------------------------- markers */}
      {DISCOVERIES.map((d) => {
        const isFound = found.has(d.id);
        if (!isFound && !reachable(d)) return null;
        return (
          <button
            key={d.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              find(d);
            }}
            className={cx('discovery', isFound ? 'discovery-found' : 'discovery-hidden')}
            style={{ left: `${d.at[0]}%`, top: `${d.at[1]}%` }}
            aria-label={
              isFound ? `${d.name} — discovered. Read again.` : 'Something here. Look closer.'
            }
          >
            <span className="discovery-mark" aria-hidden="true">
              {isFound ? (
                <svg
                  viewBox="0 0 24 24"
                  width="13"
                  height="13"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 3.5 14 9l5.5.4-4.2 3.6 1.3 5.4L12 15.5 7.4 18.4l1.3-5.4L4.5 9.4 10 9l2-5.5Z" />
                </svg>
              ) : null}
            </span>
          </button>
        );
      })}

      {/* -------------------------------------------------------------- card */}
      {open && <DiscoveryCard discovery={open} onClose={() => setOpen(null)} />}
    </>
  );
}

/* The reveal. Sits outside the world layer so it is never scaled or panned.

   This claimed `aria-modal="true"` for a long time while doing none of the work
   that claim promises: measured on a fully-explored map there were 69 focusable
   elements still live behind it, so Tab walked straight out of the card and off
   into the pins underneath it. The other four dialogs in the app all call
   `useDialogFocus`; this was the only one that did not. */
function DiscoveryCard({ discovery, onClose }: { discovery: Discovery; onClose: () => void }) {
  const region = discovery.region === 'summit' ? null : REGIONS[discovery.region as SectionId];
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, true, onClose);

  return (
    <div
      ref={ref}
      className="fixed inset-0 z-[115] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      aria-label={discovery.name}
    >
      {/* The scrim is after the card in source order, not before it. The trap
          focuses the first focusable in the dialog, and with the scrim first
          that was this invisible full-screen button rather than "Back to the
          map" — which is what the card's `autoFocus` used to ask for, before
          the trap started overriding it. `z-10` on the card keeps the paint
          order the same either way. */}
      <m.div
        className="sheet relative z-10 w-full max-w-md p-6 sm:p-7"
        initial={{ opacity: 0, y: 18, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: SPRING }}
        style={{ borderTopColor: region?.color ?? '#e8c34a', borderTopWidth: 3 }}
      >
        <div className="label-quill">✦ Discovery</div>
        <h2 className="mt-1.5 font-read text-[1.5rem] font-semibold leading-tight text-ink">
          {discovery.name}
        </h2>
        <p className="mt-3 font-read text-[1.05rem] font-medium leading-[1.72] text-ink">
          {discovery.lore}
        </p>
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-parchment-edge pt-4">
          <span className="label-quill">+{discovery.xp} XP</span>
          <button type="button" onClick={onClose} className="btn btn-quill">
            Back to the map
          </button>
        </div>
      </m.div>
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-leather-950/80 backdrop-blur-sm"
        aria-label="Close"
      />
    </div>
  );
}
