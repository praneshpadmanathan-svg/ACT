/* Places in the realm that are not landmarks.

   Fourteen pieces of the world you collect rather than clear: the waterfall,
   the crystal cave, the volcano, the shipwreck, the citadel gate. They cost
   nothing, gate nothing and quiz you on nothing. Each gives a small piece of
   the realm's story and a little XP the first time.

   They began as hidden spots on the painted map, rewarded for panning around
   it. The map is gone; the realm is not. They live in the Codex now, unsealed
   region by region as you take ground — the reward for a subject finished
   rather than for a pixel found, which is a better thing to pay out on
   anyway. The coordinates they used to carry went with the illustration. */

import type { SectionId } from '@/types';
import { REGION_ORDER } from '@/content/regionFlavor';

export interface Discovery {
  id: string;
  name: string;
  /** Which region has to be underway before it can be found. */
  region: SectionId | 'summit';
  /** Shown when you find it. */
  lore: string;
  xp: number;
}

export const DISCOVERIES: Discovery[] = [
  /* --- the village ------------------------------------------------------- */
  {
    id: 'the-well',
    name: 'The Village Well',
    region: 'english',
    lore: 'The oldest thing in the village, and the only one nobody argues about. Drop a stone and you can count to four before it lands. The children here are told the well remembers every question ever asked over it, which is the kind of thing adults say to stop people leaning in.',
    xp: 40,
  },
  {
    id: 'the-watchtower',
    name: 'The Old Watchtower',
    region: 'english',
    lore: 'Built to watch the eastern road, back when the eastern road went somewhere. The stair inside stops halfway up — whoever finished the outside never finished the inside. From the top you can see the whole valley and, on a bad day, the grey line where it stops.',
    xp: 40,
  },
  {
    id: 'woodcutters-camp',
    name: "The Woodcutter's Camp",
    region: 'english',
    lore: 'A tent, a stack of split logs, and a fire that someone has kept going for longer than seems reasonable. They cut only deadwood and only from the valley floor. Ask them why and they will tell you the forest up the hill is not theirs to cut, and change the subject.',
    xp: 40,
  },

  /* --- the woods --------------------------------------------------------- */
  {
    id: 'the-falls',
    name: 'The Falling Water',
    region: 'reading',
    lore: 'The river leaves the woods here and does not come back. Stand at the lip and the noise removes every thought you had on the way up, which the foresters consider the point. They send apprentices here when they cannot stop talking.',
    xp: 50,
  },
  {
    id: 'crystal-cave',
    name: 'The Crystal Hollow',
    region: 'reading',
    lore: 'The stones grow. Slowly — a hand-width in a lifetime — but they grow, and they grow toward light. Cover one for a season and it will have turned to face wherever the light went. Nobody has a good explanation and the woods do not seem to want one.',
    xp: 50,
  },
  {
    id: 'the-jetty',
    name: 'The Sunken Jetty',
    region: 'reading',
    lore: 'Planks going out into a pool that has no far side and no boats. Someone built a landing here for something. The wood is sound, which means it was built recently, which is the part the foresters do not like to discuss.',
    xp: 50,
  },

  /* --- the desert -------------------------------------------------------- */
  {
    id: 'the-arch',
    name: 'Under the Great Arch',
    region: 'math',
    lore: 'Carved end to end with a single line of figures, repeating. Nobody has found the beginning. A surveyor once spent four years copying it out and concluded it was a measurement — of what, she would not say, and she left before anyone could ask again.',
    xp: 50,
  },
  {
    id: 'the-volcano',
    name: 'The Ember Peak',
    region: 'math',
    lore: 'It has been about to erupt for two hundred years. The desert people plant on its lower slopes anyway, because the soil is the best on the continent and because a threat you have lived with for two centuries stops being a threat and becomes a neighbour.',
    xp: 50,
  },
  {
    id: 'the-boat',
    name: 'The Stranded Boat',
    region: 'math',
    lore: 'A river boat, upright, in good repair, forty miles from any water deep enough to float it. The desert people leave it alone. They say the water was here once and may take an interest in coming back, and it would be rude to have moved the boat.',
    xp: 50,
  },

  /* --- the cliffs -------------------------------------------------------- */
  {
    id: 'the-lighthouse',
    name: 'The Lighthouse Lamp',
    region: 'science',
    lore: "The lamp has not gone out in living memory. It is not lit by anyone — the keeper's job is to record it, not to feed it. Her logbook goes back nine generations and every entry says the same three words: still burning, steady.",
    xp: 50,
  },
  {
    id: 'the-wreck',
    name: 'The Wreck on the Rocks',
    region: 'science',
    lore: 'Broken across the sea stack, and by the look of the timbers it went on in calm weather with a full crew and a lit lighthouse. Everything that should have prevented it was working. The cliff scholars keep the wreck exactly as it lies and argue about it constantly.',
    xp: 50,
  },
  {
    id: 'the-observatory',
    name: 'The Great Lens',
    region: 'science',
    lore: 'Ground from a single piece of the crystal that grows in the woods. It shows the sky, and — if you sit with it long enough on a still night — the faint grey edge out past the water where the maps stop agreeing with each other.',
    xp: 60,
  },
  {
    id: 'the-crystals',
    name: 'The Rainbow Cave',
    region: 'science',
    lore: 'Every colour, and all of them wrong: hold a stone up and the colour it shows is not the colour it is. The scholars have stopped trying to explain it and started trying to use it. Two of them have gone quite odd.',
    xp: 50,
  },

  /* --- the summit -------------------------------------------------------- */
  {
    id: 'the-citadel-gate',
    name: 'The Citadel Gate',
    region: 'summit',
    lore: 'It has never been locked. That is not generosity — the gate has no lock, and no hinges either, and appears to have been built open on purpose. Whatever the citadel was defending against, the builders did not think a door would help.',
    xp: 80,
  },
];

export const DISCOVERY_BY_ID: Record<string, Discovery> = Object.fromEntries(
  DISCOVERIES.map((d) => [d.id, d]),
);

/** Discoveries belonging to a region, for the mist rules and the log. */
export function discoveriesIn(region: Discovery['region']): Discovery[] {
  return DISCOVERIES.filter((d) => d.region === region);
}

/* A discovery is reachable once its region has been started; the summit ones
   wait until every region is finished.

   This lived inside `DiscoveryLayer` while the only way to reach a discovery
   was to click the right pixel of the illustration. The Codex asks the same
   question of the same data, so the rule sits with the data now — the gating
   is what a discovery *is*, and should not be reimplemented by whatever
   happens to be showing them. */
export function isReachable(d: Discovery, clearedByRegion: Record<SectionId, number>): boolean {
  if (d.region === 'summit') {
    return REGION_ORDER.every((id) => (clearedByRegion[id] ?? 0) >= 1);
  }
  return (clearedByRegion[d.region] ?? 0) > 0;
}
