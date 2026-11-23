import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { FxLayer } from './FxLayer';
import { fx } from '@/lib/fx';

const press = vi.spyOn(fx, 'press');

window.matchMedia = ((q: string) => ({
  matches: false,
  media: q,
  addEventListener: () => {},
  removeEventListener: () => {},
})) as unknown as typeof window.matchMedia;
HTMLCanvasElement.prototype.getContext = (() =>
  new Proxy({}, { get: () => () => {}, set: () => true })) as never;

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() =>
    root.render(
      <>
        <FxLayer />
        <button className="btn btn-primary">Begin</button>
        <button className="choice">An answer</button>
      </>,
    ),
  );
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  press.mockClear();
});

it('hosts a canvas that can never catch a tap', () => {
  const canvas = host.querySelector('canvas')!;
  expect(canvas).not.toBeNull();
  expect(canvas.className).toContain('pointer-events-none');
  expect(canvas.getAttribute('aria-hidden')).toBe('true');
});

it('throws no light on the chrome: a press on a button or an answer is just a press', () => {
  for (const b of host.querySelectorAll('button')) {
    b.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 4, clientY: 4 }),
    );
    b.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
  }
  expect(press).not.toHaveBeenCalled();
});
