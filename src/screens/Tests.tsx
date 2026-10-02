/* Full-length practice tests.

   Real section timing, no feedback until the end, and a score report that
   points at the topics worth fixing. Timing is derived from a wall-clock
   deadline rather than a decrementing counter, so a backgrounded tab does
   not hand out free minutes. */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getQuestion,
  locateQuestion,
  questionsFor,
  SECTIONS,
  SECTION_BY_ID,
  useContent,
} from '@/content';
import { hrefFor, useConfirmExit, useNavigate } from '@/lib/router';
import { useStore } from '@/lib/store';
import { usePrefs } from '@/lib/prefs';
import { TEST_PLAN, withAllowance } from '@/lib/testPlan';
import {
  addTime,
  clearSession,
  createSession,
  currentSection,
  isExpired,
  loadSession,
  moveTo,
  recordsFor,
  remainingSec,
  saveSession,
  sectionLimitMs,
  selectAnswer,
  startNextSection,
  submitSection,
  toggleFlag,
  type TestSession as TestSessionState,
} from '@/lib/testSession';

/* Four letters at most, and Math is only four. `.slice(0, 3)` made it "MAT". */
const SECTION_ABBR: Record<SectionId, string> = {
  english: 'Eng',
  math: 'Math',
  reading: 'Read',
  science: 'Sci',
};
import { fromDrillQuestion } from '@/lib/normalize';
import {
  compositeOf,
  pacingFor,
  percentileFor,
  percentileInWords,
  scaleScore,
  type Pacing,
} from '@/lib/progress';
import { sfx } from '@/lib/sfx';
import { formatClock, formatRelative, shuffle, titleCase } from '@/lib/utils';
import type { SectionId, TestResult } from '@/types';
import { Page } from '@/components/Shell';
import { Button, EmptyState, ProgressBar, SectionHeading } from '@/components/ui';
import type { AnswerRecord, RunnableQuestion } from '@/components/QuestionRunner';
import { ConfirmDialog, TestSectionView } from '@/components/TestSectionView';
import { burstConfetti } from '@/components/Feedback';
import { ScoreCaveat } from '@/components/ScoreCaveat';
import { MissedReview } from '@/components/MissedReview';

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

/* The Summit is Pro whole. Note that `ReportScreen` below is deliberately
   *not* gated: a score report is a record of a test the person already sat,
   and taking away someone's own results when a trial lapses is a different
   thing from not selling them a new test. */
export function TestsScreen() {
  return <TestsBoard />;
}

function TestsBoard() {
  const navigate = useNavigate();
  const { progress } = useStore();
  const { prefs } = usePrefs();
  const allowance = prefs.timeAllowance;
  const history = [...progress.testHistory].reverse();

  return (
    <Page>
      <SectionHeading
        eyebrow="Challenges"
        title="Timed practice"
        detail="Shortened practice sets, not full-length ACT simulations. Explanations and an estimated score appear when you finish."
      />

      <ResumeCard />

      <div className="mb-6 grid gap-3 lg:grid-cols-2">
        <div className="panel border-blood p-6 sm:p-7" style={{ borderTopWidth: 4 }}>
          <h2 className="heading text-[1.125rem] text-blood-text">Four-section practice</h2>
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
            trailing
            className="mt-5 w-full"
            onClick={() => navigate({ name: 'test', config: 'full' })}
          >
            Begin timed practice
          </Button>
        </div>

        <div className="panel p-6 sm:p-7">
          <h2 className="heading text-[1.125rem] text-parchment">Single section</h2>
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
      <div className="panel-quiet mb-6 flex flex-wrap items-center gap-4 p-6 sm:p-7">
        <span className="min-w-0 flex-[1_1_16rem]">
          <h2 className="heading text-[1.125rem] text-parchment">Placement test</h2>
          <span className="mt-2 block text-[14px] leading-relaxed text-parchment-dim">
            {progress.diagnostic
              ? `Taken ${formatRelative(progress.diagnostic.at)} — ${progress.diagnostic.asked} questions. Not a score; it just tells the plan where to point you.`
              : 'Untimed, all four sections, a rough placement per section rather than a score — it tells the plan where to point you.'}
          </span>
        </span>
        <Button variant="ghost" onClick={() => navigate({ name: 'diagnostic' })}>
          {progress.diagnostic ? 'Take it again' : 'Take it'}
        </Button>
      </div>

      <h2 className="heading mb-4 text-[1.125rem] text-parchment">Your results</h2>
      {history.length === 0 ? (
        <EmptyState
          art="chest"
          title="No tests yet"
          detail="Try a timed set when you are ready. Your report will show which topics need more practice."
        />
      ) : (
        <div className="space-y-2.5">
          {history.map((result) => (
            <a
              key={result.id}
              href={hrefFor({ name: 'report', id: result.id })}
              onClick={() => sfx.select()}
              className="panel-quiet flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 transition-colors hover:border-gold-deep"
            >
              <div className="min-w-0">
                <div className="font-script text-[12px] uppercase tracking-wide text-parchment">
                  {result.sections.length === 4
                    ? 'Four-section practice'
                    : soleSectionName(result.sections)}
                </div>
                <div className="mt-0.5 text-[13px] text-ink-faint">{formatRelative(result.at)}</div>
              </div>

              <div className="ml-auto flex items-center gap-5">
                {result.sections.map((id) => (
                  <div key={id} className="text-center">
                    <div className="font-script text-[9px] uppercase tracking-wide text-ink-faint">
                      {SECTION_ABBR[id]}
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

/* A saved attempt, offered back.

   Read once when the board mounts. The clock line ticks, because "12:04
   left" that does not move reads as paused, and the whole point of telling
   someone the clock kept running is that it is still running now. */
function ResumeCard() {
  const navigate = useNavigate();
  const [saved, setSaved] = useState(() => loadSession(Date.now(), questionExists));
  const [now, setNow] = useState(() => Date.now());
  const [discarding, setDiscarding] = useState(false);

  useEffect(() => {
    if (!saved || saved.stage.kind !== 'section') return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [saved]);

  if (!saved) return null;

  const total = saved.sections.length;
  let status: string;
  if (saved.stage.kind === 'break') {
    const next = saved.sections[saved.stage.nextIndex];
    status = `On the break before ${next ? SECTION_BY_ID[next].name : 'the next section'}. No clock is running.`;
  } else {
    const id = currentSection(saved);
    const name = id ? SECTION_BY_ID[id].name : 'This section';
    const where = total > 1 ? `${name}, section ${saved.stage.index + 1} of ${total}` : name;
    status = isExpired(saved, now)
      ? `Time ran out on ${name}. Resume to submit it${saved.stage.index < total - 1 ? ' and carry on' : ' and see your score'}.`
      : `${where} · ${formatClock(remainingSec(saved, now))} left`;
  }

  return (
    <div className="panel mb-6 flex flex-wrap items-center gap-4 border-gold p-5 sm:p-6">
      <div className="min-w-0 flex-[1_1_16rem]">
        <h2 className="heading text-[1.05rem] text-gold">Resume: {testName(saved.sections)}</h2>
        <p className="mt-1.5 text-[14px] leading-relaxed text-parchment-dim">{status}</p>
      </div>
      <div className="flex w-full gap-2.5 sm:w-auto">
        <Button
          variant="ghost"
          className="min-h-11 flex-1 sm:flex-none"
          onClick={() => setDiscarding(true)}
        >
          Discard
        </Button>
        <Button
          variant="primary"
          trailing
          className="min-h-11 flex-1 sm:flex-none"
          onClick={() => navigate({ name: 'test', config: saved.config })}
        >
          Resume
        </Button>
      </div>
      {discarding && (
        <ConfirmDialog
          title="Discard this test?"
          body="Your answers so far will be deleted and nothing will be scored. This cannot be undone."
          confirmLabel="Discard test"
          cancelLabel="Keep it"
          onConfirm={() => {
            clearSession();
            setDiscarding(false);
            setSaved(null);
          }}
          onCancel={() => setDiscarding(false)}
        />
      )}
    </div>
  );
}

/* --------------------------------------------------------------- runner */

/* The attempt itself lives in a `TestSession` (see lib/testSession.ts), which
   is written to storage on every change. What stays in React is only what
   cannot outlive the page anyway: which screen is showing, and the result
   once it exists. */
type Phase = 'brief' | 'active' | 'done';

export function TestRunner({ config }: { config: string }) {
  return <TestSession config={config} />;
}

/** True for an id the library still has. Needs nothing loaded. */
const questionExists = (qid: string) => !!locateQuestion(qid);

function testName(sections: SectionId[]): string {
  return sections.length === 4 ? 'Four-section practice' : `${soleSectionName(sections)} section`;
}

function TestSession({ config }: { config: string }) {
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
  /* Before any state or clock below, so suspending discards nothing. */
  useContent({ sections: sectionIds });

  /* A saved attempt at this same test is picked straight back up: this is
     the path a reload, a discarded background tab and the Resume button all
     arrive by. One for a *different* test is left alone and mentioned on the
     brief, since starting this one will replace it. */
  const [saved] = useState(() => loadSession(Date.now(), questionExists));
  const [session, setSession] = useState<TestSessionState | null>(() =>
    saved && saved.config === config && sectionIds.length > 0 ? saved : null,
  );
  const [phase, setPhase] = useState<Phase>(() => (session ? 'active' : 'brief'));
  /* A line explaining a resume, tagged with the screen it belongs on: the
     "welcome back" note means nothing on the break that follows it, and the
     "time ran out" note is only true once that section has been handed in. */
  const [notice, setNotice] = useState<{ text: string; on: 'section' | 'break' } | null>(() => {
    if (!session) return null;
    if (isExpired(session, Date.now())) {
      const id = currentSection(session);
      return {
        on: 'break',
        text: `Time ran out on ${id ? SECTION_BY_ID[id].name : 'that section'} while you were away, so it was submitted with the answers you had marked.`,
      };
    }
    return session.stage.kind === 'section'
      ? {
          on: 'section',
          text: 'Welcome back. Your answers are as you left them; the section clock kept running while you were away.',
        }
      : null;
  });
  const [result, setResult] = useState<TestResult | null>(null);
  const [records, setRecords] = useState<AnswerRecord[]>([]);
  const [leaving, setLeaving] = useState(false);

  /* The latest session, readable from the timer's callback and from the
     handlers below without waiting for a render. Every change goes through
     `commit`, so the ref and the state can never disagree. */
  const sessionRef = useRef(session);
  const commit = (next: TestSessionState | null) => {
    sessionRef.current = next;
    setSession(next);
  };
  const edit = (fn: (s: TestSessionState) => TestSessionState) => {
    const cur = sessionRef.current;
    if (cur) commit(fn(cur));
  };
  /** Sections already finished in this page's lifetime, so the timer and the
   *  Submit button landing together cannot double-record. The saved session
   *  carries the same guard across reloads in `submitted`. */
  const completedRef = useRef<Set<number>>(new Set());

  /* Every change is saved, so a reload costs nothing but the second it took.
     Not once the result is recorded: `finish` clears the save in the same
     tick it sets the phase, and this must not write it back. */
  useEffect(() => {
    if (phase === 'active' && session) saveSession(session, Date.now());
  }, [phase, session]);

  /* The questions, rebuilt from the session's ids so a resume restores the
     exact test rather than a fresh draw. For the brief, drawn once up front
     so a re-render never reshuffles. */
  const drawnIds = useMemo(() => {
    const out: Partial<Record<SectionId, string[]>> = {};
    for (const id of sectionIds) {
      out[id] = shuffle(questionsFor(id).filter((q) => !q.practiceOnly))
        .slice(0, TEST_PLAN[id].questions)
        .map((q) => q.id);
    }
    return out;
  }, [sectionIds]);
  const questionIds = session?.questionIds ?? drawnIds;
  const questionsBySection = useMemo(() => {
    const out: Partial<Record<SectionId, RunnableQuestion[]>> = {};
    for (const id of sectionIds) {
      out[id] = (questionIds[id] ?? []).flatMap((qid) => {
        const q = getQuestion(qid);
        return q ? [fromDrillQuestion(q)] : [];
      });
    }
    return out;
  }, [sectionIds, questionIds]);

  /* Time spent looking at each question, charged when you move off it. Kept
     in a ref rather than charged per second, which would rewrite storage
     every second for a number only the report reads. */
  const viewRef = useRef<{ qid: string; since: number } | null>(null);
  const flushView = () => {
    const v = viewRef.current;
    if (!v) return;
    viewRef.current = null;
    edit((s) => addTime(s, v.qid, Date.now() - v.since));
  };
  const activeSection = session ? currentSection(session) : null;
  const cursor = activeSection ? (session?.progress[activeSection]?.cursor ?? 0) : 0;
  const viewing =
    phase === 'active' && activeSection
      ? questionsBySection[activeSection]?.[cursor]?.id
      : undefined;
  useEffect(() => {
    if (!viewing) return;
    viewRef.current = { qid: viewing, since: Date.now() };
    return flushView;
    // `flushView` reads only refs; re-subscribing on its identity would charge time twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewing]);

  /* One number, read once, applied to every minute figure on this screen —
     the brief, the per-section rows, the break card and the clock itself.
     Quoting standard timing in the brief and then running a longer clock
     would be worse than not offering the accommodation at all. A resumed
     test keeps the allowance it was started with. */
  const allowance = session?.allowance ?? prefs.timeAllowance;

  const inProgress = phase === 'active' && !leaving;
  useConfirmExit(
    inProgress,
    'Your test is saved and the section clock keeps running. You can resume it from Timed practice within 24 hours.',
  );
  /* Exit is confirmed in the test's own dialog. Navigating only after the
     guard above has let go means the browser does not ask a second time. */
  useEffect(() => {
    if (leaving) navigate({ name: 'tests' });
  }, [leaving, navigate]);

  if (sectionIds.length === 0) {
    return (
      <Page>
        <EmptyState
          title="Unknown test"
          detail="Pick a test from the list."
          action={
            <Button variant="primary" onClick={() => navigate({ name: 'tests' })}>
              Back to Timed practice
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

  /* Score the whole test and record it. Runs at most once per attempt: it is
     reached only from a submit that `submitSection` accepted for the last
     section, and the saved session is cleared before anything can re-render. */
  const finish = (final: TestSessionState) => {
    const scores: Partial<Record<SectionId, number>> = {};
    const raw: Partial<Record<SectionId, [number, number]>> = {};
    const answered: Partial<Record<SectionId, number>> = {};
    const all: AnswerRecord[] = [];
    for (const id of final.sections) {
      const rs = recordsFor(questionsBySection[id] ?? [], final.progress[id]);
      all.push(...rs);
      const correct = rs.filter((r) => r.correct).length;
      raw[id] = [correct, rs.length];
      answered[id] = rs.filter((r) => r.chosen !== null).length;
      scores[id] = scaleScore(rs.length ? correct / rs.length : 0);
    }

    const testResult: TestResult = {
      /* From the attempt's start, not from now, so the same attempt can only
         ever produce one id however it reaches this line. */
      id: `test-${final.startedAt}`,
      at: Date.now(),
      scores,
      composite: compositeOf(scores),
      raw,
      answered,
      /* Time spent answering, summed. Wall time since the start would count
         the breaks — and, now that a test can be resumed, a night's sleep. */
      durationSec: Object.values(final.sectionSec).reduce((n, s) => n + (s ?? 0), 0),
      sections: final.sections,
      sectionSec: { ...final.sectionSec },
      allowance: final.allowance,
    };

    clearSession();
    finishTest(testResult);
    setRecords(all);
    setResult(testResult);
    setPhase('done');
    burstConfetti(130);
    sfx.fanfare();
  };

  const submitCurrent = () => {
    const cur = sessionRef.current;
    if (!cur || cur.stage.kind !== 'section') return;
    const index = cur.stage.index;
    if (completedRef.current.has(index)) return;
    flushView();
    const {
      session: next,
      accepted,
      finished,
    } = submitSection(sessionRef.current ?? cur, Date.now());
    if (!accepted) return;
    completedRef.current.add(index);
    setNotice((n) => (n?.on === 'section' ? null : n));
    commit(next);
    if (finished) finish(next);
    else window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  /* ------------------------------------------------------------- brief */

  if (phase === 'brief') {
    const totalQuestions = sectionIds.reduce((n, id) => n + TEST_PLAN[id].questions, 0);
    const totalMinutes = sectionIds.reduce(
      (n, id) => n + withAllowance(TEST_PLAN[id].minutes, allowance),
      0,
    );
    const replacing = saved && saved.config !== config ? saved : null;

    return (
      <Page>
        <div className="mx-auto max-w-lg">
          <div className="panel p-7 text-center sm:p-9">
            <h1 className="heading text-[15px] text-blood-text">{testName(sectionIds)}</h1>

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
              that is the point. Within a section you can move between questions, flag them and
              change answers until you submit it. Unanswered questions count as wrong, so guess
              rather than leave blanks.
            </p>

            {allowance > 1 && (
              <p className="mt-3 text-[13px] leading-relaxed text-ink-faint">
                Running at {allowance === 1.5 ? 'time and a half' : 'double time'}, from your
                display settings. Turn it off there if you want to practise at standard timing.
              </p>
            )}

            {replacing && (
              <p className="mt-3 text-[13px] leading-relaxed text-gold">
                You have a {testName(replacing.sections).toLowerCase()} test in progress. Starting
                this one replaces it.
              </p>
            )}

            <Button
              variant="danger"
              size="lg"
              className="mt-7 w-full"
              onClick={() => {
                completedRef.current = new Set();
                commit(
                  createSession({
                    config,
                    sections: sectionIds,
                    questionIds: drawnIds,
                    allowance,
                    now: Date.now(),
                  }),
                );
                setNotice(null);
                sfx.warn();
                setPhase('active');
              }}
            >
              Start — the clock runs
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

  /* ------------------------------------------------------------- report */

  if (phase === 'done' || !session) {
    if (!result) return null; // `finish` writes `result` in the same tick as the phase
    return <ScoreReport result={result} records={records} />;
  }

  /* ------------------------------------------------------------- break */

  if (session.stage.kind === 'break') {
    const nextId = sectionAt(session.stage.nextIndex);
    return (
      <Page>
        <div className="mx-auto max-w-md">
          {notice?.on === 'break' && (
            <p
              role="status"
              className="mb-4 rounded-lg border-2 border-gold-deep/60 bg-leather-850 px-4 py-3 text-[13px] leading-relaxed text-parchment-dim"
            >
              {notice.text}
            </p>
          )}
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
                setNotice(null);
                edit((s) => startNextSection(s, Date.now()));
                window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
              }}
            >
              Continue
            </Button>
            {/* The break is a natural place to stop, and stopping here costs
                nothing: no clock is running until Continue. */}
            <Button variant="ghost" className="mt-3 w-full" onClick={() => setLeaving(true)}>
              Save and exit
            </Button>
          </div>
        </div>
      </Page>
    );
  }

  /* ------------------------------------------------------------ section */

  const { index: stageIndex, deadline } = session.stage;
  const sectionId = sectionAt(stageIndex);
  const questions = questionsBySection[sectionId] ?? [];
  const progress = session.progress[sectionId] ?? {
    answers: {},
    flags: [],
    cursor: 0,
    ms: {},
  };

  return (
    <Page>
      {/* Remounts per section, so the clock and focus start clean. */}
      <TestSectionView
        key={`section-${stageIndex}`}
        questions={questions}
        progress={progress}
        title={`${SECTION_BY_ID[sectionId].name} section`}
        subtitle={`Section ${stageIndex + 1} of ${sectionIds.length}`}
        accent={SECTION_BY_ID[sectionId].color}
        deadline={deadline}
        limitSec={sectionLimitMs(sectionId, session.allowance) / 1000}
        notice={notice?.on === 'section' ? notice.text : null}
        onSelect={(qid, key) => edit((s) => selectAnswer(s, qid, key))}
        onFlag={(qid) => edit((s) => toggleFlag(s, qid))}
        onMove={(i) => edit((s) => moveTo(s, i))}
        onSubmit={submitCurrent}
        onExpire={() => {
          sfx.warn();
          submitCurrent();
        }}
        onExit={() => setLeaving(true)}
      />
    </Page>
  );
}

/* --------------------------------------------------------------- report */

const PACE_TINT: Record<Pacing['verdict'], string> = {
  comfortable: 'oklch(var(--c-woods-text))',
  tight: 'oklch(var(--c-gold))',
  over: 'oklch(var(--c-blood-text))',
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
    const buckets = new Map<string, { section: SectionId; n: number; ok: number }>();
    for (const r of records) {
      const b = buckets.get(r.question.topic) ?? { section: r.question.section, n: 0, ok: 0 };
      b.n += 1;
      if (r.correct) b.ok += 1;
      buckets.set(r.question.topic, b);
    }
    return [...buckets.entries()]
      .map(([topic, b]) => ({ topic, ...b, accuracy: b.ok / b.n }))
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 6);
  }, [records]);
  /* The weakest topic that cost something. The list is sorted by accuracy, but
     a clean run still has a first row, and "Drill" a topic you went 3 for 3
     in is not advice. */
  const weakest = byTopic.find((t) => t.ok < t.n);

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
    /* Its own page, not the drill summary. That one headlines a percentage,
       and fed only the misses it announced "0% — 0 of 12 correct" over a
       test you may well have done well on. */
    return (
      <Page>
        <div className="mx-auto max-w-3xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="ghost" onClick={() => setShowMissed(false)}>
              Back to your score
            </Button>
            <Button variant="primary" onClick={() => navigate({ name: 'tests' })}>
              Done
            </Button>
          </div>
          <MissedReview records={missed} />
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <div className="mx-auto max-w-3xl">
        <div className="panel border-gold p-7 text-center sm:p-9">
          <div className="font-script text-[11px] uppercase tracking-[0.16em] text-ink-faint">
            {result.sections.length === 4
              ? 'Four-section practice'
              : `${soleSectionName(result.sections)} section`}{' '}
            · {formatRelative(result.at)}
          </div>

          <div className="num mt-5 text-[80px] leading-none text-gold">{result.composite}</div>
          <p className="mt-1 font-script text-[12px] uppercase tracking-wide text-ink-faint">
            {(['english', 'math', 'reading'] as const).every((s) => result.sections.includes(s))
              ? 'Composite'
              : result.sections.length === 1
                ? 'Section score'
                : 'Average score'}
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
              : `${gap} point${gap === 1 ? '' : 's'} from your ${target} target.${byTopic.length > 0 ? ' The topics below are where they are hiding.' : ''}`}
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
            <h2 className="heading mb-1.5 text-[1.125rem] text-parchment">How your clock ran</h2>
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
                  <div key={id} className="panel-quiet flex items-center gap-4 px-5 py-3.5">
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
            <h2 className="heading mb-4 text-[1.125rem] text-parchment">Where the points went</h2>
            <div className="space-y-2.5">
              {byTopic.map((t) => (
                <div key={t.topic} className="panel-quiet flex items-center gap-4 px-5 py-3.5">
                  <span className="w-40 flex-none truncate font-sans text-[14px] font-semibold text-parchment">
                    {titleCase(t.topic)}
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
          <Button
            variant="ghost"
            onClick={() =>
              weakest
                ? navigate({ name: 'drill', section: weakest.section, topic: weakest.topic })
                : navigate({ name: 'drills' })
            }
          >
            {weakest ? `Drill ${titleCase(weakest.topic)}` : 'Go to Practice'}
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
              Back to Timed practice
            </Button>
          }
        />
      </Page>
    );
  }
  return <ScoreReport result={result} />;
}
