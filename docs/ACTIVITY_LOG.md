# ACT design activity log

## 2026-09-14 — Rank identity and illustrated destinations

### Implemented

- Added shared RankIdentity with a bold rank title and framed existing emblem.
- Applied the identity to Camp, navigation and Profile; enlarged the map rank
  emblem and bolded rank names in the collection.
- Changed the map rank action to open Profile, where the rank collection lives.
- Removed the question-bank advertising counts from Camp's Training link and
  the Training heading. Session lengths and learning results remain available.
- Added illustrated Library, Training and Summit headers using the existing
  responsive artwork and scene animation lifecycle.
- Removed duplicate Profile badge markup and unused heading imports.
- Added responsive rank layouts, theme-aware text, focus rings, and hover motion
  that respects reduced-motion preferences.

### Validation and publication

- The prior implementation build passed with 155 tests and 15 existing lint
  warnings. The final publication build is checked again before upload.
- Local browser preview was blocked; visual sign-off remains pending.
- Publish target: praneshpadmanathan-svg/ACT, design/living-realm.
- main has 14 newer commits relative to the original design base, including
  a replacement map system and expanded question content. This update stays on
  the design branch for preview; it must not overwrite main wholesale.
- No production content or unrelated features were deleted.

## Earlier design work

- Added the Living Realm opening illustration and responsive WebP/AVIF assets.
- Added animated opening, Camp, illustrated region portals and regional rewards.
- Refined onboarding progress and ambient animation pause/resume behavior.
- Fixed returning-user landing actions and cinematic controls in light theme.
- Published the earlier design under commits 051d316 and 2f5066e.

The detailed design review and remaining work are in visual-experience-review.md.
