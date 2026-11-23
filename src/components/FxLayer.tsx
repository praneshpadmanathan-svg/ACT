/* The light layer: the canvas `lib/fx.ts` draws on.

   It used to listen to the whole document as well — a ring of light under
   every primary press, and a highlight that followed the pointer across
   buttons and answers. That was light on the chrome, answering nothing in
   particular, and DESIGN.md keeps this layer for the moments that earn it:
   an answer judged (QuestionRunner calls `fx.correct` / `fx.wrong`), a blow in
   a duel, a rank earned. Those call `fx` directly; this only hosts the canvas. */

import { useEffect, useRef } from 'react';
import { mountFx } from '@/lib/fx';

export function FxLayer() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return mountFx(el);
  }, []);

  /* Above the rank-up overlay (110) so its burst is visible; below the story
     and confirm dialogs (120), which should never have light thrown over
     their text. `pointer-events: none`, always — light never catches a tap. */
  return (
    <canvas
      ref={ref}
      className="vt-fx pointer-events-none fixed inset-0 z-[115]"
      aria-hidden="true"
    />
  );
}
