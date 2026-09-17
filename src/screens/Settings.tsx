/* Settings — everything you change about the app, on one page.

   These controls used to live in the right-hand column of the profile, which
   made the one screen that answers "how am I doing" also the screen that holds
   sign-out, theme, reading width and delete-my-account. Two different jobs
   sharing a scroll: the progress you came to look at kept getting pushed under
   a form. Profile is now yours — rank, XP, traveller, ranks, achievements —
   and this is the machinery. */

import { useState } from 'react';
import { hrefFor, useNavigate } from '@/lib/router';
import { useStore } from '@/lib/store';
import { cloudEnabled } from '@/lib/supabase';
import { downloadProgress } from '@/lib/exportData';
import { cx } from '@/lib/utils';
import { Page } from '@/components/Shell';
import { Button, SectionHeading } from '@/components/ui';
import { Glyph } from '@/components/Icon';
import { DateField } from '@/components/fields';
import { DiagnosticsPanel, DisplaySettings } from '@/components/Settings';

export function SettingsScreen() {
  const thisYear = new Date().getFullYear();
  const navigate = useNavigate();
  const {
    progress,
    playerName,
    isGuest,
    syncing,
    lastSyncError,
    signOut,
    syncNow,
    updateProgress,
    resetEverything,
    deleteAccount,
  } = useStore();

  const [erasing, setErasing] = useState(false);
  const [eraseError, setEraseError] = useState<string | null>(null);

  return (
    <Page>
      <SectionHeading eyebrow="Your account" title="Settings" />

      {/* your test — the two things the whole app paces itself against, so
          they come first and nothing else on the page is about the ACT. */}
      <div className="panel mb-6 p-6 sm:p-7">
        <h3 className="heading mb-5 text-[12px] text-parchment">Your test</h3>

        <label className="mb-5 block">
          <span className="mb-2 block font-script text-[10px] uppercase tracking-[0.14em] text-ink-faint">
            Target score
          </span>
          <div className="flex flex-wrap gap-2">
            {[24, 27, 30, 33, 36].map((score) => (
              <button
                key={score}
                type="button"
                onClick={() => updateProgress((p) => ({ ...p, targetScore: score }))}
                className={cx(
                  'num rounded-lg border-2 px-4 py-2 text-[19px] transition-colors',
                  progress.targetScore === score
                    ? 'border-gilt bg-gilt text-[#2a2000]'
                    : 'border-leather-700 bg-leather-800 text-parchment-dim hover:border-gold-deep',
                )}
              >
                {score}
              </button>
            ))}
          </div>
        </label>

        {/* Onboarding promises this can be changed later, so it has to be
            changeable later. Clearing it stops the countdown rather than
            leaving a date that has quietly gone by. */}
        <label className="block">
          <span className="mb-2 block font-script text-[10px] uppercase tracking-[0.14em] text-ink-faint">
            Test date
          </span>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="min-w-[15rem] flex-1">
              <DateField
                value={progress.profile?.testDate ?? ''}
                onChange={(iso) =>
                  updateProgress((p) => ({
                    ...p,
                    profile: p.profile ? { ...p.profile, testDate: iso || null } : p.profile,
                  }))
                }
                fromYear={thisYear}
                toYear={thisYear + 2}
                ariaPrefix="Test date"
              />
            </div>
            {progress.profile?.testDate && (
              <Button
                variant="ghost"
                onClick={() =>
                  updateProgress((p) => ({
                    ...p,
                    profile: p.profile ? { ...p.profile, testDate: null } : p.profile,
                  }))
                }
              >
                Clear
              </Button>
            )}
          </div>
        </label>
      </div>

      {/* display, reading and accessibility */}
      <DisplaySettings />

      {/* account and data */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className="panel p-6 sm:p-7">
          <h3 className="heading mb-4 text-[12px] text-parchment">Account</h3>

          {isGuest ? (
            <>
              <p className="mb-3 text-[13px] leading-relaxed text-ink-faint">
                {cloudEnabled
                  ? 'You are playing without an account, so progress lives in this browser only — clearing your browser data would end the journey. An account carries it to your phone.'
                  : 'This deployment has no account server, so progress saves to this browser only.'}
              </p>
              {cloudEnabled && (
                <Button
                  variant="primary"
                  onClick={() => navigate({ name: 'auth', mode: 'signup' })}
                >
                  Save my progress
                </Button>
              )}
            </>
          ) : (
            <>
              <p className="mb-3 text-[13px] leading-relaxed text-ink-faint">
                Signed in as <b className="text-parchment">{playerName}</b>. Your progress syncs to
                every device you sign in on.
              </p>
              <div className="flex flex-wrap gap-2.5">
                <Button variant="ghost" onClick={() => void syncNow()} disabled={syncing}>
                  {syncing ? 'Syncing…' : 'Sync now'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    void signOut();
                    navigate({ name: 'landing' });
                  }}
                >
                  Sign out
                </Button>
              </div>
            </>
          )}

          {lastSyncError && (
            <p className="mt-3 rounded-lg border-2 border-blood/40 bg-blood/10 px-3 py-2 text-[12px] leading-snug text-[#e8a094]">
              {lastSyncError}
            </p>
          )}
        </div>

        {/* Your data, on your terms — and export sits beside delete on
            purpose, so erasing everything is never the only way out. */}
        <div className="panel p-6 sm:p-7">
          <h3 className="heading mb-4 text-[12px] text-parchment">Your data</h3>
          <Button
            variant="ghost"
            onClick={() => downloadProgress(progress, isGuest ? undefined : { name: playerName })}
          >
            Download everything
            <Glyph name="chevronDown" size={14} strokeWidth={2} className="-mr-1" />
          </Button>
          <p className="mt-2.5 text-[12px] leading-relaxed text-ink-faint">
            A file with all of it — XP, accuracy by topic, test results, achievements.
          </p>
        </div>
      </div>

      {/* The explainer was reachable from the landing page and nowhere else,
          which means the moment you actually have the question — mid-way
          through, looking at a number you do not trust — you are on a screen
          with no way to it. */}
      <div className="panel mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 p-5">
        <span className="font-script text-[10px] uppercase tracking-[0.14em] text-ink-faint">
          Questions about the app
        </span>
        <a
          href={hrefFor({ name: 'faq' })}
          className="font-read text-[13.5px] text-parchment-dim underline underline-offset-4 transition-colors hover:text-parchment"
        >
          What the ACT is, how accurate the score is, why it's free
        </a>
        <a
          href={hrefFor({ name: 'privacy' })}
          className="font-read text-[13.5px] text-parchment-dim underline underline-offset-4 transition-colors hover:text-parchment"
        >
          Privacy
        </a>
        <a
          href={hrefFor({ name: 'terms' })}
          className="font-read text-[13.5px] text-parchment-dim underline underline-offset-4 transition-colors hover:text-parchment"
        >
          Terms
        </a>
      </div>

      {/* danger zone */}
      <div className="mb-6 rounded-lg border-2 border-blood/40 bg-leather-850 p-6">
        <h3 className="heading mb-3 text-[12px] text-blood-text">Danger zone</h3>
        <p className="mb-4 text-[13px] leading-relaxed text-ink-faint">
          Deletes all XP, answers, cleared zones and test results
          {isGuest ? ' from this browser' : ', on every device and in the cloud'}. This cannot be
          undone — download your data first if you want to keep a copy.
        </p>
        <div className="flex flex-wrap gap-2.5">
          <Button
            variant="danger"
            disabled={erasing}
            onClick={() => {
              const ok = window.confirm(
                isGuest
                  ? 'Delete all progress on this device? This cannot be undone.'
                  : 'Delete all progress everywhere, including the cloud copy? Your account stays. This cannot be undone.',
              );
              if (ok) void resetEverything();
            }}
          >
            Reset progress
          </Button>

          {!isGuest && (
            <Button
              variant="danger"
              disabled={erasing}
              onClick={() => {
                /* Two prompts, because this one takes the account with it and
                   there is no undo, no grace period and no copy kept. */
                if (!window.confirm('Delete your account and all of your progress?')) return;
                if (
                  !window.confirm(
                    'Last check — this is permanent. Your account, your email and every bit of progress will be erased and cannot be recovered.',
                  )
                ) {
                  return;
                }
                setEraseError(null);
                setErasing(true);
                void deleteAccount().then((result) => {
                  if (!result.ok) {
                    setEraseError(result.error ?? 'Could not delete the account.');
                    setErasing(false);
                  }
                });
              }}
            >
              {erasing ? 'Deleting…' : 'Delete my account'}
            </Button>
          )}
        </div>

        {eraseError && (
          <p className="mt-3 rounded-lg border-2 border-blood/40 bg-blood/10 px-3 py-2 text-[12px] leading-snug text-[#e8a094]">
            {eraseError}
          </p>
        )}
      </div>

      {/* Last on the page on purpose: nobody goes looking for this until
          something has already gone wrong, and it is the only block here that
          is addressed to us rather than to the student. */}
      <DiagnosticsPanel />
    </Page>
  );
}
