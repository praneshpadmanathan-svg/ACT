/* The answer-position guard.

   Both authored banks are skewed hard toward one position. Measured over the
   drill bank as shipped: 40.4% of answers are authored "A" and 9.7% are "D",
   against a chance rate of 25%. A student who never reads a question and
   always picks the first choice scores well above chance, which inflates every
   accuracy number the app computes and teaches precisely the wrong habit.

   `normalize.ts` fixes that by reshuffling every question from a hash of its
   id before the runner sees it. That mechanism had no test at all — and a
   reshuffle is the kind of thing that keeps working right up until somebody
   adds a batch of questions, or "simplifies" the adapter, and nothing visibly
   breaks. The skew would just quietly come back.

   So these tests measure the bank as a student actually meets it, rather than
   asserting that the shuffle function was called. */
import { describe, it, expect } from 'vitest';
import { fromDrillQuestion, fromZoneQuestion } from './normalize';
import { ALL_QUESTIONS, ZONE_QUIZZES, getZone } from '@/content';

const KEYS = ['A', 'B', 'C', 'D'];

const RUN = ALL_QUESTIONS.map(fromDrillQuestion);

const tally = (keys: string[]) =>
  keys.reduce<Record<string, number>>((t, k) => ((t[k] = (t[k] ?? 0) + 1), t), {});

/** χ² against a uniform distribution over `KEYS`. */
const chiSquare = (counts: Record<string, number>, n: number) => {
  const expected = n / KEYS.length;
  return KEYS.reduce((a, k) => a + Math.pow((counts[k] ?? 0) - expected, 2) / expected, 0);
};

describe('the shuffle preserves the question', () => {
  it('keeps every choice, exactly once', () => {
    for (const q of ALL_QUESTIONS) {
      const run = fromDrillQuestion(q);
      expect(run.choices.map((c) => c.text).sort()).toEqual(q.choices.map((c) => c.text).sort());
    }
  });

  it('moves the credited answer with its own text, never a neighbour', () => {
    for (const q of ALL_QUESTIONS) {
      const run = fromDrillQuestion(q);
      const authored = q.choices.find((c) => c.id === q.answer)!;
      const rendered = run.choices.find((c) => c.key === run.correctKey)!;
      expect(rendered.text).toBe(authored.text);
    }
  });

  it('carries each explanation to the choice it explains', () => {
    for (const q of ALL_QUESTIONS) {
      const run = fromDrillQuestion(q);
      for (const choice of run.choices) {
        const authored = q.choices.find((c) => c.text === choice.text)!;
        // Only where the author wrote one; rule 3 covers completeness.
        if (q.why[authored.id] === undefined) continue;
        expect(run.why[choice.key]).toBe(q.why[authored.id]);
      }
    }
  });

  it('is deterministic, so a question looks the same in review as in the drill', () => {
    for (const q of ALL_QUESTIONS.slice(0, 80)) {
      const a = fromDrillQuestion(q);
      const b = fromDrillQuestion(q);
      expect(b.choices.map((c) => c.text)).toEqual(a.choices.map((c) => c.text));
      expect(b.correctKey).toBe(a.correctKey);
    }
  });

  it('pins NO CHANGE to the first slot, as the real test does', () => {
    const pinned = ALL_QUESTIONS.filter((q) =>
      q.choices.some((c) => /^\s*NO CHANGE\s*$/i.test(c.text)),
    );
    expect(pinned.length).toBeGreaterThan(0); // else this asserts nothing
    for (const q of pinned) {
      expect(fromDrillQuestion(q).choices[0]!.text.trim()).toMatch(/^NO CHANGE$/i);
    }
  });
});

describe('the answer does not sit in a predictable place', () => {
  it('lands near-uniformly across the whole drill bank', () => {
    const counts = tally(RUN.map((q) => q.correctKey));
    // 3 degrees of freedom; 7.815 is the 0.05 critical value.
    expect(chiSquare(counts, RUN.length)).toBeLessThan(7.815);
  });

  it('gives no single position a usable edge within a section', () => {
    const bySection = new Map<string, string[]>();
    for (const q of RUN) {
      const list = bySection.get(q.section) ?? [];
      list.push(q.correctKey);
      bySection.set(q.section, list);
    }

    for (const [section, keys] of bySection) {
      const counts = tally(keys);
      for (const k of KEYS) {
        const share = (counts[k] ?? 0) / keys.length;
        /* Wider than the whole-bank χ² because a single section is a smaller
           sample, but still tight enough that "always guess C" cannot beat
           chance by a margin worth having. */
        expect(share, `${section} answers at ${k}`).toBeGreaterThan(0.14);
        expect(share, `${section} answers at ${k}`).toBeLessThan(0.36);
      }
    }
  });

  it('shuffles landmark quizzes too, not only the drill bank', () => {
    const keys: string[] = [];
    let moved = 0;
    for (const [zoneId, questions] of Object.entries(ZONE_QUIZZES)) {
      const entry = getZone(zoneId);
      if (!entry) continue;
      for (const q of questions) {
        const run = fromZoneQuestion(q, zoneId, entry.path.id, entry.zone.topic);
        keys.push(run.correctKey);
        if (run.choices[q.a]?.text !== q.opts[q.a]) moved++;
      }
    }
    expect(keys.length).toBeGreaterThan(100);
    // 44% of authored zone answers are the first option; that must not survive.
    expect(chiSquare(tally(keys), keys.length)).toBeLessThan(7.815);
    expect(moved).toBeGreaterThan(0);
  });
});

describe('every question reaches the runner with a question in it', () => {
  /* The regression this pins: 28 English items state their question in a
     separate `stem` field, and the adapter only ever read `context`. They
     rendered four choices under an empty prompt. Nothing failed, nothing
     logged, and the items had been in review queues for weeks. */
  it('never renders an empty prompt', () => {
    for (const q of ALL_QUESTIONS) {
      const run = fromDrillQuestion(q);
      expect(run.prompt.trim(), `${q.id} has no prompt`).not.toBe('');
    }
  });

  it('poses stem-mode items in their own words, not the standard instruction', () => {
    const stemMode = ALL_QUESTIONS.filter((q) => !q.context.trim() && q.stem?.trim());
    expect(stemMode.length).toBeGreaterThan(0); // else this asserts nothing
    for (const q of stemMode) {
      const run = fromDrillQuestion(q);
      expect(run.prompt).toBe(q.stem!.trim());
      // No span to highlight, so there is nothing for the label slot to hold.
      expect(run.label).toBeUndefined();
    }
  });

  it('turns an underlined span into the instruction plus a marked-up sentence', () => {
    const underlined = ALL_QUESTIONS.filter((q) => /«(.+?)»/s.test(q.context));
    expect(underlined.length).toBeGreaterThan(0);
    for (const q of underlined.slice(0, 60)) {
      const run = fromDrillQuestion(q);
      expect(run.prompt).toBe('Which choice best replaces the highlighted text?');
      expect(run.label).toContain('<u><b>');
      expect(run.label).not.toContain('«');
    }
  });
});
