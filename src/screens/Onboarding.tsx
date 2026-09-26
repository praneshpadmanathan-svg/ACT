/* Four questions, then a plan. Sets the target score, a weekly XP goal and
   which section to start with — all of which the dashboard reads later. */

import { useState } from 'react';
import { SECTION_BY_ID, SECTIONS } from '@/content/sections';
import { useNavigate } from '@/lib/router';
import { useStore } from '@/lib/store';
import { goalForTiming } from '@/lib/plan';
import { sfx } from '@/lib/sfx';
import type { OnboardingProfile, SectionId } from '@/types';
import { Button, ProgressBar } from '@/components/ui';
import { Glyph } from '@/components/Icon';
import { burstConfetti } from '@/components/Feedback';
import { DateField } from '@/components/fields';
import { Art } from '@/components/Art';
import { HeroSprite } from '@/game/HeroSprite';
import { HeroChooser } from '@/game/HeroChooser';

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
    detail: 'We use this to suggest a weekly goal. You can change it later.',
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
    detail: 'A little context for your study plan.',
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
    question: 'Which section would you like to start with?',
    detail: 'We will point you there first.',
    options: SECTIONS.map((s) => ({ label: s.name, value: s.id })),
  },
];

export function Onboarding() {
  const navigate = useNavigate();
  const { progress, updateProgress } = useStore();

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [testDate, setTestDate] = useState('');
  const [phase, setPhase] = useState<'questions' | 'date' | 'hero' | 'plan'>('questions');

  /* `step` only ever moves within STEPS, but the index type cannot know that
     and the four reads below would each have to say so separately. */
  const current = STEPS[step] ?? STEPS[0]!;

  const thisYear = new Date().getFullYear();

  const choose = (value: string | number) => {
    sfx.select();
    const next = { ...answers, [current.key]: value };
    setAnswers(next);
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      /* One more question, and only for people who have a date to give. If the
         test is not booked there is nothing to count down to, and asking would
         just be a field they have to dismiss. */
      const when = next.when as OnboardingProfile['when'];
      setPhase(when === 'none' ? 'hero' : 'date');
    }
  };

  const savePlan = (final: Record<string, string | number>, date: string | null) => {
    sfx.achieve();
    burstConfetti(70);

    const profile: OnboardingProfile = {
      when: (final.when as OnboardingProfile['when']) ?? 'none',
      before: (final.before as OnboardingProfile['before']) ?? 'first',
      target: (final.target as number) ?? 30,
      fear: (final.fear as SectionId) ?? 'english',
      testDate: date,
      savedAt: Date.now(),
    };

    updateProgress((p) => ({
      ...p,
      profile,
      startRegion: p.startRegion ?? profile.fear,
      targetScore: profile.target,
      weeklyGoal: goalForTiming(profile.when),
    }));
    setPhase('plan');
  };

  const fear = (answers.fear as SectionId) ?? 'english';
  const recommended = SECTION_BY_ID[fear];

  return (
    <div className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden px-4 py-14 ">
      <Art
        name="camp-bg"
        priority
        className="absolute inset-0 h-full w-full select-none object-cover"
      />
      <div className="absolute inset-0 bg-leather-950/85" />

      <div className="panel-lit relative z-10 w-full max-w-lg p-7 sm:p-9">
        <button
          type="button"
          className="mb-5 text-sm text-gold underline underline-offset-4"
          onClick={() => navigate({ name: 'landing' })}
        >
          Back to the website
        </button>
        <p className="mb-4 text-sm text-parchment-dim">
          Your plan, then your character. You can change both later.
        </p>
        {phase === 'questions' && (
          <>
            <div className="mb-6">
              <div className="mb-2 flex items-center justify-between font-script text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                <span>
                  Question {step + 1} of {STEPS.length}
                </span>
                <span>{Math.round(((step + 1) / STEPS.length) * 100)}%</span>
              </div>
              <ProgressBar value={(step + 1) / STEPS.length} height={8} />
            </div>

            <h1 className="heading mb-2.5 text-[22px] leading-snug text-parchment">
              {current.question}
            </h1>
            <p className="mb-7 text-[14px] leading-relaxed text-ink-faint">{current.detail}</p>

            <div className="grid gap-2.5">
              {current.options.map((opt) => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => choose(opt.value)}
                  className="rounded-lg border-2 border-leather-700 bg-leather-800 px-4 py-3.5 text-left text-[15px] text-parchment transition-colors hover:border-gold hover:bg-leather-750 hover:text-parchment"
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="mt-6 inline-flex items-center gap-1.5 font-script text-[11px] uppercase tracking-wide text-ink-faint transition-colors hover:text-parchment"
              >
                <Glyph name="arrowLeft" size={13} strokeWidth={2} />
                Back
              </button>
            )}
          </>
        )}

        {phase === 'date' && (
          <>
            <h1 className="heading mb-2.5 text-[22px] leading-snug text-parchment">
              What day do you sit it?
            </h1>
            <p className="mb-7 text-[14px] leading-relaxed text-ink-faint">
              We will count down and size your week to fit. You can change or clear it later.
            </p>

            <div className="block">
              <span className="mb-2 block font-script text-[12px] uppercase tracking-[0.16em] text-ink-faint">
                Test date
              </span>
              {/* The native date input's `min` is gone with it, so the year
                  list starts at the current year instead — a test date in the
                  past is the only thing that needed excluding, and a shorter
                  list of plausible years does it without a validation
                  message. */}
              <DateField
                value={testDate}
                onChange={setTestDate}
                fromYear={thisYear}
                toYear={thisYear + 2}
                ariaPrefix="Test date"
              />
            </div>

            <Button
              variant="primary"
              size="lg"
              trailing
              className="mt-7 w-full"
              onClick={() => setPhase('hero')}
            >
              {testDate ? 'Next' : 'Skip for now'}
            </Button>

            <button
              type="button"
              onClick={() => setPhase('questions')}
              className="mt-6 inline-flex items-center gap-1.5 font-script text-[11px] uppercase tracking-wide text-ink-faint transition-colors hover:text-parchment"
            >
              <Glyph name="arrowLeft" size={12} strokeWidth={2} />
              Back
            </button>
          </>
        )}

        {/* Asked here rather than left to be discovered in the profile screen.
            A student who never opens Stats never learns the traveller is
            theirs to pick, and by then they have already spent an hour
            watching somebody else walk the map. It is skippable — Ash is a
            fine default and nobody should be made to answer a question about
            what they look like before they can start. */}
        {phase === 'hero' && (
          <>
            <h1 className="heading mb-2.5 text-[22px] leading-snug text-parchment">
              Who is walking the roads?
            </h1>
            <p className="mb-7 text-[14px] leading-relaxed text-ink-faint">
              This is you, on every road and in every duel. Change it whenever you like.
            </p>

            <HeroChooser />

            <Button
              variant="primary"
              size="lg"
              trailing
              className="mt-7 w-full"
              onClick={() => savePlan(answers, testDate || null)}
            >
              Build my plan
            </Button>

            <button
              type="button"
              onClick={() => setPhase(answers.when === 'none' ? 'questions' : 'date')}
              className="mt-6 inline-flex items-center gap-1.5 font-script text-[11px] uppercase tracking-wide text-ink-faint transition-colors hover:text-parchment"
            >
              <Glyph name="arrowLeft" size={12} strokeWidth={2} />
              Back
            </button>
          </>
        )}

        {phase === 'plan' && (
          <div className="text-center">
            <HeroSprite
              hero={progress.hero}
              height={132}
              className="mx-auto select-none animate-bobHero"
            />
            <h1 className="heading mb-6 mt-5 text-[22px] text-gold">Your plan is ready</h1>

            <dl className="space-y-2.5 text-left">
              <PlanRow
                label="Target score"
                value={String(answers.target ?? 30)}
                color="oklch(var(--c-desert-text))"
              />
              <PlanRow
                label="Questions a week"
                value={String(goalForTiming((answers.when as OnboardingProfile['when']) ?? 'none'))}
                color="oklch(var(--c-cliffs-text))"
              />
              {testDate && (
                <PlanRow
                  label="Days to go"
                  value={String(
                    Math.max(
                      0,
                      Math.round(
                        (new Date(`${testDate}T00:00:00`).getTime() -
                          new Date().setHours(0, 0, 0, 0)) /
                          86_400_000,
                      ),
                    ),
                  )}
                  color="oklch(var(--c-gold))"
                />
              )}
              <PlanRow
                label="Start with"
                value={recommended?.name ?? 'English'}
                color={recommended?.color}
              />
            </dl>

            <p className="mt-6 text-[14px] leading-relaxed text-ink-faint">
              Start with your chosen subject. Wizzy can introduce the realm along the way; you can
              skip the story and begin studying immediately.
            </p>

            {/* Straight to the road, not to camp.

                The story plays where the landmarks are, so sending a brand-new
                player to the camp dashboard meant they arrived to an empty
                screen with no greeting at all — they had to know to click
                "Study" before anything spoke to them. Finishing onboarding now
                opens the world and Wizzy's prologue runs immediately. */}
            <Button
              variant="primary"
              size="lg"
              trailing
              className="mt-7 w-full"
              onClick={() => navigate({ name: 'path', section: fear }, { replace: true })}
            >
              Set out
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function PlanRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border-2 border-leather-700 bg-leather-900 px-4 py-3">
      <dt className="font-script text-[11px] uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="num text-[19px]" style={{ color: color ?? 'oklch(var(--c-gold))' }}>
        {value}
      </dd>
    </div>
  );
}
