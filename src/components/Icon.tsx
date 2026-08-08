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
  | 'check' | 'cross' | 'alert' | 'info' | 'lock' | 'unlock'
  // reward and progress
  | 'flame' | 'bolt' | 'trophy' | 'medal' | 'target' | 'spark'
  // tools
  | 'calculator' | 'pencil' | 'speaker' | 'stop' | 'bookmark' | 'bookmarkFilled'
  | 'flag' | 'copy' | 'settings' | 'compass' | 'clock' | 'refresh'
  // navigation
  | 'arrowLeft' | 'arrowRight' | 'chevronDown' | 'plus' | 'minus'
  // content
  | 'quill' | 'scroll' | 'lantern' | 'shield' | 'eye' | 'question';

interface Props {
  name: IconName;
  size?: number;
  className?: string;
  /** Supply only when the icon is the sole carrier of meaning. */
  title?: string;
  strokeWidth?: number;
}

export function Glyph({ name, size = 18, className, title, strokeWidth = 1.7 }: Props) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    focusable: 'false' as const,
    ...(title
      ? { role: 'img' as const, 'aria-label': title }
      : { 'aria-hidden': true as const }),
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

    case 'info':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.8" />
          <path d="M12 11v5.4" />
          <circle cx="12" cy="7.9" r=".95" fill="currentColor" stroke="none" />
        </svg>
      );

    /* A padlock rather than 🔒 — a locked landmark is the most common state
       on the map, so it is the icon a first-time player sees most. */
    case 'lock':
      return (
        <svg {...common}>
          <rect x="4.6" y="10.4" width="14.8" height="10" rx="2.2" />
          <path d="M8.2 10.4V7.6a3.8 3.8 0 0 1 7.6 0v2.8" />
          <circle cx="12" cy="15.1" r="1.4" />
        </svg>
      );

    case 'unlock':
      return (
        <svg {...common}>
          <rect x="4.6" y="10.4" width="14.8" height="10" rx="2.2" />
          <path d="M8.2 10.4V7.6a3.8 3.8 0 0 1 7.2-1.6" />
          <circle cx="12" cy="15.1" r="1.4" />
        </svg>
      );

    /* --------------------------------------------------- reward + progress */

    /* Two nested tongues rather than one outline, so the flame still reads at
       12px on the streak chip where a single silhouette turns to mush. */
    case 'flame':
      return (
        <svg {...common}>
          <path d="M12 2.6c.6 3.4-1.4 4.6-3 6.4a6.9 6.9 0 0 0-1.9 4.7 4.9 4.9 0 0 0 9.8 0c0-1.9-.9-3-1.8-4.2-.5 1-1.2 1.6-2 1.9.5-3.2-.3-6-1.1-8.8Z" />
          <path d="M12 20.7a2.6 2.6 0 0 1-2.6-2.6c0-1.5 1.3-2.3 2.6-4 1.3 1.7 2.6 2.5 2.6 4a2.6 2.6 0 0 1-2.6 2.6Z" fill="currentColor" stroke="none" opacity=".55" />
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

    case 'medal':
      return (
        <svg {...common}>
          <path d="m8.4 3 2.2 5.6M15.6 3l-2.2 5.6" />
          <circle cx="12" cy="15" r="6" />
          <path d="m12 11.9 1.1 2.3 2.5.2-1.9 1.6.6 2.4-2.3-1.3-2.3 1.3.6-2.4-1.9-1.6 2.5-.2L12 11.9Z" fill="currentColor" stroke="none" />
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
          <path d="M12 2.6c.9 5.1 3.4 7.6 8.5 8.5-5.1.9-7.6 3.4-8.5 8.5-.9-5.1-3.4-7.6-8.5-8.5 5.1-.9 7.6-3.4 8.5-8.5Z" fill="currentColor" stroke="none" />
        </svg>
      );

    /* ------------------------------------------------------------- tools */

    case 'calculator':
      return (
        <svg {...common}>
          <rect x="4.8" y="2.8" width="14.4" height="18.4" rx="2.2" />
          <rect x="7.6" y="5.8" width="8.8" height="3.4" rx="1" />
          <path d="M8.2 13h.01M12 13h.01M15.8 13h.01M8.2 17h.01M12 17h.01M15.8 17h.01" strokeWidth="2.4" />
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
          <path d="M6 21V3.8" />
          <path d="M6 4.6h11.6l-2.2 3.8 2.2 3.8H6" />
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
          <circle cx="12" cy="12" r="3.1" />
          <path d="M19.5 14.2a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7h-.3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1v-.3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.8 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4.9Z" />
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

    case 'refresh':
      return (
        <svg {...common}>
          <path d="M20 11.4a8 8 0 1 0-.6 4.4" />
          <path d="M20.4 4.6v5.2h-5.2" />
        </svg>
      );

    /* -------------------------------------------------------- navigation */

    case 'arrowLeft':
      return (
        <svg {...common}>
          <path d="M19 12H5M11 6l-6 6 6 6" />
        </svg>
      );

    case 'arrowRight':
      return (
        <svg {...common}>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      );

    case 'chevronDown':
      return (
        <svg {...common}>
          <path d="m6 9.5 6 6 6-6" />
        </svg>
      );

    case 'plus':
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );

    case 'minus':
      return (
        <svg {...common}>
          <path d="M5 12h14" />
        </svg>
      );

    /* ----------------------------------------------------------- content */

    case 'quill':
      return (
        <svg {...common}>
          <path d="M20.4 3.6c-6.4.5-11 3.6-12.8 8.2-.8 2-.9 3.9-.6 5.4 1.5.3 3.4.2 5.4-.6 4.6-1.8 7.7-6.4 8-12.8Z" />
          <path d="m7 21 5.4-8.4" />
        </svg>
      );

    case 'scroll':
      return (
        <svg {...common}>
          <path d="M6.4 4.4h11.2v13.2a2.8 2.8 0 0 0 2.8 2.8H8.4a2 2 0 0 1-2-2V4.4Z" />
          <path d="M6.4 4.4A2 2 0 0 0 4.4 6.4v1.8h2" />
          <path d="M9.6 8.6h5.2M9.6 12h5.2" />
        </svg>
      );

    /* A lantern, for loading and empty states — the light source the whole
       colour scheme is named after. */
    case 'lantern':
      return (
        <svg {...common}>
          <path d="M9 2.8h6M12 2.8v2" />
          <path d="M7.6 4.8h8.8l1.4 3.2H6.2l1.4-3.2Z" />
          <path d="M6.6 8h10.8v9.4a2.6 2.6 0 0 1-2.6 2.6H9.2a2.6 2.6 0 0 1-2.6-2.6V8Z" />
          <path d="M10 11.6c0 2 2 2.4 2 4.4 0-2 2-2.4 2-4.4" />
        </svg>
      );

    case 'shield':
      return (
        <svg {...common}>
          <path d="M12 2.8 20 6v6.2c0 4.6-3.6 8-8 9.4-4.4-1.4-8-4.8-8-9.4V6l8-3.2Z" />
        </svg>
      );

    case 'eye':
      return (
        <svg {...common}>
          <path d="M2.4 12S5.8 5.6 12 5.6 21.6 12 21.6 12 18.2 18.4 12 18.4 2.4 12 2.4 12Z" />
          <circle cx="12" cy="12" r="3.1" />
        </svg>
      );

    case 'question':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.8" />
          <path d="M9.5 9.4a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.2-2.5 3.9" />
          <circle cx="12" cy="17.2" r=".9" fill="currentColor" stroke="none" />
        </svg>
      );

    default:
      return null;
  }
}
