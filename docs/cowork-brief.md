# Brief: audit ACT Command for bugs, and design the motion that makes it read as a game

Paste everything below this line into cowork.

---

## Who you are and what I want

You are auditing a shipped web app and designing the next layer of its motion
design. Two jobs, in this order:

1. **Find bugs.** Especially rendering, animation, layout and state bugs. I want
   the ones that survive a casual look — the kind that only show up at a
   different zoom, a different screen size, on a second visit, or after an hour
   of use.
2. **Design animation.** The bar: *a stranger who lands on this should assume
   it is a game, not a study app.* Right now it is close. I want a concrete,
   prioritised, implementable list that closes the gap.

Be specific and be concrete. "Add more particle effects" is useless to me.
"The waterfall at `x%,y%` has spray but no basin turbulence; add N ellipses at
these coordinates with this keyframe and this duration" is what I want.

---

## What the app is

**ACT Command** — free ACT test prep, built as a hand-drawn fantasy quest. A
student crosses four regions of a painted world map, clearing 37 landmarks
(each: a lesson, then a quiz), fighting four region guardians, and finishing at
a timed mock exam. 754 questions, 60 lessons, 27 passages. Audience is **13–17
year olds**. It is free, has no ads and no trackers.

The fiction: a plague called **the Grey** settles over the land until nobody
remembers what was underneath. Four regions are each held shut by a **Seal**
(the guardians). Break all four and the Grey lifts. The mist you see over the
map is the Grey; it thins as you clear the region under it.

The four regions, stacked vertically on one image:

| Region | Subject | Vertical band (% of map) |
| --- | --- | --- |
| The Grammar Village — farmland, cottages, river | English | ~0–27% |
| The Enchanted Woods — dense canopy, mushrooms | Reading | ~19–47% |
| The Number Desert — canyon, dunes, volcano | Math | ~39–65% |
| The Science Cliffs — coast, bay, lighthouse, citadel | Science | ~55–87% |

---

## Stack and hard constraints

Read these before proposing anything. Several are non-obvious and each one has
already caused a real bug in this codebase.

**Stack:** Vite 8, React 18, TypeScript (strict, `noUnusedLocals`), Tailwind 3,
[Motion](https://motion.dev) v12. Static SPA on Vercel. Hash router. Optional
Supabase backend. Hand-written service worker, no Workbox.

**1 — The map's world layer is CSS-transformed for pan and zoom. Viewport units
inside it are always a bug.** `vw`/`vh` describe the viewport; the layer they
land in has been scaled and translated. A ship animated `112vw` sailed across
the entire map including three regions of dry land, and the distance changed
with window size and zoom. Birds and clouds had the same bug. **Everything that
moves relative to the map must be expressed in map units** — a percentage of the
map image, or `translateX(100%)` of an element whose own width is a map
percentage (the `.mapfx-crossing` track pattern). Flag every instance you find.

**2 — `.mapfx > span` sets `transform: translate(-50%, -50%)` for centring.**
Any `@keyframes` that sets `transform` without re-including that translate makes
the element jump by half its own size the moment the animation starts. Check
every keyframe against the base rule of the element it targets. Note that a
child of a `.mapfx > span` does *not* inherit the centring, so bare `scale()` on
a child is correct — don't report those as bugs.

**3 — Compositor-only properties.** Animate `transform` and `opacity`. `filter`
and `clip-path` are acceptable sparingly. **Never** animate `left`, `top`,
`width`, `height`, `margin`, `background-position`, or `box-shadow` — they force
layout or paint every frame and this map can have 60+ animated elements alive at
once on a mid-range phone.

**4 — `prefers-reduced-motion: reduce` kills every animation globally** (see the
bottom of `src/index.css`). Anything you design must still make sense
completely still. If an element is only visible mid-animation, it vanishes for
those users — that is a bug, not a trade-off.

**5 — Flash safety is a hard requirement, not a nicety.** The audience is
minors and WCAG 2.3.1 caps flashing at **three flashes per second**. There is
already lightning-like storm light inside the Grey. Audit every flashing,
strobing or rapidly-pulsing effect against that limit and tell me the measured
rate.

**6 — Contrast is already at WCAG AA across 799 measured text/background
pairs.** Do not propose anything that puts text over moving imagery without
saying how it stays legible. The region name plaques survive over the painted
map only because of an 8-direction text-shadow halo.

**7 — Dependencies.** `npm audit` is currently at **zero** vulnerabilities and I
want it kept there. Motion is already installed and is the right tool for React
UI transitions. If you propose a new library, justify it against what Motion and
plain CSS already do, and state its bundle cost and licence. GSAP's paid plugins
are a non-starter for a free app.

**8 — Bundle and offline budget.** The service worker precaches ~2.2 MB (app +
754 questions + artwork) so the whole thing works offline. Any new asset adds to
that. Prefer inline SVG and CSS over image files.

**9 — The map is one flat image.** `public/art/world-map.webp`, 768×1376.
Nothing can currently move *behind* or *between* terrain, because there is no
behind. If your best ideas need layer separation, say so explicitly and specify
exactly what layers you'd need — I can commission them.

---

## Where things live

```
src/
  game/
    MapFx.tsx          all scenery motion. One component per effect,
                       memoised, no dependency on app state
    AdventureMap.tsx   pan/zoom, pins, the traveller, HUD, keyboard control
    DiscoveryLayer.tsx the Grey (mist + storm), the 14 findable discoveries
    mapData.ts         pin coordinates for all 37 zones, as % of the image
    story.ts           the 9-quest chain and Wizzy's dialogue
    StoryOverlay.tsx   typewriter scenes, choices, screen shake
    Wizzy.tsx          the guide's standing tip bubble
    BossArt.tsx        the four guardians as SVG, with hit/lunge/defeat states
    bosses.ts, discoveries.ts, Sigils.tsx, MapJournal.tsx, RoadChooser.tsx
  index.css            every keyframe and effect class (~1300 lines)
  components/          QuestionRunner, Feedback (XP pops, confetti), ui, Shell
  screens/             Landing, Home, Zone, Boss, Drills, Tests, Notes, Stats
```

---

## Motion that already exists — do not re-propose these

**Scenery** (`MapFx.tsx` + `.mapfx-*` in `index.css`): falling water and spray,
specular drift on open water, shore foam, chimney smoke, lamplight coming up in
cottage windows, gusts over the fields, leaves lifting off the forest canopy,
glowing mushrooms, fireflies, butterflies, crystal glints, volcano embers, heat
haze, desert dust, tumbleweed, a sweeping lighthouse beam, moored boats rocking,
a ship under sail crossing the bay, rain squalls over the water, an aurora, a
banner over the citadel gate, birds with independently-clocked wingbeats,
drifting clouds that cast moving shadows on the terrain, shooting stars.

**The Grey** (`DiscoveryLayer.tsx`): mist banks that thin as a region clears,
storm light that never quite becomes lightning, tendrils reaching out of the
bank and being drawn back.

**Interface:** page transitions, XP pop-ups, confetti, a rank-up moment,
toast notifications, screen shake on story beats (soft and hard), the traveller
walking between landmarks on a spring, guardian dormant/awake/felled states,
typewriter dialogue.

---

## Bug classes already found — look for more of the same

I found and fixed all of these. Each suggests a family. Hunt the families.

- **Coordinate-space errors.** `vw` inside a transformed layer (3 instances,
  ship/birds/clouds). Look for any other place where a distance, size or
  position is expressed in the wrong space.
- **Dropped base transforms in keyframes** (see constraint 2).
- **Animation gating render.** `AnimatePresence mode="wait"` once froze every
  route, because requestAnimationFrame runs at **0 fps in a background tab**, so
  the exit animation never completed and the next screen never mounted. Look for
  anything where a state change waits on an animation.
- **Split module instances.** Importing Motion from two entry points
  (`motion/react` and `motion/react-m`) creates separate presence contexts that
  silently do not talk to each other. All Motion imports must come from one
  place.
- **Cache/identity mismatches.** A service worker stored every asset and then
  matched none of them, because the host sends `Vary: Origin` and the worker's
  own fetches carry that header while a browser's module request does not.
  Invisible online, fatal offline.
- **Two things mounting at once.** The road chooser and the opening story fired
  simultaneously; the guide appeared twice on screen with the same caption.
  Check every conditional mount for overlap.
- **Data that reads as internal.** Topic names were fragmented four ways
  (`commas`, `Commas`, `COMMA CASTLE`, `comma_castle`) and shown to users.

**Also specifically check:**

- Behaviour at zoom extremes and after panning to each corner — effects
  positioned in the wrong space only misbehave away from the default view.
- Mobile: touch pan/pinch, safe-area insets, whether 60+ animated elements hold
  frame rate on a mid-range phone.
- Effects whose z-index puts them over or under the wrong thing (mist over pins,
  clouds under terrain).
- Effects placed on the wrong terrain — anything on land that should be on
  water, or in the sky that should be on the ground. Cross-check every
  coordinate in `MapFx.tsx` against what is actually painted at that spot in
  `public/art/world-map.webp`.
- Animation clocks that are all in phase, so a group pulses in lockstep instead
  of looking natural.
- `will-change` misuse — it should be applied sparingly and never inside
  keyframes.

---

## The bar for "mistaken for a game"

Judge against real games, not against other web apps. What I think is missing —
challenge this, add to it, tell me if I'm wrong:

**Response to input.** Right now the map mostly plays at you rather than
reacting to you. Games acknowledge every input within ~100ms. Hover, press,
drag, release, zoom — what should each of those do that it currently doesn't?

**Weight and follow-through.** Things start and stop too cleanly. Real motion
overshoots, settles, has secondary motion trailing the primary. The traveller
walks on a spring; almost nothing else does.

**Anticipation.** Before a big moment — a guardian waking, a Seal breaking, a
region clearing — the world should tell you it is coming.

**Reward escalation.** Clearing a landmark, felling a guardian and lifting the
Grey from a whole region should feel like three different sizes of event. Right
now they are closer together than they should be.

**Ambient life on a long cycle.** Something that only happens every few minutes
is what makes a world feel real rather than looped. Day/night is the obvious
one and would be a large change — tell me if it is worth it.

**Continuity between screens.** Entering a landmark from the map is currently a
cut. Games rarely cut.

**Sound.** Every cue is synthesised at runtime in WebAudio, no audio files. Is
there motion that should be sound-coupled, and vice versa?

---

## What I want back

A single prioritised document. For every item:

**Bugs:**
- File and line
- What is wrong, in one sentence
- How to reproduce, exactly — including zoom level, viewport size and route
- Severity, and whether it is visible to a normal user or only under inspection
- The fix, concretely

**Animation proposals:**
- What it is and where it goes (map coordinates as % where relevant)
- Why it earns its place — what it tells the player
- Implementation: CSS keyframes or Motion, actual property values, duration,
  easing, how instances are de-phased
- Cost: elements added, whether it stays on the compositor, any new asset
- How it behaves under `prefers-reduced-motion`
- Priority: what you would do first if you could only do five things

Rank everything by **impact per unit of effort**. If something is high impact
but needs the map split into layers, say so and put it in its own section — I
can commission that artwork, but I need to know exactly what to ask for.

Please be blunt. If something in the existing motion is bad, or the whole
direction is wrong, say that instead of being agreeable.
