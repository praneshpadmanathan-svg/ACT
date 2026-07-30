/* The animation feature set, in its own module so LazyMotion can fetch it as a
   separate chunk after first paint.

   This file exists only to be dynamically imported. Importing `domAnimation`
   directly from the provider would put the whole feature set in the main
   bundle, which is what LazyMotion is there to avoid. */

import { domAnimation } from 'motion/react';

export default domAnimation;
