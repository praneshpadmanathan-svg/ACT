/* One async action at a time, with a busy flag that always comes back down.

   Every form and destructive button in the app had grown its own copy of
   `setBusy(true); try { … } finally { setBusy(false) }`, and the copies
   drifted: one used `.then()` with no `.catch()`, so a thrown request left the
   Danger zone's buttons disabled until a reload; none of them could refuse a
   second call made before React had re-rendered the first one's `disabled`.

   The lock is a ref, not the state. State is only read on the next render, so
   two calls inside one task — Enter held down on a form, a click landing in
   the same frame as a key — both saw `busy === false`. The ref is set
   synchronously, so the second call returns `undefined` and does nothing.

   `busy` is only lowered while mounted: an action that ends by navigating away
   has nothing left to re-enable. */

import { useCallback, useEffect, useRef, useState } from 'react';

export function useAsyncAction() {
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /** Run `fn` unless another action is already in flight. Resolves to its
   *  result, or `undefined` when the call was refused. Errors still reject,
   *  but the lock and the busy flag are released first. */
  const run = useCallback(async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (lock.current) return undefined;
    lock.current = true;
    setBusy(true);
    try {
      return await fn();
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }, []);

  return [busy, run] as const;
}
