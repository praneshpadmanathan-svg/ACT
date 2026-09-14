import type { CSSProperties } from 'react';
import { REGIONS, REGION_ORDER } from '@/game/mapData';
import { PATH_BY_ID } from '@/content/zones';
import { SECTION_BY_ID } from '@/content/sections';
import { useStore } from '@/lib/store';
import { useNavigate } from '@/lib/router';
import { sfx } from '@/lib/sfx';
import { Art } from './Art';

/** The same region identity at the front door and in camp. Real destinations,
 * actual progress, and no artificial locks on exploration. */
export function RegionPortals() {
  const { progress, hasStarted, continueAsGuest } = useStore();
  const navigate = useNavigate();
  return (
    <section className="region-portals" aria-label="Explore the four regions">
      {REGION_ORDER.map((id, index) => {
        const region = REGIONS[id];
        const path = PATH_BY_ID[id];
        const cleared = path.nodes.filter(
          (node) => progress.zonesCleared[node.id] !== undefined,
        ).length;
        const open = () => {
          sfx.select();
          if (!hasStarted) continueAsGuest();
          navigate(progress.profile ? { name: 'path', section: id } : { name: 'onboarding' });
        };
        return (
          <button
            type="button"
            key={id}
            onClick={open}
            className="region-portal"
            style={{ '--region-accent': region.color } as CSSProperties}
          >
            <Art
              name={`region-${id}`}
              className="region-portal-art"
              sizes="(min-width: 1024px) 300px, (min-width: 640px) 50vw, 100vw"
            />
            <span className="region-portal-shade" />
            <span className="region-portal-number" aria-hidden="true">
              0{index + 1}
            </span>
            <span className="region-portal-copy">
              <small>{SECTION_BY_ID[id].name}</small>
              <strong>{region.title.replace(/^The /, '')}</strong>
              <span>
                {cleared > 0
                  ? `${cleared} of ${path.nodes.length} landmarks restored`
                  : `${path.nodes.length} landmarks. A new horizon.`}
              </span>
              <span className="region-portal-link">
                {progress.profile ? 'Explore this region' : 'Begin your journey'}{' '}
                <span aria-hidden="true">↗</span>
              </span>
            </span>
          </button>
        );
      })}
    </section>
  );
}
