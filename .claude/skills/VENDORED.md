# Vendored agent skills

Design skills for Claude Code (and other agents that read `.claude/skills`),
copied in so every session on this repo has them without an install step. They
are other people's work, kept as published apart from the omissions below, and
each folder carries its project's license. Nothing here ships in the app: the
linter and Prettier skip this folder, and the test runner only looks in `src/`
and `scripts/`.

To update one, re-copy its folder from the source at a newer commit and change
the row below.

| Folders                                                                                                                                                                                                                         | Source                                                                                                    | Commit         | License    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------- | ---------- |
| `frontend-design`                                                                                                                                                                                                               | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/frontend-design)                | `e4bb5d960d87` | see folder |
| `impeccable`                                                                                                                                                                                                                    | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) (`plugin/skills/impeccable`)                  | `b49177d32788` | Apache-2.0 |
| `unslop`                                                                                                                                                                                                                        | [heydamir/unslop](https://github.com/heydamir/unslop)                                                     | `620163eedb35` | CC BY 4.0  |
| `avoid-ai-design`                                                                                                                                                                                                               | [funboy322/avoid-ai-design](https://github.com/funboy322/avoid-ai-design)                                 | `60f5853a7068` | MIT        |
| `design-taste-frontend`                                                                                                                                                                                                         | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) (`skills/taste-skill`)                    | `6c0b5c78f5d3` | MIT        |
| `hallmark`                                                                                                                                                                                                                      | [nutlope/hallmark](https://github.com/nutlope/hallmark)                                                   | `04977e15f3df` | MIT        |
| `web-design-guidelines`                                                                                                                                                                                                         | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines) | `5a37a6329fba` | MIT (per its README) |
| `emil-design-eng`, `animate`, `review-animations`, `remove-animations`, `improve-animations`, `animation-performance`, `find-animation-opportunities`, `choreograph`, `break-ui`, `gestures`, `apple-design`, `animation-vocabulary`, `learn-taste`, `prototype` | [emilkowalski/skills](https://github.com/emilkowalski/skills)                                             | `64eb3deb9a5f` | MIT        |
| `baseline-ui`, `fixing-accessibility`, `fixing-motion-performance`, `fixing-metadata`, `improve-ui`, `create-design-md`                                                                                                         | [ibelick/ui-skills](https://github.com/ibelick/ui-skills)                                                 | `7ef0076fce1d` | MIT        |
| `humanizer`                                                                                                                                                                                                                     | [blader/humanizer](https://github.com/blader/humanizer)                                                   | `a32f24407364` | MIT        |

## What was left out

- **`design-taste-frontend`:** `assets/photos/` (12 MB of stock photography)
  and `assets/scenes/_demo/`. This app has its own painted art; the skill's
  photo step should use that.
- **`avoid-ai-design`:** `docs/` (README screenshots), `README.md`,
  `CHANGELOG.md`.
- **`humanizer`:** `README.md` and its images.
- **Emil Kowalski's skills:** the ones for Swift, Expo and native mobile,
  `ask-sonner`, `pick-ui-library` and the `ask-emil` router.
- **UI Skills:** the canvas and device-frame skills, and `ui-skills-root`,
  which needs that project's CLI.

## Things that run code

Most of these are instructions only. These are not:

- **`design-taste-frontend`** declares a hook in its own `SKILL.md` that runs
  `scripts/gate.mjs` with Node while the skill is active.
- **`impeccable`**'s `scripts/impeccable` launcher runs a platform binary,
  downloading it to `~/.impeccable/bin/` on first use and checking it against
  `scripts/engine-checksums.txt`. Only the skill is vendored here, not the
  plugin's hook that runs it after every edit.
- **`hallmark`** generates images only when `TOGETHER_API_KEY` is set.
- Several (`unslop`, `hallmark`, `design-taste-frontend`, `avoid-ai-design`)
  ship Node scripts that screenshot pages in a headless browser.
