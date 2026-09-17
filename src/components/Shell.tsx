/* App chrome.

   A left rail, not a top bar.

   Eight destinations in one horizontal row was the whole problem. They had to
   be equally sized and equally weighted, so nothing could say which of them
   you use daily and which you visit once a week; they had no room for a word
   of explanation; and at 815.9px of tabs they were one label away from
   overflowing a 1200px shell — the reason the wordmark had to stand down and
   the reason the rail could not turn on until 1140px.

   Vertically there is room to do the thing a top bar could not: group them.
   Four short groups with a heading each say what the app is *for* — you climb,
   you practise, you prove it, you check yourself — so a new player reads the
   shape of the product off the navigation instead of guessing at eight nouns.
   Items carry their own size ("836 questions"), and the bank total sits at the
   foot of the rail in display type, because it is the reason to be here.

   Position: `sticky`, never `fixed`. The rail renders inside the shake stage
   in App.tsx, and a transform on an ancestor becomes the containing block for
   `position: fixed` — a fixed rail would slide by the scroll offset every time
   something hit the screen. Sticky is unaffected by that. */

import { useEffect, useState, type ReactNode } from 'react';
import { hrefFor, useRoute, type Route } from '@/lib/router';
import { useStore } from '@/lib/store';
import { rankProgress } from '@/lib/progress';
import { isMuted, onMutedChange, sfx, toggleMuted } from '@/lib/sfx';
import { cx } from '@/lib/utils';
import { NavGlyph, type GlyphName } from './NavGlyph';
import { Glyph } from './Icon';
import { RankBadge } from './ui';
import { PaletteHost } from './PaletteHost';
import { modKey, openPalette } from '@/lib/palette';
import { trialDaysLeft, trialExpired } from '@/lib/entitlements';
import { LIBRARY_STATS } from '@/content/stats';

interface NavItem {
  label: string;
  glyph: GlyphName;
  route: Route;
  match: Route['name'][];
  /** One line, shown under the label. What this destination is for, in the
   *  fewest words that distinguish it from the one above and below it. */
  hint: string;
  /** Its size, when size is the point. Renders in gold beside the label. */
  meta?: string;
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

/* The Codex is deliberately absent: it is a collection you visit occasionally,
   and it links from the Study header rather than spending a slot the everyday
   screens need more. */
const GROUPS: NavGroup[] = [
  {
    id: 'climb',
    label: 'Your climb',
    items: [
      {
        label: 'Camp',
        glyph: 'tent',
        route: { name: 'home' },
        match: ['home'],
        hint: 'What to do today',
      },
      {
        label: 'Study',
        glyph: 'map',
        route: { name: 'path' },
        match: ['path', 'zone', 'codex'],
        hint: 'Lesson, then quiz',
        meta: LIBRARY_STATS.zoneQuestions.toLocaleString(),
      },
    ],
  },
  {
    id: 'practice',
    label: 'Practice',
    items: [
      {
        label: 'Library',
        glyph: 'book',
        route: { name: 'notes' },
        match: ['notes', 'note'],
        hint: 'Every rule, explained',
        meta: LIBRARY_STATS.notePages.toLocaleString(),
      },
      {
        label: 'Training',
        glyph: 'sword',
        route: { name: 'drills' },
        match: ['drills', 'drill'],
        hint: 'Free practice, any topic',
        meta: LIBRARY_STATS.drillQuestions.toLocaleString(),
      },
      {
        label: 'Review',
        glyph: 'hourglass',
        route: { name: 'review' },
        match: ['review'],
        hint: 'What you got wrong',
      },
    ],
  },
  {
    id: 'prove',
    label: 'Prove it',
    items: [
      {
        label: 'Duels',
        glyph: 'shield',
        route: { name: 'duels' },
        match: ['duels', 'boss'],
        hint: 'The four guardians',
      },
      {
        label: 'Summit',
        glyph: 'crown',
        route: { name: 'tests' },
        match: ['tests', 'test', 'report'],
        hint: 'Full timed trial',
      },
    ],
  },
  {
    id: 'you',
    label: 'You',
    items: [
      {
        label: 'Progress',
        glyph: 'chart',
        route: { name: 'stats' },
        match: ['stats'],
        hint: 'Score, streak, weak spots',
      },
    ],
  },
];

const ALL_ITEMS = GROUPS.flatMap((g) => g.items);

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

/* The trial clock.
 *
 * It sits in the rail rather than on a screen because a countdown nobody sees
 * is not a countdown — the whole point is that the last day does not arrive as
 * a surprise on the morning of a practice test. It renders nothing at all for
 * a paying subscriber, for a redeemed code, and for a build with no accounts
 * configured, because in each of those cases there is no clock running.
 *
 * On the last day it says "ends today" rather than "0 days left", which is the
 * same fact phrased as information instead of as a scold. */
function TrialPill({ className }: { className?: string }) {
  const { entitlement } = useStore();
  const days = trialDaysLeft(entitlement);
  const ended = trialExpired(entitlement);

  if (days === null && !ended) return null;

  const label = ended
    ? 'Unlock Pro'
    : days === 0
      ? 'Trial ends today'
      : `Trial · ${days} days left`;

  return (
    <a
      href={hrefFor({ name: 'profile' })}
      onClick={() => sfx.select()}
      className={cx(
        'block rounded-lg border-2 border-gold-deep/60 px-2.5 py-1.5 text-center font-script',
        'text-[11px] uppercase leading-none tracking-wide text-gold transition-colors hover:border-gold',
        className,
      )}
      title={
        ended
          ? 'Your free trial has ended. Pro reopens every subject, the Summit, review and duels.'
          : `${days} day${days === 1 ? '' : 's'} left of full access.`
      }
    >
      {label}
    </a>
  );
}

/* The bank total, in the chrome rather than only on the front door.

   It is set in display type at a size nothing else in the rail comes near,
   because "there are this many questions in here" is the single fact that
   makes the app worth opening, and it stops being persuasive the moment it is
   sized like a caption. */
function BankBadge() {
  const { rank } = useStore();
  return (
    <a
      href={hrefFor({ name: 'profile' })}
      className="rail-bank group"
      title="View your rank and progress"
    >
      <RankBadge rank={rank} size={64} aura={false} />
      <strong className="mt-3 block font-display text-title text-gold">{rank.name}</strong>
      <span className="label-sm mt-2 block">Your rank</span>
    </a>
  );
}

/* One destination. The active marker is a bar on its own left edge, so there
   is nothing to measure: the old sliding underline read `offsetLeft` off the
   DOM and had to re-measure on route change, on webfont load and on resize. A
   vertical rail can just draw it. */
function RailLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <a
      href={hrefFor(item.route)}
      onClick={() => {
        sfx.select();
        onNavigate?.();
      }}
      aria-current={active ? 'page' : undefined}
      className={cx('rail-item group', active && 'rail-item-active')}
    >
      <span className="rail-marker" aria-hidden="true" />
      <NavGlyph name={item.glyph} size={17} className="rail-glyph" />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-1.5">
          <span className="truncate font-display text-[14px] font-semibold tracking-wide">
            {item.label}
          </span>
          {item.meta && <span className="rail-meta">{item.meta}</span>}
        </span>
        <span className="mt-0.5 block truncate font-read text-[11.5px] leading-tight text-ink-faint">
          {item.hint}
        </span>
      </span>
    </a>
  );
}

function RailGroups({ onNavigate }: { onNavigate?: () => void }) {
  const route = useRoute();
  return (
    <>
      {GROUPS.map((group) => (
        <div key={group.id} className="mb-3 last:mb-0">
          <h2 className="rail-group">{group.label}</h2>
          <div className="mt-1 space-y-0.5">
            {group.items.map((item) => (
              <RailLink
                key={item.label}
                item={item}
                active={item.match.includes(route.name)}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

/* Rank, name, XP — the block you tap to reach your profile. */
function PlayerBlock({ compact }: { compact?: boolean }) {
  const { progress, rank, playerName, isGuest } = useStore();
  const { pct, next } = rankProgress(progress.xp);

  return (
    <a
      href={hrefFor({ name: 'profile' })}
      onClick={() => sfx.select()}
      className={cx('hud-block group w-full', compact && 'px-2 py-1')}
      aria-label={`${playerName}, ${rank.name}, ${progress.xp.toLocaleString()} XP`}
      title={
        next ? `${(next.xp - progress.xp).toLocaleString()} XP to ${next.name}` : 'Highest rank'
      }
    >
      <span className="relative flex-none transition-transform duration-200 group-hover:scale-105">
        <RankBadge rank={rank} size={compact ? 26 : 32} />
      </span>
      <span className="min-w-0 flex-1 text-left leading-tight">
        <span className="block truncate font-display text-[12.5px] font-semibold text-parchment">
          {isGuest ? 'Traveller' : playerName}
        </span>
        {!compact && <span className="label-sm block leading-tight">{rank.name}</span>}
        <span className="mt-1 flex items-center gap-1.5">
          <span className="num text-[12.5px] leading-none text-gold">
            {progress.xp.toLocaleString()}
          </span>
          <span className="hud-xp flex-1">
            <i style={{ width: `${pct * 100}%` }} />
          </span>
        </span>
      </span>
    </a>
  );
}

export function SideNav() {
  const route = useRoute();
  const { syncing } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [route]);

  const current = ALL_ITEMS.find((i) => i.match.includes(route.name));

  return (
    <>
      {/* Skip to content.
          A dozen focusable things sit between the top of the document and the
          question a keyboard user came here to answer, on every screen. This
          is invisible until focused and is the first thing Tab reaches.

          leather-850, not -900: gold is the one accent measured against 850
          (4.9:1), and on the darker 900 it fell to 4.28 in light mode. */}
      <a
        href="#main"
        className="sr-only rounded-lg border-2 border-gold bg-leather-850 px-4 py-2 font-script
                   text-[12px] uppercase tracking-[0.14em] text-gold
                   focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[100]"
      >
        Skip to content
      </a>

      {/* --------------------------------------------------------- the rail

          Sticky rather than fixed (see the file header). `h-dvh` with its own
          scroll means a long rail scrolls inside itself rather than pushing
          the page, and `overscroll-contain` keeps that scroll from chaining
          into the page once it bottoms out.

          1024px, not the old 1140: the rail no longer competes with the page
          for horizontal room, so it turns on wherever a 232px column plus a
          readable measure will fit. */}
      {/* Elevation 2, and a gilt hairline down the right edge instead of a
          `border-r`. A border is a seam between two flat things and it read as
          one: the rail and the page looked like two halves of the same sheet
          with a line drawn between them. `.rail-surface` casts the panel's own
          shadow onto the page and lights the bevel where the lamp would catch
          it, which is what makes the rail a piece of tooled leather the content
          sits beside rather than a column of the same document. */}
      <aside
        className="rail-surface sticky top-0 z-40 hidden h-dvh w-[236px] flex-none flex-col
                   bg-leather-950/94 backdrop-blur-md lg:flex"
        aria-label="Main"
      >
        <a
          href={hrefFor({ name: 'home' })}
          onClick={() => sfx.select()}
          className="group flex flex-none items-center gap-2.5 border-b border-leather-800 px-4 py-4"
        >
          <span className="brand-sigil">
            <NavGlyph name="star" size={15} />
          </span>
          <span className="font-display text-[15px] font-semibold tracking-wide text-parchment">
            ACT Command
          </span>
        </a>

        {/* The palette's own door. A shortcut nobody is told about is a
            shortcut for the person who wrote it, so the rail carries the key
            cap and the same placeholder the dialog opens with. */}
        <div className="flex-none px-2.5 pt-2.5">
          <button type="button" onClick={openPalette} className="rail-search">
            <Glyph name="compass" size={15} className="flex-none text-ink-faint" />
            <span className="min-w-0 flex-1 truncate text-left">Jump to…</span>
            <kbd className="palette-kbd flex-none">{modKey()}K</kbd>
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5 py-3">
          <RailGroups />
        </nav>

        <div className="flex-none space-y-2 border-t border-leather-800 p-2.5">
          <BankBadge />
          <TrialPill />
          <div className="flex items-center gap-2">
            <PlayerBlock />
            <MuteButton />
          </div>
          {syncing && <p className="label-sm text-center">Syncing…</p>}
        </div>
      </aside>

      {/* ------------------------------------------------------ narrow screens

          Below lg the rail cannot be a column, so it becomes a slim bar that
          names where you are, plus a drawer carrying the same groups. The bar
          is sticky for the same reason the rail is. */}
      <header className="sticky top-0 z-40 border-b border-leather-700 bg-leather-950/95 backdrop-blur-md lg:hidden">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            background: 'linear-gradient(90deg,transparent,rgba(240,207,122,.5),transparent)',
          }}
          aria-hidden="true"
        />

        <div className="flex h-14 items-center gap-2.5 px-3 sm:px-5">
          <a
            href={hrefFor({ name: 'home' })}
            onClick={() => sfx.select()}
            className="group flex flex-none items-center gap-2"
          >
            <span className="brand-sigil">
              <NavGlyph name="star" size={15} />
            </span>
          </a>

          {/* Where you are, said out loud. On a top bar the active tab said
              this; a drawer that is shut cannot, so the bar says it instead. */}
          <span className="min-w-0 flex-1">
            <span className="block truncate font-display text-[14.5px] font-semibold tracking-wide text-parchment">
              {current?.label ?? 'ACT Command'}
            </span>
            {current && (
              <span className="block truncate font-read text-[11px] leading-tight text-ink-faint">
                {current.hint}
              </span>
            )}
          </span>

          <span className="hidden w-[136px] flex-none sm:block">
            <PlayerBlock compact />
          </span>

          {/* The palette earns its place on a phone too — a tap and a few
              letters beats opening the drawer and scrolling a list of
              thirty-seven landmarks, and the on-screen keyboard is right there
              anyway. */}
          <button
            type="button"
            onClick={() => {
              sfx.select();
              openPalette();
            }}
            className="hud-icon flex-none"
            aria-label="Jump to"
          >
            <Glyph name="compass" size={17} />
          </button>

          <button
            type="button"
            onClick={() => {
              sfx.select();
              setMenuOpen((v) => !v);
            }}
            className="hud-icon flex-none"
            aria-expanded={menuOpen}
            aria-label="Menu"
          >
            <NavGlyph name={menuOpen ? 'close' : 'menu'} size={17} />
          </button>
        </div>

        {menuOpen && (
          <nav
            className="animate-slideDown max-h-[calc(100dvh-3.5rem)] overflow-y-auto
                       overscroll-contain border-t border-leather-700 bg-leather-900 px-2.5 py-3"
            aria-label="Main"
          >
            <RailGroups onNavigate={() => setMenuOpen(false)} />
            <div className="mt-3 space-y-2 border-t border-leather-800 pt-3">
              <BankBadge />
              <TrialPill />
              <div className="flex items-center gap-2 sm:hidden">
                <PlayerBlock />
                <MuteButton />
              </div>
              <div className="hidden justify-end sm:flex">
                <MuteButton />
              </div>
            </div>
          </nav>
        )}
      </header>

      {/* Mounted once, alongside the chrome rather than inside it: the shortcut
          is global and the dialog portals to the body, so neither the rail nor
          the mobile bar is its parent in any meaningful sense. Bare routes —
          the landing page, auth — render no `SideNav` and so get no palette,
          which is right: there is nothing to jump to yet. */}
      <PaletteHost />
    </>
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
    /* `tabIndex={-1}` so the skip link in `SideNav` can actually move focus
       here: without it the browser scrolls to the anchor and leaves focus on
       the link, and the next Tab goes back into the navigation the user just
       asked to skip. */
    /* The content canvas. `--measure-wide` by default, `--measure-full` when a
       screen genuinely needs the room (stats grids, the landmark list) — both
       named in index.css rather than being a `1200` here and a `1400` there.
       Full-bleed cards on a 1440px display are most of why the app read as a
       form: a card 1,300px wide has nothing in common with a page. */
    <main
      id="main"
      tabIndex={-1}
      className={cx('shell py-7 outline-none sm:py-9', wide ? 'canvas-full' : 'canvas', className)}
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
      <span className="inline-flex transition-transform duration-200 group-hover:-translate-x-1">
        <Glyph name="arrowLeft" size={14} strokeWidth={2} />
      </span>
      {label}
    </a>
  );
}
