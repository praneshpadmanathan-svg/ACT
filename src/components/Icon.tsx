/* The app's icon set.
 *
 * `NavGlyph` covered the seven nav destinations and five pieces of chrome and
 * stopped there, so everything else in the app fell back to a text character
 * or an emoji. A 🔥 on the streak chip is the clearest example of the problem:
 * it renders as a flat orange blob on Windows, a three-dimensional cartoon on
 * Apple, and something different again on Android, it announces itself to a
 * screen reader as "fire", and it sits inside a hand-illustrated fantasy world
 * looking like it was pasted in from a phone keyboard.
 *
 * Same grid and same weight as `NavGlyph` — 24×24, 1.7px round-capped stroke,
 * `currentColor` throughout — so the two files read as one set. Anything drawn
 * with a fill says so explicitly.
 *
 * Every icon here is decorative by default (`aria-hidden`), because in every
 * place the app uses one there is a text label beside it. Pass a `title` for
 * the rare case where the icon is the only thing carrying the meaning, and it
 * becomes a labelled `img` instead.
 */

export type IconName =
  // state
  | 'check'
  | 'cross'
  | 'alert'
  // reward and progress
  | 'flame'
  | 'bolt'
  | 'trophy'
  | 'target'
  | 'spark'
  // tools
  | 'calculator'
  | 'pencil'
  | 'speaker'
  | 'stop'
  | 'bookmark'
  | 'bookmarkFilled'
  | 'flag'
  | 'copy'
  | 'settings'
  | 'compass'
  | 'clock'
  // navigation
  | 'arrowLeft'
  | 'chevronRight'
  | 'chevronUp'
  | 'chevronDown'
  // content
  | 'quill'
  | 'scroll'
  | 'lantern'
  | 'shield'
  /* Named by the fifteen achievements in `progress.ts`. That field used to be
     a loose `string` referencing icons nobody had drawn, so all fifteen
     rendered the same ✦; it is `IconName` now, and a typo is a build error. */
  | 'star'
  | 'sword'
  | 'book'
  | 'map'
  | 'calendar'
  /* Destinations. Drawn here rather than only in NavGlyph so the rail, the
     command palette and Home's shortcuts all name a place with one glyph —
     Home was a tent in one and a lantern in another, and the clock meant
     Review in the palette and Timed practice on Home. */
  | 'tent'
  | 'hourglass'
  | 'crown'
  | 'chart'
  | 'shieldCracked'
  | 'starFilled';

interface Props {
  name: IconName;
  size?: number;
  className?: string;
  /** Supply only when the icon is the sole carrier of meaning. */
  title?: string;
  strokeWidth?: number;
}

/* The grid is 24 units, so at 12px a 1.7 stroke draws 0.85 CSS px and turns to
   grey fuzz. Never let a stroke render thinner than one pixel. */
export const minStroke = (width: number, size: number): number => Math.max(width, 24 / size);

export function Glyph({ name, size = 18, className, title, strokeWidth = 1.7 }: Props) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: minStroke(strokeWidth, size),
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    focusable: 'false' as const,
    ...(title ? { role: 'img' as const, 'aria-label': title } : { 'aria-hidden': true as const }),
  };

  switch (name) {
    /* ------------------------------------------------------------- state */

    case 'check':
      return (
        <svg {...common}>
          <path d="m4.5 12.5 5 5L19.5 6.5" />
        </svg>
      );

    case 'cross':
      return (
        <svg {...common}>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      );

    case 'alert':
      return (
        <svg {...common}>
          <path d="M12 3.6 1.9 20.4h20.2L12 3.6Z" />
          <path d="M12 9.6v4.6" />
          <circle cx="12" cy="17.2" r=".9" fill="currentColor" stroke="none" />
        </svg>
      );

    /* --------------------------------------------------- reward + progress */

    /* Two nested tongues rather than one outline, so the flame still reads at
       12px on the streak chip where a single silhouette turns to mush. */
    case 'flame':
      return (
        <svg {...common}>
          <g transform="translate(0 .8)">
            <path d="M12 2.6c.6 3.4-1.4 4.6-3 6.4a6.9 6.9 0 0 0-1.9 4.7 4.9 4.9 0 0 0 9.8 0c0-1.9-.9-3-1.8-4.2-.5 1-1.2 1.6-2 1.9.5-3.2-.3-6-1.1-8.8Z" />
            <path
              d="M12 20.7a2.6 2.6 0 0 1-2.6-2.6c0-1.5 1.3-2.3 2.6-4 1.3 1.7 2.6 2.5 2.6 4a2.6 2.6 0 0 1-2.6 2.6Z"
              fill="currentColor"
              stroke="none"
              opacity=".55"
            />
          </g>
        </svg>
      );

    case 'bolt':
      return (
        <svg {...common}>
          <path d="M13.4 2.4 4.8 13.3h5.6L10.6 21.6 19.2 10.7h-5.6l-.2-8.3Z" />
        </svg>
      );

    case 'trophy':
      return (
        <svg {...common}>
          <path d="M7.4 3.6h9.2v5.2a4.6 4.6 0 0 1-9.2 0V3.6Z" />
          <path d="M7.4 5.2H4.6v1.6a3.2 3.2 0 0 0 3 3.2M16.6 5.2h2.8v1.6a3.2 3.2 0 0 1-3 3.2" />
          <path d="M12 13.4v4M8.6 20.4h6.8l-.7-3H9.3l-.7 3Z" />
        </svg>
      );

    case 'target':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.6" />
          <circle cx="12" cy="12" r="4.7" />
          <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
        </svg>
      );

    /* The four-pointed star already used across the app as a text ✦, drawn so
       it keeps its weight next to the rest of the set. */
    case 'spark':
      return (
        <svg {...common} strokeWidth={1.3}>
          <g transform="translate(0 .9)">
            <path
              d="M12 2.6c.9 5.1 3.4 7.6 8.5 8.5-5.1.9-7.6 3.4-8.5 8.5-.9-5.1-3.4-7.6-8.5-8.5 5.1-.9 7.6-3.4 8.5-8.5Z"
              fill="currentColor"
              stroke="none"
            />
          </g>
        </svg>
      );

    /* ------------------------------------------------------------- tools */

    case 'calculator':
      return (
        <svg {...common}>
          <rect x="4.8" y="2.8" width="14.4" height="18.4" rx="2.2" />
          <rect x="7.6" y="5.8" width="8.8" height="3.4" rx="1" />
          <path
            d="M8.2 13h.01M12 13h.01M15.8 13h.01M8.2 17h.01M12 17h.01M15.8 17h.01"
            strokeWidth="2.4"
          />
        </svg>
      );

    case 'pencil':
      return (
        <svg {...common}>
          <path d="M16.4 3.6 20.4 7.6 8.6 19.4l-5 1 1-5L16.4 3.6Z" />
          <path d="m14.6 5.4 4 4" />
        </svg>
      );

    case 'speaker':
      return (
        <svg {...common}>
          <path d="M4.5 9.5v5h3l4 3.5v-12l-4 3.5h-3Z" />
          <path d="M15 9.4a3.6 3.6 0 0 1 0 5.2M17.6 7a7 7 0 0 1 0 10" />
        </svg>
      );

    case 'stop':
      return (
        <svg {...common}>
          <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />
        </svg>
      );

    case 'bookmark':
      return (
        <svg {...common}>
          <path d="M6.6 3.6h10.8v17l-5.4-4.2-5.4 4.2v-17Z" />
        </svg>
      );

    case 'bookmarkFilled':
      return (
        <svg {...common}>
          <path d="M6.6 3.6h10.8v17l-5.4-4.2-5.4 4.2v-17Z" fill="currentColor" />
        </svg>
      );

    case 'flag':
      return (
        <svg {...common}>
          <g transform="translate(.2 -.4)">
            <path d="M6 21V3.8" />
            <path d="M6 4.6h11.6l-2.2 3.8 2.2 3.8H6" />
          </g>
        </svg>
      );

    case 'copy':
      return (
        <svg {...common}>
          <rect x="8.6" y="8.6" width="11.4" height="11.4" rx="2.2" />
          <path d="M15.4 8.6V6.2A2.2 2.2 0 0 0 13.2 4H6.2A2.2 2.2 0 0 0 4 6.2v7a2.2 2.2 0 0 0 2.2 2.2h2.4" />
        </svg>
      );

    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M10.2 5L10.2 2.8L13.8 2.8L13.8 5A7.2 7.2 0 0 1 15.7 5.8L17.3 4.2L19.8 6.7L18.2 8.3A7.2 7.2 0 0 1 19 10.2L21.2 10.2L21.2 13.8L19 13.8A7.2 7.2 0 0 1 18.2 15.7L19.8 17.3L17.3 19.8L15.7 18.2A7.2 7.2 0 0 1 13.8 19L13.8 21.2L10.2 21.2L10.2 19A7.2 7.2 0 0 1 8.3 18.2L6.7 19.8L4.2 17.3L5.8 15.7A7.2 7.2 0 0 1 5 13.8L2.8 13.8L2.8 10.2L5 10.2A7.2 7.2 0 0 1 5.8 8.3L4.2 6.7L6.7 4.2L8.3 5.8A7.2 7.2 0 0 1 10.2 5Z" />
        </svg>
      );

    case 'compass':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.8" />
          <path d="m15.4 8.6-2 5.4-5.4 2 2-5.4 5.4-2Z" />
        </svg>
      );

    case 'clock':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.8" />
          <path d="M12 6.8V12l3.4 2" />
        </svg>
      );

    /* -------------------------------------------------------- navigation */

    case 'arrowLeft':
      return (
        <svg {...common}>
          <path d="M19 12H5M11 6l-6 6 6 6" />
        </svg>
      );

    /* One arc, four rotations, so the family reads as a single mark.
       `chevronRight` is the workhorse: it closes every control that moves the
       reader onward, where the existing `arrowRight` sits too heavy beside a
       14px label. */
    case 'chevronRight':
      return (
        <svg {...common}>
          <path d="m9.5 6 6 6-6 6" />
        </svg>
      );

    case 'chevronUp':
      return (
        <svg {...common}>
          <path d="m6 14.5 6-6 6 6" />
        </svg>
      );

    case 'chevronDown':
      return (
        <svg {...common}>
          <path d="m6 9.5 6 6 6-6" />
        </svg>
      );

    /* ----------------------------------------------------------- content */

    case 'quill':
      return (
        <svg {...common}>
          <g transform="translate(-1.6 -.3)">
            <path d="M20.4 3.6c-6.4.5-11 3.6-12.8 8.2-.8 2-.9 3.9-.6 5.4 1.5.3 3.4.2 5.4-.6 4.6-1.8 7.7-6.4 8-12.8Z" />
            <path d="m7 21 5.4-8.4" />
          </g>
        </svg>
      );

    case 'scroll':
      return (
        <svg {...common}>
          <g transform="translate(-.4 -.4)">
            <path d="M6.4 4.4h11.2v13.2a2.8 2.8 0 0 0 2.8 2.8H8.4a2 2 0 0 1-2-2V4.4Z" />
            <path d="M6.4 4.4A2 2 0 0 0 4.4 6.4v1.8h2" />
            <path d="M9.6 8.6h5.2M9.6 12h5.2" />
          </g>
        </svg>
      );

    /* A lantern, for loading and empty states — the light source the whole
       colour scheme is named after. */
    case 'lantern':
      return (
        <svg {...common}>
          <g transform="translate(0 .6)">
            <path d="M9 2.8h6M12 2.8v2" />
            <path d="M7.6 4.8h8.8l1.4 3.2H6.2l1.4-3.2Z" />
            <path d="M6.6 8h10.8v9.4a2.6 2.6 0 0 1-2.6 2.6H9.2a2.6 2.6 0 0 1-2.6-2.6V8Z" />
            <path d="M10 11.6c0 2 2 2.4 2 4.4 0-2 2-2.4 2-4.4" />
          </g>
        </svg>
      );

    case 'shield':
      return (
        <svg {...common}>
          <path d="M12 3.2 19.5 6v6.2c0 4-3.1 7-7.5 8.6-4.4-1.6-7.5-4.6-7.5-8.6V6L12 3.2Z" />
        </svg>
      );

    /* ------------------------------------------------------ achievements */

    case 'star':
      return (
        <svg {...common}>
          <path d="M12 3.2l2.6 6.1 6.6.5-5 4.3 1.5 6.5L12 17.2 6.3 20.6l1.5-6.5-5-4.3 6.6-.5L12 3.2Z" />
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

    case 'book':
      return (
        <svg {...common}>
          <path d="M12 6.4C10 4.9 7.4 4.3 4.4 4.6v12.6c3-.3 5.6.3 7.6 1.8" />
          <path d="M12 6.4c2-1.5 4.6-2.1 7.6-1.8v12.6c-3-.3-5.6.3-7.6 1.8" />
          <path d="M12 6.4V19" />
        </svg>
      );

    /* A folded map, which is what the world screen actually is. */
    case 'map':
      return (
        <svg {...common}>
          <path d="M9 3.6 3.4 5.8v14.6L9 18.2l6 2.2 5.6-2.2V3.6L15 5.8 9 3.6Z" />
          <path d="M9 3.6v14.6M15 5.8v14.6" />
        </svg>
      );

    case 'calendar':
      return (
        <svg {...common}>
          <rect x="3.4" y="5.4" width="17.2" height="15.2" rx="2.4" />
          <path d="M3.4 10.2h17.2M8.2 3.4v4M15.8 3.4v4" />
        </svg>
      );

    /* ------------------------------------------------------ destinations */

    case 'tent':
      return (
        <svg {...common}>
          <path d="M12 4.5 3.5 19.5h17L12 4.5Z" />
          <path d="M12 4.5v15" />
          <path d="m12 12.5 4 7M12 12.5l-4 7" />
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

    /* The guardians: the plain shield is the streak freeze, so the duels get
       the thing standing between you and the region's end, cracked. */
    case 'shieldCracked':
      return (
        <svg {...common}>
          <path d="M12 3.2 19.5 6v6.2c0 4-3.1 7-7.5 8.6-4.4-1.6-7.5-4.6-7.5-8.6V6L12 3.2Z" />
          <path d="m12.4 7-1.4 3.2 2.2 2-1.6 3.2.6 2.4" />
        </svg>
      );

    case 'starFilled':
      return (
        <svg {...common} strokeWidth={minStroke(1.4, size)}>
          <path
            d="M12 3.2l2.6 6.1 6.6.5-5 4.3 1.5 6.5L12 17.2 6.3 20.6l1.5-6.5-5-4.3 6.6-.5L12 3.2Z"
            fill="currentColor"
          />
        </svg>
      );

    default:
      return null;
  }
}
