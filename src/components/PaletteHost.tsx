/* Holds the ⌘K shortcut without holding the dialog.
 *
 * Everything expensive about the palette is in `CommandPalette.tsx`; this file
 * is the part that has to be eager, and it is deliberately almost nothing: the
 * key listener, an open flag, and a lazy import that fires the first time
 * someone actually asks. Once loaded the dialog stays mounted, so the second
 * ⌘K is instant. See `@/lib/palette` for why the split exists at all. */

import { Suspense, lazy, useEffect, useState } from 'react';
import { onPaletteOpen } from '@/lib/palette';

const CommandPalette = lazy(() =>
  import('./CommandPalette').then((m) => ({ default: m.CommandPalette })),
);

export function PaletteHost() {
  const [open, setOpen] = useState(false);
  /* Separate from `open`, and never goes back to false: unmounting the dialog
     on close would throw away the loaded chunk's component tree and re-run the
     content index on the next open. */
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const show = () => {
      setLoaded(true);
      setOpen(true);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        /* Toggle, so the same keystroke that opened it closes it. */
        setLoaded(true);
        setOpen((v) => !v);
        return;
      }
      /* `/` is the shortcut people try before they try anything else — but only
         when they are not already typing, or it eats a slash in an answer. */
      const el = e.target as HTMLElement | null;
      const typing =
        !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
      if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        show();
      }
    };

    /* Capture: a screen that has claimed a key for its own purpose should not be
       able to take the app's one global shortcut down with it. */
    window.addEventListener('keydown', onKey, true);
    const offEvent = onPaletteOpen(show);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      offEvent();
    };
  }, []);

  if (!loaded) return null;

  /* No fallback: the only thing loading is a dialog that is about to appear,
     and a spinner flashed over the page for one network tick is worse than the
     dialog arriving a tick late. */
  return (
    <Suspense fallback={null}>
      <CommandPalette open={open} onOpenChange={setOpen} />
    </Suspense>
  );
}
