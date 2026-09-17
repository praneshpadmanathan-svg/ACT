/* The Duels tab — the four guardians, and how close each one is to waking.

   Guardians used to be markers on the map, which meant the only way to see
   whether one was ready was to go and look at the world. That was fine while
   the world was a screen you visited; with the map gone they needed a rail of
   their own, and having all four on one page turns out to be better than the
   map ever was at the question you actually ask — which of these can I fight
   right now, and how far off are the rest?

   No new rules: the unlock is still "every landmark in that region cleared",
   read straight off saved progress by the same card the Study tab uses. */

import { SECTIONS } from '@/content/sections';
import { useStore } from '@/lib/store';
import { Page } from '@/components/Shell';
import { SectionHeading } from '@/components/ui';
import { BossCard, regionStanding } from '@/game/BossCard';

/* Whole-feature gate. A duel is not divisible by subject the way a road is —
   the point of it is the set of four and the Seals they hold, and handing out
   one guardian would sell the ending of a story whose middle is locked. */
export function DuelsScreen() {
  return <DuelsBoard />;
}

function DuelsBoard() {
  const { progress } = useStore();

  const standings = SECTIONS.map((s) => ({ section: s, ...regionStanding(progress, s.id) }));
  const ready = standings.filter((s) => s.total > 0 && s.cleared >= s.total).length;
  const broken = progress.achievements.filter((a) => a.startsWith('boss-')).length;

  return (
    <Page>
      <SectionHeading
        eyebrow={
          broken === 4
            ? 'All four Seals broken'
            : `${broken} of 4 Seals broken · ${ready} guardian${ready === 1 ? '' : 's'} awake`
        }
        title="The Four Guardians"
        detail="One stands at the end of every road, and each holds a Seal. Clear every landmark in a region to wake its guardian, then beat it in a duel to break the Seal."
      />

      {standings.map(({ section, cleared, total }) => (
        <BossCard key={section.id} section={section.id} cleared={cleared} total={total} />
      ))}
    </Page>
  );
}
