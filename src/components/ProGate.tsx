/* The wall, and what stands in front of it.
 *
 * Two rules this file exists to keep:
 *
 *   1. Screens ask `isPro` from the store and nothing else. No screen reads a
 *      status, compares a date, or knows what a trial is. There is one
 *      derivation (lib/entitlements.ts) and one offer (lib/features.ts), and
 *      everything else asks a boolean.
 *
 *   2. A locked thing is a door, not a wall. The visual language is the locked
 *      zone row from Study — a sigil and a reason — rather than a modal that
 *      interrupts. Nobody has ever been argued into a subscription by being
 *      interrupted.
 *
 * Note that this hides controls, not content: every question in the app ships
 * in the bundle regardless, which is a deliberate accepted trade recorded in
 * docs/monetization-plan.md §0. What is being sold is the app.
 */

import { useState, type ReactNode } from 'react';
import { hrefFor } from '@/lib/router';
import { useStore } from '@/lib/store';
import { redeemCode, trialDaysLeft, trialExpired } from '@/lib/entitlements';
import {
  FEATURES,
  FEATURE_ORDER,
  FREE_SECTIONS,
  lockedSectionBlurb,
  type Feature,
} from '@/lib/features';
import { SECTIONS } from '@/content/sections';
import { sfx } from '@/lib/sfx';
import { cx } from '@/lib/utils';
import { LockSigil } from '@/game/Sigils';
import { Vignette } from './Vignette';
import { Glyph } from './Icon';
import { Page } from './Shell';

/** Where every upsell points. One destination, so it can be moved once. */
export function upsellHref(): string {
  return hrefFor({ name: 'profile' });
}

/**
 * Render `children` for Pro, and an upsell in their place otherwise.
 *
 * `feature` names what is locked so the panel can say what it is, using the
 * copy in features.ts rather than a string written at the call site — the
 * offer should read the same everywhere it appears.
 */
export function ProGate({
  feature,
  children,
  title,
  detail,
  page = false,
}: {
  feature: Feature;
  children: ReactNode;
  /** Overrides for the rare place the generic copy is wrong. */
  title?: string;
  detail?: string;
  /** True when the gate stands in for a whole screen rather than a panel
   *  inside one, so the upsell needs the page frame the screen would have
   *  supplied. Cheaper than making every caller write the conditional. */
  page?: boolean;
}) {
  const { isPro } = useStore();
  if (isPro) return <>{children}</>;
  const copy = FEATURES[feature];
  const upsell = <ProUpsell title={title ?? copy.name} detail={detail ?? copy.blurb} />;
  return page ? <Page>{upsell}</Page> : upsell;
}

/**
 * The panel itself, for the places that need it without wrapping anything —
 * a locked row in a list, a locked tab body.
 */
export function ProUpsell({
  title,
  detail,
  compact = false,
}: {
  title: string;
  detail: string;
  compact?: boolean;
}) {
  /* The button says the same thing every time it is seen, and it can only be
     seen by someone who is not Pro — a live trial unlocks everything, so an
     upsell never renders while one is running. There was a "Keep Pro — N days
     left" variant here for exactly that case; it was unreachable, and copy
     nobody can reach is copy nobody maintains. */
  return (
    <div
      className={cx(
        'flex flex-col items-center gap-3 rounded-xl border-2 border-gold-deep/50 bg-leather-900/40 text-center',
        compact ? 'px-5 py-6' : 'px-6 py-10',
      )}
    >
      {!compact && <Vignette name="chest" size={104} className="mb-1 opacity-90" />}
      <div className="flex items-center gap-2">
        <LockSigil size={16} className="text-gold" />
        <span className="eyebrow">Pro</span>
      </div>
      <div className="heading text-[17px]">{title}</div>
      <p className="max-w-sm font-read text-[15px] leading-relaxed text-parchment-dim">{detail}</p>
      <a href={upsellHref()} onClick={() => sfx.select()} className="btn btn-primary mt-1">
        See what Pro opens
      </a>
    </div>
  );
}

/**
 * The full list of what Pro is, for the pricing block and the trial-ended
 * screen. Reads from `features.ts`, so it cannot drift from what is gated.
 */
export function ProFeatureList() {
  /* Derived, not written down. Move a subject into FREE_SECTIONS and this line
     re-counts itself instead of quietly advertising the old offer. */
  const locked = SECTIONS.filter((s) => !FREE_SECTIONS.includes(s.id));
  return (
    <ul className="space-y-2.5 text-left">
      <ProFeatureRow
        name={locked.map((s) => s.name).join(', ')}
        blurb={lockedSectionBlurb(locked.length)}
      />
      {FEATURE_ORDER.map((f) => (
        <ProFeatureRow key={f} name={FEATURES[f].name} blurb={FEATURES[f].blurb} />
      ))}
    </ul>
  );
}

function ProFeatureRow({ name, blurb }: { name: string; blurb: string }) {
  return (
    <li className="flex items-start gap-3 rounded-lg border-2 border-leather-700 bg-leather-850 px-4 py-3">
      <Glyph name="spark" size={13} className="mt-1 flex-none text-gold" />
      <span>
        <span className="block font-display text-[13.5px] font-semibold text-parchment">
          {name}
        </span>
        <span className="mt-0.5 block font-read text-[13.5px] leading-snug text-parchment-dim">
          {blurb}
        </span>
      </span>
    </li>
  );
}

/* ------------------------------------------------------------- the plan */

/* What the person currently has, on the one screen every upsell points at.
 *
 * This is also the trial-ended state. There is no separate "your trial is
 * over" screen and there should not be: a screen that exists only to tell you
 * something is gone has nothing to offer, whereas this one answers the two
 * questions actually being asked — what do I still have, and what does the
 * rest cost. Everything free stays reachable behind it; the app does not lock
 * itself when the clock runs out.
 */
export function PlanPanel() {
  const { entitlement, isPro } = useStore();
  const days = trialDaysLeft(entitlement);
  const ended = trialExpired(entitlement);
  const byCode = entitlement?.source === 'code';

  let eyebrow: string;
  let line: string;
  if (byCode && isPro) {
    eyebrow = 'Pro · unlocked';
    line = 'Every subject and every system, with no renewal date.';
  } else if (ended) {
    eyebrow = 'Free';
    line =
      'Your trial has ended. English stays open in full — the road, its drills and its notes — along with everything you have already earned.';
  } else if (days !== null) {
    eyebrow = days === 0 ? 'Free trial · ends today' : `Free trial · ${days} days left`;
    line =
      'You have the whole app while the trial runs — every subject, the Summit, spaced review and the guardians.';
  } else if (isPro) {
    eyebrow = 'Pro';
    line = 'Every subject and every system.';
  } else {
    eyebrow = 'Free';
    line = 'English stays open in full: the road, its drills and its notes.';
  }

  return (
    <div className="panel mb-6 p-6 sm:p-7">
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="heading text-[12px] text-parchment">Your plan</h3>
        <span className="font-script text-[11px] uppercase tracking-[0.14em] text-gold">
          {eyebrow}
        </span>
      </div>
      <p className="mb-5 text-[13.5px] leading-relaxed text-ink-faint">{line}</p>

      {!isPro || days !== null ? (
        <>
          <ProFeatureList />
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="num text-[26px] leading-none text-parchment">$4.99</span>
            <span className="font-script text-[11px] uppercase tracking-wide text-ink-faint">
              a month · cancel any time
            </span>
          </div>
          {/* Checkout is Phase 3 in docs/monetization-plan.md — the processor
              account and its review queue are the long pole, and nothing here
              needed to wait on them. Saying so beats a button that does
              nothing when pressed. */}
          <p className="mt-3 font-read text-[13px] leading-relaxed text-ink-faint">
            Card payment is not switched on yet.
          </p>
          <RedeemField />
        </>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------ redeeming */

/* The box you paste an unlock code into.
 *
 * Everything it knows how to do is show a message the server gave it. There is
 * no validation here beyond "you typed something" — a client that could tell a
 * good code from a bad one would be a client holding the answer, and the whole
 * scheme depends on it not having one.
 *
 * Hidden behind a link rather than sitting open, because for almost everyone
 * this field is noise: it is for the person who was handed a code, and putting
 * an empty "enter your code" box under the price makes everyone else wonder
 * what they are missing.
 */
function RedeemField() {
  const { refreshEntitlement } = useStore();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);

    const res = await redeemCode(code);
    if (res.status === 'error') {
      setMessage({ ok: false, text: res.message });
      setBusy(false);
      sfx.wrong();
      return;
    }

    /* Read the grant back rather than assuming what it was. The server decides
       what a code buys — `grants` is a column — so believing our own optimistic
       guess here would be the one place in this file with an opinion about
       entitlement. */
    await refreshEntitlement();
    setMessage({
      ok: true,
      text: res.alreadyHeld ? 'That code is already on this account.' : 'Unlocked. Welcome to Pro.',
    });
    setCode('');
    setBusy(false);
    sfx.correct();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          sfx.select();
          setOpen(true);
        }}
        className="mt-4 font-read text-[13px] text-parchment-dim underline underline-offset-4 transition-colors hover:text-parchment"
      >
        I have an unlock code
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-4">
      <label
        htmlFor="redeem-code"
        className="mb-2 block font-script text-[10px] uppercase tracking-[0.14em] text-ink-faint"
      >
        Unlock code
      </label>
      <div className="flex flex-wrap gap-2.5">
        <input
          id="redeem-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          disabled={busy}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          /* Lower case on purpose. Upper case would be a well-formed code
             as far as any scanner is concerned — including the test in
             redemption.test.ts that fails the build if a real one ever lands
             in the tree — and a placeholder that reads as a value is a
             placeholder someone eventually tries to submit. */
          placeholder="xxxxx-xxxxx-xxxxx-xxxxx-xxxxx"
          className="min-w-0 flex-1 rounded-lg border-2 border-leather-700 bg-leather-900 px-3.5 py-2.5 font-mono text-[14px] uppercase tracking-wide text-parchment placeholder:normal-case placeholder:tracking-normal placeholder:text-ink-faint focus:border-gold-deep focus:outline-none"
        />
        <button type="submit" disabled={busy} className="btn btn-primary flex-none">
          {busy ? 'Checking…' : 'Unlock'}
        </button>
      </div>
      {message && (
        <p
          /* Announced, because the only thing that changes on a wrong code is
             this line — a screen reader user would otherwise press Unlock and
             be told nothing at all. */
          role="status"
          aria-live="polite"
          className={cx(
            'mt-2.5 font-read text-[13px] leading-relaxed',
            message.ok ? 'text-woods-text' : 'text-blood-text',
          )}
        >
          {message.text}
        </p>
      )}
    </form>
  );
}
