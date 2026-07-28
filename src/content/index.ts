/* Single entry point for the content library.
   Everything here is static JSON authored for the 2025+ Enhanced ACT.
   Nothing in this module touches the DOM or app state — it is pure data
   plus a few lookup helpers built once at module load. */

import type {
  Lesson,
  NoteUnit,
  Passage,
  Path,
  Question,
  SectionId,
  Zone,
  ZoneQuestion,
} from '@/types';

import notesEnglish from './notesEnglish.json';
import notesMath from './notesMath.json';
import notesReading from './notesReading.json';
import notesScience from './notesScience.json';

import questionsEnglish from './questionsEnglish.json';
import questionsMath from './questionsMath.json';
import questionsReading from './questionsReading.json';
import questionsScience from './questionsScience.json';

import passagesEnglish from './passagesEnglish.json';
import passagesReading from './passagesReading.json';
import passagesScience from './passagesScience.json';

import pathsJson from './paths.json';
import lessonsJson from './lessons.json';
import miniquizzesJson from './miniquizzes.json';

/* ---------------------------------------------------------------- sections */

export interface SectionMeta {
  id: SectionId;
  name: string;
  /** How the section is labelled on the real test. */
  label: string;
  color: string;
  /** Tailwind-friendly accent used for rails and rings. */
  accent: string;
  questionCount: number;
  minutes: number;
  blurb: string;
}

export const SECTIONS: SectionMeta[] = [
  {
    id: 'english',
    name: 'English',
    label: 'English',
    color: '#ffd23e',
    accent: 'gold',
    questionCount: 50,
    minutes: 35,
    blurb: 'Grammar, punctuation and rhetoric. The most learnable section on the test.',
  },
  {
    id: 'math',
    name: 'Math',
    label: 'Mathematics',
    color: '#3ad6f0',
    accent: 'cyan',
    questionCount: 45,
    minutes: 50,
    blurb: 'Pre-algebra through trig. Every question has a shortcut worth knowing.',
  },
  {
    id: 'reading',
    name: 'Reading',
    label: 'Reading',
    color: '#ff8298',
    accent: 'rose',
    questionCount: 36,
    minutes: 40,
    blurb: 'Four passages, one skill: finding the line that proves the answer.',
  },
  {
    id: 'science',
    name: 'Science',
    label: 'Science',
    color: '#b79cff',
    accent: 'violet',
    questionCount: 40,
    minutes: 40,
    blurb: 'Reading graphs under time pressure. Barely a science test at all.',
  },
];

export const SECTION_BY_ID: Record<SectionId, SectionMeta> = Object.fromEntries(
  SECTIONS.map((s) => [s.id, s]),
) as Record<SectionId, SectionMeta>;

/* ------------------------------------------------------------------- notes */

export const NOTES: Record<SectionId, NoteUnit[]> = {
  english: notesEnglish as NoteUnit[],
  math: notesMath as NoteUnit[],
  reading: notesReading as NoteUnit[],
  science: notesScience as NoteUnit[],
};

export const ALL_NOTE_PAGES = SECTIONS.flatMap((s) =>
  NOTES[s.id].flatMap((unit) =>
    unit.pages.map((page) => ({ ...page, section: s.id, unitId: unit.id, unitLabel: unit.label })),
  ),
);

export type IndexedNotePage = (typeof ALL_NOTE_PAGES)[number];

const NOTE_PAGE_BY_ID = new Map(ALL_NOTE_PAGES.map((p) => [p.id, p]));
export const getNotePage = (id: string) => NOTE_PAGE_BY_ID.get(id);

/* --------------------------------------------------------------- questions */

export const QUESTIONS: Record<SectionId, Question[]> = {
  english: questionsEnglish as Question[],
  math: questionsMath as Question[],
  reading: questionsReading as Question[],
  science: questionsScience as Question[],
};

export const ALL_QUESTIONS: Question[] = SECTIONS.flatMap((s) => QUESTIONS[s.id]);

const QUESTION_BY_ID = new Map(ALL_QUESTIONS.map((q) => [q.id, q]));
export const getQuestion = (id: string) => QUESTION_BY_ID.get(id);

/** Distinct topics per section, in the order they first appear. */
export const TOPICS_BY_SECTION: Record<SectionId, string[]> = Object.fromEntries(
  SECTIONS.map((s) => [s.id, [...new Set(QUESTIONS[s.id].map((q) => q.topic))]]),
) as Record<SectionId, string[]>;

/* ---------------------------------------------------------------- passages */

export const PASSAGES: Passage[] = [
  ...(passagesEnglish as Passage[]),
  ...(passagesReading as Passage[]),
  ...(passagesScience as Passage[]),
];

const PASSAGE_BY_ID = new Map(PASSAGES.map((p) => [p.id, p]));
export const getPassage = (id: string | undefined) => (id ? PASSAGE_BY_ID.get(id) : undefined);

/* ------------------------------------------------------------------- zones */

export const PATHS = pathsJson as Path[];
// JSON widens the fixed-length rule tuples to string[], so these go through
// `unknown` rather than loosening the types the rest of the app relies on.
export const LESSONS = lessonsJson as unknown as Record<string, Lesson>;
export const ZONE_QUIZZES = miniquizzesJson as unknown as Record<string, ZoneQuestion[]>;

export const PATH_BY_ID: Record<SectionId, Path> = Object.fromEntries(
  PATHS.map((p) => [p.id, p]),
) as Record<SectionId, Path>;

const ZONE_INDEX = new Map<string, { zone: Zone; path: Path; index: number }>();
PATHS.forEach((path) => {
  path.nodes.forEach((zone, index) => ZONE_INDEX.set(zone.id, { zone, path, index }));
});

export const getZone = (id: string) => ZONE_INDEX.get(id);
export const ALL_ZONES = [...ZONE_INDEX.values()];

/* ------------------------------------------------------------------ totals */

export const LIBRARY_STATS = {
  drillQuestions: ALL_QUESTIONS.length,
  zoneQuestions: Object.values(ZONE_QUIZZES).reduce((n, a) => n + a.length, 0),
  notePages: ALL_NOTE_PAGES.length,
  passages: PASSAGES.length,
  zones: ALL_ZONES.length,
  get totalQuestions() {
    return this.drillQuestions + this.zoneQuestions;
  },
};
