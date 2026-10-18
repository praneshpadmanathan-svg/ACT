import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PATH_BY_ID } from '@/content';
import type { Question } from '@/types';
import { BossScreen } from './Boss';

const store = {
  progress: { achievements: [] as string[], zonesCleared: {} as Record<string, number> },
  answerQuestion: vi.fn(),
  defeatBoss: vi.fn(),
};
vi.mock('@/lib/store', () => ({ useStore: () => store }));
vi.mock('@/lib/router', () => ({ useNavigate: () => vi.fn() }));
vi.mock('@/lib/sfx', () => ({
  sfx: new Proxy({}, { get: () => () => {} }),
}));
vi.mock('@/components/Feedback', () => ({ burstConfetti: () => {} }));
vi.mock('@/components/Shell', () => ({
  Page: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  BackLink: () => null,
}));
vi.mock('@/components/RichText', () => ({
  RichText: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('@/components/PassagePanel', () => ({ PassagePanel: () => null }));
vi.mock('@/game/BossArt', () => ({ BossArt: () => null }));
vi.mock('@/game/HeroSprite', () => ({ HeroSprite: () => null }));
/* One heart each, so a single answer ends the fight either way. */
vi.mock('@/game/bosses', async (actual) => {
  const real = await actual<typeof import('@/game/bosses')>();
  return {
    ...real,
    bossFor: (s: Parameters<typeof real.bossFor>[0]) => {
      const boss = real.bossFor(s);
      return boss && { ...boss, health: 1, playerHealth: 1 };
    },
  };
});
vi.mock('@/content', async (actual) => {
  const real = await actual<typeof import('@/content')>();
  const question = (id: string): Question => ({
    id,
    section: 'math',
    topic: 'Arithmetic',
    difficulty: 'hard',
    context: `Prompt ${id}`,
    choices: [
      { id: 'A', text: 'Right' },
      { id: 'B', text: 'Wrong' },
    ],
    answer: 'A',
    why: { A: 'Because.', B: 'Not that.' },
  });
  return { ...real, useContent: () => {}, questionsFor: () => [question('q1'), question('q2')] };
});
/* jsdom has no matchMedia, and the motion library asks it about reduced motion. */
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
})) as unknown as typeof window.matchMedia;

// The guardian only fights once every landmark in its region is cleared.
beforeEach(() => {
  for (const node of PATH_BY_ID.math!.nodes) store.progress.zonesCleared[node.id] = 1;
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  document.body.innerHTML = '';
});

const button = (host: HTMLElement, text: string) =>
  [...host.querySelectorAll('button')].find((b) => b.textContent?.includes(text));

it('cannot be fought on after the killing blow, so a win is never overwritten by a loss', () => {
  vi.useFakeTimers();
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(<BossScreen section="math" />));
  act(() => button(host, 'Draw your blade')!.click());

  const choices = () => [...host.querySelectorAll<HTMLButtonElement>('button.choice')];
  const right = choices().find((c) => c.textContent?.includes('Right'))!;
  act(() => right.click());
  expect(store.answerQuestion).toHaveBeenCalledOnce();
  // Recorded with the blow, not after the flourish a player might walk out of.
  expect(store.defeatBoss).toHaveBeenCalledOnce();

  // The flourish before the result screen: press on, and answer wrong at one heart.
  const onward = button(host, 'Press the attack')!;
  expect(onward.disabled).toBe(true);
  act(() => onward.click());
  const wrong = choices().find((c) => c.textContent?.includes('Wrong'))!;
  act(() => wrong.click());
  expect(store.answerQuestion).toHaveBeenCalledOnce();

  act(() => vi.advanceTimersByTime(2000));
  expect(host.textContent).toContain('falls');
  expect(host.textContent).not.toContain('You retreat');
  act(() => root.unmount());
});

it('drops its pending beats when the screen is left mid-blow', () => {
  vi.useFakeTimers();
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(<BossScreen section="math" />));
  act(() => button(host, 'Draw your blade')!.click());
  const wrong = [...host.querySelectorAll<HTMLButtonElement>('button.choice')].find((c) =>
    c.textContent?.includes('Wrong'),
  )!;
  act(() => wrong.click());
  act(() => root.unmount());
  expect(vi.getTimerCount()).toBe(0);
});
