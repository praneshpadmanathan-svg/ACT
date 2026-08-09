/* Full-length practice tests.

   Real section timing, no feedback until the end, and a score report that
   points at the topics worth fixing. Timing is derived from a wall-clock
   deadline rather than a decrementing counter, so a backgrounded tab does
   not hand out free minutes. */

import { useEffect, useMemo, useRef, useState } from 'react';
import { QUESTIONS, SECTIONS, SECTION_BY_ID } from '@/content';
import { hrefFor, useConfirmExit, useNavigate } from '@/lib/router';
import { useStore } from '@/lib/store';
import { usePrefs } from '@/lib/prefs';
import { fromDrillQuestion } from '@/lib/normalize';
import {
  compositeOf,
  paceHint,
  pacingFor,
  percentileFor,
  percentileInWords,
  scaleScore,
  type Pacing,
} from '@/lib/progress';
import { sfx } from '@/lib/sfx';
import { cx, formatClock, formatRelative, shuffle, titleCase } from '@/lib/utils';
import type { SectionId, TestResult } from '@/types';
import { Page } from '@/components/Shell';
import { Button, EmptyState, ProgressBar, SectionHeading } from '@/components/ui';
import { QuestionRunner, type AnswerRecord } from '@/components/QuestionRunner';
import { burstConfetti } from '@/components/Feedback';
import { ScoreCaveat } from '@/components/ScoreCaveat';
import { DrillSummary } from './Drills';

/* Section lengths, scaled to what the bank can actually supply. The real ACT
   is longer; these keep the pacing pressure honest without inventing
   questions that do not exist. */
const TEST_PLAN: Record<SectionId, { questions: number; minutes: number }> = {
  english: { questions: 25, minutes: 18 },
  math: { questions: 22, minutes: 25 },
  reading: { questions: 18, minutes: 20 },
  science: { questions: 20, minutes: 20 },
};

/* Extended time.
 *
 * ACT grants 50% and 100% extra time as documented accommodations, and a
 * student who will sit the real exam with time and a half has to practise with
 * time and a half — practising at standard timing trains a pace they will not
 * use and teaches them to rush for no reason. It is a display setting rather
 * than something asked about here, because nobody should have to re-declare a
 * disability every time they open a test.
 *
 * Rounded up to the whole minute. 18 × 1.5 is 27 exactly, but 25 × 1.5 is
 * 37.5, and the half-minute belongs to the student. */
const withAllowance = (minutes: number, allowance: number) => Math.ceil(minutes * allowance);

/* What to call a single-section result.
 *
 * A `TestResult` arrives from local storage and from the sync payload, which
 * means an empty or unrecognised `sections` list is reachable however sound
 * the writing path is. Two screens read `sections[0]` and both used to hand it
 * straight to `SECTION_BY_ID`; a stored result with no sections took the whole
 * history list down with it. */
function soleSectionName(sections: SectionId[]): string {
  const first = sections[0];
  return (first && SECTION_BY_ID[first]?.name) || 'Practice';
}

/* ---------------------------------------------------------------- setup */

export function TestsScreen() {
  const navigate = useNavigate();
  const { progress } = useStore();
  const { prefs } = usePrefs();
  const allowance = prefs.timeAllowance;
  const history = [...progress.testHistory].reverse();

  return (
    <Page>
      <SectionHeading
        eyebrow="Boss battles"
        title="Practice tests"
        detail="Timed, no explanations until you finish. The report tells you which topics cost you the most points."
      />

      <div className="mb-6 grid gap-3 lg:grid-cols-2">
        <div
          className="rounded-xl border-2 border-blood bg-leather-850 p-6 shadow-card sm:p-7"
          style={{ borderTopWidth: 4 }}
        >
          <h2 className="heading text-[13px] text-blood-text">Full test</h2>
          <p className="mt-2.5 text-[14px] leading-relaxed text-parchment-dim">
            All four sections back to back, with a break between each.
          </p>
          <p className="mt-4 font-script text-[10px] uppercase tracking-wide text-ink-faint">
            {Object.values(TEST_PLAN).reduce((n, p) => n + p.questions, 0)} questions ·{' '}
            {Object.values(TEST_PLAN).reduce((n, p) => n + withAllowance(p.minutes, allowance), 0)}{' '}
            minutes
          </p>
          <Button
            variant="danger"
            size="lg"
            className="mt-5 w-full"
            onClick={() => navigate({ name: 'test', config: 'full' })}
          >
            Begin full test ▶
          </Button>
        </div>

        <div className="rounded-xl border-2 border-leather-700 bg-leather-850 p-6 shadow-card sm:p-7">
          <h2 className="heading text-[13px] text-parchment">Single section</h2>
          <p className="mt-2.5 text-[14px] leading-relaxed text-parchment-dim">
            One section, properly timed. Good for building pace.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2.5">
            {SECTIONS.map((s) => (
              <Button
                key={s.id}
                variant="ghost"
                onClick={() => navigate({ name: 'test', config: s.id })}
              >
                <span style={{ color: s.color }}>{s.name}</span>
                <span className="text-ink-faint">
                  {withAllowance(TEST_PLAN[s.id].minutes, allowance)}m
                </span>
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* The placement test's permanent home. The dashboard offers it once and
          then gets out of the way, so without this it would be reachable only
          by typing the URL — which is not a feature, it is a bug with a
          keyboard shortcut. */}
      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-lg border-2 border-leather-700 bg-leather-850 px-5 py-4">
        <span className="min-w-0 flex-1">
          <span className="font-display text-[14.5px] font-semibold text-parchment">
            Placement test
          </span>
          <span className="mt-0.5 block text-[13px] leading-relaxed text-ink-faint">
            {progress.diagnostic
              ? `Taken ${formatRelative(progress.diagnostic.at)} — ${progress.diagnostic.asked} questions. Not a score; it just tells the plan where to point you.`
              : 'Untimed, all four sections, no score at the end — it just tells the plan where to point you.'}
          </span>
        </span>
        <Button variant="ghost" onClick={() => navigate({ name: 'diagnostic' })}>
          {progress.diagnostic ? 'Take it again' : 'Take it'}
        </Button>
      </div>

      <h2 className="heading mb-4 text-[13px] text-parchment">Your results</h2>
      {history.length === 0 ? (
        <EmptyState
          art="chest"
          title="No tests yet"
          detail="A full-length test is the only honest way to know where you stand. Take one when you have cleared a few zones."
        />
      ) : (
        <div className="space-y-2.5">
          {history.map((result) => (
            <a
              key={result.id}
              href={hrefFor({ name: 'report', id: result.id })}
              onClick={() => sfx.select()}
              className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border-2 border-leather-700 bg-leather-850 px-5 py-4 shadow-card transition-colors hover:border-gold-deep"
            >
              <div className="min-w-0">
                <div className="font-script text-[12px] uppercase tracking-wide text-parchment">
                  {result.sections.length === 4 ? 'Full test' : soleSectionName(result.sections)}
                </div>
                <div className="mt-0.5 text-[13px] text-ink-faint">{formatRelative(result.at)}</div>
              </div>

              <div className="ml-auto flex items-center gap-5">
                {result.sections.map((id) => (
                  <div key={id} className="text-center">
                    <div className="font-script text-[9px] uppercase tracking-wide text-ink-faint">
                      {SECTION_BY_ID[id]?.name.slice(0, 3)}
                    </div>
                    <div className="num text-[19px]" style={{ color: SECTION_BY_ID[id]?.color }}>
                      {result.scores[id]}
                    </div>
                  </div>
                ))}
                <div className="border-l-2 border-leather-700 pl-5 text-center">
                  <div className="font-script text-[9px] uppercase tracking-wide text-ink-faint">
                    Comp
                  </div>
                  <div className="num text-[26px] text-gold">{result.composite}</div>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </Page>
  );
}

/* --------------------------------------------------------------- runner */

type Stage =
  | { kind: 'brief' }
  | { kind: 'section'; index: number }
  | { kind: 'break'; nextIndex: number }
  | { kind: 'done' };

export function TestRunner({ config }: { config: string }) {
  const navigate = useNavigate();
  const { finishTest } = useStore();
  const { prefs } = usePrefs();

  const sectionIds = useMemo<SectionId[]>(
    () =>
      config === 'full'
        ? (SECTIONS.map((s) => s.id) as SectionId[])
        : SECTIONS.some((s) => s.id === config)
          ? [config as SectionId]
          : [],
    [config],
  );

  const [stage, setStage] = useState<Stage>({ kind: 'brief' });
  const [answersBySection, setAnswersBySection] = useState<
    Partial<Record<SectionId, AnswerRecord[]>>
  >({});
  const [result, setResult] = useState<TestResult | null>(null);
  const startedAtRef = useRef<number>(Date.now());

  /* Per-section wall clock, for the pacing breakdown on the report.
     Refs rather than state: nothing renders from these until the test is
     over, so putting them in state would re-render at every section boundary
     to no visible effect. The break between sections is deliberately not
     counted — it is not time spent answering. */
  const sectionStartRef = useRef<number>(Date.now());
  const sectionSecRef = useRef<Partial<Record<SectionId, number>>>({});

  /* This one *is* state, because the pacing checkpoint renders from it. Reset
     at every section boundary alongside `sectionStartRef`. */
  const [answeredCount, setAnsweredCount] = useState(0);

  // Questions are drawn once, up front, so a re-render never reshuffles a
  // test that is already in progress.
  const questionsBySection = useMemo(() => {
    const out: Partial<Record<SectionId, ReturnType<typeof fromDrillQuestion>[]>> = {};
    for (const id of sectionIds) {
      const plan = TEST_PLAN[id];
      out[id] = shuffle(QUESTIONS[id]).slice(0, plan.questions).map(fromDrillQuestion);
    }
    return out;
  }, [sectionIds]);

  /* One number, read once, applied to every minute figure on this screen —
     the brief, the per-section rows, the break card and the clock itself.
     Quoting standard timing in the brief and then running a longer clock
     would be worse than not offering the accommodation at all. */
  const allowance = prefs.timeAllowance;

  const inProgress = stage.kind === 'section' || stage.kind === 'break';
  useConfirmExit(inProgress, 'Your test is still running. Leaving will lose your progress.');

  if (sectionIds.length === 0) {
    return (
      <Page>
        <EmptyState
          title="Unknown test"
          detail="Pick a test from the list."
          action={
            <Button variant="primary" onClick={() => navigate({ name: 'tests' })}>
              Back to tests
            </Button>
          }
        />
      </Page>
    );
  }

  /* Past the bail above the list is non-empty, and every index below is one
     this component set itself — but the index type cannot know either, and
     `SECTION_BY_ID[undefined]` is a crash reading `.name`, not a blank. One
     helper rather than eight assertions. */
  const sectionAt = (i: number): SectionId => sectionIds[i] ?? sectionIds[0]!;

  /* ------------------------------------------------------------- brief */

  if (stage.kind === 'brief') {
    const totalQuestions = sectionIds.reduce((n, id) => n + TEST_PLAN[id].questions, 0);
    const totalMinutes = sectionIds.reduce(
      (n, id) => n + withAllowance(TEST_PLAN[id].minutes, allowance),
      0,
    );

    return (
      <Page>
        <div className="mx-auto max-w-lg">
          <div className="panel p-7 text-center sm:p-9">
            <h1 className="heading text-[15px] text-blood-text">
              {sectionIds.length === 4
                ? 'Full practice test'
                : `${SECTION_BY_ID[sectionAt(0)].name} section`}
            </h1>

            <dl className="mt-7 space-y-2.5 text-left">
              {sectionIds.map((id) => (
                <div
                  key={id}
                  className="flex items-center justify-between rounded-lg border-2 border-leather-700 bg-leather-900 px-4 py-3"
                >
                  <dt
                    className="font-script text-[11px] uppercase tracking-wide"
                    style={{ color: SECTION_BY_ID[id].color }}
                  >
                    {SECTION_BY_ID[id].name}
                  </dt>
                  <dd className="num text-[17px] text-parchment">
                    {TEST_PLAN[id].questions} q · {withAllowance(TEST_PLAN[id].minutes, allowance)}{' '}
                    min
                  </dd>
                </div>
              ))}
            </dl>

            <p className="mt-6 text-[14px] leading-relaxed text-parchment-dim">
              {totalQuestions} questions, {totalMinutes} minutes. No explanations until you finish —
              that is the point. Unanswered questions count as wrong, so guess rather than leave
              blanks.
            </p>

            {allowance > 1 && (
              <p className="mt-3 text-[13px] leading-relaxed text-ink-faint">
                Running at {allowance === 1.5 ? 'time and a half' : 'double time'}, from your
                display settings. Turn it off there if you want to practise at standard timing.
              </p>
            )}

            <Button
              variant="danger"
              size="lg"
              className="mt-7 w-full"
              onClick={() => {
                startedAtRef.current = Date.now();
                sectionStartRef.current = Date.now();
                setAnsweredCount(0);
                sfx.warn();
                setStage({ kind: 'section', index: 0 });
              }}
            >
              Start — the clock runs ▶
            </Button>
            <Button
              variant="ghost"
              className="mt-3 w-full"
              onClick={() => navigate({ name: 'tests' })}
            >
              Not now
            </Button>
          </div>
        </div>
      </Page>
    );
  }

  /* ------------------------------------------------------------- break */

  if (stage.kind === 'break') {
    const nextId = sectionAt(stage.nextIndex);
    return (
      <Page>
        <div className="mx-auto max-w-md">
          <div className="panel p-7 text-center sm:p-9">
            <h1 className="heading text-[15px] text-gold">Break</h1>
            <p className="mt-5 text-[15px] leading-relaxed text-parchment-dim">
              Next up:{' '}
              <b style={{ color: SECTION_BY_ID[nextId].color }}>{SECTION_BY_ID[nextId].name}</b> —{' '}
              {TEST_PLAN[nextId].questions} questions in{' '}
              {withAllowance(TEST_PLAN[nextId].minutes, allowance)} minutes.
            </p>
            <p className="mt-3 text-[14px] text-ink-faint">The clock starts when you continue.</p>
            <Button
              variant="primary"
              size="lg"
              className="mt-7 w-full"
              onClick={() => {
                sectionStartRef.current = Date.now();
                setAnsweredCount(0);
                setStage({ kind: 'section', index: stage.nextIndex });
              }}
            >
              Continue ▶
            </Button>
          </div>
        </div>
      </Page>
    );
  }

  /* ------------------------------------------------------------- report */

  if (stage.kind === 'done') {
    if (!result) return null; // scoring writes `result` in the same tick as the stage
    const allRecords = sectionIds.flatMap((id) => answersBySection[id] ?? []);
    return <ScoreReport result={result} records={allRecords} />;
  }

  /* ------------------------------------------------------------ section */

  const stageIndex = stage.index;
  const sectionId = sectionAt(stageIndex);
  const plan = TEST_PLAN[sectionId];
  const questions = questionsBySection[sectionId] ?? [];

  const completeSection = (records: AnswerRecord[]) => {
    const nextAnswers = { ...answersBySection, [sectionId]: records };
    setAnswersBySection(nextAnswers);
    sectionSecRef.current[sectionId] = Math.round((Date.now() - sectionStartRef.current) / 1000);

    const isLastSection = stageIndex === sectionIds.length - 1;
    if (!isLastSection) {
      setStage({ kind: 'break', nextIndex: stageIndex + 1 });
      return;
    }

    // Score everything.
    const scores: Partial<Record<SectionId, number>> = {};
    const raw: Partial<Record<SectionId, [number, number]>> = {};
    for (const id of sectionIds) {
      const rs = nextAnswers[id] ?? [];
      const total = questionsBySection[id]?.length ?? rs.length;
      const correct = rs.filter((r) => r.correct).length;
      raw[id] = [correct, total];
      scores[id] = scaleScore(total ? correct / total : 0);
    }

    const testResult: TestResult = {
      id: `test-${Date.now()}`,
      at: Date.now(),
      scores,
      composite: compositeOf(scores),
      raw,
      durationSec: Math.round((Date.now() - startedAtRef.current) / 1000),
      sections: sectionIds,
      sectionSec: { ...sectionSecRef.current },
      allowance,
    };

    finishTest(testResult);
    setResult(testResult);
    setStage({ kind: 'done' });
    burstConfetti(130);
    sfx.fanfare();
  };

  return (
    <Page>
      {/* Both remount per section, so their keys must differ from each other. */}
      <SectionTimer
        key={`timer-${sectionId}`}
        minutes={withAllowance(plan.minutes, allowance)}
        color={SECTION_BY_ID[sectionId].color}
        answered={answeredCount}
        totalQuestions={questions.length}
        onExpire={() => {
          sfx.warn();
          completeSection(answersBySection[sectionId] ?? []);
        }}
      />
      <QuestionRunner
        key={`runner-${sectionId}`}
        questions={questions}
        title={`${SECTION_BY_ID[sectionId].name} section`}
        subtitle={`Section ${stageIndex + 1} of ${sectionIds.length}`}
        accent={SECTION_BY_ID[sectionId].color}
        deferFeedback
        onAnswer={() => {
          /* Test answers are scored at the end, not recorded as drill
             attempts — otherwise a test would skew topic accuracy twice. The
             count is all the pacing checkpoint needs. */
          setAnsweredCount((n) => n + 1);
        }}
        onFinish={completeSection}
      />
    </Page>
  );
}

/* ---------------------------------------------------------------- timer */

function SectionTimer({
  minutes,
  color,
  onExpire,
  answered,
  totalQuestions,
}: {
  minutes: number;
  color: string;
  onExpire: () => void;
  /** Questions answered so far, for the mid-section pacing checkpoint. */
  answered: number;
  totalQuestions: number;
}) {
  // Deadline, not a countdown — a suspended tab cannot gain time.
  const deadlineRef = useRef(Date.now() + minutes * 60_000);
  const [remaining, setRemaining] = useState(minutes * 60);
  const firedRef = useRef(false);
  const warnedRef = useRef(false);

  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000));
      setRemaining(left);

      if (left === 300 && !warnedRef.current) {
        warnedRef.current = true;
        sfx.warn();
      }
      if (left <= 0 && !firedRef.current) {
        firedRef.current = true;
        onExpire();
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [onExpire]);

  const urgent = remaining <= 300;
  const critical = remaining <= 60;

  const total = minutes * 60;
  const hint = paceHint(answered, total > 0 ? totalQuestions : 0, (total - remaining) / total);

  return (
    <div
      className={cx(
        'sticky top-16 z-40 mb-4 rounded-lg border-2 px-5 py-3 backdrop-blur',
        critical
          ? 'border-blood bg-blood/15'
          : urgent
            ? 'border-gold bg-leather-850/95'
            : 'border-leather-700 bg-leather-850/95',
      )}
      role="timer"
      aria-live="off"
    >
      <div className="flex items-center gap-4">
        <span className="font-script text-[10px] uppercase tracking-[0.16em] text-ink-faint">
          Time remaining
        </span>
        <span
          className={cx('num ml-auto text-[26px] leading-none', critical && 'animate-shimmer')}
          style={{ color: critical ? '#ff5d78' : urgent ? '#ffd23e' : color }}
        >
          {formatClock(remaining)}
        </span>
      </div>
      {/* Polite, not assertive: this must never cut across the reveal a
          screen reader is already announcing. */}
      <div aria-live="polite" className="sr-only">
        {hint ?? ''}
      </div>
      {hint && (
        <div
          aria-hidden
          className="mt-1.5 border-t border-leather-700/70 pt-1.5 text-right text-[12px] text-gold/80"
        >
          {hint}
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- report */

const PACE_TINT: Record<Pacing['verdict'], string> = {
  comfortable: '#5ee6a8',
  tight: '#ffd23e',
  over: '#ff8298',
};

/* Deliberately phrased as time, not as a grade. "Over" tells a student they
   failed; "12s over per question" tells them what to change. */
function paceLabel(p: Pacing): string {
  const d = Math.round(Math.abs(p.overBy));
  if (p.verdict === 'comfortable') return `${d}s per question in hand`;
  if (p.verdict === 'tight')
    return d === 0
      ? 'right on the budget'
      : `${d}s ${p.overBy > 0 ? 'over' : 'under'}, about right`;
  return `${d}s over per question`;
}

export function ScoreReport({ result, records }: { result: TestResult; records?: AnswerRecord[] }) {
  const navigate = useNavigate();
  const { progress } = useStore();
  const [showMissed, setShowMissed] = useState(false);

  /* Topic breakdown from this test only. */
  const byTopic = useMemo(() => {
    if (!records?.length) return [];
    const buckets = new Map<string, { n: number; ok: number }>();
    for (const r of records) {
      const b = buckets.get(r.question.topic) ?? { n: 0, ok: 0 };
      b.n += 1;
      if (r.correct) b.ok += 1;
      buckets.set(r.question.topic, b);
    }
    return [...buckets.entries()]
      .map(([topic, b]) => ({ topic, ...b, accuracy: b.ok / b.n }))
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 6);
  }, [records]);

  const missed = records?.filter((r) => !r.correct) ?? [];
  const target = progress.targetScore;
  const gap = target - result.composite;

  /* Percentile, on a full test only.
   *
   * `progress.ts` sets the rule and this is the code that has to keep it: a
   * composite drawn from one section is not a composite, and hanging a
   * national rank off twenty English questions would be the most confident
   * lie the app tells. Four sections or nothing. */
  const percentile = result.sections.length === 4 ? percentileFor(result.composite) : null;

  /* Pacing, per section, against the real ACT clock rather than this app's
   * shortened one — see SECONDS_PER_QUESTION. Only tests recorded after
   * per-section timing existed have `sectionSec`; older ones have a single
   * total that cannot be split back apart, so they simply show nothing. */
  const pacing = useMemo(() => {
    const secs = result.sectionSec;
    if (!secs) return [];
    const rows: { id: SectionId; seconds: number; questions: number; p: Pacing }[] = [];
    for (const id of result.sections) {
      const seconds = secs[id];
      const questions = result.raw[id]?.[1] ?? 0;
      if (typeof seconds !== 'number' || questions <= 0) continue;
      const p = pacingFor(id, seconds, questions, result.allowance ?? 1);
      if (p) rows.push({ id, seconds, questions, p });
    }
    return rows;
  }, [result]);

  if (showMissed && missed.length > 0) {
    return (
      <DrillSummary
        results={missed}
        accent="#ff5d78"
        onRetry={() => setShowMissed(false)}
        onDone={() => navigate({ name: 'tests' })}
      />
    );
  }

  return (
    <Page>
      <div className="mx-auto max-w-3xl">
        <div className="rounded-xl border-2 border-gold bg-leather-850 p-7 text-center shadow-card sm:p-9">
          <div className="font-script text-[11px] uppercase tracking-[0.16em] text-ink-faint">
            {result.sections.length === 4
              ? 'Full test'
              : `${soleSectionName(result.sections)} section`}{' '}
            · {formatRelative(result.at)}
          </div>

          <div className="num mt-5 text-[80px] leading-none text-gold">{result.composite}</div>
          <p className="mt-1 font-script text-[12px] uppercase tracking-wide text-ink-faint">
            Composite
          </p>
          <ScoreCaveat kind="test" className="mx-auto mt-2.5 max-w-sm" />

          {percentile !== null && (
            <p className="mx-auto mt-3 max-w-sm text-[13px] leading-relaxed text-parchment-dim">
              That is <span className="text-gold">about the {percentileInWords(percentile)}</span>
              <span className="text-ink-faint">
                {' '}
                — roughly {percentile} out of 100 test-takers score at or below {result.composite}.
              </span>
              <span className="mt-1 block text-[11px] text-ink-faint">
                Approximate, from ACT's published national ranks. A practice test is not the real
                thing.
              </span>
            </p>
          )}

          <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-parchment-dim">
            {gap <= 0
              ? `You are at or above your ${target} target. Keep the streak going and lock it in.`
              : `${gap} point${gap === 1 ? '' : 's'} from your ${target} target. The topics below are where they are hiding.`}
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {result.sections.map((id) => {
              const meta = SECTION_BY_ID[id];
              const [correct, total] = result.raw[id] ?? [0, 0];
              return (
                <div
                  key={id}
                  className="rounded-lg border-2 border-leather-700 bg-leather-900 px-4 py-4"
                >
                  <div
                    className="font-script text-[10px] uppercase tracking-wide"
                    style={{ color: meta.color }}
                  >
                    {meta.name}
                  </div>
                  <div className="num mt-2 text-[34px] leading-none text-parchment">
                    {result.scores[id]}
                  </div>
                  <div className="mt-1.5 text-[12px] text-ink-faint">
                    {correct}/{total} correct
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {pacing.length > 0 && (
          <div className="mt-6">
            <h2 className="heading mb-1.5 text-[13px] text-parchment">How your clock ran</h2>
            <p className="mb-4 text-[12px] leading-relaxed text-ink-faint">
              Seconds per question, against the real ACT&rsquo;s budget for that section
              {(result.allowance ?? 1) > 1 &&
                ` at ${result.allowance === 1.5 ? 'time and a half' : 'double time'}`}
              . Sections here are shorter than the real thing, so the pace is what matters, not the
              total.
            </p>
            <div className="space-y-2.5">
              {pacing.map(({ id, p }) => {
                const meta = SECTION_BY_ID[id];
                const tint = PACE_TINT[p.verdict];
                return (
                  <div
                    key={id}
                    className="flex items-center gap-4 rounded-lg border-2 border-leather-700 bg-leather-850 px-5 py-3.5"
                  >
                    <span
                      className="w-24 flex-none font-sans text-[14px] font-semibold"
                      style={{ color: meta.color }}
                    >
                      {meta.name}
                    </span>
                    <span className="num flex-none text-[17px] text-parchment">
                      {Math.round(p.actual)}s
                    </span>
                    <span className="flex-none text-[12px] text-ink-faint">
                      of {Math.round(p.budget)}s
                    </span>
                    <span
                      className="ml-auto flex-none text-right text-[13px] font-semibold"
                      style={{ color: tint }}
                    >
                      {paceLabel(p)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {byTopic.length > 0 && (
          <div className="mt-6">
            <h2 className="heading mb-4 text-[13px] text-parchment">Where the points went</h2>
            <div className="space-y-2.5">
              {byTopic.map((t) => (
                <div
                  key={t.topic}
                  className="flex items-center gap-4 rounded-lg border-2 border-leather-700 bg-leather-850 px-5 py-3.5"
                >
                  <span className="w-40 flex-none truncate font-sans text-[14px] font-semibold text-parchment">
                    {titleCase(t.topic)}
                  </span>
                  <ProgressBar
                    value={t.accuracy}
                    color={t.accuracy < 0.5 ? '#ff8298' : t.accuracy < 0.75 ? '#ffd23e' : '#5ee6a8'}
                    height={8}
                  />
                  <span className="num w-16 flex-none text-right text-[17px] text-parchment-dim">
                    {t.ok}/{t.n}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {missed.length > 0 && (
            <Button variant="ghost" onClick={() => setShowMissed(true)}>
              Review {missed.length} missed
            </Button>
          )}
          <Button variant="ghost" onClick={() => navigate({ name: 'drills' })}>
            Drill weak topics
          </Button>
          <Button variant="primary" onClick={() => navigate({ name: 'tests' })}>
            Done
          </Button>
        </div>
      </div>
    </Page>
  );
}

/** Standalone report route, for opening a past result from the list. */
export function ReportScreen({ id }: { id: string }) {
  const { progress } = useStore();
  const navigate = useNavigate();
  const result = progress.testHistory.find((t) => t.id === id);

  if (!result) {
    return (
      <Page>
        <EmptyState
          title="Report not found"
          detail="That test result is not saved on this device."
          action={
            <Button variant="primary" onClick={() => navigate({ name: 'tests' })}>
              Back to tests
            </Button>
          }
        />
      </Page>
    );
  }
  return <ScoreReport result={result} />;
}
