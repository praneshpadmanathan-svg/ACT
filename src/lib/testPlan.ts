import type { SectionId } from '@/types';

/* Section lengths, scaled to what the bank can actually supply. The real ACT
   is longer; these keep the pacing pressure honest without inventing
   questions that do not exist. */
export const TEST_PLAN: Record<SectionId, { questions: number; minutes: number }> = {
  english: { questions: 25, minutes: 18 },
  math: { questions: 22, minutes: 25 },
  reading: { questions: 18, minutes: 20 },
  science: { questions: 20, minutes: 20 },
};

/* Extended time.
 *
 * ACT grants 50% and 100% extra time as documented accommodations, and a
 * student who will sit the real exam with time and a half has to practise with
 * time and a half — practising at standard timing trains a pace they will not
 * use and teaches them to rush for no reason. It is a display setting rather
 * than something asked about in the test, because nobody should have to
 * re-declare a disability every time they open one.
 *
 * Rounded up to the whole minute. 18 × 1.5 is 27 exactly, but 25 × 1.5 is
 * 37.5, and the half-minute belongs to the student. */
export const withAllowance = (minutes: number, allowance: number) => Math.ceil(minutes * allowance);

/** Minutes for all four sections back to back, at this allowance. */
export const fullSetMinutes = (allowance: number) =>
  Object.values(TEST_PLAN).reduce((n, p) => n + withAllowance(p.minutes, allowance), 0);
