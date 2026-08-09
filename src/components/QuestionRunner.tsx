/* One question-answering experience, shared by drills, zone quizzes and
   review sessions.

   Everything upstream normalises into `RunnableQuestion`, so the interaction,
   the keyboard shortcuts and the explanation layout are identical no matter
   where a question came from. The reading surface is the study register —
   warm paper, real type — while the surrounding HUD stays arcade. */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Difficulty, Passage, SectionId } from '@/types';
import { sfx } from '@/lib/sfx';
import { cx, formatClock } from '@/lib/utils';
import { AnimatePresence, m, SPRING, SPRING_SNAP } from '@/lib/motion';
import { burstConfetti } from './Feedback';
import { RichText } from './RichText';
import { PassagePanel } from './PassagePanel';
import { Button, ProgressBar } from './ui';
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
  section: SectionId | 'zone';
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

     1  (1-2)  a tick and the row lifting — barely anything
     2  (3-5)  a warm flash at the edges of the screen, the chip grows
     3  (6+)   the chip catches fire, sparks come off the answer

   The audio already escalates — `sfx.combo(n)` walks up a pentatonic scale —
   so this is the picture catching up with the sound. */
type Tier = 0 | 1 | 2 | 3;

function streakTier(streak: number): Tier {
  if (streak >= 6) return 3;
  if (streak >= 3) return 2;
  if (streak >= 1) return 1;
  return 0;
}

/* WCAG 2.3.1 caps flashing at three per second. A player cannot normally
   answer that fast — they have to read — but answer-Enter-answer on the
   keyboard can get close, so the flare refuses to retrigger inside this
   window rather than trusting them not to. */
const FLARE_FLOOR_MS = 340;

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
/* These sit on parchment, so they are inks rather than the bright accents
   used on the dark chrome — the previous neon set measured about 1:1 against
   a cream background. */
const DIFFICULTY_COLOR: Record<Difficulty, string> = {
  easy: '#2f6b3a',
  medium: '#8a5a12',
  hard: '#9c3326',
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
  accent = '#ffd23e',
  deferFeedback = false,
}: Props) {
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [records, setRecords] = useState<AnswerRecord[]>([]);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [streak, setStreak] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  /* The correct row lights on its own beat, not on `revealed` — see REVEAL_LAG. */
  const [litCorrect, setLitCorrect] = useState(false);
  const [flare, setFlare] = useState<{ id: number; tier: Tier } | null>(null);

  const litTimer = useRef<number | null>(null);
  const lastFlareAt = useRef(0);
  const flareId = useRef(0);
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

      if (correct) {
        sfx.correct();
        if (streak >= 1) sfx.combo(streak + 1);

        /* Right first time, so there is nothing to disambiguate: light it now. */
        setLitCorrect(true);

        const tier = streakTier(streak + 1);
        const now = Date.now();
        if (tier >= 2 && !deferFeedback && now - lastFlareAt.current > FLARE_FLOOR_MS) {
          lastFlareAt.current = now;
          setFlare({ id: flareId.current++, tier });
        }
        /* Sparks come off the answer itself rather than the middle of the
           screen, so the celebration points at what earned it. */
        if (tier === 3 && !deferFeedback) {
          const box = choiceEls.current[key]?.getBoundingClientRect();
          if (box) burstConfetti(18, box.right - 34, box.top + box.height / 2, 9);
        }
      } else {
        sfx.wrong();
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
      setIndex((i) => i + 1);
      setChosen(null);
      setRevealed(false);
      setLitCorrect(false);
      setStartedAt(Date.now());
    },
    [isLast, onFinish],
  );

  /* Keyboard: A-D (or 1-4) to answer, Enter/Space to continue. */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;

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
      if (revealed && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        advance(records);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [revealed, question, commit, advance, records]);

  const correctSoFar = useMemo(() => records.filter((r) => r.correct).length, [records]);
  const tier = streakTier(streak);

  if (!question) return null;

  const explanationForChosen = chosen ? question.why[chosen] : undefined;
  const explanationForCorrect = question.why[question.correctKey];

  return (
    <div>
      {/* ------------------------------------------------------------- HUD */}
      <div className="mb-5 rounded-xl border-2 border-leather-700 bg-leather-850 p-4 shadow-card sm:p-5">
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h1 className="heading truncate text-[13px]" style={{ color: accent }}>
              {title}
            </h1>
            {subtitle && <p className="mt-1 text-[13px] text-ink-faint">{subtitle}</p>}
          </div>

          <div className="ml-auto flex items-center gap-3">
            {/* The chip is the running total of the escalation: it grows with
                the tier, and at tier 3 it is visibly alight. Losing a streak
                gets a real exit — it drops and tumbles out — because a reward
                that simply vanishes was never felt as a reward. */}
            <AnimatePresence>
              {streak >= 2 && (
                <m.span
                  key="streak"
                  className={cx('chip', tier === 3 ? 'chip-ablaze text-[#ffb066]' : 'text-desert')}
                  style={{
                    borderColor: tier === 3 ? '#ff7a2e' : tier === 2 ? '#ffb066aa' : '#ff9d5c66',
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
            <span className="chip">
              <span className="num text-[15px] text-parchment">
                {index + 1}/{questions.length}
              </span>
            </span>
            {onQuit && (
              <Button size="sm" variant="ghost" onClick={onQuit}>
                Exit
              </Button>
            )}
          </div>
        </div>

        <ProgressBar
          value={(index + (revealed ? 1 : 0)) / questions.length}
          color={accent}
          height={8}
          label="Progress"
        />

        {!deferFeedback && records.length > 0 && (
          <p className="mt-2.5 font-script text-[10px] uppercase tracking-wide text-ink-faint">
            {correctSoFar} correct of {records.length} answered
          </p>
        )}
      </div>

      {/* ---------------------------------------------------------- content */}
      <div className={cx('grid gap-5', question.passage && 'lg:grid-cols-2')}>
        {question.passage && <PassagePanel passage={question.passage} />}

        {/* The sheet remounts per question, so every question arrives instead
            of being swapped underneath the reader. Keyed on the index as well
            as the id because a review session can serve the same question
            twice and the second one still has to animate.

            No exit animation on purpose: an outgoing sheet would have to
            finish before the next mounts, and rAF is frozen in a hidden tab.
            Arriving unconditionally cannot get stuck. */}
        <m.div
          key={`${index}-${question.id}`}
          className="sheet p-6 sm:p-8"
          initial={{ opacity: 0, x: 26 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="label-quill">{question.topic}</span>
            <span
              className="rounded px-2 py-0.5 font-script text-[10px] uppercase tracking-wide"
              style={{
                color: DIFFICULTY_COLOR[question.difficulty],
                background: `${DIFFICULTY_COLOR[question.difficulty]}22`,
              }}
            >
              {DIFFICULTY_LABEL[question.difficulty]}
            </span>

            {/* Read aloud, bookmark, report — secondary to answering, so they
                sit on the metadata line rather than near the choices. Hidden
                in test mode: none of the three exists on a real exam, and a
                bookmark you cannot revisit until the test ends is a
                distraction dressed as a feature. */}
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
            <p className="mb-4 border-l-4 border-[#c9b06a] bg-[#fbf6e6] px-4 py-3 font-read text-[1.02rem] leading-relaxed">
              <RichText as="span" format="html">
                {question.label}
              </RichText>
            </p>
          )}

          <div className="prose-quill mb-6" id={promptId}>
            <RichText as="div" format={question.promptFormat}>
              {question.prompt}
            </RichText>
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
          <div className="space-y-2.5" role="radiogroup" aria-labelledby={promptId}>
            {question.choices.map((choice, i) => {
              const isCorrect = choice.key === question.correctKey;
              const isChosen = choice.key === chosen;
              const wrongPick = revealed && isChosen && !isCorrect;
              /* Lit is not the same as correct: after a wrong answer the right
                 row stays dim for REVEAL_LAG, so the two states are separate. */
              const lit = revealed && isCorrect && litCorrect;

              const state = !revealed
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
                  initial={{ opacity: 0, y: 14 }}
                  animate={
                    !revealed
                      ? { opacity: 1, y: 0, x: 0, scale: 1 }
                      : lit
                        ? /* the answer arriving: lifts off the page and settles */
                          { opacity: 1, y: -2, x: 0, scale: [1, 1.035, 1] }
                        : wrongPick
                          ? /* a headshake, not a buzzer */
                            { opacity: 1, y: 0, scale: 1, x: [0, -9, 7, -5, 3, 0] }
                          : /* everything else steps back so the eye has two rows to compare */
                            { opacity: 0.45, y: 0, x: 0, scale: 1 }
                  }
                  transition={
                    !revealed
                      ? { ...SPRING, delay: 0.06 + i * 0.04 }
                      : wrongPick
                        ? { duration: 0.42, ease: 'easeInOut' }
                        : lit
                          ? SPRING_SNAP
                          : { duration: 0.28 }
                  }
                  whileHover={revealed ? undefined : { x: 3 }}
                  whileTap={revealed ? undefined : { scale: 0.985 }}
                >
                  <span className="choice-key">{'ABCD'[i] ?? choice.key}</span>
                  <RichText as="span" format={choice.format} className="min-w-0 flex-1">
                    {choice.text}
                  </RichText>
                  {/* Decorative. The verdict reaches a screen reader through
                      the live region below, on its own timing, rather than as
                      a stray tick character inside a button label. */}
                  {lit && (
                    <Glyph name="check" size={17} className="ml-auto flex-none text-[#2f6b3a]" />
                  )}
                  {wrongPick && (
                    <Glyph name="cross" size={16} className="ml-auto flex-none text-[#9c3326]" />
                  )}
                </m.button>
              );
            })}
          </div>

          {!revealed && (
            <p className="mt-5 text-[12px] text-ink-soft">
              Tip: press{' '}
              <kbd className="rounded border border-parchment-edge bg-[#ece7db] px-1.5 py-0.5 font-mono text-[11px]">
                A
              </kbd>
              –
              <kbd className="rounded border border-parchment-edge bg-[#ece7db] px-1.5 py-0.5 font-mono text-[11px]">
                D
              </kbd>{' '}
              to answer.
            </p>
          )}

          {/* ------------------------------------------------ explanation

              Gated on `litCorrect` rather than `revealed`, so the verdict does
              not appear in text while the rows are still resolving. Reading
              "Not quite" before the shake has finished spoils its own reveal. */}
          {revealed && litCorrect && !deferFeedback && (
            <m.div
              className="mt-7 border-t-2 border-parchment-edge pt-6"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* The one thing that must be spoken. `role="status"` is polite,
                  so it waits for the reader to finish the choice it just moved
                  through instead of cutting it off, and it names the right
                  answer — "Not quite" alone tells a blind student nothing they
                  could not already tell. */}
              <m.div
                className="mb-4 flex items-center gap-1.5 font-script text-[12.5px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: chosen === question.correctKey ? '#2f6b3a' : '#9c3326' }}
                role="status"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.26, delay: 0.06 }}
              >
                <Glyph
                  name={chosen === question.correctKey ? 'check' : 'cross'}
                  size={15}
                  className="flex-none"
                />
                {chosen === question.correctKey
                  ? 'Correct'
                  : `Not quite — the answer is ${question.correctKey}`}
              </m.div>

              {/* Both explanations used to be tinted boxes. Unfilled and
                  labelled reads faster, and stacking two of them no longer
                  turns the page into a pile of cards. */}
              {/* The trap first, then the answer, 90ms apart — the same order
                  the rows resolved in, so the page repeats the lesson rather
                  than restating it. */}
              <div className="lesson">
                {chosen !== question.correctKey && explanationForChosen && (
                  <m.section
                    className="ink-trap lesson-trap"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
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
                    transition={{
                      duration: 0.3,
                      delay: chosen === question.correctKey ? 0.1 : 0.19,
                    }}
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
                    transition={{ duration: 0.3, delay: 0.1 }}
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
                transition={{ ...SPRING, delay: 0.3 }}
              >
                <Button
                  variant="primary"
                  size="lg"
                  className="mt-6 w-full"
                  onClick={() => advance(records)}
                  autoFocus
                >
                  {isLast ? 'See results' : 'Next question'} ▶
                </Button>
              </m.div>
            </m.div>
          )}
        </m.div>
      </div>

      {/* -------------------------------------------------- streak escalation

          Tier 2 warms the edges of the screen; tier 3 sets them alight. Keyed
          on a counter so a repeat at the same tier replays rather than sitting
          idle, and fixed to the viewport so it frames the whole run instead of
          the sheet. */}
      <AnimatePresence>
        {flare && (
          <m.div
            key={flare.id}
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-[70]"
            style={{
              boxShadow:
                flare.tier === 3
                  ? 'inset 0 0 150px rgba(255,122,46,.6), inset 0 0 60px rgba(255,196,92,.35)'
                  : 'inset 0 0 96px rgba(255,210,62,.42)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: flare.tier === 3 ? 0.9 : 0.6, ease: 'easeOut' }}
            onAnimationComplete={() => setFlare(null)}
          />
        )}
      </AnimatePresence>

      {/* Calculator and scratch paper, corner-docked.
          The real exam permits both. The calculator gets a first-visit nudge
          on Math and nowhere else, because that is the only section where not
          knowing it exists changes how you would have worked the problem. */}
      <ToolDock mathHint={question.section === 'math'} />
    </div>
  );
}
