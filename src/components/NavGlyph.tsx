import { Glyph, type IconName, minStroke } from './Icon';

/* Drawn nav glyphs.

   Emoji looked amateur next to the illustrations and rendered differently on
   every platform. These are line-drawn at a consistent 24px grid and stroke
   weight so the nav reads as one set — a tent, a map, a tome, a blade, a
   shield, an hourglass, a crown.

   A concept both sets need is drawn once, in `Icon`, and borrowed here, so a
   gear in the rail and a gear in the command palette are the same gear. */

const SHARED: Partial<Record<GlyphName, IconName>> = {
  tent: 'tent',
  hourglass: 'hourglass',
  crown: 'crown',
  chart: 'chart',
  shield: 'shieldCracked',
  star: 'starFilled',
  map: 'map',
  book: 'book',
  sword: 'sword',
  gear: 'settings',
  sound: 'speaker',
  close: 'cross',
};

export type GlyphName =
  | 'tent'
  | 'map'
  | 'book'
  | 'sword'
  | 'shield'
  | 'hourglass'
  | 'crown'
  | 'chart'
  | 'gear'
  | 'star'
  | 'sound'
  | 'soundOff'
  | 'menu'
  | 'close';

interface Props {
  name: GlyphName;
  size?: number;
  className?: string;
}

export function NavGlyph({ name, size = 18, className }: Props) {
  const shared = SHARED[name];
  if (shared) return <Glyph name={shared} size={size} className={className} />;
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: minStroke(1.7, size),
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true as const,
    focusable: 'false' as const,
  };

  switch (name) {
    case 'soundOff':
      return (
        <svg {...common}>
          <path d="M4.5 9.5v5h3l4 3.5v-12l-4 3.5h-3Z" />
          <path d="m15.5 9.8 4.4 4.4M19.9 9.8l-4.4 4.4" />
        </svg>
      );

    case 'menu':
      return (
        <svg {...common}>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      );

    default:
      return null;
  }
}
