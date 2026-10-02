/* Renders a passage next to its questions.

   Three shapes exist in the library and they need different treatment:
     English  — prose with an intro line
     Reading  — prose with a genre label and a blurb
     Science  — a short setup plus figures: data tables, plotted charts, or
                the competing positions of a Conflicting Viewpoints passage

   On desktop the panel sticks alongside the question so you can look back at
   the text without losing your place; on mobile it can collapse to a
   summary, because a 1,700-word passage above the choices means endless
   scrolling on every single question (see `startsOpen` for when it does). */

import { useState } from 'react';
import type { Passage } from '@/types';
import { Prose, RichText } from './RichText';
import { FigureChartView } from './FigureChart';
import { Glyph } from './Icon';

/* Words in a question that mean "you will need to look". */
const NEEDS_PASSAGE =
  /\b(passage|paragraph|lines?|author|narrator|table|figure|graph|chart|diagram|data|study|studies|experiment)s?\b/i;

/* Collapsed was the default on a phone, behind a 51×26 "Read" tab. But a
   Science question about Table 2, or a Reading question about the second
   paragraph, cannot be answered without the thing it names, so the student's
   first move was always to hunt for that tab. It now opens by default when
   the passage has figures or the question points into it, and the choice
   then sticks for the rest of that passage's questions (the panel is keyed
   by passage), so collapsing it once is enough. */
function startsOpen(passage: Passage, cue: string): boolean {
  return Boolean(passage.figures?.length) || NEEDS_PASSAGE.test(cue);
}

export function PassagePanel({ passage, cue = '' }: { passage: Passage; cue?: string }) {
  const [openOnMobile, setOpenOnMobile] = useState(() => startsOpen(passage, cue));

  return (
    /* A page, and one step lower than the objects you act on. `.sheet` alone
       put the passage at the same elevation as the task column beside it, in
       the same cream, which is the reason the eye had nowhere to land: two
       equal cards, neither of them obviously the thing to read. */
    <aside className="sheet overflow-hidden shadow-resting lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto">
      <div className="border-b-2 border-paper-edge bg-paper-light px-6 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {passage.type && <div className="label-quill">{passage.type}</div>}
            <h2 className="mt-1 font-read text-[1.15rem] font-semibold leading-snug text-ink">
              {passage.title}
            </h2>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpenOnMobile((v) => !v)}
          className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border-2 border-paper-edge bg-white px-4 py-2 font-script text-[12px] uppercase tracking-wide text-ink-soft lg:hidden"
          aria-expanded={openOnMobile}
          aria-controls={`passage-body-${passage.id}`}
        >
          <Glyph name="chevronDown" size={14} className={openOnMobile ? 'rotate-180' : undefined} />
          {openOnMobile ? 'Hide passage' : 'Show passage'}
        </button>

        {(passage.intro || passage.blurb) && (
          <p className="mt-2 font-read text-[0.95rem] italic leading-relaxed text-ink-soft">
            {passage.intro ?? passage.blurb}
          </p>
        )}
      </div>

      <div
        id={`passage-body-${passage.id}`}
        className={`${openOnMobile ? 'block' : 'hidden'} px-6 py-6 lg:block`}
      >
        {passage.text && <Prose text={passage.text} className="prose-passage" />}

        {passage.figures?.map((figure, index) => (
          <figure key={`${figure.label}-${index}`} className="mt-6 first:mt-0">
            <figcaption className="mb-2">
              <span className="label-quill">{figure.label}</span>
              {figure.caption && (
                <span className="mt-1 block font-read text-[0.95rem] leading-snug text-ink-soft">
                  {figure.caption}
                </span>
              )}
            </figcaption>

            {figure.type === 'table' ? (
              <div className="overflow-x-auto rounded-lg border-2 border-paper-edge">
                <table className="quill-table">
                  <thead>
                    <tr>
                      {figure.head.map((h, i) => (
                        <th key={i} scope="col">
                          <RichText as="span" format="html">
                            {h}
                          </RichText>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {figure.rows.map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td key={j} className={j === 0 ? 'font-semibold' : undefined}>
                            <RichText as="span" format="html">
                              {cell}
                            </RichText>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : figure.type === 'chart' ? (
              <FigureChartView figure={figure} />
            ) : (
              /* Conflicting Viewpoints passages are entirely these — each one
                 is a scientist's position, so they need to read as prose. */
              <div className="rounded-lg border-l-4 border-[oklch(var(--c-series-4))] bg-paper-light px-5 py-4">
                <Prose text={figure.text} />
              </div>
            )}
          </figure>
        ))}
      </div>
    </aside>
  );
}
