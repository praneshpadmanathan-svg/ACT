# ACT Command — graphics and visual-quality brief

**Audience:** an implementer (human or AI) working on the visual layer of
`act-command` who did not build it.
**Goal:** take an app that is already architecturally well-dressed and close
every remaining gap between it and something a student would pay for.
**Written:** 2026-09-16, against commit `7e54e75`, bank at 2,386 drill +
370 zone questions.

Every number in this file was measured, not estimated. Where a figure appears,
the command that produced it is given so you can re-run it after your change
instead of trusting this document.

---

## 0. Read this section before touching anything

### 0.1 What you must not break

These are not style preferences. They are load-bearing.

| Constraint                                                                                                                                                                                                   | Why                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **All colour comes from CSS variables in `src/index.css`, surfaced as Tailwind tokens in `tailwind.config.js`.** Never add a hex literal, never add a `dark:` prefix.                                        | The light theme works by swapping `:root` variables under `[data-theme='light']`. There are **zero** `dark:` classes in the entire codebase, by design. One literal is one element that renders the wrong theme. |
| **Never widen the elevation ladder.** Six named steps: `flush`, `resting`, `raised`, `lifted`, `floating`, `overlay`.                                                                                        | The values live in `index.css` because a shadow tuned for near-black leather reads as a smudge on cream paper. A new one-off shadow is a theme bug waiting for a light-mode user.                                |
| **Never add a bespoke cubic-bézier for interface motion.** Five durations (`instant` 90ms, `quick` 160ms, `base` 240ms, `screen` 320ms, `cinematic` 620ms), four curves (`out`, `in`, `inout`, `overshoot`). | The app had thirty-odd hand-picked curves once; nothing moved alike and movement carried no meaning. Combat/sprite animations are exempt — they are timed against sound cues.                                    |
| **Do not touch `src/lib/normalize.ts`.**                                                                                                                                                                     | `shuffleChoices()` deterministically reorders answer choices from a hash of the item id. Changing it re-shuffles every question in the bank and invalidates saved progress.                                      |
| **Do not touch the answer-shape gates** in the content scripts.                                                                                                                                              | The bank was answering itself through choice length. The gates are symmetric on purpose — banning only long keys turns "cross out the longest" into "cross out the shortest".                                    |
| **Content is original and must stay so.**                                                                                                                                                                    | No ACT, ACEly, PrepScholar, Magoosh, UWorld or Khan Academy material, verbatim or paraphrased. The trademark disclaimer stays.                                                                                   |
| **No secrets in the repo. RLS on every table. Entitlements enforced server-side. Nothing outside `/lib/payments/` imports Stripe.**                                                                          | Security invariants. A visual change should never touch these; if yours does, stop.                                                                                                                              |
| **`correct_key` is never exposed client-side for an in-progress timed test.**                                                                                                                                | Same.                                                                                                                                                                                                            |

### 0.2 What is already good — do not "improve" it

Real craft is already in place. Re-doing this work is the fastest way to make
the app worse.

- **The token system.** Roles, not materials: `leather` is _chrome surface_,
  `parchment` is _text on chrome_, `paper` is _text surface_, `ink` is _text on
  paper_. Read `tailwind.config.js` top to bottom before you write a class.
- **The fluid type scale.** `clamp()`-based, minor third for body, fourth for
  display, so it never steps against a continuously fluid reading column. A
  `postcss-text-scale` plugin multiplies every emitted `font-size` for the
  accessibility setting, so **do not hardcode a px font-size anywhere** — it
  will silently opt out of that setting.
- **Self-hosted fonts.** Cinzel (display), Newsreader (reading), Inter (UI),
  Atkinson Hyperlegible (high-legibility toggle), all via `@fontsource` in
  `src/main.tsx` and `src/lib/prefs.tsx`. They used to come from Google, which
  sent every visitor's IP to a third party before first paint. **Do not
  reintroduce a Google Fonts link.**
- **`src/components/Art.tsx`.** Already does `<picture>` with AVIF/WebP
  sources, an inline 20px data-URI blur placeholder behind the real image, a
  declared aspect ratio so nothing shifts, and `loading="lazy"` /
  `decoding="async"`. This is the reference implementation. Every new image
  goes through it.
- **`src/components/StatCharts.tsx`.** Every colour is
  `oklch(var(--c-…))`. This is what a chart in this codebase is supposed to
  look like. Compare it with `FigureChart.tsx` (§2.3) to see the difference.
- **110 named component classes** in `index.css` (`panel`, `choice`, `sheet`,
  `plate-card`, `rail-item`, `story-card`, `btn-quill`, …). Run
  `grep -oE "^\s{2}\.[a-zA-Z][a-zA-Z0-9_-]*" src/index.css | sort -u`
  before inventing a class. The vocabulary almost certainly has what you need.
- **Icons are centralised** — 43 inline SVGs in `src/components/Icon.tsx`, 13
  nav glyphs in `NavGlyph.tsx`. Do not add an icon library; add a variant.
- **The measured contrast notes in the CSS comments are real.** e.g.
  `animate-shimmer` floors at `.82` opacity rather than `.55` because gold on
  the light theme's panel measured 4.46:1 at `.55` and 4.77:1 at `.82`. If you
  change an opacity on text, re-measure.

### 0.3 Documents that already exist — read before you plan

Two prior documents overlap this one. Read both; this brief supersedes neither.

- **`docs/premium-redesign-plan.md` (505 lines).** The original material-and-
  governance plan, with a ranked evidence table from a walkthrough at 1440×900.
  **Much of it has since been executed** — the elevation ladder, the motion
  ladder, and the token system it asks for all now exist. Treat its Phase 0 as
  done and check each later phase against the current code before working it.
  Its defect table is still the best statement of _why_ the app read as cheap:
  decorative particles over live content, one surface for every role, display
  text on illustration with no scrim, raw native controls leaking through,
  uniform density with no focal point, unlabelled floating buttons. Verify each
  of those eight individually — some are fixed, some are not.
- **`docs/animation-inventory.md`.** The catalogue of what moves and why.
  Update it as part of any motion change; an inventory that drifts is worse than
  none.

This brief covers what those two do not: the measured accessibility failures,
the token leaks, the state vocabulary, the dead assets, and the perceived-
performance ceiling.

### 0.4 Priority key

- **P0** — visibly broken or unreadable for some users right now. Fix first.
- **P1** — systemic; breaks the design system's own promises.
- **P2** — per-screen craft.
- **P3** — the ceiling. What separates "clean" from "worth paying for."

---

## 1. Measured baseline

Re-run these after your changes. All from the repo root.

```bash
npm run build
```

Current output — the only chunk over the 700 kB warning limit:

| chunk           | raw             | gzip          |
| --------------- | --------------- | ------------- |
| `content`       | **2,442.77 kB** | **606.07 kB** |
| `supabase`      | 208.24 kB       | 53.90 kB      |
| `react`         | 139.82 kB       | 45.34 kB      |
| `index`         | 81.55 kB        | 26.14 kB      |
| `motion`        | 79.11 kB        | 27.72 kB      |
| everything else | < 75 kB each    |               |

```bash
npx eslint src --max-warnings 999
```

→ `15 problems (0 errors, 15 warnings)`, all `react-hooks/purity`, all
`Date.now()` in a `useRef` initialiser. Cosmetic in effect but they hide real
warnings behind noise.

```bash
grep -rnoE "#[0-9a-fA-F]{3,8}\b|rgba?\([0-9]" src --include=*.tsx | grep -vc '\.test\.'
```

→ **154 hardcoded colour literals across 26 files.**

```bash
grep -rc "focus-visible" src/index.css   # → 2
grep -rn "focus-visible" src --include=*.tsx | wc -l   # → 1
```

→ Three focus-visible declarations for an app with hundreds of interactive
elements.

```bash
grep -rln "skeleton\|Skeleton" src --include=*.tsx
```

→ nothing. No skeleton or placeholder state anywhere.

---

## 2. P0 — broken right now

### 2.1 Five of six section colours are unreadable in light mode

The six region accents (`village`, `woods`, `desert`, `cliffs`, `summit`,
`blood`) are declared **identical in both themes** —
`tailwind.config.js` says so explicitly: _"Region accents, keyed to the painted
map. Identical in both themes — they are mid-tones lifted off the artwork and
read on either."_

They do not read on either. Measured contrast against each ground:

| fill      | oklch                  | vs dark panel | vs paper      |
| --------- | ---------------------- | ------------- | ------------- |
| `village` | `75.07% 0.1295 79.85`  | 8.06 ✓        | **1.89 FAIL** |
| `woods`   | `66.78% 0.116 148`     | 6.30 ✓        | **2.41 FAIL** |
| `desert`  | `64.78% 0.1407 47.39`  | 5.28 ✓        | **2.88 FAIL** |
| `cliffs`  | `66.46% 0.1009 235.78` | 6.04 ✓        | **2.52 FAIL** |
| `summit`  | `82.78% 0.1421 91.77`  | 10.65 ✓       | **1.43 FAIL** |
| `blood`   | `51.19% 0.1407 31.57`  | **2.97 FAIL** | 5.12 ✓        |

The `*-text` variants (`--c-blood-text` etc.) were added to solve exactly this
and _are_ correctly re-declared per theme at `src/index.css:286–290`. The fills
were never given the same treatment.

**The fix.** Give each of the six fills a light-theme override in the
`[data-theme='light']` block, the same way the `-text` variants already get
one, targeting ≥ 4.5:1 against paper (`oklch(0.94 0.012 85)`) for anything
carrying text or meaning, ≥ 3:1 for a pure decorative fill. Keep the hue; move
lightness and chroma. Do **not** solve it by forcing every region badge onto
the dark panel — that concedes the light theme.

**Also:** three pairs sit under the dE ≥ 8 CVD separation target when they
appear together (`village`/`desert` 11.3, `village`/`summit` 12.0,
`woods`/`blood` 11.6 — all "tight" rather than failing, but none comfortable).
Wherever two region colours are adjacent and the only difference between two
things, add a second channel — a glyph, a label, a texture. Never colour alone.

### 2.2 The whole question bank is in the critical path

`content` is **2.44 MB raw / 606 kB gzipped**, and it is a static import. A
student on a phone downloads all 2,386 drill questions, 370 zone questions, 140
passages and 60 note pages before they can answer one question — and every
question I add makes it worse. This is the single largest thing standing between
this app and feeling expensive, because no amount of visual polish survives a
six-second blank screen on a mid-tier Android.

**The fix, in order:**

1. **Split the bank by section.** `src/content/index.ts` should expose async
   accessors so `questionsMath.json` loads only when a Math drill starts. The
   four section files plus `expansion.json` are independent; nothing needs all
   five at once.
2. **Split passages from questions.** `passagesReading.json` /
   `passagesScience.json` are only needed once a passaged item is on screen.
3. **Lazy-load `expansion.json` separately** — it is `practiceOnly: true` and
   reachable from one screen.
4. Only then consider `build.rolldownOptions.output.codeSplitting`.

**Do not** solve this by raising `chunkSizeWarningLimit`.

### 2.3 `FigureChart.tsx` bypasses the design system completely

`src/components/FigureChart.tsx` is the newest visual component and the only
chart renderer that hardcodes its palette:

- `FigureChart.tsx:22` — ground `#F4E8CF`, a literal. **In dark mode the panel
  behind it is `oklch(20% …)`. The chart renders a cream card in the middle of a
  dark app.**
- `FigureChart.tsx:27` — five series colours `#9E3B1E`, `#1A6B9A`, `#3F7D47`,
  `#6B3FA0`, `#8A6510`, none of which exist as tokens and none of which have
  been CVD-validated.

Measured. Contrast against their own hardcoded ground is fine:

| series | hex       | vs `#F4E8CF` |
| ------ | --------- | ------------ |
| rust   | `#9E3B1E` | 5.58 ✓       |
| blue   | `#1A6B9A` | 4.78 ✓       |
| green  | `#3F7D47` | 4.08 ✓       |
| purple | `#6B3FA0` | 6.08 ✓       |
| olive  | `#8A6510` | 4.38 ✓       |

Separation under deuteranopia is not:

| pair          | dE      | verdict                            |
| ------------- | ------- | ---------------------------------- |
| rust / olive  | **6.2** | **FAIL** (target ≥ 8)              |
| blue / purple | **8.0** | **FAIL** (at the floor, no margin) |

A red-green colourblind student reading a Science figure with a rust series and
an olive series sees one series.

**The fix.**

1. Promote the five series to tokens — `--c-series-1` … `--c-series-5` — with
   independent light and dark steps, exactly as `--c-blood-text` has.
2. Re-step the ramp until every pair clears dE ≥ 8. Move rust/olive apart
   first; they are the same hue family.
3. Replace the `#F4E8CF` ground with the `paper` token.
4. Add a second encoding — dash pattern for lines, a marker shape per series —
   so identity never rests on hue alone.
5. Mirror `StatCharts.tsx`'s conventions for everything else: 2px lines,
   ≥ 8px markers, recessive grid (`--c-leather-700` at `strokeDasharray="3 3"`),
   axis text in `--c-ink-faint`, a 2px surface-coloured ring on overlapping
   marks.
6. Direct-label ≤ 4 series; a legend is always present for ≥ 2.
7. **Never a dual y-axis.** Two measures of different scale → two charts.

### 2.4 Keyboard focus is essentially undesigned

Three `focus-visible` declarations exist. Everything else inherits whatever the
browser does, which on a dark leather surface with a custom button treatment is
frequently invisible.

**The fix.** One `:focus-visible` treatment, defined once in the `@layer base`
block of `index.css`, applied to every interactive role, built from tokens:

- A 2px ring in `gold`, offset 2px, so it is never flush with a border.
- A second 1px inner ring in `leather-950` (dark) / `paper` (light) so the gold
  ring reads against both a gold-bordered button and a plain panel.
- ≥ 3:1 against **both** the element's own fill and the surface behind it.
- Applies to `.btn`, `.btn-*`, `.choice`, `.chip`, `.rail-item`,
  `.palette-item`, `.route-node`, `.task-card`, `.story-choice`, and every bare
  `a`, `button`, `[role="button"]`, `input`, `select`, `textarea`,
  `[tabindex="0"]`.
- Never `outline: none` without a replacement in the same rule.

Then tab through every screen with the mouse untouched and confirm the ring is
visible at every stop, in both themes.

### 2.5 The public-facing copy describes an app that no longer exists

`index.html:14` — the meta description, which is what appears in search results
and in every link a student sends a friend:

> "Free prep for the Enhanced ACT: **754 practice questions** with every choice
> explained, 60 lessons, timed section tests and **a world map you climb** one
> skill at a time. No account needed."

The bank holds **2,756** questions. **The world map was deliberately removed**
and replaced with tab navigation. Both halves of the pitch are wrong.

`public/og.png` (256 kB, generated by `scripts/build-og.mjs`) carries "the three
facts that decide whether anyone taps" — those facts are now also wrong.

**The fix.** Update the meta description, the `og:description`, and regenerate
`og.png`. Then **make the question count generated, not typed**: it lives in
`src/content/stats.json`, which `scripts/check-content.mjs --write` already
refreshes on every content change. Nothing in a shipped page should carry a
hand-typed count again.

---

## 3. P1 — systemic

### 3.1 The 154 colour literals

Every one is a place where the light theme, the high-contrast setting, and any
future theme silently fail. Ranked by count:

| file                                                                     | literals | note                                                                                                                                                                    |
| ------------------------------------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/LoadingScreen.tsx`                                           | 29       | The **first thing a visitor sees**, and it is theme-blind. `#252f52`, `#905973`, `#faa259`, `#623c4c`, `#453133`, `#2d231b`, `#36211a`, `#232e51`, … all on line 52–56. |
| `components/Vignette.tsx`                                                | 21       | `#241a10` twice as an edge wash, then `#d9a441` / `#96661c` / `#f3e7cb` / `#cdb98d` as gilt and paper — all four already exist as `gold`/`gilt`/`paper` tokens.         |
| `components/RankSigil.tsx`                                               | 17       | `rgba(0,0,0,.45)` shadow plus per-rank metal ramps (`#d08a52`/`#8a4f22`/`#f0b47c`, `#e8eef6`/`#95a6bd`, …).                                                             |
| `screens/Boss.tsx`                                                       | 12       |                                                                                                                                                                         |
| `components/Feedback.tsx`                                                | 12       |                                                                                                                                                                         |
| `components/QuestionRunner.tsx`                                          | 11       | The single most-viewed component in the app.                                                                                                                            |
| `components/FigureChart.tsx`                                             | 7        | See §2.3.                                                                                                                                                               |
| `screens/Notes.tsx`                                                      | 5        |                                                                                                                                                                         |
| `screens/Home.tsx`                                                       | 5        |                                                                                                                                                                         |
| `game/StoryOverlay.tsx`                                                  | 5        |                                                                                                                                                                         |
| `screens/Auth.tsx`                                                       | 4        |                                                                                                                                                                         |
| `screens/Stats.tsx`, `screens/Drills.tsx`, `components/PassagePanel.tsx` | 3 each   |                                                                                                                                                                         |
| 12 further files                                                         | 1–2 each |                                                                                                                                                                         |

**Method, in this order:**

1. **`LoadingScreen.tsx` and `QuestionRunner.tsx` first** — highest exposure.
2. For each literal, find the token it is approximating. Most are within a few
   percent of an existing one; use the existing one rather than adding a token.
3. A literal that genuinely has no token and genuinely needs to differ per
   theme gets a new variable declared in **both** `:root` and
   `[data-theme='light']`. Never only one.
4. A literal that is _correct in both themes_ — a fixed dark text colour on a
   `gilt` background, say — still becomes a token, with a comment saying it is
   deliberately theme-invariant. `gilt` already exists for exactly this case;
   read its note in `tailwind.config.js`.
5. **Rank sigil and boss metal ramps are the legitimate hard case.** A brushed
   steel or copper gradient is a material, not a role, and may be theme-
   invariant. Tokenise it as `--c-metal-copper-{lo,mid,hi}` and state the
   decision in a comment. Do not leave it as five loose hexes.

Finish with the grep from §1 returning **0**, then add a lint rule or a
`scripts/check-tokens.mjs` to the `build` chain so it stays 0.

### 3.2 No loading, empty, or error state vocabulary

There are no skeletons. Combined with §2.2, the app's cold-start experience is
a blank leather rectangle.

There _is_ good instinct in places — `Drills.tsx:279` has a real
`title="No questions here"` empty state, `Drills.tsx:665` has an honest error
(_"The question bank came back empty, which should not happen."_), and
`Home.tsx:571` deliberately omits a card rather than showing an empty one. But
it is per-screen improvisation, not a vocabulary.

**Build three component families in `src/components/ui.tsx`:**

1. **`<Skeleton>`** — one shape primitive (`text`, `line`, `block`, `card`)
   built from `paper-dim` / `leather-800`, animated with a single shared shimmer
   that respects `prefers-reduced-motion` (where it becomes a static fill, not
   a stopped animation mid-cycle). **Match the real content's dimensions** — a
   skeleton that is the wrong height causes the layout shift it exists to
   prevent. Use it on every `React.lazy` route boundary and every content fetch.
2. **`<EmptyState>`** — eyebrow, title, one sentence, one action. Lift the
   `Drills.tsx:279` treatment and make it the standard. Rule: an empty state
   always offers the next action. Never a dead end.
3. **`<ErrorState>`** — what went wrong, in the user's terms, and how to
   recover. Lift the `Drills.tsx:665` voice; it is already right. No
   apologies, no stack traces, no "Oops".

Then audit every screen for the three states and fill the gaps. Every screen
has all three whether or not anyone has seen them.

### 3.3 The 15 lint warnings

All `react-hooks/purity`, all the same shape — `useRef(Date.now())` or
`useRef(Date.now() + n)`, at `screens/Tests.tsx:257`, `:525`, and thirteen
similar sites. The comments show the intent is deliberate (_"Deadline, not a
countdown — a suspended tab cannot gain time"_), and it is correct reasoning.

**The fix** is mechanical, not a rewrite: initialise the ref to `null` and set
it in an effect, or use a lazy initialiser helper. Get to
`0 problems`, so the next real warning is visible instead of buried in fifteen
known ones.

### 3.4 Eleven `<img>` tags outside `Art.tsx`

```bash
grep -rn "<img" src --include=*.tsx | wc -l          # 11
grep -rn "<img" src --include=*.tsx | grep -c "width="  # 0
```

None declares intrinsic dimensions. Each is a layout shift. **Route all
raster imagery through `Art.tsx`** — it already handles `<picture>`, AVIF/WebP,
the blur placeholder, the aspect ratio, and lazy loading. If one of the eleven
genuinely cannot use `Art`, give it explicit `width`/`height` and an
`aspect-ratio` box.

### 3.5 Tables

Three `<table>` elements, four `overflow-x` usages — close, but verify the
mapping is one-to-one. Every table, code block and diagram lives in its own
`overflow-x: auto` container so the page body never scrolls sideways. Add
`font-variant-numeric: tabular-nums` wherever digits line up in a column; the
`.quill-table` class is where this belongs.

---

## 4. P2 — screen-by-screen

I have not audited every screen at pixel level. Rather than invent defects,
here is the signal to look for and the order to work in. Screens by size:

| screen        | lines |
| ------------- | ----- |
| `Landing.tsx` | 869   |
| `Tests.tsx`   | 864   |
| `Drills.tsx`  | 807   |
| `Home.tsx`    | 798   |
| `Stats.tsx`   | 727   |
| `Auth.tsx`    | 650   |
| `Boss.tsx`    | 520   |

**Work in this order, for the reason given:**

1. **`QuestionRunner.tsx` + `PassagePanel.tsx`** — not the biggest, but where a
   student spends 90% of their time. Every pixel here is worth ten elsewhere.
2. **`Landing.tsx`** — the only thing a non-user sees. First impression.
3. **`Home.tsx`** — the screen a returning student lands on daily.
4. **`Tests.tsx`** — the timed experience, where a visual glitch costs someone
   real score.
5. **`Stats.tsx`** — see §5.4; this is the biggest untapped opportunity.
6. Then the rest.

**For each screen, check:**

- **Optical alignment, not metric.** Do the left edges of an eyebrow, a
  heading, and body copy actually line up, or are they merely all at `padding:
24px` while the type's own side bearings pull them apart?
- **One spacing system.** Sibling groups laid out with flex/grid `gap`, never
  per-element margins that collapse or double. Search each file for stacked
  `mt-`/`mb-` on siblings — that is a `gap` waiting to happen.
- **Not everything is a card.** Border, fill, radius and shadow each say
  "separate object". If every block on the screen has the same radius and the
  same shadow, the hierarchy is flat and the eye has nowhere to land. Spend
  elevation on the one thing that needs it.
- **Repeated things compose as one object.** Cards in a row, label/value pairs
  down a list: same edges, same baselines, same inner padding, and the
  recurring element in the same place on each.
- **Content sets height.** Nothing stretches over dead space; nothing sits
  alone in a row because the grid wanted four and got five.
- **Text that can outgrow its track wraps or scrolls.** Clipped text is a bug,
  always. Test with the longest real string in the bank, not with "Lorem".
- **At 400px wide.** ≥ 16px side gutter at every width, set once on a wrapper
  using `padding-block` for the vertical so a shorthand cannot zero the sides.
  Flex and grid rows wrap or stack. Nothing has a `min-width` wider than a
  phone.
- **In both themes,** with the high-legibility toggle on and off, and with the
  text-scale setting at its maximum.

---

## 5. P3 — the ceiling

This section is what turns "clean" into "worth paying thousands for". Everything
above is repair; this is craft.

### 5.1 Remove the dead weight first

You cannot make something feel expensive while it ships 758 kB of artwork for a
screen that no longer exists.

The adventure map was removed and replaced with tab navigation. The `world-map`
art key is now referenced by **nothing** in `src/`:

```bash
grep -rn "name=\"world-map\"\|'world-map'" src --include=*.tsx   # → no matches
```

Yet these still ship:

| file                                | size        |
| ----------------------------------- | ----------- |
| `public/art/world-map.webp`         | 290 kB      |
| `public/art/gen/world-map-768.webp` | 272 kB      |
| `public/art/gen/world-map-768.avif` | 196 kB      |
| **total**                           | **~758 kB** |

Plus the now-obsolete entry at `src/art.json:352–366` and the archaeological
comment block at `index.html:27–41` explaining a `<link rel="preload">` that was
already removed.

**Delete all of it.** Then verify `src/game/RegionBackdrop.tsx` — its header
comment says it needed strips "east and west of `world-map.webp`" and that they
"cannot do that job", so confirm what it actually loads now and that nothing
else in `art.json` is orphaned the same way:

```bash
for f in $(ls public/art/*.png public/art/*.webp | xargs -n1 basename | sed 's/\.[^.]*$//' | sort -u); do
  grep -rqs -- "$f" src/ || echo "UNREFERENCED: $f"
done
```

Also audit the **54 PNGs** against 43 WebP and 31 AVIF. Every raster that is
not a transparent sprite needing PNG should have AVIF and WebP siblings
generated into `public/art/gen/` and be reachable through `Art.tsx`.

### 5.2 Depth as material, not as shadow

The app's whole conceit is physical: leather, parchment, paper, gilt, a quill.
The elevation ladder currently delivers this with box-shadows. Shadows alone read
as Material Design with a brown palette.

What makes a surface read as _leather_ rather than _a brown rectangle_ is the
edge and the grain, not the drop shadow:

- **A 1px inner highlight on the top edge and a 1px inner shadow on the
  bottom** — the way light falls on a raised physical panel. There is already a
  `--lamp-edge-paper` variable used by `shadow-sheet`; generalise that idea to
  the leather surfaces.
- **A deckled or torn edge on the paper sheets**, as an SVG mask or a
  background image, rather than a clean 8px radius. One asset, reused.
- **Grain at 2–4% opacity**, as a tiling texture in the surface tokens. Below
  5% it reads as material; above it reads as noise. It must be one small tiling
  asset, not a large image.
- **Gilt that catches light.** `gilt` and `gilt-bright` exist as tokens; a gold
  rule or a rank sigil should carry a subtle gradient from one to the other
  along its length, not a flat fill.

Rule: **every one of these goes through a token or a shared class.** A
per-component texture is how you get 154 literals again.

### 5.3 Motion that means something

The motion ladder is already defined and mostly respected. The ceiling is in
what is _not yet animated_:

- **Answer feedback.** `.choice-correct`, `.choice-wrong`, `.choice-seal`,
  `.juice-flash` and `.hitstop` classes exist. The moment a student selects an
  answer is the single most emotionally loaded frame in the app. It should feel
  like a seal being pressed: `instant` scale-down on press, `overshoot` on
  release, the seal stamping with the `stamp` keyframe already written for the
  rank banner.
- **Page transitions.** `pageIn` at `screen`/`out` exists. Consider whether a
  _shared element_ — the section sigil persisting from the Study list into the
  Zone header — is worth the complexity. It usually is, once, on the most
  travelled route only.
- **XP and progress.** `.xp-sweep` exists. A number that counts up, with the
  bar easing on `out` and the digits on `inout`, reads as earned. A number that
  snaps reads as a database write.
- **Every one of these respects `prefers-reduced-motion`.** The global block at
  `index.css:2121` collapses durations to `0.001ms`, which is a blunt but valid
  floor. Five components already branch on reduced motion in JS
  (`RankAura`, `ui`, `StoryOverlay`, `motion`, `Landing`). New motion follows
  that pattern: not "the animation but faster", but a **different, still
  design** — the seal appears already stamped.

### 5.4 The stats screen is the biggest untapped opportunity

`Stats.tsx` is 727 lines and `StatCharts.tsx` is already token-clean. A student
paying for prep wants to see progress, and a well-drawn progress view is the
most persuasive screen a prep app has.

**What already exists.** `StatCharts.tsx` exports `ScoreTrend` — a real
composite-score line, fed from completed full practice tests (`TestResult`),
gated behind `MIN_TREND_POINTS` so it does not draw a trend from one data
point — and `ActivityChart`. Both are token-clean. Do not rebuild them.

**The constraint that still binds:** a composite only exists for a student who
has finished full timed tests, and most students will have none. Everything
below is drawable from drill data, which every student has from their first
session. **Do not invent a score trend from drill accuracy** — scaling a
handful of drill items into a 1–36 composite is a measurement the app never
took, and `diagnostic.ts:15` already records why that inference is refused.

What drill data _does_ support, and what would be worth drawing:

- **Accuracy by topic, as a sorted horizontal bar** — the weakest topic first,
  which is also the actionable one. `weakestTopics()` already exists in the
  codebase.
- **The difficulty spread the student has actually attempted**, against the
  spread of the bank. This is genuinely new information to a student: "you have
  answered 12 hard Math items out of 161."
- **A calendar heat strip of days practised.** Cheap, honest, motivating.
- **Per-section counts against the real ACT weighting.**

Rules for all of it: one scale per chart, every label naming a value the chart
actually reaches, chart text from theme tokens, ≥ 2 series always legended, a
table view available, and a hover/tooltip layer by default. Never a dual axis.
See §2.3 for the palette work that must land first.

### 5.5 Copy is design material

`Drills.tsx:665` — _"The question bank came back empty, which should not
happen. Try a drill instead."_ — is the voice. Dry, specific, offers the next
action, does not apologise. `Explain.tsx:100` — _"nothing here is written for
the SAT"_ — same register.

Bring every string up to it:

- Name things as a student recognises them, not as the system is built.
- A control says exactly what happens. "Publish", then a toast saying
  "Published". Not "Submit" then "Success".
- Errors say what went wrong and how to fix it. No "Oops", no apologies, no
  vagueness.
- Specific beats clever.

### 5.6 Small things that cost nothing and read as care

- **`theme-color`** is a single literal `#1c1610` at `index.html:6`. Add a
  second `<meta name="theme-color">` with `media="(prefers-color-scheme:
light)"` so the phone's status bar matches the light theme.
- **Selection colour.** `::selection` in a gilt tint, defined once.
- **Scrollbars.** `.no-scrollbar` exists for hiding them; the ones that _are_
  visible should be styled in leather and gold, both themes.
- **Caret colour** on inputs, from `gold`.
- **`text-wrap: balance`** on every heading. There is a `.text-balance` class;
  confirm every `h1`/`h2` uses it.
- **`text-wrap: pretty`** on body copy, to kill orphans in the reading column.
- **Optical sizing.** Newsreader ships as a variable font with an `opsz` axis
  (`@fontsource-variable/newsreader/opsz.css` is already imported). Confirm
  `font-optical-sizing: auto` is actually set, or the axis is being paid for and
  not used.
- **Reading measure.** Running text near 65 characters. Verify the passage
  column at every breakpoint — this is the most-read text in the app.
- **Print styles.** A student printing a passage or an explanation sheet should
  get clean paper: no chrome, no nav, ink on white, page breaks between items.
  One `@media print` block.

---

## 6. Verification — the change is not done until these pass

```bash
npm test                              # 234 tests must stay green
npm run build                         # must pass check:content
node scripts/check-content.mjs        # 9 content rules
npx eslint src                        # target: 0 problems (from 15)
```

Plus, by hand:

- [ ] `grep -rnoE "#[0-9a-fA-F]{3,8}\b|rgba?\([0-9]" src --include=*.tsx | grep -v '\.test\.'` → **0**
- [ ] No chunk over 700 kB.
- [ ] Every one of the six section fills clears 4.5:1 on paper.
- [ ] Every `FigureChart` series pair clears dE ≥ 8 under deuteranopia.
- [ ] Tab through every screen, mouse untouched, both themes — focus ring
      visible at every stop.
- [ ] Every screen at 400px wide: no horizontal body scroll, ≥ 16px gutters.
- [ ] Every screen in light and dark, high-legibility on and off, text scale at
      maximum.
- [ ] `prefers-reduced-motion: reduce` — nothing moves, nothing is stuck
      mid-animation, nothing is invisible because it was waiting to animate in.
- [ ] Every screen has a loading, empty, and error state.
- [ ] No hand-typed question count anywhere in a shipped page.
- [ ] `world-map` assets gone; the unreferenced-art loop from §5.1 prints
      nothing.
- [ ] Screenshot every screen before and after, both themes, and diff them. A
      change you cannot see is a change you did not need to make; a change you
      did not intend is a regression.

---

## 7. Order of work

1. §2.5 copy + §5.1 dead assets — an hour, and the app immediately stops lying
   about itself.
2. §2.1 section colours, §2.3 `FigureChart` palette — the two measurable
   accessibility failures.
3. §2.4 focus ring — one CSS block, whole-app effect.
4. §3.1 the 154 literals, starting with `LoadingScreen` and `QuestionRunner`.
5. §2.2 the content chunk. Largest single win, largest single risk; do it once
   the visual layer is stable so a regression is attributable.
6. §3.2 the state vocabulary, §3.3 lint, §3.4 images.
7. §4 screen passes, in the stated order.
8. §5 the ceiling.
