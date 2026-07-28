/* Shared primitives. Small on purpose — anything that only one screen uses
   lives with that screen instead. */

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '@/lib/utils';
import { sfx } from '@/lib/sfx';

/* ----------------------------------------------------------------- button */

type Variant = 'primary' | 'gold' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Play the arcade blip on click. On by default. */
  quiet?: boolean;
}

export function Button({
  variant = 'ghost',
  size = 'md',
  quiet = false,
  className,
  onClick,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={cx(
        'btn',
        variant === 'primary' && 'btn-primary',
        variant === 'gold' && 'btn-gold',
        variant === 'ghost' && 'btn-ghost',
        variant === 'danger' && 'btn-danger',
        size === 'sm' && 'btn-sm',
        size === 'lg' && 'btn-lg',
        className,
      )}
      onClick={(e) => {
        if (!quiet) sfx.select();
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ panel */

export function Panel({
  children,
  className,
  raised,
}: {
  children: ReactNode;
  className?: string;
  raised?: boolean;
}) {
  return <div className={cx(raised ? 'pixel-panel-raised' : 'pixel-panel', className)}>{children}</div>;
}

/* ------------------------------------------------------------------- chip */

export function Chip({
  children,
  color,
  className,
}: {
  children: ReactNode;
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={cx('chip', className)}
      style={color ? { color, borderColor: `${color}55` } : undefined}
    >
      {children}
    </span>
  );
}

/* --------------------------------------------------------------- progress */

export function ProgressBar({
  value,
  color = '#ffd23e',
  className,
  height = 10,
  label,
}: {
  /** 0-1 */
  value: number;
  color?: string;
  className?: string;
  height?: number;
  label?: string;
}) {
  const pctValue = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      className={cx('w-full overflow-hidden rounded-full border-2 border-edge bg-ink-900', className)}
      style={{ height }}
      role="progressbar"
      aria-valuenow={pctValue}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${pctValue}%`, background: color, boxShadow: `0 0 12px ${color}88` }}
      />
    </div>
  );
}

/* ------------------------------------------------------------- rank badge */

export function RankBadge({
  rank,
  size = 56,
}: {
  rank: { name: string; c1: string; c2: string; ring: string };
  size?: number;
}) {
  const id = `rank-${rank.name.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-label={`${rank.name} rank`} role="img">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={rank.c1} />
          <stop offset="1" stopColor={rank.c2} />
        </linearGradient>
      </defs>
      <polygon points="32,3 58,17 58,45 32,60 6,45 6,17" fill={`url(#${id})`} stroke={rank.ring} strokeWidth="2.5" />
      <polygon points="32,12 49,22 49,42 32,52 15,42 15,22" fill="none" stroke="rgba(0,0,0,.28)" strokeWidth="2" />
      <polygon
        points="32,19 35.6,28.4 45.6,29 38,35.4 40.4,45 32,39.6 23.6,45 26,35.4 18.4,29 28.4,28.4"
        fill="rgba(255,255,255,.9)"
      />
    </svg>
  );
}

/* ----------------------------------------------------------- empty states */

export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-edge px-6 py-12 text-center">
      <div className="font-screen text-[15px] uppercase tracking-wide text-[#cdd4f0]">{title}</div>
      <p className="max-w-sm text-sm leading-relaxed text-[#8f86b5]">{detail}</p>
      {action}
    </div>
  );
}

/* --------------------------------------------------------------- sections */

export function SectionHeading({
  eyebrow,
  title,
  detail,
  right,
}: {
  eyebrow?: string;
  title: string;
  detail?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <div className="mb-2 font-screen text-[11px] uppercase tracking-[0.18em] text-[#8f86b5]">
            {eyebrow}
          </div>
        )}
        <h1 className="heading-pixel text-[clamp(15px,2.6vw,22px)] text-white">{title}</h1>
        {detail && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#a89ac6]">{detail}</p>}
      </div>
      {right}
    </div>
  );
}
