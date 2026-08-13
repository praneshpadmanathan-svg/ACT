/* The living part of a rank badge: a particle field behind the art.
 *
 * A badge is the one image in this app a student is told they *earned*, and a
 * static PNG says "asset" rather than "trophy". So each rank gets a field
 * whose behaviour is drawn from what the emblem actually is — Quillbearer's
 * quill is on fire, so embers come off it and rise; Proofbreaker just broke a
 * slate, so stone chips fly and fall; Doubtbane is a sword driven into stone,
 * so it throws sparks.
 *
 * Everything here is simulated rather than keyframed, because keyframes are
 * what makes this kind of effect look cheap: a looped animation reads as a
 * loop within about two cycles, and the eye is very good at spotting the seam.
 * Five things do most of the work of making it read as real, and none of them
 * are expensive:
 *
 * 1. **Integration is against elapsed time, not frames.** A 120Hz laptop and a
 *    60Hz phone see the same motion at the same speed. Frame-indexed physics
 *    is the single most common reason an effect that looked right in
 *    development runs at double speed on someone else's machine.
 * 2. **Sparks cool.** Colour is a function of remaining life along a blackbody
 *    ramp — white, straw, orange, deep red, out. A spark that stays one colour
 *    and fades its alpha reads as a dot; a spark that changes hue as it falls
 *    reads as a hot thing getting colder, which is what it is.
 * 3. **Drag, then gravity.** Real sparks decelerate hard and immediately —
 *    they have almost no mass and a lot of surface — so they fan out fast, stall,
 *    and then fall nearly straight down. Gravity alone gives you fireworks;
 *    drag is what makes it a grinding wheel.
 * 4. **Motion blur is free.** Each particle is drawn as a short segment from
 *    where it was to where it is, so fast ones streak and slow ones are points,
 *    with no per-frame cost beyond a line instead of an arc.
 * 5. **Everything is jittered.** Speed, angle, lifetime, size and flicker are
 *    all drawn per particle. Uniform particles are the other half of why an
 *    effect looks synthetic.
 *
 * Cost control: one canvas and one rAF per mounted aura, a fixed pool with no
 * allocation in the loop, and the loop stops entirely when the tab is hidden
 * or the element scrolls out of view. Auras are opt-in by size — see
 * `RankSigil` — so the seven badges in the rank list stay plain images.
 */

import { useEffect, useRef } from 'react';
import { useReducedMotion } from '@/lib/motion';

/* ------------------------------------------------------------------ colour */

type Stop = readonly [number, number, number];

/** Sample a ramp at t (0 = first stop, 1 = last), interpolating in RGB.
 *  Fine here: every ramp below is already dense enough that the shortcut of
 *  not going through a perceptual space is invisible. */
function ramp(stops: readonly Stop[], t: number): Stop {
  const x = Math.max(0, Math.min(0.9999, t)) * (stops.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const a = stops[i]!;
  const b = stops[i + 1] ?? a;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

/** Iron cooling: white-hot, straw, orange, cherry, out. */
const IRON: readonly Stop[] = [
  [255, 250, 238],
  [255, 226, 150],
  [255, 150, 60],
  [214, 66, 24],
  [110, 20, 8],
];

/** Wood flame — never reaches white, and dies brown rather than red. */
const FLAME: readonly Stop[] = [
  [255, 244, 206],
  [255, 198, 84],
  [244, 126, 30],
  [160, 48, 14],
];

const CRYSTAL: readonly Stop[] = [
  [226, 255, 252],
  [120, 240, 226],
  [28, 148, 171],
];

const GOLD: readonly Stop[] = [
  [255, 253, 232],
  [255, 224, 122],
  [255, 150, 60],
];

const INK: readonly Stop[] = [
  [92, 54, 28],
  [46, 26, 14],
  [26, 15, 9],
];

const PAPER: readonly Stop[] = [
  [255, 255, 255],
  [216, 226, 240],
  [150, 166, 190],
];

/* -------------------------------------------------------------------- spec */

type Draw = 'streak' | 'dot' | 'chip' | 'drop';

interface Spec {
  /** Particles born per second. */
  rate: number;
  /** Hard pool ceiling. Reached only if rate × life exceeds it. */
  max: number;
  /** Seconds. */
  life: [number, number];
  /** Emission point in badge-box coordinates, 0-1, before jitter. */
  from: [number, number];
  /** Radius of the jitter disc around `from`, in box widths. */
  spread: number;
  /** Emission direction and its half-width, radians. 0 is up. */
  dir: number;
  arc: number;
  /** Initial speed, in box widths per second. */
  speed: [number, number];
  /** Box widths per second squared. Positive is down. */
  gravity: number;
  /** Fraction of velocity kept per second. 0.02 is heavy air, 0.9 is none. */
  drag: number;
  /** Sideways drift amplitude and rate — convection, not wind. */
  swirl: number;
  /** Radius, in box widths. */
  size: [number, number];
  colors: readonly Stop[];
  draw: Draw;
  /** Additive for anything that emits light; normal for anything that
   *  blocks it. An ink droplet lit by adding to what is behind it would
   *  glow, which is the opposite of ink. */
  additive: boolean;
  /** 0 = steady, 1 = violent. Applied to alpha per frame. */
  flicker: number;
  /** Length of the motion-blur streak, as a fraction of a second of travel. */
  trail: number;
  /** Lightning arcs per second across the badge, 0 for none. */
  arcs?: number;
}

/* Tuned per emblem rather than per palette: the numbers describe the physical
   event the badge is a picture of, and the colours follow from that. */
const SPECS: Record<string, Spec> = {
  /* A cracked pot with ink running out of it. The humblest rank gets the
     quietest field on purpose — the escalation has to be visible standing
     still, and rank one having a spectacle would flatten it. */
  inkling: {
    rate: 4,
    max: 14,
    life: [1.1, 2.0],
    from: [0.62, 0.36],
    spread: 0.04,
    dir: Math.PI,
    arc: 0.25,
    speed: [0.02, 0.09],
    gravity: 0.55,
    drag: 0.55,
    swirl: 0.01,
    size: [0.012, 0.026],
    colors: INK,
    draw: 'drop',
    additive: false,
    flicker: 0,
    trail: 0.05,
  },

  /* Torn page-flecks caught in the draught of someone walking. Sideways, slow,
     tumbling, and unlit — paper is the one thing in the set that is only ever
     reflecting the room. */
  pagewalker: {
    rate: 7,
    max: 20,
    life: [1.8, 3.2],
    from: [0.5, 0.5],
    spread: 0.42,
    dir: -Math.PI / 2,
    arc: 0.55,
    speed: [0.06, 0.16],
    gravity: 0.06,
    drag: 0.75,
    swirl: 0.09,
    size: [0.014, 0.03],
    colors: PAPER,
    draw: 'chip',
    additive: false,
    flicker: 0.12,
    trail: 0.02,
  },

  /* Embers off the burning quill. Emitted from the flame in the art's upper
     right, rising, with real convective wander — a fire's particles do not
     travel straight up, they wobble, and that wobble is most of what makes a
     fire look like a fire. */
  quillbearer: {
    rate: 26,
    max: 60,
    life: [0.7, 1.5],
    from: [0.66, 0.2],
    spread: 0.05,
    dir: 0,
    arc: 0.5,
    speed: [0.14, 0.4],
    gravity: -0.28, // hot air rises; the buoyancy *is* the gravity here
    drag: 0.32,
    swirl: 0.34,
    size: [0.008, 0.019],
    colors: FLAME,
    draw: 'streak',
    additive: true,
    flicker: 0.55,
    trail: 0.09,
  },

  /* Crystal motes. Not thrown by anything — they hang and drift and twinkle,
     which is the one field in the set that should feel *kept* rather than
     thrown off, because the rank is about holding on to what you learned. */
  lorewarden: {
    rate: 9,
    max: 26,
    life: [1.6, 3.0],
    from: [0.5, 0.5],
    spread: 0.4,
    dir: 0,
    arc: Math.PI,
    speed: [0.01, 0.06],
    gravity: -0.03,
    drag: 0.6,
    swirl: 0.06,
    size: [0.008, 0.022],
    colors: CRYSTAL,
    draw: 'dot',
    additive: true,
    flicker: 0.42,
    trail: 0.01,
  },

  /* Stone chips off the slate. Fast, heavy, unlit, and thrown in an upward
     cone that matches the shards already drawn in the emblem, so the still art
     and the live art are the same event a fraction of a second apart. */
  proofbreaker: {
    rate: 13,
    max: 34,
    life: [0.9, 1.7],
    from: [0.5, 0.46],
    spread: 0.16,
    dir: 0,
    arc: 1.15,
    speed: [0.42, 0.95],
    gravity: 1.5,
    drag: 0.78,
    swirl: 0,
    size: [0.012, 0.032],
    colors: [
      [226, 214, 255],
      [168, 138, 238],
      [92, 64, 150],
    ],
    draw: 'chip',
    additive: false,
    flicker: 0,
    trail: 0.03,
  },

  /* Sparks off steel. The one the brief asked for by name, and the one with
     the most specific physics in the file: struck-metal sparks leave fast in
     a wide fan, lose almost all of it to drag within a third of a second, and
     then fall. They also cool visibly on the way down, which is why this uses
     the iron ramp rather than the flame one — a spark goes white before it
     goes orange, and a flame never does. */
  doubtbane: {
    rate: 34,
    max: 80,
    life: [0.45, 1.15],
    from: [0.5, 0.44],
    spread: 0.1,
    dir: 0,
    arc: Math.PI, // a full fan; struck sparks go everywhere, including down
    speed: [0.7, 1.9],
    gravity: 1.7,
    drag: 0.06, // heavy: nearly all initial speed is gone within ~0.3s
    swirl: 0.04,
    size: [0.006, 0.015],
    colors: IRON,
    draw: 'streak',
    additive: true,
    flicker: 0.7,
    trail: 0.13,
  },

  /* Gold motes off the crown, and lightning across it. The arcs are the reason
     this rank looks different in kind rather than degree: every other field is
     a steady emission, and this one has events. */
  sagecrown: {
    rate: 20,
    max: 52,
    life: [0.8, 1.9],
    from: [0.5, 0.4],
    spread: 0.3,
    dir: 0,
    arc: 1.5,
    speed: [0.1, 0.42],
    gravity: -0.16,
    drag: 0.36,
    swirl: 0.22,
    size: [0.007, 0.018],
    colors: GOLD,
    draw: 'streak',
    additive: true,
    flicker: 0.6,
    trail: 0.08,
    arcs: 1.6,
  },
};

/** Whether this rank has a field at all. Used by `RankSigil` so it can skip
 *  mounting a canvas it would only immediately tear down. */
export function hasAura(id: string): boolean {
  return id in SPECS;
}

/* ------------------------------------------------------------------ engine */

interface P {
  alive: boolean;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  rot: number;
  vrot: number;
  seed: number;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function RankAura({ rankId, size }: { rankId: string; size: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const spec = SPECS[rankId];
    const canvas = ref.current;
    if (!spec || !canvas || reduced) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    /* The field is drawn on a canvas wider than the badge so particles can
       leave the emblem and still be somewhere. Everything in `spec` is in
       badge widths, so the conversion happens once, here. */
    const pad = 0.5;
    const box = Math.round(size * (1 + pad * 2));
    const unit = size; // one "box width" in device-independent pixels
    const ox = box / 2;
    const oy = box / 2;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(box * dpr);
    canvas.height = Math.round(box * dpr);
    canvas.style.width = `${box}px`;
    canvas.style.height = `${box}px`;
    ctx.scale(dpr, dpr);

    const pool: P[] = Array.from({ length: spec.max }, () => ({
      alive: false,
      x: 0,
      y: 0,
      px: 0,
      py: 0,
      vx: 0,
      vy: 0,
      age: 0,
      life: 1,
      size: 1,
      rot: 0,
      vrot: 0,
      seed: 0,
    }));

    const spawn = (p: P) => {
      const a = rand(-spec.spread, spec.spread) * unit;
      const b = rand(-spec.spread, spec.spread) * unit;
      // `from` is in badge coordinates; the badge sits centred in the canvas.
      p.x = ox + (spec.from[0] - 0.5) * unit + a;
      p.y = oy + (spec.from[1] - 0.5) * unit + b;
      p.px = p.x;
      p.py = p.y;
      /* `dir` measures from straight up, and canvas y grows downward, hence
         the negative cosine. Getting this backwards is how you end up with a
         fire that pours. */
      const th = spec.dir + rand(-spec.arc, spec.arc);
      const sp = rand(spec.speed[0], spec.speed[1]) * unit;
      p.vx = Math.sin(th) * sp;
      p.vy = -Math.cos(th) * sp;
      p.age = 0;
      p.life = rand(spec.life[0], spec.life[1]);
      p.size = rand(spec.size[0], spec.size[1]) * unit;
      p.rot = Math.random() * Math.PI * 2;
      p.vrot = rand(-4, 4);
      p.seed = Math.random() * 1000;
      p.alive = true;
    };

    /* Lightning: a jagged path between two points on the badge rim, held for a
       few frames. Stored as a flat list of coordinates rather than objects
       because it is rebuilt from scratch on every strike. */
    let arcPts: number[] = [];
    let arcUntil = 0;
    let nextArc = 0;

    const strike = (now: number) => {
      const a0 = rand(-2.6, -0.5);
      const a1 = a0 + rand(1.2, 2.6);
      const r = unit * 0.46;
      let x = ox + Math.cos(a0) * r;
      let y = oy + Math.sin(a0) * r;
      const tx = ox + Math.cos(a1) * r;
      const ty = oy + Math.sin(a1) * r;
      const steps = 7;
      arcPts = [x, y];
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        // Perpendicular jitter, largest in the middle of the span — a bolt is
        // pinned at both ends and free everywhere else.
        const w = Math.sin(t * Math.PI) * unit * 0.16;
        x = ox + (tx - ox) * t + rand(-w, w);
        y = oy + (ty - oy) * t + rand(-w, w);
        arcPts.push(x, y);
      }
      arcUntil = now + rand(60, 130);
      nextArc = now + rand(400, 1400) / (spec.arcs ?? 1);
    };

    let raf = 0;
    let last = performance.now();
    let debt = 0; // fractional particles owed, carried between frames
    let running = true;

    const frame = (now: number) => {
      if (!running) return;
      raf = requestAnimationFrame(frame);

      /* Clamped. A backgrounded tab, a long GC pause or a breakpoint hands you
         a multi-second dt, and integrating it in one step teleports every
         particle off the canvas — the effect visibly "resets" the moment you
         come back to the tab, which is worse than dropping the time. */
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      ctx.clearRect(0, 0, box, box);

      debt += spec.rate * dt;
      while (debt >= 1) {
        debt -= 1;
        const free = pool.find((p) => !p.alive);
        if (free) spawn(free);
      }

      ctx.globalCompositeOperation = spec.additive ? 'lighter' : 'source-over';
      ctx.lineCap = 'round';

      for (const p of pool) {
        if (!p.alive) continue;
        p.age += dt;
        if (p.age >= p.life) {
          p.alive = false;
          continue;
        }

        p.px = p.x;
        p.py = p.y;

        if (spec.swirl) {
          // Two incommensurable frequencies, so the wander never repeats.
          p.vx +=
            (Math.sin(p.seed + p.age * 5.3) + Math.sin(p.seed * 1.7 + p.age * 2.1) * 0.6) *
            spec.swirl *
            unit *
            dt;
        }
        p.vy += spec.gravity * unit * dt;

        /* Drag as a fraction retained *per second*, converted to this frame's
           share. Multiplying by a constant per frame instead would make the
           whole effect frame-rate dependent — the bug this file's header
           warns about, and the easiest one to reintroduce. */
        const keep = Math.pow(spec.drag, dt);
        p.vx *= keep;
        p.vy *= keep;

        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vrot * dt;

        const t = p.age / p.life;
        const [r, g, b] = ramp(spec.colors, t);

        /* Alpha: quick attack so nothing pops into existence at full strength,
           then a curve that holds and drops away rather than fading linearly —
           linear fade is the other tell of a synthetic particle. */
        let alpha = Math.min(1, p.age / 0.06) * (1 - t) * (1 - t * 0.4);
        if (spec.flicker) alpha *= 1 - Math.random() * spec.flicker;

        const color = `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${alpha.toFixed(3)})`;

        switch (spec.draw) {
          case 'streak': {
            const tx = p.x - p.vx * spec.trail;
            const ty = p.y - p.vy * spec.trail;
            ctx.strokeStyle = color;
            ctx.lineWidth = p.size * (1 - t * 0.5);
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            break;
          }
          case 'dot': {
            /* A hard dot with a soft halo. The halo is what stops additive
               particles reading as confetti — light spills. */
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 0.45, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${(alpha * 0.18).toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 1.9, 0, Math.PI * 2);
            ctx.fill();
            break;
          }
          case 'chip': {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.fillStyle = color;
            // Foreshortened as it tumbles, so a flat chip reads as flat.
            ctx.fillRect(
              -p.size / 2,
              -p.size / 2,
              p.size,
              p.size * Math.abs(Math.cos(p.rot * 1.3)) * 0.8 + p.size * 0.2,
            );
            ctx.restore();
            break;
          }
          case 'drop': {
            /* A falling droplet stretches along its own velocity. */
            const sp = Math.hypot(p.vx, p.vy);
            const st = 1 + Math.min(sp / (unit * 0.6), 2.2);
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(Math.atan2(p.vy, p.vx) - Math.PI / 2);
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.ellipse(0, 0, p.size * 0.5, p.size * 0.5 * st, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            break;
          }
        }
      }

      if (spec.arcs) {
        if (now >= nextArc) strike(now);
        if (now < arcUntil && arcPts.length >= 4) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.lineJoin = 'round';
          // Wide dim pass then a narrow bright one: a core inside a glow is
          // what separates lightning from a drawn zigzag.
          for (const [w, a] of [
            [unit * 0.05, 0.16],
            [unit * 0.016, 0.55],
            [unit * 0.005, 0.95],
          ] as const) {
            ctx.strokeStyle = `rgba(255, 245, 200, ${a})`;
            ctx.lineWidth = w;
            ctx.beginPath();
            ctx.moveTo(arcPts[0]!, arcPts[1]!);
            for (let i = 2; i < arcPts.length; i += 2) ctx.lineTo(arcPts[i]!, arcPts[i + 1]!);
            ctx.stroke();
          }
        }
      }
    };

    /* Off-screen and hidden tabs cost nothing. Without this, a rank list left
       open in a background tab keeps a rAF alive on someone's phone. */
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };
    const start = () => {
      if (running && raf) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVisibility);

    const io = new IntersectionObserver(([e]) => (e?.isIntersecting ? start() : stop()), {
      threshold: 0,
    });
    io.observe(canvas);

    raf = requestAnimationFrame(frame);

    return () => {
      stop();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [rankId, size, reduced]);

  if (!(rankId in SPECS) || reduced) return null;

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-1/2"
      style={{ transform: 'translate(-50%, -50%)' }}
    />
  );
}
