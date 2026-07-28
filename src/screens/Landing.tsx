/* The landing page.

   This is the screen that already worked, so the structure is kept: pixel
   hero over the mountain scene, the three-step explainer, the feature list,
   a closing call to action. What changed is discipline — one type scale, one
   spacing rhythm, real section rhythm, and stats that come from the content
   library instead of hardcoded numbers that could drift out of date. */

import { LIBRARY_STATS, SECTIONS } from '@/content';
import { hrefFor, useNavigate } from '@/lib/router';
import { useStore } from '@/lib/store';
import { sfx } from '@/lib/sfx';
import { PixelScene } from '@/game/scene';
import { HeroSprite } from '@/game/heroes';
import { PixelIcon, type IconName } from '@/components/PixelIcon';
import { Button } from '@/components/ui';

const STEPS: { icon: IconName; title: string; detail: string }[] = [
  {
    icon: 'book',
    title: 'Learn',
    detail: 'Short, plain-English notes that teach exactly what the ACT asks — and nothing it does not.',
  },
  {
    icon: 'sword',
    title: 'Drill',
    detail: 'Work real questions zone by zone. Every choice is explained, not just the right one.',
  },
  {
    icon: 'trophy',
    title: 'Rank up',
    detail: 'Earn XP, clear bosses, and climb from Recruit all the way to a Perfect 36.',
  },
];

const FEATURES: { icon: IconName; title: string; detail: string }[] = [
  {
    icon: 'sword',
    title: `${LIBRARY_STATS.totalQuestions} questions`,
    detail: 'Every one written for the 2025+ Enhanced ACT, with an explanation for all four choices.',
  },
  {
    icon: 'map',
    title: `${LIBRARY_STATS.zones} zones across 4 paths`,
    detail: 'Climb English, Math, Reading and Science one skill at a time. Nothing unlocks by accident.',
  },
  {
    icon: 'book',
    title: `${LIBRARY_STATS.notePages} pages of notes`,
    detail: 'Rules, worked examples and the traps that cost people points, on a readable page.',
  },
  {
    icon: 'clock',
    title: 'Full-length, fully timed tests',
    detail: 'Real section timing and a scored report that tells you which topics to fix first.',
  },
  {
    icon: 'refresh',
    title: 'Spaced review',
    detail: 'Missed questions come back on a schedule until you actually own them.',
  },
  {
    icon: 'chart',
    title: 'Honest progress tracking',
    detail: 'Accuracy by topic, an estimated composite, and streaks that reward showing up.',
  },
];

export function Landing() {
  const navigate = useNavigate();
  const { continueAsGuest, progress } = useStore();
  const returning = progress.xp > 0;

  const startGuest = () => {
    sfx.achieve();
    continueAsGuest();
    navigate({ name: progress.profile ? 'home' : 'onboarding' });
  };

  return (
    <div className="min-h-screen">
      {/* ---------------------------------------------------------- top bar */}
      <header className="absolute inset-x-0 top-0 z-30">
        <div className="shell flex h-16 items-center">
          <span className="flex items-center gap-2.5 font-pixel text-[11px] uppercase text-white">
            <PixelIcon name="star" unit={2} />
            ACT Command
          </span>
          <div className="ml-auto flex items-center gap-2">
            <a href={hrefFor({ name: 'auth', mode: 'signin' })} onClick={() => sfx.select()}>
              <Button variant="ghost" size="sm">Sign in</Button>
            </a>
            <a href={hrefFor({ name: 'auth', mode: 'signup' })} onClick={() => sfx.select()}>
              <Button variant="primary" size="sm">Get started</Button>
            </a>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------- hero */}
      <section className="relative isolate flex min-h-[92vh] items-center overflow-hidden crt vignette">
        <PixelScene seed={7} className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-b from-ink-950/55 via-transparent to-ink-950" />

        <div className="shell relative z-10 pb-16 pt-24 text-center">
          <div className="mx-auto mb-7 flex w-fit items-center gap-2 rounded-full border-2 border-edge bg-ink-950/70 px-4 py-1.5 font-screen text-[10px] uppercase tracking-[0.18em] text-gold backdrop-blur">
            ★ The 2025+ Enhanced ACT
          </div>

          <h1
            className="font-pixel text-[clamp(30px,7.5vw,68px)] uppercase leading-[1.35] text-gold"
            style={{ textShadow: '0 0 30px rgba(255,210,62,.45), 5px 5px 0 #6b2d00' }}
          >
            <span className="block text-ember" style={{ textShadow: '0 0 30px rgba(255,157,92,.5), 5px 5px 0 #4a1508' }}>
              Command
            </span>
            the ACT
          </h1>

          <p className="mx-auto mt-7 max-w-xl font-digit text-[clamp(20px,3vw,28px)] leading-snug text-[#c8bde8]">
            A game you play. A 36 you earn.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <a href={hrefFor({ name: 'auth', mode: 'signup' })} onClick={() => sfx.select()}>
              <Button variant="primary" size="lg">▶ Start your climb</Button>
            </a>
            {returning && (
              <Button variant="ghost" size="lg" onClick={() => navigate({ name: 'home' })}>
                Continue
              </Button>
            )}
          </div>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-2.5">
            {[
              [LIBRARY_STATS.totalQuestions.toString(), 'questions'],
              [LIBRARY_STATS.zones.toString(), 'zones'],
              [LIBRARY_STATS.notePages.toString(), 'note pages'],
              ['∞', 'retries'],
            ].map(([value, label]) => (
              <span
                key={label}
                className="flex items-baseline gap-1.5 rounded-lg border-2 border-edge bg-ink-950/70 px-3 py-1.5 backdrop-blur"
              >
                <b className="num text-[19px] text-gold">{value}</b>
                <span className="font-screen text-[10px] uppercase tracking-wide text-[#a89ac6]">{label}</span>
              </span>
            ))}
          </div>

          <p className="mt-6 font-screen text-[11px] uppercase tracking-[0.14em] text-[#7a6a9e]">
            Free · No downloads · Runs anywhere
          </p>
        </div>

        {/* the hero, standing on the ridge */}
        <div className="absolute bottom-6 left-[8%] z-10 hidden sm:block">
          <HeroSprite hero="cadet" unit={5} />
        </div>
      </section>

      {/* ------------------------------------------------------------ steps */}
      <section className="shell py-20">
        <h2 className="heading-pixel mb-12 text-center text-[clamp(15px,2.6vw,22px)] text-white">
          How the climb works
        </h2>
        <div className="grid gap-5 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step.title} className="pixel-panel p-7">
              <div className="mb-5 font-screen text-[10px] uppercase tracking-[0.2em] text-[#7a6a9e]">
                Step {i + 1}
              </div>
              <PixelIcon name={step.icon} unit={4} className="mb-5" />
              <h3 className="heading-pixel mb-3 text-[13px] text-gold">{step.title}</h3>
              <p className="text-[15px] leading-relaxed text-[#a89ac6]">{step.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------------- sections */}
      <section className="shell pb-20">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SECTIONS.map((section) => (
            <div
              key={section.id}
              className="rounded-lg border-2 border-edge bg-ink-850 p-5 shadow-pixel"
              style={{ borderTopColor: section.color, borderTopWidth: 4 }}
            >
              <h3 className="heading-pixel text-[12px]" style={{ color: section.color }}>
                {section.name}
              </h3>
              <p className="mt-1 font-screen text-[10px] uppercase tracking-wide text-[#7a6a9e]">
                {section.questionCount} questions · {section.minutes} min
              </p>
              <p className="mt-3 text-[14px] leading-relaxed text-[#a89ac6]">{section.blurb}</p>
            </div>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------------- features */}
      <section className="border-y-2 border-edge bg-ink-950/60 py-20">
        <div className="shell">
          <h2 className="heading-pixel mb-4 text-center text-[clamp(15px,2.6vw,22px)] text-white">
            Not a prep book
          </h2>
          <p className="mx-auto mb-12 max-w-xl text-center text-[15px] leading-relaxed text-[#a89ac6]">
            Everything here exists because it moves a score. Nothing here exists to pad a page count.
          </p>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex gap-4">
                <PixelIcon name={f.icon} unit={3} className="mt-0.5" />
                <div>
                  <h3 className="font-screen text-[13px] uppercase tracking-wide text-white">{f.title}</h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-[#a89ac6]">{f.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- cta */}
      <section className="shell py-24 text-center">
        <h2 className="heading-pixel mb-8 text-[clamp(15px,2.6vw,22px)] text-white">Ready?</h2>
        <a href={hrefFor({ name: 'auth', mode: 'signup' })} onClick={() => sfx.select()}>
          <Button variant="primary" size="lg">Get started ▶</Button>
        </a>
        <p className="mt-6 text-[15px] text-[#a89ac6]">
          or{' '}
          <button
            type="button"
            onClick={startGuest}
            className="font-semibold text-cyan underline underline-offset-4 hover:text-white"
          >
            explore as a guest
          </button>{' '}
          — everything is open, progress stays on this device.
        </p>
      </section>

      <footer className="border-t-2 border-edge py-8 text-center font-screen text-[10px] uppercase tracking-[0.16em] text-[#5f5680]">
        ACT Command · Built for the Enhanced ACT
      </footer>
    </div>
  );
}
