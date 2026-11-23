import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { transition } from './viewTransition';

/* A stand-in for the browser: it records what was named when the "old"
   snapshot was taken, runs the update, then settles `finished`. */
let reduce = false;
window.matchMedia = ((q: string) => ({
  matches: q.includes('reduce') && reduce,
  media: q,
  addEventListener: () => {},
  removeEventListener: () => {},
})) as unknown as typeof window.matchMedia;

let snapshot: string[] = [];
let settle: () => void = () => {};
const named = () =>
  [...document.querySelectorAll<HTMLElement>('*')]
    .filter((el) => el.style.viewTransitionName)
    .map((el) => `${el.id}:${el.style.viewTransitionName}`);

beforeEach(() => {
  reduce = false;
  snapshot = [];
  (document as unknown as Record<string, unknown>).startViewTransition = vi.fn(
    (update: () => void | Promise<void>) => {
      snapshot = named();
      let done!: () => void;
      const finished = new Promise<void>((res) => (done = res));
      const updated = Promise.resolve().then(update);
      settle = () => void updated.then(done);
      return { finished, skipTransition: () => {} };
    },
  );
  document.body.innerHTML = '<main id="main"><button id="card">Wayside</button></main>';
  // jsdom lays nothing out; give the card a real, on-screen box.
  document.getElementById('card')!.getBoundingClientRect = () =>
    ({ top: 100, bottom: 160, width: 300, height: 60, left: 0, right: 300 }) as DOMRect;
});
afterEach(() => {
  delete (document as unknown as Record<string, unknown>).startViewTransition;
  document.body.innerHTML = '';
});

const flush = () => new Promise((r) => setTimeout(r, 0));

it('morphs the pressed card into the new heading, then clears every name', async () => {
  document.getElementById('card')!.click();

  const apply = vi.fn(() => {
    document.getElementById('main')!.innerHTML = '<h1 id="title">The Wayside Cottages</h1>';
  });
  transition(apply);

  // Photographed on the way out under the shared name.
  expect(snapshot).toEqual(['card:vt-origin']);
  expect(document.documentElement.dataset.vt).toBe('');

  await flush();
  expect(apply).toHaveBeenCalledOnce();
  // …and arriving as the new screen's title.
  expect(named()).toEqual(['title:vt-origin']);

  settle();
  await flush();
  expect(named()).toEqual([]);
  expect('vt' in document.documentElement.dataset).toBe(false);
});

it('applies the change directly, with no transition, under reduced motion', () => {
  reduce = true;
  const apply = vi.fn();
  transition(apply);
  expect(apply).toHaveBeenCalledOnce();
  expect(document.startViewTransition).not.toHaveBeenCalled();
});

it('applies the change directly in a browser without view transitions', () => {
  delete (document as unknown as Record<string, unknown>).startViewTransition;
  const apply = vi.fn();
  transition(apply);
  expect(apply).toHaveBeenCalledOnce();
});

it('does not morph a press that did not cause the navigation', async () => {
  let now = 1000;
  const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
  document.getElementById('card')!.click();
  now += 2000; // a timer or a redirect, long after the click
  transition(() => {});
  expect(snapshot).toEqual([]);
  clock.mockRestore();
});

it('does morph the same press when the navigation follows promptly', async () => {
  let now = 1000;
  const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
  document.getElementById('card')!.click();
  now += 50;
  transition(() => {
    document.getElementById('main')!.innerHTML = '<h1>Arrived</h1>';
  });
  expect(snapshot).toEqual(['card:vt-origin']);
  clock.mockRestore();
  // Let the update step finish inside the test, not after the file is torn down.
  await flush();
  settle();
  await flush();
});

it('ignores presses in the navigation chrome', () => {
  document.body.insertAdjacentHTML('afterbegin', '<nav><a id="rail" href="#/home">Home</a></nav>');
  document.getElementById('rail')!.click();
  transition(() => {});
  expect(snapshot).toEqual([]);
});
