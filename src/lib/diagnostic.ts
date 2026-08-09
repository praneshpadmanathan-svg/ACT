/* The placement test.
 *
 * *"Nothing tells me where I actually am before I start."* Onboarding asked
 * four questions, one of which — `OnboardingProfile.before`, have you sat the
 * real thing — was written to disk and then read by nothing at all, ever. The
 * study plan meanwhile could not name a weak topic until a student had already
 * answered three questions in it, which means the first week of work was
 * unguided precisely when guidance is worth the most.
 *
 * So: a short cross-section sample, taken once, before any of that.
 *
 * ── What it is not ──────────────────────────────────────────────────────────
 *
 * It is not a scored test and the UI must never present it as one. Twenty-odd
 * questions cannot produce a composite, and `scaleScore` over seven English
 * items has an error bar you could park a bus in. What it *can* do reliably is
 * rank a student's four sections against each other and notice which topics
 * they got nothing right in, which is all the study plan needs from it.
 *
 * ── Length ─────────────────────────────────────────────────────────────────
 *
 * Driven by `before`, at last. A first-timer has no idea where they stand and
 * neither do we, so they get the broad sample. Somebody who has already sat
 * the ACT is telling us their rough level in the same breath, so they get the
 * short one — the diagnostic only has to place them, not discover them.
 */

import { ALL_QUESTIONS, SECTIONS } from '@/content';
import { scaleScore } from './progress';
import { canonicalTopic } from './utils';
import type { DiagnosticResult, Difficulty, Progress, Question, SectionId } from '@/types';

/** Questions per section. Four sections, so 28 or 16 in total. */
const BROAD_PER_SECTION = 7;
const SHORT_PER_SECTION = 4;

export function diagnosticLength(p: Progress): number {
  return perSection(p) * SECTIONS.length;
}

function perSection(p: Progress): number {
  return p.profile?.before === 'first' || !p.profile ? BROAD_PER_SECTION : SHORT_PER_SECTION;
}

/** Roughly how long it takes, for the intro screen. Rounded to five minutes. */
export function diagnosticMinutes(p: Progress): number {
  return Math.max(5, Math.round((diagnosticLength(p) * 0.75) / 5) * 5);
}

/* A repeating easy → medium → hard cycle.
 *
 * Sampling a section entirely from one difficulty band is the fastest way to
 * misplace somebody: an all-easy sample places every student near the top of
 * the scale and an all-hard one buries them. The cycle is deterministic, so
 * two students of the same profile see the same *shape* of test. */
const DIFFICULTY_CYCLE: Difficulty[] = ['medium', 'easy', 'hard', 'medium'];

/**
 * The questions to ask, in order, grouped by section.
 *
 * Within a section it round-robins over topics ordered by how many questions
 * the bank holds for them, largest first. That ordering is not arbitrary: the
 * bank was authored in rough proportion to how heavily the real exam leans on
 * each topic, so sampling widest-first samples the exam's own emphasis.
 */
export function pickDiagnostic(p: Progress): Question[] {
  const n = perSection(p);
  const out: Question[] = [];

  for (const section of SECTIONS) {
    const pool = ALL_QUESTIONS.filter((q) => q.section === section.id);

    const byTopic = new Map<string, Question[]>();
    for (const q of pool) {
      const list = byTopic.get(q.topic);
      if (list) list.push(q);
      else byTopic.set(q.topic, [q]);
    }
    const topics = [...byTopic.entries()].sort((a, b) => b[1].length - a[1].length);
    if (topics.length === 0) continue;

    const used = new Set<string>();
    for (let i = 0; i < n; i++) {
      const wanted = DIFFICULTY_CYCLE[i % DIFFICULTY_CYCLE.length]!;

      /* Walk topics from the round-robin position onward, so a topic with
         nothing left at this difficulty hands off to the next one rather than
         dropping the slot. */
      let chosen: Question | undefined;
      for (let step = 0; step < topics.length && !chosen; step++) {
        const candidates = topics[(i + step) % topics.length]![1].filter((q) => !used.has(q.id));
        chosen = candidates.find((q) => q.difficulty === wanted) ?? candidates[0];
      }
      if (!chosen) break;
      used.add(chosen.id);
      out.push(chosen);
    }
  }

  return out;
}

/** One answered diagnostic question, as the runner reports it. */
export interface DiagnosticAnswer {
  section: SectionId;
  topic: string;
  correct: boolean;
}

/**
 * Turn the answers into a placement.
 *
 * `weakTopics` is deliberately strict: only topics the student got *nothing*
 * right in, ordered by how many were asked. One wrong answer out of two is a
 * coin flip and naming it as a weakness would send the study plan chasing
 * noise — the whole value of this list is that the plan can trust it on day
 * one, before there is any other evidence at all.
 */
export function scoreDiagnostic(answers: DiagnosticAnswer[]): DiagnosticResult {
  const raw: Partial<Record<SectionId, [number, number]>> = {};
  const scores: Partial<Record<SectionId, number>> = {};

  for (const section of SECTIONS) {
    const mine = answers.filter((a) => a.section === section.id);
    if (mine.length === 0) continue;
    const correct = mine.filter((a) => a.correct).length;
    raw[section.id] = [correct, mine.length];
    scores[section.id] = scaleScore(correct / mine.length);
  }

  const byTopic = new Map<string, { n: number; ok: number }>();
  for (const a of answers) {
    const key = canonicalTopic(a.topic);
    const b = byTopic.get(key) ?? { n: 0, ok: 0 };
    b.n += 1;
    if (a.correct) b.ok += 1;
    byTopic.set(key, b);
  }

  const weakTopics = [...byTopic.entries()]
    .filter(([, b]) => b.ok === 0)
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, 5)
    .map(([topic]) => topic);

  return { at: Date.now(), raw, scores, weakTopics, asked: answers.length };
}

/** The student's strongest and weakest sections, for the summary's one line. */
export function placementShape(
  d: DiagnosticResult,
): { strongest: SectionId; weakest: SectionId } | null {
  const entries = Object.entries(d.scores) as [SectionId, number][];
  if (entries.length < 2) return null;
  const sorted = [...entries].sort((a, b) => b[1] - a[1]);
  const strongest = sorted[0]![0];
  const weakest = sorted[sorted.length - 1]![0];
  if (strongest === weakest) return null;
  return { strongest, weakest };
}
