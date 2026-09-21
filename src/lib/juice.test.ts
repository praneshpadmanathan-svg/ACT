import { afterEach, expect, it, vi } from 'vitest';
import { juice, registerStage } from './juice';

vi.mock('./sfx', () => ({ sfx: { correct: vi.fn(), combo: vi.fn(), wrong: vi.fn() } }));

afterEach(() => {
  registerStage(null);
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('never shakes the stage for a correct answer or any streak tier', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  const frame = vi.fn(() => 1);
  vi.stubGlobal('requestAnimationFrame', frame);
  const create = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = create(tag);
    el.animate = vi.fn();
    return el;
  });
  const stage = document.createElement('div');
  registerStage(stage);
  juice.correct();
  for (const n of [2, 3, 6, 10, 100]) juice.combo(n);
  await vi.runAllTimersAsync();
  expect(frame).not.toHaveBeenCalled();
  expect(stage.style.transform).toBe('');
});
