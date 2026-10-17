/* Light, in one place — the particle layer behind every press and every hit.

   The juice bus (juice.ts) gives an event its *timing*: sound at contact, a
   beat, then the world answers. This gives it *light*. Gilt sparks thrown off
   the edge of a right answer, a ring of lamplight spreading from where a
   finger landed, a bloom behind a rank seal. Item 284 of docs/game-feel-plan.md
   asked for exactly this: one shared canvas, one loop, pooled objects, a hard
   budget.

   What makes it read as footage rather than as a web page doing tricks:

   Additive light. Every particle is drawn with `globalCompositeOperation =
   'lighter'`, so where two sparks cross they get brighter rather than one
   painting over the other — light adds, paint does not. It is set once per
   frame, not per particle; switching composite modes is the expensive part.

   Pre-rendered glow. `shadowBlur` per particle is the slow path in every
   browser. Each tone's glow is drawn once into a small offscreen canvas and
   stamped with `drawImage`, which is a textured quad on the GPU.

   Motion blur. A spark is drawn as a streak from where it is back along its
   own velocity, tapering to nothing — what a camera shutter records of a
   bright fast thing, and the single biggest difference between "particles"
   and "embers".

   Full resolution. The canvas backing store is the viewport times the device
   pixel ratio, so a 4K panel gets 4K sparks rather than upscaled ones.

   Time, not frames. Every velocity, drag and fade is integrated against
   elapsed milliseconds, so a 120Hz display shows the same effect as a 60Hz
   one, just smoother. Drag uses `exp(-k·dt)` so it is exact at any step.

   And the guardrails the rest of the app already keeps:
   - reduced motion: nothing here runs (the answer's own row state still says
     right or wrong; this is decoration on top of that, never the message)
   - `?juice=0` turns it off with the rest of the bus
   - the loop only runs while something is alive, and a hidden tab drops
     every particle rather than freezing them mid-air for when it returns
   - a hard cap on live particles; the oldest are recycled first */

/* ------------------------------------------------------------------ tones */

/** Light colours, as RGB triples. Lamplight and gilt — this is a world lit by
 *  one warm lamp, so even the "wrong" ember is a fire colour, not a red LED. */
export const FX_TONES = {
  gold: [255, 206, 102],
  white: [255, 244, 218],
  ember: [255, 150, 70],
  ruin: [214, 86, 58],
  jade: [132, 214, 150],
} as const;
export type FxTone = keyof typeof FX_TONES;

/* The same tones as they appear on paper, for the light theme.

   Additive light needs darkness to add to. On cream there is almost no
   headroom left — gold light summed onto it clips to pale yellow, and a
   white-hot spark is a cream speck on cream: measured, the correct-answer
   burst read as a highlighter halo. Light on a lit page shows the way gilt
   does in a manuscript, as colour rather than as brightness. So in the light
   theme the engine paints instead of adding, in deeper amber and gilt inks
   that hold their own against parchment, with coloured rather than white
   cores. */
const PAPER_TONES: Record<FxTone, readonly [number, number, number]> = {
  gold: [201, 140, 16],
  white: [222, 168, 44],
  ember: [200, 98, 22],
  ruin: [168, 52, 32],
  jade: [46, 124, 68],
};

/** Read once a frame, so a theme switch mid-session is followed at once. */
let onPaper = false;
const toneRGB = (tone: FxTone) => (onPaper ? PAPER_TONES : FX_TONES)[tone];

/* --------------------------------------------------------------- switches */

const OFF =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('juice') === '0';

let reduceQuery: MediaQueryList | null = null;
function reduced(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  reduceQuery ??= window.matchMedia('(prefers-reduced-motion: reduce)');
  return reduceQuery.matches;
}

/** Whether a call would draw anything. Callers never need this — every effect
 *  checks it — but tests and the press layer use it to skip work early. */
export function fxEnabled(): boolean {
  return !OFF && !!canvas && !reduced() && !forced();
}

/* High-contrast modes replace every colour on the page with the user's
   palette — except a canvas's pixels, which they cannot reach. Gold sparks
   thrown across someone's chosen high-contrast scheme are exactly what that
   setting exists to prevent, so the layer stays dark. */
let forcedQuery: MediaQueryList | null = null;
function forced(): boolean {
  if (typeof window.matchMedia !== 'function') return false;
  forcedQuery ??= window.matchMedia('(forced-colors: active)');
  return forcedQuery.matches;
}

/* --------------------------------------------------------------- the pool */

/* Plain constants rather than an enum: the build transpiles each file on its
   own, and a `const enum` does not survive that. */
const Kind = { Spark: 0, Ring: 1, Bloom: 2, Frame: 3, Glint: 4, Leaf: 5 } as const;
type Kind = (typeof Kind)[keyof typeof Kind];

interface P {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Per-second velocity decay constant. */
  drag: number;
  /** px/s² downward. Embers rise (negative) as often as they fall. */
  gravity: number;
  /** Elapsed and total life, ms. */
  age: number;
  life: number;
  /** Spark: head radius. Ring: final radius. Bloom: final radius.
   *  Frame: width. */
  size: number;
  /** Spark: streak length in seconds of travel. Ring: stroke width.
   *  Frame: height. (A frame keeps its corner radius in `vx`.) */
  aux: number;
  tone: FxTone;
  /** Peak opacity, 0–1. */
  alpha: number;
  /* Leaf and glint only. A recycled particle keeps whatever an earlier
     occupant left in these, so every emitter that reads them sets them. */
  /** Rotation in the plane, radians, and its rate per second. */
  rot?: number;
  spin?: number;
  /** Leaf: the tumble — rotation about its own long axis — and its rate. */
  flip?: number;
  flipRate?: number;
  /** Leaf: which pre-rendered flake. Also seeds its sideways sway. */
  variant?: number;
}

/** Hard ceiling on live particles. A rank-up is the worst case — about 230
 *  flakes of leaf and 130 points of light — and this leaves headroom for one
 *  more event on top without ever becoming a slideshow. */
export const MAX_PARTICLES = 560;

const live: P[] = [];
const spare: P[] = [];

function spawn(init: Omit<P, 'age'>): void {
  if (live.length >= MAX_PARTICLES) {
    // Recycle the oldest. Dropping the newest would lose the effect just asked for.
    const old = live.shift()!;
    spare.push(old);
  }
  const p = spare.pop() ?? ({} as P);
  Object.assign(p, init, { age: 0 });
  live.push(p);
  wake();
}

/* ------------------------------------------------------------- the canvas */

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let dpr = 1;
let width = 0;
let height = 0;

/* "4K" is a device pixel ratio of 2 on most panels that have one. Above 2 the
   extra pixels are invisible at this size of effect and cost fill rate. */
const MAX_DPR = 2;

function resize(): void {
  if (!canvas || !ctx) return;
  dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

let resizeFrame = 0;
function onResize(): void {
  if (resizeFrame) return;
  resizeFrame = requestAnimationFrame(() => {
    resizeFrame = 0;
    resize();
  });
}

function onHidden(): void {
  if (!document.hidden) return;
  // An effect nobody saw has nothing left to say; do not resume it later.
  spare.push(...live.splice(0));
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  ctx?.clearRect(0, 0, width, height);
}

/** Attach the layer. Returns the teardown. `FxCanvas` is the only caller. */
export function mountFx(el: HTMLCanvasElement): () => void {
  canvas = el;
  ctx = el.getContext('2d');
  resize();
  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onHidden);
  return () => {
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onHidden);
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    if (frame) cancelAnimationFrame(frame);
    resizeFrame = 0;
    frame = 0;
    spare.push(...live.splice(0));
    canvas = null;
    ctx = null;
  };
}

/* ------------------------------------------------------- the glow sprites */

const SPRITE_PX = 64;
const sprites = new Map<string, HTMLCanvasElement>();

/* A hot white core falling off into the tone, then into nothing. Drawn once
   per tone and stamped forever after. The core is what makes it read as a
   light source rather than a coloured blob: real highlights clip to white. */
function sprite(tone: FxTone): HTMLCanvasElement {
  const key = `${tone}:${onPaper}`;
  const cached = sprites.get(key);
  if (cached) return cached;
  const s = document.createElement('canvas');
  s.width = s.height = SPRITE_PX;
  const g = s.getContext('2d');
  if (g) {
    const [r, gr, b] = toneRGB(tone);
    const c = SPRITE_PX / 2;
    const grad = g.createRadialGradient(c, c, 0, c, c, c);
    // White-hot on a dark page; on paper, the ink's own colour at full strength.
    grad.addColorStop(0, onPaper ? `rgba(${r},${gr},${b},1)` : 'rgba(255,252,240,1)');
    grad.addColorStop(0.18, `rgba(${r},${gr},${b},0.9)`);
    grad.addColorStop(0.45, `rgba(${r},${gr},${b},0.28)`);
    grad.addColorStop(1, `rgba(${r},${gr},${b},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, SPRITE_PX, SPRITE_PX);
  }
  sprites.set(key, s);
  return s;
}

/* A four-point star: the flare a camera lens throws off a hard point of
   light. Long thin beams on the cross, short faint ones on the diagonals, a
   white core. It reads at a glance as "this caught the light" in a way a
   round glow never does, which is why it is used sparingly — a few per
   effect. */
const glints = new Map<string, HTMLCanvasElement>();
const GLINT_PX = 96;
function glint(tone: FxTone): HTMLCanvasElement {
  const key = `${tone}:${onPaper}`;
  const cached = glints.get(key);
  if (cached) return cached;
  const s = document.createElement('canvas');
  s.width = s.height = GLINT_PX;
  const g = s.getContext('2d');
  if (g) {
    const [r, gr, b] = toneRGB(tone);
    const c = GLINT_PX / 2;
    const core = onPaper ? `${r},${gr},${b}` : '255,250,235';
    g.globalCompositeOperation = onPaper ? 'source-over' : 'lighter';
    const beam = (angle: number, length: number, thickness: number, alpha: number) => {
      g.save();
      g.translate(c, c);
      g.rotate(angle);
      const grad = g.createLinearGradient(-length, 0, length, 0);
      grad.addColorStop(0, `rgba(${r},${gr},${b},0)`);
      grad.addColorStop(0.5, `rgba(${core},${alpha})`);
      grad.addColorStop(1, `rgba(${r},${gr},${b},0)`);
      g.fillStyle = grad;
      g.beginPath();
      g.ellipse(0, 0, length, thickness, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    };
    beam(0, c, 1.6, 0.95);
    beam(Math.PI / 2, c, 1.6, 0.95);
    beam(Math.PI / 4, c * 0.45, 1.1, 0.5);
    beam(-Math.PI / 4, c * 0.45, 1.1, 0.5);
    g.drawImage(sprite(tone), c - 14, c - 14, 28, 28);
  }
  glints.set(key, s);
  return s;
}

/* Gold leaf. Each flake is an irregular five-sided scrap, drawn twice: once
   in shadow and once catching the lamp, with a highlight along the edge
   nearest the light (upper left, as everywhere in the app). In flight the
   two are mixed by how squarely the flake faces the viewer, so a tumbling
   flake flashes as it turns — the whole difference between leaf and coloured
   paper. Shapes come from a fixed seed, so the set is the same every load. */
const LEAF_COLOURS: [lit: string, shade: string, edge: string][] = [
  ['#f6d777', '#9c7410', '#fff4c9'],
  ['#e8c34a', '#7d5a0c', '#fbe9a6'],
  ['#f7e6ae', '#a8894a', '#fffaf0'],
  ['#d4a017', '#6b4a06', '#f6d777'],
  ['#c98b2e', '#5e3b12', '#f2c879'],
];
const LEAF_SHAPES = 4;
/* Drawn at twice the largest on-screen size, so a flake is sharp at a device
   pixel ratio of 2. */
const LEAF_W = 32;
const LEAF_H = 20;
type LeafSprite = { lit: HTMLCanvasElement; shade: HTMLCanvasElement };
let leaves: LeafSprite[] | null = null;
function leafSprites(): LeafSprite[] {
  if (leaves) return leaves;
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const out: LeafSprite[] = [];
  for (let shape = 0; shape < LEAF_SHAPES; shape++) {
    const pts = Array.from({ length: 5 }, (_, i) => {
      const a = (i / 5) * Math.PI * 2 + rnd() * 0.5;
      const k = 0.7 + rnd() * 0.3;
      return [
        LEAF_W / 2 + Math.cos(a) * (LEAF_W / 2 - 1) * k,
        LEAF_H / 2 + Math.sin(a) * (LEAF_H / 2 - 1) * k,
      ] as const;
    });
    for (const [lit, shade, edge] of LEAF_COLOURS) {
      const draw = (fill: string, rim: string | null) => {
        const c = document.createElement('canvas');
        c.width = LEAF_W;
        c.height = LEAF_H;
        const g = c.getContext('2d');
        if (g) {
          g.beginPath();
          pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
          g.closePath();
          g.fillStyle = fill;
          g.fill();
          if (rim) {
            g.save();
            g.clip();
            g.strokeStyle = rim;
            g.lineWidth = 3;
            g.translate(-1.5, -1.5);
            g.stroke();
            g.restore();
          }
        }
        return c;
      };
      out.push({ lit: draw(lit, edge), shade: draw(shade, null) });
    }
  }
  leaves = out;
  return out;
}

const rgba = (tone: FxTone, a: number) => {
  const [r, g, b] = toneRGB(tone);
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
};

/* --------------------------------------------------------------- the loop */

let frame = 0;
let last = 0;

function wake(): void {
  if (frame || !ctx) return;
  last = performance.now();
  frame = requestAnimationFrame(tick);
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;

/* One flake: falling against air, swaying, spinning and tumbling. The sway is
   what sells it — leaf does not fall, it drifts down side to side. */
function drawLeaf(g: CanvasRenderingContext2D, p: P, s: number): void {
  const k = Math.exp(-p.drag * s);
  p.vx *= k;
  p.vy = p.vy * k + p.gravity * s;
  const sway = Math.sin(p.age * 0.0042 + (p.variant ?? 0)) * 46;
  p.x += (p.vx + sway) * s;
  p.y += p.vy * s;
  p.rot = (p.rot ?? 0) + (p.spin ?? 0) * s;
  p.flip = (p.flip ?? 0) + (p.flipRate ?? 0) * s;

  const set = leafSprites();
  const art = set[(p.variant ?? 0) % set.length]!;
  // Never quite edge-on to nothing: a flake seen side-on is still a sliver.
  const facing = Math.max(0.12, Math.abs(Math.cos(p.flip)));
  const t = p.age / p.life;
  const fade = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
  const w = p.size;
  const h = (p.size * LEAF_H) / LEAF_W;

  g.save();
  g.translate(p.x, p.y);
  g.rotate(p.rot);
  g.scale(1, facing);
  g.globalAlpha = fade;
  g.drawImage(art.shade, -w / 2, -h / 2, w, h);
  // Lit in proportion to how squarely it faces the lamp: the flash as it turns.
  g.globalAlpha = fade * facing ** 1.5;
  g.drawImage(art.lit, -w / 2, -h / 2, w, h);
  g.restore();
  g.globalAlpha = 1;
}

function tick(now: number): void {
  frame = 0;
  const g = ctx;
  if (!g) return;
  /* Clamped, so a frame that arrives late — a GC pause, a busy main thread —
     advances the effect by at most two frames' worth instead of teleporting
     every spark to where it would have been. */
  const dt = Math.min(now - last, 34);
  last = now;
  const s = dt / 1000;

  g.clearRect(0, 0, width, height);

  /* Matter first, then light. Leaf is a thing in the world and is painted
     normally; everything else is light and is added on top of it, so a spark
     passing in front of a flake brightens it rather than hiding behind it.
     Two composite switches a frame, never one per particle. */
  g.globalCompositeOperation = 'source-over';
  for (let i = live.length - 1; i >= 0; i--) {
    const p = live[i]!;
    if (p.kind !== Kind.Leaf) continue;
    p.age += dt;
    if (p.age >= p.life || p.y > height + 30) {
      live.splice(i, 1);
      spare.push(p);
      continue;
    }
    drawLeaf(g, p, s);
  }

  onPaper = document.documentElement.dataset.theme === 'light';
  g.globalCompositeOperation = onPaper ? 'source-over' : 'lighter';
  g.lineCap = 'round';

  for (let i = live.length - 1; i >= 0; i--) {
    const p = live[i]!;
    if (p.kind === Kind.Leaf) continue;
    p.age += dt;
    if (p.age >= p.life) {
      live.splice(i, 1);
      spare.push(p);
      continue;
    }
    const t = p.age / p.life;

    if (p.kind === Kind.Glint) {
      /* A twinkle: up and gone on a sine, turning slowly as it does — the
         flare of something catching the light once as it moves. */
      p.x += p.vx * s;
      p.y += p.vy * s;
      p.rot = (p.rot ?? 0) + (p.spin ?? 0) * s;
      const pulse = Math.sin(Math.PI * t);
      const d = p.size * (0.35 + 0.65 * pulse);
      g.globalAlpha = p.alpha * pulse;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.drawImage(glint(p.tone), -d / 2, -d / 2, d, d);
      g.restore();
      g.globalAlpha = 1;
    } else if (p.kind === Kind.Spark) {
      const k = Math.exp(-p.drag * s);
      p.vx *= k;
      p.vy = p.vy * k + p.gravity * s;
      p.x += p.vx * s;
      p.y += p.vy * s;

      // Bright on arrival, a long tail of cooling — fire, not a light switch.
      const a = p.alpha * (1 - t) ** 1.6;
      const r = p.size * (1 - t * 0.55);
      /* The streak: where the spark was `aux` seconds ago, along its own
         path. Tapered by drawing it twice — the whole tail faint and thin,
         the half nearest the head brighter and wider — which reads as a
         falloff without allocating a gradient per spark per frame. Additive
         blending sums the overlap into the hot end. */
      const tx = p.x - p.vx * p.aux;
      const ty = p.y - p.vy * p.aux;
      g.strokeStyle = rgba(p.tone, a * 0.32);
      g.lineWidth = r * 0.7;
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.lineTo(tx, ty);
      g.stroke();
      g.strokeStyle = rgba(p.tone, a * 0.7);
      g.lineWidth = r * 1.15;
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.lineTo((p.x + tx) / 2, (p.y + ty) / 2);
      g.stroke();

      g.globalAlpha = a;
      const d = r * 11;
      g.drawImage(sprite(p.tone), p.x - d / 2, p.y - d / 2, d, d);
      g.globalAlpha = 1;
    } else if (p.kind === Kind.Ring) {
      // A shockwave: fast out, slow to fade, thinning as it spreads.
      const e = easeOut(t);
      const radius = 4 + (p.size - 4) * e;
      const a = p.alpha * (1 - t) ** 2;
      const w = p.aux * (1 - e * 0.7);
      // Two passes: a wide soft halo, then the crisp bright line inside it.
      g.strokeStyle = rgba(p.tone, a * 0.35);
      g.lineWidth = w * 3.2;
      g.beginPath();
      g.arc(p.x, p.y, radius, 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = rgba(p.tone, a);
      g.lineWidth = w;
      g.stroke();
    } else if (p.kind === Kind.Frame) {
      /* The card's own edge catching fire: its outline drawn in light, which
         flares and drifts a few pixels outward as it fades — the afterimage a
         bright edge leaves. Three passes, wide to narrow, is the bloom. */
      const e = easeOut(t);
      const grow = 1 + e * 7;
      const a = p.alpha * (1 - t) ** 1.8;
      const x = p.x - grow;
      const y = p.y - grow;
      const w = p.size + grow * 2;
      const h = p.aux + grow * 2;
      const radius = p.vx + grow;
      for (const [width, k] of [
        [14, 0.12],
        [6, 0.3],
        [1.6, 1],
      ] as const) {
        g.strokeStyle = rgba(p.tone, a * k);
        g.lineWidth = width;
        g.beginPath();
        if (g.roundRect) g.roundRect(x, y, w, h, radius);
        else g.rect(x, y, w, h);
        g.stroke();
      }
    } else {
      // Bloom: a light that swells and is gone.
      const e = easeOut(Math.min(1, t * 1.6));
      const d = p.size * 2 * (0.4 + 0.6 * e);
      // On paper a wash of ink across the card muddies it; keep it a tint.
      g.globalAlpha = p.alpha * (onPaper ? 0.45 : 1) * (1 - t) ** 1.4;
      g.drawImage(sprite(p.tone), p.x - d / 2, p.y - d / 2, d, d);
      g.globalAlpha = 1;
    }
  }

  g.globalCompositeOperation = 'source-over';
  if (live.length) frame = requestAnimationFrame(tick);
  else g.clearRect(0, 0, width, height);
}

/* -------------------------------------------------------------- emitters */

const rand = (a: number, b: number) => a + Math.random() * (b - a);

interface SparkOpts {
  tone?: FxTone;
  count?: number;
  /** px/s at launch. */
  speed?: [number, number];
  /** Direction in radians and its spread; omit for all the way round. */
  angle?: number;
  spread?: number;
  gravity?: number;
  life?: [number, number];
  size?: [number, number];
}

function sparks(x: number, y: number, o: SparkOpts = {}): void {
  const {
    tone = 'gold',
    count = 10,
    speed = [180, 460],
    angle,
    spread = Math.PI * 2,
    gravity = 380,
    life = [380, 720],
    size = [1.1, 2.2],
  } = o;
  for (let i = 0; i < count; i++) {
    const a = angle === undefined ? Math.random() * Math.PI * 2 : angle + rand(-spread, spread) / 2;
    const v = rand(speed[0], speed[1]);
    spawn({
      kind: Kind.Spark,
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      drag: rand(3.2, 5),
      gravity,
      life: rand(life[0], life[1]),
      size: rand(size[0], size[1]),
      aux: rand(0.03, 0.055),
      tone: Math.random() < 0.22 ? 'white' : tone,
      alpha: rand(0.75, 1),
    });
  }
}

function twinkle(x: number, y: number, tone: FxTone, size: number, life = 620, alpha = 1) {
  spawn({
    kind: Kind.Glint,
    x,
    y,
    vx: rand(-14, 14),
    vy: rand(-36, -10),
    drag: 0,
    gravity: 0,
    life,
    size,
    aux: 0,
    tone,
    alpha,
    rot: rand(-0.4, 0.4),
    spin: rand(-0.9, 0.9),
  });
}

function ring(
  x: number,
  y: number,
  tone: FxTone,
  radius: number,
  width = 2,
  life = 520,
  alpha = 0.8,
) {
  spawn({
    kind: Kind.Ring,
    x,
    y,
    vx: 0,
    vy: 0,
    drag: 0,
    gravity: 0,
    life,
    size: radius,
    aux: width,
    tone,
    alpha,
  });
}

function bloom(x: number, y: number, tone: FxTone, radius: number, life = 420, alpha = 0.55) {
  spawn({
    kind: Kind.Bloom,
    x,
    y,
    vx: 0,
    vy: 0,
    drag: 0,
    gravity: 0,
    life,
    size: radius,
    aux: 0,
    tone,
    alpha,
  });
}

function edge(r: DOMRect, radius: number, tone: FxTone, life = 640, alpha = 0.9) {
  spawn({
    kind: Kind.Frame,
    x: r.left,
    y: r.top,
    vx: radius,
    vy: 0,
    drag: 0,
    gravity: 0,
    life,
    size: r.width,
    aux: r.height,
    tone,
    alpha,
  });
}

/** The corner radius an element is drawn with, so its light matches its shape. */
function radiusOf(el: Element): number {
  const v = parseFloat(getComputedStyle(el).borderTopLeftRadius);
  return Number.isFinite(v) ? v : 8;
}

/** A point along a rectangle's perimeter, and the outward normal there. */
function onEdge(r: DOMRect): { x: number; y: number; nx: number; ny: number } {
  const per = 2 * (r.width + r.height);
  let d = Math.random() * per;
  if (d < r.width) return { x: r.left + d, y: r.top, nx: 0, ny: -1 };
  d -= r.width;
  if (d < r.height) return { x: r.right, y: r.top + d, nx: 1, ny: 0 };
  d -= r.height;
  if (d < r.width) return { x: r.right - d, y: r.bottom, nx: 0, ny: 1 };
  d -= r.width;
  return { x: r.left, y: r.bottom - d, nx: -1, ny: 0 };
}

/* Measure on the next frame, not now. Effects are fired from the same handler
   that changes state, and the answer that earned them usually moves when it
   does: explanations open above it, the card grows. Measured inside the click,
   the light landed where the row *was* — eighty pixels off on the landing
   page's sample question. By the next frame React has committed and layout
   is final. Also skips an element that left the page in the meantime. */
function whenLaidOut(el: Element, fn: (r: DOMRect) => void): void {
  requestAnimationFrame(() => {
    if (!el.isConnected) return;
    const r = el.getBoundingClientRect();
    if (onScreen(r)) fn(r);
  });
}

const centre = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
const onScreen = (r: DOMRect) =>
  r.width > 0 && r.bottom > 0 && r.right > 0 && r.top < height && r.left < width;

/* ---------------------------------------------------------------- presets

   What callers use. Like the juice presets, the numbers live here so that a
   press feels the same on every surface and tuning it is one edit. */

export const fx = {
  /** A finger or a cursor landing on something that matters: a ring of light
   *  from the exact point of contact and a few motes thrown off it. Small —
   *  this fires on every primary press in the app. */
  press(x: number, y: number, tone: FxTone = 'gold'): void {
    if (!fxEnabled()) return;
    ring(x, y, tone, 46, 1.6, 420, 0.55);
    bloom(x, y, tone, 34, 260, 0.35);
    sparks(x, y, {
      tone,
      count: 5,
      speed: [90, 220],
      gravity: -60,
      life: [260, 420],
      size: [0.8, 1.4],
    });
  },

  /** A right answer, lit along its own edge. Gilt sparks lift off the card's
   *  rim, outward, and drift up like heat — the reward stays on the row that
   *  earned it. `tier` is the streak tier, 0–3; each step is more of the same,
   *  never a different effect. */
  correct(el: Element | null, tier = 0): void {
    if (!fxEnabled() || !el) return;
    whenLaidOut(el, (r) => {
      edge(r, radiusOf(el), 'gold', 620 + tier * 80, 0.85);
      /* Density by length of edge, not a fixed count: twenty sparks round a
       phone-width card is a shower, round a desktop-width one it is a few
       stray dots. */
      const n = Math.min(70, Math.round((2 * (r.width + r.height)) / 55) + tier * 10);
      for (let i = 0; i < n; i++) {
        const e = onEdge(r);
        sparks(e.x, e.y, {
          tone: tier >= 3 ? 'ember' : 'gold',
          count: 1,
          angle: Math.atan2(e.ny, e.nx) - (e.ny === 0 ? 0.35 : 0),
          spread: 1.2,
          speed: [70, 210 + tier * 40],
          gravity: -150,
          life: [560, 980],
          size: [1.2, 2.4],
        });
      }
      // A few points along the edge catch the lamp outright.
      for (let i = 0; i < 2 + tier; i++) {
        const e = onEdge(r);
        twinkle(e.x, e.y, 'gold', rand(30, 46 + tier * 6), rand(520, 760), 0.9);
      }
      const c = centre(r);
      bloom(c.x, c.y, 'gold', Math.max(r.width, r.height) * 0.55, 520, 0.22 + tier * 0.05);
      if (tier >= 2) ring(c.x, c.y, 'gold', Math.max(r.width, r.height) * 0.7, 2, 600, 0.35);
    });
  },

  /** A wrong answer. A brief fizzle from the row — a struck match that does
   *  not catch. Deliberately quieter than `correct`, for the same reason the
   *  juice bus keeps wrong answers quiet. */
  wrong(el: Element | null): void {
    if (!fxEnabled() || !el) return;
    whenLaidOut(el, (r) => {
      // The edge flickers ember once and goes out — no afterglow, no drift.
      edge(r, radiusOf(el), 'ruin', 300, 0.5);
      for (let i = 0; i < 10; i++) {
        const e = onEdge(r);
        sparks(e.x, e.y, {
          tone: 'ruin',
          count: 1,
          angle: Math.atan2(e.ny, e.nx),
          spread: 1.4,
          speed: [50, 140],
          gravity: 260,
          life: [260, 460],
          size: [0.9, 1.5],
        });
      }
    });
  },

  /** An impact on something — a blow landing on a guardian. */
  impact(el: Element | null, tone: FxTone = 'gold', power = 1): void {
    if (!fxEnabled() || !el) return;
    whenLaidOut(el, (r) => {
      const c = centre(r);
      const size = Math.min(r.width, r.height);
      ring(c.x, c.y, tone, size * 0.75 * power, 3, 560);
      ring(c.x, c.y, 'white', size * 0.45 * power, 1.4, 380, 0.6);
      bloom(c.x, c.y, tone, size * 0.6, 380, 0.5 * power);
      sparks(c.x, c.y, { tone, count: Math.round(22 * power), speed: [220, 620], gravity: 520 });
      if (tone !== 'ruin') twinkle(c.x, c.y, 'white', size * 0.7 * power, 420);
    });
  },

  /** The big one: a rank earned. A layered shockwave, a column of light and
   *  a slow fountain of embers from the centre of the screen. */
  celebrate(x = width / 2, y = height / 2): void {
    if (!fxEnabled()) return;
    const big = Math.min(width, height);
    bloom(x, y, 'gold', big * 0.45, 900, 0.5);
    ring(x, y, 'gold', big * 0.5, 3, 900, 0.9);
    ring(x, y, 'white', big * 0.32, 1.6, 640, 0.7);
    window.setTimeout(() => ring(x, y, 'gold', big * 0.68, 2, 1100, 0.45), 140);
    twinkle(x, y, 'white', big * 0.5, 700);
    for (let i = 0; i < 9; i++) {
      const a = rand(0, Math.PI * 2);
      const d = rand(big * 0.12, big * 0.42);
      twinkle(
        x + Math.cos(a) * d,
        y + Math.sin(a) * d,
        'gold',
        rand(28, 56),
        rand(600, 1100),
        0.85,
      );
    }
    sparks(x, y, { count: 70, speed: [260, 820], gravity: 300, life: [700, 1300], size: [1, 2.4] });
    sparks(x, y, {
      count: 40,
      tone: 'ember',
      angle: -Math.PI / 2,
      spread: 1.6,
      speed: [120, 380],
      gravity: -40,
      life: [900, 1600],
      size: [0.8, 1.6],
    });
  },

  /** Gold leaf thrown up from a point, tumbling down through the air.
   *  `spread` keeps the old confetti's meaning — wider throws wider — so
   *  every existing `burstConfetti` call carries over unchanged. */
  confetti(count: number, x = width / 2, y = height / 2, spread = 18): void {
    if (!fxEnabled()) return;
    const kinds = leafSprites().length;
    for (let i = 0; i < count; i++) {
      spawn({
        kind: Kind.Leaf,
        x,
        y,
        vx: rand(-0.5, 0.5) * spread * 60,
        vy: -rand(240, 840),
        drag: rand(1.1, 1.8),
        gravity: rand(520, 760),
        life: rand(1600, 2600),
        size: rand(8, 15),
        aux: 0,
        tone: 'gold',
        alpha: 1,
        rot: rand(0, Math.PI * 2),
        spin: rand(-4, 4),
        flip: rand(0, Math.PI * 2),
        flipRate: rand(5, 11) * (Math.random() < 0.5 ? -1 : 1),
        variant: Math.floor(rand(0, kinds)),
      });
    }
  },

  /** Live particle count, for tests and the budget. */
  get count(): number {
    return live.length;
  },
};
