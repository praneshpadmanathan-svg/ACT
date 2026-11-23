/* The landing page.

   Rebuilt against DESIGN.md. The page it replaces had the shape every
   generated landing page has — a centred headline over the art with one word
   in gold, a tracked-capitals eyebrow and ticket line, a glowing big-number
   stat, a grid of six icon cards, a 1-2-3 row, and an ornament under every
   heading — and most of its prose had a word or two bolded or coloured for
   emphasis.

   What it keeps is what only this product has: the painting, the four
   regions with their real landmarks, the ranks, and a real question to try.
   The painting sits beside the words rather than under them: the traveller
   stands a third of the way across, so a centred headline landed on the
   figure and needed a scrim and a text-shadow ladder to stay legible. */

import { RealmExplorer } from '@/components/RealmExplorer';
import { RankShowcase } from '@/components/RankShowcase';
import { lazy, Suspense } from 'react';

/* Three narrow imports rather than one from `@/content`. This is the only
   screen the app does not load lazily — it is the front door — so anything it
   touches is in the first paint, and it quotes the library's totals in prose.
   Reading those totals off the barrel meant downloading 738 kB of question
   bank to render a sentence about how many questions there are. */
import { PATH_BY_ID } from '@/content/zones';
import { LIBRARY_STATS } from '@/content/stats';
import { hrefFor, useNavigate } from '@/lib/router';
import { useStore } from '@/lib/store';
import { landmarksCleared } from '@/lib/progress';
import { sfx } from '@/lib/sfx';
import { Button } from '@/components/ui';
import { REGION_ORDER } from '@/content/regionFlavor';
import { Art } from '@/components/Art';
import { NearViewport } from '@/components/NearViewport';
import { CONTACT } from '@/lib/contact';
import { OPERATOR_LINE } from '@/lib/business';
/* The one thing on this page that genuinely needs the question bank, and the
   only reason the bank would be on the critical path. It sits screens down,
   so it is fetched separately — and, per `NearViewport`, not until someone is
   on their way to it. */
const TryQuestion = lazy(() =>
  import('@/components/TryQuestion').then((m) => ({ default: m.TryQuestion })),
);

const QUESTIONS = LIBRARY_STATS.totalQuestions.toLocaleString();

/* What else is in the app, beyond the roads. Plain statements, no icons:
   each of these is a thing the student will actually open. */
const ALSO = [
  {
    title: 'The Library',
    detail: `${LIBRARY_STATS.notePages} short pages, one idea each: the rule, a worked example, and the trap that costs people points.`,
  },
  {
    title: 'Review',
    detail:
      'Anything you get wrong comes back, at a longer gap each time you get it right, until you stop missing it.',
  },
  {
    title: 'Timed practice',
    detail:
      'Shortened sections on a real clock, then a scored report that names the topics costing you points.',
  },
  {
    title: 'A guide on the road',
    detail:
      'Wizzy points you at the next landmark and tells you what it teaches before you start it.',
  },
];

const footLink =
  'inline-flex items-center text-[13.5px] text-parchment-dim underline-offset-4 transition-colors hover:text-parchment hover:underline [@media(pointer:coarse)]:min-h-11';

/* ---------------------------------------------------------------------- page */

export function Landing() {
  const navigate = useNavigate();
  const { continueAsGuest, progress, hasStarted, playerName, isGuest, signOut } = useStore();

  /* "Have you been here before", not "have you scored any points": someone
     who finished onboarding but has not answered yet has no XP, and was
     greeted as a stranger with a button offering to start them a new world. */
  const returning = (hasStarted || !isGuest) && Boolean(progress.profile);

  /* Counted from the same content the map counts, so the page cannot claim a
     total the world does not have. */
  const cleared = landmarksCleared(progress);
  const totalLandmarks = REGION_ORDER.reduce((n, id) => n + (PATH_BY_ID[id]?.nodes.length ?? 0), 0);

  const begin = () => {
    sfx.achieve();
    if (!hasStarted) continueAsGuest();
    navigate({ name: progress.profile ? 'home' : 'onboarding' });
  };

  /* Fetch the screen you are about to land on while you are still deciding to
     land on it; both destinations are lazy chunks. Fire-and-forget: a cache
     warm must not become an error on a button nobody has pressed. */
  const warm = () => {
    if (progress.profile) void import('@/screens/Home').catch(() => {});
    else void import('@/screens/Onboarding').catch(() => {});
  };

  const toSample = () => {
    const sample = document.getElementById('try-question');
    sample?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
    sample?.focus({ preventScroll: true });
  };

  return (
    <div className="landing min-h-dvh">
      <header className="shell flex h-16 items-center">
        <span className="wordmark whitespace-nowrap text-[17px]">ACT Command</span>
        <nav className="ml-auto flex items-center gap-1 sm:gap-2" aria-label="Site">
          <a
            href={hrefFor({ name: 'faq' })}
            onClick={() => sfx.select()}
            className="landing-navlink hidden sm:inline-flex"
          >
            What is this?
          </a>
          {/* The header says which of three people you are: a logged-in
              player, a guest who has been here, or a visitor. */}
          {!isGuest ? (
            <>
              <span className="mr-1 hidden max-w-[12rem] truncate text-[13px] text-parchment-dim md:inline">
                Logged in as <span className="text-parchment">{playerName}</span>
              </span>
              <button
                type="button"
                className="landing-navlink inline-flex"
                onClick={() => {
                  sfx.select();
                  void signOut();
                }}
              >
                Log out
              </button>
              <Button variant="primary" size="sm" onClick={() => navigate({ name: 'home' })}>
                Open the app
              </Button>
            </>
          ) : (
            <>
              <a
                className="landing-navlink inline-flex"
                href={hrefFor({ name: 'auth', mode: 'signin' })}
                onClick={() => sfx.select()}
              >
                Log in
              </a>
              {returning ? (
                <Button
                  variant="primary"
                  size="sm"
                  className="whitespace-nowrap"
                  onClick={() => navigate({ name: 'home' })}
                >
                  Continue
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  className="whitespace-nowrap"
                  onClick={begin}
                  onPointerEnter={warm}
                  onFocus={warm}
                >
                  Start free
                </Button>
              )}
            </>
          )}
        </nav>
      </header>

      {/* ------------------------------------------------------------- hero */}
      <section className="landing-hero shell" aria-labelledby="landing-title">
        <div className="landing-hero-copy">
          {returning ? (
            <>
              <h1 id="landing-title" className="landing-h1">
                Your road is where you left it
              </h1>
              <p className="landing-lead">
                {cleared === 0
                  ? `You have ${totalLandmarks} landmarks ahead of you and none cleared yet. The first one takes about twelve minutes.`
                  : `${cleared} of ${totalLandmarks} landmarks cleared so far.`}
              </p>
            </>
          ) : (
            <>
              <h1 id="landing-title" className="landing-h1">
                ACT practice, one skill at a time
              </h1>
              <p className="landing-lead">
                English, Math, Reading and Science, laid out as four roads across a painted country.
                Each landmark teaches one skill the test asks for, and all {QUESTIONS} practice
                questions explain their answers.
              </p>
            </>
          )}

          <div className="landing-actions">
            {returning ? (
              <>
                <Button variant="primary" size="lg" onClick={() => navigate({ name: 'home' })}>
                  Continue
                </Button>
                {isGuest ? (
                  <a
                    className="btn btn-ghost btn-lg"
                    href={hrefFor({ name: 'auth', mode: 'signup' })}
                    onClick={() => sfx.select()}
                  >
                    Save it with an account
                  </a>
                ) : (
                  <a
                    className="btn btn-ghost btn-lg"
                    href={hrefFor({ name: 'path' })}
                    onClick={() => sfx.select()}
                  >
                    Open Study
                  </a>
                )}
              </>
            ) : (
              <>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={begin}
                  onPointerEnter={warm}
                  onFocus={warm}
                >
                  Start practising
                </Button>
                <Button size="lg" onClick={toSample}>
                  Try a question
                </Button>
              </>
            )}
          </div>

          <p className="mt-5 text-[14px] text-ink-faint">
            {returning && isGuest
              ? 'You are not logged in, so this progress is saved in this browser only.'
              : 'Free, and no account needed.'}
          </p>
        </div>

        <div className="landing-hero-art">
          {/* The traveller at the cliff's edge, looking down the road at the
              village: the whole product in one picture, shown whole. */}
          <Art
            name="landing-hero"
            priority
            sizes="(max-width: 900px) 100vw, 60vw"
            className="h-full w-full select-none object-cover"
          />
        </div>
      </section>

      {/* ------------------------------------------------------ orientation
          Straight after the hero, because the headline assumes you know what
          the ACT is and whether it applies to you. */}
      <section className="landing-band">
        <div className="shell">
          <dl className="landing-facts">
            <div>
              <dt>The ACT</dt>
              <dd>
                A US university admissions test, scored from 1 to 36, in four sections: English,
                Math, Reading and Science.
              </dd>
            </div>
            <div>
              <dt>Who it’s for</dt>
              <dd>
                Students 13 and over preparing for it. Most are 15 to 17 and between a week and
                three months from test day.
              </dd>
            </div>
            <div>
              <dt>What it costs</dt>
              <dd>
                Nothing. No payment, nothing to install, and no account unless you want your
                progress on more than one device.
              </dd>
            </div>
          </dl>
          <p className="mt-8 text-[14.5px] text-parchment-dim">
            Whether it works, why it’s free, and the rest:{' '}
            <a
              href={hrefFor({ name: 'faq' })}
              onClick={() => sfx.select()}
              className="text-parchment underline underline-offset-4 hover:text-gold"
            >
              read the FAQ
            </a>
          </p>
        </div>
      </section>

      {/* ---------------------------------------------------- try one now */}
      <section
        id="try-question"
        tabIndex={-1}
        aria-labelledby="try-title"
        className="shell scroll-mt-8 py-24"
      >
        <div className="landing-section-head">
          <h2 id="try-title" className="landing-h2">
            Try a question
          </h2>
          <p>
            One of the {QUESTIONS}, picked at random. Answer it to see why each choice is right or
            wrong. Nothing is saved.
          </p>
        </div>
        {/* A fixed-height placeholder, not a spinner: a box that grew when the
            chunk landed would shove the heading up the page mid-read. */}
        <NearViewport minHeight="420px">
          <Suspense fallback={<div className="proof-sheet min-h-[420px] max-w-3xl" />}>
            <TryQuestion onFinish={begin} />
          </Suspense>
        </NearViewport>
      </section>

      {/* --------------------------------------------------------- regions */}
      <section className="below-fold shell py-24" aria-labelledby="roads-title">
        <div className="landing-section-head">
          <h2 id="roads-title" className="landing-h2">
            Four roads, one for each section
          </h2>
          <p>
            Every landmark on a road is one skill. Read a short lesson, then take a six-question
            quiz; get five right and the next landmark opens.
          </p>
        </div>
        <RealmExplorer onBegin={begin} />
      </section>

      <div className="below-fold shell pb-24">
        <RankShowcase />
      </div>

      {/* ---------------------------------------------------- also inside */}
      <section className="below-fold landing-band" aria-labelledby="also-title">
        <div className="shell">
          <h2 id="also-title" className="landing-h2">
            Also in the app
          </h2>
          <dl className="landing-also">
            {ALSO.map((a) => (
              <div key={a.title}>
                <dt>{a.title}</dt>
                <dd>{a.detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ------------------------------------------------------------ ask */}
      <section className="below-fold shell py-24" aria-labelledby="ask-title">
        <div className="max-w-xl">
          <h2 id="ask-title" className="landing-h2">
            Start with one landmark
          </h2>
          <p className="mt-3 text-[16px] leading-relaxed text-parchment-dim">
            The first takes about twelve minutes, and your progress saves as you go. It’s free
            because it’s small and cheap to run: no ads, nothing sold, and no paid tier behind this
            one.{' '}
            <a
              href={hrefFor({ name: 'faq' })}
              onClick={() => sfx.select()}
              className="text-parchment underline underline-offset-4 hover:text-gold"
            >
              More on that
            </a>
          </p>
          <div className="landing-actions">
            <Button
              variant="primary"
              size="lg"
              onClick={begin}
              onPointerEnter={warm}
              onFocus={warm}
            >
              Start practising
            </Button>
            <a
              className="btn btn-ghost btn-lg"
              href={hrefFor({ name: 'auth', mode: 'signup' })}
              onClick={() => sfx.select()}
            >
              Create an account
            </a>
          </div>
          <p className="mt-4 text-[14px] text-ink-faint">
            An account only carries your progress between devices. Every question here was written
            for this app.
          </p>
        </div>
      </section>

      <footer className="border-t border-leather-700 py-10">
        <div className="shell flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-md">
            <span className="wordmark text-[15px]">ACT Command</span>
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink-faint">
              Not affiliated with, endorsed by, or connected to ACT, Inc. “ACT” is their registered
              trademark.
            </p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink-faint">
              Copyright {new Date().getFullYear()} {OPERATOR_LINE ?? 'ACT Command'}.{' '}
              <a href={`mailto:${CONTACT.support}`} className="underline underline-offset-2">
                {CONTACT.support}
              </a>
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Footer">
            <a href={hrefFor({ name: 'faq' })} onClick={() => sfx.select()} className={footLink}>
              FAQ
            </a>
            <a
              href={hrefFor({ name: 'privacy' })}
              onClick={() => sfx.select()}
              className={footLink}
            >
              Privacy
            </a>
            <a href={hrefFor({ name: 'terms' })} onClick={() => sfx.select()} className={footLink}>
              Terms
            </a>
            <a
              href={hrefFor({ name: 'cookies' })}
              onClick={() => sfx.select()}
              className={footLink}
            >
              Cookies
            </a>
            <a href={`mailto:${CONTACT.support}`} className={footLink}>
              Contact
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
