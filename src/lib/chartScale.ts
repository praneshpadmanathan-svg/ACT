/* The arithmetic behind FigureChart, kept out of the component.

   Everything a chart component does is either markup or geometry, and only
   one of those can be wrong quietly. A missing axis label is obvious in the
   first screenshot; a y-scale that excludes its own maximum draws a line that
   leaves the plot, and a tick sequence that rounds badly draws a graph the
   student reads a wrong value off — which, on a Science figure, is the whole
   point of the question. So the geometry lives here with tests beside it.

   Nothing here knows about SVG, React or the design system. It takes numbers
   and gives back numbers. */

export interface Extent {
  min: number;
  max: number;
}

/**
 * A "nice" axis: round tick values that contain every data point.
 *
 * The step is chosen from 1/2/5 x a power of ten, which is what produces
 * ticks a reader can do mental arithmetic against (0, 25, 50, 75, 100 — never
 * 0, 23.6, 47.2). The bounds are then snapped outward to whole steps, so the
 * axis always contains the data rather than clipping it.
 *
 * @param min lowest value in the data
 * @param max highest value in the data
 * @param target roughly how many intervals to aim for; the real count varies
 *   because the step is snapped to a round number, not fitted to this exactly
 */
export function niceScale(min: number, max: number, target = 5): { ticks: number[] } & Extent {
  /* A flat series — every y identical — has no range to divide. The pendulum
     figure is exactly this: the period does not change with mass, and that
     *is* the finding. Give it a band around the value so the bar or line sits
     in the middle of the plot instead of on its ceiling with zero height. */
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1, ticks: [0, 1] };
  if (min === max) {
    const pad = Math.abs(min) > 0 ? Math.abs(min) / 2 : 0.5;
    return niceScale(min - pad, max + pad, target);
  }

  const step = niceStep((max - min) / target);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;

  const ticks: number[] = [];
  /* Accumulating `t += step` drifts on values like 0.1; multiplying a counter
     keeps every tick exactly on a step multiple. The rounding mops up the
     binary representation so a tick prints as 0.3 rather than 0.30000000004. */
  const count = Math.round((hi - lo) / step);
  for (let i = 0; i <= count; i++) ticks.push(round(lo + i * step, step));

  return { min: lo, max: hi, ticks };
}

/** The round-number ladder: the smallest round step that is still at least
 *  `raw`, so the tick count lands near the target rather than under it.
 *
 *  2.5 is on the ladder deliberately. Without it a 0-120 axis at five
 *  intervals wants a step of 24, rounds up to 50, and draws 0/50/100/150 —
 *  three intervals and a top gridline half again as high as any data point.
 *  With it the step is 25 and the axis is 0/25/50/75/100/125, which is both
 *  the requested density and the sequence a reader expects to see. */
function niceStep(raw: number): number {
  const power = Math.pow(10, Math.floor(Math.log10(Math.abs(raw) || 1)));
  const scaled = raw / power;
  if (scaled <= 1) return power;
  if (scaled <= 2) return 2 * power;
  if (scaled <= 2.5) return 2.5 * power;
  if (scaled <= 5) return 5 * power;
  return 10 * power;
}

/** Trim floating-point noise to the precision the step itself implies. */
function round(value: number, step: number): number {
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  return Number(value.toFixed(Math.min(decimals + 1, 12)));
}

/** Format a tick for display, at the precision its step warrants. */
export function formatTick(value: number, step: number): string {
  const decimals = Math.max(0, -Math.floor(Math.log10(Math.abs(step) || 1)));
  return value.toFixed(Math.min(decimals, 6));
}

/** Every distinct x in the data, in ascending order — the categories a bar
 *  chart spaces evenly. Series may disagree on which x values they carry, so
 *  this unions them rather than trusting the first series. */
export function categories(series: { points: { x: number }[] }[]): number[] {
  const seen = new Set<number>();
  for (const s of series) for (const p of s.points) seen.add(p.x);
  return [...seen].sort((a, b) => a - b);
}

export function extentOf(values: number[]): Extent {
  return { min: Math.min(...values), max: Math.max(...values) };
}

/**
 * Map a data value onto a pixel position.
 *
 * `y` is inverted on purpose: SVG's origin is top-left, so a larger value has
 * to produce a *smaller* pixel coordinate. Getting this backwards renders a
 * chart that is upside down but otherwise entirely plausible.
 */
export function project(
  value: number,
  domain: Extent,
  range: { from: number; to: number },
): number {
  const span = domain.max - domain.min;
  if (span === 0) return (range.from + range.to) / 2;
  const t = (value - domain.min) / span;
  return range.from + t * (range.to - range.from);
}
