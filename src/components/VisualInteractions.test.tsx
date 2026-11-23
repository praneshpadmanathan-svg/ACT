import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { RankShowcase } from './RankShowcase';
import { RealmExplorer } from './RealmExplorer';

vi.mock('./RankSigil', () => ({ RankSigil: () => <span /> }));
vi.mock('./Art', () => ({ Art: () => <span /> }));
vi.mock('./ui', () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

it('lets a visitor explore every rank without writing progress', () => {
  const before = localStorage.length;
  const host = document.createElement('div');
  const root = createRoot(host);
  act(() => root.render(<RankShowcase />));
  const choices = host.querySelectorAll<HTMLButtonElement>('.rank-picker button');
  expect(choices).toHaveLength(7);
  for (const choice of choices) {
    act(() => choice.click());
    expect(choice.getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector('h3')?.textContent).toBe(choice.getAttribute('aria-label'));
  }
  expect(localStorage.length).toBe(before);
  act(() => root.unmount());
});

it('changes subject details and keeps the start action functional', () => {
  const begin = vi.fn();
  const host = document.createElement('div');
  const root = createRoot(host);
  act(() => root.render(<RealmExplorer onBegin={begin} />));
  const choices = host.querySelectorAll<HTMLButtonElement>('.realm-selector button');
  act(() => choices[1]!.click());
  expect(host.textContent).toContain('The Number Desert');
  expect(choices[1]!.getAttribute('aria-selected')).toBe('true');
  expect(host.querySelector('[role="tabpanel"]')!.getAttribute('aria-labelledby')).toBe(
    choices[1]!.id,
  );
  // The road's real landmarks, not a slogan: the first five, then how many remain.
  const stops = host.querySelectorAll('.road > li');
  expect(stops).toHaveLength(5);
  expect(stops[0]!.querySelector('.road-name')!.textContent).not.toBe('');
  expect(host.textContent).toMatch(/\d+ more after these/);
  act(() => host.querySelector<HTMLButtonElement>('.realm-copy button')!.click());
  expect(begin).toHaveBeenCalledOnce();
  act(() => root.unmount());
});

it('moves between sections with the arrow keys, as tabs do', () => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(<RealmExplorer onBegin={() => {}} />));
  const tabs = () => [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  // Only the selected tab is in the Tab order.
  expect(tabs().map((t) => t.tabIndex)).toEqual([0, -1, -1, -1]);
  const key = (k: string) =>
    act(() => {
      document.activeElement!.dispatchEvent(
        new KeyboardEvent('keydown', { key: k, bubbles: true }),
      );
    });
  tabs()[0]!.focus();
  key('ArrowRight');
  expect(tabs()[1]!.getAttribute('aria-selected')).toBe('true');
  expect(document.activeElement).toBe(tabs()[1]);
  key('ArrowLeft');
  key('ArrowLeft');
  expect(tabs()[3]!.getAttribute('aria-selected')).toBe('true');
  key('Home');
  expect(tabs()[0]!.getAttribute('aria-selected')).toBe('true');
  act(() => root.unmount());
  host.remove();
});
