import type { CSSProperties } from 'react';
import type { Rank } from '@/lib/progress';
import { RankSigil } from './RankSigil';

/** A player's title is identity, not a statistic. */
export function RankIdentity({ rank, compact = false }: { rank: Rank; compact?: boolean }) {
  return (
    <span
      className={`rank-identity ${compact ? 'rank-identity-compact' : ''}`}
      style={{ '--rank-accent': rank.color } as CSSProperties}
    >
      <span className="rank-identity-emblem" aria-hidden="true">
        <RankSigil rank={rank} size={compact ? 42 : 88} aura={false} />
      </span>
      <span className="rank-identity-copy">
        <span className="rank-identity-label">Your rank</span>
        <strong className="rank-title">{rank.name}</strong>
        {!compact && <span className="rank-identity-motto">{rank.tagline}</span>}
      </span>
    </span>
  );
}
