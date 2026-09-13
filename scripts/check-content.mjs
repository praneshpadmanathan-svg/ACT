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

   Rule 5 — src/content/stats.json matches what the library actually holds.
     The landing page and the FAQ quote the library's totals. Counting them at
     runtime meant loading all 738 kB of JSON to render one sentence, so they
     are a committed build artifact now — which is only trustworthy if
     something recomputes it. This does, on every build. Run with `--write` to
     update the file after a content change.

   Run: node scripts/check-content.mjs   (also runs in `npm run build`)
        node scripts/check-content.mjs --write   (to refresh stats.json)
*/

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const contentDir = join(root, 'src/content');

const readJSON = (name) => JSON.parse(readFileSync(join(contentDir, name), 'utf8'));

const canonicalTopic = (raw) =>
  raw.trim().replace(/[–—]/g, '-').replace(/_/g, ' ').replace(/\s+/g, ' ').toLowerCase();

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
   inside "function" on the real test, for instance. Those zones used to be
   exempted from this rule, because no drill question carried their finer
   topic and the alternative was remapping them onto the coarse label they
   fold into, which would have filed a tone question's results under
   "function," a bucket the student never actually practised.

   The exemption list is gone because the gap it described is gone: every
   zone topic now has drill questions of its own, so this rule holds for all
   of them with no carve-outs. Do not reintroduce an exemption to land a zone
   whose questions are not written yet — write the questions. */
for (const path of paths) {
  const realTopics = new Set(
    (questionsBySection[path.id] ?? []).map((q) => canonicalTopic(q.topic)),
  );
  for (const zone of path.nodes) {
    if (!zone.topic) continue;
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

/* ------------------------------------------ rule 5: zone question identity

   A zone question's permanent id is a hash of the question itself — stem plus
   sorted choices plus the credited answer. `zoneQuestionId` in
   `src/lib/normalize.ts` builds it and this must stay in step with it.

   Two questions in one zone that fingerprint the same would share an id, and
   spaced repetition would treat them as one: answering either would move the
   other's review date, and only one of them could ever be fetched back. The
   stem alone was not enough — three pairs in the bank share one, `Choose the
   correct sentence:` among them — which is exactly why the fingerprint is
   wider than it first looks, and exactly why this rule exists to keep it
   wide enough.

   The parts are joined on U+0000 rather than a space because question text is
   full of spaces: joined on one, `["a b", "c"]` and `["a", "b c"]` produce the
   same fingerprint, and two genuinely different questions would be handed the
   same id. NUL cannot occur in the authored JSON, so it can only ever mean
   "field boundary". It has to match `normalize.ts` exactly — a different
   separator here computes ids the app never generates, which would make the
   collision check below compare against nothing real. */

const fnv1a = (text) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) || 1;
};

const zoneQuestionId = (zoneId, q) =>
  `${zoneId}-h${fnv1a([q.q, ...[...q.opts].sort(), q.opts[q.a] ?? ''].join('\u0000')).toString(36)}`;

const miniquizzes = readJSON('miniquizzes.json');
const zoneIds = new Map(); // id -> the stem it was first seen on

for (const [zoneId, questions] of Object.entries(miniquizzes)) {
  for (const q of questions) {
    const id = zoneQuestionId(zoneId, q);
    if (zoneIds.has(id)) {
      failures.push(
        `${zoneId}: two questions share the id "${id}". First: "${zoneIds.get(id)}". ` +
          `Second: "${q.q}". They are indistinguishable to spaced repetition — one ` +
          `can never be reviewed, and answering either moves the other's due date.`,
      );
    } else {
      zoneIds.set(id, q.q);
    }
  }

  // The drill bank owns the same id space; `runnableById` checks it first.
  for (const id of zoneIds.keys()) {
    if (seenIds.has(id)) {
      failures.push(
        `zone question id "${id}" collides with a drill question of the same id. ` +
          `runnableById() resolves drills first, so the zone question is unreachable.`,
      );
    }
  }
}

/* ------------------------------------------------- rule 6: the totals file

   Counted here rather than in the app so `src/content/stats.ts` can hand the
   landing page five numbers without the landing page importing the library
   they describe. The count has to match how `index.ts` builds each collection,
   or the page would quote a total nothing in the app agrees with. */

const countPages = (units) => units.reduce((n, unit) => n + unit.pages.length, 0);

const actual = {
  drillQuestions: allQuestions.length,
  zoneQuestions: Object.values(readJSON('miniquizzes.json')).reduce((n, a) => n + a.length, 0),
  notePages: ['notesEnglish', 'notesMath', 'notesReading', 'notesScience'].reduce(
    (n, f) => n + countPages(readJSON(`${f}.json`)),
    0,
  ),
  passages: ['passagesEnglish', 'passagesReading', 'passagesScience'].reduce(
    (n, f) => n + readJSON(`${f}.json`).length,
    0,
  ),
  zones: paths.reduce((n, p) => n + p.nodes.length, 0),
};

const statsPath = join(contentDir, 'stats.json');
const serialised = `${JSON.stringify(actual, null, 2)}\n`;

if (process.argv.includes('--write')) {
  writeFileSync(statsPath, serialised);
  console.log(`  content check: wrote stats.json — ${JSON.stringify(actual)}`);
} else {
  let stored = null;
  try {
    stored = readJSON('stats.json');
  } catch {
    failures.push(
      'src/content/stats.json is missing or unreadable. Run `npm run check:content -- --write`.',
    );
  }
  if (stored) {
    for (const [key, value] of Object.entries(actual)) {
      if (stored[key] !== value) {
        failures.push(
          `stats.json says ${key} is ${stored[key]}, the library holds ${value}. ` +
            'The landing page and the FAQ quote these numbers. ' +
            'Run `npm run check:content -- --write`.',
        );
      }
    }
  }
}

/* ------------------------------------------ rule 7: authoring integrity

   Rules 1-6 catch structural breakage. These catch the defects that batch
   authoring actually produces, each of which renders fine and is only wrong
   once a student reads it. Every one of them was found in a real batch while
   the bank was being expanded, which is why they live in the build now
   instead of in a scratch script someone has to remember to run.

   7a — no two questions on the same passage share a stem. A generic stem
     ("The main idea of the passage is that:") is legitimately reused across
     different passages, so this is scoped per passage rather than globally:
     within one passage it means a question got authored twice.

   7b — a question's choices are all textually distinct. Two identical
     choices give the student a coin flip that the scorer treats as a real
     decision.

   7c — no explanation refers to a choice by its letter. shuffleChoices()
     (src/lib/normalize.ts) reorders choices from a hash of the question id
     and relabels them A-D, so "the same trap as choice C" points at whatever
     lands in that slot at runtime, not at the choice the author meant.

   7d — English guillemet spans are balanced and at most one per question.
     normalize.ts finds the underlined portion by matching a single guillemet
     pair; an unmatched mark silently drops the span, and the item then asks
     the student to fix an underline that is not there. Items with no span at
     all are fine — they pose the question in words instead, a mode the
     renderer supports.

   7e — a phrase a Reading question puts in quotation marks appears in its
     passage. A quotation the student cannot locate makes the item
     unanswerable in a way that reads as their own failure to find it. Single
     quoted words are matched on their stem, since an item may label a
     hypothesis "coordination" where the passage writes "song coordinates". */

const readPassageText = new Map(
  readJSON('passagesReading.json').map((pg) => [
    pg.id,
    String(pg.text ?? '')
      .toLowerCase()
      .replace(/\s+/g, ' '),
  ]),
);

const flatten = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/* Quoted spans, paired in document order so a nested quotation — the word
   "smooth" in the phrase "worn smooth" — does not pair the closing mark of
   one quote with the opening mark of the next. */
function quotedSpans(text) {
  const source = String(text);
  const marks = [...source.matchAll(/["“”]/g)].map((m) => m.index);
  const out = [];
  for (let i = 0; i + 1 < marks.length; i += 2) {
    out.push(source.slice(marks[i] + 1, marks[i + 1]));
  }
  return out;
}

for (const [section, questions] of Object.entries(questionsBySection)) {
  const stemsSeen = new Map();

  for (const q of questions) {
    const stemKey = `${q.passage ?? '-'}|${flatten(q.stem)}|${flatten(q.context)}`;
    if (stemKey !== '-||') {
      if (stemsSeen.has(stemKey)) {
        failures.push(
          `${section}/${q.id}: asks the same question as ${stemsSeen.get(stemKey)} on the same ` +
            `passage. One of the two is a duplicate.`,
        );
      } else {
        stemsSeen.set(stemKey, q.id);
      }
    }

    const choiceText = new Map();
    for (const choice of q.choices ?? []) {
      const text = flatten(choice.text);
      if (choiceText.has(text)) {
        failures.push(
          `${section}/${q.id}: choices "${choiceText.get(text)}" and "${choice.id}" have ` +
            `identical text, so one of them cannot be wrong for a reason the other is not.`,
        );
      } else {
        choiceText.set(text, choice.id);
      }
    }

    for (const [key, why] of Object.entries(q.why ?? {})) {
      const named = String(why).match(/\b(?:choice|option|answer)s?\s+([A-J])\b/);
      if (named) {
        failures.push(
          `${section}/${q.id}: why.${key} refers to "${named[0]}". shuffleChoices() relabels ` +
            `choices at runtime, so a letter reference points at a different choice than the ` +
            `one the explanation means.`,
        );
      }
    }

    if (section === 'english') {
      const opens = (String(q.context).match(/«/g) ?? []).length;
      const closes = (String(q.context).match(/»/g) ?? []).length;
      if (opens !== closes) {
        failures.push(
          `${section}/${q.id}: has ${opens} opening and ${closes} closing guillemets. An ` +
            `unmatched mark drops the underlined span, leaving nothing to replace.`,
        );
      } else if (opens > 1) {
        failures.push(
          `${section}/${q.id}: marks ${opens} underlined spans, but normalize.ts renders one.`,
        );
      }
    }

    if (section === 'reading' && q.passage) {
      const body = readPassageText.get(q.passage);
      if (body !== undefined) {
        for (const span of quotedSpans(q.context)) {
          const phrase = flatten(span).replace(/[,.;:!?]+$/, '');
          if (phrase.length < 4) continue;
          const words = phrase.split(' ');
          const found =
            words.length === 1
              ? body.includes(phrase.slice(0, Math.min(6, phrase.length)))
              : body.includes(phrase);
          if (!found) {
            failures.push(
              `${section}/${q.id}: quotes "${span.slice(0, 60)}", which does not appear in ` +
                `${q.passage}. The student cannot locate it.`,
            );
          }
        }
      }
    }
  }
}

/* --------------------------------------- rule 8: every item asks something

   A question has to reach the student with a question in it.

   This exists because twenty-eight English items did not. They pose things
   an underline cannot express — "where should this sentence go?", "would the
   essay meet this goal?" — so they carry an empty `context` and put the
   question in a separate `stem` field. `fromDrillQuestion` read `context`,
   found an empty string, and rendered it: four choices under a blank prompt,
   with nothing to say what was being chosen between. Every one of them was
   unanswerable except by guessing, and none of the rules above noticed,
   because each field they check was individually present and well-formed.

   So this reproduces what the adapter actually renders and fails if the
   result is empty. It is deliberately a copy of that logic rather than an
   import: `check-content.mjs` is plain Node with no build step, and a rule
   that ran the app's own code would stop being a check on the app. If the
   two ever drift, the honest failure is this rule going off. */

for (const [section, questions] of Object.entries(questionsBySection)) {
  for (const q of questions) {
    const context = String(q.context ?? '');
    const hasUnderline = /«(.+?)»/s.test(context);
    const asked = hasUnderline
      ? 'Which choice best replaces the highlighted text?'
      : context.trim() || String(q.stem ?? '').trim();

    if (!asked) {
      failures.push(
        `${section}/${q.id}: renders no question at all. Its context is empty and it has no ` +
          `stem, so the student is shown ${q.choices.length} choices and nothing to choose ` +
          `between them on.`,
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
  `  content check: ${allQuestions.length} drill questions and ${zoneIds.size} zone questions, ` +
    'no duplicate or colliding ids, every answer and explanation present, every zone topic ' +
    'matches real question data, no duplicate stems or choices, every quotation locatable, ' +
    'every item asking a question',
);
