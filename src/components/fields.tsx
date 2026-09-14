/* Form controls that belong to this world.
 *
 * The app renders a lamplit fantasy study hall and then, in onboarding, asked
 * for a test date with a bare `<input type="date">`: an OS calendar widget,
 * in the system font, with the platform's own blue focus ring. One unstyled
 * control undoes the work every illustration on the screen is doing, and it
 * is the first thing a new user is asked to touch.
 *
 * Native `<select>` has the same problem and no fix — the popup is drawn by
 * the OS and cannot be styled at all. So both are replaced here with Base UI
 * primitives, which ship the behaviour (keyboard navigation, focus
 * management, typeahead, ARIA) and none of the appearance.
 *
 * Base UI has no date picker, so `DateField` is three selects rather than a
 * calendar. That is not a downgrade for this particular question: a test date
 * is months away and nobody picks it by looking at a grid of weekdays, and
 * the birth-date question in Auth already asks exactly this way — so the two
 * screens now agree instead of each inventing a control.
 */
import { Select as BaseSelect } from '@base-ui/react/select';
import { Glyph } from './Icon';
import type { ReactNode } from 'react';
import { cx } from '../lib/utils';
/* The same twelve strings the age gate already ships. Auth's birth-date
   question and onboarding's test-date question have to agree on them. */
import { MONTHS } from '../lib/ageGate';

export type Option = { value: string; label: string };

const TRIGGER = cx(
  'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left',
  'mat-leather font-read text-[15px] text-parchment',
  'transition-[border-color,box-shadow] duration-quick ease-out',
  'hover:border-gold-deep focus-visible:border-gold-deep focus-visible:outline-none',
  'data-[popup-open]:border-gold-deep',
);

/* The popup is a floating surface, so it sits at step 4 on the elevation
   ladder — one rank above any card it can open over, and below a modal. */
const POPUP = cx(
  'mat-leather z-50 min-w-[var(--anchor-width)] origin-[var(--transform-origin)]',
  'max-h-[min(20rem,var(--available-height))] overflow-y-auto rounded-lg p-1 shadow-floating',
  'transition-[transform,opacity] duration-quick ease-out',
  'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
  'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
);

const ITEM = cx(
  'grid cursor-default grid-cols-[1rem_1fr] items-center gap-2 rounded px-2 py-2',
  'font-read text-[15px] text-parchment outline-none',
  'data-[highlighted]:bg-leather-750 data-[selected]:text-gold',
);

export function Select({
  value,
  onValueChange,
  options,
  placeholder = '—',
  ariaLabel,
  className,
}: {
  value: string;
  onValueChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <BaseSelect.Root
      value={value}
      /* Base UI hands back `null` when a selection is cleared; the screens all
         store these as strings, so normalise here rather than making every
         caller remember. */
      onValueChange={(v) => onValueChange(v == null ? '' : String(v))}
    >
      <BaseSelect.Trigger aria-label={ariaLabel} className={cx(TRIGGER, className)}>
        <BaseSelect.Value>
          {(v: unknown) => {
            const hit = options.find((o) => o.value === v);
            return hit ? hit.label : <span className="text-ink-faint">{placeholder}</span>;
          }}
        </BaseSelect.Value>
        <BaseSelect.Icon className="flex-none text-ink-faint">
          <Glyph name="chevronDown" size={16} />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>

      <BaseSelect.Portal>
        <BaseSelect.Positioner sideOffset={6} alignItemWithTrigger={false}>
          <BaseSelect.Popup className={POPUP}>
            {options.map((o) => (
              <BaseSelect.Item key={o.value} value={o.value} className={ITEM}>
                <BaseSelect.ItemIndicator className="flex-none text-gold">
                  <Glyph name="check" size={14} strokeWidth={2} />
                </BaseSelect.ItemIndicator>
                <BaseSelect.ItemText>{o.label}</BaseSelect.ItemText>
              </BaseSelect.Item>
            ))}
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mb-1.5 block font-script text-label uppercase text-ink-faint">{children}</span>
  );
}

const opts = (xs: readonly string[], from = 1) =>
  xs.map((label, i) => ({ value: String(i + from), label }));

/* Days in the selected month, so February never offers a 31st. The year
   matters for February, so a year that has not been picked yet is treated as
   a leap year — offering the 29th and having it disappear is better than
   hiding a date the user may legitimately need. */
function daysIn(month: number, year: number | null) {
  if (!month) return 31;
  const y = year ?? 2024;
  return new Date(y, month, 0).getDate();
}

/* ISO `yyyy-mm-dd` in and out, because that is what both callers already
   store and what Supabase expects. */
export function DateField({
  value,
  onChange,
  fromYear,
  toYear,
  ariaPrefix,
}: {
  value: string;
  onChange: (iso: string) => void;
  fromYear: number;
  toYear: number;
  ariaPrefix: string;
}) {
  const [y = '', m = '', d = ''] = value ? value.split('-') : [];
  const year = y ? Number(y) : null;
  const month = m ? Number(m) : 0;

  const set = (part: 'y' | 'm' | 'd', next: string) => {
    const nextY = part === 'y' ? next : y;
    const nextM = part === 'm' ? next : m;
    let nextD = part === 'd' ? next : d;

    /* Shortening the month under a selected day — 31 March to February —
       would otherwise emit an impossible date that the input above happily
       stores and the server later rejects. */
    const limit = daysIn(Number(nextM), nextY ? Number(nextY) : null);
    if (nextD && Number(nextD) > limit) nextD = String(limit);

    onChange(
      nextY && nextM && nextD ? `${nextY}-${nextM.padStart(2, '0')}-${nextD.padStart(2, '0')}` : '',
    );
  };

  const years = Array.from({ length: toYear - fromYear + 1 }, (_, i) => String(fromYear + i));

  return (
    <div className="grid grid-cols-[1.5fr_0.8fr_1fr] gap-2.5">
      <Select
        ariaLabel={`${ariaPrefix} month`}
        value={m ? String(Number(m)) : ''}
        onValueChange={(v) => set('m', v)}
        options={opts(MONTHS)}
        placeholder="Month"
      />
      <Select
        ariaLabel={`${ariaPrefix} day`}
        value={d ? String(Number(d)) : ''}
        onValueChange={(v) => set('d', v)}
        options={Array.from({ length: daysIn(month, year) }, (_, i) => ({
          value: String(i + 1),
          label: String(i + 1),
        }))}
        placeholder="Day"
      />
      <Select
        ariaLabel={`${ariaPrefix} year`}
        value={y}
        onValueChange={(v) => set('y', v)}
        options={years.map((v) => ({ value: v, label: v }))}
        placeholder="Year"
      />
    </div>
  );
}
