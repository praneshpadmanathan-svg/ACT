# Game feel — the layer the inventory doesn't have

`animation-inventory.md` is 278 items over 24 sections and it is good. It is also
almost entirely **motion applied to DOM that already exists** — easing, stagger,
spring physics, transitions between things the app already draws.

That is the right first layer and it is not the layer that makes something feel
like a game. This document is the second one. It covers three things the
inventory does not:

- **Systems** that individual effects plug into, rather than effects built one at
  a time. A screen shake written into `Boss.tsx` is a screen shake; a shake bus
  every surface can call is game feel.
- **Assets** — sprite sheets, particle textures, overlay grain, audio beds. The
  inventory assumes everything is CSS. Most of what reads as "a real game" is
  drawn by an artist and played back as frames.
- **Sequencing.** The inventory has an "if you only do ten"; it has no build
  order, no dependency graph, and no statement of what has to exist before item
  N is worth attempting.

Numbering here continues from the inventory: new items start at **279**, so the
two documents can be read as one list.

---

## Three things separate "animated" from "game"

Worth stating plainly, because it decides what is worth building.

**1. Impact is simultaneous and multi-sensory.** In a game, a hit is not an
animation — it is five things inside 100ms: the frame freezes, the screen kicks,
a flash pops, particles throw, a sound fires. Individually each is trivial.
Together they read as force. The app currently fires the sound and, sometimes,
one visual, and never at the same frame. **This is the single highest-leverage
change in this document** and it is Phase 1.

**2. Effects are drawn, not approximated.** A CSS radial-gradient pulse is a
programmer's drawing of an impact. A 16-frame sprite sheet of an actual impact,
drawn by someone who draws impacts, is an impact. This is where "I can get it off
the internet" pays: the app already has a working art pipeline
(`art-src/` → `scripts/build-*.mjs` → `public/art/` + a typed manifest), so
dropping in sourced sheets is a solved problem, not a new one.

**3. Something directs the camera.** Games move the camera on the player's
behalf — pull back for scale, punch in for a hit, drift during dialogue. The map
has a camera (`view.x/y/scale` in `AdventureMap.tsx`) and nothing ever drives it
except the player's own finger.

---

## What has shipped since the inventory was written

Do not rebuild these.

| Item                                | Where                                      | Covers                                                                                              |
| ----------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Map effect culling by camera span   | `src/game/mapView.tsx`, `<Band>`           | §273, §274 in intent — a camera-span cull, not `IntersectionObserver`. 333 → 243 animated elements. |
| Fog rebuilt on `transform` only     | `.mapfx-grey-*` in `index.css`             | §272. Was animating `background-position`; 9.1 viewports of blurred repaint → 0.9 composited.       |
| Camera transition responsiveness    | `AdventureMap.tsx`, `cameraLive`           | Not in the inventory. Wheel/glide no longer fight a 500ms ease.                                     |
| Story beats change the whole screen | `story.ts` `BeatMood`, `[data-story-mood]` | §18 in spirit — the overlay stopped being a curtain over the map.                                   |
| Title card chains into the scene    | `StoryOverlay.tsx`, `storyTitleOut`        | §18.                                                                                                |
| Sound palette re-pitched            | `src/lib/sfx.ts`                           | Not in the inventory. Register, interval and timbre all moved off "children's toy".                 |

Five earlier items were shipped before that pass; see the inventory's own notes.

---

# Part 1 — Six systems, built before anything else

Nothing in Part 3 is worth building until these exist, because every item in Part
3 is one call into one of them. Build these and the catalogue becomes an
afternoon each; skip them and every item is a bespoke piece of code in a screen
that shouldn't own it.

## 279. The juice bus

One module, one API, imported anywhere. This is the spine.

```
src/lib/juice.ts

juice.hit({ power: 0.6 })      // shake + hitstop + flash, one call
juice.shake(power, ms)
juice.freeze(ms)               // hit-stop: the pause before the reaction
juice.flash(color, ms)
juice.pulse(selector)
```

Notes that matter for this codebase specifically:

- **Shake belongs on a wrapper, not `<body>`.** Shaking an element that contains
  `position: fixed` children detaches them. Put a `<div id="juice-root">` inside
  `Shell.tsx` and shake that; keep toasts and the story overlay outside it.
- **Hit-stop is the one people miss.** A 40–80ms freeze _before_ the reaction
  plays is most of what makes a hit feel heavy. Implement as a promise the
  caller awaits, never as a gate on input (inventory §277 — `rAF` runs at 0fps in
  a hidden tab and a state machine waiting on a frame will deadlock there).
- **Power is 0–1 and everything scales off it**, so one number tunes a whole
  reaction. A wrong answer is 0.25; a Seal breaking is 1.0.
- **Reduced motion swaps travel for a flash**, it does not remove the feedback.

**280.** A `useJuice()` hook so components can fire without importing the module.
**281.** Route every existing `sfx.*` call through the bus so audio and visuals
land on the same frame — the inventory's §264 is unbuildable without this.
**282.** A `?juice=0` URL flag that disables the whole bus, for debugging.
**283.** A dev overlay showing shake power and active emitters (extends §12).

## 284. A general particle emitter

`Feedback.tsx` already has a canvas confetti system with a `Particle` interface,
an update loop and a gold-leaf palette. It is 90% of a general emitter and it is
locked inside one component.

Lift it to `src/lib/particles.ts` with a config object:

```
emit({
  at: { x, y },          // screen coords, or an element to centre on
  count, spread, speed, gravity, drag,
  life, fade, spin,
  texture: 'ember' | 'shard' | ...   // from particleArt.json
  tint, blend: 'screen' | 'normal',
})
```

- **One shared canvas, one rAF loop, pooled objects.** Twelve emitters must not
  mean twelve canvases and twelve loops.
- **Texture-backed, not filled rects.** The 12 PNGs in `public/art/particles/`
  are already manifested in `src/particleArt.json` and used by exactly one file
  (`MapFx.tsx`). The emitter should read the same manifest.
- **Off-screen and hidden-tab pause**, same rule as the map.

**285.** Port the existing confetti to be one preset of the new emitter.
**286.** Presets: `burst`, `shards`, `sparks`, `dust-kick`, `motes`, `shockwave`.
**287.** An emitter budget — hard cap on live particles, oldest culled first.

## 288. A sprite-sheet FX player

The piece that unlocks every sourced asset in Part 2.

```
<Fx name="impact-gold" at={{x, y}} scale={1.4} onDone={...} />
```

- Backed by `src/fxArt.json`, written by a new `scripts/build-fx.mjs`, which
  slices sheets the same way `build-heroes.mjs` and `build-props.mjs` already do.
- Playback via `steps()` on `background-position` is the standard trick and is
  **wrong here** — that animates a paint property, which is exactly the bug that
  was just fixed in the fog. Use `transform: translate3d()` on a strip inside an
  `overflow: hidden` window instead, so it composites.
- Self-unmounting, fire-and-forget, no state in the caller.
- Respect `prefers-reduced-motion` by showing the sheet's peak frame as a still,
  briefly — the effect still communicates, it just doesn't travel.

**289.** An `<FxLayer>` portal at the app root so effects can be fired from
anywhere without the caller worrying about stacking context or overflow.
**290.** Preload the sheets a screen will need on route entry, not on first fire.

## 291. Floating text

Damage numbers, by another name. The most game-like thing that can be added to a
quiz, and it is about 60 lines.

```
float('+40 XP', { at, tone: 'good' })
float('+3 streak', { at, tone: 'gold', delay: 120 })
```

Rise, drift, fade, slight arc, tabular numerals, stack when several fire at once
so they never overlap. Tone drives colour and weight.

**292.** Queue rather than overlap — a correct answer that grants XP _and_
extends a streak _and_ clears a zone should read as three beats, not one pile.
**293.** Crits: a bigger, slower, gold variant for the first correct after a
wrong one, or a fast answer.

## 294. A transition director

Route changes are currently a crossfade or nothing. Give the app a small set of
named transitions and let routes declare which one they use.

- `iris` — circular wipe, centred on the thing that was clicked.
- `page` — a parchment page turn, for entering Notes or a lesson.
- `curtain` — the story's own, already half-built.
- `zoom-to-pin` — the map→landmark move (inventory §246–248), which needs the
  camera director below.
- `hard` — no transition, for back-navigation that should feel instant.

**295.** Transitions take their origin from the click coordinate, so the iris
opens where the finger was.
**296.** A transition must never be the only thing gating navigation — if the
animation is skipped or interrupted, the route still changes.

## 297. A camera director for the map

`AdventureMap.tsx` owns `view` and `clampView` already. Add an imperative
scripting layer on top.

```
camera.to({ x, y, scale }, { ms, ease })
camera.frame(regionId, { padding })
camera.punch(0.04)          // quick scale kick, springs back
camera.drift({ speed })     // slow ambient pan while a story beat is spoken
camera.follow(travellerRef)
```

- Must cooperate with `cameraLive`: a scripted move is _not_ live input, so it
  keeps its easing; a player touch cancels the script immediately.
- Must feed `spanFromView` so culling stays correct during scripted moves —
  otherwise the camera flies somewhere and finds nothing rendered.

**298.** `camera.shake` delegates to the juice bus rather than reimplementing.
**299.** A cinematic mode that hides the HUD, letterboxes 16:9 and disables input
for a scripted sequence, with a skip affordance (inventory §276).

---

# Part 2 — The asset shopping list

This is the "I can get it off the internet" part. The pipeline already exists,
so the work is choosing well and dropping files in the right place.

## How an asset gets into the app

```
art-src/<name>.png          # the source you downloaded, committed
   ↓  scripts/build-<kind>.mjs      (sharp; slices, keys, resizes, emits webp/avif)
public/art/<kind>/…         # what ships
src/<kind>Art.json          # the manifest: width, height, src
   ↓
a typed component reads the manifest — never a hardcoded path
```

Rules that already burned someone and are written down in the existing scripts:
sheets are keyed on magenta, interior pockets need explicit handling, and a
generated sheet's cell count rarely matches what was asked for — always slice
from measured bounds, never from an assumed grid.

## Licence rule — decide this once

**CC0 or CC-BY only.** Nothing else.

- **CC0** — use freely, no obligation. Prefer it.
- **CC-BY** — fine, but it creates a real obligation: a credits list. Add
  `docs/asset-credits.md` and surface it from `Legal.tsx`, which already exists.
- **Avoid CC-BY-NC** — the app is free today, but NC forecloses ever charging,
  and "non-commercial" is legally murky for a thing with a hosting bill.
- **Avoid GPL art** and **CC-BY-ND**.
- Keep the licence and source URL for every file in the credits doc _as you
  download it_. Reconstructing provenance later is miserable.

## 2.1 Sprite-sheet VFX — the biggest visual win

| Sheet                | Used for                     | Spec                                 |
| -------------------- | ---------------------------- | ------------------------------------ |
| Impact / hit burst   | Correct answer, boss hit     | 12–16 frames, 256px cells, alpha PNG |
| Slash / cut          | Boss duel attack             | 8–12 frames, 256×256                 |
| Shockwave ring       | Zone cleared, Seal broken    | 12 frames, 512×512                   |
| Magic circle / sigil | Seal breaking, rank-up       | 24–32 frames, 512×512, loops         |
| Smoke puff           | Wrong answer, dismissals     | 12 frames, 256×256                   |
| Ember / fire loop    | Camp, boss arena             | 16 frames, seamless loop             |
| Sparkle burst        | XP grant, achievement        | 8–12 frames, 128×128                 |
| Light column         | Rank-up cinematic            | 16–24 frames, 256×768                |
| Portal / rift        | The Grey, region transitions | 24 frames, loops                     |
| Dust kick            | Traveller footfall           | 6–8 frames, 128×128                  |
| Ink splatter         | Wrong answer on parchment    | 10 frames, 256×256                   |
| Wax seal stamp       | Zone cleared, test submitted | 10 frames, 256×256                   |

**Format guidance:** uniform grid, transparent PNG, additive-friendly (dark
background bakes into `screen` blend badly — prefer sheets drawn on true alpha).
Horizontal strips are easier to play with a `translate3d` window than grids.

**Where to look:** Kenney.nl (CC0, extremely reliable, has particle packs);
OpenGameArt (mixed — filter to CC0; check every asset); itch.io's free VFX
packs (per-asset licence, read each one); Craftpix's freebies (their own licence,
restrictive on redistribution — read it before committing anything).

## 2.2 Particle textures

Twelve exist. These are the gaps for _impact_ rather than ambience:

| Texture          | For                                            |
| ---------------- | ---------------------------------------------- |
| `shard`          | Streak break, Seal shatter                     |
| `spark`          | Correct answer, combo                          |
| `ash-fleck`      | The Grey, plague zones                         |
| `gold-leaf`      | XP, rank-up (replaces the drawn confetti rect) |
| `ink-drop`       | Wrong answer                                   |
| `paper-scrap`    | Page turns, test submit                        |
| `star-4pt`       | Achievement                                    |
| `rune-glyph`     | Boss, story                                    |
| `steam`          | Harbour region                                 |
| `glass-splinter` | Timer expiry                                   |

Tiny files — the existing twelve are 223–547 bytes each. 32–64px, alpha PNG,
drawn in a single flat colour so they can be tinted at runtime.

## 2.3 Full-screen overlay textures

The layer that most changes how "expensive" an app looks, and the cheapest to
add. One image, one `mix-blend-mode`, done.

| Overlay                           | Blend            | Use                            |
| --------------------------------- | ---------------- | ------------------------------ |
| Paper grain / fibre               | `multiply`, 4–8% | Every parchment surface        |
| Canvas weave                      | `overlay`, 5%    | Map, story cards               |
| Film grain (animated, 3–4 frames) | `overlay`, 3%    | Whole app, subtle              |
| Dust and scratches                | `screen`, 6%     | Cutscenes only                 |
| Light leak                        | `screen`         | Rank-up, Summit                |
| Ink bleed / water stain           | `multiply`       | Notes, wrong answers           |
| Vignette (soft, non-uniform)      | `multiply`       | Boss, story                    |
| Chromatic fringe                  | —                | Impact frames only, 2–3 frames |
| Scanline / lens dirt              | `screen`, 4%     | The Grey                       |

**Specs:** seamless-tiling where it tiles (1024², check the seam), or 1920×1080
for full-frame. Grayscale, so it can be tinted. Keep each under ~80KB — they load
on every screen.

**Where to look:** ambientCG and Poly Haven are CC0 and have genuinely good grain
and paper scans. Search "paper texture CC0", "film grain overlay CC0".

## 2.4 Frames, borders and diegetic UI

The app's chrome is CSS borders. Games use drawn frames.

| Asset                   | Spec                                  |
| ----------------------- | ------------------------------------- |
| Ornate panel frame      | 9-slice PNG, corners + edges separate |
| Ribbon / banner         | For section headings                  |
| Rope, chain, hinge      | Panel attachment points               |
| Torn paper edge         | Top/bottom of parchment sheets        |
| Wax seals (4–5 colours) | Zone complete, Seal states            |
| Map pins / markers      | Beyond the current drawn ones         |
| Compass rose            | Loading state (inventory §256)        |
| Progress bar frame      | Drawn ends and fill texture           |
| Button plates           | Pressed and unpressed states          |

9-slice is worth the setup: one 128×128 frame stretches to any panel size, which
CSS `border-image` handles natively with zero JS.

## 2.5 Cursors and pointers

Cheap, and nobody does it. A custom cursor per context — quill over text, sword
over a boss, hand over a map pin — costs one `cursor: url()` per rule. Keep the
system cursor available as fallback and never on interactive controls where the
system pointer communicates state.

## 2.6 Audio — read this before buying anything

**`src/lib/sfx.ts` synthesises every sound at runtime. The app ships zero audio
bytes.** That is a deliberate, unusual, genuinely good property: no licensing
surface, no payload, no CDN.

Adding music and ambience gives that up. A single 2-minute ambience loop at a
sane bitrate is ~1.5MB — larger than the entire JS bundle minus content. Before
sourcing any of it, decide:

- **Option A — stay synthetic.** Extend `sfx.ts` with synthesised wind, rain and
  drone beds. Zero bytes, infinitely loopable, no licence. Harder to make sound
  good, but the palette work just done proves it is achievable.
- **Option B — lazy-loaded, opt-in beds.** Music behind a settings toggle,
  fetched only when enabled, cached by the service worker. Never on first load.
- **Option C — ship it eagerly.** Do not. It taxes every cold start on a phone
  for something most students will mute.

**Recommendation: A for ambience, B for music.** If sourcing: Freesound (filter
strictly to CC0), Kenney's audio packs (CC0), Incompetech (CC-BY, requires the
credit line). Target Opus or AAC, mono for ambience, ~64kbps.

## 2.7 Fonts

Already well served — Cinzel, IM Fell English SC, Newsreader, Inter, Atkinson
Hyperlegible. The one gap is a **symbol/rune face** for diegetic glyphs, and the
better answer is SVG icons rather than a font: game-icons.net is CC-BY, 4,000+
fantasy-appropriate SVGs, and the app already has an `Icon.tsx`.

---

# Part 3 — The catalogue

Items 300 onward. Each is one buildable change, each is a call into a Part 1
system.

## 3.1 Impact and answer feedback — where 90% of session time is

**300.** Correct answer fires `juice.hit({ power: 0.35 })` — 40ms freeze, small
kick, gold flash, spark burst at the chosen row.
**301.** Wrong answer fires `power: 0.25` with a _horizontal_ shake only, and no
flash. Direction carries meaning: vertical reads as impact, horizontal as "no".
**302.** The chosen row's spark burst originates at the actual click coordinate.
**303.** Fast correct answers (under ~3s) get a crit: bigger float, brighter
flash, a second spark ring.
**304.** Wrong answer stamps an ink splatter sprite over the chosen row, which
then soaks in and fades to a stain that persists until the next question.
**305.** The correct row, revealed after a wrong answer, lights from its left
edge rightward like a fuse rather than fading in.
**306.** Streak milestones (3, 5, 10) escalate: 3 = a spark, 5 = a shockwave
ring, 10 = a light column behind the streak chip.
**307.** Streak break shatters the chip into `shard` particles that fall and
land on the panel below.
**308.** XP grants float from the answer row to the header XP chip along an arc,
and the chip pulses on arrival — the value visibly _travels_.
**309.** The progress bar's leading edge throws sparks when it advances.
**310.** Question-to-question uses `iris` from the Next button's coordinate.
**311.** The final question of a set slows down — a longer hold before reveal.
**312.** Timer under 20% adds a slow red pulse to the vignette, not the number.
**313.** Timer expiry: glass-splinter particles across the clock, one hard shake.
**314.** Answering with the keyboard shows the key badge depressing physically.

## 3.2 The map as a world

**315.** Camera pulls back to frame a region when it completes, holds, returns.
**316.** Camera drifts slowly during story beats (`camera.drift`) so the world is
alive behind the dialogue.
**317.** Clearing a landmark punches the camera 4% and throws a shockwave from
the pin.
**318.** Newly unlocked pins rise out of the map with a dust kick.
**319.** The traveller kicks dust on every third footfall.
**320.** A landmark the player is about to enter gets a breathing halo.
**321.** Region-specific weather that responds to progress — the harbour gets
spray, the pass gets wind-driven snow, cleared regions clear up.
**322.** Time-of-day tint driven by the device clock, applied as a full-screen
grade layer rather than per-element (inventory §255, but as one overlay).
**323.** The Grey visibly recedes from a region as it is cleared — tie
`.mapfx-grey-bank` opacity to `zonesCleared`, not just to story mood.
**324.** Ash flecks drift out of Grey banks and dissolve at their edges.
**325.** Birds scatter when the camera moves fast.
**326.** Water gets a specular glint that tracks the camera.
**327.** Roads between cleared landmarks light progressively, like a fuse.
**328.** The map has a parallax cloud layer above everything, moving at 0.6×.
**329.** Pin hover lifts the pin and drops a shadow — it becomes a physical object.
**330.** Long-press a pin for a diegetic radial menu instead of a modal.

## 3.3 The boss duel

The single most game-shaped surface in the app.

**331.** Hit-stop on every exchange — this is what makes a duel feel like a duel.
**332.** Boss takes damage: sprite flashes white for 2 frames, then recoils.
**333.** Damage numbers via the float system, scaled to the hit.
**334.** A slash sprite plays _over_ the boss, oriented to the attack.
**335.** Boss health bar drains in two stages — a fast red drop, then a slow
white "ghost" bar catching up, so the size of the hit is legible.
**336.** Boss attacks telegraph: a wind-up frame plus a colour shift, ~400ms,
long enough to read as intent.
**337.** Player takes damage: chromatic fringe overlay, one hard shake, vignette
pulses red at the edges.
**338.** Low health adds a persistent heartbeat pulse to the vignette.
**339.** Boss defeat: freeze, desaturate everything but the boss, then dissolve
the boss into particles.
**340.** Victory: light column, then the camera pulls back.
**341.** The arena background parallaxes against the camera punch.
**342.** Combo counter escalates its own visual tier at 3/5/10, matching §306.
**343.** Boss intro: name plate slides in over a held frame, letterboxed.

## 3.4 Story and cutscene

**344.** Wizzy's sprite reacts per beat mood — the `BeatMood` hook already exists
and currently only drives the environment.
**345.** Text types with a per-character sound at low volume, pitch-jittered.
**346.** Emphasised words (`<b>`) land with a small scale pop and a brighter tone.
**347.** A beat can request `camera.frame(regionId)` so Wizzy talks _about_ a
place while the camera is _on_ it — the payoff of the mood system already built.
**348.** Choice buttons rise in staggered, and the unchosen one falls away.
**349.** Seal-breaking beats get the magic-circle sprite, full-screen, behind the
card.
**350.** Letterbox bars slide in for `shake: 'hard'` beats and out afterwards.
**351.** The skip affordance is always visible and always instant (§276).

## 3.5 Rewards

**352.** A single reward queue — XP, achievement, rank-up, zone clear resolve in
sequence, never stacked (inventory §261, now with a system to hang it on).
**353.** Achievement unlock: the badge stamps in like a wax seal.
**354.** Rank-up cinematic: dim, light column, badge assembles from particles,
gold leaf falls, camera punch on landing.
**355.** Zone cleared: wax seal stamps onto the map pin with a shake.
**356.** Test submitted: the paper visibly flies away.
**357.** Daily goal met: the header chip fills and overflows with gold leaf.
**358.** First-time-only variants for the first correct answer, first zone, first
rank — remembered per user (inventory §254).

## 3.6 Screen-space grade

One overlay stack at the app root, driven by state. Everything here is a texture
plus a blend mode.

**359.** Persistent film grain at 3%, animated over 3–4 frames.
**360.** Paper grain on parchment surfaces at 4–8% `multiply`.
**361.** A vignette whose intensity is driven by context — heavier in a boss,
lighter in Notes.
**362.** Desaturation on low health, on the Grey, and on timer expiry, reusing
the `saturation` blend already proven in `PlagueLayer` and `.story-drain`.
**363.** Light leak on triumph moments.
**364.** Chromatic fringe on impact only, never persistent.
**365.** A colour grade per region, so the four sections feel like four places.

## 3.7 Idle, ambient and system

**366.** Idle after 30s: the camera begins a slow drift; any input cancels it.
**367.** Tab blur pauses every loop (inventory §253) — also a battery win.
**368.** Cold start: a compass loading state that actually spins to north.
**369.** Offline: the parchment visibly ages at the edges.
**370.** Service-worker update: a scroll unfurls from the bottom.
**371.** 404: the traveller stands on an empty map, looking around.
**372.** Error boundary: the page tears like paper (inventory §262) — now with a
torn-edge asset instead of a CSS approximation.

---

# Part 4 — The build order

Each phase is shippable on its own and leaves the app better than it found it.

## Phase 0 — Land what's already written _(no new work)_

Ten files are uncommitted from the last pass. Commit them before starting, so
everything below has a clean base.

**Done when:** `npm run build` is green and the tree is clean.

## Phase 1 — The juice bus _(items 279–283, 300–303)_

**Depends on:** nothing.
**Assets:** none. Deliberately — prove the system with CSS before buying art.

Build `juice.ts` and the `#juice-root` wrapper. Wire it to exactly two places:
correct and wrong in `QuestionRunner.tsx`. Route the existing `sfx` calls through
it so sound and vision land together.

**Why this first:** it touches the 90% surface, needs no assets, and every later
phase calls into it. If only one phase ever ships, this is the one that matters.

**Done when:** answering a question produces a freeze, a kick, a flash and a
sound on the same frame; `?juice=0` disables all of it; reduced motion still
communicates correct vs wrong without travel.

## Phase 2 — Particles and floating text _(284–287, 291–293, 304–309)_

**Depends on:** Phase 1.
**Assets:** §2.2 particle textures — 10 tiny PNGs. Start here because they are
the smallest, cheapest assets to source and the pipeline already exists.

Lift the confetti emitter out of `Feedback.tsx`, generalise it, port confetti to
be one preset, then build floating text on top.

**Done when:** XP visibly travels from the answer row to the header chip; a
streak break shatters; the particle cap holds under a deliberate spam test.

## Phase 3 — Screen-space grade _(359–365)_

**Depends on:** nothing, but reads better after Phase 1.
**Assets:** §2.3 overlay textures — this is the phase that most changes how the
app _looks_ for the least code.

One `<Grade>` component at the app root, a token per context, textures behind the
`art-heavy` class so reduced-data mode drops them.

**Done when:** the four regions read as four places; grain is present but nobody
can point at it; reduced-data mode removes every overlay and the app still works.

## Phase 4 — The sprite FX player _(288–290, 353–357)_

**Depends on:** Phase 1.
**Assets:** §2.1 sprite sheets — the big sourcing job. Start with three:
impact, shockwave, wax seal.

Write `scripts/build-fx.mjs` against the existing slicing conventions, then the
`<Fx>` component and `<FxLayer>` portal. Prove it with the wax seal on zone
clear, which is a self-contained, high-value moment.

**Done when:** an effect can be fired from any screen with one call, plays on the
compositor (verify: no paint invalidation during playback), and self-unmounts.

## Phase 5 — The camera director _(294–299, 315–330, 347)_

**Depends on:** Phases 1 and 4.
**Assets:** none.

The largest single piece of work here, and the one that turns the map from a
picture into a place. Must cooperate with `cameraLive` and must keep
`spanFromView` fed during scripted moves.

**Done when:** clearing a landmark punches, throws a shockwave and pans to the
next pin without the player touching anything; a touch cancels any script
instantly; culling stays correct throughout a scripted flight.

## Phase 6 — The duel _(331–343)_

**Depends on:** Phases 1, 2, 4.
**Assets:** slash, hit, and boss-specific sheets.

Everything here is a composition of systems that already exist by this point.

**Done when:** an exchange has hit-stop, a flash, a slash sprite, damage numbers
and a two-stage health drain.

## Phase 7 — Story, transitions and the rest _(344–351, 366–372)_

**Depends on:** everything.
**Assets:** magic circle, torn paper, compass.

## Phase 8 — Audio, only if Option A or B was chosen

Deliberately last. It is the only phase that makes the app heavier rather than
richer, and it is the easiest to get wrong.

---

# Part 5 — Budget and guardrails

Carry these forward. Most are already enforced; the new ones are marked.

## Performance

| Budget                      | Limit              | Enforced by                    |
| --------------------------- | ------------------ | ------------------------------ |
| Animated elements on screen | ~250               | `mapView.tsx` `<Band>` culling |
| Blurred composited surface  | ~1× viewport       | measured, not assumed          |
| Live particles              | cap, oldest culled | **new — item 287**             |
| Concurrent sprite FX        | 4                  | **new**                        |
| Overlay textures per screen | 3                  | **new**                        |
| Added asset weight          | +400KB total, lazy | **new**                        |

The content chunk is already 622KB. Assets must be route-lazy and must hang off
the existing `art-heavy` class so reduced-data mode drops them.

**Composite, don't paint.** Every effect animates `transform` and `opacity` only.
The fog bug is the reference case: animating `background-position` on a blurred
element re-blurred six megapixels every frame. `scripts/check-map-animations.mjs`
gates this at build time — keep it passing, and extend it to cover new classes.

## Accessibility — not negotiable

- **WCAG 2.3.1: three flashes per second, maximum.** This is the guardrail most
  at risk from everything in Part 3, because impact flashes are the whole point
  of Phase 1. Any flash clearing 10% relative luminance counts. Independent
  clocks that rarely coincide are safe; a shared short clock is not. Budget
  flashes globally, in the juice bus, not per component.
- **`prefers-reduced-motion` must still communicate state**, not remove feedback.
  Correct and wrong must remain distinguishable without any travel.
- The global rule collapses animations to one near-zero iteration and **parks the
  element on its 100% keyframe** — an effect ending at `opacity: 0` disappears
  permanently for reduced-motion users. This has already bitten twice in this
  codebase (`fx-sparkle`, `echoBreathe`). Check every new keyframe's end state.
- Nothing gates input on an animation completing (§277).
- Screen shake is the most common motion-sickness trigger in games. It must be
  separately disableable from other motion, and off by default under reduced
  motion.

## Licensing

Every sourced file gets a row in `docs/asset-credits.md` — filename, source URL,
author, licence — written **when it is downloaded**, and CC-BY credits surfaced
from `Legal.tsx`. The privacy policy there will also need a look if any asset is
fetched from a third-party host at runtime; the answer is that none should be —
everything ships from `public/`.

---

## If you only do three

1. **Phase 1, the juice bus.** No assets, touches the surface students actually
   spend their time on, and every other phase depends on it.
2. **Phase 3, the screen-space grade.** The largest visible change per line of
   code in this entire document, and it is mostly downloading good textures.
3. **Phase 5, the camera director.** The difference between a map you look at and
   a world you are in.
