/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Surfaces — deep indigo, not black. Keeps the pixel art from
        // looking like it's floating in a void.
        ink: {
          950: '#07040f',
          900: '#0b0718',
          850: '#100b23',
          800: '#16102e',
          750: '#1d1640',
          700: '#251c52',
          600: '#33265f',
          500: '#453278',
        },
        edge: {
          DEFAULT: '#33265f',
          bright: '#553f96',
        },
        // Reading surfaces — warm off-white, easier on the eyes than pure
        // white for long passages.
        paper: {
          DEFAULT: '#f7f4ee',
          dim: '#ebe6dc',
          edge: '#d9d2c4',
          ink: '#1c1a24',
          soft: '#4a4658',
        },
        gold: '#ffd23e',
        ember: '#ff9d5c',
        cyan: '#3ad6f0',
        rose: '#ff8298',
        violet: '#b79cff',
        crimson: '#ff5d78',
        mint: '#5ee6a8',
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
        screen: ['Silkscreen', 'monospace'],
        digit: ['VT323', 'monospace'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        read: ['Newsreader', 'Georgia', 'serif'],
      },
      boxShadow: {
        pixel: '0 4px 0 rgba(0,0,0,.55)',
        'pixel-lg': '0 6px 0 rgba(0,0,0,.55)',
      },
      keyframes: {
        bob: { '0%,49%': { transform: 'translateY(0)' }, '50%,100%': { transform: 'translateY(-3px)' } },
        rise: { '0%': { transform: 'translateY(0)', opacity: '1' }, '100%': { transform: 'translateY(-90px)', opacity: '0' } },
        pop: { '0%': { transform: 'scale(0)' }, '70%': { transform: 'scale(1.12)' }, '100%': { transform: 'scale(1)' } },
        blink: { '0%,60%': { opacity: '1' }, '61%,100%': { opacity: '0' } },
        drift: { from: { transform: 'translateX(-8%)' }, to: { transform: 'translateX(108%)' } },
        twinkle: { '0%,70%': { opacity: '1' }, '71%,100%': { opacity: '.25' } },
        slidein: { from: { transform: 'translateX(120%)', opacity: '0' }, to: { transform: 'translateX(0)', opacity: '1' } },
        fadein: { from: { opacity: '0' }, to: { opacity: '1' } },
        spin: { to: { transform: 'rotate(360deg)' } },
      },
      animation: {
        bob: 'bob 1s steps(2) infinite',
        rise: 'rise 1.15s ease-out forwards',
        pop: 'pop .32s cubic-bezier(.2,1.8,.4,1)',
        blink: 'blink 1.1s steps(1) infinite',
        drift: 'drift 46s linear infinite',
        twinkle: 'twinkle 2.4s steps(2) infinite',
        slidein: 'slidein .3s ease-out',
        fadein: 'fadein .4s ease-out',
      },
    },
  },
  plugins: [],
};
