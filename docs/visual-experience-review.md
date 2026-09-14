# Living Realm: graphics, motion, and journey review

Status: local design branch only. No push or deployment authorized for this pass.

## Review boundary

This review combines the previously observed live desktop guest journey with the current local source and artwork. The live site still shows the old deployment. The local redesign has not been visually verified in the browser: local preview access was blocked. Source inspection and passing builds do not establish visual quality, frame rate, mobile fit, or cloud-account correctness.

The first implementation was a foundation, not the promised finished animated game. It reused existing artwork, bobbed static character cutouts, and added ambient CSS. It did not add rigged characters, true terrain parallax, animated guardian frames, or a landmark-specific restoration scene.

## Changes made during this review

- New wide opening illustration composed around the actual heading position; responsive WebP/AVIF sizes and an offline-compatible original.
- Illustrated region destinations shared between landing and Camp, with real landmark counts, clear destinations, keyboard focus, and restrained hover movement.
- Onboarding now names all three chapters: goals, traveller, adventure. The four-question percentage describes only the goals chapter.
- Reward scenery now follows the relevant subject region instead of always showing a harbour.
- Ambient scene animation pauses outside the viewport and while the document is hidden. Reduced-motion and reduced-data handling remains present.

## Art direction decisions

Use atmosphere and silhouette to distinguish regions. Keep text readable without relying on moving scenery. Warm gold means the main action or a milestone; each region owns a secondary accent. Reserve cinematic movement for entering places and earning meaningful progress. Keep study controls stable.

The new opening establishes the desired environment quality, but the legacy character, map and camp assets still need art-direction reconciliation. Avoid calling a richer background a complete visual redesign.

## Screen and system review

| Surface                | Finding                                                                                                   | Next concrete change                                                                                               | Priority            |
| ---------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------- |
| Opening                | Square reused art was being enlarged and cropped; fixed in this pass.                                     | Verify text placement at narrow, ultrawide, and enlarged-text sizes.                                               | Now                 |
| Landing body           | Repeated feature grids explain the product more than they demonstrate the game.                           | Replace one redundant grid with a brief playable restoration preview, clearly labelled as a demo.                  | High                |
| Region cards           | Previously text-heavy; now illustrated destinations.                                                      | Confirm portraits crop gracefully and all titles fit at 130% text size.                                            | Now                 |
| Onboarding             | Four questions were followed by additional uncounted stages.                                              | Chapter strip added; next preserve a region selected on the landing page through setup.                            | High                |
| Hero selection         | Small static sprites and captions; selecting a portrait has little personality.                           | Add a large selected-character stage and authored greeting/celebration frames. Preserve the eight identities.      | High                |
| Camp                   | New vista improves the focal point, but secondary sections still form a long dashboard.                   | Group daily/review as a compact quest journal; lower account prompts; let earned keepsakes inhabit a trophy shelf. | High                |
| World map              | One bitmap carries most visual detail; labels and props scale differently.                                | Separate true foreground/background assets; verify every landmark against revised camera framing.                  | High                |
| First map visit        | Grey overlay and locked pins can overwhelm the invitation to explore.                                     | Keep the starting landmark and route visible; introduce map controls in one short cue.                             | High                |
| Traveller movement     | A translated/bobbing single frame does not look like walking.                                             | Create idle/walk/arrive/celebrate frames with consistent foot position and shadow.                                 | Highest art need    |
| Restoration            | Existing regional desaturation removal is gradual and easy to miss.                                       | Build one local reveal around a cleared landmark, then apply its pattern to other landmarks.                       | Highest motion need |
| Discoveries            | Markers and reveal cards exist; their identity is weaker than numbered skills.                            | Give discovery types distinctive drawn marks and a collectible journal illustration.                               | Medium              |
| Journal                | A functional list rather than a compelling collection.                                                    | Add discovered illustrations, hidden silhouettes, and clear completion progress.                                   | Medium              |
| Wizzy/story            | Static figure, typewriter text, overlays and scene shake can compete.                                     | Use a small set of expressive poses; shorten transitions; keep skip/continue visible.                              | High                |
| Region path            | Existing scenic backdrop can bridge the map and learning.                                                 | Carry the same region vignette into landmark introduction; avoid unrelated decoration.                             | High                |
| Lesson                 | Broad outer layout previously wasted space beside a narrow column.                                        | Keep the readable column; add a compact region banner and a clear next action.                                     | Medium              |
| Quiz                   | Multiple feedback channels—choice state, combo, sound, XP, toast—can fire together.                       | Establish a feedback priority: answer first, reward second, story after session.                                   | High                |
| Reward                 | First pass corrected purple/neon mismatch; this pass fixes generic scenery.                               | Animate earned XP once and show a visual landmark before/after. Keep completion actions immediately available.     | High                |
| Guardians              | Single-frame character art and a separate question renderer.                                              | Commission pose sets and regional arenas; fix passage support before encounter QA.                                 | High                |
| Training               | Many equivalent topic cards flatten hierarchy.                                                            | Add an illustrated training header, a clear recommended session, and compact topic rows.                           | Medium              |
| Review/bookmarks/daily | Similar functionality presented through separate entry points.                                            | Use a shared journal visual language and distinct empty states.                                                    | Medium              |
| Test setup             | “Boss battles” label conflates the timed-test summit with guardians.                                      | Give Summit its own visual identity and accurate practice-length labels.                                           | High                |
| Diagnostic             | Should feel like an introduction, not another gate.                                                       | Maintain untimed, optional setup; use calm progress and a useful closing summary.                                  | Medium              |
| Reports/stats          | Large numerical cards plus legacy neon colors; zone and drill performance appear inconsistent.            | Use one palette and clearly labelled progress sources, then add earned milestone illustrations.                    | Medium              |
| Profile                | Character selection, account settings, ranks, and achievements form a long mixed page.                    | Separate traveller/collection from account preferences visually.                                                   | Medium              |
| Loading                | Several unrelated illustrations and scene entry treatments.                                               | Use the destination’s illustration and reserve layout dimensions; avoid delaying content for an animation.         | High                |
| Navigation             | Seven destinations fit awkwardly on smaller desktops and hide behind mobile menu.                         | Prototype a compact desktop rail and four mobile destinations plus More; keep study mode distraction-light.        | High                |
| Sound                  | Synthesized cues are useful, but deferred-feedback mode still leaks correctness sounds in current source. | Use a neutral selection cue during timed/diagnostic modes; batch celebration sounds.                               | High                |
| Light theme            | First pass changes global tokens while several screens retain hardcoded colors.                           | Contrast audit on both themes; never invert artwork colors to achieve light mode.                                  | High                |
| Reduced motion         | Global support exists, but every newly added effect needs an equivalent static state.                     | Verify all controls, rewards and story remain complete with motion disabled.                                       | Required gate       |
| Offline/performance    | Large art and simultaneous effects can undermine the premium feel.                                        | Keep responsive formats, lazy region art, paused offscreen effects, and a measured mobile performance budget.      | Required gate       |

## Motion choreography

These are design targets, not measured implementation claims.

- Pointer/keyboard acknowledgement: 100–160 ms; small lift or border change.
- Panel entrance: 200–320 ms; opacity plus at most 12 px of movement.
- Destination arrival: 500–800 ms; no interaction blocked until completion.
- Landmark restoration: approximately 1.6–2.2 seconds, skippable and replayable from its journal entry.
- Ambient movement: independent slow cycles, sparse particles, no full-screen flashing.
- Rank-up: one hero event. Queue subordinate achievement toasts rather than stacking full-screen overlays.

Restoration storyboard: camera frames the landmark → local mist thins → windows/path illuminate → traveller celebrates → a journal stamp appears → next destination is indicated. Persist learning progress first. Replaying or skipping the animation must never duplicate rewards or lose completion.

## Recommended next implementation order

1. Visually verify the local opening, Camp, portals, onboarding and reward at desktop and mobile sizes.
2. Build one complete restoration scene plus an authored traveller walk/celebration set.
3. Extend the same art direction into the map and a guardian arena.
4. Unify journal, story and reward choreography.
5. Finish secondary screen styling and navigation.

Do not regenerate the map blindly: all landmarks, effects, trails and discoveries rely on its current percentage coordinates. A new map requires a coordinate re-authoring and verification pass.

## Opening artwork provenance

Created with the built-in image-generation tool. Asset: `public/art/realm-opening-v2.webp`; responsive derivatives in `public/art/gen/`. This is a background asset, not a screenshot of a working scene. Motion is supplied separately by CSS.

Prompt:

> Create an original premium fantasy adventure game environment, a cinematic landscape website hero illustration, wide 16:9 composition. No text, logos, interface, letters, or watermark. An inviting miniature hand-painted world at blue hour: on the right two thirds, a luminous winding river, a stone footbridge, a small village of warm lantern-lit cottages among emerald pines, an elegant observatory on a distant hill, misty teal mountain layers and a few luminous fireflies. The left third deliberately dark quiet midnight teal forest silhouettes and atmospheric mist with low detail, suitable for overlaid white heading text. Sophisticated painterly 3D diorama depth with tactile stone and foliage, delicate edges, cinematic atmospheric perspective, warm restrained gold lighting contrasted with deep blue green shadows. Whimsical, welcoming, memorable, very high craft. No characters, no pixel art, no photorealism, no generic shiny mobile game plastic. Keep distant landscape readable and make the river and bridge the focus. This is an actual background asset, not a screenshot or mockup.

## Final pre-commit verification

Reviewed the cumulative branch diff against `main`. Fixed remaining landing CTAs switching returning users to guest mode, scoped cinematic control colors for light-theme readability, and added wrapping/mobile layout safeguards for long player names. Added three animation lifecycle regression tests covering offscreen pause/resume, hidden-tab behavior, and observer cleanup/fallback.

Validation: production build passed; 155 tests across seven files passed; lint has zero errors and 15 existing warnings; 13 artwork originals and 68 responsive variant references validated; all 118 precache paths exist, including the new opening original. Browser visual QA remains pending; no push or deployment performed.
