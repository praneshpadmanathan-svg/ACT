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
        <button className="btn btn-primary" disabled>
          Locked
        </button>
        <button className="choice choice-locked" aria-disabled="true">
          Answered
        </button>
        <button className="btn btn-ghost">Quiet</button>
        <button className="btn btn-danger">Delete</button>
      </>,
    ),
  );
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  press.mockClear();
});

const button = (text: string) =>
  [...host.querySelectorAll('button')].find((b) => b.textContent === text)!;
const down = (el: Element) =>
  el.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 40, clientY: 20 }),
  );

it('lights a primary press at the point of contact', () => {
  down(button('Begin'));
  expect(press).toHaveBeenCalledWith(40, 20, 'gold');
});

it('lights a destructive press in ember, not gold', () => {
  down(button('Delete'));
  expect(press).toHaveBeenCalledWith(40, 20, 'ruin');
});

it('stays dark on disabled controls, answered choices and quiet buttons', () => {
  // A disabled button gets no pointer events in a browser; dispatching proves the guard.
  down(button('Locked'));
  down(button('Answered'));
  down(button('Quiet'));
  expect(press).not.toHaveBeenCalled();
});

it('lights a keyboard activation from the centre of the control', () => {
  const b = button('Begin');
  b.getBoundingClientRect = () =>
    ({ left: 10, top: 10, width: 100, height: 40, right: 110, bottom: 50 }) as DOMRect;
  b.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
  expect(press).toHaveBeenCalledWith(60, 30, 'gold');
});
