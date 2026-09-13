/* The palette's ranking, pinned.

   A command palette fails in a way nobody reports. The list is never empty and
   never throws — it just quietly puts the row you wanted third, or ninth, and
   you scroll instead of typing, and after a week you stop pressing ⌘K at all.
   Every case below is a query someone actually types against a label that
   actually exists in the app, asserting the order rather than the presence. */

import { describe, it, expect } from 'vitest';
import { scoreMatch } from './palette';

/** Assert that `winner` outranks `loser` for `query` — and that both match at
 *  all, so a test can't pass because the loser silently returned null. */
function beats(query: string, winner: string, loser: string) {
  const a = scoreMatch(query, winner);
  const b = scoreMatch(query, loser);
  expect(a).not.toBeNull();
  expect(b).not.toBeNull();
  expect(a as number).toBeGreaterThan(b as number);
}

describe('scoreMatch', () => {
  it('matches a subsequence, not just a substring', () => {
    /* The whole reason this is not `includes()`: you type the consonants of a
       landmark and stop thinking about it. */
    expect(scoreMatch('cmst', 'Comma Castle')).not.toBeNull();
    expect(scoreMatch('geo', 'Geometry Basics')).not.toBeNull();
  });

  it('returns null when a letter is missing or out of order', () => {
    expect(scoreMatch('zebra', 'Comma Castle')).toBeNull();
    /* Order matters — the same letters backwards is not a match. */
    expect(scoreMatch('eltsac', 'Castle')).toBeNull();
  });

  it('scores an empty query as a tie rather than a miss', () => {
    /* An empty query lists everything; if it returned null the palette would
       open blank. */
    expect(scoreMatch('', 'Comma Castle')).toBe(0);
  });

  it('is case-insensitive in both directions', () => {
    expect(scoreMatch('COMMA', 'comma castle')).toBe(scoreMatch('comma', 'COMMA CASTLE'));
  });

  it('breaks ties toward the shorter target', () => {
    /* "commas" should land on "Commas", not on the longest label that happens
       to start with it — and not on whichever was declared first. */
    beats('commas', 'Commas', 'Commas and clauses');
  });

  it('prefers a hit at the start of a word to one buried mid-word', () => {
    beats('rat', 'Rate problems', 'Accurate reading');
  });

  it('prefers a contiguous run to the same letters scattered', () => {
    /* Equal lengths, and neither hit is at a word start, so the run bonus is
       the only thing separating them — the real labels that motivate this rule
       differ in length too, which would prove nothing on its own.

       Note the ordering this does *not* claim: a word-start hit can and does
       outscore a longer run elsewhere. That is deliberate. Typing "mm" should
       land on "Mom" before "grammar", because people type the starts of words. */
    beats('abc', 'xabcxx', 'xaxbxc');
  });

  it('treats a hyphen as a word boundary', () => {
    /* Topic slugs arrive hyphenated, so "sv" has to find "subject-verb". */
    beats('sv', 'subject-verb', 'serves');
  });
});
