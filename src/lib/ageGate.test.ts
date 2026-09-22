/* The age gate is the highest-consequence logic in the app and it had no tests.
 *
 * Everything else here fails visibly: a broken quiz is a broken quiz and
 * someone reports it. This fails silently and in one direction — an off-by-one
 * at a birthday boundary does not throw, it just returns `eligible` for a
 * twelve-year-old and hands them an email field. That is the precise thing
 * COPPA attaches to, and nothing in the build would have said a word.
 *
 * So the cases below are the boundary, both sides of it, and the leap-year and
 * month-length arithmetic the boundary is built on — not a sample of
 * comfortable dates in the middle of the range, which is what a test written
 * for reassurance rather than for the failure would cover.
 *
 * Every assertion passes an explicit `today`. The functions default to
 * `new Date()`, and a test that leans on the real clock is a test whose meaning
 * changes overnight — including passing for eleven months of the year and
 * failing in the twelfth, which is the worst possible way for this particular
 * file to fail.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MIN_ACCOUNT_AGE,
  ageOn,
  isRealDate,
  verdictFor,
  rememberVerdict,
  rememberedVerdict,
} from './ageGate';

const on = (iso: string) => new Date(`${iso}T12:00:00`);

describe('ageOn', () => {
  it('counts the birthday itself as the new age', () => {
    expect(ageOn({ year: 2013, month: 5, day: 4 }, on('2026-05-04'))).toBe(13);
  });

  it('has not counted it the day before', () => {
    expect(ageOn({ year: 2013, month: 5, day: 4 }, on('2026-05-03'))).toBe(12);
  });

  it('counts it the day after', () => {
    expect(ageOn({ year: 2013, month: 5, day: 4 }, on('2026-05-05'))).toBe(13);
  });

  it('does not credit a birthday later in the same month', () => {
    expect(ageOn({ year: 2013, month: 9, day: 30 }, on('2026-09-01'))).toBe(12);
  });

  it('does not credit a birthday in a later month of the same year', () => {
    expect(ageOn({ year: 2013, month: 12, day: 1 }, on('2026-01-01'))).toBe(12);
  });

  it('credits a birthday in an earlier month', () => {
    expect(ageOn({ year: 2013, month: 1, day: 1 }, on('2026-12-31'))).toBe(13);
  });

  /* A 29 February birthday has no anniversary in a common year. Whichever way
     that resolves it must not resolve *upwards*, or the gate opens early. */
  it('does not promote a 29 February birthday before 1 March in a common year', () => {
    expect(ageOn({ year: 2012, month: 2, day: 29 }, on('2025-02-28'))).toBe(12);
  });

  it('promotes a 29 February birthday by 1 March in a common year', () => {
    expect(ageOn({ year: 2012, month: 2, day: 29 }, on('2025-03-01'))).toBe(13);
  });
});

describe('verdictFor', () => {
  it('is too-young the day before the thirteenth birthday', () => {
    expect(verdictFor({ year: 2013, month: 6, day: 15 }, on('2026-06-14'))).toBe('too-young');
  });

  it('is eligible on the thirteenth birthday', () => {
    expect(verdictFor({ year: 2013, month: 6, day: 15 }, on('2026-06-15'))).toBe('eligible');
  });

  /* The boundary is the only number in this file that means anything, so state
     it independently of the constant rather than deriving the expectation from
     it — a test that recomputes the implementation agrees with any value. */
  it('draws the line at thirteen', () => {
    expect(MIN_ACCOUNT_AGE).toBe(13);
  });

  it('is too-young for a date of birth in the future', () => {
    expect(verdictFor({ year: 2030, month: 1, day: 1 }, on('2026-09-22'))).toBe('too-young');
  });
});

describe('isRealDate', () => {
  it('accepts an ordinary date', () => {
    expect(isRealDate({ year: 2010, month: 3, day: 14 }, on('2026-09-22'))).toBe(true);
  });

  it('rejects the 31st of a 30-day month', () => {
    expect(isRealDate({ year: 2010, month: 4, day: 31 }, on('2026-09-22'))).toBe(false);
  });

  it('rejects 29 February in a common year', () => {
    expect(isRealDate({ year: 2013, month: 2, day: 29 }, on('2026-09-22'))).toBe(false);
  });

  it('accepts 29 February in a leap year', () => {
    expect(isRealDate({ year: 2012, month: 2, day: 29 }, on('2026-09-22'))).toBe(true);
  });

  it('rejects a year in the future', () => {
    expect(isRealDate({ year: 2027, month: 1, day: 1 }, on('2026-09-22'))).toBe(false);
  });

  it('rejects month zero and month thirteen', () => {
    expect(isRealDate({ year: 2010, month: 0, day: 1 }, on('2026-09-22'))).toBe(false);
    expect(isRealDate({ year: 2010, month: 13, day: 1 }, on('2026-09-22'))).toBe(false);
  });

  it('rejects non-integers, which is what an empty or partial field parses to', () => {
    expect(isRealDate({ year: NaN, month: 5, day: 4 }, on('2026-09-22'))).toBe(false);
    expect(isRealDate({ year: 2010, month: 5.5, day: 4 }, on('2026-09-22'))).toBe(false);
  });
});

describe('the remembered verdict', () => {
  beforeEach(() => localStorage.clear());

  it('is null before anything is asked', () => {
    expect(rememberedVerdict()).toBeNull();
  });

  it('round-trips both verdicts', () => {
    rememberVerdict('too-young');
    expect(rememberedVerdict()).toBe('too-young');
    rememberVerdict('eligible');
    expect(rememberedVerdict()).toBe('eligible');
  });

  /* The stored value is a string in storage the user can edit. Anything that is
     not one of the two verdicts has to read as "not asked yet" and send them
     back through the gate — never fall through to the permissive side. */
  it('treats a tampered value as unasked rather than as eligible', () => {
    localStorage.setItem('act-command:age-verdict', 'eligible ');
    expect(rememberedVerdict()).toBeNull();
    localStorage.setItem('act-command:age-verdict', 'true');
    expect(rememberedVerdict()).toBeNull();
  });

  /* The whole point of the gate is that the birthday is used once and dropped.
     If a date of birth ever appears in storage, the gate has become the leak it
     was built to prevent. */
  it('stores a verdict and never the date of birth that produced it', () => {
    rememberVerdict(verdictFor({ year: 2013, month: 6, day: 15 }, on('2026-09-22')));
    const dumped = JSON.stringify(localStorage);
    expect(dumped).not.toMatch(/2013/);
    expect(dumped).not.toMatch(/\b15\b/);
  });
});
