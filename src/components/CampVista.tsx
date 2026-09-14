import { useStore } from '@/lib/store';
import { useNavigate } from '@/lib/router';
import { sfx } from '@/lib/sfx';
import { rankProgress } from '@/lib/progress';
import { HeroSprite } from '@/game/HeroSprite';
import { RealmScene } from './RealmScene';
import { RankIdentity } from './RankIdentity';

export function CampVista({
  cleared,
  total,
  destination,
}: {
  cleared: number;
  total: number;
  destination: string;
}) {
  const { progress, playerName, rank } = useStore();
  const navigate = useNavigate();
  const { pct, next } = rankProgress(progress.xp);
  return (
    <RealmScene art="camp-bg" className="camp-vista">
      <div className="camp-vista-copy">
        <div className="realm-kicker">
          <span /> Your own corner of the world
        </div>
        <h1>
          Welcome to camp<span>, {playerName}.</span>
        </h1>
        <p>
          The lantern is lit. The road is waiting.
          <br />
          Let’s see where a little curiosity takes you.
        </p>
        <button
          type="button"
          className="realm-button"
          onClick={() => {
            sfx.select();
            navigate({ name: 'map' });
          }}
        >
          Return to the adventure <span aria-hidden="true">↗</span>
        </button>
        <div className="camp-next">
          <small>NEXT ON YOUR JOURNEY</small>
          <strong>{destination}</strong>
        </div>
      </div>
      <div className="camp-traveller" aria-hidden="true">
        <div className="camp-traveller-halo" />
        <HeroSprite hero={progress.hero} height={180} />
      </div>
      <div className="camp-expedition-bar">
        <RankIdentity rank={rank} />
        <div className="camp-rank-meter">
          <div>
            <small>Rank progress</small>
            <span>{progress.xp.toLocaleString()} XP</span>
          </div>
          <div
            role="progressbar"
            aria-label="Rank progress"
            aria-valuenow={Math.round(pct * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <i style={{ width: `${pct * 100}%` }} />
          </div>
          <small>
            {next
              ? `${(next.xp - progress.xp).toLocaleString()} XP to ${next.name}`
              : 'Your highest rank. A world still to explore.'}
          </small>
          <span className="camp-landmarks">
            {cleared} of {total} landmarks restored
          </span>
        </div>
      </div>
    </RealmScene>
  );
}
