import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { QuestionRunner, type RunnableQuestion } from './QuestionRunner';
import { juice } from '@/lib/juice';
import { sfx } from '@/lib/sfx';

vi.mock('@/lib/juice', () => ({ juice: { correct: vi.fn(), wrong: vi.fn(), combo: vi.fn() } }));
vi.mock('@/lib/sfx', () => ({ sfx: { select: vi.fn() } }));
vi.mock('./QuestionActions', () => ({ QuestionActions: () => null }));
vi.mock('./Tools', () => ({ ToolDock: () => null }));
vi.mock('./PassagePanel', () => ({ PassagePanel: () => null }));
vi.mock('./RichText', () => ({
  RichText: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('./ui', () => ({
  Button: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  LEADING_ICON: 16,
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

it.each(['a', 'b'])('withholds sound and visual correctness for timed answer %s', (key) => {
  vi.useFakeTimers();
  const q: RunnableQuestion = {
    id: 'test-original-sum',
    prompt: 'What is 1 + 1?',
    promptFormat: 'markdown',
    choices: [
      { key: 'a', text: '2', format: 'markdown' },
      { key: 'b', text: '3', format: 'markdown' },
    ],
    correctKey: 'a',
    why: { a: 'One plus one is two.', b: 'Count one more than one.' },
    topic: 'Arithmetic',
    section: 'math',
    difficulty: 'easy',
  };
  const host = document.createElement('div');
  const root = createRoot(host);
  const finish = vi.fn();
  act(() =>
    root.render(
      <QuestionRunner
        questions={[q]}
        title="Timed practice"
        deferFeedback
        onAnswer={() => {}}
        onFinish={finish}
      />,
    ),
  );
  act(() =>
    host.querySelectorAll<HTMLButtonElement>('[role="radio"]')[key === 'a' ? 0 : 1]!.click(),
  );
  expect(sfx.select).toHaveBeenCalledOnce();
  expect(juice.correct).not.toHaveBeenCalled();
  expect(juice.wrong).not.toHaveBeenCalled();
  expect(juice.combo).not.toHaveBeenCalled();
  expect(host.querySelector('.choice-correct, .choice-wrong')).toBeNull();
  expect(host.textContent).not.toContain('in a row');
  act(() => vi.advanceTimersByTime(120));
  expect(finish).toHaveBeenCalledOnce();
  act(() => root.unmount());
});
