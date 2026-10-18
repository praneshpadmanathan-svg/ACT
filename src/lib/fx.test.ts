import { afterEach, beforeEach, expect, it, vi } from 'vitest';

/* jsdom has no 2D canvas and no frame clock. Both are stubbed: a context that
   records calls, and a rAF queue the tests step by hand at a chosen rate. */
const motion = { matches: false, forced: false };
window.matchMedia = ((q: string) => ({
  ...motion,
  get matches() {
    if (q.includes('forced-colors')) return motion.forced;
    return q.includes('reduce') ? motion.matches : false;
  },
  media: q,
  addEventListener: () => {},
  removeEventListener: () => {},
})) as unknown as typeof window.matchMedia;

const ctx = new Proxy(
  { calls: [] as string[] },
  {
    get(target, key) {
      if (key in target) return target[key as 'calls'];
      return (...args: unknown[]) => {
        // As strict as Chromium's: a negative radius is an exception, not a no-op.
        if (key === 'arc' && (args[2] as number) < 0) throw new RangeError('negative radius');
        target.calls.push(String(key));
        return { addColorStop: () => {} };
      };
    },
    set(target, key, value) {
      if (key === 'globalCompositeOperation') target.calls.push(`blend:${String(value)}`);
      return true;
    },
  },
);
HTMLCanvasElement.prototype.getContext = (() => ctx) as never;

let queue: FrameRequestCallback[] = [];
let clock = 0;
vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
  queue.push(cb);
  return queue.length;
});
vi.stubGlobal('cancelAnimationFrame', () => {
  queue = [];
});
vi.spyOn(performance, 'now').mockImplementation(() => clock);

/** Advance the frame clock by `ms` in steps of `step`. */
function run(ms: number, step = 1000 / 60) {
  for (let t = 0; t < ms; t += step) {
    clock += step;
    const due = queue;
    queue = [];
    due.forEach((cb) => cb(clock));
  }
}

const { fx, mountFx, MAX_PARTICLES } = await import('./fx');

let unmount: () => void;
beforeEach(() => {
  motion.matches = false;
  motion.forced = false;
  queue = [];
  unmount = mountFx(document.createElement('canvas'));
});
afterEach(() => unmount());

it('draws a press and then stops its own loop once the light has died', () => {
  fx.press(100, 100);
  expect(fx.count).toBeGreaterThan(0);
  run(2000);
  expect(fx.count).toBe(0);
  // No frame left queued: an idle page costs nothing.
  expect(queue).toHaveLength(0);
});

it('does nothing at all for someone who asked for reduced motion', () => {
  motion.matches = true;
  fx.press(100, 100);
  fx.celebrate();
  expect(fx.count).toBe(0);
  expect(queue).toHaveLength(0);
});

it('never holds more than its particle budget, however much is asked of it', () => {
  for (let i = 0; i < 20; i++) fx.celebrate(200, 200);
  expect(fx.count).toBe(MAX_PARTICLES);
});

it('lives the same length of time at 120Hz as at 60Hz', () => {
  const lifetime = (step: number) => {
    fx.press(50, 50);
    let elapsed = 0;
    while (fx.count > 0 && elapsed < 5000) {
      run(step, step);
      elapsed += step;
    }
    return elapsed;
  };
  const at60 = lifetime(1000 / 60);
  const at120 = lifetime(1000 / 120);
  // Same effect, finer steps: within one 60Hz frame of each other.
  expect(Math.abs(at60 - at120)).toBeLessThanOrEqual(1000 / 60 + 1);
});

it('drops everything when the tab is hidden rather than freezing it mid-air', () => {
  fx.celebrate(10, 10);
  Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  document.dispatchEvent(new Event('visibilitychange'));
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  expect(fx.count).toBe(0);
});

it('ignores an element that is off screen', () => {
  const el = document.createElement('div');
  el.getBoundingClientRect = () =>
    ({ left: 0, top: -500, right: 100, bottom: -400, width: 100, height: 100 }) as DOMRect;
  fx.correct(el, 3);
  run(20);
  expect(fx.count).toBe(0);
});

it('measures an answer after the frame it changed, where it has moved to', () => {
  const el = document.createElement('div');
  document.body.appendChild(el);
  let top = 100;
  el.getBoundingClientRect = () =>
    ({ left: 0, top, right: 300, bottom: top + 60, width: 300, height: 60 }) as DOMRect;
  fx.correct(el, 0);
  expect(fx.count).toBe(0); // nothing yet: layout is not final inside the click
  top = 180; // the explanation opened above it
  run(1);
  expect(fx.count).toBeGreaterThan(0);
  el.remove();
});

it('throws gold leaf that falls out of the world on its own', () => {
  fx.confetti(40, 200, 200);
  expect(fx.count).toBe(40);
  run(4000);
  expect(fx.count).toBe(0);
  expect(queue).toHaveLength(0);
});

it('draws leaf before light, switching blend modes once each per frame', () => {
  ctx.calls.length = 0;
  fx.confetti(5, 100, 100);
  fx.press(100, 100);
  run(1000 / 60);
  const blends = ctx.calls.filter((c) => c.startsWith('blend:'));
  // Matter, then light, then back to normal: three writes, however many particles.
  expect(blends).toEqual(['blend:source-over', 'blend:lighter', 'blend:source-over']);
  // And the leaf was drawn before any light.
  const firstImage = ctx.calls.indexOf('drawImage');
  expect(firstImage).toBeGreaterThan(ctx.calls.indexOf('blend:source-over'));
  expect(firstImage).toBeLessThan(ctx.calls.indexOf('blend:lighter'));
});

it('stays silent for confetti too under reduced motion', () => {
  motion.matches = true;
  fx.confetti(50, 100, 100);
  expect(fx.count).toBe(0);
});

it('stays dark in a high-contrast mode, whose palette cannot reach a canvas', () => {
  motion.forced = true;
  fx.press(100, 100);
  fx.confetti(20, 100, 100);
  expect(fx.count).toBe(0);
});

it('survives a frame stamped before the effect was asked for', () => {
  // rAF hands each frame the time it began; a tap can land after that.
  fx.press(100, 100);
  const due = queue;
  queue = [];
  expect(() => due.forEach((cb) => cb(clock - 16))).not.toThrow();
  run(1000);
  expect(fx.count).toBe(0);
});
