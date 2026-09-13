/* The two pure transforms behind scripts/import-perfect36.mjs.

   Split out of the importer because everything else it does — reading files,
   merging arrays, printing a report — fails loudly when it is wrong, and these
   two do not. A bad figure conversion produces a plausible table with the wrong
   numbers in it. A bad span synthesis produces a plausible English question
   asking about the wrong words. Neither trips the content check, and both are
   read by a student before anyone notices.

   So they live here, with tests beside them, and the importer imports them.

   The figure path is currently exercised by no item in the perfect36 bank:
   every science passage there either has no figures or pairs its table with a
   line or bar chart, and a chart disqualifies the whole passage (see the
   importer's header). The tests are the only thing holding it correct until a
   table-only passage appears or a chart renderer lands. */

/* --------------------------------------------------------------- figures */

/**
 * perfect36 `{kind:'table', label, spec:{columns, rows}}` -> this bank's
 * `FigureTable` (src/types.ts). Cells arrive as numbers and render as text,
 * so they are stringified here rather than at render time — `head` and `rows`
 * are typed `string[]` / `string[][]`, and a number sneaking through would
 * typecheck fine as JSON and then behave differently in a table cell.
 *
 * `alt_text` is deliberately dropped rather than reused as the caption: it is
 * a long prose description written to substitute for the figure, and a caption
 * sits above a table the reader can already see.
 */
export function toFigureTable(fig) {
  return {
    label: fig.label ?? 'Table',
    caption: fig.spec?.caption ?? '',
    type: 'table',
    head: (fig.spec?.columns ?? []).map(String),
    rows: (fig.spec?.rows ?? []).map((row) => row.map(String)),
  };
}

/* ---------------------------------------------------------- English spans */

/** The sentence an English stem quotes, when it quotes one. */
const QUOTED = /["“]([^"”]{12,})["”]/;

/** Stems that say nothing the fixed guillemet prompt does not say.
 *
 *  Deliberately a short whitelist and not a "does this look generic?" test.
 *  `fromDrillQuestion` (src/lib/normalize.ts) *replaces* the stem with
 *  "Which choice best replaces the highlighted text?" whenever it finds
 *  guillemets, so a false positive here does not degrade the item — it asks
 *  the student a different question than the one that was authored. An item
 *  about tone rendered this way becomes an item about grammar with four
 *  grammatical choices. */
const GENERIC_STEM = /^which choice (?:correctly punctuates|is correctly punctuated)\b/i;

export const isNoChange = (text) => /^\s*NO CHANGE\s*$/i.test(text);

const commonPrefix = (strings) => {
  let i = 0;
  const first = strings[0];
  while (i < first.length && strings.every((s) => s[i] === first[i])) i++;
  return first.slice(0, i);
};

const commonSuffix = (strings, cap) => {
  let i = 0;
  const first = strings[0];
  while (i < cap && strings.every((s) => s[s.length - 1 - i] === first[first.length - 1 - i])) i++;
  return first.slice(first.length - i);
};

/**
 * Turn four whole-sentence choices into a «guillemet» span plus span-sized
 * choices, the convention this bank's English items use.
 *
 * Returns `{context, choices}` or `null`, and `null` is a perfectly good
 * answer: the caller then keeps the stem verbatim, which is how every Math,
 * Reading and Science item in the bank already renders.
 *
 * @param item a perfect36 question record
 */
export function synthesiseSpan(item) {
  const quote = item.stem.match(QUOTED);
  if (!quote) return null;
  const original = quote[1].trim();
  if (!GENERIC_STEM.test(item.stem.replace(quote[0], '').trim())) return null;

  /* Resolve NO CHANGE to the sentence it stands for, so all four strings are
     comparable. Without this the diff sees the literal words "NO CHANGE" and
     finds no common affix at all. */
  const resolved = item.choices.map((c) => (isNoChange(c.text) ? original : c.text.trim()));
  if (new Set(resolved).size !== resolved.length) return null;

  let prefix = commonPrefix(resolved);
  /* Cap the suffix so prefix and suffix cannot overlap on the shortest string
     — without this, four choices differing only by an inserted word yield a
     prefix and a suffix that both cover the same characters, and the middles
     come out negative-length. */
  const room = Math.min(...resolved.map((s) => s.length)) - prefix.length;
  if (room <= 0) return null;
  let suffix = commonSuffix(resolved, room);

  /* Back both off to a word boundary. Raw character-wise affixes cut mid-word
     — "recieve"/"receive" share the prefix "rec" — and a span starting inside
     a word reads as a typo rather than as the thing under test. */
  prefix = prefix.slice(0, prefix.lastIndexOf(' ') + 1);
  const firstSpace = suffix.indexOf(' ');
  suffix = firstSpace === -1 ? '' : suffix.slice(firstSpace);

  const middles = resolved.map((s) => s.slice(prefix.length, s.length - suffix.length));

  /* Defensive. "DELETE the underlined portion" is a real ACT choice and there
     is nothing to draw between two marks for it — but the word-boundary
     backoff above makes an empty middle unreachable in practice, since a
     space-terminated prefix and a space-initial suffix cannot concatenate into
     any real choice string. Kept because that backoff is the only thing
     holding it true, and this is a cheaper guard than the bug would be. */
  if (middles.some((m) => !m.trim())) return null;
  /* No affix either side means the choices differ across the whole sentence.
     There is no span; the whole thing is the span. */
  if (!prefix && !suffix) return null;

  const noChangeAt = item.choices.findIndex((c) => isNoChange(c.text));

  return {
    context: `${prefix}«${middles[noChangeAt] ?? middles[0]}»${suffix}`,
    choices: item.choices.map((c, i) => ({
      id: c.label,
      text: isNoChange(c.text) ? 'NO CHANGE' : middles[i],
    })),
  };
}

/* ----------------------------------------------------------------- charts */

/** Figure kinds this bank can draw. A `scatter` or `diagram` still has no
 *  renderer, so a passage carrying one is still skipped whole. */
export const CHART_KINDS = new Set(['line', 'bar']);

/**
 * perfect36 `{kind:'line'|'bar', label, spec:{x_label, y_label, series}}` ->
 * this bank's `FigureChart` (src/types.ts).
 *
 * `alt_text` is carried across here, unlike in `toFigureTable` where it is
 * dropped: a table is its own text alternative and a plot is not. It is also
 * the only description a screen-reader user gets, and perfect36 writes these
 * to convey the trend rather than to list the readings — which is right, as a
 * full value dump would answer the read-a-value questions outright.
 *
 * `x_unit` is deliberately not appended to the axis title. Where perfect36
 * sets it the unit is already inside `x_label` ("Time" + "min" against a
 * y_label of "Absorbance"), and concatenating would print "Time (min) (min)"
 * on the passages that spell it out.
 */
export function toFigureChart(fig) {
  const spec = fig.spec ?? {};
  return {
    label: fig.label ?? 'Figure',
    caption: spec.caption ?? '',
    type: 'chart',
    kind: fig.kind,
    xLabel: spec.x_label ?? '',
    yLabel: spec.y_label ?? '',
    alt: fig.alt_text ?? '',
    series: (spec.series ?? []).map((s) => ({
      name: s.name ?? '',
      points: (s.points ?? []).map((p) => ({ x: Number(p.x), y: Number(p.y) })),
    })),
  };
}
