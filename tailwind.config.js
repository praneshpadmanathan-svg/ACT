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
const tone = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

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
        /* Parchment — every reading surface. Matches the sheet the character
           illustrations were drawn on, so cutouts sit on it seamlessly. */
        parchment: {
          DEFAULT: tone('parchment'),
          light: tone('parchment-light'),
          dim: tone('parchment-dim'),
          edge: tone('parchment-edge'),
          deep: tone('parchment-deep'),
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
        /* Region accents, keyed to the painted map. Identical in both themes —
           they are mid-tones lifted off the artwork and read on either. */
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
      boxShadow: {
        card: '0 2px 0 rgba(0,0,0,.35), 0 10px 26px rgba(0,0,0,.35)',
        sheet: '0 1px 0 rgba(255,255,255,.5) inset, 0 12px 30px rgba(0,0,0,.35)',
        pin: '0 3px 8px rgba(0,0,0,.5)',
      },
      keyframes: {
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-7px)' } },
        bobHero: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-4px)' } },
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
        rise: { '0%': { transform: 'translateY(0)', opacity: '1' }, '100%': { transform: 'translateY(-80px)', opacity: '0' } },
        fadein: { from: { opacity: '0' }, to: { opacity: '1' } },
        slidein: { from: { transform: 'translateX(110%)', opacity: '0' }, to: { transform: 'translateX(0)', opacity: '1' } },
        shimmer: { '0%,100%': { opacity: '.55' }, '50%': { opacity: '1' } },

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
          '15%': { transform: 'translateX(11px) rotate(2deg)', filter: 'brightness(2.4) saturate(.4)' },
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
        pulseRing: 'pulseRing 2.4s ease-out infinite',
        popIn: 'popIn .42s cubic-bezier(.22,1.4,.36,1) backwards',
        drift: 'drift 90s linear infinite',
        mote: 'mote var(--md,8s) ease-out var(--dl,0s) infinite',
        rise: 'rise 1.15s ease-out forwards',
        fadein: 'fadein .4s ease-out',
        slidein: 'slidein .3s ease-out',
        shimmer: 'shimmer 2.6s ease-in-out infinite',
        pageIn: 'pageIn .34s cubic-bezier(.22,1,.36,1)',
        riseIn: 'riseIn .3s cubic-bezier(.22,1,.36,1) backwards',
        slideDown: 'slideDown .22s cubic-bezier(.22,1,.36,1)',
        storyIn: 'storyIn .34s ease-out',
        storyOut: 'storyOut .34s ease-in forwards',
        storyTitle: 'storyTitle .6s cubic-bezier(.22,1,.36,1) backwards',
        storyWizzy: 'storyWizzy .5s cubic-bezier(.22,1.3,.36,1) .1s backwards',
        storyChoice: 'storyChoice .3s cubic-bezier(.22,1,.36,1) backwards',
        bossIdle: 'bossIdle 3.4s ease-in-out infinite',
        bossHurt: 'bossHurt .6s cubic-bezier(.36,.07,.19,.97)',
        bossLunge: 'bossLunge .6s cubic-bezier(.36,.07,.19,.97)',
        bossDown: 'bossDown .9s cubic-bezier(.22,1,.36,1) forwards',
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
