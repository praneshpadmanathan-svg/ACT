/* The landing page.

   Keeps the shape that worked — pixel-art hero, promise, features, steps,
   closing CTA — but rebuilt in the fantasy register with real typography and
   spacing, and with numbers pulled from the content library rather than
   hardcoded copy that can drift out of date.

   Everything below the hero sits on a veil: a semi-transparent slab that lets
   the page's warm texture through but gives the type a surface to sit on.
   Before that, body copy floated directly on a dark expanse, and the sections
   with no card at all — the feature list especially — were the hardest thing
   on the page to read. */

import type { ReactNode } from 'react';

import { LIBRARY_STATS, PATH_BY_ID, SECTIONS } from '@/content';
import { hrefFor, useNavigate } from '@/lib/router';
import { useStore } from '@/lib/store';
import { sfx } from '@/lib/sfx';
import { cx } from '@/lib/utils';
import { Button } from '@/components/ui';
import { NavGlyph, type GlyphName } from '@/components/NavGlyph';
import { REGIONS } from '@/game/mapData';
import type { SectionId } from '@/types';

/* ------------------------------------------------------------- highlighting

   Body copy stays calm parchment. Only the load-bearing word takes colour, and
   the colour means something: region hues for the four roads, gold for what you
   earn, red for what the test costs you. Every one of these is a text-safe
   variant measured at 6:1 or better against the veil — the raw region fills are
   mixed for the painted map and several fail as type. */

type Tone = 'gold' | 'cream' | 'woods' | 'sea' | 'sand' | 'blood';

const TONE: Record<Tone, string> = {
  gold: 'text-gold-light',
  cream: 'text-parchment-light',
  woods: 'text-woods-text',
  sea: 'text-cliffs-text',
  sand: 'text-desert-text',
  blood: 'text-blood-text',
};

function Hl({ tone = 'gold', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cx('hl', TONE[tone])}>{children}</span>;
}

/* Region hues, lifted for type. The raw map colours are used for each card's
   top edge — as *text* the canyon rust measured 4.60:1, which passes but is the
   tightest thing on the page. These are the same hues one step brighter. */
const REGION_TEXT: Record<SectionId, string> = {
  english: '#e9bd63',
  reading: '#7cc98a',
  math: '#e89463',
  science: '#79c0ea',
};

/* A rule broken by a diamond, under every section heading. */
function Ornament() {
  return (
    <div className="orn my-6" aria-hidden="true">
      <span className="text-[10px] leading-none text-gold">✦</span>
    </div>
  );
}

/* A heading, its ornament, and one line of intro on a thin veil. */
function SectionIntro({ title, lead }: { title: ReactNode; lead: ReactNode }) {
  return (
    <div className="mb-11 text-center">
      <h2 className="heading text-balance text-[clamp(1.5rem,3.2vw,2rem)] text-parchment-light">
        {title}
      </h2>
      <Ornament />
      <p
        className="veil-thin mx-auto max-w-xl px-5 py-3 font-read text-[15.5px]
                   leading-relaxed text-parchment-dim"
      >
        {lead}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------- content */

const FEATURES: { id: string; glyph: GlyphName; title: ReactNode; detail: ReactNode }[] = [
  {
    id: 'regions',
    glyph: 'map',
    title: 'Four regions to cross',
    detail: (
      <>
        English, Reading, Math and Science, each a road of{' '}
        <Hl tone="cream">skill landmarks</Hl> across a painted world.{' '}
        <Hl tone="gold">Nothing unlocks by accident.</Hl>
      </>
    ),
  },
  {
    id: 'questions',
    glyph: 'sword',
    title: (
      <>
        <Hl>{LIBRARY_STATS.totalQuestions.toLocaleString()}</Hl> questions, every choice explained
      </>
    ),
    detail: (
      <>
        Know why the right answer is <Hl tone="woods">right</Hl> — and exactly why each of the other
        three is <Hl tone="blood">wrong</Hl>.
      </>
    ),
  },
  {
    id: 'lessons',
    glyph: 'book',
    title: (
      <>
        <Hl>{LIBRARY_STATS.notePages}</Hl> lessons in the library
      </>
    ),
    detail: (
      <>
        Short pages that teach <Hl tone="cream">one idea at a time</Hl>: the rule, a worked example,
        and the <Hl tone="blood">trap</Hl> that costs people points.
      </>
    ),
  },
  {
    id: 'guide',
    glyph: 'star',
    title: 'A guide who knows the road',
    detail: (
      <>
        <Hl tone="sea">Wizzy</Hl> points you at the next landmark, and tells you what it will teach{' '}
        <Hl tone="cream">before</Hl> you commit.
      </>
    ),
  },
  {
    id: 'review',
    glyph: 'hourglass',
    title: 'Misses come back',
    detail: (
      <>
        Anything you get wrong returns <Hl tone="sand">a day</Hl> later, then{' '}
        <Hl tone="sand">three</Hl>, then <Hl tone="sand">a week</Hl>, until you genuinely own it.
      </>
    ),
  },
  {
    id: 'summit',
    glyph: 'crown',
    title: 'The Summit measures you',
    detail: (
      <>
        A full, <Hl tone="cream">properly timed</Hl> mock test and a scored report that{' '}
        <Hl>names the topics</Hl> costing you points.
      </>
    ),
  },
];

const STEPS: { n: string; title: string; detail: ReactNode }[] = [
  {
    n: '1',
    title: 'Learn',
    detail: (
      <>
        A short lesson teaches <Hl tone="cream">one skill</Hl> at one landmark.
      </>
    ),
  },
  {
    n: '2',
    title: 'Prove it',
    detail: (
      <>
        Clear the quiz at <Hl tone="woods">70%</Hl> to open the road ahead.
      </>
    ),
  },
  {
    n: '3',
    title: 'Climb',
    detail: (
      <>
        Earn <Hl>XP</Hl>, rise through seven ranks, and reach the <Hl tone="cream">Summit</Hl>.
      </>
    ),
  },
];

/* ---------------------------------------------------------------------- page */

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
    <div className="min-h-dvh">
      <header className="absolute inset-x-0 top-0 z-30">
        <div className="shell flex h-16 items-center">
          <span className="flex items-center gap-2 font-display text-[16px] font-semibold tracking-wide text-parchment">
            <span className="text-gold" aria-hidden="true">✦</span> ACT Command
          </span>
          <div className="ml-auto flex items-center gap-2">
            <a href={hrefFor({ name: 'auth', mode: 'signin' })} onClick={() => sfx.select()}>
              <Button size="sm">Sign in</Button>
            </a>
            {returning ? (
              <Button variant="primary" size="sm" onClick={() => navigate({ name: 'home' })}>
                Continue
              </Button>
            ) : (
              <Button variant="primary" size="sm" onClick={begin}>
                Begin
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------- hero */}
      <section className="relative isolate flex min-h-[94dvh] items-center overflow-hidden">
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

          {/* The hero keeps its open composition — no veil over the artwork.
              Only the colour highlighting carries down from here. */}
          <p className="mx-auto mt-6 max-w-2xl font-read text-[clamp(1.05rem,2vw,1.3rem)] leading-relaxed text-parchment-dim">
            Cross <Hl tone="cream">four regions</Hl>, master every skill the test asks for, and work{' '}
            <Hl>{LIBRARY_STATS.totalQuestions.toLocaleString()}</Hl> real questions where{' '}
            <Hl tone="cream">every answer is explained</Hl>.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            {returning ? (
              <>
                <Button variant="primary" size="lg" onClick={() => navigate({ name: 'home' })}>
                  Continue your quest ▸
                </Button>
                <a href={hrefFor({ name: 'map' })} onClick={() => sfx.select()}>
                  <Button size="lg">Open the map</Button>
                </a>
              </>
            ) : (
              <>
                <Button variant="primary" size="lg" onClick={begin}>
                  Enter the realm ▸
                </Button>
                <a href={hrefFor({ name: 'auth', mode: 'signin' })} onClick={() => sfx.select()}>
                  <Button size="lg">I have an account</Button>
                </a>
              </>
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
        <SectionIntro
          title={
            <>
              Four regions, <span className="text-gold-bright">one road</span>
            </>
          }
          lead={
            <>
              Every landmark on the map is <Hl tone="cream">one ACT skill</Hl>. Clear it to open the
              next.
            </>
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SECTIONS.map((section) => {
            const region = REGIONS[section.id];
            const tint = REGION_TEXT[section.id];
            const zones = PATH_BY_ID[section.id]?.nodes.length ?? 0;
            return (
              <div
                key={section.id}
                className="veil veil-lift flex flex-col p-6"
                style={{ borderTopColor: region.color, borderTopWidth: 3 }}
              >
                <h3 className="heading text-[17px]" style={{ color: tint }}>
                  {region.title}
                </h3>
                <p className="label-sm mt-1">{section.name}</p>
                <p className="mt-3 flex-1 font-read text-[14.5px] leading-relaxed text-parchment-dim">
                  {section.blurb}
                </p>
                <p className="mt-4 border-t border-leather-700/60 pt-3 font-read text-[13px] text-ink-faint">
                  <b className="num text-[14px]" style={{ color: tint }}>
                    {section.questionCount}
                  </b>{' '}
                  questions ·{' '}
                  <b className="num text-[14px]" style={{ color: tint }}>
                    {section.minutes}
                  </b>{' '}
                  min ·{' '}
                  <b className="num text-[14px]" style={{ color: tint }}>
                    {zones}
                  </b>{' '}
                  landmarks
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* -------------------------------------------------------- features */}
      <section className="border-y border-leather-700 bg-leather-950/50 py-20">
        <div className="shell">
          <SectionIntro
            title={
              <>
                Everything you need to hit{' '}
                <span className="text-gold-bright">your target</span>
              </>
            }
            lead={
              <>
                Six things that actually <Hl tone="cream">move a score</Hl> — and nothing that just
                looks busy.
              </>
            }
          />

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.id} className="veil veil-lift flex gap-4 p-6">
                <span
                  className="flex h-10 w-10 flex-none items-center justify-center rounded-lg
                             border border-gold-deep/50 bg-leather-900/70 text-gold"
                >
                  <NavGlyph name={f.glyph} size={19} />
                </span>
                <div className="min-w-0">
                  <h3 className="heading text-[16px] leading-snug text-parchment-light">
                    {f.title}
                  </h3>
                  <p className="mt-2 font-read text-[15px] leading-[1.65] text-parchment-dim">
                    {f.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- steps */}
      <section className="shell py-20">
        <SectionIntro
          title={
            <>
              How it <span className="text-gold-bright">works</span>
            </>
          }
          lead={
            <>
              Three moves, repeated <Hl tone="cream">{LIBRARY_STATS.zones} times</Hl>, all the way to
              the Summit.
            </>
          }
        />

        <div className="grid gap-4 md:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.n} className="veil veil-lift p-7 text-center">
              <div
                className="num mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full
                           border-2 border-gold-deep bg-leather-900/80 text-[19px] text-gold"
              >
                {step.n}
              </div>
              <h3 className="heading text-[17px] text-parchment-light">{step.title}</h3>
              <p className="mt-2 font-read text-[15px] leading-[1.65] text-parchment-dim">
                {step.detail}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------- cta */}
      <section className="shell pb-24 text-center">
        <div className="veil mx-auto max-w-2xl px-8 py-14">
          <h2 className="heading text-[clamp(1.5rem,3.2vw,2rem)] text-parchment-light">
            Ready to <span className="text-gold-bright">set out?</span>
          </h2>
          <Ornament />
          <p className="mx-auto max-w-md font-read text-[15.5px] leading-relaxed text-parchment-dim">
            <Hl tone="woods">Free</Hl>, no downloads, and your progress saves as you go.
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

      <footer className="border-t border-leather-700 py-10 text-center">
        <p className="font-script text-[12px] uppercase tracking-[0.2em] text-ink-faint">
          ACT Command · Built for the Enhanced ACT
        </p>
        <nav className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <a
            href={hrefFor({ name: 'privacy' })}
            onClick={() => sfx.select()}
            className="font-read text-[13.5px] text-parchment-dim underline-offset-4 transition-colors hover:text-parchment hover:underline"
          >
            Privacy
          </a>
          <a
            href={hrefFor({ name: 'terms' })}
            onClick={() => sfx.select()}
            className="font-read text-[13.5px] text-parchment-dim underline-offset-4 transition-colors hover:text-parchment hover:underline"
          >
            Terms
          </a>
        </nav>
        {/* Said plainly and in public, not buried in the terms. Using the name
            to describe what the material covers is fine; letting anyone think
            this is theirs is not. */}
        <p className="mx-auto mt-4 max-w-md px-6 font-read text-[12.5px] leading-relaxed text-ink-faint">
          Not affiliated with, endorsed by, or connected to ACT, Inc. "ACT" is their registered
          trademark. Every question here was written for this app.
        </p>
      </footer>
    </div>
  );
}
