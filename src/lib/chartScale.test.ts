/* Geometry, not markup.

   A chart component fails loudly when its JSX is wrong — nothing renders, or
   it renders visibly broken. It fails silently when its arithmetic is wrong:
   an axis that clips its own maximum, an inverted y, or ticks at 23.6 instead
   of 25 all produce a chart that looks like a chart. On a Science figure the
   student then reads a wrong value off it and the question is unanswerable
   for reasons nobody can see. */

import { describe, it, expect } from 'vitest';
import { niceScale, formatTick, categories, extentOf, project } from './chartScale';

describe('niceScale', () => {
  it('always contains the data it was given', () => {
    /* The one property that must never break: an axis that excludes a point
       draws that point outside the plot area. */
    const cases: [number, number][] = [
      [0, 120],
      [0.09, 1.61],
      [18, 150],
      [-40, 15],
      [0, 0.82],
    ];
    for (const [min, max] of cases) {
      const s = niceScale(min, max);
      expect(s.min).toBeLessThanOrEqual(min);
      expect(s.max).toBeGreaterThanOrEqual(max);
    }
  });

  it('picks round steps a reader can do arithmetic against', () => {
    expect(niceScale(0, 120).ticks).toEqual([0, 25, 50, 75, 100, 125]);
    expect(niceScale(0, 1).ticks).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
  });

  it('does not accumulate floating-point drift across ticks', () => {
    /* Summing `t += 0.2` five times gives 1.0000000000000002, which formats
       as a tick label of "1.0000000000000002" or, worse, fails an equality
       check somewhere downstream. */
    for (const t of niceScale(0, 1).ticks) {
      expect(Number(t.toFixed(10))).toBe(t);
    }
  });

  it('gives a flat series a band to sit in rather than a zero-height axis', () => {
    /* The pendulum figure: period is 2.0 s at every mass, and that constancy
       is the finding. A zero-span axis would divide by zero or pin every bar
       to the top of the plot. */
    const s = niceScale(2, 2);
    expect(s.max).toBeGreaterThan(s.min);
    expect(s.min).toBeLessThanOrEqual(2);
    expect(s.max).toBeGreaterThanOrEqual(2);
  });

  it('survives a degenerate domain without producing NaN', () => {
    const s = niceScale(NaN, NaN);
    expect(Number.isFinite(s.min)).toBe(true);
    expect(Number.isFinite(s.max)).toBe(true);
  });
});

describe('formatTick', () => {
  it('shows the decimals the step implies, and no more', () => {
    expect(formatTick(0.4, 0.2)).toBe('0.4');
    expect(formatTick(50, 25)).toBe('50');
  });
});

describe('categories', () => {
  it('unions the x values across series rather than trusting the first', () => {
    const out = categories([
      { points: [{ x: 20 }, { x: 100 }] },
      { points: [{ x: 50 }, { x: 100 }] },
    ]);
    expect(out).toEqual([20, 50, 100]);
  });
});

describe('project', () => {
  it('maps the domain ends onto the range ends', () => {
    expect(project(0, { min: 0, max: 100 }, { from: 0, to: 200 })).toBe(0);
    expect(project(100, { min: 0, max: 100 }, { from: 0, to: 200 })).toBe(200);
    expect(project(50, { min: 0, max: 100 }, { from: 0, to: 200 })).toBe(100);
  });

  it('inverts when the range is given inverted, which is how y works', () => {
    /* SVG's origin is top-left. A y range of {from: 300, to: 0} is what turns
       "bigger value" into "higher on screen"; if this ever stopped honouring
       the direction of the range, every chart would render upside down and
       still look like a chart. */
    expect(project(0, { min: 0, max: 10 }, { from: 300, to: 0 })).toBe(300);
    expect(project(10, { min: 0, max: 10 }, { from: 300, to: 0 })).toBe(0);
  });

  it('centres a value whose domain has no span', () => {
    expect(project(5, { min: 5, max: 5 }, { from: 0, to: 100 })).toBe(50);
  });
});

describe('extentOf', () => {
  it('reports the true min and max', () => {
    expect(extentOf([3, 1, 4, 1, 5])).toEqual({ min: 1, max: 5 });
  });
});
