/* The story.

   A quest chain around the actual work. Three rules keep it from becoming
   filler:

   1. Every beat is *earned*. It fires at a real moment in your progress — a
      landmark cleared, a guardian felled, the Summit opening — so the
      narrative tracks what you have genuinely done rather than running on a
      timer.
   2. Nothing is ever locked behind the story. Each objective is something you
      would do anyway; the story only names it and reacts to it. A quest that
      blocked studying would just teach people to avoid the quest.
   3. The fantasy never lies about the test. Wizzy talks about spaced review,
      pacing and weak topics in the language of the realm, but the advice
      underneath is true advice.

   The shape is a chain of nine objectives ending at the full timed trial, so
   there is a real "do this to reach the end" spine. The middle of it is the
   four Seals, which are the region guardians the boss duels already use — the
   fiction and the mechanics point at the same thing.

   The prologue asks one question whose answer is kept and referenced later, so
   the story remembers something about you. */

import type { Progress, SectionId } from '@/types';

export interface StoryChoice {
  label: string;
  value: string;
  /** Wizzy's answer to this choice. */
  reply: string;
}

/** What the world is doing while a beat is spoken.

    The story used to play on a curtain: an 88%-opaque scrim and a picture of
    the camp, drawn over the top of the screen regardless of what was being
    said. So Wizzy could describe the Grey lying over the land like wet ash
    while the land it was lying on was hidden behind him, and the most
    atmospheric writing in the app was delivered to a closed set.

    A mood is the beat telling the world to react. It is published as a single
    attribute on the document, so the overlay, the screen underneath and the
    weather all read one signal and move together rather than being wired to
    each other. Everything it drives is in `index.css` under `[data-story-mood]`.

      grey    the plague. Colour drains out of the world, the light goes cold,
              and the fog closes over the whole screen rather than staying in
              its bands.
      summit  the citadel, and anything that is still standing. Warm, low, from
              the south.
      seal    a Seal breaking, or the promise of it. Hard gold. */
export type BeatMood = 'grey' | 'summit' | 'seal';

export interface StoryBeat {
  /** Revealed one at a time, each on its own tap. */
  lines: string[];
  choice?: {
    prompt: string;
    options: StoryChoice[];
  };
  /** Rattle the scene as this beat opens. For the moments that deserve it. */
  shake?: 'soft' | 'hard';
  /** What the world does while this beat is on screen. */
  mood?: BeatMood;
}

export interface StoryContext {
  cleared: number;
  total: number;
}

export interface Chapter {
  id: string;
  eyebrow: string;
  title: string;
  beats: StoryBeat[];
  /** Fires the first time this returns true. */
  when: (p: Progress, ctx: StoryContext) => boolean;
  /** Dispatches are one short beat with no title card. */
  compact?: boolean;
}

/** How Wizzy refers back to your answer, long after you gave it. */
export const OATH_ECHO: Record<string, string> = {
  door: 'the door you are trying to open',
  proof: 'the thing you set out to prove',
  someone: 'the person counting on you',
  curious: 'the simple wish to be good at this',
};

/* ------------------------------------------------------------------ counters

   Everything a quest can be measured against is derived from progress, so no
   new state has to be persisted and an objective can never drift out of sync
   with what you have actually done. */

const clearedCount = (_p: Progress, ctx: StoryContext) => ctx.cleared;
const sealsBroken = (p: Progress) => p.achievements.filter((a) => a.startsWith('boss-')).length;
const fullTrials = (p: Progress) => p.testHistory.filter((t) => t.sections.length === 4).length;

/** Resolve a quest's target against the live realm. */
export const needOf = (quest: Quest, ctx: StoryContext): number =>
  typeof quest.need === 'function' ? quest.need(ctx) : quest.need;

/* -------------------------------------------------------------------- quests */

export interface Quest {
  id: string;
  /** Short name for the quest hint. */
  name: string;
  /** One imperative line: what to actually do. */
  objective: string;
  /** How many are required. A function when the target is the whole realm,
   *  so adding or removing a landmark cannot leave this quest unreachable —
   *  or reachable early — the way a hardcoded count would. */
  need: number | ((ctx: StoryContext) => number);
  count: (p: Progress, ctx: StoryContext) => number;
  /** Wizzy sets the quest. */
  intro: { eyebrow: string; title: string; beats: StoryBeat[] };
  /** Wizzy reacts when it is met. This is where the drama goes. */
  done: { eyebrow: string; title: string; beats: StoryBeat[] };
}

export const QUESTS: Quest[] = [
  {
    id: 'oath',
    name: 'The Oath',
    objective: 'Clear your first landmark',
    need: 1,
    count: clearedCount,
    intro: {
      eyebrow: 'Chapter One',
      title: 'The Light Is Going Out',
      beats: [
        {
          lines: [
            'I am <b>Wizzy</b>. South of here, past the water, a citadel at the <b>Summit</b> — and its light is going out.',
          ],
          mood: 'summit',
        },
        {
          lines: [
            'The <b>Grey</b> is putting it out. It does not burn or break anything. It <b>settles</b>, and afterwards nobody remembers what was underneath.',
            'It spreads wherever nobody walks.',
          ],
          shake: 'soft',
          mood: 'grey',
        },
        {
          lines: [
            'Four regions still stand, each held shut by a <b>Seal</b> with a guardian at it. <b>Break all four and the Grey lifts.</b>',
          ],
          shake: 'hard',
          mood: 'seal',
        },
        {
          lines: ['One question before you set out.'],
          choice: {
            prompt: 'Why are you climbing?',
            options: [
              {
                label: 'A score opens a door I want',
                value: 'door',
                reply: 'A door, then. Doors open for those who keep walking at them.',
              },
              {
                label: 'I want to prove I can',
                value: 'proof',
                reply: 'To yourself. The only reason still standing at midnight.',
              },
              {
                label: 'Someone is counting on me',
                value: 'someone',
                reply: 'Carry that quietly. It will get you up the hard slopes.',
              },
              {
                label: 'I just want to be good at it',
                value: 'curious',
                reply: 'Curiosity. Rarer than courage, and it outlasts it.',
              },
            ],
          },
        },
        {
          lines: [
            'Then I shall hold you to it. Read the lesson, clear the quiz at seven in ten, and the next landmark opens.',
            'What you get wrong, I keep — it returns tomorrow, then in three days, then a week. That is the method.',
          ],
        },
      ],
    },
    done: {
      eyebrow: 'Chapter Two',
      title: 'One Light, Lit',
      beats: [
        {
          lines: [
            'One landmark, and the Grey pulled back the width of a field.',
            'It never feels like much. The climb is not one heroic afternoon — it is a great many small ones.',
          ],
          shake: 'soft',
        },
      ],
    },
  },

  {
    id: 'foothold',
    name: 'A Foothold',
    objective: 'Clear 4 landmarks',
    need: 4,
    count: clearedCount,
    intro: {
      eyebrow: 'Chapter Three',
      title: 'Ground You Can Stand On',
      beats: [
        {
          lines: [
            'One light will not hold. Give me <b>four</b> — four in a line is a road, and roads are harder to erase.',
            'Watch your <b>Review</b> queue as you walk. Only the questions you missed have anything left to teach you.',
          ],
          mood: 'grey',
        },
      ],
    },
    done: {
      eyebrow: 'Chapter Four',
      title: 'The Grey Recoils',
      beats: [
        {
          lines: [
            'Four. Look behind you — the road is <i>there</i>, not fading at the edges.',
            'Now: something is going to notice you.',
          ],
          shake: 'hard',
          mood: 'summit',
        },
      ],
    },
  },

  {
    id: 'first-seal',
    name: 'The First Seal',
    objective: 'Defeat one region guardian',
    need: 1,
    count: sealsBroken,
    intro: {
      eyebrow: 'Chapter Five',
      title: 'What Holds the Seals',
      beats: [
        {
          lines: [
            'Each region has a <b>guardian</b> holding one of the four Seals. Clear every landmark in a region and its guardian wakes.',
            'They ask the hardest questions their region knows. You will lose the first time — it costs you nothing but the walk back.',
          ],
          shake: 'soft',
        },
      ],
    },
    done: {
      eyebrow: 'Chapter Six',
      title: 'The First Seal Breaks',
      beats: [
        {
          lines: [
            'It is down. <b>It is down.</b>',
            'That crack running south under the ground is a Seal breaking. Three left.',
          ],
          shake: 'hard',
        },
      ],
    },
  },

  {
    id: 'deepening',
    name: 'Into the Realm',
    objective: 'Clear 12 landmarks',
    need: 12,
    count: clearedCount,
    intro: {
      eyebrow: 'Chapter Seven',
      title: 'The Part Nobody Writes Songs About',
      beats: [
        {
          lines: [
            'Now the unglamorous stretch. This is where travellers turn back — not from difficulty, from boredom.',
            'Your score does not come from what you found easy. Open <b>Progress</b>: your weakest topics are listed there, and that is where the points are.',
          ],
          mood: 'grey',
        },
      ],
    },
    done: {
      eyebrow: 'Chapter Eight',
      title: 'Deep In',
      beats: [
        {
          lines: [
            'Twelve. Far enough that turning back is longer than going on.',
            'The boring middle is the only part that has ever separated anyone from anyone else.',
          ],
          shake: 'soft',
        },
      ],
    },
  },

  {
    id: 'second-seal',
    name: 'The Second Seal',
    objective: 'Defeat a second guardian',
    need: 2,
    count: sealsBroken,
    intro: {
      eyebrow: 'Chapter Nine',
      title: 'They Are Awake Now',
      beats: [
        {
          lines: [
            'The guardians still standing know a Seal has broken.',
            'Take a <b>second</b>, in a different region — the questions are not the same shape.',
          ],
          shake: 'soft',
        },
      ],
    },
    done: {
      eyebrow: 'Chapter Ten',
      title: 'Two Down',
      beats: [
        {
          lines: [
            'Two Seals. Half the binding on the southern road, gone.',
            'And the citadel is brighter. I can see it from here.',
          ],
          shake: 'hard',
        },
      ],
    },
  },

  {
    id: 'halfway',
    name: 'The Long Middle',
    objective: 'Clear 19 landmarks',
    need: 19,
    count: clearedCount,
    intro: {
      eyebrow: 'Chapter Eleven',
      title: 'Halfway Is a Place',
      beats: [
        {
          lines: [
            'Halfway. The second half rewards <b>pace</b> as much as knowledge — knowing an answer slowly is worth nothing on the day.',
            'Sit a <i>single</i> timed section at the citadel. Not the full trial. It will tell you more than a week of practice with no clock on it.',
          ],
        },
      ],
    },
    done: {
      eyebrow: 'Chapter Twelve',
      title: 'The Summit, Seen Plainly',
      beats: [
        {
          lines: [
            'There it is. Not a rumour — a citadel, on an island, with the light still in it.',
          ],
          shake: 'hard',
        },
      ],
    },
  },

  {
    id: 'all-seals',
    name: 'Every Seal',
    objective: 'Defeat all four guardians',
    need: 4,
    count: sealsBroken,
    intro: {
      eyebrow: 'Chapter Thirteen',
      title: 'The Last Two Seals',
      beats: [
        {
          lines: [
            'Two guardians left, and they have had a long time to get ready.',
            'These fights find out whether you learned your regions or only walked through them. Go and know the material.',
          ],
          shake: 'soft',
        },
      ],
    },
    done: {
      eyebrow: 'Chapter Fourteen',
      title: 'The Road Is Open',
      beats: [
        {
          lines: [
            'Four Seals. <b>All four.</b> The southern road has not been open in my lifetime.',
            'Finish the roads. Then we sail.',
          ],
          shake: 'hard',
          mood: 'summit',
        },
      ],
    },
  },

  {
    id: 'summit-road',
    name: 'The Whole Realm',
    objective: 'Clear every landmark',
    need: (ctx) => ctx.total,
    count: clearedCount,
    intro: {
      eyebrow: 'Chapter Fifteen',
      title: 'Leave Nothing Behind',
      beats: [
        {
          lines: [
            'Every landmark before we sail. Any skill you skip out here is a question you will meet in the citadel with nothing prepared.',
          ],
          mood: 'grey',
        },
      ],
    },
    done: {
      eyebrow: 'Chapter Sixteen',
      title: 'The Citadel Is Lit For You',
      beats: [
        {
          lines: [
            'Every landmark. Every region. Every Seal. Almost nobody stands where you are standing.',
            'Inside waits the full trial: four sections, properly timed, no explanations until the end.',
          ],
          shake: 'hard',
        },
      ],
    },
  },

  {
    id: 'reckoning',
    name: 'The Trial',
    objective: 'Sit the full timed trial at the Summit',
    need: 1,
    count: fullTrials,
    intro: {
      eyebrow: 'Chapter Seventeen',
      title: 'The Doors Are Open',
      beats: [
        {
          lines: [
            'Four sections, the clock running, nobody telling you how you are doing until it is finished.',
            'Sleep first if it is late. The trial measures a rested traveller and a tired one very differently.',
          ],
        },
      ],
    },
    done: {
      eyebrow: 'Chapter Eighteen',
      title: 'What the Trial Said',
      beats: [
        {
          lines: [
            'A score is not a verdict. It is a reading.',
            'Read the report rather than the number — it names the topics that cost you, and those are your last few points sitting there with labels on.',
            'Then drill them and sit another. That loop is the whole craft.',
          ],
          shake: 'hard',
        },
      ],
    },
  },
];

/* --------------------------------------------------------------- dispatches

   Short story updates between the big beats, so the world keeps moving while
   you work rather than going quiet for ten landmarks at a stretch. One beat,
   no title card, roughly every fourth landmark. */

const DISPATCH_LINES: [number, string][] = [
  [
    3,
    'A rider came through the camp while you were out. Two more villages on the eastern road have gone <b>Grey</b> — but the stretch you cleared is holding. Holding, and lit.',
  ],
  [
    7,
    'The cottages you walked past have their lamps on again. Someone put them there. That happens where the road is solid, and it does not happen anywhere else.',
  ],
  [
    11,
    'The guardians have stopped pretending not to see you. I would not walk into a region you have not finished, if I were you.',
  ],
  [
    15,
    'The Grey has changed how it moves. It used to spread. Now it <i>waits</i> — out past the edges, where nobody has been for a while. Waiting is worse.',
  ],
  [
    19,
    'Travellers are following your road south. Actual travellers, behind you, on ground you made safe. I thought you should know that.',
  ],
  [
    23,
    'The citadel light held steady all last night. Not brighter. Steady. It has not been steady in years.',
  ],
  [
    27,
    'Something came to the camp fence in the dark and looked a long while down the road you cleared. Then it left. I do not think it liked what it saw.',
  ],
  [
    31,
    'The Grey has stopped taking ground anywhere on this continent. It is only holding what it already has. You did that by walking.',
  ],
  [
    35,
    'Sit down a moment, traveller. I have watched this road for forty years and I have never once seen it look like this.',
  ],
];

/* ------------------------------------------------------------------ chapters

   The chain flattened into the chapter list the overlay plays. Each quest
   contributes an intro (which fires once the previous quest is met) and a
   completion beat (which fires when its own objective is met). */

function questChapters(): Chapter[] {
  const out: Chapter[] = [];
  QUESTS.forEach((quest, i) => {
    const previous = QUESTS[i - 1];
    out.push({
      id: `q-${quest.id}-intro`,
      eyebrow: quest.intro.eyebrow,
      title: quest.intro.title,
      beats: quest.intro.beats,
      when: (p, ctx) => (previous ? previous.count(p, ctx) >= needOf(previous, ctx) : true),
    });
    out.push({
      id: `q-${quest.id}-done`,
      eyebrow: quest.done.eyebrow,
      title: quest.done.title,
      beats: quest.done.beats,
      when: (p, ctx) => quest.count(p, ctx) >= needOf(quest, ctx),
    });
  });
  return out;
}

/* Quest beats come first in the list, so when a landmark clear satisfies both a
   quest and a dispatch at once, the bigger moment plays.

   A dispatch only fires while it is the *most recent* one earned. Without that
   guard, anyone who cleared several landmarks between visits — or merged
   progress from another device — got a stack of "word from the road" cards back
   to back, which is not how news works. Cleared count only ever rises, so an
   overtaken dispatch is skipped permanently and needs no bookkeeping. */
export const CHAPTERS: Chapter[] = [
  ...questChapters(),
  ...DISPATCH_LINES.map(([at, line], i) => {
    const nextAt = DISPATCH_LINES[i + 1]?.[0] ?? null;
    return {
      id: `dispatch-${at}`,
      eyebrow: 'Word from the road',
      title: 'A Dispatch',
      compact: true,
      beats: [{ lines: [line] }],
      when: (_p: Progress, ctx: StoryContext) =>
        ctx.cleared >= at && (nextAt === null || ctx.cleared < nextAt),
    };
  }),
];

/** The opening chapter's id, so Study can wait for it before asking anything. */
export const PROLOGUE_ID = 'q-oath-intro';

/** The next chapter that has been earned and not yet seen. */
export function nextChapter(progress: Progress, ctx: StoryContext): Chapter | null {
  const seen = new Set(progress.storySeen ?? []);
  for (const chapter of CHAPTERS) {
    if (seen.has(chapter.id)) continue;
    if (chapter.when(progress, ctx)) return chapter;
  }
  return null;
}

export function chapterById(id: string): Chapter | undefined {
  return CHAPTERS.find((c) => c.id === id);
}

/* -------------------------------------------------------------- active quest */

export interface QuestState {
  quest: Quest;
  have: number;
  need: number;
  /** 1-based position in the chain, for "Quest 3 of 9". */
  step: number;
  total: number;
}

/** The objective you are currently working on, or null once the chain is done. */
export function activeQuest(progress: Progress, ctx: StoryContext): QuestState | null {
  for (const [i, quest] of QUESTS.entries()) {
    const have = quest.count(progress, ctx);
    const need = needOf(quest, ctx);
    if (have < need) {
      return { quest, have, need, step: i + 1, total: QUESTS.length };
    }
  }
  return null;
}

/** Region a guardian belongs to, for the quest hint. */
export const SEAL_REGION_ORDER: SectionId[] = ['english', 'reading', 'math', 'science'];
