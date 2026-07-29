/* Shared primitives, in the leather-and-parchment register. */

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '@/lib/utils';
import { sfx } from '@/lib/sfx';

type Variant = 'primary' | 'ghost' | 'danger' | 'quill';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
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
        variant === 'ghost' && 'btn-ghost',
        variant === 'danger' && 'btn-danger',
        variant === 'quill' && 'btn-quill',
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

export function Panel({
  children,
  className,
  lit,
}: {
  children: ReactNode;
  className?: string;
  lit?: boolean;
}) {
  return <div className={cx(lit ? 'panel-lit' : 'panel', className)}>{children}</div>;
}

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
    <span className={cx('chip', className)} style={color ? { color, borderColor: `${color}66` } : undefined}>
      {children}
    </span>
  );
}

export function ProgressBar({
  value,
  color = '#d4a017',
  className,
  height = 9,
  label,
}: {
  value: number;
  color?: string;
  className?: string;
  height?: number;
  label?: string;
}) {
  const pctValue = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      className={cx('w-full overflow-hidden rounded-full border border-leather-700 bg-leather-950', className)}
      style={{ height }}
      role="progressbar"
      aria-valuenow={pctValue}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${pctValue}%`, background: color, boxShadow: `0 0 10px ${color}77` }}
      />
    </div>
  );
}

/** A circular progress dial — used for per-region progress on the dashboard. */
export function ProgressRing({
  value,
  color,
  label,
  size = 76,
}: {
  value: number;
  color: string;
  label: string;
  size?: number;
}) {
  const r = 26;
  const circumference = 2 * Math.PI * r;
  const pctValue = Math.round(Math.min(1, Math.max(0, value)) * 100);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
          <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(0,0,0,.35)" strokeWidth="6" />
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - pctValue / 100)}
            style={{ transition: 'stroke-dashoffset .9s cubic-bezier(.22,1,.36,1)' }}
          />
        </svg>
        <span className="num absolute inset-0 flex items-center justify-center text-[15px] text-parchment">
          {pctValue}%
        </span>
      </div>
      <span className="font-script text-[12px] uppercase tracking-[0.14em] text-parchment-dim">
        {label}
      </span>
    </div>
  );
}

/** Rank sigil — a shield rather than the old hex badge. */
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
      <path
        d="M32 3 L57 12 V33 C57 47 45 57 32 61 C19 57 7 47 7 33 V12 Z"
        fill={`url(#${id})`}
        stroke={rank.ring}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M32 11 L50 17 V33 C50 43 41 51 32 54 C23 51 14 43 14 33 V17 Z"
        fill="none"
        stroke="rgba(0,0,0,.24)"
        strokeWidth="2"
      />
      <path
        d="M32 20 L35.4 28.6 L44.6 29.2 L37.5 35 L39.8 44 L32 39 L24.2 44 L26.5 35 L19.4 29.2 L28.6 28.6 Z"
        fill="rgba(255,255,255,.92)"
      />
    </svg>
  );
}

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
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-leather-700 px-6 py-12 text-center">
      <div className="heading text-[17px]">{title}</div>
      <p className="max-w-sm font-read text-[15px] leading-relaxed text-parchment-dim">{detail}</p>
      {action}
    </div>
  );
}

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
        {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
        <h1 className="heading text-[clamp(1.5rem,3.4vw,2.15rem)] leading-tight">{title}</h1>
        {detail && (
          <p className="mt-2.5 max-w-2xl font-read text-[15.5px] leading-relaxed text-parchment-dim">
            {detail}
          </p>
        )}
      </div>
      {right}
    </div>
  );
}
