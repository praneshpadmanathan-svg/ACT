/* The two charts on the statistics screen.
 *
 * Kept apart from `Stats.tsx` for the same reason `chartScale.ts` is kept
 * apart from `FigureChart.tsx`: a screen is markup and a chart is geometry,
 * and only one of those goes wrong quietly.
 *
 * These are dashboard charts, not test figures, so they behave in the opposite
 * way to `FigureChartView` on one point: they carry a hover readout. There the
 * exact y is the answer to the question and a tooltip would give it away; here
 * the exact y is the *point*, and making a student estimate their own score
 * off a 90-pixel plot would be a strange thing to do to them.
 *
 * Two rules shape everything below:
 *
 *   One axis, one instrument. `ScoreTrend` plots scored practice tests and
 *   nothing else. The drill estimate is a different instrument on a different
 *   scale — `trackStatus` already refuses to subtract one from the other, on
 *   the grounds that the gap between them is a systematic offset rather than
 *   progress — so it is never a point on this line.
 *
 *   Identity never rests on hue. Both charts are single-series, which is the
 *   cleanest way to honour that: one hue, no legend, and the title says what
 *   is plotted. (The four section colours do *not* separate adequately in the
 *   light theme — worst adjacent pair scores 3.9 under simulated protanopia,
 *   against a target of 8 — so nothing here may put two of them in one plot.)
 */

import { useState } from 'react';
import { extentOf, niceScale, project } from '@/lib/chartScale';
import type { TestResult } from '@/types';

/* ------------------------------------------------------------ score trend */

/** Below this there is no line to draw, only a dot — and a dot with no second
 *  point is an invitation to read a trend that has not happened yet. */
export const MIN_TREND_POINTS = 2;

const W = 300;
const H = 96;
/* `top` leaves room for the goal label to sit *above* its own rule when the
   target is the top of the domain, which it is for anyone still climbing
   towards it — the common case. `right` is sized for the endpoint value and
   nothing else, because the goal label lives at the other end: the two are the
   only text in the plot and putting them at opposite edges is what makes a
   collision between them impossible rather than merely unlikely. */
const PAD = { top: 20, right: 30, bottom: 20, left: 9 };

/* Text drawn over a plot gets a halo of the surface colour, painted under the
   glyphs. Same idea as the ring around the marks: a label has to stay readable
   where it crosses the line it is annotating. */
const HALO = {
  stroke: 'oklch(var(--c-leather-850))',
  strokeWidth: 3,
  paintOrder: 'stroke' as const,
  strokeLinejoin: 'round' as const,
};

const shortDate = (ts: number) =>
  new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export function ScoreTrend({ tests, target }: { tests: TestResult[]; target: number }) {
  const [hover, setHover] = useState<number | null>(null);

  /* Ordered by when the test was sat, not by whatever order the save happens
     to hold them in — a line drawn through unsorted points is a scribble. */
  const points = [...tests].sort((a, b) => a.at - b.at);
  if (points.length < MIN_TREND_POINTS) return null;

  /* The target is inside the domain so its rule lands in the plot rather than
     off the top edge, where a reader would never learn it exists. */
  const scores = points.map((t) => t.composite);
  const yExtent = extentOf([...scores, target]);
  const y = niceScale(yExtent.min, yExtent.max, 2);
  const toY = (v: number) =>
    project(v, { min: y.min, max: y.max }, { from: H - PAD.bottom, to: PAD.top });

  /* Time on x, not the test's index. Three tests in one week and then a month
     off is a real shape, and evenly spacing them would draw steady work that
     never happened. */
  const xExtent = extentOf(points.map((t) => t.at));
  const toX = (v: number) => project(v, xExtent, { from: PAD.left, to: W - PAD.right });

  const path = points.map((t, i) => `${i ? 'L' : 'M'}${toX(t.at)},${toY(t.composite)}`).join(' ');
  const last = points[points.length - 1]!;
  const shown = hover !== null ? points[hover] : null;

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ maxWidth: 380 }}
        role="img"
        aria-label={`Composite scores from ${points.length} scored practice tests, ${scores.join(', ')}, against a target of ${target}.`}
      >
        {/* The target, as a rule rather than a second series — it is a line on
            the page the scores are measured against, not a thing that varies
            over time. Dashed so it reads as an annotation. */}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={toY(target)}
          y2={toY(target)}
          stroke="oklch(var(--c-leather-700))"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        <text
          x={PAD.left}
          y={toY(target) - 5}
          className="num"
          fontSize={9}
          fill="oklch(var(--c-ink-faint))"
          style={HALO}
        >
          goal {target}
        </text>

        <path d={path} fill="none" stroke="oklch(var(--c-gold))" strokeWidth={2} />

        {points.map((t, i) => (
          <g key={t.id}>
            {/* The mark, ringed in the surface colour so it separates from the
                line it sits on. */}
            <circle
              cx={toX(t.at)}
              cy={toY(t.composite)}
              r={hover === i ? 5 : 4}
              fill="oklch(var(--c-gold))"
              stroke="oklch(var(--c-leather-850))"
              strokeWidth={2}
            />
            {/* A hit target far bigger than the mark. Four-pixel circles are
                not something anyone can reliably put a cursor on, and on a
                touch screen they are not a target at all. */}
            <circle
              cx={toX(t.at)}
              cy={toY(t.composite)}
              r={14}
              fill="transparent"
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
            />
          </g>
        ))}

        {/* The newest score, direct-labelled. One label, not seven: a number
            on every point is the thing that turns a shape back into a table. */}
        <text
          x={toX(last.at) + 7}
          y={toY(last.composite) + 4}
          className="num"
          fontSize={13}
          fill="oklch(var(--c-gold-light))"
          style={HALO}
        >
          {last.composite}
        </text>
      </svg>

      {/* The readout, in the flow rather than floating over the plot: a
          tooltip positioned against a scaling viewBox is arithmetic waiting to
          drift, and this has somewhere sensible to sit. At rest it names the
          span, which is the axis label the chart is too small to carry. */}
      <figcaption className="mt-1 font-script text-[10px] uppercase tracking-[0.12em] text-ink-faint">
        {shown ? (
          <span className="text-parchment-dim">
            <span className="num">{shown.composite}</span> composite · {shortDate(shown.at)}
          </span>
        ) : (
          <>
            {points.length} scored tests · {shortDate(points[0]!.at)} to {shortDate(last.at)}
          </>
        )}
      </figcaption>
    </figure>
  );
}

/* --------------------------------------------------------------- activity */

/** Magnitude over time, as one hue getting darker — the sequential case.
 *
 *  The old version stepped the fill between three hand-picked colours at
 *  `0`, `0.6 x max` and everything else, which drew a cliff in the middle of
 *  a continuous quantity: two days one question apart could land on different
 *  sides of the threshold and look unrelated. */
export function ActivityChart({ counts }: { counts: number[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...counts);
  const busiest = counts.indexOf(max);
  const total = counts.reduce((a, b) => a + b, 0);

  /* Counted back from the right-hand edge rather than resolved to a date.
     A calendar date would need the clock, and reading the clock during render
     makes the same bar answer differently on a re-render that happens to
     straddle midnight. It also matches how the axis already frames itself —
     "12 weeks ago" on one end and "Today" on the other. */
  const daysAgo = (i: number) => counts.length - 1 - i;
  const whenLabel = (i: number) => {
    const d = daysAgo(i);
    return d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
  };

  return (
    <figure className="m-0">
      <div
        className="flex items-end gap-[2px]"
        style={{ height: 90 }}
        role="img"
        aria-label={`Questions answered on each of the last ${counts.length} days. ${total} in total, busiest day ${max}.`}
      >
        {counts.map((count, i) => (
          <div
            key={i}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
            className="relative h-full flex-1 cursor-default"
            /* The hit target is the full column height; the bar inside it is
               the mark. Aiming at a three-pixel stub is not a hover layer. */
          >
            {/* One direct label, on the tallest bar — the value that sets the
                scale everything else is read against. Centred over a column
                seven pixels wide, so it overhangs its neighbours; the panel's
                own padding is what it overhangs into. */}
            {i === busiest && (
              <span className="num absolute -top-0.5 left-1/2 -translate-x-1/2 text-[10px] leading-none text-gold-light">
                {max}
              </span>
            )}
            <div className="flex h-full flex-col justify-end pt-3.5">
              <div
                className="rounded-t-[2px] transition-[height,opacity] duration-quick"
                style={{
                  height: `${Math.max(3, (count / max) * 100)}%`,
                  /* One hue, light to dark. The floor keeps a single-question
                     day visible; below that it is indistinguishable from a day
                     with none, which is the one distinction this chart owes the
                     reader. A day with no work is leather, not a pale gold —
                     zero is an absence, not a small amount. */
                  background:
                    count === 0
                      ? 'oklch(var(--c-leather-800))'
                      : `oklch(var(--c-gold) / ${(0.4 + 0.6 * (count / max)).toFixed(2)})`,
                  outline: hover === i ? '1px solid oklch(var(--c-gold-light))' : undefined,
                  outlineOffset: 1,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <figcaption className="mt-3 flex justify-between font-script text-[10px] uppercase tracking-wide text-ink-faint">
        {/* The left-hand axis label doubles as the readout. A hovered day says
            what it was; at rest the axis says where the chart starts. Two
            lines would leave one of them empty most of the time. */}
        {hover !== null ? (
          <span className="text-parchment-dim">
            <span className="num">{counts[hover]}</span>{' '}
            {counts[hover] === 1 ? 'question' : 'questions'} · {whenLabel(hover)}
          </span>
        ) : (
          <span>12 weeks ago</span>
        )}
        <span>Today</span>
      </figcaption>
    </figure>
  );
}
