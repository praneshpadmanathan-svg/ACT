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

it('lets a visitor explore every rank and replay without writing progress', () => {
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
  act(() => host.querySelector<HTMLButtonElement>('.rank-replay')!.click());
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
  expect(choices[1]!.getAttribute('aria-pressed')).toBe('true');
  act(() => host.querySelector<HTMLButtonElement>('.realm-copy button')!.click());
  expect(begin).toHaveBeenCalledOnce();
  act(() => root.unmount());
});
