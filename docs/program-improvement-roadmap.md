# Program improvement roadmap: everything outside animation

A complete pass over the app outside animation (that's `docs/animation-inventory.md`,
278 items, separately maintained). Three parallel research passes surveyed code
quality/testing/architecture, features/UX/pedagogy, and infrastructure/security/ops, and
returned 107 concrete, file-referenced findings, organized below into a buildable roadmap.

## Context

ACT Command finished two intensive passes: a launch-readiness pass (real Supabase accounts,
an age gate, delete-account/export-data, PWA offline support, security headers, a compacted
sync payload for the free tier) and an animation pass. The app is live at
`act-red.vercel.app` and functionally sound as a *game*.

What those two passes didn't touch: whether the app can tell you it's broken, whether its
core learning algorithm is any good, and whether a change to `progress.ts` next month
regresses silently the way the tally-backfill bug already did once.

**Two facts drove the shape of this plan:**

- **Automated tests: zero. CI: zero. Monitoring: zero.** The codebase is unusually
  well-commented in the specific places that already burned someone (the sync merge logic,
  the service worker, the focus trap, the CSP) — but testing, linting, and content
  validation as *categories of tooling* are entirely absent. The one bug the code's own
  comments document (`progress.ts`'s tally-backfill check testing `merged.tally` instead
  of `stored?.tally`) is exactly what a two-line unit test would have caught, and nothing
  stops an equivalent regression next time `mergeProgress` or `scheduleReview` is touched.
  If a student hits a crash or a failed sync in production today, nobody finds out unless
  they self-report — 11 `console.error`/`console.warn` sites across the app are all
  silently swallowed to a browser console nobody is watching.

- **The spaced-repetition system is a naive fixed-interval Leitner box, not SM-2/FSRS**,
  and no diagnostic/placement test exists anywhere — onboarding only self-reports a score
  bucket, and even that self-report (`OnboardingProfile.before`) is captured and never
  read again. These are the two highest-leverage *pedagogical* gaps, and both are
  addressable without a rewrite: the box-based data shape in `progress.ts` is reusable,
  and a diagnostic can be built as a new selection mode over existing content.

Explicitly **out of scope**: animation (fully covered elsewhere), leaderboards and
printable reports (both ruled out by the user in an earlier planning round), and anything
requiring a move off Vite/Supabase/Vercel.

---

## Where the risk actually is today

Measured, not guessed:

| Fact | Number |
| --- | --- |
| Automated tests | **0** |
| `console.error`/`console.warn` sites, all silently swallowed | **11** |
| Lines in `src/lib/store.tsx` (one context, ~30 exposed fields) | **528** |
| Lines in `src/lib/progress.ts` (untested sync/scoring core) | **630** |
| CI workflows (`.github/workflows/`) | **0** |
| Monitoring/analytics integrations | **0** |
| Content-validation scripts (vs. the animation equivalent that exists) | **0** |
| ESLint/Prettier config | does not exist |

---

## 1. Testing infrastructure (from zero)

1. Add Vitest (pairs natively with Vite 8, near-zero config) + `@testing-library/react`; add a `test` script and gate it in `build` alongside `check:anim`.
2. Pin `tallyFromAttempts` and the `loadProgress` backfill (`src/lib/progress.ts:157-267`) with regression tests — this exact path already shipped the tally-backfill bug once.
3. Pin `mergeProgress`/`mergeTally` (`progress.ts:527-597`) — the cross-device merge is deliberately asymmetric (max-of-counters, union-of-sets, tally under-counts by design) and none of those invariants are currently protected from an accidental "simplification."
4. Pin `scheduleReview`/`dueForReview` (`progress.ts:328-352`) — an off-by-one in the Leitner box math wouldn't surface for days.
5. Pin `scaleScore` (`progress.ts:454-469`), the percent→ACT-score curve, against known table values.
6. Pin XP/`rankIndexFor`/`rankProgress` (`progress.ts:33-76`) — boundary values at a rank threshold are the classic off-by-one spot.
7. Component-level tests for `QuestionRunner.tsx` (answer selection, reveal state, scoring callback) — the single most-used interactive surface in the app, currently zero coverage.
8. Add a lightweight Supabase-client mock (or `msw`) to test `pullProgress`/`pushProgress`/`deleteAccount` (`src/lib/supabase.ts:296-360`) tri-state (ok/empty/error) contracts without a live project.
9. Snapshot/contract test for `todaysPlan()` (`src/lib/plan.ts`) covering each priority branch (due reviews, mid-zone, zone cleared, weak topic found/absent).
10. A minimal smoke test asserting `App.tsx` renders past "Loading…" — would have caught the unhandled-rejection freeze in item 19 immediately. **(19 fixed — see below; this test would pin it.)**

## 2. TypeScript & tooling hardening

11. Enable `noUncheckedIndexedAccess` in `tsconfig.json` — the codebase indexes into many `Record<string, X>` maps (`tally.topics[key]`, `review[qid]`, `SECTION_BY_ID[id]`) currently treated as always-defined.
12. Add ESLint (flat config, `typescript-eslint` + `eslint-plugin-react-hooks`) — three `// eslint-disable-next-line react-hooks/exhaustive-deps` comments (`QuestionRunner.tsx:185`, `AdventureMap.tsx:113`, `Drills.tsx:209`) reference a rule from a tool that isn't installed at all, so those hook-dependency decisions are currently unverified by anything.
13. Add Prettier and a `format`/`format:check` script.
14. Add a `lint` script and wire it into `build` or CI — none exists today.
15. Re-audit the three disabled `exhaustive-deps` warnings once ESLint is installed — each is either an intentional omission (document why) or a real bug now catchable.
16. Consider `noPropertyAccessFromIndexSignature` alongside item 11 if it doesn't already force enough clarity.
17. Preserve the existing strong baseline explicitly (a CONTRIBUTING note): `strict: true` is already on, `noUnusedLocals`/`noUnusedParameters`/`noFallthroughCasesInSwitch` are set, and `any`/`as any` usage is effectively zero — worth stating as a standard to maintain.

## 3. Error handling & resilience

18. ~~Add a global `window.addEventListener('unhandledrejection', ...)` handler~~ — **done**, `main.tsx`. Any rejection outside the deliberately-hardened sync paths now reaches `console.error` instead of vanishing.
19. ~~Fix the auth-bootstrap effect in `store.tsx`~~ — **done**. `currentUser()` (`supabase.ts:196`) and `consumeAuthRedirect()` are now both wrapped in try/catch inside the bootstrap effect; a raw network error (DNS failure, CORS — not the Supabase `{error}` shape they're written to expect) now falls back to a signed-out guest instead of leaving `setAuthReady(true)` unreached and the app stuck on "Loading…" forever. Verified: the guarded control-flow shape reaches `authReady: true` even when the underlying call throws, confirmed at runtime in-browser, not just by typecheck.
20. Document a boundary strategy for event-handler/effect errors, which `ErrorBoundary.tsx` structurally cannot catch (React limitation) — disciplined try/catch at call sites plus the new unhandled-rejection handler, not the boundary itself.
21. Route the 11 existing swallowed `console.error`/`console.warn` sites (`ErrorBoundary.tsx:23`, `pwa.ts:34`, `storage.ts:42/64/74`, `store.tsx:321`, `supabase.ts:95/305/332/343`, `sw.ts:61`) through a single reporting function once monitoring exists (§8).
22. Confirm `ErrorBoundary.tsx`'s "Try again" and "Back to dashboard" have distinct behavior, and that the boundary reports via the new pipeline (§21) rather than only `console.error`.
23. Audit whether `store.tsx`'s debounced push (4s, `store.tsx:393-403`) informs the user when a push has silently retried multiple times without success.

## 4. Code architecture — splitting `store.tsx`

24. Split the single 528-line `StoreContext` (`src/lib/store.tsx`, ~30 exposed fields) into `useProgressStore` (progress, 5 mutators), `useAuthStore` (7 auth-state fields, 8 identity/auth methods), and `useUiStore` (6 toast/XP-pop fields) — every consumer currently re-renders on any change to any concern.
25. Introduce context selectors (`use-context-selector` or manual splitting) so a component reading only `progress` doesn't re-render on a toast firing.
26. Sequence incrementally: `useUiStore` first (most self-contained), then `useAuthStore`, then `useProgressStore` last (read by the most screens).
27. Add tests for each new store slice's public API as a checkpoint before/after the refactor.
28. Do a follow-up duplication pass across screens for repeated loading/error-state JSX once the context boundaries are clearer.

## 5. Bundle & performance

29. Add route-level code splitting via `React.lazy`/`Suspense` in `App.tsx` — all 18 screens are statically imported today, producing one 436,849-byte `index` chunk containing the entire app shell, every screen, Motion, and the Supabase client regardless of landing route.
30. Split vendor code (React, Supabase, Motion) out of the `index` chunk via `manualChunks` in `vite.config.ts` — extends the one existing deliberate split (the 630,938-byte `content` chunk) rather than introducing a new pattern.
31. Prioritize splitting the game/map screens (heaviest Motion usage) away from everyday screens (Notes, Stats, Legal).
32. Re-measure with `vite-bundle-visualizer` after 29-30 and set a soft per-chunk budget (~150KB) for teens on phone data.
33. Preserve the hand-built service-worker precache logic (`vite.config.ts:100-165`) as the pattern to follow — it's already above-average and deliberately avoids Workbox; don't regress it while chunking.

## 6. Accessibility — the everyday-screen gap

34. Audit and remediate `QuestionRunner.tsx` — the single most-used interactive component, currently only 3 `aria-*` attributes total — needs proper roles/labels for the prompt, answer choices (radio-group semantics), and reveal state.
35. Bring `Notes.tsx`, `Stats.tsx`, `Tests.tsx`, `Legal.tsx` (each at 1 `aria-*` attribute) up to the standard the map/dialog surfaces already got — the app's 80 total `aria-*` uses are concentrated almost entirely there.
36. Reuse `useDialogFocus.ts` (`src/lib/useDialogFocus.ts`, already solid — inert, Tab trap, restore focus, hidden-tab fallback) for any new dialogs this plan introduces (e.g. the diagnostic-test intro, §54), rather than hand-rolling focus traps again.
37. Run an automated audit (axe-core via Vitest/Playwright, or `@axe-core/react` dev-mode) scoped to the everyday screens from item 35.
38. Verify color-contrast and touch-target sizing on the everyday screens with the same rigor the map/dialog work received.

## 7. Content-pipeline validation tooling

39. Add `scripts/check-content.mjs` mirroring `scripts/check-map-animations.mjs` (which exists and is wired into `npm run build` specifically because a real animation bug shipped once) — the same discipline was never applied to content, despite `progress.ts` already needing a topic-name-drift fix (`TOPIC_BY_ZONE_ALIAS`, `canonicalTopic`, `progress.ts:278-304`).
40. Check for duplicate question IDs across `src/content/*.json` — an ad hoc check found the current 342 questions clean, but nothing enforces that going forward.
41. Check that every question's `answer` references a real choice — `src/content/index.ts` does pure lookups with zero validation today.
42. Check that every choice has a non-empty `why` explanation.
43. Check that every content topic has a matching entry in the topic-alias/canonicalization tables.
44. Wire the script into `npm run build` (`check:anim && check:content && tsc -b && vite build`), mirroring how `check:anim` already gates builds.
45. Introduce `supabase/migrations/` and move `schema.sql` off a flat file — no rollback path exists for schema changes today, which becomes a real gap once the `progress` table's shape needs to evolve (e.g. for diagnostic-test data, §58-62, or percentile data, §65).

## 8. Monitoring & observability

*Second-highest-leverage item in this document.*

46. Add error reporting (Sentry's free tier is the natural fit for a small Vercel+Supabase app, or a privacy-respecting self-hosted alternative) so the 11 currently-swallowed `console.error`/`console.warn` sites become visible to an operator instead of only the browser console of whichever student hit them.
47. Reconcile this with the privacy policy's "no analytics" promise (`Legal.tsx:135`) — error reporting isn't usage analytics, but the policy doesn't currently distinguish them (see §106); this needs a policy note *before* shipping, not after.
48. Add minimal, privacy-conscious health signals distinct from full analytics: sync-failure counts, service-worker precache-miss counts, auth-bootstrap failures (ties directly to §19, now that §19 is fixed this becomes "confirm the fallback path stays rare," not "find out it's silently hanging").
49. Add a status/health check the operator can glance at — even a simple scheduled Supabase query or a lightweight Vercel cron endpoint. Currently there's no status page and no uptime monitoring of any kind.
50. Alert specifically on the delete-account partial-failure case (§93) — the one failure mode in the app where silence is actively harmful (an orphaned auth user with no data, indistinguishable from a fresh account).

## 9. Core study-plan & spaced-repetition upgrade

*Highest-leverage pedagogical item in this document.* The current system
(`progress.ts:325-352`) is a fixed-interval Leitner box: `BOX_INTERVALS = [0,1,3,7,16,35]`
days, correct advances a box, incorrect hard-resets to box 0, no per-item ease factor, no
distinction between "missed by a little" and "confidently wrong." The review UI says so
plainly: "get it wrong and it comes back tomorrow" (`Drills.tsx:319`).

51. **Don't do a full SM-2/FSRS rewrite.** The existing box-based data shape (`Tally.review[qid]`) is reusable — layer an ease-factor-like adjustment on top of the box mechanism rather than replacing it with continuous-interval algorithms that need different stored state and a migration for 342 questions' worth of in-flight review history.
52. Add a lightweight per-item confidence signal at answer time — either a binary "sure"/"guessed" self-report, or infer it from the `Tally.topics[].ms` response-time data already captured but never used for scheduling. This is the cheapest way to approximate an ease factor without a new stored field.
53. Make the box-advance/reset rule response-time- and confidence-aware: a fast, confident correct answer advances two boxes; a slow or "guessed" correct answer advances one; an incorrect answer resets fewer boxes if the response was fast (a slip, not a knowledge gap) versus a full reset for a slow incorrect answer. `BOX_INTERVALS` stays unchanged — only the transition logic in `scheduleReview` (`progress.ts:328-352`) changes.
54. Weight review-session selection (currently sorted only by due-date ascending, capped at 20 questions) toward chronically-missed items — track a simple miss-count per question alongside the box index.
55. Update the review UI copy (`Drills.tsx:319`) to match the new framing once §53 ships — the current "wrong = tomorrow" language is honest about today's system but would mislead once response-time/confidence-aware resets are live.
56. Pin all of the above with the regression tests from §1 *before* the change ships — `scheduleReview` behavior changing silently is exactly the "surfaces days later" bug class the original research flagged.
57. Stretch: retire items after N consecutive successful graduations at long intervals (a light-touch analog to FSRS's "stability" concept), so mastered questions stop reappearing indefinitely — still reusable against existing box data, adding only a terminal "graduated" state past the current top box.

## 10. Diagnostic / placement testing

58. Add a diagnostic/placement mini-test before `todaysPlan()` starts guiding a student — none exists; onboarding (`Onboarding.tsx`) only self-reports a score bucket via 4 questions, and `OnboardingProfile.before` (has the student taken the real ACT?) is captured and never read again anywhere in the codebase.
59. Use `before` once it's read: a student who's taken the real test before gets a shorter, more targeted diagnostic than a first-timer who needs broader sampling.
60. Design the diagnostic as a short, fixed-length, cross-topic sample (2-3 questions per major topic across all four sections) drawing from existing content — a new selection/sequencing mode over `src/content/index.ts`'s existing lookups, no new content required.
61. Feed diagnostic results into `weakestTopics` (already used by `todaysPlan()`'s priority-3 branch) as a cold-start signal, since `weakestTopics` currently requires ≥3 attempts and a brand-new student has none.
62. Surface a simple diagnostic summary screen (rough per-section placement, not a scaled score — that's what full tests are for) so the diagnostic feels like useful feedback, not just a gate.

## 11. Full-length/accurate mock tests, percentile & pacing

63. Confirm the UI-facing labeling in `Tests.tsx` makes clear Summit/Test mode is deliberately scaled down vs. real ACT timing (English 25Q/18min vs. real 50Q/35min; Math 22Q/25min vs. 45Q/50min; Reading 18Q/20min vs. 36Q/40min; Science 20Q/20min vs. 40Q/40min) — the code comment already explains this is a content-volume limitation; the student-facing framing deserves the same clarity.
64. Raise scaled-down test lengths toward real ACT proportions as content volume grows (§12) — sequence after content work, not before; this is content-gated, not a code change.
65. Add a percentile estimate to `ScoreReport` (`Tests.tsx:419-542`) — none exists anywhere today; even a rough, clearly-labeled-as-approximate band (using public ACT percentile tables keyed off the existing scaled-score curve) beats a bare composite number.
66. Add pacing analysis to the score report — per-question `.ms` timing is already captured (`Tally.topics[].ms`) but never surfaced; a simple average-time-per-question stat or per-section chart uses existing data with no new capture logic.
67. Add mid-section pacing checkpoints during the timed test ("you should be on Q15 by now") — additive UI on the already-correct wall-clock timer, not a timer rewrite.
68. Document ACT Writing (the optional essay) as explicitly out of scope for now — it's entirely uncovered today (not in `SectionId`, not in content, not in any screen); a documented decision beats a silent omission a future contributor has to rediscover.
69. Add a periodic "you haven't tested in a while" nudge mid-journey, independent of full map completion — today full mock tests only enter `todaysPlan()` once all 37 zones clear, even though the story text (`story.ts:381-383`) verbally promises a halfway-point test the code doesn't deliver.
70. Make `testUrgency`/`daysUntilTest` (`plan.ts:16-33`) actually reorder or intensify `todaysPlan()` as the exam date closes in, not just change display copy/color — a student 3 days out currently gets the identical 3-step plan structure as one 90 days out.
71. When urgency is high, bias plan selection toward full-section timed practice over drilling — the pedagogically correct response to "test in 3 days" is closer to test-day simulation, which the current fixed-priority plan doesn't express.

## 12. Content coverage gaps

72. Add questions to English's thinnest topics: dashes (2), colons (3), idioms (3), modifiers (4), fragments (4) — topics this thin are quick to memorize on freely-retryable drills, undermining the drill mechanic specifically for these topics.
73. Add questions to Math's thinnest topics: logarithms (2), matrices (2), complex numbers (2), systems (3).
74. Treat Reading (72Q/6 topics) and Science (80Q/5 topics) as lower priority for raw count — their broader, skill-integrated structure already matches how the real ACT tests those sections; the urgency is specifically English/Math's narrow topics.
75. Sequence new content authoring through the validation script (§39-44) from day one.
76. If content authoring is LLM-assisted (a reasonable way to close §72-73 at volume), treat the validation script as a hard gate on any batch-generated content — batch generation is exactly the scenario most likely to introduce duplicate IDs or malformed answer references.

## 13. Re-engagement & notifications

77. Add web-push notifications for due spaced-repetition reviews — `src/sw.ts` has zero push registration today (no `pushManager`/`Notification.`/`showNotification` anywhere); a student who doesn't open the app on the day items come due gets no nudge, undermining the whole value of §9's schedule.
78. Scope push minimally: opt-in only, one notification type at launch (due reviews), a clear settings toggle to disable.
79. Either build the vestigial `XP.dailyChallenge` constant (`progress.ts:75`, defined but never referenced anywhere) into an actual daily-challenge feature, or remove it — dead code that looks like a half-shipped feature is worse than either building or deleting it.
80. Consider a lightweight in-app "haven't seen you in a while" banner on next-open as a lower-effort complement to §77 for students who haven't enabled push.

## 14. Accessibility of content

81. Add text-to-speech for question/passage text via the browser-native `speechSynthesis` API (zero usage anywhere today, no new dependency needed) — particularly valuable for Reading and for dyslexic students.
82. Add a dyslexia-friendly font toggle in settings (e.g. OpenDyslexic) — no font/dyslexia toggle exists today.
83. Add a font-size toggle, independent of §82 — overlapping but distinct needs.
84. Add a true light/dark mode toggle with `prefers-color-scheme` handling — today there's a fixed single "parchment reading pages / dark leather chrome" identity with no toggle or OS-preference handling (distinct from any animation theming, which is out of scope).
85. Sequence §81-84 as independent settings entries rather than one bundled "accessibility mode" — each serves a different need.

## 15. CI/CD

86. Add `.github/workflows/ci.yml` running on every PR: typecheck, lint (§14), test (§1), `check:anim`/`check:content` (§39-44) — currently nothing runs on PRs; only the Vercel build gates actual deploys, so a broken PR can sit indefinitely until merged.
87. Add Dependabot or Renovate for automated dependency-update PRs — dependencies aren't stale yet (`vite ^8.2.0`, `tailwindcss ^3.4.13`, `react ^18.3.1` are minor lags, not urgent), but there's no mechanism to keep them from becoming stale.
88. Once §46-48 lands, consider a CI check that fails the build if a new `console.error` site is added without a reporting-pipeline hookup.
89. Add a bundle-size-delta comment to PRs (ties to §29-32) so the code-splitting work doesn't regress unnoticed.

## 16. Data integrity, backup & race-condition hardening

90. Add optimistic-concurrency protection to `pushProgress` (`supabase.ts:316-336`) — currently a plain upsert with no compare-against-`updated_at` check, so there's no server-side guard against a stale merged payload overwriting a newer one written between a pull and a push.
91. Document (and consider tightening) the tie-break behavior in `mergeProgress` (`progress.ts:544/548/568`): fields spread via `...newer` are close to last-write-wins for anything not explicitly merged, and the tie-break always favors local — a real, currently-undocumented edge case.
92. Explicitly document the accepted tradeoff already self-noted in `progress.ts:517-526` — per-topic tally counts take `Math.max`, not true dedup, so advancing the *same* topic on two devices between syncs silently loses the smaller side's progress. Surface this in user-facing docs or a pointed code comment so it isn't "rediscovered" as a bug report.
93. **Make the delete-account edge function transactional or add compensating cleanup**: it deletes the `progress` row, then calls `admin.deleteUser()` as two sequential independent calls with no rollback. If `deleteUser()` fails after the row-delete succeeds, the auth user survives with no data and no alerting — could look like a fresh account or silently repopulate from a stale local copy.
94. Confirm the explicit progress-row delete (redundant with `schema.sql`'s `ON DELETE CASCADE`, kept only to surface delete errors per the existing code comment) stays intentional as the function evolves — doesn't change §93's risk, just worth reconfirming.
95. Add a documented backup strategy — Supabase's free tier has no point-in-time recovery; nothing today flags this or proposes a mitigation (e.g. a scheduled `pg_dump` via a GitHub Actions cron to a private bucket).
96. Add application-level rate limiting on `pushProgress`/`pullProgress` beyond the client-side cooperative 4s debounce (`store.tsx:393-403`) — the only real backstop today is the 256KB `CHECK` constraint on row size (`schema.sql:48-50`), which limits damage-per-write, not write frequency or egress against the 5GB free-tier cap.
97. Confirm (and put in a checklist, not just a manual dashboard toggle) that Supabase's leaked-password protection and Turnstile bot protection are actually enabled — `docs/launch-checklist.md` lists these as manual toggles, but nothing in code/CI verifies they're on or would detect a silent revert.

## 17. Supabase / hosting operational hardening

98. **Enable Vercel Deployment Protection** (password-protect preview URLs) — `docs/launch-checklist.md` already warns preview builds share the same Supabase project/env vars as production if not configured per-environment, meaning an unprotected, publicly-guessable preview URL currently exposes a surface tested against live data. Given the audience is minors, treat this as higher priority than its "ops hygiene" framing suggests.
99. Separate preview/staging Supabase project (or at minimum environment-scoped env vars in Vercel) from production — pairs naturally with §98.
100. Change `CONTACT_EMAIL` (`Legal.tsx:25`) off a personal Gmail before wide distribution — already flagged in `docs/launch-checklist.md`, restated here as a fast, low-risk fix that fits this section.
101. Add a status page or a documented outage-communication plan — if Supabase auto-pauses after 7 days of inactivity or has an outage, students currently see only generic in-app error toasts with no explanation or external status page.
102. Split the single mailto support channel if volume ever grows — lower priority given no messaging/social surface exists at all; worth a trigger ("if support volume exceeds X/month, split the channel") rather than an immediate change.
103. Add an auto-apply timeout fallback for pending service-worker updates in `sw.ts` — the current update strategy requires the UI to call `apply()` via an update-toast; if dismissed or never mounted, a student can be stuck on an old cached build indefinitely.
104. Surface individual precache-item fetch failures (currently caught and `console.warn`'d only) through the new monitoring pipeline (§46-48) — a direct application of §21 to this specific site.
105. Confirm cache-naming/versioning (`CACHE = act-command-${buildId}`, swept on activate) continues to hold as deploy frequency increases — no bug found, but flag the "every deploy produces a unique buildId" assumption with a comment or build-time assertion rather than leaving it implicit.

## 18. Legal/compliance follow-through

106. Rewrite the privacy policy's cookie/tracking language (`Legal.tsx`, currently "no cookies/no tracking") to distinguish first-party operational telemetry (error reporting, §46) from third-party tracking/analytics — do this *before* §46 ships, not after.
107. Confirm the age-gate and account-creation flows stay consistent as new student-data types get stored (diagnostic results, §58-62; percentile estimates, §65) — no gap found today, just a checkpoint to carry forward.

---

## If you only do ten

1. ~~§18-19 — global `unhandledrejection` handler + fix the auth-bootstrap try/catch gap.~~ **Shipped.** Closed a real, reproducible "stuck on Loading… forever" bug with zero recovery path.
2. **§46-50 — monitoring/observability.** The single biggest remaining blind spot in the app: 11 silently-swallowed error sites, zero visibility into sync failures or crashes, and the one failure mode (delete-account partial failure) where silence is actively harmful.
3. **§51-56 — the spaced-repetition upgrade.** Highest-leverage pedagogical change available, buildable as a layer on the existing box-based data shape rather than a rewrite.
4. **§58-62 — a real diagnostic/placement test before `todaysPlan()` starts.** No diagnostic exists today; the one self-report signal collected (`before`) is never even read.
5. **§11 — `noUncheckedIndexedAccess` in tsconfig.json.** One config flag surfacing every unguarded `Record` index access across a codebase that leans on that pattern constantly.
6. **§39-44 — a `check-content.mjs` mirroring `check-map-animations.mjs`, wired into `npm run build`.** Content is clean today and completely unenforced going forward, with the exact right precedent already sitting in the repo to copy.
7. **§1-9 — stand up Vitest and pin `progress.ts`'s riskiest functions.** This code already shipped one silent bug that a test would have caught in seconds.
8. **§86 — a CI workflow gating PRs on typecheck/lint/test/content-check.** Nothing runs before merge today; only the Vercel build gates deploys.
9. **§98-99 — Vercel Deployment Protection + separated preview/prod Supabase config.** Minors' data, a guessable preview URL, live production database — a fast fix with outsized risk reduction for this audience.
10. **§29-32 — route-level code splitting + vendor chunk separation.** Every screen ships in one 436KB chunk today regardless of landing route — a real first-paint win for teens on phone data.
