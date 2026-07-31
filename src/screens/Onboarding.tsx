/* Four questions, then a plan. Sets the target score, a weekly XP goal and
   which section to start with — all of which the dashboard reads later. */

import { useState } from 'react';
import { SECTION_BY_ID, SECTIONS } from '@/content';
import { useNavigate } from '@/lib/router';
import { useStore } from '@/lib/store';
import { goalForTiming } from '@/lib/plan';
import { sfx } from '@/lib/sfx';
import type { OnboardingProfile, SectionId } from '@/types';
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

export function Onboarding() {
  const navigate = useNavigate();
  const { updateProgress } = useStore();

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [testDate, setTestDate] = useState('');
  const [phase, setPhase] = useState<'questions' | 'date' | 'plan'>('questions');

  const choose = (value: string | number) => {
    sfx.select();
    const next = { ...answers, [STEPS[step].key]: value };
    setAnswers(next);
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      /* One more question, and only for people who have a date to give. If the
         test is not booked there is nothing to count down to, and asking would
         just be a field they have to dismiss. */
      const when = next.when as OnboardingProfile['when'];
      if (when === 'none') savePlan(next, null);
      else setPhase('date');
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
      targetScore: profile.target,
      weeklyGoal: goalForTiming(profile.when),
    }));
    setPhase('plan');
  };

  const fear = (answers.fear as SectionId) ?? 'english';
  const recommended = SECTION_BY_ID[fear];

  return (
    <div className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden px-4 py-14 ">
      <img src="/art/camp-bg.webp" alt="" className="absolute inset-0 h-full w-full select-none object-cover" draggable={false} />
      <div className="absolute inset-0 bg-leather-950/84" />

      <div className="panel-lit relative z-10 w-full max-w-lg p-7 sm:p-9">
        {phase === 'questions' && (
          <>
            <div className="mb-6">
              <div className="mb-2 flex items-center justify-between font-script text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                <span>Question {step + 1} of {STEPS.length}</span>
                <span>{Math.round(((step + 1) / STEPS.length) * 100)}%</span>
              </div>
              <ProgressBar value={(step + 1) / STEPS.length} height={8} />
            </div>

            <h1 className="heading mb-2.5 text-[22px] leading-snug text-parchment">
              {STEPS[step].question}
            </h1>
            <p className="mb-7 text-[14px] leading-relaxed text-ink-faint">{STEPS[step].detail}</p>

            <div className="grid gap-2.5">
              {STEPS[step].options.map((opt) => (
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
                className="mt-6 font-script text-[11px] uppercase tracking-wide text-ink-faint transition-colors hover:text-parchment"
              >
                ← Back
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

            <label className="block">
              <span className="mb-2 block font-script text-[12px] uppercase tracking-[0.16em] text-ink-faint">
                Test date
              </span>
              <input
                type="date"
                value={testDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setTestDate(e.target.value)}
                className="w-full rounded-lg border-2 border-leather-700 bg-leather-900 px-4 py-3 font-read text-[15px] text-parchment outline-none transition-colors focus:border-gold-deep"
              />
            </label>

            <Button
              variant="primary"
              size="lg"
              className="mt-7 w-full"
              onClick={() => savePlan(answers, testDate || null)}
            >
              {testDate ? 'Build my plan ▶' : 'Skip for now ▶'}
            </Button>

            <button
              type="button"
              onClick={() => setPhase('questions')}
              className="mt-6 font-script text-[11px] uppercase tracking-wide text-ink-faint transition-colors hover:text-parchment"
            >
              ← Back
            </button>
          </>
        )}

        {phase === 'plan' && (
          <div className="text-center">
            <img src="/art/hero-char.webp" alt="" className="mx-auto w-[110px] select-none" draggable={false} />
            <h1 className="heading mb-6 mt-5 text-[22px] text-gold">Your plan is ready</h1>

            <dl className="space-y-2.5 text-left">
              <PlanRow label="Target score" value={String(answers.target ?? 30)} color="#ff9d5c" />
              <PlanRow
                label="Questions a week"
                value={String(goalForTiming((answers.when as OnboardingProfile['when']) ?? 'none'))}
                color="#3ad6f0"
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
                  color="#ffd23e"
                />
              )}
              <PlanRow label="Start with" value={recommended?.name ?? 'English'} color={recommended?.color} />
            </dl>

            <p className="mt-6 text-[14px] leading-relaxed text-ink-faint">
              Wizzy is waiting at the edge of the map. He will tell you what has happened to the
              realm, and then you choose which road to walk first.
            </p>

            {/* Straight to the map, not to camp.

                The story plays on the map, so sending a brand-new player to the
                camp dashboard meant they arrived to an empty screen with no
                greeting at all — they had to know to click "Map" before
                anything spoke to them. Finishing onboarding now opens the world
                and Wizzy's prologue runs immediately. */}
            <Button
              variant="primary"
              size="lg"
              className="mt-7 w-full"
              onClick={() => navigate({ name: 'map' }, { replace: true })}
            >
              Set out ▶
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
      <dd className="num text-[19px]" style={{ color: color ?? '#ffd23e' }}>
        {value}
      </dd>
    </div>
  );
}
