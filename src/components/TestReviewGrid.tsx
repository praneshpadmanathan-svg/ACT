/* The answer sheet at a glance, for a timed section.

   The real ACT lets you move anywhere inside a section and change anything
   until time is called, and the paper answer sheet is how you see what is
   still blank. This is that sheet: one square per question, filled when
   answered, marked when flagged, ringed where you are — and every square is
   a way back to its question.

   It shows what you marked and never whether it was right. Nothing here
   receives the questions, only their ids, so it cannot leak an answer even
   by accident. */

import { cx } from '@/lib/utils';
import { Glyph } from './Icon';

export function TestReviewGrid({
  ids,
  answers,
  flags,
  current,
  onJump,
  accent,
}: {
  ids: string[];
  answers: Record<string, string>;
  flags: string[];
  current: number;
  onJump: (index: number) => void;
  accent: string;
}) {
  const answered = ids.filter((id) => answers[id]).length;
  const flagged = ids.filter((id) => flags.includes(id)).length;

  return (
    <nav aria-label="Questions in this section" className="panel-quiet mt-5 p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-script text-[11px] uppercase tracking-[0.16em] text-parchment">
          Review
        </h2>
        <p className="text-[12px] text-ink-faint">
          <span className="num text-parchment-dim">{answered}</span> of{' '}
          <span className="num text-parchment-dim">{ids.length}</span> answered
          {flagged > 0 && (
            <>
              {' · '}
              <span className="num text-gold">{flagged}</span> flagged
            </>
          )}
        </p>
      </div>

      {/* 44px squares, because they are the main way to move on a phone and
          the platform minimum for a tap target is not a suggestion. At 320px
          wide that is five to a row, which still fits a 25-question section
          in five rows. */}
      <ol className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1.5">
        {ids.map((id, i) => {
          const isAnswered = !!answers[id];
          const isFlagged = flags.includes(id);
          const isCurrent = i === current;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onJump(i)}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`Question ${i + 1}, ${isAnswered ? `answered ${answers[id]}` : 'unanswered'}${isFlagged ? ', flagged' : ''}`}
                className={cx(
                  'relative flex h-11 w-full items-center justify-center rounded-lg border-2 font-display text-[14px] font-semibold transition-colors duration-quick',
                  isAnswered
                    ? 'border-leather-600 bg-leather-700 text-parchment'
                    : 'border-dashed border-leather-700 bg-transparent text-ink-faint hover:text-parchment-dim',
                  isCurrent && 'outline outline-2 outline-offset-2',
                )}
                style={isCurrent ? { outlineColor: accent } : undefined}
              >
                <span className="num">{i + 1}</span>
                {isFlagged && (
                  <Glyph
                    name="flag"
                    size={12}
                    strokeWidth={2.2}
                    className="absolute right-0.5 top-0.5 text-gold"
                  />
                )}
              </button>
            </li>
          );
        })}
      </ol>

      {/* A legend in words, so the three states are not carried by colour
          and border style alone. */}
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-faint" aria-hidden>
        <span>
          <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-leather-700 align-[-1px]" />
          Answered
        </span>
        <span>
          <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm border border-dashed border-leather-600 align-[-1px]" />
          Blank
        </span>
        <span>
          <Glyph name="flag" size={11} className="mr-1 inline-block align-[-1px] text-gold" />
          Flagged
        </span>
      </p>
    </nav>
  );
}
