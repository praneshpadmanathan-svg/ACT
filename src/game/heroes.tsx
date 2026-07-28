/* Player sprites. Same box-shadow technique as PixelIcon, but these get
   used at several scales (map marker, select card, HUD badge) so the shadow
   string is memoised per hero+scale. */

import { useMemo } from 'react';
import { cx } from '@/lib/utils';

export interface Hero {
  id: string;
  name: string;
  desc: string;
  pal: Record<string, string>;
  rows: string[];
}

const K = '#0d0620';

export const HEROES: Hero[] = [
  {
    id: 'cadet',
    name: 'Cadet',
    desc: 'Standard issue. Reliable.',
    pal: { k: K, g: '#ff9d5c', d: '#c8543e', v: '#2a1050', c: '#9be8ff' },
    rows: [
      '..kkkkkk..',
      '.kggggggk.',
      'kggggggggk',
      'kgkvvvvkgk',
      'kgvccccvgk',
      'kgkvvvvkgk',
      '.kggggggk.',
      '..kddddk..',
      '.kggggggk.',
      'kg.gddg.gk',
      'kk.gddg.kk',
      '...kddk...',
      '..kd..dk..',
      '..kk..kk..',
    ],
  },
  {
    id: 'sage',
    name: 'Sage',
    desc: 'Knows every rule. Every one.',
    pal: { k: K, p: '#7c5cff', d: '#5a3fd0', s: '#f2c9a0', w: '#eaeeff' },
    rows: [
      '....kk....',
      '...kppk...',
      '..kppppk..',
      '.kppppppk.',
      'kkkkkkkkkk',
      '.kpsssspk.',
      '.ksskkssk.',
      '.kssssssk.',
      '.kwwwwwwk.',
      '.kppppppk.',
      'kppddddppk',
      'kpkddddkpk',
      '.kdd..ddk.',
      '.kk....kk.',
    ],
  },
  {
    id: 'ace',
    name: 'Ace',
    desc: 'Fast. Silent. Accurate.',
    pal: { k: K, n: '#26407a', d: '#182c58', r: '#ff5d78', s: '#f2c9a0' },
    rows: [
      '..kkkkkk..',
      '.knnnnnnk.',
      'knnnnnnnnk',
      'knkssssknk',
      'knsskkssnk',
      'knkssssknk',
      '.krrrrrrk.',
      '..krrrrk.r',
      '.knnnnnnkr',
      'kn.nddn.nk',
      'kk.nddn.kk',
      '...kddk...',
      '..kd..dk..',
      '..kk..kk..',
    ],
  },
  {
    id: 'nova',
    name: 'Nova',
    desc: 'Aims for the stars. Lands on 36.',
    pal: { k: K, w: '#e8ecff', d: '#b8c2e8', o: '#ff9d3b' },
    rows: [
      '..kkkkkk..',
      '.kwwwwwwk.',
      'kwwwwwwwwk',
      'kwkooookwk',
      'kwoooooowk',
      'kwkooookwk',
      '.kwwwwwwk.',
      '..kddddk..',
      '.kwwwwwwk.',
      'kw.wddw.wk',
      'kk.wddw.kk',
      '...kddk...',
      '..kd..dk..',
      '..kk..kk..',
    ],
  },
];

export const HERO_BY_ID = Object.fromEntries(HEROES.map((h) => [h.id, h]));

export function heroById(id: string | undefined): Hero {
  return (id && HERO_BY_ID[id]) || HEROES[0];
}

function shadowFor(hero: Hero, unit: number): string {
  const parts: string[] = [];
  hero.rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = hero.pal[ch];
      if (ch !== '.' && color) parts.push(`${x * unit}px ${y * unit}px 0 0 ${color}`);
    });
  });
  return parts.join(',');
}

export function HeroSprite({
  hero,
  unit = 4,
  className,
  animate = true,
}: {
  hero: Hero | string;
  unit?: number;
  className?: string;
  animate?: boolean;
}) {
  const resolved = typeof hero === 'string' ? heroById(hero) : hero;
  const shadow = useMemo(() => shadowFor(resolved, unit), [resolved, unit]);

  return (
    <div
      className={cx('relative flex-none pixelated', animate && 'animate-bob', className)}
      style={{ width: resolved.rows[0].length * unit, height: resolved.rows.length * unit }}
      aria-hidden="true"
    >
      <div style={{ position: 'absolute', top: 0, left: 0, width: unit, height: unit, boxShadow: shadow }} />
    </div>
  );
}
