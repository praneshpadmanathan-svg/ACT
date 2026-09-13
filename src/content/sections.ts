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
  /* A CSS colour, not a hex — see `--c-section-*` in index.css.
   *
   * It reads as indirection for its own sake until you notice where this
   * value ends up: almost always an inline `style={{ color }}`, which no
   * stylesheet can override, on chrome that inverts with the theme. As a hex
   * it was correct in dark mode and invisible in light (1.30:1). As a token
   * reference the same string paints correctly in both, and every consumer —
   * text, progress fill, ring — keeps working unchanged, because this is
   * still just a colour anywhere CSS accepts one. */
  color: string;
  /* The same accent as a *background*, fixed in both themes.
   *
   * `color` darkens in light mode so it stays legible as text. The subject
   * pills paint it as a fill with fixed near-black lettering on top, and a
   * darkened fill there gave dark-on-dark at 2.87:1. Two roles, two fields —
   * the same split `gilt` makes for gold. */
  fill: string;
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
    color: 'oklch(var(--c-section-english))',
    fill: '#ffd23e',
    accent: 'gold',
    questionCount: 50,
    minutes: 35,
    blurb: 'Grammar, punctuation and rhetoric. The most learnable section on the test.',
  },
  {
    id: 'math',
    name: 'Math',
    label: 'Mathematics',
    color: 'oklch(var(--c-section-math))',
    fill: '#3ad6f0',
    accent: 'cyan',
    questionCount: 45,
    minutes: 50,
    blurb: 'Pre-algebra through trig. Every question has a shortcut worth knowing.',
  },
  {
    id: 'reading',
    name: 'Reading',
    label: 'Reading',
    color: 'oklch(var(--c-section-reading))',
    fill: '#ff8298',
    accent: 'rose',
    questionCount: 36,
    minutes: 40,
    blurb: 'Four passages, one skill: finding the line that proves the answer.',
  },
  {
    id: 'science',
    name: 'Science',
    label: 'Science',
    color: 'oklch(var(--c-section-science))',
    fill: '#b79cff',
    accent: 'violet',
    questionCount: 40,
    minutes: 40,
    blurb: 'Reading graphs under time pressure. Barely a science test at all.',
  },
];

export const SECTION_BY_ID: Record<SectionId, SectionMeta> = Object.fromEntries(
  SECTIONS.map((s) => [s.id, s]),
) as Record<SectionId, SectionMeta>;
