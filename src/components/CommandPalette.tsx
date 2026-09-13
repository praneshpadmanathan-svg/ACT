/* ⌘K — jump anywhere.
 *
 * The app has eight destinations, thirty-seven landmarks, a hundred-odd lesson
 * pages and a drill for every topic in the library. The rail can hold eight of
 * those. Everything else is two or three clicks and a scan down a list, which
 * is fine the first time and tiresome the fiftieth — and the people who use
 * this app fifty times are exactly the ones it should be fastest for.
 *
 * Three decisions worth stating:
 *
 * 1. **Nothing here is on the eager path, twice over.** This whole module is
 *    code-split behind `PaletteHost`, which owns the keystroke and imports it on
 *    first open — Base UI's dialog measured 17 kB gzipped in front of the first
 *    paint otherwise. And inside it, lesson pages and drill topics come from
 *    `@/content`, which drags 738 kB of question JSON, so those are fetched on
 *    first open too. Destinations and landmarks (10 kB, already in memory) are
 *    there instantly; the rest arrives a tick later and the footer says so.
 *
 * 2. **Base UI supplies the dialog, not the list.** Focus trap, scroll lock,
 *    outside-press and Escape are genuinely fiddly and worth a dependency.
 *    Arrow-key selection over a filtered list is twenty lines, and owning it is
 *    what lets the pointer and the keyboard agree on one highlighted row —
 *    `data-active`, not `:hover`, because only one of those can be true at a
 *    time and the keyboard has to win.
 *
 * 3. **Ranking is a subsequence match, not a substring one.** "cmst" should
 *    find "Comma Castle". The scoring itself is `scoreMatch` in `@/lib/palette`
 *    — it is the one piece of this that can silently get worse, so it lives
 *    where a test can reach it without importing a dialog. */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { Dialog } from '@base-ui/react/dialog';

import { ALL_ZONES } from '@/content/zones';
import { SECTIONS } from '@/content/sections';
import { hrefFor, useNavigate, type Route } from '@/lib/router';
import { scoreMatch } from '@/lib/palette';
import { sfx } from '@/lib/sfx';
import { titleCase } from '@/lib/utils';
import { Glyph, type IconName } from './Icon';

export interface PaletteEntry {
  id: string;
  label: string;
  /** The group heading it files under. Ordering follows first appearance. */
  group: string;
  hint?: string;
  icon: IconName;
  to: Route;
  /** Extra words the search should match but the row should not show —
   *  a landmark's skill, a lesson's unit. */
  keywords?: string;
}

/* -------------------------------------------------------------- the entries */

/** Destinations and landmarks — free, because both are already in memory. */
function staticEntries(): PaletteEntry[] {
  /* Icons come from the house set (`Glyph`), not the rail's `NavGlyph`. The
     rail has eleven glyphs for eight destinations; this list needs fifteen
     kinds of thing, and reusing one glyph three times to avoid drawing new
     ones would be worse than picking the nearest true metaphor from the forty
     that already exist. Camp is a lantern because the camp art is lit by them;
     Review is a clock because the whole idea is the right moment. */
  const out: PaletteEntry[] = [
    { id: 'go-home', label: 'Camp', group: 'Go', icon: 'lantern', to: { name: 'home' }, hint: 'What to do today' },
    { id: 'go-path', label: 'Study', group: 'Go', icon: 'map', to: { name: 'path' }, hint: 'Lesson, then quiz' },
    { id: 'go-notes', label: 'Library', group: 'Go', icon: 'book', to: { name: 'notes' }, hint: 'Every rule, explained' },
    { id: 'go-drills', label: 'Training', group: 'Go', icon: 'sword', to: { name: 'drills' }, hint: 'Free practice' },
    { id: 'go-review', label: 'Review', group: 'Go', icon: 'clock', to: { name: 'review' }, hint: 'What you got wrong' },
    { id: 'go-duels', label: 'Duels', group: 'Go', icon: 'shield', to: { name: 'duels' }, hint: 'The four guardians' },
    { id: 'go-tests', label: 'Summit', group: 'Go', icon: 'trophy', to: { name: 'tests' }, hint: 'Full timed trial' },
    { id: 'go-stats', label: 'Progress', group: 'Go', icon: 'target', to: { name: 'stats' }, hint: 'Score, streak, weak spots' },
    { id: 'go-codex', label: 'Codex', group: 'Go', icon: 'scroll', to: { name: 'codex' }, hint: 'What you have found' },
    { id: 'go-bookmarks', label: 'Bookmarks', group: 'Go', icon: 'bookmark', to: { name: 'bookmarks' }, hint: 'Saved questions' },
    { id: 'go-profile', label: 'Profile', group: 'Go', icon: 'settings', to: { name: 'profile' }, hint: 'Your account and plan' },

    { id: 'do-daily', label: "Today's daily", group: 'Do', icon: 'calendar', to: { name: 'daily' }, hint: 'A short mixed set' },
    { id: 'do-review', label: 'Review what is due', group: 'Do', icon: 'clock', to: { name: 'review' } },
    { id: 'do-diagnostic', label: 'Take the placement test', group: 'Do', icon: 'compass', to: { name: 'diagnostic' } },
  ];

  for (const { zone, path } of ALL_ZONES) {
    out.push({
      id: `zone-${zone.id}`,
      label: zone.name,
      group: 'Landmarks',
      hint: path.name,
      icon: 'flag',
      to: { name: 'zone', zone: zone.id },
      keywords: `${zone.sub} ${zone.topic} ${path.section}`,
    });
  }

  return out;
}

/* --------------------------------------------------------------- the dialog */

/** Open state is owned by `PaletteHost`, which is the eager half: it has to be
 *  able to know about a keystroke before this module has loaded. */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const [deep, setDeep] = useState<PaletteEntry[] | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /* The rest of the index, on first open only. See note 1 in the header. */
  useEffect(() => {
    if (!open || deep) return;
    let live = true;
    void import('@/content').then((content) => {
      if (!live) return;
      const rows: PaletteEntry[] = [];

      for (const page of content.ALL_NOTE_PAGES) {
        rows.push({
          id: `note-${page.id}`,
          label: page.title,
          group: 'Lessons',
          hint: page.unitLabel,
          icon: 'quill',
          to: { name: 'note', page: page.id },
          keywords: `${page.topic} ${page.summary}`,
        });
      }

      for (const section of SECTIONS) {
        for (const topic of content.TOPICS_BY_SECTION[section.id]) {
          rows.push({
            id: `drill-${section.id}-${topic}`,
            label: `Drill ${titleCase(topic)}`,
            group: 'Practice',
            hint: section.name,
            icon: 'sword',
            to: { name: 'drill', section: section.id, topic },
          });
        }
      }

      setDeep(rows);
    });
    return () => {
      live = false;
    };
  }, [open, deep]);

  const all = useMemo(() => [...staticEntries(), ...(deep ?? [])], [deep]);

  const results = useMemo(() => {
    if (!query.trim()) {
      /* No query: the things you would actually want one keystroke away, not
         the first fourteen rows of an alphabet. */
      return all.filter((e) => e.group === 'Go' || e.group === 'Do').slice(0, 10);
    }
    const q = query.trim();
    const hits = all
      .map((entry) => {
        const direct = scoreMatch(q, entry.label);
        /* Keyword hits are real but weaker than a hit on the visible label —
           otherwise a lesson matches on its summary and the row shows nothing
           that explains why it is there. */
        const aside = entry.keywords ? scoreMatch(q, entry.keywords) : null;
        const s = direct !== null ? direct : aside !== null ? aside - 14 : null;
        return s === null ? null : { entry, s };
      })
      .filter((x): x is { entry: PaletteEntry; s: number } => x !== null)
      .sort((a, b) => b.s - a.s)
      .slice(0, 40);

    /* Ordered by group, groups ordered by their own best hit.

       Score order alone interleaved them — Landmarks, Lessons, Practice,
       Lessons again — which meant the same heading appeared three times in one
       list and none of them meant anything. Grouping costs nothing that
       matters: the best-scoring entry is still the first row, because it is the
       first member of the group it just put at the top. */
    const order: string[] = [];
    for (const { entry } of hits) if (!order.includes(entry.group)) order.push(entry.group);
    return order.flatMap((g) => hits.filter((h) => h.entry.group === g).map((h) => h.entry));
  }, [all, query]);

  /* A filtered list whose selection stays put is a list that fires the wrong
     row: type one more letter, the match you were on drops out, and Enter runs
     whatever slid into its place.

     Adjusted during render rather than in an effect. An effect would leave one
     committed frame where the highlight is on a row the query no longer
     matches, and a keypress landing in that frame acts on it. */
  const [cursorFor, setCursorFor] = useState(query);
  if (cursorFor !== query) {
    setCursorFor(query);
    setCursor(0);
  }

  const go = useCallback(
    (entry: PaletteEntry) => {
      sfx.select();
      onOpenChange(false);
      setQuery('');
      navigate(entry.to);
    },
    [navigate, onOpenChange],
  );

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowDown' || (e.key === 'n' && e.ctrlKey)) {
      e.preventDefault();
      setCursor((c) => (results.length ? (c + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp' || (e.key === 'p' && e.ctrlKey)) {
      e.preventDefault();
      setCursor((c) => (results.length ? (c - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setCursor(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setCursor(Math.max(0, results.length - 1));
    } else if (e.key === 'Enter') {
      const hit = results[cursor];
      if (hit) {
        e.preventDefault();
        go(hit);
      }
    }
  };

  /* Keep the highlighted row in view when the arrows walk past the fold.
     `block: 'nearest'` rather than `'center'`, so a list that already fits
     does not jump on every keystroke. */
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor, results]);

  /* Group headings are drawn from the results themselves, in the order the
     groups first appear, so a heading can never end up over an empty run. */
  let lastGroup = '';

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setQuery('');
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[90] bg-leather-950/70 backdrop-blur-[2px]" />
        <Dialog.Popup className="fixed left-1/2 top-[12vh] z-[91] -translate-x-1/2 outline-none">
          <div className="palette" onKeyDown={onKeyDown}>
            <Dialog.Title className="sr-only">Jump to</Dialog.Title>

            <div className="flex items-center gap-3 border-b border-leather-700 px-4 py-3.5">
              {/* No magnifier: the house set has none, and a box with a caret
                  blinking in it after ⌘K needs no help saying what it is. */}
              <Glyph name="compass" size={17} className="flex-none text-gold-deep" aria-hidden />
              {/* `autoFocus` is right here and nowhere else in the app: the
                  palette exists to be typed into, and a dialog you summoned by
                  shortcut that then made you click before typing would be
                  slower than the navigation it replaces. */}
              <input
                autoFocus
                className="palette-input"
                placeholder="Jump to a landmark, a lesson, a drill…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search the app"
                role="combobox"
                aria-expanded
                aria-controls="palette-list"
                aria-activedescendant={results[cursor] ? `palette-${results[cursor].id}` : undefined}
                autoComplete="off"
                spellCheck={false}
              />
              <kbd className="palette-kbd flex-none">esc</kbd>
            </div>

            <div
              ref={listRef}
              id="palette-list"
              role="listbox"
              aria-label="Results"
              className="max-h-[min(24rem,60vh)] overflow-y-auto overscroll-contain p-2"
            >
              {results.length === 0 ? (
                <p className="px-3 py-8 text-center font-read text-[14px] text-ink-faint">
                  Nothing matches “{query}”.
                </p>
              ) : (
                results.map((entry, i) => {
                  const heading = entry.group !== lastGroup ? entry.group : null;
                  lastGroup = entry.group;
                  return (
                    <div key={entry.id}>
                      {heading && <div className="palette-group">{heading}</div>}
                      {/* An anchor, so the whole list is middle-click and
                          copy-link friendly the way the rail already is. */}
                      <a
                        id={`palette-${entry.id}`}
                        href={hrefFor(entry.to)}
                        role="option"
                        aria-selected={i === cursor}
                        data-active={i === cursor}
                        className="palette-item"
                        onMouseMove={() => setCursor(i)}
                        onClick={(e) => {
                          e.preventDefault();
                          go(entry);
                        }}
                      >
                        <Glyph name={entry.icon} size={16} className="palette-glyph" />
                        <span className="min-w-0 flex-1 truncate font-read text-[14.5px]">
                          {entry.label}
                        </span>
                        {entry.hint && (
                          <span className="flex-none truncate font-script text-[10.5px] uppercase tracking-[0.14em] text-ink-faint">
                            {entry.hint}
                          </span>
                        )}
                      </a>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center gap-3 border-t border-leather-700 px-4 py-2.5">
              {/* The arrows are house glyphs, not ↑ and ↓ — `check:glyphs` bans
                  bare Unicode in markup, and it is right to: the drawn chevrons
                  match the app's stroke weight and the typeface's arrows do
                  not. "Enter" is spelled out for the same reason, since the set
                  has no return-key glyph. */}
              <span className="flex items-center gap-1 font-read text-[11.5px] text-ink-faint">
                <kbd className="palette-kbd">
                  <Glyph name="chevronUp" size={11} strokeWidth={2.2} />
                </kbd>
                <kbd className="palette-kbd">
                  <Glyph name="chevronDown" size={11} strokeWidth={2.2} />
                </kbd>
                to move
              </span>
              <span className="font-read text-[11.5px] text-ink-faint">
                <kbd className="palette-kbd">enter</kbd> to open
              </span>
              {deep === null && (
                <span className="ml-auto font-read text-[11.5px] text-ink-faint">
                  Indexing lessons…
                </span>
              )}
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
