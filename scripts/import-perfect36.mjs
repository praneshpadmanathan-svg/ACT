/* Import questions and passages from the perfect36 bank into this one.

   perfect36 (../perfect36) authors ACT items against a Zod schema with a much
   richer per-item record than this app stores: five difficulty levels, hint
   tiers, strategy and takeaway prose, provenance, an estimated time. This bank
   stores what a student sees. So the import is mostly a narrowing, and the two
   places it is *not* are the places worth reading carefully — the English span
   convention and the figure types.

   Run:
     node scripts/import-perfect36.mjs              dry run; prints the report
     node scripts/import-perfect36.mjs --write      merge into src/content
     node scripts/import-perfect36.mjs --source=../elsewhere

   Re-runnable. Every imported id carries the `p36-` prefix, and a write drops
   all previously-imported rows before appending the current ones, so a second
   run replaces rather than duplicates. Hand-authored ids are never touched.

   ------------------------------------------------------------------ English

   This bank marks the underlined portion of an English item with «guillemets»
   inside the surrounding sentence, and offers span-sized choices. perfect36
   writes the instruction as a stem and offers whole replacement sentences.

   `fromDrillQuestion` (src/lib/normalize.ts) does something with guillemets
   that decides how much of this is safe: when it finds them it *discards*
   `context` as the prompt and substitutes the fixed line "Which choice best
   replaces the highlighted text?", moving the sentence to a label above the
   choices. That is exactly right for a plain punctuation item, where the stem
   says nothing the fixed line does not. It silently destroys the question when
   the stem carries the actual task — "most effectively eliminates the
   redundancy", "fix its misplaced modifier", "consistent with the tone" — and
   an item asking for tone would be presented as if it were asking for grammar,
   with four choices that are all grammatical.

   So the span is synthesised only for stems that are generic punctuation
   instructions, and only when the sentence they operate on can be recovered.
   Everything else keeps its stem verbatim, which `normalize.ts` renders
   as-written. That is a supported mode, not a degraded one: it is how every
   Math, Reading and Science item in the bank already renders.

   ------------------------------------------------------------------ Figures

   `Figure = FigureTable | FigureNote | FigureChart` (src/types.ts). Tables
   convert straight across; `line` and `bar` become a `FigureChart`, drawn by
   src/components/FigureChart.tsx.

   A chart is never flattened into a table. Reading a graph *is* the Science
   skill being assessed, so turning it into reading a table would import the
   item while quietly swapping the question for an easier one — a harder
   failure to notice than not shipping it at all.

   `scatter` and `diagram` still have no renderer. A passage carrying one is
   skipped whole, along with every question referencing it, and both are named
   in the report. `CHART_KINDS` in perfect36-convert.mjs is the single list of
   what can be drawn; widening it means adding a branch to the renderer. */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { toFigureTable, toFigureChart, synthesiseSpan, CHART_KINDS } from './perfect36-convert.mjs';

const here = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const repoRoot = resolve(here, '..');
const contentDir = join(repoRoot, 'src/content');

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const sourceArg = args.find((a) => a.startsWith('--source='));
const SOURCE = resolve(repoRoot, sourceArg ? sourceArg.slice('--source='.length) : '../perfect36');

const PREFIX = 'p36-';

const QUESTION_FILE = {
  english: 'questionsEnglish.json',
  math: 'questionsMath.json',
  reading: 'questionsReading.json',
  science: 'questionsScience.json',
};
const PASSAGE_FILE = {
  english: 'passagesEnglish.json',
  reading: 'passagesReading.json',
  science: 'passagesScience.json',
};

const readJSON = (p) => JSON.parse(readFileSync(p, 'utf8'));
const die = (msg) => {
  console.error(`\n  import failed — ${msg}\n`);
  process.exit(1);
};

/* --------------------------------------------------------------- load source */

if (!existsSync(join(SOURCE, 'content/questions'))) {
  die(`no perfect36 bank at ${SOURCE}. Pass --source=<path to the checkout>.`);
}

const readDir = (rel) => {
  const dir = join(SOURCE, rel);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => readJSON(join(dir, f)));
};

const srcQuestions = ['english', 'math', 'reading', 'science'].flatMap((s) =>
  readDir(`content/questions/${s}`),
);
const srcPassages = ['english', 'reading', 'science'].flatMap((s) =>
  readDir(`content/passages/${s}`),
);
const skillTopic = readJSON(join(here, 'skill-topic-map.json'));
delete skillTopic.$comment;

/* ------------------------------------------------------- unmapped skills gate

   Checked across every candidate before anything is converted. A missing code
   is a taxonomy change in perfect36, not a bad item — dropping those silently
   is how an import quietly stops covering a whole skill. */

const unmapped = [...new Set(srcQuestions.map((q) => q.skill))]
  .filter((s) => !(s in skillTopic))
  .sort();
if (unmapped.length) {
  die(
    `${unmapped.length} perfect36 skill code(s) have no entry in scripts/skill-topic-map.json:\n` +
      unmapped.map((s) => `      ${s}`).join('\n') +
      '\n\n    Add each one, mapping onto a topic some question or zone already uses.',
  );
}

/* ------------------------------------------------------------------ figures */

const figureKinds = (p) => (p.figures ?? []).map((f) => f.kind);
const RENDERABLE = new Set(['table', ...CHART_KINDS]);
const chartPassages = new Map(); // slug -> the kinds that disqualified it
for (const p of srcPassages) {
  const unrenderable = figureKinds(p).filter((k) => !RENDERABLE.has(k));
  if (unrenderable.length) chartPassages.set(p.slug, [...new Set(unrenderable)]);
}

/* ---------------------------------------------------------------- conversion */

const DIFFICULTY = { 1: 'easy', 2: 'easy', 3: 'medium', 4: 'hard', 5: 'hard' };

const report = {
  imported: [],
  skippedChart: [],
  spanSynthesised: [],
  verbatim: [],
  calculatorNote: [],
  passagesImported: [],
  passageMarker: [],
};

/** perfect36's passage genre, as a label. `english_prose` -> `English Prose`. */
const genreLabel = (kind) =>
  kind ? kind.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : undefined;

const outQuestions = { english: [], math: [], reading: [], science: [] };
const outPassages = { english: [], reading: [], science: [] };

for (const p of srcPassages) {
  if (chartPassages.has(p.slug)) continue;
  const section = p.subject;
  if (!outPassages[section]) continue;
  /* Sorted by perfect36's own `sort_order`, so a table that the prose refers
     to as "Table 1" is not printed below the figure that follows it. */
  const figures = [...(p.figures ?? [])]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((f) => (f.kind === 'table' ? toFigureTable(f) : toFigureChart(f)));
  outPassages[section].push({
    id: PREFIX + p.slug,
    title: p.title,
    /* `intro` for English, `type` for Reading and Science — the split the
       Passage type documents, and what PassagePanel already expects. */
    ...(section === 'english'
      ? { intro: genreLabel(p.kind) ?? 'English Prose' }
      : { type: genreLabel(p.kind) ?? 'Passage' }),
    text: p.body,
    ...(figures.length ? { figures } : {}),
  });
  report.passagesImported.push(
    `${p.slug} (${section}${figures.length ? `, ${figures.length} figure` : ''})`,
  );
}

for (const item of srcQuestions) {
  if (item.passage && chartPassages.has(item.passage)) {
    report.skippedChart.push(
      `${item.slug} — passage ${item.passage} has ${chartPassages.get(item.passage).join('/')} figures`,
    );
    continue;
  }

  const section = item.subject;
  const topic = skillTopic[item.skill];

  let context = item.stem;
  let choices = item.choices.map((c) => ({ id: c.label, text: c.text }));

  if (section === 'english') {
    const span = synthesiseSpan(item);
    if (span) {
      ({ context, choices } = span);
      report.spanSynthesised.push(`${item.slug} — ${span.context.slice(0, 72)}…`);
    } else {
      report.verbatim.push(`${item.slug} (${item.skill})`);
    }
    /* A handful of stems point at a numbered marker in the passage body
       ("the underlined portion at [4]") instead of quoting the sentence. The
       body carries those markers, so the item is answerable — but the marker
       stands where the underlined text should be, so the sentence around it
       reads as a fragment until you substitute a choice. Worth a human skim. */
    if (/\[\d+\]/.test(item.stem)) report.passageMarker.push(`${item.slug} — ${item.stem}`);
  }

  // `calculator_allowed` has no destination — the calculator is a static Math
  // affordance here, not per-item metadata. Worth naming when it disagrees.
  if (section === 'math' && item.calculator_allowed === false) {
    report.calculatorNote.push(item.slug);
  }

  const why = { [item.correct_key]: item.explanation.worked_solution };
  for (const [label, text] of Object.entries(item.explanation.distractor_rationale ?? {})) {
    why[label] = text;
  }

  outQuestions[section].push({
    id: PREFIX + item.slug,
    section,
    topic,
    difficulty: DIFFICULTY[item.difficulty] ?? 'medium',
    ...(item.passage ? { passage: PREFIX + item.passage } : {}),
    context,
    choices,
    answer: item.correct_key,
    why,
  });
  report.imported.push(item.slug);
}

/* --------------------------------------------------- validate before writing

   The same invariants check-content.mjs enforces, applied to the converted rows
   only, so a bad conversion is reported here with the perfect36 slug that
   caused it rather than surfacing later as a content-check failure on an id
   nobody recognises. */

const problems = [];
const seen = new Set();
for (const [section, list] of Object.entries(outQuestions)) {
  for (const q of list) {
    if (seen.has(q.id)) problems.push(`${q.id}: duplicate id`);
    seen.add(q.id);
    const ids = q.choices.map((c) => c.id);
    if (!ids.includes(q.answer))
      problems.push(`${q.id}: answer "${q.answer}" is not one of ${ids.join(',')}`);
    for (const id of ids) {
      if (!q.why?.[id]?.trim()) problems.push(`${q.id}: choice ${id} has no explanation`);
    }
    if (!q.context?.trim()) problems.push(`${q.id}: empty context`);
    if (!q.topic) problems.push(`${q.id}: no topic`);
    if (q.passage && !outPassages[section]?.some((p) => p.id === q.passage)) {
      problems.push(`${q.id}: references passage ${q.passage}, which was not imported`);
    }
  }
}
if (problems.length) {
  die(
    `${problems.length} converted item(s) failed validation:\n` +
      problems.map((p) => `      ${p}`).join('\n'),
  );
}

/* ------------------------------------------------------------------- report */

const pad = (n) => String(n).padStart(4);
console.log(`\n  perfect36 import — source ${SOURCE}\n`);
console.log(`  ${pad(srcQuestions.length)} questions in the source bank`);
console.log(`  ${pad(report.imported.length)} converted`);
console.log(
  `  ${pad(report.skippedChart.length)} skipped: passage has a figure kind with no renderer (scatter/diagram)`,
);
console.log(
  `  ${pad(report.passagesImported.length)} passages converted (${chartPassages.size} skipped)\n`,
);

for (const [section, list] of Object.entries(outQuestions)) {
  const byTopic = {};
  for (const q of list) byTopic[q.topic] = (byTopic[q.topic] ?? 0) + 1;
  console.log(`  ${section}: ${list.length} items across ${Object.keys(byTopic).length} topics`);
  console.log(
    `    ${Object.entries(byTopic)
      .map(([t, n]) => `${t} ${n}`)
      .join(' · ')}`,
  );
}

console.log(`\n  English rendering:`);
console.log(
  `    ${pad(report.spanSynthesised.length)} got a «guillemet» span (generic punctuation stem, span recoverable)`,
);
console.log(
  `    ${pad(report.verbatim.length)} keep their stem verbatim — the stem carries the task, so the`,
);
console.log(`         fixed guillemet prompt would have replaced the question being asked`);

if (report.passageMarker.length) {
  console.log(`\n  Refer to a numbered marker in the passage rather than quoting the sentence`);
  console.log(`  (answerable, but read them once to confirm the passage reads right):`);
  for (const s of report.passageMarker) console.log(`    • ${s}`);
}
if (report.skippedChart.length) {
  console.log(`\n  Skipped for unrenderable figure kinds:`);
  for (const s of report.skippedChart) console.log(`    • ${s}`);
}
if (report.calculatorNote.length) {
  console.log(
    `\n  Math items authored as calculator-disallowed (${report.calculatorNote.length}) — this app`,
  );
  console.log(`  shows the calculator on every Math item, so that restriction is not carried:`);
  console.log(`    ${report.calculatorNote.join(', ')}`);
}

/* -------------------------------------------------------------------- write */

if (!WRITE) {
  console.log(`\n  dry run — nothing written. Re-run with --write to merge.\n`);
  process.exit(0);
}

const mergeInto = (file, rows) => {
  const path = join(contentDir, file);
  const existing = readJSON(path);
  const kept = existing.filter((r) => !String(r.id).startsWith(PREFIX));
  const merged = [...kept, ...rows];
  writeFileSync(path, `${JSON.stringify(merged, null, 2)}\n`);
  return { kept: kept.length, added: rows.length, replaced: existing.length - kept.length };
};

console.log('');
for (const [section, file] of Object.entries(PASSAGE_FILE)) {
  const r = mergeInto(file, outPassages[section]);
  console.log(`  ${file}: ${r.kept} hand-authored + ${r.added} imported (replaced ${r.replaced})`);
}
for (const [section, file] of Object.entries(QUESTION_FILE)) {
  const r = mergeInto(file, outQuestions[section]);
  console.log(`  ${file}: ${r.kept} hand-authored + ${r.added} imported (replaced ${r.replaced})`);
}

console.log(`\n  written. Now run:  node scripts/check-content.mjs --write\n`);
