/* The study notes, all four sections — loaded on demand by `loadNotes()`.
 *
 * One piece rather than four: the reader's previous/next runs across section
 * boundaries and the command palette searches every page, so there is no
 * screen that wants one section's notes alone. */

import type { NoteUnit, SectionId } from '@/types';

import { SECTIONS } from './sections';

import notesEnglish from './notesEnglish.json';
import notesMath from './notesMath.json';
import notesReading from './notesReading.json';
import notesScience from './notesScience.json';

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

export const NOTE_PAGE_BY_ID = new Map(ALL_NOTE_PAGES.map((p) => [p.id, p]));
