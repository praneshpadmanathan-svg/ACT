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
  const question = useMemo(pickSample, []);
  const [chosen, setChosen] = useState<string | null>(null);

  if (!question) return null;

  const section = SECTION_BY_ID[question.section];
  const revealed = chosen !== null;
  const correct = chosen === question.answer;

  const answer = (id: string) => {
    if (revealed) return;
    setChosen(id);
    if (id === question.answer) sfx.correct();
    else sfx.wrong();
  };

  return (
    <div className="veil mx-auto max-w-2xl p-6 sm:p-8">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-script text-[11px] uppercase tracking-[0.16em] text-gold">
          {section?.name ?? 'Sample'}
        </span>
        <span className="font-script text-[11px] uppercase tracking-[0.16em] text-ink-faint">
          {question.topic}
        </span>
      </div>

      <p className="mt-4 font-read text-[1.06rem] leading-[1.7] text-parchment-light">
        {question.context}
      </p>

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
          const at = question.choices.findIndex((c) => c.id === chosen);
          const to =
            question.choices[
              ((at < 0 ? 0 : at) + step + question.choices.length) % question.choices.length
            ]!;
          answer(to.id);
        }}
      >
        {question.choices.map((choice, i) => {
          const isAnswer = choice.id === question.answer;
          const picked = choice.id === chosen;
          return (
            <button
              key={choice.id}
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
              onClick={() => answer(choice.id)}
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
                <span className="num flex-none font-semibold text-gold">{choice.id}</span>
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
                  {question.why[choice.id]}
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
                  Start properly ▸
                </button>
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
