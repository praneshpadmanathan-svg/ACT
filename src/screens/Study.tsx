/* The Study tab — one subject's road, as a list.

   This was `PathScreen`, the text alternative to hunting for pins on the
   painted map. When the map went it was already the better screen: the same
   landmarks in the same order with the same lock and cleared sigils, legible
   at a glance, and reachable by keyboard. It only needed the things the map
   used to carry — the subject switcher, the guardian, the start-of-game road
   choice and the guide — handed to it.

   The in-world region name stays the heading. The realm did not stop existing
   when its illustration did, and "The Grammar Village" is still what the story
   chain, the guardians and the Codex all call this place. */

import { PATH_BY_ID, SECTION_BY_ID } from '@/content';
import { REGIONS } from '@/content/regionFlavor';
import { useStore } from '@/lib/store';
import { hrefFor, useNavigate } from '@/lib/router';
import { useZoneProgress } from '@/lib/zoneProgress';
import { sfx } from '@/lib/sfx';
import { cx } from '@/lib/utils';
import type { SectionId } from '@/types';
import { Page } from '@/components/Shell';
import { Button, EmptyState, ProgressBar, SectionHeading, SectionTabs } from '@/components/ui';
import { Wizzy } from '@/game/Wizzy';
import { RoadChooser } from '@/game/RoadChooser';
import { PROLOGUE_ID } from '@/game/story';
import { BossCard } from '@/game/BossCard';
import { ClearedSigil, LockSigil } from '@/game/Sigils';
import { ProUpsell } from '@/components/ProGate';
import { sectionIsFree } from '@/lib/features';
import { m, riseItem, staggerList } from '@/lib/motion';

export function StudyScreen({ section }: { section?: string }) {
  const navigate = useNavigate();
  const { progress, isPro } = useStore();
  const { cleared: clearedOverall } = useZoneProgress();

  const sectionId = (section as SectionId) ?? 'english';
  const path = PATH_BY_ID[sectionId];
  const meta = SECTION_BY_ID[sectionId];
  const region = REGIONS[sectionId];

  /* Asked once, before any ground has been taken — but not until Wizzy has
     explained what the Grey is and what breaking the four Seals does.

     Sitting the chooser above the story on z-index was not enough: both
     mounted at once, so a first-time player met a panel demanding they pick a
     road stacked behind a wizard mid-sentence about why any of it matters.
     Waiting on the prologue makes it a sequence — here is the world, here is
     what is eating it, now choose where you start. */
  const heardPrologue = (progress.storySeen ?? []).includes(PROLOGUE_ID);
  const chooseRoad = clearedOverall === 0 && !progress.startRegion && heardPrologue;

  if (!path || !meta || !region) {
    return (
      <Page>
        <EmptyState
          title="No such region"
          detail="That road is not one of the four. Head back and pick a subject."
          action={
            <Button variant="primary" onClick={() => navigate({ name: 'path' })}>
              Back to the roads
            </Button>
          }
        />
      </Page>
    );
  }

  /* The gate is here, on the route, and not on the subject pill.
     `#/path/math` is a URL: it is in browser history, it is what the Camp
     suggestion card links to, and it is what a bookmark holds. Hiding the pill
     would leave every one of those paths open, so the check has to live where
     the screen is decided rather than where the link is drawn.

     What survives the gate is deliberate — the heading, the region name, the
     pills. A person who lands here should be able to see which road this is,
     read why it costs money, and step back to English in one tap, rather than
     hitting a blank wall with no way out but the back button. */
  if (!isPro && !sectionIsFree(sectionId)) {
    return (
      <Page>
        <SectionHeading eyebrow={meta.name} title={region.title} detail={meta.blurb} />
        <SectionTabs active={sectionId} hrefFor={(id) => hrefFor({ name: 'path', section: id })} />
        <ProUpsell
          title={`${region.title} is a Pro road`}
          detail={`${meta.name} runs ${path.nodes.length} landmarks, its own drills and notes, and the guardian at the end. Pro opens this road and the other two, plus timed tests, spaced review and full progress.`}
        />
      </Page>
    );
  }

  const done = path.nodes.filter((n) => progress.zonesCleared[n.id] !== undefined).length;
  let unlockedSeen = false;

  return (
    <>
      <Page>
        <SectionHeading
          eyebrow={meta.name}
          title={region.title}
          detail={meta.blurb}
          right={
            <div className="flex flex-wrap gap-2">
              <a href={hrefFor({ name: 'codex' })} onClick={() => sfx.select()}>
                <Button>The Codex</Button>
              </a>
              <a href={hrefFor({ name: 'drills', section: meta.id })} onClick={() => sfx.select()}>
                <Button>Free training instead</Button>
              </a>
            </div>
          }
        />

        <SectionTabs active={sectionId} hrefFor={(id) => hrefFor({ name: 'path', section: id })} />

        <div className="mb-2 font-script text-[12px] uppercase tracking-[0.16em] text-ink-faint">
          {done} of {path.nodes.length} landmarks cleared
        </div>
        <div className="mb-7">
          <ProgressBar
            value={path.nodes.length ? done / path.nodes.length : 0}
            color={region.color}
          />
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
                  {/* The drawn sigils, same as the old map pins — this list
                      used to show a 🔒 emoji, which rendered differently on
                      every platform and did not match anything else. The old
                      #8a7856 numeral also measured 3.89:1 on leather. */}
                  <span
                    className="num flex h-10 w-10 flex-none items-center justify-center rounded-full border-2 text-[15px]"
                    style={{
                      borderColor: cleared ? region.color : 'oklch(var(--c-leather-700))',
                      background: cleared ? region.color : 'transparent',
                      color: cleared ? 'oklch(var(--c-leather-950))' : 'oklch(var(--c-ink-faint))',
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

      {/* One Wizzy at a time: his standing tip bubble is also labelled "Wizzy
          the Guide", so during the prologue he was on screen twice at once — a
          card giving counsel, and over the top of it the same wizard
          introducing himself for the first time. */}
      {chooseRoad ? <RoadChooser /> : heardPrologue ? <Wizzy /> : null}
    </>
  );
}
