/* The journal: a legend for the map's marks, and the list of what there is to
   find.

   Two gaps this closes. The map used five different kinds of mark — open
   landmark, cleared, sealed, guardian, discovery glint — and explained none of
   them. And the HUD counted "3 of 14 found" without ever saying what the other
   eleven were, which makes a collection you cannot see the shape of. */

import { useRef, useState } from 'react';

import { useStore } from '@/lib/store';
import { sfx } from '@/lib/sfx';
import { cx } from '@/lib/utils';
import { useDialogFocus } from '@/lib/useDialogFocus';
import { m, riseItem, staggerList } from '@/lib/motion';
import type { SectionId } from '@/types';
import { DISCOVERIES, type Discovery } from './discoveries';
import { REGIONS, REGION_ORDER } from './mapData';
import { ClearedSigil, LockSigil } from './Sigils';

const REGION_LABEL: Record<Discovery['region'], string> = {
  english: 'The Grammar Village',
  reading: 'The Enchanted Woods',
  math: 'The Number Desert',
  science: 'The Science Cliffs',
  summit: 'The Summit',
};

export function MapJournal({ onClose }: { onClose: () => void }) {
  const { progress } = useStore();
  const ref = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<'found' | 'legend'>('found');
  useDialogFocus(ref, true);

  const found = new Set(progress.discovered ?? []);

  return (
    <div
      ref={ref}
      className="fixed inset-0 z-[118] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      aria-label="Journal"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-leather-950/85 backdrop-blur-sm"
        aria-label="Close the journal"
      />

      <m.div
        className="panel-lit relative z-10 flex max-h-[86dvh] w-full max-w-2xl flex-col p-5 sm:p-6"
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="eyebrow">✦ The Journal</div>
            <h2 className="heading mt-1 text-[clamp(1.15rem,2.6vw,1.5rem)] text-parchment-light">
              {found.size} of {DISCOVERIES.length} discovered
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="hud-icon flex-none"
            aria-label="Close the journal"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          {(['found', 'legend'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                sfx.select();
                setTab(t);
              }}
              className={cx(
                'rounded-lg border px-3.5 py-1.5 font-display text-[13px] font-semibold transition-colors',
                tab === t
                  ? 'border-gold-deep bg-leather-800 text-gold'
                  : 'border-leather-700 bg-leather-850 text-parchment-dim hover:text-parchment',
              )}
            >
              {t === 'found' ? 'Discoveries' : 'Map legend'}
            </button>
          ))}
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
          {tab === 'found' ? (
            <m.ul
              className="space-y-2.5"
              variants={staggerList}
              initial="initial"
              animate="animate"
            >
              {REGION_ORDER.concat('summit' as SectionId).map((region) => {
                const items = DISCOVERIES.filter((d) => d.region === region);
                if (!items.length) return null;
                const colour =
                  region === ('summit' as SectionId) ? '#e8c34a' : REGIONS[region]?.color;
                return (
                  <li key={region}>
                    <div className="label-sm mb-1.5 mt-1" style={{ color: colour }}>
                      {REGION_LABEL[region as Discovery['region']]}
                    </div>
                    <ul className="space-y-1.5">
                      {items.map((d) => {
                        const got = found.has(d.id);
                        return (
                          <m.li
                            key={d.id}
                            variants={riseItem}
                            className={cx(
                              'rounded-lg border px-4 py-3',
                              got
                                ? 'border-leather-700 bg-leather-850/80'
                                : 'border-dashed border-leather-700/70 bg-leather-900/50',
                            )}
                          >
                            <div className="flex items-baseline justify-between gap-3">
                              <span
                                className={cx(
                                  'font-display text-[14px] font-semibold',
                                  got ? 'text-gold-light' : 'text-ink-faint',
                                )}
                              >
                                {got ? d.name : 'Not yet found'}
                              </span>
                              <span className="num flex-none text-[12px] text-ink-faint">
                                {got ? `+${d.xp} XP` : '— — —'}
                              </span>
                            </div>
                            {got && (
                              <p className="mt-1.5 font-read text-[13.5px] leading-relaxed text-parchment-dim">
                                {d.lore}
                              </p>
                            )}
                          </m.li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </m.ul>
          ) : (
            <ul className="space-y-2.5">
              <LegendRow
                mark={<span className="pin pin-current !static !translate-x-0 !translate-y-0" />}
                title="Open road"
                detail="The next landmark you can take on this road. Every region has one from the start — all four roads are open."
              />
              <LegendRow
                mark={
                  <span className="pin pin-done !static !translate-x-0 !translate-y-0">
                    <ClearedSigil size={17} />
                  </span>
                }
                title="Cleared"
                detail="Passed at 70% or better. Its best score shows when you hover it."
              />
              <LegendRow
                mark={
                  <span className="pin pin-locked !static !translate-x-0 !translate-y-0">
                    <LockSigil size={17} />
                  </span>
                }
                title="Sealed"
                detail="Clear the landmark before it on the same road to open this one."
              />
              <LegendRow
                mark={
                  <span className="guardian !static !h-9 !w-9 !translate-x-0 !translate-y-0 guardian-awake" />
                }
                title="Guardian"
                detail="One of the four Seals. Wakes when every landmark in its region is cleared. Losing to it costs nothing."
              />
              <LegendRow
                mark={
                  <span className="discovery discovery-hidden !static !translate-x-0 !translate-y-0">
                    <span className="discovery-mark" />
                  </span>
                }
                title="Something to find"
                detail="A glint on the map. No quiz and no gate — just somewhere worth going, and a little XP the first time."
              />
              <LegendRow
                mark={<span className="block h-7 w-7 rounded-md bg-[#dcd8c8] opacity-80" />}
                title="Mist"
                detail="Ground you have not walked. Thins as you clear a region's landmarks and lifts when it is done."
              />
              <li className="rounded-lg border border-leather-700 bg-leather-850/60 px-4 py-3">
                <div className="label-sm mb-1.5">Moving around</div>
                <p className="font-read text-[13.5px] leading-relaxed text-parchment-dim">
                  Drag to pan and scroll or pinch to zoom. By keyboard: arrow keys pan,
                  <b className="text-parchment"> + </b> and <b className="text-parchment">−</b>{' '}
                  zoom,
                  <b className="text-parchment"> 0 </b> recentres on your traveller, and Tab steps
                  between landmarks.
                </p>
              </li>
            </ul>
          )}
        </div>
      </m.div>
    </div>
  );
}

function LegendRow({
  mark,
  title,
  detail,
}: {
  mark: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <li className="flex items-start gap-4 rounded-lg border border-leather-700 bg-leather-850/60 px-4 py-3">
      <span className="flex h-11 w-11 flex-none items-center justify-center" aria-hidden="true">
        {mark}
      </span>
      <span className="min-w-0">
        <span className="block font-display text-[14px] font-semibold text-parchment">{title}</span>
        <span className="mt-0.5 block font-read text-[13.5px] leading-relaxed text-parchment-dim">
          {detail}
        </span>
      </span>
    </li>
  );
}
