/* The story.

   A quest frame around the actual work. Two rules kept it from becoming
   filler:

   1. Every beat is *earned* — it fires at a real moment in your progress
      (first landmark cleared, half the realm, the Summit opening), so the
      narrative tracks what you have genuinely done rather than running on a
      timer.
   2. The fantasy never lies about the test. Wizzy talks about spaced review,
      pacing and weak topics in the language of the realm, but the advice
      underneath is true advice.

   The prologue asks one question whose answer is kept and referenced later,
   so the story remembers something about you. */

import type { Progress } from '@/types';

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
}

/** How Wizzy refers back to your answer, long after you gave it. */
export const OATH_ECHO: Record<string, string> = {
  door: 'the door you are trying to open',
  proof: 'the thing you set out to prove',
  someone: 'the person counting on you',
  curious: 'the simple wish to be good at this',
};

export const CHAPTERS: Chapter[] = [
  {
    id: 'prologue',
    eyebrow: 'Chapter One',
    title: 'The Road Begins',
    when: () => true,
    beats: [
      {
        lines: [
          'Ah — you found the path. Most people walk straight past it.',
          'I am <b>Wizzy</b>, and I have watched a great many travellers set out from this camp.',
          'The realm ahead has a name nobody enjoys saying aloud: <b>the Enhanced ACT</b>. Four regions, thirty-seven landmarks, and one golden Summit on the southern isle.',
        ],
      },
      {
        lines: [
          'Every region asks for something different. <b>The Grammar Village</b> keeps its rules in plain sight — learn them and it becomes almost mechanical.',
          '<b>The Enchanted Woods</b> hide every answer in the text itself. <b>The Number Desert</b> is long and dry, but each dune has a shortcut if you know where to step.',
          'And <b>The Science Cliffs</b> ask only that you read what is genuinely in front of you. Most travellers fail there by bringing answers from home.',
        ],
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
          'Your traveller stands at the first glowing marker. Read the lesson, clear the quiz, and the next stretch of road appears.',
          'And when you get something wrong — you will — I keep it. It returns tomorrow, then in three days, then a week, until it stops being a problem. That is not a punishment. That is the entire method.',
        ],
      },
    ],
  },

  {
    id: 'first-clear',
    eyebrow: 'Chapter Two',
    title: 'The First Marker',
    when: (_p, ctx) => ctx.cleared >= 1,
    beats: [
      {
        lines: [
          'One landmark behind you. I know — it does not feel like much yet.',
          'It never does. The climb is not one heroic afternoon; it is thirty-seven small ones, and you have had the first.',
          'Watch the <b>Review</b> queue as it fills. The questions you missed are the only ones with anything left to teach you.',
        ],
      },
    ],
  },

  {
    id: 'quarter',
    eyebrow: 'Chapter Three',
    title: 'Finding Your Stride',
    when: (_p, ctx) => ctx.total > 0 && ctx.cleared >= Math.ceil(ctx.total * 0.25),
    beats: [
      {
        lines: [
          'A quarter of the realm. This is where most travellers turn back — not from difficulty, but from boredom.',
          'So here is the part the map does not show you: your score does not come from the landmarks you found easy. It comes from the handful you keep getting wrong.',
          'Open <b>Progress</b> when you have a moment. Your weakest topics are listed plainly. Ground already won is worth less than ground you keep slipping on.',
        ],
      },
    ],
  },

  {
    id: 'half',
    eyebrow: 'Chapter Four',
    title: 'The Long Middle',
    when: (_p, ctx) => ctx.total > 0 && ctx.cleared >= Math.ceil(ctx.total * 0.5),
    beats: [
      {
        lines: [
          'Halfway. The Summit is no longer a rumour — on a clear day you can see it from this ridge.',
          'A warning about the second half: it rewards <b>pace</b> as much as knowledge. Knowing an answer slowly is worth nothing on the day.',
          'When you feel ready, sit a single timed section at the Summit. Not the full trial — just one. It will tell you more about your timing than a week of untimed practice.',
        ],
      },
    ],
  },

  {
    id: 'all-cleared',
    eyebrow: 'Chapter Five',
    title: 'The Summit Opens',
    when: (_p, ctx) => ctx.total > 0 && ctx.cleared >= ctx.total,
    beats: [
      {
        lines: [
          'Every landmark. Every region. I did not say so at the start, but very few travellers reach this ridge.',
          'The citadel on the southern isle is lit for you. Inside waits the full trial: four sections, properly timed, no explanations until the end.',
          'It will not feel pleasant while you sit it. That is rather the point — it is the only honest measure of where you actually stand.',
        ],
      },
      {
        lines: [
          'Afterwards, read the report rather than the number. It names the topics that cost you, and those are your last few points.',
          'Go on. You know this road better than I do now.',
        ],
      },
    ],
  },

  {
    id: 'first-test',
    eyebrow: 'Chapter Six',
    title: 'What the Trial Said',
    when: (p) => p.testHistory.length >= 1,
    beats: [
      {
        lines: [
          'You sat the trial. However that felt, you know something now that you did not know this morning.',
          'A score is not a verdict. It is a reading. Take the topics it named, drill them, and sit another.',
          'That loop, repeated, is the whole craft. There is no other secret, and I have been at this a very long time.',
        ],
      },
    ],
  },
];

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
