# Readability and visual refinement — 22 September 2026

Shared-system review following the home redesign. Changes apply to landing,
authentication, home, study, practice, notes, results, settings and profile
where those screens use the common components and typography roles.

- Replaced decorative interface and reading fonts with self-hosted Inter.
  Retained Cinzel selectively for the landing hero and rank display.
- Kept the high-legibility font preference and text scaling intact.
- Reduced label tracking; increased small shared label and button sizes.
- Unified panel corners, opaque theme surfaces, control height and choice spacing.
- Improved passage line spacing and wrapping.
- Damped button springs, reduced press travel, and disabled button transforms
  when reduced motion is requested.
- Correct choices stay stationary; other answers remain fully readable instead
  of fading to 60% opacity. Wrong-choice feedback is retained.
- Shortened answer entrance travel and removed sideways hover movement.

Validation uses the full production build, token/contrast checks, lint,
TypeScript and regression tests. This is a shared-system source review;
not a claim that every authenticated state or phone has been visually tested.
Questions, saved progress, authentication and payment settings are untouched.
