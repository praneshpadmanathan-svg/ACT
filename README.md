# ACT Command

A hand-drawn fantasy quest that happens to be complete ACT prep — lessons, adaptive drills, full-length timed tests, and a painted world map you climb one skill at a time.

Built with Vite, React 18, TypeScript and Tailwind. No backend required: it runs fully offline-capable in guest mode, with optional Supabase accounts for cross-device sync.

---

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:5173. That's it — no configuration needed. The app runs in guest mode and saves progress to your browser.

To enable accounts and cloud sync, see [Cloud sync](#cloud-sync-optional).

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Typecheck, then production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | TypeScript only, no emit |

---

## What's in it

| Content | Count |
| --- | --- |
| Drill questions (graded, per-choice explanations) | 342 |
| Zone quiz questions | 412 |
| Study note pages | 60 across 14 units |
| Passages (English, Reading, Science incl. data tables) | 27 |
| Zones across 4 paths | 37 |

Every question explains **all four choices**, not just the credited one.

### Features

- **A painted world map** — a full-viewport world you drag to pan and scroll or pinch to zoom, opening on wherever you got to. All 37 zones have a landmark pin, every zone is named after the terrain it actually stands on, and the scenery is alive: drifting cloud cover with shadows crossing the ground below it, falling water and spray, shore foam, chimney smoke, gusts over the fields, lamplight coming up in the cottages, leaves lifting off the canopy, glowing mushrooms, fireflies, crystal glints, volcano embers and heat haze, desert dust, a sweeping lighthouse beam, a ship under sail crossing the bay, birds, and the occasional shooting star.
- **Landmarks** — a short lesson on parchment, then a quiz. 70% clears it and opens the road ahead. Each part of a lesson sits on a warm translucent plate with a coloured edge naming it, in one column at a reading measure.
- **Discoveries** — fourteen places on the map that are not landmarks: the falling water, the crystal hollow, the stranded boat, the wreck on the rocks, the citadel gate. No quiz and no gate — they are found by exploring, and each gives a piece of the realm and a little XP. Regions you have not walked sit under mist that thins as you clear them, so the map visibly opens up as you work.
- **Adaptive drills** — mixed drills weight question selection toward topics you get wrong, so practice drifts to where it pays.
- **Spaced review** — anything you miss enters a Leitner queue (1 → 3 → 7 → 16 → 35 days) and comes back until you own it.
- **Timed tests** — real section pacing, no feedback until you finish, then a scored report with a topic breakdown. The timer runs off a wall-clock deadline, so backgrounding the tab doesn't buy extra minutes.
- **Boss duels** — each region has a guardian that wakes once every landmark in it is cleared. You stand on the left, it stands on the right, and the questions are the weapons: a correct answer lands a hit, a wrong one lets it hit back. Ten hits to fell it, three to fall. Losing costs nothing but the attempt.
- **A quest chain** — nine objectives ending at the full timed trial, so there is something to actually do to reach the end: take your first landmark, hold four, break a Seal, push to twelve, a second Seal, halfway, all four Seals, the whole map, the trial. The Seals are the region guardians, so the story and the boss duels point at the same thing. The current objective sits on the map with a progress bar and Wizzy leads with it. Beats shake the scene — softly for a tremor, hard for a Seal breaking — and nine dispatches keep the world moving between them. Nothing is ever locked behind the story: every objective is something you would do anyway.
- **Progression** — XP, seven ranks, day streaks, 15 achievements, and an estimated composite derived from your actual accuracy.
- **Accounts** — Supabase when configured, otherwise salted-and-hashed accounts kept on the device. Progress is stored per profile, so two people can share a browser without overwriting each other. Guest mode needs no account at all.
- **Sound** — every cue is synthesised at runtime in WebAudio (wooden latches, felt thuds, mallet-and-harp for a correct answer, a layered fanfare for a rank-up), routed through a generated room reverb. Zero bytes of audio ship.

---

## Design system

The artwork sets the rules. The app ships five illustrations — a painted world
map, a lantern-lit campaign tent, a pixel-art vista, and two ink-and-wash
characters — and the interface is built from the same materials rather than
fighting them.

**Leather** — dark, warm chrome for nav, panels, HUD and map furniture. Cinzel
for headings, IM Fell English SC for small caps.

**Parchment** — every reading surface: lessons, passages, question stems,
explanations. Deliberately the same cream as the sheet the characters were
drawn on, so a cutout dropped onto a panel has no visible seam. Newsreader at a
~66-character measure, in one unbroken column — no boxes, no tints. Each part of
a lesson is named by a coloured label instead, because five differently tinted
boxes on cream parchment read as white cards punched into the page.

Region accents are keyed to the map itself: village gold, forest green, canyon
rust, sea blue. Both registers live in [`src/index.css`](src/index.css) as
component classes (`.panel`, `.sheet`, `.prose-quill`, `.choice`, `.pin`, …)
and in the theme in [`tailwind.config.js`](tailwind.config.js).

### The artwork

Source images totalled 11.6 MB of PNG. They are committed at **668 KB**:
backgrounds converted to WebP, and the two characters cut off their parchment
sheets with a border flood-fill so they can stand on the map with real
transparency instead of a masked rectangle.

---

## Project structure

```
src/
  main.tsx              app entry
  App.tsx               route table
  types.ts              content + progress types
  index.css             design system (both registers)

  content/              the content library — static JSON + typed index
    index.ts            single entry point, lookup maps, LIBRARY_STATS
    notes*.json         60 note pages in 14 units
    questions*.json     342 graded drill questions
    passages*.json      27 passages
    paths.json          4 paths, 37 zones
    lessons.json        per-zone lessons
    miniquizzes.json    412 zone questions

  lib/
    store.tsx           single source of truth: progress, auth, rewards
    progress.ts         XP, ranks, streaks, spaced repetition, scoring
    router.ts           hash router
    storage.ts          localStorage with quota/private-mode handling
    supabase.ts         auth + sync, with merge-not-clobber semantics
    normalize.ts        adapts both question shapes into one runner shape
    sfx.ts              synthesised sound design (no audio files)
    localAuth.ts        device accounts + per-profile progress keys
    utils.ts

  components/
    Shell.tsx           top bar, nav, page wrapper
    QuestionRunner.tsx  the shared answering experience
    PassagePanel.tsx    passages, incl. data tables and viewpoint notes
    RichText.tsx        content renderer with a tag allowlist
    Feedback.tsx        XP pops, toasts, confetti, rank-up moment
    NavGlyph.tsx        drawn nav icons (no emoji)
    ui.tsx              buttons, panels, chips, progress, rank badge
    ErrorBoundary.tsx

  game/
    AdventureMap.tsx    the painted map, pins, traveller
    story.ts            the nine-objective quest chain + dispatches
    StoryOverlay.tsx    typewriter scenes, choices, chapter cards, screen shake
    Wizzy.tsx           the guide
    mapData.ts          pin coordinates for all 37 zones
    discoveries.ts      the 14 findable places and their lore
    DiscoveryLayer.tsx  discovery markers, the reveal card, and regional mist
    RoadChooser.tsx     pick which region to set out from
    MapFx.tsx           living scenery: water, embers, glow, fireflies
    Sigils.tsx          drawn lock / cleared / mastered / crown marks
    bosses.ts           the four region guardians
    BossArt.tsx         each boss drawn as SVG, with hit/lunge/defeat states

  screens/              one file per area of the app
    Boss.tsx            the duel: you left, boss right, questions between
```

### Content is data, not code

Everything in `src/content/*.json` is plain data with types in `src/types.ts`. To add a question, edit the JSON — no component changes needed. `src/content/index.ts` builds the lookup maps once at module load and is the only place the rest of the app imports content from.

---

## Cloud sync (optional)

Without configuration the app is local-only and fully functional. To add accounts:

1. Create a project at [supabase.com](https://supabase.com).
2. Copy `.env.example` to `.env` and fill in both values from **Settings → API**:

   ```
   VITE_SUPABASE_URL=https://yourproject.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-publishable-key
   ```

3. Create the progress table and its row-level security policies:

   ```sql
   create table public.progress (
     user_id      uuid primary key references auth.users on delete cascade,
     display_name text,
     data         jsonb not null default '{}'::jsonb,
     updated_at   timestamptz not null default now()
   );

   alter table public.progress enable row level security;

   create policy "read own progress"   on public.progress
     for select using (auth.uid() = user_id);
   create policy "insert own progress" on public.progress
     for insert with check (auth.uid() = user_id);
   create policy "update own progress" on public.progress
     for update using (auth.uid() = user_id);
   ```

The anon key is a publishable key meant to ship in browser bundles; RLS is what actually protects the data, which is why the policies above matter. Never put a `service_role` key in `.env`.

### How sync behaves

Local and remote progress are **merged**, never overwritten. XP, streaks and best scores take the maximum; attempts, tests, read pages and achievements are unioned; review schedules keep whichever is further along. Opening the app on a second device can only move you forward — it can't wipe a session.

Pushes are debounced 4 seconds and flushed when the tab is hidden.

---

## Deploying

Any static host works. For Vercel:

```bash
npm i -g vercel
vercel
```

`vercel.json` is already set up (Vite framework preset, `dist` output, immutable asset caching). If you're using cloud sync, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel project's environment variables — `.env` is gitignored and won't be uploaded.

Routing is hash-based (`#/home`, `#/note/eng-commas-jobs`), so no rewrite rules are needed and deep links work anywhere.

---

## Accessibility and platform notes

- Answer choices are keyboard-driven: `A`–`D` or `1`–`4` to answer, `Enter`/`Space` to continue.
- All interactive elements are real `<button>`/`<a>` with visible focus rings and `aria-label`s on icon-only controls.
- `prefers-reduced-motion` disables animation and the CRT overlay.
- Sound is off-by-default-able via the speaker toggle and persists across sessions.
- localStorage failures (Safari private mode, quota) fall back to in-memory storage instead of throwing mid-session.
- Progress from the previous single-file build is migrated automatically on first load.

---

## License

Content and code are yours. Add whatever license you want here before making the repo public.
