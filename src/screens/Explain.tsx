/* What this is, who it is for, and why it costs nothing.
 *
 * The landing page sold a quest. It never said what the ACT is, what a 36 is
 * out of, how long any of this takes, who it is meant for, why there is a
 * wizard on a test-prep site, or how a free thing pays for itself — and the
 * review caught every one of those from a different direction: the student who
 * has never heard of the test, the parent who reads "free" as "you are the
 * product", the person who just wants to try one question before handing over
 * an evening.
 *
 * Two rules for everything on this page.
 *
 *   1. No number we cannot stand behind. There is no "students gained X
 *      points" here, because nobody has measured that and inventing it is the
 *      single most common lie in this category. The honest answer to "does it
 *      work" is written out as the honest answer.
 *
 *   2. Every claim describes what the build actually does, and the numbers are
 *      read from the content library rather than typed, so the page cannot
 *      drift away from the app the way hardcoded marketing copy does.
 */

import type { ReactNode } from 'react';

import { LIBRARY_STATS, SECTIONS } from '@/content';
import { hrefFor, useNavigate } from '@/lib/router';
import { sfx } from '@/lib/sfx';
import { Button } from '@/components/ui';
import { Art } from '@/components/Art';

/* Real ACT section lengths, for the honest comparison against ours. Public
   information, from ACT's own test description. */
const REAL_TEST: Record<string, { questions: number; minutes: number }> = {
  english: { questions: 50, minutes: 35 },
  math: { questions: 45, minutes: 50 },
  reading: { questions: 36, minutes: 40 },
  science: { questions: 40, minutes: 40 },
};

/** Ours, mirrored from `TEST_PLAN` in `Tests.tsx`. */
const OUR_TEST: Record<string, { questions: number; minutes: number }> = {
  english: { questions: 25, minutes: 18 },
  math: { questions: 22, minutes: 25 },
  reading: { questions: 18, minutes: 20 },
  science: { questions: 20, minutes: 20 },
};

interface Entry {
  id: string;
  q: string;
  a: ReactNode;
}

const ENTRIES: Entry[] = [
  {
    id: 'what-is-the-act',
    q: 'What is the ACT?',
    a: (
      <>
        <P>
          It is one of the two admissions tests American universities accept. You sit it in a room
          with a proctor and a clock, usually in your last two years of school, and the score goes
          on your application alongside your grades.
        </P>
        <P>
          It has four sections — English, Math, Reading and Science — and each is scored from{' '}
          <B>1 to 36</B>. Your <B>composite</B> is the average of the four, rounded, so that is out
          of 36 too. A 36 is a perfect score and very few people get one. The middle of the country
          sits somewhere around 19 or 20.
        </P>
        <P>There is also an optional Writing essay. This app does not cover it — see below.</P>
      </>
    ),
  },
  {
    id: 'thirty-six',
    q: '"Your climb to 36" — 36 out of what?',
    a: (
      <P>
        Out of 36. That is the top of the ACT's scale, and it is where the phrase comes from. Not a
        percentage and not a mark out of a hundred.
      </P>
    ),
  },
  {
    id: 'who-for',
    q: 'Who is this for?',
    a: (
      <>
        <P>
          Students <B>13 and over</B> who are going to sit the ACT and want to practise for it. That
          is the whole audience. Most people using it are 15 to 17 and somewhere between three
          months and a week out from test day.
        </P>
        <P>It is probably not for you if:</P>
        <UL>
          <LI>
            You are sitting the SAT instead. The two tests overlap but they are not the same, and
            nothing here is written for the SAT.
          </LI>
          <LI>
            You want a tutor, a class, or somebody to mark your essays. This is a practice tool you
            use on your own.
          </LI>
          <LI>
            You are aiming for a 35 or 36 and already scoring 33. The hardest questions here are
            hard, but at that level you need more volume than this library holds.
          </LI>
        </UL>
      </>
    ),
  },
  {
    id: 'how-long',
    q: 'How long does it take?',
    a: (
      <>
        <P>
          <B>About fifteen to twenty minutes a day</B> is the shape it is built around. Opening it
          up and doing one landmark — a short lesson and the quiz that follows it — is roughly that.
        </P>
        <P>
          Onboarding asks when your test is and sets a weekly target of questions from that:{' '}
          <B>150 a week</B> if you sit it within a month, <B>110</B> at one to three months,{' '}
          <B>75</B> beyond that. At the 75-a-week pace, working through all{' '}
          <B>{LIBRARY_STATS.zones}</B> landmarks takes something like two to three months.
        </P>
        <P>
          None of that is enforced. There is no lockout, no daily minimum and nothing that punishes
          you for missing a day beyond a streak counter you can ignore.
        </P>
      </>
    ),
  },
  {
    id: 'does-it-work',
    q: 'Does it actually raise your score?',
    a: (
      <>
        <P>
          <B>We don't know, and anyone who tells you a number is guessing.</B> Nobody has run a
          study on this app. There is no "our students gain 4 points" here because we have not
          measured it, and putting a figure on the page that we could not defend would be the first
          dishonest thing on it.
        </P>
        <P>What is actually known, from research on studying in general, is narrower:</P>
        <UL>
          <LI>
            Answering practice questions beats re-reading notes, by a wide margin and consistently.
          </LI>
          <LI>
            Spacing that practice out over weeks beats cramming the same total hours into a few
            days.
          </LI>
          <LI>
            Finding out immediately <em>why</em> a wrong answer was wrong beats finding out that it
            was wrong.
          </LI>
        </UL>
        <P>
          This app is built out of those three things and nothing more clever than that. Whether it
          moves <em>your</em> score depends on how much of it you do.
        </P>
      </>
    ),
  },
  {
    id: 'free',
    q: 'Why is it free? What is the catch?',
    a: (
      <>
        <P>
          There is no catch, and the honest reason is unglamorous: it is small, and small is cheap.
          It is a static website with a database attached. Hosting sits inside free tiers, the
          running cost is a few dollars a month, and the questions and lessons were written rather
          than licensed.
        </P>
        <P>Which means, specifically:</P>
        <UL>
          <LI>
            <B>No ads.</B> None, anywhere, and no ad network is loaded — so nothing is watching you
            on behalf of one.
          </LI>
          <LI>
            <B>Nothing is sold.</B> Not your email, not your scores, not aggregate anything. See the{' '}
            <A href={hrefFor({ name: 'privacy' })}>privacy policy</A>, which describes what the code
            does rather than what a lawyer thought sounded safe.
          </LI>
          <LI>
            <B>No free tier with a paywall behind it.</B> There is no paid version. Every question,
            lesson and mock test is in front of you now.
          </LI>
          <LI>
            <B>You can leave with everything.</B> Export-my-data and delete-my-account are both real
            buttons in your profile, and delete means the row is gone.
          </LI>
        </UL>
        <P>
          If that ever has to change, it will be said plainly and in advance, not discovered on a
          paywall one morning.
        </P>
      </>
    ),
  },
  {
    id: 'account',
    q: 'Do I need an account?',
    a: (
      <P>
        No. You can start straight from the landing page and everything saves on your device. An
        account exists for exactly one reason — carrying your progress to your phone — and if you
        make one later, the work you already did comes with you.
      </P>
    ),
  },
  {
    id: 'wizard',
    q: 'Why is there a wizard on a test-prep site?',
    a: (
      <>
        <P>Because the alternative is a progress bar, and a progress bar is very easy to close.</P>
        <P>
          The map is a real structure, not decoration: each of the <B>{LIBRARY_STATS.zones}</B>{' '}
          landmarks is one ACT skill, they are ordered so that the things later questions assume
          come first, and the road opens as you clear them. The fantasy is a way of making that
          shape visible and giving the next step a place to be. Wizzy tells you what a landmark
          teaches before you commit to it.
        </P>
        <P>
          The questions themselves are straight. No dragons in the algebra — a Math question here
          looks exactly like a Math question on the test, because a question that does not look like
          the test is not practice for it.
        </P>
      </>
    ),
  },
  {
    id: 'score-estimate',
    q: 'How accurate is the score it gives me?',
    a: (
      <>
        <P>
          <B>Treat it as a rough band, not a prediction.</B> The app converts your percentage
          correct into a 1–36 score using a curve built to sit close to published ACT scale tables.
          It is <B>not an official concordance</B>, ACT has not seen it, and the real test rescales
          every sitting to keep it fair — so the same raw performance is not always the same scaled
          score even there.
        </P>
        <P>
          Two more reasons to hold it loosely. The mock sections here are shorter than the real
          ones, and a shorter test measures less precisely — one unlucky question moves a short
          section's score more than it would move a long one:
        </P>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse font-read text-[0.98rem] text-ink">
            <thead>
              <tr className="border-b border-parchment-edge text-left">
                <Th>Section</Th>
                <Th>Here</Th>
                <Th>Real ACT</Th>
              </tr>
            </thead>
            <tbody>
              {SECTIONS.map((s) => {
                const ours = OUR_TEST[s.id]!;
                const real = REAL_TEST[s.id]!;
                return (
                  <tr key={s.id} className="border-b border-parchment-edge/60">
                    <Td>{s.name}</Td>
                    <Td>
                      {ours.questions} Q in {ours.minutes} min
                    </Td>
                    <Td>
                      {real.questions} Q in {real.minutes} min
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <P>
          The per-question pace is deliberately the same, so pacing practice transfers. Stamina does
          not — sitting a real ACT is closer to three hours, and there is no substitute for having
          done that once before you do it for real.
        </P>
        <P>
          The percentile the score report shows is from published ACT tables and is always
          approximate. It is only shown after a full four-section test, never for an estimate drawn
          from drilling.
        </P>
      </>
    ),
  },
  {
    id: 'writing',
    q: 'What about the Writing essay?',
    a: (
      <P>
        Not covered. The ACT Writing test is optional, most universities do not require it, and
        marking essays well needs a human. Rather than ship a worse version of it, it is left out —
        said here so you know it is a decision and not an oversight. If you are sitting Writing, you
        will need something else for that part.
      </P>
    ),
  },
  {
    id: 'how-much',
    q: 'How much material is there, really?',
    a: (
      <>
        <UL>
          <LI>
            <B>{LIBRARY_STATS.drillQuestions}</B> questions in the drill banks, which you can
            practise as many times as you like.
          </LI>
          <LI>
            <B>{LIBRARY_STATS.zoneQuestions}</B> more in the landmark quizzes — the gates you clear
            to open the road.
          </LI>
          <LI>
            <B>{LIBRARY_STATS.notePages}</B> lesson pages and <B>{LIBRARY_STATS.passages}</B>{' '}
            reading and science passages.
          </LI>
        </UL>
        <P>
          Being straight about the limit: that is real practice but it is not endless. A few of the
          narrower topics — dashes, logarithms, matrices — have only two or three questions each, so
          you will exhaust those quickly and drilling them again is a memory test rather than a
          skills test. The broad topics are much deeper.
        </P>
      </>
    ),
  },
  {
    id: 'screen-time',
    q: 'A note on how much to use it',
    a: (
      <>
        <P>
          This is aimed at teenagers, so it is worth saying: <B>more is not better here.</B> Twenty
          focused minutes a day for two months beats a six-hour weekend, and that is not
          encouragement to go easy — spacing genuinely produces more retained than cramming does.
        </P>
        <P>
          Nothing in the app is designed to keep you in it. There are no notifications, no infinite
          feed, no timed events that expire, and no reward for playing at 2am. The streak counter
          can be broken and picked back up, and missing a day costs you nothing real.
        </P>
        <P>
          If you are practising to the point of dreading it, stop for the evening. The research on
          spacing is on your side.
        </P>
      </>
    ),
  },
  {
    id: 'affiliation',
    q: 'Is this made by ACT?',
    a: (
      <P>
        No. ACT Command is not affiliated with, endorsed by, or connected to ACT, Inc. in any way.
        "ACT" is their registered trademark and is used here only to say which test this material is
        for. Every question and lesson was written for this app.
      </P>
    ),
  },
];

export function ExplainScreen() {
  const navigate = useNavigate();

  return (
    <div className="relative isolate min-h-dvh">
      <Art
        name="camp-bg"
        className="pointer-events-none fixed inset-0 -z-10 h-full w-full select-none object-cover opacity-60"
      />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-leather-950/90" />

      <div className="mx-auto w-full max-w-[52rem] px-4 py-12 sm:px-6 sm:py-16">
        <button
          type="button"
          onClick={() => {
            sfx.select();
            navigate({ name: 'landing' });
          }}
          className="mb-8 font-script text-[12px] uppercase tracking-[0.16em] text-ink-faint transition-colors hover:text-parchment"
        >
          ← Back
        </button>

        <div className="sheet p-6 sm:p-10">
          <h1 className="font-read text-[clamp(1.6rem,4vw,2.1rem)] font-semibold leading-tight text-ink">
            Questions, answered honestly
          </h1>
          <p className="mt-5 border-l-2 border-parchment-edge pl-4 font-read text-[1.08rem] font-medium leading-[1.75] text-ink">
            Everything below describes what the app actually does. Where the honest answer is "we
            don't know", that is what it says.
          </p>

          {/* A jump list, because this page is long by design and the question
              somebody arrived with is usually one specific one. */}
          <nav aria-label="Jump to a question" className="mt-8 border-t border-parchment-edge pt-6">
            <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {ENTRIES.map((e) => (
                <li key={e.id}>
                  <a
                    href={`#/faq#${e.id}`}
                    onClick={(ev) => {
                      /* The router owns the hash, so an in-page anchor cannot
                         use one — clicking would navigate. Scroll by hand. */
                      ev.preventDefault();
                      document.getElementById(e.id)?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="font-read text-[0.98rem] leading-snug text-ink underline decoration-parchment-edge underline-offset-2 hover:decoration-ink"
                  >
                    {e.q}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {ENTRIES.map((e) => (
            <section key={e.id} id={e.id} className="scroll-mt-6">
              <h2 className="mt-9 font-read text-[1.22rem] font-semibold leading-snug text-ink">
                {e.q}
              </h2>
              {e.a}
            </section>
          ))}

          <div className="mt-10 flex flex-wrap gap-3 border-t border-parchment-edge pt-6">
            <a href={hrefFor({ name: 'privacy' })}>
              <Button>Privacy policy ▸</Button>
            </a>
            <a href={hrefFor({ name: 'terms' })}>
              <Button>Terms ▸</Button>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ pieces */

function P({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 font-read text-[1.05rem] font-medium leading-[1.72] text-ink">{children}</p>
  );
}

function UL({ children }: { children: ReactNode }) {
  return <ul className="mt-3 space-y-2.5">{children}</ul>;
}

function LI({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-3 font-read text-[1.05rem] font-medium leading-[1.72] text-ink">
      <span
        aria-hidden="true"
        className="mt-[0.55em] h-[5px] w-[5px] flex-none rounded-full bg-ink-soft"
      />
      <span>{children}</span>
    </li>
  );
}

function B({ children }: { children: ReactNode }) {
  return <b className="font-semibold text-ink">{children}</b>;
}

function A({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="text-ink underline decoration-parchment-edge underline-offset-2 hover:decoration-ink"
    >
      {children}
    </a>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th className="py-2 pr-4 font-script text-[11px] uppercase tracking-[0.14em] text-ink-soft">
      {children}
    </th>
  );
}

function Td({ children }: { children: ReactNode }) {
  return <td className="py-2 pr-4 font-medium">{children}</td>;
}
