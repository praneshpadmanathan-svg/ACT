/* The guardian card.

   Lived inside the region list screen while that was the only place a duel
   could be started from. The Duels tab shows all four of them, so it moved
   here — one card, two callers, no chance of the sealed-state wording drifting
   between the place you meet a guardian and the place you go looking for one. */

import { PATH_BY_ID } from '@/content';
import { useStore } from '@/lib/store';
import { useNavigate } from '@/lib/router';
import { sfx } from '@/lib/sfx';
import { cx } from '@/lib/utils';
import type { SectionId } from '@/types';
import { bossFor } from '@/game/bosses';
import { BossArt } from '@/game/BossArt';
import { Glyph } from '@/components/Icon';

/** Landmarks cleared in a region, and how many there are. */
export function regionStanding(
  progress: { zonesCleared: Record<string, number> },
  section: SectionId,
) {
  const nodes = PATH_BY_ID[section]?.nodes ?? [];
  return {
    cleared: nodes.filter((n) => progress.zonesCleared[n.id] !== undefined).length,
    total: nodes.length,
  };
}

export function BossCard({
  section,
  cleared,
  total,
}: {
  section: SectionId;
  cleared: number;
  total: number;
}) {
  const navigate = useNavigate();
  const { progress } = useStore();
  const boss = bossFor(section);
  if (!boss) return null;

  const unlocked = cleared >= total && total > 0;
  const beaten = progress.achievements.includes(`boss-${boss.id}`);

  return (
    <button
      type="button"
      onClick={() => {
        sfx.select();
        navigate({ name: 'boss', section });
      }}
      className={cx(
        'panel-lit mb-5 flex w-full items-center gap-4 p-5 text-left transition-all sm:gap-6',
        unlocked ? 'hover:-translate-y-0.5 hover:border-gold-deep' : 'opacity-70',
      )}
      style={{ borderTopColor: boss.color, borderTopWidth: 3 }}
    >
      <div className={cx('w-[64px] flex-none sm:w-[86px]', !unlocked && 'opacity-55 grayscale')}>
        <BossArt section={section} state={beaten ? 'defeated' : 'idle'} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="eyebrow">{boss.title}</div>
        <h3
          className="heading mt-1 text-[clamp(1.05rem,2.2vw,1.35rem)]"
          style={{ color: boss.color }}
        >
          {boss.name}
        </h3>
        <p className="mt-1.5 font-read text-[14px] leading-relaxed text-parchment-dim">
          {beaten
            ? 'Defeated. Return whenever you want the practice.'
            : unlocked
              ? 'Every landmark is cleared. The guardian is awake and waiting.'
              : `Sealed until all ${total} landmarks are cleared — ${cleared} so far.`}
        </p>
      </div>

      <span className="flex flex-none items-center gap-1 font-display text-[13px] font-semibold text-gold">
        {unlocked ? (
          <>
            Fight
            <Glyph name="chevronRight" size={13} strokeWidth={2} />
          </>
        ) : (
          'Sealed'
        )}
      </span>
    </button>
  );
}
