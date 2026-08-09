/* Who the traveller is.
 *
 * The app shipped with exactly one hero — a white boy with brown hair, drawn
 * once as `hero-char.webp` — for an audience of every 13-to-17-year-old in the
 * country. `Progress.hero` was typed, written once as the string `'cadet'`,
 * and read by nothing anywhere in the codebase: character selection had been
 * scaffolded and abandoned. This is that field finally meaning something.
 *
 * These are drawn rather than painted, and that is a deliberate constraint
 * rather than a preference. Eight painted portraits is eight commissions; a
 * parameterised drawing is eight *today*, in the app's own line register, and
 * the parameters are the ones that actually decide whether a fourteen-year-old
 * recognises themselves: skin tone, hair colour, hair shape, build. When the
 * painted set exists it drops in behind this same id.
 *
 * The ids are stable strings. Renaming one would silently reset the avatar of
 * everyone who had chosen it, so they are neutral (`ash`, `wren`) rather than
 * descriptive of appearance — nobody's saved progress should carry a label
 * about their skin.
 */

export type HairStyle = 'crop' | 'locs' | 'braid' | 'wave' | 'wrap' | 'curls';
export type Build = 'slight' | 'even' | 'broad';

export interface Hero {
  id: string;
  name: string;
  /** Two words, in the world's voice. Not a description of appearance. */
  tagline: string;
  skin: string;
  /** A darker pass of `skin`, for the jaw and neck shadow. */
  skinShade: string;
  hair: string;
  hairStyle: HairStyle;
  cloak: string;
  cloakShade: string;
  build: Build;
}

export const HEROES: Hero[] = [
  {
    id: 'ash',
    name: 'Ash',
    tagline: 'Travels light.',
    skin: '#f0cfae',
    skinShade: '#d9ac82',
    hair: '#3b2a1c',
    hairStyle: 'crop',
    cloak: '#5fa86b',
    cloakShade: '#3d7248',
    build: 'even',
  },
  {
    id: 'wren',
    name: 'Wren',
    tagline: 'Reads the weather.',
    skin: '#8a5a3b',
    skinShade: '#6b432a',
    hair: '#1c1410',
    hairStyle: 'locs',
    cloak: '#4f9dc9',
    cloakShade: '#2f6b8e',
    build: 'slight',
  },
  {
    id: 'juniper',
    name: 'Juniper',
    tagline: 'Never lost twice.',
    skin: '#e2ad83',
    skinShade: '#c48a5f',
    hair: '#6b2f1a',
    hairStyle: 'braid',
    cloak: '#a8402f',
    cloakShade: '#7d2f22',
    build: 'even',
  },
  {
    id: 'kesh',
    name: 'Kesh',
    tagline: 'Carries the lantern.',
    skin: '#5d3a24',
    skinShade: '#432818',
    hair: '#120d0a',
    hairStyle: 'curls',
    cloak: '#d9a441',
    cloakShade: '#a97d24',
    build: 'broad',
  },
  {
    id: 'noor',
    name: 'Noor',
    tagline: 'Keeps the map.',
    skin: '#c98f62',
    skinShade: '#a56e45',
    hair: '#241812',
    hairStyle: 'wrap',
    cloak: '#7a4fd0',
    cloakShade: '#573596',
    build: 'even',
  },
  {
    id: 'sable',
    name: 'Sable',
    tagline: 'Walks at night.',
    skin: '#4a2c1a',
    skinShade: '#331c0f',
    hair: '#0f0b08',
    hairStyle: 'braid',
    cloak: '#3f7d47',
    cloakShade: '#2a5730',
    build: 'slight',
  },
  {
    id: 'linden',
    name: 'Linden',
    tagline: 'Asks better questions.',
    skin: '#fadfc4',
    skinShade: '#e3bd99',
    hair: '#c9a24a',
    hairStyle: 'wave',
    cloak: '#d2703a',
    cloakShade: '#a24f22',
    build: 'broad',
  },
  {
    id: 'io',
    name: 'Io',
    tagline: 'First up the ridge.',
    skin: '#a06a45',
    skinShade: '#7d4e2f',
    hair: '#4a2410',
    hairStyle: 'crop',
    /* Muted, but not so muted it disappears. At #4a3c2a this cloak was darker
       than the leather chrome behind it in the duel and darker than the pine
       forest on the map, and Io was a silhouette-shaped hole in both. */
    cloak: '#7a6242',
    cloakShade: '#4e3c26',
    build: 'even',
  },
];

export const DEFAULT_HERO_ID = 'ash';

const BY_ID = new Map(HEROES.map((h) => [h.id, h]));

export const isHeroId = (value: unknown): value is string =>
  typeof value === 'string' && BY_ID.has(value);

/** Always returns a hero. `'cadet'` — the old dead value — lands on the
 *  default rather than rendering nothing, so existing saves just work. */
export function heroFor(id: string | null | undefined): Hero {
  return BY_ID.get(id ?? '') ?? BY_ID.get(DEFAULT_HERO_ID)!;
}
