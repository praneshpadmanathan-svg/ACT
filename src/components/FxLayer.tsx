/* The light layer: the canvas `lib/fx.ts` draws on, and the two document-wide
   listeners that make every important control answer a hand with light.

   Both listeners are delegated — one handler on the document, not one per
   button — so no component has to opt in and none can forget to. Which
   controls get the effect is decided here, in one selector list. */

import { useEffect, useRef } from 'react';
import { fx, fxEnabled, mountFx, type FxTone } from '@/lib/fx';

/* The controls worth lighting. Primary actions and answers: the things a press
   on actually commits to something. Ghost buttons, links and nav items stay
   quiet — light on everything is light on nothing. */
const PRESS = '.btn-primary, .btn-danger, .choice, .story-choice, [data-fx="press"]';

/* Surfaces that carry a specular highlight following the pointer. The
   primary button has its own light (the rim, in index.css) instead. */
const SHEEN = '.btn:not(.btn-primary), .choice, .story-choice, .fx-sheen';

function pressable(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const el = target.closest<HTMLElement>(PRESS);
  if (!el) return null;
  if (el.matches(':disabled, [aria-disabled="true"], .choice-locked') || el.closest('[inert]')) {
    return null;
  }
  return el;
}

const toneOf = (el: Element): FxTone => (el.matches('.btn-danger') ? 'ruin' : 'gold');

export function FxLayer() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const unmount = mountFx(el);

    /* Pointer presses light at the exact point of contact, on pointerdown —
       the press is acknowledged before the finger lifts, which is most of
       what makes a control feel instant. */
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || !fxEnabled()) return;
      const target = pressable(e.target);
      if (target) fx.press(e.clientX, e.clientY, toneOf(target));
    };
    /* Keyboard activation has no point of contact, so it lights from the
       control's centre. A click with `detail === 0` is one no pointer made. */
    const onClick = (e: MouseEvent) => {
      if (e.detail !== 0 || !fxEnabled()) return;
      const target = pressable(e.target);
      if (!target) return;
      const r = target.getBoundingClientRect();
      fx.press(r.left + r.width / 2, r.top + r.height / 2, toneOf(target));
    };

    /* The lamp's reflection. Each sheen surface reads `--fx-x`/`--fx-y` (its
       own coordinates, in px) to place a soft highlight under the pointer;
       see `.fx-sheen-layer` in index.css. Written once a frame at most, to
       the one element under the pointer, and only on devices that hover. */
    const canHover = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches ?? false;
    let frame = 0;
    let px = 0;
    let py = 0;
    let lit: HTMLElement | null = null;
    const paint = () => {
      frame = 0;
      const under = document.elementFromPoint(px, py);
      const surface = under instanceof Element ? under.closest<HTMLElement>(SHEEN) : null;
      if (lit && lit !== surface) lit.removeAttribute('data-fx-lit');
      lit = surface;
      if (!surface) return;
      const r = surface.getBoundingClientRect();
      surface.style.setProperty('--fx-x', `${(px - r.left).toFixed(1)}px`);
      surface.style.setProperty('--fx-y', `${(py - r.top).toFixed(1)}px`);
      surface.setAttribute('data-fx-lit', '');
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      px = e.clientX;
      py = e.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const onLeave = () => {
      lit?.removeAttribute('data-fx-lit');
      lit = null;
    };

    document.addEventListener('pointerdown', onDown, { capture: true, passive: true });
    document.addEventListener('click', onClick, true);
    if (canHover) {
      document.addEventListener('pointermove', onMove, { passive: true });
      document.documentElement.addEventListener('pointerleave', onLeave);
    }
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      if (frame) cancelAnimationFrame(frame);
      onLeave();
      unmount();
    };
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
