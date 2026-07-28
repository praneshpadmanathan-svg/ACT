/* The two map screens: the world overview, and a single subject's trail. */

import { PATH_BY_ID, SECTION_BY_ID, SECTIONS } from '@/content';
import { useStore } from '@/lib/store';
import { hrefFor } from '@/lib/router';
import { sfx } from '@/lib/sfx';
import type { SectionId } from '@/types';
import { BackLink, Page } from '@/components/Shell';
import { SectionHeading, EmptyState, Button } from '@/components/ui';
import { WorldMap } from '@/game/WorldMap';
import { TrailMap } from '@/game/TrailMap';

export function MapScreen() {
  const { progress } = useStore();

  return (
    <Page wide>
      <SectionHeading
        eyebrow="The climb"
        title="World map"
        detail="Four paths up the mountain. Clear the zones on each to open the boss test at its summit."
      />

      <WorldMap />

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SECTIONS.map((section) => {
          const path = PATH_BY_ID[section.id];
          const done = path.nodes.filter((n) => progress.zonesCleared[n.id] !== undefined).length;
          return (
            <a
              key={section.id}
              href={hrefFor({ name: 'path', section: section.id })}
              onClick={() => sfx.select()}
              className="rounded-lg border-2 border-edge bg-ink-850 p-5 shadow-pixel transition-all hover:-translate-y-0.5 hover:border-edge-bright"
              style={{ borderTopColor: section.color, borderTopWidth: 4 }}
            >
              <h3 className="heading-pixel text-[12px]" style={{ color: section.color }}>
                {section.name}
              </h3>
              <p className="mt-2.5 text-[13px] leading-relaxed text-[#a89ac6]">{section.blurb}</p>
              <p className="mt-3 font-screen text-[10px] uppercase tracking-wide text-[#7a6a9e]">
                {done}/{path.nodes.length} zones cleared
              </p>
            </a>
          );
        })}
      </div>
    </Page>
  );
}

export function PathScreen({ section }: { section: string }) {
  const path = PATH_BY_ID[section as SectionId];
  const meta = SECTION_BY_ID[section as SectionId];
  const { progress } = useStore();

  if (!path || !meta) {
    return (
      <Page>
        <EmptyState
          title="Path not found"
          detail="That section does not exist. Head back to the map and pick one of the four paths."
          action={
            <a href={hrefFor({ name: 'map' })}>
              <Button variant="primary">Back to map</Button>
            </a>
          }
        />
      </Page>
    );
  }

  const done = path.nodes.filter((n) => progress.zonesCleared[n.id] !== undefined).length;

  return (
    <Page>
      <BackLink to={{ name: 'map' }} label="World map" />
      <SectionHeading
        eyebrow={`${done} of ${path.nodes.length} zones cleared`}
        title={`${meta.name} path`}
        detail={meta.blurb}
        right={
          <a href={hrefFor({ name: 'drills', section: meta.id })} onClick={() => sfx.select()}>
            <Button variant="ghost">Free drill instead</Button>
          </a>
        }
      />

      <TrailMap path={path} />
    </Page>
  );
}
