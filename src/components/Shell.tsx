/* App chrome: the top bar, the nav, and the layout wrapper every signed-in
   screen renders inside. Arcade register throughout — this is chrome, not
   reading surface. */

import { useEffect, useState, type ReactNode } from 'react';
import { hrefFor, useNavigate, useRoute, type Route } from '@/lib/router';
import { useStore } from '@/lib/store';
import { rankProgress } from '@/lib/progress';
import { isMuted, onMutedChange, sfx, toggleMuted } from '@/lib/sfx';
import { cx } from '@/lib/utils';
import { PixelIcon, type IconName } from './PixelIcon';
import { RankBadge } from './ui';

interface NavItem {
  label: string;
  icon: IconName;
  route: Route;
  match: Route['name'][];
}

const NAV: NavItem[] = [
  { label: 'Home', icon: 'compass', route: { name: 'home' }, match: ['home'] },
  { label: 'Map', icon: 'map', route: { name: 'map' }, match: ['map', 'path', 'zone'] },
  { label: 'Notes', icon: 'book', route: { name: 'notes' }, match: ['notes', 'note'] },
  { label: 'Drills', icon: 'sword', route: { name: 'drills' }, match: ['drills', 'drill'] },
  { label: 'Review', icon: 'refresh', route: { name: 'review' }, match: ['review'] },
  { label: 'Tests', icon: 'clock', route: { name: 'tests' }, match: ['tests', 'test', 'report'] },
  { label: 'Stats', icon: 'chart', route: { name: 'stats' }, match: ['stats'] },
];

function MuteButton() {
  const [muted, setMuted] = useState(isMuted);
  useEffect(() => onMutedChange(setMuted), []);
  return (
    <button
      type="button"
      onClick={() => setMuted(toggleMuted())}
      className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-edge bg-ink-800 text-[#a89ac6] transition-colors hover:border-edge-bright hover:text-white"
      aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
      title={muted ? 'Sound off' : 'Sound on'}
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

  // Close the mobile menu whenever the route changes.
  useEffect(() => setMenuOpen(false), [route]);

  return (
    <header className="sticky top-0 z-50 border-b-2 border-edge bg-ink-950/92 backdrop-blur">
      <div className="shell flex h-14 items-center gap-3">
        <a
          href={hrefFor({ name: 'home' })}
          onClick={() => sfx.select()}
          className="flex items-center gap-2.5 font-pixel text-[11px] uppercase tracking-wide text-white"
        >
          <PixelIcon name="star" unit={2} />
          <span className="hidden sm:inline">ACT Command</span>
        </a>

        {/* desktop nav */}
        <nav className="ml-4 hidden items-center gap-0.5 lg:flex" aria-label="Main">
          {NAV.map((item) => {
            const active = item.match.includes(route.name);
            return (
              <a
                key={item.label}
                href={hrefFor(item.route)}
                onClick={() => sfx.select()}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'rounded-md px-3 py-2 font-screen text-[12px] uppercase tracking-wide transition-colors',
                  active ? 'bg-ink-750 text-gold' : 'text-[#a89ac6] hover:bg-ink-800 hover:text-white',
                )}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          {syncing && (
            <span className="hidden font-screen text-[10px] uppercase tracking-wide text-[#6f6496] sm:inline">
              Syncing…
            </span>
          )}

          <a
            href={hrefFor({ name: 'profile' })}
            onClick={() => sfx.select()}
            className="flex items-center gap-2.5 rounded-lg border-2 border-edge bg-ink-850 px-2.5 py-1.5 transition-colors hover:border-edge-bright"
            aria-label="Your profile and rank"
          >
            <RankBadge rank={rank} size={26} />
            <span className="hidden text-left leading-tight sm:block">
              <span className="block font-screen text-[10px] uppercase tracking-wide text-[#a89ac6]">
                {isGuest ? 'Guest' : playerName}
              </span>
              <span className="num block text-[15px] leading-none text-gold">
                {progress.xp.toLocaleString()}
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
            className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-edge bg-ink-800 text-[#a89ac6] transition-colors hover:text-white lg:hidden"
            aria-expanded={menuOpen}
            aria-label="Menu"
          >
            <span className="text-[15px]">{menuOpen ? '✕' : '☰'}</span>
          </button>
        </div>
      </div>

      {/* rank progress hairline */}
      <div className="h-1 w-full bg-ink-900">
        <div
          className="h-full transition-[width] duration-700 ease-out"
          style={{ width: `${pct * 100}%`, background: rank.color, boxShadow: `0 0 8px ${rank.color}` }}
          title={next ? `${next.xp - progress.xp} XP to ${next.name}` : 'Maximum rank'}
        />
      </div>

      {/* mobile nav */}
      {menuOpen && (
        <nav className="border-t-2 border-edge bg-ink-900 lg:hidden" aria-label="Main">
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
                    'flex items-center gap-2.5 rounded-lg border-2 px-3 py-2.5 text-left font-screen text-[12px] uppercase tracking-wide transition-colors',
                    active
                      ? 'border-edge-bright bg-ink-750 text-gold'
                      : 'border-edge bg-ink-850 text-[#a89ac6]',
                  )}
                >
                  <PixelIcon name={item.icon} unit={2} />
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

/** Standard page wrapper. */
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
    <main
      className={cx('shell py-7 sm:py-9', className)}
      style={wide ? { maxWidth: '1400px' } : undefined}
    >
      {children}
    </main>
  );
}

/** Back link used at the top of every drill-down screen. */
export function BackLink({ to, label }: { to: Route; label: string }) {
  return (
    <a
      href={hrefFor(to)}
      onClick={() => sfx.select()}
      className="mb-5 inline-flex items-center gap-2 font-screen text-[11px] uppercase tracking-wide text-[#8f86b5] transition-colors hover:text-gold"
    >
      ← {label}
    </a>
  );
}
