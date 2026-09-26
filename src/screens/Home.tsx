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
import { daysUntilTest, drillable, testUrgency, todaysPlan, weekProgress } from '@/lib/plan';
import { readRaw, writeRaw } from '@/lib/storage';
import { cloudEnabled } from '@/lib/supabase';
import { sfx } from '@/lib/sfx';
import { titleCase } from '@/lib/utils';
import { Page } from '@/components/Shell';
import {
  Button,
  Eyebrow,
  LEADING_ICON,
  ProgressBar,
  ProgressRing,
  RankBadge,
  Tally,
} from '@/components/ui';
import { Glyph, type IconName } from '@/components/Icon';
import { useZoneProgress } from '@/lib/zoneProgress';
import { REGIONS } from '@/content/regionFlavor';
import { nextChapter } from '@/game/story';
import { Art } from '@/components/Art';

/** Dismissal of the "make an account" nudge, so it asks once and takes no for
 *  an answer. Nagging a teenager for an email address is how you lose them. */
const SAVE_PROMPT_KEY = 'act-command:save-prompt-dismissed';

export function Home() {
  const { progress, rank, playerName, isGuest } = useStore();
  const navigate = useNavigate();
  const { current: standing, cleared, total, allCleared } = useZoneProgress();

  /* The camp's headline CTA has to point somewhere a free traveller can
     actually go. `useZoneProgress` walks the subject they chose first, so
     after a trial ends — or for anyone who picked Math on the way in — the
     one big button on the home screen would otherwise open an upsell. That is
     the worst possible place for a wall: it is the first thing they see, and
     it makes the app look finished rather than partly bought.
          Nothing is gated any more, so the standing landmark is simply the one
     to point at. */
  const current = standing ?? null;

  const { pct, next } = rankProgress(progress.xp);
  const estimate = estimatedComposite(progress);
  const reviewDue = dueForReview(progress).length;
  /* Only topics with a drill behind them, since the card's whole job is to
     open one — see `drillable`. Over-fetched and then cut to four, so a topic
     with no drill costs a slot in the list rather than the list itself. */
  const weak = weakestTopics(progress, 12).filter(drillable).slice(0, 4);
  const pendingChapter = nextChapter(progress, { cleared, total });

  const [savePromptHidden, setSavePromptHidden] = useState(() => readRaw(SAVE_PROMPT_KEY) === '1');

  const currentZone = current ? { id: current.zone.id, name: current.zone.name } : null;

  return (
    <div className="relative isolate min-h-dvh">
      {/* the tent */}
      <Art
        name="camp-bg"
        priority
        className="pointer-events-none fixed inset-0 -z-10 h-full w-full select-none object-cover opacity-70"
      />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-leather-950/80 via-leather-950/90 to-leather-950" />

      <Page className="home-dashboard">
        <header className="home-welcome">
          <div>
            <p className="home-kicker">Your learning dashboard</p>
            <h1>Welcome back, {playerName}.</h1>
            <p>Your next step, your progress, and every way to practise — all in one place.</p>
          </div>
          <a href={hrefFor({ name: 'stats' })} className="btn btn-ghost">
            View progress <Glyph name="chevronRight" size={16} />
          </a>
        </header>
        <div className="home-overview">
          {/* ------------------------------------------------------------- hero */}
          <CampHero currentZone={currentZone} allCleared={allCleared} />

          <div className="panel-quiet home-rank">
            {/* A prominent sigil without particles over the progress labels. */}
            <RankBadge rank={rank} size={76} aura={false} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2.5">
                <p className="home-kicker">Your rank</p>
                <span
                  className="home-rank-name"
                  /* Tinted toward the surface rather than set raw, the same way
                   the ranks on the Progress screen are. `rank.color` is a
                   badge colour picked to read on dark metal — Lorewarden's
                   cyan lands at 1.49:1 on light parchment — and the mix keeps
                   each rank's identity while letting it invert with the
                   theme. See --rank-tint in index.css. */
                  style={{
                    color: `color-mix(in oklab, ${rank.color} var(--rank-tint), oklch(var(--c-parchment)))`,
                  }}
                >
                  {rank.name}
                </span>
                {isGuest && <span className="label-sm">travelling as a guest</span>}
              </div>
              <div className="mt-4 flex flex-col items-stretch gap-3">
                <ProgressBar
                  value={pct}
                  label="Rank progress"
                  height={6}
                  sweep
                  className="flex-1"
                />
                {next && (
                  <span className="label-sm flex-none">
                    {(next.xp - progress.xp).toLocaleString()} to {next.name}
                  </span>
                )}
              </div>
            </div>
            <Tally
              value={progress.xp}
              className="num home-rank-xp text-gold"
              format={(n) => `${n.toLocaleString()} XP`}
            />
          </div>
        </div>
        <section className="home-actions" aria-labelledby="home-actions-title">
          <h2 id="home-actions-title">What would you like to do?</h2>
          {/* ----------------------------------------------------------- routes */}
          <div className="home-shortcuts">
            <Quick
              label="Study a subject"
              detail={allCleared ? 'All cleared' : `${total - cleared} landmarks left`}
              to="path"
            />
            <Quick label="Read a lesson" detail={`${LIBRARY_STATS.notePages} lessons`} to="notes" />
            <Quick
              label="Quick practice"
              detail={`${LIBRARY_STATS.drillQuestions} questions`}
              to="drills"
            />
            <Quick label="Timed practice" detail="Build your test-day pace" to="tests" />
          </div>
        </section>
        <div className="home-activity">
          <TodayPanel currentZone={currentZone} />
          <div className="home-side">
            <DailyCard />
            <TrackCard />
          </div>
        </div>
        <div className="mb-6 grid gap-4 lg:grid-cols-[1.25fr_1fr]">
          <section className="panel-quiet p-6 sm:p-7">
            <h3 className="heading mb-5 text-[17px]">Your progress</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {SECTIONS.map((section) => {
                const path = PATH_BY_ID[section.id];
                const done = path.nodes.filter(
                  (n) => progress.zonesCleared[n.id] !== undefined,
                ).length;
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
              <Button trailing className="mt-5 w-full">
                View full progress
              </Button>
            </a>
          </section>

          <section className="panel-quiet p-6 sm:p-7">
            <h3 className="heading mb-5 text-[17px]">All time</h3>
            <dl className="space-y-3">
              <Row label="Target score" value={String(progress.targetScore)} />
              <Row label="Questions answered" value={progress.tally.answered.toLocaleString()} />
              <Row
                label="Lessons read"
                value={`${progress.notesRead.length}/${LIBRARY_STATS.notePages}`}
              />
              <Row label="Due for review" value={String(reviewDue)} highlight={reviewDue > 0} />
            </dl>

            <a
              href={hrefFor({ name: reviewDue > 0 ? 'review' : 'drills' })}
              onClick={() => sfx.select()}
            >
              <Button
                variant={reviewDue > 0 ? 'primary' : 'ghost'}
                trailing
                className="mt-5 w-full"
              >
                {reviewDue > 0
                  ? `Review ${reviewDue} question${reviewDue === 1 ? '' : 's'}`
                  : 'Train a skill'}
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
                    navigate({ name: 'drill', section: t.section, topic: t.topic });
                  }}
                  className="panel-quiet flex items-center gap-4 px-5 py-4 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 font-display text-[15px] font-semibold text-parchment">
                      <span className="truncate">{titleCase(t.topic)}</span>
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
                    style={{
                      color:
                        t.accuracy < 0.5
                          ? 'oklch(var(--c-blood-text))'
                          : t.accuracy < 0.7
                            ? 'oklch(var(--c-gold))'
                            : 'oklch(var(--c-woods-text))',
                    }}
                  >
                    {Math.round(t.accuracy * 100)}%
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        <div className="home-extras">
          <PlacementPrompt />
          {/* Story beats play out on the road, so a chapter you have earned but
            not yet seen is invisible from camp. Say so, and offer the door. */}
          {pendingChapter && (
            <button
              type="button"
              onClick={() => {
                sfx.select();
                navigate({ name: 'path' });
              }}
              className="panel-quiet mb-5 flex w-full items-center gap-4 p-4 text-left sm:p-5"
            >
              <Art
                name="wizzy"
                sizes="(min-width: 640px) 64px, 52px"
                className="animate-float w-[52px] flex-none select-none sm:w-[64px]"
              />
              <span className="min-w-0 flex-1">
                <Eyebrow>Wizzy has something to tell you</Eyebrow>
                <span className="mt-1 block font-display text-[15px] font-semibold text-gold-light">
                  {pendingChapter.title}
                </span>
                <span className="mt-0.5 block font-read text-[13.5px] text-parchment-dim">
                  He is waiting out on the road.
                </span>
              </span>
              <span className="flex flex-none items-center gap-1 font-display text-[13px] font-semibold text-gold">
                Go
                <Glyph name="chevronRight" size={13} strokeWidth={2} />
              </span>
            </button>
          )}
          {/* ------------------------------------------------------------ stats */}
          {/* A guest has something worth losing now.

            Deliberately after the first landmark rather than on the way in: an
            account offered before there is any progress is a toll booth, and
            the honest reason to make one — "your world would survive a cleared
            cache" — is not true yet when you have nothing saved. */}
          {isGuest && cloudEnabled && cleared >= 1 && !savePromptHidden && (
            <div className="panel-quiet mb-5 flex flex-wrap items-center gap-4 p-4 sm:p-5">
              <span className="min-w-0 flex-1">
                <Eyebrow>Keep this</Eyebrow>
                <span className="mt-1 block font-display text-[15px] font-semibold text-gold-light">
                  {cleared} landmark{cleared === 1 ? '' : 's'} and {progress.xp.toLocaleString()}{' '}
                  XP, saved only in this browser
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
        </div>
      </Page>
    </div>
  );
}

/* The single next action — the one elevation-3 object on Camp.
 *
 * It renders `todaysPlan`'s first step rather than holding a second opinion
 * about what to do. Camp used to have both: a "Continue your quest" card at the
 * top pointing at the current landmark, and a "Today" panel five sections
 * further down whose "Start here" button pointed wherever the plan actually
 * pointed — often at review, because a question you got wrong and never saw
 * again is the most expensive thing in a study plan. Only one of them could be
 * right and it was never the one at the top.
 *
 * So the plan wins and moves up here, on paper, at reading size, with the
 * minutes it will take. `TodayPanel` keeps the week and whatever comes after
 * this. */
function CampHero({
  currentZone,
  allCleared,
}: {
  currentZone: { id: string; name: string } | null;
  allCleared: boolean;
}) {
  const { progress } = useStore();
  const navigate = useNavigate();

  const plan = todaysPlan(progress, currentZone);
  const lead = plan.steps[0];
  if (!lead) return null;

  /* Paper, so it is the only surface on Camp you read rather than consult, and
     `.camp-hero` supplies the material and the elevation. */
  return (
    <button
      type="button"
      onClick={() => {
        sfx.select();
        navigate(lead.to);
      }}
      className="camp-hero home-next px-6 py-7 sm:px-9 sm:py-8"
    >
      <span className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1">
        <span className="label-quill">
          {plan.done ? 'Done for today — carry on if you like' : 'Do this next'}
        </span>
        <span className="num text-[12.5px] text-ink-faint">about {lead.minutes} min</span>
      </span>

      {/* The largest type on the screen, and the only thing on Camp allowed to
          be. It is a title from content, so it wraps rather than truncates —
          "Review 14 questions" and "The Marsh of Misplaced Modifiers" have very
          different lengths and both have to survive. */}
      <span className="mt-3 block font-display text-[clamp(1.5rem,4.2vw,2.15rem)] font-semibold leading-[1.14] tracking-wide text-ink">
        {lead.title}
      </span>
      <span className="mt-3 block max-w-[48ch] font-read text-[clamp(1rem,1.5vw,1.1rem)] leading-relaxed text-ink-soft">
        {lead.detail}
      </span>

      {/* A span, not a `Button`: a button inside a button is invalid markup and
          browsers resolve it by dropping one of them. The gilt classes are pure
          CSS, and `.camp-hero:hover .btn-primary` in index.css lights it from
          the card so the whole surface behaves as the one target it looks like. */}
      <span className="btn btn-primary btn-lg mt-6">
        {lead.kind === 'review'
          ? 'Start reviewing'
          : lead.kind === 'test'
            ? 'Enter the summit'
            : allCleared
              ? 'Take the mock test'
              : 'Begin'}
        <Glyph name="chevronRight" size={15} strokeWidth={2} />
      </span>
    </button>
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
    <div className="panel-quiet mb-6 flex flex-wrap items-center gap-4 p-5 sm:p-6">
      <span className="min-w-0 flex-1">
        <Eyebrow>Where do you stand?</Eyebrow>
        <span className="mt-1 block font-display text-[15px] font-semibold text-gold-light">
          Take the placement test
        </span>
        <span className="mt-0.5 block font-read text-[13.5px] leading-relaxed text-parchment-dim">
          A short spread across all four sections, untimed. It tells the plan where to point you
          instead of it guessing for a fortnight.
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
      /* Elevation 1 either way now. The daily used to be a gilt-ruled card at
         elevation 2 that lifted on hover, which put it in a shouting match with
         the hero directly above it — and the hero is frequently the daily's own
         first step, so the screen was competing with itself. */
      className={`panel-quiet mb-6 flex w-full items-center gap-4 p-5 text-left sm:p-6 ${
        done ? 'opacity-80' : ''
      }`}
    >
      <span
        className="num flex flex-none items-center justify-center rounded-lg border-2 px-4 py-2 text-[26px] leading-none"
        style={{
          color: done ? 'oklch(var(--c-woods-text))' : 'oklch(var(--c-gold))',
          borderColor: done ? '#3f6b4a' : '#8a6a1c',
        }}
      >
        {done ? <Glyph name="check" size={26} strokeWidth={2.2} /> : DAILY_SIZE}
      </span>
      <span className="min-w-0 flex-1">
        <span className="eyebrow">
          <Glyph name={done ? 'check' : 'calendar'} size={12} className={LEADING_ICON} />
          {done ? 'Daily challenge done' : 'Daily challenge'}
        </span>
        <span className="mt-1 block font-display text-[15px] font-semibold text-gold-light">
          {done
            ? `Back tomorrow — ${progress.dayStreak} day streak`
            : `${DAILY_SIZE} questions, about ninety seconds`}
        </span>
        <span className="mt-0.5 block font-read text-[13.5px] text-parchment-dim">
          {done ? 'Anything else you do today is ahead of schedule.' : dailyBlurb(progress)}
        </span>
      </span>
      {!done && (
        <span className="flex flex-none items-center gap-1 font-display text-[13px] font-semibold text-gold">
          Start
          <Glyph name="chevronRight" size={13} strokeWidth={2} />
        </span>
      )}
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
  { icon: IconName; eyebrow: string; color: string; border: string }
> = {
  ahead: {
    icon: 'spark',
    eyebrow: 'Ahead of your target',
    color: 'oklch(var(--c-woods-text))',
    border: 'border-[#3f6b4a]',
  },
  onTrack: {
    icon: 'flag',
    eyebrow: 'On track',
    color: 'oklch(var(--c-gold))',
    border: 'border-gold-deep',
  },
  behind: {
    icon: 'alert',
    eyebrow: 'Behind your target',
    color: 'oklch(var(--c-blood-text))',
    border: 'border-[#7a4038]',
  },
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
    <section className={`panel-quiet mb-6 ${face.border} p-5 sm:p-6`}>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="eyebrow" style={{ color: face.color }}>
          <Glyph name={face.icon} size={12} className={LEADING_ICON} />
          {face.eyebrow}
        </span>
        {status.change !== null && status.change !== 0 && (
          <span className="ml-auto font-display text-[13px] font-semibold text-parchment-dim">
            <Glyph
              name={status.change > 0 ? 'chevronUp' : 'chevronDown'}
              size={12}
              strokeWidth={2.2}
              className={LEADING_ICON}
            />
            {Math.abs(status.change)} point
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
        Estimated from your practice accuracy, not a scored test. Take a full test for the closer
        number.
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
  /* The lead step is the Camp hero now, so this panel picks up after it. When
     there is nothing after it, the week bar and the countdown are still worth
     the section — they are the only place either one appears. */
  const rest = todaysPlan(progress, currentZone).steps.slice(1);

  const countdown =
    urgency === 'close'
      ? 'oklch(var(--c-blood-text))'
      : urgency === 'soon'
        ? 'oklch(var(--c-gold))'
        : 'oklch(var(--c-woods-text))';

  return (
    <section className="panel-quiet mb-6 p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="heading text-[15px]">Your weekly plan</h3>
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

      {/* what is left after the hero */}
      {rest.length > 0 && (
        <div className="border-t border-leather-700 pt-5">
          <div className="mb-3">
            <span className="label-sm">Then, if you have the time</span>
          </div>

          {
            <ol className="space-y-2">
              {rest.map((step) => (
                <li key={`${step.kind}-${step.title}`}>
                  <button
                    type="button"
                    onClick={() => {
                      sfx.select();
                      navigate(step.to);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg border border-leather-700/70 px-4 py-2.5 text-left transition-colors hover:border-gold-deep"
                  >
                    <span className="min-w-0 flex-1 font-read text-[14px] text-parchment-dim">
                      {step.title}
                    </span>
                    <span className="flex-none font-script text-[10px] uppercase tracking-wide text-ink-faint">
                      {step.minutes} min
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          }
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
      {note && (
        <dd className="mt-0.5 font-read text-[11.5px] leading-tight text-cliffs-text">{note}</dd>
      )}
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-leather-700/60 pb-2.5 last:border-0">
      <dt className="font-read text-[14.5px] text-parchment-dim">{label}</dt>
      <dd
        className="num text-[18px]"
        style={{ color: highlight ? 'oklch(var(--c-gold))' : 'oklch(var(--c-parchment-dim))' }}
      >
        {value}
      </dd>
    </div>
  );
}

function Quick({
  label,
  detail,
  to,
}: {
  label: string;
  detail: string;
  to: 'path' | 'notes' | 'drills' | 'tests';
}) {
  return (
    <a
      href={hrefFor({ name: to })}
      onClick={() => sfx.select()}
      className="panel-quiet home-shortcut px-5 py-4"
    >
      <span className="home-shortcut-icon">
        <Glyph
          name={
            to === 'notes' ? 'book' : to === 'tests' ? 'clock' : to === 'drills' ? 'bolt' : 'map'
          }
          size={24}
        />
      </span>
      <span className="block font-display text-[15px] font-semibold text-parchment">{label}</span>
      <span className="mt-0.5 block font-read text-[13.5px] text-ink-faint">{detail}</span>
    </a>
  );
}
