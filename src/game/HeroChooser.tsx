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

import { useStore } from '@/lib/store';
import { cx } from '@/lib/utils';
import { HEROES } from './heroes';
import { HeroAvatar } from './HeroAvatar';

export function HeroChooser({ compact = false }: { compact?: boolean }) {
  const { progress, updateProgress } = useStore();
  const current = progress.hero;

  return (
    <div
      role="radiogroup"
      aria-label="Choose your traveller"
      className={cx(
        'grid gap-2.5',
        compact ? 'grid-cols-4' : 'grid-cols-2 sm:grid-cols-4',
      )}
    >
      {HEROES.map((hero) => {
        const chosen = hero.id === current;
        return (
          <button
            key={hero.id}
            type="button"
            role="radio"
            aria-checked={chosen}
            onClick={() => updateProgress((p) => ({ ...p, hero: hero.id }))}
            className={cx(
              'flex flex-col items-center rounded-xl border-2 px-2 pb-3 pt-2 transition-colors',
              chosen
                ? 'border-gold bg-leather-800'
                : 'border-leather-700 bg-leather-900 hover:border-gold-deep',
            )}
          >
            {/* The portrait reacts, so the grid is not eight blank stares:
                whoever is currently chosen is pleased about it. */}
            <HeroAvatar hero={hero} size={compact ? 54 : 68} expression={chosen ? 'pleased' : 'calm'} />
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
