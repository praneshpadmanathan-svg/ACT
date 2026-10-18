import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuestionRunner, type AnswerRecord, type RunnableQuestion } from './QuestionRunner';
import { juice } from '@/lib/juice';
import { sfx } from '@/lib/sfx';
import { fx } from '@/lib/fx';
import { savedQuestions } from '@/lib/quizResume';

vi.mock('@/lib/juice', () => ({ juice: { correct: vi.fn(), wrong: vi.fn(), combo: vi.fn() } }));
vi.mock('@/lib/sfx', () => ({ sfx: { select: vi.fn() } }));
vi.mock('@/lib/fx', () => ({ fx: { correct: vi.fn(), wrong: vi.fn() } }));
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
  // No light either: a spark off the row would say "right" as plainly as a sound.
  expect(fx.correct).not.toHaveBeenCalled();
  expect(fx.wrong).not.toHaveBeenCalled();
  expect(host.querySelector('.choice-correct, .choice-wrong')).toBeNull();
  expect(host.textContent).not.toContain('in a row');
  act(() => vi.advanceTimersByTime(120));
  expect(finish).toHaveBeenCalledOnce();
  act(() => root.unmount());
});

const twoQuestions = (): RunnableQuestion[] =>
  ['q1', 'q2'].map((id) => ({
    id,
    prompt: `Prompt ${id}`,
    promptFormat: 'markdown',
    choices: [
      { key: 'a', text: 'Right', format: 'markdown' },
      { key: 'b', text: 'Wrong', format: 'markdown' },
    ],
    correctKey: 'a',
    why: { a: 'Because.', b: 'Not that.' },
    topic: 'Arithmetic',
    section: 'math',
    difficulty: 'easy',
  }));

function mountRunner(props: Partial<Parameters<typeof QuestionRunner>[0]> = {}) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const onAnswer = vi.fn();
  const onFinish = vi.fn();
  act(() =>
    root.render(
      <QuestionRunner
        questions={twoQuestions()}
        title="Drill"
        onAnswer={onAnswer}
        onFinish={onFinish}
        {...props}
      />,
    ),
  );
  const radios = () => [...host.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
  const cleanup = () => {
    act(() => root.unmount());
    host.remove();
  };
  return { host, radios, onAnswer, onFinish, cleanup };
}

it('answers once when a click and a key land before React re-renders', () => {
  const { radios, onAnswer, cleanup } = mountRunner();
  act(() => {
    // One batch: neither handler has seen the other's state yet.
    radios()[1]!.click();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    radios()[0]!.click();
  });
  expect(onAnswer).toHaveBeenCalledOnce();
  expect(onAnswer.mock.calls[0]![0].chosen).toBe('b');
  cleanup();
});

it('keeps focus on the answer just picked instead of dropping it to <body>', () => {
  const { radios, cleanup } = mountRunner();
  const picked = radios()[1]!;
  picked.focus();
  act(() => picked.click());
  expect(picked.disabled).toBe(false);
  expect(picked.getAttribute('aria-disabled')).toBe('true');
  expect(document.activeElement).toBe(picked);
  cleanup();
});

it('moves focus to the next question when the control that advanced it is gone', () => {
  vi.useFakeTimers();
  const { radios, cleanup } = mountRunner({ deferFeedback: true });
  act(() => radios()[0]!.click());
  // The runner remounts the well for the next question; the old choice is gone.
  act(() => vi.advanceTimersByTime(120));
  expect(radios()[0]!.textContent).toContain('Right');
  expect(document.activeElement).toBe(radios()[0]);
  cleanup();
});

it('does not finish a timed test that was left inside the auto-advance beat', () => {
  vi.useFakeTimers();
  const one = twoQuestions().slice(0, 1);
  const { radios, onFinish, cleanup } = mountRunner({ questions: one, deferFeedback: true });
  act(() => radios()[0]!.click());
  cleanup(); // Exit, before the 120ms advance
  vi.advanceTimersByTime(500);
  expect(onFinish).not.toHaveBeenCalled();
});

/* A refresh never unmounts anything. To stand in for one, the saved run is
   read while the first runner is still mounted — which is exactly the state
   the page is in when the browser reloads it. */
describe('a quiz that survives a refresh', () => {
  afterEach(() => sessionStorage.clear());
  const nextButton = (host: HTMLElement) =>
    [...host.querySelectorAll('button')].find((b) =>
      /next question|see results/i.test(b.textContent ?? ''),
    );

  it('lands on the explanation that was open, without answering it twice', () => {
    const first = mountRunner({ resumeKey: 'zone:z' });
    act(() => first.radios()[1]!.click());
    const second = mountRunner({ resumeKey: 'zone:z' });
    expect(second.host.textContent).toContain('Prompt q1');
    expect(second.radios()[1]!.getAttribute('aria-checked')).toBe('true');
    expect(second.host.querySelector('.choice-wrong')).not.toBeNull();
    act(() => nextButton(second.host)!.click());
    act(() => second.radios()[0]!.click());
    act(() => nextButton(second.host)!.click());
    // Only the answer given after the refresh was reported again...
    expect(second.onAnswer).toHaveBeenCalledOnce();
    // ...but the result counts both.
    const records = second.onFinish.mock.calls[0]![0];
    expect(records.map((r: AnswerRecord) => [r.question.id, r.chosen])).toEqual([
      ['q1', 'b'],
      ['q2', 'a'],
    ]);
    second.cleanup();
    first.cleanup();
  });

  it('lands on the next question if it had already moved on', () => {
    const first = mountRunner({ resumeKey: 'zone:z' });
    act(() => first.radios()[0]!.click());
    act(() => nextButton(first.host)!.click());
    const second = mountRunner({ resumeKey: 'zone:z' });
    expect(second.host.textContent).toContain('Prompt q2');
    expect(second.host.querySelector('[aria-checked="true"]')).toBeNull();
    second.cleanup();
    first.cleanup();
  });

  it('forgets the run once the quiz is left', () => {
    const first = mountRunner({ resumeKey: 'zone:z' });
    act(() => first.radios()[1]!.click());
    first.cleanup();
    const second = mountRunner({ resumeKey: 'zone:z' });
    expect(second.host.querySelector('[aria-checked="true"]')).toBeNull();
    second.cleanup();
  });

  it('takes the step a timed run was about to take when the refresh cut in', () => {
    vi.useFakeTimers();
    const first = mountRunner({ resumeKey: 'diagnostic', deferFeedback: true });
    act(() => first.radios()[1]!.click()); // refreshed inside the 120ms beat
    const second = mountRunner({ resumeKey: 'diagnostic', deferFeedback: true });
    expect(second.host.textContent).toContain('Prompt q1');
    act(() => vi.advanceTimersByTime(120));
    expect(second.host.textContent).toContain('Prompt q2');
    expect(second.onAnswer).not.toHaveBeenCalled();
    second.cleanup();
    first.cleanup();
  });

  it('finishes a timed run refreshed on its last answer, with every answer in it', () => {
    vi.useFakeTimers();
    const first = mountRunner({ resumeKey: 'diagnostic', deferFeedback: true });
    act(() => first.radios()[0]!.click());
    act(() => vi.advanceTimersByTime(120));
    act(() => first.radios()[1]!.click());
    const second = mountRunner({ resumeKey: 'diagnostic', deferFeedback: true });
    act(() => vi.advanceTimersByTime(120));
    expect(second.onFinish).toHaveBeenCalledOnce();
    const records = second.onFinish.mock.calls[0]![0];
    expect(records.map((r: AnswerRecord) => r.chosen)).toEqual(['a', 'b']);
    second.cleanup();
    first.cleanup();
  });

  it('deals a saved set back by id, and refuses one with a question gone', () => {
    const first = mountRunner({ resumeKey: 'drill:math:' });
    const all = new Map(twoQuestions().map((q) => [q.id, q]));
    expect(savedQuestions('drill:math:', (id) => all.get(id))?.map((q) => q.id)).toEqual([
      'q1',
      'q2',
    ]);
    all.delete('q2');
    expect(savedQuestions('drill:math:', (id) => all.get(id))).toBeNull();
    // A lookup that throws — its content not loaded — is no set either.
    expect(
      savedQuestions('drill:math:', () => {
        throw new Error('not loaded');
      }),
    ).toBeNull();
    first.cleanup();
  });

  it('ignores a saved run for a different set of questions', () => {
    const first = mountRunner({ resumeKey: 'zone:z' });
    act(() => first.radios()[1]!.click());
    const other = twoQuestions().reverse();
    const second = mountRunner({ resumeKey: 'zone:z', questions: other });
    expect(second.host.textContent).toContain('Prompt q2');
    expect(second.host.querySelector('[aria-checked="true"]')).toBeNull();
    second.cleanup();
    first.cleanup();
  });
});
