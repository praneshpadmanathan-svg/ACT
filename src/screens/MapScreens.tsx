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
import { AdventureMap } from '@/game/AdventureMap';
import { Wizzy } from '@/game/Wizzy';
import { REGIONS } from '@/game/mapData';

/* The map takes the whole viewport — no nav bar, no page heading, no chrome
   except the floating controls. It is the one screen that should feel like a
   game rather than an app. */
export function MapScreen() {
  const navigate = useNavigate();

  return (
    <>
      <AdventureMap onExit={() => navigate({ name: 'home' })} />
      <Wizzy />
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

      <ol className="space-y-2.5">
        {path.nodes.map((zone, index) => {
          const best = progress.zonesCleared[zone.id] ?? null;
          const cleared = best !== null;
          let locked = false;
          if (!cleared) {
            if (unlockedSeen) locked = true;
            else unlockedSeen = true;
          }

          return (
            <li key={zone.id}>
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
                <span
                  className="num flex h-10 w-10 flex-none items-center justify-center rounded-full border-2 text-[15px]"
                  style={{
                    borderColor: cleared ? region.color : '#4a3c2a',
                    background: cleared ? region.color : 'transparent',
                    color: cleared ? '#1c1610' : '#8a7856',
                  }}
                >
                  {cleared ? '✓' : locked ? '🔒' : index + 1}
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
            </li>
          );
        })}
      </ol>
    </Page>
  );
}
