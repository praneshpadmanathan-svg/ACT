/* "What you missed" — one list, used after every kind of session.

   There used to be three hand-rolled copies. The drill one said "You chose B /
   Answer: C" with neither choice's words anywhere on screen, so the reader had
   to remember four options per question to make sense of the explanation. The
   landmark one rendered explanations as HTML when they are Markdown. The
   placement test promised explanations at the end and showed none. */

import type { AnswerRecord, RunnableQuestion } from './QuestionRunner';
import { RichText } from './RichText';

function choiceText(q: RunnableQuestion, key: string | null) {
  return key ? q.choices.find((c) => c.key === key) : undefined;
}

export function MissedReview({ records }: { records: AnswerRecord[] }) {
  const missed = records.filter((r) => !r.correct);
  if (missed.length === 0) return null;

  return (
    <div className="mt-6">
      <h2 className="heading mb-4 text-[1.125rem] text-parchment">
        What you missed ({missed.length})
      </h2>
      <div className="space-y-3">
        {missed.map((r, i) => {
          const q = r.question;
          const picked = choiceText(q, r.chosen);
          const right = choiceText(q, q.correctKey);
          return (
            <div key={`${q.id}-${i}`} className="sheet p-5 sm:p-6">
              {q.label && (
                <p className="mb-3 border-l-4 border-paper-deep bg-paper-light px-4 py-2.5 font-read text-[0.98rem]">
                  <RichText as="span" format="html">
                    {q.label}
                  </RichText>
                </p>
              )}
              <RichText as="div" format={q.promptFormat} className="prose-quill mb-4 text-[1rem]">
                {q.prompt}
              </RichText>

              {/* Side by side, so the miss and the credited answer can be
                  compared directly. Labelled rather than tinted. */}
              <div className="grid gap-5 sm:grid-cols-2">
                <section className="ink-trap lesson-trap">
                  <div className="lesson-label">
                    {r.chosen ? `You chose ${r.chosen}` : 'Not answered'}
                  </div>
                  {picked && (
                    <RichText
                      as="div"
                      format={picked.format}
                      className="mb-2 font-read text-[0.99rem] font-semibold leading-[1.6] text-ink"
                    >
                      {picked.text}
                    </RichText>
                  )}
                  <RichText
                    as="div"
                    format="markdown"
                    className="font-read text-[0.99rem] leading-[1.7] text-ink"
                  >
                    {(r.chosen && q.why[r.chosen]) ||
                      (r.chosen ? 'Not the credited answer.' : 'The time ran out first.')}
                  </RichText>
                </section>
                <section className="ink-example">
                  <div className="lesson-label">Answer: {q.correctKey}</div>
                  {right && (
                    <RichText
                      as="div"
                      format={right.format}
                      className="mb-2 font-read text-[0.99rem] font-semibold leading-[1.6] text-ink"
                    >
                      {right.text}
                    </RichText>
                  )}
                  <RichText
                    as="div"
                    format="markdown"
                    className="font-read text-[0.99rem] leading-[1.7] text-ink"
                  >
                    {q.why[q.correctKey] ?? q.whyGeneral ?? ''}
                  </RichText>
                </section>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
