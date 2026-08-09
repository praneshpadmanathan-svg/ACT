/* The placement test — intro, the run itself, and where it puts you.
 *
 * See `src/lib/diagnostic.ts` for what this is and, more importantly, what it
 * is not. Every honesty constraint written there has to be kept here, because
 * this is the file that actually talks to the student:
 *
 *   - the four numbers are called a *rough placement*, never a score, and the
 *     word "composite" does not appear anywhere on the summary;
 *   - the sections are ranked against each other, which the sample can support,
 *     rather than against the nation, which it cannot;
 *   - it is skippable from the intro, and the app works without it.
 */

import { useMemo, useState } from 'react';

import { SECTIONS, SECTION_BY_ID } from '@/content';
import { useNavigate } from '@/lib/router';
import { useStore } from '@/lib/store';
import { fromDrillQuestion } from '@/lib/normalize';
import {
  diagnosticLength,
  diagnosticMinutes,
  pickDiagnostic,
  placementShape,
  scoreDiagnostic,
  type DiagnosticAnswer,
} from '@/lib/diagnostic';
import { XP } from '@/lib/progress';
import { sfx } from '@/lib/sfx';
import { titleCase } from '@/lib/utils';
import type { DiagnosticResult, SectionId } from '@/types';
import { Page } from '@/components/Shell';
import { Button, ProgressBar, SectionHeading } from '@/components/ui';
import { QuestionRunner } from '@/components/QuestionRunner';

export function DiagnosticScreen() {
  const navigate = useNavigate();
  const { progress, answerQuestion, finishDiagnostic } = useStore();
  const [started, setStarted] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);

  const questions = useMemo(() => pickDiagnostic(progress).map(fromDrillQuestion), [progress]);
  const total = diagnosticLength(progress);
  const minutes = diagnosticMinutes(progress);
  const already = progress.diagnostic;

  if (result) return <DiagnosticSummary result={result} />;

  /* ------------------------------------------------------------- intro */

  if (!started) {
    return (
      <Page>
        <SectionHeading
          eyebrow="Before you set out"
          title="Where do you stand?"
          detail="A short spread of questions across all four sections, so the app can point you at the right things from day one instead of guessing for a fortnight."
        />

        <div className="mx-auto max-w-md">
          <div className="panel p-7 text-center sm:p-9">
            <div className="num text-[64px] leading-none text-gold">{questions.length}</div>
            <p className="mt-2 font-script text-[12px] uppercase tracking-wide text-ink-faint">
              questions · about {minutes} minutes
            </p>

            <ul className="mx-auto mt-6 max-w-sm space-y-2.5 text-left text-[14px] leading-relaxed text-parchment-dim">
              <li>· No timer. Take as long as you need on each one.</li>
              <li>· Explanations come at the end, not as you go.</li>
              <li>
                · A guess is fine and useful — getting one wrong here is how the app learns what to
                show you.
              </li>
            </ul>

            {already && (
              <p className="mt-6 rounded-lg border border-leather-700 bg-leather-900 px-4 py-3 text-[13px] leading-relaxed text-ink-faint">
                You have taken this before. Doing it again replaces the old placement.
              </p>
            )}

            <Button
              variant="primary"
              size="lg"
              className="mt-7 w-full"
              onClick={() => {
                sfx.select();
                setStarted(true);
              }}
            >
              {already ? 'Take it again ▶' : 'Start ▶'}
            </Button>
            <Button
              variant="ghost"
              className="mt-3 w-full"
              onClick={() => navigate({ name: 'home' })}
            >
              Skip — I would rather just play
            </Button>
          </div>
        </div>
      </Page>
    );
  }

  /* --------------------------------------------------------- the run */

  return (
    <Page>
      <QuestionRunner
        questions={questions}
        title="Placement"
        subtitle={`${total} questions, all four sections`}
        accent="#d4a017"
        deferFeedback
        onQuit={() => setStarted(false)}
        onAnswer={(record) =>
          /* Recorded as ordinary attempts. These are real answers to real
             questions and pretending otherwise would leave a student's very
             first session missing from their own history — and would deny the
             review ladder the misses it most wants to schedule. */
          answerQuestion({
            qid: record.question.id,
            section: record.question.section,
            topic: record.question.topic,
            correct: record.correct,
            ms: record.ms,
            xp: XP.question(record.question.difficulty, record.correct, 0),
          })
        }
        onFinish={(records) => {
          const answers: DiagnosticAnswer[] = records
            .filter((r) => r.question.section !== 'zone')
            .map((r) => ({
              section: r.question.section as SectionId,
              topic: r.question.topic,
              correct: r.correct,
            }));
          const scored = scoreDiagnostic(answers);
          finishDiagnostic(scored);
          setResult(scored);
          sfx.fanfare();
        }}
      />
    </Page>
  );
}

/* ------------------------------------------------------------- summary */

/* Deliberately not the score report's face.
 *
 * `ScoreReport` leads with one enormous number because a completed test has
 * earned one. This has not, so it leads with the four sections ranked against
 * each other — the thing twenty-eight questions genuinely can tell you. */
export function DiagnosticSummary({ result }: { result: DiagnosticResult }) {
  const navigate = useNavigate();
  const shape = placementShape(result);

  const ranked = SECTIONS.map((s) => ({ meta: s, score: result.scores[s.id] }))
    .filter((r): r is { meta: (typeof SECTIONS)[number]; score: number } => r.score !== undefined)
    .sort((a, b) => b.score - a.score);

  return (
    <Page>
      <div className="mx-auto max-w-2xl">
        <div className="rounded-xl border-2 border-gold bg-leather-850 p-7 shadow-card sm:p-9">
          <div className="text-center font-script text-[11px] uppercase tracking-[0.16em] text-ink-faint">
            Placement · {result.asked} questions
          </div>
          <h1 className="heading mt-3 text-center text-[clamp(1.2rem,3vw,1.6rem)] text-gold-light">
            {shape
              ? `${SECTION_BY_ID[shape.strongest].name} is your strongest, ${SECTION_BY_ID[shape.weakest].name} needs the most work`
              : 'Here is where you are starting'}
          </h1>

          <p className="mx-auto mt-4 max-w-md text-center text-[14px] leading-relaxed text-parchment-dim">
            These are rough placements, not scores. A handful of questions per section is enough to
            rank them against each other and nothing more — the real number comes from a full timed
            test.
          </p>

          <div className="mt-8 space-y-3">
            {ranked.map(({ meta, score }) => {
              const [correct, asked] = result.raw[meta.id] ?? [0, 0];
              return (
                <div
                  key={meta.id}
                  className="flex items-center gap-4 rounded-lg border-2 border-leather-700 bg-leather-900 px-5 py-4"
                >
                  <span
                    className="w-24 flex-none font-display text-[15px] font-semibold"
                    style={{ color: meta.color }}
                  >
                    {meta.name}
                  </span>
                  <ProgressBar value={asked ? correct / asked : 0} color={meta.color} height={8} />
                  <span className="num w-14 flex-none text-right text-[15px] text-ink-faint">
                    {correct}/{asked}
                  </span>
                  <span className="num w-16 flex-none text-right text-[24px] text-parchment">
                    ~{score}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {result.weakTopics.length > 0 && (
          <div className="mt-6">
            <h2 className="heading mb-2 text-[13px] text-parchment">Start with these</h2>
            <p className="mb-4 text-[13px] leading-relaxed text-ink-faint">
              Topics you got nothing right in. Your plan will lead with them until you have answered
              enough elsewhere for it to know better.
            </p>
            <div className="flex flex-wrap gap-2">
              {result.weakTopics.map((topic) => (
                <span
                  key={topic}
                  className="rounded-lg border-2 border-leather-700 bg-leather-850 px-4 py-2 font-display text-[13.5px] font-semibold text-parchment"
                >
                  {titleCase(topic)}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button variant="ghost" onClick={() => navigate({ name: 'map' })}>
            Open the map
          </Button>
          <Button variant="primary" onClick={() => navigate({ name: 'home' })}>
            See my plan ▸
          </Button>
        </div>
      </div>
    </Page>
  );
}
