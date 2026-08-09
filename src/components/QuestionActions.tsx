/* The three things a student can do to a question other than answer it.
 *
 * All three came straight out of the review: "I can't flag a question I think
 * is wrong without emailing someone", "I can't bookmark a question to come
 * back to", and "no text-to-speech, which is a standard accommodation".
 *
 * They share a row because they are all secondary to answering and none of
 * them should compete with the choices for attention — small, quiet, on the
 * question's own header line.
 */

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { usePrefs } from '@/lib/prefs';
import { onSpeakingChange, speechSupported, stopSpeaking, toggleSpeech } from '@/lib/speech';
import { CONTACT, mailto } from '@/lib/contact';
import { cx } from '@/lib/utils';
import { Glyph } from './Icon';

function ActionButton({
  label,
  active,
  onClick,
  children,
  href,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  href?: string;
}) {
  const className = cx(
    'inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors',
    active
      ? 'border-gold-deep bg-[#f7eed6] text-[#8a5a12]'
      : 'border-parchment-edge bg-parchment-dim/60 text-ink-soft hover:border-ink-faint hover:text-ink',
  );

  if (href) {
    return (
      <a
        href={href}
        title={label}
        aria-label={label}
        target="_blank"
        rel="noreferrer"
        className={className}
      >
        {children}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={className}
    >
      {children}
    </button>
  );
}

/**
 * Read the question aloud.
 *
 * Only rendered when the setting is on *and* the browser has a synthesiser —
 * a play button that does nothing is worse than no play button. The stem, the
 * label and every choice are read as one continuous passage with the choices
 * announced by letter, because hearing four sentences with no "A." in front of
 * them is unusable.
 */
export function ReadAloudButton({ text }: { text: string }) {
  const { prefs } = usePrefs();
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => onSpeakingChange(setSpeaking), []);
  // Leaving the question mid-sentence should stop the voice, not race it.
  useEffect(() => () => stopSpeaking(), [text]);

  if (!prefs.readAloud || !speechSupported) return null;

  return (
    <ActionButton
      label={speaking ? 'Stop reading' : 'Read this aloud'}
      active={speaking}
      onClick={() => toggleSpeech(text)}
    >
      <Glyph name={speaking ? 'stop' : 'speaker'} size={15} />
    </ActionButton>
  );
}

/** Save a question to come back to. Synced, because "come back to it" often
 *  means "on the bus tomorrow", which is a different device. */
export function BookmarkButton({ questionId }: { questionId: string }) {
  const { progress, updateProgress } = useStore();
  const saved = progress.bookmarks.includes(questionId);

  return (
    <ActionButton
      label={saved ? 'Remove bookmark' : 'Bookmark this question'}
      active={saved}
      onClick={() =>
        updateProgress((p) => ({
          ...p,
          bookmarks: saved
            ? p.bookmarks.filter((id) => id !== questionId)
            : [...p.bookmarks, questionId],
        }))
      }
    >
      <Glyph name={saved ? 'bookmarkFilled' : 'bookmark'} size={15} />
    </ActionButton>
  );
}

/**
 * Report a question as wrong.
 *
 * There is no submissions backend and adding one for this would mean an
 * authenticated write endpoint, a moderation queue and a table of free text
 * written by minors — a large amount of new surface for a low-volume signal.
 * So it composes a pre-filled email instead, which reaches a human on the
 * first try and needs no infrastructure.
 *
 * The id is recorded locally either way, so the button can say "reported" on
 * a second visit and the student is not left wondering whether it went. That
 * list is deliberately *not* synced: it is a UI memory, not progress.
 */
const REPORTED_KEY = 'act-command:reported';

function readReported(): string[] {
  try {
    const raw = window.localStorage.getItem(REPORTED_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export function ReportButton({
  questionId,
  prompt,
  topic,
}: {
  questionId: string;
  prompt: string;
  topic: string;
}) {
  const [reported, setReported] = useState<string[]>(readReported);
  const already = reported.includes(questionId);

  const href = mailto(CONTACT.support, {
    subject: `Question looks wrong: ${questionId}`,
    body:
      `Question id: ${questionId}\n` +
      `Topic: ${topic}\n\n` +
      `The question says:\n${prompt.replace(/<[^>]+>/g, '').slice(0, 400)}\n\n` +
      `What looks wrong to me:\n`,
  });

  return (
    <ActionButton
      label={already ? 'You have reported this question' : 'Report a problem with this question'}
      active={already}
      href={href}
      onClick={() => {
        const next = [...new Set([...reported, questionId])].slice(-200);
        setReported(next);
        try {
          window.localStorage.setItem(REPORTED_KEY, JSON.stringify(next));
        } catch {
          /* A report that cannot be remembered still sends. */
        }
      }}
    >
      <Glyph name="flag" size={15} />
    </ActionButton>
  );
}

/** All three, in the order they matter. */
export function QuestionActions({
  questionId,
  spokenText,
  prompt,
  topic,
}: {
  questionId: string;
  spokenText: string;
  prompt: string;
  topic: string;
}) {
  return (
    <div className="ml-auto flex flex-none items-center gap-1.5">
      <ReadAloudButton text={spokenText} />
      <BookmarkButton questionId={questionId} />
      <ReportButton questionId={questionId} prompt={prompt} topic={topic} />
    </div>
  );
}
