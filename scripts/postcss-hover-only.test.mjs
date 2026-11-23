// @vitest-environment node
/* A hover rule that escapes the media query sticks on a phone after a tap,
 * and one wrapped twice, or a non-hover selector swept in with it, is a style
 * that silently stops applying on touch. Both fail quietly, so they are
 * pinned here. */

import postcss from 'postcss';
import { expect, it } from 'vitest';
import hoverOnly from './postcss-hover-only.mjs';

const run = async (css) => (await postcss([hoverOnly()]).process(css, { from: undefined })).css;
const squash = (css) =>
  css
    .replace(/\s*([{}])\s*/g, ' $1 ')
    .replace(/\s+/g, ' ')
    .trim();

it('wraps a hover rule in a hover media query', async () => {
  expect(squash(await run('.a:hover { color: red; }'))).toBe(
    '@media (hover: hover) { .a:hover { color: red; } }',
  );
});

it('splits a mixed selector list so the non-hover half still applies on touch', async () => {
  const out = squash(await run('.a:hover .m, .active .m { color: red; }'));
  expect(out).toBe(
    '.active .m { color: red; } @media (hover: hover) { .a:hover .m { color: red; } }',
  );
});

it('leaves rules already inside a hover query alone', async () => {
  const css = '@media (hover: hover) { .a:hover { color: red; } }';
  expect(squash(await run(css))).toBe(css);
});

it('nests inside an existing media query rather than escaping it', async () => {
  expect(squash(await run('@media (min-width: 40em) { .a:hover { color: red; } }'))).toBe(
    '@media (min-width: 40em) { @media (hover: hover) { .a:hover { color: red; } } }',
  );
});

it('does not touch active, focus or plain rules', async () => {
  const css = '.a:active { color: red; } .a:focus-visible { outline: 0; } .b { color: blue; }';
  expect(squash(await run(css))).toBe(css);
});
