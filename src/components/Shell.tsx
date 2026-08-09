/* App chrome.

   The nav is the thing you look at on every screen, so it carries the game
   feel without becoming noisy: a lit rail rather than a row of tabs. Each
   item has a drawn glyph, an underline that slides between destinations, and
   a hover lift. The rank sigil and XP live on the right as a HUD block.

   Everything is restrained on purpose — the map is where the game shouts. */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { hrefFor, useNavigate, useRoute, type Route } from '@/lib/router';
import { useStore } from '@/lib/store';
import { rankProgress } from '@/lib/progress';
import { isMuted, onMutedChange, sfx, toggleMuted } from '@/lib/sfx';
import { cx } from '@/lib/utils';
import { NavGlyph, type GlyphName } from './NavGlyph';
import { RankBadge } from './ui';

interface NavItem {
  label: string;
  glyph: GlyphName;
  route: Route;
  match: Route['name'][];
}

const NAV: NavItem[] = [
  { label: 'Camp', glyph: 'tent', route: { name: 'home' }, match: ['home'] },
  { label: 'Map', glyph: 'map', route: { name: 'map' }, match: ['map', 'path', 'zone', 'boss'] },
  { label: 'Library', glyph: 'book', route: { name: 'notes' }, match: ['notes', 'note'] },
  { label: 'Training', glyph: 'sword', route: { name: 'drills' }, match: ['drills', 'drill'] },
  { label: 'Review', glyph: 'hourglass', route: { name: 'review' }, match: ['review'] },
  { label: 'Summit', glyph: 'crown', route: { name: 'tests' }, match: ['tests', 'test', 'report'] },
  { label: 'Progress', glyph: 'chart', route: { name: 'stats' }, match: ['stats'] },
];

function MuteButton() {
  const [muted, setMuted] = useState(isMuted);
  useEffect(() => onMutedChange(setMuted), []);
  return (
    <button
      type="button"
      onClick={() => setMuted(toggleMuted())}
      className="hud-icon"
      aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
      title={muted ? 'Sound off' : 'Sound on'}
    >
      <NavGlyph name={muted ? 'soundOff' : 'sound'} size={17} />
    </button>
  );
}

export function TopBar() {
  const route = useRoute();
  const navigate = useNavigate();
  const { progress, rank, playerName, isGuest, syncing } = useStore();
  const { pct, next } = rankProgress(progress.xp);
  const [menuOpen, setMenuOpen] = useState(false);

  /* The active underline slides between items rather than cutting. Measured
     from the DOM so it survives font loading and any label change. */
  const navRef = useRef<HTMLElement>(null);
  const [marker, setMarker] = useState({ left: 0, width: 0, ready: false });

  useEffect(() => setMenuOpen(false), [route]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const measure = () => {
      const active = nav.querySelector<HTMLElement>('[data-active="true"]');
      if (!active) {
        setMarker((m) => ({ ...m, width: 0 }));
        return;
      }
      setMarker({ left: active.offsetLeft, width: active.offsetWidth, ready: true });
    };
    measure();
    // Re-measure once webfonts land, since they change label widths.
    void document.fonts?.ready.then(measure);
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [route]);

  return (
    <header className="sticky top-0 z-50 border-b border-leather-700 bg-leather-950/94 backdrop-blur-md">
      {/* Skip to content.
          Nine navigation items sit between the top of the document and the
          question a keyboard user came here to answer, on every screen. This
          is invisible until focused and is the first thing Tab reaches. */}
      <a
        href="#main"
        className="sr-only rounded-lg border-2 border-gold bg-leather-900 px-4 py-2 font-script
                   text-[12px] uppercase tracking-[0.14em] text-gold
                   focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[100]"
      >
        Skip to content
      </a>

      {/* a hairline of lantern light along the top edge */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: 'linear-gradient(90deg,transparent,rgba(240,207,122,.5),transparent)',
        }}
        aria-hidden="true"
      />

      <div className="shell flex h-16 items-center gap-4">
        <a
          href={hrefFor({ name: 'home' })}
          onClick={() => sfx.select()}
          className="group flex flex-none items-center gap-2.5"
        >
          <span className="brand-sigil">
            <NavGlyph name="star" size={15} />
          </span>
          <span className="hidden font-display text-[15px] font-semibold tracking-wide text-parchment sm:inline">
            ACT Command
          </span>
        </a>

        {/* desktop nav */}
        <nav
          ref={navRef}
          className="relative ml-2 hidden items-center gap-0.5 lg:flex"
          aria-label="Main"
        >
          {NAV.map((item) => {
            const active = item.match.includes(route.name);
            return (
              <a
                key={item.label}
                href={hrefFor(item.route)}
                onClick={() => sfx.select()}
                data-active={active}
                aria-current={active ? 'page' : undefined}
                className={cx('nav-item group', active && 'nav-item-active')}
              >
                <NavGlyph name={item.glyph} size={16} className="nav-item-glyph" />
                <span>{item.label}</span>
              </a>
            );
          })}

          <span
            className="nav-marker"
            style={{
              left: marker.left,
              width: marker.width,
              opacity: marker.width ? 1 : 0,
              transition: marker.ready
                ? 'left .28s cubic-bezier(.22,1,.36,1), width .28s cubic-bezier(.22,1,.36,1), opacity .2s'
                : 'none',
            }}
            aria-hidden="true"
          />
        </nav>

        <div className="ml-auto flex flex-none items-center gap-2">
          {syncing && <span className="label-sm hidden xl:inline">Syncing…</span>}

          <a
            href={hrefFor({ name: 'profile' })}
            onClick={() => sfx.select()}
            className="hud-block group"
            aria-label={`${playerName}, ${rank.name}, ${progress.xp.toLocaleString()} XP`}
          >
            <span className="relative flex-none transition-transform duration-200 group-hover:scale-105">
              <RankBadge rank={rank} size={30} />
            </span>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block max-w-[9rem] truncate font-display text-[12.5px] font-semibold text-parchment">
                {isGuest ? 'Traveller' : playerName}
              </span>
              <span className="mt-0.5 flex items-center gap-1.5">
                <span className="num text-[13px] leading-none text-gold">
                  {progress.xp.toLocaleString()}
                </span>
                <span className="hud-xp">
                  <i style={{ width: `${pct * 100}%` }} />
                </span>
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
            className="hud-icon lg:hidden"
            aria-expanded={menuOpen}
            aria-label="Menu"
          >
            <NavGlyph name={menuOpen ? 'close' : 'menu'} size={17} />
          </button>
        </div>
      </div>

      {/* rank progress, edge to edge */}
      <div className="h-[3px] w-full bg-leather-950">
        <div
          className="h-full transition-[width] duration-700 ease-out"
          style={{
            width: `${pct * 100}%`,
            background: 'linear-gradient(90deg,#9c7410,#f2cf5b)',
            boxShadow: '0 0 10px rgba(242,207,91,.45)',
          }}
          title={
            next ? `${(next.xp - progress.xp).toLocaleString()} XP to ${next.name}` : 'Highest rank'
          }
        />
      </div>

      {/* mobile nav */}
      {menuOpen && (
        <nav
          className="animate-slideDown border-t border-leather-700 bg-leather-900 lg:hidden"
          aria-label="Main"
        >
          <div className="shell grid grid-cols-2 gap-2 py-3 sm:grid-cols-3">
            {NAV.map((item, i) => {
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
                    'nav-item-mobile animate-riseIn',
                    active && 'nav-item-mobile-active',
                  )}
                  style={{ animationDelay: `${i * 28}ms` }}
                >
                  <NavGlyph name={item.glyph} size={17} />
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
  /* The arrival animation moved to the route transition in App.tsx, which can
     also animate the outgoing screen. Keeping `animate-pageIn` here as well
     meant every page ran two entrances at once. */
  return (
    /* `tabIndex={-1}` so the skip link in `TopBar` can actually move focus
       here: without it the browser scrolls to the anchor and leaves focus on
       the link, and the next Tab goes back into the navigation the user just
       asked to skip. */
    <main
      id="main"
      tabIndex={-1}
      className={cx('shell py-7 outline-none sm:py-9', className)}
      style={wide ? { maxWidth: 1400 } : undefined}
    >
      {children}
    </main>
  );
}

export function BackLink({ to, label }: { to: Route; label: string }) {
  return (
    <a
      href={hrefFor(to)}
      onClick={() => sfx.select()}
      className="group mb-5 inline-flex items-center gap-2 font-script text-[13px] uppercase
                 tracking-[0.16em] text-ink-faint transition-colors hover:text-gold"
    >
      <span className="inline-block transition-transform duration-200 group-hover:-translate-x-1">
        ←
      </span>
      {label}
    </a>
  );
}
