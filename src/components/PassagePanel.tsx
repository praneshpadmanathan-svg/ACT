/* Renders a passage next to its questions.

   Three shapes exist in the library and they need different treatment:
     English  — prose with an intro line
     Reading  — prose with a genre label and a blurb
     Science  — a short setup plus one or more data tables

   On desktop the panel sticks alongside the question so you can look back at
   the text without losing your place; on mobile it collapses to a summary
   you can open, because a 1,700-word passage above the choices means endless
   scrolling on every single question. */

import { useState } from 'react';
import type { Passage } from '@/types';
import { Prose, RichText } from './RichText';

export function PassagePanel({ passage }: { passage: Passage }) {
  const [openOnMobile, setOpenOnMobile] = useState(false);

  return (
    <aside className="study-sheet overflow-hidden lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
      <div className="border-b-2 border-paper-edge bg-[#efeae0] px-6 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {passage.type && <div className="study-label">{passage.type}</div>}
            <h2 className="mt-1 font-read text-[1.15rem] font-semibold leading-snug text-paper-ink">
              {passage.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setOpenOnMobile((v) => !v)}
            className="flex-none rounded border-2 border-paper-edge bg-white px-2.5 py-1 font-screen text-[10px] uppercase tracking-wide text-paper-soft lg:hidden"
            aria-expanded={openOnMobile}
          >
            {openOnMobile ? 'Hide' : 'Read'}
          </button>
        </div>

        {(passage.intro || passage.blurb) && (
          <p className="mt-2 font-read text-[0.95rem] italic leading-relaxed text-paper-soft">
            {passage.intro ?? passage.blurb}
          </p>
        )}
      </div>

      <div className={`${openOnMobile ? 'block' : 'hidden'} px-6 py-6 lg:block`}>
        {passage.text && <Prose text={passage.text} className="prose-passage" />}

        {passage.figures?.map((figure, index) => (
          <figure key={`${figure.label}-${index}`} className="mt-6 first:mt-0">
            <figcaption className="mb-2">
              <span className="study-label">{figure.label}</span>
              {figure.caption && (
                <span className="mt-1 block font-read text-[0.95rem] leading-snug text-paper-soft">
                  {figure.caption}
                </span>
              )}
            </figcaption>

            {figure.type === 'table' ? (
              <div className="overflow-x-auto rounded-lg border-2 border-paper-edge">
                <table className="study-table">
                  <thead>
                    <tr>
                      {figure.head.map((h, i) => (
                        <th key={i} scope="col">
                          <RichText as="span" format="html">{h}</RichText>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {figure.rows.map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td key={j} className={j === 0 ? 'font-semibold' : undefined}>
                            <RichText as="span" format="html">{cell}</RichText>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Conflicting Viewpoints passages are entirely these — each one
                 is a scientist's position, so they need to read as prose. */
              <div className="rounded-lg border-l-4 border-[#6a4ff0] bg-[#f1eefb] px-5 py-4">
                <Prose text={figure.text} />
              </div>
            )}
          </figure>
        ))}
      </div>
    </aside>
  );
}
