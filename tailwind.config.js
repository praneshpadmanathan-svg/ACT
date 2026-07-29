/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /* Leather and lantern-light — the UI chrome sits in the same world as
           the camp-tent and map illustrations. */
        leather: {
          950: '#14100b',
          900: '#1c1610',
          850: '#241d15',
          800: '#2e251a',
          750: '#3a2f21',
          700: '#4a3c2a',
          600: '#5d4b34',
        },
        /* Parchment — every reading surface. Matches the sheet the character
           illustrations were drawn on, so cutouts sit on it seamlessly. */
        parchment: {
          DEFAULT: '#f4e8cf',
          light: '#faf2e2',
          dim: '#e8d9ba',
          edge: '#cbb68f',
          deep: '#b89e72',
        },
        ink: {
          DEFAULT: '#2b2317',
          soft: '#5a4c37',
          faint: '#8a7856',
        },
        gold: {
          DEFAULT: '#d4a017',
          light: '#f0cf7a',
          bright: '#f2cf5b',
          deep: '#9c7410',
        },
        /* Region accents, keyed to the painted map. */
        village: '#d9a441',
        woods: '#5fa86b',
        desert: '#d2703a',
        cliffs: '#4f9dc9',
        summit: '#e8c34a',
        blood: '#a8402f',
      },
      fontFamily: {
        display: ['Cinzel', 'Georgia', 'serif'],
        script: ['"IM Fell English SC"', 'Georgia', 'serif'],
        read: ['Newsreader', 'Georgia', 'serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
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
      },
    },
  },
  plugins: [],
};
