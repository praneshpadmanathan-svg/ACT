/* Progress analytics and the profile / settings screen. */

import { useMemo, useState } from 'react';
import { LIBRARY_STATS, PATH_BY_ID, SECTIONS, SECTION_BY_ID } from '@/content';
import { useNavigate } from '@/lib/router';
import { useStore } from '@/lib/store';
import {
  ACHIEVEMENTS,
  RANKS,
  dailyActivity,
  estimatedComposite,
  rankProgress,
  sectionAccuracy,
  topicStats,
} from '@/lib/progress';
import { cloudEnabled } from '@/lib/supabase';
import { downloadProgress } from '@/lib/exportData';
import { cx, formatRelative, titleCase } from '@/lib/utils';
import { Page } from '@/components/Shell';
import { Button, ProgressBar, RankBadge, SectionHeading, EmptyState } from '@/components/ui';
import { DiagnosticsPanel, DisplaySettings } from '@/components/Settings';
import { HeroChooser } from '@/game/HeroChooser';
import { HeroAvatar } from '@/game/HeroAvatar';

/* ---------------------------------------------------------------- stats */

export function StatsScreen() {
  const { progress } = useStore();

  const estimate = estimatedComposite(progress);
  const allTopics = useMemo(() => topicStats(progress).filter((t) => t.attempts >= 2), [progress]);

  /* Which sections do not yet carry the 8 answers a composite needs. Same
     threshold as estimatedComposite — kept in step by reading it from there. */
  const sectionsNeedingWork = useMemo(
    () => SECTIONS.filter((s) => sectionAccuracy(progress, s.id).n < 8),
    [progress],
  );

  /* Activity over the last 12 weeks. Read from the daily counts rather than
     re-bucketing the raw log, which no longer goes back far enough to ask. */
  const activity = useMemo(() => dailyActivity(progress, 84), [progress]);

  const maxActivity = Math.max(1, ...activity);
  const { answered, correct: totalCorrect } = progress.tally;
  const overallAccuracy = answered ? totalCorrect / answered : 0;

  if (answered === 0) {
    return (
      <Page>
        <SectionHeading eyebrow="Progress" title="Statistics" />
        <EmptyState
          title="Nothing to show yet"
          detail="Answer some questions and this fills up with accuracy by topic, an estimated composite, and your activity history."
        />
      </Page>
    );
  }

  return (
    <Page>
      <SectionHeading
        eyebrow="Progress"
        title="Statistics"
        detail="Everything here comes from questions you have actually answered."
      />

      {/* headline numbers */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Estimated composite" value={estimate !== null ? String(estimate) : '—'} color="#ffd23e" />
        <Tile label="Overall accuracy" value={`${Math.round(overallAccuracy * 100)}%`} color="#5ee6a8" />
        <Tile label="Questions answered" value={answered.toLocaleString()} color="#ff9d5c" />
        <Tile label="Day streak" value={String(progress.dayStreak)} color="#3ad6f0" />
      </div>

      {/* A composite needs two sections with real data behind it. Saying so
          beats a bare em-dash, which reads as "broken" rather than "not yet". */}
      {estimate === null && (
        <p className="mb-6 -mt-2 font-read text-[13.5px] leading-relaxed text-ink-faint">
          A composite needs at least <b className="text-parchment-dim">two sections</b> with eight or
          more answered questions each — it is an average, and averaging one section would flatter
          or punish you for no reason.
          {sectionsNeedingWork.length > 0 && (
            <>
              {' '}Still short in{' '}
              <b className="text-parchment-dim">
                {sectionsNeedingWork.map((s) => s.name).join(', ')}
              </b>
              .
            </>
          )}
        </p>
      )}

      {/* per section */}
      <h2 className="heading mb-4 text-[13px] text-parchment">By section</h2>
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {SECTIONS.map((section) => {
          const { n, ok, pct } = sectionAccuracy(progress, section.id);
          const path = PATH_BY_ID[section.id];
          const zones = path.nodes.filter((z) => progress.zonesCleared[z.id] !== undefined).length;

          return (
            <div key={section.id} className="rounded-lg border-2 border-leather-700 bg-leather-850 p-5 shadow-card">
              <div className="flex items-baseline justify-between">
                <h3 className="heading text-[12px]" style={{ color: section.color }}>
                  {section.name}
                </h3>
                <span className="num text-[26px]" style={{ color: section.color }}>
                  {n >= 5 ? `${Math.round(pct * 100)}%` : '—'}
                </span>
              </div>
              <div className="mt-3">
                <ProgressBar value={pct} color={section.color} height={8} />
              </div>
              <div className="mt-2.5 flex justify-between font-script text-[10px] uppercase tracking-wide text-ink-faint">
                <span>{ok}/{n} correct</span>
                <span>{zones}/{path.nodes.length} zones</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* activity */}
      <h2 className="heading mb-4 text-[13px] text-parchment">Last 12 weeks</h2>
      <div className="mb-6 rounded-lg border-2 border-leather-700 bg-leather-850 p-5 shadow-card">
        <div className="flex items-end gap-[3px]" style={{ height: 90 }}>
          {activity.map((count, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm transition-all"
              style={{
                height: `${Math.max(3, (count / maxActivity) * 100)}%`,
                background: count === 0 ? '#1d1640' : count > maxActivity * 0.6 ? '#ffd23e' : '#6a4ff0',
              }}
              title={`${count} question${count === 1 ? '' : 's'}`}
            />
          ))}
        </div>
        <div className="mt-3 flex justify-between font-script text-[10px] uppercase tracking-wide text-ink-faint">
          <span>12 weeks ago</span>
          <span>Today</span>
        </div>
      </div>

      {/* topics */}
      <h2 className="heading mb-4 text-[13px] text-parchment">Every topic you have tried</h2>
      <div className="space-y-2">
        {allTopics.map((t) => (
          <div
            key={`${t.section}-${t.topic}`}
            className="flex items-center gap-4 rounded-lg border-2 border-leather-700 bg-leather-850 px-4 py-3"
          >
            <span className="w-36 flex-none truncate font-sans text-[13px] font-semibold text-parchment sm:w-48">
              {titleCase(t.topic)}
            </span>
            <span
              className="hidden w-16 flex-none font-script text-[10px] uppercase tracking-wide sm:block"
              style={{ color: t.section === 'zone' ? '#8f86b5' : SECTION_BY_ID[t.section]?.color }}
            >
              {t.section === 'zone' ? 'Zone' : SECTION_BY_ID[t.section]?.name}
            </span>
            <ProgressBar
              value={t.accuracy}
              color={t.accuracy < 0.5 ? '#ff8298' : t.accuracy < 0.75 ? '#ffd23e' : '#5ee6a8'}
              height={8}
            />
            <span className="num w-14 flex-none text-right text-[15px] text-parchment-dim">
              {t.correct}/{t.attempts}
            </span>
            <span className="num hidden w-12 flex-none text-right text-[14px] text-ink-faint sm:block">
              {t.avgSeconds.toFixed(0)}s
            </span>
          </div>
        ))}
      </div>
    </Page>
  );
}

function Tile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border-2 border-leather-700 bg-leather-850 px-4 py-4 shadow-card">
      <div className="font-script text-[10px] uppercase leading-tight tracking-[0.12em] text-ink-faint">
        {label}
      </div>
      <div className="num mt-2 text-[32px] leading-none" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- profile */

export function ProfileScreen() {
  const navigate = useNavigate();
  const {
    progress,
    rank,
    rankIndex,
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

  const { pct, next } = rankProgress(progress.xp);
  const unlocked = new Set(progress.achievements);
  const [erasing, setErasing] = useState(false);
  const [eraseError, setEraseError] = useState<string | null>(null);

  return (
    <Page>
      <SectionHeading eyebrow="Your account" title="Profile" />

      {/* identity */}
      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="panel p-6 text-center sm:p-7">
          {/* The traveller and the rank together. Previously this was the
              badge alone, which meant the one picture of "you" in the whole
              app was a heraldic device rather than a person. */}
          <div className="flex items-end justify-center gap-1">
            <HeroAvatar hero={progress.hero} size={92} />
            <div className="-ml-6 mb-1">
              <RankBadge rank={rank} size={54} />
            </div>
          </div>
          <h2 className="heading mt-3 text-[14px] text-parchment">{playerName}</h2>
          <p className="mt-2 font-script text-[11px] uppercase tracking-wide" style={{ color: rank.color }}>
            {rank.name}
          </p>
          <p className="mt-1 text-[13px] text-ink-faint">{rank.tagline}</p>

          <div className="mt-5">
            <ProgressBar value={pct} color={rank.color} />
            <p className="mt-2 font-script text-[10px] uppercase tracking-wide text-ink-faint">
              {progress.xp.toLocaleString()} XP
              {next ? ` · ${(next.xp - progress.xp).toLocaleString()} to ${next.name}` : ' · max rank'}
            </p>
          </div>
        </div>

        <div className="panel p-6 sm:p-7">
          <h3 className="heading mb-5 text-[12px] text-parchment">Settings</h3>

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
                      ? 'border-gold bg-gold text-[#2a2000]'
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
          <label className="mb-5 block">
            <span className="mb-2 block font-script text-[10px] uppercase tracking-[0.14em] text-ink-faint">
              Test date
            </span>
            <div className="flex flex-wrap items-center gap-2.5">
              <input
                type="date"
                value={progress.profile?.testDate ?? ''}
                onChange={(e) =>
                  updateProgress((p) => ({
                    ...p,
                    profile: p.profile
                      ? { ...p.profile, testDate: e.target.value || null }
                      : p.profile,
                  }))
                }
                className="rounded-lg border-2 border-leather-700 bg-leather-900 px-3.5 py-2 font-read text-[14px] text-parchment outline-none transition-colors focus:border-gold-deep"
              />
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

          <div className="border-t-2 border-leather-700 pt-5">
            <span className="mb-2.5 block font-script text-[10px] uppercase tracking-[0.14em] text-ink-faint">
              Account
            </span>

            {isGuest ? (
              <>
                <p className="mb-3 text-[13px] leading-relaxed text-ink-faint">
                  {cloudEnabled
                    ? 'You are playing without an account, so progress lives in this browser only — clearing your browser data would end the journey. An account carries it to your phone.'
                    : 'This deployment has no account server, so progress saves to this browser only.'}
                </p>
                {cloudEnabled && (
                  <Button variant="primary" onClick={() => navigate({ name: 'auth', mode: 'signup' })}>
                    Save my progress
                  </Button>
                )}
              </>
            ) : (
              <>
                <p className="mb-3 text-[13px] leading-relaxed text-ink-faint">
                  Signed in as <b className="text-parchment">{playerName}</b>. Your progress syncs
                  to every device you sign in on.
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

            {/* Your data, on your terms — and export sits next to delete on
                purpose, so erasing everything is never the only way out. */}
            <div className="mt-5 border-t-2 border-leather-700 pt-5">
              <span className="mb-2.5 block font-script text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                Your data
              </span>
              <Button
                variant="ghost"
                onClick={() =>
                  downloadProgress(progress, isGuest ? undefined : { name: playerName })
                }
              >
                Download everything ▾
              </Button>
              <p className="mt-2.5 text-[12px] leading-relaxed text-ink-faint">
                A file with all of it — XP, accuracy by topic, test results, achievements.
              </p>
            </div>

            {lastSyncError && (
              <p className="mt-3 rounded-lg border-2 border-blood/40 bg-blood/10 px-3 py-2 text-[12px] leading-snug text-[#e8a094]">
                {lastSyncError}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* traveller */}
      <div className="panel mb-6 p-6 sm:p-7">
        <h3 className="heading mb-1.5 text-[12px] text-parchment">Your traveller</h3>
        <p className="mb-5 text-[13px] leading-relaxed text-ink-faint">
          Nothing here is locked and nothing has to be earned. Pick whoever you want to be on the
          road; you can change it whenever you like.
        </p>
        <HeroChooser />
      </div>

      {/* display and accessibility */}
      <DisplaySettings />

      {/* ranks */}
      <h2 className="heading mb-4 text-[13px] text-parchment">Ranks</h2>
      <div className="mb-6 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {RANKS.map((r, i) => (
          <div
            key={r.name}
            className={cx(
              'flex items-center gap-3.5 rounded-lg border-2 px-4 py-3.5',
              i <= rankIndex ? 'border-leather-700 bg-leather-850' : 'border-leather-700/50 bg-leather-900 opacity-55',
            )}
          >
            <RankBadge rank={r} size={38} />
            <div className="min-w-0">
              <div className="truncate font-script text-[11px] uppercase tracking-wide" style={{ color: r.color }}>
                {r.name}
              </div>
              <div className="num text-[15px] text-ink-faint">{r.xp.toLocaleString()} XP</div>
            </div>
          </div>
        ))}
      </div>

      {/* achievements */}
      <h2 className="heading mb-4 text-[13px] text-parchment">
        Achievements ({unlocked.size}/{ACHIEVEMENTS.length})
      </h2>
      <div className="mb-6 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {ACHIEVEMENTS.map((a) => {
          const got = unlocked.has(a.id);
          return (
            <div
              key={a.id}
              className={cx(
                'flex items-start gap-3.5 rounded-lg border-2 px-4 py-3.5',
                got ? 'border-gold/50 bg-leather-850' : 'border-leather-700/50 bg-leather-900 opacity-50',
              )}
            >
              <span className="mt-0.5 flex-none text-[15px] text-gold" aria-hidden="true">✦</span>
              <div className="min-w-0">
                <div className="font-script text-[12px] uppercase tracking-wide text-parchment">{a.name}</div>
                <div className="mt-0.5 text-[12px] leading-snug text-ink-faint">{a.detail}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* library + danger zone */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-6">
          <h3 className="heading mb-4 text-[12px] text-parchment">Your library</h3>
          <dl className="space-y-2 text-[14px]">
            <Row label="Note pages read" value={`${progress.notesRead.length} / ${LIBRARY_STATS.notePages}`} />
            <Row
              label="Zones cleared"
              value={`${Object.keys(progress.zonesCleared).length} / ${LIBRARY_STATS.zones}`}
            />
            <Row label="Tests taken" value={String(progress.testHistory.length)} />
            <Row label="Questions in review" value={String(Object.keys(progress.review).length)} />
            {progress.profile && (
              <Row label="Plan created" value={formatRelative(progress.profile.savedAt)} />
            )}
          </dl>
        </div>

        <div className="rounded-lg border-2 border-blood/40 bg-leather-850 p-6">
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
      </div>

      {/* Last on the page on purpose: nobody goes looking for this until
          something has already gone wrong, and it is the only block here that
          is addressed to us rather than to the student. */}
      <DiagnosticsPanel />
    </Page>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-leather-700/50 pb-2 last:border-0">
      <dt className="text-ink-faint">{label}</dt>
      <dd className="num text-[17px] text-parchment">{value}</dd>
    </div>
  );
}
