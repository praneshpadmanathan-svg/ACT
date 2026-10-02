/* Types for the modules `vitePlugin.ts` assembles from the JSON at build time. */

declare module 'virtual:content/index' {
  import type { SectionId } from '@/types';

  /** Each section's topics in order of first appearance, with how many
   *  questions each holds. */
  export const TOPIC_COUNTS: Record<SectionId, [topic: string, count: number][]>;
  /** Every drill question id, by section. */
  export const DRILL_IDS: Record<SectionId, string[]>;
  /** Every reachable zone question id, by the road its landmark sits on. */
  export const ZONE_IDS: Record<SectionId, string[]>;
}

declare module 'virtual:content/section/*' {
  import type { Passage, Question } from '@/types';

  const bank: { questions: Question[]; passages: Passage[] };
  export default bank;
}

declare module 'virtual:content/question/*' {
  import type { Question } from '@/types';

  const question: Question | null;
  export default question;
}
