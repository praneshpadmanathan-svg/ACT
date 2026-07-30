/* A zone: read the lesson, then clear the quiz.

   The lesson is the study register — this is the one place in the game layer
   where someone reads several hundred words, so it gets paper, serif and a
   real measure rather than pixel type on a dark panel. */

import { useMemo, useState } from 'react';
import { LESSONS, SECTION_BY_ID, ZONE_QUIZZES, getZone } from '@/content';
import { useNavigate } from '@/lib/router';
import { useStore } from '@/lib/store';
import { fromZoneQuestion } from '@/lib/normalize';
import { XP } from '@/lib/progress';
import { sfx } from '@/lib/sfx';
import { sample } from '@/lib/utils';
import { BackLink, Page } from '@/components/Shell';
import { Button, EmptyState, ProgressBar } from '@/components/ui';
import { RichText } from '@/components/RichText';
import { QuestionRunner, type AnswerRecord } from '@/components/QuestionRunner';
import { burstConfetti } from '@/components/Feedback';

const QUIZ_LENGTH = 6;
const PASS_MARK = 0.7;

type Phase = 'lesson' | 'quiz' | 'result';

export function ZoneScreen({ zoneId }: { zoneId: string }) {
  const entry = getZone(zoneId);
  const navigate = useNavigate();
  const { progress, answerQuestion, clearZone } = useStore();

  const [phase, setPhase] = useState<Phase>('lesson');
  const [results, setResults] = useState<AnswerRecord[] | null>(null);
  const [attemptSeed, setAttemptSeed] = useState(0);
  /* The score to beat, captured as the quiz begins — reading it after the
     result is written would always show the score you just got. */
  const [priorBest, setPriorBest] = useState<number | null>(null);

  const questions = useMemo(() => {
    if (!entry) return [];
    const pool = ZONE_QUIZZES[zoneId] ?? [];
    // A fresh sample each attempt, so a retry is not the same six questions.
    void attemptSeed;
    return sample(pool, Math.min(QUIZ_LENGTH, pool.length)).map((q, i) => fromZoneQuestion(q, zoneId, i));
  }, [entry, zoneId, attemptSeed]);

  if (!entry) {
    return (
      <Page>
        <EmptyState
          title="Zone not found"
          detail="That zone does not exist. Head back to the map and pick one from a path."
          action={<Button variant="primary" onClick={() => navigate({ name: 'map' })}>Back to map</Button>}
        />
      </Page>
    );
  }

  const { zone, path } = entry;
  const meta = SECTION_BY_ID[path.id];
  const lesson = LESSONS[zoneId];
  const best = progress.zonesCleared[zoneId] ?? null;

  /* ------------------------------------------------------------- lesson */

  if (phase === 'lesson') {
    return (
      <Page>
        <BackLink to={{ name: 'path', section: path.id }} label={`${meta.name} path`} />

        <div className="mb-6 rounded-xl border-2 border-leather-700 bg-leather-850 p-6 shadow-card sm:p-7"
             style={{ borderTopColor: path.color, borderTopWidth: 4 }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="font-script text-[10px] uppercase tracking-[0.16em] text-ink-faint">
                {meta.name} · {zone.topic}
              </div>
              <h1 className="heading mt-2 text-[clamp(14px,2.4vw,19px)]" style={{ color: path.color }}>
                {zone.name}
              </h1>
              <p className="mt-2.5 font-read text-[19px] text-parchment-dim">{zone.sub}</p>
            </div>
            {best !== null && (
              <div className="text-right">
                <div className="font-script text-[10px] uppercase tracking-wide text-ink-faint">Your best</div>
                <div className="num text-[30px] text-woods">{best}%</div>
              </div>
            )}
          </div>

          {zone.learn && (
            <ul className="mt-6 grid gap-2 sm:grid-cols-3">
              {zone.learn.map((item) => (
                <li
                  key={item}
                  className="rounded-lg border-2 border-leather-700 bg-leather-900 px-3.5 py-2.5 text-[13px] leading-snug text-parchment-dim"
                >
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>

        {lesson ? (
          <article className="sheet p-6 sm:p-9">
            <p className="prose-quill text-[1.15rem] leading-[1.7] text-ink">
              <RichText as="span">{lesson.intro}</RichText>
            </p>

            <div className="lesson mt-8">
              {lesson.rules.map(([title, body, example], i) => (
                <section key={i} className="ink-rule">
                  <h2 className="lesson-label">{title}</h2>
                  <RichText as="div" format="html" className="prose-quill">
                    {body}
                  </RichText>
                  {/* The example used to be a white card nested inside the
                      blue rule card — two boxes deep on a cream page. */}
                  {example && (
                    <div className="ink-example mt-3.5">
                      <div className="lesson-label">Example</div>
                      <RichText
                        as="div"
                        format="html"
                        className="font-read text-[1.02rem] leading-[1.72] text-ink"
                      >
                        {example}
                      </RichText>
                    </div>
                  )}
                </section>
              ))}

              {lesson.trap && (
                <section className="ink-trap lesson-trap">
                  <div className="lesson-label">The trap</div>
                  <RichText
                    as="div"
                    format="html"
                    className="font-read text-[1.02rem] leading-[1.72] text-ink"
                  >
                    {lesson.trap}
                  </RichText>
                </section>
              )}
            </div>

            <div className="mt-8 flex flex-wrap gap-3 border-t-2 border-parchment-edge pt-6">
              <Button
                variant="primary"
                size="lg"
                onClick={() => {
                  sfx.select();
                  setPriorBest(progress.zonesCleared[zoneId] ?? null);
                  setPhase('quiz');
                }}
              >
                Start the quiz ▶
              </Button>
              <span className="self-center text-[13px] text-ink-soft">
                {questions.length} questions · {Math.round(PASS_MARK * 100)}% to clear
              </span>
            </div>
          </article>
        ) : (
          <EmptyState
            title="No lesson for this zone"
            detail="Jump straight to the quiz — the explanations after each question teach the same material."
            action={<Button variant="primary" onClick={() => setPhase('quiz')}>Start the quiz</Button>}
          />
        )}
      </Page>
    );
  }

  /* --------------------------------------------------------------- quiz */

  if (phase === 'quiz') {
    return (
      <Page>
        <QuestionRunner
          questions={questions}
          title={zone.name}
          subtitle={zone.sub}
          accent={path.color}
          onQuit={() => navigate({ name: 'path', section: path.id })}
          onAnswer={(record) => {
            answerQuestion({
              qid: record.question.id,
              section: 'zone',
              topic: record.question.topic,
              correct: record.correct,
              ms: record.ms,
              xp: XP.zoneQuestion(
                record.question.difficulty === 'hard' ? 3 : record.question.difficulty === 'easy' ? 1 : 2,
                record.correct,
                0,
              ),
            });
          }}
          onFinish={(records) => {
            const correct = records.filter((r) => r.correct).length;
            const percent = Math.round((correct / records.length) * 100);
            setResults(records);
            setPhase('result');
            if (percent >= PASS_MARK * 100) {
              clearZone(zoneId, percent);
              burstConfetti(110);
              sfx.fanfare();
            }
          }}
        />
      </Page>
    );
  }

  /* ------------------------------------------------------------- result */

  const correct = results?.filter((r) => r.correct).length ?? 0;
  const total = results?.length ?? 0;
  const percent = total ? Math.round((correct / total) * 100) : 0;
  const passed = percent >= PASS_MARK * 100;
  const nextZone = path.nodes[entry.index + 1];

  return (
    <Page>
      <div className="mx-auto max-w-2xl">
        <div
          className="rounded-xl border-2 p-7 text-center shadow-card sm:p-9"
          style={{ borderColor: passed ? '#5ee6a8' : '#ff8298', background: '#16102e' }}
        >
          <div className="font-script text-[11px] uppercase tracking-[0.16em] text-ink-faint">
            {zone.name}
          </div>
          <h1
            className="heading mt-3 text-[clamp(17px,3.4vw,26px)]"
            style={{ color: passed ? '#5ee6a8' : '#ff8298' }}
          >
            {passed ? 'Zone cleared' : 'Not yet'}
          </h1>

          <div className="num mt-6 text-[64px] leading-none" style={{ color: passed ? '#5ee6a8' : '#ff8298' }}>
            {percent}%
          </div>
          <p className="mt-2 text-[15px] text-parchment-dim">
            {correct} of {total} correct
          </p>

          <div className="mx-auto mt-6 max-w-sm">
            <ProgressBar value={percent / 100} color={passed ? '#5ee6a8' : '#ff8298'} />
          </div>

          <p className="mt-6 text-[15px] leading-relaxed text-parchment-dim">
            {passed
              ? priorBest !== null && percent <= priorBest
                ? `Cleared again — your best here is still ${priorBest}%.`
                : 'Nice. The next zone on this path is open.'
              : `You need ${Math.round(PASS_MARK * 100)}% to clear this zone. Re-read the lesson and try again — you get a different set of questions.`}
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button
              variant="ghost"
              onClick={() => {
                setAttemptSeed((s) => s + 1);
                setResults(null);
                setPriorBest(progress.zonesCleared[zoneId] ?? null);
                setPhase('quiz');
              }}
            >
              Try again
            </Button>
            <Button variant="ghost" onClick={() => setPhase('lesson')}>
              Re-read lesson
            </Button>
            {passed && nextZone ? (
              <Button
                variant="primary"
                onClick={() => {
                  setResults(null);
                  setPhase('lesson');
                  navigate({ name: 'zone', zone: nextZone.id });
                }}
              >
                Next zone ▶
              </Button>
            ) : (
              <Button variant="primary" onClick={() => navigate({ name: 'path', section: path.id })}>
                Back to path
              </Button>
            )}
          </div>
        </div>

        {/* what you missed */}
        {results && results.some((r) => !r.correct) && (
          <div className="mt-6">
            <h2 className="heading mb-4 text-[13px] text-white">What you missed</h2>
            <div className="space-y-3">
              {results
                .filter((r) => !r.correct)
                .map((r, i) => (
                  <div key={i} className="sheet p-5">
                    <RichText as="div" format="html" className="prose-quill mb-3 text-[1rem]">
                      {r.question.prompt}
                    </RichText>
                    <section className="ink-example">
                      <div className="lesson-label">
                        Correct answer — {r.question.correctKey}
                      </div>
                      <RichText as="div" format="html" className="font-read text-[1.02rem] leading-[1.72] text-ink">
                        {r.question.why[r.question.correctKey] ?? r.question.whyGeneral ?? ''}
                      </RichText>
                    </section>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </Page>
  );
}
