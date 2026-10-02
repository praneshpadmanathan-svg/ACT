/* A timed practice test, as data that survives the tab.

   The runner used to keep the whole attempt in component state and refs, so a
   reload — or a phone quietly discarding a backgrounded tab, which is the
   common case — threw away up to 85 answered questions. Everything the runner
   needs to pick up where it left off now lives in one plain object, written to
   storage on every change and read back on the next visit.

   Pure functions over that object, plus three storage wrappers at the bottom.
   Nothing here touches React, the clock or the question bank directly: `now`
   and "does this question still exist" are always passed in, which is what
   makes the expiry rules testable without fake timers or loaded content.

   What is deliberately *not* here is any notion of right or wrong. The saved
   session holds the letters the student picked and nothing about whether
   they were correct; scoring happens once, in `recordsFor`, after the section
   is submitted. */

import type { SectionId } from '@/types';
import type { AnswerRecord, RunnableQuestion } from '@/components/QuestionRunner';
import { readRaw, removeRaw, writeRaw } from './storage';
import { TEST_PLAN, withAllowance } from './testPlan';

export const TEST_SESSION_KEY = 'act-command:test-session:v1';

/* A day, and then it is gone. Long enough to survive closing the laptop for
   the night; short enough that nobody opens the app next week to a "resume"
   offer for a test they have forgotten taking. */
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const SECTION_IDS: readonly SectionId[] = ['english', 'math', 'reading', 'science'];

/** One section's work so far. Keyed by question id, never by position, so a
 *  restored session cannot attach an answer to the wrong question. */
export interface SectionProgress {
  /** Question id -> the letter chosen. Absent means unanswered. */
  answers: Record<string, string>;
  /** Question ids flagged for review, in the order they were flagged. */
  flags: string[];
  /** The question on screen. */
  cursor: number;
  /** Milliseconds spent looking at each question, summed across visits. */
  ms: Record<string, number>;
}

export type SessionStage =
  /* `deadline` is absolute wall-clock time. A countdown would pause while the
     tab was frozen or closed, and the real exam does not stop the clock
     because you looked away. */
  | { kind: 'section'; index: number; deadline: number; startedAt: number }
  | { kind: 'break'; nextIndex: number };

export interface TestSession {
  v: 1;
  /** The route's config: 'full' or a single section id. */
  config: string;
  sections: SectionId[];
  /** The exact questions drawn, so a resume restores this test and not a reshuffle. */
  questionIds: Partial<Record<SectionId, string[]>>;
  allowance: number;
  startedAt: number;
  savedAt: number;
  stage: SessionStage;
  progress: Partial<Record<SectionId, SectionProgress>>;
  /** Seconds spent in each submitted section, for the pacing breakdown. */
  sectionSec: Partial<Record<SectionId, number>>;
  /** Indexes of submitted sections. The persisted half of the double-submit
   *  guard: the timer and the Submit button can both land on one section. */
  submitted: number[];
}

export const emptyProgress = (): SectionProgress => ({ answers: {}, flags: [], cursor: 0, ms: {} });

export const sectionLimitMs = (section: SectionId, allowance: number) =>
  withAllowance(TEST_PLAN[section].minutes, allowance) * 60_000;

export function createSession(args: {
  config: string;
  sections: SectionId[];
  questionIds: Partial<Record<SectionId, string[]>>;
  allowance: number;
  now: number;
}): TestSession {
  const { config, sections, questionIds, allowance, now } = args;
  const first = sections[0]!;
  return {
    v: 1,
    config,
    sections,
    questionIds,
    allowance,
    startedAt: now,
    savedAt: now,
    stage: {
      kind: 'section',
      index: 0,
      deadline: now + sectionLimitMs(first, allowance),
      startedAt: now,
    },
    progress: Object.fromEntries(sections.map((id) => [id, emptyProgress()])),
    sectionSec: {},
    submitted: [],
  };
}

/** The section on screen, or null on a break. */
export function currentSection(s: TestSession): SectionId | null {
  return s.stage.kind === 'section' ? (s.sections[s.stage.index] ?? null) : null;
}

/* Every edit below goes through this, so the three answer-sheet operations
   cannot disagree about what "the current section" is, and none of them can
   write to a section that has already been handed in. */
function editCurrent(s: TestSession, fn: (p: SectionProgress, ids: string[]) => SectionProgress) {
  const id = currentSection(s);
  if (!id || s.stage.kind !== 'section' || s.submitted.includes(s.stage.index)) return s;
  const prev = s.progress[id] ?? emptyProgress();
  return { ...s, progress: { ...s.progress, [id]: fn(prev, s.questionIds[id] ?? []) } };
}

/** Mark a choice. Picking the same letter again keeps it — a second tap on a
 *  phone is far more often a stutter than a wish to blank the question. */
export const selectAnswer = (s: TestSession, qid: string, key: string) =>
  editCurrent(s, (p, ids) =>
    ids.includes(qid) ? { ...p, answers: { ...p.answers, [qid]: key } } : p,
  );

export const toggleFlag = (s: TestSession, qid: string) =>
  editCurrent(s, (p, ids) =>
    !ids.includes(qid)
      ? p
      : {
          ...p,
          flags: p.flags.includes(qid) ? p.flags.filter((f) => f !== qid) : [...p.flags, qid],
        },
  );

/** Move to a question, clamped to the section. */
export const moveTo = (s: TestSession, index: number) =>
  editCurrent(s, (p, ids) => ({
    ...p,
    cursor: Math.max(0, Math.min(ids.length - 1, Math.round(index) || 0)),
  }));

/** Add viewing time to a question. Negative or absurd values (a clock change
 *  mid-section) are dropped rather than allowed to poison the average. */
export const addTime = (s: TestSession, qid: string, ms: number) =>
  !(ms > 0) || ms > 6 * 60 * 60 * 1000
    ? s
    : editCurrent(s, (p, ids) =>
        ids.includes(qid) ? { ...p, ms: { ...p.ms, [qid]: (p.ms[qid] ?? 0) + ms } } : p,
      );

/** Whole seconds left on the current section's clock; 0 on a break. */
export function remainingSec(s: TestSession, now: number): number {
  if (s.stage.kind !== 'section') return 0;
  return Math.max(0, Math.ceil((s.stage.deadline - now) / 1000));
}

export const isExpired = (s: TestSession, now: number) =>
  s.stage.kind === 'section' && now >= s.stage.deadline;

export function unansweredCount(s: TestSession, section: SectionId): number {
  const answers = s.progress[section]?.answers ?? {};
  return (s.questionIds[section] ?? []).filter((id) => !answers[id]).length;
}

/**
 * Hand in the current section.
 *
 * Idempotent: a section already submitted comes back unchanged with
 * `accepted: false`, which is how the caller knows not to score it twice.
 * Time is charged up to the deadline and no further, so a section that ran
 * out while the tab was closed records its full allowance rather than the
 * hours the phone spent in a pocket.
 */
export function submitSection(
  s: TestSession,
  now: number,
): { session: TestSession; accepted: boolean; finished: boolean } {
  if (s.stage.kind !== 'section' || s.submitted.includes(s.stage.index)) {
    return { session: s, accepted: false, finished: false };
  }
  const { index, deadline, startedAt } = s.stage;
  const id = s.sections[index]!;
  const spent = Math.max(0, Math.min(now, deadline) - startedAt);
  const finished = index >= s.sections.length - 1;
  const session: TestSession = {
    ...s,
    sectionSec: { ...s.sectionSec, [id]: Math.round(spent / 1000) },
    submitted: [...s.submitted, index],
    /* The last section has nowhere to go; the stage stays put and the caller
       clears the saved session once the result is recorded. */
    stage: finished ? s.stage : { kind: 'break', nextIndex: index + 1 },
  };
  return { session, accepted: true, finished };
}

/** Leave a break and start the next section's clock. */
export function startNextSection(s: TestSession, now: number): TestSession {
  if (s.stage.kind !== 'break') return s;
  const index = s.stage.nextIndex;
  const id = s.sections[index];
  if (!id) return s;
  return {
    ...s,
    stage: {
      kind: 'section',
      index,
      deadline: now + sectionLimitMs(id, s.allowance),
      startedAt: now,
    },
  };
}

/** Answer records for scoring, one per question, blanks included. */
export function recordsFor(
  questions: RunnableQuestion[],
  progress: SectionProgress | undefined,
): AnswerRecord[] {
  return questions.map((question) => {
    const chosen = progress?.answers[question.id] ?? null;
    return {
      question,
      chosen,
      correct: chosen !== null && chosen === question.correctKey,
      ms: Math.round(progress?.ms[question.id] ?? 0),
    };
  });
}

/* ---------------------------------------------------------- validation */

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isSection = (v: unknown): v is SectionId =>
  typeof v === 'string' && (SECTION_IDS as readonly string[]).includes(v);

function cleanProgress(raw: unknown, ids: string[]): SectionProgress {
  if (!isObj(raw)) return emptyProgress();
  const answers: Record<string, string> = {};
  if (isObj(raw.answers)) {
    for (const [k, v] of Object.entries(raw.answers)) {
      if (ids.includes(k) && typeof v === 'string' && v) answers[k] = v;
    }
  }
  const flags = Array.isArray(raw.flags)
    ? raw.flags.filter((f): f is string => typeof f === 'string' && ids.includes(f))
    : [];
  const ms: Record<string, number> = {};
  if (isObj(raw.ms)) {
    for (const [k, v] of Object.entries(raw.ms))
      if (ids.includes(k) && isNum(v) && v >= 0) ms[k] = v;
  }
  const cursor = isNum(raw.cursor)
    ? Math.max(0, Math.min(ids.length - 1, Math.round(raw.cursor)))
    : 0;
  return { answers, flags: [...new Set(flags)], cursor, ms };
}

/**
 * Turn whatever storage handed back into a session, or null.
 *
 * Null for anything malformed, anything older than a day, and anything that
 * names a question the bank no longer has — a content edit between Tuesday's
 * save and Wednesday's resume would otherwise restore a section with a hole
 * in it. `exists` is passed in so this needs nothing loaded.
 */
export function parseSession(
  raw: unknown,
  now: number,
  exists: (qid: string) => boolean,
): TestSession | null {
  if (!isObj(raw) || raw.v !== 1) return null;
  if (typeof raw.config !== 'string' || !isNum(raw.startedAt) || !isNum(raw.savedAt)) return null;
  if (now - raw.savedAt > SESSION_TTL_MS || raw.savedAt > now + 60_000) return null;
  if (!isNum(raw.allowance) || raw.allowance < 1 || raw.allowance > 3) return null;

  if (!Array.isArray(raw.sections) || raw.sections.length === 0) return null;
  if (!raw.sections.every(isSection)) return null;
  const sections = raw.sections as SectionId[];
  if (new Set(sections).size !== sections.length) return null;

  if (!isObj(raw.questionIds)) return null;
  const questionIds: Partial<Record<SectionId, string[]>> = {};
  for (const id of sections) {
    const list = raw.questionIds[id];
    if (!Array.isArray(list) || list.length === 0) return null;
    if (!list.every((q) => typeof q === 'string' && exists(q))) return null;
    questionIds[id] = list as string[];
  }

  const st = raw.stage;
  let stage: SessionStage;
  if (
    isObj(st) &&
    st.kind === 'section' &&
    isNum(st.index) &&
    isNum(st.deadline) &&
    isNum(st.startedAt)
  ) {
    if (!sections[st.index]) return null;
    stage = { kind: 'section', index: st.index, deadline: st.deadline, startedAt: st.startedAt };
  } else if (isObj(st) && st.kind === 'break' && isNum(st.nextIndex)) {
    if (!sections[st.nextIndex]) return null;
    stage = { kind: 'break', nextIndex: st.nextIndex };
  } else {
    return null;
  }

  const progress: Partial<Record<SectionId, SectionProgress>> = {};
  const rawProgress = isObj(raw.progress) ? raw.progress : {};
  for (const id of sections) progress[id] = cleanProgress(rawProgress[id], questionIds[id]!);

  const sectionSec: Partial<Record<SectionId, number>> = {};
  if (isObj(raw.sectionSec)) {
    for (const [k, v] of Object.entries(raw.sectionSec)) {
      if (isSection(k) && isNum(v) && v >= 0) sectionSec[k] = v;
    }
  }
  const submitted = Array.isArray(raw.submitted)
    ? raw.submitted.filter((n): n is number => isNum(n) && n >= 0 && n < sections.length)
    : [];
  /* A session whose final section is already in `submitted` was recorded and
     only failed to clear. Resuming it would score the same test twice. */
  if (submitted.includes(sections.length - 1)) return null;

  return {
    v: 1,
    config: raw.config,
    sections,
    questionIds,
    allowance: raw.allowance,
    startedAt: raw.startedAt,
    savedAt: raw.savedAt,
    stage,
    progress,
    sectionSec,
    submitted,
  };
}

/* ------------------------------------------------------------- storage */

/** The saved session, if there is one worth offering. Clears it otherwise,
 *  so a stale or broken entry is not re-parsed on every visit. */
export function loadSession(now: number, exists: (qid: string) => boolean): TestSession | null {
  const raw = readRaw(TEST_SESSION_KEY);
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  const session = parseSession(parsed, now, exists);
  if (!session) removeRaw(TEST_SESSION_KEY);
  return session;
}

export function saveSession(s: TestSession, now: number): void {
  try {
    writeRaw(TEST_SESSION_KEY, JSON.stringify({ ...s, savedAt: now }));
  } catch {
    /* Serialising a plain object cannot realistically throw; writeRaw already
       swallows quota errors. Nothing a test-taker could do about it anyway. */
  }
}

export const clearSession = () => removeRaw(TEST_SESSION_KEY);
