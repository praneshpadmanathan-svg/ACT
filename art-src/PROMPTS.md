# Art prompts

The generated art in this project comes from image models, and the prompt is the
source file — the PNG in this directory is a build output that happens to be
committed. Losing the prompt means the next sheet cannot be made to match the
last one, which for a _set_ of sprites is the whole game. So they live here.

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
_painted on_: the sheet arrives with the familiar grey checkerboard drawn into
the pixels and alpha 255 everywhere. `build-heroes.mjs` keys it out by flood
filling from the border on "near-neutral and light" rather than on sampled
colours, because the two checker greys are 29 apart and a faint vignette moves
both of them across the sheet. That works here only because _nothing in the
traveller palette is neutral_ — the outlines are brown, the leather is warm, the
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

**What actually came back, and what it taught us about batch size.** Nine
emblems in two staggered rows, not seven in one: Lorewarden drawn twice, and
Proofbreaker's hammer and slate split into separate cells. The slicer handles it
(`SLOTS` in `scripts/build-ranks.mjs` maps detected cell to rank, with two cells
deliberately discarded), and one mis-assignment was a gift — the cracked
question mark specced for Doubtbane landed on Proofbreaker's slate, which is a
better emblem for "the rank that breaks the question open" than what was asked
for.

The lesson generalises, and it governs every sheet below: **past about nine
items in one image, the model loses count.** It starts duplicating, splitting
one described object across two cells, and drifting off the layout. So the work
below is five sheets rather than one enormous one, which would come back
unusable.

---

# Sheets still to generate

Each is independently useful — generate one, and it can be sliced and shipped
without waiting on the others. They are listed in the order they are worth
doing.

Three rules are shared, and they are not stylistic preferences. They are what
makes a sheet _sliceable_:

1. **Flat magenta `#FF00FF` background.** Never "transparent" — that returns a
   painted checkerboard with alpha 255 everywhere, which has to be keyed out
   anyway and is far more dangerous, because the key can eat pale neutral
   pixels in the art itself.
2. **Clear space between items; nothing touching.** The slicer finds cells by
   projecting ink onto each axis and looking for gaps. Two items that overlap by
   a single pixel become one cell.
3. **No lettering anywhere.** Fake text is the most common failure in generated
   art, and it survives every downscale as noise.

---

## Sheet 1 — Foliage and weather particles

**Do this one first.** It answers "green stuff coming off the trees", it is the
cheapest to produce, and it is the highest leverage — because the motion does
not come from the art at all.

**Why animation frames are the wrong idea here.** The obvious approach is a
sheet of one tree in four positions of a sway cycle. It fails twice: an image
model will not hold a tree identical across four frames (branches move, trunk
width changes, palette drifts), and even if it did, a four-frame loop reads as a
loop within two cycles. The map already has trees. What it needs is _things
coming off them_ — and a leaf is one small object that a particle engine can
throw a hundred different ways, from a hundred heights, at a hundred rotations,
from a single sprite.

That engine already exists: `src/components/RankAura.tsx`, built for the rank
badges — time-based integration, per-particle jitter, drag and gravity, and
tumble-foreshortening that is already correct for flat objects like leaves. It
currently draws its particles as canvas shapes; changing it to stamp a sprite
instead is a small edit. These are the sprites.

> A sprite sheet of small pixel-art nature particles for a fantasy map game, in
> two rows on a flat solid magenta background (#FF00FF), every item small and
> clearly separated from its neighbours with generous empty space around it,
> nothing touching. Chunky readable pixels, dark ink outlines, no
> anti-aliasing, no gradients, no glow, no lettering.
>
> Top row, left to right: a broad green leaf seen flat from above; the same leaf
> seen edge-on as a thin sliver; a smaller yellow-green leaf curled at one edge;
> a dry orange-brown autumn leaf; a single pink blossom petal; a tuft of white
> dandelion seed-fluff.
>
> Bottom row, left to right: three tiny round pollen motes clustered loosely; a
> short white rain streak angled slightly; a six-pointed snowflake; a small grey
> dust puff; a glowing orange ember; a thin curl of pale grey smoke.
>
> Every item drawn at the same chunky pixel scale as the others, as if cut from
> one tileset. Simple readable silhouettes — these are seen a few pixels across,
> so shape matters and interior detail does not.

Twelve items rather than nine, and safe at twelve precisely because every one of
them is a single simple shape.

---

## Sheet 2 — Map props as cutouts

Trees, rocks and ruins to scatter over the map, so the terrain has objects
standing on it rather than being one flat painting.

> A sprite sheet of pixel-art fantasy map props in two rows on a flat solid
> magenta background (#FF00FF), each prop centred with clear space around it,
> nothing touching, all lit from the upper left, all at the same pixel scale as
> if from one tileset. Chunky pixels, dark brown ink outlines rather than black,
> warm limited palette, no anti-aliasing, no gradients, no lettering.
>
> Top row: a full round broadleaf tree in deep summer green; a taller narrow
> pine; a bare dead tree with pale grey branches and no leaves; a mossy boulder;
> a cluster of three small rocks.
>
> Bottom row: a ruined stone archway missing its keystone; a small stone
> waystone marker leaning slightly; a closed canvas travelling tent; a weathered
> wooden signpost whose board is completely blank.
>
> Each prop stands upright with its base flat, as if placed on ground. Full
> body, nothing cropped.

Nine items — at the ceiling, deliberately.

**What came back, and where it can and cannot go.** Nine clean cells for nine
slots, sliced by `scripts/build-props.mjs`. Six of them arrived with a cast
shadow painted underneath in a darker magenta; those key out with the
background, which is the outcome we want — a shadow baked into a sprite is lit
from one fixed direction and painted onto whatever ground the prop lands on.

**Not scattered on the world map, though.** The brief above says the map needs
props "so the terrain has objects standing on it rather than being one flat
painting", and that describes a map this project does not have.
`world-map.webp` is already dense: the desert alone carries an arch, a ruined
colonnade, standing pillars, tents and a watchtower, and the forest is
wall-to-wall canopy. Composited at real map scale the props sit convincingly —
the style holds, which was the real risk — but there is nowhere to put them
that is not already occupied, and adding to a full frame is clutter rather than
depth. They are cut, committed and waiting for terrain that is actually sparse:
the extension panels, once those exist in the right style.

---

## Sheet 3 — The four guardians

`src/game/BossArt.tsx` draws these procedurally in SVG today, and they are the
weakest art in the app by a distance.

These are **not** four cells on a sheet. A guardian is the largest single figure
a student ever sees, shown alone in a duel, so generate them **one per image**,
full frame, and slice nothing. Four separate generations.

Each already has a colour in `src/game/bosses.ts` that the duel UI uses for its
glow and hit flashes, so the art has to agree with it.

**The Grammar Gauntlet — Keeper of the Village** (`#d9a441`, warm gold)

> A single pixel-art fantasy boss on a flat solid magenta background (#FF00FF),
> full body, facing the viewer, centred with clear space all round. A tall
> armoured warden in warm gold and worn brass plate, a heavy tower shield in one
> hand and a thick ledger chained to its belt, helm shaped like a village
> gatehouse with a dark slot where a face should be. Imposing but orderly — this
> one enforces rules. Chunky readable pixels, dark ink outlines, lit from the
> upper left, no anti-aliasing, no gradients, no lettering anywhere, including
> on the ledger.

**The Passage Titan — Warden of the Woods** (`#5fa86b`, green)

> A single pixel-art fantasy boss on a flat solid magenta background (#FF00FF),
> full body, facing the viewer, centred with clear space all round. A huge
> moss-covered forest giant of bark and stone in deep greens, long arms reaching
> the ground, a canopy of leaves across its shoulders like a cloak, many small
> pale eyes glowing in the dark hollow of its face. Ancient and patient rather
> than aggressive. Chunky readable pixels, dark ink outlines, lit from the upper
> left, no anti-aliasing, no gradients, no lettering.

**The Number Crusher — Tyrant of the Desert** (`#d2703a`, burnt orange)

> A single pixel-art fantasy boss on a flat solid magenta background (#FF00FF),
> full body, facing the viewer, centred with clear space all round. A massive
> desert tyrant of sun-baked orange stone and bronze, broad and low and heavy,
> enormous fists, a cracked sandstone mask for a face, sand pouring continuously
> from the seams of its shoulders. Built for force and speed. Chunky readable
> pixels, dark ink outlines, lit from the upper left, no anti-aliasing, no
> gradients, and no lettering or numerals of any kind.

**The Lab Leviathan — Guardian of the Cliffs** (`#4f9dc9`, cold blue)

> A single pixel-art fantasy boss on a flat solid magenta background (#FF00FF),
> full body, facing the viewer, centred with clear space all round. A vast
> deep-sea leviathan reared up out of the water, cold blue and steel grey,
> plated chitin, a long tapering skull with one wide pale eye, coils and fins
> spreading behind it, glass vials and brass instruments fused into its hide
> like barnacles. Chunky readable pixels, dark ink outlines, lit from the upper
> left, no anti-aliasing, no gradients, no lettering, and no dials with numbers
> on them.

---

## Sheet 4 — Map extension panels

The world map is a single 768x1376 painting. Extending it means painting what is
off its edges.

**Seamless tiles are the wrong ask.** An image model cannot match an existing
painted edge pixel for pixel, and a visible seam across open ground looks worse
than no extension at all. The way this works is to put the join where a break is
_expected_: a coastline, a cliff face, a river, or a bank of the Grey's own
mist. Then the seam is a feature of the world rather than a defect in the art.

> **The first four came back in the wrong style, and the prompt is why.** It
> asked for "chunky readable pixels, dark ink outlines, no anti-aliasing, no
> gradients" — which is this project's _sprite_ style, correctly copied from
> every other prompt in this file, and completely wrong here.
> `public/art/world-map.webp` is not pixel art. It is a painted, hand-inked
> illustration on parchment: soft shading, painted clouds overlapping the
> edges, saturated forest greens against terracotta rock, visible paper grain.
> Butting a flat top-down tilemap against it does not read as more map, it
> reads as a screenshot of another game pasted underneath — checked by
> compositing `panel-south.png` under the real map at real scale before
> writing any code for it.
>
> The four panels below are rewritten to match the map they attach to.
> `art-src/panel-{north,south,east,west}.png` are the pixel-art versions, kept
> because they are good art in their own right and may yet be useful somewhere
> that is not this map.

Generate these **one per image**, and note which edge carries the coast: it is
always the edge that **faces the existing map**, because that is the edge that
has to join. North sits above, so its coast runs along its bottom; south sits
below, so its coast runs along its top; east and west are mirror images of each
other.

Orientation follows from the same fact. North and south span the map's width and
add height, so they are **landscape (16:9)**. East and west span its height and
add width, so they are **portrait (9:16)**. `panel-north.png` came back 1408×768,
which is the shape to match.

No magenta on these — like the loading backdrops, the whole image is the asset.

**North**

> A landscape, painted illustrated fantasy map in the style of a hand-inked atlas plate on aged parchment: soft brush shading rather than flat fill, warm brown ink linework, saturated colour — deep forest greens, terracotta and rust rock, cream sand, deep blue-teal sea with fine drawn wave lines — a faint paper grain over everything, and soft painted white clouds drifting across the outer edges of the plate. Top-down three-quarter view. No pixel-art, no hard pixel edges, no flat vector fill. The **bottom** edge of the plate is entirely open sea meeting a long east-west coastline, so the panel can butt against another map along that coast. The rest of the plate is snowfields and black pine forest rising to a broken mountain wall, with a frozen river cutting down through it. Painted texture throughout, lit from the upper left. No lettering, no labels, no place names, no compass rose, no map border or frame, no grid, no scale bar.

**South**

> A landscape, painted illustrated fantasy map in the style of a hand-inked atlas plate on aged parchment: soft brush shading rather than flat fill, warm brown ink linework, saturated colour — deep forest greens, terracotta and rust rock, cream sand, deep blue-teal sea with fine drawn wave lines — a faint paper grain over everything, and soft painted white clouds drifting across the outer edges of the plate. Top-down three-quarter view. No pixel-art, no hard pixel edges, no flat vector fill. The **top** edge of the plate is entirely open sea meeting a long east-west coastline, so the panel can butt against another map along that coast. The rest of the plate is salt marsh and mangrove giving way to pale wind-carved dunes, with tidal channels threading through the reeds. Painted texture throughout, lit from the upper left. No lettering, no labels, no place names, no compass rose, no map border or frame, no grid, no scale bar.

**East**

> A portrait, painted illustrated fantasy map in the style of a hand-inked atlas plate on aged parchment: soft brush shading rather than flat fill, warm brown ink linework, saturated colour — deep forest greens, terracotta and rust rock, cream sand, deep blue-teal sea with fine drawn wave lines — a faint paper grain over everything, and soft painted white clouds drifting across the outer edges of the plate. Top-down three-quarter view. No pixel-art, no hard pixel edges, no flat vector fill. The **left** edge of the plate is entirely open sea meeting a long north-south coastline, so the panel can butt against another map along that coast. The rest of the plate is high plateau cut by deep red canyons and dry riverbeds, with a few wind-bent trees on the rim. Painted texture throughout, lit from the upper left. No lettering, no labels, no place names, no compass rose, no map border or frame, no grid, no scale bar.

**West**

> A portrait, painted illustrated fantasy map in the style of a hand-inked atlas plate on aged parchment: soft brush shading rather than flat fill, warm brown ink linework, saturated colour — deep forest greens, terracotta and rust rock, cream sand, deep blue-teal sea with fine drawn wave lines — a faint paper grain over everything, and soft painted white clouds drifting across the outer edges of the plate. Top-down three-quarter view. No pixel-art, no hard pixel edges, no flat vector fill. The **right** edge of the plate is entirely open sea meeting a long north-south coastline, so the panel can butt against another map along that coast. The rest of the plate is drowned ruins standing in shallow water, stone causeways running between small wooded islands. Painted texture throughout, lit from the upper left. No lettering, no labels, no place names, no compass rose, no map border or frame, no grid, no scale bar.

**The generator's sparkle lands in the bottom-right corner, 33 px in.** On a
cutout sheet that is harmless — `findCells` drops it by size. On a full-bleed
panel it is inside the terrain and has to be cropped off, which means losing
about 96 px of one edge. Never the joining edge: crop the **right** on north,
and the **bottom** on the other three. Each of the four has a safe choice, so
this costs nothing but has to be done deliberately.

---

## Sheet 5 — The loading screen

One image, not a sheet. It replaces the spinning compass and "Finding your
place" at `src/App.tsx:199`.

> A single pixel-art scene on a flat solid magenta background (#FF00FF): a
> traveller's brass compass lying open on a folded map, seen from just above,
> its needle catching the light, a lit lantern glowing warm beside it. Warm
> limited palette, chunky readable pixels, dark ink outlines, lit from the upper
> left, no anti-aliasing, no gradients, no lettering, no numerals, no
> compass-rose letters, and no readable markings on the map.

Three separate bans on text there, on purpose: a compass and a map are the two
objects an image model is most determined to cover in fake writing.

---

## Sheet 6 — The loading screen, properly

Sheet 5 gave us one object and the object was never the problem. A cutout
centred on an empty dark field is a sticker on nothing, whatever is drawn on the
sticker. The screen already ships with the landing hero behind it under the
landing screen's own scrim, which fixes the register — this sheet gives that
background some variety, and gives the object some competition.

**Two sets, and they follow opposite rules.** Read this before generating.

|                   | Set A — backgrounds              | Set B — objects        |
| ----------------- | -------------------------------- | ---------------------- |
| Background colour | **the art itself, edge to edge** | flat magenta `#FF00FF` |
| Keyed out?        | **never**                        | yes, by the slicer     |
| Items per image   | one full-bleed scene             | 8 in a grid            |
| Aspect            | square, 1:1                      | anything               |

Set A is the first art in this project that must **not** have a magenta
background, and asking for one would be actively wrong — the whole image is
kept. Every other prompt in this file says the opposite, so it is worth saying
loudly once.

### Set A — full-bleed loading backgrounds (four separate images)

Generate each as its own image. They are alternatives _and_ a rotation: the
screen can pick one per cold start, so more of them is better, not wasteful.

**The composition rule, which matters more than the subject.** These get
`object-cover`, so a phone shows roughly the middle half of the width and a
desktop shows roughly the middle half of the height. Anything in the outer
quarter of any edge will be cropped away on some device. Keep the horizon near
the vertical centre and everything that matters inside the middle third both
ways; let the edges run to open sky, haze and ground.

**And they sit under a dark scrim**, so generate them bright and saturated. A
moody, low-key painting turns to mud under a 72%-black overlay; a bright one
turns moody, which is what we want.

> **A1 — the ridge at sunset.** A painterly pixel-art landscape, square, filling
> the whole image edge to edge with no border and no background colour showing.
> A high grassy ridge in the near foreground, a river valley falling away behind
> it, and a low sun sitting on the horizon in the centre of the frame. Sky
> banded from deep blue at the top through violet and rose to hot orange at the
> horizon. Layered purple mountain ranges receding into haze. A few tiny warm
> lit windows in a distant valley village. Warm limited palette, chunky readable
> pixels, dark brown ink outlines rather than black, soft painted clouds. No
> people, no characters, no text, no lettering, no numerals, no signage, no
> frame, no vignette, no watermark, no magenta.
>
> **A2 — the river road at dusk.** A painterly pixel-art landscape, square,
> filling the whole image edge to edge with no border and no background colour
> showing. A wide slow river winding from the bottom centre of the frame toward
> a low sun on the horizon, a dirt road running beside it, reeds and scattered
> broadleaf trees along both banks. Sky banded from deep indigo at the top
> through plum and coral to gold at the horizon, the whole sky reflected in the
> water. Distant hills in flat purple silhouette. Warm limited palette, chunky
> readable pixels, dark brown ink outlines rather than black. No people, no
> characters, no text, no lettering, no numerals, no signage, no frame, no
> vignette, no watermark, no magenta.
>
> **A3 — the mountain pass at first light.** A painterly pixel-art landscape,
> square, filling the whole image edge to edge with no border and no background
> colour showing. A stone pass cutting between two tall peaks in the centre of
> the frame, a narrow switchback trail climbing through it, drifts of low cloud
> caught between the ridges, and pale gold dawn light spilling through the gap
> toward the viewer. Sky banded from cold blue-grey at the top to warm cream and
> apricot at the gap. Pine trees in dark silhouette on the lower slopes. Warm
> limited palette, chunky readable pixels, dark brown ink outlines rather than
> black. No people, no characters, no text, no lettering, no numerals, no
> signage, no frame, no vignette, no watermark, no magenta.
>
> **A4 — the harbour town at golden hour.** A painterly pixel-art landscape,
> square, filling the whole image edge to edge with no border and no background
> colour showing. A small harbour seen from a low hill: tiled rooftops and a
> clock tower stepping down toward the water, fishing boats with furled sails at
> a stone quay, a lighthouse on the far headland, open sea and a low sun beyond.
> Sky banded from deep teal-blue at the top through peach to burning orange at
> the waterline, with long warm reflections across the harbour. Warm limited
> palette, chunky readable pixels, dark brown ink outlines rather than black. No
> people, no characters, no text, no lettering, no numerals, no signage, no
> clock hands or clock numerals, no frame, no vignette, no watermark, no
> magenta.

### Set B — eight loading objects on one sheet

Eight, because that is under the nine-item ceiling where the model starts losing
count. These are cutouts and follow all three sheet rules — magenta, clear
space, no lettering.

> A sprite sheet of eight pixel-art traveller's objects in a 4x2 grid on a flat
> solid magenta background (#FF00FF), evenly spaced, each object centred in its
> own cell with clear magenta space all around it and nothing touching or
> overlapping. Reading order, left to right along the top row then the bottom
> row: (1) an open brass compass lying flat, lid raised, needle catching the
> light; (2) a lit storm lantern, glass glowing warm; (3) an hourglass in a
> wooden frame with sand mid-fall; (4) a rolled map tied with a red ribbon,
> resting on its side; (5) a stone inkwell with a feather quill standing in it;
> (6) a brass spyglass lying across a folded map; (7) a short stack of worn
> leather-bound journals with a ribbon bookmark trailing out; (8) a small
> canvas travelling pack with a bedroll strapped on top. All eight share one
> world: warm limited palette, aged brass, worn leather, dark brown ink outlines
> rather than black, lit from the upper left, chunky readable pixels, no
> anti-aliasing, no dithering, no gradients. No text, no lettering, no numerals,
> no compass-rose letters, no readable markings on the maps or the book covers,
> no borders, no drop shadows, no cast shadows, no ground plane, no scenery.

**Expect the text bans to be tested.** A compass, a map and a book cover are the
three things an image model is most determined to write on; that is why the ban
is repeated four ways rather than once.

**Expect the count to be wrong.** It usually is. Cut whatever comes back and map
cell to id through the table in the slicer, exactly as the foliage sheet's
thirteen-cells-for-twelve-particles was handled.
