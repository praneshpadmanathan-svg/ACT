/* The age gate.

   ACT Command is built for 13-to-17-year-olds, which means under-13s will
   arrive too — some by accident, some because a younger sibling wants to try
   it. COPPA attaches the moment one of them hands over an email address, so
   the gate exists to make sure that never happens.

   Three deliberate choices:

   1. **It asks for a date, not a yes/no.** "Are you 13 or older?" is not a
      gate, it is a hint: it tells a child exactly which answer opens the door.
      A neutral date of birth, asked without saying what the threshold is,
      is the form regulators actually consider meaningful.

   2. **It is only asked at account creation.** Playing needs no age, because
      playing collects nothing. Asking everyone for a birthday to hand them a
      lesson on comma splices would be its own small privacy failure.

   3. **The birthday is never stored.** It is used once, in memory, to compute
      one boolean, and then it is gone. Keeping a minor's exact date of birth in
      order to decide that we may not collect their data would rather defeat the
      point — and a date of birth is worth considerably more to whoever steals
      it than the answer it produced. */

import { readRaw, writeRaw } from './storage';

/** The COPPA line. Under this, no account and no data. */
export const MIN_ACCOUNT_AGE = 13;

const VERDICT_KEY = 'act-command:age-verdict';

export type AgeVerdict = 'eligible' | 'too-young';

export interface DateParts {
  year: number;
  month: number;
  day: number;
}

/** Whole years between a date of birth and today. */
export function ageOn(dob: DateParts, today: Date = new Date()): number {
  let age = today.getFullYear() - dob.year;
  const hadBirthday =
    today.getMonth() + 1 > dob.month ||
    (today.getMonth() + 1 === dob.month && today.getDate() >= dob.day);
  if (!hadBirthday) age -= 1;
  return age;
}

/** A real calendar date, in a plausible range for a living person. */
export function isRealDate({ year, month, day }: DateParts, today: Date = new Date()): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  if (year < today.getFullYear() - 120 || year > today.getFullYear()) return false;

  // Rejects the 31st of a 30-day month and the 29th of a common February.
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return false;

  return d.getTime() <= today.getTime();
}

export function verdictFor(dob: DateParts, today: Date = new Date()): AgeVerdict {
  return ageOn(dob, today) >= MIN_ACCOUNT_AGE ? 'eligible' : 'too-young';
}

/* -------------------------------------------------------------- remembering */

/** What we keep: the answer, never the question.
 *
 *  Remembered so the gate is not re-asked on every visit — which would be
 *  annoying for the eligible and, for a child who has already been told no,
 *  an invitation to keep trying different birthdays until one works. */
export function rememberVerdict(verdict: AgeVerdict): void {
  writeRaw(VERDICT_KEY, verdict);
}

export function rememberedVerdict(): AgeVerdict | null {
  const raw = readRaw(VERDICT_KEY);
  return raw === 'eligible' || raw === 'too-young' ? raw : null;
}

/** Month names for the picker, so the field order can't be misread. A student
 *  typing 03/04 means March 4th or April 3rd depending on where they live, and
 *  guessing wrong could put them on the wrong side of the line. */
export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;
