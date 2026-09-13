/* One real question, on the landing page, before anything is asked of you.
 *
 * Two findings converge here. The landing page described the product at
 * length and never once showed it — no screenshot, no sample, nothing that
 * looks like the thing you would actually be doing. And there was no way to
 * try a single question without entering the flow: pick a name, answer four
 * onboarding questions, land on a map. Somebody deciding whether this is worth
 * an evening should not have to spend twenty minutes to find out.
 *
 * So this is the product, inline: a question from the real bank, four choices,
 * and — the part that is actually the pitch — the reason each wrong answer is
 * wrong, not just which one was right.
 *
 * It deliberately does not touch the store. Nothing here is recorded, no
 * attempt is logged, no review is scheduled. Trying the sample must not
 * quietly enrol you in a spaced-repetition schedule for a question you saw
 * before you decided to use the app.
 */

import { useMemo, useState } from 'react';

import { ALL_QUESTIONS, SECTION_BY_ID, getQuestion } from '@/content';
import { fromDrillQuestion } from '@/lib/normalize';
import { sfx } from '@/lib/sfx';
import { cx } from '@/lib/utils';
import type { Question } from '@/types';

/* A percentage trick with four distractors that each correspond to a specific
   mistake — which is what makes the explanations worth reading and therefore
   what makes it the right sample. Chosen by hand rather than at random: this
   one has to land, and a random draw could serve a two-line arithmetic item
   that demonstrates nothing.
   `pickSample` falls back rather than crashing if the id ever leaves the bank,
   because a landing page that throws is worse than one showing a lesser
   question. `check-content.mjs` will not catch this — it validates the shape
   of the library, not that one particular id survives an edit. */
const SAMPLE_ID = 'm027';

export function pickSample(): Question | undefined {
  return (
    getQuestion(SAMPLE_ID) ??
    ALL_QUESTIONS.find(
      (q) =>
        !q.passage && q.difficulty === 'medium' && Object.keys(q.why).length === q.choices.length,
    ) ??
    ALL_QUESTIONS[0]
  );
}

export function TryQuestion({ onFinish }: { onFinish?: () => void }) {
  /* Through `fromDrillQuestion`, the same adapter every real screen uses,
     rather than reading the authored JSON straight.

     This was rendering `question.choices` in the order they were typed. The
     bank is badly skewed by position — 40% of authored answers are "A" and
     under 10% are "D" — which is exactly why `normalize.ts` reshuffles every
     question from a hash of its id before the runner ever sees it. The sample
     bypassed that, so the one question a visitor actually answers was the one
     question in the app showing its answer where the author happened to put
     it. It also says, a paragraph further down, that it *is* the product; it
     should therefore behave like the product. */
  const question = useMemo(() => {
    const raw = pickSample();
    return raw ? { raw, run: fromDrillQuestion(raw) } : null;
  }, []);
  const [chosen, setChosen] = useState<string | null>(null);

  if (!question) return null;

  const { raw, run } = question;
  const section = SECTION_BY_ID[raw.section];
  const revealed = chosen !== null;
  const correct = chosen === run.correctKey;

  const answer = (key: string) => {
    if (revealed) return;
    setChosen(key);
    if (key === run.correctKey) sfx.correct();
    else sfx.wrong();
  };

  return (
    <div className="veil mx-auto max-w-2xl p-6 sm:p-8">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-script text-[11px] uppercase tracking-[0.16em] text-gold">
          {section?.name ?? 'Sample'}
        </span>
        <span className="font-script text-[11px] uppercase tracking-[0.16em] text-ink-faint">
          {run.topic}
        </span>
      </div>

      <p className="mt-4 font-read text-[1.06rem] leading-[1.7] text-parchment-light">
        {run.prompt}
      </p>
      {/* An English item poses its question by underlining a span inside the
          sentence. The hand-picked sample is a Math item with no span, but
          `pickSample` falls back to the bank if that id ever leaves it, and a
          fallback that dropped the sentence would leave nothing to answer. */}
      {run.label && (
        <p
          className="mt-3 font-read text-[1.02rem] leading-[1.7] text-parchment"
          dangerouslySetInnerHTML={{ __html: run.label }}
        />
      )}

      {/* Same semantics the real runner uses: one tab stop, arrows inside.
          A sample that is unusable by keyboard would be advertising the
          opposite of what the rest of the app spent a pass getting right. */}
      <div
        role="radiogroup"
        aria-label="Sample question answers"
        className="mt-5 grid gap-2.5"
        onKeyDown={(e) => {
          const step =
            e.key === 'ArrowDown' || e.key === 'ArrowRight'
              ? 1
              : e.key === 'ArrowUp' || e.key === 'ArrowLeft'
                ? -1
                : 0;
          if (step === 0 || revealed) return;
          e.preventDefault();
          const at = run.choices.findIndex((c) => c.key === chosen);
          const to =
            run.choices[((at < 0 ? 0 : at) + step + run.choices.length) % run.choices.length]!;
          answer(to.key);
        }}
      >
        {run.choices.map((choice, i) => {
          const isAnswer = choice.key === run.correctKey;
          const picked = choice.key === chosen;
          return (
            <button
              key={choice.key}
              type="button"
              role="radio"
              aria-checked={picked}
              tabIndex={revealed || picked || (chosen === null && i === 0) ? 0 : -1}
              /* `aria-disabled`, not `disabled`. The explanations render
                 inside these buttons, and a genuinely disabled control drops
                 out of the tab order — which would put the reason each answer
                 is wrong, the entire point of the sample, somewhere a
                 keyboard user cannot reach. */
              aria-disabled={revealed}
              onClick={() => answer(choice.key)}
              className={cx(
                'rounded-lg border-2 px-4 py-3 text-left transition-colors',
                !revealed && 'border-leather-700 bg-leather-900/70 hover:border-gold-deep',
                revealed && isAnswer && 'border-woods-text bg-woods-text/12',
                revealed && picked && !isAnswer && 'border-blood-text bg-blood-text/12',
                revealed &&
                  !isAnswer &&
                  !picked &&
                  'border-leather-700/60 bg-leather-900/40 opacity-70',
              )}
            >
              <span className="flex gap-3">
                <span className="num flex-none font-semibold text-gold">{choice.key}</span>
                <span className="min-w-0 flex-1 font-read text-[15px] leading-snug text-parchment">
                  {choice.text}
                </span>
              </span>
              {/* The reason every choice is wrong, not only the one you
                  picked. This is the whole product in one paragraph. */}
              {revealed && (
                <span
                  className={cx(
                    'mt-2 block pl-7 font-read text-[13.5px] leading-relaxed',
                    isAnswer ? 'text-woods-text' : 'text-parchment-dim',
                  )}
                >
                  {run.why[choice.key]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div aria-live="polite" className="mt-5">
        {revealed && (
          <p className="font-read text-[15px] leading-relaxed text-parchment-dim">
            <b className={correct ? 'text-woods-text' : 'text-blood-text'}>
              {correct ? 'Correct.' : 'Not this time.'}
            </b>{' '}
            Every question in the app explains all four choices like this — including the ones you
            did not pick, because the wrong answer you were tempted by is the useful thing to know
            about.
            {onFinish && (
              <>
                {' '}
                <button
                  type="button"
                  onClick={onFinish}
                  className="text-gold underline underline-offset-4 hover:text-gold-bright"
                >
                  Start properly
                </button>
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
