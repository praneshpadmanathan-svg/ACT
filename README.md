# ACT Command

Gamified prep for the 2025+ Enhanced ACT — study notes, adaptive drills, full-length timed tests, and a world-map progression system.

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

- **World map + trails** — four subject paths, each a serpentine trail of zones that unlock in order, guarded by a boss test at the summit.
- **Zones** — a short lesson in a readable study layout, then a six-question quiz. 70% clears the zone.
- **Adaptive drills** — mixed drills weight question selection toward topics you get wrong, so practice drifts to where it pays.
- **Spaced review** — anything you miss enters a Leitner queue (1 → 3 → 7 → 16 → 35 days) and comes back until you own it.
- **Timed tests** — real section pacing, no feedback until you finish, then a scored report with a topic breakdown. The timer runs off a wall-clock deadline, so backgrounding the tab doesn't buy extra minutes.
- **Progression** — XP, seven ranks, day streaks, 15 achievements, and an estimated composite derived from your actual accuracy.

---

## Design system

The app deliberately runs **two visual registers**, because a single one can't serve both jobs well.

**Arcade** — pixel type (Press Start 2P / Silkscreen / VT323), hard 2px borders, offset shadows, saturated accents, CRT scanlines. Used for all chrome: landing, world map, HUD, nav, XP, ranks, rewards. This is the game.

**Study** — warm paper surfaces, serif body text at a ~66-character measure, generous line height, content blocks as coloured rails rather than filled boxes. Used everywhere someone has to actually read: note pages, passages, question stems, explanations.

They share one palette and one spacing rhythm, so moving between them reads as one product. Scanlines and pixel fonts are never applied to body copy — that was the single biggest readability problem in the previous build.

Both registers are defined in [`src/index.css`](src/index.css) as component classes (`.pixel-panel`, `.btn`, `.study-sheet`, `.prose-study`, `.choice`, …) and in the Tailwind theme in [`tailwind.config.js`](tailwind.config.js). Change a token in those two files and it propagates everywhere.

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
    sfx.ts              chiptune synth (no audio files)
    utils.ts

  components/
    Shell.tsx           top bar, nav, page wrapper
    QuestionRunner.tsx  the shared answering experience
    PassagePanel.tsx    passages, incl. data tables and viewpoint notes
    RichText.tsx        content renderer with a tag allowlist
    Feedback.tsx        XP pops, toasts, confetti, rank-up cinematic
    PixelIcon.tsx       sprite icons
    ui.tsx              buttons, panels, chips, progress, rank badge
    ErrorBoundary.tsx

  game/
    scene.tsx           seeded pixel landscape generator
    WorldMap.tsx        the four-region overview
    TrailMap.tsx        a subject's zones as a climbing trail
    heroes.tsx          player sprites

  screens/              one file per area of the app
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
