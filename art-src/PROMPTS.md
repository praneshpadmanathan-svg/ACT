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

The ranks and their colours are in `src/lib/progress.ts` (`RANKS`); the reasoning
behind the names is in the comment above them. The badges are currently drawn as
SVG in `src/components/RankSigil.tsx` and those shapes are placeholders — they
were drawn for an earlier, softer ladder.

The brief this prompt is written against: **heavy game-UI metal, scholar's
objects**. Every emblem is a piece of study equipment — ink, pages, a quill, a
tome, a slate — rendered as ranked-ladder loot rather than as stationery. That
is the whole trick, and it is what keeps the set from sliding back into either
of the two failure modes the names went through: a report card, or a warrior's
kit that has nothing to do with reading.

Only the seven colour pairs carry over unchanged, because a badge that changes
hue makes a returning student think they lost something.

> A sprite sheet of seven pixel-art rank emblems for a fantasy video game, in a
> single horizontal row, evenly spaced, each emblem centred in its own square
> cell with clear space around it, on a flat solid magenta background (#FF00FF)
> with no checkerboard and no shadows. Chunky game-UI badges — heavy dark metal
> frames, riveted edges, the look of a ranked ladder in a dungeon crawler — but
> every emblem is built around a scholar's object: ink, pages, a quill, a tome,
> a slate. Left to right the seven emblems are:
>
> 1. **Inkling** — a chipped clay ink pot, cracked down one side, with a single
>    fat ink blot spilling over its lip. Weathered orange-brown (#e58a4e into
>    #a4551f). Deliberately the poorest, plainest object in the row: no frame,
>    no metal, no ornament.
> 2. **Pagewalker** — an arrowhead-shaped steel badge, point up, made of a
>    folded page with a boot-print pressed into it and a ribbon bookmark
>    trailing from the bottom point. Cold silver-white steel (#eef3fb into
>    #9fb2cc).
> 3. **Quillbearer** — a squat iron shield gripping an upright quill whose
>    feathered tip is on fire, the flame breaking up over the top edge of the
>    shield in chunky pixel tongues. Warm gold and fire (#ffe07a into #dfa018).
> 4. **Lorewarden** — a heavy tower shield with a thick chained tome bolted to
>    its face and two long pens crossed behind it like spears. A faceted teal
>    crystal set as the tome's clasp. Teal (#63f0e0 into #1c94ab).
> 5. **Proofbreaker** — a two-handed warhammer smashing down through a stone
>    slate covered in carved geometry lines, the slate split and shards flying
>    outward around the hammer head. Violet (#c8aaff into #7a4fd0).
> 6. **Doubtbane** — a heavy sword driven straight down through a cracked stone
>    question-mark carving, splitting it, the whole thing set inside an
>    eight-pointed spiked burst. Ember orange-red (#ff8a6b into #c9341f).
> 7. **Sagecrown** — a crown built out of stacked closed books, their spines
>    forming the band and their fore-edges the uneven points, one open book set
>    at the front of it, with forked lightning cracking out to left and right
>    past the edges of the emblem. Bright gold (#ffe36e into #ff8c3b). No sun,
>    no sunburst, no halo, no rays — lightning only.
>
> All seven share one construction so they read as one set: the same optical
> weight and the same square footprint, a dark ink outline of the same thickness
> around every emblem, a brighter rim highlight along the upper left where the
> light falls, and the metal in each rank's own two colours. Escalating weight
> and ornament from left to right — emblem one is a cracked pot and emblem seven
> is a trophy — but never escalating size. Chunky readable pixels, no
> anti-aliasing, no dithering, no gradients, no glow. No lettering, no numbers,
> no roman numerals, no ribbons or banners, no laurel wreaths, no owls, no
> graduation caps, no scrolls of text. The carved question mark on emblem six is
> the only glyph anywhere in the sheet.

**Why one row and not a grid.** Seven does not divide into a rectangle, so any
grid leaves a ragged cell and the slicer has to know where the hole is. Cutting
a single row needs only column boundaries, which is the most robust thing to ask
a script to find.

**Why magenta and not "transparent".** Asking for a transparent background gets
a painted checkerboard, as it did for the travellers. That was keyable there
only because no traveller pixel was light and neutral — and these badges are
steel, stone and paper, so silver plate, pale slate and near-white pages are
exactly the pixels a neutral-and-light key would eat. `#FF00FF` appears nowhere
in the rank palette, so keying on it cannot take a badge with it.

**Why the "no lettering" line is worth keeping even though emblem six has a
question mark.** Books, slates and pages are the four things an image model is
most likely to cover in scribbled fake text, and fake text at 38px is noise that
survives every downscale. The question mark is called out as the single
exception so the instruction stays absolute everywhere else rather than becoming
a suggestion.

**Target size.** About 200px per cell, ~1400x200 for the row; the badges render
at 38px in the rank list and 104px in the rank-up cinematic, so 200 leaves room
to downscale cleanly without ever having to scale up.
