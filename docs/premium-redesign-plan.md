# ACT Command — the premium rebuild

**Thesis in one sentence.** The app is not missing decoration; it is missing *materials, elevation, and
governance* — every surface is the same flat translucent rectangle with a 1px gold border, so nothing can
be more important than anything else, and the fix is a material system plus a small set of governed
tokens, not more ornament.

This document is the plan. It is written to be executed in order: Phase 0 is foundation and every later
phase depends on it. Nothing here asks for a paid service, a new backend, or a content rewrite.

---

## 1. What is actually wrong — evidence, not opinion

I ran the app at 1440×900 and walked landing → onboarding → camp → English drill. Ranked by how much each
costs us:

| # | Defect | Where | Why it reads as cheap |
|---|--------|-------|----------------------|
| 1 | **Decorative particles overlap live content.** Gold confetti sits on top of the passage text in the drill and on top of the XP bar on Camp. | `QuestionRunner`, `Feedback`, `RankAura`, Camp | Nothing signals "unfinished" faster than an effect the layout did not plan for. It reads as a z-index bug, not as polish. |
| 2 | **Everything is one surface.** A modal, the nav rail, a stat tile and a reading sheet all have the same fill, the same 1px gold border, the same corner radius. | Global — `.panel`, `.sheet`, `.story-card` | There are exactly **three** box-shadows in `tailwind.config.js` (`card`, `sheet`, `pin`). With no elevation ladder there is no hierarchy, and borders end up doing all the work. Border-led UI reads as a wireframe. |
| 3 | **Display text sits on illustration with no scrim.** "YOUR CLIMB TO 36 STARTS HERE" is barely legible over the sunset; the body line under it is unreadable over the village. | `Landing` hero | This is the first thing anyone sees. |
| 4 | **Native controls leak through.** The onboarding test-date field is a raw `<input type="date">`, complete with the OS calendar chrome. | `Onboarding` | One unstyled control destroys the world the illustrations spent 30 seconds building. |
| 5 | **Motion is rich but ungoverned.** 30+ bespoke keyframe animations, every one with its own hand-picked duration and cubic-bézier. | `tailwind.config.js` | No two things move alike, so movement carries no meaning. |
| 6 | **Mixed art fidelity with no rule.** Pixel-art sprites, painted scenes and vector glyphs all appear in the same card with no stated relationship. | `HeroChooser`, Camp, `Landing` | Reads as assets from three different products. |
| 7 | **Uniform density.** Every screen is a stack of same-width, same-padding cards. | Camp, Stats, Drills | No rhythm, no focal point, no "look here first". |
| 8 | **Unlabelled floating buttons.** Two round icon buttons bottom-right of the drill with no label and no tooltip. | `Tools` | Mystery meat. |

Everything above is fixable without touching content, routing, auth, or the question bank.

---

## 2. The direction: what "premium" means *for this product*

### 2.1 The reference class we are NOT copying

The default 2026 "premium" look is the mesh-gradient SaaS aesthetic — aurora blobs, film grain, glass
cards, Inter — used by Linear, Vercel and Stripe and now by everyone else. It is a genuinely good system
([Setproduct's Vercel breakdown](https://www.setproduct.com/blog/complete-guide-to-blueprint-grid-design),
[CSS-Tricks on grainy gradients](https://css-tricks.com/grainy-gradients/)), and it is **wrong here**.
Bolting an aurora onto a lamplit fantasy study hall would erase the one thing this product already has
that its competitors do not: an identity.

We keep the world. We raise its production value.

### 2.2 The reference class we ARE copying

Four sources, all of which handle "ornate but disciplined" better than SaaS does:

1. **Rare-book and museum digital collections** — deep grounds, gilded hairline rules, enormous margins,
   editorial type scale, one object per view. The New York Botanical Garden's system is the model:
   archival cues recomposed into a flexible modern grid rather than pastiched.
2. **Heritage-craft and luxury-goods sites** — restraint, cinematic pacing, one hero moment per page, and
   typography doing the work instead of effects. Awwwards juries in 2026 consistently note that the
   strongest entries "use trendy features with restraint — as seasoning, not the main course."
3. **High-end game journals** — *Hades*, *Disco Elysium*, *Baldur's Gate 3*. Ornament everywhere, but
   every piece of it obeys a grid and a material rule.
4. **Premium reading apps** — paper treated as a real material with real light on it.

### 2.3 The concept: four materials, one light source

> **The Illuminated Manuscript, lit by lamplight.**

Every surface in the app must declare which of four materials it is made of. Its fill, edge, shadow,
sheen and grain follow from that declaration — they are never chosen per-component again.

| Material | What it is | Used for | Behaviour |
|---|---|---|---|
| **Leather** | The tooled cover. Deep, matte, warm-black, fine grain. | App chrome: rail, headers, HUD, modals' backing | Absorbs light. Never glossy. Edges are a debossed groove, not a stroke. |
| **Paper** | The page. Cream, fibrous, slightly warm. | Every reading surface: passages, lessons, notes, explanations | Catches light. Has a soft top-edge highlight and a real drop shadow. Never has a gold border. |
| **Gilt** | Gold leaf on an edge or a letter. | Rules, active markers, credited answers, rank sigils, the one CTA per view | Only ever an *edge*, a *letter*, or a *seal* — never a large fill. Reflects; has a gradient across it, never a flat swatch. |
| **Lamplight** | The single warm light source, upper-left. | Not a surface — the rule that unifies the other three | Every shadow falls down-right. Every highlight is on the top-left edge. One light, one direction, no exceptions. |

That last row is the whole trick. The reason the current UI looks flat is that its shadows and highlights
have no shared light source, so surfaces do not read as objects.

---

## 3. Phase 0 — Foundation: the token layer

Nothing visual ships before this. Everything after it is cheap because of it.

### 3.1 Color → OKLCH

`tailwind.config.js` currently builds colours through a `tone()` helper over CSS variables. Keep that
indirection; change the colour space underneath it to **OKLCH**, which is perceptually uniform — the 500
step of every hue reads at the same brightness, which HSL never managed. Browser support is >96% and it
is Tailwind v4's native format
([Tailwind v4 announcement](https://tailwindcss.com/blog/tailwindcss-v4)).

Why it matters here specifically: the leather ramp (`950`→`600`) and the gold ramp are currently
hand-tuned hex values that drift in lightness, which is why some cards look muddier than their neighbours
at the same nominal step. In OKLCH we can hold L constant across a hue rotation and get a ramp that is
*actually* even.

Deliverable: `--leather-*`, `--paper-*`, `--gilt-*` regenerated as `oklch(L C H)` with L on a fixed ladder,
plus a documented rule for which L step is legal on which material. **Contrast ratios must be re-measured,
not assumed** — the existing comments in the config record real measurements (`#8a7856 measured 3.89:1 and
failed`); keep that discipline.

### 3.2 The elevation ladder (the highest-leverage single change)

Replace three ad-hoc shadows with a governed six-step ladder. Each step is a *pair*: a contact shadow
(tight, dark) plus an ambient shadow (wide, soft), because one shadow never reads as a real object.

| Step | Name | Used for | Contact | Ambient | Edge |
|---|---|---|---|---|---|
| 0 | `flush` | Backgrounds, inset wells | — | — | inset hairline |
| 1 | `resting` | Static cards, list rows | `0 1px 2px / .30` | `0 2px 6px / .18` | top hairline light |
| 2 | `raised` | Interactive cards, chips | `0 2px 4px / .34` | `0 8px 20px / .22` | top hairline light |
| 3 | `lifted` | Hovered card, active nav | `0 3px 6px / .38` | `0 16px 36px / .26` | + faint gilt rim |
| 4 | `floating` | Popovers, tooltips, drawers | `0 6px 12px / .42` | `0 28px 60px / .32` | + gilt rim |
| 5 | `overlay` | Modals, story overlay | `0 10px 20px / .48` | `0 48px 100px / .40` | + gilt rim + scrim behind |

Rules: elevation only ever changes by **one** step on interaction; nothing skips a step; a step-5 surface
must be accompanied by a scrim on everything below it.

### 3.3 Typography → an editorial scale

Keep the faces — Cinzel, IM Fell English SC, Newsreader, Inter, Atkinson Hyperlegible. They are a good,
distinctive set and replacing them would be change for its own sake. What is missing is a *scale* and
*roles*.

- **Move to variable versions** where they exist (Newsreader already is via `@fontsource-variable`). Cinzel
  ships a variable build; switching gets us real weight interpolation instead of two static cuts.
- **Fluid scale via `clamp()`**, one ratio (1.25 minor-third at body sizes, opening to 1.333 at display
  sizes so headlines get dramatic on wide screens without the body text ballooning):

  | Token | Role | Face | Size |
  |---|---|---|---|
  | `display-xl` | Landing hero only | Cinzel var. 600 | `clamp(2.75rem, 1.6rem + 5.2vw, 6rem)` |
  | `display-l` | Screen titles | Cinzel var. 600 | `clamp(2rem, 1.4rem + 2.6vw, 3.25rem)` |
  | `title` | Card headings | IM Fell SC | `clamp(1.15rem, 1.05rem + .5vw, 1.5rem)` |
  | `body-read` | Passages, lessons | Newsreader var. | `clamp(1.0625rem, 1rem + .35vw, 1.1875rem)` / 1.65 |
  | `body-ui` | UI copy | Inter | `.9375rem` / 1.5 |
  | `label` | Eyebrows, meta | IM Fell SC, `.18em` tracking | `.6875rem` |
  | `num` | Every figure | tabular-nums, `font-variant-numeric` | inherits |

- **Optical sizing.** Newsreader carries an `opsz` axis. Wire `font-optical-sizing: auto` so passage text
  at 19px and footnotes at 13px are actually different drawings, not one drawing scaled. This is a
  two-line change that no one can name but everyone feels.
- **Numerals.** Every score, timer, XP figure and question count must be `tabular-nums`, or numbers jitter
  as they tick. The `.num` class exists; enforce it.

### 3.4 Motion tokens

Replace 30 bespoke curves with a governed set, then express the existing animations in terms of it.
Durations from the current consensus: <100 ms reads instant, 100–300 ms is the transition sweet spot,
>500 ms feels slow; Material fixes 200 ms as the standard reference and 300 ms for screen changes.

| Token | Value | Use |
|---|---|---|
| `--dur-instant` | 90 ms | Press feedback, checkbox |
| `--dur-quick` | 160 ms | Hover, focus ring, tooltip |
| `--dur-base` | 240 ms | Card enter/exit, tab change |
| `--dur-screen` | 320 ms | Route transition, drawer |
| `--dur-cinematic` | 620 ms | Story beat, boss reveal, seal stamp |
| `--ease-out` | `cubic-bezier(.22, 1, .36, 1)` | Anything entering |
| `--ease-in` | `cubic-bezier(.4, 0, .7, .2)` | Anything leaving |
| `--ease-inout` | `cubic-bezier(.65, 0, .35, 1)` | Same element changing state |
| `--spring-soft` | `stiffness 260, damping 30` | Cards, sheets |
| `--spring-snap` | `stiffness 420, damping 26` | Choice selection, XP tick |

Springs come from `motion` (already a dependency) and are the right tool for anything the user *caused*,
because a spring responds to velocity and never looks canned. Bézier curves stay for anything the system
initiated.

**One hard rule:** every animation over `--dur-base` must be gated on `prefers-reduced-motion`. Not
reduced — *skipped*.

### 3.5 Grid and rhythm

- One **8px baseline**; every vertical measure is a multiple. Current spacing is ad-hoc.
- A **12-column editorial grid** with a `--measure` of 68ch for reading columns. Passages should never run
  wider than that regardless of viewport — right now they stretch.
- **Three densities**, declared per screen, not per card: `dense` (Stats tables), `default` (Camp, Study),
  `editorial` (passages, lessons, Landing). Density sets padding and line-height together.

---

## 4. Phase 1 — The component vocabulary

### 4.1 The library stack

Additions, with justification and cost. Everything listed is MIT/free.

| Library | Why | Cost (gz) | Risk |
|---|---|---|---|
| `@base-ui/react` | Dialog, Popover, Tooltip, Select, Tabs, Slider — accessible primitives, unstyled. **This is what kills the native `<input type="date">` and the mystery-meat buttons.** Base UI is now the more actively maintained primitive layer and is shadcn's default as of July 2026. | ~41 kB gzip, lazily loaded (see note) | Low. Unstyled — our design survives intact. |
| ~~`lucide-react`~~ | **Not adopted.** See the note below. | — | — |

> **Two corrections made during Phase 1.**
>
> The package is `@base-ui/react`, not `@base-ui-components/react`. The latter
> name is frozen at `1.0.0-rc.0`; the project was renamed and the live releases
> ship under the short name (1.8.0 at time of writing). Note also that Base UI
> has **no date picker** — `DateField` is therefore three `Select`s, which is
> the right control for a date months away and matches how Auth already asks
> for a birth date. Its real weight is closer to 41 kB gzip than the 14 kB
> estimated here, but Vite splits it into its own chunk that only loads on the
> three screens with a `Select` on them.
>
> Lucide was **not** adopted. This plan overlooked `src/components/Icon.tsx`:
> the app already has a 40-icon house set drawn on the same 24×24 grid and the
> same 1.7px round-capped stroke as `NavGlyph`, written expressly so the app
> never falls back to a character or an emoji. Adding Lucide beside it would
> have reproduced the exact inconsistency this plan is trying to remove, one
> level up — two stroke weights, two corner treatments, two idioms. Phase 1
> instead added the three missing marks (`chevronLeft` / `chevronRight` /
> `chevronUp`) to the existing set, which covered all 76 replacements.
| `@number-flow/react` | Animated tabular numerals for XP, score, streak, question counts. Turns a static number into a *value that changed*. | ~5 kB | Low |
| `vaul` | Mobile bottom sheets — replaces the current mobile drawer. | ~6 kB | Low |
| `lenis` | Momentum scrolling — **landing route only**, never in-app. | ~4 kB | Medium: must be disabled under reduced-motion and must not fight the runner's keyboard scrolling. |
| `gsap` + ScrollTrigger | The landing scroll score. Core + ScrollTrigger are free as of 2025. | ~40 kB, lazy on `/` only | Medium. See guardrail below. |
| `postprocessing` / `three` / `@react-three/fiber` | Only if we take the 3D sigil option in §6. | ~150 kB, lazy | High — gated behind Phase 5. |

**Do NOT add:** shadcn/ui (its whole value is a neutral default look; we have a strong one, so it is pure
cost), Framer Motion *in addition to* `motion` (same library, one is the old name), any component kit with
opinionated styling, GSAP's paid plugins (SplitText, MorphSVG — Club GSAP only).

**Guardrail on GSAP + Lenis:** they must share one ticker. The standard failure is two competing
`requestAnimationFrame` loops, which produces the jitter people blame on smooth scroll. Set
`autoRaf: false` on Lenis and drive it from `gsap.ticker`. Keep total ScrollTriggers under 30 and animate
only `transform`/`opacity`; done that way it has no measurable effect on LCP or CLS.

### 4.2 Icon policy — this is the "no bad characters" rule

The instruction to stop using bad characters and use design libraries instead is right, and the split is:

- **Identity glyphs stay hand-drawn.** `NavGlyph.tsx`'s tent, map, book, sword, shield, crown are an
  *asset*, not a liability — they are the reason the rail looks like this product and not like every other
  React app. They get refined (consistent 1.75px stroke, 24px grid, aligned optical weight), not replaced.
- **Utility icons come from the house set** (`<Glyph>`, `src/components/Icon.tsx`) — see the
  correction above. Close, chevron, external-link, volume, settings, flag, bookmark,
  search, check. These currently include a few text glyphs and arrows typed as characters (`▸`, `←`, `✦`,
  `·`) — those are the "bad characters". They render differently on every OS, they are not sized to the
  type, and they are read aloud by screen readers.
- **Never a raw Unicode arrow or bullet in a component again.** One lint rule can enforce this: fail on
  `▸ ▶ ← → ✦ ★ ·` appearing inside JSX text in `src/components` and `src/screens`. Content files are
  exempt — the question bank legitimately contains typographic characters.

### 4.3 The surface primitives

Three components replace the current ad-hoc `.panel` / `.sheet` / `.story-card`:

```
<Leather elevation={1..5} inset?>   // chrome
<Paper density="default|editorial"> // reading
<Gilt as="rule|seal|edge">          // accent
```

Each reads its fill, edge treatment, grain overlay and shadow pair from the material tokens. A component
may not pass a raw `boxShadow`, `border`, or background colour. That single restriction is what will make
the app look designed rather than assembled.

### 4.4 Grain and light, done correctly

- **One** grain texture, generated once as an inline SVG `feTurbulence` at ~3% opacity, applied via a
  single `::after` on the material components — not per-screen backgrounds. Grain breaks colour banding on
  large fills and is the difference between "obviously CSS" and "a real material".
- **Lamplight highlight**: a `1px` inset top highlight at 8–12% white on Paper and Gilt, absent on Leather.
- **No blur-heavy glass.** `backdrop-filter` on more than two elements at once is a measurable frame cost
  on mid-range Android, and frosted glass is off-concept for leather and paper anyway. Exception: the
  modal scrim.

---

## 5. Phase 2–4 — Structure, screen by screen

This is the "advanced website structure" part. The rule throughout: **one focal object per view**, and
everything else is subordinate to it.

### 5.1 Landing — from a page to a scored narrative

Today it is a vertical stack of sections with a big illustration behind the top one. Rebuild it as **five
acts on a scroll score**, using CSS scroll-driven animations as the base layer and GSAP only where the
timeline needs programmatic control. Scroll-driven animations (`animation-timeline`, `scroll()`, `view()`)
are cross-browser as of 2026 at ~84% global support with Chrome/Edge 115+, Firefox 132+, Safari 18+ —
which means they are the default and GSAP is the exception, not the reverse.

| Act | Content | Technique |
|---|---|---|
| **I — Arrival** | The sunset ridge. Title. One CTA. | Pinned hero. **Fixes defect #3**: a bottom-anchored radial scrim (`oklch` leather at 0→85%) behind the type block, plus a text-shadow ladder. Illustration parallaxes in 3 depth planes at 0.4/0.7/1.0 scroll rate. |
| **II — The claim** | "1,407 questions. Every answer explained." | The number counts up once on enter via NumberFlow. The three sub-stats reveal on a `view()` timeline, staggered 60 ms. |
| **III — The proof** | A live question, playable right there. | Already exists as `TryQuestion`. Promote it to the emotional centre: full-bleed Paper sheet, the explanation panel sliding up as a Gilt-edged sheet on answer. **This is the single most persuasive thing on the page and it is currently buried.** |
| **IV — The world** | The four regions. | Horizontal scroll-snap band of four painted plates, each with its skill count. Not a carousel with arrows — a scroll region with snap points and a progress rule. |
| **V — The ask** | Sign up / begin. | Quiet. Deep leather, one gilt CTA, the trademark disclaimer set properly rather than as an afterthought. |

Additionally: **cross-document View Transitions** for landing → app, so entering the realm is a match-cut
rather than a white flash. Supported in Chrome/Edge/Safari 18+; degrades to the current behaviour
elsewhere.

### 5.2 Shell — rail, canvas, and a command palette

The rail from the last pass is structurally right. What it needs:

- Elevation 2 with a **vertical gilt hairline** on its right edge rather than a border-right.
- The active marker becomes a **light source**: a soft gilt glow bleeding right from the marker, not just
  a 3px bar.
- The bank badge and player block get a debossed well (`elevation 0, inset`) so the rail reads as *tooled
  leather with things set into it*.
- **A command palette** (`⌘K` / `Ctrl+K`), built on Base UI. Jump to any topic, any lesson, any of the 37
  landmarks, resume the last drill, start the daily. This is the single biggest perceived-sophistication
  win per line of code, and it also fixes a real problem: 20 topics per section is too many for a grid.
- **Content canvas**: the page column gets `max-inline-size: var(--measure-wide)` and centres. Full-bleed
  cards on a 1440px screen are what makes the app feel like a form.

### 5.3 Camp — one hero, then the rest

Currently five equal-weight cards. Restructure to:

- **The single next action**, as a large Paper card at elevation 3 with the day's actual work in it —
  large type, a gilt CTA, the estimated minutes. This is the only elevation-3 object on the screen.
- Everything else drops to elevation 1 and half the type size: streak, weekly progress, the quest teaser,
  the placement nudge.
- **Fix defect #1 here first.** The XP burst must render in a portal above the layout, be bounded to the
  XP row, and never overlap text. Better: replace the confetti with a **gilt fill sweeping the progress
  rail** plus a NumberFlow tick. Quieter, more expensive-looking, and it cannot collide with anything.

### 5.4 The question runner — the crown jewel

This is where users spend 90% of their time, so it gets the most care.

- **Two materials, clearly separated.** The passage is Paper (elevation 1, no gold border, real page
  shadow, 68ch measure, optical-sized Newsreader). The task column is Leather (elevation 0, inset well).
  Right now both are the same cream, which is why the eye has nowhere to land.
- **Remove all floating particles from this screen.** Non-negotiable. The reward moment moves to the
  choice row itself: correct answers get a gilt edge that draws on in 240 ms and a single soft seal stamp;
  wrong answers get a 90 ms shake at 3px and a red hairline. No confetti over text, ever.
- **Choice rows** become real objects: elevation 1 → 2 on hover, 240 ms; the letter badge is a debossed
  gilt disc; the selected state raises to 3 with a gilt rim.
- **The explanation becomes a sheet**, not an inline expansion. It rises from the bottom of the task
  column over 320 ms with `--ease-out`, carrying "WHY B IS RIGHT" as a gilt-ruled heading. Inline
  expansion causes the layout jump that currently makes the reveal feel cheap.
- **A progress rail** down the left edge of the task column: 10 ticks, filled gilt as you go, current one
  slightly larger. Replaces "1/10" as the primary signal.
- **Label the floating tools** (defect #8) with Base UI tooltips, and move them into the header where they
  belong.

### 5.5 Study, Stats, Duels

- **Study**: the 37 landmarks become a **vertical route** with a gilt thread connecting them, not a list of
  cards — cleared nodes are sealed discs, the current one glows, locked ones are debossed and unlit. Same
  data, same logic; it just becomes a *path* again without a pannable map.
- **Stats**: one hero metric (projected score) at `display-l` with a sparkline, then small multiples
  beneath. Currently a uniform card grid where the most important number is the same size as the least.
  Charts should follow the project's dataviz rules — one axis, never dual, categorical hues assigned in
  fixed order, and a validated palette.
- **Duels/Boss**: this screen is closest to right already. It gets the elevation ladder, the motion
  tokens, and a proper cinematic reveal on the `--dur-cinematic` track.

---

## 6. Phase 5 — Depth and 3D: where it earns its place

The honest answer to "should this site use 3D": **almost nowhere, and spectacularly in two places.**

### 6.1 Where 3D does NOT belong

Not in the app shell, not on Camp, not in the runner, not behind Stats. A study tool's job is to be fast
and calm; a persistent WebGL context costs battery, memory and a GPU process for zero learning value. The
award-winning-site consensus is the same point in different words: use the technique as seasoning.

### 6.2 Where it does — two moments, in priority order

**A. The landing hero, as layered depth — not a 3D scene.**
Take the existing painted ridge, cut it into 4–5 depth planes in the source art, and drive them with
CSS 3D transforms on a scroll timeline plus a subtle pointer-parallax. Cost: **zero new dependencies,
zero WebGL, ~40 lines**. It delivers 80% of the perceived depth of a real 3D scene. Do this first and
measure whether anything more is even wanted.

**B. The rank sigil, as a real object.**
The seven rank sigils are the emotional payoff of the whole progression, and they are currently flat SVG.
A gilded medallion rendered in WebGL — real metal shading, an environment map baked from the lamplight,
tilting to pointer or device orientation — is a genuine "how did they do that" moment, and it appears on
exactly two surfaces (rank-up and the player block). Scope it to a single mesh with a matcap or a small
baked HDR; that avoids a model pipeline entirely.

Optional third: the boss reveal. Only after A and B ship and measure well.

### 6.3 Budgets and fallbacks — binding

| Constraint | Value |
|---|---|
| Total 3D payload | ≤ 220 kB gz, **lazy-loaded, route-split, never in the app-shell chunk** |
| Draw calls | ≤ 60 |
| Frame budget | 60 fps on an M1 Air; ≥ 30 fps on a 2021 mid-range Android |
| Context policy | One WebGL context in the app at a time; disposed on unmount, verified with a leak test |
| Renderer | WebGL2. **Not WebGPU** — R3F does not fully support the WebGPU renderer yet, so it would mean two code paths for a 3–5× gain we do not need at this scale |
| Textures | KTX2/Basis; geometry Draco-compressed if any model is used at all |
| Fallback ladder | WebGL2 → static poster PNG. Trigger the poster on: no WebGL, `prefers-reduced-motion: reduce`, `navigator.hardwareConcurrency ≤ 4`, `saveData`, or a first-frame budget miss |
| Accessibility | The 3D layer is `aria-hidden` and purely decorative. No information exists only in the 3D layer. |

If A alone lands well, **B is optional**. That is the correct order of operations: cheap depth first,
measure, then decide whether to pay for WebGL.

---

## 7. Motion choreography

Beyond the tokens, three rules make motion feel authored rather than applied:

1. **Origin.** Things enter from where they came from. The explanation sheet rises from the choice you
   clicked. A drawer comes from its edge. A modal scales from 0.96 with the scrim, never from 0.
2. **Stagger, don't animate en masse.** Lists reveal at 40–60 ms per item, capped at 6 items of stagger —
   past that it reads as slow.
3. **One thing moves at a time.** If the page is transitioning, nothing inside it animates.

Route transitions upgrade from the current cross-fade to View Transitions with named shared elements: the
topic chip you clicked *becomes* the drill header. That is the effect people describe as "expensive" and
it is now a platform feature rather than a library.

---

## 8. Guardrails — the part that keeps this from rotting

These become build gates alongside `check:content`:

| Gate | Rule |
|---|---|
| **No raw shadows/colours** | Lint fails on `box-shadow:`/`border-color:` literals in `src/components` and `src/screens` — must come from tokens. |
| **No bad characters** | Lint fails on decorative Unicode glyphs in component JSX (content files exempt). |
| **No native form controls** | Lint fails on bare `<input type="date|range|color|file">` and unstyled `<select>`. |
| **Reduced motion** | A test asserts every animation over 240 ms is inside a `prefers-reduced-motion` guard. |
| **Bundle budget** | App-shell chunk ≤ 220 kB gz (currently ~185 kB excluding content); 3D chunk ≤ 220 kB gz and must not be reachable from the shell's import graph. |
| **Contrast** | Every token pair used as text-on-surface measured ≥ 4.5:1, recorded in a comment as the config already does. |
| **A11y** | Every interactive element reachable and operable by keyboard; the command palette, sheets and dialogs get focus traps for free from Base UI. |

---

## 9. Phasing

Ordered so that value lands early and nothing is blocked on 3D.

| Phase | Contents | Ships what | Risk |
|---|---|---|---|
| **0. Foundation** | OKLCH tokens, elevation ladder, type scale, motion tokens, grain + lamplight, 8px baseline | Nothing visible alone — but every later phase becomes small | Low |
| **1. Materials** | `.mat-leather` / `.mat-paper` / `.mat-gilt-rule`, with `.panel`/`.sheet` re-pointed at them, Base UI in, native controls out, every decorative glyph replaced | The whole app gains depth in one commit | Low |
| **2. The runner** | Two-material split, particles removed, choice objects, explanation sheet, progress rail, labelled tools | The screen users actually live in | Low |
| **3. Shell & Camp** | Rail as tooled leather, command palette, content canvas, Camp's single-hero restructure, XP burst replaced by the gilt sweep | Daily-use polish + the ⌘K moment | Medium (palette is new surface area) |
| **4. Landing** | Five-act scroll score, hero scrim, layered parallax depth, `TryQuestion` promoted, view transitions | First impression, and the conversion surface | Medium (GSAP/Lenis discipline) |
| **5. Study & Stats** | Landmark route with the gilt thread, editorial stats with one hero metric | Structure work | Low |
| **6. 3D (optional)** | Rank sigil as a real gilded object; boss reveal only if the sigil measures well | The "how did they do that" moment | High — strictly gated on §6.3 |

Phases 0–2 are the ones that change the verdict. If only three phases ever ship, ship those.

---

## 10. Explicitly out of scope

- Mesh gradients, aurora blobs, glassmorphism — off-concept (§2.1).
- shadcn/ui as a component kit.
- A CSS-in-JS runtime, a new build tool, or a framework change.
- Rewriting the question bank, the routing, auth, or Supabase sync.
- Anything paid: no Club GSAP plugins, no paid icon sets, no hosted 3D editors.
- Replacing the illustrations. They are an asset. The plan raises the *chrome* to their level, not the
  reverse.

---

## 11. Decisions I need from you

1. **How far does the 3D go?** My recommendation: ship §6.2A (layered CSS depth, free) in Phase 4, and
   treat the WebGL rank sigil as a separate go/no-go after it.
2. **Tailwind v4?** The token work in Phase 0 is significantly cleaner on v4's `@theme` + CSS-variable
   model, but it is a real migration with 2–5% colour shifts and a config rewrite. We can do Phase 0 on
   v3 and migrate later; it just means doing some of it twice.
3. **Command palette — in or out?** It is the largest new surface in the plan and the biggest perceived
   sophistication gain. It is also the easiest thing to cut.
4. **Landing smooth-scroll?** Lenis is lovely and it is also the most common source of "why does this site
   feel broken on my trackpad". I lean yes, landing-only, disabled under reduced-motion.

---

## Sources

Research consulted for this plan:

- [Awwwards — winning websites](https://www.awwwards.com/websites/) and
  [Best award-winning websites of 2026, judged by a juror](https://www.hontran.dev/blog/best-award-winning-websites-2026)
- [Top 10 web design trends 2026](https://reallygooddesigns.com/web-design-trends-2026/)
- [Tailwind CSS v4.0 announcement — OKLCH and CSS-first tokens](https://tailwindcss.com/blog/tailwindcss-v4)
- [Design tokens that scale: Tailwind v4 + CSS variables](https://www.maviklabs.com/blog/design-tokens-tailwind-v4-2026/)
- [CSS scroll-driven animations: scroll timelines guide (2026)](https://cssawwwards.com/blog/css-scroll-driven-animations-guide-2026)
- [View Transitions API and CSS scroll-driven animations: the browser wins of 2026](https://www.frontendhorizon.com/blog/view-transitions-api-and-css-scroll-driven-animations-the-browser-wins-of-2026)
- [Scroll-driven view transitions: native CSS that replaces GSAP and Framer Motion](https://mintec.co/blog/scroll-driven-view-transitions-css-2026/)
- [React Three Fiber vs Three.js (2026)](https://www.creativedevjobs.com/blog/react-three-fiber-vs-threejs)
- [Three.js vs React Three Fiber vs Babylon.js 2026](https://www.pkgpulse.com/guides/threejs-vs-react-three-fiber-vs-babylonjs-3d-webgl-2026)
- [Three.js in production 2026: WebGPU, perf and fallback](https://appscale.blog/en/blog/threejs-production-3d-web-2026-webgpu-realtime-standards)
- [Lucide vs Heroicons vs Phosphor Icons 2026](https://www.pkgpulse.com/guides/lucide-vs-heroicons-vs-phosphor-react-icon-libraries-2026)
- [shadcn/ui changelog — Base UI as the default (July 2026)](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default)
- [Radix vs Base UI: which headless React library in 2026](https://www.shadcndeck.com/blog/radix-vs-base-ui)
- [Top headless UI libraries for React in 2026](https://www.greatfrontend.com/blog/top-headless-ui-libraries-for-react-in-2026)
- [Smooth scrolling with Lenis and GSAP — 2026 guide](https://devdreaming.com/blogs/nextjs-smooth-scrolling-with-lenis-gsap)
- [Fixing jittery scroll in React with Lenis and GSAP](https://ashar-dev.vercel.app/articles/how-to-fix-jittery-scroll-in-react-typescript-a-guide-to-lenis-gsap/)
- [Grainy gradients — CSS-Tricks](https://css-tricks.com/grainy-gradients/) and
  [CSS noise textures guide](https://ultimatedesigntools.com/blog/css-noise-textures-guide/)
- [Complete guide to blueprint grid design (the Vercel aesthetic)](https://www.setproduct.com/blog/complete-guide-to-blueprint-grid-design)
- [Easing curves are a design language](https://www.baraa.app/blog/easing-curves-are-a-design-language)
- [Motion budget: UI animation ratios that actually work](https://www.72technologies.com/blog/motion-budget-ui-animation-ratios)
- [Micro-interactions in UI: when to animate and how long](https://artofstyleframe.com/blog/micro-interactions-ui-when-to-animate/)
- [Motion — Material Design 3](https://m3.material.io/styles/motion/overview/how-it-works)
- [Fontfabric — top 10 design and typography trends for 2026](https://www.fontfabric.com/blog/10-design-trends-shaping-the-visual-typographic-landscape-in-2026/)
- [Web design trends 2026: kinetic type, broken grids, visual personality](https://elements.envato.com/learn/web-design-trends)
