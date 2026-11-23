import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { useAsyncAction } from './useAsyncAction';

/* Renders the hook into a real root and hands back its latest output, so the
   tests can call `run` the way a click handler would. */
function mount() {
  const host = document.createElement('div');
  const root = createRoot(host);
  const latest: { busy: boolean; run: ReturnType<typeof useAsyncAction>[1] } = {
    busy: false,
    run: async () => undefined,
  };
  function Probe() {
    const [busy, run] = useAsyncAction();
    latest.busy = busy;
    latest.run = run;
    return null;
  }
  act(() => root.render(<Probe />));
  return { latest, unmount: () => act(() => root.unmount()) };
}

const deferred = () => {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

it('refuses a second call made before the first settles, even within one render', async () => {
  const { latest, unmount } = mount();
  const gate = deferred();
  const work = vi.fn(() => gate.promise);
  const run = latest.run;

  let first!: Promise<unknown>;
  let second!: Promise<unknown>;
  await act(async () => {
    // Same `run`, same render: the state has not had a chance to change.
    first = run(work);
    second = run(work);
  });
  expect(work).toHaveBeenCalledOnce();
  expect(await second).toBeUndefined();
  expect(latest.busy).toBe(true);

  await act(async () => {
    gate.resolve();
    await first;
  });
  expect(latest.busy).toBe(false);
  unmount();
});

it('releases the lock and the busy flag when the action throws', async () => {
  const { latest, unmount } = mount();
  await act(async () => {
    await expect(latest.run(() => Promise.reject(new Error('offline')))).rejects.toThrow('offline');
  });
  expect(latest.busy).toBe(false);

  const work = vi.fn(async () => 'again');
  let result: unknown;
  await act(async () => {
    result = await latest.run(work);
  });
  expect(result).toBe('again');
  unmount();
});

it('still settles an action whose screen was left while it ran', async () => {
  const { latest, unmount } = mount();
  let finish!: (v: string) => void;
  let pending!: Promise<unknown>;
  await act(async () => {
    pending = latest.run(() => new Promise<string>((res) => (finish = res)));
  });
  unmount();
  finish('done');
  await expect(pending).resolves.toBe('done');
});
