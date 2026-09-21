/* Progress: one screen for everything you have done.
 *
 * This was two screens. `stats` held the analytics — projected composite,
 * accuracy by section, twelve weeks of activity, the topic table — and
 * `profile` held the identity: traveller, rank, the rank ladder, achievements,
 * a library tally. Neither was reachable from the other except through the
 * rail, `profile` had no nav slot at all, and the split ran straight through
 * the middle of one question. "How am I doing" is answered by the estimate
 * *and* by the rank, and a student had to know a second screen existed to see
 * half of it.
 *
 * So: one destination. The order is what a person actually asks, in order —
 * who am I, how far up am I, what will I score, where am I weak, what have I
 * collected. `profile` still resolves, to here, because links to it exist in
 * the wild.
 *
 * The traveller picker went the other way, to Settings. Choosing an avatar is
 * a preference you set once, not progress you come back to read, and it was
 * sitting between the rank ladder and the achievement wall. */

import type { Progress } from '@/types';
import { useMemo } from 'react';
import { LIBRARY_STATS, PATH_BY_ID, SECTIONS, SECTION_BY_ID } from '@/content';
import { hrefFor, useNavigate } from '@/lib/router';
import { useStore } from '@/lib/store';
import {
  ACHIEVEMENTS,
  dailyActivity,
  estimatedComposite,
  sectionAccuracy,
  topicStats,
} from '@/lib/progress';
import { cx, formatRelative, titleCase } from '@/lib/utils';
import { Page } from '@/components/Shell';
import { Button, ProgressBar, SectionHeading, EmptyState } from '@/components/ui';
import { AchievementBadge } from '@/components/RankSigil';
import { RankLadder } from '@/components/RankLadder';
import { ScoreCaveat } from '@/components/ScoreCaveat';
import { ActivityChart, MIN_TREND_POINTS, ScoreTrend } from '@/components/StatCharts';
import { HeroSprite } from '@/game/HeroSprite';

/* ---------------------------------------------------------------- stats */

export function StatsScreen() {
  const navigate = useNavigate();
  const { progress, playerName } = useStore();

  const unlocked = new Set(progress.achievements);
  const { answered } = progress.tally;

  return (
    <Page>
      <SectionHeading
        eyebrow="Your climb"
        title="Progress"
        detail="Everything here comes from questions you have actually answered."
        right={
          <a href={hrefFor({ name: 'settings' })}>
            <Button>Settings</Button>
          </a>
        }
      />

      {/* Who you are, and nothing else. The rank name used to be printed here
          too, directly above a ladder whose whole job is to say which rank you
          are — the same word twice, eight lines apart, which is what made the
          old profile read as two half-finished cards rather than one. The
          ladder owns the rank now; this owns the person and the XP that drives
          the ladder. */}
      <div className="panel-lit mb-5 flex flex-wrap items-center gap-x-6 gap-y-4 p-6 sm:p-7">
        <HeroSprite hero={progress.hero} height={92} />
        <div className="min-w-0 flex-1">
          <h2 className="heading text-[15px] text-parchment">{playerName}</h2>
          <p className="mt-1.5 font-read text-[13px] text-ink-faint">
            <b className="num text-[17px] text-gold">{progress.xp.toLocaleString()}</b> XP earned ·{' '}
            <b className="num text-parchment">{answered.toLocaleString()}</b> question
            {answered === 1 ? '' : 's'} answered
          </p>
        </div>
      </div>

      {/* The ladder comes before the analytics deliberately, and it renders for
          a player with zero answers as readily as for one at the top. It is
          the only place in the app that shows what the seven ranks *are*, and
          gating that behind having already earned XP would hide the map from
          exactly the person who has not started walking yet. */}
      <h2 className="heading mb-3 text-[13px] text-parchment">Your rank</h2>
      <div className="panel mb-7 p-5 sm:p-6">
        <RankLadder xp={progress.xp} />
      </div>

      {answered === 0 ? (
        <EmptyState
          art="scroll"
          title="Your progress starts with one question"
          action={
            <Button variant="primary" onClick={() => navigate({ name: 'drills' })}>
              Start practising
            </Button>
          }
          detail="Answer some questions and this fills up with accuracy by topic, an estimated composite, and your activity history. The ladder above works from your first one."
        />
      ) : (
        <StatsBody progress={progress} />
      )}

      {/* achievements */}
      <h2 className="heading mb-4 mt-7 text-[13px] text-parchment">
        Achievements ({unlocked.size}/{ACHIEVEMENTS.length})
      </h2>
      <div className="mb-6 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {ACHIEVEMENTS.map((a) => {
          const got = unlocked.has(a.id);
          return (
            <div
              key={a.id}
              className={cx(
                'flex items-start gap-3.5 rounded-lg border-2 px-4 py-3.5',
                got ? 'border-gold/50 bg-leather-850' : 'border-leather-700/50 bg-leather-900',
              )}
            >
              {/* The medal carries earned-vs-locked itself now — struck metal
                  against a dark blank — so the card no longer dims to 50%.
                  Halving the contrast of the *text* to say "not yet" made the
                  locked half of the wall hard to read, and that is exactly the
                  half a student reads to find out what to go and do. */}
              <AchievementBadge icon={a.icon} tier={a.tier} earned={got} size={40} />
              <div className="min-w-0">
                <div
                  className={cx(
                    'font-script text-[12px] uppercase tracking-wide',
                    got ? 'text-parchment' : 'text-parchment-dim',
                  )}
                >
                  {a.name}
                  {/* Metal and dimming are invisible to a screen reader, and
                      the wall means nothing without the earned state. */}
                  <span className="sr-only">{got ? ' — earned' : ' — locked'}</span>
                </div>
                <div className="mt-0.5 text-[12px] leading-snug text-ink-faint">{a.detail}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* library */}
      <div className="panel p-6">
        <h3 className="heading mb-4 text-[12px] text-parchment">Your library</h3>
        <dl className="space-y-2 text-[14px]">
          <Row
            label="Note pages read"
            value={`${progress.notesRead.length} / ${LIBRARY_STATS.notePages}`}
          />
          <Row
            label="Zones cleared"
            value={`${Object.keys(progress.zonesCleared).length} / ${LIBRARY_STATS.zones}`}
          />
          <Row label="Tests taken" value={String(progress.testHistory.length)} />
          <Row label="Questions in review" value={String(Object.keys(progress.review).length)} />
          {progress.profile && (
            <Row label="Plan created" value={formatRelative(progress.profile.savedAt)} />
          )}
        </dl>
      </div>
    </Page>
  );
}

/* The measured half. Split out only so the screen above can skip it wholesale
   for a player with no answers, without also skipping the rank ladder and the
   achievement wall that sit either side of it. */
function StatsBody({ progress }: { progress: Progress }) {
  const estimate = estimatedComposite(progress);
  const allTopics = useMemo(() => topicStats(progress).filter((t) => t.attempts >= 2), [progress]);

  const sectionsNeedingWork = useMemo(
    () => SECTIONS.filter((s) => sectionAccuracy(progress, s.id).n < 8),
    [progress],
  );

  const activity = useMemo(() => dailyActivity(progress, 84), [progress]);

  const tests = progress.testHistory;
  const { answered, correct: totalCorrect } = progress.tally;
  const overallAccuracy = answered ? totalCorrect / answered : 0;

  return (
    <>
      {/* One number is the headline, and the other three are not.

          This was four tiles in a row, identical in size and weight, so the
          projected score — the only figure on the screen anyone opens this
          page to see — was typeset exactly as loudly as the day streak. A
          screen where everything is emphasised has no emphasis. The composite
          now sits at display size on the one gilt-ruled panel here; accuracy,
          volume and streak drop a rung to supporting figures. Nothing is
          hidden and nothing moved behind the paywall — only the type changed
          size to match what the numbers are worth. */}
      <div className="panel-lit mb-4 p-6 sm:p-7">
        <div className="grid items-center gap-7 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <div className="font-script text-[11px] uppercase tracking-[0.16em] text-ink-faint">
              Projected composite
            </div>
            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="num text-display-l leading-none text-gold">
                {estimate !== null ? estimate : '—'}
              </span>
              <span className="font-script text-[11.5px] uppercase tracking-[0.14em] text-ink-faint">
                of 36 · goal {progress.targetScore}
              </span>
            </div>
            {estimate !== null && (
              <p className="mt-2 font-read text-[13px] text-parchment-dim">
                {estimate >= progress.targetScore ? (
                  <>You are at your goal. Raise it, or hold it steady under a clock.</>
                ) : (
                  <>
                    <b className="text-parchment">{progress.targetScore - estimate}</b> point
                    {progress.targetScore - estimate === 1 ? '' : 's'} to your goal.
                  </>
                )}
              </p>
            )}
          </div>

          {/* The trend is a different instrument from the number beside it —
              scored tests, not drill accuracy — so it is labelled as one and
              never joins that number on a single line. When there are not two
              tests to draw, the space says why instead of showing a line with
              one point in it. */}
          {tests.length >= MIN_TREND_POINTS ? (
            <ScoreTrend tests={tests} target={progress.targetScore} />
          ) : (
            <p className="max-w-[260px] font-read text-[12.5px] leading-relaxed text-ink-faint">
              A trend line needs <b className="text-parchment-dim">two scored tests</b> — you have{' '}
              {tests.length === 0 ? 'none' : 'one'}. The number beside it is worked out from
              practice accuracy, which is a different instrument and does not belong on the same
              axis.{' '}
              <a
                href={hrefFor({ name: 'tests' })}
                className="underline underline-offset-2 transition-colors hover:text-parchment-dim"
              >
                Sit one at the Summit
              </a>
              .
            </p>
          )}
        </div>
      </div>

      {/* The caveat belongs to the number directly above it, so it sits
          directly below that number — not after an intervening row of tiles,
          where it reads as a footnote to whatever it happens to follow. */}
      {estimate !== null && <ScoreCaveat kind="estimate" className="mb-5 max-w-xl" />}

      {/* Supporting figures. One rung down the elevation ladder and roughly
          half the type size, which is the whole hierarchy. */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <Figure label="Overall accuracy" value={`${Math.round(overallAccuracy * 100)}%`} />
        <Figure label="Questions answered" value={answered.toLocaleString()} />
        <Figure label="Day streak" value={String(progress.dayStreak)} />
      </div>

      {/* A composite needs two sections with real data behind it. Saying so
          beats a bare em-dash, which reads as "broken" rather than "not yet". */}
      {estimate === null && (
        <p className="mb-6 -mt-2 font-read text-[13.5px] leading-relaxed text-ink-faint">
          A composite needs at least <b className="text-parchment-dim">two sections</b> with eight
          or more answered questions each — it is an average, and averaging one section would
          flatter or punish you for no reason.
          {sectionsNeedingWork.length > 0 && (
            <>
              {' '}
              Still short in{' '}
              <b className="text-parchment-dim">
                {sectionsNeedingWork.map((s) => s.name).join(', ')}
              </b>
              .
            </>
          )}
        </p>
      )}

      {/* The four tiles above stay free on purpose. Accuracy, questions
          answered and a day streak are a record of the person's own work, and
          a streak counter you can only see by paying is a worse advert for Pro
          than no streak counter at all. What Pro buys is the *breakdown* — the
          part that tells you what to do next, which is the part that takes the
          section model, the history and the topic table to compute. */}
      {/* Small multiples: the same card, the same 0-100% scale, the same four
          pieces in the same four places, repeated once per section. That
          sameness is the point — it is what lets the eye compare four things
          by shape instead of by reading four numbers.

          Each facet carries its own title, so which section a card belongs to
          never rests on its accent colour. It cannot: the four section hues
          are pinned to roughly one lightness in the light theme and the worst
          adjacent pair separates by 3.9 under simulated protanopia, against a
          target of 8. They are fine as one accent per titled card, which is
          all they are used as here, and must never become the only thing
          telling two series apart inside one plot. */}
      <h2 className="heading mb-4 text-[13px] text-parchment">By section</h2>
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {SECTIONS.map((section) => {
          const { n, ok, pct } = sectionAccuracy(progress, section.id);
          const path = PATH_BY_ID[section.id];
          const zones = path.nodes.filter((z) => progress.zonesCleared[z.id] !== undefined).length;

          return (
            <div key={section.id} className="panel-quiet p-5">
              <div className="flex items-baseline justify-between">
                <h3 className="heading text-[12px]" style={{ color: section.color }}>
                  {section.name}
                </h3>
                <span className="num text-[26px]" style={{ color: section.color }}>
                  {n >= 5 ? `${Math.round(pct * 100)}%` : '—'}
                </span>
              </div>
              <div className="mt-3">
                <ProgressBar value={pct} color={section.color} height={8} />
              </div>
              <div className="mt-2.5 flex justify-between font-script text-[10px] uppercase tracking-wide text-ink-faint">
                <span>
                  {ok}/{n} correct
                </span>
                <span>
                  {zones}/{path.nodes.length} zones
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* activity */}
      <h2 className="heading mb-4 text-[13px] text-parchment">Last 12 weeks</h2>
      <div className="panel-quiet mb-6 p-5">
        <ActivityChart counts={activity} />
      </div>

      {/* topics */}
      <h2 className="heading mb-4 text-[13px] text-parchment">Every topic you have tried</h2>
      <div className="space-y-2">
        {allTopics.map((t) => {
          /* There is no "Zone" label any more. It was never a section — it
             was the bug, standing as a fifth column beside the four real
             ones and taking every landmark topic with it. A topic you met at
             a landmark is an English topic, and English is the only honest
             thing to call it.

             `'zone'` can still arrive here, from a save whose zone answers
             have aged out of the answer log before the migration in
             `progress.ts` could place them. Those render with no section
             rather than with an invented one. */
          const meta = t.section === 'zone' ? undefined : SECTION_BY_ID[t.section];
          return (
            <div
              key={`${t.section}-${t.topic}`}
              className="panel-quiet flex items-center gap-4 px-4 py-3"
            >
              <span className="w-36 flex-none truncate font-sans text-[13px] font-semibold text-parchment sm:w-48">
                {titleCase(t.topic)}
              </span>
              <span
                className="hidden w-16 flex-none font-script text-[10px] uppercase tracking-wide sm:block"
                style={{ color: meta?.color }}
              >
                {meta?.name}
              </span>
              <ProgressBar
                value={t.accuracy}
                color={
                  t.accuracy < 0.5
                    ? 'oklch(var(--c-blood-text))'
                    : t.accuracy < 0.75
                      ? 'oklch(var(--c-gold))'
                      : 'oklch(var(--c-woods-text))'
                }
                height={8}
              />
              <span className="num w-14 flex-none text-right text-[15px] text-parchment-dim">
                {t.correct}/{t.attempts}
              </span>
              <span className="num hidden w-12 flex-none text-right text-[14px] text-ink-faint sm:block">
                {t.avgSeconds.toFixed(0)}s
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* A supporting figure: the same object the headline used to be, at half the
   size and without an accent colour of its own.

   The colours went deliberately. Four tiles in four different hues made the
   set read as four categories, which they are not — they are four unrelated
   measures of one person, and the hues were decoration standing in for
   meaning. Parchment for all three says what is true: none of them is more
   important than another, and none of them is the headline. */
function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel-quiet px-4 py-3.5">
      <div className="font-script text-[10px] uppercase leading-tight tracking-[0.12em] text-ink-faint">
        {label}
      </div>
      <div className="num mt-1.5 text-[22px] leading-none text-parchment">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-leather-700/50 pb-2 last:border-0">
      <dt className="text-ink-faint">{label}</dt>
      <dd className="num text-[17px] text-parchment">{value}</dd>
    </div>
  );
}
