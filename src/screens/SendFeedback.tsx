/* Send feedback — bugs, wrong questions, ideas.

   Saved to the `feedback` table (migration 0006), which anyone can write to
   and nobody can read back through the app; the owner reads it in the
   dashboard. A report about one specific question still has its own button
   on the question itself, which carries the question's id — this page is for
   everything that is not tied to a single item.

   Email is the fallback, never the plan: plenty of students are on a school
   Chromebook with no mail app set up, so a `mailto:` link is a report that
   silently never gets sent. It appears only when the server cannot take the
   report — no account server configured, or the table not created yet. */

import { useState, type FormEvent } from 'react';
import { useStore } from '@/lib/store';
import { cloudEnabled, sendFeedback, type FeedbackKind } from '@/lib/supabase';
import { CONTACT, mailto } from '@/lib/contact';
import { readRaw, writeRaw } from '@/lib/storage';
import { sfx } from '@/lib/sfx';
import { cx } from '@/lib/utils';
import { Page } from '@/components/Shell';
import { Button, SectionHeading } from '@/components/ui';
import { FieldLabel, Select } from '@/components/fields';

const KINDS: { id: FeedbackKind; label: string; hint: string }[] = [
  {
    id: 'bug',
    label: 'Something’s broken',
    hint: 'A button that does nothing, a page that won’t load, lost progress.',
  },
  {
    id: 'content',
    label: 'Wrong question or answer',
    hint: 'A typo, a wrong key, an explanation that doesn’t add up.',
  },
  { id: 'idea', label: 'Idea', hint: 'Something you wish the app did.' },
  { id: 'other', label: 'Something else', hint: 'Anything at all.' },
];

const AREAS = [
  'Camp (home)',
  'Study and landmarks',
  'Library notes',
  'Training drills',
  'Review',
  'Duels',
  'Timed practice',
  'Progress and settings',
  'Logging in or my account',
  'Somewhere else',
];

/* One report a minute from this browser. Not security — the table's length
   caps are that — just a guard against a double-tapped button or a key held
   down sending the same report ten times. */
const LAST_SENT_KEY = 'act-command:feedback-last-sent';
const COOLDOWN_MS = 60_000;

export function FeedbackScreen() {
  const { isGuest } = useStore();
  const [kind, setKind] = useState<FeedbackKind>('bug');
  const [area, setArea] = useState('');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [offerEmail, setOfferEmail] = useState(!cloudEnabled);

  const emailHref = mailto(CONTACT.support, {
    subject: `ACT Command feedback: ${KINDS.find((k) => k.id === kind)?.label ?? kind}`,
    body: `${area ? `Where: ${area}\n\n` : ''}${message}`,
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (message.trim().length < 5) {
      setError('Tell us a little more — a sentence is plenty.');
      sfx.wrong();
      return;
    }
    const last = Number(readRaw(LAST_SENT_KEY) ?? 0);
    if (Date.now() - last < COOLDOWN_MS) {
      setError('You just sent one. Give it a minute before sending another.');
      return;
    }
    setBusy(true);
    try {
      const result = await sendFeedback({ kind, area, message, contact });
      if (result.ok) {
        writeRaw(LAST_SENT_KEY, String(Date.now()));
        sfx.achieve();
        setSent(true);
        return;
      }
      setError(
        result.missing
          ? 'Reports can’t be saved right now. You can send this one by email instead.'
          : result.error,
      );
      setOfferEmail(true);
      sfx.wrong();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
      setOfferEmail(true);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <Page>
        <SectionHeading eyebrow="Your account" title="Thanks — it’s sent" />
        <div className="panel max-w-2xl p-6 sm:p-7">
          <p className="font-read text-[15px] leading-relaxed text-parchment-dim">
            Every report is read.{' '}
            {contact.trim() ? 'If it needs a reply, it will go to the address you gave.' : ''}
          </p>
          <Button
            className="mt-5"
            onClick={() => {
              setSent(false);
              setMessage('');
              setArea('');
            }}
          >
            Send another
          </Button>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <SectionHeading eyebrow="Your account" title="Send feedback" />

      <form onSubmit={submit} className="panel max-w-2xl space-y-5 p-6 sm:p-7">
        <p className="font-read text-[14px] leading-relaxed text-ink-faint">
          Found a bug, a wrong answer, or have an idea? Tell us here. To flag one particular
          question, the flag button on that question is quicker — it tells us exactly which one.
        </p>

        <div role="group" aria-labelledby="feedback-kind">
          <span id="feedback-kind" className="mb-2 block">
            <FieldLabel>What kind of feedback?</FieldLabel>
          </span>
          <div className="grid gap-2 sm:grid-cols-2">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                aria-pressed={kind === k.id}
                onClick={() => {
                  sfx.select();
                  setKind(k.id);
                }}
                className={cx(
                  'rounded-lg border px-3.5 py-2.5 text-left transition-colors',
                  kind === k.id
                    ? 'border-gold-deep bg-leather-750 text-parchment'
                    : 'border-leather-700 bg-leather-900 text-parchment-dim hover:text-parchment',
                )}
              >
                <span className="block font-display text-[13.5px] font-semibold">{k.label}</span>
                <span className="mt-0.5 block font-read text-[12.5px] leading-snug text-ink-faint">
                  {k.hint}
                </span>
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <FieldLabel>Where in the app? (optional)</FieldLabel>
          <Select
            ariaLabel="Where in the app"
            value={area}
            onValueChange={setArea}
            options={AREAS.map((a) => ({ value: a, label: a }))}
            placeholder="Choose a part of the app"
          />
        </label>

        <label className="block">
          <FieldLabel>What happened?</FieldLabel>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            maxLength={4000}
            placeholder={
              kind === 'bug'
                ? 'What did you do, what did you expect, and what happened instead?'
                : 'Tell us as much as you like.'
            }
            className="w-full resize-y rounded-lg border border-leather-700 bg-leather-900 px-3.5 py-2.5 font-read text-[15px] leading-relaxed text-parchment transition-colors placeholder:text-ink-faint focus:border-gold-deep"
          />
          <span className="mt-1 block text-right font-read text-[11.5px] text-ink-faint">
            {message.length.toLocaleString()} / 4,000
          </span>
        </label>

        <label className="block">
          <FieldLabel>Email for a reply (optional)</FieldLabel>
          <input
            type="email"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            maxLength={200}
            autoComplete="email"
            placeholder="Only if you want an answer"
            className="w-full rounded-lg border border-leather-700 bg-leather-900 px-3.5 py-2.5 font-read text-[15px] text-parchment transition-colors placeholder:text-ink-faint focus:border-gold-deep"
          />
          <span className="mt-1 block font-read text-[12px] leading-snug text-ink-faint">
            {isGuest
              ? 'Leave it blank to stay anonymous.'
              : 'Your report is linked to your account either way, so this is only needed if you want the reply somewhere else.'}
          </span>
        </label>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-blood/50 bg-blood/10 px-3 py-2 font-read text-[13.5px] leading-snug text-blood-text"
          >
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {cloudEnabled && (
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? 'Sending…' : 'Send feedback'}
            </Button>
          )}
          {offerEmail && (
            <a className="btn btn-ghost" href={emailHref}>
              Send by email instead
            </a>
          )}
        </div>
      </form>
    </Page>
  );
}
