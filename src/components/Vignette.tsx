/* Small drawn scenes, for the moments the app has nothing to show.
 *
 * Findings 20 and 46: *"no empty-state art anywhere — `EmptyState` is a dashed
 * rectangle with text"* and *"no loading art; a themed loading state costs
 * almost nothing and appears on every cold start."*
 *
 * These are the two moments a product is most likely to feel unfinished, and
 * they are also the two moments a player has nothing else to look at. A dashed
 * grey box says "there is meant to be something here and there isn't"; a
 * drawn one says "there is nothing here *yet*", which is a different sentence.
 *
 * Same construction as the bosses and the sigils — ink at #241a10, light from
 * the upper left, flat fills lifted by one gradient — so an empty screen still
 * looks like it belongs to this world.
 */

import { useId } from 'react';
import { cx } from '@/lib/utils';

const INK = '#241a10';

export type VignetteName = 'lantern' | 'chest' | 'scroll' | 'compass' | 'campfire';

/**
 * A drawn scene for an empty state.
 *
 * `muted` renders it at low contrast for backgrounds that are already dark;
 * the default is the parchment-lit version used inside panels.
 */
export function Vignette({
  name,
  size = 132,
  className,
}: {
  name: VignetteName;
  size?: number;
  className?: string;
}) {
  const uid = useId().replace(/:/g, '');
  const url = (k: string) => `url(#${uid}-${k})`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={cx('flex-none', className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${uid}-warm`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#d9a441" />
          <stop offset="1" stopColor="#96661c" />
        </linearGradient>
        <linearGradient id={`${uid}-paper`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#f3e7cb" />
          <stop offset="1" stopColor="#cdb98d" />
        </linearGradient>
        <linearGradient id={`${uid}-wood`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#7a5a34" />
          <stop offset="1" stopColor="#4a361d" />
        </linearGradient>
        {/* The light each of these throws. Every scene here has a source in
            it, which is why they all work on a dark panel. */}
        <radialGradient id={`${uid}-halo`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffd98a" stopOpacity="0.5" />
          <stop offset="0.55" stopColor="#ffb347" stopOpacity="0.14" />
          <stop offset="1" stopColor="#ffb347" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g stroke={INK} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
        {name === 'lantern' && <Lantern url={url} />}
        {name === 'chest' && <Chest url={url} />}
        {name === 'scroll' && <Scroll url={url} />}
        {name === 'compass' && <Compass url={url} />}
        {name === 'campfire' && <Campfire url={url} />}
      </g>
    </svg>
  );
}

type U = (k: string) => string;

/** Nothing found yet — a lantern held up to an empty room. */
function Lantern({ url }: { url: U }) {
  return (
    <>
      <circle cx="60" cy="62" r="46" fill={url('halo')} stroke="none" />
      <path d="M60 14v10" strokeWidth="3" />
      <path d="M48 26h24l4 8H44Z" fill={url('wood')} />
      <path d="M46 34h28l4 46H42Z" fill={url('warm')} />
      {/* the glass, with the flame inside it */}
      <path d="M52 42h16v30H52Z" fill="#fff3d0" opacity=".9" strokeWidth="2.4" />
      <path d="M60 50c4 4 5 8 3 12-1 3-5 3-6 0-1-4 0-8 3-12Z" fill="#ff9d3c" strokeWidth="2" />
      <path d="M42 80h36l4 8H38Z" fill={url('wood')} />
      {/* the pool of light it puts on the floor */}
      <ellipse cx="60" cy="94" rx="30" ry="6" fill="#ffb347" opacity=".16" stroke="none" />
    </>
  );
}

/** Nothing earned yet — a closed chest, waiting. */
function Chest({ url }: { url: U }) {
  return (
    <>
      <path d="M24 56a36 20 0 0 1 72 0Z" fill={url('wood')} />
      <rect x="24" y="56" width="72" height="34" rx="4" fill={url('wood')} />
      <path d="M24 62h72" strokeWidth="2.4" opacity=".5" />
      {/* bands and the lock */}
      <g fill={url('warm')} strokeWidth="2.4">
        <rect x="52" y="42" width="16" height="26" rx="2" />
        <circle cx="60" cy="64" r="6" />
      </g>
      <circle cx="60" cy="64" r="2" fill={INK} stroke="none" />
      <ellipse cx="60" cy="96" rx="40" ry="6" fill={INK} opacity=".22" stroke="none" />
    </>
  );
}

/** Nothing written yet — a blank scroll and a quill. */
function Scroll({ url }: { url: U }) {
  return (
    <>
      <path d="M32 30h50a6 6 0 0 1 0 12H36Z" fill={url('paper')} />
      <path d="M32 30a6 6 0 0 0 0 12h4a6 6 0 0 1 0-12Z" fill="#c2ab7d" />
      <path d="M36 42h46v40a6 6 0 0 1-6 6H30a6 6 0 0 0 6-6Z" fill={url('paper')} />
      <g stroke="#a4926a" strokeWidth="2.2" opacity=".65">
        <path d="M46 56h26M46 66h26M46 76h16" />
      </g>
      {/* the quill, resting across it */}
      <path d="M86 34 L64 74" strokeWidth="3.4" stroke={INK} />
      <path d="M86 34c-6 2-10 7-11 13 5-1 9-5 11-13Z" fill="#efe4c8" strokeWidth="2.4" />
    </>
  );
}

/** Loading — a compass needle, which is the one thing that should be moving. */
function Compass({ url }: { url: U }) {
  return (
    <>
      <circle cx="60" cy="60" r="42" fill={url('paper')} />
      <circle cx="60" cy="60" r="34" fill="none" stroke={INK} strokeWidth="2" opacity=".35" />
      {/* the cardinal marks */}
      <g strokeWidth="3">
        <path d="M60 20v8M60 92v8M20 60h8M92 60h8" />
      </g>
      {/* the needle: red half north, pale half south, spinning via CSS */}
      <g
        className="origin-center animate-[spin_2.6s_linear_infinite]"
        style={{ transformOrigin: '60px 60px' }}
      >
        <path d="M60 28 L68 60 L60 92 L52 60 Z" fill="#f3e7cb" strokeWidth="2.6" />
        <path d="M60 28 L68 60 L52 60 Z" fill="#b5432f" strokeWidth="2.6" />
      </g>
      <circle cx="60" cy="60" r="5" fill={url('warm')} strokeWidth="2.6" />
    </>
  );
}

/** Come back tomorrow — a banked fire. */
function Campfire({ url }: { url: U }) {
  return (
    <>
      <circle cx="60" cy="66" r="42" fill={url('halo')} stroke="none" />
      <path d="M34 86 L86 70" strokeWidth="8" stroke={url('wood')} strokeLinecap="round" />
      <path d="M34 70 L86 86" strokeWidth="8" stroke={url('wood')} strokeLinecap="round" />
      <path
        d="M60 26c10 12 14 22 12 30-2 7-8 11-12 11s-10-4-12-11c-2-8 2-18 12-30Z"
        fill={url('warm')}
      />
      <path d="M60 42c5 7 6 13 4 17-1 3-6 3-8 0-2-4-1-10 4-17Z" fill="#ffd98a" strokeWidth="2" />
      <ellipse cx="60" cy="94" rx="34" ry="6" fill="#ffb347" opacity=".18" stroke="none" />
    </>
  );
}
