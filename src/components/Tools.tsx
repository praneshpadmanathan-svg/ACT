/* The two things the real ACT gives you that this app did not.
 *
 * A calculator is permitted on the Math section — practising without one
 * trains a habit you cannot use on the day — and scratch paper is permitted on
 * all of them. The student's own words in the review were "no notes/scratch
 * space for math work" and "no calculator, and the real ACT allows one".
 *
 * They live together in one dock so they cost one fixed control rather than
 * two, and the dock is deliberately draggable-free and corner-anchored: a
 * floating window that can be moved is a window that can be lost behind a
 * modal, and this has to be reachable mid-question every time.
 *
 * The scratch pad persists per session, not per question. Working through a
 * geometry problem across two screens is normal, and wiping the pad on
 * `Next question` would be actively hostile.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDialogFocus } from '@/lib/useDialogFocus';
import { readRaw, writeRaw } from '@/lib/storage';
import { cx } from '@/lib/utils';
import { Glyph } from './Icon';

const SCRATCH_KEY = 'act-command:scratch';

/* ------------------------------------------------------------- calculator */

/* A four-function calculator with the operations the ACT Math section
   actually needs, and nothing else.
 *
 * Deliberately not a scientific calculator and deliberately not an expression
 * parser. The real exam permits a specific list of models; a grapher with a
 * solver would let a student practise a technique they will not have on the
 * day, which is worse than having no calculator at all. Square root, square,
 * percent and sign flip are on every permitted model.
 *
 * The arithmetic runs on the accumulator pattern rather than `eval` or a
 * parser: `pending` holds the left operand and the operator, and pressing a
 * new operator resolves the previous one first, which is how a physical
 * calculator chains `2 + 3 × 4` into 20. That is the behaviour a student's
 * hardware will have. */

type Op = '+' | '−' | '×' | '÷';

function applyOp(a: number, b: number, op: Op): number {
  switch (op) {
    case '+': return a + b;
    case '−': return a - b;
    case '×': return a * b;
    case '÷': return b === 0 ? NaN : a / b;
  }
}

/** Trim floating-point noise without lying about the value. */
function display(value: number): string {
  if (!Number.isFinite(value)) return 'Error';
  const rounded = Number(value.toPrecision(12));
  if (Math.abs(rounded) >= 1e12 || (rounded !== 0 && Math.abs(rounded) < 1e-9)) {
    return rounded.toExponential(6).replace('e', ' e');
  }
  return String(rounded);
}

function Calculator() {
  const [entry, setEntry] = useState('0');
  /** True while `entry` is a result rather than something being typed. */
  const [settled, setSettled] = useState(true);
  const [pending, setPending] = useState<{ value: number; op: Op } | null>(null);

  const pushDigit = useCallback((digit: string) => {
    setEntry((prev) => {
      if (settled) return digit === '.' ? '0.' : digit;
      if (digit === '.' && prev.includes('.')) return prev;
      if (prev === '0' && digit !== '.') return digit;
      // A calculator that lets you type forever is a calculator you can break.
      return prev.length >= 14 ? prev : prev + digit;
    });
    setSettled(false);
  }, [settled]);

  const chooseOp = useCallback((op: Op) => {
    const current = Number(entry);
    setPending((prev) => {
      if (prev && !settled) {
        const result = applyOp(prev.value, current, prev.op);
        setEntry(display(result));
        return { value: result, op };
      }
      return { value: current, op };
    });
    setSettled(true);
  }, [entry, settled]);

  const equals = useCallback(() => {
    if (!pending) return;
    const result = applyOp(pending.value, Number(entry), pending.op);
    setEntry(display(result));
    setPending(null);
    setSettled(true);
  }, [entry, pending]);

  const unary = useCallback((fn: (n: number) => number) => {
    setEntry((prev) => display(fn(Number(prev))));
    setSettled(true);
  }, []);

  const clear = useCallback(() => {
    setEntry('0');
    setPending(null);
    setSettled(true);
  }, []);

  /* Type into it. Anyone reaching for a calculator mid-question has their
     hands on the keyboard already, and hunting for the ÷ button with a mouse
     is slower than the mental arithmetic it replaces. */
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const k = e.key;
      if (/^[0-9.]$/.test(k)) { e.preventDefault(); pushDigit(k); return; }
      if (k === '+') { e.preventDefault(); chooseOp('+'); return; }
      if (k === '-') { e.preventDefault(); chooseOp('−'); return; }
      if (k === '*' || k === 'x') { e.preventDefault(); chooseOp('×'); return; }
      if (k === '/') { e.preventDefault(); chooseOp('÷'); return; }
      if (k === 'Enter' || k === '=') { e.preventDefault(); equals(); return; }
      if (k === 'Escape' || k === 'c') { e.preventDefault(); clear(); return; }
      if (k === 'Backspace') {
        e.preventDefault();
        setEntry((prev) => (settled || prev.length <= 1 ? '0' : prev.slice(0, -1)));
        setSettled(false);
      }
    },
    [pushDigit, chooseOp, equals, clear, settled],
  );

  const key = (label: string, onClick: () => void, variant?: 'op' | 'wide' | 'accent') => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      className={cx(
        'rounded-lg border-2 py-2.5 font-display text-[15px] font-semibold transition-colors',
        variant === 'op' && 'border-gold-deep bg-leather-800 text-gold hover:bg-leather-750',
        variant === 'accent' && 'border-gold bg-gold text-[#2a2000] hover:brightness-110',
        variant === 'wide' && 'col-span-2 border-leather-700 bg-leather-800 text-parchment-dim hover:border-gold-deep',
        !variant && 'border-leather-700 bg-leather-850 text-parchment hover:border-gold-deep',
      )}
    >
      {label}
    </button>
  );

  return (
    <div onKeyDown={onKeyDown} role="application" aria-label="Calculator">
      <output
        className="mb-2.5 block w-full overflow-hidden text-ellipsis rounded-lg border-2 border-leather-700
                   bg-leather-950 px-3 py-3 text-right font-display text-[26px] leading-none text-gold"
        aria-live="polite"
      >
        {entry}
      </output>
      <div className="grid grid-cols-4 gap-1.5">
        {key('C', clear, 'wide')}
        {key('√', () => unary(Math.sqrt), 'op')}
        {key('÷', () => chooseOp('÷'), 'op')}

        {key('7', () => pushDigit('7'))}
        {key('8', () => pushDigit('8'))}
        {key('9', () => pushDigit('9'))}
        {key('×', () => chooseOp('×'), 'op')}

        {key('4', () => pushDigit('4'))}
        {key('5', () => pushDigit('5'))}
        {key('6', () => pushDigit('6'))}
        {key('−', () => chooseOp('−'), 'op')}

        {key('1', () => pushDigit('1'))}
        {key('2', () => pushDigit('2'))}
        {key('3', () => pushDigit('3'))}
        {key('+', () => chooseOp('+'), 'op')}

        {key('±', () => unary((n) => -n))}
        {key('0', () => pushDigit('0'))}
        {key('.', () => pushDigit('.'))}
        {key('=', equals, 'accent')}

        {key('x²', () => unary((n) => n * n), 'wide')}
        {key('%', () => unary((n) => n / 100), 'wide')}
      </div>
      <p className="mt-2.5 font-read text-[11.5px] leading-snug text-ink-faint">
        Four functions plus root, square and percent — the same set every ACT-permitted model has.
        Your keyboard works too.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- scratchpad */

function Scratchpad() {
  const [text, setText] = useState(() => readRaw(SCRATCH_KEY) ?? '');

  /* Written on a debounce rather than on every keystroke. A student working
     out a long division writes fast, and `storage.ts` has to serialise and
     re-enter localStorage on each one. */
  useEffect(() => {
    const id = window.setTimeout(() => writeRaw(SCRATCH_KEY, text), 400);
    return () => window.clearTimeout(id);
  }, [text]);

  return (
    <div>
      <label className="mb-2 block font-script text-[10.5px] uppercase tracking-[0.14em] text-ink-faint">
        Scratch paper
      </label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        rows={11}
        placeholder={'Work it out here.\n\n2x + 6 = 18\n2x = 12\nx = 6'}
        className="w-full resize-none rounded-lg border-2 border-parchment-edge bg-parchment px-3.5 py-3
                   font-mono text-[13.5px] leading-relaxed text-ink outline-none
                   placeholder:text-ink-faint focus:border-gold-deep"
      />
      <div className="mt-2 flex items-center justify-between">
        <p className="font-read text-[11.5px] text-ink-faint">
          Kept until you clear it, across every question.
        </p>
        <button
          type="button"
          onClick={() => setText('')}
          className="font-script text-[11px] uppercase tracking-[0.14em] text-ink-faint transition-colors hover:text-gold"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- the dock */

type Tool = 'calculator' | 'scratch';

/**
 * The corner dock.
 *
 * Rendered fixed, above the sheet but below the story overlay, and padded for
 * the safe-area insets so it clears the home indicator on a phone. Open state
 * is local: a student who closes the calculator on question 4 and wants it
 * again on question 9 is one tap away either time, and remembering it across a
 * session would leave it covering the answers for everyone who does not.
 */
export function ToolDock({ mathHint = false }: { mathHint?: boolean }) {
  const [open, setOpen] = useState<Tool | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useDialogFocus(panelRef, open !== null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="pointer-events-none fixed bottom-0 right-0 z-[80] flex flex-col items-end gap-2 p-4"
         style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-label={open === 'calculator' ? 'Calculator' : 'Scratch paper'}
          tabIndex={-1}
          className="panel pointer-events-auto w-[min(20rem,calc(100vw-2rem))] animate-riseIn p-4 shadow-card"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="font-script text-[11px] uppercase tracking-[0.16em] text-gold">
              {open === 'calculator' ? 'Calculator' : 'Scratch paper'}
            </span>
            <button
              type="button"
              onClick={() => setOpen(null)}
              className="hud-icon h-7 w-7"
              aria-label="Close"
            >
              <Glyph name="cross" size={14} />
            </button>
          </div>
          {open === 'calculator' ? <Calculator /> : <Scratchpad />}
        </div>
      )}

      <div className="pointer-events-auto flex gap-2">
        <DockButton
          label="Scratch paper"
          icon="pencil"
          active={open === 'scratch'}
          onClick={() => setOpen((v) => (v === 'scratch' ? null : 'scratch'))}
        />
        <DockButton
          label="Calculator"
          icon="calculator"
          active={open === 'calculator'}
          onClick={() => setOpen((v) => (v === 'calculator' ? null : 'calculator'))}
          /* On Math, the calculator is the one the real exam permits, so it is
             worth pointing at the first time somebody lands on the section. */
          hint={mathHint && !open}
        />
      </div>
    </div>
  );
}

function DockButton({
  label,
  icon,
  active,
  onClick,
  hint,
}: {
  label: string;
  icon: 'pencil' | 'calculator';
  active: boolean;
  onClick: () => void;
  hint?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cx(
        'flex h-11 w-11 items-center justify-center rounded-xl border-2 shadow-card backdrop-blur transition-colors',
        active
          ? 'border-gold bg-gold text-[#2a2000]'
          : 'border-leather-700 bg-leather-950/90 text-parchment-dim hover:border-gold-deep hover:text-gold',
        hint && 'animate-questPulse',
      )}
    >
      <Glyph name={icon} size={19} />
    </button>
  );
}
