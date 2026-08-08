import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import textScale from './scripts/postcss-text-scale.mjs';

export default {
  plugins: [
    tailwindcss,
    /* After Tailwind, so it also rewrites the generated utility classes —
       `text-[15px]` and friends — not just the components layer. */
    textScale(),
    autoprefixer,
  ],
};
