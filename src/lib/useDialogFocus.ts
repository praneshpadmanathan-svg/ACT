/* Focus management for the app's two full-screen dialogs.

   Both the story overlay and the road chooser cover the whole viewport, but
   neither moved focus into itself, and everything behind them stayed in the tab
   order — on the map that is 44 landmark pins plus the HUD. A keyboard user had
   to tab through the entire world to reach "Skip", and a screen reader user was
   never told a dialog had opened at all.

   So: move focus in on open, keep Tab inside while it is open, mark the rest of
   the page inert, and put focus back where it came from on close. */

import { useEffect, type RefObject } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useDialogFocus(ref: RefObject<HTMLElement | null>, active: boolean) {
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

    // Focus the first control, or the dialog itself if it has none yet.
    const focusFirst = () => {
      const first = node.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? node).focus({ preventScroll: true });
    };
    const raf = window.requestAnimationFrame(focusFirst);
    // rAF does not run in a hidden tab, so make sure focus still lands.
    const fallback = window.setTimeout(focusFirst, 120);

    /* Keep Tab inside. The story overlay's lines arrive one at a time, so the
       focusable set is re-read on every keypress rather than cached. */
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
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
      if (!node.contains(current)) {
        e.preventDefault();
        first.focus();
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
      returnTo?.focus?.({ preventScroll: true });
    };
  }, [ref, active]);
}
