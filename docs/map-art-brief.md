# Commissioning a new world map

The map is the one asset the whole game is built on: 37 landmark pins, 14
discoveries, 4 region plaques and the mist bands are all positioned as
percentages of this single image. A replacement has to keep the same *layout*
or every one of those coordinates has to be re-derived by hand.

Read this before generating anything.

---

## Hard constraints

| Thing | Value | Why |
| --- | --- | --- |
| Aspect ratio | **768 × 1376** (portrait, ~1:1.79) | `MAP_W`/`MAP_H` in `AdventureMap.tsx`. A different ratio stretches every pin. |
| Format | WebP, under ~350 KB | The current map is 297 KB. |
| Orientation | North at top, four horizontal bands | Regions are stacked top to bottom. |
| Region order | village → forest → desert → cliffs → citadel | Top to bottom. Pins assume this. |
| Edges | Land, not vignette | Pins sit as close as x=7% and x=92%. |

### The four bands, by vertical percentage

These are the bands the mist covers (`MIST_BANDS` in `DiscoveryLayer.tsx`) and
where the pins live (`REGIONS` in `mapData.ts`):

| Band | y range | Must contain |
| --- | --- | --- |
| Grammar Village | **0–23%** | Cottages, ploughed and golden fields, a great oak, a standing stone, a crossroads where two tracks fork, a tilled field, a stone bridge over a river, a watchtower, a well, a woodcutter's tent |
| Enchanted Woods | **23–43%** | One enormous tree with exposed roots, glowing mushroom groves, a shrine in a clearing, a ruined stone tower, a still pool with a jetty, a waterfall at the far left, a crystal cave at the far right |
| Number Desert | **43–59%** | Mesas with a cave mouth, a broken aqueduct, a ruined colonnade, one great ornate arch, a watchtower, an erupting volcano, a lit signal fire on a spire, a stranded river boat at the left |
| Science Cliffs | **59–81%** | A tall ship at sea, a lone sea stack, a lighthouse, two cliff cottages, a stone stair climbing, a citadel with a copper observatory dome, a telescope yard, a clock tower, a rainbow crystal cave at the right |
| The Summit | **81–100%** | A golden citadel on an island, gate facing north, water all around |

---

## The prompt

> A hand-drawn fantasy world map in ink and watercolour wash, portrait
> orientation, tall and narrow (768×1376). Muted natural pigments on aged cream
> paper — sage and moss greens, ochre and wheat, terracotta and rust, slate blue
> sea. Fine brown ink linework over soft colour washes, in the style of a
> printed endpaper map from an illustrated novel. Isometric three-quarter view
> looking down, consistent across the whole sheet.
>
> Arranged as four horizontal bands from top to bottom:
>
> **Top quarter** — green farmland valley: thatched stone cottages, ploughed
> golden fields, hedgerows, a great spreading oak, a carved standing stone, a
> fork in a pale dirt road, a stone arch bridge over a river, a round
> watchtower, a stone well, a woodcutter's tent beside stacked logs.
>
> **Second quarter** — dense enchanted forest: one enormous ancient tree with
> huge exposed roots at the centre, groves of glowing violet and green mushrooms,
> a small stone shrine in a clearing, a crumbling ivy-covered tower, a still dark
> pool with a wooden jetty, a tall waterfall falling into a gorge at the far
> left, a cave of pale blue crystals at the far right.
>
> **Third quarter** — red rock desert: flat-topped mesas, a dark cave mouth in a
> cliff face, a broken Roman-style aqueduct, a ruined colonnade of fallen
> columns, one enormous carved ceremonial stone arch, a square desert watchtower,
> an erupting volcano with glowing lava at the right, a burning signal beacon on
> a rock spire, a wooden river boat stranded on dry sand at the left.
>
> **Bottom quarter** — sea cliffs and a walled stone city: a tall sailing ship on
> blue water, a lone sea stack, a white lighthouse on a headland, two small cliff
> cottages, a paved stair climbing the rock, a fortified citadel with a copper
> observatory dome, brass telescopes on a rampart, a clock tower, a cave of
> rainbow crystals at the far right, and at the very bottom a golden citadel on
> its own island surrounded by water.
>
> No text, no labels, no lettering, no compass rose, no border frame, no grid.
> Land must reach the left and right edges. Even lighting, no strong shadows.

**Negative prompt:** `text, letters, words, labels, captions, title, compass
rose, border, frame, watermark, signature, grid lines, photorealism, 3D render,
harsh shadows, vignette, dark edges, modern buildings, people, close-up`

---

## After you have an image

1. Convert and check the size:
   ```bash
   npx sharp-cli --input new-map.png --output public/art/world-map.webp resize 768 1376 -- webp --quality 86
   ```
2. **Re-derive every coordinate.** Do not assume they carry over. The script at
   `scratchpad/verify.js` composites all 37 pins onto the illustration labelled
   with their names — run it and look at the four PNGs. Anything sitting beside
   its feature rather than on it needs moving in `mapData.ts`.
3. Do the same for the 14 entries in `discoveries.ts`.
4. Re-check the region plaques: the ink is dark, and it was measured against the
   artwork at 1.50:1 over the old forest canopy before a light ring was added.
   Re-measure with `scratchpad/plaque.js`.

Budget an hour for step 2 alone. That is the real cost of a new map, and it is
why the layout constraints above are worth honouring.

---

## Generating it

Any of these will work; all need the aspect ratio forced:

- **Midjourney** — append `--ar 9:16 --style raw --v 7`
- **DALL·E 3 / ChatGPT** — ask for portrait 1024×1792, then downscale
- **Stable Diffusion / Flux** — 768×1376 directly, CFG ~6, an illustration or
  storybook LoRA helps a lot
- **Ideogram** — good at *not* adding text, which is the usual failure here

The most common failure is a compass rose or a decorative border creeping in.
The second most common is the bands drifting out of their percentage ranges —
check the four y-ranges above against the result before committing to it.
