import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { RealmScene } from './RealmScene';

let root: Root;
let container: HTMLDivElement;
let notify: (visible: boolean) => void;
const disconnect = vi.fn();

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        notify = (visible) =>
          callback(
            [{ isIntersecting: visible } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver,
          );
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  disconnect.mockClear();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const mount = () =>
  act(() =>
    root.render(
      <RealmScene>
        <button>Continue</button>
      </RealmScene>,
    ),
  );
const active = () => container.querySelector('section')?.dataset.active;

describe('RealmScene animation lifecycle', () => {
  it('pauses outside the viewport without removing content, then resumes', () => {
    mount();
    act(() => notify(false));
    expect(active()).toBe('false');
    expect(container.querySelector('button')?.textContent).toBe('Continue');
    act(() => notify(true));
    expect(active()).toBe('true');
  });
  it('does not resume an offscreen scene when the tab becomes visible', () => {
    mount();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(active()).toBe('false');
    act(() => notify(false));
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(active()).toBe('false');
    act(() => notify(true));
    expect(active()).toBe('true');
  });
  it('works without IntersectionObserver and disconnects observers on removal', () => {
    mount();
    act(() => root.render(null));
    expect(disconnect).toHaveBeenCalledOnce();
    vi.stubGlobal('IntersectionObserver', undefined);
    mount();
    expect(active()).toBe('true');
    expect(container.querySelector('button')).not.toBeNull();
  });
});
