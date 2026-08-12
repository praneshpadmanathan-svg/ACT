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

The ranks and their colours are in `src/lib/progress.ts` (`RANKS`); the badges
are currently drawn as SVG in `src/components/RankSigil.tsx`, and the shapes
described below are those same seven silhouettes, so a generated sheet is a
drop-in replacement rather than a redesign.

> A sprite sheet of seven pixel-art fantasy rank badges in a single horizontal
> row, evenly spaced, each badge centred in its own square cell with clear space
> around it, on a flat solid magenta background (#FF00FF) with no checkerboard
> and no shadows. Left to right the seven badges are:
>
> 1. a plain round wooden token with one notch cut out of its rim, weathered
>    orange-brown metal (#e58a4e into #a4551f), a small pale arrow-and-dot
>    device in the middle;
> 2. a squared plaque with a rounded base holding an open book, cold silver-white
>    metal (#eef3fb into #9fb2cc);
> 3. a laurelled shield with a five-pointed star on it, warm gold (#ffe07a into
>    #dfa018);
> 4. a cut gem with visible facet lines, teal (#63f0e0 into #1c94ab);
> 5. a winged spearhead pointing up, violet (#c8aaff into #7a4fd0);
> 6. an eight-pointed starburst inside a ring, ember orange-red (#ff8a6b into
>    #c9341f);
> 7. a crowned sun with rays radiating past its rim, bright gold (#ffe36e into
>    #ff8c3b).
>
> All seven share one construction so they read as one set: the same optical
> weight and the same square footprint, a dark ink outline of the same thickness
> around every badge, a brighter rim highlight along the upper left where the
> light falls, and the central device in warm near-white. Escalating ornament
> from left to right — badge one is deliberately the plainest thing in the row
> and badge seven the most elaborate — but never escalating size. Chunky readable
> pixels, no anti-aliasing, no dithering, no gradients, no glow. No text, no
> numbers, no roman numerals, no ribbons or banners.

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
