/* Chiptune SFX synthesised on the fly — no audio files to ship.

   The AudioContext is created lazily on the first user gesture, because
   browsers refuse to start one before that. */

import { readRaw, STORAGE_KEYS, writeRaw } from './storage';

let ctx: AudioContext | null = null;
let muted = readRaw(STORAGE_KEYS.muted) === '1';
const mutedListeners = new Set<(m: boolean) => void>();

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

interface ToneOpts {
  freq: number;
  duration: number;
  type?: OscillatorType;
  volume?: number;
  delay?: number;
  /** Ramp to this frequency across the note — used for the "wrong" buzz. */
  slideTo?: number;
}

function tone({ freq, duration, type = 'square', volume = 0.1, delay = 0, slideTo }: ToneOpts): void {
  const a = audio();
  if (!a || muted) return;

  const start = a.currentTime + delay;
  const osc = a.createOscillator();
  const gain = a.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);

  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(gain);
  gain.connect(a.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export const sfx = {
  select: () => tone({ freq: 520, duration: 0.05, volume: 0.06 }),
  correct: () => {
    tone({ freq: 660, duration: 0.09 });
    tone({ freq: 990, duration: 0.12, delay: 0.07 });
  },
  wrong: () => tone({ freq: 200, duration: 0.22, type: 'sawtooth', volume: 0.08, slideTo: 95 }),
  combo: (n: number) => tone({ freq: 440 + Math.min(n, 12) * 55, duration: 0.08, volume: 0.08 }),
  achieve: () => {
    tone({ freq: 880, duration: 0.1 });
    tone({ freq: 1175, duration: 0.18, delay: 0.09 });
  },
  fanfare: () => {
    [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, duration: 0.16, volume: 0.11, delay: i * 0.13 }));
    tone({ freq: 1319, duration: 0.5, type: 'triangle', volume: 0.12, delay: 0.55 });
    tone({ freq: 1047, duration: 0.5, type: 'triangle', volume: 0.09, delay: 0.55 });
    tone({ freq: 2093, duration: 0.35, type: 'sine', volume: 0.05, delay: 0.62 });
  },
  tick: () => tone({ freq: 1200, duration: 0.03, volume: 0.04, type: 'sine' }),
  warn: () => {
    tone({ freq: 440, duration: 0.12, volume: 0.09 });
    tone({ freq: 330, duration: 0.16, volume: 0.09, delay: 0.14 });
  },
};

export function isMuted(): boolean {
  return muted;
}

export function toggleMuted(): boolean {
  muted = !muted;
  writeRaw(STORAGE_KEYS.muted, muted ? '1' : '0');
  mutedListeners.forEach((l) => l(muted));
  if (!muted) sfx.select();
  return muted;
}

export function onMutedChange(fn: (m: boolean) => void): () => void {
  mutedListeners.add(fn);
  return () => mutedListeners.delete(fn);
}

/** Prime the AudioContext on the first gesture so later cues aren't dropped. */
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', () => audio(), { once: true });
  window.addEventListener('keydown', () => audio(), { once: true });
}
