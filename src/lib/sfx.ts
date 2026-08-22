/* Sound design, synthesised at runtime.

   No audio files ship with the app — everything here is built from
   oscillators, filtered noise and a generated impulse response. That keeps
   the payload at zero bytes and sidesteps sample licensing entirely, but the
   goal is still a *designed* sound rather than a beep: every cue has a real
   envelope, a filter, and a send to a small room reverb so it sits in a
   space instead of on top of the page.

   The palette is wood, felt, brass and strings — the same world as the
   artwork. Nothing here is a square wave at full volume.

   It reads its age off three things, and all three used to be set wrong.

   Register. Every pitched cue in the app came out of one octave, C5 to C6.
   That is the top half of a toy xylophone, and nothing underneath it — no cue
   had a fundamental low enough to have any weight. The set now sits an octave
   down, D4 to D5, which still clears a phone speaker's low rolloff while
   reading as an adult instrument rather than a child's one.

   Interval. It was a major pentatonic: sweet, fully consonant, no tension
   available anywhere. It is now the minor pentatonic on the same root, which
   is the sound of the artwork rather than the sound of a nursery.

   Timbre — the loudest of the three. The mallet layered a sine at 2.01x and
   5.4x the fundamental. Those are near enough to harmonics to fuse into one
   bright ringing tone with no strike in it, which is a glockenspiel, and a
   glockenspiel is the single most children's-television instrument there is.
   Struck wood is inharmonic instead: a marimba bar is undercut to put its
   overtones at 4x and 9.2x, far enough from harmonic that the ear hears a bar
   being hit rather than a bell being rung. Adding the contact noise back
   matters as much as the ratios do — a strike with no transient is a synth
   tone, and every real mallet makes a click before it makes a note. */

import { readRaw, STORAGE_KEYS, writeRaw } from './storage';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let reverbSend: GainNode | null = null;

let muted = readRaw(STORAGE_KEYS.muted) === '1';
const mutedListeners = new Set<(m: boolean) => void>();

/* ------------------------------------------------------------------ setup */

/** A short, warm room. Exponentially decaying noise makes a serviceable IR.

    1.6 seconds was not a room, it was a hall, and its tail was full-spectrum
    white noise — so every cue trailed off in a bright wash that took longer to
    die than the cue itself lasted. That shimmer was doing as much of the
    twinkle as the bell partials were. It is 1.05s now, and the noise is rolled
    off before it decays, so the tail is felt rather than heard. */
function buildImpulse(audio: AudioContext, seconds = 1.05, decay = 3.8): AudioBuffer {
  const rate = audio.sampleRate;
  const length = Math.floor(rate * seconds);
  const impulse = audio.createBuffer(2, length, rate);

  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    // One-pole low-pass over the noise, about 2kHz at a 48k rate. Filtering
    // costs roughly two thirds of the amplitude, hence the makeup gain.
    let lp = 0;
    for (let i = 0; i < length; i++) {
      // Slight stereo decorrelation so the tail is not dead-centre.
      const jitter = channel === 0 ? 1 : 0.92;
      lp += (Math.random() * 2 - 1 - lp) * 0.26;
      data[i] = lp * 2.7 * Math.pow(1 - i / length, decay) * jitter;
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

/** A struck wooden bar: contact noise, fundamental, two inharmonic partials.

    4x and 9.2x are a marimba's, and they are the whole difference between wood
    and a bell — see the note at the top of the file. They are also short: on a
    real bar the overtones die in a fraction of the time the fundamental takes,
    which is why the strike is bright and the note that follows is not. */
function mallet(freq: number, at = 0, gain = 0.22, wet = 0.4): void {
  // The click of contact, before any of it is pitched.
  noise({
    decay: 0.014,
    gain: gain * 0.2,
    at,
    type: 'bandpass',
    freq: freq * 6,
    q: 1.1,
    wet: wet * 0.25,
  });
  voice({ freq, decay: 0.42, gain, at, type: 'sine', cutoff: 2600, wet });
  voice({ freq: freq * 4, decay: 0.1, gain: gain * 0.16, at, type: 'sine', wet: wet * 0.6 });
  voice({ freq: freq * 9.2, decay: 0.035, gain: gain * 0.05, at, type: 'sine', wet: wet * 0.4 });
}

/** Plucked string, for shimmer runs. */
function pluck(freq: number, at = 0, gain = 0.14): void {
  voice({ freq, decay: 0.7, gain, at, type: 'triangle', cutoff: 2400, wet: 0.42 });
  voice({
    freq: freq * 1.005,
    decay: 0.7,
    gain: gain * 0.6,
    at,
    type: 'triangle',
    cutoff: 2200,
    wet: 0.42,
    detune: 6,
  });
}

/* --------------------------------------------------------------- the cues */

/* A pentatonic set, so overlapping cues never clash.

   D minor pentatonic — D F G A C — from D4 to D5. The old set was the major
   pentatonic an octave above this one, which is the register and the interval
   that made the whole app sound like it was for eight-year-olds; the reasoning
   is at the top of the file. Six entries either way, so every index below
   still means what it meant.

   Not lower than this, however serious low sounds are: a phone speaker gives
   up somewhere around 500Hz, and a cue whose fundamental is under it survives
   only through its overtones. D4 keeps the strike audible on the hardware this
   is actually played on while the pitch still reads as an adult instrument.

   `as const` makes it a six-long tuple rather than `number[]`, which is what
   lets every `PENTA[2]` below stay a number under `noUncheckedIndexedAccess`
   instead of needing a non-null assertion at each of the twenty call sites. */
const PENTA = [293.66, 349.23, 392.0, 440.0, 523.25, 587.33] as const;

export const sfx = {
  /** Wooden latch — navigation, buttons, pin taps. */
  select: () => {
    noise({ decay: 0.035, gain: 0.1, type: 'bandpass', freq: 1900, q: 2.4, wet: 0.12 });
    voice({ freq: 320, decay: 0.05, gain: 0.07, type: 'triangle', cutoff: 1800, wet: 0.12 });
  },

  /** Softer version for hovers and minor toggles. */
  tick: () => noise({ decay: 0.02, gain: 0.05, freq: 2600, q: 3, wet: 0.08 }),

  /** Correct answer — a struck bar and one note above it.

      Was a mallet and a three-note run climbing to the top of the set. A rising
      run is the "well done!" gesture itself, and at the old register it arrived
      as a sparkle; two notes a fifth apart land as confirmation instead, which
      is what this cue is for. It also fires on nearly every interaction in the
      app, so it is the one that wears out fastest and the one worth keeping
      shortest. */
  correct: () => {
    mallet(PENTA[2], 0, 0.2);
    pluck(PENTA[4], 0.075, 0.09);
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

  /** Achievement — two struck bars, an octave apart.

      An octave rather than the old sixth: bare, and deliberately not sweet. */
  achieve: () => {
    mallet(PENTA[0], 0, 0.2, 0.45);
    mallet(PENTA[0] * 2, 0.11, 0.15, 0.5);
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
        cutoff: 1500,
        at,
        wet: 0.4,
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
    /* The chord underneath, plus a bar struck on top of it. The old version
       ran to 4.2kHz with a 0.65 send and finished on a note two octaves above
       the set — a rank-up is the biggest moment in the app and it was the most
       chiming thing in it. Same shape, held down and dried out. */
    [PENTA[2], PENTA[4], PENTA[5], PENTA[5] * 1.5].forEach((f, i) =>
      voice({
        freq: f,
        decay: 1.5,
        gain: 0.12,
        type: 'triangle',
        cutoff: 2600,
        at: 0.42 + i * 0.015,
        wet: 0.45,
      }),
    );
    mallet(PENTA[2] * 2, 0.46, 0.12, 0.5);
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
        cutoff: 2400,
        at: 0.2 + i * 0.02,
        wet: 0.42,
      }),
    );
  },

  /** Timer warning — two soft, low knocks, the second lower than the first.

      Dropped a fourth from where it was. This also plays under a hard story
      beat, where it has to read as something giving way. */
  warn: () => {
    voice({ freq: 330, decay: 0.2, gain: 0.12, type: 'sine', cutoff: 1100, wet: 0.28 });
    voice({
      freq: 233.08,
      decay: 0.28,
      gain: 0.12,
      type: 'sine',
      cutoff: 950,
      at: 0.19,
      wet: 0.28,
    });
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
