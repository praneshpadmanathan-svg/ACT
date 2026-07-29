/* One question-answering experience, shared by drills, zone quizzes and
   review sessions.

   Everything upstream normalises into `RunnableQuestion`, so the interaction,
   the keyboard shortcuts and the explanation layout are identical no matter
   where a question came from. The reading surface is the study register —
   warm paper, real type — while the surrounding HUD stays arcade. */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Difficulty, Passage, SectionId } from '@/types';
import { sfx } from '@/lib/sfx';
import { cx, formatClock } from '@/lib/utils';
import { RichText } from './RichText';
import { PassagePanel } from './PassagePanel';
import { Button, ProgressBar } from './ui';

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

const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
const DIFFICULTY_COLOR: Record<Difficulty, string> = {
  easy: '#5ee6a8',
  medium: '#ffd23e',
  hard: '#ff8298',
};

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

  const question = questions[index];
  const isLast = index === questions.length - 1;

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
      setStreak((s) => (correct ? s + 1 : 0));
      setRecords((prev) => [...prev, record]);
      onAnswer(record);

      if (correct) {
        sfx.correct();
        if (streak >= 1) sfx.combo(streak + 1);
      } else {
        sfx.wrong();
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
      setIndex((i) => i + 1);
      setChosen(null);
      setRevealed(false);
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
        if (idx >= 0 && idx < question.choices.length) {
          e.preventDefault();
          commit(question.choices[idx].key);
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
            {streak >= 2 && (
              <span className="chip animate-popIn text-desert" style={{ borderColor: '#ff9d5c66' }}>
                🔥 {streak} in a row
              </span>
            )}
            <span className="chip">
              <span className="num text-[15px] text-white">{formatClock(elapsed)}</span>
            </span>
            <span className="chip">
              <span className="num text-[15px] text-white">
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

        <div className="sheet p-6 sm:p-8">
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
          </div>

          {question.label && (
            <p className="mb-4 border-l-4 border-[#c9b06a] bg-[#fbf6e6] px-4 py-3 font-read text-[1.02rem] leading-relaxed">
              <RichText as="span" format="html">{question.label}</RichText>
            </p>
          )}

          <div className="prose-quill mb-6">
            <RichText as="div" format={question.promptFormat}>
              {question.prompt}
            </RichText>
          </div>

          <div className="space-y-2.5" role="group" aria-label="Answer choices">
            {question.choices.map((choice, i) => {
              const isCorrect = choice.key === question.correctKey;
              const isChosen = choice.key === chosen;
              const state = !revealed
                ? isChosen
                  ? 'choice-selected'
                  : ''
                : isCorrect
                  ? 'choice-correct'
                  : isChosen
                    ? 'choice-wrong'
                    : '';

              return (
                <button
                  key={choice.key}
                  type="button"
                  onClick={() => commit(choice.key)}
                  disabled={revealed}
                  className={cx('choice', state, revealed && 'choice-locked cursor-default')}
                  aria-pressed={isChosen}
                >
                  <span className="choice-key">{'ABCD'[i] ?? choice.key}</span>
                  <RichText as="span" format={choice.format} className="min-w-0 flex-1">
                    {choice.text}
                  </RichText>
                  {revealed && isCorrect && <span className="ml-auto text-[#2f9e63]">✓</span>}
                  {revealed && isChosen && !isCorrect && <span className="ml-auto text-[#d34a63]">✕</span>}
                </button>
              );
            })}
          </div>

          {!revealed && (
            <p className="mt-5 text-[12px] text-ink-soft">
              Tip: press <kbd className="rounded border border-parchment-edge bg-[#ece7db] px-1.5 py-0.5 font-mono text-[11px]">A</kbd>–
              <kbd className="rounded border border-parchment-edge bg-[#ece7db] px-1.5 py-0.5 font-mono text-[11px]">D</kbd> to answer.
            </p>
          )}

          {/* ------------------------------------------------ explanation */}
          {revealed && !deferFeedback && (
            <div className="mt-7 animate-fadein border-t-2 border-parchment-edge pt-6">
              <div
                className="mb-4 font-script text-[12px] uppercase tracking-wide"
                style={{ color: chosen === question.correctKey ? '#2f9e63' : '#d34a63' }}
              >
                {chosen === question.correctKey ? '✓ Correct' : '✕ Not quite'}
              </div>

              {chosen !== question.correctKey && explanationForChosen && (
                <div className="block-trap mb-3">
                  <div className="label-quill mb-1.5">Why {chosen} is wrong</div>
                  <RichText as="div" format="markdown" className="font-read leading-relaxed">
                    {explanationForChosen}
                  </RichText>
                </div>
              )}

              {explanationForCorrect && (
                <div className="block-example">
                  <div className="label-quill mb-1.5">
                    Why {question.correctKey} is right
                  </div>
                  <RichText as="div" format="markdown" className="font-read leading-relaxed">
                    {explanationForCorrect}
                  </RichText>
                </div>
              )}

              {!explanationForCorrect && question.whyGeneral && (
                <div className="block-example">
                  <RichText as="div" format="html" className="font-read leading-relaxed">
                    {question.whyGeneral}
                  </RichText>
                </div>
              )}

              <Button
                variant="primary"
                size="lg"
                className="mt-6 w-full"
                onClick={() => advance(records)}
                autoFocus
              >
                {isLast ? 'See results' : 'Next question'} ▶
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
