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
import {
  usePrefs,
  type TextScale,
  type ThemeChoice,
  type TimeAllowance,
} from '@/lib/prefs';
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
      {hint && <p className="mt-2 font-read text-[12.5px] leading-relaxed text-ink-faint">{hint}</p>}
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
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cx(
              'rounded-lg border-2 px-3.5 py-2 font-display text-[13px] font-semibold transition-colors',
              active
                ? 'border-gold bg-gold text-[#2a2000]'
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
        'relative inline-flex h-7 w-12 flex-none items-center rounded-full border-2 transition-colors disabled:opacity-40',
        on ? 'border-gold bg-gold/30' : 'border-leather-700 bg-leather-900',
      )}
    >
      <span
        className={cx(
          'block h-4 w-4 rounded-full transition-transform duration-200',
          on ? 'translate-x-[22px] bg-gold' : 'translate-x-[4px] bg-leather-600',
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
  return (
    <div className="flex items-start gap-4 border-t border-leather-700/70 py-4 first:border-t-0 first:pt-0">
      <div className="min-w-0 flex-1">
        <div className="font-display text-[13.5px] font-semibold text-parchment">{label}</div>
        <p className="mt-1 font-read text-[12.5px] leading-relaxed text-ink-faint">
          {disabled && disabledNote ? disabledNote : detail}
        </p>
      </div>
      <Toggle on={on} onChange={onChange} label={label} disabled={disabled} />
    </div>
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
    <div className="panel p-6 sm:p-7">
      <h3 className="heading mb-5 text-[12px] text-parchment">Display &amp; reading</h3>

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
        detail="Replaces the painted map, the camp and the character art with flat colour in the same key. Worth turning on if you are on a metered connection or a slow one."
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
        <h3 className="heading text-[12px] text-parchment">Diagnostics</h3>
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
          <li key={`${e.at}-${i}`} className="font-mono text-[11px] leading-relaxed">
            <span className={e.level === 'error' ? 'text-blood-text' : 'text-gold'}>
              {e.level === 'error' ? '✕' : '!'}
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
