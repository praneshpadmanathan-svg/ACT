/* Display, reading and accessibility settings, plus the diagnostics panel.
 *
 * Split out of `Stats.tsx` rather than added to it: the profile screen was
 * already five hundred lines and these controls have nothing to do with XP,
 * ranks or account deletion. They are also the one part of the app a student
 * may need to reach *before* they can read anything else, so they get their
 * own component that can be dropped anywhere.
 *
 * Every setting here is deliberately its own row rather than one bundled
 * "accessibility mode". Bundling them is the common mistake: a student who
 * wants larger type does not necessarily want a different typeface, and
 * someone who wants read-aloud may be perfectly happy with the dark theme.
 * Four separate needs, four separate switches.
 */

import { useEffect, useState } from 'react';
import { usePrefs, type TextScale, type ThemeChoice, type TimeAllowance } from '@/lib/prefs';
import { speechSupported } from '@/lib/speech';
import { clearDiagnostics, diagnosticsText, onDiagnostics, type ReportEvent } from '@/lib/report';
import { cx } from '@/lib/utils';
import { Button } from './ui';
import { Glyph } from './Icon';

/* ------------------------------------------------------------ small pieces */

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-leather-700/70 py-4 first:border-t-0 first:pt-0">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="font-script text-[10.5px] uppercase tracking-[0.14em] text-ink-faint">
          {label}
        </span>
      </div>
      {children}
      {hint && (
        <p className="mt-2 font-read text-[12.5px] leading-relaxed text-ink-faint">{hint}</p>
      )}
    </div>
  );
}

/** A segmented control. `aria-pressed` rather than a radio group, because
 *  these apply the instant they are pressed — there is no form to submit. */
function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string; detail?: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    /* A grid on phones sized to the option count, so a wrap never leaves one
       option alone on its own row; a free row from `sm` up. */
    <div
      className={cx(
        'grid gap-1.5 sm:flex sm:flex-wrap',
        options.length === 4
          ? 'grid-cols-2'
          : options.length % 3 === 0 || options.length > 4
            ? 'grid-cols-3'
            : options.length === 2
              ? 'grid-cols-2'
              : 'grid-cols-1',
      )}
      role="group"
      aria-label={label}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cx(
              'rounded-lg border-2 px-3.5 py-2 text-center font-display text-[13px] font-semibold leading-tight transition-colors [@media(pointer:coarse)]:min-h-11',
              active
                ? 'border-gilt bg-gilt text-[#2a2000]'
                : 'border-leather-700 bg-leather-800 text-parchment-dim hover:border-gold-deep hover:text-parchment',
            )}
            title={option.detail}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** A real switch, with the role screen readers expect. */
function Toggle({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cx(
        /* The track is 28px; the ::before extends the hit area to 44px without moving anything. */
        'relative inline-flex h-7 w-12 flex-none items-center rounded-full border-2 transition-colors before:absolute before:-inset-x-1 before:-inset-y-2.5 before:content-[""] disabled:opacity-40',
        on ? 'border-gold bg-gold/30' : 'border-parchment-edge bg-leather-900',
      )}
    >
      <span
        className={cx(
          'block h-4 w-4 rounded-full transition-transform duration-quick',
          on ? 'translate-x-[22px] bg-gold' : 'translate-x-[4px] bg-parchment-dim',
        )}
      />
    </button>
  );
}

function SwitchRow({
  label,
  detail,
  on,
  onChange,
  disabled,
  disabledNote,
}: {
  label: string;
  detail: string;
  on: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
  disabledNote?: string;
}) {
  /* A <label>, so the whole row is the switch's hit area. Only the 48px track
     answered a tap, and on a phone the obvious thing to press is the setting's
     name. A label forwards clicks to the button inside it, and a click on the
     button itself is not forwarded twice. Spans rather than div/p because a
     label holds phrasing content only. */
  return (
    <label
      className={cx(
        'flex items-start gap-4 border-t border-leather-700/70 py-4 first:border-t-0 first:pt-0',
        !disabled && 'cursor-pointer',
      )}
    >
      <span className="block min-w-0 flex-1">
        <span className="block font-display text-[13.5px] font-semibold text-parchment">
          {label}
        </span>
        <span className="mt-1 block font-read text-[12.5px] leading-relaxed text-ink-faint">
          {disabled && disabledNote ? disabledNote : detail}
        </span>
      </span>
      <Toggle on={on} onChange={onChange} label={label} disabled={disabled} />
    </label>
  );
}

/* ----------------------------------------------------------- the settings */

const THEMES: { value: ThemeChoice; label: string }[] = [
  { value: 'dark', label: 'Lantern' },
  { value: 'light', label: 'Daylight' },
  { value: 'system', label: 'Match device' },
];

const SIZES: { value: TextScale; label: string; detail: string }[] = [
  { value: 0.9, label: 'Small', detail: '90%' },
  { value: 1, label: 'Default', detail: '100%' },
  { value: 1.15, label: 'Large', detail: '115%' },
  { value: 1.3, label: 'Largest', detail: '130%' },
];

const ALLOWANCES: { value: TimeAllowance; label: string; detail: string }[] = [
  { value: 1, label: 'Standard', detail: 'The published ACT timing.' },
  { value: 1.5, label: 'Time and a half', detail: '50% extra — the most common accommodation.' },
  { value: 2, label: 'Double time', detail: '100% extra.' },
];

export function DisplaySettings() {
  const { prefs, setPref, effectiveTheme } = usePrefs();

  return (
    <div className="panel mb-6 p-6 sm:p-7">
      <h2 className="heading mb-5 text-[1.125rem] text-parchment">Display &amp; reading</h2>

      <Field
        label="Theme"
        hint={
          prefs.theme === 'system'
            ? `Following your device, which is currently set to ${effectiveTheme === 'light' ? 'light' : 'dark'}.`
            : undefined
        }
      >
        <Segmented
          label="Theme"
          value={prefs.theme}
          options={THEMES}
          onChange={(v) => setPref('theme', v)}
        />
      </Field>

      <Field
        label="Text size"
        hint="Scales every word in the app. The layout around it stays put, so lines do not get shorter as the type gets bigger."
      >
        <Segmented
          label="Text size"
          value={prefs.textScale}
          options={SIZES}
          onChange={(v) => setPref('textScale', v)}
        />
      </Field>

      <SwitchRow
        label="High-legibility type"
        detail="Sets the whole app in Atkinson Hyperlegible, drawn by the Braille Institute to pull apart the letter shapes that are easiest to confuse — b/d, p/q, I/l/1 — with a little extra spacing."
        on={prefs.legibleFont}
        onChange={(v) => setPref('legibleFont', v)}
      />

      <SwitchRow
        label="Read aloud"
        detail="Adds a play button to every question, passage and lesson, read by your device's own voice. Nothing is recorded and nothing leaves this device."
        disabled={!speechSupported}
        disabledNote="This browser has no speech synthesiser, so read-aloud is unavailable here."
        on={prefs.readAloud}
        onChange={(v) => setPref('readAloud', v)}
      />

      <SwitchRow
        label="Use less data"
        detail="Replaces the region backdrops, the home screen art and the character art with flat colour in the same key. Worth turning on if you are on a metered connection or a slow one."
        on={prefs.reducedData}
        onChange={(v) => setPref('reducedData', v)}
      />

      <Field
        label="Time on timed sections"
        hint="If your school has granted you extended time on the real test, practise with the same clock. This changes Summit tests only — drills have never been timed."
      >
        <Segmented
          label="Time allowance"
          value={prefs.timeAllowance}
          options={ALLOWANCES}
          onChange={(v) => setPref('timeAllowance', v)}
        />
      </Field>
    </div>
  );
}

/* ---------------------------------------------------------- diagnostics */

/**
 * What has gone wrong on this device.
 *
 * There is no error-tracking vendor behind this app, on purpose — see the
 * long note at the top of `lib/report.ts`. This panel is the substitute: the
 * last forty failures, on screen, with a copy button. It turns "it says
 * something went wrong" into a paste an operator can act on, and it costs no
 * third party any knowledge of a minor.
 */
export function DiagnosticsPanel() {
  const [events, setEvents] = useState<ReportEvent[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => onDiagnostics(setEvents), []);
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2200);
    return () => window.clearTimeout(t);
  }, [copied]);

  if (!events.length) return null;

  const errors = events.filter((e) => e.level === 'error').length;

  return (
    <div className="panel p-6 sm:p-7">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="heading text-[1.125rem] text-parchment">Diagnostics</h2>
        <span className="font-script text-[10.5px] uppercase tracking-[0.14em] text-ink-faint">
          {events.length} recorded{errors ? ` · ${errors} error${errors === 1 ? '' : 's'}` : ''}
        </span>
      </div>

      <p className="mb-4 font-read text-[13px] leading-relaxed text-ink-faint">
        Problems this app noticed on this device — failed syncs, files it could not cache, screens
        that crashed. It stays here unless you send it. If something is not working, copying this
        into an email is the single most useful thing you can do.
      </p>

      <ul className="mb-4 max-h-56 space-y-1.5 overflow-auto rounded-lg border border-leather-700 bg-leather-950/60 p-3">
        {[...events].reverse().map((e, i) => (
          <li key={`${e.at}-${i}`} className="break-all font-mono text-[11px] leading-relaxed">
            <span
              className={e.level === 'error' ? 'text-blood-text' : 'text-gold'}
              role="img"
              aria-label={e.level === 'error' ? 'Error' : 'Warning'}
            >
              <Glyph
                name={e.level === 'error' ? 'cross' : 'alert'}
                size={e.level === 'error' ? 13 : 10}
                strokeWidth={2.2}
                className="inline-block align-[-1px]"
              />
            </span>{' '}
            <span className="text-parchment-dim">{e.scope}</span>{' '}
            <span className="text-ink-faint">{e.message}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2.5">
        <Button
          variant="ghost"
          onClick={() => {
            void navigator.clipboard?.writeText(diagnosticsText()).then(() => setCopied(true));
          }}
        >
          <Glyph name="copy" size={15} />
          {copied ? 'Copied' : 'Copy report'}
        </Button>
        <Button variant="ghost" onClick={clearDiagnostics}>
          Clear
        </Button>
      </div>
    </div>
  );
}
