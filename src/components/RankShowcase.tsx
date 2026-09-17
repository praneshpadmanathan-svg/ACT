import { useState } from 'react';
import { RANKS } from '@/lib/progress';
import { RankSigil } from './RankSigil';

export function RankShowcase() {
  const [selected, setSelected] = useState(0);
  const [replay, setReplay] = useState(0);
  const rank = RANKS[selected]!;
  return (
    <section className="rank-showcase" aria-label="Explore the ranks">
      <div className="rank-showcase-copy">
        <p className="eyebrow">Your next chapter</p>
        <h2 className="font-display text-display-m font-bold">Progress you can see.</h2>
        <p className="font-read text-body-read text-parchment-dim">
          Seven ranks. Each one earned. Explore the emblems, then make the climb your own.
        </p>
        <div className="rank-picker" role="group" aria-label="Choose a rank preview">
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
      <div className="rank-display">
        <div
          key={`${rank.id}-${replay}`}
          className={`rank-reveal rank-reveal-${selected}`}
          aria-hidden="true"
        >
          <span className="rank-orbit" />
          <span className="rank-orbit rank-orbit-outer" />
          <RankSigil rank={rank} size={150} aura={false} />
        </div>
        <h3 className="font-display text-display-m font-bold">{rank.name}</h3>
        <p className="text-sm text-parchment-dim">{rank.xp.toLocaleString()} XP · rank preview</p>
        <button className="rank-replay" type="button" onClick={() => setReplay((n) => n + 1)}>
          Replay reveal
        </button>
      </div>
    </section>
  );
}
