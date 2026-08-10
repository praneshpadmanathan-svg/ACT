/* Single entry point for the content library.
   Everything here is static JSON authored for the 2025+ Enhanced ACT.
   Nothing in this module touches the DOM or app state — it is pure data
   plus a few lookup helpers built once at module load.

   Three things are deliberately *not* here, and are re-exported from their own
   files instead: `sections.ts`, `zones.ts` and `stats.ts`. Importing this
   barrel pulls all 738 kB of JSON, and those three carry between 0 and 10 kB —
   so anything on the app's eager path (the store, the story overlay, the
   landing page) imports from the narrow file and the question bank stays off
   the first paint. Everything is re-exported below, so `from '@/content'`
   remains correct everywhere it already appears. */

import type { Lesson, NoteUnit, Passage, Question, SectionId, ZoneQuestion } from '@/types';

import { SECTIONS } from './sections';

export type { SectionMeta } from './sections';
export { SECTIONS, SECTION_BY_ID } from './sections';
export { ALL_ZONES, getZone, PATH_BY_ID, PATHS, TOPIC_BY_ZONE_ALIAS } from './zones';
export { LIBRARY_STATS } from './stats';

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

import lessonsJson from './lessons.json';
import miniquizzesJson from './miniquizzes.json';

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

// JSON widens the fixed-length rule tuples to string[], so these go through
// `unknown` rather than loosening the types the rest of the app relies on.
export const LESSONS = lessonsJson as unknown as Record<string, Lesson>;
export const ZONE_QUIZZES = miniquizzesJson as unknown as Record<string, ZoneQuestion[]>;
