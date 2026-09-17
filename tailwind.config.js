/* Every colour is a CSS variable holding a space-separated RGB triple, wrapped
   here so Tailwind's `/50` opacity modifiers keep working.

   The literals used to live in this file, which meant the palette was frozen
   at build time and a light mode was impossible without rewriting the class
   name on every element in the app. The values now live in `:root` and are
   overridden wholesale by `[data-theme='light']` in index.css, so the same
   `bg-leather-850 text-parchment` markup renders dark leather or warm paper
   depending on one attribute.

   Read the token names as *roles*, not as literal materials: `leather` is
   "chrome surface", `parchment` is "text on chrome", `ink` is "text on a
   reading sheet". In light mode leather is pale and parchment is dark, and
   every component follows without touching a single class. */
const tone = (name) => `oklch(var(--c-${name}) / <alpha-value>)`;

/* ---------------------------------------------------------------- motion

   Five durations and four curves, shared between the `duration-*`/`ease-*`
   utilities and the keyframe animations below — the four bezier strings were
   being retyped at a dozen call sites, so the house curve could not be
   adjusted in one place.

   The ladder covers *interface* motion: a menu opening, a page arriving, a
   panel lifting. The combat and character animations further down keep their
   hand-tuned durations, because those are timed against sprite work and sound
   cues rather than against each other — a boss lunge is 600ms because that is
   when the hit lands, not because 600ms is a step on a scale. */
const DUR = {
  instant: '90ms',
  quick: '160ms',
  base: '240ms',
  screen: '320ms',
  cinematic: '620ms',
};

const EASE = {
  /* Decelerating: things arriving. The overwhelming default. */
  out: 'cubic-bezier(0.22, 1, 0.36, 1)',
  /* Accelerating: things leaving, which should get out of the way quickly. */
  in: 'cubic-bezier(0.4, 0, 0.7, 0.2)',
  inout: 'cubic-bezier(0.65, 0, 0.35, 1)',
  /* Past the target and back. Only for things that should feel sprung. */
  overshoot: 'cubic-bezier(0.22, 1.4, 0.36, 1)',
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        /* Leather and lantern-light — the UI chrome sits in the same world as
           the camp-tent and map illustrations. */
        leather: {
          950: tone('leather-950'),
          900: tone('leather-900'),
          850: tone('leather-850'),
          800: tone('leather-800'),
          750: tone('leather-750'),
          700: tone('leather-700'),
          600: tone('leather-600'),
        },
        /* Parchment — *text on the chrome*, not a surface. Cream on dark
           leather; inverts to dark on pale leather in light mode. Only ever
           correct as `text-parchment*`; for a background or a border on a
           reading sheet reach for `paper` below.

           (This block used to be commented "every reading surface", which is
           what `paper` is. Both roles shared these tokens, and the light
           theme could only satisfy one of them at a time.) */
        parchment: {
          DEFAULT: tone('parchment'),
          light: tone('parchment-light'),
          dim: tone('parchment-dim'),
          edge: tone('parchment-edge'),
          deep: tone('parchment-deep'),
        },
        /* Paper — every reading surface. Matches the sheet the character
           illustrations were drawn on, so cutouts sit on it seamlessly.
           Identical in both themes; see the note in index.css. */
        paper: {
          DEFAULT: tone('paper'),
          light: tone('paper-light'),
          dim: tone('paper-dim'),
          edge: tone('paper-edge'),
          deep: tone('paper-deep'),
        },
        ink: {
          DEFAULT: tone('ink'),
          /* On parchment. */
          soft: tone('ink-soft'),
          /* Muted text on the dark chrome. Light enough to clear 4.5:1 against
             leather-850 — the earlier #8a7856 measured 3.89:1 and failed. */
          faint: tone('ink-faint'),
        },
        gold: {
          DEFAULT: tone('gold'),
          light: tone('gold-light'),
          bright: tone('gold-bright'),
          deep: tone('gold-deep'),
        },
        /* Gold as a background, fixed in both themes. Use it wherever the
           lettering on top is a fixed dark literal; `gold` is the text role
           and darkens in light mode. See index.css. */
        gilt: {
          DEFAULT: tone('gilt'),
          bright: tone('gilt-bright'),
        },
        /* Region accents, keyed to the painted world. These used to be
           identical in both themes — mid-tones lifted off the artwork, meant
           to read on either — but they did not: five of the six fell under
           3:1 on light paper. The light theme now declares its own six,
           re-picked so they stay apart from one another as well as from the
           page. See the note on them in index.css. */
        village: tone('village'),
        woods: tone('woods'),
        desert: tone('desert'),
        cliffs: tone('cliffs'),
        summit: tone('summit'),
        blood: tone('blood'),
        /* The region colours above are fill colours, mixed to sit against the
           painted map. As *text* on leather the darker ones fail: blood
           measures 2.73:1. These are the text-safe variants, used for the
           highlighted words in body copy — all measured at 6:1 or better.
           Light mode swaps them for dark equivalents against pale paper. */
        'blood-text': tone('blood-text'),
        'woods-text': tone('woods-text'),
        'cliffs-text': tone('cliffs-text'),
        'desert-text': tone('desert-text'),
        'village-text': tone('village-text'),
        /* Ink for a glyph on a woods fill, which inverts between themes. */
        'woods-ink': tone('woods-ink'),
      },
      fontFamily: {
        /* Three families, not four.

           IM Fell English SC used to hold the `script` role — small-caps
           eyebrows and labels. It is a second serif display face doing a job
           Cinzel already does, and shipping both meant a visitor downloaded two
           near-identical voices to render about forty words. Cinzel takes the
           role; the class name stays so nothing had to be renamed, and the
           tracking in `.eyebrow`/`.label-sm` was already carrying most of the
           small-caps character anyway.

           `--font-read` is a variable rather than a literal because the
           high-legibility toggle swaps Newsreader for Atkinson Hyperlegible on
           every reading surface at once. */
        display: ['Cinzel', 'Georgia', 'serif'],
        script: ['Cinzel', 'Georgia', 'serif'],
        read: ['var(--font-read)', 'Newsreader', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      /* The elevation ladder. The values live in index.css because they have
         to change between themes — a shadow tuned for near-black leather
         reads as a smudge on cream paper — and only the *names* belong here.

         Named for the job, not the number, so `shadow-lifted` means the same
         rank in both themes and a component never has to know which theme it
         is in. See the long note on the ladder in index.css for the rules. */
      boxShadow: {
        flush: 'var(--e-flush)',
        resting: 'var(--e-resting)',
        raised: 'var(--e-raised)',
        lifted: 'var(--e-lifted)',
        floating: 'var(--e-floating)',
        overlay: 'var(--e-overlay)',

        /* The old three. `card` and `sheet` are aliases onto the ladder rather
           than their old literals, so the ~22 call sites still carrying them
           picked up the theme-aware shadows without being touched. `pin` is
           gone outright: grep found zero uses. */
        card: 'var(--e-raised)',
        sheet: 'var(--lamp-edge-paper), var(--e-raised)',
      },

      /* ---------------------------------------------------------- type scale

         One fluid ratio, so the app stops picking a pixel size per component.
         Body sizes step by a minor third; display sizes open to a fourth, so
         a headline can get dramatic on a wide screen without dragging the
         reading sizes up with it.

         These are `clamp()` rather than breakpoint jumps because the reading
         column is already fluid, and text that resizes in steps against a
         container that resizes continuously is what produces the odd short
         line at 900px that nobody can ever reproduce.

         `--text-scale` is *not* applied here; the postcss-text-scale plugin
         wraps every emitted font-size, including these, so the accessibility
         setting still multiplies the whole scale. */
      fontSize: {
        'display-xl': [
          'clamp(2.75rem, 1.6rem + 5.2vw, 6rem)',
          { lineHeight: '1.02', letterSpacing: '-0.015em' },
        ],
        'display-l': [
          'clamp(2rem, 1.4rem + 2.6vw, 3.25rem)',
          { lineHeight: '1.08', letterSpacing: '-0.01em' },
        ],
        'display-m': ['clamp(1.5rem, 1.2rem + 1.4vw, 2.25rem)', { lineHeight: '1.15' }],
        title: ['clamp(1.15rem, 1.05rem + 0.5vw, 1.5rem)', { lineHeight: '1.25' }],
        'body-read': ['clamp(1.0625rem, 1rem + 0.35vw, 1.1875rem)', { lineHeight: '1.65' }],
        'body-ui': ['0.9375rem', { lineHeight: '1.5' }],
        label: ['0.6875rem', { lineHeight: '1.3', letterSpacing: '0.18em' }],
      },

      /* ------------------------------------------------------- motion tokens

         Thirty-odd hand-picked cubic-béziers used to live in the animation map
         below, one per effect, which meant no two things in the app moved
         alike and movement carried no meaning at all.

         Durations: under 100ms reads as instant, 100-300ms is the transition
         band, over 500ms reads as slow. `base` at 240ms is the default for
         anything entering or leaving; `screen` at 320ms for a whole view.

         Easings: out for entering, in for leaving, in-out for an element
         changing state in place. Springs are not here — they come from
         `motion` at the call site, because a spring responds to the velocity
         of the gesture that caused it and a CSS curve cannot. */
      transitionDuration: DUR,
      transitionTimingFunction: EASE,
      keyframes: {
        storyTitleOut: {
          '0%': { opacity: '1', transform: 'translateY(0) scale(1)', filter: 'blur(0px)' },
          '100%': { opacity: '0', transform: 'translateY(-26px) scale(1.04)', filter: 'blur(6px)' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-7px)' },
        },
        bobHero: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        /* A walk cycle, expressed as a transform rather than as frames.
         *
         * Baking a stride into the sprite itself was the first idea and it
         * cannot work: the map draws a 176px sprite at about 32, so a four
         * pixel stride in the source survives as half a screen pixel. The
         * body is the only thing at that size big enough to carry motion,
         * so the walk is the body — rise on the passing pose, fall and lean
         * onto the planted foot at each contact.
         *
         * Percentages, not pixels, so the same cycle reads correctly at 32
         * on the map and at 140 in the duel. `transform-origin` sits at the
         * feet, or the lean swings the whole figure sideways instead of
         * pivoting on the leg holding it up. */
        walkHero: {
          '0%,100%': { transform: 'translateY(0) rotate(-2.6deg)' },
          '25%,75%': { transform: 'translateY(-8%) rotate(0deg)' },
          '50%': { transform: 'translateY(0) rotate(2.6deg)' },
        },
        /* The rank-up banner arriving. Overshoots wide and settles, with the
           letter-spacing closing at the same time — the word is spread out
           and blurred at the moment it lands, so it reads as being stamped
           onto the screen rather than fading up on it. */
        stamp: {
          '0%': {
            opacity: '0',
            transform: 'scale(2.1)',
            filter: 'blur(14px)',
            letterSpacing: '.6em',
          },
          '55%': {
            opacity: '1',
            transform: 'scale(.94)',
            filter: 'blur(0)',
            letterSpacing: '.16em',
          },
          '75%': { transform: 'scale(1.03)' },
          '100%': { opacity: '1', transform: 'scale(1)', letterSpacing: '.2em' },
        },
        /* The white flash under the stamp. Brief enough to read as impact and
           capped well short of full white, which at this size is a headache
           rather than a reward. */
        flashOut: {
          '0%': { opacity: '.55' },
          '100%': { opacity: '0' },
        },
        pulseRing: {
          '0%': { transform: 'scale(.85)', opacity: '.75' },
          '70%': { transform: 'scale(1.5)', opacity: '0' },
          '100%': { transform: 'scale(1.5)', opacity: '0' },
        },
        popIn: {
          '0%': { transform: 'scale(0) translateY(8px)', opacity: '0' },
          '70%': { transform: 'scale(1.12)' },
          '100%': { transform: 'scale(1) translateY(0)', opacity: '1' },
        },
        drift: { from: { transform: 'translateX(-15%)' }, to: { transform: 'translateX(115%)' } },
        mote: {
          '0%': { transform: 'translateY(0) scale(.6)', opacity: '0' },
          '30%': { opacity: '.8' },
          '100%': { transform: 'translateY(-46px) scale(1)', opacity: '0' },
        },
        rise: {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(-80px)', opacity: '0' },
        },
        fadein: { from: { opacity: '0' }, to: { opacity: '1' } },
        slidein: {
          from: { transform: 'translateX(110%)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        /* The floor is a contrast limit, not a taste call. `animate-shimmer`
           is only ever used on small gold text — the story overlay's "Tap to
           continue", the Codex hint, the Tests hint — and gold on the dark
           panel is 7:1 at full strength but only 3.07:1 at .55, so the text
           spent half of every cycle below the 4.5:1 needed at that size.
           The light theme's panel is a touch lighter (44,37,28 against the
           dark theme's 36,29,21), so it is the binding case: .78 clears dark
           at 4.8:1 but leaves light at 4.46:1. .82 clears both — 5.16:1 dark,
           4.77:1 light — and the pulse still reads. */
        shimmer: { '0%,100%': { opacity: '.82' }, '50%': { opacity: '1' } },

        /* page + list entrances — small, fast, never in the way */
        pageIn: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        riseIn: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },

        /* story */
        storyIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        storyOut: { from: { opacity: '1' }, to: { opacity: '0' } },
        storyTitle: {
          from: { opacity: '0', transform: 'translateY(14px)', letterSpacing: '.3em' },
          to: { opacity: '1', transform: 'translateY(0)', letterSpacing: 'normal' },
        },
        storyWizzy: {
          from: { opacity: '0', transform: 'translateY(28px) scale(.94)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        storyChoice: {
          from: { opacity: '0', transform: 'translateX(-10px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },

        /* the duel */
        bossIdle: {
          '0%,100%': { transform: 'translateY(0) scale(1)' },
          '50%': { transform: 'translateY(-5px) scale(1.012)' },
        },
        bossHurt: {
          '0%': { transform: 'translateX(0)', filter: 'brightness(1)' },
          '15%': {
            transform: 'translateX(11px) rotate(2deg)',
            filter: 'brightness(2.4) saturate(.4)',
          },
          '35%': { transform: 'translateX(-7px) rotate(-1.5deg)' },
          '55%': { transform: 'translateX(5px)' },
          '100%': { transform: 'translateX(0)', filter: 'brightness(1)' },
        },
        bossLunge: {
          '0%,100%': { transform: 'translateX(0) scale(1)' },
          '35%': { transform: 'translateX(-26px) scale(1.07)' },
          '60%': { transform: 'translateX(6px) scale(1.02)' },
        },
        bossDown: {
          from: { transform: 'translateY(0) rotate(0deg)', opacity: '1' },
          to: { transform: 'translateY(34px) rotate(9deg)', opacity: '.35' },
        },
        bossEnter: {
          from: { opacity: '0', transform: 'translateY(-26px) scale(.88)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        heroHurt: {
          '0%,100%': { transform: 'translateX(0)', filter: 'brightness(1)' },
          '20%': { transform: 'translateX(-9px)', filter: 'brightness(1.9) saturate(.5)' },
          '45%': { transform: 'translateX(6px)' },
          '70%': { transform: 'translateX(-3px)' },
        },

        /* The scene rattling under a story beat. Two weights: soft for a
           tremor, hard for a Seal breaking. Both decay to nothing so the text
           is never moving while you are trying to read it. */
        shakeSoft: {
          '0%,100%': { transform: 'translate(0,0)' },
          '15%': { transform: 'translate(-3px,1px)' },
          '30%': { transform: 'translate(2px,-2px)' },
          '45%': { transform: 'translate(-2px,-1px)' },
          '60%': { transform: 'translate(2px,1px)' },
          '80%': { transform: 'translate(-1px,0)' },
        },
        shakeHard: {
          '0%,100%': { transform: 'translate(0,0) rotate(0deg)' },
          '8%': { transform: 'translate(-9px,3px) rotate(-.5deg)' },
          '18%': { transform: 'translate(8px,-5px) rotate(.5deg)' },
          '28%': { transform: 'translate(-7px,-3px) rotate(-.4deg)' },
          '38%': { transform: 'translate(6px,4px) rotate(.35deg)' },
          '50%': { transform: 'translate(-5px,2px) rotate(-.25deg)' },
          '64%': { transform: 'translate(4px,-2px)' },
          '78%': { transform: 'translate(-2px,1px)' },
          '90%': { transform: 'translate(1px,0)' },
        },
        /* A flash of light through the scene as something gives way. */
        sealFlash: {
          '0%': { opacity: '0' },
          '12%': { opacity: '.85' },
          '100%': { opacity: '0' },
        },
        questPulse: {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(212,160,23,.5)' },
          '60%': { boxShadow: '0 0 0 9px rgba(212,160,23,0)' },
        },
      },
      animation: {
        float: 'float 3.6s ease-in-out infinite',
        bobHero: 'bobHero 1.9s ease-in-out infinite',
        /* 0.62s a cycle is two steps at 310ms each — a walking pace, and the
           interval the footstep cue is fired on. Keep the two in step: the
           number lives in `AdventureMap` as `STEP_MS`. */
        walkHero: 'walkHero .62s ease-in-out infinite',
        pulseRing: 'pulseRing 2.4s ease-out infinite',
        popIn: `popIn .42s ${EASE.overshoot} backwards`,
        stamp: 'stamp .72s cubic-bezier(.2,.9,.25,1) backwards',
        flashOut: 'flashOut .5s ease-out forwards',
        drift: 'drift 90s linear infinite',
        mote: 'mote var(--md,8s) ease-out var(--dl,0s) infinite',
        rise: 'rise 1.15s ease-out forwards',
        fadein: 'fadein .4s ease-out',
        slidein: 'slidein .3s ease-out',
        shimmer: 'shimmer 2.6s ease-in-out infinite',
        /* Interface motion, on the ladder. */
        pageIn: `pageIn ${DUR.screen} ${EASE.out}`,
        riseIn: `riseIn ${DUR.screen} ${EASE.out} backwards`,
        slideDown: `slideDown ${DUR.base} ${EASE.out}`,
        storyIn: `storyIn ${DUR.screen} ${EASE.out}`,
        storyOut: `storyOut ${DUR.screen} ${EASE.in} forwards`,
        storyTitle: `storyTitle ${DUR.cinematic} ${EASE.out} backwards`,
        /* The title does not vanish so the scene can start; it lifts away
           while the scene is already rising. Both are on screen for about
           400ms, which is what turns two animations into one movement. */
        storyTitleOut: `storyTitleOut .42s ${EASE.in} forwards`,
        storyWizzy: 'storyWizzy .5s cubic-bezier(.22,1.3,.36,1) .1s backwards',
        storyChoice: `storyChoice ${DUR.base} ${EASE.out} backwards`,
        bossIdle: 'bossIdle 3.4s ease-in-out infinite',
        bossHurt: 'bossHurt .6s cubic-bezier(.36,.07,.19,.97)',
        bossLunge: 'bossLunge .6s cubic-bezier(.36,.07,.19,.97)',
        bossDown: `bossDown .9s ${EASE.out} forwards`,
        bossEnter: 'bossEnter .7s cubic-bezier(.22,1.2,.36,1) backwards',
        heroHurt: 'heroHurt .5s cubic-bezier(.36,.07,.19,.97)',
        shakeSoft: 'shakeSoft .5s ease-out',
        shakeHard: 'shakeHard 1.05s cubic-bezier(.36,.07,.19,.97)',
        sealFlash: 'sealFlash .8s ease-out forwards',
        questPulse: 'questPulse 2.4s ease-out infinite',
      },
    },
  },
  plugins: [],
};
