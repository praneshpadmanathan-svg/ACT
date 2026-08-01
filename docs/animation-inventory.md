# Animation inventory — everything that could move

A complete pass over the app, surface by surface. Every item is one buildable change.

## Where the motion actually is today

Measured, not guessed:

| Fact | Number |
| --- | --- |
| `@keyframes` in `index.css` | 38 |
| …that are map scenery (`fx-*`) | **37** |
| Files using Motion | 7 (4 of them map/game) |
| `QuestionRunner.tsx` — animation mentions / lines | **2 / 362** |
| `Zone.tsx`, `PassagePanel.tsx` | **0** |

The map is a painted, living world. The rest of the app is a document. A student
spends maybe 8% of their session on the map and 90% inside `QuestionRunner`,
which currently hard-cuts from question to question with no transition at all.

That is the gap. Sections 5–14 below are where the felt difference lives;
sections 19–21 are polish on ground that is already good.

---

## 1. Motion system foundations

Nothing below is worth building twice. These are the shared parts.

1. A named spring set — `SNAP` (UI response), `SETTLE` (panels), `HEAVY` (boss,
   map), `FLOAT` (ambient) — so timing is consistent instead of per-component.
2. A shared `useReducedMotion` gate that swaps every spring for an instant cut.
3. Stagger helper: `stagger(0.04)` container variants, reused by every list.
4. `layoutId` shared-element transitions between list item → detail page.
5. Scroll-linked progress via `useScroll` (parallax, reveal-on-scroll).
6. Velocity-aware transitions — a flick advances faster than a click.
7. Interruptible animations everywhere: springs, never `duration` on gestures.
8. `will-change` hygiene — applied on hover intent, removed on completion.
9. An `AnimatedNumber` component: counts up, tabular-nums, no layout shift.
10. A `<Reveal>` wrapper for on-scroll entrances, one prop for direction.
11. Central `prefers-reduced-data` check to skip ambient loops on metered links.
12. A motion debug overlay (`?motion=slow`) that runs everything at 0.2× to
    review easing without a screen recorder.

## 2. Global primitives (`components/ui.tsx`)

These touch every screen at once — highest leverage in the app.

13. `Button` press physics: `whileTap={{ scale: 0.96 }}` + spring back.
14. `Button` hover: 1px rise, shadow bloom, gradient sheen sweep.
15. Ripple / ink-spread from the actual click coordinates.
16. Focus ring that animates in rather than snapping.
17. Disabled → enabled transition (buttons currently pop into life).
18. Loading state: label crossfades to an inline spinner, width preserved.
19. Success state: label morphs to ✓, holds 600ms, morphs back.
20. `ProgressBar` — add a leading-edge highlight that travels with the fill.
21. `ProgressBar` — a soft pulse on the bar when it crosses a milestone.
22. `ProgressRing` — animate from 0 on mount, not just on change.
23. `ProgressRing` — the % number counts up in sync with the arc.
24. `RankBadge` — currently a static SVG. Add a slow gradient shimmer across
    the shield, and a full spin + flare on rank-up.
25. `Chip` — entrance pop, and a colour-shift transition when its value changes.
26. `Panel` — a subtle lift on hover for anything clickable.
27. `EmptyState` — the dashed border draws itself in; the illustration breathes.
28. `SectionHeading` — eyebrow, title and detail stagger in 40ms apart.

## 3. Shell and navigation

29. Nav glyph micro-animation on hover, one per icon (tent flap lifts, sword
    unsheathes a few px, hourglass tips, crown glints, book opens a page).
30. Active-tab indicator that slides between items via `layoutId` instead of
    appearing.
31. Nav item press: glyph dips, label lags 30ms behind.
32. Mobile menu: panel springs down, items stagger in, backdrop blurs in.
33. Mobile menu close: reverse stagger, faster than the open.
34. Badge counts (due reviews) pop and pulse when the number rises.
35. A thin route-loading bar across the top of the shell.
36. Header condenses on scroll — logo shrinks, border sharpens.
37. `BackLink` arrow slides left on hover.
38. Offline indicator slides down from the top edge, not a static banner.
39. Sync state: a small animated glyph — spinning while syncing, settling to ✓.
40. Rank/XP chip in the header animates when XP changes anywhere in the app.

## 4. Route transitions

41. Directional page transitions — forward routes slide left, back slides right.
42. Map ⇄ zone gets its own transition (zoom into the landmark, not a crossfade).
43. Preserve scroll position with a fade rather than a jump.
44. Cross-fade the parchment texture between screens so paper feels continuous.
45. Entering a quiz: the world dims and the sheet rises — a "sitting down" beat.
46. Leaving a quiz: the sheet drops away and the world lifts back.
47. Skeleton screens that pulse for the content chunk's load.
48. Error boundary: the panel shakes once on mount.

## 5. QuestionRunner — the big one

The most-seen component in the app, and currently the least animated.

49. **Question-to-question transition.** Today `setIndex(i+1)` is a hard cut.
    Old sheet slides out left, new one in from the right, 240ms.
50. Choices stagger in 35ms apart under the prompt.
51. Choice hover: 2px slide right, key-letter badge brightens.
52. Choice press: scale 0.98 with spring return.
53. Selected-but-unrevealed: the border draws around the choice.
54. **Correct reveal:** green wash sweeps left-to-right across the row, the ✓
    stamps in with an overshoot, the row lifts 2px.
55. **Wrong reveal:** the chosen row shakes horizontally (small, 3 cycles), then
    desaturates; the correct row illuminates a beat later — order matters, it
    reads as "not that … *this*".
56. Unselected rows fade to 55% on reveal so the eye goes to the two that matter.
57. Explanation panel: height auto-animates open rather than appearing.
58. Within the explanation, "why wrong" and "why right" stagger 80ms apart.
59. The explanation's left rule draws downward as the text fades in.
60. `Next question` button slides up into place after the explanation settles.
61. Progress bar advances with a spring, and the leading edge flares on landing.
62. `3/20` counter rolls like an odometer instead of swapping.
63. Streak chip: currently `animate-popIn` and nothing else. Escalate it —
    see section 20.
64. Streak break: the chip cracks and falls away rather than vanishing.
65. Session clock: pulses red in the last 20% on timed runs.
66. Per-question timer ring around the question number (test mode).
67. Keyboard answer (A–D) triggers the same press animation as a click, so the
    two input paths feel identical.
68. A small XP number flies from the answered choice to the header XP chip.
69. First correct answer of a session gets a one-off sparkle — reward the start.
70. Difficulty tag pulses once on a `hard` question — earned tension.
71. Topic label writes on like handwriting (stroke reveal) — it is a quill app.
72. Passage and question column enter with a 60ms offset, not together.
73. Scroll-to-top between questions should animate, not jump.

## 6. Reading surfaces

74. `PassagePanel` — zero animation today. Fade + rise on mount.
75. Line-number gutter fades in after the text.
76. Highlighting a passage line: the highlight sweeps rather than appears.
77. Sticky passage header gains a shadow as content scrolls under it.
78. Paragraph-by-paragraph reveal on first render, 25ms apart.
79. `RichText` — bold/italic spans get a one-time ink-settle on first paint.
80. Long passage: a reading-progress hairline down the left edge.
81. Split view: the divider between passage and question can be dragged, with
    spring resistance at the limits.

## 7. Zone — lesson into quiz

82. Landmark header art parallaxes as the page scrolls.
83. Lesson sections reveal on scroll rather than all at once.
84. The "start quiz" button breathes gently once the lesson is scrolled through.
85. Lesson → quiz: the lesson folds up and the quiz sheet unrolls.
86. Objective checklist items tick with a draw-on check mark.
87. Zone completion: the seal stamps down, wax spreads, embossing catches light.
88. 70% threshold met: the bar fills to the mark, then the mark ignites.
89. Below threshold: the bar stops short and the mark stays cold — the failure
    should be as legible as the success.
90. "Road ahead opens" — the next landmark's lock breaks apart.
91. Retry: the sheet shuffles back to the top of the deck.
92. Zone intro: Wizzy leans in from the edge to introduce the skill.
93. Region accent colour bleeds into the page chrome on entry.

## 8. Library / Notes

94. Note cards stagger in on grid mount.
95. Card hover: lifts, and the page-corner curls.
96. Card → note page via `layoutId` — the card grows into the sheet.
97. Table of contents highlights the active section as you scroll.
98. Section jump scrolls smoothly with easing, not `scrollIntoView` instant.
99. Search: results reorder with layout animation instead of re-rendering.
100. Search with no results: the empty state fades in with a small shrug.
101. "Read" checkmark draws on when a note is finished.
102. Reading progress bar across the top of the note.
103. Related-notes footer slides up when you reach the bottom.

## 9. Training / Drills

104. Topic picker cards flip to show accuracy on the reverse.
105. Selected topics gather toward the "start" button.
106. Difficulty selector: the thumb slides between the three settings.
107. Question-count dial responds to drag with momentum.
108. Weak-topic recommendation pulses to draw attention.
109. Drill start: a countdown 3-2-1 with scale-down beats.
110. Drill summary: the accuracy ring draws while the number counts up.
111. Per-topic result rows stagger, best-first, as bars grow from zero.

## 10. Review

112. Due-card count ticks down visibly as each is cleared.
113. Cards physically leave the deck — swipe out on answer.
114. The deck behind shows 2–3 stacked edges that shift forward.
115. Interval promotion (1 day → 3 → 7): the new interval stamps on.
116. "Nothing due" state: the hourglass glyph runs its sand and settles.
117. Review streak calendar fills the day's cell with a spreading wash.

## 11. Summit / Tests

118. Test start: a formal, slower transition — curtains, seal breaking, a held
     beat. It should feel heavier than a drill.
119. Section transitions inside the test: a clean slate wipe with the new
     section's name.
120. Timer: the last 60 seconds pulse; the last 10 shift colour per second.
121. Question palette (jump grid) — cells fill as they are answered.
122. Flagged questions pulse slowly in the palette.
123. Submit confirmation: the panel rises with weight behind a blur.
124. Score reveal: hold, then count each section up in sequence, then composite.
125. Composite score lands with a shockwave ring.
126. Score comparison to previous attempt: a needle sweeps from old to new.
127. Section bars grow left-to-right, staggered, on the report.
128. Weakest-topic callouts slide in after the bars settle.
129. Report → drill on that topic: the callout morphs into the drill card.

## 12. The duel

Already the most animated screen after the map — these deepen it.

130. Boss entrance: currently `bossEnter`. Add a screen-shake and a dust ring.
131. Idle breathing that varies with remaining health — faster when hurt.
132. Player attack: a slash arc across the boss, timed to the sfx.
133. Hit-stop — freeze all motion for 60ms on impact. This one line of code does
     more for game-feel than any particle system.
134. Damage numbers fly up from the hit point.
135. Health bar: fast drain to the new value, plus a slower white "ghost" bar
     behind it showing what was just lost.
136. Boss hurt: white flash, recoil, chromatic offset for 80ms.
137. Player hurt: the screen edge flashes red, the HUD shakes.
138. Low health (<25%): a slow red vignette pulse.
139. Boss telegraph before a hard question — a wind-up the player can read.
140. Combo counter grows and tilts as it climbs.
141. Boss defeat: stagger, kneel, dissolve into motes drifting upward.
142. Victory: the region's colour floods back over the grey.
143. Defeat: desaturate to grey, the boss looms, a slow fade.
144. Boss art idle-parallax against the background layer.
145. The four guardian sigils orbit the boss during its intro.
146. Between-round beat: a short breather with the score.
147. Wizzy reacts on the sideline — cheering, wincing.

## 13. Progress / Stats

508 lines of charts with three animation mentions. Charts are the easiest thing
in the app to make feel alive.

148. Every bar grows from zero, staggered, on mount.
149. Every number counts up.
150. Line charts: the path draws with `pathLength`.
151. Chart hover: the bar lifts and a tooltip springs in.
152. Section accuracy rings draw in sequence, not simultaneously.
153. The 12-week activity grid fills cell by cell, left to right.
154. Today's cell pulses.
155. Topic table rows stagger in.
156. Sorting the table animates rows to new positions via layout.
157. Accuracy deltas (+3%) slide up in green / down in red.
158. XP total rolls like an odometer.
159. Rank progress bar fills to the current point on mount.
160. The next-rank sigil sits ghosted and brightens as you approach it.
161. Empty stats: a "no data yet" illustration that gently animates.
162. Export button: paper slides out of a tray on click.
163. Danger-zone actions (delete) require a press-and-hold with a filling ring —
     motion as a safety mechanism, not decoration.

## 14. Camp / Home

164. Hero panel: the campfire flickers (light on surrounding elements, not just
     the fire itself).
165. Smoke drifts from the fire.
166. Wizzy sits by the fire and idles.
167. Today's-plan card entrance stagger.
168. Plan items tick off with a draw-on check.
169. Days-until-test counter ticks over at midnight with a flip.
170. Weekly ring fills on mount and pulses when the goal is met.
171. Streak flame grows with streak length — literally taller at 7, 30, 100.
172. Region cards: art parallax on hover.
173. Region card progress rings draw on scroll into view.
174. "Continue where you left off" card slides in with priority.
175. Greeting text changes with time of day and crossfades.
176. Ambient particles (embers, fireflies) over the camp panel.
177. New-achievement banner drops in from the top.

## 15. Landing

The first ten seconds decide whether anyone stays.

178. Hero art: multi-layer parallax on scroll and pointer.
179. Headline words rise in sequence.
180. `754 / 4 / 37 / 100%` stat counters count up on scroll into view.
181. Primary CTA breathes, and sheens every few seconds.
182. Region cards reveal on scroll with alternating direction.
183. Region card hover: the art zooms inside a fixed frame.
184. Feature grid staggers in on scroll.
185. Each feature icon has a hover micro-animation.
186. "How it works" 1-2-3: a line draws between the steps as you scroll.
187. Footer seal spins slowly, forever.
188. Scroll-progress indicator down the page edge.
189. Section dividers draw themselves as flourishes.

## 16. Auth, onboarding, age gate

190. Field focus: the label floats up, the border draws.
191. Validation error: shake the field, slide the message down.
192. Password strength meter fills continuously as you type.
193. Sign-up → "check your email": the panel flips.
194. Tab switch (New traveller ⇄ Returning): the panel slides and the height
     animates between the two form sizes.
195. Submit: the button morphs to a spinner and then to ✓.
196. Age gate: the three fields advance focus with a slide.
197. Age-gate outcome: an approving beat before the route changes — right now
     the screen simply swaps.
198. Onboarding steps: a progress dot rail that slides between steps.
199. Region choice: the chosen region's card grows to fill the screen before the
     map loads.
200. Test-date picker: the day count animates as the date changes.
201. Onboarding finish: the confetti burst already fires — precede it with a
     seal stamp so it has a cause.

## 17. Wizzy

The guide should feel present, not pasted.

202. Idle float, plus an occasional blink.
203. Speech: the beard/hat bob per syllable while text types on.
204. Text types on character by character with a skip-on-tap.
205. Staff tip glows brighter while speaking.
206. Enter and exit by walking in from the page edge.
207. Gesture animations — points at the landmark he names.
208. Emotional states: pleased, concerned, urgent, each with a distinct idle.
209. Speech bubble tail springs from Wizzy's mouth position.
210. Bubble resizes fluidly as text streams in, rather than reserving height.
211. Idle-too-long: he taps his staff and looks at the player.
212. On the grey plague warning, his light visibly pushes the grey back.
213. Following the camera on the map — parallax against the world layer.

## 18. Story overlay

214. Letter-boxing bars slide in for story beats.
215. Background art slow-zooms (Ken Burns) under the text.
216. Text reveals line by line, not block by block.
217. Choices stagger in after the text finishes.
218. Choice hover: the marker slides to the left of the option.
219. Choice commit: the others fade before the overlay closes.
220. Overlay exit: the world blooms back in from dim.
221. Chapter titles with a letter-spacing settle (`storyTitle` exists — extend
     it to sub-headings).

## 19. Map — still missing

Already the richest surface. Everything here is additive.

222. Weather system: rain, and it darkens the terrain beneath it.
223. Day/night cycle tied to the device clock.
224. Lightning inside the distant squalls.
225. Snow on the Science Cliffs peaks.
226. Water reflections that ripple under the waterfall.
227. Wildlife: fish jumping, deer at the treeline.
228. Smoke from village chimneys in the Grammar Village.
229. Sand drifts moving across the Number Desert.
230. Fireflies in the Enchanted Woods after dark.
231. The road itself draws forward as landmarks unlock.
232. Footprints left behind the traveller, fading over time.
233. Traveller walk cycle rather than a glide.
234. Traveller pauses and looks around on arrival.
235. Grey plague visibly receding as a region is cleared — the core promise of
     the story, currently static.
236. Cleared-region colour restoration as a spreading wash.
237. Landmark pin idle variation so 37 pins do not pulse in lockstep.

## 20. Reward escalation (cowork §2.4, still open)

The single highest-value item in this document. Right now every correct answer
looks identical, so nothing accumulates.

238. Tier 1 (1–2 correct): tick, small glow, 80ms.
239. Tier 2 (3–5): brighter flash, a rising tone, the streak chip grows.
240. Tier 3 (6+): screen-edge glow, particles, the chip catches fire.
241. Escalating audio pitch per streak step (`sfx.combo` already accepts a level).
242. Streak milestones at 5/10/25 get a named banner.
243. Perfect-run detection with a distinct end-of-session celebration.
244. Personal best beaten: a marker on the progress bar is passed and flares.
245. Cool-down — after a wrong answer the escalation resets visibly, so the
     player *sees* what they lost.

## 21. Landmark transition (cowork §2.5, still open)

Depends on the anchored-zoom maths already shipped in `af1abe5`.

246. Map → landmark: zoom into the pin, the world blurs out, the sheet resolves.
247. The pin stays anchored under the pointer throughout the zoom.
248. Landmark → map: reverse, landing on the same pin, now cleared.
249. The newly cleared pin pulses once when the map resolves.
250. The camera then pans to the next landmark of its own accord.
251. Region complete: the camera pulls back to frame the whole region.

## 22. Ambient and system

252. Idle detection — after 30s the page gets subtler ambient motion.
253. Tab-blur pauses ambient loops (also a battery win).
254. First-visit-only flourishes, remembered per user.
255. Time-of-day tinting across the whole app.
256. Loading states that are on-theme — a spinning compass, not a spinner.
257. Offline banner slides in; reconnect gets a settling ✓.
258. Service-worker update prompt slides up from the bottom.
259. PWA install prompt: an animated hint at the browser's install affordance.
260. Toast stack: new toasts push older ones down with layout animation.
261. Achievement unlocks queue rather than overlapping.
262. Error boundary: the page tears like paper.
263. 404: a lost-traveller animation.

## 23. Motion coupled to the existing audio engine

`sfx.ts` is a full synthesiser. Nothing visual is currently keyed to it.

264. Every visual beat gets its audio counterpart at the same frame.
265. Visual pulses on the beat of the combo tones.
266. Screen shake amplitude scaled to hit volume.
267. Wizzy's mouth movement driven by the actual speech envelope.
268. A muted-audio fallback that strengthens the visual feedback to compensate.
269. Ambient map audio that ducks when a UI sound plays.

## 24. Guardrails

Not optional, and cheaper to build in than to retrofit.

270. `prefers-reduced-motion` honoured for every item above — the reduced path
     should still communicate state, just without travel.
271. Never more than 3 flashes per second (WCAG 2.3.1) — applies to §20 tier 3.
272. `transform` and `opacity` only; no animated `width`, `top`, `filter` in
     loops.
273. Cap simultaneous animated elements; the map already runs ~40.
274. Pause everything off-screen via `IntersectionObserver`.
275. No layout-shifting animation on text — hurts reading, and reading is the
     product.
276. Every entrance animation must be skippable by interacting.
277. Nothing gating input on an animation finishing — `rAF` runs at 0fps in a
     hidden tab, and a state machine waiting on `onAnimationComplete` will
     deadlock there.
278. Keyframes that set `transform` on `.mapfx > span` must preserve
     `translate(-50%, -50%)` — `scripts/check-map-animations.mjs` enforces this
     at build time; keep it passing.

---

## If you only do ten

1. §5.49 — question-to-question transition
2. §20.238–240 — three-tier reward escalation
3. §5.54–56 — correct/wrong reveal choreography
4. §2.13–15 — button press physics (touches every screen)
5. §12.133 — hit-stop in the duel
6. §13.148–150 — charts that draw and count
7. §21.246 — the landmark zoom transition
8. §3.30 — sliding active-tab indicator
9. §15.178–180 — landing parallax and counters
10. §17.203–204 — Wizzy speaks instead of appearing
