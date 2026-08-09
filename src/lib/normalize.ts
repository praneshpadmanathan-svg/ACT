/* Adapters from the two authored question shapes into the single shape the
   runner consumes.

   Drill questions use choice objects keyed A-D with a per-choice `why` map.
   Zone questions use a plain `opts` array with an answer index and an
   optional `notes` array. Normalising here means the runner never has to
   know which library a question came from. */

import type { Question, ZoneQuestion } from '@/types';
import type { RunnableQuestion } from '@/components/QuestionRunner';
import { getPassage, TOPIC_BY_ZONE_ALIAS } from '@/content';
import { canonicalTopic, isZoneLabel, seeded, shuffle } from '@/lib/utils';

const KEYS = ['A', 'B', 'C', 'D'];

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

/** Stable 32-bit hash of the question id, so the order never drifts. */
function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) || 1;
}

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
  const hasUnderline = guillemet.test(q.context);

  return shuffleChoices({
    id: q.id,
    prompt: hasUnderline ? 'Which choice best replaces the highlighted text?' : q.context,
    promptFormat: 'markdown',
    label: hasUnderline ? q.context.replace(guillemet, '<u><b>$1</b></u>') : undefined,
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

export function fromZoneQuestion(
  q: ZoneQuestion,
  zoneId: string,
  index: number,
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
      if (KEYS[i]) why[KEYS[i]] = note;
    });
  }
  why[correctKey] = q.why;

  return shuffleChoices({
    id: `${zoneId}-q${index}`,
    prompt: q.q,
    promptFormat: 'html',
    choices: q.opts.map((text, i) => ({ key: KEYS[i], text, format: 'html' as const })),
    correctKey,
    why,
    whyGeneral: q.why,
    topic: topicFor(q, zoneId, zoneTopic),
    section: 'zone',
    difficulty: q.d === 3 ? 'hard' : q.d === 1 ? 'easy' : 'medium',
  });
}
