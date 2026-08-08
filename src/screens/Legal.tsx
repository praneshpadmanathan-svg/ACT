/* Privacy policy and terms.

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
import { cloudEnabled } from '@/lib/supabase';
import { sfx } from '@/lib/sfx';
import { Button } from '@/components/ui';
import { Art } from '@/components/Art';

/* Where people write when they want their data out, or have a complaint.

   Worth pointing at an address made for the purpose rather than a personal
   inbox: it goes on a public page aimed at minors, so it will be scraped, and
   whoever answers it may not always be you. */
const CONTACT_EMAIL = 'pranesh.padmanathan@gmail.com';

const UPDATED = '31 July 2026';

export function LegalScreen({ page }: { page: 'privacy' | 'terms' }) {
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
          {page === 'privacy' ? <Privacy /> : <Terms />}

          <div className="mt-10 flex flex-wrap gap-3 border-t border-parchment-edge pt-6">
            <a href={hrefFor({ name: page === 'privacy' ? 'terms' : 'privacy' })}>
              <Button>{page === 'privacy' ? 'Read the terms ▸' : 'Read the privacy policy ▸'}</Button>
            </a>
          </div>
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
        The short version: if you play without an account, nothing about you leaves your
        device. If you make an account, we keep your email, the name you chose, and your
        study progress — so it can follow you to your phone. That is the whole list. We do
        not run ads, we do not use trackers, and we do not sell anything to anyone.
      </Lead>

      <H>Playing without an account</H>
      <P>
        You can use every part of ACT Command without telling us anything. All 754 questions,
        every lesson, the map, the guardians and the timed trial work with no account at all.
      </P>
      <P>
        In that mode your progress is stored by your own browser, on your own device, using
        something called local storage. It never reaches us. If you clear your browser data
        it is gone, and we cannot get it back for you, because we never had it.
      </P>

      {cloudEnabled && (
        <>
          <H>If you make an account</H>
          <P>We store three things:</P>
          <UL>
            <LI>
              <B>Your email address</B> — so you can sign in, and so we can send you a link if
              you forget your password. We do not send newsletters or marketing.
            </LI>
            <LI>
              <B>The name you chose</B> — shown to you at the top of the screen. It is not
              shown to anyone else, because there is nobody else to show it to.
            </LI>
            <LI>
              <B>Your study progress</B> — your XP, which topics you have answered and how many
              you got right, which lessons you have read, your test scores, your achievements
              and where you are in the story.
            </LI>
          </UL>
          <P>
            That progress is a summary rather than a recording. We keep totals per topic and a
            count of how many questions you answered each day. We do not keep a list of every
            individual question you have ever attempted.
          </P>
        </>
      )}

      <H>Your date of birth</H>
      <P>
        If you go to create an account we ask when you were born, because we are only allowed
        to make accounts for people aged 13 and over.
      </P>
      <P>
        We use it once, on your device, to work out whether you are old enough — and then we
        throw it away. Your date of birth is <B>never saved and never sent to us</B>. All that
        is kept is a single yes-or-no answer, in your own browser.
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
            Two services keep this thing online, and both see ordinary technical information
            like your IP address as a normal part of delivering a web page:
          </P>
          <UL>
            <LI>
              <B>Supabase</B> stores accounts and progress, and handles passwords. Your password
              is hashed on their servers and is never visible to us or stored on your device.
            </LI>
            <LI>
              <B>Vercel</B> serves the site itself.
            </LI>
          </UL>
          <P>Neither is given your information for their own purposes.</P>

          <H>Getting your data out, or getting rid of it</H>
          <P>
            Both live on your profile page, and neither requires emailing anyone or waiting:
          </P>
          <UL>
            <LI>
              <B>Export</B> downloads everything we hold about you as a file you can keep.
            </LI>
            <LI>
              <B>Delete my account</B> removes your account and your progress. It is immediate
              and permanent — we do not keep a copy, so please export first if you want one.
            </LI>
          </UL>
          <P>
            We keep your data until you delete it. If you would rather we did it for you, or you
            have any other question about your information, write to{' '}
            <A href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</A>.
          </P>

          <H>If you are under 13</H>
          <P>
            You are welcome to use the site — just not to make an account, because the law
            (COPPA in the United States) sets rules about collecting personal information from
            children under 13 that we are not set up to meet. So we do not collect any.
          </P>
          <P>
            If you are a parent and believe a child under 13 has somehow made an account, write
            to <A href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</A> and we will delete it.
          </P>
        </>
      )}

      <H>Cookies</H>
      <P>
        No tracking cookies, and no cookie banner, because there is nothing to consent to. Your
        browser stores your progress locally
        {cloudEnabled ? ', and if you are signed in it holds a token that keeps you signed in' : ''}
        . That is all.
      </P>

      <H>Changes</H>
      <P>
        If this policy changes, the date at the top changes with it. If a change actually
        affects what we collect, we will say so in the app rather than hoping you re-read this
        page.
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

      <H>Not affiliated with ACT, Inc.</H>
      <P>
        This is an independent study tool. It is <B>not made by, endorsed by, or connected to
        ACT, Inc.</B>, the organisation that writes and administers the ACT test. "ACT" is
        their registered trademark and is used here only to describe what the material covers.
      </P>
      <P>
        Every question, lesson and passage in this app was written for it. None of it is real
        exam material.
      </P>

      <H>About the scores</H>
      <P>
        The estimated composite is worked out from your accuracy on practice questions using an
        approximation of the published scoring curves. It is a way of seeing whether you are
        improving. It is <B>not a prediction of your real score</B>, it is not official, and no
        one should make a decision based on it that they would not make on a hunch.
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
        Studying is personal, so there is nothing here to moderate: no messaging, no comments,
        no public profiles, no way to send anything to another user.
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
            You can delete your account whenever you like, from your profile page. We may close
            an account that is being used to attack the service, which in practice means almost
            never.
          </P>
        </>
      )}

      <H>No warranty</H>
      <P>
        This is provided as it is, for free, with no guarantee that it will always be available
        or always be correct. We try hard to make the explanations right, but if you find a
        question with a bad answer, tell us at{' '}
        <A href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</A> and it will be fixed.
      </P>
      <P>
        To the extent the law allows, we are not liable for losses arising from using the site —
        including how a real test turns out. Preparation helps; it does not come with a promise.
      </P>

      <H>Changes</H>
      <P>
        These terms can change, and the date at the top will say when they last did. Continuing
        to use the site after a change means you are alright with it.
      </P>
    </article>
  );
}

/* ------------------------------------------------------------------ pieces */

function Title({ children }: { children: ReactNode }) {
  return (
    <h1 className="font-read text-[clamp(1.6rem,4vw,2.1rem)] font-semibold leading-tight text-ink">
      {children}
    </h1>
  );
}

function Updated() {
  return <p className="label-quill mt-2">Last updated {UPDATED}</p>;
}

function Lead({ children }: { children: ReactNode }) {
  return (
    <p className="mt-5 border-l-2 border-parchment-edge pl-4 font-read text-[1.08rem] font-medium leading-[1.75] text-ink">
      {children}
    </p>
  );
}

function H({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-8 font-read text-[1.22rem] font-semibold leading-snug text-ink">{children}</h2>
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
      <span aria-hidden="true" className="mt-[0.55em] h-[5px] w-[5px] flex-none rounded-full bg-ink-soft" />
      <span>{children}</span>
    </li>
  );
}

function B({ children }: { children: ReactNode }) {
  return <b className="font-semibold text-ink">{children}</b>;
}

function A({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="text-ink underline decoration-parchment-edge underline-offset-2 hover:decoration-ink">
      {children}
    </a>
  );
}
