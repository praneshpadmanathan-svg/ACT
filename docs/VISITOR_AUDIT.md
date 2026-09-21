# First-visit audit — 21 September 2026

Reviewed against main at db1daa5 and the public ACT site. These are observed or code-supported friction risks, not measured abandonment rates.

## Problems addressed

| Area                    | Problem a newcomer encounters                                                         | Change                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Landing                 | “Enter the realm” does not explain the action                                         | “Start free ACT practice”                                                                  |
| Landing                 | Duplicate sign-in action occupies the secondary hero slot                             | “Try a question first” scrolls to and focuses the sample; respects reduced motion          |
| Landing                 | Tall hero and faint, widely spaced reassurance                                        | Shorter hero, adaptive vertical spacing, stronger reassurance text, stacked mobile actions |
| Landing                 | Question total initially displays zero                                                | Render the actual total immediately                                                        |
| Landing                 | “Real questions” can imply official ACT material; completion timeframe is unsupported | Practice wording and self-paced expectation                                                |
| Returning visits        | Generic start buttons switch an existing identity to guest                            | Only initialise guest identity before a session has started                                |
| Loading                 | Failed speculative imports can reject without handling                                | Ignore failed prefetch; route loading remains responsible for errors                       |
| Onboarding              | First screen offers no exit                                                           | Persistent return-to-website control                                                       |
| Onboarding              | Anxiety-focused prompt and unclear remaining steps                                    | Neutral subject preference and a plan/character preview                                    |
| Onboarding              | Asks for a subject twice, then ignores the first preference                           | Save the selected starting region and route directly to it                                 |
| Loading                 | Setup and FAQ import the entire question barrel for metadata                          | Use narrow section/stat imports                                                            |
| Navigation              | Camp, Training and Summit obscure task destinations                                   | Home, Practice and Timed practice; remove question totals from task navigation             |
| Keyboard                | Skip-to-content changes the hash router location                                      | Prevent navigation, focus and scroll to the main landmark                                  |
| Keyboard                | Landing links contain nested buttons                                                  | Single styled anchor for sign-in and returning study action                                |
| Practice                | Guest bookmarks promise cross-device availability                                     | Explain local guest saves and signed-in sync                                               |
| Timed practice          | 85-question, 83-minute practice is called full-length                                 | Identify shortened sets before starting and in result labels                               |
| Timed/placement answers | Correct/wrong sounds, streaks and wrong-choice styling reveal answers early           | Neutral sound; suppress correctness presentation until feedback is allowed                 |
| Progress                | Empty statistics has no next action                                                   | Direct start-practising action                                                             |
| Shared links            | Malformed percent encoding throws during route parsing                                | Recover to landing; regression coverage                                                    |
| FAQ                     | Four-section composite description is outdated                                        | Correct current test overview and link to ACT's official source                            |

## Coverage and verification limits

Live guest walkthrough: landing, setup questions, character choice, plan, introductory story, road choice, study entry, practice entry, timed practice setup, settings and Daylight theme. Source review also covered home, lessons/quizzes, notes/readers, review, saved questions, daily challenge, diagnostic, duels/boss entry, collection, statistics/profile, reports, authentication and legal navigation. Existing missing-content states in study, lessons, notes and boss screens already provide recovery actions; review and saved-question empty states already offer practice.

Regression tests cover malformed links and timed correct/incorrect answers without sound, colour or streak leakage. Full build includes content, design-token and glyph gates, lint, unit tests, TypeScript and production bundling. No question records, answer IDs, normalisation or progress history are modified.

This is not exhaustive certification of every state: signed-in sync/reset emails, completed boss animations, all completed-result combinations and real-phone layouts were not exercised live. Local browser preview was unavailable in this environment. Review deployed changes after the GitHub deployment completes.

New practice aggregates now use core subjects, while science-only practice keeps its section score. Stored historical reports are preserved. Regression coverage checks both cases.

Validation: 211 tests passed. Production build passed with 14 existing lint warnings and the existing large-content-chunk warning.

## Remaining work identified

- The shared question chunk remains large (about 2.7 MB minified / 675 kB gzip). Narrow metadata imports help entry screens; proper subject-based loading needs a separate data-access refactor.
- Historical reports retain the aggregate calculated when they were taken. A future scoring-version label would make that distinction clearer; no historical scores were rewritten here.
- Some interior links still wrap buttons. Landing controls are fixed; a shared link-button primitive would allow consistent cleanup across the app.
- Mobile touch layouts, largest text size on every screen, and all rank/boss ceremonies need device-level visual review.

Official format reference: https://www.act.org/content/act/en/products-and-services/the-act.html (accessed 21 September 2026).
