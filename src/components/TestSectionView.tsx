/* One timed section, answered the way the real ACT is answered.

   `QuestionRunner` is built for drills: pick, see the verdict, move on. In
   test mode it used to do the same minus the verdict, so a choice advanced
   the moment it was tapped and a mis-tap was permanent. A real section is an
   answer sheet you can walk around: mark a letter, change it, skip ahead,
   flag something to come back to, and hand the lot in when you choose (or
   when time is called). This component is that, and nothing else.

   It never knows whether an answer is right. It receives the questions —
   which carry their keys, because they are scored on this device — but
   nothing below reads `correctKey`, `why` or `whyGeneral`. The verdicts are
   computed by the parent after the section is submitted. */

import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { SectionProgress } from '@/lib/testSession';
import { paceHint } from '@/lib/progress';
import { sfx } from '@/lib/sfx';
import { useDialogFocus } from '@/lib/useDialogFocus';
import { cx, formatClock } from '@/lib/utils';
import type { RunnableQuestion } from './QuestionRunner';
import { RichText } from './RichText';
import { PassagePanel } from './PassagePanel';
import { Button } from './ui';
import { Glyph } from './Icon';
import { ToolDock } from './Tools';
import { TestReviewGrid } from './TestReviewGrid';

interface Props {
  questions: RunnableQuestion[];
  progress: SectionProgress;
  title: string;
  subtitle: string;
  accent: string;
  /** Absolute wall-clock time the section ends. */
  deadline: number;
  /** The section's full allowance in seconds, for the pacing hint. */
  limitSec: number;
  /** Shown once above the section, e.g. after a resume. */
  notice?: string | null;
  onSelect: (qid: string, key: string) => void;
  onFlag: (qid: string) => void;
  onMove: (index: number) => void;
  onSubmit: () => void;
  onExpire: () => void;
  onExit: () => void;
}

type Confirm = 'submit' | 'exit' | null;

export function TestSectionView({
  questions,
  progress,
  title,
  subtitle,
  accent,
  deadline,
  limitSec,
  notice,
  onSelect,
  onFlag,
  onMove,
  onSubmit,
  onExpire,
  onExit,
}: Props) {
  const [confirm, setConfirm] = useState<Confirm>(null);
  const choiceEls = useRef<Record<string, HTMLButtonElement | null>>({});
  /* The HUD, which is where a question begins. */
  const topRef = useRef<HTMLDivElement>(null);
  const promptId = useId();

  const index = Math.min(progress.cursor, questions.length - 1);
  const question = questions[index];
  const ids = questions.map((q) => q.id);
  const answeredCount = ids.filter((id) => progress.answers[id]).length;
  const unanswered = ids.length - answeredCount;
  const chosen = question ? (progress.answers[question.id] ?? null) : null;
  const flagged = question ? progress.flags.includes(question.id) : false;
  const isFirst = index === 0;
  const isLast = index === questions.length - 1;

  /* Moving to another question brings its top into view. On a phone the
     choices sit below the fold, and Next pressed from the bottom of one long
     stem otherwise left you staring at the middle of the next. */
  const go = (i: number) => {
    if (i < 0 || i >= questions.length || i === index) return;
    onMove(i);
    /* Only when the top is already out of sight: on a screen tall enough to
       show the whole question, jumping the page on every Next is noise. */
    const el = topRef.current;
    if (el && el.getBoundingClientRect().top < 120) {
      el.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior });
    }
  };

  /* Keyboard: A–D or 1–4 marks a choice, ← and → step between questions.
     Nothing advances on its own — marking is not moving, here or on paper. */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (confirm || !question) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      /* Not always an element: a key with nothing focused can target the
         window or the document, which have no `closest`. */
      const target = e.target instanceof Element ? (e.target as HTMLElement) : null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      /* The calculator takes digits and letters of its own; see QuestionRunner. */
      if (e.defaultPrevented || target?.closest('[role="application"],[role="dialog"]')) return;

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        go(index + (e.key === 'ArrowRight' ? 1 : -1));
        return;
      }
      const letter = 'abcd'.indexOf(e.key.toLowerCase());
      const digit = '1234'.indexOf(e.key);
      const idx = letter >= 0 ? letter : digit;
      if (idx >= 0 && idx < question.choices.length) {
        e.preventDefault();
        sfx.select();
        onSelect(question.id, question.choices[idx]!.key);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  if (!question) return null;

  return (
    <div>
      <SectionTimer
        deadline={deadline}
        limitSec={limitSec}
        color={accent}
        answered={answeredCount}
        totalQuestions={questions.length}
        onExpire={onExpire}
        onSubmit={() => setConfirm('submit')}
      />

      {notice && (
        <p
          role="status"
          className="mb-4 rounded-lg border-2 border-gold-deep/60 bg-leather-850 px-4 py-3 text-[13px] leading-relaxed text-parchment-dim"
        >
          {notice}
        </p>
      )}

      {/* ------------------------------------------------------------- HUD */}
      <div ref={topRef} className="panel relative mb-5 scroll-mt-32 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="min-w-0">
            <h1 className="heading truncate text-[15px]" style={{ color: accent }}>
              {title}
            </h1>
            <p className="mt-1 text-[13px] text-ink-faint">
              {subtitle} · Question <span className="num text-parchment-dim">{index + 1}</span> of{' '}
              <span className="num text-parchment-dim">{questions.length}</span>
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <ToolDock placement="inline" mathHint={question.section === 'math'} />
            <Button
              size="sm"
              variant="ghost"
              className="min-h-11"
              onClick={() => setConfirm('exit')}
            >
              Exit test
            </Button>
          </div>
        </div>
      </div>

      {/* `grid-cols-1` is minmax(0, 1fr); see QuestionRunner for why a bare
          grid overflowed a phone on passage questions. */}
      <div className={cx('grid grid-cols-1 gap-5', question.passage && 'xl:grid-cols-2')}>
        {question.passage && <PassagePanel key={question.passage.id} passage={question.passage} />}

        <div className="task-well">
          <div className="min-w-0 flex-1">
            <div className="task-card">
              <div className="mb-5 flex items-center gap-2">
                <span className="label-quill min-w-0 truncate">{question.topic}</span>
                {flagged && (
                  <span className="ml-auto flex-none rounded bg-[#f4d37a] px-2 py-0.5 font-script text-[10px] uppercase tracking-wide text-[#2a2008]">
                    <Glyph name="flag" size={11} className="mr-1 inline-block align-[-1px]" />
                    Flagged
                  </span>
                )}
              </div>

              {question.label && (
                <p className="mb-4 border-l-4 border-paper-deep bg-paper-light px-4 py-3 font-read text-[1.02rem] leading-relaxed">
                  <RichText as="span" format="html">
                    {question.label}
                  </RichText>
                </p>
              )}

              <div className="prose-quill" id={promptId}>
                <RichText as="div" format={question.promptFormat}>
                  {question.prompt}
                </RichText>
              </div>
            </div>

            {/* A radio group that stays live: marking a choice is a selection,
                not a submission, so nothing is disabled and a second tap on
                another letter simply moves the mark. Keyed per question so the
                roving focus does not carry a stale index across. */}
            <div
              key={question.id}
              className="mt-4 space-y-2.5"
              role="radiogroup"
              aria-labelledby={promptId}
            >
              {question.choices.map((choice, i) => {
                const isChosen = choice.key === chosen;
                return (
                  <button
                    key={choice.key}
                    ref={(el) => {
                      choiceEls.current[choice.key] = el;
                    }}
                    type="button"
                    role="radio"
                    aria-checked={isChosen}
                    tabIndex={(chosen ? isChosen : i === 0) ? 0 : -1}
                    className={cx('choice', isChosen && 'choice-selected')}
                    onClick={() => {
                      sfx.select();
                      onSelect(question.id, choice.key);
                    }}
                    onKeyDown={(e) => {
                      const step =
                        e.key === 'ArrowDown' || e.key === 'ArrowRight'
                          ? 1
                          : e.key === 'ArrowUp' || e.key === 'ArrowLeft'
                            ? -1
                            : 0;
                      if (!step) return;
                      /* Inside the group the arrows move between options, as in
                         every radio group; preventDefault keeps the page-level
                         ←/→ from also changing the question. */
                      e.preventDefault();
                      const n = question.choices.length;
                      const next = question.choices[(i + step + n) % n]!;
                      choiceEls.current[next.key]?.focus();
                    }}
                  >
                    <span className="choice-key">{'ABCD'[i] ?? choice.key}</span>
                    <RichText as="span" format={choice.format} className="min-w-0 flex-1">
                      {choice.text}
                    </RichText>
                  </button>
                );
              })}
            </div>

            {/* Prev, Flag, Next — in the flow under the choices rather than
                pinned to the bottom of the screen, where the calculator's
                sheet opens on a phone. Three equal columns so the row fits
                320px without wrapping. */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Button
                variant="ghost"
                className="min-h-11 px-2"
                disabled={isFirst}
                onClick={() => go(index - 1)}
                aria-label="Previous question"
              >
                <Glyph name="arrowLeft" size={16} />
                <span>Prev</span>
              </Button>
              <Button
                variant="ghost"
                className={cx('min-h-11 px-2', flagged && 'border-gold text-gold')}
                aria-pressed={flagged}
                onClick={() => onFlag(question.id)}
              >
                <Glyph name="flag" size={16} />
                <span>{flagged ? 'Flagged' : 'Flag'}</span>
              </Button>
              {isLast ? (
                <Button
                  variant="primary"
                  className="min-h-11 px-2"
                  onClick={() => setConfirm('submit')}
                >
                  Submit
                </Button>
              ) : (
                <Button
                  variant="primary"
                  className="min-h-11 px-2"
                  trailing
                  onClick={() => go(index + 1)}
                  aria-label="Next question"
                >
                  Next
                </Button>
              )}
            </div>

            <p className="mt-3 hidden px-1 text-[12px] text-ink-faint sm:block [@media(pointer:coarse)]:hidden">
              <Kbd>A</Kbd>–<Kbd>D</Kbd> to mark an answer, the left and right arrow keys to move.
              You can change any answer until you submit the section.
            </p>
          </div>
        </div>
      </div>

      <TestReviewGrid
        ids={ids}
        answers={progress.answers}
        flags={progress.flags}
        current={index}
        onJump={go}
        accent={accent}
      />

      {/* Room at the foot of the page, so the last row of the grid can be
          scrolled clear of a calculator sheet docked to the bottom edge. */}
      <div aria-hidden className="h-24 sm:h-8" />

      {confirm === 'submit' && (
        <ConfirmDialog
          title="Submit this section?"
          body={
            unanswered > 0
              ? `${unanswered} of ${questions.length} questions ${unanswered === 1 ? 'is' : 'are'} still unanswered. Blanks count as wrong, so a guess is worth more. You cannot come back to this section once it is submitted.`
              : `All ${questions.length} questions answered${progress.flags.length ? `, ${progress.flags.length} flagged for review` : ''}. You cannot come back to this section once it is submitted.`
          }
          confirmLabel="Submit section"
          cancelLabel="Keep working"
          onConfirm={() => {
            setConfirm(null);
            onSubmit();
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'exit' && (
        <ConfirmDialog
          title="Exit the test?"
          body="Your progress in this test will be saved for 24 hours, and you can resume from Timed practice. The section clock keeps running while you are away, as it would on the real ACT."
          confirmLabel="Exit and save"
          cancelLabel="Stay"
          onConfirm={() => {
            setConfirm(null);
            onExit();
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="rounded border border-leather-700 bg-leather-800 px-1.5 py-0.5 font-mono text-[11px] text-parchment-dim">
      {children}
    </kbd>
  );
}

/* ---------------------------------------------------------------- timer */

function SectionTimer({
  deadline,
  limitSec,
  color,
  onExpire,
  onSubmit,
  answered,
  totalQuestions,
}: {
  deadline: number;
  limitSec: number;
  color: string;
  onExpire: () => void;
  onSubmit: () => void;
  /** Questions answered so far, for the mid-section pacing checkpoint. */
  answered: number;
  totalQuestions: number;
}) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.ceil((deadline - Date.now()) / 1000)),
  );
  const firedRef = useRef(false);
  /* A resumed section can open with less than five minutes left; it should
     not chime the warning as though the threshold had just been crossed. */
  const warnedRef = useRef(remaining <= 300);
  /* Held in a ref so a parent re-render does not restart the interval. */
  const expire = useRef(onExpire);
  useEffect(() => {
    expire.current = onExpire;
  });

  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);
      /* `<=`, not `===`: a throttled background tab can tick past 300. */
      if (left <= 300 && left > 0 && !warnedRef.current) {
        warnedRef.current = true;
        sfx.warn();
      }
      if (left <= 0 && !firedRef.current) {
        firedRef.current = true;
        expire.current();
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    /* A tab coming back from the background should not show a stale clock
       for up to a second, or miss an expiry that happened while it slept. */
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [deadline]);

  const urgent = remaining <= 300;
  const critical = remaining <= 60;
  const hint = paceHint(
    answered,
    limitSec > 0 ? totalQuestions : 0,
    limitSec > 0 ? (limitSec - remaining) / limitSec : 0,
  );

  return (
    <div
      className={cx(
        'sticky top-14 z-40 mb-4 rounded-lg border-2 px-3 py-2 backdrop-blur sm:px-5 sm:py-3 lg:top-3',
        critical
          ? 'border-blood bg-blood/15'
          : urgent
            ? 'border-gold bg-leather-850/95'
            : 'border-leather-700 bg-leather-850/95',
      )}
    >
      <div className="flex items-center gap-3">
        <div role="timer" aria-live="off" className="flex min-w-0 items-center gap-3">
          <span className="hidden font-script text-[10px] uppercase tracking-[0.16em] text-ink-faint sm:inline">
            Time remaining
          </span>
          <span className="sr-only sm:hidden">Time remaining</span>
          <span
            className={cx(
              'num text-[24px] leading-none sm:text-[26px]',
              critical && 'animate-shimmer',
            )}
            style={{
              color: critical
                ? 'oklch(var(--c-blood-text))'
                : urgent
                  ? 'oklch(var(--c-gold))'
                  : color,
            }}
          >
            {formatClock(remaining)}
          </span>
        </div>
        {/* At the top, in the bar that never scrolls away, so the one control
            that ends the section is always reachable and never sits under the
            calculator's bottom sheet. */}
        <Button variant="danger" size="sm" className="ml-auto min-h-11" onClick={onSubmit}>
          Submit<span className="hidden sm:inline">&nbsp;section</span>
        </Button>
      </div>
      {/* Polite, not assertive: this must never cut across what a screen
          reader is already reading. */}
      <div aria-live="polite" className="sr-only">
        {hint ?? ''}
      </div>
      {hint && (
        <div
          aria-hidden
          className="mt-1.5 border-t border-leather-700/70 pt-1.5 text-right text-[12px] text-gold"
        >
          {hint}
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- confirm */

/* A real dialog rather than `window.confirm`: the browser's box cannot say
   how many questions are blank in a way that is easy to read, it blocks the
   section clock's repaint, and on iOS it can be suppressed outright after a
   few uses. Portalled to <body> so `useDialogFocus` can mark everything else
   inert. */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  danger = true,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const bodyId = useId();
  useDialogFocus(ref as RefObject<HTMLElement | null>, true, onCancel);

  return createPortal(
    <div
      ref={ref}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-[rgba(12,9,6,0.72)] p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="panel w-full max-w-sm p-6 text-left">
        <h2 id={titleId} className="heading text-[1.05rem] text-parchment">
          {title}
        </h2>
        <p id={bodyId} className="mt-3 text-[14px] leading-relaxed text-parchment-dim">
          {body}
        </p>
        {/* Cancel first in the DOM, so the focus trap lands on the safe
            choice and an Enter pressed out of habit does not submit. */}
        <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <Button variant="ghost" className="min-h-11" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} className="min-h-11" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
