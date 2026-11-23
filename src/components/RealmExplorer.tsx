/* The four roads, one tab each: the region's painting, what that section of
   the ACT asks, and the first landmarks on its road.

   It used to carry a slogan per region — "Make every sentence count.", "Find
   your way through the problem." — lines that would fit any study app. The
   real material was a few imports away: every road's landmarks, and the skill
   each one teaches. The road line (`.road`) is the site's one signature
   detail; see DESIGN.md. */

import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { SECTIONS } from '@/content/sections';
import { PATH_BY_ID } from '@/content/zones';
import { REGIONS } from '@/content/regionFlavor';
import { Art } from './Art';
import { Button } from './ui';

/** How many landmarks the preview walks before saying how many are left. */
const SHOWN = 5;

/** "Commas — four jobs, no more" → "Commas". The skill, without the tagline. */
const skillOf = (sub: string) => sub.split(/\s+[—–-]\s+/)[0] ?? sub;

export function RealmExplorer({ onBegin }: { onBegin: () => void }) {
  const [active, setActive] = useState(0);
  const id = useId();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const section = SECTIONS[active]!;

  /* The WAI tabs pattern: arrows move between tabs and select as they go,
     Home and End jump to the ends. Only the selected tab is in the Tab order. */
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const last = SECTIONS.length - 1;
    const next =
      e.key === 'ArrowRight'
        ? (active + 1) % SECTIONS.length
        : e.key === 'ArrowLeft'
          ? (active + last) % SECTIONS.length
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? last
              : null;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  };
  const path = PATH_BY_ID[section.id];
  const nodes = path?.nodes ?? [];
  const rest = nodes.length - Math.min(SHOWN, nodes.length);

  return (
    <div className="realm-explorer">
      <div className="realm-selector" role="tablist" aria-label="Sections" onKeyDown={onKey}>
        {SECTIONS.map((s, i) => (
          <button
            key={s.id}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${i}`}
            aria-selected={i === active}
            aria-controls={`${id}-panel`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
          >
            <span className="realm-dot" style={{ background: s.color }} aria-hidden="true" />
            {s.name}
          </button>
        ))}
      </div>
      <div
        className="realm-scene"
        key={section.id}
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-tab-${active}`}
      >
        <div className="realm-art">
          <Art
            name={`region-${section.id}`}
            sizes="(max-width: 768px) 100vw, 700px"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="realm-copy">
          <div>
            <h3 className="heading text-[1.625rem] leading-tight">{REGIONS[section.id].title}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-parchment-dim">{section.blurb}</p>
          </div>
          <ol className="road" aria-label={`The first landmarks on the ${section.name} road`}>
            {nodes.slice(0, SHOWN).map((n) => (
              <li key={n.id}>
                <span className="road-name">{n.name}</span>
                <span className="road-skill">{skillOf(n.sub)}</span>
              </li>
            ))}
          </ol>
          {rest > 0 && (
            <p className="-mt-2 text-[13px] text-ink-faint">
              {rest} more after these, then the road’s guardian: a duel against the hardest
              questions in the section.
            </p>
          )}
          <Button onClick={onBegin}>Start practising</Button>
        </div>
      </div>
    </div>
  );
}
