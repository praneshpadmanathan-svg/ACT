/* Adapters from the two authored question shapes into the single shape the
   runner consumes.

   Drill questions use choice objects keyed A-D with a per-choice `why` map.
   Zone questions use a plain `opts` array with an answer index and an
   optional `notes` array. Normalising here means the runner never has to
   know which library a question came from. */

import type { Question, ZoneQuestion } from '@/types';
import type { RunnableQuestion } from '@/components/QuestionRunner';
import { getPassage } from '@/content';

const KEYS = ['A', 'B', 'C', 'D'];

export function fromDrillQuestion(q: Question): RunnableQuestion {
  const passage = getPassage(q.passage);

  /* English items quote the underlined span with guillemets inside the
     surrounding sentence. Split it out so the sentence reads as context and
     the underlined part is visibly the thing under test. */
  const guillemet = /«(.+?)»/s;
  const hasUnderline = guillemet.test(q.context);

  return {
    id: q.id,
    prompt: hasUnderline
      ? 'Which choice best replaces the highlighted text?'
      : q.context,
    promptFormat: 'markdown',
    label: hasUnderline
      ? q.context.replace(guillemet, '<u><b>$1</b></u>')
      : undefined,
    choices: q.choices.map((c) => ({ key: c.id, text: c.text, format: 'markdown' as const })),
    correctKey: q.answer,
    why: q.why,
    topic: q.topic,
    section: q.section,
    difficulty: q.difficulty,
    passage,
  };
}

export function fromZoneQuestion(q: ZoneQuestion, zoneId: string, index: number): RunnableQuestion {
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

  return {
    id: `${zoneId}-q${index}`,
    prompt: q.q,
    promptFormat: 'html',
    choices: q.opts.map((text, i) => ({ key: KEYS[i], text, format: 'html' as const })),
    correctKey,
    why,
    whyGeneral: q.why,
    topic: q.tag ?? zoneId,
    section: 'zone',
    difficulty: q.d === 3 ? 'hard' : q.d === 1 ? 'easy' : 'medium',
  };
}
