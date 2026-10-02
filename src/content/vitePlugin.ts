/* The question bank, cut into pieces the browser can fetch one at a time.
 *
 * Every screen used to import one barrel that held all of it — about six
 * megabytes of JSON, 1.7 MB gzipped — and the landing page modulepreloaded the
 * lot before first paint. Splitting it by file was not enough on its own:
 * `expansion.json` carries questions for all four sections in one document,
 * so a student drilling Math would still have downloaded Reading passages to
 * get the Math half of it.
 *
 * So the build assembles the pieces instead, from the same JSON, as virtual
 * modules:
 *
 *   virtual:content/section/<id>   one section's questions and passages —
 *                                  everything a drill, a test or a boss in
 *                                  that section reads, and nothing else
 *   virtual:content/index          the catalog: topics and counts per section,
 *                                  and the id of every question that exists.
 *                                  Enough to count a review queue, plan a day
 *                                  or list a section's topics without
 *                                  downloading a single question
 *   virtual:content/question/<id>  one question on its own, for the landing
 *                                  page's sample
 *
 * Nothing here is authored: every piece is derived from the JSON on every
 * build (and every dev-server load), so none of it can drift from the bank.
 *
 * Used by both `vite.config.ts` and `vitest.config.ts`, which is why it lives
 * beside the content rather than inside either config. */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Plugin } from 'vite';
import type { Passage, Path, Question, SectionId, ZoneQuestion } from '@/types';

import { zoneQuestionId } from './ids.ts';

const PREFIX = 'virtual:content/';

/* In `SECTIONS` order — `sections.ts` cannot be imported here (its consumers
   are typed against the app), and the order is what `ALL_QUESTIONS` always
   used, which the sample fallback below depends on. */
const SECTION_IDS: SectionId[] = ['english', 'math', 'reading', 'science'];
const FILE_NAME: Record<SectionId, string> = {
  english: 'English',
  math: 'Math',
  reading: 'Reading',
  science: 'Science',
};

interface Expansion {
  questions: Record<SectionId, Question[]>;
  passages: Partial<Record<SectionId, Passage[]>>;
}

/** The same JSON-in-a-string shape Vite's own JSON plugin emits: parsing a
 *  string is markedly faster for the engine than evaluating an object literal
 *  of this size. */
const emit = (name: string, value: unknown) =>
  `export ${name === 'default' ? 'default' : `const ${name} =`} JSON.parse(${JSON.stringify(JSON.stringify(value))});\n`;

export function contentModules(contentDir: string): Plugin {
  return {
    name: 'act-command:content-modules',
    enforce: 'pre',

    resolveId(id) {
      if (id.startsWith(PREFIX)) return `\0${id}`;
      return null;
    },

    load(id) {
      if (!id.startsWith(`\0${PREFIX}`)) return null;
      const what = id.slice(PREFIX.length + 1);

      /* Every read goes through here, so the dev server rebuilds a piece when
         a file it was cut from changes. */
      const json = <T>(file: string): T => {
        const full = join(contentDir, file);
        this.addWatchFile(full);
        return JSON.parse(readFileSync(full, 'utf8')) as T;
      };
      const expansion = json<Expansion>('expansion.json');

      /* What one section owns. The passage order matches the old barrel's —
         expansion first, then the section's own file — so where an id appears
         in both, the same copy wins. Math has no passages. */
      const section = (s: SectionId) => ({
        questions: [
          ...json<Question[]>(`questions${FILE_NAME[s]}.json`),
          ...expansion.questions[s],
        ],
        passages: [
          ...(expansion.passages[s] ?? []),
          ...(s === 'math' ? [] : json<Passage[]>(`passages${FILE_NAME[s]}.json`)),
        ],
      });

      const sectionMatch = /^section\/(\w+)$/.exec(what);
      if (sectionMatch) {
        const s = sectionMatch[1] as SectionId;
        if (!SECTION_IDS.includes(s)) this.error(`Unknown content section "${s}"`);
        return emit('default', section(s));
      }

      if (what === 'index') {
        const topics: Partial<Record<SectionId, [string, number][]>> = {};
        const drillIds: Partial<Record<SectionId, string[]>> = {};
        const zoneIds: Partial<Record<SectionId, string[]>> = {};

        for (const s of SECTION_IDS) {
          const { questions } = section(s);
          // Insertion order is first appearance, which is the order screens list them in.
          const counts = new Map<string, number>();
          for (const q of questions) counts.set(q.topic, (counts.get(q.topic) ?? 0) + 1);
          topics[s] = [...counts];
          drillIds[s] = questions.map((q) => q.id);
        }

        /* Only zones that sit on a road: a quiz keyed by a zone the map no
           longer has cannot be reached, and `runnableById` has always treated
           its questions as gone. */
        const quizzes = json<Record<string, ZoneQuestion[]>>('miniquizzes.json');
        for (const path of json<Path[]>('paths.json')) {
          const ids = (zoneIds[path.id] ??= []);
          for (const zone of path.nodes) {
            for (const q of quizzes[zone.id] ?? []) ids.push(zoneQuestionId(zone.id, q));
          }
        }

        return (
          emit('TOPIC_COUNTS', topics) + emit('DRILL_IDS', drillIds) + emit('ZONE_IDS', zoneIds)
        );
      }

      const questionMatch = /^question\/(.+)$/.exec(what);
      if (questionMatch) {
        const all = SECTION_IDS.flatMap((s) => section(s).questions);
        /* The named question, or — if a content edit ever drops it — the first
           one that could stand in: no passage to render, medium, and an
           explanation for every choice. A landing page that throws is worse
           than one showing a lesser question. */
        const picked =
          all.find((q) => q.id === questionMatch[1]) ??
          all.find(
            (q) =>
              !q.passage &&
              q.difficulty === 'medium' &&
              Object.keys(q.why).length === q.choices.length,
          ) ??
          all[0];
        return emit('default', picked ?? null);
      }

      this.error(`Unknown content module "${what}"`);
    },
  };
}
