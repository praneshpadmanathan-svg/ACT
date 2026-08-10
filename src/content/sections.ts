/* The four sections, as data.
 *
 * Split out of `index.ts` for one reason: this file imports no JSON, and the
 * barrel imports 738 kB of it. Anything on the app's eager path that only
 * wants a section's name or colour can import from here and not drag the
 * question bank into the first paint. `index.ts` re-exports all of it, so
 * every existing `from '@/content'` still works.
 */

import type { SectionId } from '@/types';

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
