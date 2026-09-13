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
import { ProUpsell } from '@/components/ProGate';
import { sectionIsFree } from '@/lib/features';

const QUIZ_LENGTH = 6;
const PASS_MARK = 0.7;

/* The bar to clear a landmark, counted in questions rather than quoted as a
   percentage.

   `PASS_MARK` is a fraction and the screen printed it as one — "70% to clear".
   That is not what 70% means to a student sitting in front of three questions.
   It means all three, because two out of three is 67. The same sentence in
   front of six questions means five, and one miss is survivable. One rule was
   being read, two rules were being enforced, and the student had no way to
   tell which one they were under until they failed.

   The arithmetic is unchanged: `ceil(n × PASS_MARK)` clears exactly what the
   percentage comparison cleared, at every pool size this quiz can produce. The
   sentence changes, from a ratio to the number they have to hit. Loosening the
   standard silently would be a different decision than making it legible, and
   this is only the second one — the real fix for a three-question landmark is
   more questions in it. */
const passNeeded = (n: number) => Math.ceil(n * PASS_MARK);

type Phase = 'lesson' | 'quiz' | 'result';

export function ZoneScreen({ zoneId }: { zoneId: string }) {
  const entry = getZone(zoneId);
  const navigate = useNavigate();
  const { progress, answerQuestion, clearZone, isPro } = useStore();

  const [phase, setPhase] = useState<Phase>('lesson');
  const [results, setResults] = useState<AnswerRecord[] | null>(null);
  const [attemptSeed, setAttemptSeed] = useState(0);
  /* The score to beat, captured as the quiz begins — reading it after the
     result is written would always show the score you just got. */
  const [priorBest, setPriorBest] = useState<number | null>(null);

  /* Whether this landmark actually has more questions than one quiz uses.
     Thirty of the thirty-seven do not, and the retry copy below has to know
     which kind it is standing in front of. */
  const deepPool = (ZONE_QUIZZES[zoneId]?.length ?? 0) > QUIZ_LENGTH;

  const questions = useMemo(() => {
    if (!entry) return [];
    const pool = ZONE_QUIZZES[zoneId] ?? [];
    /* A fresh sample each attempt — but only where there is a pool to sample
       from. Where there is not, `sample` returns the lot and the retry is the
       same questions reordered. See `deepPool`. */
    void attemptSeed;
    /* The zone's own declared topic is the fallback for questions tagged with
       the zone's old label instead of a skill — see `topicFor` in normalize. */
    return sample(pool, Math.min(QUIZ_LENGTH, pool.length)).map((q) =>
      fromZoneQuestion(q, zoneId, entry.path.id, entry.zone.topic),
    );
  }, [entry, zoneId, attemptSeed]);

  if (!entry) {
    return (
      <Page>
        <EmptyState
          title="Landmark not found"
          detail="That landmark does not exist. Head back and pick one off a road."
          action={
            <Button variant="primary" onClick={() => navigate({ name: 'path' })}>
              Back to the roads
            </Button>
          }
        />
      </Page>
    );
  }

  const { zone, path } = entry;
  const meta = SECTION_BY_ID[path.id];

  /* A landmark is its own URL, and the one most likely to be held: it is what
     "Continue your quest" points at and what the browser restores on reopen.
     Gating only the road that lists it would leave the lesson and its quiz
     wide open to anyone who had ever been here during their trial. */
  if (!isPro && !sectionIsFree(path.id)) {
    return (
      <Page>
        <ProUpsell
          title={`${zone.name} is on a Pro road`}
          detail={`This landmark belongs to ${meta?.name ?? 'another subject'}. English stays open in full; Pro reopens this road and the other two, along with the Summit, review and the guardians.`}
        />
      </Page>
    );
  }

  const lesson = LESSONS[zoneId];
  const best = progress.zonesCleared[zoneId] ?? null;

  /* ------------------------------------------------------------- lesson */

  if (phase === 'lesson') {
    return (
      <Page>
        <BackLink to={{ name: 'path', section: path.id }} label={`${meta.name} path`} />

        <div
          className="mb-6 rounded-xl border-2 border-leather-700 bg-leather-850 p-6 shadow-card sm:p-7"
          style={{ borderTopColor: meta.fill, borderTopWidth: 4 }}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="font-script text-[10px] uppercase tracking-[0.16em] text-ink-faint">
                {meta.name} · {zone.topic}
              </div>
              <h1
                className="heading mt-2 text-[clamp(14px,2.4vw,19px)]"
                style={{ color: meta.color }}
              >
                {zone.name}
              </h1>
              <p className="mt-2.5 font-read text-[19px] text-parchment-dim">{zone.sub}</p>
            </div>
            {best !== null && (
              <div className="text-right">
                <div className="font-script text-[10px] uppercase tracking-wide text-ink-faint">
                  Your best
                </div>
                <div className="num text-[30px] text-woods-text">{best}%</div>
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

            <div className="mt-8 flex flex-wrap gap-3 border-t-2 border-paper-edge pt-6">
              <Button
                variant="primary"
                size="lg"
                onClick={() => {
                  sfx.select();
                  setPriorBest(progress.zonesCleared[zoneId] ?? null);
                  setPhase('quiz');
                }}
              >
                Start the quiz
              </Button>
              <span className="self-center text-[13px] text-ink-soft">
                {questions.length} questions · {passNeeded(questions.length)} right to clear
              </span>
            </div>
          </article>
        ) : (
          <EmptyState
            art="scroll"
            title="No lesson for this zone"
            detail="Jump straight to the quiz — the explanations after each question teach the same material."
            action={
              <Button variant="primary" onClick={() => setPhase('quiz')}>
                Start the quiz
              </Button>
            }
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
          accent={meta.color}
          /* Back to this subject's road, which is where you came in from.
             Quitting has to land on the screen you left — anywhere else and
             backing out of a quiz feels like being moved rather than
             returning. */
          onQuit={() => navigate({ name: 'path', section: path.id })}
          onAnswer={(record) => {
            answerQuestion({
              qid: record.question.id,
              /* Read off the question rather than reaching for `path.id`
                 again. The two are the same value and the point is to keep
                 them that way: the question is where a section is decided,
                 and a second place deciding it independently is how this
                 drifted to the literal `'zone'` in the first place. */
              section: record.question.section,
              topic: record.question.topic,
              correct: record.correct,
              ms: record.ms,
              xp: XP.zoneQuestion(
                record.question.difficulty === 'hard'
                  ? 3
                  : record.question.difficulty === 'easy'
                    ? 1
                    : 2,
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
            if (correct >= passNeeded(records.length)) {
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
  const passed = total > 0 && correct >= passNeeded(total);
  const nextZone = path.nodes[entry.index + 1];

  return (
    <Page>
      <div className="mx-auto max-w-2xl">
        <div
          className="rounded-xl border-2 p-7 text-center shadow-card sm:p-9"
          style={{ borderColor: passed ? 'oklch(var(--c-woods-text))' : 'oklch(var(--c-blood-text))', background: 'oklch(var(--c-leather-900))' }}
        >
          <div className="font-script text-[11px] uppercase tracking-[0.16em] text-ink-faint">
            {zone.name}
          </div>
          <h1
            className="heading mt-3 text-[clamp(17px,3.4vw,26px)]"
            style={{ color: passed ? 'oklch(var(--c-woods-text))' : 'oklch(var(--c-blood-text))' }}
          >
            {passed ? 'Zone cleared' : 'Not yet'}
          </h1>

          <div
            className="num mt-6 text-[64px] leading-none"
            style={{ color: passed ? 'oklch(var(--c-woods-text))' : 'oklch(var(--c-blood-text))' }}
          >
            {percent}%
          </div>
          <p className="mt-2 text-[15px] text-parchment-dim">
            {correct} of {total} correct
          </p>

          <div className="mx-auto mt-6 max-w-sm">
            <ProgressBar value={percent / 100} color={passed ? 'oklch(var(--c-woods-text))' : 'oklch(var(--c-blood-text))'} />
          </div>

          <p className="mt-6 text-[15px] leading-relaxed text-parchment-dim">
            {passed
              ? priorBest !== null && percent <= priorBest
                ? `Cleared again — your best here is still ${priorBest}%.`
                : 'Nice. The next zone on this path is open.'
              : /* The old copy promised "a different set of questions" on a
                   retry. That is true of seven landmarks and false of the
                   other thirty, whose whole pool is smaller than a quiz —
                   `sample` hands back everything it has, so the retry is the
                   same questions in a different order. A student who notices
                   stops believing the rest of the screen, so say which one
                   this is. */
                `${passNeeded(total)} of ${total} clears this zone — you got ${correct}. ${
                  deepPool
                    ? 'Re-read the lesson and try again; you get a fresh set of questions.'
                    : 'Re-read the lesson and try again — this landmark has only these questions, so read the explanations below first.'
                }`}
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
                trailing
                onClick={() => {
                  setResults(null);
                  setPhase('lesson');
                  navigate({ name: 'zone', zone: nextZone.id });
                }}
              >
                Next zone
              </Button>
            ) : (
              /* Back to the road you were on, not to camp. Clearing a landmark
                 lights the next one along, and the road is where that shows —
                 sending the student somewhere the change is invisible throws
                 the reward away at the exact moment it is paid. */
              <Button
                variant="primary"
                onClick={() => navigate({ name: 'path', section: path.id })}
              >
                Back to the road
              </Button>
            )}
          </div>
        </div>

        {/* what you missed */}
        {results && results.some((r) => !r.correct) && (
          <div className="mt-6">
            <h2 className="heading mb-4 text-[13px] text-parchment">What you missed</h2>
            <div className="space-y-3">
              {results
                .filter((r) => !r.correct)
                .map((r, i) => (
                  <div key={i} className="sheet p-5">
                    <RichText as="div" format="html" className="prose-quill mb-3 text-[1rem]">
                      {r.question.prompt}
                    </RichText>
                    <section className="ink-example">
                      <div className="lesson-label">Correct answer — {r.question.correctKey}</div>
                      <RichText
                        as="div"
                        format="html"
                        className="font-read text-[1.02rem] leading-[1.72] text-ink"
                      >
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
