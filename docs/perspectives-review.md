# Ten people look at ACT Command

A top-to-bottom review from ten different chairs. Graphics is the main concern, so
the art director goes first and gets the most room — but every other perspective
turns up things the art can't fix.

Companion documents: `docs/animation-inventory.md` (278 motion items),
`docs/program-improvement-roadmap.md` (107 engineering/product items). This one is
about how the thing *looks and lands* on the people who encounter it.

---

## The measurement that frames the whole graphics conversation

Every visual asset in the product, measured:

| File | Native size | Alpha | Used on | Style |
| --- | --- | --- | --- | --- |
| `world-map.webp` | 768 × 1376 | no | the map (the centrepiece) | painted ink-wash |
| `camp-bg.webp` | 1376 × 768 | no | **5 screens** | painted ink-wash |
| `landing-hero.webp` | 1024 × 559 | no | landing | **16-bit pixel art** |
| `wizzy.webp` | 470 × 640 | yes | guide, story | inked cartoon |
| `hero-char.webp` | 346 × 640 | yes | player, duel | inked cartoon |

**That is the entire art library. Five images, ~684 KB.** Plus roughly 430 lines of
hand-written SVG covering four bosses, the rank sigils, and the nav glyphs.

Three numbers that matter more than any opinion below:

- **The map renders at 1.67× upscale** on a 1280×720 desktop at DPR 1 — measured live,
  not estimated. On a 1440×900 retina laptop it is **3.75×**. The single most important
  image in the product is blurry on every device it runs on.
- **Only ~31% of the map is visible at once.** Cover-fit scales 768×1376 to 1280×2293
  inside a 720px-tall viewport. **69% of the artwork you paid for is off-screen** at any
  moment, and the portrait aspect fights every landscape screen it lands on.
- **Four mutually incompatible art styles** ship in one product. Pixel art greets you,
  painted illustration follows, inked cartoons walk around on top of it, and flat vector
  doodles are the bosses.

---

## 1. The art director

*Main concern. This section is the answer to "the graphics could be 100× better."*

### 1a — Style coherence: the single biggest problem

The first screen a visitor sees is **pixel art**. The second is a **painted storybook
illustration**. Standing on it is an **inked cartoon character**. The boss they fight at
the end of the region is a **flat vector shape with three dots for eyes**. Nothing signals
"one world" — it reads as four asset packs bought from four different stores.

1. **Pick one style and rebuild to it.** This is the 100× change; everything else in this
   section is detail. The painted ink-wash of `world-map.webp` and `camp-bg.webp` is the
   strongest and most distinctive of the four — it should win, and the other three should
   be redrawn into it.
2. **Kill the pixel-art landing hero** (`landing-hero.webp`, `Landing.tsx:236`). It is the
   *first* thing anyone sees and it promises a retro platformer the app never delivers.
   Replace with a painted vista in the map's register.
3. **Redraw the four bosses** (`src/game/BossArt.tsx`, ~45 lines of flat SVG each). They
   are the climax of a region and currently look cheaper than the overworld — a
   200×200 viewBox with `<ellipse>` eyes. The emotional peak of the game is its weakest art.
4. **Redraw Wizzy and the hero** into the painted register, or repaint the map toward the
   inked-cartoon register. Either direction works; the current split does not.
5. **Write a one-page style bible** — line weight, palette, light direction, level of
   rendering, how edges are treated — before commissioning or generating anything else.
   Four styles happened because nothing was written down.
6. **Unify light direction.** The camp is lit warm from a lantern at frame-right; the map
   is lit flat/ambient; the hero cutout has soft top-left studio light. Cutouts placed on
   backgrounds visibly disagree about where the sun is.
7. **Establish one outline treatment.** `BossArt.tsx` uses a hard 3px `#241a10` stroke; the
   painted assets have soft variable-width ink; the pixel hero has none. Pick one.

### 1b — Resolution: the art you have is being destroyed at render time

8. **Re-export `world-map.webp` at 2304 × 4128** (3×). At 1.67–3.75× upscale the existing
   file is soft on every screen — all the painted detail is being thrown away by the
   scaler before anyone sees it.
9. **Ship responsive map sources** — `srcset`/`<picture>` at 1×/2×/3×, so a phone doesn't
   download a desktop-sized map and a retina laptop isn't served a blurry one.
10. **Re-export `landing-hero.webp` at 2048+ wide** (currently 1024, displayed full-bleed).
11. **Re-export `wizzy.webp` and `hero-char.webp` at 2×.** At 470×640 and 346×640 they are
    already soft in the duel, where `hero-char` renders up to 140px wide — fine — but the
    story overlay shows Wizzy far larger.
12. **Add AVIF alongside WebP.** Typically 20–30% smaller at the same quality, which buys
    back the bytes that higher resolution costs.
13. **Set explicit `width`/`height` on every `<img>`** to stop layout shift as art loads.
14. **Serve a blurred/tiny placeholder** (LQIP) for the map and camp backgrounds so the
    first paint isn't an empty dark rectangle on a slow phone connection.

### 1c — Asset coverage: five images cannot carry 37 landmarks

15. **`camp-bg.webp` appears on five screens** — Home, Auth, Legal, Onboarding, and the
    story overlay. The app feels smaller than it is because you keep landing in the same
    tent. Needs at least three more environment backgrounds.
16. **The 37 landmarks have no art of their own.** They are generic pins on a shared
    bitmap. The Wayside Cottages, the Cave Mouth and the Clock Tower are narratively
    distinct places that look identical to the player.
17. **Give each of the four regions its own zone-header illustration** — one per region is
    four images and would do most of the work of 37.
18. **`camp-bg.webp` has a torn dark vignette baked into the pixels.** Used full-bleed with
    `object-cover` (`Home.tsx:48`), that border is either cropped off or shows as a muddy
    edge. Re-export clean and apply any vignette in CSS where it can adapt.
19. **The camp map prop reads "AETHELIA"** — a world name baked into the artwork that
    appears nowhere in the app's writing. Either adopt it as the world's name or paint it out.
20. **No empty-state art anywhere.** `EmptyState` in `ui.tsx` is a dashed rectangle with
    text. These are exactly the moments a little character work pays off.
21. **No achievement/badge art.** 15 achievements in `progress.ts`, all rendered as a
    generic icon name string (`'star'`, `'bolt'`, `'flame'`).
22. **No art for the four guardians/bosses outside the duel** — they're referenced in the
    story and on the map but have no portrait.

### 1d — The map, specifically

The map is the product's identity. It deserves its own list.

23. **It is one flat bitmap, and that caps everything.** It cannot parallax, cannot change
    time of day, cannot show weather, and — most importantly — **cannot show the grey
    plague receding**, which is the core narrative promise the story text makes to the
    player. The art cannot deliver the story the writing sells.
24. **Split the map into layers** — sky, distant terrain, mid terrain, foreground, plus a
    separate "grey" overlay layer per region. This one change unlocks parallax, day/night,
    weather, and plague-clearing in a single stroke.
25. **A per-region "cleared" variant** (or a colour-restoration overlay) so beating a region
    visibly heals that part of the world. Currently clearing a region changes a pin's state
    and nothing about the world.
26. **The portrait aspect (0.56) fights every landscape screen.** Consider a landscape or
    square recomposition for desktop, or accept the crop and compose the art *knowing* only
    a 31% window is ever visible.
27. **Nothing in the map's composition accounts for the HUD.** Overlay chrome sits on top of
    painted detail rather than in space left for it.
28. **The four regions are not visually separated enough** at a glance — a first-time player
    can't instantly see "these are four distinct territories."
29. **The road between landmarks is painted into the bitmap**, so it can't draw itself
    forward as you unlock. A vector path over the art would fix this.
30. **No fog-of-war or discovery reveal.** The whole world is visible from minute one, which
    spends the entire map's novelty in the first three seconds.

### 1e — Characters

31. **The hero is one fixed character: a white boy with brown hair.** For an app aimed at
    every 13–17-year-old in the country, the avatar meant to represent *you* is a specific
    someone else. This is both an inclusion problem and a motivation problem.
32. **`hero: 'cadet'` is a dead field.** Typed in `types.ts:271`, written once in
    `progress.ts:102`, and read by nothing anywhere in the codebase. Character selection was
    scaffolded and abandoned — a third vestigial field alongside `XP.dailyChallenge` and
    `OnboardingProfile.before`.
33. **Ship 6–8 hero variants** across skin tone, hair, and build. This is the highest
    emotional-return art spend in the entire product for a teenage audience.
34. **Wizzy has exactly one pose.** The animation inventory (§17) calls for pleased,
    concerned, urgent and idle states; the art cannot express any of them. Needs at minimum
    4 poses, ideally a small sprite set.
35. **No expressions on the hero either** — no reaction to a correct answer, a boss hit, or
    a rank-up.
36. **Wizzy's staff orb is the only light source in his art**, but the UI never uses it —
    a natural glow anchor going unused.
37. **The hero cutout's soft drop shadow is baked into the PNG alpha**, so it can't respond
    to the surface it's standing on.

### 1f — Interface craft

38. **Four font families** — Cinzel, IM Fell English SC, Newsreader, Inter. That's a lot of
    voices; two or three would read as more deliberate.
39. **Emoji are doing real iconographic work** (🔥 on the streak chip in `QuestionRunner`).
    Emoji render differently on every OS and undercut a custom-illustrated world.
40. **No custom icon set.** `NavGlyph.tsx` is 136 lines covering the seven nav items;
    everything else falls back to text or emoji.
41. **The rank sigil is one shield shape recoloured seven times** (`RankBadge` in `ui.tsx`).
    Seven ranks should look like seven *achievements*, not one badge with a palette swap.
42. **No texture on the "parchment" surfaces** — it's a flat cream fill (`#f4e8cf`) called
    parchment. Real paper grain would cost one tiling texture and lift every reading screen.
43. **No texture on the leather chrome** either, for the same reason.
44. **Charts in `Stats.tsx` are unstyled rectangles** — 508 lines of data presentation with
    no visual identity connecting it to the rest of the world.
45. **The score report is a table.** The single most emotionally loaded screen in a test-prep
    app renders as rows and numbers.
46. **No loading art.** A themed loading state (a compass, a lantern) costs almost nothing
    and appears on every cold start.
47. **The favicon is a generic SVG mark** while the app has a whole illustrated identity to
    draw from.
48. **No Open Graph image using the actual artwork** — a shared link is the cheapest possible
    advertisement and currently wastes the best asset in the product.

### 1g — What "100× better" concretely means

Ranked by visible impact per unit of effort:

49. **One style, applied everywhere.** (items 1–7) — without this, better individual assets
    still look like a jumble.
50. **A layered, high-resolution map.** (items 8, 24, 25) — fixes blurriness, unlocks
    parallax/weather/day-night, and finally lets the world visibly heal.
51. **Hero variants + Wizzy poses.** (items 33, 34) — the emotional core.
52. **Redrawn bosses.** (item 3) — makes the climax feel like a climax.
53. **Per-region environment art.** (item 17) — kills the "same tent again" feeling.
54. **Textures and a real icon set.** (items 40, 42, 43) — the layer of polish that reads as
    "made by professionals" without any new illustration.

---

## 2. The student — 15, has a test in April, found this on Reddit

55. **I don't know if this is any good.** No score improvement claim, no testimonial, no
    "students using this gained X points." Every competitor leads with a number.
56. **Nothing tells me where I stand.** No diagnostic — I answer questions for a week before
    the app has any idea what I'm bad at. (Roadmap §10.)
57. **"754 questions" sounds big until I hit a topic with two.** Dashes has 2 questions,
    logarithms has 2. I'll memorise those in one sitting and the drill becomes useless.
58. **The test isn't a real test.** English is 25 questions in 18 minutes; the real thing is
    50 in 35. I can't use this to practise pacing, which is the thing I'm most scared of.
59. **No percentile.** A composite of 28 means nothing to me without knowing what percentage
    of people I just beat.
60. **Nothing tells me if I'm on track** for the score I said I wanted.
61. **No pacing feedback.** I don't find out I'm too slow until the timer runs out.
62. **It doesn't remind me.** If I forget for four days, nothing chases me — and reviews
    silently pile up. (Roadmap §13.)
63. **The streak breaks and that's it.** No grace, no freeze, no way back. After one missed
    day I stop caring about the number.
64. **I can't study with my friends.** No shared anything. Studying alone is why I quit
    things.
65. **I can't show my parents progress** without handing over my laptop.
66. **No dark/light choice.** I'm reading this in bed at midnight.
67. **No way to make the text bigger** on my phone.
68. **Nothing to do in 90 seconds.** No daily question, no quick hit — the smallest unit of
    engagement is a whole drill.
69. **Wrong answers just come back tomorrow.** It doesn't seem to know the difference between
    "I guessed" and "I nearly had it." (Roadmap §9.)
70. **I can't flag a question I think is wrong** without emailing someone.
71. **I can't bookmark a question** to come back to.
72. **No notes/scratch space** for math work.
73. **No calculator**, and the real ACT allows one on the math section.
74. **The map is the best part and I barely use it** — most of my time is on a page of text.
75. **My avatar isn't me** and I can't change it. (Art item 31.)

## 3. The parent — paying attention, not paying money

76. **I can't see my child's progress.** No parent view, no shared report, no digest email.
77. **No evidence it works.** I'd want to see methodology or outcomes before endorsing it.
78. **"Free" makes me suspicious.** Nothing explains how this is sustainable, which reads as
    either "it will disappear" or "my child is the product."
79. **The privacy policy is reassuring but the contact is a personal Gmail**
    (`Legal.tsx:25`). That single detail undercuts the professionalism of everything else.
80. **No named person or organisation behind it.** Who is teaching my child?
81. **No way to verify the content is accurate** — no author, no editorial process, no
    citation of ACT alignment.
82. **Nothing about screen time or healthy use** for a product aimed at minors.
83. **No way for me to be notified** if my child stops using it.
84. **I can't tell if the score estimate is trustworthy.** The code honestly calls it "not an
    official concordance" — but that honesty lives in a source comment, not in front of me.

## 4. The teacher / tutor — could assign this to 30 students

85. **No class or cohort concept.** I can't assign this or see who did it.
86. **No way to assign specific topics** to specific students.
87. **No exportable roster data.** Export is a single-student JSON blob.
88. **No answer key or content preview** — I can't review what I'd be assigning.
89. **No alignment documentation** to ACT's published skill domains.
90. **The gamification may be a hard sell** to a department; there's no "plain mode."
91. **No offline/printable practice**, which is still how a lot of classrooms operate.
92. **No indication of question difficulty calibration** — difficulty is an author-assigned
    label, not a measured statistic.
93. **Reading and Science have only 5–6 topics each**, too coarse to diagnose a student
    against a specific skill.
94. **8 landmarks teach skills with no drill questions at all** — tone, structure, evidence,
    figurative language, units, rates, hypotheses, calculating from data. A student can
    "clear" those and have practised nothing measurable. (Found by `check-content.mjs`;
    roadmap §12 item 76a.)

## 5. The investor — 20 minutes, wants to know if this is a company

95. **No business model.** Vercel Hobby is non-commercial-only, so the current deployment
    literally cannot monetise without a migration.
96. **No moat.** 342 hand-authored questions is a weekend of LLM generation for a competitor.
97. **No usage data — at all.** Zero analytics, zero telemetry. You cannot tell me DAU,
    retention, completion rate, or where users drop off. **You cannot run a company on this.**
    (Roadmap §8.)
98. **No funnel instrumentation**, so the play-first redesign's effect is unmeasurable.
99. **No cohort retention**, the single number that decides whether an edtech product works.
100. **Single-founder key-person risk**, with a personal Gmail as the contact of record.
101. **No CAC/growth mechanism.** No referral loop, no sharing, no SEO content strategy,
     no viral surface at all.
102. **TAM is capped by design** — US-only, ACT-only, one test per student per lifetime,
     with a hard churn event (they take the test and leave forever).
103. **No SAT.** The adjacent market is larger and the platform would mostly transfer.
104. **No ACT Writing** section at all, so it can't claim complete coverage.
105. **Free tier ceilings are load-bearing.** Supabase free is 50k MAU / 500 MB; growth past
     that is a cost event nobody has modelled.
106. **The project pauses itself after 7 days of inactivity** on Supabase free — a launch
     that goes quiet for a week comes back broken.
107. **No trademark clearance** evident for a product built adjacent to "ACT."
108. **Content liability**: if a question is wrong and a student is scored on it, whose
     problem is that?
109. **The art is the differentiator and it's inconsistent** — for a consumer product aimed
     at teenagers, the four-style problem is a *commercial* problem, not just an aesthetic one.

## 6. The average person — clicked a link, no context

110. **I don't know what the ACT is** if I'm outside the US, and nothing explains it.
111. **"Your climb to 36" means nothing to me.** 36 out of what?
112. **The fantasy framing is unexplained.** Why is there a wizard on a test-prep site?
113. **I don't know if it's for me** — no "who this is for" anywhere.
114. **Nothing tells me how long it takes.** Minutes a day? Months?
115. **The landing page never shows the actual product** — no screenshot of a question, which
     is what I'd actually be doing.
116. **"100% FREE" with no explanation of why** reads as a catch.
117. **No FAQ.**
118. **No obvious way to just try one question** without committing to a flow.
119. **The pixel-art hero sets the wrong expectation** — I think I'm getting a game, then I
     get a textbook. (Art item 2.)

## 7. The competitor PM — Khan Academy / UWorld / Magoosh

120. **No adaptivity worth the name.** Difficulty is a static author label; nothing adapts
     to the student in real time.
121. **The spaced repetition is a fixed Leitner ladder** — well behind SM-2/FSRS, which is
     table stakes now. (Roadmap §9.)
122. **No item response theory**, so difficulty and ability are never actually estimated.
123. **342 drill questions is an order of magnitude short** of any serious competitor.
124. **No video, no worked solutions in any medium but text.**
125. **No mobile app**, only a PWA — which costs the app-store discovery channel entirely.
126. **No content update cadence** — the bank is static.
127. **The score estimate is a hand-fit curve** and is honest about it in a code comment, but
     a competitor would attack it in marketing.
128. **No official ACT partnership or alignment claim.**
129. **The one genuine advantage is the world/map metaphor** — and it's under-exploited,
     under-resolution, and stylistically incoherent. **The moat is the art, and the art is
     the weakest part.**

## 8. The accessibility specialist

130. **`QuestionRunner.tsx` has 3 `aria-*` attributes** across the most-used component in the
     app — answer choices need radio-group semantics.
131. **`Notes.tsx`, `Stats.tsx`, `Tests.tsx`, `Legal.tsx` have one each.** All 80 `aria-*`
     uses in the app are concentrated in the map and dialogs.
132. **No text-to-speech**, which is a standard accommodation for the Reading section and for
     dyslexic students. `speechSynthesis` is built into every browser and unused.
133. **No dyslexia-friendly font option.**
134. **No font-size control.**
135. **No light mode**, and no `prefers-color-scheme` handling at all.
136. **Charts convey information by colour alone** in places.
137. **Region colours needed text-safe variants** (`blood-text`, `woods-text`, etc. in
     `tailwind.config.js`) — good catch, but it means the base palette fails on text and
     someone must remember which variant to use.
138. **No skip-to-content link.**
139. **Timed tests with no extended-time option** — a standard, legally recognised
     accommodation the real ACT grants.
140. **No reduced-data mode**; the map and backgrounds are heavy on a metered connection.
141. **Emoji as meaningful iconography** read poorly on screen readers (🔥 announces as
     "fire").
142. **No captions/transcripts** infrastructure, relevant the moment any video is added.

## 9. The engineer — inherited this codebase on Monday

143. **37 tests, all in one file, all on `progress.ts`.** Real coverage of the riskiest
     module and nothing anywhere else.
144. **No CI.** Nothing runs on a PR. (Roadmap §15.)
145. **No ESLint, no Prettier** — and three `eslint-disable` comments referencing a tool that
     was never installed.
146. **`store.tsx` is 528 lines and ~30 exposed fields** in one context; every consumer
     re-renders on any change.
147. **No route-level code splitting** — all 18 screens in one 437 KB chunk.
148. **`schema.sql` is a flat file** with no migration history or rollback path.
149. **No error tracking**, so production failures are invisible.
150. **The delete-account edge function isn't transactional** — a partial failure orphans an
     auth user with no data and nobody finds out.
151. **`pushProgress` is a plain upsert** with no optimistic-concurrency check.
152. **`noUncheckedIndexedAccess` is off** in a codebase built on `Record` lookups.
153. **Three vestigial fields** — `XP.dailyChallenge`, `OnboardingProfile.before`,
     `Progress.hero` — all written, none read. Each looks like a half-built feature.
154. **The `.tsx` game layer is genuinely well-commented**; the comments explaining *why*
     (the sync merge, the service worker, the focus trap) are better than most production
     code. Worth preserving as the standard.

## 10. The skeptic — reads privacy policies

155. **Email confirmation is currently OFF** (`mailer_autoconfirm: true`), so anyone can
     register with an address they don't own. On a product for minors, this is the most
     serious open item in the whole review.
156. **The `progress` table doesn't exist yet**, so every account silently fails to sync.
157. **Preview deploys appear to point at the production database** on a guessable URL.
158. **No backup strategy** — Supabase free has no point-in-time recovery.
159. **Account deletion is irreversible with no grace period** — correct per the policy, but
     one fat-finger and a year of work is gone with no restore path.
160. **The policy promises "no analytics"**, which forecloses even first-party error
     reporting without a rewrite. Fix the wording *before* adding monitoring, not after.
161. **No security contact or vulnerability disclosure path.**
162. **No status page** — when Supabase pauses, students just see a generic error.
163. **No rate limiting** on sync endpoints beyond a cooperative client-side debounce.
164. **No abuse-reporting route**, though the absence of any social surface makes this low
     risk today.

---

## Synthesis: the ten that matter most

Weighted by how many of the ten perspectives each one satisfies at once.

1. **Commit to one art style and rebuild the outliers to it.** (items 1–7) Named by the art
   director, the average person, the competitor PM and the investor. The moat is the art,
   and four styles means there is no moat.
2. **Turn email confirmation on and run the schema.** (items 155–156) Two dashboard actions.
   Until they're done, accounts are both insecure and non-functional.
3. **Re-export the map at 3× and split it into layers.** (items 8, 24, 25) Fixes the
   blurriness, and is the only way the world can ever visibly heal — the promise the story
   already makes.
4. **Add monitoring.** (item 97) The investor's blocker and the engineer's blocker are the
   same blocker. You cannot improve what you cannot see.
5. **Build the diagnostic test.** (items 56, 120) The student's first complaint and the
   competitor's first attack.
6. **Hero variants and Wizzy poses.** (items 33, 34) The highest emotional return per unit
   of art effort for a teenage audience.
7. **Fill the thin topics and the 8 empty landmark skills.** (items 57, 94) The clearest
   "this is unfinished" tell to a student or a teacher.
8. **Make the mock test full-length, and add percentile and pacing.** (items 58, 59, 61)
   Three separate student complaints, one body of work, mostly on data already captured.
9. **Accessibility pass on the everyday screens.** (items 130–135) Cheap, and currently the
   gap between the map's craft and everything else is embarrassing.
10. **Redraw the four bosses.** (item 3) The climax of every region currently looks like a
    placeholder, and it's only four illustrations.

**The one-sentence version:** the writing and the engineering are consistently better than
the product looks, and the art — which is supposed to be the differentiator — is the thing
most likely to make a 15-year-old close the tab.
