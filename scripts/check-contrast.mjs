/* Contrast and legibility, measured on the rendered app.
 *
 * `check-tokens` proves every text *token* clears its contrast bar on every
 * surface the palette declares. It cannot see what the tokens are actually
 * painted on: a literal colour in a component, a translucent scrim over a
 * page, text laid over a painting or a gradient, a pseudo-element layered
 * underneath. Those are where the misses came from — the story title card in
 * the light theme measured 2.2:1 with every token in it passing.
 *
 * So this opens the built app in Chromium and measures what a reader sees:
 *
 *   1. Every visible run of text, on every route, in both themes, against
 *      the background actually composited behind it — every translucent
 *      layer flattened down to the first opaque one, inherited opacity
 *      included. WCAG AA: 4.5:1, or 3:1 for large text. Disabled controls
 *      are exempt, as WCAG exempts them.
 *   2. Text over an image or a gradient, where no computed colour says what
 *      is behind it: the text is hidden, its own line boxes are photographed,
 *      and the colour is measured against the mean of those pixels.
 *   3. States a static page never shows: an answered question, and the story
 *      title card that opens the first road.
 *   4. A size floor. No visible text under 11px — capitals that small, in the
 *      faintest ink, were the hardest text in the app to read.
 *
 * Before any of that it audits a page of planted failures and refuses to run
 * if it misses one, so a broken checker cannot pass everything quietly.
 *
 * Needs `dist/` (run after `vite build`) and Chromium (`npx playwright
 * install chromium`). Not in `npm run build`: that is also the production
 * build, and the machines that run it have no browser. CI runs it after the
 * build step instead.
 *
 *   npm run check:contrast
 */

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { preview } from 'vite';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MIN_FONT_PX = 11;

const ROUTES = [
  '#/',
  '#/auth/signin',
  '#/home',
  '#/path/english',
  '#/path/math',
  '#/path/reading',
  '#/path/science',
  '#/zone/comma_castle',
  '#/drills',
  '#/drills/math',
  '#/drill/english',
  '#/notes',
  '#/notes/math',
  '#/tests',
  '#/stats',
  '#/settings',
  '#/codex',
  '#/duels',
  '#/boss/science',
  '#/review',
  '#/bookmarks',
  '#/daily',
  '#/feedback',
  '#/faq',
  '#/privacy',
  '#/terms',
  '#/cookies',
  '#/profile',
  '#/diagnostic',
];

/* A guest who has finished onboarding, so every screen is reachable. The
   store normalises whatever it loads, so a profile is all it needs. */
function seed(theme) {
  localStorage.setItem('act-command:guest', '1');
  localStorage.setItem(
    'act-command:progress:v2:guest',
    JSON.stringify({
      version: 2,
      profile: {
        when: 'soon',
        before: 'first',
        target: 30,
        fear: 'english',
        testDate: null,
        savedAt: 1,
      },
    }),
  );
  localStorage.setItem('act-command:prefs:v1', JSON.stringify({ theme }));
}

/* ------------------------------------------------------------ in the page */

/** Every text run that fails, plus the runs drawn over an image or gradient,
 *  which are tagged `data-cc` for the pixel pass. Runs inside the page. */
function audit(minFont) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 1;
  const c = cv.getContext('2d', { willReadFrequently: true });
  const parse = (col) => {
    c.clearRect(0, 0, 1, 1);
    c.fillStyle = '#000';
    c.fillStyle = col;
    c.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = c.getImageData(0, 0, 1, 1).data;
    return [r, g, b, a / 255];
  };
  const over = (top, under) =>
    [0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3])).concat(1);
  const lum = ([r, g, b]) => {
    const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (x, y) => {
    const [a, b] = [lum(x), lum(y)].sort((p, q) => q - p);
    return (a + 0.05) / (b + 0.05);
  };
  const bodyBg = parse(getComputedStyle(document.body).backgroundColor);
  const where = (el) => {
    const parts = [];
    for (let n = el, i = 0; n && n.nodeType === 1 && i < 3; n = n.parentElement, i++) {
      const cls = [...n.classList]
        .filter((k) => !/[:[]/.test(k))
        .slice(0, 2)
        .join('.');
      parts.unshift(n.tagName.toLowerCase() + (cls ? '.' + cls : ''));
    }
    return parts.join(' > ');
  };

  const fails = [];
  const textured = [];
  let id = 0;
  for (const el of document.querySelectorAll('body *')) {
    const text = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(' ')
      .trim();
    if (!text) continue;
    const box = el.getBoundingClientRect();
    if (!box.width || !box.height) continue;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || el.closest('.sr-only,[aria-hidden="true"],[inert],svg'))
      continue;
    if (el.closest(':disabled,[aria-disabled="true"]')) continue;

    let opacity = 1;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement)
      opacity *= +getComputedStyle(n).opacity;
    if (opacity < 0.05) continue;

    const size = parseFloat(s.fontSize);
    const large = size >= 24 || (size >= 18.66 && +s.fontWeight >= 700);
    const need = large ? 3 : 4.5;
    if (size < minFont)
      fails.push({ kind: 'size', where: where(el), text: text.slice(0, 40), detail: `${size}px` });

    // Composite the backgrounds down to the first opaque one.
    const layers = [];
    let image = false;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const ns = getComputedStyle(n);
      if (ns.backgroundImage !== 'none') image = true;
      const bg = parse(ns.backgroundColor);
      if (bg[3] > 0) {
        layers.push(bg);
        if (bg[3] >= 0.999) break;
      }
    }
    let bg = layers.length && layers.at(-1)[3] >= 0.999 ? layers.pop() : bodyBg;
    for (let i = layers.length - 1; i >= 0; i--) bg = over(layers[i], bg);
    const fg0 = parse(s.color);
    const fg = over([fg0[0], fg0[1], fg0[2], fg0[3] * opacity], bg);

    if (image) {
      el.dataset.cc = String(id);
      textured.push({
        id: id++,
        need,
        where: where(el),
        text: text.slice(0, 40),
        fg: fg0.slice(0, 3),
        opacity,
      });
      continue;
    }
    const cr = ratio(fg, bg);
    if (cr < need)
      fails.push({
        kind: 'contrast',
        where: where(el),
        text: text.slice(0, 40),
        detail: `${cr.toFixed(2)}:1, needs ${need}:1`,
      });
  }
  return { fails, textured };
}

/* ------------------------------------------------------- on the node side */

const lum = ([r, g, b]) => {
  const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (x, y) => {
  const [a, b] = [lum(x), lum(y)].sort((p, q) => q - p);
  return (a + 0.05) / (b + 0.05);
};

/** Text over an image or gradient: make the glyphs transparent, photograph
 *  their own line boxes, and measure against the mean of what is there. */
async function measureTextured(page, item) {
  const rect = await page.evaluate(
    ([id, expected]) => {
      const el = document.querySelector(`[data-cc="${id}"]`);
      if (!el) return null;
      // A screenshot can only photograph what is in the viewport.
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
      /* Still where the audit found it? A toast dismissing itself, or anything
       else mid-transition, would be photographed half-gone and measured
       against whatever shows through. Skip it rather than report noise. */
      let opacity = 1;
      for (let n = el; n && n.nodeType === 1; n = n.parentElement)
        opacity *= +getComputedStyle(n).opacity;
      if (Math.abs(opacity - expected) > 0.02) return null;
      const range = document.createRange();
      range.selectNodeContents(el);
      const r = [...range.getClientRects()].filter((b) => b.width && b.height);
      if (!r.length) return null;
      const x = Math.min(...r.map((b) => b.left));
      const y = Math.min(...r.map((b) => b.top));
      const w = Math.max(...r.map((b) => b.right)) - x;
      const h = Math.max(...r.map((b) => b.bottom)) - y;
      /* The glyphs go transparent; any text-shadow stays. A halo behind text
       over a painting is part of what the letters are read against — the
       landing hero relies on one — and a transparent glyph still paints it. */
      el.dataset.ccColor = el.style.color;
      el.style.color = 'transparent';
      const vw = document.documentElement.clientWidth;
      const vh = window.innerHeight;
      const left = Math.max(0, x);
      const top = Math.max(0, y);
      const width = Math.min(vw, x + w) - left;
      const height = Math.min(vh, y + h) - top;
      if (width < 1 || height < 1) return null;
      return { x: left, y: top, width, height };
    },
    [item.id, item.opacity],
  );
  if (!rect) return null;
  let buf;
  let stillThere;
  try {
    buf = await page.screenshot({ clip: rect, animations: 'disabled' });
  } finally {
    stillThere = await page.evaluate((id) => {
      const el = document.querySelector(`[data-cc="${id}"]`);
      if (el) el.style.color = el.dataset.ccColor;
      return !!el?.isConnected;
    }, item.id);
  }
  /* Gone while being photographed — an achievement toast dismisses itself
     after a few seconds — so the picture is of whatever was behind it. */
  if (!stillThere) return null;
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  if (process.env.CC_DEBUG) item.photo = buf;
  const sum = [0, 0, 0];
  for (let i = 0; i < data.length; i += info.channels)
    for (let k = 0; k < 3; k++) sum[k] += data[i + k];
  const n = data.length / info.channels;
  const bg = sum.map((v) => v / n);
  const fg = item.fg.map((v, k) => v * item.opacity + bg[k] * (1 - item.opacity));
  return ratio(fg, bg);
}

/* Wait for the page to stop moving. Entrances here are staggered springs —
   the road chooser's cards take a couple of seconds to reach full opacity —
   and a run measured mid-fade reports text as unreadable that a moment later
   is fine. Settled means a full second in which nothing appeared, left or
   changed opacity. */
async function settle(page, maxMs = 7000) {
  /* Element count as well as opacities: a dialog that mounts on a delay —
     the road chooser opens a beat after the story closes — changes the page
     without anything fading yet, and a check made in the quiet before it
     arrived used to call that settled. */
  const sample = () =>
    page.evaluate(() => {
      const all = [...document.querySelectorAll('body *')];
      return all.length + ':' + all.map((e) => getComputedStyle(e).opacity).join();
    });
  const started = Date.now();
  let before = await sample();
  let still = 0;
  while (Date.now() - started < maxMs) {
    await page.waitForTimeout(250);
    const now = await sample();
    still = now === before ? still + 1 : 0;
    // A full second without a change, not one quiet quarter of one.
    if (still >= 4) return;
    before = now;
  }
}

async function auditPage(page, label, problems, { still = false } = {}) {
  if (!still) await settle(page);
  const { fails, textured } = await page.evaluate(audit, MIN_FONT_PX);
  fails.forEach((f) => problems.push({ label, ...f }));
  for (const item of textured) {
    const cr = await measureTextured(page, item);
    if (cr !== null && cr < item.need && item.photo) {
      // `CC_DEBUG=dir npm run check:contrast` keeps what was measured, to look at.
      const { writeFileSync, mkdirSync } = await import('node:fs');
      mkdirSync(process.env.CC_DEBUG, { recursive: true });
      writeFileSync(
        `${process.env.CC_DEBUG}/${label.replace(/\W+/g, '_')}-${item.id}.png`,
        item.photo,
      );
    }
    if (cr !== null && cr < item.need)
      problems.push({
        label,
        kind: 'contrast',
        where: item.where,
        text: item.text,
        detail: `${cr.toFixed(2)}:1 over an image, needs ${item.need}:1`,
      });
  }
}

async function dismissStory(page) {
  for (let i = 0; i < 3 && (await page.locator('.story-overlay').count()); i++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(450);
  }
}

/* --------------------------------------------------------------- the run */

async function selfTest(browser) {
  const page = await browser.newPage();
  await page.setContent(`<body style="background:#fff;font-size:16px">
    <p>plain, passes</p>
    <p style="color:#999">planted: 2.85:1</p>
    <div style="background:oklch(0.3 0.02 70)"><span style="color:oklch(0.45 0.02 70)">planted: oklch</span></div>
    <div style="background:#000"><span style="color:#fff;opacity:.3">planted: faded</span></div>
    <p style="font-size:9px">planted: tiny</p>
    <div style="background:linear-gradient(#fff,#eee);padding:8px"><span style="color:#ddd">planted: on gradient</span></div>
  </body>`);
  const problems = [];
  await auditPage(page, 'self-test', problems);
  await page.close();
  const caught = new Set(problems.map((p) => p.text));
  const missed = [
    'planted: 2.85:1',
    'planted: oklch',
    'planted: faded',
    'planted: tiny',
    'planted: on gradient',
  ].filter((t) => !caught.has(t));
  const false_ = problems.filter((p) => !p.text.startsWith('planted'));
  if (missed.length || false_.length) {
    console.error('check-contrast: the checker itself is broken.');
    if (missed.length) console.error('  missed planted failures:', missed);
    if (false_.length) console.error('  flagged passing text:', false_);
    process.exit(2);
  }
}

if (!existsSync(new URL('../dist/index.html', import.meta.url))) {
  console.error('check-contrast: no dist/ — run `npx vite build` first.');
  process.exit(2);
}

const server = await preview({ root: ROOT, logLevel: 'silent', preview: { port: 0, open: false } });
const base = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await chromium.launch();
const problems = [];

try {
  await selfTest(browser);

  for (const theme of ['dark', 'light']) {
    /* Reduced motion settles every entrance on its final frame, so nothing
       is measured half-faded. */
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      reducedMotion: 'reduce',
    });
    await ctx.addInitScript(seed, theme);
    const page = await ctx.newPage();

    /* The title card that opens the first road. It is on a timer — up for
       about a second and a half, then it lifts away — so it is measured on a
       held clock: run the app's time forward until the card is up, then stop
       it there. A real-time measurement that straddled the lift photographed
       the scene arriving behind it instead. Its own context, because a
       Playwright clock holds every page in a context: shared, it froze every
       entrance on every later route at its first frame. */
    const storyCtx = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      reducedMotion: 'reduce',
    });
    await storyCtx.addInitScript(seed, theme);
    const held = await storyCtx.newPage();
    await held.clock.install();
    await held.goto(`${base}/#/path/english`, { waitUntil: 'networkidle' });
    await held.clock.runFor(1000);
    if (await held.locator('.story-overlay .story-title-plate').count())
      await auditPage(held, `${theme} story title`, problems, { still: true });
    else
      problems.push({
        label: `${theme} story title`,
        kind: 'missing',
        where: '',
        text: '',
        detail: 'title card never appeared',
      });
    await storyCtx.close();

    for (const route of ROUTES) {
      await page.goto(`${base}/${route}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      await dismissStory(page);
      await auditPage(page, `${theme} ${route}`, problems);
    }

    // An answered question: the verdict rows and the explanation sheet.
    await page.goto(`${base}/#/drill/english`, { waitUntil: 'networkidle' });
    await dismissStory(page);
    await page.locator('[role="radio"]').first().click();
    // The explanation sheet springs in after the verdict; measure it settled.
    await page.waitForTimeout(1600);
    await auditPage(page, `${theme} answered question`, problems);

    await ctx.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}

const unique = [...new Map(problems.map((p) => [`${p.label}|${p.where}|${p.text}`, p])).values()];
if (unique.length) {
  console.error(`check-contrast: ${unique.length} problem(s)\n`);
  for (const p of unique)
    console.error(
      `  ${p.label.padEnd(28)} ${p.kind.padEnd(8)} ${p.detail.padEnd(30)} "${p.text}"  ${p.where}`,
    );
  process.exit(1);
}
console.log(
  `check-contrast: ${ROUTES.length} routes × 2 themes, plus story and answer states — all text readable.`,
);
