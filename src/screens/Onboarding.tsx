/* Four questions, then a plan. Sets the target score, a weekly XP goal and
   which section to start with — all of which the dashboard reads later. */

import { useState } from 'react';
import { PATH_BY_ID, SECTION_BY_ID, SECTIONS } from '@/content';
import { useNavigate } from '@/lib/router';
import { useStore } from '@/lib/store';
import { sfx } from '@/lib/sfx';
import { cx } from '@/lib/utils';
import type { OnboardingProfile, SectionId } from '@/types';
import { PixelScene } from '@/game/scene';
import { HEROES, HeroSprite } from '@/game/heroes';
import { Button, ProgressBar } from '@/components/ui';
import { burstConfetti } from '@/components/Feedback';

interface Step {
  key: keyof Omit<OnboardingProfile, 'savedAt'>;
  question: string;
  detail: string;
  options: { label: string; value: string | number }[];
}

const STEPS: Step[] = [
  {
    key: 'when',
    question: 'When do you take the ACT?',
    detail: 'This sets how hard we push your weekly goal.',
    options: [
      { label: 'Within a month', value: 'soon' },
      { label: '1–3 months', value: 'mid' },
      { label: '3+ months', value: 'far' },
      { label: 'Not scheduled yet', value: 'none' },
    ],
  },
  {
    key: 'before',
    question: 'Have you taken it before?',
    detail: 'Where you are starting from changes where we start you.',
    options: [
      { label: 'First time', value: 'first' },
      { label: 'Yes — below 20', value: 'b20' },
      { label: 'Yes — 20 to 27', value: 'b27' },
      { label: 'Yes — 28 or higher', value: 'b28' },
    ],
  },
  {
    key: 'target',
    question: 'What score are you going for?',
    detail: 'You can change this any time from your profile.',
    options: [
      { label: '24', value: 24 },
      { label: '30', value: 30 },
      { label: '33', value: 33 },
      { label: '36', value: 36 },
    ],
  },
  {
    key: 'fear',
    question: 'Which section worries you most?',
    detail: 'We will point you there first.',
    options: SECTIONS.map((s) => ({ label: s.name, value: s.id })),
  },
];

const WEEKLY_GOAL: Record<string, number> = { soon: 2400, mid: 1800, far: 1200, none: 900 };

export function Onboarding() {
  const navigate = useNavigate();
  const { updateProgress, progress } = useStore();

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [phase, setPhase] = useState<'questions' | 'hero' | 'plan'>('questions');
  const [hero, setHero] = useState(progress.hero || 'cadet');

  const choose = (value: string | number) => {
    sfx.select();
    const next = { ...answers, [STEPS[step].key]: value };
    setAnswers(next);
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      setPhase('hero');
    }
  };

  const confirmHero = (id: string) => {
    sfx.achieve();
    setHero(id);
    burstConfetti(70);

    const profile: OnboardingProfile = {
      when: (answers.when as OnboardingProfile['when']) ?? 'none',
      before: (answers.before as OnboardingProfile['before']) ?? 'first',
      target: (answers.target as number) ?? 30,
      fear: (answers.fear as SectionId) ?? 'english',
      savedAt: Date.now(),
    };

    updateProgress((p) => ({
      ...p,
      profile,
      hero: id,
      targetScore: profile.target,
      weeklyGoal: WEEKLY_GOAL[profile.when] ?? 1200,
    }));
    setPhase('plan');
  };

  const fear = (answers.fear as SectionId) ?? 'english';
  const recommended = SECTION_BY_ID[fear];
  const firstZone = PATH_BY_ID[fear]?.nodes[0];

  return (
    <div className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-4 py-14 crt vignette">
      <PixelScene seed={29} className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-0 bg-ink-950/72" />

      <div className="pixel-panel relative z-10 w-full max-w-lg p-7 sm:p-9">
        {phase === 'questions' && (
          <>
            <div className="mb-6">
              <div className="mb-2 flex items-center justify-between font-screen text-[10px] uppercase tracking-[0.14em] text-[#8f86b5]">
                <span>Question {step + 1} of {STEPS.length}</span>
                <span>{Math.round(((step + 1) / STEPS.length) * 100)}%</span>
              </div>
              <ProgressBar value={(step + 1) / STEPS.length} height={8} />
            </div>

            <h1 className="heading-pixel mb-2.5 text-[14px] leading-[1.6] text-white">
              {STEPS[step].question}
            </h1>
            <p className="mb-7 text-[14px] leading-relaxed text-[#8f86b5]">{STEPS[step].detail}</p>

            <div className="grid gap-2.5">
              {STEPS[step].options.map((opt) => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => choose(opt.value)}
                  className="rounded-lg border-2 border-edge bg-ink-800 px-4 py-3.5 text-left text-[15px] text-[#e0e4f8] transition-colors hover:border-gold hover:bg-ink-750 hover:text-white"
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="mt-6 font-screen text-[11px] uppercase tracking-wide text-[#6f6496] transition-colors hover:text-white"
              >
                ← Back
              </button>
            )}
          </>
        )}

        {phase === 'hero' && (
          <>
            <h1 className="heading-pixel mb-2.5 text-center text-[14px] text-white">Choose your character</h1>
            <p className="mb-7 text-center text-[14px] text-[#8f86b5]">Purely cosmetic. Pick the one you like.</p>

            <div className="grid grid-cols-2 gap-3">
              {HEROES.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => confirmHero(h.id)}
                  className={cx(
                    'rounded-lg border-2 bg-ink-800 px-4 py-5 text-center transition-all hover:-translate-y-1',
                    hero === h.id ? 'border-gold' : 'border-edge hover:border-edge-bright',
                  )}
                >
                  <HeroSprite hero={h} unit={6} className="mx-auto" />
                  <div className="mt-4 font-pixel text-[10px] uppercase text-gold">{h.name}</div>
                  <div className="mt-2 font-digit text-[15px] leading-tight text-[#a89ac6]">{h.desc}</div>
                </button>
              ))}
            </div>
          </>
        )}

        {phase === 'plan' && (
          <div className="text-center">
            <HeroSprite hero={hero} unit={6} className="mx-auto" />
            <h1 className="heading-pixel mb-6 mt-6 text-[14px] text-gold">Your plan is ready</h1>

            <dl className="space-y-2.5 text-left">
              <PlanRow label="Target score" value={String(answers.target ?? 30)} color="#ff9d5c" />
              <PlanRow
                label="Weekly XP goal"
                value={(WEEKLY_GOAL[answers.when as string] ?? 1200).toLocaleString()}
                color="#3ad6f0"
              />
              <PlanRow label="Start with" value={recommended?.name ?? 'English'} color={recommended?.color} />
            </dl>

            <p className="mt-6 text-[14px] leading-relaxed text-[#8f86b5]">
              First stop: <b className="text-white">{firstZone?.name}</b>. Read the lesson, clear the quiz,
              then keep climbing.
            </p>

            <Button
              variant="primary"
              size="lg"
              className="mt-7 w-full"
              onClick={() => navigate({ name: 'home' }, { replace: true })}
            >
              Enter base camp ▶
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function PlanRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border-2 border-edge bg-ink-900 px-4 py-3">
      <dt className="font-screen text-[11px] uppercase tracking-wide text-[#8f86b5]">{label}</dt>
      <dd className="num text-[19px]" style={{ color: color ?? '#ffd23e' }}>
        {value}
      </dd>
    </div>
  );
}
