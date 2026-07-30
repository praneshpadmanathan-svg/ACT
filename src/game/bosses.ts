/* The four region bosses.

   A boss is unlocked once every landmark in its region is cleared. The fight
   is a duel: you on the left, the boss on the right, and the questions are
   the weapons. Getting one right lands a hit; getting one wrong lets the boss
   hit back. Run out of health and you retreat — nothing is lost except the
   attempt, because a boss that costs you progress would make people avoid it.

   Questions are drawn from the region's own bank, weighted hard, so the
   fight is genuinely the exam for that region. */

import type { SectionId } from '@/types';

export interface Boss {
  id: string;
  section: SectionId;
  name: string;
  title: string;
  /** Said when the fight opens. */
  taunt: string;
  /** Said on defeat. */
  defeated: string;
  /** Said when it beats you. */
  victory: string;
  color: string;
  /** Hits needed to bring it down. */
  health: number;
  /** Hits you can take. */
  playerHealth: number;
}

export const BOSSES: Record<SectionId, Boss> = {
  english: {
    id: 'grammar-gauntlet',
    section: 'english',
    name: 'The Grammar Gauntlet',
    title: 'Keeper of the Village',
    taunt:
      'You have learned the rules. Now let us see whether you can apply them with a blade at your throat.',
    defeated: 'The rules were never mine. They were always yours. Take the village — it is yours.',
    victory: 'Rules half-remembered are rules half-useless. Go back to the road, traveller.',
    color: '#d9a441',
    health: 10,
    playerHealth: 3,
  },
  reading: {
    id: 'passage-titan',
    section: 'reading',
    name: 'The Passage Titan',
    title: 'Warden of the Woods',
    taunt:
      'Every answer you need is already written. The question is whether you can find it before I find you.',
    defeated: 'You read what was there — not what you expected. That is rarer than you know.',
    victory: 'You brought answers from outside the text. The woods do not forgive that.',
    color: '#5fa86b',
    health: 10,
    playerHealth: 3,
  },
  math: {
    id: 'number-crusher',
    section: 'math',
    name: 'The Number Crusher',
    title: 'Tyrant of the Desert',
    taunt: 'The desert does not care how clever you are. Only how quickly.',
    defeated: 'Fast and correct. I have crushed a thousand who managed only one of those.',
    victory: 'Too slow, or too careless. In the sand, they amount to the same thing.',
    color: '#d2703a',
    health: 10,
    playerHealth: 3,
  },
  science: {
    id: 'lab-leviathan',
    section: 'science',
    name: 'The Lab Leviathan',
    title: 'Guardian of the Cliffs',
    taunt: 'I will show you data. You will tell me only what it says — nothing more.',
    defeated: 'You read the figure and stopped there. Most cannot resist adding what they assume.',
    victory: 'You added what was not measured. The cliffs have no use for guesses.',
    color: '#4f9dc9',
    health: 10,
    playerHealth: 3,
  },
};

export const BOSS_LIST = Object.values(BOSSES);

export function bossFor(section: string): Boss | undefined {
  return BOSSES[section as SectionId];
}
