# ACT Command — design contract

Every screen is built from this. The tokens themselves live in
`src/index.css` (`:root` and `[data-theme='light']`) and `tailwind.config.js`;
this file says what they are for and what is off-limits. The design skills in
`.claude/skills` read this file first, and it outranks their defaults.

## Direction

- **Product.** Free ACT prep where the four sections are roads across a painted
  country, and every answer, right or wrong, is explained.
- **Character.** Patient, storied, exact.
- **World.** A traveller's field journal at dusk: lamplight on vellum, ink and
  brass, pixel-painted landscapes.
- **Moments.** The paintings (landing hero, the four region maps, the camp
  behind the app), and the question sheet with its explanation. These carry the
  colour and the detail. Everything else is quiet.
- **Signature.** The road: an inked dotted line with landmark pins, used where
  progress along a road is shown, and nowhere else.

## Colour

Warm dark "leather" ramp for surfaces, warm cream "paper" for reading surfaces
(lessons, questions), and one accent.

| Role            | Token                                          | Use                                                                  |
| --------------- | ---------------------------------------------- | -------------------------------------------------------------------- |
| Page            | `leather-950` / `leather-900`                  | backgrounds                                                          |
| Surface         | `leather-850`, raised `leather-800`            | panels, rows, inputs                                                 |
| Hairline        | `leather-700`                                  | borders, rules                                                       |
| Text            | `parchment`, `parchment-dim`, `ink-faint`      | primary, secondary, muted. Three roles, no more                      |
| Accent          | `gold` (`gold-deep` on paper)                  | the primary action, the current selection, one key figure per screen |
| Section colours | `english`, `math`, `reading`, `science` tokens | identify a section: a dot, a rule, a map. Never a button fill        |
| Feedback        | `woods-text` (right), `blood-text` (wrong)     | answer states only                                                   |

Light theme ("Daylight") is a preference, built from the same roles.

No glows, coloured shadows, gradient text, radial washes behind content, or
hue-to-hue gradients on chrome. Depth on dark comes from surface steps and
hairlines; on paper, from one soft neutral shadow.

## Type

- **Headings:** Newsreader (variable, optical sizes), weight 500, sentence case.
  In the app: page titles 28–36px, section headings 20–24px. On the landing
  page, where each section is a page-width idea: section headings 26–36px,
  hero 56–64px desktop / 36–40px mobile.
- **Interface and body:** Inter, 400 and 500. 600 only for a short emphasis.
- **Lessons and passages:** the reading styles in `index.css`
  (`.prose-quill`, `.prose-passage`).
- **Wordmark:** Cinzel, for "ACT Command" only.
- **Labels:** sentence case, 12–13px, `ink-faint` or `parchment-dim`, no
  letter-spacing. No tracked all-caps labels anywhere.
- Figures use tabular numerals in one format per screen.
- The "Legible" preference swaps every family for Atkinson Hyperlegible; any
  new face must be swapped there too.

## Layout and components

- 4px grid. Spacing inside a group is smaller than between groups.
- Radius by size: controls 8–10, cards 12–14, large panels 16. Nested radius
  is outer minus padding.
- One primary button per view (gold fill, dark text, no glow, a 1px top
  highlight). Secondary is the raised surface with a hairline.
- Page header: the title, then one plain sentence. No eyebrow label above it.
- Not everything is a card. Lists are rows; prose is prose.
- Icons: the project's own `Glyph` set, one size per context, in the text
  colour of their row.

## Copy

- Say what the thing does, in plain words, from the student's side.
- No greeting headlines, exclamation marks, hype words or trailing periods on
  labels and buttons. A button says what happens ("Start the quiz").
- Do not bold, underline or colour words inside body text for emphasis.
- No "A · B · C" meta strings or "WORD — fragment" labels as decoration.
- The game vocabulary (roads, landmarks, guardians, ranks) is the product's
  world. Keep it, and explain it once where a new player first meets it.

## Motion

- Motion answers an action: a press, an answer, a page change, a rank earned.
- One ease-out curve (`cubic-bezier(0.22, 1, 0.36, 1)`), 120–180ms for
  feedback, 300–500ms for entrances. Transition named properties, never `all`.
- No looping decoration, hover lifts on cards, pointer-tracked sheens or
  orbiting rims. At most one entrance sequence per page.
- The light layer (`src/lib/fx.ts`) is for answers and rank-ups only.
- `prefers-reduced-motion` turns all of it off.

## Not allowed

Tracked all-caps eyebrows · one accented word in a headline · ornament
dividers under headings · icon-in-a-rounded-square feature grids · a glowing
"big number" stat · decorative 01/02/03 numbering on things that are not a
sequence · keyword highlighting in prose · developer instructions on
customer-facing screens.
