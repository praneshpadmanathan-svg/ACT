/* The one thing this file pins is that a request cannot hang forever.

   That is not a hypothetical. Every call to Supabase went out on a bare
   `fetch`, which has no default timeout, and the app's boot screen waited on
   one of them. A project that accepted a connection and then never answered —
   a free-tier instance waking from its seven-day sleep is the ordinary way to
   get there — left a promise that never settled and a person staring at a
   spinning compass with nothing to tap. */

import { describe, expect, it, vi } from 'vitest';
import { withTimeout } from './supabase';

/** A fetch that accepts the request and then says nothing, forever. */
const blackHole: typeof fetch = (_input, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(init.signal!.reason), { once: true });
  });

describe('withTimeout', () => {
  it('rejects a request that never answers', async () => {
    vi.useFakeTimers();
    try {
      const timed = withTimeout(blackHole, 20_000);
      const pending = timed('https://example.test/');
      const settled = vi.fn();
      void pending.catch(settled);

      // Still waiting a second short of the deadline: a slow network is not an
      // error, and cutting one off early is its own bug.
      await vi.advanceTimersByTimeAsync(19_000);
      expect(settled).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(2_000);
      await expect(pending).rejects.toMatchObject({ name: 'TimeoutError' });
    } finally {
      vi.useRealTimers();
    }
  });

  it("lets a caller's own abort win, with the caller's reason", async () => {
    const outer = new AbortController();
    const pending = withTimeout(blackHole, 20_000)('https://example.test/', {
      signal: outer.signal,
    });
    const reason = new DOMException('Component unmounted', 'AbortError');
    outer.abort(reason);
    await expect(pending).rejects.toBe(reason);
  });

  it('passes a normal response straight through and clears its timer', async () => {
    const base = vi.fn(async () => new Response('ok'));
    const res = await withTimeout(base as unknown as typeof fetch, 20_000)('https://example.test/');
    expect(await res.text()).toBe('ok');
    expect(base).toHaveBeenCalledOnce();
  });
});
