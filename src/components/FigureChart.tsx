/* A plotted figure on the paper sheet.

   Drawn as a plate inked into a field journal rather than as a dashboard
   chart: script small-caps on the axis titles and the key, sepia rules, and
   the same paper-edge border the data tables next to it wear. The
   geometry underneath is ordinary and honest — this is a test figure, and a
   student has to be able to read a value off it.

   Deliberately static, and deliberately without a data-table view. Every
   other chart in a web app gets a hover tooltip and a "show data" toggle, and
   here either would be a bug: `sci.iod.read-value` questions ask the student
   to read a quantity off the plot, so printing the exact y would answer the
   question for them. The same reasoning keeps value labels off the marks and
   keeps the alt text to the trend. What replaces interactivity is redundancy
   — a key, a dash pattern, a distinct marker shape and, on bars, a hatch per
   series — so identity never rests on colour alone. */

import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { FigureChart } from '@/types';
import { niceScale, formatTick, categories, extentOf, project } from '@/lib/chartScale';

/* Fixed order, never cycled: series 1 is always rust, series 2 always blue.
   The hues are theme tokens (`--c-series-N`) validated for colour-vision
   deficiency against the paper surface; the adjacent-pair separation is why
   the order is this rather than hue-sorted. The paper sheet does not change
   with the app theme, so neither do they. */
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

/** A measured value printed as measured: 0.5 stays 0.5, 20 stays 20. */
const exact = (v: number): string => String(Number(v.toFixed(6)));

/* Uppercasing a whole axis title turns "(mol/L)" into "(MOL/L)" and "(s)"
   into "(S)" — a different unit, and siemens at that. Only the quantity's
   name takes the small caps; the unit keeps its case. */
const titleCase = (label: string): string => {
  const i = label.indexOf('(');
  return i < 0 ? label.toUpperCase() : label.slice(0, i).toUpperCase() + label.slice(i);
};

/* Two geometries rather than one scaled drawing. A 540-unit plate squeezed
   into a phone's 320px column renders its 14-unit labels at 8px; the narrow
   plate is drawn for that width so its labels land at 11.5px or more. */
const WIDE = { W: 540, H: 300, font: 14, pad: { top: 14, right: 18, bottom: 46, left: 56 } };
const NARROW = { W: 330, H: 270, font: 14, pad: { top: 12, right: 14, bottom: 46, left: 58 } };
const NARROW_BELOW = 460;

/** A bar with only its data end rounded: the end at the baseline stays square,
 *  so the bar reads as standing on the axis rather than floating above it. */
function barPath(x: number, w: number, y: number, base: number): string {
  const h = Math.abs(base - y);
  const r = Math.min(4, w / 2, h);
  if (y <= base) {
    return `M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${base}Z`;
  }
  return `M${x},${base}V${y - r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y - r}V${base}Z`;
}

export function FigureChartView({ figure }: { figure: FigureChart }) {
  const { kind, series } = figure;
  const isBar = kind === 'bar';
  const uid = useId().replace(/:/g, '');

  const wrapRef = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setNarrow(el.clientWidth < NARROW_BELOW);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const G = narrow ? NARROW : WIDE;
  const { W, H, font, pad } = G;
  const PLOT = { x0: pad.left, x1: W - pad.right, y0: H - pad.bottom, y1: pad.top };

  const yExtent = extentOf(series.flatMap((s) => s.points.map((p) => p.y)));
  /* A bar's length is read from the baseline, so its axis has to include zero
     — from below as well as above — or the bars lie about their ratios. A
     line is read by its shape and may start wherever the data does. Bars also
     get headroom: a bar whose top is the top gridline reads as clipped, and on
     the pendulum figure every bar did exactly that. */
  const yLo = isBar ? Math.min(0, yExtent.min) : yExtent.min;
  const yHi = isBar ? Math.max(0, yExtent.max) : yExtent.max;
  let yScale = niceScale(yLo, yHi);
  if (isBar && yHi > 0 && yScale.max === yHi) {
    yScale = niceScale(yLo, yHi + stepOf(yScale.ticks) / 2);
  }
  const yStep = stepOf(yScale.ticks);
  const toY = (v: number) =>
    project(v, { min: yScale.min, max: yScale.max }, { from: PLOT.y0, to: PLOT.y1 });

  const cats = categories(series);
  const xExtent = extentOf(cats.length ? cats : [0, 1]);
  const xScale = niceScale(xExtent.min, xExtent.max);

  /* When the experiment sampled at even intervals — every 15 minutes, every
     day — tick exactly where it measured. A nice-number axis would put ticks
     at 10, 20, 30 between readings taken at 15 and 30, and a student reading
     a value at 45 then has to interpolate a gridline the data never had. */
  const gaps = cats.slice(1).map((c, i) => c - (cats[i] ?? 0));
  const even =
    cats.length >= 2 &&
    cats.length <= 8 &&
    gaps.every((g) => Math.abs(g - (gaps[0] ?? 0)) < 1e-9 * Math.max(1, Math.abs(g)));
  const xTicks = isBar || even ? cats : xScale.ticks;
  const xLabelOf = (t: number) => (isBar || even ? exact(t) : formatTick(t, stepOf(xScale.ticks)));

  /* Bars sit in evenly spaced bands; a line reads against a real number line. */
  const bandWidth = (PLOT.x1 - PLOT.x0) / Math.max(cats.length, 1);
  const toX = (v: number) =>
    isBar
      ? PLOT.x0 + bandWidth * (cats.indexOf(v) + 0.5)
      : project(v, { min: xScale.min, max: xScale.max }, { from: PLOT.x0, to: PLOT.x1 });

  const showKey = series.length > 1;
  const fillAt = (i: number, scope: string) =>
    isBar && i > 0 ? `url(#${uid}-${scope}${i})` : colorAt(i);

  return (
    <div
      ref={wrapRef}
      className="rounded-lg border-2 border-paper-edge bg-paper-light/40 px-3 pb-2 pt-3"
    >
      {showKey && (
        <ul className="mb-1 flex flex-wrap items-center gap-x-5 gap-y-1 px-1">
          {series.map((s, i) => (
            <li
              key={s.name}
              className="flex items-center gap-2 font-script text-[11px] uppercase tracking-[0.14em] text-ink-soft"
            >
              {isBar ? (
                <svg width="16" height="12" aria-hidden="true" className="flex-none">
                  {i > 0 && (
                    <defs>
                      <Hatch id={`${uid}-k${i}`} index={i} />
                    </defs>
                  )}
                  <rect x="1" y="1" width="14" height="10" rx="2" fill={fillAt(i, 'k')} />
                </svg>
              ) : (
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
              )}
              {s.name}
            </li>
          ))}
        </ul>
      )}

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        role="img"
        aria-label={figure.alt}
      >
        <title>{figure.label}</title>
        <desc>{figure.alt}</desc>

        {isBar && series.length > 1 && (
          <defs>
            {series.map((_, i) => (i > 0 ? <Hatch key={i} id={`${uid}-b${i}`} index={i} /> : null))}
          </defs>
        )}

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
            opacity={t === 0 ? 1 : 0.7}
          />
        ))}

        <g stroke="oklch(var(--c-ink-soft))" strokeWidth="1.5">
          <line x1={PLOT.x0} y1={PLOT.y1} x2={PLOT.x0} y2={PLOT.y0} />
          <line x1={PLOT.x0} y1={PLOT.y0} x2={PLOT.x1} y2={PLOT.y0} />
          {yScale.ticks.map((t) => (
            <line key={t} x1={PLOT.x0 - 4} x2={PLOT.x0} y1={toY(t)} y2={toY(t)} />
          ))}
          {!isBar &&
            xTicks.map((t) => (
              <line key={t} x1={toX(t)} x2={toX(t)} y1={PLOT.y0} y2={PLOT.y0 + 4} />
            ))}
        </g>

        {yScale.ticks.map((t) => (
          <text
            key={t}
            x={PLOT.x0 - 8}
            y={toY(t)}
            textAnchor="end"
            dominantBaseline="middle"
            className="font-read"
            fontSize={font}
            fill="oklch(var(--c-ink-soft))"
          >
            {formatTick(t, yStep)}
          </text>
        ))}

        {xTicks.map((t) => (
          <text
            key={t}
            x={toX(t)}
            y={PLOT.y0 + 21}
            textAnchor="middle"
            className="font-read"
            fontSize={font}
            fill="oklch(var(--c-ink-soft))"
          >
            {xLabelOf(t)}
          </text>
        ))}

        <text
          x={(PLOT.x0 + PLOT.x1) / 2}
          y={H - 8}
          textAnchor="middle"
          className="font-script"
          fontSize={font}
          letterSpacing="1.6"
          fill="oklch(var(--c-ink-soft))"
        >
          {titleCase(figure.xLabel)}
        </text>
        <text
          transform={`rotate(-90 14 ${(PLOT.y0 + PLOT.y1) / 2})`}
          x={14}
          y={(PLOT.y0 + PLOT.y1) / 2}
          textAnchor="middle"
          className="font-script"
          fontSize={font}
          letterSpacing="1.6"
          fill="oklch(var(--c-ink-soft))"
        >
          {titleCase(figure.yLabel)}
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
                const base = toY(Math.max(0, yScale.min));
                const y = Math.abs(base - toY(p.y)) < 1 ? base - 1 : toY(p.y);
                return (
                  <path
                    key={`${s.name}-${p.x}`}
                    d={barPath(x, w, y, base)}
                    fill={fillAt(si, 'b')}
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
                  {pts.map((p) => {
                    /* Where a later series lands on exactly the same reading —
                       two samples that both start at 1.00 — its marker would
                       hide this one entirely. Draw the covered one larger so
                       both shapes show, one inside the other, without moving
                       either off its true value. */
                    const covered = series
                      .slice(si + 1)
                      .some((o) => o.points.some((q) => q.x === p.x && q.y === p.y));
                    return (
                      <Marker
                        key={p.x}
                        index={si}
                        x={toX(p.x)}
                        y={toY(p.y)}
                        fill={color}
                        ring
                        scale={covered ? 1.7 : 1}
                      />
                    );
                  })}
                </g>
              );
            })}
      </svg>
    </div>
  );
}

/* The second and later bar series carry a hatch over their colour, so two
   bars side by side differ in texture as well as hue — the bar chart's
   equivalent of the line chart's dash patterns. Alternating 45° and 135°
   keeps series 2 and 3 apart too. */
function Hatch({ id, index }: { id: string; index: number }) {
  return (
    <pattern
      id={id}
      width="6"
      height="6"
      patternUnits="userSpaceOnUse"
      patternTransform={`rotate(${index % 2 ? 45 : 135})`}
    >
      <rect width="6" height="6" fill={colorAt(index)} />
      <line
        x1="0"
        y1="0"
        x2="0"
        y2="6"
        stroke="oklch(var(--c-paper))"
        strokeWidth="2"
        opacity="0.6"
      />
    </pattern>
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
  scale = 1,
}: {
  index: number;
  x: number;
  y: number;
  fill: string;
  ring?: boolean;
  scale?: number;
}) {
  const common = {
    fill,
    stroke: ring ? 'oklch(var(--c-paper))' : undefined,
    strokeWidth: ring ? 2 / scale : undefined,
  };
  const shape =
    index % 5 === 3 ? (
      <polygon points={`${x},${y - 5} ${x + 5},${y} ${x},${y + 5} ${x - 5},${y}`} {...common} />
    ) : index % 5 === 4 ? (
      <path d={`M${x - 5},${y - 2}h3v-3h4v3h3v4h-3v3h-4v-3h-3Z`} {...common} />
    ) : index % 5 === 1 ? (
      <rect x={x - 4} y={y - 4} width="8" height="8" rx="1" {...common} />
    ) : index % 5 === 2 ? (
      <polygon points={`${x},${y - 5} ${x + 5},${y + 4} ${x - 5},${y + 4}`} {...common} />
    ) : (
      <circle cx={x} cy={y} r="4.5" {...common} />
    );
  if (scale === 1) return shape;
  return <g transform={`translate(${x} ${y}) scale(${scale}) translate(${-x} ${-y})`}>{shape}</g>;
}
