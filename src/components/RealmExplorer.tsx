import { useState } from 'react';
import { SECTIONS } from '@/content/sections';
import { PATH_BY_ID } from '@/content/zones';
import { Art } from './Art';
import { Button } from './ui';

const STORIES = {
  english: [
    'The Grammar Village',
    'Make every sentence count.',
    'Find the rule. See the pattern. Leave with a skill you can use again.',
  ],
  math: [
    'The Number Desert',
    'Find your way through the problem.',
    'From a first equation to a clever shortcut, build confidence one idea at a time.',
  ],
  reading: [
    'The Enchanted Woods',
    'Follow the evidence.',
    'Slow down, look closer, and learn to find the line that proves your answer.',
  ],
  science: [
    'The Science Cliffs',
    'Turn observations into understanding.',
    'Explore experiments, compare explanations, and make sense of the data in front of you.',
  ],
};

export function RealmExplorer({ onBegin }: { onBegin: () => void }) {
  const [active, setActive] = useState(0);
  const section = SECTIONS[active]!;
  const story = STORIES[section.id];
  return (
    <div className="realm-explorer">
      <div className="realm-selector" role="group" aria-label="Explore a subject">
        {SECTIONS.map((s, i) => (
          <button key={s.id} type="button" aria-pressed={i === active} onClick={() => setActive(i)}>
            <span className="num">0{i + 1}</span>
            {s.name}
          </button>
        ))}
      </div>
      <div className="realm-scene" key={section.id}>
        <div className="realm-art">
          <Art
            name={`region-${section.id}`}
            sizes="(max-width: 768px) 100vw, 700px"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="realm-copy">
          <p className="eyebrow">{story[0]}</p>
          <h3 className="font-display text-display-m font-bold">{story[1]}</h3>
          <p className="font-read text-body-read text-parchment-dim">{story[2]}</p>
          <div className="realm-facts">
            <span>
              <b className="num">{PATH_BY_ID[section.id]?.nodes.length}</b> skill landmarks
            </span>
            <span>Learn · practise · progress</span>
          </div>
          <Button variant="primary" trailing onClick={onBegin}>
            Start your journey
          </Button>
        </div>
      </div>
    </div>
  );
}
