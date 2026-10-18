import { beforeEach, expect, it, vi } from 'vitest';

/* A stand-in Web Audio context: every node is an inert object, and every
   buffer the module asks for is recorded, so the test can see where the
   expensive synthesis happens — inside a tap, or later in idle time. */
const buffers: number[] = [];
const node = (): Record<string, unknown> =>
  new Proxy(
    {},
    {
      get: (_t, k) =>
        k === 'connect' || k === 'start' || k === 'stop' || k === 'disconnect'
          ? () => {}
          : k.toString().match(/Value|setTarget|Ramp/)
            ? () => {}
            : {
                value: 0,
                setValueAtTime() {},
                exponentialRampToValueAtTime() {},
                linearRampToValueAtTime() {},
                setTargetAtTime() {},
              },
      set: () => true,
    },
  );
class FakeAudioContext {
  sampleRate = 48000;
  currentTime = 0;
  state = 'running';
  destination = node();
  createBuffer(_ch: number, frames: number, rate: number) {
    buffers.push(frames);
    return {
      duration: frames / rate,
      sampleRate: rate,
      getChannelData: () => new Float32Array(frames),
    };
  }
  createGain = node;
  createDynamicsCompressor = node;
  createConvolver = node;
  createBufferSource = node;
  createBiquadFilter = node;
  createOscillator = node;
  createStereoPanner = node;
  resume() {
    return Promise.resolve();
  }
}
vi.stubGlobal('AudioContext', FakeAudioContext);

const idle: (() => void)[] = [];
vi.stubGlobal('requestIdleCallback', (fn: () => void) => idle.push(fn));

const { sfx } = await import('./sfx');

beforeEach(() => {
  buffers.length = 0;
});

it('keeps the expensive synthesis out of the tap that makes the first sound', () => {
  sfx.select();
  // Nothing a second long — no reverb tail, no noise bed — inside the tap.
  expect(buffers.filter((frames) => frames >= 48000)).toEqual([]);
  // It all happens once the main thread is free.
  idle.splice(0).forEach((fn) => fn());
  expect(buffers.filter((frames) => frames >= 48000).length).toBeGreaterThan(0);
});

it('reuses one noise bed rather than making a buffer per click', () => {
  // The bed exists by now: the first test ran the idle work.
  sfx.select();
  sfx.select();
  sfx.tick();
  expect(buffers).toEqual([]);
});
