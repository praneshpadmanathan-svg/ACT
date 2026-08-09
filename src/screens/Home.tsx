/* Camp — the dashboard.

   Set inside the campaign tent from the artwork. Answers three questions
   immediately: where am I, what do I do next, and how far from the target. */

import { useState } from 'react';

import { LIBRARY_STATS, PATH_BY_ID, SECTIONS } from '@/content';
import { hrefFor, useNavigate } from '@/lib/router';
import { useStore } from '@/lib/store';
import {
  DAILY_SIZE,
  dailyDone,
  dueForReview,
  estimatedComposite,
  rankProgress,
  trackStatus,
  weakestTopics,
  type TrackVerdict,
} from '@/lib/progress';
import { dailyBlurb } from '@/lib/daily';
import { daysUntilTest, testUrgency, todaysPlan, weekProgress } from '@/lib/plan';
import { readRaw, writeRaw } from '@/lib/storage';
import { cloudEnabled } from '@/lib/supabase';
import { sfx } from '@/lib/sfx';
import { titleCase } from '@/lib/utils';
import { Page } from '@/components/Shell';
import { Button, ProgressBar, ProgressRing, RankBadge } from '@/components/ui';
import { useMapProgress } from '@/game/AdventureMap';
import { REGIONS } from '@/game/mapData';
import { nextChapter } from '@/game/story';
import { Art } from '@/components/Art';

/** Dismissal of the "make an account" nudge, so it asks once and takes no for
 *  an answer. Nagging a teenager for an email address is how you lose them. */
const SAVE_PROMPT_KEY = 'act-command:save-prompt-dismissed';

export function Home() {
  const { progress, rank, playerName, isGuest } = useStore();
  const navigate = useNavigate();
  const { current, cleared, total, allCleared } = useMapProgress();

  const { pct, next } = rankProgress(progress.xp);
  const estimate = estimatedComposite(progress);
  const reviewDue = dueForReview(progress).length;
  const weak = weakestTopics(progress, 4);
  const pendingChapter = nextChapter(progress, { cleared, total });

  const [savePromptHidden, setSavePromptHidden] = useState(
    () => readRaw(SAVE_PROMPT_KEY) === '1',
  );

  const currentZone = current ? { id: current.zone.id, name: current.zone.name } : null;

  return (
    <div className="relative isolate min-h-dvh">
      {/* the tent */}
      <Art
        name="camp-bg"
        priority
        className="pointer-events-none fixed inset-0 -z-10 h-full w-full select-none object-cover opacity-70"
      />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-leather-950/80 via-leather-950/88 to-leather-950" />

      <Page>
        {/* Story beats play on the map, so a chapter you have earned but not
            yet seen is invisible from camp. Say so, and offer the door. */}
        {pendingChapter && (
          <button
            type="button"
            onClick={() => {
              sfx.select();
              navigate({ name: 'map' });
            }}
            className="panel-lit mb-5 flex w-full items-center gap-4 p-4 text-left transition-all
                       hover:-translate-y-0.5 hover:border-gold-deep sm:p-5"
          >
            <Art
              name="wizzy"
              sizes="(min-width: 640px) 64px, 52px"
              className="animate-float w-[52px] flex-none select-none sm:w-[64px]"
            />
            <span className="min-w-0 flex-1">
              <span className="eyebrow block">✦ Wizzy has something to tell you</span>
              <span className="mt-1 block font-display text-[15px] font-semibold text-gold-light">
                {pendingChapter.title}
              </span>
              <span className="mt-0.5 block font-read text-[13.5px] text-parchment-dim">
                He is waiting out on the map.
              </span>
            </span>
            <span className="flex-none font-display text-[13px] font-semibold text-gold">Go ▸</span>
          </button>
        )}

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
        {/* A guest has something worth losing now.

            Deliberately after the first landmark rather than on the way in: an
            account offered before there is any progress is a toll booth, and
            the honest reason to make one — "your world would survive a cleared
            cache" — is not true yet when you have nothing saved. */}
        {isGuest && cloudEnabled && cleared >= 1 && !savePromptHidden && (
          <div className="panel-lit mb-5 flex flex-wrap items-center gap-4 p-4 sm:p-5">
            <span className="min-w-0 flex-1">
              <span className="eyebrow block">✦ Keep this</span>
              <span className="mt-1 block font-display text-[15px] font-semibold text-gold-light">
                {cleared} landmark{cleared === 1 ? '' : 's'} and {progress.xp.toLocaleString()} XP,
                saved only in this browser
              </span>
              <span className="mt-0.5 block font-read text-[13.5px] text-parchment-dim">
                An account carries it to your phone, and survives clearing your browser data.
              </span>
            </span>
            <span className="flex flex-none gap-2">
              <Button
                variant="primary"
                onClick={() => {
                  sfx.select();
                  navigate({ name: 'auth', mode: 'signup' });
                }}
              >
                Save my progress
              </Button>
              <Button
                onClick={() => {
                  sfx.select();
                  writeRaw(SAVE_PROMPT_KEY, '1');
                  setSavePromptHidden(true);
                }}
              >
                Not now
              </Button>
            </span>
          </div>
        )}

        {/* ------------------------------------------------------- placement */}
        <PlacementPrompt />

        {/* ------------------------------------------------------------ daily */}
        <DailyCard />

        {/* ---------------------------------------------------------- on track */}
        <TrackCard />

        {/* ------------------------------------------------------------ today */}
        <TodayPanel currentZone={currentZone} />

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
              {/* The shields were granted, spent and merged across devices
                  without ever being mentioned on screen. A safety net nobody
                  knows about does not make anyone braver. */}
              <Stat
                label="Day streak"
                value={String(progress.dayStreak)}
                note={
                  progress.streakShields > 0
                    ? `${progress.streakShields} freeze${progress.streakShields === 1 ? '' : 's'} in hand`
                    : undefined
                }
              />
            </dl>

            <a href={hrefFor({ name: 'stats' })} onClick={() => sfx.select()}>
              <Button className="mt-5 w-full">View full progress ▸</Button>
            </a>
          </section>

          <section className="panel p-6 sm:p-7">
            <h3 className="heading mb-5 text-[17px]">All time</h3>
            <dl className="space-y-3">
              <Row label="Target score" value={String(progress.targetScore)} />
              <Row label="Questions answered" value={progress.tally.answered.toLocaleString()} />
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
                    /* #c8553d measured 3.82:1 on the panel — and this is the
                       number telling you a topic is hurting you, so it is the
                       last one that should be hard to read. */
                    style={{ color: t.accuracy < 0.5 ? '#dd8571' : t.accuracy < 0.7 ? '#d4a017' : '#7cc98a' }}
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

/* Offer the placement test, once, and take no for an answer.
 *
 * It appears only while the app genuinely cannot see the student yet — no
 * placement taken and fewer than three answers in any topic, which is the
 * threshold `weakestTopics` uses before it will name one. The moment there is
 * real evidence the prompt is pointless, so it leaves rather than sitting
 * there as a chore. Dismissal is remembered in the same browser-local way as
 * the save-progress nudge, for the same reason. */
const PLACEMENT_PROMPT_KEY = 'act-command:placement-prompt-dismissed';

function PlacementPrompt() {
  const { progress } = useStore();
  const navigate = useNavigate();
  const [hidden, setHidden] = useState(() => readRaw(PLACEMENT_PROMPT_KEY) === '1');

  const hasEvidence = Object.values(progress.tally.topics).some((t) => t.n >= 3);
  if (hidden || progress.diagnostic || hasEvidence) return null;

  return (
    <div className="panel-lit mb-6 flex flex-wrap items-center gap-4 p-5 sm:p-6">
      <span className="min-w-0 flex-1">
        <span className="eyebrow block">✦ Where do you stand?</span>
        <span className="mt-1 block font-display text-[15px] font-semibold text-gold-light">
          Take the placement test
        </span>
        <span className="mt-0.5 block font-read text-[13.5px] leading-relaxed text-parchment-dim">
          A short spread across all four sections, untimed. It tells the plan where to point
          you instead of it guessing for a fortnight.
        </span>
      </span>
      <span className="flex flex-none gap-2">
        <Button
          variant="primary"
          onClick={() => {
            sfx.select();
            navigate({ name: 'diagnostic' });
          }}
        >
          Start
        </Button>
        <Button
          onClick={() => {
            sfx.select();
            writeRaw(PLACEMENT_PROMPT_KEY, '1');
            setHidden(true);
          }}
        >
          Not now
        </Button>
      </span>
    </div>
  );
}

/* The ninety-second door.
 *
 * *"There is nothing to do in 90 seconds."* Every other entry point on this
 * screen is a session — a lesson, a ten-question drill, a timed test. This one
 * is five questions and a streak, and it sits above them all because on a bad
 * day it is the only thing a student will actually tap. */
function DailyCard() {
  const { progress } = useStore();
  const navigate = useNavigate();
  const done = dailyDone(progress);

  return (
    <button
      type="button"
      onClick={() => {
        sfx.select();
        navigate({ name: 'daily' });
      }}
      className={`mb-6 flex w-full items-center gap-4 rounded-lg border-2 p-5 text-left transition-all
                  hover:-translate-y-0.5 sm:p-6 ${
                    done
                      ? 'border-leather-700 bg-leather-900 hover:border-leather-600'
                      : 'panel-lit hover:border-gold-deep'
                  }`}
    >
      <span
        className="num flex-none rounded-lg border-2 px-4 py-2 text-[26px] leading-none"
        style={{
          color: done ? '#7cc98a' : '#d4a017',
          borderColor: done ? '#3f6b4a' : '#8a6a1c',
        }}
      >
        {done ? '✓' : DAILY_SIZE}
      </span>
      <span className="min-w-0 flex-1">
        <span className="eyebrow block">{done ? '✓ Daily challenge done' : '☀ Daily challenge'}</span>
        <span className="mt-1 block font-display text-[15px] font-semibold text-gold-light">
          {done
            ? `Back tomorrow — ${progress.dayStreak} day streak`
            : `${DAILY_SIZE} questions, about ninety seconds`}
        </span>
        <span className="mt-0.5 block font-read text-[13.5px] text-parchment-dim">
          {done ? 'Anything else you do today is ahead of schedule.' : dailyBlurb(progress)}
        </span>
      </span>
      {!done && <span className="flex-none font-display text-[13px] font-semibold text-gold">Start ▸</span>}
    </button>
  );
}

/* Am I on track for the score I said I wanted?
 *
 * Onboarding asks for a target on its very first screen and, until now, the
 * number appeared exactly once afterwards — as a row of grey text in "All
 * time" — and was never compared against anything. `trackStatus` has done the
 * arithmetic for a while; this is the first thing to render it.
 *
 * The card is deliberately absent rather than empty when the estimate is not
 * yet earned (fewer than eight attempts in two sections). A verdict of
 * "unknown" printed in a box is worse than no box: it teaches a student that
 * this part of the screen has nothing to say. */

const TRACK_FACE: Record<
  Exclude<TrackVerdict, 'unknown'>,
  { eyebrow: string; color: string; border: string }
> = {
  ahead: { eyebrow: '✦ Ahead of your target', color: '#7cc98a', border: 'border-[#3f6b4a]' },
  onTrack: { eyebrow: '⚑ On track', color: '#d4a017', border: 'border-gold-deep' },
  behind: { eyebrow: '⚠ Behind your target', color: '#dd8571', border: 'border-[#7a4038]' },
};

function TrackCard() {
  const { progress } = useStore();
  const status = trackStatus(progress);

  if (status.verdict === 'unknown' || status.current === null) return null;
  const face = TRACK_FACE[status.verdict];

  /* Every sentence below is a statement about what has happened, never a
     prediction about test day. The estimate is drill accuracy run through a
     hand-fit curve, and dressing that up as a forecast is the single most
     dishonest thing a study app can do. */
  const line = (() => {
    if (status.verdict === 'ahead') {
      return `Your estimate is at or above the ${status.target} you set. Hold it there — a target met in April is not a target met in June.`;
    }
    const gap = `${status.gap} point${status.gap === 1 ? '' : 's'} to go`;
    if (status.daysLeft === null) {
      return `${gap}. Set a test date in your profile and this can tell you whether the time adds up.`;
    }
    if (status.verdict === 'onTrack') {
      return `${gap}, with ${status.daysLeft} day${status.daysLeft === 1 ? '' : 's'} left. At a steady pace that adds up.`;
    }
    return `${gap}, with ${status.daysLeft} day${status.daysLeft === 1 ? '' : 's'} left. That is a stretch at a steady pace — more days on than off is what closes it.`;
  })();

  return (
    <section className={`panel mb-6 border-2 ${face.border} p-6 sm:p-7`}>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="eyebrow" style={{ color: face.color }}>
          {face.eyebrow}
        </span>
        {status.change !== null && status.change !== 0 && (
          <span className="ml-auto font-display text-[13px] font-semibold text-parchment-dim">
            {status.change > 0 ? '▲' : '▼'} {Math.abs(status.change)} point
            {Math.abs(status.change) === 1 ? '' : 's'} in the last 60 days
          </span>
        )}
      </div>

      <div className="mt-3 flex items-end gap-3">
        <span className="num text-[38px] leading-none" style={{ color: face.color }}>
          {status.current}
        </span>
        <span className="pb-1 font-read text-[14px] text-ink-faint">
          estimated now · {status.target} target
        </span>
      </div>

      <p className="mt-3 font-read text-[14px] leading-relaxed text-parchment-dim">{line}</p>
      <p className="mt-2 font-read text-[12.5px] text-ink-faint">
        Estimated from your practice accuracy, not a scored test. Take a full test for the
        closer number.
      </p>
    </section>
  );
}

/* Today's session.

   The panel that answers "what should I actually do right now", which is the
   question a study app exists to answer and the one this one used to leave
   hanging: onboarding asked when the test was, wrote a weekly goal, and then
   nothing ever read either of them again. */
function TodayPanel({ currentZone }: { currentZone: { id: string; name: string } | null }) {
  const { progress } = useStore();
  const navigate = useNavigate();

  const days = daysUntilTest(progress);
  const urgency = testUrgency(days);
  const week = weekProgress(progress);
  const plan = todaysPlan(progress, currentZone);
  const lead = plan.steps[0];

  const countdown =
    urgency === 'close' ? '#dd8571' : urgency === 'soon' ? '#d4a017' : '#7cc98a';

  return (
    <section className="panel-lit mb-6 p-6 sm:p-7">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="heading text-[17px]">Today</h3>
        {days !== null && (
          <span className="font-display text-[13.5px] font-semibold" style={{ color: countdown }}>
            {days > 0
              ? `${days} day${days === 1 ? '' : 's'} until your test`
              : days === 0
                ? 'Your test is today — good luck'
                : 'Test day has passed'}
          </span>
        )}
      </div>

      {/* the week */}
      <div className="mb-5">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="label-sm">This week</span>
          <span className="num text-[15px] text-parchment-dim">
            {week.answered} / {week.goal} questions
          </span>
        </div>
        <ProgressBar value={week.pct} label="Weekly goal" />
        {week.activeDays > 0 && (
          <p className="mt-2 font-read text-[13px] text-ink-faint">
            {week.activeDays} of the last 7 days studied
            {week.pct >= 1 ? ' — goal met, anything now is ahead of schedule.' : '.'}
          </p>
        )}
      </div>

      {/* the session */}
      {lead && (
        <div className="border-t border-leather-700 pt-5">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <span className="label-sm">
              {plan.done ? 'Done for today — carry on if you like' : 'Start here'}
            </span>
            <span className="label-sm">~{plan.minutes} min</span>
          </div>

          <button
            type="button"
            onClick={() => {
              sfx.select();
              navigate(lead.to);
            }}
            className="w-full rounded-lg border-2 border-leather-700 bg-leather-850 px-5 py-4 text-left transition-colors hover:border-gold-deep"
          >
            <span className="block font-display text-[15px] font-semibold text-gold-light">
              {lead.title}
            </span>
            <span className="mt-0.5 block font-read text-[13.5px] leading-relaxed text-parchment-dim">
              {lead.detail}
            </span>
          </button>

          {plan.steps.length > 1 && (
            <ol className="mt-2.5 space-y-2">
              {plan.steps.slice(1).map((step) => (
                <li key={`${step.kind}-${step.title}`}>
                  <button
                    type="button"
                    onClick={() => {
                      sfx.select();
                      navigate(step.to);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg border border-leather-700/70 px-4 py-2.5 text-left transition-colors hover:border-gold-deep"
                  >
                    <span className="min-w-0 flex-1 truncate font-read text-[14px] text-parchment-dim">
                      {step.title}
                    </span>
                    <span className="flex-none font-script text-[10px] uppercase tracking-wide text-ink-faint">
                      {step.minutes} min
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <dt className="label-sm">{label}</dt>
      <dd className="num mt-1 text-[22px] text-parchment">{value}</dd>
      {note && <dd className="mt-0.5 font-read text-[11.5px] leading-tight text-cliffs">{note}</dd>}
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
