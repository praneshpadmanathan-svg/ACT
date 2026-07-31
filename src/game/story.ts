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

export interface StoryBeat {
  /** Revealed one at a time, each on its own tap. */
  lines: string[];
  choice?: {
    prompt: string;
    options: StoryChoice[];
  };
  /** Rattle the scene as this beat opens. For the moments that deserve it. */
  shake?: 'soft' | 'hard';
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

/* -------------------------------------------------------------------- quests */

export interface Quest {
  id: string;
  /** Short name for the map HUD. */
  name: string;
  /** One imperative line: what to actually do. */
  objective: string;
  need: number;
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
            'Ah — you found the path. Most people walk straight past it.',
            'I am <b>Wizzy</b>. I have watched a great many travellers set out from this camp, and I will not pretend this is a good year to be setting out.',
            'Look south. That glow on the horizon, over the water — that is the citadel at the <b>Summit</b>.',
          ],
        },
        {
          lines: [
            'It is dimmer than it was. Every season it dims further, and every season fewer travellers reach it.',
            'Now look at the rest. That grey lying over the land like wet ash — that is the <b>Grey</b>, and it is why I am still standing at this camp instead of somewhere warm.',
          ],
          shake: 'soft',
        },
        {
          lines: [
            'It is a plague, of a sort. It does not burn anything or knock anything down. It simply <b>settles</b> — over a field, a wood, a stretch of coast — and after a while nobody can remember what was underneath.',
            'Not destroyed. <b>Forgotten.</b> Which is worse, because there is nothing left to bury.',
            'It spreads wherever nobody walks. That is the whole of its cunning, and it is enough.',
          ],
          shake: 'soft',
        },
        {
          lines: [
            'Four regions are still standing: <b>the Grammar Village</b>, <b>the Enchanted Woods</b>, <b>the Number Desert</b>, <b>the Science Cliffs</b>.',
            'Each one is held shut by a <b>Seal</b>, and at each Seal something is waiting that will not let you pass for asking nicely.',
          ],
        },
        {
          lines: [
            'So here is what it takes, and I will not dress it up.',
            '<b>Break all four Seals, and the Grey lifts.</b> Not one. Not three. Every region cleared to its last landmark, every guardian put down — and the plague has nowhere left to sit.',
            'Thirty-seven landmarks between here and that. Each holds a single skill, and each one you take is ground the Grey cannot come back to.',
            'Clear the four, and the road to the Summit opens behind them.',
          ],
          shake: 'hard',
        },
        {
          lines: ['One question before you set out, traveller. I ask everyone.'],
          choice: {
            prompt: 'Why are you climbing?',
            options: [
              {
                label: 'A score opens a door I want',
                value: 'door',
                reply: 'A door, then. Doors open for those who keep walking at them — that is the whole trick, and it is duller than people hope.',
              },
              {
                label: 'I want to prove I can',
                value: 'proof',
                reply: 'To prove it to yourself. The best reason there is, and the only one still standing at midnight.',
              },
              {
                label: 'Someone is counting on me',
                value: 'someone',
                reply: 'For them, then. Carry that quietly — it will get you up the hard slopes when nothing else will.',
              },
              {
                label: 'I just want to be good at it',
                value: 'curious',
                reply: 'Curiosity! Rarer than courage on this road, and it outlasts it.',
              },
            ],
          },
        },
        {
          lines: [
            'Then I shall hold you to it.',
            'Your traveller stands at the first glowing marker. Read the lesson, clear the quiz at seven in ten, and the next stretch of road appears.',
            'And when you get something wrong — you will — I keep it. It comes back tomorrow, then in three days, then a week, until it stops being a problem. That is not a punishment. That is the entire method.',
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
            'There. Feel that?',
            'One landmark. The Grey just pulled back the width of a single field, and somewhere behind you a place that was fading is solid again.',
          ],
          shake: 'soft',
        },
        {
          lines: [
            'I know it does not feel like much. It never does.',
            'The climb is not one heroic afternoon. It is thirty-seven small ones, and you have had the first. Keep going — the road only appears under people who are walking it.',
          ],
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
            'One light will not hold. The Grey closes around a single point like water around a stone.',
            'Give me <b>four</b>. Four landmarks in a line is not a point any more — it is a road, and roads are much harder to erase.',
            'Watch your <b>Review</b> queue while you walk. Everything you missed is in there, and those questions are the only ones with anything left to teach you.',
          ],
        },
      ],
    },
    done: {
      eyebrow: 'Chapter Four',
      title: 'The Grey Recoils',
      beats: [
        {
          lines: [
            'Four. Look behind you, traveller — properly, look.',
            'The road is <i>there</i>. Not fading at the edges. There.',
          ],
          shake: 'hard',
        },
        {
          lines: [
            'That is what ground looks like when someone is standing on it. The Grey has lost this stretch, and it will not get it back while you keep coming this way.',
            'Now. Something is going to notice you.',
          ],
          shake: 'soft',
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
            'It has noticed you.',
            'Each region has a <b>guardian</b>, and each guardian holds one of the four Seals on the southern road. They were set to keep the Grey out. They have been standing so long they no longer tell the difference between the Grey and anyone else.',
          ],
          shake: 'soft',
        },
        {
          lines: [
            'You cannot talk your way past one. They ask questions — the hardest ones their region knows — and a wrong answer costs you.',
            'Clear every landmark in a region and its guardian wakes. Then go and take the Seal.',
            'You will lose the first time. Losing costs you nothing but the walk back, and I would rather you learned that from me than from the Summit.',
          ],
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
            'Do you hear that? That crack, running away south under the ground?',
          ],
          shake: 'hard',
        },
        {
          lines: [
            'That is a Seal breaking. The first in longer than I have been alive.',
            'Three left, traveller. Three, and the road to the Summit opens for the first time in living memory.',
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
            'Now the unglamorous stretch. <b>Twelve landmarks.</b>',
            'This is where travellers turn back, and not from difficulty — from boredom. The Grey does not need to beat you. It only needs you to stop finding this interesting.',
          ],
        },
        {
          lines: [
            'So here is the thing the map will not tell you: your score does not come from the landmarks you found easy.',
            'It comes from the handful you keep getting wrong. Open <b>Progress</b> sometime — your weakest topics are listed there, plainly. Ground already won is worth less than ground you keep slipping on.',
          ],
        },
      ],
    },
    done: {
      eyebrow: 'Chapter Eight',
      title: 'Deep In',
      beats: [
        {
          lines: [
            'Twelve. You are properly inside the realm now — far enough that turning back would be longer than going on.',
            'Most travellers never see this part of the map. You are walking through the middle of the boring bit, which is the only part that has ever separated anyone from anyone else.',
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
            'Word travels among them. The remaining guardians know a Seal has broken, and they are not going to be careless about the next one.',
            'Take a <b>second Seal</b>. A different region — the fight will not feel the same, because the questions are not the same shape.',
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
            'And look — the citadel. It is brighter. Do not tell me you cannot see it, because I can see it from here.',
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
            'Halfway. <b>Nineteen landmarks.</b> From that ridge you will see the Summit with your own eyes rather than on my word.',
            'A warning about the second half: it rewards <b>pace</b> as much as knowledge. Knowing an answer slowly is worth nothing on the day.',
          ],
        },
        {
          lines: [
            'When you feel ready, sit a <i>single</i> timed section at the citadel. Not the full trial — one section.',
            'It will tell you more about your timing than a week of practice with no clock on it.',
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
            'There it is.',
            'Not a rumour. Not a glow on the horizon. A citadel, on an island, with the light still in it — and you are close enough now to be counted among the people who got this far.',
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
            'Two guardians left, and they have had a long time to get ready for you.',
            'These are the fights that will find out whether you actually learned your regions or only walked through them. There is no trick I can give you. Go and know the material.',
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
            'Four Seals. <b>All four.</b>',
            'The southern road is open, traveller. It has not been open in my lifetime, and I am not a young man.',
          ],
          shake: 'hard',
        },
        {
          lines: [
            'The Grey has nothing left to hold on to between here and the water. Every region is lit and standing.',
            'Finish the map. Then we sail.',
          ],
          shake: 'soft',
        },
      ],
    },
  },

  {
    id: 'summit-road',
    name: 'The Whole Map',
    objective: 'Clear all 37 landmarks',
    need: 37,
    count: clearedCount,
    intro: {
      eyebrow: 'Chapter Fifteen',
      title: 'Leave Nothing Behind',
      beats: [
        {
          lines: [
            'Every landmark, before we sail. All thirty-seven.',
            'Not for the story — for you. Any skill you skip on this map is a question you will meet in the citadel with nothing prepared. The Grey is patient about gaps.',
          ],
        },
      ],
    },
    done: {
      eyebrow: 'Chapter Sixteen',
      title: 'The Citadel Is Lit For You',
      beats: [
        {
          lines: [
            'Every landmark. Every region. Every Seal.',
            'I did not say so at the start, traveller, because I did not want to frighten you — but almost nobody stands where you are standing.',
          ],
          shake: 'hard',
        },
        {
          lines: [
            'The citadel on the southern isle is lit, and the doors are open. Inside waits the full trial: four sections, properly timed, no explanations until the end.',
            'It will not feel pleasant while you sit it. That is rather the point. It is the only honest measure of where you actually stand.',
          ],
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
            'Go in when you are ready. Four sections, the clock running, nobody telling you how you are doing until it is finished.',
            'Sleep first if it is late. I am serious — the trial measures a rested traveller and a tired one very differently, and only one of those numbers is useful to you.',
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
            'You sat it. However that felt — you know something now that you did not know this morning.',
            'A score is not a verdict. It is a reading.',
          ],
          shake: 'hard',
        },
        {
          lines: [
            'Read the report rather than the number. It names the topics that cost you, and those are your last few points sitting there with labels on.',
            'Then drill them, and sit another. That loop, repeated, is the whole craft — there is no other secret, and I have been at this a very long time.',
            'The light is back in the citadel, traveller. You did that. Go on — you know this road better than I do now.',
          ],
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
  [3, 'A rider came through the camp while you were out. Two more villages on the eastern road have gone <b>Grey</b> — but the stretch you cleared is holding. Holding, and lit.'],
  [7, 'The cottages you walked past have their lamps on again. Someone put them there. That happens where the map is solid, and it does not happen anywhere else.'],
  [11, 'The guardians have stopped pretending not to see you. I would not walk into a region you have not finished, if I were you.'],
  [15, 'The Grey has changed how it moves. It used to spread. Now it <i>waits</i> — out past the edges, where nobody has been for a while. Waiting is worse.'],
  [19, 'Travellers are following your road south. Actual travellers, behind you, on ground you made safe. I thought you should know that.'],
  [23, 'The citadel light held steady all last night. Not brighter. Steady. It has not been steady in years.'],
  [27, 'Something came to the camp fence in the dark and looked at the map on my table for a long while. Then it left. I do not think it liked what it saw.'],
  [31, 'Six landmarks left, and the Grey has stopped taking ground anywhere on this continent. It is only holding what it has. You did that by walking.'],
  [35, 'Two left. Two. Sit down a moment, traveller — I have watched this road for forty years and I have never once seen it look like this.'],
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
      when: (p, ctx) => (previous ? previous.count(p, ctx) >= previous.need : true),
    });
    out.push({
      id: `q-${quest.id}-done`,
      eyebrow: quest.done.eyebrow,
      title: quest.done.title,
      beats: quest.done.beats,
      when: (p, ctx) => quest.count(p, ctx) >= quest.need,
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

/** The opening chapter's id, so the map can wait for it before asking anything. */
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
  for (let i = 0; i < QUESTS.length; i++) {
    const quest = QUESTS[i];
    const have = quest.count(progress, ctx);
    if (have < quest.need) {
      return { quest, have, need: quest.need, step: i + 1, total: QUESTS.length };
    }
  }
  return null;
}

/** Region a guardian belongs to, for the quest hint on the map. */
export const SEAL_REGION_ORDER: SectionId[] = ['english', 'reading', 'math', 'science'];
