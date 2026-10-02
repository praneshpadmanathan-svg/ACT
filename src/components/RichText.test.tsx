/* The italic rule in `markish` lost its lookbehind so the app would parse on
 * Safari before 16.4. These pin the rewrite to the old behaviour: the old
 * pattern is rebuilt from a string here (Node has lookbehind, and test files
 * never ship), and every case must come out byte-identical through both. */

import { describe, expect, it } from 'vitest';

import { markish } from './RichText';
import richTextSource from './RichText.tsx?raw';

const OLD_ITALIC = new RegExp('(^|[\\s(])\\*(?!\\s)(.+?)(?<!\\s)\\*', 'g');
const NEW_ITALIC = /(^|[\s(])\*(\S|\S.*?\S)\*/g;

const CASES = [
  '*a*',
  'an *italic* word',
  'two *one* and *two* here',
  '(*parenthetical*)',
  '* not italic *',
  '*trailing space *',
  '* leading space*',
  'a * b * c',
  '*a * b*',
  '*a *b* c*',
  '2*3*4',
  'x *y* z*',
  '**',
  '***',
  '* *',
  '*x*y*',
  'line one *a\nb* line two',
  '*\tx*',
  'f(*x*) = *y* + *z *w*',
  'ends with star*',
  '',
];

describe('markish italic rule', () => {
  it.each(CASES)('matches the lookbehind version on %j', (input) => {
    expect(input.replace(NEW_ITALIC, '$1<em>$2</em>')).toBe(
      input.replace(OLD_ITALIC, '$1<em>$2</em>'),
    );
  });

  it('still renders bold, italic and code together', () => {
    expect(markish('**bold** then *ital* and `x < y`')).toBe(
      '<strong>bold</strong> then <em>ital</em> and <code>x &lt; y</code>',
    );
  });

  it('ships no lookbehind', () => {
    expect(richTextSource).not.toMatch(/\(\?<[!=]/);
  });
});
