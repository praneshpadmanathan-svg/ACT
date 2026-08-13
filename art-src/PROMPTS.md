# Art prompts

The generated art in this project comes from image models, and the prompt is the
source file — the PNG in this directory is a build output that happens to be
committed. Losing the prompt means the next sheet cannot be made to match the
last one, which for a *set* of sprites is the whole game. So they live here.

Each prompt is followed by the notes that came out of actually slicing the
result, because the next sheet has to be sliceable by the same script.

---

## `travellers-sheet.png` — the eight travellers

Sliced by `scripts/build-heroes.mjs` into `public/art/heroes/*.png`, manifest at
`src/heroArt.json`. Reading order is top row left to right, then bottom row:
ash, wren, juniper, kesh, noor, sable, linden, io.

> A sprite sheet of eight pixel-art fantasy travellers in a 4x2 grid, evenly
> spaced, each one centred in its own cell with clear space around it. All eight
> are the same character design and the same pose — standing, facing the viewer,
> a walking staff in the right hand, a travelling cloak, boots, a satchel — and
> differ only in skin tone, hair colour and cloak colour, so they read as one
> party rather than eight unrelated characters. Warm limited palette: dark brown
> outlines rather than black, warm leather browns, saturated cloaks. Light comes
> from the upper left. Chunky readable pixels, no anti-aliasing, no dithering,
> no gradients. Full body, feet at the bottom of the cell. No text, no numbers,
> no borders, no drop shadows, no background scenery — transparent background.

**What actually came back, and what to expect again.** The transparency is
*painted on*: the sheet arrives with the familiar grey checkerboard drawn into
the pixels and alpha 255 everywhere. `build-heroes.mjs` keys it out by flood
filling from the border on "near-neutral and light" rather than on sampled
colours, because the two checker greys are 29 apart and a faint vignette moves
both of them across the sheet. That works here only because *nothing in the
traveller palette is neutral* — the outlines are brown, the leather is warm, the
cloaks are saturated. Do not add a grey or white element to a traveller without
re-checking the key.

---

## The seven rank badges — prompt to run

Not yet generated. This is the prompt to use, and the notes below are the
constraints it has to satisfy for a slicing script to be worth writing.

The ranks and their colours are in `src/lib/progress.ts` (`RANKS`). The badges
are currently drawn as SVG in `src/components/RankSigil.tsx`, and those shapes
are a *softer* set than this — a book plaque, a laurel wreath, a crowned sun.
They came from the first, more literary version of the ladder. This prompt is
deliberately not a transcription of them: the names got harder, so the art has
to. Only the colours carry over unchanged, because a badge that changes hue
makes a returning student think they lost something.

> A sprite sheet of seven pixel-art rank emblems for a fantasy video game, in a
> single horizontal row, evenly spaced, each emblem centred in its own square
> cell with clear space around it, on a flat solid magenta background (#FF00FF)
> with no checkerboard and no shadows. Chunky game-UI badges — heavy dark metal
> frames, riveted edges, weapons and beast-parts, the look of a ranked ladder in
> a dungeon crawler. Left to right the seven emblems are:
>
> 1. **Drifter** — a chipped, dented iron ring hung on a scrap of leather cord,
>    empty in the middle except for a single worn boot-print stamped into it.
>    Weathered orange-brown metal (#e58a4e into #a4551f). Deliberately the
>    poorest, plainest object in the row: no frame, no ornament, cheap metal.
> 2. **Pathfinder** — an arrowhead-shaped iron badge, point up, with a compass
>    needle set into it and a broken-off trail marker crossed behind. Cold
>    silver-white steel (#eef3fb into #9fb2cc).
> 3. **Torchbearer** — a squat iron shield gripping a burning torch, the flame
>    breaking up over the top edge of the shield in chunky pixel tongues. Warm
>    gold and fire (#ffe07a into #dfa018).
> 4. **Roadwarden** — a heavy tower shield with two spears crossed behind it and
>    a faceted crystal bolted into its centre, teal (#63f0e0 into #1c94ab).
> 5. **Gatebreaker** — a two-handed warhammer smashing through a portcullis, the
>    bars bent and snapped outward around the head, chunks of iron flying.
>    Violet (#c8aaff into #7a4fd0).
> 6. **Greybane** — a cracked grey horned skull with a sword driven down through
>    it, set inside an eight-pointed spiked burst. Ember orange-red (#ff8a6b
>    into #c9341f).
> 7. **Stormcrown** — a jagged iron crown, spikes uneven and battle-notched,
>    with forked lightning cracking out of it to left and right past the edges
>    of the emblem. Bright gold (#ffe36e into #ff8c3b). No sun, no sunburst, no
>    halo, no rays — lightning only.
>
> All seven share one construction so they read as one set: the same optical
> weight and the same square footprint, a dark ink outline of the same thickness
> around every emblem, a brighter rim highlight along the upper left where the
> light falls, and the metal in each rank's own two colours. Escalating menace
> and ornament from left to right — emblem one is a piece of junk and emblem
> seven is a trophy — but never escalating size. Chunky readable pixels, no
> anti-aliasing, no dithering, no gradients, no glow. No text, no numbers, no
> roman numerals, no ribbons or banners, no laurel wreaths, no books.

**Why one row and not a grid.** Seven does not divide into a rectangle, so any
grid leaves a ragged cell and the slicer has to know where the hole is. Cutting
a single row needs only column boundaries, which is the most robust thing to ask
a script to find.

**Why magenta and not "transparent".** Asking for a transparent background gets
a painted checkerboard, as it did for the travellers. That was keyable there
only because no traveller pixel was light and neutral — and half of these badges
are metal, so silver, near-white devices and pale rim highlights are exactly the
pixels a neutral-and-light key would eat. `#FF00FF` appears nowhere in the rank
palette, so keying on it cannot take a badge with it.

**Target size.** About 200px per cell, ~1400x200 for the row; the badges render
at 38px in the rank list and 104px in the rank-up cinematic, so 200 leaves room
to downscale cleanly without ever having to scale up.
