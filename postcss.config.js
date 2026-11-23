import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import textScale from './scripts/postcss-text-scale.mjs';
import hoverOnly from './scripts/postcss-hover-only.mjs';

export default {
  plugins: [
    tailwindcss,
    /* After Tailwind, so it also rewrites the generated utility classes —
       `text-[15px]` and friends — not just the components layer. */
    textScale(),
    /* Also after Tailwind, for the same reason: `hover:` utilities stick on a
       touchscreen just as the hand-written hover rules do. */
    hoverOnly(),
    autoprefixer,
  ],
};
