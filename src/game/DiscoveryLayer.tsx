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

import { useState } from 'react';

import { useStore } from '@/lib/store';
import { sfx } from '@/lib/sfx';
import { cx } from '@/lib/utils';
import { m, SPRING } from '@/lib/motion';
import type { SectionId } from '@/types';
import { DISCOVERIES, type Discovery } from './discoveries';
import { REGIONS, REGION_ORDER } from './mapData';

/* Vertical band each region's mist covers, in map percent, from the same
   terrain crops the landmark pins were placed from.

   The bands deliberately overrun their region and overlap their neighbours by
   roughly 8%. Each band's edges are feathered to nothing in CSS, so butting
   them together exactly would leave a transparent seam along every boundary —
   a visible horizontal line across the map, which is the opposite of weather.
   Overlapping means the feathers cross instead. */
const MIST_BANDS: Record<SectionId, { top: number; height: number }> = {
  english: { top: -5, height: 32 },
  reading: { top: 19, height: 28 },
  math: { top: 39, height: 26 },
  science: { top: 55, height: 32 },
};

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
      {/* -------------------------------------------------------------- mist */}
      {REGION_ORDER.map((id) => {
        const band = MIST_BANDS[id];
        const done = clearedByRegion[id] ?? 0;
        if (done >= 1) return null;
        return (
          <div
            key={`mist-${id}`}
            className="mapfx-mist"
            aria-hidden="true"
            style={{
              top: `${band.top}%`,
              height: `${band.height}%`,
              // Fully opaque before you start, gone by the time you finish.
              opacity: 0.88 - done * 0.88,
            }}
          />
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
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
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

/* The reveal. Sits outside the world layer so it is never scaled or panned. */
function DiscoveryCard({ discovery, onClose }: { discovery: Discovery; onClose: () => void }) {
  const region =
    discovery.region === 'summit' ? null : REGIONS[discovery.region as SectionId];

  return (
    <div
      className="fixed inset-0 z-[115] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={discovery.name}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-leather-950/80 backdrop-blur-sm"
        aria-label="Close"
      />
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
          <button
            type="button"
            onClick={onClose}
            className="btn btn-quill"
            autoFocus
          >
            Back to the map
          </button>
        </div>
      </m.div>
    </div>
  );
}
