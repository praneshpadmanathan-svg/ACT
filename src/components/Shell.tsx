/* App chrome — a leather-and-lantern top bar over every signed-in screen. */

import { useEffect, useState, type ReactNode } from 'react';
import { hrefFor, useNavigate, useRoute, type Route } from '@/lib/router';
import { useStore } from '@/lib/store';
import { rankProgress } from '@/lib/progress';
import { isMuted, onMutedChange, sfx, toggleMuted } from '@/lib/sfx';
import { cx } from '@/lib/utils';
import { RankBadge } from './ui';

interface NavItem {
  label: string;
  route: Route;
  match: Route['name'][];
}

const NAV: NavItem[] = [
  { label: 'Camp', route: { name: 'home' }, match: ['home'] },
  { label: 'Map', route: { name: 'map' }, match: ['map', 'path', 'zone'] },
  { label: 'Library', route: { name: 'notes' }, match: ['notes', 'note'] },
  { label: 'Training', route: { name: 'drills' }, match: ['drills', 'drill'] },
  { label: 'Review', route: { name: 'review' }, match: ['review'] },
  { label: 'Summit', route: { name: 'tests' }, match: ['tests', 'test', 'report'] },
  { label: 'Progress', route: { name: 'stats' }, match: ['stats'] },
];

function MuteButton() {
  const [muted, setMuted] = useState(isMuted);
  useEffect(() => onMutedChange(setMuted), []);
  return (
    <button
      type="button"
      onClick={() => setMuted(toggleMuted())}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-leather-700
                 bg-leather-800 text-parchment-dim transition-colors hover:border-gold-deep
                 hover:text-parchment"
      aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
    >
      <span className="text-[13px]">{muted ? '🔇' : '🔊'}</span>
    </button>
  );
}

export function TopBar() {
  const route = useRoute();
  const navigate = useNavigate();
  const { progress, rank, playerName, isGuest, syncing } = useStore();
  const { pct, next } = rankProgress(progress.xp);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [route]);

  return (
    <header className="sticky top-0 z-50 border-b border-leather-700 bg-leather-950/94 backdrop-blur">
      <div className="shell flex h-15 items-center gap-3 py-2.5">
        <a
          href={hrefFor({ name: 'home' })}
          onClick={() => sfx.select()}
          className="flex items-center gap-2 font-display text-[15px] font-semibold tracking-wide text-parchment"
        >
          <span className="text-gold" aria-hidden="true">✦</span>
          <span className="hidden sm:inline">ACT Command</span>
        </a>

        <nav className="ml-5 hidden items-center gap-0.5 lg:flex" aria-label="Main">
          {NAV.map((item) => {
            const active = item.match.includes(route.name);
            return (
              <a
                key={item.label}
                href={hrefFor(item.route)}
                onClick={() => sfx.select()}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'rounded-md px-3 py-2 font-display text-[14px] font-semibold tracking-wide transition-colors',
                  active
                    ? 'bg-leather-750 text-gold'
                    : 'text-parchment-dim hover:bg-leather-800 hover:text-parchment',
                )}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          {syncing && (
            <span className="label-sm hidden sm:inline">Syncing…</span>
          )}

          <a
            href={hrefFor({ name: 'profile' })}
            onClick={() => sfx.select()}
            className="flex items-center gap-2.5 rounded-lg border border-leather-700 bg-leather-850
                       px-2.5 py-1.5 transition-colors hover:border-gold-deep"
            aria-label="Your profile and rank"
          >
            <RankBadge rank={rank} size={26} />
            <span className="hidden text-left leading-tight sm:block">
              <span className="block font-script text-[12px] uppercase tracking-[0.12em] text-parchment-dim">
                {isGuest ? 'Traveller' : playerName}
              </span>
              <span className="num block text-[14px] leading-none text-gold">
                {progress.xp.toLocaleString()} xp
              </span>
            </span>
          </a>

          <MuteButton />

          <button
            type="button"
            onClick={() => {
              sfx.select();
              setMenuOpen((v) => !v);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-leather-700
                       bg-leather-800 text-parchment-dim transition-colors hover:text-parchment lg:hidden"
            aria-expanded={menuOpen}
            aria-label="Menu"
          >
            <span className="text-[15px]">{menuOpen ? '✕' : '☰'}</span>
          </button>
        </div>
      </div>

      {/* rank progress hairline */}
      <div className="h-[3px] w-full bg-leather-900">
        <div
          className="h-full bg-gradient-to-r from-gold-deep to-gold-bright transition-[width] duration-700 ease-out"
          style={{ width: `${pct * 100}%` }}
          title={next ? `${(next.xp - progress.xp).toLocaleString()} XP to ${next.name}` : 'Maximum rank'}
        />
      </div>

      {menuOpen && (
        <nav className="border-t border-leather-700 bg-leather-900 lg:hidden" aria-label="Main">
          <div className="shell grid grid-cols-2 gap-2 py-3 sm:grid-cols-3">
            {NAV.map((item) => {
              const active = item.match.includes(route.name);
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    sfx.select();
                    navigate(item.route);
                  }}
                  className={cx(
                    'rounded-lg border px-3 py-2.5 text-left font-display text-[14px] font-semibold transition-colors',
                    active
                      ? 'border-gold-deep bg-leather-750 text-gold'
                      : 'border-leather-700 bg-leather-850 text-parchment-dim',
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}

export function Page({
  children,
  className,
  wide,
}: {
  children: ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <main className={cx('shell py-7 sm:py-9', className)} style={wide ? { maxWidth: 1400 } : undefined}>
      {children}
    </main>
  );
}

export function BackLink({ to, label }: { to: Route; label: string }) {
  return (
    <a
      href={hrefFor(to)}
      onClick={() => sfx.select()}
      className="mb-5 inline-flex items-center gap-2 font-script text-[13px] uppercase
                 tracking-[0.16em] text-ink-faint transition-colors hover:text-gold"
    >
      ← {label}
    </a>
  );
}
