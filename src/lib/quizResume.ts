/* A landmark quiz, as data that survives a refresh — and nothing longer.

   The quiz lived only in component state, so a reload threw the learner back
   to the lesson with a freshly dealt set of questions. On a phone the reload
   is rarely chosen: it is a pull-to-refresh from a thumb scrolling up to
   re-read the question, or the browser restoring a tab it discarded. The XP
   for the answers already given was kept (each one is written as it lands),
   which made it worse — the progress bar said six, the screen said one.

   Session storage, not local: a refresh resumes, a new visit starts clean.
   And the runner clears its entry when it unmounts — finishing, Exit, or
   navigating anywhere else — which a page unload never does. So the only way
   to arrive at a saved run is the one it exists for.

   Answers are stored by position against the exact list of question ids, and
   a run whose ids do not match the questions in front of it is ignored, so a
   restored answer can never attach to a different question. */

import type { AnswerRecord, RunnableQuestion } from '@/components/QuestionRunner';

interface SavedAnswer {
  chosen: string | null;
  correct: boolean;
  ms: number;
  streak?: number;
}

export interface SavedRun {
  ids: string[];
  /** The question on screen. Answered already if `answers` reaches it. */
  index: number;
  answers: SavedAnswer[];
  streak: number;
  /** Seconds on the session clock. */
  elapsed: number;
}

export interface RestoredRun {
  index: number;
  records: AnswerRecord[];
  streak: number;
  elapsed: number;
}

const prefix = 'act-command:quiz-run:';

/** The saved run's question ids, if there is one, so the screen can deal the
 *  same questions back before the runner mounts. */
export function savedIds(key: string): string[] | null {
  const run = read(key);
  return run ? run.ids : null;
}

export function restoreRun(key: string, questions: RunnableQuestion[]): RestoredRun | null {
  const run = read(key);
  if (!run) return null;
  const ids = questions.map((q) => q.id);
  if (run.ids.length !== ids.length || run.ids.some((id, i) => id !== ids[i])) return null;
  if (run.index < 0 || run.index >= ids.length || run.answers.length > ids.length) return null;
  // Answers are contiguous from the first question; the screen is on the last
  // one answered or the one after it.
  if (run.answers.length < run.index || run.answers.length > run.index + 1) return null;
  return {
    index: run.index,
    records: run.answers.map((a, i) => ({ ...a, question: questions[i]! })),
    streak: run.streak,
    elapsed: run.elapsed,
  };
}

export function saveRun(
  key: string,
  questions: RunnableQuestion[],
  state: { index: number; records: AnswerRecord[]; streak: number; elapsed: number },
): void {
  const run: SavedRun = {
    ids: questions.map((q) => q.id),
    index: state.index,
    answers: state.records.map(({ chosen, correct, ms, streak }) => ({
      chosen,
      correct,
      ms,
      streak,
    })),
    streak: state.streak,
    elapsed: state.elapsed,
  };
  try {
    window.sessionStorage.setItem(prefix + key, JSON.stringify(run));
  } catch {
    /* Private mode or a full quota: the quiz still works, it just will not
       survive a refresh — which is how it behaved before any of this. */
  }
}

export function clearRun(key: string): void {
  try {
    window.sessionStorage.removeItem(prefix + key);
  } catch {
    /* As above. */
  }
}

function read(key: string): SavedRun | null {
  let raw: string | null;
  try {
    raw = window.sessionStorage.getItem(prefix + key);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const run = JSON.parse(raw) as Partial<SavedRun>;
    if (
      !Array.isArray(run.ids) ||
      !run.ids.every((id) => typeof id === 'string') ||
      !Array.isArray(run.answers) ||
      typeof run.index !== 'number' ||
      typeof run.streak !== 'number' ||
      typeof run.elapsed !== 'number'
    )
      return null;
    return run as SavedRun;
  } catch {
    return null;
  }
}
