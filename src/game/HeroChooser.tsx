/* Pick your traveller.
 *
 * `Progress.hero` existed as a typed field, was written once as the dead
 * string `'cadet'`, and was read by nothing anywhere in the codebase. The
 * review's line was blunt: *"the hero is a white boy with brown hair and I
 * cannot change him"*, for an audience of every 13-to-17-year-old in the
 * country. This is the field finally doing something.
 *
 * Two deliberate restraints:
 *
 *   - No unlocks. The traveller is not a reward, and gating who you get to be
 *     behind XP would mean telling a fourteen-year-old they have not earned
 *     the right to look like themselves yet.
 *
 *   - No "gender" control. The eight are drawn on the axes that actually
 *     decide recognition — skin tone, hair colour, hair shape, build — and
 *     none of them is labelled as a boy or a girl. A student who wants Kesh
 *     with the broad build and the gold cloak takes it without answering a
 *     question about themselves first.
 */

import { useRef } from 'react';
import { useStore } from '@/lib/store';
import { cx } from '@/lib/utils';
import { HEROES } from './heroes';
import { HeroSprite } from './HeroSprite';

export function HeroChooser({ compact = false }: { compact?: boolean }) {
  const { progress, updateProgress } = useStore();
  const current = progress.hero;
  const groupRef = useRef<HTMLDivElement>(null);

  const pick = (id: string) => updateProgress((p) => ({ ...p, hero: id }));

  /* A radiogroup is one tab stop, and the arrows move within it. Eight
     separate tab stops would be a listbox wearing radio roles, and a screen
     reader would announce "radio, one of eight" for a control the keyboard
     then refuses to behave like. */
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0;
    if (step === 0) return;
    e.preventDefault();
    const at = HEROES.findIndex((h) => h.id === current);
    const to = HEROES[((at < 0 ? 0 : at) + step + HEROES.length) % HEROES.length]!;
    pick(to.id);
    groupRef.current?.querySelector<HTMLButtonElement>(`[data-hero="${to.id}"]`)?.focus();
  };

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label="Choose your traveller"
      onKeyDown={onKeyDown}
      className={cx('grid gap-2.5', compact ? 'grid-cols-4' : 'grid-cols-2 sm:grid-cols-4')}
    >
      {HEROES.map((hero, i) => {
        const chosen = hero.id === current;
        /* Nothing chosen yet still needs exactly one tab stop, or the group
           becomes unreachable by keyboard entirely. */
        const roving = chosen || (i === 0 && !HEROES.some((h) => h.id === current));
        return (
          <button
            key={hero.id}
            type="button"
            role="radio"
            data-hero={hero.id}
            aria-checked={chosen}
            tabIndex={roving ? 0 : -1}
            onClick={() => pick(hero.id)}
            className={cx(
              'flex flex-col items-center rounded-xl border-2 px-2 pb-3 pt-2 transition-colors',
              chosen
                ? 'border-gold bg-leather-800'
                : 'border-leather-700 bg-leather-900 hover:border-gold-deep',
            )}
          >
            {/* The same sprite that walks the map, so the choice is a preview
                of the world rather than a portrait of somebody who then turns
                out to look different once you are playing. The reaction that
                used to be a pleased face is now the bob — one figure in a grid
                of eight moving is more legible at 54px than a changed mouth. */}
            <HeroSprite
              hero={hero}
              height={compact ? 62 : 78}
              className={cx('select-none', chosen && 'animate-bobHero')}
            />
            <span
              className={cx(
                'mt-1.5 font-script text-[11px] uppercase tracking-[0.12em]',
                chosen ? 'text-gold' : 'text-parchment-dim',
              )}
            >
              {hero.name}
            </span>
            {!compact && (
              <span className="mt-0.5 text-center text-[11px] leading-snug text-ink-faint">
                {hero.tagline}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
