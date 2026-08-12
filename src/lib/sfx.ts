/* Sound design, synthesised at runtime.

   No audio files ship with the app — everything here is built from
   oscillators, filtered noise and a generated impulse response. That keeps
   the payload at zero bytes and sidesteps sample licensing entirely, but the
   goal is still a *designed* sound rather than a beep: every cue has a real
   envelope, a filter, and a send to a small room reverb so it sits in a
   space instead of on top of the page.

   The palette is wood, felt, brass and strings — the same world as the
   artwork. Nothing here is a square wave at full volume. */

import { readRaw, STORAGE_KEYS, writeRaw } from './storage';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let reverbSend: GainNode | null = null;

let muted = readRaw(STORAGE_KEYS.muted) === '1';
const mutedListeners = new Set<(m: boolean) => void>();

/* ------------------------------------------------------------------ setup */

/** A short, warm room. Exponentially decaying noise makes a serviceable IR. */
function buildImpulse(audio: AudioContext, seconds = 1.6, decay = 3.2): AudioBuffer {
  const rate = audio.sampleRate;
  const length = Math.floor(rate * seconds);
  const impulse = audio.createBuffer(2, length, rate);

  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      // Slight stereo decorrelation so the tail is not dead-centre.
      const jitter = channel === 0 ? 1 : 0.92;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay) * jitter;
    }
  }
  return impulse;
}

function audioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }

    master = ctx.createGain();
    master.gain.value = 0.9;

    // Keeps the loudest cues from clipping once reverb is added on top.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 12;
    limiter.ratio.value = 6;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.18;

    const convolver = ctx.createConvolver();
    convolver.buffer = buildImpulse(ctx);

    reverbSend = ctx.createGain();
    reverbSend.gain.value = 0.22;

    reverbSend.connect(convolver);
    convolver.connect(master);
    master.connect(limiter);
    limiter.connect(ctx.destination);
  }

  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Route a source through the dry path and the reverb send. */
function connect(node: AudioNode, wet = 1): void {
  if (master) node.connect(master);
  if (reverbSend && wet > 0) {
    const send = ctx!.createGain();
    send.gain.value = wet;
    node.connect(send);
    send.connect(reverbSend);
  }
}

/* ------------------------------------------------------------ generators */

interface VoiceOpts {
  freq: number;
  /** Seconds. */
  attack?: number;
  decay?: number;
  type?: OscillatorType;
  gain?: number;
  at?: number;
  /** Glide to this frequency across the decay. */
  glideTo?: number;
  /** Low-pass cutoff; omit for none. */
  cutoff?: number;
  wet?: number;
  detune?: number;
}

/** One pitched voice with a percussive envelope. */
function voice({
  freq,
  attack = 0.004,
  decay = 0.4,
  type = 'sine',
  gain = 0.2,
  at = 0,
  glideTo,
  cutoff,
  wet = 0.35,
  detune = 0,
}: VoiceOpts): void {
  const a = audioCtx();
  if (!a || muted) return;

  const t = a.currentTime + at;
  const osc = a.createOscillator();
  const env = a.createGain();

  osc.type = type;
  osc.detune.value = detune;
  osc.frequency.setValueAtTime(freq, t);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), t + decay);

  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);

  let tail: AudioNode = env;
  osc.connect(env);

  if (cutoff) {
    const filter = a.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, t);
    filter.Q.value = 0.7;
    env.connect(filter);
    tail = filter;
  }

  connect(tail, wet);
  osc.start(t);
  osc.stop(t + attack + decay + 0.05);
}

interface NoiseOpts {
  decay?: number;
  gain?: number;
  at?: number;
  type?: BiquadFilterType;
  freq?: number;
  q?: number;
  wet?: number;
}

/** Filtered noise burst — the body of clicks, thuds and paper. */
function noise({
  decay = 0.09,
  gain = 0.18,
  at = 0,
  type = 'bandpass',
  freq = 1800,
  q = 1.2,
  wet = 0.25,
}: NoiseOpts): void {
  const a = audioCtx();
  if (!a || muted) return;

  const t = a.currentTime + at;
  const frames = Math.max(1, Math.floor(a.sampleRate * decay));
  const buffer = a.createBuffer(1, frames, a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

  const src = a.createBufferSource();
  src.buffer = buffer;

  const filter = a.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(freq, t);
  filter.Q.value = q;

  const env = a.createGain();
  env.gain.setValueAtTime(gain, t);
  env.gain.exponentialRampToValueAtTime(0.0001, t + decay);

  src.connect(filter);
  filter.connect(env);
  connect(env, wet);

  src.start(t);
  src.stop(t + decay + 0.02);
}

/** A struck mallet: sine fundamental plus a bright, fast partial. */
function mallet(freq: number, at = 0, gain = 0.22, wet = 0.4): void {
  voice({ freq, decay: 0.5, gain, at, type: 'sine', cutoff: 5200, wet });
  voice({ freq: freq * 2.01, decay: 0.14, gain: gain * 0.34, at, type: 'sine', wet });
  voice({ freq: freq * 5.4, decay: 0.06, gain: gain * 0.1, at, type: 'sine', wet });
}

/** Plucked string, for shimmer runs. */
function pluck(freq: number, at = 0, gain = 0.14): void {
  voice({ freq, decay: 0.7, gain, at, type: 'triangle', cutoff: 3600, wet: 0.5 });
  voice({
    freq: freq * 1.005,
    decay: 0.7,
    gain: gain * 0.6,
    at,
    type: 'triangle',
    cutoff: 3200,
    wet: 0.5,
    detune: 6,
  });
}

/* --------------------------------------------------------------- the cues */

/* A pentatonic set, so overlapping cues never clash.
   `as const` makes it a six-long tuple rather than `number[]`, which is what
   lets every `PENTA[2]` below stay a number under `noUncheckedIndexedAccess`
   instead of needing a non-null assertion at each of the twenty call sites. */
const PENTA = [523.25, 587.33, 698.46, 783.99, 932.33, 1046.5] as const;

export const sfx = {
  /** Wooden latch — navigation, buttons, pin taps. */
  select: () => {
    noise({ decay: 0.035, gain: 0.1, type: 'bandpass', freq: 2400, q: 2.4, wet: 0.12 });
    voice({ freq: 320, decay: 0.05, gain: 0.07, type: 'triangle', cutoff: 1800, wet: 0.12 });
  },

  /** Softer version for hovers and minor toggles. */
  tick: () => noise({ decay: 0.02, gain: 0.05, freq: 3200, q: 3, wet: 0.08 }),

  /** Correct answer — mallet plus a rising shimmer. */
  correct: () => {
    mallet(PENTA[2], 0, 0.2);
    pluck(PENTA[4], 0.07, 0.1);
    pluck(PENTA[5], 0.13, 0.07);
  },

  /** Wrong — felt thud, no sting. Being wrong should not feel punishing. */
  wrong: () => {
    voice({ freq: 190, decay: 0.3, gain: 0.16, type: 'sine', glideTo: 120, cutoff: 700, wet: 0.2 });
    noise({ decay: 0.11, gain: 0.07, type: 'lowpass', freq: 520, wet: 0.15 });
  },

  /** Rising run as a streak builds. */
  combo: (n: number) => {
    const step = PENTA[Math.min(n - 1, PENTA.length - 1)] ?? PENTA[0];
    pluck(step, 0, 0.11);
    pluck(step * 2, 0.05, 0.05);
  },

  /** Achievement — bright bell pair. */
  achieve: () => {
    mallet(PENTA[3], 0, 0.2, 0.5);
    mallet(PENTA[5], 0.11, 0.16, 0.55);
  },

  /** Rank up — layered brass-ish swell with a chord. */
  fanfare: () => {
    // Note and entry time together, rather than two arrays kept in step.
    (
      [
        [PENTA[0], 0],
        [PENTA[1], 0.13],
        [PENTA[2], 0.26],
      ] as const
    ).forEach(([note, at]) => {
      voice({
        freq: note,
        decay: 0.55,
        gain: 0.16,
        type: 'sawtooth',
        cutoff: 2400,
        at,
        wet: 0.5,
      });
      voice({
        freq: note / 2,
        decay: 0.6,
        gain: 0.1,
        type: 'triangle',
        cutoff: 1400,
        at,
        wet: 0.4,
      });
    });
    // final chord
    [PENTA[2], PENTA[4], PENTA[5], PENTA[5] * 1.5].forEach((f, i) =>
      voice({
        freq: f,
        decay: 1.5,
        gain: 0.12,
        type: 'triangle',
        cutoff: 4200,
        at: 0.42 + i * 0.015,
        wet: 0.65,
      }),
    );
    mallet(PENTA[5] * 2, 0.46, 0.12, 0.7);
  },

  /** A footfall on a dirt road. Fired twice a second while the traveller is
   *  crossing the map, so it has to be quiet enough to live under everything
   *  else and varied enough not to become a metronome — three layers, all
   *  jittered together off one factor so the pitch of the thud and the grit
   *  move as one boot rather than three unrelated sounds.
   *
   *  Almost no reverb send. A step happens at your feet; the long tail the
   *  bells and the fanfare use would put it across the room. */
  step: () => {
    const j = 0.86 + Math.random() * 0.28;
    noise({ decay: 0.055 * j, gain: 0.05, type: 'lowpass', freq: 430 * j, wet: 0.08 });
    noise({ decay: 0.028, gain: 0.02, type: 'bandpass', freq: 2600 * j, q: 1.6, wet: 0.06 });
    voice({ freq: 96 * j, decay: 0.07, gain: 0.04, type: 'sine', cutoff: 300, wet: 0.08 });
  },

  /** Page turn — used when a lesson or passage opens. */
  page: () => {
    noise({ decay: 0.16, gain: 0.075, type: 'highpass', freq: 1600, wet: 0.18 });
    noise({ decay: 0.09, gain: 0.05, type: 'bandpass', freq: 3400, q: 0.8, at: 0.07, wet: 0.15 });
  },

  /** Locked pin — a dull iron rattle, clearly a "no". */
  locked: () => {
    noise({ decay: 0.07, gain: 0.09, type: 'bandpass', freq: 900, q: 3.5, wet: 0.2 });
    noise({ decay: 0.05, gain: 0.06, type: 'bandpass', freq: 640, q: 4, at: 0.06, wet: 0.2 });
    voice({ freq: 150, decay: 0.12, gain: 0.06, type: 'square', cutoff: 400, wet: 0.15 });
  },

  /** Zone cleared — a short, warm resolve. */
  cleared: () => {
    mallet(PENTA[2], 0, 0.19, 0.5);
    mallet(PENTA[4], 0.1, 0.17, 0.55);
    [PENTA[2], PENTA[4], PENTA[5]].forEach((f, i) =>
      voice({
        freq: f,
        decay: 1.1,
        gain: 0.1,
        type: 'triangle',
        cutoff: 3800,
        at: 0.2 + i * 0.02,
        wet: 0.6,
      }),
    );
  },

  /** Timer warning — two soft, low knocks. */
  warn: () => {
    voice({ freq: 440, decay: 0.18, gain: 0.12, type: 'sine', cutoff: 1600, wet: 0.3 });
    voice({ freq: 330, decay: 0.24, gain: 0.12, type: 'sine', cutoff: 1400, at: 0.19, wet: 0.3 });
  },
};

/* --------------------------------------------------------------- controls */

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

/* Browsers refuse to start an AudioContext before a gesture, so prime it on
   the first one. Building the reverb IR here too keeps the first real cue
   from stuttering. */
if (typeof window !== 'undefined') {
  const prime = () => audioCtx();
  window.addEventListener('pointerdown', prime, { once: true });
  window.addEventListener('keydown', prime, { once: true });
}
