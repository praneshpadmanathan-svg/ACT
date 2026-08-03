/* Four invariants about the question bank that a typecheck cannot see.

   `src/content/index.ts` does pure lookups at module load — no validation.
   That was fine while the bank was hand-authored one question at a time, but
   it already needed a topic-name-drift fix once (`TOPIC_BY_ZONE_ALIAS` in
   `src/content/index.ts` exists because zone quizzes were tagged with a
   landmark's shouting name rather than its skill). The next content
   addition, especially an LLM-assisted batch, is exactly the kind of change
   that introduces a duplicate id or a dangling answer silently — nothing
   downstream throws, a student just gets a question with no correct choice
   or an explanation that never renders.

   Rule 1 — question ids are unique across the whole drill bank.
     `getQuestion(id)` (src/content/index.ts) is a Map keyed by id; a
     duplicate silently shadows the first question with the second.

   Rule 2 — every question's `answer` names one of its own `choices`.
     `QuestionRunner` computes correctness by `choice.key === question.correctKey`
     (src/components/QuestionRunner.tsx); an answer that matches no choice
     means no choice is ever marked correct and no explanation panel opens
     for a right answer.

   Rule 3 — every choice has a non-empty `why` entry.
     The explanation panel falls back to `whyGeneral`, but drill questions
     don't set it — a missing `why[choice.id]` renders as blank space where
     the lesson should be.

   Rule 4 — every zone's declared topic is a topic real questions use.
     `TOPIC_BY_ZONE_ALIAS` (src/content/index.ts) maps a landmark to the
     topic tally recorded there gets folded into. If a landmark's `topic`
     field doesn't match any question's `topic` in that section, progress
     recorded at that landmark folds into a topic `weakestTopics`
     (src/lib/progress.ts) never sees any drill data for — it becomes
     statistically invisible.

   Run: node scripts/check-content.mjs   (also runs in `npm run build`)
*/

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const contentDir = join(root, 'src/content');

const readJSON = (name) => JSON.parse(readFileSync(join(contentDir, name), 'utf8'));

const canonicalTopic = (raw) =>
  raw
    .trim()
    .replace(/[–—]/g, '-')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();

const QUESTION_FILES = {
  english: 'questionsEnglish.json',
  math: 'questionsMath.json',
  reading: 'questionsReading.json',
  science: 'questionsScience.json',
};

const questionsBySection = Object.fromEntries(
  Object.entries(QUESTION_FILES).map(([section, file]) => [section, readJSON(file)]),
);
const allQuestions = Object.values(questionsBySection).flat();

const paths = readJSON('paths.json');

const failures = [];

/* ---------------------------------------------------------- rule 1: ids */

const seenIds = new Map(); // id -> section it was first seen in
for (const [section, questions] of Object.entries(questionsBySection)) {
  for (const q of questions) {
    if (seenIds.has(q.id)) {
      failures.push(
        `duplicate question id "${q.id}": first seen in ${seenIds.get(q.id)}, ` +
          `repeated in ${section}. The second silently shadows the first in getQuestion().`,
      );
    } else {
      seenIds.set(q.id, section);
    }
  }
}

/* ------------------------------------------------- rules 2 & 3: choices */

for (const [section, questions] of Object.entries(questionsBySection)) {
  for (const q of questions) {
    const choiceIds = q.choices.map((c) => c.id);

    if (!choiceIds.includes(q.answer)) {
      failures.push(
        `${section}/${q.id}: answer "${q.answer}" matches none of its choices ` +
          `(${choiceIds.join(', ')}). No choice will ever be marked correct.`,
      );
    }

    for (const id of choiceIds) {
      const why = q.why?.[id];
      if (!why || !why.trim()) {
        failures.push(`${section}/${q.id}: choice "${id}" has no explanation (why.${id}).`);
      }
    }
  }
}

/* --------------------------------------------------- rule 4: zone topics

   Reading and Science deliberately run a *coarser* drill-bank taxonomy than
   the zones do — 6 and 5 broad topics respectively, chosen to match how the
   real ACT groups those sections (skill-integrated, not rule-by-rule the way
   English grammar is). A handful of zones teach a genuinely finer-grained
   skill inside one of those broad topics — tone and structure both live
   inside "function" on the real test, for instance — and forcing their
   `topic` field to match the coarse label they'd fold into would be a worse
   failure than the one this rule exists to catch: it would silently file a
   tone question's results under "function," a bucket the student never
   actually practised. An admittedly wrong exemption a reader can see and
   argue with beats a guessed remapping baked silently into content data.

   This is a real content gap, not a false positive — each of these topics
   has no drill-bank questions of its own today. Tracked in
   docs/program-improvement-roadmap.md §12. */
const NO_DRILL_TOPIC = new Set([
  'structure_span', // reading — text structure; folds conceptually under "function"
  'tone_tundra', // reading — tone; folds conceptually under "function"
  'evidence_estuary', // reading — evidence; folds conceptually under "detail"
  'figurative_falls', // reading — figurative language; folds conceptually under "vocabulary in context"
  'units_uplands', // science — units; folds conceptually under "reading data"
  'rates_ridge', // science — rates; folds conceptually under "reading data"
  'hypothesis_hollow', // science — hypotheses; folds conceptually under "research summaries"
  'calc_canyon', // science — calculating from data; folds conceptually under "reading data"
]);

for (const path of paths) {
  const realTopics = new Set(
    (questionsBySection[path.id] ?? []).map((q) => canonicalTopic(q.topic)),
  );
  for (const zone of path.nodes) {
    if (!zone.topic || NO_DRILL_TOPIC.has(zone.id)) continue;
    const topic = canonicalTopic(zone.topic);
    if (!realTopics.has(topic)) {
      failures.push(
        `${path.id}/${zone.id}: declares topic "${zone.topic}", which no ${path.id} ` +
          `question uses. Progress recorded at this landmark will fold into a topic ` +
          `with zero drill data, and weakestTopics() will never see it.`,
      );
    }
  }
}

/* ----------------------------------------------------------------- report */

if (failures.length) {
  console.error(`\n  content check failed — ${failures.length} problem(s):\n`);
  for (const f of failures) console.error(`  • ${f}\n`);
  process.exit(1);
}

console.log(
  `  content check: ${allQuestions.length} questions, no duplicate ids, every answer and ` +
    'explanation present, every zone topic matches real question data',
);
