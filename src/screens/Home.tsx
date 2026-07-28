/* Base camp — the dashboard.

   Answers three questions above the fold: where am I, what should I do next,
   and how close am I to the target. Everything else is one click away. */

import { useMemo } from 'react';
import { LIBRARY_STATS, PATH_BY_ID, SECTIONS } from '@/content';
import { hrefFor, useNavigate } from '@/lib/router';
import { useStore } from '@/lib/store';
import {
  dueForReview,
  estimatedComposite,
  rankProgress,
  sectionAccuracy,
  weakestTopics,
} from '@/lib/progress';
import { sfx } from '@/lib/sfx';
import { cx, titleCase } from '@/lib/utils';
import type { SectionId } from '@/types';
import { Page } from '@/components/Shell';
import { PixelIcon, type IconName } from '@/components/PixelIcon';
import { Button, ProgressBar, RankBadge } from '@/components/ui';
import { HeroSprite } from '@/game/heroes';

export function Home() {
  const { progress, rank, playerName, isGuest } = useStore();
  const navigate = useNavigate();

  const { pct, next } = rankProgress(progress.xp);
  const estimate = estimatedComposite(progress);
  const reviewDue = dueForReview(progress).length;
  const weak = weakestTopics(progress, 4);

  /* "Do this next" — the single most useful action right now. Order matters:
     an overdue review beats new material, and a brand-new player needs the
     first zone of the section they said scared them. */
  const nextAction = useMemo(() => {
    if (reviewDue >= 5) {
      return {
        label: 'Clear your review queue',
        detail: `${reviewDue} question${reviewDue === 1 ? '' : 's'} are due. These are the ones you missed before.`,
        cta: 'Start review',
        icon: 'refresh' as IconName,
        color: '#3ad6f0',
        go: () => navigate({ name: 'review' }),
      };
    }

    const fear = progress.profile?.fear ?? 'english';
    const path = PATH_BY_ID[fear];
    const nextZone = path?.nodes.find((n) => progress.zonesCleared[n.id] === undefined);
    if (nextZone) {
      return {
        label: nextZone.name,
        detail: `${nextZone.sub} — a short lesson, then a quiz to clear the zone.`,
        cta: 'Enter zone',
        icon: 'map' as IconName,
        color: path.color,
        go: () => navigate({ name: 'zone', zone: nextZone.id }),
      };
    }

    if (progress.testHistory.length === 0) {
      return {
        label: 'Take a full-length test',
        detail: 'You have cleared the zones. Time to find out where you actually stand.',
        cta: 'Open tests',
        icon: 'clock' as IconName,
        color: '#ff5d78',
        go: () => navigate({ name: 'tests' }),
      };
    }

    const worst = weak[0];
    return {
      label: worst ? `Drill ${titleCase(worst.topic)}` : 'Keep drilling',
      detail: worst
        ? `Your weakest topic at ${Math.round(worst.accuracy * 100)}% across ${worst.attempts} questions.`
        : 'Mixed drills across every section.',
      cta: 'Start drilling',
      icon: 'sword' as IconName,
      color: '#ff9d5c',
      go: () =>
        navigate(
          worst && worst.section !== 'zone'
            ? { name: 'drill', section: worst.section, topic: worst.topic }
            : { name: 'drills' },
        ),
    };
  }, [progress, reviewDue, weak, navigate]);

  const zonesDone = Object.keys(progress.zonesCleared).length;

  return (
    <Page>
      {/* ------------------------------------------------------------ hero */}
      <div className="mb-6 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div className="pixel-panel flex flex-col justify-between gap-6 p-6 sm:p-7">
          <div className="flex items-start gap-4">
            <HeroSprite hero={progress.hero} unit={5} />
            <div className="min-w-0">
              <div className="font-screen text-[11px] uppercase tracking-[0.16em] text-[#8f86b5]">
                {isGuest ? 'Playing as guest' : 'Welcome back'}
              </div>
              <h1 className="heading-pixel mt-1.5 truncate text-[clamp(14px,2.4vw,20px)] text-white">
                {playerName}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="chip" style={{ color: rank.color, borderColor: `${rank.color}55` }}>
                  {rank.name}
                </span>
                {progress.dayStreak > 0 && (
                  <span className="chip text-ember" style={{ borderColor: '#ff9d5c55' }}>
                    🔥 {progress.dayStreak} day streak
                  </span>
                )}
              </div>
            </div>
            <div className="ml-auto hidden flex-none sm:block">
              <RankBadge rank={rank} size={62} />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <span className="num text-[26px] text-gold">{progress.xp.toLocaleString()} XP</span>
              {next && (
                <span className="font-screen text-[10px] uppercase tracking-wide text-[#8f86b5]">
                  {(next.xp - progress.xp).toLocaleString()} to {next.name}
                </span>
              )}
            </div>
            <ProgressBar value={pct} color={rank.color} label="Rank progress" />
          </div>
        </div>

        {/* do this next */}
        <div
          className="pixel-panel flex flex-col justify-between p-6 sm:p-7"
          style={{ borderTopColor: nextAction.color, borderTopWidth: 4 }}
        >
          <div>
            <div className="mb-4 flex items-center gap-2.5">
              <PixelIcon name={nextAction.icon} unit={3} />
              <span className="font-screen text-[11px] uppercase tracking-[0.16em] text-[#8f86b5]">
                Do this next
              </span>
            </div>
            <h2 className="heading-pixel text-[13px] leading-[1.6]" style={{ color: nextAction.color }}>
              {nextAction.label}
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-[#a89ac6]">{nextAction.detail}</p>
          </div>
          <Button variant="primary" className="mt-6 w-full" onClick={nextAction.go}>
            {nextAction.cta} ▶
          </Button>
        </div>
      </div>

      {/* ----------------------------------------------------------- stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Estimated composite"
          value={estimate !== null ? String(estimate) : '—'}
          detail={estimate !== null ? `Target ${progress.targetScore}` : 'Answer more to unlock'}
          color="#ffd23e"
        />
        <StatTile
          label="Questions answered"
          value={progress.attempts.length.toLocaleString()}
          detail={`of ${LIBRARY_STATS.totalQuestions.toLocaleString()}`}
          color="#ff9d5c"
        />
        <StatTile
          label="Zones cleared"
          value={`${zonesDone}`}
          detail={`of ${LIBRARY_STATS.zones}`}
          color="#3ad6f0"
        />
        <StatTile
          label="Best streak"
          value={String(progress.bestCorrectStreak)}
          detail="correct in a row"
          color="#b79cff"
        />
      </div>

      {/* --------------------------------------------------------- sections */}
      <h2 className="heading-pixel mb-4 text-[13px] text-white">Your paths</h2>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SECTIONS.map((section) => (
          <PathCard key={section.id} sectionId={section.id} />
        ))}
      </div>

      {/* --------------------------------------------------------- weak spots */}
      {weak.length > 0 && (
        <>
          <h2 className="heading-pixel mb-4 text-[13px] text-white">Worth fixing</h2>
          <div className="mb-6 grid gap-2.5 sm:grid-cols-2">
            {weak.map((t) => (
              <button
                key={`${t.section}-${t.topic}`}
                type="button"
                onClick={() => {
                  sfx.select();
                  if (t.section !== 'zone') navigate({ name: 'drill', section: t.section, topic: t.topic });
                }}
                className="flex items-center gap-4 rounded-lg border-2 border-edge bg-ink-850 px-4 py-3.5 text-left transition-colors hover:border-edge-bright"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-screen text-[12px] uppercase tracking-wide text-white">
                    {titleCase(t.topic)}
                  </div>
                  <div className="mt-1 text-[13px] text-[#8f86b5]">
                    {t.correct}/{t.attempts} correct · {t.avgSeconds.toFixed(0)}s avg
                  </div>
                </div>
                <div
                  className="num text-[22px]"
                  style={{ color: t.accuracy < 0.5 ? '#ff8298' : t.accuracy < 0.7 ? '#ffd23e' : '#5ee6a8' }}
                >
                  {Math.round(t.accuracy * 100)}%
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ----------------------------------------------------------- quick */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickAction icon="map" label="World map" detail="See the whole climb" to={{ name: 'map' }} />
        <QuickAction icon="book" label="Notes" detail={`${LIBRARY_STATS.notePages} pages`} to={{ name: 'notes' }} />
        <QuickAction
          icon="refresh"
          label="Review"
          detail={reviewDue ? `${reviewDue} due now` : 'Nothing due'}
          to={{ name: 'review' }}
          highlight={reviewDue > 0}
        />
        <QuickAction icon="clock" label="Practice tests" detail="Full length, timed" to={{ name: 'tests' }} />
      </div>
    </Page>
  );
}

function StatTile({
  label,
  value,
  detail,
  color,
}: {
  label: string;
  value: string;
  detail: string;
  color: string;
}) {
  return (
    <div className="rounded-lg border-2 border-edge bg-ink-850 px-4 py-4 shadow-pixel">
      <div className="font-screen text-[10px] uppercase leading-tight tracking-[0.12em] text-[#8f86b5]">
        {label}
      </div>
      <div className="num mt-2 text-[30px] leading-none" style={{ color }}>
        {value}
      </div>
      <div className="mt-1.5 text-[12px] text-[#6f6496]">{detail}</div>
    </div>
  );
}

function PathCard({ sectionId }: { sectionId: SectionId }) {
  const { progress } = useStore();
  const path = PATH_BY_ID[sectionId];
  const section = SECTIONS.find((s) => s.id === sectionId)!;
  const done = path.nodes.filter((n) => progress.zonesCleared[n.id] !== undefined).length;
  const { n, pct: accuracy } = sectionAccuracy(progress, sectionId);

  return (
    <a
      href={hrefFor({ name: 'path', section: sectionId })}
      onClick={() => sfx.select()}
      className="block rounded-lg border-2 border-edge bg-ink-850 p-5 shadow-pixel transition-all hover:-translate-y-0.5 hover:border-edge-bright"
      style={{ borderTopColor: section.color, borderTopWidth: 4 }}
    >
      <h3 className="heading-pixel text-[12px]" style={{ color: section.color }}>
        {section.name}
      </h3>
      <div className="mt-3">
        <ProgressBar value={path.nodes.length ? done / path.nodes.length : 0} color={section.color} height={8} />
      </div>
      <div className="mt-2.5 flex items-baseline justify-between font-screen text-[10px] uppercase tracking-wide text-[#8f86b5]">
        <span>{done}/{path.nodes.length} zones</span>
        <span className="num text-[15px]" style={{ color: n >= 5 ? section.color : '#5f5680' }}>
          {n >= 5 ? `${Math.round(accuracy * 100)}%` : '—'}
        </span>
      </div>
    </a>
  );
}

function QuickAction({
  icon,
  label,
  detail,
  to,
  highlight,
}: {
  icon: IconName;
  label: string;
  detail: string;
  to: Parameters<typeof hrefFor>[0];
  highlight?: boolean;
}) {
  return (
    <a
      href={hrefFor(to)}
      onClick={() => sfx.select()}
      className={cx(
        'flex items-center gap-3.5 rounded-lg border-2 bg-ink-850 px-4 py-4 shadow-pixel transition-all hover:-translate-y-0.5',
        highlight ? 'border-cyan' : 'border-edge hover:border-edge-bright',
      )}
    >
      <PixelIcon name={icon} unit={3} />
      <span>
        <span className="block font-screen text-[12px] uppercase tracking-wide text-white">{label}</span>
        <span className="mt-0.5 block text-[12px] text-[#8f86b5]">{detail}</span>
      </span>
    </a>
  );
}
