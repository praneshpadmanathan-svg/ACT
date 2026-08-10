/* What this exists to protect.
 *
 * `NearViewport` withholds the landing page's most important section until the
 * reader is heading towards it, which means every one of its exit conditions is
 * a way for that section to never appear. The behaviour is also close to
 * untestable in a browser: `IntersectionObserver` delivers nothing in a hidden
 * or throttled tab, and both browser surfaces available here render exactly
 * that way — the observer path could not be exercised live at all. So the
 * component's wiring is pinned against a stub instead: the stub is the only
 * part that is fake, and everything the component actually decides is real.
 *
 * jsdom has no `IntersectionObserver` of its own, which is why the
 * no-observer-at-all case has to be set up by deleting the stub rather than by
 * doing nothing.
 */

import { act, StrictMode, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FALLBACK_MOUNT_MS, NearViewport } from './NearViewport';

/* A stand-in that hands the test the callback instead of watching layout, and
   counts `disconnect()` so the "does it stop observing" claims are checked
   rather than assumed. */
type Trigger = (isIntersecting: boolean) => void;

let triggers: Trigger[] = [];
let observed: Element[] = [];
let disconnects = 0;
let constructedWith: IntersectionObserverInit | undefined;

class StubObserver {
  constructor(cb: IntersectionObserverCallback, init?: IntersectionObserverInit) {
    constructedWith = init;
    triggers.push((isIntersecting) =>
      cb(
        [{ isIntersecting } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      ),
    );
  }
  observe(el: Element) {
    observed.push(el);
  }
  disconnect() {
    disconnects += 1;
  }
  unobserve() {}
  takeRecords() {
    return [];
  }
}

let container: HTMLDivElement;
let root: Root;

/** Render into a real detached DOM and flush effects. */
function mount(ui: React.ReactNode) {
  act(() => {
    root.render(ui);
  });
}

const CHILD = <p>the question</p>;
const showsChild = () => container.textContent?.includes('the question') ?? false;
const placeholder = () => container.querySelector('div > div') as HTMLElement | null;

beforeEach(() => {
  triggers = [];
  observed = [];
  disconnects = 0;
  constructedWith = undefined;
  vi.stubGlobal('IntersectionObserver', StubObserver);
  vi.useFakeTimers();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('NearViewport', () => {
  it('withholds the children until something says to show them', () => {
    mount(<NearViewport minHeight="420px">{CHILD}</NearViewport>);

    expect(showsChild()).toBe(false);
    // The space is held, so arriving content cannot shove the page around.
    expect(placeholder()?.style.minHeight).toBe('420px');
    expect(observed).toHaveLength(1);
  });

  it('mounts the children when the observer reports an intersection', () => {
    mount(<NearViewport minHeight="420px">{CHILD}</NearViewport>);

    act(() => triggers[0]!(true));

    expect(showsChild()).toBe(true);
    // The reserved height is released once real content occupies the space.
    expect(placeholder()?.style.minHeight).toBe('');
  });

  it('ignores a non-intersecting report', () => {
    mount(<NearViewport minHeight="420px">{CHILD}</NearViewport>);

    act(() => triggers[0]!(false));

    expect(showsChild()).toBe(false);
  });

  it('starts looking a screen and a half early, not at the edge', () => {
    mount(<NearViewport minHeight="420px">{CHILD}</NearViewport>);

    /* The margin is the whole difference between "the content is already there
       when you arrive" and "you arrive at a placeholder and wait." */
    expect(constructedWith?.rootMargin).toBe('150% 0px');
  });

  it('mounts anyway when the observer exists but never fires', () => {
    mount(<NearViewport minHeight="420px">{CHILD}</NearViewport>);
    expect(showsChild()).toBe(false);

    act(() => vi.advanceTimersByTime(FALLBACK_MOUNT_MS));

    /* The observed failure: an embedded view (or a throttled background tab)
       that constructs an observer and delivers no callback, ever. Without this
       backstop the section is 420px of nothing for the life of the page. */
    expect(showsChild()).toBe(true);
  });

  it('mounts immediately where there is no IntersectionObserver at all', () => {
    vi.stubGlobal('IntersectionObserver', undefined);

    mount(<NearViewport minHeight="420px">{CHILD}</NearViewport>);

    expect(showsChild()).toBe(true);
    expect(observed).toHaveLength(0);
  });

  it('stops observing and cancels the backstop once mounted', () => {
    mount(<NearViewport minHeight="420px">{CHILD}</NearViewport>);
    act(() => triggers[0]!(true));

    const after = disconnects;
    /* Advancing well past the backstop must not throw or re-render: a timer
       that outlives the mount would be setting state on a settled component. */
    act(() => vi.advanceTimersByTime(FALLBACK_MOUNT_MS * 3));

    expect(showsChild()).toBe(true);
    expect(after).toBeGreaterThan(0);
  });

  it('does not leave an observer behind when unmounted before it fires', () => {
    mount(<NearViewport minHeight="420px">{CHILD}</NearViewport>);

    act(() => root.unmount());

    expect(disconnects).toBeGreaterThan(0);
    // Re-created in afterEach's unmount call; keep the root usable.
    root = createRoot(container);
  });

  it('survives the double-invoked effects of StrictMode', () => {
    /* StrictMode mounts, unmounts and remounts every effect in development.
       An observer created in the first pass and never disconnected would leave
       a stale callback able to set state on the discarded tree. */
    mount(
      <StrictMode>
        <NearViewport minHeight="420px">{CHILD}</NearViewport>
      </StrictMode>,
    );

    // Every observer but the live one has been disconnected.
    expect(disconnects).toBe(triggers.length - 1);

    act(() => triggers[triggers.length - 1]!(true));
    expect(showsChild()).toBe(true);
  });

  it('does not re-arm the observer after the children are showing', () => {
    /* The effect depends on `near`, so it re-runs when `near` flips. If that
       re-run created a second observer the component would keep watching
       forever for a thing that has already happened. */
    function Harness() {
      const [, force] = useState(0);
      useEffect(() => {
        force(1);
      }, []);
      return <NearViewport minHeight="420px">{CHILD}</NearViewport>;
    }

    mount(<Harness />);
    const before = triggers.length;
    act(() => triggers[0]!(true));

    expect(triggers).toHaveLength(before);
  });
});
