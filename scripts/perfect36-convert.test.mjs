/* The importer's two silent-failure surfaces.

   Everything else in scripts/import-perfect36.mjs announces its own mistakes:
   an unmapped skill code halts the run, a bad answer key fails validation, a
   missing passage fails the content check. These two transforms produce
   well-formed, plausible content when they are wrong, so they get tests.

   The figure case is the sharper one — no item in the perfect36 bank exercises
   it today (every science passage there pairs its table with a chart, and a
   chart disqualifies the passage), so these tests are the only thing holding
   it correct until that changes. */

import { describe, it, expect } from 'vitest';
import {
  toFigureTable,
  toFigureChart,
  synthesiseSpan,
  isNoChange,
  CHART_KINDS,
} from './perfect36-convert.mjs';

describe('toFigureTable', () => {
  /* Copied verbatim out of perfect36's sci-catalyst-rate-0001 — the shape the
     transform will actually meet, not an idealised one. */
  const real = {
    slug: 'fig-catalyst-table-1',
    kind: 'table',
    label: 'Table 1',
    spec: {
      columns: ['Concentration (mol/L)', 'Time to completion (s)'],
      rows: [
        [0.1, 120],
        [0.2, 80],
        [1.6, 18],
      ],
    },
    alt_text: 'Table of five catalyst concentrations…',
    sort_order: 0,
  };

  it('produces a FigureTable this bank can render', () => {
    expect(toFigureTable(real)).toEqual({
      label: 'Table 1',
      caption: '',
      type: 'table',
      head: ['Concentration (mol/L)', 'Time to completion (s)'],
      rows: [
        ['0.1', '120'],
        ['0.2', '80'],
        ['1.6', '18'],
      ],
    });
  });

  it('stringifies numeric cells rather than passing numbers through', () => {
    /* `FigureTable.rows` is `string[][]`. Numbers survive JSON and typecheck
       nowhere, then render differently in a cell — 0 would be falsy to any
       downstream conditional. */
    const { rows, head } = toFigureTable(real);
    expect(rows.flat().every((c) => typeof c === 'string')).toBe(true);
    expect(head.every((c) => typeof c === 'string')).toBe(true);
  });

  it('drops alt_text instead of promoting it to the caption', () => {
    expect(toFigureTable(real).caption).toBe('');
  });

  it('survives a figure with no spec at all', () => {
    expect(toFigureTable({ kind: 'table' })).toEqual({
      label: 'Table',
      caption: '',
      type: 'table',
      head: [],
      rows: [],
    });
  });
});

describe('isNoChange', () => {
  it('matches the literal choice regardless of case or padding', () => {
    expect(isNoChange('NO CHANGE')).toBe(true);
    expect(isNoChange('  no change  ')).toBe(true);
  });

  it('does not match a choice that merely mentions it', () => {
    expect(isNoChange('NO CHANGE to the second clause')).toBe(false);
  });
});

const item = (stem, choices) => ({
  stem,
  choices: choices.map(([label, text]) => ({ label, text })),
});

describe('synthesiseSpan', () => {
  /* eng-cse-commas-d1-0001, verbatim. Note NO CHANGE sits at B, not A — the
     transform must not assume the first choice is the unchanged one. */
  const commas = item(
    'Which choice correctly punctuates this sentence from Paragraph 2? "After three weekends of scrubbing I finally saw the paint beneath the grime."',
    [
      ['A', 'After three weekends of scrubbing, I finally saw the paint beneath the grime.'],
      ['B', 'NO CHANGE'],
      ['C', 'After three, weekends of scrubbing I finally saw the paint beneath the grime.'],
      ['D', 'After, three weekends of scrubbing, I finally saw the paint beneath the grime.'],
    ],
  );

  it('marks the span the NO CHANGE choice stands for, not the first choice', () => {
    const out = synthesiseSpan(commas);
    expect(out.context).toBe(
      '«After three weekends of scrubbing» I finally saw the paint beneath the grime.',
    );
  });

  it('reduces every other choice to the span, and keeps NO CHANGE literal', () => {
    expect(synthesiseSpan(commas).choices).toEqual([
      { id: 'A', text: 'After three weekends of scrubbing,' },
      { id: 'B', text: 'NO CHANGE' },
      { id: 'C', text: 'After three, weekends of scrubbing' },
      { id: 'D', text: 'After, three weekends of scrubbing,' },
    ]);
  });

  it('keeps the unchanged text outside the marks identical to the source', () => {
    const out = synthesiseSpan(commas);
    expect(out.context.replace(/[«»]/g, '')).toBe(
      'After three weekends of scrubbing I finally saw the paint beneath the grime.',
    );
  });

  it('declines a stem whose instruction carries the task', () => {
    /* This is the whole reason the whitelist is narrow: normalize.ts throws
       the stem away when it sees guillemets, so accepting this one would ask
       the student for grammar when the author asked for concision. */
    expect(
      synthesiseSpan(
        item(
          'Which choice most effectively eliminates the redundancy in this sentence from Paragraph 3? "The reason it works is because most tools sit idle."',
          [
            ['A', 'NO CHANGE'],
            ['B', 'It works because most tools sit idle.'],
            ['C', 'The reason it works is that most tools sit idle.'],
            ['D', 'The reason for it working is because most tools sit idle.'],
          ],
        ),
      ),
    ).toBeNull();
  });

  it('declines a stem that quotes nothing', () => {
    expect(
      synthesiseSpan(
        item('Which choice correctly punctuates the underlined portion at [4]?', [
          ['A', 'NO CHANGE'],
          ['B', 'drill, which is the most requested item,'],
          ['C', 'drill which is the most requested item,'],
          ['D', 'drill, which is the most requested item'],
        ]),
      ),
    ).toBeNull();
  });

  it('narrows a one-mark difference down to the single word it turns on', () => {
    /* The span does not have to be a phrase. Four choices differing only in
       what follows one word reduce to that word plus its punctuation, which
       is exactly how the real test presents this item. */
    expect(
      synthesiseSpan(
        item('Which choice correctly punctuates this sentence? "The dog, barked loudly."', [
          ['A', 'NO CHANGE'],
          ['B', 'The dog barked loudly.'],
          ['C', 'The dog; barked loudly.'],
          ['D', 'The dog: barked loudly.'],
        ]),
      ),
    ).toEqual({
      context: 'The «dog,» barked loudly.',
      choices: [
        { id: 'A', text: 'NO CHANGE' },
        { id: 'B', text: 'dog' },
        { id: 'C', text: 'dog;' },
        { id: 'D', text: 'dog:' },
      ],
    });
  });

  it('declines when the choices share no affix on either side', () => {
    expect(
      synthesiseSpan(
        item('Which choice correctly punctuates this sentence? "Rain fell all night long."', [
          ['A', 'NO CHANGE'],
          ['B', 'All night, the rain fell.'],
          ['C', 'Falling rain, all night.'],
          ['D', 'It rained; all night.'],
        ]),
      ),
    ).toBeNull();
  });

  it('never cuts the span mid-word', () => {
    /* Raw character-wise affixes would split "receive"/"recieve" after "rec".
       A span starting inside a word reads as a typo in the passage rather
       than as the thing being tested. */
    const out = synthesiseSpan(
      item('Which choice correctly punctuates this sentence? "I did not recieve the parcel."', [
        ['A', 'NO CHANGE'],
        ['B', 'I did not receive the parcel.'],
        ['C', 'I did not recieve, the parcel.'],
        ['D', 'I did not receeve the parcel.'],
      ]),
    );
    if (out) {
      const before = out.context.slice(0, out.context.indexOf('«'));
      expect(before === '' || before.endsWith(' ')).toBe(true);
    }
  });
});

describe('toFigureChart', () => {
  /* sci-drill-dye-fading-0001's Figure 1, verbatim — the one perfect36 figure
     that sets `x_unit`, which is the field most likely to be mishandled. */
  const real = {
    slug: 'fig-dye-line-1',
    kind: 'line',
    label: 'Figure 1',
    spec: {
      x_label: 'Time',
      y_label: 'Absorbance',
      x_unit: 'min',
      series: [
        {
          name: '200 lux',
          points: [
            { x: 0, y: 1 },
            { x: 30, y: 0.71 },
            { x: 60, y: 0.5 },
          ],
        },
        {
          name: '800 lux',
          points: [
            { x: 0, y: 1 },
            { x: 30, y: 0.31 },
            { x: 60, y: 0.09 },
          ],
        },
      ],
    },
    alt_text: 'Line graph of absorbance against time for two samples.',
    sort_order: 1,
  };

  it('produces a FigureChart this bank can render', () => {
    expect(toFigureChart(real)).toEqual({
      label: 'Figure 1',
      caption: '',
      type: 'chart',
      kind: 'line',
      xLabel: 'Time',
      yLabel: 'Absorbance',
      alt: 'Line graph of absorbance against time for two samples.',
      series: [
        {
          name: '200 lux',
          points: [
            { x: 0, y: 1 },
            { x: 30, y: 0.71 },
            { x: 60, y: 0.5 },
          ],
        },
        {
          name: '800 lux',
          points: [
            { x: 0, y: 1 },
            { x: 30, y: 0.31 },
            { x: 60, y: 0.09 },
          ],
        },
      ],
    });
  });

  it('carries alt_text across, unlike the table transform', () => {
    /* A table is its own text alternative; a plot is not, and this string is
       the only thing a screen-reader user gets. */
    expect(toFigureChart(real).alt).toBe(real.alt_text);
    expect(toFigureTable({ kind: 'table', alt_text: 'x' }).caption).toBe('');
  });

  it('does not append x_unit to an axis title that already carries it', () => {
    /* perfect36 sets both on this figure; concatenating would render
       "Time (min) (min)" on the passages that spell the unit out in the
       label, so the unit is intentionally ignored. */
    expect(toFigureChart(real).xLabel).toBe('Time');
  });

  it('keeps points numeric so the scales can do arithmetic on them', () => {
    const out = toFigureChart({
      kind: 'bar',
      label: 'Figure 1',
      spec: { series: [{ name: 'Period', points: [{ x: '20', y: '2' }] }] },
    });
    expect(out.series[0].points[0]).toEqual({ x: 20, y: 2 });
  });

  it('survives a figure with no spec at all', () => {
    expect(toFigureChart({ kind: 'line' })).toEqual({
      label: 'Figure',
      caption: '',
      type: 'chart',
      kind: 'line',
      xLabel: '',
      yLabel: '',
      alt: '',
      series: [],
    });
  });

  it('claims only the two kinds that have a renderer', () => {
    /* A scatter or a diagram still disqualifies its passage. If this set ever
       grows, FigureChart.tsx has to grow a branch to match. */
    expect([...CHART_KINDS].sort()).toEqual(['bar', 'line']);
    expect(CHART_KINDS.has('scatter')).toBe(false);
    expect(CHART_KINDS.has('diagram')).toBe(false);
  });
});
