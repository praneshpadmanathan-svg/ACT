import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DISMISS_GRACE_MS, LevelUpOverlay } from './Feedback';

const dismissLevelUp = vi.fn();
vi.mock('@/lib/store', () => ({ useStore: () => ({ levelUpRank: 1, dismissLevelUp }) }));
vi.mock('@/lib/sfx', () => ({ sfx: { select: vi.fn() } }));

/* jsdom has no matchMedia, and the motion library asks it about reduced motion. */
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia;

const roots: Root[] = [];
let now = 1000;
beforeEach(() => {
  now = 1000;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
});
afterEach(() => {
  roots.splice(0).forEach((root) => act(() => root.unmount()));
  vi.restoreAllMocks();
  dismissLevelUp.mockClear();
  document.body.innerHTML = '';
});

function show() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  roots.push(root);
  act(() => root.render(<LevelUpOverlay />));
  return host.querySelector<HTMLElement>('[role="dialog"]')!;
}

it('ignores the rest of the double-click that opened it', () => {
  const overlay = show();
  now += 80;
  act(() => overlay.click());
  expect(dismissLevelUp).not.toHaveBeenCalled();

  now += DISMISS_GRACE_MS;
  act(() => overlay.click());
  expect(dismissLevelUp).toHaveBeenCalledOnce();
});

it('ignores a held key repeating, and dismisses once on a fresh press', () => {
  show();
  now += DISMISS_GRACE_MS + 1;
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', repeat: true }));
  });
  expect(dismissLevelUp).not.toHaveBeenCalled();
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
  });
  expect(dismissLevelUp).toHaveBeenCalledOnce();
});

it('dismisses once from "Onward", not again from the backdrop behind it', () => {
  const overlay = show();
  now += DISMISS_GRACE_MS + 1;
  const onward = [...overlay.querySelectorAll('button')].find((b) =>
    b.textContent?.includes('Onward'),
  )!;
  act(() => onward.click());
  expect(dismissLevelUp).toHaveBeenCalledOnce();
});
