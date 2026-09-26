/* One question-answering experience, shared by drills, zone quizzes and
   review sessions.

   Everything upstream normalises into `RunnableQuestion`, so the interaction,
   the keyboard shortcuts and the explanation layout are identical no matter
   where a question came from. The reading surface is the study register —
   warm paper, real type — while the surrounding HUD stays arcade. */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Difficulty, Passage, SectionId } from '@/types';
import { juice } from '@/lib/juice';
import { sfx } from '@/lib/sfx';
import { cx, formatClock } from '@/lib/utils';
import { AnimatePresence, m, SPRING, SPRING_SNAP, useReducedMotion } from '@/lib/motion';
import { RichText } from './RichText';
import { PassagePanel } from './PassagePanel';
import { Button, LEADING_ICON } from './ui';
import { Glyph } from './Icon';
import { QuestionActions } from './QuestionActions';
import { ToolDock } from './Tools';

export interface RunnableChoice {
  key: string;
  text: string;
  format: 'html' | 'markdown';
}

export interface RunnableQuestion {
  id: string;
  prompt: string;
  promptFormat: 'html' | 'markdown';
  choices: RunnableChoice[];
  correctKey: string;
  /** Per-choice explanation. Falls back to `whyGeneral` when a key is absent. */
  why: Record<string, string>;
  whyGeneral?: string;
  topic: string;
  /* One of the four real sections, always. There is no fifth. A zone question
     is an English (or math, or …) question that happens to be reached through
     a landmark, and it used to say `'zone'` here — see `fromZoneQuestion`. */
  section: SectionId;
  difficulty: Difficulty;
  passage?: Passage;
  /** Shown above the stem, e.g. the underlined sentence for English. */
  label?: string;
}

export interface AnswerRecord {
  question: RunnableQuestion;
  chosen: string | null;
  correct: boolean;
  ms: number;
}

interface Props {
  questions: RunnableQuestion[];
  /** Called once per answered question, as it happens. */
  onAnswer: (record: AnswerRecord) => void;
  onFinish: (records: AnswerRecord[]) => void;
  onQuit?: () => void;
  title: string;
  subtitle?: string;
  accent?: string;
  /** Hide explanations until the very end, the way a real test does. */
  deferFeedback?: boolean;
}

/* ------------------------------------------------------- reward escalation

   Every correct answer used to look exactly like every other correct answer,
   which is why a run of eight never felt like anything. Three tiers, so the
   feedback grows with the streak and the player can feel it accumulating:

     1  (1-2)  the gilt edge draws onto the row and the seal lands
     2  (3-5)  the streak chip grows
     3  (6+)   the chip catches fire

   Two things used to sit on top of that: a burst of gold particles thrown out
   of the answer row, and a full-screen flare at tiers 2 and 3. Both are gone.
   Confetti over a live passage reads as a z-index bug rather than as polish,
   and the flare was a second screen-wide effect stacked on the one the impact
   bus already fires. The reward lives on the row that earned it now — see
   `.choice-correct` and `.choice-seal` — which is both quieter and more
   pointed. The audio escalation is untouched: `sfx.combo(n)` still walks up a
   pentatonic scale, and it is now carrying the tiering on its own above 3.

   `streakTier` stays because the chip still reads from it. */
type Tier = 0 | 1 | 2 | 3;

function streakTier(streak: number): Tier {
  if (streak >= 6) return 3;
  if (streak >= 3) return 2;
  if (streak >= 1) return 1;
  return 0;
}

/* How long the right answer waits before lighting up, when you got it wrong.
   The order is the message: the row you picked shakes and goes quiet, and
   only then does the correct one arrive. Simultaneous reads as "here are two
   coloured rows"; sequenced reads as "not that — this". */
const REVEAL_LAG = 0.3;

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};
/* These sit on paper, so they are inks rather than the bright accents used on
   the dark chrome — the previous neon set measured about 1:1 against a cream
   background.

   Each is measured against the pill's *own* background, not against bare
   paper: the pill tints itself with the same ink at `22` alpha, which lifts
   the surface toward the text and costs roughly a third of a point. At the
   earlier values easy read 4.40 and medium 4.10 against their own tint —
   below AA while looking fine on paper alone. These clear 5.0 there and 6.0
   on bare paper, so the tint can change without dropping under the line. */
const DIFFICULTY_COLOR: Record<Difficulty, string> = {
  easy: 'oklch(var(--c-feedback-correct))',
  medium: 'oklch(var(--c-feedback-medium))',
  hard: 'oklch(var(--c-feedback-wrong))',
};

/** Strip markup and assemble the question as one spoken passage.
 *
 *  The choices are announced by letter because four sentences read back to
 *  back with nothing between them is unusable — you cannot answer "B" if you
 *  never heard which one B was. */
function spokenForm(question: RunnableQuestion): string {
  const plain = (html: string) =>
    html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const parts = [
    question.label ? plain(question.label) : '',
    plain(question.prompt),
    ...question.choices.map((c, i) => `Option ${'ABCD'[i] ?? c.key}. ${plain(c.text)}`),
  ];
  return parts.filter(Boolean).join('. ');
}

export function QuestionRunner({
  questions,
  onAnswer,
  onFinish,
  onQuit,
  title,
  subtitle,
  accent = 'oklch(var(--c-gold))',
  deferFeedback = false,
}: Props) {
  const reducedMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [records, setRecords] = useState<AnswerRecord[]>([]);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [streak, setStreak] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  /* The correct row lights on its own beat, not on `revealed` — see REVEAL_LAG. */
  const [litCorrect, setLitCorrect] = useState(false);

  const litTimer = useRef<number | null>(null);
  const choiceEls = useRef<Record<string, HTMLButtonElement | null>>({});

  const question = questions[index];
  const isLast = index === questions.length - 1;
  const promptId = useId();

  useEffect(
    () => () => {
      if (litTimer.current) window.clearTimeout(litTimer.current);
    },
    [],
  );

  // Session clock, for the summary.
  useEffect(() => {
    const id = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const commit = useCallback(
    (key: string) => {
      if (revealed || !question) return;

      const correct = key === question.correctKey;
      const ms = Date.now() - startedAt;
      const record: AnswerRecord = { question, chosen: key, correct, ms };

      setChosen(key);
      setRevealed(true);
      setStreak(correct ? streak + 1 : 0);
      setRecords((prev) => [...prev, record]);
      onAnswer(record);

      if (deferFeedback) {
        sfx.select();
      } else if (correct) {
        /* One call rather than a sound here and visuals scattered below: the
           bus fires the sound at contact, holds a beat, then kicks the stage
           and washes the screen. `visuals` is off in test mode because a timed
           test does not tell you how you did until the end. */
        juice.correct({ visuals: !deferFeedback });
        if (streak >= 1) juice.combo(streak + 1, { visuals: !deferFeedback });

        /* Right first time, so there is nothing to disambiguate: light it now.
           The gilt edge and the seal are CSS on the row itself, so there is
           nothing else to fire here. */
        setLitCorrect(true);
      } else {
        juice.wrong({ visuals: !deferFeedback });
        litTimer.current = window.setTimeout(() => setLitCorrect(true), REVEAL_LAG * 1000);
      }

      // In test mode there is nothing to read, so move straight on.
      if (deferFeedback) {
        window.setTimeout(() => advance([...records, record]), 120);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [revealed, question, startedAt, streak, onAnswer, deferFeedback, records],
  );

  const advance = useCallback(
    (allRecords: AnswerRecord[]) => {
      if (isLast) {
        onFinish(allRecords);
        return;
      }
      if (litTimer.current) window.clearTimeout(litTimer.current);
      /* Clamped. `advance` refuses to step past the last question, but it
         reads `isLast` from the render that queued it — so two advances
         queued before either commits both pass the guard and walk the index
         off the end. `question` is then undefined, and the early return
         thirty lines down renders *nothing*: a blank screen with no controls
         and no way back, which is the worst possible shape for an otherwise
         harmless race. Landing on the last question instead leaves "See
         results" sitting under the finger that caused it. */
      setIndex((i) => Math.min(i + 1, questions.length - 1));
      setChosen(null);
      setRevealed(false);
      setLitCorrect(false);
      setStartedAt(Date.now());
    },
    [isLast, onFinish, questions.length],
  );

  /* Keyboard: A-D (or 1-4) to answer, Enter/Space to continue. */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
      /* A key another control already used, or one typed into a tool panel.
         The calculator takes digits, `c` and Enter, and without this every
         one of them also answered the question underneath it. */
      if (e.defaultPrevented || target?.closest('[role="application"],[role="dialog"]')) return;

      if (!revealed && question) {
        const letterIndex = 'abcd'.indexOf(e.key.toLowerCase());
        const numberIndex = '1234'.indexOf(e.key);
        const idx = letterIndex >= 0 ? letterIndex : numberIndex;
        // Bounds-checked on the line above.
        if (idx >= 0 && idx < question.choices.length) {
          e.preventDefault();
          commit(question.choices[idx]!.key);
        }
        return;
      }
      /* Enter on Bookmark, Report or Exit should press that button, not skip
         the question. And in test mode the reveal lasts 120ms before the
         automatic advance, so a key in that window advanced twice — a question
         never shown, or a finished test recorded twice. */
      const onOtherControl =
        !!target?.closest('button, a') && !target.closest('[role="radiogroup"]');
      if (deferFeedback || onOtherControl) return;
      if (revealed && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        advance(records);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [revealed, question, commit, advance, records, deferFeedback]);

  const correctSoFar = useMemo(() => records.filter((r) => r.correct).length, [records]);
  const tier = streakTier(streak);

  if (!question) return null;

  const explanationForChosen = chosen ? question.why[chosen] : undefined;
  const explanationForCorrect = question.why[question.correctKey];
  const gotItRight = chosen === question.correctKey;

  return (
    <div>
      {/* ------------------------------------------------------------- HUD */}
      <div className="panel mb-5 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="min-w-0">
            <h1 className="heading truncate text-[13px]" style={{ color: accent }}>
              {title}
            </h1>
            {subtitle && <p className="mt-1 text-[13px] text-ink-faint">{subtitle}</p>}
          </div>

          <div className="ml-auto flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            {/* The chip is the running total of the escalation: it grows with
                the tier, and at tier 3 it is visibly alight. Losing a streak
                gets a real exit — it drops and tumbles out — because a reward
                that simply vanishes was never felt as a reward. */}
            <AnimatePresence>
              {!deferFeedback && streak >= 2 && (
                <m.span
                  key="streak"
                  className={cx(
                    'chip',
                    tier === 3 ? 'chip-ablaze text-desert-text' : 'text-desert-text',
                  )}
                  style={{
                    borderColor:
                      tier === 3
                        ? 'oklch(var(--c-desert-text))'
                        : tier === 2
                          ? 'oklch(var(--c-desert-text)/.7)'
                          : 'oklch(var(--c-desert-text)/.4)',
                    transformOrigin: 'center',
                  }}
                  initial={{ opacity: 0, scale: 0.5, y: 8 }}
                  animate={{ opacity: 1, y: 0, scale: tier === 3 ? 1.16 : tier === 2 ? 1.07 : 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.7, rotate: -12 }}
                  transition={SPRING_SNAP}
                >
                  <Glyph name="flame" size={13} className="mr-1 inline-block align-[-2px]" />
                  {streak} in a row
                </m.span>
              )}
            </AnimatePresence>

            <span className="chip">
              <span className="num text-[15px] text-parchment">{formatClock(elapsed)}</span>
            </span>

            {/* The count is no longer a chip. The rail down the task column is
                the progress signal now; this is the exact number, kept for the
                reader who wants it and for anyone on a screen reader, at the
                weight a secondary reading deserves. */}
            <span className="font-script text-[11px] uppercase tracking-[0.14em] text-ink-faint">
              Question <span className="num text-parchment-dim">{index + 1}</span> of{' '}
              <span className="num text-parchment-dim">{questions.length}</span>
            </span>

            {/* Calculator and scratch paper, labelled and in the header.
                The real exam permits both. The calculator gets a first-visit
                nudge on Math and nowhere else, because that is the only
                section where not knowing it exists changes how you would have
                worked the problem. */}
            <ToolDock placement="inline" mathHint={question.section === 'math'} />

            {onQuit && (
              <Button size="sm" variant="ghost" onClick={onQuit}>
                Exit
              </Button>
            )}
          </div>
        </div>

        {!deferFeedback && records.length > 0 && (
          <p className="mt-3 font-script text-[10px] uppercase tracking-wide text-ink-faint">
            {correctSoFar} correct of {records.length} answered
          </p>
        )}
      </div>

      {/* ---------------------------------------------------------- content

          Two materials, and the whole point of the layout is that they are
          never confused: the passage is a page, the task column is a leather
          well with paper objects raised out of it. */}
      <div className={cx('grid gap-5', question.passage && 'lg:grid-cols-2')}>
        {/* Keyed so a new passage opens at the top, not scrolled to wherever
            the last one was left. */}
        {question.passage && <PassagePanel key={question.passage.id} passage={question.passage} />}

        {/* The well remounts per question, so every question arrives instead
            of being swapped underneath the reader. Keyed on the index as well
            as the id because a review session can serve the same question
            twice and the second one still has to animate.

            No exit animation on purpose: an outgoing column would have to
            finish before the next mounts, and rAF is frozen in a hidden tab.
            Arriving unconditionally cannot get stuck. */}
        <m.div
          key={`${index}-${question.id}`}
          className="task-well"
          initial={{ opacity: 0, x: 26 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* The rail. Decorative to a screen reader — the count above says
              the same thing in words, and ten unlabelled list items would say
              it far worse. */}
          <div className="rail" aria-hidden="true">
            {questions.map((q, i) => (
              <span
                key={`${i}-${q.id}`}
                className={cx(
                  'rail-tick',
                  i === index
                    ? 'rail-tick-now'
                    : i < index || (i === index && revealed)
                      ? 'rail-tick-done'
                      : '',
                )}
              />
            ))}
          </div>

          <div className="min-w-0 flex-1">
            {/* ------------------------------------------------- the task */}
            <div className="task-card">
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <span className="label-quill">{question.topic}</span>
                <span
                  className="rounded px-2 py-0.5 font-script text-[10px] uppercase tracking-wide"
                  style={{
                    color: DIFFICULTY_COLOR[question.difficulty],
                    background: `color-mix(in oklab, ${DIFFICULTY_COLOR[question.difficulty]} 13%, transparent)`,
                  }}
                >
                  {DIFFICULTY_LABEL[question.difficulty]}
                </span>

                {/* Read aloud, bookmark, report — secondary to answering, so
                    they sit on the metadata line rather than near the choices.
                    Hidden in test mode: none of the three exists on a real
                    exam, and a bookmark you cannot revisit until the test ends
                    is a distraction dressed as a feature. */}
                {!deferFeedback && (
                  <QuestionActions
                    questionId={question.id}
                    spokenText={spokenForm(question)}
                    prompt={question.prompt}
                    topic={question.topic}
                  />
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

            {/* `radiogroup`, not `group`.

                These are four mutually exclusive options where picking one is
                the answer, which is exactly what a radio group is. Under `group`
                a screen reader announced four unrelated buttons and never said
                how many there were or which was chosen; under `radiogroup` it
                says "radio group, A, 1 of 4" and reads the selection back.
                `aria-pressed` came off at the same time — a control cannot be
                both a toggle button and a radio.

                The group is labelled by the stem rather than by the words
                "Answer choices": on entering the group a screen reader reads its
                label, and hearing the question again there is worth more than
                hearing a category name. */}
            <div className="mt-4 space-y-2.5" role="radiogroup" aria-labelledby={promptId}>
              {question.choices.map((choice, i) => {
                const isCorrect = choice.key === question.correctKey;
                const isChosen = choice.key === chosen;
                const wrongPick = !deferFeedback && revealed && isChosen && !isCorrect;
                /* Lit is not the same as correct: after a wrong answer the right
                   row stays dim for REVEAL_LAG, so the two states are separate. */
                const lit = !deferFeedback && revealed && isCorrect && litCorrect;

                const state =
                  !revealed || deferFeedback
                    ? isChosen
                      ? 'choice-selected'
                      : ''
                    : lit
                      ? 'choice-correct'
                      : wrongPick
                        ? 'choice-wrong'
                        : '';

                return (
                  <m.button
                    key={choice.key}
                    ref={(el: HTMLButtonElement | null) => {
                      choiceEls.current[choice.key] = el;
                    }}
                    type="button"
                    onClick={() => commit(choice.key)}
                    disabled={revealed}
                    className={cx('choice', state, revealed && 'choice-locked cursor-default')}
                    role="radio"
                    aria-checked={isChosen}
                    /* Roving tabindex: the group is one stop, and once an answer
                       is on screen the arrow keys move between options the way
                       they do in every other radio group. Before anything is
                       chosen the first option holds the stop, which is the
                       pattern's own rule. */
                    tabIndex={revealed ? -1 : (chosen ? isChosen : i === 0) ? 0 : -1}
                    onKeyDown={(e: React.KeyboardEvent) => {
                      const step =
                        e.key === 'ArrowDown' || e.key === 'ArrowRight'
                          ? 1
                          : e.key === 'ArrowUp' || e.key === 'ArrowLeft'
                            ? -1
                            : 0;
                      if (!step || revealed) return;
                      e.preventDefault();
                      // `i` is this choice's own index, so the wrap lands in range.
                      const n = question.choices.length;
                      const next = question.choices[(i + step + n) % n]!;
                      choiceEls.current[next.key]?.focus();
                    }}
                    initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                    animate={
                      !revealed || reducedMotion
                        ? { opacity: 1, y: 0, x: 0, scale: 1 }
                        : lit
                          ? /* the answer arriving: lifts off the desk and settles */
                            { opacity: 1, y: 0, x: 0, scale: 1 }
                          : wrongPick
                            ? /* a headshake, not a buzzer */
                              { opacity: 1, y: 0, scale: 1, x: [0, -3, 3, -3, 0] }
                            : /* everything else steps back so the eye has two rows to compare */
                              { opacity: 1, y: 0, x: 0, scale: 1 }
                    }
                    transition={
                      !revealed
                        ? { ...SPRING, delay: 0.06 + i * 0.04 }
                        : wrongPick
                          ? /* Four beats at the plan's 90ms each. A single 90ms
                               shake is three frames — a glitch, not a gesture. */
                            { duration: 0.18, ease: 'easeInOut' }
                          : lit
                            ? SPRING_SNAP
                            : { duration: 0.28 }
                    }
                    whileTap={revealed || reducedMotion ? undefined : { scale: 0.995 }}
                  >
                    <span className="choice-key">{'ABCD'[i] ?? choice.key}</span>
                    <RichText as="span" format={choice.format} className="min-w-0 flex-1">
                      {choice.text}
                    </RichText>
                    {/* Decorative, both of them. The verdict reaches a screen
                        reader through the live region below, on its own timing,
                        rather than as a stray mark inside a button label.

                        The seal is where the reward lives now: the confetti
                        that used to burst out of this row and across the
                        passage is gone, and a stamp that lands on the row that
                        earned it says the same thing without covering the
                        text. */}
                    {lit && (
                      <span className="choice-seal" aria-hidden="true">
                        <Glyph name="check" size={15} strokeWidth={2.4} />
                      </span>
                    )}
                    {wrongPick && (
                      <Glyph
                        name="cross"
                        size={16}
                        className="ml-auto flex-none text-[oklch(var(--c-feedback-wrong))]"
                      />
                    )}
                  </m.button>
                );
              })}
            </div>

            {!revealed && (
              <p className="mt-4 px-1 text-[12px] text-ink-faint">
                Tip: press{' '}
                <kbd className="rounded border border-leather-700 bg-leather-800 px-1.5 py-0.5 font-mono text-[11px] text-parchment-dim">
                  A
                </kbd>
                –
                <kbd className="rounded border border-leather-700 bg-leather-800 px-1.5 py-0.5 font-mono text-[11px] text-parchment-dim">
                  D
                </kbd>{' '}
                to answer.
              </p>
            )}

            {/* ----------------------------------------- explanation sheet

                Gated on `litCorrect` rather than `revealed`, so the verdict does
                not appear in text while the rows are still resolving. Reading
                "Not quite" before the shake has finished spoils its own reveal.

                A sheet rising out of the well, not an inline expansion: the
                explanation used to grow the page under the reader, and a
                layout that shifts while you are looking at it is what made the
                reveal feel cheap. */}
            {revealed && litCorrect && !deferFeedback && (
              <m.div
                className="explain-sheet mt-4"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              >
                {/* The one thing that must be spoken. `role="status"` is polite,
                    so it waits for the reader to finish the choice it just moved
                    through instead of cutting it off, and it names the right
                    answer — "Not quite" alone tells a blind student nothing they
                    could not already tell. */}
                {/* Deliberately not `.lesson-label`, which is a flex row: the
                    verdict is the one label in the app long enough to wrap, and
                    a centred flex icon beside wrapped text ends up next to the
                    *second* line. */}
                <m.div
                  className="mb-5 font-script text-[13px] font-semibold uppercase tracking-[0.16em]"
                  style={{
                    color: gotItRight
                      ? 'oklch(var(--c-feedback-correct))'
                      : 'oklch(var(--c-feedback-wrong))',
                  }}
                  role="status"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.26, delay: 0.1 }}
                >
                  <Glyph name={gotItRight ? 'check' : 'cross'} size={15} className={LEADING_ICON} />
                  {gotItRight ? 'Correct' : `Not quite — the answer is ${question.correctKey}`}
                </m.div>

                {/* Both explanations used to be tinted boxes. Unfilled and
                    labelled reads faster, and stacking two of them no longer
                    turns the page into a pile of cards. */}
                {/* The trap first, then the answer, 90ms apart — the same order
                    the rows resolved in, so the page repeats the lesson rather
                    than restating it. */}
                <div className="lesson">
                  {!gotItRight && explanationForChosen && (
                    <m.section
                      className="ink-trap lesson-trap"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.14 }}
                    >
                      <div className="lesson-label">Why {chosen} is wrong</div>
                      <RichText
                        as="div"
                        format="markdown"
                        className="font-read text-[1.02rem] leading-[1.72] text-ink"
                      >
                        {explanationForChosen}
                      </RichText>
                    </m.section>
                  )}

                  {explanationForCorrect && (
                    <m.section
                      className="ink-example"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: gotItRight ? 0.14 : 0.23 }}
                    >
                      <div className="lesson-label">Why {question.correctKey} is right</div>
                      <RichText
                        as="div"
                        format="markdown"
                        className="font-read text-[1.02rem] leading-[1.72] text-ink"
                      >
                        {explanationForCorrect}
                      </RichText>
                    </m.section>
                  )}

                  {!explanationForCorrect && question.whyGeneral && (
                    <m.section
                      className="ink-example"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.14 }}
                    >
                      <div className="lesson-label">Why</div>
                      <RichText
                        as="div"
                        format="html"
                        className="font-read text-[1.02rem] leading-[1.72] text-ink"
                      >
                        {question.whyGeneral}
                      </RichText>
                    </m.section>
                  )}
                </div>

                {/* Arrives last, after the reading has settled. It is still
                    focused immediately, so Enter works before it has finished
                    moving — the animation decorates the button, it does not
                    gate it. */}
                <m.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...SPRING, delay: 0.34 }}
                >
                  <Button
                    variant="primary"
                    size="lg"
                    trailing
                    className="mt-6 w-full"
                    onClick={() => advance(records)}
                    autoFocus
                  >
                    {isLast ? 'See results' : 'Next question'}
                  </Button>
                </m.div>
              </m.div>
            )}
          </div>
        </m.div>
      </div>
    </div>
  );
}
