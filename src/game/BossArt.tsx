/* The four guardians, repainted.
 *
 * The art director's finding was blunt and correct: *"the boss they fight at
 * the end of the region is a flat vector shape with three dots for eyes… the
 * emotional peak of the game is its weakest art."* The silhouettes were never
 * the problem — a hooded scribe of tablets, a canopy of pages, a rune-carved
 * colossus, a bottled leviathan all read at a glance. What was missing was
 * *rendering*: every shape was one flat fill, so nothing had volume, nothing
 * caught light, and the whole figure sat in front of a painted world looking
 * like a diagram of itself.
 *
 * What changed, and why each thing is here rather than just "more detail":
 *
 *   **Light from the upper left.** Finding 6 was that the camp, the map and
 *   the hero cutout all disagreed about where the sun was. Every gradient in
 *   this file runs from upper-left to lower-right, and every rim light is on
 *   the upper-left edge, so these agree with the map they stand on and with
 *   `HeroAvatar.tsx`, which was drawn to the same rule.
 *
 *   **Ink bleed.** Finding 7 asked for one outline treatment. A single uniform
 *   3px stroke is what makes vector art look like vector art: real ink soaks
 *   into paper and darkens slightly around every edge. A zero-offset
 *   `drop-shadow` in ink colour does exactly that, on the silhouette *and* on
 *   every internal edge, for one filter — and it is most of the difference
 *   between "SVG" and "drawn".
 *
 *   **Occlusion, not just shadow.** The darker passes under a hood, beneath a
 *   canopy, inside a sleeve. Cheap to draw, and the single thing that makes a
 *   flat shape read as a form with an underside.
 *
 *   **Grain.** One shared `feTurbulence` at very low opacity, multiplied over
 *   the whole figure. It is the same trick `index.css` uses on the parchment
 *   and the leather, which is precisely the point: the boss now shares a
 *   surface treatment with everything else on screen.
 *
 * The viewBox stays 200×220 and the four exported names stay the same, so
 * `Boss.tsx` and the map plaque need no changes.
 */

import { useId } from 'react';
import { cx } from '@/lib/utils';
import type { SectionId } from '@/types';

export type BossState = 'idle' | 'hurt' | 'attacking' | 'defeated';

interface Props {
  section: SectionId;
  state: BossState;
  className?: string;
}

/** The one ink colour in the product. Also used by `HeroAvatar` and `Sigils`. */
const INK = '#241a10';

/* Rim light. Warm rather than white, because the world is lit by lanterns and
   low sun, and a cold highlight on a warm painting reads as a mistake. */
const RIM = '#ffe6b0';

interface Palette {
  /** Body, lit face and shadow face. */
  base: [string, string];
  /** A second material — cloth over stone, pages over root. */
  alt: [string, string];
  /** What the eyes give off. */
  glow: string;
}

/**
 * Everything shared: the gradients, the grain, the soft ground shadow and the
 * two-pass ink.
 *
 * Ids are generated per instance. Two bosses on screen at once — the map
 * plaque behind the duel, say — would otherwise both reference the first
 * one's gradients, and the second would silently render in the first one's
 * colours.
 */
function Frame({
  state,
  palette,
  children,
  className,
}: {
  state: BossState;
  palette: Palette;
  children: (ids: Record<string, string>) => React.ReactNode;
  className?: string;
}) {
  const uid = useId().replace(/:/g, '');
  const id = (k: string) => `${uid}-${k}`;
  const url = (k: string) => `url(#${id(k)})`;

  const ids = {
    base: url('base'),
    alt: url('alt'),
    glow: url('glow'),
    grain: url('grain'),
    soft: url('soft'),
  };

  return (
    <svg
      viewBox="0 0 200 220"
      className={cx(
        'w-full',
        state === 'idle' && 'animate-bossIdle',
        state === 'hurt' && 'animate-bossHurt',
        state === 'attacking' && 'animate-bossLunge',
        state === 'defeated' && 'animate-bossDown',
        className,
      )}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id('base')} x1="0.12" y1="0" x2="0.88" y2="1">
          <stop offset="0" stopColor={palette.base[0]} />
          <stop offset="1" stopColor={palette.base[1]} />
        </linearGradient>
        <linearGradient id={id('alt')} x1="0.12" y1="0" x2="0.88" y2="1">
          <stop offset="0" stopColor={palette.alt[0]} />
          <stop offset="1" stopColor={palette.alt[1]} />
        </linearGradient>
        {/* Eyes read as emitting rather than painted: bright at the centre,
            falling off to the iris colour at the rim. */}
        <radialGradient id={id('glow')} cx="0.4" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#fffdf4" />
          <stop offset="0.45" stopColor={palette.glow} />
          <stop offset="1" stopColor={palette.glow} stopOpacity="0.55" />
        </radialGradient>

        {/* Fractal noise, multiplied over the figure at 7% — the same paper
            grain the parchment surfaces carry, so the boss looks painted on
            the same stock as everything around it. */}
        <filter id={id('grain')} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="7" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.07" />
          </feComponentTransfer>
        </filter>

        {/* The ground shadow. A hard ellipse was the single most diagrammatic
            thing on screen; a blurred one puts the figure on the floor. */}
        <filter id={id('soft')} x="-30%" y="-60%" width="160%" height="220%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      <ellipse cx="100" cy="207" rx="58" ry="10" fill="rgba(20,12,4,.42)" filter={ids.soft} />

      {/* Ink bleed, then the cast shadow. Two drop-shadows on one group: the
          first has no offset and a small radius, so it darkens every edge the
          way ink soaks into paper; the second is the figure's shadow in the
          scene, offset down and to the right to agree with the key light. */}
      <g
        style={{
          filter:
            'drop-shadow(0 0 2px rgba(36,26,16,.9)) drop-shadow(3px 9px 11px rgba(0,0,0,.45))',
        }}
      >
        {children(ids)}
      </g>

      {/* Grain last, over everything, clipped to the figure's own box. */}
      <rect
        x="10"
        y="10"
        width="180"
        height="196"
        filter={ids.grain}
        style={{ mixBlendMode: 'multiply' }}
        pointerEvents="none"
      />
    </svg>
  );
}

/* A pair of eyes, drawn the same way for every boss so they read as one
   species of thing. Whites are a gradient, the pupil sits slightly high and
   inboard — where a pupil actually sits when something is looking at you —
   and a single specular dot is what turns a circle into a wet eye. */
function Eye({
  cx: x,
  cy: y,
  r,
  glow,
  pupil = 0.42,
}: {
  cx: number;
  cy: number;
  r: number;
  glow: string;
  pupil?: number;
}) {
  return (
    <g>
      <ellipse cx={x} cy={y} rx={r} ry={r * 1.12} fill={glow} stroke={INK} strokeWidth="2.6" />
      <circle cx={x + r * 0.12} cy={y + r * 0.14} r={r * pupil} fill={INK} />
      <circle cx={x - r * 0.3} cy={y - r * 0.34} r={r * 0.2} fill="#fffdf4" opacity=".9" />
    </g>
  );
}

/** English — a towering scribe of stone tablets and quills. */
function GrammarGauntlet({ state }: { state: BossState }) {
  return (
    <Frame
      state={state}
      palette={{ base: ['#9c7a44', '#6b5028'], alt: ['#d8c69c', '#a8926a'], glow: '#f4e8cf' }}
    >
      {(ids) => (
        <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
          {/* robe */}
          <path d="M62 200 Q60 130 78 96 L122 96 Q140 130 138 200 Z" fill={ids.base} />
          {/* Folds. Three strokes at 30% is the whole difference between a
              robe and a brown triangle. */}
          <path
            d="M84 106 Q80 154 78 198M100 112 Q100 156 100 200M116 106 Q120 154 122 198"
            fill="none"
            stroke={INK}
            strokeWidth="2"
            opacity=".28"
          />
          {/* the chest opening, lit */}
          <path d="M78 96 L100 118 L122 96 Z" fill={ids.alt} />
          {/* arms */}
          <path d="M66 118 L36 140 L44 152 L74 134 Z" fill={ids.base} />
          <path d="M134 118 L164 140 L156 152 L126 134 Z" fill={ids.base} />
          {/* the underside of each sleeve, in shade */}
          <path d="M66 118 L36 140 L44 152 Z" fill={INK} opacity=".2" stroke="none" />
          <path d="M134 118 L164 140 L156 152 Z" fill={INK} opacity=".2" stroke="none" />

          {/* stone tablets, with carved text catching the light */}
          <rect x="20" y="132" width="34" height="44" rx="4" fill={ids.alt} />
          <rect x="146" y="132" width="34" height="44" rx="4" fill={ids.alt} />
          <g stroke="#6b5a3c" strokeWidth="2.4" opacity=".85">
            <path d="M27 144h20M27 152h20M27 160h13" />
            <path d="M153 144h20M153 152h20M153 160h13" />
          </g>
          <g stroke={RIM} strokeWidth="1" opacity=".5">
            <path d="M27 142.5h20M153 142.5h20" />
          </g>

          {/* head */}
          <path
            d="M76 66 Q76 40 100 40 Q124 40 124 66 Q124 90 100 92 Q76 90 76 66 Z"
            fill="#d9c39a"
          />
          {/* The hood casts onto the face. Without this the head is a pale
              oval floating inside a brown horseshoe. */}
          <path
            d="M76 62 Q76 40 100 40 Q124 40 124 62 Q100 56 76 62 Z"
            fill={INK}
            opacity=".3"
            stroke="none"
          />
          {/* hood */}
          <path
            d="M70 68 Q68 30 100 26 Q132 30 130 68 L118 60 Q116 44 100 42 Q84 44 82 60 Z"
            fill={ids.base}
          />
          <path d="M72 60 Q72 32 100 28" fill="none" stroke={RIM} strokeWidth="2" opacity=".45" />

          <Eye cx={88} cy={66} r={5.4} glow={ids.glow} />
          <Eye cx={112} cy={66} r={5.4} glow={ids.glow} />
          {/* a mouth, finally — it was three dots and a hood before */}
          <path d="M91 80 Q100 85 109 80" fill="none" strokeWidth="2.4" opacity=".7" />

          {/* quill crown */}
          <path d="M100 26 L94 6 L106 12 Z" fill="#efe4c8" />
          <path d="M99 24 L96 10" fill="none" strokeWidth="1.6" opacity=".5" />
        </g>
      )}
    </Frame>
  );
}

/** Reading — a many-eyed thing woven out of pages and roots. */
function PassageTitan({ state }: { state: BossState }) {
  return (
    <Frame
      state={state}
      palette={{ base: ['#4f7d43', '#2c4f2b'], alt: ['#f4ecd6', '#cbbf9c'], glow: '#c7f0a8' }}
    >
      {(ids) => (
        <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
          {/* root body */}
          <path d="M56 200 Q52 140 72 104 Q100 84 128 104 Q148 140 144 200 Z" fill={ids.base} />
          {/* the roots themselves, rather than one smooth trunk */}
          <path
            d="M74 118 Q70 158 66 198M88 126 Q86 162 84 200M112 126 Q114 162 116 200M126 118 Q130 158 134 198"
            fill="none"
            stroke={INK}
            strokeWidth="2.2"
            opacity=".32"
          />
          <path d="M72 104 Q100 128 128 104" fill="none" strokeWidth="2.4" opacity=".5" />

          {/* pages fanning — each leaf offset so it reads as a sheaf */}
          <g fill={ids.alt}>
            <path d="M70 118 L34 100 L38 124 L72 132 Z" />
            <path d="M70 124 L36 116 L40 134 L72 138 Z" />
            <path d="M130 118 L166 100 L162 124 L128 132 Z" />
            <path d="M130 124 L164 116 L160 134 L128 138 Z" />
          </g>
          <g stroke="#8d7f5e" strokeWidth="1.8" opacity=".8">
            <path d="M42 108h20M46 118h18M138 108h20M136 118h18" />
          </g>

          {/* canopy head */}
          <path d="M60 76 Q58 34 100 30 Q142 34 140 76 Q100 96 60 76 Z" fill={ids.base} />
          {/* the underside of the canopy is in its own shade */}
          <path d="M60 76 Q100 96 140 76 Q100 88 60 76 Z" fill={INK} opacity=".34" stroke="none" />
          <path d="M64 64 Q64 38 100 34" fill="none" stroke={RIM} strokeWidth="2.2" opacity=".4" />

          <Eye cx={80} cy={62} r={7} glow={ids.glow} />
          <Eye cx={100} cy={54} r={6} glow={ids.glow} />
          <Eye cx={120} cy={62} r={7} glow={ids.glow} />

          <path d="M84 84 Q100 94 116 84" fill="none" strokeWidth="3" />
        </g>
      )}
    </Frame>
  );
}

/** Math — a rune-carved colossus of desert stone. */
function NumberCrusher({ state }: { state: BossState }) {
  return (
    <Frame
      state={state}
      palette={{ base: ['#c8783c', '#8f4f24'], alt: ['#e0955c', '#a85f2c'], glow: '#ffb347' }}
    >
      {(ids) => (
        <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
          {/* legs */}
          <path d="M64 200 L68 140 L132 140 L136 200 Z" fill={ids.base} />
          <path d="M100 142 L100 200" fill="none" strokeWidth="2.4" opacity=".35" />
          {/* torso */}
          <rect x="60" y="86" width="80" height="60" rx="8" fill={ids.alt} />
          {/* the block's own shading: a lit top-left bevel and a dark base */}
          <path d="M64 90 L136 90" fill="none" stroke={RIM} strokeWidth="2.4" opacity=".38" />
          <path
            d="M60 130 h80 v8 a8 8 0 0 1 -8 8 h-64 a8 8 0 0 1 -8 -8 Z"
            fill={INK}
            opacity=".22"
            stroke="none"
          />

          {/* arms */}
          <path d="M60 96 L26 116 L26 152 L48 152 L52 124 Z" fill={ids.base} />
          <path d="M140 96 L174 116 L174 152 L152 152 L148 124 Z" fill={ids.base} />
          {/* fists */}
          <rect x="18" y="146" width="34" height="30" rx="7" fill={ids.base} />
          <rect x="148" y="146" width="34" height="30" rx="7" fill={ids.base} />
          <g fill={INK} opacity=".2" stroke="none">
            <rect x="18" y="164" width="34" height="12" rx="6" />
            <rect x="148" y="164" width="34" height="12" rx="6" />
          </g>

          {/* head */}
          <rect x="74" y="38" width="52" height="46" rx="8" fill={ids.alt} />
          <path d="M78 42 L122 42" fill="none" stroke={RIM} strokeWidth="2.2" opacity=".42" />
          {/* eye slit, recessed */}
          <rect x="82" y="54" width="36" height="10" rx="5" fill="#231007" />
          <circle cx="92" cy="59" r="3.4" fill={ids.glow} />
          <circle cx="110" cy="59" r="3.4" fill={ids.glow} />
          {/* the light the eyes throw onto the slit's lower lip */}
          <path d="M84 64.5 h32" fill="none" stroke="#ffb347" strokeWidth="1.6" opacity=".45" />

          {/* runes, carved: a dark groove with a lit upper edge */}
          <g strokeWidth="3.2" opacity=".9">
            <path d="M76 100h16M76 112h24M76 124h12" stroke="#7a3f12" />
            <path d="M112 100h12M108 112h24M116 124h12" stroke="#7a3f12" />
          </g>
          <g strokeWidth="1.4" opacity=".75">
            <path d="M76 98.4h16M76 110.4h24M76 122.4h12" stroke="#f7d979" />
            <path d="M112 98.4h12M108 110.4h24M116 122.4h12" stroke="#f7d979" />
          </g>
        </g>
      )}
    </Frame>
  );
}

/** Science — a deep-sea horror of glass vessels and coiling arms. */
function LabLeviathan({ state }: { state: BossState }) {
  return (
    <Frame
      state={state}
      palette={{ base: ['#54a3c0', '#256a88'], alt: ['#bfe6f2', '#7fbdd4'], glow: '#eaf7fb' }}
    >
      {(ids) => (
        <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
          {/* tentacles, tapering — a constant-width stroke reads as pipe */}
          <g fill={ids.base}>
            <path d="M64 164 Q34 180 24 206 Q34 208 40 200 Q52 180 70 172 Z" />
            <path d="M82 172 Q66 196 52 210 Q62 212 68 204 Q80 188 88 180 Z" />
            <path d="M118 172 Q134 196 148 210 Q138 212 132 204 Q120 188 112 180 Z" />
            <path d="M136 164 Q166 180 176 206 Q166 208 160 200 Q148 180 130 172 Z" />
          </g>
          {/* suckers */}
          <g fill={INK} opacity=".26" stroke="none">
            <circle cx="46" cy="184" r="2.6" />
            <circle cx="36" cy="194" r="2.2" />
            <circle cx="70" cy="192" r="2.6" />
            <circle cx="62" cy="202" r="2.2" />
            <circle cx="130" cy="192" r="2.6" />
            <circle cx="138" cy="202" r="2.2" />
            <circle cx="154" cy="184" r="2.6" />
            <circle cx="164" cy="194" r="2.2" />
          </g>

          {/* mantle */}
          <path d="M56 150 Q48 74 100 56 Q152 74 144 150 Q100 176 56 150 Z" fill={ids.base} />
          <path d="M62 130 Q56 82 96 62" fill="none" stroke={RIM} strokeWidth="2.6" opacity=".38" />
          <path
            d="M56 150 Q100 176 144 150 Q100 164 56 150 Z"
            fill={INK}
            opacity=".3"
            stroke="none"
          />

          {/* the vessel: glass over a lit fluid, with a highlight down one side */}
          <path
            d="M84 52 L84 30 L116 30 L116 52 Q126 62 100 68 Q74 62 84 52 Z"
            fill={ids.alt}
            opacity=".9"
          />
          <path d="M88 50 L88 32" fill="none" stroke="#ffffff" strokeWidth="2.4" opacity=".7" />
          <rect x="80" y="24" width="40" height="8" rx="3" fill="#cbb68f" />
          <circle cx="96" cy="52" r="4" fill="#7de0c0" />
          <circle cx="108" cy="58" r="3" fill="#7de0c0" />
          <circle cx="103" cy="45" r="2" fill="#7de0c0" opacity=".8" />

          <Eye cx={82} cy={108} r={12} glow={ids.glow} pupil={0.46} />
          <Eye cx={118} cy={108} r={12} glow={ids.glow} pupil={0.46} />

          {/* beak */}
          <path d="M92 138 L100 152 L108 138 Z" fill="#1c4356" />
        </g>
      )}
    </Frame>
  );
}

export function BossArt({ section, state, className }: Props) {
  const inner = {
    english: GrammarGauntlet,
    reading: PassageTitan,
    math: NumberCrusher,
    science: LabLeviathan,
  }[section];
  const Component = inner ?? GrammarGauntlet;
  return (
    <div className={className}>
      <Component state={state} />
    </div>
  );
}
