/* Re-pick the six light-theme region fills.
 *
 * The incoming commit fixed their contrast on paper by setting all six to the
 * same lightness, which fixed one failure and created another: six colours at
 * L 44% with four hues inside a 60-degree warm arc are not tellable apart, and
 * under deuteranopia village and summit separate by 0.6.
 *
 * Hue carries a region's identity, so hue is held near its dark-theme value
 * and only lightness and chroma are free. Separation then has to come from
 * lightness, which is exactly what survives a dichromat simulation.
 *
 *   node solve-regions.mjs
 */

// --------------------------------------------------------------- colour ----
const oklchToOklab = ([L, C, h]) => [
  L,
  C * Math.cos((h * Math.PI) / 180),
  C * Math.sin((h * Math.PI) / 180),
];
const oklabToLinear = ([L, a, b]) => {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
};
const linearToOklab = ([r, g, b]) => {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};
const inGamut = (lin) => lin.every((c) => c >= -0.0015 && c <= 1.0015);
const cl = (x) => Math.min(1, Math.max(0, x));
const lum = (v) => 0.2126 * cl(v[0]) + 0.7152 * cl(v[1]) + 0.0722 * cl(v[2]);
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const HPE = [
  [17.8824, 43.5161, 4.11935],
  [3.45565, 27.1554, 3.86714],
  [0.0299566, 0.184309, 1.46709],
];
const HPEi = [
  [0.0809444479, -0.130504409, 0.116721066],
  [-0.0102485335, 0.0540193266, -0.113614708],
  [-0.000365296938, -0.00412161469, 0.693511405],
];
const SIM = {
  deuteranopia: [
    [0.625, 0.7, 0],
    [0.375, 0.3, 0],
    [0, 0, 1],
  ],
  protanopia: [
    [0.1115, 0.8354, 0],
    [0.8885, 0.1646, 0],
    [0, 0, 1],
  ],
};
const mul = (m, v) => m.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
const simulate = (lin, kind) => {
  const lms = mul(HPE, lin);
  const P = SIM[kind];
  return mul(HPEi, [
    P[0][0] * lms[0] + P[1][0] * lms[1] + P[2][0] * lms[2],
    P[0][1] * lms[0] + P[1][1] * lms[1] + P[2][1] * lms[2],
    P[0][2] * lms[0] + P[1][2] * lms[1] + P[2][2] * lms[2],
  ]);
};
const dE = (a, b) => {
  const x = linearToOklab(a);
  const y = linearToOklab(b);
  return 100 * Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};

// ---------------------------------------------------------------- setup ----
const PAPER = oklabToLinear(oklchToOklab([0.934, 0.0355, 85.41]));
const MIN_CONTRAST = 4.6; // 4.5 is the gate; take a tenth of margin

/* Hue is identity: gold village, green woods, orange desert, blue cliffs,
 * pale-gold summit, red blood. Held within 12 degrees of the dark theme. */
const REGIONS = [
  { name: 'village', h: 79.85 },
  { name: 'woods', h: 148.0 },
  { name: 'desert', h: 47.39 },
  { name: 'cliffs', h: 235.78 },
  { name: 'summit', h: 91.77 },
  { name: 'blood', h: 31.57 },
];

const linOf = (c) => oklabToLinear(oklchToOklab([c.L, c.C, c.h]));

/* Hard bounds. Without them the search walks chroma negative — which is a
 * 180-degree hue flip wearing a minus sign — and lightness to near black,
 * both of which win on separation and lose the region its identity. */
const L_MIN = 0.32;
const L_MAX = 0.6;
const C_MIN = 0.05;
const C_MAX = 0.19;
const legal = (c) => {
  if (c.L < L_MIN || c.L > L_MAX || c.C < C_MIN || c.C > C_MAX) return false;
  const lin = linOf(c);
  return inGamut(lin) && contrast(lin, PAPER) >= MIN_CONTRAST;
};

const score = (set) => {
  const lins = set.map(linOf);
  let worst = Infinity;
  for (const kind of ['normal', 'deuteranopia', 'protanopia']) {
    const v = lins.map((l) => (kind === 'normal' ? l : simulate(l, kind)));
    for (let i = 0; i < v.length; i++)
      for (let j = i + 1; j < v.length; j++) worst = Math.min(worst, dE(v[i], v[j]));
  }
  return worst;
};

const rnd = (a, b) => a + Math.random() * (b - a);

let best = null;
let bestScore = -1;
for (let restart = 0; restart < 400; restart++) {
  let set = REGIONS.map((r) => {
    let c;
    do {
      c = { name: r.name, L: rnd(L_MIN, L_MAX), C: rnd(C_MIN, C_MAX), h: r.h + rnd(-8, 8) };
    } while (!legal(c));
    return c;
  });
  let s = score(set);
  for (let step = 0; step < 4000; step++) {
    const i = Math.floor(Math.random() * set.length);
    const T = 1 - step / 4000;
    const cand = {
      ...set[i],
      L: set[i].L + rnd(-0.06, 0.06) * T,
      C: set[i].C + rnd(-0.03, 0.03) * T,
      h: REGIONS[i].h + Math.max(-8, Math.min(8, set[i].h - REGIONS[i].h + rnd(-6, 6) * T)),
    };
    if (!legal(cand)) continue;
    const next = set.slice();
    next[i] = cand;
    const ns = score(next);
    if (ns > s) {
      set = next;
      s = ns;
    }
  }
  if (s > bestScore) {
    bestScore = s;
    best = set;
  }
}

console.log(`worst pairwise separation across normal/deut/prot: dE ${bestScore.toFixed(1)}\n`);
for (const c of best) {
  const lin = linOf(c);
  console.log(
    `    --c-${c.name}: ${(c.L * 100).toFixed(2)}% ${c.C.toFixed(4)} ${c.h.toFixed(2)};` +
      `   contrast ${contrast(lin, PAPER).toFixed(2)}`,
  );
}

console.log('');
for (const kind of ['normal', 'deuteranopia', 'protanopia']) {
  const v = best.map((c) => (kind === 'normal' ? linOf(c) : simulate(linOf(c), kind)));
  const pairs = [];
  for (let i = 0; i < v.length; i++)
    for (let j = i + 1; j < v.length; j++)
      pairs.push([dE(v[i], v[j]), `${best[i].name}/${best[j].name}`]);
  pairs.sort((a, b) => a[0] - b[0]);
  console.log(
    `  ${kind.padEnd(13)} closest: ` +
      pairs
        .slice(0, 3)
        .map(([d, p]) => `${p} ${d.toFixed(1)}`)
        .join('   '),
  );
}
