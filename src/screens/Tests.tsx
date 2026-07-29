/* Full-length practice tests.

   Real section timing, no feedback until the end, and a score report that
   points at the topics worth fixing. Timing is derived from a wall-clock
   deadline rather than a decrementing counter, so a backgrounded tab does
   not hand out free minutes. */

import { useEffect, useMemo, useRef, useState } from 'react';
import { QUESTIONS, SECTIONS, SECTION_BY_ID } from '@/content';
import { hrefFor, useConfirmExit, useNavigate } from '@/lib/router';
import { useStore } from '@/lib/store';
import { fromDrillQuestion } from '@/lib/normalize';
import { compositeOf, scaleScore } from '@/lib/progress';
import { sfx } from '@/lib/sfx';
import { cx, formatClock, formatRelative, shuffle, titleCase } from '@/lib/utils';
import type { SectionId, TestResult } from '@/types';
import { Page } from '@/components/Shell';
import { Button, EmptyState, ProgressBar, SectionHeading } from '@/components/ui';
import { QuestionRunner, type AnswerRecord } from '@/components/QuestionRunner';
import { burstConfetti } from '@/components/Feedback';
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

/* ---------------------------------------------------------------- setup */

export function TestsScreen() {
  const navigate = useNavigate();
  const { progress } = useStore();
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
          <h2 className="heading text-[13px] text-blood">Full test</h2>
          <p className="mt-2.5 text-[14px] leading-relaxed text-parchment-dim">
            All four sections back to back, with a break between each.
          </p>
          <p className="mt-4 font-script text-[10px] uppercase tracking-wide text-ink-faint">
            {Object.values(TEST_PLAN).reduce((n, p) => n + p.questions, 0)} questions ·{' '}
            {Object.values(TEST_PLAN).reduce((n, p) => n + p.minutes, 0)} minutes
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
          <h2 className="heading text-[13px] text-white">Single section</h2>
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
                <span className="text-ink-faint">{TEST_PLAN[s.id].minutes}m</span>
              </Button>
            ))}
          </div>
        </div>
      </div>

      <h2 className="heading mb-4 text-[13px] text-white">Your results</h2>
      {history.length === 0 ? (
        <EmptyState
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
                <div className="font-script text-[12px] uppercase tracking-wide text-white">
                  {result.sections.length === 4 ? 'Full test' : SECTION_BY_ID[result.sections[0]]?.name}
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
                  <div className="font-script text-[9px] uppercase tracking-wide text-ink-faint">Comp</div>
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
  const [answersBySection, setAnswersBySection] = useState<Partial<Record<SectionId, AnswerRecord[]>>>({});
  const [result, setResult] = useState<TestResult | null>(null);
  const startedAtRef = useRef<number>(Date.now());

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

  const inProgress = stage.kind === 'section' || stage.kind === 'break';
  useConfirmExit(inProgress, 'Your test is still running. Leaving will lose your progress.');

  if (sectionIds.length === 0) {
    return (
      <Page>
        <EmptyState
          title="Unknown test"
          detail="Pick a test from the list."
          action={<Button variant="primary" onClick={() => navigate({ name: 'tests' })}>Back to tests</Button>}
        />
      </Page>
    );
  }

  /* ------------------------------------------------------------- brief */

  if (stage.kind === 'brief') {
    const totalQuestions = sectionIds.reduce((n, id) => n + TEST_PLAN[id].questions, 0);
    const totalMinutes = sectionIds.reduce((n, id) => n + TEST_PLAN[id].minutes, 0);

    return (
      <Page>
        <div className="mx-auto max-w-lg">
          <div className="panel p-7 text-center sm:p-9">
            <h1 className="heading text-[15px] text-blood">
              {sectionIds.length === 4 ? 'Full practice test' : `${SECTION_BY_ID[sectionIds[0]].name} section`}
            </h1>

            <dl className="mt-7 space-y-2.5 text-left">
              {sectionIds.map((id) => (
                <div
                  key={id}
                  className="flex items-center justify-between rounded-lg border-2 border-leather-700 bg-leather-900 px-4 py-3"
                >
                  <dt className="font-script text-[11px] uppercase tracking-wide" style={{ color: SECTION_BY_ID[id].color }}>
                    {SECTION_BY_ID[id].name}
                  </dt>
                  <dd className="num text-[17px] text-white">
                    {TEST_PLAN[id].questions} q · {TEST_PLAN[id].minutes} min
                  </dd>
                </div>
              ))}
            </dl>

            <p className="mt-6 text-[14px] leading-relaxed text-parchment-dim">
              {totalQuestions} questions, {totalMinutes} minutes. No explanations until you finish — that is
              the point. Unanswered questions count as wrong, so guess rather than leave blanks.
            </p>

            <Button
              variant="danger"
              size="lg"
              className="mt-7 w-full"
              onClick={() => {
                startedAtRef.current = Date.now();
                sfx.warn();
                setStage({ kind: 'section', index: 0 });
              }}
            >
              Start — the clock runs ▶
            </Button>
            <Button variant="ghost" className="mt-3 w-full" onClick={() => navigate({ name: 'tests' })}>
              Not now
            </Button>
          </div>
        </div>
      </Page>
    );
  }

  /* ------------------------------------------------------------- break */

  if (stage.kind === 'break') {
    const nextId = sectionIds[stage.nextIndex];
    return (
      <Page>
        <div className="mx-auto max-w-md">
          <div className="panel p-7 text-center sm:p-9">
            <h1 className="heading text-[15px] text-gold">Break</h1>
            <p className="mt-5 text-[15px] leading-relaxed text-parchment-dim">
              Next up: <b style={{ color: SECTION_BY_ID[nextId].color }}>{SECTION_BY_ID[nextId].name}</b> —{' '}
              {TEST_PLAN[nextId].questions} questions in {TEST_PLAN[nextId].minutes} minutes.
            </p>
            <p className="mt-3 text-[14px] text-ink-faint">The clock starts when you continue.</p>
            <Button
              variant="primary"
              size="lg"
              className="mt-7 w-full"
              onClick={() => setStage({ kind: 'section', index: stage.nextIndex })}
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
  const sectionId = sectionIds[stageIndex];
  const plan = TEST_PLAN[sectionId];
  const questions = questionsBySection[sectionId] ?? [];

  const completeSection = (records: AnswerRecord[]) => {
    const nextAnswers = { ...answersBySection, [sectionId]: records };
    setAnswersBySection(nextAnswers);

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
        minutes={plan.minutes}
        color={SECTION_BY_ID[sectionId].color}
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
             attempts — otherwise a test would skew topic accuracy twice. */
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
}: {
  minutes: number;
  color: string;
  onExpire: () => void;
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

  return (
    <div
      className={cx(
        'sticky top-16 z-40 mb-4 flex items-center gap-4 rounded-lg border-2 px-5 py-3 backdrop-blur',
        critical ? 'border-blood bg-blood/15' : urgent ? 'border-gold bg-leather-850/95' : 'border-leather-700 bg-leather-850/95',
      )}
      role="timer"
      aria-live="off"
    >
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
  );
}

/* --------------------------------------------------------------- report */

export function ScoreReport({
  result,
  records,
}: {
  result: TestResult;
  records?: AnswerRecord[];
}) {
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
            {result.sections.length === 4 ? 'Full test' : `${SECTION_BY_ID[result.sections[0]].name} section`} ·{' '}
            {formatRelative(result.at)}
          </div>

          <div className="num mt-5 text-[80px] leading-none text-gold">{result.composite}</div>
          <p className="mt-1 font-script text-[12px] uppercase tracking-wide text-ink-faint">
            Composite
          </p>

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
                <div key={id} className="rounded-lg border-2 border-leather-700 bg-leather-900 px-4 py-4">
                  <div className="font-script text-[10px] uppercase tracking-wide" style={{ color: meta.color }}>
                    {meta.name}
                  </div>
                  <div className="num mt-2 text-[34px] leading-none text-white">{result.scores[id]}</div>
                  <div className="mt-1.5 text-[12px] text-ink-faint">
                    {correct}/{total} correct
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {byTopic.length > 0 && (
          <div className="mt-6">
            <h2 className="heading mb-4 text-[13px] text-white">Where the points went</h2>
            <div className="space-y-2.5">
              {byTopic.map((t) => (
                <div
                  key={t.topic}
                  className="flex items-center gap-4 rounded-lg border-2 border-leather-700 bg-leather-850 px-5 py-3.5"
                >
                  <span className="w-40 flex-none truncate font-sans text-[14px] font-semibold text-white">
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
          action={<Button variant="primary" onClick={() => navigate({ name: 'tests' })}>Back to tests</Button>}
        />
      </Page>
    );
  }
  return <ScoreReport result={result} />;
}
