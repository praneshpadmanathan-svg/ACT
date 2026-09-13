/* Shared primitives, in the leather-and-parchment register. */

import { useCallback, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Glyph, type IconName } from './Icon';
import { cx } from '@/lib/utils';
import { sfx } from '@/lib/sfx';
/* `@/content/sections` and not `@/content`: this file is on the eager path and
   the barrel drags 738 kB of question JSON in behind it. */
import { SECTIONS } from '@/content/sections';
import type { SectionId } from '@/types';
import { AnimatePresence, m, useReducedMotion, PIN_SPRING } from '@/lib/motion';
import { RankSigil, type SigilColors } from './RankSigil';
import { Vignette, type VignetteName } from './Vignette';
import { useStore } from '@/lib/store';
import { sectionIsFree } from '@/lib/features';
import { LockSigil } from '@/game/Sigils';

type Variant = 'primary' | 'ghost' | 'danger' | 'quill';
type Size = 'sm' | 'md' | 'lg';

/* Motion's button takes its own `onDrag`/`onAnimationStart` with different
   signatures to React's DOM ones, so those names are dropped rather than
   spread through. Nothing in the app uses them on a button. */
type NativeButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  | 'onAnimationStart'
  | 'onAnimationEnd'
  | 'onAnimationIteration'
  | 'onDrag'
  | 'onDragStart'
  | 'onDragEnd'
  | 'onDragEnter'
  | 'onDragExit'
  | 'onDragLeave'
  | 'onDragOver'
  | 'onDrop'
  | 'onTransitionEnd'
  | 'style'
>;

interface ButtonProps extends NativeButtonProps {
  variant?: Variant;
  size?: Size;
  quiet?: boolean;
  trailing?: boolean;
}

/* Forty-three buttons in this app ended their label with a typed `▶` or `▸`.
   That is one affordance — "this moves you onward" — spelled forty-three
   different ways: two glyphs, whatever font resolved them, no control over
   size, and a screen reader announcing "black right-pointing triangle" after
   the label. `trailing` makes it a property of the button instead, so the
   chevron is one size relative to the label everywhere and the assistive
   layer never hears it. */
const TRAIL_SIZE: Record<Size, number> = { sm: 13, md: 15, lg: 17 };

interface Ink {
  id: number;
  x: number;
  y: number;
}

/* Press physics, and the ink under them.

   The lift and the press used to be CSS `:hover` / `:active` transforms. Those
   arrive on a 150ms linear ramp and stop dead — a button that moves but does
   not respond. A spring reaches its target in about the same time and then
   overshoots by a few percent on release, which is the part a hand reads as
   weight. It also interrupts correctly: pressing mid-lift continues from
   wherever the button actually is rather than restarting.

   The ink spreads from the real click coordinates, not the centre, so the
   button acknowledges *where* it was pressed. On parchment that reads as ink
   soaking outward; it is the one flourish in the register that is not a glow. */
export function Button({
  variant = 'ghost',
  size = 'md',
  quiet = false,
  trailing = false,
  className,
  onClick,
  onPointerDown,
  children,
  ...rest
}: ButtonProps) {
  const [inks, setInks] = useState<Ink[]>([]);
  const nextInk = useRef(0);
  const stillMotion = useReducedMotion();

  const spread = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (stillMotion) return;
      const box = e.currentTarget.getBoundingClientRect();
      const id = nextInk.current++;
      setInks((prev) => [
        ...prev.slice(-2),
        { id, x: e.clientX - box.left, y: e.clientY - box.top },
      ]);
    },
    [stillMotion],
  );

  return (
    <m.button
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
      whileHover={rest.disabled ? undefined : { y: -1.5 }}
      whileTap={rest.disabled ? undefined : { y: 1, scale: 0.975 }}
      transition={PIN_SPRING}
      onPointerDown={(e) => {
        spread(e);
        onPointerDown?.(e);
      }}
      onClick={(e) => {
        if (!quiet) sfx.select();
        onClick?.(e);
      }}
      {...rest}
    >
      <AnimatePresence>
        {inks.map((ink) => (
          <m.span
            key={ink.id}
            aria-hidden="true"
            className="pointer-events-none absolute rounded-full"
            /* A negative z-index inside the button's own stacking context
               paints above its background and below the label — so the ink
               spreads under the text rather than over it. */
            style={{
              left: ink.x,
              top: ink.y,
              width: 12,
              height: 12,
              marginLeft: -6,
              marginTop: -6,
              zIndex: -1,
              background: 'radial-gradient(circle, currentColor 0%, transparent 70%)',
            }}
            initial={{ scale: 0, opacity: 0.34 }}
            animate={{ scale: 16, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            onAnimationComplete={() => setInks((prev) => prev.filter((i) => i.id !== ink.id))}
          />
        ))}
      </AnimatePresence>
      {children}
      {trailing && <Glyph name="chevronRight" size={TRAIL_SIZE[size]} className="-mr-1 opacity-80" />}
    </m.button>
  );
}

/* A leading icon on text that can wrap.

   The obvious spelling — `inline-flex items-center` with the icon as a flex
   child — is wrong here, and wrong in a way that only shows up at narrow
   widths: the label becomes a single flex item that wraps internally, and
   `items-center` then centres the icon against the *whole* wrapped block, so
   on three lines the star appears beside the second one. An inline-block icon
   flows with the first line instead and the remaining lines start at the
   margin, which is what the typed character used to do. */
export const LEADING_ICON = 'mr-1.5 inline-block align-[-1px]';

/* `.eyebrow` is a text style; this is the marked variant of it, which is how
   it is used nearly everywhere. The star was a typed `✦`, resolved out of
   whatever fallback font had it — heavier than the small caps beside it on
   Windows, missing on some Androids. */
export function Eyebrow({
  children,
  icon = 'spark',
  className,
}: {
  children: ReactNode;
  icon?: IconName;
  className?: string;
}) {
  /* `block`, not the inline default a bare <span> would take: nearly every
     call site was a <div> carrying a bottom margin, and one carries an enter
     animation. Vertical margins and transforms both do nothing on a
     non-replaced inline box, so an inline eyebrow silently loses its spacing
     and never animates. A span with `display:block` keeps it legal inside a
     <p> while behaving like the div it replaced. */
  return (
    <span className={cx('eyebrow block', className)}>
      <Glyph name={icon} size={12} className={LEADING_ICON} />
      {children}
    </span>
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
    <span
      className={cx('chip', className)}
      /* `color-mix`, not `${color}66`: these colours are token references
         now (`oklch(var(--c-section-math))`), and appending hex alpha to one
         yields a string CSS silently drops — the border would just vanish. */
      style={color ? { color, borderColor: `color-mix(in srgb, ${color} 40%, transparent)` } : undefined}
    >
      {children}
    </span>
  );
}

export function ProgressBar({
  value,
  color = 'oklch(var(--c-gold))',
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
      className={cx(
        'w-full overflow-hidden rounded-full border border-leather-700 bg-leather-950',
        className,
      )}
      style={{ height }}
      role="progressbar"
      aria-valuenow={pctValue}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{
          width: `${pctValue}%`,
          background: color,
          boxShadow: `0 0 10px color-mix(in srgb, ${color} 47%, transparent)`,
        }}
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

/**
 * Rank sigil.
 *
 * Kept as `RankBadge` because eleven call sites use that name; the drawing
 * moved to `RankSigil.tsx`, where each of the seven ranks now has its own
 * silhouette rather than sharing one recoloured shield.
 */
export function RankBadge(props: { rank: SigilColors; size?: number }) {
  return <RankSigil {...props} />;
}

/**
 * The nothing-here state.
 *
 * It was a dashed rectangle with two lines of text in it, which is the visual
 * language of a missing element rather than of an empty one. Now it has a
 * drawn scene: a lantern for "nothing found yet", a chest for "nothing earned
 * yet", a scroll for "nothing written yet", a banked fire for "come back
 * tomorrow". Callers pick the one that matches what is absent; `lantern` is
 * the default because looking-and-finding-nothing is the common case.
 */
export function EmptyState({
  title,
  detail,
  action,
  art = 'lantern',
}: {
  title: string;
  detail: string;
  action?: ReactNode;
  art?: VignetteName;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-leather-700/70 bg-leather-900/40 px-6 py-10 text-center">
      <Vignette name={art} size={116} className="mb-1 opacity-90" />
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

/* The four-section pill row.

   Library and Training had grown byte-identical copies of this. The Study tab
   made three, which is where a duplicated block stops being cheaper than a
   component — the pills are the thing a student uses to move between subjects
   on every list screen in the app, and they should not be able to drift apart
   depending on which one you are looking at. */
export function SectionTabs({
  active,
  hrefFor: href,
}: {
  active: SectionId;
  /** Where a pill points. Each screen keeps its own route. */
  hrefFor: (id: SectionId) => string;
}) {
  /* The pills still link to the locked subjects rather than hiding or
     disabling them. Two reasons: a person should be able to see what is on the
     other roads before deciding whether it is worth paying for, and a screen
     you cannot reach cannot explain itself — the destination renders the
     upsell, which is a better answer than a dead pill that does nothing when
     tapped. The sigil is what says "this one costs money". */
  const { isPro } = useStore();

  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {SECTIONS.map((s) => {
        const locked = !isPro && !sectionIsFree(s.id);
        return (
          <a
            key={s.id}
            href={href(s.id)}
            onClick={() => sfx.select()}
            aria-current={s.id === active ? 'page' : undefined}
            title={locked ? `${s.name} is part of Pro` : undefined}
            className={cx(
              'flex items-center gap-1.5 rounded-lg border-2 px-4 py-2 font-script text-[12px] uppercase tracking-wide transition-colors',
              s.id === active
                ? 'text-[#0d0620]'
                : 'border-leather-700 bg-leather-850 text-parchment-dim hover:text-parchment',
            )}
            style={s.id === active ? { background: s.fill, borderColor: s.fill } : undefined}
          >
            {s.name}
            {locked && (
              <LockSigil
                size={14}
                className={s.id === active ? 'opacity-70' : 'text-gold opacity-80'}
              />
            )}
            {locked && <span className="sr-only">(Pro)</span>}
          </a>
        );
      })}
    </div>
  );
}
