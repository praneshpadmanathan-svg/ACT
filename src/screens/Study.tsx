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
import { m, riseItem, staggerList } from '@/lib/motion';

export function StudyScreen({ section }: { section?: string }) {
  const navigate = useNavigate();
  const { progress } = useStore();
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

        {/* A route, not a list of cards.

            The landmarks were never rows in a table — they were places on a
            road, and that was the one thing the painted map carried that the
            flat list dropped. A gilt thread down the disc column gives it back
            for two pixels of width: bright behind the ground you have taken,
            stopping at the disc you are standing on, dim ahead of you. The
            data, the order, the locks and the destination are all unchanged.

            Staggered so the road assembles itself down the page rather than
            appearing all at once. */}
        <m.ol className="route" variants={staggerList} initial="initial" animate="animate">
          {path.nodes.map((zone, index) => {
            const best = progress.zonesCleared[zone.id] ?? null;
            const cleared = best !== null;
            let locked = false;
            if (!cleared) {
              if (unlockedSeen) locked = true;
              else unlockedSeen = true;
            }
            /* One string drives the thread's gradient, the disc's treatment and
               the row's elevation, so the three can never disagree about which
               landmark you are standing on. */
            const state = cleared ? 'cleared' : locked ? 'locked' : 'current';

            return (
              <m.li key={zone.id} className="route-step" data-state={state} variants={riseItem}>
                {/* The disc sits in the gutter, on the thread, outside the card:
                    a place on the road rather than a badge on a row. It takes no
                    clicks — the card beside it already goes there, and a second
                    hit area for one destination is only a way to miss. Hidden
                    from the reading order for the same reason it is redundant to
                    the eye: an <ol> already numbers itself, `disabled` already
                    says locked, and the score already says cleared.

                    The drawn sigils are the old map pins. This list once showed
                    a 🔒 emoji, which rendered differently on every platform and
                    matched nothing else on the screen. */}
                <span
                  aria-hidden="true"
                  className={cx(
                    'route-node pointer-events-none',
                    cleared
                      ? 'route-node-cleared'
                      : locked
                        ? 'route-node-locked'
                        : 'route-node-current',
                  )}
                  style={
                    cleared
                      ? { background: region.color, color: 'oklch(var(--c-leather-950))' }
                      : undefined
                  }
                >
                  {cleared ? (
                    <ClearedSigil size={19} />
                  ) : locked ? (
                    <LockSigil size={18} />
                  ) : (
                    <span className="num text-[15px]">{index + 1}</span>
                  )}
                </span>

                <button
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    sfx.select();
                    navigate({ name: 'zone', zone: zone.id });
                  }}
                  className={cx('route-card', cleared || locked ? 'panel-quiet' : 'panel')}
                >
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
