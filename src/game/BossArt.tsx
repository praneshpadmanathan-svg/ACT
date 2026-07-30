/* Drawn bosses.

   No art existed for these, and a generated image would not have matched the
   ink-and-wash style of the map. They are built as SVG in the same register:
   heavy outlines, flat fills, a limited palette taken from each region.

   Each one animates on its own — a breathing idle, a lurch when it takes a
   hit, and a slump when it goes down — so the fight has something to watch. */

import { cx } from '@/lib/utils';
import type { SectionId } from '@/types';

export type BossState = 'idle' | 'hurt' | 'attacking' | 'defeated';

interface Props {
  section: SectionId;
  state: BossState;
  className?: string;
}

const OUTLINE = '#241a10';

function Frame({
  state,
  children,
  className,
}: {
  state: BossState;
  children: React.ReactNode;
  className?: string;
}) {
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
      style={{ filter: 'drop-shadow(0 10px 14px rgba(0,0,0,.5))' }}
      aria-hidden="true"
    >
      <ellipse cx="100" cy="208" rx="62" ry="9" fill="rgba(0,0,0,.32)" />
      {children}
    </svg>
  );
}

/** English — a towering scribe of stone tablets and quills. */
function GrammarGauntlet({ state }: { state: BossState }) {
  return (
    <Frame state={state}>
      <g stroke={OUTLINE} strokeWidth="3" strokeLinejoin="round">
        {/* robe */}
        <path d="M62 200 Q60 130 78 96 L122 96 Q140 130 138 200 Z" fill="#8a6a3a" />
        <path d="M78 96 L100 118 L122 96" fill="#a8834a" />
        {/* arms holding tablets */}
        <path d="M66 118 L36 140 L44 152 L74 134 Z" fill="#8a6a3a" />
        <path d="M134 118 L164 140 L156 152 L126 134 Z" fill="#8a6a3a" />
        {/* stone tablets */}
        <rect x="20" y="132" width="34" height="44" rx="4" fill="#cbb68f" />
        <rect x="146" y="132" width="34" height="44" rx="4" fill="#cbb68f" />
        <path d="M27 144h20M27 152h20M27 160h13" stroke="#6b5a3c" strokeWidth="2.4" />
        <path d="M153 144h20M153 152h20M153 160h13" stroke="#6b5a3c" strokeWidth="2.4" />
        {/* head */}
        <path d="M76 66 Q76 40 100 40 Q124 40 124 66 Q124 90 100 92 Q76 90 76 66 Z" fill="#d9c39a" />
        {/* hood */}
        <path d="M70 68 Q68 30 100 26 Q132 30 130 68 L118 60 Q116 44 100 42 Q84 44 82 60 Z" fill="#6d5228" />
        {/* eyes */}
        <ellipse cx="88" cy="66" rx="5" ry="6" fill="#f4e8cf" />
        <ellipse cx="112" cy="66" rx="5" ry="6" fill="#f4e8cf" />
        <circle cx="88" cy="67" r="2.4" fill={OUTLINE} />
        <circle cx="112" cy="67" r="2.4" fill={OUTLINE} />
        {/* quill crown */}
        <path d="M100 26 L94 6 L106 12 Z" fill="#e8dcc0" />
      </g>
    </Frame>
  );
}

/** Reading — a many-eyed thing woven out of pages and roots. */
function PassageTitan({ state }: { state: BossState }) {
  return (
    <Frame state={state}>
      <g stroke={OUTLINE} strokeWidth="3" strokeLinejoin="round">
        {/* root body */}
        <path d="M56 200 Q52 140 72 104 Q100 84 128 104 Q148 140 144 200 Z" fill="#3f6b3d" />
        <path d="M72 104 Q100 128 128 104" fill="none" strokeWidth="2.4" />
        {/* pages fanning */}
        <path d="M70 118 L34 104 L40 128 L72 134 Z" fill="#efe6cf" />
        <path d="M130 118 L166 104 L160 128 L128 134 Z" fill="#efe6cf" />
        <path d="M40 110h22M44 120h20M138 110h22M136 120h20" stroke="#8d7f5e" strokeWidth="2" />
        {/* canopy head */}
        <path d="M60 76 Q58 34 100 30 Q142 34 140 76 Q100 96 60 76 Z" fill="#2f5c31" />
        {/* eyes */}
        <ellipse cx="80" cy="62" rx="7" ry="8" fill="#c7f0a8" />
        <ellipse cx="100" cy="54" rx="6" ry="7" fill="#c7f0a8" />
        <ellipse cx="120" cy="62" rx="7" ry="8" fill="#c7f0a8" />
        <circle cx="80" cy="63" r="3" fill={OUTLINE} />
        <circle cx="100" cy="55" r="2.6" fill={OUTLINE} />
        <circle cx="120" cy="63" r="3" fill={OUTLINE} />
        {/* mouth */}
        <path d="M84 84 Q100 94 116 84" fill="none" strokeWidth="3" />
      </g>
    </Frame>
  );
}

/** Math — a rune-carved colossus of desert stone. */
function NumberCrusher({ state }: { state: BossState }) {
  return (
    <Frame state={state}>
      <g stroke={OUTLINE} strokeWidth="3" strokeLinejoin="round">
        {/* legs + body */}
        <path d="M64 200 L68 140 L132 140 L136 200 Z" fill="#b06a38" />
        <rect x="60" y="86" width="80" height="60" rx="8" fill="#c87c44" />
        {/* arms */}
        <path d="M60 96 L26 116 L26 152 L48 152 L52 124 Z" fill="#b06a38" />
        <path d="M140 96 L174 116 L174 152 L152 152 L148 124 Z" fill="#b06a38" />
        {/* fists */}
        <rect x="18" y="146" width="34" height="30" rx="7" fill="#9c5a2c" />
        <rect x="148" y="146" width="34" height="30" rx="7" fill="#9c5a2c" />
        {/* head */}
        <rect x="74" y="38" width="52" height="46" rx="8" fill="#d68b52" />
        {/* eye slit */}
        <rect x="82" y="54" width="36" height="10" rx="5" fill="#2a1408" />
        <circle cx="92" cy="59" r="3.2" fill="#ffb347" />
        <circle cx="110" cy="59" r="3.2" fill="#ffb347" />
        {/* runes */}
        <path d="M76 100h16M76 112h24M76 124h12" stroke="#f2cf5b" strokeWidth="3" />
        <path d="M112 100h12M108 112h24M116 124h12" stroke="#f2cf5b" strokeWidth="3" />
      </g>
    </Frame>
  );
}

/** Science — a deep-sea horror of glass vessels and coiling arms. */
function LabLeviathan({ state }: { state: BossState }) {
  return (
    <Frame state={state}>
      <g stroke={OUTLINE} strokeWidth="3" strokeLinejoin="round">
        {/* tentacles */}
        <path d="M62 168 Q34 182 26 204" fill="none" strokeWidth="9" stroke="#2f6f8f" />
        <path d="M80 176 Q64 198 52 208" fill="none" strokeWidth="9" stroke="#2f6f8f" />
        <path d="M120 176 Q136 198 148 208" fill="none" strokeWidth="9" stroke="#2f6f8f" />
        <path d="M138 168 Q166 182 174 204" fill="none" strokeWidth="9" stroke="#2f6f8f" />
        {/* mantle */}
        <path d="M56 150 Q48 74 100 56 Q152 74 144 150 Q100 176 56 150 Z" fill="#3f8fae" />
        {/* glass vessel on the head */}
        <path d="M84 52 L84 30 L116 30 L116 52 Q126 62 100 68 Q74 62 84 52 Z" fill="#bfe6f2" opacity=".85" />
        <rect x="80" y="24" width="40" height="8" rx="3" fill="#cbb68f" />
        <circle cx="96" cy="52" r="4" fill="#7de0c0" />
        <circle cx="108" cy="58" r="3" fill="#7de0c0" />
        {/* eyes */}
        <ellipse cx="82" cy="108" rx="12" ry="14" fill="#eaf7fb" />
        <ellipse cx="118" cy="108" rx="12" ry="14" fill="#eaf7fb" />
        <circle cx="84" cy="110" r="5.5" fill={OUTLINE} />
        <circle cx="120" cy="110" r="5.5" fill={OUTLINE} />
        {/* beak */}
        <path d="M92 138 L100 152 L108 138 Z" fill="#1f4a5e" />
      </g>
    </Frame>
  );
}

export function BossArt({ section, state, className }: Props) {
  const inner = { english: GrammarGauntlet, reading: PassageTitan, math: NumberCrusher, science: LabLeviathan }[
    section
  ];
  const Component = inner ?? GrammarGauntlet;
  return (
    <div className={className}>
      <Component state={state} />
    </div>
  );
}
