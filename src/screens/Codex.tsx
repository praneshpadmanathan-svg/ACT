/* The Codex — fourteen pieces of the realm, collected rather than cleared.

   These were glints hidden on the painted map, found by panning around it.
   That made them a reward for looking at the illustration, which stopped being
   a thing anyone did once the illustration went. Here they are a reward for
   taking ground instead: a region opens its entries as soon as you clear
   anything in it, and the summit's waits until all four roads are finished.

   Deliberately still a *reveal* and not a list. An entry you have not opened
   shows its shape and nothing else; tapping it pays the XP once and prints the
   lore. A collection you can read end to end before earning any of it is just
   a page of text. */

import { useState } from 'react';
import { REGIONS, REGION_ORDER } from '@/content/regionFlavor';
import { useStore } from '@/lib/store';
import { useZoneProgress } from '@/lib/zoneProgress';
import { sfx } from '@/lib/sfx';
import { cx } from '@/lib/utils';
import { m, riseItem, staggerList } from '@/lib/motion';
import { DISCOVERIES, isReachable, type Discovery } from '@/game/discoveries';
import { Page } from '@/components/Shell';
import { SectionHeading } from '@/components/ui';

const REGION_LABEL: Record<Discovery['region'], string> = {
  english: REGIONS.english.title,
  reading: REGIONS.reading.title,
  math: REGIONS.math.title,
  science: REGIONS.science.title,
  summit: 'The Summit',
};

/* A token reference rather than a hex, like every other region accent —
   painted inline on themed chrome, where a fixed hex read 1.39:1 in light. */
const SUMMIT_GOLD = 'oklch(var(--c-region-summit))';

export function CodexScreen() {
  const { progress, updateProgress } = useStore();
  const { clearedByRegion } = useZoneProgress();
  /* Which entry just opened, so only the newest one plays its reveal. */
  const [justFound, setJustFound] = useState<string | null>(null);

  const found = new Set(progress.discovered ?? []);
  const groups: Discovery['region'][] = [...REGION_ORDER, 'summit'];

  const reveal = (d: Discovery) => {
    if (found.has(d.id)) return;
    sfx.achieve();
    setJustFound(d.id);
    updateProgress((p) => ({
      ...p,
      discovered: p.discovered.includes(d.id) ? p.discovered : [...p.discovered, d.id],
      xp: p.xp + d.xp,
    }));
  };

  const total = DISCOVERIES.length;
  const open = DISCOVERIES.filter((d) => isReachable(d, clearedByRegion)).length;

  return (
    <Page>
      <SectionHeading
        eyebrow={`${found.size} of ${total} recorded · ${open - found.size} waiting`}
        title="The Codex"
        detail="The realm, in the pieces you have earned. Clear anything in a region and its entries unseal — the summit keeps its own until all four roads are finished."
      />

      <m.div className="space-y-7" variants={staggerList} initial="initial" animate="animate">
        {groups.map((region) => {
          const items = DISCOVERIES.filter((d) => d.region === region);
          if (!items.length) return null;
          const colour = region === 'summit' ? SUMMIT_GOLD : REGIONS[region].color;
          const gotHere = items.filter((d) => found.has(d.id)).length;

          return (
            <section key={region}>
              <div className="mb-2.5 flex items-baseline justify-between gap-4">
                <h2 className="font-display text-[15px] font-semibold" style={{ color: colour }}>
                  {REGION_LABEL[region]}
                </h2>
                <span className="num flex-none text-[12px] text-ink-faint">
                  {gotHere} / {items.length}
                </span>
              </div>

              <ul className="space-y-2.5">
                {items.map((d) => {
                  const got = found.has(d.id);
                  const reachable = isReachable(d, clearedByRegion);

                  return (
                    <m.li key={d.id} variants={riseItem}>
                      <button
                        type="button"
                        disabled={got || !reachable}
                        onClick={() => reveal(d)}
                        className={cx(
                          'w-full rounded-lg border px-4 py-3.5 text-left transition-all',
                          got && 'border-leather-700 bg-leather-850/80',
                          !got &&
                            reachable &&
                            'animate-shimmer cursor-pointer border-gold-deep bg-leather-850 hover:-translate-y-0.5 hover:border-gold',
                          !got &&
                            !reachable &&
                            'cursor-not-allowed border-dashed border-leather-700/70 bg-leather-900/50',
                        )}
                        style={got ? { borderLeftColor: colour, borderLeftWidth: 3 } : undefined}
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <span
                            className={cx(
                              'font-display text-[14.5px] font-semibold',
                              got && 'text-gold-light',
                              !got && reachable && 'text-gold',
                              !got && !reachable && 'text-ink-faint',
                            )}
                          >
                            {got ? d.name : reachable ? 'Something waits here — look' : 'Sealed'}
                          </span>
                          <span className="num flex-none text-[12px] text-ink-faint">
                            {got ? `+${d.xp} XP` : reachable ? `${d.xp} XP` : '— — —'}
                          </span>
                        </div>

                        {got ? (
                          <p
                            className={cx(
                              'mt-1.5 font-read text-[13.5px] leading-relaxed text-parchment-dim',
                              justFound === d.id && 'animate-riseIn',
                            )}
                          >
                            {d.lore}
                          </p>
                        ) : (
                          <p className="mt-1.5 font-read text-[13.5px] leading-relaxed text-ink-faint">
                            {reachable
                              ? 'You have walked far enough into this region to find it.'
                              : region === 'summit'
                                ? 'Finish all four roads to reach the citadel.'
                                : `Clear a landmark in ${REGION_LABEL[region]} to unseal this.`}
                          </p>
                        )}
                      </button>
                    </m.li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </m.div>
    </Page>
  );
}
