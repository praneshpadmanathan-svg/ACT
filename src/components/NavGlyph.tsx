/* Drawn nav glyphs.

   Emoji looked amateur next to the illustrations and rendered differently on
   every platform. These are line-drawn at a consistent 24px grid and stroke
   weight so the nav reads as one set — a tent, a map, a tome, a blade, an
   hourglass, a crown. */

export type GlyphName =
  | 'tent'
  | 'map'
  | 'book'
  | 'sword'
  | 'hourglass'
  | 'crown'
  | 'chart'
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
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.7,
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
          <path d="M12 4 3.5 19h17L12 4Z" />
          <path d="M12 4v15" />
          <path d="m12 12 4 7M12 12l-4 7" />
        </svg>
      );

    case 'map':
      return (
        <svg {...common}>
          <path d="M9 5 3.5 7.4v11.4L9 16.4l6 2.4 5.5-2.4V5L15 7.4 9 5Z" />
          <path d="M9 5v11.4M15 7.4v11.4" />
        </svg>
      );

    case 'book':
      return (
        <svg {...common}>
          <path d="M4 5.2A1.6 1.6 0 0 1 5.6 3.6H19v14.2H5.6A1.6 1.6 0 0 0 4 19.4V5.2Z" />
          <path d="M4 19.4a1.6 1.6 0 0 0 1.6 1.6H19" />
          <path d="M8 8h7M8 11.4h5" />
        </svg>
      );

    case 'sword':
      return (
        <svg {...common}>
          <path d="M20 3.5 10.6 12.9" />
          <path d="M20 3.5v4.2l-2.6 2.6" />
          <path d="m7.2 16.3 1.2-1.2 1.4 1.4-1.2 1.2" />
          <path d="M6.4 17.1 4 19.5l.6.6L7 17.7" />
          <path d="m8.4 13.5 2.2 2.2" />
        </svg>
      );

    case 'hourglass':
      return (
        <svg {...common}>
          <path d="M6.5 3h11M6.5 21h11" />
          <path d="M7.5 3v3.2c0 2 4.5 3.9 4.5 5.8s-4.5 3.8-4.5 5.8V21" />
          <path d="M16.5 3v3.2c0 2-4.5 3.9-4.5 5.8s4.5 3.8 4.5 5.8V21" />
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
            d="M12 3.2 14.4 9l6.4.5-4.8 4.2 1.4 6.2L12 16.6l-5.4 3.3L8 13.7 3.2 9.5 9.6 9 12 3.2Z"
            fill="currentColor"
          />
        </svg>
      );

    case 'sound':
      return (
        <svg {...common}>
          <path d="M4.5 9.5v5h3l4 3.5v-12l-4 3.5h-3Z" />
          <path d="M15 9.4a3.6 3.6 0 0 1 0 5.2M17.6 7a7 7 0 0 1 0 10" />
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

    case 'close':
      return (
        <svg {...common}>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      );

    default:
      return null;
  }
}
