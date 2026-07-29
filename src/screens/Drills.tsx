/* Drill setup, the drill session itself, and the spaced-review session.

   Drills pull from the graded question bank. Selection is adaptive by
   default: topics you are weak at show up more often, so a long session
   spends its questions where they are worth the most. */

import { useMemo, useState } from 'react';
import { QUESTIONS, SECTIONS, SECTION_BY_ID, TOPICS_BY_SECTION, getQuestion } from '@/content';
import { hrefFor, useNavigate } from '@/lib/router';
import { useStore } from '@/lib/store';
import { fromDrillQuestion } from '@/lib/normalize';
import { dueForReview, topicStats, XP } from '@/lib/progress';
import { sfx } from '@/lib/sfx';
import { cx, shuffle, titleCase } from '@/lib/utils';
import type { Question, SectionId } from '@/types';
import { Page } from '@/components/Shell';
import { Button, EmptyState, ProgressBar, SectionHeading } from '@/components/ui';
import { QuestionRunner, type AnswerRecord } from '@/components/QuestionRunner';
import { RichText } from '@/components/RichText';

const LENGTHS = [5, 10, 20];

/* --------------------------------------------------------------- setup */

export function DrillsScreen({ section }: { section?: string }) {
  const navigate = useNavigate();
  const { progress } = useStore();
  const active = (section as SectionId) ?? 'english';
  const meta = SECTION_BY_ID[active];

  const stats = useMemo(() => {
    const byTopic = new Map(topicStats(progress, active).map((t) => [t.topic, t]));
    return byTopic;
  }, [progress, active]);

  if (!meta) {
    return (
      <Page>
        <EmptyState
          title="Section not found"
          detail="Pick one of the four ACT sections."
          action={<Button variant="primary" onClick={() => navigate({ name: 'drills', section: 'english' })}>English drills</Button>}
        />
      </Page>
    );
  }

  const topics = TOPICS_BY_SECTION[active];

  return (
    <Page>
      <SectionHeading
        eyebrow={`${QUESTIONS[active].length} questions available`}
        title="Drills"
        detail="Adaptive practice from the graded question bank. Every choice gets an explanation, not just the right one."
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={hrefFor({ name: 'drills', section: s.id })}
            onClick={() => sfx.select()}
            className={cx(
              'rounded-lg border-2 px-4 py-2 font-script text-[12px] uppercase tracking-wide transition-colors',
              s.id === active ? 'text-[#0d0620]' : 'border-leather-700 bg-leather-850 text-parchment-dim hover:text-white',
            )}
            style={s.id === active ? { background: s.color, borderColor: s.color } : undefined}
          >
            {s.name}
          </a>
        ))}
      </div>

      {/* mixed drill */}
      <div
        className="mb-6 rounded-xl border-2 border-leather-700 bg-leather-850 p-6 shadow-card sm:p-7"
        style={{ borderTopColor: meta.color, borderTopWidth: 4 }}
      >
        <h2 className="heading text-[13px]" style={{ color: meta.color }}>
          Mixed {meta.name.toLowerCase()} drill
        </h2>
        <p className="mt-2.5 text-[14px] leading-relaxed text-parchment-dim">
          Questions weighted toward the topics you get wrong most.
        </p>
        <div className="mt-5 flex flex-wrap gap-2.5">
          {LENGTHS.map((n) => (
            <Button
              key={n}
              variant={n === 10 ? 'primary' : 'ghost'}
              onClick={() => navigate({ name: 'drill', section: active, topic: `mixed:${n}` })}
            >
              {n} questions
            </Button>
          ))}
        </div>
      </div>

      {/* by topic */}
      <h2 className="heading mb-4 text-[13px] text-white">By topic</h2>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {topics.map((topic) => {
          const stat = stats.get(topic);
          const count = QUESTIONS[active].filter((q) => q.topic === topic).length;
          const accuracy = stat?.accuracy ?? null;

          return (
            <button
              key={topic}
              type="button"
              onClick={() => {
                sfx.select();
                navigate({ name: 'drill', section: active, topic });
              }}
              className="flex items-center gap-4 rounded-lg border-2 border-leather-700 bg-leather-850 px-4 py-3.5 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-gold-deep"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-sans text-[14px] font-semibold text-white">
                  {titleCase(topic)}
                </span>
                <span className="mt-0.5 block font-script text-[10px] uppercase tracking-wide text-ink-faint">
                  {count} question{count === 1 ? '' : 's'}
                  {stat ? ` · ${stat.attempts} tried` : ''}
                </span>
              </span>
              <span
                className="num flex-none text-[19px]"
                style={{
                  color:
                    accuracy === null
                      ? '#5f5680'
                      : accuracy < 0.5
                        ? '#ff8298'
                        : accuracy < 0.75
                          ? '#ffd23e'
                          : '#5ee6a8',
                }}
              >
                {accuracy === null ? '—' : `${Math.round(accuracy * 100)}%`}
              </span>
            </button>
          );
        })}
      </div>
    </Page>
  );
}

/* ------------------------------------------------------ question picking */

/** Weight each question by how much the player struggles with its topic, so
 *  a mixed drill naturally drifts toward weak spots without ever locking out
 *  the topics they already know. */
function pickAdaptive(pool: Question[], count: number, accuracyByTopic: Map<string, number>): Question[] {
  const weighted = pool.map((q) => {
    const accuracy = accuracyByTopic.get(q.topic);
    // Unseen topics sit in the middle; weak topics get up to 3x the weight.
    const weight = accuracy === undefined ? 1.5 : 1 + (1 - accuracy) * 2;
    return { q, weight: weight * (0.6 + Math.random() * 0.8) };
  });
  return weighted
    .sort((a, b) => b.weight - a.weight)
    .slice(0, count)
    .map((w) => w.q);
}

/* --------------------------------------------------------------- runner */

export function DrillRunner({ section, topic }: { section: string; topic?: string }) {
  const navigate = useNavigate();
  const { progress, answerQuestion } = useStore();
  const [results, setResults] = useState<AnswerRecord[] | null>(null);

  const sectionId = section as SectionId;
  const meta = SECTION_BY_ID[sectionId];

  const { questions, title, subtitle } = useMemo(() => {
    const pool = QUESTIONS[sectionId] ?? [];
    const accuracyByTopic = new Map(topicStats(progress, sectionId).map((t) => [t.topic, t.accuracy]));

    if (topic?.startsWith('mixed:')) {
      const count = Number(topic.split(':')[1]) || 10;
      return {
        questions: pickAdaptive(pool, count, accuracyByTopic).map(fromDrillQuestion),
        title: `Mixed ${meta?.name ?? ''} drill`,
        subtitle: 'Weighted toward your weak topics',
      };
    }

    if (topic) {
      const filtered = pool.filter((q) => q.topic === topic);
      return {
        questions: shuffle(filtered).map(fromDrillQuestion),
        title: titleCase(topic),
        subtitle: `${meta?.name ?? ''} · ${filtered.length} questions`,
      };
    }

    return {
      questions: pickAdaptive(pool, 10, accuracyByTopic).map(fromDrillQuestion),
      title: `${meta?.name ?? ''} drill`,
      subtitle: '10 questions',
    };
    // Deliberately not reactive to `progress` — regenerating the set mid-drill
    // would swap questions under the player.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId, topic]);

  if (!meta || questions.length === 0) {
    return (
      <Page>
        <EmptyState
          title="No questions here"
          detail="That topic has no questions yet. Try a mixed drill instead."
          action={<Button variant="primary" onClick={() => navigate({ name: 'drills', section })}>Back to drills</Button>}
        />
      </Page>
    );
  }

  if (results) {
    return (
      <DrillSummary
        results={results}
        accent={meta.color}
        onRetry={() => {
          setResults(null);
          navigate({ name: 'drills', section });
        }}
        onDone={() => navigate({ name: 'drills', section })}
      />
    );
  }

  return (
    <Page>
      <QuestionRunner
        questions={questions}
        title={title}
        subtitle={subtitle}
        accent={meta.color}
        onQuit={() => navigate({ name: 'drills', section })}
        onAnswer={(record) =>
          answerQuestion({
            qid: record.question.id,
            section: sectionId,
            topic: record.question.topic,
            correct: record.correct,
            ms: record.ms,
            xp: XP.question(record.question.difficulty, record.correct, 0),
          })
        }
        onFinish={setResults}
      />
    </Page>
  );
}

/* --------------------------------------------------------------- review */

export function ReviewScreen() {
  const navigate = useNavigate();
  const { progress, answerQuestion } = useStore();
  const [results, setResults] = useState<AnswerRecord[] | null>(null);
  const [started, setStarted] = useState(false);

  const due = useMemo(() => {
    return dueForReview(progress)
      .map(getQuestion)
      .filter((q): q is Question => Boolean(q))
      .slice(0, 20);
  }, [progress]);

  const upcoming = Object.keys(progress.review).length - due.length;

  if (results) {
    return (
      <DrillSummary
        results={results}
        accent="#3ad6f0"
        onRetry={() => {
          setResults(null);
          setStarted(false);
        }}
        onDone={() => navigate({ name: 'home' })}
      />
    );
  }

  if (!started) {
    return (
      <Page>
        <SectionHeading
          eyebrow="Spaced repetition"
          title="Review"
          detail="Questions you missed come back on a schedule — one day, then three, then a week — until you have them cold."
        />

        {due.length === 0 ? (
          <EmptyState
            title="Nothing due right now"
            detail={
              upcoming > 0
                ? `${upcoming} question${upcoming === 1 ? '' : 's'} are scheduled for later. Drill some new material in the meantime.`
                : 'Answer some drill questions first — anything you miss lands here automatically.'
            }
            action={<Button variant="primary" onClick={() => navigate({ name: 'drills' })}>Go to drills</Button>}
          />
        ) : (
          <div className="panel p-7 text-center sm:p-9">
            <div className="num text-[64px] leading-none text-cliffs">{due.length}</div>
            <p className="mt-2 font-script text-[12px] uppercase tracking-wide text-ink-faint">
              question{due.length === 1 ? '' : 's'} due
            </p>
            <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-parchment-dim">
              Get one right and it moves further out. Get it wrong and it comes back tomorrow.
            </p>
            <Button variant="primary" size="lg" className="mt-7" onClick={() => setStarted(true)}>
              Start review ▶
            </Button>
            {upcoming > 0 && (
              <p className="mt-4 text-[13px] text-ink-faint">{upcoming} more scheduled for later</p>
            )}
          </div>
        )}
      </Page>
    );
  }

  return (
    <Page>
      <QuestionRunner
        questions={due.map(fromDrillQuestion)}
        title="Review session"
        subtitle="Questions you have missed before"
        accent="#3ad6f0"
        onQuit={() => setStarted(false)}
        onAnswer={(record) =>
          answerQuestion({
            qid: record.question.id,
            section: record.question.section,
            topic: record.question.topic,
            correct: record.correct,
            ms: record.ms,
            xp: XP.question(record.question.difficulty, record.correct, 0),
          })
        }
        onFinish={setResults}
      />
    </Page>
  );
}

/* -------------------------------------------------------------- summary */

export function DrillSummary({
  results,
  accent,
  onRetry,
  onDone,
}: {
  results: AnswerRecord[];
  accent: string;
  onRetry: () => void;
  onDone: () => void;
}) {
  const correct = results.filter((r) => r.correct).length;
  const percent = results.length ? Math.round((correct / results.length) * 100) : 0;
  const missed = results.filter((r) => !r.correct);
  const totalSeconds = results.reduce((n, r) => n + r.ms, 0) / 1000;

  return (
    <Page>
      <div className="mx-auto max-w-3xl">
        <div className="rounded-xl border-2 border-leather-700 bg-leather-850 p-7 text-center shadow-card sm:p-9">
          <div className="font-script text-[11px] uppercase tracking-[0.16em] text-ink-faint">
            Session complete
          </div>
          <div className="num mt-4 text-[64px] leading-none" style={{ color: accent }}>
            {percent}%
          </div>
          <p className="mt-2 text-[15px] text-parchment-dim">
            {correct} of {results.length} correct · {(totalSeconds / results.length).toFixed(0)}s per question
          </p>

          <div className="mx-auto mt-6 max-w-sm">
            <ProgressBar value={percent / 100} color={accent} />
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button variant="ghost" onClick={onRetry}>Another set</Button>
            <Button variant="primary" onClick={onDone}>Done</Button>
          </div>
        </div>

        {missed.length > 0 && (
          <div className="mt-6">
            <h2 className="heading mb-4 text-[13px] text-white">
              What you missed ({missed.length})
            </h2>
            <div className="space-y-3">
              {missed.map((r, i) => (
                <div key={i} className="sheet p-5 sm:p-6">
                  {r.question.label && (
                    <p className="mb-3 border-l-4 border-[#c9b06a] bg-[#fbf6e6] px-4 py-2.5 font-read text-[0.98rem]">
                      <RichText as="span" format="html">{r.question.label}</RichText>
                    </p>
                  )}
                  <RichText
                    as="div"
                    format={r.question.promptFormat}
                    className="prose-quill mb-4 text-[1rem]"
                  >
                    {r.question.prompt}
                  </RichText>

                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <div className="block-trap">
                      <div className="label-quill mb-1">You chose {r.chosen}</div>
                      <RichText as="div" format="markdown" className="font-read text-[0.98rem] leading-relaxed">
                        {(r.chosen && r.question.why[r.chosen]) || 'Not the credited answer.'}
                      </RichText>
                    </div>
                    <div className="block-example">
                      <div className="label-quill mb-1">Answer: {r.question.correctKey}</div>
                      <RichText as="div" format="markdown" className="font-read text-[0.98rem] leading-relaxed">
                        {r.question.why[r.question.correctKey] ?? r.question.whyGeneral ?? ''}
                      </RichText>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Page>
  );
}
