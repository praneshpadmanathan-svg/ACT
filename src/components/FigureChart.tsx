/* A plotted figure on the paper sheet.

   Drawn as a plate inked into a field journal rather than as a dashboard
   chart: script small-caps on the axis titles and the key, sepia rules, and
   the same paper-edge border the data tables next to it wear. The
   geometry underneath is ordinary and honest — this is a test figure, and a
   student has to be able to read a value off it.

   Deliberately static. Every other chart in a web app gets a hover tooltip,
   and here that would be a bug: `sci.iod.read-value` questions ask the
   student to read a quantity off the plot, so a tooltip printing the exact y
   would answer the question for them. The same reasoning keeps value labels
   off the marks. What replaces interactivity is redundancy — a key, a dash
   pattern and a distinct marker shape per series — so identity never rests on
   colour alone for a reader who cannot separate the hues. */

import type { FigureChart } from '@/types';
import { niceScale, formatTick, categories, extentOf, project } from '@/lib/chartScale';

/* Fixed order, never cycled: series 1 is always rust, series 2 always blue.
   Validated for colour-vision deficiency against the paper surface
   (#F4E8CF) — the adjacent-pair separation is why the order is this rather
   than hue-sorted. These stay literal rather than becoming theme tokens
   because they carry identity, not chrome: a series must not change colour
   when the reader flips the theme, exactly as the correct-answer green
   elsewhere in the app is fixed. */
const SERIES_COLORS = Array.from({ length: 5 }, (_, i) => `oklch(var(--c-series-${i + 1}))`);
const DASHES = ['', '7 4', '2 3', '10 3 2 3', '4 2'];

/* Wrapped rather than indexed inline: the index is always in range because it
   is taken modulo the array length, but the compiler cannot see that, and a
   cast to silence it would also silence a real out-of-range read later. */
const colorAt = (i: number): string =>
  SERIES_COLORS[i % SERIES_COLORS.length] ?? 'oklch(var(--c-series-1))';
const dashAt = (i: number): string | undefined => DASHES[i % DASHES.length] || undefined;

/** The gap between two ticks — the precision their labels should be shown at. */
const stepOf = (ticks: number[]): number => {
  const [first, second] = ticks;
  return first !== undefined && second !== undefined ? second - first : 1;
};

const W = 540;
const H = 300;
const PAD = { top: 14, right: 18, bottom: 46, left: 56 };
const PLOT = {
  x0: PAD.left,
  x1: W - PAD.right,
  y0: H - PAD.bottom,
  y1: PAD.top,
};

export function FigureChartView({ figure }: { figure: FigureChart }) {
  const { kind, series } = figure;
  const isBar = kind === 'bar';

  const yExtent = extentOf(series.flatMap((s) => s.points.map((p) => p.y)));
  /* A bar's length is read from the baseline, so its axis has to include zero
     or the bars lie about their ratios — the classic truncated-axis chart. A
     line is read by its shape and may start wherever the data does. */
  const yScale = niceScale(isBar ? Math.min(0, yExtent.min) : yExtent.min, yExtent.max);
  const yStep = stepOf(yScale.ticks);
  const toY = (v: number) =>
    project(v, { min: yScale.min, max: yScale.max }, { from: PLOT.y0, to: PLOT.y1 });

  const cats = categories(series);
  const xExtent = extentOf(cats.length ? cats : [0, 1]);
  const xScale = niceScale(xExtent.min, xExtent.max);
  const xStep = stepOf(xScale.ticks);

  /* Bars sit in evenly spaced bands; a line reads against a real number line. */
  const bandWidth = (PLOT.x1 - PLOT.x0) / Math.max(cats.length, 1);
  const toX = (v: number) =>
    isBar
      ? PLOT.x0 + bandWidth * (cats.indexOf(v) + 0.5)
      : project(v, { min: xScale.min, max: xScale.max }, { from: PLOT.x0, to: PLOT.x1 });

  const xTicks = isBar ? cats : xScale.ticks;
  const showKey = series.length > 1;

  return (
    <div className="overflow-x-auto rounded-lg border-2 border-paper-edge bg-paper-light/40 px-3 pb-2 pt-3">
      {showKey && (
        <ul className="mb-1 flex flex-wrap items-center gap-x-5 gap-y-1 px-1">
          {series.map((s, i) => (
            <li
              key={s.name}
              className="flex items-center gap-2 font-script text-[11px] uppercase tracking-[0.14em] text-ink-soft"
            >
              <svg width="26" height="10" aria-hidden="true" className="flex-none">
                <line
                  x1="1"
                  y1="5"
                  x2="25"
                  y2="5"
                  stroke={colorAt(i)}
                  strokeWidth="2"
                  strokeDasharray={dashAt(i)}
                />
                <Marker index={i} x={13} y={5} fill={colorAt(i)} />
              </svg>
              {s.name}
            </li>
          ))}
        </ul>
      )}

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full min-w-[420px]"
        role="img"
        aria-label={figure.alt}
      >
        <title>{figure.label}</title>
        <desc>{figure.alt}</desc>

        {/* Horizontal rules only. Vertical ones would fight the bars and add
            nothing to a line the reader tracks left to right. */}
        {yScale.ticks.map((t) => (
          <line
            key={t}
            x1={PLOT.x0}
            x2={PLOT.x1}
            y1={toY(t)}
            y2={toY(t)}
            stroke="oklch(var(--c-paper-edge))"
            strokeWidth="1"
            opacity={t === 0 ? 0.85 : 0.4}
          />
        ))}

        <line
          x1={PLOT.x0}
          y1={PLOT.y1}
          x2={PLOT.x0}
          y2={PLOT.y0}
          stroke="oklch(var(--c-ink-faint))"
          strokeWidth="1.5"
        />
        <line
          x1={PLOT.x0}
          y1={PLOT.y0}
          x2={PLOT.x1}
          y2={PLOT.y0}
          stroke="oklch(var(--c-ink-faint))"
          strokeWidth="1.5"
        />

        {yScale.ticks.map((t) => (
          <text
            key={t}
            x={PLOT.x0 - 8}
            y={toY(t)}
            textAnchor="end"
            dominantBaseline="middle"
            className="font-read"
            fontSize="12"
            fill="oklch(var(--c-ink-soft))"
          >
            {formatTick(t, yStep)}
          </text>
        ))}

        {xTicks.map((t) => (
          <text
            key={t}
            x={toX(t)}
            y={PLOT.y0 + 18}
            textAnchor="middle"
            className="font-read"
            fontSize="12"
            fill="oklch(var(--c-ink-soft))"
          >
            {formatTick(t, isBar ? 1 : xStep)}
          </text>
        ))}

        <text
          x={(PLOT.x0 + PLOT.x1) / 2}
          y={H - 8}
          textAnchor="middle"
          className="font-script"
          fontSize="12"
          letterSpacing="1.6"
          fill="oklch(var(--c-ink-soft))"
        >
          {figure.xLabel.toUpperCase()}
        </text>
        <text
          transform={`rotate(-90 14 ${(PLOT.y0 + PLOT.y1) / 2})`}
          x={14}
          y={(PLOT.y0 + PLOT.y1) / 2}
          textAnchor="middle"
          className="font-script"
          fontSize="12"
          letterSpacing="1.6"
          fill="oklch(var(--c-ink-soft))"
        >
          {figure.yLabel.toUpperCase()}
        </text>

        {isBar
          ? series.map((s, si) =>
              s.points.map((p) => {
                /* One band per category, shared by however many series exist,
                   with the fill inset inside its slot so neighbouring bars
                   never touch. */
                const slot = bandWidth / series.length;
                const w = Math.max(slot * 0.68, 4);
                const cx = PLOT.x0 + bandWidth * (cats.indexOf(p.x) + 0.5);
                const x = cx - (slot * series.length) / 2 + slot * si + (slot - w) / 2;
                const y = toY(p.y);
                const base = toY(Math.max(0, yScale.min));
                return (
                  <rect
                    key={`${s.name}-${p.x}`}
                    x={x}
                    y={Math.min(y, base)}
                    width={w}
                    height={Math.max(Math.abs(base - y), 1)}
                    rx="4"
                    fill={colorAt(si)}
                  />
                );
              }),
            )
          : series.map((s, si) => {
              const color = colorAt(si);
              const pts = [...s.points].sort((a, b) => a.x - b.x);
              const d = pts.map((p, i) => `${i ? 'L' : 'M'}${toX(p.x)},${toY(p.y)}`).join(' ');
              return (
                <g key={s.name}>
                  <path
                    d={d}
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={dashAt(si)}
                  />
                  {pts.map((p) => (
                    <Marker key={p.x} index={si} x={toX(p.x)} y={toY(p.y)} fill={color} ring />
                  ))}
                </g>
              );
            })}
      </svg>
    </div>
  );
}

/* A distinct shape per series, so two lines stay tellable apart in greyscale,
   in print, and for a reader with colour-vision deficiency. `ring` paints a
   paper-coloured halo so a marker crossing another series still reads as
   one point rather than as a smudge where the two overlap. */
function Marker({
  index,
  x,
  y,
  fill,
  ring = false,
}: {
  index: number;
  x: number;
  y: number;
  fill: string;
  ring?: boolean;
}) {
  const common = {
    fill,
    stroke: ring ? 'oklch(var(--c-paper))' : undefined,
    strokeWidth: ring ? 2 : undefined,
  };
  if (index % 5 === 3) {
    return (
      <polygon points={`${x},${y - 5} ${x + 5},${y} ${x},${y + 5} ${x - 5},${y}`} {...common} />
    );
  }
  if (index % 5 === 4) {
    return <path d={`M${x - 5},${y - 2}h3v-3h4v3h3v4h-3v3h-4v-3h-3Z`} {...common} />;
  }
  if (index % 5 === 1) {
    return <rect x={x - 4} y={y - 4} width="8" height="8" rx="1" {...common} />;
  }
  if (index % 5 === 2) {
    return <polygon points={`${x},${y - 5} ${x + 5},${y + 4} ${x - 5},${y + 4}`} {...common} />;
  }
  return <circle cx={x} cy={y} r="4.5" {...common} />;
}
