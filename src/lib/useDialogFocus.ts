/* Focus management for the app's two full-screen dialogs.

   Both the story overlay and the road chooser cover the whole viewport, but
   neither moved focus into itself, and everything behind them stayed in the tab
   order — on the Study tab that is nine landmark rows, the boss card, the
   subject pills and the whole nav rail. A keyboard user had to tab through all
   of it to reach "Skip", and a screen reader user was never told a dialog had
   opened at all.

   So: move focus in on open, keep Tab inside while it is open, mark the rest of
   the page inert, and put focus back where it came from on close.

   `onEscape` is optional on purpose. Escape should close anything you opened to
   look at, but the road chooser is a forced choice with no default — dismissing
   it would leave the profile in a state the player never picked — so it passes
   nothing and stays non-dismissible. */

import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/* Open dialogs, oldest first. Each one listens for keys on the document in
   the capture phase, and listeners on one target all run whatever
   `stopPropagation` says — so with a confirm open over another dialog, one
   Escape closed *both*. Only the newest answers the keyboard. */
const stack: HTMLElement[] = [];

/** Where focus goes when the element that opened a dialog no longer exists. */
function fallbackFocus(): HTMLElement | null {
  return document.getElementById('main') ?? document.querySelector<HTMLElement>('main');
}

export function useDialogFocus(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  onEscape?: () => void,
) {
  /* Held in a ref so an inline arrow at the call site does not re-run the
     effect: that would tear the inert attributes off and re-focus the first
     control on every render of the dialog's parent. */
  const escape = useRef(onEscape);
  /* Deliberately has no dependency array: it re-points the ref after every
     render, and the keydown handler below only ever reads it from a real
     keypress, long after this has flushed. */
  useEffect(() => {
    escape.current = onEscape;
  });

  useEffect(() => {
    const node = ref.current;
    if (!active || !node) return;

    const returnTo = document.activeElement as HTMLElement | null;

    /* Everything that is not this dialog goes inert, which removes it from the
       tab order and hides it from assistive tech in one step. */
    const siblings: HTMLElement[] = [];
    for (const child of Array.from(document.body.children)) {
      if (child === node || child.contains(node)) continue;
      const el = child as HTMLElement;
      if (el.hasAttribute('inert')) continue;
      el.setAttribute('inert', '');
      siblings.push(el);
    }
    /* The dialog is usually mounted inside #root alongside the screen, so also
       inert the siblings within its own parent chain. */
    let parent = node.parentElement;
    while (parent && parent !== document.body) {
      for (const child of Array.from(parent.children)) {
        if (child === node || child.contains(node)) continue;
        const el = child as HTMLElement;
        if (el.hasAttribute('inert')) continue;
        el.setAttribute('inert', '');
        siblings.push(el);
      }
      parent = parent.parentElement;
    }

    stack.push(node);

    /* Focus the first control, or the dialog itself if it has none yet. Only
       while focus is still outside: the fallback timer below fires 120ms in,
       and by then a quick click or Tab may already have put focus somewhere
       inside on purpose — snatching it back to the first control lost that. */
    const focusFirst = () => {
      if (node.contains(document.activeElement)) return;
      const first = node.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? node).focus({ preventScroll: true });
    };
    const raf = window.requestAnimationFrame(focusFirst);
    // rAF does not run in a hidden tab, so make sure focus still lands.
    const fallback = window.setTimeout(focusFirst, 120);

    /* Keep Tab inside. The story overlay's lines arrive one at a time, so the
       focusable set is re-read on every keypress rather than cached. */
    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== node) return;
      if (e.key === 'Escape' && escape.current) {
        e.preventDefault();
        e.stopPropagation();
        escape.current();
        return;
      }
      if (e.key !== 'Tab') return;
      /* Tab order only. `FOCUSABLE` matches a `tabindex="-1"` button — the
         story's full-screen "continue" surface is one — and with it as the
         last item Tab off the real last control was never caught, and walked
         out of the dialog into the browser chrome. */
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.tabIndex >= 0 && (el.offsetParent !== null || el === document.activeElement),
      );
      if (!items.length) {
        e.preventDefault();
        node.focus({ preventScroll: true });
        return;
      }
      // The empty case returned above, so both ends exist.
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const current = document.activeElement as HTMLElement | null;
      /* Outside the dialog, or on something inside that is not in the tab
         order: the browser's own next step from there is not guaranteed to
         stay in, so take it. */
      if (!current || !node.contains(current) || !items.includes(current)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }
      if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && current === first) {
        e.preventDefault();
        last.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(fallback);
      document.removeEventListener('keydown', onKey, true);
      siblings.forEach((el) => el.removeAttribute('inert'));
      const at = stack.lastIndexOf(node);
      if (at >= 0) stack.splice(at, 1);
      /* Back where it came from — unless that element went away while the
         dialog was up (the rank-up lands as the question that earned it is
         replaced), in which case focus would fall to <body> and a keyboard
         user would start again from the skip link. The main landmark is the
         nearest thing to "where you were". */
      const target =
        returnTo && returnTo.isConnected && returnTo !== document.body ? returnTo : fallbackFocus();
      target?.focus?.({ preventScroll: true });
    };
  }, [ref, active]);
}
