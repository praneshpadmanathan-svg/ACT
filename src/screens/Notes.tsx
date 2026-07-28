/* The notes library and the note reader.

   This is the longest-form reading in the app, so it commits fully to the
   study register: warm paper, serif body at a 66-character measure, block
   variants as coloured rails rather than filled boxes. The only arcade
   elements are the progress chrome above the sheet and the reward on
   finishing a page. */

import { useEffect, useMemo, useRef, useState } from 'react';
import { NOTES, SECTIONS, SECTION_BY_ID, getNotePage, ALL_NOTE_PAGES } from '@/content';
import { hrefFor, useNavigate } from '@/lib/router';
import { useStore } from '@/lib/store';
import { sfx } from '@/lib/sfx';
import { cx } from '@/lib/utils';
import type { NoteBlock, SectionId } from '@/types';
import { BackLink, Page } from '@/components/Shell';
import { Button, EmptyState, ProgressBar, SectionHeading } from '@/components/ui';
import { RichText } from '@/components/RichText';

/* ------------------------------------------------------------- library */

export function NotesScreen({ section }: { section?: string }) {
  const { progress } = useStore();
  const navigate = useNavigate();
  const active = (section as SectionId) ?? 'english';
  const meta = SECTION_BY_ID[active];

  if (!meta) {
    return (
      <Page>
        <EmptyState
          title="Section not found"
          detail="Pick one of the four ACT sections."
          action={<Button variant="primary" onClick={() => navigate({ name: 'notes', section: 'english' })}>English notes</Button>}
        />
      </Page>
    );
  }

  const units = NOTES[active];
  const readInSection = units.reduce(
    (n, unit) => n + unit.pages.filter((p) => progress.notesRead.includes(p.id)).length,
    0,
  );
  const totalInSection = units.reduce((n, unit) => n + unit.pages.length, 0);

  return (
    <Page>
      <SectionHeading
        eyebrow={`${progress.notesRead.length} of ${ALL_NOTE_PAGES.length} pages read overall`}
        title="Study notes"
        detail="Short pages that teach exactly what the ACT asks. Each one ends with a check question."
      />

      {/* section tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={hrefFor({ name: 'notes', section: s.id })}
            onClick={() => sfx.select()}
            className={cx(
              'rounded-lg border-2 px-4 py-2 font-screen text-[12px] uppercase tracking-wide transition-colors',
              s.id === active ? 'text-[#0d0620]' : 'border-edge bg-ink-850 text-[#a89ac6] hover:text-white',
            )}
            style={s.id === active ? { background: s.color, borderColor: s.color } : undefined}
          >
            {s.name}
          </a>
        ))}
      </div>

      <div className="mb-7 flex items-center gap-4">
        <ProgressBar
          value={totalInSection ? readInSection / totalInSection : 0}
          color={meta.color}
          height={8}
        />
        <span className="flex-none font-screen text-[11px] uppercase tracking-wide text-[#8f86b5]">
          {readInSection}/{totalInSection}
        </span>
      </div>

      <div className="space-y-6">
        {units.map((unit) => (
          <section key={unit.id}>
            <h2 className="heading-pixel mb-3 text-[12px]" style={{ color: meta.color }}>
              {unit.label}
            </h2>
            <div className="grid gap-2.5 md:grid-cols-2">
              {unit.pages.map((page) => {
                const read = progress.notesRead.includes(page.id);
                return (
                  <a
                    key={page.id}
                    href={hrefFor({ name: 'note', page: page.id })}
                    onClick={() => sfx.select()}
                    className="group flex items-start gap-4 rounded-lg border-2 border-edge bg-ink-850 p-4 shadow-pixel transition-all hover:-translate-y-0.5 hover:border-edge-bright"
                  >
                    <span
                      className={cx(
                        'mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded border-2 text-[12px]',
                        read ? 'border-mint bg-mint text-[#04200f]' : 'border-edge text-[#5f5680]',
                      )}
                      aria-hidden="true"
                    >
                      {read ? '✓' : ''}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-sans text-[15px] font-semibold leading-snug text-white">
                        {page.title}
                      </span>
                      <span className="mt-1 block text-[13px] leading-relaxed text-[#8f86b5]">
                        {page.summary}
                      </span>
                      <span className="mt-2 block font-screen text-[10px] uppercase tracking-wide text-[#6f6496]">
                        {page.minutes} min read
                      </span>
                    </span>
                  </a>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </Page>
  );
}

/* -------------------------------------------------------------- reader */

export function NoteReader({ pageId }: { pageId: string }) {
  const page = getNotePage(pageId);
  const navigate = useNavigate();
  const { progress, markNoteRead } = useStore();
  const [scrolled, setScrolled] = useState(0);
  const articleRef = useRef<HTMLElement>(null);

  /* Track read progress through the article, and mark the page complete once
     the reader actually reaches the end. */
  useEffect(() => {
    const onScroll = () => {
      const el = articleRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const seen = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 1;
      setScrolled(seen);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [pageId]);

  const siblings = useMemo(() => {
    if (!page) return { prev: null, next: null };
    const index = ALL_NOTE_PAGES.findIndex((p) => p.id === page.id);
    return {
      prev: index > 0 ? ALL_NOTE_PAGES[index - 1] : null,
      next: index >= 0 && index < ALL_NOTE_PAGES.length - 1 ? ALL_NOTE_PAGES[index + 1] : null,
    };
  }, [page]);

  if (!page) {
    return (
      <Page>
        <EmptyState
          title="Page not found"
          detail="That note page does not exist any more."
          action={<Button variant="primary" onClick={() => navigate({ name: 'notes' })}>All notes</Button>}
        />
      </Page>
    );
  }

  const meta = SECTION_BY_ID[page.section];
  const alreadyRead = progress.notesRead.includes(page.id);

  return (
    <Page>
      <BackLink to={{ name: 'notes', section: page.section }} label={`${meta.name} notes`} />

      {/* reading progress */}
      <div className="sticky top-16 z-30 mb-5">
        <ProgressBar value={scrolled} color={meta.color} height={5} label="Reading progress" />
      </div>

      <article ref={articleRef} className="study-sheet mx-auto max-w-3xl p-6 sm:p-10">
        <header className="mb-8 border-b-2 border-paper-edge pb-6">
          <div className="study-label">
            {meta.name} · {page.unitLabel} · {page.minutes} min
          </div>
          <h1 className="mt-3 font-read text-[clamp(1.7rem,4vw,2.4rem)] font-semibold leading-tight text-paper-ink">
            {page.title}
          </h1>
          <p className="mt-3 font-read text-[1.05rem] italic leading-relaxed text-paper-soft">
            {page.summary}
          </p>
        </header>

        <div className="space-y-5">
          {page.blocks.map((block, i) => (
            <NoteBlockView key={i} block={block} />
          ))}
        </div>

        <footer className="mt-10 border-t-2 border-paper-edge pt-7">
          {alreadyRead ? (
            <p className="text-center font-screen text-[12px] uppercase tracking-wide text-[#2f9e63]">
              ✓ Page complete
            </p>
          ) : (
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={() => {
                markNoteRead(page.id);
                sfx.achieve();
              }}
            >
              Mark as read
            </Button>
          )}

          <div className="mt-5 flex items-center justify-between gap-3">
            {siblings.prev ? (
              <a
                href={hrefFor({ name: 'note', page: siblings.prev.id })}
                onClick={() => sfx.select()}
                className="min-w-0 flex-1 text-left"
              >
                <span className="study-label block">Previous</span>
                <span className="mt-0.5 block truncate font-read text-[0.95rem] font-medium text-paper-ink">
                  {siblings.prev.title}
                </span>
              </a>
            ) : (
              <span className="flex-1" />
            )}
            {siblings.next && (
              <a
                href={hrefFor({ name: 'note', page: siblings.next.id })}
                onClick={() => sfx.select()}
                className="min-w-0 flex-1 text-right"
              >
                <span className="study-label block">Next</span>
                <span className="mt-0.5 block truncate font-read text-[0.95rem] font-medium text-paper-ink">
                  {siblings.next.title}
                </span>
              </a>
            )}
          </div>
        </footer>
      </article>
    </Page>
  );
}

/* -------------------------------------------------------------- blocks */

function NoteBlockView({ block }: { block: NoteBlock }) {
  switch (block.type) {
    case 'p':
      return <RichText className="prose-study">{block.text}</RichText>;

    case 'rule':
      return (
        <section className="block-rule">
          {block.title && (
            <h2 className="mb-2 font-sans text-[0.95rem] font-bold uppercase tracking-wide text-[#1c4a5c]">
              {block.title}
            </h2>
          )}
          <RichText as="div" className="prose-study">{block.text}</RichText>
        </section>
      );

    case 'example':
      return (
        <section className="block-example">
          <div className="study-label mb-2">Worked example</div>
          {/* The prompt often carries A-D choices on their own lines. */}
          <RichText as="div" className="prose-study whitespace-pre-line font-medium">
            {block.prompt}
          </RichText>

          <ol className="mt-3 space-y-1.5">
            {block.work.map((step, i) => (
              <li key={i} className="flex gap-3 font-read text-[0.98rem] leading-relaxed text-[#3d4a42]">
                <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-[#d3e9dc] font-sans text-[11px] font-bold text-[#1d6b3f]">
                  {i + 1}
                </span>
                <RichText as="span">{step}</RichText>
              </li>
            ))}
          </ol>

          <div className="mt-3 border-t border-[#c9dfd0] pt-2.5">
            <span className="study-label">Answer</span>{' '}
            <RichText as="span" className="font-read font-semibold text-[#1d6b3f]">
              {block.answer}
            </RichText>
          </div>
        </section>
      );

    case 'list':
      return (
        <section className="rounded-lg border-l-4 border-[#6a4ff0] bg-[#f1eefb] px-5 py-4">
          <h2 className="mb-2.5 font-sans text-[0.95rem] font-bold uppercase tracking-wide text-[#3d2a8c]">
            {block.title}
          </h2>
          <ul className="space-y-2">
            {block.items.map((item, i) => (
              <li key={i} className="flex gap-3 font-read text-[1.02rem] leading-relaxed text-paper-ink">
                <span className="mt-[0.45em] h-1.5 w-1.5 flex-none rounded-full bg-[#6a4ff0]" />
                <RichText as="span">{item}</RichText>
              </li>
            ))}
          </ul>
        </section>
      );

    case 'trap':
      return (
        <section className="block-trap">
          <div className="study-label mb-2.5">Common traps</div>
          <ul className="space-y-2">
            {block.items.map((item, i) => (
              <li key={i} className="flex gap-3 font-read text-[1.02rem] leading-relaxed text-paper-ink">
                <span className="flex-none font-bold text-crimson">✕</span>
                <RichText as="span">{item}</RichText>
              </li>
            ))}
          </ul>
        </section>
      );

    case 'table':
      return (
        <div className="overflow-x-auto rounded-lg border-2 border-paper-edge">
          <table className="study-table">
            <thead>
              <tr>
                {block.head.map((h, i) => (
                  <th key={i} scope="col">
                    <RichText as="span">{h}</RichText>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className={j === 0 ? 'font-semibold' : undefined}>
                      <RichText as="span">{cell}</RichText>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'check':
      return <CheckBlock block={block} />;

    default:
      return null;
  }
}

function CheckBlock({ block }: { block: Extract<NoteBlock, { type: 'check' }> }) {
  const [chosen, setChosen] = useState<number | null>(null);
  const revealed = chosen !== null;

  return (
    <section className="block-check">
      <div className="study-label mb-2.5">Check yourself</div>
      <RichText as="div" className="prose-study mb-4 font-medium">{block.q}</RichText>

      <div className="space-y-2">
        {block.choices.map((choice, i) => {
          const isCorrect = i === block.answer;
          const isChosen = i === chosen;
          return (
            <button
              key={i}
              type="button"
              disabled={revealed}
              onClick={() => {
                setChosen(i);
                if (isCorrect) sfx.correct();
                else sfx.wrong();
              }}
              className={cx(
                'choice',
                revealed && isCorrect && 'choice-correct',
                revealed && isChosen && !isCorrect && 'choice-wrong',
                revealed && 'choice-locked cursor-default',
              )}
            >
              <span className="choice-key">{'ABCD'[i]}</span>
              <RichText as="span" className="min-w-0 flex-1">{choice}</RichText>
            </button>
          );
        })}
      </div>

      {revealed && (
        <div className="mt-4 animate-fadein rounded-lg bg-white/70 px-4 py-3">
          <div
            className="mb-1.5 font-screen text-[11px] uppercase tracking-wide"
            style={{ color: chosen === block.answer ? '#2f9e63' : '#d34a63' }}
          >
            {chosen === block.answer ? '✓ Correct' : '✕ Not quite'}
          </div>
          <RichText as="div" className="font-read leading-relaxed text-paper-ink">
            {block.explain}
          </RichText>
        </div>
      )}
    </section>
  );
}
