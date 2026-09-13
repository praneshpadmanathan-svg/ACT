/* What Pro actually buys.
 *
 * Everything gated in the app is named here and nowhere else, so changing the
 * offer is editing this file rather than hunting for `isPro` across twenty
 * screens. It is the table from docs/monetization-plan.md §6, in code.
 *
 * The shape of the offer: give away one whole subject, end to end — road,
 * lessons, drills, notes — so the quality is obvious and free is genuinely
 * useful on its own. Charge for the other three subjects and for the *systems*:
 * spaced review, timed tests, duels, analytics. Those are the parts that took
 * work to build and cannot be lifted out of a JSON file, which matters given
 * that the question bank ships in the bundle either way
 * (docs/monetization-plan.md §0).
 */

import type { SectionId } from '@/types';

/* The subject that stays open forever.
 *
 * One rule covers four screens: the Study road, the Training drills, the
 * Library notes and the Camp suggestions all ask the same question of the same
 * section id, so there is no separate "five free articles" rule to keep in step
 * with anything. English rather than Math because it is the first section of
 * the real test, it is where a new student is told to start, and its road is
 * the one the onboarding flow already points at. */
export const FREE_SECTIONS: readonly SectionId[] = ['english'];

export function sectionIsFree(id: SectionId): boolean {
  return FREE_SECTIONS.includes(id);
}

/* Everything behind the wall, keyed by what the code asks for.
 *
 * There was a fifth entry here, `tools`, for the scratch pad and calculator.
 * It came out once the gates were actually placed, because the ToolDock lives
 * in QuestionRunner and therefore in *every* quiz — and with the Summit
 * already Pro, gating it could only have taken scratch paper away from a free
 * English drill. That is not a reason to subscribe; it is a reason to think
 * the free tier is broken. Four things are sold here and each is a whole
 * system the free tier genuinely does without. */
export type Feature = 'tests' | 'duels' | 'review' | 'analytics';

interface FeatureCopy {
  /** What it is called on the upsell panel. */
  name: string;
  /** One line, phrased as what they get — never as what they are missing. */
  blurb: string;
}

export const FEATURES: Record<Feature, FeatureCopy> = {
  tests: {
    name: 'The Summit',
    blurb: 'Full timed practice tests and single-section runs, scored on our scale.',
  },
  duels: {
    name: 'Guardian duels',
    blurb: 'Face the four guardians at the end of each road.',
  },
  review: {
    name: 'Spaced review',
    blurb: 'Questions you miss come back on a schedule until they stick.',
  },
  analytics: {
    name: 'The full breakdown',
    blurb: 'Topic-by-topic accuracy, pacing, and twelve weeks of history.',
  },
};

/* The order the upsell lists them in: the one people ask for first, then the
   one that needs explaining, then the two that are their own reward. */
export const FEATURE_ORDER: readonly Feature[] = ['tests', 'review', 'duels', 'analytics'];

/** What a locked subject is called on the upsell. */
export function lockedSectionBlurb(count: number): string {
  return count === 1
    ? 'The remaining subject, road and drills and notes together.'
    : `All ${count} remaining subjects — roads, drills and notes.`;
}
