/* Progress analytics and the profile / settings screen. */

import { useMemo } from 'react';
import { LIBRARY_STATS, PATH_BY_ID, SECTIONS, SECTION_BY_ID } from '@/content';
import { useNavigate } from '@/lib/router';
import { useStore } from '@/lib/store';
import {
  ACHIEVEMENTS,
  RANKS,
  estimatedComposite,
  rankProgress,
  sectionAccuracy,
  topicStats,
} from '@/lib/progress';
import { cloudEnabled } from '@/lib/supabase';
import { cx, formatRelative, titleCase } from '@/lib/utils';
import { Page } from '@/components/Shell';
import { PixelIcon } from '@/components/PixelIcon';
import { Button, ProgressBar, RankBadge, SectionHeading, EmptyState } from '@/components/ui';
import { HEROES, HeroSprite } from '@/game/heroes';

/* ---------------------------------------------------------------- stats */

export function StatsScreen() {
  const { progress } = useStore();

  const estimate = estimatedComposite(progress);
  const allTopics = useMemo(() => topicStats(progress).filter((t) => t.attempts >= 2), [progress]);

  /* Activity over the last 12 weeks, bucketed by day. */
  const activity = useMemo(() => {
    const days = 84;
    const buckets = new Array(days).fill(0);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    for (const a of progress.attempts) {
      const daysAgo = Math.floor((startOfToday.getTime() - a.at) / 86_400_000);
      if (daysAgo >= 0 && daysAgo < days) buckets[days - 1 - daysAgo] += 1;
    }
    return buckets;
  }, [progress.attempts]);

  const maxActivity = Math.max(1, ...activity);
  const totalCorrect = progress.attempts.filter((a) => a.correct).length;
  const overallAccuracy = progress.attempts.length ? totalCorrect / progress.attempts.length : 0;

  if (progress.attempts.length === 0) {
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
        <Tile label="Questions answered" value={progress.attempts.length.toLocaleString()} color="#ff9d5c" />
        <Tile label="Day streak" value={String(progress.dayStreak)} color="#3ad6f0" />
      </div>

      {/* per section */}
      <h2 className="heading-pixel mb-4 text-[13px] text-white">By section</h2>
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {SECTIONS.map((section) => {
          const { n, ok, pct } = sectionAccuracy(progress, section.id);
          const path = PATH_BY_ID[section.id];
          const zones = path.nodes.filter((z) => progress.zonesCleared[z.id] !== undefined).length;

          return (
            <div key={section.id} className="rounded-lg border-2 border-edge bg-ink-850 p-5 shadow-pixel">
              <div className="flex items-baseline justify-between">
                <h3 className="heading-pixel text-[12px]" style={{ color: section.color }}>
                  {section.name}
                </h3>
                <span className="num text-[26px]" style={{ color: section.color }}>
                  {n >= 5 ? `${Math.round(pct * 100)}%` : '—'}
                </span>
              </div>
              <div className="mt-3">
                <ProgressBar value={pct} color={section.color} height={8} />
              </div>
              <div className="mt-2.5 flex justify-between font-screen text-[10px] uppercase tracking-wide text-[#6f6496]">
                <span>{ok}/{n} correct</span>
                <span>{zones}/{path.nodes.length} zones</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* activity */}
      <h2 className="heading-pixel mb-4 text-[13px] text-white">Last 12 weeks</h2>
      <div className="mb-6 rounded-lg border-2 border-edge bg-ink-850 p-5 shadow-pixel">
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
        <div className="mt-3 flex justify-between font-screen text-[10px] uppercase tracking-wide text-[#6f6496]">
          <span>12 weeks ago</span>
          <span>Today</span>
        </div>
      </div>

      {/* topics */}
      <h2 className="heading-pixel mb-4 text-[13px] text-white">Every topic you have tried</h2>
      <div className="space-y-2">
        {allTopics.map((t) => (
          <div
            key={`${t.section}-${t.topic}`}
            className="flex items-center gap-4 rounded-lg border-2 border-edge bg-ink-850 px-4 py-3"
          >
            <span className="w-36 flex-none truncate font-sans text-[13px] font-semibold text-white sm:w-48">
              {titleCase(t.topic)}
            </span>
            <span
              className="hidden w-16 flex-none font-screen text-[10px] uppercase tracking-wide sm:block"
              style={{ color: t.section === 'zone' ? '#8f86b5' : SECTION_BY_ID[t.section]?.color }}
            >
              {t.section === 'zone' ? 'Zone' : SECTION_BY_ID[t.section]?.name}
            </span>
            <ProgressBar
              value={t.accuracy}
              color={t.accuracy < 0.5 ? '#ff8298' : t.accuracy < 0.75 ? '#ffd23e' : '#5ee6a8'}
              height={8}
            />
            <span className="num w-14 flex-none text-right text-[15px] text-[#a89ac6]">
              {t.correct}/{t.attempts}
            </span>
            <span className="num hidden w-12 flex-none text-right text-[14px] text-[#6f6496] sm:block">
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
    <div className="rounded-lg border-2 border-edge bg-ink-850 px-4 py-4 shadow-pixel">
      <div className="font-screen text-[10px] uppercase leading-tight tracking-[0.12em] text-[#8f86b5]">
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
    userId,
    syncing,
    lastSyncError,
    signOut,
    syncNow,
    updateProgress,
    resetEverything,
  } = useStore();

  const { pct, next } = rankProgress(progress.xp);
  const unlocked = new Set(progress.achievements);

  return (
    <Page>
      <SectionHeading eyebrow="Your account" title="Profile" />

      {/* identity */}
      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="pixel-panel p-6 text-center sm:p-7">
          <RankBadge rank={rank} size={82} />
          <h2 className="heading-pixel mt-4 text-[14px] text-white">{playerName}</h2>
          <p className="mt-2 font-screen text-[11px] uppercase tracking-wide" style={{ color: rank.color }}>
            {rank.name}
          </p>
          <p className="mt-1 text-[13px] text-[#8f86b5]">{rank.tagline}</p>

          <div className="mt-5">
            <ProgressBar value={pct} color={rank.color} />
            <p className="mt-2 font-screen text-[10px] uppercase tracking-wide text-[#6f6496]">
              {progress.xp.toLocaleString()} XP
              {next ? ` · ${(next.xp - progress.xp).toLocaleString()} to ${next.name}` : ' · max rank'}
            </p>
          </div>
        </div>

        <div className="pixel-panel p-6 sm:p-7">
          <h3 className="heading-pixel mb-5 text-[12px] text-white">Settings</h3>

          <label className="mb-5 block">
            <span className="mb-2 block font-screen text-[10px] uppercase tracking-[0.14em] text-[#8f86b5]">
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
                      : 'border-edge bg-ink-800 text-[#a89ac6] hover:border-edge-bright',
                  )}
                >
                  {score}
                </button>
              ))}
            </div>
          </label>

          <div className="mb-5">
            <span className="mb-2 block font-screen text-[10px] uppercase tracking-[0.14em] text-[#8f86b5]">
              Character
            </span>
            <div className="flex flex-wrap gap-2">
              {HEROES.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => updateProgress((p) => ({ ...p, hero: h.id }))}
                  className={cx(
                    'rounded-lg border-2 px-4 py-3 transition-colors',
                    progress.hero === h.id
                      ? 'border-gold bg-ink-750'
                      : 'border-edge bg-ink-800 hover:border-edge-bright',
                  )}
                  aria-label={h.name}
                  title={h.name}
                >
                  <HeroSprite hero={h} unit={3} animate={false} />
                </button>
              ))}
            </div>
          </div>

          <div className="border-t-2 border-edge pt-5">
            <span className="mb-2.5 block font-screen text-[10px] uppercase tracking-[0.14em] text-[#8f86b5]">
              Account
            </span>

            {isGuest || !userId ? (
              <>
                <p className="mb-3 text-[13px] leading-relaxed text-[#8f86b5]">
                  {cloudEnabled
                    ? 'You are playing as a guest. Progress is saved in this browser only.'
                    : 'Cloud sync is not configured for this deployment, so progress saves to this browser only.'}
                </p>
                {cloudEnabled && (
                  <Button variant="primary" onClick={() => navigate({ name: 'auth', mode: 'signup' })}>
                    Create an account
                  </Button>
                )}
              </>
            ) : (
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
            )}

            {lastSyncError && (
              <p className="mt-3 rounded-lg border-2 border-crimson/40 bg-crimson/10 px-3 py-2 text-[12px] leading-snug text-[#ffa3b5]">
                {lastSyncError}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ranks */}
      <h2 className="heading-pixel mb-4 text-[13px] text-white">Ranks</h2>
      <div className="mb-6 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {RANKS.map((r, i) => (
          <div
            key={r.name}
            className={cx(
              'flex items-center gap-3.5 rounded-lg border-2 px-4 py-3.5',
              i <= rankIndex ? 'border-edge bg-ink-850' : 'border-edge/50 bg-ink-900 opacity-55',
            )}
          >
            <RankBadge rank={r} size={38} />
            <div className="min-w-0">
              <div className="truncate font-screen text-[11px] uppercase tracking-wide" style={{ color: r.color }}>
                {r.name}
              </div>
              <div className="num text-[15px] text-[#6f6496]">{r.xp.toLocaleString()} XP</div>
            </div>
          </div>
        ))}
      </div>

      {/* achievements */}
      <h2 className="heading-pixel mb-4 text-[13px] text-white">
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
                got ? 'border-gold/50 bg-ink-850' : 'border-edge/50 bg-ink-900 opacity-50',
              )}
            >
              <PixelIcon name={a.icon} unit={3} />
              <div className="min-w-0">
                <div className="font-screen text-[12px] uppercase tracking-wide text-white">{a.name}</div>
                <div className="mt-0.5 text-[12px] leading-snug text-[#8f86b5]">{a.detail}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* library + danger zone */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="pixel-panel p-6">
          <h3 className="heading-pixel mb-4 text-[12px] text-white">Your library</h3>
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

        <div className="rounded-lg border-2 border-crimson/40 bg-ink-850 p-6">
          <h3 className="heading-pixel mb-3 text-[12px] text-crimson">Reset progress</h3>
          <p className="mb-4 text-[13px] leading-relaxed text-[#8f86b5]">
            Deletes all XP, attempts, cleared zones and test results from this browser. This cannot be
            undone.
          </p>
          <Button
            variant="danger"
            onClick={() => {
              const ok = window.confirm(
                'Delete all progress on this device? This cannot be undone.',
              );
              if (ok) resetEverything();
            }}
          >
            Reset everything
          </Button>
        </div>
      </div>
    </Page>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-edge/50 pb-2 last:border-0">
      <dt className="text-[#8f86b5]">{label}</dt>
      <dd className="num text-[17px] text-white">{value}</dd>
    </div>
  );
}
