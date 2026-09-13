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

import { lazy, Suspense, useEffect, useRef, type ReactNode } from 'react';

/* Three narrow imports rather than one from `@/content`. This is the only
   screen the app does not load lazily — it is the front door — so anything it
   touches is in the first paint, and it quotes the library's totals in prose.
   Reading those totals off the barrel meant downloading 738 kB of question
   bank to render a sentence about how many questions there are. */
import { SECTIONS } from '@/content/sections';
import { PATH_BY_ID } from '@/content/zones';
import { LIBRARY_STATS } from '@/content/stats';
import { hrefFor, useNavigate } from '@/lib/router';
import { useStore } from '@/lib/store';
import { sfx } from '@/lib/sfx';
import { cx } from '@/lib/utils';
import { Button, Eyebrow, Tally } from '@/components/ui';
import { useInView } from '@/lib/useInView';
import { Glyph } from '@/components/Icon';
import { NavGlyph, type GlyphName } from '@/components/NavGlyph';
import { REGIONS, REGION_ORDER } from '@/content/regionFlavor';
import type { SectionId } from '@/types';
import { Art } from '@/components/Art';
import { NearViewport } from '@/components/NearViewport';
/* The one thing on this page that genuinely needs the question bank, and the
   only reason the bank would be on the critical path. It sits four screens
   down, so it is fetched separately — and, per `NearViewport`, not until
   someone is on their way to it. */
const TryQuestion = lazy(() =>
  import('@/components/TryQuestion').then((m) => ({ default: m.TryQuestion })),
);

/* --------------------------------------------------------------- hero depth

   Pointer parallax on the hero and nowhere else on the page.

   Two numbers on a CSS variable; `.hero-plate` in the stylesheet does the rest.
   Deliberately not React state: a state update per `pointermove` would
   re-render the entire landing page sixty times a second in order to move one
   painting fourteen pixels. Deliberately not a spring either — the long
   transition on the class is what makes the plate feel heavy rather than
   stuck to the cursor.

   The reduced-motion check is `matchMedia` rather than the app's
   `useReducedMotion`, which lives in `@/lib/motion`. This screen is the only
   one the app does not load lazily, so an import here is an import in the
   first paint, and one boolean is not worth putting the motion library on the
   critical path for. */
function usePointerDepth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    /* A coarse pointer has no hover position to read, and a touch drag would
       snap the plate to wherever the finger landed rather than drift. */
    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !window.matchMedia('(pointer: fine)').matches
    ) {
      return;
    }

    let frame = 0;
    const move = (e: PointerEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const r = el.getBoundingClientRect();
        el.style.setProperty('--px', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
        el.style.setProperty('--py', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
      });
    };
    const rest = () => {
      el.style.setProperty('--px', '0');
      el.style.setProperty('--py', '0');
    };

    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', rest);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', rest);
    };
  }, []);

  return ref;
}

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
   tightest thing on the page. These are the same hues one step brighter.

   They used to be written out as hex here, which meant they stayed at their
   dark-theme values on the light theme and bottomed out at 1.37:1. Three of
   the four were byte-identical to `--c-*-text` tokens that already invert;
   the fourth had no token, which is presumably why the set was hand-written
   in the first place. `--c-village-text` now exists for it. */
const REGION_TEXT: Record<SectionId, string> = {
  english: 'oklch(var(--c-village-text))',
  reading: 'oklch(var(--c-woods-text))',
  math: 'oklch(var(--c-desert-text))',
  science: 'oklch(var(--c-cliffs-text))',
};

/* A rule broken by a diamond, under every section heading. */
function Ornament() {
  return (
    <div className="orn my-6" aria-hidden="true">
      <Glyph name="spark" size={11} className="text-gold" />
    </div>
  );
}

/* A heading, its ornament, and one line of intro on a thin veil.

   Carries `act-rise` for every section on the page, which is where the scroll
   score actually lives: each act announces itself as it comes up. It belongs
   here rather than on the `<section>` for the reason given in the stylesheet —
   a `view()` range is measured against the animated element's own height, so
   putting it on a tall section would stretch a 200 ms arrival across half a
   screen of scrolling. */
function SectionIntro({ title, lead }: { title: ReactNode; lead: ReactNode }) {
  return (
    <div className="act-rise mb-11 text-center">
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
        English, Reading, Math and Science, each a road of <Hl tone="cream">skill landmarks</Hl>{' '}
        across a painted world. <Hl tone="gold">Nothing unlocks by accident.</Hl>
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
  const { continueAsGuest, progress, hasStarted, playerName } = useStore();

  /* "Have you been here before", not "have you scored any points".

     This used to be `progress.xp > 0`, which is a different question and gets
     the worst case wrong. Someone who has finished onboarding, picked a hero,
     had the realm explained to them and set out — but has not yet answered a
     question — has no XP. They came back the next day and the front door
     greeted them as a total stranger: the sales pitch, "Enter the realm", "I
     have an account". Their own account. Their own world, one click away,
     behind a button that offered to start them a new one.

     Having started and having a profile is what actually distinguishes a
     returning player from a visitor, and neither of them can be true by
     accident. */
  const returning = hasStarted && Boolean(progress.profile);

  /* Counted from the same content the map counts, so the greeting cannot
     claim a total the world does not have. */
  const cleared = Object.keys(progress.zonesCleared).length;
  const totalLandmarks = REGION_ORDER.reduce((n, id) => n + (PATH_BY_ID[id]?.nodes.length ?? 0), 0);

  const heroRef = usePointerDepth<HTMLElement>();
  const [claimRef, claimSeen] = useInView<HTMLDivElement>();

  const begin = () => {
    sfx.achieve();
    continueAsGuest();
    navigate({ name: progress.profile ? 'home' : 'onboarding' });
  };

  /* Fetch the screen you are about to land on while you are still deciding to
     land on it. Both destinations are lazy chunks, so without this the first
     thing anyone sees after "Enter the realm" is the loading screen — the one
     moment on the whole site where the app should look instant. A hover or a
     focus is several hundred milliseconds of warning and the chunk is 7 kB.

     Deliberately fire-and-forget: it is a cache warm, and a failed prefetch
     must not become a visible error on a button that has not been pressed. */
  const warm = () => {
    if (progress.profile) void import('@/screens/Home');
    else void import('@/screens/Onboarding');
  };

  return (
    <div className="min-h-dvh">
      <header className="absolute inset-x-0 top-0 z-30">
        <div className="shell flex h-16 items-center">
          <span className="flex items-center gap-2 font-display text-[16px] font-semibold tracking-wide text-parchment">
            <Glyph name="spark" size={15} className="text-gold" />
            ACT Command
          </span>
          <div className="ml-auto flex items-center gap-2">
            <a
              href={hrefFor({ name: 'faq' })}
              onClick={() => sfx.select()}
              className="mr-1 hidden font-read text-[13.5px] text-parchment-dim underline-offset-4 transition-colors hover:text-parchment hover:underline sm:inline"
            >
              What is this?
            </a>
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

      {/* ------------------------------------------------------- act I — arrival

          The ridge, the title, one thing to do. The claim that used to be
          crammed under the buttons is now its own act, because a hero carrying
          a headline, a paragraph, two buttons, a display-size number, three
          sub-stats and a ticket line is not a hero — it is the whole page,
          stacked. */}
      <section
        ref={heroRef}
        className="relative isolate flex min-h-[94dvh] items-center overflow-hidden"
      >
        <div className="hero-plate">
          <div className="hero-plate-in">
            <Art name="landing-hero" priority className="h-full w-full select-none object-cover" />
          </div>
        </div>
        <div className="hero-scrim" />

        <div className="hero-type-block shell relative z-10 pb-20 pt-28 text-center">
          {/* Two different people arrive at this door.

              One has never heard of the app and needs to be told what it is.
              The other has a world in progress and needs one thing: back in.
              They were being handed the same pitch — a returning player read
              an advert for a thing they already own, every single visit. The
              artwork, the layout and everything below the fold are shared;
              only the three lines that speak to you directly change. */}
          {/* Parchment, not the eyebrow's usual gold. Thirteen-point gold letter-
              forms land on the brightest band of the sunset — gold on orange is
              a hue clash before it is a contrast one, and no amount of shadow
              fixes a pair of colours that are the same colour. Gold on this page
              means the thing you press and the number you earned; a dateline is
              neither, so it gives the colour up and becomes legible. */}
          <Eyebrow className="hero-type mb-5 text-parchment-light">
            {returning ? 'The road is where you left it' : 'The 2025+ Enhanced ACT'}
          </Eyebrow>

          <h1 className="heading hero-type text-[clamp(2.4rem,7vw,4.4rem)] leading-[1.1] text-parchment-light">
            {returning ? (
              <>
                Welcome back,
                <span className="mt-1 block text-gold-bright">{playerName}.</span>
              </>
            ) : (
              <>
                Your climb to 36
                <span className="mt-1 block text-gold-bright">starts here.</span>
              </>
            )}
          </h1>

          {/* Still no veil over the artwork — the open composition was always
              the right instinct. What it was missing is that an open
              composition still owes its type a ground: `.hero-scrim`'s
              bottom-anchored radial and `.hero-type`'s shadow ladder put one
              under the words without laying a slab across the painting. */}
          <p className="hero-type mx-auto mt-6 max-w-2xl font-read text-[clamp(1.05rem,2vw,1.3rem)] leading-relaxed text-parchment-dim">
            {returning ? (
              <>
                <Hl>{cleared}</Hl> of <Hl tone="cream">{totalLandmarks}</Hl> landmarks taken, and{' '}
                <Hl tone="cream">the Grey has not moved since you left</Hl>. Pick up where you
                stopped.
              </>
            ) : (
              <>
                Cross <Hl tone="cream">four regions</Hl>, master every skill the test asks for, and
                work <Hl>{LIBRARY_STATS.totalQuestions.toLocaleString()}</Hl> real questions where{' '}
                <Hl tone="cream">every answer is explained</Hl>.
              </>
            )}
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            {returning ? (
              <>
                <Button
                  variant="primary"
                  size="lg"
                  trailing
                  onClick={() => navigate({ name: 'home' })}
                >
                  Continue your quest
                </Button>
                <a href={hrefFor({ name: 'path' })} onClick={() => sfx.select()}>
                  <Button size="lg">Back to the road</Button>
                </a>
              </>
            ) : (
              <>
                <Button
                  variant="primary"
                  size="lg"
                  trailing
                  onClick={begin}
                  onPointerEnter={warm}
                  onFocus={warm}
                >
                  Enter the realm
                </Button>
                <a href={hrefFor({ name: 'auth', mode: 'signin' })} onClick={() => sfx.select()}>
                  <Button size="lg">I have an account</Button>
                </a>
              </>
            )}
          </div>

          <p className="hero-type mt-9 font-script text-[12px] uppercase tracking-[0.2em] text-ink-faint">
            Every answer explained · Free · No account needed
          </p>
        </div>
      </section>

      {/* --------------------------------------------------- act II — the claim

          One number, the size of the claim it is making.

          It used to be a chip in a row of chips at the bottom of the hero,
          which gave "1,407 questions" exactly the same weight as "100% free".
          The bank is the reason to use this app; nothing else on the page has
          to carry that much, so nothing else gets set this big. */}
      <section className="relative border-y border-leather-700/70 bg-leather-950/55 py-16 sm:py-20">
        <div className="shell">
          <div ref={claimRef} className="text-center">
            <p className="label-sm">Written for this app — not collected from anywhere</p>
            {/* Counts once, when it is looked at. `value` swings from zero to
                the real total the moment the section is seen, which is what
                `Tally` animates on; `from={0}` only keeps it from showing the
                answer for one frame before it starts. `useInView` guarantees
                the swing happens whether or not the observer ever fires. */}
            <div
              className="num mt-3 font-bold leading-[0.92] text-gold-bright"
              style={{
                fontSize: 'clamp(3.4rem, 12vw, 6rem)',
                textShadow: '0 0 52px oklch(var(--c-gold) / 0.22)',
              }}
            >
              <Tally value={claimSeen ? LIBRARY_STATS.totalQuestions : 0} from={0} />
            </div>
            <p className="heading mt-5 text-balance text-[clamp(1.2rem,3vw,1.75rem)] text-parchment-light">
              questions. <span className="text-gold-bright">Every answer explained.</span>
            </p>
          </div>

          <dl className="act-stagger mx-auto mt-11 grid max-w-2xl grid-cols-3 gap-4">
            {[
              [LIBRARY_STATS.notePages.toLocaleString(), 'lessons'],
              [LIBRARY_STATS.passages.toLocaleString(), 'passages'],
              ['4', 'regions'],
            ].map(([value, label]) => (
              <div key={label} className="veil px-4 py-5 text-center">
                <dt className="num text-[clamp(1.3rem,3.4vw,1.7rem)] font-semibold leading-none text-parchment-light">
                  {value}
                </dt>
                <dd className="label-sm mt-2">{label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ------------------------------------------------------ orientation

          Straight after the hero, because a page whose first heading is "Your
          climb to 36" has assumed you know what 36 is out of, what the ACT
          is, and whether any of it applies to you. Enough of the answer to
          keep reading; the rest is on the FAQ. */}
      <section className="border-b border-leather-700 bg-leather-950/40 py-14">
        <div className="act-stagger shell grid gap-5 md:grid-cols-3">
          {[
            {
              t: 'New to this?',
              d: (
                <>
                  The ACT is a US university admissions test: four sections, each scored{' '}
                  <Hl tone="cream">1 to 36</Hl>. Your composite is the average of the four — which
                  is the 36 the headline means.
                </>
              ),
            },
            {
              t: 'Who it is for',
              d: (
                <>
                  Students <Hl tone="cream">13 and over</Hl> sitting the ACT. Most are 15 to 17 and
                  somewhere between three months and a week out from test day.
                </>
              ),
            },
            {
              t: 'What it costs you',
              d: (
                <>
                  <Hl tone="cream">Fifteen to twenty minutes a day.</Hl> No money, no account
                  needed, no app to install. Two to three months at a steady pace covers all four
                  roads.
                </>
              ),
            },
          ].map((c) => (
            <div key={c.t} className="veil p-6">
              <h3 className="heading text-[16px] text-parchment-light">{c.t}</h3>
              <p className="mt-2 font-read text-[15px] leading-[1.65] text-parchment-dim">{c.d}</p>
            </div>
          ))}
        </div>
        <p className="shell mt-6 text-center font-read text-[14.5px] text-parchment-dim">
          Longer answers — including whether this actually works, and why it is free —{' '}
          <a
            href={hrefFor({ name: 'faq' })}
            onClick={() => sfx.select()}
            className="text-gold underline underline-offset-4 hover:text-gold-bright"
          >
            are on the FAQ
          </a>
          .
        </p>
      </section>

      {/* ---------------------------------------------------- try one now */}
      <section className="shell py-20">
        <SectionIntro
          title={
            <>
              Try <span className="text-gold-bright">one question</span>
            </>
          }
          lead={
            <>
              One of <Hl>{LIBRARY_STATS.totalQuestions.toLocaleString()}</Hl>, drawn at random — and
              the reason <Hl tone="cream">every</Hl> wrong answer is wrong. Nothing is saved and
              nothing is asked of you.
            </>
          }
        />
        {/* A fixed-height placeholder, not a spinner: the section already has
            a heading and a lead paragraph above it, and a box that grows when
            the chunk lands would shove them up the page mid-read. The same
            height is reserved before the mount, so the reserved space and the
            Suspense fallback are the same box and the page never jumps. */}
        <div className="act-rise">
          <NearViewport minHeight="420px">
            <Suspense fallback={<div className="proof-sheet mx-auto min-h-[420px] max-w-3xl" />}>
              <TryQuestion onFinish={begin} />
            </Suspense>
          </NearViewport>
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
              Every landmark on a road is <Hl tone="cream">one ACT skill</Hl>. Clear it to open the
              next.
            </>
          }
        />

        {/* A track rather than a grid. The four painted region plates have only
            ever been seen as backdrops behind the path screens, under a scrim
            at low opacity; this is the one place on the site where they can be
            looked at. It also does something a grid cannot — it puts the roads
            in an order and makes you travel them.

            `tabIndex` and the label are not decoration: a scroll container that
            only a wheel can reach is a region of the page a keyboard user
            cannot read at all. */}
        <div className="band-scope act-rise">
          <div
            className="plate-band"
            role="region"
            aria-label="The four regions — scroll to see each"
            tabIndex={0}
          >
            {SECTIONS.map((section) => {
              const region = REGIONS[section.id];
              const tint = REGION_TEXT[section.id];
              const zones = PATH_BY_ID[section.id]?.nodes.length ?? 0;
              return (
                <article
                  key={section.id}
                  className="plate-card"
                  style={{ borderTopColor: region.color, borderTopWidth: 3 }}
                >
                  <Art
                    name={`region-${section.id}` as const}
                    className="plate-card-art"
                    sizes="(max-width: 640px) 80vw, 330px"
                  />
                  <div className="plate-card-veil" />
                  <div className="relative flex h-full min-h-[300px] flex-col p-6">
                    <h3 className="heading text-[18px]" style={{ color: tint }}>
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
                </article>
              );
            })}
          </div>
          {/* The scrollbar the band hides, restated. Driven by the band's own
              scroll position through a named scroll timeline — see the gate in
              `index.css`; where that is unsupported it is a static gilt stub,
              which still reads as "there is more to the right". */}
          <div className="band-rule" aria-hidden="true" />
        </div>
      </section>

      {/* -------------------------------------------------------- features */}
      <section className="border-y border-leather-700 bg-leather-950/50 py-20">
        <div className="shell">
          <SectionIntro
            title={
              <>
                Everything you need to hit <span className="text-gold-bright">your target</span>
              </>
            }
            lead={
              <>
                Six things that actually <Hl tone="cream">move a score</Hl> — and nothing that just
                looks busy.
              </>
            }
          />

          <div className="act-stagger grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
              Three moves, repeated at <Hl tone="cream">every landmark</Hl>, all the way to the
              Summit.
            </>
          }
        />

        <div className="act-stagger grid gap-4 md:grid-cols-3">
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

      {/* ----------------------------------------------------- act V — the ask

          Quiet on purpose. Deep leather, one gilt CTA, and the trademark line
          set as a line of the page rather than as six-point small print under
          the footer nav — it is the single most important thing a stranger can
          be told about who made this, and burying it was the wrong instinct
          even though nothing required it to be anywhere else. */}
      <section className="shell pb-24 text-center">
        <div className="act-ask act-rise mx-auto max-w-2xl px-8 py-14">
          <h2 className="heading text-[clamp(1.5rem,3.2vw,2rem)] text-parchment-light">
            Ready to <span className="text-gold-bright">set out?</span>
          </h2>
          <Ornament />
          <p className="mx-auto max-w-md font-read text-[15.5px] leading-relaxed text-parchment-dim">
            <Hl tone="woods">Free</Hl>, no downloads, and your progress saves as you go.
          </p>
          {/* "100% free" with nothing after it reads as a catch, and for a
              product used by minors it reads as the worst kind of catch. The
              reason is unglamorous and fits in a sentence, so it goes here
              rather than only in the FAQ. */}
          <p className="mx-auto mt-3 max-w-md font-read text-[14px] leading-relaxed text-ink-faint">
            Free because it is small and cheap to run — no ads, nothing sold, and no paid tier
            behind this one.{' '}
            <a
              href={hrefFor({ name: 'faq' })}
              onClick={() => sfx.select()}
              className="text-parchment-dim underline underline-offset-4 hover:text-parchment"
            >
              The longer answer
            </a>
            .
          </p>
          <Button
            variant="primary"
            size="lg"
            trailing
            className="mt-8"
            onClick={begin}
            onPointerEnter={warm}
            onFocus={warm}
          >
            Begin your quest
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

          <p className="mx-auto mt-10 max-w-md border-t border-leather-700/60 pt-6 font-read text-[13px] leading-relaxed text-parchment-dim">
            Not affiliated with, endorsed by, or connected to ACT, Inc. “ACT” is their registered
            trademark. <Hl tone="cream">Every question here was written for this app.</Hl>
          </p>
        </div>
      </section>

      <footer className="border-t border-leather-700 py-10 text-center">
        <p className="font-script text-[12px] uppercase tracking-[0.2em] text-ink-faint">
          ACT Command · Built for the Enhanced ACT
        </p>
        <nav className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <a
            href={hrefFor({ name: 'faq' })}
            onClick={() => sfx.select()}
            className="font-read text-[13.5px] text-parchment-dim underline-offset-4 transition-colors hover:text-parchment hover:underline"
          >
            FAQ
          </a>
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
        {/* The disclaimer itself now closes act V, where it is legible and
            load-bearing rather than set at twelve point under the nav. It is
            repeated here because this is where a reader looks for it, and a
            page can say true things about itself twice. */}
        <p className="mx-auto mt-4 max-w-md px-6 font-read text-[12.5px] leading-relaxed text-ink-faint">
          Not affiliated with, endorsed by, or connected to ACT, Inc. “ACT” is their registered
          trademark.
        </p>
      </footer>
    </div>
  );
}
