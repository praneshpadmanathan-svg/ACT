/* Adapters from the two authored question shapes into the single shape the
   runner consumes.

   Drill questions use choice objects keyed A-D with a per-choice `why` map.
   Zone questions use a plain `opts` array with an answer index and an
   optional `notes` array. Normalising here means the runner never has to
   know which library a question came from. */

import type { Progress, Question, SectionId, ZoneQuestion } from '@/types';
import { dueForReview } from './progress';
import type { RunnableQuestion } from '@/components/QuestionRunner';
import {
  getPassage,
  getQuestion,
  getZone,
  locateQuestion,
  TOPIC_BY_ZONE_ALIAS,
  zoneQuizzes,
} from '@/content';
import { hashId, zoneQuestionId } from '@/content/ids';
import { canonicalTopic, isZoneLabel, seeded, shuffle } from '@/lib/utils';

/* The id scheme lives in `content/ids.ts` so the build can compute the same
   ids; re-exported because this is where callers have always found it. */
export { zoneQuestionId };

const KEYS = ['A', 'B', 'C', 'D'];

/* Zone content is hand-authored JSON, so a question with five options is a
   thing that can be written, and `KEYS[4]` is undefined. A choice with no key
   is a choice the runner cannot record an answer against: it renders, you can
   click it, and nothing happens. Continue the alphabet instead. */
const keyAt = (i: number) => KEYS[i] ?? String.fromCharCode(65 + i);

/* ---------------------------------------------------------- answer shuffling

   Both authored banks are badly skewed toward one position. Measured across the
   shipped content: 44% of the 412 zone-quiz answers are the first option (chance
   is 25%), and 203 of the 342 drill answers are "B". Either bank can be beaten
   well above chance by a student who never reads the question — which quietly
   teaches exactly the wrong habit and makes every accuracy number a lie.

   So choices are shuffled at normalise time. Two properties matter:

   - Deterministic per question. The order is derived from the question id, so
     the same item looks the same every time you meet it. A question that
     reshuffled between the drill and its review would make "I picked C" mean
     nothing, and would fight the spaced-repetition history.
   - "NO CHANGE" stays first. On the real ACT it is always the first option, so
     pinning it is more faithful than randomising it — and it reads as an
     instruction rather than an answer. (In this bank it currently sits last in
     all five items that have it.)

   Nothing in the bank is order-dependent — no "both of the above", no options
   that reference other options by letter — so this is safe everywhere. */

const isPinned = (text: string) => /^\s*NO CHANGE\s*$/i.test(text);

/** Reorder the choices, then relabel them A-D and remap everything that
 *  referred to the old letters. */
function shuffleChoices(q: RunnableQuestion): RunnableQuestion {
  if (q.choices.length < 2) return q;

  const pinned = q.choices.filter((c) => isPinned(c.text));
  const rest = q.choices.filter((c) => !isPinned(c.text));
  const ordered = [...pinned, ...shuffle(rest, seeded(hashId(q.id)))];

  /* old key -> new key, so `why` and `correctKey` follow their choice. */
  const remap = new Map<string, string>();
  const choices = ordered.map((choice, i) => {
    const key = KEYS[i] ?? choice.key;
    remap.set(choice.key, key);
    return { ...choice, key };
  });

  const why: Record<string, string> = {};
  for (const [oldKey, text] of Object.entries(q.why)) {
    why[remap.get(oldKey) ?? oldKey] = text;
  }

  return { ...q, choices, correctKey: remap.get(q.correctKey) ?? q.correctKey, why };
}

export function fromDrillQuestion(q: Question): RunnableQuestion {
  const passage = getPassage(q.passage);

  /* English items quote the underlined span with guillemets inside the
     surrounding sentence. Split it out so the sentence reads as context and
     the underlined part is visibly the thing under test. */
  const guillemet = /«(.+?)»/s;
  const context = String(q.context ?? '');
  const hasUnderline = guillemet.test(context);

  /* Three ways an item states its question, in the order they win.
     An underlined span turns the prompt into the standard instruction and
     moves the sentence into `label`. Otherwise `context` is the question.
     When `context` is empty the question is in `stem` — the mode every
     "writers purpose" and "sentence order" item uses, because "where should
     this sentence go?" cannot be asked by highlighting anything.

     That last branch is new. Without it those twenty-eight items rendered
     their four choices under a blank prompt: four placements, or four
     verdicts on the writer's goal, and no statement of what was being
     placed or judged. They were unanswerable except by guessing, and they
     had been in the bank long enough to be sitting in people's review
     queues. */
  const asked = hasUnderline
    ? 'Which choice best replaces the highlighted text?'
    : context.trim() || (q.stem ?? '').trim();

  return shuffleChoices({
    id: q.id,
    prompt: asked,
    promptFormat: 'markdown',
    label: hasUnderline ? context.replace(guillemet, '<u><b>$1</b></u>') : undefined,
    choices: q.choices.map((c) => ({ key: c.id, text: c.text, format: 'markdown' as const })),
    correctKey: q.answer,
    why: q.why,
    topic: canonicalTopic(q.topic),
    section: q.section,
    difficulty: q.difficulty,
    passage,
  });
}

/* Which topic a zone question is really about.

   `q.tag` is trusted only when it names a topic. Twenty-two of the forty
   distinct tags are the zone's old all-caps label — `COMMA CASTLE` — which is
   a place rather than a skill, and names a place that no longer exists since
   the landmarks were renamed after their terrain. Those fall through to the
   topic the path itself declares (`commas`), which is the right answer and was
   sitting unused in paths.json the whole time. */
function topicFor(q: ZoneQuestion, zoneId: string, zoneTopic?: string): string {
  if (q.tag && !isZoneLabel(q.tag)) return canonicalTopic(q.tag);
  if (zoneTopic) return canonicalTopic(zoneTopic);
  // No declared topic either: translate the id, or keep it as a last resort.
  const alias = canonicalTopic(zoneId);
  return TOPIC_BY_ZONE_ALIAS[alias] ?? alias;
}

/* `section` is the road the landmark sits on, and the caller always knows it —
   it is the path the zone was reached through. It used to be recorded as the
   literal `'zone'` instead, which read as a fifth section that does not exist:
   every zone answer was excluded from its section's accuracy, from the study
   plan's weakest-topic search, and from anything else that filters by section,
   and it stood in Stats under a "Zone" heading beside the four real ones. Four
   hundred and twelve questions' worth of work that counted for nothing. */
export function fromZoneQuestion(
  q: ZoneQuestion,
  zoneId: string,
  section: SectionId,
  zoneTopic?: string,
): RunnableQuestion {
  const correctKey = KEYS[q.a] ?? 'A';

  /* `notes` gives per-choice feedback when the author wrote it, but the note
     on the credited answer is usually just "Correct." — the substantive
     explanation lives in `why`. So notes cover the distractors and `why`
     always wins for the correct choice. */
  const why: Record<string, string> = {};
  if (q.notes?.length) {
    q.notes.forEach((note, i) => {
      why[keyAt(i)] = note;
    });
  }
  why[correctKey] = q.why;

  return shuffleChoices({
    id: zoneQuestionId(zoneId, q),
    prompt: q.q,
    promptFormat: 'html',
    choices: q.opts.map((text, i) => ({ key: keyAt(i), text, format: 'html' as const })),
    correctKey,
    why,
    whyGeneral: q.why,
    topic: topicFor(q, zoneId, zoneTopic),
    section,
    difficulty: q.d === 3 ? 'hard' : q.d === 1 ? 'easy' : 'medium',
  });
}

/* ------------------------------------------------------------ id -> question

   The review queue stores nothing but ids, and both things that read it — the
   review session and the daily challenge — resolved them with `getQuestion`,
   which is built from the drill bank alone. Zone questions live in a separate
   file and are not in it, so a landmark question could be scheduled for review
   and then never found again: the queue took them in and nothing could get
   them out. Together with the positional ids above, the landmarks' entire
   share of spaced repetition was inert — it counted toward the "N due" figure
   on the home screen and then quietly failed to appear in the session.

   One resolver over both banks, so there is one place that knows how an id
   becomes a question.

   Whether an id names anything is answered by the content catalog, which
   needs nothing loaded — so Home can count a review queue without fetching
   the questions in it. Turning the id into a question does need its piece of
   the library: declare the ids with `useContent({ ids })` (or `loadContent`)
   first, and this throws rather than quietly dropping one that has not
   arrived. */

/* Zone questions by id, built the first time one is asked for — the zone
   quizzes are their own download, and most sessions never open them. */
let zoneByQid: Map<string, { zoneId: string; q: ZoneQuestion }> | null = null;
function zoneQuestion(qid: string) {
  if (!zoneByQid) {
    zoneByQid = new Map();
    for (const [zoneId, questions] of Object.entries(zoneQuizzes())) {
      for (const q of questions) zoneByQid.set(zoneQuestionId(zoneId, q), { zoneId, q });
    }
  }
  return zoneByQid.get(qid);
}

/** Review ids that are due *and* still name a question. `dueForReview` cannot
 *  check the second part — progress.ts stays off the question bank for first
 *  paint — so an id retired by a content rewrite was counted on Home ("Review 3
 *  questions") and then absent from the session it opened. Count with this. */
export function dueQuestionIds(p: Progress): string[] {
  return dueForReview(p).filter((qid) => locateQuestion(qid) !== undefined);
}

/** The question an id names, from either bank, ready for the runner.
 *  `undefined` when it names nothing — a question retired by a content edit,
 *  which the caller should skip rather than treat as an error. */
export function runnableById(qid: string): RunnableQuestion | undefined {
  const where = locateQuestion(qid);
  if (!where) return undefined;

  if (!where.zone) {
    const drill = getQuestion(qid);
    return drill && fromDrillQuestion(drill);
  }

  const found = zoneQuestion(qid);
  const entry = found && getZone(found.zoneId);
  if (!found || !entry) return undefined;
  return fromZoneQuestion(found.q, found.zoneId, entry.path.id, entry.zone.topic);
}
