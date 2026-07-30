/* The adventure map screen, and a per-region list view for when you want to
   scan a road as text rather than hunt for pins. */

import { PATH_BY_ID, SECTION_BY_ID } from '@/content';
import { useStore } from '@/lib/store';
import { hrefFor, useNavigate } from '@/lib/router';
import { sfx } from '@/lib/sfx';
import { cx } from '@/lib/utils';
import type { SectionId } from '@/types';
import { BackLink, Page } from '@/components/Shell';
import { Button, EmptyState, ProgressBar, SectionHeading } from '@/components/ui';
import { AdventureMap, useMapProgress } from '@/game/AdventureMap';
import { Wizzy } from '@/game/Wizzy';
import { RoadChooser } from '@/game/RoadChooser';
import { REGIONS } from '@/game/mapData';
import { bossFor } from '@/game/bosses';
import { BossArt } from '@/game/BossArt';
import { ClearedSigil, LockSigil } from '@/game/Sigils';
import { m, riseItem, staggerList } from '@/lib/motion';

/* The map takes the whole viewport — no nav bar, no page heading, no chrome
   except the floating controls. It is the one screen that should feel like a
   game rather than an app. */
export function MapScreen() {
  const navigate = useNavigate();
  const { progress } = useStore();
  const { cleared } = useMapProgress();

  /* Asked once, before any ground has been taken. The story overlay sits above
     this at z-[120], so the prologue plays first and then reveals the choice. */
  const chooseRoad = cleared === 0 && !progress.startRegion;

  return (
    <>
      <AdventureMap onExit={() => navigate({ name: 'home' })} />
      {chooseRoad ? <RoadChooser /> : <Wizzy />}
    </>
  );
}

export function PathScreen({ section }: { section: string }) {
  const navigate = useNavigate();
  const { progress } = useStore();
  const sectionId = section as SectionId;
  const path = PATH_BY_ID[sectionId];
  const meta = SECTION_BY_ID[sectionId];
  const region = REGIONS[sectionId];

  if (!path || !meta || !region) {
    return (
      <Page>
        <EmptyState
          title="No such region"
          detail="That road is not on the map. Head back and pick one of the four regions."
          action={<Button variant="primary" onClick={() => navigate({ name: 'map' })}>Back to the map</Button>}
        />
      </Page>
    );
  }

  const done = path.nodes.filter((n) => progress.zonesCleared[n.id] !== undefined).length;
  let unlockedSeen = false;

  return (
    <Page>
      <BackLink to={{ name: 'map' }} label="Adventure map" />
      <SectionHeading
        eyebrow={`${done} of ${path.nodes.length} landmarks cleared`}
        title={region.title}
        detail={meta.blurb}
        right={
          <a href={hrefFor({ name: 'drills', section: meta.id })} onClick={() => sfx.select()}>
            <Button>Free training instead</Button>
          </a>
        }
      />

      <div className="mb-7">
        <ProgressBar value={path.nodes.length ? done / path.nodes.length : 0} color={region.color} />
      </div>

      {/* the guardian at the end of the road */}
      <BossCard section={sectionId} cleared={done} total={path.nodes.length} />

      {/* Staggered so the road assembles itself down the page rather than
          appearing all at once — the one place a list reads as a journey. */}
      <m.ol className="space-y-2.5" variants={staggerList} initial="initial" animate="animate">
        {path.nodes.map((zone, index) => {
          const best = progress.zonesCleared[zone.id] ?? null;
          const cleared = best !== null;
          let locked = false;
          if (!cleared) {
            if (unlockedSeen) locked = true;
            else unlockedSeen = true;
          }

          return (
            <m.li key={zone.id} variants={riseItem}>
              <button
                type="button"
                disabled={locked}
                onClick={() => {
                  sfx.select();
                  navigate({ name: 'zone', zone: zone.id });
                }}
                className={cx(
                  'panel flex w-full items-center gap-4 px-5 py-4 text-left transition-colors',
                  locked ? 'cursor-not-allowed opacity-55' : 'hover:border-gold-deep',
                )}
              >
                {/* The drawn sigils, same as the map pins — this list used to
                    show a 🔒 emoji, which rendered differently on every
                    platform and did not match anything else. The old #8a7856
                    numeral also measured 3.89:1 on leather. */}
                <span
                  className="num flex h-10 w-10 flex-none items-center justify-center rounded-full border-2 text-[15px]"
                  style={{
                    borderColor: cleared ? region.color : '#4a3c2a',
                    background: cleared ? region.color : 'transparent',
                    color: cleared ? '#1c1610' : '#a3906c',
                  }}
                >
                  {cleared ? (
                    <ClearedSigil size={19} />
                  ) : locked ? (
                    <LockSigil size={18} />
                  ) : (
                    index + 1
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-[16px] font-semibold text-parchment">
                    {zone.name}
                  </span>
                  <span className="mt-0.5 block font-read text-[14px] text-ink-faint">
                    {locked ? 'Clear the landmark before this one' : zone.sub}
                  </span>
                </span>

                {best !== null && (
                  <span className="num flex-none text-[19px]" style={{ color: region.color }}>
                    {best}%
                  </span>
                )}
              </button>
            </m.li>
          );
        })}
      </m.ol>
    </Page>
  );
}

/* The guardian sits at the head of the region list — visible from the start
   so you know what the road leads to, but sealed until it is earned. */
function BossCard({ section, cleared, total }: { section: SectionId; cleared: number; total: number }) {
  const navigate = useNavigate();
  const { progress } = useStore();
  const boss = bossFor(section);
  if (!boss) return null;

  const unlocked = cleared >= total;
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
      <div className={cx('w-[64px] flex-none sm:w-[86px]', !unlocked && 'grayscale opacity-55')}>
        <BossArt section={section} state={beaten ? 'defeated' : 'idle'} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="eyebrow">{boss.title}</div>
        <h3 className="heading mt-1 text-[clamp(1.05rem,2.2vw,1.35rem)]" style={{ color: boss.color }}>
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

      <span className="flex-none font-display text-[13px] font-semibold text-gold">
        {unlocked ? 'Fight ▸' : 'Sealed'}
      </span>
    </button>
  );
}
