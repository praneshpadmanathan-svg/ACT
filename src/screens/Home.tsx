/* Camp — the dashboard.

   Set inside the campaign tent from the artwork. Answers three questions
   immediately: where am I, what do I do next, and how far from the target. */

import { LIBRARY_STATS, PATH_BY_ID, SECTIONS } from '@/content';
import { hrefFor, useNavigate } from '@/lib/router';
import { useStore } from '@/lib/store';
import { dueForReview, estimatedComposite, rankProgress, weakestTopics } from '@/lib/progress';
import { sfx } from '@/lib/sfx';
import { titleCase } from '@/lib/utils';
import { Page } from '@/components/Shell';
import { Button, ProgressBar, ProgressRing, RankBadge } from '@/components/ui';
import { useMapProgress } from '@/game/AdventureMap';
import { REGIONS } from '@/game/mapData';

export function Home() {
  const { progress, rank, playerName, isGuest } = useStore();
  const navigate = useNavigate();
  const { current, cleared, total, allCleared } = useMapProgress();

  const { pct, next } = rankProgress(progress.xp);
  const estimate = estimatedComposite(progress);
  const reviewDue = dueForReview(progress).length;
  const weak = weakestTopics(progress, 4);

  return (
    <div className="relative isolate min-h-screen">
      {/* the tent */}
      <img
        src="/art/camp-bg.webp"
        alt=""
        className="pointer-events-none fixed inset-0 -z-10 h-full w-full select-none object-cover opacity-70"
        draggable={false}
      />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-leather-950/80 via-leather-950/88 to-leather-950" />

      <Page>
        {/* ---------------------------------------------------------- greeting */}
        <div className="mb-6 grid gap-4 lg:grid-cols-[1.25fr_1fr]">
          <div className="panel-lit p-6 sm:p-7">
            <div className="flex items-start gap-4">
              <RankBadge rank={rank} size={64} />
              <div className="min-w-0">
                <div className="eyebrow">{isGuest ? 'Travelling as a guest' : 'Welcome back'}</div>
                <h1 className="heading mt-1 truncate text-[clamp(1.4rem,3vw,1.9rem)]">
                  {playerName}
                </h1>
                <p className="mt-1 font-script text-[14px] uppercase tracking-[0.14em]" style={{ color: rank.color }}>
                  {rank.name}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="num text-[24px] text-gold">{progress.xp.toLocaleString()} XP</span>
                {next && (
                  <span className="label-sm">
                    {(next.xp - progress.xp).toLocaleString()} to {next.name}
                  </span>
                )}
              </div>
              <ProgressBar value={pct} label="Rank progress" />
            </div>
          </div>

          {/* continue the quest */}
          <button
            type="button"
            onClick={() => {
              sfx.select();
              if (current) navigate({ name: 'zone', zone: current.zone.id });
              else navigate({ name: 'tests' });
            }}
            className="panel-lit group p-6 text-left transition-colors hover:border-gold-deep sm:p-7"
          >
            <div className="eyebrow mb-3">⚑ Continue your quest</div>
            <h2 className="heading text-[clamp(1.15rem,2.4vw,1.5rem)] text-gold-light">
              {current ? current.zone.name : 'The Final Summit'}
            </h2>
            <p className="mt-2 font-read text-[15px] leading-relaxed text-parchment-dim">
              {current
                ? `${current.zone.sub} — a short lesson, then a quiz to clear the landmark.`
                : 'Every landmark cleared. Sail to the citadel and take your full mock test.'}
            </p>
            <span className="mt-5 inline-flex items-center gap-2 font-display text-[14px] font-semibold text-gold group-hover:text-gold-bright">
              {current ? 'Begin the lesson' : 'Take the mock test'} ▸
            </span>
          </button>
        </div>

        {/* ------------------------------------------------------------ stats */}
        <div className="mb-6 grid gap-4 lg:grid-cols-[1.25fr_1fr]">
          <section className="panel p-6 sm:p-7">
            <h3 className="heading mb-5 text-[17px]">Your progress</h3>
            <div className="grid grid-cols-4 gap-2">
              {SECTIONS.map((section) => {
                const path = PATH_BY_ID[section.id];
                const done = path.nodes.filter((n) => progress.zonesCleared[n.id] !== undefined).length;
                return (
                  <ProgressRing
                    key={section.id}
                    value={path.nodes.length ? done / path.nodes.length : 0}
                    color={REGIONS[section.id].color}
                    label={section.name}
                  />
                );
              })}
            </div>

            <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-leather-700 pt-5">
              <Stat label="Landmarks" value={`${cleared}/${total}`} />
              <Stat label="Est. score" value={estimate !== null ? String(estimate) : '—'} />
              <Stat label="Day streak" value={String(progress.dayStreak)} />
            </dl>

            <a href={hrefFor({ name: 'stats' })} onClick={() => sfx.select()}>
              <Button className="mt-5 w-full">View full progress ▸</Button>
            </a>
          </section>

          <section className="panel p-6 sm:p-7">
            <h3 className="heading mb-5 text-[17px]">Today</h3>
            <dl className="space-y-3">
              <Row label="Target score" value={String(progress.targetScore)} />
              <Row label="Questions answered" value={progress.attempts.length.toLocaleString()} />
              <Row label="Lessons read" value={`${progress.notesRead.length}/${LIBRARY_STATS.notePages}`} />
              <Row label="Due for review" value={String(reviewDue)} highlight={reviewDue > 0} />
            </dl>

            <a href={hrefFor({ name: reviewDue > 0 ? 'review' : 'drills' })} onClick={() => sfx.select()}>
              <Button variant={reviewDue > 0 ? 'primary' : 'ghost'} className="mt-5 w-full">
                {reviewDue > 0 ? `Review ${reviewDue} question${reviewDue === 1 ? '' : 's'} ▸` : 'Train a skill ▸'}
              </Button>
            </a>
          </section>
        </div>

        {/* -------------------------------------------------------- weak spots */}
        {weak.length > 0 && (
          <>
            <h2 className="heading mb-4 text-[17px]">Worth fixing</h2>
            <div className="mb-6 grid gap-2.5 sm:grid-cols-2">
              {weak.map((t) => (
                <button
                  key={`${t.section}-${t.topic}`}
                  type="button"
                  onClick={() => {
                    sfx.select();
                    if (t.section !== 'zone') navigate({ name: 'drill', section: t.section, topic: t.topic });
                  }}
                  className="panel flex items-center gap-4 px-5 py-4 text-left transition-colors hover:border-gold-deep"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-[15px] font-semibold text-parchment">
                      {titleCase(t.topic)}
                    </span>
                    <span className="mt-0.5 block font-read text-[13.5px] text-ink-faint">
                      {t.correct}/{t.attempts} correct · {t.avgSeconds.toFixed(0)}s average
                    </span>
                  </span>
                  <span
                    className="num text-[22px]"
                    style={{ color: t.accuracy < 0.5 ? '#c8553d' : t.accuracy < 0.7 ? '#d4a017' : '#5fa86b' }}
                  >
                    {Math.round(t.accuracy * 100)}%
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ----------------------------------------------------------- routes */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Quick label="Adventure map" detail={allCleared ? 'All cleared' : `${total - cleared} landmarks left`} to="map" />
          <Quick label="The library" detail={`${LIBRARY_STATS.notePages} lessons`} to="notes" />
          <Quick label="Training yard" detail={`${LIBRARY_STATS.drillQuestions} questions`} to="drills" />
          <Quick label="The Summit" detail="Timed mock test" to="tests" />
        </div>
      </Page>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label-sm">{label}</dt>
      <dd className="num mt-1 text-[22px] text-parchment">{value}</dd>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-leather-700/60 pb-2.5 last:border-0">
      <dt className="font-read text-[14.5px] text-parchment-dim">{label}</dt>
      <dd className="num text-[18px]" style={{ color: highlight ? '#d4a017' : '#e8d9ba' }}>
        {value}
      </dd>
    </div>
  );
}

function Quick({ label, detail, to }: { label: string; detail: string; to: 'map' | 'notes' | 'drills' | 'tests' }) {
  return (
    <a
      href={hrefFor({ name: to })}
      onClick={() => sfx.select()}
      className="panel px-5 py-4 transition-all hover:-translate-y-0.5 hover:border-gold-deep"
    >
      <span className="block font-display text-[15px] font-semibold text-parchment">{label}</span>
      <span className="mt-0.5 block font-read text-[13.5px] text-ink-faint">{detail}</span>
    </a>
  );
}
