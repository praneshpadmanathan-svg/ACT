/* The seven ranks, browsable from the front door.

   It used to open on "Your next chapter / Progress you can see. / Seven ranks.
   Each one earned." and show the emblem inside two orbiting rings with a
   replay button. The emblems are the interesting part, so they stay; the
   copy now says what a rank is and what it takes, and the rings are gone. */

import { useState } from 'react';
import { RANKS } from '@/lib/progress';
import { RankSigil } from './RankSigil';

export function RankShowcase() {
  const [selected, setSelected] = useState(0);
  const rank = RANKS[selected]!;
  const first = RANKS[0]!;
  const last = RANKS[RANKS.length - 1]!;
  const article = /^[aeiou]/i.test(first.name) ? 'an' : 'a';
  return (
    <section className="rank-showcase" aria-label="The seven ranks">
      <div className="rank-showcase-copy">
        <h2 className="heading text-[clamp(1.5rem,3vw,2rem)] leading-tight">
          Seven ranks, earned by answering
        </h2>
        <p className="max-w-[46ch] text-[15px] leading-relaxed text-parchment-dim">
          Every answer earns XP. You start as {article} {first.name}, and the last rank, {last.name}
          , takes {last.xp.toLocaleString()} XP. Pick an emblem to see it.
        </p>
        <div className="rank-picker" role="group" aria-label="Choose a rank to preview">
          {RANKS.map((r, i) => (
            <button
              key={r.id}
              type="button"
              aria-pressed={i === selected}
              aria-label={r.name}
              title={r.name}
              onClick={() => setSelected(i)}
            >
              <RankSigil rank={r} size={42} aura={false} />
            </button>
          ))}
        </div>
      </div>
      <div className="rank-display" aria-live="polite">
        <div key={rank.id} className="rank-reveal" aria-hidden="true">
          <RankSigil rank={rank} size={150} aura={false} />
        </div>
        <h3 className="heading text-[1.75rem] leading-tight">{rank.name}</h3>
        <p className="text-[14px] text-parchment-dim">
          {rank.xp === 0 ? 'Where everyone starts' : `From ${rank.xp.toLocaleString()} XP`}
        </p>
      </div>
    </section>
  );
}
