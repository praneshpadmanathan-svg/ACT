/* Single entry point for the content library.
   Everything here is static JSON authored for the 2025+ Enhanced ACT.
   Nothing in this module touches the DOM or app state — it is pure data
   plus a few lookup helpers.

   The library is about six megabytes of JSON, and it is not one download any
   more. It used to be: every screen imported it whole, and because one small
   file the landing page needed was bundled in with it, index.html
   modulepreloaded all 1.7 MB gzipped of it before the first paint. Now it
   comes in pieces, each fetched the first time something asks for it:

   - one per section — that section's questions and passages. A student
     drilling Math never downloads a Reading passage;
   - the notes, all four sections together;
   - the landmark lessons and quizzes.

   What *is* always here is the catalog (`virtual:content/index`, built from
   the JSON by `vitePlugin.ts`): every section's topics and counts, and the id
   of every question that exists. That is enough for Home, the study plan and
   the review count to do their arithmetic without a single question loaded.

   Screens declare what they read with `useContent`, which suspends until it
   has arrived; anything outside React awaits `loadContent`. The accessors
   below throw if they are reached before their piece has loaded — a loud
   failure on the first test run beats a drill that silently has no questions.

   `sections.ts`, `zones.ts` and `stats.ts` carry the small metadata the eager
   path needs, and are re-exported below so `from '@/content'` still finds
   them. Anything on the eager path should import those files directly: this
   one carries the catalog, which is small but not free. */

import type { Passage, Question, SectionId } from '@/types';
import { DRILL_IDS, TOPIC_COUNTS, ZONE_IDS } from 'virtual:content/index';

import { SECTIONS } from './sections';

export type { SectionMeta } from './sections';
export { SECTIONS, SECTION_BY_ID } from './sections';
export {
  ALL_ZONES,
  getZone,
  PATH_BY_ID,
  PATHS,
  SECTION_BY_ZONE_TOPIC,
  TOPIC_BY_ZONE_ALIAS,
} from './zones';
export { LIBRARY_STATS } from './stats';
export type { IndexedNotePage } from './notes';

const SECTION_IDS: readonly SectionId[] = SECTIONS.map((s) => s.id);

/* ----------------------------------------------------------------- catalog */

/** Distinct topics per section, in the order they first appear. */
export const TOPICS_BY_SECTION = Object.fromEntries(
  SECTION_IDS.map((s) => [s, TOPIC_COUNTS[s].map(([topic]) => topic)]),
) as Record<SectionId, string[]>;

/** How many drill questions each section holds, in total and per topic. */
export const QUESTION_COUNTS = Object.fromEntries(
  SECTION_IDS.map((s) => [
    s,
    {
      total: DRILL_IDS[s].length,
      byTopic: Object.fromEntries(TOPIC_COUNTS[s]) as Record<string, number>,
    },
  ]),
) as Record<SectionId, { total: number; byTopic: Record<string, number> }>;

const WHERE = new Map<string, { section: SectionId; zone: boolean }>();
for (const section of SECTION_IDS) {
  for (const id of DRILL_IDS[section]) WHERE.set(id, { section, zone: false });
  for (const id of ZONE_IDS[section] ?? []) WHERE.set(id, { section, zone: true });
}

/** Which section a question id belongs to, and whether it is a landmark
 *  question — or `undefined` when the id names nothing in the library (a
 *  question retired by a content edit). Needs nothing loaded. */
export const locateQuestion = (qid: string) => WHERE.get(qid);

/* ----------------------------------------------------------------- loading */

interface SectionBank {
  questions: Question[];
  passages: Passage[];
}

type Part = SectionId | 'notes' | 'zones';

/* Literal specifiers, one per section, so the bundler can see each chunk. */
const SECTION_CHUNKS: Record<SectionId, () => Promise<{ default: SectionBank }>> = {
  english: () => import('virtual:content/section/english'),
  math: () => import('virtual:content/section/math'),
  reading: () => import('virtual:content/section/reading'),
  science: () => import('virtual:content/section/science'),
};

const banks: Partial<Record<SectionId, SectionBank>> = {};
const QUESTION_BY_ID = new Map<string, Question>();
const PASSAGE_BY_ID = new Map<string, Passage>();
let notes: typeof import('./notes') | null = null;
let zones: typeof import('./zoneBank') | null = null;

const inflight = new Map<Part, Promise<void>>();
const failed = new Map<Part, unknown>();

const isLoaded = (part: Part) =>
  part === 'notes' ? notes !== null : part === 'zones' ? zones !== null : part in banks;

function fetchPart(part: Part): Promise<void> {
  const pending = inflight.get(part);
  if (pending) return pending;

  const run =
    part === 'notes'
      ? import('./notes').then((m) => {
          notes = m;
        })
      : part === 'zones'
        ? import('./zoneBank').then((m) => {
            zones = m;
          })
        : SECTION_CHUNKS[part]().then(({ default: bank }) => {
            for (const q of bank.questions) QUESTION_BY_ID.set(q.id, q);
            for (const p of bank.passages) PASSAGE_BY_ID.set(p.id, p);
            banks[part] = bank;
          });

  /* A failed chunk stays failed: the browser caches a failed dynamic import,
     so retrying in a loop would spin. `useContent` hands the error to the
     error boundary instead, whose reload is the retry. */
  const promise = run.catch((error: unknown) => {
    failed.set(part, error);
    throw error;
  });
  inflight.set(part, promise);
  return promise;
}

/** What a screen reads. `ids` are question ids (a review queue, a bookmark
 *  list): each one pulls in whichever piece holds it, and ids that name
 *  nothing are ignored. */
export interface ContentNeed {
  sections?: readonly SectionId[];
  ids?: readonly string[];
  notes?: boolean;
  zones?: boolean;
}

/** All of it — for the tests, which read across the whole library. */
export const ALL_CONTENT: ContentNeed = { sections: SECTION_IDS, notes: true, zones: true };

function partsOf(need: ContentNeed): Part[] {
  const parts = new Set<Part>(need.sections);
  for (const id of need.ids ?? []) {
    const where = WHERE.get(id);
    if (where) parts.add(where.zone ? 'zones' : where.section);
  }
  if (need.notes) parts.add('notes');
  if (need.zones) parts.add('zones');
  return [...parts];
}

export const contentReady = (need: ContentNeed) => partsOf(need).every(isLoaded);

/** Fetch whatever part of `need` is not here yet. Safe to call repeatedly:
 *  each piece is requested once. */
export function loadContent(need: ContentNeed): Promise<void> {
  const missing = partsOf(need).filter((p) => !isLoaded(p));
  return Promise.all(missing.map(fetchPart)).then(() => undefined);
}

/**
 * Suspend the calling component until `need` has loaded.
 *
 * Throws the pending promise for the nearest `<Suspense>` — every lazy screen
 * in `App.tsx` already sits inside one, so the existing skeleton covers the
 * wait — and throws the error, for the error boundary, if a piece failed.
 * Call it before the first read, and before any early return so the hook
 * order stays fixed.
 */
export function useContent(need: ContentNeed): void {
  if (contentReady(need)) return;
  for (const part of partsOf(need)) if (failed.has(part)) throw failed.get(part);
  throw loadContent(need);
}

/* --------------------------------------------------------------- questions */

function bank(section: SectionId): SectionBank {
  const loaded = banks[section];
  if (!loaded) throw notLoaded(section);
  return loaded;
}

const notLoaded = (part: Part) =>
  new Error(
    `Content "${part}" was read before it loaded — declare it with useContent/loadContent.`,
  );

/** One section's drill questions. Throws if that section has not loaded. */
export const questionsFor = (section: SectionId): Question[] => bank(section).questions;

/** A drill question by id, or `undefined` if the id names none. Throws if it
 *  names one whose section has not loaded. */
export function getQuestion(id: string): Question | undefined {
  const where = WHERE.get(id);
  if (!where || where.zone) return undefined;
  bank(where.section);
  return QUESTION_BY_ID.get(id);
}

/** A passage, from any section loaded so far. A question's own passage is in
 *  its section's piece, so anything holding the question can find it. */
export const getPassage = (id: string | undefined) => (id ? PASSAGE_BY_ID.get(id) : undefined);

/* ------------------------------------------------------------------- notes */

function notesModule() {
  if (!notes) throw notLoaded('notes');
  return notes;
}

export const notesFor = (section: SectionId) => notesModule().NOTES[section];
export const allNotePages = () => notesModule().ALL_NOTE_PAGES;
export const getNotePage = (id: string) => notesModule().NOTE_PAGE_BY_ID.get(id);

/* ------------------------------------------------------------------- zones */

function zoneModule() {
  if (!zones) throw notLoaded('zones');
  return zones;
}

export const zoneLessons = () => zoneModule().LESSONS;
export const zoneQuizzes = () => zoneModule().ZONE_QUIZZES;
