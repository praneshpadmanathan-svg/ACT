/* Privacy policy, terms, and the cookie and storage list.

   Written to be read by the people they apply to, which for this app means
   13-to-17-year-olds. That is not a stylistic preference: a policy a minor
   cannot understand is not meaningful notice, and the newer state privacy laws
   for minors say so more or less in those words.

   Everything in here is a description of what the code actually does. If the
   app changes, this changes with it — a policy that promises more than the
   build delivers is worse than no policy, because it is a false statement
   rather than a missing one. */

import type { ReactNode } from 'react';

import { hrefFor, useNavigate } from '@/lib/router';
import { useStore } from '@/lib/store';
import { cloudEnabled } from '@/lib/supabase';
import { CONTACT } from '@/lib/contact';
import { BUSINESS, OPERATOR_LINE, operatorPhrase } from '@/lib/business';
import { sfx } from '@/lib/sfx';
import { LinkButton } from '@/components/ui';
import { Glyph } from '@/components/Icon';
import { Art } from '@/components/Art';
import { LIBRARY_STATS } from '@/content/stats';

const UPDATED = '27 September 2026';

type LegalPage = 'privacy' | 'terms' | 'cookies';

const PAGE_LINKS: { page: LegalPage; label: string }[] = [
  { page: 'privacy', label: 'Privacy policy' },
  { page: 'terms', label: 'Terms of use' },
  { page: 'cookies', label: 'Cookies and storage' },
];

export function LegalScreen({ page }: { page: LegalPage }) {
  const navigate = useNavigate();
  const { hasStarted } = useStore();

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
            /* Somebody who has started came here from inside the app — Settings,
               the score caveat — and the front door is not where they were. */
            navigate({ name: hasStarted ? 'home' : 'landing' });
          }}
          className="mb-6 inline-flex min-h-11 items-center gap-1.5 font-script text-[12px] uppercase tracking-[0.16em] text-ink-faint transition-colors hover:text-parchment"
        >
          <Glyph name="arrowLeft" size={13} strokeWidth={2} />
          Back
        </button>

        <div className="sheet p-6 sm:p-10">
          {page === 'privacy' ? <Privacy /> : page === 'terms' ? <Terms /> : <Cookies />}

          <div className="mt-10 flex flex-wrap gap-3 border-t border-paper-edge pt-6">
            {PAGE_LINKS.filter((l) => l.page !== page).map((l) => (
              <LinkButton key={l.page} href={hrefFor({ name: l.page })} trailing>
                {l.label}
              </LinkButton>
            ))}
          </div>
          <OperatorNote />
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- privacy */

function Privacy() {
  return (
    <article>
      <Title>Privacy policy</Title>
      <Updated />

      <Lead>
        The short version: if you play without an account, nothing about you leaves your device. If
        you make an account, we keep your email, the name you chose, and your study progress — so it
        can follow you to your phone. That is the whole list. We do not run ads, we do not use
        trackers, and we do not sell anything to anyone.
      </Lead>

      <H>Who we are</H>
      <P>
        ACT Command is {operatorPhrase('run')}. For anything about your information, write to{' '}
        <A href={`mailto:${CONTACT.privacy}`}>{CONTACT.privacy}</A>.
      </P>

      <H>Playing without an account</H>
      <P>
        You can use every part of ACT Command without telling us anything. All{' '}
        {LIBRARY_STATS.totalQuestions.toLocaleString()} questions, every lesson, every landmark, the
        duels and timed practice work with no account at all.
      </P>
      <P>
        In that mode your progress is stored by your own browser, on your own device, using
        something called local storage. It never reaches us. If you clear your browser data it is
        gone, and we cannot get it back for you, because we never had it.
      </P>

      {cloudEnabled && (
        <>
          <H>If you make an account</H>
          <P>We store three things:</P>
          <UL>
            <LI>
              <B>Your email address</B> — so you can sign in, and so we can send you a link if you
              forget your password. We do not send newsletters or marketing.
            </LI>
            <LI>
              <B>The name you chose</B> — shown to you at the top of the screen. It is not shown to
              anyone else, because there is nobody else to show it to.
            </LI>
            <LI>
              <B>Your study progress</B> — your XP, which topics you have answered and how many you
              got right, which lessons you have read, your test scores, your achievements and where
              you are in the story.
            </LI>
          </UL>
          <P>
            That progress is a summary rather than a recording. We keep totals per topic and a count
            of how many questions you answered each day. We keep the ids of the questions in your
            review queue and your bookmarks, so they can come back to you; we do not keep a log of
            your raw answers.
          </P>
        </>
      )}

      <H>Your date of birth</H>
      <P>
        If you go to create an account we ask when you were born, because we are only allowed to
        make accounts for people aged 13 and over.
      </P>
      <P>
        We use it once, on your device, to work out whether you are old enough — and then we throw
        it away. Your date of birth is <B>never saved and never sent to us</B>. All that is kept is
        a single yes-or-no answer, in your own browser.
      </P>

      <H>What we never do</H>
      <UL>
        <LI>No advertising, and no advertising trackers.</LI>
        <LI>No analytics services, no third-party pixels, no fingerprinting.</LI>
        <LI>No selling or sharing your information with anyone.</LI>
        <LI>No building a profile of you for anything other than showing you your own progress.</LI>
        <LI>No messaging, no public profiles, no leaderboards — nobody else can see you here.</LI>
      </UL>

      {cloudEnabled && (
        <>
          <H>Companies that help run the site</H>
          <P>
            Two services keep this thing online, and both see ordinary technical information like
            your IP address as a normal part of delivering a web page:
          </P>
          <UL>
            <LI>
              <B>Supabase</B> stores accounts and progress, and handles passwords. Your password is
              hashed on their servers and is never visible to us or stored on your device.
            </LI>
            <LI>
              <B>Vercel</B> serves the site itself.
            </LI>
          </UL>
          <P>Neither is given your information for their own purposes.</P>

          <H>Getting your data out, or getting rid of it</H>
          <P>Both live in Settings, and neither requires emailing anyone or waiting:</P>
          <UL>
            <LI>
              <B>Download everything</B> (in Settings) saves everything we hold about you as a file
              you can keep.
            </LI>
            <LI>
              <B>Delete my account</B> removes your account and your progress from the live service
              immediately and permanently, so please download it first if you want one.
            </LI>
          </UL>
          <P>
            One honest exception: we take a nightly backup of the progress table so a fault cannot
            wipe everyone’s work. Backups are private, are never used for anything but restoring the
            service, and each one is deleted automatically after 30 days. So for up to 30 days after
            you delete your account, your name and progress (but never your email or password, which
            are not in the backup) still exist in one of those copies, and then they are gone.
          </P>
          <P>
            We keep your data until you delete it. If you would rather we did it for you, or you
            have any other question about your information, write to{' '}
            <A href={`mailto:${CONTACT.privacy}`}>{CONTACT.privacy}</A>.
          </P>

          <H>Your rights</H>
          <P>Wherever you live, you can:</P>
          <UL>
            <LI>
              <B>See</B> what we hold about you: use Download everything.
            </LI>
            <LI>
              <B>Take it with you</B>: the download is a plain file any program can read.
            </LI>
            <LI>
              <B>Delete</B> it: use Delete my account, or ask us to.
            </LI>
            <LI>
              <B>Correct</B> it: write to us and we will fix it, for example the name on your
              account.
            </LI>
          </UL>
          <P>
            We do not sell or share personal information, so there is nothing to opt out of. We
            answer requests within 30 days, and we will never treat you differently for making one.
            If you are in the UK or the EU, the reason we hold your account data is to provide the
            service you asked for, and you can also complain to your local data protection
            authority.
          </P>

          <H>If you are under 13</H>
          <P>
            You are welcome to use the site — just not to make an account, because the law (COPPA in
            the United States) sets rules about collecting personal information from children under
            13 that we are not set up to meet. So we do not collect any.
          </P>
          <P>
            If you are a parent and believe a child under 13 has somehow made an account, write to{' '}
            <A href={`mailto:${CONTACT.privacy}`}>{CONTACT.privacy}</A> and we will delete it.
          </P>
        </>
      )}

      <H>If you email us</H>
      <P>
        If you write to us (to report a question, ask for help, or make a privacy request), we get
        your email address and whatever you wrote, and we use them only to reply. We never add it to
        a mailing list or share it, and we keep it only as long as we need it to help you.
      </P>

      <H>Cookies</H>
      <P>
        We set no cookies at all: no tracking cookies, no advertising cookies, no analytics. Your
        browser stores your progress and settings locally
        {cloudEnabled ? ', and if you are signed in it holds a token that keeps you signed in' : ''}
        . Every item is listed, with what it is for, on the{' '}
        <A href={hrefFor({ name: 'cookies' })}>cookies and storage</A> page. None of it is used to
        track you, so there is no cookie banner: there is nothing to accept or refuse.
      </P>

      <H>Changes</H>
      <P>
        If this policy changes, the date at the top changes with it. If a change actually affects
        what we collect, we will say so in the app rather than hoping you re-read this page.
      </P>
    </article>
  );
}

/* ------------------------------------------------------------------- terms */

function Terms() {
  return (
    <article>
      <Title>Terms of use</Title>
      <Updated />

      <Lead>
        ACT Command is a free study aid. Use it to prepare, do not try to break it, and please
        understand that the scores it shows you are practice estimates rather than predictions.
      </Lead>

      <H>Who runs this</H>
      <P>
        ACT Command is {operatorPhrase('operated')}. You can reach us at{' '}
        <A href={`mailto:${CONTACT.support}`}>{CONTACT.support}</A>.
      </P>

      <H>Not affiliated with ACT, Inc.</H>
      <P>
        This is an independent study tool. It is{' '}
        <B>not affiliated with, endorsed by, or connected to ACT, Inc.</B>, the organisation that
        writes and administers the ACT test. “ACT” is their registered trademark and is used here
        only to describe what the material covers.
      </P>
      <P>
        Every question, lesson and passage in this app was written for it. None of it is real exam
        material.
      </P>

      <H>About the scores</H>
      <P>
        The estimated composite is worked out from your accuracy on practice questions using an
        approximation of the published scoring curves. It is a way of seeing whether you are
        improving. It is <B>not a prediction of your real score</B>, it is not official, and no one
        should make a decision based on it that they would not make on a hunch.
      </P>

      <H>Using it</H>
      <P>You agree to a short list of reasonable things:</P>
      <UL>
        <LI>Do not try to break into, overload, or interfere with the site or anyone's account.</LI>
        <LI>Do not use automated tools to hammer the service.</LI>
        <LI>Do not copy the question bank wholesale and pass it off as your own.</LI>
        <LI>Give a real email address if you make an account, so you can get back in.</LI>
      </UL>
      <P>
        Studying is personal, so there is nothing here to moderate: no messaging, no comments, no
        public profiles, no way to send anything to another user.
      </P>

      {cloudEnabled && (
        <>
          <H>Your account</H>
          <P>
            Accounts are for people aged <B>13 and over</B>. Keep your password to yourself, and
            please do not reuse a password you use somewhere important — that is good advice for
            every site, this one included.
          </P>
          <P>
            You can delete your account whenever you like, from Settings. We may close an account
            that is being used to attack the service, which in practice means almost never.
          </P>
        </>
      )}

      <H>Price, payments and refunds</H>
      <P>
        ACT Command is <B>free</B>. There is no paid tier, no subscription, no in-app purchase and
        no hidden fee, and we never ask for card details. Because we take no payments, there is
        nothing to refund. If that ever changes, the price will be shown in full before you pay, and
        these terms will set out a refund policy before anything is sold.
      </P>

      <H>No warranty</H>
      <P>
        This is provided as it is, for free, with no guarantee that it will always be available or
        always be correct. We try hard to make the explanations right, but if you find a question
        with a bad answer, tell us at <A href={`mailto:${CONTACT.support}`}>{CONTACT.support}</A>{' '}
        and it will be fixed.
      </P>
      <P>
        To the extent the law allows, we are not liable for losses arising from using the site —
        including how a real test turns out. Preparation helps; it does not come with a promise.
      </P>

      {BUSINESS.jurisdiction && (
        <>
          <H>The law that applies</H>
          <P>
            These terms are governed by the law of {BUSINESS.jurisdiction}. Nothing in them takes
            away rights the law where you live gives you and that cannot be signed away.
          </P>
        </>
      )}

      <H>Changes</H>
      <P>
        These terms can change, and the date at the top will say when they last did. Continuing to
        use the site after a change means you are alright with it.
      </P>
    </article>
  );
}

/* ---------------------------------------------------------------- cookies */

/* Every item this app writes to the browser. Keep this list in step with the
   code: `grep -rn "act-command:" src` finds them all. Items only ever written
   by retired builds are listed at the end, because a returning visitor may
   still have them until they are cleaned up. */
const STORED: { key: string; what: string; kept: string }[] = [
  {
    key: 'act-command:progress:v2:…',
    what: 'Your study progress: XP, topic totals, review queue, bookmarks, test scores.',
    kept: 'Until you clear your browser data or reset progress.',
  },
  {
    key: 'act-command:prefs:v1',
    what: 'Your settings: theme, text size, reading font, read-aloud, extra time.',
    kept: 'Until you clear your browser data.',
  },
  {
    key: 'act-command:muted',
    what: 'Whether sound effects are off.',
    kept: 'Until you clear your browser data.',
  },
  {
    key: 'act-command:age-verdict',
    what: 'A single yes or no: whether this browser passed the age check. Never your birthday.',
    kept: 'Until you clear your browser data.',
  },
  {
    key: 'act-command:scratch',
    what: 'The text in the scratch pad beside math questions.',
    kept: 'Until you clear it or your browser data.',
  },
  {
    key: 'act-command:reported',
    what: 'The ids of questions you reported, so the flag stays lit.',
    kept: 'The last 200.',
  },
  {
    key: 'act-command:diagnostics:v1',
    what: 'The last 40 errors the app hit on this device. Never sent anywhere unless you copy it.',
    kept: 'The last 40, or until you press Clear.',
  },
  {
    key: 'act-command:guest, seen-intro, wizzy-hidden, save-prompt-dismissed, placement-prompt-dismissed, claim-guest',
    what: 'Small flags so the app does not show you the same message twice.',
    kept: 'Until you clear your browser data.',
  },
];

const STORED_CLOUD: { key: string; what: string; kept: string }[] = [
  {
    key: 'sb-…-auth-token',
    what: 'Keeps you signed in. Set by Supabase, our account provider.',
    kept: 'Until you log out.',
  },
  {
    key: 'sb-…-auth-token-code-verifier',
    what: 'A one-time value used while a sign-in link is completing.',
    kept: 'Removed when sign-in finishes.',
  },
];

function Cookies() {
  const rows = cloudEnabled ? [...STORED, ...STORED_CLOUD] : STORED;
  return (
    <article>
      <Title>Cookies and storage</Title>
      <Updated />

      <Lead>
        ACT Command sets <B>no cookies</B>. It does keep a few things in your browser’s local
        storage so the app works: your progress, your settings, and (if you have an account) the
        token that keeps you signed in. None of it is used for advertising or tracking, and none of
        it is shared.
      </Lead>

      <H>What is stored, and why</H>
      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.key} className="rounded-lg border border-paper-edge p-4">
            <p className="break-words font-mono text-[0.85rem] text-ink">{row.key}</p>
            <p className="mt-1.5 font-read text-[1rem] font-medium leading-[1.6] text-ink">
              {row.what}
            </p>
            <p className="mt-1 font-read text-[0.92rem] leading-[1.6] text-ink-soft">
              Kept: {row.kept}
            </p>
          </div>
        ))}
      </div>

      <H>Offline copies of the app</H>
      <P>
        So the app keeps working without a connection, your browser also keeps a copy of the app’s
        own files (code, fonts, pictures) in its cache. These are the same for everyone and contain
        nothing about you.
      </P>

      <H>Why there is no cookie banner</H>
      <P>
        Consent banners exist for cookies and storage that are not needed to give you the service
        you asked for, like advertising and analytics. We use none of those. Everything above is
        needed to make the app do what you asked it to, so there is nothing to accept or refuse. If
        we ever add anything that is optional, we will ask first and it will stay off until you say
        yes.
      </P>

      <H>Clearing it</H>
      <P>
        Clearing this site’s data in your browser settings removes all of it. If you play without an
        account, that also removes your progress for good, because it is the only copy.
      </P>
    </article>
  );
}

/** The operator's details, at the foot of every legal page. */
function OperatorNote() {
  return (
    <p className="mt-6 font-read text-[0.92rem] leading-[1.6] text-ink-soft">
      {OPERATOR_LINE && <>{OPERATOR_LINE} · </>}
      <A href={`mailto:${CONTACT.support}`}>{CONTACT.support}</A>
    </p>
  );
}

/* ------------------------------------------------------------------ pieces */

function Title({ children }: { children: ReactNode }) {
  return (
    <h1 className="font-heading text-[clamp(1.6rem,4vw,2.1rem)] font-semibold leading-tight text-ink">
      {children}
    </h1>
  );
}

function Updated() {
  return <p className="label-quill mt-2">Last updated {UPDATED}</p>;
}

function Lead({ children }: { children: ReactNode }) {
  return (
    <p className="mt-5 border-l-2 border-paper-edge pl-4 font-read text-[1.08rem] font-medium leading-[1.75] text-ink">
      {children}
    </p>
  );
}

function H({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-8 font-read text-[1.22rem] font-semibold leading-snug text-ink">
      {children}
    </h2>
  );
}

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
      className="text-ink underline decoration-paper-edge underline-offset-2 hover:decoration-ink"
    >
      {children}
    </a>
  );
}
