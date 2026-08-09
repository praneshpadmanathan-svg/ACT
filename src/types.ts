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

/** Running totals for one topic. */
export interface TopicTally {
  section: SectionId | 'zone';
  /** answered */
  n: number;
  /** answered correctly */
  ok: number;
  /** total milliseconds spent */
  ms: number;
}

/** Everything the app reports about answering, in a form that stays small
 *  forever. See the note on `Progress.attempts` for why this exists. */
export interface Tally {
  /** Lifetime questions answered. */
  answered: number;
  /** Lifetime answered correctly. */
  correct: number;
  /** `${section}::${topic}` -> running totals. */
  topics: Record<string, TopicTally>;
  /** `yyyy-mm-dd` -> answers that day. Trimmed to the last 120 days. */
  daily: Record<string, number>;
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
  /** Seconds spent in each section, for the pacing breakdown. Optional
   *  because tests taken before pacing existed recorded only a total, and a
   *  four-section total cannot be split back apart. */
  sectionSec?: Partial<Record<SectionId, number>>;
  /** The extended-time multiplier this test ran at, so pacing is judged
   *  against the clock the student actually had rather than a stranger's. */
  allowance?: number;
}

export interface OnboardingProfile {
  when: 'soon' | 'mid' | 'far' | 'none';
  before: 'first' | 'b20' | 'b27' | 'b28';
  target: number;
  fear: SectionId;
  /** `yyyy-mm-dd`, or null if they have not booked a date yet. Drives the
   *  countdown and the weekly goal. Optional so older saves still parse. */
  testDate?: string | null;
  savedAt: number;
}

export interface Progress {
  version: 2;
  xp: number;
  /** The durable record of answering. Never trimmed, always synced. */
  tally: Tally;
  /* The raw answer log, kept **on this device only** and capped hard.

     It used to be the record of what you had answered, and the whole of it was
     pushed to the cloud on every sync — up to 4,000 entries at ~110 bytes, so
     roughly 440 KB per player. Supabase's free tier allows 500 MB of database
     against 50,000 monthly users, which meant the *database* filled at around a
     thousand people while 49,000 seats sat unused.

     Nothing ever needed an individual attempt: every screen wanted a count, an
     average, or a per-day bucket. Those all live in `tally` now, which is a few
     kilobytes and syncs happily. This array stays because a recent log is
     genuinely useful locally, and it costs nothing when it never leaves. */
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
  /** Which traveller the player picked. See `src/game/heroes.ts` — this used
   *  to be written once as `'cadet'` and read by nothing at all. */
  hero: string;
  /** Question ids saved to come back to. Optional so older saves parse. */
  bookmarks: string[];
  /* Missed days this streak is allowed to survive.
   *
   * One is granted per completed week and at most two are ever held. The
   * point is narrow: a streak that ends the first time somebody has a busy
   * Tuesday stops being a reason to come back on Wednesday, which is the
   * only day the number was ever for. */
  streakShields: number;
  /** `yyyy-mm-dd` of the last day the daily challenge was completed. */
  dailyDoneOn: string | null;
  /** The diagnostic's per-section scaled estimate, if one has been taken. */
  diagnostic: DiagnosticResult | null;
  /** Story chapter ids already played. */
  storySeen: string[];
  /** The answer given in the prologue; referenced by later beats. */
  oath: string | null;
  /** The region the traveller set out from, chosen on the map. Every region's
   *  first landmark is open from the start regardless — this only decides where
   *  the traveller stands and which road the map opens on. */
  startRegion: SectionId | null;
  /** Ids of map discoveries already found. */
  discovered: string[];
  /** Question ids flagged for review, and their spaced-repetition state. */
  review: Record<string, ReviewEntry>;
}

/** One question's place in the review ladder. */
export interface ReviewEntry {
  due: number;
  box: number;
  /* How many times this specific question has been missed, ever.
   *
   * The box index alone cannot tell the difference between a question you
   * have never seen and one you have got wrong nine times, because both sit
   * at box 0. This is what makes a chronically-missed item sort to the front
   * of a review session and what stops a fast wrong answer being forgiven
   * indefinitely. Optional: saves written before it existed have no count. */
  misses?: number;
}

/* --------------------------------------------------------------- diagnostic */

/** What a placement test concluded, per section. */
export interface DiagnosticResult {
  at: number;
  /** Section id -> [correct, asked] */
  raw: Partial<Record<SectionId, [number, number]>>;
  /** Section id -> rough scaled estimate. Clearly labelled as rough. */
  scores: Partial<Record<SectionId, number>>;
  /** Topics the diagnostic found weakest, canonical names, weakest first. */
  weakTopics: string[];
  /** How many questions were asked in total. */
  asked: number;
}
