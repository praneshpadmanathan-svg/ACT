/* Choose which road to set out on.

   Every region's first landmark has always been open — the unlock gate resets
   per region, so all four roads were walkable from the first minute. Nothing
   said so. The map picked a starting region out of the onboarding answer and
   stood the traveller on it, which reads as being told where to go.

   So this asks. It appears once, on the map, before anything is cleared, and
   the answer only decides where the traveller stands and which road the map
   opens on — the other three stay open, and you can walk any of them whenever
   you like. */

import { PATH_BY_ID, SECTION_BY_ID } from '@/content';
import { useStore } from '@/lib/store';
import { sfx } from '@/lib/sfx';
import { cx } from '@/lib/utils';
import type { SectionId } from '@/types';
import { REGIONS, REGION_ORDER } from './mapData';
import { m, popItem, SPRING_SNAP } from '@/lib/motion';

/* What each road actually asks of you, in the language of the map. */
const ROAD_NOTE: Record<SectionId, string> = {
  english: 'The rules are in plain sight here. Learn them once and the village becomes almost mechanical — the fastest ground to make on the whole map.',
  reading: 'Every answer is already written in the text. The woods only ask you to find the line that proves it.',
  math: 'Long and dry, but every dune has a shortcut if you know where to step. The most ground to cover, and the most to gain.',
  science: 'Read what is genuinely in front of you. Most travellers fail on the cliffs by bringing answers from home.',
};

export function RoadChooser() {
  const { progress, updateProgress } = useStore();

  const choose = (section: SectionId) => {
    sfx.achieve();
    updateProgress((p) => ({ ...p, startRegion: section }));
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto p-4"
      role="dialog"
      aria-label="Choose where to begin"
    >
      <div className="absolute inset-0 bg-leather-950/90 backdrop-blur-sm" />

      <div className="relative z-10 my-auto w-full max-w-4xl">
        <div className="text-center">
          <div className="eyebrow animate-storyTitle">✦ Four roads, one Summit</div>
          <h2
            className="heading mt-2.5 animate-storyTitle text-[clamp(1.5rem,4vw,2.4rem)] text-gold-light"
            style={{ animationDelay: '90ms' }}
          >
            Where will you set out?
          </h2>
          <p
            className="mx-auto mt-3 max-w-lg animate-storyTitle font-read text-[15px] leading-relaxed text-parchment-dim"
            style={{ animationDelay: '170ms' }}
          >
            All four roads are open from the first step — this only decides where your
            traveller starts. You can walk any of them whenever you like.
          </p>
        </div>

        {/* Springs and a stagger, so the four roads are dealt out like cards
            rather than all appearing at once. */}
        <m.div
          className="mt-8 grid gap-3 sm:grid-cols-2"
          variants={{ initial: {}, animate: { transition: { staggerChildren: 0.08, delayChildren: 0.28 } } }}
          initial="initial"
          animate="animate"
        >
          {REGION_ORDER.map((id) => {
            const region = REGIONS[id];
            const meta = SECTION_BY_ID[id];
            const first = PATH_BY_ID[id]?.nodes[0];
            const count = PATH_BY_ID[id]?.nodes.length ?? 0;
            const feared = progress.profile?.fear === id;

            return (
              <m.button
                key={id}
                type="button"
                onClick={() => choose(id)}
                variants={popItem}
                whileHover={{ y: -3, transition: SPRING_SNAP }}
                whileTap={{ scale: 0.985 }}
                className={cx('panel-lit p-5 text-left', 'hover:border-gold-deep')}
                style={{ borderTopColor: region.color, borderTopWidth: 3 }}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="heading text-[17px]" style={{ color: region.color }}>
                    {region.title}
                  </h3>
                  <span className="label-sm flex-none">
                    {count} landmark{count === 1 ? '' : 's'}
                  </span>
                </div>

                <p className="mt-2 font-read text-[14px] leading-relaxed text-parchment-dim">
                  {ROAD_NOTE[id]}
                </p>

                <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-leather-700/60 pt-3">
                  <span className="min-w-0">
                    <span className="label-sm block">Begins at</span>
                    <span className="mt-0.5 block truncate font-display text-[13.5px] font-semibold text-parchment">
                      {first?.name ?? meta.name}
                    </span>
                  </span>
                  <span className="flex-none font-display text-[13px] font-semibold text-gold">
                    Set out ▸
                  </span>
                </div>

                {/* The onboarding answer becomes a recommendation rather than a
                    decision made on the player's behalf. */}
                {feared && (
                  <p className="mt-2.5 font-script text-[11.5px] uppercase tracking-[0.14em] text-desert-text">
                    ✦ The one you said worried you most
                  </p>
                )}
              </m.button>
            );
          })}
        </m.div>
      </div>
    </div>
  );
}
