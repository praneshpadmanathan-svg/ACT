/* The landing page.

   Keeps the shape that worked — pixel-art hero, promise, features, steps,
   closing CTA — but rebuilt in the fantasy register with real typography and
   spacing, and with numbers pulled from the content library rather than
   hardcoded copy that can drift out of date. */

import { LIBRARY_STATS, SECTIONS } from '@/content';
import { hrefFor, useNavigate } from '@/lib/router';
import { useStore } from '@/lib/store';
import { sfx } from '@/lib/sfx';
import { Button } from '@/components/ui';
import { REGIONS } from '@/game/mapData';

const FEATURES: { title: string; detail: string }[] = [
  {
    title: 'Four regions to cross',
    detail:
      'English, Reading, Math and Science, each a road of skill landmarks across a painted world. Nothing unlocks by accident.',
  },
  {
    title: `${LIBRARY_STATS.totalQuestions} questions, every choice explained`,
    detail:
      'Know why the right answer is right — and exactly why each of the other three is wrong.',
  },
  {
    title: `${LIBRARY_STATS.notePages} lessons in the library`,
    detail:
      'Short pages that teach one idea at a time: the rule, a worked example, and the trap that costs people points.',
  },
  {
    title: 'A guide who knows the road',
    detail:
      'Wizzy points you at the next landmark, and tells you what it will teach before you commit.',
  },
  {
    title: 'Misses come back',
    detail:
      'Anything you get wrong returns a day later, then three, then a week, until you genuinely own it.',
  },
  {
    title: 'The Summit measures you',
    detail:
      'A full, properly timed mock test and a scored report that names the topics costing you points.',
  },
];

const STEPS = [
  { n: '1', title: 'Learn', detail: 'A short lesson teaches the skill at one landmark.' },
  { n: '2', title: 'Prove it', detail: 'Clear the quiz at 70% to open the road ahead.' },
  { n: '3', title: 'Climb', detail: 'Earn XP, rise through the ranks, and reach the Summit.' },
];

export function Landing() {
  const navigate = useNavigate();
  const { continueAsGuest, progress } = useStore();
  const returning = progress.xp > 0;

  const begin = () => {
    sfx.achieve();
    continueAsGuest();
    navigate({ name: progress.profile ? 'home' : 'onboarding' });
  };

  return (
    <div className="min-h-screen">
      <header className="absolute inset-x-0 top-0 z-30">
        <div className="shell flex h-16 items-center">
          <span className="flex items-center gap-2 font-display text-[16px] font-semibold tracking-wide text-parchment">
            <span className="text-gold" aria-hidden="true">✦</span> ACT Command
          </span>
          <div className="ml-auto flex items-center gap-2">
            <a href={hrefFor({ name: 'auth', mode: 'signin' })} onClick={() => sfx.select()}>
              <Button size="sm">Sign in</Button>
            </a>
            <Button variant="primary" size="sm" onClick={begin}>
              Begin
            </Button>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------- hero */}
      <section className="relative isolate flex min-h-[94vh] items-center overflow-hidden">
        <img
          src="/art/landing-hero.webp"
          alt=""
          className="absolute inset-0 h-full w-full select-none object-cover"
          draggable={false}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-leather-950/72 via-leather-950/45 to-leather-950" />

        <div className="shell relative z-10 pb-20 pt-28 text-center">
          <div className="eyebrow mb-5">✦ The 2025+ Enhanced ACT</div>

          <h1 className="heading text-[clamp(2.4rem,7vw,4.4rem)] leading-[1.1] text-parchment-light">
            Your climb to 36
            <span className="mt-1 block text-gold-bright">starts here.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl font-read text-[clamp(1.05rem,2vw,1.3rem)] leading-relaxed text-parchment-dim">
            Cross four regions, master every skill the test asks for, and work{' '}
            {LIBRARY_STATS.totalQuestions} real questions where every answer is explained.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button variant="primary" size="lg" onClick={begin}>
              Enter the realm ▸
            </Button>
            {returning && (
              <Button size="lg" onClick={() => navigate({ name: 'home' })}>
                Continue your quest
              </Button>
            )}
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-2.5">
            {[
              [LIBRARY_STATS.totalQuestions.toLocaleString(), 'questions'],
              ['4', 'regions'],
              [String(LIBRARY_STATS.zones), 'skill zones'],
              ['100%', 'free'],
            ].map(([value, label]) => (
              <span key={label} className="chip bg-leather-900/70 backdrop-blur">
                <b className="num text-[15px] text-gold">{value}</b> {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- regions */}
      <section className="shell py-20">
        <h2 className="heading mb-3 text-center text-[clamp(1.5rem,3.2vw,2rem)]">
          Four regions, one road
        </h2>
        <p className="mx-auto mb-12 max-w-xl text-center font-read text-[15.5px] leading-relaxed text-parchment-dim">
          Every landmark on the map is one ACT skill. Clear it to open the next.
        </p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SECTIONS.map((section) => {
            const region = REGIONS[section.id];
            return (
              <div
                key={section.id}
                className="panel-lit p-6"
                style={{ borderTopColor: region.color, borderTopWidth: 3 }}
              >
                <h3 className="heading text-[17px]" style={{ color: region.color }}>
                  {region.title}
                </h3>
                <p className="label-sm mt-1">{section.name}</p>
                <p className="mt-3 font-read text-[14.5px] leading-relaxed text-parchment-dim">
                  {section.blurb}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* -------------------------------------------------------- features */}
      <section className="border-y border-leather-700 bg-leather-950/50 py-20">
        <div className="shell">
          <h2 className="heading mb-12 text-center text-[clamp(1.5rem,3.2vw,2rem)]">
            Everything you need to hit your target
          </h2>
          <div className="grid gap-x-8 gap-y-9 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title}>
                <h3 className="heading text-[16px] text-gold-light">{f.title}</h3>
                <p className="mt-2 font-read text-[14.5px] leading-relaxed text-parchment-dim">
                  {f.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- steps */}
      <section className="shell py-20">
        <h2 className="heading mb-12 text-center text-[clamp(1.5rem,3.2vw,2rem)]">How it works</h2>
        <div className="grid gap-5 md:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.n} className="panel p-7 text-center">
              <div
                className="num mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full
                           border-2 border-gold-deep bg-leather-800 text-[19px] text-gold"
              >
                {step.n}
              </div>
              <h3 className="heading text-[17px] text-parchment">{step.title}</h3>
              <p className="mt-2 font-read text-[14.5px] leading-relaxed text-parchment-dim">
                {step.detail}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------- cta */}
      <section className="shell pb-24 text-center">
        <div className="panel-lit mx-auto max-w-2xl px-8 py-14">
          <h2 className="heading text-[clamp(1.5rem,3.2vw,2rem)] text-parchment-light">
            Ready to set out?
          </h2>
          <p className="mx-auto mt-3 max-w-md font-read text-[15.5px] leading-relaxed text-parchment-dim">
            Free, no downloads, and your progress saves as you go.
          </p>
          <Button variant="primary" size="lg" className="mt-8" onClick={begin}>
            Begin your quest ▸
          </Button>
          <p className="mt-5 font-read text-[14px] text-ink-faint">
            Or{' '}
            <a
              href={hrefFor({ name: 'auth', mode: 'signup' })}
              onClick={() => sfx.select()}
              className="text-gold underline underline-offset-4 hover:text-gold-bright"
            >
              create an account
            </a>{' '}
            to carry your progress between devices.
          </p>
        </div>
      </section>

      <footer className="border-t border-leather-700 py-8 text-center font-script text-[12px] uppercase tracking-[0.2em] text-ink-faint">
        ACT Command · Built for the Enhanced ACT
      </footer>
    </div>
  );
}
