import { Glyph, type IconName, minStroke } from './Icon';

/* Drawn nav glyphs.

   Emoji looked amateur next to the illustrations and rendered differently on
   every platform. These are line-drawn at a consistent 24px grid and stroke
   weight so the nav reads as one set — a tent, a map, a tome, a blade, a
   shield, an hourglass, a crown.

   A concept both sets need is drawn once, in `Icon`, and borrowed here, so a
   gear in the rail and a gear in the command palette are the same gear. */

const SHARED: Partial<Record<GlyphName, IconName>> = {
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
    case 'tent':
      return (
        <svg {...common}>
          <path d="M12 4.5 3.5 19.5h17L12 4.5Z" />
          <path d="M12 4.5v15" />
          <path d="m12 12.5 4 7M12 12.5l-4 7" />
        </svg>
      );

    /* The guardians. A blade would have been the obvious choice and is already
       taken by Training — two tabs wearing one icon is worse than a slightly
       less literal glyph, so the duels get the thing standing between you and
       the region's end: a shield with a jagged crack down the middle. */
    case 'shield':
      return (
        <svg {...common}>
          <path d="M12 3.2 19.5 6v6.2c0 4-3.1 7-7.5 8.6-4.4-1.6-7.5-4.6-7.5-8.6V6L12 3.2Z" />
          <path d="m12.4 7-1.4 3.2 2.2 2-1.6 3.2.6 2.4" />
        </svg>
      );

    case 'hourglass':
      return (
        <svg {...common}>
          <path d="M5 3h14M5 21h14" />
          <path d="M6.5 3v3.2c0 2.2 5.5 3.9 5.5 5.8s-5.5 3.6-5.5 5.8V21" />
          <path d="M17.5 3v3.2c0 2.2-5.5 3.9-5.5 5.8s5.5 3.6 5.5 5.8V21" />
        </svg>
      );

    case 'crown':
      return (
        <svg {...common}>
          <path d="M3.5 8.2 7 12l3-6 2-2.4L14 6l3 6 3.5-3.8-1.4 10.4H4.9L3.5 8.2Z" />
          <path d="M5.4 21h13.2" />
        </svg>
      );

    case 'chart':
      return (
        <svg {...common}>
          <path d="M4 4v16h16" />
          <path d="M8 16v-4M12 16V8M16 16v-6" />
        </svg>
      );

    case 'star':
      return (
        <svg {...common} strokeWidth={1.4}>
          <path
            d="M12 3.2l2.6 6.1 6.6.5-5 4.3 1.5 6.5L12 17.2 6.3 20.6l1.5-6.5-5-4.3 6.6-.5L12 3.2Z"
            fill="currentColor"
          />
        </svg>
      );

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
