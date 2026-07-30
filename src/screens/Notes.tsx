/* The notes library and the note reader.

   This is the longest-form reading in the app, so it commits fully to the
   study register: warm paper, serif body at a 66-character measure, and a
   single unbroken column. Nothing on the page is filled — each part is named
   by a coloured label instead, because five differently tinted boxes on cream
   parchment read as white cards punched into the sheet. The only arcade
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
              'rounded-lg border-2 px-4 py-2 font-script text-[12px] uppercase tracking-wide transition-colors',
              s.id === active ? 'text-[#0d0620]' : 'border-leather-700 bg-leather-850 text-parchment-dim hover:text-white',
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
        <span className="flex-none font-script text-[11px] uppercase tracking-wide text-ink-faint">
          {readInSection}/{totalInSection}
        </span>
      </div>

      <div className="space-y-6">
        {units.map((unit) => (
          <section key={unit.id}>
            <h2 className="heading mb-3 text-[12px]" style={{ color: meta.color }}>
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
                    className="group flex items-start gap-4 rounded-lg border-2 border-leather-700 bg-leather-850 p-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-gold-deep"
                  >
                    <span
                      className={cx(
                        'mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded border-2 text-[12px]',
                        read ? 'border-woods bg-woods text-[#04200f]' : 'border-leather-700 text-ink-faint',
                      )}
                      aria-hidden="true"
                    >
                      {read ? '✓' : ''}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-sans text-[15px] font-semibold leading-snug text-white">
                        {page.title}
                      </span>
                      <span className="mt-1 block text-[13px] leading-relaxed text-ink-faint">
                        {page.summary}
                      </span>
                      <span className="mt-2 block font-script text-[10px] uppercase tracking-wide text-ink-faint">
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

      <article ref={articleRef} className="sheet mx-auto max-w-3xl p-6 sm:p-10">
        <header className="mb-8 border-b-2 border-parchment-edge pb-6">
          <div className="label-quill">
            {meta.name} · {page.unitLabel} · {page.minutes} min
          </div>
          <h1 className="mt-3 font-read text-[clamp(1.7rem,4vw,2.4rem)] font-semibold leading-tight text-ink">
            {page.title}
          </h1>
          <p className="mt-3 font-read text-[1.05rem] italic leading-relaxed text-ink-soft">
            {page.summary}
          </p>
        </header>

        {/* One column at a reading measure. The spacing between parts comes
            from .lesson, so nothing needs a fill to look separated. */}
        <div className="lesson">
          {page.blocks.map((block, i) => (
            <NoteBlockView key={i} block={block} />
          ))}
        </div>

        <footer className="mt-10 border-t-2 border-parchment-edge pt-7">
          {alreadyRead ? (
            <p className="text-center font-script text-[12px] uppercase tracking-wide text-[#2f6b3a]">
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
                <span className="label-quill block">Previous</span>
                <span className="mt-0.5 block truncate font-read text-[0.95rem] font-medium text-ink">
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
                <span className="label-quill block">Next</span>
                <span className="mt-0.5 block truncate font-read text-[0.95rem] font-medium text-ink">
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
      return <RichText className="prose-quill">{block.text}</RichText>;

    case 'rule':
      return (
        <section className="ink-rule">
          {block.title && <h2 className="lesson-label">{block.title}</h2>}
          <RichText as="div" className="prose-quill">{block.text}</RichText>
        </section>
      );

    case 'example':
      return (
        <section className="ink-example">
          <div className="lesson-label">Worked example</div>
          {/* The prompt often carries A-D choices on their own lines. */}
          <RichText as="div" className="prose-quill whitespace-pre-line font-medium">
            {block.prompt}
          </RichText>

          <ol className="lesson-steps">
            {block.work.map((step, i) => (
              <li key={i}>
                <RichText as="span">{step}</RichText>
              </li>
            ))}
          </ol>

          <p className="mt-3.5 font-read text-[1.02rem] leading-relaxed text-ink">
            <span className="label-quill">Answer</span>{' '}
            <RichText as="span" className="font-semibold text-[#2f6b3a]">
              {block.answer}
            </RichText>
          </p>
        </section>
      );

    case 'list':
      return (
        <section className="ink-list">
          <h2 className="lesson-label">{block.title}</h2>
          <ul className="lesson-items">
            {block.items.map((item, i) => (
              <li key={i}>
                <RichText as="span">{item}</RichText>
              </li>
            ))}
          </ul>
        </section>
      );

    case 'trap':
      return (
        <section className="ink-trap lesson-trap">
          <div className="lesson-label">Common traps</div>
          <ul className="lesson-items lesson-items-x">
            {block.items.map((item, i) => (
              <li key={i}>
                <RichText as="span">{item}</RichText>
              </li>
            ))}
          </ul>
        </section>
      );

    case 'table':
      return (
        <div className="overflow-x-auto rounded-lg border-2 border-parchment-edge">
          <table className="quill-table">
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
    <section className="ink-check lesson-check">
      <div className="lesson-label">Check yourself</div>
      <RichText as="div" className="prose-quill mb-4 font-medium">{block.q}</RichText>

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

      {/* The verdict used to sit on a white card, which on parchment looked
          like a hole in the page. It is a coloured label now. */}
      {revealed && (
        <div className="mt-4 animate-fadein">
          <div
            className="mb-1.5 font-script text-[11.5px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: chosen === block.answer ? '#2f6b3a' : '#9c3326' }}
          >
            {chosen === block.answer ? '✓ Correct' : '✕ Not quite'}
          </div>
          <RichText as="div" className="font-read text-[1.02rem] leading-[1.72] text-ink">
            {block.explain}
          </RichText>
        </div>
      )}
    </section>
  );
}
