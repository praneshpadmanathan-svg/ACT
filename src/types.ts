/* Shapes for the content library and for saved progress.
   The content JSON was authored by hand, so these types describe what is
   actually in the files rather than an idealised schema. */

export type SectionId = 'english' | 'math' | 'reading' | 'science';
export type Difficulty = 'easy' | 'medium' | 'hard';

/* ------------------------------------------------------------------ notes */

export interface NoteBlockP {
  type: 'p';
  text: string;
}
export interface NoteBlockRule {
  type: 'rule';
  title?: string;
  text: string;
}
/** A worked example: the setup, the reasoning steps, and the result.
 *  `prompt` may contain newlines — for English items it carries the A-D
 *  choices on their own lines. */
export interface NoteBlockExample {
  type: 'example';
  prompt: string;
  work: string[];
  answer: string;
}
export interface NoteBlockList {
  type: 'list';
  title: string;
  items: string[];
}
/** Common mistakes. Rendered as a warning rail, no title in the data. */
export interface NoteBlockTrap {
  type: 'trap';
  items: string[];
}
export interface NoteBlockTable {
  type: 'table';
  head: string[];
  rows: string[][];
}
export interface NoteBlockCheck {
  type: 'check';
  q: string;
  choices: string[];
  answer: number;
  explain: string;
}

export type NoteBlock =
  | NoteBlockP
  | NoteBlockRule
  | NoteBlockExample
  | NoteBlockList
  | NoteBlockTrap
  | NoteBlockTable
  | NoteBlockCheck;

export interface NotePage {
  id: string;
  topic: string;
  title: string;
  summary: string;
  minutes: number;
  blocks: NoteBlock[];
}

export interface NoteUnit {
  id: string;
  label: string;
  icon: string;
  pages: NotePage[];
}

/* -------------------------------------------------------------- questions */

export interface Choice {
  id: string;
  text: string;
}

/** A drill / test question. `why` explains every choice, not just the key. */
export interface Question {
  id: string;
  section: SectionId;
  topic: string;
  difficulty: Difficulty;
  /** Passage id this question belongs to, when it has one. */
  passage?: string;
  /** The question stem, or the underlined portion for English. */
  context: string;
  choices: Choice[];
  answer: string;
  why: Record<string, string>;
}

/* --------------------------------------------------------------- passages */

export interface FigureTable {
  label: string;
  caption: string;
  type: 'table';
  head: string[];
  rows: string[][];
}

/** Prose attached to a passage — a footnote on a data set, or one of the
 *  competing positions in a Conflicting Viewpoints passage. */
export interface FigureNote {
  label: string;
  caption: string;
  type: 'note';
  text: string;
}

export type Figure = FigureTable | FigureNote;

export interface Passage {
  id: string;
  title: string;
  /** Reading + Science use `type` for the passage genre. */
  type?: string;
  /** English + Science use `intro` for framing text. */
  intro?: string;
  blurb?: string;
  text?: string;
  figures?: Figure[];
}

/* ------------------------------------------------------- zones (the game) */

export interface Zone {
  id: string;
  name: string;
  sub: string;
  topic: string;
  learn?: string[];
}

export interface Boss {
  id: string;
  name: string;
  sub: string;
}

export interface Path {
  id: SectionId;
  name: string;
  color: string;
  section: string;
  boss: Boss;
  nodes: Zone[];
}

/** A rule card inside a zone lesson: [title, body, worked example]. */
export type LessonRule = [title: string, body: string, example: string];

export interface Lesson {
  intro: string;
  rules: LessonRule[];
  /** The one mistake people make most in this zone. */
  trap?: string;
}

export interface ZoneQuestion {
  q: string;
  /** Always four options, matching ACT format. */
  opts: string[];
  /** Index into `opts`. */
  a: number;
  why: string;
  /** Per-choice feedback, when the author supplied it. */
  notes?: string[];
  tag?: string;
  /** 1 = easy, 2 = medium, 3 = hard */
  d?: number;
}

/* --------------------------------------------------------------- progress */

export interface Attempt {
  qid: string;
  section: SectionId | 'zone';
  topic: string;
  correct: boolean;
  /** ms spent on the question */
  ms: number;
  at: number;
}

export interface TestResult {
  id: string;
  at: number;
  /** Section id -> scaled score (1-36) */
  scores: Partial<Record<SectionId, number>>;
  composite: number;
  /** Section id -> [correct, total] */
  raw: Partial<Record<SectionId, [number, number]>>;
  durationSec: number;
  sections: SectionId[];
}

export interface OnboardingProfile {
  when: 'soon' | 'mid' | 'far' | 'none';
  before: 'first' | 'b20' | 'b27' | 'b28';
  target: number;
  fear: SectionId;
  savedAt: number;
}

export interface Progress {
  version: 2;
  xp: number;
  attempts: Attempt[];
  /** note page ids that have been read through */
  notesRead: string[];
  /** zone id -> best percent (0-100) */
  zonesCleared: Record<string, number>;
  testHistory: TestResult[];
  achievements: string[];
  dayStreak: number;
  /** yyyy-mm-dd of the last day with any activity */
  lastActiveDay: string | null;
  currentCorrectStreak: number;
  bestCorrectStreak: number;
  targetScore: number;
  weeklyGoal: number;
  profile: OnboardingProfile | null;
  hero: string;
  /** Story chapter ids already played. */
  storySeen: string[];
  /** The answer given in the prologue; referenced by later beats. */
  oath: string | null;
  /** Question ids flagged for review, and their spaced-repetition due dates. */
  review: Record<string, { due: number; box: number }>;
}
